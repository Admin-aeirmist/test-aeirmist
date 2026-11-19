import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Play, 
  ShieldCheck, 
  Bookmark, 
  MoreHorizontal, 
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
import { getAvatarUrl, resolveAvatarSrc } from '../../lib/avatar';
import { useAeirmist } from '../../context/AeirmistContext';
import { useSharedProfile } from '../../hooks/useSharedProfile';
import { formatDuration, formatTimeLeft, getPlaybackProgressMap } from '../../utils/videoStorage';
import { VideoMenu } from './VideoMenu';
import { ForwardModal } from '../messenger/ForwardModal';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';
import { normalizeMediaUrl } from '../../utils/mediaUtils';


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
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(video.title || video.caption || '');
  const [localTitle, setLocalTitle] = useState<string | null>(null);

  const creatorProfile = useSharedProfile(db, video.creatorId);
  const resolvedCreatorAvatar = resolveAvatarSrc(
    creatorProfile?.photoURL || creatorProfile?.avatarKey || creatorProfile?.avatar || video.creatorAvatar
  ) || video.creatorAvatar || '';
  const resolvedCreatorName = creatorProfile?.displayName || creatorProfile?.name || creatorProfile?.username || video.creatorName;
  const displayTitle = localTitle ?? (video.title || video.caption);

  const progressMap = getPlaybackProgressMap();
  const savedProgress = progressMap[video.id];

  const isOwner = profile?.id === video.creatorId || (profile as any)?.userId === video.creatorId || (profile as any)?.uid === video.creatorId;

  const handleSaveCaption = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editTitleValue.trim();
    if (!trimmed) return;
    setLocalTitle(trimmed);
    setIsEditingCaption(false);
    try {
      if (db) {
        await updateDoc(doc(db, 'videos', video.id), {
          title: trimmed,
          caption: trimmed,
        });
      }
      addToast({
        title: 'CAPTION UPDATED',
        message: 'Video details saved.',
        type: 'success',
      });
    } catch (err) {
      logger.error(err);
      addToast({
        title: 'UPDATE FAILED',
        message: 'Could not save video changes right now.',
        type: 'warning',
      });
    }
  };

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

  if (layout === 'horizontal') {
    return (
      <motion.div 
        whileHover={{ scale: 1.01 }}
        onClick={() => onSelect(video)}
        className="flex flex-row gap-3 p-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 rounded-xl cursor-pointer transition-all group overflow-hidden"
      >
        {/* Thumbnail 16:9 - YouTube style compact sidebar thumbnail */}
        <div className="relative aspect-video w-32 sm:w-36 md:w-36 rounded-lg overflow-hidden bg-black shrink-0">
          <img 
            src={normalizeMediaUrl(video.thumbnailURL || (video as any).thumbnailUrl) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600'} 
            alt={video.title || video.caption}
            width={600}
            height={338}
            style={{ aspectRatio: '16 / 9' }}
            className="w-full h-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {/* Duration Badge */}
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-md text-[9px] font-mono text-white/90">
            {formatDuration(video.duration || 300)}
          </div>
          {/* Play Icon Overlay */}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 flex items-center justify-center transition-colors">
            <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play size={14} className="ml-0.5" />
            </div>
          </div>
          {/* Progress bar if saved */}
          {savedProgress && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div 
                className="h-full bg-aeirmist-cyan" 
                style={{ width: `${(savedProgress.currentTime / savedProgress.duration) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
          <div className="min-w-0">
            <h3 className="text-xs sm:text-[13px] font-semibold text-white/95 line-clamp-2 leading-snug group-hover:text-aeirmist-cyan transition-colors mb-1">
              {displayTitle}
            </h3>
            {video.description && (
              <p className="text-[10px] text-white/40 line-clamp-1 mb-1 hidden sm:block">
                {video.description}
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (onUserClick) onUserClick({ id: video.creatorId, name: resolvedCreatorName, photoURL: resolvedCreatorAvatar });
              }}
              className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer min-w-0"
            >
              <img 
                src={getAvatarUrl(resolvedCreatorAvatar, resolvedCreatorName)} 
                alt={resolvedCreatorName} 
                className="w-4 h-4 rounded-full object-cover border border-white/10 shrink-0"
              />
              <span className="font-medium text-[11px] text-white/70 truncate">{resolvedCreatorName}</span>
              {(creatorProfile?.isVerified ?? video.isVerified) && (
                <ShieldCheck className="text-aeirmist-cyan shrink-0" size={11} />
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-medium truncate">
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
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      onClick={() => onSelect(video)}
      className="flex flex-col bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden cursor-pointer transition-all group shadow-lg"
    >
      {/* Thumbnail 16:9 */}
      <div className="relative aspect-video w-full bg-black overflow-hidden">
        <img 
          src={normalizeMediaUrl(video.thumbnailURL || (video as any).thumbnailUrl) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800'} 
          alt={video.title || video.caption}
          width={800}
          height={450}
          style={{ aspectRatio: '16 / 9' }}
          className="w-full h-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Category Pill */}
        {video.category && (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-white/80 border border-white/10">
            {video.category}
          </div>
        )}

        {/* Save Bookmark Button */}
        <button
          onClick={handleSaveToggle}
          className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md border transition-all ${
            isSaved 
              ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan/50 text-aeirmist-cyan' 
              : 'bg-black/50 border-white/10 text-white/70 hover:text-white'
          }`}
          title={isSaved ? "Saved" : "Save video"}
        >
          <Bookmark size={14} className={isSaved ? "fill-current" : ""} />
        </button>

        {/* Duration Overlay */}
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono text-white/90 border border-white/10">
          {formatDuration(video.duration || 300)}
        </div>

        {/* Center Play Icon Hover Overlay */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-12 h-12 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play size={22} className="ml-0.5 text-white" />
          </div>
        </div>

        {/* Continue Watching Progress Bar */}
        {savedProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div 
              className="h-full bg-aeirmist-cyan" 
              style={{ width: `${(savedProgress.currentTime / savedProgress.duration) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Video Details */}
      <div className="p-4 flex flex-col gap-3 flex-1 justify-between">
        <div className="flex gap-3">
          {/* Creator Avatar */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              if (onUserClick) onUserClick({ id: video.creatorId, name: resolvedCreatorName, photoURL: resolvedCreatorAvatar });
            }}
            className="shrink-0 cursor-pointer"
          >
            <img 
              src={getAvatarUrl(resolvedCreatorAvatar, resolvedCreatorName)} 
              alt={resolvedCreatorName} 
              className="w-9 h-9 rounded-xl object-cover border border-white/10 hover:border-aeirmist-cyan transition-colors"
            />
          </div>

          {/* Title & Metadata */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white/90 line-clamp-2 leading-snug group-hover:text-aeirmist-cyan transition-colors">
              {displayTitle}
            </h3>

            <div className="flex items-center gap-1.5 mt-1 text-xs text-white/60">
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  if (onUserClick) onUserClick({ id: video.creatorId, name: resolvedCreatorName, photoURL: resolvedCreatorAvatar });
                }}
                className="font-medium text-white/80 hover:text-white transition-colors cursor-pointer truncate"
              >
                {resolvedCreatorName}
              </span>
              {(creatorProfile?.isVerified ?? video.isVerified) && (
                <ShieldCheck className="text-aeirmist-cyan shrink-0" size={13} />
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-white/40 mt-1">
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
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors h-fit"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Video Menu Modal */}
      <VideoMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        video={video}
        isOwner={isOwner}
        onEdit={() => {
          setEditTitleValue(displayTitle || '');
          setIsEditingCaption(true);
        }}
        onDelete={handleDelete}
        onShareToInbox={handleShareToInbox}
        onShareToStory={handleShareToStory}
      />

      {isEditingCaption && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingCaption(false);
          }}
          className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveCaption}
            className="w-full max-w-md bg-[#0b0e14] border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <h4 className="text-sm font-bold text-white">Edit Video Title / Caption</h4>
            <input
              type="text"
              value={editTitleValue}
              onChange={(e) => setEditTitleValue(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-aeirmist-cyan"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingCaption(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/70"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-aeirmist-cyan text-black text-xs font-bold hover:brightness-110"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </motion.div>
  );
};

export default VideoCard;
