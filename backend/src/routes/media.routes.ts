import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { storage } from '../storage';
import { db } from '../db';
import { mediaAssets } from '../db/schema';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

// Configure multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max for video/large attachments
  },
});

router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folder = (req.body.folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Generated storage key: e.g. posts/2026/10/uuid.jpg
    const key = `${folder}/${year}/${month}/${uuidv4()}${ext}`;

    // Upload via unified storage module
    await storage.put(key, file.buffer, file.mimetype);

    // Save record to media_assets in PostgreSQL
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        key,
        ownerId: req.user!.userId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageDriver: env.STORAGE_DRIVER,
      })
      .returning();

    const publicUrl = storage.getPublicUrl(key);

    res.status(201).json({
      key,
      url: publicUrl,
      assetId: asset.id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
  } catch (err) {
    console.error('[Upload Error]', err);
    res.status(500).json({ error: 'File upload failed' });
  }
});

export default router;
