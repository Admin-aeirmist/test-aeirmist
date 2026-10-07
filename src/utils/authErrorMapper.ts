import { logger } from '@/src/utils/logger';

/**
 * Maps HTTP status codes and API error messages to user-friendly messages.
 * Designed for Aeirmist's self-hosted API backend.
 */
export function mapAuthError(error: any): string {
  if (!error) return "An unexpected error occurred. Please try again.";
  
  // Extract status if available (e.g. error.status, error.statusCode, or from message)
  const statusMatch = typeof error?.message === 'string' ? error.message.match(/HTTP error (\d+)/) : null;
  const status = error?.status || error?.statusCode || (statusMatch ? statusMatch[1] : null);
  const statusCode = status ? Number(status) : null;

  // Extract clean message
  let rawMessage = typeof error === 'string' ? error : error?.message || error?.error || error?.code || '';
  let code = typeof error === 'object' && error?.code ? String(error.code) : '';

  // Clean up any nested prefixes
  while (typeof rawMessage === 'string' && (rawMessage.startsWith('Auth Error') || rawMessage.startsWith('Error:') || rawMessage.startsWith('HTTP error'))) {
    const cleaned = rawMessage
      .replace(/^Auth Error\s*(\[[^\]]*\])?:\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .replace(/^HTTP error \d+:\s*/i, '')
      .trim();
    if (cleaned === rawMessage) break;
    rawMessage = cleaned;
  }

  // Log error details to console
  logger.error('[API Auth Debug Log]', {
    status: statusCode || 'UNKNOWN_STATUS',
    code: code || 'UNKNOWN_CODE',
    message: rawMessage || error,
  });

  const msg = (rawMessage || '').toLowerCase();

  // Status-based mapping
  if (statusCode === 401) {
    if (msg.includes('token') || msg.includes('expired') || msg.includes('unauthorized')) {
      return "Session expired or invalid credentials. Please log in again.";
    }
    return "Incorrect email or password. Please verify your credentials.";
  }

  if (statusCode === 403) {
    if (msg.includes('banned') || msg.includes('suspended') || msg.includes('disabled')) {
      return "Your account has been suspended or restricted. Please contact support.";
    }
    return "Access denied. You do not have permission to perform this action.";
  }

  if (statusCode === 404) {
    return "That username or email doesn't match an account.";
  }

  if (statusCode === 409) {
    if (msg.includes('username')) {
      return "That username is already taken. Please choose another one.";
    }
    return "An account with this email address already exists. Please log in instead.";
  }

  if (statusCode === 429) {
    return "Too many attempts. Access is temporarily rate limited. Please try again in a few moments.";
  }

  if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
    return "The authentication server is temporarily unavailable. Please try again shortly.";
  }

  // Semantic message-based matching
  if (msg.includes('wrong password') || msg.includes('incorrect password') || msg.includes('invalid credentials') || msg.includes('invalid password')) {
    return "Incorrect password. Please try again.";
  }
  if (msg.includes('user not found') || msg.includes('no user') || msg.includes('account not found')) {
    return "That username or email doesn't match an account.";
  }
  if (msg.includes('invalid email') || msg.includes('email format')) {
    return "Invalid email format. Please check for typos in your email address.";
  }
  if (msg.includes('email already') || msg.includes('already in use') || msg.includes('email exists')) {
    return "An account with this email address already exists. Please log in instead.";
  }
  if (msg.includes('username already') || msg.includes('username taken')) {
    return "That username is already taken. Please choose another one.";
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('too many attempts')) {
    return "Too many failed attempts. Access is temporarily restricted. Please try again later.";
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('networkrequestfailed') || msg.includes('connection refused')) {
    return "Network connection error. Please check your connection to the server.";
  }
  if (msg.includes('weak password') || msg.includes('password must be at least')) {
    return "Password is too weak. Please use at least 8 characters with a mix of letters, numbers, and symbols.";
  }
  if (msg.includes('banned') || msg.includes('suspended') || msg.includes('disabled')) {
    return "Your account has been suspended or disabled. Please contact support.";
  }
  if (msg.includes('reset token') || msg.includes('expired reset') || msg.includes('invalid token')) {
    return "This password reset link has expired or is invalid. Please request a new link.";
  }

  // If a clean message string is provided, return it directly
  if (rawMessage && typeof rawMessage === 'string' && rawMessage.length > 0 && !rawMessage.startsWith('HTTP error')) {
    return rawMessage;
  }

  return statusCode ? `Authentication failed (HTTP ${statusCode}). Please check your login details.` : "Authentication failed. Please verify your details and try again.";
}
