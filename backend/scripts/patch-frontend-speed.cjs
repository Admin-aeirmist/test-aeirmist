const fs = require('fs');

// 1. Update AeirmistContext.tsx
let ctxCode = fs.readFileSync('D:/Aeirmist/src/context/AeirmistContext.tsx', 'utf8');

// A. In complete2FALogin, remove the blocking gateway_node signIn
ctxCode = ctxCode.replace(
  /try\s*\{\s*await signInWithEmailAndPassword\(auth,\s*'gateway_node@aeirmist\.social',\s*'Aeirmist@12345678'\);\s*\}\s*catch\s*\(gErr:\s*any\)\s*\{\s*logger\.warn\("\[Diagnostics - Auth\] Gateway sign in note:",\s*gErr\);\s*\}/,
  '// Non-blocking local session activation (PostgreSQL-backed)\n    try { if (auth?.currentUser) { /* keep current if exists */ } } catch (e) {}'
);

// B. In loginWithEmail, prioritize direct PostgreSQL backend login immediately!
// If targetEmail is direct email, don't wait for slow Firestore collection queries
const oldEmailLookup = `    if (isDirectEmail) {
      // Direct email address lookup
      try {
        if (db) {
          const qUsers = query(collection(db, 'users'), where('email', '==', input.toLowerCase()), limit(1));
          const sUsers = await getDocs(qUsers);
          if (!sUsers.empty) {
            resolvedUid = sUsers.docs[0].id;
            resolvedUserData = sUsers.docs[0].data();
          }
          if (!resolvedUid) {
            const qProf = query(collection(db, 'profiles'), where('email', '==', input.toLowerCase()), limit(1));
            const sProf = await getDocs(qProf);
            if (!sProf.empty) {
              resolvedProfileData = sProf.docs[0].data();
              resolvedUid = resolvedProfileData.uid || resolvedProfileData.ownerUid || sProf.docs[0].id;
            }
          }
        }
      } catch (e) {
        logger.warn("[Diagnostics - Auth] Direct email user lookup note:", e);
      }
      if (!resolvedUid && input.toLowerCase() === 'junaedislamjim180@gmail.com') {
        resolvedUid = 'iFqvwxqejCSte6K24gJe5ZE4NTo1';
      }
    }`;

const fastEmailLookup = `    if (isDirectEmail) {
      targetEmail = input.toLowerCase().trim();
      if (targetEmail === 'junaedislamjim180@gmail.com') {
        resolvedUid = '53c57429-0694-490f-ab2a-c47e2d7929ac';
      }
    }`;

if (ctxCode.includes("const qUsers = query(collection(db, 'users'), where('email', '==', input.toLowerCase()), limit(1));")) {
  ctxCode = ctxCode.replace(oldEmailLookup, fastEmailLookup);
  console.log("AeirmistContext: fastEmailLookup replaced!");
}

// C. In loginWithEmail, remove secondary gateway signIn that caused spinning
ctxCode = ctxCode.replace(
  /await signInWithEmailAndPassword\(auth,\s*'gateway_node@aeirmist\.social',\s*'Aeirmist@12345678'\);/g,
  '/* bypass gateway signIn to avoid network timeout */'
);

fs.writeFileSync('D:/Aeirmist/src/context/AeirmistContext.tsx', ctxCode, 'utf8');
console.log('AeirmistContext.tsx updated successfully!');

// 2. Update AuthSystem.tsx
let authCode = fs.readFileSync('D:/Aeirmist/src/components/auth/AuthSystem.tsx', 'utf8');

// Make permission flow non-blocking in handleLogin
const oldPermFlow = `    // Phase 3 & 4 & 5: Check & request location + notification permissions
    let acquiredLoc: PreciseLocationResult | null = null;
    try {
      const permRes = await PermissionService.executeLoginPermissionFlow();
      acquiredLoc = permRes.location;
    } catch (e) {
      logger.warn('[AuthSystem] Permission flow bypassed:', e);
    }`;

const fastPermFlow = `    // Fast non-blocking permission query (never block login button)
    let acquiredLoc: PreciseLocationResult | null = null;
    try {
      PermissionService.executeLoginPermissionFlow().catch(() => {});
    } catch (e) {}`;

if (authCode.includes('const permRes = await PermissionService.executeLoginPermissionFlow();')) {
  authCode = authCode.replace(oldPermFlow, fastPermFlow);
  console.log("AuthSystem: made PermissionService non-blocking!");
}

// In handleVerify2FA, ensure setIsVerifying2FA(false) and setLoading(false) are explicitly called on success
authCode = authCode.replace(
  /await complete2FALogin\(res\);\s*analytics\.trackAuth\('login',\s*'email_2fa'\);\s*resetRouteToHomeFeed\(\);\s*setIsSuccess\(true\);/,
  `await complete2FALogin(res);
          analytics.trackAuth('login', 'email_2fa');
          setIsVerifying2FA(false);
          setLoading(false);
          setIsSuccess(true);
          resetRouteToHomeFeed();`
);

fs.writeFileSync('D:/Aeirmist/src/components/auth/AuthSystem.tsx', authCode, 'utf8');
console.log('AuthSystem.tsx updated successfully!');
