import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, 
  Sliders, 
  Sparkles, 
  Upload, 
  Save, 
  X, 
  Check, 
  Loader2, 
  ChevronRight,
  Eye,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Focus,
  Maximize2
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { ChatWallpaperConfig } from './ChatWallpaperLayer';
import { MediaQuality } from '../../services/MediaService';
import { logger } from '@/src/utils/logger';


interface ChatWallpaperControllerProps {
  chatId: string;
  chatThemeSettings?: ChatWallpaperConfig;
  onClose: () => void;
}

const PRESET_WALLPAPERS = [
  { id: 'preset-dreamy-cloud', name: 'Dreamy Cloud', value: '/wallpapers/dreamy-cloud.jpg', isGradient: false },
  { id: 'preset-pink-aesthetic', name: 'Pink Aesthetic', value: '/wallpapers/pink-aesthetic.jpg', isGradient: false },
  { id: 'preset-sunset-romance', name: 'Sunset Romance', value: '/wallpapers/sunset-romance.jpg', isGradient: false },
  { id: 'preset-cloud-teddy', name: 'Cloud Teddy', value: '/wallpapers/cloud-teddy.jpg', isGradient: false },
  { id: 'preset-cozy-bear', name: 'Cozy Bear', value: '/wallpapers/cozy-bear.jpg', isGradient: false },
  { id: 'preset-blue-vibes', name: 'Blue Pastel', value: '/wallpapers/blue-vibes.jpg', isGradient: false },
  { id: 'preset-lavender-bunny', name: 'Lavender Bunny', value: '/wallpapers/lavender-bunny.jpg', isGradient: false },
  { id: 'preset-mint-froggy', name: 'Mint Froggy', value: '/wallpapers/mint-froggy.jpg', isGradient: false },
];

export interface MessengerTheme {
  id: string;
  name: string;
  category: string;
  bubbleGradient: string; // Used on message bubbles
  previewColor: string; // Main color for swatch circle
  bgGradientDark: string; // Thematic background for dark theme
  bgGradientLight: string; // Thematic background for light theme
  description: string;
}

export const MESSENGER_THEMES: MessengerTheme[] = [
  {
    id: 'ocean',
    name: 'Ocean Blue',
    category: 'Classic',
    bubbleGradient: 'linear-gradient(135deg, #0084FF 0%, #00C6FF 100%)',
    previewColor: '#0084FF',
    bgGradientDark: 'linear-gradient(135deg, #030f1c 0%, #08213b 50%, #004e92 100%)',
    bgGradientLight: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%)',
    description: 'Classic azure & sky'
  },
  {
    id: 'sunset',
    name: 'Sunset Peach',
    category: 'Vibrant',
    bubbleGradient: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)',
    previewColor: '#FF512F',
    bgGradientDark: 'linear-gradient(135deg, #1c0813 0%, #3a0d26 50%, #681534 100%)',
    bgGradientLight: 'linear-gradient(135deg, #ffedd5 0%, #fecdd3 50%, #fed7aa 100%)',
    description: 'Amber & coral sunset'
  },
  {
    id: 'cyberpunk',
    name: 'Neon Cyber',
    category: 'Electric',
    bubbleGradient: 'linear-gradient(135deg, #00f2ff 0%, #ff00ea 100%)',
    previewColor: '#00f2ff',
    bgGradientDark: 'linear-gradient(135deg, #060814 0%, #170d2b 50%, #0c1a2e 100%)',
    bgGradientLight: 'linear-gradient(135deg, #ecfeff 0%, #fdf4ff 50%, #ede9fe 100%)',
    description: 'Electric cyan & magenta'
  },
  {
    id: 'lavender',
    name: 'Lilac Dream',
    category: 'Pastel',
    bubbleGradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
    previewColor: '#8B5CF6',
    bgGradientDark: 'linear-gradient(135deg, #130924 0%, #25103d 50%, #3e145e 100%)',
    bgGradientLight: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #e9d5ff 100%)',
    description: 'Soft lavender & orchid'
  },
  {
    id: 'emerald',
    name: 'Emerald Mint',
    category: 'Nature',
    bubbleGradient: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
    previewColor: '#10B981',
    bgGradientDark: 'linear-gradient(135deg, #02140e 0%, #062b1e 50%, #0b4532 100%)',
    bgGradientLight: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)',
    description: 'Crisp botanical mint'
  },
  {
    id: 'berry',
    name: 'Berry Rose',
    category: 'Romantic',
    bubbleGradient: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
    previewColor: '#f43f5e',
    bgGradientDark: 'linear-gradient(135deg, #1c050c 0%, #380a19 50%, #5c0f2a 100%)',
    bgGradientLight: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 50%, #fecdd3 100%)',
    description: 'Velvet raspberry & ruby'
  },
  {
    id: 'cotton_candy',
    name: 'Cotton Candy',
    category: 'Sweet',
    bubbleGradient: 'linear-gradient(135deg, #ec4899 0%, #3b82f6 100%)',
    previewColor: '#ec4899',
    bgGradientDark: 'linear-gradient(135deg, #160a22 0%, #28123c 50%, #152244 100%)',
    bgGradientLight: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #e0f2fe 100%)',
    description: 'Playful pink & blue'
  },
  {
    id: 'midnight',
    name: 'Midnight Slate',
    category: 'Minimal',
    bubbleGradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
    previewColor: '#475569',
    bgGradientDark: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%)',
    bgGradientLight: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
    description: 'Minimal slate & obsidian'
  }
];

