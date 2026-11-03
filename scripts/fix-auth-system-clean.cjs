const fs = require('fs');
const path = require('path');

const authPath = path.resolve('D:/Aeirmist/src/components/auth/AuthSystem.tsx');
let code = fs.readFileSync(authPath, 'utf8');

// Replace handleLogin post-auth logic
const targetMarker = 'analytics.trackAuth(\'login\', \'email\');';
const endIdx = code.indexOf(targetMarker);

if (endIdx !== -1) {
  const startMarker = 'const userUid = (userCredential as any)?.user?.uid || (userCredential as any)?.uid;';
  const startIdx = code.lastIndexOf(startMarker, endIdx);
  if (startIdx !== -1) {
    const replacement = `const userUid = (userCredential as any)?.user?.uid || (userCredential as any)?.uid;
      if (userUid) {
        logger.security("Login Success", { uid: userUid });
        // Non-blocking background session tracking (zero spinner delay on UI)
        trackLoginSession(userUid, acquiredLoc).catch(() => {});
      }
      `;
    code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
    fs.writeFileSync(authPath, code, 'utf8');
    console.log('✓ Successfully eliminated blocking Firestore 2FA checks from handleLogin');
  } else {
    console.log('startMarker not found');
  }
} else {
  console.log('targetMarker not found');
}
