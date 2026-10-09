import Stripe from 'stripe';
import { getFirestoreAdmin, admin } from './FirebaseAdminService';
import { transactionAudit } from './TransactionAuditService';
import { logger } from '@/src/utils/logger';


let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      logger.warn('STRIPE_SECRET_KEY environment variable is missing. Initialization in safe sandbox mode.');
      return null;
    }
    stripeClient = new Stripe(key, {
      apiVersion: '2025-01-27-acacia' as any,
    });
  }
  return stripeClient;
}

export const PAYMENT_CONFIG = {
  PREMIUM: {
    price_id: 'price_premium_placeholder',
    amount: 1999, // $19.99
    currency: 'usd',
    name: 'Aeirmist Premium Upgrade',
    type: 'premium'
  },
  VERIFIED_BADGE: {
    price_id: 'price_verified_placeholder',
    amount: 499, // $4.99
    currency: 'usd',
    name: 'Aeirmist Verified Badge',
    type: 'verified'
  }
};

export async function createAeirmistCheckoutSession(userId: string, type: 'premium' | 'verified', successUrl: string, cancelUrl: string) {
  const db = getFirestoreAdmin();
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  if (type === 'premium' && userData?.isPremium) {
    throw new Error("ALREADY_PREMIUM");
  }
  if (type === 'verified' && userData?.isVerified) {
    throw new Error("ALREADY_VERIFIED");
  }

  const stripe = getStripe();
  if (!stripe) {
    throw new Error("STRIPE_SYSTEM_OFFLINE");
  }
  const config = type === 'premium' ? PAYMENT_CONFIG.PREMIUM : PAYMENT_CONFIG.VERIFIED_BADGE;

  // Audit Logging: Pre-checkout attempt
  await transactionAudit.logPaymentActivity(userId, 'CHECKOUT_INITIATED', {
    type,
    amount: config.amount,
    currency: config.currency
  });

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: config.currency,
          product_data: {
            name: config.name,
          },
          unit_amount: config.amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment', 
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    metadata: {
      userId,
      type
    }
  };

  // Idempotency Key: payment_${userId}_${type}_${Math.floor(Date.now() / 3600000)} 
  // (Changes every hour to allow retries but prevent rapid double clicks)
  const idempotencyKey = `checkout_${userId}_${type}_${Math.floor(Date.now() / 60000)}`; // 1 minute window

  return await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey
  });
}

export async function handleStripeEvent(event: Stripe.Event) {
  const db = getFirestoreAdmin();
  
  // Idempotency: Prevent duplicate processing
  const eventId = event.id;
  const processedEventRef = db.collection('processed_events').doc(eventId);
  const processedEventDoc = await processedEventRef.get();
  
  if (processedEventDoc.exists) {
    logger.info(`Message Already Processed: ${eventId}`);
    return;
  }

  // Register event for idempotency
  await processedEventRef.set({
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    type: event.type
  });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const type = session.metadata?.type;

      if (!userId) {
        logger.error('No userId found in checkout session');
        return;
      }

      logger.info(`Transaction Verified: ${type} for User ${userId}`);

      // Transaction Logging (Detailed Ledger)
      await db.collection('transaction_logs').add({
        userId,
        stripeSessionId: session.id,
        paymentType: type,
        amount: session.amount_total,
        currency: session.currency,
        status: 'completed',
        purchaseTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: session.metadata
      });

      // Audit Logging
      await transactionAudit.logPaymentActivity(userId, 'PURCHASE_COMPLETED', {
        sessionId: session.id,
        type,
        amount: session.amount_total
      });

      // Status Activation logic
      const userUpdate: Record<string, any> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const profileUpdate: Record<string, any> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (type === 'premium') {
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + 1); // 1 month premium tier
        userUpdate.isPremium = true;
        userUpdate.premiumUntil = expirationDate.toISOString();
        profileUpdate.isPremium = true;
      } else if (type === 'verified') {
        // Special logic: Verification can be instant or pending review
        // For this implementation, we grant it but mark as 'active' status
        userUpdate.isVerified = true;
        userUpdate.verificationStatus = 'active'; 
        profileUpdate.isVerified = true;
      }

      await db.collection('users').doc(userId).update(userUpdate);

      // Multi-profile Sync Activation
      const profilesSnap = await db.collection('profiles').where('ownerUid', '==', userId).get();
      if (!profilesSnap.empty) {
        const batch = db.batch();
        profilesSnap.docs.forEach(doc => {
          batch.update(doc.ref, profileUpdate);
        });
        await batch.commit();
        logger.info(`Profiles Swapped: Syncing ${profilesSnap.size} users.`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId; // Ensure we pass this on sub creation

      if (userId) {
        await db.collection('users').doc(userId).update({
          isPremium: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      break;
    }
    
    // Add more cases as needed (refunds, failures)
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const userId = charge.metadata.userId; 
      
      if (userId) {
        logger.info(`Refund Message: Reversing access for user ${userId}`);
        
        await db.collection('users').doc(userId).update({
          isPremium: false,
          isVerified: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Multi-profile Sync Access Revocation
        const profilesSnap = await db.collection('profiles').where('ownerUid', '==', userId).get();
        if (!profilesSnap.empty) {
          const batch = db.batch();
          profilesSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
              isPremium: false,
              isVerified: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          });
          await batch.commit();
          logger.info(`Refund Processed: Revoking access for ${profilesSnap.size} users.`);
        }

        // Audit Logging
        await transactionAudit.logPaymentActivity(userId, 'REFUND_PROCESSED', {
          chargeId: charge.id,
          amount: charge.amount_refunded
        }, 'warning');
      }
      break;
    }
  }
}
