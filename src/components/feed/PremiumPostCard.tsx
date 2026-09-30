import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Bookmark, 
  MoreHorizontal, 
  Sparkles, 
  ShieldCheck,
  Compass,
  X,
  Reply,
  Pin,
  Eye,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { formatAeirmistTimestamp } from '../../lib/date';
import { useAeirmist } from '../../context/AeirmistContext';
import { useReport } from '../reporting/ReportContext';
import { getAvatarUrl, BLANK_DP } from '../../lib/avatar';
import { doc, updateDoc, increment, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, getDocs, where } from 'firebase/firestore';
import { Collage, MediaItem } from './Collage';
import { PostMenu } from '../PostMenu';
import { WhyAmISeeingThisModal } from './WhyAmISeeingThisModal';
import { feedRankingService } from '../../services/FeedRankingService';
import { Poll } from './Poll';
import { usePostAnalytics } from '../../hooks/usePostAnalytics';
import { postAnalytics } from '../../services/PostAnalyticsService';
import { writingAssistant } from '../../services/WritingAssistantService';
import { WritingToolsMenu } from '../common/WritingToolsMenu';
import { ModerationWarningModal } from '../common/ModerationWarningModal';
import { MessengerShare } from './MessengerShare';
import { PostMusicPlayer, getPostMusicData } from './PostMusicPlayer';
import { logger } from '@/src/utils/logger';

const InsightsDashboard = React.lazy(() => import('../analytics/InsightsDashboard').then(m => ({ default: m.InsightsDashboard })));

interface PostCardProps {
  onNavigate?: (tab: string, param?: string) => void;
  post: {
    id: string;
    userId?: string;
    authorId?: string;
    userName?: string;
    authorName?: string;
    userAvatar?: string;
    authorAvatar?: string;
    content: string;
    mediaUrl?: string;
    mediaUrls?: string[];
    mediaItems?: any[];
    mediaType?: 'image' | 'video';
    likesCount: number;
    commentsCount: number;
    likedBy?: string[];
    savedBy?: string[];
    isArchived?: boolean;
    createdAt: any;
    timestamp: string;
    location?: string;
    tags?: string[];
    feeling?: { emoji: string; label: string } | null;
    poll?: any;
    viewsCount?: number;
    music?: {
      songId: string;
      title: string;
      artist: string;
    } | null;
    fitMode?: 'contain' | 'cover';
  };
  onUserClick?: (user: any) => void;
  onPostClick?: (postId: string) => void;
}

