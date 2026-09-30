import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageSquare, 
  UserPlus, 
  Bell, 
  Mail, 
  Video, 
  Check, 
  X, 
  ShieldCheck, 
  Sparkles,
  Shield,
  MoreHorizontal,
  CheckCheck,
  Trash2,
  BellOff,
  ShoppingBag,
  Tv,
  Info,
  AlertTriangle
} from 'lucide-react';
import { getAvatarUrl as getAvatarUrlHelper, BLANK_DP } from '../../lib/avatar';

interface NotificationItemProps {
  notification: any;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onHideType?: (type: string) => void;
  onMuteUser?: (username: string) => void;
  onViewSource?: (notification: any) => void;
  onAction?: (id: string, action: string) => void;
  isProcessing?: boolean;
  onUserClick?: (user: any) => void;
  isFollowingUser?: boolean;
  onFollowToggle?: (userId: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, 
  onMarkRead,
  onDelete,
  onHideType,
  onMuteUser,
  onViewSource,
  onAction,
  isProcessing,
  onUserClick,
  isFollowingUser,
  onFollowToggle
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // Meta / Instagram style time formatter
  const formatNotificationTime = (timestampMs: number): string => {
    if (!timestampMs) return 'Just now';
    const now = Date.now();
    const diffSec = Math.floor((now - timestampMs) / 1000);
    
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s`;
    
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d`;
    
    const diffWk = Math.floor(diffDay / 7);
    if (diffWk < 4) return `${diffWk}w`;
    
    const diffMo = Math.floor(diffDay / 30);
    return `${diffMo}mo`;
  };

  const rawType = String(notification.type || '').toLowerCase();
  const rawMsg = String(notification.message || notification.content || '').toLowerCase();

  const isRestriction = rawType.includes('restriction') || 
                        rawType.includes('warning') || 
                        rawType.includes('policy') || 
                        rawType.includes('violation') ||
                        rawMsg.includes('restriction') || 
                        rawMsg.includes('restricted to your account') ||
                        rawMsg.includes('we added a restriction');

  const isBenefit = rawType.includes('benefit') || 
                    rawType.includes('plus') || 
                    rawType.includes('subscription') || 
                    rawType.includes('membership') || 
                    rawType.includes('perk') || 
                    rawMsg.includes('plus benefits') || 
                    rawMsg.includes('instagram plus') || 
                    rawMsg.includes('aeirmist plus') ||
                    rawMsg.includes('keep enjoying your');

  const isSecurity = rawType.includes('security') || 
                     rawType.includes('device') || 
                     rawType.includes('login') || 
                     rawType.includes('password') ||
                     rawMsg.includes('sign-in') || 
                     rawMsg.includes('login detected');

  const isVerification = rawType.includes('verification');

  const isSystemAnnouncement = rawType === 'system' || 
                               notification.fromUserId === 'aeirmist_system' || 
                               notification.user?.username === 'aeirmist' ||
                               notification.user?.username === 'system';

  const isSystem = isRestriction || isBenefit || isSecurity || isVerification || isSystemAnnouncement;

  const getUserDisplayName = () => {
    if (isBenefit) return 'Aeirmist Plus';
    if (isRestriction) return 'Account Status';
    if (isSecurity) return 'Security Alert';
    if (isVerification) return 'Aeirmist';
    if (isSystemAnnouncement) return 'Aeirmist System';
    return notification.user?.name || notification.user?.displayName || notification.fromUser?.displayName || 'Aeirmist User';
  };

  const getUserHandle = () => {
    if (isBenefit) return '@plus';
    if (isRestriction) return '@system';
    if (isSecurity) return '@security';
    if (isVerification) return '@aeirmist';
    if (isSystemAnnouncement) return '@aeirmist';
    return notification.user?.username ? `@${notification.user.username}` : `@${getUserDisplayName().toLowerCase().replace(/\s+/g, '')}`;
  };

  const getAvatarUrl = () => {
    if (isSystem) return null;
    return getAvatarUrlHelper(notification.user?.avatar || notification.user?.photoURL || notification.fromUser?.photoURL, notification.user?.name || notification.id);
  };

  const displayTime = formatNotificationTime(
    notification.timestampMs || 
    (notification.createdAt?.toMillis ? notification.createdAt.toMillis() : Date.now())
  );

  // Meta-style sentence configuration and action icons
  const getMetaContent = () => {
    const type = String(notification.type || '').toLowerCase();

    // Account Restriction / Warning (Instagram/Meta style)
    if (isRestriction) {
      let text = notification.message || notification.content || 'We added a restriction to your account. See why.';
      return {
        actionText: text,
        badgeIcon: <span className="font-serif font-bold text-[10px] text-white">i</span>,
        badgeBg: 'bg-zinc-700',
        category: 'system'
      };
    }

    // Plus Benefits / Perks / Membership (Instagram/Meta style)
    if (isBenefit) {
      let text = notification.message || notification.content || 'To keep enjoying your Aeirmist Plus benefits, renew your subscription.';
      text = text
        .replace(/Instagram Plus/gi, 'Aeirmist Plus')
        .replace(/Meta Plus/gi, 'Aeirmist Plus');
      return {
        actionText: text,
        badgeIcon: <Sparkles size={10} className="text-white" />,
        badgeBg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
        category: 'system'
      };
    }

    // Verification Notifications
    if (isVerification) {
      let rawMsgText = notification.message || notification.content || '';
      const plan = notification.metadata?.plan || (rawMsgText.toLowerCase().includes('business') ? 'business' : rawMsgText.toLowerCase().includes('creator') ? 'creator' : 'essential');
      const planTitle = plan ? (plan.charAt(0).toUpperCase() + plan.slice(1)) : 'Business';

      let formattedMsg = rawMsgText
        .replace(/Meta-Style Verified/gi, `Aeirmist ${planTitle} Verified`)
        .replace(/Meta-style Verified/gi, `Aeirmist ${planTitle} Verified`)
        .replace(/Meta Verified/gi, `Aeirmist ${planTitle} Verified`);

      if (!formattedMsg) {
        formattedMsg = `Congratulations! Your account is now Aeirmist ${planTitle} Verified under the ${planTitle} Plan.`;
      }

      return {
        actionText: formattedMsg,
        badgeIcon: <ShieldCheck size={11} className="text-white" />,
        badgeBg: 'bg-aeirmist-cyan',
        category: 'system'
      };
    }

    // Security & Logins
    if (isSecurity) {
      return {
        actionText: notification.message || 'New sign-in detected on your account.',
        badgeIcon: <ShieldCheck size={10} className="text-white" />,
        badgeBg: 'bg-[#00B2FF]',
        category: 'system'
      };
    }

    // General System Announcement
    if (isSystemAnnouncement) {
      return {
        actionText: notification.message || notification.content || 'System update from Aeirmist.',
        badgeIcon: <Bell size={10} className="text-white" />,
        badgeBg: 'bg-aeirmist-cyan',
        category: 'system'
      };
    }

    // Follow Request
    if (type === 'follow_request') {
      return {
        actionText: 'requested to follow you.',
        badgeIcon: <UserPlus size={10} className="text-white" />,
        badgeBg: 'bg-[#F59E0B]',
        category: 'social'
      };
    }

    // Follow Request Accepted
    if (type === 'follow_accept') {
      return {
        actionText: 'accepted your follow request.',
        badgeIcon: <Check size={10} className="text-white" />,
        badgeBg: 'bg-[#00BA7C]',
        category: 'social'
      };
    }

    // Follow / Follow Back
    if (type === 'follow' || type === 'follow_back') {
      return {
        actionText: type === 'follow_back' ? 'followed you back.' : 'started following you.',
        badgeIcon: <UserPlus size={10} className="text-white" />,
        badgeBg: 'bg-[#1877F2]',
        category: 'social'
      };
    }

    // Message Request
    if (type === 'message_request') {
      return {
        actionText: 'sent you a message request.',
        badgeIcon: <Mail size={10} className="text-white" />,
        badgeBg: 'bg-[#00B2FF]',
        category: 'messages'
      };
    }

    // Message
    if (type === 'message' || type.includes('msg')) {
      return {
        actionText: 'sent you a message.',
        snippet: notification.message ? `"${notification.message}"` : null,
        badgeIcon: <Mail size={10} className="text-white" />,
        badgeBg: 'bg-[#00B2FF]',
        category: 'messages'
      };
    }

    // Post / Comment Like
    if (type === 'like' || type === 'post_like' || type === 'comment_like') {
      return {
        actionText: type === 'comment_like' ? 'liked your comment.' : 'liked your post.',
        badgeIcon: <Heart size={10} className="text-white fill-white" />,
        badgeBg: 'bg-[#E41E3F]',
        category: 'social'
      };
    }

    // Comment
    if (type === 'comment' || type === 'comment_reply') {
      return {
        actionText: type === 'comment_reply' ? 'replied to your comment:' : 'commented on your post:',
        snippet: notification.message ? `"${notification.message}"` : null,
        badgeIcon: <MessageSquare size={10} className="text-white fill-white" />,
        badgeBg: 'bg-[#00BA7C]',
        category: 'social'
      };
    }

    // Video / Reel / Share
    if (type === 'share' || type.includes('video') || type.includes('reel')) {
      return {
        actionText: 'shared a video with you.',
        badgeIcon: <Video size={10} className="text-white" />,
        badgeBg: 'bg-[#873CE0]',
        category: 'videos'
      };
    }

    // Story React / Reply
    if (type.includes('story')) {
      return {
        actionText: type.includes('react') ? 'reacted to your story.' : 'replied to your story.',
        badgeIcon: <Tv size={10} className="text-white" />,
        badgeBg: 'bg-[#E41E3F]',
        category: 'stories'
      };
    }

    // Market / Product
    if (type.includes('store') || type.includes('product') || type.includes('market')) {
      return {
        actionText: notification.message || 'interacted with your store.',
        badgeIcon: <ShoppingBag size={10} className="text-white" />,
        badgeBg: 'bg-[#FA7B17]',
        category: 'marketplace'
      };
    }

    // Default Fallback
    return {
      actionText: notification.message || notification.content || 'sent you a notification.',
      badgeIcon: <Bell size={10} className="text-white" />,
      badgeBg: 'bg-[#1877F2]',
      category: 'system'
    };
  };

  const { actionText, snippet, badgeIcon, badgeBg } = getMetaContent();
  const isUnread = !(notification.read || notification.isRead);
  const displayName = getUserDisplayName();
  const targetUserId = notification.fromUserId || notification.user?.id || notification.user?.uid;

  // Handle row click
  const handleCardClick = (e: React.MouseEvent) => {
    onMarkRead?.(notification.id);

    const isProfileType = [
      'follow', 'follow_accept', 'follow_back', 'store_follow', 'video_follower',
      'like', 'comment_like', 'post_like', 'comment', 'comment_reply', 'mention', 'story_mention'
    ].includes(String(notification.type).toLowerCase());

    if (isProfileType && onUserClick && targetUserId) {
      const targetUser = {
        id: targetUserId,
        displayName: notification.user?.name || notification.user?.displayName || 'Aeirmist User',
        photoURL: getAvatarUrl(),
        username: notification.user?.username || 'user'
      };
      onUserClick(targetUser);
    } else {
      onViewSource?.(notification);
    }
  };

  return (
    <motion.div
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      transition={{ duration: 0.15 }}
      className={`relative group rounded-xl p-3 sm:p-3.5 transition-all duration-150 cursor-pointer overflow-hidden ${
        isUnread 
          ? 'bg-[#1877F2]/[0.08] hover:bg-[#1877F2]/[0.12] border border-[#1877F2]/20' 
          : 'bg-[#18191A]/60 hover:bg-[#242526] border border-white/[0.04]'
      }`}
      onClick={handleCardClick}
    >
      <div className="flex items-center gap-3 min-w-0">
        
        {/* Left: Square Avatar with Overlapping Meta Action Badge */}
        <div className="relative shrink-0">
          {isBenefit ? (
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1E1F24] to-[#121316] border border-white/10 ring-1 ring-white/10 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M12 2L3 9L12 22L21 9L12 2Z" />
                <path d="M12 7L13.2 10.2L16.5 10.5L14 12.6L14.8 15.8L12 14.1L9.2 15.8L10 12.6L7.5 10.5L10.8 10.2L12 7Z" fill="currentColor" />
              </svg>
            </div>
          ) : isRestriction ? (
            <div className="w-11 h-11 rounded-xl bg-[#18191C] border border-amber-500/30 ring-1 ring-amber-500/20 flex items-center justify-center shadow-sm">
              <div className="w-6 h-6 rounded-full border-2 border-white/80 flex items-center justify-center font-serif text-xs font-bold text-white shadow-sm">
                i
              </div>
            </div>
          ) : isSecurity ? (
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-950/70 to-blue-950/60 border border-cyan-500/30 ring-1 ring-cyan-500/20 flex items-center justify-center text-cyan-300 shadow-sm">
              <ShieldCheck size={22} />
            </div>
          ) : isVerification || isSystemAnnouncement ? (
            <div className="w-11 h-11 rounded-xl bg-black/90 border border-aeirmist-cyan/40 ring-1 ring-white/10 flex items-center justify-center p-1.5 shadow-sm overflow-hidden">
              <img 
                src="/favicon.png" 
                alt="Aeirmist" 
                className="w-full h-full object-contain" 
              />
            </div>
          ) : (
            <img 
              src={getAvatarUrl() || BLANK_DP} 
              alt={displayName} 
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl object-cover bg-black/60 ring-1 ring-white/10 shadow-sm"
              onError={(e) => { (e.target as HTMLImageElement).src = BLANK_DP; }}
            />
          )}

          {/* Overlapping Meta Action Badge */}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-md ${badgeBg} ring-2 ring-[#18191A] flex items-center justify-center shadow-md`}>
            {badgeIcon}
          </div>
        </div>

        {/* Center: Typography Single-Sentence Flow */}
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-[13px] sm:text-[13.5px] leading-snug text-[#E4E6EB]">
            <strong 
              className="font-bold text-white hover:underline cursor-pointer inline-flex items-center gap-1.5 mr-1"
              onClick={(e) => {
                if (onUserClick && targetUserId && !isSystem) {
                  e.stopPropagation();
                  onUserClick({
                    id: targetUserId,
                    displayName,
                    photoURL: getAvatarUrl(),
                    username: notification.user?.username || 'user'
                  });
                }
              }}
            >
              {displayName}
              {/* Separate Official Badge for System vs Verified Badge for User */}
              {isSystem ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-aeirmist-cyan/15 border border-aeirmist-cyan/30 text-[10px] font-bold text-aeirmist-cyan uppercase tracking-wider shrink-0" title="Aeirmist Official">
                  <ShieldCheck size={11} className="text-aeirmist-cyan shrink-0" />
                  Official
                </span>
              ) : (notification.user?.isVerified || notification.user?.verified || notification.fromUser?.isVerified) ? (
                <span className="inline-flex items-center justify-center shrink-0" title="Verified Account">
                  <svg className="w-3.5 h-3.5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 14.2l-3.5-3.5 1.41-1.41 2.09 2.08 5.69-5.69 1.41 1.41-7.1 7.11z" />
                  </svg>
                </span>
              ) : null}
            </strong>
            <span className="text-[#D8DADF]">{actionText}</span>
            <span className="text-xs text-[#8A8D91] font-normal whitespace-nowrap ml-1.5">
              {displayTime}
            </span>
          </p>

          {/* Optional snippet (e.g. comment text) */}
          {snippet && (
            <p className="text-xs text-[#B0B3B8] line-clamp-1 mt-0.5 font-normal">
              {snippet}
            </p>
          )}

          {/* Follow Request Inline Actions (Confirm / Delete buttons) */}
          {notification.type === 'follow_request' && onAction && (
            <div className="flex items-center gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onAction(notification.id, 'accept_follow')}
                disabled={isProcessing}
                className="px-4 py-1.5 rounded-lg bg-[#0064E0] hover:bg-[#1877F2] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95"
              >
                {isProcessing ? 'Confirming...' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => onAction(notification.id, 'reject_follow')}
                disabled={isProcessing}
                className="px-3.5 py-1.5 rounded-lg bg-[#3A3B3C] hover:bg-[#4E4F50] text-[#E4E6EB] text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {isProcessing ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        {/* Right: Meta-style Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          
          {/* Follow / Follow Back Button for new followers */}
          {(notification.type === 'follow' || notification.type === 'follow_back') && targetUserId && onFollowToggle && (
            <button
              type="button"
              onClick={() => onFollowToggle(targetUserId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                isFollowingUser
                  ? 'bg-[#3A3B3C] hover:bg-[#4E4F50] text-zinc-200'
                  : 'bg-[#0064E0] hover:bg-[#1877F2] text-white shadow-sm'
              }`}
            >
              {isFollowingUser ? 'Following' : 'Follow Back'}
            </button>
          )}

          {/* Media Thumbnail Preview */}
          {(notification.metadata?.postImage || notification.metadata?.thumbnail) && (
            <div className="w-11 h-11 rounded-lg overflow-hidden border border-white/10 bg-black/50 shadow-sm shrink-0">
              <img 
                src={notification.metadata.postImage || notification.metadata.thumbnail} 
                alt="Preview" 
                className="w-full h-full object-cover" 
              />
            </div>
          )}

          {/* Meta Unread Blue Dot Indicator */}
          {isUnread && (
            <div 
              className="w-2.5 h-2.5 rounded-full bg-[#1877F2] shrink-0 shadow-[0_0_8px_rgba(24,119,242,0.9)]" 
              title="Unread"
            />
          )}

          {/* Meta 3-dots Context Menu Button */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(prev => !prev);
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[#B0B3B8] hover:text-white hover:bg-white/10 transition-all cursor-pointer ${
                showMenu || isHovered ? 'opacity-100' : 'opacity-0 sm:opacity-0 group-hover:opacity-100'
              }`}
              title="More options"
            >
              <MoreHorizontal size={16} />
            </button>

            {/* Dropdown Options */}
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-8 z-50 w-48 py-1.5 bg-[#242526] border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onMarkRead?.(notification.id);
                    }}
                    className="w-full px-3.5 py-2 text-left text-[#E4E6EB] hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <CheckCheck size={14} className="text-[#1877F2]" />
                    <span>Mark as read</span>
                  </button>

                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(notification.id);
                      }}
                      className="w-full px-3.5 py-2 text-left text-rose-400 hover:bg-rose-500/15 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>Remove notification</span>
                    </button>
                  )}

                  {onHideType && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onHideType(notification.type);
                      }}
                      className="w-full px-3.5 py-2 text-left text-[#B0B3B8] hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <BellOff size={14} />
                      <span>Turn off this type</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </motion.div>
  );
};
