import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { api, setAuthToken } from "./api/client";

// ==========================================
// ১. সাইন-আপ (Register) ফাংশন
// ==========================================
export async function registerUser(
  email: string, 
  password: string, 
  username?: string, 
  displayName?: string
): Promise<User | null> {
  // 1. Attempt Universal API backend registration first
  try {
    const cleanUsername = username || email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    const cleanDisplay = displayName || cleanUsername;
    const backendRes = await api.auth.register({ 
      email, 
      password, 
      username: cleanUsername, 
      displayName: cleanDisplay 
    });
    if (backendRes?.token) {
      setAuthToken(backendRes.token);
      console.info("[AuthHelpers] Backend registration successful, JWT stored for:", backendRes.user?.email);
    }
  } catch (backendErr: any) {
    console.warn("[AuthHelpers] Backend registration notice:", backendErr.message);
  }

  // 2. Client Firebase session sync (ensuring zero disruption to legacy UI)
  return createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      console.info("[AuthHelpers] Account created successfully:", user.email);
      return user;
    })
    .catch((error) => {
      console.error("[AuthHelpers] Registration error:", error.code, error.message);
      return null;
    });
}

// ==========================================
// ২. লগইন (Login) ফাংশন
// ==========================================
export async function loginUser(email: string, password: string): Promise<User | null> {
  // 1. Attempt Universal API backend login first (verifies Bcrypt / Scrypt and issues JWT)
  try {
    const backendRes = await api.auth.login({ email, password });
    if (backendRes?.token) {
      setAuthToken(backendRes.token);
      console.info("[AuthHelpers] Backend login successful, JWT token stored for:", backendRes.user?.email);
    }
  } catch (backendErr: any) {
    console.warn("[AuthHelpers] Backend login notice:", backendErr.message);
  }

  // 2. Client Firebase session sync
  return signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      console.info("[AuthHelpers] Login successful:", user.email);
      return user;
    })
    .catch((error) => {
      console.error("[AuthHelpers] Login error:", error.code, error.message);
      return null;
    });
}

// ==========================================
// ৩. ইউজার লগড-ইন আছে কিনা তা চেক করা (State Observer)
// ==========================================
export function initAuthStateObserver(callback?: (user: User | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      console.info("[AuthHelpers] Auth state: signed in as", user.email);
    } else {
      console.info("[AuthHelpers] Auth state: signed out");
    }
    if (callback) {
      callback(user);
    }
  });
}

// ==========================================
// ৪. সাইন-আউট (Logout) ফাংশন
// ==========================================
export async function signOutUser() {
  setAuthToken(null);
  return firebaseSignOut(auth);
}

export { firebaseSignOut };
