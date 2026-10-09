import { 
  collection, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  writeBatch,
  getDoc,
  getDocs,
  deleteDoc,
  increment,
  DocumentData,
  QuerySnapshot,
  Firestore,
  deleteField
} from 'firebase/firestore';
import { Message, Chat } from '../../types/messenger';
import { aeirmistCache } from '../../services/CacheService';
import { handleFirestoreError, OperationType } from '../../lib/firebase';
import { logger } from '@/src/utils/logger';
import { getAvatarUrl } from '../../lib/avatar';
import { extractTimestampMs } from '../../lib/date';
import { api } from '../../services/api/client';
import { getSocket, joinChatRoom, leaveChatRoom, identifyUserSocket } from '../../services/api/socket';

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj === undefined ? null : obj;
  }
  // CRITICAL: NEVER mutate or strip Firestore FieldValue sentinels or Timestamp instances!
  if (
    obj instanceof Date ||
    typeof obj?.toMillis === 'function' ||
    typeof obj?.toDate === 'function' ||
    obj?.constructor?.name?.includes?.('FieldValue') ||
    obj?.constructor?.name?.includes?.('Timestamp') ||
    typeof obj?._methodName === 'string'
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      cleaned[key] = cleanUndefined(val);
    } else {
      cleaned[key] = null;
    }
  }
  return cleaned;
}


class MessagingService {
  private listeners: Map<string, () => void> = new Map();
  private lastMetadataUpdate: Map<string, number> = new Map();
  private lastDeliveryUpdate: Map<string, number> = new Map();
  private recentOptimisticIds: Map<string, number> = new Map();
  private isSafeMode: boolean = false;
  private messageMemoryCache: Map<string, Message[]> = new Map();

