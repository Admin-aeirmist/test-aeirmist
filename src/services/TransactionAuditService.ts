import { logger } from '../utils/logger';

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
    logger.info(`[AUDIT] [${severity.toUpperCase()}] ${action} for user ${userId}`, details);
  }

  public async getTransactionHistory(_userId: string) {
    return [];
  }
}

export const transactionAudit = new TransactionAuditService();
