import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  UserPlus, 
  UserCheck, 
  UserX, 
  MessageSquare, 
  Share2, 
  EyeOff, 
  Clock, 
  Sparkles, 
  ShieldCheck,
  Store, 
  Briefcase, 
  X, 
  Compass, 
  ChevronRight,
  RefreshCw,
  Zap,
  Check,
  UserCheck2
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { useAppearance } from '../../context/AppearanceContext';
import { getAvatarUrl } from '../../lib/avatar';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


interface AeirmistDashboardProps {
  onUserClick?: (userData: any) => void;
  onMessageClick?: (userData: any) => void;
}

type TabType = 'for-you' | 'following' | 'followers' | 'requests' | 'creators' | 'verified' | 'stores' | 'new' | 'blocked';

// Dashboard | System Metrics
export const AeirmistDashboard: React.FC<AeirmistDashboardProps> = ({ onUserClick, onMessageClick }) => {
  const { settings } = useAppearance();
  const isGlobalBgActive = settings?.globalBgType && settings.globalBgType !== 'none';
  const { 
    db, 
    user, 
    profile, 
    onlineUsers,
    toggleFollow, 
    isFollowing, 
    isFollowPending, 
    acceptFollowRequest, 
    rejectFollowRequest,
    toggleBlockUser,
    isBlocked,
    addToast
  } = useAeirmist();

  // Accurate real-time online presence verification
  const isUserOnline = useCallback((targetProfile: any) => {
    if (!targetProfile) return false;
    if (targetProfile.messagingSettings?.onlineStatus === false) return false;
    
    const pid = targetProfile.id;
    const puid = targetProfile.uid || targetProfile.ownerUid;
    
    // Check real-time active Set
    if (onlineUsers?.has(pid) || (puid && onlineUsers?.has(puid))) {
      return true;
    }
    
    // Check heartbeat within last 75s
    if (targetProfile.status === 'online') {
      const rawTs = targetProfile.lastSeen || targetProfile.lastActiveAt;
      const ms = rawTs?.toMillis ? rawTs.toMillis() : (rawTs?.seconds ? rawTs.seconds * 1000 : (typeof rawTs === 'number' ? rawTs : 0));
      if (ms > 0 && (Date.now() - ms < 75000)) {
        return true;
      }
    }
    return false;
  }, [onlineUsers]);

  // Core Connection States
  const [activeTab, setActiveTab] = useState<TabType>('for-you');
  const [processingRequestIds, setProcessingRequestIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('aeirmist_connections_recent_searches_v3') || localStorage.getItem('aeirmist_recent_searches_v2');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          return item.displayName || item.name || item.username || item.id || '';
        }
        return String(item);
      }).filter((s: any) => {
        if (typeof s === 'string') return s.trim().length > 0;
        return !!s;
      });
    } catch {
      return [];
    }
  });
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  const addRecentSearch = (term: any) => {
    const text = typeof term === 'string' ? term : (term?.displayName || term?.name || term?.username || '');
    const trimmed = text.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(item => {
        const itemStr = typeof item === 'string' ? item : ((item as any)?.displayName || (item as any)?.name || (item as any)?.username || '');
        return itemStr.toLowerCase() !== trimmed.toLowerCase();
      });
      const updated = [trimmed, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('aeirmist_connections_recent_searches_v3', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeRecentSearch = (term: any) => {
    const text = typeof term === 'string' ? term : ((term as any)?.displayName || (term as any)?.name || (term as any)?.username || '');
    setRecentSearches(prev => {
      const updated = prev.filter(item => {
        const itemStr = typeof item === 'string' ? item : ((item as any)?.displayName || (item as any)?.name || (item as any)?.username || '');
        return itemStr !== text;
      });
      try {
        localStorage.setItem('aeirmist_connections_recent_searches_v3', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('aeirmist_connections_recent_searches_v3');
      localStorage.removeItem('aeirmist_recent_searches_v2');
    } catch {}
  };

  const [profiles, setProfiles] = useState<any[]>([]);
  const [followRequests, setFollowRequests] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState<boolean>(true);
  
  // bottom sheet preview overlay state
  const [previewProfile, setPreviewProfile] = useState<any | null>(null);

  // Dissmissed suggestions list
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('aeirmist_dismissed_suggestions_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track realistic mock request timestamps for a premium feel
  const [requestTimestampMap, setRequestTimestampMap] = useState<Record<string, number>>({});

  // Dynamic ticking clock for relative duration calculations
  const [tick, setTick] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Firestore Sync with mounting safety
  useEffect(() => {
    if (!db) {
      setProfiles([]);
      setLoadingProfiles(false);
      return;
    }

    let isMounted = true;
    setLoadingProfiles(true);
    const profilesColl = collection(db, 'profiles');
    
    const unsubProfiles = onSnapshot(profilesColl, (snap) => {
      if (!isMounted) return;
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const others = docs.filter((p: any) => {
        // Exclude current user
        if (p.id === profile?.id || p.uid === user?.uid || p.ownerUid === user?.uid) return false;

        // Kick unregistered / incomplete accounts: Must have a valid username (not 'user', null, undefined, or empty)
        const rawUname = (p.username || '').trim().toLowerCase();
        if (!rawUname || rawUname === 'user' || rawUname === 'null' || rawUname === 'undefined' || rawUname.length < 2) {
          return false;
        }

        // Must have a valid display name
        const rawName = (p.displayName || p.name || '').trim();
        if (!rawName) return false;

        // Exclude accounts scheduled for deletion or purge or banned
        if (p.scheduledForPurge || p.status === 'scheduled_for_deletion' || p.isBanned) return false;

        return true;
      });
      
      setProfiles(others);
      setLoadingProfiles(false);
    }, (error) => {
      logger.warn("Profiles subscription failing:", error);
      if (isMounted) {
        setProfiles([]);
        setLoadingProfiles(false);
      }
    });

    let unsubRequests = () => {};
    if (profile?.id) {
      const reqsColl = collection(db, 'follow_requests');
      const q = query(reqsColl, where('toId', '==', profile.id));
      
      unsubRequests = onSnapshot(q, (snap) => {
        if (isMounted) {
          setFollowRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      }, (error) => {
        logger.warn("Follow requests subscription failed system boundary check:", error);
        if (isMounted) setFollowRequests([]);
      });
    }

    return () => {
      isMounted = false;
      unsubProfiles();
      unsubRequests();
    };
  }, [db, profile?.id, user?.uid]);

  // Handle follow click
  const handleFollow = async (targetId: string, displayName: string) => {
    try {
      const isPending = isFollowPending(targetId);
      await toggleFollow(targetId);
      
      // Update our timestamp mapping if a new proposal is initiated
      if (!isPending && !isFollowing(targetId)) {
        setRequestTimestampMap(prev => ({
          ...prev,
          [targetId]: Date.now()
        }));
        addToast?.({
          title: 'Proposal Transmitted',
          message: `Approval sent to ${displayName}'s private workspace.`,
          type: 'success'
        });
      } else if (isFollowing(targetId)) {
        addToast?.({
          title: 'Transmitter Syncing',
          message: `Established connection bridge with ${displayName}.`,
          type: 'success'
        });
      } else {
        addToast?.({
          title: 'Link Cleared',
          message: `Disconnected social loop with ${displayName}.`,
          type: 'info'
        });
      }
    } catch (e) {
      logger.error("Link coordination error:", e);
    }
  };

  const handleAcceptRequest = async (requestId: string, fromId: string, name: string) => {
    if (processingRequestIds.has(requestId)) return;
    setProcessingRequestIds(prev => {
      const copy = new Set(prev);
      copy.add(requestId);
      return copy;
    });
    try {
      await acceptFollowRequest(requestId, fromId);
      addToast?.({
        title: 'Connection Accepted',
        message: `Successfully connected with ${name}.`,
        type: 'success'
      });
    } catch (e) {
      logger.error("Accept request error:", e);
    } finally {
      setProcessingRequestIds(prev => {
        const copy = new Set(prev);
        copy.delete(requestId);
        return copy;
      });
    }
  };

  const handleDeclineRequest = async (requestId: string, name: string) => {
    if (processingRequestIds.has(requestId)) return;
    setProcessingRequestIds(prev => {
      const copy = new Set(prev);
      copy.add(requestId);
      return copy;
    });
    try {
      await rejectFollowRequest(requestId);
      addToast?.({
        title: 'Proposal Rejected',
        message: `Declined the friend request from ${name}.`,
        type: 'info'
      });
    } catch (e) {
      logger.error("Decline request error:", e);
    } finally {
      setProcessingRequestIds(prev => {
        const copy = new Set(prev);
        copy.delete(requestId);
        return copy;
      });
    }
  };

  // Helper to read nice relative request timestamps
  const getRequestTimeLabel = (targetId: string) => {
    const ts = requestTimestampMap[targetId];
    if (!ts) return 'Requested • Just now';
    const elapsed = tick - ts;
    const mins = Math.max(1, Math.floor(elapsed / 60000));
    return `Requested • ${mins}m ago`;
  };

  // Dismiss / Hide target profile
  const handleDismiss = useCallback((targetId: string, displayName: string) => {
    const updated = [...dismissedIds, targetId];
    setDismissedIds(updated);
    try {
      localStorage.setItem('aeirmist_dismissed_suggestions_v2', JSON.stringify(updated));
    } catch {}
    addToast?.({
      title: 'Suggestion Hidden',
      message: `Removed ${displayName} from your active stream feeds.`,
      type: 'info'
    });
  }, [dismissedIds, addToast]);

  // Clears dismissals allowing regeneration
  const handleRefreshSuggestions = () => {
    setDismissedIds([]);
    try {
      localStorage.removeItem('aeirmist_dismissed_suggestions_v2');
    } catch {}
    addToast?.({
      title: 'Feed Restored',
      message: 'Regenerated all matching connections suggestions.',
      type: 'success'
    });
  };

  // Profile sharing link
  const handleShareProfile = (username: string, displayName: string) => {
    const link = `${window.location.origin}/profile/${username}`;
    navigator.clipboard.writeText(link);
    addToast?.({
      title: 'Link Transmitted',
      message: `Profile coordinates of ${displayName} saved to clipboard.`,
      type: 'success'
    });
  };

  // Get active button label, styling and structure based on relation states
  const getFollowButtonProperties = (targetId: string) => {
    const following = isFollowing(targetId);
    const pending = isFollowPending(targetId);
    const followsMe = (profile?.social?.followers || []).includes(targetId);

    if (following && followsMe) {
      return {
        label: 'Mutual',
        style: 'bg-white/10 border-white/20 text-white/90 hover:bg-white/15',
        icon: <UserCheck2 size={11} strokeWidth={2.5} />
      };
    }
    if (following) {
      return {
        label: 'Following',
        style: 'bg-white/5 border-white/10 text-white/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20',
        icon: <Check size={11} strokeWidth={3} />
      };
    }
    if (pending) {
      return {
        label: getRequestTimeLabel(targetId),
        style: 'bg-[#ff00ea]/10 border-[#ff00ea]/30 text-[#ff00ea] text-[8px] tracking-wider font-semibold',
        icon: <Clock size={10} />
      };
    }
    if (followsMe) {
      return {
        label: 'Follow back',
        style: 'bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta border-transparent text-black font-black',
        icon: <UserPlus size={11} strokeWidth={2.5} />
      };
    }
    return {
      label: '+ Follow',
      style: 'bg-aeirmist-cyan border-transparent text-black font-black',
      icon: null
    };
  };

  // Smart score Matchmaker Suggestion Engine
  const suggestionData = useMemo(() => {
    return profiles.filter(p => {
      // Exclude blocked users, dismissed suggestions, following users, and pending request users
      return !isBlocked(p.id) &&
             !dismissedIds.includes(p.id) &&
             !isFollowing(p.id) &&
             !isFollowPending(p.id);
    }).map(p => {
      // Calculate scores
      let score = 0;
      
      // 1. Same Interests matching
      const userInterests = profile?.interests || [];
      const comparedInterests = p.interests || [];
      const sharedInterests = userInterests.filter((i: string) => comparedInterests.includes(i));
      score += sharedInterests.length * 20;

      // 2. Same Location
      if (p.location && profile?.location && p.location.toLowerCase() === profile.location.toLowerCase()) {
        score += 30;
      }

      // 3. Mutual counts
      if (p.mutualCount) {
        score += p.mutualCount * 10;
      }

      // 4. Verified bonus
      if (p.isVerified) {
        score += 15;
      }

      // 5. Store / Service match
      if (p.isStore) {
        score += 5;
      }

      return { ...p, suggestionsScore: score };
    }).sort((a, b) => b.suggestionsScore - a.suggestionsScore);
  }, [profiles, profile, dismissedIds, isBlocked, isFollowing, isFollowPending]);

// Helper to score and filter profile search matches
const matchAndScoreProfile = (p: any, rawQuery: string, currentUserId?: string, isUserBlocked?: boolean): { matched: boolean; score: number } => {
  if (!p || isUserBlocked) return { matched: false, score: 0 };
  const qClean = rawQuery.trim().toLowerCase();
  if (!qClean) return { matched: false, score: 0 };

  // Strip leading '@' if user typed "@username"
  const qAt = qClean.startsWith('@') ? qClean.slice(1).trim() : qClean;

  const username = (p.username || '').toLowerCase().trim();
  const displayName = (p.displayName || p.name || p.fullName || '').toLowerCase().trim();
  const bio = (p.bio || '').toLowerCase().trim();
  const location = (p.location || '').toLowerCase().trim();
  const storeCategory = (p.storeCategory || p.category || '').toLowerCase().trim();
  const storeName = (p.storeName || '').toLowerCase().trim();
  const interestsStr = Array.isArray(p.interests) ? p.interests.join(' ').toLowerCase() : '';

  let score = 0;

  // 1. Exact username match (highest priority)
  if (username === qAt || username === qClean) {
    score += 1000;
  } else if (username.startsWith(qAt)) {
    score += 500;
  } else if (username.includes(qAt)) {
    score += 200;
  }

  // 2. Exact or prefix display name match
  if (displayName === qClean || displayName === qAt) {
    score += 400;
  } else if (displayName.startsWith(qClean) || displayName.startsWith(qAt)) {
    score += 300;
  } else if (displayName.includes(qClean) || displayName.includes(qAt)) {
    score += 150;
  }

  // 3. Multi-token match across all fields
  const tokens = qAt.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const fullText = `${username} ${displayName} ${bio} ${location} ${storeCategory} ${storeName} ${interestsStr}`;
    if (tokens.every(t => fullText.includes(t))) {
      score += 120;
    }
  }

  // 4. Store name & category match
  if (storeName && (storeName.includes(qClean) || storeName.includes(qAt))) {
    score += 80;
  }
  if (storeCategory && storeCategory.includes(qClean)) {
    score += 60;
  }

  // 5. Location match
  if (location && location.includes(qClean)) {
    score += 50;
  }

  // 6. Bio match
  if (bio && bio.includes(qClean)) {
    score += 40;
  }

  // 7. Interests match
  if (interestsStr && interestsStr.includes(qClean)) {
    score += 30;
  }

  return { matched: score > 0, score };
};

  // Map other sub-tabs safely
  const activeTabProfiles = useMemo(() => {
    let list = [...profiles];
    
    // Quick search query filter across profiles if searchQuery is active
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim();
      const scored: Array<{ profile: any; score: number }> = [];

      for (const p of list) {
        // Exclude blocked users from general search results
        if (activeTab !== 'blocked' && isBlocked(p.id)) continue;
        const { matched, score } = matchAndScoreProfile(
          p, 
          q, 
          user?.uid, 
          activeTab === 'blocked' ? false : isBlocked(p.id)
        );
        if (matched) {
          scored.push({ profile: p, score });
        }
      }

      // Return results ordered by relevance score descending
      return scored.sort((a, b) => b.score - a.score).map(s => s.profile);
    }

    switch (activeTab) {
      case 'for-you':
        return suggestionData;
        
      case 'following':
        return list.filter(p => isFollowing(p.id));

      case 'followers':
        return list.filter(p => (profile?.social?.followers || []).includes(p.id) || (profile?.social?.followers || []).includes(p.uid));
        
      case 'creators':
        return list.filter(p => p.isService === true || p.interests?.includes('Spatial Design'));
        
      case 'verified':
        return list.filter(p => p.isVerified === true);
        
      case 'stores':
        return list.filter(p => p.isStore === true || p.storeCategory);
        
      case 'new':
        return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
      case 'requests':
        // Requests have specific format mapped inside onSnapshot
        return followRequests;

      case 'blocked':
        return list.filter(p => isBlocked(p.id));
        
      default:
        return list;
    }
  }, [activeTab, profiles, suggestionData, searchQuery, followRequests, isFollowing, profile, isBlocked, user?.uid]);

  const matchingSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim();
    const scored: Array<{ profile: any; score: number }> = [];

    for (const p of profiles) {
      if (isBlocked(p.id)) continue;
      const { matched, score } = matchAndScoreProfile(p, q, user?.uid, isBlocked(p.id));
      if (matched) {
        scored.push({ profile: p, score });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 8).map(s => s.profile);
  }, [profiles, searchQuery, user?.uid, isBlocked]);

  return (
    <div id="connections-dashboard-hub" className={`w-full h-full min-h-0 flex-1 flex flex-col ${isGlobalBgActive ? 'bg-[#030206]/40 backdrop-blur-xl' : 'bg-[#030206]'} text-white/90 relative select-none font-sans overflow-hidden`}>
      
      {/* ========================================== */}
      {/*        1. DESKTOP VIEWPORT LAYOUT          */}
      {/* ========================================== */}
      <div className="hidden md:flex w-full h-full min-h-0 flex-1 relative overflow-hidden" id="desktop-connections-layout">
        
        {/* LEFT FIXED SIDEBAR */}
        <div className={`w-64 shrink-0 ${isGlobalBgActive ? 'bg-[#07060c]/40 backdrop-blur-xl' : 'bg-[#07060c]'} border-r border-white/5 flex flex-col p-4 h-full overflow-y-auto no-scrollbar`}>
          <div className="flex items-center justify-between pb-6 mb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              {isGlobalBgActive ? (
                <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0">
                  <Users size={14} className="text-aeirmist-cyan" />
                </div>
              ) : (
                <Users size={18} className="text-aeirmist-cyan" />
              )}
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Connections</h2>
            </div>
            {followRequests.length > 0 && (
              <span className="text-[9px] bg-aeirmist-magenta text-white font-mono font-black px-2 py-0.5 rounded-full">
                {followRequests.length}
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-1.5 select-none py-2">
            {([
              { id: 'for-you', label: 'For You', count: 0, icon: <Sparkles size={13} /> },
              { id: 'requests', label: `Requests`, count: followRequests.length, icon: <UserPlus size={13} /> },
              { id: 'following', label: 'Following', count: 0, icon: <Check size={13} /> },
              { id: 'followers', label: 'Followers', count: 0, icon: <Users size={13} /> },
              { id: 'creators', label: 'Creators', count: 0, icon: <Briefcase size={13} /> },
              { id: 'verified', label: 'Verified', count: 0, icon: <ShieldCheck className="text-aeirmist-cyan shrink-0" size={13} /> },
              { id: 'stores', label: 'Stores', count: 0, icon: <Store size={13} /> },
              { id: 'new', label: 'Recently Joined', count: 0, icon: <Clock size={13} /> },
              { id: 'blocked', label: 'Blocked', count: 0, icon: <UserX size={13} /> },
            ] as const).map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  activeTab === item.id 
                    ? 'bg-white border border-white text-black shadow-md' 
                    : `${isGlobalBgActive ? 'bg-white/[0.06] backdrop-blur-xl border border-white/5' : 'hover:bg-white/[0.03]'} text-white/45 hover:text-white/80`
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isGlobalBgActive ? (
                    <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                  ) : (
                    item.icon
                  )}
                  <span>{item.label}</span>
                </div>
                {item.count ? (
                  <span className="text-[8px] font-mono bg-[#ff00ea] text-white px-1.5 py-0.5 rounded-md font-black">
                    {item.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT MAIN AREA */}
        <div className={`flex-1 flex flex-col h-full min-h-0 ${isGlobalBgActive ? 'bg-transparent' : 'bg-[#030206]'} overflow-hidden relative`}>
          
          {/* SEARCH HEADER */}
          <div className={`${isGlobalBgActive ? 'bg-[#030206]/30' : 'bg-[#030206]/95'} backdrop-blur-3xl px-6 py-4 border-b border-white/5 flex gap-4 items-center justify-between shrink-0 relative z-40`}>
            <div className="relative w-full max-w-md">
              <div className="relative w-full">
                {isGlobalBgActive ? (
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0 z-10 pointer-events-none">
                    <Search className={`w-3 h-3 transition-colors duration-300 ${isSearchFocused ? 'text-aeirmist-cyan' : 'text-white/40'}`} />
                  </div>
                ) : (
                  <Search className={`w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-300 ${isSearchFocused ? 'text-aeirmist-cyan' : 'text-white/40'}`} />
                )}
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addRecentSearch(searchQuery);
                      setIsSearchFocused(false);
                      (e.target as HTMLInputElement).blur();
                    } else if (e.key === 'Escape') {
                      setIsSearchFocused(false);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="Search Aeirmist IDs, names, bios, stores..."
                  className={`w-full bg-slate-100 dark:bg-[#0d0b12] border border-slate-200 dark:border-white/10 rounded-xl ${isGlobalBgActive ? 'pl-11' : 'pl-10'} pr-10 py-3 text-[11px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-aeirmist-cyan/40 focus:ring-1 focus:ring-aeirmist-cyan/10 transition-all font-mono`}
                />
                {searchQuery && (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 hover:text-slate-900 dark:hover:text-white transition-colors p-1"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* RECENT SEARCHES & SUGGESTIONS DROP-DOWN BAR */}
              <AnimatePresence>
                {isSearchFocused && (
                  <motion.div key="desktop-search-dropdown">
                    <div 
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={() => {
                        if (searchQuery.trim()) {
                          addRecentSearch(searchQuery);
                        }
                        setIsSearchFocused(false);
                      }} 
                    />
                    
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#090710] border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(3,2,6,0.9)] p-4 z-50 overflow-hidden font-sans"
                    >
                      {/* Dynamic Search Matches / Recent Searches */}
                      {searchQuery.trim().length > 0 ? (
                        <div className="space-y-2.5">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 flex items-center gap-1.5 font-mono">
                            <Sparkles size={11} className="text-aeirmist-cyan animate-pulse" />
                            Matching IDs, Pages & Shops
                          </span>
                          
                          {matchingSuggestions.length > 0 ? (
                            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto no-scrollbar">
                              {matchingSuggestions.map((item) => {
                                const isItemStore = item.isStore || item.storeCategory;
                                const isItemService = item.isService;
                                const isItemCreator = item.isVerified;
                                
                                return (
                                  <div
                                    key={`match-${item.id}`}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={() => {
                                      setSearchQuery(item.displayName || item.username);
                                      addRecentSearch(item.displayName || item.username);
                                      setIsSearchFocused(false);
                                      if (onUserClick) {
                                        onUserClick(item);
                                      } else {
                                        setPreviewProfile(item);
                                      }
                                    }}
                                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-100 dark:border-white/[0.02] hover:border-slate-200 dark:hover:border-white/10 text-slate-800 dark:text-white transition-all cursor-pointer group"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="relative">
                                        <img 
                                          src={getAvatarUrl(item.photoURL)} 
                                          alt={item.displayName}
                                          referrerPolicy="no-referrer"
                                          className="w-8 h-8 rounded-xl border border-slate-200 dark:border-white/10 object-cover"
                                        />
                                        {isUserOnline(item) && (
                                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#090710] shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                                        )}
                                      </div>
                                      <div className="text-left min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-bold text-slate-900 dark:text-white group-hover:text-aeirmist-cyan transition-colors truncate">
                                            {item.displayName || item.name}
                                          </span>
                                          {item.isVerified && (
                                            <ShieldCheck className="text-aeirmist-cyan shrink-0" size={10} />
                                          )}
                                        </div>
                                        <span className="text-[9px] text-slate-500 dark:text-white/40 block font-mono truncate">
                                          @{item.username}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 shrink-0">
                                      {isItemStore ? (
                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-pink-500/10 border border-pink-500/25 text-pink-500 dark:text-pink-400">
                                          Shop
                                        </span>
                                      ) : isItemService ? (
                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-violet-500/10 border border-violet-500/25 text-violet-500 dark:text-violet-400">
                                          Service
                                        </span>
                                      ) : isItemCreator ? (
                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-aeirmist-cyan/10 border border-aeirmist-cyan/25 text-cyan-600 dark:text-aeirmist-cyan">
                                          Creator
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-white/40 font-mono">
                                          Node
                                        </span>
                                      )}
                                      <ChevronRight size={11} className="text-slate-400 dark:text-white/20 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-6 text-center text-slate-400 dark:text-white/30 text-[10px] font-mono">
                              No results found.
                            </div>
                          )}
                        </div>
                      ) : recentSearches.length > 0 ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 flex items-center gap-1.5">
                              <Clock size={11} className="text-aeirmist-cyan" />
                              Recent Searches
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                clearAllRecentSearches();
                              }}
                              className="text-[9px] font-black tracking-widest text-[#ff00ea]/80 hover:text-[#ff00ea] uppercase cursor-pointer pointer-events-auto"
                            >
                              Clear All
                            </button>
                          </div>
                          
                          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto no-scrollbar">
                            {recentSearches.map((term: any, idx) => {
                              const displayText = typeof term === 'string' ? term : (term?.displayName || term?.name || term?.username || term?.id || String(term));
                              return (
                                <div
                                  key={`recent-${idx}`}
                                  onClick={() => {
                                    setSearchQuery(displayText);
                                    addRecentSearch(displayText);
                                    setIsSearchFocused(false);
                                  }}
                                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-100 dark:border-white/[0.02] text-[10px] text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer group"
                                >
                                  <span className="truncate whitespace-nowrap min-w-0 flex-1">{displayText}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeRecentSearch(term);
                                    }}
                                    className="text-slate-400 dark:text-white/20 hover:text-red-400 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 pointer-events-auto"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 flex items-center gap-1.5 font-mono">
                            <Sparkles size={11} className="text-aeirmist-cyan animate-pulse" />
                            Discover Tags
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {['Luna', 'Zara', 'Sakiba', 'Store', 'Fashion', 'Photography', 'Mindfulness', 'Design'].map((tag) => (
                              <button
                                key={tag}
                                onClick={() => {
                                  setSearchQuery(tag);
                                  addRecentSearch(tag);
                                  setIsSearchFocused(false);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-gradient-to-r dark:hover:from-aeirmist-cyan/20 dark:hover:to-[#ff00ea]/10 border border-slate-200 dark:border-white/5 text-[9.5px] uppercase font-bold tracking-wider text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all pointer-events-auto"
                              >
                                #{tag.toLowerCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

      {/* MAIN GRID VIEW AREA */}
      <div 
        className="flex-1 overflow-y-auto p-6 pb-36 min-h-0 scroll-container"
        style={{ 
          WebkitOverflowScrolling: 'touch', 
          touchAction: 'pan-y', 
          overscrollBehaviorY: 'contain' 
        }}
      >
        {activeTab === 'for-you' && (
          <div className="mb-8 p-6 rounded-[2.5rem] bg-gradient-to-br from-aeirmist-cyan/5 to-aeirmist-magenta/5 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/50">Your Digital Activity</h3>
              <Sparkles size={14} className="text-aeirmist-cyan" />
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest leading-relaxed">
              Posts uploaded to the network will materialize here. The feed is currently optimized for connection mapping.
            </p>
          </div>
        )}
        
        {loadingProfiles ? (
              <div className="w-full h-64 flex flex-col items-center justify-center gap-3 text-white/40">
                <RefreshCw size={20} className="animate-spin text-aeirmist-cyan" />
                <span className="text-[10px] font-mono uppercase tracking-widest">resolving network vectors...</span>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {activeTab === 'for-you' && !searchQuery.trim() ? (
                  /* MULTI-SECTION BENTO-DISCOVERY DASHBOARD FOR 'FOR-YOU' (SUGGESTIONS MIXED FOR MARKETPLACE, CREATORS, AND PROFILES) */
                  <div className="space-y-8">
                    
                    {/* SECTION 1: INCOMING REQUESTS (if any) */}
                    {followRequests.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          {isGlobalBgActive ? (
                            <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0">
                              <UserPlus size={12} className="text-[#ff00ea]" />
                            </div>
                          ) : (
                            <UserPlus size={14} className="text-[#ff00ea]" />
                          )}
                          <h3 className="text-xs font-black uppercase tracking-wider text-white">
                            Connection Proposals ({followRequests.length})
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {followRequests.map((req) => (
                            <div 
                              key={`req-desk-${req.id}`}
                              className={`${isGlobalBgActive ? 'bg-white/[0.06] backdrop-blur-xl' : 'bg-[#0b0914]'} border border-white/5 rounded-2xl p-4 flex flex-col justify-between h-[126px]`}
                            >
                              <div className="flex gap-3 items-center">
                                <img 
                                  src={getAvatarUrl(req.user?.avatar)} 
                                  alt="" 
                                  className="w-11 h-11 rounded-xl object-cover border border-white/10"
                                />
                                <div className="min-w-0">
                                  <h4 className="text-[11px] font-black uppercase tracking-wide text-white truncate">
                                    {req.user?.name || 'Aeirmist Member'}
                                  </h4>
                                  <span className="text-[8.5px] font-mono tracking-widest text-[#ff00ea] block mt-0.5">
                                    Requested 2h ago
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2 pt-2">
                                <button
                                  onClick={() => handleAcceptRequest(req.id, req.fromId, req.user?.name || 'User')}
                                  disabled={processingRequestIds.has(req.id)}
                                  className="flex-1 py-2 bg-aeirmist-cyan text-black text-[9px] font-black uppercase tracking-widest rounded-lg hover:brightness-115 active:scale-95 transition-all cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingRequestIds.has(req.id) ? 'Processing...' : 'Accept'}
                                </button>
                                <button
                                  onClick={() => handleDeclineRequest(req.id, req.user?.name || 'User')}
                                  disabled={processingRequestIds.has(req.id)}
                                  className="flex-1 py-2 bg-white/5 border border-white/5 text-white/50 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingRequestIds.has(req.id) ? 'Processing...' : 'Decline'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SECTION 2: SUGGESTED PROFILES */}
                    {suggestionData.filter(p => !p.isStore && p.isService !== true).length > 0 && (
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-2">
                          {isGlobalBgActive ? (
                            <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0">
                              <Users size={12} className="text-[#00f2ff]" />
                            </div>
                          ) : (
                            <Users size={14} className="text-[#00f2ff]" />
                          )}
                          <h3 className="text-xs font-black uppercase tracking-widest text-white/90">
                            Suggested Profiles
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                          {suggestionData.filter(p => !p.isStore && p.isService !== true).map((p) => (
                            <DesktopSuggestionCard 
                              key={`desk-p-${p.id}`}
                              p={p}
                              btn={getFollowButtonProperties(p.id)}
                              isFollowing={isFollowing(p.id)}
                              isFollowPending={isFollowPending(p.id)}
                              isOnline={isUserOnline(p)}
                              onFollow={() => handleFollow(p.id, p.displayName)}
                              onDismiss={() => handleDismiss(p.id, p.displayName)}
                              onPreview={() => setPreviewProfile(p)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SECTION 3: SUGGESTED CREATORS */}
                    {suggestionData.filter(p => p.isService === true || p.interests?.includes('Spatial Design')).length > 0 && (
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-2">
                          {isGlobalBgActive ? (
                            <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0">
                              <Sparkles size={12} className="text-aeirmist-magenta animate-pulse" />
                            </div>
                          ) : (
                            <Sparkles size={14} className="text-aeirmist-magenta animate-pulse" />
                          )}
                          <h3 className="text-xs font-black uppercase tracking-widest text-white/90">
                            Suggested Creators
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                          {suggestionData.filter(p => p.isService === true || p.interests?.includes('Spatial Design')).map((p) => (
                            <DesktopSuggestionCard 
                              key={`desk-c-${p.id}`}
                              p={p}
                              btn={getFollowButtonProperties(p.id)}
                              isFollowing={isFollowing(p.id)}
                              isFollowPending={isFollowPending(p.id)}
                              isOnline={isUserOnline(p)}
                              onFollow={() => handleFollow(p.id, p.displayName)}
                              onDismiss={() => handleDismiss(p.id, p.displayName)}
                              onPreview={() => setPreviewProfile(p)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SECTION 4: SUGGESTED STORES */}
                    {suggestionData.filter(p => p.isStore === true || p.storeCategory).length > 0 && (
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-2">
                          {isGlobalBgActive ? (
                            <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0">
                              <Store size={12} className="text-[#00f2ff]" />
                            </div>
                          ) : (
                            <Store size={14} className="text-[#00f2ff]" />
                          )}
                          <h3 className="text-xs font-black uppercase tracking-widest text-white/90">
                            Suggested Stores & Marketplace Stores
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                          {suggestionData.filter(p => p.isStore === true || p.storeCategory).map((p) => (
                            <DesktopSuggestionCard 
                              key={`desk-s-${p.id}`}
                              p={p}
                              btn={getFollowButtonProperties(p.id)}
                              isFollowing={isFollowing(p.id)}
                              isFollowPending={isFollowPending(p.id)}
                              isOnline={isUserOnline(p)}
                              onFollow={() => handleFollow(p.id, p.displayName)}
                              onDismiss={() => handleDismiss(p.id, p.displayName)}
                              onPreview={() => setPreviewProfile(p)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {suggestionData.length === 0 && (
                      <div className="w-full text-center py-20 flex flex-col items-center">
                        <Users size={32} className="text-white/20 mb-3" />
                        <h4 className="text-xs font-black uppercase tracking-wider">All Suggestions Handled!</h4>
                        <button
                          onClick={handleRefreshSuggestions}
                          className="mt-4 px-5 py-3 rounded-xl bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta text-black text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                        >
                          <RefreshCw size={11} className="animate-spin" style={{ animationDuration: '4s' }} />
                          <span>Restore Hidden Suggestions</span>
                        </button>
                      </div>
                    )}

                  </div>
                ) : (
                  /* SPECIFIC SUB-TAB CONTENT SHOWN IN standard desktop grid format */
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#00f2ff]">
                      {searchQuery.trim() ? `Search Results for "${searchQuery}" (${activeTabProfiles.length})` : `${activeTab} (${activeTab === 'blocked' ? (profile?.social?.blocked?.length || 0) : activeTabProfiles.length})`}
                    </h3>

                    {/* BLOCKED TAB — special dedicated render with Unblock button */}
                    {activeTab === 'blocked' ? (
                      (() => {
                        const blockedIds: string[] = profile?.social?.blocked || [];
                        if (blockedIds.length === 0) {
                          return (
                            <div className="text-center py-20 border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                              <UserX size={32} className="text-white/20 mx-auto mb-3" />
                              <span className="text-[10px] font-mono tracking-widest uppercase text-white/30">
                                No blocked users.
                              </span>
                            </div>
                          );
                        }
                        // Get profile data for blocked users (from loaded profiles or stub)
                        const blockedProfiles = blockedIds.map(bid => {
                          const found = profiles.find((p: any) => p.id === bid || p.uid === bid);
                          return found || { id: bid, displayName: 'Aeirmist User', photoURL: null, username: bid.slice(0, 8) };
                        });
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {blockedProfiles.map((p: any) => (
                              <div
                                key={`blocked-${p.id}`}
                                className={`${isGlobalBgActive ? 'bg-white/[0.06] backdrop-blur-xl border border-white/10' : 'bg-[#0b0914] border border-white/5'} rounded-2xl p-4 flex flex-col gap-3`}
                              >
                                <div className="flex items-center gap-3">
                                  <img
                                    src={getAvatarUrl(p.photoURL)}
                                    alt={p.displayName}
                                    className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-black uppercase tracking-wide text-white truncate">
                                      {p.displayName || 'Aeirmist User'}
                                    </p>
                                    <span className="text-[9px] font-mono text-white/40 truncate block">
                                      @{p.username || p.id?.slice(0, 10)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                                  <UserX size={10} className="text-red-400 shrink-0" />
                                  <span className="text-[9px] font-black uppercase tracking-widest text-red-400">Blocked</span>
                                </div>
                                <button
                                  onClick={async () => {
                                    await toggleBlockUser(p.id);
                                    addToast({ title: 'Unblocked', message: `${p.displayName || 'User'} has been unblocked.`, type: 'success' });
                                  }}
                                  className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                                >
                                  Unblock
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()
                    ) : activeTabProfiles.length === 0 ? (
                      <div className="text-center py-20 border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                        <span className="text-[10px] font-mono tracking-widest uppercase text-white/30">
                          Empty connection vectors. No profiles match this query category.
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {activeTabProfiles.map((p) => (
                          <DesktopSuggestionCard 
                            key={`desk-tab-p-${p.id}`}
                            p={p}
                            btn={getFollowButtonProperties(p.id)}
                            isFollowing={isFollowing(p.id)}
                            isFollowPending={isFollowPending(p.id)}
                            isOnline={isUserOnline(p)}
                            onFollow={() => handleFollow(p.id, p.displayName)}
                            onDismiss={() => handleDismiss(p.id, p.displayName)}
                            onPreview={() => setPreviewProfile(p)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </AnimatePresence>
            )}

          </div>

        </div>

      </div>

      {/* ========================================== */}
      {/*        2. MOBILE VIEWPORT LAYOUT           */}
      {/* ========================================== */}
      <div className="flex md:hidden flex-col w-full h-full min-h-0 flex-1 relative overflow-hidden" id="mobile-connections-layout">
        
        {/* 1. STICKY TOP HEADER ZONE */}
        <div className={`sticky top-0 ${isGlobalBgActive ? 'bg-[#030206]/35' : 'bg-[#030206]/98'} backdrop-blur-3xl z-30 pt-2 pb-2 border-b border-white/5 px-4 flex flex-col shrink-0 gap-2`}>
          
          {/* Dynamic header name and count badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black uppercase tracking-wider text-white">Connections</h1>
              {activeTab === 'requests' && followRequests.length > 0 && (
                <span className="text-[10px] bg-aeirmist-magenta text-white font-black px-2 py-0.5 rounded-full animate-bounce">
                  {followRequests.length}
                </span>
              )}
            </div>
          </div>

          {/* Search bar input underneath */}
          <div className="relative w-full z-40">
            <div className="relative w-full">
              {isGlobalBgActive ? (
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0 z-10 pointer-events-none">
                  <Search className={`w-3 h-3 transition-colors duration-300 ${isSearchFocused ? 'text-aeirmist-cyan' : 'text-white/40'}`} />
                </div>
              ) : (
                <Search className={`w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-300 ${isSearchFocused ? 'text-aeirmist-cyan' : 'text-white/40'}`} />
              )}
              <input 
                type="text" 
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addRecentSearch(searchQuery);
                    setIsSearchFocused(false);
                    (e.target as HTMLInputElement).blur();
                  } else if (e.key === 'Escape') {
                    setIsSearchFocused(false);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Search People, IDs, Stores..."
                className={`w-full bg-slate-100 dark:bg-[#110f17] border border-slate-200 dark:border-white/10 rounded-xl ${isGlobalBgActive ? 'pl-10' : 'pl-9'} pr-9 py-2 text-[11px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-aeirmist-cyan/40 focus:ring-1 focus:ring-aeirmist-cyan/10 transition-all font-mono`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 hover:text-slate-900 dark:hover:text-white transition-colors p-1"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* MOBILE RECENT SEARCHES & SUGGESTIONS DROP-DOWN BAR */}
            <AnimatePresence>
              {isSearchFocused && (
                <motion.div key="mobile-search-dropdown">
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => {
                      if (searchQuery.trim()) {
                        addRecentSearch(searchQuery);
                      }
                      setIsSearchFocused(false);
                    }} 
                  />
                  
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#090710] border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(3,2,6,0.95)] p-4 z-50 overflow-hidden font-sans"
                  >
                    {/* Dynamic Search Matches / Recent Searches */}
                    {searchQuery.trim().length > 0 ? (
                      <div className="space-y-2.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 flex items-center gap-1.5 font-mono">
                          <Sparkles size={11} className="text-aeirmist-cyan animate-pulse" />
                          Matching IDs, Pages & Shops
                        </span>
                        
                        {matchingSuggestions.length > 0 ? (
                          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto no-scrollbar">
                            {matchingSuggestions.map((item) => {
                              const isItemStore = item.isStore || item.storeCategory;
                              const isItemService = item.isService;
                              const isItemCreator = item.isVerified;
                              
                              return (
                                <div
                                  key={`mob-match-${item.id}`}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={() => {
                                    setSearchQuery(item.displayName || item.username);
                                    addRecentSearch(item.displayName || item.username);
                                    setIsSearchFocused(false);
                                    if (onUserClick) {
                                      onUserClick(item);
                                    } else {
                                      setPreviewProfile(item);
                                    }
                                  }}
                                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-100 dark:border-white/[0.02] hover:border-slate-200 dark:hover:border-white/10 text-slate-800 dark:text-white transition-all cursor-pointer group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="relative">
                                      <img 
                                        src={getAvatarUrl(item.photoURL)} 
                                        alt={item.displayName}
                                        referrerPolicy="no-referrer"
                                        className="w-8 h-8 rounded-xl border border-slate-200 dark:border-white/10 object-cover"
                                      />
                                      {isUserOnline(item) && (
                                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#090710] shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                                      )}
                                    </div>
                                    <div className="text-left min-w-0 flex-1">
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-bold text-slate-900 dark:text-white group-hover:text-aeirmist-cyan transition-colors truncate">
                                          {item.displayName || item.name}
                                        </span>
                                        {item.isVerified && (
                                          <ShieldCheck className="text-aeirmist-cyan shrink-0" size={10} />
                                        )}
                                      </div>
                                      <span className="text-[9px] text-slate-500 dark:text-white/40 block font-mono truncate">
                                        @{item.username}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isItemStore ? (
                                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-pink-500/10 border border-pink-500/25 text-pink-500 dark:text-pink-400">
                                        Shop
                                      </span>
                                    ) : isItemService ? (
                                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-violet-500/10 border border-violet-500/25 text-violet-500 dark:text-violet-400">
                                        Service
                                      </span>
                                    ) : isItemCreator ? (
                                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-aeirmist-cyan/10 border border-aeirmist-cyan/25 text-cyan-600 dark:text-aeirmist-cyan">
                                        Creator
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-white/40 font-mono">
                                        Node
                                      </span>
                                    )}
                                    <ChevronRight size={11} className="text-slate-400 dark:text-white/20 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-slate-400 dark:text-white/30 text-[10px] font-mono">
                            No results found.
                          </div>
                        )}
                      </div>
                    ) : recentSearches.length > 0 ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 flex items-center gap-1.5">
                            <Clock size={11} className="text-aeirmist-cyan" />
                            Recent Searches
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearAllRecentSearches();
                            }}
                            className="text-[9px] font-black tracking-widest text-[#ff00ea]/80 hover:text-[#ff00ea] uppercase cursor-pointer"
                          >
                            Clear All
                          </button>
                        </div>
                        
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto no-scrollbar">
                          {recentSearches.map((term: any, idx) => {
                            const displayText = typeof term === 'string' ? term : (term?.displayName || term?.name || term?.username || term?.id || String(term));
                            return (
                              <div
                                key={`mob-recent-${idx}`}
                                onClick={() => {
                                  setSearchQuery(displayText);
                                  addRecentSearch(displayText);
                                  setIsSearchFocused(false);
                                }}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-100 dark:border-white/[0.02] text-[10px] text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer group"
                              >
                                <span className="truncate">{displayText}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeRecentSearch(term);
                                  }}
                                  className="text-slate-400 dark:text-white/20 hover:text-red-400 p-1 rounded transition-colors"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 flex items-center gap-1.5 font-mono">
                          <Sparkles size={11} className="text-aeirmist-cyan animate-pulse" />
                          Discover Tags
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {['Luna', 'Zara', 'Sakiba', 'Store', 'Fashion', 'Photography', 'Mindfulness', 'Design'].map((tag) => (
                            <button
                              key={`mob-tag-${tag}`}
                              onClick={() => {
                                setSearchQuery(tag);
                                addRecentSearch(tag);
                                setIsSearchFocused(false);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-gradient-to-r dark:hover:from-aeirmist-cyan/20 dark:hover:to-[#ff00ea]/10 border border-slate-200 dark:border-white/5 text-[9.5px] uppercase font-bold tracking-wider text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all"
                            >
                              #{tag.toLowerCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Horizontal scrollable categories navigation chips */}
          <div className="flex overflow-x-auto gap-2 py-0.5 select-none no-scrollbar scroll-smooth">
            {([
              { id: 'for-you', label: 'For You' },
              { id: 'following', label: 'Following' },
              { id: 'requests', label: `Requests (${followRequests.length})` },
              { id: 'creators', label: 'Creators' },
              { id: 'verified', label: 'Verified' },
              { id: 'stores', label: 'Stores' },
              { id: 'new', label: 'New' }
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  // Switch tab
                  setActiveTab(tab.id);
                }}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0 cursor-pointer ${
                  activeTab === tab.id 
                    ? 'bg-white border border-white text-black font-black shadow-md' 
                    : `${isGlobalBgActive ? 'bg-white/[0.06] backdrop-blur-xl border border-white/5' : 'bg-white/5 border border-white/5'} text-white/45 hover:text-white hover:border-white/10`
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>

        {/* 2. MAIN FEED CONTENT STREAM AREA */}
        <div 
          className="flex-1 overflow-y-auto px-3.5 pt-1.5 pb-36 relative min-h-0 scroll-container"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehaviorY: 'contain' }}
        >
          
          <AnimatePresence mode="popLayout">
            {loadingProfiles ? (
              <div className="w-full h-40 flex flex-col items-center justify-center gap-2 text-white/40 opacity-60">
                <RefreshCw size={18} className="animate-spin text-aeirmist-cyan" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#00f2ff]">resolving connections...</span>
              </div>
            ) : activeTabProfiles.length === 0 ? (
              <motion.div 
                key="connections-empty-mob"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full max-w-sm mx-auto rounded-3xl border border-dashed border-white/10 bg-white/[0.01] p-8 text-center my-6 flex flex-col items-center"
              >
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/50 mb-4">
                  <Users size={20} className="text-aeirmist-cyan drop-shadow-[0_0_8px_rgba(0,242,255,0.4)]" />
                </div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-white/90">You&apos;re all caught up.</h3>
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest leading-relaxed mt-2.5">
                  {activeTab === 'requests' 
                    ? 'There are no verification proposals pending in your inbox right now.'
                    : activeTab === 'for-you'
                    ? "You've seen all suggestions for now."
                    : 'No active users correspond to this query filter.'}
                </p>
                
                {activeTab === 'for-you' && (
                  <button
                    onClick={handleRefreshSuggestions}
                    className="mt-5 px-5 py-3 rounded-xl bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta text-black text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    <RefreshCw size={11} className="animate-spin" style={{ animationDuration: '4s' }} />
                    <span>Refresh Suggestions</span>
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key={`cards-stream-mob-${activeTab}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-2"
              >
                {activeTabProfiles.map((p, index) => {
                  
                  // --- SPECIAL CASE: INCOMING follow requests view ---
                  if (activeTab === 'requests') {
                    return (
                      <motion.div
                        key={`request-card-mob-${p.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl ${isGlobalBgActive ? 'bg-white/[0.06] backdrop-blur-xl' : 'bg-[#0b0a11]'} border border-white/5 h-[76px]`}
                      >
                        <div 
                          onClick={() => setPreviewProfile({ id: p.fromId, displayName: p.user?.name, username: p.user?.username, photoURL: p.user?.avatar })}
                          className="flex items-center gap-3 min-w-0 cursor-pointer"
                        >
                          <img 
                            src={getAvatarUrl(p.user?.avatar)} 
                            className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0" 
                            alt="" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-black uppercase text-white tracking-wide truncate block">
                              {p.user?.name || 'Aeirmist Member'}
                            </span>
                            <span className="text-[9px] font-mono tracking-widest text-[#ff00ea] block">
                              Requested 2h ago
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-1.5 shrink-0 select-none">
                          <button
                            onClick={() => handleAcceptRequest(p.id, p.fromId, p.user?.name || 'User')}
                            disabled={processingRequestIds.has(p.id)}
                            className="px-3.5 py-2 rounded-lg bg-aeirmist-cyan text-black text-[9px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingRequestIds.has(p.id) ? 'Processing...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(p.id, p.user?.name || 'User')}
                            disabled={processingRequestIds.has(p.id)}
                            className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-white/50 hover:text-white text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingRequestIds.has(p.id) ? 'Processing...' : 'Decline'}
                          </button>
                        </div>
                      </motion.div>
                    );
                  }

                  // --- STANDARD LIST ITEM CARD FEEDS ---
                  const btn = getFollowButtonProperties(p.id);
                  const isFollowingTarget = isFollowing(p.id);

                  return (
                    <motion.div
                      key={`suggestion-scroller-mob-${p.id}`}
                      layoutId={`scroller-item-mob-${p.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: 'spring', damping: 24, stiffness: 210 }}
                      className={`w-full relative rounded-2xl ${isGlobalBgActive ? 'bg-white/[0.06] backdrop-blur-xl' : 'bg-gradient-to-r from-[#0b0811] to-[#120e1d]'} border border-white/5 hover:border-white/10 transition-all select-none overflow-hidden h-[72px] flex items-center pr-3 group pl-3 shadow-sm flex-row justify-between`}
                    >
                      {/* Left details trigger bottom sheet display */}
                      <div 
                        onClick={() => setPreviewProfile(p)}
                        className="flex items-center gap-3 min-w-0 pr-2 cursor-pointer flex-1"
                      >
                        <div className="relative shrink-0">
                          <img 
                            src={getAvatarUrl(p.photoURL)} 
                            alt={p.displayName} 
                            className="w-10 h-10 rounded-xl object-cover border border-white/10"
                            referrerPolicy="no-referrer"
                          />
                          {isUserOnline(p) && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0c0a15] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                          )}
                        </div>
                        
                        <div className="min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-black uppercase text-white tracking-wide truncate block">
                              {p.displayName || p.name || 'User'}
                            </span>
                            {p.isVerified && (
                              <ShieldCheck className="text-aeirmist-cyan shrink-0" size={12} />
                            )}
                            {p.isStore && (
                              <Store className="w-3 h-3 text-aeirmist-cyan shrink-0" />
                            )}
                          </div>
                          <span className="text-[9.5px] font-mono font-bold tracking-wider text-[#00f2ff] block truncate pt-0.5">
                            @{p.username}
                          </span>
                          
                          {/* Compact Mutual follows or indicators layout details */}
                          {(p.mutualCount || p.location) && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-[8px] font-mono uppercase text-white/30">
                              {p.mutualCount ? (
                                <span className="text-aeirmist-cyan/80 font-bold">{p.mutualCount} mutuals</span>
                              ) : p.location ? (
                                <span className="truncate max-w-[120px]">{p.location}</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right compact hero transaction buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 select-none">
                        
                        {/* Cross suggestion dismiss button */}
                        {!isFollowingTarget && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismiss(p.id, p.displayName);
                            }}
                            className={`p-2 ${isGlobalBgActive ? 'bg-white/10 backdrop-blur-md border border-white/10 text-white/60' : 'bg-white/5 border border-white/5 text-white/40'} hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20 active:scale-90 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0`}
                            title="Hide suggestion"
                          >
                            <X size={12} strokeWidth={2.5} />
                          </button>
                        )}

                        {/* Connection follow button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollow(p.id, p.displayName);
                          }}
                          className={`h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:brightness-105 active:scale-95 transition-all text-center border cursor-pointer ${btn.style}`}
                          title={btn.label}
                        >
                          {btn.icon && (
                            isGlobalBgActive ? (
                              <span className="p-0.5 rounded bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0">
                                {btn.icon}
                              </span>
                            ) : btn.icon
                          )}
                          <span>{btn.label}</span>
                        </button>

                      </div>

                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

      {/* 3. PREMIUM HOVER PROFILE PREVIEW BOTTOM SHEET SYSTEM */}
      <AnimatePresence>
        {previewProfile && (
          <motion.div key="preview-profile-overlay-wrapper">
            {/* Dark blur overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewProfile(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100]"
            />
            
            {/* Sheet content */}
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed bottom-0 inset-x-0 bg-[#07060b] border-t border-white/10 rounded-t-[2.2rem] p-6 pb-12 z-[101] text-left shadow-2xl max-w-md mx-auto"
            >
              {/* aesthetic drag pill */}
              <div className="w-12 h-1 bg-white/15 rounded-full mx-auto mb-6" />

              {/* Top basic card detail */}
              <div className="flex gap-4 items-center mb-6 border-b border-white/5 pb-5 w-full">
                <img 
                  src={getAvatarUrl(previewProfile.photoURL)} 
                  alt="" 
                  className="w-14 h-14 rounded-2xl object-cover border border-white/10"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">
                      {previewProfile.displayName}
                    </h3>
                    {previewProfile.isVerified && (
                      <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-[#00f2ff] tracking-widest uppercase block mt-0.5">
                    @{previewProfile.username}
                  </span>
                  
                  <div className="flex gap-1.5 mt-2">
                    {previewProfile.mutualCount && (
                      <span className="text-[7.5px] font-mono font-bold uppercase tracking-wider text-[#00f2ff] border border-aeirmist-cyan/20 px-1.5 py-0.5 rounded bg-aeirmist-cyan/5">
                        {previewProfile.mutualCount} mutual connections
                      </span>
                    )}
                    {previewProfile.isPrivate && (
                      <span className="text-[7.5px] font-mono font-bold uppercase tracking-wider text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded bg-amber-500/5">
                        Private Account
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* interactive control trigger options */}
              <div className="space-y-2.5">
                
                {/* 1. View full profile */}
                <button
                  onClick={() => {
                    if (onUserClick) onUserClick(previewProfile);
                    setPreviewProfile(null);
                  }}
                  className="w-full h-13 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-between px-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Compass size={13} className="text-[#00f2ff]" />
                    <span>View Profile Vector</span>
                  </div>
                  <ChevronRight size={13} className="text-white/40" />
                </button>

                {/* 2. Follow button state matching list item */}
                <button
                  onClick={() => {
                    handleFollow(previewProfile.id, previewProfile.displayName);
                  }}
                  className="w-full h-13 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-between px-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Users size={13} className="text-[#ff00ea]" />
                    <span>
                      {isFollowing(previewProfile.id) 
                        ? 'Disconnect Channel' 
                        : isFollowPending(previewProfile.id)
                        ? 'Withdraw Proposal'
                        : 'Initiate Channel link'}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono font-black text-white/40 uppercase">
                    {isFollowing(previewProfile.id) ? 'Following' : isFollowPending(previewProfile.id) ? 'Pending' : 'Sync'}
                  </span>
                </button>

                {/* 3. Share URL link */}
                <button
                  onClick={() => {
                    handleShareProfile(previewProfile.username, previewProfile.displayName);
                    setPreviewProfile(null);
                  }}
                  className="w-full h-13 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-between px-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Share2 size={13} className="text-emerald-400" />
                    <span>Share Coordinates URL</span>
                  </div>
                  <ChevronRight size={13} className="text-white/40" />
                </button>

                {/* Close current bottom sheet */}
                <button
                  onClick={() => setPreviewProfile(null)}
                  className="w-full h-12 rounded-xl bg-white/5 border border-white/5 hover:brightness-110 text-white/50 text-[10px] font-black uppercase tracking-widest transition-colors text-center cursor-pointer mt-2"
                >
                  Cancel Preview
                </button>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

/* ========================================== */
/*   DESKTOP FACEBOOK-STYLE SUGGESTION CARD   */
/* ========================================== */
interface DesktopSuggestionCardProps {
  p: any;
  btn: any;
  isFollowing: boolean;
  isFollowPending: boolean;
  isOnline?: boolean;
  onFollow: () => void;
  onDismiss: () => void;
  onPreview: () => void;
}

const DesktopSuggestionCard: React.FC<DesktopSuggestionCardProps> = ({
  p,
  btn,
  isFollowing,
  isFollowPending,
  isOnline = false,
  onFollow,
  onDismiss,
  onPreview
}) => {
  const { settings } = useAppearance();
  const isGlobalBgActive = settings?.globalBgType && settings.globalBgType !== 'none';

  return (
    <motion.div
      layoutId={`scroller-item-desk-${p.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', damping: 20, stiffness: 180 }}
      className={`${isGlobalBgActive ? 'bg-white/[0.06] backdrop-blur-xl' : 'bg-gradient-to-b from-[#0c0a15] to-[#120f20]'} border border-white/5 hover:border-[#00f2ff]/30 rounded-2xl p-3.5 flex flex-col justify-between hover:shadow-[0_0_20px_rgba(0,242,255,0.06)] group transition-all`}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div onClick={onPreview} className="flex items-center gap-3 min-w-0 cursor-pointer flex-1">
          <div className="relative shrink-0">
            <img 
              src={getAvatarUrl(p.photoURL)} 
              alt={p.displayName} 
              className="w-11 h-11 rounded-xl object-cover border border-white/10"
              referrerPolicy="no-referrer"
            />
            {isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0c0a15] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            )}
          </div>
          
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-black uppercase text-white tracking-wide truncate">
                {p.displayName || p.name || 'Aeirmist Member'}
              </span>
              {p.isVerified && (
                <ShieldCheck className="text-aeirmist-cyan shrink-0" size={13} />
              )}
            </div>
            <span className="text-[10px] font-mono font-bold tracking-wider text-[#00f2ff] truncate block">
              @{p.username}
            </span>
            {(p.mutualCount || p.location) && (
              <span className="text-[8.5px] font-mono text-white/40 tracking-wider truncate block mt-0.5">
                {p.mutualCount ? `${p.mutualCount} Mutual Connections` : p.location}
              </span>
            )}
          </div>
        </div>

        {/* Small desk cancel/remove button */}
        {!isFollowing && (
          <button
            onClick={onDismiss}
            className={`p-1.5 rounded-lg ${isGlobalBgActive ? 'bg-white/10 backdrop-blur-md border border-white/10 text-white/60' : 'bg-white/5 border border-white/5 text-white/30'} hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 cursor-pointer transition-all active:scale-90`}
            title="Remove suggestion"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Hero control actions */}
      <div className="flex gap-2 pt-3">
        <button
          onClick={onFollow}
          className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-95 transition-all text-center border cursor-pointer ${btn.style}`}
        >
          {btn.icon && (
            isGlobalBgActive ? (
              <span className="p-1 rounded-md bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0">
                {btn.icon}
              </span>
            ) : btn.icon
          )}
          <span>{btn.label}</span>
        </button>

        <button
          onClick={onPreview}
          className={`px-3 py-2 rounded-xl ${isGlobalBgActive ? 'bg-white/10 backdrop-blur-md border border-white/10 text-white' : 'bg-white/5 border border-white/5 text-white/60'} hover:bg-white/15 hover:border-white/15 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center justify-center`}
          title="Preview Coordinates"
        >
          <Compass size={13} />
        </button>
      </div>

    </motion.div>
  );
};

export default AeirmistDashboard;
