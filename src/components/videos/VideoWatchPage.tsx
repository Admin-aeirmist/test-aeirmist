import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Share2, 
  Bookmark, 
  Plus, 
  ShieldCheck, 
  MessageCircle, 
  Flag, 
  ThumbsUp, 
  Send, 
  MoreHorizontal, 
  ArrowLeft,
  X,
  Sparkles,
  Check,
  Lock,
  Globe,
  Tv
} from 'lucide-react';
import { Video, VideoComment, VideoPlaylist } from '../../types/videos';
import { VideoPlayerComponent } from './VideoPlayer';
import { VideoCard } from './VideoCard';
import { getAvatarUrl } from '../../lib/avatar';
import { formatAeirmistTimestamp } from '../../lib/date';
import { useAeirmist } from '../../context/AeirmistContext';
import { getPlaybackProgressMap, addToWatchHistory, getLocalPlaylists, saveLocalPlaylists } from '../../utils/videoStorage';
import { collection, query, where, onSnapshot, doc, updateDoc, increment, arrayUnion, arrayRemove, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


interface VideoWatchPageProps {
  video: Video;
  allVideos: Video[];
  onSelectVideo: (video: Video) => void;
  onBack: () => void;
  onUserClick: (userData: any) => void;
}

export const VideoWatchPage: React.FC<VideoWatchPageProps> = ({
  video,
  allVideos,
  onSelectVideo,
  onBack,
  onUserClick
}) => {
  const { profile, user, db, addToast } = useAeirmist();

  const [isLiked, setIsLiked] = useState(() => 
    profile?.id ? (video.likedBy || []).includes(profile.id) : false
  );
  const [likeCount, setLikeCount] = useState(video.likeCount || 0);
  const [isSaved, setIsSaved] = useState(() => 
    profile?.id ? (video.savedBy || []).includes(profile.id) : false
  );
  const [isFollowing, setIsFollowing] = useState(() => 
    profile?.social?.following?.includes(video.creatorId) || false
  );
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate Content');
  const [reportNotes, setReportNotes] = useState('');

  // Comments System
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [commentSort, setCommentSort] = useState<'top' | 'newest'>('newest');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Playlists State
  const [playlists, setPlaylists] = useState<VideoPlaylist[]>(() => getLocalPlaylists());
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');

  // Saved position from progress map
  const progressMap = getPlaybackProgressMap();
  const savedProgress = progressMap[video.id];
  const initialTime = savedProgress?.currentTime || 0;

  // Add video to watch history
  useEffect(() => {
    addToWatchHistory(video.id);
  }, [video.id]);

  // Sync likes/saves
  useEffect(() => {
    if (profile?.id) {
      setIsLiked((video.likedBy || []).includes(profile.id));
      setIsSaved((video.savedBy || []).includes(profile.id));
      setIsFollowing(profile?.social?.following?.includes(video.creatorId) || false);
    }
  }, [profile?.id, video]);

  // Realtime comments listener
  useEffect(() => {
    if (!db || !video.id) return;
    const q = query(
      collection(db, 'video_comments'),
      where('videoId', '==', video.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as VideoComment);
      if (commentSort === 'newest') {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else {
        list.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
      }
      setComments(list);
    }, (err) => logger.error('[VideoWatchPage] Comments error:', err));

    return () => unsubscribe();
  }, [db, video.id, commentSort]);

  // Like Toggle
  const handleToggleLike = async () => {
    if (!profile?.id || !db) return;
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount(prev => prev + (nextLiked ? 1 : -1));

    try {
      const vRef = doc(db, 'videos', video.id);
      await updateDoc(vRef, {
        likedBy: nextLiked ? arrayUnion(profile.id) : arrayRemove(profile.id),
        likeCount: increment(nextLiked ? 1 : -1)
      });
    } catch (err) {
      logger.error(err);
      setIsLiked(!nextLiked);
      setLikeCount(prev => prev + (nextLiked ? -1 : 1));
    }
  };

  // Save Toggle
  const handleToggleSave = async () => {
    if (!profile?.id || !db) return;
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    try {
      const vRef = doc(db, 'videos', video.id);
      await updateDoc(vRef, {
        savedBy: nextSaved ? arrayUnion(profile.id) : arrayRemove(profile.id),
        saveCount: increment(nextSaved ? 1 : -1)
      });
      addToast({
        title: nextSaved ? 'SAVED TO LIBRARY' : 'REMOVED FROM LIBRARY',
        message: nextSaved ? 'Added to your Saved Videos' : 'Removed from your Saved Videos',
        type: 'info'
      });
    } catch (err) {
      logger.error(err);
      setIsSaved(!nextSaved);
    }
  };

  // Follow Toggle
  const handleToggleFollow = async () => {
    if (!profile?.id || !db) return;
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);

    try {
      const pRef = doc(db, 'profiles', `profile_${profile.id}`);
      await updateDoc(pRef, {
        'social.following': nextFollowing ? arrayUnion(video.creatorId) : arrayRemove(video.creatorId)
      });
      addToast({
        title: nextFollowing ? `FOLLOWING ${video.creatorName}` : `UNFOLLOWED`,
        message: nextFollowing ? `You will now see videos from ${video.creatorName}` : `Unfollowed ${video.creatorName}`,
        type: 'info'
      });
    } catch (err) {
      logger.error(err);
      setIsFollowing(!nextFollowing);
    }
  };

  // Submit Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !profile || !db) return;
    setIsSubmittingComment(true);

    try {
      const authorUid = user?.uid || profile.uid || profile.ownerUid || profile.id;
      await addDoc(collection(db, 'video_comments'), {
        videoId: video.id,
        userId: authorUid,
        authorUid: authorUid,
        profileId: profile.id,
        userName: profile.name || profile.displayName || profile.username || 'Aeirmist User',
        userAvatar: profile.avatar || profile.photoURL || '',
        isVerified: profile.isVerified || false,
        text: commentInput.trim(),
        createdAt: new Date().toISOString(),
        likeCount: 0,
        likedBy: []
      });

      // Update video comment count
      await updateDoc(doc(db, 'videos', video.id), {
        commentCount: increment(1)
      });

      setCommentInput('');
      addToast({ title: 'COMMENT POSTED', message: 'Your comment has been added.', type: 'success' });
    } catch (err) {
      logger.error(err);
      addToast({ title: 'ERROR', message: 'Could not post comment.', type: 'info' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Delete Own Comment
  const handleDeleteComment = async (commentId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'video_comments', commentId));
      await updateDoc(doc(db, 'videos', video.id), { commentCount: increment(-1) });
    } catch (err) {
      logger.error(err);
    }
  };

  // Playlist Management
  const handleCreatePlaylist = () => {
    if (!newPlaylistTitle.trim() || !profile) return;
    const newPl: VideoPlaylist = {
      id: `pl_${Date.now()}`,
      title: newPlaylistTitle.trim(),
      creatorId: profile.id,
      creatorName: profile.name || 'Me',
      videoIds: [video.id],
      isPrivate: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updated = [newPl, ...playlists];
    setPlaylists(updated);
    saveLocalPlaylists(updated);
    setNewPlaylistTitle('');
    addToast({ title: 'PLAYLIST CREATED', message: `Added to "${newPl.title}"`, type: 'success' });
  };

  const handleTogglePlaylistVideo = (plId: string) => {
    const updated = playlists.map(pl => {
      if (pl.id === plId) {
        const has = pl.videoIds.includes(video.id);
        const nextIds = has ? pl.videoIds.filter(i => i !== video.id) : [...pl.videoIds, video.id];
        return { ...pl, videoIds: nextIds, updatedAt: new Date().toISOString() };
      }
      return pl;
    });
    setPlaylists(updated);
    saveLocalPlaylists(updated);
    addToast({ title: 'PLAYLIST UPDATED', message: 'Updated video selection.', type: 'info' });
  };

  // Share button handler
  const handleShareVideo = () => {
    try {
      const shareUrl = `${window.location.origin}/video/${video.id}`;
      navigator.clipboard.writeText(shareUrl);
      addToast({
        title: 'LINK COPIED',
        message: 'Video link copied to clipboard.',
        type: 'success'
      });
    } catch (e) {
      logger.error(e);
    }
  };

  // Report Submission
  const handleSubmitReport = async () => {
    if (!db || !profile) return;
    try {
      const refId = `RPT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
      await addDoc(collection(db, 'reports'), {
        reportId: refId,
        reporterUid: profile.uid || profile.id,
        reporterUsername: profile.username || 'Unknown',
        reportedUid: video.creatorId || 'unknown',
        targetType: 'video',
        targetId: video.id,
        reason: reportReason,
        description: reportNotes || '',
        attachments: [],
        status: 'pending',
        priority: 'medium',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        meta: { targetTitle: video.title || video.caption }
      });
      setIsReportModalOpen(false);
      setReportNotes('');
      addToast({
        title: 'REPORT SUBMITTED',
        message: 'Thank you for keeping Aeirmist safe. Our team will review this video.',
        type: 'success'
      });
    } catch (err) {
      logger.error(err);
      addToast({ title: 'ERROR', message: 'Could not submit report.', type: 'info' });
    }
  };

  const recommendedVideos = allVideos.filter(v => v.id !== video.id);

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white overflow-y-auto no-scrollbar font-sans pb-24">
      {/* Top Bar Navigation */}
      <div className="sticky top-0 z-30 bg-[#050505]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-medium text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Feed</span>
        </button>
        <span className="text-xs font-semibold uppercase tracking-wider text-white/40">Aeirmist Cinema</span>
      </div>

      <div className={`p-4 md:p-6 mx-auto w-full transition-all ${
        isTheaterMode ? 'max-w-7xl' : 'max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8'
      }`}>
        
        {/* Main Content Area (Player + Information) */}
        <div className={isTheaterMode ? 'w-full space-y-6' : 'lg:col-span-2 space-y-6'}>
          {/* 16:9 Production Video Player */}
          <VideoPlayerComponent
            video={video}
            initialTime={initialTime}
            onBack={onBack}
            isTheaterMode={isTheaterMode}
            onToggleTheaterMode={() => setIsTheaterMode(!isTheaterMode)}
            autoPlayOnMount={true}
          />

          {/* Title & Category */}
          <div className="space-y-2">
            {video.category && (
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan text-[11px] font-semibold tracking-wide">
                {video.category}
              </span>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              {video.title || video.caption}
            </h1>
          </div>

          {/* Creator & Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-y border-white/10">
            {/* Creator Profile */}
            <div className="flex items-center gap-3">
              <div 
                onClick={() => onUserClick({ id: video.creatorId, name: video.creatorName })}
                className="cursor-pointer"
              >
                <img 
                  src={getAvatarUrl(video.creatorAvatar, video.creatorName)} 
                  alt={video.creatorName}
                  className="w-11 h-11 rounded-full object-cover border border-white/20 hover:border-aeirmist-cyan transition-colors"
                />
              </div>

              <div>
                <div 
                  onClick={() => onUserClick({ id: video.creatorId, name: video.creatorName })}
                  className="flex items-center gap-1.5 cursor-pointer hover:text-aeirmist-cyan transition-colors"
                >
                  <span className="font-semibold text-sm text-white">{video.creatorName}</span>
                  {video.isVerified && (
                    <ShieldCheck className="text-aeirmist-cyan shrink-0" size={16} />
                  )}
                </div>
                <span className="text-xs text-white/50">Creator</span>
              </div>

              <button
                onClick={handleToggleFollow}
                className={`ml-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isFollowing
                    ? 'bg-white/10 text-white/80 border border-white/10 hover:bg-white/20'
                    : 'bg-aeirmist-cyan text-black hover:bg-opacity-90 font-bold'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {/* Like */}
              <button
                onClick={handleToggleLike}
                className={`px-3.5 py-2 rounded-full border text-xs font-medium flex items-center gap-2 transition-all ${
                  isLiked
                    ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Heart size={15} className={isLiked ? "fill-current" : ""} />
                <span>{likeCount.toLocaleString()}</span>
              </button>

              {/* Share */}
              <button
                onClick={handleShareVideo}
                className="px-3.5 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white text-xs font-medium flex items-center gap-2 transition-colors"
              >
                <Share2 size={15} />
                <span>Share</span>
              </button>

              {/* Save */}
              <button
                onClick={handleToggleSave}
                className={`px-3.5 py-2 rounded-full border text-xs font-medium flex items-center gap-2 transition-all ${
                  isSaved
                    ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan/40 text-aeirmist-cyan'
                    : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Bookmark size={15} className={isSaved ? "fill-current" : ""} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>

              {/* Add to Playlist */}
              <button
                onClick={() => setIsPlaylistModalOpen(true)}
                className="px-3.5 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white text-xs font-medium flex items-center gap-2 transition-colors"
              >
                <Plus size={15} />
                <span>Playlist</span>
              </button>

              {/* Report */}
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="p-2 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-red-400 transition-colors"
                title="Report Video"
              >
                <Flag size={15} />
              </button>
            </div>
          </div>

          {/* Description Box */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-xs text-white/80 space-y-2">
            <div className="flex items-center gap-3 font-semibold text-white/90">
              <span>{(video.viewCount || 0).toLocaleString()} views</span>
              <span>•</span>
              <span>{formatAeirmistTimestamp(video.createdAt)}</span>
              {video.language && (
                <>
                  <span>•</span>
                  <span>{video.language}</span>
                </>
              )}
            </div>

            <p className={`whitespace-pre-wrap leading-relaxed ${isDescriptionExpanded ? '' : 'line-clamp-3'}`}>
              {video.description || video.caption}
            </p>

            {video.tags && video.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {video.tags.map((tag, idx) => (
                  <span key={idx} className="text-aeirmist-cyan/80 hover:underline cursor-pointer font-mono">
                    #{tag.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            )}

            {(video.description && video.description.length > 120) && (
              <button
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="text-white/60 hover:text-white font-semibold pt-1 transition-colors"
              >
                {isDescriptionExpanded ? 'Show Less' : 'Show More'}
              </button>
            )}
          </div>

          {/* Comments Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/90 flex items-center gap-2">
                <MessageCircle size={16} className="text-aeirmist-cyan" />
                <span>Comments ({comments.length})</span>
              </h3>

              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setCommentSort('newest')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    commentSort === 'newest' ? 'bg-white/10 text-white font-semibold' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Newest
                </button>
                <button
                  onClick={() => setCommentSort('top')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    commentSort === 'top' ? 'bg-white/10 text-white font-semibold' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Top
                </button>
              </div>
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-3">
              <img 
                src={getAvatarUrl(profile?.avatar, profile?.name || 'Me')} 
                alt="Me" 
                className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
              />
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan/50"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim() || isSubmittingComment}
                  className="px-4 py-2 bg-aeirmist-cyan text-black hover:bg-opacity-90 disabled:opacity-40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Send size={13} />
                  <span>Post</span>
                </button>
              </div>
            </form>

            {/* Comment List */}
            <div className="space-y-3 pt-2">
              {comments.length > 0 ? (
                comments.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img 
                          src={getAvatarUrl(c.userAvatar, c.userName)} 
                          alt={c.userName} 
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="font-semibold text-xs text-white/90">{c.userName}</span>
                        {c.isVerified && <ShieldCheck size={12} className="text-aeirmist-cyan" />}
                        <span className="text-[10px] text-white/40">{formatAeirmistTimestamp(c.createdAt)}</span>
                      </div>

                      {profile?.id === c.userId && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-white/30 hover:text-red-400 text-xs transition-colors"
                          title="Delete comment"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-white/80 pl-8">{c.text}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-white/40">
                  No comments yet. Be the first to start the conversation!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar / Recommended Videos */}
        <div className={isTheaterMode ? 'w-full space-y-4 pt-6 border-t border-white/10' : 'space-y-4'}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/80 flex items-center gap-2">
            <Sparkles size={16} className="text-aeirmist-cyan" />
            <span>Recommended Videos</span>
          </h2>

          <div className="space-y-3">
            {recommendedVideos.length > 0 ? (
              recommendedVideos.map((rec) => (
                <VideoCard
                  key={rec.id}
                  video={rec}
                  onSelect={onSelectVideo}
                  onUserClick={onUserClick}
                  layout="horizontal"
                />
              ))
            ) : (
              <div className="text-center py-8 text-xs text-white/40 bg-white/5 rounded-2xl border border-white/5">
                No related videos found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Playlist Modal */}
      <AnimatePresence>
        {isPlaylistModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-[#121216] border border-white/10 rounded-2xl p-6 space-y-5 text-white"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Save to Playlist</h3>
                <button onClick={() => setIsPlaylistModalOpen(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Create new playlist form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  placeholder="New playlist name..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan"
                />
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistTitle.trim()}
                  className="px-4 py-2 bg-aeirmist-cyan text-black hover:bg-opacity-90 disabled:opacity-40 text-xs font-bold rounded-xl transition-all"
                >
                  Create
                </button>
              </div>

              {/* Existing Playlists */}
              <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                {playlists.map((pl) => {
                  const contains = pl.videoIds.includes(video.id);
                  return (
                    <button
                      key={pl.id}
                      onClick={() => handleTogglePlaylistVideo(pl.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-white/90">{pl.title}</span>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        contains ? 'bg-aeirmist-cyan border-aeirmist-cyan text-black' : 'border-white/20'
                      }`}>
                        {contains && <Check size={14} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-[#121216] border border-white/10 rounded-2xl p-6 space-y-4 text-white"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Flag size={18} className="text-red-400" />
                  <span>Report Video</span>
                </h3>
                <button onClick={() => setIsReportModalOpen(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <p className="text-xs text-white/60">
                Please select a reason for reporting this video. Our team will review your request.
              </p>

              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-aeirmist-cyan"
              >
                <option value="Inappropriate Content" className="bg-black">Inappropriate Content</option>
                <option value="Copyright Infringement" className="bg-black">Copyright Infringement</option>
                <option value="Spam or Misleading" className="bg-black">Spam or Misleading</option>
                <option value="Hate Speech or Harassment" className="bg-black">Hate Speech or Harassment</option>
                <option value="Other" className="bg-black">Other</option>
              </select>

              <textarea
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Additional details (optional)..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded-xl text-white/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReport}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-xs font-bold rounded-xl text-white shadow-lg"
                >
                  Submit Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
