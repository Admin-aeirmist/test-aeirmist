import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  TrendingUp, 
  Clock, 
  Bookmark, 
  Grid, 
  List,
  Search,
  Zap,
  ArrowLeft,
  ChevronRight,
  X,
  UploadCloud,
  Sliders,
  Sparkles,
  Heart,
  ShieldCheck,
  RotateCcw,
  Trash2,
  ListVideo,
  Compass,
  Film,
  Flame,
  UserCheck
} from 'lucide-react';
import { Video, VIDEO_CATEGORIES, VideoCategory, VideoPlaylist } from '../../types/videos';
import { VideoCard } from './VideoCard';
import { VideoWatchPage } from './VideoWatchPage';
import { useAeirmist } from '../../context/AeirmistContext';
import { useAppearance } from '../../context/AppearanceContext';
import { collection, onSnapshot, query, doc, updateDoc, increment } from 'firebase/firestore';
import { AeirmistVideoUploader } from './AeirmistVideoUploader';
import { AeirmistCreatorStudio } from './AeirmistCreatorStudio';
import { getAvatarUrl } from '../../lib/avatar';
import { formatDuration, formatTimeLeft, getPlaybackProgressMap, getWatchHistory, clearWatchHistory, getLocalPlaylists } from '../../utils/videoStorage';
import { logger } from '@/src/utils/logger';


