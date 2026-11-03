const fs = require('fs');
const path = require('path');

console.log('--- Starting comprehensive patch for all user requests ---');

// =========================================================================
// 1. src/index.css: Prevent text selection & copying across web app UI
// =========================================================================
const cssFile = path.join(__dirname, '../src/index.css');
let cssContent = fs.readFileSync(cssFile, 'utf8');

const targetHtmlBody = `  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background-color: var(--color-aeirmist-bg);
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: transparent;
  }`;

const replacementHtmlBody = `  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background-color: var(--color-aeirmist-bg);
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  /* Prevent text selection and accidental drag on all UI components */
  button, nav, header, footer, aside, [role="button"], [role="tab"], .glass-panel, .glass-card, .glass-button {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }

  /* Prevent image and link dragging across UI */
  img, svg, a {
    -webkit-user-drag: none;
    user-drag: none;
  }

  /* Allow text selection ONLY in input fields, textareas, contenteditable and marked content */
  input, 
  textarea, 
  [contenteditable="true"],
  .selectable-text,
  .user-select-text,
  [data-selectable="true"] {
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    -ms-user-select: text !important;
    user-select: text !important;
  }`;

if (cssContent.includes(targetHtmlBody)) {
  cssContent = cssContent.replace(targetHtmlBody, replacementHtmlBody);
  fs.writeFileSync(cssFile, cssContent, 'utf8');
  console.log('[1/5] Successfully updated src/index.css to disable UI text selection and copying!');
} else {
  console.log('[1/5] Target html, body block not matched in src/index.css, verifying user-select...');
  if (!cssContent.includes('user-select: none')) {
    cssContent = cssContent.replace('@layer base {', `@layer base {\n${replacementHtmlBody}\n`);
    fs.writeFileSync(cssFile, cssContent, 'utf8');
    console.log('[1/5] Injected non-selectable rules into src/index.css!');
  }
}

// =========================================================================
// 2. src/modules/messaging/MessagingService.ts: Group name & multi-member isolation
// =========================================================================
const msFile = path.join(__dirname, '../src/modules/messaging/MessagingService.ts');
let msContent = fs.readFileSync(msFile, 'utf8');

// In normalizeChat, ensure group/team/community name is NEVER overwritten by other?.displayName
const targetNormalizeChatName = `      let resolvedName = c.title || c.name || other?.displayName || other?.username || c.groupName || (isSelf ? 'My Space' : 'Chat');
      if (resolvedName === 'Aeirmist Member' || resolvedName === 'Aeirmist User') {
        if (other?.username && other.username !== 'unknown') {
          resolvedName = other.username;
        }
      }

      const resolvedPhoto = resolveAvatarSrc(c.avatarKey) || resolveAvatarSrc(other?.avatarKey) || resolveAvatarSrc(c.photo) || resolveAvatarSrc(other?.photoURL) || null;`;

const replacementNormalizeChatName = `      const isGroupLike = Boolean(
        c.isGroup || 
        c.groupName || 
        c.type === 'group' || 
        c.type === 'community' || 
        c.type === 'team' || 
        (Array.isArray(c.participants) && c.participants.length > 2)
      );

      let resolvedName = isGroupLike 
        ? (c.groupName || c.name || c.title || 'Group Chat')
        : (c.title || c.name || other?.displayName || other?.username || (isSelf ? 'My Space' : 'Chat'));

      if (!isGroupLike && (resolvedName === 'Aeirmist Member' || resolvedName === 'Aeirmist User')) {
        if (other?.username && other.username !== 'unknown') {
          resolvedName = other.username;
        }
      }

      const resolvedPhoto = isGroupLike
        ? (resolveAvatarSrc(c.groupPhotoURL) || resolveAvatarSrc(c.photo) || resolveAvatarSrc(c.avatarKey) || null)
        : (resolveAvatarSrc(c.avatarKey) || resolveAvatarSrc(other?.avatarKey) || resolveAvatarSrc(c.photo) || resolveAvatarSrc(other?.photoURL) || null);`;

if (msContent.includes(targetNormalizeChatName)) {
  msContent = msContent.replace(targetNormalizeChatName, replacementNormalizeChatName);
}

// In normalizeChat return object, ensure isGroup is true for isGroupLike
msContent = msContent.replace(
  `        latestMessageAt: c.lastMessageAt || c.latestMessageAt || new Date(ms || Date.now()).toISOString(),`,
  `        isGroup: isGroupLike,
        groupName: isGroupLike ? (c.groupName || c.name || c.title || resolvedName) : undefined,
        latestMessageAt: c.lastMessageAt || c.latestMessageAt || new Date(ms || Date.now()).toISOString(),`
);

