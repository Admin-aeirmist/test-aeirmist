import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeUsername } from './usernameUtils';
import { logger } from '@/src/utils/logger';


let migrationDone = false;

export async function migrateUsernamesNormalized() {
  if (migrationDone || !db) return;
  migrationDone = true;

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) return;

    let batch = writeBatch(db);
    let count = 0;

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      const rawUsername = data.username || data.handle || '';
      
      // If missing usernameNormalized or needs repair
      if (rawUsername && (!data.usernameNormalized || data.usernameNormalized !== normalizeUsername(rawUsername))) {
        const norm = normalizeUsername(rawUsername);
        if (norm) {
          batch.update(doc(db, 'users', userDoc.id), {
            usernameNormalized: norm
          });
          count++;

          if (count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    logger.warn("Username normalization migration warning (non-fatal):", err);
  }
}
