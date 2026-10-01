import React from 'react';
import { motion } from 'motion/react';
import { Pin, BellOff, Trash2, Archive, CheckCircle, UserMinus, ShieldAlert, Edit2, Heart, UserPlus, UserCircle, Share2, Ban, Eraser, Flag, Lock } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { useReport } from '../reporting/ReportContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


interface ChatContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  isVanishMode?: boolean;
  isUnread?: boolean;
  isCloseFriend?: boolean;
  chatId: string;
  otherParticipantId?: string;
  onViewProfile?: () => void;
}

export const ChatContextMenu: React.FC<ChatContextMenuProps> = ({ x, y, onClose, isPinned, isMuted, isArchived, isUnread, isCloseFriend, chatId, otherParticipantId, onViewProfile }) => {
  const { openReportModal } = useReport();
  const { toggleCloseFriend, user, profile, db, toggleNotification, deleteConversation, markAsRead, markAsUnread, toggleBlockUser, toggleRestrictUser, clearChat, submitReport, addToast } = useAeirmist();
  const [reportModalOpen, setReportModalOpen] = React.useState(false);
  const [reportReason, setReportReason] = React.useState('');
  const [confirmAction, setConfirmAction] = React.useState<null | {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
    extraOption?: { label: string; onSelect: () => void | Promise<void> };
  }>(null);

  // Adjustment to prevent menu overflow at screen edges
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = React.useState({ left: x, top: y });

  const handleAction = async (type: 'mute' | 'pin' | 'delete' | 'read' | 'unread' | 'archive' | 'block' | 'restrict' | 'clear' | 'report') => {
    if (!db || !chatId) return;
    try {
      if (type === 'mute' || type === 'pin' || type === 'archive') {
        await toggleNotification(type, chatId);
      } else if (type === 'delete') {
        setConfirmAction({
          title: 'Delete Chat',
          message: 'Are you sure you want to delete this chat history? This cannot be undone.',
          confirmLabel: 'Delete',
          onConfirm: async () => { await deleteConversation(chatId); },
        });
        return;
      } else if (type === 'read') {
        await markAsRead(chatId);
      } else if (type === 'unread') {
        await markAsUnread(chatId);
      } else if (type === 'clear') {
        setConfirmAction({
          title: 'Clear Chat History',
          message: 'Clear this chat for yourself, or for both participants?',
          confirmLabel: 'Clear for Me',
          onConfirm: async () => {
            await clearChat(chatId, 'me');
            addToast({ title: 'Chat cleared', message: 'Chat history cleared.', type: 'success' });
          },
          extraOption: {
            label: 'Clear for Both',
            onSelect: async () => {
              await clearChat(chatId, 'both');
              addToast({ title: 'Chat cleared', message: 'Chat history cleared for both participants.', type: 'success' });
            },
          },
        });
        return;
      } else if (type === 'restrict') {
        const otherId = otherParticipantId || chatId.split('_').find(id => id !== profile?.id);
        if (otherId) {
          const isCurrentlyRestricted = (profile?.social?.restricted || []).includes(otherId);
          setConfirmAction({
            title: isCurrentlyRestricted ? 'Remove Restriction' : 'Restrict User',
            message: isCurrentlyRestricted
              ? 'Remove restriction for this user?'
              : "Restrict this user? Messages will go to Requests, and they won't trigger read receipts or typing indicators.",
            confirmLabel: isCurrentlyRestricted ? 'Remove' : 'Restrict',
            onConfirm: async () => { await toggleRestrictUser(otherId); },
          });
        }
        return;
      } else if (type === 'block') {
        const otherId = otherParticipantId || chatId.split('_').find(id => id !== profile?.id);
        if (otherId) {
          const isCurrentlyBlocked = (profile?.social?.blocked || []).includes(otherId);
          setConfirmAction({
            title: isCurrentlyBlocked ? 'Unblock User' : 'Block User',
            message: isCurrentlyBlocked ? 'Unblock this user?' : 'Block this user? Communication will be blocked.',
            confirmLabel: isCurrentlyBlocked ? 'Unblock' : 'Block',
            onConfirm: async () => { await toggleBlockUser(otherId); },
          });
        }
        return;
      } else if (type === 'report') {
        const otherId = otherParticipantId || chatId.split('_').find(id => id !== profile?.id);
        openReportModal('conversation', chatId, otherId || '');
        onClose();
        return;
      }
    } catch (e) {
      logger.error("Context menu action error", e);
    }
    onClose();
  };

  const handleToggleCloseFriend = async () => {
    // We need the other user's ID
    if (!db || !chatId) return;
    try {
      const chatDoc = await getDoc(doc(db, 'conversations', chatId));
      if (chatDoc.exists()) {
        const otherId = chatDoc.data().participants?.find((id: string) => id !== profile?.id);
        if (otherId) {
          await toggleCloseFriend(otherId);
        }
      }
    } catch (e) {
      logger.error("Context menu close friend error", e);
    }
    onClose();
  };

  const handleSubmitReport = async () => {
    if (!reportReason.trim()) return;
    const otherId = otherParticipantId || chatId.split('_').find(id => id !== profile?.id);
    await submitReport?.({
      targetType: 'conversation',
      targetId: chatId,
      reason: reportReason.trim(),
      description: `Reported conversation thread with target participant ID: ${otherId || 'unknown'}`
    });
    setReportModalOpen(false);
    setReportReason('');
  };

  React.useEffect(() => {
    if (menuRef.current) {
      const { offsetWidth, offsetHeight } = menuRef.current;
      const { innerWidth, innerHeight } = window;
      const margin = 12;

      let left = x;
      let top = y;

      // Flip to the other side if it would overflow, same as before
      if (x + offsetWidth > innerWidth - margin) left = x - offsetWidth;
      if (y + offsetHeight > innerHeight - margin) top = y - offsetHeight;

      // Always clamp fully inside the viewport, regardless of flip result.
      // This is what actually prevents the menu from ever being cut off at
      // any edge, even when it's taller/wider than the available space.
      left = Math.max(margin, Math.min(left, innerWidth - offsetWidth - margin));
      top = Math.max(margin, Math.min(top, innerHeight - offsetHeight - margin));

      setAdjustedPos({ left, top });
    }
  }, [x, y]);

  const otherId = otherParticipantId || chatId.split('_').find(id => id !== profile?.id);
  const isBlocked = otherId ? (profile?.social?.blocked || []).includes(otherId) : false;
  const isRestrictedUser = otherId ? (profile?.social?.restricted || []).includes(otherId) : false;

  return (
    <>
      <div className="fixed inset-0 z-[100] cursor-default" onClick={onClose} />
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)', y: 10 }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
        exit={{ opacity: 0, scale: 0.9, filter: 'blur(20px)', y: 10 }}
        className="fixed z-[101] w-72 glass-panel border border-white/20 rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] backdrop-blur-[50px] p-2.5 overflow-hidden"
        style={{ left: adjustedPos.left, top: adjustedPos.top, maxHeight: 'calc(100dvh - 24px)' }}
      >
        {/* Holographic Header Decor */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[1px] bg-gradient-to-r from-transparent via-aeirmist-cyan to-transparent opacity-50" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-[1px] bg-gradient-to-r from-transparent via-aeirmist-magenta to-transparent opacity-30" />

        <div className="max-h-[calc(100dvh-56px)] overflow-y-auto no-scrollbar space-y-1 py-1">
          <div className="px-5 py-3 mb-1">
             <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Connections Actions</span>
             </div>
             <p className="text-[8px] text-white/10 uppercase font-black italic">Link Configuration</p>
          </div>

          <MenuItem icon={<CheckCircle size={15} />} label={isUnread ? "Mark as Read" : "Mark as Unread"} onClick={() => handleAction(isUnread ? 'read' : 'unread')} accentColor="text-aeirmist-cyan" />
          <MenuItem icon={<Pin size={15} />} label={isPinned ? "Unpin Connections" : "Pin Connections"} onClick={() => handleAction('pin')} />
          <MenuItem icon={<BellOff size={15} />} label={isMuted ? "Unmute" : "Mute"} onClick={() => handleAction('mute')} />
          <MenuItem icon={<Archive size={15} />} label={isArchived ? "Restore Thread" : "Archive Thread"} onClick={() => handleAction('archive')} />
          <MenuItem 
            icon={<Lock size={15} />} 
            label="Move to Private Vault" 
            onClick={async () => {
              if (!db || !chatId || !profile?.id) return;
              try {
                const convRef = doc(db, 'conversations', chatId);
                await updateDoc(convRef, {
                  [`isVaulted.${profile.id}`]: true,
                  [`isMuted.${profile.id}`]: true
                });
              } catch (e) {
                logger.error("Vault move error", e);
              }
              onClose();
            }} 
            accentColor="text-aeirmist-cyan"
          />
          
          <div className="h-px bg-white/5 my-2 mx-3" />
          
          <MenuItem 
            icon={<UserPlus size={15} />} 
            label={isCloseFriend ? "Remove from Close Friends" : "Add to Close Friends"} 
            onClick={handleToggleCloseFriend} 
            accentColor={isCloseFriend ? "text-aeirmist-magenta" : "text-aeirmist-lime"} 
          />
          
          <div className="h-px bg-white/5 my-2 mx-3" />

          <MenuItem 
            icon={<UserCircle size={15} />} 
            label="View Profile" 
            onClick={() => { onClose(); if (onViewProfile) onViewProfile(); else addToast({ title: 'Unavailable', message: 'Profile view is not available here.', type: 'info' }); }} 
          />
          <MenuItem icon={<Share2 size={15} />} label="Share Chat" onClick={() => {
            onClose();
            navigator.clipboard.writeText(`${window.location.origin}/messages/${chatId}`)
              .then(() => addToast({ title: 'Link copied', message: 'Chat link copied to clipboard.', type: 'success' }))
              .catch(() => addToast({ title: 'Copy failed', message: 'Could not copy the link. Please try again.', type: 'warning' }));
          }} />
          <MenuItem icon={<Eraser size={15} />} label="Clear Chat History" onClick={() => handleAction('clear')} />

          <div className="h-px bg-white/5 my-2 mx-3" />
          
          <MenuItem icon={<ShieldAlert size={15} />} label={isRestrictedUser ? "Unrestrict User" : "Restrict User"} onClick={() => handleAction('restrict')} />
          <MenuItem icon={<Flag size={15} />} label="Report Chat" onClick={() => handleAction('report')} variant="danger" />
          <MenuItem icon={<Ban size={15} />} label={isBlocked ? "Unblock User" : "Block User"} variant="danger" onClick={() => handleAction('block')} />
          <MenuItem icon={<Trash2 size={15} />} label="Delete Chat" variant="danger" onClick={() => handleAction('delete')} />
        </div>
      </motion.div>

      {confirmAction && (
        <div
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
          onClick={() => setConfirmAction(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm p-6 rounded-3xl bg-[#0a0c10] border border-white/10"
          >
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2">{confirmAction.title}</h3>
            <p className="text-xs text-white/50 leading-relaxed mb-5">{confirmAction.message}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  await action?.onConfirm();
                  onClose();
                }}
                className="w-full py-3 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest"
              >
                {confirmAction.confirmLabel}
              </button>
              {confirmAction.extraOption && (
                <button
                  onClick={async () => {
                    const action = confirmAction;
                    setConfirmAction(null);
                    await action?.extraOption?.onSelect();
                    onClose();
                  }}
                  className="w-full py-3 rounded-xl bg-white/5 text-white text-[10px] font-black uppercase tracking-widest"
                >
                  {confirmAction.extraOption.label}
                </button>
              )}
              <button
                onClick={() => setConfirmAction(null)}
                className="w-full py-3 rounded-xl bg-white/5 text-white/50 text-[10px] font-black uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {reportModalOpen && (
        <div
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
          onClick={() => setReportModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm p-6 rounded-3xl bg-[#0a0c10] border border-white/10"
          >
            <div className="flex items-center gap-2 mb-1">
              <Flag size={16} className="text-aeirmist-magenta" />
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Report Chat</h3>
            </div>
            <p className="text-[10px] text-white/40 mb-4">Tell us what's wrong with this conversation.</p>
            <textarea
              autoFocus
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe the issue..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-aeirmist-magenta/50 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setReportModalOpen(false); setReportReason(''); }}
                className="flex-1 py-3 rounded-xl bg-white/5 text-white/50 text-[10px] font-black uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={!reportReason.trim()}
                className="flex-1 py-3 rounded-xl bg-aeirmist-magenta text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const MenuItem = ({ icon, label, onClick, variant = 'default', accentColor }: { icon: React.ReactNode, label: string, onClick?: () => void, variant?: 'default' | 'danger', accentColor?: string }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 group ${
      variant === 'danger' 
        ? 'text-aeirmist-magenta/60 hover:text-aeirmist-magenta hover:bg-aeirmist-magenta/10' 
        : `text-white/50 hover:text-white hover:bg-white/5 ${accentColor || ''}`
    }`}
  >
    <div className={`transition-transform duration-300 group-hover:scale-110 ${variant === 'danger' ? 'text-aeirmist-magenta' : accentColor || 'text-white/40 group-hover:text-aeirmist-cyan'}`}>
      {icon}
    </div>
    <span className="truncate">{label}</span>
  </button>
);
