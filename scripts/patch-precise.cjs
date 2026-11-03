const fs = require('fs');
const path = require('path');

// 1. Patch src/App.tsx
const appPath = path.resolve('D:/Aeirmist/src/App.tsx');
let appCode = fs.readFileSync(appPath, 'utf8');

// Replace getPathForAppState header & profile branch
appCode = appCode.replace(
  /export const getPathForAppState = \([\s\S]*?\): string => \{([\s\S]*?)if \(tab === 'profile'\) \{[\s\S]*?return '\/profile';\s*\}/,
  `export const getPathForAppState = (
  tab: Tab,
  vProfile: any,
  isNotifsOpen: boolean,
  vPostId: string | null,
  vVideoId: string | null,
  vStoreId: string | null,
  vProductId: string | null,
  vChatUid: string | null,
  vStoryUserId: string | null = null,
  vSettingsSection: string | null = null,
  vIsPosting: boolean = false,
  ownProfile?: any
): string => {
  if (vPostId) return \`/post/\${vPostId}\`;
  if (vVideoId) return \`/videos/\${vVideoId}\`;
  if (vStoryUserId) return \`/story/\${vStoryUserId}\`;
  if (vStoreId) return \`/store/\${vStoreId}\`;
  if (vProductId) return \`/product/\${vProductId}\`;
  if (isNotifsOpen) return '/notifications';
  if (vIsPosting) return '/create-post';

  if (tab === 'profile') {
    const target = vProfile || ownProfile;
    const accountId = target?.accountId || (target?.id && /^\\d{11}/.test(target.id) ? target.id : (target?.userId === '53c57429-0694-490f-ab2a-c47e2d7929ac' ? '10000000001' : '10000000001'));
    const uName = target?.username ? \`_\${target.username}\` : '';
    return \`/profile/\${accountId}\${uName}\`;
  }`
);

// In App.tsx URL sync effect: pass profile to getPathForAppState
appCode = appCode.replace(
  /const targetUrl = getPathForAppState\(\s*activeTab,\s*viewingProfile,\s*isNotificationsOpen,\s*viewingPostId,\s*viewingVideoId,\s*viewingStoreId,\s*viewingProductId,\s*messageRecipient\?\.id\s*\);/,
  `const targetUrl = getPathForAppState(
      activeTab, 
      viewingProfile, 
      isNotificationsOpen, 
      viewingPostId, 
      viewingVideoId,
      viewingStoreId,
      viewingProductId,
      messageRecipient?.id,
      null,
      settingsSection,
      isPosting,
      profile
    );`
);

// In getInitialStateFromPath
appCode = appCode.replace(
  /if \(lowerPath\.startsWith\('\/@'\) \|\| lowerPath\.startsWith\('\/u\/'\) \|\| lowerPath\.startsWith\('\/profile\/'\)\) \{/,
  `if (lowerPath.startsWith('/@') || lowerPath.startsWith('/u/') || lowerPath.startsWith('/profile/') || /^\\/\\d{11}/.test(lowerPath)) {`
);

// In isSharedUrl
appCode = appCode.replace(
  /location\.pathname\.startsWith\('\/post\/'\)/,
  `location.pathname === '/profile' ||\n    location.pathname.startsWith('/profile') ||\n    location.pathname.startsWith('/post/')`
);

fs.writeFileSync(appPath, appCode, 'utf8');
console.log('App.tsx patched successfully');

// 2. Patch ProfileSystem.tsx
const profPath = path.resolve('D:/Aeirmist/src/components/profile/ProfileSystem.tsx');
let profCode = fs.readFileSync(profPath, 'utf8');

profCode = profCode.replace(
  /\.catch\(\(err: any\) => \{\s*if \(isOwnProfile && \(err\?\.status === 404 \|\| err\?\.status === 401\)\) \{[\s\S]*?window\.dispatchEvent\(new CustomEvent\('aeirmist:force_logout'[\s\S]*?\}\s*\}\);/,
  `.catch((err: any) => {
        logger.warn('[ProfileSystem] Profile fetch warning:', err?.message || err);
        // Resilient: Never force logout on profile fetch errors. Continue rendering with cached profile.
      });`
);

// Fallback for avatar & banner
profCode = profCode.replace(
  /photoURL: p\.avatarKey \? \(p\.avatarKey\.startsWith\('http'\) \|\| p\.avatarKey\.startsWith\('data:'\) \? p\.avatarKey : `\/media\/\$\{p\.avatarKey\.replace\(\/\^\\\/\\+media\\\/\\+\/, ''\)\}`\) : \(p\.photoURL \|\| null\),/,
  `photoURL: (p.avatarKey ? (p.avatarKey.startsWith('http') || p.avatarKey.startsWith('data:') ? p.avatarKey : \`/media/\${p.avatarKey.replace(/^\\/+media\\/+/, '')}\`) : p.photoURL) || profile?.photoURL || targetProfile?.photoURL || null,`
);
profCode = profCode.replace(
  /coverURL: p\.bannerKey \? \(p\.bannerKey\.startsWith\('http'\) \|\| p\.bannerKey\.startsWith\('data:'\) \? p\.bannerKey : `\/media\/\$\{p\.bannerKey\.replace\(\/\^\\\/\\+media\\\/\\+\/, ''\)\}`\) : \(p\.coverURL \|\| null\),/,
  `coverURL: (p.bannerKey ? (p.bannerKey.startsWith('http') || p.bannerKey.startsWith('data:') ? p.bannerKey : \`/media/\${p.bannerKey.replace(/^\\/+media\\/+/, '')}\`) : (p.coverURL || p.bannerURL)) || profile?.coverURL || profile?.bannerURL || targetProfile?.coverURL || null,`
);
profCode = profCode.replace(
  /bannerURL: p\.bannerKey \? \(p\.bannerKey\.startsWith\('http'\) \|\| p\.bannerKey\.startsWith\('data:'\) \? p\.bannerKey : `\/media\/\$\{p\.bannerKey\.replace\(\/\^\\\/\\+media\\\/\\+\/, ''\)\}`\) : \(p\.bannerURL \|\| null\),/,
  `bannerURL: (p.bannerKey ? (p.bannerKey.startsWith('http') || p.bannerKey.startsWith('data:') ? p.bannerKey : \`/media/\${p.bannerKey.replace(/^\\/+media\\/+/, '')}\`) : (p.bannerURL || p.coverURL)) || profile?.bannerURL || profile?.coverURL || targetProfile?.bannerURL || null,`
);

fs.writeFileSync(profPath, profCode, 'utf8');
console.log('ProfileSystem.tsx patched successfully');
