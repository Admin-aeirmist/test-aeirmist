import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  MapPin, 
  Clock, 
  LogOut, 
  RefreshCcw, 
  ShieldCheck, 
  Info, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Key,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAeirmist } from '../../../../context/AeirmistContext';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { getOrCreateSessionKey, trackUserSession } from '../../../../utils/sessionTracker';
import { logger } from '@/src/utils/logger';


export const DevicesAndSessions: React.FC = () => {
  const { user, db, addToast, logActivity } = useAeirmist();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedDetailSession, setSelectedDetailSession] = useState<any | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; type: 'revoke_one' | 'logout_others' | 'end_all'; targetId?: string } | null>(null);

  const currentSessionKey = getOrCreateSessionKey();

  // Listen to active sessions
  useEffect(() => {
    if (!db || !user) return;

    const q = query(
      collection(db, 'login_sessions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // In-memory sort by lastActiveAt
      data.sort((a: any, b: any) => {
        const timeA = a.lastActiveAt?.toMillis ? a.lastActiveAt.toMillis() : 0;
        const timeB = b.lastActiveAt?.toMillis ? b.lastActiveAt.toMillis() : 0;
        return timeB - timeA;
      });

      setSessions(data);
    }, (err) => {
      logger.warn("Error loading sessions:", err);
    });

    return () => unsubscribe();
  }, [db, user]);

  // Listen to login history
  useEffect(() => {
    if (!db || !user) return;

    const q = query(
      collection(db, 'login_history'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      data.sort((a: any, b: any) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeB - timeA;
      });

      setLoginHistory(data.slice(0, 20));
    }, (err) => {
      logger.warn("Error loading login history:", err);
    });

    return () => unsubscribe();
  }, [db, user]);

  const activeSessions = sessions.filter(s => !s.revoked);

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'iPhone':
      case 'Android':
        return <Smartphone size={18} />;
      case 'Tablet':
        return <Tablet size={18} />;
      default:
        return <Monitor size={18} />;
    }
  };

  const handleRefreshSession = async () => {
    if (!db || !user) return;
    setIsRefreshing(true);
    try {
      await trackUserSession(db, user.uid);
      addToast({
        title: "SESSION REFRESHED",
        message: "Current session telemetry & state updated successfully.",
        type: "success"
      });
      await logActivity('session_refresh', 'User refreshed current session token.');
    } catch (err) {
      addToast({ title: "Error", message: "Failed to refresh session status.", type: "warning" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRevokeSingle = async (sessionId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'login_sessions', sessionId), {
        revoked: true,
        revokedAt: serverTimestamp()
      });
      addToast({
        title: "DEVICE DISCONNECTED",
        message: "Remote device session terminated.",
        type: "success"
      });
      await logActivity('session_revoke', `Revoked session: ${sessionId}`);
    } catch (err) {
      addToast({ title: "Error", message: "Failed to terminate session.", type: "warning" });
    } finally {
      setConfirmModal(null);
    }
  };

  const handleLogoutOtherDevices = async () => {
    if (!db) return;
    const others = activeSessions.filter(s => s.sessionKey !== currentSessionKey);
    if (others.length === 0) {
      addToast({ title: "NO OTHER DEVICES", message: "No other active sessions detected.", type: "info" });
      setConfirmModal(null);
      return;
    }

    try {
      for (const s of others) {
        await updateDoc(doc(db, 'login_sessions', s.id), {
          revoked: true,
          revokedAt: serverTimestamp()
        });
      }
      addToast({
        title: "ALL OTHER SESSIONS TERMINATED",
        message: `Successfully disconnected ${others.length} remote devices.`,
        type: "success"
      });
      await logActivity('global_logout_others', `Terminated ${others.length} remote sessions.`);
    } catch (err) {
      addToast({ title: "Error", message: "Failed to revoke sessions.", type: "warning" });
    } finally {
      setConfirmModal(null);
    }
  };

  const handleEndAllSessions = async () => {
    if (!db) return;
    try {
      for (const s of activeSessions) {
        await updateDoc(doc(db, 'login_sessions', s.id), {
          revoked: true,
          revokedAt: serverTimestamp()
        });
      }
      addToast({
        title: "ALL SESSIONS ENDED",
        message: "All device sessions have been safely terminated.",
        type: "info"
      });
      await logActivity('global_logout_all', 'Terminated all active sessions.');
    } catch (err) {
      addToast({ title: "Error", message: "Failed to terminate all sessions.", type: "warning" });
    } finally {
      setConfirmModal(null);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return 'Just now';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[2rem] bg-white/[0.03] border border-white/5">
        <div>
          <h3 className="text-base font-black uppercase tracking-widest text-white">Devices & Active Sessions</h3>
          <p className="text-xs text-white/50 mt-1">Manage terminals and active logins across desktop, tablet, and mobile devices.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRefreshSession}
            disabled={isRefreshing}
            className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCcw size={14} className={isRefreshing ? 'animate-spin text-[var(--color-aeirmist-cyan)]' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmModal({ open: true, type: 'logout_others' })}
            className="px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            Log Out Other Devices
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'active' ? 'bg-[var(--color-aeirmist-cyan)] text-black' : 'text-white/40 hover:text-white'
          }`}
        >
          Active Sessions ({activeSessions.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'history' ? 'bg-[var(--color-aeirmist-cyan)] text-black' : 'text-white/40 hover:text-white'
          }`}
        >
          Login History ({loginHistory.length})
        </button>
      </div>

      {/* Active Sessions List */}
      {activeTab === 'active' && (
        <div className="space-y-3">
          {activeSessions.length > 0 ? (
            activeSessions.map((s) => {
              const isCurrent = s.sessionKey === currentSessionKey;
              return (
                <div
                  key={s.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isCurrent ? 'bg-[var(--color-aeirmist-cyan)]/[0.03] border-[var(--color-aeirmist-cyan)]/20 shadow-[0_0_20px_rgba(0,242,255,0.05)]' : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3.5 rounded-2xl ${isCurrent ? 'bg-[var(--color-aeirmist-cyan)]/15 text-[var(--color-aeirmist-cyan)] border border-[var(--color-aeirmist-cyan)]/30' : 'bg-white/5 text-white/50'}`}>
                        {getDeviceIcon(s.deviceType)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white">{s.deviceName || 'Terminal'}</h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-[var(--color-aeirmist-cyan)]/20 border border-[var(--color-aeirmist-cyan)]/40 text-[var(--color-aeirmist-cyan)] text-[9px] font-black uppercase tracking-wider">
                              CURRENT SESSION
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] font-mono text-white/40 flex-wrap">
                          <span>{s.browser} • {s.os}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-white/30" />
                            {s.location || 'Unknown Location'}
                          </span>
                          <span>•</span>
                          <span>IP: {s.ipAddress}</span>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-white/30 pt-1">
                          <span>Method: <strong className="text-white/60">{s.loginMethod || 'Google'}</strong></span>
                          <span>•</span>
                          <span>Last Active: <strong className="text-white/60">{formatDate(s.lastActiveAt)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailSession(s)}
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Info size={14} />
                        <span>Details</span>
                      </button>

                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => setConfirmModal({ open: true, type: 'revoke_one', targetId: s.id })}
                          className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <LogOut size={14} />
                          <span>Disconnect</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/10">
              <p className="text-xs font-mono text-white/30 uppercase tracking-widest">No active sessions found</p>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setConfirmModal({ open: true, type: 'end_all' })}
              className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
            >
              End All Sessions
            </button>
          </div>
        </div>
      )}

      {/* Login History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-[10px] font-black uppercase text-white/40 tracking-wider">
            <span>Terminal & Location</span>
            <span>Method / Status</span>
            <span>Timestamp</span>
          </div>

          {loginHistory.length > 0 ? (
            loginHistory.map((item, idx) => (
              <div key={item.id || idx} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-white/5 text-white/40">
                    {getDeviceIcon(item.deviceType)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{item.deviceName || 'Terminal'}</p>
                    <p className="text-[10px] font-mono text-white/40 truncate">{item.location} • {item.ipAddress}</p>
                  </div>
                </div>

                <div className="text-center">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                    {item.loginMethod || 'SUCCESS'}
                  </span>
                </div>

                <span className="text-[10px] font-mono text-white/40">
                  {formatDate(item.timestamp)}
                </span>
              </div>
            ))
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/10">
              <p className="text-xs font-mono text-white/30 uppercase tracking-widest">No history recorded yet</p>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedDetailSession && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-3xl bg-[#090d16] border border-white/10 space-y-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setSelectedDetailSession(null)}
                className="absolute right-5 top-5 text-white/40 hover:text-white p-1"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="p-3 bg-[var(--color-aeirmist-cyan)]/10 rounded-2xl text-[var(--color-aeirmist-cyan)]">
                  {getDeviceIcon(selectedDetailSession.deviceType)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedDetailSession.deviceName}</h3>
                  <p className="text-[10px] font-mono text-[var(--color-aeirmist-cyan)] uppercase">Session Inspection</p>
                </div>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between p-3 rounded-xl bg-white/[0.02]">
                  <span className="text-white/40">Device Type:</span>
                  <span className="text-white font-bold">{selectedDetailSession.deviceType}</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-white/[0.02]">
                  <span className="text-white/40">Browser / OS:</span>
                  <span className="text-white font-bold">{selectedDetailSession.browser} ({selectedDetailSession.os})</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-white/[0.02]">
                  <span className="text-white/40">Location:</span>
                  <span className="text-white font-bold">{selectedDetailSession.location}</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-white/[0.02]">
                  <span className="text-white/40">Masked IP Address:</span>
                  <span className="text-white font-bold">{selectedDetailSession.ipAddress}</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-white/[0.02]">
                  <span className="text-white/40">Login Method:</span>
                  <span className="text-white font-bold">{selectedDetailSession.loginMethod}</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-white/[0.02]">
                  <span className="text-white/40">Last Active:</span>
                  <span className="text-white font-bold">{formatDate(selectedDetailSession.lastActiveAt)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailSession(null)}
                className="w-full h-11 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest transition-all"
              >
                Close Inspection
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmModal?.open && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-3xl bg-[#090d16] border border-red-500/20 space-y-5 shadow-2xl relative"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-red-500/10 text-red-400">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Confirm Session Revocation</h3>
                  <p className="text-[10px] font-mono text-red-400">Security Action</p>
                </div>
              </div>

              <p className="text-xs text-white/70 leading-relaxed">
                {confirmModal.type === 'logout_others' && 'This will disconnect all active sessions except your current device.'}
                {confirmModal.type === 'end_all' && 'This will end all sessions including your current active window.'}
                {confirmModal.type === 'revoke_one' && 'Are you sure you want to disconnect this device session?'}
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:text-white text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmModal.type === 'revoke_one' && confirmModal.targetId) {
                      handleRevokeSingle(confirmModal.targetId);
                    } else if (confirmModal.type === 'logout_others') {
                      handleLogoutOtherDevices();
                    } else if (confirmModal.type === 'end_all') {
                      handleEndAllSessions();
                    }
                  }}
                  className="flex-1 h-11 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-wider shadow-lg"
                >
                  Disconnect
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
