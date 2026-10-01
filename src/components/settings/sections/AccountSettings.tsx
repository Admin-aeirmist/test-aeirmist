import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Camera, Mail, ShieldCheck, Phone, Calendar, MapPin, Globe, Info, 
  Trash2, Download, Check, AlertCircle, Save, FileText, CheckCircle2, 
  X, RefreshCw, Eye, Sparkles, AlertTriangle, ShieldAlert, Award, Tag, LogOut, ExternalLink,
  Heart, Users, Lock, ChevronDown, ChevronRight, ChevronLeft, Clock, PauseCircle, UserX, Edit2
} from 'lucide-react';
import { getAvatarUrl } from '../../../lib/avatar';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { 
  sendEmailVerification, 
  verifyBeforeUpdateEmail, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  reauthenticateWithPopup, 
  GoogleAuthProvider, 
  RecaptchaVerifier, 
  linkWithPhoneNumber 
} from 'firebase/auth';
import { useTheme } from '../../../context/ThemeContext';
import { useAeirmist } from '../../../context/AeirmistContext';
import { mapAuthError } from '../../../utils/authErrorMapper';
import { logger } from '@/src/utils/logger';


interface AccountSettingsProps {
  formData: any;
  handleFieldChange: (field: string, value: any) => void;
  handleAvatarUpload: () => void;
  handleBannerUpload: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  bannerInputRef: React.RefObject<HTMLInputElement>;
  localAvatarURL: string | null;
  localCoverURL: string | null;
  setLocalAvatarURL: (v: string | null) => void;
  setLocalCoverURL: (v: string | null) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  handleUpdate: () => Promise<void>;
  profile: any;
  user: any;
  checkUsernameAvailable: (username: string) => Promise<{ available: boolean; suggestions?: string[] }>;
  unlinkAccountMethod: (providerId: string) => Promise<void>;
  linkAccountMethod: (provider: string) => Promise<void>;
  requestDeleteAccount: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  addToast?: (toast: { title: string; message: string; type: 'success' | 'warning' | 'info' }) => void;
  refreshProfile: () => Promise<void>;
  reloadAuthUser: () => Promise<void>;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({
  formData,
  handleFieldChange,
  handleAvatarUpload,
  handleBannerUpload,
  handleFileSelect,
  fileInputRef,
  bannerInputRef,
  localAvatarURL,
  localCoverURL,
  setLocalAvatarURL,
  setLocalCoverURL,
  isSaving,
  saveSuccess,
  handleUpdate,
  profile,
  user,
  checkUsernameAvailable,
  unlinkAccountMethod,
  linkAccountMethod,
  requestDeleteAccount,
  deleteAccount,
  addToast,
  refreshProfile,
  reloadAuthUser
}) => {
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  const { syncDatabaseProfile } = useAeirmist();
  const [isSyncingDb, setIsSyncingDb] = useState(false);

  // Username Checker States
  const [usernameInput, setUsernameInput] = useState('');
  const [isChangingUsername, setIsChangingUsername] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

  // Action Confirmation Modal States
  const [showPreview, setShowPreview] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isProcessingDangerAction, setIsProcessingDangerAction] = useState(false);

  // Collapsible Danger Zone State
  const [isDangerZoneExpanded, setIsDangerZoneExpanded] = useState(false);
  const [isUsernameRulesExpanded, setIsUsernameRulesExpanded] = useState(false);

  // Meta-style Guided Deactivate / Delete Modal States
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [metaModalStep, setMetaModalStep] = useState<
    'choice' | 'deactivate_duration' | 'deactivate_reason' | 'deactivate_confirm' | 'delete_interstitial' | 'delete_reason' | 'delete_confirm'
  >('choice');
  const [deactivateDuration, setDeactivateDuration] = useState<
    '1_day' | '1_week' | '1_month' | '3_months' | 'manual'
  >('manual');
  const [deactivateReason, setDeactivateReason] = useState('Taking a break');
  const [deleteReason, setDeleteReason] = useState('Creating a new account');
  const [deleteInputText, setDeleteInputText] = useState('');

  // Cooldown calculation (5 days after last reactivation)
  const lastReactivatedMs = profile?.lastReactivatedAt ? new Date(profile.lastReactivatedAt).getTime() : 0;
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  const cooldownEndDate = new Date(lastReactivatedMs + fiveDaysMs);
  const isDeactivationInCooldown = lastReactivatedMs > 0 && Date.now() < (lastReactivatedMs + fiveDaysMs);
  const cooldownDateString = cooldownEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const computeReturnDate = (duration: string) => {
    const now = new Date();
    if (duration === '1_day') {
      now.setDate(now.getDate() + 1);
    } else if (duration === '1_week') {
      now.setDate(now.getDate() + 7);
    } else if (duration === '1_month') {
      now.setDate(now.getDate() + 30);
    } else if (duration === '3_months') {
      now.setDate(now.getDate() + 90);
    } else {
      return null;
    }
    return now;
  };

