import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, ShieldCheck, Loader2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { useTheme } from '../../context/ThemeContext';
import { getAuth, updatePassword, EmailAuthProvider, linkWithCredential } from 'firebase/auth';

const OnboardingRuleIndicator = ({ active, label }: { active: boolean; label: string }) => (
  <div className="flex items-center gap-2 text-[11px] font-semibold">
    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${active ? 'bg-[var(--color-aeirmist-cyan)] shadow-[0_0_8px_var(--color-aeirmist-cyan)]' : 'bg-white/20'}`} />
    <span className={active ? 'text-white/80' : 'text-white/40'}>{label}</span>
  </div>
);

export const PasswordOnboardingModal: React.FC = () => {
  const { activeTheme } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const { addToast, setNeedsPasswordOnboarding } = useAeirmist();

  // Handle early dismissal session checks
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem('aeirmist_dismiss_password_onboarding');
      if (dismissed === 'true') {
        setNeedsPasswordOnboarding(false);
      }
    } catch {}
  }, [setNeedsPasswordOnboarding]);

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

  const handleSubmit = async () => {
    if (password !== confirmPassword) {
      setError("Confirm password does not match.");
      return;
    }
    if (strength < 5) {
      setError("Please ensure your password satisfies all security requirements.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No active user session detected.");
      
      if (currentUser.email) {
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        try {
          await linkWithCredential(currentUser, credential);
        } catch (linkErr: any) {
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
      } else {
        await updatePassword(currentUser, password);
      }
      
      // Update hasPassword flag in Firestore via server API
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
      addToast({ title: 'SUCCESS', message: 'Password secured successfully.', type: 'success' });
      
      if (navigator.vibrate) navigator.vibrate([40, 80]);
      
      // Auto reload to clear modal state after success display
      setTimeout(() => {
        setNeedsPasswordOnboarding(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to update security credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem('aeirmist_dismiss_password_onboarding', 'true');
    } catch {}
    setNeedsPasswordOnboarding(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 15 }} 
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className={`w-full max-w-md overflow-hidden rounded-3xl border border-white/10 ${
          activeTheme.isLight ? 'bg-white text-zinc-900' : 'bg-[#0b0c10]/90 text-white'
        } p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl`}
      >
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex items-center gap-3.5 border-b border-white/5 pb-4">
                <div className="p-3 bg-[var(--color-aeirmist-cyan)]/10 rounded-2xl">
                  <ShieldCheck className="text-[var(--color-aeirmist-cyan)] shrink-0" size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-wider">Secure Your Account</h2>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">Credential Integration</p>
                </div>
              </div>

              <p className="text-xs text-white/60 leading-relaxed">
                Your account was created before password login was introduced. To safeguard your profile and enable password authentication, please establish a secure local password.
              </p>

              {/* Password Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Create Password</label>
                  <div className="relative rounded-2xl bg-white/[0.03] border border-white/10 focus-within:border-[var(--color-aeirmist-cyan)]/40 transition-colors">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="New Password"
                      className="w-full py-3.5 pl-12 pr-12 bg-transparent outline-none text-sm text-white placeholder-white/30"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Confirm Password</label>
                  <div className="relative rounded-2xl bg-white/[0.03] border border-white/10 focus-within:border-[var(--color-aeirmist-cyan)]/40 transition-colors">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      className="w-full py-3.5 pl-12 pr-4 bg-transparent outline-none text-sm text-white placeholder-white/30"
                    />
                  </div>
                </div>

                {/* Strength Meter */}
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
                          className={`h-1 rounded-full flex-1 transition-all duration-500 ${
                            strength >= level ? 'bg-[var(--color-aeirmist-cyan)] shadow-[0_0_8px_var(--color-aeirmist-cyan)]' : 'bg-white/10'
                          }`} 
                        />
                      ))}
                    </div>

                    {/* Requirements Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      <OnboardingRuleIndicator active={rules.length} label="8 to 64 characters" />
                      <OnboardingRuleIndicator active={rules.uppercase} label="Uppercase (A-Z)" />
                      <OnboardingRuleIndicator active={rules.lowercase} label="Lowercase (a-z)" />
                      <OnboardingRuleIndicator active={rules.number} label="At least one number" />
                      <OnboardingRuleIndicator active={rules.special} label="Special symbol (!@#$%)" />
                    </div>
                  </div>
                )}

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2.5 text-red-400 text-xs"
                  >
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Submit and Dismiss Buttons */}
                <div className="pt-2 flex flex-col gap-2.5">
                  <button 
                    onClick={handleSubmit}
                    disabled={loading || strength < 5 || password !== confirmPassword}
                    className="w-full h-11 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs disabled:opacity-40 transition-opacity hover:opacity-95 flex items-center justify-center cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin text-black" />
                    ) : (
                      'Secure Account'
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleDismiss}
                      className="py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-white/50 hover:text-white font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer"
                    >
                      Skip for now
                    </button>
                    <button
                      type="button"
                      onClick={handleDismiss}
                      className="py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-white/50 hover:text-white font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer"
                    >
                      Remind later
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col items-center text-center py-6 space-y-5"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-[var(--color-aeirmist-cyan)]/25 rounded-full blur-2xl scale-125 animate-pulse" />
                <div className="relative w-16 h-16 rounded-full bg-[var(--color-aeirmist-cyan)]/15 border-2 border-[var(--color-aeirmist-cyan)] flex items-center justify-center text-[var(--color-aeirmist-cyan)]">
                  <Sparkles size={28} className="animate-pulse" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-black uppercase tracking-wider text-white">Security Established</h3>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-aeirmist-cyan)]">Password secured successfully.</p>
              </div>

              <p className="text-xs text-white/40 leading-relaxed max-w-[280px]">
                Your security credentials have been updated and saved with your account. Reloading interface...
              </p>

              <div className="w-10 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-[var(--color-aeirmist-cyan)] animate-scan-fast w-full" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};
