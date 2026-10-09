import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Database, Bell, Eye, Zap, Image as ImageIcon, Download, Check, MessageSquare, Signal, Ghost } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { useAeirmist } from '../../context/AeirmistContext';
import { MediaQuality } from '../../services/MediaService';
import { getAvatarUrl } from '../../lib/avatar';
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { db, clearCache, profile, mediaSettings, setMediaSettings, addToast } = useAeirmist();
  const [clearing, setClearing] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const [overlaySettings, setOverlaySettings] = React.useState(() => {
    try {
      const saved = localStorage.getItem('aeirmist_inbox_overlay_settings_v1');
      return saved ? JSON.parse(saved) : {
        pushNotifications: true,
        stealthMode: false,
      };
    } catch {
      return {
        pushNotifications: true,
        stealthMode: false,
      };
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('aeirmist_inbox_overlay_settings_v1', JSON.stringify(overlaySettings));
    } catch {}
  }, [overlaySettings]);

  const toggleOverlay = async (key: keyof typeof overlaySettings | 'onlineStatus' | 'readReceipts', label: string) => {
    if (key === 'onlineStatus' || key === 'readReceipts') {
      if (!db || !profile?.id) return;
      try {
        const currentMessaging = profile.messagingSettings || {};
        const nextVal = !currentMessaging[key];
        await updateDoc(doc(db, 'profiles', profile.id), {
          messagingSettings: {
            ...currentMessaging,
            [key]: nextVal
          }
        });
        addToast({
          title: `${label} ${nextVal ? 'Enabled' : 'Disabled'}`,
          message: `Messaging preference updated successfully.`,
          type: nextVal ? 'success' : 'info'
        });
      } catch (e) {
        logger.error("Failed to update messaging settings", e);
        addToast({ title: 'Error', message: 'Failed to update settings', type: 'warning' });
      }
      return;
    }

    const nextVal = !overlaySettings[key as keyof typeof overlaySettings];
    setOverlaySettings((prev: any) => ({ ...prev, [key]: nextVal }));

    if (key === 'pushNotifications' && nextVal && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    addToast({
      title: `${label} ${nextVal ? 'Enabled' : 'Disabled'}`,
      message: `Inbox preference updated successfully.`,
      type: nextVal ? 'success' : 'info'
    });
  };

  const handleClearCache = async () => {
    setClearing(true);
    await clearCache();
    await new Promise(r => setTimeout(r, 600));
    setClearing(false);
    setDone(true);
    addToast({
      title: 'Cache Cleared',
      message: 'Cache cleared.',
      type: 'success'
    });
    setTimeout(() => setDone(false), 3000);
  };

  const updateQuality = (q: MediaQuality) => {
    setMediaSettings({ ...mediaSettings, quality: q });
    addToast({
      title: 'Quality Preset Updated',
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            className="relative w-full max-w-md bg-[#0a0a0e] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-display font-bold text-white tracking-tight">Inbox Settings</h2>
                  <p className="text-[10px] text-aeirmist-cyan font-mono uppercase tracking-widest mt-0.5">Device & Media Configuration</p>
                </div>
                <button 
                  onClick={onClose} 
                  className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Media Transmission */}
                <section>
                  <label className="text-[10px] font-mono font-bold text-aeirmist-cyan uppercase tracking-widest mb-3 block">Media Transmission</label>
                  <div className="space-y-3">
                    <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2.5 mb-3">
                        <ImageIcon size={15} className="text-aeirmist-cyan" />
                        <span className="text-[11px] font-bold text-white/90 uppercase tracking-wider">Media Quality</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {QUALITY_OPTIONS.map((item) => {
                          const isActive = mediaSettings.quality === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => updateQuality(item.id)}
                              className={`px-3 py-2.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 ${
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

                    <div className="flex items-center justify-between p-3.5 bg-white/[0.03] rounded-2xl border border-white/10 hover:border-white/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 flex items-center justify-center text-aeirmist-cyan">
                          <Download size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Auto-Download</p>
                          <p className="text-[9px] text-white/40 font-mono">Sync incoming media automatically</p>
                        </div>
                      </div>
                      <button 
                        onClick={toggleAutoDownload}
                        className={`w-11 h-6 rounded-full transition-colors relative p-1 ${mediaSettings.autoDownload ? 'bg-aeirmist-cyan' : 'bg-white/10'}`}
                      >
                        <motion.div 
                          animate={{ x: mediaSettings.autoDownload ? 20 : 0 }}
                          className="w-4 h-4 rounded-full bg-black shadow-sm"
                        />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Data Vault */}
                <section>
                  <label className="text-[10px] font-mono font-bold text-aeirmist-magenta uppercase tracking-widest mb-3 block">Data Vault</label>
                  <div className="p-3.5 bg-white/[0.03] rounded-2xl border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-aeirmist-magenta/10 border border-aeirmist-magenta/20 flex items-center justify-center text-aeirmist-magenta">
                        <Database size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Identity Cache</p>
                        <p className="text-[9px] text-white/40 font-mono">Messages & media cache storage</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleClearCache}
                      disabled={clearing}
                      className={`px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                        done 
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                          : 'bg-aeirmist-magenta/15 border-aeirmist-magenta/30 text-aeirmist-magenta hover:bg-aeirmist-magenta hover:text-white'
                      }`}
                    >
                      {clearing ? (
                        <Zap size={13} className="animate-spin" />
                      ) : done ? (
                        <>CLEARED</>
                      ) : (
                        <>CLEAR CACHE</>
                      )}
                    </button>
                  </div>
                </section>

                {/* Digital Overlay */}
                <section>
                  <label className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest mb-3 block">Privacy & Alerts</label>
                  <div className="grid grid-cols-2 gap-2">
                    <SettingsToggle 
                      icon={<Bell size={14} />} 
                      label="Push Notifications" 
                      active={overlaySettings.pushNotifications}
                      onClick={() => toggleOverlay('pushNotifications', 'Push Notifications')}
                    />
                    <SettingsToggle 
                      icon={<Ghost size={14} />} 
                      label="Stealth Mode" 
                      active={overlaySettings.stealthMode}
                      onClick={() => toggleOverlay('stealthMode', 'Stealth Mode')}
                    />
                    <SettingsToggle 
                      icon={<Signal size={14} />} 
                      label="Show Online Status" 
                      active={profile?.messagingSettings?.onlineStatus !== false}
                      onClick={() => toggleOverlay('onlineStatus', 'Show Online Status')}
                    />
                    <SettingsToggle 
                      icon={<MessageSquare size={14} />} 
                      label="Message Read Receipts" 
                      active={profile?.messagingSettings?.readReceipts !== false}
                      onClick={() => toggleOverlay('readReceipts', 'Message Read Receipts')}
                    />
                  </div>
                </section>
              </div>

              {/* Identity Sync Footer */}
              <div className="mt-8 p-3.5 bg-white/[0.02] border border-white/10 rounded-2xl flex items-center gap-3">
                <img src={getAvatarUrl(profile?.photoURL)} alt="" className="w-10 h-10 rounded-full border border-aeirmist-cyan shrink-0 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{profile?.displayName || profile?.username}</p>
                  <p className="text-[9px] text-aeirmist-cyan font-mono uppercase tracking-wider italic">Identity sync active</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface SettingsToggleProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all text-left group relative ${
      active 
        ? 'bg-white/[0.07] border-aeirmist-cyan/40 text-white shadow-[0_0_12px_rgba(0,242,255,0.08)]' 
        : 'bg-white/[0.02] border-white/5 text-white/40 hover:border-white/20 hover:text-white/70'
    }`}
  >
    <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-aeirmist-cyan/20 text-aeirmist-cyan' : 'bg-white/5 text-white/30'}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wider block leading-tight truncate">{label}</span>
      <span className={`text-[8px] font-mono block mt-0.5 ${active ? 'text-aeirmist-cyan' : 'text-white/20'}`}>
        {active ? 'ON' : 'OFF'}
      </span>
    </div>
  </button>
);

