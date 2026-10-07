import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Mic } from 'lucide-react';
import { aeirmistCache } from '../../services/CacheService';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';
import { logger } from '@/src/utils/logger';


interface VoicePlaybackProps {
  url: string;
  isMe: boolean;
}

export const VoicePlayback: React.FC<VoicePlaybackProps> = ({ url, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(url);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let currentUrl = url;
    let isMounted = true;

    async function loadAudio() {
      if (url.startsWith('blob:') || url.startsWith('http')) {
         const cached = await aeirmistCache.getMedia(url);
         if (cached && isMounted) {
            currentUrl = URL.createObjectURL(cached);
            setAudioUrl(currentUrl);
         } else {
            setAudioUrl(url);
         }
      }
    }
    
    loadAudio();

    return () => {
      isMounted = false;
      if (currentUrl.startsWith('blob:') && currentUrl !== url) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    };

    const handleError = (e: any) => {
      logger.error("Audio playback error:", e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // Simple static waveform representation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);
    const bars = 35;
    const barWidth = 2.5;
    const gap = 2;
    
    for (let i = 0; i < bars; i++) {
      const x = i * (barWidth + gap);
      const seed = Math.abs(Math.sin(i * 0.8)) * 0.6 + 0.2;
      const h = 4 + seed * 20;
      
      const currentProgress = (i / bars) * 100;
      const isPlayed = currentProgress < progress;
      
      if (isPlayed) {
        ctx.fillStyle = isMe ? '#FFFFFF' : '#00F2FF';
        ctx.shadowBlur = isPlaying ? 12 : 4;
        ctx.shadowColor = isMe ? 'white' : 'rgba(0, 242, 255, 0.6)';
      } else {
        ctx.fillStyle = isMe ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
        ctx.shadowBlur = 0;
      }
      
      // Rounded rects for bars
      const y = (rect.height - h) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, h, 1);
      ctx.fill();
    }
  }, [progress, isMe, isPlaying]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [playbackRate, setPlaybackRate] = useState(1);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const togglePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
        audioRef.current.playbackRate = nextRate;
    }
  };

  const seekToPosition = (clientX: number) => {
    if (!containerRef.current || !audioRef.current || !audioRef.current.duration) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = clampedX / rect.width;
    const targetTime = ratio * audioRef.current.duration;
    audioRef.current.currentTime = targetTime;
    setProgress(ratio * 100);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsScrubbing(true);
    triggerNativeHaptic('tick');
    seekToPosition(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isScrubbing) return;
    e.stopPropagation();
    seekToPosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isScrubbing) return;
    e.stopPropagation();
    setIsScrubbing(false);
    triggerNativeHaptic('selection');
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div className={`flex items-center gap-3 py-1 min-w-[200px] select-none ${isMe ? 'text-white' : 'text-aeirmist-cyan'}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <div className="relative group">
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePlay}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-aeirmist-cyan/10 hover:bg-aeirmist-cyan/20'
            }`}
        >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </motion.button>
        
        <button 
           onClick={togglePlaybackRate}
           className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-[8px] font-black hover:bg-aeirmist-cyan hover:text-aeirmist-bg transition-colors cursor-pointer"
        >
            {playbackRate}x
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div 
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative h-6 flex items-center cursor-pointer touch-none group/scrubber"
          title="Drag or tap to scrub audio"
        >
            <canvas 
                ref={canvasRef} 
                width={160} 
                height={24} 
                className="w-full h-full pointer-events-none"
            />
            {/* Dynamic Scrubbing Head Indicator */}
            <div 
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border shadow-lg transition-transform pointer-events-none ${
                isMe ? 'bg-white border-black/20' : 'bg-[#00F2FF] border-black/30 shadow-[0_0_8px_rgba(0,242,255,0.7)]'
              } ${isScrubbing ? 'scale-125 ring-2 ring-white/50' : 'scale-0 group-hover/scrubber:scale-100'}`}
              style={{ left: `${Math.min(100, Math.max(0, progress))}%` }}
            />
        </div>
        <div className="flex justify-between items-center px-0.5">
            <span className="text-[9px] font-black opacity-40 uppercase tracking-widest font-mono">
                {isPlaying || isScrubbing ? formatTime(audioRef.current?.currentTime || 0) : formatTime(duration)}
            </span>
            <div className="flex items-center gap-1 opacity-20">
                <Mic size={8} />
                <span className="text-[8px] font-black uppercase tracking-[0.2em]">Voice Message</span>
            </div>
        </div>
      </div>
    </div>
  );
};
