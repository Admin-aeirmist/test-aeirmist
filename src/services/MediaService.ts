import { ref, uploadBytesResumable, getDownloadURL, uploadBytes } from 'firebase/storage';
import { aeirmistCache } from './CacheService';
import { logger } from '@/src/utils/logger';
import { cloudinaryService } from './cloudinaryService';


export enum MediaQuality {
  AUTO = 'auto',
  DATA_SAVER = 'data_saver',
  HD = 'hd',
  ULTRA = 'ultra',
  THUMBNAIL = 'thumbnail',
  PROFILE = 'profile',
  STORY = 'story',
  LITE = 'lite',
  WALLPAPER_LITE = 'wallpaper_lite'
}

interface UploadTask {
  id: string;
  file: File;
  path: string;
  isHD: boolean;
  quality: MediaQuality;
  onProgress: (progress: number, status: string) => void;
  resolve: (url: string) => void;
  reject: (error: any) => void;
  retries: number;
}

class MediaService {
  private uploadQueue: UploadTask[] = [];


  async compressImage(file: File, quality: MediaQuality = MediaQuality.AUTO): Promise<File> {
    let maxWidthOrHeight = 1440;
    let initialQuality = 0.80;

    switch (quality) {
      case MediaQuality.LITE:
        maxWidthOrHeight = 400;
        initialQuality = 0.50;
        break;
      case MediaQuality.WALLPAPER_LITE:
        maxWidthOrHeight = 1024;
        initialQuality = 0.65;
        break;
      case MediaQuality.DATA_SAVER:
        maxWidthOrHeight = 1024;
        initialQuality = 0.70;
        break;
      case MediaQuality.PROFILE:
        maxWidthOrHeight = 512; 
        initialQuality = 0.85;
        break;
      case MediaQuality.STORY:
        maxWidthOrHeight = 1280;
        initialQuality = 0.75;
        break;
      case MediaQuality.THUMBNAIL:
        maxWidthOrHeight = 256;
        initialQuality = 0.60;
        break;
      case MediaQuality.HD:
        maxWidthOrHeight = 2560;
        initialQuality = 0.92;
        break;
      case MediaQuality.ULTRA:
        maxWidthOrHeight = 2560;
        initialQuality = 0.95;
        break;
      case MediaQuality.AUTO:
      default:
        maxWidthOrHeight = 1440;
        initialQuality = 0.80;
        break;
    }

    if (typeof window === 'undefined') {
      return file;
    }

    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
            if (width > height) {
              height = Math.round((height * maxWidthOrHeight) / width);
              width = maxWidthOrHeight;
            } else {
              width = Math.round((width * maxWidthOrHeight) / height);
              height = maxWidthOrHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Export to blob directly (fast)
          const mimeType = file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp' ? file.type : 'image/jpeg';
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(objectUrl);
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: mimeType,
                  lastModified: Date.now(),
                });
                logger.info(`[MediaService] Fast canvas compression completed: ${file.name}. Original size: ${file.size} bytes, compressed size: ${compressedFile.size} bytes`);
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            mimeType,
            initialQuality
          );
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          logger.error('[MediaService] Fast compression canvas error, using original:', err);
          resolve(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        logger.error('[MediaService] Failed to load image element for compression, using original');
        resolve(file);
      };
      img.src = objectUrl;
    });
  }

  async uploadWithProgress(
    storage: any, 
    file: File, 
    path: string, 
    onProgress: (progress: number, status: string) => void,
    quality: MediaQuality = MediaQuality.AUTO
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const task: UploadTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        path,
        isHD: quality === MediaQuality.HD || quality === MediaQuality.ULTRA,
        quality,
        onProgress,
        resolve,
        reject,
        retries: 0
      };

      this.uploadQueue.push(task);
      this.processQueue(storage);
    });
  }

  private maxParallelUploads = 3;
  private currentUploads = 0;

  private async processQueue(storage: any) {
    if (this.currentUploads >= this.maxParallelUploads || this.uploadQueue.length === 0) return;

    while (this.currentUploads < this.maxParallelUploads && this.uploadQueue.length > 0) {
      const task = this.uploadQueue.shift()!;
      this.currentUploads++;
      
      // Fire and forget, but handle tracking
      this.executeUploadTask(storage, task)
        .then((url) => {
          task.resolve(url);
        })
        .catch(async (error) => {
          const nonRetriableErrors = [
            'storage/canceled',
            'storage/unauthorized',
            'storage/unauthenticated',
            'storage/invalid-argument',
            'storage/no-default-bucket',
            'storage/project-not-found'
          ];
          
          const isRetriable = !nonRetriableErrors.includes(error?.code);
          
          if (isRetriable && task.retries < 2) {
            task.retries++;
            const delay = 300 + (Math.random() * 200);
            logger.warn(`[MediaService] Connection issue detected. Retrying task ${task.id} (${task.retries}/2) in ${Math.round(delay)}ms...`);
            await new Promise(r => setTimeout(r, delay));
            this.uploadQueue.push(task); // Re-queue
          } else {
            logger.error(`[MediaService] Permanent upload failure for task ${task.id} after ${task.retries} retries:`, error);
            try {
              await aeirmistCache.removePendingUpload(task.id);
            } catch(e) { logger.warn("Pending upload cleanup failed", e); }
            task.reject(error);
          }
        })
        .finally(() => {
          this.currentUploads--;
          this.processQueue(storage); // Check for more tasks
        });
    }
  }

  private async executeUploadTask(storage: any, task: UploadTask): Promise<string> {
    const { file, path, onProgress } = task;
    logger.info(`[MediaService] Execution started: ${file.name}, path: ${path}, type: ${file.type}`);
    
    const storageRef = ref(storage, path);
    logger.info(`[MediaService] Storage ref created: ${storageRef.fullPath}`);
    
    // Step 1: Pre-compression if image
    let uploadFile = file;
    const isPreOptimizedCrop = file.name.startsWith('aeirmist_cover_') || file.name.startsWith('aeirmist_avatar_');
    if (file.type.startsWith('image/')) {
      if (isPreOptimizedCrop) {
        logger.info(`[MediaService] High-resolution pre-cropped asset detected (${file.name}), preserving pristine 1080p HD quality without duplicate compression.`);
        onProgress(5, 'Preserving 1080p HD...');
      } else {
        logger.info(`[MediaService] Image detected, compressing for max speed (Quality: ${task.quality})...`);
        onProgress(5, 'Optimizing...');
        uploadFile = await this.compressImage(file, task.quality);
        logger.info(`[MediaService] Compression complete. New size: ${uploadFile.size} bytes`);
      }
    } else {
      logger.info(`[MediaService] No compression needed for ${file.type}`);
    }

    // Persist for potential recovery
    await aeirmistCache.savePendingUpload(task.id, path, uploadFile);

    onProgress(15, 'Uploading...');
    const metadata = {
      contentType: uploadFile.type || 'application/octet-stream',
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        quality: task.isHD ? 'HD' : 'Standard'
      }
    };
    logger.info(`[MediaService] Metadata prepared. Uploading...`);

    const convertFileToDataURL = (fileToConvert: File): Promise<string> => {
      return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = (err) => rej(err);
        reader.readAsDataURL(fileToConvert);
      });
    };

    // Try Cloudinary CDN Upload First if configured
    if (cloudinaryService.isConfigured()) {
      try {
        const folderName = path.split('/')[0] || 'aeirmist';
        const cdnUrl = await cloudinaryService.upload(uploadFile, {
          folder: `aeirmist/${folderName}`,
          onProgress: (p, status) => onProgress(Math.min(95, Math.floor(15 + p * 0.8)), status)
        });
        if (cdnUrl) {
          aeirmistCache.saveMedia(cdnUrl, uploadFile, uploadFile.type).catch(e => logger.warn("Cache save failed", e));
          aeirmistCache.removePendingUpload(task.id).catch(e => logger.warn("Cache remove failed", e));
          return cdnUrl;
        }
      } catch (cErr) {
        logger.warn("[MediaService] Cloudinary upload failed/timed out, falling back to Firebase Storage:", cErr);
      }
    }

    try {
      return await new Promise<string>((resolve, reject) => {
        // Step: PROGRESS-ACTIVITY WATCHDOG (cellular-resilient: 25s for images, 60s for videos)
        const isVideoUpload = uploadFile.type.startsWith('video/');
        const inactivityLimit = isVideoUpload ? 60000 : 25000;
        let watchdogId: any = null;

        const resetWatchdog = () => {
          if (watchdogId) clearTimeout(watchdogId);
          watchdogId = setTimeout(() => {
            logger.error(`[MediaService] Upload INACTIVITY TIMEOUT for task ${task.id} after ${inactivityLimit/1000}s`);
            try { uploadTask.cancel(); } catch(e) {}
            reject({ code: 'storage/retry-limit-exceeded', message: `Inactivity timeout (${inactivityLimit/1000}s). Check internet connection.` });
          }, inactivityLimit);
        };

        const cleanup = () => {
          if (watchdogId) clearTimeout(watchdogId);
        };

        resetWatchdog();

        logger.info(`[MediaService] Starting Resumable Upload: ${uploadFile.size} bytes, path: ${path}, type: ${uploadFile.type}`);
        const uploadTask = uploadBytesResumable(storageRef, uploadFile, metadata);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            resetWatchdog();
            const progress = snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0;
            onProgress(progress, 'Uploading...');
          },
          (error: any) => {
            cleanup();
            reject(error);
          },
          async () => {
            try {
              cleanup();
              onProgress(100, 'Publishing...');
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              aeirmistCache.saveMedia(downloadURL, uploadFile, uploadFile.type).catch(e => logger.warn("Cache save failed", e));
              aeirmistCache.removePendingUpload(task.id).catch(e => logger.warn("Cache remove failed", e));
              
              resolve(downloadURL);
            } catch (e) {
              reject(e);
            }
          }
        );
      });
    } catch (storageErr) {
      logger.warn("[MediaService] Storage upload failed:", storageErr);
      
      // Video files MUST NEVER fall back to Data URLs - base64 video will freeze the UI thread and crash Firestore
      if (uploadFile.type.startsWith('video/')) {
        aeirmistCache.removePendingUpload(task.id).catch(() => {});
        throw new Error(
          cloudinaryService.isConfigured() 
            ? "Video upload failed. Please check your internet connection or verify your Cloudinary storage quota."
            : "Cloudinary CDN storage is not configured. Please enter your Cloud Name & Upload Preset in the uploader to stream videos."
        );
      }

      onProgress(100, 'Finalizing...');
      // Safe fallback: compress image tightly so Data URI won't blow Firestore 1MB doc size
      let safeFile = uploadFile;
      if (uploadFile.type.startsWith('image/')) {
        try {
          safeFile = await this.compressImage(uploadFile, MediaQuality.LITE);
        } catch (compErr) {
          logger.warn("[MediaService] Fallback compression failed, using original:", compErr);
        }
      }
      
      // If still over 700KB, do not create Data URL as it will exceed Firestore's 1MB limit
      if (safeFile.size > 700 * 1024) {
        aeirmistCache.removePendingUpload(task.id).catch(() => {});
        throw new Error("Image too large for local fallback. Please check connection and try again.");
      }

      const fallbackUrl = await convertFileToDataURL(safeFile);
      aeirmistCache.removePendingUpload(task.id).catch(() => {});
      return fallbackUrl;
    }
  }

  async getCachedMediaURL(url: string, type: string): Promise<string> {
    const cachedBlob = await aeirmistCache.getMedia(url);
    if (cachedBlob) {
      return URL.createObjectURL(cachedBlob);
    }

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await aeirmistCache.saveMedia(url, blob, type);
      return URL.createObjectURL(blob);
    } catch (e) {
      return url; 
    }
  }

  async generateThumbnail(file: File): Promise<string | null> {
    if (file.type.startsWith('image/')) {
      return this.generateImageThumbnail(file);
    } else if (file.type.startsWith('video/')) {
      return this.generateVideoThumbnail(file);
    }
    return null;
  }

  private async generateImageThumbnail(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxSize = 20; 
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/webp', 0.1));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  private async generateVideoThumbnail(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        video.currentTime = 0.1;
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.2));
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => resolve(null);
      video.src = URL.createObjectURL(file);
    });
  }
}

export const mediaService = new MediaService();
