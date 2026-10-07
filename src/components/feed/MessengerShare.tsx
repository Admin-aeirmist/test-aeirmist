import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Send, Users, User, Check, Loader2 } from 'lucide-react';
import { api } from '../../services/api/client';
import { getAvatarUrl } from '../../lib/avatar';
import { logger } from '@/src/utils/logger';


interface MessengerShareProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (chatId: string) => Promise<void>;
  db?: any;
  profile: any;
}

export const MessengerShare: React.FC<MessengerShareProps> = ({ isOpen, onClose, onShare, profile }) => {
  const [chats, setChats] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !profile?.id) return;

    let isCancelled = false;
    setLoading(true);

    api.chat.getConversations().then((res: any) => {
      if (isCancelled) return;
      const convs = (res as any)?.conversations || (Array.isArray(res) ? res : []);
      const mediaBase = (import.meta.env.VITE_MEDIA_URL || 'http://localhost:4000/media').replace(/\/+$/, '');
      const mapped = convs.map((c: any) => {
        const other = c.participants?.find((p: any) => p.userId !== profile.id && p.userId !== profile.uid) || c.participants?.[0];
        const isGroup = Boolean(c.isGroup || (c.participants && c.participants.length > 2) || c.title);
        return {
          id: c.id,
          ...c,
          isGroup,
          groupName: c.title || 'Group Chat',
          otherParticipantName: other?.displayName || other?.username || 'User',
          groupAvatar: c.avatarKey ? `${mediaBase}/${c.avatarKey}` : (c.avatarUrl || undefined),
          otherParticipantPhoto: other?.avatarKey ? `${mediaBase}/${other.avatarKey}` : (other?.avatarUrl || getAvatarUrl(other?.photoURL || null, other?.userId)),
          otherId: other?.userId
        };
      });
      setChats(mapped);
      setLoading(false);
    }).catch(err => {
      if (isCancelled) return;
      logger.error('Failed to load conversations for sharing:', err);
      setLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, profile?.id, profile?.uid]);

  const filteredChats = chats.filter(chat => {
    const name = chat.isGroup ? chat.groupName : chat.otherParticipantName;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSend = async (chatId: string) => {
    setSendingId(chatId);
    try {
      await onShare(chatId);
      setSentIds(prev => new Set(prev).add(chatId));
    } catch (err) {
      logger.error(err);
    } finally {
      setSendingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-md bg-[#0a0a0f] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Send to Chat</h3>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={14} />
            <input 
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-xs text-white focus:border-aeirmist-cyan outline-none transition-all"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 opacity-20">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest">Scanning Waves...</p>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-12 opacity-20">
              <p className="text-[10px] font-black uppercase tracking-widest">No active chats found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredChats.map((chat) => {
                const isSent = sentIds.has(chat.id);
                const isSending = sendingId === chat.id;
                const name = chat.isGroup ? (chat.groupName || 'Group Chat') : (chat.otherParticipantName || 'User');
                const avatar = chat.isGroup ? chat.groupAvatar : chat.otherParticipantPhoto;

                return (
                  <div 
                    key={chat.id}
                    className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img 
                          src={getAvatarUrl(avatar)} 
                          alt="" 
                          className="w-10 h-10 rounded-xl object-cover border border-white/5"
                        />
                        <div className="absolute -bottom-1 -right-1 p-0.5 bg-black rounded-lg border border-white/10">
                          {chat.isGroup ? <Users size={10} className="text-aeirmist-magenta" /> : <User size={10} className="text-aeirmist-cyan" />}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white tracking-tight">{name}</p>
                        <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">
                          {chat.isGroup ? 'Group' : 'Direct'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => !isSent && handleSend(chat.id)}
                      disabled={isSent || isSending}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        isSent 
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                          : 'bg-aeirmist-cyan/10 text-aeirmist-cyan border border-aeirmist-cyan/20 hover:bg-aeirmist-cyan hover:text-black'
                      }`}
                    >
                      {isSending ? <Loader2 size={12} className="animate-spin mx-auto" /> : isSent ? <Check size={12} className="mx-auto" /> : 'Send'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
