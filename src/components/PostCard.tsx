import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, Sparkles, MapPin, ChevronLeft, ChevronRight, Eye, BarChart3 } from 'lucide-react';
import { formatAeirmistTimestamp } from '../lib/date';
import { PostMenu } from './PostMenu';
import { EditPostModal } from './EditPostModal';
import { useAeirmist } from '../context/AeirmistContext';
import { useReport } from './reporting/ReportContext';
import { REWARDS } from '../lib/aeirmistRanks';
import { usePostAnalytics } from '../hooks/usePostAnalytics';
import { getAvatarUrl, BLANK_DP, getBlankDp } from '../lib/avatar';
import { InsightsDashboard } from './analytics/InsightsDashboard';
import { postAnalytics } from '../services/PostAnalyticsService';
import { logger } from '@/src/utils/logger';


interface PostProps {
  post: {
    id: string;
    authorName: string;
    authorId?: string;
    authorUid?: string;
    authorPhoto: string;
    content: string;
    mediaURL?: string;
    mediaUrls?: string[];
    aspectRatio?: string;
    location?: string;
    aeirmistCount: number;
    viewsCount?: number;
    likedBy?: string[];
    timestamp: string;
  };
  onUserClick?: (user: any) => void;
}

export const PostCard: React.FC<PostProps> = React.memo(({ post, onUserClick }) => {
  const { openReportModal } = useReport();
  const { profile, toggleLike, earnPoints, localAvatarURL, deletePost, archivePost, toggleBookmark, addToast } = useAeirmist();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const postAuthorId = post.authorId || (post as any).userId || post.authorUid;
  const isDeletedAuthor = Boolean(
    (post as any).isDeletedAuthor || 
    post.authorName === 'Aeirmist User' || 
    (post as any).userName === 'Aeirmist User' || 
    !postAuthorId
  );
  const displayAuthorName = isDeletedAuthor ? 'Aeirmist User' : (post.authorName || 'Aeirmist User');
  const isOwnPost = Boolean(profile?.id && postAuthorId && (postAuthorId === profile.id || postAuthorId === profile.uid));
  const authorPhoto = isDeletedAuthor ? getBlankDp() : (isOwnPost ? (localAvatarURL || profile.photoURL || post.authorPhoto) : post.authorPhoto);

  const images = post.mediaUrls && post.mediaUrls.length > 0 
    ? post.mediaUrls 
    : (post.mediaURL ? [post.mediaURL] : []);

  const isLiked = profile && post.likedBy?.includes(profile.id);
  const isSaved = profile && (post as any).savedBy?.includes(profile.id);

  const type = images.length > 1 ? 'collage' : images.length === 1 ? 'photo' : 'text';
  usePostAnalytics({ postId: post.id, type });

  const handleAuthorClick = () => {
    if (isDeletedAuthor) {
      addToast?.({ title: 'Unavailable', message: 'This account is unavailable on Aeirmist.', type: 'info' });
      return;
    }
    postAnalytics.trackProfileClick(post.id);
    onUserClick?.({
      id: post.authorId,
      displayName: displayAuthorName,
      photoURL: authorPhoto,
      username: displayAuthorName.toLowerCase().replace(' ', '_')
    });
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    const shareData = {
      title: `Post by ${post.authorName}`,
      text: post.content || 'Check out this post on Aeirmist!',
      url: shareUrl,
    };

    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        shared = true;
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          logger.warn("Native share failed, falling back to clipboard:", e);
        } else {
          return;
        }
      }
    }

    if (!shared) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        addToast({ title: 'Link Copied', message: 'Post link copied to clipboard.', type: 'success' });
      } catch (err) {
        logger.error("Clipboard copy failed:", err);
      }
    }
    await earnPoints(REWARDS.SHARE_ACTION);
  };

  return (
    <>
      <motion.div 
        id={`post-${post.id}`}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card mb-4 sm:mb-6 overflow-hidden border-white/10"
      >
        {/* Header */}
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl overflow-hidden cursor-pointer shrink-0 border border-white/10 shadow-sm transition-transform hover:scale-105"
              onClick={handleAuthorClick}
            >
              <img 
                src={getAvatarUrl(authorPhoto, displayAuthorName)} 
                alt={displayAuthorName} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getBlankDp();
                }}
              />
            </div>
            <div className="cursor-pointer" onClick={handleAuthorClick}>
              <h3 className="font-bold text-sm tracking-tight">{displayAuthorName}</h3>
              {post.location ? (
                <p className="text-[9px] text-aeirmist-cyan flex items-center gap-1 font-black uppercase tracking-widest">
                   <MapPin size={8} className="fill-current" /> {post.location}
                </p>
              ) : (
                <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium">Original Artifact</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isOwnPost && (
              <button 
                onClick={() => setShowInsights(true)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full flex items-center gap-2 text-[10px] font-bold text-aeirmist-cyan border border-aeirmist-cyan/20 transition-all uppercase tracking-tighter"
              >
                <BarChart3 size={12} />
                View Insights
              </button>
            )}
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="text-white hover:text-aeirmist-cyan transition-colors p-2 hover:bg-white/10 rounded-full active:scale-90"
            >
              <MoreHorizontal size={24} />
            </button>
          </div>
        </div>

        {/* Media Carousel */}
        {images.length > 0 && (
          <div className={`relative overflow-hidden bg-white/[0.02] group max-h-[min(50vh,390px)] sm:max-h-[min(65vh,490px)] ${
            post.aspectRatio === '1/1' ? 'aspect-square' : 
            post.aspectRatio === '4/5' ? 'aspect-[4/5]' : 
            post.aspectRatio === '16/9' ? 'aspect-video' : 
            'aspect-square'
          }`}>
            <div className="w-full h-full flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentIdx * 100}%)` }}>
              {images.map((url, i) => (
                <div key={i} className="min-w-full h-full">
                  <img 
                    src={url} 
                    alt="Artifact" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <div className="absolute inset-y-0 left-0 flex items-center p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                    onClick={(e) => { e.stopPropagation(); setCurrentIdx(prev => Math.max(0, prev - 1)) }}
                    className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white disabled:opacity-0"
                    disabled={currentIdx === 0}
                   >
                     <ChevronLeft size={20} />
                   </button>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                    onClick={(e) => { e.stopPropagation(); setCurrentIdx(prev => Math.min(images.length - 1, prev + 1)) }}
                    className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white disabled:opacity-0"
                    disabled={currentIdx === images.length - 1}
                   >
                     <ChevronRight size={20} />
                   </button>
                </div>
                {/* Dots Indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-1.5 bg-black/40 backdrop-blur-md rounded-full">
                   {images.map((_, i) => (
                     <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIdx ? 'bg-white w-3' : 'bg-white/20'}`} />
                   ))}
                </div>
              </>
            )}

            {/* Subtle overlay gradient */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-aeirmist-bg/40 to-transparent pointer-events-none" />
          </div>
        )}

        {/* Actions Bar */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-5">
              <button 
                onClick={() => toggleLike(post.id, !!isLiked)}
                className="transition-all hover:scale-110 active:scale-90"
              >
                <Heart size={26} className={`transition-colors ${isLiked ? 'fill-aeirmist-magenta text-aeirmist-magenta' : 'text-white hover:text-aeirmist-magenta'}`} />
              </button>
              <button onClick={() => logger.info("Action coming soon")} className="transition-all hover:scale-110 active:scale-90">
                <MessageCircle size={26} className="text-white hover:text-aeirmist-cyan transition-colors" />
              </button>
              <button 
                onClick={handleShare}
                className="transition-all hover:scale-110 active:scale-90"
              >
                <Share2 size={26} className="text-white hover:text-aeirmist-lime transition-colors" />
              </button>
              <div className="flex items-center gap-1.5 text-white/40">
                <Eye size={22} className="text-white/40" />
                <span className="text-sm font-bold tracking-tighter">{post.viewsCount || 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/20">
                <Sparkles size={12} className="text-aeirmist-cyan" />
                <span className="text-[10px] font-bold text-aeirmist-cyan uppercase tracking-tighter">Aeirmist +{post.aeirmistCount}</span>
              </div>
              <button 
                onClick={() => toggleBookmark(post.id, !!isSaved)}
                className="transition-all hover:scale-110 active:scale-90"
              >
                <Bookmark size={26} className={`transition-colors ${isSaved ? 'fill-aeirmist-magenta text-aeirmist-magenta shadow-[0_0_8px_rgba(255,0,64,0.5)]' : 'text-white hover:text-aeirmist-magenta'}`} />
              </button>
            </div>
          </div>

          {/* Likes Count */}
          <p className="text-sm font-bold mb-1.5">{post.aeirmistCount.toLocaleString()} Aeirmist pulses</p>

          {/* Caption */}
          <div className="text-sm leading-relaxed mb-2">
            <span className="font-bold mr-2 cursor-pointer hover:text-aeirmist-cyan transition-colors" onClick={handleAuthorClick}>
              {post.authorName.toLowerCase().replace(' ', '_')}
            </span>
            <span className="text-white/80">{post.content}</span>
          </div>

          {/* Status / Timestamp */}
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{formatAeirmistTimestamp(post.timestamp)}</p>
            <div className="w-1 h-1 rounded-full bg-white/10" />
            <p className="text-[10px] text-aeirmist-cyan uppercase tracking-widest font-bold">Vibrated</p>
          </div>
        </div>
      </motion.div>

      <PostMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        postId={post.id}
        isOwnPost={!!isOwnPost}
        onViewInsights={() => setShowInsights(true)}
        onReport={() => openReportModal('post', post.id, postAuthorId)}
        onEdit={() => {
            setIsMenuOpen(false);
            setIsEditing(true);
        }}
        onDelete={async () => {
          try {
            await deletePost(post.id);
          } catch (e) {
            logger.error("Delete failed:", e);
          }
        }}
        isArchived={!!(post as any).isArchived}
        onArchive={async () => {
          try {
            await archivePost(post.id, !(post as any).isArchived);
          } catch (e) {
            logger.error("Archive failed:", e);
          }
        }}
      />
      {isEditing && <EditPostModal post={post} onClose={() => setIsEditing(false)} />}
      <AnimatePresence>
        {showInsights && (
          <InsightsDashboard postId={post.id} onClose={() => setShowInsights(false)} />
        )}
      </AnimatePresence>
    </>
  );
});
