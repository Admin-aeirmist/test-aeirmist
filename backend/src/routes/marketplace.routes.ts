import { Router, Response } from 'express';
import { z } from 'zod';
import { MarketplaceDAL } from '../dal/marketplace.dal';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const CreateItemSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().min(5).max(5000),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().default('BDT'),
  category: z.string().min(1).max(64),
  condition: z.enum(['new', 'like_new', 'used', 'refurbished']).default('used'),
  mediaKeys: z.array(z.string()).optional(),
  location: z.string().optional(),
});

const CreateStoreSchema = z.object({
  name: z.string().min(2).max(128),
  handle: z.string().min(2).max(64),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  category: z.string().max(64).optional(),
  location: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

const CreateOrderSchema = z.object({
  storeId: z.string().optional(),
  items: z.array(z.any()).min(1),
  totalAmount: z.string(),
  currency: z.string().default('BDT'),
  shippingAddress: z.any(),
  paymentMethod: z.string().default('cod'),
});

// ---------------- Items ----------------
// List items
router.get('/items', async (req, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const items = await MarketplaceDAL.getItems(category, limit, offset);
    res.json({ items });
  } catch (err) {
    console.error('[Marketplace List Error]', err);
    res.status(500).json({ error: 'Failed to fetch marketplace items' });
  }
});

// Create item
router.post('/items', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreateItemSchema.parse(req.body);
    const item = await MarketplaceDAL.createItem({
      sellerId: req.user!.userId,
      ...data,
    });
    res.status(201).json({ item });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Marketplace Create Error]', err);
    res.status(500).json({ error: 'Failed to create marketplace item' });
  }
});

// Get single item
router.get('/items/:id', async (req, res: Response) => {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id);
    if (!isUuid) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const item = await MarketplaceDAL.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ item });
  } catch (err) {
    console.error('[Marketplace Item Error]', err);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Update status
router.patch('/items/:id/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['active', 'sold', 'hidden'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const item = await MarketplaceDAL.updateStatus(req.params.id, req.user!.userId, status);
    if (!item) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }
    res.json({ item });
  } catch (err) {
    console.error('[Marketplace Status Error]', err);
    res.status(500).json({ error: 'Failed to update item status' });
  }
});

// Delete item
router.delete('/items/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = ['admin', 'super_admin', 'owner'].includes(req.user!.role);
    const success = await MarketplaceDAL.deleteItem(req.params.id, req.user!.userId, isAdmin);
    if (!success) {
      return res.status(403).json({ error: 'Unauthorized or item not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Marketplace Delete Error]', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ---------------- Stores ----------------
// Create store
router.post('/stores', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreateStoreSchema.parse(req.body);
    const existing = await MarketplaceDAL.getStoreByHandle(data.handle);
    if (existing) {
      return res.status(409).json({ error: 'Store handle already taken' });
    }

    const store = await MarketplaceDAL.createStore({
      ownerId: req.user!.userId,
      ...data,
    });
    res.status(201).json({ store });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Store Create Error]', err);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

// List stores
router.get('/stores', async (req, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const stores = await MarketplaceDAL.getStores(limit, offset);
    res.json({ stores });
  } catch (err) {
    console.error('[Marketplace Stores Error]', err);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// Get store by handle
router.get('/stores/:handle', async (req, res: Response) => {
  try {
    const store = await MarketplaceDAL.getStoreByHandle(req.params.handle);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    res.json({ store });
  } catch (err) {
    console.error('[Store Fetch Error]', err);
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

// Get my store
router.get('/my-store', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const store = await MarketplaceDAL.getStoreByOwner(req.user!.userId);
    res.json({ store });
  } catch (err) {
    console.error('[My Store Fetch Error]', err);
    res.status(500).json({ error: 'Failed to fetch my store' });
  }
});

// ---------------- Orders ----------------
// Create order / checkout
router.post('/orders', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreateOrderSchema.parse(req.body);
    const order = await MarketplaceDAL.createOrder({
      buyerId: req.user!.userId,
      ...data,
    });
    res.status(201).json({ order });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Order Create Error]', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get buyer orders
router.get('/orders/my', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await MarketplaceDAL.getUserOrders(req.user!.userId);
    res.json({ orders });
  } catch (err) {
    console.error('[User Orders Error]', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

export default router;
