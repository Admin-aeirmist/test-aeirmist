import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bookmark, Share2, Link, UserPlus, 
  VolumeX, EyeOff, Eye, Flag, Ban, BarChart3, Pin, Edit3, Trash2, Archive, Lock, X, Sparkles, Check,
  HelpCircle, ThumbsDown, Hash
} from 'lucide-react';
import { useAeirmist } from '../context/AeirmistContext';
import { logger } from '@/src/utils/logger';
import { feedRankingService } from '../services/FeedRankingService';


interface PostMenuProps {
  isOpen: boolean;
  onClose: () => void;
  postId?: string;
  authorId?: string;
  authorName?: string;
  topics?: string[];
  isOwnPost?: boolean;
  isSaved?: boolean;
  onSave?: () => void;
  onPin?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onReport?: () => void;
  onMute?: () => void;
  onHide?: () => void;
  onBlock?: () => void;
  onViewInsights?: () => void;
  isFollowingCreator?: boolean;
  isBlockedCreator?: boolean;
  onFollow?: () => void;
  isArchived?: boolean;
  onArchive?: () => void;
  onMoveToVault?: () => void;
  isLikesHidden?: boolean;
  onToggleHideLikes?: () => void;
  onWhyAmISeeingThis?: () => void;
  onShowLess?: () => void;
  onNotInterested?: () => void;
  onMuteTopic?: (topic: string) => void;
}

interface MenuOption {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'accent';
  badge?: string;
}

