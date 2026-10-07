import React, { useState, useEffect } from 'react';
import { Play, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { SafeImage } from '../ui/SafeImage';

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface CollageProps {
  items: MediaItem[];
  fitMode?: 'contain' | 'cover';
  aspectRatioClassName?: string;
  caption?: string;
  poster?: string;
  onItemClick?: (idx: number) => void;
  onNavigateToWatch?: () => void;
  renderLightboxSidebar?: () => React.ReactNode;
}

export const Collage: React.FC<CollageProps> = ({ 
  items, 
  fitMode = 'cover', 
  caption,
  poster,
  onItemClick,
  onNavigateToWatch, 
  renderLightboxSidebar 
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isFirstImageLandscape, setIsFirstImageLandscape] = useState<boolean | null>(true);
  const [mediaAspectRatio, setMediaAspectRatio] = useState<'portrait' | 'square' | 'landscape'>('portrait');
  const hasSidebar = !!renderLightboxSidebar;

  useEffect(() => {
    if (items?.[0]?.url && items[0].type !== 'video') {
      const img = new Image();
      img.src = items[0].url;
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        if (ratio >= 1.2) {
          setMediaAspectRatio('landscape');
          setIsFirstImageLandscape(true);
        } else if (ratio >= 0.85 && ratio < 1.2) {
          setMediaAspectRatio('square');
          setIsFirstImageLandscape(true);
        } else {
          // Portrait (strictly capped at Instagram standard 4:5 max height)
          setMediaAspectRatio('portrait');
          setIsFirstImageLandscape(false);
        }
      };
      img.onerror = () => {
        setMediaAspectRatio('portrait');
        setIsFirstImageLandscape(false);
      };
    } else {
      setMediaAspectRatio('portrait');
      setIsFirstImageLandscape(true);
    }
  }, [items?.[0]?.url, items?.[0]?.type]);

  useEffect(() => {
    if (!modalOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
      } else if (e.key === 'ArrowLeft' && items.length > 1) {
        setActiveIdx(prev => (prev === 0 ? items.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight' && items.length > 1) {
        setActiveIdx(prev => (prev === items.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, items.length]);

  if (!items || items.length === 0) return null;

  const count = items.length;

  const handleThumbnailClick = (idx: number) => {
    setActiveIdx(idx);
    if (onItemClick) {
      onItemClick(idx);
    } else {
      setModalOpen(true);
    }
  };

  const renderMediaCell = (item: MediaItem, idx: number, customClass: string = `w-full h-full ${fitMode === 'contain' ? 'object-contain bg-black/40' : 'object-cover object-center'}`) => {
    const isVideo = item.type === 'video' || (Boolean(item.url) && (item.url.includes('/video/upload/') || /\.(mp4|webm|mov|m4v|ogg|mkv)(\?.*)?$/i.test(item.url)));

    return (
      <div 
        key={idx} 
        onClick={() => {
          if (!isVideo) handleThumbnailClick(idx);
        }}
        className="relative w-full h-full overflow-hidden hover:opacity-95 transition-opacity cursor-pointer group bg-black/30"
      >
        {isVideo ? (
          <VideoPlayer 
            src={item.url} 
            className={customClass} 
            poster={poster}
            caption={caption}
            autoPlay={true}
            onNavigateToWatch={onNavigateToWatch}
          />
        ) : (
          <SafeImage 
            src={item.url} 
            alt="Media Cell" 
            className={`${customClass} transition-transform duration-[1.2s] group-hover:scale-105`} 
            referrerPolicy="no-referrer"
            useCache
          />
        )}
      </div>
    );
  };

  // Single post aspect ratio class following Instagram standards:
  // - Landscape: 16:9 / 1.91:1
  // - Square: 1:1
  // - Portrait: 4:5 (Instagram's maximum vertical height)
  // Max-height clamped so the full post (header + caption + image + action buttons) fits on screen without cutting off!
  const singleAspectClass = 
    mediaAspectRatio === 'landscape'
      ? 'aspect-[16/9] sm:aspect-[1.91/1] max-h-[min(48vh,360px)] sm:max-h-[min(55vh,440px)]'
      : mediaAspectRatio === 'square'
      ? 'aspect-square max-h-[min(50vh,390px)] sm:max-h-[min(65vh,490px)]'
      : 'aspect-[4/5] max-h-[min(50vh,390px)] sm:max-h-[min(65vh,490px)]';

  return (
    <div className="w-full relative overflow-hidden bg-black/20">
      {count === 1 ? (
        <div className={`w-full ${singleAspectClass} mx-auto flex items-center justify-center relative overflow-hidden bg-black/40`}>
          {fitMode === 'contain' ? (
            <div 
              className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black/60" 
              onClick={() => {
                const isFirstVideo = items[0].type === 'video' || (Boolean(items[0].url) && (items[0].url.includes('/video/upload/') || /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(items[0].url)));
                if (!isFirstVideo) handleThumbnailClick(0);
              }}
            >
              <img 
                src={items[0].url} 
                alt="" 
                aria-hidden="true" 
                className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-25 scale-110 pointer-events-none" 
              />
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                {items[0].type === 'video' ? (
                  <VideoPlayer 
                    src={items[0].url} 
                    className="w-full h-full object-contain" 
                    poster={poster}
                    caption={caption}
                    autoPlay={true}
                    onNavigateToWatch={onNavigateToWatch}
                  />
                ) : (
                  <SafeImage 
                    src={items[0].url} 
                    alt="Post Media" 
                    className="w-full h-full object-contain cursor-pointer" 
                    referrerPolicy="no-referrer"
                    useCache
                  />
                )}
              </div>
            </div>
          ) : (
            renderMediaCell(items[0], 0, "w-full h-full object-cover object-center")
          )}
        </div>
      ) : count === 2 ? (
        <div className="w-full aspect-[4/5] sm:aspect-square max-h-[min(50vh,390px)] sm:max-h-[min(65vh,490px)] grid grid-cols-2 gap-1 overflow-hidden">
          <div className="w-full h-full overflow-hidden">
            {renderMediaCell(items[0], 0, "w-full h-full object-cover object-center")}
          </div>
          <div className="w-full h-full overflow-hidden">
            {renderMediaCell(items[1], 1, "w-full h-full object-cover object-center")}
          </div>
        </div>
      ) : count === 3 ? (
        <div className="w-full aspect-[4/5] sm:aspect-square max-h-[min(50vh,390px)] sm:max-h-[min(65vh,490px)] overflow-hidden">
          {isFirstImageLandscape !== false ? (
            /* Landscape 1st image: Top row full-width + Bottom row 2 columns */
            <div className="grid grid-rows-[1.2fr_1fr] gap-1 h-full w-full">
              <div className="w-full h-full overflow-hidden">
                {renderMediaCell(items[0], 0, "w-full h-full object-cover object-center")}
              </div>
              <div className="grid grid-cols-2 gap-1 h-full overflow-hidden">
                <div className="w-full h-full overflow-hidden">
                  {renderMediaCell(items[1], 1, "w-full h-full object-cover object-center")}
                </div>
                <div className="w-full h-full overflow-hidden">
                  {renderMediaCell(items[2], 2, "w-full h-full object-cover object-center")}
                </div>
              </div>
            </div>
          ) : (
            /* Portrait 1st image: Left column 1 photo + Right column 2 stacked rows */
            <div className="grid grid-cols-[1.2fr_1fr] gap-1 h-full w-full">
              <div className="w-full h-full overflow-hidden">
                {renderMediaCell(items[0], 0, "w-full h-full object-cover object-center")}
              </div>
              <div className="grid grid-rows-2 gap-1 h-full overflow-hidden">
                <div className="w-full h-full overflow-hidden">
                  {renderMediaCell(items[1], 1, "w-full h-full object-cover object-center")}
                </div>
                <div className="w-full h-full overflow-hidden">
                  {renderMediaCell(items[2], 2, "w-full h-full object-cover object-center")}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : count === 4 ? (
        <div className="w-full aspect-square sm:aspect-[4/5] max-h-[min(50vh,390px)] sm:max-h-[min(65vh,490px)] grid grid-cols-2 grid-rows-2 gap-1 overflow-hidden">
          <div className="w-full h-full overflow-hidden">
            {renderMediaCell(items[0], 0, "w-full h-full object-cover object-center")}
          </div>
          <div className="w-full h-full overflow-hidden">
            {renderMediaCell(items[1], 1, "w-full h-full object-cover object-center")}
          </div>
          <div className="w-full h-full overflow-hidden">
            {renderMediaCell(items[2], 2, "w-full h-full object-cover object-center")}
          </div>
          <div className="w-full h-full overflow-hidden">
            {renderMediaCell(items[3], 3, "w-full h-full object-cover object-center")}
          </div>
        </div>
      ) : (
        // 5 or more items
        <div className="w-full aspect-square sm:aspect-[4/5] max-h-[min(50vh,390px)] sm:max-h-[min(65vh,490px)] grid grid-rows-2 gap-1 overflow-hidden">
          <div className="grid grid-cols-2 gap-1 h-full overflow-hidden">
            <div className="w-full h-full overflow-hidden">
              {renderMediaCell(items[0], 0, "w-full h-full object-cover object-center")}
            </div>
            <div className="w-full h-full overflow-hidden">
              {renderMediaCell(items[1], 1, "w-full h-full object-cover object-center")}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 h-full overflow-hidden">
            <div className="w-full h-full overflow-hidden">
              {renderMediaCell(items[2], 2, "w-full h-full object-cover object-center")}
            </div>
            <div className="w-full h-full overflow-hidden">
              {renderMediaCell(items[3], 3, "w-full h-full object-cover object-center")}
            </div>
            <div 
              onClick={() => handleThumbnailClick(4)}
              className="relative h-full w-full cursor-pointer overflow-hidden group bg-black/20"
            >
              {items[4].type === 'video' ? (
                <video src={items[4].url} className="w-full h-full object-cover object-center opacity-40 group-hover:scale-105 duration-[1s]" />
              ) : (
                <SafeImage 
                  src={items[4].url} 
                  alt="More preview" 
                  className="w-full h-full object-cover object-center opacity-40 group-hover:scale-105 duration-[1s]" 
                  useCache 
                />
              )}
              <div className="absolute inset-0 bg-[#020712]/75 flex flex-col items-center justify-center border-l border-white/5 backdrop-blur-[2px] shadow-inner">
                <span className="text-xl sm:text-2xl font-black font-display text-aeirmist-cyan drop-shadow-[0_0_12px_rgba(0,242,255,1)]">+{count - 4}</span>
                <span className="text-[7.5px] sm:text-[9px] font-black uppercase tracking-[0.25em] text-white/50 group-hover:text-white mt-1">More Items</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Immersive Photo/Video Lightbox Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div 
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 select-none"
            onClick={() => setModalOpen(false)}
          >
            {/* Navigation Controls Layer - Highest Z-index */}
            <div className="absolute inset-0 z-[150] pointer-events-none">
              {/* Close Button - Top Right (as requested/standard) */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setModalOpen(false);
                }}
                className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all shadow-2xl cursor-pointer active:scale-90 pointer-events-auto"
                title="Close"
              >
                <X size={28} strokeWidth={2.5} />
              </button>

              {/* Left Arrow Navigation - Screen Edge */}
              {items.length > 1 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIdx(prev => (prev === 0 ? items.length - 1 : prev - 1));
                  }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/40 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all shadow-xl cursor-pointer active:scale-95 group pointer-events-auto"
                  title="Previous"
                >
                  <ChevronLeft size={42} className="group-hover:-translate-x-1 transition-transform" />
                </button>
              )}

              {/* Right Arrow Navigation - Screen Edge */}
              {items.length > 1 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIdx(prev => (prev === items.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/40 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all shadow-xl cursor-pointer active:scale-95 group pointer-events-auto"
                  title="Next"
                >
                  <ChevronRight size={42} className="group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {/* Dot Indicators */}
              {items.length > 1 && (
                <div 
                  className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2.5 p-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5 shadow-2xl pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {items.map((_, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveIdx(i)}
                      className={`h-2 rounded-full transition-all duration-300 ${i === activeIdx ? 'bg-aeirmist-cyan w-6' : 'bg-white/20 hover:bg-white/40 w-2'}`} 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Main Content Layout */}
            <div className="w-full h-full relative flex items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
              
              {/* Media Section - Truly Centered */}
              <div className="w-full h-full flex items-center justify-center bg-transparent overflow-hidden">
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={activeIdx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="w-full h-full flex items-center justify-center p-4 sm:p-20"
                  >
                    {items[activeIdx].type === 'video' ? (
                      <VideoPlayer 
                        src={items[activeIdx].url} 
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" 
                        poster={poster}
                        caption={caption}
                        useCache
                      />
                    ) : (
                      <TransformWrapper
                        initialScale={1}
                        minScale={0.8}
                        maxScale={6}
                        centerZoomedOut={true}
                        wheel={{ step: 0.1 }}
                        doubleClick={{ mode: "toggle", step: 2 }}
                      >
                        <TransformComponent
                          wrapperClass="!w-full !h-full flex items-center justify-center"
                          contentClass="!w-full !h-full flex items-center justify-center"
                        >
                          <SafeImage 
                            src={items[activeIdx].url} 
                            className="max-w-full max-h-full object-contain shadow-2xl select-none rounded-lg cursor-grab active:cursor-grabbing" 
                            alt={`Full View ${activeIdx + 1}`} 
                            referrerPolicy="no-referrer" 
                            useCache
                          />
                        </TransformComponent>
                      </TransformWrapper>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Sidebar Section - Modern Overlay Drawer (Only on Desktop) */}
              {hasSidebar && (
                <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[400px] xl:w-[450px] h-full bg-black/80 backdrop-blur-3xl border-l border-white/5 flex-col shadow-2xl z-[140] transform transition-transform duration-500 overflow-y-auto no-scrollbar">
                  {renderLightboxSidebar()}
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
