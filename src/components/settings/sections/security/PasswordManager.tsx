import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ShieldCheck, Lock, AlertCircle, Sparkles, X, Loader2 } from 'lucide-react';
import { useAeirmist } from '../../../../context/AeirmistContext';
import { 
  EmailAuthProvider, 
  GoogleAuthProvider, 
  linkWithCredential, 
  reauthenticateWithCredential, 
  reauthenticateWithPopup, 
  updatePassword, 
  updateEmail,
  verifyBeforeUpdateEmail,
  sendPasswordResetEmail,
  AuthError 
} from 'firebase/auth';
import { auth } from '../../../../lib/firebase';
import { Mail, Plus } from 'lucide-react';
import { logger } from '@/src/utils/logger';


interface PasswordManagerProps {
  hasPassword: boolean;
  onPasswordChange?: (hasPasswordNow: boolean) => void;
}

const RuleIndicator = ({ active, label }: { active: boolean; label: string }) => (
  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold">
    <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-aeirmist-cyan' : 'bg-white/10'}`} />
    <span className={active ? 'text-white/80' : 'text-white/30'}>{label}</span>
  </div>
);

const PasswordManager: React.FC<PasswordManagerProps> = ({ hasPassword, onPasswordChange }) => {
  const { user, addToast, updateProfile, logActivity } = useAeirmist();
  
  // Form State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [emailInput, setEmailInput] = useState('');
  
  // Show/Hide Password States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isAutoLinking, setIsAutoLinking] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleForgotPassword = async () => {
    if (!user || !user.email) {
      addToast({ title: 'Email Required', message: 'No email address associated with this account.', type: 'warning' });
      return;
    }
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      await logActivity('password_reset_request', `Sent password reset link to ${user.email}`);
      addToast({
        title: 'Security Protocol Updated',
        message: `A password reset link has been dispatched to ${user.email}. Verification is required to proceed.`,
        type: 'success',
        icon: <ShieldCheck size={18} />
      });
    } catch (error: any) {
      logger.error('Password reset error:', error);
      addToast({ title: 'Reset Request Failed', message: 'Failed to send password reset email.', type: 'warning' });
    } finally {
      setIsSendingReset(false);
    }
  };

  // Auto-resolve missing email if trusted provider email exists
  useEffect(() => {
    const autoLinkEmail = async () => {
      if (user && !user.email && !isAutoLinking) {
        const trustedEmail = user.providerData.find(p => p.email)?.email;
        if (trustedEmail) {
          setIsAutoLinking(true);
          try {
            await updateEmail(user, trustedEmail);
            await logActivity('email_auto_sync', `Auto-linked trusted email ${trustedEmail} to user.`);
          } catch (error: any) {
            logger.error('[Security] Auto-link email failed:', error);
          } finally {
            setIsAutoLinking(false);
          }
        }
      }
    };
    autoLinkEmail();
  }, [user, logActivity, isAutoLinking]);

  // Reauthentication Modal States
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [isReauthorizing, setIsReauthorizing] = useState(false);
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<'create' | 'update' | 'add_email' | null>(null);

  // Real-time strength rules calculation
  const rules = {
    length: password.length >= 8 && password.length <= 64,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/.test(password),
  };

  const strength = Object.values(rules).filter(Boolean).length;

  const handleAddEmail = async () => {
    if (!user) return;
    if (!emailInput || !emailInput.includes('@')) {
      addToast({ title: 'Validation Error', message: 'Please enter a valid email address.', type: 'warning' });
      return;
    }

    setIsUpdatingEmail(true);
    try {
      // Manual addition always uses verification link for security
      await verifyBeforeUpdateEmail(user, emailInput);
      await logActivity('email_addition', `Verification sent to ${emailInput} for user linkage.`);
      addToast({ 
        title: 'Verification Sent', 
        message: 'Verification email sent — please check your inbox and click the link to confirm this email address.', 
        type: 'success' 
      });
      setEmailInput('');
    } catch (error: any) {
      logger.error('Email addition error:', error);
      if (error.code === 'auth/requires-recent-login') {
        setPendingAction('add_email');
        setShowReauthModal(true);
        addToast({ title: 'Identity Verification', message: 'Please confirm your identity to link this email.', type: 'info' });
      } else {
        addToast({ title: 'Error', message: 'Failed to link email.', type: 'warning' });
      }
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handlePasswordAction = async () => {
    if (!user) {
        addToast({ title: 'Auth Error', message: 'User session not found.', type: 'warning' });
        return;
    }
    
    if (!user.email) {
      addToast({ 
        title: 'Email Required', 
        message: 'You need to add an email address to your account before creating a password. Please use the form above.', 
        type: 'warning' 
      });
      return;
    }

    // Client-side validations
    if (password !== confirmPassword) {
      addToast({ title: 'Validation Error', message: 'Confirm password does not match.', type: 'warning' });
      return;
    }
    if (strength < 5) {
      addToast({ title: 'Validation Error', message: 'Password must satisfy all strength rules.', type: 'warning' });
      return;
    }
    if (hasPassword) {
      if (!currentPassword) {
        addToast({ title: 'Validation Error', message: 'Please enter your current password.', type: 'warning' });
        return;
      }
      if (password === currentPassword) {
        addToast({ title: 'Validation Error', message: 'New password must be different from current password.', type: 'warning' });
        return;
      }
    }

    setIsLoading(true);

    try {
      if (hasPassword) {
        // Change Password Form Submission
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, password);
        await updateProfile({ lastPasswordChangedAt: new Date().toISOString() });
        await logActivity('password_change', 'User successfully changed their login password.');
        addToast({ 
          title: 'Handshake Verified', 
          message: 'Password updated successfully across all grid terminals.', 
          type: 'success',
          icon: <ShieldCheck size={18} />
        });
      } else {
        // Create Password Form Submission
        const credential = EmailAuthProvider.credential(user.email, password);
        try {
          await linkWithCredential(user, credential);
        } catch (linkErr: any) {
          if (
            linkErr.code === 'auth/provider-already-linked' ||
            linkErr.code === 'auth/credential-already-in-use' ||
            linkErr.code === 'auth/email-already-in-use'
          ) {
            await updatePassword(user, password);
          } else {
            throw linkErr;
          }
        }
        await updateProfile({ hasPassword: true, passwordCreatedAt: new Date().toISOString() });
        await logActivity('password_creation', 'User saved a new password to their user.');
        addToast({ 
          title: 'Identity Secured', 
          message: 'Local password created successfully. Universal access enabled.', 
          type: 'success',
          icon: <ShieldCheck size={18} />
        });
        if (onPasswordChange) {
          onPasswordChange(true);
        }
      }
      // Reset inputs on success
      setPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (error: any) {
      logger.error('Password operation error:', error);
      const authError = error as AuthError;
      
      if (authError.code === 'auth/requires-recent-login') {
        setPendingAction(hasPassword ? 'update' : 'create');
        setShowReauthModal(true);
        addToast({ title: 'Identity Verification', message: 'Please confirm your identity to complete this operation.', type: 'info' });
      } else if (authError.code === 'auth/wrong-password') {
        addToast({ title: 'Error', message: 'Current password is incorrect.', type: 'warning' });
      } else if (authError.code === 'auth/weak-password') {
        addToast({ title: 'Error', message: 'New password is too weak.', type: 'warning' });
      } else if (authError.code === 'auth/network-request-failed') {
        addToast({ title: 'Error', message: 'Network error, please try again.', type: 'warning' });
      } else {
        addToast({ title: 'Error', message: authError.message || 'An unexpected error occurred.', type: 'warning' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReauthConfirm = async () => {
    if (!user || !pendingAction) return;
    setIsReauthorizing(true);

    try {
      const hasPasswordProvider = user.providerData.some(p => p.providerId === 'password');
      
      if (hasPasswordProvider && user.email) {
        if (!reauthPassword) {
          addToast({ title: 'Authentication Error', message: 'Please enter your current password.', type: 'warning' });
          setIsReauthorizing(false);
          return;
        }
        // Reauthenticate using Password Credential
        const credential = EmailAuthProvider.credential(user.email, reauthPassword);
        await reauthenticateWithCredential(user, credential);
      } else {
        // Reauthenticate using Google Popup Flow
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      }

      addToast({ title: 'Verification Success', message: 'Identity verified. Retrying operation...', type: 'success' });
      setShowReauthModal(false);
      
      // Automatic execution of the pending action
      if (pendingAction === 'update') {
        // Retry Password Update
        await updatePassword(user, password);
        await updateProfile({ lastPasswordChangedAt: new Date().toISOString() });
        await logActivity('password_change', 'User successfully changed password after reauthentication.');
        addToast({ title: 'Success', message: 'Password updated successfully.', type: 'success' });
        setPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
      } else if (pendingAction === 'create') {
        // Retry Password Create/Link
        if (user.email) {
          const credential = EmailAuthProvider.credential(user.email, password);
          try {
            await linkWithCredential(user, credential);
          } catch (linkErr: any) {
            if (
              linkErr.code === 'auth/provider-already-linked' ||
              linkErr.code === 'auth/credential-already-in-use' ||
              linkErr.code === 'auth/email-already-in-use'
            ) {
              await updatePassword(user, password);
            } else {
              throw linkErr;
            }
          }
          await updateProfile({ hasPassword: true, passwordCreatedAt: new Date().toISOString() });
          await logActivity('password_creation', 'User successfully created password after reauthentication.');
          addToast({ title: 'Success', message: 'Password created successfully.', type: 'success' });
          if (onPasswordChange) {
            onPasswordChange(true);
          }
          setPassword('');
          setConfirmPassword('');
          setCurrentPassword('');
        }
      } else if (pendingAction === 'add_email') {
        // Retry Email Addition
        await verifyBeforeUpdateEmail(user, emailInput);
        await logActivity('email_addition', `Verification sent to ${emailInput} after reauthentication.`);
        addToast({ 
          title: 'Verification Sent', 
          message: 'Verification email sent — please check your inbox and click the link to confirm this email address.', 
          type: 'success' 
        });
        setEmailInput('');
      }
      setReauthPassword('');
      setPendingAction(null);
    } catch (reauthErr: any) {
      logger.error('Reauth confirmation failed:', reauthErr);
      let errMsg = 'Reauthentication failed. Please try again.';
      if (reauthErr.code === 'auth/wrong-password') {
        errMsg = 'Incorrect password. Verification rejected.';
      } else if (reauthErr.code === 'auth/popup-closed-by-user') {
        errMsg = 'Google authentication popup was cancelled.';
      }
      addToast({ title: 'Authentication Failed', message: errMsg, type: 'warning' });
    } finally {
      setIsReauthorizing(false);
    }
  };

  const isGoogleOnly = user?.providerData?.length === 1 && user.providerData[0].providerId === 'google.com';
  const hasTrustedEmail = user?.providerData?.some(p => p.email);

  return (
    <div className="space-y-5">
      {user && !user.email && !hasTrustedEmail && (
        <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 space-y-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Email Required</h4>
              <p className="text-[10px] text-white/40 uppercase tracking-wider leading-relaxed">
                To create a local password, you must first associate an email address with your user.
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input 
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="identity@aeirmist.social"
                className="w-full h-11 px-4 pl-12 rounded-xl bg-white/[0.03] border border-white/10 text-white focus:outline-none focus:border-aeirmist-cyan/40 text-xs"
              />
            </div>
          </div>

          <button 
            onClick={handleAddEmail}
            disabled={isUpdatingEmail || !emailInput}
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest hover:bg-white/10 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isUpdatingEmail ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} />
            )}
            <span>Link Email Address</span>
          </button>
        </div>
      )}

      {user && !user.email && hasTrustedEmail && (
        <div className="p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 size={24} className="animate-spin text-aeirmist-cyan opacity-40" />
          <p className="text-[10px] uppercase font-mono tracking-widest text-white/20">Saving Identity...</p>
        </div>
      )}

      {user?.email && (
        <>
          {!hasPassword && (
            <div className="p-4 rounded-2xl bg-aeirmist-cyan/5 border border-aeirmist-cyan/20 space-y-2 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-aeirmist-cyan shrink-0" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Legacy & OAuth Account Upgrade</h4>
              </div>
              <p className="text-[10px] text-white/60 uppercase tracking-wider leading-relaxed">
                You are currently signed in via external provider or legacy token. Create a password below to enable password authentication across all terminals.
              </p>
            </div>
          )}

          {hasPassword && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Current Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isSendingReset}
                  className="text-[9px] font-bold uppercase tracking-widest text-aeirmist-cyan hover:underline cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {isSendingReset && <Loader2 size={10} className="animate-spin" />}
                  <span>Forgot Password? Reset via Email</span>
                </button>
              </div>
              <div className="relative">
                <input 
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-11 px-4 pr-12 rounded-xl bg-white/[0.03] border border-white/10 text-white focus:outline-none focus:border-aeirmist-cyan/40 text-xs"
                />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">New Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full h-11 px-4 pr-12 rounded-xl bg-white/[0.03] border border-white/10 text-white focus:outline-none focus:border-aeirmist-cyan/40 text-xs"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Confirm New Password</label>
            <div className="relative">
              <input 
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Verify new password"
                className="w-full h-11 px-4 pr-12 rounded-xl bg-white/[0.03] border border-white/10 text-white focus:outline-none focus:border-aeirmist-cyan/40 text-xs"
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          
          {/* Dynamic Password Strength Visualizer */}
          <div className="space-y-3 pt-1">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <div key={level} className={`h-1 rounded-full flex-1 transition-all duration-300 ${strength >= level ? 'bg-aeirmist-cyan' : 'bg-white/10'}`} />
              ))}
            </div>

            {/* Live Requirement Checklist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pb-2">
              <RuleIndicator active={rules.length} label="8 to 64 characters" />
              <RuleIndicator active={rules.uppercase} label="Uppercase (A-Z)" />
              <RuleIndicator active={rules.lowercase} label="Lowercase (a-z)" />
              <RuleIndicator active={rules.number} label="At least one number (0-9)" />
              <RuleIndicator active={rules.special} label="Special symbol (!@#$%^&*)" />
            </div>
          </div>

          <button 
            onClick={handlePasswordAction}
            disabled={isLoading || strength < 5 || password !== confirmPassword || (hasPassword && !currentPassword)}
            className="w-full py-3.5 rounded-xl bg-aeirmist-cyan text-black font-black uppercase text-xs tracking-widest hover:bg-aeirmist-cyan/90 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving settings...</span>
              </>
            ) : (
              hasPassword ? 'Change Password' : 'Create Password'
            )}
          </button>
        </>
      )}

      {/* Reauthentication Modal Backdrop & Dialogue Container */}
      {showReauthModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#090D16]/75 backdrop-blur-2xl border border-white/10 space-y-5 shadow-2xl relative">
            <button 
              type="button" 
              onClick={() => {
                setShowReauthModal(false);
                setReauthPassword('');
                setPendingAction(null);
              }}
              className="absolute right-5 top-5 text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-400">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-white uppercase tracking-wider text-sm">Security Verification</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Identify matrix handshake check</p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              For your account security, please verify your identity before performing this high-privilege credential operation.
            </p>

            {isGoogleOnly ? (
              <div className="py-2">
                <button 
                  type="button"
                  onClick={handleReauthConfirm}
                  disabled={isReauthorizing}
                  className="w-full py-3 rounded-xl bg-white text-black font-black uppercase text-xs tracking-widest hover:bg-white/90 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                >
                  {isReauthorizing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.81-2.52-.81-3.13-.03-6.57H5.84z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  <span>Confirm with Google</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Current Password</label>
                  <div className="relative">
                    <input 
                      type={showReauthPassword ? 'text' : 'password'}
                      value={reauthPassword}
                      onChange={(e) => setReauthPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full h-11 px-4 pr-12 rounded-xl bg-white/[0.03] border border-white/10 text-white focus:outline-none focus:border-aeirmist-cyan/40 text-xs"
                    />
                    <button type="button" onClick={() => setShowReauthPassword(!showReauthPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
                      {showReauthPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowReauthModal(false);
                      setReauthPassword('');
                      setPendingAction(null);
                    }}
                    className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-white/80 font-bold uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleReauthConfirm}
                    disabled={isReauthorizing || !reauthPassword}
                    className="flex-1 py-3 rounded-xl bg-aeirmist-cyan text-black font-black uppercase text-[10px] tracking-widest hover:bg-aeirmist-cyan/90 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isReauthorizing ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={12} />
                    )}
                    <span>Confirm</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswordManager;
