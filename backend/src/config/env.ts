import * as dotenv from 'dotenv';
import * as path from 'path';

// Load root and local environment
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:4000',
  JWT_SECRET: process.env.JWT_SECRET || 'aeirmist_default_jwt_secret_change_in_production',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173,https://aeirmist.com,capacitor://localhost')
    .split(',')
    .map(s => s.trim()),

  // Database & Cache
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://aeirmist:aeirmist_secure_2026@127.0.0.1:5432/aeirmist',
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

  // Storage
  STORAGE_DRIVER: (process.env.STORAGE_DRIVER || 'local') as 'local' | 's3',
  STORAGE_PATH: process.env.STORAGE_PATH || './storage/uploads',
  PUBLIC_MEDIA_URL: process.env.PUBLIC_MEDIA_URL || 'http://localhost:4000/media',

  // S3 / R2 (Optional, for production)
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION || 'auto',
  S3_BUCKET: process.env.S3_BUCKET || 'aeirmist-media',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
};
