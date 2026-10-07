import { eq } from 'drizzle-orm';
import { db, pool } from '../db';
import { users, profiles, posts } from '../db/schema';
import { hashPassword } from '../lib/auth';

async function seed() {
  const args = process.argv.slice(2);
  const countArg = args.find((a) => a.startsWith('--count='));
  const count = countArg ? parseInt(countArg.split('=')[1], 10) : 5000;

  console.log(`🌱 [Seed] Preparing to seed database with ${count} records...`);

  // 1. Create or ensure test user exists
  const testEmail = 'demo@aeirmist.com';
  let [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);

  if (!user) {
    const passwordHash = await hashPassword('password123');
    [user] = await db.insert(users).values({
      email: testEmail,
      passwordHash,
      role: 'user',
    }).returning();

    await db.insert(profiles).values({
      userId: user.id,
      username: 'demo_user',
      displayName: 'Demo User',
    });
  }

  console.log(`👤 Using demo user: ${user.id}`);

  // 2. Batch insert posts in chunks of 1000
  const CHUNK_SIZE = 1000;
  const chunks = Math.ceil(count / CHUNK_SIZE);
  console.log(`📦 Inserting ${count} posts in ${chunks} batch(es)...`);

  const startTime = Date.now();
  for (let i = 0; i < chunks; i++) {
    const batch = [];
    const currentBatchSize = Math.min(CHUNK_SIZE, count - i * CHUNK_SIZE);

    for (let j = 0; j < currentBatchSize; j++) {
      const idx = i * CHUNK_SIZE + j;
      batch.push({
        userId: user.id,
        content: `Synthetic stress-test post #${idx} exploring the decentralized social graph on Aeirmist with high concurrency and indexing.`,
        mediaType: 'none',
        visibility: 'public',
        likesCount: Math.floor(Math.random() * 500),
        commentsCount: Math.floor(Math.random() * 50),
        tags: ['aeirmist', 'test', 'scaling'],
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 86400 * 1000)),
      });
    }

    await db.insert(posts).values(batch);
    process.stdout.write(`\r   Progress: ${Math.min((i + 1) * CHUNK_SIZE, count)} / ${count} posts inserted`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Finished inserting ${count} posts in ${duration}s!`);

  // 3. Performance Test: Benchmark feed query with EXPLAIN ANALYZE
  console.log('\n📊 Running EXPLAIN ANALYZE on index-backed feed query...');
  const explain = await pool.query(`
    EXPLAIN ANALYZE
    SELECT * FROM posts
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 20;
  `);

  console.log('--- Query Plan ---');
  explain.rows.forEach((r) => console.log(r['QUERY PLAN']));
  console.log('------------------\n');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
