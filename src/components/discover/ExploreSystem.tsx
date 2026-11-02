import React from 'react';
import { motion } from 'motion/react';
import { Link2 } from 'lucide-react';

interface ExploreSystemProps {
  onUserClick?: (userId: string) => void;
  onPostClick?: (postId: string) => void;
  initialStoreId?: string | null;
  initialProductId?: string | null;
  onStoreChange?: (storeId: string | null) => void;
  onProductChange?: (productId: string | null) => void;
}

export const ExploreSystem: React.FC<ExploreSystemProps> = () => {
  return (
    <div className="w-full h-full min-h-[85vh] flex flex-col items-center justify-center p-6 text-center select-none bg-aeirmist-bg">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="max-w-md w-full flex flex-col items-center justify-center p-12 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-2xl shadow-2xl relative overflow-hidden"
      >
        {/* Subtle ambient glows */}
        <div className="absolute -top-24 -left-24 w-52 h-52 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-52 h-52 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/15 to-purple-500/10 border border-cyan-500/30 flex items-center justify-center mb-6 text-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.2)]">
          <Link2 size={36} strokeWidth={2.2} />
        </div>

        <h1 className="text-3xl font-black tracking-widest text-white mb-2 uppercase font-sans">
          Bonds
        </h1>
        <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mb-4" />
        <p className="text-xs text-white/40 tracking-wider font-mono">
          Ready for module integration.
        </p>
      </motion.div>
    </div>
  );
};

export default ExploreSystem;