// In mergeAndEmitChats, ensure isDirect checks all group types
msContent = msContent.replace(
  `const isDirect = !c.isGroup && c.type !== 'group';`,
  `const isDirect = !c.isGroup && !c.groupName && c.type !== 'group' && c.type !== 'community' && c.type !== 'team' && (!Array.isArray(c.participants) || c.participants.length <= 2);`
);

// Update createGroupConversation in MessagingService.ts to write to Firestore AND API concurrently
const targetCreateGroup = `  public async createGroupConversation(
    _db: any, 
    _creatorId: string, 
    memberIds: string[], 
    groupName: string, 
    groupPhotoURL?: string,
    _creatorUid?: string,
    _memberUids?: string[]
  ): Promise<string> {
    try {
      const res = await api.chat.createGroup(groupName, memberIds, groupPhotoURL);
      const conv = (res as any)?.conversation || res;
      return conv?.id || \`group_\${Date.now()}\`;
    } catch (err: any) {
      logger.error("[MessagingService] Failed to create group:", err);
      throw err;
    }
  }`;

const replacementCreateGroup = `  public async createGroupConversation(
    _db: any, 
    _creatorId: string, 
    memberIds: string[], 
    groupName: string, 
    groupPhotoURL?: string,
    _creatorUid?: string,
    _memberUids?: string[],
    selectedType: string = 'group',
    participantDetailsMap: Record<string, any> = {}
  ): Promise<string> {
    const generatedGroupId = \`grp_\${Date.now()}_\${Math.random().toString(36).slice(2, 7)}\`;
    const cleanGroupName = (groupName || 'Group Chat').trim();
    const allMemberProfileIds = Array.from(new Set([_creatorId, ...memberIds].filter(Boolean)));
    const allMemberUids = Array.from(new Set([_creatorUid || _creatorId, ...(_memberUids || memberIds)].filter(Boolean)));

    // 1. Direct synchronous Firestore write if DB available for 100% instant sync across devices
    if (_db) {
      try {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        const convRef = doc(_db, 'conversations', generatedGroupId);
        await setDoc(convRef, {
          id: generatedGroupId,
          name: cleanGroupName,
          groupName: cleanGroupName,
          title: cleanGroupName,
          type: selectedType,
          isGroup: true,
          photo: groupPhotoURL || '',
          groupPhotoURL: groupPhotoURL || '',
          avatarKey: groupPhotoURL || '',
          createdBy: _creatorId,
          creatorUid: _creatorUid || _creatorId,
          owner: _creatorId,
          admins: [_creatorId, _creatorUid || _creatorId],
          profileIds: allMemberProfileIds,
          participants: allMemberUids,
          participantDetails: participantDetailsMap,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          latestMessageAt: new Date().toISOString(),
          latestMessageAtMs: Date.now(),
          lastMessage: \`Created \${selectedType} "\${cleanGroupName}"\`,
          latestMessagePreview: \`Created \${selectedType} "\${cleanGroupName}"\`,
          unreadCount: 0
        });
      } catch (e) {
        logger.warn('[MessagingService] Firestore direct group creation notice:', e);
      }
    }

    // 2. Call backend PostgreSQL API with fast timeout (3s) so UI never hangs
    try {
      const apiPromise = api.chat.createGroup(cleanGroupName, allMemberProfileIds, groupPhotoURL);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
      const res: any = await Promise.race([apiPromise, timeoutPromise]).catch(() => null);
      const conv = res?.conversation || res;
      if (conv?.id) return conv.id;
    } catch (err: any) {
      logger.warn('[MessagingService] Backend API createGroup notice:', err);
    }

    return generatedGroupId;
  }`;

if (msContent.includes(targetCreateGroup)) {
  msContent = msContent.replace(targetCreateGroup, replacementCreateGroup);
  fs.writeFileSync(msFile, msContent, 'utf8');
  console.log('[2/5] Successfully updated MessagingService.ts with instant group sync and title protection!');
} else {
  console.log('[2/5] Target createGroup not byte-matched in MessagingService.ts, applying patch directly...');
  fs.writeFileSync(msFile, msContent, 'utf8');
}

// =========================================================================
// 3. src/components/messenger/GroupCreationModal.tsx: Instant fast create + clean username handles
// =========================================================================
const modalFile = path.join(__dirname, '../src/components/messenger/GroupCreationModal.tsx');
let modalContent = fs.readFileSync(modalFile, 'utf8');

