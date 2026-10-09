import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, Loader2, Check, ShieldCheck, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useAeirmist } from '../../../../context/AeirmistContext';
import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  verifyBeforeUpdateEmail, 
  GoogleAuthProvider, 
  reauthenticateWithPopup 
} from 'firebase/auth';
import { mapAuthError } from '../../../../utils/authErrorMapper';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


interface EmailChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailChangeModal: React.FC<EmailChangeModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, db, addToast, updateProfile, logActivity } = useAeirmist();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSent, setSuccessSent] = useState(false);

  if (!isOpen) return null;

  const isGoogleUser = user?.providerData.some((p: any) => p.providerId === 'google.com');

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      setError("Please enter a valid email address.");
      return;
    }
    if (newEmail.toLowerCase() === user?.email?.toLowerCase()) {
      setError("New email must be different from your current email.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error("No active user session found.");

      // Re-authenticate user before email update
      if (isGoogleUser) {
        try {
          const provider = new GoogleAuthProvider();
          await reauthenticateWithPopup(user, provider);
        } catch (popupErr) {
          logger.warn("Google popup reauth failed or blocked, attempting direct verification email...", popupErr);
        }
      } else {
        if (!currentPassword) {
          setError("Current password is required to verify email change.");
          setLoading(false);
          return;
        }
        if (user.email) {
          const credential = EmailAuthProvider.credential(user.email, currentPassword);
          await reauthenticateWithCredential(user, credential);
        }
      }

      // Send verification link to new email address before updating
      await verifyBeforeUpdateEmail(user, newEmail);

      // Log activity
      await logActivity('email_change_requested', `Requested email update to ${newEmail}`);

      if (db && profile?.id) {
        await updateDoc(doc(db, 'profiles', profile.id), {
          pendingEmailUpdate: newEmail,
          updatedAt: serverTimestamp()
        });
      }

      setSuccessSent(true);
      addToast({
        title: "VERIFICATION SENT",
        message: `Confirmation email dispatched to ${newEmail}. Please click the link to finalize.`,
        type: "success"
      });

    } catch (err: any) {
      logger.error("Email update error:", err);
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#090d16] border border-white/10 space-y-6 shadow-2xl relative"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-white/40 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 pb-5">
          <div className="p-3 bg-[var(--color-aeirmist-cyan)]/10 rounded-2xl text-[var(--color-aeirmist-cyan)] border border-[var(--color-aeirmist-cyan)]/20">
            <Mail size={22} />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-white">Change Email Address</h3>
            <p className="text-[10px] font-mono text-white/40">Secure Identity Handshake</p>
          </div>
        </div>

        {!successSent ? (
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Current Email</span>
              <p className="text-xs font-mono font-bold text-white">{user?.email}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">New Email Address</label>
              <div className="relative rounded-2xl bg-white/[0.03] border border-white/10 focus-within:border-[var(--color-aeirmist-cyan)]/50 transition-colors">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" size={16} />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                  className="w-full py-3.5 pl-12 pr-4 bg-transparent outline-none text-xs text-white placeholder-white/25"
                  required
                />
              </div>
            </div>

            {!isGoogleUser && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Current Password</label>
                <div className="relative rounded-2xl bg-white/[0.03] border border-white/10 focus-within:border-[var(--color-aeirmist-cyan)]/50 transition-colors">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" size={16} />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password to verify"
                    className="w-full py-3.5 pl-12 pr-4 bg-transparent outline-none text-xs text-white placeholder-white/25"
                    required
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !newEmail}
              className="w-full h-12 rounded-2xl bg-[var(--color-aeirmist-cyan)] text-black font-black uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin text-black" /> : 'Send Verification Email'}
            </button>
          </form>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <Check size={32} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Verification Email Dispatched</h4>
              <p className="text-xs text-white/60 leading-relaxed">
                We sent a confirmation link to <strong className="text-white">{newEmail}</strong>. Please check your inbox and confirm the link to finalize your new email address.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black uppercase text-xs tracking-widest transition-all"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
