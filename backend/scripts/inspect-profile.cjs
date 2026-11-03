const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve('D:/Aeirmist/.env') });
require('dotenv').config({ path: path.resolve('D:/Aeirmist/backend/.env') });

const dbUrl = process.env.DATABASE_URL || 'postgres://aeirmist:aeirmist_secure_2026@127.0.0.1:5432/aeirmist';
const pool = new Pool({ connectionString: dbUrl });

async function listAll() {
  try {
    const res = await pool.query(
      `SELECT u.id, u.email, u.role, p.id as profile_id, p.username, p.display_name 
       FROM users u 
       LEFT JOIN profiles p ON u.id = p.user_id 
       ORDER BY u.created_at ASC`
    );
    console.log("TOTAL USERS:", res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("ERR:", err);
  } finally {
    await pool.end();
  }
}
listAll();
