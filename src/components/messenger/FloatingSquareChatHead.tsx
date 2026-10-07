import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Maximize2, SquarePen, Plus } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';
import { SystemChatHead } from '../../utils/nativeSettings';
import { DockedChatWindow } from './DockedChatWindow';

interface FloatingSquareChatHeadProps {
  onOpenChat: (chatId: string) => void;
  onNewMessage?: () => void;
  isInboxView?: boolean;
}

type Head = { id: string; name: string; photo?: string; unreadCount?: number; participantId?: string };

interface MessagePreview {
  text: string;
  senderName: string;
}

const HeadBubble: React.FC<{
  head: Head;
  isOpenInDock?: boolean;
  preview?: MessagePreview;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
}> = ({ head, isOpenInDock, preview, onOpen, onClose }) => {
  const { onlineUsers } = useAeirmist();
  const [isHovered, setIsHovered] = useState(false);
  const avatar = getAvatarUrl(head.photo);
  const isOnline = !!(
    (head.participantId && onlineUsers?.has(head.participantId)) ||
    onlineUsers?.has(head.id)
  );

  return (
    <motion.div
      layout
      initial={{ scale: 0, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => { e.stopPropagation(); onOpen(head.id); }}
      className="relative cursor-pointer group select-none"
    >
      {/* Squircle / Circular frame — Facebook style with Aeirmist cyber aesthetics */}
      <div 
        className={`relative w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-neutral-900 border-2 transition-all duration-200 group-hover:scale-105 active:scale-95 overflow-hidden ${
          isOpenInDock
            ? 'border-aeirmist-cyan shadow-[0_0_20px_rgba(0,242,255,0.45)] ring-2 ring-aeirmist-cyan/30'
            : 'border-white/15 hover:border-aeirmist-cyan/70 shadow-[0_8px_25px_rgba(0,0,0,0.5)]'
        }`}
      >
        <img
          src={avatar}
          alt={head.name}
          className="w-full h-full object-cover rounded-xl"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 -z-10 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 text-aeirmist-cyan">
          <MessageSquare size={22} />
        </div>
        {/* Active online badge */}
        {isOnline && (
          <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-neutral-950 ring-1 ring-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
        )}
        
        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
          <Maximize2 size={16} className="text-white drop-shadow-md" />
        </div>
      </div>

      {/* Unread badge up to 9+ */}
      {!!head.unreadCount && head.unreadCount > 0 && (
        <div className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 border-2 border-[#0c0d14] text-[9px] font-black text-white flex items-center justify-center shadow-[0_0_10px_rgba(244,63,94,0.7)] animate-pulse select-none">
          {head.unreadCount > 9 ? '9+' : head.unreadCount}
        </div>
      )}

      {/* Live Message Pop-up Preview Bubble */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, x: -15, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -15, scale: 0.9 }}
            className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-auto px-3.5 py-2 rounded-2xl bg-[#0e1019]/98 backdrop-blur-2xl border border-aeirmist-cyan/50 text-white shadow-[0_0_25px_rgba(0,242,255,0.35)] z-50 min-w-[140px] max-w-[230px] cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(head.id);
            }}
          >
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-aeirmist-cyan font-bold text-[10px] truncate">{preview.senderName || head.name}</span>
              <span className="text-[8px] text-white/40 font-mono">now</span>
            </div>
            <p className="text-white/90 text-[11px] truncate leading-tight font-medium">{preview.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Name tooltip */}
      <AnimatePresence>
        {!preview && isHovered && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none px-3 py-1.5 rounded-xl bg-black/90 backdrop-blur-md border border-white/15 text-white text-[11px] font-bold whitespace-nowrap shadow-2xl z-50 flex items-center gap-1.5"
          >
            <span className="truncate max-w-[130px] block">{head.name}</span>
            {isOpenInDock && <span className="text-[9px] text-aeirmist-cyan font-mono">• open</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close button on hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(head.id); }}
        title="Dismiss Chat Head"
        className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-neutral-900 border border-white/20 text-white/70 hover:text-white hover:bg-rose-600 transition-all flex items-center justify-center shadow-lg cursor-pointer opacity-80 sm:opacity-0 group-hover:opacity-100"
      >
        <X size={11} strokeWidth={3} />
      </button>
    </motion.div>
  );
};

