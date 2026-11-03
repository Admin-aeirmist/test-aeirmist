const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve('D:/Aeirmist/.env') });
require('dotenv').config({ path: path.resolve('D:/Aeirmist/backend/.env') });

const dbUrl = process.env.DATABASE_URL || 'postgres://aeirmist:aeirmist_secure_2026@127.0.0.1:5432/aeirmist';
const pool = new Pool({ connectionString: dbUrl });

async function migrateAccountId() {
  const client = await pool.connect();
  try {
    console.log("=== STARTING 11-DIGIT ACCOUNT ID MIGRATION ===");
    await client.query('BEGIN');

    // 1. Add account_id to users and profiles
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id VARCHAR(16);
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_id VARCHAR(16);
    `);

    // 2. Create unique indexes if not exist
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_account_id ON profiles(account_id);
    `);

    // 3. Create sequence for 11-digit Account IDs starting at 10000000100
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS user_account_id_seq 
      START WITH 10000000100 
      INCREMENT BY 1 
      MINVALUE 10000000001 
      MAXVALUE 99999999999;
    `);

    // 4. Specifically assign 10000000001 to founder/admin Junaed Islam Jim
    const adminEmail = 'junaedislamjim180@gmail.com';
    const adminUserRes = await client.query(`SELECT id FROM users WHERE email = $1`, [adminEmail]);
    if (adminUserRes.rows.length > 0) {
      const adminUserId = adminUserRes.rows[0].id;
      const adminAccountId = '10000000001';
      await client.query(`UPDATE users SET account_id = $1 WHERE id = $2`, [adminAccountId, adminUserId]);
      await client.query(`UPDATE profiles SET account_id = $1 WHERE user_id = $2`, [adminAccountId, adminUserId]);
      console.log(`Assigned 11-digit Account ID ${adminAccountId} to Founder/Admin (${adminEmail})`);
    }

    // 5. Backfill all remaining users with sequential 11-digit IDs
    const unassignedUsers = await client.query(`
      SELECT id, email FROM users 
      WHERE account_id IS NULL OR account_id = '' 
      ORDER BY created_at ASC
    `);

    let assignedCount = 0;
    for (const u of unassignedUsers.rows) {
      const seqRes = await client.query(`SELECT nextval('user_account_id_seq') AS next_id`);
      const nextAccountId = String(seqRes.rows[0].next_id);
      await client.query(`UPDATE users SET account_id = $1 WHERE id = $2`, [nextAccountId, u.id]);
      await client.query(`UPDATE profiles SET account_id = $1 WHERE user_id = $2`, [nextAccountId, u.id]);
      assignedCount++;
    }

    console.log(`Assigned 11-digit Account IDs to ${assignedCount} existing users.`);

    // 6. Verify backfill
    const verifyRes = await client.query(`
      SELECT u.id, u.email, u.account_id, p.username, p.display_name, p.account_id as p_account_id 
      FROM users u 
      LEFT JOIN profiles p ON u.id = p.user_id 
      WHERE u.email = $1 OR u.account_id = '10000000001'
    `, [adminEmail]);

    console.log("Verified Admin Record:", JSON.stringify(verifyRes.rows, null, 2));

    await client.query('COMMIT');
    console.log("=== 11-DIGIT ACCOUNT ID MIGRATION SUCCESSFUL ===");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed, rolled back:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateAccountId();