  const formatReturnDateText = (duration: string) => {
    const d = computeReturnDate(duration);
    if (!d) return "Your account stays deactivated until you log back in — there's no automatic return date.";
    return `Your account will automatically turn back on ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const openMetaAccountModal = (initialTab: 'choice' | 'deactivate' | 'delete') => {
    setShowMetaModal(true);
    setDeleteInputText('');
    if (initialTab === 'deactivate') {
      setMetaModalStep('deactivate_duration');
    } else if (initialTab === 'delete') {
      setMetaModalStep('delete_interstitial');
    } else {
      setMetaModalStep('choice');
    }
  };

  const handleMetaModalStepBack = () => {
    if (metaModalStep === 'deactivate_duration' || metaModalStep === 'delete_interstitial') {
      setMetaModalStep('choice');
    } else if (metaModalStep === 'deactivate_reason') {
      setMetaModalStep('deactivate_duration');
    } else if (metaModalStep === 'deactivate_confirm') {
      setMetaModalStep('deactivate_reason');
    } else if (metaModalStep === 'delete_reason') {
      setMetaModalStep('delete_interstitial');
    } else if (metaModalStep === 'delete_confirm') {
      setMetaModalStep('delete_reason');
    } else {
      setShowMetaModal(false);
    }
  };

  const handleConfirmDeactivationSubmit = async () => {
    if (isDeactivationInCooldown) {
      addToast?.({
        title: 'DEACTIVATION COOLDOWN',
        message: `You can deactivate again starting ${cooldownDateString}.`,
        type: 'warning'
      });
      return;
    }
    setIsProcessingDangerAction(true);
    try {
      const returnDateObj = computeReturnDate(deactivateDuration);
      handleFieldChange('isDeactivated', true);
      handleFieldChange('deactivatedAt', new Date().toISOString());
      handleFieldChange('deactivationDuration', deactivateDuration);
      handleFieldChange('deactivationReturnDate', returnDateObj ? returnDateObj.toISOString() : null);
      handleFieldChange('deactivationReason', deactivateReason);
      await handleUpdate();
      
      addToast?.({
        title: 'ACCOUNT DEACTIVATED',
        message: returnDateObj 
          ? `Your account will auto-reactivate on ${returnDateObj.toLocaleDateString()}.`
          : 'Your account is deactivated. Log back in anytime to restore.',
        type: 'info'
      });
      setShowMetaModal(false);
      if (auth.currentUser) {
        await auth.signOut();
      }
    } catch (err: any) {
      addToast?.({
        title: 'Deactivation Error',
        message: 'Could not deactivate account. Please try again.',
        type: 'warning'
      });
    } finally {
      setIsProcessingDangerAction(false);
    }
  };

  const handleConfirmDeletionScheduleSubmit = async () => {
    if (deleteInputText.trim() !== 'DELETE') {
      addToast?.({
        title: 'Confirmation Mismatch',
        message: 'Please type DELETE to confirm scheduled deletion.',
        type: 'warning'
      });
      return;
    }
    setIsProcessingDangerAction(true);
    try {
      setShowMetaModal(false);
      await requestDeleteAccount();
    } catch (err: any) {
      addToast?.({
        title: 'Deletion Schedule Error',
        message: 'Could not schedule account deletion. Please try again.',
        type: 'warning'
      });
    } finally {
      setIsProcessingDangerAction(false);
    }
  };

  // Email state change
  const [newEmail, setNewEmail] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSendingEmailVerification, setIsSendingEmailVerification] = useState(false);
  const [emailModalPassword, setEmailModalPassword] = useState('');
  const [requiresPasswordReauth, setRequiresPasswordReauth] = useState(false);
  const [emailModalError, setEmailModalError] = useState('');
  const [isEmailChanging, setIsEmailChanging] = useState(false);

  // Phone OTP states
  const [phoneOtpStep, setPhoneOtpStep] = useState<'idle' | 'code'>('idle');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [otpCode, setOtpCode] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false);
  const [isPhoneConfirming, setIsPhoneConfirming] = useState(false);

  const handleSendEmailVerification = async () => {
    if (!auth.currentUser) return;
    setIsSendingEmailVerification(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        addToast?.({
          title: 'ALREADY VERIFIED',
          message: 'Your email address is already verified.',
          type: 'info'
        });
        await reloadAuthUser();
        return;
      }
      const origin = typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://aeirmist.com';
      await sendEmailVerification(auth.currentUser, {
        url: `${origin}/?mode=verifyEmail`,
        handleCodeInApp: true,
      });
      addToast?.({
        title: 'VERIFICATION SENT',
        message: 'A verification link has been sent to your primary email.',
        type: 'success'
      });
    } catch (err: any) {
      addToast?.({
        title: 'VERIFICATION ERROR',
        message: mapAuthError(err),
        type: 'warning'
      });
    } finally {
      setIsSendingEmailVerification(false);
    }
  };

  const handleChangeEmailSubmit = async () => {
    setEmailModalError('');
    if (!newEmail || !newEmail.includes('@')) {
      setEmailModalError('Please enter a valid email address.');
      return;
    }
    if (!auth.currentUser) return;

    setIsEmailChanging(true);
    try {
      const origin = typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://aeirmist.com';
      const actionCodeSettings = {
        url: `${origin}/?mode=verifyAndChangeEmail`,
        handleCodeInApp: true,
      };
      try {
        await verifyBeforeUpdateEmail(auth.currentUser, newEmail, actionCodeSettings);
      } catch (err: any) {
        if (err.code === 'auth/requires-recent-login' || err.code === 'auth/recent-login-required') {
          const hasPasswordProvider = auth.currentUser.providerData.some(p => p.providerId === 'password');
          if (hasPasswordProvider && !requiresPasswordReauth) {
            setRequiresPasswordReauth(true);
            setIsEmailChanging(false);
            setEmailModalError('Recent login required. Please enter your password to confirm.');
            return;
          } else if (hasPasswordProvider && requiresPasswordReauth) {
            if (!emailModalPassword) {
              setEmailModalError('Please enter your password.');
              setIsEmailChanging(false);
              return;
            }
            const credential = EmailAuthProvider.credential(auth.currentUser.email!, emailModalPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);
            await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
          } else {
            const provider = new GoogleAuthProvider();
            await reauthenticateWithPopup(auth.currentUser, provider);
            await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
          }
        } else {
          throw err;
        }
      }

      // Update Firestore with pending state
      await handleUpdate();
      
      // Sync local context/auth
      await reloadAuthUser();
      await refreshProfile();

      setShowEmailModal(false);
      setNewEmail('');
      setEmailModalPassword('');
      setRequiresPasswordReauth(false);
      
      addToast?.({
        title: 'CONFIRMATION LINK SENT',
        message: `A verification link has been sent to ${newEmail}. Once verified, your primary email will update automatically.`,
        type: 'success'
      });
    } catch (err: any) {
      setEmailModalError(mapAuthError(err));
    } finally {
      setIsEmailChanging(false);
    }
  };

  const handleVerifyPhoneClick = async () => {
    setPhoneError('');
    const phoneNumberVal = formData.phoneNumber || '';
    const countryCode = formData.phoneCountryCode || '+1';
    if (!phoneNumberVal.trim()) {
      setPhoneError('Please enter a valid phone number.');
      return;
    }
    if (!auth.currentUser) return;

    setIsPhoneVerifying(true);
    try {
      if ((window as any).recaptchaVerifier) {
        try { (window as any).recaptchaVerifier.clear(); } catch(e) {}
      }
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {}
      });
      (window as any).recaptchaVerifier = verifier;

      const fullNumber = `${countryCode}${phoneNumberVal.trim().replace(/^0+/, '')}`;
      const confirmation = await linkWithPhoneNumber(auth.currentUser, fullNumber, verifier);
      setConfirmationResult(confirmation);
      setPhoneOtpStep('code');
      addToast?.({
        title: 'OTP SENT',
        message: `Verification code sent to ${fullNumber}.`,
        type: 'info'
      });
    } catch (err: any) {
      if (err.code === 'auth/credential-already-in-use') {
        setPhoneError('This phone number is already linked to another account.');
      } else if (err.code === 'auth/invalid-phone-number') {
        setPhoneError('Invalid phone number format.');
      } else if (err.code === 'auth/too-many-requests') {
        setPhoneError('Too many attempts. Please try again later.');
      } else {
        setPhoneError(err.message || 'Failed to send verification code.');
      }
    } finally {
      setIsPhoneVerifying(false);
    }
  };

  const handleConfirmOtpCode = async () => {
    setPhoneError('');
    if (!otpCode || otpCode.length < 6) {
      setPhoneError('Please enter the 6-digit verification code.');
      return;
    }
    if (!confirmationResult) {
      setPhoneError('No active verification session. Please resend code.');
      return;
    }

    setIsPhoneConfirming(true);
    try {
      await confirmationResult.confirm(otpCode);
      
      // Update Auth and Firestore
      handleFieldChange('phoneVerified', true);
      handleFieldChange('phoneNumber', formData.phoneNumber || '');
      
      await handleUpdate();
      await reloadAuthUser();
      await refreshProfile();

      setPhoneOtpStep('idle');
      setOtpCode('');
      setConfirmationResult(null);
      addToast?.({
        title: 'PHONE VERIFIED',
        message: 'Your mobile number is successfully verified and linked.',
        type: 'success'
      });
    } catch (err: any) {
      if (err.code === 'auth/invalid-verification-code') {
        setPhoneError('Invalid verification code. Please check and try again.');
      } else if (err.code === 'auth/code-expired') {
        setPhoneError('Verification code expired. Please request a new code.');
      } else {
        setPhoneError(err.message || 'Verification confirmation failed.');
      }
    } finally {
      setIsPhoneConfirming(false);
    }
  };

  // Relationship Status & Visibility dropdown states
  const [isRelationshipDropdownOpen, setIsRelationshipDropdownOpen] = useState(false);
  const [isVisibilityDropdownOpen, setIsVisibilityDropdownOpen] = useState(false);

  const RELATIONSHIP_OPTIONS = [
    "Status",
    "Single",
    "In a relationship",
    "Engaged",
    "Married",
    "In a civil union",
    "In a domestic partnership",
    "In an open relationship",
    "It's complicated",
    "Separated",
    "Divorced",
    "Widowed"
  ];

  const VISIBILITY_OPTIONS = [
    { id: 'public', label: 'Public', icon: Globe },
    { id: 'friends', label: 'Friends Only', icon: Users },
    { id: 'only_me', label: 'Only Me', icon: Lock },
  ];

  // Location Autocomplete states & dataset
  const [locationSearchInput, setLocationSearchInput] = useState(formData.location || '');
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  // Pronouns Picker states & dataset
  const [pronounsQuery, setPronounsQuery] = useState('');
  const [isPronounsDropdownOpen, setIsPronounsDropdownOpen] = useState(false);

  const WORLD_CITIES = [
    { city: "New York", country: "United States", countryCode: "US" },
    { city: "Los Angeles", country: "United States", countryCode: "US" },
    { city: "San Francisco", country: "United States", countryCode: "US" },
    { city: "Chicago", country: "United States", countryCode: "US" },
    { city: "London", country: "United Kingdom", countryCode: "GB" },
    { city: "Manchester", country: "United Kingdom", countryCode: "GB" },
    { city: "Paris", country: "France", countryCode: "FR" },
    { city: "Lyon", country: "France", countryCode: "FR" },
    { city: "Tokyo", country: "Japan", countryCode: "JP" },
    { city: "Osaka", country: "Japan", countryCode: "JP" },
    { city: "Toronto", country: "Canada", countryCode: "CA" },
    { city: "Vancouver", country: "Canada", countryCode: "CA" },
    { city: "Sydney", country: "Australia", countryCode: "AU" },
    { city: "Melbourne", country: "Australia", countryCode: "AU" },
    { city: "Dhaka", country: "Bangladesh", countryCode: "BD" },
    { city: "Dinajpur", country: "Bangladesh", countryCode: "BD" },
    { city: "Chittagong", country: "Bangladesh", countryCode: "BD" },
    { city: "Sylhet", country: "Bangladesh", countryCode: "BD" },
    { city: "Berlin", country: "Germany", countryCode: "DE" },
    { city: "Munich", country: "Germany", countryCode: "DE" },
    { city: "Singapore", country: "Singapore", countryCode: "SG" },
    { city: "Dubai", country: "United Arab Emirates", countryCode: "AE" },
    { city: "Cairo", country: "Egypt", countryCode: "EG" },
    { city: "São Paulo", country: "Brazil", countryCode: "BR" },
    { city: "Rio de Janeiro", country: "Brazil", countryCode: "BR" },
    { city: "Mexico City", country: "Mexico", countryCode: "MX" },
    { city: "Seoul", country: "South Korea", countryCode: "KR" },
    { city: "Rome", country: "Italy", countryCode: "IT" },
    { city: "Milan", country: "Italy", countryCode: "IT" },
    { city: "Madrid", country: "Spain", countryCode: "ES" },
    { city: "Barcelona", country: "Spain", countryCode: "ES" },
    { city: "Amsterdam", country: "Netherlands", countryCode: "NL" },
    { city: "Stockholm", country: "Sweden", countryCode: "SE" },
    { city: "Zurich", country: "Switzerland", countryCode: "CH" },
    { city: "Vienna", country: "Austria", countryCode: "AT" },
    { city: "Mumbai", country: "India", countryCode: "IN" },
    { city: "New Delhi", country: "India", countryCode: "IN" },
    { city: "Bangkok", country: "Thailand", countryCode: "TH" },
    { city: "Buenos Aires", country: "Argentina", countryCode: "AR" },
    { city: "Cape Town", country: "South Africa", countryCode: "ZA" },
    { city: "Auckland", country: "New Zealand", countryCode: "NZ" },
    { city: "Istanbul", country: "Turkey", countryCode: "TR" }
  ];

  const PRONOUN_SUGGESTIONS = [
    "He/him",
    "She/her",
    "They/them",
    "He/they",
    "She/they",
    "Ze/hir",
    "Xe/xem",
    "It/its",
    "Any pronouns"
  ];

  // Profile completion fields calculation
  const calculateCompletion = () => {
    const fields = [
      formData.displayName,
      formData.username,
      formData.bio,
      formData.website,
      formData.pronouns,
      formData.dateOfBirth,
      formData.gender,
      formData.location,
      formData.photoURL,
      formData.bannerURL
    ];
    const filled = fields.filter(f => !!f).length;
    return Math.round((filled / fields.length) * 100);
  };
  const completionPercentage = calculateCompletion();

  // Handle Unsaved Changes Tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  useEffect(() => {
    if (!profile) return;
    const changed = Object.keys(formData).some(key => {
      if (key === 'socialLinks') {
        return Object.keys(formData.socialLinks || {}).some(
          sKey => (formData.socialLinks?.[sKey] || '') !== (profile.socialLinks?.[sKey] || '')
        );
      }
      if (key === 'privacySettings' || key === 'themeSettings') {
        return JSON.stringify(formData[key]) !== JSON.stringify(profile[key]);
      }
      return (formData[key] ?? '') !== (profile[key] ?? '');
    });
    setHasUnsavedChanges(changed);
  }, [formData, profile]);

  useEffect(() => {
    if (saveSuccess) {
      setHasUnsavedChanges(false);
    }
  }, [saveSuccess]);

  const resetForm = () => {
    if (!profile) return;
    Object.keys(formData).forEach(key => {
      handleFieldChange(key, profile[key]);
    });
    setLocalAvatarURL(null);
    setLocalCoverURL(null);
    addToast?.({
      title: 'FORM RESET',
      message: 'All unsaved changes have been restored to their original values.',
      type: 'info'
    });
  };

  const handleSaveClick = async () => {
    try {
      await handleUpdate();
      
      // Force refresh of Auth and Profile to ensure UI is in sync
      await reloadAuthUser();
      await refreshProfile();
      
      setHasUnsavedChanges(false);
      
      addToast?.({
        title: 'CHANGES SAVED',
        message: 'Your account configuration has been updated successfully.',
        type: 'success'
      });
    } catch (e: any) {
      addToast?.({
        title: 'SAVE ERROR',
        message: 'An error occurred while saving.',
        type: 'warning'
      });
    }
  };

  // Username validation logic
  useEffect(() => {
    if (!isChangingUsername || !usernameInput) {
      setUsernameStatus('idle');
      setUsernameError('');
      setCheckingUsername(false);
      return;
    }

    const currentHandle = (profile?.username || formData.username || '').toLowerCase();
    if (usernameInput.toLowerCase() === currentHandle) {
      setUsernameStatus('idle');
      setUsernameError('');
      setCheckingUsername(false);
      return;
    }

    if (usernameInput.length < 3) {
      setUsernameStatus('invalid');
      setUsernameError('Username must be at least 3 characters.');
      setCheckingUsername(false);
      return;
    }

    if (usernameInput.length > 30) {
      setUsernameStatus('invalid');
      setUsernameError('Username must be 30 characters or less.');
      setCheckingUsername(false);
      return;
    }

    const regex = /^[a-z0-9_.]+$/;
    if (!regex.test(usernameInput)) {
      setUsernameStatus('invalid');
      setUsernameError('Only lowercase letters, numbers, underscores, and periods are allowed.');
      setCheckingUsername(false);
      return;
    }

    setUsernameError('');
    setUsernameStatus('checking');
    setCheckingUsername(true);

    const debounce = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailable(usernameInput);
        if (res.available) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus('taken');
          // Generate high quality fallback suggestions
          const suggested = res.suggestions || [
            usernameInput + '_official',
            usernameInput + '99',
            usernameInput + '_dev'
          ];
          setUsernameSuggestions(suggested);
        }
      } catch (err) {
        setUsernameStatus('invalid');
        setUsernameError('Could not verify username.');
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(debounce);
  }, [usernameInput, profile?.username, formData.username, isChangingUsername]);

  const applyUsernameSuggestion = (suggestion: string) => {
    setUsernameInput(suggestion);
  };

  const commitUsernameChange = async () => {
    if (usernameStatus !== 'available' || !usernameInput) {
      addToast?.({
        title: 'INVALID USERNAME',
        message: 'Please choose an available username first.',
        type: 'warning'
      });
      return;
    }
    const cleanUsername = usernameInput.toLowerCase().trim();
    handleFieldChange('username', cleanUsername);
    setIsChangingUsername(false);
    setUsernameInput('');
    setUsernameStatus('idle');
    addToast?.({
      title: 'USERNAME CLAIMED',
      message: `Username changed to @${cleanUsername}. Save changes to finalize.`,
      type: 'success'
    });
  };

  // Real data export function
  const handleDownloadConfirm = async () => {
    setIsProcessingDangerAction(true);
    try {
      addToast?.({
        title: 'EXPORT INITIALIZED',
        message: 'Active Devices are gathering your distributed data artifacts...',
        type: 'info'
      });

      const exportData: any = {
        version: "2.0",
        exportTime: new Date().toISOString(),
        user: {
          uid: user?.uid,
          email: user?.email,
          createdAt: user?.metadata?.creationTime
        },
        profile: formData
      };

      // 1. Fetch Posts
      const postsSnap = await getDocs(query(collection(db, 'posts'), where('userId', '==', user.uid)));
      exportData.posts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fetch Stores/Products
      const storesSnap = await getDocs(query(collection(db, 'stores'), where('ownerUid', '==', user.uid)));
      exportData.stores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const productPromises = exportData.stores.map((s: any) => 
        getDocs(query(collection(db, 'products'), where('storeId', '==', s.id)))
      );
      const productSnaps = await Promise.all(productPromises);
      exportData.products = productSnaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 3. Fetch Orders
      const ordersSnap = await getDocs(query(collection(db, 'orders'), where('buyerId', '==', user.uid)));
      exportData.orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aeirmist-data-export-${formData.username || 'profile'}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast?.({
        title: 'EXPORT COMPLETE',
        message: 'Your data archive has been generated and downloaded.',
        type: 'success'
      });
    } catch (err) {
      logger.error("Export failed:", err);
      addToast?.({
        title: 'EXPORT FAILED',
        message: 'Failed to save data archive.',
        type: 'warning'
      });
    } finally {
      setIsProcessingDangerAction(false);
      setShowDownloadConfirm(false);
    }
  };

  // Deactivate handler
  const handleDeactivateConfirm = async () => {
    setIsProcessingDangerAction(true);
    try {
      handleFieldChange('isDeactivated', true);
      await handleUpdate();
      addToast?.({
        title: 'ACCOUNT DEACTIVATED',
        message: 'Your profile has been hidden. Log back in to reactivate.',
        type: 'info'
      });
      setShowDeactivateConfirm(false);
    } catch (err: any) {
      addToast?.({
        title: 'DEACTIVATION ERROR',
        message: 'Could not deactivate account.',
        type: 'warning'
      });
    } finally {
      setIsProcessingDangerAction(false);
    }
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== (profile?.username || '')) {
      addToast?.({
        title: 'CONFIRMATION MISMATCH',
        message: 'Please type your exact current username to confirm.',
        type: 'warning'
      });
      return;
    }
    setIsProcessingDangerAction(true);
    try {
      await deleteAccount();
      addToast?.({
        title: 'ACCOUNT PERMANENTLY DELETED',
        message: 'Your account and all associated data have been wiped from the system.',
        type: 'success'
      });
      setShowDeleteConfirm(false);
    } catch (err: any) {
      addToast?.({
        title: 'DELETE ERROR',
        message: 'Failed to initialize account purge.',
        type: 'warning'
      });
    } finally {
      setIsProcessingDangerAction(false);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const categories = [
    "Creator",
    "Developer",
    "Designer",
    "Musician",
    "Artist",
    "Writer",
    "Gamer",
    "Influencer",
    "Other"
  ];

  return (
    <div className="w-full relative">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-full overflow-hidden">
        
        {/* LEFT COLUMN: PROFILE SUMMARY CARD */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-6">
          <div className={`relative rounded-[2rem] p-6 shadow-2xl overflow-hidden group border transition-all ${
            isLight 
              ? 'bg-white border-slate-200 text-slate-900 shadow-sm' 
              : 'bg-[#0f172a]/95 backdrop-blur-2xl border-white/15 text-white shadow-2xl'
          }`}>
            
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-aeirmist-cyan/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* LARGE COVER PHOTO */}
            <div className="relative h-28 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 mb-14 group/cover cursor-pointer">
              <input 
                type="file" 
                ref={bannerInputRef} 
                className="hidden" 
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleFileSelect(e, 'banner')}
                accept="image/*"
              />
              {(localCoverURL || formData.bannerURL) ? (
                <img 
                  src={localCoverURL || formData.bannerURL} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/cover:scale-105" 
                  alt="Cover" 
                />
              ) : (
                <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <span className={`text-[10px] uppercase font-bold tracking-widest ${isLight ? 'text-slate-400' : 'text-white/40'}`}>No Cover Photo</span>
                </div>
              )}
              
              {/* Hover Overlay */}
              <div 
                onClick={() => bannerInputRef.current?.click()} 
                className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 flex flex-col items-center justify-center transition-opacity duration-200 backdrop-blur-xs"
              >
                <Camera size={18} className="text-aeirmist-cyan mb-1" />
                <span className="text-[9px] uppercase font-bold tracking-widest text-aeirmist-cyan">Change Cover</span>
              </div>
            </div>

            {/* PROFILE PICTURE (ROUNDED RECTANGLE - NOT CIRCULAR) */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 group/avatar cursor-pointer">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleFileSelect(e, 'avatar')}
                accept="image/*"
              />
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-[#121620] bg-slate-200 dark:bg-[#121620] shadow-xl group-hover/avatar:border-aeirmist-cyan transition-all">
                <img 
                  src={localAvatarURL || getAvatarUrl(formData.photoURL)} 
                  className="w-full h-full object-cover" 
                  alt="Avatar" 
                />
                
                {/* Hover Overlay */}
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="absolute inset-0 bg-black/65 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center transition-opacity duration-200"
                >
                  <Camera size={16} className="text-aeirmist-cyan mb-1" />
                  <span className="text-[8px] uppercase font-bold tracking-wider text-aeirmist-cyan">Change</span>
                </div>
              </div>
            </div>

            {/* DISPLAY NAME & USERNAME */}
            <div className="text-center mt-2 space-y-1">
              <div className="flex items-center justify-center gap-1.5">
                <h3 className={`text-lg font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>{formData.displayName || 'Unnamed User'}</h3>
                {profile?.isVerified && (
                  <ShieldCheck className="text-aeirmist-cyan shrink-0" size={16} />
                )}
              </div>
              <p className="text-xs font-mono text-aeirmist-cyan font-bold">@{formData.username || 'username'}</p>
            </div>

            {/* BIO BRIEF */}
            <p className={`text-xs text-center mt-3 line-clamp-2 italic px-2 ${isLight ? 'text-slate-600' : 'text-white/80'}`}>
              {formData.bio || 'No biography written yet.'}
            </p>

            {/* FOLLOWERS / FOLLOWING METRICS */}
            <div className="grid grid-cols-2 gap-4 border-y border-slate-200 dark:border-white/10 py-3.5 mt-4 text-center">
              <div>
                <span className={`block text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {Array.isArray(profile?.social?.followers) ? profile.social.followers.length : Math.max(0, profile?.followersCount || 0)}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-500' : 'text-white/60'}`}>Followers</span>
              </div>
              <div className="border-l border-slate-200 dark:border-white/10">
                <span className={`block text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {Array.isArray(profile?.social?.following) ? profile.social.following.length : Math.max(0, profile?.followingCount || 0)}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-slate-500' : 'text-white/60'}`}>Following</span>
              </div>
            </div>

            {/* ACCOUNT TYPE BADGE */}
            <div className="flex items-center justify-between mt-4 px-1">
              <span className={`text-[10px] uppercase tracking-wider font-bold ${isLight ? 'text-slate-600' : 'text-white/70'}`}>Account Visibility</span>
              <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                formData.privacySettings?.privateProfile 
                  ? 'bg-aeirmist-magenta/10 border-aeirmist-magenta/30 text-aeirmist-magenta' 
                  : 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan'
              }`}>
                {formData.privacySettings?.privateProfile ? 'Private' : 'Public'}
              </span>
            </div>

            {/* PROFILE COMPLETION */}
            <div className={`mt-5 rounded-2xl p-3.5 border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-white/10'}`}>
              <div className="flex justify-between items-center text-[10px] font-mono mb-1.5">
                <span className={`font-bold ${isLight ? 'text-slate-700' : 'text-white/80'}`}>PROFILE COMPLETION</span>
                <span className="text-aeirmist-cyan font-bold">{completionPercentage}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta rounded-full transition-all duration-500" 
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* CONTROL BUTTONS */}
            <div className="grid grid-cols-1 gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => scrollToSection('profile-information')}
                className={`w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
                }`}
              >
                Edit Profile Info
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-aeirmist-cyan/10 hover:bg-aeirmist-cyan/20 border border-aeirmist-cyan/35 text-aeirmist-cyan transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Eye size={12} />
                Preview Profile
              </button>
              <button
                type="button"
                disabled={isSyncingDb}
                onClick={async () => {
                  setIsSyncingDb(true);
                  try {
                    await syncDatabaseProfile?.();
                  } finally {
                    setIsSyncingDb(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <RefreshCw size={12} className={isSyncingDb ? "animate-spin text-aeirmist-cyan" : ""} />
                {isSyncingDb ? 'Syncing Database...' : 'Sync & Fix Database IDs'}
              </button>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: EDITABLE SECTIONS */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* SECTION 2: PROFILE INFORMATION */}
          <div id="profile-information" className={`rounded-3xl p-6 md:p-8 shadow-xl space-y-6 relative transition-all border ${
            isLight 
              ? 'bg-white border-slate-200 text-slate-900 shadow-sm' 
              : 'bg-[#0f172a]/95 backdrop-blur-2xl border-white/15 text-white shadow-2xl'
          }`}>
            <div className="space-y-1 border-b pb-4 border-slate-200 dark:border-white/10">
              <h2 className={`text-xl font-display font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <User size={18} className="text-aeirmist-cyan" />
                Personal Information
              </h2>
              <p className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-white/70'}`}>Update your name, bio, tagline, and profile details</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Display Name Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>Full Name / Display Name</label>
                  <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-white/60'}`}>{(formData.displayName || '').length}/50</span>
                </div>
                <div className="relative">
                  <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-white/60'}`} size={15} />
                  <input 
                    type="text"
                    maxLength={50}
                    value={formData.displayName}
                    onChange={(e) => handleFieldChange('displayName', e.target.value)}
                    placeholder="e.g. John Doe"
                    className={`w-full h-12 pl-11 pr-4 rounded-xl text-xs font-medium focus:border-aeirmist-cyan focus:outline-none transition-all ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-aeirmist-cyan/20'
                        : 'bg-slate-800/90 border border-slate-600 text-white placeholder:text-slate-400 focus:bg-slate-800'
                    }`}
                  />
                </div>
                <p className={`text-[10px] ml-1 ${isLight ? 'text-slate-600' : 'text-white/70'}`}>Your full name shown on your public profile.</p>
              </div>

              {/* Relationship Status Selector */}
              <div className="space-y-2 relative">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>Status</label>
                    
                    {/* Visibility Toggle Chip */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsVisibilityDropdownOpen(!isVisibilityDropdownOpen)}
                        className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                          isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            : 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/10'
                        }`}
                      >
                        {formData.relationshipStatusVisibility === 'friends' ? <Users size={10} /> :
                         formData.relationshipStatusVisibility === 'only_me' ? <Lock size={10} /> : <Globe size={10} />}
                        <span>
                          {formData.relationshipStatusVisibility === 'friends' ? 'Friends Only' :
                           formData.relationshipStatusVisibility === 'only_me' ? 'Only Me' : 'Public'}
                        </span>
                        <ChevronDown size={10} />
                      </button>

                      {/* Visibility Dropdown Menu */}
                      {isVisibilityDropdownOpen && (
                        <div className={`absolute left-0 mt-1.5 w-36 rounded-xl shadow-2xl z-50 overflow-hidden border py-1 ${
                          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/15 text-white'
                        }`}>
                          {VISIBILITY_OPTIONS.map(vOpt => {
                            const VIcon = vOpt.icon;
                            const isSelected = (formData.relationshipStatusVisibility || 'public') === vOpt.id;
                            return (
                              <button
                                key={vOpt.id}
                                type="button"
                                onClick={() => {
                                  handleFieldChange('relationshipStatusVisibility', vOpt.id);
                                  setIsVisibilityDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                                  isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <VIcon size={12} className={isSelected ? 'text-aeirmist-cyan' : 'opacity-60'} />
                                  <span>{vOpt.label}</span>
                                </div>
                                {isSelected && <Check size={12} className="text-aeirmist-cyan" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Selector Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsRelationshipDropdownOpen(!isRelationshipDropdownOpen)}
                    className={`w-full h-12 pl-11 pr-4 rounded-xl text-xs font-medium flex items-center justify-between text-left transition-all ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-aeirmist-cyan/20'
                        : 'bg-slate-800/90 border border-slate-600 text-white hover:border-slate-500'
                    }`}
                  >
                    <Heart className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-white/60'}`} size={15} />
                    <span className={!formData.relationshipStatus || formData.relationshipStatus === 'Status' ? (isLight ? 'text-slate-400' : 'text-slate-400') : ''}>
                      {formData.relationshipStatus || 'Status'}
                    </span>
                    <ChevronDown size={14} className={isLight ? 'text-slate-500' : 'text-white/60'} />
                  </button>

                  {/* Relationship Options Dropdown Panel */}
                  {isRelationshipDropdownOpen && (
                    <div className={`absolute left-0 right-0 mt-1.5 rounded-xl shadow-2xl z-50 overflow-hidden border max-h-64 overflow-y-auto ${
                      isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/15 text-white'
                    }`}>
                      {RELATIONSHIP_OPTIONS.map(opt => {
                        const currentVal = formData.relationshipStatus || 'Status';
                        const isSelected = currentVal === opt || (opt === 'Status' && !formData.relationshipStatus);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              handleFieldChange('relationshipStatus', opt === 'Status' ? null : opt);
                              setIsRelationshipDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 text-xs text-left transition-colors ${
                              isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                            }`}
                          >
                            <span className={opt === 'Status' ? 'opacity-50 italic' : ''}>{opt}</span>
                            {isSelected && <Check size={14} className="text-aeirmist-cyan" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className={`text-[10px] ml-1 ${isLight ? 'text-slate-600' : 'text-white/70'}`}>Display your relationship status on your profile card.</p>
              </div>
            </div>

            {/* Bio Textarea */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>Bio / About You</label>
                <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-white/60'}`}>{(formData.bio || '').length}/300 characters</span>
              </div>
              <textarea 
                value={formData.bio}
                maxLength={300}
                rows={4}
                onChange={(e) => handleFieldChange('bio', e.target.value)}
                placeholder="Tell others a little bit about yourself, your work, or interests..."
                className={`w-full p-4 rounded-xl text-xs font-medium focus:border-aeirmist-cyan focus:outline-none transition-all resize-none ${
                  isLight
                    ? 'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-aeirmist-cyan/20'
                    : 'bg-slate-800/90 border border-slate-600 text-white placeholder:text-slate-400 focus:bg-slate-800'
                }`}
              />
              <p className={`text-[10px] ml-1 ${isLight ? 'text-slate-600' : 'text-white/70'}`}>Write a short intro about yourself.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Website Input */}
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>Website</label>
                <div className="relative">
                  <Globe className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-white/60'}`} size={15} />
                  <input 
                    type="url"
                    value={formData.website || ''}
                    onChange={(e) => handleFieldChange('website', e.target.value)}
                    placeholder="https://yoursite.com"
                    className={`w-full h-12 pl-11 pr-4 rounded-xl text-xs font-medium focus:border-aeirmist-cyan focus:outline-none transition-all ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-aeirmist-cyan/20'
                        : 'bg-slate-800/90 border border-slate-600 text-white placeholder:text-slate-400 focus:bg-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Location Autocomplete Input */}
              <div className="space-y-2 relative">
                <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>Location</label>
                <div className="relative">
                  <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-white/60'}`} size={15} />
                  <input 
                    type="text"
                    value={locationSearchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocationSearchInput(val);
                      setIsLocationDropdownOpen(true);
                      setIsLocationLoading(true);
                      setTimeout(() => setIsLocationLoading(false), 250);
                      if (!val.trim()) {
                        handleFieldChange('location', '');
                        handleFieldChange('locationData', null);
                      }
                    }}
                    onFocus={() => setIsLocationDropdownOpen(true)}
                    placeholder="Search city, country..."
                    className={`w-full h-12 pl-11 pr-10 rounded-xl text-xs font-medium focus:border-aeirmist-cyan focus:outline-none transition-all ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-aeirmist-cyan/20'
                        : 'bg-slate-800/90 border border-slate-600 text-white placeholder:text-slate-400 focus:bg-slate-800'
                    }`}
                  />
                  {/* Loading spinner or clear button */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {isLocationLoading ? (
                      <div className="w-4 h-4 border-2 border-aeirmist-cyan border-t-transparent rounded-full animate-spin" />
                    ) : locationSearchInput ? (
                      <button
                        type="button"
                        onClick={() => {
                          setLocationSearchInput('');
                          handleFieldChange('location', '');
                          handleFieldChange('locationData', null);
                        }}
                        className={`p-1 rounded-full hover:bg-white/10 ${isLight ? 'text-slate-500' : 'text-white/60'}`}
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Location Dropdown Results */}
                {isLocationDropdownOpen && (
                  <div className={`absolute left-0 right-0 mt-1.5 rounded-xl shadow-2xl z-50 overflow-hidden border max-h-60 overflow-y-auto ${
                    isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/15 text-white'
                  }`}>
                    {(() => {
                      const q = (locationSearchInput || '').toLowerCase().trim();
                      const matches = WORLD_CITIES.filter(c => 
                        !q || c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)
                      ).slice(0, 6);

                      if (matches.length === 0) {
                        return (
                          <div className={`px-4 py-3 text-xs italic ${isLight ? 'text-slate-500' : 'text-white/50'}`}>
                            No matching location found
                          </div>
                        );
                      }

                      return matches.map(match => {
                        const displayName = `${match.city}, ${match.country}`;
                        return (
                          <button
                            key={displayName}
                            type="button"
                            onClick={() => {
                              setLocationSearchInput(displayName);
                              handleFieldChange('location', displayName);
                              handleFieldChange('locationData', {
                                city: match.city,
                                country: match.country,
                                countryCode: match.countryCode,
                                displayName
                              });
                              setIsLocationDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors ${
                              isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                            }`}
                          >
                            <MapPin size={13} className="text-aeirmist-cyan shrink-0" />
                            <span>
                              {q ? (
                                <>
                                  {match.city.toLowerCase().includes(q) ? (
                                    <span className="font-bold text-aeirmist-cyan">{match.city}</span>
                                  ) : match.city}, {match.country.toLowerCase().includes(q) ? (
                                    <span className="font-bold text-aeirmist-cyan">{match.country}</span>
                                  ) : match.country}
                                </>
                              ) : displayName}
                            </span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
                <p className={`text-[10px] ml-1 ${isLight ? 'text-slate-600' : 'text-white/70'}`}>Select a verified worldwide city & country.</p>
              </div>

              {/* Category Dropdown */}
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>Category</label>
                <div className="relative">
                  <Tag className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-white/60'}`} size={15} />
                  <select
                    value={formData.category || ''}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    className={`w-full h-12 pl-11 pr-4 rounded-xl text-xs font-medium focus:border-aeirmist-cyan focus:outline-none transition-all appearance-none cursor-pointer ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900'
                        : 'bg-slate-800/90 border border-slate-600 text-white'
                    }`}
                  >
                    <option value="" className={isLight ? 'bg-white' : 'bg-slate-900'}>Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className={isLight ? 'bg-white' : 'bg-slate-900'}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Pronouns Chips Picker */}
              <div className="space-y-2 relative">
                <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>Pronouns</label>
                <div className={`w-full min-h-[48px] p-2 rounded-xl text-xs font-medium flex flex-wrap items-center gap-1.5 relative transition-all ${
                  isLight
                    ? 'bg-white border border-slate-300 text-slate-900 focus-within:ring-2 focus-within:ring-aeirmist-cyan/20'
                    : 'bg-slate-800/90 border border-slate-600 text-white'
                }`}>
                  <Info className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-white/60'}`} size={15} />
                  
                  {/* Selected pronoun chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pl-7">
                    {(Array.isArray(formData.pronouns) ? formData.pronouns : []).map((p: string, idx: number) => (
                      <span key={p || idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan">
                        <span>{p}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (formData.pronouns || []).filter((_: any, i: number) => i !== idx);
                            handleFieldChange('pronouns', updated);
                          }}
                          className="hover:text-white transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}

                    {/* Input search box (hidden if 2 selected) */}
                    {(!formData.pronouns || formData.pronouns.length < 2) && (
                      <input 
                        type="text"
                        value={pronounsQuery}
                        onChange={(e) => {
                          setPronounsQuery(e.target.value);
                          setIsPronounsDropdownOpen(true);
                        }}
                        onFocus={() => setIsPronounsDropdownOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !pronounsQuery && formData.pronouns?.length > 0) {
                            const updated = formData.pronouns.slice(0, -1);
                            handleFieldChange('pronouns', updated);
                          }
                        }}
                        placeholder={!formData.pronouns || formData.pronouns.length === 0 ? "Add pronouns (e.g. they/them)..." : "Add another..."}
                        className={`bg-transparent border-none outline-none text-xs py-1 px-1 min-w-[120px] ${
                          isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-400'
                        }`}
                      />
                    )}
                  </div>
                </div>

                {/* Pronouns Suggestions Dropdown */}
                {isPronounsDropdownOpen && (
                  <div className={`absolute left-0 right-0 mt-1.5 rounded-xl shadow-2xl z-50 overflow-hidden border max-h-52 overflow-y-auto ${
                    isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/15 text-white'
                  }`}>
                    {(() => {
                      const q = (pronounsQuery || '').toLowerCase().trim();
                      const currentSelected = formData.pronouns || [];
                      const filtered = PRONOUN_SUGGESTIONS.filter(item => 
                        !currentSelected.includes(item) && (!q || item.toLowerCase().includes(q))
                      );

                      if (filtered.length === 0) {
                        return (
                          <div className={`px-4 py-3 text-xs italic ${isLight ? 'text-slate-500' : 'text-white/50'}`}>
                            No matching pronouns found
                          </div>
                        );
                      }

                      return filtered.map(item => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            if (currentSelected.length < 2) {
                              const updated = [...currentSelected, item];
                              handleFieldChange('pronouns', updated);
                              setPronounsQuery('');
                              setIsPronounsDropdownOpen(false);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-xs text-left transition-colors ${
                            isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                          }`}
                        >
                          <span className="font-medium">{item}</span>
                          <span className="text-[10px] opacity-40 uppercase tracking-wider">Select</span>
                        </button>
                      ));
                    })()}
                  </div>
                )}
                <p className={`text-[10px] ml-1 ${isLight ? 'text-slate-600' : 'text-white/70'}`}>Choose up to 2 pronoun sets.</p>
              </div>

              {/* Birthday */}
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>Birthday</label>
                <div className="relative">
                  <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-white/60'}`} size={15} />
                  <input 
                    type="date"
                    value={formData.dateOfBirth || ''}
                    onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                    className={`w-full h-12 pl-11 pr-4 rounded-xl text-xs font-medium focus:border-aeirmist-cyan focus:outline-none transition-all ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900'
                        : 'bg-slate-800/90 border border-slate-600 text-white [color-scheme:dark]'
                    }`}
                  />
                </div>
              </div>

              {/* Gender Select */}
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider ml-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>Gender</label>
                <div className="relative">
                  <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-white/60'}`} size={15} />
                  <select
                    value={formData.gender || ''}
                    onChange={(e) => handleFieldChange('gender', e.target.value)}
                    className={`w-full h-12 pl-11 pr-4 rounded-xl text-xs font-medium focus:border-aeirmist-cyan focus:outline-none transition-all appearance-none cursor-pointer ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900'
                        : 'bg-slate-800/90 border border-slate-600 text-white'
                    }`}
                  >
                    <option value="" className={isLight ? 'bg-white' : 'bg-slate-900'}>Not Specified</option>
                    <option value="male" className={isLight ? 'bg-white' : 'bg-slate-900'}>Male</option>
                    <option value="female" className={isLight ? 'bg-white' : 'bg-slate-900'}>Female</option>
                    <option value="nonbinary" className={isLight ? 'bg-white' : 'bg-slate-900'}>Non-Binary</option>
                    <option value="prefer_not_to_say" className={isLight ? 'bg-white' : 'bg-slate-900'}>Prefer Not to Say</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: CONTACT INFO */}
          <div id="contact-information" className="rounded-3xl bg-white/[0.02] border border-white/5 p-6 md:p-8 backdrop-blur-xl shadow-xl space-y-6">
            <div className="space-y-1 border-b border-white/5 pb-4">
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <Mail size={18} className="text-aeirmist-cyan" />
                Contact Info
              </h2>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Secure connection endpoints and notification paths</p>
            </div>

            {/* Email Field with Verified status and action */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 ml-1">Primary Registered Email</label>
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan shrink-0">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-xs font-mono font-bold text-white/85 break-words truncate hover:whitespace-normal transition-all">{auth.currentUser?.email || user?.email || 'unregistered@email.com'}</p>
                    {formData.pendingEmailChange && (
                      <p className="text-[10px] font-mono text-amber-400 mt-0.5 break-words">Pending change to: {formData.pendingEmailChange} (verify inbox)</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      {auth.currentUser?.emailVerified ? (
                        <>
                          <ShieldCheck className="text-aeirmist-cyan shrink-0" size={13} />
                          <span className="text-[9px] font-mono font-bold text-aeirmist-cyan uppercase tracking-wider">Verified Email</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={13} className="text-aeirmist-magenta" />
                          <span className="text-[9px] font-mono font-bold text-aeirmist-magenta uppercase tracking-wider">Pending Verification</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  {!auth.currentUser?.emailVerified && (
                    <button
                      type="button"
                      onClick={handleSendEmailVerification}
                      disabled={isSendingEmailVerification}
                      className="px-3.5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan hover:bg-aeirmist-cyan/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isSendingEmailVerification ? <RefreshCw className="animate-spin" size={10} /> : null}
                      Verify Primary Email
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setNewEmail(auth.currentUser?.email || '');
                      setEmailModalError('');
                      setRequiresPasswordReauth(false);
                      setShowEmailModal(true);
                    }}
                    className="px-3.5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all cursor-pointer text-center"
                  >
                    Change Primary Email
                  </button>
                </div>
              </div>
            </div>

            {/* Phone Verification Section */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 ml-1">Verified Mobile (Phone)</label>
              
              {phoneError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{phoneError}</span>
                </div>
              )}

              {phoneOtpStep === 'idle' ? (
                <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                  <select 
                    value={formData.phoneCountryCode || '+1'}
                    onChange={(e) => {
                      handleFieldChange('phoneCountryCode', e.target.value);
                      handleFieldChange('phoneVerified', false);
                    }}
                    className="w-full sm:w-28 h-12 bg-[#0b0e14]/50 border border-white/10 rounded-xl text-xs text-white/80 px-3 focus:outline-none focus:border-aeirmist-cyan transition-all cursor-pointer"
                  >
                    <option value="+1">+1 US/CA</option>
                    <option value="+44">+44 UK</option>
                    <option value="+880">+880 BD</option>
                    <option value="+91">+91 IN</option>
                    <option value="+81">+81 JP</option>
                    <option value="+61">+61 AU</option>
                    <option value="+49">+49 DE</option>
                  </select>

                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                    <input 
                      type="tel"
                      value={formData.phoneNumber || ''}
                      onChange={(e) => {
                        handleFieldChange('phoneNumber', e.target.value);
                        handleFieldChange('phoneVerified', false);
                      }}
                      placeholder="Enter mobile digits..."
                      className="w-full h-12 pl-11 pr-4 bg-white/[0.03] border border-white/10 rounded-xl text-xs focus:border-aeirmist-cyan/50 focus:bg-white/[0.05] focus:outline-none transition-all text-white/80"
                    />
                  </div>

                  <div className="sm:w-44 shrink-0 flex items-center">
                    {formData.phoneVerified ? (
                      <div className="w-full h-12 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan flex items-center justify-center">
                        <ShieldCheck size={20} className="text-aeirmist-cyan shrink-0" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleVerifyPhoneClick}
                        disabled={!formData.phoneNumber || isPhoneVerifying}
                        className={`w-full h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          formData.phoneNumber && !isPhoneVerifying
                            ? 'bg-aeirmist-cyan/10 hover:bg-aeirmist-cyan/20 border-aeirmist-cyan/30 text-aeirmist-cyan'
                            : 'bg-white/5 border-white/5 text-white/25 pointer-events-none'
                        }`}
                      >
                        {isPhoneVerifying ? <RefreshCw className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
                        {isPhoneVerifying ? 'Sending...' : 'Verify Mobile'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-aeirmist-cyan/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Enter 6-Digit Verification Code</span>
                    <button 
                      type="button"
                      onClick={() => setPhoneOtpStep('idle')}
                      className="text-xs text-white/50 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <input 
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full sm:w-48 h-12 px-4 bg-[#0b0e14]/85 border border-white/15 focus:border-aeirmist-cyan rounded-xl text-sm tracking-widest font-mono text-white text-center focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmOtpCode}
                      disabled={otpCode.length < 6 || isPhoneConfirming}
                      className="flex-1 h-12 rounded-xl bg-aeirmist-cyan text-black text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isPhoneConfirming ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                      {isPhoneConfirming ? 'Verifying Code...' : 'Confirm & Link'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden Recaptcha Container for Phone Auth */}
            <div id="recaptcha-container"></div>

            {/* Recovery Fields - Better Organized */}
            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <Lock size={14} className="text-white/30" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Recovery Channels</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Recovery Email */}
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-white/40 ml-1">Recovery Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                    <input 
                      type="email"
                      value={formData.recoveryEmail || ''}
                      onChange={(e) => handleFieldChange('recoveryEmail', e.target.value)}
                      placeholder="backup@email.com"
                      className="w-full h-12 pl-11 pr-4 bg-white/[0.03] border border-white/10 rounded-xl text-xs focus:border-aeirmist-cyan/50 focus:bg-white/[0.05] focus:outline-none transition-all text-white/80"
                    />
                  </div>
                  <p className="text-[8px] text-white/25 ml-1">Used to recover account access if primary email is lost.</p>
                </div>

                {/* Recovery Phone */}
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-white/40 ml-1">Recovery Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                    <input 
                      type="tel"
                      value={formData.recoveryPhone || ''}
                      onChange={(e) => handleFieldChange('recoveryPhone', e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full h-12 pl-11 pr-4 bg-white/[0.03] border border-white/10 rounded-xl text-xs focus:border-aeirmist-cyan/50 focus:bg-white/[0.05] focus:outline-none transition-all text-white/80"
                    />
                  </div>
                  <p className="text-[8px] text-white/25 ml-1">SMS route for emergency MFA and password resets.</p>
                </div>
              </div>
            </div>

          </div>

          {/* SECTION 4: ACCOUNT STATUS */}
          <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-6 md:p-8 backdrop-blur-xl shadow-xl space-y-6">
            <div className="space-y-1 border-b border-white/5 pb-4">
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-aeirmist-cyan" />
                Account Status
              </h2>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Standard metadata and profile diagnostic details</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Field 1: Visibility */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col justify-between min-h-[76px]">
                <span className="text-[9px] uppercase tracking-wider text-white/45 block whitespace-nowrap truncate">Account Visibility</span>
                <span className="text-xs font-bold text-white font-mono whitespace-nowrap truncate">
                  {formData.privacySettings?.privateProfile ? 'Private' : 'Public'}
                </span>
              </div>

              {/* Field 2: Verified */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col justify-between min-h-[76px]">
                <span className="text-[9px] uppercase tracking-wider text-white/45 block whitespace-nowrap truncate">Verified Member</span>
                <div className="flex items-center gap-1.5 h-4">
                  {profile?.isVerified ? (
                    <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />
                  ) : (
                    <span className="text-xs font-bold text-white font-mono whitespace-nowrap">No</span>
                  )}
                </div>
              </div>

              {/* Field 3: Member Since */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col justify-between min-h-[76px]">
                <span className="text-[9px] uppercase tracking-wider text-white/45 block whitespace-nowrap truncate">Joined Network</span>
                <span className="text-xs font-bold text-white font-mono whitespace-nowrap truncate">
                  {user?.metadata?.creationTime 
                    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : 'Jul 10, 2026'}
                </span>
              </div>

              {/* Field 4: Completion */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col justify-between min-h-[76px]">
                <span className="text-[9px] uppercase tracking-wider text-white/45 block whitespace-nowrap truncate">Dossier Integrity</span>
                <span className="text-xs font-bold text-aeirmist-cyan font-mono whitespace-nowrap truncate">
                  {completionPercentage}% Complete
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 5: USERNAME */}
          <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-6 md:p-8 backdrop-blur-xl shadow-xl space-y-6">
            <div className="space-y-1 border-b border-white/5 pb-4">
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <Award size={18} className="text-aeirmist-cyan" />
                Username Settings
              </h2>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Manage your exclusive unique social address</p>
            </div>

            <div className="space-y-6">
              {/* ZONE 1 — Current Username (read-only display) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.01] border border-white/5 space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 block">
                    Your Username
                  </span>
                  <div className="text-base sm:text-lg font-mono font-bold flex items-center tracking-wide">
                    <span className="text-aeirmist-cyan">@</span>
                    <span className="text-white">{formData.username || profile?.username || 'unregistered'}</span>
                  </div>
                </div>

                {!isChangingUsername && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingUsername(true);
                      setUsernameInput('');
                      setUsernameStatus('idle');
                      setUsernameError('');
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer w-fit group"
                  >
                    <Edit2 size={14} className="text-aeirmist-cyan group-hover:scale-110 transition-transform" />
                    <span>Change Username</span>
                  </button>
                )}
              </div>

              {/* ZONE 2 — Change Username (form & status) */}
              <AnimatePresence>
                {isChangingUsername && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden pt-2 border-t border-white/5 space-y-3"
                  >
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35 block">
                        New Username
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingUsername(false);
                          setUsernameInput('');
                          setUsernameStatus('idle');
                          setUsernameError('');
                        }}
                        className="text-xs font-mono text-white/40 hover:text-white transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Input Field with @ Prefix */}
                    <div className="relative w-full">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-aeirmist-cyan font-mono font-bold text-sm select-none">
                        @
                      </span>
                      <input 
                        autoFocus
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value.toLowerCase().trim())}
                        placeholder="Enter a new username"
                        className="w-full h-12 pl-9 pr-4 bg-white/[0.03] border border-white/10 rounded-xl text-xs font-mono text-white placeholder:text-white/20 focus:border-aeirmist-cyan/50 focus:bg-white/[0.05] focus:outline-none transition-all"
                      />
                    </div>

                    {/* Attached Real-Time Status Line */}
                    <div className="min-h-[22px] px-1 space-y-2">
                      {checkingUsername && (
                        <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                          <RefreshCw size={12} className="animate-spin text-aeirmist-cyan" />
                          <span>Checking availability...</span>
                        </div>
                      )}

                      {!checkingUsername && usernameInput && usernameInput.toLowerCase() === (profile?.username || formData.username || '').toLowerCase() && (
                        <p className="text-xs font-mono text-white/40">This is already your username.</p>
                      )}

                      {!checkingUsername && usernameInput && usernameInput.toLowerCase() !== (profile?.username || formData.username || '').toLowerCase() && (
                        <>
                          {usernameStatus === 'available' && (
                            <div className="flex items-center gap-2 text-xs font-mono text-aeirmist-lime font-bold">
                              <Check size={14} className="shrink-0" />
                              <span>@{usernameInput} is available</span>
                            </div>
                          )}

                          {usernameStatus === 'taken' && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs font-mono text-aeirmist-magenta font-bold">
                                <X size={14} className="shrink-0" />
                                <span>@{usernameInput} is already taken</span>
                              </div>

                              {usernameSuggestions.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                  <span className="text-[10px] text-white/40 font-mono">Suggestions:</span>
                                  {usernameSuggestions.slice(0, 3).map((sug) => (
                                    <button
                                      key={sug}
                                      type="button"
                                      onClick={() => applyUsernameSuggestion(sug)}
                                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-white/80 hover:text-white transition-colors cursor-pointer"
                                    >
                                      @{sug}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {usernameStatus === 'invalid' && (
                            <div className="flex items-center gap-2 text-xs font-mono text-aeirmist-magenta font-bold">
                              <AlertCircle size={14} className="shrink-0" />
                              <span>{usernameError || 'Usernames can only contain letters, numbers, periods, and underscores'}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Full-width Claim Button */}
                    <button
                      type="button"
                      onClick={commitUsernameChange}
                      disabled={usernameStatus !== 'available' || checkingUsername || !usernameInput || usernameInput.toLowerCase() === (profile?.username || formData.username || '').toLowerCase()}
                      className={`w-full h-12 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 mt-1 ${
                        usernameStatus === 'available' && !checkingUsername && usernameInput && usernameInput.toLowerCase() !== (profile?.username || formData.username || '').toLowerCase()
                          ? 'bg-aeirmist-cyan text-black hover:brightness-110 active:scale-[0.99] shadow-[0_0_15px_rgba(0,242,255,0.3)]'
                          : 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed pointer-events-none'
                      }`}
                    >
                      Claim Username
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ZONE 3 — Username Rules (Collapsed Disclosure Row) */}
              <div className="pt-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.01] overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => setIsUsernameRulesExpanded(!isUsernameRulesExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Info size={14} className="text-white/40 group-hover:text-white/70 transition-colors" />
                      <span className="text-[11px] font-medium text-white/50 group-hover:text-white/80 transition-colors">
                        Username Rules
                      </span>
                    </div>
                    <ChevronDown 
                      size={14} 
                      className={`text-white/30 group-hover:text-white/60 transition-transform duration-200 ${isUsernameRulesExpanded ? 'rotate-180' : ''}`} 
                    />
                  </button>

                  <AnimatePresence>
                    {isUsernameRulesExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden border-t border-white/5 bg-black/20"
                      >
                        <div className="p-4 space-y-2 text-[11px] text-white/50 leading-relaxed font-normal">
                          <ul className="list-disc pl-4 space-y-1">
                            <li>3–30 characters in length</li>
                            <li>Only lowercase letters, numbers, underscores (<code className="font-mono text-white/70">_</code>), and periods (<code className="font-mono text-white/70">.</code>)</li>
                            <li>Cannot start or end with a period or contain double symbols</li>
                            <li>Must be unique across the entire Aeirmist network</li>
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: ACCOUNT ACTIONS (Danger Zone - Collapsible) */}
          <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.02] overflow-hidden backdrop-blur-xl shadow-md transition-all">
            <button
              type="button"
              onClick={() => setIsDangerZoneExpanded(!isDangerZoneExpanded)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <AlertTriangle size={16} className="text-amber-400/80 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs font-medium text-white/90 group-hover:text-white transition-colors">
                    Danger Zone & Data Actions
                  </h3>
                  <p className="text-[10px] text-white/40 font-normal truncate">
                    Sensitive actions regarding data extraction and profile integrity
                  </p>
                </div>
              </div>
              <ChevronDown 
                size={16} 
                className={`text-white/40 group-hover:text-white transition-transform duration-200 shrink-0 ml-2 ${isDangerZoneExpanded ? 'rotate-180' : ''}`} 
              />
            </button>

            <AnimatePresence>
              {isDangerZoneExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden border-t border-white/5 bg-black/20"
                >
                  <div className="p-3 space-y-2">
                    {/* Action 1: Download My Social Data */}
                    <button
                      type="button"
                      onClick={() => setShowDownloadConfirm(true)}
                      className="w-full p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 flex items-center justify-between transition-all text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Download size={14} className="text-aeirmist-cyan shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white/90 group-hover:text-white">Download My Social Data</p>
                          <p className="text-[10px] text-white/40 font-normal truncate">JSON export archive of profile details, connections & metadata</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-white/30 group-hover:text-white/70 transition-colors shrink-0 ml-2" />
                    </button>

                    {/* Action 2: Export Social Profile */}
                    <button
                      type="button"
                      onClick={() => {
                        const profileData = JSON.stringify(formData, null, 2);
                        navigator.clipboard.writeText(profileData);
                        addToast?.({
                          title: 'COPIED TO CLIPBOARD',
                          message: 'Profile configuration JSON has been exported to your clipboard.',
                          type: 'success'
                        });
                      }}
                      className="w-full p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 flex items-center justify-between transition-all text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={14} className="text-white/70 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white/90 group-hover:text-white">Export Social Profile</p>
                          <p className="text-[10px] text-white/40 font-normal truncate">Copy portable configuration & settings JSON to clipboard</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-white/30 group-hover:text-white/70 transition-colors shrink-0 ml-2" />
                    </button>

                    {/* Action 3: Deactivate Account */}
                    <button
                      type="button"
                      onClick={() => openMetaAccountModal('deactivate')}
                      className="w-full p-3 rounded-xl bg-white/[0.02] hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/20 flex items-center justify-between transition-all text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PauseCircle size={14} className="text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-white/90 group-hover:text-white">Deactivate Account</p>
                            {isDeactivationInCooldown && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-mono font-medium">
                                Cooldown active
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-white/40 font-normal truncate">
                            {isDeactivationInCooldown 
                              ? `Deactivation paused until ${cooldownDateString}` 
                              : 'Temporarily hide your profile & activity'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-white/30 group-hover:text-amber-400 transition-colors shrink-0 ml-2" />
                    </button>

                    {/* Action 4: Delete Account */}
                    <button
                      type="button"
                      onClick={() => openMetaAccountModal('delete')}
                      className="w-full p-3 rounded-xl bg-white/[0.02] hover:bg-red-500/10 border border-red-500/15 flex items-center justify-between transition-all text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Trash2 size={14} className="text-red-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-red-400 group-hover:text-red-300">Delete Account</p>
                          <p className="text-[10px] text-red-400/50 font-normal truncate">Permanently erase account after 69 days grace period</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-red-400/40 group-hover:text-red-400 transition-colors shrink-0 ml-2" />
                    </button>

                    {/* Telegram-style "If away for..." */}
                    <div className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-medium text-white/90">If away for...</p>
                        <p className="text-[10px] text-white/40">Self-destruct account if inactive</p>
                      </div>
                      <select
                        value={formData?.deleteAccountIfAwayFor || profile?.deleteAccountIfAwayFor || '24 months'}
                        onChange={(e) => {
                          handleFieldChange('deleteAccountIfAwayFor', e.target.value);
                          if (addToast) {
                            addToast({
                              title: 'Self-Destruct Setting Selected',
                              message: `Auto-deletion timer set to ${e.target.value}. Save changes to finalize.`,
                              type: 'info'
                            });
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono font-bold text-aeirmist-cyan focus:border-aeirmist-cyan outline-none cursor-pointer shrink-0"
                      >
                        <option value="1 month">1 month</option>
                        <option value="3 months">3 months</option>
                        <option value="6 months">6 months</option>
                        <option value="12 months">12 months</option>
                        <option value="24 months">24 months</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>

      {/* POPUP MODAL 1: PREVIEW PROFILE SCREEN */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPreview(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#0d1117] border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col"
            >
              
              {/* Banner Area */}
              <div className="h-28 relative overflow-hidden bg-white/5 flex-shrink-0">
                {(localCoverURL || formData.bannerURL) && (
                  <img src={localCoverURL || formData.bannerURL} className="w-full h-full object-cover" alt="Banner" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Avatar Overlap */}
              <div className="px-6 pb-6 relative flex flex-col items-center text-center -mt-10">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#0d1117] bg-[#0d1117] shadow-lg mb-3">
                  <img src={localAvatarURL || getAvatarUrl(formData.photoURL)} className="w-full h-full object-cover" alt="Avatar" />
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center justify-center gap-1.5">
                    <h4 className="text-base font-bold text-white">{formData.displayName || 'Unnamed User'}</h4>
                    {profile?.isVerified && (
                      <ShieldCheck className="text-aeirmist-cyan shrink-0" size={15} />
                    )}
                  </div>
                  <p className="text-xs text-aeirmist-cyan font-mono font-bold">@{formData.username || 'username'}</p>
                </div>

                {formData.category && (
                  <span className="mt-2.5 inline-block text-[8px] font-bold font-mono uppercase tracking-widest px-2.5 py-1 bg-aeirmist-cyan/10 border border-aeirmist-cyan/35 text-aeirmist-cyan rounded-full">
                    {formData.category}
                  </span>
                )}

                {formData.relationshipStatus && formData.relationshipStatus !== 'Status' && (
                  <p className="text-[10px] text-aeirmist-cyan font-medium mt-3 bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5">
                    <Heart size={12} className="text-aeirmist-cyan" />
                    <span>{formData.relationshipStatus}</span>
                  </p>
                )}

                <p className="text-xs text-white/70 leading-relaxed mt-4 max-w-sm">
                  {formData.bio || 'This member hasn\'t configured a bio signal yet.'}
                </p>

                {/* Meta details */}
                <div className="mt-4 pt-4 border-t border-white/5 w-full grid grid-cols-2 gap-3 text-left">
                  {formData.location && (
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <MapPin size={12} className="text-aeirmist-cyan shrink-0" />
                      <span className="truncate">{formData.location}</span>
                    </div>
                  )}
                  {formData.website && (
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <Globe size={12} className="text-aeirmist-cyan shrink-0" />
                      <span className="truncate">{formData.website}</span>
                    </div>
                  )}
                  {(Array.isArray(formData.pronouns) ? formData.pronouns.length > 0 : formData.pronouns) && (
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <Info size={12} className="text-aeirmist-cyan shrink-0" />
                      <span className="truncate">{Array.isArray(formData.pronouns) ? formData.pronouns.join(' · ') : formData.pronouns}</span>
                    </div>
                  )}
                  {formData.gender && (
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <User size={12} className="text-aeirmist-cyan shrink-0" />
                      <span className="truncate capitalize">{formData.gender.replace('_', ' ')}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5 mt-6 w-full">
                  <button onClick={() => logger.info("Action coming soon")} className="flex-1 py-2 rounded-xl bg-aeirmist-cyan text-black font-bold text-xs uppercase tracking-wider shadow-[0_0_10px_rgba(0,242,255,0.2)]">
                    Follow
                  </button>
                  <button onClick={() => logger.info("Action coming soon")} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-wider">
                    Message
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP MODAL 2: DOWNLOAD DATA CONFIRMATION */}
      <AnimatePresence>
        {showDownloadConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDownloadConfirm(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-xs"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#121620] border border-white/10 rounded-2xl p-6 shadow-2xl z-10 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-aeirmist-cyan/10 text-aeirmist-cyan flex items-center justify-center mx-auto">
                <Download size={22} />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Download Data Archive</h3>
                <p className="text-xs text-white/40">We will bundle and download all your profile parameters, links, and database attachments into a raw portable JSON data snapshot.</p>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDownloadConfirm(false)}
                  className="py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/5 text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadConfirm}
                  disabled={isProcessingDangerAction}
                  className="py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-aeirmist-cyan text-black hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(0,242,255,0.2)]"
                >
                  {isProcessingDangerAction ? <RefreshCw className="animate-spin" size={10} /> : null}
                  {isProcessingDangerAction ? 'Packing...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP MODAL 3: DEACTIVATE CONFIRMATION */}
      <AnimatePresence>
        {showDeactivateConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeactivateConfirm(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-xs"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#121620] border border-white/10 rounded-2xl p-6 shadow-2xl z-10 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle size={22} />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Deactivate Profile?</h3>
                <p className="text-xs text-white/40">This will temporarily hide your profile, connections, and posts across the entire platform. Log back in at any time to instantly restore your identity.</p>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeactivateConfirm(false)}
                  className="py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/5 text-white/60 hover:text-white"
                >
                  Keep Active
                </button>
                <button
                  type="button"
                  onClick={handleDeactivateConfirm}
                  disabled={isProcessingDangerAction}
                  className="py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-[#201013] hover:bg-[#34161b] border border-red-500/20 text-red-400 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isProcessingDangerAction ? <RefreshCw className="animate-spin" size={10} /> : null}
                  {isProcessingDangerAction ? 'Processing...' : 'Deactivate'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP MODAL 4: DELETE CONFIRMATION */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-xs"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#1a0e11] border border-red-500/15 rounded-2xl p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle size={22} className="animate-pulse" />
              </div>
              
              <div className="space-y-1 text-center">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">PERMANENT DELETE ACCOUNT</h3>
                <p className="text-xs text-red-400/60 leading-relaxed">This action starts an irreversible delete sequence. Your profile and everything you have uploaded will be wiped clean after 30 days hold.</p>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[8.5px] uppercase tracking-widest text-white/40 block">Type <code className="text-white bg-white/5 px-1 py-0.5 rounded font-mono font-bold">@{profile?.username || 'username'}</code> to confirm:</label>
                <input 
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={`@${profile?.username || 'username'}`}
                  className="w-full h-11 px-4 bg-[#120a0c] border border-red-500/20 focus:border-red-500 rounded-xl text-xs text-white placeholder:text-white/10 text-center font-mono focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/5 text-white/60 hover:text-white"
                >
                  Cancel Purge
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isProcessingDangerAction || deleteConfirmText !== (profile?.username || '')}
                  className={`py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
                    deleteConfirmText === (profile?.username || '')
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-white/5 text-white/10 pointer-events-none'
                  }`}
                >
                  {isProcessingDangerAction ? <RefreshCw className="animate-spin" size={10} /> : null}
                  {isProcessingDangerAction ? 'Purging...' : 'Initiate Purge'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP MODAL 5: CHANGE EMAIL */}
      <AnimatePresence>
        {showEmailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEmailModal(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-xs"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#121620] border border-white/10 rounded-2xl p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-aeirmist-cyan/10 text-aeirmist-cyan flex items-center justify-center mx-auto">
                <Mail size={22} />
              </div>
              
              <div className="space-y-1 text-center">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Change Primary Email</h3>
                <p className="text-xs text-white/50">
                  Enter your new address. A confirmation link will be sent to the new address; your login email does not change until you click that link.
                </p>
              </div>

              {emailModalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{emailModalError}</span>
                </div>
              )}

              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest text-white/40 block font-bold">New Email Address</label>
                  <input 
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full h-11 px-4 bg-[#0b0e14]/50 border border-white/10 focus:border-aeirmist-cyan rounded-xl text-xs text-white font-mono focus:outline-none transition-all"
                  />
                </div>

                {requiresPasswordReauth && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-widest text-white/40 block font-bold">Confirm Account Password</label>
                    <input 
                      type="password"
                      value={emailModalPassword}
                      onChange={(e) => setEmailModalPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-11 px-4 bg-[#0b0e14]/50 border border-white/10 focus:border-aeirmist-cyan rounded-xl text-xs text-white font-mono focus:outline-none transition-all"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/5 text-white/60 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleChangeEmailSubmit}
                  disabled={isEmailChanging}
                  className="py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-aeirmist-cyan text-black hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(0,242,255,0.2)] disabled:opacity-50"
                >
                  {isEmailChanging ? <RefreshCw className="animate-spin" size={12} /> : null}
                  {isEmailChanging ? 'Updating...' : 'Update Email'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* POPUP MODAL: META GUIDED ACCOUNT ACTION (DEACTIVATE / DELETE) */}
      <AnimatePresence>
        {showMetaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMetaModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-[#121620] border border-white/10 rounded-3xl p-6 shadow-2xl z-10 space-y-5 text-left text-white max-h-[90vh] overflow-y-auto"
            >
              {/* Header with Step Back affordance */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  {metaModalStep !== 'choice' && (
                    <button 
                      type="button" 
                      onClick={handleMetaModalStepBack}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                      title="Go Back"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    {metaModalStep.startsWith('deactivate') ? (
                      <>
                        <PauseCircle size={16} className="text-amber-400 shrink-0" />
                        Deactivate Account
                      </>
                    ) : metaModalStep.startsWith('delete') ? (
                      <>
                        <Trash2 size={16} className="text-red-400 shrink-0" />
                        Delete Account
                      </>
                    ) : (
                      <>
                        <ShieldAlert size={16} className="text-white/80 shrink-0" />
                        Account Management
                      </>
                    )}
                  </h3>
                </div>

                <button 
                  type="button" 
                  onClick={() => setShowMetaModal(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* STEP 1: CHOICE */}
              {metaModalStep === 'choice' && (
                <div className="space-y-4">
                  <p className="text-xs text-white/60 leading-relaxed">
                    Choose whether you want to temporarily take a break or permanently remove your account and content.
                  </p>

                  <div className="space-y-3 pt-1">
                    {/* Option 1: Deactivate */}
                    <button
                      type="button"
                      onClick={() => setMetaModalStep('deactivate_duration')}
                      className="w-full p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-amber-400/40 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                          <PauseCircle size={18} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-white group-hover:text-amber-300">Deactivate Account</p>
                          <p className="text-[11px] text-white/50 leading-relaxed font-normal">
                            Temporarily hide your profile. You can come back anytime (or automatically, if you set a return date).
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Option 2: Delete */}
                    <button
                      type="button"
                      onClick={() => setMetaModalStep('delete_interstitial')}
                      className="w-full p-4 rounded-2xl bg-white/[0.03] hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Trash2 size={18} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-red-400 group-hover:text-red-300">Delete Account</p>
                          <p className="text-[11px] text-white/50 leading-relaxed font-normal">
                            Permanently erase your account and data after a grace period.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2a - SUBSTEP 1: DEACTIVATE DURATION */}
              {metaModalStep === 'deactivate_duration' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">How long do you want to deactivate for?</h4>
                    <p className="text-[11px] text-white/50 mt-1">Select an automatic return timeframe or choose manual reactivate:</p>
                  </div>

                  <div className="space-y-2">
                    {[
                      { id: '1_day', label: '1 day' },
                      { id: '1_week', label: '1 week' },
                      { id: '1_month', label: '1 month' },
                      { id: '3_months', label: '3 months' },
                      { id: 'manual', label: 'Until I turn it back on manually' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDeactivateDuration(opt.id as any)}
                        className={`w-full p-3 rounded-xl border text-xs text-left transition-all flex items-center justify-between cursor-pointer ${
                          deactivateDuration === opt.id
                            ? 'bg-amber-400/10 border-amber-400/50 text-amber-300 font-bold'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] text-white/80 font-normal'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          deactivateDuration === opt.id ? 'border-amber-400 bg-amber-400' : 'border-white/20'
                        }`}>
                          {deactivateDuration === opt.id && <Check size={10} className="text-black font-bold" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Return date summary banner */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
                    <Clock size={16} className="text-amber-400 shrink-0" />
                    <p className="text-[11px] font-mono text-white/80 leading-relaxed">
                      {formatReturnDateText(deactivateDuration)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMetaModalStep('deactivate_reason')}
                    className="w-full py-3 rounded-xl bg-amber-400 text-black text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Continue to Reason
                  </button>
                </div>
              )}

              {/* STEP 2a - SUBSTEP 2: DEACTIVATE REASON */}
              {metaModalStep === 'deactivate_reason' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Why are you deactivating?</h4>
                    <p className="text-[11px] text-white/50 mt-1">Please select the reason that best describes your choice:</p>
                  </div>

                  <div className="space-y-2">
                    {[
                      'Taking a break',
                      'Privacy concerns',
                      'Too much time spent',
                      'Bad experience',
                      'Concerned about a specific person',
                      'Something else'
                    ].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setDeactivateReason(reason)}
                        className={`w-full p-3 rounded-xl border text-xs text-left transition-all flex items-center justify-between cursor-pointer ${
                          deactivateReason === reason
                            ? 'bg-amber-400/10 border-amber-400/50 text-amber-300 font-bold'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] text-white/80 font-normal'
                        }`}
                      >
                        <span>{reason}</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          deactivateReason === reason ? 'border-amber-400 bg-amber-400' : 'border-white/20'
                        }`}>
                          {deactivateReason === reason && <Check size={10} className="text-black font-bold" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setMetaModalStep('deactivate_confirm')}
                    className="w-full py-3 rounded-xl bg-amber-400 text-black text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Continue to Confirmation
                  </button>
                </div>
              )}

              {/* STEP 2a - SUBSTEP 3: DEACTIVATE CONFIRM */}
              {metaModalStep === 'deactivate_confirm' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Confirm Deactivation</h4>
                    <p className="text-[11px] text-white/50 mt-1">Review your deactivation details before proceeding:</p>
                  </div>

                  {isDeactivationInCooldown ? (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <AlertCircle size={16} />
                        <span>Deactivation Cooldown Active</span>
                      </div>
                      <p className="text-xs text-amber-200/80 leading-relaxed font-normal">
                        You can deactivate again starting <strong className="text-amber-300 font-mono">{cooldownDateString}</strong>. To prevent rapid toggling, account deactivation is temporarily locked for 5 days after reactivating.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5 text-xs font-mono">
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-white/40">Action:</span>
                        <span className="text-amber-300 font-bold">Temporarily Deactivate</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-white/40">Duration:</span>
                        <span className="text-white/80">{deactivateDuration.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-white/40">Return Mode:</span>
                        <span className="text-white/80 text-right max-w-[180px] truncate">
                          {deactivateDuration === 'manual' ? 'Manual log in' : computeReturnDate(deactivateDuration)?.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Reason:</span>
                        <span className="text-white/80">{deactivateReason}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMetaModalStep('choice')}
                      className="py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeactivationSubmit}
                      disabled={isProcessingDangerAction || isDeactivationInCooldown}
                      className="py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-black text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {isProcessingDangerAction ? <RefreshCw className="animate-spin" size={14} /> : <PauseCircle size={14} />}
                      Deactivate My Account
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2b - SUBSTEP 1: DELETE INTERSTITIAL */}
              {metaModalStep === 'delete_interstitial' && (
                <div className="space-y-5 text-center py-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto">
                    <PauseCircle size={24} />
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-base font-bold text-white uppercase tracking-wider">Want to take a break instead?</h4>
                    <p className="text-xs text-white/60 leading-relaxed max-w-sm mx-auto">
                      Deactivating hides your profile without erasing anything, and you can always come back whenever you wish.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMetaModalStep('deactivate_duration')}
                      className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-black text-xs font-bold uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <PauseCircle size={16} />
                      Deactivate Instead
                    </button>

                    <button
                      type="button"
                      onClick={() => setMetaModalStep('delete_reason')}
                      className="text-xs text-white/40 hover:text-red-400 underline transition-colors cursor-pointer block mx-auto pt-1"
                    >
                      No, Delete My Account
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2b - SUBSTEP 2: DELETE REASON */}
              {metaModalStep === 'delete_reason' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Why are you deleting your account?</h4>
                    <p className="text-[11px] text-white/50 mt-1">Please select a reason for deletion:</p>
                  </div>

                  <div className="space-y-2">
                    {[
                      'Creating a new account',
                      'Concerned about my data/privacy',
                      'Too much time spent',
                      'Bad experience',
                      'Something else'
                    ].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setDeleteReason(reason)}
                        className={`w-full p-3 rounded-xl border text-xs text-left transition-all flex items-center justify-between cursor-pointer ${
                          deleteReason === reason
                            ? 'bg-red-500/10 border-red-500/50 text-red-300 font-bold'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] text-white/80 font-normal'
                        }`}
                      >
                        <span>{reason}</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          deleteReason === reason ? 'border-red-400 bg-red-400' : 'border-white/20'
                        }`}>
                          {deleteReason === reason && <Check size={10} className="text-black font-bold" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setMetaModalStep('delete_confirm')}
                    className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Continue to Deletion Warning
                  </button>
                </div>
              )}

              {/* STEP 2b - SUBSTEP 3: DELETE CONFIRM */}
              {metaModalStep === 'delete_confirm' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Schedule Permanent Deletion</h4>
                    <p className="text-[11px] text-white/50 mt-1">Please review the grace period policy carefully:</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 space-y-2 text-xs leading-relaxed text-red-200">
                    <div className="flex items-center gap-2 font-bold text-red-400">
                      <AlertTriangle size={16} />
                      <span>69-Day Cancellation Grace Period</span>
                    </div>
                    <p className="text-[11px] text-white/80 leading-relaxed font-normal">
                      Your account will be permanently deleted in <strong className="text-red-400 font-mono">69 days</strong>. If you log back in before then, deletion will be cancelled and your account fully restored. After 69 days, this cannot be undone.
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="text-[10px] uppercase tracking-widest text-white/50 block font-bold">
                      Type <code className="text-white bg-white/10 px-1 py-0.5 rounded font-mono">DELETE</code> to confirm schedule:
                    </label>
                    <input 
                      type="text"
                      value={deleteInputText}
                      onChange={(e) => setDeleteInputText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full h-11 px-4 bg-[#0b0e14] border border-red-500/30 focus:border-red-500 rounded-xl text-xs text-white font-mono text-center focus:outline-none tracking-widest"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMetaModalStep('choice')}
                      className="py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeletionScheduleSubmit}
                      disabled={isProcessingDangerAction || deleteInputText.trim() !== 'DELETE'}
                      className="py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:pointer-events-none shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    >
                      {isProcessingDangerAction ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />}
                      Confirm Deletion
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountSettings;
