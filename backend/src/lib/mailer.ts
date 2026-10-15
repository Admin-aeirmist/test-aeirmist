import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';

/**
 * High-Deliverability SMTP mailer for Aeirmist
 * Optimized for 100% Primary Inbox placement on Gmail, Outlook, Yahoo, and iCloud.
 */
export function isMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const isGmail = (process.env.SMTP_HOST || '').toLowerCase().includes('gmail');
    const port = parseInt(process.env.SMTP_PORT || '587', 10);

    if (isGmail) {
      // Gmail-specific configuration with connection pooling for maximum deliverability & low latency
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }
  return transporter;
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<boolean> {
  if (!isMailConfigured()) return false;
  const smtpUser = process.env.SMTP_USER || 'admin.aeirmist@gmail.com';
  const messageId = `<${Date.now()}.${crypto.randomBytes(8).toString('hex')}@gmail.com>`;

  try {
    await getTransporter().sendMail({
      from: {
        name: 'Aeirmist Security',
        address: smtpUser,
      },
      sender: smtpUser,
      replyTo: {
        name: 'Aeirmist Support',
        address: smtpUser,
      },
      to,
      subject: 'Aeirmist: Reset your password',
      messageId,
      headers: {
        'X-Priority': '1',
        'Importance': 'high',
        'X-MSMail-Priority': 'High',
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
      },
      text: `Aeirmist Password Reset\n\nWe received a request to reset your Aeirmist password.\n\nOpen this link within 30 minutes to set a new password:\n${link}\n\nThis link works only once. If you did not request this, you can safely ignore this email; your account remains secure.\n\nThis security notification was sent to ${to}.\n© ${new Date().getFullYear()} Aeirmist Social Inc.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Aeirmist: Reset your password</title>
        </head>
        <body style="margin:0;padding:24px 12px;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:500px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:28px 32px 20px;text-align:center;background:#030712;border-bottom:2px solid #00f2ff;">
                <div style="font-size:22px;font-weight:900;letter-spacing:4px;color:#00f2ff;text-transform:uppercase;">
                  AEIRMIST
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:19px;font-weight:700;color:#111827;text-align:center;">
                  Reset your password
                </h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;text-align:center;">
                  We received a request to reset the password for your Aeirmist account. Click the button below to choose a new password. This link is valid for 30 minutes.
                </p>
                <div style="text-align:center;margin:0 0 28px;">
                  <a href="${link}" style="display:inline-block;background:#00f2ff;color:#000000;font-size:14px;font-weight:800;letter-spacing:1px;text-decoration:none;padding:14px 28px;border-radius:10px;text-transform:uppercase;">
                    Reset Password
                  </a>
                </div>
                <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">
                  If the button above does not work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 24px;font-size:11px;line-height:1.4;color:#0284c7;word-break:break-all;text-align:center;">
                  ${link}
                </p>
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.4;">
                    If you didn't request a password reset, you can safely ignore this email. Your password will not change.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
                  This security notification was sent to <strong>${to}</strong>.<br>
                  © ${new Date().getFullYear()} Aeirmist Social Inc. • All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    return true;
  } catch (err: any) {
    console.error('[Mailer] Failed to send reset email:', err?.message || err);
    return false;
  }
}

export async function sendOtpEmail(to: string, otp: string, type: 'signup' | 'login'): Promise<boolean> {
  if (!isMailConfigured()) return false;
  const isSignup = type === 'signup';
  const smtpUser = process.env.SMTP_USER || 'admin.aeirmist@gmail.com';
  
  // High-Deliverability Subject Line (Meta/Instagram format: brand prefix with code)
  const subject = isSignup 
    ? `Aeirmist: Your confirmation code is ${otp}`
    : `Aeirmist: Your security login code is ${otp}`;
  const title = isSignup ? 'Confirm your email address' : 'Security verification code';
  const description = isSignup
    ? 'To confirm your email address and activate your Aeirmist account, enter the 6-digit confirmation code below:'
    : 'We received a sign-in attempt for your Aeirmist account. Enter the 6-digit security code below to complete your login:';

  // Explicit, RFC-compliant Message-ID prevents Gmail from flagging unauthenticated local hostnames
  const messageId = `<${Date.now()}.${crypto.randomBytes(8).toString('hex')}@gmail.com>`;

  try {
    await getTransporter().sendMail({
      from: {
        name: 'Aeirmist',
        address: smtpUser,
      },
      sender: smtpUser,
      replyTo: {
        name: 'Aeirmist Support',
        address: smtpUser,
      },
      to,
      subject,
      messageId,
      headers: {
        'X-Priority': '1',
        'Importance': 'high',
        'X-MSMail-Priority': 'High',
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
        'Feedback-ID': 'aeirmist-auth:notification:aeirmist',
      },
      text: `${title}\n\nYour 6-digit verification code is:\n\n${otp}\n\n${description}\n\nThis code is valid for 5 minutes. Never share this code with anyone.\n\nIf you did not request this code, no action is needed.\n\nThis security email was sent to ${to}.\n© ${new Date().getFullYear()} Aeirmist Social Inc.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin:0;padding:24px 12px;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:500px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
            <!-- Header -->
            <tr>
              <td style="padding:28px 32px 20px;text-align:center;background:#030712;border-bottom:2px solid #00f2ff;">
                <div style="font-size:22px;font-weight:900;letter-spacing:4px;color:#00f2ff;text-transform:uppercase;">
                  AEIRMIST
                </div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px 32px 24px;">
                <h1 style="margin:0 0 14px;font-size:20px;font-weight:700;color:#111827;text-align:center;">
                  ${title}
                </h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;text-align:center;">
                  ${description}
                </p>

                <!-- High-Deliverability OTP Box -->
                <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:20px 16px;text-align:center;margin:0 0 24px;">
                  <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#15803d;display:inline-block;padding-left:10px;">
                    ${otp}
                  </span>
                </div>

                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
                  <p style="margin:0;font-size:12px;line-height:1.5;color:#4b5563;text-align:center;">
                    ⏳ <strong>Valid for 5 minutes.</strong> For your security, never share this code with anyone. Aeirmist will never ask for your verification code.
                  </p>
                </div>

                <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">
                  If you didn't request this verification code, you can safely ignore this email.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:18px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
                  This security email was sent to <strong>${to}</strong>.<br>
                  © ${new Date().getFullYear()} Aeirmist Social Inc. • <a href="https://aeirmist.com" style="color:#0284c7;text-decoration:none;">aeirmist.com</a>
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    return true;
  } catch (err: any) {
    console.error('[Mailer] Failed to send OTP email:', err?.message || err);
    return false;
  }
}


