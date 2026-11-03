const fs = require('fs');
const path = require('path');

// 1. GroupCreationModal.tsx
const modalPath = path.join(__dirname, '../src/components/messenger/GroupCreationModal.tsx');
let modal = fs.readFileSync(modalPath, 'utf8').replace(/\r\n/g, '\n');

const oldHandleCreate = `  const handleCreate = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || !profile) return;
    setIsLoading(true);
    try {
      const selectedMemberObjects = selectedMembers.map(id => availablePeople.find(p => p.id === id) || { id, displayName: id });
      const selectedMemberUids = selectedMemberObjects.map(p => p.uid || p.ownerUid || p.id);
      const creatorDisplayName = profile.displayName || profile.username || 'Admin';
      const typeLabel = selectedType === 'community' ? 'Community' : selectedType === 'team' ? 'Team' : 'Group';

      const newGroupId = await messagingService.createGroupConversation(
        db, 
        profile.id, 
        selectedMembers, 
        groupName.trim(), 
        groupPhoto || undefined,
        user?.uid || profile.id,
        selectedMemberUids
      );

      const now = Date.now();
      const formattedDate = new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedTime = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Messenger-style Creation System Message
      const creationSystemText = \`\${creatorDisplayName} created the \${typeLabel.toLowerCase()} "\${groupName.trim()}".\`;
      const memberNamesText = selectedMemberObjects.map(m => m.displayName || m.username || 'Member').slice(0, 3).join(', ') + 
        (selectedMemberObjects.length > 3 ? \` and \${selectedMemberObjects.length - 3} others\` : '');
      const membersJoinedText = \`\${creatorDisplayName} added \${memberNamesText}.\`;

      // Persist System Event in backend / Firestore
      try {
        await messagingService.sendSystemEvent(db, newGroupId, creationSystemText);
        await messagingService.sendSystemEvent(db, newGroupId, membersJoinedText);
      } catch (e) {
        logger.warn('Failed to send creation system messages:', e);
      }

      addToast({ 
        title: \`\${typeLabel} Created!\`, 
        message: \`"\${groupName.trim()}" is ready. You are the Admin.\`, 
        type: 'success' 
      });
      
      const newGroupData = {
        id: newGroupId,
        name: groupName.trim(),
        groupName: groupName.trim(),
        type: selectedType,
        isGroup: true,
        photo: groupPhoto || '',
        groupPhotoURL: groupPhoto || '',
        createdBy: profile.id,
        owner: profile.id,
        admins: [profile.id, user?.uid || profile.id],
        profileIds: [profile.id, ...selectedMembers],
        participants: [user?.uid || profile.id, ...selectedMemberUids],
        createdAt: now,
        updatedAt: now,
        lastMessage: creationSystemText,
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

const newHandleCreate = `  const getCleanHandle = (p: any): string => {
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
      const cleanGroupName = groupName.trim();
      const selectedMemberObjects = selectedMembers.map(id => availablePeople.find(p => p.id === id) || { id, displayName: id });
      const selectedMemberUids = selectedMemberObjects.map(p => p.uid || p.ownerUid || p.id);
      const creatorDisplayName = profile.displayName || profile.username || 'Admin';
      const typeLabel = selectedType === 'community' ? 'Community' : selectedType === 'team' ? 'Team' : 'Group';

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

      // Instant group creation: writes to Firestore + Backend API concurrently with 3s timeout
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

      // Persist System Events asynchronously without blocking UI
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

if (modal.includes(oldHandleCreate)) {
  modal = modal.replace(oldHandleCreate, newHandleCreate);
  fs.writeFileSync(modalPath, modal, 'utf8');
  console.log('Successfully updated GroupCreationModal.tsx handleCreate!');
} else {
  console.warn('oldHandleCreate not matched in GroupCreationModal.tsx');
}

// 2. Messenger.tsx Header Title
const messengerPath = path.join(__dirname, '../src/components/Messenger.tsx');
let messenger = fs.readFileSync(messengerPath, 'utf8').replace(/\r\n/g, '\n');

const oldHeaderTitle = `<h3 className={\`font-semibold text-base md:text-lg tracking-tight group-hover:text-aeirmist-cyan transition-colors truncate \${isVaultMode ? 'text-[#e2afff]' : ''}\`}>
                {isMySpace ? 'My Space' : (isSelfChat ? 'Note to self' : (chat?.isGroup ? chat.name : (isOtherUnavailable ? 'Aeirmist User' : <LiveParticipantName participantId={chat.otherParticipantId || ''} fallbackName={chat.name || ''} chatId={chat.id} />)))}
              </h3>`;

const newHeaderTitle = `<h3 className={\`font-semibold text-base md:text-lg tracking-tight group-hover:text-aeirmist-cyan transition-colors truncate \${isVaultMode ? 'text-[#e2afff]' : ''}\`}>
                {isMySpace 
                  ? 'My Space' 
                  : isSelfChat 
                    ? 'Note to self' 
                    : (isGroupChat || chat?.isGroup || chat?.type === 'group' || chat?.type === 'community' || chat?.type === 'team')
                      ? (chat.groupName || chat.name || (chat as any).title || 'Group Chat')
                      : (isOtherUnavailable 
                          ? 'Aeirmist User' 
                          : <LiveParticipantName participantId={chat.otherParticipantId || ''} fallbackName={chat.name || ''} chatId={chat.id} />
                        )
                }
              </h3>`;

if (messenger.includes(oldHeaderTitle)) {
  messenger = messenger.replace(oldHeaderTitle, newHeaderTitle);
  fs.writeFileSync(messengerPath, messenger, 'utf8');
  console.log('Successfully updated Messenger.tsx header title!');
} else {
  console.warn('oldHeaderTitle not matched in Messenger.tsx');
}

// 3. GroupInfoPanel.tsx
const infoPath = path.join(__dirname, '../src/components/messenger/GroupInfoPanel.tsx');
let info = fs.readFileSync(infoPath, 'utf8').replace(/\r\n/g, '\n');

const oldResolved = `  const resolvedMembers = useMemo(() => {
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

const newResolved = `  const resolvedMembers = useMemo(() => {
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

if (info.includes(oldResolved)) {
  info = info.replace(oldResolved, newResolved);
  fs.writeFileSync(infoPath, info, 'utf8');
  console.log('Successfully updated GroupInfoPanel.tsx resolvedMembers!');
} else {
  console.warn('oldResolved not matched in GroupInfoPanel.tsx');
}
