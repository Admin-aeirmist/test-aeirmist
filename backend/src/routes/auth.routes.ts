import { Router, Response } from 'express';
import { z } from 'zod';
import { UserDAL } from '../dal/user.dal';
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken } from '../lib/auth';
import { authenticateToken, AuthenticatedRequest, resolveUserFromCredentials } from '../middleware/auth';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimiter';
import * as crypto from 'crypto';
import { sendPasswordResetEmail, sendOtpEmail, isMailConfigured } from '../lib/mailer';
import { detectLocation } from '../utils/geoIp';

function maskEmail(email: string): string {
  const [userPart, domainPart] = email.split('@');
  if (!domainPart) return email;
  const visibleLen = Math.min(2, Math.max(1, Math.floor(userPart.length / 2)));
  return `${userPart.slice(0, visibleLen)}${'*'.repeat(Math.max(3, userPart.length - visibleLen))}@${domainPart}`;
}

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(100),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  deviceInfo: z.string().optional(),
});

const LoginSchema = z.object({
  identifier: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  deviceInfo: z.string().optional(),
}).refine(data => !!(data.identifier || data.email), {
  message: 'Either identifier or email must be provided',
});

// Check Username Availability
router.get('/check-username', async (req, res: Response) => {
  try {
    const rawUsername = (req.query.username as string || '').trim().toLowerCase().replace(/^@+/, '');
    if (!rawUsername || rawUsername.length < 3) {
      return res.status(400).json({ available: false, error: 'Username must be at least 3 characters' });
    }
    const existing = await UserDAL.getProfileByUsername(rawUsername);
    if (existing) {
      return res.json({ available: false, error: 'Username is already taken' });
    }
    return res.json({ available: true });
  } catch (err) {
    return res.json({ available: true });
  }
});

