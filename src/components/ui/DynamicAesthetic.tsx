import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../../context/ThemeContext';

export const DynamicAesthetic: React.FC = () => {
  const { activeTheme } = useTheme();

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div 
          key={activeTheme.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {renderAtmosphere(activeTheme.atmosphere, activeTheme.primary, activeTheme.secondary)}
        </motion.div>
      </AnimatePresence>
      
      {/* Global Grain/Noise Overlay */}
      <div className="absolute inset-0 opacity-[0.25] mix-blend-overlay pointer-events-none bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:16px_16px]" />
      
      {/* Global Scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
    </div>
  );
};

function renderAtmosphere(type: string, primary: string, secondary: string) {
  switch (type) {
    case 'neural':
      return (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] opacity-20" style={{ backgroundColor: primary }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] opacity-20" style={{ backgroundColor: secondary }} />
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)]" />
          <DigitalLines color={primary} />
        </>
      );
    case 'grid':
      return (
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 opacity-20"
            style={{ 
              backgroundImage: `linear-gradient(${primary}22 1px, transparent 1px), linear-gradient(90deg, ${primary}22 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
              perspective: '1000px',
              transform: 'rotateX(60deg) translateY(-200px)',
              height: '200%'
            }}
          />
          <div className="absolute top-0 w-full h-[50dvh] bg-gradient-to-b from-black to-transparent" />
          <div className="absolute bottom-0 w-full h-[50dvh] bg-gradient-to-t from-black to-transparent" />
        </div>
      );
    case 'particles':
      return <Particles color={primary} />;
    case 'fog':
      return (
        <div className="absolute inset-0">
          <motion.div 
            animate={{ 
              x: [-100, 100, -100],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 blur-[100px]"
            style={{ backgroundImage: `radial-gradient(circle at 30% 40%, ${primary}44, transparent 50%)` }}
          />
          <motion.div 
            animate={{ 
              x: [100, -100, 100],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 blur-[100px]"
            style={{ backgroundImage: `radial-gradient(circle at 70% 60%, ${secondary}44, transparent 50%)` }}
          />
        </div>
      );
    case 'matrix':
      return <MatrixStream color={primary} />;
    case 'flare':
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-black" />
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 10, repeat: Infinity }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full blur-[200px]"
            style={{ backgroundImage: `radial-gradient(circle, ${primary}66, ${secondary}22, transparent 60%)` }}
          />
          <FloatingEmbers color={primary} />
        </div>
      );
    case 'void':
      return (
        <div className="absolute inset-0 bg-black">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${primary}33, transparent 70%)` }} />
          <div className="absolute inset-0 backdrop-blur-[100px]" />
          <Nebula color={primary} />
        </div>
      );
    case 'stars':
      return (
        <div className="absolute inset-0 bg-black">
          <Stars />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-60" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full blur-[150px] opacity-20" style={{ backgroundColor: secondary }} />
        </div>
      );
    case 'bio':
      return (
        <div className="absolute inset-0 bg-black">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${primary}11 0, ${primary}11 1px, transparent 1px, transparent 10px)` }} />
          <div className="absolute top-0 left-0 w-full h-full opacity-30 blur-[100px]" style={{ backgroundImage: `radial-gradient(circle at center, ${primary}33, transparent 70%)` }} />
          <MessageCircles color={primary} />
        </div>
      );
    case 'minimal':
      return (
        <div className="absolute inset-0 bg-black">
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(to right, ${primary} 1px, transparent 1px), linear-gradient(to bottom, ${primary} 1px, transparent 1px)`, backgroundSize: '100px 100px' }} />
        </div>
      );
    default:
      return null;
  }
}

const DigitalLines: React.FC<{ color: string }> = ({ color }) => (
  <svg className="absolute inset-0 w-full h-full opacity-20">
    <motion.path
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      d="M-50,200 Q200,50 400,200 T800,200 T1200,200"
      fill="none"
      stroke={color}
      strokeWidth="0.5"
    />
    <motion.path
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 15, repeat: Infinity, ease: "linear", delay: 2 }}
      d="M2000,500 Q1500,800 1000,500 T500,500 T-500,500"
      fill="none"
      stroke={color}
      strokeWidth="0.3"
    />
  </svg>
);

const MatrixStream: React.FC<{ color: string }> = React.memo(({ color }) => (
  <div className="absolute inset-0 flex justify-between px-12 opacity-20 pointer-events-none overflow-hidden">
    {[...Array(8)].map((_, i) => (
      <div
        key={i}
        className="text-[10px] font-mono leading-none flex flex-col items-center animate-scan-slow"
        style={{ color, animationDelay: `${i * 0.8}s` }}
      >
        {[...Array(15)].map((_, j) => (
          <span key={j} className="opacity-40">{j % 2 === 0 ? '1' : '0'}</span>
        ))}
      </div>
    ))}
  </div>
));

const Stars: React.FC = React.memo(() => {
  const starsList = React.useMemo(() => {
    return [...Array(30)].map((_, i) => ({
      id: i,
      top: `${(i * 17) % 100}%`,
      left: `${(i * 31) % 100}%`,
      duration: `${3 + (i % 4)}s`,
      delay: `${(i % 3) * 0.7}s`
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {starsList.map((star) => (
        <div
          key={star.id}
          className="absolute w-[1.5px] h-[1.5px] bg-white rounded-full animate-pulse"
          style={{
            top: star.top,
            left: star.left,
            animationDuration: star.duration,
            animationDelay: star.delay
          }}
        />
      ))}
    </div>
  );
});

const FloatingEmbers: React.FC<{ color: string }> = React.memo(({ color }) => (
  <div className="absolute inset-0 pointer-events-none">
    {[...Array(10)].map((_, i) => (
      <div
        key={i}
        className="absolute w-1 h-1 rounded-full blur-[1px] animate-float"
        style={{
          backgroundColor: color,
          bottom: `${(i * 10) % 80}%`,
          left: `${(i * 13) % 95}%`,
          animationDuration: `${5 + (i % 5)}s`,
          animationDelay: `${i * 0.5}s`
        }}
      />
    ))}
  </div>
));

const MessageCircles: React.FC<{ color: string }> = React.memo(({ color }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    {[...Array(2)].map((_, i) => (
      <div
        key={i}
        className="absolute w-[40dvh] h-[40dvh] rounded-full border border-dashed animate-pulse-glow"
        style={{ borderColor: color, opacity: 0.1, animationDelay: `${i * 1.5}s` }}
      />
    ))}
  </div>
));

const Particles: React.FC<{ color: string }> = React.memo(({ color }) => {
  const particlesList = React.useMemo(() => {
    return [...Array(15)].map((_, i) => ({
      id: i,
      top: `${(i * 23) % 90}%`,
      left: `${(i * 29) % 90}%`,
      duration: `${6 + (i % 6)}s`
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particlesList.map((p) => (
        <div
          key={p.id}
          className="absolute w-1.5 h-1.5 rounded-full blur-[1px] animate-pulse"
          style={{ 
            backgroundColor: color,
            top: p.top,
            left: p.left,
            animationDuration: p.duration
          }}
        />
      ))}
    </div>
  );
});

const Nebula: React.FC<{ color: string }> = React.memo(({ color }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <div 
      className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] opacity-20 blur-[80px] animate-spin-slow"
      style={{ backgroundImage: `conic-gradient(from 0deg, transparent, ${color}33, transparent, ${color}22, transparent)` }}
    />
  </div>
));
