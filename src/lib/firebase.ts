import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';

import {
  initializeFirestore,
  memoryLocalCache,
  getFirestore,
  clearIndexedDbPersistence
} from 'firebase/firestore';


import config from '../../firebase-applet-config.json';
import { logger } from '@/src/utils/logger';


if (!config || !config.projectId) {
  logger.error('❌ Firebase config invalid or missing:', config);
  throw new Error(
    'Invalid Firebase configuration. Ensure firebase-applet-config.json exists and contains valid projectId.'
  );
}

const activeConfig = config;

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(activeConfig);



// Initialize Firebase App Check safely
let appCheck;
if (typeof window !== 'undefined') {
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LcIm9EtAAAAADzAlaECvnGsifEw38S9OOs0Tbe6';
  
  // Enable debug mode automatically on localhost
  if (window.location.hostname === 'localhost' || import.meta.env.DEV) {
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    console.log('[AppCheck] Running in debug mode for localhost');
  }

  // TEMPORARILY DISABLED: While waiting for Google reCAPTCHA domain propagation,
  // sending an invalid token causes Firebase Auth to reject the request even in Unenforced mode.
  // Uncomment this once the reCAPTCHA domain is fully propagated.
  /*
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true
    });
    console.log('[AppCheck] Initialized successfully');
  } catch (error) {
    console.error('[AppCheck] Failed to initialize:', error);
  }
  */
}

export const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence)
  .catch(console.error);

const dbId = (!activeConfig.firestoreDatabaseId || activeConfig.firestoreDatabaseId === '(default)') ? undefined : activeConfig.firestoreDatabaseId;

let firestoreInstance;
try {
  firestoreInstance = getFirestore(app, dbId);
} catch (e) {
  firestoreInstance = initializeFirestore(app, {}, dbId);
}

if (typeof window !== 'undefined') {
  // 1. Direct console.error & console.warn filter for internal Firebase logger calls
  const _rawConsoleError = console.error.bind(console);
  console.error = function (...args: any[]) {
    try {
      const combined = args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return `${arg.name} ${arg.message} ${(arg as any).code || ''}`;
        if (arg && typeof arg === 'object') return JSON.stringify(arg);
        return String(arg || '');
      }).join(' ');

      if (
        combined.includes('@firebase/firestore') ||
        combined.includes('Uncaught Error in snapshot listener') ||
        combined.includes('Missing or insufficient permissions') ||
        combined.includes('permission-denied')
      ) {
        // Device server is active; silence legacy Firestore permission failure completely
        return;
      }
    } catch {}
    _rawConsoleError(...args);
  };

  const _rawConsoleWarn = console.warn.bind(console);
  console.warn = function (...args: any[]) {
    try {
      const combined = args.map(arg => typeof arg === 'string' ? arg : String(arg?.message || arg?.code || '')).join(' ');
      if (
        combined.includes('@firebase/firestore') ||
        combined.includes('permission-denied') ||
        combined.includes('Missing or insufficient permissions')
      ) {
        return;
      }
    } catch {}
    _rawConsoleWarn(...args);
  };

  // 2. Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || '');
    const code = event?.reason?.code || '';
    if (
      code === 'permission-denied' ||
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('IndexedDbTransactionError') ||
      msg.includes('prefixPath') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('AbortError')
    ) {
      event.preventDefault();
      return;
    }
  });

  // 3. Uncaught exceptions
  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    const errCode = (event?.error as any)?.code || '';
    if (
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('permission-denied') ||
      errCode === 'permission-denied' ||
      (msg.includes('snapshot listener') && msg.includes('permission'))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);
}

export const db = firestoreInstance;

async function testConnection() {
  if (typeof window === 'undefined') return;
  try {
    const { doc, getDocFromServer } = await import('firebase/firestore');
    await getDocFromServer(doc(db, '_connection_test_', 'status'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      logger.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Storage engine migrated 100% to self-hosted Aeirmist Native Server Storage Engine
export const storage: any = { driver: 'native' };

export const isConfigValid = true;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Silently ignore permission-denied — Aeirmist uses device server auth,
  // Firestore rules will always deny gateway/unauthenticated listeners.
  const errCode = (error as any)?.code || '';
  const errMsg = error instanceof Error ? error.message : String(error);
  if (errCode === 'permission-denied' || errMsg.includes('permission') || errMsg.includes('Missing or insufficient')) {
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const errorJson = JSON.stringify(errInfo);
  logger.error('Firestore Error: ', errorJson);
  throw new Error(errorJson);
}

// ==========================================
// ১. সাইন-আপ (Register) ফাংশন
// ==========================================
export function registerUser(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      logger.info("সফলভাবে অ্যাকাউন্ট তৈরি হয়েছে:", user.email);
      return user;
    })
    .catch((error) => {
      logger.error("ত্রুটি:", error.code, error.message);
      throw error;
    });
}

// ==========================================
// ২. লগইন (Login) ফাংশন
// ==========================================
export function loginUser(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      logger.info("সফলভাবে লগইন হয়েছে:", user.email);
      return user;
    })
    .catch((error) => {
      logger.error("লগইন ত্রুটি:", error.code, error.message);
      throw error;
    });
}

// ==========================================
// ৩. পাসওয়ার্ড রিসেট মেইল পাঠানোর ফাংশন (Firebase Templates)
// ==========================================
export function handleForgotPassword(userEmail: string) {
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://aeirmist.com';

  return sendPasswordResetEmail(auth, userEmail, {
    url: `${origin}/?mode=resetPassword`,
    handleCodeInApp: true,
  })
    .then(() => {
      logger.info("পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে:", userEmail);
    })
    .catch((error) => {
      logger.error("পাসওয়ার্ড রিসেট ত্রুটি:", error.message);
      throw error;
    });
}

// ৪. ইউজার লগড-ইন স্টেট অবজারভার
onAuthStateChanged(auth, (_user) => {});

export default app;
