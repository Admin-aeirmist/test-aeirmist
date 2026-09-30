/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, lazy, Suspense, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Navigation, Tab } from './components/Navigation';
import { CreatePost } from './components/CreatePost';
import { AeirmistProvider, useAeirmist } from './context/AeirmistContext';
import { getAvatarUrl } from './lib/avatar';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AppearanceProvider, useAppearance } from './context/AppearanceContext';
import { DynamicAesthetic } from './components/ui/DynamicAesthetic';
import { GlobalAppBackground } from './components/ui/GlobalAppBackground';
import { AdaptiveEngine } from './components/ui/AdaptiveEngine';
import { EmotionalEngine } from './components/ui/EmotionalEngine';
import { AuthSystem } from './components/auth/AuthSystem';
import { SignupWizard } from './components/auth/SignupWizard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sparkles, Zap, Lock, AlertCircle, Clock } from 'lucide-react';
import { AeirmistLogo } from './components/ui/AeirmistLogo';
import { ReportProvider } from './components/reporting/ReportContext';
import { logger } from '@/src/utils/logger';
import { PostDetailView } from './components/feed/PostDetailView';
import { PermissionManager } from './components/ui/PermissionManager';
import { backNav } from './utils/backNavigation';
import { ResonanceTracker } from './components/ResonanceTracker';
import { SEO } from './components/ui/SEO';
import { analytics } from './services/AnalyticsService';
import { followRecommService } from './services/FollowRecommendationService';
import { NetworkStatusProvider } from './context/NetworkStatusContext';
import { NetworkBanner } from './components/ui/NetworkBanner';
import { ToastNotification } from './components/notifications/ToastNotification';
import { VerificationCelebrationModal } from './components/profile/VerificationCelebrationModal';

// Aeirmist Core Component Architecture
function toMathBoldScript(text: string): string {
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) { // A-Z
      return String.fromCodePoint(0x1D4D0 + (code - 65));
    }
    if (code >= 97 && code <= 122) { // a-z
      return String.fromCodePoint(0x1D4EA + (code - 97));
    }
    return char;
  }).join('');
}

const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>,
  retries = 5,
  interval = 500
): React.LazyExoticComponent<T> => {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (retriesLeft: number) => {
        factory()
          .then((module) => {
            const component = module && module.default ? module.default : (module && typeof module === 'function' ? module : module?.default);
            if (!component) {
              // Try checking if any property in module is a valid component
              const fallbackKey = module ? Object.keys(module).find(k => typeof module[k] === 'function' || typeof module[k] === 'object') : null;
              const fallbackComp = fallbackKey ? module[fallbackKey] : null;
              if (fallbackComp) {
                sessionStorage.removeItem('chunk_reload_retry');
                resolve({ default: fallbackComp });
                return;
              }
              throw new Error('Dynamic module loading failed: no exported component');
            }
            sessionStorage.removeItem('chunk_reload_retry');
            resolve({ default: component });
          })
          .catch((error) => {
            if (retriesLeft <= 1) {
              const hasReloaded = sessionStorage.getItem('chunk_reload_retry');
              if (!hasReloaded && typeof window !== 'undefined') {
                sessionStorage.setItem('chunk_reload_retry', 'true');
                window.location.reload();
                return;
              }
              logger.error("Dynamic import retry exhausted:", error);
              reject(error);
            } else {
              setTimeout(() => attempt(retriesLeft - 1), interval);
            }
          });
      };
      attempt(retries);
    })
  );
};

const HomeFeedSystem = lazyWithRetry(() => import('./components/feed/HomeFeedSystem').then((m: any) => ({ default: m.HomeFeedSystem || m.default })));
const Sidebar = lazyWithRetry(() => import('./components/Sidebar').then((m: any) => ({ default: m.Sidebar || m.default })));
const Messenger = lazyWithRetry(() => import('./components/Messenger').then((m: any) => ({ default: m.Messenger || m.default })));
const ExploreSystem = lazyWithRetry(() => import('./components/discover/ExploreSystem').then((m: any) => ({ default: m.ExploreSystem || m.default })));
const AeirmistDashboard = lazyWithRetry(() => import('./components/dashboard/AeirmistDashboard').then((m: any) => ({ default: m.AeirmistDashboard || m.default })));
const SettingsSystem = lazyWithRetry(() => import('./components/settings/SettingsSystem').then((m: any) => ({ default: m.SettingsSystem || m.default })));
const NotificationCenter = lazyWithRetry(() => import('./components/notifications/NotificationCenter').then((m: any) => ({ default: m.NotificationCenter || m.default })));
const ProfileSystem = lazyWithRetry(() => import('./components/profile/ProfileSystem').then((m: any) => ({ default: m.ProfileSystem || m.default })));
const VideoFeed = lazyWithRetry(() => import('./components/videos/VideoFeed').then((m: any) => ({ default: m.VideoFeed || m.default })));
const AdminPanel = lazyWithRetry(() => import('./components/admin/AdminPanel').then((m: any) => ({ default: m.AdminPanel || m.default })));
const CommunityGuidelines = lazyWithRetry(() => import('./components/legal/CommunityGuidelines').then((m: any) => ({ default: m.CommunityGuidelines || m.default })));

const CallModal = lazyWithRetry(() => import('./components/CallModal').then((m: any) => ({ default: m.CallModal || m.default })));
const AeirmistCamera = lazyWithRetry(() => import('./components/ui/AeirmistCamera').then((m: any) => ({ default: m.AeirmistCamera || m.default })));
const PaymentResult = lazyWithRetry(() => import('./components/marketplace/PaymentResult').then((m: any) => ({ default: m.PaymentResult || m.default })));
const AccountSwitcher = lazyWithRetry(() => import('./components/auth/AccountSwitcher').then((m: any) => ({ default: m.AccountSwitcher || m.default })));
const CompleteYourAccountScreen = lazyWithRetry(() => import('./components/auth/CompleteYourAccountScreen').then((m: any) => ({ default: m.CompleteYourAccountScreen || m.default })));
const PasswordOnboardingModal = lazyWithRetry(() => import('./components/auth/PasswordOnboardingModal').then((m: any) => ({ default: m.PasswordOnboardingModal || m.default })));
const SetupRequiredScreen = lazyWithRetry(() => import('./components/auth/SetupScreens').then((m: any) => ({ default: m.SetupRequiredScreen || m.default })));
const PairingFailedScreen = lazyWithRetry(() => import('./components/auth/SetupScreens').then((m: any) => ({ default: m.PairingFailedScreen || m.default })));
const Vault = lazyWithRetry(() => import('./components/messenger/Vault').then((m: any) => ({ default: m.Vault || m.default })));
const PurgeScreen = lazyWithRetry(() => import('./components/auth/SetupScreens').then((m: any) => ({ default: m.PurgeScreen || m.default })));
const DeactivatedScreen = lazyWithRetry(() => import('./components/auth/SetupScreens').then((m: any) => ({ default: m.DeactivatedScreen || m.default })));
const BannedScreen = lazyWithRetry(() => import('./components/auth/BannedScreen').then((m: any) => ({ default: m.BannedScreen || m.default })));


type PreloadComponent = 'feed' | 'messenger' | 'discover' | 'profile' | 'settings' | 'videos' | 'dashboard' | 'notifications' | 'admin';

const preload = (comp: PreloadComponent) => {
  switch (comp) {
    case 'feed': import('./components/feed/HomeFeedSystem'); import('./components/Sidebar'); break;
    case 'messenger': import('./components/Messenger'); break;
    case 'discover': import('./components/discover/ExploreSystem'); break;
    case 'profile': import('./components/profile/ProfileSystem'); break;
    case 'settings': import('./components/settings/SettingsSystem'); break;
    case 'videos': import('./components/videos/VideoFeed'); break;
    case 'dashboard': import('./components/dashboard/AeirmistDashboard'); break;
    case 'notifications': import('./components/notifications/NotificationCenter'); break;
    case 'admin': import('./components/admin/AdminPanel'); break;
  }
};

const LazyFallback = () => (
  <div className="w-full h-full flex flex-col items-center justify-center p-20 gap-4 opacity-40">
    <div className="w-8 h-8 rounded-full border-2 border-aeirmist-cyan/20 border-t-aeirmist-cyan animate-spin" />
    <span className="text-[8px] font-black uppercase tracking-[0.4em] text-aeirmist-cyan">Syncing...</span>
  </div>
);

