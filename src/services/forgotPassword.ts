import { api } from "./api/client";
import { logger } from "@/src/utils/logger";

/**
 * Sends a password reset request via the Aeirmist API backend.
 * Stores reset token in Redis with 1 hour TTL and dispatches reset instructions.
 * Throws on failure — callers should catch and display their own UI feedback.
 */
export async function handleForgotPassword(userEmail: string): Promise<void> {
  const cleanEmail = userEmail.trim();
  logger.info("[Auth] Dispatching password reset request for:", cleanEmail);
  const response = await api.auth.forgotPassword(cleanEmail);
  if (!response?.success && response?.message) {
    throw new Error(response.message);
  }
}
