import webpush from 'web-push';
import { db } from '../db';
import { pushSubscriptions } from '../db/schema';
import { eq } from 'drizzle-orm';

// Generate VAPID keys if env vars not set — for self-hosted, we use a fixed pair
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BNryHw3FO3swns16FHD4xcpkd051iViGj_b9l0ZRXd6mgUM7EreUSU_BVopIBwbZ2Lt0_PRPshg86LJ8-p7-4rc';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'lCstp138rTwtnn6Q6FjPY3EjMj9xBiWjS9Je8zOGv7w';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@aeirmist.com';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
} catch (e) {
  console.warn('[WebPush] VAPID keys not configured, web push disabled');
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  try {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    if (subs.length === 0) return;

    const jsonPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      data: { url: payload.url || '/' },
      tag: payload.tag || 'aeirmist_push',
    });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          jsonPayload
        )
      )
    );

    // Clean up expired/invalid subscriptions
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        const err = (results[i] as PromiseRejectedResult).reason;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subs[i].id));
        }
      }
    }
  } catch (e) {
    console.error('[WebPush] sendPushToUser error:', e);
  }
}

export { VAPID_PUBLIC };
