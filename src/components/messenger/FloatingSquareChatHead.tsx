import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  MessageSquare, 
  Maximize2, 
  SquarePen, 
  Loader2, 
  Search, 
  ShieldCheck,
  ChevronLeft 
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl, getGroupAvatarUrl } from '../../lib/avatar';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';
import { SystemChatHead } from '../../utils/nativeSettings';
import { DockedChatWindow } from './DockedChatWindow';
import { api } from '../../services/api/client';
import { messagingService } from '../../modules/messaging/MessagingService';
import { logger } from '../../utils/logger';
import { formatShortTimestamp } from '../../lib/date';

interface FloatingSquareChatHeadProps {
  onOpenChat: (chatId: string) => void;
  onNewMessage?: () => void;
  isInboxView?: boolean;
}

type Head = { 
  id: string; 
  name: string; 
  photo?: string; 
  unreadCount?: number; 
  participantId?: string; 
  themeSettings?: any;
  isVerified?: boolean;
};

interface MessagePreview {
  text: string;
  senderName: string;
}

const HeadBubble: React.FC<{
  head: Head;
  isOpenInDock?: boolean;
  preview?: MessagePreview;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
}> = ({ head, isOpenInDock, preview, onOpen, onClose }) => {
  const { onlineUsers, profile, user } = useAeirmist();
  const [isHovered, setIsHovered] = useState(false);
  const avatar = getAvatarUrl(head.photo, head.name || head.id);
  
  const isOnline = Boolean(
    (head.participantId && head.participantId !== profile?.id && head.participantId !== user?.uid && onlineUsers?.has(head.participantId)) ||
    (head.id && !head.id.startsWith('conv_') && head.id !== profile?.id && head.id !== user?.uid && onlineUsers?.has(head.id))
  );

  return (
    <motion.div
      layout
      initial={{ scale: 0, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => { e.stopPropagation(); onOpen(head.id); }}
      className="relative cursor-pointer group select-none"
    >
      {/* Squircle frame — Aeirmist cyber aesthetics */}
      <div 
        className={`relative w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-neutral-900 border-2 transition-all duration-200 group-hover:scale-105 active:scale-95 overflow-hidden ${
          isOpenInDock
            ? 'border-aeirmist-cyan shadow-[0_0_20px_rgba(0,242,255,0.45)] ring-2 ring-aeirmist-cyan/30'
            : 'border-white/15 hover:border-aeirmist-cyan/70 shadow-[0_8px_25px_rgba(0,0,0,0.5)]'
        }`}
      >
        <img
          src={avatar}
          alt={head.name}
          className="w-full h-full object-cover rounded-xl"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 -z-10 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 text-aeirmist-cyan">
          <MessageSquare size={22} />
        </div>
        {/* Active online badge */}
        {isOnline && (
          <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-aeirmist-lime border-2 border-neutral-950 ring-1 ring-aeirmist-lime/50 shadow-[0_0_8px_rgba(191,255,0,0.7)]" />
        )}
        
        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
          <Maximize2 size={16} className="text-white drop-shadow-md" />
        </div>
      </div>

      {/* Live Message Pop-up Preview Bubble */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, x: -15, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -15, scale: 0.9 }}
            className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-auto px-3.5 py-2 rounded-2xl bg-[#0e1019]/98 backdrop-blur-2xl border border-aeirmist-cyan/50 text-white shadow-[0_0_25px_rgba(0,242,255,0.35)] z-50 min-w-[140px] max-w-[230px] cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(head.id);
            }}
          >
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-aeirmist-cyan font-bold text-[10px] truncate">{preview.senderName || head.name}</span>
              <span className="text-[8px] text-white/40 font-mono">now</span>
            </div>
            <p className="text-white/90 text-[11px] truncate leading-tight font-medium">{preview.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Name tooltip */}
      <AnimatePresence>
        {!preview && isHovered && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none px-3 py-1.5 rounded-xl bg-black/90 backdrop-blur-md border border-white/15 text-white text-[11px] font-bold whitespace-nowrap shadow-2xl z-50 flex items-center gap-1.5"
          >
            <span className="truncate max-w-[130px] block">{head.name}</span>
            {head.isVerified && <ShieldCheck size={11} className="text-aeirmist-cyan shrink-0" />}
            {isOpenInDock && <span className="text-[9px] text-aeirmist-cyan font-mono">• open</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close button on hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(head.id); }}
        title="Dismiss Chat Head"
        className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-neutral-900 border border-white/20 text-white/70 hover:text-white hover:bg-rose-600 transition-all flex items-center justify-center shadow-lg cursor-pointer opacity-80 sm:opacity-0 group-hover:opacity-100"
      >
        <X size={11} strokeWidth={3} />
      </button>
    </motion.div>
  );
};

