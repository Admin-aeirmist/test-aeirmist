import { Message, Chat } from '../../types/messenger';
import { aeirmistCache } from '../../services/CacheService';
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
  private inFlightMessageSends: Map<string, Promise<string>> = new Map();
  private isSocketInitialized: boolean = false;
  private messageIntervals: Map<string, any> = new Map();
  private isVisibilityListenerAttached: boolean = false;
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

  private activeMessageSubscribers: Map<string, Set<(messages: Message[]) => void>> = new Map();

  public normalizeMsg(m: any, defaultConversationId?: string): Message {
    const timestampMs = (typeof m.timestampMs === 'number' && m.timestampMs > 0)
      ? m.timestampMs
      : (m.createdAt ? extractTimestampMs(m.createdAt) : Date.now());
    const date = new Date(timestampMs);
    return {
      ...m,
      id: m.id || `msg_${timestampMs}`,
      conversationId: m.conversationId || defaultConversationId || '',
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
  }

  public upsertMessages(existing: Message[], incoming: Message[]): Message[] {
    const map = new Map<string, Message>();
    const optToCanonical = new Map<string, string>();
    const existingSeq = new Map<string, number>();

    existing.forEach((m, idx) => {
      if (m.id) existingSeq.set(m.id, idx);
    });

    const all = [...existing, ...incoming];
    for (const m of all) {
      if (!m.id) continue;
      const optId = (m as any).metadata?.optimisticId || (m as any).metadata?.clientMessageId || (m as any).optimisticId;
      if (optId) {
        if (String(m.id).startsWith('opt_')) {
          if (optToCanonical.has(optId)) {
            continue;
          }
        } else {
          optToCanonical.set(optId, m.id);
        }
      }

      const current = map.get(m.id);
      if (current) {
        map.set(m.id, {
          ...current,
          ...m,
          isDelivered: m.isDelivered || current.isDelivered,
          isSeen: m.isSeen || current.isSeen,
          status: m.status || current.status || 'sent',
          metadata: { ...(current.metadata || {}), ...(m.metadata || {}) }
        });
      } else {
        map.set(m.id, m);
      }
    }

    for (const [optId, srvId] of optToCanonical.entries()) {
      if (map.has(optId) && optId !== srvId) {
        map.delete(optId);
      }
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const diff = (a.timestampMs || 0) - (b.timestampMs || 0);
      if (diff !== 0) return diff;
      const seqA = existingSeq.has(a.id) ? existingSeq.get(a.id)! : 999999;
      const seqB = existingSeq.has(b.id) ? existingSeq.get(b.id)! : 999999;
      return seqA - seqB;
    });

    return list;
  }

  public notifySubscribers(conversationId: string, messages: Message[]) {
    this.setCachedMessages(conversationId, messages);
    const set = this.activeMessageSubscribers.get(conversationId);
    if (set) {
      set.forEach(cb => {
        try { cb(messages); } catch (e) { logger.error('[MessagingService] Subscriber callback error:', e); }
      });
    }
  }

  public async markAsRead(_db: any, conversationId: string, _profileId?: string) {
    if (!conversationId) return;
    try {
      await api.chat.markSeen(conversationId);
    } catch (err) {
      logger.warn("[MessagingService] markAsRead error:", err);
    }
  }

  public async deleteMessage(_db: any, _conversationId: string, messageId: string, _profileId?: string, _deleteType: 'me' | 'everyone' = 'everyone') {
    if (!messageId) return;
    try {
      await api.chat.deleteMessage(messageId);
    } catch (err) {
      logger.error("[MessagingService] deleteMessage error:", err);
      throw err;
    }
  }

  public async editMessage(_db: any, _conversationId: string, messageId: string, newText: string) {
    if (!messageId || !newText) return;
    try {
      await api.chat.editMessage(messageId, newText);
    } catch (err) {
      logger.error("[MessagingService] editMessage error:", err);
      throw err;
    }
  }

  async sendMessage(
    _db: any,
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

    const optId = metadata.optimisticId || metadata.clientMessageId;
    if (optId) {
      const inFlight = this.inFlightMessageSends.get(optId);
      if (inFlight) {
        logger.warn(`[MessagingService] Concurrent send already in flight for ${optId}`);
        return inFlight;
      }
    }

    logger.info(`[MessagingService] sending message to ${conversationId}...`);
    const finalConvId = conversationId;

    const sendExecution = (async () => {
      try {
        logger.info(`[MessagingService] Sending message to ${finalConvId}. Sender: ${profile.id}, User: ${user.uid}`);
        const messageId = optId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // 3. Primary Persistence: PostgreSQL Backend via REST API
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
            optimisticId: optId || null,
            clientMessageId: optId || null,
          },
          clientMessageId: optId || undefined,
        });

        const serverMsg = apiRes.message;
        const resolvedConvId = apiRes.conversationId || finalConvId;

        // 4. Update instant memory cache so sender sees bubble immediately with canonical server data
        const existingMem = this.getCachedMessages(resolvedConvId) || this.getCachedMessages(finalConvId) || [];
        const canonicalLocalMsg: Message = this.normalizeMsg({
          ...(serverMsg || {}),
          id: serverMsg?.id || messageId,
          conversationId: resolvedConvId,
          senderId: serverMsg?.senderId || user.userId || user.id || user.uid,
          senderUid: serverMsg?.senderUid || user.uid,
          senderDbId: serverMsg?.senderDbId || user.userId || user.id,
          senderProfileId: serverMsg?.senderProfileId || profile.id,
          text,
          content: text,
          type,
          mediaUrl: mediaUrl || null,
          status: 'sent',
          isDelivered: true,
          isSeen: false,
          timestampMs: Date.now(),
          metadata: {
            ...metadata,
            optimisticId: optId || null,
            clientMessageId: optId || null
          }
        }, resolvedConvId);

        const updatedMem = this.upsertMessages(existingMem, [canonicalLocalMsg]);
        this.setCachedMessages(resolvedConvId, updatedMem);
        if (resolvedConvId !== finalConvId) {
          this.setCachedMessages(finalConvId, updatedMem);
        }
        this.notifySubscribers(resolvedConvId, updatedMem);
        if (resolvedConvId !== finalConvId) {
          this.notifySubscribers(finalConvId, updatedMem);
        }

        return resolvedConvId;
      } catch (e: any) {
        logger.error("[MessagingService] Send message failed:", e);
        throw e;
      } finally {
        if (optId) {
          this.inFlightMessageSends.delete(optId);
        }
      }
    })();

    if (optId) {
      this.inFlightMessageSends.set(optId, sendExecution);
    }
    return sendExecution;
  }

  private initGlobalSocketListeners() {
    if (this.isSocketInitialized) return;
    this.isSocketInitialized = true;
    const socket = getSocket();

    socket.on('connect', () => {
      for (const convId of this.activeMessageSubscribers.keys()) {
        this.fetchAndEmitApiMessages(convId);
      }
    });

    socket.on('new_message', (payload: any) => {
      if (!payload) return;
      const rawMsg = payload.message || payload;
      const targetConvId = String(payload.conversationId || rawMsg?.conversationId || '');
      const rawConvId = String(payload.rawConversationId || '');

      for (const convId of this.activeMessageSubscribers.keys()) {
        if (convId === targetConvId || convId === rawConvId) {
          const normalized = this.normalizeMsg(rawMsg, convId);
          const current = this.getCachedMessages(convId) || [];
          const merged = this.upsertMessages(current, [normalized]);
          this.notifySubscribers(convId, merged);
        }
      }
    });

    socket.on('seen_update', (payload: any) => {
      if (!payload) return;
      const targetConvId = String(payload.conversationId || payload.rawConversationId || '');
      for (const convId of this.activeMessageSubscribers.keys()) {
        if (convId === targetConvId) {
          const current = this.getCachedMessages(convId) || [];
          const updated = current.map(m => {
            if (m.senderId !== payload.userId) {
              return { ...m, isSeen: true };
            }
            return m;
          });
          this.notifySubscribers(convId, updated);
        }
      }
    });

    socket.on('message_edited', (payload: any) => {
      if (!payload?.message) return;
      const targetConvId = String(payload.conversationId || payload.message?.conversationId || '');
      for (const convId of this.activeMessageSubscribers.keys()) {
        if (convId === targetConvId) {
          const edited = this.normalizeMsg(payload.message, convId);
          const current = this.getCachedMessages(convId) || [];
          const merged = this.upsertMessages(current, [edited]);
          this.notifySubscribers(convId, merged);
        }
      }
    });

    socket.on('message_deleted', (payload: any) => {
      if (!payload?.messageId) return;
      const targetConvId = String(payload.conversationId || '');
      for (const convId of this.activeMessageSubscribers.keys()) {
        if (!targetConvId || convId === targetConvId) {
          const current = this.getCachedMessages(convId) || [];
          const filtered = current.filter(m => m.id !== payload.messageId);
          this.notifySubscribers(convId, filtered);
        }
      }
    });

    if (!this.isVisibilityListenerAttached && typeof document !== 'undefined') {
      this.isVisibilityListenerAttached = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          for (const convId of this.activeMessageSubscribers.keys()) {
            this.fetchAndEmitApiMessages(convId);
          }
        }
      });
    }
  }

  public async fetchAndEmitApiMessages(conversationId: string, limitCount: number = 50) {
    if (!conversationId) return;
    try {
      const res = await api.chat.getMessages(conversationId, limitCount);
      if (res && Array.isArray(res.messages)) {
        const normalized = res.messages.map(m => this.normalizeMsg(m, conversationId));
        const current = this.getCachedMessages(conversationId) || [];
        const merged = this.upsertMessages(current, normalized);
        this.notifySubscribers(conversationId, merged);
      }
    } catch (err) {
      // silent polling catch
    }
  }

  subscribeToMessages(
    _db: any, 
    conversationId: string, 
    currentProfileId: string,
    chatData: any,
    callback: (messages: Message[]) => void,
    limitCount: number = 50
  ) {
    logger.info(`[MessagingService] Subscribed to messages for ${conversationId}`);
    
    let isCancelled = false;
    this.initGlobalSocketListeners();

    // Identify current user and join conversation rooms for instant real-time events
    if (currentProfileId) {
      identifyUserSocket(currentProfileId);
    }
    joinChatRoom(conversationId);
    if (chatData?.id && chatData.id !== conversationId) {
      joinChatRoom(chatData.id);
    }

    const subDispatcher = (incoming: Message[]) => {
      if (isCancelled) return;
      callback(incoming);
    };

    if (!this.activeMessageSubscribers.has(conversationId)) {
      this.activeMessageSubscribers.set(conversationId, new Set());
    }
    this.activeMessageSubscribers.get(conversationId)!.add(subDispatcher);

    // 1. Instant Cache Check (0ms frame-0 latency)
    const syncCached = this.getCachedMessages(conversationId);
    if (syncCached && syncCached.length > 0) {
      callback(syncCached);
    } else {
      aeirmistCache.getMessages(conversationId).then(cached => {
        if (isCancelled) return;
        if (cached && cached.length > 0) {
          const current = this.getCachedMessages(conversationId) || [];
          if (current.length === 0) {
            const formatted = cached.map(m => this.normalizeMsg(m, conversationId));
            const merged = this.upsertMessages(current, formatted);
            this.notifySubscribers(conversationId, merged);
          }
        }
      }).catch(() => {});
    }

    // 2. Fetch directly from Device API (PostgreSQL DAL / Edge)
    this.fetchAndEmitApiMessages(conversationId, limitCount);

    // 3. Relaxed Offline Fallback interval (if not already running for this room)
    if (!this.messageIntervals.has(conversationId)) {
      const socket = getSocket();
      const interval = setInterval(() => {
        if (!socket.connected && this.activeMessageSubscribers.has(conversationId)) {
          this.fetchAndEmitApiMessages(conversationId, limitCount);
        }
      }, 30000);
      this.messageIntervals.set(conversationId, interval);
    }

    const cleanup = () => {
      isCancelled = true;
      leaveChatRoom(conversationId);
      if (chatData?.id && chatData.id !== conversationId) {
        leaveChatRoom(chatData.id);
      }
      const subs = this.activeMessageSubscribers.get(conversationId);
      if (subs) {
        subs.delete(subDispatcher);
        if (subs.size === 0) {
          this.activeMessageSubscribers.delete(conversationId);
          const interval = this.messageIntervals.get(conversationId);
          if (interval) {
            clearInterval(interval);
            this.messageIntervals.delete(conversationId);
          }
        }
      }
    };

    return cleanup;
  }

  subscribeToChats(_db: any, userUid: string, profileId: string, callback: (chats: Chat[]) => void) {
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
      const isMeParticipant = (p: any) => {
        if (!p) return false;
        const pUserId = p.userId ? String(p.userId).toLowerCase() : null;
        const pFirebaseUid = p.firebaseUid ? String(p.firebaseUid).toLowerCase() : null;
        const pProfileId = p.profileId ? String(p.profileId).toLowerCase() : null;
        const pId = p.id ? String(p.id).toLowerCase() : null;

        const myUserUid = userUid ? String(userUid).toLowerCase() : null;
        const myProfileId = profileId ? String(profileId).toLowerCase() : null;

        return Boolean(
          (myUserUid && (pUserId === myUserUid || pFirebaseUid === myUserUid || pId === myUserUid)) ||
          (myProfileId && (pProfileId === myProfileId || pId === myProfileId || pUserId === myProfileId))
        );
      };

      // Direct other participant: prefer backend explicit otherParticipant object
      let other = (c as any).otherParticipant || null;
      if (!other && Array.isArray(c.participants) && c.participants.length > 0) {
        if (typeof c.participants[0] === 'object') {
          other = c.participants.find((p: any) => !isMeParticipant(p)) || null;
        }
      }

      const isSelf = c.type === 'self' || (!other && !c.isGroup && c.type !== 'group' && Array.isArray(c.participants) && c.participants.length <= 1);

      const otherParticipantId = isSelf ? profileId : (other?.profileId || other?.id || other?.userId || c.otherParticipantId || null);
      const otherParticipantUid = isSelf ? userUid : (other?.userId || other?.firebaseUid || other?.id || c.otherParticipantUid || null);

      let resolvedName = c.title || c.name || other?.displayName || other?.username || c.groupName || (isSelf ? 'My Space' : 'Chat');
      if (resolvedName === 'Aeirmist Member' || resolvedName === 'Aeirmist User') {
        if (other?.username && other.username !== 'unknown') {
          resolvedName = other.username;
        }
      }

      const resolvedPhoto = c.avatarKey ? `/media/${c.avatarKey}` : (other?.avatarKey ? `/media/${other.avatarKey}` : (c.photo || other?.photoURL || null));

      return {
        ...c,
        id: c.id,
        name: resolvedName,
        photo: resolvedPhoto,
        otherParticipantId,
        otherParticipantUid,
        otherProfile: isSelf ? null : (other ? {
          id: otherParticipantId,
          userId: other.userId,
          firebaseUid: other.firebaseUid,
          displayName: other.displayName || other.username || resolvedName,
          username: other.username,
          avatarKey: other.avatarKey,
          isVerified: other.isVerified,
        } : c.otherProfile),
        latestMessageAt: c.lastMessageAt || c.latestMessageAt || new Date(ms || Date.now()).toISOString(),
        latestMessagePreview: c.lastMessagePreview || c.lastMessage?.text || '',
        unreadCount: typeof c.unreadCount === 'number' ? c.unreadCount : (typeof c.unreadCount === 'object' ? (c.unreadCount[profileId] || 0) : 0),
        participants: c.participants ? (Array.isArray(c.participants) && typeof c.participants[0] === 'object' ? c.participants.map((p: any) => p.userId) : c.participants) : [userUid],
        profileIds: c.profileIds || (otherParticipantId ? [profileId, otherParticipantId] : [profileId])
      } as Chat;
    };

    const mergeAndEmitChats = (incoming: Chat[]) => {
      if (isCancelled) return;
      const listMap = new Map<string, Chat>();
      const directPartnerMap = new Map<string, string>(); // partnerKey -> preferredChatId

      for (const c of [...localCurrentChats, ...incoming]) {
        if (!c.id) continue;

        // In 1v1 direct chats, check if another entry for the exact same partner already exists
        const isDirect = !c.isGroup && c.type !== 'group';
        const isSelf = c.type === 'self' || c.otherParticipantId === profileId;
        const partnerKey = (isDirect && !isSelf) ? (
          c.otherProfile?.userId ||
          c.otherParticipantUid ||
          c.otherParticipantId ||
          null
        ) : null;

        if (partnerKey) {
          const existingId = directPartnerMap.get(partnerKey);
          if (existingId && existingId !== c.id) {
            const existing = listMap.get(existingId);
            if (existing) {
              const msExisting = extractTimestampMs(existing.latestMessageAt || existing.lastMessageAt);
              const msCurrent = extractTimestampMs(c.latestMessageAt || c.lastMessageAt);
              
              const latestPreview = msCurrent >= msExisting
                ? (c.latestMessagePreview || existing.latestMessagePreview)
                : (existing.latestMessagePreview || c.latestMessagePreview);
              const latestAt = msCurrent >= msExisting
                ? (c.latestMessageAt || existing.latestMessageAt)
                : (existing.latestMessageAt || c.latestMessageAt);

              const nameCandidates = [
                existing.otherProfile?.displayName,
                c.otherProfile?.displayName,
                existing.name,
                c.name,
                existing.otherProfile?.username,
                c.otherProfile?.username
              ];
              const bestName = nameCandidates.find(n => 
                n && typeof n === 'string' && 
                n.toLowerCase() !== 'aeirmist user' && 
                n.toLowerCase() !== 'aeirmist member' && 
                n.toLowerCase() !== 'chat'
              ) || existing.name || c.name;

              const bestPhoto = existing.photo || c.photo || null;

              // Retain canonical UUID whenever available (never prefer synthetic underscore keys)
              const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
              const preferredId = isUuid(c.id) ? c.id : (isUuid(existingId) ? existingId : c.id);

              const merged: Chat = {
                ...existing,
                ...c,
                id: preferredId,
                name: bestName,
                photo: bestPhoto,
                latestMessagePreview: latestPreview,
                latestMessageAt: latestAt,
                otherParticipantId: existing.otherParticipantId || c.otherParticipantId,
                otherParticipantUid: existing.otherParticipantUid || c.otherParticipantUid,
                otherProfile: { ...(existing.otherProfile || {}), ...(c.otherProfile || {}) }
              };

              listMap.delete(existingId);
              listMap.delete(c.id);
              listMap.set(preferredId, merged);
              directPartnerMap.set(partnerKey, preferredId);
              continue;
            }
          } else {
            directPartnerMap.set(partnerKey, c.id);
          }
        }

        listMap.set(c.id, c);
      }

      const list = Array.from(listMap.values());
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

    // 3. Socket listener for real-time inbox bumps & reconnect reconciliation
    const socket = getSocket();

    const handleReconnect = () => {
      if (!isCancelled) fetchApiChats();
    };
    socket.on('connect', handleReconnect);

    const handleVisibilityChange = () => {
      if (!isCancelled && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchApiChats();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Relaxed offline fallback (Only runs if socket is disconnected)
    const fallbackInterval = setInterval(() => {
      if (!isCancelled && !socket.connected) {
        fetchApiChats();
      }
    }, 45000);

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

    const handleSeenUpdate = () => {
      if (!isCancelled) fetchApiChats();
    };
    socket.on('seen_update', handleSeenUpdate);

    const cleanup = () => {
      isCancelled = true;
      clearInterval(fallbackInterval);
      socket.off('connect', handleReconnect);
      socket.off('new_message', handleNewMessage);
      socket.off('seen_update', handleSeenUpdate);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (this.listeners.get(key) === cleanup) {
        this.listeners.delete(key);
      }
    };

    this.listeners.set(key, cleanup);
    return cleanup;
  }

  // Group Chat Functions

  public async createGroupConversation(
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
      return conv?.id || `group_${Date.now()}`;
    } catch (err: any) {
      logger.error("[MessagingService] Failed to create group:", err);
      throw err;
    }
  }

  public async sendSystemEvent(_db: any, conversationId: string, eventText: string) {
    logger.info(`[MessagingService] System event for ${conversationId}: ${eventText}`);
  }

  public async addGroupMembers(_db: any, conversationId: string, _requesterId: string, newMemberIds: string[], _memberDetailsMap?: Record<string, any>, _actorName?: string) {
    logger.info(`[MessagingService] addGroupMembers in ${conversationId}:`, newMemberIds);
  }

  public async removeGroupMember(_db: any, conversationId: string, _adminId: string, memberIdToRemove: string, _actorName?: string, _memberName?: string, _reason?: string) {
    logger.info(`[MessagingService] removeGroupMember in ${conversationId}: ${memberIdToRemove}`);
  }

  public async promoteToAdmin(_db: any, conversationId: string, _adminId: string, memberIdToPromote: string) {
    logger.info(`[MessagingService] promoteToAdmin in ${conversationId}: ${memberIdToPromote}`);
  }

  public async demoteAdmin(_db: any, conversationId: string, _adminId: string, memberIdToDemote: string) {
    logger.info(`[MessagingService] demoteAdmin in ${conversationId}: ${memberIdToDemote}`);
  }

  public async setMemberRole(_db: any, conversationId: string, _requesterId: string, targetId: string, role: string) {
    logger.info(`[MessagingService] setMemberRole in ${conversationId}: ${targetId} -> ${role}`);
  }

  public async transferOwnership(_db: any, conversationId: string, _currentOwnerId: string, newOwnerId: string) {
    logger.info(`[MessagingService] transferOwnership in ${conversationId} to ${newOwnerId}`);
  }

  public async toggleMuteMember(_db: any, conversationId: string, memberId: string, isMuted: boolean) {
    logger.info(`[MessagingService] toggleMuteMember in ${conversationId}: ${memberId} -> ${isMuted}`);
  }

  public async requestToJoinGroup(_db: any, conversationId: string, requesterId: string) {
    logger.info(`[MessagingService] requestToJoinGroup in ${conversationId}: ${requesterId}`);
  }

  public async approveJoinRequest(_db: any, conversationId: string, _adminId: string, requesterId: string) {
    logger.info(`[MessagingService] approveJoinRequest in ${conversationId}: ${requesterId}`);
  }

  public async rejectJoinRequest(_db: any, conversationId: string, _adminId: string, requesterId: string) {
    logger.info(`[MessagingService] rejectJoinRequest in ${conversationId}: ${requesterId}`);
  }

  public async updateGroupDetails(_db: any, conversationId: string, updates: any) {
    logger.info(`[MessagingService] updateGroupDetails in ${conversationId}:`, updates);
  }

  public async setGroupNickname(_db: any, conversationId: string, memberId: string, nickname: string) {
    logger.info(`[MessagingService] setGroupNickname in ${conversationId}: ${memberId} -> ${nickname}`);
  }

  public async leaveGroup(_db: any, conversationId: string, memberId: string) {
    logger.info(`[MessagingService] leaveGroup in ${conversationId}: ${memberId}`);
  }

  public async deleteGroup(_db: any, conversationId: string, _requesterId: string) {
    logger.info(`[MessagingService] deleteGroup in ${conversationId}`);
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
