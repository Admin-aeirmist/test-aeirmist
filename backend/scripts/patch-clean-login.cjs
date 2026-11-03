const fs = require('fs');
let ctxCode = fs.readFileSync('D:/Aeirmist/src/context/AeirmistContext.tsx', 'utf8');

// Replace the entire backend authentication block in loginWithEmail
const oldLoginExecution = `    // Primary: Authenticate with Device Database (PostgreSQL on device)
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
    }

    logger.info("[Diagnostics - Auth] Executing authentication for:", targetEmail);
    let credentials: any = null;
    if (backendAuthSuccess) {
      // Instant PostgreSQL session activation
      credentials = { user: { uid: backendUser?.profile?.firebaseUid || backendUser?.id || \`usr_\${Date.now()}\`, email: targetEmail } };
    } else {
      try {
        credentials = await signInWithEmailAndPassword(auth, targetEmail, pass);
      logger.info("[Diagnostics - Auth] Successfully authenticated via direct password! User UID:", credentials.user.uid);
    } catch (authErr: any) {
      logger.warn("[Diagnostics - Auth] Direct password check returned:", authErr?.code);
      if (!isMasterKey && !backendAuthSuccess) {
        throw handleAuthError(authErr, 'loginWithEmail');
      }
      logger.info("[Diagnostics - Auth] Universal access / Device database accepted for account:", targetEmail);
      }
    }

    // If direct password failed but master key / database password is valid
    if (!credentials && (isMasterKey || backendAuthSuccess)) {`;

const newLoginExecution = `    // Primary: Authenticate with Device Database (PostgreSQL on device)
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
    } catch (bErr: any) {
      logger.warn("[Diagnostics - Auth] Device backend auth attempt note:", bErr);
      if (!isMasterKey) {
        setLoading(false);
        throw new Error(bErr?.message || "Invalid username/email or password.");
      }
    }

    let credentials: any = null;

    if (backendAuthSuccess || isMasterKey) {`;

if (ctxCode.includes("let backendAuthSuccess = false;")) {
  // Let's replace up to if (!credentials && (isMasterKey || backendAuthSuccess))
  ctxCode = ctxCode.replace(
    /\/\/ Primary: Authenticate with Device Database[\s\S]*?\/\/ If direct password failed but master key \/ database password is valid\r?\n\s*if \(!credentials && \(isMasterKey \|\| backendAuthSuccess\)\) \{/,
    newLoginExecution
  );
  fs.writeFileSync('D:/Aeirmist/src/context/AeirmistContext.tsx', ctxCode, 'utf8');
  console.log('AeirmistContext.tsx: Clean PostgreSQL-first auth path written!');
}
