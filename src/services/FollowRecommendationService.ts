import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc, query, limit, Firestore, serverTimestamp } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


export interface RecommendationInfo {
  userId: string;
  score: number;
  reason: string;
  breakdown: {
    mutuals: number;
    interests: number;
    engagement: number;
    visits: number;
    trending: number;
  };
}

const INTERESTS_POOL = [
  'Gaming', 'Anime', 'Technology', 'Photography', 'Fitness', 
  'Cars', 'Music', 'Fashion', 'AI', 'Programming'
];

class FollowRecommendationService {
  private localVisitsKey = 'aeirmist_recomm_visits';
  private localSearchKey = 'aeirmist_recomm_searches';
  private localDismissedKey = 'aeirmist_recomm_dismissed';
  private localInterestsKey = 'aeirmist_recomm_interests';
  private cacheKey = 'aeirmist_recomm_cache';
  private cacheExpiryKey = 'aeirmist_recomm_cache_expiry';

  /**
   * Sync local signals to Firestore for persistence
   */
  public async syncSignalsToFirestore(db: Firestore, profileId: string): Promise<void> {
    if (!db || !profileId) return;
    try {
      const interests = this.getUserInterests().slice(0, 20);
      const rawVisits = this.getProfileVisits();
      const rawSearches = this.getSearchQueries();

      // Sort and slice top 8 profiles by visit count (reduced from 10 to be safer)
      const topVisitedProfiles = Object.entries(rawVisits)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([uid]) => uid);

      // Sort and slice top 8 search terms by frequency (reduced from 10)
      const topSearchTerms = Object.entries(rawSearches)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([term]) => term);

      const summary = {
        recommendationSignals: {
          interests,
          topVisitedProfiles,
          topSearchTerms,
          lastSyncedAt: serverTimestamp()
        }
      };

