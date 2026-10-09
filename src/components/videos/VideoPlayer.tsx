import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Settings, 
  RotateCcw, 
  ArrowLeft,
  Tv,
  Check,
  AlertCircle
} from 'lucide-react';
import { Video } from '../../types/videos';
import { formatDuration, savePlaybackProgress } from '../../utils/videoStorage';
import { logger } from '@/src/utils/logger';


interface VideoPlayerProps {
  video: Video;
  initialTime?: number;
  onEnded?: () => void;
  onBack?: () => void;
  isTheaterMode?: boolean;
  onToggleTheaterMode?: () => void;
  autoPlayOnMount?: boolean;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const QUALITY_OPTIONS = ['Auto', '1080p', '720p', '480p', '360p'];

export const VideoPlayerComponent: React.FC<VideoPlayerProps> = ({
  video,
  initialTime = 0,
  onEnded,
  onBack,
  isTheaterMode,
  onToggleTheaterMode,
  autoPlayOnMount = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [showControls, setShowControls] = useState(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'speed' | 'quality'>('main');
  
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize starting position
  useEffect(() => {
    if (videoRef.current && initialTime > 0) {
      videoRef.current.currentTime = initialTime;
      setCurrentTime(initialTime);
    }
  }, [initialTime, video.id]);

  // Autoplay handler when explicitly mounted in watch mode
  useEffect(() => {
    if (autoPlayOnMount && videoRef.current) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        logger.info('[VideoPlayer] Autoplay prevented by browser:', err);
        setIsPlaying(false);
      });
    }
  }, [autoPlayOnMount, video.id]);

  // Save playback position periodically
  useEffect(() => {
    if (!isPlaying || !duration) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        const cur = videoRef.current.currentTime;
        savePlaybackProgress(video.id, cur, duration);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isPlaying, duration, video.id]);

