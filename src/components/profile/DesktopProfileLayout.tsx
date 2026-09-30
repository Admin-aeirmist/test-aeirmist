import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAeirmist } from '../../context/AeirmistContext';
import { formatAeirmistTimestamp } from '../../lib/date';
import { 
  Grid, 
  Video, 
  Bookmark, 
  Ghost, 
  Sparkles, 
  Tag,
  Camera, 
  Crown, 
  Zap, 
  Share2, 
  Archive, 
  Settings, 
  MessageSquare, 
  MoreVertical, 
  Lock, 
  Plus, 
  Activity, 
  Clock, 
  MinusCircle, 
  Link2,
  Trash2,
  Hash,
  TrendingUp,
  MessageCircle,
  ShieldCheck,
  Globe,
  Instagram,
  Facebook,
  ExternalLink,
  Users,
  UserCheck,
  Heart
} from 'lucide-react';
import { getAvatarUrl } from '../../lib/avatar';
import { Avatar } from '../ui/Avatar';
import { AeirmistRankBadge } from './AeirmistRankBadge';
import { getRankInfo } from '../../lib/aeirmistRanks';
import { CreatorTier } from '../../types/economy';
import { collection, query, where, limit, orderBy, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { QuartCard } from './QuartCard';
import { ProfileCompletionCard } from './ProfileCompletionCard';
import { Skeleton } from '../ui/Skeleton';
import { logger } from '@/src/utils/logger';


interface DesktopProfileLayoutProps {
  displayUser: any;
  profile: any;
  isOwnProfile: boolean;
  isDataLoading?: boolean;
  isLocked: boolean;
  isOnline: boolean;
  isVerified: boolean;
  isInfinity: boolean;
  isEditingBio: boolean;
  setIsEditingBio: (val: boolean) => void;
  tempBio: string;
  setTempBio: (val: string) => void;
  handleUpdateIdentity: () => void;
  posts: any[];
  savedPosts: any[];
  loadingSavedPosts: boolean;
  loadingPosts: boolean;
  nglSignals: any[];
  isFollowingUser: boolean;
  isPendingUser: boolean;
  isFollowerOfMe: boolean;
  toggleFollow: (id: string, user: any) => void;
  onMessageClick?: (user: any) => void;
  isMessageLocked: boolean;
  handleShareProfile: () => void;
  setIsNGLDashboardOpen: (val: boolean) => void;
  setIsNGLComposerOpen: (val: boolean) => void;
  setIsAccountSwitcherOpen: (val: boolean) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (val: boolean) => void;
  toggleCloseFriend: (id: string) => void;
  isFav: boolean;
  toggleBlockUser: (id: string) => void;
  isBlockedUser: boolean;
  onUserClick?: (user: any) => void;
  addToast?: any;
  updateProfile: any;
  setSelectedPost: (post: any) => void;
  db: any;
  uploadMedia: any;
  handleCoverUpload: (file: File) => Promise<void>;
  PostCard: any;
  highlights: any[];
  loadingHighlights: boolean;
  handleCreateHighlight: () => void;
  handleHighlightClick?: (highlight: any) => void;
  checkIsFollowing?: (id: string) => boolean;
  isFollowPending?: (id: string) => boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onRankClick?: () => void;
  handleShowFollowList?: (type: 'followers' | 'following') => void;
  mutualConnections?: any[];
  onOpenMutuals?: () => void;
  userNote?: any;
  onNoteClick?: () => void;
  onSelectAvatarFile?: (file: File) => void;
  onSelectCoverFile?: (file: File) => void;
}

export const DesktopProfileLayout = React.memo<DesktopProfileLayoutProps>(({
  displayUser,
  profile,
  isOwnProfile,
  isDataLoading,
  isLocked,
  isOnline,
  isVerified,
  isInfinity,
  isEditingBio,
  setIsEditingBio,
  tempBio,
  setTempBio,
  handleUpdateIdentity,
  posts,
  savedPosts,
  loadingSavedPosts,
  loadingPosts,
  nglSignals,
  isFollowingUser,
  isPendingUser,
  isFollowerOfMe,
  toggleFollow,
  onMessageClick,
  isMessageLocked,
  handleShareProfile,
  setIsNGLDashboardOpen,
  setIsNGLComposerOpen,
  setIsAccountSwitcherOpen,
  isMenuOpen,
  setIsMenuOpen,
  toggleCloseFriend,
  isFav,
  toggleBlockUser,
  isBlockedUser,
  onUserClick,
  addToast,
  updateProfile,
  setSelectedPost,
  db,
  uploadMedia,
  handleCoverUpload,
  PostCard,
  highlights = [],
  loadingHighlights = false,
  handleCreateHighlight,
  handleHighlightClick,
  checkIsFollowing,
  isFollowPending,
  activeTab,
  setActiveTab,
  onRankClick,
  handleShowFollowList,
  mutualConnections = [],
  onOpenMutuals,
  userNote,
  onNoteClick,
  onSelectAvatarFile,
  onSelectCoverFile
}) => {

  const { 
    localAvatarURL, 
    localCoverURL, 
    profileUploadProgress, 
    coverUploadProgress,
    openVault
  } = useAeirmist();

  const [rightPanelSuggestions, setRightPanelSuggestions] = useState<any[]>([]);
  const [rightPanelTrending, setRightPanelTrending] = useState<any[]>([]);
  const [nglReplyInputs, setNglReplyInputs] = useState<{ [key: string]: string }>({});
  const [replyingMessageId, setReplyingMessageId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const unlockedItems = displayUser?.unlockedItems || [];

  // Load right panel recommendations
  useEffect(() => {
    if (!db) return;
    const loadRightPanelData = async () => {
      try {
        const profilesRef = collection(db, 'profiles');
        const suggestQuery = query(profilesRef, limit(8));
        const snap = await getDocs(suggestQuery);
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.id !== profile?.id && p.id !== displayUser?.id);
        
        setRightPanelSuggestions(list.slice(0, 3));

        // Get trending based on AP levels
        const trendingQuery = query(profilesRef, orderBy('aeirmistLevel', 'desc'), limit(6));
        const trendSnap = await getDocs(trendingQuery);
        const trendList = trendSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.id !== displayUser?.id);
        setRightPanelTrending(trendList.slice(0, 3));
      } catch (err) {
        logger.error("Failed to load right panel profile directories:", err);
      }
    };
    loadRightPanelData();
  }, [db, profile?.id, displayUser?.id]);

  const purchaseMarketplaceItem = async (itemId: string, cost: number) => {
    if (!isOwnProfile) return;
    const currentScore = displayUser?.aeirmistLevel || 0;
    if (currentScore < cost) {
      addToast?.({
        title: 'INSUFFICIENT AP',
        message: 'Your Account rating is too low to manifest this core upgrade.',
        type: 'warning'
      });
      return;
    }

    setIsUpdating(true);
    try {
      const updatedList = [...unlockedItems, itemId];
      await updateProfile({
        aeirmistLevel: currentScore - cost,
        unlockedItems: updatedList
      });
      addToast?.({
        title: 'SYNC COMPLETED',
        message: `${itemId.toUpperCase().replace(/_/g, ' ')} artifact acquired successfully. -${cost} AP deducted.`,
        type: 'success'
      });
    } catch (e: any) {
      logger.error(e);
      addToast?.({
        title: 'CRYPTO SHIELD ERROR',
        message: 'Points ledger update halted because node rejected transaction signatures.',
        type: 'warning'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNGLReplySubmit = async (msgId: string) => {
    const text = nglReplyInputs[msgId]?.trim();
    if (!db || !text) return;
    try {
      await updateDoc(doc(db, 'ngl_messages', msgId), {
        status: 'replied',
        replyContent: text,
        repliedAt: serverTimestamp()
      });
      setNglReplyInputs(prev => ({ ...prev, [msgId]: '' }));
      setReplyingMessageId(null);
      addToast?.({
        title: 'LINK COPIED',
        message: 'Anonymous query responded to and archived in profile node.',
        type: 'success'
      });
    } catch (err) {
      logger.error(err);
    }
  };

  return (
    <div className="w-full">
      {/* COVER BANNER HEIGHT 320px */}
      <div 
        className="w-full h-80 rounded-t-2xl relative overflow-hidden bg-gradient-to-r from-slate-200 via-sky-100 to-indigo-100 dark:from-zinc-950 dark:via-[#120e2e] dark:to-black border border-slate-200/80 dark:border-white/5 shadow-2xl group/cover cursor-pointer"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith('image/') && isOwnProfile) {
            if (onSelectCoverFile) onSelectCoverFile(file);
            else handleCoverUpload(file);
          }
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-aeirmist-cyan/10 blur-[80px] rounded-full pointer-events-none" />
        
        {isDataLoading ? (
          <Skeleton className="w-full h-full opacity-10" />
        ) : (isOwnProfile && localCoverURL) || displayUser?.coverURL ? (
          <img 
            src={(isOwnProfile && localCoverURL) ? localCoverURL : displayUser.coverURL} 
            alt="Cover" 
            loading="eager"
            decoding="async"
            fetchPriority="high"
            style={{ imageRendering: 'auto' }}
            className="w-full h-full object-cover relative z-0 transition-opacity duration-300" 
            referrerPolicy="no-referrer"
            onError={(e) => {
               (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-35 relative z-0">
            <div className="text-center space-y-2">
              <p className="text-[10px] uppercase font-black tracking-[0.4em] text-slate-500 dark:text-white/50">Aeirmist Member</p>
              <p className="text-[8px] uppercase font-bold tracking-[0.2em] text-aeirmist-cyan">Profile #{(displayUser?.id || '').slice(0, 8)}</p>
            </div>
          </div>
        )}

        {isOwnProfile && (
          <div 
            className="absolute inset-0 bg-black/20 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-10 backdrop-blur-[1px]"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = async (e: any) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (onSelectCoverFile) onSelectCoverFile(file);
                else handleCoverUpload(file);
              };
              input.click();
            }}
          >
            <div className="px-5 py-2.5 bg-black/50 border border-white/20 rounded-2xl flex items-center gap-2.5 backdrop-blur-md hover:bg-black/70 transition-all">
              <Camera size={18} className="text-aeirmist-cyan" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">Update Cover Photo</span>
            </div>
          </div>
        )}

        {coverUploadProgress > 0 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${coverUploadProgress}%` }}
                className="h-full bg-aeirmist-cyan shadow-[0_0_10px_rgba(0,242,255,0.8)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* LOWER DEETS CARD - FLAT & PROFESSIONAL */}
      <div className="bg-white/95 dark:bg-[#04080e]/60 backdrop-blur-3xl border-x border-b border-slate-200/80 dark:border-white/5 rounded-b-2xl p-8 mb-8 shadow-2xl relative">
        <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start relative z-10">
          
          {/* Overlapping Square Avatar (160x160px size) with crisp white border in light mode */}
          <div className="relative shrink-0 -mt-24">
            <div className="relative group p-1.5 sm:p-2 bg-white dark:bg-[#07070a] rounded-[2.25rem] shadow-2xl ring-4 ring-white/95 dark:ring-[#07070a]/80 transition-all duration-300">
              <div className={`absolute inset-0 blur-md rounded-[2.25rem] transition-opacity opacity-0 group-hover:opacity-100 ${isInfinity ? 'bg-aeirmist-magenta/40 opacity-100 animate-pulse' : 'bg-aeirmist-cyan/30'}`} />
              <Avatar
                src={(isOwnProfile && localAvatarURL) ? localAvatarURL : getAvatarUrl(displayUser?.photoURL)}
                alt={displayUser?.displayName || "User"}
                sizeClassName="w-36 h-36 sm:w-40 sm:h-40"
                roundedClassName="rounded-[1.85rem]"
                innerRoundedClassName="rounded-[1.65rem]"
                showStoryRing={true}
                userId={displayUser?.id}
                className="shadow-md"
              >
                {profileUploadProgress > 0 && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${profileUploadProgress}%` }}
                          className="h-full bg-aeirmist-cyan"
                        />
                      </div>
                      <span className="text-[8px] font-mono text-aeirmist-cyan uppercase tracking-widest font-sans">Uploading: {Math.round(profileUploadProgress)}%</span>
                    </div>
                  </div>
                )}

                {isOwnProfile && (
                  <button 
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (onSelectAvatarFile) {
                          onSelectAvatarFile(file);
                        }
                      };
                      input.click();
                    }}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-black uppercase tracking-widest cursor-pointer font-sans"
                  >
                    <Camera size={20} className="text-aeirmist-cyan mb-1" />
                    <span>Update Photo</span>
                  </button>
                )}
              </Avatar>
            </div>
          </div>

          {/* Details & Horizontal Controls */}
          <div className="flex-1 text-center lg:text-left space-y-4 min-w-0">
            <div>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white truncate max-w-sm">
                  {displayUser?.displayName || "Junaed Islam"}
                </h1>
                {isVerified && (
                  <ShieldCheck size={20} className="text-aeirmist-cyan shrink-0" />
                )}
              </div>
              <p className="text-[11px] font-mono font-bold text-aeirmist-cyan tracking-widest mt-1">
                @{displayUser?.username || "junaed"}
              </p>

              {/* Relationship Status Badge */}
              {(() => {
                const status = displayUser?.relationshipStatus;
                if (!status || status === 'Status') return null;
                const visibility = displayUser?.relationshipStatusVisibility || 'public';
                if (!isOwnProfile && visibility === 'only_me') return null;

                return (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan text-xs font-semibold mt-2.5 mb-1 shadow-sm backdrop-blur-sm">
                    <Heart size={13} className="text-aeirmist-cyan fill-aeirmist-cyan/30 shrink-0" />
                    <span className="tracking-wide">{status}</span>
                  </div>
                );
              })()}
              
              {isEditingBio ? (
                <div className="mt-3 max-w-xl space-y-3">
                  <textarea
                    value={tempBio}
                    onChange={(e) => setTempBio(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-xs text-slate-900 dark:text-white focus:border-aeirmist-cyan focus:ring-0 outline-none"
                    placeholder="Write something about your bio..."
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleUpdateIdentity}
                      className="px-4 py-2 bg-aeirmist-cyan text-black rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      Save Changes
                    </button>
                    <button 
                      onClick={() => setIsEditingBio(false)}
                      className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-600 dark:text-white/60 text-xs tracking-wide max-w-lg mt-3 leading-relaxed font-sans">
                  {displayUser?.bio || "No bio added yet."}
                </p>
              )}

              {/* Website & Social Links */}
              {(displayUser?.website || displayUser?.socialLinks?.website || displayUser?.socialLinks?.instagram || displayUser?.socialLinks?.facebook) && (
                <div className="flex flex-wrap items-center gap-2.5 mt-3 font-sans">
                  {(displayUser?.website || displayUser?.socialLinks?.website) && (
                    <a 
                      href={
                        (displayUser?.website || displayUser?.socialLinks?.website).startsWith('http') 
                          ? (displayUser?.website || displayUser?.socialLinks?.website) 
                          : `https://${displayUser?.website || displayUser?.socialLinks?.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-white/5 dark:border-white/10 text-xs text-aeirmist-cyan dark:hover:bg-white/10 dark:hover:border-aeirmist-cyan/40 transition-all font-mono"
                    >
                      <Globe size={13} className="text-aeirmist-cyan" />
                      <span className="font-bold tracking-tight">{(displayUser?.website || displayUser?.socialLinks?.website).replace(/^https?:\/\/(www\.)?/, '')}</span>
                      <ExternalLink size={10} className="opacity-60" />
                    </a>
                  )}
                  {displayUser?.socialLinks?.instagram && (
                    <a 
                      href={`https://instagram.com/${displayUser.socialLinks.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-white/5 dark:border-white/10 text-xs text-slate-700 hover:text-aeirmist-magenta dark:text-white/70 dark:hover:bg-white/10 transition-all"
                    >
                      <Instagram size={13} className="text-aeirmist-magenta" />
                      <span className="font-semibold">{displayUser.socialLinks.instagram}</span>
                    </a>
                  )}
                  {displayUser?.socialLinks?.facebook && (
                    <a 
                      href={`https://facebook.com/${displayUser.socialLinks.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-white/5 dark:border-white/10 text-xs text-slate-700 hover:text-blue-500 dark:text-white/70 dark:hover:bg-white/10 transition-all"
                    >
                      <Facebook size={13} className="text-blue-500" />
                      <span className="font-semibold">{displayUser.socialLinks.facebook}</span>
                    </a>
                  )}
                </div>
              )}

              {isOwnProfile && (
                <div className="mt-4 max-w-xl">
                  <ProfileCompletionCard displayUser={displayUser} postsCount={posts.length} />
                </div>
              )}

              {/* Mutual Friends Banner if inspecting another user */}
              {!isOwnProfile && mutualConnections && mutualConnections.length > 0 && (
                <div 
                  onClick={onOpenMutuals}
                  className="mt-3 inline-flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-aeirmist-cyan/5 border border-aeirmist-cyan/20 hover:bg-aeirmist-cyan/10 hover:border-aeirmist-cyan/40 cursor-pointer transition-all group/mutuals"
                >
                  <div className="flex -space-x-2">
                    {mutualConnections.slice(0, 3).map((m: any) => (
                      <img key={m.id} src={getAvatarUrl(m.photoURL)} alt="" className="w-6 h-6 rounded-lg border border-black object-cover" />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-aeirmist-cyan font-mono group-hover/mutuals:underline">
                    {mutualConnections.length} Mutual Connections
                  </span>
                </div>
              )}
            </div>

            {/* --- STATS ROW ON EXACT SAME LINE --- */}
            <div className="flex flex-wrap items-center gap-8 py-3 border-y border-slate-200/80 dark:border-white/5 w-full justify-center lg:justify-start font-sans">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-slate-900 dark:text-white">{(posts || []).filter(p => p && !p.isArchived).length}</span>
                <span className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">Posts</span>
              </div>
              <div 
                onClick={() => !isLocked && handleShowFollowList?.('followers')}
                className={`flex items-baseline gap-1.5 ${!isLocked ? 'cursor-pointer hover:text-aeirmist-cyan transition-colors' : ''}`}
              >
                {isDataLoading ? (
                  <Skeleton className="h-6 w-8 mb-1 opacity-20" />
                ) : (
                  <span className="text-lg font-black text-slate-900 dark:text-white">{Array.isArray(displayUser?.social?.followers) ? displayUser.social.followers.length : Math.max(0, displayUser?.followersCount || 0)}</span>
                )}
                <span className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">Followers</span>
              </div>
              <div 
                onClick={() => !isLocked && handleShowFollowList?.('following')}
                className={`flex items-baseline gap-1.5 ${!isLocked ? 'cursor-pointer hover:text-aeirmist-cyan transition-colors' : ''}`}
              >
                {isDataLoading ? (
                  <Skeleton className="h-6 w-8 mb-1 opacity-20" />
                ) : (
                  <span className="text-lg font-black text-slate-900 dark:text-white">{Array.isArray(displayUser?.social?.following) ? displayUser.social.following.length : Math.max(0, displayUser?.followingCount || 0)}</span>
                )}
                <span className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">Following</span>
              </div>
              
              <div 
                onClick={onRankClick}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-aeirmist-cyan/5 border border-aeirmist-cyan/20 hover:bg-aeirmist-cyan/10 hover:border-aeirmist-cyan/40 cursor-pointer active:scale-95 transition-all duration-300"
                title="View Rank Spectrum & Benefits"
              >
                <Zap size={13} className="text-aeirmist-cyan animate-[pulse_1.5s_infinite]" />
                <span className="text-sm font-black text-aeirmist-cyan tracking-wider font-mono">
                  {displayUser?.aeirmistLevel || 0} Points
                </span>
              </div>
            </div>

            {/* --- ACTION SUITE GROUPED ON SAME ROW --- */}
            <div className="flex flex-wrap items-center gap-3 w-full justify-center lg:justify-start pt-1 font-sans">
              {isOwnProfile ? (
                <>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsEditingBio(true)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm"
                  >
                    Edit Profile
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleShareProfile}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Share2 size={12} className="text-aeirmist-cyan" />
                    <span>Share Profile</span>
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsNGLDashboardOpen(true)}
                    className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/85 dark:border-white/10 rounded-xl flex items-center justify-center gap-2 transition-all hover:border-aeirmist-magenta/50 cursor-pointer shadow-sm"
                  >
                    <Ghost size={14} className="text-aeirmist-magenta animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Your NGL Messages
                    </span>
                  </motion.button>
                  
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab('saved')}
                    className={`p-2.5 border rounded-xl transition-all cursor-pointer shadow-sm ${
                      activeTab === 'saved' 
                        ? 'bg-aeirmist-cyan border-aeirmist-cyan text-black shadow-[0_0_15px_rgba(0,242,255,0.3)]' 
                        : 'bg-slate-100 border-slate-200/90 text-slate-400 hover:text-slate-800 dark:bg-white/5 dark:border-white/10 dark:text-white/30 dark:hover:text-white'
                    }`}
                    title="Saved Content"
                  >
                    <Bookmark size={15} />
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: isFollowingUser ? 'rgba(255,255,255,0.08)' : 'rgba(0,242,255,1)', color: isFollowingUser ? '#fff' : '#000' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleFollow(displayUser.id, displayUser)}
                    className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl cursor-pointer ${isFollowingUser ? 'bg-white/5 border border-white/10 text-white hover:border-red-500/30 hover:text-red-500' : 'bg-aeirmist-cyan text-black'}`}
                  >
                    {isPendingUser 
                      ? 'Requested' 
                      : isFollowingUser 
                        ? 'Following' 
                        : (isFollowerOfMe ? 'Follow Back' : 'Follow')}
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02, border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)' }}
                    onClick={() => {
                      if (isMessageLocked) {
                        addToast?.({
                          title: 'Message Blocked',
                          message: 'You must follow this account first. No direct message.',
                          type: 'warning'
                        });
                      } else {
                        onMessageClick?.(displayUser);
                      }
                    }}
                    className="px-5 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-white/70 hover:bg-white/[0.05] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest font-mono">
                      {isMessageLocked ? "Follow To Message" : "Transmit DM"}
                    </span>
                  </motion.button>
                  
                  {displayUser?.nglSettings?.enabled !== false && (
                    <motion.button
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsNGLComposerOpen(true)}
                      className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/75 flex items-center justify-center gap-2 transition-all hover:text-white hover:border-aeirmist-magenta/50 cursor-pointer"
                    >
                      <Ghost size={14} className="text-aeirmist-magenta animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Send NGL Signal
                      </span>
                    </motion.button>
                  )}
                  
                  <div className="relative">
                    <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className={`p-2.5 rounded-xl transition-all ${isMenuOpen ? 'bg-aeirmist-magenta text-black bg-opacity-100' : 'bg-white/5 border border-white/10 text-white/30 hover:text-white'}`}
                    >
                      <MoreVertical size={15} />
                    </button>
                    
                    <AnimatePresence>
                      {isMenuOpen && (
                        <motion.div key="desktop-profile-menu-wrapper">
                          <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 mt-3 w-64 bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-3 z-50 shadow-3xl backdrop-blur-3xl"
                          >
                             <button 
                              onClick={() => { toggleCloseFriend(displayUser.id); setIsMenuOpen(false); }} 
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-left transition-colors hover:bg-white/5 ${isFav ? 'text-aeirmist-cyan' : 'text-white/60'}`}
                             >
                               <Sparkles size={16} /> <span>{isFav ? 'Remove from Fav' : 'Add to Favorites'}</span>
                             </button>
                             <div className="h-px bg-[#111115] my-2" />
                             <button 
                              onClick={() => { handleShareProfile(); setIsMenuOpen(false); }} 
                              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-white/60 text-left hover:bg-white/5"
                             >
                               <Link2 size={16} /> <span>Copy Sequence ID</span>
                             </button>
                             <button 
                              onClick={() => { toggleBlockUser(displayUser.id); setIsMenuOpen(false); }} 
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-left hover:bg-red-500/10 ${isBlockedUser ? 'text-red-500' : 'text-red-500/65'}`}
                             >
                               <Ghost size={16} /> <span>{isBlockedUser ? 'Unblock Node' : 'Purge Node (Block)'}</span>
                             </button>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* HIGHLIGHTS CORRIDOR (UPPER MIDDLE) */}
      {!isLocked && (
        <div className="bg-white/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 backdrop-blur-3xl rounded-[2.5rem] p-6 mb-8 shadow-xl relative overflow-hidden group/highlights">
          {/* subtle background mesh glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-aeirmist-cyan/5 blur-[50px] rounded-full pointer-events-none" />
          
          <h3 className="text-[10px] font-black text-slate-500 dark:text-white/40 uppercase tracking-[0.25em] mb-5 select-none pl-2 border-l-2 border-aeirmist-cyan flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aeirmist-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-aeirmist-cyan"></span>
            </span>
            <span>Signals & Highlights Corridor</span>
          </h3>

          <div className="flex gap-8 overflow-x-auto pb-2 mask-fade-right scrollbar-hide px-2">
            {isOwnProfile && (
              <div className="flex flex-col items-center gap-3 shrink-0">
                <button 
                  onClick={handleCreateHighlight}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-white/20 hover:border-aeirmist-cyan hover:text-aeirmist-cyan transition-all bg-slate-50 dark:bg-white/[0.01] hover:bg-aeirmist-cyan/5 group cursor-pointer shadow-sm"
                  title="Create new highlight"
                >
                  <Plus size={28} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
                <span className="text-[9px] font-black uppercase text-slate-400 dark:text-white/35 tracking-widest">Initiate</span>
              </div>
            )}
            
            {highlights.map(h => {
              const isEmpty = !h.stories || h.stories.length === 0;
              return (
                <div 
                  key={h.id} 
                  onClick={(e) => { e.stopPropagation(); handleHighlightClick?.(h); }}
                  className="flex flex-col items-center gap-3 shrink-0 group cursor-pointer"
                >
                  <div className="relative p-1">
                    {/* Rotating holographic light ring */}
                    {!isEmpty && <div className="absolute inset-[-4px] bg-gradient-to-tr from-aeirmist-cyan via-white/5 to-aeirmist-magenta rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-[spin_8s_linear_infinite]" />}
                    <div className="absolute inset-[-2px] bg-white dark:bg-[#01050a] rounded-2xl" />
                    
                    <div className={`relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 dark:bg-neutral-900 group-hover:border-aeirmist-cyan/40 transition-colors duration-500 shadow-xl border ${
                      isEmpty ? 'border-dashed border-red-500/40 bg-red-50 dark:bg-red-950/5' : 'border-slate-200 dark:border-white/10'
                    }`}>
                      {h.coverUrl ? (
                        <img src={h.coverUrl} className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${isEmpty ? 'opacity-40 grayscale' : 'grayscale-[0.5] group-hover:grayscale-0'}`} alt={h.label} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-red-400/50">
                          <span className="text-[9px] font-black uppercase">Empty</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      {isEmpty && (
                        <div className="absolute inset-0 bg-red-950/20 flex items-center justify-center">
                          <span className="text-[8px] font-black uppercase tracking-wider text-red-400">Empty</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-[0.2em] font-sans transition-colors duration-500 text-center truncate max-w-[80px] ${
                    isEmpty ? 'text-red-400/50 group-hover:text-red-400' : 'text-slate-600 dark:text-white/45 group-hover:text-aeirmist-cyan'
                  }`}>
                    {h.label}
                  </span>
                </div>
              );
            })}

            {loadingHighlights && highlights.length === 0 && Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-3 shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse border border-slate-200 dark:border-white/5" />
                <div className="h-2 w-10 bg-slate-200 dark:bg-white/5 rounded animate-pulse" />
              </div>
            ))}

            {!loadingHighlights && highlights.length === 0 && !isOwnProfile && (
              <div className="py-2 text-center text-slate-400 dark:text-white/20 text-[9px] font-black uppercase tracking-widest pl-2">
                No active highlights broadcasted on this channel.
              </div>
            )}
          </div>
        </div>
      )}

      {/* DUAL COLUMN BOTTOM GRID */}
      <div className="grid grid-cols-12 gap-8 w-full overflow-x-hidden">
        
        {/* Left column representing Main Tab-Feed Area (~70%) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Custom Instagram/Aesthetic-style Tab button line WIP */}
          <div className="flex flex-col mt-6 sm:mt-8 sticky top-0 bg-slate-50/95 dark:bg-[#01050a]/90 backdrop-blur-xl z-30 w-full select-none">
            {/* Subtle horizontal divider line directly above the tab bar row */}
            <div className="w-full h-px bg-slate-200 dark:bg-white/[0.08]" />
            <div className="flex border-b border-slate-200 dark:border-white/5 justify-center items-center gap-8 sm:gap-14 md:gap-16 lg:gap-20 w-full" role="tablist" aria-label="Profile tabs">
              {[
                { id: 'tagged', label: 'QUARTS', icon: <Tag size={20} /> },
                { id: 'posts', label: 'PHOTOS', icon: <Grid size={20} /> },
                { id: 'videos', label: 'VIDEOS', icon: <Video size={20} /> },
                ...(isOwnProfile ? [{ id: 'saved', label: 'SAVED', icon: <Bookmark size={20} /> }] : []),
                ...(isOwnProfile ? [{ id: 'archive', label: 'ARCHIVE', icon: <Archive size={20} /> }] : []),
                ...(isOwnProfile ? [{ id: 'vault', label: 'VAULT', icon: <Lock size={20} /> }] : [])
              ].map(tb => (
                <button
                  key={tb.id}
                  onClick={() => {
                    if (tb.id === 'vault') {
                      openVault();
                    } else {
                      setActiveTab(tb.id);
                    }
                  }}
                  role="tab"
                  aria-selected={activeTab === tb.id}
                  aria-controls={`${tb.id}-panel`}
                  id={`${tb.id}-tab`}
                  className={`flex flex-col items-center justify-center gap-2 pt-6 pb-4 text-center transition-all cursor-pointer relative px-1 sm:px-3 select-none ${
                    activeTab === tb.id 
                      ? 'text-slate-900 dark:text-white' 
                      : 'text-slate-400 hover:text-slate-800 dark:text-white/40 dark:hover:text-white/85'
                  }`}
                >
                  <div className={`transition-all duration-300 ${
                    activeTab === tb.id 
                      ? 'text-aeirmist-cyan scale-110 drop-shadow-[0_0_8px_rgba(0,242,255,0.6)]' 
                      : 'text-slate-400 dark:text-white/40'
                  }`}>
                    {tb.icon}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-[0.25em] transition-colors duration-300 ${
                    activeTab === tb.id ? 'text-aeirmist-cyan font-bold' : ''
                  }`}>
                    {tb.label}
                  </span>
                  
                  {/* Clean Bottom Cyan Line for active tab, matching the screenshot perfectly */}
                  {activeTab === tb.id && (
                    <motion.div 
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.85)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Active Tab contents */}
          <div className="w-full">
            {isBlockedUser ? (
              <div className="w-full border border-red-500/20 bg-red-500/[0.02] rounded-[2rem] p-16 text-center space-y-4">
                <Ghost size={32} className="mx-auto text-red-400" />
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Account Blocked</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">You have blocked this account. You cannot view their posts or interact with them.</p>
                <button
                  onClick={() => toggleBlockUser(displayUser.id)}
                  className="px-6 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 text-xs font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <UserCheck size={14} />
                  <span>Unblock @{displayUser.username}</span>
                </button>
              </div>
            ) : isLocked ? (
              <div className="w-full border border-white/5 bg-white/[0.01] rounded-[2rem] p-16 text-center space-y-4">
                <Lock size={32} className="mx-auto text-aeirmist-cyan animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Login required to save</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">This node operates under private secure channels.</p>
              </div>
            ) : (
              <>
                {activeTab === 'posts' && (() => {
                  const isPostVideo = (post: any) => {
                    if (!post) return false;
                    if (post.mediaType === 'video' || post.type === 'video' || post.isVideo) return true;
                    const checkUrl = (url: any) => {
                      if (!url || typeof url !== 'string') return false;
                      const clean = url.split('?')[0].toLowerCase();
                      return clean.endsWith('.mp4') || clean.endsWith('.mov') || clean.endsWith('.webm') || clean.endsWith('.mkv') || url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video');
                    };
                    if (checkUrl(post.mediaUrl) || checkUrl(post.mediaURL)) return true;
                    if (Array.isArray(post.mediaUrls) && post.mediaUrls.some((u: any) => checkUrl(u))) return true;
                    if (Array.isArray(post.mediaItems) && post.mediaItems.some((item: any) => item?.type === 'video' || checkUrl(item?.url))) return true;
                    return false;
                  };

                  const picturePosts = (posts || []).filter(post => post && !post.isArchived).filter(post => {
                    const isVideo = isPostVideo(post);
                    const hasImage = (post.mediaUrls && post.mediaUrls.length > 0) || 
                                     (post.mediaUrl) || 
                                     (post.mediaURL) || 
                                     (post.mediaItems && (Array.isArray(post.mediaItems) ? post.mediaItems.some((item: any) => item?.type === 'image') : false));
                    return hasImage && !isVideo;
                  });
                  return (
                    <div id="posts-panel" role="tabpanel" aria-labelledby="posts-tab" className="grid grid-cols-3 gap-4">
                        {picturePosts.map(post => {
                          if (!post) return null;
                          return <PostCard key={post.id} post={post} onClick={() => setSelectedPost(post)} />;
                        })}
                      {picturePosts.length === 0 && (
                        <div className="col-span-3 py-24 text-center text-white/30 space-y-4 bg-white/[0.01] border border-white/5 rounded-[2.5rem]">
                          <Grid size={40} className="mx-auto text-white/10" />
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em]">Grid Empty</p>
                            <p className="text-[8px] text-white/20 uppercase tracking-widest">No visual Syncs detected in this node.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {activeTab === 'videos' && (() => {
                  const isPostVideo = (post: any) => {
                    if (!post) return false;
                    if (post.mediaType === 'video' || post.type === 'video' || post.isVideo) return true;
                    const checkUrl = (url: any) => {
                      if (!url || typeof url !== 'string') return false;
                      const clean = url.split('?')[0].toLowerCase();
                      return clean.endsWith('.mp4') || clean.endsWith('.mov') || clean.endsWith('.webm') || clean.endsWith('.mkv') || url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video');
                    };
                    if (checkUrl(post.mediaUrl) || checkUrl(post.mediaURL)) return true;
                    if (Array.isArray(post.mediaUrls) && post.mediaUrls.some((u: any) => checkUrl(u))) return true;
                    if (Array.isArray(post.mediaItems) && post.mediaItems.some((item: any) => item?.type === 'video' || checkUrl(item?.url))) return true;
                    return false;
                  };

                  const videoPosts = (posts || []).filter(p => p && !p.isArchived).filter(p => isPostVideo(p));
                  return (
                    <div id="videos-panel" role="tabpanel" aria-labelledby="videos-tab" className="grid grid-cols-3 gap-4">
                        {videoPosts.map(post => {
                          if (!post) return null;
                          return <PostCard key={post.id} post={post} onClick={() => setSelectedPost(post)} />;
                        })}
                      {videoPosts.length === 0 && (
                        <div className="col-span-3 py-24 text-center text-white/30 space-y-4 bg-white/[0.01] border border-white/5 rounded-[2.5rem]">
                          <Video size={40} className="mx-auto text-white/10" />
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em]">No Stream Data</p>
                            <p className="text-[8px] text-white/20 uppercase tracking-widest">Multimedia captures have not been uploaded to the network.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {activeTab === 'saved' && (
                  <div id="saved-panel" role="tabpanel" aria-labelledby="saved-tab" className="grid grid-cols-3 gap-4">
                    {!isOwnProfile ? (
                      <div className="col-span-3 py-20 text-center text-white/30 space-y-3 bg-white/[0.01] border border-white/5 rounded-2xl">
                        <Lock size={32} className="mx-auto text-aeirmist-magenta" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">Encrypted Area Restricted</p>
                        <p className="text-[8px] text-white/20 uppercase tracking-widest mt-1">Saves are only visible to the node master.</p>
                      </div>
                    ) : loadingSavedPosts && (!savedPosts || savedPosts.length === 0) ? (
                      Array(6).fill(0).map((_, i) => (
                        <div key={i} className="aspect-square bg-white/5 animate-pulse rounded-2xl border border-white/5" />
                      ))
                    ) : (
                      <>
                        {(savedPosts || []).map(post => {
                          if (!post) return null;
                          return <PostCard key={post.id} post={post} onClick={() => setSelectedPost(post)} />;
                        })}
                        {(!savedPosts || savedPosts.length === 0) && (
                          <div className="col-span-3 py-20 text-center text-white/30 space-y-3 bg-white/[0.01] border border-white/5 rounded-2xl">
                            <Bookmark size={32} className="mx-auto" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Vault database is unoccupied</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'ngl_replies' && (
                  <div className="space-y-4">
                    {nglSignals && nglSignals.length > 0 ? (
                      nglSignals.filter(m => m.status === 'replied' || isOwnProfile).map(sig => (
                        <div key={sig.id} className="p-6 rounded-2xl bg-white/[0.01] border border-white/5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-aeirmist-magenta text-[9px] font-black uppercase tracking-widest">
                              <Ghost size={14} />
                              <span>Anonymous Message</span>
                            </div>
                            <span className="text-[8px] font-mono text-white/30">
                              {sig.createdAt?.toDate ? sig.createdAt.toDate().toLocaleDateString() : 'Just now'}
                            </span>
                          </div>
                          <p className="text-xs text-white/90 bg-black/40 border border-white/5 p-4 rounded-xl font-medium italic">
                            "{sig.content}"
                          </p>

                          {sig.replyContent ? (
                            <div className="pl-4 border-l-2 border-aeirmist-cyan space-y-2">
                              <span className="text-[8px] font-mono font-black text-aeirmist-cyan uppercase tracking-widest">My Response:</span>
                              <p className="text-xs text-white/85 leading-relaxed font-sans">{sig.replyContent}</p>
                            </div>
                          ) : (
                            isOwnProfile && (
                              <div className="pt-2">
                                {replyingMessageId === sig.id ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={nglReplyInputs[sig.id] || ''}
                                      onChange={(e) => setNglReplyInputs(prev => ({ ...prev, [sig.id]: e.target.value }))}
                                      placeholder="Type a public response..."
                                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-aeirmist-magenta font-sans"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleNGLReplySubmit(sig.id)}
                                        className="px-4 py-1.5 bg-aeirmist-magenta text-black text-[9px] font-black uppercase tracking-widest rounded-lg cursor-pointer"
                                      >
                                        Transmit Reply
                                      </button>
                                      <button
                                        onClick={() => setReplyingMessageId(null)}
                                        className="px-4 py-1.5 bg-white/5 text-white text-[9px] font-black uppercase tracking-widest rounded-lg cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setReplyingMessageId(sig.id)}
                                    className="text-aeirmist-cyan hover:underline text-[9.5px] font-black uppercase tracking-widest flex items-center gap-1 pl-2 scroll-mt-2 font-mono"
                                  >
                                    Transmit Synaptic Response
                                  </button>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center text-white/30 space-y-3 bg-white/[0.01] border border-white/5 rounded-2xl">
                        <Ghost size={32} className="mx-auto text-aeirmist-magenta" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No signal logs detected</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'tagged' && (() => {
                  const textOnlyPosts = (posts || []).filter(post => post && !post.isArchived).filter(post => {
                    if (!post) return false;
                    const hasImage = (post.mediaUrls && post.mediaUrls.length > 0) || 
                                     post.mediaUrl || 
                                     post.mediaURL || 
                                     (post.mediaItems && post.mediaItems.some((item: any) => item?.type === 'image'));
                    const hasVideo = post.mediaType === 'video' || 
                                     (post.mediaItems && (Array.isArray(post.mediaItems) ? post.mediaItems.some((item: any) => item?.type === 'video') : false)) ||
                                     (post.mediaUrls && (Array.isArray(post.mediaUrls) ? post.mediaUrls.some((url: any) => url?.toString().toLowerCase().includes('.mp4') || url?.toString().toLowerCase().includes('video')) : false)) ||
                                     (post.mediaUrl && post.mediaUrl.toString().endsWith('.mp4'));
                    return !hasImage && !hasVideo;
                  });
                  return (
                    <div id="tagged-panel" role="tabpanel" aria-labelledby="tagged-tab" className="flex flex-col w-full max-w-2xl mx-auto pb-24">
                      
                      <div className="divide-y divide-white/5 border-t border-white/5">
                        {(textOnlyPosts || []).map(post => {
                           if (!post) return null;
                           // Enrich post with NGL flag if content suggests it
                           const isNgl = (post.content || '').toLowerCase().includes('ngl reply') || post.isNgl;
                           return (
                            <QuartCard 
                              key={post.id} 
                              post={{...post, isNgl}} 
                              onUserClick={onUserClick} 
                            />
                           );
                        })}
                        
                        {textOnlyPosts.length === 0 && (
                          <div className="py-20 text-center text-white/30 space-y-3">
                            <Tag size={32} className="mx-auto" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No quarts posts detected</p>
                            <p className="text-[8px] text-white/40 uppercase tracking-[0.2em] mt-2">Text-only and caption posts will sync here</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {activeTab === 'marketplace' && (
                  <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-gradient-to-r from-aeirmist-cyan/10 to-aeirmist-magenta/10 border border-white/5">
                      <h4 className="text-xs font-black uppercase tracking-widest text-white mb-1">Points SHOP</h4>
                      <p className="text-[10px] text-white/50 uppercase tracking-wider leading-relaxed">
                        Spend your earned digital social prestige (Points) to unlock luxury themes and visual enhancements!
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'neon_aura_ring', name: 'Neon Avatar Ring', type: 'Framework Mod', cost: 150, desc: 'Illuminates your profile pic with active rotating glowing rings.', color: '#00f2ff', icon: '✨' },
                        { id: 'cyber_cover', name: 'Retro Grid Mesh', type: 'Cover Banner Mod', cost: 300, desc: 'Replaces cover background with retro mesh grid overlays.', color: '#ff00ea', icon: '🌌' },
                        { id: 'monospace_fonts', name: 'Monospace Terminal Font Sync', type: 'Typography Mod', cost: 200, desc: 'Transforms typography fields on your profile interface to CRT retro-style.', color: '#7fe517', icon: '📟' },
                        { id: 'cosmic_badge', name: 'Cosmic Verified Star', type: 'Badge Mod', cost: 500, desc: 'Adds a rotating stellar celestial badge directly next to your profile tag.', color: '#e5c317', icon: '⭐' }
                      ].map(item => {
                        const isPurchased = unlockedItems.includes(item.id);
                        return (
                          <div key={item.id} className="p-5 rounded-2xl bg-[#04080e]/40 border border-white/5 flex flex-col justify-between space-y-4 hover:border-white/10 transition-all">
                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <span className="text-2xl">{item.icon}</span>
                                <span className="text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded bg-white/5 text-white/50">{item.type}</span>
                              </div>
                              <h5 className="text-xs font-black uppercase tracking-wide" style={{ color: item.color }}>{item.name}</h5>
                              <p className="text-[10px] text-white/50 uppercase tracking-wide leading-relaxed">{item.desc}</p>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-white/5">
                              <span className="text-[10px] font-mono font-bold text-white/40">{item.cost} AP Cost</span>
                              {isPurchased ? (
                                <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-400 text-[8px] font-black uppercase tracking-widest rounded select-none">UNLOCKED</span>
                              ) : (
                                isOwnProfile ? (
                                  <button
                                    onClick={() => purchaseMarketplaceItem(item.id, item.cost)}
                                    className="px-4 py-1.5 bg-aeirmist-cyan hover:bg-white text-black hover:text-black font-black text-[8px] uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                                  >
                                    Unlock Mod
                                  </button>
                                ) : (
                                  <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">NOT OWNED</span>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'archive' && isOwnProfile && (() => {
                  const archivedPosts = (posts || []).filter(post => post && post.isArchived);
                  return (
                    <div id="archive-panel" role="tabpanel" aria-labelledby="archive-tab" className="grid grid-cols-3 gap-4">
                      {archivedPosts.map(post => {
                        if (!post) return null;
                        return <PostCard key={post.id} post={post} onClick={() => setSelectedPost(post)} />;
                      })}
                      {archivedPosts.length === 0 && (
                        <div className="col-span-3 py-24 text-center text-white/30 space-y-4 bg-white/[0.01] border border-white/5 rounded-[2.5rem]">
                          <Archive size={40} className="mx-auto text-white/10" />
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em]">Archive Empty</p>
                            <p className="text-[8px] text-white/20 uppercase tracking-widest">No archived posts found.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        {/* Right column representing sidebar suggested space (~30%) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          
          {/* SUGGESTED CONNECTIONS */}
          <div className="p-6 rounded-2xl bg-[#04080e]/60 border border-white/5 space-y-4 font-sans backdrop-blur-3xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40 font-mono">Suggested Connections</span>
              <Activity size={14} className="text-aeirmist-cyan" />
            </div>
            <div className="space-y-4">
              {rightPanelSuggestions.map((p: any) => {
                const followed = checkIsFollowing?.(p.id);
                const pending = isFollowPending?.(p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-2 hover:bg-white/[0.02] rounded-xl transition-all">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img 
                        onClick={() => onUserClick?.(p)} 
                        src={getAvatarUrl(p.photoURL)} 
                        className="w-10 h-10 rounded-xl object-cover border border-white/10 bg-neutral-900 cursor-pointer hover:border-aeirmist-cyan transition-colors" 
                        alt="" 
                      />
                      <div className="min-w-0">
                        <p onClick={() => onUserClick?.(p)} className="text-xs font-bold text-white truncate hover:underline cursor-pointer">{p.displayName || p.username}</p>
                        <p className="text-[9px] font-mono text-white/40 truncate">@{p.username}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => toggleFollow(p.id, p)}
                      className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all select-none cursor-pointer ${
                        followed ? 'bg-white/5 text-white border border-white/10 hover:text-red-500 hover:border-red-500/30' : 'bg-aeirmist-cyan text-black'
                      }`}
                    >
                      {pending ? 'Syncing' : followed ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
              {rightPanelSuggestions.length === 0 && (
                <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest text-center py-4">No suggestions indexing</p>
              )}
            </div>
          </div>

          {/* TRENDING CREATORS */}
          <div className="p-6 rounded-2xl bg-[#04080e]/60 border border-white/5 space-y-4 font-sans backdrop-blur-3xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40 font-mono">Trending Creators</span>
              <Crown size={14} className="text-yellow-500 animate-pulse" />
            </div>
            <div className="space-y-4">
              {rightPanelTrending.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-2 hover:bg-white/[0.02] rounded-xl transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img onClick={() => onUserClick?.(p)} src={getAvatarUrl(p.photoURL)} className="w-10 h-10 rounded-xl object-cover border border-white/10 bg-neutral-900 cursor-pointer hover:border-yellow-500 transition-colors" alt="" />
                    <div className="min-w-0">
                      <p onClick={() => onUserClick?.(p)} className="text-xs font-bold text-white truncate hover:underline cursor-pointer">{p.displayName || p.username}</p>
                      <p className="text-[9px] font-mono text-white/40 truncate">@{p.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9.5px] font-black text-yellow-500 uppercase font-mono">{p.aeirmistLevel || 0} AP</p>
                    <p className="text-[7.5px] uppercase text-white/30 font-bold tracking-widest">
                      Level {p.aeirmistLevel && p.aeirmistLevel > 1000 ? 5 : 2}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
});
