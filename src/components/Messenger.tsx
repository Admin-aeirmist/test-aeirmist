import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Image as ImageIcon, 
  Mic, 
  Smile, 
  Phone, 
  Video, 
  Info, 
  ChevronLeft,
  ArrowLeft,
  Palette,
  MoreVertical,
  Plus,
  Search,
  Filter,
  Shield,
  MessageSquare,
  Ghost,
  Sidebar as SidebarIcon,
  X,
  Loader2,
  ArrowRight,
  Camera,
  Zap,
  Pin,
  BellOff,
  EyeOff,
  Lock,
  Archive,
  Trash2,
  Users,
  ShieldCheck,
  Settings,
  UserX,
  ShieldAlert
} from 'lucide-react';
const EmojiPicker = React.lazy(() => import('emoji-picker-react'));
import { CallModal } from './CallModal';
import { ForwardModal } from './messenger/ForwardModal';
import { ChatContextMenu } from './messenger/ChatContextMenu';
import { AccountSwitcher } from './messenger/AccountSwitcher';
import { SettingsModal } from './messenger/SettingsModal';
import ProfileSystem from './profile/ProfileSystem';
import { getAvatarUrl, BLANK_DP } from '../lib/avatar';
import { Avatar } from './ui/Avatar';
import { RequestsSection } from './messenger/RequestsSection';
import { ChatInfoPanel } from './messenger/ChatInfoPanel';
import { Vault } from './messenger/Vault';
import { MessageItem } from './messenger/MessageItem';
import { CallHistorySection } from './messenger/CallHistorySection';
import { RestrictedSection } from './messenger/RestrictedSection';
import { BlockedSection } from './messenger/BlockedSection';
import { AeirmistInputSystem } from './messenger/AeirmistInputSystem';
import { ImageViewerModal } from './messenger/ImageViewerModal';
import { TelegramMediaAlbum, AlbumItem, isAutoMediaPlaceholder } from './messenger/TelegramMediaAlbum';
import { NotesSystem } from './messenger/NotesSystem';
import { ChatWallpaperLayer } from './messenger/ChatWallpaperLayer';
import { ChatWallpaperController } from './messenger/ChatWallpaperController';
import { GroupCreationModal } from './messenger/GroupCreationModal';
import { GroupInfoPanel } from './messenger/GroupInfoPanel';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc,
  updateDoc,
  limit,
  deleteDoc,
  arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Chat, Message } from '../types/messenger';
import { 
  formatAeirmistTimestamp, 
  formatShortTimestamp, 
  formatActiveStatus, 
  formatDateSeparator, 
  formatConversationTime,
  formatMetaInboxTimestamp,
  extractTimestampMs
} from '../lib/date';
import { useAeirmist } from '../context/AeirmistContext';
import { useAppearance } from '../context/AppearanceContext';
import { aeirmistCache } from '../services/CacheService';
import { mediaService, MediaQuality } from '../services/MediaService';
import { messagingService } from '../modules/messaging/MessagingService';
import { messageOutboxService } from '../modules/messaging/MessageOutboxService';
import { aeirmistCall } from '../modules/calls/CallService';
import { logger } from '@/src/utils/logger';
import { useBackHandler } from '../utils/backNavigation';
import { useSharedProfile } from '../hooks/useSharedProfile';

export const getChatActivityMs = (chat: any): number => {
  if (!chat) return 0;
  
  // 1. Optimistic bump check if write is pending or recently bumped (< 30s)
  if (typeof chat._optimisticBumpAt === 'number' && chat._optimisticBumpAt > 0) {
    if (chat.isOptimistic || chat.hasPendingWrites || (Date.now() - chat._optimisticBumpAt < 30000)) {
      const tLatestServer = extractTimestampMs(chat.latestMessageAt);
      if (tLatestServer > chat._optimisticBumpAt) {
        return tLatestServer;
      }
      return chat._optimisticBumpAt;
    }
  }

  // 2. Direct latestMessageAtMs if set as number
  if (typeof chat.latestMessageAtMs === 'number' && chat.latestMessageAtMs > 0) {
    return chat.latestMessageAtMs;
  }

  // 3. Canonical single source: latestMessageAt
  const t0 = extractTimestampMs(chat.latestMessageAt);
  if (t0 > 0) return t0;

  // 4. Fallbacks: lastMessage (timestamp / timestampMs / createdAt) -> updatedAt -> createdAt
  const t1 = extractTimestampMs(chat.lastMessage?.timestamp || chat.lastMessage?.createdAt || chat.rawLastMessage?.timestamp);
  const t1Ms = typeof chat.lastMessage?.timestampMs === 'number' && chat.lastMessage.timestampMs > 0 ? chat.lastMessage.timestampMs : 0;
  const t2 = extractTimestampMs(chat.updatedAt);
  const t2Ms = typeof chat.updatedAtMs === 'number' && chat.updatedAtMs > 0 ? chat.updatedAtMs : 0;
  
  const fallbackMs = Math.max(t1, t1Ms, t2, t2Ms);
  if (fallbackMs > 0) return fallbackMs;

  const t3 = extractTimestampMs(chat.createdAt);
  if (t3 > 0) return t3;

  if (chat.hasPendingWrites || chat.isOptimistic) {
    return Date.now();
  }

  return 0;
};

export const sortChatsDeterministic = (chatsList: any[], activeProfileId?: string): any[] => {
  return [...chatsList].sort((a, b) => {
    const pinA = typeof a.isPinned === 'boolean' ? a.isPinned : !!a.isPinned?.[activeProfileId || ''];
    const pinB = typeof b.isPinned === 'boolean' ? b.isPinned : !!b.isPinned?.[activeProfileId || ''];
    if (pinA && !pinB) return -1;
    if (!pinA && pinB) return 1;

    const timeA = getChatActivityMs(a);
    const timeB = getChatActivityMs(b);

    if (timeB !== timeA) {
      return (timeB || 0) - (timeA || 0);
    }
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
};


const moods = {
  ecstatic: '⚡',
  chill: '🌊',
  intense: '🔥',
  melancholy: '🌑',
};

const LiveParticipantAvatar = ({ 
  participantId, 
  fallbackPhoto, 
  className = "", 
  showStoryRing = false,
  sizeClassName = "w-full h-full",
  roundedClassName = "rounded-xl",
  innerRoundedClassName = "rounded-[10px]"
}: { 
  participantId: string, 
  fallbackPhoto: string, 
  className?: string, 
  showStoryRing?: boolean,
  sizeClassName?: string,
  roundedClassName?: string,
  innerRoundedClassName?: string
}) => {
  const { db } = useAeirmist();
  const profileData = useSharedProfile(db, participantId);
  
  const isDeleted = profileData?.isDeleted === true;
  const isFallbackPhotoValid = Boolean(fallbackPhoto && fallbackPhoto !== BLANK_DP);
  const livePhoto = isDeleted 
    ? BLANK_DP 
    : (profileData?.photoURL ? getAvatarUrl(profileData.photoURL) : (isFallbackPhotoValid ? getAvatarUrl(fallbackPhoto) : BLANK_DP));

  return (
    <Avatar 
      src={isDeleted ? BLANK_DP : livePhoto} 
      userId={isDeleted ? undefined : participantId} 
      showStoryRing={!isDeleted && showStoryRing} 
      sizeClassName={sizeClassName}
      roundedClassName={roundedClassName}
      innerRoundedClassName={innerRoundedClassName}
      className={className}
    />
  );
};

export const LiveParticipantName = ({ participantId, fallbackName, className = "", chatId }: { participantId: string, fallbackName: string, className?: string, chatId?: string }) => {
  const { db } = useAeirmist();
  const profileData = useSharedProfile(db, participantId);
  const [nickname, setNickname] = useState<string>('');

  const isDeleted = profileData?.isDeleted === true;
  const isFallbackValid = Boolean(
    fallbackName && 
    typeof fallbackName === 'string' && 
    fallbackName.trim() !== '' && 
    fallbackName.toLowerCase() !== 'aeirmist user' && 
    fallbackName.toLowerCase() !== 'unknown'
  );
  const profileName = isDeleted 
    ? 'Aeirmist User' 
    : (profileData?.displayName || profileData?.username || (isFallbackValid ? fallbackName : '') || 'Aeirmist User');

  useEffect(() => {
    if (!db || !chatId || typeof chatId !== 'string' || !chatId.trim()) return;
    // Nickname listener (separate collection — cannot be shared via profile cache)
    const unsubNickname = onSnapshot(doc(db, 'chat_settings', chatId.trim()), (docSnap) => {
      if (docSnap.exists()) {
        const nicks = docSnap.data().nicknames || {};
        setNickname(nicks[participantId] || '');
      } else {
        setNickname('');
      }
    }, (err) => {
      logger.error("Error listening for shared nickname:", err);
    });
    return () => unsubNickname();
  }, [db, participantId, chatId]);

  return <span className={className}>{isDeleted ? 'Aeirmist User' : (nickname || profileName)}</span>;
};

const LiveParticipantPresenceDot = ({ participantId }: { participantId: string }) => {
  const { db, onlineUsers } = useAeirmist();
  const profileData = useSharedProfile(db, participantId);

  const isDeleted = profileData?.isDeleted === true;
  const isOnline = !!onlineUsers?.has?.(participantId);
  const hasShowActivity = profileData?.privacySettings?.showActivity !== false;
  const isOnlineStatusOn = profileData?.messagingSettings?.onlineStatus !== false;
  const showPresence = !isDeleted && profileData != null && isOnline && hasShowActivity && isOnlineStatusOn;

  if (!showPresence) return null;

  return (
    <div className="absolute bottom-1 right-1 w-4 h-4 bg-aeirmist-lime rounded-lg border-2 border-aeirmist-bg lg:border-[3px]" />
  );
};

const LiveParticipantSubDetails = ({ participantId, chatId }: { participantId: string, chatId: string }) => {
  const { db, onlineUsers, profile } = useAeirmist();
  const profileData = useSharedProfile(db, participantId);
  const [isTyping, setIsTyping] = useState(false);

  // My own online status setting
  const myOnlineStatusOn = profile?.messagingSettings?.onlineStatus !== false;

  // Derive from shared cache instead of individual listener
  const username = profileData?.username || '';
  const lastSeen = profileData?.lastSeen || null;
  const showPresence = profileData?.privacySettings?.showActivity !== false;
  const isOnlineStatusOn = profileData?.messagingSettings?.onlineStatus !== false;

  useEffect(() => {
    if (!db || !participantId || !chatId || typeof chatId !== 'string' || !chatId.trim()) return;

    const indicatorId = `${chatId.trim()}_${participantId.trim()}`;
    const unsubTyping = onSnapshot(doc(db, 'typing_indicators', indicatorId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.updatedAt) {
          try {
            const date = typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : new Date(data.updatedAt);
            const isCurrentlyTyping = (Date.now() - date.getTime()) < 4000;
            setIsTyping(isCurrentlyTyping);
          } catch (e) {
            setIsTyping(false);
          }
        } else {
          setIsTyping(false);
        }
      } else {
        setIsTyping(false);
      }
    });

    return () => unsubTyping();
  }, [db, participantId, chatId]);

  const isOnline = !!onlineUsers?.has?.(participantId);

  let presenceText = '';
  if (showPresence) {
    if (isTyping && isOnlineStatusOn && myOnlineStatusOn) {
      presenceText = 'Typing...';
    } else {
      presenceText = formatActiveStatus(
        isOnline && isOnlineStatusOn && myOnlineStatusOn, 
        lastSeen, 
        !isOnlineStatusOn || !myOnlineStatusOn
      );
    }
  }

  return (
    <div className="flex flex-col gap-0.5 mt-0.5">
      {username && (
        <span className="text-[10px] text-white/40 block">@{username}</span>
      )}
      {presenceText && (
        <span className={`text-[9px] font-medium tracking-wide ${isTyping && isOnlineStatusOn && myOnlineStatusOn ? 'text-aeirmist-cyan font-bold animate-pulse' : (isOnline && isOnlineStatusOn && myOnlineStatusOn ? 'text-aeirmist-lime' : 'text-white/20')}`}>
          {presenceText}
        </span>
      )}
    </div>
  );
};

