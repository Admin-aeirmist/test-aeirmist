import '../config/env';
import { sendPasswordResetEmail, isMailConfigured } from '../lib/mailer';

async function main() {
  const targetEmail = process.argv[2];
  if (!targetEmail || !targetEmail.includes('@')) {
    console.error('Usage: npx ts-node src/scripts/test-mail.ts <target_email>');
    process.exit(1);
  }

  if (!isMailConfigured()) {
    console.error('SMTP is not configured! Please ensure SMTP_HOST, SMTP_USER, and SMTP_PASS are set in .env');
    process.exit(1);
  }

  console.log(`[Test Mail] Attempting to send a test reset email to: ${targetEmail}`);
  const testLink = `${process.env.APP_BASE_URL || 'https://aeirmist.com'}/?mode=resetPassword&resetToken=test_sample_token_verification`;
  
  const ok = await sendPasswordResetEmail(targetEmail, testLink);
  if (ok) {
    console.log(`[Test Mail] Success! Test email dispatched successfully to ${targetEmail}`);
  } else {
    console.error(`[Test Mail] Failed to send email. Please check your SMTP credentials or network.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Test Mail Error]:', err?.message || err);
  process.exit(1);
});
