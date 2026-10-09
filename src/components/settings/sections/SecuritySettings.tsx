import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck,
  Lock, 
  Smartphone, 
  History, 
  Mail, 
  Phone, 
  Fingerprint, 
  AlertCircle, 
  LogOut, 
  Key, 
  ArrowLeft, 
  ChevronRight, 
  X,
  CheckCircle2, 
  XCircle, 
  Monitor, 
  Tablet, 
  MapPin, 
  Trash2, 
  RefreshCcw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { mapAuthError } from '../../../utils/authErrorMapper';
import { EmailAuthProvider, sendEmailVerification, GoogleAuthProvider, reauthenticateWithPopup, reauthenticateWithCredential } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import PasswordManager from './security/PasswordManager';
import { AccountSecurityScore } from './security/AccountSecurityScore';
import { DevicesAndSessions } from './security/DevicesAndSessions';
import { EmailChangeModal } from './security/EmailChangeModal';
import { SecurityTimeline } from './security/SecurityTimeline';
import { logger } from '@/src/utils/logger';


const SectionHeader = ({ title, desc }: { title: string, desc: string }) => (
  <div className="mb-6">
    <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
    <p className="text-sm text-white/40 mt-1">{desc}</p>
  </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 space-y-4 ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ icon: Icon, title, desc, status, statusColor, statusIcon: StatusIcon }: { icon: any, title: string, desc: string, status?: string, statusColor?: string, statusIcon?: any }) => (
  <div className="flex items-start justify-between">
    <div className="flex items-start gap-4">
      <div className="p-3 rounded-2xl bg-white/5 text-[var(--color-aeirmist-cyan)]">
        <Icon size={20} />
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-white uppercase tracking-widest text-xs">{title}</h3>
        <p className="text-[10px] text-white/40 uppercase tracking-wider leading-relaxed">{desc}</p>
        {status && (
          <div className={`flex items-center gap-1.5 mt-2`}>
            {StatusIcon ? (
              <StatusIcon size={10} className={statusColor ? statusColor.replace('bg-', 'text-') : 'text-[var(--color-aeirmist-cyan)]'} />
            ) : (
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor || 'bg-[var(--color-aeirmist-cyan)]'}`} />
            )}
            <span className={`text-[9px] font-black uppercase tracking-widest ${statusColor ? statusColor.replace('bg-', 'text-') : 'text-[var(--color-aeirmist-cyan)]'}`}>
              {status}
            </span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const SecuritySettings = () => {
  const { user, profile, addToast, logout, deleteAccount, updateProfile, logActivity, db } = useAeirmist();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [activeSubSection, setActiveSubSection] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [sessionsCount, setSessionsCount] = useState<number>(1);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showCodesModal, setShowCodesModal] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReauthPassword, setShowReauthPassword] = useState(false);

  const isGoogleOnly = user?.providerData.length === 1 && user.providerData[0].providerId === 'google.com';

  const [recoveryEmail, setRecoveryEmail] = useState(profile?.recoveryEmail || '');
  const [recoveryPhone, setRecoveryPhone] = useState(profile?.recoveryPhone || '');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(profile?.twoFactorEnabled || false);

  useEffect(() => {
    if (profile) {
      setRecoveryEmail(profile.recoveryEmail || '');
      setRecoveryPhone(profile.recoveryPhone || '');
      setTwoFactorEnabled(profile.twoFactorEnabled || false);
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      const passwordProvider = user.providerData.find(
        (provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID
      );
      setHasPassword(!!passwordProvider);
    }
  }, [user]);

  // Load activities timeline
  useEffect(() => {
    if (!db || !user) return;

    const q = query(
      collection(db, 'activities'),
      where('userId', '==', user.uid),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activityData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const sorted = activityData.sort((a, b) => {
        const timeA = (a as any).timestamp?.toMillis ? (a as any).timestamp.toMillis() : 0;
        const timeB = (b as any).timestamp?.toMillis ? (b as any).timestamp.toMillis() : 0;
        return timeB - timeA;
      });
      
      setActivities(sorted);
    }, (error) => {
      logger.warn("Security activities snapshot failed:", error);
    });

    return () => unsubscribe();
  }, [db, user]);

  // Active sessions count listener
  useEffect(() => {
    if (!db || !user) return;

    const q = query(
      collection(db, 'login_sessions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeDocs = snapshot.docs.filter(d => !d.data().revoked);
      setSessionsCount(activeDocs.length || 1);
    });

    return () => unsubscribe();
  }, [db, user]);

  const handleConfirmDelete = async () => {
    if (!user) return;
    if (deleteConfirmation !== 'DELETE') {
      addToast({ title: 'Error', message: 'Please type DELETE to confirm.', type: 'warning' });
      return;
    }
    setIsDeleting(true);
    try {
      if (!isGoogleOnly && !reauthPassword) {
        addToast({ title: 'Authentication Error', message: 'Please enter your current password.', type: 'warning' });
        setIsDeleting(false);
        return;
      }
      if (isGoogleOnly) {
        try {
          const provider = new GoogleAuthProvider();
          await reauthenticateWithPopup(user, provider);
        } catch (popupError: any) {
          logger.warn('Google reauthentication popup failed. Proceeding with deletion...', popupError);
        }
      } else if (user.email) {
        const credential = EmailAuthProvider.credential(user.email, reauthPassword);
        await reauthenticateWithCredential(user, credential);
      }
      
      await deleteAccount();
      addToast({ title: 'Account Deleted', message: 'Your user data has been completely erased.', type: 'success' });
    } catch (error: any) {
      logger.error('Deletion error:', error);
      addToast({ title: 'Deletion Failed', message: 'Could not delete account.', type: 'warning' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!user) return;
    if (!user.email) {
      addToast({ title: 'Verification Error', message: 'No registered email address found for this user account. Please update your email address first.', type: 'warning' });
      return;
    }
    setIsLoading('verify_email');
    try {
      await sendEmailVerification(user);
      await logActivity('email_verification_sent', `Verification email dispatched to ${user.email}`);
      addToast({ title: 'Success', message: 'Verification email sent. Please check your inbox.', type: 'success' });
    } catch (error: any) {
      addToast({ title: 'Error', message: mapAuthError(error), type: 'warning' });
    } finally {
      setIsLoading(null);
    }
  };

  const generateBackupCodes = async () => {
    const codes = [];
    const hashes = [];
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 8; i++) {
      let code = '';
      const randomValues = new Uint32Array(8);
      crypto.getRandomValues(randomValues);
      for (let j = 0; j < 8; j++) {
        code += charset[randomValues[j] % charset.length];
      }
      const formattedCode = `${code.slice(0, 4)}-${code.slice(4, 8)}`;
      codes.push(formattedCode);
      
      const msgUint8 = new TextEncoder().encode(formattedCode);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      hashes.push(hashHex);
    }
    return { codes, hashes };
  };

  const handleToggle2FA = async () => {
    setIsLoading('2fa');
    try {
      const newState = !twoFactorEnabled;
      
      if (newState) {
        const { codes, hashes } = await generateBackupCodes();
        await updateProfile({ 
          twoFactorEnabled: true,
          backupCodeHashes: hashes,
          backupCodesUsed: []
        });
        setBackupCodes(codes);
        setShowCodesModal(true);
        setTwoFactorEnabled(true);
        addToast({ 
          title: '2FA Protocol Active', 
          message: 'Two-factor authentication is now active. Store your recovery codes securely.', 
          type: 'success',
          icon: <ShieldCheck size={18} />
        });
      } else {
        if (window.confirm("Disable 2FA? This significantly reduces your account security status.")) {
          await updateProfile({ twoFactorEnabled: false });
          setTwoFactorEnabled(false);
          addToast({ 
            title: 'Security Reduced', 
            message: '2FA protection has been deactivated.', 
            type: 'warning' 
          });
        }
      }
      await logActivity('2fa_status_change', `Two-factor authentication ${newState ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      addToast({ title: 'Sync Error', message: 'Failed to update security protocol.', type: 'warning' });
    } finally {
      setIsLoading(null);
    }
  };

  const handleActionClick = (actionKey: string) => {
    if (actionKey === 'password_set') setActiveSubSection('password');
    else if (actionKey === 'two_factor') setActiveSubSection('2fa');
    else if (actionKey === 'email_verified') handleVerifyEmail();
    else if (actionKey === 'devices_reviewed') setActiveSubSection('devices');
    else if (actionKey === 'recovery_set') setActiveSubSection('recovery');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[750px] mx-auto space-y-8 pb-20"
    >
      <SectionHeader title="Security & Devices" desc="Unified security score, device management, and access settings." />

      {/* Account Security Score Meter */}
      <AccountSecurityScore
        user={user}
        profile={profile}
        hasPassword={!!hasPassword}
        twoFactorEnabled={twoFactorEnabled}
        sessionsCount={sessionsCount}
        onActionClick={handleActionClick}
      />

      {/* Devices & Sessions Management */}
      <DevicesAndSessions />

      {/* Section 1: Password */}
      <Card>
        <CardHeader 
          icon={Lock} 
          title="Password Management" 
          desc="Set or change your local authentication password."
          status={hasPassword ? 'Password Set' : 'No Password'}
        />
        {activeSubSection === 'password' ? (
          <div className="pt-4 border-t border-white/5 space-y-4">
            <PasswordManager hasPassword={!!hasPassword} onPasswordChange={(status) => setHasPassword(status)} />
            <div className="flex items-center justify-between">
              <button 
                type="button"
                onClick={() => setActiveSubSection(null)}
                className="text-[10px] font-bold text-white/30 uppercase tracking-widest hover:text-white transition-colors cursor-pointer"
              >
                Close Manager
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <button 
              type="button"
              onClick={() => setActiveSubSection('password')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all group cursor-pointer"
            >
              <span className="text-xs font-bold text-white uppercase tracking-widest">
                {hasPassword ? 'Change Password' : 'Create Password'}
              </span>
              <ChevronRight size={16} className="text-white/20 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </Card>

      {/* Section 2: Email Verification & Change */}
      <Card>
        <CardHeader 
          icon={Mail} 
          title="Email & Identity" 
          desc={user?.email || 'No primary email associated'}
          status={user?.emailVerified ? 'Verified' : 'Not Verified'}
          statusColor={user?.emailVerified ? 'bg-[var(--color-aeirmist-cyan)]' : 'bg-orange-500'}
          statusIcon={user?.emailVerified ? ShieldCheck : undefined}
        />
        <div className="flex flex-wrap gap-2 pt-2">
          {!user?.emailVerified && (
            <button 
              type="button"
              onClick={handleVerifyEmail}
              disabled={isLoading === 'verify_email'}
              className="flex-1 min-w-[140px] py-3 rounded-xl bg-[var(--color-aeirmist-cyan)] text-black font-bold uppercase text-[10px] tracking-widest hover:bg-[var(--color-aeirmist-cyan)]/90 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading === 'verify_email' ? 'Sending...' : 'Verify Email'}
            </button>
          )}
          <button 
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="flex-1 min-w-[140px] py-3 rounded-xl bg-white/5 text-white font-bold uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all border border-white/5 cursor-pointer"
          >
            Change Email Address
          </button>
        </div>
      </Card>

      {/* Section 3: 2FA */}
      <Card>
        <CardHeader 
          icon={Shield} 
          title="Two-Factor Authentication" 
          desc="Add an extra layer of protection using recovery codes."
          status={twoFactorEnabled ? 'Active' : 'Disabled'}
          statusColor={twoFactorEnabled ? 'bg-[var(--color-aeirmist-cyan)]' : 'bg-white/20'}
        />
        <button 
          type="button"
          onClick={handleToggle2FA}
          disabled={isLoading === '2fa'}
          className={`w-full py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all cursor-pointer ${twoFactorEnabled ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-[var(--color-aeirmist-cyan)]/10 text-[var(--color-aeirmist-cyan)] hover:bg-[var(--color-aeirmist-cyan)]/20'}`}
        >
          {isLoading === '2fa' ? 'Syncing...' : (twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA')}
        </button>
      </Card>

      {/* Section 4: Biometric / Fingerprint App Lock */}
      <Card>
        <CardHeader 
          icon={Fingerprint} 
          title="Biometric App Lock" 
          desc="Require fingerprint or biometric scan whenever Aeirmist opens."
          status={profile?.securitySettings?.biometricLock ? 'Active' : 'Disabled'}
          statusColor={profile?.securitySettings?.biometricLock ? 'bg-[var(--color-aeirmist-cyan)]' : 'bg-white/20'}
        />
        <button 
          type="button"
          onClick={async () => {
            const nextVal = !profile?.securitySettings?.biometricLock;
            await updateProfile({
              securitySettings: {
                ...(profile?.securitySettings || {}),
                biometricLock: nextVal
              }
            });
            if (nextVal) {
              localStorage.setItem('aeirmist_biometric_lock_enabled', 'true');
            } else {
              localStorage.removeItem('aeirmist_biometric_lock_enabled');
            }
            addToast({
              title: nextVal ? 'Biometric Lock Enabled' : 'Biometric Lock Disabled',
              message: nextVal ? 'Aeirmist will ask for fingerprint scan on launch.' : 'App lock has been turned off.',
              type: 'success'
            });
          }}
          className={`w-full py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all cursor-pointer ${
            profile?.securitySettings?.biometricLock 
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
              : 'bg-[var(--color-aeirmist-cyan)]/10 text-[var(--color-aeirmist-cyan)] hover:bg-[var(--color-aeirmist-cyan)]/20'
          }`}
        >
          {profile?.securitySettings?.biometricLock ? 'Turn Off Biometric Lock' : 'Turn On Biometric Lock'}
        </button>
      </Card>

      {/* Security Events Timeline */}
      <SecurityTimeline activities={activities} />

      {/* Danger Zone */}
      <Card className="border-red-500/20 bg-red-500/[0.02]">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-red-500/10 text-red-400">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white uppercase tracking-widest text-xs">Danger Zone</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-wider leading-relaxed mt-1">
                Permanently erase account profile, posts, marketplace listings, and user records.
              </p>
            </div>
          </div>
        </div>

        {/* Telegram-style "Delete my account - If away for..." */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 my-3">
          <div>
            <h4 className="text-xs font-bold text-white">If away for...</h4>
            <p className="text-[10px] text-white/40 mt-0.5">Account self-destruct timer if inactive</p>
          </div>
          <select
            value={profile?.deleteAccountIfAwayFor || '24 months'}
            onChange={async (e) => {
              await updateProfile({ deleteAccountIfAwayFor: e.target.value });
              addToast({
                title: 'Self-Destruct Setting Saved',
                message: `Auto-deletion timer set to ${e.target.value}.`,
                type: 'success'
              });
            }}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-aeirmist-cyan focus:border-aeirmist-cyan outline-none cursor-pointer"
          >
            <option value="1 month">1 month</option>
            <option value="3 months">3 months</option>
            <option value="6 months">6 months</option>
            <option value="12 months">12 months</option>
            <option value="24 months">24 months</option>
          </select>
        </div>

        <button 
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold uppercase text-[10px] tracking-widest border border-red-500/20 transition-all cursor-pointer"
        >
          Delete Account Permanently
        </button>
      </Card>

      {/* Email Change Modal */}
      <EmailChangeModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#090d16] border border-red-500/30 space-y-5 shadow-2xl relative">
            <button 
              type="button" 
              onClick={() => setShowDeleteModal(false)}
              className="absolute right-5 top-5 text-white/40 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500/10 text-red-400">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-black text-white uppercase tracking-wider text-sm">Delete Account Permanently</h3>
                <p className="text-[10px] text-red-400 uppercase tracking-widest">Irreversible Action</p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              This action will permanently delete your profile, posts, marketplace items, and settings. Type <strong className="text-red-400">DELETE</strong> below to confirm.
            </p>

            <div className="space-y-3">
              <input 
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-red-500/50"
              />

              {!isGoogleOnly && (
                <input 
                  type="password"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs focus:outline-none focus:border-red-500/50"
                />
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-white/70 font-bold uppercase text-[10px] tracking-widest hover:text-white"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-30 transition-all shadow-lg"
              >
                {isDeleting ? 'Deleting...' : 'Erase Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default SecuritySettings;
