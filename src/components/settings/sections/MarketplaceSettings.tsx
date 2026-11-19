import React from 'react';
import { motion } from 'motion/react';
import { 
  Zap, 
  CreditCard, 
  History, 
  Sparkles, 
  Layers, 
  Cpu, 
  ShieldCheck,
  Star,
  Package,
  ArrowRight,
  Gem,
  Settings
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { AeirmistBillingHistory } from '../../marketplace/AeirmistBillingHistory';
import { InfinityPortal } from '../../dashboard/InfinityPortal';

const MarketplaceSettings = () => {
  const { profile, addToast } = useAeirmist();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-display font-bold text-white">Digital Marketplace</h2>
        <p className="text-xs text-white/45 uppercase tracking-widest font-medium">Manage your premium artifacts, subscriptions, and billing</p>
      </div>

      {/* Subscription Status */}
      <div className="p-8 rounded-[3rem] bg-gradient-to-br from-aeirmist-magenta/10 via-transparent to-aeirmist-cyan/10 border border-white/10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <Gem size={120} className="text-aeirmist-magenta" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 rounded-[2rem] bg-aeirmist-magenta/20 border border-aeirmist-magenta/30 flex items-center justify-center text-aeirmist-magenta">
            <Gem size={32} />
          </div>
          <div className="flex-1 text-center md:text-left space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <h3 className="text-xl font-bold uppercase tracking-wider">Aeirmist Infinity</h3>
              <div className="px-2 py-0.5 rounded-full bg-aeirmist-magenta/20 border border-aeirmist-magenta/30">
                <span className="text-[8px] font-black text-aeirmist-magenta uppercase tracking-tighter">PRO</span>
              </div>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Your premium sequence is active until <span className="text-white/60 font-mono">2024.12.31</span>. Enjoy unlimited artifacts and high-fidelity sonic waves.
            </p>
          </div>
          <button 
            onClick={() => addToast({ title: 'SUBSCRIPTION PORTAL', message: 'Current plan: Aeirmist Infinity Pro (Active through 2026).', type: 'info' })}
            className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            Manage Plan <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Payment Methods */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan">
            <CreditCard size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Quantum Wallet</h3>
        </div>

        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-8 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center">
                <div className="w-6 h-4 bg-white/20 rounded-sm" />
              </div>
              <div>
                <div className="text-xs font-bold text-white/90">Mastercard •••• 4242</div>
                <div className="text-[10px] text-white/30 uppercase font-mono mt-0.5">Expires 12/26</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[8px] font-black uppercase tracking-widest text-aeirmist-cyan">Default</span>
              <button 
                onClick={() => addToast({ title: 'CARD SETTINGS', message: 'Mastercard •••• 4242 configured as primary billing method.', type: 'info' })}
                className="p-2 rounded-lg hover:bg-white/5 text-white/20 hover:text-white/60 transition-colors cursor-pointer"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          <button 
            onClick={() => {
              addToast({
                title: 'PAYMENT GATEWAY',
                message: 'Stripe wallet connector activated. Ready for tokenized card entry.',
                type: 'info'
              });
            }}
            className="w-full p-5 rounded-3xl border border-dashed border-white/10 hover:border-white/30 bg-white/[0.01] hover:bg-white/[0.03] transition-all flex items-center justify-center gap-3 group cursor-pointer active:scale-98"
          >
            <Package size={16} className="text-white/20 group-hover:text-aeirmist-cyan transition-colors" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 group-hover:text-white/50">Add Payment Source</span>
          </button>
        </div>
      </section>

      {/* Artifact Inventory */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-lime/10 flex items-center justify-center text-aeirmist-lime">
            <Sparkles size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Owned Artifacts</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ArtifactCard title="Neon Drift Theme" type="Visual" icon={<Sparkles size={14} />} />
          <ArtifactCard title="Glitch Wave Pack" type="Sonic" icon={<Zap size={14} />} />
          <ArtifactCard title="Infinity Badge" type="Identity" icon={<ShieldCheck size={14} />} />
        </div>
      </section>

      {/* Billing History */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
            <History size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Transaction Ledger</h3>
        </div>

        <AeirmistBillingHistory />
      </section>

      {/* Creator Portal */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-magenta/10 flex items-center justify-center text-aeirmist-magenta">
            <Zap size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Creator Ecosystem</h3>
        </div>

        <InfinityPortal />
      </section>
    </motion.div>
  );
};

const ArtifactCard = ({ title, type, icon }: any) => (
  <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-cyan/30 transition-all group">
    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-aeirmist-cyan transition-colors mb-4">
      {icon}
    </div>
    <div className="text-xs font-bold text-white mb-1">{title}</div>
    <div className="text-[9px] font-black uppercase tracking-widest text-white/20">{type} Artifact</div>
  </div>
);

export default MarketplaceSettings;
