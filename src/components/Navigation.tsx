import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppearance } from '../context/AppearanceContext';
import { 
  Home, 
  Search, 
  PlusSquare, 
  Plus,
  Heart, 
  User, 
  Sparkles, 
  MessageSquare, 
  Settings, 
  Play,
  Film,
  LayoutDashboard,
  Users,
  Bell,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Bookmark,
  Activity,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  Pin,
  ShoppingBag,
  Scan,
  Fingerprint,
  Zap,
  Download,
  Menu,
  Moon,
  Sun,
  Image as ImageIcon,
  AlertCircle,
  ArrowLeft,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAeirmist } from '../context/AeirmistContext';
import { getAvatarUrl } from '../lib/avatar';
import { AeirmistLogo } from './ui/AeirmistLogo';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallModal } from './pwa/InstallModal';
import { AccountSwitcher } from './auth/AccountSwitcher';

export type Tab = 'feed' | 'messenger' | 'discover' | 'profile' | 'settings' | 'videos' | 'dashboard' | 'notifications' | 'admin';

interface NavigationProps {
  onCreate: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  onNotificationsClick: () => void;
  onPreload?: (comp: any) => void;
  isRemoteView?: boolean;
}

export const Navigation = React.memo(({ onCreate, activeTab, onTabChange, isExpanded, setIsExpanded, onNotificationsClick, onPreload, isRemoteView }: NavigationProps) => {
  const { user, profile, isNavHidden, unreadMessagesCount, unreadNotificationsCount, localAvatarURL, featureFlags, logout, addToast, uploadMedia } = useAeirmist();
  const { settings, updateAppearanceSettings } = useAppearance();
  const isGlobalBgActive = settings.globalBgType !== 'none' && !!settings.globalBgValue;

  // More Menu Popover State
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [moreSubView, setMoreSubView] = useState<'main' | 'appearance'>('main');
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
        setMoreSubView('main');
      }
    };
    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpen]);

  const handleWallpaperUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let url = '';
      if (uploadMedia) {
        url = await uploadMedia(file, `wallpapers/${user?.uid || profile?.id || 'guest'}`);
      }
      if (!url) {
        url = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
      updateAppearanceSettings({ globalBgType: 'custom', globalBgValue: url });
      addToast({ title: "Wallpaper Updated", message: "Custom background wallpaper set successfully.", type: "success" });
    } catch (err: any) {
      addToast({ title: "Upload Failed", message: err?.message || "Failed to set custom wallpaper", type: "warning" });
    }
  }, [uploadMedia, user?.uid, profile?.id, updateAppearanceSettings, addToast]);

  // Local hover state with beautiful, smart lock safety
  const [isHovered, setIsHovered] = React.useState(false);
  const collapseTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // PWA installation state
  const { isStandalone, isInstallable, install } = usePWAInstall();
  const [installModalOpen, setInstallModalOpen] = React.useState(false);

  const handleInstallClick = React.useCallback(async () => {
    if (isInstallable) {
      const res = await install();
      if (res.outcome !== 'accepted') {
        setInstallModalOpen(true);
      }
    } else {
      setInstallModalOpen(true);
    }
  }, [isInstallable, install]);

  const handleItemClick = React.useCallback((callback?: () => void) => {
    setIsHovered(false);
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }
    if (callback) callback();
  }, []);

  const handleMouseEnter = React.useCallback(() => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    // Smart collapse protection: check if user is currently typing or interacting
    const isUserActiveTyping = typeof document !== 'undefined' && document.activeElement && (
      document.activeElement.tagName === 'INPUT' || 
      document.activeElement.tagName === 'TEXTAREA' || 
      document.activeElement.getAttribute('contenteditable') === 'true'
    );
    
    if (isUserActiveTyping) {
      // Don't auto-collapse while active in input fields
      return;
    }

    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }
    collapseTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 280); // Quick yet elegant buffer delay
  }, []);

  // Clear timer on unmount
  React.useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

  // Combined smart state
  const targetWidth = isHovered ? 260 : (isExpanded ? (settings.compactSidebar ? 72 : 260) : 72);
  const isCurrentlyExpanded = targetWidth === 260;
  const shouldReduceMotion = useReducedMotion();

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.nav 
        id="aeirmist-desktop-sidebar"
        aria-label="Main Navigation"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        animate={{ width: targetWidth }} initial={false}
        transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 22, stiffness: 125 }}
        className="hidden md:flex flex-col h-full border-r border-white/10 bg-[#060608]/90 backdrop-blur-3xl px-3 py-4 z-50 shrink-0 relative select-none overflow-hidden"
      >
        {/* Top Spotlight Bar */}
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        {/* TOP: Fixed sticky header (Logo and Pin Toggle) */}
        <div className={`flex items-center ${isCurrentlyExpanded ? 'justify-between px-1' : 'justify-center px-0'} mb-6 pt-1 shrink-0`}>
          <button 
            type="button"
            onClick={() => handleItemClick(() => onTabChange('feed'))} 
            onMouseEnter={() => onPreload?.('feed')}
            aria-label="Aeirmist Home"
            className="flex items-center justify-center cursor-pointer group min-w-0 outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/50 rounded-lg transition-all duration-200" 
          >
            <AeirmistLogo 
              variant={isCurrentlyExpanded ? "full" : "compact"}
              className={isCurrentlyExpanded ? "h-6 w-auto" : "w-8 h-8"} 
              glow={false}
              glowStrength="weak"
            />
          </button>
          
          {/* Dual State Sidebar Pin Button */}
          {isCurrentlyExpanded && (
            <div className="shrink-0">
              {isExpanded ? (
                <button 
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  aria-label="Unpin Sidebar"
                  title="Unpin Sidebar (Enable Auto-Hover)"
                  className="p-1.5 rounded-lg bg-white/10 border border-white/15 text-white hover:bg-white/15 outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/50 transition-all duration-200 flex items-center justify-center group/pin"
                >
                  <Pin size={13} strokeWidth={2.2} className="rotate-45 transition-transform duration-200 group-hover/pin:rotate-0" />
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  aria-label="Pin Sidebar"
                  title="Pin Sidebar (Always Expanded)"
                  className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 hover:border-white/15 outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/50 transition-all duration-200 flex items-center justify-center group/pin"
                >
                  <Pin size={13} strokeWidth={1.8} className="transition-transform duration-200 group-hover/pin:rotate-45 text-white/50" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* MIDDLE: Scrollable navigation links container */}
        <div className="flex-1 overflow-y-auto py-1 space-y-1.5 min-h-0">
          <NavItem icon={<Home />} label="Home Feed" active={activeTab === 'feed'} isExpanded={isCurrentlyExpanded} onClick={() => handleItemClick(() => onTabChange('feed'))} onMouseEnter={() => onPreload?.('feed')} />
          <NavItem icon={<Users />} label="Connections" active={activeTab === 'dashboard'} comingSoon={featureFlags?.discover === false} isExpanded={isCurrentlyExpanded} onClick={() => handleItemClick(() => onTabChange('dashboard'))} onMouseEnter={() => onPreload?.('dashboard')} />
          <NavItem icon={<ShoppingBag />} label="Marketplace" active={activeTab === 'discover'} comingSoon={featureFlags?.marketplace === false} isExpanded={isCurrentlyExpanded} onClick={() => handleItemClick(() => onTabChange('discover'))} onMouseEnter={() => onPreload?.('discover')} />
          <NavItem icon={<Film />} label="Videos" active={activeTab === 'videos'} comingSoon={featureFlags?.videos === false} isExpanded={isCurrentlyExpanded} onClick={() => handleItemClick(() => onTabChange('videos'))} onMouseEnter={() => onPreload?.('videos')} />
          <NavItem icon={<MessageSquare />} label="Inbox" active={activeTab === 'messenger'} comingSoon={featureFlags?.inbox === false} isExpanded={isCurrentlyExpanded} onClick={() => handleItemClick(() => onTabChange('messenger'))} onMouseEnter={() => onPreload?.('messenger')} badge={unreadMessagesCount} />
          <NavItem icon={<Bell />} label="Alerts" active={activeTab === 'notifications'} comingSoon={featureFlags?.notifications === false} isExpanded={isCurrentlyExpanded} onClick={() => handleItemClick(onNotificationsClick)} onMouseEnter={() => onPreload?.('notifications')} badge={unreadNotificationsCount} />
          
          <div className="h-px bg-white/5 my-3 mx-1 relative shrink-0">
             <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
          
          <NavItem icon={<PlusSquare />} label="New Post" isExpanded={isCurrentlyExpanded} onClick={() => handleItemClick(onCreate)} variant="accent" />
          <NavItem icon={<User />} label="Profile" active={activeTab === 'profile' && !isRemoteView} isExpanded={isCurrentlyExpanded} onClick={() => handleItemClick(() => onTabChange('profile'))} onMouseEnter={() => onPreload?.('profile')} />
          <NavItem icon={<Settings />} label="Settings" active={activeTab === 'settings'} isExpanded={isCurrentlyExpanded} onClick={() => handleItemClick(() => onTabChange('settings'))} onMouseEnter={() => onPreload?.('settings')} />
          {(user?.email?.toLowerCase() === 'junaedislamjim180@gmail.com' || 
             profile?.email?.toLowerCase() === 'junaedislamjim180@gmail.com' || 
             profile?.username?.toLowerCase() === 'junaed_islam_jim9' ||
             user?.uid === 'dovifwfmxcooas976z6mo216yng1' ||
             user?.uid === 'doViFWfMXcOoas976z6MO216YNg1' ||
             profile?.ownerUid === 'doViFWfMXcOoas976z6MO216YNg1' ||
             profile?.id === 'doViFWfMXcOoas976z6MO216YNg1' ||
             profile?.isAdmin === true ||
             ['admin', 'owner', 'super_admin', 'administrator', 'moderator'].includes((profile?.role || '').toLowerCase())) && (
            <NavItem 
              icon={<ShieldCheck />} 
              label="Control Panel" 
              active={activeTab === 'admin'} 
              isExpanded={isCurrentlyExpanded} 
              onClick={() => handleItemClick(() => onTabChange('admin' as any))} 
            />
          )}
        </div>

        {/* MORE MENU POPOVER */}
        <AnimatePresence>
          {isMoreMenuOpen && (
            <motion.div
              ref={moreMenuRef}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute bottom-20 left-3 w-64 bg-[#141418]/95 border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-[200] p-1.5 overflow-hidden text-white"
            >
              {moreSubView === 'main' ? (
                <div className="flex flex-col space-y-0.5">
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onTabChange('settings');
                    }}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors w-full text-left"
                  >
                    <Settings size={17} className="text-white/70" />
                    <span>Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onTabChange('dashboard');
                    }}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors w-full text-left"
                  >
                    <Activity size={17} className="text-white/70" />
                    <span>Your activity</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onTabChange('profile');
                    }}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors w-full text-left"
                  >
                    <Bookmark size={17} className="text-white/70" />
                    <span>Saved</span>
                  </button>

                  <button
                    onClick={() => setMoreSubView('appearance')}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      {settings.themeMode === 'light' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-white/70" />}
                      <span>Switch appearance</span>
                    </div>
                    <ChevronRight size={14} className="text-white/40" />
                  </button>

                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      addToast({ title: "Report Sent", message: "Thank you for your feedback. Our team is investigating.", type: "info" });
                    }}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors w-full text-left"
                  >
                    <AlertCircle size={17} className="text-white/70" />
                    <span>Report a problem</span>
                  </button>

                  <div className="h-px bg-white/10 my-1 mx-2" />

                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setAccountSwitcherOpen(true);
                    }}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors w-full text-left"
                  >
                    <span>Switch accounts</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors w-full text-left"
                  >
                    <LogOut size={16} />
                    <span>Log out</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col space-y-2 p-1">
                  <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                    <button
                      onClick={() => setMoreSubView('main')}
                      className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <span className="text-xs font-bold uppercase tracking-wider text-white">Switch appearance</span>
                  </div>

                  {/* Dark Mode Toggle */}
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-white/[0.03]">
                    <span className="text-xs text-white/80">Dark mode</span>
                    <button
                      onClick={() => updateAppearanceSettings({ themeMode: settings.themeMode === 'dark' ? 'light' : 'dark' })}
                      className={`w-10 h-6 rounded-full p-0.5 transition-colors ${settings.themeMode === 'dark' ? 'bg-aeirmist-cyan' : 'bg-white/20'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-black shadow-md transition-transform ${settings.themeMode === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Custom Wallpaper Upload */}
                  <div className="space-y-1.5 px-1 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Custom Wallpaper</span>
                    <label className="flex items-center justify-center gap-2 w-full p-2.5 rounded-xl border border-dashed border-white/20 hover:border-aeirmist-cyan bg-white/[0.02] hover:bg-aeirmist-cyan/5 text-xs text-white/80 hover:text-aeirmist-cyan cursor-pointer transition-all">
                      <ImageIcon size={16} />
                      <span>Choose Wallpaper</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleWallpaperUpload}
                      />
                    </label>

                    {settings.globalBgType === 'custom' && settings.globalBgValue && (
                      <button
                        onClick={() => updateAppearanceSettings({ globalBgType: 'none', globalBgValue: '' })}
                        className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={12} /> Remove Wallpaper
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM: Sticky user info profile card + More button */}
        <div className="mt-auto pt-2 shrink-0 space-y-1.5">
          {/* More Menu Trigger Button */}
          <NavItem 
            icon={<Menu />} 
            label="More" 
            active={isMoreMenuOpen} 
            isExpanded={isCurrentlyExpanded} 
            onClick={() => setIsMoreMenuOpen(prev => !prev)} 
          />

          <div className="h-px bg-white/5 my-1 relative">
             <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <motion.button 
            id="aeirmist-sidebar-profile-card"
            type="button"
            onClick={() => handleItemClick(() => onTabChange('profile'))}
            aria-label={`View profile for ${profile?.displayName || user?.displayName || 'user'}`}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985, opacity: 0.9 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`w-full text-left cursor-pointer rounded-xl transition-all duration-200 flex items-center outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/50 select-none ${
              isCurrentlyExpanded 
                ? 'p-2 bg-white/[0.03] border border-white/10 hover:border-white/15 hover:bg-white/[0.06]' 
                : 'p-1 h-12 justify-center bg-transparent border border-transparent hover:bg-white/5'
            } relative group/profile`}
          >
            {/* Mirror highlighting sheen */}
            {isCurrentlyExpanded && (
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
            )}

            {/* Avatar container with status tracker */}
            <div className={`relative shrink-0 flex items-center justify-center rounded-lg transition-all duration-200 ${
              isCurrentlyExpanded 
                ? 'w-8 h-8 border border-white/15 bg-black/40 group-hover/profile:border-white/25'
                : 'w-9 h-9 border border-white/10 bg-[#07070a]/90 group-hover/profile:border-white/20'
            }`}>
              <div className="w-full h-full rounded-md overflow-hidden bg-neutral-900">
                <img 
                  src={localAvatarURL || getAvatarUrl(profile?.photoURL || user?.photoURL)} 
                  alt="Profile" 
                  className="w-full h-full object-cover group-hover/profile:scale-105 transition-transform duration-300"
                />
              </div>
              
              {/* Active indicator dot */}
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-aeirmist-lime rounded-full border border-neutral-950" />
            </div>

            {/* Profile identifiers dynamically loading with beautiful spacing */}
            {isCurrentlyExpanded && (
              <motion.div 
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="ml-2.5 flex-1 min-w-0 pr-1 flex flex-col justify-center"
              >
                <span className="text-[10px] font-bold uppercase text-white/90 tracking-wider truncate block">
                  {profile?.displayName || user?.displayName || 'Account'}
                </span>
                <span className="text-[9px] font-mono font-medium tracking-wide text-white/45 truncate block mt-0.5 group-hover/profile:text-white/70 transition-colors">
                  @{profile?.username && profile.username !== 'user' && profile.username !== 'null'
                    ? profile.username.replace(/^@+/, '')
                    : (profile?.displayName ? profile.displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : (user?.email ? user.email.split('@')[0] : 'member'))}
                </span>
              </motion.div>
            )}

            {/* Hover Tooltip when collapsed */}
            {!isCurrentlyExpanded && (
              <div className="fixed left-[78px] px-2.5 py-1.5 rounded-lg bg-[#0c0d12]/95 border border-white/10 text-[9px] uppercase font-bold tracking-widest opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap z-[100] shadow-xl backdrop-blur-xl text-white">
                Profile - {profile?.displayName || user?.displayName || 'Account'}
              </div>
            )}
          </motion.button>
        </div>
      </motion.nav>

      <AccountSwitcher 
        isOpen={accountSwitcherOpen} 
        onClose={() => setAccountSwitcherOpen(false)} 
        onAddAccount={() => { 
          setAccountSwitcherOpen(false); 
          logout(); 
        }} 
      />

      {/* Mobile Bottom Navigation Bar - FLUID DOCK */}
      <AnimatePresence>
        {!isNavHidden && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-[390px] mb-[env(safe-area-inset-bottom,0px)] overflow-visible"
          >
            <div 
              role="navigation" 
              aria-label="Mobile Navigation"
              className={`relative rounded-2xl border border-white/10 px-2 py-1.5 flex justify-around items-center shadow-[0_12px_30px_rgba(0,0,0,0.85)] ${isGlobalBgActive ? 'bg-[#060608]/80' : 'bg-black/85'} backdrop-blur-3xl overflow-hidden`}
            >
              {/* Metallic Glass sheen highlights */}
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 inset-x-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
              
              <MobileNavItem icon={<Home />} active={activeTab === 'feed'} onClick={() => handleItemClick(() => onTabChange('feed'))} onMouseEnter={() => onPreload?.('feed')} label="Home" />
              <MobileNavItem icon={<Users />} active={activeTab === 'dashboard'} onClick={() => handleItemClick(() => onTabChange('dashboard'))} onMouseEnter={() => onPreload?.('dashboard')} label="Connections" />
              <MobileNavItem icon={<Film />} active={activeTab === 'videos'} onClick={() => handleItemClick(() => onTabChange('videos'))} onMouseEnter={() => onPreload?.('videos')} label="Videos" />
              <MobileNavItem icon={<MessageSquare />} active={activeTab === 'messenger'} onClick={() => handleItemClick(() => onTabChange('messenger'))} onMouseEnter={() => onPreload?.('messenger')} label="Messages" badge={unreadMessagesCount} />
              <MobileNavItem icon={<User />} active={activeTab === 'profile' && !isRemoteView} onClick={() => handleItemClick(() => onTabChange('profile'))} onMouseEnter={() => onPreload?.('profile')} label="Profile" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InstallModal isOpen={installModalOpen} onClose={() => setInstallModalOpen(false)} />
    </>
  );
});

// Primary standardized Sidebar Item Button
const NavItem = React.memo(({ icon, label, active = false, isExpanded = true, onClick, variant = 'default', onMouseEnter, badge, comingSoon = false }: { 
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  isExpanded?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'accent';
  onMouseEnter?: () => void;
  badge?: number;
  comingSoon?: boolean;
}) => {
  const formatBadge = (count: number) => {
    return count > 99 ? '99+' : count.toString();
  };

  return (
    <motion.button 
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      whileTap={{ opacity: 0.94 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`h-[42px] flex items-center ${isExpanded ? 'px-2.5' : 'justify-center px-0'} py-1.5 rounded-xl transition-all duration-[180ms] ease-out relative group min-w-0 w-full cursor-pointer outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00E5FF]/50 select-none bg-transparent border border-transparent hover:bg-white/[0.06]`}
    >
      {/* Clean Icon Capsule */}
      <div className={`relative shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-[180ms] ease-out ${
        active 
          ? 'text-[#00E5FF] bg-[#00E5FF]/15 border border-[#00E5FF]/30 shadow-[0_0_10px_rgba(0,229,255,0.3)]'
          : 'text-white/80 group-hover:text-white group-hover:bg-white/10'
      }`}>
        {React.cloneElement(icon as any, { size: 19, strokeWidth: active ? 2.2 : 2.0 })}
        
        {/* Unread badge overlay for compact/collapsed state */}
        {!isExpanded && badge !== undefined && badge > 0 && (
          <div className="absolute -top-1 -right-1 bg-[#00E5FF] text-black text-[8px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center shadow-sm">
            {formatBadge(badge)}
          </div>
        )}
      </div>
      
      {/* Navigation Label */}
      {isExpanded && (
        <div className="flex-1 flex items-center justify-between min-w-0 ml-2.5 pr-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] whitespace-nowrap truncate text-white/80 group-hover:text-white transition-colors duration-[180ms] ease-out">
            {label}
          </span>

          {comingSoon ? (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[7px] font-mono font-bold tracking-widest shrink-0">
              SOON
            </span>
          ) : badge !== undefined && badge > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30 text-[8px] font-bold tracking-wider shrink-0">
              {formatBadge(badge)}
            </span>
          ) : null}
        </div>
      )}

      {/* Floating tooltip labels on hover in compact mode */}
      {!isExpanded && (
        <div className="fixed left-[78px] px-2.5 py-1.5 rounded-lg bg-[#0c0d12]/95 border border-white/10 text-[9px] uppercase font-bold tracking-widest opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-[180ms] ease-out whitespace-nowrap z-[100] shadow-xl backdrop-blur-xl text-white">
          {label} {badge !== undefined && badge > 0 ? `(${formatBadge(badge)})` : ''}
        </div>
      )}
    </motion.button>
  );
});

// Compact Mobile Bottom nav item trigger
const MobileNavItem = React.memo(({ icon, active = false, onClick, onMouseEnter, badge, label }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; onMouseEnter?: () => void; badge?: number }) => (
  <button 
    type="button"
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onTouchStart={() => {
      onMouseEnter?.();
    }}
    className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 active:scale-90 transition-transform duration-100 rounded-xl"
  >
    <div className={`w-full h-full rounded-xl flex items-center justify-center transition-colors duration-150 border ${
      active 
        ? 'bg-white/15 border-white/30 text-white shadow-[0_0_12px_rgba(255,255,255,0.15)]'
        : 'bg-[#0a0a0d]/90 border-white/5 text-white/50 active:text-white'
    }`}>
      {/* Premium Glass reflection */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      <div className="relative z-10">
        {React.cloneElement(icon as any, { 
          size: 18, 
          strokeWidth: active ? 2.5 : 1.8,
        })}
      </div>
    </div>

    {badge !== undefined && badge > 0 && (
      <div className="absolute -top-1 -right-1 z-20 px-1.5 py-0.5 min-w-[18px] h-[18px] bg-aeirmist-cyan text-black text-[8px] font-black rounded-full border border-neutral-950 flex items-center justify-center shadow-sm animate-pulse">
        {badge > 99 ? '99+' : badge}
      </div>
    )}
  </button>
));
