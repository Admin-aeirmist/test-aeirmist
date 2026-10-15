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
import { collection, query, doc, updateDoc, increment, getDocs, limit } from 'firebase/firestore';
import { AeirmistVideoUploader } from './AeirmistVideoUploader';
import { AeirmistCreatorStudio } from './AeirmistCreatorStudio';
import { getAvatarUrl } from '../../lib/avatar';
import { formatDuration, formatTimeLeft, getPlaybackProgressMap, getWatchHistory, clearWatchHistory, getLocalPlaylists } from '../../utils/videoStorage';
import { logger } from '@/src/utils/logger';
import { api } from '../../services/api/client';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';


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
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  
  // Real DB state (hydrated instantly from local cache)
  const [dbVideos, setDbVideos] = useState<Video[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('aeirmist_cached_videos');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Modals
  const [showUploader, setShowUploader] = useState(false);
  const [showStudio, setShowStudio] = useState(false);

  // Fetch videos (PostgreSQL API primary, fallback to getDocs)
  useEffect(() => {
    let isMounted = true;
    const fetchVideos = async () => {
      try {
        const apiRes = await api.videos.getFeed(30, 0).catch(() => null);
        if (apiRes && Array.isArray(apiRes.videos) && apiRes.videos.length > 0) {
          if (!isMounted) return;
          setDbVideos(apiRes.videos);
          try {
            localStorage.setItem('aeirmist_cached_videos', JSON.stringify(apiRes.videos.slice(0, 30)));
          } catch {}
          return;
        }

        if (db) {
          const q = query(collection(db, 'videos'), limit(30));
          const snapshot = await getDocs(q);
          const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Video);
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          if (list.length > 0 && isMounted) {
            setDbVideos(list);
            try {
              localStorage.setItem('aeirmist_cached_videos', JSON.stringify(list.slice(0, 30)));
            } catch {}
          }
        }
      } catch (error) {
        logger.error('[VideoFeed] Fetch error:', error);
      }
    };

    fetchVideos();
    return () => { isMounted = false; };
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

  // Unified YouTube Filter Chips
  const filterChips: { id: string; label: string; icon?: React.ReactNode; isTab?: boolean; category?: VideoCategory }[] = [
    { id: 'all', label: 'All', isTab: true },
    { id: 'trending', label: 'Trending', isTab: true, icon: <Flame size={13} className="text-orange-500 fill-orange-500" /> },
    { id: 'following', label: 'Following', isTab: true },
    ...VIDEO_CATEGORIES.map(cat => ({ id: `cat_${cat}`, label: cat, category: cat })),
    { id: 'saved', label: 'Saved', isTab: true, icon: <Bookmark size={13} /> },
    { id: 'history', label: 'History', isTab: true, icon: <Clock size={13} /> },
  ];

  return (
    <div className={`flex flex-col h-full ${isGlobalBgActive ? 'bg-[#050505]/80 backdrop-blur-xl' : 'bg-[#050505]'} relative overflow-y-auto overflow-x-hidden no-scrollbar font-sans text-white pb-24 min-w-0 w-full`}>
      
      {/* 1. AEIRMIST APP HEADER */}
      <header 
        className={`sticky top-0 z-40 ${isGlobalBgActive ? 'bg-black/30 backdrop-blur-xl' : 'bg-[#050505]/95 backdrop-blur-md'} border-b border-white/5 px-3 py-2 sm:px-6 flex flex-row items-center justify-between gap-2.5 w-full max-w-full overflow-hidden transition-all`}
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.35rem)' }}
      >
        <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0">
          <button 
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full text-white/80 hover:text-white active:bg-white/10 transition-colors shrink-0"
            aria-label="Back to feed"
          >
            <ArrowLeft size={19} />
          </button>
          
          {/* Aeirmist Signature Cinema Logo */}
          <div 
            className="flex items-center gap-2 select-none cursor-pointer" 
            onClick={() => { 
              setActiveTab('featured'); 
              setSelectedCategory('All'); 
              setSearchTerm(''); 
            }}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-aeirmist-cyan/20 to-blue-600/20 items-center justify-center border border-aeirmist-cyan/30 text-aeirmist-cyan flex shadow-[0_0_15px_rgba(0,242,255,0.2)] shrink-0">
              <Film size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white uppercase tracking-wider truncate">
                Aeirmist Cinema
              </h1>
              <p className="text-[9px] text-white/40 font-medium truncate hidden sm:block">
                Long-Form Video Experience
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Video Search Bar */}
        <div className="flex-1 max-w-lg mx-6 hidden md:block">
           <div className="relative flex items-center">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search videos, creators, or topics..." 
                className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-4 pr-10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-aeirmist-cyan/50 transition-all font-normal"
              />
              <div className="absolute right-0 top-0 bottom-0 px-3.5 bg-white/[0.03] border-l border-white/10 rounded-r-full flex items-center justify-center text-white/50">
                <Search size={15} />
              </div>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-12 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
           </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mobile Search Icon Toggle */}
          <button
            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            className="p-2 text-white/80 hover:text-white active:bg-white/10 rounded-full transition-colors md:hidden"
            aria-label="Search"
          >
            <Search size={19} />
          </button>

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
              className="hidden lg:block px-3 py-1.5 border border-aeirmist-magenta/30 bg-aeirmist-magenta/10 hover:bg-aeirmist-magenta/20 text-xs font-semibold text-white rounded-full transition-all"
            >
              Get Studio
            </button>
          )}

          {/* Aeirmist Signature Cyan Upload Button */}
          <button
            onClick={() => setShowUploader(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 bg-aeirmist-cyan hover:bg-opacity-90 text-black text-xs font-bold rounded-xl transition-all shadow-[0_0_12px_rgba(0,242,255,0.25)] shrink-0"
          >
            <UploadCloud size={15} />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {isCreatorAccount && (
            <button
              onClick={() => setShowStudio(true)}
              className="p-2 text-white/80 hover:text-white active:bg-white/10 rounded-full transition-colors"
              title="Creator Studio"
            >
              <Sliders size={18} />
            </button>
          )}
        </div>
      </header>

      {/* 2. EXPANDABLE MOBILE SEARCH BAR */}
      {isMobileSearchOpen && (
        <div className="px-3 py-2 bg-[#050505] border-b border-white/5 md:hidden animate-in fade-in duration-150">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 text-white/40" size={15} />
            <input 
              type="text" 
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search videos, creators, or topics..." 
              className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-9 pr-9 text-xs text-white placeholder-white/40 focus:outline-none focus:border-aeirmist-cyan/50"
            />
            {searchTerm ? (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 text-white/40 hover:text-white"
              >
                <X size={14} />
              </button>
            ) : (
              <button 
                onClick={() => setIsMobileSearchOpen(false)}
                className="absolute right-3 text-white/40 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. AEIRMIST SIGNATURE FILTER CHIPS RIBBON (Sticky Horizontal Scroll) */}
      <div className="sticky top-[45px] sm:top-[53px] z-30 bg-[#050505] border-b border-white/5 px-3 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full">
        {filterChips.map((chip) => {
          const isActive = chip.id === 'all' 
            ? (activeTab === 'featured' && selectedCategory === 'All')
            : chip.isTab 
              ? (activeTab === chip.id && selectedCategory === 'All')
              : (selectedCategory === chip.category);

          return (
            <button
              key={chip.id}
              onClick={() => {
                triggerNativeHaptic('light');
                if (chip.id === 'all') {
                  setActiveTab('featured');
                  setSelectedCategory('All');
                } else if (chip.isTab) {
                  setActiveTab(chip.id as any);
                  setSelectedCategory('All');
                } else if (chip.category) {
                  setSelectedCategory(chip.category);
                  setActiveTab('featured');
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-aeirmist-cyan text-black font-bold shadow-[0_0_12px_rgba(0,242,255,0.3)] border border-aeirmist-cyan/50'
                  : 'bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/70 hover:text-white border border-white/10'
              }`}
            >
              {chip.icon}
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. MAIN VIDEO CONTENT FEED */}
      <div className="p-0 sm:p-6 space-y-4 sm:space-y-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden pt-2 sm:pt-0">
        
        {/* 4A. CINEMATIC FEATURED HERO SECTION (Desktop Only) */}
        {activeTab === 'featured' && selectedCategory === 'All' && featuredVideo && !searchTerm && (
          <div className="hidden sm:block relative rounded-3xl overflow-hidden bg-gradient-to-t from-black via-black/60 to-transparent border border-white/10 shadow-2xl group w-full mb-6">
            <div className="aspect-[21/9] w-full relative overflow-hidden bg-black">
              <img 
                src={featuredVideo.thumbnailURL || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200'}
                alt={featuredVideo.title || featuredVideo.caption}
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/40 to-transparent" />
            </div>

            {/* Featured Details Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <Flame size={12} /> Featured
                </span>
                {featuredVideo.category && (
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium">
                    {featuredVideo.category}
                  </span>
                )}
              </div>

              <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight line-clamp-2 leading-tight">
                {featuredVideo.title || featuredVideo.caption}
              </h2>

              <p className="text-sm text-white/70 max-w-2xl line-clamp-2">
                {featuredVideo.description || featuredVideo.caption}
              </p>

              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={() => setSelectedVideo(featuredVideo)}
                  className="px-6 py-3 bg-white hover:bg-white/90 text-black font-bold text-sm rounded-full transition-all shadow-lg flex items-center gap-2"
                >
                  <Play size={18} className="fill-current" /> Watch Now
                </button>

                <div className="flex items-center gap-2 text-xs text-white/60">
                  <img 
                    src={getAvatarUrl(featuredVideo.creatorAvatar, featuredVideo.creatorName)} 
                    alt={featuredVideo.creatorName}
                    className="w-6 h-6 rounded-full object-cover border border-white/20"
                  />
                  <span className="font-medium text-white/90 text-xs">{featuredVideo.creatorName}</span>
                  {featuredVideo.isVerified && <ShieldCheck size={14} className="text-aeirmist-cyan shrink-0" />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4B. CONTINUE WATCHING SHELF (YouTube Style Horizontal Scroll) */}
        {continueWatchingVideos.length > 0 && activeTab === 'featured' && selectedCategory === 'All' && !searchTerm && (
          <div className="space-y-2.5 py-2 sm:py-4 border-b border-[#222] sm:border-0">
            <div className="flex items-center justify-between px-3.5 sm:px-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                <Clock size={16} className="text-aeirmist-cyan" /> Continue Watching
              </h2>
              <span className="text-xs text-white/40 font-mono">{continueWatchingVideos.length} in progress</span>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar px-3.5 sm:px-0 pb-1 scroll-smooth">
              {continueWatchingVideos.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  layout="compact"
                  onSelect={(video) => setSelectedVideo(video)}
                  onUserClick={onUserClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* 4C. WATCH HISTORY CONTROLS */}
        {activeTab === 'history' && displayVideos.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-[#181818] border border-white/5 rounded-2xl mx-3 sm:mx-0">
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

        {/* 4D. PRIMARY RESPONSIVE VIDEO FEED (YouTube Edge-to-Edge on Mobile) */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between px-3.5 sm:px-0">
            <h2 className="text-xs sm:text-sm font-bold text-white/60 uppercase tracking-wider">
              {selectedCategory !== 'All' ? selectedCategory : (activeTab === 'featured' ? 'Recommended' : activeTab)}
            </h2>
            <span className="text-[11px] text-white/40 font-mono">{displayVideos.length} videos</span>
          </div>

          {displayVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 sm:gap-6">
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
            <div className="text-center py-16 px-4 bg-[#181818] border border-white/5 rounded-2xl sm:rounded-3xl space-y-4 mx-3 sm:mx-0">
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
                className="px-5 py-2.5 bg-aeirmist-cyan hover:bg-opacity-90 text-black font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(0,242,255,0.25)] transition-all inline-flex items-center gap-2"
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
