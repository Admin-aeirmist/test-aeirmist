import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import config from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(config);
const auth = getAuth(app);

async function run() {
  try {
    console.log("Attempting signInAnonymously...");
    const cred = await signInAnonymously(auth);
    console.log("SUCCESS anonymous signin! UID:", cred.user.uid);
  } catch (err) {
    console.error("Anonymous auth failed:", err.code, err.message);
  }
}

run();