  // Mouse activity timer for hiding controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsMenu) {
        setShowControls(false);
      }
    }, 2500);
  }, [isPlaying, showSettingsMenu]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(false);
        setIsPlaying(true);
      }).catch((e) => {
        logger.error('Playback failed', e);
        setHasError(true);
      });
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      setVolume(0.8);
      videoRef.current.volume = 0.8;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      savePlaybackProgress(video.id, time, duration);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSettingsMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      }).catch(() => {
        setHasError(true);
        setIsLoading(false);
      });
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (isPlaying) setShowControls(false);
      }}
      className={`relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group select-none ${
        isFullscreen ? 'rounded-none h-screen w-screen flex items-center justify-center' : ''
      }`}
    >
      {/* Video Element */}
      {!hasError && (
        <video
          ref={videoRef}
          src={video.videoURL}
          poster={video.thumbnailURL || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200'}
          crossOrigin="anonymous"
          preload="auto"
          playsInline
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
            setIsLoading(false);
          }}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => {
            setIsLoading(false);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (videoRef.current && duration) {
              savePlaybackProgress(video.id, duration, duration);
            }
            onEnded?.();
          }}
        />
      )}

      {/* Loading Overlay */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-10">
          <div className="w-12 h-12 border-3 border-white/20 border-t-aeirmist-cyan rounded-full animate-spin" />
        </div>
      )}

      {/* Human Error Overlay (No sci-fi jargon) */}
      {hasError && (
        <div className="absolute inset-0 bg-[#0a0a0c] flex flex-col items-center justify-center p-6 text-center z-20">
          {video.thumbnailURL && (
            <img 
              src={video.thumbnailURL} 
              alt={video.caption} 
              className="absolute inset-0 w-full h-full object-cover opacity-20 filter blur-md"
            />
          )}
          <div className="relative z-10 max-w-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Couldn't load this video.</h3>
            <p className="text-xs text-white/60 mb-6">
              {video.videoURL?.startsWith('blob:') 
                ? 'This video was saved locally before cloud storage was configured. Please re-upload with Cloudinary connected.'
                : 'Please check your connection or try refreshing the stream.'}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
              >
                <RotateCcw size={14} /> Retry
              </button>
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-4 py-2 bg-white text-black hover:bg-white/90 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
                >
                  <ArrowLeft size={14} /> Go Back
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Big Play/Pause Overlay Button in Center */}
      <AnimatePresence>
        {(!isPlaying || !showControls) && !isLoading && !hasError && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-2xl hover:scale-105 transition-transform z-15"
          >
            {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Top Controls Overlay */}
      <AnimatePresence>
        {(showControls || !isPlaying) && !hasError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between z-20"
          >
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 rounded-full bg-black/40 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                  title="Go Back"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <h2 className="text-sm font-medium text-white/90 truncate max-w-md">
                {video.title || video.caption}
              </h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Control Bar */}
      <AnimatePresence>
        {(showControls || !isPlaying) && !hasError && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-2 z-20"
          >
            {/* Scrubbable Progress Bar */}
            <div className="relative group/bar flex items-center h-3 cursor-pointer">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 z-30 cursor-pointer"
              />
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden group-hover/bar:h-2 transition-all">
                <div 
                  className="h-full bg-aeirmist-cyan rounded-full relative"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between text-white/90 text-xs font-sans">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Play / Pause */}
                <button 
                  onClick={togglePlay}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>

                {/* Volume & Slider */}
                <div className="flex items-center gap-2 group/vol">
                  <button onClick={toggleMute} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 accent-aeirmist-cyan cursor-pointer hidden sm:block opacity-70 group-hover/vol:opacity-100 transition-opacity"
                  />
                </div>

                {/* Time Display */}
                <div className="text-white/80 font-mono text-[11px] tracking-wider">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </div>
              </div>

              <div className="flex items-center gap-2 relative">
                {/* Theater Mode */}
                {onToggleTheaterMode && (
                  <button
                    onClick={onToggleTheaterMode}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden md:block ${
                      isTheaterMode ? 'text-aeirmist-cyan' : 'text-white/80'
                    }`}
                    title={isTheaterMode ? "Exit Theater Mode" : "Theater Mode"}
                  >
                    <Tv size={18} />
                  </button>
                )}

                {/* Settings Menu Toggle */}
                <button
                  onClick={() => {
                    setShowSettingsMenu(!showSettingsMenu);
                    setSettingsTab('main');
                  }}
                  className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                    showSettingsMenu ? 'text-aeirmist-cyan bg-white/10' : 'text-white/80'
                  }`}
                  title="Settings"
                >
                  <Settings size={18} />
                </button>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                  title="Fullscreen"
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>

                {/* Settings Popover */}
                <AnimatePresence>
                  {showSettingsMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute bottom-10 right-0 w-48 bg-[#121216] border border-white/10 rounded-xl p-2 shadow-2xl z-50 text-xs font-sans text-white/90"
                    >
                      {settingsTab === 'main' && (
                        <div className="space-y-1">
                          <button
                            onClick={() => setSettingsTab('speed')}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                          >
                            <span>Playback Speed</span>
                            <span className="text-white/50">{playbackSpeed}x</span>
                          </button>
                          <button
                            onClick={() => setSettingsTab('quality')}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                          >
                            <span>Quality</span>
                            <span className="text-white/50">{selectedQuality}</span>
                          </button>
                        </div>
                      )}

                      {settingsTab === 'speed' && (
                        <div className="space-y-1">
                          <div className="px-3 py-1 font-semibold text-white/40 uppercase text-[10px]">Speed</div>
                          {SPEED_OPTIONS.map((speed) => (
                            <button
                              key={speed}
                              onClick={() => handleSpeedChange(speed)}
                              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                            >
                              <span>{speed === 1 ? 'Normal (1x)' : `${speed}x`}</span>
                              {playbackSpeed === speed && <Check size={14} className="text-aeirmist-cyan" />}
                            </button>
                          ))}
                        </div>
                      )}

                      {settingsTab === 'quality' && (
                        <div className="space-y-1">
                          <div className="px-3 py-1 font-semibold text-white/40 uppercase text-[10px]">Quality</div>
                          {QUALITY_OPTIONS.map((q) => (
                            <button
                              key={q}
                              onClick={() => {
                                setSelectedQuality(q);
                                setShowSettingsMenu(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                            >
                              <span>{q}</span>
                              {selectedQuality === q && <Check size={14} className="text-aeirmist-cyan" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
