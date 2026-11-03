const fs = require('fs');
const path = require('path');

console.log('--- Applying Group Chat & Messaging Fixes ---');

// 1. Patch src/services/api/client.ts
const clientPath = path.resolve('src/services/api/client.ts');
let clientContent = fs.readFileSync(clientPath, 'utf8');

const oldClientTarget = `createGroup: (title: string, memberIds: string[], avatarKey?: string) =>
      request<{ conversation: any }>('/api/v1/chat/conversations/group', {
        method: 'POST',
        body: JSON.stringify({ title, memberIds, avatarKey }),
      }),`;

const newClientReplacement = `createGroup: (title: string, memberIds: string[], avatarKey?: string, type?: string, participantDetails?: Record<string, any>) =>
      request<{ conversation: any }>('/api/v1/chat/conversations/group', {
        method: 'POST',
        body: JSON.stringify({ title, memberIds, avatarKey, type, participantDetails }),
      }),`;

if (clientContent.includes('createGroup: (title: string, memberIds: string[], avatarKey?: string)')) {
  clientContent = clientContent.replace(
    /createGroup:\s*\(title:\s*string,\s*memberIds:\s*string\[\],\s*avatarKey\?:\s*string\)\s*=>[\s\S]*?body:\s*JSON\.stringify\(\{\s*title,\s*memberIds,\s*avatarKey\s*\}\),[\s\S]*?\}\),/,
    newClientReplacement
  );
  fs.writeFileSync(clientPath, clientContent, 'utf8');
  console.log('✔ Patched src/services/api/client.ts');
} else {
  console.log('ℹ src/services/api/client.ts already updated or pattern not found');
}

// 2. Patch src/modules/messaging/MessagingService.ts
const msPath = path.resolve('src/modules/messaging/MessagingService.ts');
let msContent = fs.readFileSync(msPath, 'utf8');

const oldMsFuncPattern = /public async createGroupConversation\([\s\S]*?return conv\?\.id \|\| `group_\$\{Date\.now\(\)\}`;[\s\S]*?\} catch \(err: any\) \{[\s\S]*?throw err;[\s\S]*?\}\s*\}/;

const newMsFunc = `public async createGroupConversation(
    db: any, 
    creatorId: string, 
    memberIds: string[], 
    groupName: string, 
    groupPhotoURL?: string,
    creatorUid?: string,
    memberUids?: string[],
    channelType: 'group' | 'community' | 'team' = 'group',
    participantDetailsMap?: Record<string, any>
  ): Promise<string> {
    try {
      const cleanTitle = groupName.trim();
      const allMemberIds = Array.from(new Set([...memberIds]));

      // 1. Call Backend / Cloudflare API with a 3.5s race timeout so UI NEVER hangs
      const apiPromise = api.chat.createGroup(
        cleanTitle, 
        allMemberIds, 
        groupPhotoURL, 
        channelType, 
        participantDetailsMap
      );
      
      const timeoutPromise = new Promise<{ conversation?: any }>((resolve) => {
        setTimeout(() => resolve({ conversation: { id: \`grp_\${Date.now()}\` } }), 3500);
      });

      const res = await Promise.race([apiPromise, timeoutPromise]);
      const conv = (res as any)?.conversation || res;
      const convId = conv?.id || \`group_\${Date.now()}\`;

      // 2. Synchronize to Firestore for real-time delivery to all connected clients
      if (db) {
        try {
          const { doc, setDoc, serverTimestamp, collection, addDoc } = await import('firebase/firestore');
          const convRef = doc(db, 'conversations', convId);
          const typeLabel = channelType === 'community' ? 'community' : channelType === 'team' ? 'team' : 'group';
          const creationSysText = \`\${cleanTitle} created.\`;

          await setDoc(convRef, {
            id: convId,
            name: cleanTitle,
            groupName: cleanTitle,
            title: cleanTitle,
            type: channelType,
            isGroup: true,
            photo: groupPhotoURL || '',
            groupPhotoURL: groupPhotoURL || '',
            createdBy: creatorId,
            owner: creatorId,
            admins: [creatorId, creatorUid || creatorId],
            profileIds: [creatorId, ...allMemberIds],
            participants: [creatorUid || creatorId, ...(memberUids || allMemberIds)],
            participantDetails: participantDetailsMap || {},
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: {
              text: creationSysText,
              timestamp: serverTimestamp(),
              senderId: 'system'
            },
            unread: false
          }, { merge: true });

          const msgsRef = collection(db, 'conversations', convId, 'messages');
          await addDoc(msgsRef, {
            senderId: 'system',
            senderUid: 'system',
            text: creationSysText,
            type: 'system',
            createdAt: serverTimestamp(),
            timestampMs: Date.now()
          });
        } catch (fsErr) {
          logger.warn('[MessagingService] Firestore group dual-write warning:', fsErr);
        }
      }

      return convId;
    } catch (err: any) {
      logger.error("[MessagingService] Failed to create group:", err);
      return \`group_\${Date.now()}\`;
    }
  }`;

