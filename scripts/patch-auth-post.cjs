const fs = require('fs');
const path = require('path');

const authPath = path.resolve('D:/Aeirmist/src/components/auth/AuthSystem.tsx');
let code = fs.readFileSync(authPath, 'utf8');

const targetBlock = `      const userUid = (userCredential as any)?.user?.uid || (userCredential as any)?.uid;
      
      if (userUid) {
        try {
          if (db) {
            const profileSnap = await getDoc(doc(db, 'profiles', \`profile_\${userUid}\`));
            if (profileSnap.exists() && profileSnap.data().twoFactorEnabled) {
              setPendingUserUid(userUid);
              setView('two_factor');
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          logger.warn('[AuthSystem] 2FA check bypassed:', e);
        }
        logger.security("Login Success", { uid: userUid }); 
        try {
          await trackLoginSession(userUid, acquiredLoc);
        } catch (e) {}
      }`;

const replacementBlock = `      const userUid = (userCredential as any)?.user?.uid || (userCredential as any)?.uid;
      if (userUid) {
        logger.security("Login Success", { uid: userUid });
        // Non-blocking session tracking (instant redirect, zero spinner delay)
        trackLoginSession(userUid, acquiredLoc).catch(() => {});
      }`;

if (code.includes(targetBlock)) {
  code = code.replace(targetBlock, replacementBlock);
  fs.writeFileSync(authPath, code, 'utf8');
  console.log('✓ Successfully eliminated blocking Firestore 2FA checks from handleLogin');
} else {
  console.log('Target block not matched exactly, replacing with indexOf');
  const startM = 'const userUid = (userCredential as any)?.user?.uid || (userCredential as any)?.uid;';
  const endM = 'analytics.trackAuth(\'login\', \'email\');';
  const s = code.lastIndexOf(startM);
  const e = code.indexOf(endM, s);
  if (s !== -1 && e !== -1) {
    code = code.substring(0, s) + replacementBlock + '\n\n      ' + code.substring(e);
    fs.writeFileSync(authPath, code, 'utf8');
    console.log('✓ Replaced handleLogin post-auth block cleanly');
  }
}
