import { Router, Response } from 'express';
import { z } from 'zod';
import { VaultDAL } from '../dal/vault.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const AddVaultItemSchema = z.object({
  type: z.enum(['photo', 'video', 'note', 'document']),
  title: z.string().max(255).optional(),
  content: z.string().optional(),
  mediaKey: z.string().optional(),
  mediaUrl: z.string().optional(),
  folder: z.string().max(64).default('General'),
  isEncrypted: z.boolean().default(true),
});

const SaveVaultConfigSchema = z.object({
  passcodeType: z.enum(['pin6', 'pin8', 'password']).default('pin6'),
  passcodeHash: z.string().min(1),
  questionIds: z.array(z.number()).default([]),
  answersHashes: z.array(z.string()).default([]),
  biometricEnabled: z.boolean().optional(),
  autoLockDuration: z.string().optional(),
  silentNotifications: z.boolean().optional(),
});

const UpdateVaultSettingsSchema = z.object({
  autoLockDuration: z.string().optional(),
  silentNotifications: z.boolean().optional(),
  biometricEnabled: z.boolean().optional(),
});

// Get user vault config
router.get('/config', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await VaultDAL.getConfig(req.user!.userId);
    res.json({ config });
  } catch (err) {
    console.error('[Vault Get Config Error]', err);
    res.status(500).json({ error: 'Failed to fetch vault config' });
  }
});

// Save user vault config
router.post('/config', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = SaveVaultConfigSchema.parse(req.body);
    const config = await VaultDAL.saveConfig({
      userId: req.user!.userId,
      ...data,
    });
    res.status(200).json({ config });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Vault Save Config Error]', err);
    res.status(500).json({ error: 'Failed to save vault config' });
  }
});

// Update vault settings
router.patch('/settings', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = UpdateVaultSettingsSchema.parse(req.body);
    const config = await VaultDAL.updateSettings(req.user!.userId, data);
    res.json({ config });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Vault Settings Update Error]', err);
    res.status(500).json({ error: 'Failed to update vault settings' });
  }
});

// Get user vault items
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folder = req.query.folder as string | undefined;
    const items = await VaultDAL.getItems(req.user!.userId, folder);
    res.json({ items });
  } catch (err) {
    console.error('[Vault List Error]', err);
    res.status(500).json({ error: 'Failed to fetch vault items' });
  }
});

// Add vault item
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = AddVaultItemSchema.parse(req.body);
    const item = await VaultDAL.addItem({
      userId: req.user!.userId,
      ...data,
    });
    res.status(201).json({ item });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Vault Add Error]', err);
    res.status(500).json({ error: 'Failed to add item to vault' });
  }
});

// Delete vault item
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await VaultDAL.deleteItem(req.params.id, req.user!.userId);
    if (!success) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Vault Delete Error]', err);
    res.status(500).json({ error: 'Failed to delete vault item' });
  }
});

export default router;
