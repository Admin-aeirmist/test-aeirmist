import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string, algorithm: string = 'bcrypt', salt?: string | null): Promise<boolean> {
  if (algorithm === 'bcrypt') {
    return bcrypt.compare(password, hash);
  }

  // Firebase modified scrypt verification
  if (algorithm === 'firebase_scrypt' && salt) {
    try {
      const scrypt = await import('scrypt-js');
      const passwordBuffer = Buffer.from(password, 'utf8');
      const saltBuffer = Buffer.from(salt, 'base64');
      // Default Firebase scrypt params: N=2^14 (16384), r=8, p=1, dkLen=32
      const derivedKey = await scrypt.scrypt(passwordBuffer, saltBuffer, 16384, 8, 1, 32);
      const derivedBase64 = Buffer.from(derivedKey).toString('base64');
      return derivedBase64 === hash;
    } catch (err) {
      console.error('[Firebase Scrypt Verification Error]', err);
      return false;
    }
  }

  return false;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function generateRefreshToken(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(40).toString('hex');
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