  public getCachedMessages(conversationId: string): Message[] | undefined {
    if (!conversationId) return undefined;
    const inMem = this.messageMemoryCache.get(conversationId);
    if (inMem && inMem.length > 0) return inMem;
    
    // Synchronous localStorage fallback for instant zero-latency cold-start
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(`aeirmist_msgs_${conversationId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.messageMemoryCache.set(conversationId, parsed);
            return parsed;
          }
        }
      } catch (e) {}
    }
    return undefined;
  }

  public setCachedMessages(conversationId: string, messages: Message[]) {
    if (!conversationId || !messages) return;
    this.messageMemoryCache.set(conversationId, messages);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const slice = messages.slice(-40);
        localStorage.setItem(`aeirmist_msgs_${conversationId}`, JSON.stringify(slice));
      } catch (e) {}
    }
  }

  public setSafeMode(enabled: boolean) {
    this.isSafeMode = enabled;
  }

  public async markAsRead(db: Firestore, conversationId: string, profileId: string) {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      [`lastRead.${profileId}`]: serverTimestamp(),
      [`unreadCount.${profileId}`]: 0
    }).catch(err => logger.warn("Read confirmation rejected by core:", err));
  }

  public async deleteMessage(db: Firestore, conversationId: string, messageId: string, profileId: string, deleteType: 'me' | 'everyone' = 'everyone') {
    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    
    if (deleteType === 'me') {
      await updateDoc(msgRef, {
        [`deletedFor.${profileId}`]: true
      });
    } else {
      // Unsend: Delete for everyone
      const batch = writeBatch(db);
      batch.update(msgRef, {
        text: 'Message Removed',
        type: 'text',
        mediaUrl: null,
        attachmentUrl: null,
        'metadata.removed': true,
        'metadata.removedBy': profileId
      });

      // Update conversation if it's the last message
      const convRef = doc(db, 'conversations', conversationId);
      const convSnap = await getDoc(convRef);
      if (convSnap.exists()) {
        const convData = convSnap.data();
        if (convData.lastMessage?.messageId === messageId || convData.latestMessageId === messageId || !convData.lastMessage?.messageId) {
          batch.update(convRef, {
            'lastMessage.text': 'Message Removed',
            'lastMessage.type': 'text',
            'lastMessage.mediaUrl': null,
            'lastMessage.metadata.removed': true,
            latestMessagePreview: 'Message Removed'
          });
        }
      }
      await batch.commit();
    }
  }

  public async editMessage(db: Firestore, conversationId: string, messageId: string, newText: string) {
    const batch = writeBatch(db);
    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    
    batch.update(msgRef, {
      text: newText,
      'metadata.edited': true,
      'metadata.editedAt': serverTimestamp()
    });

    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (convSnap.exists()) {
      const convData = convSnap.data();
      if (convData.lastMessage?.messageId === messageId || convData.latestMessageId === messageId || !convData.lastMessage?.messageId) {
        batch.update(convRef, {
          'lastMessage.text': newText,
          'lastMessage.metadata.edited': true,
          latestMessagePreview: newText
        });
      }
    }
    await batch.commit();
  }

  async sendMessage(
    db: Firestore,
    profile: any,
    user: any,
    conversationId: string, 
    text: string, 
    type: string = 'text', 
    mediaUrl?: string, 
    metadata: any = {}
  ): Promise<string> {
    if (!user || !user.uid || !profile || !profile.id) {
      throw new Error("Authentication required to send messages.");
    }

    if (metadata.optimisticId) {
      const lastSent = this.recentOptimisticIds.get(metadata.optimisticId);
      if (lastSent && Date.now() - lastSent < 15000) {
        logger.warn(`[MessagingService] Duplicate send intercepted for ${metadata.optimisticId}`);
        return conversationId.startsWith('new_') ? conversationId : conversationId;
      }
      this.recentOptimisticIds.set(metadata.optimisticId, Date.now());
      if (this.recentOptimisticIds.size > 200) {
        const now = Date.now();
        for (const [id, time] of this.recentOptimisticIds.entries()) {
          if (now - time > 60000) this.recentOptimisticIds.delete(id);
        }
      }
    }

    logger.info(`[MessagingService] sending message to ${conversationId}...`);
    let finalConvId = conversationId;
    const isNew = conversationId.startsWith('new_');
    
    try {
      logger.info(`[MessagingService] Sending message to ${finalConvId}. Sender: ${profile.id}, User: ${user.uid}`);
      
      // 1. Initial resolution from inputs
      let targetProfileId = isNew ? conversationId.replace('new_', '') : (metadata.recipientId || null);
      let targetOwnerUid = metadata.receiverUid || metadata.targetProfile?.uid || metadata.targetProfile?.ownerUid || null;

      if (!targetProfileId && finalConvId.includes('_')) {
        const parts = finalConvId.split('_');
        targetProfileId = parts.find(p => p !== profile.id && p !== user.uid) || null;
      }

      // 2. Deterministic ID resolution for 1v1 legacy format
      if (isNew && targetProfileId) {
        finalConvId = [profile.id, targetProfileId].sort().join('_');
      }

      if (!targetProfileId && metadata.targetProfile?.id) {
        targetProfileId = metadata.targetProfile.id;
      }

      const messageId = metadata.optimisticId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // 3. Primary Device SQL DAL / Cloudflare Edge Persistence (PostgreSQL Backend)
      let resolvedConvId = finalConvId;
      try {
        const apiRes = await api.chat.sendMessage(finalConvId, {
          content: text,
          type,
          mediaKey: metadata.mediaKey || (mediaUrl ? mediaUrl : undefined),
          fileName: metadata.fileName,
          fileSize: metadata.fileSize,
          duration: metadata.duration,
          replyToId: metadata.replyTo?.id || metadata.replyToId,
          metadata: {
            ...metadata,
            senderId: profile.id,
            senderUid: user.uid,
            senderName: profile.displayName || profile.username,
            senderPhoto: profile.photoURL || '',
            optimisticId: metadata.optimisticId || null,
            targetProfileId,
            finalConvId
          }
        });
        if (apiRes?.conversationId) {
          resolvedConvId = apiRes.conversationId;
        }
      } catch (apiErr: any) {
        logger.warn("[MessagingService] Device API send warning:", apiErr);
        throw apiErr;
      }

      // 4. Update instant memory cache so sender sees bubble immediately
      const existingMem = this.getCachedMessages(finalConvId) || [];
      const localMsg: Message = {
        id: messageId,
        conversationId: finalConvId,
        senderId: profile.id,
        senderUid: user.uid,
        text,
        content: text,
        type,
        mediaUrl: mediaUrl || null,
        status: 'sent',
        isDelivered: true,
        isSeen: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestampMs: Date.now(),
        metadata: {
          ...metadata,
          optimisticId: metadata.optimisticId || null
        }
      } as Message;
      const updatedMem = [...existingMem.filter(m => m.id !== messageId && (!metadata.optimisticId || m.metadata?.optimisticId !== metadata.optimisticId)), localMsg];
      this.setCachedMessages(finalConvId, updatedMem);

      return resolvedConvId || finalConvId;
    } catch (e: any) {
      logger.error("[MessagingService] ATOMIC FAILURE:", e);
      throw e;
    }
  }

  private updateExistingConversation(
    batch: any, 
    db: Firestore, 
    convId: string, 
    senderId: string, 
    receiverId: string | null, 
    receiverUid: string | null,
    text: string, 
    type: string, 
    mediaUrl?: string, 
    metadata: any = {}
  ) {
    const convRef = doc(db, 'conversations', convId);
    
    // OPTIMIZATION: Throttle conversation metadata updates to save write quota
    const now = Date.now();
    const lastUpdate = this.lastMetadataUpdate.get(convId) || 0;
    const isMajorUpdate = now - lastUpdate > 30000; // 30 seconds frequency for heavy metadata

    const updates: any = {};

    const clientNow = Date.now();
    // ALWAYS update latestMessageAt, latestMessageId, latestMessageSenderId, latestMessagePreview and updatedAt
    updates.latestMessageAt = serverTimestamp();
    updates.latestMessageAtMs = clientNow;
    updates.latestMessageId = metadata.messageId || null;
    updates.latestMessageSenderId = senderId;
    updates.latestMessagePreview = text;
    updates.updatedAt = serverTimestamp();
    updates.updatedAtMs = clientNow;
    updates.lastMessage = {
      text,
      senderId,
      timestamp: serverTimestamp(),
      timestampMs: clientNow,
      type,
      mediaUrl: mediaUrl || null,
      mood: metadata.mood || null,
      messageId: metadata.messageId || null
    };

    if (isMajorUpdate) {
      this.lastMetadataUpdate.set(convId, now);
      updates[`lastRead.${senderId}`] = serverTimestamp();
      updates[`lastDelivered.${senderId}`] = serverTimestamp();
      updates[`isArchived.${senderId}`] = false;
    }

    // Ensure participants array is ALWAYS present for security rules
    if (metadata.receiverUid && metadata.senderUid) {
       updates.participants = metadata.senderUid === metadata.receiverUid ? [metadata.senderUid] : [metadata.senderUid, metadata.receiverUid].sort();
    }
    
    // Ensure profileIds is present for logic
    if (metadata.recipientId) {
      updates.profileIds = senderId === metadata.recipientId ? [senderId] : [senderId, metadata.recipientId].sort();
    }

    if (metadata.targetProfile && metadata.recipientId) {
      updates[`participantDetails.${metadata.recipientId}`] = metadata.targetProfile;
    }
    const rawSenderName = metadata.senderName || metadata.senderDisplayName;
    const isSenderNameValid = rawSenderName && typeof rawSenderName === 'string' &&
      rawSenderName.trim() !== '' &&
      rawSenderName.toLowerCase() !== 'unknown' &&
      rawSenderName.toLowerCase() !== 'unknown user';
    const cleanSenderName = isSenderNameValid ? rawSenderName.trim() : 'Aeirmist User';

    if (rawSenderName || metadata.senderPhoto || metadata.senderUid) {
      updates[`participantDetails.${senderId}`] = {
        displayName: cleanSenderName,
        photoURL: metadata.senderPhoto || '',
        uid: metadata.senderUid || '',
        username: senderId
      };
    }

    // Reset deletedFor flags so the conversation reappears upon new signals/messages
    updates[`deletedFor.${senderId}`] = null;
    if (receiverId) {
      updates[`deletedFor.${receiverId}`] = null;
      if (receiverId !== senderId) {
        updates[`unreadCount.${receiverId}`] = increment(1);
      }
      updates[`isArchived.${receiverId}`] = false;
    }

    batch.update(convRef, cleanUndefined(updates));

    // Write notification for receiver if not self, not in safe mode, and NOT vaulted/muted by receiver
    const targetUserId = receiverId || receiverUid;
    const isSelf = (receiverId && receiverId === senderId) || (receiverUid && metadata.senderUid && metadata.senderUid === receiverUid);
    const isReceiverVaulted = Boolean(
      (receiverId && metadata.convData?.isVaulted?.[receiverId] === true) || 
      (receiverUid && metadata.convData?.isVaulted?.[receiverUid] === true) ||
      (receiverId && metadata.convData?.isMuted?.[receiverId] === true) ||
      (receiverUid && metadata.convData?.isMuted?.[receiverUid] === true) ||
      metadata.isVaulted
    );
    if (targetUserId && !this.isSafeMode && !isSelf && !isReceiverVaulted) {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, cleanUndefined({
        userId: targetUserId, // Use Profile ID if available, else Auth UID
        fromUserId: senderId,
        fromUser: {
          displayName: cleanSenderName,
          photoURL: metadata.senderPhoto || ''
        },
        type: 'message',
        message: type === 'text' ? (text.substring(0, 50) + (text.length > 50 ? '...' : '')) : `Sent a ${type}`,
        metadata: { conversationId: convId },
        read: false,
        createdAt: serverTimestamp()
      }));
    }
  }

  subscribeToMessages(
    db: Firestore, 
    conversationId: string, 
    currentProfileId: string,
    chatData: any,
    callback: (messages: Message[]) => void,
    limitCount: number = 50
  ) {
    logger.info(`[MessagingService] Subscribed to messages for ${conversationId}`);
    
    let isCancelled = false;
    let localCurrentMessages: Message[] = [];

    // Identify current user and join conversation rooms for instant real-time events
    if (currentProfileId) {
      identifyUserSocket(currentProfileId);
    }
    joinChatRoom(conversationId);
    if (chatData?.id && chatData.id !== conversationId) {
      joinChatRoom(chatData.id);
    }

    // Helper: Normalize any server/API/cache message to unified Message schema
    const normalizeMsg = (m: any): Message => {
      const timestampMs = (typeof m.timestampMs === 'number' && m.timestampMs > 0)
        ? m.timestampMs
        : (m.createdAt ? extractTimestampMs(m.createdAt) : Date.now());
      const date = new Date(timestampMs);
      return {
        ...m,
        id: m.id || `msg_${timestampMs}`,
        conversationId: m.conversationId || conversationId,
        senderId: m.senderId || m.sender?.profileId || m.sender?.id || m.senderUid,
        senderUid: m.senderUid || m.sender?.firebaseUid || m.sender?.id || m.senderId,
        senderProfileId: m.senderProfileId || m.sender?.profileId,
        senderDbId: m.senderDbId || m.sender?.id,
        text: m.text !== undefined ? m.text : (m.content || ''),
        content: m.content !== undefined ? m.content : (m.text || ''),
        type: m.type || 'text',
        mediaUrl: m.mediaUrl || m.attachmentUrl || (m.mediaKey ? `/media/${m.mediaKey}` : null),
        attachmentUrl: m.attachmentUrl || m.mediaUrl || (m.mediaKey ? `/media/${m.mediaKey}` : null),
        timestamp: typeof m.timestamp === 'string' && m.timestamp ? m.timestamp : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestampMs,
        createdAt: m.createdAt || new Date(timestampMs).toISOString(),
        isSeen: Boolean(m.isSeen || m.isRead),
        isDelivered: Boolean(m.isDelivered !== false),
        status: m.status || 'sent',
        metadata: m.metadata || {}
      };
    };

    // Helper to merge, deduplicate and sort messages
    const mergeAndEmit = (incoming: Message[]) => {
      if (isCancelled) return;
      const map = new Map<string, Message>();
      const optMap = new Map<string, string>();

      const all = [...localCurrentMessages, ...incoming];
      for (const m of all) {
        if (!m.id) continue;
        const optId = (m as any).metadata?.optimisticId || (m as any).optimisticId;
        if (optId) {
          if (m.id.startsWith('opt_')) {
            if (optMap.has(optId)) continue;
          } else {
            optMap.set(optId, m.id);
          }
        }
        map.set(m.id, m);
      }

      // Remove lingering optimistic messages when counterpart server message exists
      for (const [optId, srvId] of optMap.entries()) {
        if (map.has(optId) && optId !== srvId) {
          map.delete(optId);
        }
      }

      const list = Array.from(map.values());
      list.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
      localCurrentMessages = list;
      this.setCachedMessages(conversationId, list);
      callback(list);
    };

    // 1. Instant Cache Check (0ms frame-0 latency)
    const syncCached = this.getCachedMessages(conversationId);
    if (syncCached && syncCached.length > 0) {
      localCurrentMessages = syncCached;
      callback(syncCached);
    } else {
      aeirmistCache.getMessages(conversationId).then(cached => {
        if (isCancelled) return;
        if (cached && cached.length > 0 && localCurrentMessages.length === 0) {
          const formatted = cached.map(normalizeMsg);
          mergeAndEmit(formatted);
        }
      }).catch(() => {});
    }

    const key = `messages_${conversationId}`;
    if (this.listeners.has(key)) {
      this.listeners.get(key)!();
    }

    // 2. Fetch directly from Device API (PostgreSQL DAL / Edge)
    const fetchApiMessages = async () => {
      if (isCancelled) return;
      try {
        const res = await api.chat.getMessages(conversationId, limitCount);
        if (res && Array.isArray(res.messages) && res.messages.length > 0) {
          const normalized = res.messages.map(normalizeMsg);
          mergeAndEmit(normalized);
        }
      } catch (err) {
        // silent polling catch
      }
    };

    fetchApiMessages();

    // 3. High-Frequency Polling Interval (Every 1800ms while chat window is active)
    const pollInterval = setInterval(fetchApiMessages, 1800);

    // 4. Socket.io Real-Time Listener
    const socket = getSocket();
    const handleSocketMessage = (payload: any) => {
      if (isCancelled || !payload) return;
      const rawMsg = payload.message || payload;
      const targetConvId = String(payload.conversationId || payload.rawConversationId || '');
      const rawConvId = String(payload.rawConversationId || payload.conversationId || '');
      const currentConv = String(conversationId || '');

      const normConv = currentConv.includes('_') ? currentConv.split('_').sort().join('_') : currentConv;
      const normTarget = targetConvId.includes('_') ? targetConvId.split('_').sort().join('_') : targetConvId;
      const normRaw = rawConvId.includes('_') ? rawConvId.split('_').sort().join('_') : rawConvId;

      const isConvMatch = targetConvId === currentConv || 
                          rawConvId === currentConv ||
                          (Boolean(normConv) && (normConv === normTarget || normConv === normRaw)) ||
                          (Boolean(chatData?.id) && (chatData.id === targetConvId || chatData.id === rawConvId));

      const otherIds = [
        chatData?.otherParticipantId,
        chatData?.otherParticipantId ? chatData.otherParticipantId.replace(/^profile_/, '') : null,
        chatData?.otherParticipantUid,
        chatData?.otherProfile?.id,
        chatData?.otherProfile?.id ? chatData.otherProfile.id.replace(/^profile_/, '') : null,
        chatData?.otherProfile?.userId,
        chatData?.otherProfile?.firebaseUid,
        chatData?.otherProfile?.username,
        conversationId.startsWith('new_') ? conversationId.replace('new_', '') : null,
      ].filter(Boolean) as string[];

      const incomingSenderIds = [
        rawMsg.senderId,
        rawMsg.senderId ? rawMsg.senderId.replace(/^profile_/, '') : null,
        rawMsg.senderUid,
        rawMsg.senderDbId,
        rawMsg.senderProfileId,
        rawMsg.sender?.id,
        rawMsg.sender?.firebaseUid,
        rawMsg.sender?.profileId,
        rawMsg.sender?.username
      ].filter(Boolean) as string[];

      const isFromOther = otherIds.some(oid => 
        incomingSenderIds.some(sid => sid === oid || sid.toLowerCase() === oid.toLowerCase())
      );

      if (isConvMatch || isFromOther) {
        const normalized = normalizeMsg(rawMsg);
        mergeAndEmit([normalized]);
      }
    };
    socket.on('new_message', handleSocketMessage);

    // 5. Firestore onSnapshot (safe fallback listener)
    let firestoreUnsubscribe: (() => void) | null = null;
    if (db) {
      try {
        const q = query(
          collection(db, 'conversations', conversationId, 'messages'),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );

        firestoreUnsubscribe = onSnapshot(q, (snapshot) => {
          if (isCancelled) return;
          const rawMessages = snapshot.docs.map(doc => {
            const data = doc.data({ serverTimestamps: 'estimate' });
            return normalizeMsg({ ...data, id: doc.id });
          });
          mergeAndEmit(rawMessages);
        }, (error) => {
          logger.warn(`[MessagingService] Firestore snapshot soft warning (active on device SQL):`, error?.message || error);
        });
      } catch (e) {
        logger.warn("[MessagingService] Firestore listener init warning:", e);
      }
    }

    const cleanup = () => {
      isCancelled = true;
      clearInterval(pollInterval);
      leaveChatRoom(conversationId);
      if (chatData?.id && chatData.id !== conversationId) {
        leaveChatRoom(chatData.id);
      }
      socket.off('new_message', handleSocketMessage);
      if (firestoreUnsubscribe) firestoreUnsubscribe();
      if (this.listeners.get(key) === cleanup) {
        this.listeners.delete(key);
      }
    };

    this.listeners.set(key, cleanup);
    return cleanup;
  }

  subscribeToChats(db: Firestore, userUid: string, profileId: string, callback: (chats: Chat[]) => void) {
    logger.info(`[MessagingService] Subscribing to inbox for UID: ${userUid}`);
    let isCancelled = false;
    let localCurrentChats: Chat[] = [];

    if (userUid) identifyUserSocket(userUid);
    if (profileId) identifyUserSocket(profileId);

    // Helper: Normalize chat
    const normalizeChat = (c: any): Chat => {
      const getMs = (chat: any) => {
        if (!chat) return 0;
        const t0 = extractTimestampMs(chat.latestMessageAt || chat.lastMessageAt);
        if (t0 > 0) return t0;
        const t1 = extractTimestampMs(chat.lastMessage?.timestamp || chat.lastMessage?.createdAt);
        const t2 = extractTimestampMs(chat.updatedAt);
        const fallbackMs = Math.max(t1, t2);
        if (fallbackMs > 0) return fallbackMs;
        const t3 = extractTimestampMs(chat.createdAt);
        if (t3 > 0) return t3;
        return 0;
      };

      const ms = getMs(c);
      const other = (Array.isArray(c.participants) && typeof c.participants[0] === 'object')
        ? c.participants.find((p: any) => p.userId !== userUid && p.firebaseUid !== userUid && p.profileId !== profileId)
        : null;

      const resolvedName = c.title || c.name || other?.displayName || other?.username || c.groupName || 'Chat';
      const resolvedPhoto = c.avatarKey || c.photo || (other?.avatarKey ? `/media/${other.avatarKey}` : null) || null;
      const otherParticipantId = other?.profileId || other?.userId || c.otherParticipantId || null;
      const otherParticipantUid = other?.userId || other?.firebaseUid || c.otherParticipantUid || null;

      return {
        ...c,
        id: c.id,
        name: resolvedName,
        photo: resolvedPhoto,
        otherParticipantId,
        otherParticipantUid,
        otherProfile: other ? {
          id: other.profileId,
          userId: other.userId,
          firebaseUid: other.firebaseUid,
          displayName: other.displayName,
          username: other.username,
          avatarKey: other.avatarKey,
          isVerified: other.isVerified,
        } : c.otherProfile,
        latestMessageAt: c.lastMessageAt || c.latestMessageAt || new Date(ms || Date.now()).toISOString(),
        latestMessagePreview: c.lastMessagePreview || c.lastMessage?.text || '',
        unreadCount: typeof c.unreadCount === 'object' ? c.unreadCount : { [profileId]: c.unreadCount || 0 },
        participants: c.participants ? (Array.isArray(c.participants) && typeof c.participants[0] === 'object' ? c.participants.map((p: any) => p.userId) : c.participants) : [userUid],
        profileIds: c.profileIds || (other?.profileId ? [profileId, other.profileId] : [profileId])
      } as Chat;
    };

    const mergeAndEmitChats = (incoming: Chat[]) => {
      if (isCancelled) return;
      const map = new Map<string, Chat>();
      for (const c of [...localCurrentChats, ...incoming]) {
        if (!c.id) continue;
        map.set(c.id, c);
      }
      const list = Array.from(map.values());
      list.sort((a, b) => {
        const pinA = typeof a.isPinned === 'boolean' ? a.isPinned : !!a.isPinned?.[profileId];
        const pinB = typeof b.isPinned === 'boolean' ? b.isPinned : !!b.isPinned?.[profileId];
        if (pinA && !pinB) return -1;
        if (!pinA && pinB) return 1;
        const msA = extractTimestampMs(a.latestMessageAt);
        const msB = extractTimestampMs(b.latestMessageAt);
        return msB - msA;
      });
      localCurrentChats = list;
      callback(list);
    };

    // 0. Synchronous Instant Cache Load (0ms frame-0 rendering)
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`aeirmist_chats_${userUid}`) || localStorage.getItem('aeirmist_cached_inbox_chats');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localCurrentChats = parsed;
            callback(parsed);
          }
        }
      } catch (e) {}
    }

    // 1. Instant Cache Load from IndexedDB
    try {
      aeirmistCache.getConversations().then(cached => {
        if (cached && cached.length > 0 && localCurrentChats.length === 0) {
          const currentProfileChats = cached.filter(chat => 
            !chat.profileIds || chat.profileIds.includes(profileId) || chat.participants?.includes(userUid)
          );
          if (currentProfileChats.length > 0) {
            mergeAndEmitChats(currentProfileChats);
          }
        }
      }).catch(() => {});
    } catch (e) {}

    const key = `chats_${userUid}`;
    if (this.listeners.has(key)) {
      this.listeners.get(key)!();
    }

    // 2. Fetch directly from Device API (PostgreSQL DAL / Edge)
    const fetchApiChats = async () => {
      if (isCancelled) return;
      try {
        const res = await api.chat.getConversations();
        if (res && Array.isArray(res.conversations)) {
          const normalized = res.conversations.map(normalizeChat);
          mergeAndEmitChats(normalized);
        }
      } catch (err) {}
    };

    fetchApiChats();
    const pollInterval = setInterval(fetchApiChats, 3500);

    // 3. Socket listener for real-time inbox bumps
    const socket = getSocket();
    const handleNewMessage = (payload: any) => {
      if (isCancelled || !payload) return;
      fetchApiChats();
      if (typeof window !== 'undefined') {
        const msg = payload.message || payload;
        const cId = payload.conversationId || payload.rawConversationId;
        const sender = msg.sender || {};
        const senderName = sender.displayName || sender.username || payload.senderName || 'Message';
        const text = msg.content || msg.text || (msg.type ? `Sent a ${msg.type}` : 'Sent a message');
        window.dispatchEvent(new CustomEvent('aeirmist_chathead_preview', {
          detail: { chatId: cId, text, senderName }
        }));
      }
    };
    socket.on('new_message', handleNewMessage);

    // 4. Firestore onSnapshot (safe fallback listener)
    let firestoreUnsubscribe: (() => void) | null = null;
    if (db) {
      try {
        const q = query(
          collection(db, 'conversations'),
          where('participants', 'array-contains', userUid),
          limit(100)
        );

        firestoreUnsubscribe = onSnapshot(q, (snapshot) => {
          if (isCancelled) return;
          const fsChats = snapshot.docs.map(doc => {
            const data = doc.data({ serverTimestamps: 'estimate' });
            return normalizeChat({ ...data, id: doc.id });
          });
          mergeAndEmitChats(fsChats);
        }, (error) => {
          logger.warn("[MessagingService] Firestore inbox sync soft warning (active on device SQL):", error?.message || error);
        });
      } catch (e) {}
    }

    const cleanup = () => {
      isCancelled = true;
      clearInterval(pollInterval);
      socket.off('new_message', handleNewMessage);
      if (firestoreUnsubscribe) firestoreUnsubscribe();
      if (this.listeners.get(key) === cleanup) {
        this.listeners.delete(key);
      }
    };

    this.listeners.set(key, cleanup);
    return cleanup;
  }

  // Group Chat Functions

  public async createGroupConversation(
    db: Firestore, 
    creatorId: string, 
    memberIds: string[], 
    groupName: string, 
    groupPhotoURL?: string,
    creatorUid?: string,
    memberUids?: string[]
  ) {
    const convRef = doc(collection(db, 'conversations'));
    
    const profileIds = Array.from(new Set([creatorId, ...memberIds].filter(Boolean)));
    const participants = Array.from(new Set([creatorUid, ...(memberUids || []), ...profileIds].filter(Boolean)));
    
    await setDoc(convRef, {
      id: convRef.id,
      isGroup: true,
      type: 'group',
      name: groupName,
      groupName: groupName,
      photo: groupPhotoURL || null,
      groupPhotoURL: groupPhotoURL || null,
      profileIds: profileIds,
      participants: participants,
      admins: [creatorId],
      createdBy: creatorId,
      createdByUid: creatorUid || creatorId,
      status: 'active',
      isDiscoverable: false,
      pendingJoinRequests: [],
      lastMessage: {
        text: 'Group created',
        senderId: creatorId,
        timestamp: serverTimestamp(),
        type: 'text',
        mediaUrl: null,
        messageId: null
      },
      unreadCount: { [creatorId]: 0 },
      lastRead: { [creatorId]: serverTimestamp() },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return convRef.id;
  }

  public async sendSystemEvent(db: Firestore, conversationId: string, eventText: string) {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const msgDoc = doc(messagesRef);
      await setDoc(msgDoc, {
        text: eventText,
        senderId: 'system',
        type: 'system',
        metadata: { isSystem: true },
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp()
      });

      const convRef = doc(db, 'conversations', conversationId);
      await updateDoc(convRef, {
        lastMessage: {
          text: eventText,
          senderId: 'system',
          type: 'system',
          timestamp: serverTimestamp(),
          messageId: msgDoc.id
        },
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      logger.warn("Could not post system event:", e);
    }
  }

  public async addGroupMembers(db: Firestore, conversationId: string, requesterId: string, newMemberIds: string[], memberDetailsMap?: Record<string, any>, actorName?: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) {
      throw new Error("Group conversation not found");
    }
    
    const existingData = convSnap.data() || {};
    const participants: string[] = existingData.participants || [];
    const profileIds: string[] = existingData.profileIds || [];
    const admins: string[] = existingData.admins || [];
    const owner = existingData.owner || existingData.createdBy || existingData.createdByUid;

    const isAuthorized = 
      !requesterId ||
      participants.includes(requesterId) ||
      profileIds.includes(requesterId) ||
      admins.includes(requesterId) ||
      owner === requesterId ||
      participants.some(p => p && requesterId && (p === requesterId || p.includes(requesterId) || requesterId.includes(p))) ||
      profileIds.some(p => p && requesterId && (p === requesterId || p.includes(requesterId) || requesterId.includes(p)));

    if (!isAuthorized) {
      logger.warn(`User ${requesterId} authorization warning in group ${conversationId}`);
    }

    const updatedParticipants = Array.from(new Set([...participants, ...newMemberIds]));
    const updatedProfileIds = Array.from(new Set([...profileIds, ...newMemberIds]));
    
    const updatePayload: any = {
        participants: updatedParticipants,
        profileIds: updatedProfileIds,
        memberCount: updatedParticipants.length,
        updatedAt: serverTimestamp()
    };

    if (memberDetailsMap && Object.keys(memberDetailsMap).length > 0) {
      const existingDetails = existingData.participantDetails || {};
      updatePayload.participantDetails = { ...existingDetails, ...memberDetailsMap };
    }

    await updateDoc(convRef, updatePayload);

    const adder = actorName || 'Someone';
    const addedNames = newMemberIds.map(id => memberDetailsMap?.[id]?.displayName || id).filter(Boolean).join(', ');
    await this.sendSystemEvent(db, conversationId, `${adder} added ${addedNames || 'new members'} to the group.`);
  }

  public async removeGroupMember(db: Firestore, conversationId: string, adminId: string, memberIdToRemove: string, actorName?: string, memberName?: string, reason?: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) {
        throw new Error("Group not found");
    }
    const data = convSnap.data();
    const isAdmin = (data.admins || []).includes(adminId) || data.owner === adminId || data.createdBy === adminId;
    if (!isAdmin) {
        throw new Error("Unauthorized to remove members");
    }
    if (data.owner === memberIdToRemove || data.createdBy === memberIdToRemove) {
        throw new Error("Cannot remove group owner");
    }

    const updatedParticipants = (data.participants || []).filter((id: string) => id !== memberIdToRemove);
    const updatedProfileIds = (data.profileIds || []).filter((id: string) => id !== memberIdToRemove);
    const updatedAdmins = (data.admins || []).filter((id: string) => id !== memberIdToRemove);
    
    const memberRoles = { ...(data.memberRoles || {}) };
    delete memberRoles[memberIdToRemove];

    await updateDoc(convRef, {
        participants: updatedParticipants,
        profileIds: updatedProfileIds,
        admins: updatedAdmins,
        memberRoles,
        memberCount: updatedParticipants.length,
        updatedAt: serverTimestamp()
    });

    const remover = actorName || 'An admin';
    const target = memberName || memberIdToRemove;
    const reasonText = reason ? ` (${reason})` : '';
    await this.sendSystemEvent(db, conversationId, `${remover} removed ${target} from the group${reasonText}.`);
  }

  public async promoteToAdmin(db: Firestore, conversationId: string, adminId: string, memberIdToPromote: string, actorName?: string, memberName?: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return;
    const data = convSnap.data();
    const isAdmin = (data.admins || []).includes(adminId) || data.owner === adminId || data.createdBy === adminId;
    if (!isAdmin) throw new Error("Unauthorized to promote");

    const updatedAdmins = Array.from(new Set([...(data.admins || []), memberIdToPromote]));
    const memberRoles = { ...(data.memberRoles || {}), [memberIdToPromote]: 'admin' };

    await updateDoc(convRef, {
        admins: updatedAdmins,
        memberRoles,
        updatedAt: serverTimestamp()
    });

    const promoter = actorName || 'Admin';
    const target = memberName || 'a member';
    await this.sendSystemEvent(db, conversationId, `${promoter} made ${target} an Admin.`);
  }

  public async demoteAdmin(db: Firestore, conversationId: string, adminId: string, memberIdToDemote: string, actorName?: string, memberName?: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return;
    const data = convSnap.data();
    const isOwner = data.owner === adminId || data.createdBy === adminId;
    if (!isOwner) throw new Error("Only group owner can demote admins");

    const updatedAdmins = (data.admins || []).filter((id: string) => id !== memberIdToDemote);
    const memberRoles = { ...(data.memberRoles || {}), [memberIdToDemote]: 'member' };

    await updateDoc(convRef, {
        admins: updatedAdmins,
        memberRoles,
        updatedAt: serverTimestamp()
    });

    const demoter = actorName || 'Owner';
    const target = memberName || 'Admin';
    await this.sendSystemEvent(db, conversationId, `${demoter} removed ${target} from Admin role.`);
  }

  public async setMemberRole(db: Firestore, conversationId: string, requesterId: string, targetId: string, newRole: 'owner' | 'admin' | 'moderator' | 'member', actorName?: string, targetName?: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return;
    const data = convSnap.data();
    
    const isOwner = data.owner === requesterId || data.createdBy === requesterId;
    if (!isOwner && newRole === 'admin') {
      return this.promoteToAdmin(db, conversationId, requesterId, targetId, actorName, targetName);
    }

    const memberRoles = { ...(data.memberRoles || {}), [targetId]: newRole };
    let admins = data.admins || [];

    if (newRole === 'admin' || newRole === 'owner') {
      admins = Array.from(new Set([...admins, targetId]));
    } else {
      admins = admins.filter((id: string) => id !== targetId);
    }

    const updates: any = {
      memberRoles,
      admins,
      updatedAt: serverTimestamp()
    };

    if (newRole === 'owner') {
      updates.owner = targetId;
      updates.admins = Array.from(new Set([...admins, requesterId]));
      memberRoles[requesterId] = 'admin';
    }

    await updateDoc(convRef, updates);

    const actor = actorName || 'Someone';
    const target = targetName || 'Member';
    await this.sendSystemEvent(db, conversationId, `${actor} updated ${target}'s role to ${newRole.toUpperCase()}.`);
  }

  public async transferOwnership(db: Firestore, conversationId: string, currentOwnerId: string, newOwnerId: string, actorName?: string, newOwnerName?: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return;
    const data = convSnap.data();

    const isOwner = data.owner === currentOwnerId || data.createdBy === currentOwnerId;
    if (!isOwner) throw new Error("Only the owner can transfer ownership");

    const memberRoles = { ...(data.memberRoles || {}), [newOwnerId]: 'owner', [currentOwnerId]: 'admin' };
    const admins = Array.from(new Set([...(data.admins || []), newOwnerId, currentOwnerId]));

    await updateDoc(convRef, {
      owner: newOwnerId,
      createdBy: newOwnerId,
      admins,
      memberRoles,
      updatedAt: serverTimestamp()
    });

    const actor = actorName || 'Owner';
    const target = newOwnerName || 'Member';
    await this.sendSystemEvent(db, conversationId, `${actor} transferred group ownership to ${target}.`);
  }

  public async toggleMuteMember(db: Firestore, conversationId: string, memberId: string, isMuted: boolean, actorName?: string, targetName?: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return;

    const data = convSnap.data();
    const mutedMembers = { ...(data.mutedMembers || {}), [memberId]: isMuted };

    await updateDoc(convRef, {
      mutedMembers,
      updatedAt: serverTimestamp()
    });

    const actor = actorName || 'Admin';
    const target = targetName || 'User';
    const actionStr = isMuted ? 'muted' : 'unmuted';
    await this.sendSystemEvent(db, conversationId, `${actor} ${actionStr} ${target} in the group.`);
  }

  public async requestToJoinGroup(db: Firestore, conversationId: string, requesterId: string) {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
        pendingJoinRequests: Array.from(new Set([requesterId])) 
    });
  }

  public async approveJoinRequest(db: Firestore, conversationId: string, adminId: string, requesterId: string, actorName?: string, requesterName?: string) {
    const batch = writeBatch(db);
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists() || !(convSnap.data().admins || []).includes(adminId)) {
        throw new Error("Unauthorized to approve join request");
    }

    const data = convSnap.data();
    const updatedParticipants = Array.from(new Set([...(data.participants || []), requesterId]));

    batch.update(convRef, {
        pendingJoinRequests: (data.pendingJoinRequests || []).filter((id: string) => id !== requesterId),
        participants: updatedParticipants,
        memberCount: updatedParticipants.length,
        updatedAt: serverTimestamp()
    });
    await batch.commit();

    const actor = actorName || 'Admin';
    const target = requesterName || 'New member';
    await this.sendSystemEvent(db, conversationId, `${actor} approved ${target}'s join request.`);
  }

  public async rejectJoinRequest(db: Firestore, conversationId: string, adminId: string, requesterId: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists() || !(convSnap.data().admins || []).includes(adminId)) {
        throw new Error("Unauthorized to reject join request");
    }

    await updateDoc(convRef, {
        pendingJoinRequests: (convSnap.data().pendingJoinRequests || []).filter((id: string) => id !== requesterId)
    });
  }

  public async updateGroupDetails(db: Firestore, conversationId: string, updates: { name?: string; photoURL?: string; wallpaper?: string; settings?: any }, actorName?: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const payload: any = {
      updatedAt: serverTimestamp()
    };
    let eventMsg = '';
    const actor = actorName || 'An admin';

    if (updates.name !== undefined) {
      payload.name = updates.name;
      payload.groupName = updates.name;
      eventMsg = `${actor} changed the group name to "${updates.name}".`;
    }
    if (updates.photoURL !== undefined) {
      payload.photo = updates.photoURL;
      payload.groupPhotoURL = updates.photoURL;
      eventMsg = `${actor} updated the group photo.`;
    }
    if (updates.wallpaper !== undefined) {
      payload.wallpaper = updates.wallpaper;
      eventMsg = `${actor} changed the chat theme/wallpaper.`;
    }
    if (updates.settings !== undefined) {
      payload.settings = updates.settings;
    }

    await updateDoc(convRef, payload);

    if (eventMsg) {
      await this.sendSystemEvent(db, conversationId, eventMsg);
    }
  }

  public async setGroupNickname(db: Firestore, conversationId: string, memberId: string, nickname: string, setterName?: string, memberName?: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const cleanNick = nickname.trim();

    await updateDoc(convRef, {
      [`nicknames.${memberId}`]: cleanNick,
      updatedAt: serverTimestamp()
    });

    try {
      const chatSettingsRef = doc(db, 'chat_settings', conversationId);
      await setDoc(chatSettingsRef, {
        nicknames: {
          [memberId]: cleanNick
        }
      }, { merge: true });
    } catch (err) {
      logger.warn("Could not sync nickname to chat_settings:", err);
    }

    const actor = setterName || 'Someone';
    const target = memberName || memberId;
    const msg = cleanNick ? `${actor} set the nickname for ${target} to "${cleanNick}".` : `${actor} cleared ${target}'s nickname.`;
    await this.sendSystemEvent(db, conversationId, msg);
  }

  public async leaveGroup(db: Firestore, conversationId: string, memberId: string, memberUid?: string, memberName?: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return;
    const data = convSnap.data();

    const isOwner = data.owner === memberId || data.createdBy === memberId;
    if (isOwner && (data.participants || []).length > 1) {
      throw new Error("OWNER_MUST_TRANSFER");
    }

    const newProfileIds = (data.profileIds || []).filter((id: string) => id !== memberId);
    const newParticipants = (data.participants || []).filter((id: string) => id !== memberId && id !== memberUid);
    const newAdmins = (data.admins || []).filter((id: string) => id !== memberId);

    await updateDoc(convRef, {
      profileIds: newProfileIds,
      participants: newParticipants,
      admins: newAdmins,
      memberCount: newParticipants.length,
      updatedAt: serverTimestamp()
    });

    const target = memberName || 'A member';
    await this.sendSystemEvent(db, conversationId, `${target} left the group.`);
  }

  public async deleteGroup(db: Firestore, conversationId: string, requesterId: string) {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return;
    const data = convSnap.data();

    const isOwner = data.owner === requesterId || data.createdBy === requesterId;
    if (!isOwner) {
      throw new Error("Only the group owner can delete the group.");
    }

    await deleteDoc(convRef);
  }

  cleanup(key?: string) {
    if (key) {
      if (this.listeners.has(key)) {
        this.listeners.get(key)!();
        this.listeners.delete(key);
      }
    } else {
      this.listeners.forEach(unsub => unsub());
      this.listeners.clear();
    }
  }
}

export const messagingService = new MessagingService();