if (oldMsFuncPattern.test(msContent)) {
  msContent = msContent.replace(oldMsFuncPattern, newMsFunc);
  fs.writeFileSync(msPath, msContent, 'utf8');
  console.log('✔ Patched src/modules/messaging/MessagingService.ts');
} else {
  console.log('ℹ src/modules/messaging/MessagingService.ts pattern not found or already patched');
}

// 3. Patch functions/api/[[route]].ts
const routePath = path.resolve('functions/api/[[route]].ts');
let routeContent = fs.readFileSync(routePath, 'utf8');

const oldRouteGroupPattern = /if \(path === "\/api\/v1\/chat\/conversations\/group" && method === "POST"\) \{[\s\S]*?return new Response\(JSON\.stringify\(\{ conversation: conv \}\), \{[\s\S]*?status: 201,[\s\S]*?headers: CORS_HEADERS[\s\S]*?\}\);[\s\S]*?\}/;

const newRouteGroupCode = `if (path === "/api/v1/chat/conversations/group" && method === "POST") {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\\s+/i, "").trim();
    const authUser = await parseUserFromToken(token);
    if (!authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
    }
    const currentId = authUser.id || authUser.uid;

    try {
      const body = await request.json() as any;
      const convId = \`conv_grp_\${Date.now()}\`;
      const members = Array.isArray(body.memberIds) ? [...body.memberIds] : [];
      if (!members.includes(currentId)) members.push(currentId);

      const passedDetails = body.participantDetails || {};
      const participants = members.map((mid: string) => {
        const passed = passedDetails[mid] || {};
        const u = usersMap.get(mid) || { id: mid, displayName: mid, username: mid, profile: {} };
        return {
          userId: mid,
          displayName: passed.displayName || u.displayName || u.username || mid,
          username: passed.username || u.username || mid,
          avatarKey: passed.photoURL || passed.photo || u.profile?.avatarKey || "",
          photoURL: passed.photoURL || passed.photo || u.profile?.avatarKey || "",
          isVerified: Boolean(passed.isVerified || u.profile?.isVerified),
          badge: passed.badge || u.profile?.badge || null,
          role: mid === currentId ? 'owner' : (passed.role || 'member')
        };
      });

      const convType = body.type || "group";
      const groupTitle = body.title || "Group Chat";
      const creatorName = authUser.displayName || authUser.username || "Admin";
      const channelLabel = convType === 'community' ? 'community' : convType === 'team' ? 'team' : 'group';
      const creationText = \`\${creatorName} created the \${channelLabel} "\${groupTitle}".\`;

      const conv = {
        id: convId,
        type: convType,
        title: groupTitle,
        name: groupTitle,
        groupName: groupTitle,
        isGroup: true,
        avatarKey: body.avatarKey || body.photo || "",
        photo: body.avatarKey || body.photo || "",
        groupPhotoURL: body.avatarKey || body.photo || "",
        lastMessagePreview: creationText,
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentId,
        owner: currentId,
        admins: [currentId],
        profileIds: members,
        participants,
        participantDetails: passedDetails
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
        createdAt: new Date().toISOString()
      };
      edgeMessages.push(initialSysMsg);

      return new Response(JSON.stringify({ conversation: conv }), {
        status: 201,
        headers: CORS_HEADERS
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Failed to create group" }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }
  }`;

if (oldRouteGroupPattern.test(routeContent)) {
  routeContent = routeContent.replace(oldRouteGroupPattern, newRouteGroupCode);
  fs.writeFileSync(routePath, routeContent, 'utf8');
  console.log('✔ Patched functions/api/[[route]].ts');
} else {
  console.log('ℹ functions/api/[[route]].ts pattern not found or already patched');
}

