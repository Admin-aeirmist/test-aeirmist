import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { users, profiles, posts, comments, postLikes, conversations, conversationMembers, messages } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

interface FirestoreExportData {
  users?: Record<string, any>;
  profiles?: Record<string, any>;
  posts?: Record<string, any>;
  conversations?: Record<string, any>;
}

async function runMigration() {
  console.log('🚀 [Data Migration] Starting Firestore -> PostgreSQL Migration...');

  const exportFilePath = path.resolve(process.cwd(), 'firestore-export.json');
  if (!fs.existsSync(exportFilePath)) {
    console.log(`ℹ️ No 'firestore-export.json' found at ${exportFilePath}.`);
    console.log(`   To run migration, place exported Firestore JSON in the backend folder or provide via path.`);
    console.log(`   Example format: { "users": {...}, "profiles": {...}, "posts": {...} }`);
    return;
  }

  const rawData = fs.readFileSync(exportFilePath, 'utf8');
  const data: FirestoreExportData = JSON.parse(rawData);

  let userCount = 0;
  let postCount = 0;
  let commentCount = 0;

  // 1. Migrate Users & Profiles
  if (data.profiles) {
    console.log('📦 Migrating Profiles & Users...');
    for (const [profileId, p] of Object.entries(data.profiles)) {
      try {
        const email = p.email || `${p.username || profileId}@migrated.aeirmist.social`;
        const uid = p.ownerUid || p.uid || profileId;

        // Upsert User
        const [user] = await db
          .insert(users)
          .values({
            email: email.toLowerCase().trim(),
            firebaseUid: uid,
            passwordAlgorithm: 'firebase_scrypt',
            passwordHash: p.passwordHash || null,
            passwordSalt: p.passwordSalt || null,
            role: p.role || 'user',
            status: p.status || 'ACTIVE',
          })
          .onConflictDoUpdate({
            target: users.email,
            set: { firebaseUid: uid },
          })
          .returning();

        // Upsert Profile
        const username = (p.username || `user_${uid.slice(0, 8)}`).toLowerCase().trim();
        await db
          .insert(profiles)
          .values({
            userId: user.id,
            username,
            displayName: p.displayName || p.name || username,
            bio: p.bio || null,
            avatarKey: p.avatarKey || p.avatar || null,
            bannerKey: p.bannerKey || p.coverUrl || null,
            isVerified: Boolean(p.isVerified || p.verified),
            points: Number(p.points || p.aeirmistPoints || 0),
          })
          .onConflictDoNothing();

        userCount++;
      } catch (err: any) {
        console.warn(`⚠️ Skipped profile ${profileId}:`, err.message);
      }
    }
  }

  // 2. Migrate Posts
  if (data.posts) {
    console.log('📦 Migrating Posts...');
    for (const [postId, p] of Object.entries(data.posts)) {
      try {
        const authorUid = p.userId || p.authorId || p.ownerUid;
        if (!authorUid) continue;

        // Lookup user by firebaseUid
        const [author] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.firebaseUid, authorUid))
          .limit(1);

        if (!author) continue;

        const [post] = await db
          .insert(posts)
          .values({
            userId: author.id,
            content: p.content || p.caption || '',
            mediaKeys: p.mediaKeys || p.mediaUrls || [],
            mediaType: p.mediaType || 'none',
            likesCount: Number(p.likesCount || (Array.isArray(p.likes) ? p.likes.length : 0)),
            commentsCount: Number(p.commentsCount || 0),
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          })
          .returning();

        postCount++;

        // Migrate embedded comments if present
        if (Array.isArray(p.comments)) {
          for (const c of p.comments) {
            const [commenter] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.firebaseUid, c.userId))
              .limit(1);

            if (commenter) {
              await db.insert(comments).values({
                postId: post.id,
                userId: commenter.id,
                content: c.text || c.content || '',
                createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
              });
              commentCount++;
            }
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ Skipped post ${postId}:`, err.message);
      }
    }
  }

  console.log('\n=============================================');
  console.log('🎉 [Migration Complete] Summary:');
  console.log(`   - Users/Profiles migrated: ${userCount}`);
  console.log(`   - Posts migrated: ${postCount}`);
  console.log(`   - Comments migrated: ${commentCount}`);
  console.log('=============================================\n');
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}
