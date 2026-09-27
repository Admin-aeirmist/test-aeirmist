import { initializeApp, getApps, getApp } from 'firebase/app';
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

import { getStorage } from 'firebase/storage';

import config from '../../firebase-applet-config.json';
import { logger } from '@/src/utils/logger';


if (!config || !config.projectId) {
  logger.error('❌ Firebase config invalid or missing:', config);
  throw new Error(
    'Invalid Firebase configuration. Ensure firebase-applet-config.json exists and contains valid projectId.'
  );
}

logger.info('✅ [Firebase] Initializing with project:', config.projectId);
const activeConfig = config;

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(activeConfig);

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
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || '');
    if (
      msg.includes('IndexedDbTransactionError') ||
      msg.includes('prefixPath') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('AbortError')
    ) {
      logger.warn('Background promise notice:', msg);
    }
  });
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

export const storage = getStorage(app);

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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
// ৩. পাসওয়ার্ড রিসেট মেইল পাঠানোর ফাংশন
// ==========================================
export function handleForgotPassword(userEmail: string) {
  return sendPasswordResetEmail(auth, userEmail)
    .then(() => {
      logger.info("পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে:", userEmail);
    })
    .catch((error) => {
      logger.error("পাসওয়ার্ড রিসেট ত্রুটি:", error.message);
      throw error;
    });
}

// ==========================================
// ৪. ইউজার লগড-ইন আছে কিনা তা চেক করা (State Observer)
// ==========================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    logger.info("বর্তমান ইউজার:", user.email);
  } else {
    logger.info("কোনো ইউজার লগইন করা নেই।");
  }
});

export default app;
