import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import { AeirmistLogo } from '../ui/AeirmistLogo';
import { getAvatarUrl, BLANK_DP } from '../../lib/avatar';

interface PublicPreviewGatewayProps {
  onLogin: () => void;
  onSignUp: () => void;
  previewAuthor?: {
    name?: string;
    username?: string;
    avatar?: string;
  } | null;
  children: React.ReactNode;
}

export const PublicPreviewGateway: React.FC<PublicPreviewGatewayProps> = ({
  onLogin,
  onSignUp,
  previewAuthor,
  children
}) => {
  const [isModalOpen, setIsModalOpen] = useState(true);

  // Listen to protected action triggers anywhere in the public view
  useEffect(() => {
    const handleRequireAuth = () => {
      setIsModalOpen(true);
    };
    window.addEventListener('aeirmist-require-auth', handleRequireAuth);
    return () => window.removeEventListener('aeirmist-require-auth', handleRequireAuth);
  }, []);

  const authorName = previewAuthor?.name || 'Aeirmist User';
  const authorUsername = previewAuthor?.username;
  const authorAvatar = getAvatarUrl(previewAuthor?.avatar || BLANK_DP);

  return (
    <div className="relative w-full h-full min-h-screen bg-black text-white flex flex-col overflow-x-hidden select-text">
      {/* 1. INSTAGRAM-STYLE TOP HEADER (Fixed on top, z-[5050]) */}
      <header className="fixed top-0 left-0 right-0 z-[5050] h-14 bg-black/90 backdrop-blur-md border-b border-white/10 px-4 md:px-8 flex items-center justify-between">
        {/* Brand on left */}
        <div 
          onClick={onLogin} 
          className="flex items-center cursor-pointer select-none group"
        >
          <AeirmistLogo className="h-8" />
        </div>

        {/* Action Buttons on right - exact Instagram button style */}
        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="px-4 py-1.5 rounded-lg bg-[#0095F6] hover:bg-[#1877F2] active:scale-95 text-white font-semibold text-sm transition-all cursor-pointer shadow-sm"
          >
            Log In
          </button>
          <button
            onClick={onSignUp}
            className="px-2 py-1.5 text-[#0095F6] hover:text-[#1877F2] font-semibold text-sm transition-colors cursor-pointer"
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* 2. THE CONTENT UNDERNEATH ("niche thake") */}
      <div className="flex-1 w-full pt-14 min-h-0 relative">
        {children}
      </div>

      {/* 3. INSTAGRAM-STYLE CENTERED LOGIN MODAL ("upore log in same to same insta") */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
            {/* Dark translucent backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-[2px] cursor-pointer"
            />

            {/* Modal Card - Styled directly after Instagram's dark dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-[385px] bg-[#262626] border border-[#363636] rounded-2xl p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col items-center text-center z-10"
              onClick={e => e.stopPropagation()}
            >
              {/* Close Button on top-right */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-3.5 right-3.5 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                title="Close"
                aria-label="Close dialog"
              >
                <X size={19} />
              </button>

              {/* Square Profile Pic (explicitly requested: square profile pic) */}
              <div className="relative mb-4 mt-2">
                <img 
                  src={authorAvatar} 
                  alt={authorName} 
                  className="w-20 h-20 rounded-2xl object-cover border border-white/15 shadow-md bg-neutral-900"
                />
              </div>

              {/* Headline */}
              <h3 className="font-bold text-base sm:text-lg text-white leading-snug max-w-[300px]">
                {authorUsername ? (
                  <>See more from <span className="text-[#0095F6]">@{authorUsername}</span> on Aeirmist</>
                ) : (
                  <>Log in to Aeirmist</>
                )}
              </h3>

              {/* Subtext */}
              <p className="text-xs text-white/60 mt-2 mb-6 leading-relaxed px-2">
                Log in or sign up to see photos, videos, and stories from friends and discover other accounts you'll love.
              </p>

              {/* Primary Blue Login Button */}
              <button
                onClick={onLogin}
                className="w-full py-2.5 rounded-lg font-semibold text-sm bg-[#0095F6] hover:bg-[#1877F2] active:scale-[0.99] text-white transition-all shadow-md cursor-pointer mb-3"
              >
                Log In
              </button>

              {/* Secondary Sign Up Link */}
              <button
                onClick={onSignUp}
                className="text-xs text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                Don't have an account? <span className="text-[#0095F6] font-bold hover:underline">Sign up</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. INSTAGRAM-STYLE FLOATING BOTTOM BAR (remains when modal is closed with X) */}
      <AnimatePresence>
        {!isModalOpen && (
          <motion.div 
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-0 inset-x-0 z-[5050] bg-[#121214]/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 sm:py-3.5 flex items-center justify-between gap-4 shadow-2xl"
          >
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-bold text-white truncate">Experience more on Aeirmist</p>
              <p className="text-[11px] text-white/50 truncate hidden sm:block">
                Log in or sign up to like, comment, and connect with people you know.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onLogin}
                className="px-4 py-1.5 rounded-lg bg-[#0095F6] hover:bg-[#1877F2] text-white font-semibold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Log In
              </button>
              <button
                onClick={onSignUp}
                className="px-3 py-1.5 rounded-lg text-[#0095F6] hover:text-[#1877F2] font-semibold text-xs transition-all cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
