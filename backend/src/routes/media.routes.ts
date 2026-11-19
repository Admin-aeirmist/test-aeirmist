import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import { storage } from '../storage';
import { db } from '../db';
import { mediaAssets } from '../db/schema';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
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
    fieldSize: 10 * 1024 * 1024,
    fileSize: 250 * 1024 * 1024,
  },
});

router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
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

// ----------------------------------------------------------------------
// High-Speed Chunked Upload for Large Media (Zero-Memory Stream Staging)
// ----------------------------------------------------------------------
router.post('/upload-chunk', authenticateToken, upload.single('chunk'), async (req: AuthenticatedRequest, res: Response) => {
  const file = req.file;
  try {
    if (!file) {
      return res.status(400).json({ error: 'No chunk file uploaded' });
    }

    const {
      uploadId,
      chunkIndex: chunkIndexStr,
      totalChunks: totalChunksStr,
      folder = 'videos',
      originalName = 'video.mp4',
      mimeType = 'video/mp4',
      totalSize: totalSizeStr
    } = req.body;

    if (!uploadId) {
      if (file.path) await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({ error: 'Missing uploadId for chunked transfer' });
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    const totalChunks = parseInt(totalChunksStr, 10);
    const totalSize = totalSizeStr ? parseInt(totalSizeStr, 10) : 0;

    const safeUploadId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, '');
    const assemblyPath = path.join(tempUploadDir, `assembly_${safeUploadId}.part`);

    // Stream chunk directly into assembly file using native streams
    const readStream = fsSync.createReadStream(file.path);
    const writeStream = fsSync.createWriteStream(assemblyPath, { flags: chunkIndex === 0 ? 'w' : 'a' });

    await new Promise<void>((resolve, reject) => {
      readStream.pipe(writeStream);
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) => reject(err));
      readStream.on('error', (err) => reject(err));
    });

    // Remove the incoming chunk slice immediately
    await fs.unlink(file.path).catch(() => {});

    // If more chunks remain, notify client to send next chunk
    if (chunkIndex < totalChunks - 1) {
      return res.status(200).json({
        status: 'chunk_received',
        chunkIndex,
        totalChunks,
        uploadId: safeUploadId,
      });
    }

    // Final chunk received! Commit the fully assembled file to persistent local storage
    const cleanFolder = (folder || 'videos').replace(/[^a-zA-Z0-9_-]/g, '');
    const ext = path.extname(originalName).toLowerCase() || '.mp4';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const key = `${cleanFolder}/${year}/${month}/${uuidv4()}${ext}`;

    await storage.putFile(key, assemblyPath, mimeType);

    const stat = await fs.stat(path.resolve(process.cwd(), env.STORAGE_PATH, key)).catch(() => null);
    const finalSize = totalSize || (stat ? stat.size : 0);

    const effectiveOwnerId = req.user!.userId;

    const [asset] = await db
      .insert(mediaAssets)
      .values({
        key,
        ownerId: effectiveOwnerId,
        originalName,
        mimeType,
        sizeBytes: finalSize,
        storageDriver: env.STORAGE_DRIVER,
      })
      .returning();

    const publicUrl = storage.getPublicUrl(key);

    return res.status(201).json({
      status: 'completed',
      key,
      url: publicUrl,
      assetId: asset.id,
      originalName,
      mimeType,
      sizeBytes: finalSize,
    });
  } catch (err) {
    if (file?.path) {
      await fs.unlink(file.path).catch(() => {});
    }
    console.error('[Upload Chunk Error]', err);
    res.status(500).json({ error: 'Chunk assembly failed' });
  }
});

export default router;
