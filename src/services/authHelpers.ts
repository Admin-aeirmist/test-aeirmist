import { api, setAuthToken, getAuthToken } from "./api/client";

export interface User {
  uid: string;
  id: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  username?: string;
  providerData?: Array<{ providerId: string; email: string }>;
  [key: string]: any;
}

// ==========================================
// 1. সাইন-আপ (Register) ফাংশন
// ==========================================
export async function registerUser(
  email: string, 
  password: string, 
  username?: string, 
  displayName?: string
): Promise<User | null> {
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
      localStorage.setItem('auth_token', backendRes.token);
      setAuthToken(backendRes.token);
      const user: User = {
        uid: backendRes.user?.id,
        id: backendRes.user?.id,
        email: backendRes.user?.email || email,
        displayName: backendRes.user?.displayName || cleanDisplay,
        username: backendRes.user?.username || cleanUsername,
        photoURL: backendRes.user?.avatarKey || null,
        providerData: [{ providerId: 'password', email }]
      };
      console.info("[AuthHelpers] Backend registration successful, token stored for:", user.email);
      return user;
    }
    return null;
  } catch (error: any) {
    console.error("[AuthHelpers] Registration error:", error.message);
    throw error;
  }
}

// ==========================================
// 2. লগইন (Login) ফাংশন
// ==========================================
export async function loginUser(email: string, password: string): Promise<User | null> {
  try {
    const backendRes = await api.auth.login({ email, password });
    if (backendRes?.token) {
      localStorage.setItem('auth_token', backendRes.token);
      setAuthToken(backendRes.token);
      const user: User = {
        uid: backendRes.user?.id,
        id: backendRes.user?.id,
        email: backendRes.user?.email || email,
        displayName: backendRes.user?.displayName || backendRes.user?.username || email.split('@')[0],
        username: backendRes.user?.username,
        photoURL: backendRes.user?.avatarKey || null,
        providerData: [{ providerId: 'password', email }]
      };
      console.info("[AuthHelpers] Backend login successful, token stored for:", user.email);
      return user;
    }
    return null;
  } catch (error: any) {
    console.error("[AuthHelpers] Login error:", error.message);
    throw error;
  }
}

// ==========================================
// 3. ইউজার লগড-ইন আছে কিনা তা চেক করা (State Observer)
// ==========================================
export function initAuthStateObserver(callback?: (user: User | null) => void) {
  const token = localStorage.getItem('auth_token') || getAuthToken();
  if (token) {
    api.auth.me()
      .then((res) => {
        if (res?.user) {
          const user: User = {
            uid: res.user.id,
            id: res.user.id,
            email: res.user.email,
            displayName: res.user.displayName || res.user.username,
            username: res.user.username,
            photoURL: res.user.avatarKey || null,
            providerData: [{ providerId: 'password', email: res.user.email }]
          };
          if (callback) callback(user);
        } else {
          if (callback) callback(null);
        }
      })
      .catch(() => {
        if (callback) callback(null);
      });
  } else {
    if (callback) callback(null);
  }

  return () => {
    // Unsubscribe no-op
  };
}

// ==========================================
// 4. সাইন-আউট (Logout) ফাংশন
// ==========================================
export async function signOutUser(): Promise<boolean> {
  localStorage.removeItem('auth_token');
  setAuthToken(null);
  return true;
}

