import React from 'react';
import { motion } from 'motion/react';
import { 
  Link as LinkIcon, 
  Instagram, 
  Twitter, 
  Github, 
  Globe, 
  MessageSquare, 
  Youtube, 
  Facebook,
  Shield,
  Zap,
  ExternalLink,
  Plus
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { logger } from '@/src/utils/logger';


const ConnectedAccountsSettings = () => {
  const { profile, updateProfile, addToast } = useAeirmist();

  const handleSocialChange = async (key: string, value: string) => {
    try {
      const newLinks = {
        ...(profile?.socialLinks || {}),
        [key]: value
      };
      await updateProfile({ socialLinks: newLinks });
    } catch (e) {
      logger.error("Failed to update social bridge", e);
    }
  };

  const socialBridges = [
    { id: 'instagram', label: 'Instagram', icon: <Instagram size={18} />, color: 'hover:text-aeirmist-magenta' },
    { id: 'twitter', label: 'X (Twitter)', icon: <Twitter size={18} />, color: 'hover:text-white' },
    { id: 'github', label: 'GitHub', icon: <Github size={18} />, color: 'hover:text-aeirmist-cyan' },
    { id: 'discord', label: 'Discord', icon: <MessageSquare size={18} />, color: 'hover:text-indigo-400' },
    { id: 'youtube', label: 'YouTube', icon: <Youtube size={18} />, color: 'hover:text-red-500' },
    { id: 'facebook', label: 'Facebook', icon: <Facebook size={18} />, color: 'hover:text-blue-500' },
    { id: 'website', label: 'Personal Hub', icon: <Globe size={18} />, color: 'hover:text-aeirmist-lime' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-display font-bold text-white">External Bridges</h2>
        <p className="text-xs text-white/45 uppercase tracking-widest font-medium">Synchronize your identity across legacy protocols</p>
      </div>

      {/* Connection Security */}
      <div className="p-6 rounded-[2.5rem] bg-aeirmist-cyan/5 border border-aeirmist-cyan/20 flex items-center gap-6">
        <div className="w-12 h-12 rounded-2xl bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan">
          <Shield size={24} />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Encrypted Handshake</h3>
          <p className="text-[10px] text-white/40 leading-relaxed mt-0.5">
            Legacy social bridges use encrypted OAuth tunnels to verify ownership without exposing raw credentials.
          </p>
        </div>
      </div>

      {/* Social Bridges Grid */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
            <LinkIcon size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Active Bridges</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {socialBridges.map((bridge) => (
            <div key={bridge.id} className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 group">
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-3 transition-colors ${bridge.color}`}>
                  {bridge.icon}
                  <span className="text-[11px] font-bold uppercase tracking-wider">{bridge.label}</span>
                </div>
                {profile?.socialLinks?.[bridge.id] ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/25">
                    <div className="w-1 h-1 rounded-full bg-aeirmist-cyan" />
                    <span className="text-[8px] font-bold text-aeirmist-cyan uppercase tracking-tighter">Active</span>
                  </div>
                ) : (
                  <span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Inactive</span>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={profile?.socialLinks?.[bridge.id] || ''}
                  onChange={(e) => handleSocialChange(bridge.id, e.target.value)}
                  placeholder={`Enter ${bridge.label} handle or URL`}
                  className="w-full h-11 pl-4 pr-10 bg-white/[0.03] border border-white/10 rounded-xl text-xs font-mono text-white placeholder:text-white/10 focus:border-white/30 outline-none transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/10 group-hover:text-white/30 transition-colors">
                  <ExternalLink size={14} />
                </div>
              </div>
            </div>
          ))}

          {/* Custom Bridge */}
          <button 
            onClick={() => {
              const bridgeName = window.prompt("Enter custom bridge name (e.g., Telegram, Mastodon, Threads):");
              if (!bridgeName?.trim()) return;
              const bridgeUrl = window.prompt(`Enter URL or username for ${bridgeName.trim()}:`);
              if (!bridgeUrl?.trim()) return;
              handleSocialChange(bridgeName.trim().toLowerCase(), bridgeUrl.trim());
              addToast?.({
                type: 'success',
                message: `Added custom bridge: ${bridgeName.trim()}`
              });
            }}
            className="p-5 rounded-3xl border border-dashed border-white/10 hover:border-white/30 bg-white/[0.01] hover:bg-white/[0.03] transition-all flex flex-col items-center justify-center gap-3 group cursor-pointer active:scale-98"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/30 group-hover:text-white/60 transition-colors">
              <Plus size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 group-hover:text-white/50">Add Custom Bridge</span>
          </button>
        </div>
      </section>

      {/* Identity Verification */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-lime/10 flex items-center justify-center text-aeirmist-lime">
            <Zap size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Cross-Chain Verification</h3>
        </div>

        <div className="p-8 rounded-[3rem] bg-white/[0.02] border border-white/10 space-y-4">
          <p className="text-[11px] text-white/40 leading-relaxed">
            Verify your identity across multiple decentralized networks to earn the <span className="text-aeirmist-cyan font-bold">Omni-Node</span> status. This enhances your trust score and visibility across the network.
          </p>
          <button 
            onClick={() => {
              addToast?.({
                type: 'info',
                message: 'Cross-chain verification sequence initiated. Checking node health...'
              });
              setTimeout(() => {
                addToast?.({
                  type: 'success',
                  message: 'Omni-Node status verified: All active bridges are synchronized.'
                });
              }, 1200);
            }}
            className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all cursor-pointer active:scale-95"
          >
            Begin Verification Sequence
          </button>
        </div>
      </section>
    </motion.div>
  );
};

export default ConnectedAccountsSettings;
