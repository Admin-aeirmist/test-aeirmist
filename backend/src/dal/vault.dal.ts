import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { vaultItems } from '../db/schema';

export class VaultDAL {
  static async getItems(userId: string, folder?: string) {
    let query = db
      .select()
      .from(vaultItems)
      .where(folder ? and(eq(vaultItems.userId, userId), eq(vaultItems.folder, folder)) : eq(vaultItems.userId, userId))
      .orderBy(desc(vaultItems.createdAt));

    return await query;
  }

  static async addItem(data: {
    userId: string;
    type: string;
    title?: string;
    content?: string;
    mediaKey?: string;
    mediaUrl?: string;
    folder?: string;
    isEncrypted?: boolean;
  }) {
    const [item] = await db
      .insert(vaultItems)
      .values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        content: data.content,
        mediaKey: data.mediaKey,
        mediaUrl: data.mediaUrl,
        folder: data.folder || 'General',
        isEncrypted: data.isEncrypted ?? true,
      })
      .returning();

    return item;
  }

  static async deleteItem(itemId: string, userId: string) {
    const [deleted] = await db
      .delete(vaultItems)
      .where(and(eq(vaultItems.id, itemId), eq(vaultItems.userId, userId)))
      .returning();

    return !!deleted;
  }
}
