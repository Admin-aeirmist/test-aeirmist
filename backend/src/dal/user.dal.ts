import { eq, and, sql, desc, or, like } from 'drizzle-orm';
import { db } from '../db';
import { users, profiles, follows, blocks, loginSessions, mediaAssets } from '../db/schema';
import { storage } from '../storage';

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
    if (!id || typeof id !== 'string') return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) return null;
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return user || null;
    } catch {
      return null;
    }
  }

  static async findByFirebaseUid(firebaseUid: string) {
    if (!firebaseUid || typeof firebaseUid !== 'string') return null;
    const cleanUid = firebaseUid.replace(/_\d{10,14}$/, '').replace(/^profile_/, '');
    const [user] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.firebaseUid, firebaseUid),
          eq(users.firebaseUid, cleanUid),
          like(users.firebaseUid, `${cleanUid}_%`)
        )
      )
      .limit(1);
    return user || null;
  }

  static async findProfileById(profileId: string) {
    if (!profileId || typeof profileId !== 'string') return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId);
    if (!isUuid) return null;
    try {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, profileId))
        .limit(1);
      return profile || null;
    } catch {
      return null;
    }
  }

  static async resolveToUserId(rawId: string): Promise<string | null> {
    if (!rawId || typeof rawId !== 'string') return null;
    let cleanId = rawId.startsWith('profile_') ? rawId.replace(/^profile_/, '') : rawId;
    cleanId = cleanId.replace(/_\d{10,14}$/, ''); // Strip trailing Unix timestamp if present
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    if (isUuid) {
      const u = await this.findById(cleanId);
      if (u) return u.id;
      const p = await this.findProfileById(cleanId);
      if (p) return p.userId;
      return cleanId;
    }
    const user = await this.findByEmailOrUsername(cleanId) ||
                 await this.findByFirebaseUid(cleanId) ||
                 await this.findByEmailOrUsername(rawId) ||
                 await this.findByFirebaseUid(rawId);
    if (user?.id) return user.id;

    // Check if cleanId or rawId matches a profile username or id directly
    const p = (await this.getProfileByUsername(cleanId)) || (await this.getProfileByUsername(rawId));
    if (p?.userId) return p.userId;

    return null;
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
    location?: string;
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
        location: data.location || null,
      })
      .returning();
    return newProfile;
  }

  static async recordLoginSession(data: {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceName?: string | null;
    location?: string | null;
  }) {
    try {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const refreshTokenHash = crypto.randomUUID();
      const deviceStr = data.location 
        ? `${data.deviceName || 'Device'} • ${data.location}`.slice(0, 100)
        : (data.deviceName || 'Device').slice(0, 100);

      const [session] = await db
        .insert(loginSessions)
        .values({
          userId: data.userId,
          refreshTokenHash,
          ipAddress: data.ipAddress ? data.ipAddress.slice(0, 45) : null,
          userAgent: data.userAgent || null,
          deviceName: deviceStr,
          expiresAt,
          lastActiveAt: new Date(),
          createdAt: new Date(),
        })
        .returning();
      return session;
    } catch (err) {
      console.warn('[UserDAL] recordLoginSession warning:', err);
      return null;
    }
  }

  static async getProfileById(profileId: string) {
    if (!profileId || typeof profileId !== 'string') return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId);
    if (!isUuid) return null;
    try {
      const [profile] = await db
        .select({
          id: profiles.id,
          userId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          bio: profiles.bio,
          avatarKey: profiles.avatarKey,
          bannerKey: profiles.bannerKey,
          website: profiles.website,
          location: profiles.location,
          isVerified: profiles.isVerified,
          badge: profiles.badge,
          creatorTier: profiles.creatorTier,
          points: profiles.points,
          followersCount: profiles.followersCount,
          followingCount: profiles.followingCount,
          postsCount: profiles.postsCount,
          socialLinks: profiles.socialLinks,
          privacySettings: profiles.privacySettings,
          createdAt: profiles.createdAt,
          updatedAt: profiles.updatedAt,
          firebaseUid: users.firebaseUid,
          email: users.email,
        })
        .from(profiles)
        .leftJoin(users, eq(profiles.userId, users.id))
        .where(eq(profiles.id, profileId))
        .limit(1);
      return profile || null;
    } catch {
      return null;
    }
  }

  static async getProfileByUserId(userId: string) {
    if (!userId || typeof userId !== 'string') return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (!isUuid) return null;
    try {
      const [profile] = await db
        .select({
          id: profiles.id,
          userId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          bio: profiles.bio,
          avatarKey: profiles.avatarKey,
          bannerKey: profiles.bannerKey,
          website: profiles.website,
          location: profiles.location,
          isVerified: profiles.isVerified,
          badge: profiles.badge,
          creatorTier: profiles.creatorTier,
          points: profiles.points,
          followersCount: profiles.followersCount,
          followingCount: profiles.followingCount,
          postsCount: profiles.postsCount,
          socialLinks: profiles.socialLinks,
          privacySettings: profiles.privacySettings,
          createdAt: profiles.createdAt,
          updatedAt: profiles.updatedAt,
          firebaseUid: users.firebaseUid,
          email: users.email,
        })
        .from(profiles)
        .leftJoin(users, eq(profiles.userId, users.id))
        .where(eq(profiles.userId, userId))
        .limit(1);
      return profile || null;
    } catch {
      return null;
    }
  }

  static async getProfileByUsername(username: string) {
    try {
      const [profile] = await db
        .select({
          id: profiles.id,
          userId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          bio: profiles.bio,
          avatarKey: profiles.avatarKey,
          bannerKey: profiles.bannerKey,
          website: profiles.website,
          location: profiles.location,
          isVerified: profiles.isVerified,
          badge: profiles.badge,
          creatorTier: profiles.creatorTier,
          points: profiles.points,
          followersCount: profiles.followersCount,
          followingCount: profiles.followingCount,
          postsCount: profiles.postsCount,
          socialLinks: profiles.socialLinks,
          privacySettings: profiles.privacySettings,
          createdAt: profiles.createdAt,
          updatedAt: profiles.updatedAt,
          firebaseUid: users.firebaseUid,
          email: users.email,
        })
        .from(profiles)
        .leftJoin(users, eq(profiles.userId, users.id))
        .where(eq(profiles.username, username.toLowerCase().trim()))
        .limit(1);
      return profile || null;
    } catch {
      return null;
    }
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
        userId: users.id,
        profileId: profiles.id,
        firebaseUid: users.firebaseUid,
        email: users.email,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
        bannerKey: profiles.bannerKey,
        bio: profiles.bio,
        location: profiles.location,
        isVerified: profiles.isVerified,
        followersCount: profiles.followersCount,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(
        and(
          eq(users.status, 'ACTIVE'),
          eq(users.isBanned, false),
          sql`(LOWER(${profiles.username}) LIKE ${searchPattern} OR LOWER(${profiles.displayName}) LIKE ${searchPattern} OR LOWER(${users.email}) LIKE ${searchPattern} OR LOWER(COALESCE(${users.firebaseUid}, '')) LIKE ${searchPattern})`
        )
      )
      .limit(limit);
  }

  static async getSuggestedUsers(currentUserId?: string, limit = 20) {
    return db
      .select({
        id: users.id,
        userId: users.id,
        profileId: profiles.id,
        firebaseUid: users.firebaseUid,
        email: users.email,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
        bannerKey: profiles.bannerKey,
        bio: profiles.bio,
        location: profiles.location,
        isVerified: profiles.isVerified,
        followersCount: profiles.followersCount,
        createdAt: profiles.createdAt,
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

  static async purgeUser(userId: string) {
    // 1. Delete all physical storage assets owned by the user
    const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.ownerId, userId));
    for (const a of assets) {
      try {
        await storage.delete(a.key);
      } catch (storageErr) {
        console.warn(`[UserDAL.purgeUser] Storage delete warning for ${a.key}:`, storageErr);
      }
    }

    // 2. Delete media asset DB rows
    await db.delete(mediaAssets).where(eq(mediaAssets.ownerId, userId));

    // 3. Delete from users table (cascades to all other PostgreSQL tables)
    const [deleted] = await db.delete(users).where(eq(users.id, userId)).returning();
    return !!deleted;
  }
}
