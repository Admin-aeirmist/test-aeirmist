import React from 'react';
import { Sparkles, TrendingUp, Users, X, ShieldCheck } from 'lucide-react';
import { useAeirmist } from '../context/AeirmistContext';
import { AeirmistRankBadge } from './profile/AeirmistRankBadge';
import { getAvatarUrl, getBlankDp } from '../lib/avatar';
import { logger } from '@/src/utils/logger';


export const Sidebar = React.memo(({ onUserClick }: { onUserClick?: (user: any) => void }) => {
  const { suggestedUsers, toggleFollow, isFollowing, isFollowPending, profile, rank, dismissSuggestion, localAvatarURL } = useAeirmist();

  const aeirmistLevel = profile?.aeirmistLevel || 0;
  
  return (
    <aside id="aeirmist-right-sidebar" className="hidden lg:block w-[var(--right-panel-w)] h-full p-6 bg-aeirmist-bg/20 backdrop-blur-md overflow-hidden transition-all duration-500 z-40 shrink-0">
      <div className="flex flex-col gap-6 h-full overflow-y-auto scroll-smooth no-scrollbar">
        {/* Your Profile */}
        <div 
          style={{ borderColor: `${rank.color}44`, boxShadow: `none` }}
          className="glass-panel rounded-3xl p-6 border bg-white/[0.02] shrink-0 transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles style={{ color: rank.color }} size={20} />
                <h2 className="font-display font-bold text-lg whitespace-nowrap">Your Level</h2>
              </div>
              <div className="text-4xl font-display font-bold mb-2 tracking-tighter">
                {aeirmistLevel.toLocaleString()}
              </div>
              <div 
                style={{ color: rank.color }}
                className="text-[10px] uppercase font-black tracking-widest"
              >
                {rank.rank}
              </div>
            </div>
            <div className="shrink-0">
              <AeirmistRankBadge score={aeirmistLevel} size="md" />
            </div>
          </div>
          <div className="mt-4 w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              style={{ width: `${Math.min(100, (aeirmistLevel % 1000) / 10)}%`, backgroundColor: rank.color }}
              className="h-full transition-all duration-1000" 
            />
          </div>
        </div>

        <div className="space-y-10">
          <section>
            <div className="flex items-center gap-2 mb-6 text-white/40">
              <TrendingUp size={14} strokeWidth={3} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Trending Topics</h3>
            </div>
            <div className="space-y-5">
              <TrendItem tag="#Photography" count="12.4k posts" />
              <TrendItem tag="#Music" count="8.2k posts" />
              <TrendItem tag="#Technology" count="5.1k posts" />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-6 text-white/40">
              <div className="flex items-center gap-2">
                <Users size={14} strokeWidth={3} />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Suggested For You</h3>
              </div>
            </div>
            <div className="space-y-6">
              {suggestedUsers.length > 0 ? (
                suggestedUsers.slice(0, 5).map(u => {
                  const isFollowingUser = isFollowing(u.id);
                  const isPending = isFollowPending(u.id);
                  const isFollowerOfMe = (profile?.social?.followers || []).includes(u.id);

                  let status: 'Follow' | 'Following' | 'Requested' | 'Follow Back' | 'Unfollow' = 'Follow';
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

                  return (
                    <UserItem 
                      key={u.id} 
                      name={u.displayName || u.username || cleanHandle} 
                      handle={`@${cleanHandle}`} 
                      photo={u.photoURL}
                      status={status}
                      onFollow={() => toggleFollow(u.id)}
                      onClick={() => onUserClick?.(u)}
                      onDismiss={() => dismissSuggestion(u.id)}
                      online={u.online}
                      verified={u.verified || u.badge === 'verified' || u.isVerified}
                    />
                  );
                })
              ) : (
                <div className="text-[9px] text-white/20 uppercase font-bold tracking-widest text-center py-4">Searching for users...</div>
              )}
            </div>
          </section>
        </div>

        {/* Dynamic Footer for Sidebar */}
        <div className="pt-8 border-t border-white/5 opacity-20 text-[8px] font-black uppercase tracking-[0.3em] space-y-2">
          <div className="flex flex-wrap gap-x-4">
             <span>Version 4.2.0</span>
             <span>© 2026 Aeirmist</span>
          </div>
          <p>Connected</p>
        </div>
      </div>
    </aside>
  );
});

const TrendItem = ({ tag, count }: { tag: string, count: string }) => (
  <div className="cursor-pointer group min-0">
    <div className="text-sm font-medium group-hover:text-aeirmist-cyan transition-colors truncate">{tag}</div>
    <div className="text-[10px] text-white/40 uppercase tracking-wider truncate">{count}</div>
  </div>
);

const UserItem = ({ 
  name, 
  handle, 
  photo, 
  status, 
  onFollow, 
  onClick,
  onDismiss,
  online,
  verified
}: { 
  name: string; 
  handle: string; 
  photo: string; 
  status: 'Follow' | 'Following' | 'Requested' | 'Follow Back' | 'Unfollow';
  onFollow: () => void; 
  onClick: () => void;
  onDismiss: () => void;
  online?: boolean;
  verified?: boolean;
}) => (
  <div className="relative flex items-center justify-between group/card min-w-0 gap-3 p-2.5 rounded-2xl bg-white/[0.01] hover:bg-white/[0.03] border border-transparent hover:border-white/5 transition-all">
    <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={onClick}>
      <div className="relative shrink-0">
        <div className="w-12 h-12 md:w-[52px] md:h-[52px] rounded-2xl bg-gradient-to-tr from-white/5 to-white/10 border border-white/10 overflow-hidden transition-all duration-200 ease-in-out md:group-hover/card:scale-[1.03] md:group-hover/card:shadow-md active:scale-95">
          <img 
            src={getAvatarUrl(photo, name || handle)} 
            alt={name} 
            className="w-full h-full object-cover rounded-xl"
            onError={(e) => {
              (e.target as HTMLImageElement).src = getBlankDp();
            }}
          />
        </div>
        {online && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-aeirmist-lime rounded-full border-2 border-[#0d0e15] z-10" />
        )}
      </div>
      <div className="min-w-0 text-left font-sans">
        <div className="text-xs font-bold group-hover/card:text-aeirmist-cyan transition-all truncate leading-none mb-0.5 flex items-center gap-1">
          <span>{name}</span>
          {verified && <ShieldCheck className="text-aeirmist-cyan shrink-0 animate-pulse" size={13} />}
        </div>
        <div className="text-[9px] text-white/40 truncate leading-none">{handle}</div>
      </div>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <button 
        onClick={onFollow}
        className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition-all ${
          (status === 'Following' || status === 'Requested')
            ? 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white cursor-pointer'
            : 'border-aeirmist-cyan/30 hover:border-aeirmist-cyan text-aeirmist-cyan hover:bg-aeirmist-cyan/5 active:scale-95'
        }`}
      >
        {status}
      </button>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="p-1.5 bg-white/5 border border-white/5 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/20 active:scale-90 rounded-lg transition-all text-white/40 cursor-pointer flex items-center justify-center shrink-0"
        title="Hide recommendation"
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </div>
  </div>
);

export default Sidebar;
