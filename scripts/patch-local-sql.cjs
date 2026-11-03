const fs = require('fs');
const path = require('path');

// 1. LocalSqlService.ts
const sqlFile = path.join(__dirname, '../src/services/LocalSqlService.ts');
let sqlContent = fs.readFileSync(sqlFile, 'utf8');

const sqlMethodToAdd = `  /**
   * Save comprehensive user profile details to SQL database safely and fast.
   * Stores ID, name, ID number, profile URL, username, and complete metadata.
   */
  static async syncUserProfileToSql(profile: any, user?: any): Promise<void> {
    if (!profile) return;
    try {
      const pid = profile.id || profile.uid || user?.uid || user?.id;
      if (!pid) return;

      const fullSqlProfile = {
        ...profile,
        id: pid,
        userId: user?.uid || profile.userId || pid,
        displayName: profile.displayName || profile.name || profile.username || 'Aeirmist User',
        name: profile.displayName || profile.name || profile.username || 'Aeirmist User',
        username: profile.username || \`user_\${String(pid).slice(0, 8)}\`,
        accountId: profile.accountId || (user as any)?.accountId || profile.idNumber || \`AE-\${String(pid).slice(0, 8).toUpperCase()}\`,
        idNumber: profile.accountId || (user as any)?.accountId || profile.idNumber || \`AE-\${String(pid).slice(0, 8).toUpperCase()}\`,
        photoURL: profile.photoURL || profile.avatarKey || '',
        avatarKey: profile.avatarKey || profile.photoURL || '',
        email: profile.email || user?.email || '',
        updatedAt: Date.now(),
        cachedAt: Date.now()
      };

      await aeirmistCache.saveProfile(fullSqlProfile);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('aeirmist_cached_profile', JSON.stringify(fullSqlProfile));
          localStorage.setItem('aeirmist_user_profile', JSON.stringify(fullSqlProfile));
          localStorage.setItem('aeirmist_user_id', pid);
          if (fullSqlProfile.username) localStorage.setItem('aeirmist_username', fullSqlProfile.username);
        } catch {}
      }
    } catch (err) {
      console.warn('[LocalSqlService] Failed to sync user profile to SQL:', err);
    }
  }
`;

if (!sqlContent.includes('syncUserProfileToSql')) {
  sqlContent = sqlContent.replace(
    '  static async getDatabaseStats() {',
    `${sqlMethodToAdd}\n  static async getDatabaseStats() {`
  );
  fs.writeFileSync(sqlFile, sqlContent, 'utf8');
  console.log('Added syncUserProfileToSql to LocalSqlService.ts');
}

// 2. AeirmistContext.tsx: Ensure profile updates immediately call syncUserProfileToSql
const ctxFile = path.join(__dirname, '../src/context/AeirmistContext.tsx');
let ctxContent = fs.readFileSync(ctxFile, 'utf8');

if (ctxContent.includes('LocalSqlService.saveProfile(profile).catch(() => {});')) {
  ctxContent = ctxContent.replace(
    'LocalSqlService.saveProfile(profile).catch(() => {});',
    'LocalSqlService.syncUserProfileToSql(profile, user).catch(() => {});'
  );
  fs.writeFileSync(ctxFile, ctxContent, 'utf8');
  console.log('Updated AeirmistContext.tsx to call syncUserProfileToSql');
}
