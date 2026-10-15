import React from 'react';
import { motion } from 'motion/react';
import { Pin, BellOff, Trash2, Archive, CheckCircle, ShieldAlert, Ban, Eraser, Lock } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { doc, updateDoc } from 'firebase/firestore';
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

export const ChatContextMenu: React.FC<ChatContextMenuProps> = ({
  x,
  y,
  onClose,
  isPinned,
  isMuted,
  isArchived,
  isUnread,
  chatId,
  otherParticipantId,
}) => {
  const {
    profile,
    db,
    toggleNotification,
    deleteConversation,
    markAsRead,
    markAsUnread,
    toggleBlockUser,
    toggleRestrictUser,
    clearChat,
    addToast,
  } = useAeirmist();

  const [confirmAction, setConfirmAction] = React.useState<null | {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
    extraOption?: { label: string; onSelect: () => void | Promise<void> };
  }>(null);

  const menuRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = React.useState({ left: x, top: y });

  const otherId = otherParticipantId || chatId.split('_').find((id) => id !== profile?.id);
  const isBlocked = otherId ? (profile?.social?.blocked || []).includes(otherId) : false;
  const isRestrictedUser = otherId ? (profile?.social?.restricted || []).includes(otherId) : false;

  const handleAction = async (type: 'mute' | 'pin' | 'delete' | 'read' | 'unread' | 'archive' | 'block' | 'restrict' | 'clear') => {
    if (!chatId) return;
    try {
      if (type === 'mute' || type === 'pin' || type === 'archive') {
        await toggleNotification(type, chatId);
      } else if (type === 'delete') {
        setConfirmAction({
          title: 'Delete Chat',
          message: 'Are you sure you want to delete this chat? This cannot be undone.',
          confirmLabel: 'Delete',
          onConfirm: async () => {
            await deleteConversation(chatId);
          },
        });
        return;
      } else if (type === 'read') {
        await markAsRead(chatId);
        addToast?.({ title: 'Marked as read', message: 'Conversation marked as read.', type: 'success' });
      } else if (type === 'unread') {
        await markAsUnread(chatId);
        addToast?.({ title: 'Marked as unread', message: 'Conversation marked as unread.', type: 'info' });
      } else if (type === 'clear') {
        setConfirmAction({
          title: 'Clear Chat History',
          message: 'Clear messages for yourself, or delete for both participants?',
          confirmLabel: 'Clear for Me',
          onConfirm: async () => {
            await clearChat(chatId, 'me');
            addToast({ title: 'Chat cleared', message: 'Chat history cleared for you.', type: 'success' });
          },
          extraOption: {
            label: 'Clear for Both',
            onSelect: async () => {
              await clearChat(chatId, 'both');
              addToast({ title: 'Chat cleared', message: 'Chat history cleared for everyone.', type: 'success' });
            },
          },
        });
        return;
      } else if (type === 'restrict') {
        if (otherId) {
          const isCurrentlyRestricted = (profile?.social?.restricted || []).includes(otherId);
          setConfirmAction({
            title: isCurrentlyRestricted ? 'Remove Restriction' : 'Restrict User',
            message: isCurrentlyRestricted
              ? 'Remove restriction for this user?'
              : "Restrict this user? Messages will move to Requests without read receipts.",
            confirmLabel: isCurrentlyRestricted ? 'Remove' : 'Restrict',
            onConfirm: async () => {
              await toggleRestrictUser(otherId);
            },
          });
        }
        return;
      } else if (type === 'block') {
        if (otherId) {
          const isCurrentlyBlocked = (profile?.social?.blocked || []).includes(otherId);
          setConfirmAction({
            title: isCurrentlyBlocked ? 'Unblock User' : 'Block User',
            message: isCurrentlyBlocked ? 'Unblock this user?' : 'Block this user? Direct communication will be disabled.',
            confirmLabel: isCurrentlyBlocked ? 'Unblock' : 'Block',
            onConfirm: async () => {
              await toggleBlockUser(otherId);
            },
          });
        }
        return;
      }
    } catch (e) {
      logger.error('Context menu action error', e);
    }
    onClose();
  };

  const handleLockVault = async () => {
    if (!chatId || !profile?.id) return;
    try {
      if (db) {
        const convRef = doc(db, 'conversations', chatId);
        await updateDoc(convRef, {
          [`isVaulted.${profile.id}`]: true,
          [`isMuted.${profile.id}`]: true,
        }).catch(() => {});
      }
      window.dispatchEvent(
        new CustomEvent('aeirmist_chat_setting_changed', {
          detail: { conversationId: chatId, type: 'vault', value: true },
        })
      );
      addToast?.({
        title: 'Chat Locked',
        message: 'Conversation secured in your Secret Vault.',
        type: 'success',
      });
    } catch (e) {
      logger.error('Vault move error', e);
    }
    onClose();
  };

  React.useEffect(() => {
    if (menuRef.current) {
      const { offsetWidth, offsetHeight } = menuRef.current;
      const { innerWidth, innerHeight } = window;
      const margin = 12;

      let left = x;
      let top = y;

      if (x + offsetWidth > innerWidth - margin) left = x - offsetWidth;
      if (y + offsetHeight > innerHeight - margin) top = y - offsetHeight;

      left = Math.max(margin, Math.min(left, innerWidth - offsetWidth - margin));
      top = Math.max(margin, Math.min(top, innerHeight - offsetHeight - margin));

      setAdjustedPos({ left, top });
    }
  }, [x, y]);

  return (
    <>
      <div className="fixed inset-0 z-[100] cursor-default" onClick={onClose} />
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.94, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 6 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed z-[101] w-56 sm:w-60 bg-[#0d1117]/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl p-1.5 overflow-hidden"
        style={{ left: adjustedPos.left, top: adjustedPos.top, maxHeight: 'calc(100dvh - 24px)' }}
      >
        <div className="overflow-y-auto no-scrollbar space-y-0.5">
          {/* Quick Read/Unread & Pinned */}
          <MenuItem
            icon={<CheckCircle size={14} className={isUnread ? 'text-aeirmist-cyan' : 'text-white/50'} />}
            label={isUnread ? 'Mark as Read' : 'Mark as Unread'}
            onClick={() => handleAction(isUnread ? 'read' : 'unread')}
          />
          <MenuItem
            icon={<Pin size={14} className={isPinned ? 'text-aeirmist-cyan' : 'text-white/50'} />}
            label={isPinned ? 'Unpin Chat' : 'Pin Chat'}
            onClick={() => handleAction('pin')}
          />
          <MenuItem
            icon={<BellOff size={14} className={isMuted ? 'text-amber-400' : 'text-white/50'} />}
            label={isMuted ? 'Unmute Chat' : 'Mute Chat'}
            onClick={() => handleAction('mute')}
          />
          <MenuItem
            icon={<Archive size={14} className={isArchived ? 'text-aeirmist-cyan' : 'text-white/50'} />}
            label={isArchived ? 'Restore Chat' : 'Archive Chat'}
            onClick={() => handleAction('archive')}
          />
          <MenuItem
            icon={<Lock size={14} className="text-aeirmist-cyan" />}
            label="Lock Chat (Secret Vault)"
            onClick={handleLockVault}
          />

          <div className="h-px bg-white/5 my-1" />

          {/* Chat Maintenance */}
          <MenuItem
            icon={<Eraser size={14} className="text-white/50" />}
            label="Clear Chat History"
            onClick={() => handleAction('clear')}
          />
          <MenuItem
            icon={<ShieldAlert size={14} className={isRestrictedUser ? 'text-amber-400' : 'text-white/50'} />}
            label={isRestrictedUser ? 'Unrestrict User' : 'Restrict User'}
            onClick={() => handleAction('restrict')}
          />

          <div className="h-px bg-white/5 my-1" />

          {/* Danger Zone */}
          <MenuItem
            icon={<Ban size={14} />}
            label={isBlocked ? 'Unblock User' : 'Block User'}
            variant="danger"
            onClick={() => handleAction('block')}
          />
          <MenuItem
            icon={<Trash2 size={14} />}
            label="Delete Chat"
            variant="danger"
            onClick={() => handleAction('delete')}
          />
        </div>
      </motion.div>

      {confirmAction && (
        <div
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
          onClick={() => setConfirmAction(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm p-5 rounded-2xl bg-[#0a0c10] border border-white/10 shadow-2xl"
          >
            <h3 className="text-sm font-bold text-white mb-1.5">{confirmAction.title}</h3>
            <p className="text-xs text-white/60 leading-relaxed mb-5">{confirmAction.message}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  onClose();
                  await action?.onConfirm();
                }}
                className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors cursor-pointer active:scale-95"
              >
                {confirmAction.confirmLabel}
              </button>
              {confirmAction.extraOption && (
                <button
                  onClick={async () => {
                    const action = confirmAction;
                    setConfirmAction(null);
                    onClose();
                    await action?.extraOption?.onSelect();
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer active:scale-95"
                >
                  {confirmAction.extraOption.label}
                </button>
              )}
              <button
                onClick={() => setConfirmAction(null)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'danger';
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onClick, variant = 'default' }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 text-left ${
      variant === 'danger'
        ? 'text-red-400/80 hover:text-red-400 hover:bg-red-500/10'
        : 'text-white/70 hover:text-white hover:bg-white/10'
    }`}
  >
    <div className={`shrink-0 transition-transform duration-150 ${variant === 'danger' ? 'text-red-400' : ''}`}>
      {icon}
    </div>
    <span className="truncate">{label}</span>
  </button>
);
