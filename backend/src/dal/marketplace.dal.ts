import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db } from '../db';
import { marketplaceItems, marketplaceStores, marketplaceOrders, profiles, users } from '../db/schema';

export class MarketplaceDAL {
  // ---------------- Items ----------------
  static async createItem(data: {
    sellerId: string;
    title: string;
    description: string;
    price: string;
    currency?: string;
    category: string;
    condition?: string;
    mediaKeys?: string[];
    location?: string;
  }) {
    const [item] = await db
      .insert(marketplaceItems)
      .values({
        sellerId: data.sellerId,
        title: data.title,
        description: data.description,
        price: data.price,
        currency: data.currency || 'BDT',
        category: data.category,
        condition: data.condition || 'used',
        mediaKeys: data.mediaKeys || [],
        location: data.location,
      })
      .returning();
    return item;
  }

  static async getItems(category?: string, limit: number = 20, offset: number = 0) {
    const conditions = [
      eq(marketplaceItems.status, 'active'),
      isNull(marketplaceItems.deletedAt),
    ];

    if (category && category !== 'all') {
      conditions.push(eq(marketplaceItems.category, category));
    }

    const rows = await db
      .select({
        item: marketplaceItems,
        seller: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(marketplaceItems)
      .innerJoin(users, eq(marketplaceItems.sellerId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(and(...conditions))
      .orderBy(desc(marketplaceItems.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      ...r.item,
      seller: r.seller,
    }));
  }

  static async getById(id: string) {
    const [row] = await db
      .select({
        item: marketplaceItems,
        seller: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(marketplaceItems)
      .innerJoin(users, eq(marketplaceItems.sellerId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(and(eq(marketplaceItems.id, id), isNull(marketplaceItems.deletedAt)))
      .limit(1);

    if (!row) return null;
    return {
      ...row.item,
      seller: row.seller,
    };
  }

  static async updateStatus(id: string, sellerId: string, status: string) {
    const [updated] = await db
      .update(marketplaceItems)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(marketplaceItems.id, id), eq(marketplaceItems.sellerId, sellerId)))
      .returning();
    return updated || null;
  }

  static async deleteItem(id: string, sellerId: string, isAdmin: boolean = false) {
    const [item] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, id))
      .limit(1);

    if (!item) return false;
    if (item.sellerId !== sellerId && !isAdmin) return false;

    await db
      .update(marketplaceItems)
      .set({ deletedAt: new Date() })
      .where(eq(marketplaceItems.id, id));

    return true;
  }

  // ---------------- Stores ----------------
  static async createStore(data: {
    ownerId: string;
    name: string;
    handle: string;
    description?: string;
    logoUrl?: string;
    bannerUrl?: string;
    category?: string;
    location?: string;
    phone?: string;
    email?: string;
  }) {
    const [store] = await db
      .insert(marketplaceStores)
      .values({
        ownerId: data.ownerId,
        name: data.name,
        handle: data.handle.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        description: data.description,
        logoUrl: data.logoUrl,
        bannerUrl: data.bannerUrl,
        category: data.category || 'General',
        location: data.location,
        phone: data.phone,
        email: data.email,
      })
      .returning();

    return store;
  }

  static async getStores(limit: number = 20, offset: number = 0) {
    return db
      .select()
      .from(marketplaceStores)
      .where(eq(marketplaceStores.status, 'active'))
      .orderBy(desc(marketplaceStores.createdAt))
      .limit(limit)
      .offset(offset);
  }

  static async getStoreByHandle(handle: string) {
    const [store] = await db
      .select()
      .from(marketplaceStores)
      .where(eq(marketplaceStores.handle, handle.toLowerCase()))
      .limit(1);

    return store || null;
  }

  static async getStoreByOwner(ownerId: string) {
    const [store] = await db
      .select()
      .from(marketplaceStores)
      .where(eq(marketplaceStores.ownerId, ownerId))
      .limit(1);

    return store || null;
  }

  static async updateStore(storeId: string, ownerId: string, data: Partial<{
    name: string;
    description: string;
    logoUrl: string;
    bannerUrl: string;
    category: string;
    location: string;
    phone: string;
    email: string;
  }>) {
    const [updated] = await db
      .update(marketplaceStores)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(marketplaceStores.id, storeId), eq(marketplaceStores.ownerId, ownerId)))
      .returning();

    return updated || null;
  }

  // ---------------- Orders ----------------
  static async createOrder(data: {
    buyerId: string;
    storeId?: string;
    items: Array<{ itemId: string; quantity?: number; [key: string]: any }>;
    totalAmount?: string;
    currency?: string;
    shippingAddress?: any;
    paymentMethod?: string;
  }) {
    return await db.transaction(async (tx) => {
      let serverCalculatedTotal = 0;
      const verifiedItems: any[] = [];

      for (const rawItem of data.items) {
        const itemId = rawItem.itemId || rawItem.id;
        if (!itemId || typeof itemId !== 'string') {
          throw new Error('Invalid item ID in order');
        }

        // Lock row FOR UPDATE to prevent concurrency / race conditions
        const lockRes = await tx.execute(sql`
          SELECT * FROM marketplace_items 
          WHERE id = ${itemId} 
          FOR UPDATE
        `);

        if (!lockRes.rows || lockRes.rows.length === 0) {
          throw new Error(`Item ${itemId} not found or no longer available`);
        }

        const lockedItem: any = lockRes.rows[0];

        if (lockedItem.status !== 'active') {
          throw new Error(`Item "${lockedItem.title}" cannot be purchased because its status is "${lockedItem.status}"`);
        }

        if (lockedItem.seller_id === data.buyerId) {
          throw new Error(`You cannot purchase your own item ("${lockedItem.title}")`);
        }

        const qty = Math.max(1, Math.min(100, parseInt(String(rawItem.quantity || '1'), 10) || 1));
        const unitPrice = parseFloat(lockedItem.price) || 0;
        serverCalculatedTotal += unitPrice * qty;

        // Mark item as sold within transaction
        await tx.execute(sql`
          UPDATE marketplace_items 
          SET status = 'sold', updated_at = NOW() 
          WHERE id = ${lockedItem.id}
        `);

        verifiedItems.push({
          itemId: lockedItem.id,
          title: lockedItem.title,
          price: lockedItem.price,
          unitPrice,
          quantity: qty,
          sellerId: lockedItem.seller_id,
          mediaKeys: lockedItem.media_keys,
        });
      }

      const finalTotal = serverCalculatedTotal.toFixed(2);
      if (data.totalAmount) {
        const clientTotal = parseFloat(data.totalAmount);
        if (isNaN(clientTotal) || Math.abs(clientTotal - serverCalculatedTotal) > 0.05) {
          throw new Error('Security alert: Submitted order total does not match verified server item prices');
        }
      }

      const [order] = await tx
        .insert(marketplaceOrders)
        .values({
          buyerId: data.buyerId,
          storeId: data.storeId,
          items: verifiedItems,
          totalAmount: finalTotal,
          currency: data.currency || 'BDT',
          shippingAddress: data.shippingAddress || {},
          paymentMethod: data.paymentMethod || 'cod',
        })
        .returning();

      return order;
    });
  }

  static async getUserOrders(buyerId: string) {
    return await db
      .select()
      .from(marketplaceOrders)
      .where(eq(marketplaceOrders.buyerId, buyerId))
      .orderBy(desc(marketplaceOrders.createdAt));
  }

  static async getStoreOrders(storeId: string) {
    return await db
      .select()
      .from(marketplaceOrders)
      .where(eq(marketplaceOrders.storeId, storeId))
      .orderBy(desc(marketplaceOrders.createdAt));
  }
}