export const FloatingSquareChatHead: React.FC<FloatingSquareChatHeadProps> = ({ 
  onOpenChat, 
  onNewMessage,
  isInboxView = false 
}) => {
  const { db, floatingChatHeads, setFloatingChatHeads, removeFloatingChatHead, profile, user, onlineUsers, addToast } = useAeirmist();
  
  // Floating Messages Card & Active Docked Chat state
  const [isMessagesPopupOpen, setIsMessagesPopupOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  const [activePreviews, setActivePreviews] = useState<Record<string, MessagePreview>>({});
  
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerBtnRef = useRef<HTMLDivElement>(null);
  const lastHeadClickRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  // Responsive breakpoint tracking
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chatHeadsEnabled = profile?.messagingSettings?.enableChatHeads !== false;
  const heads: Head[] = chatHeadsEnabled ? (floatingChatHeads || []) : [];

  // Helper: check if a participant or conversation is active/online
  const isUserOnline = useCallback((c: any, participantId?: string): boolean => {
    if (c.online === true) return true;
    if (c.otherParticipant?.isOnline === true || c.otherParticipant?.online === true) return true;
    if (c.otherProfile?.isOnline === true || c.otherProfile?.online === true) return true;

    const candidateIds = [
      participantId,
      c.otherParticipantId,
      c.otherParticipantUid,
      c.otherParticipant?.userId,
      c.otherParticipant?.firebaseUid,
      c.otherParticipant?.profileId,
      c.otherParticipant?.id,
      c.otherProfile?.userId,
      c.otherProfile?.firebaseUid,
      c.otherProfile?.profileId,
      c.otherProfile?.id,
      c.otherProfile?.username
    ].filter(Boolean) as string[];

    if (onlineUsers && onlineUsers.size > 0) {
      for (const cid of candidateIds) {
        if (cid === profile?.id || cid === user?.uid) continue;
        const lower = String(cid).toLowerCase();
        if (onlineUsers.has(cid) || onlineUsers.has(lower)) return true;
        const cleanProfile = lower.replace(/^profile_/, '');
        if (onlineUsers.has(cleanProfile) || onlineUsers.has(`profile_${cleanProfile}`)) return true;
      }
    }
    return false;
  }, [onlineUsers, profile?.id, user?.uid]);

  // Subscribe to real-time chats across PostgreSQL, IndexedDB, Sockets via MessagingService
  useEffect(() => {
    if (!user?.uid || !profile?.id) return;

    const unsubscribe = messagingService.subscribeToChats(db, user.uid, profile.id, (chats) => {
      if (Array.isArray(chats) && chats.length > 0) {
        setConversations(chats);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [db, user?.uid, profile?.id]);

  // Direct fetch fallback from API
  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const res = await api.chat.getConversations();
      const list: any[] = res?.conversations || [];
      if (list.length > 0) {
        setConversations(prev => {
          if (prev.length === 0) return list;
          const map = new Map(prev.map(c => [c.id, c]));
          list.forEach(c => {
            const existing = map.get(c.id);
            map.set(c.id, { ...existing, ...c });
          });
          return Array.from(map.values());
        });
      }
    } catch (err) {
      logger.error('[FloatingSquareChatHead] Failed to load conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Fetch initial conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Refresh conversations when popup opens
  useEffect(() => {
    if (isMessagesPopupOpen) {
      loadConversations();
    }
  }, [isMessagesPopupOpen, loadConversations]);

  // Close popup on click outside
  useEffect(() => {
    if (!isMessagesPopupOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current && 
        !popupRef.current.contains(e.target as Node) &&
        triggerBtnRef.current &&
        !triggerBtnRef.current.contains(e.target as Node)
      ) {
        setIsMessagesPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMessagesPopupOpen]);

  // Listen for real-time incoming message pop-up preview events & live updates
  useEffect(() => {
    const handlePreview = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.chatId || !detail?.text) return;

      setActivePreviews(prev => ({
        ...prev,
        [detail.chatId]: { text: detail.text, senderName: detail.senderName || 'Message' }
      }));

      loadConversations();

      setTimeout(() => {
        setActivePreviews(prev => {
          const next = { ...prev };
          delete next[detail.chatId];
          return next;
        });
      }, 6000);
    };

    const handleChatDeleted = (e: any) => {
      const cid = e.detail?.conversationId;
      if (cid) {
        removeFloatingChatHead?.(cid);
        if (activeChatId === cid) setActiveChatId(null);
        setConversations(prev => prev.filter(c => c.id !== cid));
      }
    };

    const handleIncomingLive = () => {
      loadConversations();
    };

    window.addEventListener('aeirmist_chathead_preview', handlePreview);
    window.addEventListener('aeirmist_chat_deleted', handleChatDeleted);
    window.addEventListener('aeirmist_message_received', handleIncomingLive);
    window.addEventListener('aeirmist_chat_updated', handleIncomingLive);
    window.addEventListener('aeirmist_conversation_updated', handleIncomingLive);

    return () => {
      window.removeEventListener('aeirmist_chathead_preview', handlePreview);
      window.removeEventListener('aeirmist_chat_deleted', handleChatDeleted);
      window.removeEventListener('aeirmist_message_received', handleIncomingLive);
      window.removeEventListener('aeirmist_chat_updated', handleIncomingLive);
      window.removeEventListener('aeirmist_conversation_updated', handleIncomingLive);
    };
  }, [activeChatId, loadConversations, removeFloatingChatHead]);

  // Stable key so native sync only runs when something actually changed
  const headsKey = heads.map(h => `${h.id}|${h.name}|${h.photo || ''}|${h.unreadCount || 0}`).join(';');

  // ── Sync with native system-wide overlay (Android app background service) ──
  useEffect(() => {
    if (!SystemChatHead.isSupported()) return;
    let cancelled = false;

    if (heads.length === 0) {
      SystemChatHead.disable();
      return;
    }

    const payload = heads.map(h => {
      const url = getAvatarUrl(h.photo);
      return {
        id: h.id,
        name: h.name || 'Chat',
        avatarUrl: typeof url === 'string' && url.startsWith('http') ? url : '',
        unread: h.unreadCount || 0,
      };
    });

    const tryEnable = async () => {
      const granted = await SystemChatHead.hasPermission();
      if (cancelled) return;
      if (granted) {
        await SystemChatHead.enable({ heads: JSON.stringify(payload) });
        return;
      }
      if (!localStorage.getItem('aeirmist_overlay_prompted')) {
        localStorage.setItem('aeirmist_overlay_prompted', '1');
        addToast?.({
          title: 'Allow chat heads outside the app',
          message: 'Turn on "Display over other apps" for Aeirmist to keep chat heads on screen.',
          type: 'info',
        });
        setTimeout(() => SystemChatHead.requestPermission(), 900);
      }
    };

    tryEnable();
    const onVisible = () => { if (document.visibilityState === 'visible') tryEnable(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headsKey]);

  // Native head tapped outside the app → open that chat
  useEffect(() => {
    const onNativeOpen = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (!id) return;
      setActiveChatId(id);
      setIsMessagesPopupOpen(true);
    };
    const onNativeClose = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id) removeFloatingChatHead(id);
    };
    window.addEventListener('aeirmist_chathead_open', onNativeOpen);
    window.addEventListener('aeirmist_chathead_close', onNativeClose);
    return () => {
      window.removeEventListener('aeirmist_chathead_open', onNativeOpen);
      window.removeEventListener('aeirmist_chathead_close', onNativeClose);
    };
  }, [removeFloatingChatHead]);

  // Toggle Messages Popup from cyan squircle floating button
  const handleFloatingButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerNativeHaptic('selection');
    setIsMessagesPopupOpen(prev => !prev);
  };

  // Click on a head bubble in the column
  const handleHeadClick = (id: string) => {
    const now = Date.now();
    if (lastHeadClickRef.current.id === id && now - lastHeadClickRef.current.time < 450) {
      return;
    }
    lastHeadClickRef.current = { id, time: now };
    triggerNativeHaptic('selection');

    if (activeChatId === id && isMessagesPopupOpen) {
      setIsMessagesPopupOpen(false);
    } else {
      setActiveChatId(id);
      setIsMessagesPopupOpen(true);
    }
  };

  const handleCloseHead = (id: string) => {
    triggerNativeHaptic('light');
    if (activeChatId === id) setActiveChatId(null);
    removeFloatingChatHead(id);
  };

  // Helper to extract conversation presentation info including Nicknames and Verified Badge
  const getConversationDisplay = useCallback((c: any) => {
    const isGrp = c.isGroup || c.type === 'group';
    const other = c.otherParticipant || c.otherProfile;
    const participantId = isGrp ? undefined : (c.otherParticipantId || other?.id || other?.userId || other?.firebaseUid || undefined);
    const targetUserId = participantId || other?.userId || other?.id || other?.profileId;

    // ── Nickname Resolution ──
    let nickname = '';
    if (targetUserId) {
      // 1. Check conversation theme settings
      if (c.themeSettings?.nicknames && c.themeSettings.nicknames[targetUserId]) {
        nickname = c.themeSettings.nicknames[targetUserId];
      }
      // 2. Check conversation root nicknames
      if (!nickname && c.nicknames && c.nicknames[targetUserId]) {
        nickname = c.nicknames[targetUserId];
      }
      // 3. Check other participant/profile nickname
      if (!nickname && (other?.nickname || c.nickname)) {
        nickname = other?.nickname || c.nickname;
      }
      // 4. Check locally saved chat settings
      if (!nickname && typeof window !== 'undefined' && c.id) {
        try {
          const raw = localStorage.getItem(`chat_settings_${c.id}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.nicknames && parsed.nicknames[targetUserId]) {
              nickname = parsed.nicknames[targetUserId];
            }
          }
        } catch {}
      }
    }

    const baseName = isGrp ? (c.title || c.groupName || c.name || 'Group') : (c.name || other?.displayName || other?.username || 'Chat');
    const finalDisplayName = nickname || baseName;

    // ── Verified Badge Resolution ──
    const isVerified = Boolean(
      c.isVerified ||
      other?.isVerified ||
      c.otherProfile?.isVerified ||
      c.otherParticipant?.isVerified ||
      c.badge === 'verified' ||
      other?.badge === 'verified'
    );

    // ── Photo Resolution ──
    let photo = isGrp ? (c.avatarKey || c.groupPhotoURL || c.groupPhoto || c.photo) : (c.photo || other?.photoURL || other?.avatarKey || '');
    if (isGrp) {
      // If group photo is a member photo or empty/null, ensure it's a real group photo or cyber group DP
      if (!photo || photo === other?.photoURL || photo === other?.avatarKey) {
        photo = getGroupAvatarUrl(baseName, null);
      }
    }

    // ── Active Online Status ──
    const isOnline = isGrp ? false : isUserOnline(c, participantId);

    // ── Last Message Snippet Resolution ──
    let snippet = c.lastMessagePreview || c.latestMessagePreview || c.lastMessageSnippet || c.lastMessageContent || c.lastMessageText || '';
    if (!snippet && c.lastMessage) {
      snippet = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.text || c.lastMessage?.content || c.lastMessage?.body || '');
    }
    if (!snippet && c.rawLastMessage) {
      snippet = typeof c.rawLastMessage === 'string' ? c.rawLastMessage : (c.rawLastMessage?.text || c.rawLastMessage?.content || '');
    }
    // Check messages array if present (from some API responses)
    if (!snippet && Array.isArray(c.messages) && c.messages.length > 0) {
      const lastMsg = c.messages[c.messages.length - 1];
      snippet = lastMsg?.text || lastMsg?.content || lastMsg?.body || '';
    }
    if (typeof snippet === 'object') {
      snippet = (snippet as any).text || (snippet as any).content || '';
    }

    if (c.lastMessageType === 'image' || (!snippet && (c.lastMessage?.mediaUrl || c.rawLastMessage?.mediaUrl))) {
      snippet = 'Sent an attachment';
    } else if (c.lastMessageType === 'audio' || c.lastMessageType === 'voice') {
      snippet = 'Voice message';
    } else if (c.lastMessageType === 'video') {
      snippet = 'Video message';
    }

    // Sender prefix (You: ...)
    const myId = profile?.id;
    const myUid = user?.uid;
    const lastSenderId = c.latestMessageSenderId || c.lastMessageSenderId || c.lastSenderId || c.lastMessage?.senderId || c.rawLastMessage?.senderId;
    const isMeSender = Boolean(
      lastSenderId && 
      (lastSenderId === myId || lastSenderId === myUid || lastSenderId === (user as any)?.userId)
    );

    let displaySnippet = snippet;
    if (snippet && snippet !== 'No messages yet' && snippet !== 'Sent an attachment' && !snippet.startsWith('You: ')) {
      displaySnippet = isMeSender ? `You: ${snippet}` : snippet;
    }
    if (!displaySnippet) {
      displaySnippet = 'No messages yet';
    }

    const timestamp = c.latestMessageAt || c.lastMessageAt || c.updatedAt || c.createdAt;
    const shortTime = timestamp ? formatShortTimestamp(timestamp) : '';

    return {
      id: c.id,
      name: finalDisplayName,
      photo,
      participantId,
      isOnline,
      isVerified: isGrp ? false : isVerified,
      isGroup: isGrp,
      displaySnippet,
      shortTime,
      unreadCount: c.unreadCount || 0,
      isUnread: Boolean((c.unreadCount && c.unreadCount > 0) || c.unread),
      themeSettings: c.themeSettings || null,
    };
  }, [isUserOnline, profile?.id, user]);

  // Find active conversation details for DockedChatWindow
  const activeConv = useMemo(() => {
    if (!activeChatId) return null;
    const fromList = conversations.find(c => c.id === activeChatId);
    if (fromList) return getConversationDisplay(fromList);
    const fromHead = heads.find(h => h.id === activeChatId);
    if (fromHead) {
      return {
        id: fromHead.id,
        name: fromHead.name,
        photo: fromHead.photo,
        participantId: fromHead.participantId,
        isOnline: Boolean(fromHead.participantId && onlineUsers?.has(fromHead.participantId)),
        isVerified: Boolean(fromHead.isVerified),
        isGroup: false,
        displaySnippet: '',
        shortTime: '',
        unreadCount: fromHead.unreadCount || 0,
        isUnread: Boolean(fromHead.unreadCount && fromHead.unreadCount > 0),
        themeSettings: fromHead.themeSettings,
      };
    }
    return {
      id: activeChatId,
      name: 'Chat',
      photo: '',
      participantId: undefined,
      isOnline: false,
      isVerified: false,
      isGroup: false,
      displaySnippet: '',
      shortTime: '',
      unreadCount: 0,
      isUnread: false,
      themeSettings: null,
    };
  }, [activeChatId, conversations, heads, onlineUsers, getConversationDisplay]);

  // Filter conversations by search input
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter(c => {
      const disp = getConversationDisplay(c);
      return disp.name.toLowerCase().includes(q) || disp.displaySnippet.toLowerCase().includes(q);
    });
  }, [conversations, searchQuery, getConversationDisplay]);

  // Handle conversation click in list
  const handleSelectConversation = (disp: any) => {
    triggerNativeHaptic('selection');
    setActiveChatId(disp.id);
    if (disp.isUnread) {
      setConversations(prev => prev.map(c => c.id === disp.id ? { ...c, unreadCount: 0, unread: false } : c));
      api.chat.markSeen(disp.id).catch(() => {});
    }
  };

  const handleComposeClick = () => {
    triggerNativeHaptic('selection');
    if (onNewMessage) {
      onNewMessage();
    } else {
      setIsMessagesPopupOpen(false);
      onOpenChat('');
    }
  };

  const isInboxRoute = isInboxView || (typeof window !== 'undefined' && (window.location.pathname.startsWith('/messages') || window.location.pathname === '/messages'));
  if (isInboxRoute) return null;

  return (
    <>
      {/* ── Facebook-Style Floating Messages Card / Docked Chat Window ── */}
      <AnimatePresence>
        {!isInboxRoute && isMessagesPopupOpen && (
          <div
            ref={popupRef}
            className="fixed bottom-[74px] sm:bottom-0 right-[70px] sm:right-[82px] z-[320] pointer-events-auto"
          >
            {activeChatId && activeConv ? (
              /* When a chat is selected, show DockedChatWindow with the '<' Back button */
              <DockedChatWindow
                chatId={activeConv.id}
                chatName={activeConv.name}
                chatPhoto={activeConv.photo}
                participantId={activeConv.participantId}
                initialThemeSettings={activeConv.themeSettings}
                isVerified={activeConv.isVerified}
                isGroup={activeConv.isGroup}
                onBack={() => setActiveChatId(null)}
                onMinimize={() => setIsMessagesPopupOpen(false)}
                onClose={() => {
                  setActiveChatId(null);
                  setIsMessagesPopupOpen(false);
                }}
                onMaximize={() => {
                  setIsMessagesPopupOpen(false);
                  onOpenChat(activeConv.id);
                }}
              />
            ) : (
              /* When in List view, show Floating Messages Card */
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 15 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="w-[calc(100vw-20px)] max-w-[360px] sm:w-[360px] h-[72vh] max-h-[560px] sm:h-[530px] rounded-2xl sm:rounded-t-2xl sm:rounded-b-none shadow-[0_15px_60px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden relative border border-white/20 bg-[#090a10]/98 backdrop-blur-2xl select-none"
              >
                {/* ── Top Header Bar (Clean Messages title without red badge) ── */}
                <div className="h-14 px-4 border-b border-white/10 bg-black/50 backdrop-blur-xl flex items-center justify-between shrink-0 select-none z-10">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight">Messages</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMessagesPopupOpen(false);
                        onOpenChat('');
                      }}
                      title="Open in Messenger"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <Maximize2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMessagesPopupOpen(false)}
                      title="Close"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* ── Compact Search Input Bar ── */}
                <div className="px-3.5 py-2.5 border-b border-white/5 bg-white/[0.02]">
                  <div className="relative flex items-center">
                    <Search size={14} className="absolute left-3 text-white/40 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages..."
                      className="w-full h-8 pl-8 pr-7 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-aeirmist-cyan/60 focus:bg-white/10 transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 text-white/40 hover:text-white text-xs cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Conversation List (Square Avatar, Name + Nickname + Verified, Snippet · Time, Unread Dot) ── */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
                  {isLoadingConversations && conversations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-white/40 py-16">
                      <Loader2 size={24} className="animate-spin text-aeirmist-cyan" />
                      <span className="text-xs font-mono">Syncing messages...</span>
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4 py-16 text-white/40">
                      <MessageSquare size={32} className="text-white/20 mb-2" />
                      <p className="text-xs font-medium text-white/70">
                        {searchQuery ? 'No matching conversations' : 'No recent messages'}
                      </p>
                      <p className="text-[11px] text-white/40 mt-1">
                        {searchQuery ? 'Try another keyword' : 'Start a new conversation to chat'}
                      </p>
                      <button
                        type="button"
                        onClick={handleComposeClick}
                        className="mt-3 px-3.5 py-1.5 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan text-xs font-semibold hover:bg-aeirmist-cyan/20 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <SquarePen size={12} />
                        <span>Start Conversation</span>
                      </button>
                    </div>
                  ) : (
                    filteredConversations.map((c: any) => {
                      const disp = getConversationDisplay(c);
                      const avatar = disp.isGroup
                        ? getGroupAvatarUrl(disp.name, disp.photo)
                        : getAvatarUrl(disp.photo, disp.name || disp.participantId);
                      return (
                        <div
                          key={disp.id}
                          onClick={() => handleSelectConversation(disp)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/[0.07] active:bg-white/10 transition-all cursor-pointer group relative ${
                            disp.isUnread ? 'bg-white/[0.03]' : ''
                          }`}
                        >
                          {/* Square / Squircle Avatar with active online indicator */}
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 group-hover:border-aeirmist-cyan/50 transition-colors">
                              <img
                                src={avatar}
                                alt={disp.name}
                                className="w-full h-full object-cover rounded-xl"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                            {disp.isOnline && (
                              <span 
                                title="Active now"
                                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-aeirmist-lime border-2 border-[#090a10] ring-1 ring-aeirmist-lime/50 shadow-[0_0_8px_rgba(191,255,0,0.8)]" 
                              />
                            )}
                          </div>

                          {/* Contact Name (with Nickname support) + Verified Badge & Snippet */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h4 className={`text-xs font-semibold truncate group-hover:text-aeirmist-cyan transition-colors ${
                                  disp.isUnread ? 'text-white font-bold' : 'text-white/90'
                                }`}>
                                  {disp.name}
                                </h4>
                                {disp.isVerified && (
                                  <ShieldCheck size={13} className="text-aeirmist-cyan fill-aeirmist-cyan/20 shrink-0 inline-block drop-shadow-[0_0_6px_rgba(0,242,255,0.6)]" />
                                )}
                              </div>
                              {disp.shortTime && (
                                <span className={`text-[10px] shrink-0 font-mono ${
                                  disp.isUnread ? 'text-aeirmist-cyan font-semibold' : 'text-white/40'
                                }`}>
                                  {disp.shortTime}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-[11px] truncate leading-tight ${
                                disp.isUnread ? 'text-white font-medium' : 'text-white/50'
                              }`}>
                                {disp.displaySnippet}
                              </p>
                              {disp.isUnread && (
                                <span className="w-2.5 h-2.5 rounded-full bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,0.8)] shrink-0" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* ── Side Rail / Floating Chat Heads Column (Right Side) ── */}
      {!isInboxRoute && (
        <motion.div
          drag={!isDesktop} // Draggable only on mobile phones; fixed on right rail on desktop web
          dragMomentum={false}
          dragConstraints={{
            left: -(typeof window !== 'undefined' ? window.innerWidth - 80 : 300),
            right: 0,
            top: -(typeof window !== 'undefined' ? window.innerHeight - 200 : 500),
            bottom: 0,
          }}
          className="fixed z-[290] select-none flex flex-col items-center gap-3 touch-none"
          style={{
            bottom: isDesktop ? '24px' : '100px',
            right: '16px'
          }}
        >
          {/* ── Floating Squircle Button (Click to toggle Messages Card) ── */}
          <motion.div
            ref={triggerBtnRef}
            layout
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleFloatingButtonClick}
            className="relative cursor-pointer group select-none"
          >
            <div className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#121422] to-[#090a10] border-2 transition-all duration-200 flex items-center justify-center text-aeirmist-cyan ${
              isMessagesPopupOpen
                ? 'border-aeirmist-cyan shadow-[0_0_25px_rgba(0,242,255,0.6)] ring-2 ring-aeirmist-cyan/40 scale-105'
                : 'border-aeirmist-cyan/50 hover:border-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.25)] hover:shadow-[0_0_22px_rgba(0,242,255,0.5)]'
            }`}>
              {isLoadingConversations && conversations.length === 0 ? (
                <Loader2 size={20} className="animate-spin text-aeirmist-cyan" />
              ) : (
                <SquarePen size={20} className="group-hover:rotate-6 transition-transform" />
              )}
            </div>

            {/* Hover tooltip */}
            <div className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-xl bg-black/90 backdrop-blur-md border border-white/15 text-white text-[11px] font-bold whitespace-nowrap shadow-2xl z-50 flex items-center gap-1.5">
              <MessageSquare size={12} className="text-aeirmist-cyan" />
              <span>{isMessagesPopupOpen ? 'Close Messages' : 'Messages'}</span>
            </div>
          </motion.div>

          {/* ── Active Conversation Chat Heads ── */}
          <AnimatePresence initial={false}>
            {heads.map(h => (
              <HeadBubble
                key={h.id}
                head={h}
                isOpenInDock={isMessagesPopupOpen && activeChatId === h.id}
                preview={activePreviews[h.id]}
                onOpen={handleHeadClick}
                onClose={handleCloseHead}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
};
