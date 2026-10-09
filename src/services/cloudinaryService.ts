/**
 * Cloudinary High-Speed Media Storage Service
 * Provides zero-cost, CDN-optimized image and video storage for Aeirmist Social Platform
 */
import { logger } from '../utils/logger';

export interface CloudinaryUploadOptions {
  cloudName?: string;
  uploadPreset?: string;
  folder?: string;
  onProgress?: (progress: number, status: string) => void;
}

export class CloudinaryService {
  private cloudName: string;
  private uploadPreset: string;

  private isInitialized = false;

  constructor() {
    const envCloud = (import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME;
    const envPreset = (import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET;
    this.cloudName = envCloud || 'eldujqpd';
    this.uploadPreset = envPreset || 'iqbuuhzz';

    if (typeof localStorage !== 'undefined') {
      const storedCloud = localStorage.getItem('aeirmist_cloudinary_cloud_name');
      const storedPreset = localStorage.getItem('aeirmist_cloudinary_upload_preset');
      if (storedCloud) this.cloudName = storedCloud;
      if (storedPreset) this.uploadPreset = storedPreset;
    }
  }

  public async syncWithFirestore(db: any) {
    if (!db || this.isInitialized) return;
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'system_config', 'cloudinary'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.cloudName && data.uploadPreset) {
          this.cloudName = data.cloudName;
          this.uploadPreset = data.uploadPreset;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('aeirmist_cloudinary_cloud_name', data.cloudName);
            localStorage.setItem('aeirmist_cloudinary_upload_preset', data.uploadPreset);
          }
          logger.info('[CloudinaryService] Synced config from Firestore successfully');
        }
      }
      this.isInitialized = true;
    } catch (e) {
      logger.warn('[CloudinaryService] Could not sync config from Firestore:', e);
    }
  }

  public setConfig(cloudName: string, uploadPreset: string) {
    this.saveConfig(cloudName, uploadPreset);
  }

  public async saveConfig(cloudName: string, uploadPreset: string, db?: any) {
    const trimmedCloud = cloudName.trim();
    const trimmedPreset = uploadPreset.trim();
    this.cloudName = trimmedCloud;
    this.uploadPreset = trimmedPreset;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('aeirmist_cloudinary_cloud_name', trimmedCloud);
        localStorage.setItem('aeirmist_cloudinary_upload_preset', trimmedPreset);
      }
      if (db) {
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'system_config', 'cloudinary'), {
          cloudName: trimmedCloud,
          uploadPreset: trimmedPreset,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        logger.info('[CloudinaryService] Configuration saved to Firestore system_config/cloudinary');
      }
    } catch (e) {
      logger.error('[CloudinaryService] Error saving Cloudinary config:', e);
    }
  }

  public async testConnection(cloudName: string, uploadPreset: string): Promise<{ success: boolean; error?: string }> {
    try {
      const trimmedCloud = cloudName.trim();
      const trimmedPreset = uploadPreset.trim();
      if (!trimmedCloud || !trimmedPreset) {
        return { success: false, error: 'Cloud Name and Upload Preset cannot be empty' };
      }

      // 1x1 transparent PNG blob
      const binaryString = window.atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA');
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const testBlob = new Blob([bytes], { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', testBlob, 'test_ping.png');
      formData.append('upload_preset', trimmedPreset);
      formData.append('folder', 'aeirmist_test');

      const res = await fetch(`https://api.cloudinary.com/v1_1/${trimmedCloud}/image/upload`, {
        method: 'POST',
        body: formData
      });

      const json = await res.json();
      if (res.ok && json.secure_url) {
        return { success: true };
      } else {
        return { success: false, error: json.error?.message || `HTTP ${res.status}: Upload preset or cloud name rejected` };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network connection failed' };
    }
  }

  public isConfigured(): boolean {
    const activeCloud = this.cloudName || (typeof localStorage !== 'undefined' ? localStorage.getItem('aeirmist_cloudinary_cloud_name') : null);
    const activePreset = this.uploadPreset || (typeof localStorage !== 'undefined' ? localStorage.getItem('aeirmist_cloudinary_upload_preset') : null);
    return !!(activeCloud && activePreset && activeCloud !== 'aeirmist' && activePreset !== 'aeirmist_uploads');
  }

  public getCloudName(): string {
    return this.cloudName || (typeof localStorage !== 'undefined' ? localStorage.getItem('aeirmist_cloudinary_cloud_name') || '' : '');
  }

  public getUploadPreset(): string {
    return this.uploadPreset || (typeof localStorage !== 'undefined' ? localStorage.getItem('aeirmist_cloudinary_upload_preset') || '' : '');
  }

  public async upload(file: File, options?: CloudinaryUploadOptions): Promise<string> {
    const cloudName = options?.cloudName || this.getCloudName();
    const uploadPreset = options?.uploadPreset || this.getUploadPreset();
    const folder = options?.folder || 'aeirmist';
    const onProgress = options?.onProgress;

    if (!cloudName || !uploadPreset) {
      throw new Error('Cloudinary configuration missing (cloudName or uploadPreset)');
    }

    const isVideo = file.type.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'auto';
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', folder);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          onProgress(percentComplete, 'Uploading to Cloudinary CDN...');
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.secure_url) {
              logger.info(`[CloudinaryService] Media upload success: ${response.secure_url}`);
              resolve(response.secure_url);
            } else {
              reject(new Error(response.error?.message || 'Cloudinary upload succeeded but no URL returned'));
            }
          } catch (err) {
            reject(err);
          }
        } else {
          try {
            const errorResp = JSON.parse(xhr.responseText);
            reject(new Error(errorResp.error?.message || `Cloudinary upload error (${xhr.status})`));
          } catch {
            reject(new Error(`Cloudinary upload HTTP error: ${xhr.status}`));
          }
        }
      };

      // Dynamic timeout: 5s for images, 120s for videos (videos are much larger)
      const timeoutMs = isVideo ? 120000 : 5000;
      xhr.timeout = timeoutMs;
      xhr.ontimeout = () => {
        try { xhr.abort(); } catch(e) {}
        reject(new Error(`Cloudinary upload timed out (${timeoutMs/1000}s limit for ${isVideo ? 'video' : 'image'})`));
      };

      xhr.onerror = () => {
        reject(new Error('Network error during Cloudinary upload'));
      };

      xhr.send(formData);
    });
  }
}

export const cloudinaryService = new CloudinaryService();
