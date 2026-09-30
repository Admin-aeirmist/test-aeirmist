import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Trash2,
  Check,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAeirmist } from '../context/AeirmistContext';
import { getAvatarUrl } from '../lib/avatar';
import { AeirmistLogo } from './ui/AeirmistLogo';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallModal } from './pwa/InstallModal';
import { AccountSwitcher } from './auth/AccountSwitcher';
import { ReportProblemModal } from './ReportProblemModal';

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
  const { settings, updateAppearanceSettings, resetAppearanceSettings } = useAppearance();
  const isGlobalBgActive = settings.globalBgType !== 'none' && !!settings.globalBgValue;

  // More Menu Popover State
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [moreSubView, setMoreSubView] = useState<'main' | 'appearance'>('main');
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
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
    // Never auto-collapse while More Menu / Appearance is active!
    if (isMoreMenuOpen) {
      return;
    }

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
  }, [isMoreMenuOpen]);

  // Clear timer on unmount
  React.useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

  // Combined smart state - stay expanded if hovered OR if more menu/appearance popover is open
  const targetWidth = (isHovered || isMoreMenuOpen) ? 260 : (isExpanded ? (settings.compactSidebar ? 72 : 260) : 72);
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
        className="hidden md:flex flex-col h-full border-r border-white/10 nav-sidebar-glass bg-[#060608]/90 backdrop-blur-3xl px-3 py-4 z-50 shrink-0 relative select-none overflow-hidden"
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

        {/* MORE MENU POPOVER (PORTALED OUTSIDE SIDEBAR TO PREVENT CLIPPING BY OVERFLOW-HIDDEN & BLUR) */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {isMoreMenuOpen && (
              <motion.div
                ref={moreMenuRef}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={`fixed bottom-20 ${isCurrentlyExpanded ? 'left-4' : 'left-[78px]'} z-[9999] w-80 max-h-[85vh] overflow-y-auto ${
                  settings.themeMode === 'light'
                    ? 'bg-white/95 border-slate-200 text-slate-900 shadow-[0_24px_70px_rgba(0,0,0,0.18)]'
                    : 'bg-[#111217]/98 border-white/15 text-white shadow-[0_24px_70px_rgba(0,0,0,0.95)]'
                } border rounded-2xl backdrop-blur-3xl p-2.5 custom-scrollbar`}
              >
                {moreSubView === 'main' ? (
                  <div className="flex flex-col space-y-0.5">
                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onTabChange('settings');
                      }}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors w-full text-left ${
                        settings.themeMode === 'light'
                          ? 'text-slate-800 hover:text-slate-950 hover:bg-slate-100'
                          : 'text-white/90 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Settings size={17} className={settings.themeMode === 'light' ? 'text-slate-600' : 'text-white/70'} />
                      <span>Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onTabChange('dashboard');
                      }}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors w-full text-left ${
                        settings.themeMode === 'light'
                          ? 'text-slate-800 hover:text-slate-950 hover:bg-slate-100'
                          : 'text-white/90 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Activity size={17} className={settings.themeMode === 'light' ? 'text-slate-600' : 'text-white/70'} />
                      <span>Your activity</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onTabChange('profile');
                      }}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors w-full text-left ${
                        settings.themeMode === 'light'
                          ? 'text-slate-800 hover:text-slate-950 hover:bg-slate-100'
                          : 'text-white/90 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Bookmark size={17} className={settings.themeMode === 'light' ? 'text-slate-600' : 'text-white/70'} />
                      <span>Saved</span>
                    </button>

                    <button
                      onClick={() => setMoreSubView('appearance')}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors w-full text-left group ${
                        settings.themeMode === 'light'
                          ? 'text-slate-800 hover:text-slate-950 hover:bg-slate-100'
                          : 'text-white/90 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {settings.themeMode === 'light' ? <Sun size={17} className="text-amber-500" /> : <Moon size={17} className="text-aeirmist-cyan" />}
                        <span>Switch appearance</span>
                      </div>
                      <ChevronRight size={14} className={settings.themeMode === 'light' ? 'text-slate-400 group-hover:text-slate-700' : 'text-white/40 group-hover:text-white/80'} />
                    </button>

                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setReportModalOpen(true);
                      }}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors w-full text-left ${
                        settings.themeMode === 'light'
                          ? 'text-slate-800 hover:text-slate-950 hover:bg-slate-100'
                          : 'text-white/90 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <AlertCircle size={17} className="text-amber-500" />
                      <span>Report a problem</span>
                    </button>

                    <div className={`h-px my-1 mx-2 ${settings.themeMode === 'light' ? 'bg-slate-200' : 'bg-white/10'}`} />

                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setAccountSwitcherOpen(true);
                      }}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors w-full text-left ${
                        settings.themeMode === 'light'
                          ? 'text-slate-800 hover:text-slate-950 hover:bg-slate-100'
                          : 'text-white/90 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Users size={16} className={settings.themeMode === 'light' ? 'text-slate-600' : 'text-white/70'} />
                      <span>Switch accounts</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        logout();
                      }}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-red-500 hover:text-red-600 ${
                        settings.themeMode === 'light' ? 'hover:bg-red-50' : 'hover:bg-red-500/10'
                      } transition-colors w-full text-left`}
                    >
                      <LogOut size={16} />
                      <span>Log out</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-3 p-1.5">
                    {/* Header */}
                    <div className={`flex items-center gap-2 pb-2 border-b ${settings.themeMode === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                      <button
                        onClick={() => setMoreSubView('main')}
                        className={`p-1 rounded-lg transition-colors ${
                          settings.themeMode === 'light' ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900' : 'hover:bg-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <span className={`text-xs font-bold uppercase tracking-wider ${settings.themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                        Appearance & Theme
                      </span>
                    </div>

                    {/* Theme Selector */}
                    <div className="space-y-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${settings.themeMode === 'light' ? 'text-slate-500' : 'text-white/50'}`}>
                        Theme Mode
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => updateAppearanceSettings({ themeMode: 'dark', globalBgType: 'none', globalBgValue: '' })}
                          className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex flex-col items-center gap-1 ${
                            settings.themeMode === 'dark' && settings.globalBgValue !== '#000000'
                              ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                              : settings.themeMode === 'light'
                                ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Moon size={14} />
                          <span>Dark</span>
                        </button>

                        <button
                          onClick={() => updateAppearanceSettings({ themeMode: 'light', globalBgType: 'none', globalBgValue: '' })}
                          className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex flex-col items-center gap-1 ${
                            settings.themeMode === 'light'
                              ? 'bg-amber-400/20 border-amber-500 text-amber-800 shadow-[0_0_12px_rgba(251,191,36,0.25)] font-black'
                              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Sun size={14} />
                          <span>Light</span>
                        </button>

                        <button
                          onClick={() => updateAppearanceSettings({ themeMode: 'dark', globalBgType: 'solid', globalBgValue: '#000000' })}
                          className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex flex-col items-center gap-1 ${
                            settings.themeMode === 'dark' && settings.globalBgValue === '#000000'
                              ? 'bg-white/20 border-white text-white shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                              : settings.themeMode === 'light'
                                ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Zap size={14} />
                          <span>OLED</span>
                        </button>
                      </div>
                    </div>

                    {/* Accent Color Palette */}
                    <div className="space-y-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${settings.themeMode === 'light' ? 'text-slate-500' : 'text-white/50'}`}>
                        Accent Color
                      </span>
                      <div className={`flex items-center justify-between gap-1 p-2 rounded-xl border ${
                        settings.themeMode === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'
                      }`}>
                        {[
                          { id: 'cyan', color: '#00E5FF', label: 'Cyan' },
                          { id: 'blue', color: '#3B82F6', label: 'Blue' },
                          { id: 'purple', color: '#A855F7', label: 'Purple' },
                          { id: 'emerald', color: '#10B981', label: 'Emerald' },
                          { id: 'orange', color: '#F97316', label: 'Orange' },
                          { id: 'red', color: '#EF4444', label: 'Red' },
                        ].map((acc) => {
                          const isSelected = settings.accentColor === acc.id;
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              title={acc.label}
                              onClick={() => updateAppearanceSettings({ accentColor: acc.id as any })}
                              className={`w-7 h-7 rounded-full transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                                isSelected ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black shadow-lg' : 'opacity-70 hover:opacity-100 hover:scale-105'
                              }`}
                              style={{ backgroundColor: acc.color }}
                              aria-label={`Select ${acc.label} accent color`}
                              aria-pressed={isSelected}
                            >
                              {isSelected && (
                                <Check size={14} className={acc.id === 'cyan' ? 'text-black stroke-[3]' : 'text-white stroke-[3]'} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Wallpaper Presets */}
                    <div className="space-y-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${settings.themeMode === 'light' ? 'text-slate-500' : 'text-white/50'}`}>
                        Wallpaper Presets
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { name: 'Cyber Glow', value: 'linear-gradient(135deg, #091a29 0%, #050b14 100%)' },
                          { name: 'Deep Space', value: 'linear-gradient(135deg, #150928 0%, #080312 100%)' },
                          { name: 'Emerald Dusk', value: 'linear-gradient(135deg, #071f16 0%, #030d09 100%)' },
                          { name: 'Sunset Ember', value: 'linear-gradient(135deg, #280d09 0%, #0e0403 100%)' },
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => updateAppearanceSettings({ globalBgType: 'gradient', globalBgValue: preset.value })}
                            className={`p-2 rounded-xl text-[9px] font-bold uppercase tracking-wider border transition-all text-left truncate ${
                              settings.globalBgValue === preset.value
                                ? 'border-aeirmist-cyan text-white shadow-[0_0_10px_rgba(0,229,255,0.2)] ring-1 ring-aeirmist-cyan'
                                : 'border-white/15 text-white/90 hover:border-white/30'
                            }`}
                            style={{ background: preset.value }}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Wallpaper Upload */}
                    <div className="space-y-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${settings.themeMode === 'light' ? 'text-slate-500' : 'text-white/50'}`}>
                        Custom Wallpaper
                      </span>
                      <label className={`flex items-center justify-center gap-2 w-full p-2.5 rounded-xl border border-dashed transition-all cursor-pointer ${
                        settings.themeMode === 'light'
                          ? 'border-slate-300 hover:border-aeirmist-cyan bg-slate-50 hover:bg-cyan-50/50 text-slate-700 hover:text-cyan-700'
                          : 'border-white/20 hover:border-aeirmist-cyan bg-white/[0.02] hover:bg-aeirmist-cyan/5 text-white/80 hover:text-aeirmist-cyan'
                      } text-xs`}>
                        <ImageIcon size={15} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Upload Custom File</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={handleWallpaperUpload}
                        />
                      </label>

                      {settings.globalBgType !== 'none' && !!settings.globalBgValue && (
                        <button
                          onClick={() => updateAppearanceSettings({ globalBgType: 'none', globalBgValue: '' })}
                          className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} /> Remove Background
                        </button>
                      )}
                    </div>

                    {/* Blur Density & Clarity Sliders */}
                    <div className={`space-y-3 pt-2 border-t ${settings.themeMode === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                      <div className="space-y-1.5">
                        <div className={`flex justify-between text-[10px] font-bold uppercase tracking-wider ${settings.themeMode === 'light' ? 'text-slate-600' : 'text-white/70'}`}>
                          <span>Glass Blur Density</span>
                          <span className="font-mono text-aeirmist-cyan font-bold">{settings.cardBlur ?? 16}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          value={settings.cardBlur ?? 16}
                          onChange={(e) => updateAppearanceSettings({ cardBlur: Number(e.target.value) })}
                          className={`w-full accent-aeirmist-cyan h-2 rounded-lg cursor-pointer transition-all ${settings.themeMode === 'light' ? 'bg-slate-200' : 'bg-white/15'}`}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className={`flex justify-between text-[10px] font-bold uppercase tracking-wider ${settings.themeMode === 'light' ? 'text-slate-600' : 'text-white/70'}`}>
                          <span>Panel Opacity / Clarity</span>
                          <span className="font-mono text-aeirmist-cyan font-bold">{settings.backgroundTransparency ?? 15}%</span>
                        </div>
                        <input
                          type="range"
                          min="4"
                          max="100"
                          value={settings.backgroundTransparency ?? 15}
                          onChange={(e) => updateAppearanceSettings({ backgroundTransparency: Number(e.target.value) })}
                          className={`w-full accent-aeirmist-cyan h-2 rounded-lg cursor-pointer transition-all ${settings.themeMode === 'light' ? 'bg-slate-200' : 'bg-white/15'}`}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className={`flex justify-between text-[10px] font-bold uppercase tracking-wider ${settings.themeMode === 'light' ? 'text-slate-600' : 'text-white/70'}`}>
                          <span>Dark Dim / Overlay</span>
                          <span className="font-mono text-aeirmist-cyan font-bold">{settings.globalBgOverlay ?? 45}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="80"
                          value={settings.globalBgOverlay ?? 45}
                          onChange={(e) => updateAppearanceSettings({ globalBgOverlay: Number(e.target.value) })}
                          className={`w-full accent-aeirmist-cyan h-2 rounded-lg cursor-pointer transition-all ${settings.themeMode === 'light' ? 'bg-slate-200' : 'bg-white/15'}`}
                        />
                      </div>

                      {/* Reset to Default */}
                      <button
                        type="button"
                        onClick={() => resetAppearanceSettings()}
                        className={`w-full py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 transition-all mt-1 cursor-pointer ${
                          settings.themeMode === 'light'
                            ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        <RotateCcw size={12} />
                        <span>Reset to Default</span>
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

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
      <ReportProblemModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} />
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
      className={`h-[42px] flex items-center ${isExpanded ? 'px-2.5' : 'justify-center px-0'} py-1.5 rounded-xl transition-all duration-[180ms] ease-out relative group min-w-0 w-full cursor-pointer outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-aeirmist-cyan/50 select-none bg-transparent border border-transparent hover:bg-white/[0.06]`}
    >
      {/* Clean Icon Capsule */}
      <div className={`relative shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-[180ms] ease-out ${
        active 
          ? 'text-aeirmist-cyan bg-aeirmist-cyan/15 border border-aeirmist-cyan/35 shadow-[0_0_10px_var(--color-aeirmist-cyan)]'
          : 'text-white/80 group-hover:text-white group-hover:bg-white/10'
      }`}>
        {React.cloneElement(icon as any, { size: 19, strokeWidth: active ? 2.2 : 2.0 })}
        
        {/* Unread badge overlay for compact/collapsed state */}
        {!isExpanded && badge !== undefined && badge > 0 && (
          <div className="absolute -top-1 -right-1 bg-aeirmist-cyan text-black text-[8px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center shadow-sm">
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
            <span className="px-1.5 py-0.5 rounded-full bg-aeirmist-cyan/20 text-aeirmist-cyan border border-aeirmist-cyan/30 text-[8px] font-bold tracking-wider shrink-0">
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
    className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan/30 active:scale-90 transition-transform duration-100 rounded-xl"
  >
    <div className={`w-full h-full rounded-xl flex items-center justify-center transition-colors duration-150 border ${
      active 
        ? 'bg-aeirmist-cyan/15 border-aeirmist-cyan/35 text-aeirmist-cyan shadow-[0_0_12px_var(--color-aeirmist-cyan)]'
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
