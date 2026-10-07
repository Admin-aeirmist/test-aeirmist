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
): Promise<any> {
  let backendUser: any = null;
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
      backendUser = {
        uid: backendRes.user?.id,
        id: backendRes.user?.id,
        email: backendRes.user?.email,
        displayName: cleanDisplay,
        photoURL: null,
        providerData: [{ providerId: 'password', email }]
      };
      console.info("[AuthHelpers] Backend registration successful, JWT stored for:", backendRes.user?.email);
    }
  } catch (backendErr: any) {
    console.warn("[AuthHelpers] Backend registration notice:", backendErr.message);
  }

  // Client Firebase session sync (if available)
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    if (backendUser) {
      return backendUser;
    }
    console.error("[AuthHelpers] Registration error:", error.code, error.message);
    return null;
  }
}

// ==========================================
// ২. লগইন (Login) ফাংশন
// ==========================================
export async function loginUser(email: string, password: string): Promise<any> {
  let backendUser: any = null;
  try {
    const backendRes = await api.auth.login({ email, password });
    if (backendRes?.token) {
      setAuthToken(backendRes.token);
      backendUser = {
        uid: backendRes.user?.id,
        id: backendRes.user?.id,
        email: backendRes.user?.email,
        displayName: backendRes.user?.displayName || backendRes.user?.username,
        photoURL: backendRes.user?.avatarKey || null,
        providerData: [{ providerId: 'password', email }]
      };
      console.info("[AuthHelpers] Backend login successful, JWT token stored for:", backendRes.user?.email);
    }
  } catch (backendErr: any) {
    console.warn("[AuthHelpers] Backend login notice:", backendErr.message);
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    if (backendUser) {
      return backendUser;
    }
    console.error("[AuthHelpers] Login error:", error.code, error.message);
    return null;
  }
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
  try {
    await firebaseSignOut(auth);
  } catch {
    // Ignore fallback signout error
  }
  return true;
}

export { firebaseSignOut };
