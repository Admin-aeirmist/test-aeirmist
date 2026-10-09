import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Ghost, 
  Send, 
  X, 
  Inbox, 
  Archive, 
  Trash2, 
  MoreVertical, 
  Share2, 
  Camera, 
  ChevronRight,
  MessageCircle,
  Eye,
  EyeOff,
  Bell,
  Settings,
  Reply,
  Loader2,
  Sparkles,
  Zap,
  ArrowLeft,
  Shield
} from 'lucide-react';
import { useNGL, NGLMessage } from '../../hooks/useNGL';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';

// --- STYLES ---
const glassPanel = "bg-white/[0.03] backdrop-blur-3xl border border-white/10 shadow-2xl";
const neonButton = "bg-aeirmist-cyan text-black shadow-[0_0_15px_rgba(0,242,255,0.4)]";

// --- COMPONENTS ---

// --- SETTINGS TAB ---

const NGLSettingsTab = ({ profile }: { profile: any }) => {
  const { updateProfile } = useAeirmist();
  const [isUpdating, setIsUpdating] = useState(false);
  const [settings, setSettings] = useState(profile.nglSettings || { enabled: true, audience: 'everyone' });

  const handleUpdate = async (newSettings: any) => {
    setIsUpdating(true);
    setSettings(newSettings);
    await updateProfile({ nglSettings: newSettings });
    setIsUpdating(false);
  };

  return (
    <div className="max-w-xl mx-auto space-y-8">
       <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan italic font-black">?</div>
              <div>
                 <h4 className="text-sm font-bold text-white">Anonymity</h4>
                 <p className="text-[10px] text-white/40 uppercase tracking-widest">Toggle your NGL presence</p>
              </div>
            </div>
            <button 
              onClick={() => handleUpdate({ ...settings, enabled: !settings.enabled })}
              className={`w-14 h-8 rounded-full transition-all relative ${settings.enabled ? 'bg-aeirmist-cyan' : 'bg-white/10'}`}
            >
              <motion.div 
                animate={{ x: settings.enabled ? 28 : 4 }}
                className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-xl"
              />
            </button>
          </div>

          <div className="h-px bg-white/5" />

          <div className="space-y-4">
             <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 pl-2">Who can send NGLs?</label>
             <div className="grid grid-cols-1 gap-3">
                {[
                  { id: 'everyone', label: 'Everyone', sub: 'Anyone can send you messages' },
                  { id: 'followers', label: 'Followers Only', sub: 'Only people you follow can send messages' },
                  { id: 'friends', label: 'Mutuals Only', sub: 'Only your close friends can send messages' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleUpdate({ ...settings, audience: opt.id })}
                    className={`p-6 rounded-2xl border text-left transition-all ${settings.audience === opt.id ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-aura-white shadow-inner shadow-aeirmist-cyan/5' : 'bg-white/[0.01] border-white/5 text-white/40 hover:bg-white/[0.03]'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] font-black uppercase tracking-widest ${settings.audience === opt.id ? 'text-aeirmist-cyan' : ''}`}>{opt.label}</span>
                      {settings.audience === opt.id && <Sparkles size={14} className="text-aeirmist-cyan animate-pulse" />}
                    </div>
                    <p className="text-[9px] font-medium opacity-60 tracking-wider uppercase">{opt.sub}</p>
                  </button>
                ))}
             </div>
          </div>
       </div>

       <div className="p-8 rounded-[2rem] bg-aeirmist-magenta/5 border border-aeirmist-magenta/20 flex items-center justify-between gap-6 group">
          <div className="flex items-center gap-4">
            <Shield className="text-aeirmist-magenta" />
            <div>
               <h4 className="text-sm font-bold text-white">AI Safety Filter</h4>
               <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed">Automatically filters mean messages and spam.</p>
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-aeirmist-magenta text-black text-[9px] font-black uppercase tracking-widest">Locked ON</div>
       </div>
    </div>
  );
};
export const NGLButton = ({ onClick, isOwn }: { onClick: () => void, isOwn?: boolean }) => (
  <motion.button
    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/70 flex items-center justify-center gap-3 transition-all hover:text-white hover:border-aeirmist-magenta/50"
  >
    <Ghost size={16} className="text-aeirmist-magenta" />
    <span className="text-[11px] font-black uppercase tracking-[0.2em]">
      {isOwn ? "Your NGL" : "Send NGL"}
    </span>
  </motion.button>
);

