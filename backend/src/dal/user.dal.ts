import { eq, and, sql, desc, or, like, gt, ne } from 'drizzle-orm';
import * as crypto from 'crypto';
import { db } from '../db';
import { users, profiles, follows, blocks, loginSessions, mediaAssets } from '../db/schema';
import { storage } from '../storage';
import { fetchFirestoreProfile } from '../lib/firebaseAdmin';
import { parseUserAgent } from '../utils/deviceParser';

export interface FirebaseProvisionData {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
}

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
    const cleanUid = firebaseUid.replace(/^profile_/, '');
    const [user] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.firebaseUid, firebaseUid),
          eq(users.firebaseUid, cleanUid)
        )
      )
      .limit(1);
    return user || null;
  }

  static async autoProvisionFromFirebase(data: FirebaseProvisionData) {
    if (!data.sub || typeof data.sub !== 'string') return null;

    const lockKey = `provision_${data.sub}`;

    return await db.transaction(async (tx) => {
      // 1. Transactional advisory lock serialized per Firebase UID to prevent race conditions
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      // 2. Check if user already exists by firebaseUid
      const [existing] = await tx
        .select()
        .from(users)
        .where(eq(users.firebaseUid, data.sub))
        .limit(1);

      if (existing) {
        if (existing.isBanned || existing.status === 'BANNED' || existing.status === 'DELETED') {
          return null;
        }
        return existing;
      }

      // 3. Check if user exists by email (to link account if previously registered via email)
      const targetEmail = (data.email || `${data.sub}@firebase.aeirmist.social`).toLowerCase().trim();
      const [existingByEmail] = await tx
        .select()
        .from(users)
        .where(eq(users.email, targetEmail))
        .limit(1);

      let user = existingByEmail;

      if (existingByEmail) {
        if (existingByEmail.isBanned || existingByEmail.status === 'BANNED' || existingByEmail.status === 'DELETED') {
          return null;
        }
        if (!existingByEmail.firebaseUid) {
          await tx
            .update(users)
            .set({ firebaseUid: data.sub, emailVerified: true, updatedAt: new Date() })
            .where(eq(users.id, existingByEmail.id));
          user.firebaseUid = data.sub;
        }
      } else {
        // Insert new user row inside transaction with ON CONFLICT DO NOTHING
        const [createdUser] = await tx
          .insert(users)
          .values({
            firebaseUid: data.sub,
            email: targetEmail,
            emailVerified: Boolean(data.emailVerified),
            passwordAlgorithm: 'firebase_scrypt',
            role: 'user', // NEVER allow client or token claims to elevate role
            status: 'ACTIVE',
            isBanned: false,
          })
          .onConflictDoNothing()
          .returning();

        if (createdUser) {
          user = createdUser;
        } else {
          // In case of conflict, re-select
          const [reselected] = await tx
            .select()
            .from(users)
            .where(eq(users.firebaseUid, data.sub))
            .limit(1);
          user = reselected;
        }
      }

      if (!user) return null;

      // 4. Ensure profile row exists
      const [existingProfile] = await tx
        .select()
        .from(profiles)
        .where(eq(profiles.userId, user.id))
        .limit(1);

      if (!existingProfile) {
        // Try lazy import of Firestore profile fields
        let fsProfile: Record<string, any> | null = null;
        try {
          fsProfile = await fetchFirestoreProfile(data.sub);
        } catch {}

        const rawUsername = fsProfile?.username || fsProfile?.handle || data.name || (data.email ? data.email.split('@')[0] : `user_${data.sub.slice(0, 8)}`);
        let baseUsername = String(rawUsername).toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
        if (!baseUsername || baseUsername.length < 3) {
          baseUsername = `user_${data.sub.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
        }
        baseUsername = baseUsername.slice(0, 24);

        let username = baseUsername;
        let attempts = 0;
        while (attempts < 5) {
          const [taken] = await tx
            .select({ id: profiles.id })
            .from(profiles)
            .where(eq(profiles.username, username))
            .limit(1);
          if (!taken) break;
          const suffix = Math.floor(1000 + Math.random() * 9000);
          username = `${baseUsername.slice(0, 18)}_${suffix}`;
          attempts++;
        }

        const rawDisplayName = fsProfile?.displayName || fsProfile?.name || data.name || username;
        const displayName = String(rawDisplayName).trim().slice(0, 95) || username;
        const rawAvatar = fsProfile?.avatarKey || fsProfile?.photoURL || fsProfile?.avatar || data.picture || null;
        const avatarKey = rawAvatar ? String(rawAvatar).trim().slice(0, 500) : null;
        const rawBio = fsProfile?.bio || null;
        const bio = rawBio ? String(rawBio).trim().slice(0, 5000) : null;

        await tx
          .insert(profiles)
          .values({
            userId: user.id,
            username,
            displayName,
            bio,
            avatarKey,
            isVerified: Boolean(fsProfile?.isVerified || fsProfile?.verified),
            points: Number(fsProfile?.points || fsProfile?.aeirmistPoints || 0),
          })
          .onConflictDoNothing();
      }

      return user;
    });
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
    }
    const user = await this.findByEmailOrUsername(cleanId) ||
                 await this.findByFirebaseUid(cleanId) ||
                 await this.findByEmailOrUsername(rawId) ||
                 await this.findByFirebaseUid(rawId);
    if (user?.id) return user.id;

    // Check if cleanId or rawId matches a profile username or id directly
    const p = (await this.getProfileByUsername(cleanId)) || (await this.getProfileByUsername(rawId));
    if (p?.userId) return p.userId;

    // Fallback: Check if cleanId or rawId corresponds to an unmigrated Firestore profile
    try {
      const fsProfile = (await fetchFirestoreProfile(cleanId)) || (await fetchFirestoreProfile(rawId));
      if (fsProfile) {
        const uid = fsProfile.uid || fsProfile.ownerUid || cleanId;
        const provisioned = await this.autoProvisionFromFirebase({
          sub: uid,
          email: fsProfile.email,
          emailVerified: true,
          name: fsProfile.displayName || fsProfile.name || fsProfile.username,
          picture: fsProfile.avatarKey || fsProfile.photoURL,
        });
        if (provisioned?.id) return provisioned.id;
      }
    } catch {}

    // Final fallback: If cleanId matches a Firebase UID format, auto-provision user safely so chat and relations work
    const isFirebaseUid = /^[a-zA-Z0-9_-]{20,40}$/.test(cleanId);
    if (isFirebaseUid) {
      try {
        const provisioned = await this.autoProvisionFromFirebase({
          sub: cleanId,
          email: `${cleanId.toLowerCase()}@firebase.aeirmist.social`,
          emailVerified: true,
          name: `user_${cleanId.slice(0, 8)}`,
        });
        if (provisioned?.id) return provisioned.id;
      } catch (provErr) {
        console.warn(`[UserDAL.resolveToUserId] Auto-provision fallback failed for ${cleanId}:`, provErr);
      }
    }

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
    latitude?: number | string | null;
    longitude?: number | string | null;
    isTrusted?: boolean;
    sessionToken?: string | null;
    expiresAt?: Date;
  }) {
    try {
      const expiresAt = data.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const sessionToken = data.sessionToken || crypto.randomBytes(32).toString('hex');
      const refreshTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

      const parsed = parseUserAgent(data.userAgent, data.deviceName);
      const finalModel = parsed.model;
      const finalBrowser = parsed.browser;
      const finalOs = parsed.os;
      const finalDeviceType = parsed.deviceType;
      const finalDeviceName = data.deviceName || parsed.displayName;

      let isTrusted = data.isTrusted;
      if (isTrusted === undefined) {
        const [prev] = await db
          .select({ id: loginSessions.id })
          .from(loginSessions)
          .where(and(eq(loginSessions.userId, data.userId), eq(loginSessions.model, finalModel)))
          .limit(1);
        isTrusted = !!prev;
      }

      // Check if updating existing session by sessionToken
      if (data.sessionToken) {
        const [existing] = await db
          .select()
          .from(loginSessions)
          .where(and(eq(loginSessions.userId, data.userId), eq(loginSessions.sessionToken, data.sessionToken)))
          .limit(1);

        if (existing) {
          const [updated] = await db
            .update(loginSessions)
            .set({
              ipAddress: data.ipAddress ? data.ipAddress.slice(0, 45) : existing.ipAddress,
              userAgent: data.userAgent || existing.userAgent,
              location: data.location || existing.location,
              latitude: data.latitude != null ? String(data.latitude) : existing.latitude,
              longitude: data.longitude != null ? String(data.longitude) : existing.longitude,
              lastActiveAt: new Date(),
              isRevoked: false,
            })
            .where(eq(loginSessions.id, existing.id))
            .returning();
          return updated;
        }
      }

      const [session] = await db
        .insert(loginSessions)
        .values({
          userId: data.userId,
          refreshTokenHash,
          sessionToken,
          ipAddress: data.ipAddress ? data.ipAddress.slice(0, 45) : null,
          userAgent: data.userAgent || null,
          deviceName: finalDeviceName.slice(0, 100),
          deviceType: finalDeviceType,
          model: finalModel.slice(0, 100),
          browser: finalBrowser.slice(0, 50),
          os: finalOs.slice(0, 50),
          location: data.location ? data.location.slice(0, 200) : null,
          latitude: data.latitude != null ? String(data.latitude) : null,
          longitude: data.longitude != null ? String(data.longitude) : null,
          isTrusted,
          isRevoked: false,
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

  static async getActiveLoginSessions(userId: string) {
    try {
      return await db
        .select({
          id: loginSessions.id,
          userId: loginSessions.userId,
          ipAddress: loginSessions.ipAddress,
          deviceName: loginSessions.deviceName,
          deviceType: loginSessions.deviceType,
          model: loginSessions.model,
          browser: loginSessions.browser,
          os: loginSessions.os,
          location: loginSessions.location,
          latitude: loginSessions.latitude,
          longitude: loginSessions.longitude,
          isTrusted: loginSessions.isTrusted,
          sessionToken: loginSessions.sessionToken,
          lastActiveAt: loginSessions.lastActiveAt,
          createdAt: loginSessions.createdAt,
        })
        .from(loginSessions)
        .where(
          and(
            eq(loginSessions.userId, userId),
            eq(loginSessions.isRevoked, false),
            gt(loginSessions.expiresAt, new Date())
          )
        )
        .orderBy(desc(loginSessions.lastActiveAt));
    } catch (err) {
      console.warn('[UserDAL] getActiveLoginSessions warning:', err);
      return [];
    }
  }

  static async touchLoginSession(sessionId: string) {
    try {
      await db
        .update(loginSessions)
        .set({ lastActiveAt: new Date() })
        .where(eq(loginSessions.id, sessionId));
    } catch {}
  }

  static async revokeLoginSession(userId: string, sessionId: string) {
    try {
      const [revoked] = await db
        .update(loginSessions)
        .set({ isRevoked: true })
        .where(and(eq(loginSessions.userId, userId), eq(loginSessions.id, sessionId)))
        .returning();
      return !!revoked;
    } catch (err) {
      console.warn('[UserDAL] revokeLoginSession warning:', err);
      return false;
    }
  }

  static async revokeOtherLoginSessions(userId: string, currentSessionId?: string, currentSessionToken?: string) {
    try {
      const conditions = [eq(loginSessions.userId, userId), eq(loginSessions.isRevoked, false)];
      if (currentSessionId) {
        conditions.push(ne(loginSessions.id, currentSessionId));
      } else if (currentSessionToken) {
        conditions.push(ne(loginSessions.sessionToken, currentSessionToken));
      }
      const result = await db
        .update(loginSessions)
        .set({ isRevoked: true })
        .where(and(...conditions))
        .returning();
      return result.length;
    } catch (err) {
      console.warn('[UserDAL] revokeOtherLoginSessions warning:', err);
      return 0;
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
        })
        .from(profiles)
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
        })
        .from(profiles)
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
        })
        .from(profiles)
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

  static async getFollowers(userId: string) {
    try {
      return await db
        .select({
          id: profiles.id,
          userId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          bio: profiles.bio,
          isVerified: profiles.isVerified,
          badge: profiles.badge,
          followersCount: profiles.followersCount,
          followingCount: profiles.followingCount,
        })
        .from(follows)
        .innerJoin(profiles, eq(profiles.userId, follows.followerId))
        .where(eq(follows.followingId, userId))
        .orderBy(desc(follows.createdAt));
    } catch (err) {
      console.warn('[UserDAL] getFollowers error:', err);
      return [];
    }
  }

  static async getFollowing(userId: string) {
    try {
      return await db
        .select({
          id: profiles.id,
          userId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          bio: profiles.bio,
          isVerified: profiles.isVerified,
          badge: profiles.badge,
          followersCount: profiles.followersCount,
          followingCount: profiles.followingCount,
        })
        .from(follows)
        .innerJoin(profiles, eq(profiles.userId, follows.followingId))
        .where(eq(follows.followerId, userId))
        .orderBy(desc(follows.createdAt));
    } catch (err) {
      console.warn('[UserDAL] getFollowing error:', err);
      return [];
    }
  }

  static async getFollowingIds(userId: string): Promise<string[]> {
    try {
      const rows = await db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, userId));
      return rows.map(r => r.followingId);
    } catch {
      return [];
    }
  }

  static async getFollowerIds(userId: string): Promise<string[]> {
    try {
      const rows = await db
        .select({ followerId: follows.followerId })
        .from(follows)
        .where(eq(follows.followingId, userId));
      return rows.map(r => r.followerId);
    } catch {
      return [];
    }
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
          sql`(LOWER(${profiles.username}) LIKE ${searchPattern} OR LOWER(${profiles.displayName}) LIKE ${searchPattern})`
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