// 4. Patch backend/src/dal/chat.dal.ts
const dalPath = path.resolve('backend/src/dal/chat.dal.ts');
if (fs.existsSync(dalPath)) {
  let dalContent = fs.readFileSync(dalPath, 'utf8');

  // Update createGroupConversation
  const oldDalCreatePattern = /static async createGroupConversation\(creatorId: string, title: string, memberIds: string\[\], avatarKey\?: string\) \{[\s\S]*?return conv;[\s\S]*?\}/;
  const newDalCreate = `static async createGroupConversation(creatorId: string, title: string, memberIds: string[], avatarKey?: string, type: string = 'group', participantDetails?: Record<string, any>) {
    const [conv] = await db
      .insert(conversations)
      .values({
        type,
        title,
        avatarKey,
      })
      .returning();

    const uniqueMembers = Array.from(new Set([creatorId, ...memberIds]));
    const memberRows = uniqueMembers.map((uid) => ({
      conversationId: conv.id,
      userId: uid,
      role: uid === creatorId ? 'owner' : 'member',
    }));

    await db.insert(conversationMembers).values(memberRows);

    return {
      ...conv,
      name: title,
      groupName: title,
      isGroup: true,
      profileIds: uniqueMembers,
      participantDetails: participantDetails || {}
    };
  }`;

  if (oldDalCreatePattern.test(dalContent)) {
    dalContent = dalContent.replace(oldDalCreatePattern, newDalCreate);
    console.log('✔ Patched ChatDAL.createGroupConversation');
  }

  // Update getUserConversations return object
  const oldDalResultPattern = /result\.push\(\{\s*\.\.\.row\.conversation,\s*unreadCount: row\.member\.unreadCount,[\s\S]*?lastRead,\s*\}\);/;
  const newDalResult = `const isGrp = row.conversation.type === 'group' || row.conversation.type === 'community' || row.conversation.type === 'team';
      result.push({
        ...row.conversation,
        name: isGrp ? (row.conversation.title || 'Group') : (otherParticipant?.displayName || otherParticipant?.username || 'User'),
        groupName: row.conversation.title || row.conversation.name,
        isGroup: isGrp,
        unreadCount: row.member.unreadCount,
        unread: (row.member.unreadCount ?? 0) > 0,
        isMuted: row.member.isMuted,
        isPinned: row.member.isPinned,
        participants,
        profileIds: participants.map(p => p.userId),
        otherParticipant: isGrp ? null : otherParticipant,
        otherParticipantId: isGrp ? null : (otherParticipant?.profileId || otherParticipant?.userId || otherParticipant?.firebaseUid || null),
        otherParticipantUid: isGrp ? null : (otherParticipant?.firebaseUid || null),
        otherProfile: isGrp ? null : otherParticipant,
        online: isGrp ? false : isOtherOnline,
        lastRead,
      });`;

  if (oldDalResultPattern.test(dalContent)) {
    dalContent = dalContent.replace(oldDalResultPattern, newDalResult);
    console.log('✔ Patched ChatDAL.getUserConversations return mapping');
  }

  fs.writeFileSync(dalPath, dalContent, 'utf8');
}

// 5. Patch backend/src/routes/chat.routes.ts
const chatRoutesPath = path.resolve('backend/src/routes/chat.routes.ts');
if (fs.existsSync(chatRoutesPath)) {
  let routesContent = fs.readFileSync(chatRoutesPath, 'utf8');

  // Update GroupChatSchema
  const oldSchemaPattern = /const GroupChatSchema = z\.object\(\{\s*title: z\.string\(\)\.min\(1\)\.max\(100\),\s*memberIds: z\.array\(z\.string\(\)\.min\(1\)\),\s*avatarKey: z\.string\(\)\.optional\(\),\s*\}\);/;
  const newSchema = `const GroupChatSchema = z.object({
  title: z.string().min(1).max(100),
  memberIds: z.array(z.string().min(1)),
  avatarKey: z.string().optional(),
  type: z.string().optional(),
  participantDetails: z.record(z.any()).optional(),
});`;

  if (oldSchemaPattern.test(routesContent)) {
    routesContent = routesContent.replace(oldSchemaPattern, newSchema);
    console.log('✔ Patched GroupChatSchema in backend/src/routes/chat.routes.ts');
  }

  // Update POST /conversations/group route handler
  const oldRouteHandlerPattern = /router\.post\('\/conversations\/group', authenticateToken, async \(req: AuthenticatedRequest, res: Response\) => \{[\s\S]*?const \{ title, memberIds, avatarKey \} = GroupChatSchema\.parse\(req\.body\);[\s\S]*?res\.status\(201\)\.json\(\{ conversation: conv \}\);[\s\S]*?\}\);/;
  const newRouteHandler = `router.post('/conversations/group', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, memberIds, avatarKey, type, participantDetails } = GroupChatSchema.parse(req.body);
    const resolvedMemberIds = (await Promise.all(memberIds.map(async (rawId: string) => {
      const resolved = await resolveUserId(rawId);
      return resolved || rawId;
    }))).filter((id: string | null): id is string => Boolean(id));

    const conv = await ChatDAL.createGroupConversation(req.user!.userId, title, resolvedMemberIds, avatarKey, type || 'group', participantDetails);

    // Broadcast to all members via Socket.IO
    try {
      const allMembers = [req.user!.userId, ...resolvedMemberIds];
      for (const mId of allMembers) {
        io.to(\`user:\${mId}\`).emit('conversation_created', { conversation: conv });
      }
    } catch {}

    res.status(201).json({ conversation: conv });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Group Chat Error]', err);
    res.status(500).json({ error: 'Failed to create group conversation' });
  }
});`;

  if (oldRouteHandlerPattern.test(routesContent)) {
    routesContent = routesContent.replace(oldRouteHandlerPattern, newRouteHandler);
    console.log('✔ Patched POST /conversations/group route in backend');
  }

  fs.writeFileSync(chatRoutesPath, routesContent, 'utf8');
}