/**
 * NGL Anonymous Message Composer (for visitors)
 */
export const NGLComposer = ({ targetProfile, onClose }: { targetProfile: any, onClose: () => void }) => {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { sendNGL } = useNGL();

  const handleSend = async () => {
    if (!content.trim() || isSending) return;
    setIsSending(true);
    const success = await sendNGL(targetProfile.id, targetProfile.ownerUid || targetProfile.uid, content);
    if (success) {
      setSent(true);
      setTimeout(onClose, 2000);
    }
    setIsSending(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`w-full max-w-md p-8 rounded-[2.5rem] ${glassPanel} relative overflow-hidden`}
    >
      {/* Background Decor */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-aeirmist-magenta/10 blur-[100px] pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-aeirmist-cyan/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-tr from-aeirmist-magenta to-aeirmist-cyan p-0.5 mb-6 shadow-2xl">
          <div className="w-full h-full rounded-[1.9rem] bg-[#0a0a0a] flex items-center justify-center">
            <Ghost size={32} className="text-white" />
          </div>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white mb-2">Send an Anonymous Message</h2>
        <p className="text-xs text-white/40 font-black tracking-widest mb-8"><span className="uppercase">to</span> @{targetProfile.username}</p>

        {!sent ? (
          <>
            <div className={`w-full p-6 rounded-3xl bg-black/40 border border-white/5 mb-6 group focus-within:border-aeirmist-magenta/30 transition-all`}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 300))}
                placeholder="Ask something anonymously..."
                className="w-full bg-transparent border-none focus:ring-0 text-white placeholder:text-white/10 resize-none min-h-[120px] font-medium leading-relaxed"
              />
              <div className="flex justify-end pt-2">
                <span className={`text-[10px] font-mono ${content.length >= 280 ? 'text-aeirmist-magenta' : 'text-white/20'}`}>
                  {content.length}/300
                </span>
              </div>
            </div>

            <div className="flex gap-4 w-full">
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="flex-1 py-4 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white/40"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={content.trim() ? { scale: 1.05, boxShadow: '0 0 20px rgba(0, 242, 255, 0.4)' } : {}}
                whileTap={content.trim() ? { scale: 0.95 } : {}}
                onClick={handleSend}
                disabled={!content.trim() || isSending}
                className={`flex-[2] py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all overflow-hidden relative ${content.trim() ? neonButton : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
              >
                {isSending ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Send Message"}
                {content.trim() && !isSending && (
                  <motion.div 
                    initial={{ x: -100 }}
                    animate={{ x: 200 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-white/20 -skew-x-12"
                  />
                )}
              </motion.button>
            </div>
          </>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-12"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 border border-green-500/30">
              <Sparkles className="text-green-400" />
            </div>
            <p className="text-lg font-bold text-white mb-2">Message Sent!</p>
            <p className="text-xs text-white/40 font-medium">Your identity is protected.</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * NGL Dashboard (for owner)
 */
export const NGLDashboard = ({ profile, onClose }: { profile: any, onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'replies' | 'archive' | 'settings'>('inbox');
  const { messages, loading, markAsRead, archiveNGL, deleteNGL } = useNGL(profile.id);
  const { setCameraConfig } = useAeirmist();

  const unreadCount = messages.filter(m => m.status === 'unread').length;
  const filteredMessages = messages.filter(m => {
    if (activeTab === 'inbox') return (m.status === 'unread' || m.status === 'read' || m.status === 'replied') && !m.repliedAt;
    if (activeTab === 'replies') return !!m.repliedAt;
    if (activeTab === 'archive') return m.status === 'archived';
    return false;
  });

  const handleReply = (msg: NGLMessage) => {
    // Open Story Creator with NGL Sticker
    setCameraConfig({
      isOpen: true,
      mode: 'STORY',
      onCapture: (file) => {
        // This will be handled in StoryCreator component to overlay the NGL sticker
        console.log("Captured for NGL reply", file, msg);
      }
    });

    // Store the message being replied to in a temporary window/state to be used by StoryCreator
    (window as any).__PENDING_NGL_REPLY = msg;
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`w-full h-[95vh] md:h-full max-w-4xl mx-auto flex flex-col md:flex-row rounded-[2rem] md:rounded-[3rem] overflow-hidden ${glassPanel}`}
    >
      {/* Sidebar Navigation */}
      <div className="w-full md:w-72 bg-black/40 border-b md:border-b-0 md:border-r border-white/5 flex flex-col p-4 md:p-8 shrink-0">
        <div className="flex items-center gap-4 mb-6 md:mb-12">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-aeirmist-magenta/10 flex items-center justify-center border border-aeirmist-magenta/30">
            <Ghost className="text-aeirmist-magenta" size={20} />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Your NGL</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[8px] md:text-[9px] font-black uppercase text-white/40 tracking-widest">Online</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto no-scrollbar md:overflow-visible pb-2 md:pb-0">
          <NavTab active={activeTab === 'inbox'} label="Inbox" icon={<Inbox size={18} />} count={unreadCount} onClick={() => setActiveTab('inbox')} />
          <NavTab active={activeTab === 'replies'} label="Replies" icon={<Reply size={18} />} onClick={() => setActiveTab('replies')} />
          <NavTab active={activeTab === 'archive'} label="Archive" icon={<Archive size={18} />} onClick={() => setActiveTab('archive')} />
          <div className="hidden md:block h-px bg-white/5 my-4" />
          <NavTab active={activeTab === 'settings'} label="Settings" icon={<Settings size={18} />} onClick={() => setActiveTab('settings')} />
        </nav>

        <button 
          onClick={onClose}
          className="hidden md:flex mt-auto items-center gap-3 px-6 py-4 text-white/30 hover:text-white transition-all group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Profile</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#050505]">
        <header className="p-8 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <span className="text-sm font-black uppercase tracking-[0.3em] text-white/20">/</span>
             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">{activeTab}</h3>
          </div>
          {unreadCount > 0 && activeTab === 'inbox' && (
            <div className="px-4 py-1.5 rounded-full bg-aeirmist-magenta/20 border border-aeirmist-magenta/40 text-aeirmist-magenta text-[10px] font-black uppercase tracking-widest">
              {unreadCount} Unread
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
          {activeTab === 'settings' ? (
            <NGLSettingsTab profile={profile} />
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-aeirmist-cyan" />
            </div>
          ) : filteredMessages.length > 0 ? (
            <div className="grid grid-cols-1 gap-6">
              {filteredMessages.map((msg) => (
                <NGLCard 
                  key={msg.id} 
                  msg={msg} 
                  onRead={() => markAsRead(msg.id)} 
                  onArchive={() => archiveNGL(msg.id)}
                  onDelete={() => deleteNGL(msg.id)}
                  onReply={() => handleReply(msg)}
                />
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
              <Inbox size={48} className="mb-6" />
              <p className="text-xl font-bold uppercase tracking-widest">Inbox Empty</p>
              <p className="text-[10px] font-black uppercase tracking-widest mt-2">No messages yet.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const NavTab = ({ active, label, icon, count, onClick }: { active: boolean, label: string, icon: any, count?: number, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl transition-all whitespace-nowrap shrink-0 ${active ? 'bg-aeirmist-magenta text-black shadow-lg shadow-aeirmist-magenta/10' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
  >
    <div className="flex items-center gap-3 md:gap-4">
      {icon}
      <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">{label}</span>
    </div>
    {count ? (
      <span className={`ml-2 text-[9px] md:text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${active ? 'bg-black/20 text-black' : 'bg-aeirmist-magenta/20 text-aeirmist-magenta'}`}>
        {count}
      </span>
    ) : null}
  </button>
);

const NGLCard = ({ msg, onRead, onArchive, onDelete, onReply }: { msg: NGLMessage, onRead: () => void, onArchive: () => void, onDelete: () => void, onReply: () => void }) => {
  const isReplied = msg.status === 'replied';
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => msg.status === 'unread' && onRead()}
      className={`p-6 rounded-[2rem] border transition-all cursor-pointer group relative overflow-hidden ${msg.status === 'unread' ? 'bg-white/[0.05] border-aeirmist-magenta/30 shadow-[0_10px_30px_rgba(255,0,234,0.05)]' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}
    >
      {msg.status === 'unread' && (
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-aeirmist-magenta/20 to-transparent pointer-events-none" />
      )}

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${msg.status === 'unread' ? 'bg-aeirmist-magenta text-white shadow-glow' : 'bg-white/5 text-white/30'}`}>
            <Ghost size={14} />
          </div>
          <div>
             <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Anonymous Signal</p>
             <p className="text-[8px] font-mono text-white/20">{new Date(msg.createdAt?.toDate?.() || Date.now()).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isReplied && (
            <motion.button 
              whileHover={{ scale: 1.1 }}
              onClick={(e) => { e.stopPropagation(); onReply(); }}
              className="p-2 rounded-lg bg-aeirmist-cyan/10 text-aeirmist-cyan hover:bg-aeirmist-cyan hover:text-black transition-all"
            >
              <Reply size={14} />
            </motion.button>
          )}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            className="p-2 rounded-lg bg-white/5 text-white/30 hover:text-white transition-all"
          >
            <Archive size={14} />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
          >
            <Trash2 size={14} />
          </motion.button>
        </div>
      </div>

      <p className="text-base text-white font-medium leading-relaxed mb-4 pl-1">
        {msg.content}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          {isReplied && (
            <div className="flex items-center gap-1.5 text-green-400 text-[9px] font-black uppercase tracking-widest">
              <Sparkles size={10} />
              Replied to Story
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-white/20">
          Hash: {msg.id.slice(0, 8).toUpperCase()}
        </div>
      </div>
    </motion.div>
  );
};

// --- NGL STORY STICKER ---

export const NGLSticker: React.FC<{ message: NGLMessage }> = ({ message }) => {
  return (
    <motion.div
      drag
      dragConstraints={{ top: -300, bottom: 300, left: -200, right: 200 }}
      whileHover={{ scale: 1.05, cursor: 'grab' }}
      whileTap={{ scale: 0.95, cursor: 'grabbing' }}
      initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      className="p-8 rounded-[2.5rem] bg-black/60 backdrop-blur-3xl border-2 border-aeirmist-magenta/40 shadow-[0_20px_50px_rgba(255,0,234,0.3)] relative select-none max-w-[320px] mx-auto z-50 touch-none"
    >
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-6 py-2 bg-aeirmist-magenta text-black text-[10px] font-black uppercase tracking-[0.3em] rounded-full shadow-[0_0_20px_rgba(255,0,234,0.5)]">
        Anonymous Message
      </div>
      
      <div className="my-4 p-6 bg-white/[0.03] rounded-3xl border border-white/5 shadow-inner">
        <p className="text-white text-xl font-bold text-center leading-relaxed italic drop-shadow-lg">
           "{message.content}"
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 opacity-60">
          <Ghost size={14} className="text-aeirmist-magenta animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white">Sent via Aeirmist NGL</span>
        </div>
        <p className="text-[8px] font-mono text-white/20 uppercase">Encrypted Message #{message.id.slice(0, 8)}</p>
      </div>
      
      {/* Decorative pulse element */}
      <div className="absolute inset-0 rounded-[2.5rem] border border-aeirmist-magenta/20 animate-pulse pointer-events-none" />
    </motion.div>
  );
};
