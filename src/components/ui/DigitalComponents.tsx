import React from 'react';
import { motion } from 'motion/react';

export const LiquidBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.18]">
    <motion.div 
      animate={{ 
        scale: [1, 1.2, 1],
        borderRadius: ["30%", "50%", "30%"],
        rotate: [0, 180, 0],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-[-10%] right-[-10%] w-[50dvw] h-[50dvw] bg-aeirmist-cyan/30 blur-[150px] mix-blend-screen"
    />
    <motion.div 
      animate={{ 
        scale: [1.2, 1, 1.2],
        borderRadius: ["50%", "30%", "50%"],
        rotate: [0, -180, 0],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      className="absolute bottom-[-10%] left-[-10%] w-[60dvw] h-[60dvw] bg-aeirmist-magenta/30 blur-[170px] mix-blend-screen"
    />
    <motion.div 
      animate={{ 
        scale: [1, 1.5, 1],
        borderRadius: ["40%", "60%", "40%"],
        rotate: [0, 90, 0],
      }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-[30%] left-[20%] w-[40dvw] h-[40dvw] bg-indigo-500/20 blur-[150px] mix-blend-screen"
    />
    
    {/* Subtle Glass Noise Overlay */}
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-overlay" />
  </div>
);

export const DigitalGlow = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
    <motion.div 
      animate={{ 
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.5, 0.3],
        x: [0, 50, 0],
        y: [0, -30, 0]
      }}
      transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-aeirmist-cyan/10 rounded-full blur-[120px]" 
    />
    <motion.div 
      animate={{ 
        scale: [1.2, 1, 1.2],
        opacity: [0.2, 0.4, 0.2],
        x: [0, -40, 0],
        y: [0, 60, 0]
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-aeirmist-magenta/10 rounded-full blur-[120px]" 
    />
  </div>
);

export const CyberBadge = ({ label, value, icon: Icon, color = 'cyan' }: any) => {
  const colors = {
    cyan: 'text-aeirmist-cyan border-aeirmist-cyan/30 bg-aeirmist-cyan/5',
    magenta: 'text-aeirmist-magenta border-aeirmist-magenta/30 bg-aeirmist-magenta/5',
    lime: 'text-aeirmist-lime border-aeirmist-lime/30 bg-aeirmist-lime/5',
  };
  const activeColor = colors[color as keyof typeof colors] || colors.cyan;

  return (
    <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 backdrop-blur-md ${activeColor}`}>
      {Icon && <Icon size={12} className="opacity-70" />}
      <div className="flex flex-col">
        <span className="text-[7px] uppercase font-black tracking-[0.2em] opacity-50 leading-none">{label}</span>
        <span className="text-[10px] font-bold tracking-tight uppercase">{value}</span>
      </div>
    </div>
  );
};

export const DigitalModule = ({ title, children, icon: Icon, status }: any) => (
  <motion.div 
    whileHover={{ scale: 1.01 }}
    className="group relative"
  >
    <div className="absolute -inset-0.5 bg-gradient-to-r from-aeirmist-cyan/0 via-aeirmist-cyan/20 to-aeirmist-magenta/0 rounded-3xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
    <div className="relative p-5 glass-panel border-white/5 bg-black/40 rounded-3xl overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 group-hover:text-aeirmist-cyan transition-colors">
            {Icon && <Icon size={18} />}
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">{title}</h3>
            {status && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <div className="w-1 h-1 rounded-full bg-aeirmist-cyan animate-pulse shadow-[0_0_5px_rgba(0,204,255,1)]" />
                <span className="text-[8px] font-bold text-aeirmist-cyan/60 uppercase">{status}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  </motion.div>
);

export const HolographicAvatar = ({ src, size = 160, glowColor = 'cyan' }: { src: string, size?: number, glowColor?: 'cyan' | 'magenta' | 'lime' }) => {
  const glow = {
    cyan: 'rgba(0, 242, 255, 0.4)',
    magenta: 'rgba(255, 0, 234, 0.4)',
    lime: 'rgba(50, 255, 126, 0.4)'
  };
  const activeGlow = glow[glowColor] || glow.cyan;

  return (
    <div className="relative group p-4" style={{ width: size + 32, height: size + 32 }}>
       {/* Background Pulsing Rings */}
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute inset-0 rounded-2xl border border-white/5"
      />
      <motion.div 
        animate={{ scale: [1.1, 1.2, 1.1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
        className="absolute inset -4 rounded-2xl border border-white/5"
      />

      <div className="relative w-full h-full">
         {/* Animated Border */}
         <div className="absolute inset-0 rounded-2xl p-2 bg-gradient-to-br from-aeirmist-cyan via-aeirmist-magenta to-aeirmist-cyan animate-spin-slow opacity-20 group-hover:opacity-60 transition-opacity" />
         
         {/* Glow Layer */}
         <div className="absolute inset-2 rounded-2xl blur-[20px] transition-all duration-500 group-hover:blur-[30px]" style={{ backgroundColor: activeGlow }} />

         {/* Main Image Container */}
         <div className="absolute inset-2 rounded-2xl overflow-hidden border-2 border-white/20 bg-aeirmist-bg z-10">
            <img 
              src={src} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" 
              style={{ imageRendering: 'auto' }}
              loading="eager"
              decoding="async"
              alt="avatar" 
            />
         </div>
      </div>
    </div>
  );
};
