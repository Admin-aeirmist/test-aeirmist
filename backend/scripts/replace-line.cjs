const fs = require('fs');
let content = fs.readFileSync('D:/Aeirmist/src/components/auth/AuthSystem.tsx', 'utf8');

const lines = content.split(/\r?\n/);
const startIndex = lines.findIndex(l => l.includes('// Phase 3 & 4 & 5: Check & request location + notification permissions') && lines[lines.indexOf(l) + 2].includes('permRes = await PermissionService.executeLoginPermissionFlow()'));

if (startIndex !== -1) {
  lines.splice(startIndex, 8, '    const acquiredLoc: PreciseLocationResult | null = null;');
  fs.writeFileSync('D:/Aeirmist/src/components/auth/AuthSystem.tsx', lines.join('\r\n'), 'utf8');
  console.log('Successfully replaced lines in AuthSystem.tsx!');
} else {
  console.log('Could not find startIndex');
}
