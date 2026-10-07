import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { users, profiles, follows, blocks, loginSessions } from '../db/schema';

export class UserDAL {
  static async findByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    return user || null;
  }

  static async findById(id: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user || null;
  }

  static async findByFirebaseUid(firebaseUid: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);
    return user || null;
  }

  static async createUser(data: {
    email: string;
    passwordHash?: string;
    passwordSalt?: string;
    passwordAlgorithm?: string;
    firebaseUid?: string;
    role?: string;
  }) {
    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        passwordSalt: data.passwordSalt,
        passwordAlgorithm: data.passwordAlgorithm || 'bcrypt',
        firebaseUid: data.firebaseUid,
        role: data.role || 'user',
      })
      .returning();
    return newUser;
  }

  static async updatePassword(id: string, passwordHash: string, algorithm: string = 'bcrypt') {
    return db
      .update(users)
      .set({
        passwordHash,
        passwordAlgorithm: algorithm,
        passwordSalt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  static async createProfile(data: {
    userId: string;
    username: string;
    displayName: string;
    bio?: string;
    avatarKey?: string;
    bannerKey?: string;
  }) {
    const [newProfile] = await db
      .insert(profiles)
      .values({
        userId: data.userId,
        username: data.username.toLowerCase().trim(),
        displayName: data.displayName,
        bio: data.bio,
        avatarKey: data.avatarKey,
        bannerKey: data.bannerKey,
      })
      .returning();
    return newProfile;
  }

  static async getProfileByUserId(userId: string) {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    return profile || null;
  }

  static async getProfileByUsername(username: string) {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.username, username.toLowerCase().trim()))
      .limit(1);
    return profile || null;
  }

  static async updateProfile(userId: string, updates: Partial<typeof profiles.$inferInsert>) {
    const [updated] = await db
      .update(profiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
      .returning();
    return updated || null;
  }

  static async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) return null;
    const [follow] = await db
      .insert(follows)
      .values({ followerId, followingId })
      .onConflictDoNothing()
      .returning();

    if (follow) {
      await Promise.all([
        db.update(profiles).set({ followingCount: sql`${profiles.followingCount} + 1` }).where(eq(profiles.userId, followerId)),
        db.update(profiles).set({ followersCount: sql`${profiles.followersCount} + 1` }).where(eq(profiles.userId, followingId)),
      ]);
    }
    return follow || null;
  }

  static async unfollowUser(followerId: string, followingId: string) {
    const [removed] = await db
      .delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
      .returning();

    if (removed) {
      await Promise.all([
        db.update(profiles).set({ followingCount: sql`GREATEST(0, ${profiles.followingCount} - 1)` }).where(eq(profiles.userId, followerId)),
        db.update(profiles).set({ followersCount: sql`GREATEST(0, ${profiles.followersCount} - 1)` }).where(eq(profiles.userId, followingId)),
      ]);
    }
    return !!removed;
  }

  static async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [res] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
      .limit(1);
    return !!res;
  }
}
