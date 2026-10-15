import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { users, profiles } from '../db/schema';
import { eq, or, sql } from 'drizzle-orm';
import { UserDAL } from '../dal/user.dal';

function parseFirestoreField(field: any): any {
  if (!field) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('integerValue' in field) return parseInt(field.integerValue, 10);
  if ('doubleValue' in field) return parseFloat(field.doubleValue);
  if ('timestampValue' in field) return field.timestampValue;
  if ('mapValue' in field) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) {
      res[k] = parseFirestoreField(v);
    }
    return res;
  }
  if ('arrayValue' in field) {
    return (field.arrayValue.values || []).map(parseFirestoreField);
  }
  return null;
}

function parseFirestoreDoc(doc: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!doc || !doc.fields) return result;
  for (const [key, value] of Object.entries(doc.fields)) {
    result[key] = parseFirestoreField(value);
  }
  return result;
}

export async function syncAllFirestoreProfiles() {
  console.log('🔄 [Firestore Sync] Fetching all profiles from Firestore REST API...');

  const configPath = path.resolve(process.cwd(), '../firebase-applet-config.json');
  const localConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const targetPath = fs.existsSync(localConfigPath) ? localConfigPath : (fs.existsSync(configPath) ? configPath : null);

  if (!targetPath) {
    console.error('❌ Could not find firebase-applet-config.json');
    return;
  }

  const cfg = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  const projectId = cfg.projectId || 'aeirmist-d4dd8';
  const apiKey = cfg.apiKey;

  if (!apiKey) {
    console.error('❌ Missing apiKey in config');
    return;
  }

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let pageToken = '';

  do {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/profiles?pageSize=100&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`❌ Firestore REST request failed: ${res.status} ${res.statusText}`);
      break;
    }
    const data = await res.json();
    const docs = data.documents || [];

    for (const d of docs) {
      totalProcessed++;
      const docName = d.name.split('/').pop() || '';
      const cleanUid = docName.startsWith('profile_') ? docName.replace('profile_', '') : docName;
      const parsed = parseFirestoreDoc(d);

      const uid = parsed.uid || parsed.ownerUid || cleanUid;
      const displayName = parsed.displayName || parsed.fullName || parsed.username || `User ${uid.slice(0, 6)}`;
      const rawUsername = parsed.username || parsed.usernameNormalized || `user_${uid.slice(0, 8)}`;
      const email = (parsed.email || parsed.personalEmail || `${uid.toLowerCase()}@firebase.aeirmist.social`).toLowerCase().trim();
      const photoURL = parsed.photoURL || parsed.avatarKey || parsed.avatar || null;
      const bannerURL = parsed.bannerURL || parsed.coverURL || null;
      const bio = parsed.bio || parsed.tagline || null;

      // Auto-provision user row safely
      const user = await UserDAL.autoProvisionFromFirebase({
        sub: uid,
        email,
        emailVerified: true,
        name: displayName,
        picture: photoURL,
      });

      if (!user) {
        console.warn(`⚠️ Skipped provisioning for ${uid}`);
        continue;
      }

      // Ensure profile has exact Firestore data
      const [existingProf] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
      if (existingProf) {
        let desiredUsername = rawUsername.toLowerCase().trim().replace(/[^a-z0-9_]/g, '').slice(0, 24);
        if (desiredUsername.length < 3) desiredUsername = `user_${uid.slice(0, 8)}`.toLowerCase();

        // Check if desired username is available or already belongs to this profile
        const [taken] = await db
          .select({ id: profiles.id, userId: profiles.userId })
          .from(profiles)
          .where(eq(profiles.username, desiredUsername))
          .limit(1);

        const canUseUsername = !taken || taken.userId === user.id;
        const finalUsername = canUseUsername ? desiredUsername : existingProf.username;

        await db
          .update(profiles)
          .set({
            displayName: String(displayName).trim().slice(0, 95),
            username: finalUsername,
            avatarKey: (photoURL ? String(photoURL).trim().slice(0, 500) : existingProf.avatarKey) || null,
            bannerKey: (bannerURL ? String(bannerURL).trim().slice(0, 500) : existingProf.bannerKey) || null,
            bio: (bio ? String(bio).trim().slice(0, 5000) : existingProf.bio) || null,
            updatedAt: new Date(),
          })
          .where(eq(profiles.id, existingProf.id));

        totalUpdated++;
      } else {
        totalCreated++;
      }
    }

    pageToken = data.nextPageToken || '';
  } while (pageToken);

  console.log(`✅ [Firestore Sync Complete] Total scanned: ${totalProcessed}, Created/Updated: ${totalUpdated}`);
}

if (require.main === module) {
  syncAllFirestoreProfiles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