// 1. Sign-Up Request OTP (Meta-style: validates details, reserves pending signup in Redis, emails 6-digit code)
router.post('/signup/request-otp', authRateLimiter, async (req, res: Response) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const cleanEmail = data.email.toLowerCase().trim();

    const existingUser = await UserDAL.findByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const existingProfile = await UserDAL.getProfileByUsername(data.username);
    if (existingProfile) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const { redis } = await import('../db/redis');
    const cooldown = await redis.get(`otp_rate:${cleanEmail}`);
    if (cooldown) {
      return res.status(429).json({ error: 'Please wait before requesting another code.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const passwordHash = await hashPassword(data.password);
    const detected = await detectLocation(req, data.location, data.latitude, data.longitude);

    // Save pending signup data in Redis for 10 minutes (600s)
    await redis.setex(`pending_signup:${cleanEmail}`, 600, JSON.stringify({
      email: cleanEmail,
      username: data.username,
      displayName: data.displayName,
      passwordHash,
      location: detected.location,
      latitude: detected.latitude,
      longitude: detected.longitude,
      deviceInfo: data.deviceInfo || 'Browser Session',
      otp,
    }));

    // Rate limiter cooldown (45s)
    await redis.setex(`otp_rate:${cleanEmail}`, 45, '1');

    await sendOtpEmail(cleanEmail, otp, 'signup');
    console.log(`✉️ [Signup OTP] Verification code for ${cleanEmail}: ${otp}`);

    res.json({
      success: true,
      message: 'Verification code sent to your email',
      email: cleanEmail,
      maskedEmail: maskEmail(cleanEmail),
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Signup Request OTP Error]', err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// 2. Sign-Up Verify OTP (Confirms code, registers in PostgreSQL, issues JWT session)
router.post('/signup/verify-otp', authRateLimiter, async (req, res: Response) => {
  try {
    const { email, otp, deviceInfo } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and 6-digit verification code are required' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const { redis } = await import('../db/redis');
    const rawData = await redis.get(`pending_signup:${cleanEmail}`);
    if (!rawData) {
      return res.status(400).json({ error: 'Verification code expired or invalid. Please request a new code.' });
    }

    const pending = JSON.parse(rawData);
    if (pending.otp.trim() !== String(otp).trim()) {
      return res.status(400).json({ error: 'Incorrect verification code. Please check your email.' });
    }

    // Clean up Redis
    await redis.del(`pending_signup:${cleanEmail}`);
    await redis.del(`otp_rate:${cleanEmail}`);

    // Create user in PostgreSQL
    const user = await UserDAL.createUser({
      email: pending.email,
      passwordHash: pending.passwordHash,
      passwordAlgorithm: 'bcrypt',
    });

    // Mark email_verified in PostgreSQL
    const { db: database } = await import('../db');
    const { users } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    await database.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));

    const detected = await detectLocation(req, pending.location, pending.latitude, pending.longitude);
    const detectedLocation = detected.location;
    const profile = await UserDAL.createProfile({
      userId: user.id,
      username: pending.username,
      displayName: pending.displayName,
      location: detectedLocation,
    });

    // Record login session
    const session = await UserDAL.recordLoginSession({
      userId: user.id,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceName: deviceInfo || pending.deviceInfo || 'Browser Session',
      location: detectedLocation,
      latitude: detected.latitude || pending.latitude,
      longitude: detected.longitude || pending.longitude,
      isTrusted: true,
    });

    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = generateRefreshToken();
    try {
      const { refreshTokens } = await import('../db/schema');
      await database.insert(refreshTokens).values({
        userId: user.id,
        token: refreshTokenValue,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
    } catch (rtErr) {
      console.warn('[Auth] Refresh token save notice:', rtErr);
    }

    res.status(201).json({
      token,
      refreshToken: refreshTokenValue,
      sessionToken: session?.sessionToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile,
      },
    });
  } catch (err: any) {
    console.error('[Signup Verify OTP Error]', err);
    res.status(500).json({ error: 'Failed to verify account' });
  }
});

// Fallback legacy Direct Register (Auto-marks verified if bypass requested)
router.post('/register', authRateLimiter, async (req, res: Response) => {
  try {
    const data = RegisterSchema.parse(req.body);

    const existingUser = await UserDAL.findByEmail(data.email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const existingProfile = await UserDAL.getProfileByUsername(data.username);
    if (existingProfile) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const passwordHash = await hashPassword(data.password);
    const user = await UserDAL.createUser({
      email: data.email,
      passwordHash,
      passwordAlgorithm: 'bcrypt',
    });

    const detected = await detectLocation(req, data.location, data.latitude, data.longitude);
    const detectedLocation = detected.location;
    const profile = await UserDAL.createProfile({
      userId: user.id,
      username: data.username,
      displayName: data.displayName,
      location: detectedLocation,
    });

    const session = await UserDAL.recordLoginSession({
      userId: user.id,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceName: data.deviceInfo || 'Browser Session',
      location: detectedLocation,
      latitude: detected.latitude || data.latitude,
      longitude: detected.longitude || data.longitude,
      isTrusted: true,
    });

    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = generateRefreshToken();
    try {
      const { refreshTokens } = await import('../db/schema');
      const { db: database } = await import('../db');
      await database.insert(refreshTokens).values({
        userId: user.id,
        token: refreshTokenValue,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    } catch (rtErr) {
      console.warn('[Auth] Refresh token save notice:', rtErr);
    }

    res.status(201).json({
      token,
      refreshToken: refreshTokenValue,
      sessionToken: session?.sessionToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Register Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Login with Meta-style 2FA & Trusted Device verification
router.post('/login', authRateLimiter, async (req, res: Response) => {
  try {
    const data = LoginSchema.parse(req.body);
    const loginIdentifier = (data.identifier || data.email || '').trim();

    const user = await UserDAL.findByEmailOrUsername(loginIdentifier);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    if (user.isBanned || user.status === 'BANNED' || user.status === 'DELETED') {
      return res.status(403).json({ error: 'Account is suspended or deactivated' });
    }

    let isValid = false;
    if (!isValid) {
      isValid = await comparePassword(
        data.password,
        user.passwordHash,
        user.passwordAlgorithm,
        user.passwordSalt
      );
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    // Seamless migration: If authenticated via legacy Firebase scrypt, upgrade immediately to bcrypt!
    if (user.passwordAlgorithm === 'firebase_scrypt') {
      const newBcryptHash = await hashPassword(data.password);
      await UserDAL.updatePassword(user.id, newBcryptHash, 'bcrypt');
      console.log(`🔑 [Auto-Upgrade] User ${user.email} password upgraded from Firebase Scrypt to Bcrypt`);
    }

    const detected = await detectLocation(req, data.location, data.latitude, data.longitude);
    const detectedLocation = detected.location;
    if (detectedLocation && detectedLocation !== 'Location unavailable') {
      await UserDAL.updateProfile(user.id, { location: detectedLocation });
    }

    // Check if device is trusted (Meta-style: bypass OTP if "Trust this device" was previously checked)
    const clientTrustToken = (req.headers['x-device-trust-token'] as string) || (req.body?.trustToken as string);
    const { redis } = await import('../db/redis');
    let isDeviceTrusted = false;

    if (clientTrustToken) {
      const trusted = await redis.get(`trusted_device:${user.id}:${clientTrustToken}`);
      if (trusted === '1') {
        isDeviceTrusted = true;
      }
    }

    // If device is NOT trusted, initiate Meta-style 2FA Email Verification!
    if (!isDeviceTrusted) {
      const otp = crypto.randomInt(100000, 999999).toString();
      const tempToken = crypto.randomBytes(32).toString('hex');

      // Save 2FA challenge in Redis (valid for 5 minutes / 300s)
      await redis.setex(`login_2fa:${tempToken}`, 300, JSON.stringify({
        userId: user.id,
        email: user.email,
        otp,
        detectedLocation,
        latitude: detected.latitude || data.latitude,
        longitude: detected.longitude || data.longitude,
        deviceInfo: data.deviceInfo || 'Browser Session',
      }));

      // Send OTP to user's verified email
      await sendOtpEmail(user.email, otp, 'login');
      console.log(`🛡️ [Login 2FA OTP] Security code for ${user.email}: ${otp}`);

      return res.json({
        requires2FA: true,
        tempToken,
        maskedEmail: maskEmail(user.email),
        message: 'Security code sent to your email',
      });
    }

    // Device IS trusted: Issue full session tokens directly
    const session = await UserDAL.recordLoginSession({
      userId: user.id,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceName: data.deviceInfo || 'Browser Session',
      location: detectedLocation,
      latitude: detected.latitude || data.latitude,
      longitude: detected.longitude || data.longitude,
      isTrusted: true,
    });

    const profile = await UserDAL.getProfileByUserId(user.id);
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = generateRefreshToken();
    try {
      const { refreshTokens } = await import('../db/schema');
      const { db: database } = await import('../db');
      await database.insert(refreshTokens).values({
        userId: user.id,
        token: refreshTokenValue,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
    } catch (rtErr) {
      console.warn('[Auth] Refresh token save notice:', rtErr);
    }

    res.json({
      token,
      refreshToken: refreshTokenValue,
      sessionToken: session?.sessionToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Login Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Verify Login 2FA Code (Supports "Trust this device" 30-day token)
router.post('/login/verify-2fa', authRateLimiter, async (req, res: Response) => {
  try {
    const { tempToken, otp, trustDevice } = req.body;
    if (!tempToken || !otp) {
      return res.status(400).json({ error: 'Session token and 6-digit code are required' });
    }

    const { redis } = await import('../db/redis');
    const rawData = await redis.get(`login_2fa:${tempToken}`);
    if (!rawData) {
      return res.status(400).json({ error: 'Security code has expired. Please log in again.' });
    }

    const parsed = JSON.parse(rawData);
    if (parsed.otp.trim() !== String(otp).trim()) {
      return res.status(400).json({ error: 'Incorrect verification code. Please check your email.' });
    }

    // Consume single-use challenge token
    await redis.del(`login_2fa:${tempToken}`);

    const user = await UserDAL.findById(parsed.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user checks "Trust this device", generate 30-day trust token
    let newTrustToken: string | undefined = undefined;
    if (trustDevice) {
      newTrustToken = crypto.randomBytes(32).toString('hex');
      await redis.setex(`trusted_device:${user.id}:${newTrustToken}`, 30 * 24 * 60 * 60, '1');
    }

    // Record login session
    const detected = await detectLocation(req, parsed.detectedLocation, parsed.latitude, parsed.longitude);
    const session = await UserDAL.recordLoginSession({
      userId: user.id,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceName: parsed.deviceInfo || 'Browser Session',
      location: detected.location,
      latitude: detected.latitude || parsed.latitude,
      longitude: detected.longitude || parsed.longitude,
      isTrusted: !!trustDevice,
    });

    const profile = await UserDAL.getProfileByUserId(user.id);
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = generateRefreshToken();
    try {
      const { refreshTokens } = await import('../db/schema');
      const { db: database } = await import('../db');
      await database.insert(refreshTokens).values({
        userId: user.id,
        token: refreshTokenValue,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    } catch (rtErr) {
      console.warn('[Auth] Refresh token save notice:', rtErr);
    }

    res.json({
      token,
      refreshToken: refreshTokenValue,
      trustToken: newTrustToken,
      sessionToken: session?.sessionToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile,
      },
    });
  } catch (err: any) {
    console.error('[Verify 2FA Error]', err);
    res.status(500).json({ error: 'Failed to verify security code' });
  }
});

// 5. Universal Resend OTP (Rate limited: 45s cooldown)
router.post('/resend-otp', authRateLimiter, async (req, res: Response) => {
  try {
    const { type, email, tempToken } = req.body;
    const { redis } = await import('../db/redis');

    if (type === 'signup') {
      if (!email) return res.status(400).json({ error: 'Email is required' });
      const cleanEmail = String(email).toLowerCase().trim();

      const cooldown = await redis.get(`otp_rate:${cleanEmail}`);
      if (cooldown) {
        return res.status(429).json({ error: 'Please wait before requesting another code.' });
      }

      const rawData = await redis.get(`pending_signup:${cleanEmail}`);
      if (!rawData) {
        return res.status(400).json({ error: 'No pending registration session found. Please fill out the sign up form again.' });
      }

      const pending = JSON.parse(rawData);
      const newOtp = crypto.randomInt(100000, 999999).toString();
      pending.otp = newOtp;
      await redis.setex(`pending_signup:${cleanEmail}`, 600, JSON.stringify(pending));
      await redis.setex(`otp_rate:${cleanEmail}`, 45, '1');

      await sendOtpEmail(cleanEmail, newOtp, 'signup');
      console.log(`✉️ [Resend Signup OTP] Sent code ${newOtp} to ${cleanEmail}`);
      return res.json({ success: true, message: 'New confirmation code sent to your email!' });
    }

    if (type === 'login') {
      if (!tempToken) return res.status(400).json({ error: 'Session token required' });

      const rawData = await redis.get(`login_2fa:${tempToken}`);
      if (!rawData) {
        return res.status(400).json({ error: 'Session expired. Please log in again.' });
      }

      const parsed = JSON.parse(rawData);
      const cooldown = await redis.get(`otp_rate:${parsed.email}`);
      if (cooldown) {
        return res.status(429).json({ error: 'Please wait before requesting another code.' });
      }

      const newOtp = crypto.randomInt(100000, 999999).toString();
      parsed.otp = newOtp;
      await redis.setex(`login_2fa:${tempToken}`, 300, JSON.stringify(parsed));
      await redis.setex(`otp_rate:${parsed.email}`, 45, '1');

      await sendOtpEmail(parsed.email, newOtp, 'login');
      console.log(`🛡️ [Resend Login 2FA OTP] Sent code ${newOtp} to ${parsed.email}`);
      return res.json({ success: true, message: 'New security code sent to your email!' });
    }

    res.status(400).json({ error: 'Invalid verification type' });
  } catch (err: any) {
    console.error('[Resend OTP Error]', err);
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

// Me (Get current logged in user & profile)
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await UserDAL.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = await UserDAL.getProfileByUserId(user.id);
    let socialFollowing: string[] = [];
    let socialFollowers: string[] = [];
    try {
      socialFollowing = await UserDAL.getFollowingIds(user.id);
      socialFollowers = await UserDAL.getFollowerIds(user.id);
    } catch {}

    const enrichedProfile = profile ? {
      ...profile,
      social: {
        ...(profile.socialLinks as any || {}),
        following: socialFollowing,
        followers: socialFollowers,
      }
    } : profile;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: enrichedProfile,
      },
    });
  } catch (err) {
    console.error('[Me Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh / Exchange session for canonical JWT
router.post('/refresh', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = generateAccessToken({
      userId: req.user!.userId,
      email: req.user!.email,
      role: req.user!.role,
    });
    const profile = await UserDAL.getProfileByUserId(req.user!.userId);
    res.json({
      token,
      user: {
        id: req.user!.userId,
        email: req.user!.email,
        role: req.user!.role,
        profile,
      },
    });
  } catch (err: any) {
    console.error('[Refresh Error]', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Forgot Password: emails a single-use, 30-minute reset link. The token is NEVER returned in the API response.
router.post('/forgot-password', passwordResetRateLimiter, async (req, res: Response) => {
  const generic = { success: true, message: 'If an account exists, a reset link has been sent.' };
  try {
    const rawIdentifier = String(req.body?.email || req.body?.identifier || req.body?.username || '').trim();
    if (!rawIdentifier) return res.status(400).json({ error: 'Email or username is required' });

    const user = await UserDAL.findByEmailOrUsername(rawIdentifier);
    if (!user || !user.email || user.isBanned || user.status === 'BANNED' || user.status === 'DELETED') {
      return res.json(generic); // never reveal whether an account exists
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const { redis } = await import('../db/redis');
    await redis.setex(`reset_pwd:${tokenHash}`, 1800, user.id); // only the hash is stored

    const base = (process.env.APP_BASE_URL || 'https://aeirmist.com').replace(/\/+$/, '');
    const link = `${base}/?mode=resetPassword&resetToken=${rawToken}`;

    const sent = await sendPasswordResetEmail(user.email, link);
    if (!sent && !isMailConfigured()) {
      // Owner-only fallback while SMTP is not configured: visible in the server console, never in the response.
      console.warn(`[Password Reset] SMTP is not configured. Manual reset link for ${user.email}: ${link}`);
    }
    return res.json(generic);
  } catch (err) {
    console.error('[Forgot Password Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset Password with the emailed token (single use)
router.post('/reset-password', passwordResetRateLimiter, async (req, res: Response) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || typeof token !== 'string' || !newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'Valid token and new password (min 8 characters) required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { redis } = await import('../db/redis');
    const userId = await redis.get(`reset_pwd:${tokenHash}`);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    await redis.del(`reset_pwd:${tokenHash}`); // single use, consume before doing the update

    const passwordHash = await hashPassword(newPassword);
    const { db } = await import('../db');
    const { users } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    await db.update(users).set({
      passwordHash,
      passwordAlgorithm: 'bcrypt',
      passwordSalt: null,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    res.json({ success: true, message: 'Password has been updated successfully.' });
  } catch (err) {
    console.error('[Reset Password Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change Password for Authenticated User
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await UserDAL.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const isValid = await comparePassword(
        currentPassword,
        user.passwordHash,
        user.passwordAlgorithm,
        user.passwordSalt
      );
      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    const newHash = await hashPassword(newPassword);
    await UserDAL.updatePassword(user.id, newHash, 'bcrypt');
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('[Change Password Error]', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Change Email for Authenticated User
router.post('/change-email', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newEmail, currentPassword } = req.body;
    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid email address required' });
    }

    const user = await UserDAL.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if new email is already taken
    const existing = await UserDAL.findByEmail(newEmail);
    if (existing && existing.id !== user.id) {
      return res.status(400).json({ error: 'This email is already in use by another account' });
    }

    if (user.passwordHash && currentPassword) {
      const isValid = await comparePassword(
        currentPassword,
        user.passwordHash,
        user.passwordAlgorithm,
        user.passwordSalt
      );
      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    await UserDAL.updateEmail(user.id, newEmail);
    res.json({ success: true, message: 'Email address updated successfully' });
  } catch (err) {
    console.error('[Change Email Error]', err);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// Exchange Refresh Token for new Access Token
router.post('/token', async (req, res: Response) => {
  try {
    const { refreshToken: rt } = req.body;
    if (!rt) return res.status(400).json({ error: 'Refresh token required' });

    const { refreshTokens } = await import('../db/schema');
    const { db: database } = await import('../db');
    const { eq, gt, and } = await import('drizzle-orm');

    const [found] = await database.select().from(refreshTokens)
      .where(and(eq(refreshTokens.token, rt), gt(refreshTokens.expiresAt, new Date())))
      .limit(1);

    if (!found) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await UserDAL.findById(found.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Rotate: delete old, issue new refresh token
    await database.delete(refreshTokens).where(eq(refreshTokens.id, found.id));
    const newRefreshToken = generateRefreshToken();
    await database.insert(refreshTokens).values({
      userId: user.id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('[Token Exchange Error]', err);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// ---------------- 12. Active Sessions Management (Meta-style) ----------------
router.get('/sessions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const clientSessionToken = (req.headers['x-session-token'] as string) || (req.query.sessionToken as string);
    const sessions = await UserDAL.getActiveLoginSessions(userId);

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress;

    let matchedCurrent = false;
    const enrichedSessions = sessions.map((s) => {
      let isCurrent = false;
      if (clientSessionToken && s.sessionToken && s.sessionToken === clientSessionToken) {
        isCurrent = true;
        matchedCurrent = true;
      }

      // Clean up legacy deviceName if it contains '•'
      const cleanDeviceName = s.model 
        ? `${s.model}${s.browser ? ' · ' + s.browser : ''}`
        : (s.deviceName?.split('•')[0]?.trim() || 'Device');

      return {
        ...s,
        deviceName: cleanDeviceName,
        model: s.model || cleanDeviceName,
        location: s.location || 'Location unavailable',
        isCurrent,
      };
    });

    if (!matchedCurrent && enrichedSessions.length > 0) {
      const idx = enrichedSessions.findIndex(s => s.ipAddress && s.ipAddress === clientIp);
      if (idx >= 0) {
        enrichedSessions[idx].isCurrent = true;
      } else {
        enrichedSessions[0].isCurrent = true;
      }
    }

    const unrecognizedCount = enrichedSessions.filter(s => s.isTrusted === false).length;

    res.json({
      sessions: enrichedSessions,
      unrecognizedCount,
    });
  } catch (err) {
    console.error('[Get Sessions Error]', err);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

router.patch('/sessions/current-location', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { location, latitude, longitude } = req.body;
    const clientSessionToken = (req.headers['x-session-token'] as string) || (req.body?.sessionToken as string);

    const detected = await detectLocation(req, location, latitude, longitude);

    const { loginSessions } = await import('../db/schema');
    const { db: database } = await import('../db');
    const { eq, and, desc } = await import('drizzle-orm');

    let targetSessionId: string | null = null;
    if (clientSessionToken) {
      const [found] = await database
        .select({ id: loginSessions.id })
        .from(loginSessions)
        .where(and(eq(loginSessions.userId, userId), eq(loginSessions.sessionToken, clientSessionToken)))
        .limit(1);
      if (found) targetSessionId = found.id;
    }

    if (!targetSessionId) {
      const [recent] = await database
        .select({ id: loginSessions.id })
        .from(loginSessions)
        .where(and(eq(loginSessions.userId, userId), eq(loginSessions.isRevoked, false)))
        .orderBy(desc(loginSessions.lastActiveAt))
        .limit(1);
      if (recent) targetSessionId = recent.id;
    }

    if (targetSessionId) {
      await database
        .update(loginSessions)
        .set({
          location: detected.location,
          latitude: detected.latitude,
          longitude: detected.longitude,
          lastActiveAt: new Date(),
        })
        .where(eq(loginSessions.id, targetSessionId));

      if (detected.location && detected.location !== 'Location unavailable') {
        await UserDAL.updateProfile(userId, { location: detected.location });
      }

      return res.json({ success: true, location: detected.location });
    }

    res.json({ success: false, message: 'No active session found' });
  } catch (err) {
    console.error('[Update Session Location Error]', err);
    res.status(500).json({ error: 'Failed to update session location' });
  }
});

router.delete('/sessions/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const sessionId = req.params.id;
    const success = await UserDAL.revokeLoginSession(userId, sessionId);
    if (!success) {
      return res.status(404).json({ error: 'Session not found or already revoked' });
    }
    res.json({ success: true, message: 'Session logged out successfully' });
  } catch (err) {
    console.error('[Revoke Session Error]', err);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

router.post('/sessions/logout-others', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const clientSessionToken = (req.headers['x-session-token'] as string) || req.body?.currentSessionToken;
    const { currentSessionId } = req.body || {};
    const revokedCount = await UserDAL.revokeOtherLoginSessions(userId, currentSessionId, clientSessionToken);

    res.json({ success: true, revokedCount, message: `Logged out of ${revokedCount} other device(s)` });
  } catch (err) {
    console.error('[Logout Others Error]', err);
    res.status(500).json({ error: 'Failed to log out of other devices' });
  }
});

// Standard Logout Endpoint
router.post('/logout', async (req, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const { refreshToken: rt } = req.body || {};

    if (rt) {
      try {
        const { refreshTokens } = await import('../db/schema');
        const { db: database } = await import('../db');
        const { eq } = await import('drizzle-orm');
        await database.delete(refreshTokens).where(eq(refreshTokens.token, rt));
      } catch {}
    }

    if (token) {
      try {
        const resolved = await resolveUserFromCredentials(token);
        if (resolved?.userId) {
          const { redis } = await import('../db/redis');
          await redis.srem('online_users', resolved.userId);
          await redis.del(`session:${resolved.userId}`);
        }
      } catch {}
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('[Logout Error]', err);
    res.json({ success: true });
  }
});

export default router;
