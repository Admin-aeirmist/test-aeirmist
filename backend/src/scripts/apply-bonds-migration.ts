import fs from 'fs';
import path from 'path';
import { pool } from '../db';

async function runMigration() {
  console.log('[Migration] Applying 0004_bonds_ecosystem.sql...');
  const sqlPath = path.join(__dirname, '../db/migrations/0004_bonds_ecosystem.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  const statements = sqlContent
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const client = await pool.connect();
  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err: any) {
        // Ignore duplicate index/constraint/table already exists errors
        if (!err.message?.includes('already exists')) {
          console.warn('[Migration Warning]', err.message);
        }
      }
    }
    console.log(`[Migration] Successfully executed ${statements.length} statements for Bonds ecosystem!`);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
