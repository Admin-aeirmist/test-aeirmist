import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Play, 
  ShieldCheck, 
  Bookmark, 
  MoreHorizontal, 
  MoreVertical,
  Share2, 
  Trash2, 
  Edit3, 
  Clock, 
  Send, 
  Film, 
  Plus 
} from 'lucide-react';
import { Video } from '../../types/videos';
import { formatAeirmistTimestamp } from '../../lib/date';
import { getAvatarUrl } from '../../lib/avatar';
import { useAeirmist } from '../../context/AeirmistContext';
import { formatDuration, formatTimeLeft, getPlaybackProgressMap } from '../../utils/videoStorage';
import { VideoMenu } from './VideoMenu';
import { ForwardModal } from '../messenger/ForwardModal';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


interface VideoCardProps {
  video: Video;
  onSelect: (video: Video) => void;
  onUserClick?: (userData: any) => void;
  onAddToPlaylist?: (video: Video) => void;
  layout?: 'grid' | 'horizontal' | 'compact';
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onSelect,
  onUserClick,
  onAddToPlaylist,
  layout = 'grid'
}) => {
  const { profile, db, addToast, deleteVideo } = useAeirmist();
  const [isSaved, setIsSaved] = useState(() => 
    profile?.id ? (video.savedBy || []).includes(profile.id) : false
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);

  const progressMap = getPlaybackProgressMap();
  const savedProgress = progressMap[video.id];

  const isOwner = profile?.id === video.creatorId;

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
        title: nextSaved ? 'VIDEO SAVED' : 'REMOVED FROM SAVED',
        message: nextSaved ? 'Added to your Saved Videos' : 'Removed from your Saved Videos',
        type: 'info'
      });
    } catch (e) {
      logger.error(e);
      setIsSaved(!nextSaved);
    }
  };

  const handleShareToStory = async () => {
    try {
      if (!db || !profile) return;
      await updateDoc(doc(db, 'videos', video.id), { shareCount: increment(1) });
      addToast({
        title: 'STORY MIRRORED',
        message: 'Video shared to your Story',
        type: 'success'
      });
    } catch (err) {
      logger.error(err);
    }
  };

  const handleShareToInbox = () => {
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

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this video?")) {
      try {
        await deleteVideo(video.id, video.videoURL, video.thumbnailURL);
        addToast({
          title: 'VIDEO DELETED',
          message: 'The video has been removed.',
          type: 'info'
        });
      } catch (err) {
        logger.error(err);
      }
    }
  };

  if (layout === 'compact') {
    return (
      <div 
        onClick={() => onSelect(video)}
        className="w-48 sm:w-56 shrink-0 cursor-pointer group flex flex-col gap-2 p-2 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-aeirmist-cyan/30 transition-all shadow-md"
      >
        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#101014]">
          <img 
            src={video.thumbnailURL || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600'} 
            alt={video.title || video.caption}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-mono text-white font-medium border border-white/10">
            {formatDuration(video.duration || 300)}
          </div>
          {savedProgress && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
              <div 
                className="h-full bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,0.8)]" 
                style={{ width: `${(savedProgress.currentTime / savedProgress.duration) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex gap-2 min-w-0 px-1">
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-white line-clamp-2 leading-snug group-hover:text-aeirmist-cyan transition-colors">
              {video.title || video.caption}
            </h4>
            <p className="text-[11px] text-white/50 truncate mt-0.5">
              {video.creatorName}
            </p>
            {savedProgress && (
              <p className="text-[10px] text-aeirmist-cyan mt-0.5 font-medium">
                {formatTimeLeft(savedProgress.currentTime, savedProgress.duration)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (layout === 'horizontal') {
    return (
      <motion.div 
        whileHover={{ scale: 1.01 }}
        onClick={() => onSelect(video)}
        className="flex flex-col sm:flex-row gap-4 p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-aeirmist-cyan/30 rounded-2xl cursor-pointer transition-all group shadow-md"
      >
        {/* Thumbnail 16:9 */}
        <div className="relative aspect-video w-full sm:w-64 rounded-xl overflow-hidden bg-black shrink-0">
          <img 
            src={video.thumbnailURL || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600'} 
            alt={video.title || video.caption}
            width={600}
            height={338}
            style={{ aspectRatio: '16 / 9' }}
            className="w-full h-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {/* Duration Badge */}
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-sm text-[11px] font-mono text-white font-medium border border-white/10">
            {formatDuration(video.duration || 300)}
          </div>
          {/* Play Icon Overlay */}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 flex items-center justify-center transition-colors">
            <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md text-aeirmist-cyan flex items-center justify-center group-hover:scale-110 transition-transform border border-aeirmist-cyan/30">
              <Play size={18} className="ml-0.5" />
            </div>
          </div>
          {/* Progress bar if saved */}
          {savedProgress && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
              <div 
                className="h-full bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,0.8)]" 
                style={{ width: `${(savedProgress.currentTime / savedProgress.duration) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
          <div>
            <h3 className="text-sm font-semibold text-white/90 line-clamp-2 mb-1 group-hover:text-aeirmist-cyan transition-colors">
              {video.title || video.caption}
            </h3>
            <p className="text-xs text-white/50 line-clamp-2 mb-3">
              {video.description || video.caption}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-white/60">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (onUserClick) onUserClick({ id: video.creatorId, name: video.creatorName });
              }}
              className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
            >
              <img 
                src={getAvatarUrl(video.creatorAvatar, video.creatorName)} 
                alt={video.creatorName} 
                className="w-5 h-5 rounded-full object-cover border border-white/10"
              />
              <span className="font-medium text-xs truncate">{video.creatorName}</span>
              {video.isVerified && (
                <ShieldCheck className="text-aeirmist-cyan shrink-0" size={13} />
              )}
            </div>

            <div className="flex items-center gap-3">
              <span>{(video.viewCount || 0).toLocaleString()} views</span>
              <span>•</span>
              <span>{formatAeirmistTimestamp(video.createdAt)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div
      onClick={() => onSelect(video)}
      className="flex flex-col bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-aeirmist-cyan/30 rounded-2xl overflow-hidden cursor-pointer transition-all group shadow-xl mx-3 sm:mx-0 mb-4 sm:mb-0 w-auto sm:w-full"
    >
      {/* Thumbnail 16:9 */}
      <div className="relative aspect-video w-full bg-[#101014] overflow-hidden">
        <img 
          src={video.thumbnailURL || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800'} 
          alt={video.title || video.caption}
          width={800}
          height={450}
          style={{ aspectRatio: '16 / 9' }}
          className="w-full h-full aspect-video object-cover group-hover:scale-102 transition-transform duration-300"
          loading="lazy"
        />

        {/* Category Pill */}
        {video.category && (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-semibold text-aeirmist-cyan/90 border border-aeirmist-cyan/30 shadow-sm">
            {video.category}
          </div>
        )}

        {/* Save Bookmark Button */}
        <button
          onClick={handleSaveToggle}
          className={`absolute top-2.5 right-2.5 p-1.5 sm:p-2 rounded-full backdrop-blur-md border transition-all ${
            isSaved 
              ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan/50 text-aeirmist-cyan' 
              : 'bg-black/60 border-white/10 text-white/70 hover:text-white'
          }`}
          title={isSaved ? "Saved" : "Save video"}
        >
          <Bookmark size={13} className={isSaved ? "fill-current" : ""} />
        </button>

        {/* Duration Overlay */}
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono font-medium text-white/90 border border-white/10">
          {formatDuration(video.duration || 300)}
        </div>

        {/* Desktop Play Hover Overlay */}
        <div className="hidden sm:flex absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 items-center justify-center transition-opacity">
          <div className="w-12 h-12 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-aeirmist-cyan flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(0,242,255,0.2)]">
            <Play size={22} className="ml-0.5" />
          </div>
        </div>

        {/* Playback Progress Bar (Aeirmist Neon Cyan) */}
        {savedProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
            <div 
              className="h-full bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,0.8)]" 
              style={{ width: `${(savedProgress.currentTime / savedProgress.duration) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Video Details */}
      <div className="p-3.5 sm:p-4 flex flex-col gap-2 flex-1 justify-between">
        <div className="flex gap-3 items-start">
          {/* Creator Avatar */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              if (onUserClick) onUserClick({ id: video.creatorId, name: video.creatorName });
            }}
            className="shrink-0 cursor-pointer pt-0.5"
          >
            <img 
              src={getAvatarUrl(video.creatorAvatar, video.creatorName)} 
              alt={video.creatorName} 
              className="w-9 h-9 rounded-full object-cover border border-white/15 hover:border-aeirmist-cyan transition-colors"
            />
          </div>

          {/* Title & Metadata */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-aeirmist-cyan transition-colors">
              {video.title || video.caption}
            </h3>

            <div className="flex items-center gap-1.5 mt-1 text-xs text-white/50 flex-wrap">
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  if (onUserClick) onUserClick({ id: video.creatorId, name: video.creatorName });
                }}
                className="font-medium text-white/80 hover:text-white transition-colors cursor-pointer truncate max-w-[150px]"
              >
                {video.creatorName}
              </span>
              {video.isVerified && (
                <ShieldCheck className="text-aeirmist-cyan shrink-0" size={13} />
              )}
              <span>•</span>
              <span>{(video.viewCount || 0).toLocaleString()} views</span>
              <span>•</span>
              <span>{formatAeirmistTimestamp(video.createdAt)}</span>
              {savedProgress && (
                <>
                  <span>•</span>
                  <span className="text-aeirmist-cyan font-medium">
                    {formatTimeLeft(savedProgress.currentTime, savedProgress.duration)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Context Menu Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(true);
            }}
            className="p-1 -mr-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label="More options"
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* Video Menu Modal */}
      <VideoMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        video={video}
        isOwner={isOwner}
        onEdit={() => {}}
        onDelete={handleDelete}
        onShareToInbox={handleShareToInbox}
        onShareToStory={handleShareToStory}
      />
    </div>
  );
};

export default VideoCard;
