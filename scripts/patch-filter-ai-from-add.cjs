const fs = require('fs');
const path = require('path');

// 1. GroupCreationModal.tsx
const modalFile = path.join(__dirname, '../src/components/messenger/GroupCreationModal.tsx');
let modalContent = fs.readFileSync(modalFile, 'utf8');

const isSystemHelper = `const isSystemOrAiUser = (p: any): boolean => {
  if (!p) return true;
  const id = String(p.id || p.uid || p.userId || '').toLowerCase().trim();
  const username = String(p.username || '').toLowerCase().trim();
  const displayName = String(p.displayName || p.name || '').toLowerCase().trim();
  return (
    id === '00000000-0000-4000-a000-000000000001' ||
    id === 'system' ||
    id === 'era' ||
    id.includes('00000000-0000-4000-a000-000000000001') ||
    username === 'era' ||
    username === 'system' ||
    username.includes('00000000-0000-4000-a000-000000000001') ||
    displayName === 'era ai' ||
    displayName === 'era' ||
    displayName === 'system'
  );
};
`;

if (!modalContent.includes('const isSystemOrAiUser')) {
  // Put before GroupCreationModal component definition
  modalContent = modalContent.replace('export const GroupCreationModal', `${isSystemHelper}\nexport const GroupCreationModal`);
}

// Update chatUsers to skip system/AI
modalContent = modalContent.replace(
  'if (c.participantDetails) {',
  `if (c.participantDetails) {`
);

// Update availablePeople return
modalContent = modalContent.replace(
  'return Array.from(unique.values()).filter(p => p.id !== profile?.id && p.uid !== user?.uid);',
  'return Array.from(unique.values()).filter(p => p.id !== profile?.id && p.uid !== user?.uid && !isSystemOrAiUser(p));'
);

fs.writeFileSync(modalFile, modalContent, 'utf8');
console.log('Successfully updated GroupCreationModal.tsx to exclude Era AI & system users!');

// 2. GroupInfoPanel.tsx
const infoFile = path.join(__dirname, '../src/components/messenger/GroupInfoPanel.tsx');
let infoContent = fs.readFileSync(infoFile, 'utf8');

const isAlreadyMemberPattern = /const isAlreadyMember = \(u: any\) => \{[\s\S]*?\};\s*\};/;

const updatedMemberCheck = `const isAlreadyMember = (u: any) => {
      const uId = u.id;
      const uUid = u.uid;
      const idStr = String(uId || uUid || '').toLowerCase();
      const uname = String(u.username || '').toLowerCase();
      const dname = String(u.displayName || u.name || '').toLowerCase();
      if (
        idStr === '00000000-0000-4000-a000-000000000001' ||
        idStr === 'system' ||
        idStr.includes('00000000-0000-4000-a000-000000000001') ||
        uname === 'era' ||
        uname === 'system' ||
        dname === 'era ai' ||
        dname === 'system'
      ) {
        return true; // Exclude system & Era AI from add candidates
      }
      return (
        (uId && memberProfileIds.includes(uId)) ||
        (uUid && memberProfileIds.includes(uUid)) ||
        (chat.participants && (chat.participants.includes(uId) || chat.participants.includes(uUid)))
      );
    };`;

if (/const isAlreadyMember = \(u: any\) => \{[\s\S]*?\}\s*;/m.test(infoContent)) {
  infoContent = infoContent.replace(/const isAlreadyMember = \(u: any\) => \{[\s\S]*?\}\s*;/m, updatedMemberCheck);
  fs.writeFileSync(infoFile, infoContent, 'utf8');
  console.log('Successfully updated GroupInfoPanel.tsx to exclude Era AI & system users!');
} else {
  console.warn('isAlreadyMember pattern not matched in GroupInfoPanel.tsx');
}

// 3. Messenger.tsx searchUsers exclusion
const messengerFile = path.join(__dirname, '../src/components/Messenger.tsx');
let messengerContent = fs.readFileSync(messengerFile, 'utf8');

messengerContent = messengerContent.replace(
  'setSearchResults(results.filter(r => r.id !== profile?.id));',
  "setSearchResults(results.filter(r => r.id !== profile?.id && r.id !== '00000000-0000-4000-a000-000000000001' && r.id !== 'system' && r.username !== 'era'));"
);

fs.writeFileSync(messengerFile, messengerContent, 'utf8');
console.log('Successfully updated Messenger.tsx to exclude Era AI & system users from search!');
