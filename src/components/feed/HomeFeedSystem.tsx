import { useAeirmist } from '../../context/AeirmistContext';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppearance } from '../../context/AppearanceContext';
import { StoriesSystem } from './StoriesSystem';
import { PremiumPostCard } from './PremiumPostCard';
import { 
  Loader2,
  Plus,
  Bell,
  Camera,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Bookmark,
  Users,
  Compass
} from 'lucide-react';
import { api } from '../../services/api/client';
import { getSocket } from '../../services/api/socket';
import { AeirmistLogo } from '../ui/AeirmistLogo';
import { getAvatarUrl, BLANK_DP } from '../../lib/avatar';
import { Skeleton } from '../ui/Skeleton';
import { logger } from '@/src/utils/logger';
import { LocalSqlService } from '../../services/LocalSqlService';
import { feedRankingService, FeedMode } from '../../services/FeedRankingService';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';


export const HomeFeedSystem: React.FC<{ onUserClick?: (user: any) => void, onPostClick?: (postId: string) => void, onCreate?: () => void, onNavigate?: (tab: string, param?: string) => void }> = React.memo(({ onUserClick, onPostClick, onCreate, onNavigate }) => {
  const [posts, setPosts] = useState<any[]>(() => {
    // Attempt instant hydration from local cache
    try {
      const cached = localStorage.getItem('aeirmist_home_feed_cache');
      if (cached) return JSON.parse(cached);
    } catch (e) {
      logger.warn("Feed hydration failed", e);
    }
    return [];
  });
  const [loading, setLoading] = useState(posts.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<{ message: string; details: string; link?: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [feedMode, setFeedMode] = useState<FeedMode>(() => feedRankingService.getFeedMode());
  const [feedbackEpoch, setFeedbackEpoch] = useState(0);
  const isInitialLoad = React.useRef(true);
  const { user, profile, permissions, requestPermission, setCameraConfig, addToast, unreadNotificationsCount } = useAeirmist();
  const { settings } = useAppearance(); 
  const isGlobalBgActive = settings.globalBgType !== 'none' && !!settings.globalBgValue;

  // Hydrate from Local SQLite/IndexedDB vault on mount + safety timeout
  useEffect(() => {
    LocalSqlService.getFeedPosts(20).then(cached => {
      if (cached && cached.length > 0) {
        setPosts(prev => prev.length === 0 ? cached.map(c => c.raw || c) : prev);
        setLoading(false);
      }
    }).catch(e => logger.warn("Local DB hydration failed", e));

    // Instant safety fallback: if no posts loaded within 1.2s, dismiss skeleton to prevent black blank freeze
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    return () => clearTimeout(safetyTimer);
  }, []);

  // Listen to external feedback events (mute creator/topic, show less, reset)
  useEffect(() => {
    const handleFeedUpdate = () => setFeedbackEpoch(prev => prev + 1);
    window.addEventListener('aeirmist-feed-updated', handleFeedUpdate);
    return () => window.removeEventListener('aeirmist-feed-updated', handleFeedUpdate);
  }, []);
  const openQuickCamera = () => {
    setCameraConfig({
      isOpen: true,
      mode: 'STORY',
      onCapture: (file) => {
        // Just capture for now, could auto-upload to story
        logger.info("Feed camera capture:", file);
      }
    });
  };

  const processedPosts = React.useMemo(() => {
    return feedRankingService.rankPosts(posts, {
      profile,
      user,
      feedMode,
      userInterests: profile?.interests || []
    });
  }, [posts, feedMode, profile, user, feedbackEpoch]);

  // Persistent Cache Sync
  useEffect(() => {
    if (processedPosts.length > 0) {
      try {
        // Store only the first 20 for fast cold-start hydration
        localStorage.setItem('aeirmist_home_feed_cache', JSON.stringify(processedPosts.slice(0, 20)));
        // Persist into Local SQLite/IndexedDB vault
        LocalSqlService.saveFeedPosts(processedPosts.slice(0, 50));
      } catch (e) {
        logger.warn("Feed cache sync failed", e);
      }
    }
  }, [processedPosts]);

  // Memoize stable query parameters according to active feed mode
  const uidsToQueryString = React.useMemo(() => {
    if (!user || !profile) return '[]';
    const following = (profile.social?.following || []).filter(Boolean);
    const followers = (profile.social?.followers || []).filter(Boolean);
    const closeFriends = (profile.closeFriends || []).filter(Boolean);

    if (feedMode === 'following') {
      // Strictly real following relationship
      return JSON.stringify(Array.from(new Set(following)).sort());
    }

    if (feedMode === 'friends') {
      // Mutual follows or close friends
      const mutuals = following.filter((id: string) => followers.includes(id));
      const friends = Array.from(new Set([...mutuals, ...closeFriends])).filter(Boolean);
      return JSON.stringify(friends.sort());
    }

    // For 'smart', 'latest', 'saved': include following, profile, and user
    const uids = Array.from(new Set([...following, profile.id, user.uid].filter(Boolean))).sort();
    return JSON.stringify(uids);
  }, [user?.uid, profile?.id, JSON.stringify(profile?.social?.following || []), JSON.stringify(profile?.social?.followers || []), JSON.stringify(profile?.closeFriends || []), feedMode]);

  const [postLimit, setPostLimit] = useState(20);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  const handleFeedModeChange = (mode: FeedMode) => {
    setFeedMode(mode);
    feedRankingService.setFeedMode(mode);
  };

  const handleResetRecommendations = () => {
    feedRankingService.resetRecommendations();
    addToast?.({
      title: 'Feed Algorithms Reset',
      message: 'Recommendation weights, muted topics, and tuning filters have been reset to defaults.',
      type: 'info'
    });
  };

  const handleManualRetry = () => {
    setLoading(true);
    setError(null);
    setRetryCount(prev => prev + 1);
  };

  useEffect(() => {
    if (!user || !profile) return;
    
    const uidsToQuery: string[] = JSON.parse(uidsToQueryString);
    if (!isInitialLoad.current) setIsRefreshing(true);
    let isCancelled = false;

    const fetchFeed = async () => {
      try {
        const res = await api.posts.getFeed(postLimit * 2, 0);
        if (isCancelled) return;

        const mediaBase = (import.meta.env.VITE_MEDIA_URL || 'http://localhost:4000/media').replace(/\/+$/, '');
        const rawPosts = res?.posts || [];

        const mapped = rawPosts.map((p: any) => {
          const authorObj = p.author || {};
          const authorId = p.userId || p.authorId || authorObj.id;
          return {
            id: p.id,
            userId: p.userId || authorId,
            authorId: authorId,
            content: p.content || '',
            caption: p.content || '',
            mediaKeys: p.mediaKeys || [],
            mediaType: p.mediaType || 'none',
            mediaUrl: p.mediaKeys?.[0] ? `${mediaBase}/${p.mediaKeys[0]}` : (p.mediaUrl || ''),
            mediaUrls: p.mediaKeys?.length ? p.mediaKeys.map((k: string) => `${mediaBase}/${k}`) : (p.mediaUrls || (p.mediaUrl ? [p.mediaUrl] : [])),
            mediaItems: p.mediaItems || (p.mediaKeys?.length ? p.mediaKeys.map((k: string) => ({ url: `${mediaBase}/${k}`, type: p.mediaType === 'video' ? 'video' : 'image' })) : undefined),
            author: {
              id: authorObj.id || authorId || 'user',
              name: authorObj.displayName || authorObj.username || p.authorName || p.userName || 'User',
              username: authorObj.username || 'user',
              avatar: getAvatarUrl(authorObj.avatarKey || authorObj.photoURL || p.userAvatar || p.authorAvatar),
              isVerified: authorObj.isVerified || false,
            },
            likesCount: p.likesCount || 0,
            commentsCount: p.commentsCount || 0,
            sharesCount: p.sharesCount || 0,
            likedBy: p.likedBy || [],
            savedBy: p.savedBy || [],
            poll: p.pollData || p.poll,
            createdAt: p.createdAt,
            timestamp: p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
            __sortTime: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
            ...p
          };
        });

        // Deduplicate
        const seen = new Set<string>();
        const deduped = mapped.filter((p: any) => {
          if (!p || !p.id || seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        deduped.sort((a: any, b: any) => (b.__sortTime || 0) - (a.__sortTime || 0));

        const following = (profile.social?.following || []).filter(Boolean);
        const followers = (profile.social?.followers || []).filter(Boolean);
        const closeFriends = (profile.closeFriends || []).filter(Boolean);

        const filtered = deduped.slice(0, postLimit * 2).filter((p: any) => {
          if (!p || p.isArchived) return false;
          // Strictly exclude posts from deleted, banned, or scheduled-for-purge accounts
          if (
            p.isBanned ||
            p.author?.isBanned ||
            p.authorIsBanned ||
            p.status === 'BANNED' ||
            p.authorStatus === 'BANNED' ||
            p.isDeletedAuthor || 
            p.scheduledForPurge || 
            p.isDeleted ||
            p.hidden ||
            p.authorName === 'Aeirmist User' || 
            p.userName === 'Aeirmist User' || 
            p.author?.name === 'Aeirmist User' ||
            p.author?.displayName === 'Aeirmist User' ||
            p.author?.username === 'aeirmist_user' ||
            p.author?.username === 'deleted_user'
          ) {
            return false;
          }

          const authorId = p.authorId || p.authorUid || p.author?.id || p.userId || '';
          const authorUid = p.authorUid || p.author?.uid || '';
          const isOwn = authorId === profile.id || authorUid === user.uid;

          // Feed Mode specific filtering
          if (feedMode === 'following') {
            const authorCandidates = [
              p.authorId,
              p.authorUid,
              p.userId,
              p.author?.id,
              p.author?.uid,
              authorId,
              authorUid
            ].filter(Boolean);

            const followingSet = new Set([
              ...following,
              ...following.map((id: string) => id.replace(/^profile_/, '')),
              ...following.map((id: string) => 'profile_' + id.replace(/^profile_/, ''))
            ]);

            return authorCandidates.some((id: string) => followingSet.has(id));
          }

          if (feedMode === 'friends') {
            const isMutual = (following.includes(authorId) && followers.includes(authorId)) ||
                             (following.includes(authorUid) && followers.includes(authorUid));
            const isClose = closeFriends.includes(authorId) || closeFriends.includes(authorUid);
            return isMutual || isClose;
          }

          if (feedMode === 'saved') {
            return p.savedBy?.includes(profile.id) || p.savedBy?.includes(user.uid) || p.isSaved || p.isBookmarked;
          }

          // 'smart' and 'latest' modes
          if (isOwn) return true;
          if (p.audience === 'only_me') return false;
          if (p.audience === 'close_friends') {
            return (p.closeFriends || []).includes(profile.id);
          }
          return true;
        });

        setPosts(filtered);
        setLoading(false);
        setIsRefreshing(false);
        setError(null);
        isInitialLoad.current = false;
        try {
          localStorage.setItem('aeirmist_home_feed_cache', JSON.stringify(filtered.slice(0, 20)));
        } catch (e) {}
      } catch (err: any) {
        if (isCancelled) return;
        logger.error('[Feed] API timeline sync error:', err);
        try {
          const rawLocal = localStorage.getItem('aeirmist_home_feed_cache');
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPosts(parsed);
              setError(null);
              setLoading(false);
              setIsRefreshing(false);
              return;
            }
          }
        } catch (_) {}
        LocalSqlService.getFeedPosts(30).then(cached => {
          if (cached && cached.length > 0) {
            setPosts(cached.map(c => c.raw || c));
            setError(null);
          }
        }).catch(() => {});
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchFeed();

    // Real-time post updates
    const handlePostCreated = () => {
      fetchFeed();
    };
    window.addEventListener('aeirmist-post-created', handlePostCreated);
    let socket: any = null;
    try {
      socket = getSocket();
      socket.on('new_post', handlePostCreated);
    } catch (e) {}

    // Freshness poll interval
    const pollInterval = setInterval(() => {
      fetchFeed();
    }, 15000);

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
      window.removeEventListener('aeirmist-post-created', handlePostCreated);
      if (socket) {
        socket.off('new_post', handlePostCreated);
      }
    };
  }, [user?.uid, profile?.id, uidsToQueryString, feedMode, retryCount, postLimit]);

  // Infinite Scroll Trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !isRefreshing && processedPosts.length >= postLimit) {
          // Add a small buffer delay to prevent rapid-fire limit increments
          setPostLimit(prev => prev + 20);
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px' // Start loading before reaching the very end
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loading, isRefreshing, processedPosts.length, postLimit]);

  return (
    <div className={`w-full min-h-full relative flex flex-col ${isGlobalBgActive ? 'bg-black/20 backdrop-blur-sm' : ''}`}>
      <div className="w-full pb-[calc(7rem+var(--sab,var(--safe-area-inset-bottom,0px)))]">
        {/* Mobile Header with Marketplace Link */}
        <div 
          role="banner"
          className={`sticky top-0 z-[100] ${isGlobalBgActive ? 'bg-[#050505]/80 backdrop-blur-3xl border-b border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.6)]' : 'bg-[#050505]/95 backdrop-blur-md border-b border-white/5'} flex md:hidden items-center justify-between pb-2.5 pt-[calc(0.875rem+var(--sat,var(--safe-area-inset-top,0px)))] mb-1 px-4 transition-colors duration-200`}
        >
           <div className="flex items-center justify-start gap-1.5 w-24 shrink-0">
             <button 
              type="button"
              aria-label="Go to Marketplace"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('aeirmist-navigate', { detail: 'discover' }));
              }}
              className={`w-10 h-10 rounded-xl ${isGlobalBgActive ? 'bg-[#00f2ff]/15 border-[#00f2ff]/40 shadow-[0_2px_12px_rgba(0,0,0,0.5)]' : 'bg-[#00f2ff]/10 border-[#00f2ff]/30'} border flex items-center justify-center text-aeirmist-cyan shadow-lg active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan`}
              title="Marketplace"
           >
             <ShoppingBag size={18} className="drop-shadow-[0_0_6px_rgba(0,242,255,0.4)]" aria-hidden="true" />
           </button>
           </div>
           <div className="flex-1 flex items-center justify-center z-10 min-w-0 px-2">
             <button
               type="button"
               onClick={() => {
                 triggerNativeHaptic('tick');
                 window.scrollTo({ top: 0, behavior: 'smooth' });
                 setIsRefreshing(true);
                 setTimeout(() => {
                   triggerNativeHaptic('selection');
                   setIsRefreshing(false);
                 }, 800);
               }}
               className="relative pt-1 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
             >
               <AeirmistLogo 
                 variant="text-only" 
                 glow={false} 
                 colorClass={`text-aeirmist-cyan font-black text-lg tracking-[0.25em] ${isGlobalBgActive ? 'drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]' : ''}`} 
               />
               {/* Decorative holographic hairline underline */}
               <div className="absolute -bottom-1 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-aeirmist-cyan/50 to-transparent" />
               <motion.div 
                 animate={{ x: [-20, 100], opacity: [0, 0.8, 0] }}
                 transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                 className="absolute -bottom-1 left-0 w-1/3 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent"
               />
             </button>
           </div>
           <div className="flex items-center justify-end gap-2 w-24 shrink-0">
             <button 
              type="button"
              aria-label="Create new post"
              onClick={onCreate}
              className={`w-10 h-10 rounded-xl ${isGlobalBgActive ? 'bg-white/10 border-white/20 text-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.4)]' : 'bg-white/5 border-white/10 text-white/40'} border flex items-center justify-center hover:text-aeirmist-cyan transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan`}
             >
               <Plus size={16} aria-hidden="true" />
             </button>
             <button 
              type="button"
              aria-label="Open notifications"
              onClick={() => {
                const navEvent = new CustomEvent('aeirmist-navigate', { detail: 'notifications' });
                window.dispatchEvent(navEvent);
              }}
              className={`w-10 h-10 rounded-xl ${isGlobalBgActive ? 'bg-white/10 border-white/20 text-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.4)]' : 'bg-white/5 border-white/10 text-white/40'} border flex items-center justify-center hover:text-aeirmist-cyan transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan`}
             >
               <Bell size={16} aria-hidden="true" />
               {unreadNotificationsCount > 0 && (
                 <span className="absolute -top-1 -right-1 z-10 min-w-[18px] h-[18px] px-1 bg-aeirmist-cyan text-black text-[9px] font-black rounded-full border border-black flex items-center justify-center shadow-[0_0_10px_rgba(0,242,255,0.8)] animate-pulse">
                   {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                 </span>
               )}
             </button>
           </div>
        </div>
        
        <div className="w-full flex justify-center">
          
          {/* MAIN FEED COLUMN */}
          <div className="w-full max-w-[700px]">
            {/* NOTES & STORIES RESTORED */}
            <div className="mb-3">
              <StoriesSystem />
            </div>
            {/* FEED ITEMS */}
            <div className="relative rounded-[2.5rem] backdrop-blur-2xl bg-black/15 py-2">
              <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {error ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      role="alert"
                      className="glass-panel p-12 rounded-[2.5rem] border-aeirmist-magenta/30 bg-aeirmist-magenta/5 text-center flex flex-col items-center"
                    >
                      <div className="w-16 h-16 rounded-full bg-aeirmist-magenta/10 flex items-center justify-center mb-6 text-aeirmist-magenta">
                        <AlertTriangle size={32} />
                      </div>
                      <h3 className="text-xl font-display font-bold mb-2 text-white">{error.message}</h3>
                      <p className="text-xs text-white/40 uppercase tracking-widest leading-loose max-w-sm mx-auto mb-8">
                        {error.details}
                      </p>
                      
                      {error.link ? (
                        <div className="flex flex-col items-center gap-4">
                          <p className="text-[10px] text-aeirmist-magenta/60 font-bold uppercase tracking-wider">Manual Database Optimization Required</p>
                          <a 
                            href={error.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-8 py-5 bg-aeirmist-magenta/20 border border-aeirmist-magenta/40 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white hover:bg-aeirmist-magenta/30 hover:border-aeirmist-magenta transition-all group shadow-[0_0_30px_rgba(255,0,255,0.1)]"
                          >
                            Create Database Index
                            <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </a>
                          <p className="text-[9px] text-white/20 max-w-[280px] leading-relaxed">
                            Database optimization recommended. Click the button above to retry the synchronization.
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={handleManualRetry}
                          className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95"
                        >
                          Retry Synchronization
                        </button>
                      )}
                    </motion.div>
                  ) : loading && processedPosts.length === 0 ? (
                    <div className="space-y-6" aria-busy="true" aria-label="Syncing Feed coordinates">
                      {Array(3).fill(0).map((_, i) => (
                        <div key={i} className="glass-panel p-5 rounded-[2.5rem] bg-white/[0.02]" aria-hidden="true">
                          <div className="flex items-center gap-3 mb-5">
                            <Skeleton className="w-10 h-10 rounded-xl" />
                            <div className="space-y-1.5 flex-1">
                              <Skeleton className="w-32 h-3" />
                              <Skeleton className="w-20 h-2 opacity-50" />
                            </div>
                            <Skeleton className="w-8 h-8 rounded-lg" />
                          </div>
                          <Skeleton className="w-full aspect-[4/3] rounded-3xl mb-4" />
                          <div className="flex items-center gap-4">
                            <Skeleton className="w-12 h-4 rounded-full" />
                            <Skeleton className="w-12 h-4 rounded-full" />
                            <Skeleton className="w-12 h-4 rounded-full ml-auto" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : processedPosts.length === 0 ? (
                    <div className="ui-card p-12 text-center flex flex-col items-center justify-center my-6">
                      <div className="w-16 h-16 rounded-2xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 flex items-center justify-center mb-4 text-aeirmist-cyan">
                        {feedMode === 'following' ? <Users size={28} /> : feedMode === 'saved' ? <Bookmark size={28} /> : feedMode === 'friends' ? <Sparkles size={28} /> : <Plus size={28} />}
                      </div>
                      <h3 className="ui-heading-2 mb-2">
                        {feedMode === 'following'
                          ? 'No Following Posts'
                          : feedMode === 'friends'
                          ? 'No Friends Activity'
                          : feedMode === 'saved'
                          ? 'No Saved Bookmarks'
                          : 'Welcome to your feed'}
                      </h3>
                      <p className="ui-body-text text-white/50 max-w-sm mx-auto mb-6">
                        {feedMode === 'following'
                          ? 'You are not following anyone with recent posts. Discover active creators to personalize your feed.'
                          : feedMode === 'friends'
                          ? 'Posts from your close friends and mutual connections will appear here.'
                          : feedMode === 'saved'
                          ? 'Posts you bookmark will be safely stored here for easy offline reading.'
                          : 'No posts yet. Start by sharing your first post with your connections or explore stores in the Marketplace.'}
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        {feedMode === 'following' ? (
                          <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('aeirmist-navigate', { detail: 'discover' }))}
                            className="ui-btn-primary"
                          >
                            <Compass className="ui-icon-sm" /> Discover Creators
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={onCreate}
                            className="ui-btn-primary"
                          >
                            <Plus className="ui-icon-sm" /> Create Post
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <motion.div key="feed-posts-container">
                      {isRefreshing && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex justify-center mb-4"
                        >
                          <div className="px-4 py-1.5 bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 rounded-full flex items-center gap-2">
                            <Loader2 size={10} className="text-aeirmist-cyan animate-spin" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-aeirmist-cyan">Refreshing Timeline</span>
                          </div>
                        </motion.div>
                      )}
                      {processedPosts.map((post) => (
                        <div key={post.id} className="w-full">
                          <PremiumPostCard post={post} onUserClick={onUserClick} onPostClick={onPostClick} onNavigate={onNavigate} />
                        </div>
                      ))}
                      
                      {/* Infinite Scroll Anchor */}
                      <div ref={loadMoreRef} className="py-8 flex justify-center">
                        {posts.length >= postLimit && (
                           <div className="flex items-center gap-3">
                             <Loader2 size={24} className="text-aeirmist-cyan animate-spin" />
                             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Syncing Frequencies...</span>
                           </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default HomeFeedSystem;