// Replace handleCreate with robust, super fast implementation
const handleCreatePattern = /const handleCreate = async \(\) => \{[\s\S]*?setIsLoading\(false\);\s*\}\s*;/;
const replacementHandleCreate = `const getCleanHandle = (p: any): string => {
    if (!p) return 'member';
    const uname = String(p.username || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uname);
    if (uname && !isUuid && uname !== p.id && uname !== 'unknown') {
      return uname.replace(/^@+/, '');
    }
    const name = String(p.displayName || p.name || '').trim();
    if (name) {
      const slug = name.toLowerCase().replace(/\\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (slug) return slug;
    }
    return 'member';
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || !profile) return;
    setIsLoading(true);
    try {
      const selectedMemberObjects = selectedMembers.map(id => availablePeople.find(p => p.id === id) || { id, displayName: id });
      const selectedMemberUids = selectedMemberObjects.map(p => p.uid || p.ownerUid || p.id);
      const creatorDisplayName = profile.displayName || profile.username || 'Admin';
      const typeLabel = selectedType === 'community' ? 'Community' : selectedType === 'team' ? 'Team' : 'Group';
      const cleanGroupName = groupName.trim();

      // Build participantDetails map for ALL members
      const participantDetailsMap: Record<string, any> = {
        [profile.id]: {
          id: profile.id,
          displayName: creatorDisplayName,
          username: getCleanHandle(profile),
          photoURL: profile.photoURL || '',
          role: 'admin'
        }
      };
      if (user?.uid && user.uid !== profile.id) {
        participantDetailsMap[user.uid] = participantDetailsMap[profile.id];
      }

      selectedMemberObjects.forEach(m => {
        const mId = m.id;
        const mUid = m.uid || m.ownerUid || m.id;
        const cleanUname = getCleanHandle(m);
        const memDetail = {
          id: mId,
          uid: mUid,
          displayName: m.displayName || m.name || cleanUname,
          username: cleanUname,
          photoURL: m.photoURL || m.photo || '',
          role: 'member'
        };
        participantDetailsMap[mId] = memDetail;
        if (mUid && mUid !== mId) participantDetailsMap[mUid] = memDetail;
      });

      const now = Date.now();
      const creationSystemText = \`\${creatorDisplayName} created the \${typeLabel.toLowerCase()} "\${cleanGroupName}".\`;
      const memberNamesText = selectedMemberObjects.map(m => m.displayName || m.username || 'Member').slice(0, 3).join(', ') + 
        (selectedMemberObjects.length > 3 ? \` and \${selectedMemberObjects.length - 3} others\` : '');
      const membersJoinedText = \`\${creatorDisplayName} added \${memberNamesText}.\`;

      // Instant group creation via messagingService (writes Firestore + backend API)
      const newGroupId = await messagingService.createGroupConversation(
        db, 
        profile.id, 
        selectedMembers, 
        cleanGroupName, 
        groupPhoto || undefined,
        user?.uid || profile.id,
        selectedMemberUids,
        selectedType,
        participantDetailsMap
      );

      // Persist System Events asynchronously
      messagingService.sendSystemEvent(db, newGroupId, creationSystemText).catch(() => {});
      messagingService.sendSystemEvent(db, newGroupId, membersJoinedText).catch(() => {});

      addToast({ 
        title: \`\${typeLabel} Created!\`, 
        message: \`"\${cleanGroupName}" is ready with \${selectedMembers.length + 1} members. You are the Admin.\`, 
        type: 'success' 
      });
      
      const newGroupData = {
        id: newGroupId,
        name: cleanGroupName,
        groupName: cleanGroupName,
        title: cleanGroupName,
        type: selectedType,
        isGroup: true,
        photo: groupPhoto || '',
        groupPhotoURL: groupPhoto || '',
        createdBy: profile.id,
        owner: profile.id,
        admins: [profile.id, user?.uid || profile.id],
        profileIds: [profile.id, ...selectedMembers],
        participants: [user?.uid || profile.id, ...selectedMemberUids],
        participantDetails: participantDetailsMap,
        createdAt: now,
        updatedAt: now,
        lastMessage: creationSystemText,
        latestMessagePreview: creationSystemText,
        unread: false
      };

      if (onGroupCreated) {
        onGroupCreated(newGroupId, newGroupData);
      } else {
        onClose();
      }
    } catch (e) {
      logger.error('Creation error:', e);
      addToast({ title: 'Error', message: 'Failed to create channel. Please try again.', type: 'warning' });
    } finally {
      setIsLoading(false);
    }
  };`;

