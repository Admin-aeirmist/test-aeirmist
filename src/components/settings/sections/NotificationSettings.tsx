import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { useTheme } from '../../../context/ThemeContext';
import { logger } from '@/src/utils/logger';

import { 
  Bell, 
  Smartphone, 
  MessageSquare, 
  UserPlus, 
  ShoppingBag, 
  Users, 
  RefreshCw, 
  Mail, 
  Volume2, 
  Eye, 
  Moon, 
  Hash, 
  History, 
  Sliders, 
  UserX, 
  AlertTriangle, 
  Play, 
  Trash2, 
  Check, 
  X, 
  ChevronDown, 
  SlidersHorizontal,
  Info
} from 'lucide-react';

const DEFAULT_SETTINGS = {
  masterEnabled: true,
  pushEnabled: true,
  
  // Section 2: Messages
  messageRequests: true,
  newMessages: true,
  messageReactions: true,
  mentionsInChat: true,
  voiceCalls: true,
  videoCalls: true,
  missedCalls: true,
  typingIndicators: false,

  // Section 3: Social Activity
  newFollowers: true,
  followRequests: true,
  acceptedRequests: true,
  profileVisits: true,
  postLikes: true,
  comments: true,
  commentReplies: true,
  mentions: true,
  tags: true,
  reposts: true,
  notesReactions: true,
  storyReplies: true,
  storyMentions: true,
  storyReactions: true,

  // Section 4: Marketplace
  marketplaceNewMessages: true,
  orderUpdates: true,
  offerAccepted: true,
  offerDeclined: true,
  priceUpdates: true,
  itemSold: true,
  itemPurchased: true,

  // Section 5: Groups & Communities
  groupMentions: true,
  groupMessages: true,
  roleUpdates: true,
  communityInvites: true,
  events: true,

  // Section 6: App Updates
  newFeatures: true,
  maintenance: true,
  versionUpdates: true,
  announcements: true,
  tips: true,
  recommendations: false,

  // Section 7: Email Notifications
  emailSecurityAlerts: true,
  emailPasswordChanges: true,
  emailLoginAlerts: true,
  emailNewDeviceLogin: true,
  emailWeeklyDigest: true,
  emailMonthlySummary: true,
  emailMarketingEmails: false,
  emailNewsletter: false,

  // Section 8: Sound & Vibration
  soundEnabled: true,
  notificationSound: 'default_chime',
  vibrationEnabled: true,
  silentMode: false,
  doNotDisturb: false,

  // Section 9: Notification Preview
  previewMode: 'full', // 'full' | 'sender' | 'hidden' | 'none'
  lockScreenPreview: 'unlocked', // 'always' | 'unlocked' | 'never'

  // Section 10: Quiet Hours
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  timezone: 'UTC',
  allowCallsDuringQuietHours: false,
  emergencyNotifications: true,

  // Section 11: Badge Counter
  appIconBadge: true,
  unreadCounter: true,

  // Section 12: Notification History
  keepHistoryDays: 30, // 30 | 90

  // Section 13: Priority Notifications
  priorityPinned: true,
  priorityFavorites: true,
  priorityCloseFriends: true,
  priorityVerified: false,
};

