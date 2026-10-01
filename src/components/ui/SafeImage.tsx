import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageIcon } from 'lucide-react';
import { mediaService } from '../../services/MediaService';
import { logger } from '@/src/utils/logger';


interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  useCache?: boolean;
  blurThumbnail?: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export const SafeImage: React.FC<SafeImageProps> = ({ 
  src, 
  alt, 
  useCache = true, 
  blurThumbnail, 
  className = '', 
  fallbackIcon,
  onLoad,
  onError,
  ...props 
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(blurThumbnail || src);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!src) return;

    let isMounted = true;
    setIsLoaded(false);
    setIsError(false);

    const loadImage = async () => {
      try {
        let finalSrc = src;
        
        if (useCache && !src.startsWith('data:') && !src.startsWith('blob:')) {
          // Attempt to get cached version or fetch and cache
          finalSrc = await mediaService.getCachedMediaURL(src, 'image/webp');
        }

        if (isMounted) {
          setCurrentSrc(finalSrc);
        }
      } catch (err) {
        logger.warn("[SafeImage] Cache/Fetch failed, using direct URL", err);
        if (isMounted) setCurrentSrc(src);
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [src, useCache]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsError(true);
    onError?.(e);
  };

  return (
    <div className={`relative overflow-hidden bg-white/5 w-full h-full flex items-center justify-center ${className.includes('rounded') ? className.match(/rounded-[^\s]*/)?.[0] : ''}`}>
      <AnimatePresence mode="popLayout">
        {!isLoaded && !isError && blurThumbnail && (
          <motion.img
            key="thumbnail"
            src={blurThumbnail}
            alt="loading"
            className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-50"
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <img
        width={props.width || '100%'}
        height={props.height || '100%'}
        {...props}
        src={currentSrc || undefined}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
        style={{ imageRendering: 'auto', aspectRatio: props.style?.aspectRatio || 'auto', ...props.style }}
        className={`transition-opacity duration-300 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
      />

      <AnimatePresence>
        {isError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md text-white/40 gap-3 p-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-1">
              {fallbackIcon || <ImageIcon size={20} className="text-white/20" />}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider block text-white/70">Image Unavailable</span>
              <p className="text-[9px] opacity-60 leading-relaxed max-w-[140px]">Could not load image.</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsError(false);
                setIsLoaded(false);
                const originalSrc = src;
                setCurrentSrc(undefined);
                setTimeout(() => setCurrentSrc(originalSrc), 50);
              }}
              className="mt-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-[9px] font-medium tracking-wide transition-all active:scale-95"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!isLoaded && !isError && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent animate-pulse" />
      )}
    </div>
  );
};