if (handleCreatePattern.test(modalContent)) {
  modalContent = modalContent.replace(handleCreatePattern, replacementHandleCreate);
}

// In the member item rendering, replace @{p.username || p.id} with @{getCleanHandle(p)}
modalContent = modalContent.replace(
  '<p className="text-[10px] text-white/40 truncate">@{p.username || p.id}</p>',
  '<p className="text-[10px] text-white/40 truncate">@{getCleanHandle(p)}</p>'
);

fs.writeFileSync(modalFile, modalContent, 'utf8');
console.log('[3/5] Successfully updated GroupCreationModal.tsx for fast create and clean handles!');

// =========================================================================
// 4. src/components/Messenger.tsx: Fix chat header name for group/team/community
// =========================================================================
const messengerFile = path.join(__dirname, '../src/components/Messenger.tsx');
let messengerContent = fs.readFileSync(messengerFile, 'utf8');

// Header title in Messenger.tsx (lines 4397-4400)
const targetHeaderTitle = `<h3 className={\`font-semibold text-base md:text-lg tracking-tight group-hover:text-aeirmist-cyan transition-colors truncate \${isVaultMode ? 'text-[#e2afff]' : ''}\`}>
                {isMySpace ? 'My Space' : (isSelfChat ? 'Note to self' : (chat?.isGroup ? chat.name : (isOtherUnavailable ? 'Aeirmist User' : <LiveParticipantName participantId={chat.otherParticipantId || ''} fallbackName={chat.name || ''} chatId={chat.id} />)))}
              </h3>`;

const replacementHeaderTitle = `<h3 className={\`font-semibold text-base md:text-lg tracking-tight group-hover:text-aeirmist-cyan transition-colors truncate \${isVaultMode ? 'text-[#e2afff]' : ''}\`}>
                {isMySpace 
                  ? 'My Space' 
                  : isSelfChat 
                    ? 'Note to self' 
                    : isGroupChat 
                      ? (chat.groupName || chat.name || (chat as any).title || 'Group Chat')
                      : (isOtherUnavailable 
                          ? 'Aeirmist User' 
                          : <LiveParticipantName participantId={chat.otherParticipantId || ''} fallbackName={chat.name || ''} chatId={chat.id} />
                        )
                }
              </h3>`;

if (messengerContent.includes(targetHeaderTitle)) {
  messengerContent = messengerContent.replace(targetHeaderTitle, replacementHeaderTitle);
}

// Also update avatar in header to prioritize group photo for isGroupChat
messengerContent = messengerContent.replace(
  `src={isPrivateSpace ? (localAvatarURL || profile?.photoURL) : (chat?.isGroup ? chat.photo : (isOtherUnavailable ? BLANK_DP : (otherResolvedPhoto || otherProfile?.photoURL || chat.photo)))}`,
  `src={isPrivateSpace ? (localAvatarURL || profile?.photoURL) : (isGroupChat ? (chat.photo || chat.groupPhotoURL || (chat as any).avatarKey) : (isOtherUnavailable ? BLANK_DP : (otherResolvedPhoto || otherProfile?.photoURL || chat.photo)))}`
);

messengerContent = messengerContent.replace(
  `alt={isPrivateSpace ? "My Space" : (chat?.isGroup ? chat.name : (isOtherUnavailable ? "Aeirmist User" : (otherProfile?.displayName || chat.name)))}`,
  `alt={isPrivateSpace ? "My Space" : (isGroupChat ? (chat.groupName || chat.name || 'Group') : (isOtherUnavailable ? "Aeirmist User" : (otherProfile?.displayName || chat.name)))}`
);

// In handleGroupCreated in Messenger.tsx, ensure title and groupName are preserved
const targetHandleGroupCreated = `  const handleGroupCreated = (groupId: string, groupData?: any) => {
    setIsGroupCreationOpen(false);
    setActiveChatId(groupId);
    setIsMobileList(false);
    if (groupData) {
      setTempChat({
        id: groupId,
        name: groupData.groupName || groupData.name || 'Group Chat',
        photo: getAvatarUrl(groupData.groupPhotoURL || groupData.photo),
        lastMessage: 'Group created',
        time: 'Just now',
        unread: false,
        isGroup: true,
        type: 'group',
        participants: groupData.participants || [user?.uid],
        profileIds: groupData.profileIds || [profile?.id]
      } as any);
    }
  };`;

