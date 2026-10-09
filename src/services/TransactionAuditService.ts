import admin from 'firebase-admin';
import { getFirestoreAdmin } from './FirebaseAdminService';
import { logger } from '@/src/utils/logger';


export interface AuditLog {
  timestamp: any;
  userId: string;
  action: string;
  details: any;
  severity: 'info' | 'warning' | 'alert' | 'critical';
  service: 'payment' | 'auth' | 'admin';
}

class TransactionAuditService {
  public async logPaymentActivity(userId: string, action: string, details: any, severity: AuditLog['severity'] = 'info') {
    const db = getFirestoreAdmin();
    try {
      await db.collection('audit_logs').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId,
        action,
        details,
        severity,
        service: 'payment'
      });
      logger.info(`[AUDIT] ${action} logged for user ${userId}`);
    } catch (e) {
      logger.error('Audit Logging failed:', e);
    }
  }

  public async getTransactionHistory(userId: string) {
    const db = getFirestoreAdmin();
    const snap = await db.collection('transactions')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .get();
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
}

export const transactionAudit = new TransactionAuditService();