export const FloatingSquareChatHead: React.FC<FloatingSquareChatHeadProps> = ({ 
  onOpenChat, 
  onNewMessage,
  isInboxView = false 
}) => {
  const { floatingChatHeads, removeFloatingChatHead, profile, addToast } = useAeirmist();
  const [openChatIds, setOpenChatIds] = useState<string[]>([]);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  const [activePreviews, setActivePreviews] = useState<Record<string, MessagePreview>>({});

  // Responsive breakpoint tracking
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chatHeadsEnabled = profile?.messagingSettings?.enableChatHeads !== false;
  const heads: Head[] = chatHeadsEnabled ? (floatingChatHeads || []) : [];

  // Automatically keep openChatIds synced with active heads
  useEffect(() => {
    setOpenChatIds(prev => prev.filter(id => heads.some(h => h.id === id)));
  }, [heads]);

  // Listen for real-time incoming message pop-up preview events
  useEffect(() => {
    const handlePreview = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.chatId || !detail?.text) return;

      setActivePreviews(prev => ({
        ...prev,
        [detail.chatId]: { text: detail.text, senderName: detail.senderName || 'Message' }
      }));

      // Auto-dismiss preview popup after 6 seconds
      setTimeout(() => {
        setActivePreviews(prev => {
          const next = { ...prev };
          delete next[detail.chatId];
          return next;
        });
      }, 6000);
    };

    window.addEventListener('aeirmist_chathead_preview', handlePreview);
    return () => window.removeEventListener('aeirmist_chathead_preview', handlePreview);
  }, []);

  // Stable key so native sync only runs when something actually changed
  const headsKey = heads.map(h => `${h.id}|${h.name}|${h.photo || ''}|${h.unreadCount || 0}`).join(';');

  // ── Sync with native system-wide overlay (Android app background service) ──
  useEffect(() => {
    if (!SystemChatHead.isSupported()) return;
    let cancelled = false;

    if (heads.length === 0) {
      SystemChatHead.disable();
      return;
    }

    const payload = heads.map(h => {
      const url = getAvatarUrl(h.photo);
      return {
        id: h.id,
        name: h.name || 'Chat',
        avatarUrl: typeof url === 'string' && url.startsWith('http') ? url : '',
        unread: h.unreadCount || 0,
      };
    });

    const tryEnable = async () => {
      const granted = await SystemChatHead.hasPermission();
      if (cancelled) return;
      if (granted) {
        await SystemChatHead.enable({ heads: JSON.stringify(payload) });
        return;
      }
      if (!localStorage.getItem('aeirmist_overlay_prompted')) {
        localStorage.setItem('aeirmist_overlay_prompted', '1');
        addToast?.({
          title: 'Allow chat heads outside the app',
          message: 'Turn on "Display over other apps" for Aeirmist to keep chat heads on screen.',
          type: 'info',
        });
        setTimeout(() => SystemChatHead.requestPermission(), 900);
      }
    };

    tryEnable();
    const onVisible = () => { if (document.visibilityState === 'visible') tryEnable(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headsKey]);

  // Native head tapped outside the app → open that chat
  useEffect(() => {
    const onNativeOpen = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (!id) return;
      onOpenChat(id);
    };
    const onNativeClose = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id) removeFloatingChatHead(id);
    };
    window.addEventListener('aeirmist_chathead_open', onNativeOpen);
    window.addEventListener('aeirmist_chathead_close', onNativeClose);
    return () => {
      window.removeEventListener('aeirmist_chathead_open', onNativeOpen);
      window.removeEventListener('aeirmist_chathead_close', onNativeClose);
    };
  }, [onOpenChat, removeFloatingChatHead]);

  const isInboxRoute = isInboxView || (typeof window !== 'undefined' && (window.location.pathname.startsWith('/messages') || window.location.pathname === '/messages'));
  if (heads.length === 0 || isInboxRoute) return null;

  // Click on a head bubble
  const handleHeadClick = (id: string) => {
    triggerNativeHaptic('selection');

    if (isDesktop) {
      // Facebook-style web behavior: Toggle bottom docked chat window!
      setOpenChatIds(prev => {
        if (prev.includes(id)) {
          // If already open, minimize it
          return prev.filter(openId => openId !== id);
        }
        // Max 2 docked windows side by side (or 3 on large screens)
        const maxDocked = window.innerWidth >= 1440 ? 3 : 2;
        const next = [id, ...prev.filter(openId => openId !== id)];
        return next.slice(0, maxDocked);
      });
    } else {
      // Mobile screen: open full chat without removing the head
      onOpenChat(id);
    }
  };

  const handleCloseHead = (id: string) => {
    triggerNativeHaptic('light');
    setOpenChatIds(prev => prev.filter(openId => openId !== id));
    removeFloatingChatHead(id);
  };

  const handleMinimizeDocked = (id: string) => {
    triggerNativeHaptic('light');
    setOpenChatIds(prev => prev.filter(openId => openId !== id));
  };

  const handleCloseDocked = (id: string) => {
    handleCloseHead(id);
  };

  const handleMaximizeDocked = (id: string) => {
    setOpenChatIds(prev => prev.filter(openId => openId !== id));
    onOpenChat(id);
  };

  return (
    <>
      {/* ── Facebook-Style Bottom-Docked Popup Chat Windows (Desktop Web) ── */}
      {isDesktop && !isInboxRoute && openChatIds.length > 0 && (
        <div 
          className="fixed bottom-0 z-[300] flex flex-row-reverse items-end gap-3 pointer-events-none"
          style={{ right: '82px' }}
        >
          {openChatIds.map(chatId => {
            const head = heads.find(h => h.id === chatId);
            if (!head) return null;
            return (
              <div key={chatId} className="pointer-events-auto">
                <DockedChatWindow
                  chatId={head.id}
                  chatName={head.name}
                  chatPhoto={head.photo}
                  participantId={head.participantId}
                  onMinimize={() => handleMinimizeDocked(head.id)}
                  onClose={() => handleCloseDocked(head.id)}
                  onMaximize={() => handleMaximizeDocked(head.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Side Rail / Floating Chat Heads Column (Right Side) ── */}
      {!isInboxRoute && (
        <motion.div
          drag={!isDesktop} // Draggable only on mobile phones; fixed on right rail on desktop web
          dragMomentum={false}
          dragConstraints={{
            left: -(typeof window !== 'undefined' ? window.innerWidth - 80 : 300),
            right: 0,
            top: -(typeof window !== 'undefined' ? window.innerHeight - 200 : 500),
            bottom: 0,
          }}
          className="fixed z-[290] select-none flex flex-col items-center gap-3 touch-none"
          style={{
            bottom: isDesktop ? '24px' : '100px',
            right: '16px'
          }}
        >
          {/* ── Add New Message Button ── */}
          {onNewMessage && (
            <motion.div
              layout
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                triggerNativeHaptic('selection');
                onNewMessage();
              }}
              className="relative cursor-pointer group select-none"
            >
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#121422] to-[#090a10] border-2 border-aeirmist-cyan/40 hover:border-aeirmist-cyan transition-all duration-200 flex items-center justify-center text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.25)] hover:shadow-[0_0_22px_rgba(0,242,255,0.5)]">
                <SquarePen size={20} className="group-hover:rotate-6 transition-transform" />
              </div>
              <div className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-xl bg-black/90 backdrop-blur-md border border-white/15 text-white text-[11px] font-bold whitespace-nowrap shadow-2xl z-50 flex items-center gap-1.5">
                <Plus size={12} className="text-aeirmist-cyan" />
                <span>New Message</span>
              </div>
            </motion.div>
          )}

          {/* ── Active Conversation Chat Heads ── */}
          <AnimatePresence initial={false}>
            {heads.map(h => (
              <HeadBubble
                key={h.id}
                head={h}
                isOpenInDock={openChatIds.includes(h.id)}
                preview={activePreviews[h.id]}
                onOpen={handleHeadClick}
                onClose={handleCloseHead}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
};