      await updateDoc(doc(db, 'profiles', profileId), summary);
      logger.info(`[RecommService] Signals synced to Firestore for ${profileId}`);
    } catch (e) {
      logger.warn("[RecommService] Firestore sync failed:", e);
    }
  }

  /**
   * Hydrate local storage from remote Firestore signals if local is empty
   */
  public hydrateFromFirestoreIfEmpty(remoteSignals: any): void {
    if (!remoteSignals) return;
    try {
      const localInterests = localStorage.getItem(this.localInterestsKey);
      
      // Only run if local storage currently has NO interests saved (fresh device/browser)
      if (!localInterests) {
        if (remoteSignals.interests && Array.isArray(remoteSignals.interests)) {
          this.saveUserInterests(remoteSignals.interests);
        }

        if (remoteSignals.topVisitedProfiles && Array.isArray(remoteSignals.topVisitedProfiles)) {
          const visits: Record<string, number> = {};
          remoteSignals.topVisitedProfiles.forEach((uid: string) => {
            visits[uid] = 1; // Seed with baseline count
          });
          localStorage.setItem(this.localVisitsKey, JSON.stringify(visits));
        }

        if (remoteSignals.topSearchTerms && Array.isArray(remoteSignals.topSearchTerms)) {
          const searches: Record<string, number> = {};
          remoteSignals.topSearchTerms.forEach((term: string) => {
            searches[term] = 1; // Seed with baseline count
          });
          localStorage.setItem(this.localSearchKey, JSON.stringify(searches));
        }
        
        this.clearCache();
        logger.info("[RecommService] Local storage hydrated from Firestore signals.");
      }
    } catch (e) {
      logger.warn("[RecommService] Hydration failed:", e);
    }
  }

  /**
   * Safe getter for user's selected interests from localStorage
   */
  public getUserInterests(): string[] {
    try {
      const saved = localStorage.getItem(this.localInterestsKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      logger.warn("Could not read local interests:", e);
    }
    // Return standard default fallback interests
    return ['Technology', 'AI', 'Gaming'];
  }

  /**
   * Save user's selected interests
   */
  public saveUserInterests(interests: string[]): void {
    try {
      localStorage.setItem(this.localInterestsKey, JSON.stringify(interests));
      this.clearCache(); // Force recalculation
    } catch (e) {
      logger.error("Could not write local interests:", e);
    }
  }

  /**
   * Clear calculated recommendations cache
   */
  public clearCache(): void {
    localStorage.removeItem(this.cacheKey);
    localStorage.removeItem(this.cacheExpiryKey);
  }

  /**
   * Extract dynamic interest tags from profile details deterministically or dynamically
   */
  public extractProfileInterests(profile: any): string[] {
    const list: string[] = [];
    const bioText = (profile.bio || '').toLowerCase();
    const displayName = (profile.displayName || '').toLowerCase();
    const username = (profile.username || '').toLowerCase();

    // Scan text for standard topic markers
    if (bioText.includes('game') || bioText.includes('stream') || bioText.includes('xbox') || bioText.includes('playstation') || bioText.includes('gaming')) {
      list.push('Gaming');
    }
    if (bioText.includes('anime') || bioText.includes('manga') || bioText.includes('otaku')) {
      list.push('Anime');
    }
    if (bioText.includes('tech') || bioText.includes('gadget') || bioText.includes('cyber') || bioText.includes('hardware')) {
      list.push('Technology');
    }
    if (bioText.includes('photo') || bioText.includes('camera') || bioText.includes('shoot') || bioText.includes('lens')) {
      list.push('Photography');
    }
    if (bioText.includes('fit') || bioText.includes('gym') || bioText.includes('workout') || bioText.includes('sport') || bioText.includes('health')) {
      list.push('Fitness');
    }
    if (bioText.includes('car') || bioText.includes('auto') || bioText.includes('race') || bioText.includes('engine')) {
      list.push('Cars');
    }
    if (bioText.includes('music') || bioText.includes('track') || bioText.includes('song') || bioText.includes('sound') || bioText.includes('dj') || bioText.includes('synth')) {
      list.push('Music');
    }
    if (bioText.includes('fashion') || bioText.includes('style') || bioText.includes('outfit') || bioText.includes('wear')) {
      list.push('Fashion');
    }
    if (bioText.includes('ai') || bioText.includes('gpt') || bioText.includes('neural') || bioText.includes('model') || bioText.includes('llm')) {
      list.push('AI');
    }
    if (bioText.includes('code') || bioText.includes('dev') || bioText.includes('program') || bioText.includes('hacker') || bioText.includes('rust') || bioText.includes('typescript')) {
      list.push('Programming');
    }

    // Explicit field check
    if (profile.interests && Array.isArray(profile.interests)) {
      profile.interests.forEach((ins: string) => {
        if (INTERESTS_POOL.includes(ins) && !list.includes(ins)) {
          list.push(ins);
        }
      });
    }

    // Add deterministic fallbacks if none are found so that suggestion matching is active & relevant
    if (list.length === 0) {
      const idx1 = Math.abs(this.hashCode(profile.id || profile.uid || 'node1')) % INTERESTS_POOL.length;
      const idx2 = (idx1 + 3) % INTERESTS_POOL.length;
      list.push(INTERESTS_POOL[idx1]);
      list.push(INTERESTS_POOL[idx2]);
    }

    return list;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Monitor locally viewed profiles to record signals
   */
  public recordProfileVisit(targetUid: string): void {
    if (!targetUid) return;
    try {
      const visits = this.getProfileVisits();
      visits[targetUid] = (visits[targetUid] || 0) + 1;
      localStorage.setItem(this.localVisitsKey, JSON.stringify(visits));
      this.clearCache(); // Invalidate cached scores
    } catch (e) {
      logger.warn("Could not record profile visit signal:", e);
    }
  }

  private getProfileVisits(): Record<string, number> {
    try {
      const saved = localStorage.getItem(this.localVisitsKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }

  /**
   * Record search term signals
   */
  public recordSearchQuery(queryVal: string): void {
    if (!queryVal || queryVal.trim().length < 2) return;
    try {
      const searches = this.getSearchQueries();
      const term = queryVal.trim().toLowerCase();
      searches[term] = (searches[term] || 0) + 1;
      localStorage.setItem(this.localSearchKey, JSON.stringify(searches));
      this.clearCache();
    } catch (e) {
      logger.warn("Could not record search signal:", e);
    }
  }

  private getSearchQueries(): Record<string, number> {
    try {
      const saved = localStorage.getItem(this.localSearchKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }

  /**
   * Dismiss suggesting a profile
   */
  public dismissSuggestion(targetUid: string): void {
    if (!targetUid) return;
    try {
      const dismissed = this.getDismissedSuggestions();
      dismissed.push(targetUid);
      localStorage.setItem(this.localDismissedKey, JSON.stringify(dismissed));
      this.clearCache();
    } catch (e) {
      logger.warn("Could not record dismissal:", e);
    }
  }

  public getDismissedSuggestions(): string[] {
    try {
      const saved = localStorage.getItem(this.localDismissedKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Principal Advanced Scoring Algorithm
   * Computes localized relevancy score
   */
  public calculateRecommendationScore(
    myProfile: any,
    candidate: any,
    allCandidateIdsFollowedByMyConnections: Set<string>,
    connectionToFollowedMap: Record<string, string[]>, 
    communityIdsJoined?: string[]
  ): RecommendationInfo {
    const visits = this.getProfileVisits();
    const searches = this.getSearchQueries();
    
    // 1. MUTUAL CONNECTIONS (40% Weight Max)
    const myFollowing = myProfile?.social?.following || [];
    const candidateFollowers = candidate?.social?.followers || [];
    const candidateFollowing = candidate?.social?.following || [];

    // Find intersection in following (direct mutuals)
    const mutualFollowers = myFollowing.filter((uid: string) => candidateFollowers.includes(uid));
    const mutualFollowing = myFollowing.filter((uid: string) => candidateFollowing.includes(uid));
    const unionMutualCount = Array.from(new Set([...mutualFollowers, ...mutualFollowing])).length;

    // Scoring scaling: we cap perfect mutual score at 5 connections
    const mutualRawScore = unionMutualCount > 0 ? Math.min(100, (unionMutualCount / 5) * 100) : 0;
    const mutualsWeighted = mutualRawScore * 0.40;

    // 2. INTEREST MATCHING (25% Weight Max)
    const myInterests = this.getUserInterests();
    const candidateInterests = this.extractProfileInterests(candidate);
    const matchedInterests = myInterests.filter(i => candidateInterests.includes(i));
    
    const interestRawScore = myInterests.length > 0 
      ? (matchedInterests.length / Math.min(4, myInterests.length)) * 100 
      : 0;
    const interestsNormalized = Math.min(100, interestRawScore);
    const interestsWeighted = interestsNormalized * 0.25;

    // 3. ENGAGEMENT SIMILIARITY (15% Weight Max)
    // Joined communities similarity OR dynamic hashtag search
    let engagementRawScore = 0;

    // Same joined communities?
    if (communityIdsJoined && communityIdsJoined.length > 0 && candidate.joinedCommunities && Array.isArray(candidate.joinedCommunities)) {
      const sharedComms = communityIdsJoined.filter(id => candidate.joinedCommunities.includes(id));
      engagementRawScore += (sharedComms.length / Math.max(1, communityIdsJoined.length)) * 70;
    }

    // Search query matches (does their name / bio contain searched terms?)
    const searchTerms = Object.keys(searches);
    let searchMatchCount = 0;
    searchTerms.forEach(term => {
      const bioText = (candidate.bio || '').toLowerCase();
      const displayName = (candidate.displayName || '').toLowerCase();
      const username = (candidate.username || '').toLowerCase();
      if (bioText.includes(term) || displayName.includes(term) || username.includes(term)) {
        searchMatchCount += searches[term]; // Boost based on search frequency
      }
    });
    engagementRawScore += Math.min(30, searchMatchCount * 10);
    engagementRawScore = Math.min(100, engagementRawScore);
    const engagementWeighted = engagementRawScore * 0.15;

    // 4. PROFILE VISITS (10% Weight Max)
    const visitCount = visits[candidate.id || candidate.uid] || 0;
    const visitRawScore = Math.min(100, (visitCount / 4) * 100); // 4+ visits gives full visits rank block
    const visitsWeighted = visitRawScore * 0.10;

    // 5. TRENDING / CORE STABILITY (10% Weight Max)
    let trendingRawScore = 30; // base value
    if (candidate.isVerified) trendingRawScore += 30;
    if (candidate.aeirmistLevel && candidate.aeirmistLevel > 500) trendingRawScore += 20;
    if (candidate.postsCount && candidate.postsCount > 10) trendingRawScore += 20;
    
    const trendingWeighted = Math.min(100, trendingRawScore) * 0.10;

    // Sum overall score
    const score = Math.round(mutualsWeighted + interestsWeighted + engagementWeighted + visitsWeighted + trendingWeighted);

    // Formulate a dynamic explanation context
    let reason = "Popular in your Network";
    if (unionMutualCount > 0) {
      reason = unionMutualCount === 1 
        ? "Followed by 1 person you know" 
        : `Followed by ${unionMutualCount} people you know`;
    } else if (matchedInterests.length > 0) {
      reason = `Interested in ${matchedInterests.slice(0, 2).join(' & ')}`;
    } else if (visitCount > 1) {
      reason = "Interacted frequently with profile";
    } else if (candidate.isVerified) {
      reason = "Trending on Aeirmist";
    }

    return {
      userId: candidate.id || candidate.uid,
      score: Math.max(5, score), // Floor at 5 to keep ordering natural
      reason,
      breakdown: {
        mutuals: Math.round(mutualsWeighted),
        interests: Math.round(interestsWeighted),
        engagement: Math.round(engagementWeighted),
        visits: Math.round(visitsWeighted),
        trending: Math.round(trendingWeighted)
      }
    };
  }
}

export const followRecommService = new FollowRecommendationService();
