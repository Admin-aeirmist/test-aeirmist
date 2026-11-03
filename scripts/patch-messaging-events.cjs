const fs = require('fs');
const path = require('path');

// 1. Patch MessagingService.ts
const serviceFile = path.join(__dirname, '../src/modules/messaging/MessagingService.ts');
let serviceContent = fs.readFileSync(serviceFile, 'utf8');

const targetPattern = /public\s+async\s+sendSystemEvent\s*\(_db:\s*any,\s*conversationId:\s*string,\s*eventText:\s*string\)\s*\{[\s\S]*?logger\.info\([^)]+\);\s*\}/;

const replacementMethods = `public async sendSystemEvent(_db: any, conversationId: string, eventText: string) {
    logger.info(\`[MessagingService] System event for \${conversationId}: \${eventText}\`);
    try {
      await api.chat.sendMessage(conversationId, {
        content: eventText,
        type: 'system',
        metadata: { isSystem: true, eventText }
      });
    } catch (e) {}

    if (_db) {
      try {
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        const msgRef = collection(_db, 'conversations', conversationId, 'messages');
        await addDoc(msgRef, {
          senderId: 'system',
          senderUid: 'system',
          type: 'system',
          text: eventText,
          createdAt: serverTimestamp(),
          timestampMs: Date.now(),
          metadata: { isSystem: true, eventText }
        });
      } catch (e) {}
    }
  }`;

if (targetPattern.test(serviceContent)) {
  serviceContent = serviceContent.replace(targetPattern, replacementMethods);
  fs.writeFileSync(serviceFile, serviceContent, 'utf8');
  console.log("Successfully patched sendSystemEvent in MessagingService.ts!");
} else {
  console.error("sendSystemEvent pattern not matched in MessagingService.ts");
}

// 2. Patch GroupInfoPanel.tsx
const infoPanelFile = path.join(__dirname, '../src/components/messenger/GroupInfoPanel.tsx');
let infoContent = fs.readFileSync(infoPanelFile, 'utf8');

const targetCountPattern = /<p\s+className="text-xs\s+text-white\/50\s+font-medium\s+mt-1">\s*\{resolvedMembers\.length\}[\s\S]*?<\/p>/;

const newCountDisplay = `<div className="flex flex-col items-center gap-1 mt-1 text-center">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                {chat.type === 'community' ? 'Community' : chat.type === 'team' ? 'Team' : 'Group'}
              </span>
              <span className="text-xs text-white/50 font-medium">
                {resolvedMembers.length} {resolvedMembers.length === 1 ? 'member' : 'members'}
              </span>
            </div>
            {(() => {
              const ts = chat.createdAt || chat.timestampMs || chat.created_at;
              if (!ts) return null;
              const d = new Date(typeof ts === 'number' ? ts : (ts.seconds ? ts.seconds * 1000 : ts));
              if (isNaN(d.getTime())) return null;
              return (
                <p className="text-[10px] text-white/40 font-mono mt-0.5">
                  Created on {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              );
            })()}
            {ownerId && (
              <p className="text-[10px] text-white/40 flex items-center gap-1">
                <span>👑 Created by <strong className="text-cyan-400">{resolvedMembers.find(m => (m.id || m.uid) === ownerId)?.displayName || 'Admin'}</strong></span>
              </p>
            )}
          </div>`;

if (targetCountPattern.test(infoContent)) {
  infoContent = infoContent.replace(targetCountPattern, newCountDisplay);
  fs.writeFileSync(infoPanelFile, infoContent, 'utf8');
  console.log("Successfully patched GroupInfoPanel.tsx with creation date/time and creator!");
} else {
  console.error("targetCountPattern not matched in GroupInfoPanel.tsx");
}
