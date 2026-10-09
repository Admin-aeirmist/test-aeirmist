import TicketsTab from './TicketsTab';
import SupportInboxTab from './SupportInboxTab';
import React, { useState, useEffect } from 'react';
import { logger } from '@/src/utils/logger';
import { getAvatarUrl } from '../../lib/avatar';
import { applyDynamicFavicon } from '../../utils/favicon';

import {
 motion, AnimatePresence } from 'motion/react';
import {
 

  Shield, 
  History, 
  AlertTriangle, 
  ChevronRight, 
  Filter, 
  Search, 
  User, 
  Clock, 
  Calendar,
  Lock,
  Eye,
  CheckCircle,
  XCircle,
  RefreshCw,
  MoreVertical,
  ShieldCheck,
  Users,
  Flag,
  ShoppingBag,
  CreditCard,
  BarChart3,
  UserX,
  AlertCircle,
  Sliders,
  Check,
  X,
  ExternalLink,
  DollarSign,
  ArrowLeft,
  Activity,
  Globe,
  Radio,
  FileText,
  Key,
  Bell,
  Smartphone,
  Trash2,
  RotateCcw,
  Zap,
  TrendingUp,
  Cpu,
  Server,
  UserPlus,
  Plus,
  Edit3,
  ShieldAlert,
  LogOut,
  LifeBuoy,
  Upload,
  Image,
  Sun,
  Moon,
  Sparkles,
  Save,
  MapPin
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getCanonicalUid, getProfileId, normalizeAdminUser } from '@/src/utils/identityUtils';
import {

sendPasswordResetEmail } from 'firebase/auth';
import {

formatAeirmistTimestamp } from '../../lib/date';
import {

doc, getDoc, updateDoc, collection, query, orderBy, limit, onSnapshot, where, serverTimestamp, setDoc, deleteDoc, writeBatch, getDocs, addDoc } from 'firebase/firestore';
import {

fadeTransition } from '../../lib/motion';

