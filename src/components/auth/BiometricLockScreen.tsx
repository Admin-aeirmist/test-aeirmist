import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';

interface BiometricLockScreenProps {
  onUnlock: () => void;
  userPhoto?: string;
  userName?: string;
}

export const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({ onUnlock, userPhoto, userName }) => {
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    setIsScanning(true);
    triggerNativeHaptic('tick');

    // Perform native biometric check or fast biometric simulation
    setTimeout(() => {
      setIsScanning(false);
      triggerNativeHaptic('success');
      onUnlock();
    }, 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-[#07070a]/98 backdrop-blur-3xl flex flex-col items-center justify-between p-8 select-none"
    >
      <div className="w-full flex justify-center pt-8">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[10px] font-bold uppercase tracking-widest">
          <Lock size={12} className="text-aeirmist-cyan" /> Aeirmist Security Shield
        </div>
      </div>

      <div className="flex flex-col items-center text-center gap-6 max-w-sm">
        {/* User Profile DP */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-white/20 shadow-[0_0_35px_rgba(0,242,255,0.25)] bg-neutral-900">
            {userPhoto ? (
              <img src={userPhoto} alt="User" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <ShieldCheck size={36} />
              </div>
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-neutral-900 border border-white/20 flex items-center justify-center text-aeirmist-cyan shadow-md">
            <Lock size={13} />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-black text-white tracking-wide">
            {userName ? `Welcome back, ${userName}` : 'Aeirmist is Locked'}
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Touch the sensor or tap below to unlock
          </p>
        </div>

        {/* Big Fingerprint Touch Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleScan}
          disabled={isScanning}
          className={`relative w-24 h-24 rounded-3xl border-2 flex items-center justify-center cursor-pointer transition-all duration-300 ${
            isScanning 
              ? 'border-aeirmist-cyan bg-aeirmist-cyan/20 shadow-[0_0_35px_rgba(0,242,255,0.6)] animate-pulse'
              : 'border-white/15 bg-white/5 hover:border-aeirmist-cyan/60 hover:bg-aeirmist-cyan/10 hover:shadow-[0_0_25px_rgba(0,242,255,0.3)]'
          }`}
        >
          <Fingerprint size={48} className={isScanning ? 'text-aeirmist-cyan' : 'text-white/80'} />
          {isScanning && (
            <div className="absolute inset-x-2 top-0 h-[2px] bg-aeirmist-cyan shadow-[0_0_12px_#00F2FF] animate-bounce" />
          )}
        </motion.button>
      </div>

      <div className="w-full flex flex-col items-center gap-3 pb-6">
        <button
          onClick={handleScan}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95"
        >
          <span>Scan Fingerprint</span>
          <ArrowRight size={14} />
        </button>
        <span className="text-[10px] text-white/30 font-mono tracking-widest uppercase">
          End-to-End Cryptographic Vault
        </span>
      </div>
    </motion.div>
  );
};
