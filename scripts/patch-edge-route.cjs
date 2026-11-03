const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../functions/api/[[route]].ts');
let content = fs.readFileSync(file, 'utf8');

const targetPattern = /const conv = \{\s*id: convId,\s*type: "group",[\s\S]*?edgeConversations\.unshift\(conv\);/;

const replacement = `const convType = body.type || "group";
      const creatorName = authUser.displayName || authUser.username || "Admin";
      const channelLabel = convType === 'community' ? 'community' : convType === 'team' ? 'team' : 'group';
      const creationText = \`\${creatorName} created the \${channelLabel} "\${body.title || 'Group Chat'}".\`;

      const conv = {
        id: convId,
        type: convType,
        title: body.title || "Group Chat",
        avatarKey: body.avatarKey || "",
        lastMessagePreview: creationText,
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentId,
        owner: currentId,
        admins: [currentId],
        participants
      };
      edgeConversations.unshift(conv);

      const initialSysMsg = {
        id: \`sys_\${Date.now()}\`,
        conversationId: convId,
        senderId: "system",
        senderUid: "system",
        senderName: "Aeirmist",
        type: "system",
        text: creationText,
        timestamp: new Date().toISOString(),
        timestampMs: Date.now(),
        createdAt: new Date().toISOString()
      };
      edgeMessagesMap.set(convId, [initialSysMsg]);`;

if (!targetPattern.test(content)) {
  console.error('Target pattern not found in [[route]].ts');
  process.exit(1);
}
content = content.replace(targetPattern, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched functions/api/[[route]].ts!');
