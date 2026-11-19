import React from 'react';
import { motion } from 'motion/react';
import { 
  Phone, 
  Video, 
  Shield, 
  Mic, 
  Volume2, 
  UserX, 
  Clock,
  Settings2,
  Lock,
  Globe
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';

const CallsSettings = () => {
  const { addToast } = useAeirmist();
  
  const [callFilter, setCallFilter] = React.useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('aeirmist_call_filter')) || 'My Links';
  });

  const [p2pEnabled, setP2pEnabled] = React.useState<boolean>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('aeirmist_p2p_enabled') !== 'false' : true;
  });

  const [audioFidelity, setAudioFidelity] = React.useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('aeirmist_audio_fidelity')) || 'High Definition (Lossless)';
  });

  const [videoResolution, setVideoResolution] = React.useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('aeirmist_video_res')) || '1080p (Full HD)';
  });

  const handleFilterChange = (option: string) => {
    setCallFilter(option);
    try {
      localStorage.setItem('aeirmist_call_filter', option);
      addToast({
        title: 'Filter Configured',
        message: `Call transmission filter set to: ${option}`,
        type: 'info'
      });
    } catch {}
  };

  const handleToggleP2P = () => {
    const next = !p2pEnabled;
    setP2pEnabled(next);
    try {
      localStorage.setItem('aeirmist_p2p_enabled', String(next));
      addToast({
        title: 'P2P Precision',
        message: next ? 'Peer-to-Peer direct transmission enabled.' : 'Relayed TURN proxy routing enabled.',
        type: 'info'
      });
    } catch {}
  };

  const handleClearCallHistory = () => {
    try {
      localStorage.removeItem('aeirmist_call_logs');
      localStorage.removeItem('aeirmist_recent_calls');
      window.dispatchEvent(new CustomEvent('aeirmist_calls_cleared'));
      addToast({
        title: 'Registry Cleared',
        message: 'All call history and transmission records deleted.',
        type: 'success'
      });
    } catch {
      addToast({ title: 'Error', message: 'Could not clear registry.', type: 'warning' });
    }
  };

  const handleBlockedCommunicators = () => {
    window.dispatchEvent(new CustomEvent('aeirmist_open_blocked_users'));
    addToast({
      title: 'Blocked Communicators',
      message: 'Managing blocked users list.',
      type: 'info'
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-display font-bold text-white">Sonic Transmission</h2>
        <p className="text-xs text-white/45 uppercase tracking-widest font-medium">Calibrate audio and video communication parameters</p>
      </div>

      {/* Privacy & Security */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan">
            <Lock size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Transmission Privacy</h3>
        </div>

        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/90">Incoming Call Filtering</h4>
              <p className="text-[10px] text-white/40 mt-1">Select who can initiate a sonic link with you</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['Everyone', 'My Links', 'Nobody'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleFilterChange(option)}
                  className={`py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                    callFilter === option
                      ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)]'
                      : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10 hover:text-white/70'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <CallToggle 
            icon={<Globe size={18} />}
            title="Peer-to-Peer Precision"
            desc="Use direct P2P connections for reduced latency (Exposes IP to trusted nodes)"
            enabled={p2pEnabled}
            onToggle={handleToggleP2P}
          />
        </div>
      </section>

      {/* Audio & Video Quality */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-magenta/10 flex items-center justify-center text-aeirmist-magenta">
            <Settings2 size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Vector Quality</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Volume2 size={16} className="text-aeirmist-cyan" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-white">Audio Fidelity</h4>
            </div>
            <select 
              value={audioFidelity}
              onChange={(e) => {
                setAudioFidelity(e.target.value);
                try {
                  localStorage.setItem('aeirmist_audio_fidelity', e.target.value);
                  addToast({ title: 'Audio Fidelity Set', message: e.target.value, type: 'info' });
                } catch {}
              }}
              className="w-full h-11 px-4 bg-[#12151f] border border-white/10 rounded-xl text-xs font-mono text-white/80 outline-none cursor-pointer hover:border-white/20 transition-colors"
            >
              <option value="Standard (VBR)">Standard (VBR)</option>
              <option value="High Definition (Lossless)">High Definition (Lossless)</option>
              <option value="Low Data Mode">Low Data Mode</option>
            </select>
          </div>

          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Video size={16} className="text-aeirmist-magenta" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-white">Video Resolution</h4>
            </div>
            <select 
              value={videoResolution}
              onChange={(e) => {
                setVideoResolution(e.target.value);
                try {
                  localStorage.setItem('aeirmist_video_res', e.target.value);
                  addToast({ title: 'Video Resolution Set', message: e.target.value, type: 'info' });
                } catch {}
              }}
              className="w-full h-11 px-4 bg-[#12151f] border border-white/10 rounded-xl text-xs font-mono text-white/80 outline-none cursor-pointer hover:border-white/20 transition-colors"
            >
              <option value="720p (HD)">720p (HD)</option>
              <option value="1080p (Full HD)">1080p (Full HD)</option>
              <option value="480p (Standard)">480p (Standard)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Call History & Blocked */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
            <Clock size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Registry & Restrictions</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            type="button"
            onClick={handleClearCallHistory}
            className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-rose-500/30 hover:bg-white/[0.04] transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-rose-400 group-hover:bg-rose-500/10 transition-colors">
                <Clock size={18} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white group-hover:text-rose-300 transition-colors">Clear Call History</span>
            </div>
          </button>

          <button 
            type="button"
            onClick={handleBlockedCommunicators}
            className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-cyan/30 hover:bg-white/[0.04] transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-aeirmist-cyan group-hover:bg-aeirmist-cyan/10 transition-colors">
                <UserX size={18} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white group-hover:text-aeirmist-cyan transition-colors">Blocked Communicators</span>
            </div>
          </button>
        </div>
      </section>
    </motion.div>
  );
};

const CallToggle = ({ icon, title, desc, enabled, onToggle }: any) => (
  <button 
    type="button"
    onClick={onToggle}
    className="w-full p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between text-left group cursor-pointer"
  >
    <div className="flex items-center gap-5">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
        enabled ? 'bg-aeirmist-cyan/10 text-aeirmist-cyan' : 'bg-white/5 text-white/40 group-hover:text-white/60'
      }`}>
        {icon}
      </div>
      <div>
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-white">{title}</h4>
        <p className="text-[10px] text-white/30 mt-0.5">{desc}</p>
      </div>
    </div>
    <div className={`w-12 h-6 rounded-full relative transition-all border ${
      enabled ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan/30' : 'bg-white/5 border-white/10'
    }`}>
      <div className={`absolute top-1 transition-all w-4 h-4 rounded-full ${
        enabled ? 'right-1 bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,0.6)]' : 'left-1 bg-white/20'
      }`} />
    </div>
  </button>
);

export default CallsSettings;
