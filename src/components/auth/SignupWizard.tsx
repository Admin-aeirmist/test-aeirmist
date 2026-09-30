import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  Camera,
  Upload,
  ShieldCheck,
  Globe,
  Sparkles,
  ChevronDown,
  Edit3,
  CheckCircle2
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { MediaQuality } from '../../services/MediaService';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { logger } from '@/src/utils/logger';
import { BLANK_DP } from '../../lib/avatar';
import { validateEmailDetailed, isValidEmail } from '../../utils/emailValidator';

interface SignupWizardProps {
  onGoToLogin: () => void;
  onComplete: () => void;
  initialStep?: number;
}

import { LocationTrackingService } from '../../services/LocationTrackingService';

const DRAFT_KEY = 'aeirmist_signup_wizard_draft';
const DEFAULT_AVATAR = BLANK_DP;
const DEFAULT_COVER = "";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function toMathBoldScript(text: string): string {
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) { // A-Z
      return String.fromCodePoint(0x1D4D0 + (code - 65));
    }
    if (code >= 97 && code <= 122) { // a-z
      return String.fromCodePoint(0x1D4EA + (code - 97));
    }
    return char;
  }).join('');
}

const RELATIONSHIP_OPTIONS = [
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

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

const RuleIndicator = ({ active, label }: { active: boolean; label: string }) => (
  <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide">
    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${active ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/20'}`}>
      {active ? <Check size={10} /> : <div className="w-1 h-1 rounded-full bg-white/20" />}
    </div>
    <span className={active ? 'text-white/80' : 'text-white/30'}>{label}</span>
  </div>
);

export const SignupWizard: React.FC<SignupWizardProps> = ({
  onGoToLogin,
  onComplete,
  initialStep = 1
}) => {
  const {
    completeSignup,
    registerUsername,
    checkUsernameAvailable,
    uploadMedia,
    updateProfile,
    profile,
    user
  } = useAeirmist();

  // Load saved local draft if available
  const savedDraft = useMemo(() => {
    try {
      const item = localStorage.getItem(DRAFT_KEY);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }, []);

  // Wizard Step Control (Steps 1 to 5)
  const [step, setStep] = useState<number>(() => {
    if (initialStep > 1) return initialStep;
    if (savedDraft?.step && savedDraft.step >= 1 && savedDraft.step <= 5) {
      return savedDraft.step;
    }
    return 1;
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const compressImageToDataUrl = (file: File, maxW = 400, maxH = 400, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxW) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          }
          if (height > maxH) {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve(DEFAULT_AVATAR);
          }
        };
        img.onerror = () => resolve(DEFAULT_AVATAR);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(DEFAULT_AVATAR);
      reader.readAsDataURL(file);
    });
  };

  // STEP 1 FIELDS
  const [identifier, setIdentifier] = useState<string>(savedDraft?.identifier || profile?.personalEmail || '');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>(savedDraft?.fullName || profile?.displayName || '');
  const [username, setUsername] = useState<string>(savedDraft?.username || profile?.username || '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>(
    profile?.username ? 'available' : 'idle'
  );
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Birthday Dropdowns
  const [birthMonth, setBirthMonth] = useState<string>(savedDraft?.birthMonth || '01');
  const [birthDay, setBirthDay] = useState<string>(savedDraft?.birthDay || '01');
  const [birthYear, setBirthYear] = useState<string>(savedDraft?.birthYear || '2000');
  const [showBirthdayInfo, setShowBirthdayInfo] = useState<boolean>(false);

  // Days array (1-31)
  const daysArray = useMemo(() => Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')), []);
  
  // Years array (2026 down to 1920)
  const yearsArray = useMemo(() => Array.from({ length: 107 }, (_, i) => String(2026 - i)), []);

  // STEP 2 FIELDS (Photos)
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  // IMPORTANT: never auto-populate from profile.photoURL (which may be Google/provider photo)
  // DP starts blank — user must explicitly upload their own
  const [avatarPreview, setAvatarPreview] = useState<string | null>(DEFAULT_AVATAR);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(DEFAULT_COVER);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // STEP 3 FIELDS (Identity & Privacy)
  const [gender, setGender] = useState<string>(savedDraft?.gender || profile?.gender || 'Custom / Prefer not to say');
  const [relationshipStatus, setRelationshipStatus] = useState<string>(savedDraft?.relationshipStatus || profile?.relationshipStatus || 'Single');
  const [bio, setBio] = useState<string>(savedDraft?.bio || profile?.bio || '');
  const [accountPrivacy, setAccountPrivacy] = useState<'public' | 'private'>(
    savedDraft?.accountPrivacy || (profile?.isPrivate ? 'private' : 'public')
  );

  // Auto-persist local draft
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        step,
        identifier,
        fullName,
        username,
        birthMonth,
        birthDay,
        birthYear,
        gender,
        relationshipStatus,
        bio,
        accountPrivacy
      }));
    } catch {
      // Ignore localStorage errors
    }
  }, [step, identifier, fullName, username, birthMonth, birthDay, birthYear, gender, relationshipStatus, bio, accountPrivacy]);

  // Sync initial step if profile exists and user reloads mid-wizard
  useEffect(() => {
    if (user && profile && profile.onboardingStep && !profile.onboardingCompleted) {
      if (profile.onboardingStep > step) {
        setStep(profile.onboardingStep);
      }
    }
  }, [user, profile]);

  // Password Rules Check
  const rules = useMemo(() => ({
    length: password.length >= 6 && password.length <= 64,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }), [password]);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (rules.length) score += 1;
    if (rules.uppercase) score += 1;
    if (rules.lowercase) score += 1;
    if (rules.number) score += 1;
    if (rules.special) score += 1;
    return score;
  }, [rules]);

  // Username Live Availability Check
  useEffect(() => {
    if (step !== 1) return;
    if (!username) {
      setUsernameStatus('idle');
      setUsernameError(null);
      return;
    }

    if (username === profile?.username) {
      setUsernameStatus('available');
      setUsernameError(null);
      return;
    }

    if (username.length < 3) {
      setUsernameStatus('invalid');
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      setUsernameStatus('invalid');
      setUsernameError('Letters, numbers, and underscores only');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailable(username);
        if (res.available) {
          setUsernameStatus('available');
          setUsernameError(null);
        } else {
          setUsernameStatus('taken');
          setUsernameError('Username is already taken');
        }
      } catch (err: any) {
        setUsernameStatus('taken');
        setUsernameError(err.message || 'Error checking username');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username, checkUsernameAvailable, step, profile?.username]);

  // Handlers for Photo Selection
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isImg = (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|gif|bmp|heic|heif|jfif|avif)$/i.test(file.name);
      if (!isImg) {
        setError('Please select a valid image file (JPG, PNG, WEBP, GIF, HEIC) for profile picture.');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setError('Profile picture size must be under 25MB.');
        return;
      }
      setAvatarFile(file);
      try {
        const objectUrl = URL.createObjectURL(file);
        setAvatarPreview(objectUrl);
      } catch (_) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) setAvatarPreview(event.target.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isImg = (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|gif|bmp|heic|heif|jfif|avif)$/i.test(file.name);
      if (!isImg) {
        setError('Please select a valid image file (JPG, PNG, WEBP, GIF, HEIC) for cover photo.');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setError('Cover photo size must be under 25MB.');
        return;
      }
      setCoverFile(file);
      try {
        const objectUrl = URL.createObjectURL(file);
        setCoverPreview(objectUrl);
      } catch (_) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) setCoverPreview(event.target.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Validate Step 1
  const isStep1Valid = useMemo(() => {
    const isEmailValid = isValidEmail(identifier);
    const isNameValid = fullName.trim().length >= 2;
    const isPassValid = user ? true : password.length >= 6;
    const isUserValid = usernameStatus === 'available';
    return isEmailValid && isNameValid && isPassValid && isUserValid;
  }, [identifier, fullName, password, usernameStatus, user]);

  // Handle Step 1 Submit
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.info("[SignupWizard] Continue clicked");

    if (loading) return;

    setError(null);

    // Explicit validation messages
    const emailValidation = validateEmailDetailed(identifier);
    if (!emailValidation.isValid) {
      setError(emailValidation.error || 'Please enter a valid Gmail or Email address (e.g. yourname@gmail.com).');
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }

    // Age requirement check
    const selectedDOB = new Date(parseInt(birthYear, 10), parseInt(birthMonth, 10) - 1, parseInt(birthDay, 10));
    const today = new Date();
    let age = today.getFullYear() - selectedDOB.getFullYear();
    const monthDiff = today.getMonth() - selectedDOB.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < selectedDOB.getDate())) {
      age--;
    }
    if (age < 13) {
      setError('You must be at least 13 years old to create an Aeirmist account.');
      return;
    }

    if (!user && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!username || username.length < 3) {
      setError('Please enter a valid username (at least 3 characters).');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores.');
      return;
    }

    // Auto-check username if status is idle or checking
    let currentUsernameStatus = usernameStatus;
    if (username !== profile?.username && (currentUsernameStatus === 'idle' || currentUsernameStatus === 'checking')) {
      logger.info("[SignupWizard] Automatically checking username availability...");
      try {
        const res = await checkUsernameAvailable(username);
        if (res.available) {
          setUsernameStatus('available');
          currentUsernameStatus = 'available';
        } else {
          setUsernameStatus('taken');
          setUsernameError('Username is already taken');
          setError('That username is already taken. Please pick another.');
          return;
        }
      } catch (err: any) {
        setError('Error checking username availability. Please try again.');
        return;
      }
    }

    if (currentUsernameStatus !== 'available') {
      if (currentUsernameStatus === 'taken') {
        setError('That username is already taken. Please pick another.');
        return;
      } else if (currentUsernameStatus === 'invalid') {
        setError(usernameError || 'Please enter a valid username (at least 3 characters).');
        return;
      } else {
        setError('Please enter a valid and available username.');
        return;
      }
    }

    logger.info("[SignupWizard] Validation passed");
    setLoading(true);

    try {
      const emailToUse = emailValidation.normalizedEmail || identifier.trim().toLowerCase();

      const formattedDOB = `${birthYear}-${birthMonth}-${birthDay}`;

      // Call REAL completeSignup or registerUsername if user already logged in
      if (user) {
        await registerUsername(username, {
          displayName: fullName,
          personalEmail: emailToUse,
          phoneNumber: ''
        });
      } else {
        await completeSignup(
          emailToUse,
          password,
          username,
          fullName,
          null,
          null
        );
      }

      logger.info("[SignupWizard] Signup success");

      // Store initial DOB and contact details on profile safely
      try {
        await updateProfile({
          dateOfBirth: formattedDOB,
          personalEmail: emailToUse,
          phoneNumber: '',
          onboardingStep: 2,
          onboardingCompleted: false
        });
        logger.info("[SignupWizard] Profile updated");
      } catch (profErr) {
        logger.warn("[SignupWizard] updateProfile warning:", profErr);
      }

      logger.info("[SignupWizard] Step changed to 2");
      setStep(2);
    } catch (err: any) {
      logger.error("[SignupWizard] Step 1 Error:", err);
      let errorMsg = err.message || 'Account creation failed';
      if (errorMsg.includes('auth/email-already-in-use')) {
        errorMsg = 'An account with this email/mobile already exists.';
      } else if (errorMsg.includes('auth/weak-password')) {
        errorMsg = 'Password is too weak. Please use at least 6 characters.';
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2 Submit (Photos)
  const handleStep2Submit = async (skip: boolean = false) => {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const activeUser = user || auth.currentUser;
      const targetUid = activeUser?.uid || 'guest';

      // Never use profile.photoURL here — it may be a Google/provider photo
      // DP stays blank (DEFAULT_AVATAR) until user explicitly uploads one
      let photoURLToSave = DEFAULT_AVATAR;
      let coverURLToSave = DEFAULT_COVER;

      if (skip) {
        photoURLToSave = photoURLToSave || DEFAULT_AVATAR;
        coverURLToSave = coverURLToSave || DEFAULT_COVER;
      } else {
        // 1. Upload Avatar if selected
        if (avatarFile) {
          setUploadStatusText('Uploading profile picture...');
          try {
            const uploadedAvatar = await uploadMedia(
              avatarFile,
              `profiles/${targetUid}/avatars`,
              undefined,
              MediaQuality.PROFILE
            );
            if (uploadedAvatar) {
              photoURLToSave = uploadedAvatar;
              setAvatarPreview(uploadedAvatar);
            }
          } catch (avErr) {
            logger.warn("[SignupWizard] Remote avatar upload failed, creating optimized thumbnail fallback:", avErr);
            try {
              const fallbackThumb = await compressImageToDataUrl(avatarFile, 200, 200, 0.7);
              photoURLToSave = fallbackThumb;
              setAvatarPreview(fallbackThumb);
            } catch (_) {
              photoURLToSave = DEFAULT_AVATAR;
            }
          }
        } else if (avatarPreview && !avatarPreview.startsWith('blob:')) {
          photoURLToSave = avatarPreview;
        }

        // 2. Upload Cover if selected
        if (coverFile) {
          setUploadStatusText('Uploading cover photo...');
          try {
            const uploadedCover = await uploadMedia(
              coverFile,
              `profiles/${targetUid}/covers`,
              undefined,
              MediaQuality.HD
            );
            if (uploadedCover) {
              coverURLToSave = uploadedCover;
              setCoverPreview(uploadedCover);
            }
          } catch (cvErr) {
            logger.warn("[SignupWizard] Remote cover upload failed, creating optimized thumbnail fallback:", cvErr);
            try {
              const fallbackThumb = await compressImageToDataUrl(coverFile, 800, 300, 0.65);
              coverURLToSave = fallbackThumb;
              setCoverPreview(fallbackThumb);
            } catch (_) {
              coverURLToSave = DEFAULT_COVER;
            }
          }
        } else if (coverPreview && !coverPreview.startsWith('blob:')) {
          coverURLToSave = coverPreview;
        }
      }

      setUploadStatusText('Saving profile...');
      await updateProfile({
        photoURL: photoURLToSave,
        coverURL: coverURLToSave,
        bannerURL: coverURLToSave,
        onboardingStep: 3
      });

      setStep(3);
    } catch (err: any) {
      logger.error("[SignupWizard] Step 2 Error:", err);
      setError(err.message || 'Failed to update photos.');
    } finally {
      setLoading(false);
      setUploadStatusText('');
    }
  };

  // Handle Step 3 Submit (Identity & Privacy)
  const handleStep3Submit = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      if (!gender) {
        setError('Please select a gender option.');
        setLoading(false);
        return;
      }

      const isPrivateChoice = accountPrivacy === 'private';

      await updateProfile({
        gender,
        relationshipStatus: relationshipStatus || 'Single',
        isPrivate: isPrivateChoice,
        privacySettings: {
          ...(profile?.privacySettings || {}),
          privateProfile: isPrivateChoice
        },
        onboardingStep: 4
      });

      setStep(4);
    } catch (err: any) {
      logger.error("[SignupWizard] Step 3 Error:", err);
      setError(err.message || 'Failed to update preferences.');
    } finally {
      setLoading(false);
    }
  };

  // Safe Idempotent Onboarding Save & Dual Verification Engine
  const saveAndVerifyOnboarding = async (): Promise<boolean> => {
    const activeAuthUser = auth.currentUser;
    const effectiveUid = user?.uid || activeAuthUser?.uid;

    if (!effectiveUid || !db) {
      throw new Error("Couldn't save your profile. Please try again.");
    }

    const targetProfileId = profile?.id || `profile_${effectiveUid}`;
    const profileRef = doc(db, 'profiles', targetProfileId);

    // 1. Re-read current profile from Firestore to inspect partial/existing state
    let existingData: any = {};
    try {
      const currentDocSnap = await getDoc(profileRef);
      if (currentDocSnap.exists()) {
        existingData = currentDocSnap.data() || {};
      }
    } catch (readErr) {
      logger.warn("[SignupWizard] Initial profile read failed, proceeding to write attempt:", readErr);
    }

    // Required field values
    const reqUsername = (username || profile?.username || '').trim().toLowerCase();
    const reqDisplayName = (fullName || profile?.displayName || username || '').trim();
    const reqGender = gender || profile?.gender || 'Custom / Prefer not to say';
    const reqRelationship = relationshipStatus || profile?.relationshipStatus || 'Single';
    const reqDOB = `${birthYear}-${birthMonth}-${birthDay}`;
    const reqIsPrivate = accountPrivacy === 'private';

    let targetPhotoURL = avatarPreview || existingData.photoURL || profile?.photoURL || DEFAULT_AVATAR;
    let targetCoverURL = coverPreview || existingData.coverURL || existingData.bannerURL || profile?.coverURL || profile?.bannerURL || "";

    // Upload image files if selected and still pending remote upload
    if (avatarFile && (targetPhotoURL.startsWith('blob:') || targetPhotoURL.startsWith('data:') || !existingData.photoURL || existingData.photoURL === DEFAULT_AVATAR)) {
      try {
        const uploadedAvatar = await Promise.race([
          uploadMedia(avatarFile, `profiles/${effectiveUid}/avatars`, undefined, MediaQuality.PROFILE),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 20000))
        ]);
        if (uploadedAvatar) {
          targetPhotoURL = uploadedAvatar;
          setAvatarPreview(uploadedAvatar);
        }
      } catch (avatarErr) {
        logger.warn("[SignupWizard] Avatar upload fallback:", avatarErr);
        if (!targetPhotoURL || targetPhotoURL.startsWith('blob:')) {
          try {
            targetPhotoURL = await compressImageToDataUrl(avatarFile, 200, 200, 0.7);
          } catch (_) {
            targetPhotoURL = DEFAULT_AVATAR;
          }
        }
      }
    }

    if (coverFile && (targetCoverURL.startsWith('blob:') || targetCoverURL.startsWith('data:'))) {
      try {
        const uploadedCover = await Promise.race([
          uploadMedia(coverFile, `profiles/${effectiveUid}/covers`, undefined, MediaQuality.HD),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 20000))
        ]);
        if (uploadedCover) {
          targetCoverURL = uploadedCover;
          setCoverPreview(uploadedCover);
        }
      } catch (coverErr) {
        logger.warn("[SignupWizard] Cover upload fallback:", coverErr);
        if (!targetCoverURL || targetCoverURL.startsWith('blob:')) {
          try {
            targetCoverURL = await compressImageToDataUrl(coverFile, 800, 300, 0.65);
          } catch (_) {
            targetCoverURL = "";
          }
        }
      }
    }

    if (!targetPhotoURL || targetPhotoURL.startsWith('blob:')) targetPhotoURL = DEFAULT_AVATAR;
    if (!targetCoverURL || targetCoverURL.startsWith('blob:')) targetCoverURL = "";

    // Idempotent payload construction: Only update missing/different fields
    const payload: any = {};
    if (!existingData.username || existingData.username.toLowerCase() !== reqUsername) {
      payload.username = reqUsername;
      payload.usernameNormalized = reqUsername;
    }
    if (!existingData.displayName || existingData.displayName !== reqDisplayName) {
      payload.displayName = reqDisplayName;
    }
    if (!existingData.photoURL || existingData.photoURL !== targetPhotoURL) {
      payload.photoURL = targetPhotoURL;
    }
    if (existingData.coverURL !== targetCoverURL) {
      payload.coverURL = targetCoverURL;
      payload.bannerURL = targetCoverURL;
    }
    if (!existingData.gender || existingData.gender !== reqGender) {
      payload.gender = reqGender;
    }
    if (!existingData.relationshipStatus || existingData.relationshipStatus !== reqRelationship) {
      payload.relationshipStatus = reqRelationship;
    }
    if (typeof existingData.isPrivate !== 'boolean' || existingData.isPrivate !== reqIsPrivate) {
      payload.isPrivate = reqIsPrivate;
      payload.privacySettings = {
        ...(existingData.privacySettings || profile?.privacySettings || {}),
        privateProfile: reqIsPrivate
      };
    }
    
    // User-provided bio (or blank if none provided)
    payload.bio = (bio || '').trim();
    payload.dateOfBirth = reqDOB;

    // Capture initial registration location and active device location
    try {
      const locData = await LocationTrackingService.captureCurrentLocation();
      payload.createdLocation = locData.displayLocation;
      payload.signupLocation = locData.displayLocation;
      payload.lastLoginLocation = locData.displayLocation;
      payload.deviceActiveLocation = locData.displayLocation;
      const devMeta = LocationTrackingService.getDeviceMetadata();
      payload.deviceInfo = devMeta.platform;
    } catch (locErr) {
      logger.warn("[SignupWizard] Location detection skipped:", locErr);
    }
    payload.onboardingStep = 5;

    // Write required profile data to Firestore
    if (Object.keys(payload).length > 0) {
      logger.info("[SignupWizard] Writing profile fields:", Object.keys(payload));
      await updateProfile(payload);
    }

    // 2. VERIFY SAVED DOCUMENT & REQUIRED FIELDS IN FIRESTORE
    const verifySnap = await getDoc(profileRef);
    if (!verifySnap.exists()) {
      throw new Error("Couldn't save your profile. Please try again.");
    }

    const savedData = verifySnap.data();

    // Verify each required field explicitly (cover is optional)
    const isUsernameOk = Boolean(savedData.username && String(savedData.username).trim().length >= 3);
    const isDisplayNameOk = Boolean(savedData.displayName && String(savedData.displayName).trim().length >= 2);
    const isPhotoOk = Boolean(savedData.photoURL || targetPhotoURL);
    const isCoverOk = true; // Optional: user may leave cover photo blank
    const isGenderOk = Boolean(savedData.gender);
    const isRelOk = Boolean(savedData.relationshipStatus);
    const isPrivacyOk = typeof savedData.isPrivate === 'boolean';
    const isAuthOk = Boolean(activeAuthUser && activeAuthUser.uid === effectiveUid);

    if (!isUsernameOk || !isDisplayNameOk || !isPhotoOk || !isCoverOk || !isGenderOk || !isRelOk || !isPrivacyOk || !isAuthOk) {
      logger.error("[SignupWizard] Profile required fields verification failed:", {
        isUsernameOk, isDisplayNameOk, isPhotoOk, isCoverOk, isGenderOk, isRelOk, isPrivacyOk, isAuthOk
      });
      throw new Error("Couldn't save your profile. Please try again.");
    }

    // 3. SET onboardingCompleted = true
    await updateProfile({
      onboardingCompleted: true,
      onboardingStep: 5
    });

    // 4. VERIFY AGAIN THAT onboardingCompleted IS TRUE AND ALL REQUIRED FIELDS REMAIN INTACT
    const finalSnap = await getDoc(profileRef);
    if (!finalSnap.exists()) {
      throw new Error("Couldn't save your profile. Please try again.");
    }

    const finalData = finalSnap.data();
    const isCompletedVerified = finalData.onboardingCompleted === true;
    const finalUsernameOk = Boolean(finalData.username && String(finalData.username).trim().length >= 3);
    const finalDisplayNameOk = Boolean(finalData.displayName && String(finalData.displayName).trim().length >= 2);
    const finalPhotoOk = Boolean(finalData.photoURL || targetPhotoURL);
    const finalCoverOk = true;
    const finalGenderOk = Boolean(finalData.gender);
    const finalRelOk = Boolean(finalData.relationshipStatus);
    const finalPrivacyOk = typeof finalData.isPrivate === 'boolean';
    const finalAuthOk = Boolean(activeAuthUser && activeAuthUser.uid === effectiveUid);

    if (!isCompletedVerified || !finalUsernameOk || !finalDisplayNameOk || !finalPhotoOk || !finalCoverOk || !finalGenderOk || !finalRelOk || !finalPrivacyOk || !finalAuthOk) {
      logger.error("[SignupWizard] Final onboarding completion verification failed:", {
        isCompletedVerified, finalUsernameOk, finalDisplayNameOk, finalPhotoOk, finalCoverOk, finalGenderOk, finalRelOk, finalPrivacyOk, finalAuthOk
      });
      throw new Error("Couldn't save your profile. Please try again.");
    }

    logger.info("[SignupWizard] Profile saved & onboarding completion verified successfully!");
    return true;
  };

  // Handle Step 4 Confirmation (Finalize Account & Save/Verify Profile)
  const handleStep4Confirm = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      await saveAndVerifyOnboarding();
      localStorage.removeItem(DRAFT_KEY);
      setStep(5);
    } catch (err: any) {
      logger.error("[SignupWizard] Step 4 Confirmation Error:", err);
      setError("Couldn't save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 5 "Start Exploring"
  const handleStartExploring = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      // Final re-verification check before proceeding into app
      const targetProfileId = profile?.id || `profile_${user?.uid}`;
      if (db && user) {
        const profileRef = doc(db, 'profiles', targetProfileId);
        const snap = await getDoc(profileRef);
        if (!snap.exists() || snap.data()?.onboardingCompleted !== true) {
          await saveAndVerifyOnboarding();
        }
      }
      localStorage.removeItem(DRAFT_KEY);
      onComplete();
    } catch (err: any) {
      logger.error("[SignupWizard] Start Exploring error:", err);
      setError("Couldn't save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Display Id Name (Display Name / Full Name) on Welcome Screen
  const welcomeDisplayName = useMemo(() => {
    return fullName?.trim() || profile?.displayName?.trim() || profile?.fullName?.trim() || profile?.name?.trim() || 'AEIRMIST';
  }, [profile, fullName]);

  return (
    <div className="w-full max-w-md mx-auto relative select-none my-auto">
      {/* STEP PROGRESS INDICATOR FOR STEPS 1-4 */}
      {step < 5 && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-aeirmist-cyan)] font-black">
              Step {step} of 4
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              {step === 1 ? 'Basic Info' : step === 2 ? 'Profile Setup' : step === 3 ? 'Preferences' : 'Review & Confirm'}
            </span>
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden flex gap-1">
            <div className={`h-full flex-1 transition-all duration-500 ${step >= 1 ? 'bg-[var(--color-aeirmist-cyan)]' : 'bg-white/10'}`} />
            <div className={`h-full flex-1 transition-all duration-500 ${step >= 2 ? 'bg-[var(--color-aeirmist-cyan)]' : 'bg-white/10'}`} />
            <div className={`h-full flex-1 transition-all duration-500 ${step >= 3 ? 'bg-[var(--color-aeirmist-cyan)]' : 'bg-white/10'}`} />
            <div className={`h-full flex-1 transition-all duration-500 ${step >= 4 ? 'bg-[var(--color-aeirmist-cyan)]' : 'bg-white/10'}`} />
          </div>
        </div>
      )}

      {/* ERROR ALERT BANNER */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs flex items-center justify-between gap-2.5"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
            <p className="font-semibold leading-relaxed text-red-300">{error}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(error.includes('already exists') || error.includes('email-already-in-use')) && (
              <button
                type="button"
                onClick={onGoToLogin}
                className="px-3 py-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-white text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Log In
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (step === 4) handleStep4Confirm();
                else if (step === 5) handleStartExploring();
                else if (step === 1) handleStep1Submit({ preventDefault: () => {} } as any);
                else if (step === 2) handleStep2Submit(false);
                else if (step === 3) handleStep3Submit();
              }}
              className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-40"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <span>Retry</span>}
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {/* ======================================================== */}
        {/* STEP 1: BASIC INFORMATION                                */}
        {/* ======================================================== */}
        {step === 1 && (
          <motion.form
            key="wizard-step-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onSubmit={handleStep1Submit}
            className="space-y-4"
          >
            {/* Header */}
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Get started on Aeirmist
              </h2>
              <p className="text-xs text-white/50 leading-relaxed font-normal">
                Create an account to access Aeirmist, easily and securely.
              </p>
            </div>

            {/* Field 1: Email or Gmail address */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
                  <Mail size={13} className="text-aeirmist-cyan" />
                  <span>Email or Gmail Address</span>
                </label>
                {identifier.trim().length > 0 && (
                  <span className={`text-[10px] font-mono font-bold ${isValidEmail(identifier) ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isValidEmail(identifier) ? '✓ Valid' : 'Format: user@gmail.com'}
                  </span>
                )}
              </div>
              <div className={`relative rounded-2xl bg-[#161a26] border transition-all shadow-inner ${
                identifier.trim().length > 0 && !isValidEmail(identifier)
                  ? 'border-amber-500/40 focus-within:border-amber-400'
                  : 'border-white/20 focus-within:border-[var(--color-aeirmist-cyan)] focus-within:ring-2 focus-within:ring-[var(--color-aeirmist-cyan)]/25'
              }`}>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com or valid email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full py-3.5 pl-4 pr-4 bg-transparent outline-none text-sm text-white placeholder:text-slate-400 font-medium"
                />
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                A valid email (or Gmail) is required for account security and recovery.{' '}
                <span className="text-cyan-300 underline decoration-cyan-300/30 cursor-pointer">
                  Learn why we require verified email
                </span>
              </p>
            </div>

            {/* Field 2: Password (If user not authenticated yet) */}
            {!user && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 tracking-wider uppercase">
                  Password
                </label>
                <div className="relative rounded-2xl bg-[#161a26] border border-white/20 focus-within:border-[var(--color-aeirmist-cyan)] focus-within:ring-2 focus-within:ring-[var(--color-aeirmist-cyan)]/25 transition-all shadow-inner">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full py-3.5 pl-4 pr-11 bg-transparent outline-none text-sm text-white placeholder:text-slate-400 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Real-time Password Rules */}
                {password && (
                  <div className="space-y-2 pt-1 p-2 bg-white/[0.02] border border-white/5 rounded-xl">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <div
                          key={lvl}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            passwordStrength >= lvl
                              ? 'bg-[var(--color-aeirmist-cyan)] shadow-[0_0_8px_rgba(0,242,255,0.4)]'
                              : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <RuleIndicator active={rules.length} label="8 to 64 chars" />
                      <RuleIndicator active={rules.uppercase} label="Uppercase (A-Z)" />
                      <RuleIndicator active={rules.lowercase} label="Lowercase (a-z)" />
                      <RuleIndicator active={rules.number} label="At least 1 number" />
                      <RuleIndicator active={rules.special} label="Special symbol" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Field 3: Birthday with dropdowns */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-bold text-white/70 tracking-wide uppercase">
                  Birthday
                </label>
                <button
                  type="button"
                  onClick={() => setShowBirthdayInfo(!showBirthdayInfo)}
                  className="text-white/40 hover:text-white/80 transition-colors p-0.5 cursor-pointer relative"
                  title="Why we ask for birthday"
                >
                  <HelpCircle size={14} />
                </button>
              </div>

              {/* Info Tooltip */}
              {showBirthdayInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-2.5 bg-white/10 border border-white/15 rounded-xl text-[11px] text-white/80 leading-relaxed shadow-lg"
                >
                  Providing your birthday helps make sure you get the right experience for your age on Aeirmist.
                </motion.div>
              )}

              {/* 3 Dropdowns side-by-side */}
              <div className="grid grid-cols-3 gap-2">
                {/* Month Dropdown */}
                <div className="relative">
                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className="w-full h-11 px-3 bg-slate-900 border border-white/10 rounded-2xl text-xs text-white outline-none focus:border-[var(--color-aeirmist-cyan)]/50 appearance-none cursor-pointer"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value} className="bg-slate-900 text-white">
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>

                {/* Day Dropdown */}
                <div className="relative">
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    className="w-full h-11 px-3 bg-slate-900 border border-white/10 rounded-2xl text-xs text-white outline-none focus:border-[var(--color-aeirmist-cyan)]/50 appearance-none cursor-pointer"
                  >
                    {daysArray.map((d) => (
                      <option key={d} value={d} className="bg-slate-900 text-white">
                        {parseInt(d, 10)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>

                {/* Year Dropdown */}
                <div className="relative">
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="w-full h-11 px-3 bg-slate-900 border border-white/10 rounded-2xl text-xs text-white outline-none focus:border-[var(--color-aeirmist-cyan)]/50 appearance-none cursor-pointer"
                  >
                    {yearsArray.map((y) => (
                      <option key={y} value={y} className="bg-slate-900 text-white">
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Field 4: Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 tracking-wider uppercase">
                Name
              </label>
              <div className="relative rounded-2xl bg-[#161a26] border border-white/20 focus-within:border-[var(--color-aeirmist-cyan)] focus-within:ring-2 focus-within:ring-[var(--color-aeirmist-cyan)]/25 transition-all shadow-inner">
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full py-3.5 pl-4 pr-4 bg-transparent outline-none text-sm text-white placeholder:text-slate-400 font-medium"
                />
              </div>
            </div>

            {/* Field 5: Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 tracking-wider uppercase">
                Username
              </label>
              <div className="relative rounded-2xl bg-[#161a26] border border-white/20 focus-within:border-[var(--color-aeirmist-cyan)] focus-within:ring-2 focus-within:ring-[var(--color-aeirmist-cyan)]/25 transition-all shadow-inner">
                <input
                  type="text"
                  required
                  maxLength={20}
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full py-3.5 pl-4 pr-11 bg-transparent outline-none text-sm text-white placeholder:text-slate-400 font-medium"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                  {usernameStatus === 'checking' && <Loader2 size={16} className="animate-spin text-cyan-400" />}
                  {usernameStatus === 'available' && <Check size={16} className="text-green-400" />}
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <AlertCircle size={16} className="text-red-400" />}
                </div>
              </div>
              {usernameError && (
                <p className="text-xs text-red-400 font-medium">{usernameError}</p>
              )}
            </div>

            {/* Legal text block */}
            <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
              By tapping Continue, you agree to create an account and to Aeirmist's{' '}
              <span className="text-cyan-300 underline decoration-cyan-300/30 cursor-pointer">Terms</span>,{' '}
              <span className="text-cyan-300 underline decoration-cyan-300/30 cursor-pointer">Privacy Policy</span> and{' '}
              <span className="text-cyan-300 underline decoration-cyan-300/30 cursor-pointer">Cookies Policy</span>.
            </p>

            {/* Large primary button: Continue */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-[var(--color-aeirmist-cyan)] text-black font-black uppercase tracking-widest text-xs hover:opacity-95 disabled:opacity-40 shadow-[0_0_20px_rgba(0,242,255,0.25)] flex items-center justify-center gap-2 cursor-pointer transition-all mt-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin text-black" />
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Secondary button: I already have an account */}
            <button
              type="button"
              onClick={onGoToLogin}
              className="w-full py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer mt-1"
            >
              I already have an account
            </button>
          </motion.form>
        )}

        {/* ======================================================== */}
        {/* STEP 2: PROFILE SETUP (Photos)                           */}
        {/* ======================================================== */}
        {step === 2 && (
          <motion.div
            key="wizard-step-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="space-y-6"
          >
            <div className="space-y-1 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Profile Setup
              </h2>
              <p className="text-xs text-white/50 leading-relaxed">
                Upload a profile picture and cover banner. Both are optional.
              </p>
            </div>

            {/* Photo Upload Area */}
            <div className="relative rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden p-4 flex flex-col items-center gap-4">
              
              {/* Cover Photo Zone (Rectangular) */}
              <div
                onClick={() => coverInputRef.current?.click()}
                className="w-full h-32 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 border border-white/10 relative overflow-hidden flex items-center justify-center group cursor-pointer"
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-white/40 group-hover:text-white/80 transition-colors">
                    <Upload size={22} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Upload Cover Picture</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={24} className="text-white drop-shadow-md" />
                </div>
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.jfif,.avif"
                onChange={handleCoverSelect}
                className="hidden"
              />

              {/* Avatar Zone (Centered Square) */}
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="relative -mt-12 w-24 h-24 rounded-2xl border-4 border-slate-950 bg-slate-900 overflow-hidden group cursor-pointer shadow-xl flex items-center justify-center shrink-0"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-white/40 group-hover:text-white/80 transition-colors">
                    <User size={32} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={20} className="text-white drop-shadow-md" />
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.jfif,.avif"
                onChange={handleAvatarSelect}
                className="hidden"
              />

              <p className="text-[11px] text-white/40 text-center font-medium">
                Tap on either area to select an image (JPG, PNG, WEBP, GIF, HEIC).
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleStep2Submit(false)}
                className="w-full py-3.5 rounded-2xl bg-[var(--color-aeirmist-cyan)] text-black font-black uppercase tracking-widest text-xs hover:opacity-95 disabled:opacity-40 shadow-[0_0_20px_rgba(0,242,255,0.25)] flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin text-black" />
                    <span>{uploadStatusText || 'Saving...'}</span>
                  </div>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs font-bold text-white/50 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleStep2Submit(true)}
                  className="px-4 py-2 text-xs font-bold text-white/40 hover:text-white/80 cursor-pointer transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: PROFILE PREFERENCES                              */}
        {/* ======================================================== */}
        {step === 3 && (
          <motion.div
            key="wizard-step-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="space-y-5"
          >
            <div className="space-y-1 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Profile Preferences
              </h2>
              <p className="text-xs text-white/50 leading-relaxed">
                Set your gender, relationship status, and account privacy.
              </p>
            </div>

            {/* Gender Selection */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                Gender <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Male', 'Female', 'Custom / Prefer not to say'].map((gOpt) => {
                  const isSel = gender === gOpt;
                  return (
                    <button
                      key={gOpt}
                      type="button"
                      onClick={() => setGender(gOpt)}
                      className={`py-2.5 px-2 rounded-2xl text-[11px] font-bold transition-all border text-center cursor-pointer ${
                        isSel
                          ? 'bg-[var(--color-aeirmist-cyan)]/20 border-[var(--color-aeirmist-cyan)] text-[var(--color-aeirmist-cyan)] shadow-[0_0_12px_rgba(0,242,255,0.15)]'
                          : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {gOpt === 'Custom / Prefer not to say' ? 'Custom' : gOpt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Relationship Status */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                Relationship Status
              </label>
              <div className="relative">
                <select
                  value={relationshipStatus}
                  onChange={(e) => setRelationshipStatus(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-900 border border-white/10 rounded-2xl text-xs text-white outline-none focus:border-[var(--color-aeirmist-cyan)]/50 appearance-none cursor-pointer"
                >
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-slate-900 text-white">
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
            </div>

            {/* Bio Input */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                  Bio <span className="text-white/40 font-normal lowercase">(optional)</span>
                </label>
                <span className="text-[9px] font-mono text-white/40">{bio.length}/200</span>
              </div>
              <textarea
                rows={3}
                maxLength={200}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write your bio or leave it blank..."
                className="w-full p-3.5 bg-slate-900 border border-white/10 rounded-2xl text-xs text-white placeholder-white/30 outline-none focus:border-[var(--color-aeirmist-cyan)]/50 focus:ring-1 focus:ring-[var(--color-aeirmist-cyan)]/20 resize-none font-sans"
              />
            </div>

            {/* Account Type / Privacy Cards */}
            <div className="space-y-2 pt-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                Account Privacy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Public Card */}
                <div
                  onClick={() => setAccountPrivacy('public')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                    accountPrivacy === 'public'
                      ? 'bg-[var(--color-aeirmist-cyan)]/10 border-[var(--color-aeirmist-cyan)] text-white shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                      : 'bg-white/[0.02] border-white/10 text-white/50 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe size={16} className={accountPrivacy === 'public' ? 'text-[var(--color-aeirmist-cyan)]' : 'text-white/40'} />
                      <span className="text-xs font-bold uppercase tracking-wide">Public Account</span>
                    </div>
                    {accountPrivacy === 'public' && <ShieldCheck className="text-[var(--color-aeirmist-cyan)] shrink-0" size={16} />}
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed">
                    Anyone on Aeirmist can view your posts and follow you instantly.
                  </p>
                </div>

                {/* Private Card */}
                <div
                  onClick={() => setAccountPrivacy('private')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                    accountPrivacy === 'private'
                      ? 'bg-amber-500/10 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                      : 'bg-white/[0.02] border-white/10 text-white/50 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock size={16} className={accountPrivacy === 'private' ? 'text-amber-400' : 'text-white/40'} />
                      <span className="text-xs font-bold uppercase tracking-wide">Private Account</span>
                    </div>
                    {accountPrivacy === 'private' && <ShieldCheck className="text-amber-400 shrink-0" size={16} />}
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed">
                    People must send a follow request to see your posts and activity.
                  </p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleStep3Submit}
                className="w-full py-3.5 rounded-2xl bg-[var(--color-aeirmist-cyan)] text-black font-black uppercase tracking-widest text-xs hover:opacity-95 disabled:opacity-40 shadow-[0_0_20px_rgba(0,242,255,0.25)] flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin text-black" />
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-xs font-bold text-white/50 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: REVIEW & CONFIRMATION                            */}
        {/* ======================================================== */}
        {step === 4 && (
          <motion.div
            key="wizard-step-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="space-y-5"
          >
            <div className="space-y-1 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Review & Confirm
              </h2>
              <p className="text-xs text-white/50 leading-relaxed">
                Review your profile details before finalizing your node initialization.
              </p>
            </div>

            {/* Summary Card */}
            <div className="rounded-3xl bg-white/[0.02] border border-white/10 overflow-hidden divide-y divide-white/5">
              
              {/* Header Cover & Avatar Preview */}
              <div className="relative p-4 pb-12 bg-gradient-to-r from-slate-900 to-zinc-900 flex items-end justify-between">
                {coverPreview && (
                  <img src={coverPreview} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
                
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl border-2 border-[var(--color-aeirmist-cyan)] overflow-hidden shadow-lg bg-slate-900">
                    <img src={avatarPreview || DEFAULT_AVATAR} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{fullName || 'Your Name'}</h3>
                    <p className="text-xs font-mono text-[var(--color-aeirmist-cyan)]">@{username || 'username'}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="relative z-10 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-md cursor-pointer transition-colors"
                >
                  <Edit3 size={12} />
                  <span>Edit Photos</span>
                </button>
              </div>

              {/* Basic Info Summary */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">Basic Info</span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[10px] font-bold text-[var(--color-aeirmist-cyan)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 size={11} />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-white/40 block">Contact</span>
                    <span className="text-white font-medium truncate block">{identifier || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 block">Birthday</span>
                    <span className="text-white font-medium block">{birthMonth}/{birthDay}/{birthYear}</span>
                  </div>
                </div>
              </div>

              {/* Preferences Summary */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-white/40">Preferences</span>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-[10px] font-bold text-[var(--color-aeirmist-cyan)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 size={11} />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-white/40 block">Gender</span>
                    <span className="text-white font-medium block truncate">{gender}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 block">Status</span>
                    <span className="text-white font-medium block truncate">{relationshipStatus}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 block">Privacy</span>
                    <span className="text-white font-medium block capitalize">{accountPrivacy}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleStep4Confirm}
                className="w-full py-3.5 rounded-2xl bg-[var(--color-aeirmist-cyan)] text-black font-black uppercase tracking-widest text-xs hover:opacity-95 disabled:opacity-40 shadow-[0_0_20px_rgba(0,242,255,0.25)] flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin text-black" />
                ) : (
                  <>
                    <span>Confirm & Create Account</span>
                    <CheckCircle2 size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 text-xs font-bold text-white/50 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ======================================================== */}
        {/* STEP 5: WELCOME SCREEN                                   */}
        {/* ======================================================== */}
        {step === 5 && (
          <motion.div
            key="wizard-step-5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center text-center py-6 space-y-6"
          >
            {/* Avatar Badge */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl border-4 border-[var(--color-aeirmist-cyan)] p-1 shadow-[0_0_30px_rgba(0,242,255,0.4)] overflow-hidden bg-slate-900 mx-auto">
                <img src={avatarPreview || DEFAULT_AVATAR} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-[var(--color-aeirmist-cyan)] text-black p-1.5 rounded-xl shadow-lg">
                <ShieldCheck size={16} />
              </div>
            </div>

            {/* Cinematic Letter-by-Letter Animated Text Reveal */}
            <div className="flex flex-col items-center justify-center gap-y-2 px-4">
              <motion.span
                initial={{ opacity: 0, y: 12, filter: 'blur(10px)' }}
                animate={{ opacity: 0.6, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
                className="text-xs sm:text-sm font-black tracking-[0.4em] text-zinc-400 uppercase"
              >
                WELCOME TO AEIRMIST
              </motion.span>

              <motion.h1
                key={welcomeDisplayName}
                initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-2xl sm:text-4xl font-serif italic font-medium tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-300 drop-shadow-[0_0_22px_rgba(0,242,255,0.45)] max-w-[95vw] px-2 py-1 leading-normal"
              >
                {welcomeDisplayName}
              </motion.h1>

              <p className="text-xs text-white/60 leading-relaxed max-w-xs pt-1">
                Your profile is initialized and ready. Welcome to the future of social connection.
              </p>
            </div>

            {/* Neon Cyan & Ash Divider Line */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.7, ease: "easeInOut" }}
              className="h-[1.5px] w-48 bg-gradient-to-r from-transparent via-[var(--color-aeirmist-cyan)] to-transparent shadow-[0_0_14px_rgba(0,242,255,0.7)]"
            />

            {/* Button: Start Exploring */}
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.5 }}
              onClick={handleStartExploring}
              className="w-full py-4 rounded-2xl bg-[var(--color-aeirmist-cyan)] text-black font-black uppercase tracking-widest text-xs hover:opacity-95 shadow-[0_0_25px_rgba(0,242,255,0.4)] flex items-center justify-center gap-2.5 cursor-pointer transition-all"
            >
              <span>Start Exploring</span>
              <Sparkles size={18} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
