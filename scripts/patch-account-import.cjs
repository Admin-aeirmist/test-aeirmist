const fs = require('fs');

const path = 'D:/Aeirmist/src/components/settings/sections/AccountSettings.tsx';
let content = fs.readFileSync(path, 'utf8');

const isCRLF = content.includes('\r\n');
if (isCRLF) {
  content = content.replace(/\r\n/g, '\n');
}

const target = `  Heart, Users, Lock, ChevronDown, ChevronRight, ChevronLeft, Clock, PauseCircle, UserX, Edit2`;
const replacement = `  Heart, Users, Lock, ChevronDown, ChevronRight, ChevronLeft, Clock, PauseCircle, UserX, Edit2, Briefcase`;

if (!content.includes(target)) {
  console.error('Target not found for Briefcase import!');
  process.exit(1);
}

content = content.replace(target, replacement);

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Briefcase import added.');
