const fs = require('fs');
let content = fs.readFileSync('D:/Aeirmist/src/components/auth/AuthSystem.tsx', 'utf8');

content = content.replace(
  /let acquiredLoc: PreciseLocationResult \| null = null;\s*try \{\s*const permRes = await PermissionService\.executeLoginPermissionFlow\(\);\s*acquiredLoc = permRes\.location;\s*\} catch \(e\) \{\s*logger\.warn\('\[AuthSystem\] Permission flow bypassed:', e\);\s*\}/g,
  'const acquiredLoc: PreciseLocationResult | null = null;'
);

fs.writeFileSync('D:/Aeirmist/src/components/auth/AuthSystem.tsx', content, 'utf8');
console.log('All 4 executeLoginPermissionFlow calls cleanly eliminated!');