export default function NotificationSettings() {
  const { profile, updateProfile, addToast } = useAeirmist();
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;

  // Load settings from profile, fallback to defaults
  const [settings, setSettings] = useState<typeof DEFAULT_SETTINGS>(() => ({
    ...DEFAULT_SETTINGS,
    ...(profile?.notificationSettings || {})
  }));

  const [isSyncing, setIsSyncing] = useState(false);
  const [activeModal, setActiveModal] = useState<'clearHistory' | 'resetDefaults' | 'manageMutedUsers' | 'manageMutedChats' | 'manageMutedGroups' | null>(null);

  // Lists for local management in Blocked section
  const [mutedUsers, setMutedUsers] = useState([
    { id: '1', displayName: 'Apex_Vortex', tag: '@apex_v', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=120' },
    { id: '2', displayName: 'Ghost_Protocol', tag: '@ghost_p', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120' }
  ]);
  const [mutedChats, setMutedChats] = useState([
    { id: '101', name: 'Zeta Grid Feed', desc: 'Sparsely active transmission route', avatar: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=120' },
    { id: '102', name: 'Secondary Comms Terminal', desc: 'System log dump chat', avatar: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=120' }
  ]);
  const [mutedGroups, setMutedGroups] = useState([
    { id: '201', name: 'Neon Outlaws Club', members: '48 nodes', avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=120' },
    { id: '202', name: 'Night Aesthetics', members: '1,240 nodes', avatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=120' }
  ]);

  const rollbackRef = useRef<typeof DEFAULT_SETTINGS | null>(null);

  // Sync profile update with debouncing
  useEffect(() => {
    const profileSettings = profile?.notificationSettings || {};
    
    // Check if there are actual changes
    const keys = Object.keys(DEFAULT_SETTINGS) as Array<keyof typeof DEFAULT_SETTINGS>;
    const hasChanged = keys.some(key => {
      return JSON.stringify(settings[key]) !== JSON.stringify(profileSettings[key]);
    });

    if (!hasChanged) return;

    // Set rollback fallback to current database state
    if (!rollbackRef.current) {
      rollbackRef.current = profileSettings as typeof DEFAULT_SETTINGS;
    }

    const timer = setTimeout(async () => {
      setIsSyncing(true);
      try {
        await updateProfile({ notificationSettings: settings });
        rollbackRef.current = settings; // Succesful save, update rollback anchor
        addToast({
          type: 'success',
          title: 'SETTINGS SYNCED',
          message: 'Notification preferences synced successfully.'
        });
      } catch (error: any) {
        // Rollback state on error
        if (rollbackRef.current) {
          setSettings({ ...DEFAULT_SETTINGS, ...rollbackRef.current });
        }
        addToast({
          type: 'warning',
          title: 'SYNC FAILURE',
          message: error?.message || 'Could not sync settings. Rolled back.'
        });
      } finally {
        setIsSyncing(false);
      }
    }, 1200); // Debounce consecutive changes

    return () => clearTimeout(timer);
  }, [settings, profile?.notificationSettings]);

  // Audio preview chime
  const playSoundPreview = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      // Dual chime futuristic note
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1); // G5
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      logger.warn("Audio Context failure:", e);
    }
  };

  const toggleSetting = (key: keyof typeof DEFAULT_SETTINGS) => {
    // If master is disabled, block editing of other options (except master itself)
    if (key !== 'masterEnabled' && !settings.masterEnabled) return;
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (key: keyof typeof DEFAULT_SETTINGS, val: any) => {
    if (!settings.masterEnabled) return;
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleResetBadge = () => {
    addToast({
      type: 'success',
      title: 'BADGE RECALIBRATED',
      message: 'App badge counter successfully recalibrated to zero.'
    });
  };

  const handleClearHistory = () => {
    setActiveModal(null);
    addToast({
      type: 'success',
      title: 'HISTORY CLEARED',
      message: 'All historical notification logs deleted.'
    });
  };

  const handleResetDefaults = async () => {
    setActiveModal(null);
    try {
      setSettings(DEFAULT_SETTINGS);
      await updateProfile({ notificationSettings: DEFAULT_SETTINGS });
      addToast({
        type: 'success',
        title: 'SETTINGS RECONSTRUCTED',
        message: 'Notification configurations restored to default state.'
      });
    } catch (e: any) {
      addToast({
        type: 'warning',
        title: 'RESET FAILED',
        message: e?.message || 'Failed to restore default settings.'
      });
    }
  };

  // State modifiers for muted item lists
  const handleUnmuteUser = (id: string) => {
    setMutedUsers(prev => prev.filter(u => u.id !== id));
    addToast({
      type: 'success',
      title: 'USER UNMUTED',
      message: 'User notifications successfully active.'
    });
  };

  const handleUnmuteChat = (id: string) => {
    setMutedChats(prev => prev.filter(c => c.id !== id));
    addToast({
      type: 'success',
      title: 'CHAT UNMUTED',
      message: 'Conversation notifications successfully active.'
    });
  };

  const handleUnmuteGroup = (id: string) => {
    setMutedGroups(prev => prev.filter(g => g.id !== id));
    addToast({
      type: 'success',
      title: 'GROUP UNMUTED',
      message: 'Group notifications successfully active.'
    });
  };

  // Switch UI subcomponent
  const Switch = ({ enabled, active = true, onClick }: { enabled: boolean, active?: boolean, onClick: () => void }) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (active) onClick(); }}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-aeirmist-cyan focus:ring-offset-2 ${
        isLight ? 'focus:ring-offset-white' : 'focus:ring-offset-[#07090e]'
      } ${
        enabled ? 'bg-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.4)]' : (isLight ? 'bg-slate-200' : 'bg-white/10')
      } ${!active ? 'opacity-30 cursor-not-allowed' : ''}`}
      aria-label="Toggle preference"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  // Settings Row Container
  const SettingRow = ({ 
    icon: IconComponent, 
    title, 
    desc, 
    enabled, 
    keyName, 
    disabled = false 
  }: { 
    icon: React.ComponentType<any>, 
    title: string, 
    desc: string, 
    enabled: boolean, 
    keyName: keyof typeof DEFAULT_SETTINGS, 
    disabled?: boolean 
  }) => {
    const isRowDisabled = disabled || (!settings.masterEnabled && keyName !== 'masterEnabled');
    return (
      <div 
        onClick={() => { if (!isRowDisabled) toggleSetting(keyName); }}
        className={`flex items-center justify-between py-2 px-3.5 rounded-xl border transition-all ${
          isRowDisabled 
            ? 'opacity-40 cursor-not-allowed bg-black/10 border-transparent' 
            : `cursor-pointer ${isLight ? 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm' : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.03]'}`
        }`}
      >
        <div className="flex items-center gap-3 pr-4 min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${enabled && !isRowDisabled ? 'bg-aeirmist-cyan/10 text-aeirmist-cyan shadow-[0_0_10px_rgba(0,242,255,0.15)]' : (isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/40')}`}>
            <IconComponent size={14} />
          </div>
          <h4 className={`text-[11px] font-bold uppercase tracking-wider truncate ${isLight ? 'text-slate-700' : 'text-white/90'}`}>{title}</h4>
        </div>
        <Switch enabled={enabled} active={!isRowDisabled} onClick={() => toggleSetting(keyName)} />
      </div>
    );
  };

  return (
    <div className="space-y-8 select-none">
      
      {/* Header Container */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 md:p-8 rounded-[2rem] bg-gradient-to-r from-aeirmist-cyan/5 via-transparent to-transparent border border-white/5 relative overflow-hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-aeirmist-cyan/15 flex items-center justify-center text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)]">
              <Bell size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-display font-black tracking-wider text-white uppercase">Notifications</h2>
              <p className="text-[10px] font-mono text-aeirmist-cyan uppercase tracking-widest">Acoustic & Connections Config</p>
            </div>
          </div>
          <p className="text-xs text-white/50 leading-relaxed max-w-md pt-2">
            Configure transmission settings, silent schedules, alerts, and feedback parameters for your active node.
          </p>
        </div>

        {/* Sync Indicator / Master Switch */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 text-[9px] font-mono text-aeirmist-cyan">
                <RefreshCw size={10} className="animate-spin" />
                Syncing Grid...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-aeirmist-lime/10 border border-aeirmist-lime/20 text-[9px] font-mono text-aeirmist-lime">
                <Check size={10} />
                Synced
              </span>
            )}
          </div>
          
          {/* Master Notification Toggle */}
          <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
            <div className="text-right">
              <span className="block text-[10px] font-bold text-white uppercase tracking-wider">Master Control</span>
              <span className="block text-[8px] text-white/30 italic">Disable all incoming pings</span>
            </div>
            <Switch 
              enabled={settings.masterEnabled} 
              onClick={() => toggleSetting('masterEnabled')} 
            />
          </div>
        </div>
      </div>

      {/* Global Disable Warning Overlay */}
      {!settings.masterEnabled && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5 animate-bounce" />
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Silent Override Active</p>
            <p className="text-[10px] text-amber-200/50 leading-relaxed">
              Master control is toggled OFF. All general alerts are muted. Important system security logs and identity changes will bypass this filter.
            </p>
          </div>
        </div>
      )}

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Section 1: Push Notifications */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="text-aeirmist-cyan shrink-0" size={16} />
                <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Device Push Channel</h3>
              </div>
              <Switch 
                enabled={settings.pushEnabled && settings.masterEnabled} 
                active={settings.masterEnabled} 
                onClick={() => toggleSetting('pushEnabled')} 
              />
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed italic">
              Receive live alerts, instant messages, and transmissions directly on this screen when the application is minimized.
            </p>
          </div>
        </div>

        {/* Section 2: Messages */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <MessageSquare className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Direct Messages</h3>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <SettingRow icon={MessageSquare} title="New Messages" desc="Receive notification for incoming signals" enabled={settings.newMessages} keyName="newMessages" />
              <SettingRow icon={MessageSquare} title="Message Requests" desc="Alert for requests from untrusted profiles" enabled={settings.messageRequests} keyName="messageRequests" />
              <SettingRow icon={MessageSquare} title="Message Reactions" desc="Reactions appended to your transmissions" enabled={settings.messageReactions} keyName="messageReactions" />
              <SettingRow icon={MessageSquare} title="Mentions in Chat" desc="When tagged inside active communications" enabled={settings.mentionsInChat} keyName="mentionsInChat" />
              <SettingRow icon={MessageSquare} title="Voice Call Requests" desc="Acoustic call invitations" enabled={settings.voiceCalls} keyName="voiceCalls" />
              <SettingRow icon={MessageSquare} title="Video Call Requests" desc="Holographic feed requests" enabled={settings.videoCalls} keyName="videoCalls" />
              <SettingRow icon={MessageSquare} title="Missed Call Logs" desc="Log missing call attempts" enabled={settings.missedCalls} keyName="missedCalls" />
              <SettingRow icon={MessageSquare} title="Typing Indicators" desc="Show real-time typing events" enabled={settings.typingIndicators} keyName="typingIndicators" />
            </div>
          </div>
        </div>

        {/* Section 3: Social Activity */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <UserPlus className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Social Dynamics</h3>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <SettingRow icon={UserPlus} title="New Followers" desc="Notification on successful node follow" enabled={settings.newFollowers} keyName="newFollowers" />
              <SettingRow icon={UserPlus} title="Follow Requests" desc="Requires approval to link" enabled={settings.followRequests} keyName="followRequests" />
              <SettingRow icon={UserPlus} title="Accepted Requests" desc="When another user accepts your follow request" enabled={settings.acceptedRequests} keyName="acceptedRequests" />
              <SettingRow icon={UserPlus} title="Profile Visits" desc="Weekly aggregate summary of visitors" enabled={settings.profileVisits} keyName="profileVisits" />
              <SettingRow icon={UserPlus} title="Post Likes" desc="Pings on artifact appreciation" enabled={settings.postLikes} keyName="postLikes" />
              <SettingRow icon={UserPlus} title="Comments" desc="Comments on your posts" enabled={settings.comments} keyName="comments" />
              <SettingRow icon={UserPlus} title="Comment Replies" desc="Responses to your threads" enabled={settings.commentReplies} keyName="commentReplies" />
              <SettingRow icon={UserPlus} title="Mentions" desc="Explicit profile tagging on other feeds" enabled={settings.mentions} keyName="mentions" />
              <SettingRow icon={UserPlus} title="Tags" desc="Profile tagged directly on media artifacts" enabled={settings.tags} keyName="tags" />
              <SettingRow icon={UserPlus} title="Reposts / Shares" desc="Amplification of your original notes" enabled={settings.reposts} keyName="reposts" />
              <SettingRow icon={UserPlus} title="Notes Reactions" desc="Quick emoji responses on micro-updates" enabled={settings.notesReactions} keyName="notesReactions" />
              <SettingRow icon={UserPlus} title="Story Replies" desc="Direct reply messages from short-lived stories" enabled={settings.storyReplies} keyName="storyReplies" />
              <SettingRow icon={UserPlus} title="Story Mentions" desc="Tagged in another user's story" enabled={settings.storyMentions} keyName="storyMentions" />
              <SettingRow icon={UserPlus} title="Story Reactions" desc="Quick reaction icons on active stories" enabled={settings.storyReactions} keyName="storyReactions" />
            </div>
          </div>
        </div>

        {/* Section 4: Marketplace */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <ShoppingBag className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Marketplace Transactions</h3>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <SettingRow icon={ShoppingBag} title="New Messages" desc="Incoming marketplace inquiry pings" enabled={settings.marketplaceNewMessages} keyName="marketplaceNewMessages" />
              <SettingRow icon={ShoppingBag} title="Order Updates" desc="Tracking, shipping, and receipt details" enabled={settings.orderUpdates} keyName="orderUpdates" />
              <SettingRow icon={ShoppingBag} title="Offer Accepted" desc="When your offer on an item is successful" enabled={settings.offerAccepted} keyName="offerAccepted" />
              <SettingRow icon={ShoppingBag} title="Offer Declined" desc="When your bid is refused by vendor" enabled={settings.offerDeclined} keyName="offerDeclined" />
              <SettingRow icon={ShoppingBag} title="Price Updates" desc="When an item in your wishlist goes on sale" enabled={settings.priceUpdates} keyName="priceUpdates" />
              <SettingRow icon={ShoppingBag} title="Item Sold" desc="Confirmations of successful user item dispatch" enabled={settings.itemSold} keyName="itemSold" />
              <SettingRow icon={ShoppingBag} title="Item Purchased" desc="Receipt confirmation for customer buy transactions" enabled={settings.itemPurchased} keyName="itemPurchased" />
            </div>
          </div>
        </div>

        {/* Section 5: Groups & Communities */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <Users className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Groups & Communities</h3>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <SettingRow icon={Users} title="Group Messages" desc="Pings on messages in multi-node groups" enabled={settings.groupMessages} keyName="groupMessages" />
              <SettingRow icon={Users} title="Group Mentions" desc="Direct tags inside group conversations" enabled={settings.groupMentions} keyName="groupMentions" />
              <SettingRow icon={Users} title="Role Updates" desc="Promotions/Demotions in community structures" enabled={settings.roleUpdates} keyName="roleUpdates" />
              <SettingRow icon={Users} title="Community Invites" desc="Incoming server or group invites" enabled={settings.communityInvites} keyName="communityInvites" />
              <SettingRow icon={Users} title="Events" desc="Scheduled broadcasts and virtual events" enabled={settings.events} keyName="events" />
            </div>
          </div>
        </div>

        {/* Section 6: App Updates */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <RefreshCw className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>App Releases</h3>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <SettingRow icon={RefreshCw} title="New Features" desc="Aesthetic updates & tool upgrades" enabled={settings.newFeatures} keyName="newFeatures" />
              <SettingRow icon={RefreshCw} title="Maintenance" desc="Grid downtimes & calibration schedules" enabled={settings.maintenance} keyName="maintenance" />
              <SettingRow icon={RefreshCw} title="Version Updates" desc="Substantial client patches and build tags" enabled={settings.versionUpdates} keyName="versionUpdates" />
              <SettingRow icon={RefreshCw} title="Announcements" desc="General notices from Aeirmist control" enabled={settings.announcements} keyName="announcements" />
              <SettingRow icon={RefreshCw} title="Tips & Guides" desc="Maximizing user experience walkthroughs" enabled={settings.tips} keyName="tips" />
              <SettingRow icon={RefreshCw} title="Recommendations" desc="Relevant topics curated by matching engines" enabled={settings.recommendations} keyName="recommendations" />
            </div>
          </div>
        </div>

        {/* Section 7: Email Notifications */}
        <div className="space-y-4">
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <Mail className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Email Notifications</h3>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {/* Security alerts must bypass master lock, hence disabled is false, and styled differently */}
              <SettingRow icon={Mail} title="Security Alerts" desc="Device logs, credential changes, and logins (Bypasses silent mode)" enabled={settings.emailSecurityAlerts} keyName="emailSecurityAlerts" disabled={false} />
              <SettingRow icon={Mail} title="Password Changes" desc="Pings when credentials are reset" enabled={settings.emailPasswordChanges} keyName="emailPasswordChanges" />
              <SettingRow icon={Mail} title="Login Alerts" desc="Warning mails on new sessions" enabled={settings.emailLoginAlerts} keyName="emailLoginAlerts" />
              <SettingRow icon={Mail} title="New Device Login" desc="Detailed device log summaries" enabled={settings.emailNewDeviceLogin} keyName="emailNewDeviceLogin" />
              
              <div className={!settings.masterEnabled ? 'opacity-40 pointer-events-none' : ''}>
                <div className="grid grid-cols-1 gap-1.5">
                  <SettingRow icon={Mail} title="Weekly Digest" desc="Weekly timeline interactions summary" enabled={settings.emailWeeklyDigest} keyName="emailWeeklyDigest" />
                  <SettingRow icon={Mail} title="Monthly Summary" desc="Monthly growth stats, points, and earnings" enabled={settings.emailMonthlySummary} keyName="emailMonthlySummary" />
                  <SettingRow icon={Mail} title="Marketing Emails" desc="Updates on partner nodes and credits" enabled={settings.emailMarketingEmails} keyName="emailMarketingEmails" />
                  <SettingRow icon={Mail} title="Newsletter" desc="Insights into decentralized social webs" enabled={settings.emailNewsletter} keyName="emailNewsletter" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 8: Sound & Vibration */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <Volume2 className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Sound & Vibration</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-1.5">
                <SettingRow icon={Volume2} title="Sound Effects" desc="Enable acoustic chimes on alerts" enabled={settings.soundEnabled} keyName="soundEnabled" />
                <SettingRow icon={Volume2} title="Haptic Vibration" desc="Device haptic rumble pulse" enabled={settings.vibrationEnabled} keyName="vibrationEnabled" />
                <SettingRow icon={Volume2} title="Silent Mode" desc="Mute all audio, bypass lights" enabled={settings.silentMode} keyName="silentMode" />
                <SettingRow icon={Volume2} title="Do Not Disturb" desc="Block all interactions except critical locks" enabled={settings.doNotDisturb} keyName="doNotDisturb" />
              </div>

              {/* Sound drop down & preview */}
              <div className="pt-3 border-t border-white/5 space-y-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60">Notification Chime</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <select 
                      value={settings.notificationSound}
                      onChange={(e) => updateField('notificationSound', e.target.value)}
                      className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-xs focus:border-aeirmist-cyan outline-none text-white/80 appearance-none cursor-pointer"
                    >
                      <option value="default_chime">System Chime (Default)</option>
                      <option value="cyber_pulse">Digital Message</option>
                      <option value="low_frequency">Sub-Low Connections</option>
                      <option value="glitch_alert">Glitch Synthesizer</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={playSoundPreview}
                    className="h-11 px-4 rounded-xl bg-aeirmist-cyan/15 border border-aeirmist-cyan/30 text-aeirmist-cyan hover:bg-aeirmist-cyan/25 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                  >
                    <Play size={14} />
                    Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 9: Notification Preview */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <Eye className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Alert Previews</h3>
            </div>
            
            <div className="space-y-4">
              {/* Radio options for preview depth */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60">Display Detail Depth</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'full', label: 'Show Full Message', desc: 'Display sender name, avatar and text contents' },
                    { id: 'sender', label: 'Show Sender Only', desc: 'Obfuscate body context, only show identity' },
                    { id: 'hidden', label: 'Hide Sensitive Content', desc: 'Conceal contents if device lock is active' },
                    { id: 'none', label: 'Hide Message Preview', desc: 'Only show "New Message"' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateField('previewMode', opt.id)}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        settings.previewMode === opt.id 
                          ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan' 
                          : 'bg-white/5 border-white/5 hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        settings.previewMode === opt.id ? 'border-aeirmist-cyan' : 'border-white/20'
                      }`}>
                        {settings.previewMode === opt.id && <div className="w-2 h-2 rounded-full bg-aeirmist-cyan" />}
                      </div>
                      <div>
                        <div className={`text-[11px] font-bold ${settings.previewMode === opt.id ? 'text-aeirmist-cyan' : 'text-white/80'}`}>{opt.label}</div>
                        <div className="text-[9px] text-white/40 leading-normal mt-0.5">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Lock screen dropdown */}
              <div className="pt-3 border-t border-white/5 space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60">Lock Screen Behavior</label>
                <div className="relative">
                  <select
                    value={settings.lockScreenPreview}
                    onChange={(e) => updateField('lockScreenPreview', e.target.value)}
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-xs focus:border-aeirmist-cyan outline-none text-white/80 appearance-none cursor-pointer"
                  >
                    <option value="always">Always Display (High Risk)</option>
                    <option value="unlocked">Unlocked Device Only (Recommended)</option>
                    <option value="never">Never Display</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 10: Quiet Hours */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <Moon className="text-aeirmist-cyan shrink-0" size={16} />
                <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Quiet Hours</h3>
              </div>
              <Switch 
                enabled={settings.quietHoursEnabled && settings.masterEnabled} 
                active={settings.masterEnabled} 
                onClick={() => toggleSetting('quietHoursEnabled')} 
              />
            </div>
            
            <div className={`space-y-4 ${!settings.quietHoursEnabled ? 'opacity-30 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Start Time</label>
                  <input 
                    type="time" 
                    value={settings.quietHoursStart}
                    onChange={(e) => updateField('quietHoursStart', e.target.value)}
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-xs text-white focus:border-aeirmist-cyan outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1.5">End Time</label>
                  <input 
                    type="time" 
                    value={settings.quietHoursEnd}
                    onChange={(e) => updateField('quietHoursEnd', e.target.value)}
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-xs text-white focus:border-aeirmist-cyan outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Timezone Offset</label>
                <div className="relative">
                  <select
                    value={settings.timezone}
                    onChange={(e) => updateField('timezone', e.target.value)}
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-xs text-white focus:border-aeirmist-cyan outline-none appearance-none cursor-pointer"
                  >
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                    <option value="EST">Eastern Standard Time (EST)</option>
                    <option value="GMT">Greenwich Mean Time (GMT)</option>
                    <option value="IST">Indian Standard Time (IST)</option>
                    <option value="BST">Bangladesh Standard Time (BST)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5 pt-2">
                <SettingRow icon={Moon} title="Allow Calls" desc="Accept holographic transmissions in Quiet Hours" enabled={settings.allowCallsDuringQuietHours} keyName="allowCallsDuringQuietHours" />
                <SettingRow icon={Moon} title="Emergency Bypass" desc="Allow priority alerts to punch through block" enabled={settings.emergencyNotifications} keyName="emergencyNotifications" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 11: Badge Counter */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <Hash className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>App Badge Counter</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-1.5">
              <SettingRow icon={Hash} title="App Icon Badge" desc="Display numerical badge on home launcher" enabled={settings.appIconBadge} keyName="appIconBadge" />
              <SettingRow icon={Hash} title="Unread Counter" desc="Save counts across navigation rails" enabled={settings.unreadCounter} keyName="unreadCounter" />
              
              <div className="pt-3 border-t border-white/5 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetBadge}
                  className="py-2.5 px-5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  Recalibrate Badge
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 12: Notification History */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <History className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Historical Logging</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60">History Lifespan</label>
                <div className="relative">
                  <select
                    value={settings.keepHistoryDays}
                    onChange={(e) => updateField('keepHistoryDays', parseInt(e.target.value))}
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-xs focus:border-aeirmist-cyan outline-none text-white/80 appearance-none cursor-pointer"
                  >
                    <option value="30">Keep History for 30 Days</option>
                    <option value="90">Keep History for 90 Days</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveModal('clearHistory')}
                  className="py-2.5 px-5 rounded-xl bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  Purge History Logs
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 13: Priority Notifications */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <Sliders className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Priority Filters</h3>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <SettingRow icon={Sliders} title="Pinned Conversations" desc="Always ping if sender chat is pinned" enabled={settings.priorityPinned} keyName="priorityPinned" />
              <SettingRow icon={Sliders} title="Favorite Nodes" desc="Bypass do-not-disturb for list favorites" enabled={settings.priorityFavorites} keyName="priorityFavorites" />
              <SettingRow icon={Sliders} title="Close Friends Only" desc="Exclusive feed updates from tight circles" enabled={settings.priorityCloseFriends} keyName="priorityCloseFriends" />
              <SettingRow icon={Sliders} title="Verified Nodes" desc="Force notifications from certified profiles" enabled={settings.priorityVerified} keyName="priorityVerified" />
            </div>
          </div>
        </div>

        {/* Section 14: Blocked / Muted Notifications */}
        <div className={`space-y-4 transition-opacity ${!settings.masterEnabled ? 'opacity-40' : ''}`}>
          <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
            <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
              <UserX className="text-aeirmist-cyan shrink-0" size={16} />
              <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Muted Logs</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div>
                  <h4 className="text-xs font-bold text-white/90 uppercase tracking-wide">Muted Profiles</h4>
                  <p className="text-[9px] text-white/40 leading-normal mt-0.5">{mutedUsers.length} profiles temporarily silent</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal('manageMutedUsers')}
                  className="py-2 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[9px] font-bold uppercase tracking-widest transition-all"
                >
                  Manage
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div>
                  <h4 className="text-xs font-bold text-white/90 uppercase tracking-wide">Muted Conversations</h4>
                  <p className="text-[9px] text-white/40 leading-normal mt-0.5">{mutedChats.length} active channels silent</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal('manageMutedChats')}
                  className="py-2 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[9px] font-bold uppercase tracking-widest transition-all"
                >
                  Manage
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div>
                  <h4 className="text-xs font-bold text-white/90 uppercase tracking-wide">Muted Group Dynamics</h4>
                  <p className="text-[9px] text-white/40 leading-normal mt-0.5">{mutedGroups.length} community routes silent</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal('manageMutedGroups')}
                  className="py-2 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[9px] font-bold uppercase tracking-widest transition-all"
                >
                  Manage
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Section 15: Danger Zone */}
      <div className="p-6 rounded-[2.5rem] bg-red-950/5 border border-red-500/20 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-500 shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-red-500">Danger Terminal</h4>
        </div>
        <p className="text-[10px] text-white/40 leading-relaxed">
          Resetting configurations will scrub all custom notification channels, alerts, quiet hours timezone settings, and restore factory defaults.
        </p>
        <div className="flex justify-start">
          <button 
            type="button"
            onClick={() => setActiveModal('resetDefaults')}
            className="px-6 py-3 rounded-xl bg-red-950/30 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
          >
            Reset Preferences
          </button>
        </div>
      </div>

      {/* Overlays / Confirmation Modals */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            {/* Modal Box */}
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass-panel max-w-md w-full p-6 md:p-8 rounded-[2.5rem] border-white/10 text-center relative z-10 bg-[#0b0e14]/75 backdrop-blur-2xl shadow-2xl"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="absolute right-6 top-6 text-white/30 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              {/* Clear History Confirm */}
              {activeModal === 'clearHistory' && (
                <div className="space-y-6">
                  <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-400 mx-auto">
                    <Trash2 size={24} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-md font-display font-bold uppercase tracking-wider text-white">Purge Notification Log?</h3>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      This operation is absolute. It will wipe clean your historical notifications repository. Active alerts inside threads are unchanged.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-white/60 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
                    >
                      Abort
                    </button>
                    <button 
                      type="button"
                      onClick={handleClearHistory}
                      className="flex-1 py-3 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-500 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                    >
                      Purge Logs
                    </button>
                  </div>
                </div>
              )}

              {/* Reset defaults Confirm */}
              {activeModal === 'resetDefaults' && (
                <div className="space-y-6">
                  <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-400 mx-auto">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-md font-display font-bold uppercase tracking-wider text-white">Reset Notifications Config?</h3>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      Are you sure you want to revert all categories, sound preview configs, lock screen detail types, and quiet hours to native system defaults?
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-white/60 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
                    >
                      Abort
                    </button>
                    <button 
                      type="button"
                      onClick={handleResetDefaults}
                      className="flex-1 py-3 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-500 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                    >
                      Reset All
                    </button>
                  </div>
                </div>
              )}

              {/* Manage Muted Users List */}
              {activeModal === 'manageMutedUsers' && (
                <div className="space-y-5 text-left">
                  <div className="flex items-center gap-2 pb-1 border-b border-white/5">
                    <UserX className="text-aeirmist-cyan" size={16} />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white">Muted Profiles</h3>
                  </div>
                  
                  {mutedUsers.length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-white/30 uppercase tracking-widest italic">
                      No muted profiles recorded
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto no-scrollbar space-y-2">
                      {mutedUsers.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5">
                          <div className="flex items-center gap-2.5">
                            <img src={user.avatar} className="w-8 h-8 rounded-lg object-cover" alt="" />
                            <div>
                              <div className={`text-xs font-bold ${isLight ? "text-slate-800" : "text-white/95"}`}>{user.displayName}</div>
                              <div className="text-[9px] text-white/30 font-mono">{user.tag}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnmuteUser(user.id)}
                            className="py-1.5 px-3 rounded-lg bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 text-aeirmist-cyan hover:bg-aeirmist-cyan hover:text-black text-[9px] font-bold uppercase tracking-wider transition-all"
                          >
                            Unmute
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-white/5">
                    <button 
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="py-2.5 px-5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              )}

              {/* Manage Muted Chats List */}
              {activeModal === 'manageMutedChats' && (
                <div className="space-y-5 text-left">
                  <div className="flex items-center gap-2 pb-1 border-b border-white/5">
                    <MessageSquare className="text-aeirmist-cyan" size={16} />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white">Muted Communication Routes</h3>
                  </div>
                  
                  {mutedChats.length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-white/30 uppercase tracking-widest italic">
                      No muted conversation streams
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto no-scrollbar space-y-2">
                      {mutedChats.map(chat => (
                        <div key={chat.id} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5">
                          <div className="flex items-center gap-2.5">
                            <img src={chat.avatar} className="w-8 h-8 rounded-lg object-cover" alt="" />
                            <div>
                              <div className={`text-xs font-bold ${isLight ? "text-slate-800" : "text-white/95"}`}>{chat.name}</div>
                              <div className="text-[9px] text-white/40">{chat.desc}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnmuteChat(chat.id)}
                            className="py-1.5 px-3 rounded-lg bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 text-aeirmist-cyan hover:bg-aeirmist-cyan hover:text-black text-[9px] font-bold uppercase tracking-wider transition-all"
                          >
                            Unmute
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-white/5">
                    <button 
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="py-2.5 px-5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              )}

              {/* Manage Muted Groups List */}
              {activeModal === 'manageMutedGroups' && (
                <div className="space-y-5 text-left">
                  <div className="flex items-center gap-2 pb-1 border-b border-white/5">
                    <Users className="text-aeirmist-cyan" size={16} />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white">Muted Group Dynamics</h3>
                  </div>
                  
                  {mutedGroups.length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-white/30 uppercase tracking-widest italic">
                      No silent group chats
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto no-scrollbar space-y-2">
                      {mutedGroups.map(group => (
                        <div key={group.id} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5">
                          <div className="flex items-center gap-2.5">
                            <img src={group.avatar} className="w-8 h-8 rounded-lg object-cover" alt="" />
                            <div>
                              <div className={`text-xs font-bold ${isLight ? "text-slate-800" : "text-white/95"}`}>{group.name}</div>
                              <div className="text-[9px] text-white/40">{group.members}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnmuteGroup(group.id)}
                            className="py-1.5 px-3 rounded-lg bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 text-aeirmist-cyan hover:bg-aeirmist-cyan hover:text-black text-[9px] font-bold uppercase tracking-wider transition-all"
                          >
                            Unmute
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-white/5">
                    <button 
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="py-2.5 px-5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
