import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { logger } from '@/src/utils/logger';


// ✅ Use correct config from firebase-applet-config.json
const activeConfig = {
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId
};

logger.info('✅ [Firebase Admin] Initializing with:', {
  projectId: activeConfig.projectId,
  firestoreDatabaseId: activeConfig.firestoreDatabaseId
});

let adminApp: admin.app.App | null = null;

export { admin };
export function getFirebaseAdmin() {
  if (!adminApp) {
    try {
      adminApp = admin.initializeApp({
        projectId: activeConfig.projectId,
      });
      logger.info('Admin Auth Initialized with project:', activeConfig.projectId);
    } catch (e: any) {
      if (e.code === 'app/duplicate-app') {
        adminApp = admin.app();
      } else {
        logger.error('Admin Auth Failed:', e);
        throw e;
      }
    }
  }
  return adminApp;
}

export function getFirestoreAdmin() {
  const app = getFirebaseAdmin();
  const dbId = activeConfig.firestoreDatabaseId === '(default)' ? undefined : activeConfig.firestoreDatabaseId;
  const db = getFirestore(app, dbId);
  return db;
}