interface VideoFeedProps {
  onBack: () => void;
  onUserClick: (userData: any) => void;
  initialVideoId?: string | null;
  onVideoClick?: (id: string | null) => void;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({ 
  onBack, 
  onUserClick,
  initialVideoId,
  onVideoClick
}) => {
  const { settings } = useAppearance();
  const isGlobalBgActive = settings.globalBgType !== 'none' && !!settings.globalBgValue;
  const { profile, addToast, db } = useAeirmist();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    'featured' | 'trending' | 'recommended' | 'following' | 'new' | 'continue' | 'categories' | 'saved' | 'history' | 'playlists'
  >('featured');

  const [selectedCategory, setSelectedCategory] = useState<VideoCategory | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Real DB state
  const [dbVideos, setDbVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Modals
  const [showUploader, setShowUploader] = useState(false);
  const [showStudio, setShowStudio] = useState(false);

  // Listen to Firestore 'videos' collection in real-time
  useEffect(() => {
    if (!db) {
      setDbVideos([]);
      return;
    }
    const q = collection(db, 'videos');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Video);
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDbVideos(list);
    }, (error) => {
      logger.error('[VideoFeed] Real-time snap error:', error);
    });

    return () => unsubscribe();
  }, [db]);

  // Handle deep link loading from props
  useEffect(() => {
    if (initialVideoId && !selectedVideo && dbVideos.length > 0) {
      const match = dbVideos.find(v => v.id === initialVideoId);
      if (match) setSelectedVideo(match);
    }
  }, [initialVideoId, dbVideos]);

  // Sync selection back to parent URL router
  useEffect(() => {
    onVideoClick?.(selectedVideo?.id || null);
  }, [selectedVideo?.id]);

  // Playback Progress & History maps
  const progressMap = getPlaybackProgressMap();
  const watchHistoryIds = getWatchHistory();
  const localPlaylists = getLocalPlaylists();

  // Filtered lists based on active tab and search
  const filterVideos = (vList: Video[]) => {
    const blockedList = new Set(profile?.social?.blocked || []);
    let list = vList.filter(v => {
      const cId = v.creatorId || (v as any).authorId || (v as any).author?.id;
      // Exclude temporary/unreachable local browser blobs so users never get "Couldn't load this video"
      const isBrokenBlob = v.videoURL && v.videoURL.startsWith('blob:');
      return !blockedList.has(cId) && !isBrokenBlob;
    });

    if (searchTerm.trim()) {
      const rawTerm = searchTerm.trim().toLowerCase();
      // Strip leading @ for creator handle queries
      const term = rawTerm.startsWith('@') ? rawTerm.slice(1).trim() : rawTerm;
      const tokens = term.split(/\s+/).filter(Boolean);

      list = list.filter(v => {
        const title = (v.title || '').toLowerCase();
        const caption = (v.caption || '').toLowerCase();
        const creatorName = (v.creatorName || (v as any).authorName || (v as any).author?.displayName || (v as any).author?.name || '').toLowerCase();
        const creatorUsername = ((v as any).creatorUsername || (v as any).username || (v as any).author?.username || '').toLowerCase();
        const category = (v.category || '').toLowerCase();
        
        let tagsStr = '';
        if (Array.isArray(v.tags)) {
          tagsStr = v.tags.filter(t => typeof t === 'string').join(' ').toLowerCase();
        } else if (typeof v.tags === 'string') {
          tagsStr = (v.tags as string).toLowerCase();
        }

        const searchableText = `${title} ${caption} ${creatorName} ${creatorUsername} ${category} ${tagsStr}`;

        // 1. Direct substring match on any key field
        if (
          title.includes(term) ||
          caption.includes(term) ||
          creatorName.includes(term) ||
          creatorUsername.includes(term) ||
          category.includes(term) ||
          tagsStr.includes(term)
        ) {
          return true;
        }

        // 2. Multi-token match: all words present
        if (tokens.length > 1 && tokens.every(tok => searchableText.includes(tok))) {
          return true;
        }

        return false;
      });
    }
    if (selectedCategory !== 'All') {
      list = list.filter(v => v.category === selectedCategory);
    }
    return list;
  };

  const allFilteredVideos = filterVideos(dbVideos);

  // Continue watching list (excluding broken blobs)
  const continueWatchingVideos = dbVideos.filter(v => progressMap[v.id] && (!v.videoURL || !v.videoURL.startsWith('blob:')));

  // Featured video (top valid cloud video or explicitly marked featured)
  const validVideos = dbVideos.filter(v => v.videoURL && !v.videoURL.startsWith('blob:'));
  const featuredVideo = validVideos.find(v => v.isFeatured) || validVideos[0] || null;

  // Tab-specific video lists
  const getTabVideos = (): Video[] => {
    switch (activeTab) {
      case 'trending':
        return [...allFilteredVideos].sort((a, b) => ((b.likeCount || 0) + (b.viewCount || 0)) - ((a.likeCount || 0) + (a.viewCount || 0)));
      case 'recommended':
        return [...allFilteredVideos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      case 'following':
        if (profile?.social?.following) {
          return allFilteredVideos.filter(v => profile.social.following.includes(v.creatorId));
        }
        return [];
      case 'new':
        return [...allFilteredVideos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'saved':
        return profile?.id ? allFilteredVideos.filter(v => v.savedBy?.includes(profile.id)) : [];
      case 'history':
        return watchHistoryIds.map(id => dbVideos.find(v => v.id === id)).filter(Boolean) as Video[];
      default:
        return allFilteredVideos;
    }
  };

  const displayVideos = getTabVideos();
  const isCreatorAccount = profile?.accountType === 'professional' || profile?.accountType === 'business';

  // If a video is selected, render the dedicated Watch Page!
  if (selectedVideo) {
    return (
      <VideoWatchPage
        video={selectedVideo}
        allVideos={dbVideos}
        onSelectVideo={(video) => setSelectedVideo(video)}
        onBack={() => setSelectedVideo(null)}
        onUserClick={onUserClick}
      />
    );
  }

  return (
    <div className={`flex flex-col h-full ${isGlobalBgActive ? 'bg-[#050505]/40 backdrop-blur-xl' : 'bg-[#050505]'} relative overflow-y-auto overflow-x-hidden no-scrollbar font-sans text-white pb-28 min-w-0 w-full`}>
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#050505]/90 backdrop-blur-3xl border-b border-white/5 px-3.5 py-3 sm:px-6 flex flex-row items-center justify-between gap-2.5 sm:gap-4 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2.5 sm:gap-3 shrink min-w-0">
          <motion.button 
            whileHover={{ x: -2 }}
            onClick={onBack}
            className="p-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors shrink-0"
            aria-label="Back to feed"
          >
            <ArrowLeft size={18} />
          </motion.button>
          
          <div className="flex items-center gap-2 min-w-0">
             <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-aeirmist-cyan/20 to-blue-600/20 items-center justify-center border border-aeirmist-cyan/30 text-aeirmist-cyan flex shadow-[0_0_15px_rgba(0,242,255,0.15)] shrink-0">
               <Film size={18} className="sm:hidden" />
               <Film size={20} className="hidden sm:block" />
             </div>
             <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white uppercase tracking-wider truncate">Aeirmist Cinema</h1>
                <p className="text-[9px] sm:text-[10px] text-white/40 font-medium truncate hidden sm:block">Long-Form Video Experience</p>
             </div>
          </div>
        </div>

        {/* Desktop Video Search */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
           <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" size={16} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search videos, creators, or topics..." 
                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan/50 transition-all font-medium"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
           </div>
        </div>

        {/* Creator Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isCreatorAccount && (
            <button
              onClick={() => {
                addToast({
                  title: 'CREATOR STUDIO',
                  message: 'Shift your account to Professional in Settings to unlock Studio tools.',
                  type: 'info'
                });
                setShowStudio(true);
              }}
              className="hidden sm:block px-3 py-1.5 border border-aeirmist-magenta/30 bg-aeirmist-magenta/10 hover:bg-aeirmist-magenta/20 text-xs font-semibold text-white rounded-xl transition-all"
            >
              Get Studio
            </button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowUploader(true)}
            className="px-3 py-1.5 sm:px-3.5 sm:py-1.5 bg-aeirmist-cyan hover:bg-opacity-90 text-black text-xs font-bold rounded-xl transition-all shadow-[0_0_12px_rgba(0,242,255,0.2)] flex items-center gap-1.5 shrink-0"
          >
            <UploadCloud size={15} /> <span>Upload</span>
          </motion.button>

          {isCreatorAccount && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowStudio(true)}
              className="p-1.5 sm:p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all shrink-0"
              title="Creator Studio"
            >
              <Sliders size={16} />
            </motion.button>
          )}
        </div>
      </header>

      {/* Mobile Search Bar */}
      <div className="px-3.5 pt-2.5 pb-0 md:hidden w-full max-w-full">
         <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" size={15} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search videos, creators, or topics..." 
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-9 pr-8 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan/50 transition-all font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
         </div>
      </div>

      {/* Primary Category & Filter Navigation Bar */}
      <div className="sticky top-[57px] sm:top-[61px] z-30 bg-[#050505]/95 backdrop-blur-2xl border-b border-white/5 px-3.5 sm:px-6 py-2 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full max-w-full">
        <TabButton id="featured" label="Featured" icon={<Sparkles size={14} />} active={activeTab === 'featured'} onClick={() => setActiveTab('featured')} />
        <TabButton id="trending" label="Trending" icon={<Flame size={14} />} active={activeTab === 'trending'} onClick={() => setActiveTab('trending')} />
        <TabButton id="recommended" label="Recommended" icon={<Compass size={14} />} active={activeTab === 'recommended'} onClick={() => setActiveTab('recommended')} />
        <TabButton id="following" label="Following" icon={<UserCheck size={14} />} active={activeTab === 'following'} onClick={() => setActiveTab('following')} />
        <TabButton id="new" label="New Releases" icon={<Clock size={14} />} active={activeTab === 'new'} onClick={() => setActiveTab('new')} />
        {continueWatchingVideos.length > 0 && (
          <TabButton id="continue" label="Continue Watching" icon={<Play size={14} />} active={activeTab === 'continue'} onClick={() => setActiveTab('continue')} />
        )}
        <TabButton id="saved" label="Saved" icon={<Bookmark size={14} />} active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} />
        <TabButton id="history" label="History" icon={<Clock size={14} />} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
      </div>

      {/* Main Container */}
      <div className="p-3.5 sm:p-6 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
        
        {/* 1. CINEMATIC FEATURED HERO SECTION */}
        {activeTab === 'featured' && featuredVideo && !searchTerm && (
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-t from-black via-black/60 to-transparent border border-white/10 shadow-2xl group w-full">
            <div className="aspect-[16/9] sm:aspect-[21/9] w-full relative overflow-hidden bg-black">
              <img 
                src={featuredVideo.thumbnailURL || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200'}
                alt={featuredVideo.title || featuredVideo.caption}
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
            </div>

            {/* Featured Details Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 flex flex-col gap-2 sm:gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-aeirmist-cyan/20 border border-aeirmist-cyan/40 text-aeirmist-cyan text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  Featured
                </span>
                {featuredVideo.category && (
                  <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/10 text-white/80 text-[10px] sm:text-xs font-medium">
                    {featuredVideo.category}
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-4xl font-extrabold text-white tracking-tight line-clamp-2 leading-tight">
                {featuredVideo.title || featuredVideo.caption}
              </h2>

              <p className="text-xs sm:text-sm text-white/70 max-w-2xl line-clamp-2 hidden sm:block">
                {featuredVideo.description || featuredVideo.caption}
              </p>

              <div className="flex items-center gap-3 sm:gap-4 pt-1 sm:pt-2">
                <button
                  onClick={() => setSelectedVideo(featuredVideo)}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-aeirmist-cyan hover:bg-opacity-90 text-black font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg flex items-center gap-2"
                >
                  <Play size={16} className="fill-current sm:w-[18px] sm:h-[18px]" /> Watch Now
                </button>

                <div className="flex items-center gap-2 text-xs text-white/60">
                  <img 
                    src={getAvatarUrl(featuredVideo.creatorAvatar, featuredVideo.creatorName)} 
                    alt={featuredVideo.creatorName}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-white/20"
                  />
                  <span className="font-medium text-white/90 text-xs truncate max-w-[100px] sm:max-w-none">{featuredVideo.creatorName}</span>
                  {featuredVideo.isVerified && <ShieldCheck size={14} className="text-aeirmist-cyan shrink-0" />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. CONTINUE WATCHING ROW */}
        {continueWatchingVideos.length > 0 && activeTab === 'featured' && !searchTerm && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock size={18} className="text-aeirmist-cyan" /> Continue Watching
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {continueWatchingVideos.slice(0, 3).map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onSelect={(video) => setSelectedVideo(video)}
                  onUserClick={onUserClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* 3. CATEGORY SELECTOR CHIPS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/50">Browse Categories</h3>
            {selectedCategory !== 'All' && (
              <button onClick={() => setSelectedCategory('All')} className="text-xs text-aeirmist-cyan hover:underline">
                Clear Category Filter
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'All'
                  ? 'bg-white text-black font-bold'
                  : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
              }`}
            >
              All Categories
            </button>
            {VIDEO_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-aeirmist-cyan text-black font-bold'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 4. WATCH HISTORY HEADER CONTROLS */}
        {activeTab === 'history' && displayVideos.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
            <span className="text-xs text-white/60">Your viewing history is private and visible only to you.</span>
            <button
              onClick={() => {
                clearWatchHistory();
                addToast({ title: 'HISTORY CLEARED', message: 'Your watch history has been cleared.', type: 'info' });
              }}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={14} /> Clear History
            </button>
          </div>
        )}

        {/* 5. PRIMARY RESPONSIVE LANDSCAPE VIDEO GRID (2-4 columns) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white uppercase tracking-wider capitalize">
              {activeTab === 'featured' ? 'Discover Videos' : activeTab}
            </h2>
            <span className="text-xs text-white/40">{displayVideos.length} videos</span>
          </div>

          {displayVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onSelect={(v) => setSelectedVideo(v)}
                  onUserClick={onUserClick}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-white/5 border border-white/5 rounded-3xl space-y-4">
              <div className="w-12 h-12 rounded-full bg-white/10 text-white/40 flex items-center justify-center mx-auto">
                <Film size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">No videos found.</h3>
                <p className="text-xs text-white/50 max-w-sm mx-auto">
                  Explore other categories or upload a new video to start building your library.
                </p>
              </div>
              <button
                onClick={() => setShowUploader(true)}
                className="px-5 py-2.5 bg-aeirmist-cyan text-black font-bold text-xs rounded-xl shadow-lg hover:bg-opacity-90 transition-all inline-flex items-center gap-2"
              >
                <UploadCloud size={16} /> Upload Video
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Uploader Modal */}
      <AnimatePresence>
        {showUploader && (
          <AeirmistVideoUploader
            onClose={() => setShowUploader(false)}
            onUploadSuccess={() => setShowUploader(false)}
          />
        )}
      </AnimatePresence>

      {/* Creator Studio Modal */}
      <AnimatePresence>
        {showStudio && (
          <AeirmistCreatorStudio
            onClose={() => setShowStudio(false)}
            onNavigateToVideo={(id) => {
              setShowStudio(false);
              const match = dbVideos.find(v => v.id === id);
              if (match) setSelectedVideo(match);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface TabButtonProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all ${
      active
        ? 'bg-white text-black font-bold shadow-md'
        : 'bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default VideoFeed;
