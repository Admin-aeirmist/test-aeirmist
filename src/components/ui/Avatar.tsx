import React, { useState, useEffect } from 'react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';

// Real-time custom hook to determine user's story status
export function useUserStoryState(userId: string | undefined, secondaryUserId?: string) {
  const { user, stories: contextStories, optimisticStories } = useAeirmist();
  const [state, setState] = useState<'active' | 'seen' | 'none'>('none');

  useEffect(() => {
    if (!userId && !secondaryUserId) {
      setState('none');
      return;
    }

    const yesterdayMs = Date.now() - 24 * 60 * 60 * 1000;
    const allContextStories = [...(contextStories || []), ...(optimisticStories || [])];
    const matched = allContextStories.filter(story => {
      if (!story) return false;
      const isUserMatch = (
        (userId && (story.userId === userId || story.authorUid === userId || story.authorId === userId)) ||
        (secondaryUserId && (story.userId === secondaryUserId || story.authorUid === secondaryUserId || story.authorId === secondaryUserId))
      );
      if (!isUserMatch) return false;
      const created = story.createdAt;
      if (!created) return true;
      const ms = typeof created.toMillis === 'function' ? created.toMillis() : new Date(created).getTime();
      return !isNaN(ms) ? ms >= yesterdayMs : true;
    });

    if (matched.length > 0) {
      const currentUid = user?.uid || (user as any)?.id;
      const allSeen = currentUid ? matched.every(story => (story.viewers || []).includes(currentUid)) : false;
      setState(allSeen ? 'seen' : 'active');
    } else {
      setState('none');
    }
  }, [userId, secondaryUserId, user, contextStories, optimisticStories]);

  return state;
}

interface AvatarProps {
  src: string | undefined | null;
  alt?: string;
  sizeClassName?: string; // e.g. "w-14 h-14 md:w-16 md:h-16"
  roundedClassName?: string; // e.g. "rounded-[18px]"
  innerRoundedClassName?: string; // e.g. "rounded-[16px]"
  showStoryRing?: boolean;
  userId?: string; // If passed, auto-determines story ring state
  storyRingState?: 'active' | 'seen' | 'none'; // Overrides auto-detection if passed explicitly
  className?: string; // Custom classes for outermost wrapper
  imgClassName?: string; // Custom classes for image
  onClick?: () => void;
  children?: React.ReactNode;
}

export const Avatar: React.FC<AvatarProps> = React.memo(({
  src,
  alt = 'Avatar',
  sizeClassName = 'w-10 h-10',
  roundedClassName = 'rounded-xl',
  innerRoundedClassName = 'rounded-lg',
  showStoryRing = false,
  userId,
  storyRingState,
  className = '',
  imgClassName = '',
  onClick,
  children
}) => {
  // Only query story state if story ring is explicitly enabled and state is not provided
  const targetUserId = (showStoryRing && storyRingState === undefined) ? userId : undefined;
  const autoStoryState = useUserStoryState(targetUserId);
  const resolvedState = storyRingState !== undefined ? storyRingState : (targetUserId ? autoStoryState : 'none');

  // Determine ring container classes
  let ringStyle = 'p-0 bg-transparent shadow-none';
  if (showStoryRing) {
    if (resolvedState === 'active') {
      ringStyle = 'p-[2px] bg-gradient-to-tr from-aeirmist-cyan via-aeirmist-magenta to-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.25)]';
    } else if (resolvedState === 'seen') {
      ringStyle = 'p-[2px] bg-slate-300 dark:bg-white/[0.15] shadow-none';
    }
  }

  const finalAvatarUrl = getAvatarUrl(src);

  return (
    <div 
      onClick={onClick}
      className={`relative select-none flex items-center justify-center transition-all duration-300 ${sizeClassName} ${roundedClassName} ${ringStyle} ${className} ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
    >
      <div className={`w-full h-full ${innerRoundedClassName} bg-slate-100 dark:bg-black overflow-hidden relative shadow-sm ${showStoryRing && resolvedState !== 'none' ? 'border-[2px] border-white dark:border-[#080808]' : 'border border-slate-200/90 dark:border-white/10'}`}>
        <img 
          src={finalAvatarUrl} 
          alt={alt}
          width="100%"
          height="100%"
          loading="lazy"
          decoding="async"
          style={{ aspectRatio: '1 / 1' }}
          className={`w-full h-full aspect-square object-cover transition-all duration-300 contrast-[1.02] brightness-[1.01] dark:contrast-100 dark:brightness-100 ${imgClassName}`}
          onError={(e) => {
            (e.target as HTMLImageElement).src = getAvatarUrl(null);
          }}
          referrerPolicy="no-referrer"
        />
        {children}
      </div>
    </div>
  );
});
