// Self-hosted Admin Service Stub
import { logger } from '../utils/logger';

export const admin: any = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => new Date().toISOString(),
    },
  },
};

export function getFirebaseAdmin(): any {
  return null;
}

export function getFirestoreAdmin(): any {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false, data: () => ({}) }),
        set: async () => {},
        update: async () => {},
      }),
      add: async () => ({ id: `doc_${Date.now()}` }),
      where: () => ({
        get: async () => ({ empty: true, docs: [] }),
        orderBy: () => ({
          get: async () => ({ empty: true, docs: [] }),
        }),
      }),
    }),
    batch: () => ({
      update: () => {},
      commit: async () => {},
    }),
  };
}
