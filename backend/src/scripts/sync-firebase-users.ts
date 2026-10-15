import { getAuth, ListUsersResult, UserRecord } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '../lib/firebaseAdmin';
import { UserDAL } from '../dal/user.dal';

async function runSync() {
  const isDryRun = process.argv.includes('--dry-run');
  const modeLabel = isDryRun ? 'DRY-RUN (No changes applied)' : 'LIVE SYNC (Idempotent Provisioning)';

  console.log('================================================================');
  console.log(`AEIRMIST FIREBASE AUTH -> POSTGRESQL USER SYNC`);
  console.log(`Mode: ${modeLabel}`);
  console.log('================================================================\n');

  const app = getFirebaseAdmin();
  if (!app) {
    console.error('❌ Failed to initialize Firebase Admin SDK. Please check configuration.');
    process.exit(1);
  }

  const auth = getAuth(app);

  let totalAudited = 0;
  let alreadyExisted = 0;
  let created = 0;
  let skipped = 0;

  let nextPageToken: string | undefined = undefined;

  try {
    do {
      const listResult: ListUsersResult = await auth.listUsers(1000, nextPageToken);
      for (const u of listResult.users as UserRecord[]) {
        totalAudited++;

        // Skip disabled or deleted accounts
        if (u.disabled) {
          skipped++;
          continue;
        }

        if (!u.uid) {
          skipped++;
          continue;
        }

        // Check if user already exists in PostgreSQL
        const existing = await UserDAL.findByFirebaseUid(u.uid);
        if (existing) {
          alreadyExisted++;
          continue;
        }

        if (isDryRun) {
          created++;
        } else {
          try {
            const provisioned = await UserDAL.autoProvisionFromFirebase({
              sub: u.uid,
              email: u.email,
              emailVerified: u.emailVerified,
              name: u.displayName,
              picture: u.photoURL,
            });

            if (provisioned) {
              created++;
            } else {
              skipped++;
            }
          } catch (err: any) {
            console.warn(`[Sync Warning] Failed to provision user UID ending in ...${u.uid.slice(-6)}:`, err?.message);
            skipped++;
          }
        }
      }

      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    console.log('\n================================================================');
    console.log('SYNC SUMMARY:');
    console.log(`  Total Firebase Users Audited: ${totalAudited}`);
    console.log(`  Already Existed in Postgres:  ${alreadyExisted}`);
    console.log(`  ${isDryRun ? 'Would Provision (Missing):' : 'Successfully Created:'}      ${created}`);
    console.log(`  Skipped (Disabled/Invalid):   ${skipped}`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error during Firebase user sync:', err?.message || err);
    process.exit(1);
  }
}

runSync();
