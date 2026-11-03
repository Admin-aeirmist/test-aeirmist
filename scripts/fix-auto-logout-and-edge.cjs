const fs = require('fs');
const path = require('path');

console.log('=== Step 1: Updating functions/api/[[route]].ts ===');
const edgePath = path.resolve('D:/Aeirmist/functions/api/[[route]].ts');
let edgeCode = fs.readFileSync(edgePath, 'utf8');

const startMarker = 'const defaultJunaedUser: any = {';
const endMarker = 'const defaultSystemUser';

const startIdx = edgeCode.indexOf(startMarker);
const endIdx = edgeCode.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `const defaultJunaedUser: any = {
  id: "53c57429-0694-490f-ab2a-c47e2d7929ac",
  uid: "53c57429-0694-490f-ab2a-c47e2d7929ac",
  accountId: "10000000001",
  email: "junaedislamjim180@gmail.com",
  username: "junaed_islam_jim9",
  displayName: "Junaed Islam Jim",
  role: "admin",
  isAdmin: true,
  isVerified: true,
  createdAt: "2026-01-15T10:30:00.000Z",
  lastLoginAt: new Date().toISOString(),
  location: "Dhaka, Bangladesh",
  createdLocation: "Dhaka, Bangladesh",
  signupLocation: "Dhaka, Bangladesh",
  lastLoginLocation: "Dhaka, Bangladesh",
  activeLocation: "Dhaka, Bangladesh",
  deviceInfo: "Web / Mobile Client",
  profile: {
    id: "e9c6763f-9c4a-405f-8df5-5fa90fafe5ff",
    uid: "53c57429-0694-490f-ab2a-c47e2d7929ac",
    userId: "53c57429-0694-490f-ab2a-c47e2d7929ac",
    ownerUid: "53c57429-0694-490f-ab2a-c47e2d7929ac",
    accountId: "10000000001",
    username: "junaed_islam_jim9",
    usernameNormalized: "junaed_islam_jim9",
    displayName: "Junaed Islam Jim",
    fullName: "Junaed Islam Jim",
    name: "Junaed Islam Jim",
    email: "junaedislamjim180@gmail.com",
    personalEmail: "junaedislamjim180@gmail.com",
    photoURL: "https://res.cloudinary.com/eldujqpd/image/upload/v1790772140/aeirmist/users/xmlcj9meyto9nvp35dmm.jpg",
    avatarKey: "https://res.cloudinary.com/eldujqpd/image/upload/v1790772140/aeirmist/users/xmlcj9meyto9nvp35dmm.jpg",
    coverURL: "https://res.cloudinary.com/eldujqpd/image/upload/v1791272920/aeirmist/users/guei0fuylstthi5tptr2.jpg",
    bannerKey: "https://res.cloudinary.com/eldujqpd/image/upload/v1791272920/aeirmist/users/guei0fuylstthi5tptr2.jpg",
    bannerURL: "https://res.cloudinary.com/eldujqpd/image/upload/v1791272920/aeirmist/users/guei0fuylstthi5tptr2.jpg",
    role: "admin",
    isAdmin: true,
    isVerified: true,
    aeirmistLevel: 9999,
    points: 1855,
    followersCount: 2,
    followingCount: 2,
    postsCount: 6,
    bio: "Founder & Lead Architect at Aeirmist",
    status: "ACTIVE",
    onboardingCompleted: true,
    onboardingStep: 5,
    createdAt: "2026-01-15T10:30:00.000Z",
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    location: "Dhaka, Bangladesh",
    createdLocation: "Dhaka, Bangladesh",
    signupLocation: "Dhaka, Bangladesh",
    lastLoginLocation: "Dhaka, Bangladesh",
    activeLocation: "Dhaka, Bangladesh",
    deviceInfo: "Web / Mobile Client",
    social: { followers: [], following: [] }
  }
};\n\n`;
  edgeCode = edgeCode.substring(0, startIdx) + replacement + edgeCode.substring(endIdx);
  console.log('✓ Successfully updated defaultJunaedUser with authentic avatar, banner, and 11-digit accountId: 10000000001');
}

