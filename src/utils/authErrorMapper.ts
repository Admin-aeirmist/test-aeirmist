import { logger } from '@/src/utils/logger';
/**
 * Maps raw Firebase Auth error codes to user-friendly error messages.
 * Logs original Firebase error details to console in development mode.
 */
export function mapAuthError(error: any): string {
  if (!error) return "An unexpected error occurred. Please try again.";
  
  // Extract clean string message if passed an Error instance or string
  let rawMessage = typeof error === 'string' ? error : error?.message || error?.code || '';
  let code = typeof error === 'object' && error?.code ? String(error.code) : '';

  // Clean up any nested "Auth Error [...]" or "Auth Error:" prefixes cleanly
  while (typeof rawMessage === 'string' && (rawMessage.startsWith('Auth Error') || rawMessage.startsWith('Error:'))) {
    const cleaned = rawMessage
      .replace(/^Auth Error\s*(\[[^\]]*\])?:\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim();
    if (cleaned === rawMessage) break;
    rawMessage = cleaned;
  }

  // Extract code embedded in message if present (e.g. auth/invalid-credential)
  if (!code && typeof rawMessage === 'string') {
    const codeMatch = rawMessage.match(/auth\/[a-z0-9-]+/i);
    if (codeMatch) {
      code = codeMatch[0].toLowerCase();
    }
  }

  // Log original error details clearly to console
  logger.error('[Firebase Auth Debug Log]', {
    code: code || 'UNKNOWN_AUTH_CODE',
    message: rawMessage || error,
    originalError: error
  });

  const c = code.toLowerCase();
  if (c.includes('auth/wrong-password') || c.includes('auth/invalid-credential')) {
    return "Incorrect password. Please try again.";
  }
  if (c.includes('auth/user-not-found')) {
    return "That username or email doesn't match an account.";
  }
  if (c.includes('auth/invalid-email')) {
    return "Invalid email format. Please check for typos in your email address.";
  }
  if (c.includes('auth/account-exists-with-different-credential')) {
    return "This email is associated with a Google Sign-In account. Please log in with Google.";
  }
  if (c.includes('auth/email-already-in-use')) {
    return "An account with this email address already exists. Please log in instead.";
  }
  if (c.includes('auth/too-many-requests')) {
    return "Too many failed attempts. Access to this account is temporarily paused for security. Please try again later or reset your password.";
  }
  if (c.includes('auth/operation-not-allowed')) {
    return "Email/Password sign-in is currently disabled in Firebase Console. Please enable Email/Password under Authentication -> Sign-in Method.";
  }
  if (c.includes('auth/network-request-failed')) {
    return "Network connection error. Please check your connection and try again.";
  }
  if (c.includes('auth/user-disabled')) {
    return "Your account has been suspended or disabled. Please contact support.";
  }
  if (c.includes('auth/weak-password')) {
    return "Password is too weak. Please use at least 6 characters with mixed letters and numbers.";
  }
  if (c.includes('auth/provider-already-linked')) {
    return "This authentication provider is already linked to your account.";
  }
  if (c.includes('auth/requires-recent-login')) {
    return "This security action requires a recent login. Please re-authenticate.";
  }
  if (c.includes('auth/popup-closed-by-user')) {
    return "Sign-in popup was closed before completing authentication.";
  }
  if (c.includes('auth/popup-blocked')) {
    return "Sign-in popup was blocked by your browser. Please allow popups for Aeirmist.";
  }
  if (c.includes('auth/unauthorized-domain')) {
    return "This domain is not authorized in Firebase Auth. Please log in using Email & Password or Guest Sandbox mode below.";
  }

  // If custom error message is available and readable, present it cleanly
  if (rawMessage && typeof rawMessage === 'string' && !rawMessage.startsWith('Firebase:')) {
    return rawMessage;
  }

  return code ? `Authentication failed (${code}). Please check your login details.` : "Authentication failed. Please verify your details and try again.";
}
