import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Send, LogOut, Download, Clock, Info, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


export const BannedScreen: React.FC = () => {
  const { profile, user, logout, db, addToast, updateProfile } = useAeirmist();
  const [appealReason, setAppealReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const suspensionInfo = profile?.suspensionInfo || {};
  const expiresAt = suspensionInfo.expiresAt ? new Date(suspensionInfo.expiresAt).getTime() : null;
  const isSuspensionExpired = Boolean(expiresAt && Date.now() >= expiresAt);

  const handleRestoreAccount = async () => {
    if (!profile?.id || !db) return;
    if (!isSuspensionExpired) {
      addToast({
        title: 'Suspension Active',
        message: 'Your suspension period is still active. Please submit an appeal for moderator review.',
        type: 'warning'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const profileRef = doc(db, 'profiles', profile.id);
      await updateDoc(profileRef, {
        isBanned: false,
        status: 'ACTIVE',
        suspensionInfo: null
      });
      addToast({
        title: 'Account Restored',
        message: 'Your temporary suspension has ended. Welcome back!',
        type: 'success'
      });
    } catch (err) {
      logger.error('Failed to update profile directly, trying updateProfile fallback:', err);
      try {
        await updateProfile({
          isBanned: false,
          status: 'ACTIVE',
          suspensionInfo: null
        });
        addToast({
          title: 'Account Restored',
          message: 'Your temporary suspension has ended.',
          type: 'success'
        });
      } catch (err2) {
        logger.error('Failed to unban profile:', err2);
        addToast({
          title: 'Restoration Error',
          message: 'Could not restore account directly. Please contact support.',
          type: 'warning'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('Permanent Suspension');
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const diff = expiresAt - now;
      if (diff <= 0) {
        setTimeLeft('Suspension Expired');
        clearInterval(timer);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s remaining`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !appealReason.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'appeals'), {
        userId: user.uid,
        username: profile?.username || 'Anonymous',
        userEmail: user.email,
        reason: appealReason.trim(),
        status: 'pending',
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      });
      setSubmitted(true);
      addToast({
        title: 'Appeal Submitted',
        message: 'Your appeal has been received and is pending moderator review.',
        type: 'success'
      });
    } catch (error) {
      logger.error('Appeal submission failed:', error);
      addToast({
        title: 'Submission Error',
        message: 'Could not submit appeal. Please try again later.',
        type: 'warning'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      profile,
      user: { uid: user?.uid, email: user?.email },
      suspensionInfo,
      exportedAt: new Date().toISOString()
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aeirmist_account_export_${user?.uid.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#030712] flex items-center justify-center p-6 overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.08)_0%,transparent_70%)]" />
      <div className="absolute top-1/4 left-1/4 w-[50vw] h-[50vw] bg-red-500/5 rounded-full blur-[10vw] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg"
      >
        <div className="glass-panel p-8 md:p-10 rounded-[32px] border-red-500/20 bg-black/50 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] space-y-8">
          
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
                <ShieldAlert size={40} className="drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
              </div>
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-3xl border border-red-500/40"
              />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-black uppercase tracking-[0.3em] text-white">Account Suspended</h1>
              <p className="text-[10px] font-mono tracking-widest text-red-400/80 uppercase">
                Contact support if you believe this is an error.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center text-white/60">
                <span>Reason:</span>
                <span className="text-amber-400 font-bold uppercase">{suspensionInfo.reason || 'Community Guideline Violation'}</span>
              </div>
              <div className="flex justify-between items-center text-white/60">
                <span>Duration:</span>
                <span className="text-white font-bold">{suspensionInfo.duration || 'Temporary'}</span>
              </div>
              <div className="flex justify-between items-center text-white/60">
                <span>Time Remaining:</span>
                <span className="text-red-400 font-bold">{timeLeft}</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-3"
                >
                  <ShieldCheck size={24} className="mx-auto text-emerald-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Appeal Submitted</p>
                  <p className="text-[9px] text-emerald-400/70 leading-relaxed">
                    Our moderation team is reviewing your request. Updates will be sent to your registered email address.
                  </p>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="text-left space-y-2">
                    <label className="text-[9px] font-semibold uppercase tracking-wider text-white/40 px-1">Submit Appeal</label>
                    <textarea 
                      value={appealReason}
                      onChange={(e) => setAppealReason(e.target.value)}
                      placeholder="Explain why your access should be restored..."
                      className="w-full h-32 p-4 bg-white/[0.03] border border-white/10 rounded-2xl text-xs text-white placeholder:text-white/20 resize-none focus:border-red-500/40 focus:bg-white/[0.05] transition-all outline-none font-sans"
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    {isSuspensionExpired && (
                      <button
                        onClick={handleRestoreAccount}
                        disabled={isSubmitting}
                        className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-30 active:scale-[0.98]"
                      >
                        {isSubmitting ? (
                          <RefreshCw size={18} className="animate-spin" />
                        ) : (
                          <>
                            <RotateCcw size={18} />
                            Restore Account
                          </>
                        )}
                      </button>
                    )}

                    <div className="flex gap-3">
                      <button 
                        onClick={handleDownloadData}
                        className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 text-white/80 font-semibold uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                      >
                        <Download size={14} />
                        Export Data
                      </button>
                      <button 
                        onClick={handleSubmitAppeal}
                        disabled={isSubmitting || !appealReason.trim()}
                        className="flex-[2] h-12 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold uppercase tracking-wider text-xs flex items-center justify-center gap-2 hover:bg-white/20 transition-all disabled:opacity-30 active:scale-[0.98]"
                      >
                        {isSubmitting ? (
                          <RefreshCw size={18} className="animate-spin" />
                        ) : (
                          <>
                            <Send size={16} />
                            Submit Appeal
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
            <button 
              onClick={() => logout()}
              className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-white/60 font-semibold uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 hover:text-white hover:bg-white/10 transition-all"
            >
              <LogOut size={14} />
              Log Out
            </button>
            <div className="flex items-center justify-between text-[9px] text-white/30 font-sans px-1">
              <span>Aeirmist Moderation</span>
              <span>Status: Suspended</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
