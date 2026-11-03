const fs = require('fs');

// 1. Update AuthSystem.tsx: Remove PermissionService completely from handleLogin!
let authCode = fs.readFileSync('D:/Aeirmist/src/components/auth/AuthSystem.tsx', 'utf8');

const targetBlock = `    // Phase 3 & 4 & 5: Check & request location + notification permissions
    let acquiredLoc: PreciseLocationResult | null = null;
    try {
      const permRes = await PermissionService.executeLoginPermissionFlow();
      acquiredLoc = permRes.location;
    } catch (e) {
      logger.warn('[AuthSystem] Permission flow bypassed:', e);
    }

    try {
      const userCredential = await loginWithEmail(identifier, password, true, acquiredLoc);`;

const fastBlock = `    try {
      // Instant direct login without blocking for permissions
      const userCredential = await loginWithEmail(identifier, password, true, null);`;

if (authCode.includes('PermissionService.executeLoginPermissionFlow()')) {
  authCode = authCode.replace(targetBlock, fastBlock);
  console.log('AuthSystem.tsx: PermissionService successfully removed from handleLogin!');
} else {
  console.log('PermissionService already removed or different whitespace');
}

// Ensure setLoading(false) is called in handleLogin catch block
authCode = authCode.replace(
  /\} catch \(err: any\) \{\s*setError\(getContextualError/,
  `} catch (err: any) {\n      setLoading(false);\n      setError(getContextualError`
);

fs.writeFileSync('D:/Aeirmist/src/components/auth/AuthSystem.tsx', authCode, 'utf8');

// 2. Update AeirmistContext.tsx: Make loginWithEmail instant via PostgreSQL
let ctxCode = fs.readFileSync('D:/Aeirmist/src/context/AeirmistContext.tsx', 'utf8');

// When backendAuthSuccess is true, return immediately without waiting for Firebase Auth
const oldBackendAuthHandling = `    // Primary: Authenticate with Device Database (PostgreSQL on device)
    let backendAuthSuccess = false;
    let backendUser: any = null;
    let bRes: any = null;
    try {
      bRes = await api.auth.login({
        identifier: targetEmail,
        email: targetEmail,
        password: pass,
        location: locationData?.displayLocation || locationData?.location,
        latitude: locationData?.latitude,
        longitude: locationData?.longitude,
      });
      if (bRes && bRes.requires2FA) {
        return bRes;
      }
      if (bRes && (bRes.token || bRes.user)) {
        backendAuthSuccess = true;
        backendUser = bRes.user;
        if (bRes.token) {
          setAuthToken(bRes.token);
        }
        logger.info("[Diagnostics - Auth] Successfully authenticated with Device PostgreSQL Backend!");
      }
    } catch (bErr) {
      logger.warn("[Diagnostics - Auth] Device backend auth attempt note:", bErr);
    }`;

const fastBackendAuthHandling = `    // Primary: Authenticate with Device Database (PostgreSQL on device)
    let backendAuthSuccess = false;
    let backendUser: any = null;
    let bRes: any = null;
    try {
      bRes = await api.auth.login({
        identifier: targetEmail,
        email: targetEmail,
        password: pass,
        location: locationData?.displayLocation || locationData?.location,
        latitude: locationData?.latitude,
        longitude: locationData?.longitude,
      });
      if (bRes && bRes.requires2FA) {
        setLoading(false);
        return bRes;
      }
      if (bRes && (bRes.token || bRes.user)) {
        backendAuthSuccess = true;
        backendUser = bRes.user;
        if (bRes.token) {
          setAuthToken(bRes.token);
        }
        logger.info("[Diagnostics - Auth] Successfully authenticated with Device PostgreSQL Backend!");
      }
    } catch (bErr) {
      logger.warn("[Diagnostics - Auth] Device backend auth attempt note:", bErr);
    }`;

ctxCode = ctxCode.replace(oldBackendAuthHandling, fastBackendAuthHandling);

// When backendAuthSuccess is true, don't execute slow Firebase signInWithEmailAndPassword
ctxCode = ctxCode.replace(
  /let credentials: any = null;\s*try \{\s*credentials = await signInWithEmailAndPassword\(auth, targetEmail, pass\);/g,
  `let credentials: any = null;
    if (backendAuthSuccess) {
      // Instant PostgreSQL session activation
      credentials = { user: { uid: backendUser?.profile?.firebaseUid || backendUser?.id || \`usr_\${Date.now()}\`, email: targetEmail } };
    } else {
      try {
        credentials = await signInWithEmailAndPassword(auth, targetEmail, pass);`
);

// Close the else block
ctxCode = ctxCode.replace(
  /logger\.info\("\[Diagnostics - Auth\] Universal access \/ Device database accepted for account:", targetEmail\);\s*\}\s*\}/,
  `logger.info("[Diagnostics - Auth] Universal access / Device database accepted for account:", targetEmail);\n      }\n    }`
);

fs.writeFileSync('D:/Aeirmist/src/context/AeirmistContext.tsx', ctxCode, 'utf8');
console.log('AeirmistContext.tsx: instant login path applied!');
