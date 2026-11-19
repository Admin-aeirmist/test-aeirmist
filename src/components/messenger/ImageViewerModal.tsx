import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, Download, RefreshCw, Heart, MessageCircle, Repeat, ChevronLeft, ChevronRight } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useAeirmist } from '../../context/AeirmistContext';
import { DownloadManagerService } from '../../services/DownloadManagerService';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  images?: string[];
  initialIndex?: number;
  onReact?: (emoji: string) => void;
  onReply?: (imageUrl: string) => void;
  onQuote?: (imageUrl: string) => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ 
  isOpen, 
  onClose, 
  imageUrl,
  images,
  initialIndex = 0,
  onReact,
  onReply,
  onQuote
}) => {
  const { addToast } = useAeirmist();
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasReacted, setHasReacted] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const activeList = images && images.length > 0 ? images : [imageUrl];
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (images && images.length > 0) {
      const idx = images.indexOf(imageUrl);
      setCurrentIndex(idx >= 0 ? idx : initialIndex);
    } else {
      setCurrentIndex(0);
    }
  }, [imageUrl, images, initialIndex]);

  const currentImage = activeList[currentIndex] || imageUrl;

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : activeList.length - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev < activeList.length - 1 ? prev + 1 : 0));
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && activeList.length > 1) handlePrev();
      if (e.key === 'ArrowRight' && activeList.length > 1) handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeList.length]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl select-none"
          onClick={onClose}
        >
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={8}
            centerZoomedOut={true}
            wheel={{ step: 0.1 }}
          >
            {({ zoomIn, zoomOut, resetTransform, state }) => (
              <>
                {/* Action Bar (After view) */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50 bg-black/80 p-2 rounded-full backdrop-blur-xl border border-white/10"
                    onClick={e => e.stopPropagation()}
                >
                   {showReactions && (
                     <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-[#242526] rounded-full border border-white/20 shadow-2xl">
                       {['❤️', '👍', '🔥', '😂', '😮', '👏'].map(emoji => (
                         <button
                           key={emoji}
                           onClick={() => {
                             setHasReacted(true);
                             setShowReactions(false);
                             onReact?.(emoji);
                             addToast?.({ type: 'success', message: `Reacted with ${emoji}` });
                           }}
                           className="p-1 hover:scale-125 transition-transform text-base"
                         >
                           {emoji}
                         </button>
                       ))}
                     </div>
                   )}
                   <button 
                     onClick={() => {
                       setShowReactions(!showReactions);
                       if (!showReactions) {
                         setHasReacted(!hasReacted);
                         if (!hasReacted) {
                           onReact?.('❤️');
                           addToast?.({ type: 'success', message: 'Reacted with ❤️' });
                         }
                       }
                     }}
                     className={`flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-full text-xs font-bold transition-colors ${hasReacted ? 'text-red-400' : 'text-white'}`}
                   >
                       <Heart size={16} className={hasReacted ? 'fill-current' : ''} /> {hasReacted ? 'Liked' : 'React'}
                   </button>
                   <button 
                     onClick={() => {
                       onReply?.(currentImage);
                       addToast?.({ type: 'info', message: 'Replying to image in chat...' });
                       onClose();
                     }}
                     className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-full text-white text-xs font-bold transition-colors cursor-pointer"
                   >
                       <MessageCircle size={16} /> Reply
                   </button>
                   <button 
                     onClick={() => {
                       onQuote?.(currentImage);
                       navigator.clipboard?.writeText(currentImage);
                       addToast?.({ type: 'success', message: 'Image quoted & link copied to clipboard' });
                     }}
                     className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-full text-white text-xs font-bold transition-colors cursor-pointer"
                   >
                       <Repeat size={16} /> Quote
                   </button>
                </motion.div>

                {/* Controls */}
                <div 
                  className="absolute top-4 right-4 md:right-8 flex items-center gap-2 z-50 bg-black/60 p-2 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <button onClick={() => zoomOut()} className="p-2.5 bg-white/5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors active:scale-95">
                    <ZoomOut size={18} />
                  </button>
                  <span className="text-[10px] font-black text-aeirmist-cyan w-10 text-center tracking-widest">{Math.round(state.scale * 100)}%</span>
                  <button onClick={() => zoomIn()} className="p-2.5 bg-white/5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors active:scale-95">
                    <ZoomIn size={18} />
                  </button>
                  <div className="w-px h-6 bg-white/10 mx-1" />
                  <button onClick={() => resetTransform()} className="p-2.5 bg-white/5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors active:scale-95" title="Reset View">
                    <RefreshCw size={18} />
                  </button>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (isDownloading) return;
                      setIsDownloading(true);
                      try {
                        const res = await DownloadManagerService.downloadMediaFile(currentImage);
                        if (res.success) {
                          addToast?.({
                            title: 'Saved to Gallery',
                            message: 'Image saved directly to device storage.',
                            type: 'success'
                          });
                        } else {
                          addToast?.({
                            title: 'Download Failed',
                            message: res.error || 'Could not save image to device.',
                            type: 'warning'
                          });
                        }
                      } finally {
                        setIsDownloading(false);
                      }
                    }}
                    disabled={isDownloading}
                    className="p-2.5 bg-white/5 rounded-xl text-white/70 hover:text-aeirmist-cyan hover:bg-white/10 transition-colors active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center"
                    title="Save to Device / Gallery"
                  >
                    {isDownloading ? <RefreshCw size={18} className="animate-spin text-aeirmist-cyan" /> : <Download size={18} />}
                  </button>
                  <div className="w-px h-6 bg-white/10 mx-1" />
                  <button onClick={onClose} className="p-2.5 bg-red-500/20 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/30 transition-colors active:scale-95">
                    <X size={18} />
                  </button>
                </div>

                {/* Left/Right Gallery Nav for albums */}
                {activeList.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all z-50 shadow-2xl active:scale-95"
                      title="Previous (Left Arrow)"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all z-50 shadow-2xl active:scale-95"
                      title="Next (Right Arrow)"
                    >
                      <ChevronRight size={22} />
                    </button>
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-white/80 text-xs font-mono z-50">
                      {currentIndex + 1} / {activeList.length}
                    </div>
                  </>
                )}

                {/* Viewer Area */}
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
                  <TransformComponent wrapperClass="w-full h-full !flex !items-center !justify-center" contentClass="!flex !items-center !justify-center min-w-full min-h-full">
                    <motion.img
                      key={currentImage}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      src={currentImage}
                      alt="Expanded format"
                      className="max-w-full max-h-[100dvh] object-contain select-none pointer-events-auto rounded-md md:rounded-xl shadow-2xl"
                      draggable={false}
                      onDoubleClick={() => resetTransform()}
                    />
                  </TransformComponent>
                </div>
              </>
            )}
          </TransformWrapper>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
