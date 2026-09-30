import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Settings, 
  Search, 
  Sparkles, 
  X, 
  CheckCircle2,
  CheckCheck,
  Brain,
  Mail,
  ShoppingBag,
  Video,
  Tv,
  UserPlus,
  Trash2,
  VolumeX,
  Play,
  RotateCcw,
  Check,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import type { Notification } from '../../types/notifications';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { logger } from '@/src/utils/logger';
import { requestAllCorePermissions } from '../../utils/nativeSettings';

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  getDoc,
  updateDoc, 
  doc, 
  writeBatch, 
  limit, 
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  setDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

interface NotificationCenterProps {
  onClose: () => void;
  onDashboardClick?: () => void;
  onSettingsClick?: () => void;
  onNavigate?: (tab: 'feed' | 'discover' | 'messenger' | 'profile' | 'settings' | 'videos' | 'dashboard') => void;
  onUserClick?: (user: any) => void;
}

// Map database notification types into correct visual categories
const getCategoryForType = (type: string): 'social' | 'messages' | 'marketplace' | 'videos' | 'stories' | 'system' => {
  const typeStr = String(type).toLowerCase();
  
  if ([
    'message', 'message_media', 'message_voice', 'message_video', 
    'call', 'call_missed', 'video_call_missed', 'store_message', 'message_received'
  ].includes(typeStr) || typeStr.includes('msg') || typeStr.includes('call')) {
    return 'messages';
  }
  
  if ([
    'store_follow', 'review_new', 'store_review', 'product_like', 'product_save', 
    'product_report', 'stock_low', 'product_comment', 'marketplace'
  ].some(x => typeStr.includes(x)) || typeStr.includes('store') || typeStr.includes('product') || typeStr.includes('marketplace')) {
    return 'marketplace';
  }
  
  if ([
    'video_milestone', 'video_comment', 'video_comment_reply', 
    'video_share', 'video_save', 'video_follower'
  ].includes(typeStr) || typeStr.includes('video') || typeStr.includes('milestone')) {
    return 'videos';
  }
  
  if ([
    'story_reply', 'story_react', 'story_mention', 'story_share', 
    'ngl_story_reply', 'ngl_reply', 'story'
  ].some(x => typeStr.includes(x))) {
    return 'stories';
  }
  
  if ([
    'security', 'system', 'verification', 'system_verification', 
    'username_change', 'password_change', 'security_login', 'profile_update', 
    'ngl_message', 'ngl'
  ].some(x => typeStr.includes(x)) || typeStr.includes('security') || typeStr.includes('system') || typeStr.includes('ngl') || typeStr.includes('pass') || typeStr.includes('user')) {
    return 'system';
  }
  
  return 'social';
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  onClose, 
  onDashboardClick, 
  onSettingsClick,
  onNavigate,
  onUserClick
}) => {
  const centerRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const { db, user, profile, canWrite, acceptFollowRequest, rejectFollowRequest, toggleFollow, isFollowing, addToast } = useAeirmist();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [mutedUsernames, setMutedUsernames] = useState<string[]>([]);
  const [showRequestsOnly, setShowRequestsOnly] = useState(false);

  useEffect(() => {
    if (!db || !profile?.id) return;
    const fetchMuted = async () => {
      try {
        const d = await getDoc(doc(db, 'profiles', profile.id, 'settings', 'mutedUsers'));
        if (d.exists()) {
          setMutedUsernames(d.data().mutedUsernames || []);
        }
      } catch (err) {
        logger.warn("Mute sync unavailable", err);
      }
    };
    fetchMuted();
  }, [db, profile?.id]);

  const [hiddenTypes, setHiddenTypes] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('aeirmist_hidden_notification_types') || '[]');
    } catch {
      return [];
    }
  });

  // Calculate total unread count
  const unreadCount = notifications.filter(n => !n.isRead && !n.read).length;

  const handleAction = async (notifId: string, action: string) => {
    const notif = notifications.find(n => n.id === notifId);
    if (!notif) return;

    if (processingIds.has(notifId)) return;

    setProcessingIds(prev => {
      const copy = new Set(prev);
      copy.add(notifId);
      return copy;
    });

    try {
      if (action === 'accept_follow') {
        const requestId = notif.metadata?.requestId;
        const fromId = notif.fromUserId;
        if (requestId && fromId) {
          await acceptFollowRequest(requestId, fromId);
          await markRead(notifId);
          const notifUser = (notif.user?.username && notif.user.username !== 'user' && notif.user.username !== 'null') ? notif.user.username : (notif.user?.name || notif.user?.displayName || 'member');
          addToast?.({
            title: "Request Confirmed",
            message: `You accepted the follow request from @${notifUser}.`,
            type: "success"
          });
        }
      } else if (action === 'reject_follow') {
        const requestId = notif.metadata?.requestId;
        if (requestId) {
          await rejectFollowRequest(requestId);
          await markRead(notifId);
          const notifUser = (notif.user?.username && notif.user.username !== 'user' && notif.user.username !== 'null') ? notif.user.username : (notif.user?.name || notif.user?.displayName || 'member');
          addToast?.({
            title: "Request Removed",
            message: `You declined the follow request from @${notifUser}.`,
            type: "info"
          });
        }
      }
    } catch (e) {
      logger.error("Action execution failed", e);
    } finally {
      setProcessingIds(prev => {
        const copy = new Set(prev);
        copy.delete(notifId);
        return copy;
      });
    }
  };

  const senderStatusCache = useRef<Map<string, { exists: boolean; isBanned: boolean }>>(new Map());

  // Real-time Firestore sync listener with Meta-style ban/deletion filter
  useEffect(() => {
    if (!db || !user) return;
    
    let isCancelled = false;
    let fallbackUnsub: (() => void) | null = null;
    const targetUserIds = Array.from(new Set([profile?.id, user.uid].filter(Boolean)));
    if (targetUserIds.length === 0) return;

    const processDocs = async (docsList: any[]) => {
      // 1. Gather all sender IDs from non-system notifications
      const pendingSenderIds = new Set<string>();

      docsList.forEach(docSnap => {
        const d = docSnap.data();
        const type = String(d.type || '').toLowerCase();
        const isSystem = ['verification', 'system', 'system_verification', 'security'].some(t => type.includes(t)) ||
                         d.fromUserId === 'aeirmist_system' ||
                         d.user?.username === 'aeirmist' ||
                         d.user?.username === 'security';
        if (!isSystem) {
          const senderId = d.fromUserId || d.fromUserUid || d.metadata?.senderId;
          if (senderId && !senderStatusCache.current.has(senderId)) {
            pendingSenderIds.add(senderId);
          }
        }
      });

      // 2. Resolve unknown sender statuses from Firestore
      if (pendingSenderIds.size > 0 && db) {
        await Promise.all(
          Array.from(pendingSenderIds).map(async (sId) => {
            try {
              const pSnap = await getDoc(doc(db, 'profiles', sId));
              if (pSnap.exists()) {
                const pData = pSnap.data();
                const isBanned = Boolean(pData.isBanned || pData.status === 'BANNED' || pData.status === 'DELETED');
                senderStatusCache.current.set(sId, { exists: true, isBanned });
                return;
              }
              const pAltSnap = await getDoc(doc(db, 'profiles', `profile_${sId}`));
              if (pAltSnap.exists()) {
                const pData = pAltSnap.data();
                const isBanned = Boolean(pData.isBanned || pData.status === 'BANNED' || pData.status === 'DELETED');
                senderStatusCache.current.set(sId, { exists: true, isBanned });
                return;
              }
              const uSnap = await getDoc(doc(db, 'users', sId));
              if (uSnap.exists()) {
                const uData = uSnap.data();
                const isBanned = Boolean(uData.isBanned || uData.status === 'BANNED' || uData.status === 'DELETED');
                senderStatusCache.current.set(sId, { exists: true, isBanned });
                return;
              }
              // Hard deleted from database!
              senderStatusCache.current.set(sId, { exists: false, isBanned: true });
            } catch (e) {
              senderStatusCache.current.set(sId, { exists: true, isBanned: false });
            }
          })
        );
      }

      // 3. Map and filter notifications
      const mapped = docsList
        .map(docSnap => {
          const d = docSnap.data();
          const type = String(d.type).toLowerCase();
          const isMessage = ['message', 'message_media', 'message_voice', 'message_video', 'store_message'].includes(type) || type.includes('msg') || type === 'store_message_received' || type.includes('call');
          
          if (isMessage) return null;

          const isSecurityAlert = String(d.type || '').toLowerCase().includes('security') || 
                                  String(d.type || '').toLowerCase().includes('device') ||
                                  String(d.type || '').toLowerCase().includes('login');

          const isSystem = ['verification', 'system', 'system_verification', 'security'].some(t => type.includes(t)) ||
                           d.fromUserId === 'aeirmist_system' ||
                           d.user?.username === 'aeirmist' ||
                           d.user?.username === 'security' ||
                           isSecurityAlert;

          // Check if sender is banned or hard-deleted
          if (!isSystem) {
            const senderId = d.fromUserId || d.fromUserUid || d.metadata?.senderId;
            if (senderId && senderStatusCache.current.has(senderId)) {
              const status = senderStatusCache.current.get(senderId)!;
              if (!status.exists || status.isBanned) {
                deleteDoc(doc(db, 'notifications', docSnap.id)).catch(() => {});
                return null;
              }
            }
            if (d.user?.isBanned || d.metadata?.isBanned || d.fromUser?.isBanned) {
              deleteDoc(doc(db, 'notifications', docSnap.id)).catch(() => {});
              return null;
            }
          }

          return {
            id: docSnap.id,
            ...d,
            isRead: d.read,
            timestampMs: d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt ? new Date(d.createdAt).getTime() : Date.now()),
            user: isSecurityAlert ? {
              name: 'Security Alert',
              avatar: null,
              username: 'security',
              isVerified: true
            } : type.includes('verification') ? {
              name: 'Aeirmist',
              avatar: '/favicon.png',
              username: 'aeirmist',
              isVerified: true
            } : {
              name: d.user?.name || d.fromUser?.displayName || d.metadata?.senderName || 'Aeirmist User',
              avatar: d.user?.avatar || d.fromUser?.photoURL || d.metadata?.senderPhoto || null,
              username: d.user?.username || (d.fromUser?.displayName ? d.fromUser.displayName.toLowerCase().replace(/\s+/g, '') : (d.metadata?.senderUsername || 'user')),
              isVerified: Boolean(d.user?.isVerified || d.user?.verified || d.fromUser?.isVerified)
            }
          };
        })
        .filter(Boolean) as any[];

      // Sort in-memory to guarantee correct descending timeline even if index is not ready
      mapped.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));

      if (!isCancelled) {
        setNotifications(mapped);
      }
    };

    const qPrimary = query(
      collection(db, 'notifications'),
      where('userId', 'in', targetUserIds),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const primaryUnsub = onSnapshot(qPrimary, (snapshot) => {
      processDocs(snapshot.docs);
    }, (error: any) => {
      logger.warn("Notification center primary index query fallback triggered:", error);
      if (!isCancelled) {
        const qFallback = query(
          collection(db, 'notifications'),
          where('userId', 'in', targetUserIds),
          limit(50)
        );
        fallbackUnsub = onSnapshot(qFallback, (fallbackSnap) => {
          processDocs(fallbackSnap.docs);
        }, (fallbackErr) => {
          logger.warn("Notification center fallback sync failed:", fallbackErr);
        });
      }
    });

    return () => {
      isCancelled = true;
      primaryUnsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [db, user?.uid, profile?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const requested = sessionStorage.getItem('aeirmist_batch_permissions_prompted');
    if (!requested) {
      sessionStorage.setItem('aeirmist_batch_permissions_prompted', 'true');
      requestAllCorePermissions(addToast).catch(e => logger.warn("Error in unified permissions request:", e));
    }
  }, [addToast]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (centerRef.current && !centerRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (target.closest('[id="alerts-nav-item"]') || target.closest('button[onClick*="setIsNotificationsOpen"]')) {
          return;
        }
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Serial list: Filter out muted and hidden types, and order serially by time
  const getSerialNotifications = () => {
    return notifications.filter(n => {
      // 1. Muted users check
      const username = n.user?.username || n.user?.name || '';
      if (mutedUsernames.includes(username)) return false;

      // 2. Hidden type rules check
      if (hiddenTypes.includes(n.type)) return false;

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const content = (n.message || n.content || '').toLowerCase();
        const name = username.toLowerCase();
        return content.includes(q) || name.includes(q);
      }

      return true;
    }).sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
  };

  const serialNotifications = getSerialNotifications();

  const isPrivateAccount = Boolean(
    profile?.isPrivate || 
    profile?.privacySettings?.privateProfile || 
    profile?.isProfileLocked || 
    profile?.privacy === 'private'
  );

  const pendingRequests = notifications.filter(n => {
    const t = String(n.type || '').toLowerCase();
    return t === 'follow_request' || t === 'message_request' || t === 'follow_pending';
  });

  const displayNotifications = showRequestsOnly ? pendingRequests : serialNotifications;

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true, isRead: true })));
    if (!db || !user || !canWrite('mark_all_read', 5000)) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        if (!n.read && !n.isRead) {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        }
      });
      await batch.commit();
    } catch (e) {
      logger.error("Mark all read failed:", e);
    }
  };

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, isRead: true } : n));
    if (!db || !canWrite(`mark_read_${id}`, 2000)) return;
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      logger.error("Mark read failed:", e);
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (e) {
      logger.error("Delete notification failed:", e);
    }
  };

  const handleMuteUser = async (username: string) => {
    if (!db || !profile?.id) return;
    const list = [...mutedUsernames, username];
    setMutedUsernames(list);
    try {
      await setDoc(doc(db, 'profiles', profile.id, 'settings', 'mutedUsers'), {
        mutedUsernames: arrayUnion(username)
      }, { merge: true });
    } catch (err) {
      logger.error(err);
    }
  };

  const handleHideType = (type: string) => {
    const list = [...hiddenTypes, type];
    setHiddenTypes(list);
    localStorage.setItem('aeirmist_hidden_notification_types', JSON.stringify(list));
  };

  // Follow back toggle
  const handleFollowToggle = async (targetId: string) => {
    if (toggleFollow) {
      await toggleFollow(targetId);
    }
  };

  // View source click
  const handleViewSource = (notif: any) => {
    if (!onNavigate) return;
    
    const cat = getCategoryForType(notif.type);
    if (cat === 'messages') {
      onNavigate('messenger');
    } else if (cat === 'videos') {
      onNavigate('videos');
    } else if (cat === 'marketplace') {
      onNavigate('discover');
    } else if (cat === 'stories' || cat === 'social') {
      onNavigate('feed');
    } else if (cat === 'system') {
      onNavigate('settings');
    } else {
      onNavigate('feed');
    }
    onClose();
  };

  return (
    <>
      {/* Dark backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div 
        ref={centerRef}
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 240 }}
        className="fixed inset-y-0 right-0 w-full sm:w-[480px] md:w-[460px] z-[1000] bg-[#121316] border-l border-white/[0.08] shadow-[-20px_0_60px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-[#E4E6EB]"
      >
        {/* Header */}
        <header className="px-4 py-3.5 pt-[calc(0.875rem+env(safe-area-inset-top,0px))] md:pt-3.5 border-b border-white/[0.08] bg-[#18191C]/90 backdrop-blur-xl relative z-10">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-white leading-none">Notifications</h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#1877F2] text-white text-xs font-bold shadow-sm">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {unreadCount > 0 && (
                <button 
                  type="button"
                  onClick={markAllRead} 
                  className="px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-xs font-semibold text-[#4599FF] hover:text-[#70B4FF] flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck size={15} />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
              
              <button 
                type="button"
                onClick={onClose} 
                className="w-8 h-8 rounded-full bg-[#2A2B30] hover:bg-[#3A3B40] text-[#E4E6EB] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Close"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        </header>

        {/* Notifications Serial Scroll List (Pure Serial Flow with Top Pending Requests Row) */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-2 sm:p-3 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] md:pb-6 space-y-2 bg-[#121316]">
          {/* Top Instagram-Style Pending Requests Row / Filter View */}
          {showRequestsOnly ? (
            <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-[#18191C] border border-white/[0.08] mb-2 shadow-sm">
              <button
                type="button"
                onClick={() => setShowRequestsOnly(false)}
                className="flex items-center gap-2 text-xs font-semibold text-[#4599FF] hover:text-[#70B4FF] transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Back to all activity</span>
              </button>
              <span className="text-xs text-zinc-400 font-medium">
                {pendingRequests.length} pending
              </span>
            </div>
          ) : (
            (isPrivateAccount || pendingRequests.length > 0) && (
              <div 
                onClick={() => setShowRequestsOnly(true)}
                className="p-3 rounded-xl bg-[#18191C]/90 hover:bg-[#202126] border border-white/[0.08] flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] group shadow-sm mb-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-sm">
                    <UserPlus size={20} />
                    {pendingRequests.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1877F2] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#121316]">
                        {pendingRequests.length > 99 ? '99+' : pendingRequests.length}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">Follow requests</span>
                      {pendingRequests.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-[#1877F2]" />
                      )}
                    </div>
                    <p className="text-xs text-[#8A8D91] truncate">Approve or ignore requests</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[#8A8D91] group-hover:text-white transition-colors shrink-0">
                  {pendingRequests.length > 0 && (
                    <span className="text-xs font-bold text-[#4599FF]">{pendingRequests.length}</span>
                  )}
                  <ChevronRight size={18} />
                </div>
              </div>
            )
          )}

          {displayNotifications.length > 0 ? (
            displayNotifications.map((notif) => (
              <NotificationItem 
                key={notif.id} 
                notification={notif} 
                onMarkRead={() => markRead(notif.id)} 
                onDelete={deleteNotification}
                onHideType={handleHideType}
                onMuteUser={handleMuteUser}
                onViewSource={handleViewSource}
                onAction={handleAction}
                isProcessing={processingIds.has(notif.id)}
                onUserClick={onUserClick}
                isFollowingUser={isFollowing ? isFollowing(notif.fromUserId || notif.user?.id) : false}
                onFollowToggle={handleFollowToggle}
              />
            ))
          ) : showRequestsOnly ? (
            <div className="h-64 flex flex-col items-center justify-center text-center py-12 px-6">
              <div className="w-14 h-14 rounded-xl bg-[#1E1F24] border border-white/10 flex items-center justify-center mb-3 text-cyan-400">
                <CheckCircle2 size={26} />
              </div>
              <p className="text-base font-bold text-white mb-1">No pending requests</p>
              <p className="text-xs text-[#8A8D91] max-w-xs leading-relaxed mb-4">
                When people request to follow your private account, they will appear here.
              </p>
              <button
                type="button"
                onClick={() => setShowRequestsOnly(false)}
                className="px-4 py-2 rounded-lg bg-[#2A2B30] hover:bg-[#3A3B40] text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                View all notifications
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-24 px-6">
              <div className="w-16 h-16 rounded-full bg-[#1E1F24] border border-white/10 flex items-center justify-center mb-4 text-[#1877F2]">
                <Bell size={28} />
              </div>
              <p className="text-base font-bold text-white mb-1">No notifications</p>
              <p className="text-xs text-[#8A8D91] max-w-xs leading-relaxed">
                When you receive likes, comments, or follow requests, they will appear here serially.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default NotificationCenter;
