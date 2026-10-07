import { api } from '../services/api/client';
import { logger } from '../utils/logger';

export async function cleanDeletedAccountPosts(): Promise<void> {
  logger.info('Clean posts utility ready (self-hosted PostgreSQL backend)');
}
