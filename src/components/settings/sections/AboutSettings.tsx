import React from 'react';
import { motion } from 'motion/react';
import { 
  Info, 
  Shield, 
  Github, 
  Twitter, 
  Globe, 
  Heart, 
  Code2, 
  Fingerprint, 
  Server,
  Zap,
  Layers
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';

const AboutSettings = () => {
  const { addToast } = useAeirmist();
  const version = "2.8.4";
  const build = "Production";

  const [activeLegalModal, setActiveLegalModal] = React.useState<string | null>(null);

  const handleSocialClick = (platform: string, url: string) => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      addToast({ title: platform, message: `Opening ${platform}`, type: 'info' });
    }
  };

  const legalContent: Record<string, { title: string; content: string }> = {
    'Terms of Service': {
      title: 'Terms of Service',
      content: 'By accessing or using Aeirmist, you agree to be bound by our platform terms. Aeirmist provides digital social networking, encrypted private vault messaging, real-time audio/video links, and media broadcasting. Users retain ownership of their content while granting Aeirmist the necessary technical license to deliver and format media across devices.'
    },
    'Privacy Policy': {
      title: 'Privacy Policy',
      content: 'Your privacy is paramount at Aeirmist. All personal data, private vault items, and direct communications are strictly protected. We never sell personal data to advertisers. Client-side encryption ensures confidential notes and private vaults remain inaccessible without your authentic PIN or device biometric key.'
    },
    'Cookie Policy': {
      title: 'Cookie & Storage Policy',
      content: 'Aeirmist utilizes secure session tokens, localStorage caching, and IndexedDB to deliver instant zero-latency page transitions and offline message queuing. No third-party behavioral tracking cookies are used.'
    },
    'Content Licensing': {
      title: 'Content & Media Guidelines',
      content: 'Creators retain full intellectual property rights to their videos, posts, and digital creations. Commercial exploitation, harassment, unauthorized re-uploads, and malicious media are strictly prohibited under Aeirmist Community Guidelines.'
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-display font-bold text-white">About System</h2>
        <p className="text-xs text-white/45 uppercase tracking-widest font-medium">Platform architecture, vision, and legal frameworks</p>
      </div>

      {/* Hero Brand Section */}
      <div className="flex flex-col items-center justify-center p-12 rounded-[3rem] bg-white/[0.02] border border-white/10 text-center space-y-6 relative overflow-hidden">
        <div className="w-24 h-24 rounded-[2.5rem] bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl relative z-10">
          <Zap size={48} className="text-aeirmist-cyan" />
        </div>
        <div className="space-y-2 relative z-10">
          <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter">Aeirmist</h1>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.5em]">Global Social & Workspace Ecosystem</p>
        </div>
      </div>

      {/* Version Info */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <Layers size={18} className="text-aeirmist-cyan" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">App Version</span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-mono font-bold text-white">{version}</span>
            <span className="text-[9px] font-mono text-white/20 uppercase">{build}</span>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <Server size={18} className="text-aeirmist-magenta" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Server Status</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-aeirmist-lime animate-pulse" />
            <span className="text-lg font-mono font-bold text-aeirmist-lime uppercase tracking-widest">Operational</span>
          </div>
        </div>
      </section>

      {/* Legal & Compliance */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
            <Shield size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Legal & Policies</h3>
        </div>

        <div className="space-y-3">
          <LegalLink onClick={() => setActiveLegalModal('Terms of Service')} title="Terms of Service" desc="Rights and responsibilities for platform users" />
          <LegalLink onClick={() => setActiveLegalModal('Privacy Policy')} title="Privacy Policy" desc="How we protect and handle your personal data" />
          <LegalLink onClick={() => setActiveLegalModal('Cookie Policy')} title="Cookie Policy" desc="Local storage and session caching details" />
          <LegalLink onClick={() => setActiveLegalModal('Content Licensing')} title="Content Licensing" desc="Intellectual property and digital asset guidelines" />
        </div>
      </section>

      {/* Credits & Mission */}
      <section className="space-y-8">
        <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 space-y-6">
          <div className="flex items-center gap-3">
            <Heart size={20} className="text-aeirmist-magenta" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Our Vision</h3>
          </div>
          <p className="text-xs text-white/50 leading-relaxed max-w-2xl italic">
            "Aeirmist was designed to bring people together through elegant communication, seamless media sharing, and modern workspace tools built with privacy and simplicity at the core."
          </p>
          <div className="flex items-center gap-4 pt-4">
            <div onClick={() => handleSocialClick('GitHub', 'https://github.com/aeirmist')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/65 hover:text-aeirmist-cyan transition-colors cursor-pointer active:scale-95"><Github size={18} /></div>
            <div onClick={() => handleSocialClick('Twitter / X', 'https://x.com/aeirmist')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/65 hover:text-white transition-colors cursor-pointer active:scale-95"><Twitter size={18} /></div>
            <div onClick={() => handleSocialClick('Website', 'https://aeirmist.com')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/65 hover:text-aeirmist-lime transition-colors cursor-pointer active:scale-95"><Globe size={18} /></div>
          </div>
        </div>
      </section>

      {/* Policy Modal */}
      {activeLegalModal && legalContent[activeLegalModal] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-[#18191a] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield size={18} className="text-aeirmist-cyan" />
                {legalContent[activeLegalModal].title}
              </h3>
              <button 
                onClick={() => setActiveLegalModal(null)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-white/70 leading-relaxed max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 pr-1">
              {legalContent[activeLegalModal].content}
            </p>
            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setActiveLegalModal(null)}
                className="px-5 py-2 rounded-xl bg-aeirmist-cyan text-black text-xs font-bold hover:bg-aeirmist-cyan/90 transition-all cursor-pointer"
              >
                Understood
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="text-center pt-8">
        <p className="text-[10px] text-white/10 uppercase tracking-[0.5em] font-bold">Aeirmist Global • 2026</p>
      </div>
    </motion.div>
  );
};

const LegalLink = ({ title, desc, onClick }: any) => (
  <button 
    onClick={onClick}
    className="w-full p-5 rounded-2xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 flex items-center justify-between transition-all group text-left cursor-pointer active:scale-[0.99]"
  >
    <div>
      <div className="text-xs font-bold text-white group-hover:text-aeirmist-cyan transition-colors">{title}</div>
      <div className="text-[10px] text-white/30 mt-0.5">{desc}</div>
    </div>
    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 group-hover:text-white/60 transition-all">
      <Info size={14} />
    </div>
  </button>
);

export default AboutSettings;