// 6. Patch src/components/Messenger.tsx (handleGroupCreated & currentChat)
const messengerPath = path.resolve('src/components/Messenger.tsx');
let messengerContent = fs.readFileSync(messengerPath, 'utf8');

const oldHandleGroupCreatedPattern = /const handleGroupCreated = \(groupId: string, groupData\?: any\) => \{[\s\S]*?setTempChat\(\{[\s\S]*?\}\s*as any\);[\s\S]*?\}\s*\};/;

const newHandleGroupCreated = `const handleGroupCreated = (groupId: string, groupData?: any) => {
    setIsGroupCreationOpen(false);
    setActiveChatId(groupId);
    setIsMobileList(false);
    if (groupData) {
      const cleanName = groupData.groupName || groupData.name || groupData.title || 'Group Chat';
      const cleanPhoto = groupData.photo || groupData.groupPhotoURL || '';
      const newChatObj: any = {
        ...groupData,
        id: groupId,
        name: cleanName,
        groupName: cleanName,
        title: cleanName,
        photo: cleanPhoto,
        groupPhotoURL: cleanPhoto,
        lastMessage: groupData.lastMessage || 'Group created',
        latestMessagePreview: groupData.lastMessage || 'Group created',
        time: 'Just now',
        unread: false,
        isGroup: true,
        type: groupData.type || 'group',
        participants: groupData.participants || [user?.uid],
        profileIds: groupData.profileIds || [profile?.id],
        participantDetails: groupData.participantDetails || {}
      };
      setTempChat(newChatObj);
      setChats(prev => [newChatObj, ...prev.filter(c => c.id !== groupId)]);
    }
  };`;

if (oldHandleGroupCreatedPattern.test(messengerContent)) {
  messengerContent = messengerContent.replace(oldHandleGroupCreatedPattern, newHandleGroupCreated);
  console.log('✔ Patched handleGroupCreated in src/components/Messenger.tsx');
} else {
  console.log('ℹ handleGroupCreated pattern not found in src/components/Messenger.tsx');
}

// Also update currentChat memo in Messenger.tsx
const oldCurrentChatPattern = /const currentChat = useMemo\(\(\) => \{[\s\S]*?if \(activeChatId\) \{[\s\S]*?const found = chats\.find\(c => c\.id === activeChatId\);[\s\S]*?if \(found\) return found;[\s\S]*?if \(tempChat && tempChat\.id === activeChatId\) return tempChat;[\s\S]*?\}[\s\S]*?return tempChat \|\| null;[\s\S]*?\}, \[chats, activeChatId, tempChat\]\);/;

const newCurrentChat = `const currentChat = useMemo(() => {
    if (activeChatId) {
      const found = chats.find(c => c.id === activeChatId);
      if (found) {
        if (tempChat && tempChat.id === activeChatId) {
          return {
            ...tempChat,
            ...found,
            name: found.name || found.groupName || (found as any).title || tempChat.name,
            groupName: found.groupName || found.name || (found as any).title || tempChat.groupName,
            isGroup: (found.isGroup ?? tempChat.isGroup) || (found.type === 'group' || found.type === 'community' || found.type === 'team'),
            participantDetails: { ...(tempChat.participantDetails || {}), ...(found.participantDetails || {}) }
          };
        }
        return found;
      }
      if (tempChat && tempChat.id === activeChatId) return tempChat;
    }
    return tempChat || null;
  }, [chats, activeChatId, tempChat]);`;

if (oldCurrentChatPattern.test(messengerContent)) {
  messengerContent = messengerContent.replace(oldCurrentChatPattern, newCurrentChat);
  console.log('✔ Patched currentChat in src/components/Messenger.tsx');
} else {
  console.log('ℹ currentChat pattern not found in src/components/Messenger.tsx');
}

fs.writeFileSync(messengerPath, messengerContent, 'utf8');

console.log('--- Patch Complete ---');
