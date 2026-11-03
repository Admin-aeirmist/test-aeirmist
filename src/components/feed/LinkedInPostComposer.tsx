import React from 'react';
import { Video, Image, FileText, Calendar } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { BLANK_DP } from '../../lib/avatar';

interface LinkedInPostComposerProps {
  onCreate?: () => void;
  onNavigate?: (tab: string, param?: string) => void;
}

export const LinkedInPostComposer: React.FC<LinkedInPostComposerProps> = React.memo(({ onCreate, onNavigate }) => {
  const { user, profile } = useAeirmist();
  const avatarUrl = profile?.photoURL || (user as any)?.photoURL || BLANK_DP;
  const displayName = profile?.displayName || user?.displayName || 'You';

  return (
    <div className="glass-panel rounded-2xl border-white/5 bg-black/40 p-3 sm:p-4 mb-3 shadow-xl hover:border-white/10 transition-all duration-300">
      {/* Top Input Bar with Square Avatar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate?.('profile')}
          className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan group"
          title="View profile"
        >
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border border-white/10 bg-neutral-900 group-hover:scale-105 transition-transform"
          />
        </button>

        <button
          type="button"
          onClick={onCreate}
          className="flex-1 h-11 px-4 sm:px-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/50 hover:text-white/80 text-xs sm:text-sm font-medium flex items-center justify-between transition-all duration-200 text-left active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aeirmist-cyan"
        >
          <span>Start a post</span>
        </button>
      </div>

      {/* Bottom Action Buttons Row - Single clean uniform color, no sci-fi/rainbow */}
      <div className="flex items-center justify-between sm:justify-around pt-3 mt-2.5 border-t border-white/5">
        {/* Video Button */}
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl hover:bg-white/5 text-white/70 hover:text-white transition-all text-xs font-semibold active:scale-95 group"
        >
          <Video size={17} className="text-white/60 group-hover:text-white transition-colors" />
          <span className="text-[11px] sm:text-xs">Video</span>
        </button>

        {/* Photo Button */}
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl hover:bg-white/5 text-white/70 hover:text-white transition-all text-xs font-semibold active:scale-95 group"
        >
          <Image size={17} className="text-white/60 group-hover:text-white transition-colors" />
          <span className="text-[11px] sm:text-xs">Photo</span>
        </button>

        {/* Write Article Button */}
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl hover:bg-white/5 text-white/70 hover:text-white transition-all text-xs font-semibold active:scale-95 group"
        >
          <FileText size={17} className="text-white/60 group-hover:text-white transition-colors" />
          <span className="text-[11px] sm:text-xs">Write article</span>
        </button>

        {/* Event Button (Shown on larger screens) */}
        <button
          type="button"
          onClick={onCreate}
          className="hidden md:flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl hover:bg-white/5 text-white/70 hover:text-white transition-all text-xs font-semibold active:scale-95 group"
        >
          <Calendar size={17} className="text-white/60 group-hover:text-white transition-colors" />
          <span className="text-[11px] sm:text-xs">Event</span>
        </button>
      </div>
    </div>
  );
});

LinkedInPostComposer.displayName = 'LinkedInPostComposer';
