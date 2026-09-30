import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { useTheme, THEMES, ThemeConfig } from '../../context/ThemeContext';
import { 
  User, 
  Music,
  Settings, 
  Shield, 
  Palette, 
  Link as LinkIcon, 
  Lock, 
  Eye, 
  Bell, 
  LogOut, 
  ChevronRight, 
  ChevronDown,
  Loader2,
  Camera, 
  Image as ImageIcon,
  Check,
  AlertCircle,
  Twitter,
  Github,
  Globe,
  Instagram,
  Youtube,
  Facebook,
  MessageSquare,
  Search,
  Zap,
  Sparkles,
  MapPin,
  Mail,
  Smartphone,
  Fingerprint,
  Moon,
  Trash2,
  MoreVertical,
  Plus,
  Compass,
  ArrowLeft,
  X,
  CreditCard,
  History,
  Activity,
  Layers,
  Cpu,
  Monitor,
  Maximize2,
  Save,
  RotateCcw,
  ZoomIn,
  RefreshCw,
  Clock,
  Chrome,
  ShieldCheck,
  Apple,
  Info,
  UserCheck,
  Phone,
  Calendar,
  Database,
  Accessibility,
  Infinity as InfinityIcon,
  Video,
  LifeBuoy,
  Heart,
  Languages as LanguagesIcon,
  Terminal,
  Gem,
  Download
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { InstallModal } from '../pwa/InstallModal';
import { 
  LiquidBackground, 
  DigitalGlow, 
  CyberBadge, 
  DigitalModule,
  HolographicAvatar
} from '../ui/DigitalComponents';
import { DigitalImageEditor } from '../media/DigitalImageEditor';
import { MediaQuality } from '../../services/MediaService';
import { AeirmistAnalyticsDashboard } from './AeirmistAnalyticsDashboard';
import { AeirmistUpgradePanel } from '../marketplace/AeirmistUpgradePanel';
import { AeirmistBillingHistory } from '../marketplace/AeirmistBillingHistory';
import { InfinityPortal } from '../dashboard/InfinityPortal';
import AccountSettings from './sections/AccountSettings';
import PrivacySettings from './sections/PrivacySettings';
import SecuritySettings from './sections/SecuritySettings';
import NotificationSettings from './sections/NotificationSettings';
import MessagingSettings from './sections/MessagingSettings';
import AppearanceSettings from './sections/AppearanceSettings';
import ConnectedAccountsSettings from './sections/ConnectedAccountsSettings';
import StorageSettings from './sections/StorageSettings';
import AccessibilitySettings from './sections/AccessibilitySettings';
import HelpSettings from './sections/HelpSettings';
import { SoundLibrarySettings } from './sections/SoundLibrarySettings';
import CallsSettings from './sections/CallsSettings';
import VaultSettings from './sections/VaultSettings';
import MarketplaceSettings from './sections/MarketplaceSettings';
import SupportSettings from './sections/SupportSettings';
import AboutSettings from './sections/AboutSettings';
import FeedbackSettings from './sections/FeedbackSettings';
import LanguagesSettings from './sections/LanguagesSettings';
import DeveloperSettings from './sections/DeveloperSettings';
import { VerificationSettings } from './sections/VerificationSettings';
import { logger } from '@/src/utils/logger';
import { useBackHandler } from '../../utils/backNavigation';


type SettingsTab = 
  | 'account' 
  | 'privacy' 
  | 'security' 
  | 'verification'
  | 'notifications' 
  | 'messaging' 
  | 'appearance' 
  | 'storage' 
  | 'connected' 
  | 'accessibility' 
  | 'help' 
  | 'sound_library'
  | 'calls'
  | 'vault'
  | 'marketplace'
  | 'support'
  | 'about'
  | 'feedback'
  | 'languages'
  | 'developer';

interface SettingsSystemProps {
  initialSection?: SettingsTab | null;
  onSectionChange?: (section: SettingsTab | null) => void;
}

// Aeirmist Settings System - Settings Config
const SettingsSystem: React.FC<SettingsSystemProps> = ({ initialSection, onSectionChange }) => {
  const { 
    user, 
    profile, 
    logout,
    updateProfile,
    refreshProfile,
    reloadAuthUser,
    deleteAccount,
    generateDeviceLink,
    cameraConfig,
    setCameraConfig,
    addToast,
    localAvatarURL,
    localCoverURL,
    setLocalAvatarURL,
    setLocalCoverURL,
    uploadMedia,
    unlinkAccountMethod,
    linkAccountMethod,
    requestDeleteAccount,
    checkUsernameAvailable,
    mediaSettings,
    setMediaSettings,
  } = useAeirmist();
  const { activeTheme, setTheme, isLoading: isThemeLoading } = useTheme();
  const isLight = activeTheme?.isLight;
  const { isInstallable, install } = usePWAInstall();
  const [installModalOpen, setInstallModalOpen] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const res = await install();
      if (res.outcome !== 'accepted') {
        setInstallModalOpen(true);
      }
    } else {
      setInstallModalOpen(true);
    }
  };

  const [activeTab, setActiveTab] = useState<SettingsTab | null>(() => {
    if (initialSection) return initialSection;
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      return 'account';
    }
    return null;
  });

  useEffect(() => {
    if (initialSection !== undefined && initialSection !== activeTab) {
      setActiveTab(initialSection);
    }
  }, [initialSection]);

  const handleSelectTab = (tab: SettingsTab | null) => {
    setActiveTab(tab);
    onSectionChange?.(tab);
  };
  const sectionMap: Partial<Record<SettingsTab, React.FC<any>>> = {
    account: AccountSettings,
    privacy: PrivacySettings,
    security: SecuritySettings,
    verification: VerificationSettings,
    notifications: NotificationSettings,
    messaging: MessagingSettings,
    appearance: AppearanceSettings,
    storage: StorageSettings,
    connected: ConnectedAccountsSettings,
    accessibility: AccessibilitySettings,
    help: HelpSettings,
    sound_library: SoundLibrarySettings,
    calls: CallsSettings,
    vault: VaultSettings,
    marketplace: MarketplaceSettings,
    support: SupportSettings,
    about: AboutSettings,
    feedback: FeedbackSettings,
    languages: LanguagesSettings,
    developer: DeveloperSettings
  };

  const ActiveSection = sectionMap[activeTab];

  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingImage, setEditingImage] = useState<{ src: string; type: 'avatar' | 'banner' } | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [accountSubView, setAccountSubView] = useState<'main' | 'ownership' | 'choose' | 'deactive_confirm' | 'delete_confirm'>('main');
  const [deleteChoice, setDeleteChoice] = useState<'deactivate' | 'delete'>('deactivate');

  const [copied, setCopied] = useState(false);

  // Intercept back actions for settings dialogs and mobile sub-sections
  useBackHandler(() => {
    if (installModalOpen) {
      setInstallModalOpen(false);
      return true;
    }
    if (showPreview) {
      setShowPreview(false);
      return true;
    }
    if (editingImage) {
      setEditingImage(null);
      return true;
    }
    if (showDeactivateConfirm) {
      setShowDeactivateConfirm(false);
      return true;
    }
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
      return true;
    }
    if (accountSubView !== 'main') {
      setAccountSubView('main');
      return true;
    }
    // On mobile / tablet screens, if inside a section, back returns to the Settings root index
    if (activeTab !== null && typeof window !== 'undefined' && window.innerWidth < 1024) {
      handleSelectTab(null);
      return true;
    }
    return false;
  }, true, 70, [
    installModalOpen,
    showPreview,
    editingImage,
    showDeactivateConfirm,
    showDeleteConfirm,
    accountSubView,
    activeTab
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Initialize form data from profile
  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        username: profile.username || '',
        bio: profile.bio || '',
        tagline: profile.tagline || '',
        relationshipStatus: profile.relationshipStatus || null,
        relationshipStatusVisibility: profile.relationshipStatusVisibility || 'public',
        location: profile.location || '',
        locationData: profile.locationData || null,
        website: profile.website || '',
        pronouns: Array.isArray(profile.pronouns) ? profile.pronouns : (typeof profile.pronouns === 'string' && profile.pronouns ? profile.pronouns.split('·').map(s => s.trim()).filter(Boolean) : []),
        photoURL: profile.photoURL || '',
        bannerURL: profile.bannerURL || '',
        socialLinks: {
          instagram: '',
          twitter: '',
          github: '',
          discord: '',
          facebook: '',
          website: '',
          youtube: '',
          tiktok: '',
          ...(profile.socialLinks || {})
        },
        privacySettings: profile.privacySettings || {
          privateProfile: false,
          showActivity: true,
          allowMessages: 'everyone',
          hideFollowers: false
        },
        themeSettings: profile.themeSettings || {
          accentColor: '#00f2ff',
          glowIntensity: 0.8,
          noiseEffect: true
        },
        isProfileLocked: profile.isProfileLocked || false,
        isProfessional: profile.isProfessional || false,
        fullName: profile.fullName || '',
        phoneNumber: profile.phoneNumber || '',
        phoneCountryCode: profile.phoneCountryCode || '+1',
        phoneVerified: profile.phoneVerified || false,
        pendingEmailChange: profile.pendingEmailChange || null,
        recoveryEmail: profile.recoveryEmail || '',
        recoveryPhone: profile.recoveryPhone || '',
        personalEmail: profile.personalEmail || '',
        gender: profile.gender || '',
        dateOfBirth: profile.dateOfBirth || '',
        category: profile.category || ''
      });
    }
  }, [profile]);

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      await updateProfile(formData);
      await reloadAuthUser().catch(() => {});
      await refreshProfile().catch(() => {});
      setSaveSuccess(true);
      addToast?.({
        title: 'CHANGES SAVED',
        message: 'Your account settings have been saved to the database successfully.',
        type: 'success'
      });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      logger.error("Failed to update profile", e);
      addToast?.({
        title: 'SAVE ERROR',
        message: e?.message || 'Could not save account settings. Please try again.',
        type: 'warning'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    // Sync coverURL and bannerURL for consistency across systems
    if (field === 'coverURL' || field === 'bannerURL') {
      setFormData((prev: any) => ({ ...prev, coverURL: value, bannerURL: value }));
      return;
    }
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSocialChange = (key: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [key]: value }
    }));
  };

  const handleAvatarUpload = () => {
    setCameraConfig({
      isOpen: true,
      mode: 'PHOTO',
      onCapture: async (file: File) => {
        const url = URL.createObjectURL(file);
        setEditingImage({ src: url, type: 'avatar' });
        setCameraConfig(null);
      }
    });
  };

  const handleBannerUpload = () => {
    setCameraConfig({
      isOpen: true,
      mode: 'STORY',
      onCapture: async (file: File) => {
        const url = URL.createObjectURL(file);
        setEditingImage({ src: url, type: 'banner' });
        setCameraConfig(null);
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate size
      const limit = type === 'avatar' ? 10 * 1024 * 1024 : 15 * 1024 * 1024;
      if (file.size > limit) {
        addToast?.({
          title: 'FILE TOO LARGE',
          message: `Your ${type} exceeds the ${type === 'avatar' ? '10MB' : '15MB'} premium quality limit.`,
          type: 'warning'
        });
        return;
      }
      const url = URL.createObjectURL(file);
      setEditingImage({ src: url, type });
    }
  };

  const handleSaveEditedImage = async (blob: Blob) => {
    if (!editingImage || !user) return;
    
    try {
      const file = new File([blob], `aeirmist_${editingImage.type}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      // Set local optimistic URL for global UI consistency
      const localUrl = URL.createObjectURL(blob);
      if (editingImage.type === 'avatar') {
        setLocalAvatarURL(localUrl);
      } else {
        setLocalCoverURL(localUrl);
      }

      const url = await uploadMedia(
        file, 
        `profiles/${user.uid}/${editingImage.type}`, 
        undefined, 
        editingImage.type === 'avatar' ? MediaQuality.PROFILE : MediaQuality.HD
      );
      const field = editingImage.type === 'avatar' ? 'photoURL' : 'bannerURL';
      
      // Update local state and instantly persist to Firebase
      const updateData = editingImage.type === 'avatar' 
        ? { photoURL: url } 
        : { coverURL: url, bannerURL: url };
        
      handleFieldChange(editingImage.type === 'avatar' ? 'photoURL' : 'coverURL', url);
      await updateProfile(updateData);
      
      setEditingImage(null);
      
      // Clear local optimistic URLs after successful persist
      if (editingImage.type === 'avatar') {
        setLocalAvatarURL(null);
      } else {
        setLocalCoverURL(null);
      }
    } catch (e) {
      logger.error("Failed to upload edited image", e);
      setLocalAvatarURL(null);
      setLocalCoverURL(null);
    }
  };

  if (!formData) return null;

  const searchableOptions = [
    { label: 'Display Name', tab: 'account' as SettingsTab, desc: 'Your public name on the network', keywords: 'name display nick real identity' },
    { label: 'Username', tab: 'account' as SettingsTab, desc: 'Your unique identifier', keywords: 'username handle id' },
    { label: 'Bio', tab: 'account' as SettingsTab, desc: 'Write about yourself', keywords: 'bio list status info' },
    { label: 'Connected Accounts', tab: 'connected' as SettingsTab, desc: 'Social bridges and OAuth', keywords: 'social instagram twitter github discord' },
    { label: 'Interface Calibration', tab: 'appearance' as SettingsTab, desc: 'Tune aeirmist visuals, colors, dark mode', keywords: 'theme appearance oled colors' },
    { label: 'Privacy Controls', tab: 'privacy' as SettingsTab, desc: 'Visibility and stealth', keywords: 'private stealth follow block' },
    { label: 'Security & Login', tab: 'security' as SettingsTab, desc: 'Passwords and sessions', keywords: 'security password 2fa sessions' },
    { label: 'Verification', tab: 'verification' as SettingsTab, desc: 'Identity and premium features', keywords: 'verification badge checkmark creator business blue tick' },
    { label: 'Cache & Storage', tab: 'storage' as SettingsTab, desc: 'Usage and data purge', keywords: 'storage cache purge' },
    { label: 'Deactivate / Delete', tab: 'account' as SettingsTab, desc: 'Account management', keywords: 'delete deactivate' },
    { label: 'Sonic Transmission', tab: 'calls' as SettingsTab, desc: 'Audio and video calls', keywords: 'calls phone video voice' },
    { label: 'Secure Vault', tab: 'vault' as SettingsTab, desc: 'Secure data storage', keywords: 'vault encryption secure private lock' },
    { label: 'Digital Marketplace', tab: 'marketplace' as SettingsTab, desc: 'Buy themes and artifacts', keywords: 'shop store marketplace buy pro premium' },
    { label: 'System Support', tab: 'support' as SettingsTab, desc: 'Help and documentation', keywords: 'help support guide documentation' },
    { label: 'Languages', tab: 'languages' as SettingsTab, desc: 'Language and translation', keywords: 'language translate speak dialect' },
    { label: 'Developer Options', tab: 'developer' as SettingsTab, desc: 'Developer options', keywords: 'developer debug kernel advanced' }
  ];

  const filteredSearchOptions = searchQuery.trim() === ''
    ? []
    : searchableOptions.filter(opt => 
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
        opt.keywords.toLowerCase().includes(searchQuery.toLowerCase()) || 
        opt.desc.toLowerCase().includes(searchQuery.toLowerCase())
      );

  return (
    <div className={`flex flex-col min-h-screen w-full relative pb-32 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#06080c] text-white'}`}>
      <LiquidBackground />
      <DigitalGlow />

      <div className="flex-1 flex flex-col lg:flex-row relative z-10 w-full">
        
        {/* Navigation Rail / Sidebar */}
        <div className={`w-full lg:w-80 flex flex-col border-b lg:border-b-0 lg:border-r shrink-0 z-20 transition-all ${
          isLight ? 'border-slate-200 bg-white/90 backdrop-blur-xl shadow-md' : 'border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-xl'
        } ${activeTab !== null ? 'hidden lg:flex' : 'flex'}`}>
          {/* Desktop/Tablet Header */}
          <div className="p-4 md:p-6 lg:p-8 hidden lg:block">
            <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta bg-clip-text text-transparent">Identity Master</h1>
            <p className={`text-[10px] uppercase tracking-[0.3em] mt-1 font-extrabold ${isLight ? 'text-slate-600' : 'text-white/60'}`}>System Settings v2.8</p>
          </div>

          {/* Mobile Settings Home Header */}
          <div className={`p-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] lg:hidden border-b flex items-center justify-between ${
            isLight ? 'border-slate-200 bg-slate-100/80' : 'border-white/10 bg-white/[0.02]'
          }`}>
            <div>
              <h1 className="text-xl font-display font-bold bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta bg-clip-text text-transparent">System Settings</h1>
            </div>
          </div>

          {/* Search bar at the very top */}
          <div className={`p-4 border-b sticky top-0 z-10 ${
            isLight ? 'border-slate-200 bg-white/80' : 'border-white/10 bg-black/20'
          }`}>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings..."
                className={`w-full h-11 pl-10 pr-9 border rounded-xl text-xs font-mono font-medium outline-none transition-all ${
                  isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-aeirmist-cyan focus:bg-white shadow-inner'
                    : 'bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-aeirmist-cyan focus:bg-white/15'
                }`}
              />
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-white/60'}`} size={14} />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-white/60 hover:text-white'}`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>


          <div className={`p-3 md:p-4 space-y-4 pb-28 lg:pb-6 ${activeTab !== null ? 'hidden lg:block' : 'block'}`}>
            {searchQuery.trim() !== '' ? (
              <div className="space-y-2">
                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/30 select-none">
                  Search Results ({filteredSearchOptions.length})
                </div>
                {filteredSearchOptions.length === 0 ? (
                  <div className="py-12 text-center text-white/25 text-[10px] font-mono leading-relaxed">
                    No matching settings found.<br />Try "theme", "verification", or "bio".
                  </div>
                ) : (
                  filteredSearchOptions.map((opt, idx) => (
                    <SettingsTabItem 
                      key={idx}
                      active={activeTab === opt.tab}
                      onClick={() => {
                        setActiveTab(opt.tab);
                        setSearchQuery('');
                      }}
                      icon={
                        opt.tab === 'account' ? <User /> :
                        opt.tab === 'privacy' ? <Lock /> :
                        opt.tab === 'security' ? <Shield /> :
                        opt.tab === 'verification' ? <ShieldCheck /> :
                        opt.tab === 'notifications' ? <Bell /> :
                        opt.tab === 'messaging' ? <MessageSquare /> :
                        opt.tab === 'appearance' ? <Palette /> :
                        opt.tab === 'storage' ? <Database /> :
                        opt.tab === 'connected' ? <LinkIcon /> :
                        opt.tab === 'accessibility' ? <Accessibility /> :
                        opt.tab === 'help' ? <Info /> :
                        opt.tab === 'calls' ? <Phone /> :
                        opt.tab === 'vault' ? <Lock /> :
                        opt.tab === 'marketplace' ? <Sparkles /> :
                        opt.tab === 'support' ? <LifeBuoy /> :
                        opt.tab === 'about' ? <Info /> :
                        opt.tab === 'feedback' ? <MessageSquare /> :
                        opt.tab === 'languages' ? <LanguagesIcon /> :
                        <Terminal />
                      }
                      label={opt.label}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <SettingsSection title="Personal Profile">
                  <SettingsTabItem active={activeTab === 'account'} onClick={() => handleSelectTab('account')} icon={<User />} label="Account" />
                  <SettingsTabItem active={activeTab === 'privacy'} onClick={() => handleSelectTab('privacy')} icon={<Lock />} label="Privacy" />
                  <SettingsTabItem active={activeTab === 'security'} onClick={() => handleSelectTab('security')} icon={<Shield />} label="Security" />
                  <SettingsTabItem active={activeTab === 'verification'} onClick={() => handleSelectTab('verification')} icon={<ShieldCheck />} label="Verification" />
                </SettingsSection>

                <SettingsSection title="Preferences">
                  <SettingsTabItem active={activeTab === 'notifications'} onClick={() => handleSelectTab('notifications')} icon={<Bell />} label="Notifications" />
                  <SettingsTabItem active={activeTab === 'messaging'} onClick={() => handleSelectTab('messaging')} icon={<MessageSquare />} label="Messaging" />
                  <SettingsTabItem active={activeTab === 'calls'} onClick={() => handleSelectTab('calls')} icon={<Phone />} label="Calls" />
                  <SettingsTabItem active={activeTab === 'appearance'} onClick={() => handleSelectTab('appearance')} icon={<Palette />} label="Appearance" />
                  <SettingsTabItem active={activeTab === 'languages'} onClick={() => handleSelectTab('languages')} icon={<LanguagesIcon />} label="Languages" />
                </SettingsSection>

                <SettingsSection title="Storage & Tools">
                  <SettingsTabItem active={activeTab === 'storage'} onClick={() => handleSelectTab('storage')} icon={<Database />} label="Storage & Data" />
                  <SettingsTabItem active={activeTab === 'vault'} onClick={() => handleSelectTab('vault')} icon={<Lock />} label="Private Vault" />
                  <SettingsTabItem active={activeTab === 'sound_library'} onClick={() => handleSelectTab('sound_library')} icon={<Music />} label="Sound Library" />
                  <SettingsTabItem active={activeTab === 'connected'} onClick={() => handleSelectTab('connected')} icon={<LinkIcon />} label="Connected Accounts" />
                </SettingsSection>

                <SettingsSection title="System & Support">
                  {(user?.email?.toLowerCase() === 'junaedislamjim180@gmail.com' || 
                     profile?.email?.toLowerCase() === 'junaedislamjim180@gmail.com' ||
                     profile?.username?.toLowerCase() === 'junaed_islam_jim9' ||
                     profile?.role === 'admin' ||
                     profile?.isAdmin === true) && (
                    <SettingsTabItem 
                      active={false} 
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('aeirmist-navigate', { detail: 'admin' }));
                        if (window.location.pathname !== '/admin-panel') {
                          window.history.pushState({}, '', '/admin-panel');
                        }
                      }} 
                      icon={<ShieldCheck className="text-aeirmist-cyan" />} 
                      label="Control Panel" 
                    />
                  )}
                  <SettingsTabItem active={activeTab === 'marketplace'} onClick={() => handleSelectTab('marketplace')} icon={<Gem />} label="Marketplace" />
                  <SettingsTabItem active={activeTab === 'accessibility'} onClick={() => handleSelectTab('accessibility')} icon={<Accessibility />} label="Accessibility" />
                  <SettingsTabItem active={activeTab === 'help'} onClick={() => handleSelectTab('help')} icon={<Info />} label="Guidelines & Legal" />
                  <SettingsTabItem active={activeTab === 'support'} onClick={() => handleSelectTab('support')} icon={<LifeBuoy />} label="Support" />
                  <SettingsTabItem active={activeTab === 'feedback'} onClick={() => handleSelectTab('feedback')} icon={<MessageSquare />} label="Feedback" />
                  <SettingsTabItem active={activeTab === 'about'} onClick={() => handleSelectTab('about')} icon={<Info />} label="About" />
                  <SettingsTabItem active={activeTab === 'developer'} onClick={() => handleSelectTab('developer')} icon={<Terminal />} label="Developer" />
                  <SettingsTabItem 
                    active={false} 
                    onClick={handleInstallClick} 
                    icon={<Download className="text-aeirmist-cyan" />} 
                    label="Install Phone App" 
                  />
                </SettingsSection>

                {/* Mobile logout option at bottom of vertical menu */}
                <div className="pt-4 lg:hidden">
                  <button 
                    type="button"
                    onClick={logout}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 text-white/60 hover:text-aeirmist-magenta hover:border-aeirmist-magenta/30 hover:bg-aeirmist-magenta/5 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut size={16} />
                      <span className="text-xs font-bold uppercase tracking-widest text-left">Sever Connection</span>
                    </div>
                    <ChevronRight size={14} className="opacity-40 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop/Tablet Bottom Logout Bar */}
          <div className="hidden lg:block p-6 border-t border-white/5 mt-auto">
            <button 
              type="button"
              onClick={logout}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all group ${
                isLight 
                  ? 'bg-slate-100/90 border-slate-200 text-slate-700 hover:text-red-600 hover:border-red-300 hover:bg-red-50' 
                  : 'bg-white/5 border-white/5 text-white/70 hover:text-aeirmist-magenta hover:border-aeirmist-magenta/30 hover:bg-aeirmist-magenta/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <LogOut size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Sever Connection</span>
              </div>
              <ChevronRight size={14} className="opacity-50 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 flex flex-col min-w-0 ${
          activeTab === null ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Header Bar */}
          <div className={`h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] lg:h-16 lg:pt-0 border-b flex items-center justify-between px-4 lg:px-8 backdrop-blur-md shrink-0 sticky top-0 z-30 ${
            isLight ? 'border-slate-200 bg-white/90' : 'border-white/10 bg-black/40'
          }`}>
            <div className="flex items-center gap-2 lg:gap-4">
              {/* Back button on phone and tablet views to go back to settings index */}
              <button 
                type="button"
                onClick={() => handleSelectTab(null)}
                className={`lg:hidden flex items-center justify-center p-2 rounded-xl border transition-all mr-1 ${
                  isLight 
                    ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200' 
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80 hover:text-white'
                }`}
              >
                <ArrowLeft size={16} />
              </button>
              
              <div className={`text-xs lg:text-sm font-extrabold uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {activeTab ? `${activeTab.replace(/^\w/, c => c.toUpperCase())} Settings` : 'Aeirmist Settings'}
              </div>
              <div className={`hidden lg:block h-4 w-[1px] ${isLight ? 'bg-slate-300' : 'bg-white/10'}`} />
              <div className="hidden sm:flex gap-2">
                <StatusChip label="Encrypted" icon={Shield} />
                <StatusChip label="Online" icon={Activity} />
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-4">
              <button 
                type="button"
                onClick={handleUpdate}
                disabled={isSaving}
                className={`px-4 lg:px-6 py-2 rounded-xl text-[10px] lg:text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${
                  saveSuccess 
                    ? 'bg-aeirmist-lime text-black' 
                    : 'bg-aeirmist-cyan text-black hover:scale-105 active:scale-95 neon-glow-cyan'
                }`}
              >
                {isSaving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : saveSuccess ? (
                  <Check size={14} />
                ) : (
                  <Save size={14} />
                )}
                <span className="hidden lg:inline">{isSaving ? 'Syncing...' : saveSuccess ? 'Saved' : 'Save & Apply'}</span>
                <span className="inline lg:hidden">{isSaving ? 'Syncing' : saveSuccess ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>

          <div className={`flex-1 flex flex-col w-full`}>
            {/* Form */}
            <div className="flex-1 p-6 lg:p-12 pb-32">
              <div className={`${activeTab === 'account' ? 'max-w-5xl' : (activeTab === 'notifications' || activeTab === 'marketplace' || activeTab === 'vault') ? 'max-w-4xl' : 'max-w-2xl'} mx-auto space-y-12`}>
                <AnimatePresence mode="wait">
                  {activeTab === 'account' && (
                    <motion.div 
                      key="account" 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                    >
                      <AccountSettings
                        formData={formData}
                        handleFieldChange={handleFieldChange}
                        handleAvatarUpload={handleAvatarUpload}
                        handleBannerUpload={handleBannerUpload}
                        handleFileSelect={handleFileSelect}
                        fileInputRef={fileInputRef}
                        bannerInputRef={bannerInputRef}
                        localAvatarURL={localAvatarURL}
                        localCoverURL={localCoverURL}
                        setLocalAvatarURL={setLocalAvatarURL}
                        setLocalCoverURL={setLocalCoverURL}
                        isSaving={isSaving}
                        saveSuccess={saveSuccess}
                        handleUpdate={handleUpdate}
                        profile={profile}
                        user={user}
                        checkUsernameAvailable={checkUsernameAvailable}
                        unlinkAccountMethod={unlinkAccountMethod}
                        linkAccountMethod={linkAccountMethod}
                        requestDeleteAccount={requestDeleteAccount}
                        deleteAccount={deleteAccount}
                        addToast={addToast}
                        refreshProfile={refreshProfile}
                        reloadAuthUser={reloadAuthUser}
                      />
                    </motion.div>
                  )}

                  {activeTab && activeTab !== 'account' && ActiveSection && (
                    <motion.div 
                      key={activeTab} 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ActiveSection />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Preview Panel (Removed per request) */}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editingImage && (
          <DigitalImageEditor 
            imageSrc={editingImage.src}
            aspectRatio={editingImage.type === 'avatar' ? 1 : 3}
            onSave={handleSaveEditedImage}
            onCancel={() => setEditingImage(null)}
          />
        )}

        {/* Deactivate Account Core Modal */}
        {showDeactivateConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass-panel max-w-sm w-full p-8 rounded-[2.5rem] border-red-500/20 text-center relative z-10"
            >
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-100 mx-auto mb-4">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-lg font-display font-bold mb-2 uppercase tracking-wider text-white">Deactivate Sync?</h3>
              <p className="text-[11px] text-white/55 leading-relaxed mb-6">
                Deactivating temporary suspends your profile. Your feed items, videos, and chat routes will not be visible to other users. You can reactivate anytime.
              </p>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowDeactivateConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-white/60 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    setIsDeactivating(true);
                    try {
                      await updateProfile({ isDeactivated: true });
                    } catch (e) {
                      logger.error("Failed to deactivate profile", e);
                    } finally {
                      setIsDeactivating(false);
                      setShowDeactivateConfirm(false);
                    }
                  }}
                  disabled={isDeactivating}
                  className="flex-1 py-3 rounded-xl bg-red-950 border border-red-500/30 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:brightness-110"
                >
                  {isDeactivating ? 'Deactivating...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Account Core Modal */}
        {showDeleteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass-panel max-w-sm w-full p-8 rounded-[2.5rem] border-[#ff003c]/20 text-center relative z-10"
            >
              <div className="w-12 h-12 bg-[#ff003c]/10 rounded-2xl flex items-center justify-center text-[#ff003c] mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-display font-bold mb-2 uppercase tracking-wider text-white">Vaporize Account?</h3>
              <p className="text-[11px] text-white/55 leading-relaxed mb-6 flex flex-col gap-1">
                <span>WARNING: This operation is final. Everything will be permanently scrubbed from the active cloud, releasing your registered username.</span>
              </p>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-white/60 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10"
                >
                  Abort
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await deleteAccount();
                    } catch (e) {
                      logger.error("Failed to delete account", e);
                    } finally {
                      setIsDeleting(false);
                      setShowDeleteConfirm(false);
                    }
                  }}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl bg-[#ff003c] text-black text-[10px] font-black uppercase tracking-widest hover:brightness-110"
                >
                  {isDeleting ? 'Purging Net...' : 'Vaporize Core'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <InstallModal isOpen={installModalOpen} onClose={() => setInstallModalOpen(false)} />
    </div>
  );
};

// UI Components
const FeatureCard = ({ icon, title, desc }: any) => (
  <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all group">
    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h4 className="text-sm font-bold uppercase tracking-widest text-white mb-2">{title}</h4>
    <p className="text-[10px] text-white/40 leading-relaxed">{desc}</p>
  </div>
);

const ManualEntry = ({ number, title, content }: any) => (
  <div className="flex gap-4 p-4 rounded-2xl hover:bg-white/[0.02] transition-all group">
    <div className="text-[10px] font-mono text-aeirmist-cyan font-bold pt-1">{number}</div>
    <div className="space-y-1">
      <h5 className="text-[11px] font-bold uppercase tracking-wider text-white/80 group-hover:text-white transition-colors">{title}</h5>
      <p className="text-[10px] text-white/40 leading-relaxed lowercase italic line-clamp-2 group-hover:line-clamp-none group-hover:text-white/60 transition-all">{content}</p>
    </div>
  </div>
);

const TabLabel = ({ label }: { label: string }) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  return (
    <div className={`hidden md:block px-4 py-4 text-[9px] font-black uppercase tracking-[0.3em] select-none whitespace-nowrap ${
      isLight ? 'text-slate-600' : 'text-white/60'
    }`}>
      {label}
    </div>
  );
};

const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  return (
    <div className="space-y-1 mb-6 last:mb-20">
      <div className={`px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] select-none ${isLight ? 'text-slate-400' : 'text-white/30'}`}>
        {title}
      </div>
      <div className="space-y-1 px-1">
        {children}
      </div>
    </div>
  );
};

const SettingsTabItem = ({ active, onClick, icon, label }: any) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;

  return (
    <button 
      onClick={onClick}
      type="button"
      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all group cursor-pointer border ${
        active 
          ? isLight
            ? 'bg-aeirmist-cyan text-white border-aeirmist-cyan shadow-lg shadow-aeirmist-cyan/20'
            : 'bg-[#00f3ff] text-black border-[#00f3ff] shadow-lg shadow-[#00f3ff]/20'
          : isLight 
            ? 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50 hover:border-slate-200' 
            : 'bg-white/[0.02] border-white/5 text-white/70 hover:text-white hover:bg-white/5 hover:border-white/10'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`shrink-0 transition-all duration-300 ${
          active 
            ? isLight ? 'text-white' : 'text-black' 
            : isLight ? 'text-slate-400 group-hover:text-aeirmist-cyan' : 'text-white/30 group-hover:text-[#00f3ff]'
        }`}>
          {React.cloneElement(icon as any, { size: 18, strokeWidth: 2.5 })}
        </div>
        <div className={`text-[12px] font-black uppercase tracking-widest truncate transition-colors ${
          active 
            ? isLight ? 'text-white' : 'text-black' 
            : isLight ? 'text-slate-800' : 'text-white'
        }`}>
          {label}
        </div>
      </div>
      <div className="flex items-center shrink-0">
        <ChevronRight size={14} className={`transition-all duration-300 ${
          active 
            ? isLight ? 'text-white/70' : 'text-black/50' 
            : isLight ? 'text-slate-300 group-hover:translate-x-1' : 'text-white/10 group-hover:translate-x-1 group-hover:text-[#00f3ff]'
        }`} />
      </div>
    </button>
  );
};