const HUDStat = ({ icon, label, value, color }: any) => (
  <div className="flex items-center gap-3">
    <div className={`text-${color} opacity-60`}>{icon}</div>
    <div>
      <div className="text-[8px] font-black uppercase tracking-widest text-white/30">{label}</div>
      <div className={`text-[10px] font-black uppercase tracking-widest text-${color}`}>{value}</div>
    </div>
  </div>
);

const HUDMiniStat = ({ icon, label }: any) => (
  <div className="flex flex-col items-center gap-2">
    <div className="text-aeirmist-cyan drop-shadow-[0_0_8px_rgba(0,242,255,0.5)]">{icon}</div>
    <div className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">{label}</div>
  </div>
);

const AlertsTabRedirect = ({ onComplete }: { onComplete: () => void }) => {
  React.useEffect(() => {
    onComplete();
  }, [onComplete]);
  return null;
};

const ComingSoonScreen = ({ sectorName, onHomeClick }: { sectorName: string; onHomeClick: () => void }) => {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#09090d] to-[#040406]">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full p-8 rounded-3xl border border-amber-500/20 bg-amber-500/[0.02] backdrop-blur-2xl space-y-5 flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
          <Clock size={32} />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
            Sector Locked • Coming Soon
          </span>
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">
            {sectorName}
          </h2>
          <p className="text-xs font-mono text-white/50 leading-relaxed">
            This platform feature is currently set to Coming Soon in system settings.
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[10px] font-mono text-white/40 text-left w-full space-y-1">
          <p className="font-bold text-white/60 uppercase">Admin Control Note:</p>
          <p>To unlock this feature, open <span className="text-aeirmist-cyan font-bold">Control Panel → Feature Flags</span> and toggle this sector to <span className="text-emerald-400 font-bold">ACTIVE</span>.</p>
        </div>

        <button
          onClick={onHomeClick}
          className="w-full h-11 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
        >
          Return to Home Feed
        </button>
      </motion.div>
    </div>
  );
};

