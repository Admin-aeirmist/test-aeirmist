import React, { useState, useEffect, useCallback } from 'react';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  MapPin, 
  Clock, 
  LogOut, 
  RefreshCcw, 
  ShieldCheck, 
  ShieldAlert,
  ChevronRight,
  ArrowLeft,
  X, 
  AlertTriangle,
  Globe,
  Navigation,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAeirmist } from '../../../../context/AeirmistContext';
import { api } from '../../../../services/api/client';
import { PermissionService } from '../../../../services/PermissionService';
import { logger } from '@/src/utils/logger';

interface SessionItem {
  id: string;
  userId: string;
  ipAddress?: string;
  deviceName?: string;
  deviceType: string;
  model: string;
  browser: string;
  os: string;
  location?: string;
  latitude?: string | number;
  longitude?: string | number;
  isTrusted?: boolean;
  sessionToken?: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

export const DevicesAndSessions: React.FC = () => {
  const { user, profile, addToast } = useAeirmist();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [unrecognizedCount, setUnrecognizedCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSyncingLiveLocation, setIsSyncingLiveLocation] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<'accounts' | 'devices'>('accounts');
  const [selectedSessionForLogout, setSelectedSessionForLogout] = useState<SessionItem | null>(null);
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const fetchSessions = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const res = await api.auth.getSessions();
      if (res && Array.isArray(res.sessions)) {
        setSessions(res.sessions);
        setUnrecognizedCount(res.unrecognizedCount || 0);
      }
    } catch (err) {
      logger.warn('[DevicesAndSessions] Failed to fetch sessions:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const syncLiveGpsLocation = useCallback(async (showFeedback = false) => {
    setIsSyncingLiveLocation(true);
    try {
      const loc = await PermissionService.getPreciseLocation({ timeoutMs: 6000, highAccuracy: true });
      if (loc && loc.displayLocation && !loc.displayLocation.includes('NaN')) {
        await api.auth.updateSessionLocation({
          location: loc.displayLocation,
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
        await fetchSessions(true);
        if (showFeedback) {
          addToast({
            title: 'Location Updated',
            message: `Live location set to ${loc.displayLocation}`,
            type: 'success',
          });
        }
      }
    } catch (err) {
      logger.warn('[DevicesAndSessions] Live location sync note:', err);
    } finally {
      setIsSyncingLiveLocation(false);
    }
  }, [fetchSessions, addToast]);

  useEffect(() => {
    fetchSessions(true);
    syncLiveGpsLocation(false);
    const interval = setInterval(() => fetchSessions(true), 45000);
    return () => clearInterval(interval);
  }, [fetchSessions, syncLiveGpsLocation]);

  const currentSession = sessions.find(s => s.isCurrent) || sessions[0];
  const otherSessions = sessions.filter(s => s.id !== currentSession?.id);

  const getCleanModel = (s?: SessionItem | null) => {
    if (!s) return 'Current Device';
    if (s.model && !s.model.toLowerCase().includes('browser session') && s.model !== 'K') {
      return s.model;
    }
    if (s.deviceName) {
      const stripped = s.deviceName.split('•')[0].trim();
      if (stripped && !stripped.toLowerCase().includes('browser session')) {
        return stripped;
      }
    }
    if (s.deviceType === 'mobile') return 'Mobile Phone';
    if (s.deviceType === 'tablet') return 'Tablet';
    if (s.os && !s.os.includes('Unknown')) return `${s.os} PC`;
    return 'Personal Computer';
  };

  const getCleanLocation = (s?: SessionItem | null) => {
    if (!s) return '';
    if (s.location && !s.location.toLowerCase().includes('unknown') && !s.location.toLowerCase().includes('unavailable')) {
      return s.location;
    }
    if (s.deviceName && s.deviceName.includes('•')) {
      const parts = s.deviceName.split('•');
      if (parts[1] && parts[1].trim()) return parts[1].trim();
    }
    return '';
  };

  const handleRevokeSingle = async () => {
    if (!selectedSessionForLogout) return;
    setIsActionLoading(true);
    try {
      await api.auth.revokeSession(selectedSessionForLogout.id);
      addToast({
        title: 'Logged Out',
        message: `Successfully logged out from ${getCleanModel(selectedSessionForLogout)}.`,
        type: 'success',
      });
      setSelectedSessionForLogout(null);
      await fetchSessions(true);
    } catch (err: any) {
      addToast({
        title: 'Logout Failed',
        message: err?.message || 'Could not log out of this device.',
        type: 'warning',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRevokeAllOthers = async () => {
    setIsActionLoading(true);
    try {
      const res = await api.auth.logoutOtherSessions(currentSession?.id);
      addToast({
        title: 'All Other Devices Logged Out',
        message: res.message || `Successfully logged out of other devices.`,
        type: 'success',
      });
      setShowLogoutAllConfirm(false);
      await fetchSessions(true);
    } catch (err: any) {
      addToast({
        title: 'Logout Failed',
        message: err?.message || 'Could not log out of other devices.',
        type: 'warning',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const getDeviceIcon = (deviceType?: string) => {
    const t = (deviceType || '').toLowerCase();
    if (t.includes('mobile') || t.includes('phone') || t.includes('android') || t.includes('iphone')) {
      return Smartphone;
    }
    if (t.includes('tablet') || t.includes('ipad')) {
      return Tablet;
    }
    return Monitor;
  };

  const formatSessionTime = (dateStr?: string) => {
    if (!dateStr) return 'Active recently';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 2) return 'Active now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Active recently';
    }
  };

  const primaryModel = getCleanModel(currentSession);
  const additionalCount = otherSessions.length;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#16181c] p-6 text-white shadow-xl">
      <AnimatePresence mode="wait">
        {currentView === 'accounts' ? (
          // ================= VIEW 1: META ACCOUNTS CENTER OVERVIEW =================
          <motion.div
            key="accounts-view"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white">
                  Where you're logged in
                </h3>
                <p className="mt-1 text-sm text-neutral-400">
                  See what devices are used to log in to your accounts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fetchSessions(false)}
                disabled={isRefreshing}
                title="Refresh sessions"
                className="rounded-xl border border-white/5 bg-white/5 p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCcw size={16} className={isRefreshing ? 'animate-spin text-[var(--color-aeirmist-cyan)]' : ''} />
              </button>
            </div>

            {/* Unrecognized Logins Alert Banner (Meta Style) */}
            {unrecognizedCount > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="shrink-0 text-amber-400" />
                  <span className="text-xs sm:text-sm font-medium">
                    We detected unrecognized logins.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView('devices')}
                  className="text-xs sm:text-sm font-bold text-[var(--color-aeirmist-cyan)] hover:underline shrink-0 ml-2"
                >
                  Review devices
                </button>
              </div>
            )}

            {/* Section: Accounts */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Accounts
              </h4>

              {/* Account Card (Meta layout matching uploaded image) */}
              <button
                type="button"
                onClick={() => setCurrentView('devices')}
                className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-[#1c1f24] p-4 text-left transition-all hover:bg-white/5 hover:border-white/20 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Avatar with Aeirmist badge */}
                  <div className="relative shrink-0">
                    <img
                      src={profile?.avatarKey || user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={profile?.displayName || 'User'}
                      className="h-12 w-12 rounded-full object-cover border border-white/10"
                    />
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-aeirmist-cyan)] text-black ring-2 ring-[#1c1f24]">
                      <ShieldCheck size={11} className="stroke-[3]" />
                    </div>
                  </div>

                  {/* Account Name & Primary Device */}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate text-base">
                      {profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'My Account'}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-400 flex items-center gap-1.5 truncate">
                      <span className="font-medium text-neutral-300">{primaryModel}</span>
                      {additionalCount > 0 && (
                        <span className="text-neutral-500">
                          · + {additionalCount} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Chevron */}
                <ChevronRight
                  size={20}
                  className="text-neutral-500 transition-transform group-hover:translate-x-1 group-hover:text-white shrink-0 ml-2"
                />
              </button>
            </div>
          </motion.div>
        ) : (
          // ================= VIEW 2: DEVICE DRILL-DOWN / MANAGEMENT =================
          <motion.div
            key="devices-view"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Top Back Navigation */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <button
                type="button"
                onClick={() => setCurrentView('accounts')}
                className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={16} />
                <span>Accounts overview</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncLiveGpsLocation(true)}
                  disabled={isSyncingLiveLocation}
                  title="Detect and refresh live GPS location"
                  className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-aeirmist-cyan)] hover:underline disabled:opacity-50"
                >
                  <Navigation size={12} className={isSyncingLiveLocation ? 'animate-spin' : ''} />
                  <span>{isSyncingLiveLocation ? 'Detecting GPS...' : 'Refresh GPS'}</span>
                </button>
                <span className="text-xs font-medium text-neutral-500">
                  {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
                </span>
              </div>
            </div>

            {/* Current Device Section */}
            {currentSession && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    This device
                  </h4>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active now
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4">
                  <div className="flex items-start gap-3.5">
                    {(() => {
                      const Icon = getDeviceIcon(currentSession.deviceType);
                      return (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Icon size={22} />
                        </div>
                      );
                    })()}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">
                          {getCleanModel(currentSession)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-neutral-300">
                        <span>{currentSession.browser || 'Web Browser'} ({currentSession.os || 'OS'})</span>
                        {getCleanLocation(currentSession) && (
                          <span className="flex items-center gap-1 font-medium text-emerald-400">
                            <MapPin size={12} />
                            {getCleanLocation(currentSession)}
                          </span>
                        )}
                        {currentSession.ipAddress && (
                          <span className="text-neutral-500 font-mono text-[11px]">
                            {currentSession.ipAddress}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other Devices Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Other devices logged in ({otherSessions.length})
                </h4>
                {otherSessions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowLogoutAllConfirm(true)}
                    className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Log out of all
                  </button>
                )}
              </div>

              {otherSessions.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-neutral-500">
                  <ShieldCheck size={28} className="mx-auto mb-2 text-neutral-600" />
                  No other active devices logged in to this account.
                </div>
              ) : (
                <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#1c1f24] overflow-hidden">
                  {otherSessions.map((s) => {
                    const Icon = getDeviceIcon(s.deviceType);
                    const isSuspicious = s.isTrusted === false;
                    const cleanLoc = getCleanLocation(s);
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between p-4 transition-colors hover:bg-white/[0.02] ${
                          isSuspicious ? 'bg-amber-500/[0.04]' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 pr-2">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                              isSuspicious
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                                : 'border-white/10 bg-white/5 text-neutral-300'
                            }`}
                          >
                            <Icon size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-sm truncate">
                                {getCleanModel(s)}
                              </span>
                              {isSuspicious && (
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 uppercase">
                                  Unrecognized
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-400 truncate">
                              {s.browser || 'Browser'} · {s.os || 'OS'}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                              {cleanLoc && (
                                <span className="flex items-center gap-1 text-neutral-300">
                                  <MapPin size={10} className="text-neutral-400" />
                                  {cleanLoc}
                                </span>
                              )}
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {formatSessionTime(s.lastActiveAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Individual Logout Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedSessionForLogout(s)}
                          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-300 transition-all"
                        >
                          Log out
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom: Log Out of All Other Devices Button */}
            {otherSessions.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutAllConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
                >
                  <LogOut size={16} />
                  <span>Log out of all other devices</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal: Single Device Logout */}
      <AnimatePresence>
        {selectedSessionForLogout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#18191a] p-6 text-white shadow-2xl"
            >
              <h3 className="text-lg font-bold">Log out of this device?</h3>
              <p className="mt-2 text-xs text-neutral-400">
                Are you sure you want to log out of{' '}
                <strong className="text-white">
                  {getCleanModel(selectedSessionForLogout)}
                </strong>
                ? This session will be terminated immediately.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSessionForLogout(null)}
                  disabled={isActionLoading}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRevokeSingle}
                  disabled={isActionLoading}
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors disabled:opacity-50"
                >
                  {isActionLoading ? 'Logging out...' : 'Log out'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal: All Other Devices Logout */}
      <AnimatePresence>
        {showLogoutAllConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#18191a] p-6 text-white shadow-2xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 mb-4 border border-rose-500/20">
                <LogOut size={22} />
              </div>
              <h3 className="text-lg font-bold">Log out of all other devices?</h3>
              <p className="mt-2 text-xs text-neutral-400">
                This will terminate <strong className="text-white">{otherSessions.length} other session(s)</strong> across all phones, tablets, and computers. You will stay logged in on this current device.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutAllConfirm(false)}
                  disabled={isActionLoading}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRevokeAllOthers}
                  disabled={isActionLoading}
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors disabled:opacity-50"
                >
                  {isActionLoading ? 'Logging out...' : 'Log out all'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
