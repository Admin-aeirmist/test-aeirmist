import * as fs from 'fs/promises';
import * as path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';

export interface StorageService {
  put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<string>;
  putFile(key: string, sourcePath: string, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}

class LocalStorage implements StorageService {
  private basePath: string;

  constructor() {
    this.basePath = path.resolve(process.cwd(), env.STORAGE_PATH);
  }

  async put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<string> {
    const cleanKey = key.replace(/^[/\\]+/, '');
    const fullPath = path.join(this.basePath, cleanKey);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, data);

    return cleanKey;
  }

  async putFile(key: string, sourcePath: string, contentType: string): Promise<string> {
    const cleanKey = key.replace(/^[/\\]+/, '');
    const fullPath = path.join(this.basePath, cleanKey);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.rename(sourcePath, fullPath);
    } catch {
      await fs.copyFile(sourcePath, fullPath);
      await fs.unlink(sourcePath).catch(() => {});
    }

    return cleanKey;
  }

  async delete(key: string): Promise<void> {
    const cleanKey = key.replace(/^[/\\]+/, '');
    const fullPath = path.join(this.basePath, cleanKey);
    try {
      await fs.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^[/\\]+/, '');
    if (env.PUBLIC_MEDIA_URL.includes('localhost') || env.PUBLIC_MEDIA_URL.includes('127.0.0.1')) {
      return `/media/${cleanKey}`;
    }
    return `${env.PUBLIC_MEDIA_URL.replace(/\/+$/, '')}/${cleanKey}`;
  }
}

class S3Storage implements StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error('S3 credentials (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY) are required for S3Storage driver');
    }

    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<string> {
    const cleanKey = key.replace(/^[/\\]+/, '');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
        Body: data,
        ContentType: contentType,
      })
    );
    return cleanKey;
  }

  async putFile(key: string, sourcePath: string, contentType: string): Promise<string> {
    const cleanKey = key.replace(/^[/\\]+/, '');
    const data = await fs.readFile(sourcePath);
    await this.put(cleanKey, data, contentType);
    await fs.unlink(sourcePath).catch(() => {});
    return cleanKey;
  }

  async delete(key: string): Promise<void> {
    const cleanKey = key.replace(/^[/\\]+/, '');
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      })
    );
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^[/\\]+/, '');
    return `${env.PUBLIC_MEDIA_URL.replace(/\/+$/, '')}/${cleanKey}`;
  }
}

export const storage: StorageService =
  env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();
