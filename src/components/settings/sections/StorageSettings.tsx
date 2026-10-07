import React from 'react';
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  HardDrive, 
  Cloud, 
  Shield, 
  Download,
  AlertTriangle,
  Clock,
  Settings,
  Folder,
  FolderCheck,
  CheckCircle2,
  RotateCcw,
  Server
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { DigitalModule } from '../../ui/DigitalComponents';
import { api } from '../../../services/api/client';
import { DownloadManagerService, DownloadMode, DownloadPathConfig } from '../../../services/DownloadManagerService';


import { aeirmistCache } from '../../../services/CacheService';
import { triggerNativeHaptic } from '../../../lib/nativeHaptics';

const StorageSettings = () => {
  const { addToast, mediaSettings, setMediaSettings, clearCache } = useAeirmist();
  const [isPurging, setIsPurging] = React.useState(false);
  const [cacheSize, setCacheSize] = React.useState('142.8 MB');

  const handlePurgeCache = async () => {
    setIsPurging(true);
    triggerNativeHaptic('medium');
    try {
      if (clearCache) {
        await clearCache();
      } else {
        await aeirmistCache.clearAll();
      }
      // Also clear transient local storage keys
      try {
        localStorage.removeItem('aeirmist_cached_inbox_chats');
        localStorage.removeItem('aeirmist_cached_active_tab');
      } catch {}

      setCacheSize('0.0 KB');
      triggerNativeHaptic('success');
      addToast?.({
        title: 'CACHE PURGED',
        message: 'All local cached media, temporary feed assets, and index artifacts have been cleared.',
        type: 'success'
      });
    } catch (e) {
      addToast?.({
        title: 'PURGE FAILED',
        message: 'Could not completely purge local database.',
        type: 'warning'
      });
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-12">
      <div className="space-y-1">
        <h2 className="text-3xl font-display font-bold text-white">Data Allocation</h2>
        <p className="text-xs text-white/45 uppercase tracking-widest font-medium">Manage your digital footprint and storage vectors</p>
      </div>

      {/* Storage Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StorageMetric label="Local Cache" value={cacheSize} color="text-aeirmist-cyan" icon={<HardDrive size={14} />} />
        <StorageMetric label="Cloud Sync" value="2.4 GB" color="text-aeirmist-magenta" icon={<Cloud size={14} />} />
        <StorageMetric label="Artifacts" value="842 KB" color="text-aeirmist-lime" icon={<Database size={14} />} />
      </section>

      {/* Media Management */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan">
            <Settings size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Sync Preferences</h3>
        </div>

        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/90">Asset Resolution</h4>
              <p className="text-[10px] text-white/40 mt-1">Control the fidelity of incoming media artifacts</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['LOW', 'MEDIUM', 'HIGH', 'ULTRA'].map((quality) => (
                <button
                  key={quality}
                  onClick={() => setMediaSettings({ ...mediaSettings, quality: quality as any })}
                  className={`py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                    mediaSettings.quality === quality
                      ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.15)]'
                      : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'
                  }`}
                >
                  {quality}
                </button>
              ))}
            </div>
          </div>

          <ToggleItem 
            icon={<Download size={18} />}
            title="Auto-Download Artifacts"
            desc="Automatically synchronize incoming media streams"
            enabled={mediaSettings.autoDownload}
            onChange={(v) => setMediaSettings({ ...mediaSettings, autoDownload: v })}
          />
        </div>
      </section>

      {/* Telegram-Style Download Path Selector */}
      <DownloadPathSection addToast={addToast} />

      {/* Aeirmist Dedicated Server Storage */}
      <AeirmistServerStorageSection addToast={addToast} />


      {/* Cache & Maintenance */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-magenta/10 flex items-center justify-center text-aeirmist-magenta">
            <RefreshCw size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Maintenance</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/90">Identity Cache</h4>
              <p className="text-[10px] text-white/40 mt-1 leading-relaxed">Temporary assets stored to accelerate interface navigation</p>
            </div>
            <button 
              onClick={handlePurgeCache}
              disabled={isPurging}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={12} className={isPurging ? 'animate-spin' : ''} />
              {isPurging ? 'Purging Local Vault...' : 'Purge Local Cache'}
            </button>
          </div>

          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/90">Download Management</h4>
              <p className="text-[10px] text-white/40 mt-1 leading-relaxed">Review and manage artifacts stored on the host device</p>
            </div>
            <button className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
              Manage Downloads
            </button>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="pt-8 border-t border-white/5">
        <div className="p-8 rounded-[2.5rem] bg-aeirmist-magenta/5 border border-aeirmist-magenta/20 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aeirmist-magenta/10 flex items-center justify-center text-aeirmist-magenta">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-aeirmist-magenta">System Termination</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mt-0.5">Danger Sector</p>
            </div>
          </div>
          
          <p className="text-[11px] text-white/50 leading-relaxed max-w-xl">
            Initiating a system termination will permanently erase your identity from the network. All links, assets, and encrypted histories will be deleted beyond recovery.
          </p>

          <button className="px-8 py-3 rounded-xl bg-aeirmist-magenta/20 border border-aeirmist-magenta/40 text-aeirmist-magenta text-[10px] font-black uppercase tracking-widest hover:bg-aeirmist-magenta hover:text-white transition-all">
            Terminate Sequence
          </button>
        </div>
      </section>
    </div>
  );
};

const StorageMetric = React.memo(({ label, value, color, icon }: any) => (
  <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 space-y-2">
    <div className="flex items-center gap-2 opacity-40">
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
  </div>
));

const ToggleItem = React.memo(({ icon, title, desc, enabled, onChange }: any) => (
  <button 
    onClick={() => onChange(!enabled)}
    className="w-full p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between text-left group"
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
));

const AeirmistServerStorageSection = React.memo(({ addToast }: { addToast: any }) => {
  const [testing, setTesting] = React.useState(false);
  const [latency, setLatency] = React.useState<number | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    const start = performance.now();
    try {
      await api.health.check();
      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);
      addToast?.({
        title: 'STORAGE ENGINE ONLINE',
        message: `Connected to Aeirmist Server Storage (${elapsed}ms). Ready for high-velocity streaming.`,
        type: 'success'
      });
    } catch (e: any) {
      addToast?.({
        title: 'STORAGE WARNING',
        message: 'Could not reach server storage endpoint: ' + (e?.message || 'Check network'),
        type: 'warning'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)]">
          <Server size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/90">Aeirmist Dedicated Server Storage</h3>
          <span className="text-[9px] font-bold text-aeirmist-cyan uppercase tracking-widest bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-aeirmist-cyan animate-pulse" />
            Online / Self-Hosted
          </span>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/90">Zero Third-Party Dependency</h4>
            <p className="text-[10px] text-white/40 mt-1 leading-relaxed">
              All videos, reels, photos, avatars, and attachments stream directly through your private Aeirmist PostgreSQL + Media Engine server node with no third-party CDN or external accounts required.
            </p>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-[9px] font-bold uppercase tracking-widest hover:bg-aeirmist-cyan/20 text-aeirmist-cyan transition-all shrink-0 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={11} className={testing ? 'animate-spin' : ''} />
            {testing ? 'Testing...' : 'Verify Engine'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/5">
          <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 block">Storage Engine</span>
            <span className="text-xs font-mono text-aeirmist-cyan font-bold mt-1 block">PostgreSQL + Local FS</span>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 block">Streaming Route</span>
            <span className="text-xs font-mono text-aeirmist-cyan font-bold mt-1 block">/media/* (Express Node)</span>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 block">Latency & Status</span>
            <span className="text-xs font-mono text-aeirmist-lime font-bold mt-1 flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              {latency !== null ? `${latency}ms • Operational` : 'Active • Operational'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
});

const DownloadPathSection = React.memo(({ addToast }: { addToast: any }) => {
  const [config, setConfig] = React.useState<DownloadPathConfig>({
    mode: 'system_downloads',
    displayPath: 'Downloads / Aeirmist',
    isAvailable: true,
    isNative: false
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    DownloadManagerService.getConfig().then(setConfig);
  }, []);

  const handleSelectMode = async (mode: DownloadMode) => {
    if (mode === 'custom' && !config.customUri && !config.customName) {
      handlePickCustomFolder();
      return;
    }
    const ok = await DownloadManagerService.setMode(mode);
    if (ok) {
      const updated = await DownloadManagerService.getConfig();
      setConfig(updated);
      addToast?.({
        title: 'DOWNLOAD PATH UPDATED',
        message: `Mode set to: ${mode === 'system_downloads' ? 'Aeirmist System Downloads' : mode === 'temp' ? 'Temporary App Cache' : 'Custom Folder'}`,
        type: 'success'
      });
    }
  };

  const handlePickCustomFolder = async () => {
    setLoading(true);
    try {
      const res = await DownloadManagerService.pickCustomFolder();
      if (res.success) {
        const updated = await DownloadManagerService.getConfig();
        setConfig(updated);
        addToast?.({
          title: 'FOLDER SELECTED',
          message: `Download directory configured: ${res.name}`,
          type: 'success'
        });
      } else if (!res.canceled && res.error) {
        addToast?.({
          title: 'FOLDER PICKER ERROR',
          message: res.error,
          type: 'error'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    await DownloadManagerService.resetToDefault();
    const updated = await DownloadManagerService.getConfig();
    setConfig(updated);
    addToast?.({
      title: 'DOWNLOAD PATH RESET',
      message: 'Restored default Downloads / Aeirmist folder',
      type: 'info'
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan">
            <Folder size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Download Path</h3>
            <span className="text-[9px] font-bold text-aeirmist-cyan uppercase tracking-widest bg-aeirmist-cyan/10 px-2 py-0.5 rounded-full inline-block mt-0.5">
              {config.isNative ? 'Native SAF Storage' : 'Standard Web Storage'}
            </span>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          title="Reset to default system downloads folder"
        >
          <RotateCcw size={11} />
          Reset Default
        </button>
      </div>

      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
        {/* Current Active Location Display */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-aeirmist-cyan/15 flex items-center justify-center text-aeirmist-cyan shrink-0">
              <FolderCheck size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Current Target Directory</span>
              <p className="text-xs font-mono font-bold text-white truncate mt-0.5">{config.displayPath}</p>
            </div>
          </div>
          {config.mode === 'custom' && (
            <button
              onClick={handlePickCustomFolder}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-aeirmist-cyan/20 border border-aeirmist-cyan/40 text-aeirmist-cyan text-[9px] font-bold uppercase tracking-wider hover:bg-aeirmist-cyan hover:text-black transition-all shrink-0 cursor-pointer"
            >
              {loading ? 'Opening...' : 'Change Folder'}
            </button>
          )}
        </div>

        {/* 3 Download Modes Options */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/60 block">Select Download Flow</label>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Mode 1: System Downloads */}
            <button
              onClick={() => handleSelectMode('system_downloads')}
              className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                config.mode === 'system_downloads'
                  ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-white shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                  : 'bg-white/[0.02] border-white/5 text-white/60 hover:border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">System Downloads</span>
                {config.mode === 'system_downloads' && <CheckCircle2 size={16} className="text-aeirmist-cyan" />}
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed">
                Safe default folder inside system Downloads (Downloads / Aeirmist).
              </p>
            </button>

            {/* Mode 2: Temp Folder */}
            <button
              onClick={() => handleSelectMode('temp')}
              className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                config.mode === 'temp'
                  ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-white shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                  : 'bg-white/[0.02] border-white/5 text-white/60 hover:border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">Temp / App Cache</span>
                {config.mode === 'temp' && <CheckCircle2 size={16} className="text-aeirmist-cyan" />}
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed">
                Ephemeral app storage. Can be purged on logout or storage cleanup.
              </p>
            </button>

            {/* Mode 3: Custom Folder (SAF) — Android app only */}
            {config.isNative && (
            <button
              onClick={() => handleSelectMode('custom')}
              className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                config.mode === 'custom'
                  ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-white shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                  : 'bg-white/[0.02] border-white/5 text-white/60 hover:border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">Custom SAF Folder</span>
                {config.mode === 'custom' && <CheckCircle2 size={16} className="text-aeirmist-cyan" />}
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed">
                {config.customName ? `Selected: ${config.customName}` : 'Choose any accessible folder via native Android SAF picker.'}
              </p>
            </button>
            )}
          </div>
        </div>

        {/* Info footer — Android app only */}
        {config.isNative && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/5 text-[10px] text-white/40">
          <span>Compliant with Android 10+ scoped storage. No broad storage permissions required.</span>
          <button
            onClick={handlePickCustomFolder}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Folder size={14} className="text-aeirmist-cyan" />
            {loading ? 'Opening SAF Picker...' : 'Open Android Folder Picker'}
          </button>
        </div>
        )}
      </div>
    </section>
  );
});

export default StorageSettings;

