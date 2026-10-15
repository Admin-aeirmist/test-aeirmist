import React from 'react';
import { Play, Check, CheckCheck, Loader2 } from 'lucide-react';
import { SafeImage } from '../ui/SafeImage';
import { normalizeMediaUrl } from '@/src/utils/mediaUtils';

export interface AlbumItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  timestampMs?: number;
  isOptimistic?: boolean;
  isFailed?: boolean;
  thumbnail?: string;
}

export const isAutoMediaPlaceholder = (text?: string): boolean => {
  if (!text) return true;
  const trimmed = text.trim();
  return /^(sent an? (image|photo|video|media|file)|sending(\s+[a-z]+|\.\.\.)?)$/i.test(trimmed);
};

interface TelegramMediaAlbumProps {
  items: AlbumItem[];
  isMe: boolean;
  timestampText: string;
  isOptimistic?: boolean;
  isDelivered?: boolean;
  isSeen?: boolean;
  isFailed?: boolean;
  readReceiptsAllowed?: boolean;
  otherUserRestricted?: boolean;
  showTimestamp?: boolean;
  onItemClick: (url: string, index: number, allUrls: string[]) => void;
  onRetry?: () => void;
}

export const TelegramMediaAlbum: React.FC<TelegramMediaAlbumProps> = ({
  items,
  isMe,
  timestampText,
  isOptimistic,
  isDelivered,
  isSeen,
  isFailed,
  readReceiptsAllowed = true,
  otherUserRestricted = false,
  showTimestamp = true,
  onItemClick,
  onRetry
}) => {
  if (!items || items.length === 0) return null;

  const allUrls = items.map(it => normalizeMediaUrl(it.url));
  const count = items.length;

  // Render individual cell with zoom, video icon & optimistic state
  const renderCell = (item: AlbumItem, index: number, customClass: string = 'w-full h-full', overlayText?: string) => {
    const itemUrl = normalizeMediaUrl(item.url);
    const isVideo = item.type === 'video' || itemUrl.includes('.mp4');

    return (
      <div
        key={item.id || `album-item-${index}`}
        onClick={(e) => {
          e.stopPropagation();
          onItemClick(itemUrl, index, allUrls);
        }}
        className={`relative overflow-hidden cursor-pointer group/cell bg-black/40 select-none ${customClass}`}
      >
        {isVideo ? (
          <div className="w-full h-full relative flex items-center justify-center bg-black/50">
            <video
              src={item.url}
              className="w-full h-full object-cover"
              preload="metadata"
              muted
              playsInline
            />
            <div className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg group-hover/cell:scale-110 transition-transform">
              <Play size={16} className="fill-current ml-0.5 text-white" />
            </div>
          </div>
        ) : (
          <SafeImage
            src={item.url}
            alt="Album media"
            blurThumbnail={item.thumbnail}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover/cell:scale-105 ${
              item.isOptimistic ? 'blur-sm grayscale' : ''
            } ${item.isFailed ? 'opacity-50' : ''}`}
          />
        )}

        {/* Telegram +N remaining overlay */}
        {overlayText && (
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex items-center justify-center text-white text-xl sm:text-2xl font-black tracking-wider z-10">
            {overlayText}
          </div>
        )}
      </div>
    );
  };

  // Render Telegram-style Album Layout
  const renderAlbumGrid = () => {
    // 1 Item
    if (count === 1) {
      return (
        <div className="w-full max-h-[380px] overflow-hidden">
          {renderCell(items[0], 0, 'w-full h-full max-h-[380px] object-cover')}
        </div>
      );
    }

    // 2 Items: 2 equal columns side by side
    if (count === 2) {
      return (
        <div className="grid grid-cols-2 gap-[2px] w-full h-[200px] sm:h-[220px]">
          {renderCell(items[0], 0, 'w-full h-full')}
          {renderCell(items[1], 1, 'w-full h-full')}
        </div>
      );
    }

    // 3 Items: Left large (col-span-1), Right 2 stacked (grid-rows-2)
    if (count === 3) {
      return (
        <div className="grid grid-cols-2 gap-[2px] w-full h-[260px] sm:h-[280px]">
          {renderCell(items[0], 0, 'w-full h-full')}
          <div className="grid grid-rows-2 gap-[2px] w-full h-full">
            {renderCell(items[1], 1, 'w-full h-full')}
            {renderCell(items[2], 2, 'w-full h-full')}
          </div>
        </div>
      );
    }

    // 4 Items: 2x2 grid
    if (count === 4) {
      return (
        <div className="grid grid-cols-2 gap-[2px] w-full h-[280px] sm:h-[300px]">
          {renderCell(items[0], 0, 'w-full h-full')}
          {renderCell(items[1], 1, 'w-full h-full')}
          {renderCell(items[2], 2, 'w-full h-full')}
          {renderCell(items[3], 3, 'w-full h-full')}
        </div>
      );
    }

    // 5 Items: 2 on top, 3 on bottom
    if (count === 5) {
      return (
        <div className="flex flex-col gap-[2px] w-full h-[280px] sm:h-[300px]">
          <div className="grid grid-cols-2 gap-[2px] w-full h-[58%]">
            {renderCell(items[0], 0, 'w-full h-full')}
            {renderCell(items[1], 1, 'w-full h-full')}
          </div>
          <div className="grid grid-cols-3 gap-[2px] w-full h-[42%]">
            {renderCell(items[2], 2, 'w-full h-full')}
            {renderCell(items[3], 3, 'w-full h-full')}
            {renderCell(items[4], 4, 'w-full h-full')}
          </div>
        </div>
      );
    }

    // 6 Items: 3 on top, 3 on bottom
    if (count === 6) {
      return (
        <div className="grid grid-cols-3 gap-[2px] w-full h-[280px] sm:h-[300px]">
          {items.slice(0, 6).map((item, idx) => renderCell(item, idx, 'w-full h-full'))}
        </div>
      );
    }

    // 7 or 8 Items: 2 rows (3 on top, 4 on bottom / 4 on top, 4 on bottom)
    if (count === 7 || count === 8) {
      const topCount = count === 7 ? 3 : 4;
      const bottomCount = count === 7 ? 4 : 4;
      return (
        <div className="flex flex-col gap-[2px] w-full h-[300px] sm:h-[320px]">
          <div className={`grid grid-cols-${topCount} gap-[2px] w-full h-[50%]`}>
            {items.slice(0, topCount).map((item, idx) => renderCell(item, idx, 'w-full h-full'))}
          </div>
          <div className={`grid grid-cols-${bottomCount} gap-[2px] w-full h-[50%]`}>
            {items.slice(topCount, count).map((item, idx) => renderCell(item, topCount + idx, 'w-full h-full'))}
          </div>
        </div>
      );
    }

    // 9+ Items: 3x3 grid with +N on 9th
    const visibleItems = items.slice(0, 9);
    const remaining = count - 9;

    return (
      <div className="grid grid-cols-3 gap-[2px] w-full h-[320px] sm:h-[340px]">
        {visibleItems.map((item, idx) => {
          const isLast = idx === 8 && remaining > 0;
          return renderCell(
            item,
            idx,
            'w-full h-full',
            isLast ? `+${remaining}` : undefined
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative rounded-[18px] sm:rounded-2xl overflow-hidden my-1 shadow-xl border border-white/10 w-full max-w-[320px] sm:max-w-[380px] md:max-w-[420px] bg-black/40">
      {renderAlbumGrid()}

      {/* Floating Telegram-style Timestamp & Read Status Badge */}
      {showTimestamp && (
        <div className="absolute bottom-2 right-2 bg-black/65 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px] text-white/90 shadow-md pointer-events-none z-20 border border-white/10">
          <span className="font-medium tracking-tight whitespace-nowrap">
            {timestampText}
          </span>
          {isMe && !isFailed && (
            <span className="flex items-center ml-0.5">
              {isOptimistic ? (
                <Loader2 size={10} className="animate-spin text-white/40" />
              ) : (isSeen && !otherUserRestricted && readReceiptsAllowed) ? (
                <CheckCheck size={12} className="text-aeirmist-cyan" />
              ) : (
                <Check size={12} className="text-white/60" />
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
