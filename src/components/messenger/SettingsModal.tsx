import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Settings, 
  Signal, 
  CheckCheck, 
  MessageSquare, 
  BellOff
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { useAeirmist } from '../../context/AeirmistContext';
import { logger } from '@/src/utils/logger';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose
}) => {
  const { 
    db, 
    profile, 
    updateProfile
  } = useAeirmist();

  // 1. Active Status (Online status)
  const [onlineStatus, setOnlineStatus] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aeirmist_online_status');
      if (saved !== null) return saved === 'true';
    } catch {}
    return profile?.messagingSettings?.onlineStatus !== false;
  });

  // 2. Read Receipts
  const [readReceipts, setReadReceipts] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aeirmist_read_receipts');
      if (saved !== null) return saved === 'true';
    } catch {}
    return profile?.messagingSettings?.readReceipts !== false;
  });

  // 3. Chat Heads
  const [chatHeads, setChatHeads] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aeirmist_chat_heads');
      if (saved !== null) return saved === 'true';
    } catch {}
    return profile?.messagingSettings?.enableChatHeads !== false;
  });

  // 4. Mute Notifications
  const [muteNotifications, setMuteNotifications] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aeirmist_inbox_muted');
      if (saved !== null) return saved === 'true';
    } catch {}
    return profile?.messagingSettings?.muteNotifications === true;
  });

  // Keep in sync when profile loads
  useEffect(() => {
    if (profile?.messagingSettings) {
      if (typeof profile.messagingSettings.onlineStatus === 'boolean') {
        setOnlineStatus(profile.messagingSettings.onlineStatus);
      }
      if (typeof profile.messagingSettings.readReceipts === 'boolean') {
        setReadReceipts(profile.messagingSettings.readReceipts);
      }
      if (typeof profile.messagingSettings.enableChatHeads === 'boolean') {
        setChatHeads(profile.messagingSettings.enableChatHeads);
      }
      if (typeof profile.messagingSettings.muteNotifications === 'boolean') {
        setMuteNotifications(profile.messagingSettings.muteNotifications);
      }
    }
  }, [profile?.messagingSettings]);

  const handleToggle = async (key: 'onlineStatus' | 'readReceipts' | 'chatHeads' | 'muteNotifications') => {
    let nextVal = false;

    if (key === 'onlineStatus') {
      nextVal = !onlineStatus;
      setOnlineStatus(nextVal);
      try {
        localStorage.setItem('aeirmist_online_status', String(nextVal));
      } catch {}
    } else if (key === 'readReceipts') {
      nextVal = !readReceipts;
      setReadReceipts(nextVal);
      try {
        localStorage.setItem('aeirmist_read_receipts', String(nextVal));
      } catch {}
    } else if (key === 'chatHeads') {
      nextVal = !chatHeads;
      setChatHeads(nextVal);
      try {
        localStorage.setItem('aeirmist_chat_heads', String(nextVal));
      } catch {}
    } else if (key === 'muteNotifications') {
      nextVal = !muteNotifications;
      setMuteNotifications(nextVal);
      try {
        localStorage.setItem('aeirmist_inbox_muted', String(nextVal));
      } catch {}
    }

    // Persist in background
    try {
      const currentMessaging = profile?.messagingSettings || {};
      const messagingKey = key === 'chatHeads' ? 'enableChatHeads' : key;

      const nextMessaging = {
        ...currentMessaging,
        [messagingKey]: nextVal
      };

      const updatePayload: any = {
        messagingSettings: nextMessaging
      };

      if (key === 'onlineStatus') {
        updatePayload.privacySettings = {
          ...(profile?.privacySettings || {}),
          showOnlineStatus: nextVal,
          showActivity: nextVal
        };
      }

      await updateProfile(updatePayload);

      if (db && profile?.id) {
        await updateDoc(doc(db, 'profiles', profile.id), updatePayload).catch(() => {});
      }
    } catch (e) {
      logger.error('Failed to sync settings:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-sm bg-[#0d0e12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <Settings size={18} className="text-aeirmist-cyan" />
              <h2 className="text-sm font-bold text-white">Inbox Settings</h2>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Toggle List */}
          <div className="p-4 space-y-1">
            {/* 1. Active Status */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  onlineStatus ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-white/30'
                }`}>
                  <Signal size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Active Status</p>
                  <p className="text-[11px] text-white/40">Show when you're active</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={onlineStatus}
                onClick={() => handleToggle('onlineStatus')}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center shrink-0 ${
                  onlineStatus ? 'bg-emerald-500 justify-end' : 'bg-white/15 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow" />
              </button>
            </div>

            {/* 2. Read Receipts */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  readReceipts ? 'bg-aeirmist-cyan/15 text-aeirmist-cyan' : 'bg-white/5 text-white/30'
                }`}>
                  <CheckCheck size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Read Receipts</p>
                  <p className="text-[11px] text-white/40">Show when you've seen messages</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={readReceipts}
                onClick={() => handleToggle('readReceipts')}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center shrink-0 ${
                  readReceipts ? 'bg-aeirmist-cyan justify-end' : 'bg-white/15 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow" />
              </button>
            </div>

            {/* 3. Chat Heads */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  chatHeads ? 'bg-indigo-500/15 text-indigo-400' : 'bg-white/5 text-white/30'
                }`}>
                  <MessageSquare size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Chat Heads</p>
                  <p className="text-[11px] text-white/40">Floating bubble for open chats</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={chatHeads}
                onClick={() => handleToggle('chatHeads')}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center shrink-0 ${
                  chatHeads ? 'bg-indigo-500 justify-end' : 'bg-white/15 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow" />
              </button>
            </div>

            {/* 4. Mute Notifications */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3 min-w-0 pr-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  muteNotifications ? 'bg-amber-500/15 text-amber-400' : 'bg-white/5 text-white/30'
                }`}>
                  <BellOff size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Mute Notifications</p>
                  <p className="text-[11px] text-white/40">Silence message alerts and sounds</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={muteNotifications}
                onClick={() => handleToggle('muteNotifications')}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 flex items-center shrink-0 ${
                  muteNotifications ? 'bg-amber-500 justify-end' : 'bg-white/15 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
