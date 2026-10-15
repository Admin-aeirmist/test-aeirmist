import { initializeApp, getApps, getApp, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

let adminApp: App | null = null;

export function getFirebaseAdmin(): App | null {
  if (adminApp) return adminApp;
  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
      return adminApp;
    }

    let projectId = process.env.FIREBASE_PROJECT_ID;
    const configPath = path.resolve(process.cwd(), '../firebase-applet-config.json');
    const localConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const targetPath = fs.existsSync(localConfigPath) ? localConfigPath : (fs.existsSync(configPath) ? configPath : null);

    if (targetPath) {
      try {
        const cfg = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        if (cfg.projectId) projectId = cfg.projectId;
      } catch {}
    }

    if (!projectId) {
      projectId = 'aeirmist-d4dd8';
    }

    // Check if service account key is provided via argument, environment variable, or standard locations
    const keyPathArg = process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--key');
    const envKey = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const defaultLocalKey = path.resolve(process.cwd(), 'serviceAccountKey.json');
    const defaultParentKey = path.resolve(process.cwd(), '../serviceAccountKey.json');
    const candidateKey = keyPathArg || envKey || (fs.existsSync(defaultLocalKey) ? defaultLocalKey : (fs.existsSync(defaultParentKey) ? defaultParentKey : null));

    if (candidateKey && fs.existsSync(candidateKey)) {
      try {
        const sa = JSON.parse(fs.readFileSync(candidateKey, 'utf8'));
        adminApp = initializeApp({
          credential: cert(sa),
          projectId: sa.project_id || projectId,
        });
        return adminApp;
      } catch (keyErr: any) {
        console.warn('[FirebaseAdmin] Failed to read service account key:', keyErr.message);
      }
    }

    // Only attempt default initializeApp if running in a Google Cloud environment or explicitly configured
    const isGoogleCloudEnv = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE ||
      process.env.GAE_SERVICE ||
      process.env.CLOUD_RUN_JOB ||
      process.env.GCP_PROJECT
    );

    if (isGoogleCloudEnv) {
      adminApp = initializeApp({
        projectId,
      });
      return adminApp;
    }

    // In local development without service account key, skip Firebase Admin to prevent metadata server timeout
    return null;
  } catch (err: any) {
    if (err?.code === 'app/duplicate-app') {
      adminApp = getApps()[0] || getApp();
      return adminApp;
    }
    console.warn('[FirebaseAdmin] Failed to initialize firebase-admin:', err?.message || err);
    return null;
  }
}

/**
 * Lazy import of profile data from Firestore for a given Firebase UID.
 * Returns null safely without throwing or blocking if Firestore is unavailable or document does not exist.
 */
export async function fetchFirestoreProfile(uid: string): Promise<Record<string, any> | null> {
  if (!uid || typeof uid !== 'string') return null;
  const cleanUid = uid.startsWith('profile_') ? uid.replace(/^profile_/, '') : uid;

  // 1. Try Firebase Admin SDK if initialized
  try {
    const app = getFirebaseAdmin();
    if (app) {
      const firestore = getFirestore(app);

      const docRef = firestore.collection('profiles').doc(cleanUid);
      const snap = await docRef.get();
      if (snap.exists) return snap.data() || null;

      const altDocRef = firestore.collection('profiles').doc(`profile_${cleanUid}`);
      const altSnap = await altDocRef.get();
      if (altSnap.exists) return altSnap.data() || null;

      const userSnap = await firestore.collection('users').doc(cleanUid).get();
      if (userSnap.exists) return userSnap.data() || null;

      return null;
    }
  } catch (err: any) {
    // Fall through to REST API
  }

  // 2. High-speed Firestore REST API fallback (works without serviceAccountKey)
  try {
    const configPath = path.resolve(process.cwd(), '../firebase-applet-config.json');
    const localConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const targetPath = fs.existsSync(localConfigPath) ? localConfigPath : (fs.existsSync(configPath) ? configPath : null);

    if (targetPath) {
      const cfg = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      const projectId = cfg.projectId || 'aeirmist-d4dd8';
      const apiKey = cfg.apiKey;

      if (apiKey) {
        const candidatePaths = [
          `profiles/profile_${cleanUid}`,
          `profiles/${cleanUid}`,
          `users/${cleanUid}`
        ];

        for (const docPath of candidatePaths) {
          try {
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}?key=${apiKey}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
              const data = await res.json();
              if (data && data.fields) {
                const parsed: Record<string, any> = {};
                for (const [k, v] of Object.entries(data.fields as Record<string, any>)) {
                  if ('stringValue' in v) parsed[k] = v.stringValue;
                  else if ('booleanValue' in v) parsed[k] = v.booleanValue;
                  else if ('integerValue' in v) parsed[k] = parseInt(v.integerValue, 10);
                  else if ('doubleValue' in v) parsed[k] = parseFloat(v.doubleValue);
                  else if ('timestampValue' in v) parsed[k] = v.timestampValue;
                }
                return parsed;
              }
            }
          } catch {}
        }
      }
    }
  } catch {}

  return null;
}
