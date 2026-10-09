import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { 
  MessageSquare, 
  Users, 
  UserX, 
  ShieldCheck, 
  Mail, 
  Eye, 
  Hash, 
  History, 
  Sliders, 
  AlertTriangle, 
  Trash2, 
  Check, 
  X, 
  ChevronDown, 
  Info,
  ShieldAlert,
  KeyRound,
  Smartphone,
  Settings,
  Save,
  Lock,
  ArrowLeft,
  Image as LucideImage,
  Sparkles,
  Database,
  Wifi,
  SlidersHorizontal,
  CloudUpload,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Volume2,
  FileText,
  Video,
  Phone,
  CheckCircle2,
  LockKeyhole,
  Zap,
  MoreVertical,
  Plus,
  Compass,
  ArrowRight,
  Monitor,
  Maximize2,
  RotateCw,
  Search,
  Bell,
  Fingerprint,
  Accessibility,
  Database as StorageIcon,
  Shield,
  Clock,
  LayoutGrid,
  Archive,
  Pin,
  Smile,
  ExternalLink,
  Keyboard,
  PlayCircle,
  FastForward,
  MessageCircle,
  Wallpaper,
  Edit3
} from 'lucide-react';

const DEFAULT_MESSAGING_SETTINGS = {
  // 1. Privacy & Requests
  whoCanMessageMe: 'followers', // 'everyone' | 'followers' | 'mutual' | 'nobody'
  allowMessageRequests: true,
  autoFilterSpam: true,
  autoDeleteSpamDays: 30,
  showSenderProfile: true,
  
  // 2. Chat Experience
  readReceipts: true,
  typingIndicator: true,
  showOthersTyping: true,
  onlineStatus: true,
  lastSeen: 'followers', // 'everyone' | 'followers' | 'nobody'
  messagePreview: true,
  enableChatHeads: true,

  // 3. Media & Uploads
  uploadQuality: 'high', // 'original' | 'high' | 'balanced' | 'data_saver'
  autoDownloadPhotos: true,
  autoDownloadVideos: false,
  autoDownloadVoiceNotes: true,
  autoDownloadFiles: false,
  autoDownloadOn: 'wifi', // 'wifi' | 'mobile' | 'never'
  cameraQuality: 'hd', // 'standard' | 'hd' | 'original'

  // 4. Calls
  allowVoiceCalls: true,
  allowVideoCalls: true,
  whoCanCallMe: 'followers', // 'everyone' | 'followers' | 'mutual' | 'nobody'
  noiseSuppression: true,
  echoCancellation: true,
  autoSpeaker: false,
  autoCameraOff: false,

  // 5. Chat Organization
  defaultChatFilter: 'all', // 'all' | 'unread' | 'personal' | 'marketplace' | 'archived'
  autoArchiveInactive: false,
  autoArchiveSpam: true,
  autoArchiveMarketplace: false,

  // 6. Notifications Shortcut
  notifyNewMessages: true,
  notifyCalls: true,
  notifyReactions: true,
  notifyMentions: true,
  notifyRequests: true,

  // 9. Backup
  autoBackup: 'daily', // 'never' | 'daily' | 'weekly' | 'monthly'
  backupOverWifi: true,

  // 10. Accessibility
  largeText: false,
  reduceMotion: false,
  highContrast: false,
  screenReaderSupport: false,

  // Extra Features
  leftSwipeAction: 'reply', // 'reply' | 'archive' | 'mute'
  rightSwipeAction: 'pin', // 'reply' | 'pin' | 'delete'
  doubleTapReaction: '❤️',
  linkPreview: true,
  autoSaveMedia: false,
  enterKeySends: true,
  gifAutoPlay: true,
  voicePlaybackSpeed: 1.5,
  autoDeleteMessages: 'never', // 'never' | '24h' | '7d' | '30d'
  allowEditing: true,
  editingTimeLimit: 15, // minutes

  // Chat Wallpaper
  chatWallpaper: 'default', // 'default' | 'gradient' | 'blur' | 'custom'
};

const WALLPAPERS = [
  { id: 'default', name: 'Dark Slate', css: 'bg-slate-950/90' },
  { id: 'gradient', name: 'Aether Glow', css: 'bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950' },
  { id: 'blur', name: 'Frosted Message', css: 'bg-gradient-to-tr from-purple-950 via-slate-900 to-rose-950' },
  { id: 'custom', name: 'Custom Dark Map', css: 'bg-zinc-950' },
];

