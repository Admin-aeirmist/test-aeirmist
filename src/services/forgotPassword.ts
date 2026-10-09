import { sendTemplatePasswordResetEmail } from "./authActionService";

/**
 * Sends a password reset email using the configured Firebase Authentication template.
 * Throws on failure — callers should catch and display their own UI feedback.
 */
export async function handleForgotPassword(userEmail: string): Promise<void> {
  await sendTemplatePasswordResetEmail(userEmail);
}

