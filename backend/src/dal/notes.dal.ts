import { eq, desc, gt, and } from 'drizzle-orm';
import { db } from '../db';
import { userNotes, users, profiles } from '../db/schema';

export class NotesDAL {
  static async getActiveNotes() {
    const now = new Date();
    const rows = await db
      .select({
        note: userNotes,
        user: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
        },
      })
      .from(userNotes)
      .innerJoin(users, eq(userNotes.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(gt(userNotes.expiresAt, now))
      .orderBy(desc(userNotes.createdAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.note.id,
      userId: r.note.userId,
      text: r.note.text,
      emoji: r.note.emoji,
      createdAt: r.note.createdAt,
      expiresAt: r.note.expiresAt,
      author: r.user,
    }));
  }

  static async setNote(userId: string, text: string, emoji?: string) {
    // Delete any old note for this user first
    await db.delete(userNotes).where(eq(userNotes.userId, userId));

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const [newNote] = await db
      .insert(userNotes)
      .values({
        userId,
        text,
        emoji: emoji || '💬',
        expiresAt,
      })
      .returning();

    return newNote;
  }

  static async deleteNote(userId: string) {
    await db.delete(userNotes).where(eq(userNotes.userId, userId));
    return true;
  }
}
