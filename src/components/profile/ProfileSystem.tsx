import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAeirmist } from '../../context/AeirmistContext';
import { useReport } from '../reporting/ReportContext';
import { useAppearance } from '../../context/AppearanceContext';
import { formatAeirmistTimestamp } from '../../lib/date';
import { MediaQuality } from '../../services/MediaService';
import { getRankInfo, AEIRMIST_THRESHOLDS } from '../../lib/aeirmistRanks';
import { AeirmistRankBadge } from './AeirmistRankBadge';
import { AeirmistRankGuide } from './AeirmistRankGuide';
import { getAvatarUrl } from '../../lib/avatar';
import { Avatar } from '../ui/Avatar';
import { AeirmistLogo } from '../ui/AeirmistLogo';
import { PostMenu } from '../PostMenu';
import { EditPostModal } from '../EditPostModal';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, deleteDoc, getDocs, limit } from 'firebase/firestore';
import { AccountSwitcher } from '../auth/AccountSwitcher';
import { StoryArchiveModal } from './StoryArchiveModal';
import { StoryViewer } from '../feed/StoriesSystem';
import { HighlightManagerModal } from './HighlightManagerModal';
import { NGLButton, NGLDashboard, NGLComposer } from './NGLSystem';
import { DesktopProfileLayout } from './DesktopProfileLayout';
import { DigitalImageEditor } from '../media/DigitalImageEditor';
import { ProfileCompletionCard } from './ProfileCompletionCard';
import { QuartCard } from './QuartCard';
import { AeirmistCreatorStudio } from '../videos/AeirmistCreatorStudio';
import { useNGL } from '../../hooks/useNGL';
import { BarChart2, Sliders, Briefcase, Eye, BarChart3, Check, Play } from 'lucide-react';
import { usePostAnalytics } from '../../hooks/usePostAnalytics';
import { postAnalytics } from '../../services/PostAnalyticsService';
const InsightsDashboard = React.lazy(() => import('../analytics/InsightsDashboard').then(m => ({ default: m.InsightsDashboard })));
import { CreatorTier, TIER_THRESHOLDS } from '../../types/economy';
import { useBackHandler } from '../../utils/backNavigation';
import { 
  Settings, 
  Share2, 
  Grid, 
  Video, 
  Bookmark, 
  Tag, 
  MessageSquare, 
  ShieldCheck, 
  UserPlus, 
  UserMinus,
  Zap, 
  Activity, 
  Clock, 
  Shield,
  Ghost,
  Camera,
  Radio,
  MapPin,
  ExternalLink,
  Plus,
  ChevronRight,
  Loader2,
  Lock,
  MoreVertical,
  MinusCircle,
  X,
  Image as ImageIcon,
  EyeOff,
  UserCheck,
  Crown,
  Sparkles,
  Link2,
  Cpu,
  Info,
  Instagram,
  Facebook,
  Globe,
  Search,
  Users,
  ChevronDown,
  Infinity as InfinityIcon,
  Award,
  Heart,
  Reply,
  Archive,
  ShieldAlert
} from 'lucide-react';

// Simple Digital Particle System for depth (optimized)
const DigitalParticles = () => null; // Removed heavy particles for system cleanliness and performance as per user 'clean rakho' intent

const getNextRankProgress = (points: number) => {
  // Sort thresholds ascending for easy calculation
  const sortedThresholds = [...AEIRMIST_THRESHOLDS].reverse(); // 0, 1000, 5000, 15000, 35000, 100000
  const currentLevelInfo = getRankInfo(points);
  
  const currentIndex = sortedThresholds.findIndex(t => t.rank === currentLevelInfo.rank);
  const nextLevelInfo = currentIndex < sortedThresholds.length - 1 ? sortedThresholds[currentIndex + 1] : null;
  
  if (!nextLevelInfo) {
    return { percent: 100, nextPoints: points, nextRank: 'MAX LEVEL' };
  }
  
  const currentBase = sortedThresholds[currentIndex].points;
  const nextTarget = nextLevelInfo.points;
  const range = nextTarget - currentBase;
  const progressInStep = points - currentBase;
  const percent = Math.min(100, Math.max(0, (progressInStep / range) * 100));
  
  return {
    percent,
    nextPoints: nextTarget,
    nextRank: nextLevelInfo.rank
  };
};