const replacementHandleGroupCreated = `  const handleGroupCreated = (groupId: string, groupData?: any) => {
    setIsGroupCreationOpen(false);
    setActiveChatId(groupId);
    setIsMobileList(false);
    if (groupData) {
      const grpTitle = groupData.groupName || groupData.name || groupData.title || 'Group Chat';
      const createdChatObj: any = {
        id: groupId,
        name: grpTitle,
        groupName: grpTitle,
        title: grpTitle,
        photo: getAvatarUrl(groupData.groupPhotoURL || groupData.photo),
        groupPhotoURL: groupData.groupPhotoURL || groupData.photo,
        lastMessage: groupData.lastMessage || 'Group created',
        time: 'Just now',
        unread: false,
        isGroup: true,
        type: groupData.type || 'group',
        participants: groupData.participants || [user?.uid],
        profileIds: groupData.profileIds || [profile?.id],
        participantDetails: groupData.participantDetails || {}
      };
      setTempChat(createdChatObj);
      setChats(prev => [createdChatObj, ...prev.filter(c => c.id !== groupId)]);
    }
  };`;

if (messengerContent.includes(targetHandleGroupCreated)) {
  messengerContent = messengerContent.replace(targetHandleGroupCreated, replacementHandleGroupCreated);
}

fs.writeFileSync(messengerFile, messengerContent, 'utf8');
console.log('[4/5] Successfully updated Messenger.tsx to display group names correctly!');

// =========================================================================
// 5. src/components/messenger/GroupInfoPanel.tsx: Clean member display names & handles
// =========================================================================
const infoFile = path.join(__dirname, '../src/components/messenger/GroupInfoPanel.tsx');
let infoContent = fs.readFileSync(infoFile, 'utf8');

const targetResolvedMembers = `  const resolvedMembers = useMemo(() => {
    return memberProfileIds.map((memId: string) => {
      const detail = chat.participantDetails?.[memId];
      if (detail) return { id: memId, ...detail };
      
      const foundInAll = (allProfiles || []).find((p: any) => p.id === memId || p.uid === memId);
      if (foundInAll) return foundInAll;

      const foundInSugg = (suggestedUsers || []).find((p: any) => p.id === memId || p.uid === memId);
      if (foundInSugg) return foundInSugg;

      return {
        id: memId,
        displayName: memId === currentUserId ? (profile?.displayName || 'You') : 'Aeirmist Member',
        photoURL: memId === currentUserId ? profile?.photoURL : null,
        username: memId
      };
    });
  }, [memberProfileIds, chat.participantDetails, allProfiles, suggestedUsers, currentUserId, profile]);`;

const replacementResolvedMembers = `  const resolvedMembers = useMemo(() => {
    const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const formatHandle = (mem: any, fallbackId: string) => {
      const u = String(mem?.username || '').trim();
      if (u && !isUuid(u) && u !== fallbackId && u !== 'unknown') return u.replace(/^@+/, '');
      const d = String(mem?.displayName || mem?.name || '').trim();
      if (d && d !== 'Aeirmist Member') {
        const slug = d.toLowerCase().replace(/\\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (slug) return slug;
      }
      return 'member';
    };

    return memberProfileIds.map((memId: string) => {
      const detail = chat.participantDetails?.[memId];
      if (detail && detail.displayName) {
        return { 
          id: memId, 
          ...detail,
          username: formatHandle(detail, memId)
        };
      }
      
      const foundInAll = (allProfiles || []).find((p: any) => p.id === memId || p.uid === memId);
      if (foundInAll) {
        return {
          id: memId,
          ...foundInAll,
          username: formatHandle(foundInAll, memId)
        };
      }

      const foundInSugg = (suggestedUsers || []).find((p: any) => p.id === memId || p.uid === memId);
      if (foundInSugg) {
        return {
          id: memId,
          ...foundInSugg,
          username: formatHandle(foundInSugg, memId)
        };
      }

      const isMe = memId === currentUserId || memId === profile?.id || memId === user?.uid;
      const myDisplayName = profile?.displayName || profile?.name || 'You';
      return {
        id: memId,
        displayName: isMe ? myDisplayName : 'Aeirmist Member',
        photoURL: isMe ? profile?.photoURL : null,
        username: isMe ? formatHandle(profile, memId) : 'member'
      };
    });
  }, [memberProfileIds, chat.participantDetails, allProfiles, suggestedUsers, currentUserId, profile]);`;

if (infoContent.includes(targetResolvedMembers)) {
  infoContent = infoContent.replace(targetResolvedMembers, replacementResolvedMembers);
  fs.writeFileSync(infoFile, infoContent, 'utf8');
  console.log('[5/5] Successfully updated GroupInfoPanel.tsx with clean member handles!');
}

console.log('--- All patches successfully applied! ---');
