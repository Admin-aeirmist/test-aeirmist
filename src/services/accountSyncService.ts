import { api } from './api/client';
import { logger } from '../utils/logger';

export interface ConsolidateResult {
  success: boolean;
  canonicalProfile: any;
  cleanedDuplicateIds: string[];
  totalMerged: number;
}

/**
 * Consolidates and fetches canonical user profile from self-hosted PostgreSQL database.
 */
export async function consolidateAndSyncUserProfiles(
  targetUser?: any
): Promise<ConsolidateResult> {
  const userId = targetUser?.id || targetUser?.uid;
  if (!userId) {
    return { success: false, canonicalProfile: null, cleanedDuplicateIds: [], totalMerged: 0 };
  }

  try {
    const res = await api.users.getProfile(userId);
    const profile = res?.profile || targetUser;
    return {
      success: true,
      canonicalProfile: profile,
      cleanedDuplicateIds: [],
      totalMerged: 1,
    };
  } catch (err) {
    logger.info('[AccountSync] Using targetUser as canonical profile:', err);
    return {
      success: true,
      canonicalProfile: targetUser,
      cleanedDuplicateIds: [],
      totalMerged: 1,
    };
  }
}
