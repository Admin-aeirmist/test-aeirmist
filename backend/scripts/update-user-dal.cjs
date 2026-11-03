const fs = require('fs');
let code = fs.readFileSync('D:/Aeirmist/backend/src/dal/user.dal.ts', 'utf8');

// 1. Add accountId to getProfileById projection if not present
code = code.replace(
  /select\(\{([\r\n\s]+)id: profiles\.id,([\r\n\s]+)userId: profiles\.userId,/,
  'select({$1id: profiles.id,$1accountId: profiles.accountId,$2userId: profiles.userId,'
);

// 2. Add getProfileByAccountId and enhanced getProfileByIdentifier
const oldMethodRegex = /static async getProfileByIdentifier\(identifier: string\) \{[\s\S]*?return null;\s*\}/;

const newMethods = `static async getProfileByAccountId(accountId: string) {
    if (!accountId || typeof accountId !== 'string') return null;
    try {
      const [profile] = await db
        .select({
          id: profiles.id,
          accountId: profiles.accountId,
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
        .where(eq(profiles.accountId, accountId.trim()))
        .limit(1);
      return profile || null;
    } catch {
      return null;
    }
  }

  static async getProfileByIdentifier(identifier: string) {
    if (!identifier) return null;
    let clean = identifier.trim().replace(/^@+/, '');

    // 0. Handle legacy Firestore "profile_" prefix
    if (clean.toLowerCase().startsWith('profile_')) {
      const stripped = clean.substring('profile_'.length);
      const isStrippedUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stripped);
      if (isStrippedUuid) {
        const byUser = await this.getProfileByUserId(stripped);
        if (byUser) return byUser;
        const byProfile = await this.getProfileById(stripped);
        if (byProfile) return byProfile;
      }
      clean = stripped;
    }

    // 1. Direct 11-digit Account ID lookup (or numeric prefix e.g. 10000000001_username like FB)
    const matchAccountId = clean.match(/^(\\d{11})(?:[_-].*)?$/);
    if (matchAccountId) {
      const byAcc = await this.getProfileByAccountId(matchAccountId[1]);
      if (byAcc) return byAcc;
    }

    // 2. Direct numeric ID (10 to 16 digits)
    if (/^\\d{10,16}$/.test(clean)) {
      const byAcc = await this.getProfileByAccountId(clean);
      if (byAcc) return byAcc;
    }

    // 3. Direct UUID lookup (user_id or profile_id)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    if (isUuid) {
      const byUser = await this.getProfileByUserId(clean);
      if (byUser) return byUser;
      const byProfile = await this.getProfileById(clean);
      if (byProfile) return byProfile;
    }

    // 4. Exact username lookup
    const byUsername = await this.getProfileByUsername(clean);
    if (byUsername) return byUsername;

    // 5. Firebase UID lookup
    const byFb = await this.findByFirebaseUid(clean);
    if (byFb) {
      return this.getProfileByUserId(byFb.id);
    }
    return null;
  }`;

if (oldMethodRegex.test(code)) {
  code = code.replace(oldMethodRegex, newMethods);
  fs.writeFileSync('D:/Aeirmist/backend/src/dal/user.dal.ts', code, 'utf8');
  console.log('user.dal.ts updated successfully with 11-digit account ID resolution!');
} else {
  console.error('Could not find old getProfileByIdentifier in user.dal.ts');
}
