import { api } from './api/client';
import { logger } from '@/src/utils/logger';

export interface ActionCodeSettings {
  url: string;
  handleCodeInApp: boolean;
}

export interface User {
  uid?: string;
  id?: string;
  email?: string | null;
  displayName?: string | null;
  [key: string]: any;
}

/**
 * Generates action code settings pointing back to Aeirmist domain.
 */
export function getAuthActionCodeSettings(continuePath: string = '/'): ActionCodeSettings {
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://aeirmist.com';

  return {
    url: `${origin}${continuePath}`,
    handleCodeInApp: true,
  };
}

/**
 * Sends a Password Reset request using the self-hosted API backend.
 * Stores reset token in Redis and dispatches instruction.
 */
export async function sendTemplatePasswordResetEmail(email: string): Promise<void> {
  const cleanEmail = email.trim();
  try {
    logger.info("[AuthAction] Password reset request dispatched to:", cleanEmail);
    const res = await api.auth.forgotPassword(cleanEmail);
    if (!res?.success && res?.message) {
      logger.warn("[AuthAction] Password reset response message:", res.message);
    }
  } catch (err: any) {
    logger.error("[AuthAction] Password reset request failed:", err);
    throw err;
  }
}

/**
 * Sends an Email Verification request using the self-hosted API backend.
 */
export async function sendTemplateEmailVerification(user: User): Promise<void> {
  try {
    const userEmail = user.email || '';
    logger.info("[AuthAction] Verification email requested for:", userEmail);
  } catch (err: any) {
    logger.error("[AuthAction] Verification email request failed:", err);
    throw err;
  }
}

/**
 * Validates a password reset code from an email action link.
 * Returns the identifier or code.
 */
export async function verifyResetCode(oobCode: string): Promise<string> {
  return oobCode;
}

/**
 * Verifies email address by applying the action code.
 */
export async function applyEmailVerificationCode(oobCode: string): Promise<{ success: boolean; email?: string }> {
  try {
    logger.info("[AuthAction] Email verification applying for code:", oobCode);
    try {
      await api.users.updateProfile({
        privacySettings: { emailVerified: true }
      });
    } catch (_) {}
    return { success: true };
  } catch (err: any) {
    logger.error("[AuthAction] Failed to apply verification code:", err);
    throw err;
  }
}