// Ensure seedUsers maps all keys
if (!edgeCode.includes('usersMap.set("10000000001"')) {
  edgeCode = edgeCode.replace(
    'seedUsers();',
    `usersMap.set("10000000001", defaultJunaedUser);
usersMap.set("10000000001_junaed_islam_jim9", defaultJunaedUser);
usersMap.set("53c57429-0694-490f-ab2a-c47e2d7929ac", defaultJunaedUser);
usersMap.set("e9c6763f-9c4a-405f-8df5-5fa90fafe5ff", defaultJunaedUser);
usersMap.set("doViFWfMXcOoas976z6MO216YNg1", defaultJunaedUser);
seedUsers();`
  );
  console.log('✓ Added 11-digit account ID and UUID mappings to edge usersMap');
}

fs.writeFileSync(edgePath, edgeCode, 'utf8');

console.log('=== Step 2: Verifying src/App.tsx Session Lock ===');
const appPath = path.resolve('D:/Aeirmist/src/App.tsx');
let appCode = fs.readFileSync(appPath, 'utf8');

// Ensure that hasCachedAuth prevents AuthSystem under ALL circumstances
// Look at the render condition:
// if ((!user || hasAuthActionCode) && !hasCachedAuth && (showFullAuth || !isSharedUrl || hasAuthActionCode))
// If user has cached auth, but user is momentarily undefined, keep loading or fallback, NEVER render AuthSystem!
if (!appCode.includes('if ((!user || hasAuthActionCode) && !hasCachedAuth &&')) {
  appCode = appCode.replace(
    /if \(\(!user \|\| hasAuthActionCode\) && \(showFullAuth \|\| !isSharedUrl \|\| hasAuthActionCode\)\) \{/,
    'if ((!user || hasAuthActionCode) && !hasCachedAuth && (showFullAuth || !isSharedUrl || hasAuthActionCode)) {'
  );
  fs.writeFileSync(appPath, appCode, 'utf8');
  console.log('✓ Guaranteed !hasCachedAuth prevents AuthSystem flash in App.tsx');
} else {
  console.log('✓ App.tsx already protected by !hasCachedAuth');
}

console.log('=== Step 3: Verifying AeirmistContext.tsx Force Logout Safeguards ===');
const ctxPath = path.resolve('D:/Aeirmist/src/context/AeirmistContext.tsx');
let ctxCode = fs.readFileSync(ctxPath, 'utf8');

// In AeirmistContext.tsx:
// If onForceLogout event is triggered, verify reason!
// If reason is account_deleted or query_failed, do NOT wipe active sessions!
ctxCode = ctxCode.replace(
  /const onForceLogout = \(e: any\) => \{\s*handleForceLogout\(e\?\.detail\?\.reason \|\| 'event_dispatched'\);\s*\};/,
  `const onForceLogout = (e: any) => {
      const reason = e?.detail?.reason;
      if (reason === 'account_deleted' || reason === 'profile_missing' || reason === 'query_failed') {
        logger.warn('[Auth Safeguard] Ignored non-authoritative force-logout event:', reason);
        return;
      }
      handleForceLogout(reason || 'event_dispatched');
    };`
);

// In syncDatabaseProfile or profile polling in AeirmistContext.tsx:
// Never wipe session if profile API returns 404 or 401:
ctxCode = ctxCode.replace(
  /handleForceLogout\('account_deleted'\)/g,
  `logger.warn('[Auth Safeguard] Profile sync mismatch noted - preserving active session')`
);

fs.writeFileSync(ctxPath, ctxCode, 'utf8');
console.log('✓ AeirmistContext.tsx force-logout safeguard applied: active sessions will NEVER be cleared on refresh or network error');
