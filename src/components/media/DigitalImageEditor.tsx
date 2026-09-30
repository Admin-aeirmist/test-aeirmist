import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  RotateCcw, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Check, 
  RefreshCw,
  Undo2
} from 'lucide-react';
import { useBackHandler } from '../../utils/backNavigation';

interface DigitalImageEditorProps {
  imageSrc: string;
  onSave: (editedBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
  title?: string;
}

export const DigitalImageEditor: React.FC<DigitalImageEditorProps> = ({ 
  imageSrc, 
  onSave, 
  onCancel,
  aspectRatio = 1,
  title
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const cropFrameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync ref with state
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Load natural dimensions of source image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Back button closes modal cleanly on Android/browser
  useBackHandler(() => {
    onCancel();
    return true;
  }, true, 110, [onCancel]);

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(1, +(prev + delta).toFixed(2)), 3.5));
  };

  const handleRotate = (deg: number) => {
    setRotation(prev => (prev + deg + 360) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Drag-to-Pan Handling (Mouse & Touch)
  const onPointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX - positionRef.current.x,
      y: clientY - positionRef.current.y
    };
  };

  const onPointerMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    const newX = clientX - dragStartRef.current.x;
    const newY = clientY - dragStartRef.current.y;
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      onPointerMove(e.clientX, e.clientY);
    };
    const handleMouseUp = () => {
      onPointerUp();
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => {
      onPointerUp();
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, onPointerMove, onPointerUp]);

  // Determine frame size
  const isAvatar = aspectRatio === 1;
  const frameWidth = isAvatar ? 280 : 460;
  const frameHeight = Math.round(frameWidth / aspectRatio);

  // Compute rendered base size that fully covers the crop frame at zoom 1
  let renderedWidth = frameWidth;
  let renderedHeight = frameHeight;
  if (imgNaturalSize && imgNaturalSize.width && imgNaturalSize.height) {
    const imgRatio = imgNaturalSize.width / imgNaturalSize.height;
    if (imgRatio >= aspectRatio) {
      renderedHeight = frameHeight;
      renderedWidth = Math.round(frameHeight * imgRatio);
    } else {
      renderedWidth = frameWidth;
      renderedHeight = Math.round(frameWidth / imgRatio);
    }
  }

  const handleSave = async () => {
    if (!imageRef.current || !canvasRef.current || !cropFrameRef.current) return;
    setIsProcessing(true);

    try {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      const cropRect = cropFrameRef.current.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      // Ultra-HD / 1080p Crisp Canvas Resolution:
      // Cover: 2560px wide (Crisp 1080p & 2K QHD for desktop and mobile retina)
      // Avatar: 1080px wide (True 1080p HD square avatar)
      const outputWidth = isAvatar ? 1080 : 2560;
      const outputHeight = Math.round(outputWidth / aspectRatio);
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      // Enable high-quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Exact pixel-perfect scaling ratio from on-screen preview to high-res canvas
      const scaleMultiplier = outputWidth / (cropRect.width || frameWidth || 1);

      ctx.save();
      // Center canvas origin
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      // Apply scaled pan position
      ctx.translate(position.x * scaleMultiplier, position.y * scaleMultiplier);

      // Draw image precisely matching the rendered preview dimensions scaled up
      const finalDrawWidth = renderedWidth * scaleMultiplier;
      const finalDrawHeight = renderedHeight * scaleMultiplier;

      ctx.drawImage(
        img, 
        -finalDrawWidth / 2, 
        -finalDrawHeight / 2, 
        finalDrawWidth, 
        finalDrawHeight
      );
      ctx.restore();

      // Export at 0.95 high-fidelity JPEG to preserve crystal-clear HD details
      canvas.toBlob((blob) => {
        if (blob) {
          onSave(blob);
        } else {
          console.error('[DigitalImageEditor] Blob export returned null');
        }
        setIsProcessing(false);
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('[DigitalImageEditor] Export error:', err);
      setIsProcessing(false);
    }
  };

  const defaultTitle = isAvatar ? 'Update profile picture' : 'Update cover photo';
  const modalTitle = title || defaultTitle;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md select-none font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-[540px] bg-[#1a1c21] border border-white/10 rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Meta/Facebook clean title & close button */}
        <header className="px-5 py-4 sm:px-6 sm:py-4.5 border-b border-white/10 flex items-center justify-between bg-[#15171b]">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            {modalTitle}
          </h2>
          <button 
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/60 hover:text-white transition-all cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        {/* Viewport - Darkened surrounding area with clear squircle/rectangular crop window */}
        <div 
          ref={containerRef}
          className="relative w-full h-[320px] sm:h-[380px] bg-[#0c0d10] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={(e) => onPointerDown(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            if (e.touches.length > 0) {
              onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
        >
          {/* Pan-able and Zoom-able Image Layer */}
          <div 
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="absolute flex items-center justify-center pointer-events-none"
          >
            <img 
              ref={imageRef}
              src={imageSrc} 
              alt="Crop target" 
              draggable={false}
              style={{
                width: `${renderedWidth}px`,
                height: `${renderedHeight}px`,
                maxWidth: 'none'
              }}
              className="select-none pointer-events-none"
            />
          </div>

          {/* Crop Frame with Box-Shadow Mask (DIMS EVERYTHING OUTSIDE THE FRAME) */}
          <div 
            ref={cropFrameRef}
            style={{
              width: `${frameWidth}px`,
              height: `${frameHeight}px`
            }}
            className={`relative pointer-events-none z-10 ${
              isAvatar 
                ? 'rounded-3xl sm:rounded-[2.25rem]' 
                : 'rounded-2xl'
            } border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]`}
          >
            {/* Subtle center alignment cross-guide for intuitive positioning */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-25">
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div />
            </div>
          </div>

          {/* Helper hint */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] text-white/70 font-medium">
            Drag image to reposition • HD 1080p Output
          </div>
        </div>

        {/* Controls - Meta/Facebook style zoom slider & quick rotate */}
        <div className="px-5 py-3.5 sm:px-6 bg-[#16181d] border-t border-white/5 flex flex-col gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              type="button"
              onClick={() => handleZoom(-0.15)} 
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut size={17} />
            </button>
            <div className="flex-1 relative flex items-center">
              <input 
                type="range" 
                min="1" 
                max="3.5" 
                step="0.01" 
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-aeirmist-cyan"
              />
            </div>
            <button 
              type="button"
              onClick={() => handleZoom(0.15)} 
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn size={17} />
            </button>

            <div className="h-4 w-px bg-white/10 mx-1" />

            {/* Quick rotate & reset */}
            <div className="flex items-center gap-1.5">
              <button 
                type="button"
                onClick={() => handleRotate(-90)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Rotate left"
              >
                <RotateCcw size={15} />
              </button>
              <button 
                type="button"
                onClick={() => handleRotate(90)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Rotate right"
              >
                <RotateCw size={15} />
              </button>
              <button 
                type="button"
                onClick={handleReset} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Reset adjustments"
              >
                <Undo2 size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions - Meta/Facebook Clean Cancel and Save Buttons */}
        <footer className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#141519] border-t border-white/10 flex items-center justify-end gap-3">
          <button 
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white/80 hover:text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            className="px-6 py-2.5 rounded-xl bg-aeirmist-cyan text-black hover:brightness-110 active:scale-95 text-xs sm:text-sm font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Applying HD Crop...</span>
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={2.5} />
                <span>Save</span>
              </>
            )}
          </button>
        </footer>

        {/* Offscreen Canvas for High-Res Output */}
        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </div>
  );
};