const StatusChip = ({ label, icon: Icon }: any) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-bold uppercase tracking-tighter ${
      isLight ? 'bg-slate-200/80 border-slate-300 text-slate-800' : 'bg-white/10 border-white/20 text-white/80'
    }`}>
      <Icon size={10} />
      {label}
    </div>
  );
};

const SectionTitle = ({ title, desc }: any) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  return (
    <div className="space-y-1">
      <h2 className={`text-3xl font-display font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{title}</h2>
      <p className={`text-xs uppercase tracking-widest font-semibold ${isLight ? 'text-slate-600' : 'text-white/70'}`}>{desc}</p>
    </div>
  );
};

const Label = ({ text }: { text: string }) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  return (
    <label className={`block text-[10.5px] font-extrabold uppercase tracking-[0.25em] ml-1 mb-2 ${
      isLight ? 'text-slate-700' : 'text-white/80'
    }`}>
      {text}
    </label>
  );
};

const AeirmistInput = ({ label, value, onChange, placeholder, icon: Icon, disabled }: any) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  return (
    <div className="space-y-2">
      <Label text={label} />
      <div className={`relative transition-all ${disabled ? 'opacity-50 grayscale' : ''}`}>
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-white/60'}`}>
          {Icon}
        </div>
        <input 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full h-12 pl-11 pr-4 border rounded-xl text-sm font-medium focus:border-aeirmist-cyan focus:outline-none transition-all ${
            isLight
              ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus:bg-white shadow-xs'
              : 'bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/15'
          }`}
        />
      </div>
    </div>
  );
};

const AeirmistTextarea = ({ label, value, onChange, placeholder, maxLength }: any) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <Label text={label} />
        <span className={`text-[9px] font-mono mb-2 ${isLight ? 'text-slate-500' : 'text-white/60'}`}>
          {value.length}/{maxLength} cycles
        </span>
      </div>
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={4}
        className={`w-full p-4 border rounded-2xl text-sm font-medium focus:border-aeirmist-cyan focus:outline-none transition-all resize-none ${
          isLight
            ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 shadow-xs'
            : 'bg-white/10 border-white/20 text-white placeholder:text-white/60'
        }`}
      />
    </div>
  );
};

const SocialInput = ({ icon, label, value, onChange }: any) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  return (
    <div className="flex items-center gap-4 group">
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center group-hover:text-aeirmist-cyan group-hover:border-aeirmist-cyan/50 transition-all ${
        isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white/10 border-white/20 text-white/70'
      }`}>
         {icon}
      </div>
      <div className="flex-1">
        <input 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label} handle...`}
          className={`w-full h-12 bg-transparent border-b text-xs focus:border-aeirmist-cyan outline-none transition-all font-mono font-medium ${
            isLight ? 'border-slate-300 text-slate-900 placeholder:text-slate-500' : 'border-white/20 text-white placeholder:text-white/60'
          }`}
        />
      </div>
    </div>
  );
};

const ToggleItem = ({ label, desc, enabled, onChange }: any) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  return (
    <div 
      onClick={() => onChange?.(!enabled)}
      className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer group ${
        isLight
          ? 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
      }`}
    >
      <div>
        <div className={`text-[11px] font-extrabold uppercase tracking-widest ${isLight ? 'text-slate-900 group-hover:text-slate-950' : 'text-white/90 group-hover:text-white'}`}>{label}</div>
        <div className={`text-[9.5px] font-semibold mt-0.5 ${isLight ? 'text-slate-600' : 'text-white/70'}`}>{desc}</div>
      </div>
      <div className={`w-10 h-5 rounded-full p-1 transition-all ${enabled ? 'bg-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.3)]' : isLight ? 'bg-slate-300' : 'bg-white/20'}`}>
         <div className={`w-3 h-3 rounded-full transition-all ${enabled ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white'}`} />
      </div>
    </div>
  );
};

