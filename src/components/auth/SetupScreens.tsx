import React from 'react';
import { Lock, AlertCircle, Check, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { AeirmistLogo } from '../ui/AeirmistLogo';
import { DynamicAesthetic } from '../ui/DynamicAesthetic';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl, BLANK_DP } from '../../lib/avatar';

export const SetupRequiredScreen = ({ connectionError, isConnecting }: { connectionError: string | null, isConnecting: boolean }) => (
  <div className="h-full bg-aeirmist-bg flex items-center justify-center p-6 relative overflow-hidden">
    <div className="absolute inset-0 bg-aeirmist-magenta/5 blur-[120px] rounded-full animate-pulse" />
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel max-w-md w-full p-10 rounded-[3rem] text-center border-aeirmist-magenta/20 z-10"
    >
      <div className="w-16 h-16 bg-aeirmist-magenta/10 rounded-2xl flex items-center justify-center text-aeirmist-magenta mx-auto mb-6">
        <Lock size={32} />
      </div>
      <h2 className="text-2xl font-display font-bold mb-4 uppercase tracking-widest text-white">Setup Required</h2>
      <p className="text-white/40 text-sm mb-8 leading-relaxed">
        {connectionError || "The Link hasn't been established. Please complete the Firebase setup in the AI Studio panel to activate the Aeirmist."}
      </p>
      
      <div className="space-y-4">
        <div className="p-4 rounded-3xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-aeirmist-cyan animate-pulse mb-4">
          {isConnecting ? 'Resonating with Cloud...' : 'Awaiting Cloud Sync...'}
        </div>
      </div>
    </motion.div>
  </div>
);

export const PairingFailedScreen = ({ error, onRetry }: { error: string, onRetry: () => void }) => (
  <div className="fixed inset-0 bg-aeirmist-bg flex items-center justify-center z-[200] overflow-hidden">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.05)_0%,transparent_70%)]" />
    
    <div className="relative flex flex-col items-center max-w-sm w-full p-8 md:p-12 text-center space-y-8 z-10">
      <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 text-red-500 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.15)]">
        <AlertCircle size={36} className="animate-pulse" />
      </div>
      
      <div className="space-y-3">
          <h2 className="text-xl font-display font-black uppercase tracking-[0.3em] text-white">Connection Failed</h2>
          <p className="text-[10px] text-red-400/80 uppercase tracking-widest font-bold font-mono">
            Pairing Message Connection Broken
          </p>
      </div>

      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 w-full">
        <p className="text-[10px] text-white/60 leading-relaxed uppercase tracking-wider">
          {error}
        </p>
      </div>

      <button 
        onClick={onRetry}
        className="w-full py-4 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-aeirmist-cyan hover:shadow-[0_0_20px_rgba(0,188,212,0.4)] transition-all"
      >
        Return to Welcome Center
      </button>
    </div>
  </div>
);

export const PurgeScreen = ({ onCancel, onLogout }: { onCancel: () => void, onLogout: () => void }) => {
  const { profile } = useAeirmist();
  
  // Calculate remaining days out of 69 days
  const purgeDateStr = profile?.purgeDate || profile?.deletionScheduledFor;
  let remainingDays = 69;
  if (purgeDateStr) {
    const diff = new Date(purgeDateStr).getTime() - Date.now();
    remainingDays = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const avatarUrl = getAvatarUrl(profile?.photoURL, profile?.displayName || profile?.username || 'User');
  const displayName = profile?.displayName || 'Aeirmist User';
  const username = profile?.username ? `@${profile.username}` : '';

  return (
    <div className="h-full bg-[#0B0C10] flex items-center justify-center p-5 sm:p-6 relative overflow-hidden text-white font-sans min-h-screen">
      <DynamicAesthetic />
      <div className="absolute inset-0 bg-amber-500/10 blur-[140px] rounded-full animate-pulse" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="glass-panel max-w-md w-full p-8 sm:p-10 rounded-[2.5rem] text-center border-amber-500/30 bg-[#121316]/90 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-10 relative"
      >
        {/* User Avatar with Glowing Warning Badge */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <img 
            src={avatarUrl || BLANK_DP} 
            alt={displayName}
            className="w-full h-full rounded-full object-cover ring-2 ring-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.25)] bg-black/60"
            onError={(e) => { (e.target as HTMLImageElement).src = BLANK_DP; }}
          />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md ring-2 ring-[#121316]">
            <Lock size={15} />
          </div>
        </div>

        {/* User Identity */}
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white tracking-tight">{displayName}</h3>
          {username && (
            <span className="text-xs text-amber-400 font-mono font-semibold">{username}</span>
          )}
        </div>

        {/* Title requested by user */}
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          Wanna keep this ID?
        </h2>

        {/* Informative description */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed mb-8">
          <p className="mb-2">
            This account is currently scheduled for permanent deletion and will be wiped in{' '}
            <strong className="text-amber-400 font-bold font-mono">{remainingDays} days</strong> (69-day recovery period).
          </p>
          <p className="text-[11px] text-white/60">
            All your posts and profile are temporarily hidden. Click below to keep your ID and restore all data instantly.
          </p>
        </div>
        
        {/* Action buttons */}
        <div className="space-y-3">
          <button 
            type="button"
            onClick={onCancel}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(245,158,11,0.35)] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <Check size={16} />
            <span>Yes, Keep This ID</span>
          </button>

          <button 
            type="button"
            onClick={onLogout}
            className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-semibold text-xs tracking-wide transition-all border border-white/10 cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut size={15} />
            <span>Log Out / Continue Deletion</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const DeactivatedScreen = ({ onReactivate, onLogout }: { onReactivate: () => void, onLogout: () => void }) => (
  <div className="h-full bg-black flex items-center justify-center p-6 relative overflow-hidden text-white font-sans">
    <DynamicAesthetic />
    <div className="absolute inset-0 bg-red-500/5 blur-[120px] rounded-full animate-pulse" />
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel max-w-md w-full p-10 rounded-[3rem] text-center border-red-500/20 z-10"
    >
      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
        <AlertCircle size={32} />
      </div>
      <h2 className="text-xl font-display font-bold mb-4 uppercase tracking-[0.15em] text-white">Aeirmist User Deactivated</h2>
      <p className="text-white/40 text-xs mb-8 leading-relaxed">
        Your Aeirmist profile has been deactivated. All Message transmissions, follower graph syncs, and active messages are currently suspended pending identity reactivation.
      </p>
      
      <div className="space-y-4">
        <button 
          onClick={onReactivate}
          className="w-full py-4 rounded-full bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta text-black font-black uppercase text-[10px] tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] animate-pulse"
        >
          Re-materialize Account
        </button>
        <button 
          onClick={onLogout}
          className="w-full py-4 rounded-full bg-white/5 text-white/40 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all border border-white/5 hover:bg-white/10"
        >
          Sign Out
        </button>
      </div>
    </motion.div>
  </div>
);