const Messenger = ({ initialRecipient, onUserClick }: { initialRecipient?: any, onUserClick?: (user: any) => void }) => {
  const { 
    db, 
    storage, 
    user, 
    profile, 
    searchUsers, 
    onlineUsers, 
    updateSeenStatus, 
    endCall, 
    isOffline, 
    isFollowing,
    isBlocked,
    isCloseFriend, 
    setIsNavHidden, 
    setCameraConfig, 
    sendMessage, 
    uploadMedia, 
    mediaSettings,
    allProfiles = [],
    suggestedUsers = [],
    localAvatarURL,
    toggleNotification,
    deleteConversation,
    addToast
  } = useAeirmist();
  const { settings } = useAppearance();
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [pendingNoteReply, setPendingNoteReply] = useState<{ chatId: string; text: string; authorName: string } | null>(null);
  const [isMobileList, setIsMobileList] = useState(true);

  // Dedicated Instagram-Style Messenger Search states
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchTab, setSearchTab] = useState<'all' | 'people' | 'messages' | 'groups' | 'media'>('all');
  const [viewingProfileInSearch, setViewingProfileInSearch] = useState<any | null>(null);
  const [recentSearches, setRecentSearches] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('aeirmist_messenger_recent_searches_v3');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      // Filter out invalid or pure-string legacy items and deduplicate by ID
      const seen = new Set();
      return parsed.filter((item: any) => {
        if (!item || typeof item !== 'object') return false;
        const id = item.id || item.uid;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('aeirmist_messenger_recent_searches_v3', JSON.stringify(recentSearches));
  }, [recentSearches]);

  const addToRecentSearches = (item: any) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(x => x.id !== (item.id || item.uid));
      const isUser = !!(item.username || item.displayName);
      const newItem = {
        id: item.id || item.uid,
        name: item.displayName || item.name || '',
        photo: item.photoURL || item.photo || '',
        username: item.username || '',
        type: isUser ? 'user' : 'chat',
        timestamp: Date.now()
      };
      return [newItem, ...filtered].slice(0, 15);
    });
  };

  const removeRecentSearch = (id: string) => {
    setRecentSearches(prev => prev.filter(x => x.id !== id));
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
  };

  // Derived active chat from chats list to ensure fresh data
  const activeChat = useMemo(() => {
    if (!activeChatId) return null;
    return chats.find(c => c.id === activeChatId) || null;
  }, [chats, activeChatId]);

  // Handle temporary chats separate from derived list
  const [tempChat, setTempChat] = useState<Chat | null>(null);
  
  const currentChat = useMemo(() => {
    if (activeChatId) {
      const found = chats.find(c => c.id === activeChatId);
      if (found) return found;
      if (tempChat && tempChat.id === activeChatId) return tempChat;
    }
    return tempChat || null;
  }, [chats, activeChatId, tempChat]);

  // Manage Nav Visibility
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile && !isMobileList) {
        setIsNavHidden(true);
      } else {
        setIsNavHidden(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      setIsNavHidden(false);
    };
  }, [isMobileList, setIsNavHidden]);
  const [vaultState, setVaultState] = useState<{
    isOpen: boolean;
    isUnlocked: boolean;
    activeVaultChatId: string | null;
  }>({
    isOpen: false,
    isUnlocked: false,
    activeVaultChatId: null,
  });

  const vaultedParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    chats.forEach(c => {
      if (c.isVaulted?.[profile?.id || ''] === true) {
        if (c.profileIds) {
          c.profileIds.forEach(id => {
            if (id !== profile?.id) ids.add(id);
          });
        }
        if (c.otherParticipantId) {
          ids.add(c.otherParticipantId);
        }
      }
    });
    return ids;
  }, [chats, profile?.id]);

  const [view, setView] = useState<'chats' | 'requests' | 'history' | 'restricted' | 'blocked'>('chats');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'personal' | 'marketplace' | 'groups' | 'archived' | 'requests'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isGroupCreationOpen, setIsGroupCreationOpen] = useState(false);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<{ [convId: string]: Message[] }>({});

  const handleRetryMessage = async (convId: string, msg: Message) => {
    try {
      setPendingMessages(prev => ({
        ...prev,
        [convId]: prev[convId]?.map(m => m.id === msg.id ? { ...m, isOptimistic: true, isFailed: false } : m) || []
      }));
      await sendMessage(convId, msg.text || '', msg.type, msg.mediaUrl, msg.metadata);
      setPendingMessages(prev => ({
        ...prev,
        [convId]: prev[convId]?.filter(m => m.id !== msg.id) || []
      }));
    } catch (e) {
      setPendingMessages(prev => ({
        ...prev,
        [convId]: prev[convId]?.map(m => m.id === msg.id ? { ...m, isOptimistic: false, isFailed: true } : m) || []
      }));
    }
  };
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, chatId: string } | null>(null);
  const [viewportHeight, setViewportHeight] = useState('100%');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isWallpaperCustomizerOpen, setIsWallpaperCustomizerOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<any | null>(null);

  const handleForward = (msg: any) => {
    setForwardingMessage(msg);
  };

  const confirmForward = async (recipientId: string) => {
    if (!forwardingMessage) return;
    
    const mediaType = forwardingMessage.mediaType || forwardingMessage.type;
    const msgType = forwardingMessage.type || (forwardingMessage.mediaUrl ? 'media' : 'text');
    
    await sendMessage(
      recipientId,
      forwardingMessage.text || (msgType !== 'text' ? `Forwarded ${msgType}` : ''),
      msgType,
      forwardingMessage.mediaUrl,
      {
        mediaType,
        isForwarded: true,
        originalSenderId: forwardingMessage.senderId
      }
    );
    setForwardingMessage(null);
  };

  // Intercept back actions for Messenger modals, search, views, and mobile active chat
  useBackHandler(() => {
    if (contextMenu) {
      setContextMenu(null);
      return true;
    }
    if (forwardingMessage) {
      setForwardingMessage(null);
      return true;
    }
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return true;
    }
    if (isAccountSwitcherOpen) {
      setIsAccountSwitcherOpen(false);
      return true;
    }
    if (isGroupCreationOpen) {
      setIsGroupCreationOpen(false);
      return true;
    }
    if (isInfoOpen) {
      setIsInfoOpen(false);
      return true;
    }
    if (vaultState.isOpen) {
      setVaultState(v => ({ ...v, isOpen: false, activeVaultChatId: null }));
      return true;
    }
    if (viewingProfileInSearch) {
      setViewingProfileInSearch(null);
      return true;
    }
    if (isSearchFocused) {
      setIsSearchFocused(false);
      return true;
    }
    if (view !== 'chats') {
      setView('chats');
      return true;
    }
    // Mobile active chat view: return to conversations list
    if (!isMobileList || activeChatId) {
      setIsMobileList(true);
      setActiveChatId(null);
      setTempChat(null);
      setIsNavHidden(false);
      return true;
    }
    return false;
  }, true, 80, [
    contextMenu,
    forwardingMessage,
    isSettingsOpen,
    isAccountSwitcherOpen,
    isGroupCreationOpen,
    isInfoOpen,
    vaultState.isOpen,
    viewingProfileInSearch,
    isSearchFocused,
    view,
    isMobileList,
    activeChatId
  ]);

  // Global chats filtering logic - strictly mutually exclusive to prevent duplicated inboxes
  const mainChats = useMemo(() => {
    return chats.filter(data => {
      // Hide Vaulted conversations from Main Inbox
      if (data.isVaulted?.[profile?.id || ''] === true) return false;

      // Filter out blocked users
      const otherId = data.otherParticipantId;
      if (otherId && isBlocked(otherId)) return false;

      // Strictly mutually exclusive: if status is 'request', it belongs only in Requests
      if (data.status === 'request') return false;
      
      return true;
    });
  }, [chats, isBlocked, profile?.id]);

  const requestChats = useMemo(() => {
    return chats.filter(data => {
      // Hide Vaulted conversations from Requests list
      if (data.isVaulted?.[profile?.id || ''] === true) return false;

      // Filter out blocked users
      const otherId = data.otherParticipantId;
      if (otherId && isBlocked(otherId)) return false;

      // Inbound message requests only
      if (data.status === 'request') {
        return data.lastMessageSenderId !== profile?.id;
      }
      
      return false;
    });
  }, [chats, isBlocked, profile?.id]);

  // Visual Viewport Height Tracking for Mobile Keyboards
  useEffect(() => {
    const vc = window.visualViewport;
    if (!vc) return;

    const updateHeight = () => {
      // Use visualViewport height to handle keyboard overlays accurately
      const isMobile = window.innerWidth < 768;
      const keyboardActive = isMobile && (window.innerHeight - vc.height > 120);
      setIsKeyboardOpen(keyboardActive);
      if (isMobile && !isMobileList) {
        setViewportHeight(`${vc.height}px`);
      } else {
        setViewportHeight('100%');
      }
    };

    vc.addEventListener('resize', updateHeight);
    vc.addEventListener('scroll', updateHeight); // Needed for some bounce cases
    updateHeight();
    
    return () => {
      vc.removeEventListener('resize', updateHeight);
      vc.removeEventListener('scroll', updateHeight);
    };
  }, [isMobileList]);

  // Instant chat open logic (guarded to only trigger once per distinct recipient to prevent focus hijacking on profile/points updates)
  const processedInitialRecipientRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialRecipient && user && profile) {
      const recipientKey = initialRecipient.id || initialRecipient.uid || initialRecipient.username || JSON.stringify(initialRecipient);
      if (processedInitialRecipientRef.current !== recipientKey) {
        processedInitialRecipientRef.current = recipientKey;
        handleUserClick(initialRecipient);
      }
    }
  }, [initialRecipient, user, profile]);

  useEffect(() => {
    if (!db || !user || !profile?.id) return;

    const unsubscribe = messagingService.subscribeToChats(db, user.uid, profile.id, (fetchedChats) => {
      logger.info(`[Messenger] Inbox update: ${fetchedChats.length} frequencies detected.`);
      const processedChats = fetchedChats.map(data => {
        // If explicitly deleted for this profile, skip unless a new message arrived after deletion
        const deletedAt = data.deletedFor?.[profile.id];
        const chatUpdatedAt = getChatActivityMs(data);
        if (deletedAt === true) return null; // Legacy support
        if (typeof deletedAt === 'number' && chatUpdatedAt <= deletedAt) return null;

        // If this chat explicitly belongs to other profiles of this user, 
        // we might still want to show it depending on product requirements, 
        // but typically we only show chats where the active profile is a participant.
        const isParticipant = (data.profileIds || []).includes(profile.id) || 
                             (data.participants || []).includes(user.uid);
        
        if (!isParticipant) return null;

        // Note: The filtering for requests is now done in mainChats useMemo
        // to handle live changes in follow status without re-subscribing.

        const myIds = new Set([
          profile.id,
          user.uid,
          `profile_${user.uid}`,
          profile.id ? profile.id.replace(/^profile_/, '') : '',
          user.uid ? `profile_${user.uid}` : ''
        ].filter(Boolean));

        const isSelfId = (id: string) => {
          if (!id) return true;
          return myIds.has(id) || myIds.has(`profile_${id}`) || myIds.has(id.replace(/^profile_/, ''));
        };

        let otherParticipantId = '';
        let otherParticipantUid = '';

        if (data.profileIds && Array.isArray(data.profileIds)) {
          otherParticipantId = data.profileIds.find((id: string) => !isSelfId(id)) || '';
          if (!otherParticipantId && data.profileIds.length === 1 && isSelfId(data.profileIds[0])) {
            otherParticipantId = profile.id;
          }
        }
        
        if (data.participants && Array.isArray(data.participants)) {
          otherParticipantUid = data.participants.find((uid: string) => !isSelfId(uid)) || '';
          if (!otherParticipantUid && data.participants.length === 1 && isSelfId(data.participants[0])) {
            otherParticipantUid = user.uid;
          }
        }

        if (!otherParticipantId && otherParticipantUid) {
          otherParticipantId = otherParticipantUid;
        }

        // Deep resolution for profile photos and details
        let details = data.participantDetails?.[otherParticipantId];
        
        if (!details && data.participantDetails) {
           const otherKey = Object.keys(data.participantDetails).find(k => !isSelfId(k));
           if (otherKey) {
             details = data.participantDetails[otherKey];
             if (!otherParticipantId) otherParticipantId = otherKey;
           } else if (data.participantDetails[profile.id] || data.participantDetails[user.uid]) {
             details = data.participantDetails[profile.id] || data.participantDetails[user.uid];
           }
        }
        
        if (!details) details = {};
        
        if (!otherParticipantId && data.participantDetails) {
          otherParticipantId = Object.keys(data.participantDetails).find(id => !isSelfId(id)) || '';
          if (!otherParticipantId && (data.participantDetails[profile.id] || data.participantDetails[user.uid])) {
            otherParticipantId = profile.id;
          }
        }

        let timeString = '';
        try {
          if (data.updatedAt) {
            const date = data.updatedAt.toDate?.() || new Date(data.updatedAt);
            if (!isNaN(date.getTime())) {
              timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }
        } catch (e) {
          logger.warn("Chat updatedAt format parsing error:", e);
        }

        const rawLastMsg = data.lastMessage;
        const rawLastText = typeof rawLastMsg === 'string' 
          ? rawLastMsg 
          : (data.latestMessagePreview || rawLastMsg?.text || ((data as any).lastMessageText || 'No messages yet'));
        const lastSenderId = data.latestMessageSenderId || rawLastMsg?.senderId || (data as any).lastSenderId;
        const isSentByMe = !!(lastSenderId && (lastSenderId === profile.id || lastSenderId === user.uid));

        let displayLastMsg = rawLastText;
        if (isSentByMe && rawLastText && rawLastText !== 'No messages yet' && rawLastText !== 'Tap to chat' && rawLastText !== 'Group created') {
          displayLastMsg = rawLastText.startsWith('You: ') ? rawLastText : `You: ${rawLastText}`;
        }

        const calculatedActivityMs = getChatActivityMs(data);

        const rawDisplayName = details?.displayName;
        const isNameValid = rawDisplayName && typeof rawDisplayName === 'string' && 
          rawDisplayName.trim() !== '' && 
          rawDisplayName.toLowerCase() !== 'unknown' && 
          rawDisplayName.toLowerCase() !== 'unknown user';
        const cleanDisplayName = isNameValid ? rawDisplayName.trim() : (details?.username || 'Aeirmist User');

        return {
          ...data,
          id: data.id,
          otherParticipantId,
          otherParticipantUid,
          name: (data.isGroup || data.type === 'group') ? (data.groupName || data.name || 'Group Chat') : cleanDisplayName,
          photo: (data.isGroup || data.type === 'group') ? getAvatarUrl(data.groupPhotoURL || data.photo) : getAvatarUrl(details.photoURL),
          rawLastMessage: rawLastMsg,
          lastMessage: displayLastMsg,
          time: timeString,
          unread: typeof data.unreadCount === 'number' ? data.unreadCount > 0 : (data.unreadCount?.[profile.id] || 0) > 0,
          isPinned: typeof data.isPinned === 'boolean' ? data.isPinned : !!data.isPinned?.[profile.id],
          isMuted: typeof data.isMuted === 'boolean' ? data.isMuted : !!data.isMuted?.[profile.id],
          isArchived: typeof data.isArchived === 'boolean' ? data.isArchived : !!data.isArchived?.[profile.id],
          isVanishMode: !!data.isVanishMode,
          theme: data.theme || 'neural',
          themeSettings: data.themeSettings,
          online: !!onlineUsers?.has?.(otherParticipantId),
          lastMessageSenderId: lastSenderId,
          lastMessageMood: data.lastMessage?.mood,
          latestMessageAtMs: calculatedActivityMs,
          updatedAtMs: calculatedActivityMs
        };
      }).filter(c => c !== null) as any[];

      setChats(prevChats => {
        const prevMap = new Map(prevChats.map(c => [c.id, c]));
        const merged = processedChats.map(chat => {
          const prev = prevMap.get(chat.id);
          let activity = getChatActivityMs(chat);
          // If prev state had an optimistic bump within the last 20 seconds and server has not yet written a newer timestamp
          if (prev?._optimisticBumpAt && (chat.hasPendingWrites || activity < prev._optimisticBumpAt)) {
            if (Date.now() - prev._optimisticBumpAt < 20000) {
              activity = prev._optimisticBumpAt;
            }
          }
          return {
            ...chat,
            updatedAtMs: activity,
            latestMessageAtMs: activity,
            _optimisticBumpAt: prev?._optimisticBumpAt
          };
        });

        // Retain pending optimistic / newly created chats not yet present in server snapshot
        const serverIds = new Set(processedChats.map(c => c.id));
        const pendingChats = prevChats.filter(c => 
          !serverIds.has(c.id) && 
          (c.isOptimistic || c.hasPendingWrites || (c._optimisticBumpAt && Date.now() - c._optimisticBumpAt < 20000))
        );

        const allChats = [...merged, ...pendingChats];
        const uniqueChats = Array.from(new Map(allChats.map(c => [c.id, c])).values());
        return sortChatsDeterministic(uniqueChats, profile.id);
      });
    });

    return () => unsubscribe();
  }, [db, user?.uid, profile?.id]); // Removed onlineUsers from deps to prevent excessive re-subscribes. Online status is handled via live onlineUsers set in render.

  // Auto-close active chat if it has been deleted, archived, or recipient blocked
  useEffect(() => {
    if (activeChatId && !activeChatId.startsWith('new_')) {
      const chatObj = chats.find(c => c.id === activeChatId);
      if (chatObj) {
        const otherId = chatObj.otherParticipantId;
        const isUserBlocked = otherId ? isBlocked(otherId) : false;
        const isUserArchived = chatObj.isArchived;

        if (isUserBlocked || (isUserArchived && activeFilter !== 'archived')) {
          setActiveChatId(null);
          setIsMobileList(true);
        }
      } else if (chats.length > 0) {
        setActiveChatId(null);
        setIsMobileList(true);
      }
    }
  }, [chats, activeChatId, activeFilter, isBlocked]);

  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim().length > 1) {
        setIsSearching(true);
        try {
          const results = await searchUsers(searchQuery);
          setSearchResults(results.filter(r => r.id !== profile?.id));
        } catch (e) {
          logger.error("Search failed", e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers, profile?.id]);

  const handleUserClick = (userData: any, autoCallType?: 'audio' | 'video') => {
    if (!userData || !profile?.id) return;

    const targetId = userData.id || userData.uid || userData.ownerUid;
    if (!targetId) return;

    const profileIds = [profile.id, targetId].sort();
    const detId = profileIds.join('_');
    
    let targetUid = userData.ownerUid || userData.uid;
    if (!targetUid && targetId.startsWith('profile_')) {
      const parts = targetId.split('_');
      if (parts.length >= 2) {
        targetUid = parts[1];
      }
    }
    if (!targetUid) {
      targetUid = targetId; // absolute fallback
    }

    const existingChat = chats.find(c => c.id === detId || c.profileIds?.includes(targetId) || c.participants?.includes(targetUid));
    
    if (existingChat) {
      handleChatSelect(existingChat);
      if (autoCallType) {
        setTimeout(() => setPendingCall({ conversationId: existingChat.id, type: autoCallType }), 100);
      }
    } else {
      const newTempChat: Chat = {
        id: 'new_' + targetId,
        name: userData.displayName || userData.name || 'User',
        photo: userData.photoURL || userData.photo,
        lastMessage: 'Tap to chat',
        time: '',
        unread: false,
        online: !!onlineUsers?.has?.(targetId),
        participants: [user!.uid, targetUid].filter(Boolean).sort(),
        profileIds: profileIds,
        isTemporary: true
      };
      setTempChat(newTempChat);
      setActiveChatId(null);
      setIsMobileList(false);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const [pendingCall, setPendingCall] = useState<{ conversationId: string, type: 'audio' | 'video' } | null>(null);

  const handleChatSelect = (chat: Chat) => {
    setActiveChatId(chat.id);
    if (!chats.some(c => c.id === chat.id)) {
      setTempChat(chat);
    } else {
      setTempChat(null);
    }
    setMessageSearchQuery('');
    setIsInfoOpen(false);
    setIsMobileList(false);
  };

  const handleOptimisticChatBump = useCallback((chatId: string, text: string, currentChatObj?: any) => {
    const now = Date.now();
    const isNew = chatId.startsWith('new_');
    const targetId = isNew ? chatId.replace('new_', '') : null;
    const canonicalId = (isNew && targetId && profile?.id) 
      ? [profile.id, targetId].sort().join('_') 
      : chatId;

    setChats(prevChats => {
      let found = false;
      const updated = prevChats.map(c => {
        if (c.id === chatId || c.id === canonicalId) {
          found = true;
          return {
            ...c,
            id: canonicalId,
            lastMessage: text.startsWith('You: ') ? text : `You: ${text}`,
            latestMessagePreview: text,
            updatedAtMs: now,
            latestMessageAtMs: now,
            _optimisticBumpAt: now,
            updatedAt: new Date(now),
            unread: false,
            isTemporary: false
          };
        }
        return c;
      });

      if (!found && currentChatObj) {
        const newEntry = {
          ...currentChatObj,
          id: canonicalId,
          lastMessage: text.startsWith('You: ') ? text : `You: ${text}`,
          latestMessagePreview: text,
          updatedAtMs: now,
          latestMessageAtMs: now,
          _optimisticBumpAt: now,
          updatedAt: new Date(now),
          unread: false,
          isTemporary: false
        };
        updated.unshift(newEntry);
      }

      const unique = Array.from(new Map(updated.map(c => [c.id, c])).values());
      return sortChatsDeterministic(unique, profile?.id);
    });
  }, [profile?.id]);

  const handleGroupCreated = (groupId: string, groupData?: any) => {
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
  };

  const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, chatId });
  };

  const filteredChats = useMemo(() => {
    let list: any[] = [];

    if (activeFilter === 'archived') {
      list = chats.filter(c => c.isArchived).map(c => ({
        ...c,
        time: formatShortTimestamp(c.updatedAt),
        online: !!onlineUsers?.has?.(c.otherParticipantId || '')
      }));
    } else if (activeFilter === 'requests') {
      list = requestChats.map(c => ({
         ...c,
         time: formatShortTimestamp(c.updatedAt),
         online: !!onlineUsers?.has?.(c.otherParticipantId || '')
      }));
    } else {
      list = mainChats.filter(c => !c.isArchived).map(c => ({
         ...c,
         time: formatShortTimestamp(c.updatedAt),
         online: !!onlineUsers?.has?.(c.otherParticipantId || '')
      }));

      if (activeFilter === 'unread') list = list.filter(c => c.unread);
      if (activeFilter === 'personal') list = list.filter(c => !c.isGroup && c.type !== 'group');
      if (activeFilter === 'groups') list = list.filter(c => c.isGroup || c.type === 'group');
      if (activeFilter === 'marketplace') list = list.filter(c => c.isMarketplace || c.type === 'marketplace');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      
      // My Space Search terms
      const mySpaceTerms = ['my space', 'personal space', 'saved', 'notes', 'private', 'workspace'];
      const isMySpaceSearch = mySpaceTerms.some(term => q.includes(term));

      list = list.filter(c => 
        (c.name || '').toLowerCase().includes(q) || 
        (typeof c.lastMessage === 'string' ? c.lastMessage : c.lastMessage?.text || '').toLowerCase().includes(q) ||
        (isMySpaceSearch && c.id.startsWith('myspace_'))
      );
    }

    return sortChatsDeterministic(list, profile?.id);
  }, [chats, mainChats, requestChats, activeFilter, onlineUsers, searchQuery]);

  const themeStyles = {
    neural: { bg: 'bg-aeirmist-bg', accent: 'text-aeirmist-cyan', border: 'border-white/10', glow: 'shadow-[0_0_20px_rgba(0,204,255,0.1)]' },
    crimson: { bg: 'bg-black', accent: 'text-aeirmist-magenta', border: 'border-aeirmist-magenta/20', glow: 'shadow-[0_0_20px_rgba(255,0,234,0.1)]' },
    emerald: { bg: 'bg-[#051a14]', accent: 'text-aeirmist-lime', border: 'border-aeirmist-lime/20', glow: 'shadow-[0_0_20px_rgba(0,255,170,0.1)]' },
    monolith: { bg: 'bg-black', accent: 'text-white', border: 'border-white/20', glow: 'shadow-[0_0_20px_rgba(255,255,255,0.1)]' },
  };

  const currentTheme = (currentChat?.theme as keyof typeof themeStyles) || 'neural';
  const styles = themeStyles[currentTheme];
  const activeChatTheme = currentChat ? (profile?.themeSettings?.perChatWallpapers?.[currentChat.id] || currentChat.themeSettings) : undefined;
  const hasActiveWallpaper = Boolean(activeChatTheme?.wallpaperURL || profile?.themeSettings?.chatWallpaper?.wallpaperURL || settings?.globalBgValue);

  return (
    <div 
      className={`flex w-full h-full overflow-hidden relative ${
        currentChat?.isVanishMode ? 'bg-black' : 'bg-slate-100/60 dark:bg-aeirmist-bg'
      }`}
    >
      {/* Dark Dim Overlay tied to Appearance Settings */}
      <div 
        className="aeirmist-dim-overlay absolute inset-0 bg-black pointer-events-none transition-opacity duration-300 z-[1]" 
        style={{ opacity: (settings?.globalBgOverlay ?? 45) / 100 }} 
      />

      <AnimatePresence>
        {forwardingMessage && (
          <ForwardModal 
             onClose={() => setForwardingMessage(null)} 
             onForward={confirmForward} 
             chats={chats} 
          />
        )}
        {isGroupCreationOpen && (
          <GroupCreationModal 
            onClose={() => setIsGroupCreationOpen(false)} 
            onGroupCreated={handleGroupCreated}
            chats={chats} 
          />
        )}
      </AnimatePresence>
      {/* Background Gradients - Dimmed when wallpaper is active to prevent clashing */}
      <div className={`absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-500 ${activeChatTheme?.wallpaperURL ? 'opacity-10' : 'opacity-100'}`}>
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] ${currentChat?.isVanishMode ? 'bg-white/5' : 'bg-aeirmist-cyan/10'} rounded-full blur-[120px]`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] ${currentChat?.isVanishMode ? 'bg-aeirmist-magenta/5' : 'bg-aeirmist-magenta/10'} rounded-full blur-[120px]`} />
      </div>

      <AnimatePresence>
        {isOffline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`fixed top-0 left-0 right-0 z-[200] text-white text-[10px] font-black uppercase tracking-[0.4em] py-3 px-8 flex items-center justify-between border-b shadow-xl backdrop-blur-2xl transition-colors ${isOffline ? 'bg-zinc-900 border-white/10' : 'bg-aeirmist-magenta border-white/20 shadow-[0_0_30px_rgba(255,0,234,0.4)]'}`}
          >
            <div className="flex items-center gap-3">
               <Zap size={16} className={`animate-pulse ${isOffline ? 'text-white/40' : 'text-white shadow-sm'}`} />
               <span>
                 {isOffline ? 'Connection Lost: Operating in local mode. Signals will sync on reconnect.' : 'Aeirmist Overload: Realtime frequency busy. Signals will sync automatically.'}
               </span>
            </div>
            <button onClick={() => logger.info("Action coming soon")} className="text-white/40 hover:text-white transition-colors"><X size={14}/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar / Chat List */}
      <div className={`${isMobileList ? 'flex' : 'hidden md:flex'} ${vaultState.isOpen && !vaultState.activeVaultChatId ? 'w-full flex-1 border-r-0' : 'w-full md:w-72 lg:w-80 border-r border-slate-200/80 dark:border-white/10'} flex-col bg-white/75 dark:bg-aeirmist-bg/85 backdrop-blur-2xl messenger-sidebar-glass shrink-0 min-w-0 overflow-hidden h-full min-h-0 z-10 transition-colors`}>
        {isSearchFocused ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Dedicated Search Header & Input */}
            <div className="p-4 md:p-6 pb-2 space-y-4 min-w-0 relative">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setIsSearchFocused(false);
                    setSearchQuery('');
                  }}
                  className="p-1.5 -ml-1 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                  title="Back to inbox"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="flex-1 relative">
                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searchQuery ? 'text-aeirmist-cyan' : 'text-white/40'}`} size={14} />
                  <input 
                    type="text" 
                    placeholder="Search people, messages, groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-11 pr-8 text-xs font-medium text-slate-800 dark:text-white/95 outline-none focus:border-aeirmist-cyan/40 dark:focus:bg-white/[0.08] focus:bg-slate-200/80 transition-all placeholder:text-slate-400 dark:placeholder:text-white/30 animate-fade-in"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Category Tabs */}
              <div className="flex gap-2 overflow-x-auto py-0.5 select-none scroll-smooth border-b border-white/5 pb-2">
                {(['all', 'people', 'messages', 'groups', 'media'] as const).map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setSearchTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border capitalize ${
                      searchTab === tab 
                        ? 'bg-gradient-to-tr from-aeirmist-cyan/15 to-transparent border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.2)]' 
                        : 'bg-slate-100 dark:bg-[#0f0f13]/85 border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/15'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Screen Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-2 space-y-6 pb-24 md:pb-6">
              {/* If Search Query is EMPTY */}
              {!searchQuery.trim() ? (
                <>
                  {/* TAB = ALL */}
                  {searchTab === 'all' && (
                    <>
                      {/* Recent Searches */}
                      {recentSearches.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black tracking-widest text-white/30 uppercase">Recent Searches</span>
                            <button 
                              onClick={clearAllRecentSearches}
                              className="text-[10px] font-bold text-aeirmist-cyan/80 hover:text-aeirmist-cyan transition-colors select-none"
                            >
                              Clear All
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {recentSearches.filter(item => !vaultedParticipantIds.has(item.id)).map((item) => (
                              <div 
                                key={item.id} 
                                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 group transition-all"
                              >
                                <div 
                                  onClick={() => {
                                    if (item.type === 'user') {
                                      setViewingProfileInSearch(item);
                                    } else {
                                      const existingChat = chats.find(c => c.id === item.id);
                                      if (existingChat) {
                                        handleChatSelect(existingChat);
                                      } else {
                                        const usr = allProfiles?.find?.(p => p.id === item.id);
                                        if (usr) handleUserClick(usr);
                                      }
                                    }
                                  }}
                                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                >
                                  <img 
                                    src={getAvatarUrl(item.photo)} 
                                    alt="" 
                                    className={`w-9 h-9 rounded-xl object-cover border border-white/5`} 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                                    {item.username && (
                                      <p className="text-[9px] text-white/40 font-semibold tracking-wide">@{item.username}</p>
                                    )}
                                  </div>
                                </div>
                                <button 
                                  onClick={() => removeRecentSearch(item.id)}
                                  className="p-1.5 text-white/20 hover:text-white rounded-lg hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Profiles */}
                      {suggestedUsers && suggestedUsers.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-[10px] font-black tracking-widest text-white/30 uppercase block">Suggested Profiles</span>
                          <div className="space-y-2">
                            {suggestedUsers.filter(item => !vaultedParticipantIds.has(item.id || item.uid)).slice(0, 6).map((item: any) => (
                              <div 
                                key={item.id || item.uid}
                                className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group/card"
                              >
                                <div 
                                  onClick={() => setViewingProfileInSearch(item)}
                                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                >
                                  <div className="relative shrink-0">
                                    <div className="w-12 h-12 md:w-[52px] md:h-[52px] rounded-2xl bg-gradient-to-tr from-white/5 to-white/10 border border-white/10 overflow-hidden transition-all duration-200 ease-in-out md:group-hover/card:scale-[1.03] md:group-hover/card:shadow-md active:scale-95">
                                      <img src={getAvatarUrl(item.photoURL)} className="w-full h-full object-cover rounded-xl" alt="" />
                                    </div>
                                    {item.online && (
                                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0c0d12] z-10" />
                                    )}
                                    {item.recommScore && (
                                      <span className="absolute -top-1 -left-1 bg-aeirmist-cyan text-black text-[7px] font-black px-1 rounded-full border border-black scale-90 z-10">
                                        {item.recommScore}%
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center gap-1">
                                      <p className="text-xs font-bold text-white truncate">{item.displayName || item.username}</p>
                                      {(item.badge || item.isVerified) && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />}
                                    </div>
                                    <p className="text-[9px] text-white/40 font-semibold line-height-none">
                                      @{item.username && item.username !== 'user' && item.username !== 'null'
                                        ? item.username.replace(/^@+/, '')
                                        : (item.displayName ? item.displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : 'member')}
                                    </p>
                                    {item.recommReason && (
                                      <div className="text-[8px] text-aeirmist-magenta/80 font-black uppercase tracking-wider block mt-0.5 truncate max-w-[120px] leading-tight">
                                        {item.recommReason}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    addToRecentSearches(item);
                                    handleUserClick(item);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 hover:bg-aeirmist-cyan hover:text-black hover:border-aeirmist-cyan text-[10px] text-aeirmist-cyan font-bold transition-all whitespace-nowrap animate-pulse shrink-0"
                                >
                                  Message
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mutual Connections */}
                      {suggestedUsers && suggestedUsers.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-[10px] font-black tracking-widest text-white/30 uppercase block">Mutual Connections</span>
                          <div className="space-y-2">
                            {suggestedUsers
                              .filter(p => p.id !== profile?.id && !vaultedParticipantIds.has(p.id) && (profile?.social?.following?.includes(p.id) || profile?.social?.followers?.includes(p.id)))
                              .slice(0, 6)
                              .map((item: any) => (
                                <div 
                                  key={item.id}
                                  className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-all group animate-fade-in"
                                >
                                  <div 
                                    onClick={() => setViewingProfileInSearch(item)}
                                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                  >
                                    <img src={getAvatarUrl(item.photoURL)} className="w-9 h-9 rounded-xl object-cover" alt="" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-white truncate">{item.displayName}</p>
                                      <p className="text-[9px] text-white/40">@{item.username}</p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      addToRecentSearches(item);
                                      handleUserClick(item);
                                    }}
                                    className="px-2.5 py-1 text-[9px] text-white/40 hover:text-white border border-white/5 hover:border-white/20 rounded-md transition-all whitespace-nowrap"
                                  >
                                    Chat
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* TAB = PEOPLE */}
                  {searchTab === 'people' && (
                    <>
                      {/* Recent User Searches */}
                      {recentSearches.filter(i => i.type === 'user' && !vaultedParticipantIds.has(i.id)).length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black tracking-widest text-white/30 uppercase">Recent People Searches</span>
                          </div>
                          <div className="space-y-1.5">
                            {recentSearches.filter(i => i.type === 'user' && !vaultedParticipantIds.has(i.id)).map((item) => (
                              <div key={item.id} className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 group transition-all">
                                <div onClick={() => setViewingProfileInSearch(item)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                                  <img src={getAvatarUrl(item.photo)} alt="" className="w-9 h-9 rounded-xl object-cover border border-white/5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                                    {item.username && <p className="text-[9px] text-white/40 font-semibold">@{item.username}</p>}
                                  </div>
                                </div>
                                <button onClick={() => removeRecentSearch(item.id)} className="p-1.5 text-white/20 hover:text-white rounded-lg hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100">
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested People */}
                      {suggestedUsers && suggestedUsers.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-[10px] font-black tracking-widest text-white/30 uppercase block">Suggested Profiles</span>
                          <div className="space-y-2">
                            {suggestedUsers.filter(item => !vaultedParticipantIds.has(item.id || item.uid)).map((item: any) => (
                              <div key={item.id || item.uid} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                                <div onClick={() => setViewingProfileInSearch(item)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                                  <img src={getAvatarUrl(item.photoURL)} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <p className="text-xs font-bold text-white truncate">{item.displayName || item.username}</p>
                                      {(item.badge || item.isVerified) && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />}
                                    </div>
                                    <p className="text-[9px] text-white/40 font-semibold">
                                      @{item.username && item.username !== 'user' && item.username !== 'null'
                                        ? item.username.replace(/^@+/, '')
                                        : (item.displayName ? item.displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : 'member')}
                                    </p>
                                  </div>
                                </div>
                                <button onClick={() => { addToRecentSearches(item); handleUserClick(item); }} className="px-3 py-1.5 rounded-lg bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 hover:bg-aeirmist-cyan hover:text-black text-[10px] text-aeirmist-cyan font-bold transition-all whitespace-nowrap">
                                  Message
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* TAB = MESSAGES */}
                  {searchTab === 'messages' && (
                    <div className="space-y-3">
                      <span className="text-[10px] font-black tracking-widest text-white/30 uppercase block">Recent Message Channels</span>
                      <div className="space-y-2">
                        {chats.filter(c => c.isVaulted?.[profile?.id || ''] !== true).length > 0 ? (
                          chats.filter(c => c.isVaulted?.[profile?.id || ''] !== true).map((c) => (
                            <div 
                              key={c.id}
                              onClick={() => { addToRecentSearches(c); handleChatSelect(c); }}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-cyan/30 cursor-pointer transition-all hover:bg-white/[0.04] group"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <img src={getAvatarUrl(c.photo)} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-white truncate">{c.id.startsWith('myspace_') ? 'My Space' : c.name}</p>
                                    <span className="text-[8px] text-white/30">{(c as any).timestamp ? new Date((c as any).timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                  </div>
                                  <p className="text-[10px] text-white/40 truncate mt-0.5">{typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.text || 'No recent messages')}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-12 text-center text-xs text-white/30">No active message channels found</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB = GROUPS */}
                  {searchTab === 'groups' && (
                    <div className="space-y-4">
                      {/* Action Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black tracking-widest text-white/30 uppercase">Group Channels</span>
                        <button 
                          onClick={() => setIsGroupCreationOpen(true)}
                          className="px-3 py-1.5 rounded-xl bg-aeirmist-magenta/15 border border-aeirmist-magenta/30 hover:bg-aeirmist-magenta hover:text-black text-aeirmist-magenta font-bold text-[10px] flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(255,0,234,0.15)]"
                        >
                          <Users size={12} />
                          <span>Create Group</span>
                        </button>
                      </div>

                      {/* Existing Groups */}
                      {(() => {
                        const groupChats = chats.filter(c => c.isVaulted?.[profile?.id || ''] !== true && (c.isGroup || (c as any).type === 'group' || (c.participants?.length || 0) > 2));
                        if (groupChats.length === 0) {
                          return (
                            <div className="py-12 text-center space-y-3 bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                              <div className="w-12 h-12 rounded-2xl bg-aeirmist-magenta/10 border border-aeirmist-magenta/20 flex items-center justify-center text-aeirmist-magenta mx-auto">
                                <Users size={22} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white">No Group Channels Yet</p>
                                <p className="text-[10px] text-white/40 mt-0.5">Build a network or start a community chat group.</p>
                              </div>
                              <button 
                                onClick={() => setIsGroupCreationOpen(true)}
                                className="px-4 py-2 rounded-xl bg-aeirmist-magenta text-black font-extrabold text-xs tracking-wide shadow-[0_0_15px_rgba(255,0,234,0.3)] transition-all"
                              >
                                Create Group Channel
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2">
                            {groupChats.map(c => (
                              <div 
                                key={c.id}
                                onClick={() => { addToRecentSearches(c); handleChatSelect(c); }}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-magenta/30 cursor-pointer transition-all hover:bg-white/[0.04] group"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="relative">
                                    <img src={getAvatarUrl(c.photo)} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="" />
                                    <span className="absolute -bottom-1 -right-1 px-1 bg-aeirmist-magenta text-black text-[7px] font-black rounded-md border border-black">GRP</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{c.name}</p>
                                    <p className="text-[9px] text-white/40 truncate">{c.participants?.length || 0} members • {c.lastMessage?.text || 'Active group'}</p>
                                  </div>
                                </div>
                                <ArrowRight size={14} className="text-white/20 group-hover:text-aeirmist-magenta transition-all" />
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* TAB = MEDIA */}
                  {searchTab === 'media' && (
                    <div className="space-y-3">
                      <span className="text-[10px] font-black tracking-widest text-white/30 uppercase block">Shared Media Channels</span>
                      <div className="space-y-2">
                        {chats.filter(c => c.isVaulted?.[profile?.id || ''] !== true).length > 0 ? (
                          chats.filter(c => c.isVaulted?.[profile?.id || ''] !== true).map(c => (
                            <div 
                              key={c.id}
                              onClick={() => { addToRecentSearches(c); handleChatSelect(c); }}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-cyan/30 cursor-pointer transition-all hover:bg-white/[0.04] group"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <img src={getAvatarUrl(c.photo)} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{c.id.startsWith('myspace_') ? 'My Space' : c.name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <ImageIcon size={10} className="text-aeirmist-cyan" />
                                    <span className="text-[9px] text-white/40 truncate">Tap to inspect media gallery</span>
                                  </div>
                                </div>
                              </div>
                              <ArrowRight size={14} className="text-white/20 group-hover:text-aeirmist-cyan transition-all" />
                            </div>
                          ))
                        ) : (
                          <div className="py-12 text-center text-xs text-white/30">No shared media found</div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Search Queries Active */
                (() => {
                  const lowercaseQuery = searchQuery.toLowerCase().trim();

                  const mySpaceTerms = ['my space', 'personal space', 'saved', 'notes', 'private', 'workspace'];
                  const isMySpaceSearch = mySpaceTerms.some(term => lowercaseQuery.includes(term));

                  // Matches for Chats / Channels
                  const chatMatches = chats.filter(c => 
                    c.isVaulted?.[profile?.id || ''] !== true && (
                      (c.name || '').toLowerCase().includes(lowercaseQuery) ||
                      (c.lastMessage || '').toLowerCase().includes(lowercaseQuery) ||
                      (c.id.startsWith('myspace_') && (isMySpaceSearch || lowercaseQuery.includes('my space') || lowercaseQuery.includes('space') || lowercaseQuery.includes('notes')))
                    )
                  );

                  let displayList: React.ReactNode[] = [];

                  if (searchTab === 'all' || searchTab === 'groups' || searchTab === 'messages' || searchTab === 'media') {
                    chatMatches.forEach(c => {
                      const isOnline = !!onlineUsers?.has?.(c.otherParticipantId || '');
                      const isGroup = c.isGroup || (c.participants?.length || 0) > 2;
                      
                      if (searchTab === 'groups' && !isGroup) return;

                      const lastMsgText = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.text || '');
                      const matchesMessage = searchTab === 'messages' && lastMsgText.toLowerCase().includes(lowercaseQuery);
                      const matchesName = (c.name || '').toLowerCase().includes(lowercaseQuery);

                      if (searchTab === 'messages' && !matchesMessage && !matchesName) return;

                      displayList.push(
                        <div 
                          key={`chat-${c.id}`}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-magenta/20 cursor-pointer transition-all hover:bg-white/[0.04] group animate-fade-in"
                          onClick={() => {
                            addToRecentSearches(c);
                            handleChatSelect(c);
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="relative">
                              <img src={getAvatarUrl(c.photo)} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="" />
                              {!isGroup && isOnline && (
                                <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 bg-aeirmist-lime border-2 border-aeirmist-bg rounded-md" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-white truncate">{c.id.startsWith('myspace_') ? 'My Space' : c.name}</p>
                                {isGroup && <span className="text-[7px] font-extrabold uppercase px-1 py-0.5 rounded bg-aeirmist-magenta/10 border border-aeirmist-magenta/20 text-aeirmist-magenta">Group</span>}
                              </div>
                              <p className="text-[10px] text-white/40 truncate">{lastMsgText || 'Active channel'}</p>
                            </div>
                          </div>
                          <ArrowRight size={14} className="text-white/20 group-hover:text-aeirmist-cyan group-hover:translate-x-1 transition-all" />
                        </div>
                      );
                    });
                  }

                  if (searchTab === 'all' || searchTab === 'people') {
                    searchResults.forEach(item => {
                      const isOnline = !!onlineUsers?.has?.(item.id);
                      displayList.push(
                        <div 
                          key={`person-${item.id}`}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-cyan/20 cursor-pointer transition-all hover:bg-white/[0.04] group animate-fade-in"
                          onClick={() => setViewingProfileInSearch(item)}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="relative">
                              <img src={getAvatarUrl(item.photoURL || item.photo)} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="" />
                              {isOnline && (
                                <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 bg-aeirmist-lime border-2 border-aeirmist-bg rounded-md" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1">
                                <p className="text-xs font-bold text-white truncate">{item.displayName || item.name || item.username}</p>
                                {(item.badge || item.isVerified) && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />}
                              </div>
                              <p className="text-[9px] text-white/40 font-semibold line-height-none">
                                @{item.username && item.username !== 'user' && item.username !== 'null'
                                  ? item.username.replace(/^@+/, '')
                                  : (item.displayName ? item.displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : 'member')}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const searchItem = {
                                id: item.id || item.uid,
                                name: item.displayName || item.name || item.username || '',
                                photo: item.photoURL || item.photo || '',
                                username: item.username || '',
                                type: 'user'
                              };
                              addToRecentSearches(searchItem);
                              handleUserClick(item);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 hover:bg-aeirmist-cyan hover:text-black hover:border-aeirmist-cyan text-[10px] text-aeirmist-cyan font-bold transition-all whitespace-nowrap shrink-0"
                          >
                            Message
                          </button>
                        </div>
                      );
                    });
                  }

                  if (displayList.length === 0) {
                    return (
                      <div className="py-16 text-center space-y-4 animate-fade-in">
                        <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 mx-auto flex items-center justify-center text-white/20">
                          <Search size={24} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-white/60">No results found in {searchTab.toUpperCase()}</p>
                          <p className="text-[10px] text-white/30 max-w-xs mx-auto">Try switching tabs or searching with another keyword.</p>
                        </div>
                      </div>
                    );
                  }

                  return <div className="space-y-2.5">{displayList}</div>;
                })()
              )}
            </div>
          </div>
        ) : vaultState.isOpen ? (
          <Vault 
            db={db}
            profile={profile}
            chats={chats}
            onSelectChat={(chatId) => {
              setVaultState(prev => ({ ...prev, activeVaultChatId: chatId, isUnlocked: true }));
              setActiveChatId(chatId);
              setIsMobileList(false);
            }}
            onClose={() => {
              setVaultState({ isOpen: false, isUnlocked: false, activeVaultChatId: null });
              setActiveChatId(null);
            }}
            isUnlocked={vaultState.isUnlocked}
            setIsUnlocked={(val) => setVaultState(prev => ({ ...prev, isUnlocked: val }))}
            allProfiles={allProfiles}
            onHome={() => {
              setVaultState(prev => ({ ...prev, activeVaultChatId: null }));
              setActiveChatId(null);
            }}
          />
        ) : (
          /* Normal Sidebar View starts here */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="pt-[calc(0.875rem+env(safe-area-inset-top,0px))] md:pt-4 px-3.5 md:px-4 pb-1.5 space-y-2.5 min-w-0 relative">
              <div className="flex items-center justify-between gap-3">
                <div 
                  className="flex flex-col cursor-pointer group min-w-0 flex-1" 
                  onClick={() => setIsAccountSwitcherOpen(true)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,0.5)] flex-shrink-0" />
                    <h1 className="text-base font-bold tracking-tight group-hover:text-aeirmist-cyan transition-colors truncate">
                      {profile?.username && profile.username !== 'user' && profile.username !== 'null'
                        ? profile.username
                        : (profile?.displayName || 'My Profile')}
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 relative">
                  <button 
                    onClick={() => setIsGroupCreationOpen(true)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all border bg-slate-100 dark:bg-[#0f0f13]/85 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 hover:border-slate-400 dark:hover:border-white/20 hover:text-aeirmist-cyan"
                  >
                    <Users size={16} />
                  </button>
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all border bg-slate-100 dark:bg-[#0f0f13]/85 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 hover:border-slate-400 dark:hover:border-white/20 hover:text-aeirmist-cyan"
                    title="Inbox Settings"
                  >
                    <Settings size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMoreMenuOpen(!isMoreMenuOpen);
                    }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border relative overflow-hidden group/btn ${
                      isMoreMenuOpen 
                        ? 'bg-gradient-to-tr from-aeirmist-cyan/15 to-transparent border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.35)] font-bold' 
                        : 'bg-[#0f0f13]/85 border-white/10 text-white/40 hover:border-white/20 hover:text-aeirmist-cyan hover:shadow-[0_0_10px_rgba(255,255,255,0.05)]'
                    }`}
                  >
                    <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                    <MoreVertical size={16} />
                    {chats.some(c => c.status === 'request' && c.lastMessageSenderId !== profile?.id && !c.readBy?.includes(profile?.id)) && (
                       <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-aeirmist-magenta rounded-full border border-aeirmist-bg shadow-[0_0_6px_rgba(255,0,234,0.6)]" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isMoreMenuOpen && (
                      <motion.div key="messenger-more-menu-wrapper">
                        <div className="fixed inset-0 z-[80]" onClick={() => setIsMoreMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-12 w-56 rounded-2xl bg-[#0a0a0c]/98 border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[90] p-2 backdrop-blur-xl"
                        >
                          <div className="px-3 py-2 border-b border-white/5 mb-1.5">
                            <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">Connections Options</p>
                          </div>

                          {/* 0. Secret Encrypted Vault */}
                          <button 
                            onClick={() => { 
                              setVaultState({ isOpen: true, isUnlocked: false, activeVaultChatId: null }); 
                              setIsMobileList(false); 
                              setIsMoreMenuOpen(false); 
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/80 hover:text-white transition-all text-left group"
                          >
                            <Lock size={16} className="text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-white">Vault</p>
                                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">PIN</span>
                              </div>
                              <p className="text-[10px] text-white/40 truncate">Hidden & encrypted chats</p>
                            </div>
                          </button>

                          <button 
                            onClick={() => { setView('requests'); setIsMobileList(false); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <MessageSquare size={16} className="text-aeirmist-magenta" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Message Requests</p>
                            </div>
                          </button>

                          <button 
                            onClick={() => { setView('restricted'); setIsMobileList(false); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <Ghost size={16} className="text-[#00F2FF]" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Restrictions</p>
                            </div>
                          </button>

                          <button 
                            onClick={() => { setView('blocked'); setIsMobileList(false); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <ShieldAlert size={16} className="text-red-400" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Block Accounts</p>
                            </div>
                          </button>

                          <button 
                            onClick={() => { setView('history'); setIsMobileList(false); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <Phone size={16} className="text-aeirmist-lime" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Call History</p>
                            </div>
                          </button>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="relative">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searchQuery ? 'text-aeirmist-cyan' : 'text-white/40'}`} size={14} />
                <input 
                  type="text" 
                  placeholder="Search people, messages, groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl py-3 pl-11 pr-8 text-xs font-medium text-slate-800 dark:text-white/90 outline-none focus:border-aeirmist-cyan/40 dark:focus:bg-white/[0.08] focus:bg-slate-200/80 transition-all placeholder:text-slate-400 dark:placeholder:text-white/30"
                />
              </div>

              {/* Clean Horizontal Filter Pills */}
              <div className="flex gap-2 overflow-x-auto py-0.5 select-none scroll-smooth no-scrollbar">
                <button 
                  onClick={() => setActiveFilter('all')}
                  className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                    activeFilter === 'all' 
                      ? 'bg-gradient-to-tr from-aeirmist-cyan/15 to-transparent border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.3)] font-bold' 
                      : 'bg-slate-100 dark:bg-[#0f0f13]/85 border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  All
                </button>
                <button 
                  onClick={() => setActiveFilter('unread')}
                  className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                    activeFilter === 'unread' 
                      ? 'bg-gradient-to-tr from-aeirmist-cyan/15 to-transparent border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.3)] font-bold' 
                      : 'bg-slate-100 dark:bg-[#0f0f13]/85 border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  Unread {chats.some(c => c.unread) && <span className="w-1.5 h-1.5 rounded-full bg-aeirmist-magenta shadow-[0_0_6px_rgba(255,0,234,0.8)] animate-pulse" />}
                </button>
                <button 
                  onClick={() => setActiveFilter('personal')}
                  className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                    activeFilter === 'personal' 
                      ? 'bg-gradient-to-tr from-aeirmist-cyan/15 to-transparent border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.3)] font-bold' 
                      : 'bg-slate-100 dark:bg-[#0f0f13]/85 border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  Personal
                </button>
                <button 
                  onClick={() => setActiveFilter('marketplace')}
                  className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                    activeFilter === 'marketplace' 
                      ? 'bg-gradient-to-tr from-aeirmist-cyan/15 to-transparent border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.3)] font-bold' 
                      : 'bg-slate-100 dark:bg-[#0f0f13]/85 border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  Marketplace
                </button>
                <button 
                  onClick={() => setActiveFilter('groups')}
                  className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                    activeFilter === 'groups' 
                      ? 'bg-gradient-to-tr from-aeirmist-cyan/15 to-transparent border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.3)] font-bold' 
                      : 'bg-slate-100 dark:bg-[#0f0f13]/85 border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  Groups
                </button>
                <button 
                  onClick={() => setActiveFilter('archived')}
                  className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                    activeFilter === 'archived' 
                      ? 'bg-gradient-to-tr from-aeirmist-cyan/15 to-transparent border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.3)] font-bold' 
                      : 'bg-slate-100 dark:bg-[#0f0f13]/85 border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  Archived
                </button>
                <button 
                  onClick={() => setActiveFilter('requests')}
                  className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                    activeFilter === 'requests' 
                      ? 'bg-gradient-to-tr from-aeirmist-cyan/15 to-transparent border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.3)] font-bold' 
                      : 'bg-slate-100 dark:bg-[#0f0f13]/85 border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  Requests {requestChats.length > 0 && <span className="bg-aeirmist-magenta text-white text-[7px] font-black px-1.5 py-0.5 rounded-full animate-pulse">{requestChats.length}</span>}
                </button>
                <button 
                  onClick={() => {
                    setVaultState({ isOpen: true, isUnlocked: false, activeVaultChatId: null });
                    setIsMobileList(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 border border-purple-500/30 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-400"
                >
                  <Lock size={10} className="text-purple-400" />
                  <span>Vault</span>
                </button>
              </div>
            </div>

            {/* Note/Active and Chat lists */}
            <div className="flex-1 overflow-y-auto pb-24 md:pb-4">
              {activeFilter === 'all' && (
                <NotesSystem 
                  chats={chats} 
                  onReplyNote={(chatId, noteText, authorName) => {
                    const isAuthorValid = authorName && typeof authorName === 'string' && 
                      authorName.trim() !== '' && 
                      authorName.toLowerCase() !== 'unknown' && 
                      authorName.toLowerCase() !== 'unknown user';
                    const cleanAuthor = isAuthorValid ? authorName.trim() : 'User';
                    setActiveChatId(chatId);
                    setTempChat(null);
                    setIsMobileList(false);
                    setMessageSearchQuery('');
                    setIsInfoOpen(false);
                    setPendingNoteReply({
                      chatId,
                      text: `${cleanAuthor}'s Note: "${noteText}"`,
                      authorName: cleanAuthor
                    });
                  }}
                />
              )}
              {filteredChats.length === 0 && (
                <div className="p-8 text-center text-white/20 text-[10px] uppercase font-black tracking-widest leading-loose py-20 animate-fade-in">
                  No {activeFilter !== 'all' ? activeFilter : 'active'} chats.
                </div>
              )}
              {filteredChats.map((chat) => {
                const isOnline = !!onlineUsers?.has?.(chat.otherParticipantId);
                const isSelected = currentChat?.id === chat.id;
                const activityTimestamp = getChatActivityMs(chat);
                const metaTime = formatConversationTime(activityTimestamp) || (chat.createdAt ? formatConversationTime(chat.createdAt) : '');

                return (
                  <div 
                    key={chat.id} 
                    onClick={() => handleChatSelect(chat)}
                    onContextMenu={(e) => handleContextMenu(e, chat.id)}
                    className={`w-full h-[72px] px-3.5 md:px-4 flex items-center gap-3 cursor-pointer hover:bg-aeirmist-cyan/[0.05] transition-all relative group ${isSelected ? 'bg-aeirmist-cyan/[0.08]' : ''}`}
                  >
                    {/* Avatar */}
                    {chat.isGroup || chat.type === 'group' ? (
                      <div className="relative flex-shrink-0">
                        <img src={getAvatarUrl(chat.photo || chat.groupPhotoURL)} className="w-12 h-12 rounded-2xl object-cover border border-white/10" alt="" />
                        <span className="absolute -bottom-1 -right-1 px-1 bg-aeirmist-magenta text-black text-[7px] font-black rounded-md border border-black">GRP</span>
                      </div>
                    ) : (
                      <div className="relative flex-shrink-0">
                        <LiveParticipantAvatar 
                          participantId={chat.otherParticipantId} 
                          fallbackPhoto={chat.photo} 
                          showStoryRing={chat.otherParticipantId !== profile?.id}
                          sizeClassName="w-12 h-12"
                          roundedClassName="rounded-2xl"
                          innerRoundedClassName="rounded-[14px]"
                        />
                        {chat.otherParticipantId !== profile?.id && isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-aeirmist-lime border-2 border-aeirmist-bg rounded-full z-10" />}
                      </div>
                    )}

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      {/* Top Row: Name + Pin badge + Meta timestamp */}
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <h3 className={`text-[13px] md:text-[14px] font-bold truncate ${chat.unread ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-white/90'}`}>
                            {chat.isGroup || chat.type === 'group' ? (chat.name || chat.groupName || 'Group Chat') : (chat.otherParticipantId === profile?.id ? 'My Space' : <LiveParticipantName participantId={chat.otherParticipantId} fallbackName={chat.name} chatId={chat.id} />)}
                          </h3>
                          {chat.isPinned && (
                            <Pin size={11} className="text-aeirmist-cyan shrink-0 rotate-45" />
                          )}
                        </div>
                        {metaTime ? (
                          <span className={`text-[10px] md:text-[11px] shrink-0 font-medium text-right whitespace-nowrap pl-1 ${chat.unread ? 'text-aeirmist-cyan font-bold' : 'text-slate-400 dark:text-white/40'}`}>
                            {metaTime}
                          </span>
                        ) : null}
                      </div>

                      {/* Bottom Row: Last message preview + Unread badge */}
                      <div className="flex items-center justify-between gap-2 min-w-0 mt-0.5">
                        <p className={`text-[12px] truncate flex-1 min-w-0 ${chat.unread ? 'text-slate-800 dark:text-white font-semibold' : 'text-slate-400 dark:text-white/50'}`}>
                          {chat.lastMessage || 'No messages yet'}
                        </p>
                        {chat.unread && (
                          <div className="w-2.5 h-2.5 rounded-full bg-aeirmist-cyan shadow-[0_0_10px_rgba(0,242,255,0.5)] shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Chat Window */}
      <div className={`${isMobileList ? 'hidden md:flex' : 'flex'} ${vaultState.isOpen && !vaultState.activeVaultChatId ? 'hidden md:hidden' : 'flex-1'} flex-col h-full min-h-0 bg-aeirmist-bg relative min-w-0 w-full max-w-full overflow-hidden`}>
        {view === 'restricted' ? (
          <div className="flex-1 h-full overflow-hidden">
            <RestrictedSection 
              onBack={() => { setView('chats'); setIsMobileList(true); }} 
              onUserClick={onUserClick}
            />
          </div>
        ) : view === 'blocked' ? (
          <div className="flex-1 h-full overflow-hidden">
            <BlockedSection 
              onBack={() => { setView('chats'); setIsMobileList(true); }} 
              onUserClick={onUserClick}
            />
          </div>
        ) : view === 'history' ? (
          <div className="flex-1 h-full overflow-hidden">
            <CallHistorySection 
              onBack={() => { setView('chats'); setIsMobileList(true); }} 
              onRedial={async (pid, type) => {
                const profileDoc = await getDoc(doc(db, 'profiles', pid));
                if (profileDoc.exists()) {
                  handleUserClick({ id: pid, ...profileDoc.data() }, type);
                }
              }}
              onUserClick={onUserClick}
            />
          </div>
        ) : view === 'requests' ? (
          <div className="flex-1 h-full overflow-hidden">
            <RequestsSection 
              chats={requestChats} 
              onBack={() => { setView('chats'); setIsMobileList(true); }} 
              onUserClick={onUserClick} 
              onChatSelect={(id) => {
                setView('chats');
                setActiveChatId(id);
                setTempChat(null);
                setMessageSearchQuery('');
                setIsInfoOpen(false);
                setIsMobileList(false);
              }}
            />
          </div>
        ) : currentChat ? (
          (currentChat.isVaulted?.[profile?.id || ''] === true && !vaultState.isUnlocked) ? (
            <Vault 
              db={db}
              profile={profile}
              chats={chats}
              onSelectChat={(chatId) => {
                setVaultState(prev => ({ ...prev, activeVaultChatId: chatId, isUnlocked: true }));
                setActiveChatId(chatId);
                setTempChat(null);
                setMessageSearchQuery('');
                setIsInfoOpen(false);
                setIsMobileList(false);
              }}
              onClose={() => {
                setVaultState({ isOpen: false, isUnlocked: false, activeVaultChatId: null });
                setActiveChatId(null);
                setIsMobileList(true);
              }}
              isUnlocked={vaultState.isUnlocked}
              setIsUnlocked={(val) => setVaultState(prev => ({ ...prev, isUnlocked: val }))}
              allProfiles={allProfiles}
              onHome={() => {
                setVaultState(prev => ({ ...prev, activeVaultChatId: null }));
                setActiveChatId(null);
              }}
            />
          ) : (
            <div className="flex-1 flex flex-row h-full min-h-0 overflow-hidden relative">
              <ChatWindow 
                key={currentChat.id}
                chat={currentChat} 
                isVaultMode={currentChat.isVaulted?.[profile?.id || ''] === true}
                onBack={() => setIsMobileList(true)} 
                toggleInfo={() => setIsInfoOpen(!isInfoOpen)}
                onUserClick={onUserClick}
                onChatUpdate={(newChat) => {
                  setActiveChatId(newChat.id);
                  setTempChat(null);
                }}
                onForwardMessage={handleForward}
                messageFilter={messageSearchQuery}
                viewportHeight={viewportHeight}
                isMobileList={isMobileList}
                autoCall={pendingCall?.conversationId === currentChat.id ? pendingCall.type : undefined}
                onCallStarted={() => setPendingCall(null)}
                isWallpaperCustomizerOpen={isWallpaperCustomizerOpen}
                setIsWallpaperCustomizerOpen={setIsWallpaperCustomizerOpen}
                localAvatarURL={localAvatarURL}
                pendingNoteReply={pendingNoteReply}
                onClearPendingNoteReply={() => setPendingNoteReply(null)}
                onMessageSent={handleOptimisticChatBump}
              />
            <AnimatePresence>
              {isInfoOpen && (
                <div className="absolute inset-0 md:relative md:inset-auto z-50 flex justify-end shrink-0">
                  <div className="md:hidden absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsInfoOpen(false)} />
                  {(currentChat.isGroup || currentChat.type === 'group') ? (
                    <GroupInfoPanel 
                      chat={currentChat} 
                      chats={chats}
                      onClose={() => setIsInfoOpen(false)} 
                      onOpenWallpaper={() => {
                        setIsWallpaperCustomizerOpen(true);
                        setIsInfoOpen(false);
                      }}
                    />
                  ) : (
                    <ChatInfoPanel 
                      chat={currentChat} 
                      onClose={() => setIsInfoOpen(false)} 
                      onUserClick={onUserClick}
                      onSearch={(query) => {
                         setMessageSearchQuery(query);
                         setIsInfoOpen(false);
                      }}
                      onOpenAppearance={() => {
                        setIsWallpaperCustomizerOpen(true);
                        setIsInfoOpen(false);
                      }}
                    />
                  )}
                </div>
              )}
            </AnimatePresence>
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center bg-transparent relative overflow-hidden select-none min-h-0 w-full animate-fade-in">
            {/* Subtle Ambient Glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] bg-aeirmist-cyan/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 max-w-sm mx-auto flex flex-col items-center">
              {/* Premium Minimal Message Icon */}
              <div className="relative mb-5">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] dark:bg-white/[0.03] border border-white/10 backdrop-blur-xl flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.25)] relative group transition-transform hover:scale-105 duration-300">
                  <MessageSquare size={26} className="text-aeirmist-cyan drop-shadow-[0_0_12px_var(--color-aeirmist-cyan)]" />
                  <div className="absolute -bottom-1.5 -right-1.5 p-1 rounded-lg bg-black/80 border border-white/10 text-white/70 shadow-sm">
                    <Lock size={11} className="text-aeirmist-cyan" />
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white/95">
                Your messages
              </h2>
              <p className="text-xs sm:text-sm text-white/45 mt-2 leading-relaxed max-w-xs">
                Select a conversation or search for someone to start chatting.
              </p>

              {/* Action Button: Find People */}
              <button
                type="button"
                onClick={() => {
                  const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                  if (searchInput) {
                    searchInput.focus();
                  } else {
                    setIsMobileList(true);
                  }
                }}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-aeirmist-cyan/15 hover:bg-aeirmist-cyan/25 border border-aeirmist-cyan/35 text-aeirmist-cyan text-xs font-bold tracking-wide transition-all active:scale-95 shadow-[0_0_20px_rgba(0,242,255,0.15)] cursor-pointer"
              >
                <Search size={14} />
                <span>Find people</span>
              </button>

              {/* Minimal Security Footnote */}
              <div className="mt-8 flex items-center justify-center gap-1.5 text-[10px] text-white/30 uppercase tracking-[0.2em] font-semibold">
                <ShieldCheck size={12} className="text-aeirmist-cyan/70" />
                <span>End-to-end encrypted</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {contextMenu && (
          <ChatContextMenu 
            x={contextMenu.x} 
            y={contextMenu.y} 
            onClose={() => setContextMenu(null)}
            chatId={contextMenu.chatId}
            isPinned={chats.find(c => c.id === contextMenu.chatId)?.isPinned}
            isMuted={chats.find(c => c.id === contextMenu.chatId)?.isMuted}
            isArchived={chats.find(c => c.id === contextMenu.chatId)?.isArchived}
            isUnread={chats.find(c => c.id === contextMenu.chatId)?.unread}
            isCloseFriend={isCloseFriend(chats.find(c => c.id === contextMenu.chatId)?.otherParticipantId || '')}
            otherParticipantId={chats.find(c => c.id === contextMenu.chatId)?.otherParticipantId}
            onViewProfile={() => {
              const chatObj = chats.find(c => c.id === contextMenu.chatId);
              const otherParticipantId = chatObj?.otherParticipantId;
              const otherParticipant = otherParticipantId ? chatObj?.participantDetails?.[otherParticipantId] : null;
              if (otherParticipant) {
                onUserClick?.({
                  id: otherParticipantId,
                  username: otherParticipant.username || otherParticipant.name || '',
                  photoURL: otherParticipant.photoURL || '',
                  displayName: otherParticipant.displayName || otherParticipant.name || ''
                });
              }
            }}
          />
        )}
      </AnimatePresence>

      <AccountSwitcher 
        isOpen={isAccountSwitcherOpen} 
        onClose={() => setIsAccountSwitcherOpen(false)} 
      />

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      <AnimatePresence>
        {viewingProfileInSearch && (
          <motion.div 
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-[#070709] z-[110] flex flex-col"
          >
            <header className="flex-shrink-0 px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-md">
              <button 
                onClick={() => setViewingProfileInSearch(null)} 
                className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              >
                <ChevronLeft size={20} className="text-aeirmist-cyan" />
                <span className="text-sm font-semibold font-display tracking-tight uppercase">Back to Search</span>
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">
              <ProfileSystem 
                targetProfile={viewingProfileInSearch} 
                onMessageClick={(userData) => {
                  setViewingProfileInSearch(null);
                  setIsSearchFocused(false);
                  handleUserClick(userData);
                }}
                onUserClick={(userData) => {
                  setViewingProfileInSearch(userData);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ChatWindow = ({ 
  chat, 
  onBack, 
  toggleInfo, 
  onChatUpdate, 
  messageFilter, 
  viewportHeight, 
  isMobileList, 
  autoCall, 
  onCallStarted,
  onUserClick,
  onForwardMessage,
  isWallpaperCustomizerOpen,
  setIsWallpaperCustomizerOpen,
  isVaultMode = false,
  localAvatarURL,
  pendingNoteReply,
  onClearPendingNoteReply,
  onMessageSent
}: { 
  chat: Chat, 
  onBack: () => void, 
  toggleInfo: () => void, 
  onChatUpdate: (chat: Chat) => void, 
  messageFilter?: string, 
  viewportHeight: string, 
  isMobileList: boolean, 
  autoCall?: 'audio' | 'video', 
  onCallStarted?: () => void,
  onUserClick?: (user: any) => void,
  onForwardMessage?: (msg: any) => void,
  isWallpaperCustomizerOpen: boolean,
  setIsWallpaperCustomizerOpen: (val: boolean) => void,
  isVaultMode?: boolean,
  localAvatarURL?: string,
  pendingNoteReply?: { chatId: string; text: string; authorName: string } | null,
  onClearPendingNoteReply?: () => void,
  onMessageSent?: (chatId: string, text: string, currentChat?: any) => void
}) => {
  const { 
    db, 
    storage, 
    user, 
    profile, 
    sendMessage, 
    setTypingStatus, 
    markAsRead, 
    updateSeenStatus, 
    endCall, 
    acceptCall, 
    rejectCall, 
    uploadMedia, 
    setCameraConfig, 
    requestPermission, 
    isOffline, 
    activeCall, 
    onlineUsers, 
    mediaSettings, 
    isBlocked, 
    isRestricted, 
    isFollowing, 
    isFollowPending, 
    editMessage, 
    togglePinMessage, 
    clearChat, 
    toggleFollow, 
    addToast
  } = useAeirmist();
  const { settings } = useAppearance();

  const [messages, setMessages] = useState<any[]>([]);
  const [optimistic, setOptimistic] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let maxVH = window.innerHeight;
    const checkKeyboard = () => {
      if (window.innerHeight > maxVH) maxVH = window.innerHeight;
      const heightDiff = maxVH - Math.min(window.innerHeight, window.visualViewport?.height || window.innerHeight);
      setIsKeyboardOpen(heightDiff > 120);
    };
    window.visualViewport?.addEventListener('resize', checkKeyboard);
    window.visualViewport?.addEventListener('scroll', checkKeyboard);
    window.addEventListener('resize', checkKeyboard);
    return () => {
      window.visualViewport?.removeEventListener('resize', checkKeyboard);
      window.visualViewport?.removeEventListener('scroll', checkKeyboard);
      window.removeEventListener('resize', checkKeyboard);
    };
  }, []);

  useEffect(() => {
    if (pendingNoteReply && pendingNoteReply.chatId === chat.id) {
      setReplyingTo({
        id: 'note-reply-' + Date.now(),
        text: pendingNoteReply.text,
        senderId: 'note-author'
      } as any);
      onClearPendingNoteReply?.();
    }
  }, [pendingNoteReply, chat.id, onClearPendingNoteReply]);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [expandedAlbumImages, setExpandedAlbumImages] = useState<string[] | undefined>(undefined);
  const [expandedImageIndex, setExpandedImageIndex] = useState<number>(0);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
  const [isOutgoingCallLocally, setIsOutgoingCallLocally] = useState<boolean>(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ progress: number, status: string } | null>(null);
  const [isHDActive, setIsHDActive] = useState(false);
  const inputCaptureRef = useRef<((file: File) => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (scrollRef.current) {
      if (behavior === 'smooth') {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, []);
  const [failedMessages, setFailedMessages] = useState<Set<string>>(new Set());
  const [otherProfile, setOtherProfile] = useState<any>(null);
  const [otherProfileLoaded, setOtherProfileLoaded] = useState(false);

  // Messenger 2.0: Hydrate persistent local outbox on active chat selection
  useEffect(() => {
    if (!chat.id) return;
    const outboxItems = messageOutboxService.getOutbox(chat.id);
    if (outboxItems && outboxItems.length > 0) {
      setOptimistic(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newItems = outboxItems
          .filter(item => !existingIds.has(item.id))
          .map(item => ({
            id: item.id,
            text: item.text,
            senderId: profile?.id,
            type: item.type as any,
            mediaUrl: item.mediaUrl || undefined,
            timestamp: item.status === 'failed' ? 'Failed to send' : 'Sending...',
            timestampMs: item.timestampMs,
            isOptimistic: item.status === 'sending',
            isFailed: item.status === 'failed',
            metadata: item.metadata
          }));
        return [...prev, ...newItems];
      });

      setFailedMessages(prev => {
        const next = new Set(prev);
        outboxItems.filter(i => i.status === 'failed').forEach(i => next.add(i.id));
        return next;
      });
    }
  }, [chat.id, profile?.id]);

  const showTheirPresence = otherProfile?.privacySettings?.showActivity !== false;
  const isMySpace = chat.id.startsWith('myspace_');
  const isSelfChat = chat.otherParticipantId === profile?.id;
  const isPrivateSpace = isMySpace || isSelfChat;

  const isGroupChat = Boolean(chat.isGroup || (chat as any).type === 'group' || (chat.participants && chat.participants.length > 2));
  const isOtherUnavailable = useMemo(() => {
    if (isPrivateSpace || isGroupChat || !chat.otherParticipantId) return false;
    if (!otherProfileLoaded) return false;
    if (otherProfile === null) return true;
    if (otherProfile.isDeleted === true || otherProfile.status === 'deleted') return true;
    return false;
  }, [isPrivateSpace, isGroupChat, chat.otherParticipantId, otherProfileLoaded, otherProfile]);

  // Intercept back for overlays inside active chat
  useBackHandler(() => {
    if (expandedImage) {
      setExpandedImage(null);
      setExpandedAlbumImages(undefined);
      return true;
    }
    if (isWallpaperCustomizerOpen) {
      setIsWallpaperCustomizerOpen(false);
      return true;
    }
    if (replyingTo) {
      setReplyingTo(null);
      return true;
    }
    if (editingMessage) {
      setEditingMessage(null);
      return true;
    }
    return false;
  }, true, 90, [expandedImage, isWallpaperCustomizerOpen, replyingTo, editingMessage]);

  useEffect(() => {
    const otherId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile?.id);
    if (!db || !otherId) {
      setOtherProfile(null);
      setOtherProfileLoaded(true);
      return;
    }
    
    // Subscribe to other user's profile to check if they are private or deleted
    const unsub = onSnapshot(doc(db, 'profiles', otherId), (snap) => {
      setOtherProfileLoaded(true);
      if (snap.exists()) {
        const pData = snap.data();
        if (pData.isDeleted === true || pData.status === 'deleted') {
          setOtherProfile({ id: snap.id, ...pData, isDeleted: true });
        } else {
          setOtherProfile({ id: snap.id, ...pData });
        }
      } else {
        setOtherProfile(null);
      }
    }, (err) => {
      logger.warn("Could not listen to other profile:", err);
      setOtherProfileLoaded(true);
      setOtherProfile(null);
    });
    
    return () => unsub();
  }, [db, chat.otherParticipantId, chat.profileIds, profile?.id]);

  const handleReply = (msg: any) => {
    setReplyingTo(msg);
    setTimeout(() => {
      document.querySelector('textarea')?.focus();
    }, 50);
  };

  // Handle auto-call (redial)
  useEffect(() => {
    if (autoCall && !activeCall) {
       handleCallClick(autoCall);
       onCallStarted?.();
    }
  }, [autoCall, activeCall]);

  const openCamera = async () => {
    const granted = await requestPermission('camera');
    if (!granted) {
      addToast?.({
        title: "Camera Blocked",
        message: "Please allow camera access in your device/browser settings to capture photos.",
        type: "warning"
      });
      return;
    }

    setCameraConfig({
      isOpen: true,
      mode: 'PHOTO',
      onCapture: (file) => {
        if (inputCaptureRef.current) {
          inputCaptureRef.current(file);
        } else {
          handleSendMedia(file);
        }
      }
    });
  };

  const handleVisitProfile = () => {
    if (isOtherUnavailable) {
      addToast?.({
        title: 'Unavailable',
        message: 'This person is unavailable on Aeirmist.',
        type: 'info'
      });
      return;
    }
    onUserClick?.({
      id: chat.otherParticipantId || chat.profileIds?.find(id => id !== profile?.id),
      displayName: chat.name,
      photoURL: chat.photo
    });
  };

  const handleCallClick = async (type: 'audio' | 'video') => {
    if (isOtherUnavailable) {
      addToast?.({
        title: 'Call Unavailable',
        message: 'This person is unavailable on Aeirmist.',
        type: 'warning'
      });
      return;
    }

    setIsOutgoingCallLocally(true);
    setCallType(type);
  };

  // Intersection Observer for Seen Status
  useEffect(() => {
    if (!db || !chat.id || !user || chat.id.startsWith('new_') || chat.status === 'request') return;

    // Check if there are any unread messages from the other user
    const hasUnread = messages.some(m => {
      if (m.senderId === profile.id) return false;
      const lastReadTs = chat.lastRead?.[profile.id];
      const lastReadMs = lastReadTs?.toMillis ? lastReadTs.toMillis() : (lastReadTs || 0);
      return m.timestampMs > lastReadMs;
    });
    
    if (hasUnread) {
      // Debounce: wait 2 seconds before marking as read to batch updates during rapid chat
      const timer = setTimeout(() => {
        updateSeenStatus(chat.id);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [messages, chat.id, user?.uid, chat.lastRead]);

  // Message Listener
  useEffect(() => {
    setMessages([]);
    setOptimistic([]);
    setLoading(true);

    if (!db || !chat.id || !user || !profile?.id || chat.id.startsWith('new_')) {
      setLoading(false);
      return;
    }

    let isCurrent = true;
    // Subscribe once per chat.id
    const unsubscribe = messagingService.subscribeToMessages(db, chat.id, profile.id, chat, (fetchedMessages) => {
      if (!isCurrent) return;
      setMessages(fetchedMessages);
      setLoading(false);
      requestAnimationFrame(() => scrollToBottom('auto'));
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [db, chat.id, user?.uid, profile?.id, scrollToBottom]);

  // Derive processed messages with live read/delivered status and guaranteed stable chronological order
  const displayedMessages = useMemo(() => {
    const otherParticipantId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile?.id);
    
    const parseTimestampMs = (val: any): number => {
      if (!val) return 0;
      if (typeof val.toMillis === 'function') return val.toMillis();
      if (typeof val.seconds === 'number') return val.seconds * 1000;
      if (typeof val === 'number' && val > 0) return val;
      if (val instanceof Date) return val.getTime();
      if (typeof val === 'string') {
        const parsed = Date.parse(val);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      return 0;
    };

    const lastRead = parseTimestampMs(chat.lastRead?.[otherParticipantId || '']);
    const lastDelivered = parseTimestampMs(chat.lastDelivered?.[otherParticipantId || '']);

    const merged = [...messages, ...optimistic].filter((msg, index, self) => {
      // Deduplicate optimistic messages if server confirms receipt
      if (msg.isOptimistic) {
        const confirmed = messages.some(m => m.metadata?.optimisticId === msg.id || m.id === msg.id);
        if (confirmed) return false;
      }
      return index === self.findIndex((m) => m.id === msg.id);
    });

    const sorted = merged.map((m, originalIndex) => {
       const timestampMs = (typeof m.timestampMs === 'number' && m.timestampMs > 0)
         ? m.timestampMs
         : (parseTimestampMs(m.createdAt) || parseTimestampMs(m.timestamp) || (m.isOptimistic ? Date.now() : Date.now()));
       return {
         ...m,
         timestampMs,
         _originalIndex: originalIndex,
         isSeen: m.isSeen || (m.senderId === profile?.id && timestampMs <= lastRead),
         isDelivered: m.isDelivered || (m.senderId === profile?.id && timestampMs <= lastDelivered),
         isFailed: failedMessages.has(m.id)
       };
    }).sort((a, b) => {
      if (a.timestampMs !== b.timestampMs) {
        return a.timestampMs - b.timestampMs;
      }
      return a._originalIndex - b._originalIndex;
    });

    return sorted.map((m, i) => ({
      ...m,
      metadata: {
        ...m.metadata,
        isNewSender: i === 0 || sorted[i-1].senderId !== m.senderId
      }
    }));
  }, [messages, optimistic, chat.lastRead, chat.lastDelivered, chat.id, profile?.id, failedMessages]);
  
  // Group consecutive media messages (sent within 120s by same sender with no caption) into Telegram albums
  const groupedDisplayItems = useMemo(() => {
    const result: Array<{
      msg: any;
      albumItems?: AlbumItem[];
      isGroupedAlbum?: boolean;
    }> = [];

    let currentAlbum: {
      leadMsg: any;
      items: AlbumItem[];
    } | null = null;

    const flushAlbum = () => {
      if (!currentAlbum) return;
      if (currentAlbum.items.length > 1) {
        // Render as a single unified album message using lead message attributes
        result.push({
          msg: {
            ...currentAlbum.leadMsg,
            mediaUrls: currentAlbum.items.map(it => it.url),
            albumItems: currentAlbum.items
          },
          albumItems: currentAlbum.items,
          isGroupedAlbum: true
        });
      } else {
        // Only 1 item, keep as original message
        result.push({ msg: currentAlbum.leadMsg });
      }
      currentAlbum = null;
    };

    for (let i = 0; i < displayedMessages.length; i++) {
      const msg = displayedMessages[i];
      const hasRealText = msg.text && !isAutoMediaPlaceholder(msg.text);
      const isMediaCandidate = (
        !hasRealText &&
        !msg.metadata?.removed &&
        (msg.type === 'image' || msg.type === 'video' || msg.type === 'media') &&
        Boolean(msg.mediaUrl || (msg.mediaUrls && msg.mediaUrls.length > 0))
      );

      if (isMediaCandidate) {
        const itemUrls: string[] = (msg.mediaUrls && msg.mediaUrls.length > 0) ? msg.mediaUrls : (msg.mediaUrl ? [msg.mediaUrl] : []);
        const newAlbumItems: AlbumItem[] = itemUrls.map((u: string, idx: number) => ({
          id: `${msg.id}_${idx}`,
          url: u,
          type: (u.includes('.mp4') || (u.includes('video') && !u.includes('image')) || msg.type === 'video') ? 'video' : 'image',
          timestampMs: msg.timestampMs,
          isOptimistic: msg.isOptimistic,
          isFailed: msg.isFailed,
          thumbnail: msg.thumbnail
        }));

        if (currentAlbum) {
          const sameSender = currentAlbum.leadMsg.senderId === msg.senderId;
          const withinTime = Math.abs((msg.timestampMs || 0) - (currentAlbum.leadMsg.timestampMs || 0)) <= 120000; // 2 minutes window
          if (sameSender && withinTime) {
            currentAlbum.items.push(...newAlbumItems);
            if (msg.isSeen) currentAlbum.leadMsg.isSeen = true;
            if (msg.isDelivered) currentAlbum.leadMsg.isDelivered = true;
            continue;
          } else {
            flushAlbum();
          }
        }

        currentAlbum = {
          leadMsg: { ...msg },
          items: newAlbumItems
        };
      } else {
        flushAlbum();
        result.push({ msg });
      }
    }

    flushAlbum();
    return result;
  }, [displayedMessages]);
  
  // Stable auto-scroll on new messages or list growth
  const prevMsgLengthRef = useRef(displayedMessages.length);
  useEffect(() => {
    if (displayedMessages.length !== prevMsgLengthRef.current) {
      prevMsgLengthRef.current = displayedMessages.length;
      requestAnimationFrame(() => scrollToBottom('auto'));
    }
  }, [displayedMessages.length, scrollToBottom]);

  // Refined scroll behavior for keyboard events
  const prevViewportHeight = useRef(viewportHeight);
  useEffect(() => {
    if (prevViewportHeight.current !== viewportHeight) {
      requestAnimationFrame(() => scrollToBottom('auto'));
      prevViewportHeight.current = viewportHeight;
    }
  }, [viewportHeight, scrollToBottom]);

  // Separate Typing Effect to avoid rebuilding message listener
  useEffect(() => {
    if (!db || !chat.id || chat.id.startsWith('new_')) return;
    
    const otherParticipantId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile?.id);
    if (!otherParticipantId) return;

    const indicatorId = `${chat.id}_${otherParticipantId}`;
    const indicatorRef = doc(db, 'typing_indicators', indicatorId);
    
    const unsubscribe = onSnapshot(indicatorRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.updatedAt) {
          try {
            const date = typeof data.updatedAt.toDate === 'function' ? data.updatedAt.toDate() : new Date(data.updatedAt);
            const isCurrentlyTyping = (Date.now() - date.getTime()) < 4000;
            setRemoteTyping(isCurrentlyTyping);
          } catch (e) {
            setRemoteTyping(false);
          }
        } else {
          setRemoteTyping(false);
        }
      } else {
        setRemoteTyping(false);
      }
    }, (err) => logger.warn("Typing sync delayed", err));

    return () => unsubscribe();
  }, [db, chat.id, profile?.id]);

  // Auto-retry failed messages when coming back online
  useEffect(() => {
    if (!isOffline && failedMessages.size > 0) {
      logger.info(`[Messenger] Connections restored. Attempting to resend ${failedMessages.size} failed messages.`);
      const failedList = Array.from(failedMessages);
      failedList.forEach(id => {
        const msg = optimistic.find(m => m.id === id);
        if (msg) handleRetry(msg);
      });
    }
  }, [isOffline, failedMessages.size]);

  const handleRetry = (msg: Message) => {
    setFailedMessages(prev => {
      const next = new Set(prev);
      next.delete(msg.id);
      return next;
    });
    setOptimistic(prev => prev.filter(m => m.id !== msg.id));
    messageOutboxService.remove(chat.id, msg.id);

    if (msg.type === 'text') {
      handleSendMessage(msg.text || '', (msg as any).mood);
    } else {
      // Re-send media if we have it locally, otherwise we try sending the URL
      if (msg.mediaUrl) {
         handleSendMediaUrl(msg.mediaUrl, msg.type as any);
      }
    }
  };

  const handleSendMediaUrl = async (mediaUrl: string, type: 'image' | 'video' | 'voice' | 'media' | 'text') => {
    if (!db || !profile || !user || !chat.id) return;

    const optimisticId = `opt_${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      text: `Sent a ${type}`,
      senderId: profile.id,
      type: type,
      mediaUrl,
      timestamp: 'Sending...',
      timestampMs: Date.now(),
      isOptimistic: true,
    };
    
    // Enqueue in local persistent outbox
    messageOutboxService.enqueue(chat.id, {
      id: optimisticId,
      text: `Sent a ${type}`,
      type,
      mediaUrl
    });

    setOptimistic(prev => [...prev, optimisticMsg]);
    onMessageSent?.(chat.id, `Sent a ${type}`, chat);
    
    try {
      const isNew = chat.id.startsWith('new_');
      const targetProfileId = isNew ? chat.id.replace('new_', '') : null;

      let otherUid = chat.otherParticipantUid || chat.participants?.find((uid: string) => uid !== user.uid);
      if (!otherUid && targetProfileId && targetProfileId.startsWith('profile_')) {
        const parts = targetProfileId.split('_');
        if (parts.length >= 2) {
          otherUid = parts[1];
        }
      }

      const targetProfile = isNew ? {
        displayName: chat.name,
        photoURL: chat.photo,
        username: targetProfileId,
        uid: otherUid
      } : null;

      const otherProfileId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile.id);
      
      const newId = await sendMessage(chat.id, `Sent a ${type}`, type === 'voice' ? 'voice' : 'media', mediaUrl, { 
        mediaType: type,
        optimisticId: optimisticId,
        recipientId: targetProfileId || otherProfileId,
        targetProfile,
        senderUid: user.uid,
        receiverUid: otherUid,
        senderName: profile.displayName || profile.username,
        senderPhoto: profile.photoURL,
        vanish: !!chat.isVanishMode
      });
      
      messageOutboxService.markDelivered(chat.id, optimisticId);

      setFailedMessages(prev => {
        const next = new Set(prev);
        next.delete(optimisticId);
        return next;
      });

      if (chat.isTemporary && newId) {
        onChatUpdate({
          ...chat,
          id: newId,
          isTemporary: false
        });
      }
    } catch (e: any) {
      logger.error(`[Messenger] Media retry failed:`, e);
      messageOutboxService.markFailed(chat.id, optimisticId, e?.message);
      setFailedMessages(prev => new Set(prev).add(optimisticId));
      setOptimistic(prev => prev.map(m => m.id === optimisticId ? { ...m, isFailed: true, isOptimistic: false, timestamp: 'Failed to send' } : m));
    }
  };

  const handleSendMessage = async (text: string, mood?: string) => {
    if (!db || !profile || !user || !chat.id) return;
    
    // Deterministic deduplication ID for instant UI feedback
    const optimisticId = `opt_${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg = {
      id: optimisticId,
      text,
      senderId: profile.id,
      type: 'text',
      timestamp: 'Sending...',
      timestampMs: Date.now(),
      isOptimistic: true,
      mood
    };
    
    // Enqueue in persistent outbox
    messageOutboxService.enqueue(chat.id, {
      id: optimisticId,
      text,
      type: 'text',
      metadata: { mood }
    });

    setOptimistic(prev => [...prev, optimisticMsg]);
    onMessageSent?.(chat.id, text, chat);
    requestAnimationFrame(() => scrollToBottom('auto'));
    setTimeout(() => scrollToBottom('auto'), 60);
    
    try {
      const isNew = chat.id.startsWith('new_');
      const targetProfileId = isNew ? chat.id.replace('new_', '') : null;

      let otherUid = chat.otherParticipantUid || chat.participants?.find((uid: string) => uid !== user.uid);
      if (!otherUid && targetProfileId && targetProfileId.startsWith('profile_')) {
        const parts = targetProfileId.split('_');
        if (parts.length >= 2) {
          otherUid = parts[1];
        }
      }

      const targetProfile = isNew ? {
        displayName: chat.name,
        photoURL: chat.photo,
        username: targetProfileId,
        uid: otherUid
      } : null;
 
      const otherProfileId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile.id);

      logger.info(`[Messenger] sending message to ${chat.id}. TargetUID: ${otherUid}`);

      const newId = await sendMessage(chat.id, text, 'text', undefined, { 
        targetProfile,
        recipientId: targetProfileId || otherProfileId,
        senderUid: user.uid,
        receiverUid: otherUid,
        senderName: profile.displayName || profile.username,
        senderPhoto: profile.photoURL,
        optimisticId,
        mood,
        vanish: !!chat.isVanishMode,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          text: replyingTo.text,
          senderId: replyingTo.senderId || null,
          senderName: replyingTo.senderId === profile?.id ? "You" : (replyingTo.metadata?.senderName || otherProfile?.displayName || otherProfile?.username || chat.name || "Sizuka")
        } : null
      });
      
      setReplyingTo(null);
      
      logger.info(`[Messenger] Connections confirmed. NewID: ${newId}`);
      
      // Mark delivered in outbox
      messageOutboxService.markDelivered(chat.id, optimisticId);

      setFailedMessages(prev => {
        const next = new Set(prev);
        next.delete(optimisticId);
        return next;
      });

      if (chat.isTemporary && newId) {
        const realChat = {
          ...chat,
          id: newId,
          isTemporary: false
        };
        onChatUpdate(realChat);
      }
    } catch (e: any) {
      logger.error("Message send failed", e);
      messageOutboxService.markFailed(chat.id, optimisticId, e?.message);
      setFailedMessages(prev => new Set(prev).add(optimisticId));
      setOptimistic(prev => prev.map(m => m.id === optimisticId ? { ...m, isFailed: true, isOptimistic: false, timestamp: 'Failed to send' } : m));
    }
  };

  const handleSendMedia = async (file: File, requestedHD?: boolean, replyToParam?: any) => {
    if (!db || !profile || !user || !chat.id) return;

    const useHD = requestedHD ?? isHDActive;
    const optimisticId = `opt_media_${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      let type: 'image' | 'video' | 'voice' | 'media' | 'file' = 'media';
      const isLiveVoiceMemo = file.name.startsWith('voice_');

      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) {
        type = isLiveVoiceMemo ? 'voice' : 'media';
      } else {
        type = 'file';
      }

      // Optimistic media preview
      const localUrl = URL.createObjectURL(file);
      let thumbnail = '';
      if (type === 'image' || type === 'video') {
        thumbnail = await mediaService.generateThumbnail(file);
      }

      const optimisticMsg: any = {
        id: optimisticId,
        text: type === 'file' ? file.name : (useHD ? 'Sending Ultra HD Connections...' : `Sending ${type}...`),
        senderId: profile.id,
        type: type === 'voice' ? 'voice' : (type === 'file' ? 'file' : 'media'),
        mediaUrl: localUrl,
        thumbnail: thumbnail,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        timestamp: 'Syncing...',
        timestampMs: Date.now(),
        isOptimistic: true,
        mediaType: type,
        isHD: useHD,
        progress: 0,
        uploadStatus: 'PREPARING',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          isAudioMusic: file.type.startsWith('audio/') && !isLiveVoiceMemo
        }
      };

      messageOutboxService.enqueue(chat.id, {
        id: optimisticId,
        text: type === 'file' ? file.name : `Sent a ${type}`,
        type,
        mediaUrl: localUrl,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        }
      });

      setOptimistic(prev => [...prev, optimisticMsg]);
      setUploadProgress({ progress: 0, status: 'PREPARING' });

      const mediaUrl = await uploadMedia(file, `chats/${chat.id}`, (progress, status) => {
        setUploadProgress({ progress, status });
        setOptimistic(prev => prev.map(m => 
          m.id === optimisticId ? { ...m, progress, uploadStatus: status } : m
        ));
      }, useHD ? MediaQuality.HD : mediaSettings.quality);
      
      const otherProfileId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile.id);
      let otherUid = chat.otherParticipantUid || chat.participants?.find((uid: string) => uid !== user.uid);
      if (!otherUid && otherProfileId && otherProfileId.startsWith('profile_')) {
        const parts = otherProfileId.split('_');
        if (parts.length >= 2) {
          otherUid = parts[1];
        }
      }

      const newId = await sendMessage(chat.id, type === 'file' ? file.name : `Sent a ${type}`, type === 'voice' ? 'voice' : (type === 'file' ? 'file' : 'media'), mediaUrl, { 
        mediaType: type,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isAudioMusic: file.type.startsWith('audio/') && !isLiveVoiceMemo,
        optimisticId: optimisticId,
        recipientId: otherProfileId,
        senderUid: user.uid,
        receiverUid: otherUid,
        senderName: profile.displayName || profile.username,
        senderPhoto: profile.photoURL,
        thumbnail,
        isHD: useHD,
        replyTo: replyToParam || (replyingTo ? {
          id: replyingTo.id,
          text: replyingTo.text,
          senderId: replyingTo.senderId || null,
          senderName: replyingTo.senderId === profile?.id ? "You" : (replyingTo.metadata?.senderName || otherProfile?.displayName || chat.name || "User")
        } : null)
      });
      
      messageOutboxService.markDelivered(chat.id, optimisticId);
      setUploadProgress(null);
      URL.revokeObjectURL(localUrl);
      setOptimistic(prev => prev.filter(m => m.id !== optimisticId));

      if (chat.isTemporary && newId) {
        onChatUpdate({
          ...chat,
          id: newId,
          isTemporary: false
        });
      }
    } catch (e: any) {
      logger.error("Media send failed", e);
      messageOutboxService.markFailed(chat.id, optimisticId, e?.message);
      setUploadProgress(null);
      setFailedMessages(prev => new Set(prev).add(optimisticId));
      setOptimistic(prev => prev.map(m => m.id === optimisticId ? { ...m, isFailed: true, isOptimistic: false, timestamp: 'Failed to send' } : m));
    }
  };

  const handleSendSpecialMessage = async (params: {
    type: 'location' | 'contact' | 'sticker' | 'file';
    text?: string;
    mediaUrl?: string;
    metadata?: any;
    replyingTo?: any;
  }) => {
    if (!db || !profile || !user || !chat.id) return;
    const { type, text = '', mediaUrl, metadata = {}, replyingTo: replyParam } = params;
    const optimisticId = `opt_${type}_${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      text: text || `Sent a ${type}`,
      senderId: profile.id,
      type,
      mediaUrl,
      timestamp: 'Sending...',
      timestampMs: Date.now(),
      isOptimistic: true,
      metadata: { ...metadata }
    };

    messageOutboxService.enqueue(chat.id, {
      id: optimisticId,
      text: text || `Sent a ${type}`,
      type,
      mediaUrl,
      metadata
    });

    setOptimistic(prev => [...prev, optimisticMsg]);
    onMessageSent?.(chat.id, text || `Sent a ${type}`, chat);
    requestAnimationFrame(() => scrollToBottom('auto'));

    try {
      const isNew = chat.id.startsWith('new_');
      const targetProfileId = isNew ? chat.id.replace('new_', '') : null;
      let otherUid = chat.otherParticipantUid || chat.participants?.find((uid: string) => uid !== user.uid);
      if (!otherUid && targetProfileId && targetProfileId.startsWith('profile_')) {
        const parts = targetProfileId.split('_');
        if (parts.length >= 2) otherUid = parts[1];
      }
      const otherProfileId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile.id);

      const newId = await sendMessage(chat.id, text || `Sent a ${type}`, type, mediaUrl, {
        ...metadata,
        recipientId: targetProfileId || otherProfileId,
        senderUid: user.uid,
        receiverUid: otherUid,
        senderName: profile.displayName || profile.username,
        senderPhoto: profile.photoURL,
        optimisticId,
        replyTo: replyParam || (replyingTo ? {
          id: replyingTo.id,
          text: replyingTo.text,
          senderId: replyingTo.senderId || null,
          senderName: replyingTo.senderId === profile?.id ? "You" : (replyingTo.metadata?.senderName || otherProfile?.displayName || chat.name || "User")
        } : null)
      });

      setReplyingTo(null);
      messageOutboxService.markDelivered(chat.id, optimisticId);
      setFailedMessages(prev => {
        const next = new Set(prev);
        next.delete(optimisticId);
        return next;
      });

      if (chat.isTemporary && newId) {
        onChatUpdate({
          ...chat,
          id: newId,
          isTemporary: false
        });
      }
    } catch (e: any) {
      logger.error(`Special message (${type}) send failed`, e);
      messageOutboxService.markFailed(chat.id, optimisticId, e?.message);
      setFailedMessages(prev => new Set(prev).add(optimisticId));
      setOptimistic(prev => prev.map(m => m.id === optimisticId ? { ...m, isFailed: true, isOptimistic: false, timestamp: 'Failed to send' } : m));
    }
  };

  const handleTyping = (typing: boolean) => {
    if (chat.id && !chat.id.startsWith('new_')) {
      setTypingStatus(chat.id, typing);
    }
  };

  const currentChatTheme = useMemo(() => {
    return profile?.themeSettings?.perChatWallpapers?.[chat.id] || chat.themeSettings;
  }, [profile?.themeSettings?.perChatWallpapers, chat.id, chat.themeSettings]);

  return (
    <div className={`flex-1 flex flex-col min-w-0 w-full max-w-[1400px] mx-auto h-full min-h-0 overflow-hidden relative z-10 ${isVaultMode ? 'bg-[#030107]/98' : 'bg-transparent'}`}>
      {/* Direct Scoped Chat Wallpaper Layer */}
      <ChatWallpaperLayer 
        chatThemeSettings={currentChatTheme}
        globalThemeSettings={profile?.themeSettings?.chatWallpaper || (settings?.globalBgValue ? { wallpaperURL: settings.globalBgValue } : undefined)}
      />

      {/* Centered Column for Desktop */}
      <div className="flex-1 flex flex-col w-full h-full min-h-0 relative min-w-0 overflow-hidden z-10">
        {/* Header */}
        <header className="flex-shrink-0 w-full px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] md:pt-3 pb-2 md:pb-3 md:px-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-white/75 dark:bg-aeirmist-bg/85 backdrop-blur-2xl messenger-header-glass z-[40] relative min-h-0 min-h-[calc(4rem+env(safe-area-inset-top,0px))] md:h-[64px]">
        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
          <button onClick={onBack} className="md:hidden p-1 -ml-1 text-white/60 hover:text-white transition-colors shrink-0">
            <ChevronLeft size={22} />
          </button>
          <div className={`relative group flex-shrink-0 ${!isPrivateSpace && !isOtherUnavailable ? 'cursor-pointer' : ''}`} onClick={!isPrivateSpace && !isOtherUnavailable ? (chat?.isGroup ? toggleInfo : handleVisitProfile) : undefined}>
            <Avatar
              src={isPrivateSpace ? profile?.photoURL : (chat?.isGroup ? chat.photo : (isOtherUnavailable ? BLANK_DP : (otherProfile?.photoURL || chat.photo)))}
              alt={isPrivateSpace ? "My Space" : (chat?.isGroup ? chat.name : (isOtherUnavailable ? "Aeirmist User" : (otherProfile?.displayName || chat.name)))}
              sizeClassName="w-10 h-10 md:w-12 md:h-12"
              roundedClassName="rounded-[14px] md:rounded-2xl"
              innerRoundedClassName="rounded-[12px] md:rounded-[14px]"
              showStoryRing={!isPrivateSpace && !chat?.isGroup && !isOtherUnavailable}
              userId={!isPrivateSpace && !chat?.isGroup && !isOtherUnavailable ? chat.otherParticipantId : undefined}
              className="group-hover:border-aeirmist-cyan transition-colors"
            />
            {!isPrivateSpace && !chat?.isGroup && !isOtherUnavailable && !!onlineUsers?.has?.(chat.otherParticipantId || '') && showTheirPresence && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-aeirmist-lime rounded-full border-2 border-aeirmist-bg z-10" />
            )}
          </div>
          <div className={`group min-w-0 flex-1 ${!isPrivateSpace && !isOtherUnavailable ? 'cursor-pointer' : ''}`} onClick={!isPrivateSpace && !isOtherUnavailable ? (chat?.isGroup ? toggleInfo : handleVisitProfile) : undefined}>
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className={`font-semibold text-base md:text-lg tracking-tight group-hover:text-aeirmist-cyan transition-colors truncate ${isVaultMode ? 'text-[#e2afff]' : ''}`}>
                {isMySpace ? 'My Space' : (isSelfChat ? 'Note to self' : (chat?.isGroup ? chat.name : (isOtherUnavailable ? 'Aeirmist User' : <LiveParticipantName participantId={chat.otherParticipantId || ''} fallbackName={chat.name || ''} chatId={chat.id} />)))}
              </h3>
              {isPrivateSpace && <Lock size={12} className="text-white/40 shrink-0" />}
              {isVaultMode && (
                <span className="shrink-0 flex items-center justify-center bg-[#7b2cbf]/20 text-[#c77dff] border border-[#7b2cbf]/20 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full select-none">
                  Chat Hidden
                </span>
              )}
            </div>
            {isPrivateSpace && (
              <p className="text-[9px] text-white/40 leading-none mt-0.5 truncate">{isMySpace ? '🔒 Private Workspace' : 'Private Workspace'}</p>
            )}
            {isOtherUnavailable && (
              <p className="text-[10px] text-white/40 leading-none mt-0.5 truncate font-medium">Unavailable on Aeirmist</p>
            )}
            {!isPrivateSpace && !isOtherUnavailable && showTheirPresence && (
              remoteTyping ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[8px] uppercase tracking-widest font-black italic ${isVaultMode ? 'text-[#c77dff]' : 'text-aeirmist-cyan'}`}>Typing...</span>
                </div>
              ) : (() => {
                const otherId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile?.id) || otherProfile?.id;
                const isOtherOnline = (otherProfile?.status === 'online' || !!onlineUsers?.has(otherId || '')) && otherProfile?.messagingSettings?.onlineStatus !== false;
                const showStatus = otherProfile?.messagingSettings?.onlineStatus !== false && profile?.messagingSettings?.onlineStatus !== false;
                return (
                  <div className="flex items-center gap-1 mt-0.5 min-w-0">
                    <p className={`text-[8px] uppercase tracking-widest font-bold ${isOtherOnline && showStatus ? 'text-aeirmist-lime flex items-center gap-1' : 'text-white/40'} truncate`}>
                      {isOtherOnline && showStatus && <span className="w-1.5 h-1.5 rounded-full bg-aeirmist-lime animate-pulse inline-block" />}
                      {formatActiveStatus(
                        isOtherOnline && showStatus, 
                        otherProfile?.lastSeen || otherProfile?.updatedAt, 
                        !showStatus
                      )}
                    </p>
                  </div>
                );
              })()
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-4 shrink-0">
          {!isPrivateSpace && !isOtherUnavailable && (
            <>
              <button 
                onClick={() => handleCallClick('audio')}
                className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:text-aeirmist-cyan transition-all"
              >
                <Phone size={16} />
              </button>
              <button 
                onClick={() => handleCallClick('video')}
                className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:text-aeirmist-cyan transition-all"
              >
                <Video size={16} />
              </button>
            </>
          )}
          <button 
            onClick={toggleInfo}
            className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:text-aeirmist-cyan transition-all"
          >
            <Info size={16} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {callType && isOutgoingCallLocally ? (
          <CallModal 
            key="outgoing-call-session"
            chat={chat} 
            type={callType} 
            isIncoming={false}
            onClose={() => {
              if (activeCall) endCall(activeCall.id, activeCall.conversationId);
              setCallType(null);
              setIsOutgoingCallLocally(false);
            }} 
          />
        ) : null}
      </AnimatePresence>


      {/* Messages */}
      <div 
        ref={scrollRef} 
        className="flex-1 w-full max-w-full overflow-y-auto min-h-0 pt-6 space-y-1 overflow-x-hidden min-w-0 chat-messages-container"
      >
        <AnimatePresence>
          {chat.isVanishMode && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-6 mb-8 p-4 bg-white/5 border border-dashed border-white/10 rounded-2xl text-center"
            >
              <div className="flex items-center justify-center gap-2 text-aeirmist-cyan animate-pulse mb-1">
                <EyeOff size={14} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Vanishing Mode Active</span>
              </div>
              <p className="text-[8px] text-white/20 uppercase font-medium leading-relaxed">
                Traces of shared activity will dissolve after they are viewed by the other user.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 mx-auto flex items-center justify-center mb-4 relative overflow-hidden">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border border-dashed border-white/10 rounded-full"
            />
            <Shield size={24} className="text-white/20 relative z-10" />
          </div>
          <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-bold">Signal Encrypted via Aeirmist Core</p>
          <p className="text-[8px] text-white/10 mt-2 px-12">Messages are cryptographically signed and stored in your local identity vault.</p>
        </div>

        {isOtherUnavailable && (
          <div className="mx-auto my-6 max-w-sm px-6 py-5 bg-white/[0.03] border border-white/10 rounded-2xl text-center backdrop-blur-xl shadow-lg animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-white/5 mx-auto flex items-center justify-center mb-2.5 text-white/40">
              <UserX size={20} />
            </div>
            <h4 className="text-sm font-semibold text-white/90">This person is unavailable on Aeirmist</h4>
            <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
              This account has been deleted or is unavailable. You can still review your existing message history.
            </p>
          </div>
        )}

        {loading && groupedDisplayItems.length === 0 && (
          <div className="flex flex-col gap-3 px-4 md:px-8 py-6 opacity-40 animate-pulse">
            <div className="w-44 h-10 bg-white/10 rounded-2xl self-start" />
            <div className="w-60 h-12 bg-white/10 rounded-2xl self-end" />
            <div className="w-36 h-10 bg-white/10 rounded-2xl self-start" />
            <div className="w-52 h-10 bg-white/10 rounded-2xl self-end" />
          </div>
        )}

      <div className="flex flex-col gap-1.5 px-4 md:px-6 lg:px-8 w-full min-w-0 overflow-x-hidden">
          {groupedDisplayItems.filter(({ msg }) => {
            if (!messageFilter) return true;
            return msg.text?.toLowerCase().includes(messageFilter.toLowerCase());
          }).map(({ msg, albumItems }, idx, self) => {
            const showDate = idx === 0 || formatDateSeparator(self[idx-1].msg.timestampMs) !== formatDateSeparator(msg.timestampMs);
            return (
              <div key={msg.id || `msg-${idx}-${msg.timestampMs}`} className="contents">
                {showDate && (
                  <div className="flex items-center gap-4 my-8 sticky top-2 z-10 px-4 md:px-8">
                    <div className="flex-1 h-px bg-white/5" />
                    <div className="bg-[#1A1B22]/80 backdrop-blur-xl border border-white/10 px-6 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] text-white/50 shadow-xl pointer-events-auto">
                      {formatDateSeparator(msg.timestampMs)}
                    </div>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}
                <MessageItem 
                  message={msg} 
                  albumItems={albumItems}
                  isMe={msg.senderId === profile?.id} 
                  theme={chat.theme}
                  bubbleGradient={currentChatTheme?.bubbleGradient}
                  senderPhoto={msg.senderId === profile?.id ? (localAvatarURL || profile?.photoURL) : (otherProfile?.photoURL || chat.photo)}
                  onRetry={() => handleRetry(msg)} 
                  conversationId={chat.id}
                  onImageClick={(url, imgIdx, allUrls) => {
                    setExpandedImage(url);
                    setExpandedAlbumImages(allUrls);
                    setExpandedImageIndex(imgIdx ?? 0);
                  }}
                  onUserClick={onUserClick}
                  onReply={handleReply}
                  onForward={onForwardMessage}
                  onEdit={setEditingMessage}
                  isPinned={(chat as any).pinnedMessage?.id === msg.id}
                  onPin={(message) => togglePinMessage(chat.id, message.id, message.text || '', (chat as any).pinnedMessage?.id === message.id)}
                  otherUserRestricted={isRestricted(chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile?.id) || '')}
                  seenAt={(() => {
                    const isSelf = chat.otherParticipantId === profile?.id;
                    if (isSelf) return null;
                    const otherId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile?.id);
                    if (!otherId || !chat.lastRead) return null;
                    return chat.lastRead[otherId];
                  })()}
                  otherParticipantName={otherProfile?.displayName || otherProfile?.username || chat.name}
                  isFirstInSequence={idx === 0 || self[idx-1].msg.senderId !== msg.senderId}
                  isLastInSequence={idx === self.length - 1 || self[idx+1].msg.senderId !== msg.senderId}
                />
              </div>
            );
          })}
        </div>

        {uploadProgress !== null && (
          <div className="flex flex-col items-end px-4 md:px-8 mb-4">
            <div className="w-48 bg-black/60 border border-white/10 rounded-2xl p-3 shadow-xl backdrop-blur-md">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-[8px] font-black uppercase tracking-widest text-aeirmist-cyan">
                   {uploadProgress.status || 'Uploading'}...
                 </span>
                 <span className="text-[8px] font-black text-white/40">{Math.round(uploadProgress.progress)}%</span>
               </div>
               <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                 <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress.progress}%` }}
                    className="h-full bg-aeirmist-cyan shadow-[0_0_10px_rgba(0,242,255,0.5)]"
                 />
               </div>
            </div>
          </div>
        )}
        
        {remoteTyping && showTheirPresence && (
          <div className="flex items-center gap-2 px-8 py-4">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div 
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,0.5)]"
                />
              ))}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-aeirmist-cyan/40 italic">Incoming Signal...</span>
          </div>
        )}
        
        {/* Anchor for scroll to bottom */}
        <div ref={messagesEndRef} className="h-4 w-full flex-shrink-0" />
      </div>

      {/* Input Area - Docked at Bottom cleanly without artificial void gaps */}
      <footer className="flex-shrink-0 w-full px-2 sm:px-4 md:px-8 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:pb-4 z-30 transition-all duration-150">
        <div className="w-full">
          {(() => {
            const otherId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile?.id);
            const isOtherBlocked = otherId ? isBlocked(otherId) : false;

            // Check for inbound message requests first
            const isIncomingRequest = chat.status === 'request' && chat.lastMessageSenderId !== profile?.id;
            if (isIncomingRequest) {
              return (
                <div className="w-full p-4 md:p-6 bg-white/[0.02] border border-white/5 rounded-2xl md:rounded-[2rem] text-center backdrop-blur-xl">
                  <span className="text-aeirmist-magenta font-black uppercase tracking-[0.2em] text-[10px] block mb-2">Inbound Signal Request</span>
                  <p className="text-white/60 text-xs mb-4">
                    Do you want to authorize connection with @{otherProfile?.username || 'user'}? They won't know you've read their message until you Accept.
                  </p>
                  <div className="flex flex-wrap gap-2.5 justify-center">
                    <button
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'conversations', chat.id), {
                            status: 'active',
                            acceptedAt: serverTimestamp()
                          });
                          onChatUpdate?.({ ...chat, status: 'active' });
                          if (otherId) {
                            try {
                              await toggleFollow(otherId);
                            } catch (err) {
                              logger.warn("Follow back during acceptance failed", err);
                            }
                          }
                          addToast?.({
                            title: 'Connection Established',
                            message: 'Request accepted.',
                            type: 'success'
                          });
                        } catch (e) {
                          logger.error("Accept request failed", e);
                          addToast?.({
                            title: 'Sync Error',
                            message: 'Failed to accept request.',
                            type: 'warning'
                          });
                        }
                      }}
                      className="px-6 py-2 rounded-xl bg-aeirmist-cyan text-black text-[10px] font-black uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'conversations', chat.id));
                          onBack();
                          addToast?.({
                            title: 'Deleted',
                            message: 'Successfully deleted conversation request.',
                            type: 'info'
                          });
                        } catch (e) {
                          logger.error("Delete request failed", e);
                          addToast?.({
                            title: 'Delete Error',
                            message: 'Failed to delete conversation request.',
                            type: 'warning'
                          });
                        }
                      }}
                      className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          if (otherId) {
                            await updateDoc(doc(db, 'profiles', profile.id), {
                              'social.blocked': arrayUnion(otherId)
                            });
                          }
                          await deleteDoc(doc(db, 'conversations', chat.id));
                          onBack();
                          addToast?.({
                            title: 'Connection Severed',
                            message: 'Successfully blocked user and deleted request.',
                            type: 'info'
                          });
                        } catch (e) {
                          logger.error("Block request failed", e);
                          addToast?.({
                            title: 'Block Error',
                            message: 'Failed to block user and delete request.',
                            type: 'warning'
                          });
                        }
                      }}
                      className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-red-400 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Block
                    </button>
                  </div>
                </div>
              );
            }

            if (isOtherUnavailable) {
              return (
                <div className="w-full py-4 px-6 bg-white/[0.02] border border-white/10 rounded-2xl md:rounded-[2rem] text-center backdrop-blur-xl select-none">
                  <span className="text-white/40 text-xs font-medium tracking-wide">
                    This person is unavailable on Aeirmist.
                  </span>
                </div>
              );
            }

            if (isOtherBlocked) {
              return (
                <div className="w-full p-4 md:p-6 bg-red-500/10 border border-red-500/20 rounded-2xl md:rounded-[2rem] text-center backdrop-blur-xl">
                  <span className="text-red-400 font-bold uppercase tracking-[0.2em] text-[10px] block mb-1">Connections Severed</span>
                  <span className="text-white/60 text-xs">You have blocked this Profile. Lift the Block in the details panel to resume activity.</span>
                </div>
              );
            }

            const isOtherPrivate = otherProfile?.isPrivate || otherProfile?.isProfileLocked;
            const amFollowingOther = otherId ? isFollowing(otherId) : false;
            const isFollowRequestPending = otherId ? isFollowPending(otherId) : false;

            const otherParticipantId = chat.otherParticipantId || chat.profileIds?.find((id: string) => id !== profile?.id);

            if (otherParticipantId && isBlocked(otherParticipantId)) {
              return (
                <div className="w-full p-4 md:p-6 bg-white/[0.02] border border-white/5 rounded-2xl md:rounded-[2rem] text-center backdrop-blur-xl">
                  <span className="text-white/40 font-bold uppercase tracking-[0.2em] text-[10px] block mb-1">Transmission Suspended</span>
                  <span className="text-white/60 text-xs">
                    You have blocked this user. Unblock this user to resume conversation.
                  </span>
                </div>
              );
            }

            if (isOtherPrivate && !amFollowingOther && chat.status !== 'active') {
              return (
                <div className="w-full p-4 md:p-6 bg-white/[0.02] border border-white/5 rounded-2xl md:rounded-[2rem] text-center backdrop-blur-xl">
                  <span className="text-white/40 font-bold uppercase tracking-[0.2em] text-[10px] block mb-1">Connections Locked</span>
                  <span className="text-white/60 text-xs">
                    {isFollowRequestPending ? "Follow request pending" : "You can't message this user yet."}
                  </span>
                </div>
              );
            }

            return (
              <AeirmistInputSystem 
                chatId={chat.id}
                onSendMessage={handleSendMessage} 
                onSendMedia={handleSendMedia}
                onSendSpecialMessage={handleSendSpecialMessage}
                onTyping={handleTyping}
                onOpenCamera={openCamera}
                onCaptureRef={inputCaptureRef}
                isHDActive={isHDActive}
                onHDToggle={() => setIsHDActive(!isHDActive)}
                replyingTo={replyingTo}
                onCancelReply={() => {
                  setReplyingTo(null);
                  onClearPendingNoteReply?.();
                }}
                editingMessage={editingMessage}
                onCancelEdit={() => setEditingMessage(null)}
                onSaveEdit={(messageId, newText) => editMessage(chat.id, messageId, newText)}
              />
            );
          })()}
        </div>
      </footer>

      </div> {/* End of Centered Column */}
      <AnimatePresence>
        {isWallpaperCustomizerOpen && (
          <ChatWallpaperController
            chatId={chat.id}
            chatThemeSettings={profile?.themeSettings?.perChatWallpapers?.[chat.id] || chat.themeSettings}
            onClose={() => setIsWallpaperCustomizerOpen(false)}
            onSave={(newConfig) => {
              onChatUpdate({
                ...chat,
                themeSettings: newConfig
              });
            }}
          />
        )}
      </AnimatePresence>
      <ImageViewerModal 
        isOpen={!!expandedImage} 
        onClose={() => {
          setExpandedImage(null);
          setExpandedAlbumImages(undefined);
        }} 
        imageUrl={expandedImage || ''} 
        images={expandedAlbumImages}
        initialIndex={expandedImageIndex}
      />
    </div>
  );
};

export default Messenger;

