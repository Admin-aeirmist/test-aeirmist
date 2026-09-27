import React from 'react';
import { X, Sparkles, Zap, RotateCcw } from 'lucide-react';

interface CameraTopBarProps {
  onClose: () => void;
  formatTime: (s: number) => string;
  recordingTime: number;
  isRecording: boolean;
  isHD: boolean;
  setIsHD: (b: boolean) => void;
}

export const CameraTopBar: React.FC<CameraTopBarProps> = ({ onClose, formatTime, recordingTime, isRecording, isHD, setIsHD }) => (
  <header className="absolute top-0 inset-x-0 z-[1050] flex justify-between items-center px-4 pt-[calc(0.75rem+var(--spacing-safe-top,0px))] pb-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
    <button 
      onClick={onClose} 
      className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/90 hover:text-white hover:bg-black/60 transition-all active:scale-95"
    >
      <X size={20} />
    </button>
    
    <div className="flex items-center gap-2">
      {isRecording ? (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 backdrop-blur-md animate-pulse">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[12px] font-mono font-bold tracking-wider text-red-400">
            {formatTime(recordingTime)}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
          <button 
            onClick={() => setIsHD(!isHD)} 
            className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isHD ? 'bg-aeirmist-cyan/20 text-aeirmist-cyan font-bold' : 'text-white/40'}`}
          >
            HD
          </button>
          <span className="text-[9px] font-bold text-white/40 font-mono">60FPS</span>
          <span className="text-[9px] font-bold text-yellow-400/80 bg-yellow-400/10 px-1 py-0.5 rounded">HDR</span>
        </div>
      )}
    </div>

    <div className="flex items-center gap-2">
      <button 
        onClick={() => setIsHD(!isHD)} 
        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95"
        title="Flash / Lighting"
      >
        <Zap size={18} className={isHD ? "text-yellow-400 fill-yellow-400/20" : "text-white/60"} />
      </button>
    </div>
  </header>
);