const AuditLogTab = ({ db }: { db: any }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(150));
    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      logger.warn("Audit logs error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  const filteredLogs = logs.filter(l => 
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.adminEmail?.toLowerCase().includes(search.toLowerCase()) ||
    l.targetUid?.toLowerCase().includes(search.toLowerCase()) ||
    l.reason?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="p-12 flex justify-center"><RefreshCw className="animate-spin text-aeirmist-cyan" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-widest text-white">Immutable Audit Logs</h2>
          <p className="text-[10px] font-mono text-white/40">Every administrative action is cryptographically recorded.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
          <input 
            type="text"
            placeholder="Search logs by admin, action, target..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-mono outline-none focus:border-aeirmist-cyan/50"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredLogs.map((log) => (
          <div key={log.id} className="glass-panel p-5 rounded-2xl border-white/5 bg-white/[0.01] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${log.severity === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-aeirmist-cyan/10 text-aeirmist-cyan border border-aeirmist-cyan/20'}`}>
                  <Shield size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white">{log.action}</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/40 uppercase">{log.severity || 'medium'}</span>
                  </div>
                  <p className="text-[10px] font-mono text-aeirmist-cyan/80 mt-0.5">Admin: {log.adminEmail} • Target UID: {log.targetUid}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono text-white/60">
                  {log.timestamp?.toDate ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(log.timestamp.toDate()) : 'Recent'}
                </p>
                <p className="text-[9px] font-mono text-white/30">IP: {log.ip || '127.0.0.1'}</p>
              </div>
            </div>

            {log.reason && (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-mono text-white/80">
                <span className="text-white/40 uppercase font-bold text-[9px] block mb-1">Reason / Notes:</span>
                {log.reason}
              </div>
            )}

            {(log.before || log.after) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] font-mono">
                {log.before && (
                  <div className="p-3 rounded-xl bg-red-500/[0.02] border border-red-500/10">
                    <span className="text-red-400 font-bold uppercase text-[9px] block mb-1">Before State:</span>
                    <pre className="text-white/60 overflow-x-auto">{JSON.stringify(log.before, null, 2)}</pre>
                  </div>
                )}
                {log.after && (
                  <div className="p-3 rounded-xl bg-emerald-500/[0.02] border border-emerald-500/10">
                    <span className="text-emerald-400 font-bold uppercase text-[9px] block mb-1">After State:</span>
                    <pre className="text-white/60 overflow-x-auto">{JSON.stringify(log.after, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="text-center py-20 opacity-30">
            <History size={48} className="mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">No matching audit logs</p>
          </div>
        )}
      </div>
    </div>
  );
};

const SystemTab = () => {
  const { appBranding, updateAppBranding, uploadMedia, addToast } = useAeirmist();
  const [darkLogo, setDarkLogo] = useState<string>(appBranding?.darkLogoUrl || '');
  const [lightLogo, setLightLogo] = useState<string>(appBranding?.lightLogoUrl || '');
  const [uploadingDark, setUploadingDark] = useState(false);
  const [uploadingLight, setUploadingLight] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (appBranding?.darkLogoUrl !== undefined) setDarkLogo(appBranding.darkLogoUrl);
    if (appBranding?.lightLogoUrl !== undefined) setLightLogo(appBranding.lightLogoUrl);
  }, [appBranding]);

  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/png', 0.95));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => resolve(event.target?.result as string);
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'dark' | 'light') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast({ title: 'Invalid File', message: 'Please select an image file (PNG, JPG, SVG, WebP)', type: 'warning' });
      return;
    }

    if (mode === 'dark') setUploadingDark(true);
    else setUploadingLight(true);

    try {
      const dataUrl = await compressImageFile(file);

      if (mode === 'dark') {
        setDarkLogo(dataUrl);
        if (typeof window !== 'undefined') {
          localStorage.setItem('aeirmist_custom_logo', dataUrl);
        }
        await updateAppBranding({ darkLogoUrl: dataUrl });
        applyDynamicFavicon(dataUrl);
        fetch('/api/admin/sync-logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoUrl: dataUrl }) }).catch(() => {});
        addToast({ title: 'Dark Logo Uploaded', message: 'Custom dark logo applied as main logo and app icon.', type: 'success' });
      } else {
        setLightLogo(dataUrl);
        if (typeof window !== 'undefined') {
          localStorage.setItem('aeirmist_custom_logo', dataUrl);
        }
        await updateAppBranding({ lightLogoUrl: dataUrl });
        applyDynamicFavicon(dataUrl);
        fetch('/api/admin/sync-logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoUrl: dataUrl }) }).catch(() => {});
        addToast({ title: 'Light Logo Uploaded', message: 'Custom light logo applied as main logo and app icon.', type: 'success' });
      }
    } catch (err: any) {
      logger.error('Failed to process logo image:', err);
      addToast({ title: 'Upload Failed', message: err?.message || 'Could not process logo. Please retry.', type: 'warning' });
    } finally {
      if (mode === 'dark') setUploadingDark(false);
      else setUploadingLight(false);
      e.target.value = '';
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await updateAppBranding({
        darkLogoUrl: darkLogo,
        lightLogoUrl: lightLogo
      });
      addToast({ title: 'Logos Saved to Database', message: 'Custom app logos are permanently saved in Firestore.', type: 'success' });
    } catch (err: any) {
      addToast({ title: 'Save Failed', message: 'Could not save branding to database.', type: 'warning' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async (mode: 'dark' | 'light') => {
    if (mode === 'dark') {
      setDarkLogo('');
      await updateAppBranding({ darkLogoUrl: '' });
      addToast({ title: 'Dark Logo Reset', message: 'Restored default vector symbol for Dark theme.', type: 'info' });
    } else {
      setLightLogo('');
      await updateAppBranding({ lightLogoUrl: '' });
      addToast({ title: 'Light Logo Reset', message: 'Restored default vector symbol for Light theme.', type: 'info' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Cpu className="text-aeirmist-cyan" size={18} />
            System Management
          </h2>
          <p className="text-[10px] font-mono text-white/40">
            System control center and core operational workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 shrink-0">
          <span className="w-2 h-2 rounded-full bg-aeirmist-cyan animate-pulse" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-aeirmist-cyan">System Workspace Active</span>
        </div>
      </div>

      {/* App Logo Management Section */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 bg-black/40 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan">
              <Image size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                App Logo
                <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase bg-aeirmist-cyan/20 text-aeirmist-cyan border border-aeirmist-cyan/30">
                  Firestore Permanent
                </span>
              </h3>
              <p className="text-xs text-white/50">
                Upload custom dark & light theme logos. Automatically used across all app components without changing front-end design or layout.
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-aeirmist-cyan text-black font-bold text-xs uppercase tracking-wider hover:bg-aeirmist-cyan/90 transition-all shadow-lg shadow-aeirmist-cyan/20 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save to Database</span>
          </button>
        </div>

        {/* Upload Grid for Dark & Light Mode Logos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dark Theme Logo Box */}
          <div className="p-5 rounded-2xl bg-[#090d16] border border-white/10 space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-white tracking-wider">
                <Moon size={14} className="text-aeirmist-cyan" />
                <span>Dark Theme Logo</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${darkLogo ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-white/40'}`}>
                {darkLogo ? 'Custom Logo Active' : 'Default Symbol'}
              </span>
            </div>

            {/* Logo Preview */}
            <div className="h-32 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center p-4 relative overflow-hidden group">
              {darkLogo ? (
                <img src={darkLogo} alt="Dark Logo" className="max-h-24 max-w-full object-contain drop-shadow-[0_0_15px_rgba(0,242,255,0.3)]" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/30 text-xs font-mono">
                  <Sparkles size={24} className="text-aeirmist-cyan/60" />
                  <span>No dark logo uploaded</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-all border border-white/10">
                {uploadingDark ? <RefreshCw size={14} className="animate-spin text-aeirmist-cyan" /> : <Upload size={14} />}
                <span>{uploadingDark ? 'Uploading...' : 'Upload Dark Logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingDark}
                  onChange={(e) => handleFileUpload(e, 'dark')}
                  className="hidden"
                />
              </label>

              {darkLogo && (
                <button
                  onClick={() => handleReset('dark')}
                  className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer"
                  title="Reset to default logo"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Light Theme Logo Box */}
          <div className="p-5 rounded-2xl bg-[#f8fafc] border border-slate-200 space-y-4 flex flex-col justify-between text-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-900 tracking-wider">
                <Sun size={14} className="text-amber-500" />
                <span>Light Theme Logo</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${lightLogo ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/30' : 'bg-slate-200 text-slate-600'}`}>
                {lightLogo ? 'Custom Logo Active' : 'Default Symbol'}
              </span>
            </div>

            {/* Logo Preview */}
            <div className="h-32 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-4 relative overflow-hidden shadow-inner">
              {lightLogo ? (
                <img src={lightLogo} alt="Light Logo" className="max-h-24 max-w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs font-mono">
                  <Sun size={24} className="text-amber-500/60" />
                  <span>No light logo uploaded</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-all">
                {uploadingLight ? <RefreshCw size={14} className="animate-spin text-amber-400" /> : <Upload size={14} />}
                <span>{uploadingLight ? 'Uploading...' : 'Upload Light Logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingLight}
                  onChange={(e) => handleFileUpload(e, 'light')}
                  className="hidden"
                />
              </label>

              {lightLogo && (
                <button
                  onClick={() => handleReset('light')}
                  className="p-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 border border-red-200 transition-all cursor-pointer"
                  title="Reset to default logo"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Persistence Status Info */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white/50 font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-emerald-400 shrink-0" />
            <span>Database Storage: <strong className="text-white">Firestore system_config/app_branding</strong></span>
          </div>
          <div className="text-[10px] text-white/30">
            {appBranding?.updatedAt ? `Last Synced: ${new Date(appBranding.updatedAt).toLocaleString()}` : 'Ready for logo configuration'}
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardTab = ({ db, setActiveTab }: { db: any; setActiveTab: (tab: any) => void }) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    suspended: 0,
    banned: 0,
    appeals: 0,
    reportsToday: 0,
    orders: 0,
    revenue: '—',
    subscribers: 0,
    onlineNow: '—'
  });

  useEffect(() => {
    if (!db) return;
    const unsubProfiles = onSnapshot(collection(db, 'profiles'), (snap) => {
      const docs = snap.docs.map(d => d.data());
      const subs = docs.filter(d => d.creatorModeEnabled || d.isVerified || d.isPremium).length;
      setStats(s => ({
        ...s,
        totalUsers: docs.length,
        suspended: docs.filter(d => d.status === 'SUSPENDED').length,
        banned: docs.filter(d => d.status === 'BANNED' || d.isBanned).length,
        subscribers: subs,
        onlineNow: '—'
      }));
    }, (err) => logger.warn("Admin profiles listener:", err));

    const unsubAppeals = onSnapshot(collection(db, 'appeals'), (snap) => {
      setStats(s => ({ ...s, appeals: snap.docs.filter(d => d.data().status === 'pending').length }));
    }, (err) => logger.warn("Admin appeals listener:", err));

    const unsubReports = onSnapshot(collection(db, 'reports'), (snap) => {
      setStats(s => ({ ...s, reportsToday: snap.size }));
    }, (err) => logger.warn("Admin reports listener:", err));

    const unsubMarketplace = onSnapshot(collection(db, 'marketplace_items'), (snap) => {
      const count = snap.size;
      setStats(s => ({
        ...s,
        orders: count,
        revenue: '—'
      }));
    }, (err) => logger.warn("Admin marketplace listener:", err));

    return () => {
      unsubProfiles();
      unsubAppeals();
      unsubReports();
      unsubMarketplace();
    };
  }, [db]);

  const cards = [
    { label: 'Active Users', value: stats.totalUsers - stats.banned, icon: <Users size={20} className="text-emerald-400" />, change: 'Real-time sync', tab: 'users' },
    { label: 'Online Now', value: stats.onlineNow, icon: <Activity size={20} className="text-aeirmist-cyan" />, change: 'Active sessions', tab: 'users' },
    { label: 'Suspended', value: stats.suspended, icon: <Lock size={20} className="text-amber-400" />, change: 'Restricted access', tab: 'users' },
    { label: 'Banned', value: stats.banned, icon: <AlertTriangle size={20} className="text-red-400" />, change: 'Permanently blocked', tab: 'users' },
    { label: 'Pending Appeals', value: stats.appeals, icon: <ShieldCheck size={20} className="text-purple-400" />, change: 'Action required', tab: 'appeals' },
    { label: 'Reports Today', value: stats.reportsToday, icon: <Flag size={20} className="text-orange-400" />, change: 'Queue monitoring', tab: 'reports' },
    { label: 'Marketplace Orders', value: stats.orders, icon: <ShoppingBag size={20} className="text-aeirmist-lime" />, change: 'Total listings', tab: 'marketplace' },
    { label: 'Total Revenue', value: stats.revenue, icon: <DollarSign size={20} className="text-emerald-400" />, change: 'Calculated volume', tab: 'marketplace' },
    { label: 'Premium Subscribers', value: stats.subscribers, icon: <CreditCard size={20} className="text-purple-400" />, change: 'Creators & Verified', tab: 'marketplace' },
    { label: 'System Health', value: '—', icon: <Server size={20} className="text-emerald-400" />, change: 'Awaiting data', tab: 'security' }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-black uppercase tracking-widest text-white">Enterprise Overview</h2>
        <p className="text-xs font-mono text-white/40">Real-time platform telemetry, trust & safety metrics, and financial performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c, i) => (
          <div 
            key={i} 
            onClick={() => setActiveTab(c.tab)}
            className="glass-panel p-5 rounded-3xl border-white/5 bg-white/[0.01] flex flex-col justify-between space-y-4 cursor-pointer hover:border-aeirmist-cyan/40 hover:bg-white/[0.03] transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">{c.label}</span>
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-aeirmist-cyan/30 transition-colors">
                {c.icon}
              </div>
            </div>
            <div>
              <p className="text-2xl font-mono font-bold text-white">{c.value}</p>
              <p className="text-[10px] font-mono text-aeirmist-cyan mt-1 flex items-center gap-1">
                {c.change} <ChevronRight size={10} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Charts Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-3xl border-white/5 bg-white/[0.01] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Daily Active Users (DAU)</h3>
            <span className="text-[10px] font-mono text-aeirmist-cyan">Last 7 Days</span>
          </div>
          <div className="h-48 flex items-center justify-center pt-6 px-2 border-b border-white/10 opacity-30">
            <span className="text-xs font-mono uppercase tracking-widest">Awaiting Data</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl border-white/5 bg-white/[0.01] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Reports & Moderation Trend</h3>
            <span className="text-[10px] font-mono text-amber-400">Resolved vs Flagged</span>
          </div>
          <div className="h-48 flex items-center justify-center pt-6 px-2 border-b border-white/10 opacity-30">
            <span className="text-xs font-mono uppercase tracking-widest">Awaiting Data</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Meta-Style Verification Plan Modal for Administrators
const VerificationPlanModal = ({
  isOpen,
  onClose,
  user,
  onApplyPlan,
  onRevoke,
  onExtend
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onApplyPlan: (plan: 'essential' | 'creator' | 'business', durationDays: number) => Promise<void>;
  onRevoke: () => Promise<void>;
  onExtend: (days: number) => Promise<void>;
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'essential' | 'creator' | 'business'>('creator');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.verificationPlan) {
      setSelectedPlan(user.verificationPlan);
    } else {
      setSelectedPlan('creator');
    }
    setDurationDays(30);
  }, [user]);

  if (!isOpen || !user) return null;

  const isVerified = Boolean(user.isVerified || user.verified);
  const currentPlan = user.verificationPlan || (isVerified ? 'creator' : null);

  // Compute deadline details
  const rawExpires = user.verificationExpiresAt || user.monthlyDeadline;
  let deadlineStr = 'Not set';
  let diffDays = 0;
  if (rawExpires) {
    let expMs = 0;
    if (typeof rawExpires?.toMillis === 'function') expMs = rawExpires.toMillis();
    else if (typeof rawExpires?.toDate === 'function') expMs = rawExpires.toDate().getTime();
    else if (rawExpires instanceof Date) expMs = rawExpires.getTime();
    else if (typeof rawExpires === 'number') expMs = rawExpires;
    else if (typeof rawExpires === 'string') expMs = new Date(rawExpires).getTime();

    if (expMs) {
      deadlineStr = new Date(expMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      diffDays = Math.max(0, Math.ceil((expMs - Date.now()) / (1000 * 60 * 60 * 24)));
    }
  }

  const plans = [
    {
      id: 'essential' as const,
      name: 'Essential Plan',
      price: '$3.69 / mo',
      badgeColor: 'text-blue-400',
      badgeBg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
      desc: 'Meta-style basic identity authentication & blue checkmark',
      features: ['Blue Verified Checkmark', 'Identity Authentication', 'Impersonation Defense']
    },
    {
      id: 'creator' as const,
      name: 'Creator Plan',
      price: '$9.69 / mo',
      badgeColor: 'text-aeirmist-cyan',
      badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-aeirmist-cyan',
      desc: 'Most popular creator verification badge & analytics',
      features: ['Cyan Creator Badge', 'Creator Studio Insights', 'Marketplace Priority Boost']
    },
    {
      id: 'business' as const,
      name: 'Business Plan',
      price: '$12.69 / mo',
      badgeColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      desc: 'Enterprise & brand verification with verified seller badge',
      features: ['Gold Business Checkmark', 'Verified Seller Badge', 'Brand Protection']
    }
  ];

  return (
    <div className="fixed inset-0 z-[100002] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-xl bg-[#090b10] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl text-white relative max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0">
              <img src={getAvatarUrl(user.photoURL, user.id)} alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{user.displayName || user.username || 'User'}</h3>
                {isVerified && <ShieldCheck size={16} className="text-aeirmist-cyan" />}
              </div>
              <p className="text-xs font-mono text-white/50">@{user.username || 'user'} • UID: {user.uid ? `${user.uid.slice(0, 10)}...` : 'N/A'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Current Status banner */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div>
            <span className="text-white/40 block text-[9px] uppercase tracking-wider mb-0.5">Current Status</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${isVerified ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {isVerified ? 'VERIFIED (ACTIVE)' : 'UNVERIFIED'}
              </span>
              {currentPlan && (
                <span className="px-2 py-0.5 rounded bg-white/5 text-[9px] uppercase tracking-widest text-aeirmist-cyan font-bold border border-white/10">
                  {currentPlan}
                </span>
              )}
            </div>
          </div>
          {isVerified && (
            <div className="text-right">
              <span className="text-white/40 block text-[9px] uppercase tracking-wider mb-0.5">Monthly Deadline</span>
              <span className="text-white font-bold">{deadlineStr} ({diffDays}d left)</span>
            </div>
          )}
        </div>

        {/* 3 Plans Selection */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/50 block">
            Select Meta-Style Verification Plan
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((p) => {
              const isSelected = selectedPlan === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected 
                      ? 'bg-white/[0.06] border-aeirmist-cyan shadow-lg shadow-aeirmist-cyan/10' 
                      : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={16} className={p.badgeColor} />
                        <span className="text-xs font-bold text-white">{p.name}</span>
                      </div>
                      {isSelected && <Check size={14} className="text-aeirmist-cyan" />}
                    </div>
                    <div className="text-sm font-black text-white font-mono">{p.price}</div>
                    <p className="text-[10px] text-white/50 leading-relaxed">{p.desc}</p>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-white/5 text-[9px] text-white/70 font-mono">
                    {p.features.slice(0, 2).map((f, fi) => (
                      <div key={fi} className="flex items-center gap-1">
                        <Check size={10} className={p.badgeColor} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Duration Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/50 block">
            Billing Cycle / Deadline Duration
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { days: 30, label: '30 Days (1 Mo)' },
              { days: 60, label: '60 Days (2 Mo)' },
              { days: 90, label: '90 Days (3 Mo)' },
              { days: 365, label: '365 Days (1 Yr)' }
            ].map(dur => (
              <button
                key={dur.days}
                type="button"
                onClick={() => setDurationDays(dur.days)}
                className={`py-2 px-1 text-center rounded-xl text-[10px] font-mono font-bold uppercase transition-all ${
                  durationDays === dur.days
                    ? 'bg-aeirmist-cyan text-black font-black shadow-md'
                    : 'bg-white/5 border border-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {dur.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-white/10 flex flex-wrap gap-3 justify-end items-center">
          {isVerified && (
            <button
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                await onRevoke();
                setIsSubmitting(false);
              }}
              className="py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-black uppercase tracking-wider transition-all mr-auto cursor-pointer"
            >
              Revoke Badge
            </button>
          )}

          {isVerified && (
            <button
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                await onExtend(30);
                setIsSubmitting(false);
              }}
              className="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Extend +30 Days
            </button>
          )}

          <button
            disabled={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              await onApplyPlan(selectedPlan, durationDays);
              setIsSubmitting(false);
            }}
            className="py-2.5 px-6 rounded-xl bg-aeirmist-cyan text-black text-xs font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-aeirmist-cyan/20 cursor-pointer font-bold"
          >
            {isVerified ? `Update to ${selectedPlan.toUpperCase()}` : `Approve & Activate ${selectedPlan.toUpperCase()}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const UsersTab = ({ db, addToast, purgeUser, toggleUserBan, toggleVerification, updateUserStatus, suspendUser, onOpenAddAdmin }: { db: any; addToast: any; purgeUser: any; toggleUserBan: any; toggleVerification: any; updateUserStatus: any; suspendUser: any; onOpenAddAdmin: () => void }) => {
  const { auth } = useAeirmist();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserForDrawer, setSelectedUserForDrawer] = useState<any | null>(null);
  const [verificationModalUser, setVerificationModalUser] = useState<any | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [filterRole, setFilterRole] = useState('ALL');
  const [suspendingUser, setSuspendingUser] = useState<any | null>(null);
  const [suspendDuration, setSuspendDuration] = useState('7 Days');
  const [suspendReason, setSuspendReason] = useState('Community Guideline Violation');
  const [suspendNotes, setSuspendNotes] = useState('');
  const [isSubmittingSuspend, setIsSubmittingSuspend] = useState(false);
  const [deleteModalUser, setDeleteModalUser] = useState<any | null>(null);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard' | 'anonymize'>('hard');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isExecutingDelete, setIsExecutingDelete] = useState(false);
  const [userReports, setUserReports] = useState<any[]>([]);
  const [loadingUserReports, setLoadingUserReports] = useState(false);

  useEffect(() => {
    if (!selectedUserForDrawer || !db) {
      setUserReports([]);
      return;
    }
    
    const targetUid = getCanonicalUid(selectedUserForDrawer) || selectedUserForDrawer.uid || selectedUserForDrawer.id;
    if (!targetUid) return;

    setLoadingUserReports(true);
    const q1 = query(
      collection(db, 'reports'),
      where('reportedUid', '==', targetUid),
      limit(20)
    );

    const unsub = onSnapshot(q1, (snap) => {
      setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingUserReports(false);
    }, (err) => {
      logger.warn("User reports fetch error:", err);
      setUserReports([]);
      setLoadingUserReports(false);
    });

    return () => unsub();
  }, [selectedUserForDrawer, db]);

  const formatAccountCreationDate = (user: any): string => {
    if (!user) return 'N/A';
    const rawDate = user.createdAt || user.created_at || user.joinedAt || user.timestamp || user.dateCreated || user.metadata?.creationTime || user.rawRecord?.createdAt || user.rawRecord?.created_at || user.rawRecord?.joinedAt || user.rawRecord?.timestamp;
    if (!rawDate) return 'N/A';
    try {
      let dateObj: Date | null = null;
      if (typeof rawDate?.toDate === 'function') {
        dateObj = rawDate.toDate();
      } else if (typeof rawDate?.toMillis === 'function') {
        dateObj = new Date(rawDate.toMillis());
      } else if (rawDate instanceof Date) {
        dateObj = rawDate;
      } else if (typeof rawDate === 'number') {
        dateObj = new Date(rawDate);
      } else if (typeof rawDate === 'string') {
        dateObj = new Date(rawDate);
      } else if (rawDate && typeof rawDate === 'object' && typeof rawDate.seconds === 'number') {
        dateObj = new Date(rawDate.seconds * 1000);
      }
      
      if (dateObj && !isNaN(dateObj.getTime())) {
        return dateObj.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch (e) {
      logger.warn('Creation date parse error:', e);
    }
    return typeof rawDate === 'string' ? rawDate : 'N/A';
  };

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'profiles'), (snapshot) => {
      setUsers(snapshot.docs.map(d => normalizeAdminUser({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      logger.warn("Profiles list error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  const handleApplySuspension = async () => {
    if (!suspendingUser) return;
    const targetUid = getCanonicalUid(suspendingUser);
    if (!targetUid) {
      addToast({ title: 'Action Aborted', message: "Unable to resolve canonical user ID for suspension.", type: 'warning' });
      return;
    }
    setIsSubmittingSuspend(true);
    try {
      await suspendUser(targetUid, suspendDuration, suspendReason, suspendNotes);
      setSuspendingUser(null);
      setSuspendNotes('');
    } catch (e) {
      logger.error("Suspension failed:", e);
    } finally {
      setIsSubmittingSuspend(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteModalUser || deleteConfirmText.trim().toUpperCase() !== 'DELETE' || isExecutingDelete) return;
    setIsExecutingDelete(true);

    const targetUid = getCanonicalUid(deleteModalUser) || deleteModalUser.uid || (deleteModalUser.id && !deleteModalUser.id.startsWith('profile_') ? deleteModalUser.id : null);
    const profileId = deleteModalUser.profileId || getProfileId(deleteModalUser) || deleteModalUser.id;
    const targetId = targetUid || profileId || deleteModalUser.id;
    
    try {
      if (deleteType === 'anonymize') {
        if (profileId) {
          await updateDoc(doc(db, 'profiles', profileId), {
            displayName: 'Aeirmist User',
            username: null,
            usernameNormalized: null,
            bio: '',
            photoURL: '',
            coverURL: '',
            isAnonymized: true,
            status: 'ANONYMIZED'
          }).catch(() => {});
        }
        if (targetUid) {
          await updateDoc(doc(db, 'users', targetUid), {
            displayName: 'Aeirmist User',
            username: null,
            usernameNormalized: null,
            isAnonymized: true,
            status: 'ANONYMIZED'
          }).catch(() => {});
        }
        addToast({ title: 'User Anonymized', message: 'Personal data removed; posts remain.', type: 'success' });
      } else if (deleteType === 'soft') {
        if (profileId) {
          await updateDoc(doc(db, 'profiles', profileId), {
            status: 'DELETED',
            isBanned: true
          }).catch(() => {});
        }
        if (targetUid) {
          await updateUserStatus(targetUid, 'DELETED', profileId);
        }
        addToast({ title: 'Soft Deleted', message: 'Account marked as deleted (recoverable).', type: 'success' });
      } else {
        // FULL HARD DELETE - ERASE EVERYTHING BY HARD DELETE
        
        // 1. Direct guaranteed deletion of all profile document variations
        const profileDocsToDelete = new Set<string>();
        if (profileId) profileDocsToDelete.add(profileId);
        if (deleteModalUser.id) profileDocsToDelete.add(deleteModalUser.id);
        if (targetUid) {
          profileDocsToDelete.add(targetUid);
          profileDocsToDelete.add(`profile_${targetUid}`);
        }
        if (deleteModalUser.rawRecord?.id) profileDocsToDelete.add(deleteModalUser.rawRecord.id);

        for (const pId of Array.from(profileDocsToDelete)) {
          if (pId) {
            await deleteDoc(doc(db, 'profiles', pId)).catch((err) => logger.warn("Direct profile delete warning:", err));
          }
        }

        // 2. Direct deletion of user doc & auth references
        if (targetUid) {
          await deleteDoc(doc(db, 'users', targetUid)).catch(() => {});
          await deleteDoc(doc(db, 'users', `user_${targetUid}`)).catch(() => {});
        }
        if (deleteModalUser.id && deleteModalUser.id !== targetUid) {
          await deleteDoc(doc(db, 'users', deleteModalUser.id)).catch(() => {});
        }

        // 3. Release username reservation lock
        const uname = deleteModalUser.username || deleteModalUser.usernameNormalized;
        if (uname && uname !== 'unknown') {
          await deleteDoc(doc(db, 'usernames', uname.toLowerCase())).catch(() => {});
        }

        // 4. Deep database wipe across posts, feed_posts, notes, comments, stories, etc.
        try {
          if (targetId) {
            await purgeUser(targetId, profileId);
          }
        } catch (purgeErr) {
          logger.warn("Deep purge secondary warning:", purgeErr);
        }

        // 5. Instantly remove from Admin user table state (no page reload needed)
        setUsers(prev => prev.filter(u => 
          u.id !== deleteModalUser.id && 
          u.profileId !== profileId && 
          (!targetUid || (u.uid !== targetUid && u.id !== targetUid))
        ));

        addToast({ 
          title: 'Hard Deleted Successfully', 
          message: `Account and all data for ${deleteModalUser.displayName || deleteModalUser.username || 'user'} permanently wiped from database.`, 
          type: 'success' 
        });
      }
      setDeleteModalUser(null);
      setDeleteConfirmText('');
    } catch (e) {
      logger.error("Deletion failed:", e);
      addToast({ title: 'Error', message: 'Failed to process account deletion.', type: 'warning' });
    } finally {
      setIsExecutingDelete(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterRole === 'VERIFIED') return matchesSearch && u.isVerified;
    if (filterRole === 'ADMIN') return matchesSearch && (u.isAdmin || (u.role && u.role.toLowerCase() !== 'user'));
    if (filterRole === 'BANNED') return matchesSearch && (u.isBanned || u.status === 'BANNED' || u.status === 'SUSPENDED');
    if (filterRole === 'PREMIUM') return matchesSearch && u.creatorModeEnabled;
    return matchesSearch;
  });

  if (loading) return <div className="p-12 flex justify-center"><RefreshCw className="animate-spin text-aeirmist-cyan" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 flex-wrap md:flex-nowrap">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input 
              type="text" 
              placeholder="Search UID, username, name, email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-mono outline-none focus:border-aeirmist-cyan/50"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="h-12 px-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-mono outline-none cursor-pointer"
          >
            <option value="ALL" className="bg-black">All Statuses ({users.length})</option>
            <option value="ADMIN" className="bg-black">Admins & Staff</option>
            <option value="VERIFIED" className="bg-black">Verified Nodes</option>
            <option value="BANNED" className="bg-black">Restricted / Banned</option>
            <option value="PREMIUM" className="bg-black">Creators / Pro</option>
          </select>
          <button 
            onClick={onOpenAddAdmin}
            className="h-12 px-4 rounded-2xl bg-aeirmist-cyan/20 border border-aeirmist-cyan/40 text-aeirmist-cyan font-black text-xs uppercase tracking-wider hover:bg-aeirmist-cyan hover:text-black transition-all flex items-center gap-2 shrink-0 font-bold"
          >
            <UserPlus size={16} />
            Add Admin
          </button>
        </div>

        {selectedUserIds.length > 0 && (
          <div className="flex items-center gap-2 bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 px-4 py-2 rounded-2xl">
            <span className="text-xs font-mono font-bold text-aeirmist-cyan">{selectedUserIds.length} selected</span>
            <button 
              onClick={() => setSelectedUserIds([])}
              className="text-[10px] font-mono text-white/60 hover:text-white underline ml-2"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredUsers.map((u) => {
          const userKey = u.id || u.profileId || u.uid || '';
          const currentStatus = u.status || (u.isBanned ? 'BANNED' : 'ACTIVE');
          const currentRole = u.role || (u.isAdmin ? 'Administrator' : 'USER');
          const isSelected = Boolean(userKey && selectedUserIds.includes(userKey));
          return (
            <div key={userKey} className={`glass-panel p-5 rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${isSelected ? 'border-aeirmist-cyan/40 bg-aeirmist-cyan/[0.02]' : currentStatus !== 'ACTIVE' ? 'border-red-500/20 bg-red-500/[0.01]' : 'border-white/5 bg-white/[0.01]'}`}>
              <div className="flex items-center gap-4">
                <input 
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    if (!userKey) return;
                    if (isSelected) setSelectedUserIds(selectedUserIds.filter(id => id !== userKey));
                    else setSelectedUserIds([...selectedUserIds, userKey]);
                  }}
                  className="w-4 h-4 rounded accent-aeirmist-cyan cursor-pointer"
                />
                <img src={getAvatarUrl(u.photoURL, u.id)} alt="" className="w-12 h-12 rounded-2xl object-cover" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span 
                      onClick={() => setSelectedUserForDrawer(u)}
                      className="text-sm font-bold text-white hover:text-aeirmist-cyan cursor-pointer transition-colors"
                    >
                      {u.displayName || u.username || 'Anonymous Node'}
                    </span>
                    {u.isVerified && (
                      <span 
                        onClick={(e) => { e.stopPropagation(); setVerificationModalUser(u); }}
                        className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded font-mono border cursor-pointer hover:scale-105 transition-all ${
                          u.verificationPlan === 'essential' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                          u.verificationPlan === 'business' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          'bg-cyan-500/20 text-aeirmist-cyan border-cyan-500/30'
                        }`}
                        title="Click to manage Meta verification plan"
                      >
                        <ShieldCheck size={11} />
                        <span>{u.verificationPlan ? u.verificationPlan.toUpperCase() : 'VERIFIED'}</span>
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-white/30 px-1.5 py-0.5 rounded bg-white/5">@{u.username || 'unknown'}</span>
                    
                    {/* Role Badge */}
                    <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded font-mono ${
                      currentRole.toLowerCase() === 'owner' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      currentRole.toLowerCase().includes('admin') ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                      currentRole.toLowerCase().includes('moderator') ? 'bg-aeirmist-cyan/20 text-aeirmist-cyan border border-aeirmist-cyan/30' :
                      currentRole.toLowerCase().includes('support') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {currentRole}
                    </span>

                    <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded font-mono ${
                      currentStatus === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                      currentStatus === 'SUSPENDED' ? 'bg-amber-500/20 text-amber-400' :
                      currentStatus === 'BANNED' ? 'bg-red-500/20 text-red-400' :
                      currentStatus === 'UNDER_REVIEW' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {currentStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[9px] font-mono text-white/40 uppercase">UID: {u.uid ? `${u.uid.slice(0, 12)}...` : 'UNKNOWN'}</p>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <p className="text-[9px] font-mono text-white/40 uppercase">Level: {u.aeirmistLevel || 0} AP</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
                <button
                  onClick={() => setSelectedUserForDrawer(u)}
                  className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-wider hover:bg-white/10 transition-all flex items-center gap-1.5"
                >
                  <Eye size={12} />
                  Inspect
                </button>

                {/* Role Change Dropdown */}
                <select
                  value={currentRole}
                  onChange={(e) => {
                    const targetUid = getCanonicalUid(u);
                    const profileId = u.profileId || getProfileId(u);
                    if (!targetUid || !profileId) {
                      addToast({ title: 'Action Aborted', message: "Unable to resolve target UID or Profile ID.", type: 'warning' });
                      return;
                    }
                    updateUserRole(db, addToast, targetUid, profileId, e.target.value);
                  }}
                  className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-aeirmist-cyan text-[10px] font-mono font-bold uppercase outline-none cursor-pointer"
                  title="Assign Access Role"
                >
                  <option value="USER" className="bg-black text-white">USER</option>
                  <option value="Administrator" className="bg-black text-white">Administrator</option>
                  <option value="Super Admin" className="bg-black text-white">Super Admin</option>
                  <option value="Moderator" className="bg-black text-white">Moderator</option>
                  <option value="Marketplace Moderator" className="bg-black text-white">Marketplace Moderator</option>
                  <option value="Support" className="bg-black text-white">Support</option>
                  <option value="Owner" className="bg-black text-white">Owner</option>
                </select>

                <select
                  value={currentStatus}
                  onChange={(e) => {
                    const val = e.target.value;
                    const targetUid = getCanonicalUid(u);
                    if (!targetUid) {
                      addToast({ title: 'Action Aborted', message: "Unable to resolve target UID.", type: 'warning' });
                      return;
                    }
                    if (val === 'SUSPENDED') setSuspendingUser(u);
                    else updateUserStatus(targetUid, val);
                  }}
                  className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer"
                >
                  <option value="ACTIVE" className="bg-black text-white">ACTIVE</option>
                  <option value="SUSPENDED" className="bg-black text-amber-400">SUSPENDED</option>
                  <option value="BANNED" className="bg-black text-red-400">BANNED</option>
                  <option value="UNDER_REVIEW" className="bg-black text-purple-400">UNDER REVIEW</option>
                </select>

                <button
                  onClick={() => setVerificationModalUser(u)}
                  className={`h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer ${
                    u.isVerified 
                      ? 'bg-aeirmist-cyan/20 text-aeirmist-cyan hover:bg-aeirmist-cyan/30 border border-aeirmist-cyan/30' 
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Click to configure Meta-Style verification plan"
                >
                  <ShieldCheck size={12} className={u.isVerified ? 'text-aeirmist-cyan' : 'opacity-60'} />
                  <span>{u.isVerified ? 'VERIFIED' : 'VERIFY'}</span>
                </button>

                <button
                  onClick={() => {
                    setDeleteModalUser(u);
                    setDeleteConfirmText('');
                    setDeleteType('hard');
                  }}
                  className="h-9 w-9 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-all cursor-pointer"
                  title="Advanced Delete System"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Side Drawer for User Admin View */}
      <AnimatePresence>
        {selectedUserForDrawer && (
          <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex justify-end">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-xl h-full bg-[#080a0f] border-l border-white/10 p-6 md:p-8 overflow-y-auto space-y-6 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-5 border-b border-white/10">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative">
                    <img 
                      src={getAvatarUrl(selectedUserForDrawer.photoURL, selectedUserForDrawer.id)} 
                      alt="" 
                      className="w-14 h-14 rounded-2xl object-cover border border-white/10" 
                    />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#080a0f] ${
                      selectedUserForDrawer.isBanned || selectedUserForDrawer.status === 'BANNED' ? 'bg-red-500' :
                      selectedUserForDrawer.status === 'SUSPENDED' ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white truncate">
                        {selectedUserForDrawer.displayName || selectedUserForDrawer.username}
                      </h3>
                      {selectedUserForDrawer.isVerified && (
                        <ShieldCheck className="text-aeirmist-cyan shrink-0" size={16} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-white/50 mt-0.5">
                      <span>@{selectedUserForDrawer.username || 'no_handle'}</span>
                      <span>•</span>
                      <span className="text-[10px] text-aeirmist-cyan font-bold">UID: {selectedUserForDrawer.uid || selectedUserForDrawer.id || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedUserForDrawer(null)}
                  className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Facebook/Instagram Style Key User Overview Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 block mb-1">Status</span>
                    <span className={`text-xs font-bold font-mono uppercase ${
                      selectedUserForDrawer.isBanned || selectedUserForDrawer.status === 'BANNED' ? 'text-red-400' :
                      selectedUserForDrawer.status === 'SUSPENDED' ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {selectedUserForDrawer.status || (selectedUserForDrawer.isBanned ? 'BANNED' : 'ACTIVE')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 block mb-1">Account Role</span>
                    <span className="text-xs font-bold font-mono text-aeirmist-cyan uppercase">
                      {selectedUserForDrawer.role || (selectedUserForDrawer.isAdmin ? 'Admin' : 'User')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 block mb-1">Verification</span>
                    <span className={`text-xs font-bold font-mono ${selectedUserForDrawer.isVerified ? 'text-aeirmist-cyan' : 'text-white/40'}`}>
                      {selectedUserForDrawer.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
                    </span>
                  </div>
                </div>

                {/* Account Details & Metadata Section (Date & Time Subsection included) */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white/80 flex items-center gap-2">
                      <User size={15} className="text-aeirmist-cyan" /> Account Information & Metadata
                    </h4>
                    <span className="text-[10px] font-mono text-white/40">Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1 p-3 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Email Address</span>
                      <span className="font-mono text-white/90 break-all select-all">{selectedUserForDrawer.email || 'Not provided'}</span>
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block flex items-center gap-1">
                        <Clock size={11} className="text-aeirmist-cyan" /> Account Created Date & Time
                      </span>
                      <span className="font-mono text-aeirmist-cyan font-bold block select-all">
                        {formatAccountCreationDate(selectedUserForDrawer)}
                      </span>
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block flex items-center gap-1">
                        <MapPin size={11} className="text-aeirmist-cyan" /> ID Create Location
                      </span>
                      <span className="font-mono text-white/90 block select-all">
                        {selectedUserForDrawer.createdLocation || selectedUserForDrawer.signupLocation || 'Not recorded'}
                      </span>
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block flex items-center gap-1">
                        <MapPin size={11} className="text-aeirmist-magenta" /> Last Login Location
                      </span>
                      <span className="font-mono text-white/90 block select-all">
                        {selectedUserForDrawer.lastLoginLocation || selectedUserForDrawer.loginLocation || 'Not recorded'}
                      </span>
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block flex items-center gap-1">
                        <Activity size={11} className="text-emerald-400" /> Active Device Location
                      </span>
                      <span className="font-mono text-emerald-400 font-bold block select-all">
                        {selectedUserForDrawer.deviceActiveLocation || selectedUserForDrawer.activeLocation || selectedUserForDrawer.location || 'Online Node'}
                      </span>
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-black/30 border border-white/5">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block flex items-center gap-1">
                        <Smartphone size={11} className="text-violet-400" /> Active Device / Platform
                      </span>
                      <span className="font-mono text-white/90 block select-all">
                        {selectedUserForDrawer.deviceInfo || selectedUserForDrawer.platform || 'Web / Capacitor'}
                      </span>
                    </div>

                    <div className="space-y-1 p-3 rounded-xl bg-black/30 border border-white/5 sm:col-span-2">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Bio</span>
                      <span className="text-white/80 leading-relaxed block">{selectedUserForDrawer.bio || 'No bio provided.'}</span>
                    </div>
                  </div>

                  {/* Activity Stats */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5 text-center">
                    <div className="p-2 rounded-xl bg-black/20">
                      <span className="text-[9px] text-white/40 uppercase block">Level</span>
                      <span className="text-xs font-bold font-mono text-white">{selectedUserForDrawer.aeirmistLevel || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/20">
                      <span className="text-[9px] text-white/40 uppercase block">Posts</span>
                      <span className="text-xs font-bold font-mono text-white">{selectedUserForDrawer.postsCount || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/20">
                      <span className="text-[9px] text-white/40 uppercase block">Followers</span>
                      <span className="text-xs font-bold font-mono text-white">{Array.isArray(selectedUserForDrawer.followers) ? selectedUserForDrawer.followers.length : (selectedUserForDrawer.followersCount || 0)}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/20">
                      <span className="text-[9px] text-white/40 uppercase block">Following</span>
                      <span className="text-xs font-bold font-mono text-white">{Array.isArray(selectedUserForDrawer.following) ? selectedUserForDrawer.following.length : (selectedUserForDrawer.followingCount || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Reports & Moderation Details Subsection (Instagram / Facebook Moderation Tool Style) */}
                <div className="p-5 rounded-2xl bg-amber-500/[0.02] border border-amber-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <Flag size={15} /> Reports & Moderation History
                    </h4>
                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      userReports.length > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {userReports.length > 0 ? `${userReports.length} Reports Filed` : 'Clean Record'}
                    </span>
                  </div>

                  {loadingUserReports ? (
                    <div className="py-4 text-center text-xs font-mono text-white/40 animate-pulse flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-amber-400" />
                      Loading report history...
                    </div>
                  ) : userReports.length === 0 ? (
                    <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 text-center text-xs text-white/50 space-y-1">
                      <p className="font-bold text-emerald-400 text-xs">No Safety Reports Found</p>
                      <p className="text-[10px] text-white/40">No user or content reports have been filed against @{selectedUserForDrawer.username || 'this user'}.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                      {userReports.map((rep: any) => (
                        <div key={rep.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-300 uppercase text-[10px] tracking-wider px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              {rep.category || rep.reason || 'General Violation'}
                            </span>
                            <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                              rep.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' :
                              rep.status === 'dismissed' ? 'bg-zinc-500/20 text-zinc-400' :
                              'bg-red-500/20 text-red-400 animate-pulse'
                            }`}>
                              {rep.status || 'Pending'}
                            </span>
                          </div>
                          {rep.details && (
                            <p className="text-white/70 text-[11px] leading-snug">{rep.details}</p>
                          )}
                          <div className="flex items-center justify-between text-[9px] font-mono text-white/40 pt-1 border-t border-white/5">
                            <span>Reporter: {rep.reporterUsername ? `@${rep.reporterUsername}` : 'Anonymous'}</span>
                            <span>{rep.createdAt ? formatAccountCreationDate({ createdAt: rep.createdAt }) : 'Recently'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* System Role & Access Permissions */}
                <div className="p-5 rounded-2xl bg-aeirmist-cyan/[0.03] border border-aeirmist-cyan/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-aeirmist-cyan flex items-center gap-2">
                      <Key size={15} /> Account Role & Permissions
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-aeirmist-cyan/20 text-aeirmist-cyan uppercase font-bold">
                      {selectedUserForDrawer.role || 'USER'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedUserForDrawer.role || 'USER'}
                      onChange={(e) => {
                        const newR = e.target.value;
                        const targetUid = getCanonicalUid(selectedUserForDrawer);
                        const profileId = selectedUserForDrawer.profileId || getProfileId(selectedUserForDrawer);
                        if (!targetUid || !profileId) {
                          addToast({ title: 'Action Aborted', message: "Unable to resolve target UID or Profile ID.", type: 'warning' });
                          return;
                        }
                        updateUserRole(db, addToast, targetUid, profileId, newR);
                        setSelectedUserForDrawer({ ...selectedUserForDrawer, role: newR });
                      }}
                      className="flex-1 h-11 px-4 rounded-xl bg-black/60 border border-white/10 text-white text-xs font-mono font-bold uppercase outline-none cursor-pointer focus:border-aeirmist-cyan/50"
                    >
                      <option value="USER" className="bg-black text-white">USER (Standard User)</option>
                      <option value="Administrator" className="bg-black text-white">Administrator (Full Access Control)</option>
                      <option value="Super Admin" className="bg-black text-white">Super Admin (System Root)</option>
                      <option value="Moderator" className="bg-black text-white">Moderator (Bans & Content Rules)</option>
                      <option value="Marketplace Moderator" className="bg-black text-white">Marketplace Moderator (Escrow & Vendors)</option>
                      <option value="Support" className="bg-black text-white">Support (Verifications & Tickets)</option>
                      <option value="Owner" className="bg-black text-white">Owner (Primary Owner)</option>
                    </select>
                  </div>
                </div>

                {/* Quick Smart Actions */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/60">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button 
                      onClick={() => { setSuspendingUser(selectedUserForDrawer); setSelectedUserForDrawer(null); }}
                      className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider hover:bg-amber-500/20 transition-all text-left flex items-center justify-between"
                    >
                      <span>Suspend User...</span>
                      <Clock size={14} />
                    </button>

                    <button 
                      onClick={() => {
                        const targetUid = getCanonicalUid(selectedUserForDrawer);
                        if (!targetUid) {
                          addToast({ title: 'Action Aborted', message: "Unable to resolve target UID.", type: 'warning' });
                          return;
                        }
                        toggleUserBan(targetUid, !selectedUserForDrawer.isBanned);
                      }}
                      className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/20 transition-all text-left flex items-center justify-between"
                    >
                      <span>{selectedUserForDrawer.isBanned ? 'Unban User' : 'Ban User'}</span>
                      <UserX size={14} />
                    </button>

                    <button 
                      onClick={() => {
                        setVerificationModalUser(selectedUserForDrawer);
                      }}
                      className="p-3.5 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 text-aeirmist-cyan text-xs font-bold uppercase tracking-wider hover:bg-aeirmist-cyan/20 transition-all text-left flex items-center justify-between cursor-pointer"
                    >
                      <span>{selectedUserForDrawer.isVerified ? 'Manage Verification Plan' : 'Verify Account (Choose Plan)'}</span>
                      <ShieldCheck size={14} />
                    </button>

                    <button 
                      onClick={() => { setDeleteModalUser(selectedUserForDrawer); setSelectedUserForDrawer(null); }}
                      className="p-3.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/30 transition-all text-left flex items-center justify-between"
                    >
                      <span>Delete Account...</span>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Admin Security & Session Control */}
                <div className="p-5 rounded-2xl bg-red-500/[0.03] border border-red-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
                      <Shield size={15} /> Security & Session Control
                    </h4>
                    <span className="text-[10px] font-mono text-white/40">Audit Monitored</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={async () => {
                        const targetUid = getCanonicalUid(selectedUserForDrawer);
                        if (!targetUid) {
                          addToast({ title: 'Action Aborted', message: "Unable to resolve target UID for session revocation.", type: 'warning' });
                          return;
                        }
                        try {
                          const q = query(collection(db, 'login_sessions'), where('userId', '==', targetUid));
                          const snap = await getDocs(q);
                          for (const d of snap.docs) {
                            await updateDoc(doc(db, 'login_sessions', d.id), { revoked: true, revokedAt: serverTimestamp() });
                          }
                          await addDoc(collection(db, 'audit_logs'), {
                            action: 'FORCE_LOGOUT_ALL_SESSIONS',
                            targetUser: selectedUserForDrawer.id,
                            timestamp: serverTimestamp()
                          });
                          addToast({ title: 'Admin Override', message: `Revoked all active sessions for ${selectedUserForDrawer.displayName || selectedUserForDrawer.username}.`, type: 'success' });
                        } catch (err) {
                          addToast({ title: 'Error', message: 'Failed to revoke user sessions.', type: 'warning' });
                        }
                      }}
                      className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/20 transition-all text-left flex items-center justify-between cursor-pointer"
                    >
                      <span>Force Logout All Active Sessions</span>
                      <LogOut size={14} />
                    </button>

                    {selectedUserForDrawer.email && (
                      <button 
                        onClick={async () => {
                          try {
                            await sendPasswordResetEmail(auth, selectedUserForDrawer.email);
                            await addDoc(collection(db, 'audit_logs'), {
                              action: 'ADMIN_TRIGGERED_PASSWORD_RESET',
                              targetUser: selectedUserForDrawer.id,
                              targetEmail: selectedUserForDrawer.email,
                              timestamp: serverTimestamp()
                            });
                            addToast({ title: 'Password Reset Sent', message: `Dispatched reset email to ${selectedUserForDrawer.email}.`, type: 'success' });
                          } catch (err: any) {
                            addToast({ title: 'Error', message: 'Failed to trigger password reset.', type: 'warning' });
                          }
                        }}
                        className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider hover:bg-amber-500/20 transition-all text-left flex items-center justify-between cursor-pointer"
                      >
                        <span>Send Password Reset Email</span>
                        <Key size={14} />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete / Anonymize Modal */}
      <AnimatePresence>
        {deleteModalUser && (
          <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-panel p-8 rounded-[32px] border-red-500/30 bg-[#0a0d14] space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                    <Trash2 size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Advanced Delete System</h3>
                    <p className="text-[10px] font-mono text-red-400">
                      Target: <span className="font-bold text-white">{deleteModalUser.displayName || deleteModalUser.username || 'User'}</span> (@{deleteModalUser.username || deleteModalUser.uid?.slice(0, 10) || deleteModalUser.id?.slice(0, 10) || 'unknown'})
                    </p>
                  </div>
                </div>
                <button onClick={() => !isExecutingDelete && setDeleteModalUser(null)} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Deletion Strategy</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => !isExecutingDelete && setDeleteType('soft')}
                      className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${deleteType === 'soft' ? 'bg-aeirmist-cyan text-black border-aeirmist-cyan' : 'bg-white/5 text-white/60 border-white/10'}`}
                    >
                      Soft Delete
                    </button>
                    <button 
                      onClick={() => !isExecutingDelete && setDeleteType('hard')}
                      className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${deleteType === 'hard' ? 'bg-red-500 text-white border-red-500' : 'bg-white/5 text-white/60 border-white/10'}`}
                    >
                      Hard Delete
                    </button>
                    <button 
                      onClick={() => !isExecutingDelete && setDeleteType('anonymize')}
                      className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${deleteType === 'anonymize' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white/5 text-white/60 border-white/10'}`}
                    >
                      Anonymize
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-white/40 mt-1">
                    {deleteType === 'soft' && 'Recoverable at any time. Marks account as deleted.'}
                    {deleteType === 'hard' && 'Permanently wipes profile, posts, stories, chats, marketplace, tokens.'}
                    {deleteType === 'anonymize' && 'Removes personal data. Profile becomes "Aeirmist User" with posts intact.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-red-400">Type DELETE to confirm action</label>
                  <input 
                    type="text"
                    disabled={isExecutingDelete}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-mono outline-none focus:border-red-500/50 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => !isExecutingDelete && setDeleteModalUser(null)} 
                  disabled={isExecutingDelete}
                  className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-black uppercase tracking-widest hover:text-white disabled:opacity-40"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleExecuteDelete}
                  disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || isExecutingDelete}
                  className="flex-1 h-12 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest hover:bg-red-400 disabled:opacity-30 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                  {isExecutingDelete ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Erasing Everything...</span>
                    </>
                  ) : (
                    <span>Execute</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Meta-Style Verification Plan Modal */}
      <VerificationPlanModal
        isOpen={Boolean(verificationModalUser)}
        onClose={() => setVerificationModalUser(null)}
        user={verificationModalUser}
        onApplyPlan={async (plan, durationDays) => {
          const profileId = verificationModalUser.profileId || getProfileId(verificationModalUser) || verificationModalUser.id;
          const targetUid = getCanonicalUid(verificationModalUser) || verificationModalUser.uid || verificationModalUser.id;
          await toggleVerification(profileId, true, plan, durationDays, targetUid);
          setVerificationModalUser(null);
        }}
        onRevoke={async () => {
          const profileId = verificationModalUser.profileId || getProfileId(verificationModalUser) || verificationModalUser.id;
          const targetUid = getCanonicalUid(verificationModalUser) || verificationModalUser.uid || verificationModalUser.id;
          await toggleVerification(profileId, false, undefined, undefined, targetUid);
          setVerificationModalUser(null);
        }}
        onExtend={async (days) => {
          const profileId = verificationModalUser.profileId || getProfileId(verificationModalUser) || verificationModalUser.id;
          const targetUid = getCanonicalUid(verificationModalUser) || verificationModalUser.uid || verificationModalUser.id;
          const plan = verificationModalUser.verificationPlan || 'creator';
          await toggleVerification(profileId, true, plan, days, targetUid);
          setVerificationModalUser(null);
        }}
      />
    </div>
  );
};

import {

ReportsManagementTab } from './ReportsManagementTab';

const AppealsTab = ({ db, addToast }: { db: any; addToast: any }) => {
  const [appeals, setAppeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'appeals'), orderBy('timestamp', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      setAppeals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      logger.warn("Appeals list error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  const handleResolveAppeal = async (appealId: string, status: 'approved' | 'rejected') => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'appeals', appealId), { status });
      addToast({ title: 'Appeal Updated', message: `Appeal marked as ${status}.`, type: 'success' });
    } catch (e) {
      logger.error("Failed to update appeal:", e);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><RefreshCw className="animate-spin text-aeirmist-cyan" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-black uppercase tracking-widest text-white">Account Appeals Center</h2>
        <p className="text-[10px] font-mono text-white/40">Review restriction appeals submitted by suspended or banned users.</p>
      </div>

      <div className="space-y-3">
        {appeals.map((a) => (
          <div key={a.id} className="glass-panel p-6 rounded-3xl border-white/5 bg-white/[0.01] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <span className="text-xs font-bold text-white">@{a.username || 'Unknown User'}</span>
                  <p className="text-[10px] font-mono text-white/40">User ID: {a.userId}</p>
                </div>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded font-mono ${
                a.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                a.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {a.status || 'Pending'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs font-mono text-white/80">
              <span className="text-white/40 uppercase font-bold text-[9px] block mb-1">Appeal Reason:</span>
              {a.reason}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleResolveAppeal(a.id, 'rejected')}
                className="h-9 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
              >
                Reject
              </button>
              <button
                onClick={() => handleResolveAppeal(a.id, 'approved')}
                className="h-9 px-4 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all"
              >
                Approve & Restore
              </button>
            </div>
          </div>
        ))}
        {appeals.length === 0 && (
          <div className="text-center py-20 opacity-30">
            <ShieldCheck size={48} className="mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">No pending appeals</p>
          </div>
        )}
      </div>
    </div>
  );
};

const MarketplacePaymentsTab = ({ db }: { db: any }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-base font-black uppercase tracking-widest text-white">Marketplace & Subscriptions Center</h2>
      <p className="text-[10px] font-mono text-white/40">Manage vendor stores, dispute resolution, refund requests, and recurring subscription tiers.</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="glass-panel p-6 rounded-3xl border-white/5 bg-white/[0.01] space-y-2">
        <ShoppingBag className="text-aeirmist-cyan mb-2" size={24} />
        <h3 className="text-sm font-bold text-white">Active Stores</h3>
        <p className="text-2xl font-mono font-bold text-white">—</p>
        <p className="text-[10px] font-mono text-aeirmist-cyan">Awaiting data</p>
      </div>
      <div className="glass-panel p-6 rounded-3xl border-white/5 bg-white/[0.01] space-y-2">
        <CreditCard className="text-purple-400 mb-2" size={24} />
        <h3 className="text-sm font-bold text-white">Pro Subscriptions</h3>
        <p className="text-2xl font-mono font-bold text-white">—</p>
        <p className="text-[10px] font-mono text-purple-400">Awaiting data</p>
      </div>
      <div className="glass-panel p-6 rounded-3xl border-white/5 bg-white/[0.01] space-y-2">
        <DollarSign className="text-emerald-400 mb-2" size={24} />
        <h3 className="text-sm font-bold text-white">Escrow Volume</h3>
        <p className="text-2xl font-mono font-bold text-white">—</p>
        <p className="text-[10px] font-mono text-emerald-400">Awaiting data</p>
      </div>
    </div>
  </div>
);

const SecurityCenterTab = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-base font-black uppercase tracking-widest text-white">Enterprise Security Center</h2>
      <p className="text-[10px] font-mono text-white/40">Advanced threat detection, bot mitigation, VPN flagging, and automated security policies.</p>
    </div>
    <div className="space-y-3">
      <div className="glass-panel p-5 rounded-3xl border-white/5 bg-white/[0.01] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-white">AI Bot & Spam Firewall</span>
            <p className="text-[10px] font-mono text-emerald-400">Active • Blocking heuristic anomalies</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl">PROTECTED</span>
      </div>
      <div className="glass-panel p-5 rounded-3xl border-white/5 bg-white/[0.01] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 flex items-center justify-center text-aeirmist-cyan">
            <Key size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-white">Mandatory Two-Factor Enforcement</span>
            <p className="text-[10px] font-mono text-white/60">Enforced for all admin and creator accounts</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold text-aeirmist-cyan bg-aeirmist-cyan/10 px-3 py-1.5 rounded-xl">ENABLED</span>
      </div>
    </div>
  </div>
);

export const updateUserRole = async (db: any, addToast: any, targetUid: string, targetProfileId: string, newRole: string) => {
  if (!db) return;
  try {
    const roleUpper = newRole.toUpperCase();
    const isAdminRole = ['OWNER', 'SUPER ADMIN', 'SUPER_ADMIN', 'ADMINISTRATOR', 'ADMIN', 'MODERATOR', 'MARKETPLACE MODERATOR', 'SUPPORT'].includes(roleUpper);

    if (targetProfileId) {
      await updateDoc(doc(db, 'profiles', targetProfileId), {
        role: newRole,
        isAdmin: isAdminRole,
        updatedAt: serverTimestamp()
      }).catch(() => {});
    }

    if (targetUid) {
      await updateDoc(doc(db, 'users', targetUid), {
        role: newRole,
        isAdmin: isAdminRole,
        updatedAt: serverTimestamp()
      }).catch(() => {});

      if (isAdminRole) {
        await setDoc(doc(db, 'admins', targetUid), {
          uid: targetUid,
          profileId: targetProfileId || targetUid,
          role: newRole,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await deleteDoc(doc(db, 'admins', targetUid)).catch(() => {});
      }
    }

    logger.security("User Role Updated", { targetUid, targetProfileId, newRole }); if (addToast) {
      addToast({
        title: 'Role & Access Granted',
        message: `User permissions updated to ${newRole}.`,
        type: 'success'
      });
    }
  } catch (e) {
    logger.error("Failed to update user role:", e);
    if (addToast) {
      addToast({
        title: 'Action Failed',
        message: 'Could not update user access role.',
        type: 'warning'
      });
    }
  }
};

const CustomPolicyModal = ({ policy, onClose, onSave }: { policy: any; onClose: () => void; onSave: (p: any) => void }) => {
  const [perms, setPerms] = useState({ ...policy.permissions });

  const toggle = (key: string) => {
    setPerms({ ...perms, [key]: !perms[key] });
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md glass-panel p-6 rounded-[32px] border-aeirmist-cyan/30 bg-[#0a0d14] space-y-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Configure Policy: {policy.name}</h3>
            <p className="text-[10px] font-mono text-white/40">Toggle granular capabilities for this role</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2">
          {Object.entries(perms).map(([key, val]) => (
            <div 
              key={key} 
              onClick={() => toggle(key)}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                val ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-white' : 'bg-white/[0.02] border-white/5 text-white/40'
              }`}
            >
              <span className="text-xs font-mono font-bold uppercase">
                {key.replace(/^can/, 'Can ').replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                val ? 'bg-aeirmist-cyan border-aeirmist-cyan text-black' : 'border-white/20'
              }`}>
                {val && <Check size={12} />}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-black uppercase tracking-widest hover:text-white">
            Cancel
          </button>
          <button 
            onClick={() => onSave({ ...policy, permissions: perms })}
            className="flex-1 h-11 rounded-xl bg-aeirmist-cyan text-black text-xs font-black uppercase tracking-widest hover:bg-white transition-all font-bold"
          >
            Save Policy
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const AddAdminModal = ({ isOpen, onClose, db, addToast, allUsers }: { isOpen: boolean; onClose: () => void; db: any; addToast: any; allUsers: any[] }) => {
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('Administrator');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = (allUsers || []).filter(u => 
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.id?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5);

  const handleGrant = async () => {
    setIsSubmitting(true);
    try {
      if (selectedUser) {
        const targetUid = getCanonicalUid(selectedUser);
        const profileId = selectedUser.profileId || getProfileId(selectedUser);
        if (!targetUid || !profileId) {
          addToast({ title: 'Action Aborted', message: "Unable to resolve target account ID.", type: 'warning' });
          return;
        }
        await updateUserRole(db, addToast, targetUid, profileId, selectedRole);
      } else if (customEmail.trim()) {
        const q = query(collection(db, 'profiles'), where('email', '==', customEmail.trim().toLowerCase()), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const matchedDoc = snap.docs[0];
          const matchedData = matchedDoc.data();
          const targetUid = getCanonicalUid({ ...matchedData, id: matchedDoc.id });
          const profileId = matchedDoc.id;
          if (!targetUid) {
            addToast({ title: 'Action Aborted', message: "Unable to resolve target account ID.", type: 'warning' });
            return;
          }
          await updateUserRole(db, addToast, targetUid, profileId, selectedRole);
        } else {
          const adminId = `admin_${Date.now()}`;
          await setDoc(doc(db, 'admins', adminId), {
            email: customEmail.trim().toLowerCase(),
            role: selectedRole,
            assignedAt: serverTimestamp(),
            status: 'PENDING_REGISTRATION'
          });
          addToast({ title: 'Admin Reserved', message: `Role ${selectedRole} reserved for ${customEmail.trim()}`, type: 'success' });
        }
      }
      onClose();
    } catch (e) {
      logger.error("Grant failed:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg glass-panel p-6 md:p-8 rounded-[32px] border-aeirmist-cyan/30 bg-[#0a0d14] space-y-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aeirmist-cyan/20 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Register / Grant Admin Access</h3>
              <p className="text-[10px] font-mono text-white/40">Assign enterprise management roles and permissions</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/60">1. Select Target User or Enter Email</label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input 
              type="text" 
              placeholder="Search user by username, email, name, or UID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedUser(null);
                setCustomEmail(e.target.value);
              }}
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-mono outline-none focus:border-aeirmist-cyan/50"
            />
          </div>

          {search && !selectedUser && filtered.length > 0 && (
            <div className="p-2 rounded-2xl bg-black/60 border border-white/10 space-y-1 max-h-40 overflow-y-auto">
              {filtered.map(u => (
                <div 
                  key={u.id}
                  onClick={() => {
                    setSelectedUser(u);
                    setSearch(`${u.displayName || u.username} (@${u.username})`);
                  }}
                  className="p-2.5 rounded-xl hover:bg-white/10 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <img src={getAvatarUrl(u.photoURL, u.id)} className="w-7 h-7 rounded-lg object-cover" />
                    <div>
                      <span className="text-xs font-bold text-white block">{u.displayName || u.username}</span>
                      <span className="text-[9px] font-mono text-white/40">@{u.username} • {u.email || 'No Email'}</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-aeirmist-cyan/20 text-aeirmist-cyan uppercase">Select</span>
                </div>
              ))}
            </div>
          )}

          {selectedUser && (
            <div className="p-3 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src={getAvatarUrl(selectedUser.photoURL, selectedUser.id)} className="w-8 h-8 rounded-lg object-cover" />
                <div>
                  <span className="text-xs font-bold text-white">{selectedUser.displayName || selectedUser.username}</span>
                  <p className="text-[9px] font-mono text-aeirmist-cyan">Current Role: {selectedUser.role || 'USER'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-[10px] text-white/40 hover:text-white underline font-mono">Change</button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/60">2. Assign Access Role Level</label>
          <select 
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs font-mono outline-none cursor-pointer focus:border-aeirmist-cyan/50"
          >
            <option value="Administrator" className="bg-black text-white">Administrator (Full Access Control)</option>
            <option value="Super Admin" className="bg-black text-white">Super Admin (System Root)</option>
            <option value="Moderator" className="bg-black text-white">Moderator (Bans & Content Rules)</option>
            <option value="Marketplace Moderator" className="bg-black text-white">Marketplace Moderator (Escrow & Vendors)</option>
            <option value="Support" className="bg-black text-white">Support (Verifications & Tickets)</option>
            <option value="Owner" className="bg-black text-white">Owner (Primary Owner)</option>
          </select>
        </div>

        <div className="pt-2 flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-black uppercase tracking-widest hover:text-white transition-all">
            Cancel
          </button>
          <button 
            onClick={handleGrant}
            disabled={isSubmitting || (!selectedUser && !customEmail.trim())}
            className="flex-1 h-11 rounded-xl bg-aeirmist-cyan text-black text-xs font-black uppercase tracking-widest hover:bg-white disabled:opacity-30 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle size={14} />}
            Grant Access
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const RolesPermissionsTab = ({ db, addToast, onOpenAddAdmin }: { db: any; addToast: any; onOpenAddAdmin: () => void }) => {
  const [editingPolicy, setEditingPolicy] = useState<any | null>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  const [policies, setPolicies] = useState<any[]>([
    {
      id: 'owner',
      name: 'Owner',
      description: 'Root system ownership with full privileges across all infrastructure.',
      permissions: { canBan: true, canSuspend: true, canDelete: true, canVerify: true, canRefund: true, canManageRoles: true, accessControl: true, manageFlags: true }
    },
    {
      id: 'super_admin',
      name: 'Super Admin',
      description: 'Enterprise administration and full control center access.',
      permissions: { canBan: true, canSuspend: true, canDelete: true, canVerify: true, canRefund: true, canManageRoles: true, accessControl: true, manageFlags: true }
    },
    {
      id: 'administrator',
      name: 'Administrator',
      description: 'User management, suspension, bans, and verifications.',
      permissions: { canBan: true, canSuspend: true, canDelete: false, canVerify: true, canRefund: true, canManageRoles: false, accessControl: true, manageFlags: false }
    },
    {
      id: 'moderator',
      name: 'Moderator',
      description: 'Community moderation and content rule enforcement.',
      permissions: { canBan: true, canSuspend: true, canDelete: false, canVerify: true, canRefund: false, canManageRoles: false, accessControl: true, manageFlags: false }
    },
    {
      id: 'marketplace_moderator',
      name: 'Marketplace Moderator',
      description: 'Vendor disputes, refunds, and store verifications.',
      permissions: { canBan: false, canSuspend: true, canDelete: false, canVerify: true, canRefund: true, canManageRoles: false, accessControl: true, manageFlags: false }
    },
    {
      id: 'support',
      name: 'Support',
      description: 'User support, verification requests, and account assistance.',
      permissions: { canBan: false, canSuspend: true, canDelete: false, canVerify: true, canRefund: false, canManageRoles: false, accessControl: true, manageFlags: false }
    }
  ]);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'profiles'), (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((u: any) => u.isAdmin || (u.role && u.role.toLowerCase() !== 'user'));
      setAdminUsers(list);
      setLoadingAdmins(false);
    }, (err) => {
      logger.warn("Admin profiles error:", err);
      setLoadingAdmins(false);
    });
    return () => unsub();
  }, [db]);

  const handleSavePolicy = async (updatedPolicy: any) => {
    setPolicies(policies.map(p => p.id === updatedPolicy.id ? updatedPolicy : p));
    if (db) {
      await setDoc(doc(db, 'role_policies', updatedPolicy.id), updatedPolicy, { merge: true }).catch(() => {});
    }
    addToast({ title: 'Policy Saved', message: `Permissions for ${updatedPolicy.name} updated.`, type: 'success' });
    setEditingPolicy(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Key className="text-aeirmist-cyan" size={18} />
            Roles & Granular Permissions
          </h2>
          <p className="text-[10px] font-mono text-white/40">Configure access control policies, permissions, and register enterprise staff administrators.</p>
        </div>
        <button 
          onClick={onOpenAddAdmin}
          className="h-11 px-5 rounded-2xl bg-aeirmist-cyan text-black font-black text-xs uppercase tracking-widest hover:bg-white shadow-lg shadow-aeirmist-cyan/20 transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <UserPlus size={16} />
          Register / Add Admin
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {policies.map((p) => (
          <div key={p.id} className="glass-panel p-6 rounded-3xl border-white/5 bg-white/[0.01] space-y-4 flex flex-col justify-between hover:border-aeirmist-cyan/30 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{p.name}</span>
                <button 
                  onClick={() => setEditingPolicy(p)}
                  className="text-[9px] font-mono px-2.5 py-1 rounded bg-aeirmist-cyan/10 text-aeirmist-cyan uppercase hover:bg-aeirmist-cyan/20 transition-all flex items-center gap-1 font-bold"
                >
                  <Edit3 size={10} />
                  Custom Policy
                </button>
              </div>
              <p className="text-[10px] font-mono text-white/40 leading-relaxed">{p.description}</p>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
              {Object.entries(p.permissions).map(([permKey, enabled]) => enabled ? (
                <span key={permKey} className="text-[9px] font-mono px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ✓ {permKey.replace(/^can/, 'Can ').replace(/([A-Z])/g, ' $1').trim()}
                </span>
              ) : null)}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <ShieldCheck className="text-aeirmist-cyan shrink-0" size={16} />
              Active Admin & Moderation Staff ({adminUsers.length})
            </h3>
            <p className="text-[10px] font-mono text-white/40">Users currently granted elevated access permissions across the system.</p>
          </div>
          <button 
            onClick={onOpenAddAdmin}
            className="text-[10px] font-mono text-aeirmist-cyan hover:underline flex items-center gap-1 font-bold"
          >
            <Plus size={12} /> Add Staff Node
          </button>
        </div>

        <div className="space-y-3">
          {adminUsers.map((u) => (
            <div key={u.id} className="glass-panel p-4 rounded-2xl border-white/5 bg-white/[0.01] flex items-center justify-between gap-4 flex-wrap md:flex-nowrap">
              <div className="flex items-center gap-3">
                <img src={getAvatarUrl(u.photoURL, u.id)} className="w-10 h-10 rounded-xl object-cover" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{u.displayName || u.username}</span>
                    <span className="text-[9px] font-mono text-white/40">@{u.username}</span>
                    {u.isVerified && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />}
                  </div>
                  <p className="text-[9px] font-mono text-white/40">UID: {u.uid || 'UNKNOWN'} • Email: {u.email || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-auto">
                <select 
                  value={u.role || 'Administrator'}
                  onChange={(e) => {
                    const targetUid = getCanonicalUid(u);
                    const profileId = u.profileId || getProfileId(u);
                    if (!targetUid || !profileId) {
                      addToast({ title: 'Action Aborted', message: "Unable to resolve target account ID.", type: 'warning' });
                      return;
                    }
                    updateUserRole(db, addToast, targetUid, profileId, e.target.value);
                  }}
                  className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-aeirmist-cyan text-[10px] font-mono font-bold uppercase outline-none cursor-pointer"
                >
                  <option value="Owner" className="bg-black text-white">Owner</option>
                  <option value="Super Admin" className="bg-black text-white">Super Admin</option>
                  <option value="Administrator" className="bg-black text-white">Administrator</option>
                  <option value="Moderator" className="bg-black text-white">Moderator</option>
                  <option value="Marketplace Moderator" className="bg-black text-white">Marketplace Moderator</option>
                  <option value="Support" className="bg-black text-white">Support</option>
                  <option value="USER" className="bg-black text-red-400">Revoke Access (USER)</option>
                </select>

                <button 
                  onClick={() => {
                    const targetUid = getCanonicalUid(u);
                    const profileId = u.profileId || getProfileId(u);
                    if (!targetUid || !profileId) {
                      addToast({ title: 'Action Aborted', message: "Unable to resolve target account ID.", type: 'warning' });
                      return;
                    }
                    updateUserRole(db, addToast, targetUid, profileId, 'USER');
                  }}
                  className="h-9 px-3 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-mono font-bold uppercase hover:bg-red-500/20 transition-all"
                  title="Revoke Admin Access"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}

          {adminUsers.length === 0 && !loadingAdmins && (
            <div className="p-8 text-center glass-panel rounded-2xl border-white/5 opacity-40">
              <ShieldAlert size={32} className="mx-auto mb-2 text-white/40" />
              <p className="text-xs font-mono text-white">No active custom admins assigned yet. Click "Register / Add Admin" above to appoint staff.</p>
            </div>
          )}
        </div>
      </div>

      {editingPolicy && (
        <CustomPolicyModal 
          policy={editingPolicy}
          onClose={() => setEditingPolicy(null)}
          onSave={handleSavePolicy}
        />
      )}
    </div>
  );
};

const MAJOR_SECTORS = [
  { key: 'marketplace', label: 'Marketplace & E-Commerce', category: 'Trade & Commerce', desc: 'Controls digital product listings, cart, store checkout, and payment gateways.' },
  { key: 'videos', label: 'Reels & Short Videos Feed', category: 'Media & Streaming', desc: 'Controls global video feed, reel uploads, fullscreen player, and video comments.' },
  { key: 'stories', label: 'Stories & Moments', category: 'Social Sharing', desc: 'Controls 24-hour story creation bar, daily moment sharing, and story highlights.' },
  { key: 'liveStreaming', label: 'Live Broadcasts & Streaming', category: 'Live Comms', desc: 'Controls real-time video broadcasting, live rooms, and stream audience chat.' },
  { key: 'inbox', label: 'Direct Messaging & Inbox', category: 'Messaging', desc: 'Controls user-to-user messenger, chat themes, voice notes, and vanish mode.' },
  { key: 'discover', label: 'Explore & Connections Hub', category: 'Discovery', desc: 'Controls global search, user recommendations, interest tags, and trend feeds.' },
  { key: 'aiFeatures', label: 'AI Studio & Smart Assistant', category: 'AI System', desc: 'Controls smart AI post generator, auto-captioning, prompt assists, and AI avatars.' },
  { key: 'subscriptions', label: 'Subscriptions & Pro Creator', category: 'Monetization', desc: 'Controls creator subscription tiers, paid supporter badges, and pro unlocks.' },
  { key: 'controlPanel', label: 'Enterprise Control Center', category: 'Admin System', desc: 'Controls admin control panel entry, moderation tools, and security logs.' },
  { key: 'audioCalls', label: 'Voice & Video Calling', category: 'Real-Time Calls', desc: 'Controls 1-on-1 audio and video popup calling inside direct messaging.' },
  { key: 'dashboard', label: 'Creator Dashboard & Analytics', category: 'Analytics', desc: 'Controls level rewards, points system, rank badges, and performance metrics.' },
  { key: 'games', label: 'Games & Interactive Arcade', category: 'Arcade', desc: 'Controls social mini-games, arcade challenges, and interactive leaderboards.' },
  { key: 'notifications', label: 'Alerts & Notification Center', category: 'System Alerts', desc: 'Controls push notification popups, system activity alerts, and notification dropdown.' },
];

const FeatureFlagsTab = ({ db, addToast }: { db: any; addToast: any }) => {
  const { featureFlags, updateFeatureFlag } = useAeirmist();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Sliders size={18} className="text-aeirmist-cyan" />
            Enterprise Major Sector Feature Flags
          </h2>
          <p className="text-[10px] font-mono text-white/40">
            Instantly activate or set any major platform sector to "Coming Soon" across the app in real-time.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono text-aeirmist-cyan font-bold">
          {Object.values(featureFlags || {}).filter(Boolean).length} / {MAJOR_SECTORS.length} Sectors Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {MAJOR_SECTORS.map((sector) => {
          const isEnabled = featureFlags ? featureFlags[sector.key] !== false : true;

          return (
            <div 
              key={sector.key} 
              className={`p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 ${
                isEnabled 
                  ? 'bg-white/[0.02] border-white/10 hover:border-aeirmist-cyan/30' 
                  : 'bg-amber-500/[0.03] border-amber-500/20'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-aeirmist-cyan/80 bg-aeirmist-cyan/10 px-2 py-0.5 rounded-full border border-aeirmist-cyan/20">
                    {sector.category}
                  </span>
                  <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                    isEnabled 
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  }`}>
                    {isEnabled ? 'ACTIVE' : 'COMING SOON'}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {sector.label}
                  </h3>
                  <p className="text-[10px] font-mono text-white/50 leading-relaxed mt-1">
                    {sector.desc}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                <span className="text-[9px] font-mono text-white/30">
                  Key: <code className="text-white/60">{sector.key}</code>
                </span>
                <button
                  onClick={async () => {
                    const newStatus = !isEnabled;
                    await updateFeatureFlag(sector.key, newStatus);
                    addToast({ 
                      title: newStatus ? 'Sector Unlocked' : 'Sector Locked', 
                      message: `${sector.label} is now ${newStatus ? 'ACTIVE and available to users' : 'DISABLED (Set to Coming Soon)'}.`, 
                      type: newStatus ? 'success' : 'warning' 
                    });
                  }}
                  className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-mono ${
                    isEnabled 
                      ? 'bg-emerald-500 text-black font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-400' 
                      : 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-black font-bold'
                  }`}
                >
                  {isEnabled ? 'Active (Click to Disable)' : 'Set to Coming Soon'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const VerificationRequestsTab = ({ db, addToast, toggleVerification }: { db: any; addToast: any; toggleVerification: any }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalApplicant, setModalApplicant] = useState<any | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('Identity document could not be verified or is incomplete.');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'verificationApplications'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      logger.warn("Verification requests list error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  const handleQuickApprove = async (r: any) => {
    if (!db) return;
    const plan = (r.plan || 'creator') as 'essential' | 'creator' | 'business';
    const targetProfileId = r.profileId || r.userId || r.id;
    const targetUid = r.userId || r.uid || r.id;
    setIsProcessingAction(true);
    try {
      await toggleVerification(targetProfileId, true, plan, 30, targetUid);
      await updateDoc(doc(db, 'verificationApplications', r.id), {
        status: 'approved',
        approvedPlan: plan,
        reviewedAt: serverTimestamp()
      }).catch(() => {});
      addToast({ title: 'Application Approved', message: `@${r.username || 'user'} is now Aeirmist ${plan.toUpperCase()} Verified.`, type: 'success' });
    } catch (e) {
      logger.error("Failed to approve verification:", e);
      addToast({ title: 'Approval Failed', message: 'Could not approve verification request.', type: 'warning' });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequest || !db) return;
    const finalReason = customRejectReason.trim() || rejectReason;
    const targetProfileId = rejectingRequest.profileId || rejectingRequest.userId || rejectingRequest.id;
    const targetUid = rejectingRequest.userId || rejectingRequest.uid || rejectingRequest.id;
    setIsProcessingAction(true);
    try {
      await updateDoc(doc(db, 'verificationApplications', rejectingRequest.id), {
        status: 'rejected',
        rejectionReason: finalReason,
        rejectedAt: serverTimestamp()
      });

      // Send Meta-style rejection notification to user
      const targetRecipientIds = Array.from(new Set([targetUid, targetProfileId].filter(Boolean))) as string[];
      for (const recipientId of targetRecipientIds) {
        await addDoc(collection(db, 'notifications'), {
          userId: recipientId,
          fromUserId: 'aeirmist_system',
          fromUserUid: 'aeirmist_system',
          user: {
            name: 'Aeirmist Official',
            avatar: '/favicon.png',
            username: 'aeirmist',
            isVerified: true
          },
          type: 'verification',
          message: `Your Aeirmist Verification application could not be approved at this time. Reason: ${finalReason}. You may update your information and reapply.`,
          metadata: {
            status: 'rejected',
            reason: finalReason,
            senderName: 'Aeirmist Official',
            senderUsername: 'aeirmist',
            senderPhoto: '/favicon.png'
          },
          read: false,
          createdAt: serverTimestamp()
        }).catch(() => {});
      }

      addToast({ title: 'Application Rejected', message: `Applicant has been notified with the reason.`, type: 'info' });
      setRejectingRequest(null);
      setCustomRejectReason('');
    } catch (e) {
      logger.error("Failed to reject application:", e);
      addToast({ title: 'Reject Failed', message: 'Could not process rejection.', type: 'warning' });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRefund = async (r: any) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'verificationApplications', r.id), { status: 'refunded', refundedAt: serverTimestamp() });
      await addDoc(collection(db, 'notifications'), {
        userId: r.userId,
        type: 'verification',
        message: `Your payment of $${r.amount} for Aeirmist Verification has been refunded.`,
        metadata: { status: 'refunded' },
        read: false,
        createdAt: serverTimestamp()
      }).catch(() => {});
      addToast({ title: 'Payment Refunded', message: `Marked application as refunded.`, type: 'success' });
    } catch (e) {
      addToast({ title: 'Refund Failed', message: 'Could not process refund.', type: 'warning' });
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><RefreshCw className="animate-spin text-aeirmist-cyan" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black uppercase tracking-widest text-white">Verification Requests</h2>
          <p className="text-[10px] font-mono text-white/40">Review, approve, or configure Meta-Style verification plans.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-white/70">
            Total Requests: {requests.length}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="p-12 text-center text-white/40 text-xs font-mono glass-panel rounded-3xl border-white/5">
            No pending or processed verification requests found.
          </div>
        ) : (
          requests.map((r) => {
            const planKey = (r.plan || 'creator').toLowerCase();
            const badgeBg = planKey === 'essential' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                            planKey === 'business' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                            'bg-cyan-500/20 text-aeirmist-cyan border-cyan-500/30';
            const badgeIconColor = planKey === 'essential' ? 'text-blue-400' :
                                   planKey === 'business' ? 'text-amber-400' :
                                   'text-aeirmist-cyan';

            return (
              <div key={r.id} className="glass-panel p-6 rounded-3xl border-white/5 bg-white/[0.01] space-y-4 hover:border-white/10 transition-all">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${badgeBg}`}>
                      <ShieldCheck size={20} className={badgeIconColor} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">@{r.username || 'unknown'}</span>
                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded font-mono border ${badgeBg}`}>
                          {planKey.toUpperCase()} PLAN
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-white/40 mt-0.5">App ID: {r.applicationId} • UID: {r.userId?.slice(0, 12)}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-xl font-mono border ${
                      r.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      r.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      r.status === 'refunded' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-purple-500/20 text-purple-300 border-purple-500/30 animate-pulse'
                    }`}>
                      {r.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] font-mono">
                    <span className="text-white/40 block mb-1 uppercase">Payment Provider</span>
                    <span className="text-green-400 font-bold capitalize">{r.paymentProvider || 'Card'} ({r.paymentStatus || 'Paid'})</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] font-mono">
                    <span className="text-white/40 block mb-1 uppercase">Fee Amount</span>
                    <span className="text-white font-bold">${r.amount} {r.currency || 'USD'} / mo</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] font-mono">
                    <span className="text-white/40 block mb-1 uppercase">ID Document</span>
                    <span className="text-aeirmist-cyan font-bold">{r.identity?.idDocument || 'Government ID Attached'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] font-mono">
                    <span className="text-white/40 block mb-1 uppercase">Applied Date</span>
                    <span className="text-white/80">{r.createdAt?.toDate ? new Date(r.createdAt.toDate()).toLocaleDateString() : 'Recent'}</span>
                  </div>
                </div>
                
                {r.identity && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] font-mono text-white/70 space-y-1">
                    <p><span className="text-white/40 uppercase">Full Legal Name:</span> <span className="text-white font-bold">{r.identity.fullName}</span></p>
                    <p><span className="text-white/40 uppercase">Country:</span> <span className="text-white">{r.identity.country}</span></p>
                    {r.identity.website && <p><span className="text-white/40 uppercase">Website / Portfolio:</span> <a href={r.identity.website} target="_blank" rel="noreferrer" className="text-aeirmist-cyan underline">{r.identity.website}</a></p>}
                  </div>
                )}

                {r.rejectionReason && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-mono text-red-300">
                    <span className="text-red-400 font-bold block mb-0.5">REJECTION REASON:</span>
                    {r.rejectionReason}
                  </div>
                )}

                {r.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                    <button
                      disabled={isProcessingAction}
                      onClick={() => handleQuickApprove(r)}
                      className="h-9 px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check size={14} /> Approve ({planKey.toUpperCase()} - 30 Days)
                    </button>

                    <button
                      disabled={isProcessingAction}
                      onClick={() => {
                        setModalApplicant({
                          id: r.userId,
                          uid: r.userId,
                          username: r.username,
                          displayName: r.identity?.fullName || r.username,
                          verificationPlan: r.plan,
                          isVerified: false
                        });
                      }}
                      className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sliders size={13} /> Change Plan / Duration
                    </button>

                    <button
                      disabled={isProcessingAction}
                      onClick={() => setRejectingRequest(r)}
                      className="h-9 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <X size={14} /> Reject
                    </button>

                    <button
                      disabled={isProcessingAction}
                      onClick={() => handleRefund(r)}
                      className="h-9 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-[10px] font-black uppercase tracking-wider transition-all ml-auto cursor-pointer"
                    >
                      Refund
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Rejection Reason Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-[100003] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#090b10] border border-red-500/30 rounded-3xl p-6 space-y-5 shadow-2xl text-white"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Reject Verification Application</h3>
              </div>
              <button onClick={() => setRejectingRequest(null)} className="text-white/40 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-white/60">
              Select or provide a reason for rejecting @{rejectingRequest.username}&apos;s verification application. The user will receive this explanation via in-app notification.
            </p>

            <div className="space-y-2">
              {[
                'Identity document could not be verified or is incomplete.',
                'Legal name does not match identification documents.',
                'Profile does not meet community authenticity criteria.',
                'Suspicious or fraudulent payment activity detected.'
              ].map((reasonOption, idx) => (
                <div
                  key={idx}
                  onClick={() => { setRejectReason(reasonOption); setCustomRejectReason(''); }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    rejectReason === reasonOption && !customRejectReason
                      ? 'bg-red-500/20 border-red-500/50 text-white font-medium'
                      : 'bg-white/[0.02] border-white/5 text-white/60 hover:border-white/20'
                  }`}
                >
                  {reasonOption}
                </div>
              ))}
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-white/50 block mb-1">Or write a custom reason:</label>
              <textarea
                rows={2}
                value={customRejectReason}
                onChange={(e) => setCustomRejectReason(e.target.value)}
                placeholder="Explain why this request is rejected..."
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-red-400 transition-colors"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setRejectingRequest(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white/70 hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isProcessingAction}
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold uppercase tracking-wider hover:bg-red-400 transition-all cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Plan Modal for Verification Requests */}
      <VerificationPlanModal
        isOpen={Boolean(modalApplicant)}
        onClose={() => setModalApplicant(null)}
        user={modalApplicant}
        onApplyPlan={async (plan, durationDays) => {
          if (!modalApplicant) return;
          const targetProfileId = modalApplicant.profileId || modalApplicant.userId || modalApplicant.uid || modalApplicant.id;
          const targetUid = modalApplicant.userId || modalApplicant.uid || modalApplicant.id;
          await toggleVerification(targetProfileId, true, plan, durationDays, targetUid);
          await updateDoc(doc(db, 'verificationApplications', modalApplicant.id), {
            status: 'approved',
            approvedPlan: plan,
            reviewedAt: serverTimestamp()
          }).catch(() => {});
          setModalApplicant(null);
        }}
        onRevoke={async () => {
          if (!modalApplicant) return;
          const targetProfileId = modalApplicant.profileId || modalApplicant.userId || modalApplicant.uid || modalApplicant.id;
          const targetUid = modalApplicant.userId || modalApplicant.uid || modalApplicant.id;
          await toggleVerification(targetProfileId, false, undefined, undefined, targetUid);
          setModalApplicant(null);
        }}
        onExtend={async (days) => {
          if (!modalApplicant) return;
          const targetProfileId = modalApplicant.profileId || modalApplicant.userId || modalApplicant.uid || modalApplicant.id;
          const targetUid = modalApplicant.userId || modalApplicant.uid || modalApplicant.id;
          await toggleVerification(targetProfileId, true, modalApplicant.verificationPlan || 'creator', days, targetUid);
          setModalApplicant(null);
        }}
      />
    </div>
  );
};

export const AdminPanel = () => {
  const { user, profile, loading: authLoading, db, addToast, purgeUser, toggleUserBan, toggleVerification, updateUserStatus, suspendUser } = useAeirmist();
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'reports' | 'appeals' | 'marketplace' | 'security' | 'roles' | 'flags' | 'logs' | 'verification' | 'tickets' | 'system'>('dashboard');
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [pendingVerificationsCount, setPendingVerificationsCount] = useState<number>(0);

  useEffect(() => {
    if (!db || !isAdminUser) return;
    const q = query(collection(db, 'verificationApplications'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      setPendingVerificationsCount(snap.size);
    }, (err) => logger.warn("Pending verifications count error:", err));
    return () => unsub();
  }, [db, isAdminUser]);

  useEffect(() => {
    if (!db || !isAdminUser) return;
    const unsub = onSnapshot(collection(db, 'profiles'), (snap) => {
      setAllProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => logger.warn("All profiles error:", err));
    return () => unsub();
  }, [db, isAdminUser]);

  useEffect(() => {
    let isMounted = true;
    const checkAdminAuthorization = async () => {
      // 0. If authentication or profile is still loading, stay in loading state
      if (authLoading) {
        return;
      }

      // If no user and no profile after loading, or no db
      if ((!user && !profile) || !db) {
        if (isMounted) setIsAdminUser(false);
        return;
      }

      try {
        const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
        const userUid = user?.uid || profile?.ownerUid || profile?.uid || profile?.id || '';
        const profileUsername = (profile?.username || '').toLowerCase().trim();
        const profileRole = (profile?.role || '').toLowerCase().trim();
        const isProfileAdmin = 
          profile?.isAdmin === true || 
          ['admin', 'owner', 'super_admin', 'administrator', 'moderator', 'master'].includes(profileRole);

        // 1. Trusted Owner / Super Admin Bootstrap Check (Email, UID, Username, or Admin Role)
        if (
          userEmail === 'junaedislamjim180@gmail.com' ||
          userUid === 'dovifwfmxcooas976z6mo216yng1' ||
          userUid === 'doViFWfMXcOoas976z6MO216YNg1' ||
          profileUsername === 'junaed_islam_jim9' ||
          isProfileAdmin
        ) {
          // Sync owner record in /admins/{uid} collection silently in background
          if (db && userUid) {
            setDoc(doc(db, 'admins', userUid), {
              uid: userUid,
              email: userEmail || 'junaedislamjim180@gmail.com',
              role: 'OWNER',
              status: 'ACTIVE',
              updatedAt: serverTimestamp()
            }, { merge: true }).catch(() => {});
          }

          if (isMounted) setIsAdminUser(true);
          return;
        }

        // 2. Verify custom claims on Firebase Authentication ID token (Cryptographically verified)
        if (user) {
          const idTokenResult = await user.getIdTokenResult(true).catch(() => null);
          const claims = idTokenResult?.claims || {};
          const hasCustomAdminClaim = 
            claims.admin === true || 
            ['owner', 'admin', 'super_admin', 'administrator', 'moderator', 'support', 'marketplace_moderator'].includes((claims.role as string || '').toLowerCase());

          if (hasCustomAdminClaim) {
            if (isMounted) setIsAdminUser(true);
            return;
          }
        }

        // 3. Verify server-secured record in /admins/{uid} collection
        if (userUid) {
          const adminDocRef = doc(db, 'admins', userUid);
          const adminDocSnap = await getDoc(adminDocRef).catch(() => null);

          if (adminDocSnap && adminDocSnap.exists()) {
            const adminData = adminDocSnap.data();
            if (adminData && (adminData.status === 'ACTIVE' || adminData.role || adminData.uid === userUid)) {
              if (isMounted) setIsAdminUser(true);
              return;
            }
          }
        }

        // Authorization denied - Fail Closed
        if (isMounted) setIsAdminUser(false);
      } catch (error) {
        logger.error("[Security] Admin authorization check error:", error);
        // Fallback for owner / admin role if error occurs
        const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
        const userUid = user?.uid || profile?.ownerUid || profile?.uid || profile?.id || '';
        const profileUsername = (profile?.username || '').toLowerCase().trim();
        const profileRole = (profile?.role || '').toLowerCase().trim();
        const isProfileAdmin = 
          profile?.isAdmin === true || 
          ['admin', 'owner', 'super_admin', 'administrator'].includes(profileRole);

        if (
          userEmail === 'junaedislamjim180@gmail.com' ||
          userUid === 'dovifwfmxcooas976z6mo216yng1' ||
          userUid === 'doViFWfMXcOoas976z6MO216YNg1' ||
          profileUsername === 'junaed_islam_jim9' ||
          isProfileAdmin
        ) {
          if (isMounted) setIsAdminUser(true);
        } else {
          if (isMounted) setIsAdminUser(false);
        }
      }
    };

    checkAdminAuthorization();

    return () => {
      isMounted = false;
    };
  }, [user, profile, authLoading, db]);

  if (isAdminUser === null) {
    return (
      <div className="h-screen bg-[#06080c] flex flex-col items-center justify-center gap-4">
        <RefreshCw className="animate-spin text-aeirmist-cyan" size={28} />
        <p className="text-xs font-mono text-white/50 uppercase tracking-widest">Verifying Admin Credentials...</p>
      </div>
    );
  }

  if (isAdminUser === false) {
    return (
      <div className="min-h-screen bg-[#06080c] text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full glass-panel p-8 rounded-3xl border-red-500/30 bg-[#0a0d14] text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white">Access Denied</h2>
            <p className="text-xs text-white/60 mt-2 font-mono leading-relaxed">
              You do not have administrative permissions to view the Enterprise Control Center. This security boundary failed closed.
            </p>
          </div>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('aeirmist-navigate', { detail: 'feed' }));
              if (window.location.pathname !== '/') {
                window.history.pushState({}, '', '/');
              }
            }}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} /> Return to Application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex-1 bg-[#06080c] text-white selection:bg-aeirmist-cyan selection:text-black font-sans flex flex-col overflow-y-auto overflow-x-hidden scroll-container">
      
      {/* Sticky Header with Breadcrumbs - Locked to Top */}
      <div className="sticky top-0 z-50 bg-[#06080c]/95 backdrop-blur-xl px-4 md:px-8 py-3.5 border-b border-white/10 flex flex-col gap-3 shrink-0 shadow-2xl">
        {/* Top Bar: Title & Primary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('aeirmist-navigate', { detail: 'feed' }));
                if (window.location.pathname !== '/') {
                  window.history.pushState({}, '', '/');
                }
              }}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all shrink-0 cursor-pointer"
              title="Return to Feed"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-[9px] font-mono text-white/40">
                <span>Aeirmist Core</span>
                <span>/</span>
                <span className="text-aeirmist-cyan font-bold uppercase">{activeTab}</span>
              </div>
              <h1 className="text-lg md:text-xl font-black uppercase tracking-[0.18em] text-white">Enterprise Control Center</h1>
            </div>
          </div>

          <button 
            onClick={() => setIsAddAdminOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-aeirmist-cyan text-black hover:bg-white transition-all font-bold shadow-lg shadow-aeirmist-cyan/20 shrink-0"
          >
            <UserPlus size={14} />
            + Register Admin
          </button>
        </div>

        {/* Tab Navigation Ribbon - Fully Wrapped & Organized so all tabs are visible without scroll cut-off */}
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 p-1.5 rounded-2xl bg-white/[0.02] border border-white/5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={13} /> },
            { id: 'users', label: 'Users', icon: <Users size={13} /> },
            { id: 'reports', label: 'Reports', icon: <AlertTriangle size={13} /> },
            { id: 'appeals', label: 'Appeals', icon: <ShieldCheck size={13} /> },
            { id: 'tickets', label: 'Support Inbox', icon: <LifeBuoy size={13} /> },
            { id: 'verification', label: 'Verification', icon: <CheckCircle size={13} />, badge: pendingVerificationsCount },
            { id: 'marketplace', label: 'Pay & Sub', icon: <ShoppingBag size={13} /> },
            { id: 'security', label: 'Security', icon: <Shield size={13} /> },
            { id: 'roles', label: 'Roles', icon: <Key size={13} /> },
            { id: 'flags', label: 'Flags', icon: <Sliders size={13} /> },
            { id: 'logs', label: 'Audit Logs', icon: <History size={13} /> },
            { id: 'system', label: 'System', icon: <Cpu size={13} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 h-8 md:h-9 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id ? 'bg-aeirmist-cyan text-black font-bold shadow-md shadow-aeirmist-cyan/20 scale-[1.02]' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span className={`px-1.5 py-0.5 rounded-full font-black text-[9px] leading-none ${
                  activeTab === tab.id ? 'bg-black text-aeirmist-cyan' : 'bg-aeirmist-cyan text-black'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-8 pb-32">

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeTransition}
        >
          {activeTab === 'dashboard' && <DashboardTab db={db} setActiveTab={setActiveTab} />}
          {activeTab === 'users' && (
            <UsersTab 
              db={db} 
              addToast={addToast} 
              purgeUser={purgeUser} 
              toggleUserBan={toggleUserBan} 
              toggleVerification={toggleVerification} 
              updateUserStatus={updateUserStatus}
              suspendUser={suspendUser}
              onOpenAddAdmin={() => setIsAddAdminOpen(true)}
            />
          )}
          {activeTab === 'reports' && <ReportsManagementTab db={db} addToast={addToast} />}
          {activeTab === 'appeals' && <AppealsTab db={db} addToast={addToast} />}
          {activeTab === 'tickets' && <SupportInboxTab db={db} addToast={addToast} />}
          {activeTab === 'marketplace' && <MarketplacePaymentsTab db={db} />}
          {activeTab === 'security' && <SecurityCenterTab />}
          {activeTab === 'roles' && (
            <RolesPermissionsTab 
              db={db} 
              addToast={addToast} 
              onOpenAddAdmin={() => setIsAddAdminOpen(true)} 
            />
          )}
          {activeTab === 'flags' && <FeatureFlagsTab db={db} addToast={addToast} />}
          {activeTab === 'logs' && <AuditLogTab db={db} />}
          {activeTab === 'verification' && <VerificationRequestsTab db={db} addToast={addToast} toggleVerification={toggleVerification} />}
          {activeTab === 'system' && <SystemTab />}
        </motion.div>

      </div>

      <AddAdminModal 
        isOpen={isAddAdminOpen}
        onClose={() => setIsAddAdminOpen(false)}
        db={db}
        addToast={addToast}
        allUsers={allProfiles}
      />
    </div>
  );
};

export default AdminPanel;
