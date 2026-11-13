import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Check, Sparkles, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface VerificationCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
  displayName?: string;
  photoURL?: string;
}

export const VerificationCelebrationModal: React.FC<VerificationCelebrationModalProps> = ({
  isOpen,
  onClose,
  username,
  displayName,
  photoURL
}) => {
  React.useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.4 },
          colors: ['#00f2ff', '#38bdf8', '#ffffff', '#a855f7'],
          zIndex: 100002
        });
      } catch {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-[#0b0d14] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 text-center shadow-[0_0_80px_rgba(0,242,255,0.25)] overflow-hidden"
        >
          {/* Neon Radial Highlights */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Instagram-style Verified Check Badge Animation */}
          <div className="relative mx-auto w-24 h-24 mb-5 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_40px_rgba(0,242,255,0.5)]"
            >
              <ShieldCheck size={44} className="text-white fill-white/20" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-aeirmist-lime text-black flex items-center justify-center shadow-lg font-bold"
            >
              <Check size={16} strokeWidth={3} />
            </motion.div>
          </div>

          {/* User Profile Snippet */}
          {photoURL && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4">
              <img
                src={photoURL}
                alt=""
                className="w-5 h-5 rounded-md object-cover border border-white/20"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/icon-192.png';
                }}
              />
              <span className="text-xs font-semibold text-white/90">
                @{username || displayName || 'you'}
              </span>
              <ShieldCheck size={13} className="text-aeirmist-cyan fill-aeirmist-cyan/20" />
            </div>
          )}

          {/* Congratulations Title */}
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            You&apos;re Verified!
          </h2>

          <p className="text-sm text-white/60 leading-relaxed mb-6">
            Congratulations! Your account has received the official Aeirmist verified badge. Your identity is confirmed, and your blue checkmark is now visible across all posts, profile, and search.
          </p>

          {/* Features Highlights */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3.5 mb-6 text-left space-y-2 text-xs text-white/80">
            <div className="flex items-center gap-2.5">
              <Sparkles size={14} className="text-aeirmist-cyan shrink-0" />
              <span>Official verified checkmark on your profile and posts</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Sparkles size={14} className="text-aeirmist-cyan shrink-0" />
              <span>Priority ranking in global search and discovery</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Sparkles size={14} className="text-aeirmist-cyan shrink-0" />
              <span>Enhanced trust and account authenticity protection</span>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onClose}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm tracking-wide shadow-[0_0_30px_rgba(0,242,255,0.4)] active:scale-[0.98] transition-all"
          >
            Awesome, Let&apos;s Go
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
