const fs = require('fs');
let authCode = fs.readFileSync('D:/Aeirmist/src/components/auth/AuthSystem.tsx', 'utf8');

authCode = authCode.replace(
  /\/\/ Phase 3 & 4 & 5: Check & request location[\s\S]*?const userCredential = await loginWithEmail\(identifier, password, true, acquiredLoc\);/,
  `// Instant direct login without blocking for permissions
    try {
      const userCredential = await loginWithEmail(identifier, password, true, null);`
);

fs.writeFileSync('D:/Aeirmist/src/components/auth/AuthSystem.tsx', authCode, 'utf8');
console.log('PermissionService removed completely with regex!');
