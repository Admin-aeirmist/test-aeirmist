import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, ShieldCheck, Loader2, Sparkles, Check, AlertCircle, User, Mail, ShieldAlert } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { useTheme } from '../../context/ThemeContext';
import { getAuth, EmailAuthProvider, linkWithCredential, updatePassword } from 'firebase/auth';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { mapAuthError } from '../../utils/authErrorMapper';
import { logger } from '@/src/utils/logger';


const RuleIndicator = ({ active, label }: { active: boolean; label: string }) => (
  <div className="flex items-center gap-2 text-[11px] font-semibold">
    <div className={`w-2 h-2 rounded-full transition-all duration-300 ${active ? 'bg-[var(--color-aeirmist-cyan)] shadow-[0_0_8px_var(--color-aeirmist-cyan)] scale-110' : 'bg-white/15'}`} />
    <span className={active ? 'text-white font-medium' : 'text-white/35'}>{label}</span>
  </div>
);

export const CompleteYourAccountScreen: React.FC = () => {
  const { activeTheme } = useTheme();
  const { user, profile, db, addToast, setNeedsPasswordOnboarding } = useAeirmist();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCapsLock, setIsCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Monitor Caps Lock status on keypress
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setIsCapsLock(true);
    } else {
      setIsCapsLock(false);
    }
  };

  const rules = {
    length: password.length >= 8 && password.length <= 64,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/.test(password),
  };

  const strength = Object.values(rules).filter(Boolean).length;

  const getStrengthLabel = () => {
    if (password.length === 0) return { label: 'Empty', color: 'text-white/20' };
    if (strength <= 2) return { label: 'Weak', color: 'text-red-400' };
    if (strength === 3) return { label: 'Fair', color: 'text-amber-400' };
    if (strength === 4) return { label: 'Strong', color: 'text-blue-400' };
    return { label: 'Excellent', color: 'text-[var(--color-aeirmist-cyan)]' };
  };

  const handleCompleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Confirm password does not match.");
      return;
    }
    if (strength < 5) {
      setError("Please satisfy all password complexity rules before continuing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser || !currentUser.email) {
        throw new Error("No active user session detected. Please sign in again.");
      }

      // Link Email/Password credential securely to current user
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      try {
        await linkWithCredential(currentUser, credential);
      } catch (linkErr: any) {
        // If credential/provider is already linked or in use, fallback to updatePassword
        if (
          linkErr.code === 'auth/provider-already-linked' ||
          linkErr.code === 'auth/credential-already-in-use' ||
          linkErr.code === 'auth/email-already-in-use'
        ) {
          await updatePassword(currentUser, password);
        } else {
          throw linkErr;
        }
      }

      // Update Firestore profile document
      if (db && profile?.id) {
        const profileRef = doc(db, 'profiles', profile.id);
        await updateDoc(profileRef, {
          hasPassword: true,
          passwordCreated: true,
          passwordCreatedAt: serverTimestamp(),
          providers: arrayUnion('password'),
          lastPasswordUpdate: serverTimestamp()
        });
      }

      // Sync via server API fallback if available
      try {
        const idToken = await currentUser.getIdToken();
        await fetch('/api/auth/set-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ hasPassword: true })
        });
      } catch {}

      setIsSuccess(true);
      addToast({
        title: "ACCOUNT UPDATED",
        message: "Email & Password login enabled for your account.",
        type: "success"
      });

      if (navigator.vibrate) navigator.vibrate([40, 80]);

      setTimeout(() => {
        setNeedsPasswordOnboarding(false);
      }, 1800);

    } catch (err: any) {
      logger.error("Complete Account Linking Error:", err);
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const userPhoto = getAvatarUrl(profile?.photoURL || user?.photoURL, user?.uid);
  const userDisplayName = profile?.displayName || user?.displayName || 'Aeirmist Node';
  const userUsername = profile?.username ? `@${profile.username}` : 'Username not set';
  const userEmail = user?.email || profile?.personalEmail || 'verified@aeirmist.social';

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6 bg-[#030712] overflow-y-auto">
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-full bg-[radial-gradient(circle_at_center,rgba(0,242,255,0.07)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-10 left-10 w-72 h-72 bg-aeirmist-cyan/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-aeirmist-magenta/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#090b11]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.8)] my-auto"
      >
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleCompleteAccount}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyDown}
              className="space-y-6"
            >
              {/* Header Title */}
              <div className="flex items-center gap-3.5 border-b border-white/10 pb-5">
                <div className="p-3 bg-[var(--color-aeirmist-cyan)]/10 rounded-2xl border border-[var(--color-aeirmist-cyan)]/20 shadow-[0_0_15px_rgba(0,242,255,0.15)]">
                  <ShieldCheck className="text-[var(--color-aeirmist-cyan)] shrink-0" size={26} />
                </div>
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wider text-white">Complete Your Account</h1>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-aeirmist-cyan)]">Enable Password Authentication</p>
                </div>
              </div>

              {/* Profile Read-Only Summary Box */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative w-12 h-12 rounded-2xl border border-white/20 overflow-hidden bg-black/50 shrink-0">
                    <img src={userPhoto} alt={userDisplayName} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-bold text-white truncate">{userDisplayName}</h2>
                      <ShieldCheck className="text-[var(--color-aeirmist-cyan)] shrink-0" size={14} />
                    </div>
                    <p className="text-[11px] font-mono text-white/50 truncate">{userUsername}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                    <ShieldCheck className="text-[var(--color-aeirmist-cyan)] shrink-0" size={12} />
                    <span>VERIFIED EMAIL</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40 mt-1 truncate max-w-[150px] sm:max-w-[180px]">{userEmail}</span>
                </div>
              </div>

              {/* Informational Message */}
              <p className="text-xs text-white/60 leading-relaxed">
                You currently log in using Google. To sign in with email and password in the future, please create a password for your account below.
              </p>

              {/* Password Inputs */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Create Password</label>
                  <div className="relative rounded-2xl bg-white/[0.03] border border-white/10 focus-within:border-[var(--color-aeirmist-cyan)]/50 transition-colors">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" size={16} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a secure password"
                      className="w-full py-3.5 pl-12 pr-12 bg-transparent outline-none text-sm text-white placeholder-white/25"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Confirm Password</label>
                  <div className="relative rounded-2xl bg-white/[0.03] border border-white/10 focus-within:border-[var(--color-aeirmist-cyan)]/50 transition-colors">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" size={16} />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="w-full py-3.5 pl-12 pr-12 bg-transparent outline-none text-sm text-white placeholder-white/25"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Caps Lock Warning */}
                {isCapsLock && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"
                  >
                    <ShieldAlert size={14} className="shrink-0" />
                    <span>Caps Lock is ON</span>
                  </motion.div>
                )}

                {/* Password Strength Meter & Live Checklist */}
                {password.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold">
                      <span className="text-white/40 tracking-wider">Password Strength:</span>
                      <span className={`${getStrengthLabel().color} tracking-widest`}>
                        {getStrengthLabel().label}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                            strength >= level ? 'bg-[var(--color-aeirmist-cyan)] shadow-[0_0_10px_var(--color-aeirmist-cyan)]' : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      <RuleIndicator active={rules.length} label="8 to 64 characters" />
                      <RuleIndicator active={rules.uppercase} label="Uppercase letter (A-Z)" />
                      <RuleIndicator active={rules.lowercase} label="Lowercase letter (a-z)" />
                      <RuleIndicator active={rules.number} label="At least one number (0-9)" />
                      <RuleIndicator active={rules.special} label="Special symbol (!@#$%^&*)" />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2.5 text-red-400 text-xs font-medium"
                  >
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Submit Action */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={loading || strength < 5 || password !== confirmPassword}
                    className="w-full h-12 rounded-2xl bg-[var(--color-aeirmist-cyan)] text-black font-black uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 size={18} className="animate-spin text-black" />
                    ) : (
                      <>
                        <ShieldCheck size={18} />
                        <span>Link Password & Complete Account</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col items-center text-center py-8 space-y-5"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-[var(--color-aeirmist-cyan)]/25 rounded-full blur-2xl scale-125 animate-pulse" />
                <div className="relative w-16 h-16 rounded-full bg-[var(--color-aeirmist-cyan)]/15 border-2 border-[var(--color-aeirmist-cyan)] flex items-center justify-center text-[var(--color-aeirmist-cyan)] shadow-[0_0_25px_rgba(0,242,255,0.3)]">
                  <Sparkles size={28} className="animate-pulse" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-black uppercase tracking-wider text-white">Account Verified & Linked</h2>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-aeirmist-cyan)]">Google + Password Login Active</p>
              </div>

              <p className="text-xs text-white/50 leading-relaxed max-w-[300px]">
                You can now log into Aeirmist using either Google Sign-In or your email and new password. Entering network...
              </p>

              <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-[var(--color-aeirmist-cyan)] animate-scan-fast w-full" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
