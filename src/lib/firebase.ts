// Self-hosted Compatibility Layer (Firebase SDK dependencies retired)
import { api } from '../services/api/client';
import { logger } from '../utils/logger';

// Safe Mock Auth
class MockAuth {
  private listeners: Set<(user: any) => void> = new Set();
  public currentUser: any = null;

  constructor() {
    this.hydrateUser();
  }

  private hydrateUser() {
    if (typeof localStorage === 'undefined') return;
    try {
      const cached = localStorage.getItem('aeirmist_user_profile') || localStorage.getItem('aeirmist_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        this.currentUser = {
          uid: parsed.id || parsed.uid || 'usr_self',
          id: parsed.id || parsed.uid || 'usr_self',
          email: parsed.email || 'user@aeirmist.local',
          displayName: parsed.displayName || parsed.username || 'User',
          photoURL: parsed.avatarUrl || parsed.photoURL || null,
        };
      }
    } catch (e) {
      // silent
    }
  }

  public onAuthStateChanged(callback: (user: any) => void) {
    this.listeners.add(callback);
    callback(this.currentUser);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public async signOut() {
    this.currentUser = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('aeirmist_session');
      localStorage.removeItem('aeirmist_user_profile');
    }
    this.listeners.forEach((cb) => cb(null));
  }
}

export const auth: any = new MockAuth();

// Safe Mock Database
export const db: any = {
  collection: (_col: string) => ({
    doc: (_id: string) => ({
      get: async () => ({ exists: () => false, data: () => ({}) }),
      set: async () => {},
      update: async () => {},
      delete: async () => {},
    }),
    add: async () => ({ id: `doc_${Date.now()}` }),
  }),
};

// Safe Mock Storage
export const storage: any = {
  ref: (_path: string) => ({
    fullPath: _path,
  }),
};

export const isConfigValid = true;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  logger.warn('Database note:', error, operationType, path);
  return error;
}

export async function registerUser(email: string, password: string) {
  try {
    const res = await api.auth.register({ email, password });
    if (res?.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_token', res.token);
    }
    return res?.user;
  } catch (err: any) {
    logger.error('Registration error:', err);
    throw err;
  }
}

export async function loginUser(email: string, password: string) {
  try {
    const res = await api.auth.login({ email, password });
    if (res?.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_token', res.token);
    }
    return res?.user;
  } catch (err: any) {
    logger.error('Login error:', err);
    throw err;
  }
}

export async function handleForgotPassword(userEmail: string) {
  try {
    await api.auth.forgotPassword(userEmail);
    logger.info('Password reset requested for:', userEmail);
  } catch (err: any) {
    logger.error('Password reset error:', err);
    throw err;
  }
}

export function onAuthStateChanged(authInstance: any, callback: (user: any) => void) {
  if (authInstance?.onAuthStateChanged) {
    return authInstance.onAuthStateChanged(callback);
  }
  callback(null);
  return () => {};
}

const app: any = {
  name: '[DEFAULT]',
  options: {},
};

export default app;
