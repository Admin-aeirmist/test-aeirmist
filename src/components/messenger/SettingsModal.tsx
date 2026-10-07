import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Database, 
  BellOff, 
  Eye, 
  Activity, 
  AppWindow, 
  Zap, 
  Image as ImageIcon, 
  Download, 
  Check, 
  Loader2 
} from 'lucide-react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { useAeirmist } from '../../context/AeirmistContext';
import { MediaQuality } from '../../services/MediaService';
import { getAvatarUrl } from '../../lib/avatar';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';
import { logger } from '@/src/utils/logger';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUALITY_OPTIONS = [
  { id: MediaQuality.AUTO, label: 'AUTO' },
  { id: MediaQuality.DATA_SAVER, label: 'DATA SAVER' },
  { id: MediaQuality.HD, label: 'HD' },
  { id: MediaQuality.ULTRA, label: 'ULTRA' },
];

// Instagram / iOS style smooth pill switch
const InstaSwitch: React.FC<{ enabled: boolean; onChange: () => void; loading?: boolean }> = ({ 
  enabled, 
  onChange, 
  loading 
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    onClick={onChange}
    disabled={loading}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
      enabled ? 'bg-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.4)]' : 'bg-white/10'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out flex items-center justify-center ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`}
    >
      {loading && <Loader2 size={10} className="animate-spin text-black" />}
    </span>
  </button>
);

// Individual setting row
const SettingRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
}> = ({ icon, title, description, enabled, onToggle, loading }) => (
  <div 
    onClick={onToggle}
    className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all cursor-pointer group"
  >
    <div className="flex items-center gap-3.5 min-w-0 pr-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
        enabled 
          ? 'bg-aeirmist-cyan/15 text-aeirmist-cyan border border-aeirmist-cyan/30 shadow-[0_0_10px_rgba(0,242,255,0.15)]' 
          : 'bg-white/5 text-white/40 border border-white/5'
      }`}>
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="text-xs font-bold text-white group-hover:text-aeirmist-cyan transition-colors">
          {title}
        </h4>
        <p className="text-[11px] text-white/45 leading-relaxed mt-0.5">
          {description}
        </p>
      </div>
    </div>
    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
      <InstaSwitch enabled={enabled} onChange={onToggle} loading={loading} />
    </div>
  </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { db, clearCache, profile, updateProfile, mediaSettings, setMediaSettings, addToast } = useAeirmist();
  const [clearing, setClearing] = useState(false);
  const [done, setDone] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Local optimistic state for instant toggle responsiveness
  const [localSettings, setLocalSettings] = useState(() => ({
    enableChatHeads: profile?.messagingSettings?.enableChatHeads !== false,
    muteNotifications: profile?.messagingSettings?.muteNotifications === true,
    onlineStatus: profile?.messagingSettings?.onlineStatus !== false,
    readReceipts: profile?.messagingSettings?.readReceipts !== false,
  }));

  // Sync with profile if updated externally
  useEffect(() => {
    if (profile?.messagingSettings) {
      setLocalSettings({
        enableChatHeads: profile.messagingSettings.enableChatHeads !== false,
        muteNotifications: profile.messagingSettings.muteNotifications === true,
        onlineStatus: profile.messagingSettings.onlineStatus !== false,
        readReceipts: profile.messagingSettings.readReceipts !== false,
      });
    }
  }, [profile?.messagingSettings]);

  // Instagram-style toggle handler
  const handleToggle = async (
    key: 'enableChatHeads' | 'muteNotifications' | 'onlineStatus' | 'readReceipts', 
    label: string
  ) => {
    if (savingKey === key) return;
    triggerNativeHaptic('selection');
    if (!profile?.id) return;
    
    setSavingKey(key);

    const nextVal = !localSettings[key];
    setLocalSettings(prev => ({ ...prev, [key]: nextVal }));

    try {
      const updatedMessaging = {
        ...(profile.messagingSettings || {}),
        [key]: nextVal
      };

      let success = false;
      if (updateProfile) {
        try {
          await updateProfile({
            messagingSettings: updatedMessaging
          });
          success = true;
        } catch (upErr) {
          logger.warn(`[SettingsModal] updateProfile fallback for ${key}:`, upErr);
        }
      }

      if (!success && db) {
        await setDoc(doc(db, 'profiles', profile.id), {
          messagingSettings: updatedMessaging
        }, { merge: true });
        success = true;
      }

      const statusText = key === 'muteNotifications' 
        ? (nextVal ? 'Muted' : 'Unmuted') 
        : (nextVal ? 'Turned On' : 'Turned Off');

      addToast?.({
        title: `${label} ${statusText}`,
        message: 'Direct messaging preference updated.',
        type: 'success'
      });
    } catch (err: any) {
      logger.error(`Failed to update ${key}:`, err);
      // Revert optimistic state on failure
      setLocalSettings(prev => ({ ...prev, [key]: !nextVal }));
      addToast?.({
        title: 'Error',
        message: 'Failed to update setting. Please retry.',
        type: 'warning'
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    await clearCache();
    await new Promise(r => setTimeout(r, 600));
    setClearing(false);
    setDone(true);
    addToast({
      title: 'Cache Cleared',
      message: 'Local message database refreshed.',
      type: 'success'
    });
    setTimeout(() => setDone(false), 3000);
  };

  const updateQuality = (q: MediaQuality) => {
    setMediaSettings({ ...mediaSettings, quality: q });
    addToast({
      title: 'Quality Updated',
      message: `Transmission resolution set to ${q.toUpperCase().replace('_', ' ')}.`,
      type: 'info'
    });
  };

  const toggleAutoDownload = () => {
    const nextVal = !mediaSettings.autoDownload;
    setMediaSettings({ ...mediaSettings, autoDownload: nextVal });
    addToast({
      title: `Auto-Download ${nextVal ? 'Enabled' : 'Disabled'}`,
      message: nextVal ? 'Media assets will sync automatically.' : 'Automatic downloads paused.',
      type: 'info'
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            className="relative w-full max-w-md bg-[#0a0a0e] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <div className="p-6 sm:p-7">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-display font-bold text-white tracking-tight">Direct Message Settings</h2>
                  <p className="text-[10px] text-aeirmist-cyan font-mono uppercase tracking-widest mt-0.5">Preferences & Privacy</p>
                </div>
                <button 
                  onClick={onClose} 
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-6">
                {/* ── Main Section: Message Controls (Instagram Style) ── */}
                <section className="space-y-2.5">
                  <label className="text-[10px] font-mono font-bold text-aeirmist-cyan uppercase tracking-widest block mb-2">
                    Message Controls
                  </label>

                  {/* 1. Chat Heads */}
                  <SettingRow
                    icon={<AppWindow size={17} />}
                    title="Chat Heads"
                    description="Keep floating quick-access conversation bubbles on screen"
                    enabled={localSettings.enableChatHeads}
                    onToggle={() => handleToggle('enableChatHeads', 'Chat Heads')}
                    loading={savingKey === 'enableChatHeads'}
                  />

                  {/* 2. Mute Notifications */}
                  <SettingRow
                    icon={<BellOff size={17} />}
                    title="Mute Notifications"
                    description="Pause sound alerts, rings, and banners for incoming messages"
                    enabled={localSettings.muteNotifications}
                    onToggle={() => handleToggle('muteNotifications', 'Notifications')}
                    loading={savingKey === 'muteNotifications'}
                  />

                  {/* 3. Active Status */}
                  <SettingRow
                    icon={<Activity size={17} />}
                    title="Active Status"
                    description="Allow accounts you message to see when you are currently online"
                    enabled={localSettings.onlineStatus}
                    onToggle={() => handleToggle('onlineStatus', 'Active Status')}
                    loading={savingKey === 'onlineStatus'}
                  />

                  {/* 4. Read Receipts */}
                  <SettingRow
                    icon={<Eye size={17} />}
                    title="Read Receipts"
                    description="Let others see when you have viewed and read their messages"
                    enabled={localSettings.readReceipts}
                    onToggle={() => handleToggle('readReceipts', 'Read Receipts')}
                    loading={savingKey === 'readReceipts'}
                  />
                </section>

                {/* ── Media Transmission ── */}
                <section>
                  <label className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest mb-2.5 block">
                    Media Transmission
                  </label>
                  <div className="space-y-2.5">
                    <div className="p-3.5 bg-white/[0.03] rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2 mb-2.5">
                        <ImageIcon size={14} className="text-aeirmist-cyan" />
                        <span className="text-[11px] font-bold text-white/90 uppercase tracking-wider">Quality Preset</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {QUALITY_OPTIONS.map((item) => {
                          const isActive = mediaSettings.quality === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => updateQuality(item.id)}
                              className={`px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                                isActive 
                                  ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.2)]' 
                                  : 'bg-white/5 border-white/5 text-white/50 hover:text-white hover:border-white/20'
                              }`}
                            >
                              {isActive && <Check size={12} className="shrink-0" />}
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-white/[0.03] rounded-2xl border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 flex items-center justify-center text-aeirmist-cyan">
                          <Download size={15} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Auto-Download</p>
                          <p className="text-[10px] text-white/40">Sync incoming media automatically</p>
                        </div>
                      </div>
                      <InstaSwitch enabled={mediaSettings.autoDownload} onChange={toggleAutoDownload} />
                    </div>
                  </div>
                </section>

                {/* ── Cache Storage ── */}
                <section>
                  <label className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest mb-2.5 block">
                    Data Storage
                  </label>
                  <div className="p-3.5 bg-white/[0.03] rounded-2xl border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60">
                        <Database size={15} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Local Cache</p>
                        <p className="text-[10px] text-white/40">Clear temporary message assets</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleClearCache}
                      disabled={clearing}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5 cursor-pointer ${
                        done 
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {clearing ? (
                        <Zap size={12} className="animate-spin" />
                      ) : done ? (
                        <>CLEARED</>
                      ) : (
                        <>CLEAR</>
                      )}
                    </button>
                  </div>
                </section>
              </div>

              {/* Profile identity tag */}
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-3">
                <img 
                  src={getAvatarUrl(profile?.photoURL)} 
                  alt="" 
                  className="w-9 h-9 rounded-full border border-white/15 object-cover" 
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{profile?.displayName || profile?.username}</p>
                  <p className="text-[9px] text-aeirmist-cyan font-mono uppercase tracking-wider">Synced to profile</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