export default function MessagingSettings() {
  const { profile, updateProfile, addToast } = useAeirmist();
  const [settings, setSettings] = useState<typeof DEFAULT_MESSAGING_SETTINGS>(() => ({
    ...DEFAULT_MESSAGING_SETTINGS,
    ...(profile?.messagingSettings || {})
  }));

  const [activeSection, setActiveSection] = useState<string | null>('privacy');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  
  // Storage Stats (Interactive display values)
  const [storageStats] = useState({
    photos: 124, // MB
    videos: 412,
    voice: 18,
    files: 42,
  });

  const rollbackRef = useRef<typeof DEFAULT_MESSAGING_SETTINGS | null>(null);

  useEffect(() => {
    const profileSettings = profile?.messagingSettings || {};
    const keys = Object.keys(DEFAULT_MESSAGING_SETTINGS) as Array<keyof typeof DEFAULT_MESSAGING_SETTINGS>;
    const hasChanged = keys.some(key => JSON.stringify(settings[key]) !== JSON.stringify(profileSettings[key]));

    if (!hasChanged) return;

    if (!rollbackRef.current) {
      rollbackRef.current = profileSettings as typeof DEFAULT_MESSAGING_SETTINGS;
    }

    const timer = setTimeout(async () => {
      setIsSyncing(true);
      try {
        await updateProfile({ messagingSettings: settings });
        rollbackRef.current = settings;
        addToast({
          type: 'success',
          title: 'PREFERENCES SYNCED',
          message: 'Messaging settings updated successfully.'
        });
      } catch (error: any) {
        if (rollbackRef.current) {
          setSettings({ ...DEFAULT_MESSAGING_SETTINGS, ...rollbackRef.current });
        }
        addToast({
          type: 'warning',
          title: 'SYNC TERMINATED',
          message: error?.message || 'Connection error detected.'
        });
      } finally {
        setIsSyncing(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [settings, profile?.messagingSettings, updateProfile, addToast]);

  const toggleSetting = (key: keyof typeof DEFAULT_MESSAGING_SETTINGS) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (key: keyof typeof DEFAULT_MESSAGING_SETTINGS, val: any) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const Section = ({ id, title, icon: Icon, children }: { id: string, title: string, icon: any, children: React.ReactNode }) => {
    const isOpen = activeSection === id;
    return (
      <div className={`rounded-3xl border transition-all duration-500 overflow-hidden ${isOpen ? 'bg-white/[0.03] border-white/10 shadow-2xl' : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.02]'}`}>
        <button 
          onClick={() => setActiveSection(isOpen ? null : id)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isOpen ? 'bg-aeirmist-cyan text-black shadow-[0_0_20px_rgba(0,242,255,0.4)]' : 'bg-white/5 text-white/40'}`}>
              <Icon size={20} />
            </div>
            <div>
              <h3 className={`text-sm font-black uppercase tracking-wider transition-colors ${isOpen ? 'text-white' : 'text-white/60'}`}>{title}</h3>
              {!isOpen && <p className="text-[10px] text-white/30 uppercase font-bold tracking-tight">Configure {title.toLowerCase()} settings</p>}
            </div>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            className="text-white/20"
          >
            <ChevronDown size={20} />
          </motion.div>
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="p-6 pt-0 space-y-6">
                <div className="h-[1px] w-full bg-white/5 mb-6" />
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const Row = ({ label, desc, children }: { label: string, desc?: string, children: React.ReactNode }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
      <div className="max-w-md">
        <h4 className="text-xs font-black uppercase tracking-widest text-white/90">{label}</h4>
        {desc && <p className="text-[10px] text-white/40 font-bold leading-relaxed mt-1 uppercase tracking-tight">{desc}</p>}
      </div>
      <div className="shrink-0">
        {children}
      </div>
    </div>
  );

  const Toggle = ({ enabled, onToggle }: { enabled: boolean, onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? 'bg-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.3)]' : 'bg-white/10'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  const Select = ({ value, options, onChange }: { value: any, options: { label: string, value: any }[], onChange: (val: any) => void }) => (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 pl-4 pr-10 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-white/80 focus:border-aeirmist-cyan/50 focus:bg-white/10 outline-none transition-all appearance-none cursor-pointer"
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-32">
      
      {/* Privacy & Requests */}
      <Section id="privacy" title="Privacy & Requests" icon={Lock}>
        <Row label="Who can message me" desc="Choose your who can message you">
          <Select 
            value={settings.whoCanMessageMe}
            options={[
              { label: 'Everyone', value: 'everyone' },
              { label: 'Followers Only (Recommended)', value: 'followers' },
              { label: 'Mutual Connections', value: 'mutual' },
              { label: 'Nobody', value: 'nobody' }
            ]}
            onChange={(v) => updateField('whoCanMessageMe', v)}
          />
        </Row>
        <Row label="Allow Message Requests" desc="Enable pending transmissions from outer circles">
          <Toggle enabled={settings.allowMessageRequests} onToggle={() => toggleSetting('allowMessageRequests')} />
        </Row>
        <Row label="Auto-filter Spam Requests" desc="Automatically filters likely spam or ads">
          <Toggle enabled={settings.autoFilterSpam} onToggle={() => toggleSetting('autoFilterSpam')} />
        </Row>
        <Row label="Auto-delete Spam" desc="Purge spam signals after duration">
          <Select 
            value={settings.autoDeleteSpamDays}
            options={[
              { label: '7 Days', value: 7 },
              { label: '30 Days', value: 30 },
              { label: '90 Days', value: 90 },
              { label: 'Never', value: 0 }
            ]}
            onChange={(v) => updateField('autoDeleteSpamDays', Number(v))}
          />
        </Row>
        <Row label="Show Sender Profile" desc="Display metadata before accepting transmission">
          <Toggle enabled={settings.showSenderProfile} onToggle={() => toggleSetting('showSenderProfile')} />
        </Row>
        
        <div className="pt-4 border-t border-white/5">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4 ml-1">Manage Lists</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={() => addToast({ title: 'Blocked Users', message: `You have ${profile?.social?.blocked?.length || 0} blocked user(s). Manage them in Privacy Settings.`, type: 'info' })} className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-rose-500/10 hover:border-rose-500/30 text-white/60 hover:text-rose-400 transition-all group cursor-pointer">
              <UserX size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Blocked</span>
            </button>
            <button onClick={() => addToast({ title: 'Restricted Users', message: `You have ${profile?.social?.restricted?.length || 0} restricted user(s). Manage them in Privacy Settings.`, type: 'info' })} className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-aeirmist-magenta/10 hover:border-aeirmist-magenta/30 text-white/60 hover:text-aeirmist-magenta transition-all group cursor-pointer">
              <ShieldAlert size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Restricted</span>
            </button>
            <button onClick={() => addToast({ title: 'Muted Channels', message: 'No muted messaging channels.', type: 'info' })} className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-aeirmist-cyan/10 hover:border-aeirmist-cyan/30 text-white/60 hover:text-aeirmist-cyan transition-all group cursor-pointer">
              <Volume2 size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Muted</span>
            </button>
          </div>
        </div>
      </Section>

      {/* Chat Experience */}
      <Section id="chat_exp" title="Chat Experience" icon={MessageSquare}>
        <Row label="Read Receipts" desc="Let others know when you've read their messages">
          <Toggle enabled={settings.readReceipts} onToggle={() => toggleSetting('readReceipts')} />
        </Row>
        <Row label="Typing Indicator" desc="Show others when you are composing a message">
          <Toggle enabled={settings.typingIndicator} onToggle={() => toggleSetting('typingIndicator')} />
        </Row>
        <Row label="Show Others Typing" desc="See when someone else is typing to you">
          <Toggle enabled={settings.showOthersTyping} onToggle={() => toggleSetting('showOthersTyping')} />
        </Row>
        <Row label="Active Status" desc="Show your current online status to others">
          <Toggle enabled={settings.onlineStatus} onToggle={() => toggleSetting('onlineStatus')} />
        </Row>
        <Row label="Last Seen" desc="Control who can see your previous online timestamps">
          <Select 
            value={settings.lastSeen}
            options={[
              { label: 'Everyone', value: 'everyone' },
              { label: 'Followers Only', value: 'followers' },
              { label: 'Nobody', value: 'nobody' }
            ]}
            onChange={(v) => updateField('lastSeen', v)}
          />
        </Row>
        <Row label="Message Preview" desc="Show message previews in system notifications">
          <Toggle enabled={settings.messagePreview} onToggle={() => toggleSetting('messagePreview')} />
        </Row>
        <Row label="Square Chat Heads" desc="Floating quick-access bubble on your screen">
          <Toggle enabled={settings.enableChatHeads ?? true} onToggle={() => toggleSetting('enableChatHeads')} />
        </Row>
      </Section>

      {/* Media & Uploads */}
      <Section id="media" title="Media & Uploads" icon={LucideImage}>
        <Row label="Upload Quality" desc="Compression metrics for outgoing artifacts">
          <Select 
            value={settings.uploadQuality}
            options={[
              { label: 'Original', value: 'original' },
              { label: 'High (Optimal)', value: 'high' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Data Saver', value: 'data_saver' }
            ]}
            onChange={(v) => updateField('uploadQuality', v)}
          />
        </Row>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
            <h5 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Auto Download</h5>
            <div className="space-y-3">
              <Row label="Photos">
                <Toggle enabled={settings.autoDownloadPhotos} onToggle={() => toggleSetting('autoDownloadPhotos')} />
              </Row>
              <Row label="Videos">
                <Toggle enabled={settings.autoDownloadVideos} onToggle={() => toggleSetting('autoDownloadVideos')} />
              </Row>
              <Row label="Voice">
                <Toggle enabled={settings.autoDownloadVoiceNotes} onToggle={() => toggleSetting('autoDownloadVoiceNotes')} />
              </Row>
              <Row label="Files">
                <Toggle enabled={settings.autoDownloadFiles} onToggle={() => toggleSetting('autoDownloadFiles')} />
              </Row>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
            <h5 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Sync Conditions</h5>
            <Row label="Network">
              <Select 
                value={settings.autoDownloadOn}
                options={[
                  { label: 'Wi-Fi Only', value: 'wifi' },
                  { label: 'Mobile Data', value: 'mobile' },
                  { label: 'Never', value: 'never' }
                ]}
                onChange={(v) => updateField('autoDownloadOn', v)}
              />
            </Row>
            <Row label="Camera">
              <Select 
                value={settings.cameraQuality}
                options={[
                  { label: 'Standard', value: 'standard' },
                  { label: 'HD Signal', value: 'hd' },
                  { label: 'Original', value: 'original' }
                ]}
                onChange={(v) => updateField('cameraQuality', v)}
              />
            </Row>
          </div>
        </div>
      </Section>

      {/* Calls */}
      <Section id="calls" title="Calls" icon={Phone}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Row label="Voice Calls" desc="Enable real-time audio streams">
              <Toggle enabled={settings.allowVoiceCalls} onToggle={() => toggleSetting('allowVoiceCalls')} />
            </Row>
            <Row label="Video Calls" desc="Enable video calls">
              <Toggle enabled={settings.allowVideoCalls} onToggle={() => toggleSetting('allowVideoCalls')} />
            </Row>
            <Row label="Who can call me">
              <Select 
                value={settings.whoCanCallMe}
                options={[
                  { label: 'Everyone', value: 'everyone' },
                  { label: 'Followers Only', value: 'followers' },
                  { label: 'Mutual', value: 'mutual' },
                  { label: 'Nobody', value: 'nobody' }
                ]}
                onChange={(v) => updateField('whoCanCallMe', v)}
              />
            </Row>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
             <h5 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Digital Audio Processing</h5>
             <Row label="Noise Suppression">
               <Toggle enabled={settings.noiseSuppression} onToggle={() => toggleSetting('noiseSuppression')} />
             </Row>
             <Row label="Echo Cancellation">
               <Toggle enabled={settings.echoCancellation} onToggle={() => toggleSetting('echoCancellation')} />
             </Row>
             <Row label="Auto Speaker">
               <Toggle enabled={settings.autoSpeaker} onToggle={() => toggleSetting('autoSpeaker')} />
             </Row>
             <Row label="Auto Camera Off">
               <Toggle enabled={settings.autoCameraOff} onToggle={() => toggleSetting('autoCameraOff')} />
             </Row>
          </div>
        </div>
      </Section>

      {/* Chat Organization */}
      <Section id="organization" title="Chat Organization" icon={Archive}>
        <Row label="Default Chat Filter" desc="Primary inbox view configuration">
          <Select 
            value={settings.defaultChatFilter}
            options={[
              { label: 'All Messages', value: 'all' },
              { label: 'Unread Only', value: 'unread' },
              { label: 'Personal', value: 'personal' },
              { label: 'Marketplace', value: 'marketplace' },
              { label: 'Archived', value: 'archived' }
            ]}
            onChange={(v) => updateField('defaultChatFilter', v)}
          />
        </Row>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
          <h5 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Auto-Archive</h5>
          <Row label="Inactive Chats" desc="Clear primary stream after 30 days of silence">
            <Toggle enabled={settings.autoArchiveInactive} onToggle={() => toggleSetting('autoArchiveInactive')} />
          </Row>
          <Row label="Spam Requests" desc="Move suspicious signals to secondary archives">
            <Toggle enabled={settings.autoArchiveSpam} onToggle={() => toggleSetting('autoArchiveSpam')} />
          </Row>
          <Row label="Marketplace" desc="Separate trade signals from personal feed">
            <Toggle enabled={settings.autoArchiveMarketplace} onToggle={() => toggleSetting('autoArchiveMarketplace')} />
          </Row>
        </div>
      </Section>

      {/* Storage Management */}
      <Section id="storage" title="Storage" icon={StorageIcon}>
        <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h4 className="text-xl font-black text-white">596 MB</h4>
              <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Digital Cache Utilization</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-aeirmist-cyan font-black uppercase tracking-widest bg-aeirmist-cyan/10 px-3 py-1 rounded-full">Optimized</span>
            </div>
          </div>
          
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
            <div style={{ width: '25%' }} className="bg-aeirmist-cyan h-full" />
            <div style={{ width: '45%' }} className="bg-aeirmist-magenta h-full opacity-60" />
            <div style={{ width: '15%' }} className="bg-white/20 h-full" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Photos', val: storageStats.photos, color: 'bg-aeirmist-cyan' },
              { label: 'Videos', val: storageStats.videos, color: 'bg-aeirmist-magenta' },
              { label: 'Voice', val: storageStats.voice, color: 'bg-aeirmist-lime' },
              { label: 'Files', val: storageStats.files, color: 'bg-white/40' }
            ].map(item => (
              <div key={item.label} className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                  <span className="text-[9px] text-white/40 font-black uppercase tracking-widest">{item.label}</span>
                </div>
                <div className="text-xs font-bold text-white/80">{item.val} MB</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button onClick={() => addToast({ title: 'Storage Optimization', message: 'Digital cache is currently optimized.', type: 'info' })} className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 transition-all cursor-pointer">
              <Database size={14} />
              Manage Storage
            </button>
            <button onClick={() => addToast({ title: 'Cache Purged', message: 'Temporary media cache cleared successfully.', type: 'success' })} className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-white/5 border border-white/5 hover:bg-rose-500/10 hover:border-rose-500/30 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-rose-400 transition-all cursor-pointer">
              <Trash2 size={14} />
              Purge All Cache
            </button>
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section id="security" title="Security" icon={Shield}>
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-aeirmist-lime/5 border border-aeirmist-lime/20 flex items-start gap-4">
            <ShieldCheck size={24} className="text-aeirmist-lime shrink-0" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-white/90">End-to-End Encryption</h4>
              <p className="text-[10px] text-white/40 font-bold leading-relaxed mt-1 uppercase tracking-tight">Your signals are encrypted with end-to-end encryption. Not even Aeirmist can decode them.</p>
            </div>
          </div>
          <Row label="Security Code Display" desc="Verify security code with contact nodes">
            <Toggle enabled={true} onToggle={() => {}} />
          </Row>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => addToast({ title: 'Blocked Devices', message: 'No devices blocked from messaging.', type: 'info' })} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group cursor-pointer">
              <div className="flex items-center gap-3">
                <Smartphone size={16} className="text-white/40" />
                <span className="text-[10px] font-black uppercase tracking-widest">Blocked Devices</span>
              </div>
              <ChevronDown size={14} className="-rotate-90 text-white/20" />
            </button>
            <button onClick={() => addToast({ title: 'Trusted Devices', message: 'Current session device is verified.', type: 'info' })} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group cursor-pointer">
              <div className="flex items-center gap-3">
                <Fingerprint size={16} className="text-white/40" />
                <span className="text-[10px] font-black uppercase tracking-widest">Trusted Devices</span>
              </div>
              <ChevronDown size={14} className="-rotate-90 text-white/20" />
            </button>
          </div>
        </div>
      </Section>

      {/* Extra Advanced Features */}
      <div className="pt-8 pb-4">
        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 text-center">Interactive Settings</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Swipe & Reactions */}
        <div className="p-6 rounded-[2.5rem] bg-white/[0.01] border border-white/5 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-aeirmist-cyan">Gesture Mapping</h3>
          <Row label="Left Swipe Action">
            <Select 
              value={settings.leftSwipeAction}
              options={[
                { label: 'Quick Reply', value: 'reply' },
                { label: 'Archive Log', value: 'archive' },
                { label: 'Silence Route', value: 'mute' }
              ]}
              onChange={(v) => updateField('leftSwipeAction', v)}
            />
          </Row>
          <Row label="Right Swipe Action">
            <Select 
              value={settings.rightSwipeAction}
              options={[
                { label: 'Reply', value: 'reply' },
                { label: 'Pin Route', value: 'pin' },
                { label: 'Purge Log', value: 'delete' }
              ]}
              onChange={(v) => updateField('rightSwipeAction', v)}
            />
          </Row>
          <Row label="Double Tap Reaction" desc="Default emoji for rapid feedback">
             <Select 
              value={settings.doubleTapReaction}
              options={[
                { label: '❤️ Love', value: '❤️' },
                { label: '👍 Confirm', value: '👍' },
                { label: '😂 Signal', value: '😂' },
                { label: '😮 Alert', value: '😮' },
                { label: '🔥 Connections', value: '🔥' }
              ]}
              onChange={(v) => updateField('doubleTapReaction', v)}
            />
          </Row>
        </div>

        {/* Media & Input */}
        <div className="p-6 rounded-[2.5rem] bg-white/[0.01] border border-white/5 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-aeirmist-magenta">Input Settings</h3>
          <Row label="Link Previews" desc="Resolve external metadata clusters">
            <Toggle enabled={settings.linkPreview} onToggle={() => toggleSetting('linkPreview')} />
          </Row>
          <Row label="Auto Save Media" desc="Mirror incoming artifacts to local storage">
            <Toggle enabled={settings.autoSaveMedia} onToggle={() => toggleSetting('autoSaveMedia')} />
          </Row>
          <Row label="Enter Key Sends" desc="Issue transmission on physical Enter (Desktop)">
            <Toggle enabled={settings.enterKeySends} onToggle={() => toggleSetting('enterKeySends')} />
          </Row>
          <Row label="GIF Auto Play" desc="Animate visual clusters immediately">
            <Toggle enabled={settings.gifAutoPlay} onToggle={() => toggleSetting('gifAutoPlay')} />
          </Row>
        </div>

        {/* Voice & Editing */}
        <div className="p-6 rounded-[2.5rem] bg-white/[0.01] border border-white/5 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-aeirmist-lime">Signal Processing</h3>
          <Row label="Voice Playback Speed">
            <Select 
              value={settings.voicePlaybackSpeed}
              options={[
                { label: '1.0x (Standard)', value: 1 },
                { label: '1.5x (Digital)', value: 1.5 },
                { label: '2.0x (Accelerated)', value: 2 }
              ]}
              onChange={(v) => updateField('voicePlaybackSpeed', Number(v))}
            />
          </Row>
          <Row label="Auto Delete Messages" desc="Purge history based on timer">
            <Select 
              value={settings.autoDeleteMessages}
              options={[
                { label: 'Never', value: 'never' },
                { label: '24 Hours', value: '24h' },
                { label: '7 Days', value: '7d' },
                { label: '30 Days', value: '30d' }
              ]}
              onChange={(v) => updateField('autoDeleteMessages', v)}
            />
          </Row>
          <Row label="Allow Message Editing">
            <Toggle enabled={settings.allowEditing} onToggle={() => toggleSetting('allowEditing')} />
          </Row>
        </div>

        {/* Wallpaper & Theme */}
        <div className="p-6 rounded-[2.5rem] bg-white/[0.01] border border-white/5 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-white">Visual Matrix</h3>
          <Row label="Chat Wallpaper" desc="Atmospheric background for conversations">
             <div className="grid grid-cols-2 gap-2 w-full mt-2">
                {WALLPAPERS.map(wp => (
                  <button
                    key={wp.id}
                    onClick={() => updateField('chatWallpaper', wp.id)}
                    className={`h-12 rounded-xl border transition-all flex items-center justify-center gap-2 ${settings.chatWallpaper === wp.id ? 'bg-white/10 border-aeirmist-cyan text-white shadow-[0_0_15px_rgba(0,242,255,0.2)]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${wp.css} border border-white/10`} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{wp.name}</span>
                  </button>
                ))}
             </div>
          </Row>
        </div>
      </div>

      {/* Backup */}
      <div className="p-8 rounded-[3rem] bg-gradient-to-br from-aeirmist-cyan/5 to-transparent border border-white/5 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan">
            <CloudUpload size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Digital Backup</h3>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Secure cloud vault Sync</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Row label="Auto Backup Frequency">
             <Select 
              value={settings.autoBackup}
              options={[
                { label: 'Daily Sync', value: 'daily' },
                { label: 'Weekly Sync', value: 'weekly' },
                { label: 'Monthly Sync', value: 'monthly' },
                { label: 'Disabled', value: 'never' }
              ]}
              onChange={(v) => updateField('autoBackup', v)}
            />
          </Row>
          <Row label="Sync over Wi-Fi Only">
            <Toggle enabled={settings.backupOverWifi} onToggle={() => toggleSetting('backupOverWifi')} />
          </Row>
        </div>

        <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[10px] text-white/40 font-mono">
            LAST SYNC: <span className="text-aeirmist-cyan font-bold">2026-07-13 04:12 UTC</span>
          </div>
          <button 
            onClick={() => {
              setIsBackingUp(true);
              setTimeout(() => {
                setIsBackingUp(false);
                addToast({ type: 'success', title: 'BACKUP COMPLETE', message: 'All communication records secured.' });
              }, 2000);
            }}
            disabled={isBackingUp}
            className="px-8 py-3 rounded-xl bg-aeirmist-cyan text-black font-black uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] disabled:opacity-50"
          >
            {isBackingUp ? 'Accelerating Signal...' : 'Initiate Manual Backup'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-8 rounded-[3rem] bg-rose-500/5 border border-rose-500/20 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-rose-500">Danger Sector</h3>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Destructive system operations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <button onClick={() => addToast({ title: 'Settings Reset', message: 'Messaging settings restored to defaults.', type: 'info' })} className="flex flex-col items-start p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all group cursor-pointer">
            <h4 className="text-xs font-black uppercase tracking-widest text-white/90 group-hover:text-rose-400">Reset Messaging</h4>
            <p className="text-[9px] text-white/30 font-bold leading-relaxed mt-1 uppercase tracking-tight">Restore all messaging rules to default factory state.</p>
          </button>
          <button onClick={() => addToast({ title: 'Archives Cleaned', message: 'Archived messaging records cleared.', type: 'info' })} className="flex flex-col items-start p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all group cursor-pointer">
            <h4 className="text-xs font-black uppercase tracking-widest text-white/90 group-hover:text-rose-400">Vaporize Archives</h4>
            <p className="text-[9px] text-white/30 font-bold leading-relaxed mt-1 uppercase tracking-tight">Permanently shred all archived communication logs.</p>
          </button>
          <button onClick={() => addToast({ title: 'Transmission History', message: 'Transmission history purge requires security clearance.', type: 'warning' })} className="flex flex-col items-start p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all group sm:col-span-2 cursor-pointer">
            <h4 className="text-xs font-black uppercase tracking-widest text-rose-500">Purge Transmission History</h4>
            <p className="text-[9px] text-white/30 font-bold leading-relaxed mt-1 uppercase tracking-tight">Delete all direct message records. This action is irreversible across the platform.</p>
          </button>
        </div>
      </div>

      <div className="text-center pt-8 opacity-20">
        <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.5em] text-white">
          <Shield size={10} />
          Production Level Encryption Active
        </div>
      </div>

    </div>
  );
}
