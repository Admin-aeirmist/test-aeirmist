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
import { api } from '../../services/api/client';



interface NotificationCenterProps {
  onClose: () => void;
  onDashboardClick?: () => void;
  onSettingsClick?: () => void;
  onNavigate?: (tab: 'feed' | 'discover' | 'messenger' | 'profile' | 'settings' | 'videos' | 'dashboard') => void;
  onUserClick?: (user: any) => void;
  onPostClick?: (postId: string) => void;
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

// Module-level in-memory cache for 0ms instant loading
let memoryNotificationCache: any[] = [];
try {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('aeirmist_cached_notifications');
    if (saved) memoryNotificationCache = JSON.parse(saved);
  }
} catch (e) {}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  onClose, 
  onDashboardClick, 
  onSettingsClick,
  onNavigate,
  onUserClick,
  onPostClick
}) => {
  const centerRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<any[]>(() => memoryNotificationCache);
  const [isLoading, setIsLoading] = useState<boolean>(() => memoryNotificationCache.length === 0);
  const { db, user, profile, canWrite, acceptFollowRequest, rejectFollowRequest, toggleFollow, isFollowing, addToast } = useAeirmist();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [mutedUsernames, setMutedUsernames] = useState<string[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'requests' | 'following' | 'comments' | 'follows' | 'system'>('all');
  const [showAllRequests, setShowAllRequests] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    try {
      const saved = localStorage.getItem(`aeirmist_muted_users_${profile.id}`);
      if (saved) setMutedUsernames(JSON.parse(saved));
    } catch (err) {
      logger.warn("Mute sync unavailable", err);
    }
  }, [profile?.id]);

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
        const fromId = notif.fromUserId || notif.fromUserUid || notif.metadata?.senderId || notif.metadata?.fromUserId || notif.user?.id;
        const requestId = notif.metadata?.requestId || notif.requestId || notif.id;
        if (fromId) {
          if (acceptFollowRequest) {
            await acceptFollowRequest(requestId, fromId);
          }
          await markRead(notifId);
          setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, type: 'follow_accept', read: true, isRead: true } : n));
          const notifUser = (notif.user?.username && notif.user.username !== 'user' && notif.user.username !== 'null') ? notif.user.username : (notif.user?.name || notif.user?.displayName || 'member');
          addToast?.({
            title: "Request Confirmed",
            message: `You accepted the follow request from @${notifUser}.`,
            type: "success"
          });
        }
      } else if (action === 'reject_follow') {
        const requestId = notif.metadata?.requestId || notif.requestId || notif.id;
        if (rejectFollowRequest) {
          await rejectFollowRequest(requestId);
        }
        await markRead(notifId);
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, type: 'follow_rejected', read: true, isRead: true } : n));
        const notifUser = (notif.user?.username && notif.user.username !== 'user' && notif.user.username !== 'null') ? notif.user.username : (notif.user?.name || notif.user?.displayName || 'member');
        addToast?.({
          title: "Request Removed",
          message: `You declined the follow request from @${notifUser}.`,
          type: "info"
        });
      } else if (action === 'accept_message') {
        await markRead(notifId);
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true, isRead: true } : n));
        if (onNavigate) {
          onNavigate('messenger');
          onClose();
        }
      } else if (action === 'reject_message') {
        await markRead(notifId);
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true, isRead: true } : n));
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

  // Real-time Postgres API sync listener with Meta-style ban/deletion filter
  useEffect(() => {
    let isCancelled = false;
    
    const fetchNotifications = async () => {
      try {
        const res = await api.notifications.get(60).catch(() => ({ notifications: [], unreadCount: 0 }));
        if (isCancelled) return;
        const rawList = res?.notifications || [];

        const mapped = rawList
          .map((d: any) => {
            const type = String(d.type || '').toLowerCase();
            const isMessage = ['message', 'message_media', 'message_voice', 'message_video', 'store_message'].includes(type) || type.includes('msg') || type === 'store_message_received' || type.includes('call');
            if (isMessage) return null;

            const isSecurityAlert = type.includes('security') || type.includes('device') || type.includes('login');
            const isSystem = ['verification', 'system', 'system_verification', 'security'].some(t => type.includes(t)) ||
                             d.fromUserId === 'aeirmist_system' ||
                             d.user?.username === 'aeirmist' ||
                             d.user?.username === 'security' ||
                             isSecurityAlert;

            return {
              id: d.id,
              ...d,
              isRead: Boolean(d.read || d.isRead),
              timestampMs: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
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
                name: d.user?.name || d.user?.displayName || d.fromUser?.displayName || d.metadata?.senderName || 'Aeirmist User',
                avatar: d.user?.avatar || d.user?.avatarKey || d.fromUser?.photoURL || d.metadata?.senderPhoto || null,
                username: d.user?.username || (d.fromUser?.displayName ? d.fromUser.displayName.toLowerCase().replace(/\s+/g, '') : (d.metadata?.senderUsername || 'user')),
                isVerified: Boolean(d.user?.isVerified || d.user?.verified || d.fromUser?.isVerified)
              }
            };
          })
          .filter(Boolean) as any[];

        mapped.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));

        if (!isCancelled) {
          setNotifications(mapped);
          setIsLoading(false);
          memoryNotificationCache = mapped.slice(0, 50);
          try {
            localStorage.setItem('aeirmist_cached_notifications', JSON.stringify(memoryNotificationCache));
          } catch (e) {}
        }
      } catch (err) {
        logger.warn('[NotificationCenter] Sync error:', err);
        if (!isCancelled) setIsLoading(false);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [user?.uid, profile?.id]);

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
    const isUnread = !n.read && !n.isRead;
    return (t === 'follow_request' || t === 'message_request' || t === 'follow_pending') && isUnread;
  });

  const groupNotificationsByDate = (list: any[]) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfThisWeek = startOfToday - 6 * 86400000;
    const startOfThisMonth = startOfToday - 29 * 86400000;

    const groups: { key: string; title: string; items: any[] }[] = [
      { key: 'today', title: 'Today', items: [] },
      { key: 'yesterday', title: 'Yesterday', items: [] },
      { key: 'this_week', title: 'This week', items: [] },
      { key: 'this_month', title: 'This month', items: [] },
      { key: 'earlier', title: 'Earlier', items: [] },
    ];

    list.forEach(item => {
      const t = item.timestampMs || (item.createdAt?.toMillis ? item.createdAt.toMillis() : (item.createdAt ? new Date(item.createdAt).getTime() : Date.now()));
      if (t >= startOfToday) {
        groups[0].items.push(item);
      } else if (t >= startOfYesterday) {
        groups[1].items.push(item);
      } else if (t >= startOfThisWeek) {
        groups[2].items.push(item);
      } else if (t >= startOfThisMonth) {
        groups[3].items.push(item);
      } else {
        groups[4].items.push(item);
      }
    });

    return groups.filter(g => g.items.length > 0);
  };

  const getFilteredNotifications = () => {
    if (filterTab === 'requests') {
      return pendingRequests;
    }

    return serialNotifications.filter(n => {
      const t = String(n.type || '').toLowerCase();
      const isSys = ['verification', 'system', 'system_verification', 'security', 'restriction', 'warning', 'policy', 'plus', 'benefit'].some(k => t.includes(k)) ||
                    n.fromUserId === 'aeirmist_system' ||
                    n.user?.username === 'aeirmist' ||
                    n.user?.username === 'security';

      if (filterTab === 'following') {
        const uid = n.fromUserId || n.user?.id || n.user?.uid;
        return uid && isFollowing ? isFollowing(uid) : false;
      }
      if (filterTab === 'comments') {
        return t.includes('comment');
      }
      if (filterTab === 'follows') {
        return t.includes('follow');
      }
      if (filterTab === 'system') {
        return isSys;
      }
      return true;
    });
  };

  const filteredNotifications = getFilteredNotifications();
  const groupedSections = groupNotificationsByDate(filteredNotifications);

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true, isRead: true })));
    try {
      await api.notifications.markAllRead();
    } catch (err) {
      logger.warn('[NotificationCenter] API markAllRead fallback:', err);
    }
  };

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, isRead: true } : n));
    try {
      await api.notifications.markRead(id);
    } catch (err) {
      logger.warn('[NotificationCenter] API markRead fallback:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMuteUser = async (username: string) => {
    if (!profile?.id) return;
    const list = [...mutedUsernames, username];
    setMutedUsernames(list);
    try {
      localStorage.setItem(`aeirmist_muted_users_${profile.id}`, JSON.stringify(list));
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
    const targetPostId = notif.metadata?.postId || notif.postId;
    if (targetPostId && onPostClick) {
      onPostClick(targetPostId);
      onClose();
      return;
    }
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
        <header className="px-4 py-3.5 pt-[calc(0.875rem+var(--sat,var(--safe-area-inset-top,0px)))] md:pt-3.5 border-b border-white/[0.08] bg-[#18191C]/90 backdrop-blur-xl relative z-10">
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

        {/* Instagram-style Filter Pills (Horizontal Scroll) */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 overflow-x-auto no-scrollbar border-b border-white/[0.06] bg-[#141518]/95 shrink-0">
          {[
            { id: 'all', label: 'All' },
            ...(pendingRequests.length > 0 ? [{ id: 'requests', label: `Requests (${pendingRequests.length})` }] : []),
            { id: 'following', label: 'People you follow' },
            { id: 'comments', label: 'Comments' },
            { id: 'follows', label: 'Follows' },
            { id: 'system', label: 'System' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer ${
                filterTab === tab.id
                  ? 'bg-white text-black shadow-sm font-bold scale-[1.02]'
                  : 'bg-[#242526] hover:bg-[#323436] text-[#E4E6EB] hover:text-white border border-white/[0.04] font-semibold'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-2 sm:p-3 pb-[calc(2rem+var(--sab,var(--safe-area-inset-bottom,0px)))] md:pb-6 space-y-3 bg-[#121316]">
          {/* Top Instagram-Style Pending Requests Block (Visible if private account or pending requests exist) */}
          {(isPrivateAccount || pendingRequests.length > 0) && filterTab !== 'requests' && (
            <div className="rounded-xl bg-[#18191C] border border-white/[0.08] p-3 shadow-md mb-2">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#1877F2]/20 border border-[#1877F2]/30 flex items-center justify-center text-[#1877F2]">
                    <UserPlus size={14} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white tracking-tight">Follow Requests</span>
                    <span className="text-xs text-[#8A8D91] ml-2">
                      {pendingRequests.length} pending
                    </span>
                  </div>
                </div>
                {pendingRequests.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRequests(prev => !prev)}
                    className="text-xs font-semibold text-[#4599FF] hover:underline"
                  >
                    {showAllRequests ? 'Show less' : `See all (${pendingRequests.length})`}
                  </button>
                )}
              </div>

              {pendingRequests.length > 0 ? (
                <div className="space-y-2">
                  {(showAllRequests ? pendingRequests : pendingRequests.slice(0, 2)).map(req => {
                    const reqUser = req.user?.name || req.fromUser?.displayName || req.metadata?.senderName || 'Aeirmist User';
                    const reqUsername = req.user?.username || (req.fromUser?.displayName ? req.fromUser.displayName.toLowerCase().replace(/\s+/g, '') : (req.metadata?.senderUsername || 'user'));
                    const reqAvatar = req.user?.avatar || req.fromUser?.photoURL || req.metadata?.senderPhoto || null;
                    const isMsgReq = req.type === 'message_request';

                    return (
                      <div 
                        key={req.id} 
                        className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                      >
                        <div 
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                          onClick={() => {
                            if (onUserClick && (req.fromUserId || req.user?.id)) {
                              onUserClick({
                                id: req.fromUserId || req.user?.id,
                                displayName: reqUser,
                                photoURL: reqAvatar,
                                username: reqUsername
                              });
                            }
                          }}
                        >
                          <img 
                            src={reqAvatar || BLANK_DP} 
                            alt={reqUser} 
                            className="w-10 h-10 rounded-xl object-cover bg-black/60 ring-1 ring-white/10 shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).src = BLANK_DP; }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                              <span>{reqUser}</span>
                              {req.user?.isVerified && (
                                <ShieldCheck size={12} className="text-aeirmist-cyan shrink-0" />
                              )}
                            </div>
                            <div className="text-[11px] text-[#8A8D91] truncate">
                              @{reqUsername} • {isMsgReq ? 'message request' : 'requested to follow you'}
                            </div>
                          </div>
                        </div>

                        {/* Inline Confirm and Delete buttons */}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleAction(req.id, isMsgReq ? 'accept_message' : 'accept_follow')}
                            disabled={processingIds.has(req.id)}
                            className="px-3.5 py-1.5 rounded-lg bg-[#0064E0] hover:bg-[#1877F2] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95"
                          >
                            {processingIds.has(req.id) ? '...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(req.id, isMsgReq ? 'reject_message' : 'reject_follow')}
                            disabled={processingIds.has(req.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#8A8D91] py-1 text-center">
                  No pending requests right now.
                </p>
              )}
            </div>
          )}

          {/* Grouped Chronological Sections */}
          {isLoading && notifications.length === 0 ? (
            <div className="space-y-2 p-1 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-white/10 rounded-md w-3/4" />
                    <div className="h-2.5 bg-white/5 rounded-md w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filterTab === 'requests' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-[#18191C] border border-white/[0.08] mb-2">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className="flex items-center gap-2 text-xs font-semibold text-[#4599FF] hover:text-[#70B4FF] transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} />
                  <span>Back to all activity</span>
                </button>
                <span className="text-xs text-zinc-400 font-medium">
                  {pendingRequests.length} pending
                </span>
              </div>
              {pendingRequests.length > 0 ? (
                pendingRequests.map(notif => (
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
                    onPostClick={(pId) => {
                      onPostClick?.(pId);
                      onClose();
                    }}
                    isFollowingUser={isFollowing ? isFollowing(notif.fromUserId || notif.user?.id) : false}
                    onFollowToggle={handleFollowToggle}
                  />
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center py-12 px-6">
                  <div className="w-14 h-14 rounded-xl bg-[#1E1F24] border border-white/10 flex items-center justify-center mb-3 text-cyan-400">
                    <CheckCircle2 size={26} />
                  </div>
                  <p className="text-base font-bold text-white mb-1">No pending requests</p>
                  <p className="text-xs text-[#8A8D91] max-w-xs leading-relaxed mb-4">
                    When people request to follow your private account, they will appear here.
                  </p>
                </div>
              )}
            </div>
          ) : groupedSections.length > 0 ? (
            groupedSections.map((group) => (
              <div key={group.key} className="space-y-1.5 pt-2 first:pt-0">
                <h3 className="text-sm font-bold text-white px-2 py-1 tracking-tight select-none">
                  {group.title}
                </h3>
                <div className="space-y-1.5">
                  {group.items.map((notif) => (
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
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-24 px-6">
              <div className="w-16 h-16 rounded-full bg-[#1E1F24] border border-white/10 flex items-center justify-center mb-4 text-[#1877F2]">
                <Bell size={28} />
              </div>
              <p className="text-base font-bold text-white mb-1">No notifications</p>
              <p className="text-xs text-[#8A8D91] max-w-xs leading-relaxed">
                When you receive likes, comments, or follow requests, they will appear here.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default NotificationCenter;