// Aeirmist Profile System - Cyberpunk Interface
const ProfileSystem = ({ targetProfile, onMessageClick, onEditProfile, onUserClick, onPostClick, onCreate }: { targetProfile?: any, onMessageClick?: (user: any) => void, onEditProfile?: () => void, onUserClick?: (user: any) => void, onPostClick?: (postId: string) => void, onCreate?: () => void }) => {
  const { settings } = useAppearance();
  const isGlobalBgActive = settings.globalBgType !== 'none' && !!settings.globalBgValue;
  const { 
    db, 
    user, 
    profile, 
    toggleFollow, 
    removeFollower,
    recalculateFollowCounts,
    getFollowers,
    getFollowing,
    isFollowing: checkIsFollowing, 
    isFollowPending,
    updateProfile, 
    setCameraConfig, 
    uploadMedia, 
    onlineUsers,
    toggleBlockUser,
    toggleRestrictUser,
    isBlocked,
    isRestricted,
    isCloseFriend,
    toggleCloseFriend,
    addToast,
    localAvatarURL,
    localCoverURL,
    profileUploadProgress,
    coverUploadProgress,
    setLocalAvatarURL,
    setLocalCoverURL,
    setProfileUploadProgress,
    setCoverUploadProgress,
    optimisticStories,
    openVault
  } = useAeirmist();
  
  const [liveTargetProfile, setLiveTargetProfile] = useState<any>(null);
  const isOwnProfile = !targetProfile || targetProfile?.id === profile?.id;
  const displayUser = liveTargetProfile || targetProfile || profile;
  const isDataLoading = !isOwnProfile && !!targetProfile?.id && !liveTargetProfile;

  const rankInfo = getRankInfo(displayUser?.aeirmistLevel || 0);
  const progressInfo = getNextRankProgress(displayUser?.aeirmistLevel || 0);

  // Real-time listener for target profile
  React.useEffect(() => {
    if (!db) return;
    
    // Reset live profile whenever target changes to avoid showing stale data from previous views
    setLiveTargetProfile(null);
    
    // If we have an ID, use it (existing logic)
    if (targetProfile?.id && targetProfile.id !== profile?.id) {
      const unsub = onSnapshot(doc(db, 'profiles', targetProfile.id), (snap) => {
        if (snap.exists()) {
          setLiveTargetProfile({ id: snap.id, ...snap.data() });
        }
      });
      return () => unsub();
    } 
    
    // If we only have a username, fetch by username
    if (!targetProfile?.id && targetProfile?.username) {
      const q = query(collection(db, 'profiles'), where('username', '==', targetProfile.username), limit(1));
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          setLiveTargetProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      });
      return () => unsub();
    }

    setLiveTargetProfile(null);
  }, [db, targetProfile?.id, targetProfile?.username, profile?.id]);

  useEffect(() => {
    if (isOwnProfile && profile?.id) {
      recalculateFollowCounts(profile.id);
    }
    if (isOwnProfile && profile?.pruningReason) {
      updateProfile({ pruningReason: null }).catch(() => {});
    }
  }, [isOwnProfile, profile?.id, profile?.pruningReason, updateProfile]);

  const isFollowingUser = targetProfile ? checkIsFollowing(targetProfile.id) : false;
  const isMessageLocked = false;
  const isFollowerOfMe = targetProfile ? (profile?.social?.followers || []).includes(targetProfile.id) : false;
  const isMutual = isFollowingUser && (profile?.social?.followers || []).includes(displayUser?.id);
  const isPendingUser = targetProfile ? isFollowPending(targetProfile.id) : false;
  const isLocked = !isOwnProfile && (displayUser?.isPrivate || displayUser?.isProfileLocked) && !isFollowingUser;
  const isOnline = Boolean(onlineUsers?.has(displayUser?.id));
  const isBlockedUser = targetProfile 
    ? (isBlocked(targetProfile.id) || isBlocked(targetProfile.ownerUid || '') || isBlocked(targetProfile.uid || '')) 
    : false;
  const isRestrictedUser = targetProfile ? isRestricted(targetProfile.id) : false;
  const isFav = targetProfile ? isCloseFriend(targetProfile.id) : false;
  const [isHoveringFollow, setIsHoveringFollow] = useState(false);

  const [activeTab, setActiveTab] = useState('posts');
  const [isStoryArchiveOpen, setIsStoryArchiveOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false); // New managed state for clean edit flow
  const [isRankDetailModalOpen, setIsRankDetailModalOpen] = useState(false);

  const isProfessionalAccount = displayUser?.accountType === 'professional' || 
                               displayUser?.accountType === 'business' || 
                               displayUser?.isProfessional === true;

  const [creatorStudioOpen, setCreatorStudioOpen] = useState(false);
  const [creatorStudioInitialTab, setCreatorStudioInitialTab] = useState<'overview' | 'content' | 'analytics' | 'audience' | 'comments' | 'monetization' | 'settings'>('overview');

  const toggleCreatorMode = async () => {
    if (!isOwnProfile || !isProfessionalAccount || isUpdating) return;
    setIsUpdating(true);
    try {
      const nextVal = !displayUser?.creatorModeEnabled;
      await updateProfile({ creatorModeEnabled: nextVal });
      addToast?.({
        title: nextVal ? 'Creator Mode On' : 'Creator Mode Off',
        message: nextVal ? 'Creator Mode is active. You can now see deep analytics and the creator hub.' : 'Creator Mode is off. Returning to a simple profile view.',
        type: 'success'
      });
    } catch (e: any) {
      console.error('[ProfileSystem] Error toggling creator mode:', e);
      addToast?.({
        title: 'Update Failed',
        message: 'Something went wrong while changing your settings. Please try again.',
        type: 'warning'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const isVerified = !!displayUser?.isVerified;
  const isInfinity = (displayUser?.aeirmistLevel || 0) >= 250000;
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [followListData, setFollowListData] = useState<any[]>([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<{ file: File; src: string; type: 'avatar' | 'cover' } | null>(null);
  const [isNGLDashboardOpen, setIsNGLDashboardOpen] = useState(false);
  const [isNGLComposerOpen, setIsNGLComposerOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [tempBio, setTempBio] = useState('');
  const [tempUsername, setTempUsername] = useState('');
  const [tempDisplayName, setTempDisplayName] = useState('');
  const [tempInstagram, setTempInstagram] = useState('');
  const [tempFacebook, setTempFacebook] = useState('');
  const [tempWebsite, setTempWebsite] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isProfileLocked, setIsProfileLocked] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [allowCalls, setAllowCalls] = useState(true);
  
  const [userNote, setUserNote] = useState<any | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [isMutualModalOpen, setIsMutualModalOpen] = useState(false);
  const [followListSearchFilter, setFollowListSearchFilter] = useState('');

  // Dismissable Core Widget state persisted per profile
  const [isCoreWidgetDismissed, setIsCoreWidgetDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`aeirmist_dismiss_core_widget_${displayUser?.id || 'default'}`) === 'true';
    } catch (e) {
      return false;
    }
  });

  React.useEffect(() => {
    if (displayUser?.id) {
      try {
        const isDismissed = localStorage.getItem(`aeirmist_dismiss_core_widget_${displayUser.id}`) === 'true';
        setIsCoreWidgetDismissed(isDismissed);
      } catch (e) {
        // ignore
      }
    }
  }, [displayUser?.id]);

  const handleDismissCoreWidget = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCoreWidgetDismissed(true);
    try {
      localStorage.setItem(`aeirmist_dismiss_core_widget_${displayUser?.id || 'default'}`, 'true');
    } catch (e) {
      // ignore
    }
  };

  // Intercept back actions for Profile modals, sheets, and sub-views
  useBackHandler(() => {
    if (editingPhoto) {
      setEditingPhoto(null);
      return true;
    }
    if (showAvatarMenu) {
      setShowAvatarMenu(false);
      return true;
    }
    if (followListType) {
      setFollowListType(null);
      return true;
    }
    if (isEditProfileModalOpen) {
      setIsEditProfileModalOpen(false);
      return true;
    }
    if (isEditingBio) {
      setIsEditingBio(false);
      return true;
    }
    if (isStoryArchiveOpen) {
      setIsStoryArchiveOpen(false);
      return true;
    }
    if (isRankDetailModalOpen) {
      setIsRankDetailModalOpen(false);
      return true;
    }
    if (creatorStudioOpen) {
      setCreatorStudioOpen(false);
      return true;
    }
    if (isNGLDashboardOpen || isNGLComposerOpen) {
      setIsNGLDashboardOpen(false);
      setIsNGLComposerOpen(false);
      return true;
    }
    if (isNoteModalOpen) {
      setIsNoteModalOpen(false);
      return true;
    }
    if (isMutualModalOpen) {
      setIsMutualModalOpen(false);
      return true;
    }
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return true;
    }
    if (isAccountSwitcherOpen) {
      setIsAccountSwitcherOpen(false);
      return true;
    }
    return false;
  }, true, 100, [
    editingPhoto,
    showAvatarMenu,
    followListType,
    isEditProfileModalOpen,
    isEditingBio,
    isStoryArchiveOpen,
    isRankDetailModalOpen,
    creatorStudioOpen,
    isNGLDashboardOpen,
    isNGLComposerOpen,
    isNoteModalOpen,
    isMutualModalOpen,
    isMenuOpen,
    isAccountSwitcherOpen
  ]);

  // Sync temp states when displayUser changes or when modal opens
  React.useEffect(() => {
    if (displayUser) {
      setTempBio(displayUser.bio || '');
      setTempUsername(displayUser.username || '');
      setTempDisplayName(displayUser.displayName || '');
      setTempInstagram(displayUser.socialLinks?.instagram || '');
      setTempFacebook(displayUser.socialLinks?.facebook || '');
      setTempWebsite(displayUser.website || displayUser.socialLinks?.website || '');
      setIsPrivate(displayUser.isPrivate || false);
      setIsProfileLocked(displayUser.isProfileLocked || false);
      setAllowMessages(displayUser.privacySettings?.allowMessages !== false);
      setAllowCalls(displayUser.privacySettings?.allowCalls !== false);
    }
  }, [displayUser?.id, isEditingBio]);

  // Fetch active user note (valid within 24h)
  React.useEffect(() => {
    if (!db || !displayUser?.id) return;
    try {
      const q = query(
        collection(db, 'notes'),
        where('authorId', '==', displayUser.id),
        limit(5)
      );
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const now = Date.now();
          const validNotes = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((n: any) => {
              const ms = n.createdAt?.toMillis ? n.createdAt.toMillis() : (n.createdAt?.seconds ? n.createdAt.seconds * 1000 : 0);
              return !ms || (now - ms) < 24 * 60 * 60 * 1000;
            })
            .sort((a: any, b: any) => {
              const getSec = (x: any) => x.createdAt?.seconds || 0;
              return getSec(b) - getSec(a);
            });
          setUserNote(validNotes[0] || null);
        } else {
          setUserNote(null);
        }
      }, (e) => {
        console.warn("User note fetch listener error", e);
      });
      return () => unsub();
    } catch (err) {
      console.warn("Notes query setup error", err);
    }
  }, [db, displayUser?.id]);
  
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loadingSavedPosts, setLoadingSavedPosts] = useState(false);
  const [mutualConnections, setMutualConnections] = useState<any[]>([]);
  const [loadingMutuals, setLoadingMutuals] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);

  // Suggested Profiles, Trending, Marketplace and NGL Replies states (for dual column desktop view)
  const [rightPanelSuggestions, setRightPanelSuggestions] = useState<any[]>([]);
  const [rightPanelTrending, setRightPanelTrending] = useState<any[]>([]);
  const { messages: nglSignals, loading: loadingNGL } = useNGL(displayUser?.id);
  const [nglReplyInputs, setNglReplyInputs] = useState<{ [key: string]: string }>({});
  const [replyingMessageId, setReplyingMessageId] = useState<string | null>(null);
  
  // Local active theme or unlocked mods
  const [unlockedItems, setUnlockedItems] = useState<string[]>(displayUser?.unlockedItems || []);
  const [activeCoverTheme, setActiveCoverTheme] = useState<string>(displayUser?.activeCoverTheme || 'default');

  // Load right panel suggestions from Firestore with defensive checks
  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    const loadRightPanelData = async () => {
      try {
        const profilesRef = collection(db, 'profiles');
        const suggestQuery = query(profilesRef, limit(10));
        const snap = await getDocs(suggestQuery);
        if (!isMounted) return;
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(p => p.id !== profile?.id && p.id !== displayUser?.id);
        
        setRightPanelSuggestions(list.slice(0, 3));

        const trendingQuery = query(profilesRef, orderBy('aeirmistLevel', 'desc'), limit(5));
        const trendSnap = await getDocs(trendingQuery);
        if (!isMounted) return;
        const trendList = trendSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(p => p.id !== displayUser?.id);
        setRightPanelTrending(trendList.slice(0, 3));
      } catch (err) {
        console.warn("Right panel data sync paused:", err);
      }
    };
    loadRightPanelData();
    return () => { isMounted = false; };
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
      setUnlockedItems(updatedList);
      addToast?.({
        title: 'SYNC COMPLETED',
        message: `${itemId.toUpperCase().replace('_', ' ')} artifact acquired successfully. -${cost} AP deducted.`,
        type: 'success'
      });
    } catch (e: any) {
      console.error(e);
      addToast?.({
        title: 'CRYPTO SHIELD ERROR',
        message: 'Aeirmist points ledger update halted because node rejected transaction signatures.',
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
      console.error(err);
    }
  };

  // Fetch Mutual Connections
  React.useEffect(() => {
    if (!db || !profile || !displayUser?.id || isOwnProfile || !displayUser.social?.followers) return;
    
    const fetchMutuals = async () => {
      setLoadingMutuals(true);
      try {
        const myFollowing = profile.social?.following || [];
        const theirFollowers = displayUser.social?.followers || [];
        const mutualIds = myFollowing.filter((id: string) => theirFollowers.includes(id)).slice(0, 3);
        
        if (mutualIds.length > 0) {
          const mutualData = await Promise.all(
            mutualIds.map(async (id: string) => {
              const snap = await getDoc(doc(db, 'profiles', id));
              return snap.exists() ? { id: snap.id, ...snap.data() } : null;
            })
          );
          setMutualConnections(mutualData.filter(Boolean));
        }
      } catch (e) {
        console.error("Mutual connections sync failed", e);
      } finally {
        setLoadingMutuals(false);
      }
    };

    fetchMutuals();
  }, [db, profile?.social?.following, displayUser?.id, isOwnProfile]);

  const [highlights, setHighlights] = useState<any[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(true);
  const [hasActiveStory, setHasActiveStory] = useState(false);
  const [hasUnseenStory, setHasUnseenStory] = useState(false);
  const [selectedHighlight, setSelectedHighlight] = useState<any>(null);
  const [isLoadingHighlightStories, setIsLoadingHighlightStories] = useState(false);

  // Highlight Manager and Action Sheet states
  const [highlightManagerState, setHighlightManagerState] = useState<{ mode: 'create' | 'edit', highlight?: any } | null>(null);
  const [activeHighlightActionSheet, setActiveHighlightActionSheet] = useState<any | null>(null);

  // Check for active stories
  React.useEffect(() => {
    if (!db || !displayUser?.id) return;
    
    const isOwn = displayUser.id === user?.uid || displayUser.id === profile?.id;
    
    const storyCandidateUids = Array.from(new Set([
      displayUser.id,
      displayUser.uid,
      displayUser.ownerUid,
      displayUser.id.replace(/^profile_/, ''),
      'profile_' + displayUser.id.replace(/^profile_/, '')
    ].filter(Boolean)));

    const q = query(
      collection(db, 'stories'),
      where('userId', 'in', storyCandidateUids),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const activeStories = snap.docs.filter(doc => {
        const data = doc.data();
        const getMs = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (val instanceof Date) return val.getTime();
          if (typeof val === 'number') return val;
          if (val.seconds) return val.seconds * 1000;
          return 0;
        };
        return getMs(data.createdAt) > yesterday;
      });
      const dbHasStory = activeStories.length > 0;
      const optHasStory = isOwn && optimisticStories.length > 0;
      setHasActiveStory(dbHasStory || optHasStory);

      const allSeen = dbHasStory && activeStories.every(doc => {
        const data = doc.data();
        const viewers = data.viewers || [];
        return viewers.includes(user?.uid);
      });
      setHasUnseenStory(dbHasStory && !allSeen);
    });

    // Immediate check for optimistic
    if (isOwn && optimisticStories.length > 0) {
      setHasActiveStory(true);
      setHasUnseenStory(true);
    }

    return () => unsub();
  }, [db, displayUser?.id, optimisticStories, user?.uid]);

  const handleHighlightClick = async (highlight: any) => {
    if (!db) return;
    
    // For owner of the profile, let's open an interactive choice sheet
    if (isOwnProfile) {
      setActiveHighlightActionSheet(highlight);
      return;
    }

    // For other users, view directly
    await viewHighlightDirectly(highlight);
  };

  const viewHighlightDirectly = async (highlight: any) => {
    setIsLoadingHighlightStories(true);
    try {
      const storyIds = highlight.stories || [];
      if (storyIds.length === 0) {
        addToast?.({ title: "Highlight Empty", message: "No stories found in this highlight.", type: "warning" });
        return;
      }

      const storiesData = await Promise.all(
        storyIds.map(async (id: string) => {
          const sSnap = await getDoc(doc(db, 'stories', id));
          return sSnap.exists() ? { id: sSnap.id, ...sSnap.data() } : null;
        })
      );

      const validStories = storiesData.filter(Boolean);
      if (validStories.length > 0) {
        setSelectedHighlight({
          id: highlight.id,
          userId: displayUser.id,
          userName: displayUser.displayName,
          userAvatar: getAvatarUrl(displayUser.photoURL),
          stories: validStories,
          isHighlight: true,
          label: highlight.label
        });
      }
    } catch (e) {
      console.error("Highlight load failed", e);
    } finally {
      setIsLoadingHighlightStories(false);
    }
  };

  // Fetch Posts
  React.useEffect(() => {
    if (!db || !displayUser?.id) return;
    
    setLoadingPosts(true);
    const authorCandidateIds = Array.from(new Set([
      displayUser.id,
      displayUser.uid,
      displayUser.ownerUid,
      displayUser.id.replace(/^profile_/, ''),
      'profile_' + displayUser.id.replace(/^profile_/, '')
    ].filter(Boolean)));

    const q = query(
      collection(db, 'posts'), 
      where('authorId', 'in', authorCandidateIds),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetchedPosts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("[Diagnostics - Profile Posts] fetchedPosts from Firestore:", fetchedPosts.map((p: any) => ({
        id: p.id,
        content: (p.content || '').substring(0, 50),
        mediaType: p.mediaType || 'none',
        isArchived: !!p.isArchived,
        hasImage: !!((p.mediaUrls && p.mediaUrls.length > 0) || p.mediaUrl || p.mediaURL || (p.mediaItems && p.mediaItems.some((item: any) => item?.type === 'image')))
      })));
      fetchedPosts.sort((a, b) => {
        const getTime = (p: any) => {
          if (!p || !p.createdAt) return Date.now();
          try {
            if (p.createdAt.toDate) return p.createdAt.toDate().getTime();
            if (p.createdAt instanceof Date) return p.createdAt.getTime();
            if (p.createdAt.seconds) return p.createdAt.seconds * 1000;
            if (typeof p.createdAt === 'number') return p.createdAt;
          } catch (e) {}
          return Date.now();
        };
        return getTime(b) - getTime(a);
      });
      setPosts(fetchedPosts);
      setLoadingPosts(false);
    }, (error) => {
      console.error("Posts fetch failed", error);
      setLoadingPosts(false);
    });

    return () => unsub();
  }, [db, displayUser?.id]);

  // Fetch Bookmarked/Saved Posts for Self
  React.useEffect(() => {
    if (!db || !displayUser?.id || !isOwnProfile || activeTab !== 'saved') return;
    
    setLoadingSavedPosts(true);
    const q = query(
      collection(db, 'posts'),
      where('savedBy', 'array-contains', displayUser.id),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetchedSaved = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedSaved.sort((a, b) => {
        const getTime = (p: any) => {
          if (!p || !p.createdAt) return Date.now();
          try {
            if (p.createdAt.toDate) return p.createdAt.toDate().getTime();
            if (p.createdAt instanceof Date) return p.createdAt.getTime();
            if (p.createdAt.seconds) return p.createdAt.seconds * 1000;
            if (typeof p.createdAt === 'number') return p.createdAt;
          } catch (e) {}
          return Date.now();
        };
        return getTime(b) - getTime(a);
      });
      setSavedPosts(fetchedSaved);
      setLoadingSavedPosts(false);
    }, (error) => {
      console.warn("Saved posts loading error", error);
      setLoadingSavedPosts(false);
    });

    return () => unsub();
  }, [db, displayUser?.id, isOwnProfile, activeTab]);

  // Fetch Highlights
  React.useEffect(() => {
    if (!db || !displayUser?.id) return;
    
    setLoadingHighlights(true);
    const q = query(
      collection(db, 'highlights'),
      where('userId', '==', displayUser.id),
      limit(30)
    );

    const unsub = onSnapshot(q, (snap) => {
      const allHighlights = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const fetchedHighlights = allHighlights.filter((h: any) => {
        const hasStories = h.stories && h.stories.length > 0;
        if (isOwnProfile) return true;
        return hasStories;
      });
      fetchedHighlights.sort((a, b) => {
        const getTime = (p: any) => {
          if (!p || !p.createdAt) return Date.now();
          try {
            if (p.createdAt.toDate) return p.createdAt.toDate().getTime();
            if (p.createdAt instanceof Date) return p.createdAt.getTime();
            if (p.createdAt.seconds) return p.createdAt.seconds * 1000;
            if (typeof p.createdAt === 'number') return p.createdAt;
          } catch (e) {}
          return Date.now();
        };
        return getTime(b) - getTime(a);
      });
      setHighlights(fetchedHighlights);
      setLoadingHighlights(false);
    }, (error) => {
      console.error("Highlights fetch failed", error);
      setLoadingHighlights(false);
    });

    return () => unsub();
  }, [db, displayUser?.id, isOwnProfile]);

  const openCameraForAvatar = () => {
    setShowAvatarMenu(false);
    setCameraConfig({
      isOpen: true,
      mode: 'PHOTO',
      onCapture: async (file: File) => {
        let localUrl = '';
        try {
          setIsUpdating(true);
          localUrl = URL.createObjectURL(file);
          setLocalAvatarURL(localUrl);
          console.log("[ProfileSystem] Capturing avatar artifact...");
          const url = await uploadMedia(file, `users/${user?.uid}/profile`, (progress) => {
            setProfileUploadProgress(progress);
          }, MediaQuality.PROFILE);
          await updateProfile({ photoURL: url });
          console.log("[ProfileSystem] Avatar successfully saved.");
          setCameraConfig(null);
          setProfileUploadProgress(0);
        } catch (e: any) {
          console.error("[ProfileSystem] Avatar capture failed:", e);
          setLocalAvatarURL(null);
          addToast?.({
            title: 'Upload Failed',
            message: 'Could not update your profile photo. Please try again.',
            type: 'warning'
          });
        } finally {
          setIsUpdating(false);
          setProfileUploadProgress(0);
          if (localUrl) {
            URL.revokeObjectURL(localUrl);
          }
        }
      }
    });
  };

  const handleUpdateIdentity = async () => {
    setIsUpdating(true);
    setUpdateError(null);
    try {
      console.log("Initiating Identity Sync...", { tempBio, tempUsername, tempDisplayName, tempInstagram, tempFacebook, tempWebsite, isPrivate, isProfileLocked, allowMessages, allowCalls });
      await updateProfile({ 
        bio: tempBio, 
        username: tempUsername,
        displayName: tempDisplayName,
        website: tempWebsite,
        isPrivate,
        isProfileLocked,
        privacySettings: {
          allowMessages,
          allowCalls,
          followingVisibility: 'followers',
          storyVisibility: 'followers'
        },
        socialLinks: {
          instagram: tempInstagram,
          facebook: tempFacebook,
          website: tempWebsite
        }
      });
      console.log("Identity Sync Successful");
      setIsEditingBio(false);
    } catch (e: any) {
      console.error("Identity update failed", e);
      setUpdateError(e.message || "Configuration sync failed.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAvatarInteraction = () => {
    if (!isOwnProfile) {
      // If someone else's profile, maybe open their story if they had one
      // For now just do nothing as requested to focus on own profile change
      return;
    }
    setShowAvatarMenu(true);
  };

  const handleSelectAvatarFile = (file: File) => {
    if (!file) return;
    setShowAvatarMenu(false);
    const previewSrc = URL.createObjectURL(file);
    setEditingPhoto({ file, src: previewSrc, type: 'avatar' });
  };

  const handleSelectCoverFile = (file: File) => {
    if (!file) return;
    const previewSrc = URL.createObjectURL(file);
    setEditingPhoto({ file, src: previewSrc, type: 'cover' });
  };

  const handleSaveEditedPhoto = async (blob: Blob) => {
    if (!editingPhoto || !user) return;
    const { type, src } = editingPhoto;
    const fileName = `aeirmist_${type}_${Date.now()}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    
    // Revoke previous preview and set local preview from edited file
    if (src) URL.revokeObjectURL(src);
    const localUrl = URL.createObjectURL(file);
    if (type === 'avatar') {
      setLocalAvatarURL(localUrl);
      setProfileUploadProgress(15);
    } else {
      setLocalCoverURL(localUrl);
      setCoverUploadProgress(15);
    }
    setEditingPhoto(null);
    setIsUpdating(true);

    try {
      const folder = type === 'avatar' ? `users/${user.uid}/profile` : `users/${user.uid}/cover`;
      const quality = type === 'avatar' ? MediaQuality.PROFILE : MediaQuality.HD;
      const onProgress = (p: number) => {
        if (type === 'avatar') setProfileUploadProgress(p);
        else setCoverUploadProgress(p);
      };

      const url = await uploadMedia(file, folder, onProgress, quality);

      if (type === 'avatar') {
        await updateProfile({ photoURL: url });
        addToast?.({
          title: 'Profile Photo Updated',
          message: 'Your profile picture has been updated.',
          type: 'success'
        });
      } else {
        await updateProfile({ coverURL: url, bannerURL: url });
        addToast?.({
          title: 'Cover Photo Updated',
          message: 'Your cover banner has been updated.',
          type: 'success'
        });
      }
      
      URL.revokeObjectURL(localUrl);
      if (type === 'avatar') {
        setLocalAvatarURL(null);
      } else {
        setLocalCoverURL(null);
      }
    } catch (err: any) {
      console.error(`[ProfileSystem] ${type} upload failed:`, err);
      if (type === 'avatar') {
        setLocalAvatarURL(null);
        setProfileUploadProgress(0);
      } else {
        setLocalCoverURL(null);
        setCoverUploadProgress(0);
      }
      addToast?.({
        title: 'Upload Failed',
        message: `Could not update your ${type === 'avatar' ? 'profile' : 'cover'} photo. Please try again.`,
        type: 'warning'
      });
    } finally {
      setIsUpdating(false);
      if (type === 'avatar') setProfileUploadProgress(0);
      else setCoverUploadProgress(0);
    }
  };

  const handleGalleryUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    handleSelectAvatarFile(file);
    if (e?.target) e.target.value = '';
  };

  const handleCoverUpload = async (file: File) => {
    if (!file || !user) return;
    handleSelectCoverFile(file);
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    try {
      setIsUpdating(true);
      setShowAvatarMenu(false);
      await updateProfile({ photoURL: null });
    } catch (e) {
      console.error("Avatar removal failed", e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateHighlight = () => {
    setHighlightManagerState({ mode: 'create' });
  };
  
  const handleShowFollowList = async (type: 'followers' | 'following') => {
    if (!displayUser?.id) return;
    setFollowListType(type);
    setLoadingFollowList(true);
    try {
      const data = type === 'followers' 
        ? await getFollowers(displayUser.id)
        : await getFollowing(displayUser.id);
      setFollowListData(data);
      if (isOwnProfile && profile?.id) {
        recalculateFollowCounts(profile.id);
      }
    } catch (err) {
      console.error(`Failed to fetch ${type}`, err);
    } finally {
      setLoadingFollowList(false);
    }
  };

  const handleRemoveFollower = async (followerId: string) => {
    try {
      await removeFollower(followerId);
      setFollowListData(prev => prev.filter(p => p.id !== followerId));
    } catch (e) {
      console.error("Failed to remove follower", e);
    }
  };

  const handleShareProfile = async () => {
    const shareUrl = displayUser?.username
      ? `${window.location.origin}/@${displayUser.username}`
      : (displayUser?.id ? `${window.location.origin}/u/${displayUser.id}` : `${window.location.origin}/profile`);
    const shareData = {
      title: `${displayUser.displayName} (@${displayUser.username}) on Aeirmist`,
      text: `Check out ${displayUser.displayName}'s profile on Aeirmist!`,
      url: shareUrl
    };

    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        shared = true;
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.warn("Native share failed, falling back to clipboard:", e);
        } else {
          return;
        }
      }
    }

    if (!shared) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        addToast({ title: 'Link copied', message: 'Profile link copied to clipboard.', type: 'success' });
      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    }
  };

  const isBannedAccount = displayUser?.status === 'BANNED' || displayUser?.isBanned;
  if (isBannedAccount) {
    return (
      <div className="w-full max-w-2xl mx-auto p-12 my-16 glass-panel rounded-[32px] border-red-500/20 bg-[#030712] text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto">
          <ShieldAlert size={36} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-widest text-white">This account is no longer available</h2>
          <p className="text-xs font-mono text-red-400">Reason: Account permanently banned.</p>
        </div>
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 max-w-md mx-auto text-left">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white/40 font-bold text-lg">
              AU
            </div>
            <div>
              <p className="text-sm font-bold text-white">Aeirmist User</p>
              <p className="text-[10px] font-mono text-white/30">Profile locked • No bio • No posts • No marketplace</p>
            </div>
          </div>
          <div className="pt-2 border-t border-white/5 flex justify-between text-[10px] font-mono text-white/40">
            <span>Status: RESTRICTED</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="profile-system-root" className="w-full lg:pb-8 pb-40 relative min-h-full bg-[#01050a] text-white selection:bg-aeirmist-cyan selection:text-black font-sans">
      {/* Avatar Update Menu */}
                <AnimatePresence>
                  {showAvatarMenu && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAvatarMenu(false)}
                        className="absolute inset-0 bg-black/80 backdrop-blur-lg"
                      />
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative z-10 w-full max-w-[280px] bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-6 shadow-3xl overflow-hidden"
                      >
                         {/* Scanline Effect */}
                         <div className="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
                            <div className="absolute top-0 left-10 w-px h-full bg-aeirmist-cyan animate-scan-slow" />
                         </div>

                         <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-8 text-center">Profile Sync</h3>
                         
                         <div className="space-y-3">
                            <button 
                              onClick={() => { setShowAvatarMenu(false); fileInputRef.current?.click(); }}
                              className="w-full py-5 bg-aeirmist-cyan text-black rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,242,255,0.2)]"
                            >
                              <ImageIcon size={14} strokeWidth={3} /> Choose from Gallery
                            </button>
                            <button 
                              onClick={openCameraForAvatar}
                              className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest hover:bg-white/10 active:scale-95 transition-all"
                            >
                              <Camera size={14} className="text-aeirmist-magenta" /> Take Photo
                            </button>
                            {displayUser?.photoURL && (
                              <button 
                                onClick={handleRemoveAvatar}
                                className="w-full py-5 bg-red-500/5 border border-red-500/10 text-red-500 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest hover:bg-red-500/10 transition-all"
                              >
                                <X size={14} /> Remove Artifact
                              </button>
                            )}
                            <button 
                              onClick={() => setShowAvatarMenu(false)}
                              className="w-full py-5 text-white/20 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all"
                            >
                              Dismiss
                            </button>
                         </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                {/* Meta/Facebook-Style Photo Crop/Edit Modal */}
                <AnimatePresence>
                  {editingPhoto && (
                    <DigitalImageEditor
                      imageSrc={editingPhoto.src}
                      aspectRatio={editingPhoto.type === 'avatar' ? 1 : 3}
                      title={editingPhoto.type === 'avatar' ? 'Update profile picture' : 'Update cover photo (1080p HD)'}
                      onSave={handleSaveEditedPhoto}
                      onCancel={() => {
                        if (editingPhoto.src) URL.revokeObjectURL(editingPhoto.src);
                        setEditingPhoto(null);
                      }}
                    />
                  )}
                </AnimatePresence>
      {/* Layer 1: Background Grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,242,255,0.01)_1.5px,transparent_1.5px),linear-gradient(90deg,rgba(0,242,255,0.01)_1.5px,transparent_1.5px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />
      </div>

      {/* Layer 2: Gradient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-aeirmist-cyan/5 blur-[120px] rounded-full animate-pulse opacity-100" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-aeirmist-magenta/5 blur-[120px] rounded-full animate-pulse opacity-100" style={{ animationDelay: '2s' }} />
      </div>

      {/* Layer 3: Floating Particles */}
      <DigitalParticles />

      <div className="w-full relative z-10 font-sans">
        {/* Desktop-only Version Wrapper */}
        <div className="hidden lg:block max-w-[2000px] mx-auto px-4 lg:px-8">
          <DesktopProfileLayout
            displayUser={displayUser}
            profile={profile}
            onRankClick={() => setIsRankDetailModalOpen(true)}
            isOwnProfile={isOwnProfile}
            isDataLoading={isDataLoading}
            isLocked={isLocked}
            isOnline={isOnline}
            isVerified={isVerified}
            isInfinity={isInfinity}
            isEditingBio={isEditingBio}
            setIsEditingBio={setIsEditingBio}
            tempBio={tempBio}
            setTempBio={setTempBio}
            handleUpdateIdentity={handleUpdateIdentity}
            posts={posts}
            savedPosts={savedPosts}
            loadingSavedPosts={loadingSavedPosts}
            loadingPosts={loadingPosts}
            nglSignals={nglSignals}
            isFollowingUser={isFollowingUser}
            isPendingUser={isPendingUser}
            isFollowerOfMe={isFollowerOfMe}
            toggleFollow={toggleFollow}
            onMessageClick={onMessageClick}
            isMessageLocked={isMessageLocked}
            handleShareProfile={handleShareProfile}
            setIsNGLDashboardOpen={setIsNGLDashboardOpen}
            setIsNGLComposerOpen={setIsNGLComposerOpen}
            setIsAccountSwitcherOpen={setIsAccountSwitcherOpen}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            toggleCloseFriend={toggleCloseFriend}
            isFav={isFav}
            toggleBlockUser={toggleBlockUser}
            isBlockedUser={isBlockedUser}
            onUserClick={onUserClick}
            addToast={addToast}
            updateProfile={updateProfile}
            setSelectedPost={setSelectedPost}
            db={db}
            uploadMedia={uploadMedia}
            handleCoverUpload={handleCoverUpload}
            PostCard={PostCard}
            highlights={highlights}
            loadingHighlights={loadingHighlights}
            handleCreateHighlight={handleCreateHighlight}
            handleHighlightClick={handleHighlightClick}
            checkIsFollowing={checkIsFollowing}
            isFollowPending={isFollowPending}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            handleShowFollowList={handleShowFollowList}
            mutualConnections={mutualConnections}
            onOpenMutuals={() => setIsMutualModalOpen(true)}
            userNote={userNote}
            onNoteClick={() => setIsNoteModalOpen(true)}
            onSelectAvatarFile={handleSelectAvatarFile}
            onSelectCoverFile={handleSelectCoverFile}
          />
        </div>

        {/* Hiding obsolete desktop cards */}
        <div className="hidden">
          {/* Layer 4: Profile Header Card - Glassmorphism */}
          <div className="bg-white/[0.02] border border-white/5 backdrop-blur-3xl rounded-3xl sm:rounded-[2rem] p-5 sm:p-8 mb-8 shadow-2xl relative group/card overflow-hidden">
          {/* Card Hover Reflection */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-1000 pointer-events-none" />

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-center lg:items-start text-center lg:text-left">
            {/* Square DP System with Holographic Refinement */}
            <div className="relative group shrink-0">
              {/* BACK SHAPE REFINEMENT: Soft holographic glass plates & rotating neon frames */}
              <div className="absolute inset-[-40px] pointer-events-none perspective-[1000px] z-0">
                {/* Layer 1: Cyan holographic plate */}
                <motion.div 
                  animate={{ rotate: 360, scale: [1, 1.08, 1], x: [-6, 6, -6] }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border border-aeirmist-cyan/10 rounded-[3rem] bg-aeirmist-cyan/5 backdrop-blur-[2px] opacity-20"
                />
                {/* Layer 2: Purple blurred liquid geometry */}
                <motion.div 
                  animate={{ rotate: -360, scale: [1.08, 1, 1.08], y: [-6, 6, -6] }}
                  transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[10%] border border-aeirmist-magenta/10 rounded-[3.2rem] bg-aeirmist-magenta/5 backdrop-blur-[6px] opacity-10"
                />
              </div>

              <motion.div 
                whileHover={{ rotateX: 5, rotateY: 5, scale: 1.02 }}
                style={{ perspective: 1000 }}
                className="relative p-1.5 bg-white dark:bg-transparent rounded-[2.2rem] shadow-xl dark:shadow-none ring-4 ring-white/95 dark:ring-transparent transition-all duration-700"
              >
                {/* DP FRAME IMPROVEMENT: Double Border + Glow */}
                <div className={`absolute inset-0 blur-md opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.2rem] ${isInfinity ? 'bg-aeirmist-magenta/40 opacity-100 animate-pulse' : 'bg-aeirmist-cyan/30'}`} />
                
                {/* Thin Purple Inner Outline */}
                <div className={`absolute inset-0 border rounded-[2rem] z-30 pointer-events-none ${isInfinity ? 'border-aeirmist-magenta/40 animate-pulse' : 'border-aeirmist-magenta/20'}`} />
                
                <Avatar
                  src={(isOwnProfile && localAvatarURL) ? localAvatarURL : getAvatarUrl(displayUser?.photoURL)}
                  alt={displayUser?.username}
                  sizeClassName="w-28 h-28 sm:w-36 sm:h-36"
                  roundedClassName="rounded-[2rem]"
                  innerRoundedClassName="rounded-[1.8rem]"
                  showStoryRing={true}
                  storyRingState={hasActiveStory ? (hasUnseenStory ? 'active' : 'seen') : 'none'}
                  onClick={handleAvatarInteraction}
                  className="z-20 relative font-sans"
                  imgClassName="transition-transform duration-500 ease-out group-hover:scale-105 will-change-transform transform-gpu"
                >
                  {isOwnProfile && profileUploadProgress > 0 && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-50">
                      <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden mb-2">
                         <motion.div 
                           animate={{ width: `${profileUploadProgress}%` }}
                           className="h-full bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,0.8)]"
                         />
                      </div>
                      <span className="text-[8px] font-black uppercase text-aeirmist-cyan animate-pulse">Syncing: {Math.round(profileUploadProgress)}%</span>
                    </div>
                  )}

                  {/* Glass Reflection */}
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-white/5 skew-y-[-12deg] -translate-y-full group-hover:translate-y-[-20%] transition-transform duration-1000 pointer-events-none" />
                  
                  {isUpdating && !localAvatarURL && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
                      <Loader2 size={32} className="text-aeirmist-cyan animate-spin" />
                    </div>
                  )}
                </Avatar>

                <input 
                  type="file"
                  id="global-avatar-input"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleGalleryUpdate}
                />

                
              </motion.div>

              {/* CAMERA BUTTON FIX: Magnetic, smaller, semi-transparent */}
              {isOwnProfile && (
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(0, 242, 255, 0.8)' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleAvatarInteraction}
                  className="absolute bottom-2 right-2 w-10 h-10 rounded-xl bg-white/90 backdrop-blur-xl text-black flex items-center justify-center border-2 border-slate-200 dark:border-[#01050a] transition-all z-40 shadow-xl hover:bg-aeirmist-cyan hover:text-black cursor-pointer"
                >
                  <Camera size={16} />
                </motion.button>
              )}
            </div>

            {/* Profile Details Rebalance */}
            <div className="flex-1 flex flex-col pt-2 items-center lg:items-start w-full">
              <div className="flex items-center gap-4 mb-2 flex-wrap justify-center lg:justify-start">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-sm transition-all group-hover:text-aeirmist-cyan flex items-center gap-2">
                  {isDataLoading ? (
                    <Skeleton className="h-10 w-48 rounded-xl opacity-20" />
                  ) : (
                    <>
                      {displayUser?.displayName || 'User'}
                      {isVerified && <ShieldCheck size={20} className="text-aeirmist-cyan shrink-0" />}
                      {isInfinity && <InfinityIcon size={20} className="text-aeirmist-magenta animate-pulse shrink-0" />}
                    </>
                  )}
                </h1>
                <div className="flex gap-2 items-center flex-wrap">
                  <div onClick={() => setIsRankDetailModalOpen(true)} className="cursor-pointer hover:scale-110 transition-transform">
                    <AeirmistRankBadge score={displayUser?.aeirmistLevel || 0} size="sm" />
                  </div>
                  {(displayUser?.isPrivate || displayUser?.isProfileLocked) && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-aeirmist-magenta/15 border border-aeirmist-magenta/30 text-aeirmist-magenta text-[9px] font-black uppercase tracking-widest">
                      <Lock size={10} />
                      Private Profile
                    </div>
                  )}
                </div>
              </div>


              <div className="space-y-3 mb-5 w-full">
                <div className="flex items-center gap-3 justify-center lg:justify-start">
                   <div className="flex items-center gap-1.5">
                     <p className="text-sm font-black text-aeirmist-cyan tracking-[0.15em] hover:drop-shadow-[0_0_5px_rgba(0,242,255,0.5)] transition-all cursor-pointer">@{displayUser?.username}</p>
                     {displayUser?.isVerified && <ShieldCheck size={14} className="text-aeirmist-cyan shrink-0" />}
                   </div>
                   <span className="text-[9px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/30 font-black tracking-widest uppercase">
                     {Array.isArray(displayUser?.pronouns) 
                       ? displayUser.pronouns.join(' · ') 
                       : (typeof displayUser?.pronouns === 'string' && displayUser.pronouns ? displayUser.pronouns : 'HE/HIM')}
                   </span>
                </div>

                {/* Modern Holographic Aeirmist Core Widget */}
                {!isCoreWidgetDismissed && (
                  <div 
                    onClick={() => setIsRankDetailModalOpen(true)}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-white/[0.02] to-white/[0.01] border border-white/5 hover:border-white/15 hover:bg-white/[0.03] active:scale-[0.99] cursor-pointer shadow-2xl relative overflow-hidden group/aeirmistcore lg:max-w-md w-full transition-all duration-300"
                    title="View Rank Spectrum & Benefits"
                  >
                    {/* Subtle decorative grid background layer */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[length:16px_16px] opacity-40 pointer-events-none" />
                    
                    {/* Absolute subtle background glow */}
                    <div 
                      className="absolute -right-16 -top-16 w-32 h-32 blur-3xl rounded-full opacity-25 group-hover/aeirmistcore:opacity-40 transition-opacity duration-500 pointer-events-none"
                      style={{ backgroundColor: rankInfo.color }}
                    />

                    <div className="relative z-10 flex flex-col gap-2">
                      {/* Header line */}
                      <div className="flex items-center justify-between font-sans">
                        <div 
                          onClick={() => setIsRankDetailModalOpen(true)}
                          className="flex items-center gap-2 group/title cursor-pointer"
                        >
                          <Cpu size={14} className="animate-spin group-hover:text-aeirmist-cyan transition-colors" style={{ color: rankInfo.color, animationDuration: '6s' }} />
                          <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] group-hover:text-white/70 transition-colors">Aeirmist Sync Level</span>
                          <Info size={10} className="text-white/20 group-hover:text-aeirmist-cyan opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[10px] font-black tracking-wider" style={{ color: rankInfo.color }}>
                            {displayUser?.aeirmistLevel || 0} AP (Aeirmist Points)
                          </span>
                          <button
                            type="button"
                            onClick={handleDismissCoreWidget}
                            className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer z-20"
                            title="Hide widget"
                            aria-label="Hide widget"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
   
                      {/* Rank Indicator Badge */}
                      <div 
                        onClick={() => setIsRankDetailModalOpen(true)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-black/40 border border-white/5 p-3 rounded-xl cursor-pointer hover:bg-black/60 hover:border-white/20 transition-all group/rankbox"
                      >
                        <div className="flex items-center gap-2.5">
                          <AeirmistRankBadge score={displayUser?.aeirmistLevel || 0} size="sm" />
                          <span className="text-xs font-black uppercase tracking-[0.25em] text-white group-hover/rankbox:text-aeirmist-cyan transition-colors">
                            {rankInfo.rank}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Rank specific multiplier badge */}
                          <span className="text-[9px] font-black font-mono tracking-widest px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 w-fit">
                            MULTIPLIER: {rankInfo.rank === CreatorTier.EXPLORER ? '1.0x' : rankInfo.rank === CreatorTier.CREATOR ? '1.2x' : rankInfo.rank === CreatorTier.VERIFIED_CREATOR ? '1.5x' : rankInfo.rank === CreatorTier.INFINITY_MEMBER ? '2.0x' : '3.0x ELITE'}
                          </span>
                          <ChevronRight size={12} className="text-white/20 group-hover/rankbox:text-aeirmist-cyan group-hover/rankbox:translate-x-1 transition-all" />
                        </div>
                      </div>

                      {/* Aeirmist Level Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-white/35">
                          <div className="flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-aeirmist-lime animate-pulse" />
                            <span>Sync Status: Active</span>
                          </div>
                          <span className="hover:text-aeirmist-cyan cursor-pointer transition-colors" onClick={() => setIsRankDetailModalOpen(true)}>
                            Next Node: {progressInfo.nextRank} ({Math.round(progressInfo.percent)}%)
                          </span>
                        </div>
                        
                        {/* Interactive cyberpunk indicator groove bar */}
                        <div className="h-2 w-full bg-black/60 rounded-full border border-white/5 overflow-hidden p-[1px] relative">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progressInfo.percent}%` }}
                            transition={{ type: 'spring', damping: 20, stiffness: 80 }}
                            className="h-full rounded-full relative"
                            style={{ 
                              backgroundColor: rankInfo.color,
                              boxShadow: `0 0 12px ${rankInfo.color}`
                            }}
                          >
                            {/* Liquid glowing sheens */}
                            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent pointer-events-none" />
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-[14px] text-white/70 leading-relaxed font-medium lg:max-w-md">
                  {displayUser?.bio || "No bio yet."}
                </p>

                {/* Professional Creator Mode Toggle & Action Suite */}
                {isProfessionalAccount && isOwnProfile && (
                  <div className="p-4 rounded-3xl bg-gradient-to-r from-aeirmist-cyan/10 via-black/40 to-aeirmist-magenta/10 border border-white/5 space-y-4 lg:max-w-md w-full relative overflow-hidden shadow-2xl my-2">
                    {/* Switch Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Sparkles size={15} className="text-aeirmist-cyan animate-[pulse_1.5s_infinite]" />
                        <div>
                          <span className="text-[10px] font-black tracking-widest text-[#00f225] uppercase block leading-none mb-1">Creator Mode Console</span>
                          <p className="text-[8px] font-mono text-white/40 uppercase tracking-widest">
                            {displayUser?.creatorModeEnabled ? "Saved & Streaming" : "Standby Status"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={toggleCreatorMode}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                          displayUser?.creatorModeEnabled
                            ? 'bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta text-black shadow-[0_0_15px_rgba(0,242,255,0.4)]'
                            : 'bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {displayUser?.creatorModeEnabled ? 'ACTIVE: ON' : 'INACTIVE: OFF'}
                      </button>
                    </div>

                    {/* Quick Actions (only visible when Creator Mode is Enabled) */}
                    {displayUser?.creatorModeEnabled && (
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                        <button
                          onClick={() => {
                            setCreatorStudioInitialTab('analytics');
                            setCreatorStudioOpen(true);
                          }}
                          className="flex flex-col items-center justify-center p-3 bg-white/[0.02] hover:bg-aeirmist-cyan/10 border border-white/5 hover:border-aeirmist-cyan/30 rounded-xl transition-all group cursor-pointer"
                        >
                          <BarChart2 size={16} className="text-aeirmist-cyan group-hover:scale-110 transition-transform mb-1.5" />
                          <span className="text-[8px] font-black text-white/70 group-hover:text-white tracking-wider uppercase text-center font-sans">Video Analytics</span>
                        </button>

                        <button
                          onClick={() => {
                            setCreatorStudioInitialTab('overview');
                            setCreatorStudioOpen(true);
                          }}
                          className="flex flex-col items-center justify-center p-3 bg-white/[0.02] hover:bg-aeirmist-magenta/10 border border-white/5 hover:border-aeirmist-magenta/30 rounded-xl transition-all group cursor-pointer"
                        >
                          <Sliders size={16} className="text-aeirmist-magenta group-hover:scale-110 transition-transform mb-1.5" />
                          <span className="text-[8px] font-black text-white/70 group-hover:text-white tracking-wider uppercase text-center font-sans">Creator Studio</span>
                        </button>

                        <button
                          onClick={() => {
                            setCreatorStudioInitialTab('settings');
                            setCreatorStudioOpen(true);
                          }}
                          className="flex flex-col items-center justify-center p-3 bg-white/[0.02] hover:bg-yellow-500/10 border border-white/5 hover:border-yellow-500/30 rounded-xl transition-all group cursor-pointer"
                        >
                          <Briefcase size={16} className="text-yellow-500 group-hover:scale-110 transition-transform mb-1.5" />
                          <span className="text-[8px] font-black text-white/70 group-hover:text-white tracking-wider uppercase text-center font-sans">Business Tools</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* SOCIAL LINKS - Insta/FB Integration */}
                <div className="flex flex-wrap gap-4 pt-2 justify-center lg:justify-start">
                  {displayUser?.socialLinks?.instagram && (
                    <motion.a
                      whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 0, 234, 0.1)' }}
                      href={`https://instagram.com/${displayUser.socialLinks.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-aeirmist-magenta transition-all"
                    >
                      <Instagram size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Instagram</span>
                    </motion.a>
                  )}
                  {displayUser?.socialLinks?.facebook && (
                    <motion.a
                      whileHover={{ scale: 1.1, backgroundColor: 'rgba(24, 119, 242, 0.1)' }}
                      href={`https://facebook.com/${displayUser.socialLinks.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-blue-500 transition-all"
                    >
                      <Facebook size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Facebook</span>
                    </motion.a>
                  )}
                  {!displayUser?.socialLinks?.instagram && !displayUser?.socialLinks?.facebook && isOwnProfile && (
                     <div className="flex items-center gap-2 text-white/20">
                        <Link2 size={12} />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">No external links bound</span>
                     </div>
                  )}
                </div>
              </div>

              {/* STATS SECTION IMPROVEMENT: Glass Capsules */}
              <div className="flex gap-3 sm:gap-4 mb-5 w-full justify-center lg:justify-start overflow-x-auto pb-1.5">
                <GlassStat value={(posts || []).filter(p => p && !p.isArchived).length} label="POSTS" isLoading={loadingPosts} />
                <GlassStat 
                  value={Array.isArray(displayUser?.social?.followers) ? displayUser.social.followers.length : Math.max(0, displayUser?.followersCount || 0)} 
                  label="FOLLOWERS" 
                  onClick={() => !isLocked && handleShowFollowList('followers')} 
                  disabled={isLocked}
                  isProminent={displayUser?.creatorModeEnabled && isProfessionalAccount}
                  isLoading={isDataLoading}
                />
                <GlassStat 
                  value={Array.isArray(displayUser?.social?.following) ? displayUser.social.following.length : Math.max(0, displayUser?.followingCount || 0)} 
                  label="FOLLOWING" 
                  onClick={() => !isLocked && handleShowFollowList('following')} 
                  disabled={isLocked}
                  isLoading={isDataLoading}
                />
                
                {/* Floating Widget (Right side empty space filler) */}
                {!isOwnProfile && (
                  <div className="hidden lg:flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-cyan/20 transition-all cursor-default grow">
                    <Zap size={13} className="text-aeirmist-cyan animate-[pulse_2s_infinite]" />
                    <div>
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">Trust Rating</p>
                      <p className="text-[11px] font-black text-white">98.4% ALPHA</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Core Action Hub */}
              <div className="flex flex-wrap gap-3 w-full justify-center lg:justify-start">
                {!isLocked && mutualConnections.length > 0 && (
                   <div className="w-full flex items-center gap-3 mb-2 px-4 py-2 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <div className="flex -space-x-2">
                        {mutualConnections.map((m: any) => (
                           <img key={m.id} src={getAvatarUrl(m.photoURL)} alt="" className="w-6 h-6 rounded-lg border border-aeirmist-bg" />
                        ))}
                      </div>
                      <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">
                        Following by {mutualConnections[0]?.displayName} {mutualConnections.length > 1 ? `+ ${mutualConnections.length - 1} mutual connections` : 'and other nodes'}
                      </p>
                   </div>
                )}
                 {isOwnProfile ? (
                   <>
                     <motion.button 
                      whileHover={{ scale: 1.02, backgroundColor: '#fff', color: '#000' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsEditingBio(true)}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                     >
                      Edit Profile
                     </motion.button>
                     <motion.button 
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                      className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/30 hover:text-white transition-all"
                     >
                      <Settings size={15} />
                     </motion.button>
                     <motion.button 
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                      onClick={() => onMessageClick?.(displayUser)}
                      className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-aeirmist-cyan hover:text-white transition-all"
                      title="My Space"
                     >
                      <MessageSquare size={15} />
                     </motion.button>
                     <motion.button 
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                      onClick={handleShareProfile}
                      className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/30 hover:text-white transition-all"
                     >
                      <Share2 size={15} />
                     </motion.button>
                     <NGLButton isOwn onClick={() => setIsNGLDashboardOpen(true)} />
                   </>
                ) : (
                  <>
                    <motion.button 
                      whileHover={{ scale: 1.02, backgroundColor: isFollowingUser ? 'rgba(255,255,255,0.08)' : 'rgba(0,242,255,1)', color: isFollowingUser ? '#fff' : '#000' }}
                      whileTap={{ scale: 0.98 }}
                      onMouseEnter={() => setIsHoveringFollow(true)}
                      onMouseLeave={() => setIsHoveringFollow(false)}
                      onClick={() => toggleFollow(displayUser.id, displayUser)}
                      className={`flex-1 sm:flex-none px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl ${isFollowingUser ? 'bg-white/5 border border-white/10 text-white hover:border-red-500/30 hover:text-red-500' : 'bg-aeirmist-cyan text-black'}`}
                    >
                      {isPendingUser 
                        ? 'Requested' 
                        : isFollowingUser 
                          ? (isHoveringFollow ? 'Unfollow' : 'Following') 
                          : (isFollowerOfMe ? 'Follow Back' : 'Follow')}
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02, border: '1px solid rgba(255,255,255,0.2)' }}
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
                      className="grow sm:grow-0 px-5 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-white/70 hover:bg-white/[0.05] transition-all flex items-center justify-center gap-2"
                      title={isMessageLocked ? "Follow to message" : "Transmit direct message"}
                    >
                      <MessageSquare size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest font-mono">
                        {isMessageLocked ? "Follow To Message" : "Transmit"}
                      </span>
                    </motion.button>
                    {displayUser?.nglSettings?.enabled !== false && (
                      <NGLButton onClick={() => setIsNGLComposerOpen(true)} />
                    )}
                    
                    <div className="relative">
                      <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`p-2.5 rounded-xl transition-all ${isMenuOpen ? 'bg-aeirmist-magenta text-black' : 'bg-white/5 border border-white/10 text-white/30 hover:text-white'}`}
                      >
                        <MoreVertical size={15} />
                      </button>
                      
                      <AnimatePresence>
                        {isMenuOpen && (
                          <motion.div key="profile-menu-wrapper">
                            <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 10 }}
                              className="absolute right-0 mt-3 w-64 bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-3 z-50 shadow-3xl backdrop-blur-3xl"
                            >
                               <MenuAction icon={<Sparkles size={16} />} label="Add to Favorites" onClick={() => { toggleCloseFriend(displayUser.id); setIsMenuOpen(false); }} active={isFav} color={isFav ? "text-aeirmist-cyan" : ""} />
                               <div className="h-px bg-white/5 my-2" />
                               <MenuAction icon={<Link2 size={16} />} label="Copy Sequence ID" onClick={() => { handleShareProfile(); setIsMenuOpen(false); }} />
                               <MenuAction icon={<MinusCircle size={16} />} label="Mute" onClick={() => setIsMenuOpen(false)} />
                               <MenuAction icon={<Ghost size={16} color="#ff0040" />} label="Purge Node (Block)" onClick={() => { toggleBlockUser(displayUser.id); setIsMenuOpen(false); }} active={isBlockedUser} danger />
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
        </div> {/* End of hidden duplicate wrapper and inner segments */}
      </div>
      {/* End of Desktop-only Version Wrapper */}

        {/* Mobile Instagram-styled Profile Header View */}
        <div className="block lg:hidden mb-1 px-1">
          {/* Top Navigation Bar with Premium Layout */}
          <div className="flex items-center justify-between pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 px-4 border-b border-white/5 bg-[#01050a]/95 backdrop-blur-xl z-40 sticky top-0">
            {/* Left: Account Switcher if own profile */}
            <div className="flex items-center shrink-0 z-10 relative w-24">
              {isOwnProfile && (
                 <button 
                  onClick={() => setIsAccountSwitcherOpen(true)} 
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 active:scale-95 transition-all"
                 >
                   <span className="text-[10px] font-black tracking-widest text-white/60 uppercase">Node</span>
                   <ChevronDown size={10} className="text-white/30" />
                 </button>
              )}
            </div>
            
            {/* Mid/Branding: centered logo */}
            <div className="flex-1 flex items-center justify-center select-none pointer-events-none z-0 min-w-0 px-2">
              <AeirmistLogo variant="text-only" className="scale-[0.80] sm:scale-[0.90] shrink-0" glow={true} glowStrength="normal" />
            </div>
            
            {/* Actions on the Right - Dynamic Custom Layout */}
            <div className="flex items-center justify-end gap-1.5 shrink-0 z-10 relative w-24">
              {/* Creator Mode Mode Toggle (Button 1 of 2 highly requested) */}
              {isProfessionalAccount && isOwnProfile && (
                <button
                  onClick={toggleCreatorMode}
                  className={`p-2 rounded-xl transition-all duration-300 relative border flex items-center justify-center active:scale-90 cursor-pointer ${
                    displayUser?.creatorModeEnabled
                      ? 'bg-gradient-to-r from-aeirmist-cyan/20 to-aeirmist-magenta/20 border-aeirmist-cyan/50 text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.4)] animate-[pulse_2.5s_infinite]'
                      : 'bg-white/5 border-white/10 text-white/30'
                  }`}
                  title="Toggle Creator Mode"
                >
                  <Sparkles size={16} className={displayUser?.creatorModeEnabled ? 'animate-[spin_4s_linear_infinite]' : ''} />
                  {/* Small absolute indicator badge */}
                  <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-black ${displayUser?.creatorModeEnabled ? 'bg-green-400 shadow-[0_0_4px_#4ade80]' : 'bg-white/20'}`} />
                </button>
              )}

              {/* Creator Studio Suite Quick Launch (Button 2 of 2 highly requested) */}
              {isProfessionalAccount && isOwnProfile && displayUser?.creatorModeEnabled && (
                <button
                  onClick={() => {
                    setCreatorStudioInitialTab('overview');
                    setCreatorStudioOpen(true);
                  }}
                  className="p-2 bg-gradient-to-r from-aeirmist-cyan via-aeirmist-cyan to-aeirmist-magenta text-black rounded-xl cursor-pointer hover:opacity-95 active:scale-90 transition-all shadow-[0_0_12px_rgba(0,242,255,0.4)] flex items-center justify-center border border-aeirmist-cyan/20"
                  title="Launcher Creator Dashboard"
                >
                  <Sliders size={16} />
                </button>
              )}

              <button 
                onClick={onCreate}
                className="p-2 rounded-full text-white/70 hover:text-white transition-all active:scale-95 hover:bg-white/5"
              >
                <Plus size={20} />
              </button>
              <button 
                onClick={handleShareProfile}
                className="p-2 rounded-full text-white/70 hover:text-white transition-all active:scale-95 hover:bg-white/5"
              >
                <Share2 size={20} />
              </button>
              <button 
                onClick={() => onEditProfile?.()} 
                className="p-2 -mr-1 rounded-full text-white/70 hover:text-white transition-all active:scale-95 hover:bg-white/5"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* MOBILE COVER BANNER */}
            <div
              className="w-full h-24 rounded-t-2xl relative overflow-hidden bg-gradient-to-r from-slate-200 via-sky-100 to-indigo-100 dark:from-zinc-950 dark:via-[#120e2e] dark:to-black border-b border-slate-200/80 dark:border-white/5"
            >
              {isDataLoading ? (
                <Skeleton className="w-full h-full opacity-20" />
              ) : ((isOwnProfile && localCoverURL) || (displayUser?.coverURL && displayUser.coverURL.trim() !== "")) && (
                <img
                  src={(isOwnProfile && localCoverURL) ? localCoverURL : displayUser.coverURL}
                  alt="Cover"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="w-full h-full object-cover transition-opacity duration-300"
                  referrerPolicy="no-referrer"
                />
              )}

              {coverUploadProgress > 0 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-aeirmist-cyan"
                            animate={{ width: `${coverUploadProgress}%` }}
                        />
                    </div>
                </div>
              )}

              {isOwnProfile && !coverUploadProgress && (
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(file);
                    };
                    input.click();
                  }}
                  className="absolute right-2 bottom-2 p-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white/70 hover:text-white transition-all cursor-pointer"
                >
                  <Camera size={14} />
                </button>
              )}
            </div>

            {/* Horizontal DP & Stats Row */}
            <div className="flex items-center gap-6 justify-between px-4">
              {/* Square DP with custom Neon Glow Border and crisp elevated white frame in light mode */}
              <div className="relative group shrink-0">
                <div className="absolute inset-0 bg-gradient-to-tr from-aeirmist-cyan to-aeirmist-magenta rounded-2xl blur px-[1px] opacity-35 animate-pulse" />
                
                <div 
                  onClick={handleAvatarInteraction}
                  className="relative z-10 w-20 h-20 rounded-2xl overflow-hidden border-2 border-white dark:border-aeirmist-cyan ring-4 ring-white/95 dark:ring-transparent shadow-xl cursor-pointer bg-white dark:bg-[#050a0f] flex items-center justify-center p-0.5"
                >
                  <img 
                    src={(isOwnProfile && localAvatarURL) ? localAvatarURL : (getAvatarUrl(displayUser?.photoURL) || undefined)} 
                    alt={displayUser?.username} 
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    style={{ imageRendering: 'auto' }}
                    className="w-full h-full object-cover rounded-xl contrast-[1.02] brightness-[1.01] dark:contrast-100 dark:brightness-100"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getAvatarUrl(null);
                    }}
                  />
                  {isOwnProfile && profileUploadProgress > 0 && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-50">
                      <div className="w-8 h-1 bg-white/10 rounded-full overflow-hidden mb-1">
                         <motion.div 
                           animate={{ width: `${profileUploadProgress}%` }}
                           className="h-full bg-aeirmist-cyan shadow-[0_0_5px_rgba(0,242,255,0.8)]"
                         />
                      </div>
                      <span className="text-[7px] font-black uppercase text-aeirmist-cyan animate-pulse">Syncing: {Math.round(profileUploadProgress)}%</span>
                    </div>
                  )}
                  {isUpdating && !localAvatarURL && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
                      <Loader2 size={24} className="text-aeirmist-cyan animate-spin" />
                    </div>
                  )}
                </div>
                
                {/* Floating camera icon for own profile edit avatar */}
                {isOwnProfile && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAvatarInteraction();
                    }}
                    className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-black/80 backdrop-blur-xl border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan hover:text-white hover:border-aeirmist-cyan z-30 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                  >
                    <Camera size={12} />
                  </button>
                )}
              </div>

              {/* Stat Boxes aligned horizontally next to avatar - click switches lists if not locked */}
              <div className="flex flex-1 justify-around max-w-sm pl-2">
                <MobileStatItem value={(posts || []).filter(p => p && !p.isArchived).length} label="Posts" isLoading={loadingPosts} />
                <MobileStatItem 
                  value={Array.isArray(displayUser?.social?.followers) ? displayUser.social.followers.length : Math.max(0, displayUser?.followersCount || 0)} 
                  label="Followers" 
                  onClick={() => !isLocked && handleShowFollowList('followers')}
                  disabled={isLocked}
                  isProminent={displayUser?.creatorModeEnabled && isProfessionalAccount}
                  isLoading={isDataLoading}
                />
                <MobileStatItem 
                  value={Array.isArray(displayUser?.social?.following) ? displayUser.social.following.length : Math.max(0, displayUser?.followingCount || 0)} 
                  label="Following" 
                  onClick={() => !isLocked && handleShowFollowList('following')}
                  disabled={isLocked}
                  isLoading={isDataLoading}
                />
              </div>
            </div>

            {/* Display Name, Bio & External Links */}
            <div className="space-y-1.5 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] font-bold tracking-tight text-white">
                  {isDataLoading ? (
                    <Skeleton className="h-5 w-32 opacity-20" />
                  ) : (
                    displayUser?.displayName || 'User'
                  )}
                </h2>
                {isVerified && <ShieldCheck size={14} className="text-aeirmist-cyan shrink-0" />}
              </div>
              
              <p className="text-[10px] font-mono font-bold text-aeirmist-cyan tracking-widest leading-none pl-0.5 pb-0.5">
                @{displayUser?.username || "junaed"}
              </p>

              {/* Relationship Status Badge */}
              {(() => {
                const status = displayUser?.relationshipStatus;
                if (!status || status === 'Status') return null;
                const visibility = displayUser?.relationshipStatusVisibility || 'public';
                if (!isOwnProfile && visibility === 'only_me') return null;

                return (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan text-[11px] font-semibold my-1 shadow-sm backdrop-blur-sm">
                    <Heart size={12} className="text-aeirmist-cyan fill-aeirmist-cyan/30 shrink-0" />
                    <span className="tracking-wide">{status}</span>
                  </div>
                );
              })()}
              
              <p className="text-xs text-white/85 leading-relaxed font-normal whitespace-pre-line pl-0.5 pt-0.5">
                {displayUser?.bio || "No bio yet."}
              </p>

              {/* Mobile Aeirmist Core Sync Widget - Sleek Compact Version */}
              {!isCoreWidgetDismissed && (
                <div 
                  onClick={() => setIsRankDetailModalOpen(true)}
                  className="py-2.5 px-3 my-2 rounded-xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 relative overflow-hidden group/aeirmistmobile w-full flex items-center justify-between gap-2.5 cursor-pointer hover:bg-white/[0.05] active:scale-[0.98] transition-all"
                >
                  {/* Subtle background glow */}
                  <div 
                    className="absolute -right-12 -top-12 w-24 h-24 blur-2xl rounded-full opacity-20 pointer-events-none"
                    style={{ backgroundColor: rankInfo.color }}
                  />

                  <div className="relative z-10 flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="shrink-0 scale-90">
                      <AeirmistRankBadge score={displayUser?.aeirmistLevel || 0} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider text-white truncate group-hover/aeirmistmobile:text-aeirmist-cyan transition-colors">
                          {rankInfo.rank}
                        </span>
                        <span className="text-[8px] font-mono font-bold text-white/40 px-1 py-0.5 rounded bg-white/5 shrink-0">
                          {displayUser?.aeirmistLevel || 0} AP
                        </span>
                        <Info size={8} className="text-white/20 opacity-0 group-hover/aeirmistmobile:opacity-100 transition-opacity" />
                      </div>
                      {/* Compact Progress Line */}
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 flex-1 bg-black/60 rounded-full border border-white/5 overflow-hidden relative">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progressInfo.percent}%` }}
                            transition={{ type: 'spring', damping: 20, stiffness: 80 }}
                            className="h-full rounded-full"
                            style={{ 
                              backgroundColor: rankInfo.color,
                              boxShadow: `0 0 8px ${rankInfo.color}`
                            }}
                          />
                        </div>
                        <span className="text-[7.5px] font-mono font-bold text-white/50 shrink-0">
                          {progressInfo.percent.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 shrink-0 flex items-center gap-2">
                    <div className="flex flex-col items-end justify-center">
                      <span className="text-[7px] font-black uppercase text-white/30 tracking-widest block leading-none mb-1">Multiplier</span>
                      <span className="text-[9px] font-mono font-black py-0.5 px-1.5 rounded bg-white/5 border border-white/10 text-white/70" style={{ color: rankInfo.color }}>
                        {rankInfo.rank === CreatorTier.EXPLORER ? '1.0x' : rankInfo.rank === CreatorTier.CREATOR ? '1.2x' : rankInfo.rank === CreatorTier.VERIFIED_CREATOR ? '1.5x' : rankInfo.rank === CreatorTier.INFINITY_MEMBER ? '2.0x' : '3.0x'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDismissCoreWidget}
                      className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer z-20"
                      title="Hide widget"
                      aria-label="Hide widget"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Custom external links */}
              {(displayUser?.website || displayUser?.socialLinks?.website || displayUser?.socialLinks?.instagram || displayUser?.socialLinks?.facebook) ? (
                <div className="flex flex-wrap gap-2 pt-1 font-sans">
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-aeirmist-cyan hover:bg-white/10 transition-colors font-mono"
                    >
                      <Globe size={10} className="text-aeirmist-cyan" />
                      <span className="font-bold">{(displayUser?.website || displayUser?.socialLinks?.website).replace(/^https?:\/\/(www\.)?/, '')}</span>
                      <ExternalLink size={9} className="opacity-60" />
                    </a>
                  )}
                  {displayUser?.socialLinks?.instagram && (
                    <a 
                      href={`https://instagram.com/${displayUser.socialLinks.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/65 hover:text-aeirmist-magenta transition-colors"
                    >
                      <Instagram size={10} />
                      <span className="font-semibold">Instagram</span>
                    </a>
                  )}
                  {displayUser?.socialLinks?.facebook && (
                    <a 
                      href={`https://facebook.com/${displayUser.socialLinks.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/65 hover:text-blue-500 transition-colors"
                    >
                      <Facebook size={10} />
                      <span className="font-semibold">Facebook</span>
                    </a>
                  )}
                </div>
              ) : (
                isOwnProfile && (
                  <div className="text-[9px] text-white/20 flex items-center gap-1 uppercase tracking-wider pl-0.5 pt-1 font-sans">
                    <Link2 size={10} />
                    <span>No external links bound</span>
                  </div>
                )
              )}

              {isOwnProfile && (
                <div className="mt-3 px-1">
                  <ProfileCompletionCard displayUser={displayUser} postsCount={posts.length} />
                </div>
              )}

              {/* Mobile Creator Mode Toggle & Action Suite */}
              {isProfessionalAccount && isOwnProfile && (
                <div className="py-2.5 px-3 mt-3 rounded-2xl bg-gradient-to-r from-aeirmist-cyan/10 via-black/40 to-aeirmist-magenta/10 border border-white/5 space-y-2 w-full relative overflow-hidden shadow-xl font-sans">
                  {/* Switch Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-aeirmist-cyan animate-[pulse_1.5s_infinite]" />
                      <div>
                        <span className="text-[9px] font-black tracking-widest text-[#00f225] uppercase block leading-none mb-0.5">Creator Console</span>
                        <p className="text-[7.5px] font-mono text-white/45 uppercase tracking-wider">
                          {displayUser?.creatorModeEnabled ? "Saved" : "Standby"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleCreatorMode}
                      className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                        displayUser?.creatorModeEnabled
                          ? 'bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta text-black shadow-[0_0_10px_rgba(0,242,255,0.3)]'
                          : 'bg-white/5 border border-white/10 text-white/40'
                      }`}
                    >
                      {displayUser?.creatorModeEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Mobile Quick Action Buttons */}
                  {displayUser?.creatorModeEnabled && (
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/5">
                      <button
                        onClick={() => {
                          setCreatorStudioInitialTab('analytics');
                          setCreatorStudioOpen(true);
                        }}
                        className="flex flex-col items-center justify-center py-2 bg-white/[0.02] active:bg-aeirmist-cyan/10 border border-white/5 rounded-xl transition-all font-sans cursor-pointer"
                      >
                        <BarChart2 size={14} className="text-aeirmist-cyan mb-1" />
                        <span className="text-[7px] font-black text-white/70 tracking-wider uppercase text-center">Analytics</span>
                      </button>

                      <button
                        onClick={() => {
                          setCreatorStudioInitialTab('overview');
                          setCreatorStudioOpen(true);
                        }}
                        className="flex flex-col items-center justify-center py-2 bg-white/[0.02] active:bg-aeirmist-magenta/10 border border-white/5 rounded-xl transition-all font-sans cursor-pointer"
                      >
                        <Sliders size={14} className="text-aeirmist-magenta mb-1" />
                        <span className="text-[7px] font-black text-white/70 tracking-wider uppercase text-center">Studio</span>
                      </button>

                      <button
                        onClick={() => {
                          setCreatorStudioInitialTab('settings');
                          setCreatorStudioOpen(true);
                        }}
                        className="flex flex-col items-center justify-center py-2 bg-white/[0.02] active:bg-yellow-500/10 border border-white/5 rounded-xl transition-all font-sans cursor-pointer"
                      >
                        <Briefcase size={14} className="text-yellow-500 mb-1" />
                        <span className="text-[7px] font-black text-white/70 tracking-wider uppercase text-center">Tools</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Bar (Edit Profile & Story Archive for self, Follow/Transmit for foreign profiles) */}
            {isOwnProfile ? (
              <div className="flex items-center gap-2 w-full pt-1 px-4 font-sans">
                <button 
                  onClick={() => setIsEditingBio(true)}
                  className="flex-[4] py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center hover:bg-white/10"
                >
                  Edit Profile
                </button>
                <button 
                  onClick={() => setIsNGLDashboardOpen(true)}
                  className="flex-[3] py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 hover:bg-[#ffffff0c] hover:text-aeirmist-magenta"
                >
                  <Ghost size={14} className="text-aeirmist-magenta" />
                  <span>NGL</span>
                </button>

                <button 
                  onClick={() => setIsStoryArchiveOpen(true)}
                  className="aspect-square w-12 h-12 border rounded-2xl flex items-center justify-center transition-all bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white"
                >
                  <Archive size={16} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2 w-full pt-1 px-4 font-sans">
                <button 
                  onMouseEnter={() => setIsHoveringFollow(true)}
                  onMouseLeave={() => setIsHoveringFollow(false)}
                  onClick={() => toggleFollow(displayUser.id, displayUser)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black tracking-wider uppercase transition-all ${
                    isFollowingUser 
                      ? 'bg-white/5 border border-white/10 text-white hover:border-red-500/30 hover:text-red-500' 
                      : 'bg-aeirmist-cyan text-black shadow-[0_4px_12px_rgba(0,242,255,0.3)]'
                  }`}
                >
                  {isPendingUser 
                    ? 'Requested' 
                    : isFollowingUser 
                      ? (isHoveringFollow ? 'Unfollow' : 'Following') 
                      : (isFollowerOfMe ? 'Follow Back' : 'Follow')}
                </button>
                <button 
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
                  className="flex-1 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 hover:bg-white/10"
                  title={isMessageLocked ? "Follow to message" : "Transmit direct message"}
                >
                  <MessageSquare size={12} />
                  <span>{isMessageLocked ? "Follow To Message" : "Transmit"}</span>
                </button>
                {displayUser?.nglSettings?.enabled !== false && (
                  <button 
                    onClick={() => setIsNGLComposerOpen(true)}
                    className="flex-1 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1.5"
                  >
                    <Ghost size={12} className="text-aeirmist-magenta" />
                    <span>NGL</span>
                  </button>
                )}
              </div>
            )}

            {/* Stories & Highlights specifically for Mobile view */}
            {!isLocked && (
              <div className="pt-3.5 border-t border-white/5 space-y-2.5 px-4 font-sans">
                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] select-none">Signals & Highlights</h3>
                <div className="flex gap-4 overflow-x-auto pb-1.5 mask-fade-right scrollbar-hide -mx-4 px-4">
                  {isOwnProfile && (
                    <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
                      <button 
                        onClick={handleCreateHighlight}
                        className="w-14 h-14 rounded-2xl border border-dashed border-white/20 flex items-center justify-center text-white/30 hover:border-aeirmist-cyan hover:text-aeirmist-cyan transition-all bg-white/[0.01]"
                      >
                        <Plus size={20} />
                      </button>
                      <span className="text-[9px] font-bold text-white/30 tracking-wider">New</span>
                    </div>
                  )}
                  {highlights.map(h => {
                    const isEmpty = !h.stories || h.stories.length === 0;
                    return (
                      <div 
                        key={h.id} 
                        onClick={(e) => { e.stopPropagation(); handleHighlightClick(h); }} 
                        className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group animate-fade-in"
                      >
                        <div className={`relative w-14 h-14 rounded-2xl overflow-hidden p-[1px] bg-neutral-900 shadow-md border ${
                          isEmpty ? 'border-dashed border-red-500/40 bg-red-950/5' : 'border-white/10'
                        }`}>
                          {h.coverUrl ? (
                            <img src={h.coverUrl} className={`w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform ${isEmpty ? 'opacity-40 grayscale' : ''}`} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-red-400/50">
                              <span className="text-[8px] font-black uppercase">Empty</span>
                            </div>
                          )}
                          {isEmpty && (
                            <div className="absolute inset-0 bg-red-950/20 flex items-center justify-center">
                              <span className="text-[7px] font-black uppercase tracking-wider text-red-400">Empty</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-[9px] font-bold tracking-wider group-hover:text-aeirmist-cyan transition-colors truncate max-w-[64px] ${
                          isEmpty ? 'text-red-400/50' : 'text-white/40'
                        }`}>
                          {h.label}
                        </span>
                      </div>
                    );
                  })}
                  {loadingHighlights && highlights.length === 0 && Array(4).fill(0).map((_, i) => (
                    <div key={i} className="w-14 h-14 rounded-2xl bg-white/5 animate-pulse shrink-0" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Locked Profile Message */}
        {isLocked && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full lg:hidden flex flex-col items-center justify-center py-24 px-8 text-center bg-white/[0.01] border border-white/5 rounded-[3rem] mb-12"
          >
            <div className="w-20 h-20 rounded-full bg-aeirmist-cyan/10 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,242,255,0.1)]">
               <Lock size={32} className="text-aeirmist-cyan" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-[0.3em] text-white underline decoration-aeirmist-cyan decoration-4 underline-offset-8 mb-4">Profile Locked</h2>
            <div className="space-y-2">
              <p className="text-[12px] text-white/85 uppercase font-black tracking-widest leading-loose max-w-sm">
                This account is private. Follow to see photos, videos and stories.
              </p>
              <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest leading-loose max-w-sm">
                This node has activated high-Securitys. Approval required to view media.
              </p>
            </div>
            {mutualConnections.length > 0 && (
               <div className="mt-10 flex flex-col items-center gap-3">
                  <div className="flex -space-x-3">
                    {mutualConnections.map((m: any) => (
                       <img key={m.id} src={getAvatarUrl(m.photoURL)} alt="" className="w-10 h-10 rounded-xl border-2 border-aeirmist-bg shadow-xl" />
                    ))}
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-aeirmist-cyan">
                    Supported by {mutualConnections.length} verified connections
                  </p>
               </div>
            )}
          </motion.div>
        )}

        {/* Interface Navigation */}
        {!isLocked && (
          <div className="lg:hidden flex flex-col mt-6 sm:mt-8 mb-5 sticky top-0 bg-[#01050a]/80 backdrop-blur-xl z-30">
            {/* Subtle horizontal divider line directly above the tab bar row */}
            <div className="w-full h-px bg-white/[0.08]" />
            <div className="flex w-full border-b border-white/5">
              <TabButton active={activeTab === 'tagged'} onClick={() => setActiveTab('tagged')} icon={<Tag size={20} />} label="QUARTS" />
              <TabButton active={activeTab === 'posts'} onClick={() => setActiveTab('posts')} icon={<Grid size={20} />} label="PHOTOS" />
              <TabButton active={activeTab === 'videos'} onClick={() => setActiveTab('videos')} icon={<Video size={20} />} label="VIDEOS" />
              {isOwnProfile && (
                <TabButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} icon={<Bookmark size={20} />} label="SAVED" />
              )}
              {isOwnProfile && (
                <TabButton active={activeTab === 'archive'} onClick={() => setActiveTab('archive')} icon={<Archive size={20} />} label="ARCHIVE" />
              )}
              {isOwnProfile && (
                <TabButton active={activeTab === 'vault'} onClick={() => { setActiveTab('vault'); openVault(); }} icon={<Lock size={20} />} label="VAULT" />
              )}
            </div>
          </div>
        )}

        {/* NGL MODALS */}
        <AnimatePresence>
          {isNGLDashboardOpen && (
            <div className="fixed inset-0 z-[100] p-4 md:p-8 flex items-center justify-center">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setIsNGLDashboardOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md" 
              />
              <NGLDashboard profile={profile} onClose={() => setIsNGLDashboardOpen(false)} />
            </div>
          )}

          {isNGLComposerOpen && (
            <div className="fixed inset-0 z-[100] p-4 flex items-center justify-center">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setIsNGLComposerOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md" 
              />
              <NGLComposer targetProfile={displayUser} onClose={() => setIsNGLComposerOpen(false)} />
            </div>
          )}

          {/* QR Code Modal */}
          {isQRModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsQRModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative z-10 bg-[#080b12] border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 w-72 shadow-2xl">
                <button onClick={() => setIsQRModalOpen(false)} className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"><X size={14} /></button>
                <div className="text-xs font-black uppercase text-white tracking-widest">Profile QR Code</div>
                <div className="p-2 bg-white rounded-xl">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(displayUser?.username ? window.location.origin + '/@' + displayUser.username : window.location.href)}`} alt="Profile QR" className="w-48 h-48 rounded-lg" />
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-white/40">Scan to visit</p>
                  <p className="text-xs font-bold text-[#00f3ff]">@{displayUser?.username || 'profile'}</p>
                </div>
                <a href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(displayUser?.username ? window.location.origin + '/@' + displayUser.username : window.location.href)}`} download={`aeirmist-${displayUser?.username || 'profile'}-qr.png`} target="_blank" rel="noreferrer" className="w-full py-2 bg-[#00f3ff]/10 border border-[#00f3ff]/20 rounded-xl text-xs text-[#00f3ff] font-bold text-center hover:bg-[#00f3ff]/20 transition-all">⬇ Download QR</a>
              </motion.div>
            </div>
          )}

          {/* Creator Studio Dashboard Overlay */}

          {creatorStudioOpen && (
            <div className="fixed inset-0 z-[110] flex flex-col p-2 md:p-4 bg-[#01050a]/95 backdrop-blur-3xl overflow-y-auto">
              <div className="flex justify-end p-2 relative z-[120]">
                <button 
                  onClick={() => setCreatorStudioOpen(false)}
                  className="py-2.5 px-5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all active:scale-95 flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest cursor-pointer shadow-lg"
                >
                  <X size={14} className="text-aeirmist-cyan" />
                  <span>Exit Creator Hub</span>
                </button>
              </div>
              <div className="flex-1 w-full max-w-6xl mx-auto pt-2">
                <AeirmistCreatorStudio 
                  initialTab={creatorStudioInitialTab}
                  onClose={() => setCreatorStudioOpen(false)} 
                  onNavigateToVideo={(vid) => {
                    console.log("Navigate to video from profile creator studio:", vid);
                    setCreatorStudioOpen(false);
                  }} 
                />
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Content Grid */}
        <div className="lg:hidden grid grid-cols-3 gap-1 sm:gap-4 md:gap-6 px-0">
          {!isLocked && activeTab === 'posts' && (() => {
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
                               (post.mediaItems && post.mediaItems.some((item: any) => item?.type === 'image'));
              return hasImage && !isVideo;
            });
            return picturePosts.map(post => {
              if (!post) return null;
              return <PostCard key={post.id} post={post} onClick={() => onPostClick?.(post.id)} />;
            });
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
            if (videoPosts.length > 0) {
              return videoPosts.map(post => {
                if (!post) return null;
                return <PostCard key={post.id} post={post} onClick={() => onPostClick?.(post.id)} />;
              });
            } else {
              return (
                <div className="col-span-3 py-20 text-center opacity-20">
                  <Video size={48} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">No videos yet</p>
                </div>
              );
            }
          })()}

          {activeTab === 'archive' && isOwnProfile && (() => {
            const archivedPosts = (posts || []).filter(p => p && p.isArchived);
            if (archivedPosts.length > 0) {
              return archivedPosts.map(post => (
                <PostCard key={post.id} post={post} onClick={() => onPostClick?.(post.id)} />
              ));
            } else {
              return (
                <div className="col-span-3 py-20 text-center opacity-20">
                  <Archive size={48} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Archive Empty</p>
                </div>
              );
            }
          })()}

          {activeTab === 'saved' && (() => {
            if (!isOwnProfile) {
              return (
                <div className="col-span-3 py-20 text-center opacity-20 flex flex-col items-center">
                  <Lock size={48} className="mb-4 text-aeirmist-magenta" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Vault Restricted</p>
                  <p className="text-[8px] text-white/40 uppercase tracking-[0.2em] mt-2">Saved Messages are private</p>
                </div>
              );
            }
            
            if (loadingSavedPosts && (!savedPosts || savedPosts.length === 0)) {
              return Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-[1.5rem]" />
              ));
            }

            if (savedPosts && savedPosts.length > 0) {
              return savedPosts.map(post => (
                <PostCard key={post.id} post={post} onClick={() => onPostClick?.(post.id)} />
              ));
            } else {
              return (
                <div className="col-span-3 py-20 text-center opacity-20">
                  <Bookmark size={48} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Vault Empty</p>
                </div>
              );
            }
          })()}

           {activeTab === 'tagged' && (
             <div className="col-span-3 flex flex-col w-full max-w-2xl mx-auto">
               
               <div className="divide-y divide-white/5 border-t border-white/5">
                 {(() => {
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
                   
                   if (textOnlyPosts.length > 0) {
                     return textOnlyPosts.map(post => {
                        const isNgl = (post.content || '').toLowerCase().includes('ngl reply') || post.isNgl;
                        return (
                          <QuartCard 
                            key={post.id} 
                            post={{...post, isNgl}} 
                            onUserClick={(u) => {
                              // Handle mobile/general user click
                              // Navigate or set display user
                            }} 
                            onCommentClick={() => setSelectedPost(post)}
                          />
                        );
                     });
                   } else {
                     return (
                        <div className="py-20 text-center opacity-20">
                          <Tag size={48} className="mx-auto mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-[0.4em]">No quarts posts detected</p>
                          <p className="text-[8px] text-white/40 uppercase tracking-[0.2em] mt-2">Text-only and caption posts will sync here</p>
                        </div>
                     );
                   }
                 })()}
               </div>
             </div>
          )}



          {loadingPosts && posts.length === 0 && Array(9).fill(0).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-[1.5rem]" />
          ))}
        </div>

        {activeTab === 'posts' && !loadingPosts && (posts || []).filter(post => {
          if (!post) return false;
          const hasImage = (post.mediaUrls && post.mediaUrls.length > 0) || 
                           (post.mediaUrl) || 
                           (post.mediaURL) || 
                           (post.mediaItems && post.mediaItems.some((item: any) => item?.type === 'image'));
          const isVideo = post.mediaType === 'video' || 
                          (post.mediaItems && (Array.isArray(post.mediaItems) ? post.mediaItems.every((item: any) => item?.type === 'video') : false)) || 
                          (post.mediaUrl && post.mediaUrl.toString().endsWith('.mp4'));
          return hasImage && !isVideo;
        }).length === 0 && (
          <EmptyState 
            icon={<Camera size={24} />}
            title="No posts yet"
            description={isOwnProfile ? "Share photos, videos, or updates with your profile." : "This user hasn't published any posts yet."}
            actionLabel={isOwnProfile ? "Share your first post" : undefined}
            onAction={isOwnProfile ? onCreate : undefined}
          />
        )}
      </div>

      {/* Media Immersive Modal */}
      <AnimatePresence>
        {selectedPost && (
          <MediaViewer post={selectedPost} onClose={() => setSelectedPost(null)} />
        )}
      </AnimatePresence>

      {/* Identity Reset Modal */}
      <AnimatePresence>
        {selectedHighlight && (
          <StoryViewer 
            group={selectedHighlight}
            onClose={() => setSelectedHighlight(null)}
            groupsList={highlights}
            onGroupChange={(h) => setSelectedHighlight(h)}
            onEditHighlight={(h) => {
              setHighlightManagerState({ 
                mode: 'edit', 
                highlight: {
                  id: h.id,
                  label: h.label,
                  coverUrl: h.coverUrl || '',
                  stories: h.stories ? h.stories.map((s: any) => s.id) : []
                }
              });
            }}
          />
        )}
      </AnimatePresence>

      {/* Highlight Manager Modal */}
      {highlightManagerState && (
        <HighlightManagerModal
          mode={highlightManagerState.mode}
          existingHighlight={highlightManagerState.highlight}
          onClose={() => setHighlightManagerState(null)}
          onSaved={() => setHighlightManagerState(null)}
        />
      )}

      {/* Highlight Quick Action Sheet */}
      <AnimatePresence>
        {activeHighlightActionSheet && (
          <div className="fixed inset-0 z-[1100] flex items-end justify-center p-4 sm:items-center">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setActiveHighlightActionSheet(null)} 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: 100, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 100, opacity: 0 }} 
              className="relative w-full max-w-sm bg-[#090a0f] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 flex flex-col space-y-4 font-sans"
            >
              <div className="text-center pb-2">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Highlight Options</h4>
                <p className="text-sm font-bold text-white mt-1">"{activeHighlightActionSheet.label}"</p>
              </div>

              <button
                onClick={async () => {
                  const targetHighlight = activeHighlightActionSheet;
                  setActiveHighlightActionSheet(null);
                  await viewHighlightDirectly(targetHighlight);
                }}
                className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider transition-all border border-white/5 flex items-center justify-center gap-2"
              >
                <span>View Highlight</span>
              </button>

              <button
                onClick={() => {
                  const targetHighlight = activeHighlightActionSheet;
                  setActiveHighlightActionSheet(null);
                  setHighlightManagerState({
                    mode: 'edit',
                    highlight: {
                      id: targetHighlight.id,
                      label: targetHighlight.label,
                      coverUrl: targetHighlight.coverUrl || '',
                      stories: targetHighlight.stories || []
                    }
                  });
                }}
                className="w-full py-3.5 rounded-2xl bg-aeirmist-cyan hover:bg-opacity-90 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,242,255,0.3)] flex items-center justify-center gap-2"
              >
                <span>Edit Highlight</span>
              </button>

              <button
                onClick={() => setActiveHighlightActionSheet(null)}
                className="w-full py-3 text-white/40 hover:text-white/60 font-bold text-[10px] uppercase tracking-widest transition-all"
              >
                Dismiss
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingBio && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditingBio(false)} className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative z-10 w-full max-w-md max-h-[90vh] bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-6 sm:p-10 flex flex-col overflow-hidden shadow-2xl"
            >
               {/* Fixed Header */}
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta z-20" />
               
               {/* Scrollable Content Area */}
               <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-6 sm:space-y-8 mb-6 sm:mb-10 text-left">
                  {updateError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest text-center">
                      {updateError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block pl-2">Display Name</label>
                    <input 
                      type="text" 
                      value={tempDisplayName} 
                      onChange={(e) => setTempDisplayName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:border-aeirmist-cyan transition-all outline-none" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block pl-2">This Device Handle</label>
                    <input 
                      type="text" 
                      value={tempUsername} 
                      onChange={(e) => setTempUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-aeirmist-cyan focus:border-aeirmist-magenta transition-all outline-none" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block pl-2">Digital Manifesto (Bio)</label>
                    <textarea 
                      value={tempBio} 
                      onChange={(e) => setTempBio(e.target.value)}
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:border-aeirmist-cyan transition-all resize-none outline-none" 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block pl-2 flex items-center gap-2">
                        <Instagram size={12} className="text-aeirmist-magenta" /> Instagram
                      </label>
                      <input 
                        type="text" 
                        placeholder="Handle"
                        value={tempInstagram} 
                        onChange={(e) => setTempInstagram(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-[1.2rem] px-4 py-3 text-xs focus:border-aeirmist-magenta transition-all outline-none" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block pl-2 flex items-center gap-2">
                        <Facebook size={12} className="text-blue-500" /> Facebook
                      </label>
                      <input 
                        type="text" 
                        placeholder="ID / User"
                        value={tempFacebook} 
                        onChange={(e) => setTempFacebook(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-[1.2rem] px-4 py-3 text-xs focus:border-blue-500 transition-all outline-none" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block pl-2 flex items-center gap-2">
                        <Globe size={12} className="text-aeirmist-cyan" /> Website URL
                      </label>
                      <input 
                        type="url" 
                        placeholder="https://yourwebsite.com"
                        value={tempWebsite} 
                        onChange={(e) => setTempWebsite(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-[1.2rem] px-4 py-3 text-xs focus:border-aeirmist-cyan transition-all outline-none" 
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] mb-4">Privacy Settings</p>
                    
                    <PrivacyToggle 
                      icon={<Shield size={14} />} 
                      label="Private Account" 
                      sub="Approval required for mutual connection" 
                      active={isPrivate} 
                      onToggle={() => setIsPrivate(!isPrivate)} 
                    />
                    
                    <PrivacyToggle 
                      icon={<Lock size={14} />} 
                      label="Lock Profile" 
                      sub="Hide posts and lists from non-followers" 
                      active={isProfileLocked} 
                      onToggle={() => setIsProfileLocked(!isProfileLocked)} 
                      color="bg-aeirmist-magenta"
                    />

                    <PrivacyToggle 
                      icon={<MessageSquare size={14} />} 
                      label="Accept Message Messages" 
                      sub="Allow direct messages" 
                      active={allowMessages} 
                      onToggle={() => setAllowMessages(!allowMessages)} 
                    />

                    <PrivacyToggle 
                      icon={<Radio size={14} />} 
                      label="Allow Voice/Video Calls" 
                      sub="Requires verified mutual connection" 
                      active={allowCalls} 
                      onToggle={() => setAllowCalls(!allowCalls)} 
                    />
                  </div>
               </div>

               {/* Fixed Footer */}
               <div className="flex gap-4 shrink-0">
                  <button onClick={() => setIsEditingBio(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-2xl hover:bg-white/5 transition-all">Discard</button>
                  <button onClick={handleUpdateIdentity} disabled={isUpdating} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest bg-aeirmist-cyan text-black rounded-2xl shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:brightness-110 active:scale-95 transition-all">
                    {isUpdating ? 'SAVING...' : 'SAVE CHANGES'}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Follow List Modal (Instagram Style) */}
      <AnimatePresence>
        {followListType && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => { setFollowListType(null); setFollowListSearchFilter(''); }} 
              className="absolute inset-0 bg-black/85 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 15 }} 
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative z-10 w-full max-w-md max-h-[85vh] bg-[#121214] border border-white/10 rounded-[2rem] flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
            >
              {/* Header with Close and Tabs */}
              <div className="p-5 pb-3 shrink-0 border-b border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {displayUser?.displayName || displayUser?.username || 'Connections'}
                  </h3>
                  <button 
                    onClick={() => { setFollowListType(null); setFollowListSearchFilter(''); }} 
                    className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tab Switcher: Followers vs Following */}
                <div className="flex items-center gap-2 p-1 bg-white/[0.04] rounded-xl border border-white/5">
                  <button
                    onClick={() => handleShowFollowList('followers')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      followListType === 'followers'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    Followers ({Array.isArray(displayUser?.social?.followers) ? displayUser.social.followers.length : (displayUser?.followersCount || 0)})
                  </button>
                  <button
                    onClick={() => handleShowFollowList('following')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      followListType === 'following'
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    Following ({Array.isArray(displayUser?.social?.following) ? displayUser.social.following.length : (displayUser?.followingCount || 0)})
                  </button>
                </div>
              </div>

              {/* Search Filter Bar */}
              <div className="px-5 py-3 shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    value={followListSearchFilter} 
                    onChange={(e) => setFollowListSearchFilter(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-aeirmist-cyan transition-all font-sans"
                  />
                  {followListSearchFilter && (
                    <button 
                      onClick={() => setFollowListSearchFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
              
              {/* User List */}
              <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2.5 scrollbar-hide">
                {loadingFollowList ? (
                   <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
                      <Loader2 className="animate-spin text-aeirmist-cyan" size={24} />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Loading list...</span>
                   </div>
                ) : (() => {
                  const filtered = followListData.filter(p => 
                    !followListSearchFilter.trim() || 
                    p.username?.toLowerCase().includes(followListSearchFilter.toLowerCase()) || 
                    p.displayName?.toLowerCase().includes(followListSearchFilter.toLowerCase())
                  );
                  return filtered.length > 0 ? (
                    filtered.map(p => {
                      const isSelf = p.id === profile?.id;
                      const isFollowingUser = checkIsFollowing(p.id);
                      const isPending = isFollowPending(p.id);

                      return (
                        <div 
                          key={p.id} 
                          className="flex items-center gap-3 p-2.5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer group"
                          onClick={() => {
                            onUserClick?.(p);
                            setFollowListType(null);
                            setFollowListSearchFilter('');
                          }}
                        >
                           <div className="w-11 h-11 rounded-full border border-white/10 overflow-hidden shrink-0 p-0.5">
                              <img src={getAvatarUrl(p.photoURL)} className="w-full h-full object-cover rounded-full" alt="" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white flex items-center gap-1 truncate">
                                {p.displayName || p.username}
                                {p.isVerified && <ShieldCheck size={12} className="text-aeirmist-cyan shrink-0" />}
                              </p>
                              <p className="text-[10px] text-white/40 font-medium truncate">
                                @{p.username && p.username !== 'user' && p.username !== 'null'
                                  ? p.username.replace(/^@+/, '')
                                  : (p.displayName && p.displayName.toLowerCase() !== 'user'
                                      ? p.displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                                      : (p.id ? `user_${p.id.slice(0, 6)}` : 'member'))}
                              </p>
                           </div>

                           {/* Action Buttons */}
                           <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                             {isOwnProfile && followListType === 'followers' ? (
                               <button 
                                 onClick={() => handleRemoveFollower(p.id)}
                                 className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-red-500/20 hover:border-red-500/40 text-xs font-bold text-white/80 hover:text-red-400 border border-white/10 transition-all cursor-pointer"
                               >
                                 Remove
                               </button>
                             ) : isSelf ? (
                               <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider px-2">You</span>
                             ) : isFollowingUser ? (
                               <button 
                                 onClick={() => toggleFollow(p.id, p)}
                                 className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition-all cursor-pointer"
                               >
                                 Following
                               </button>
                             ) : isPending ? (
                               <button 
                                 onClick={() => toggleFollow(p.id, p)}
                                 className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/50 border border-white/5 transition-all cursor-pointer"
                               >
                                 Requested
                               </button>
                             ) : (
                               <button 
                                 onClick={() => toggleFollow(p.id, p)}
                                 className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-aeirmist-cyan to-blue-500 text-black text-xs font-bold shadow-[0_0_15px_rgba(0,204,255,0.25)] hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                               >
                                 Follow
                               </button>
                             )}
                           </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                      <Ghost size={36} className="mb-2 text-white/40" />
                      <span className="text-xs font-bold text-white/60">
                        {followListSearchFilter ? 'No users found' : `No ${followListType} yet`}
                      </span>
                    </div>
                  );
                })()}
              </div>
              
              <div className="p-3 border-t border-white/5 shrink-0">
                <button 
                  onClick={() => { setFollowListType(null); setFollowListSearchFilter(''); }} 
                  className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-white/40 hover:text-white transition-all rounded-xl hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mutual Connections Modal */}
      <AnimatePresence>
        {isMutualModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMutualModalOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative z-10 w-full max-w-sm max-h-[85vh] bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-6 flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-aeirmist-cyan" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">Mutual Connections</h3>
                </div>
                <button onClick={() => setIsMutualModalOpen(false)} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-hide">
                {mutualConnections.length > 0 ? (
                  mutualConnections.map(m => (
                    <div 
                      key={m.id} 
                      className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-aeirmist-cyan/30 transition-all cursor-pointer"
                      onClick={() => {
                        onUserClick?.(m);
                        setIsMutualModalOpen(false);
                      }}
                    >
                       <div className="w-10 h-10 rounded-xl border border-white/10 p-0.5 overflow-hidden shrink-0">
                          <img src={getAvatarUrl(m.photoURL)} className="w-full h-full object-cover rounded-[0.5rem]" alt="" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-xs font-black truncate">@{m.username}</p>
                          <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider truncate">{m.displayName}</p>
                       </div>
                       {m.isVerified && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 opacity-30">
                    <Users size={40} className="mb-3" />
                    <span className="text-[8px] font-black uppercase tracking-widest">No Mutual Connections</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Note Creation Modal */}
      <AnimatePresence>
        {isNoteModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsNoteModalOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative z-10 w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-6 flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">Profile Status Note</h3>
                <button onClick={() => setIsNoteModalOpen(false)} className="p-1 text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <p className="text-[10px] text-white/40 mb-3 font-sans">Share a short status message (up to 60 characters) visible on your profile badge for 24 hours.</p>

              <div className="relative mb-4">
                <input 
                  type="text"
                  maxLength={60}
                  placeholder="Share what's on your mind..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white placeholder-white/30 focus:border-aeirmist-cyan outline-none transition-all font-sans"
                />
                <span className="absolute right-3.5 bottom-3.5 text-[9px] font-mono text-white/30">{noteInput.length}/60</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setIsNoteModalOpen(false)} className="flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white bg-white/5 rounded-xl transition-all">Cancel</button>
                <button 
                  onClick={async () => {
                    if (!db || !user || !noteInput.trim()) return;
                    setIsUpdating(true);
                    try {
                      await addDoc(collection(db, 'notes'), {
                        authorId: user.uid,
                        authorName: displayUser?.displayName || 'User',
                        authorUsername: displayUser?.username || 'user',
                        authorAvatar: displayUser?.photoURL || '',
                        content: noteInput.trim().slice(0, 60),
                        createdAt: serverTimestamp()
                      });
                      addToast?.({ title: 'NOTE SHARED', message: 'Profile note updated.', type: 'success' });
                      setNoteInput('');
                      setIsNoteModalOpen(false);
                    } catch (e) {
                      console.error("Failed to post note", e);
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                  disabled={!noteInput.trim() || isUpdating}
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-wider bg-aeirmist-cyan text-black rounded-xl hover:brightness-110 disabled:opacity-30 transition-all"
                >
                  {isUpdating ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isStoryArchiveOpen && (
          <StoryArchiveModal 
            isOpen={isStoryArchiveOpen} 
            onClose={() => setIsStoryArchiveOpen(false)} 
            user={user} 
            db={db} 
          />
        )}
      </AnimatePresence>

      {/* Rank spectrum list modal */}
      <AeirmistRankGuide 
        isOpen={isRankDetailModalOpen}
        onClose={() => setIsRankDetailModalOpen(false)}
        currentPoints={displayUser?.aeirmistLevel || 0}
        currentRank={rankInfo.rank}
      />

      <AccountSwitcher 
        isOpen={isAccountSwitcherOpen} 
        onClose={() => setIsAccountSwitcherOpen(false)} 
        onAddAccount={() => {
          setIsAccountSwitcherOpen(false);
          onEditProfile?.();
        }}
      />
    </div>
  );
};

const GlassStat = ({ value, label, onClick, disabled, isProminent, isLoading }: { value: number, label: string, onClick?: () => void, disabled?: boolean, isProminent?: boolean, isLoading?: boolean }) => (
  <motion.div 
    whileHover={!disabled && !isLoading ? { y: -4, backgroundColor: isProminent ? 'rgba(0,242,255,0.08)' : 'rgba(255,255,255,0.06)' } : {}}
    onClick={!disabled && !isLoading ? onClick : undefined}
    className={`flex flex-col items-center min-w-[95px] px-4 py-3 rounded-2xl border transition-all ${
      isProminent 
        ? 'bg-gradient-to-b from-aeirmist-cyan/15 to-transparent border-aeirmist-cyan/40 shadow-[0_0_15px_rgba(0,242,255,0.15)] scale-105' 
        : 'bg-white/[0.03] border-white/5'
    } ${(onClick && !disabled && !isLoading) ? 'cursor-pointer active:scale-95' : 'cursor-default'} ${disabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}
  >
    {isLoading ? (
      <Skeleton className="h-6 w-12 mb-1" />
    ) : (
      <span className={`text-xl font-black transition-colors ${
        isProminent 
          ? 'text-aeirmist-cyan drop-shadow-[0_0_12px_rgba(0,242,255,0.3)] font-mono text-2xl' 
          : 'text-white group-hover:text-aeirmist-cyan drop-shadow-[0_0_8px_rgba(0,242,255,0.2)]'
      }`}>
        {value.toLocaleString()}
      </span>
    )}
    <span className={`text-[8px] font-black tracking-[0.3em] transition-colors uppercase pt-1 ${
      isProminent ? 'text-aeirmist-cyan/70 font-mono' : 'text-white/20 group-hover:text-white/40'
    }`}>
      {label}
    </span>
  </motion.div>
);

const MobileStatItem = ({ value, label, onClick, disabled, isProminent, isLoading }: { value: number, label: string, onClick?: () => void, disabled?: boolean, isProminent?: boolean, isLoading?: boolean }) => (
  <div 
    onClick={(!disabled && !isLoading) ? onClick : undefined}
    className={`flex flex-col items-center flex-1 transition-all py-1 px-2 rounded-xl ${
      isProminent 
        ? 'bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 shadow-[0_0_10px_rgba(0,242,255,0.1)] scale-105' 
        : ''
    } ${(onClick && !disabled && !isLoading) ? 'cursor-pointer active:scale-95' : 'cursor-default'} ${disabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}
  >
    {isLoading ? (
      <Skeleton className="h-5 w-8 mb-1 opacity-20" />
    ) : (
      <span className={`transition-colors font-black ${
        isProminent ? 'text-aeirmist-cyan text-lg font-mono drop-shadow-[0_0_8px_rgba(0,242,255,0.2)]' : 'text-base text-white hover:text-aeirmist-cyan'
      }`}>
        {value.toLocaleString()}
      </span>
    )}
    <span className={`transition-colors ${
      isProminent ? 'text-aeirmist-cyan/80 font-bold uppercase text-[8px] tracking-widest' : 'text-white/40 text-[10px] mobile-label'
    }`}>
      {label}
    </span>
  </div>
);

const MenuAction = ({ icon, label, onClick, danger, active, color }: { icon: any, label: string, onClick: () => void, danger?: boolean, active?: boolean, color?: string }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${danger ? 'text-red-500 hover:bg-red-500/10' : active ? 'text-aeirmist-cyan bg-aeirmist-cyan/10' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
  >
    <div className={color}>{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest text-left">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,1)]" />}
  </button>
);

const PrivacyToggle = ({ icon, label, sub, active, onToggle, color = "bg-aeirmist-cyan" }: { icon: React.ReactNode, label: string, sub: string, active: boolean, onToggle: () => void, color?: string }) => (
  <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/10 rounded-2xl group hover:bg-white/[0.05] transition-all">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${active ? `${color}/20 text-white` : 'bg-white/5 text-white/20'}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/80">{label}</p>
        <p className="text-[8px] text-white/30 uppercase tracking-tighter">{sub}</p>
      </div>
    </div>
    <button 
      onClick={onToggle}
      className={`w-10 h-5 rounded-full relative transition-all ${active ? color : 'bg-white/10'}`}
    >
      <motion.div 
        animate={{ x: active ? 22 : 2 }}
        className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-lg"
      />
    </button>
  </div>
);


const HighlightItem = ({ h }: { h: any }) => (
  <div className="flex flex-col items-center gap-5 shrink-0 group cursor-pointer">
    <div className="relative p-1 transition-all duration-700">
      {/* STORY/HIGHLIGHT RING: Animated holographic glow */}
      <div className="absolute inset-[-10%] border border-aeirmist-cyan/30 rounded-2xl animate-[spin_10s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute inset-[-5%] border border-white/5 rounded-2xl" />
      
      <div className="relative z-10 w-16 h-16 sm:w-22 sm:h-22 rounded-2xl overflow-hidden border-[3px] border-white dark:border-[#01050a] bg-slate-100 dark:bg-black ring-2 ring-slate-200 dark:ring-white/5 group-hover:ring-aeirmist-cyan/50 transition-all duration-500 shadow-xl">
        <img src={h.coverUrl || undefined} className="w-full h-full object-cover grayscale-[0.6] group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-125" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
    <span className="text-[9px] font-black uppercase text-slate-500 dark:text-white/30 group-hover:text-aeirmist-cyan tracking-[0.3em] font-display transition-colors duration-500">
      {h.label}
    </span>
  </div>
);

const TabButton = ({ active, icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex-1 py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 relative transition-all duration-500 ${active ? 'text-aeirmist-cyan' : 'text-white/20 hover:text-white/60'}`}
  >
    <div className="scale-85 sm:scale-100">{icon}</div>
    <span className="hidden lg:block text-[10px] font-black uppercase tracking-[0.3em] font-display">{label}</span>
    {active && (
      <motion.div 
        layoutId="profile-tab-line-premium" 
        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.85)]"
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    )}
  </button>
);

const PostCard = ({ post, onClick }: { post: any, onClick: () => void }) => {
  if (!post) return null;
  const hasMedia = (post.mediaUrls && post.mediaUrls.length > 0) || post.mediaURL || post.mediaUrl;
  
  // Detect if post is a video
  const isVideoPost = post.mediaType === 'video' || 
    (post.mediaItems && post.mediaItems.some((item: any) => item?.type === 'video')) ||
    (post.mediaUrl && post.mediaUrl.toString().toLowerCase().includes('.mp4')) ||
    (post.mediaURL && post.mediaURL.toString().toLowerCase().includes('.mp4')) ||
    (post.mediaUrls && post.mediaUrls.some((u: string) => u?.toString().toLowerCase().includes('.mp4') || u?.toString().toLowerCase().includes('video')));

  const type = (post.mediaUrls?.length || 0) > 1 ? 'collage' : ((post.mediaURL || post.mediaUrl) ? 'photo' : 'text');
  usePostAnalytics({ postId: post.id, type });

  // Get the best thumbnail for video posts
  const videoThumbnail = post.thumbnailUrl || post.thumbnailURL || post.videoThumbnail || post.coverUrl || post.coverURL || null;

  const renderMediaItem = (url: string, className: string, key?: number) => {
    const isVideoUrl = url?.toString().toLowerCase().includes('.mp4') || url?.toString().toLowerCase().includes('video');
    
    if (isVideoUrl) {
      if (videoThumbnail) {
        return <img key={key} src={videoThumbnail} className={className} alt="" referrerPolicy="no-referrer" />;
      }
      return <video key={key} src={`${url}#t=0.5`} className={className} muted preload="metadata" playsInline />;
    }
    return <img key={key} src={url} className={className} alt="" referrerPolicy="no-referrer" />;
  };

  const renderCollage = () => {
    const urls = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : (post.mediaURL || post.mediaUrl ? [post.mediaURL || post.mediaUrl] : []);
    if (urls.length === 0) return null;

    const itemClass = "w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110";
    const itemClassSmall = "w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105";

    if (urls.length === 1) {
      return renderMediaItem(urls[0], itemClass);
    }

    if (urls.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-0.5 w-full h-full">
          {urls.slice(0, 2).map((url: string, i: number) => renderMediaItem(url, itemClassSmall, i))}
        </div>
      );
    }

    if (urls.length === 3) {
      return (
        <div className="grid grid-rows-[1.2fr_1fr] gap-0.5 w-full h-full">
          <div className="w-full h-full overflow-hidden">
            {renderMediaItem(urls[0], itemClassSmall)}
          </div>
          <div className="grid grid-cols-2 gap-0.5 w-full h-full overflow-hidden">
            {urls.slice(1, 3).map((url: string, i: number) => renderMediaItem(url, itemClassSmall, i))}
          </div>
        </div>
      );
    }

    // 4 or more files: collage grid layout (2x2 grid)
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full relative">
        {urls.slice(0, 4).map((url: string, i: number) => (
          <div key={i} className="relative w-full h-full overflow-hidden">
            {renderMediaItem(url, itemClassSmall, i)}
            {i === 3 && urls.length > 4 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                <span className="text-white text-xs sm:text-sm font-black text-center">+{urls.length - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <motion.div 
      id={`post-${post.id}`}
      whileHover={{ y: -8, scale: 1.02 }}
      onClick={onClick}
      className="aspect-square relative group rounded-md sm:rounded-xl md:rounded-2xl lg:rounded-[1.8rem] overflow-hidden bg-[#050a0f] border border-white/5 cursor-pointer shadow-2xl transition-all duration-500"
    >
      
      {hasMedia ? (
        renderCollage()
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#0c1524] via-[#050912] to-[#12091f] p-4 sm:p-5 flex flex-col justify-between items-start text-left border border-white/5 relative">
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          <div className="absolute top-0 right-0 w-16 h-16 bg-aeirmist-cyan/5 blur-xl rounded-full" />
          <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] text-aeirmist-cyan font-mono relative z-10">BEAM</p>
          <p className="text-[10px] sm:text-xs font-semibold tracking-tight text-white/80 line-clamp-4 relative z-10 leading-relaxed font-sans">{post.content}</p>
          <div className="w-full border-t border-white/5 pt-1.5 flex justify-between items-center text-[7px] sm:text-[8px] tracking-widest uppercase font-mono text-white/30 relative z-10">
            <span>Connections</span>
            <span className="text-aeirmist-cyan font-bold">Shared</span>
          </div>
        </div>
      )}

      {/* Video Play Icon Overlay */}
      {isVideoPost && hasMedia && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
          <Play size={12} className="text-white fill-white" />
          <span className="text-[9px] font-bold text-white uppercase tracking-wider">Video</span>
        </div>
      )}

      {/* Minimalist Stat Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700 flex items-center justify-center gap-6 backdrop-blur-[2px]">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-aeirmist-cyan" />
          <span className="text-xs font-black">{post.aeirmistCount || post.likesCount || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-[#ff00a0]" />
          <span className="text-xs font-black">{post.commentsCount || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-white/40" />
          <span className="text-xs font-black">{(post.viewsCount || 0).toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
};

const MediaViewer = ({ post, onClose }: { post: any, onClose: () => void }) => {
  const { openReportModal } = useReport();
  const { 
    db, 
    profile, 
    toggleLike, 
    toggleBookmark, 
    earnPoints, 
    addToast, 
    createNotification,
    deletePost,
    archivePost
  } = useAeirmist();

  const [livePost, setLivePost] = useState(post);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [liveComments, setLiveComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  // Manual view tracking for modal opening
  useEffect(() => {
    if (post.id) {
      const type = (post.mediaUrls?.length || 0) > 1 ? 'collage' : ((post.mediaURL || post.mediaUrl) ? 'photo' : 'text');
      postAnalytics.trackView(post.id, { source: 'profile', type });
    }
  }, [post.id]);

  // Sync post stats in real time
  useEffect(() => {
    if (!db || !post.id) return;
    const unsub = onSnapshot(doc(db, 'posts', post.id), (snap) => {
      if (snap.exists()) {
        setLivePost({ id: snap.id, ...snap.data() });
      }
    });
    return () => unsub();
  }, [db, post.id]);

  // Load live comments
  useEffect(() => {
    if (!db || !post.id) return;
    const commentsRef = collection(db, 'posts', post.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLiveComments(docs);
    });
    return () => unsub();
  }, [db, post.id]);

  // Format timestamp safely
  const formatCommentTime = (createdAt: any) => {
    return formatAeirmistTimestamp(createdAt);
  };

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
              isLarge ? 'text-sm sm:text-base font-black' : 'text-xs sm:text-sm font-black'
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
              isLarge ? 'text-sm sm:text-base font-black' : 'text-xs sm:text-sm font-black'
            }`}
          >
            {word}
          </span>
        );
      }
      return <span key={i}>{word}</span>;
    });
  };

  const isLiked = livePost.likedBy?.includes(profile?.id) || false;
  const isBookmarked = livePost.savedBy?.includes(profile?.id) || false;

  const handleLike = async () => {
    if (!profile) return;
    try {
      await toggleLike(post.id, isLiked);
      if (!isLiked && earnPoints) {
        await earnPoints(5);
      }
    } catch (e) {
      console.error("Like toggle failed:", e);
    }
  };

  const handleBookmark = async () => {
    if (!profile) return;
    try {
      await toggleBookmark(post.id, isBookmarked);
    } catch (e) {
      console.error("Bookmark toggle failed:", e);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !profile || !commentText.trim() || submittingComment) return;
    const txt = commentText.trim();
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
        parentId: null,
        createdAt: serverTimestamp()
      });

      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });

      // Notify post author (unless self)
      const postAuthorId = livePost.userId || livePost.authorId;
      if (postAuthorId && postAuthorId !== profile.id && createNotification) {
        await createNotification(
          postAuthorId,
          'comment',
          `${profile.displayName || profile.username} commented on your post.`,
          { postId: post.id }
        );
      }

      // Handle custom mentions scan
      const mentionRegex = /@([a-zA-Z0-9_\-]+)/g;
      let match;
      const usernames: string[] = [];
      while ((match = mentionRegex.exec(txt)) !== null) {
        usernames.push(match[1]);
      }
      for (const username of usernames) {
        if (username.toLowerCase() === profile.username?.toLowerCase()) continue;
        try {
          const q = query(collection(db, 'profiles'), where('username', '==', username.toLowerCase()));
          const snap = await getDocs(q); // wait, let's load getDocs recursively or import query safely
          // Or can fallback to custom lookup
        } catch (e) {
          console.error(e);
        }
      }

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
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

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
      }
      await updateDoc(commentDocRef, { likedBy: newLikedBy });
    } catch (err) {
      console.error("Like comment failed:", err);
    }
  };

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
          title: 'WAVE COLLAPSED',
          message: 'Comment has been successfully purged from the stream.',
          type: 'success'
        });
      }
    } catch (e) {
      console.error("Delete comment failed:", e);
    }
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.origin + `/post/${post.id}`);
      if (addToast) {
        addToast({
          title: 'LINK COPIED',
          message: 'Link copied to clipboard.',
          type: 'success'
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isVideo = livePost.mediaType === 'video' || 
                  (livePost.mediaItems && livePost.mediaItems.some((item: any) => item.type === 'video')) ||
                  (livePost.mediaUrls && livePost.mediaUrls.some((url: string) => url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('video'))) ||
                  (livePost.mediaUrl && livePost.mediaUrl.endsWith('.mp4'));

  const hasImage = (livePost.mediaUrls && livePost.mediaUrls.length > 0) || 
                   livePost.mediaUrl || 
                   livePost.mediaURL || 
                   (livePost.mediaItems && livePost.mediaItems.some((item: any) => item.type === 'image'));

  const mediaSrc = livePost.mediaUrls?.[0] || livePost.mediaUrl || livePost.mediaURL;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-12 lg:p-20">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/98 backdrop-blur-[100px]" />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 50 }}
        className="relative z-10 w-full max-w-[1400px] h-full max-h-[95vh] flex flex-col md:flex-row bg-[#02050a]/80 border border-white/5 rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)]"
      >
        {/* Media Content */}
        <div className="flex-[2.2] bg-black flex items-center justify-center relative group overflow-hidden border-r border-white/5 min-h-[40vh] md:min-h-0">
          {isVideo ? (
            <video 
              src={mediaSrc} 
              controls 
              autoPlay 
              loop
              className="max-w-full max-h-full object-contain p-4"
            />
          ) : hasImage ? (
            <img src={mediaSrc} className="max-w-full max-h-full object-contain p-4 animate-fade-in" alt="" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0c1524] via-[#050912] to-[#12091f] p-8 sm:p-16 flex flex-col justify-center items-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,242,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(0,242,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-aeirmist-cyan/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />
              
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-2xl relative z-10 px-8 py-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl"
              >
                <div className="absolute -top-7 -left-4 text-7xl sm:text-8xl font-serif text-aeirmist-cyan/10 pointer-events-none select-none">“</div>
                <p className="text-sm sm:text-lg md:text-xl font-bold text-white leading-relaxed tracking-wide select-text">
                  {renderParsedContent(livePost.content, true)}
                </p>
                <div className="absolute -bottom-16 -right-4 text-7xl sm:text-8xl font-serif text-aeirmist-magenta/10 pointer-events-none select-none">”</div>
              </motion.div>
            </div>
          )}
          
          {/* Floating Controls */}
          <div className="absolute top-8 right-8 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
             <button onClick={handleCopyLink} className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-3xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white">
                <Share2 size={20} />
             </button>
             <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center hover:bg-aeirmist-cyan transition-all">
                <Plus className="rotate-45" size={24} />
             </button>
          </div>
        </div>

      {/* Sidebar Details */}
      <div className="flex-1 flex flex-col bg-[#01050a] md:min-w-[420px] w-full overflow-hidden h-[60vh] md:h-auto">
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl border-2 border-aeirmist-cyan/30 p-0.5 shadow-lg shadow-aeirmist-cyan/5">
                <img src={getAvatarUrl(livePost.author?.photoURL || livePost.userAvatar || livePost.authorAvatar)} className="w-full h-full rounded-[0.7rem] md:rounded-[0.9rem] object-cover" alt="" referrerPolicy="no-referrer" />
             </div>
             <div>
                <p className="text-sm md:text-base font-black tracking-tight flex items-center gap-1.5">
                  @{livePost.author?.username || livePost.userName || 'aeirmist_node'}
                  {(livePost.author?.isVerified || livePost.isVerified) && (
                    <ShieldCheck size={14} className={`${livePost.author?.verificationPlan === 'business' ? 'text-amber-400' : 'text-aeirmist-cyan'} shrink-0`} />
                  )}
                </p>
                <p className="text-[8px] md:text-[10px] text-white/20 font-black uppercase tracking-[0.3em]">
                  {livePost.createdAt ? new Date(livePost.createdAt.seconds * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Just now'}
                </p>
             </div>
          </div>
          {(() => {
            const livePostAuthorId = livePost.authorId || livePost.userId || livePost.author?.id || livePost.author?.uid;
            const isOwnPost = Boolean(profile?.id && livePostAuthorId && (livePostAuthorId === profile.id || livePostAuthorId === profile.uid));
            return (
              <div className="relative">
                <button onClick={() => setIsMenuOpen(true)} className="text-white/40 hover:text-white p-2">
                  <MoreVertical size={20} />
                </button>
                <PostMenu 
                  isOpen={isMenuOpen} 
                  onClose={() => setIsMenuOpen(false)} 
                  postId={livePost.id}
                  isOwnPost={isOwnPost}
                  onViewInsights={() => setShowInsights(true)}
                  onReport={() => openReportModal('post', livePost.id, livePostAuthorId)}
                  onEdit={() => {
                    setIsMenuOpen(false);
                    setIsEditing(true);
                  }}
                  onDelete={async () => {
                    try {
                      await deletePost(livePost.id);
                      onClose();
                    } catch (e) {
                      console.error("Delete failed:", e);
                    }
                  }}
                  isArchived={!!livePost.isArchived}
                  onArchive={async () => {
                    try {
                      await archivePost(livePost.id, !livePost.isArchived);
                    } catch (e) {
                      console.error("Archive failed:", e);
                    }
                  }}
                />
                {isEditing && <EditPostModal post={livePost} onClose={() => setIsEditing(false)} />}
              </div>
            );
          })()}
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 md:space-y-8 scrollbar-hide">
           <div className="space-y-4 md:space-y-5">
             <p className="text-sm md:text-[15px] text-white/90 leading-relaxed font-medium select-text">
               {renderParsedContent(livePost.content, false)}
             </p>
             <div className="flex items-center gap-4 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white/20">
               <Clock size={10} />
               <span>SYNCED {livePost.createdAt ? new Date(livePost.createdAt.seconds * 1000).toLocaleString() : 'Just now'}</span>
             </div>
           </div>
           
           <div className="space-y-6 md:space-y-8">
              <div className="flex items-center justify-between py-4 md:py-5 border-y border-white/5">
                 <div className="flex gap-6 md:gap-8">
                    <button onClick={handleLike} className={`flex items-center gap-2 md:gap-3 group transition-colors ${isLiked ? 'text-aeirmist-cyan' : 'text-white/40 hover:text-white'}`}>
                      <Heart size={20} fill={isLiked ? "currentColor" : "none"} className="group-hover:scale-125 transition-transform" /> 
                      <span className="text-xs md:text-sm font-black">{livePost.likesCount || 0}</span>
                    </button>
                    <div className="flex items-center gap-2 md:gap-3 text-aeirmist-magenta opacity-80">
                      <MessageSquare size={20} /> 
                      <span className="text-xs md:text-sm font-black">{livePost.commentsCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 text-white/40">
                      <Eye size={20} /> 
                      <span className="text-xs md:text-sm font-black">{(livePost.viewsCount || 0).toLocaleString()}</span>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    {profile && (livePost.authorId === profile.id || livePost.userId === profile.id) && (
                      <button 
                        onClick={() => setShowInsights(true)}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 text-aeirmist-cyan flex items-center justify-center hover:bg-aeirmist-cyan/20 transition-all"
                        title="View Analytics"
                      >
                        <BarChart3 size={18} />
                      </button>
                    )}
                    <button onClick={handleBookmark} className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white/5 flex items-center justify-center transition-all ${isBookmarked ? 'text-aeirmist-cyan border border-aeirmist-cyan/20 bg-aeirmist-cyan/5' : 'text-white/20 hover:text-white'}`}>
                      <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
                    </button>
                 </div>
              </div>
              
              <AnimatePresence>
                {showInsights && (
                  <React.Suspense fallback={null}>
                    <InsightsDashboard postId={livePost.id} onClose={() => setShowInsights(false)} />
                  </React.Suspense>
                )}
              </AnimatePresence>
              
              <div className="space-y-4 md:space-y-5">
                  <div className="flex items-center gap-4 opacity-20">
                     <div className="h-[1px] flex-1 bg-white/5" />
                     <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Comments</p>
                     <div className="h-[1px] flex-1 bg-white/5" />
                  </div>
                  
                  <div className="space-y-4 md:space-y-5">
                    {liveComments.length === 0 ? (
                      <div className="py-8 text-center text-white/30">
                        <MessageSquare size={20} className="mx-auto mb-2 text-white/20" />
                        <p className="text-xs font-semibold">No comments yet</p>
                        <p className="text-[10px] text-white/30 mt-0.5">Be the first to share your thoughts!</p>
                      </div>
                    ) : (
                      liveComments.map(comment => {
                        const isCommentLiked = comment.likedBy?.includes(profile?.id) || false;
                        const isOwnComment = comment.authorId === profile?.id;
                        return (
                          <div key={comment.id} className="flex gap-3 text-xs p-3 rounded-2xl bg-white/[0.01] border border-white/[0.02] hover:bg-white/[0.02] transition-colors relative group/comment-item">
                             <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10 shrink-0">
                               <img src={getAvatarUrl(comment.authorPhoto)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                             </div>
                             <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-white text-[11px]">@{comment.authorName}</span>
                                  <span className="text-[8px] text-white/30 font-mono">{formatCommentTime(comment.createdAt)}</span>
                                </div>
                                <p className="text-white/80 font-medium text-[11px] leading-relaxed break-all select-text">
                                  {renderParsedContent(comment.content, false)}
                                </p>
                                
                                <div className="flex items-center gap-3 pt-1 select-none">
                                  <button 
                                    onClick={() => handleLikeComment(comment.id, comment.likedBy || [])}
                                    className={`flex items-center gap-1.5 font-bold text-[8px] uppercase tracking-wider transition-colors ${isCommentLiked ? 'text-aeirmist-magenta' : 'text-white/30 hover:text-white'}`}
                                  >
                                    <Heart size={10} fill={isCommentLiked ? "currentColor" : "none"} />
                                    <span>{comment.likedBy?.length || 0}</span>
                                  </button>
                                  
                                  {isOwnComment && (
                                    <button 
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="text-white/20 hover:text-red-500 font-bold text-[8px] uppercase tracking-wider transition-colors"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                             </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={commentsEndRef} />
                  </div>
              </div>
           </div>
        </div>

        <form onSubmit={handleCommentSubmit} className="p-6 bg-white/[0.02] border-t border-white/5 backdrop-blur-3xl shrink-0">
           <div className="flex gap-3">
              <input 
                type="text" 
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Saving..." 
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-aeirmist-cyan transition-all placeholder:text-white/10 font-medium text-white text-left" 
                disabled={submittingComment}
              />
              <button 
                type="submit"
                disabled={submittingComment || !commentText.trim()}
                className="px-6 py-3 bg-white text-black rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-aeirmist-cyan disabled:opacity-30 disabled:hover:bg-white transition-all shadow-xl active:scale-95 shrink-0"
              >
                {submittingComment ? 'Sending...' : 'Send'}
              </button>
           </div>
        </form>
      </div>
    </motion.div>
  </div>
  );
};

export default React.memo(ProfileSystem);