export const PostMenu: React.FC<PostMenuProps> = ({ 
  isOpen, 
  onClose,
  postId = '',
  authorName = 'Creator',
  isOwnPost = false,
  isSaved = false,
  onSave,
  onPin,
  onEdit,
  onDelete,
  onShare,
  onReport,
  onMute,
  onHide,
  onBlock,
  onViewInsights,
  isFollowingCreator = false,
  isBlockedCreator = false,
  onFollow,
  isArchived = false,
  onArchive,
  onMoveToVault,
  authorId,
  topics = [],
  isLikesHidden = false,
  onToggleHideLikes,
  onWhyAmISeeingThis,
  onShowLess,
  onNotInterested,
  onMuteTopic
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const auraContext = useAeirmist();
  const addToast = auraContext?.addToast;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleCopyLink = () => {
    try {
      const shareUrl = `${window.location.origin}/post/${postId || 'artifact'}`;
      navigator.clipboard.writeText(shareUrl);
      addToast?.({
        title: 'Link Copied',
        message: 'Post link copied to clipboard.',
        type: 'success'
      });
    } catch (e) {
      logger.error(e);
    }
  };

  const handleSaveDefault = () => {
    if (onSave) {
      onSave();
    } else {
      addToast?.({
        title: isSaved ? 'Removed Bookmark' : 'Saved Post',
        message: isSaved ? 'Post removed from saved items.' : 'Post saved to your bookmarks.',
        type: 'success'
      });
    }
  };

  const handleMuteDefault = () => {
    if (onMute) {
      onMute();
    } else {
      addToast?.({
        title: `Muted @${authorName}`,
        message: `You won't see posts from @${authorName} in main feed.`,
        type: 'info'
      });
    }
  };

  const handleHideDefault = () => {
    if (onHide) {
      onHide();
    } else {
      addToast?.({
        title: 'Post Hidden',
        message: 'This post has been removed from your current view.',
        type: 'info'
      });
    }
  };

  const universalSection: MenuOption[] = [
    {
      icon: <Bookmark size={17} className={isSaved ? "text-cyan-400 fill-cyan-400/20" : "text-cyan-400"} />,
      label: isSaved ? 'Remove Bookmark' : 'Save Post',
      onClick: handleSaveDefault,
      badge: isSaved ? 'Saved' : undefined
    },
    {
      icon: <Share2 size={17} className="text-cyan-400" />,
      label: 'Share Post',
      onClick: async () => {
        if (onShare) {
          onShare();
        } else {
          const shareUrl = `${window.location.origin}/post/${postId || 'artifact'}`;
          let shared = false;
          if (navigator.share) {
            try {
              await navigator.share({
                title: `Post by @${authorName}`,
                url: shareUrl
              });
              shared = true;
            } catch (e: any) {
              if (e?.name === 'AbortError') return;
            }
          }
          if (!shared) {
            handleCopyLink();
          }
        }
      },
    },
    { icon: <Link size={17} className="text-cyan-400" />, label: 'Copy Link', onClick: handleCopyLink },
  ];

  const ownerSection: MenuOption[] = [
    { 
      icon: <Pin size={17} className="text-amber-400" />, 
      label: 'Pin to Profile', 
      onClick: () => {
        if (onPin) onPin();
        else addToast?.({ title: 'Post Pinned', message: 'Post pinned to top of your profile.', type: 'success' });
      } 
    },
    { 
      icon: <Edit3 size={17} className="text-amber-400" />, 
      label: 'Edit Post', 
      onClick: () => {
        if (onEdit) onEdit();
        else addToast?.({ title: 'Edit Post', message: 'Opening editor...', type: 'info' });
      } 
    },
    { 
      icon: <Archive size={17} className="text-purple-400" />, 
      label: isArchived ? 'Restore Post' : 'Archive Post', 
      onClick: () => {
        if (onArchive) onArchive();
        else addToast?.({ title: isArchived ? 'Post Restored' : 'Post Archived', message: isArchived ? 'Post restored to public profile.' : 'Post moved to archives.', type: 'success' });
      } 
    },
    { 
      icon: <Lock size={17} className="text-cyan-400" />, 
      label: 'Move to Vault', 
      onClick: () => {
        if (onMoveToVault) onMoveToVault();
        else addToast?.({ title: 'Moved to Vault', message: 'Post secured in private encrypted vault.', type: 'success' });
      } 
    },
    { 
      icon: isLikesHidden ? <Eye size={17} className="text-pink-400" /> : <EyeOff size={17} className="text-pink-400" />, 
      label: isLikesHidden ? 'Unhide Like Count' : 'Hide Like Count', 
      onClick: () => {
        if (onToggleHideLikes) onToggleHideLikes();
        else addToast?.({ 
          title: isLikesHidden ? 'Likes Visible' : 'Likes Hidden', 
          message: isLikesHidden ? 'Like count is now visible to others.' : 'Like count is now hidden from others.', 
          type: 'info' 
        });
      } 
    },
    { 
      icon: <BarChart3 size={17} className="text-emerald-400" />, 
      label: 'View Analytics', 
      onClick: () => {
        if (onViewInsights) onViewInsights();
        else addToast?.({ title: 'Post Analytics', message: 'Opening analytics dashboard...', type: 'info' });
      } 
    },
  ];

  const handleShowLess = () => {
    if (onShowLess) {
      onShowLess();
    } else if (authorId) {
      feedRankingService.recordNegativeFeedback(authorId, 1);
      addToast?.({
        title: 'Tuning Feed',
        message: `You'll see fewer posts from @${authorName}.`,
        type: 'info'
      });
    }
  };

  const handleNotInterested = () => {
    if (onNotInterested) {
      onNotInterested();
    } else {
      if (authorId) feedRankingService.recordNegativeFeedback(authorId, 2);
      handleHideDefault();
      addToast?.({
        title: 'Feedback Recorded',
        message: `Post removed. We'll tune your recommendations accordingly.`,
        type: 'info'
      });
    }
  };

  const viewerSection: MenuOption[] = [
    ...(onWhyAmISeeingThis ? [{
      icon: <HelpCircle size={17} className="text-aeirmist-cyan" />,
      label: 'Why am I seeing this?',
      onClick: onWhyAmISeeingThis,
      badge: 'Feed 2.0'
    }] : []),
    {
      icon: <UserPlus size={17} className="text-emerald-400" />,
      label: isFollowingCreator ? `Unfollow @${authorName}` : `Follow @${authorName}`,
      onClick: () => {
        if (onFollow) onFollow();
        else addToast?.({ title: isFollowingCreator ? 'Unfollowed' : 'Following', message: `Updated connection status for @${authorName}`, type: 'success' });
      },
      badge: isFollowingCreator ? 'Following' : undefined
    },
    {
      icon: <ThumbsDown size={17} className="text-amber-400" />,
      label: 'Show less like this',
      onClick: handleShowLess
    },
    {
      icon: <EyeOff size={17} className="text-indigo-400" />,
      label: 'Not interested in this',
      onClick: handleNotInterested
    },
    { 
      icon: <VolumeX size={17} className="text-amber-400" />, 
      label: `Mute @${authorName}`, 
      onClick: () => {
        if (authorId) feedRankingService.muteCreator(authorId);
        handleMuteDefault();
      } 
    },
    ...(topics.slice(0, 2).map((topic: string) => ({
      icon: <Hash size={17} className="text-purple-400" />,
      label: `Mute #${topic}`,
      onClick: () => {
        if (onMuteTopic) {
          onMuteTopic(topic);
        } else {
          feedRankingService.muteTopic(topic);
          addToast?.({
            title: `Muted #${topic}`,
            message: `You won't see posts tagged #${topic} in your feed.`,
            type: 'info'
          });
        }
      }
    }))),
    { icon: <EyeOff size={17} className="text-white/40" />, label: 'Hide Post', onClick: handleHideDefault },
  ];

  const dangerSection: MenuOption[] = isOwnPost
    ? [
        { 
          icon: <Trash2 size={17} className="text-rose-400" />, 
          label: 'Delete Post', 
          onClick: () => {
            if (onDelete) onDelete();
            else addToast?.({ title: 'Post Deleted', message: 'Post successfully removed.', type: 'warning' });
          }, 
          variant: 'danger' 
        },
      ]
    : [
        { 
          icon: <Flag size={17} className="text-rose-400" />, 
          label: 'Report Content', 
          onClick: () => {
            if (onReport) onReport();
            else addToast?.({ title: 'Report Received', message: 'Thank you for keeping Aeirmist safe.', type: 'info' });
          }, 
          variant: 'danger' 
        },
        { 
          icon: <Ban size={17} className="text-rose-400" />, 
          label: isBlockedCreator ? `Unblock @${authorName}` : `Block @${authorName}`, 
          onClick: () => {
            if (onBlock) onBlock();
            else addToast?.({ title: isBlockedCreator ? 'User Unblocked' : 'User Blocked', message: `Updated block list for @${authorName}`, type: 'warning' });
          }, 
          variant: 'danger' 
        },
      ];

  const sections: { title?: string; options: MenuOption[] }[] = [
    { title: 'Post Actions', options: universalSection },
    ...(isOwnPost && ownerSection.length > 0 ? [{ title: 'Creator Controls', options: ownerSection }] : []),
    ...(!isOwnPost && viewerSection.length > 0 ? [{ title: 'Audience Controls', options: viewerSection }] : []),
    ...(dangerSection.length > 0 ? [{ title: 'Danger Zone', options: dangerSection }] : []),
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
          />

          {/* Modal Floating Card - Prevents clipping with fixed scrollable viewport max height */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative w-full max-w-[380px] bg-[#0c101a]/95 backdrop-blur-2xl border border-white/10 hover:border-cyan-500/30 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(0,242,255,0.12)] flex flex-col max-h-[85dvh] overflow-hidden z-10"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Sparkles size={13} />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-white">Post Options</h2>
                  <p className="text-[9px] text-white/40 font-mono">@{authorName}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
                title="Close options"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content Card Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
              {sections.map((section, sIdx) => (
                <div key={sIdx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-2 space-y-1">
                  {section.title && (
                    <p className={`px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] ${
                      section.title === 'Danger Zone' ? 'text-rose-400' : 'text-white/40'
                    }`}>
                      {section.title}
                    </p>
                  )}
                  {section.options.map((option, oIdx) => (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => {
                        option.onClick();
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer group text-left ${
                        option.variant === 'danger' 
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20' 
                          : 'bg-white/[0.02] hover:bg-cyan-500/10 text-white/90 hover:text-white border border-white/5 hover:border-cyan-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 rounded-lg bg-black/40 group-hover:scale-110 transition-transform shrink-0">
                          {option.icon}
                        </div>
                        <span className="truncate">{option.label}</span>
                      </div>
                      {option.badge && (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30 shrink-0">
                          {option.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Footer / Close Action */}
            <div className="p-3 border-t border-white/10 bg-black/40 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/10 cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