export const ChatWallpaperController: React.FC<ChatWallpaperControllerProps> = ({
  chatId,
  chatThemeSettings,
  onClose
}) => {
  const { uploadMedia, updateConversationThemeSettings, updateProfile, profile, addToast } = useAeirmist();
  const [isLight, setIsLight] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('light');
  });

  useEffect(() => {
    const checkTheme = () => {
      setIsLight(document.documentElement.classList.contains('light'));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  const globalWallpaper = profile?.themeSettings?.chatWallpaper || {};

  // Form states initialized with existing per-chat configurations, or fallback to global configurations
  const [currentWallpaper, setCurrentWallpaper] = useState(chatThemeSettings?.wallpaperURL || globalWallpaper.wallpaperURL || (isLight ? PRESET_WALLPAPERS[4].value : PRESET_WALLPAPERS[0].value));
  const [blurLevel, setBlurLevel] = useState(chatThemeSettings?.blurLevel !== undefined ? chatThemeSettings.blurLevel : (globalWallpaper.blurLevel !== undefined ? globalWallpaper.blurLevel : 0));
  const [brightness, setBrightness] = useState(chatThemeSettings?.brightness !== undefined ? chatThemeSettings.brightness : (globalWallpaper.brightness !== undefined ? globalWallpaper.brightness : (isLight ? 0.95 : 0.65)));
  const [selectedThemeId, setSelectedThemeId] = useState<string>(chatThemeSettings?.themeId || globalWallpaper.themeId || 'ocean');
  const [cropPosition, setCropPosition] = useState(chatThemeSettings?.cropPosition || globalWallpaper.cropPosition || { x: 50, y: 50, zoom: 1 });
  const [parallaxEnabled, setParallaxEnabled] = useState(chatThemeSettings?.parallaxEnabled ?? globalWallpaper.parallaxEnabled ?? false);
  const [saveScope, setSaveScope] = useState<'me' | 'both'>('me'); // 'me' = single inbox for me, 'both' = both participants in this chat

  const selectedTheme = useMemo(() => {
    return MESSENGER_THEMES.find(t => t.id === selectedThemeId) || MESSENGER_THEMES[0];
  }, [selectedThemeId]);

  const handleSelectTheme = (theme: MessengerTheme) => {
    setSelectedThemeId(theme.id);
    setCurrentWallpaper(isLight ? theme.bgGradientLight : theme.bgGradientDark);
  };
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const touchDistRef = useRef<number | null>(null);

  const isImageWallpaper = !(currentWallpaper.startsWith('linear-gradient') || currentWallpaper.startsWith('radial-gradient'));

  // Pointer drag handler for side-to-side and up-down movement
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isImageWallpaper) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;

    const container = previewRef.current;
    if (!container) return;

    setIsDragging(true);
    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCropX = cropPosition.x;
    const startCropY = cropPosition.y;

    const sensX = (100 / (rect.width || 300)) * (1 / Math.max(0.6, cropPosition.zoom));
    const sensY = (100 / (rect.height || 300)) * (1 / Math.max(0.6, cropPosition.zoom));

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) * sensX;
      const deltaY = (moveEvent.clientY - startY) * sensY;

      setCropPosition(prev => ({
        ...prev,
        x: Math.max(0, Math.min(100, Math.round((startCropX + deltaX) * 10) / 10)),
        y: Math.max(0, Math.min(100, Math.round((startCropY + deltaY) * 10) / 10))
      }));
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Mouse wheel scroll to zoom
  const handleWheelZoom = (e: React.WheelEvent) => {
    if (!isImageWallpaper) return;
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setCropPosition(prev => ({
      ...prev,
      zoom: Math.max(1, Math.min(3, Math.round((prev.zoom + delta) * 100) / 100))
    }));
  };

  // Touch pinch to zoom
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isImageWallpaper) return;
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touchDistRef.current !== null) {
        const delta = (dist - touchDistRef.current) * 0.006;
        setCropPosition(prev => ({
          ...prev,
          zoom: Math.max(1, Math.min(3, Math.round((prev.zoom + delta) * 100) / 100))
        }));
      }
      touchDistRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  // Step nudge helpers
  const nudgePosition = (dx: number, dy: number) => {
    setCropPosition(prev => ({
      ...prev,
      x: Math.max(0, Math.min(100, Math.round((prev.x + dx) * 10) / 10)),
      y: Math.max(0, Math.min(100, Math.round((prev.y + dy) * 10) / 10))
    }));
  };

  const stepZoom = (delta: number) => {
    setCropPosition(prev => ({
      ...prev,
      zoom: Math.max(1, Math.min(3, Math.round((prev.zoom + delta) * 100) / 100))
    }));
  };

  const resetCrop = () => {
    setCropPosition({ x: 50, y: 50, zoom: 1 });
  };

  // Computed configuration for instant live preview
  const previewConfig: ChatWallpaperConfig = useMemo(() => ({
    wallpaperURL: currentWallpaper,
    blurLevel,
    brightness,
    effectType: 'none',
    overlayColor: isLight ? 'rgba(255, 255, 255, 0.1)' : '#000000',
    neonIntensity: 0.8,
    cropPosition,
    parallaxEnabled
  }), [currentWallpaper, blurLevel, brightness, cropPosition, parallaxEnabled, isLight]);

  // Handle personal background upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Quick security validation: file size < 15MB and image type
    if (!file.type.startsWith('image/')) {
      addToast({ title: 'Invalid format', message: 'File must be a valid image format.', type: 'warning' });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      addToast({ title: 'File too large', message: 'Background volume exceeds 15MB threshold.', type: 'warning' });
      return;
    }

    // Instant local preview update (0ms latency!)
    const localBlobUrl = URL.createObjectURL(file);
    setCurrentWallpaper(localBlobUrl);

    setIsUploading(true);
    try {
      const downloadURL = await uploadMedia(file, `users/${profile?.id}/wallpapers`, (progress) => {
        logger.info(`Uploading wallpaper: ${Math.round(progress)}%`);
      }, MediaQuality.WALLPAPER_LITE);
      if (downloadURL) {
        setCurrentWallpaper(downloadURL);
      }
    } catch (err) {
      logger.warn('Wallpaper cloud upload warning, keeping local preview', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Perform save operation based on user chosen score
  const handleSaveSettings = async () => {
    setIsSaving(true);
    const resolvedConfig = {
      wallpaperURL: currentWallpaper,
      blurLevel,
      brightness,
      themeId: selectedThemeId,
      bubbleGradient: selectedTheme?.bubbleGradient || MESSENGER_THEMES[0].bubbleGradient,
      effectType: 'none',
      bubbleStyle: 'glass',
      overlayColor: isLight ? 'rgba(255, 255, 255, 0.1)' : '#000000',
      neonIntensity: 0.8,
      cropPosition,
      parallaxEnabled
    };

    try {
      if (saveScope === 'me') {
        // Apply for Me: Save to personal user profile perChatWallpapers[chatId]
        const currentThemeSettings = profile?.themeSettings || {};
        const currentPerChat = currentThemeSettings.perChatWallpapers || {};
        await updateProfile({
          ...profile,
          themeSettings: {
            ...currentThemeSettings,
            perChatWallpapers: {
              ...currentPerChat,
              [chatId]: resolvedConfig
            }
          }
        });
      } else {
        // Apply for Both: Save to shared conversation document for both participants
        await updateConversationThemeSettings(chatId, resolvedConfig);

        // Remove any personal override for this chat so shared conversation theme applies
        const currentThemeSettings = profile?.themeSettings || {};
        const currentPerChat = { ...(currentThemeSettings.perChatWallpapers || {}) };
        if (currentPerChat[chatId]) {
          delete currentPerChat[chatId];
          await updateProfile({
            ...profile,
            themeSettings: {
              ...currentThemeSettings,
              perChatWallpapers: currentPerChat
            }
          });
        }
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      logger.error('Failed saving wallpaper parameters', err);
      addToast({ title: 'Save failed', message: 'Write request rejected. Check connection or quota restriction.', type: 'warning' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Semi-transparent blur background */}
      <div className="absolute inset-0 bg-aeirmist-bg/85 backdrop-blur-md" onClick={onClose} />

      {/* Main interactive panel */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-4xl bg-white dark:bg-aeirmist-bg border border-slate-200 dark:border-white/10 rounded-[28px] overflow-hidden shadow-2xl flex flex-col md:grid md:grid-cols-2 h-[90vh] md:h-[600px]"
      >
        
        {/* Left Side: Real-time Live Preview Panel */}
        <div 
          ref={previewRef}
          onPointerDown={handlePointerDown}
          onWheel={handleWheelZoom}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/10 ${
            isLight ? 'bg-slate-100' : 'bg-black/40'
          } flex flex-col justify-between p-4 md:p-6 overflow-hidden min-h-[280px] md:min-h-[300px] flex-shrink-0 touch-none select-none ${
            isImageWallpaper ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          {/* Wallpaper Layer bound directly inside boundaries of preview panel for instant visual alignment */}
          <div className="absolute inset-0 md:rounded-l-[28px] overflow-hidden pointer-events-none">
            {/* Background color */}
            <div className={`absolute inset-0 ${isLight ? 'bg-slate-100' : 'bg-aeirmist-bg'}`} />
            
            {/* Live custom background */}
            <div 
              className="absolute inset-0 transition-all duration-150 ease-out"
              style={{
                filter: `blur(${blurLevel}px)`,
                opacity: isLight && isImageWallpaper ? 1 : brightness,
                background: currentWallpaper.startsWith('linear-gradient') || currentWallpaper.startsWith('radial-gradient') 
                  ? currentWallpaper 
                  : `url(${currentWallpaper}) no-repeat`,
                backgroundPosition: `${cropPosition.x}% ${cropPosition.y}%`,
                backgroundSize: cropPosition.zoom === 1 ? 'cover' : `${cropPosition.zoom * 100}%`,
              }}
            />

            {/* Crosshair grid overlay when dragging or actively adjusting frame */}
            {isImageWallpaper && isDragging && (
              <div className="absolute inset-0 border border-aeirmist-cyan/40 pointer-events-none bg-aeirmist-cyan/5 transition-opacity duration-150">
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-aeirmist-cyan/30 border-dashed" />
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-aeirmist-cyan/30 border-dashed" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-aeirmist-cyan/60 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-aeirmist-cyan animate-ping" />
                </div>
              </div>
            )}

            {/* Custom Overlay tint */}
            <div 
              className={`absolute inset-0 ${isLight ? 'bg-white/20' : 'bg-black/40'}`} 
              style={{ opacity: isLight ? Math.max(0, (0.85 - brightness) * 0.25) : Math.max(0, 1 - brightness) }}
            />

          </div>

          {/* Header Preview Bar & Direct Image Controls */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 keep-white flex items-center gap-2 bg-black/60 px-2.5 py-1 rounded-full border border-white/15 backdrop-blur-md" data-keep-white="true">
              <Eye size={12} className="text-aeirmist-cyan" />
              Preview {isImageWallpaper ? '• Drag/Pinch to Align' : ''}
            </span>
            <button onClick={onClose} className="p-2 bg-black/40 hover:bg-black/60 rounded-full border border-white/10 transition-all text-white/70 hover:text-white md:hidden">
              <X size={14} />
            </button>
          </div>

          {/* Simulated Chat Interface Floating Items */}
          <div className="relative z-10 flex-1 flex flex-col justify-end space-y-3 py-3 md:py-6 pointer-events-none">
            {/* Incoming Bubble */}
            <div className="flex gap-2.5 max-w-[80%] items-end">
              <div className="w-6 h-6 rounded-lg bg-white/40 dark:bg-white/10 border border-white/20 flex-shrink-0" />
              <div className="rounded-2xl p-2.5 bg-white/85 dark:bg-white/10 border border-white/60 dark:border-white/10 text-[10px] text-slate-800 dark:text-white/80 leading-relaxed backdrop-blur-xl shadow-sm">
                How does this theme look?
              </div>
            </div>

            {/* Outgoing Bubble */}
            <div className="flex gap-2.5 max-w-[80%] items-end self-end flex-row-reverse">
              <div 
                className="w-6 h-6 rounded-lg border border-white/30 flex-shrink-0 transition-all duration-300 shadow-sm"
                style={{ background: selectedTheme?.bubbleGradient || 'linear-gradient(to right, #4F46E5, #7C3AED)' }}
              />
              <div 
                className="rounded-2xl p-2.5 border border-white/20 text-[10px] text-white keep-white backdrop-blur-xl text-right shadow-md transition-all duration-300" 
                data-keep-white="true"
                style={{ background: selectedTheme?.bubbleGradient || 'linear-gradient(to right, #4F46E5, #7C3AED)' }}
              >
                {selectedTheme ? `${selectedTheme.name} theme is active!` : 'Looks perfect! Extreme clarity maintained automatically.'}
              </div>
            </div>
          </div>

          {/* On-Image Quick HUD Toolbar for Image Adjustment */}
          {isImageWallpaper ? (
            <div className="relative z-10 flex items-center justify-between p-2 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-md gap-2">
              <div className="flex items-center gap-1">
                <button 
                  type="button"
                  onClick={() => stepZoom(-0.1)} 
                  title="Zoom Out"
                  className="p-1.5 bg-white/5 hover:bg-white/15 rounded-lg text-white/80 hover:text-aeirmist-cyan transition-colors"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="text-[9px] font-mono font-bold text-aeirmist-cyan px-1 min-w-[36px] text-center">
                  {cropPosition.zoom.toFixed(2)}x
                </span>
                <button 
                  type="button"
                  onClick={() => stepZoom(0.1)} 
                  title="Zoom In"
                  className="p-1.5 bg-white/5 hover:bg-white/15 rounded-lg text-white/80 hover:text-aeirmist-cyan transition-colors"
                >
                  <ZoomIn size={13} />
                </button>
              </div>

              {/* Arrow pad nudge controls */}
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => nudgePosition(-5, 0)} title="Pan Left" className="p-1 bg-white/5 hover:bg-white/15 rounded text-white/70 hover:text-white">
                  <ArrowLeft size={12} />
                </button>
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => nudgePosition(0, -5)} title="Pan Up" className="p-1 bg-white/5 hover:bg-white/15 rounded text-white/70 hover:text-white">
                    <ArrowUp size={12} />
                  </button>
                  <button type="button" onClick={() => nudgePosition(0, 5)} title="Pan Down" className="p-1 bg-white/5 hover:bg-white/15 rounded text-white/70 hover:text-white">
                    <ArrowDown size={12} />
                  </button>
                </div>
                <button type="button" onClick={() => nudgePosition(5, 0)} title="Pan Right" className="p-1 bg-white/5 hover:bg-white/15 rounded text-white/70 hover:text-white">
                  <ArrowRight size={12} />
                </button>
              </div>

              <button 
                type="button"
                onClick={resetCrop} 
                title="Reset Frame Center"
                className="p-1.5 bg-white/5 hover:bg-white/15 rounded-lg text-white/60 hover:text-white flex items-center gap-1 text-[9px] font-mono transition-colors"
              >
                <RotateCcw size={12} />
                <span className="hidden sm:inline uppercase text-[8px]">Reset</span>
              </button>
            </div>
          ) : (
            <div className="relative z-10 hidden md:flex items-center p-3 bg-black/40 border border-white/5 rounded-2xl gap-3 backdrop-blur-md">
              <div className="w-1.5 h-1.5 rounded-full bg-aeirmist-cyan animate-ping" />
              <span className="text-[9px] font-mono text-aeirmist-cyan">LIVE PREVIEW</span>
            </div>
          )}
        </div>

        {/* Right Side: Options and Configurations controls */}
        <div className="flex-1 flex flex-col justify-between p-4 md:p-8 overflow-y-auto w-full no-scrollbar">
          <div className="space-y-6">
            
            {/* Title Block Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="text-aeirmist-cyan" size={18} />
                  Chat appearance
                </h2>
                <div className="text-[10px] text-slate-500 dark:text-white/30 uppercase tracking-widest mt-1">Customize chat wallpaper</div>
              </div>
              <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-full border border-slate-200 dark:border-white/5 transition-all text-slate-500 hover:text-slate-800 dark:text-white/40 dark:hover:text-white hidden md:block">
                <X size={16} />
              </button>
            </div>

            {/* preset wallpapers grid selector */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40 flex items-center gap-1.5">
                <Palette size={12} className="text-aeirmist-cyan" />
                Choose a Wallpaper
              </span>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_WALLPAPERS.map((wp) => {
                  const isCurrent = wp.value === currentWallpaper;
                  return (
                    <button
                      key={wp.id}
                      onClick={() => setCurrentWallpaper(wp.value)}
                      className={`relative aspect-[3/4] rounded-xl overflow-hidden border transition-all ${
                        isCurrent ? 'border-aeirmist-cyan scale-95 shadow-[0_0_15px_rgba(0,242,255,0.4)]' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:scale-[1.03]'
                      }`}
                      style={{
                        background: wp.isGradient ? wp.value : `url(${wp.value}) center / cover no-repeat`
                      }}
                    >
                      {isCurrent && (
                        <div className="absolute inset-0 bg-aeirmist-cyan/20 flex items-center justify-center">
                          <Check size={14} className="text-aeirmist-cyan drop-shadow-[0_0_5px_rgba(0,0,0,0.8)]" />
                        </div>
                      )}
                      
                      <div className="absolute bottom-0 inset-x-0 bg-black/75 py-1 text-[7px] font-bold text-center text-white keep-white truncate px-0.5" data-keep-white="true">
                        {wp.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom file background uploader with drag and drag input support */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40 flex items-center gap-1.5">
                <Upload size={12} className="text-aeirmist-cyan" />
                Upload Custom Picture
              </span>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
              <button
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-16 rounded-xl border border-dashed border-slate-300 dark:border-white/10 hover:border-aeirmist-cyan/40 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-center gap-3 transition-all cursor-pointer group active:scale-98"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="animate-spin text-aeirmist-cyan" size={18} />
                    <span className="text-xs font-mono text-aeirmist-cyan uppercase tracking-widest">UPLOADING IMAGE...</span>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-white/5 flex items-center justify-center group-hover:bg-aeirmist-cyan/10 transition-colors">
                      <Upload size={14} className="text-slate-600 dark:text-white/60 group-hover:text-aeirmist-cyan transition-colors" />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-slate-800 dark:text-white/80 uppercase font-black tracking-widest">Upload custom image</div>
                      <div className="text-[8px] text-slate-500 dark:text-white/30 uppercase mt-0.5 font-bold">JPG, PNG, WEBP. Under 5MB limit.</div>
                    </div>
                  </>
                )}
              </button>
            </div>

            {/* Picture Frame & Positioning Controls (When Image Wallpaper Active) */}
            {isImageWallpaper && (
              <div className="space-y-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-3.5 rounded-2xl">
                <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest border-b border-slate-200 dark:border-white/5 pb-2">
                  <span className="text-slate-800 dark:text-white/80 flex items-center gap-1.5">
                    <Move size={13} className="text-aeirmist-cyan" />
                    Picture Frame & Positioning
                  </span>
                  <button 
                    type="button"
                    onClick={resetCrop}
                    className="text-[8px] text-slate-500 dark:text-white/40 hover:text-aeirmist-cyan uppercase font-bold flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw size={10} />
                    Reset Frame
                  </button>
                </div>

                {/* Zoom Scale */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-600 dark:text-white/60 uppercase">
                    <span>Zoom Scale</span>
                    <span className="text-aeirmist-cyan font-mono">{cropPosition.zoom.toFixed(2)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="3" 
                    step="0.05"
                    value={cropPosition.zoom} 
                    onChange={(e) => setCropPosition(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                    className="w-full accent-aeirmist-cyan h-1 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                {/* Horizontal Position (X) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-600 dark:text-white/60 uppercase">
                    <span>Horizontal Position (Left ↔ Right)</span>
                    <span className="text-aeirmist-cyan font-mono">{Math.round(cropPosition.x)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1"
                    value={cropPosition.x} 
                    onChange={(e) => setCropPosition(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
                    className="w-full accent-aeirmist-cyan h-1 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                {/* Vertical Position (Y) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-600 dark:text-white/60 uppercase">
                    <span>Vertical Position (Top ↕ Bottom)</span>
                    <span className="text-aeirmist-cyan font-mono">{Math.round(cropPosition.y)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1"
                    value={cropPosition.y} 
                    onChange={(e) => setCropPosition(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
                    className="w-full accent-aeirmist-cyan h-1 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                {/* Quick Focus Alignment Presets */}
                <div className="pt-1">
                  <div className="text-[8px] font-black uppercase text-slate-500 dark:text-white/30 tracking-widest mb-1.5">Quick Framing Presets</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { label: 'Center', x: 50, y: 50 },
                      { label: 'Face/Top', x: 50, y: 20 },
                      { label: 'Bottom', x: 50, y: 80 },
                      { label: 'Left', x: 20, y: 50 },
                      { label: 'Right', x: 80, y: 50 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setCropPosition(prev => ({ ...prev, x: preset.x, y: preset.y }))}
                        className="py-1.5 px-1 bg-slate-200/80 hover:bg-aeirmist-cyan/10 hover:border-aeirmist-cyan/30 dark:bg-white/5 border border-slate-300/60 dark:border-white/5 rounded-lg text-[8px] font-bold uppercase text-slate-700 hover:text-slate-900 dark:text-white/60 dark:hover:text-white transition-all text-center truncate"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* range controls for blur & intensity (dim level) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Blur Level Slider */}
              <div className="space-y-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-3 rounded-2xl">
                <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest">
                  <span className="text-slate-600 dark:text-white/40 flex items-center gap-1">
                     <Sliders size={12} className="text-slate-500 dark:text-white/40" />
                     Blur Amount
                  </span>
                  <span className="text-aeirmist-cyan font-mono">{blurLevel}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="20" 
                  value={blurLevel} 
                  onChange={(e) => setBlurLevel(parseInt(e.target.value))}
                  className="w-full accent-aeirmist-cyan h-1 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer"
                />
                <div className="text-[8px] text-slate-500 dark:text-white/20 uppercase font-medium">Increase this to blur the wallpaper</div>
              </div>

              {/* brightness / Dim Level Slider */}
              <div className="space-y-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-3 rounded-2xl">
                <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest">
                  <span className="text-slate-600 dark:text-white/40 flex items-center gap-1">
                    <Eye size={12} className="text-slate-500 dark:text-white/40" />
                    Wallpaper Brightness
                  </span>
                  <span className="text-aeirmist-cyan font-mono">{Math.round(brightness * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  step="5"
                  value={brightness * 100} 
                  onChange={(e) => setBrightness(parseFloat(e.target.value) / 100)}
                  className="w-full accent-aeirmist-cyan h-1 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer"
                />
                <div className="text-[8px] text-slate-500 dark:text-white/20 uppercase font-medium">Controls wallpaper clarity and contrast</div>
              </div>
            </div>

            {/* Parallax Toggle */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${parallaxEnabled ? 'bg-aeirmist-cyan/15 text-aeirmist-cyan' : 'bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-white/30'}`}>
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white/80">Parallax Effect</div>
                  <div className="text-[8px] text-slate-500 dark:text-white/20 uppercase font-bold">Subtle motion based on movement</div>
                </div>
              </div>
              <button
                onClick={() => setParallaxEnabled(!parallaxEnabled)}
                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${parallaxEnabled ? 'bg-aeirmist-cyan shadow-[0_0_10px_rgba(0,242,255,0.3)]' : 'bg-slate-300 dark:bg-white/10'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${parallaxEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {/* Messenger Themes */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-white/50 flex items-center gap-1.5">
                  <Palette size={13} className="text-aeirmist-cyan" />
                  Chat Themes & Bubble Gradients
                </span>
                <span className="text-[9px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-wider">
                  8 Presets
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MESSENGER_THEMES.map((theme) => {
                  const isCurrent = theme.id === selectedThemeId;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleSelectTheme(theme)}
                      className={`group p-2.5 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                        isCurrent 
                          ? 'border-aeirmist-cyan bg-aeirmist-cyan/10 dark:bg-aeirmist-cyan/15 shadow-[0_0_20px_rgba(0,242,255,0.15)] ring-2 ring-aeirmist-cyan/30 scale-[1.02]' 
                          : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/20 hover:scale-[1.01]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        {/* Messenger Dual Gradient Theme Swatch */}
                        <div 
                          className="w-7 h-7 rounded-full shadow-md flex items-center justify-center p-[2px] border border-white/30 shrink-0"
                          style={{ background: theme.bubbleGradient }}
                        >
                          <div 
                            className="w-3.5 h-3.5 rounded-full" 
                            style={{ background: isLight ? theme.bgGradientLight : theme.bgGradientDark }} 
                          />
                        </div>
                        {isCurrent && (
                          <div className="w-5 h-5 rounded-full bg-aeirmist-cyan text-black flex items-center justify-center shadow-sm shrink-0">
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className={`text-[10px] font-bold truncate leading-tight ${isCurrent ? 'text-aeirmist-cyan' : 'text-slate-800 dark:text-white/90'}`}>
                          {theme.name}
                        </div>
                        <div className="text-[8px] text-slate-400 dark:text-white/40 truncate mt-0.5 font-medium">
                          {theme.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* scope selection */}
            <div className="space-y-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 p-3 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-white/40 flex items-center gap-1">
                <Info size={12} />
                Apply changes to
              </span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setSaveScope('me')}
                  className={`py-2.5 px-3 rounded-xl border font-bold uppercase text-[9px] tracking-widest transition-all ${
                    saveScope === 'me' 
                      ? 'border-aeirmist-cyan text-slate-900 dark:text-white bg-aeirmist-cyan/15 shadow-[0_0_15px_rgba(0,242,255,0.15)] font-black' 
                      : 'border-slate-200 dark:border-white/5 text-slate-600 dark:text-white/40 hover:text-slate-900 dark:hover:text-white/60 hover:border-slate-300'
                  }`}
                >
                  Apply for Me
                </button>
                <button
                  type="button"
                  onClick={() => setSaveScope('both')}
                  className={`py-2.5 px-3 rounded-xl border font-bold uppercase text-[9px] tracking-widest transition-all ${
                    saveScope === 'both' 
                      ? 'border-aeirmist-magenta text-slate-900 dark:text-white bg-aeirmist-magenta/15 shadow-[0_0_15px_rgba(255,0,234,0.15)] font-black' 
                      : 'border-slate-200 dark:border-white/5 text-slate-600 dark:text-white/40 hover:text-slate-900 dark:hover:text-white/60 hover:border-slate-300'
                  }`}
                >
                  Apply for Both
                </button>
              </div>
              <div className="text-[8px] font-mono text-slate-500 dark:text-white/40 uppercase tracking-wide text-center mt-1">
                {saveScope === 'me' ? '* Visible in this inbox for you only' : '* Visible to both participants in this chat'}
              </div>
            </div>

          </div>

          {/* Action button triggers */}
          <div className="border-t border-slate-200 dark:border-white/5 pt-4 mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-white/60 hover:text-slate-900 dark:hover:text-white font-bold uppercase text-[10px] tracking-widest hover:border-slate-300 dark:hover:border-white/20 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={isSaving || saveSuccess}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-aeirmist-cyan via-aeirmist-magenta to-aeirmist-cyan bg-[length:200%_auto] hover:bg-right font-black uppercase text-[10px] tracking-widest text-black flex items-center justify-center gap-2 transition-all duration-500 shadow-[0_0_20px_rgba(0,242,255,0.2)] hover:shadow-[0_0_30px_rgba(255,0,234,0.4)] hover:scale-[1.02] active:scale-95 disabled:scale-100 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin text-black" size={14} />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check size={14} className="text-black" />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={14} className="text-black" />
                  Save Settings
                </>
              )}
            </button>
          </div>

        </div>

      </motion.div>
    </div>
  );
};
