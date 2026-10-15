import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { useAeirmist } from '../../context/AeirmistContext';
import { api } from '../../services/api/client';
import { formatAeirmistTimestamp } from '../../lib/date';
import { AeirmistLogo } from '../ui/AeirmistLogo';
import { getAvatarUrl, BLANK_DP } from '../../lib/avatar';
import { Skeleton } from '../ui/Skeleton';
import { logger } from '@/src/utils/logger';
import { LocalSqlService } from '../../services/LocalSqlService';
import { feedRankingService, FeedMode } from '../../services/FeedRankingService';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';


export const HomeFeedSystem: React.FC<{ onUserClick?: (user: any) => void, onPostClick?: (postId: string) => void, onCreate?: () => void, onNavigate?: (tab: string, param?: string) => void }> = React.memo(({ onUserClick, onPostClick, onCreate, onNavigate }) => {
  const [posts, setPosts] = useState<any[]>(() => {
    // Attempt instant hydration from local cache (ignoring stale/placeholder cache)
    try {
      const cached = localStorage.getItem('aeirmist_home_feed_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter((p: any) => 
            p && 
            p.authorName !== 'Aeirmist User' && 
            p.userName !== 'Aeirmist User' && 
            p.author?.displayName !== 'Aeirmist User'
          );
        }
      }
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
  const { db, user, profile, permissions, requestPermission, setCameraConfig, addToast, unreadNotificationsCount } = useAeirmist();
  const { settings } = useAppearance(); 
  const isGlobalBgActive = settings.globalBgType !== 'none' && !!settings.globalBgValue;

  // Hydrate from Local SQLite/IndexedDB vault on mount + safety timeout
  useEffect(() => {
    try {
      const raw = localStorage.getItem('aeirmist_home_feed_cache');
      if (raw && (raw.includes('"Aeirmist User"') || raw.includes('aeirmist_user'))) {
        localStorage.removeItem('aeirmist_home_feed_cache');
      }
    } catch {}

    LocalSqlService.getFeedPosts(20).then(cached => {
      if (cached && cached.length > 0) {
        const valid = cached
          .map(c => c.raw || c)
          .filter((p: any) => 
            p && 
            p.authorName !== 'Aeirmist User' && 
            p.userName !== 'Aeirmist User' && 
            p.author?.displayName !== 'Aeirmist User'
          );
        if (valid.length > 0) {
          setPosts(prev => prev.length === 0 ? valid : prev);
          setLoading(false);
        }
      }
    }).catch(e => logger.warn("Local DB hydration failed", e));

    // Instant safety fallback: if no posts loaded within 350ms, dismiss skeleton to prevent black blank freeze
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 350);

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
        // Store lightweight representation (first 15) for fast cold-start hydration without overflowing 5MB quota
        const safeCache = processedPosts.slice(0, 15).map(p => {
          const cleanUrls = (p.mediaUrls || []).map((u: string) => (typeof u === 'string' && u.startsWith('data:') && u.length > 1024 ? '' : u)).filter(Boolean);
          const cleanAvatar = (typeof p.userAvatar === 'string' && p.userAvatar.startsWith('data:') && p.userAvatar.length > 1024) ? '' : p.userAvatar;
          return {
            ...p,
            mediaUrls: cleanUrls,
            userAvatar: cleanAvatar,
            authorAvatar: cleanAvatar,
            author: p.author ? { ...p.author, avatar: cleanAvatar, avatarKey: cleanAvatar, photoURL: cleanAvatar } : p.author
          };
        });
        localStorage.setItem('aeirmist_home_feed_cache', JSON.stringify(safeCache));
        // Persist into Local SQLite/IndexedDB vault
        LocalSqlService.saveFeedPosts(processedPosts.slice(0, 50));
      } catch (e: any) {
        if (e?.name === 'QuotaExceededError' || e?.code === 22) {
          try {
            localStorage.removeItem('aeirmist_home_feed_cache');
          } catch {}
        }
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

  const fetchFeed = useCallback(async () => {
    try {
      if (!isInitialLoad.current) setIsRefreshing(true);
      const res: any = await api.posts.getFeed(postLimit);
      if (res?.posts && Array.isArray(res.posts)) {
        const following = (profile?.social?.following || []).filter(Boolean);
        const followers = (profile?.social?.followers || []).filter(Boolean);
        const closeFriends = (profile?.closeFriends || []).filter(Boolean);

        const mapped = res.posts
          .filter((p: any) => {
            if (!p || p.isArchived || p.deletedAt) return false;
            const name = p.author?.displayName || p.author?.username || p.authorName || '';
            if (name.toLowerCase() === 'aeirmist user' || name.toLowerCase().startsWith('aeirmistuser')) {
              return false;
            }
            return true;
          })
          .map((p: any) => {
            const authorDisplayName = p.author?.displayName || p.author?.username || p.authorName || 'Aeirmist Member';
            const authorAvatar = p.author?.avatarKey || p.userAvatar || '';
            const isVerified = Boolean(p.author?.isVerified);

            return {
              id: p.id,
              userId: p.userId,
              authorId: p.userId,
              authorName: authorDisplayName,
              userName: p.author?.username || authorDisplayName,
              userAvatar: authorAvatar,
              authorAvatar: authorAvatar,
              author: {
                id: p.author?.id || p.userId,
                name: authorDisplayName,
                displayName: authorDisplayName,
                username: p.author?.username || '',
                avatar: authorAvatar,
                avatarKey: authorAvatar,
                photoURL: authorAvatar,
                isVerified: isVerified,
                badge: p.author?.badge || null
              },
              isVerified: isVerified,
              content: p.content,
              mediaKeys: p.mediaKeys || [],
              mediaUrls: (p.mediaKeys || []).map((k: string) => 
                k.startsWith('http') || k.startsWith('data:') ? k : `/media/${k.replace(/^\/+media\/+/, '')}`
              ),
              mediaType: p.mediaType || ((p.mediaKeys && p.mediaKeys.length > 0) ? 'image' : 'none'),
              likesCount: p.likesCount || 0,
              commentsCount: p.commentsCount || 0,
              sharesCount: p.sharesCount || 0,
              viewsCount: p.viewsCount || 0,
              likedBy: p.isLiked && profile?.id ? [profile.id] : [],
              isLiked: Boolean(p.isLiked),
              isBookmarked: Boolean(p.isBookmarked),
              poll: p.pollData || null,
              tags: p.tags || [],
              location: p.location || null,
              createdAt: p.createdAt,
              timestamp: p.createdAt ? formatAeirmistTimestamp(p.createdAt) : 'Just now',
              __sortTime: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
            };
          });

        let filtered = mapped;
        if (feedMode === 'following') {
          filtered = mapped.filter((p: any) => following.includes(p.userId) || following.includes(p.authorId));
        } else if (feedMode === 'friends') {
          const friends = Array.from(new Set([...following.filter((id: string) => followers.includes(id)), ...closeFriends]));
          filtered = mapped.filter((p: any) => friends.includes(p.userId) || friends.includes(p.authorId));
        } else if (feedMode === 'saved') {
          filtered = mapped.filter((p: any) => p.isBookmarked);
        }

        setPosts(filtered);
        setError(null);
      }
    } catch (err: any) {
      logger.error('Device Feed Load error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      isInitialLoad.current = false;
    }
  }, [postLimit, feedMode, profile?.id, JSON.stringify(profile?.social?.following || []), retryCount]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

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
          className={`sticky top-0 z-[100] ${isGlobalBgActive ? 'bg-black/20 backdrop-blur-xl border-b border-white/5' : 'bg-[#050505]/90 backdrop-blur-md border-b border-white/5'} flex md:hidden items-center justify-between pb-1.5 pt-[max(env(safe-area-inset-top,0px),0.25rem)] mb-0 px-3.5 transition-colors duration-200`}
        >
           <div className="flex items-center justify-start gap-1.5 shrink-0">
             <button 
              type="button"
              aria-label="Go to Marketplace"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('aeirmist-navigate', { detail: 'discover' }));
              }}
              className={`w-9 h-9 rounded-xl ${isGlobalBgActive ? 'bg-[#00f2ff]/15 border-[#00f2ff]/40 shadow-[0_2px_12px_rgba(0,0,0,0.5)]' : 'bg-[#00f2ff]/10 border-[#00f2ff]/30'} border flex items-center justify-center text-aeirmist-cyan shadow-lg active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan`}
              title="Marketplace"
             >
               <ShoppingBag size={17} className="drop-shadow-[0_0_6px_rgba(0,242,255,0.4)]" aria-hidden="true" />
             </button>
           </div>

           {/* Brand Center Logo - App Name */}
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

           <div className="flex items-center justify-end gap-1.5 shrink-0">
             <button 
              type="button"
              aria-label="Create new post"
              onClick={onCreate}
              className={`w-9 h-9 rounded-xl ${isGlobalBgActive ? 'bg-white/10 border-white/20 text-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.4)]' : 'bg-white/5 border-white/10 text-white/40'} border flex items-center justify-center hover:text-aeirmist-cyan transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan`}
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
              className={`w-9 h-9 rounded-xl ${isGlobalBgActive ? 'bg-white/10 border-white/20 text-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.4)]' : 'bg-white/5 border-white/10 text-white/40'} border flex items-center justify-center hover:text-aeirmist-cyan transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan`}
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
            <div className="mb-1">
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
                            Firestore requires a composite index for this saved view. Click the button above to authorize the Index creation.
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
