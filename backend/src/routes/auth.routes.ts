import { Router, Response } from 'express';
import { z } from 'zod';
import { UserDAL } from '../dal/user.dal';
import { hashPassword, comparePassword, generateAccessToken } from '../lib/auth';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(100),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Register
router.post('/register', async (req, res: Response) => {
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

    const profile = await UserDAL.createProfile({
      userId: user.id,
      username: data.username,
      displayName: data.displayName,
    });

    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      token,
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

// Login (Supports Bcrypt & Firebase Scrypt Auto-upgrade)
router.post('/login', async (req, res: Response) => {
  try {
    const data = LoginSchema.parse(req.body);

    const user = await UserDAL.findByEmail(data.email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.isBanned || user.status === 'BANNED' || user.status === 'DELETED') {
      return res.status(403).json({ error: 'Account is suspended or deactivated' });
    }

    const isValid = await comparePassword(
      data.password,
      user.passwordHash,
      user.passwordAlgorithm,
      user.passwordSalt
    );

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Seamless migration: If authenticated via legacy Firebase scrypt, upgrade immediately to bcrypt!
    if (user.passwordAlgorithm === 'firebase_scrypt') {
      const newBcryptHash = await hashPassword(data.password);
      await UserDAL.updatePassword(user.id, newBcryptHash, 'bcrypt');
      console.log(`🔑 [Auto-Upgrade] User ${user.email} password upgraded from Firebase Scrypt to Bcrypt`);
    }

    const profile = await UserDAL.getProfileByUserId(user.id);
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
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

// Me (Get current logged in user & profile)
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await UserDAL.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = await UserDAL.getProfileByUserId(user.id);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile,
      },
    });
  } catch (err) {
    console.error('[Me Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
