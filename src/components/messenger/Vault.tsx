import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Unlock, 
  Settings, 
  Search, 
  Plus, 
  X, 
  ArrowLeft, 
  Check, 
  RotateCcw, 
  Key, 
  HelpCircle, 
  Fingerprint, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  LogOut,
  Bell,
  BellOff,
  UserCheck,
  Users,
  MessageSquare,
  Clock,
  Loader2,
  Shield,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  FolderLock,
  Image as ImageLucide
} from 'lucide-react';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  serverTimestamp,
  query,
  collection,
  where,
  onSnapshot,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { getAvatarUrl } from '../../lib/avatar';
import { PrivacyFolderLayout } from './vault/PrivacyFolderLayout';
import { useAeirmist } from '../../context/AeirmistContext';
import { logger } from '@/src/utils/logger';
import { auth } from '../../lib/firebase';


interface VaultProps {
  db: any;
  profile: any;
  chats: any[];
  onSelectChat: (chatId: string) => void;
  onClose: () => void;
  isUnlocked: boolean;
  setIsUnlocked: (val: boolean) => void;
  allProfiles: any[];
  onHome?: () => void;
}

const RECOVERY_QUESTIONS = [
  "What was your childhood nickname?",
  "What is your favorite food?",
  "What is your favorite color?",
  "What was the name of your first school?",
  "What city were you born in?",
  "What is your favorite movie?",
  "What is your dream profession?"
];

interface PinDotsProps {
  length: number;
  value: string;
}

const PinDots: React.FC<PinDotsProps> = ({ length, value }) => {
  return (
    <div className="flex items-center justify-center gap-2.5 my-3" id="vault-pin-dots">
      {Array.from({ length }).map((_, index) => {
        const isFilled = index < value.length;
        return (
          <div
            key={index}
            className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
              isFilled
                ? 'bg-gradient-to-tr from-[#9d4edd] to-[#c77dff] border-transparent shadow-[0_0_12px_rgba(199,125,255,0.8)] scale-110'
                : 'border-white/20 bg-transparent'
            }`}
            id={`vault-pin-dot-${index}`}
          />
        );
      })}
    </div>
  );
};

interface NumericKeypadProps {
  value: string;
  onChange: (val: string) => void;
  maxLength: number;
  disabled?: boolean;
}

const NumericKeypad: React.FC<NumericKeypadProps> = ({ value, onChange, maxLength, disabled = false }) => {
  const handleNumClick = (num: string) => {
    if (!disabled && value.length < maxLength) {
      onChange(value + num);
    }
  };

  const handleBackspace = () => {
    if (!disabled) {
      onChange(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (!disabled) {
      onChange('');
    }
  };

  const buttons = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    'C', '0', '⌫'
  ];

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        handleNumClick(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [value, maxLength, disabled]);

  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4 w-full max-w-[240px] md:max-w-[280px] mx-auto select-none mt-2 md:mt-4" id="vault-numeric-keypad">
      {buttons.map((btn, idx) => {
        const isAction = btn === 'C' || btn === '⌫';
        return (
          <button
            key={idx}
            type="button"
            id={`keypad-btn-${btn}`}
            disabled={disabled}
            onClick={() => {
              if (btn === 'C') handleClear();
              else if (btn === '⌫') handleBackspace();
              else handleNumClick(btn);
            }}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center font-display text-sm md:text-xl font-bold transition-all border outline-none cursor-pointer ${
              disabled 
                ? 'opacity-20 cursor-not-allowed border-transparent text-white/20 bg-transparent'
                : isAction
                  ? 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/10 hover:text-white active:scale-95'
                  : 'bg-[#090412]/80 border-[#c77dff]/20 hover:border-[#7b2cbf] text-[#e2afff] hover:bg-[#7b2cbf]/10 shadow-[0_0_15px_rgba(199,125,255,0.03)] active:scale-95'
            }`}
          >
            {btn}
          </button>
        );
      })}
    </div>
  );
};

