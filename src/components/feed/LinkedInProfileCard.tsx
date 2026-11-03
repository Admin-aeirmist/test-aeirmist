import React from 'react';
import { ShieldCheck, ChevronRight, Bookmark, Sparkles, MapPin, Briefcase } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { BLANK_DP } from '../../lib/avatar';

interface LinkedInProfileCardProps {
  onUserClick?: (user: any) => void;
  onNavigate?: (tab: string, param?: string) => void;
}

export const LinkedInProfileCard: React.FC<LinkedInProfileCardProps> = React.memo(({ onUserClick, onNavigate }) => {
  const { user, profile, rank } = useAeirmist();

  const displayName = profile?.displayName || user?.displayName || 'Junaed Islam Jim';
  const headline = (profile as any)?.headline || profile?.bio || 'Virtual Assistant & AI Operations Specialist | Helping Busy Founders scale';
  const location = (profile as any)?.location || 'Dhaka, Bangladesh';
  const workRole = (profile as any)?.work || (profile as any)?.company || 'Freelance | Self-Employed';
  const avatarUrl = profile?.photoURL || (user as any)?.photoURL || BLANK_DP;
  const connectionsCount = (profile as any)?.connectionsCount || (profile?.social?.followers?.length || 2);
  const aeirmistLevel = profile?.aeirmistLevel || 0;

  const handleProfileClick = () => {
    if (profile) {
      onUserClick?.(profile);
    } else {
      onNavigate?.('profile');
    }
  };

  return (
    <div className="space-y-3 sticky top-4 select-none">
      {/* 1. Main Identity Card */}
      <div className="glass-panel rounded-2xl border-white/5 bg-black/40 overflow-hidden shadow-2xl hover:border-white/10 transition-all duration-300">
        {/* Cover Banner */}
        <div className="h-16 w-full relative bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-cyan-950/40 border-b border-white/5 overflow-hidden">
          {/* Subtle night-city glow aesthetic matching the screenshot */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent opacity-70" />
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-aeirmist-cyan/10 blur-xl rounded-full pointer-events-none" />
        </div>

        {/* Profile Content */}
        <div className="px-4 pb-4 pt-0 relative">
          {/* Overlapping Avatar */}
          <div className="-mt-9 mb-2.5 flex items-end justify-between">
            <button
              type="button"
              onClick={handleProfileClick}
              className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan group/avatar"
            >
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#000d1c] bg-neutral-900 shadow-xl transition-transform duration-200 group-hover/avatar:scale-105"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#000d1c] shadow-[0_0_8px_#10b981]" />
            </button>

            {/* Level Rank Badge */}
            <div 
              style={{ borderColor: `${rank?.color || '#00f2ff'}40`, color: rank?.color || '#00f2ff' }}
              className="px-2 py-0.5 rounded-full border bg-white/[0.03] text-[9px] font-black uppercase tracking-widest flex items-center gap-1"
            >
              <Sparkles size={10} />
              <span>Lv. {aeirmistLevel}</span>
            </div>
          </div>

          {/* Name & Headline */}
          <div className="text-left cursor-pointer" onClick={handleProfileClick}>
            <h2 className="text-sm font-black text-white hover:text-aeirmist-cyan transition-colors flex items-center gap-1.5 leading-snug">
              {displayName}
              <ShieldCheck size={13} className="text-aeirmist-cyan shrink-0" />
            </h2>
            <p className="text-[11px] text-white/70 line-clamp-2 mt-1 leading-relaxed font-sans font-normal">
              {headline}
            </p>
            <p className="text-[10px] text-white/40 flex items-center gap-1 mt-1 font-mono">
              <MapPin size={10} className="text-white/30" />
              {location}
            </p>
          </div>

          {/* Work / Role Pill */}
          <div className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center gap-2 text-left">
            <div className="w-5 h-5 rounded bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan shrink-0 text-[10px] font-bold">
              fs
            </div>
            <span className="text-[11px] text-white/80 font-medium truncate flex items-center gap-1">
              <Briefcase size={10} className="text-white/40" />
              {workRole}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Dashboard & Connections Card */}
      <div className="glass-panel rounded-2xl border-white/5 bg-black/40 p-3 shadow-xl hover:border-white/10 transition-all duration-300 text-left">
        <button
          type="button"
          onClick={() => onNavigate?.('bonds')}
          className="w-full flex items-center justify-between py-1 text-white/80 hover:text-white transition-colors group"
        >
          <span className="text-xs font-bold text-white group-hover:text-aeirmist-cyan transition-colors">Dashboard</span>
          <ChevronRight size={14} className="text-white/40 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <div className="border-t border-white/5 mt-2 pt-2">
          <button
            type="button"
            onClick={() => onNavigate?.('connections')}
            className="w-full flex items-center justify-between text-left group"
          >
            <div>
              <p className="text-[11px] text-white/50 group-hover:text-white/80 transition-colors">Connections</p>
              <p className="text-[10px] text-white/30 font-medium">Grow your network</p>
            </div>
            <span className="text-sm font-black text-aeirmist-cyan font-mono group-hover:scale-105 transition-transform">
              {connectionsCount}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Exclusive Tools & Insights / Pro */}
      <div className="glass-panel rounded-2xl border-white/5 bg-black/40 p-3 shadow-xl hover:border-white/10 transition-all duration-300 text-left">
        <p className="text-[10px] text-white/40 font-medium leading-relaxed">
          Access exclusive tools & insights
        </p>
        <button
          type="button"
          onClick={() => onNavigate?.('business')}
          className="mt-1.5 flex items-center gap-2 text-xs font-black text-amber-400 hover:text-amber-300 transition-colors group"
        >
          <span className="w-3.5 h-3.5 rounded bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-[9px] text-amber-300">
            ★
          </span>
          <span className="underline decoration-amber-400/40 group-hover:decoration-amber-300">
            Try BOND Ecosystem Pro for ৳0
          </span>
        </button>
      </div>

      {/* 4. My Items / Saved shortcut */}
      <button
        type="button"
        onClick={() => {
          const evt = new CustomEvent('aeirmist-set-feed-mode', { detail: 'saved' });
          window.dispatchEvent(evt);
        }}
        className="w-full glass-panel rounded-2xl border-white/5 bg-black/40 p-3 shadow-xl hover:border-white/10 transition-all duration-300 text-left flex items-center gap-2.5 text-white/60 hover:text-white group"
      >
        <Bookmark size={14} className="text-white/40 group-hover:text-aeirmist-cyan transition-colors" />
        <span className="text-xs font-bold text-white/80 group-hover:text-white transition-colors">Saved items</span>
      </button>
    </div>
  );
});

LinkedInProfileCard.displayName = 'LinkedInProfileCard';
