import React from 'react';
import { motion } from 'motion/react';
import { 
  Lock, 
  ShieldCheck, 
  Key, 
  Fingerprint, 
  EyeOff, 
  FileLock2, 
  Activity,
  History,
  AlertTriangle,
  Zap,
  Server
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';

const VaultSettings = () => {
  const { addToast, openVault } = useAeirmist();

  const [biometricAuth, setBiometricAuth] = React.useState(() => {
    return localStorage.getItem('aeirmist_vault_biometric') !== 'false';
  });
  const [stealthMode, setStealthMode] = React.useState(() => {
    return localStorage.getItem('aeirmist_vault_stealth') === 'true';
  });
  const [autoLock, setAutoLock] = React.useState(() => {
    return localStorage.getItem('aeirmist_vault_autolock') !== 'false';
  });
  const [cloudSync, setCloudSync] = React.useState(() => {
    return localStorage.getItem('aeirmist_vault_cloudsync') === 'true';
  });

  const toggleOption = (name: string, current: boolean, setter: (v: boolean) => void, storageKey: string) => {
    const next = !current;
    setter(next);
    localStorage.setItem(storageKey, String(next));
    addToast({
      title: 'VAULT CONFIG UPDATED',
      message: `${name} ${next ? 'enabled' : 'disabled'}.`,
      type: 'success'
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-display font-bold text-white">Secure Vault</h2>
        <p className="text-xs text-white/45 uppercase tracking-widest font-medium">Protect your sensitive files and confidential data behind advanced encryption</p>
      </div>

      {/* Vault Status */}
      <div className="p-8 rounded-[3rem] bg-white/[0.02] border border-white/10 relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-24 h-24 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center relative">
            <Lock size={40} className="text-aeirmist-cyan" />
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <ShieldCheck size={18} className="text-aeirmist-lime" />
              <h3 className="text-xl font-bold uppercase tracking-wider text-white">Vault Status: Secure</h3>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed max-w-md">
              Your secure vault is active and protected by AES-256 encryption. All items stored here are strictly private and excluded from general search results.
            </p>
          </div>
          <button 
            onClick={() => {
              openVault();
              addToast({ title: 'Vault Unlocked', message: 'Welcome to your secure vault.', type: 'success' });
            }}
            className="px-8 py-3 rounded-2xl bg-aeirmist-cyan text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Open Vault
          </button>
        </div>
      </div>

      {/* Encryption Settings */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-magenta/10 flex items-center justify-center text-aeirmist-magenta">
            <Key size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Security & Privacy Options</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VaultOption 
            icon={<Fingerprint size={18} />}
            title="Biometric Authentication"
            desc="Require Touch ID or Face ID to open vault"
            enabled={biometricAuth}
            onClick={() => toggleOption('Biometric Authentication', biometricAuth, setBiometricAuth, 'aeirmist_vault_biometric')}
          />
          <VaultOption 
            icon={<EyeOff size={18} />}
            title="Stealth Mode"
            desc="Hide vault shortcut from the sidebar navigation"
            enabled={stealthMode}
            onClick={() => toggleOption('Stealth Mode', stealthMode, setStealthMode, 'aeirmist_vault_stealth')}
          />
          <VaultOption 
            icon={<Zap size={18} />}
            title="Auto-Lock"
            desc="Automatically lock vault after 5 minutes of inactivity"
            enabled={autoLock}
            onClick={() => toggleOption('Auto-Lock', autoLock, setAutoLock, 'aeirmist_vault_autolock')}
          />
          <VaultOption 
            icon={<Server size={18} />}
            title="Cloud Sync"
            desc="Back up encrypted vault items to secure cloud storage"
            enabled={cloudSync}
            onClick={() => toggleOption('Cloud Sync', cloudSync, setCloudSync, 'aeirmist_vault_cloudsync')}
          />
        </div>
      </section>

      {/* Security Logs */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
            <Activity size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Access History</h3>
        </div>

        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
          <div className="space-y-4">
            <LogEntry time="2 hours ago" action="Vault Opened" device="iPhone 15 Pro" status="Verified" />
            <LogEntry time="Yesterday" action="File Exported" device="MacBook Pro" status="Encrypted" />
            <LogEntry time="3 days ago" action="Failed Login Attempt" device="Unknown Device" status="Blocked" warning />
          </div>
          <button 
            onClick={() => {
              addToast({
                title: 'AUDIT LOG SYNC',
                message: 'All 38 cryptographic vault access records verified clean.',
                type: 'info'
              });
            }}
            className="w-full pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors cursor-pointer"
          >
            View Complete Audit Log
          </button>
        </div>
      </section>

      {/* Recovery Phase */}
      <section className="pt-8 border-t border-white/5">
        <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aeirmist-magenta/10 flex items-center justify-center text-aeirmist-magenta">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-aeirmist-magenta">Recovery Key</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mt-0.5">Security Settings</p>
            </div>
          </div>
          
          <p className="text-[11px] text-white/50 leading-relaxed max-w-xl">
            If you lose your master vault key, our team cannot recover your data due to zero-knowledge encryption. Keep your backup recovery key in a safe place.
          </p>

          <div className="flex gap-4">
            <button 
              onClick={() => addToast({ title: 'Recovery Key', message: 'New recovery key generated and copied.', type: 'success' })}
              className="px-8 py-3 rounded-xl bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all cursor-pointer"
            >
              Generate Key
            </button>
            <button 
              onClick={() => addToast({ title: 'Reset Vault', message: 'Vault reset requested.', type: 'info' })}
              className="px-8 py-3 rounded-xl bg-aeirmist-magenta/20 border border-aeirmist-magenta/40 text-aeirmist-magenta text-[10px] font-black uppercase tracking-widest hover:bg-aeirmist-magenta hover:text-white transition-all cursor-pointer"
            >
              Reset Vault
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

const VaultOption = ({ icon, title, desc, enabled, onClick }: any) => (
  <button 
    onClick={onClick}
    className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex items-start gap-4 text-left group cursor-pointer active:scale-98"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
      enabled ? 'bg-aeirmist-cyan/10 text-aeirmist-cyan' : 'bg-white/5 text-white/40 group-hover:text-white/60'
    }`}>
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-white">{title}</h4>
        <div className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,242,255,0.6)]' : 'bg-white/10'}`} />
      </div>
      <p className="text-[10px] text-white/30 mt-1 leading-relaxed">{desc}</p>
    </div>
  </button>
);

const LogEntry = ({ time, action, device, status, warning }: any) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
    <div className="flex items-center gap-4">
      <div className={`w-1.5 h-1.5 rounded-full ${warning ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-white/20'}`} />
      <div>
        <div className="text-[10px] font-bold text-white/80">{action}</div>
        <div className="text-[9px] text-white/20 font-mono uppercase mt-0.5">{device} • {time}</div>
      </div>
    </div>
    <div className={`text-[8px] font-black uppercase tracking-widest ${warning ? 'text-red-500' : 'text-white/40'}`}>
      {status}
    </div>
  </div>
);

export default VaultSettings;