// Profile Preview Sub-component
const ProfilePreview = ({ formData, activeTheme }: any) => {
  return (
    <div className="w-full rounded-[2.5rem] bg-aeirmist-bg border border-white/10 overflow-hidden shadow-2xl relative">
      {/* Banner */}
      <div className="h-40 relative group overflow-hidden">
        {formData.bannerURL ? (
          <img src={formData.bannerURL} className="w-full h-full object-cover" alt="preview-banner" />
        ) : (
          <div className="w-full h-full" style={{ background: `linear-gradient(45deg, ${activeTheme.primary}, ${activeTheme.secondary})`, opacity: 0.2 }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-aeirmist-bg via-transparent to-transparent" />
      </div>

      {/* Profile Content */}
      <div className="px-6 pb-8 -mt-20 relative z-10 flex flex-col items-center text-center">
        <HolographicAvatar 
          src={getAvatarUrl(formData.photoURL)} 
          size={110} 
        />

        <div className="space-y-1 mt-2">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {formData.displayName || 'Unnamed User'}
            <div className="w-4 h-4 rounded-full bg-aeirmist-cyan flex items-center justify-center text-black">
               <Check size={10} />
            </div>
          </h2>
          <div className="text-aeirmist-cyan font-mono text-sm">@{formData.username || 'username'}</div>
        </div>

        <div className="mt-4 text-[13px] text-white/70 leading-relaxed italic">
          {formData.bio || 'Your bio will manifest here...'}
        </div>

        {formData.tagline && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-aeirmist-magenta">
             <Zap size={10} /> {formData.tagline}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap gap-4 text-white/40 text-[11px]">
          {formData.location && <div className="flex items-center gap-2"><MapPin size={14}/> {formData.location}</div>}
          {formData.website && <div className="flex items-center gap-2 font-mono"><Globe size={14}/> {formData.website}</div>}
          {(Array.isArray(formData.pronouns) ? formData.pronouns.length > 0 : formData.pronouns) && <div className="flex items-center gap-2"><Info size={14}/> {Array.isArray(formData.pronouns) ? formData.pronouns.join(' · ') : formData.pronouns}</div>}
        </div>

        <div className="mt-8 flex gap-3">
          <button onClick={() => logger.info("Action coming soon")} className="flex-1 h-11 rounded-xl bg-aeirmist-cyan text-black text-xs font-bold uppercase tracking-widest neon-glow-cyan">Follow</button>
          <button onClick={() => logger.info("Action coming soon")} className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-widest">Message</button>
        </div>

        <div className="mt-6 flex justify-around py-4 rounded-2xl bg-white/[0.02]">
           <div className="text-center">
             <div className="text-lg font-bold text-white">4.2k</div>
             <div className="text-[10px] text-white/40 uppercase tracking-widest">Artifacts</div>
           </div>
           <div className="text-center">
             <div className="text-lg font-bold text-white">128k</div>
             <div className="text-[10px] text-white/40 uppercase tracking-widest">Resonating</div>
           </div>
           <div className="text-center">
             <div className="text-lg font-bold text-white">1.0b</div>
             <div className="text-[10px] text-white/40 uppercase tracking-widest">Aeirmist</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsSystem;