export const Vault: React.FC<VaultProps> = ({
  db,
  profile,
  chats,
  onSelectChat,
  onClose,
  isUnlocked,
  setIsUnlocked,
  allProfiles,
  onHome
}) => {
  const { user, addToast, uploadMedia } = useAeirmist();
  const [loading, setLoading] = useState(true);
  const [vaultConfigured, setVaultConfigured] = useState(false);
  const [view, setView] = useState<
    | 'welcome' 
    | 'setup_passcode' 
    | 'confirm_passcode' 
    | 'setup_recovery' 
    | 'setup_device' 
    | 'setup_review' 
    | 'creating' 
    | 'setup_success' 
    | 'login' 
    | 'forgot_passcode'
    | 'forgot_reset_passcode'
    | 'forgot_reset_confirm'
    | 'forgot_reset_success'
    | 'home' 
    | 'settings' 
    | 'add_chat'
    | 'privacy_folder'
    | 'private_chats'
  >('welcome');

  useEffect(() => {
    if (view === 'home' && onHome) {
      onHome();
    }
  }, [view, onHome]);
  
  // Setup Wizard State
  const [passcodeType, setPasscodeType] = useState<'pin6' | 'pin8' | 'password'>('pin6');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeConfirm, setPasscodeConfirm] = useState('');
  const [showPasswordChar, setShowPasswordChar] = useState(false);
  
  // Recovery State (exactly 3 questions chosen during setup)
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([0, 1, 2]);
  const [recoveryAnswers, setRecoveryAnswers] = useState<string[]>(['', '', '']);
  
  // Stored hashes
  const [passcodeHash, setPasscodeHash] = useState('');
  const [recoveryAnswersHashes, setRecoveryAnswersHashes] = useState<string[]>([]);
  
  // Device protection state
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [autoLockDuration, setAutoLockDuration] = useState<string>('300'); // Default 5 mins (300s)
  const [silentNotifications, setSilentNotifications] = useState(false);

  // Active Wizard Loading Message
  const [creatingStep, setCreatingStep] = useState(0);
  const creatingMessages = [
    "Securing your messages...",
    "Setting up recovery...",
    "Opening your vault...",
    "Almost ready..."
  ];

  // Search filter for chats inside Vault
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');
  
  // Add Chats Modal States
  const [activeAddTab, setActiveAddTab] = useState<'existing' | 'following' | 'followers'>('existing');
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [confirmVaultChat, setConfirmVaultChat] = useState<{
    id: string;
    name: string;
    type: 'existing' | 'new';
  } | null>(null);

  // Lockout protection
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Status updates
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  // Password reset on successful recovery
  const [resetPasscodeVal, setResetPasscodeVal] = useState('');
  const [resetPasscodeConfirm, setResetPasscodeConfirm] = useState('');

  // Simulation loading for premium feel
  const [isAppLoading, setIsAppLoading] = useState(false);

  // Cryptographic hashing layer for high offline security compatibility
  const hashString = async (input: string, salt: string): Promise<string> => {
    const normalized = input.trim().toLowerCase();
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Load configuration on mount or auth change
  useEffect(() => {
    const loadVaultConfig = async () => {
      if (!db || !profile?.id) return;
      try {
        const docRef = doc(db, 'profiles', profile.id, 'vault', 'config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() || profile.vaultConfigured === true) {
          const data = docSnap.data() || {};
          setPasscodeHash(data.passcodeHash || '');
          setSelectedQuestions(data.questionIds || [0, 1, 2]);
          setRecoveryAnswersHashes(data.answersHashes || []);
          setAutoLockDuration(data.autoLockDuration || '300');
          setBiometricEnabled(!!data.biometricEnabled);
          setSilentNotifications(!!data.silentNotifications);
          setVaultConfigured(true);
          
          if (isUnlocked) {
            setView('home');
          } else {
            setView('login');
          }
        } else {
          setVaultConfigured(false);
          setView('welcome');
        }
      } catch (err: any) { logger.error("Failed to load secure Hidden Chats Settings:", err); addToast({ title: "Failed", message: "Failed to load Vault settings", type: "warning" }); } finally {
        setLoading(false);
      }
    };
    loadVaultConfig();
  }, [db, profile?.id, isUnlocked, profile?.vaultConfigured]);

  // Read lockout state from localStorage to protect against reload escapes
  useEffect(() => {
    if (!profile?.id) return;
    const keyAttempts = `vault_attempts_${profile.id}`;
    const keyLockedUntil = `vault_locked_${profile.id}`;
    
    const savedAttempts = localStorage.getItem(keyAttempts);
    const savedLocked = localStorage.getItem(keyLockedUntil);
    
    if (savedAttempts) setAttempts(parseInt(savedAttempts, 10));
    if (savedLocked) {
      const lockTime = parseInt(savedLocked, 10);
      if (lockTime > Date.now()) {
        setLockedUntil(lockTime);
        setTimeRemaining(Math.ceil((lockTime - Date.now()) / 1000));
      }
    }
  }, [profile?.id]);

  // Lockout clock ticker
  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const diff = lockedUntil - Date.now();
      if (diff <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        if (profile?.id) {
          localStorage.removeItem(`vault_locked_${profile.id}`);
          localStorage.setItem(`vault_attempts_${profile.id}`, '0');
        }
        clearInterval(interval);
      } else {
        setTimeRemaining(Math.ceil(diff / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil, profile?.id]);

  // Handle active session Auto-Lock
  useEffect(() => {
    if (!isUnlocked || autoLockDuration === 'never') return;
    
    let lockTimer: NodeJS.Timeout;
    const durationSec = autoLockDuration === 'immediately' ? 2 : parseInt(autoLockDuration, 10);
    const durationMs = durationSec * 1000;

    const resetTimer = () => {
      clearTimeout(lockTimer);
      lockTimer = setTimeout(() => {
        setIsUnlocked(false);
        setView('login');
      }, durationMs);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer(); // run initial trigger

    return () => {
      clearTimeout(lockTimer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [isUnlocked, autoLockDuration, setIsUnlocked]);

  // Real-time validations for Passcode
  const isPasscodeValid = useMemo(() => {
    if (passcodeType === 'pin6') {
      return /^\d{6}$/.test(passcodeInput);
    }
    if (passcodeType === 'pin8') {
      return /^\d{8}$/.test(passcodeInput);
    }
    if (passcodeType === 'password') {
      return passcodeInput.length >= 8 && /[a-zA-Z]/.test(passcodeInput) && /\d/.test(passcodeInput);
    }
    return false;
  }, [passcodeType, passcodeInput]);

  const passwordRequirements = useMemo(() => {
    if (passcodeType !== 'password') return [];
    return [
      { text: "At least 8 characters", met: passcodeInput.length >= 8 },
      { text: "At least 1 letter", met: /[a-zA-Z]/.test(passcodeInput) },
      { text: "At least 1 number", met: /\d/.test(passcodeInput) }
    ];
  }, [passcodeType, passcodeInput]);

  const isResetPasscodeValid = useMemo(() => {
    if (passcodeType === 'pin6') {
      return /^\d{6}$/.test(resetPasscodeVal);
    }
    if (passcodeType === 'pin8') {
      return /^\d{8}$/.test(resetPasscodeVal);
    }
    if (passcodeType === 'password') {
      return resetPasscodeVal.length >= 8 && /[a-zA-Z]/.test(resetPasscodeVal) && /\d/.test(resetPasscodeVal);
    }
    return false;
  }, [passcodeType, resetPasscodeVal]);

  const resetPasswordRequirements = useMemo(() => {
    if (passcodeType !== 'password') return [];
    return [
      { text: "At least 8 characters", met: resetPasscodeVal.length >= 8 },
      { text: "At least 1 letter", met: /[a-zA-Z]/.test(resetPasscodeVal) },
      { text: "At least 1 number", met: /\d/.test(resetPasscodeVal) }
    ];
  }, [passcodeType, resetPasscodeVal]);

  const isRecoveryValid = useMemo(() => {
    // Each unique question must be selected and answers must be >= 3 characters
    const uniqQuestions = new Set(selectedQuestions);
    if (uniqQuestions.size < 3) return false;
    return recoveryAnswers.every(ans => ans.trim().length >= 3);
  }, [selectedQuestions, recoveryAnswers]);

  // Triggering the sequential mock creation screen messages
  useEffect(() => {
    if (view !== 'creating') return;
    setCreatingStep(0);
    const timers = [
      setTimeout(() => setCreatingStep(1), 500),
      setTimeout(() => setCreatingStep(2), 1000),
      setTimeout(() => setCreatingStep(3), 1500),
      setTimeout(() => {
        setView('setup_success');
      }, 2000)
    ];
    return () => timers.forEach(clearTimeout);
  }, [view]);

  // Create the Vault database configurations
  const handleFinalizeVaultCreation = async () => {
    setLoading(true);
    setView('creating');
    try {
      const hashedPasscode = await hashString(passcodeInput, '_aurasecret_salt');
      const hashedAns1 = await hashString(recoveryAnswers[0], '_aurareCOVERY_salt');
      const hashedAns2 = await hashString(recoveryAnswers[1], '_aurareCOVERY_salt');
      const hashedAns3 = await hashString(recoveryAnswers[2], '_aurareCOVERY_salt');
      const ansHashes = [hashedAns1, hashedAns2, hashedAns3];

      // Save inside vault/config subcollection of profiles
      const configRef = doc(db, 'profiles', profile.id, 'vault', 'config');
      await setDoc(configRef, {
        passcodeType,
        passcodeHash: hashedPasscode,
        questionIds: selectedQuestions,
        answersHashes: ansHashes,
        biometricEnabled,
        autoLockDuration,
        silentNotifications,
        createdAt: new Date().toISOString()
      });

      // Update parent profile document for quick queries
      const profileRef = doc(db, 'profiles', profile.id);
      await updateDoc(profileRef, {
        vaultConfigured: true
      });

      setPasscodeHash(hashedPasscode);
      setRecoveryAnswersHashes(ansHashes);
      setVaultConfigured(true);
    } catch (e) {
      logger.error("Failed to commit final Vault configurations:", e);
      setErrorText("Could not set up vault. Please try again.");
      setView('setup_review');
    } finally {
      setLoading(false);
    }
  };

  const performUnlock = async (entered: string) => {
    setErrorText('');

    if (lockedUntil) {
      setErrorText(`Failed attempts lock active.`);
      return;
    }

    try {
      const inputHash = await hashString(entered, '_aurasecret_salt');
      if (inputHash === passcodeHash) {
        setIsAppLoading(true);
        setTimeout(() => {
          setIsUnlocked(true);
          setAttempts(0);
          setPasscodeInput('');
          if (profile?.id) {
            localStorage.setItem(`vault_attempts_${profile.id}`, '0');
          }
          setView('home');
          setIsAppLoading(false);
        }, 800);
      } else {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        setPasscodeInput('');
        if (profile?.id) {
          localStorage.setItem(`vault_attempts_${profile.id}`, nextAttempts.toString());
        }

        if (nextAttempts >= 5) {
          const lockExpiration = Date.now() + 5 * 60 * 1000; // 5 minutes lockout
          setLockedUntil(lockExpiration);
          setTimeRemaining(300);
          if (profile?.id) {
            localStorage.setItem(`vault_locked_${profile.id}`, lockExpiration.toString());
          }
          setErrorText("Too many failed attempts. Please try again later.");
        } else {
          setErrorText(`Incorrect passcode. ${5 - nextAttempts} attempts remaining.`);
        }
      }
    } catch (err) {
      setErrorText("Something went wrong. Please try again.");
    }
  };

  // Login unlock vault
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    await performUnlock(passcodeInput);
  };

  // Auto-validate completed PIN on unlock
  useEffect(() => {
    if (view !== 'login' || passcodeType === 'password' || !passcodeInput) return;
    const requiredLength = passcodeType === 'pin6' ? 6 : 8;
    if (passcodeInput.length === requiredLength) {
      performUnlock(passcodeInput);
    }
  }, [passcodeInput, passcodeType, view]);

  // Perform forgotten passcode recoveries
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    if (recoveryAnswers.some(ans => !ans.trim())) {
      setErrorText("Please answer all recovery questions.");
      return;
    }

    try {
      const hashed1 = await hashString(recoveryAnswers[0], '_aurareCOVERY_salt');
      const hashed2 = await hashString(recoveryAnswers[1], '_aurareCOVERY_salt');
      const hashed3 = await hashString(recoveryAnswers[2], '_aurareCOVERY_salt');

      if (
        hashed1 === recoveryAnswersHashes[0] &&
        hashed2 === recoveryAnswersHashes[1] &&
        hashed3 === recoveryAnswersHashes[2]
      ) {
        // Success ! Reset fields and allow passcode rebuild
        setErrorText('');
        setRecoveryAnswers(['', '', '']);
        setResetPasscodeVal('');
        setResetPasscodeConfirm('');
        setView('forgot_reset_passcode');
      } else {
        setErrorText("Recovery answers do not match.");
      }
    } catch (err) {
      setErrorText("Handshake verification failed.");
    }
  };

  // Commit reconstructed passcodes
  const handleSaveNewPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    if (resetPasscodeVal !== resetPasscodeConfirm) {
      setErrorText("Passcodes do not match.");
      return;
    }

    setLoading(true);
    try {
      const hashedPasscode = await hashString(resetPasscodeVal, '_aurasecret_salt');

      const configRef = doc(db, 'profiles', profile.id, 'vault', 'config');
      await updateDoc(configRef, {
        passcodeHash: hashedPasscode,
        passcodeType
      });

      setPasscodeHash(hashedPasscode);
      setView('forgot_reset_success');
    } catch (e) {
      logger.error(e);
      setErrorText("Failed to rewrite passcode database keys.");
    } finally {
      setLoading(false);
    }
  };

  // Theme & Media State
  const [privacyMedia, setPrivacyMedia] = useState<any[]>([]);

  // Load Vault Media from Firestore
  useEffect(() => {
    if (!db || !profile?.id || !isUnlocked) return;
    
    const userKeys = Array.from(new Set([
      profile.id, 
      profile.uid, 
      profile.ownerUid, 
      user?.uid, 
      auth?.currentUser?.uid,
      `profile_${auth?.currentUser?.uid}`,
      `profile_${user?.uid}`
    ].filter(Boolean)));
    const q = query(
      collection(db, 'vault_media'), 
      where('userId', 'in', userKeys)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const media = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPrivacyMedia(media);
    }, (err) => {
      logger.warn('[Vault] vault_media subscription fallback:', err);
    });

    return () => unsubscribe();
  }, [db, profile?.id, profile?.uid, profile?.ownerUid, user?.uid, isUnlocked]);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !db || !profile?.id) return;

    const currentAuthUid = auth?.currentUser?.uid || user?.uid || profile?.ownerUid || profile?.uid || profile.id;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let mediaUrl = '';
        try {
          if (uploadMedia) {
            mediaUrl = await uploadMedia(file, `vault/${currentAuthUid}`);
          }
        } catch (uploadErr) {
          logger.warn("[Vault] Storage upload failed, falling back to data URL:", uploadErr);
        }

        if (!mediaUrl) {
          mediaUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });
        }

        await addDoc(collection(db, 'vault_media'), {
          userId: currentAuthUid,
          ownerUid: currentAuthUid,
          profileId: profile.id,
          url: mediaUrl,
          type: file.type.startsWith('video') ? 'video' : 'image',
          name: file.name,
          createdAt: serverTimestamp(),
          isFavorite: false,
          folderId: null
        });

        addToast({
          title: "Vault Storage Updated",
          message: `${file.name} saved securely in Vault.`,
          type: "success"
        });
      } catch (err: any) {
        logger.error("Vault media upload failed:", err);
        addToast({
          title: "Upload Error",
          message: err?.message || "Failed to secure media in Vault.",
          type: "warning"
        });
      }
    }
    // Reset file input target value so subsequent uploads of same file trigger onChange
    try {
      e.target.value = '';
    } catch {}
  };

  const handleVaultDelete = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'vault_media', id));
      addToast({ title: "Deleted", message: "Item removed from Vault.", type: "info" });
    } catch (e: any) { logger.error("Delete failed:", e); addToast({ title: "Failed", message: "Failed to delete vault item", type: "warning" }); }
  };

  const handleRestoreMedia = async (id: string) => {
    if (!db || !profile?.id) return;
    const item = privacyMedia.find(m => m.id === id);
    if (!item) return;

    try {
      const restoredContent = item.content || (item.name ? `Restored from Vault: ${item.name}` : 'Restored Post');
      const hasMediaUrl = !!item.url;

      await addDoc(collection(db, 'posts'), {
        userId: user?.uid || profile.id,
        authorUid: user?.uid || profile.id,
        authorId: profile.id,
        userDisplayName: profile.displayName || profile.username,
        userPhoto: profile.photoURL || '',
        userRank: profile.aeirmistRank || 'IRON',
        content: restoredContent,
        media: hasMediaUrl ? [{
          url: item.url,
          type: item.type || 'image'
        }] : [],
        mediaUrls: hasMediaUrl ? [item.url] : [],
        mediaType: hasMediaUrl ? (item.type || 'image') : 'text',
        type: 'post',
        createdAt: serverTimestamp(),
        likes: 0,
        comments: 0,
        shares: 0,
        isPrivate: true
      });

      // Remove from vault
      await deleteDoc(doc(db, 'vault_media', id));
      addToast({ title: 'Restored', message: 'Item moved to your private posts.', type: 'success' });
    } catch (e: any) { 
      logger.error("Restore failed:", e); 
      addToast({ title: "Failed", message: "Failed to restore item", type: "warning" }); 
    }
  };

  const handleVaultFavorite = async (id: string) => {
    if (!db) return;
    const item = privacyMedia.find(m => m.id === id);
    if (!item) return;
    try {
      await updateDoc(doc(db, 'vault_media', id), {
        isFavorite: !item.isFavorite
      });
    } catch (e: any) { logger.error("Favorite failed:", e); addToast({ title: "Failed", message: "Failed to favorite", type: "warning" }); }
  };

  // Adjust options while fully unlocked inside settings panel
  const handleSettingsUpdate = async () => {
    setErrorText('');
    setSuccessText('');
    try {
      const configRef = doc(db, 'profiles', profile.id, 'vault', 'config');
      await updateDoc(configRef, {
        autoLockDuration,
        silentNotifications,
        biometricEnabled
      });
      setSuccessText("Security profile saved.");
      setTimeout(() => setSuccessText(''), 3000);
    } catch (err) {
      logger.error(err);
      setErrorText("Handshake sync failed.");
    }
  };

  // Dynamic filter lists
  const vaultChats = useMemo(() => {
    return chats.filter(data => data.isVaulted?.[profile?.id || ''] === true);
  }, [chats, profile?.id]);

  const filteredVaultChats = useMemo(() => {
    if (!vaultSearchQuery.trim()) return vaultChats;
    const q = vaultSearchQuery.toLowerCase().trim();
    return vaultChats.filter(chat => 
      (chat.name || '').toLowerCase().includes(q) ||
      (chat.lastMessage || '').toLowerCase().includes(q)
    );
  }, [vaultChats, vaultSearchQuery]);

  const nonVaultChats = useMemo(() => {
    return chats.filter(data => data.isVaulted?.[profile?.id || ''] !== true && data.status === 'active');
  }, [chats, profile?.id]);

  const followingProfiles = useMemo(() => {
    const followingIds = profile?.social?.following || [];
    return allProfiles.filter(p => followingIds.includes(p.id) && !vaultChats.some(v => v.profileIds?.includes(p.id)));
  }, [allProfiles, profile?.social?.following, vaultChats]);

  const followersProfiles = useMemo(() => {
    const followersIds = profile?.social?.followers || [];
    return allProfiles.filter(p => followersIds.includes(p.id) && !vaultChats.some(v => v.profileIds?.includes(p.id)));
  }, [allProfiles, profile?.social?.followers, vaultChats]);

  const handleMoveToVault = async (chatId: string) => {
    try {
      const convRef = doc(db, 'conversations', chatId);
      await updateDoc(convRef, {
        [`isVaulted.${profile.id}`]: true
      });
      onSelectChat(chatId);
      addToast({ title: 'Moved to Vault', message: 'Conversation secured.', type: 'success' });
    } catch (err: any) { logger.error("Failed to vault conversation:", err); addToast({ title: "Failed", message: "Failed to vault conversation", type: "warning" }); }
  };

  const handleRestoreChat = async (chatId: string) => {
    try {
      const convRef = doc(db, 'conversations', chatId);
      await updateDoc(convRef, {
        [`isVaulted.${profile.id}`]: false
      });
      addToast({ title: 'Restored', message: 'Conversation moved back to public list.', type: 'success' });
    } catch (err: any) { logger.error("Failed to restore conversation:", err); addToast({ title: "Failed", message: "Failed to restore conversation", type: "warning" }); }
  };

  const handleInitializeSecureVault = async (chatId: string, targetName: string) => {
    try {
      setLoading(true);
      const otherProfileId = chatId.split('_').find(id => id !== profile.id);
      if (!otherProfileId) throw new Error("Invalid profile ID matching sequence");

      // Retrieve public target node details
      const otherProfSnap = await getDoc(doc(db, 'profiles', otherProfileId));
      if (!otherProfSnap.exists()) throw new Error("Profile not found");
      const otherData = otherProfSnap.data();
      const otherUid = otherData.ownerUid || otherData.uid;

      const convRef = doc(db, 'conversations', chatId);
      const convSnap = await getDoc(convRef);

      const participants = [profile.ownerUid || profile.uid, otherUid].filter(Boolean).sort();
      const profileIds = [profile.id, otherProfileId].sort();

      const convData = {
        participants,
        profileIds,
        status: 'active',
        [`isVaulted.${profile.id}`]: true,
        lastMessage: {
          text: "Secure metadata established.",
          senderId: profile.id,
          timestamp: serverTimestamp(),
          type: 'text'
        },
        participantDetails: {
          [profile.id]: {
            displayName: profile.displayName || profile.username,
            photoURL: profile.photoURL || '',
            username: profile.username || '',
            uid: profile.ownerUid || profile.uid
          },
          [otherProfileId]: {
            displayName: otherData.displayName || otherData.username,
            photoURL: otherData.photoURL || '',
            username: otherData.username || '',
            uid: otherUid
          }
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (!convSnap.exists()) {
        await setDoc(convRef, convData);
      } else {
        await updateDoc(convRef, {
          [`isVaulted.${profile.id}`]: true
        });
      }

      onSelectChat(chatId);
    } catch (err) {
      logger.error("Failed to initialize encryption:", err);
      setErrorText("Unable to start private chat. Please try again.");
      setTimeout(() => setErrorText(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Loading Shield handler
  if (loading && view === 'welcome') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#020107]">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-[#c77dff] mx-auto" size={32} />
          <p className="text-[10px] font-mono tracking-widest text-[#d8bbff]/40 uppercase">LOADING SECURITY...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full w-full bg-[#030107] text-white flex flex-col relative overflow-hidden select-none"
    >
      
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto flex flex-col relative z-10 w-full no-scrollbar">
        
        <AnimatePresence mode="wait">

          {/* STEP 1: WELCOME SCREEN */}
          {view === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-md mx-auto w-full text-center space-y-8"
            >
              {/* Spinning / Glowing Animated Vault Icon */}
              <div className="relative">
                <div className="absolute inset-0 bg-[#7b2cbf]/30 rounded-full blur-2xl animate-pulse" />
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="w-24 h-24 rounded-full border-2 border-dashed border-[#c77dff]/40 flex items-center justify-center p-2 relative z-10 bg-[#090412]/80"
                >
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-[#9d4edd] via-[#5a189a] to-[#240046] flex items-center justify-center border border-[#d8bbff]/20 shadow-[0_0_35px_rgba(157,78,221,0.4)]"
                  >
                    <Lock className="text-[#e2afff]" size={30} />
                  </motion.div>
                </motion.div>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-2">
                <h2 className="text-xl md:text-2xl font-display font-black tracking-wide bg-gradient-to-r from-white via-[#e2afff] to-[#c77dff] bg-clip-text text-transparent">
                  Welcome to Hidden Chats
                </h2>
                <p className="text-xs text-[#d8bbff]/60 leading-relaxed max-w-[320px] mx-auto">
                  Protect your private conversations with an additional security layer.
                </p>
              </div>

              {/* Features List */}
              <div className="w-full bg-[#090412]/60 backdrop-blur-md border border-[#c77dff]/15 rounded-[20px] p-5 text-left space-y-4 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
                {[
                  "Hidden Conversations",
                  "Hidden Notifications",
                  "Hidden Calls",
                  "Secure Access",
                  "Private Media"
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3.5">
                    <div className="w-5 h-5 rounded-md bg-[#7b2cbf]/20 border border-[#c77dff]/30 flex items-center justify-center shrink-0">
                      <Check className="text-[#e2afff]" size={11} strokeWidth={3} />
                    </div>
                    <span className="text-xs font-semibold text-white/95">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Get Started Button */}
              <div className="w-full pt-4">
                <button
                  onClick={() => setView('setup_passcode')}
                  className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-[#7b2cbf] via-[#9d4edd] to-[#c77dff] hover:brightness-110 active:scale-[0.98] text-white text-[10px] md:text-xs font-black uppercase tracking-[0.25em] shadow-[0_8px_30px_rgba(157,78,221,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Get Started <ChevronRight size={15} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: CREATE SECURITY KEY */}
          {view === 'setup_passcode' && (
            <motion.div
              key="setup_passcode"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-widest text-[#e2afff]">Create Your Vault Passcode</h2>
                <p className="text-xs text-[#d8bbff]/50 leading-relaxed">
                  This passcode will be required every time you open your hidden chats.
                </p>
              </div>

              {/* Selector Pills */}
              <div className="flex gap-2 w-full p-1 bg-[#090412]/80 border border-[#c77dff]/15 rounded-[16px]">
                {(['pin6', 'pin8', 'password'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setPasscodeType(type);
                      setPasscodeInput('');
                      setPasscodeConfirm('');
                      setErrorText('');
                    }}
                    className={`flex-1 py-2.5 rounded-[12px] text-[8px] md:text-[9px] font-black uppercase tracking-wider transition-all border shrink-0 ${
                      passcodeType === type
                        ? 'bg-[#7b2cbf]/20 border-[#c77dff]/40 text-[#e2afff] shadow-[0_0_15px_rgba(123,44,191,0.25)]'
                        : 'border-transparent text-white/40 hover:text-white/60'
                    }`}
                  >
                    {type === 'pin6' ? '6 Digit PIN' : type === 'pin8' ? '8 Digit PIN' : 'Password'}
                  </button>
                ))}
              </div>

              {/* Key Entry Input Field / Keypad */}
              <div className="w-full text-left space-y-2">
                {passcodeType === 'password' ? (
                  <>
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Passcode Field</label>
                    <div className="relative">
                      <input
                        type={!showPasswordChar ? 'password' : 'text'}
                        maxLength={32}
                        placeholder="Letters + Numbers"
                        value={passcodeInput}
                        onChange={(e) => setPasscodeInput(e.target.value)}
                        className="w-full min-h-[48px] bg-[#090412]/60 backdrop-blur-md border border-[#c77dff]/20 hover:border-[#c77dff]/40 focus:border-[#7b2cbf] hover:shadow-[0_0_15px_rgba(199,125,255,0.06)] focus:shadow-[0_0_15px_rgba(199,125,255,0.15)] rounded-[16px] py-3 px-4 text-center text-sm font-bold tracking-widest text-[#e2afff] placeholder:text-white/20 placeholder:tracking-normal outline-none transition-all"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordChar(!showPasswordChar)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                      >
                        {showPasswordChar ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 flex flex-col items-center">
                    <PinDots length={passcodeType === 'pin6' ? 6 : 8} value={passcodeInput} />
                    <NumericKeypad
                      value={passcodeInput}
                      onChange={setPasscodeInput}
                      maxLength={passcodeType === 'pin6' ? 6 : 8}
                    />
                  </div>
                )}
              </div>

              {/* Real-time validations list */}
              <div className="w-full space-y-1.5 text-left p-2">
                {passcodeType === 'pin6' && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {isPasscodeValid ? (
                      <Check className="text-green-400" size={12} strokeWidth={3} />
                    ) : (
                      <AlertCircle className="text-white/25" size={12} />
                    )}
                    <span className={isPasscodeValid ? "text-green-300 font-bold" : "text-white/40"}>Exactly 6 digits</span>
                  </div>
                )}
                {passcodeType === 'pin8' && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {isPasscodeValid ? (
                      <Check className="text-green-400" size={12} strokeWidth={3} />
                    ) : (
                      <AlertCircle className="text-white/25" size={12} />
                    )}
                    <span className={isPasscodeValid ? "text-green-300 font-bold" : "text-white/40"}>Exactly 8 digits</span>
                  </div>
                )}
                {passcodeType === 'password' && (
                  <div className="space-y-1 bg-[#090412]/40 p-3 rounded-xl border border-white/5">
                    <p className="text-[8px] font-black uppercase tracking-wider text-white/30 pb-1">Requirements:</p>
                    {passwordRequirements.map((req, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                        {req.met ? (
                          <Check className="text-green-400" size={11} strokeWidth={3} />
                        ) : (
                          <AlertCircle className="text-white/20" size={11} />
                        )}
                        <span className={req.met ? "text-green-300 font-medium" : "text-white/40 font-medium"}>{req.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Continue button */}
              <button
                type="button"
                onClick={() => setView('confirm_passcode')}
                disabled={!isPasscodeValid}
                className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-[#7b2cbf] to-[#9d4edd] hover:brightness-110 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                Continue
              </button>

              <button 
                type="button"
                onClick={onClose}
                className="text-[10px] font-black uppercase tracking-widest text-[#d8bbff]/40 hover:text-white pt-2"
              >
                Cancel Setup
              </button>
            </motion.div>
          )}

          {/* STEP 3: CONFIRM PASSCODE */}
          {view === 'confirm_passcode' && (
            <motion.div
              key="confirm_passcode"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-widest text-[#e2afff]">Confirm Security Key</h2>
                <p className="text-xs text-[#d8bbff]/50 leading-relaxed">
                  Re-enter your passcode to continue.
                </p>
              </div>

              <div className="w-full text-left space-y-2">
                {passcodeType === 'password' ? (
                  <>
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block font-sans">Verification Code</label>
                    <div className="relative">
                      <input
                        type={!showPasswordChar ? 'password' : 'text'}
                        maxLength={32}
                        placeholder="Confirm keys"
                        value={passcodeConfirm}
                        onChange={(e) => {
                          setPasscodeConfirm(e.target.value);
                          setErrorText('');
                        }}
                        className="w-full min-h-[48px] bg-[#090412]/60 backdrop-blur-md border border-[#c77dff]/20 focus:border-[#7b2cbf] rounded-[16px] py-3 px-4 text-center text-sm font-bold tracking-widest text-[#e2afff] placeholder:text-white/20 outline-none transition-all"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 flex flex-col items-center">
                    <PinDots length={passcodeType === 'pin6' ? 6 : 8} value={passcodeConfirm} />
                    <NumericKeypad
                      value={passcodeConfirm}
                      onChange={(val) => {
                        setPasscodeConfirm(val);
                        setErrorText('');
                      }}
                      maxLength={passcodeType === 'pin6' ? 6 : 8}
                    />
                  </div>
                )}
              </div>

              {passcodeConfirm && passcodeConfirm !== passcodeInput && (
                <p className="text-xs text-red-400 font-bold tracking-wide animate-pulse">Passcodes do not match.</p>
              )}

              {/* Continue button */}
              <button
                type="button"
                onClick={() => {
                  if (passcodeConfirm !== passcodeInput) {
                    setErrorText("Passcodes do not match.");
                    return;
                  }
                  setView('setup_recovery');
                }}
                disabled={!passcodeConfirm || passcodeConfirm !== passcodeInput}
                className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-[#7b2cbf] to-[#9d4edd] hover:brightness-110 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                Continue
              </button>

              <button 
                type="button"
                onClick={() => {
                  setPasscodeConfirm('');
                  setView('setup_passcode');
                }}
                className="text-[10px] font-black uppercase tracking-widest text-[#d8bbff]/40 hover:text-white pt-2 flex items-center gap-1.5"
              >
                <RotateCcw size={12} /> Back
              </button>
            </motion.div>
          )}

          {/* STEP 4: RECOVERY PROTECTION */}
          {view === 'setup_recovery' && (
            <motion.div
              key="setup_recovery"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-5"
            >
              <div className="space-y-1 shrink-0">
                <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-widest text-[#e2afff]">Recovery Setup</h2>
                <p className="text-xs text-[#d8bbff]/50">
                  Choose any 3 recovery questions.
                </p>
              </div>

              {/* Quest list selectors and answer inputs */}
              <div className="w-full space-y-3 pt-2">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="space-y-2 p-3 bg-[#090412]/60 border border-[#c77dff]/15 rounded-[16px] text-left">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#c77dff] block">Question {idx + 1}</label>
                    <select
                      value={selectedQuestions[idx]}
                      onChange={(e) => {
                        const targetVal = parseInt(e.target.value, 10);
                        setSelectedQuestions(prev => {
                          const updated = [...prev];
                          updated[idx] = targetVal;
                          return updated;
                        });
                      }}
                      className="w-full bg-[#030107] border border-[#c77dff]/20 hover:border-[#c77dff]/40 rounded-xl p-2.5 text-xs font-semibold text-white outline-none focus:border-[#7b2cbf]"
                    >
                      {RECOVERY_QUESTIONS.map((q, qIndex) => {
                        const isTaken = selectedQuestions.some((chosenVal, chosenIdx) => chosenIdx !== idx && chosenVal === qIndex);
                        return (
                          <option key={qIndex} value={qIndex} className="bg-[#090412] text-white" disabled={isTaken}>
                            {q}
                          </option>
                        );
                      })}
                    </select>
                    
                    <input
                      type="text"
                      placeholder="Recovery Answer Input (Min 3 chars)"
                      value={recoveryAnswers[idx]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRecoveryAnswers(prev => {
                          const updated = [...prev];
                          updated[idx] = val;
                          return updated;
                        });
                      }}
                      className="w-full bg-[#030107]/40 border border-white/5 hover:border-white/15 rounded-xl py-2 px-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-[#7b2cbf]"
                    />
                  </div>
                ))}
              </div>

              {/* Secure Notes warnings */}
              <p className="text-[9px] text-[#d8bbff]/45 text-left leading-relaxed">
                * Recoveries are cryptographically matched. Plain text answers are immediately scrubbed and never displayed again.
              </p>

              {/* Continue button */}
              <button
                type="button"
                onClick={() => setView('setup_device')}
                disabled={!isRecoveryValid}
                className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-[#7b2cbf] to-[#9d4edd] hover:brightness-110 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                Continue
              </button>

              <button 
                type="button"
                onClick={() => setView('confirm_passcode')}
                className="text-[10px] font-black uppercase tracking-widest text-[#d8bbff]/40 hover:text-white shrink-0 flex items-center gap-1.5"
              >
                <RotateCcw size={12} /> Back
              </button>
            </motion.div>
          )}

          {/* STEP 5: OPTIONAL DEVICE SECURITY */}
          {view === 'setup_device' && (
            <motion.div
              key="setup_device"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-left space-y-6"
            >
              <div className="space-y-1 text-center w-full">
                <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-widest text-[#e2afff]">Additional Protection</h2>
                <p className="text-xs text-[#d8bbff]/50 leading-relaxed">
                  Configure biometric filters & lock timers.
                </p>
              </div>

              {/* Interactive Device Toggles */}
              <div className="w-full space-y-4 pt-2">
                
                {/* Biometric toggle option */}
                <div className="flex items-center justify-between p-4 bg-[#090412]/60 rounded-[16px] border border-[#c77dff]/15">
                  <div className="space-y-1 min-w-0 pr-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white">Enable Biometric Unlock</span>
                    <p className="text-[10px] text-white/40 leading-relaxed md:block">Fingerprint / Face Unlock if supported.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBiometricEnabled(!biometricEnabled)}
                    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${biometricEnabled ? 'bg-[#7b2cbf]' : 'bg-white/10'}`}
                  >
                    <motion.span 
                      animate={{ x: biometricEnabled ? 22 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white transition-all shadow" 
                    />
                  </button>
                </div>

                {/* Auto Lock Options Block */}
                <div className="space-y-3 p-4 bg-[#090412]/60 rounded-[16px] border border-[#c77dff]/15">
                  <span className="text-[10px] font-black uppercase text-[#e2afff] tracking-widest block">Auto Lock Vault</span>
                  <p className="text-[10px] text-white/40 leading-relaxed">Choose inactive duration time before immediately locking again:</p>
                  
                  <div className="grid grid-cols-2 gap-2 pt-1.5">
                    {[
                      { value: 'immediately', label: 'Immediately' },
                      { value: '30', label: '30 Seconds' },
                      { value: '60', label: '1 Minute' },
                      { value: '300', label: '5 Minutes' },
                      { value: '900', label: '15 Minutes' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAutoLockDuration(opt.value)}
                        className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border shrink-0 ${
                          autoLockDuration === opt.value
                            ? 'bg-[#7b2cbf]/10 border-[#c77dff]/50 text-[#e2afff] shadow-[0_0_10px_rgba(123,44,191,0.2)]'
                            : 'bg-white/[0.01] border-transparent text-white/40 hover:border-white/10 hover:text-white/60'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Silent notifications option for Vault */}
                <div className="flex items-center justify-between p-4 bg-[#090412]/60 rounded-[16px] border border-[#c77dff]/15">
                  <div className="space-y-1 min-w-0 pr-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white">Silent Secure Notifications</span>
                    <p className="text-[10px] text-white/40 leading-relaxed">Do not disclose sender names or content.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSilentNotifications(!silentNotifications)}
                    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${silentNotifications ? 'bg-[#7b2cbf]' : 'bg-white/10'}`}
                  >
                    <motion.span 
                      animate={{ x: silentNotifications ? 22 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white transition-all shadow" 
                    />
                  </button>
                </div>

              </div>

              {/* Continue button */}
              <button
                type="button"
                onClick={() => setView('setup_review')}
                className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-[#7b2cbf] to-[#9d4edd] hover:brightness-110 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg transition-all text-center cursor-pointer"
              >
                Continue
              </button>

              <button 
                type="button"
                onClick={() => setView('setup_recovery')}
                className="text-[10px] font-black uppercase tracking-widest text-[#d8bbff]/40 hover:text-white shrink-0 flex items-center gap-1.5 self-center"
              >
                <RotateCcw size={12} /> Back
              </button>
            </motion.div>
          )}

          {/* STEP 6: FINAL REVIEW */}
          {view === 'setup_review' && (
            <motion.div
              key="setup_review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-widest text-[#e2afff]">Vault Security Ready</h2>
                <p className="text-xs text-[#d8bbff]/50">
                  Observe and verify setup parameters.
                </p>
              </div>

              {/* Config summary lists */}
              <div className="w-full bg-[#090412]/75 border border-[#c77dff]/15 rounded-[20px] p-5 text-left space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <Check className="text-green-400" size={10} strokeWidth={3} />
                  </div>
                  <span className="text-xs font-semibold text-white/90">Passcode Created</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <Check className="text-green-400" size={10} strokeWidth={3} />
                  </div>
                  <span className="text-xs font-semibold text-white/90">Recovery Protection Enabled</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <Check className="text-green-400" size={10} strokeWidth={3} />
                  </div>
                  <span className="text-xs font-semibold text-white/90">Device Security Configured</span>
                </div>

                {/* Cyber HUD Security Strength gauge card */}
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-mono text-white/45">
                    <span>Security Strength</span>
                    <span className="text-green-400 font-bold">Strong</span>
                  </div>
                  <div className="w-full h-2 bg-[#030107] border border-white/5 rounded-full overflow-hidden flex p-[1px]">
                    <div className="w-[100%] h-full rounded-full bg-gradient-to-r from-[#7b2cbf] via-[#9d4edd] to-[#a2d2ff] shadow-[0_0_8px_rgba(157,78,221,0.6)]" />
                  </div>
                </div>
              </div>

              {errorText && (
                <p className="text-xs text-red-400 font-bold tracking-wide animate-pulse">{errorText}</p>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleFinalizeVaultCreation}
                className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-[#7b2cbf] to-[#c77dff] hover:brightness-110 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_4px_25px_rgba(199,125,255,0.35)] transition-all cursor-pointer"
              >
                Set Passcode
              </button>

              <button 
                type="button"
                onClick={() => setView('setup_device')}
                className="text-[10px] font-black uppercase tracking-widest text-[#d8bbff]/40 hover:text-white shrink-0 flex items-center gap-1.5"
              >
                <RotateCcw size={12} /> Back
              </button>
            </motion.div>
          )}

          {/* CREATION PROCESS: LOADING ANIMATIONS */}
          {view === 'creating' && (
            <motion.div
              key="creating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col justify-center items-center px-6 max-w-sm mx-auto w-full text-center space-y-6"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border border-dashed border-[#c77dff]/20 animate-spin flex items-center justify-center p-3" />
                <div className="absolute w-12 h-12 rounded-full border border-dashed border-cyan-400/20 duration-1500 hover:rotate-180 flex items-center justify-center" />
                <Lock className="text-[#e2afff] absolute animate-bounce" size={24} />
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={creatingStep}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs font-mono font-medium uppercase tracking-widest text-[#d8bbff] h-5"
                >
                  {creatingMessages[creatingStep]}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          )}

          {/* SUCCESS SCREEN */}
          {view === 'setup_success' && (
            <motion.div
              key="setup_success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-8"
            >
              {/* Massive glowing Shield check icon */}
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse" />
                <motion.div
                  initial={{ scale: 0.3 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-full border-2 border-green-500/40 flex items-center justify-center bg-[#090412]/80 z-10 relative"
                >
                  <ShieldCheck className="text-green-400" size={36} />
                </motion.div>
              </div>

              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-widest text-green-400">Aeirmist Vault Created Successfully</h2>
                <p className="text-xs text-[#d8bbff]/50 leading-relaxed max-w-[280px] mx-auto">
                  Your private space is now protected.
                </p>
              </div>

              {/* Action Trigger */}
              <button
                type="button"
                onClick={() => {
                  setIsUnlocked(true);
                  setView('home');
                }}
                className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-green-600 to-emerald-500 hover:brightness-110 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_4px_25px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
              >
                Unlock Chats
              </button>
            </motion.div>
          )}

          {/* UNLOCK SCREEN (Subsequent Visits) */}
          {view === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-8"
            >
              <AnimatePresence mode="wait">
                {isAppLoading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    className="space-y-6"
                  >
                    <div className="relative w-20 h-20 mx-auto">
                      <div className="absolute inset-0 rounded-full border-2 border-[#c77dff]/20 animate-ping" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-[#c77dff] animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ShieldCheck className="text-[#c77dff]" size={32} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-black tracking-widest uppercase text-[#d8bbff]">Unlocking Vault</h2>
                      <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40">Securing environment layer...</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="entry"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full space-y-8"
                  >
                    {/* Locked Folder Icon */}
                    <div className="relative group">
                      <div className="absolute inset-0 bg-[#7b2cbf]/20 rounded-full blur-3xl transition-all group-hover:bg-[#7b2cbf]/30" />
                      <div className="relative w-20 h-20 mx-auto rounded-[30px] bg-gradient-to-br from-[#1a1128] to-[#090412] border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden group-hover:scale-110 transition-transform duration-500">
                        <div className="absolute inset-0 bg-gradient-to-tr from-[#7b2cbf]/10 to-transparent" />
                        <Lock className="text-[#c77dff] relative drop-shadow-[0_0_8px_rgba(199,125,255,0.5)]" size={32} strokeWidth={2.5} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-display font-black tracking-[0.1em] text-white">Private Folder</h2>
                      <p className="text-xs font-bold tracking-widest text-[#d8bbff]/40 uppercase">Identify yourself to proceed</p>
                    </div>

                    <div className="w-full space-y-6">
                      {passcodeType === 'password' ? (
                        <form onSubmit={handleUnlock} className="space-y-4">
                          <div className="relative">
                            <input
                              type={!showPasswordChar ? 'password' : 'text'}
                              maxLength={40}
                              placeholder="Passcode Required"
                              value={passcodeInput}
                              onChange={(e) => {
                                setPasscodeInput(e.target.value);
                                setErrorText('');
                              }}
                              className="w-full min-h-[56px] bg-white/[0.03] border border-white/10 focus:border-[#7b2cbf]/50 focus:bg-white/[0.05] rounded-2xl py-4 px-6 text-center text-lg font-bold tracking-[0.3em] text-[#e2afff] placeholder:text-white/10 placeholder:tracking-normal outline-none transition-all"
                              disabled={!!lockedUntil}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setShowPasswordChar(!showPasswordChar)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                            >
                              {showPasswordChar ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>

                          {errorText && (
                            <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-400 font-bold tracking-wide">{errorText}</motion.p>
                          )}

                          {lockedUntil && (
                            <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/20 text-red-300 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                              Security lockout active. Try again in {timeRemaining}s
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={!passcodeInput || !!lockedUntil}
                            className="w-full h-[56px] rounded-2xl bg-[#c77dff] hover:brightness-110 active:scale-[0.98] text-white text-xs font-black uppercase tracking-[0.3em] shadow-xl shadow-[#c77dff]/20 disabled:opacity-20 transition-all cursor-pointer"
                          >
                            Unlock Chats
                          </button>
                        </form>
                      ) : (
                        <div className="space-y-6 flex flex-col items-center">
                          <PinDots length={passcodeType === 'pin6' ? 6 : 8} value={passcodeInput} />
                          
                          {errorText && (
                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 font-bold tracking-wide">{errorText}</motion.p>
                          )}

                          {lockedUntil && (
                            <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/20 text-red-300 text-[10px] font-bold uppercase tracking-widest text-center">
                              Security lockout active. ({timeRemaining}s)
                            </div>
                          )}

                          <NumericKeypad
                            value={passcodeInput}
                            onChange={(val) => {
                              setPasscodeInput(val);
                              setErrorText('');
                            }}
                            maxLength={passcodeType === 'pin6' ? 6 : 8}
                            disabled={!!lockedUntil}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between w-full pt-4 text-[10px] font-black uppercase tracking-[0.2em]">
                      <button 
                        onClick={() => {
                          setErrorText('');
                          setRecoveryAnswers(['', '', '']);
                          setView('forgot_passcode');
                        }}
                        className="text-white/20 hover:text-[#c77dff] transition-colors"
                      >
                        Forgot Passcode?
                      </button>
                      <button 
                        onClick={onClose}
                        className="text-white/20 hover:text-white transition-colors flex items-center gap-2"
                      >
                        Exit <X size={12} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* FORGOT PASSCODE FLOW: SECURITY QUESTIONS VERIFICATION */}
          {view === 'forgot_passcode' && (
            <motion.div
              key="forgot_passcode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-widest text-[#e2afff]">Recover Vault Access</h2>
                <p className="text-xs text-[#d8bbff]/50 leading-relaxed">
                  Provide perfect answers to stored security keys.
                </p>
              </div>

              <form onSubmit={handleRecoverySubmit} className="w-full space-y-4 pt-2">
                {selectedQuestions.map((questionIndex, idx) => (
                  <div key={idx} className="space-y-2 p-3 bg-[#090412]/60 border border-[#c77dff]/25 rounded-[16px] text-left">
                    <label className="text-[8px] font-mono tracking-widest text-[#c77dff]/65 uppercase block">Recovery Question {idx + 1}</label>
                    <p className="text-xs font-bold text-white/95 select-none pb-1">{RECOVERY_QUESTIONS[questionIndex]}</p>
                    <input
                      type="text"
                      placeholder="Enter security answer..."
                      value={recoveryAnswers[idx]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRecoveryAnswers(prev => {
                          const updated = [...prev];
                          updated[idx] = val;
                          return updated;
                        });
                      }}
                      className="w-full bg-[#030107] border border-white/5 focus:border-[#7b2cbf] hover:border-[#c77dff]/20 rounded-xl py-2 px-3 text-xs text-white placeholder:text-white/20 outline-none"
                      required
                    />
                  </div>
                ))}

                {errorText && (
                  <p className="text-xs text-red-400 font-bold tracking-wide animate-pulse">{errorText}</p>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-[#7b2cbf] to-[#9d4edd] hover:brightness-110 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg"
                >
                  Submit Recovery Answers
                </button>
              </form>

              <button 
                type="button"
                onClick={() => {
                  setErrorText('');
                  setView('login');
                }}
                className="text-[10px] font-black uppercase tracking-widest text-[#d8bbff]/40 hover:text-white pb-3 flex items-center gap-1.5"
              >
                <RotateCcw size={12} /> Return to Login
              </button>
            </motion.div>
          )}

          {/* RESET PASSCODE ON SUCCESSFUL RECOVERY */}
          {view === 'forgot_reset_passcode' && (
            <motion.div
              key="forgot_reset_passcode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-widest text-[#e2afff]">Create New Passcode</h2>
                <p className="text-xs text-[#d8bbff]/50 leading-relaxed">
                  Reset code access keys to your hidden chats.
                </p>
              </div>

              {/* Selector Pills */}
              <div className="flex gap-2 w-full p-1 bg-[#090412]/80 border border-[#c77dff]/15 rounded-[16px]">
                {(['pin6', 'pin8', 'password'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setPasscodeType(type);
                      setResetPasscodeVal('');
                      setResetPasscodeConfirm('');
                      setErrorText('');
                    }}
                    className={`flex-1 py-2 rounded-[12px] text-[8px] md:text-[9px] font-black uppercase tracking-wider transition-all border shrink-0 ${
                      passcodeType === type
                        ? 'bg-[#7b2cbf]/20 border-[#c77dff]/40 text-[#e2afff] shadow-[0_0_15px_rgba(123,44,191,0.25)]'
                        : 'border-transparent text-white/40 hover:text-white/60'
                    }`}
                  >
                    {type === 'pin6' ? '6 Digit PIN' : type === 'pin8' ? '8 Digit PIN' : 'Password'}
                  </button>
                ))}
              </div>

              <div className="w-full text-left space-y-2">
                {passcodeType === 'password' ? (
                  <>
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Create Passcode</label>
                    <div className="relative">
                      <input
                        type={!showPasswordChar ? 'password' : 'text'}
                        maxLength={32}
                        placeholder="Enter new passcode"
                        value={resetPasscodeVal}
                        onChange={(e) => {
                          setResetPasscodeVal(e.target.value);
                          setErrorText('');
                        }}
                        className="w-full min-h-[48px] bg-[#090412]/60 border border-[#c77dff]/20 rounded-[16px] py-3.5 px-4 text-center text-sm font-bold tracking-widest text-[#e2afff] placeholder:text-white/20 outline-none transition-all"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 flex flex-col items-center">
                    <PinDots length={passcodeType === 'pin6' ? 6 : 8} value={resetPasscodeVal} />
                    <NumericKeypad
                      value={resetPasscodeVal}
                      onChange={(val) => {
                        setResetPasscodeVal(val);
                        setErrorText('');
                      }}
                      maxLength={passcodeType === 'pin6' ? 6 : 8}
                    />
                  </div>
                )}
              </div>

              {/* Real-time validations list */}
              <div className="w-full space-y-1.5 text-left p-2">
                {passcodeType === 'pin6' && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {isResetPasscodeValid ? (
                      <Check className="text-green-400" size={12} strokeWidth={3} />
                    ) : (
                      <AlertCircle className="text-white/25" size={12} />
                    )}
                    <span className={isResetPasscodeValid ? "text-green-300 font-bold" : "text-white/40"}>Exactly 6 digits</span>
                  </div>
                )}
                {passcodeType === 'pin8' && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {isResetPasscodeValid ? (
                      <Check className="text-green-400" size={12} strokeWidth={3} />
                    ) : (
                      <AlertCircle className="text-white/25" size={12} />
                    )}
                    <span className={isResetPasscodeValid ? "text-green-300 font-bold" : "text-white/40"}>Exactly 8 digits</span>
                  </div>
                )}
                {passcodeType === 'password' && (
                  <div className="space-y-1 bg-[#090412]/40 p-3 rounded-xl border border-white/5">
                    {resetPasswordRequirements.map((req, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                        {req.met ? (
                          <Check className="text-green-400" size={11} strokeWidth={3} />
                        ) : (
                          <AlertCircle className="text-white/20" size={11} />
                        )}
                        <span className={req.met ? "text-green-300 font-semibold" : "text-white/40"}>{req.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setView('forgot_reset_confirm')}
                disabled={!isResetPasscodeValid}
                className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-[#7b2cbf] to-[#9d4edd] hover:brightness-110 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* CONFIRM NEW PASSCODE */}
          {view === 'forgot_reset_confirm' && (
            <form onSubmit={handleSaveNewPasscode} className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-6">
              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-widest text-[#e2afff]">Confirm New Passcode</h2>
                <p className="text-xs text-[#d8bbff]/50 leading-relaxed">
                  Re-enter your passcode to continue.
                </p>
              </div>

              <div className="w-full text-left space-y-2 font-sans font-medium text-xs">
                {passcodeType === 'password' ? (
                  <>
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block">Verification Passcode</label>
                    <input
                      type={!showPasswordChar ? 'password' : 'text'}
                      placeholder="Confirm new passcode"
                      value={resetPasscodeConfirm}
                      onChange={(e) => {
                        setResetPasscodeConfirm(e.target.value);
                        setErrorText('');
                      }}
                      className="w-full min-h-[48px] bg-[#090412]/60 border border-[#c77dff]/20 focus:border-[#7b2cbf] rounded-[16px] py-3.5 px-4 text-center text-sm font-bold tracking-widest text-[#e2afff] placeholder:text-white/20 outline-none transition-all"
                    />
                  </>
                ) : (
                  <div className="space-y-4 flex flex-col items-center">
                    <PinDots length={passcodeType === 'pin6' ? 6 : 8} value={resetPasscodeConfirm} />
                    <NumericKeypad
                      value={resetPasscodeConfirm}
                      onChange={(val) => {
                        setResetPasscodeConfirm(val);
                        setErrorText('');
                      }}
                      maxLength={passcodeType === 'pin6' ? 6 : 8}
                    />
                  </div>
                )}
              </div>

              {resetPasscodeConfirm && resetPasscodeConfirm !== resetPasscodeVal && (
                <p className="text-xs text-red-400 font-bold tracking-wide animate-pulse">Passcodes do not match.</p>
              )}

              {errorText && (
                <p className="text-xs text-red-400 font-bold tracking-wide animate-pulse">{errorText}</p>
              )}

              <button
                type="submit"
                disabled={!resetPasscodeConfirm || resetPasscodeConfirm !== resetPasscodeVal}
                className="w-full min-h-[48px] rounded-[20px] bg-[#7b2cbf] hover:bg-[#9d4edd] text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                Save New Passcode
              </button>
            </form>
          )}

          {/* PASSCODE RESET SUCCESS SPLASH */}
          {view === 'forgot_reset_success' && (
            <motion.div
              key="forgot_reset_success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col justify-center items-center px-6 py-8 max-w-sm mx-auto w-full text-center space-y-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse" />
                <div className="w-20 h-20 rounded-full border-2 border-green-500/40 flex items-center justify-center bg-[#090412]/80 z-10 relative">
                  <ShieldCheck className="text-green-400" size={36} />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-widest text-green-400">Vault Access Restored</h2>
                <p className="text-xs text-[#d8bbff]/50 leading-relaxed max-w-[280px] mx-auto">
                  Your private space has been restored successfully.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsUnlocked(true);
                  setView('home');
                }}
                className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-green-600 to-emerald-500 hover:brightness-110 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg cursor-pointer"
              >
                Unlock Chats
              </button>
            </motion.div>
          )}

          {/* VIEW: VAULT HOME (Private Conversations Screen) */}
          {/* HOME VIEW: SECURE DASHBOARD */}
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col overflow-hidden w-full h-full bg-[#030107]"
            >
              {/* Premium Dashboard Header */}
              <header className="p-6 md:p-8 shrink-0 flex items-center justify-between border-b border-white/5 bg-[#030107]/50 backdrop-blur-xl z-20">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={onClose}
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all group"
                  >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                  </button>
                  <div>
                    <h1 className="text-xl font-display font-black tracking-tight text-white flex items-center gap-2 whitespace-nowrap">
                      Secure Vault <ShieldCheck size={18} className="text-[#c77dff] shrink-0" />
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setView('settings')}
                    className="w-11 h-11 rounded-2xl bg-white/[0.03] hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-[#c77dff] transition-all"
                    title="Hidden Chats Settings"
                  >
                    <Settings size={20} />
                  </button>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-8">
                <div className="max-w-5xl mx-auto space-y-8">
                  
                  {/* Primary Access Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setView('privacy_folder')}
                      className="relative p-6 rounded-[32px] bg-gradient-to-br from-[#1a1128] to-[#090412] border border-white/10 overflow-hidden cursor-pointer group shadow-2xl"
                    >
                      <div className="absolute inset-0 bg-[#c77dff]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                        <FolderLock size={120} />
                      </div>
                      <div className="relative z-10 space-y-6">
                        <div className="w-14 h-14 rounded-2xl bg-[#c77dff]/10 border border-[#c77dff]/20 flex items-center justify-center text-[#c77dff]">
                          <ImageLucide size={28} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-white">Private Gallery</h3>
                          <p className="text-xs text-white/40 font-medium">Locked photos, videos and albums</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#c77dff]">
                          Explore Files <ChevronRight size={14} />
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setView('private_chats')}
                      className="bg-white/[0.03] border border-white/10 rounded-[32px] p-6 flex flex-col justify-between h-full cursor-pointer hover:bg-white/[0.05] transition-colors shadow-2xl relative overflow-hidden group"
                    >
                       <div className="flex justify-between items-start relative z-10">
                          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <MessageSquare size={24} />
                          </div>
                          <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[8px] font-black uppercase tracking-widest text-blue-400">
                            Secure Sync
                          </div>
                       </div>
                       <div className="mt-6 relative z-10">
                         <h3 className="text-lg font-black text-white">Private Chats</h3>
                         <p className="text-xs text-white/40 font-medium">End-to-end encrypted threads</p>
                       </div>
                       <div className="mt-4 flex items-center gap-2 relative z-10">
                         <div className="flex -space-x-2">
                           {filteredVaultChats.slice(0, 3).map((chat, i) => (
                             <img key={i} src={chat.photo} className="w-6 h-6 rounded-full border-2 border-[#030107]" alt="" />
                           ))}
                           {filteredVaultChats.length > 3 && (
                             <div className="w-6 h-6 rounded-full bg-white/5 border-2 border-[#030107] flex items-center justify-center text-[8px] font-bold">
                               +{filteredVaultChats.length - 3}
                             </div>
                           )}
                         </div>
                         <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{filteredVaultChats.length} Conversations</span>
                       </div>
                    </motion.div>
                  </div>
                </div>
              </main>

              {/* Floating ADD CHAT trigger button */}
              {!loading && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setView('private_chats')}
                  className="fixed bottom-10 right-10 w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7b2cbf] to-[#c77dff] flex items-center justify-center text-white shadow-2xl shadow-[#c77dff]/30 z-30 border border-white/20"
                >
                  <MessageSquare size={24} strokeWidth={2} />
                </motion.button>
              )}
            </motion.div>
          )}

          {/* VIEW: PRIVATE CHATS LIST */}
          {view === 'private_chats' && (
            <motion.div 
              key="private_chats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col overflow-hidden w-full h-full"
            >
              <div className="p-4 md:p-6 pb-2 shrink-0 flex items-center justify-between border-b border-white/5 w-full">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setView('home')}
                    className="p-1 px-2 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-all"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <h2 className="text-sm font-display font-black tracking-[0.15em] text-white uppercase">Private Chats</h2>
                </div>
                <button onClick={() => setView('add_chat')} className="text-[10px] font-black uppercase tracking-widest text-[#c77dff] hover:text-white transition-colors bg-[#c77dff]/10 px-3 py-1.5 rounded-lg border border-[#c77dff]/20">New Chat</button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3 no-scrollbar">
                {filteredVaultChats.length > 0 ? (
                  filteredVaultChats.map((chat) => (
                    <motion.div 
                      key={chat.id}
                      whileHover={{ x: 4 }}
                      onClick={() => onSelectChat(chat.id)}
                      className="flex items-center gap-4 p-4 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-[#c77dff]/30 hover:bg-white/[0.05] transition-all cursor-pointer group"
                    >
                      <div className="relative shrink-0">
                        <img src={chat.photo} alt={chat.name} className="w-12 h-12 rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                        {chat.online && (
                          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-4 border-[#030107]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="text-sm font-bold text-white truncate">{chat.name}</h4>
                          <span className="text-[9px] font-mono text-white/30">{chat.time}</span>
                        </div>
                        <p className="text-xs text-white/40 truncate font-medium">{chat.lastMessage}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestoreChat(chat.id);
                          }}
                          className="p-2 hover:bg-white/10 rounded-xl text-white/30 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                          title="Restore to Public"
                        >
                          <Unlock size={14} />
                        </button>
                        {chat.unread && (
                          <div className="w-2.5 h-2.5 bg-[#c77dff] rounded-full shadow-[0_0_10px_rgba(199,125,255,0.6)]" />
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-16 flex flex-col items-center justify-center text-center space-y-5 h-full">
                    <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center text-white/10 border border-white/5 shadow-2xl">
                      <MessageSquare size={36} className="opacity-50" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-black text-white">Private Chats</h3>
                      <p className="text-xs text-white/40 font-medium max-w-[220px] mx-auto">Start a secure conversation with someone.</p>
                    </div>
                    <button 
                      onClick={() => setView('add_chat')}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#7b2cbf] to-[#9d4edd] hover:brightness-110 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(157,78,221,0.35)] mt-4"
                    >
                      New Chat
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: ADD CHAT INTO VAULT SECTION */}
          {view === 'add_chat' && (
            <motion.div 
              key="add_chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col overflow-hidden w-full h-full"
            >
              {/* Add Top Title */}
              <div className="p-4 md:p-6 pb-2 shrink-0 flex items-center gap-3 border-b border-white/5 w-full">
                <button 
                  onClick={() => setView('home')}
                  className="p-1 px-2 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-all"
                >
                  <ArrowLeft size={16} />
                </button>
                <h2 className="text-xs font-display font-black uppercase tracking-[0.25em] text-[#d8bbff]">Add Conversation</h2>
              </div>

              {/* Categories Navigation Tabs */}
              <div className="flex bg-[#07030e] border-b border-white/5 shrink-0 px-4 py-2 gap-2">
                {[
                  { id: 'existing', label: 'Existing Chats', icon: <MessageSquare size={12} /> },
                  { id: 'following', label: 'Friends', icon: <UserCheck size={12} /> },
                  { id: 'followers', label: 'Followers', icon: <Users size={12} /> }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveAddTab(tab.id as any);
                      setAddSearchQuery('');
                    }}
                    className={`flex-1 py-2 px-1 rounded-[12px] text-[8px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border capitalize ${
                      activeAddTab === tab.id
                        ? 'bg-[#7b2cbf]/10 border-[#7b2cbf]/50 text-[#d8bbff] shadow-[0_0_10px_rgba(123,44,191,0.15)]'
                        : 'bg-white/[0.01] border-transparent text-white/40 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Quick Search */}
              <div className="px-4 py-3 shrink-0 bg-[#030107]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={13} />
                  <input 
                    type="text" 
                    placeholder="Search node frequencies..."
                    value={addSearchQuery}
                    onChange={(e) => setAddSearchQuery(e.target.value)}
                    className="w-full bg-[#090412]/60 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-white outline-none focus:border-[#7b2cbf]"
                  />
                </div>
              </div>

              {errorText && (
                <div className="px-4 shrink-0">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <p className="text-xs text-red-400 font-bold">{errorText}</p>
                  </div>
                </div>
              )}

              {/* Lists content */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-2 space-y-2 no-scrollbar">
                
                {activeAddTab === 'existing' && (
                  nonVaultChats
                    .filter(c => !addSearchQuery || (c.name || '').toLowerCase().includes(addSearchQuery.toLowerCase()))
                    .map((chat) => (
                      <div
                        key={chat.id}
                        className="flex items-center justify-between p-3 rounded-[20px] bg-[#090412]/30 border border-white/5 hover:border-[#7b2cbf]/20 transition-all select-none"
                      >
                        <div className="flex items-center gap-3 shrink min-w-0 pr-2">
                          <img src={chat.photo} className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/5" alt="" referrerPolicy="no-referrer" />
                          <div className="text-left min-w-0">
                            <p className="text-xs font-bold text-white truncate">{chat.name}</p>
                            <p className="text-[9px] text-white/30 font-semibold truncate leading-none pt-0.5">Active Session</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleMoveToVault(chat.id)}
                          className="px-3.5 py-2.5 rounded-xl bg-[#7b2cbf]/10 hover:bg-[#7b2cbf] text-[#c77dff] hover:text-white text-[8px] font-black uppercase tracking-widest border border-[#7b2cbf]/25 transition-all shrink-0 cursor-pointer"
                        >
                          Vault Chat
                        </button>
                      </div>
                    ))
                )}

                {activeAddTab === 'following' && (
                  followingProfiles
                    .filter(p => !addSearchQuery || (p.displayName || p.username || '').toLowerCase().includes(addSearchQuery.toLowerCase()))
                    .map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-3 rounded-[20px] bg-[#090412]/30 border border-white/5 hover:border-[#7b2cbf]/20 transition-all select-none"
                      >
                        <div className="flex items-center gap-3 shrink min-w-0 pr-2">
                          <img src={getAvatarUrl(friend.photoURL)} className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/5" alt="" referrerPolicy="no-referrer" />
                          <div className="text-left min-w-0">
                            <p className="text-xs font-bold text-white truncate">{friend.displayName || friend.username}</p>
                            <p className="text-[9px] text-white/30 font-semibold truncate leading-none pt-0.5">@{friend.username}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const targetChatId = [profile.id, friend.id].sort().join('_');
                            handleInitializeSecureVault(targetChatId, friend.displayName || friend.username || '');
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-[#7b2cbf]/10 hover:bg-[#7b2cbf] text-[#c77dff] hover:text-white text-[8px] font-black uppercase tracking-[0.14em] border border-[#7b2cbf]/25 transition-all shrink-0 cursor-pointer"
                        >
                          Vault Chat
                        </button>
                      </div>
                    ))
                )}

                {activeAddTab === 'followers' && (
                  followersProfiles
                    .filter(p => !addSearchQuery || (p.displayName || p.username || '').toLowerCase().includes(addSearchQuery.toLowerCase()))
                    .map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-3 rounded-[20px] bg-[#090412]/30 border border-white/5 hover:border-[#7b2cbf]/20 transition-all select-none"
                      >
                        <div className="flex items-center gap-3 shrink min-w-0 pr-2">
                          <img src={getAvatarUrl(friend.photoURL)} className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/5" alt="" referrerPolicy="no-referrer" />
                          <div className="text-left min-w-0">
                            <p className="text-xs font-bold text-white truncate">{friend.displayName || friend.username}</p>
                            <p className="text-[9px] text-white/30 font-semibold truncate leading-none pt-0.5">@{friend.username}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const targetChatId = [profile.id, friend.id].sort().join('_');
                            handleInitializeSecureVault(targetChatId, friend.displayName || friend.username || '');
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-[#7b2cbf]/10 hover:bg-[#7b2cbf] text-[#c77dff] hover:text-white text-[8px] font-black uppercase tracking-[0.14em] border border-[#7b2cbf]/25 transition-all shrink-0 cursor-pointer"
                        >
                          Vault Chat
                        </button>
                      </div>
                    ))
                )}

                {/* Empty fallback handling matches */}
                {((activeAddTab === 'existing' && nonVaultChats.length === 0) ||
                  (activeAddTab === 'following' && followingProfiles.length === 0) ||
                  (activeAddTab === 'followers' && followersProfiles.length === 0)) && (
                  <div className="py-12 text-center text-white/20 uppercase font-bold tracking-widest text-[9px] leading-relaxed">
                    No selective channels available.
                  </div>
                )}

              </div>

            </motion.div>
          )}

          {/* VIEW: VAULT SECURITY SETTINGS (Internal settings screen) */}
          {view === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col overflow-hidden w-full h-full text-left"
            >
              {/* Header */}
              <div className="p-4 md:p-6 pb-2 shrink-0 flex items-center gap-3 border-b border-white/5 w-full">
                <button 
                  onClick={() => {
                    setErrorText('');
                    setSuccessText('');
                    setView('home');
                  }}
                  className="p-1 px-2 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-all"
                >
                  <ArrowLeft size={16} />
                </button>
                <h2 className="text-sm font-display font-black uppercase tracking-[0.22em] text-[#d8bbff]">Hidden Chats Settings</h2>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 no-scrollbar pb-24">
                
                {/* Auto Lock timer segment */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[#c77dff]" />
                    <span className="text-[10px] font-black uppercase text-white/50 tracking-widest block">Auto Lock Timeout</span>
                  </div>
                  <p className="text-[10px] text-white/40 leading-relaxed max-w-[280px]">
                    Choose inactive duration time before immediately locking again.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { value: 'immediately', label: 'Immediately' },
                      { value: '30', label: '30 Seconds' },
                      { value: '60', label: '1 Minute' },
                      { value: '300', label: '5 Minutes' },
                      { value: '900', label: '15 Minutes' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAutoLockDuration(opt.value)}
                        className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                          autoLockDuration === opt.value
                            ? 'bg-[#7b2cbf]/10 border-[#7b2cbf] text-[#e2afff] shadow-[0_0_10px_rgba(123,44,191,0.25)]'
                            : 'bg-[#090412]/40 border-transparent text-white/40 hover:border-white/10 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Biometric Toggle Switch */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <Fingerprint size={14} className="text-[#c77dff]" />
                        <span className="text-[10px] font-black uppercase text-white/50 tracking-widest block">Device Biometrics</span>
                      </div>
                      <p className="text-[10px] text-white/40 leading-relaxed max-w-[260px]">
                        Enable optional fingerprint/face recognition if supported.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBiometricEnabled(!biometricEnabled)}
                      className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${biometricEnabled ? 'bg-[#7b2cbf]' : 'bg-white/10'}`}
                    >
                      <motion.span 
                        animate={{ x: biometricEnabled ? 22 : 4 }}
                        className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white transition-all shadow" 
                      />
                    </button>
                  </div>
                </div>

                {/* Silent Notifications option */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <Bell size={14} className="text-[#c77dff]" />
                        <span className="text-[10px] font-black uppercase text-white/50 tracking-widest block">Silent Notifications</span>
                      </div>
                      <p className="text-[10px] text-white/40 leading-relaxed max-w-[260px]">
                        Do not reveal notification names or content layers.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSilentNotifications(!silentNotifications)}
                      className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${silentNotifications ? 'bg-[#7b2cbf]' : 'bg-white/10'}`}
                    >
                      <motion.span 
                        animate={{ x: silentNotifications ? 22 : 4 }}
                        className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white transition-all shadow" 
                      />
                    </button>
                  </div>
                </div>

                {/* Password reset controls */}
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <span className="text-[10px] font-black uppercase text-white/50 tracking-widest block pb-1">Master Credentials</span>
                  
                  <button
                    onClick={() => {
                      setPasscodeInput('');
                      setPasscodeConfirm('');
                      setView('setup_passcode');
                    }}
                    className="w-full text-left p-3.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl hover:border-[#7b2cbf]/30 flex items-center justify-between text-[#d8bbff] transition-all cursor-pointer font-sans text-xs font-bold uppercase tracking-wider"
                  >
                    <div className="flex items-center gap-2">
                      <Key size={13} />
                      <span>Configure Passcode</span>
                    </div>
                    <span className="text-[8px] text-white/20 font-black tracking-widest">Update</span>
                  </button>

                  <button
                    onClick={() => {
                      setRecoveryAnswers(['', '', '']);
                      setView('setup_recovery');
                    }}
                    className="w-full text-left p-3.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl hover:border-[#7b2cbf]/30 flex items-center justify-between text-[#d8bbff] transition-all cursor-pointer font-sans text-xs font-bold uppercase tracking-wider"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle size={13} />
                      <span>Recovery Configuration</span>
                    </div>
                    <span className="text-[8px] text-white/20 font-black tracking-widest">Update</span>
                  </button>
                </div>

                {/* Error text */}
                {(successText || errorText) && (
                  <div className="space-y-2 text-center text-xs">
                    {successText && <p className="text-[#c77dff] font-black tracking-widest animate-pulse">{successText}</p>}
                    {errorText && <p className="text-red-400 font-bold tracking-wide">{errorText}</p>}
                  </div>
                )}

                <button
                  onClick={handleSettingsUpdate}
                  className="w-full min-h-[48px] rounded-[20px] bg-gradient-to-r from-[#7b2cbf] to-[#c77dff] hover:brightness-110 text-white text-[9px] font-black uppercase tracking-[0.25em]"
                >
                  Save Settings
                </button>

              </div>
            </motion.div>
          )}

          {/* VIEW: PRIVACY FOLDER */}
          {view === 'privacy_folder' && (
            <PrivacyFolderLayout 
              db={db}
              profile={profile}
              onBack={() => setView('home')} 
              onSettingsClick={() => setView('settings')} 
              privacyMedia={privacyMedia}
              handleMediaUpload={handleMediaUpload}
              onDelete={handleVaultDelete}
              onFavorite={handleVaultFavorite}
              onRestore={handleRestoreMedia}
            />
          )}

        </AnimatePresence>

      </div>
    </div>
  );
};
