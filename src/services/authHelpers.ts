import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { auth } from "../lib/firebase";

// ==========================================
// ১. সাইন-আপ (Register) ফাংশন
// ==========================================
export function registerUser(email: string, password: string): Promise<User | null> {
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
export function loginUser(email: string, password: string): Promise<User | null> {
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

export { firebaseSignOut };
