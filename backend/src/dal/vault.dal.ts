import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { vaultItems, vaultConfigs } from '../db/schema';

export class VaultDAL {
  static async getConfig(userId: string) {
    const [config] = await db
      .select()
      .from(vaultConfigs)
      .where(eq(vaultConfigs.userId, userId))
      .limit(1);
    return config || null;
  }

  static async saveConfig(data: {
    userId: string;
    passcodeType: string;
    passcodeHash: string;
    questionIds: number[];
    answersHashes: string[];
    biometricEnabled?: boolean;
    autoLockDuration?: string;
    silentNotifications?: boolean;
  }) {
    const [saved] = await db
      .insert(vaultConfigs)
      .values({
        userId: data.userId,
        passcodeType: data.passcodeType,
        passcodeHash: data.passcodeHash,
        questionIds: data.questionIds,
        answersHashes: data.answersHashes,
        biometricEnabled: data.biometricEnabled ?? false,
        autoLockDuration: data.autoLockDuration || '300',
        silentNotifications: data.silentNotifications ?? false,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: vaultConfigs.userId,
        set: {
          passcodeType: data.passcodeType,
          passcodeHash: data.passcodeHash,
          questionIds: data.questionIds,
          answersHashes: data.answersHashes,
          biometricEnabled: data.biometricEnabled ?? false,
          autoLockDuration: data.autoLockDuration || '300',
          silentNotifications: data.silentNotifications ?? false,
          updatedAt: new Date(),
        },
      })
      .returning();

    return saved;
  }

  static async updateSettings(
    userId: string,
    data: {
      autoLockDuration?: string;
      silentNotifications?: boolean;
      biometricEnabled?: boolean;
    }
  ) {
    const [updated] = await db
      .update(vaultConfigs)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(vaultConfigs.userId, userId))
      .returning();
    return updated || null;
  }

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
