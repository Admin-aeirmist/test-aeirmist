import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  MessageSquare, 
  Share2, 
  Bookmark, 
  MoreHorizontal, 
  Sparkles,
  Shield,
  Activity,
  Orbit,
  Database
} from 'lucide-react';
import { PostMenu } from './PostMenu';
import { getAvatarUrl } from '../lib/avatar';

interface HoloCardProps {
  post: {
    id: string;
    authorName: string;
    authorPhoto: string;
    content: string;
    mediaURL?: string;
    aeirmistCount: number;
    timestamp: string;
  };
}

export const HoloCard: React.FC<HoloCardProps> = React.memo(({ post }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);

  const handleMessage = () => {
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 800);
  };

  return (
    <div className="relative mb-16 group">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", damping: 25 }}
        className="glass-card relative flex flex-col"
      >
        {/* Author Header - Minimal */}
        <div className="p-6 flex items-center justify-between relative">
          {/* Top Edge Glow */}
          <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-aeirmist-magenta/40 to-transparent opacity-50" />
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-1.5 bg-gradient-to-tr from-aeirmist-cyan to-aeirmist-magenta rounded-full opacity-30 blur-md group-hover:opacity-100 transition-opacity duration-1000 animate-pulse" />
              <img 
                src={getAvatarUrl(post.authorPhoto, post.authorName)} 
                alt={post.authorName} 
                className="w-12 h-12 rounded-2xl border-2 border-white/20 relative z-10 object-cover shadow-[0_0_15px_rgba(0,0,0,0.5)]" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-aeirmist-bg border border-white/20 flex items-center justify-center z-20">
                <div className="w-1.5 h-1.5 rounded-full bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,1)]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{post.authorName}</span>
                <span className="px-2 py-0.5 rounded-[6px] bg-aeirmist-cyan/10 border border-aeirmist-cyan shadow-[0_0_10px_rgba(0,242,255,0.2)] text-[8px] font-black uppercase tracking-widest text-aeirmist-cyan">PRIME</span>
              </div>
              <div className="text-[10px] text-white/30 uppercase font-black tracking-[0.25em] mt-1 flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1,2,3].map(i => <div key={i} className="w-1 h-3 rounded-full bg-aeirmist-magenta/40" />)}
                </div>
                SYNC: 98%
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/20 hover:text-white transition-colors"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        {/* Media Content - Clean Edge-to-Edge */}
        <div className="relative aspect-[4/5] md:aspect-video mx-4 overflow-hidden rounded-[2rem]">
          {post.mediaURL ? (
            <img 
              src={post.mediaURL} 
              alt="Artifact" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center">
              <Activity className="text-white/5 w-24 h-24" />
            </div>
          )}
          
          {/* Subtle Dynamic Light */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          
          {/* Floating Interaction Dock - Minimal Glass */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 p-2 glass-panel rounded-full flex items-center gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] border-white/10">
            <InteractionButton 
              icon={<Zap size={20} />} 
              label="Message" 
              count={post.aeirmistCount} 
              color="aeirmist-magenta" 
              isActive={isPulsing}
              onClick={handleMessage}
            />
            <div className="w-px h-6 bg-white/10" />
            <InteractionButton 
              icon={<MessageSquare size={20} />} 
              label="Reply" 
              count={12} 
              color="aeirmist-cyan" 
            />
            <InteractionButton 
              icon={<Orbit size={20} />} 
              label="Send" 
              count={null} 
              color="aeirmist-lime" 
            />
            <InteractionButton 
              icon={<Database size={20} />} 
              label="Vault" 
              count={null} 
              color="white" 
            />
          </div>
        </div>

        {/* Caption Section - Minimalist */}
        <div className="p-8">
          <p className="text-white/80 text-sm leading-relaxed tracking-wide font-light">
            <span className="font-black text-white mr-3 uppercase text-[11px] tracking-widest">{post.authorName.split(' ')[0]}</span>
            {post.content}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-4">
              <span className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-black">{post.timestamp}</span>
              <span className="text-[10px] text-aeirmist-cyan/40 uppercase tracking-[0.2em] font-black flex items-center gap-1">
                <Sparkles size={10} /> Optimized
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-aeirmist-magenta animate-pulse" />
              <span className="text-[9px] text-white/40 uppercase tracking-widest font-black">Live Message</span>
            </div>
          </div>
        </div>
      </motion.div>

      <PostMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  );
});

const InteractionButton = React.memo(({ icon, label, count, color, isActive, onClick }: any) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    onClick={onClick}
    className="flex flex-col items-center gap-1 group relative py-2 px-3 rounded-2xl hover:bg-white/5 transition-colors"
  >
    <div className={`
      relative transition-colors duration-300
      ${isActive ? `text-${color}` : 'text-white/40 group-hover:text-white'}
    `}>
      {isActive && (
        <motion.div 
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 2.5, opacity: 0 }}
          className={`absolute inset-0 bg-${color}/40 rounded-full blur-md`}
        />
      )}
      {icon}
    </div>
    {count !== null && (
      <span className="text-[10px] font-bold text-white/30 group-hover:text-white/60 tracking-tighter">
        {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
      </span>
    )}
    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black border border-white/10 text-[8px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
      {label}
    </span>
  </motion.button>
));
