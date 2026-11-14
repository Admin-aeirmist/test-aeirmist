import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import { storage } from '../storage';
import { db } from '../db';
import { mediaAssets } from '../db/schema';
import { authenticateToken, optionalAuthToken, AuthenticatedRequest } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

// Configure high-speed streaming disk storage for zero-memory video transfers
const tempUploadDir = path.resolve(process.cwd(), env.STORAGE_PATH, 'temp');
if (!fsSync.existsSync(tempUploadDir)) {
  fsSync.mkdirSync(tempUploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `stream_${Date.now()}_${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: {
    fieldSize: Infinity,
    fileSize: Infinity,
  },
});

router.post('/upload', optionalAuthToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  const file = req.file;
  try {
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folder = (req.body.folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
    const originalName = req.body.originalName || file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const originalSize = req.body.originalSize ? parseInt(req.body.originalSize, 10) : file.size;
    const mimeType = req.body.mimeType || file.mimetype;

    const ALLOWED_EXTENSIONS = new Set([
      '.jpg', '.jpeg', '.png', '.webp', '.gif',
      '.mp4', '.webm', '.mov', '.mkv', '.avi', '.flv', '.wmv',
      '.mp3', '.m4a', '.ogg', '.wav',
      '.pdf'
    ]);

    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      if (file.path) await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({ 
        error: 'Unsupported or unsafe file type. Permitted formats: images (jpg, png, webp, gif), audio (mp3, wav, m4a), video (mp4, webm, mov), and pdf.' 
      });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Generated storage key: e.g. posts/2026/10/uuid.mp4
    const key = `${folder}/${year}/${month}/${uuidv4()}${ext}`;

    // Zero-copy stream file directly into persistent storage
    await storage.putFile(key, file.path, mimeType);

    // Save record to media_assets in PostgreSQL
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        key,
        ownerId: req.user?.userId || null,
        originalName,
        mimeType,
        sizeBytes: originalSize,
        storageDriver: env.STORAGE_DRIVER,
      })
      .returning();

    const publicUrl = storage.getPublicUrl(key);

    res.status(201).json({
      key,
      url: publicUrl,
      assetId: asset.id,
      originalName,
      mimeType,
      sizeBytes: originalSize,
    });
  } catch (err) {
    if (file?.path) {
      await fs.unlink(file.path).catch(() => {});
    }
    console.error('[Upload Error]', err);
    res.status(500).json({ error: 'File upload failed' });
  }
});

export default router;
