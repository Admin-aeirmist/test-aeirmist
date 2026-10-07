import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db } from '../db';
import { marketplaceItems, profiles, users } from '../db/schema';

export class MarketplaceDAL {
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
}
