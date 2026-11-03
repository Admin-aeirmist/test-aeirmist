import React, { useState } from 'react';
import { Sparkles, Users, X, ShieldCheck, ChevronDown, ChevronRight, Plus, Puzzle, Check } from 'lucide-react';
import { useAeirmist } from '../context/AeirmistContext';
import { AeirmistRankBadge } from './profile/AeirmistRankBadge';
import { getAvatarUrl, getBlankDp } from '../lib/avatar';

export const Sidebar = React.memo(({ onUserClick }: { onUserClick?: (user: any) => void }) => {
  const { suggestedUsers, toggleFollow, isFollowing, isFollowPending, profile, rank, dismissSuggestion } = useAeirmist();
  const [showAllPuzzles, setShowAllPuzzles] = useState(false);

  const aeirmistLevel = profile?.aeirmistLevel || 0;

  const puzzles = [
    { id: 'zip', title: 'Zip #596', subtitle: 'Complete the path', icon: '🟠', color: 'text-amber-400 bg-amber-500/10' },
    { id: 'wend', title: 'Wend #148', subtitle: 'Weave through words', icon: '🟨', color: 'text-yellow-400 bg-yellow-500/10' },
    { id: 'patches', title: 'Patches #231', subtitle: 'Piece it together', icon: '🟦', color: 'text-sky-400 bg-sky-500/10' },
    { id: 'sudoku', title: 'Mini Sudoku #449', subtitle: 'The classic game, made mini', icon: '🟩', color: 'text-emerald-400 bg-emerald-500/10' },
  ];
  
  return (
    <aside id="aeirmist-right-sidebar" className="hidden lg:block w-[var(--right-panel-w)] h-full p-4 xl:p-6 bg-aeirmist-bg/20 backdrop-blur-md overflow-hidden transition-all duration-500 z-40 shrink-0">
      <div className="flex flex-col gap-4 h-full overflow-y-auto scroll-smooth no-scrollbar">
        {/* 1. Level / Rank Card */}
        <div 
          style={{ borderColor: `${rank?.color || '#00f2ff'}44`, boxShadow: `none` }}
          className="glass-panel rounded-2xl p-4 border bg-white/[0.02] shrink-0 transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles style={{ color: rank?.color || '#00f2ff' }} size={16} />
                <h2 className="font-display font-bold text-sm whitespace-nowrap text-white">Your Level</h2>
              </div>
              <div className="text-2xl font-display font-black tracking-tight text-white">
                {aeirmistLevel.toLocaleString()}
              </div>
              <div 
                style={{ color: rank?.color || '#00f2ff' }}
                className="text-[9px] uppercase font-black tracking-widest mt-0.5"
              >
                {rank?.rank || 'Explorer'}
              </div>
            </div>
            <div className="shrink-0">
              <AeirmistRankBadge score={aeirmistLevel} size="sm" />
            </div>
          </div>
          <div className="mt-3 w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              style={{ width: `${Math.min(100, (aeirmistLevel % 1000) / 10)}%`, backgroundColor: rank?.color || '#00f2ff' }}
              className="h-full transition-all duration-1000" 
            />
          </div>
        </div>

        {/* 2. Today's Puzzles Card (Matching LinkedIn Screenshot) */}
        <div className="glass-panel rounded-2xl p-4 border border-white/5 bg-black/40 text-left">
          <div className="flex items-center justify-between mb-3 text-white">
            <h3 className="text-sm font-bold tracking-tight">Today&apos;s puzzles</h3>
            <Puzzle size={14} className="text-white/40" />
          </div>

          <div className="space-y-2.5">
            {(showAllPuzzles ? puzzles : puzzles.slice(0, 3)).map((p) => (
              <div 
                key={p.id}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${p.color} border border-white/5 shrink-0`}>
                    {p.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-aeirmist-cyan transition-colors truncate">
                      {p.title}
                    </p>
                    <p className="text-[10px] text-white/50 truncate">
                      {p.subtitle}
                    </p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAllPuzzles(!showAllPuzzles)}
            className="mt-2.5 pt-2 border-t border-white/5 w-full flex items-center gap-1 text-[11px] font-bold text-white/60 hover:text-white transition-colors"
          >
            <span>{showAllPuzzles ? 'Show less' : 'Show more'}</span>
            <ChevronDown size={12} className={`transition-transform ${showAllPuzzles ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* 3. Add to your feed (Matching LinkedIn Screenshot) */}
        <div className="glass-panel rounded-2xl p-4 border border-white/5 bg-black/40 text-left">
          <div className="flex items-center justify-between mb-3 text-white">
            <h3 className="text-sm font-bold tracking-tight">Add to your feed</h3>
            <Users size={14} className="text-white/40" />
          </div>

          <div className="space-y-3">
            {suggestedUsers.length > 0 ? (
              suggestedUsers.slice(0, 4).map(u => {
                const isFollowingUser = isFollowing(u.id);
                const isPending = isFollowPending(u.id);
                const isFollowerOfMe = (profile?.social?.followers || []).includes(u.id);

                let status: 'Follow' | 'Following' | 'Requested' | 'Follow Back' = 'Follow';
                if (isFollowingUser) {
                  status = 'Following';
                } else if (isPending) {
                  status = 'Requested';
                } else if (isFollowerOfMe) {
                  status = 'Follow Back';
                }

                const cleanHandle = u.username && u.username !== 'null' && u.username !== 'user'
                  ? u.username.replace(/^@+/, '')
                  : (u.displayName && u.displayName.toLowerCase() !== 'user'
                      ? u.displayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                      : (u.email ? u.email.split('@')[0] : (u.id ? `user_${u.id.slice(0, 6)}` : 'member')));

                const subtitle = (u as any).headline || (u as any).category || (u as any).work || 'Company • Business Content';

                return (
                  <div key={u.id} className="flex items-start justify-between gap-2 p-2 rounded-xl hover:bg-white/[0.03] transition-all group">
                    <div className="flex items-start gap-2.5 min-w-0 cursor-pointer" onClick={() => onUserClick?.(u)}>
                      <img 
                        src={getAvatarUrl(u.photoURL, u.displayName || cleanHandle)} 
                        alt={u.displayName || cleanHandle}
                        className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0 bg-neutral-900 mt-0.5"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getBlankDp();
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white group-hover:text-aeirmist-cyan transition-colors truncate flex items-center gap-1">
                          {u.displayName || cleanHandle}
                          {(u.verified || u.badge === 'verified' || u.isVerified) && (
                            <ShieldCheck size={11} className="text-aeirmist-cyan shrink-0" />
                          )}
                        </p>
                        <p className="text-[10px] text-white/50 truncate leading-relaxed">
                          {subtitle}
                        </p>
                        
                        {/* + Follow Pill Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFollow(u.id);
                          }}
                          className={`mt-1.5 px-3 py-1 rounded-full border text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 ${
                            isFollowingUser
                              ? 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                              : 'border-white/20 hover:border-aeirmist-cyan bg-white/5 hover:bg-aeirmist-cyan/10 text-white hover:text-aeirmist-cyan'
                          }`}
                        >
                          {isFollowingUser ? <Check size={11} /> : <Plus size={11} strokeWidth={3} />}
                          <span>{status}</span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => dismissSuggestion(u.id)}
                      className="text-white/20 hover:text-white/60 p-1 rounded-lg transition-colors shrink-0"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-[10px] text-white/30 text-center py-4">
                No new suggestions at the moment
              </div>
            )}
          </div>
        </div>

        {/* 4. LinkedIn-Style Footer Links */}
        <div className="pt-4 pb-8 text-[11px] text-white/30 space-y-2 select-none text-left">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="hover:text-white/60 cursor-pointer transition-colors">About</span>
            <span className="hover:text-white/60 cursor-pointer transition-colors">Accessibility</span>
            <span className="hover:text-white/60 cursor-pointer transition-colors">Help Center</span>
            <span className="hover:text-white/60 cursor-pointer transition-colors">Privacy &amp; Terms</span>
            <span className="hover:text-white/60 cursor-pointer transition-colors">Ad Choices</span>
            <span className="hover:text-white/60 cursor-pointer transition-colors">Advertising</span>
            <span className="hover:text-white/60 cursor-pointer transition-colors">Business Services</span>
          </div>
          <p className="text-[10px] text-white/20 pt-1">
            BOND Global Ecosystem Corporation © 2026
          </p>
        </div>
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
