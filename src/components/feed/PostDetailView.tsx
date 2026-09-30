import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  MoreHorizontal, 
  ArrowLeft, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Smile, 
  Trash2, 
  Loader2, 
  AlertCircle,
  Check,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { 
  doc, 
  updateDoc, 
  increment, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  deleteDoc 
} from 'firebase/firestore';
import { useAeirmist } from '../../context/AeirmistContext';
import { useBackHandler } from '../../utils/backNavigation';
import { getAvatarUrl, BLANK_DP } from '../../lib/avatar';
import { formatAeirmistTimestamp } from '../../lib/date';
import { SafeImage } from '../ui/SafeImage';
import { VideoPlayer } from './VideoPlayer';
import { PostMusicPlayer } from './PostMusicPlayer';
import { logger } from '@/src/utils/logger';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface PostDetailViewProps {
  postId: string;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

const renderAeirmistVerifiedBadge = (isVerified?: boolean, plan?: string, size = 14) => {
  if (!isVerified) return null;
  const isBusiness = plan === 'business' || plan === 'enterprise';
  return (
    <span title={isBusiness ? 'Aeirmist Business Verified' : 'Aeirmist Verified'} className="inline-flex items-center ml-0.5 align-middle">
      <ShieldCheck 
        size={size} 
        className={`${isBusiness ? 'text-amber-400' : 'text-aeirmist-cyan'} shrink-0`} 
      />
    </span>
  );
};

export const PostDetailView: React.FC<PostDetailViewProps> = ({ postId, onClose, onNavigate }) => {
  const { 
    db, 
    user, 
    profile, 
    toggleLike, 
    toggleBookmark, 
    toggleFollow, 
    isFollowing, 
    deletePost,
    createNotification,
    earnPoints,
    addToast 
  } = useAeirmist();

  // Android back button integration
  useBackHandler(() => {
    onClose();
    return true;
  }, true, 100);

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Engagement states
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);

  // Media carousel state
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);

  // Comments state
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string; parentId?: string | null } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<{ [commentId: string]: boolean }>({});

  // Options Menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const commentInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch Post Document
  useEffect(() => {
    if (!db || !postId) return;

    setLoading(true);
    setError(null);

    const unsubPost = onSnapshot(doc(db, 'posts', postId), (postDoc) => {
      if (postDoc.exists()) {
        const data = postDoc.data();
        const authorId = data.userId || data.authorId || data.author?.id || data.author?.uid || data.ownerUid;
        const postData = {
          id: postDoc.id,
          ...data,
          authorId,
          author: {
            id: authorId,
            name: data.userName || data.authorName || data.author?.displayName || data.author?.username || 'Aeirmist User',
            avatar: getAvatarUrl(data.author?.photoURL || data.userAvatar || data.authorAvatar),
            isVerified: Boolean(data.author?.isVerified || data.isVerified || data.verified),
            verificationPlan: data.author?.verificationPlan || data.verificationPlan
          },
          likesCount: data.likesCount || 0,
          commentsCount: data.commentsCount || 0,
          likedBy: data.likedBy || [],
          savedBy: data.savedBy || [],
          createdAt: data.createdAt
        };
        setPost(postData);
        setLikesCount(postData.likesCount);

        if (profile?.id) {
          setIsLiked(Boolean(postData.likedBy?.includes(profile.id)));
          setIsBookmarked(Boolean(postData.savedBy?.includes(profile.id)));
        }
      } else {
        setError('Post not found');
      }
      setLoading(false);
    }, (err) => {
      logger.error('Error fetching post:', err);
      setError('Failed to load post');
      setLoading(false);
    });

    return () => unsubPost();
  }, [db, postId, profile?.id]);

  // Subscribe to live comments
  useEffect(() => {
    if (!db || !postId) return;

    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubComments = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setComments(docs);
    }, (err) => {
      logger.error('Comments listener error:', err);
    });

    return () => unsubComments();
  }, [db, postId]);

  // Parse media items
  const mediaList: MediaItem[] = useMemo(() => {
    if (!post) return [];
    if (post.mediaItems && post.mediaItems.length > 0) {
      return post.mediaItems.map((item: any) => ({
        url: typeof item === 'string' ? item : item.url,
        type: typeof item === 'object' && item.type ? item.type : ((typeof item === 'string' && (item.endsWith('.mp4') || item.includes('video'))) ? 'video' : 'image')
      }));
    }
    if (post.mediaUrls && post.mediaUrls.length > 0) {
      return post.mediaUrls.map((url: string) => ({
        url,
        type: (url.endsWith('.mp4') || url.includes('video')) ? 'video' : 'image'
      }));
    }
    if (post.mediaUrl) {
      return [{
        url: post.mediaUrl,
        type: post.mediaType || ((post.mediaUrl.endsWith('.mp4') || post.mediaUrl.includes('video')) ? 'video' : 'image')
      }];
    }
    return [];
  }, [post]);

  // Group comments into top-level and nested replies
  const commentTree = useMemo(() => {
    const commentMap: { [id: string]: any } = {};
    const tree: any[] = [];

    comments.forEach(c => {
      commentMap[c.id] = { ...c, replies: [] };
    });

    comments.forEach(c => {
      const node = commentMap[c.id];
      if (!node.parentId) {
        tree.push(node);
      } else {
        const parent = commentMap[node.parentId];
        if (parent) {
          parent.replies.push(node);
        } else {
          tree.push(node);
        }
      }
    });

    return tree;
  }, [comments]);

  const postAuthorId = post?.authorId;
  const isOwnPost = Boolean(profile?.id && postAuthorId && (postAuthorId === profile.id || postAuthorId === profile.uid));
  const isFollowingAuthor = Boolean(isFollowing && postAuthorId && isFollowing(postAuthorId));

  // Like action
  const handleLike = async () => {
    if (!profile || !db || !post) return;
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));

    if (newLiked) {
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 900);
    }

    try {
      await toggleLike(post.id, isLiked, postAuthorId);
    } catch (err) {
      setIsLiked(!newLiked);
      setLikesCount(prev => !newLiked ? prev + 1 : Math.max(0, prev - 1));
      logger.error('Like toggle error:', err);
    }
  };

  const handleDoubleTapMedia = () => {
    if (!isLiked) {
      handleLike();
    } else {
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 900);
    }
  };

  // Bookmark action
  const handleBookmarkToggle = async () => {
    if (!profile || !db || !post) return;
    const newBookmarked = !isBookmarked;
    setIsBookmarked(newBookmarked);
    try {
      await toggleBookmark(post.id, isBookmarked);
      if (newBookmarked && addToast) {
        addToast({
          title: 'SAVED',
          message: 'Saved to your saved items.',
          type: 'success'
        });
      }
    } catch (err) {
      setIsBookmarked(!newBookmarked);
      logger.error('Bookmark toggle error:', err);
    }
  };

  // Follow action
  const handleFollow = async () => {
    if (!profile || !postAuthorId || isOwnPost) return;
    try {
      if (toggleFollow) {
        await toggleFollow(postAuthorId);
        if (addToast) {
          addToast({
            title: isFollowingAuthor ? 'Unfollowed' : 'Following',
            message: isFollowingAuthor ? `Unfollowed @${post.author.name}` : `Following @${post.author.name}`,
            type: 'success'
          });
        }
      }
    } catch (err) {
      logger.error('Follow toggle error:', err);
    }
  };

  // Submit comment
  const handleCommentSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!db || !profile || !commentText.trim() || submittingComment) return;

    const txt = commentText.trim();
    const replyTarget = replyingTo;
    setCommentText('');
    setReplyingTo(null);
    setSubmittingComment(true);

    try {
      const commentsRef = collection(db, 'posts', post.id, 'comments');
      const activeParentId = replyTarget ? (replyTarget.parentId || replyTarget.id) : null;

      const newComment = {
        authorId: profile.id,
        authorUid: user?.uid || profile.id,
        userId: user?.uid || profile.id,
        authorName: profile.displayName || profile.username || 'User',
        authorPhoto: profile.photoURL || '',
        isVerified: profile.isVerified || false,
        content: txt,
        likedBy: [],
        parentId: activeParentId,
        replyToId: replyTarget?.id || null,
        replyToUsername: replyTarget?.authorName || null,
        createdAt: serverTimestamp()
      };

      await addDoc(commentsRef, newComment);

      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });

      if (replyTarget && activeParentId) {
        setExpandedReplies(prev => ({ ...prev, [activeParentId]: true }));
      }

      // Notifications
      if (postAuthorId && postAuthorId !== profile.id && createNotification) {
        await createNotification(
          postAuthorId,
          'comment',
          `${profile.displayName || profile.username} commented on your post.`,
          { postId: post.id }
        );
      }

      if (earnPoints) {
        await earnPoints(15);
      }
    } catch (err) {
      logger.error('Add comment error:', err);
      if (addToast) {
        addToast({
          title: 'ERROR',
          message: 'Failed to post comment. Please try again.',
          type: 'warning'
        });
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  // Like comment
  const handleLikeComment = async (commentId: string, currentLikedBy: string[] = []) => {
    if (!profile || !db) return;
    try {
      const commentDocRef = doc(db, 'posts', post.id, 'comments', commentId);
      const isAlreadyLiked = currentLikedBy.includes(profile.id);
      let newLikedBy = [...currentLikedBy];

      if (isAlreadyLiked) {
        newLikedBy = newLikedBy.filter(id => id !== profile.id);
      } else {
        newLikedBy.push(profile.id);
      }

      await updateDoc(commentDocRef, { likedBy: newLikedBy });
    } catch (err) {
      logger.error('Like comment error:', err);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!db || !post) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id, 'comments', commentId));
      await updateDoc(doc(db, 'posts', post.id), {
        commentsCount: increment(-1)
      });
      if (addToast) {
        addToast({
          title: 'DELETED',
          message: 'Comment deleted.',
          type: 'success'
        });
      }
    } catch (err) {
      logger.error('Delete comment error:', err);
    }
  };

  // Share action
  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/post/${post.id}`;
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.author.name} on Aeirmist`,
          text: post.content,
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        if (addToast) {
          addToast({
            title: 'LINK COPIED',
            message: 'Post link copied to clipboard.',
            type: 'success'
          });
        }
      }
    } catch (err) {
      logger.error('Share error:', err);
    }
  };

  // Delete own post
  const handleDeletePost = async () => {
    if (!isOwnPost || !deletePost || !post) return;
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await deletePost(post.id);
        onClose();
        if (addToast) {
          addToast({
            title: 'POST DELETED',
            message: 'Your post has been deleted.',
            type: 'success'
          });
        }
      } catch (err) {
        logger.error('Delete post error:', err);
      }
    }
  };

  const formattedDate = useMemo(() => {
    if (!post?.createdAt) return 'Just now';
    if (post.createdAt.toDate) {
      const d = post.createdAt.toDate();
      return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    }
    return 'Recently';
  }, [post?.createdAt]);

  const formattedTimeAgo = useMemo(() => {
    if (!post?.createdAt) return 'Just now';
    return formatAeirmistTimestamp(post.createdAt);
  }, [post?.createdAt]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-md flex items-center justify-center select-none overflow-hidden"
    >
      {/* Background click dismiss for desktop */}
      <div 
        className="absolute inset-0 z-0 hidden md:block" 
        onClick={onClose} 
      />

      {/* Global Close Button for Desktop */}
      <button 
        onClick={onClose}
        aria-label="Close"
        className="hidden md:flex absolute top-4 right-5 z-[5020] text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
      >
        <X size={26} />
      </button>

      {/* ========================================================================= */}
      {/* DESKTOP MODAL VIEW (hidden md:flex) - Authentic Instagram 2-Column Layout */}
      {/* ========================================================================= */}
      <div 
        className="relative z-10 hidden md:flex w-full max-w-[1040px] h-[86vh] max-h-[840px] min-h-[520px] bg-black rounded-lg overflow-hidden border border-neutral-800 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-neutral-400">
            <Loader2 size={36} className="animate-spin text-sky-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Loading post...</span>
          </div>
        ) : error ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center p-6">
            <AlertCircle size={40} className="text-red-400" />
            <h3 className="text-lg font-bold text-white">{error}</h3>
            <button 
              onClick={onClose}
              className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-sm font-semibold rounded-lg text-white transition-all"
            >
              Close
            </button>
          </div>
        ) : post ? (
          <>
            {/* 1. LEFT PANE: Media Carousel & Viewer */}
            <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden h-full select-none">
              {mediaList.length > 0 ? (
                <div 
                  className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden"
                  onDoubleClick={handleDoubleTapMedia}
                >
                  {/* Subtle ambient blur behind */}
                  <img 
                    src={mediaList[activeMediaIdx]?.url} 
                    alt="" 
                    aria-hidden="true" 
                    className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-20 scale-110 pointer-events-none" 
                  />

                  {/* Active Media */}
                  {mediaList[activeMediaIdx]?.type === 'video' ? (
                    <VideoPlayer 
                      src={mediaList[activeMediaIdx].url} 
                      className="w-full h-full object-contain relative z-10" 
                      controls 
                      autoPlay 
                      useCache 
                    />
                  ) : (
                    <SafeImage 
                      src={mediaList[activeMediaIdx]?.url} 
                      alt="Post Media" 
                      className="w-full h-full object-contain relative z-10" 
                      referrerPolicy="no-referrer" 
                      useCache 
                    />
                  )}

                  {/* Floating Double-Tap Heart Animation */}
                  <AnimatePresence>
                    {showHeartAnim && (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [0, 1.25, 1], opacity: [0, 1, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.85, ease: 'easeOut' }}
                        className="absolute z-30 pointer-events-none text-white drop-shadow-[0_0_25px_rgba(255,0,0,0.8)]"
                      >
                        <Heart size={96} fill="white" className="text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Multi-Image Carousel Arrows */}
                  {mediaList.length > 1 && (
                    <>
                      {activeMediaIdx > 0 && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMediaIdx(prev => prev - 1);
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/70 hover:bg-white text-black flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer"
                          aria-label="Previous image"
                        >
                          <ChevronLeft size={20} />
                        </button>
                      )}

                      {activeMediaIdx < mediaList.length - 1 && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMediaIdx(prev => prev + 1);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/70 hover:bg-white text-black flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer"
                          aria-label="Next image"
                        >
                          <ChevronRight size={20} />
                        </button>
                      )}

                      {/* Pagination Dots */}
                      <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 pointer-events-none">
                        {mediaList.map((_, idx) => (
                          <div 
                            key={idx} 
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === activeMediaIdx ? 'bg-white scale-125' : 'bg-white/40'}`} 
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Text-only post background */
                <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-neutral-900 to-black text-center">
                  <p className="text-xl font-medium text-neutral-200 max-w-md whitespace-pre-wrap">{post.content}</p>
                </div>
              )}
            </div>

            {/* 2. RIGHT PANE: Instagram Post Sidebar (~400px) */}
            <div className="w-[390px] lg:w-[410px] flex-shrink-0 bg-[#080a0f]/90 backdrop-blur-2xl border-l border-white/10 flex flex-col h-full text-white">
              
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between relative">
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src={post.author.avatar || BLANK_DP} 
                    alt={post.author.name} 
                    className="w-8 h-8 rounded-full object-cover border border-neutral-800 flex-shrink-0 cursor-pointer" 
                  />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-sm text-white hover:underline cursor-pointer truncate max-w-[130px]">
                      {post.author.name}
                    </span>
                    {renderAeirmistVerifiedBadge(post.author.isVerified, post.author.verificationPlan, 14)}
                    {!isOwnPost && (
                      <>
                        <span className="text-neutral-500 text-xs">•</span>
                        <button 
                          onClick={handleFollow}
                          className="text-xs font-semibold text-sky-500 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                        >
                          {isFollowingAuthor ? 'Following' : 'Follow'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="text-neutral-300 hover:text-white p-1 rounded-full hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <MoreHorizontal size={20} />
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div className="absolute right-0 top-8 z-50 w-44 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl py-1 text-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      {isOwnPost && (
                        <button 
                          onClick={() => { setIsMenuOpen(false); handleDeletePost(); }}
                          className="w-full px-4 py-2.5 text-left text-red-500 font-semibold hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 size={16} /> Delete Post
                        </button>
                      )}
                      <button 
                        onClick={() => { setIsMenuOpen(false); handleShare(); }}
                        className="w-full px-4 py-2.5 text-left text-neutral-200 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Share2 size={16} /> Share Post
                      </button>
                      <button 
                        onClick={() => {
                          setIsMenuOpen(false);
                          navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                          if (addToast) addToast({ title: 'COPIED', message: 'Link copied', type: 'success' });
                        }}
                        className="w-full px-4 py-2.5 text-left text-neutral-200 hover:bg-neutral-800 cursor-pointer"
                      >
                        Copy Link
                      </button>
                      <button 
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full px-4 py-2 text-left text-neutral-400 hover:bg-neutral-800 border-t border-neutral-800 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable Middle: Author Caption + Comments Stream */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 custom-scrollbar">
                
                {/* 1. Author Caption Item (Exact Instagram Style) */}
                {post.content && (
                  <div className="flex items-start gap-3 text-sm">
                    <img 
                      src={post.author.avatar || BLANK_DP} 
                      alt={post.author.name} 
                      className="w-8 h-8 rounded-full object-cover border border-neutral-800 flex-shrink-0 cursor-pointer" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-100 text-[13.5px] leading-relaxed break-words">
                        <span className="font-semibold text-white mr-1.5 hover:underline cursor-pointer">
                          {post.author.name}
                        </span>
                        {renderAeirmistVerifiedBadge(post.author.isVerified, post.author.verificationPlan, 13)}
                        <span>{post.content}</span>
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1.5 font-medium">
                        <span>{formattedTimeAgo}</span>
                      </div>
                      {post.music && (
                        <div className="mt-2.5">
                          <PostMusicPlayer music={post.music} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Comments List */}
                {commentTree.length > 0 ? (
                  commentTree.map((c) => {
                    const isCommentLiked = Boolean(profile?.id && c.likedBy?.includes(profile.id));
                    const isCommentOwner = Boolean(profile?.id && c.authorId === profile.id);
                    const repliesCount = c.replies?.length || 0;
                    const showReplies = Boolean(expandedReplies[c.id]);

                    return (
                      <div key={c.id} className="space-y-2">
                        <div className="flex items-start gap-3 text-sm group">
                          <img 
                            src={getAvatarUrl(c.authorPhoto)} 
                            alt={c.authorName} 
                            className="w-8 h-8 rounded-full object-cover border border-neutral-800 flex-shrink-0 cursor-pointer" 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-neutral-100 text-[13px] leading-snug break-words">
                              <span className="font-semibold text-white mr-1.5 cursor-pointer hover:underline">
                                {c.authorName}
                              </span>
                              {renderAeirmistVerifiedBadge(c.isVerified, c.verificationPlan, 12)}
                              <span>{c.content}</span>
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1 font-medium">
                              <span>{c.createdAt ? formatAeirmistTimestamp(c.createdAt) : 'Just now'}</span>
                              {c.likedBy?.length > 0 && (
                                <span className="font-semibold text-neutral-400">
                                  {c.likedBy.length} {c.likedBy.length === 1 ? 'like' : 'likes'}
                                </span>
                              )}
                              <button 
                                onClick={() => {
                                  setReplyingTo({ id: c.id, authorName: c.authorName, parentId: c.parentId || c.id });
                                  commentInputRef.current?.focus();
                                }}
                                className="text-neutral-400 hover:text-white font-semibold transition-colors cursor-pointer"
                              >
                                Reply
                              </button>
                              {isCommentOwner && (
                                <button 
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-opacity p-0.5 cursor-pointer"
                                  title="Delete comment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Heart Icon for Comment */}
                          <button 
                            onClick={() => handleLikeComment(c.id, c.likedBy || [])}
                            className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors flex-shrink-0 mt-0.5 cursor-pointer"
                          >
                            <Heart 
                              size={12} 
                              fill={isCommentLiked ? '#ef4444' : 'none'} 
                              className={isCommentLiked ? 'text-red-500' : 'text-neutral-500'} 
                            />
                          </button>
                        </div>

                        {/* Nested Replies Section */}
                        {repliesCount > 0 && (
                          <div className="pl-11 space-y-2">
                            <button 
                              onClick={() => setExpandedReplies(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                              className="flex items-center gap-3 text-xs text-neutral-500 hover:text-neutral-300 font-medium transition-colors cursor-pointer"
                            >
                              <div className="w-6 h-[1px] bg-neutral-700" />
                              <span>{showReplies ? 'Hide replies' : `View replies (${repliesCount})`}</span>
                            </button>

                            {showReplies && c.replies.map((reply: any) => {
                              const isReplyLiked = Boolean(profile?.id && reply.likedBy?.includes(profile.id));
                              const isReplyOwner = Boolean(profile?.id && reply.authorId === profile.id);

                              return (
                                <div key={reply.id} className="flex items-start gap-2.5 text-xs group pt-1">
                                  <img 
                                    src={getAvatarUrl(reply.authorPhoto)} 
                                    alt={reply.authorName} 
                                    className="w-6 h-6 rounded-full object-cover border border-neutral-800 flex-shrink-0" 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-neutral-200 leading-snug break-words">
                                      <span className="font-semibold text-white mr-1 cursor-pointer hover:underline">
                                        {reply.authorName}
                                      </span>
                                      {reply.replyToUsername && (
                                        <span className="text-sky-400 font-medium mr-1">@{reply.replyToUsername}</span>
                                      )}
                                      <span>{reply.content}</span>
                                    </p>
                                    <div className="flex items-center gap-3 text-[10px] text-neutral-500 mt-1">
                                      <span>{reply.createdAt ? formatAeirmistTimestamp(reply.createdAt) : 'Just now'}</span>
                                      {reply.likedBy?.length > 0 && (
                                        <span>{reply.likedBy.length} likes</span>
                                      )}
                                      <button 
                                        onClick={() => {
                                          setReplyingTo({ id: reply.id, authorName: reply.authorName, parentId: c.id });
                                          commentInputRef.current?.focus();
                                        }}
                                        className="text-neutral-400 hover:text-white font-semibold cursor-pointer"
                                      >
                                        Reply
                                      </button>
                                      {isReplyOwner && (
                                        <button 
                                          onClick={() => handleDeleteComment(reply.id)}
                                          className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-opacity cursor-pointer"
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleLikeComment(reply.id, reply.likedBy || [])}
                                    className="p-1 text-neutral-500 hover:text-neutral-300 flex-shrink-0 cursor-pointer"
                                  >
                                    <Heart 
                                      size={11} 
                                      fill={isReplyLiked ? '#ef4444' : 'none'} 
                                      className={isReplyLiked ? 'text-red-500' : 'text-neutral-500'} 
                                    />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-14 text-center">
                    <p className="text-sm font-bold text-white">No comments yet.</p>
                    <p className="text-xs text-neutral-500 mt-1">Start the conversation.</p>
                  </div>
                )}
              </div>

              {/* Engagement Bar */}
              <div className="px-4 pt-3 pb-3 border-t border-white/10 bg-black/40 backdrop-blur-md flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={handleLike}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-300 active:scale-95 group font-black uppercase text-[11px] tracking-wider cursor-pointer ${
                        isLiked 
                          ? 'bg-aeirmist-magenta/10 border-aeirmist-magenta/30 text-aeirmist-magenta shadow-[0_0_15px_rgba(255,0,234,0.15)]' 
                          : 'bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/10'
                      }`}
                      aria-label="Like post"
                    >
                      <Heart size={14} fill={isLiked ? "currentColor" : "none"} className={`transition-transform group-hover:scale-110 ${isLiked ? 'text-aeirmist-magenta' : 'text-current'}`} />
                      <span>{likesCount.toLocaleString()}</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => commentInputRef.current?.focus()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all duration-300 active:scale-95 font-black uppercase text-[11px] tracking-wider cursor-pointer"
                      aria-label="Comment"
                    >
                      <MessageCircle size={14} className="text-current" />
                      <span>{comments.length.toLocaleString()}</span>
                    </button>

                    <button 
                      type="button"
                      onClick={handleShare}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 text-white/40 hover:text-white hover:border-white/25 transition-all duration-300 active:scale-95 font-black uppercase text-[11px] tracking-wider group cursor-pointer"
                      aria-label="Share"
                    >
                      <Share2 size={14} className="transition-transform group-hover:scale-110 group-hover:rotate-12" />
                      <span>SHARE</span>
                    </button>

                    <div className="flex items-center gap-1 px-2 py-1 text-white/30">
                      <Eye size={14} className="text-white/20" />
                      <span className="text-[10px] font-bold font-mono">{(post.viewsCount || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={handleBookmarkToggle}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-95 border cursor-pointer ${
                      isBookmarked 
                        ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.15)]' 
                        : 'bg-white/5 border-white/5 text-white/30 hover:text-white hover:border-white/25 hover:bg-white/10'
                    }`}
                    title="Save post"
                  >
                    <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-white/40 font-medium">
                  <span>{likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}</span>
                  <span className="uppercase tracking-wider text-[10px]">{formattedDate}</span>
                </div>
              </div>

              {/* Comment Input Bar */}
              <div className="px-4 py-3 border-t border-white/10 bg-black/60 backdrop-blur-md relative">
                {replyingTo && (
                  <div className="flex items-center justify-between text-xs text-sky-400 mb-2 bg-sky-500/10 px-2.5 py-1 rounded-md">
                    <span>Replying to @{replyingTo.authorName}</span>
                    <button onClick={() => setReplyingTo(null)} className="text-neutral-400 hover:text-white cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>
                )}
                <form onSubmit={handleCommentSubmit} className="flex items-center gap-3">
                  <button 
                    type="button"
                    className="text-neutral-400 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
                    onClick={() => {
                      setCommentText(prev => prev + ' ❤️');
                      commentInputRef.current?.focus();
                    }}
                  >
                    <Smile size={24} />
                  </button>
                  <input 
                    ref={commentInputRef}
                    type="text"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder={replyingTo ? `Reply to @${replyingTo.authorName}...` : "Add a comment..."}
                    className="bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none flex-1 min-w-0"
                  />
                  <button 
                    type="submit"
                    disabled={!commentText.trim() || submittingComment}
                    className="text-sm font-semibold text-sky-500 hover:text-sky-400 disabled:opacity-30 disabled:hover:text-sky-500 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    {submittingComment ? <Loader2 size={16} className="animate-spin" /> : 'Post'}
                  </button>
                </form>
              </div>

            </div>
          </>
        ) : null}
      </div>

      {/* ========================================================================= */}
      {/* MOBILE FULL-SCREEN VIEW (flex md:hidden) - Authentic Instagram Mobile Post */}
      {/* ========================================================================= */}
      <div 
        className="relative z-10 flex md:hidden w-full h-full bg-black text-white flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top App Bar */}
        <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-neutral-800 px-3 py-3 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 text-white active:scale-95 p-1 cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>
          
          <div className="font-bold text-sm tracking-widest uppercase text-white">
            Post
          </div>

          <div className="w-7 flex justify-end">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-neutral-300 hover:text-white p-1 cursor-pointer"
            >
              <MoreHorizontal size={20} />
            </button>
          </div>
        </div>

        {/* Mobile Options Menu */}
        {isMenuOpen && (
          <div className="absolute top-12 right-3 z-50 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl py-1 text-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {isOwnPost && (
              <button 
                onClick={() => { setIsMenuOpen(false); handleDeletePost(); }}
                className="w-full px-4 py-2.5 text-left text-red-500 font-semibold hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
              >
                <Trash2 size={16} /> Delete Post
              </button>
            )}
            <button 
              onClick={() => { setIsMenuOpen(false); handleShare(); }}
              className="w-full px-4 py-2.5 text-left text-neutral-200 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
            >
              <Share2 size={16} /> Share Post
            </button>
            <button 
              onClick={() => {
                setIsMenuOpen(false);
                navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                if (addToast) addToast({ title: 'COPIED', message: 'Link copied', type: 'success' });
              }}
              className="w-full px-4 py-2.5 text-left text-neutral-200 hover:bg-neutral-800 cursor-pointer"
            >
              Copy Link
            </button>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="w-full px-4 py-2 text-left text-neutral-400 hover:bg-neutral-800 border-t border-neutral-800 text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Scrollable Stream */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-neutral-400">
              <Loader2 size={32} className="animate-spin text-sky-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Loading post...</span>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4 text-center p-6">
              <AlertCircle size={36} className="text-red-400" />
              <h3 className="text-base font-bold text-white">{error}</h3>
              <button 
                onClick={onClose}
                className="px-5 py-2 bg-neutral-800 rounded-lg text-xs font-semibold text-white cursor-pointer"
              >
                Go Back
              </button>
            </div>
          ) : post ? (
            <div>
              {/* Author Row */}
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img 
                    src={post.author.avatar || BLANK_DP} 
                    alt={post.author.name} 
                    className="w-8 h-8 rounded-full object-cover border border-neutral-800 flex-shrink-0" 
                  />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-sm text-white truncate max-w-[140px]">
                      {post.author.name}
                    </span>
                    {renderAeirmistVerifiedBadge(post.author.isVerified, post.author.verificationPlan, 13)}
                    {!isOwnPost && (
                      <>
                        <span className="text-neutral-500 text-xs">•</span>
                        <button 
                          onClick={handleFollow}
                          className="text-xs font-semibold text-sky-500 active:opacity-75 cursor-pointer"
                        >
                          {isFollowingAuthor ? 'Following' : 'Follow'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Media Carousel */}
              {mediaList.length > 0 && (
                <div 
                  className="relative w-full aspect-square sm:aspect-[4/5] bg-black overflow-hidden flex items-center justify-center select-none"
                  onDoubleClick={handleDoubleTapMedia}
                >
                  <img 
                    src={mediaList[activeMediaIdx]?.url} 
                    alt="" 
                    aria-hidden="true" 
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-25 scale-110 pointer-events-none" 
                  />

                  {mediaList[activeMediaIdx]?.type === 'video' ? (
                    <VideoPlayer 
                      src={mediaList[activeMediaIdx].url} 
                      className="w-full h-full object-contain relative z-10" 
                      controls 
                      autoPlay 
                      useCache 
                    />
                  ) : (
                    <SafeImage 
                      src={mediaList[activeMediaIdx]?.url} 
                      alt="Post Media" 
                      className="w-full h-full object-contain relative z-10" 
                      referrerPolicy="no-referrer" 
                      useCache 
                    />
                  )}

                  {/* Heart Pop Animation */}
                  <AnimatePresence>
                    {showHeartAnim && (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [0, 1.25, 1], opacity: [0, 1, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.85, ease: 'easeOut' }}
                        className="absolute z-30 pointer-events-none text-white drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]"
                      >
                        <Heart size={84} fill="white" className="text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Multi-image indicators */}
                  {mediaList.length > 1 && (
                    <>
                      {activeMediaIdx > 0 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveMediaIdx(prev => prev - 1); }}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center shadow cursor-pointer"
                        >
                          <ChevronLeft size={18} />
                        </button>
                      )}
                      {activeMediaIdx < mediaList.length - 1 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveMediaIdx(prev => prev + 1); }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center shadow cursor-pointer"
                        >
                          <ChevronRight size={18} />
                        </button>
                      )}
                      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 pointer-events-none">
                        {mediaList.map((_, idx) => (
                          <div 
                            key={idx} 
                            className={`w-1.5 h-1.5 rounded-full ${idx === activeMediaIdx ? 'bg-sky-400 scale-125' : 'bg-white/40'}`} 
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="px-3.5 py-2.5 flex items-center justify-between border-y border-white/5 bg-white/[0.01]">
                <div className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    onClick={handleLike}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-300 active:scale-95 group font-black uppercase text-[10px] tracking-wider cursor-pointer ${
                      isLiked 
                        ? 'bg-aeirmist-magenta/10 border-aeirmist-magenta/30 text-aeirmist-magenta shadow-[0_0_15px_rgba(255,0,234,0.15)]' 
                        : 'bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <Heart size={14} fill={isLiked ? "currentColor" : "none"} className={isLiked ? 'text-aeirmist-magenta' : 'text-current'} />
                    <span>{likesCount.toLocaleString()}</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => mobileInputRef.current?.focus()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all duration-300 active:scale-95 font-black uppercase text-[10px] tracking-wider cursor-pointer"
                  >
                    <MessageCircle size={14} className="text-current" />
                    <span>{comments.length.toLocaleString()}</span>
                  </button>

                  <button 
                    type="button"
                    onClick={handleShare}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 text-white/40 hover:text-white hover:border-white/25 transition-all duration-300 active:scale-95 font-black uppercase text-[10px] tracking-wider group cursor-pointer"
                  >
                    <Share2 size={14} className="transition-transform group-hover:scale-110 group-hover:rotate-12" />
                    <span>SHARE</span>
                  </button>

                  <div className="flex items-center gap-1 px-1.5 py-1 text-white/30">
                    <Eye size={14} className="text-white/20" />
                    <span className="text-[10px] font-bold font-mono">{(post.viewsCount || 0).toLocaleString()}</span>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={handleBookmarkToggle}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-95 border cursor-pointer ${
                    isBookmarked 
                      ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.15)]' 
                      : 'bg-white/5 border-white/5 text-white/30 hover:text-white hover:border-white/25 hover:bg-white/10'
                  }`}
                  title="Save post"
                >
                  <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
                </button>
              </div>

              {/* Likes Count */}
              <div className="px-3.5 font-semibold text-sm text-white">
                {likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}
              </div>

              {/* Caption */}
              {post.content && (
                <div className="px-3.5 py-1.5 text-sm text-neutral-200 leading-snug break-words">
                  <span className="font-semibold text-white mr-1.5">{post.author.name}</span>
                  <span>{post.content}</span>
                </div>
              )}

              {/* Music Player */}
              {post.music && (
                <div className="px-3.5 my-2">
                  <PostMusicPlayer music={post.music} />
                </div>
              )}

              {/* Timestamp */}
              <div className="px-3.5 text-[10.5px] uppercase text-neutral-500 tracking-wider mt-0.5">
                {formattedDate}
              </div>

              {/* Comments Section Title */}
              <div className="px-3.5 pt-4 pb-2 border-t border-neutral-900 mt-3 flex items-center justify-between text-xs text-neutral-400 font-semibold uppercase tracking-wider">
                <span>Comments ({comments.length})</span>
              </div>

              {/* Comments Feed */}
              <div className="px-3.5 space-y-3.5">
                {commentTree.length > 0 ? (
                  commentTree.map(c => {
                    const isCommentLiked = Boolean(profile?.id && c.likedBy?.includes(profile.id));
                    const isCommentOwner = Boolean(profile?.id && c.authorId === profile.id);
                    const repliesCount = c.replies?.length || 0;
                    const showReplies = Boolean(expandedReplies[c.id]);

                    return (
                      <div key={c.id} className="space-y-2">
                        <div className="flex items-start gap-2.5 text-sm">
                          <img 
                            src={getAvatarUrl(c.authorPhoto)} 
                            alt={c.authorName} 
                            className="w-7 h-7 rounded-full object-cover border border-neutral-800 flex-shrink-0" 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-neutral-200 text-xs leading-snug break-words">
                              <span className="font-semibold text-white mr-1.5">{c.authorName}</span>
                              <span>{c.content}</span>
                            </p>
                            <div className="flex items-center gap-3 text-[10px] text-neutral-500 mt-1">
                              <span>{c.createdAt ? formatAeirmistTimestamp(c.createdAt) : 'Just now'}</span>
                              {c.likedBy?.length > 0 && <span>{c.likedBy.length} likes</span>}
                              <button 
                                onClick={() => {
                                  setReplyingTo({ id: c.id, authorName: c.authorName, parentId: c.parentId || c.id });
                                  mobileInputRef.current?.focus();
                                }}
                                className="text-neutral-400 font-semibold cursor-pointer"
                              >
                                Reply
                              </button>
                              {isCommentOwner && (
                                <button onClick={() => handleDeleteComment(c.id)} className="text-neutral-600 active:text-red-400 cursor-pointer">
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleLikeComment(c.id, c.likedBy || [])} 
                            className="p-1 text-neutral-500 cursor-pointer"
                          >
                            <Heart size={12} fill={isCommentLiked ? '#ef4444' : 'none'} className={isCommentLiked ? 'text-red-500' : 'text-neutral-500'} />
                          </button>
                        </div>

                        {/* Nested Replies */}
                        {repliesCount > 0 && (
                          <div className="pl-9 space-y-2">
                            <button 
                              onClick={() => setExpandedReplies(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                              className="flex items-center gap-2 text-[11px] text-neutral-500 font-medium cursor-pointer"
                            >
                              <div className="w-4 h-[1px] bg-neutral-700" />
                              <span>{showReplies ? 'Hide replies' : `View replies (${repliesCount})`}</span>
                            </button>

                            {showReplies && c.replies.map((reply: any) => (
                              <div key={reply.id} className="flex items-start gap-2 text-xs pt-1">
                                <img src={getAvatarUrl(reply.authorPhoto)} alt={reply.authorName} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-neutral-200 text-[11px] leading-snug break-words">
                                    <span className="font-semibold text-white mr-1">{reply.authorName}</span>
                                    {reply.replyToUsername && <span className="text-sky-400 mr-1">@{reply.replyToUsername}</span>}
                                    <span>{reply.content}</span>
                                  </p>
                                  <div className="flex items-center gap-3 text-[9.5px] text-neutral-500 mt-0.5">
                                    <span>{reply.createdAt ? formatAeirmistTimestamp(reply.createdAt) : 'Just now'}</span>
                                    {reply.likedBy?.length > 0 && <span>{reply.likedBy.length} likes</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-neutral-500">
                    No comments yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Fixed Mobile Bottom Comment Input Bar (docked above safe-area) */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-800 px-3 py-2 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          {replyingTo && (
            <div className="flex items-center justify-between text-xs text-sky-400 mb-1.5 px-1">
              <span>Replying to @{replyingTo.authorName}</span>
              <button onClick={() => setReplyingTo(null)} className="text-neutral-400 cursor-pointer">
                <X size={13} />
              </button>
            </div>
          )}
          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2.5">
            <img 
              src={getAvatarUrl(profile?.photoURL)} 
              alt="You" 
              className="w-7 h-7 rounded-full object-cover border border-neutral-800 flex-shrink-0" 
            />
            <input 
              ref={mobileInputRef}
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder={replyingTo ? `Reply to @${replyingTo.authorName}...` : (post ? `Add a comment for @${post.author.name}...` : "Add a comment...")}
              className="bg-neutral-900 border border-neutral-800 rounded-full px-3.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 flex-1 min-w-0"
            />
            <button 
              type="submit"
              disabled={!commentText.trim() || submittingComment}
              className="text-xs font-bold text-sky-500 disabled:opacity-30 p-1 flex-shrink-0 cursor-pointer"
            >
              {submittingComment ? <Loader2 size={14} className="animate-spin" /> : 'Post'}
            </button>
          </form>
        </div>

      </div>

    </motion.div>
  );
};
