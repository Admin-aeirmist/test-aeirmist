import { eq, and, sql, desc } from 'drizzle-orm';
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

  static async findByEmailOrUsername(identifier: string) {
    const clean = identifier.trim().toLowerCase().replace(/^@+/, '');
    if (clean.includes('@')) {
      return this.findByEmail(clean);
    }
    const profile = await this.getProfileByUsername(clean);
    if (profile && profile.userId) {
      return this.findById(profile.userId);
    }
    return this.findByEmail(clean);
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

  static async getProfileById(profileId: string) {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    return profile || null;
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

  static async getProfileByIdentifier(identifier: string) {
    const clean = identifier.trim().replace(/^@+/, '');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    if (isUuid) {
      const byUser = await this.getProfileByUserId(clean);
      if (byUser) return byUser;
      const byProfile = await this.getProfileById(clean);
      if (byProfile) return byProfile;
    }
    const byUsername = await this.getProfileByUsername(clean);
    if (byUsername) return byUsername;
    const byFb = await this.findByFirebaseUid(clean);
    if (byFb) {
      return this.getProfileByUserId(byFb.id);
    }
    return null;
  }

  static async updateProfile(userId: string, updates: Partial<typeof profiles.$inferInsert>) {
    const [updated] = await db
      .update(profiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
      .returning();
    return updated || null;
  }

  static async incrementPoints(userId: string, points: number) {
    const [updated] = await db
      .update(profiles)
      .set({
        points: sql`${profiles.points} + ${points}`,
        updatedAt: new Date(),
      })
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

  static async searchUsers(queryText: string, limit = 20) {
    const clean = queryText.trim().replace(/^@+/, '');
    if (!clean) {
      return this.getSuggestedUsers(undefined, limit);
    }

    const searchPattern = `%${clean.toLowerCase()}%`;
    return db
      .select({
        id: users.id,
        email: users.email,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
        bio: profiles.bio,
        isVerified: profiles.isVerified,
        followersCount: profiles.followersCount,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(
        and(
          eq(users.status, 'ACTIVE'),
          eq(users.isBanned, false),
          sql`(LOWER(${profiles.username}) LIKE ${searchPattern} OR LOWER(${profiles.displayName}) LIKE ${searchPattern})`
        )
      )
      .limit(limit);
  }

  static async getSuggestedUsers(currentUserId?: string, limit = 20) {
    return db
      .select({
        id: users.id,
        email: users.email,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
        bio: profiles.bio,
        isVerified: profiles.isVerified,
        followersCount: profiles.followersCount,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(
        and(
          eq(users.status, 'ACTIVE'),
          eq(users.isBanned, false),
          currentUserId ? sql`${users.id} != ${currentUserId}` : sql`1=1`
        )
      )
      .orderBy(desc(profiles.followersCount), desc(profiles.createdAt))
      .limit(limit);
  }

  static async updateEmail(userId: string, newEmail: string) {
    const [user] = await db
      .update(users)
      .set({ email: newEmail.toLowerCase().trim(), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user || null;
  }

  static async deactivateAccount(userId: string) {
    const [user] = await db
      .update(users)
      .set({ status: 'DELETED', updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return !!user;
  }
}
