import { 
  ActionCodeSettings, 
  sendPasswordResetEmail, 
  sendEmailVerification, 
  applyActionCode, 
  verifyPasswordResetCode, 
  checkActionCode,
  User
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';

/**
 * Generates official ActionCodeSettings pointing back to Aeirmist domain.
 * This integrates seamlessly with Firebase Authentication Email Templates:
 * - Email address verification
 * - Password reset
 * - Email address change
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
 * Sends a Password Reset email using the configured Firebase Authentication template
 * with explicit actionCodeSettings so the user returns to Aeirmist with mode=resetPassword.
 * Falls back to standard dispatch if continue URL is rejected.
 */
export async function sendTemplatePasswordResetEmail(email: string): Promise<void> {
  const cleanEmail = email.trim();
  try {
    const settings = getAuthActionCodeSettings('/?mode=resetPassword');
    await sendPasswordResetEmail(auth, cleanEmail, settings);
    logger.info("[AuthTemplate] Password reset email dispatched with actionCodeSettings to:", cleanEmail);
  } catch (err: any) {
    logger.warn("[AuthTemplate] ActionCodeSettings dispatch failed, attempting standard template fallback:", err);
    // If domain isn't authorized in Firebase Console or continue URL fails, retry with standard Firebase dispatch
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      logger.info("[AuthTemplate] Password reset email dispatched via standard fallback to:", cleanEmail);
    } catch (fallbackErr) {
      logger.error("[AuthTemplate] Password reset email failed completely:", fallbackErr);
      throw fallbackErr;
    }
  }
}

/**
 * Sends an Email Verification email using the configured Firebase Authentication template
 * with explicit actionCodeSettings so the user returns to Aeirmist with mode=verifyEmail.
 * Falls back to standard dispatch if continue URL is rejected.
 */
export async function sendTemplateEmailVerification(user: User): Promise<void> {
  try {
    const settings = getAuthActionCodeSettings('/?mode=verifyEmail');
    await sendEmailVerification(user, settings);
    logger.info("[AuthTemplate] Verification email sent with actionCodeSettings to:", user.email);
  } catch (err: any) {
    logger.warn("[AuthTemplate] Verification email with ActionCodeSettings failed, attempting standard fallback:", err);
    try {
      await sendEmailVerification(user);
      logger.info("[AuthTemplate] Verification email sent via standard fallback to:", user.email);
    } catch (fallbackErr) {
      logger.error("[AuthTemplate] Verification email failed completely:", fallbackErr);
      throw fallbackErr;
    }
  }
}

/**
 * Validates a password reset code from an email template action link.
 * Returns the email address associated with the reset code.
 */
export async function verifyResetCode(oobCode: string): Promise<string> {
  return await verifyPasswordResetCode(auth, oobCode);
}

/**
 * Verifies email address by applying the action code from the verification template.
 * Also reloads currentUser and syncs Firestore profile if a user is active.
 */
export async function applyEmailVerificationCode(oobCode: string): Promise<{ success: boolean; email?: string }> {
  try {
    let email: string | undefined;
    try {
      const info = await checkActionCode(auth, oobCode);
      email = info.data?.email;
    } catch (checkErr) {
      logger.warn("[AuthTemplate] checkActionCode warning (continuing with apply):", checkErr);
    }

    // Apply the action code directly in Firebase Auth
    await applyActionCode(auth, oobCode);

    // If an authenticated user is active, reload and sync Firestore
    if (auth.currentUser) {
      await auth.currentUser.reload().catch(() => {});
      const uid = auth.currentUser.uid;
      if (db) {
        try {
          await updateDoc(doc(db, 'profiles', `profile_${uid}`), {
            emailVerified: true,
            personalEmailVerified: true
          });
        } catch (updateErr) {
          logger.warn("[AuthTemplate] Could not update profile emailVerified field:", updateErr);
        }
      }
    }

    logger.info("[AuthTemplate] Email successfully verified via action code. Target email:", email);
    return { success: true, email };
  } catch (err: any) {
    logger.error("[AuthTemplate] Failed to apply verification code:", err);
    throw err;
  }
}