function AppContent() {
  const { settings, updateAppearanceSettings } = useAppearance();
  const location = useLocation();
  const navigate = useNavigate();
  const isGuidelinesPage = location.pathname === '/community-guidelines';
  const { 
    loading, 
    user, 
    isSetup, 
    isConnecting, 
    connectionError, 
    isOffline,
    needsUsername, 
    profile, 
    setNeedsUsername, 
    activeCall, 
    endCall, 
    cameraConfig, 
    setCameraConfig,
    permissions,
    pendingPermission,
    setPendingPermission,
    _requestPermission,
    updateProfile,
    logout,
    deviceLinkingStatus,
    isScheduledForPurge,
    cancelDeleteAccount,
    storyUpload,
    needsPasswordOnboarding,
    featureFlags,
    db,
    addToast,
    isVaultOpen,
    setIsVaultOpen,
    isVaultUnlocked,
    setIsVaultUnlocked,
    allProfiles,
    showVerificationCelebration,
    setShowVerificationCelebration
  } = useAeirmist();
  const { isLoading: isThemeLoading } = useTheme();

  const [isPosting, setIsPosting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const isGlobalBgActive = settings?.globalBgType && settings.globalBgType !== 'none' && activeTab !== 'messenger';
  const [viewingPostId, setViewingPostId] = useState<string | null>(null);
  const [viewingStoreId, setViewingStoreId] = useState<string | null>(null);
  const [viewingProductId, setViewingProductId] = useState<string | null>(null);
  const [viewingVideoId, setViewingVideoId] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [messageRecipient, setMessageRecipient] = useState<any>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string | null>(null);

  useEffect(() => {
    const isUserPinned = localStorage.getItem('aeirmist_sidebar_user_pinned') === 'true';
    setIsSidebarExpanded(isUserPinned && settings?.desktopSidebarMode === 'pinned');
  }, [settings?.desktopSidebarMode]);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);
  const [lastMainTab, setLastMainTab] = useState<Tab>('feed');
  const [showSafeExit, setShowSafeExit] = useState(false);
  const [networkWarningText, setNetworkWarningText] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    setShowSplash(true);
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 4800);
    return () => clearTimeout(timer);
  }, [user?.uid]);

  useEffect(() => {
    // Only show safe exit if genuinely offline or real connection error
    const isActuallyOffline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
    if (isActuallyOffline) {
      setNetworkWarningText('No Internet Connection');
      setShowSafeExit(true);
      return;
    }

    if (connectionError) {
      setNetworkWarningText(connectionError.includes('Firebase') || connectionError.includes('network') ? 'Network Error' : 'Connection Error');
      setShowSafeExit(true);
      return;
    }

    // Normal loading, online auth initialization, or slow queries do NOT show connection warning
    setShowSafeExit(false);
    setNetworkWarningText(null);
  }, [isOffline, connectionError]);

  // Native Android Hardware Back Button Integration & Navigation Stack
  const lastBackPressRef = useRef<number>(0);
  const tabHistoryStackRef = useRef<Tab[]>(['feed']);

  // Keep a synchronous, always-up-to-date reference of navigation state
  const navStateRef = useRef<any>({});
  useEffect(() => {
    navStateRef.current = {
      viewingPostId,
      viewingVideoId,
      isPosting,
      isNotificationsOpen,
      isAccountSwitcherOpen,
      cameraConfig,
      settingsSection,
      viewingProfile,
      viewingStoreId,
      viewingProductId,
      messageRecipient,
      activeTab,
      storyState,
      addToast
    };
  });

  // Track tab history for back navigation between pages
  useEffect(() => {
    if (isPoppingRef.current) return;
    const stack = tabHistoryStackRef.current;
    if (stack[stack.length - 1] !== activeTab) {
      stack.push(activeTab);
      if (stack.length > 40) stack.shift();
    }
  }, [activeTab]);

  useEffect(() => {
    let backListener: any;
    let isMounted = true;
    
    const setupListener = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        if (!isMounted) return;

        backListener = await CapApp.addListener('backButton', () => {
          // 1. Top Priority: Check if any registered component handler (modal, sheet, active chat, etc.) intercepts back
          if (backNav.dispatch()) {
            return;
          }

          const s = navStateRef.current;

          // 2. Stories open
          if (s.storyState?.activeStoryGroup || s.storyState?.isStudioOpen || s.storyState?.isCreatingNote) {
            setStoryState({ activeStoryGroup: null, isStudioOpen: false, isCreatingNote: false });
            window.dispatchEvent(new CustomEvent('aeirmist-story-close'));
            return;
          }

          // 3. Post detail modal is open
          if (s.viewingPostId) {
            setViewingPostId(null);
            return;
          }

          // 4. Video modal / detail is open
          if (s.viewingVideoId) {
            setViewingVideoId(null);
            return;
          }

          // 5. Create Post studio is open
          if (s.isPosting) {
            setIsPosting(false);
            return;
          }

          // 6. Notification Center is open
          if (s.isNotificationsOpen) {
            setIsNotificationsOpen(false);
            return;
          }

          // 7. Account switcher is open
          if (s.isAccountSwitcherOpen) {
            setIsAccountSwitcherOpen(false);
            return;
          }

          // 8. Camera is open
          if (s.cameraConfig?.isOpen) {
            setCameraConfig(null);
            return;
          }

          // 9. Settings sub-section is open
          if (s.settingsSection) {
            setSettingsSection(null);
            return;
          }

          // 10. Viewing a store or product
          if (s.viewingStoreId || s.viewingProductId) {
            setViewingStoreId(null);
            setViewingProductId(null);
            return;
          }

          // 11. Specific chat in Messenger
          if (s.messageRecipient) {
            setMessageRecipient(null);
            return;
          }

          // 12. Viewing another user's profile -> return to previous screen/tab
          if (s.viewingProfile) {
            setViewingProfile(null);
            if (tabHistoryStackRef.current.length > 1) {
              tabHistoryStackRef.current.pop();
              const previousTab = tabHistoryStackRef.current[tabHistoryStackRef.current.length - 1] || 'feed';
              setActiveTab(previousTab);
            } else {
              setActiveTab('feed');
            }
            return;
          }

          // 13. If user navigated through different tabs, pop back to previous tab
          if (tabHistoryStackRef.current.length > 1) {
            tabHistoryStackRef.current.pop(); // Remove current tab
            const previousTab = tabHistoryStackRef.current[tabHistoryStackRef.current.length - 1] || 'feed';
            setActiveTab(previousTab);
            return;
          }

          // 14. If on any tab other than feed, return to feed
          if (s.activeTab !== 'feed') {
            setActiveTab('feed');
            return;
          }

          // 15. At root home feed: double back press within 2000ms to exit app
          const now = Date.now();
          if (now - lastBackPressRef.current < 2000) {
            CapApp.exitApp();
          } else {
            lastBackPressRef.current = now;
            s.addToast?.({
              title: 'Exit Aeirmist',
              message: 'Press back again to exit.',
              type: 'info'
            });
          }
        });
      } catch (err) {
        // Not in Capacitor native environment
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (backListener?.remove) {
        backListener.remove();
      }
    };
  }, []);

  React.useEffect(() => {
    const handleNavigate = (e: any) => {
      const targetTab = e.detail;
      if (targetTab) {
        handleTabChange(targetTab);
      }
    };
    window.addEventListener('aeirmist-navigate', handleNavigate);
    return () => window.removeEventListener('aeirmist-navigate', handleNavigate);
  }, []);

  useEffect(() => {
    if (isGlobalBgActive) {
      document.documentElement.classList.add('global-bg-active');
    } else {
      document.documentElement.classList.remove('global-bg-active');
    }
    return () => {
      document.documentElement.classList.remove('global-bg-active');
    };
  }, [settings?.globalBgType, activeTab, isGlobalBgActive]);

  // Derive call chat info for the modal
  const callChatInfo = activeCall ? {
    id: activeCall.conversationId,
    name: activeCall.callerName || 'Incoming Link',
    photo: getAvatarUrl(activeCall.callerPhoto, activeCall.callerId),
    participants: [activeCall.callerId, profile?.id].filter(Boolean),
    otherParticipantUid: activeCall.callerUid,
  } : null;

  const handleUserClick = React.useCallback((userData: any) => {
    setMessageRecipient(null);
    setViewingPostId(null);
    setViewingProfile(userData);
    setActiveTab('profile');
    analytics.trackEngagement('profile_visit', { targetUid: userData.id || userData.uid });
    if (userData.id || userData.uid) {
      followRecommService.recordProfileVisit(userData.id || userData.uid);
    }
  }, []);

  const handlePostClick = React.useCallback((postId: string) => {
    setViewingPostId(postId);
    analytics.trackEngagement('post_view', { postId });
  }, []);

  const handleMessageClick = React.useCallback((userData: any) => {
    setViewingProfile(null);
    setMessageRecipient(userData);
    setLastMainTab('messenger');
    setActiveTab('messenger');
  }, []);

  const handleCreatePostClick = React.useCallback(() => {
    setIsPosting(true);
  }, []);

  const handleEditProfileClick = React.useCallback(() => {
    setActiveTab('settings');
  }, []);

  const handleTabChange = (tab: Tab) => {
    if (tab === 'notifications') {
      setIsNotificationsOpen(true);
      return;
    }

    if (tab === 'profile' && activeTab === 'profile' && !viewingProfile) {
      // If already on profile, toggle account switcher
      setIsAccountSwitcherOpen(true);
      return;
    }

    if (tab === 'profile' && viewingProfile) {
      // If clicking profile while viewing someone else, go to own profile
      setViewingProfile(null);
    } else if (tab !== 'profile') {
      setViewingProfile(null);
      setLastMainTab(tab);
    }
    
    if (tab !== 'messenger') {
      setMessageRecipient(null);
    }
    if (tab !== 'settings') {
      setSettingsSection(null);
    }
    setActiveTab(tab);
  };

  // --- BROWSER HISTORY INTEGRATION FOR NAVIGATION ---
  const [storyState, setStoryState] = useState<{
    activeStoryGroup: any | null;
    isStudioOpen: boolean;
    isCreatingNote: boolean;
  }>({
    activeStoryGroup: null,
    isStudioOpen: false,
    isCreatingNote: false,
  });

  const isPoppingRef = React.useRef(false);

  useEffect(() => {
    const handleStoryChange = (e: any) => {
      setStoryState(e.detail);
    };
    window.addEventListener('aeirmist-story-state-change', handleStoryChange);
    return () => window.removeEventListener('aeirmist-story-state-change', handleStoryChange);
  }, []);

  // Helper functions for URL sync across tabs and pages
  const getPathForAppState = (
    tab: Tab,
    vProfile: any,
    isNotifsOpen: boolean,
    vPostId: string | null,
    vVideoId: string | null,
    vStoreId: string | null,
    vProductId: string | null,
    vChatUid: string | null,
    vStoryUserId: string | null = null,
    vSettingsSection: string | null = null,
    vIsPosting: boolean = false
  ): string => {
    if (vPostId) return `/post/${vPostId}`;
    if (vVideoId) return `/video/${vVideoId}`;
    if (vStoryUserId) return `/story/${vStoryUserId}`;
    if (vStoreId) return `/store/${vStoreId}`;
    if (vProductId) return `/product/${vProductId}`;
    if (isNotifsOpen) return '/notifications';
    if (vIsPosting) return '/create-post';

    if (tab === 'profile') {
      if (vProfile?.username) return `/@${vProfile.username}`;
      if (vProfile?.id) return `/u/${vProfile.id}`;
      return '/profile';
    }

    if (tab === 'settings') {
      if (vSettingsSection) return `/settings/${vSettingsSection}`;
      return '/settings';
    }

    switch (tab) {
      case 'feed': return '/';
      case 'discover': return '/explore';
      case 'videos': return '/videos';
      case 'messenger': 
        if (vChatUid) return `/messages/${vChatUid}`;
        return '/messages';
      case 'admin': return '/admin';
      case 'dashboard': return '/dashboard';
      default: return `/${tab}`;
    }
  };

  const getInitialStateFromPath = (path: string) => {
    const cleanPath = path.trim();
    const lowerPath = cleanPath.toLowerCase();

    // 1. Posts
    if (lowerPath.startsWith('/post/') || lowerPath.startsWith('/p/')) {
      const postId = (lowerPath.startsWith('/post/') 
        ? cleanPath.substring('/post/'.length) 
        : cleanPath.substring('/p/'.length)).split('?')[0];
      return { tab: 'feed' as Tab, notifs: false, postId: postId || null };
    }

    // 2. Videos / Reels
    if (
      lowerPath.startsWith('/video/') || 
      lowerPath.startsWith('/videos/') || 
      lowerPath.startsWith('/v/') || 
      lowerPath.startsWith('/reel/') || 
      lowerPath.startsWith('/reels/')
    ) {
      let videoId = '';
      if (lowerPath.startsWith('/video/')) videoId = cleanPath.substring('/video/'.length);
      else if (lowerPath.startsWith('/videos/')) videoId = cleanPath.substring('/videos/'.length);
      else if (lowerPath.startsWith('/v/')) videoId = cleanPath.substring('/v/'.length);
      else if (lowerPath.startsWith('/reel/')) videoId = cleanPath.substring('/reel/'.length);
      else if (lowerPath.startsWith('/reels/')) videoId = cleanPath.substring('/reels/'.length);
      videoId = videoId.split('?')[0];
      return { tab: 'videos' as Tab, notifs: false, videoId: videoId || null };
    }

    // 3. Stories
    if (lowerPath.startsWith('/story/') || lowerPath.startsWith('/stories/')) {
      const storyId = (lowerPath.startsWith('/story/') 
        ? cleanPath.substring('/story/'.length) 
        : cleanPath.substring('/stories/'.length)).split('?')[0];
      return { tab: 'feed' as Tab, notifs: false, storyUserId: storyId || null };
    }

    // 4. Stores & Products
    if (lowerPath.startsWith('/store/')) {
      const storeId = cleanPath.substring('/store/'.length).split('?')[0];
      return { tab: 'discover' as Tab, notifs: false, storeId: storeId || null };
    }
    if (lowerPath.startsWith('/product/') || lowerPath.startsWith('/marketplace/item/')) {
      const productId = (lowerPath.startsWith('/product/') 
        ? cleanPath.substring('/product/'.length) 
        : cleanPath.substring('/marketplace/item/'.length)).split('?')[0];
      return { tab: 'discover' as Tab, notifs: false, productId: productId || null };
    }
    if (lowerPath === '/marketplace' || lowerPath === '/shop') {
      return { tab: 'discover' as Tab, notifs: false };
    }

    // 5. Messages / Chats
    if (lowerPath.startsWith('/messages/') || lowerPath.startsWith('/chat/') || lowerPath.startsWith('/m/')) {
      let chatId = '';
      if (lowerPath.startsWith('/messages/')) chatId = cleanPath.substring('/messages/'.length);
      else if (lowerPath.startsWith('/chat/')) chatId = cleanPath.substring('/chat/'.length);
      else if (lowerPath.startsWith('/m/')) chatId = cleanPath.substring('/m/'.length);
      chatId = chatId.split('?')[0];
      return { tab: 'messenger' as Tab, notifs: false, chatUid: chatId || null };
    }
    if (lowerPath === '/messages' || lowerPath === '/messenger' || lowerPath === '/chat' || lowerPath === '/inbox') {
      return { tab: 'messenger' as Tab, notifs: false };
    }

    // 6. Settings & Sub-sections
    if (lowerPath.startsWith('/settings/')) {
      const section = cleanPath.substring('/settings/'.length).split('?')[0].toLowerCase();
      return { tab: 'settings' as Tab, notifs: false, settingsSection: section || null };
    }
    if (lowerPath === '/settings') {
      return { tab: 'settings' as Tab, notifs: false };
    }

    // 7. Profiles
    if (lowerPath.startsWith('/@') || lowerPath.startsWith('/u/') || lowerPath.startsWith('/profile/')) {
      let username: string | null = null;
      let userId: string | null = null;
      if (lowerPath.startsWith('/@')) {
        username = cleanPath.substring('/@'.length).split('?')[0];
      } else if (lowerPath.startsWith('/u/')) {
        userId = cleanPath.substring('/u/'.length).split('?')[0];
      } else if (lowerPath.startsWith('/profile/')) {
        const seg = cleanPath.substring('/profile/'.length).split('?')[0];
        if (seg.startsWith('@')) username = seg.substring(1);
        else userId = seg;
      }
      return { tab: 'profile' as Tab, notifs: false, username, userId };
    }
    if (lowerPath === '/profile' || lowerPath === '/me') {
      return { tab: 'profile' as Tab, notifs: false };
    }

    // 8. Notifications
    if (lowerPath === '/notifications' || lowerPath === '/alerts') {
      return { tab: 'feed' as Tab, notifs: true };
    }

    // 9. Discover / Explore
    if (lowerPath === '/explore' || lowerPath === '/discover' || lowerPath === '/search') {
      return { tab: 'discover' as Tab, notifs: false };
    }

    // 10. Videos / Reels main feed
    if (lowerPath === '/reels' || lowerPath === '/videos' || lowerPath === '/shorts') {
      return { tab: 'videos' as Tab, notifs: false };
    }

    // 11. Admin & Dashboard
    if (lowerPath === '/admin-panel' || lowerPath === '/admin') {
      return { tab: 'admin' as Tab, notifs: false };
    }
    if (lowerPath === '/dashboard' || lowerPath === '/stats' || lowerPath === '/analytics') {
      return { tab: 'dashboard' as Tab, notifs: false };
    }

    // 12. Create Post
    if (lowerPath === '/create-post' || lowerPath === '/new-post') {
      return { tab: 'feed' as Tab, notifs: false, isPosting: true };
    }

    // 13. Offline Sanctuary
    if (lowerPath === '/offline') {
      return { tab: 'feed' as Tab, notifs: false, isOfflineView: true };
    }

    return { tab: 'feed' as Tab, notifs: false };
  };

  // Initialize history state on mount
  useEffect(() => {
    const currentPath = window.location.pathname;
    const pathInit = getInitialStateFromPath(currentPath);

    const initialState = {
      activeTab: pathInit.tab,
      viewingProfile: null,
      viewingPostId: (pathInit as any).postId || null,
      viewingVideoId: (pathInit as any).videoId || null,
      viewingStoreId: (pathInit as any).storeId || null,
      viewingProductId: (pathInit as any).productId || null,
      messageRecipient: (pathInit as any).chatUid ? { id: (pathInit as any).chatUid } : null,
      isPosting: !!(pathInit as any).isPosting,
      isNotificationsOpen: pathInit.notifs,
      isAccountSwitcherOpen: false,
      settingsSection: (pathInit as any).settingsSection || null,
      storyState: {
        activeStoryGroup: (pathInit as any).storyUserId ? { userId: (pathInit as any).storyUserId } : null,
        isStudioOpen: false,
        isCreatingNote: false,
      },
      _appNav: true
    };

    setActiveTab(pathInit.tab);
    if ((pathInit as any).postId) {
      setViewingPostId((pathInit as any).postId);
    }
    if ((pathInit as any).videoId) {
      setViewingVideoId((pathInit as any).videoId);
    }
    if ((pathInit as any).storeId) {
      setViewingStoreId((pathInit as any).storeId);
    }
    if ((pathInit as any).productId) {
      setViewingProductId((pathInit as any).productId);
    }
    if ((pathInit as any).chatUid) {
      setMessageRecipient({ id: (pathInit as any).chatUid });
    }
    if ((pathInit as any).username || (pathInit as any).userId) {
      setViewingProfile({ 
        username: (pathInit as any).username, 
        id: (pathInit as any).userId 
      });
    }
    if (pathInit.notifs) {
      setIsNotificationsOpen(true);
    }
    if ((pathInit as any).settingsSection) {
      setSettingsSection((pathInit as any).settingsSection);
    }
    if ((pathInit as any).isPosting) {
      setIsPosting(true);
    }
    if ((pathInit as any).storyUserId) {
      const sState = {
        activeStoryGroup: { userId: (pathInit as any).storyUserId },
        isStudioOpen: false,
        isCreatingNote: false,
      };
      setStoryState(sState);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('aeirmist-story-state-restore', { detail: sState }));
      }, 150);
    }
    if ((pathInit as any).isOfflineView) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-offline-sanctuary'));
      }, 100);
    }

    if (!window.history.state || !window.history.state._appNav) {
      const targetUrl = getPathForAppState(
        pathInit.tab, 
        null, 
        pathInit.notifs, 
        (pathInit as any).postId || null, 
        (pathInit as any).videoId || null,
        (pathInit as any).storeId || null, 
        (pathInit as any).productId || null,
        (pathInit as any).chatUid || null
      );
      window.history.replaceState(initialState, '', targetUrl);
    } else {
      // Restore state on reload/mount if history exists
      const s = window.history.state;
      const currentNormPath = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
      const restoredTab = currentNormPath === '/' ? 'feed' : (pathInit.tab || s.activeTab || 'feed');
      setActiveTab(restoredTab);
      setViewingProfile(s.viewingProfile || null);
      setViewingPostId(s.viewingPostId || null);
      setViewingVideoId(s.viewingVideoId || null);
      setViewingStoreId(s.viewingStoreId || null);
      setViewingProductId(s.viewingProductId || null);
      setMessageRecipient(s.messageRecipient || null);
      setIsPosting(!!s.isPosting);
      setIsNotificationsOpen(typeof s.isNotificationsOpen === 'boolean' ? s.isNotificationsOpen : pathInit.notifs);
      setIsAccountSwitcherOpen(!!s.isAccountSwitcherOpen);
      if (s.storyState) {
        setStoryState(s.storyState);
        // Let StoriesSystem know
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('aeirmist-story-state-restore', { detail: s.storyState }));
        }, 100);
      }
      const targetUrl = getPathForAppState(
        restoredTab, 
        s.viewingProfile, 
        s.isNotificationsOpen, 
        s.viewingPostId || null, 
        s.viewingVideoId || null,
        s.viewingStoreId || null, 
        s.viewingProductId || null,
        s.messageRecipient?.id || null
      );
      window.history.replaceState(s, '', targetUrl);
    }
  }, []);

  // Sync state changes to window.history and browser URL
  useEffect(() => {
    if (isPoppingRef.current) {
      return;
    }

    if (isGuidelinesPage || location.pathname === '/community-guidelines') {
      return;
    }

    const stateToPush = {
      activeTab,
      viewingProfile,
      viewingPostId,
      viewingVideoId,
      viewingStoreId,
      viewingProductId,
      messageRecipient,
      isPosting,
      isNotificationsOpen,
      isAccountSwitcherOpen,
      storyState,
      settingsSection,
      _appNav: true
    };

    const targetUrl = getPathForAppState(
      activeTab, 
      viewingProfile, 
      isNotificationsOpen, 
      viewingPostId, 
      viewingVideoId,
      viewingStoreId, 
      viewingProductId,
      messageRecipient?.id || null,
      storyState.activeStoryGroup?.userId || null,
      settingsSection,
      isPosting
    );

    const hState = window.history.state;
    if (!hState || !hState._appNav) {
      window.history.replaceState(stateToPush, '', targetUrl);
      return;
    }

    // Push state ONLY when the target URL pathname changes!
    // If the path is identical, use replaceState to prevent duplicate history loops.
    if (location.pathname !== targetUrl) {
      navigate(targetUrl, { state: stateToPush });
    } else {
      window.history.replaceState(stateToPush, '', targetUrl);
    }
  }, [
    activeTab, 
    viewingProfile, 
    viewingPostId, 
    viewingVideoId, 
    viewingStoreId, 
    viewingProductId, 
    messageRecipient, 
    isPosting, 
    isNotificationsOpen, 
    isAccountSwitcherOpen, 
    storyState, 
    settingsSection,
    location.pathname,
    navigate
  ]);

  // Listen to popstate event (back/forward button)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const poppedState = event.state;
      if (poppedState && poppedState._appNav) {
        isPoppingRef.current = true;
        
        setActiveTab(poppedState.activeTab === 'notifications' ? 'feed' : poppedState.activeTab);
        setViewingProfile(poppedState.viewingProfile);
        setViewingPostId(poppedState.viewingPostId || null);
        setViewingVideoId(poppedState.viewingVideoId || null);
        setViewingStoreId(poppedState.viewingStoreId || null);
        setViewingProductId(poppedState.viewingProductId || null);
        setMessageRecipient(poppedState.messageRecipient);
        setIsPosting(poppedState.isPosting);
        setIsNotificationsOpen(poppedState.isNotificationsOpen);
        setIsAccountSwitcherOpen(poppedState.isAccountSwitcherOpen);
        setSettingsSection(poppedState.settingsSection || null);
        if (poppedState.storyState) {
          setStoryState(poppedState.storyState);
          window.dispatchEvent(new CustomEvent('aeirmist-story-state-restore', { detail: poppedState.storyState }));
        }

        // Sync tab history stack
        const restoredTab = poppedState.activeTab === 'notifications' ? 'feed' : poppedState.activeTab;
        if (restoredTab && tabHistoryStackRef.current[tabHistoryStackRef.current.length - 1] !== restoredTab) {
          tabHistoryStackRef.current.push(restoredTab);
        }
        
        // Reset popping state asynchronously after all React batching completes
        requestAnimationFrame(() => {
          setTimeout(() => {
            isPoppingRef.current = false;
          }, 100);
        });
      } else {
        // Fallback popstate if state doesn't have _appNav (e.g. direct url change)
        const pathInit = getInitialStateFromPath(window.location.pathname);
        setActiveTab(pathInit.tab);
        setIsNotificationsOpen(pathInit.notifs);
        setSettingsSection(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  React.useEffect(() => {
    analytics.init();
  }, []);

  React.useEffect(() => {
    analytics.trackPageView(`/${activeTab}`);
  }, [activeTab]);

  const getSEOTitle = () => {
    switch (activeTab) {
      case 'feed': return 'Home';
      case 'discover': return 'Discover';
      case 'videos': return 'Videos';
      case 'messenger': return 'Direct Messages';
      case 'profile': return viewingProfile ? `${viewingProfile.displayName || viewingProfile.username} | Profile` : 'Your Profile';
      case 'settings': return 'Settings';
      case 'dashboard': return 'Stats';
      case 'notifications': return 'Notifications | Activity';
      case 'admin': return 'Enterprise Control Center';
      default: return 'Aeirmist';
    }
  };

  const getSEODescription = () => {
    if (activeTab === 'profile' && viewingProfile) {
      return `View ${viewingProfile.displayName || viewingProfile.username}'s Profile on Aeirmist.`;
    }
    return undefined;
  };

  if (isGuidelinesPage) {
    return (
      <div className="flex-1 w-full relative overflow-hidden flex flex-col min-h-0 bg-aeirmist-bg">
        <GlobalAppBackground />
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route path="/community-guidelines" element={<CommunityGuidelines />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  if (!isSetup && !loading && !user) {
    return (
      <Suspense fallback={null}>
        <SetupRequiredScreen connectionError={connectionError} isConnecting={isConnecting} />
      </Suspense>
    );
  }

  // Show dedicated failure screen if device link pairing failed
  if (deviceLinkingStatus.error) {
    return (
      <Suspense fallback={null}>
        <PairingFailedScreen error={deviceLinkingStatus.error} onRetry={() => window.location.href = window.location.origin} />
      </Suspense>
    );
  }

  // Show unified Welcome screen on opening / initial load
  if (loading || (showSplash && !needsUsername)) {
    const getPersistedIdName = () => {
      const isValid = (val?: string | null) => {
        if (!val || typeof val !== 'string') return false;
        const trimmed = val.trim();
        if (!trimmed) return false;
        const l = trimmed.toLowerCase();
        return l !== 'aeirmist member' && l !== 'aeirmist user' && l !== 'user' && l !== 'member';
      };

      // Explicit check for main admin account: junaedislamjim180@gmail.com / doViFWfMXcOoas976z6MO216YNg1
      const userEmail = (user?.email || '').toLowerCase().trim();
      const userUid = user?.uid || '';
      const profileEmail = (profile?.email || '').toLowerCase().trim();
      const profileUid = profile?.ownerUid || profile?.uid || profile?.id || '';
      const profileUsername = (profile?.username || '').toLowerCase().trim();

      if (
        userEmail === 'junaedislamjim180@gmail.com' ||
        userUid === 'dovifwfmxcooas976z6mo216yng1' ||
        userUid === 'doViFWfMXcOoas976z6MO216YNg1' ||
        profileEmail === 'junaedislamjim180@gmail.com' ||
        profileUid === 'doViFWfMXcOoas976z6MO216YNg1' ||
        profileUid === 'profile_doViFWfMXcOoas976z6MO216YNg1' ||
        profileUsername === 'junaed_islam_jim9'
      ) {
        return 'Junaed Islam Jim';
      }

      if (isValid(profile?.displayName)) return profile.displayName.trim();
      if (isValid(profile?.fullName)) return profile.fullName.trim();
      if (isValid(profile?.name)) return profile.name.trim();

      if (typeof window !== 'undefined') {
        try {
          const rawSession = localStorage.getItem('aeirmist_session');
          if (rawSession) {
            const s = JSON.parse(rawSession);
            if (s?.email?.toLowerCase() === 'junaedislamjim180@gmail.com' || s?.uid === 'doViFWfMXcOoas976z6MO216YNg1' || s?.username === 'junaed_islam_jim9') {
              return 'Junaed Islam Jim';
            }
          }
        } catch (e) {}

        const cachedId = localStorage.getItem('aeirmist_cached_id_name');
        if (isValid(cachedId)) return cachedId!.trim();

        const cachedDisplay = localStorage.getItem('aeirmist_cached_display_name');
        if (isValid(cachedDisplay)) return cachedDisplay!.trim();

        try {
          const rawProfile = localStorage.getItem('aeirmist_cached_profile');
          if (rawProfile) {
            const p = JSON.parse(rawProfile);
            if (p?.email?.toLowerCase() === 'junaedislamjim180@gmail.com' || p?.uid === 'doViFWfMXcOoas976z6MO216YNg1' || p?.username === 'junaed_islam_jim9') {
              return 'Junaed Islam Jim';
            }
            if (isValid(p?.displayName)) return p.displayName.trim();
            if (isValid(p?.fullName)) return p.fullName.trim();
            if (isValid(p?.name)) return p.name.trim();
          }
        } catch (e) {}

        try {
          const rawSession = localStorage.getItem('aeirmist_session');
          if (rawSession) {
            const s = JSON.parse(rawSession);
            if (isValid(s?.displayName)) return s.displayName.trim();
            if (isValid(s?.fullName)) return s.fullName.trim();
            if (isValid(s?.name)) return s.name.trim();
          }
        } catch (e) {}

        try {
          const rawUserProfile = localStorage.getItem('aeirmist_user_profile');
          if (rawUserProfile) {
            const up = JSON.parse(rawUserProfile);
            if (isValid(up?.displayName)) return up.displayName.trim();
            if (isValid(up?.fullName)) return up.fullName.trim();
            if (isValid(up?.name)) return up.name.trim();
          }
        } catch (e) {}

        try {
          const rawAccounts = localStorage.getItem('aeirmist_saved_accounts');
          if (rawAccounts) {
            const accs = JSON.parse(rawAccounts);
            if (Array.isArray(accs) && accs.length > 0) {
              const activeId = localStorage.getItem('aeirmist_active_profile_id');
              const found = accs.find((a: any) => a.id === activeId) || accs[0];
              if (isValid(found?.displayName)) return found.displayName.trim();
              if (isValid(found?.fullName)) return found.fullName.trim();
              if (isValid(found?.name)) return found.name.trim();
            }
          }
        } catch (e) {}
      }

      if (isValid(user?.displayName) && user?.displayName !== profile?.username) {
        return user.displayName.trim();
      }

      return null;
    };

    const resolvedIdName = getPersistedIdName();
    const isUserKnown = Boolean(user || profile || resolvedIdName);

    const displayNameText = resolvedIdName || 'AEIRMIST';

    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-[100] overflow-hidden select-none">
        <div className="relative flex flex-col items-center max-w-xl px-6 text-center space-y-6">
          
          {/* App Logo - Large clean display without extra outer ring */}
          <motion.div 
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative flex items-center justify-center my-3"
          >
            <div className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
              <AeirmistLogo className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(0,242,255,0.4)]" variant="compact" />
            </div>
          </motion.div>

          {/* Welcome Title + Clean Glitch-Free Name Display */}
          <div className="flex flex-col items-center justify-center gap-y-2 px-2">
            <motion.span
              initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
              animate={{ opacity: 0.6, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
              className="text-xs sm:text-sm font-black tracking-[0.4em] text-zinc-400 uppercase"
            >
              {resolvedIdName ? 'WELCOME' : 'WELCOME TO'}
            </motion.span>

            <motion.h1
              key={displayNameText}
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="text-2xl sm:text-4xl md:text-5xl font-serif italic font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-300 drop-shadow-[0_0_25px_rgba(0,242,255,0.5)] max-w-[95vw] px-2 py-1 leading-normal"
            >
              {displayNameText}
            </motion.h1>
          </div>

          {/* Neon Cyan Divider Line */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.7, ease: "easeInOut" }}
            className="h-[1.5px] w-44 bg-gradient-to-r from-transparent via-aeirmist-cyan to-transparent shadow-[0_0_14px_rgba(0,242,255,0.7)]"
          />

          {/* Progress Bar & Status Text */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.5 }}
            className="flex flex-col items-center gap-2.5"
          >
            <p className="text-[9px] font-mono tracking-[0.35em] text-zinc-400 uppercase flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-aeirmist-cyan animate-ping" />
              <span className="text-zinc-400">
                {deviceLinkingStatus.loading ? 'Linking device...' : (user ? 'Preparing your feed...' : 'Initializing interface...')}
              </span>
            </p>

            <div className="w-40 h-1 rounded-full bg-zinc-900 border border-zinc-800/80 overflow-hidden relative shadow-[0_0_10px_rgba(0,0,0,0.8)]">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ delay: 1.4, duration: 2.2, ease: "easeInOut" }}
                className="h-full bg-gradient-to-r from-zinc-600 via-aeirmist-cyan to-white shadow-[0_0_12px_rgba(0,242,255,0.9)] rounded-full"
              />
            </div>
          </motion.div>

          {/* Safe Exit controls ONLY if actual network disconnect or connection error */}
          {showSafeExit && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="pt-2 flex flex-col gap-2.5 w-full max-w-xs"
            >
              <div className="flex items-center gap-2 text-aeirmist-magenta/60 justify-center">
                <AlertCircle size={13} />
                <span className="text-[8px] font-bold uppercase tracking-widest">{networkWarningText || 'Connection Offline'}</span>
              </div>
              <button 
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-3 rounded-[18px] bg-white/5 border border-white/10 text-white font-black uppercase tracking-[0.20em] text-[9px] hover:bg-white/10 transition-all cursor-pointer"
              >
                Reload Interface
              </button>
              <button 
                type="button"
                onClick={() => logout()}
                className="w-full py-2.5 rounded-[18px] bg-white/5 border border-white/10 text-white/40 font-black uppercase tracking-[0.20em] text-[9px] hover:text-white transition-all underline decoration-white/10 cursor-pointer"
              >
                Try Different Account
              </button>
            </motion.div>
          )}
        </div>

        {/* HUD Data Streams */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] overflow-hidden">
          <div className="absolute top-0 left-10 w-px h-full bg-gradient-to-b from-transparent via-aeirmist-cyan to-transparent animate-scan-slow" />
          <div className="absolute top-0 right-20 w-px h-full bg-gradient-to-b from-transparent via-aeirmist-magenta to-transparent animate-scan-fast" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthSystem />;
  }

  // If user is authenticated but profile document is still hydrating
  if (!profile && !needsUsername) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 z-50">
        <div className="w-12 h-12 border-2 border-aeirmist-cyan/30 border-t-aeirmist-cyan rounded-full animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-white/60 animate-pulse">
          Initializing Account...
        </p>
      </div>
    );
  }

  // Onboarding guard: Check if user needs to complete onboarding
  const isOnboardingIncomplete = Boolean(
    profile && (
      profile.onboardingCompleted === false ||
      (profile.onboardingStep && profile.onboardingStep >= 2 && profile.onboardingStep <= 5 && profile.onboardingCompleted !== true)
    )
  );

  if (isOnboardingIncomplete || needsUsername) {
    const activeStep = profile?.onboardingStep || (needsUsername ? 1 : 2);
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-50 overflow-y-auto">
        <SignupWizard
          initialStep={activeStep}
          onGoToLogin={logout}
          onComplete={() => {
            setNeedsUsername(false);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  if (needsPasswordOnboarding) {
    return (
      <Suspense fallback={null}>
        <CompleteYourAccountScreen />
      </Suspense>
    );
  }

  if (isScheduledForPurge || profile?.scheduledForPurge || profile?.status === 'scheduled_for_deletion') {
    return (
      <Suspense fallback={null}>
        <PurgeScreen onCancel={async () => {
          try {
            await cancelDeleteAccount();
          } catch (e) {
            logger.error("Purge cancellation failure:", e);
          }
        }} onLogout={logout} />
      </Suspense>
    );
  }

  if (profile?.isDeactivated) {
    return (
      <Suspense fallback={null}>
        <DeactivatedScreen onReactivate={async () => {
          try {
            await updateProfile({ isDeactivated: false });
          } catch (e) {
            logger.error("Reactivation failure:", e);
          }
        }} onLogout={logout} />
      </Suspense>
    );
  }

  if (profile?.isBanned || profile?.status === 'BANNED' || profile?.status === 'SUSPENDED' || profile?.status === 'DELETED') {
    return (
      <Suspense fallback={null}>
        <BannedScreen />
      </Suspense>
    );
  }

  return (
    <div className={`flex-1 w-full relative overflow-hidden flex flex-col min-h-0 ${isGlobalBgActive ? 'bg-transparent' : 'bg-aeirmist-bg'}`}>
      {/* Skip to Main Content Link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-6 focus:py-3 focus:bg-aeirmist-cyan focus:text-black focus:font-black focus:rounded-2xl focus:shadow-2xl focus:outline-none focus:ring-4 focus:ring-aeirmist-cyan/40"
      >
        Skip to Main Content
      </a>
      <GlobalAppBackground />
      {/* Subtle Background Elements */}
      <div className={`fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-aeirmist-cyan/10 rounded-full blur-[120px] pointer-events-none ${isGlobalBgActive ? 'opacity-0' : 'opacity-100'}`} style={{ zIndex: -15 }} />
      <div className={`fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-aeirmist-magenta/10 rounded-full blur-[120px] pointer-events-none ${isGlobalBgActive ? 'opacity-0' : 'opacity-100'}`} style={{ zIndex: -15 }} />

      <SEO 
        title={getSEOTitle()} 
        description={getSEODescription()}
        ogType={activeTab === 'profile' ? 'profile' : 'website'}
      />
      <DynamicAesthetic />
      <AdaptiveEngine />
      <EmotionalEngine />
      <ResonanceTracker />
      
      {/* GLOBAL STORY UPLOAD FEEDBACK */}
      <AnimatePresence>
        {(storyUpload) && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 inset-x-4 md:left-auto md:right-8 md:w-80 z-[3000] pointer-events-auto"
          >
            <div className="glass-panel p-4 rounded-3xl border-aeirmist-cyan/30 flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                {storyUpload?.previewUrl ? (
                  <img src={storyUpload?.previewUrl} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Clock size={16} className="text-aeirmist-cyan animate-pulse" />
                  </div>
                )}
                {/* Micro progress ring on the thumbnail */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <svg className="w-8 h-8 -rotate-90">
                    <circle cx="16" cy="16" r="14" className="stroke-white/10 fill-none" strokeWidth="2" />
                    <motion.circle 
                      cx="16" cy="16" r="14" 
                      className="stroke-aeirmist-cyan fill-none" 
                      strokeWidth="2" 
                      strokeDasharray="88"
                      animate={{ strokeDashoffset: 88 - (88 * (storyUpload?.progress || 0) / 100) }}
                    />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-aeirmist-cyan mb-1">
                  {storyUpload?.status || 'Processing upload...'}
                </p>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${storyUpload?.progress}%` }}
                    className="h-full bg-aeirmist-cyan"
                  />
                </div>
              </div>
              {storyUpload?.progress === 100 && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-6 h-6 rounded-full bg-aeirmist-cyan flex items-center justify-center text-black"
                >
                  <Sparkles size={12} fill="black" />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(loading || isThemeLoading) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-none"
          >
            {/* Immersive Distortion Field */}
            <motion.div 
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              className="absolute inset-0 bg-aeirmist-bg/80 backdrop-blur-[32px] pointer-events-auto"
            />
            
            <div className="relative flex flex-col items-center gap-12 pointer-events-none">
              {/* Navigation Ring */}
              <div className="relative w-48 h-48">
                {/* Orbital Rings */}
                {[...Array(3)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ 
                      rotate: 360,
                      scale: [1, 1.05, 1],
                      opacity: [0.1, 0.4, 0.1]
                    }}
                    transition={{ 
                      duration: 4 + i * 2, 
                      repeat: Infinity, 
                      ease: "linear" 
                    }}
                    className="absolute inset-0 rounded-full border border-aeirmist-cyan/20"
                    style={{ padding: `${i * 12}px` }}
                  >
                    <div className="w-2 h-2 rounded-full bg-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,1)]" />
                  </motion.div>
                ))}

                {/* Core Prism */}
                <div className="absolute inset-8 rounded-full bg-aeirmist-cyan/5 border border-aeirmist-cyan/10 flex items-center justify-center overflow-hidden">
                   <motion.div 
                     animate={{ 
                       rotate: [0, 90, 180, 270, 360],
                       filter: ['hue-rotate(0deg)', 'hue-rotate(90deg)', 'hue-rotate(0deg)']
                     }}
                     transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                     className="absolute inset-0 bg-gradient-to-br from-aeirmist-cyan/40 via-transparent to-aeirmist-magenta/40 opacity-30"
                   />
                   <Zap className="text-white w-12 h-12 relative z-10 drop-shadow-[0_0_20px_rgba(255,255,255,1)]" />
                </div>

                {/* Message Field */}
                <motion.div 
                  animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-4 border-2 border-aeirmist-cyan rounded-full"
                />
              </div>

              {/* Status Modules */}
              <div className="flex flex-col items-center gap-4">
                <motion.div 
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="px-4 py-1.5 border border-aeirmist-cyan/20 bg-aeirmist-cyan/5 rounded-full"
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.6em] text-aeirmist-cyan">
                    {isThemeLoading ? 'LOADING THEME' : 'LOADING'}
                  </span>
                </motion.div>
                
                <div className="flex gap-2">
                  {[...Array(5)].map((_, i) => (
                    <motion.div 
                      key={i}
                      animate={{ scaleY: [1, 2, 1], opacity: [0.2, 0.6, 0.2] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                      className="w-1 h-3 bg-aeirmist-cyan/40 rounded-full"
                    />
                  ))}
                </div>
              </div>

              {/* HUD Perimeter Lines */}
              <div className="absolute -inset-x-64 top-[50%] h-[1px] bg-gradient-to-r from-transparent via-aeirmist-cyan/20 to-transparent" />
            </div>

            {/* Scanline Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div 
          key="main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`layout-shell flex flex-1 min-h-0 ${isGlobalBgActive ? 'bg-transparent!' : ''}`}
        >
          <Navigation 
            onCreate={() => setIsPosting(true)} 
            activeTab={viewingProfile ? lastMainTab : activeTab} 
            onTabChange={handleTabChange}
            isExpanded={isSidebarExpanded}
            setIsExpanded={(val) => {
              setIsSidebarExpanded(val);
              try {
                localStorage.setItem('aeirmist_sidebar_user_pinned', val ? 'true' : 'false');
              } catch (e) {}
              updateAppearanceSettings({ desktopSidebarMode: val ? 'pinned' : 'hover' }).catch(() => {});
            }}
            onNotificationsClick={() => setIsNotificationsOpen(true)}
            onPreload={preload}
            isRemoteView={!!viewingProfile}
          />

          <main id="main-content" className="flex-1 min-w-0 h-full relative overflow-hidden flex flex-col">
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route path="/payment-success" element={<Suspense fallback={null}><PaymentResult status="success" /></Suspense>} />
                <Route path="/payment-failure" element={<Suspense fallback={null}><PaymentResult status="failure" /></Suspense>} />
                <Route path="/community-guidelines" element={<CommunityGuidelines />} />
                <Route path="*" element={
                  <AnimatePresence mode="wait">
                    {activeTab === 'feed' ? (
                  <motion.div
                    key="feed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="h-full flex overflow-hidden lg:grid lg:grid-cols-[1fr_var(--right-panel-w)]"
                  >
                    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden scroll-smooth relative min-w-0">
                      <div className="fluid-container pt-0 md:pt-0">
                        <ErrorBoundary inline>
                          <Suspense fallback={<LazyFallback />}>
                            <HomeFeedSystem 
                              onUserClick={handleUserClick} 
                              onPostClick={handlePostClick}
                              onCreate={handleCreatePostClick} 
                              onNavigate={(tab, param) => {
                                setActiveTab(tab as any);
                                if (tab === 'videos' && param) {
                                  setViewingVideoId(param);
                                }
                              }} 
                            />
                          </Suspense>
                        </ErrorBoundary>
                      </div>
                    </div>
                    <Sidebar onUserClick={handleUserClick} />
                  </motion.div>
                ) : activeTab === 'messenger' ? (
                  <motion.div
                    key="messenger"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex-1 overflow-hidden h-full flex flex-col min-h-0"
                  >
                    {featureFlags?.inbox === false ? (
                      <ComingSoonScreen sectorName="Direct Messaging & Inbox" onHomeClick={() => setActiveTab('feed')} />
                    ) : (
                      <ErrorBoundary inline>
                        <Suspense fallback={<LazyFallback />}>
                          <Messenger initialRecipient={messageRecipient} onUserClick={handleUserClick} />
                        </Suspense>
                      </ErrorBoundary>
                    )}
                  </motion.div>
                ) : activeTab === 'discover' ? (
                  <motion.div
                    key="discover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex-1 h-full overflow-y-auto overflow-x-hidden scroll-container flex flex-col"
                  >
                    {featureFlags?.marketplace === false ? (
                      <ComingSoonScreen sectorName="Marketplace & E-Commerce" onHomeClick={() => setActiveTab('feed')} />
                    ) : (
                      <ErrorBoundary inline>
                        <Suspense fallback={<LazyFallback />}>
                          <ExploreSystem 
                            onUserClick={handleUserClick} 
                            onPostClick={handlePostClick} 
                            initialStoreId={viewingStoreId}
                            initialProductId={viewingProductId}
                            onStoreChange={setViewingStoreId}
                            onProductChange={setViewingProductId}
                          />
                        </Suspense>
                      </ErrorBoundary>
                    )}
                  </motion.div>
                ) : activeTab === 'dashboard' ? (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex-1 h-full min-h-0 overflow-hidden flex flex-col"
                  >
                    {featureFlags?.discover === false ? (
                      <ComingSoonScreen sectorName="Explore & Connections Hub" onHomeClick={() => setActiveTab('feed')} />
                    ) : (
                      <div className="w-full h-full min-h-0 flex flex-col flex-1">
                        <ErrorBoundary inline>
                          <Suspense fallback={<LazyFallback />}>
                            <AeirmistDashboard onUserClick={handleUserClick} onMessageClick={handleMessageClick} />
                          </Suspense>
                        </ErrorBoundary>
                      </div>
                    )}
                  </motion.div>
                ) : activeTab === 'profile' ? (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex-1 h-full overflow-y-auto overflow-x-hidden touch-pan-y"
                  >
                    <div className="fluid-container pt-0 pb-0">
                      <ErrorBoundary inline>
                        <Suspense fallback={<LazyFallback />}>
                          <ProfileSystem 
                            targetProfile={viewingProfile} 
                            onMessageClick={handleMessageClick} 
                            onEditProfile={handleEditProfileClick} 
                            onUserClick={handleUserClick}
                            onPostClick={handlePostClick}
                            onCreate={handleCreatePostClick}
                          />
                        </Suspense>
                      </ErrorBoundary>
                    </div>
                  </motion.div>
                ) : activeTab === 'settings' ? (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex-1 h-full overflow-y-auto overflow-x-hidden scroll-container"
                  >
                    <div className="w-full min-h-full">
                      <ErrorBoundary inline>
                        <Suspense fallback={<LazyFallback />}>
                          <SettingsSystem initialSection={settingsSection as any} onSectionChange={(sec) => setSettingsSection(sec)} />
                        </Suspense>
                      </ErrorBoundary>
                    </div>
                  </motion.div>
                ) : activeTab === 'admin' ? (
                  <motion.div
                    key="admin"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex-1 h-full overflow-hidden flex flex-col"
                  >
                    <div className="w-full h-full flex-1 overflow-hidden flex flex-col">
                      <ErrorBoundary inline>
                        <Suspense fallback={<LazyFallback />}>
                          <AdminPanel />
                        </Suspense>
                      </ErrorBoundary>
                    </div>
                  </motion.div>
                ) : activeTab === 'videos' ? (
                  <motion.div
                    key="videos"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex-1 h-full overflow-hidden flex flex-col"
                  >
                    {featureFlags?.videos === false ? (
                      <ComingSoonScreen sectorName="Reels & Short Videos Feed" onHomeClick={() => setActiveTab('feed')} />
                    ) : (
                      <ErrorBoundary inline>
                        <Suspense fallback={<LazyFallback />}>
                          <VideoFeed 
                            onBack={() => setActiveTab('feed')} 
                            onUserClick={handleUserClick} 
                            initialVideoId={viewingVideoId}
                            onVideoClick={(id) => setViewingVideoId(id)}
                          />
                        </Suspense>
                      </ErrorBoundary>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="notification-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.08, ease: "linear" }}
                    className="flex-1 h-full overflow-y-auto touch-pan-y"
                  >
                    <div className="fluid-container py-8 md:py-12">
                      <h1 className="text-4xl font-display font-bold mb-8 text-fluid-4xl">Alerts</h1>
                      <AlertsTabRedirect onComplete={() => {
                        setIsNotificationsOpen(true);
                        setActiveTab('feed');
                      }} />
                    </div>
                  </motion.div>
                    )}
                  </AnimatePresence>
                } />
              </Routes>
            </Suspense>
          </main>
          
          <AnimatePresence>
            {isPosting && <CreatePost onOpenChange={setIsPosting} />}
          </AnimatePresence>

          <AnimatePresence>
            {viewingPostId && (
              <PostDetailView 
                postId={viewingPostId} 
                onClose={() => setViewingPostId(null)} 
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isNotificationsOpen && (
              <Suspense fallback={<LazyFallback />}>
                <NotificationCenter 
                  onClose={() => setIsNotificationsOpen(false)} 
                  onDashboardClick={() => {
                    setActiveTab('dashboard');
                    setIsNotificationsOpen(false);
                  }}
                  onSettingsClick={() => {
                    setActiveTab('settings');
                    setIsNotificationsOpen(false);
                  }}
                  onNavigate={(tab) => {
                    setActiveTab(tab);
                    setIsNotificationsOpen(false);
                  }}
                  onUserClick={handleUserClick}
                />
              </Suspense>
            )}
          </AnimatePresence>

          <Suspense fallback={null}>
            <AccountSwitcher 
              isOpen={isAccountSwitcherOpen} 
              onClose={() => setIsAccountSwitcherOpen(false)} 
              onAddAccount={() => {
                setIsAccountSwitcherOpen(false);
                // Instead of logging out, we just trigger the "needsUsername" state
                // because the logic in AeirmistContext handles multi-profile under same auth
                // but we need to ensure registerUsername works for adding second profile
                // I'll add a boolean to context to force onboarding view
                setNeedsUsername(true);
              }} 
            />
          </Suspense>

          <ToastNotification />
          <NetworkBanner />
          
          <AnimatePresence>
            {cameraConfig?.isOpen && (
              <Suspense fallback={null}>
                <AeirmistCamera 
                  initialMode={cameraConfig.mode}
                  onClose={() => setCameraConfig({ ...cameraConfig, isOpen: false })}
                  onCapture={(file, mode) => {
                    if (cameraConfig.onCapture) {
                      cameraConfig.onCapture(file);
                    }
                    setCameraConfig({ ...cameraConfig, isOpen: false });
                  }}
                />
              </Suspense>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {activeCall && activeCall.status !== 'ended' && callChatInfo && activeCall.callerId !== profile?.id && activeCall.callerUid !== user?.uid && (
              <Suspense fallback={null}>
                <CallModal 
                  chat={callChatInfo}
                  type={activeCall.type}
                  onClose={() => endCall(activeCall.id, activeCall.conversationId)}
                  isIncoming={true}
                />
              </Suspense>
            )}
          </AnimatePresence>

          
          <PermissionManager
            isOpen={!!pendingPermission && pendingPermission !== 'notifications'}
            type={pendingPermission}
            onClose={() => setPendingPermission(null)}
            status={permissions[pendingPermission]?.status}
            onConfirm={async () => {
              const permType = pendingPermission;
              const success = await _requestPermission(permType);
              if (success) {
                setPendingPermission(null);
                addToast?.({
                  title: 'Access Granted',
                  message: `${String(permType).charAt(0).toUpperCase() + String(permType).slice(1)} permission enabled successfully.`,
                  type: 'success'
                });
              }
            }}
          />

          {/* Global Vault Modal Overlay */}
          <AnimatePresence>
            {isVaultOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex flex-col overflow-hidden"
              >
                <Suspense fallback={<LazyFallback />}>
                  <Vault
                    db={db}
                    profile={profile}
                    chats={[] as any}
                    onSelectChat={(chatId) => {
                      setActiveTab('messenger');
                      setIsVaultOpen(false);
                    }}
                    onClose={() => setIsVaultOpen(false)}
                    isUnlocked={isVaultUnlocked}
                    setIsUnlocked={setIsVaultUnlocked}
                    allProfiles={allProfiles || []}
                  />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Instagram-style Account Verification Celebration Modal */}
          <VerificationCelebrationModal
            isOpen={showVerificationCelebration}
            onClose={() => setShowVerificationCelebration(false)}
            username={profile?.username}
            displayName={profile?.displayName || profile?.fullName}
            photoURL={profile?.photoURL}
          />

          {/* Development / Debugging UI */}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <NetworkStatusProvider>
        <BrowserRouter>
          <ThemeProvider>
            <AeirmistProvider>
              <ReportProvider>
                <AppearanceProvider>
                  <AppContent />
                </AppearanceProvider>
              </ReportProvider>
            </AeirmistProvider>
          </ThemeProvider>
        </BrowserRouter>
      </NetworkStatusProvider>
    </ErrorBoundary>
  );
}
