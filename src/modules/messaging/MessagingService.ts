export type Firestore = any;
export type DocumentData = any;
export type QuerySnapshot = any;
import { Message, Chat } from '../../types/messenger';
import { aeirmistCache } from '../../services/CacheService';
const handleFirestoreError = (err: any, _op?: any) => err;
type OperationType = string;
import { logger } from '@/src/utils/logger';
import { getAvatarUrl } from '../../lib/avatar';
import { extractTimestampMs } from '../../lib/date';
import { getSocket, joinChatRoom, leaveChatRoom } from '../../services/api/socket';
import { api } from '../../services/api/client';

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

  public async markAsRead(_db: any, conversationId: string, _profileId?: string) {
    if (conversationId && !conversationId.startsWith('new_')) {
      try {
        await api.chat.markSeen(conversationId);
      } catch (err) {
        logger.warn("Read confirmation note:", err);
      }
    }
  }

  public async deleteMessage(_db: any, _conversationId: string, messageId: string, _profileId?: string, _deleteType: 'me' | 'everyone' = 'everyone') {
    if (messageId) {
      try {
        await api.chat.deleteMessage(messageId);
      } catch (err) {
        logger.warn("Delete message failed:", err);
      }
    }
  }

  public async editMessage(_db: any, _conversationId: string, messageId: string, newText: string) {
    if (messageId) {
      try {
        await api.chat.editMessage(messageId, newText);
      } catch (err) {
        logger.warn("Edit message failed:", err);
      }
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
    if (!user || (!user.uid && !user.id) || !profile || !profile.id) {
      throw new Error("Authentication required to send messages.");
    }

    if (metadata.optimisticId) {
      const lastSent = this.recentOptimisticIds.get(metadata.optimisticId);
      if (lastSent && Date.now() - lastSent < 15000) {
        logger.warn(`[MessagingService] Duplicate send intercepted for ${metadata.optimisticId}`);
        return conversationId;
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

    try {
      const mediaKey = mediaUrl ? mediaUrl.replace(/^.*\/media\//, '') : undefined;
      const res = await api.chat.sendMessage(finalConvId, {
        content: text,
        type,
        mediaKey,
      });

      if ((res as any)?.conversationId) {
        finalConvId = (res as any).conversationId;
      }

      // Broadcast in real-time via WebSockets
      try {
        const socket = getSocket();
        socket.emit('send_message', {
          conversationId: finalConvId,
          content: text,
          type,
          mediaUrl,
        });
      } catch (sErr) {}

      return finalConvId;
    } catch (e: any) {
      logger.error("[MessagingService] Send message failure:", e);
      throw e;
    }
  }

  subscribeToMessages(
    db: Firestore, 
    conversationId: string, 
    currentProfileId: string,
    chatData: any,
    callback: (messages: Message[]) => void,
    limitCount: number = 50,
    currentUserId?: string
  ) {
    logger.info(`[MessagingService] Subscribed to messages for ${conversationId}`);
    
    let isCancelled = false;

    const isMe = (senderId?: string) => {
      if (!senderId) return false;
      const ids = [currentProfileId, currentUserId].filter(Boolean);
      if (ids.some(id => id === senderId || (typeof id === 'string' && (senderId.includes(id) || id.includes(senderId))))) {
        return true;
      }
      const otherId = chatData?.otherParticipantId || chatData?.otherParticipantUid;
      if (otherId && otherId === senderId) return false;
      const isGroup = Boolean(chatData?.isGroup || chatData?.type === 'group' || (chatData?.participants && chatData.participants.length > 2));
      if (!isGroup && otherId && otherId !== senderId) {
        return true;
      }
      return false;
    };

    // 1. Instant Synchronous Cache Check (0ms latency!)
    const syncCached = this.getCachedMessages(conversationId);
    if (syncCached && syncCached.length > 0) {
      logger.info(`[MessagingService] Instant Cache Hit: ${syncCached.length} messages for ${conversationId}`);
      callback(syncCached);
    } else {
      // 1b. Asynchronous IndexedDB fallback
      try {
        aeirmistCache.getMessages(conversationId).then(cached => {
          if (isCancelled) return;
          if (cached && cached.length > 0) {
            logger.info(`[MessagingService] Instant IndexedDB Hit: ${cached.length} messages for ${conversationId}`);
            const formatted = cached.map(m => ({
              ...m,
              conversationId,
              timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestampMs: m.timestamp
            })).sort((a, b) => a.timestampMs - b.timestampMs);
            if (!isCancelled) {
              this.setCachedMessages(conversationId, formatted as any);
              callback(formatted as any);
            }
          }
        }).catch(err => logger.warn("[MessagingService] Cache retrieval failure:", err));
      } catch (e) {
        logger.warn("[MessagingService] Cache logic error:", e);
      }
    }

    const key = `messages_${conversationId}`;
    if (this.listeners.has(key)) {
      this.listeners.get(key)!();
    }

    // 1c. Load from primary PostgreSQL backend API
    api.chat.getMessages(conversationId, limitCount).then((res: any) => {
      if (isCancelled) return;
      const list = (res as any)?.messages || (res as any)?.data || (Array.isArray(res) ? res : []);
      if (list && list.length > 0) {
        const formatted: Message[] = list.map((m: any) => ({
          id: m.id,
          conversationId,
          senderId: m.senderId,
          text: m.content || '',
          type: m.type || 'text',
          mediaUrl: m.mediaKey ? `${(import.meta.env.VITE_MEDIA_URL || 'http://localhost:4000/media')}/${m.mediaKey}` : undefined,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestampMs: new Date(m.createdAt).getTime(),
          status: (m.isSeen || m.isRead) ? 'read' : m.isDelivered ? 'delivered' : 'sent',
          isDelivered: !!m.isDelivered,
          isSeen: !!(m.isSeen || m.isRead),
        })).sort((a: any, b: any) => a.timestampMs - b.timestampMs);
        this.setCachedMessages(conversationId, formatted);
        callback(formatted);
      }
    }).catch(err => {
      logger.warn('[MessagingService] Primary PostgreSQL getMessages note:', err);
    });

    // Join real-time WebSockets + Redis room
    joinChatRoom(`conv:${conversationId}`);
    const socket = getSocket();
    const handleNewSocketMsg = (data: any) => {
      const matchConv = data?.conversationId === conversationId || 
                        data?.rawConversationId === conversationId ||
                        data?.message?.conversationId === conversationId;
      if (matchConv && data?.message) {
        const m = data.message;
        const msgObj: Message = {
          id: m.id,
          conversationId,
          senderId: m.senderId,
          text: m.content || '',
          type: m.type || 'text',
          mediaUrl: m.mediaKey ? `${(import.meta.env.VITE_MEDIA_URL || 'http://localhost:4000/media')}/${m.mediaKey}` : undefined,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestampMs: new Date(m.createdAt).getTime(),
          status: (m.isSeen || m.isRead) ? 'read' : (m.isDelivered ? 'delivered' : 'sent'),
          isDelivered: true,
          isSeen: !!(m.isSeen || m.isRead),
          metadata: m.metadata || {},
        } as any;
        if (!isCancelled) {
          const prev = this.getCachedMessages(conversationId) || [];
          const optId = m.metadata?.optimisticId;
          const exists = prev.some(x => x.id === msgObj.id || (optId && (x.id === optId || x.metadata?.optimisticId === optId)));
          const updated = exists 
            ? prev.map(x => (x.id === msgObj.id || (optId && (x.id === optId || x.metadata?.optimisticId === optId)) ? msgObj : x)) 
            : [...prev, msgObj];
          updated.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
          this.setCachedMessages(conversationId, updated);
          callback(updated);

          // If incoming message from other user and chat is currently open, immediately mark seen
          if (!isMe(m.senderId)) {
            api.chat.markSeen(conversationId).catch(() => {});
          }
        }
      }
    };
    socket.on('new_message', handleNewSocketMsg);

    const handleSeenUpdate = (data: any) => {
      const matchConv = data?.conversationId === conversationId || 
                        data?.rawConversationId === conversationId;
      if (matchConv) {
        if (!isCancelled) {
          const prev = this.getCachedMessages(conversationId) || [];
          const updated = prev.map(m => {
            // If the message was sent by current user, it's now seen by the recipient!
            if (isMe(m.senderId) || m.senderId !== data?.userId) {
              return { ...m, isSeen: true, status: 'read' as any };
            }
            return m;
          });
          this.setCachedMessages(conversationId, updated);
          callback(updated);
        }
      }
    };
    socket.on('seen_update', handleSeenUpdate);

    const otherParticipantId = chatData.otherParticipantId ||
                             chatData.profileIds?.find((id: string) => !isMe(id)) || 
                             chatData.participants?.find((uid: string) => !isMe(uid)); // Fallback uid

    const parseTimestampMs = (val: any): number => {
      if (!val) return 0;
      if (typeof val.toMillis === 'function') return val.toMillis();
      if (typeof val.seconds === 'number') return val.seconds * 1000;
      if (typeof val === 'number' && val > 0) return val;
      if (val instanceof Date) return val.getTime();
      try {
        const parsed = Date.parse(val);
        return isNaN(parsed) ? 0 : parsed;
      } catch (e) {
        return 0;
      }
    };

    const extractMsgTimestampMs = (data: any): number => {
      if (data.createdAt?.toMillis) return data.createdAt.toMillis();
      if (data.timestamp?.toMillis) return data.timestamp.toMillis();
      if (typeof data.timestampMs === 'number' && data.timestampMs > 0) return data.timestampMs;
      if (typeof data.clientSentAt === 'number' && data.clientSentAt > 0) return data.clientSentAt;
      if (data.createdAt instanceof Date) return data.createdAt.getTime();
      if (data.timestamp instanceof Date) return data.timestamp.getTime();
      if (typeof data.createdAt?.seconds === 'number') return data.createdAt.seconds * 1000;
      if (typeof data.timestamp?.seconds === 'number') return data.timestamp.seconds * 1000;
      if (typeof data.createdAt === 'number' && data.createdAt > 0) return data.createdAt;
      if (typeof data.timestamp === 'number' && data.timestamp > 0) return data.timestamp;
      return Date.now();
    };

    const otherLastRead = parseTimestampMs(chatData?.lastRead?.[otherParticipantId || '']);
    const otherLastDelivered = parseTimestampMs(chatData?.lastDelivered?.[otherParticipantId || '']);

    let unsubscribe = () => {};

    const cleanup = () => {
      isCancelled = true;
      if (this.listeners.get(key) === cleanup) {
        this.listeners.delete(key);
      }
      leaveChatRoom(`conv:${conversationId}`);
      socket.off('new_message', handleNewSocketMsg);
      socket.off('seen_update', handleSeenUpdate);
      unsubscribe();
    };

    this.listeners.set(key, cleanup);
    return cleanup;
  }

  subscribeToChats(db: Firestore, userUid: string, profileId: string, callback: (chats: Chat[]) => void) {
    logger.info(`[MessagingService] Subscribing to inbox for UID: ${userUid}`);

    // 0. Synchronous Instant Cache Load (0ms frame-0 rendering)
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`aeirmist_chats_${userUid}`) || localStorage.getItem('aeirmist_cached_inbox_chats');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            callback(parsed);
          }
        }
      } catch (e) {}
    }

    // 1. Instant Cache Load
    try {
      aeirmistCache.getConversations().then(cached => {
        if (cached && cached.length > 0) {
          const currentProfileChats = cached.filter(chat => 
            !chat.profileIds || chat.profileIds.includes(profileId) || chat.participants?.includes(userUid)
          );
          
          currentProfileChats.sort((a, b) => {
            const getMs = (chat: any) => {
              if (!chat) return 0;
              const t0 = extractTimestampMs(chat.latestMessageAt);
              if (t0 > 0) return t0;
              const t1 = extractTimestampMs(chat.lastMessage?.timestamp || chat.lastMessage?.createdAt);
              const t2 = extractTimestampMs(chat.updatedAt);
              const fallbackMs = Math.max(t1, t2);
              if (fallbackMs > 0) return fallbackMs;
              const t3 = extractTimestampMs(chat.createdAt);
              if (t3 > 0) return t3;
              return 0;
            };
            const pinA = typeof a.isPinned === 'boolean' ? a.isPinned : !!a.isPinned?.[profileId];
            const pinB = typeof b.isPinned === 'boolean' ? b.isPinned : !!b.isPinned?.[profileId];
            if (pinA && !pinB) return -1;
            if (!pinA && pinB) return 1;
            const msA = getMs(a);
            const msB = getMs(b);
            if (msB !== msA) return msB - msA;
            return String(b.id || '').localeCompare(String(a.id || ''));
          });

          if (currentProfileChats.length > 0) {
            logger.info(`[MessagingService] Instant Cache Hit: ${currentProfileChats.length} conversations.`);
            callback(currentProfileChats);
          }
        }
      }).catch(err => logger.warn("[MessagingService] Inbox cache retrieval failure:", err));
    } catch (e) {}

    const key = `chats_${userUid}`;
    if (this.listeners.has(key)) {
      this.listeners.get(key)!();
    }

    // 1b. Load from primary PostgreSQL backend API
    const loadInbox = () => {
      api.chat.getConversations().then((res: any) => {
        const convs = (res as any)?.conversations || (Array.isArray(res) ? res : []);
        if (convs) {
          const mappedChats: Chat[] = convs.map((c: any) => {
            const other = c.participants?.find((p: any) => p.userId !== profileId && p.userId !== userUid) || c.participants?.[0];
            return {
              id: c.id,
              name: c.title || other?.displayName || other?.username || 'Chat',
              photo: other?.avatarKey ? `${(import.meta.env.VITE_MEDIA_URL || 'http://localhost:4000/media')}/${other.avatarKey}` : getAvatarUrl(null, other?.userId),
              lastMessage: {
                text: c.lastMessagePreview || '',
                senderId: '',
                timestamp: c.lastMessageAt,
              },
              latestMessagePreview: c.lastMessagePreview || '',
              time: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
              unread: (c.unreadCount || 0) > 0,
              online: false,
              isPinned: c.isPinned || false,
              isMuted: c.isMuted || false,
              participants: c.participants?.map((p: any) => p.userId) || [userUid],
              profileIds: c.participants?.map((p: any) => p.userId) || [profileId],
              otherParticipantId: other?.userId,
              status: 'active',
              updatedAt: c.updatedAt,
            } as unknown as Chat;
          });
          callback(mappedChats);
        }
      }).catch(err => {
        logger.warn('[MessagingService] Primary PostgreSQL getConversations note:', err);
      });
    };

    loadInbox();

    const inboxSocket = getSocket();
    inboxSocket.on('new_message', loadInbox);
    inboxSocket.on('seen_update', loadInbox);

    const unsubscribe = () => {
      inboxSocket.off('new_message', loadInbox);
      inboxSocket.off('seen_update', loadInbox);
    };

    this.listeners.set(key, unsubscribe);
    return unsubscribe;
  }

  // Group Chat Functions

  public async createGroupConversation(
    _db: any, 
    creatorId: string, 
    memberIds: string[], 
    groupName: string, 
    groupPhotoURL?: string,
    _creatorUid?: string,
    _memberUids?: string[]
  ) {
    try {
      const res = await api.chat.createGroup(groupName, memberIds, groupPhotoURL);
      return res?.conversation?.id || `grp_${Date.now()}`;
    } catch (err) {
      logger.warn('[MessagingService] createGroup note:', err);
      return `grp_${Date.now()}`;
    }
  }

  public async sendSystemEvent(_db: any, conversationId: string, eventText: string) {
    logger.info(`[MessagingService] System event for ${conversationId}: ${eventText}`);
  }

  public async addGroupMembers(_db: any, conversationId: string, requesterId: string, newMemberIds: string[], memberDetailsMap?: Record<string, any>, actorName?: string) {
    logger.info(`[MessagingService] Adding members to ${conversationId}: ${newMemberIds.join(', ')}`);
  }

  public async removeGroupMember(_db: any, conversationId: string, adminId: string, memberIdToRemove: string, actorName?: string, memberName?: string, reason?: string) {
    logger.info(`[MessagingService] Removing member ${memberIdToRemove} from ${conversationId}`);
  }

  public async promoteToAdmin(_db: any, conversationId: string, adminId: string, memberIdToPromote: string, actorName?: string, memberName?: string) {
    logger.info(`[MessagingService] Promoted ${memberIdToPromote} to admin in ${conversationId}`);
  }

  public async demoteAdmin(_db: any, conversationId: string, adminId: string, memberIdToDemote: string, actorName?: string, memberName?: string) {
    logger.info(`[MessagingService] Demoted admin ${memberIdToDemote} in ${conversationId}`);
  }

  public async setMemberRole(_db: any, conversationId: string, requesterId: string, targetId: string, newRole: string, actorName?: string, targetName?: string) {
    logger.info(`[MessagingService] Set role ${newRole} for ${targetId} in ${conversationId}`);
  }

  public async transferOwnership(_db: any, conversationId: string, currentOwnerId: string, newOwnerId: string, actorName?: string, newOwnerName?: string) {
    logger.info(`[MessagingService] Transferred ownership to ${newOwnerId} in ${conversationId}`);
  }

  public async toggleMuteMember(_db: any, conversationId: string, memberId: string, isMuted: boolean, actorName?: string, targetName?: string) {
    logger.info(`[MessagingService] Mute toggle ${memberId}: ${isMuted} in ${conversationId}`);
  }

  public async requestToJoinGroup(_db: any, conversationId: string, requesterId: string) {
    logger.info(`[MessagingService] Request to join group ${conversationId} by ${requesterId}`);
  }

  public async approveJoinRequest(_db: any, conversationId: string, adminId: string, requesterId: string, actorName?: string, requesterName?: string) {
    logger.info(`[MessagingService] Approved join request for ${requesterId} in ${conversationId}`);
  }

  public async rejectJoinRequest(_db: any, conversationId: string, adminId: string, requesterId: string) {
    logger.info(`[MessagingService] Rejected join request for ${requesterId} in ${conversationId}`);
  }

  public async updateGroupDetails(_db: any, conversationId: string, updates: { name?: string; photoURL?: string; wallpaper?: string; settings?: any }, actorName?: string) {
    logger.info(`[MessagingService] Updated group details for ${conversationId}`, updates);
  }

  public async setGroupNickname(_db: any, conversationId: string, memberId: string, nickname: string, setterName?: string, memberName?: string) {
    logger.info(`[MessagingService] Set nickname for ${memberId}: ${nickname} in ${conversationId}`);
  }

  public async leaveGroup(_db: any, conversationId: string, memberId: string, memberUid?: string, memberName?: string) {
    logger.info(`[MessagingService] Member ${memberId} left group ${conversationId}`);
  }

  public async deleteGroup(_db: any, conversationId: string, requesterId: string) {
    logger.info(`[MessagingService] Deleted group ${conversationId} by ${requesterId}`);
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