export const PremiumPostCard = React.memo<PostCardProps>(({ post, onUserClick, onPostClick, onNavigate }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const postTopics = React.useMemo(() => {
    const t: string[] = [];
    if (Array.isArray(post.tags)) post.tags.forEach((tag: any) => typeof tag === 'string' && t.push(tag.replace(/^#/, '')));
    if ((post as any).category) t.push((post as any).category);
    if (post.content) {
      const matches = post.content.match(/#(\w+)/g);
      if (matches) matches.forEach((m: string) => t.push(m.replace('#', '')));
    }
    return Array.from(new Set(t));
  }, [post.tags, (post as any).category, post.content]);
  
  // Voice Simulation Player States
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (voicePlaying) {
      interval = setInterval(() => {
        setVoiceProgress(prev => {
          if (prev >= 100) {
            setVoicePlaying(false);
            return 0;
          }
          return prev + (100 / ((post as any).voice?.duration || 10));
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [voicePlaying, post]);

  const { openReportModal } = useReport();
  const { 
    db, 
    user, 
    profile, 
    toggleLike, 
    toggleBookmark, 
    earnPoints, 
    addToast, 
    createNotification,
    toggleFollow,
    isFollowing,
    toggleBlockUser,
    isBlocked,
    localAvatarURL,
    deletePost,
    archivePost,
    submitReport,
    sendMessage
  } = useAeirmist();

  const postAuthorId = post.userId || post.authorId || (post as any).author?.id || (post as any).author?.uid || (post as any).ownerUid;
  const isOwnPost = Boolean(profile?.id && postAuthorId && (postAuthorId === profile.id || postAuthorId === profile.uid || (user?.uid && postAuthorId === user.uid)));

  const type = (post.mediaItems?.length || 0) > 1 ? 'collage' : (post.mediaItems?.length === 1 ? (post.mediaType || 'photo') : 'text') as any;
  usePostAnalytics({ postId: post.id, type });

  const postMusicData = getPostMusicData(post);

  const isDeletedAuthor = Boolean(
    (post as any).isDeletedAuthor || 
    post.userName === 'Aeirmist User' || 
    post.authorName === 'Aeirmist User' || 
    (post as any).author?.displayName === 'Aeirmist User' || 
    !postAuthorId
  );

  const initialAuthor = {
    name: isDeletedAuthor ? 'Aeirmist User' : (post.userName || post.authorName || (post as any).author?.displayName || 'Aeirmist User'),
    avatar: isDeletedAuthor ? BLANK_DP : getAvatarUrl(isOwnPost ? (localAvatarURL || profile?.photoURL || post.userAvatar || post.authorAvatar || (post as any).author?.photoURL) : (post.userAvatar || post.authorAvatar || (post as any).author?.photoURL)),
    isVerified: isDeletedAuthor ? false : ((post as any).author?.isVerified || false)
  };

  const [author, setAuthor] = useState<any>(initialAuthor);

  // Live profile status check for post author
  useEffect(() => {
    if (!db || !postAuthorId || isDeletedAuthor) return;
    const unsub = onSnapshot(doc(db, 'profiles', postAuthorId), (snap) => {
      if (snap.exists()) {
        const pData = snap.data();
        if (pData.isDeleted === true || pData.status === 'deleted') {
          setAuthor({
            name: 'Aeirmist User',
            avatar: BLANK_DP,
            isVerified: false
          });
        } else {
          setAuthor({
            name: pData.displayName || pData.username || 'Aeirmist User',
            avatar: getAvatarUrl(pData.photoURL),
            isVerified: pData.isVerified || false
          });
        }
      } else {
        setAuthor({
          name: 'Aeirmist User',
          avatar: BLANK_DP,
          isVerified: false
        });
      }
    }, (err) => {
      // Ignored
    });
    return () => unsub();
  }, [db, postAuthorId, isDeletedAuthor]);

  const [liveComments, setLiveComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // States for Post Menu Actions
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content || '');
  const [isHidden, setIsHidden] = useState(false);
  const [isSensitiveRevealed, setIsSensitiveRevealed] = useState(false);
  const [isMessengerShareOpen, setIsMessengerShareOpen] = useState(false);

  const shouldHideSensitive = (post as any).sensitiveWarning && !isSensitiveRevealed && !isOwnPost;

  const handlePin = async () => {
    if (!profile || !db) return;
    const isOwner = postAuthorId === profile.id;
    if (!isOwner) {
      if (addToast) {
        addToast({
          title: 'ACCESS REJECTED',
          message: 'You can only pin your own posts.',
          type: 'warning'
        });
      }
      return;
    }
    try {
      const postRef = doc(db, 'posts', post.id);
      const newPinState = !(post as any).isPinned;
      await updateDoc(postRef, { isPinned: newPinState });
          addToast({
            title: newPinState ? 'Post Pinned' : 'Post Unpinned',
            message: newPinState ? 'Post has been pinned to the top of your profile.' : 'Post has been unpinned.',
            type: 'success'
          });
    } catch (e) {
      logger.error(e);
    }
  };

  const handleEdit = () => {
    const isOwner = postAuthorId === profile?.id;
    if (!isOwner) {
      if (addToast) {
        addToast({
          title: 'ACCESS RESTRICTED',
          message: 'Only the original author can edit this post.',
          type: 'warning'
        });
      }
      return;
    }
    setEditedContent(post.content || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!profile || !db) return;
    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, { content: editedContent });
      setIsEditing(false);
      if (addToast) {
        addToast({
          title: 'Post Updated',
          message: 'Your post has been successfully updated.',
          type: 'success'
        });
      }
    } catch (e) {
      logger.error(e);
      if (addToast) {
        addToast({
          title: 'SYNC ERROR',
          message: 'Could not save edits.',
          type: 'warning'
        });
      }
    }
  };

  const handleFollow = async () => {
    if (!profile || !postAuthorId) return;
    if (postAuthorId === profile.id) {
       if (addToast) {
         addToast({
           title: 'SELF TRANSIT',
           message: 'You cannot follow yourself.',
           type: 'warning'
         });
       }
       return;
    }
    try {
      if (toggleFollow) {
        await toggleFollow(postAuthorId);
        const following = isFollowing ? isFollowing(postAuthorId) : false;
        if (addToast) {
          addToast({
            title: following ? 'Unfollowed' : 'Following',
            message: following 
              ? `You stopped following @${author.name}`
              : `You are now following @${author.name}`,
            type: 'success'
          });
        }
      }
    } catch (e) {
      logger.error(e);
    }
  };

  const handleBlock = async () => {
    if (!profile || !postAuthorId) return;
    if (postAuthorId === profile.id) {
       if (addToast) {
         addToast({
           title: 'OPERATION BLOCKED',
           message: 'You cannot block yourself.',
           type: 'warning'
         });
       }
       return;
    }
    try {
      if (toggleBlockUser) {
        await toggleBlockUser(postAuthorId);
        const blocked = isBlocked ? isBlocked(postAuthorId) : false;
        if (addToast) {
          addToast({
            title: blocked ? 'User Unblocked' : 'User Blocked',
            message: blocked 
              ? `You have unblocked @${author.name}.`
              : `You have blocked @${author.name}.`,
            type: 'success'
          });
        }
      }
    } catch (e) {
      logger.error(e);
    }
  };

  const handleMute = () => {
    if (addToast) {
      addToast({
        title: 'USER MUTED',
        message: `Notifications from @${author.name} silenced.`,
        type: 'success'
      });
    }
  };

  // Advanced Threaded Comment states
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string; parentId: string | null } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedComments, setExpandedComments] = useState<{ [commentId: string]: boolean }>({});
  const [visibleRepliesCount, setVisibleRepliesCount] = useState<{ [commentId: string]: number }>({});
  const [modWarning, setModWarning] = useState<{ isOpen: boolean; reason?: string | null; suggestion?: string | null }>({ isOpen: false });
  const [pendingComment, setPendingComment] = useState<{ type: 'main' | 'reply'; text: string; replyTarget?: any } | null>(null);

  // Helper to format comment time dynamically
  const formatCommentTime = (createdAt: any) => {
    return formatAeirmistTimestamp(createdAt);
  };

  // Convert flat commentary arrays into hierarchical threaded conversations on-the-fly
  const commentTree = React.useMemo(() => {
    const commentMap: { [id: string]: any } = {};
    const tree: any[] = [];

    // Group comments by ID and prepare replies array
    liveComments.forEach(c => {
      commentMap[c.id] = { ...c, replies: [] };
    });

    // Put each comment/reply to its correct parent
    liveComments.forEach(c => {
      const node = commentMap[c.id];
      if (!node.parentId) {
        // This is a top-level comment
        tree.push(node);
      } else {
        // All of them are attached directly to the main parent comment's replies for flat thread rendering
        const mainParent = commentMap[node.parentId];
        if (mainParent) {
          mainParent.replies.push(node);
        } else {
          // Fallback if parent missing
          tree.push(node);
        }
      }
    });

    // Sort replies chronologically to ensure natural sequential conversation flow
    tree.forEach(parent => {
      if (parent.replies && parent.replies.length > 0) {
        parent.replies.sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds || (a.createdAt?.seconds === 0 ? 0 : a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
          const timeB = b.createdAt?.seconds || (b.createdAt?.seconds === 0 ? 0 : b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
          return timeA - timeB;
        });
      }
    });

    return tree;
  }, [liveComments]);

  // Thread controls
  const handleExpandComment = (commentId: string) => {
    setExpandedComments(prev => ({ ...prev, [commentId]: true }));
    setVisibleRepliesCount(prev => ({ ...prev, [commentId]: 5 }));
  };

  const handleShowMoreReplies = (commentId: string) => {
    setVisibleRepliesCount(prev => ({ ...prev, [commentId]: (prev[commentId] || 5) + 5 }));
  };

  const handleCollapseComment = (commentId: string) => {
    setExpandedComments(prev => ({ ...prev, [commentId]: false }));
  };

  // Clipboard copy helper
  const handleCopyComment = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      if (addToast) {
        addToast({
          title: 'COMMENT COPIED',
          message: 'Comment copied to clipboard.',
          type: 'success'
        });
      }
    } catch (e) {
      logger.error(e);
    }
  };

  // Reporting moderator indicator
  const handleReportComment = () => {
    if (addToast) {
      addToast({
        title: 'MODERATION INITIATED',
        message: 'Comment flagged. Sent to moderation team.',
        type: 'success'
      });
    }
  };

  // Exact profile lookup for mapping text mentions
  const lookupProfileByUsername = async (username: string) => {
    if (!db) return null;
    try {
      const q = query(collection(db, 'profiles'), where('username', '==', username.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    } catch (e) {
      logger.error(e);
    }
    return null;
  };

  // Recursive mentions alert notifier helper
  const parseAndNotifyMentions = async (contentStr: string) => {
    if (!profile || !db || !createNotification) return;
    const mentionRegex = /@([a-zA-Z0-9_\-]+)/g;
    let match;
    const usernames: string[] = [];
    while ((match = mentionRegex.exec(contentStr)) !== null) {
      usernames.push(match[1]);
    }
    
    for (const username of usernames) {
      if (username.toLowerCase() === profile.username?.toLowerCase()) continue;
      const p = await lookupProfileByUsername(username);
      if (p) {
        await createNotification(
          p.id,
          'mention',
          `${profile.displayName || profile.username} mentioned you in a comment.`,
          { postId: post.id }
        );
      }
    }
  };

  // Like commentary node in Firestore subcollection
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
        
        // Send like notification to comment author (unless self)
        const commentDoc = liveComments.find(c => c.id === commentId);
        if (commentDoc && commentDoc.authorId !== profile.id && createNotification) {
          await createNotification(
            commentDoc.authorId,
            'comment_like',
            `${profile.displayName || profile.username} liked your comment.`,
            { postId: post.id, commentId }
          );
        }
      }
      await updateDoc(commentDocRef, { likedBy: newLikedBy });
    } catch (err) {
      logger.error("Like comment failed:", err);
    }
  };

  // Purge owned commentary node
  const handleDeleteComment = async (commentId: string) => {
    if (!db) return;
    try {
      const commentDocRef = doc(db, 'posts', post.id, 'comments', commentId);
      await deleteDoc(commentDocRef);
      
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        commentsCount: increment(-1)
      });
      
      if (addToast) {
        addToast({
          title: 'COMMENT DELETED',
          message: 'Comment deleted.',
          type: 'success'
        });
      }
    } catch (e) {
      logger.error("Delete comment failed:", e);
    }
  };

  // Submit nested inline replies
  const handleInlineReplySubmit = async (e?: React.FormEvent, bypassModCheck = false) => {
    if (e) e.preventDefault();
    if (!db || !profile || !replyText.trim() || !replyingTo || submittingComment) return;
    const txt = replyText.trim();
    setReplyText('');
    const replyTarget = replyingTo;
    setReplyingTo(null);
    setSubmittingComment(true);
    
    try {
      const commentsRef = collection(db, 'posts', post.id, 'comments');
      const activeParentId = replyTarget.parentId || replyTarget.id;
      
      const newCommentData = {
        authorId: profile.id,
        authorName: profile.displayName || profile.username,
        authorPhoto: profile.photoURL || '',
        isVerified: profile.isVerified || false,
        content: txt,
        createdAt: serverTimestamp(),
        likedBy: [],
        parentId: activeParentId,       // Grouped by top-level commentary node
        replyToId: replyTarget.id,      // Replied directly to this node's ID
        replyToUsername: replyTarget.authorName // Username of target
      };

      await addDoc(commentsRef, newCommentData);

      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });

      // Expand main thread automatically to view the active reply
      setExpandedComments(prev => ({ ...prev, [activeParentId]: true }));
      setVisibleRepliesCount(prev => ({ 
        ...prev, 
        [activeParentId]: Math.max(prev[activeParentId] || 5, 10) 
      }));

      // Live Notifications trigger
      // 1. Alert the post owner (unless self)
      if (postAuthorId && postAuthorId !== profile.id && createNotification) {
        await createNotification(
          postAuthorId,
          'comment',
          `${profile.displayName || profile.username} commented on your post.`,
          { postId: post.id }
        );
      }

      // 2. Alert the replied comment/reply author (unless self or already post author)
      const targetCommentDoc = liveComments.find(c => c.id === replyTarget.id);
      if (targetCommentDoc && targetCommentDoc.authorId !== profile.id && targetCommentDoc.authorId !== postAuthorId && createNotification) {
        const isReply = !!targetCommentDoc.parentId;
        const notificationType = isReply ? 'reply_to_reply' : 'comment_reply';
        const notificationMsg = isReply 
          ? `${profile.displayName || profile.username} replied to your reply.`
          : `${profile.displayName || profile.username} replied to your comment.`;

        await createNotification(
          targetCommentDoc.authorId,
          notificationType,
          notificationMsg,
          { postId: post.id, commentId: replyTarget.id }
        );
      }

      // 3. Mentions scan
      await parseAndNotifyMentions(txt);

      if (earnPoints) {
        await earnPoints(15);
        if (addToast) {
          addToast({
            title: 'SAVED',
            message: '+15 AP: Your comment has been shared successfully.',
            type: 'success'
          });
        }
      }
    } catch (err) {
      logger.error("Failed to add inline reply:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Auto-load Comments
  useEffect(() => {
    if (!db || !post.id || !showComments) return;
    const commentsRef = collection(db, 'posts', post.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLiveComments(docs);
    });
    return () => unsub();
  }, [db, post.id, showComments]);

  // Submit main comment
  const handleCommentSubmit = async (e?: React.FormEvent, bypassModCheck = false) => {
    if (e) e.preventDefault();
    if (!db || !profile || !commentText.trim() || submittingComment) return;
    const txt = commentText.trim();

    if (!bypassModCheck) {
      const moderation = await writingAssistant.moderateText(txt);
      if (moderation.isSpam) {
        if (addToast) {
          addToast({
            title: 'COMMENT BLOCKED',
            message: moderation.reason || 'Comment blocked: detected spam or link pattern.',
            type: 'warning'
          });
        }
        return;
      }

      if (moderation.isAbusive) {
        setPendingComment({ type: 'main', text: txt });
        setModWarning({
          isOpen: true,
          reason: moderation.reason,
          suggestion: moderation.suggestion
        });
        return;
      }
    }

    setCommentText('');
    setSubmittingComment(true);
    try {
      const commentsRef = collection(db, 'posts', post.id, 'comments');
      await addDoc(commentsRef, {
        authorId: profile.id,
        authorName: profile.displayName || profile.username,
        authorPhoto: profile.photoURL || '',
        isVerified: profile.isVerified || false,
        content: txt,
        likedBy: [],
        parentId: null, // Top-level commentary wave
        createdAt: serverTimestamp()
      });

      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });

      // Notify post author (unless self)
      if (postAuthorId && postAuthorId !== profile.id && createNotification) {
        await createNotification(
          postAuthorId,
          'comment',
          `${profile.displayName || profile.username} commented on your post.`,
          { postId: post.id }
        );
      }

      // Mentions scan
      await parseAndNotifyMentions(txt);

      if (earnPoints) {
        await earnPoints(15);
        if (addToast) {
          addToast({
            title: 'SAVED',
            message: '+15 AP: Your feedback node has shared successfully.',
            type: 'success'
          });
        }
      }
    } catch (err) {
      logger.error("Failed to add comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Fetch Author profile (including photo/avatar) dynamically
  useEffect(() => {
    if (!db || !postAuthorId) return;
    
    // Use one-time getDoc fetch to avoid listener quota exhaustion in high-traffic feed
    getDoc(doc(db, 'profiles', postAuthorId)).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAuthor({
          name: data.displayName || data.username || 'Aeirmist User',
          avatar: getAvatarUrl(data.photoURL),
          isVerified: !!data.isVerified
        });
      }
    }).catch((err) => {
      logger.warn("Author profile fetch failed:", err);
    });
  }, [postAuthorId, db]);

  // Sync like and bookmark indicators
  useEffect(() => {
    if (profile) {
      if (post.likedBy) {
        setIsLiked(post.likedBy.includes(profile.id));
      }
      if (post.savedBy) {
        setIsBookmarked(post.savedBy.includes(profile.id));
      }
    }
  }, [profile, post.likedBy, post.savedBy]);

  const handleLike = async () => {
    if (!profile || !db) return;
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    try {
      await toggleLike(post.id, isLiked);
    } catch (e) {
      setIsLiked(!newLikedState);
      logger.error("Like failed", e);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!profile || !db) return;
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);
    try {
      await toggleBookmark(post.id, isBookmarked);
      if (newBookmarkState && addToast) {
        addToast({
          title: 'SAVED',
          message: '+5 AP: Saved to your Private Folder.',
          type: 'success'
        });
      }
    } catch (e) {
      setIsBookmarked(!newBookmarkState);
      logger.error("Bookmark toggle failed", e);
    }
  };

  const handleDeletePost = async () => {
    if (!profile || !db) return;
    const isOwner = postAuthorId === profile.id;
    if (!isOwner) {
      if (addToast) {
        addToast({
          title: 'ACCESS REJECTED',
          message: 'You do not have permission to delete this post.',
          type: 'warning'
        });
      }
      return;
    }

    try {
      await deletePost(post.id);
      if (addToast) {
        addToast({
          title: 'POST DELETED',
          message: 'Your post has been deleted.',
          type: 'success'
        });
      }
    } catch (e) {
      logger.error(e);
      if (addToast) {
        addToast({
          title: 'DELETE FAILED',
          message: 'Could not delete post. Try again later.',
          type: 'warning'
        });
      }
    }
  };

  const handleArchivePost = async () => {
    if (!profile || !db) return;
    const isOwner = postAuthorId === profile.id;
    if (!isOwner) return;
    const newArchiveState = !post.isArchived;
    try {
      await archivePost(post.id, newArchiveState);
      if (addToast) {
        addToast({
          title: newArchiveState ? 'POST ARCHIVED' : 'POST RESTORED',
          message: newArchiveState 
            ? 'Your post has been successfully filed into the Archives.'
            : 'Your post has been restored to the timeline.',
          type: 'success'
        });
      }
    } catch (e) {
      logger.error(e);
    }
  };

  const handleMoveToVaultAction = async () => {
    if (!db || !profile || !isOwnPost) {
      if (addToast && !isOwnPost) {
        addToast({ title: 'ACCESS DENIED', message: 'You can only vault your own content.', type: 'warning' });
      }
      return;
    }
    try {
      if (collageItems && collageItems.length > 0) {
        // Move each media item to vault_media with post text content attached
        for (const item of collageItems) {
          await addDoc(collection(db, 'vault_media'), {
            userId: profile.id,
            url: item.url,
            type: item.type || 'image',
            name: `Vaulted Post from @${post.authorName || post.userName || 'User'}`,
            content: post.content || '',
            createdAt: serverTimestamp(),
            isFavorite: false
          });
        }
      } else {
        // Text-only post or single media fallback
        const mediaUrl = post.mediaUrl || (post as any).mediaURL || (post.mediaUrls && post.mediaUrls[0]) || '';
        const mediaType = (post as any).mediaType || (mediaUrl ? 'image' : 'text');
        
        await addDoc(collection(db, 'vault_media'), {
          userId: profile.id,
          url: mediaUrl,
          type: mediaType,
          content: post.content || '',
          name: post.content ? (post.content.length > 30 ? post.content.slice(0, 30) + '...' : post.content) : `Vaulted Post from @${post.authorName || post.userName || 'User'}`,
          createdAt: serverTimestamp(),
          isFavorite: false
        });
      }

      // Delete original post
      await deletePost(post.id);
      
      if (addToast) {
        addToast({ title: 'SECURED', message: 'Post content has been moved to Secure Vault.', type: 'success' });
      }
    } catch (e) {
      logger.error("Vault move failed", e);
      if (addToast) {
        addToast({ title: 'MOVE FAILED', message: 'Error during vault transfer.', type: 'warning' });
      }
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    const shareData = {
      title: `Post by ${author.name}`,
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
        if (addToast) {
          addToast({
            title: 'Link Copied',
            message: 'Post link copied to clipboard.',
            type: 'success'
          });
        }
      } catch (err) {
        logger.error("Clipboard copy failed:", err);
      }
    }
    await earnPoints(5);
  };

  const handleShareToMessenger = async (chatId: string) => {
    if (!sendMessage || !profile) return;
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    await sendMessage(chatId, `Shared a post: ${shareUrl}`, 'text');
    await earnPoints(5);
  };

  // Mixed Media Collage Array Creator
  const rawImages = post.mediaUrls && post.mediaUrls.length > 0 
    ? post.mediaUrls 
    : (post.mediaUrl ? [post.mediaUrl] : []);

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    return (
      url.includes('/video/upload/') ||
      /\.(mp4|webm|mov|m4v|ogg|mkv)(\?.*)?$/i.test(url)
    );
  };

  const isPostVideo = post.mediaType === 'video' || (post as any).type === 'video';

  const collageItems: MediaItem[] = post.mediaItems || rawImages.map((url, index) => ({
    url,
    type: (isPostVideo || isVideoUrl(url)) ? 'video' : 'image'
  }));

  const postCaption = post.content || (post as any).caption || (post as any).text || (post as any).description || (post as any).title || '';

  const hasMedia = collageItems.length > 0;
  const isShortTextOnly = !hasMedia && postCaption && postCaption.length < 130 && (post as any).gradientId !== 'plain';

  // Highlights Hashtags and Mentions elegantly
  const renderParsedContent = (text: string, isLarge: boolean = false) => {
    if (!text) return null;
    const words = text.split(/(\s+)/);
    return words.map((word, i) => {
      if (word.startsWith('#')) {
        return (
          <span 
            key={i} 
            className={`text-aeirmist-cyan font-black tracking-tight select-all drop-shadow-[0_0_10px_rgba(0,242,255,0.4)] hover:brightness-125 hover:underline cursor-pointer ${
              isLarge ? 'text-lg sm:text-2xl' : 'text-xs sm:text-sm'
            }`}
          >
            {word}
          </span>
        );
      }
      if (word.startsWith('@')) {
        return (
          <span 
            key={i} 
            className={`text-[#ff00a0] font-black tracking-tight select-all drop-shadow-[0_0_10px_rgba(255,0,160,0.4)] hover:brightness-125 hover:underline cursor-pointer ${
              isLarge ? 'text-lg sm:text-2xl' : 'text-xs sm:text-sm'
            }`}
          >
            {word}
          </span>
        );
      }
      return <span key={i}>{word}</span>;
    });
  };

  // Define recursive threaded comment card renderer
  const renderCommentNode = (node: any, depth: number = 0) => {
    const isCommentLiked = node.likedBy?.includes(profile?.id) || false;
    const likesCount = node.likedBy?.length || 0;
    const isOwnComment = node.authorId === profile?.id;
    
    return (
      <div key={node.id} className="group/comment relative mt-4">
        <div className="flex gap-3 justify-between items-start text-xs bg-white/[0.015] border border-white/[0.03] backdrop-blur-md p-3.5 rounded-2xl hover:bg-white/[0.02] transition-all duration-300 relative">
          
          <div className="flex gap-2.5 items-start text-left w-full">
            <img 
              src={getAvatarUrl(isOwnComment ? (localAvatarURL || profile?.photoURL || node.authorPhoto) : node.authorPhoto)} 
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover bg-neutral-900 shrink-0 border border-white/10 shadow-lg" 
              referrerPolicy="no-referrer"
              alt="" 
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-white text-[11px] sm:text-xs">@{node.authorName}</span>
                {node.isVerified && (
                  <ShieldCheck size={10} className="text-aeirmist-cyan shrink-0" />
                )}
                <span className="text-[9px] text-white/40 font-mono tracking-wider ml-auto shrink-0">
                  {node.createdAt ? formatCommentTime(node.createdAt) : 'Syncing'}
                </span>
              </div>
              
              <p className="text-white/85 font-medium select-text text-[11px] sm:text-xs leading-relaxed mt-1 whitespace-pre-wrap break-words">
                {node.content}
              </p>

              {/* Engagement Row */}
              <div className="flex items-center gap-4 mt-2.5 select-none flex-wrap">
                {/* Liking */}
                <button 
                  type="button"
                  onClick={() => handleLikeComment(node.id, node.likedBy || [])}
                  className={`flex items-center gap-1.5 transition-colors font-bold text-[9px] uppercase tracking-wider ${
                    isCommentLiked ? 'text-aeirmist-magenta' : 'text-white/40 hover:text-white'
                  }`}
                >
                  <Heart size={11} fill={isCommentLiked ? "currentColor" : "none"} className="shrink-0" />
                  <span>{likesCount > 0 ? likesCount : 'Like'}</span>
                </button>

                {/* Replying */}
                <button 
                  type="button"
                  onClick={() => setReplyingTo({ id: node.id, authorName: node.authorName, parentId: node.id })}
                  className="flex items-center gap-1 text-white/40 hover:text-aeirmist-cyan transition-colors font-bold text-[9px] uppercase tracking-wider"
                >
                  <Reply size={11} className="shrink-0" />
                  <span>Reply</span>
                </button>

                {/* Actions */}
                <button 
                  type="button"
                  onClick={() => handleCopyComment(node.content)}
                  className="text-white/30 hover:text-white transition-colors text-[9px] font-bold uppercase tracking-wider"
                >
                  Copy
                </button>

                <button 
                  type="button"
                  onClick={handleReportComment}
                  className="text-white/30 hover:text-aeirmist-magenta transition-colors text-[9px] font-bold uppercase tracking-wider"
                >
                  Report
                </button>

                {/* Self Purging */}
                {isOwnComment && (
                  <button 
                    type="button"
                    onClick={() => handleDeleteComment(node.id)}
                    className="text-white/30 hover:text-red-500 transition-colors text-[9px] font-bold uppercase tracking-wider ml-auto"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Inline Threaded Reply Form */}
        {replyingTo?.id === node.id && (
          <div className="mt-2.5 p-3.5 bg-white/[0.015] border border-white/5 rounded-xl ml-4 sm:ml-8 transition-all duration-300">
            <div className="flex justify-between items-center mb-2 select-none">
              <span className="text-[9px] font-extrabold text-[#00f3ff] tracking-wider flex items-center gap-1">
                <Reply size={10} className="text-aeirmist-cyan" />
                REPLYING TO @{node.authorName}
              </span>
            </div>
            <form onSubmit={handleInlineReplySubmit} className="flex flex-col gap-2">
              <input 
                type="text" 
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Type your reply to @${node.authorName}...`} 
                className="flex-1 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-aeirmist-cyan transition-all placeholder:text-white/20 font-medium text-white text-left" 
                autoFocus
              />
              <div className="flex gap-2 justify-end select-none">
                <button 
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="px-3 py-1.5 border border-white/5 text-white/50 font-black uppercase text-[8px] tracking-wider hover:text-white hover:bg-white/5 rounded-lg transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!replyText.trim() || submittingComment}
                  className="px-3.5 py-1.5 bg-white text-black font-black uppercase text-[8px] tracking-wider hover:bg-aeirmist-cyan disabled:bg-white/10 disabled:text-white/20 rounded-lg transition-all active:scale-95 shrink-0"
                >
                  Transmit
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Flat Threaded Replies Integration */}
        {node.replies && node.replies.length > 0 && (
          <div className="mt-1">
            {!expandedComments[node.id] ? (
              <button 
                type="button"
                onClick={() => handleExpandComment(node.id)}
                className="text-[10px] sm:text-[11px] text-aeirmist-cyan/80 hover:text-aeirmist-cyan font-black uppercase tracking-wider flex items-center gap-1.5 ml-4 sm:ml-8 mt-2 py-1 select-none cursor-pointer"
              >
                <span>▼ View {node.replies.length} {node.replies.length === 1 ? 'Reply' : 'Replies'}</span>
              </button>
            ) : (
              <div className="relative mt-2.5 ml-5 sm:ml-7 pl-4 sm:pl-6 border-l border-white/10 space-y-3.5">
                {node.replies.slice(0, visibleRepliesCount[node.id] || 5).map((reply: any) => {
                  const isReplyLiked = reply.likedBy?.includes(profile?.id) || false;
                  const isOwnReply = reply.authorId === profile?.id;
                  
                  return (
                    <div key={reply.id} className="relative group/reply flex gap-2.5 items-start bg-white/[0.012] border border-white/[0.02] hover:bg-white/[0.025] p-3 rounded-xl transition-all duration-300">
                      {/* Left horizontal connector indicator branch */}
                      <span className="absolute left-[-17px] sm:left-[-25px] top-[22px] w-[17px] sm:w-[25px] border-t border-white/10 pointer-events-none" />

                      <img 
                        src={getAvatarUrl(reply.authorPhoto)} 
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-cover bg-neutral-900 shrink-0 border border-white/10 shadow-sm" 
                        referrerPolicy="no-referrer"
                        alt="" 
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-white text-[10px] sm:text-[11px]">@{reply.authorName}</span>
                          {reply.isVerified && (
                            <ShieldCheck size={8} className="text-aeirmist-cyan shrink-0" />
                          )}
                          {reply.replyToUsername && (
                            <span className="text-[9px] text-white/40 font-bold">
                              replying to <span className="text-aeirmist-cyan">@{reply.replyToUsername}</span>
                            </span>
                          )}
                          <span className="text-[9px] text-white/30 font-mono tracking-wider ml-auto shrink-0">
                            {reply.createdAt ? formatCommentTime(reply.createdAt) : 'Syncing'}
                          </span>
                        </div>
                        
                        <p className="text-white/70 font-medium select-text text-[10px] sm:text-xs leading-relaxed mt-1 whitespace-pre-wrap break-words">
                          {reply.content}
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 select-none flex-wrap">
                          {/* Like Reply */}
                          <button 
                            type="button"
                            onClick={() => handleLikeComment(reply.id, reply.likedBy || [])}
                            className={`flex items-center gap-1 transition-colors font-bold text-[8px] uppercase tracking-wider ${
                              isReplyLiked ? 'text-aeirmist-magenta' : 'text-white/30 hover:text-white'
                            }`}
                          >
                            <Heart size={9} fill={isReplyLiked ? "currentColor" : "none"} className="shrink-0" />
                            <span>{reply.likedBy?.length > 0 ? reply.likedBy.length : 'Like'}</span>
                          </button>

                          {/* Reply to Reply */}
                          <button 
                            type="button"
                            onClick={() => setReplyingTo({ id: reply.id, authorName: reply.authorName, parentId: node.id })}
                            className="flex items-center gap-0.5 text-white/30 hover:text-aeirmist-cyan transition-colors font-bold text-[8px] uppercase tracking-wider relative group"
                          >
                            <Reply size={9} className="shrink-0" />
                            <span>Reply</span>
                          </button>

                          {/* Copy Content */}
                          <button 
                            type="button"
                            onClick={() => handleCopyComment(reply.content)}
                            className="text-white/20 hover:text-white transition-colors text-[8px] font-bold uppercase tracking-wider"
                          >
                            Copy
                          </button>

                          {/* Report */}
                          <button 
                            type="button"
                            onClick={handleReportComment}
                            className="text-white/20 hover:text-aeirmist-magenta transition-colors text-[8px] font-bold uppercase tracking-wider"
                          >
                            Report
                          </button>

                          {/* Delete Own Reply */}
                          {isOwnReply && (
                            <button 
                              type="button"
                              onClick={() => handleDeleteComment(reply.id)}
                              className="text-white/20 hover:text-red-500 transition-colors text-[8px] font-bold uppercase tracking-wider ml-auto"
                            >
                              Delete
                            </button>
                          )}
                        </div>

                        {/* Inline Reply Box under the Reply Row */}
                        {replyingTo?.id === reply.id && (
                          <div className="mt-2.5 p-2 bg-white/[0.015] border border-white/5 rounded-xl transition-all duration-300">
                            <div className="flex justify-between items-center mb-1.5 select-none">
                              <span className="text-[9px] font-extrabold text-[#00f3ff] tracking-wider flex items-center gap-1">
                                <Reply size={9} />
                                REPLYING TO @{reply.authorName}
                              </span>
                            </div>
                            <form onSubmit={handleInlineReplySubmit} className="flex flex-col gap-1.5">
                              <input 
                                type="text" 
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder={`Type your reply to @${reply.authorName}...`} 
                                className="bg-white/5 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px] focus:outline-none focus:border-aeirmist-cyan transition-all placeholder:text-white/20 font-medium text-white text-left" 
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end select-none">
                                <button 
                                  type="button"
                                  onClick={() => setReplyingTo(null)}
                                  className="px-2 py-1 text-white/50 font-black uppercase text-[7px] tracking-wider hover:text-white hover:bg-white/5 rounded transition-all active:scale-95"
                                >
                                  Cancel
                                </button>
                                <button 
                                  type="submit"
                                  disabled={!replyText.trim() || submittingComment}
                                  className="px-2.5 py-1 bg-white text-black font-black uppercase text-[7px] tracking-wider hover:bg-aeirmist-cyan disabled:bg-white/10 disabled:text-white/20 rounded transition-all active:scale-95 shrink-0"
                                >
                                  Transmit
                                </button>
                              </div>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* See More vs Collapse controls */}
                <div className="flex gap-4 mt-2 select-none items-center pl-1">
                  {node.replies.length > (visibleRepliesCount[node.id] || 5) && (
                    <button 
                      type="button"
                      onClick={() => handleShowMoreReplies(node.id)}
                      className="text-[9px] sm:text-[10px] text-aeirmist-cyan/70 hover:text-aeirmist-cyan font-black uppercase tracking-wider py-1 cursor-pointer"
                    >
                      See More Replies
                    </button>
                  )}
                  
                  <button 
                    type="button"
                    onClick={() => handleCollapseComment(node.id)}
                    className="text-[9px] sm:text-[10px] text-white/30 hover:text-white font-black uppercase tracking-wider py-1 cursor-pointer"
                  >
                    ▲ Hide Replies
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Sidebar for Lightbox
  const renderLightboxSidebar = () => {
    return (
      <div className="flex flex-col h-full bg-[#050505] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/5 bg-[#080808]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl overflow-hidden cursor-pointer bg-white/5 border border-white/10"
                onClick={() => onUserClick?.(postAuthorId)}
              >
                <img src={author.avatar} alt={author.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">{author.name}</h3>
                  {author.isVerified && <ShieldCheck size={10} className="text-aeirmist-cyan shrink-0" />}
                </div>
                <span className="text-[9px] font-mono text-white/30 font-bold uppercase tracking-widest">{post.timestamp}</span>
              </div>
            </div>
            
            {!isOwnPost && (
              <button 
                onClick={handleFollow}
                className="px-3 py-1.5 rounded-lg bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan text-[8px] font-black uppercase tracking-widest hover:bg-aeirmist-cyan hover:text-black transition-all"
              >
                {isFollowing?.(postAuthorId) ? 'Unfollow' : 'Follow'}
              </button>
            )}
          </div>
          
          {/* Post Content */}
          <div className="mt-4">
            <p className="text-[11px] leading-relaxed text-white/80 font-medium whitespace-pre-wrap">{post.content}</p>
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {post.tags.map(tag => (
                  <span key={tag} className="text-[8px] font-bold text-aeirmist-cyan bg-aeirmist-cyan/5 px-1.5 py-0.5 rounded uppercase tracking-widest">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Interactions ({post.commentsCount})</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Heart size={12} className={isLiked ? "text-aeirmist-magenta" : "text-white/20"} />
                <span className="text-[10px] font-mono text-white/40">{post.likesCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageSquare size={12} className="text-white/20" />
                <span className="text-[10px] font-mono text-white/40">{post.commentsCount}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {commentTree.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center opacity-20">
                <MessageSquare size={32} strokeWidth={1} />
                <p className="text-[8px] font-black uppercase tracking-[0.2em] mt-3">No resonance detected</p>
              </div>
            ) : (
              commentTree.map(comment => renderCommentNode(comment, 0))
            )}
          </div>
        </div>

        {/* Footer / Input */}
        <div className="p-4 sm:p-5 bg-[#080808] border-t border-white/5">
          <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1">
            {['❤️', '🔥', '👍', '✨', '😂', '💀', '👽'].map(emoji => (
              <button 
                type="button"
                key={emoji}
                onClick={() => setCommentText(prev => prev + emoji)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-sm active:scale-90 transition-transform shrink-0"
              >
                {emoji}
              </button>
            ))}
          </div>
          
          <form onSubmit={handleCommentSubmit} className="flex gap-2 items-center">
            <input 
              type="text" 
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Post your resonance..." 
              disabled={submittingComment}
              className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-aeirmist-cyan transition-all placeholder:text-white/20 font-bold text-white" 
            />
            <button 
              type="submit"
              disabled={!commentText.trim() || submittingComment}
              className="w-10 h-10 bg-aeirmist-cyan text-black rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
            >
              <Compass size={16} />
            </button>
          </form>
        </div>
      </div>
    );
  };

  if (isHidden) {
    return (
      <motion.div 
        initial={{ opacity: 1, scale: 1, height: 'auto' }}
        animate={{ opacity: 0, scale: 0.95, height: 0 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        className="overflow-hidden pb-0 mb-0 pointer-events-none select-none"
      >
        <div className="p-5 text-center bg-[#ff00ea]/5 border border-[#ff00ea]/10 rounded-2xl md:rounded-[2.2rem] text-[9px] font-mono uppercase tracking-widest text-white/30 mb-4 sm:mb-6">
          ⚠️ Connection Ignored • Content Stream Occluded
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      id={`post-${post.id}`}
      initial={{ opacity: 0, scale: 0.98, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-panel rounded-2xl sm:rounded-[2rem] border-white/5 bg-black/40 overflow-hidden mb-2 sm:mb-3 group shadow-2xl hover:border-white/10 transition-all duration-500 text-left relative"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-aeirmist-cyan/5 blur-2xl rounded-full pointer-events-none" />

      {/* Header Info */}
      <div className="p-3 sm:p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 overflow-hidden min-w-0 flex-1">
          <button 
            type="button"
            role="link"
            aria-label={`View profile of ${author.name}`}
            className={`relative group/avatar ${isDeletedAuthor || author.name === 'Aeirmist User' ? 'cursor-default' : 'cursor-pointer'} shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan rounded-xl`}
            onClick={() => {
              if (isDeletedAuthor || author.name === 'Aeirmist User') {
                addToast?.({ title: 'Unavailable', message: 'This account is unavailable on Aeirmist.', type: 'info' });
                return;
              }
              postAnalytics.trackProfileClick(post.id);
              onUserClick?.({ id: postAuthorId, displayName: author.name, photoURL: author.avatar });
            }}
          >
            <img 
              src={author.avatar || BLANK_DP} 
              alt={author.name} 
              loading="lazy" 
              referrerPolicy="no-referrer" 
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover bg-neutral-900 border border-white/10 shadow-sm transition-transform duration-200 group-hover/avatar:scale-105" 
            />
            
            {!(isDeletedAuthor || author.name === 'Aeirmist User') && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-aeirmist-cyan rounded-full border-2 border-[#000d1c] shadow-[0_0_8px_#00f2ff]" />
            )}
          </button>
          
          <div className={`${isDeletedAuthor || author.name === 'Aeirmist User' ? 'cursor-default' : 'cursor-pointer'} text-left min-w-0`} onClick={() => {
            if (isDeletedAuthor || author.name === 'Aeirmist User') {
              addToast?.({ title: 'Unavailable', message: 'This account is unavailable on Aeirmist.', type: 'info' });
              return;
            }
            postAnalytics.trackProfileClick(post.id);
            onUserClick?.({ id: postAuthorId, displayName: author.name, photoURL: author.avatar });
          }}>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-none">
              <h3 className="text-xs sm:text-sm font-black text-white hover:text-aeirmist-cyan transition-colors flex items-center gap-1.5 truncate">
                {author.name}
                {author.isVerified && <ShieldCheck size={11} className="text-aeirmist-cyan shrink-0 sm:w-[13px] sm:h-[13px]" />}
                {(post as any).isPinned && <Pin size={10} className="text-aeirmist-cyan rotate-45 animate-pulse sm:w-[11px] sm:h-[11px]" />}
              </h3>
              {post.feeling && (
                <span className="text-[9px] sm:text-[11px] text-white/50 tracking-tight flex items-center gap-1 font-medium font-sans truncate">
                  <span className="hidden sm:inline">is feeling</span> <span className="text-aeirmist-cyan font-bold inline-flex items-center gap-0.5">{post.feeling.emoji} {post.feeling.label}</span>
                </span>
              )}
            </div>
            
            {postMusicData ? (
              <PostMusicPlayer music={postMusicData} variant="header-sub" />
            ) : (
              <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.1em] text-white/20 mt-0.5 flex items-center gap-1 select-none font-mono truncate">
                {post.location ? (
                  <>
                    <Compass size={9} className="text-white/30 sm:w-[10px] sm:h-[10px]" />
                    {post.location} • 
                  </>
                ) : null}
                {formatAeirmistTimestamp(post.createdAt || post.timestamp)}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Post Hamburger Dropdown */}
          <button 
            type="button"
            aria-label="Post options"
            aria-expanded={isMenuOpen}
            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(true); }}
            className="p-1.5 sm:p-2.5 rounded-xl bg-white/5 border border-white/5 text-white/30 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan"
          >
            <MoreHorizontal size={14} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>

        <PostMenu 
          isOpen={isMenuOpen} 
          onClose={() => setIsMenuOpen(false)} 
          postId={post.id}
          authorId={postAuthorId}
          authorName={author.name}
          topics={postTopics}
          isOwnPost={!!isOwnPost}
          isSaved={isBookmarked}
          onSave={handleBookmarkToggle}
          onViewInsights={() => setShowInsights(true)}
          onReport={() => openReportModal('post', post.id, postAuthorId)}
          onPin={handlePin}
          onEdit={handleEdit}
          onFollow={handleFollow}
          isFollowingCreator={isFollowing ? isFollowing(postAuthorId) : false}
          isBlockedCreator={isBlocked ? isBlocked(postAuthorId) : false}
          onBlock={handleBlock}
          onMute={handleMute}
          onHide={() => setIsHidden(true)}
          onDelete={handleDeletePost}
          isArchived={!!post.isArchived}
          onArchive={handleArchivePost}
          onMoveToVault={handleMoveToVaultAction}
          onWhyAmISeeingThis={() => setShowWhyModal(true)}
          onShowLess={() => {
            if (postAuthorId) feedRankingService.recordNegativeFeedback(postAuthorId, 1);
            if (addToast) addToast({ title: 'Preferences Updated', message: `Showing less from @${author.name}`, type: 'info' });
          }}
          onNotInterested={() => {
            if (postAuthorId) feedRankingService.recordNegativeFeedback(postAuthorId, 2);
            setIsHidden(true);
            if (addToast) addToast({ title: 'Post Removed', message: 'Tuning your feed recommendations.', type: 'info' });
          }}
          onMuteTopic={(topic) => {
            feedRankingService.muteTopic(topic);
            setIsHidden(true);
            if (addToast) addToast({ title: `Muted #${topic}`, message: `Posts tagged #${topic} will be hidden.`, type: 'info' });
          }}
        />

        <WhyAmISeeingThisModal
          isOpen={showWhyModal}
          onClose={() => setShowWhyModal(false)}
          post={post}
          rankingReason={(post as any)._rankingReason}
          onShowLess={() => {
            if (postAuthorId) feedRankingService.recordNegativeFeedback(postAuthorId, 1);
            if (addToast) addToast({ title: 'Preferences Updated', message: `Showing less from @${author.name}`, type: 'info' });
          }}
          onMuteCreator={() => {
            if (postAuthorId) feedRankingService.muteCreator(postAuthorId);
            setIsHidden(true);
            if (addToast) addToast({ title: `Muted @${author.name}`, message: `Posts from this creator are hidden.`, type: 'info' });
          }}
        />
      </div>

      {/* Dynamic Styled content (Edit Mode or Regular-Text/Gradient Backplate) */}
      <div className="relative">
        {shouldHideSensitive && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center border-y border-white/5">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 animate-pulse">
              <AlertTriangle size={32} />
            </div>
            <h4 className="text-sm font-black uppercase tracking-widest text-white mb-2">Sensitive Post</h4>
            <p className="text-[10px] text-white/40 uppercase tracking-widest leading-loose max-w-[240px] mb-6">
              This node has been flagged with sensitive frequency patterns by the broadcaster.
            </p>
            <button 
              onClick={() => setIsSensitiveRevealed(true)}
              className="px-6 py-2.5 bg-white text-black text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-aeirmist-cyan transition-all active:scale-95 cursor-pointer shadow-lg"
            >
              Decode Signal
            </button>
          </div>
        )}

        <div className={shouldHideSensitive ? 'blur-2xl pointer-events-none select-none opacity-20' : ''}>
          {isEditing ? (
            <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-left flex flex-col gap-3 relative z-10">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition-all font-semibold resize-none"
                rows={4}
                placeholder="Edit post..."
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-white/50 text-[10px] font-black uppercase tracking-wider hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded-xl bg-aeirmist-cyan text-black text-[10px] font-black uppercase tracking-wider hover:bg-aeirmist-cyan/80 transition-all cursor-pointer font-sans shadow-[0_0_15px_rgba(0,242,255,0.3)]"
                >
                  Save Stream
                </button>
              </div>
            </div>
          ) : postCaption ? (
            <div onClick={() => onPostClick?.(post.id)} className="cursor-pointer">
              {isShortTextOnly ? (
                <div className="px-5 py-8 sm:px-8 sm:py-12 text-center bg-gradient-to-br from-[#0c1322] via-[#050912] to-[#120822] border-y border-white/5 relative flex flex-col items-center justify-center min-h-[160px] sm:min-h-[200px]">
                  <div className="absolute inset-0 bg-grid-pattern opacity-[0.04]" />
                  <p className="text-base sm:text-2xl font-black text-white leading-relaxed tracking-tight select-text text-center relative z-10 font-display drop-shadow-[0_2px_12px_rgba(255,255,255,0.1)]">
                    {renderParsedContent(postCaption, true)}
                  </p>
                </div>
              ) : (
                <div className="px-5 pb-3 sm:px-6 sm:pb-3.5 text-left">
                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-medium tracking-wide whitespace-pre-line">
                    {renderParsedContent(postCaption, false)}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* Interactive premium Voice Note Player for recorded audio */}
          {(post as any).voice && (
            <div className="mx-4 sm:mx-6 mb-4 p-3 sm:p-4 rounded-2xl bg-[#00f3ff]/5 border border-[#00f3ff]/15 flex items-center justify-between gap-4 select-none">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button 
                  type="button"
                  aria-label={voicePlaying ? "Pause voice note" : "Play voice note"}
                  aria-pressed={voicePlaying}
                  onClick={() => {
                    setVoicePlaying(!voicePlaying);
                    if (!voicePlaying) setVoiceProgress(0);
                  }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan ${
                    voicePlaying 
                      ? 'bg-[#00f3ff] text-black shadow-[0_0_15px_rgba(0,242,255,0.4)]' 
                      : 'bg-white/5 text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {voicePlaying ? (
                    <span className="flex gap-0.5 items-center justify-center">
                      <span className="w-1 h-3 bg-black rounded-full" />
                      <span className="w-1 h-3 bg-black rounded-full" />
                    </span>
                  ) : (
                    <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-8 border-l-current ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-[7.5px] sm:text-[8px] font-mono font-black tracking-widest text-[#00f3ff] uppercase">Vocal Spectrum Stream</div>
                  
                  {/* Pulsing customizable equalizing bars */}
                  <div className="flex gap-0.5 items-center h-5 mt-1 bg-black/10 px-2 rounded-lg py-1 border border-white/[0.02]">
                    {((post as any).voice.waveform || Array.from({ length: 24 })).map((h: number, idx: number) => {
                      const isActive = (idx / 24) * 100 <= voiceProgress;
                      return (
                        <span 
                          key={idx} 
                          style={{ height: `${Math.max(4, h ? (h % 16) + 3 : Math.random() * 12 + 4)}px` }}
                          className={`w-[1.5px] rounded-full transition-colors ${
                            isActive 
                              ? 'bg-[#00f3ff] shadow-[0_0_8px_rgba(0,242,255,0.6)]' 
                              : 'bg-white/15'
                          }`} 
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="text-[8px] font-mono text-white/30 shrink-0 font-bold uppercase tracking-wider">
                {voicePlaying ? `Playing` : `${(post as any).voice.duration}s Link`}
              </div>
            </div>
          )}

          {/* Interactive holographic live stream replay block */}
          {(post as any).liveReplay && (
            <div className="mx-4 sm:mx-6 mb-4 rounded-2xl overflow-hidden border border-aeirmist-magenta/20 bg-black/65 relative select-none group aspect-video max-h-[200px] flex flex-col justify-between p-3.5 bg-gradient-to-b from-aeirmist-magenta/[0.02] to-black/80">
              <div className="flex justify-between items-center z-10 w-full">
                <span className="px-2 py-0.5 bg-aeirmist-magenta/15 border border-aeirmist-magenta/30 rounded text-aeirmist-magenta font-black uppercase text-[7px] tracking-widest">
                  Live Replay Stream
                </span>
                <span className="text-[8px] font-mono text-white/30 font-bold">
                  PEAK ACCESS: {((post as any).liveReplay.viewers || 1850).toLocaleString()} RESONATORS
                </span>
              </div>

              <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 rounded-full border border-dashed border-aeirmist-magenta/40 flex items-center justify-center p-3 text-aeirmist-magenta shadow-[0_0_20px_rgba(255,0,234,0.1)]">
                  <div className="w-0 h-0 border-t-6 border-t-transparent border-b-6 border-b-transparent border-l-[10px] border-l-current ml-0.5" />
                </div>
              </div>

              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,0,234,0.015)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />

              <div className="flex justify-between items-center z-10 w-full mt-auto">
                <span className="text-[8px] font-mono text-white/60 tracking-wider">8K QUALITY</span>
                <span className="text-[8px] font-mono font-black text-aeirmist-magenta">
                  DURATION: {Math.floor(((post as any).liveReplay.duration || 25) / 60)}:{(Number((post as any).liveReplay.duration || 25) % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          )}

          {/* Real-time Interactive Poll widget */}
          {post.poll && (
            <div className="px-4 pb-4 sm:px-6 sm:pb-5">
              <Poll postId={post.id} poll={post.poll} />
            </div>
          )}

          {/* Facebook-style Multi-photo collage grid */}
          {hasMedia ? (
            <div
              className="w-full border-y border-white/5 bg-black/20 cursor-pointer relative"
              onClickCapture={(e) => {
                // Allow video controls / clicks to play inline without forced redirection
                if (!showComments && (post as any).type !== 'video' && collageItems?.[0]?.type !== 'video') {
                  onPostClick?.(post.id);
                }
              }}
            >
              <Collage 
                items={collageItems} 
                fitMode={(post as any).fitMode || 'cover'} 
                caption={postCaption}
                poster={(post as any).thumbnail || (post as any).thumbnailURL || (post as any).coverImage}
                onItemClick={() => {
                  if ((post as any).type !== 'video' && collageItems?.[0]?.type !== 'video') {
                    onPostClick?.(post.id);
                  }
                }}
                onNavigateToWatch={() => {
                  onNavigate?.('videos', (post as any).videoId || post.id);
                }}
                renderLightboxSidebar={renderLightboxSidebar}
              />

              {/* Instagram-Style Small Round Mute Button on bottom right of media */}
              {postMusicData && (
                <div className="absolute bottom-3 right-3 z-30 pointer-events-auto">
                  <PostMusicPlayer music={postMusicData} variant="small-mute" />
                </div>
              )}
            </div>
          ) : postMusicData && (
            /* Text-only post with music: Render small round mute button on bottom right of post body */
            <div className="flex justify-end px-4 mb-2">
              <PostMusicPlayer music={postMusicData} variant="small-mute" />
            </div>
          )}
        </div>
      </div>

      {/* Engagement Buttons Row */}
      <div className="px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-t border-white/5 bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button 
              type="button"
              aria-label={isLiked ? "Unlike post" : "Like post"}
              aria-pressed={isLiked}
              onClick={handleLike}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border transition-all duration-300 active:scale-95 group font-black uppercase text-[10px] sm:text-xs tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-magenta ${
                isLiked 
                  ? 'bg-aeirmist-magenta/10 border-aeirmist-magenta/30 text-aeirmist-magenta shadow-[0_0_15px_rgba(255,0,234,0.15)]' 
                  : 'bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <Heart size={15} fill={isLiked ? "currentColor" : "none"} className={`transition-transform group-hover:scale-110 ${isLiked ? 'text-aeirmist-magenta' : 'text-current'}`} aria-hidden="true" />
              <span>{post.likesCount?.toLocaleString() || '0'}</span>
            </button>

            <button 
              type="button"
              aria-label="Toggle comments"
              aria-expanded={showComments}
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border transition-all duration-300 active:scale-95 group font-black uppercase text-[10px] sm:text-xs tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan ${
                showComments 
                  ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.15)]' 
                  : 'bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <MessageSquare size={15} className={`transition-transform group-hover:scale-110 ${showComments ? 'text-aeirmist-cyan' : 'text-current'}`} aria-hidden="true" />
              <span>{post.commentsCount?.toLocaleString() || '0'}</span>
            </button>

            <button 
              type="button"
              aria-label="Share post"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/5 bg-white/5 text-white/40 hover:text-white hover:border-white/25 transition-all duration-300 active:scale-95 font-black uppercase text-[10px] sm:text-xs tracking-wider group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Share2 size={15} className="transition-transform group-hover:scale-110 group-hover:rotate-12" aria-hidden="true" />
              <span>Share</span>
            </button>

            <div className="flex items-center gap-1 px-2.5 py-1 text-white/30 hover:text-white transition-colors">
              <Eye size={15} className="text-white/20" />
              <span className="text-[10px] font-bold font-mono">{(post.viewsCount || 0).toLocaleString()}</span>
            </div>
          </div>

          <button 
            type="button"
            aria-label={isBookmarked ? "Remove from bookmarks" : "Save post to bookmarks"}
            aria-pressed={isBookmarked}
            onClick={handleBookmarkToggle}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-95 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan ${
              isBookmarked 
                ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.15)]' 
                : 'bg-white/5 border-white/5 text-white/30 hover:text-white hover:border-white/25 hover:bg-white/10'
            }`}
            title="Save post"
          >
            <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} className="sm:w-3.5 sm:h-3.5" aria-hidden="true" />
          </button>
        </div>


        {/* Dynamic Nested Comments Drawer */}
        <AnimatePresence>
          {showComments && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="overflow-hidden border-t border-white/5 mt-4 pt-4 px-4 pb-4 sm:px-5 sm:pb-5"
            >
              <div className="space-y-4 max-h-[450px] overflow-y-auto no-scrollbar mb-4 pr-1">
                {commentTree.length === 0 ? (
                  <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-black py-6 text-center select-none animate-pulse">No feedback waves captured yet.</p>
                ) : (
                  commentTree.map(comment => renderCommentNode(comment, 0))
                )}
              </div>

              {/* Instant Multi-reactions panel on top of text form */}
              <div className="flex gap-1.5 mb-3 px-1 py-1 bg-white/[0.01] border-y border-white/5 items-center">
                <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest pl-1 select-none pr-2">Quick:</span>
                {['❤️', '🔥', '👍', '✨', '😂', '💀', '👽'].map(emoji => (
                  <button 
                    type="button"
                    key={emoji}
                    onClick={() => {
                      setCommentText(prev => prev + emoji);
                    }}
                    className="w-7 h-7 rounded-lg hover:bg-white/5 hover:text-white flex items-center justify-center text-sm active:scale-90 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Comment Input */}
              <form onSubmit={handleCommentSubmit} className="flex gap-2 items-center">
                <WritingToolsMenu
                  currentText={commentText}
                  onApplyText={setCommentText}
                  onAppendText={(t) => setCommentText(prev => prev + t)}
                  contextHint="Post comment"
                />
                  <input 
                  type="text" 
                  aria-label="Type your comment"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Write a comment..." 
                  disabled={submittingComment}
                  className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-aeirmist-cyan transition-all placeholder:text-white/20 font-bold text-white text-left" 
                />
                <button 
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="px-4 py-2.5 bg-white text-black font-black uppercase text-[9px] tracking-widest hover:bg-aeirmist-cyan disabled:bg-white/10 disabled:text-white/20 rounded-xl transition-all active:scale-95 shrink-0"
                >
                  POST
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Moderation Warning Modal */}
        <ModerationWarningModal
          isOpen={modWarning.isOpen}
          reason={modWarning.reason}
          suggestion={modWarning.suggestion}
          onEdit={() => {
            setModWarning({ isOpen: false });
          }}
          onProceedAnyway={() => {
            setModWarning({ isOpen: false });
            if (pendingComment?.type === 'main') {
              handleCommentSubmit(undefined, true);
            } else if (pendingComment?.type === 'reply') {
              handleInlineReplySubmit(undefined as any, true);
            }
          }}
        />

        <MessengerShare 
          isOpen={isMessengerShareOpen}
          onClose={() => setIsMessengerShareOpen(false)}
          onShare={handleShareToMessenger}
          db={db}
          profile={profile}
        />


      </div>
      <AnimatePresence>
        {showInsights && (
          <React.Suspense fallback={null}>
            <InsightsDashboard postId={post.id} onClose={() => setShowInsights(false)} />
          </React.Suspense>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

PremiumPostCard.displayName = 'PremiumPostCard';
