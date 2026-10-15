import { db } from '../db';
import { loginSessions } from '../db/schema';
import { parseUserAgent } from '../utils/deviceParser';
import { resolveIpLocation } from '../utils/geoIp';
import { eq } from 'drizzle-orm';

async function backfill() {
  console.log('🔄 Starting backfill of login_sessions...');
  const rows = await db.select().from(loginSessions);
  let count = 0;

  for (const row of rows) {
    const parsed = parseUserAgent(row.userAgent, row.deviceName?.replace(/•.*$/, '').trim());
    
    // Resolve location from IP if missing or hardcoded
    let finalLocation = row.location;
    if (!finalLocation || finalLocation.trim() === '' || finalLocation === 'Dhaka, Bangladesh') {
      const geo = await resolveIpLocation(row.ipAddress);
      if (geo && geo.formatted) {
        finalLocation = geo.formatted;
      }
    }

    const cleanDeviceName = `${parsed.model} · ${parsed.browser}`;

    await db
      .update(loginSessions)
      .set({
        model: parsed.model,
        browser: parsed.browser,
        os: parsed.os,
        deviceType: parsed.deviceType,
        deviceName: cleanDeviceName,
        location: finalLocation || 'Dhaka, Bangladesh',
      })
      .where(eq(loginSessions.id, row.id));

    count++;
  }

  console.log(`✅ Successfully backfilled ${count} sessions!`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error('❌ Backfill error:', err);
  process.exit(1);
});
