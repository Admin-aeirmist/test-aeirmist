import Stripe from 'stripe';
import { transactionAudit } from './TransactionAuditService';
import { logger } from '../utils/logger';

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

  const idempotencyKey = `checkout_${userId}_${type}_${Math.floor(Date.now() / 60000)}`;

  return await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey
  });
}

export async function handleStripeEvent(event: Stripe.Event) {
  const eventId = event.id;
  logger.info(`Handling Stripe event ${eventId}: ${event.type}`);

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

      await transactionAudit.logPaymentActivity(userId, 'PURCHASE_COMPLETED', {
        sessionId: session.id,
        type,
        amount: session.amount_total
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (userId) {
        logger.info(`Subscription cancelled for user ${userId}`);
      }
      break;
    }
    
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const userId = charge.metadata?.userId; 
      
      if (userId) {
        logger.info(`Refund Message: Reversing access for user ${userId}`);
        await transactionAudit.logPaymentActivity(userId, 'REFUND_PROCESSED', {
          chargeId: charge.id,
          amount: charge.amount_refunded
        }, 'warning');
      }
      break;
    }
  }
}
