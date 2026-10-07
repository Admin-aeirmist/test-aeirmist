import { logger } from '../utils/logger';

export interface ViewMetadata {
  source: 'feed' | 'profile' | 'marketplace' | 'search' | 'hashtag' | 'link' | 'explore' | 'recommendation';
  type?: 'photo' | 'collage' | 'text' | 'video';
  duration?: number;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  watchTime?: number;
  isCompletion?: boolean;
}

class PostAnalyticsService {
  private viewCooldowns: Map<string, number> = new Map();
  private insightsCache: Map<string, any> = new Map();

  private getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
    return 'desktop';
  }

  public async trackView(postId: string, metadata: Partial<ViewMetadata>): Promise<void> {
    if (!postId) return;
    const now = Date.now();
    const lastView = this.viewCooldowns.get(postId) || 0;
    if (now - lastView < 60000) return; 

    this.viewCooldowns.set(postId, now);

    try {
      const current = this.insightsCache.get(postId) || {
        postId,
        totalViews: 0,
        viewSources: {},
        audience: { deviceTypes: {}, languages: {} },
        profileClicks: 0,
      };

      current.totalViews = (current.totalViews || 0) + 1;
      const src = metadata.source || 'feed';
      current.viewSources[src] = (current.viewSources[src] || 0) + 1;
      const dev = metadata.deviceType || this.getDeviceType();
      current.audience.deviceTypes[dev] = (current.audience.deviceTypes[dev] || 0) + 1;

      this.insightsCache.set(postId, current);
    } catch (error) {
      logger.error('Failed to track post view:', error);
    }
  }

  public async trackProfileClick(postId: string): Promise<void> {
    try {
      const current = this.insightsCache.get(postId) || { postId, profileClicks: 0 };
      current.profileClicks = (current.profileClicks || 0) + 1;
      this.insightsCache.set(postId, current);
    } catch (error) {
      logger.error('Failed to track profile click:', error);
    }
  }

  public subscribeToInsights(postId: string, callback: (data: any) => void): () => void {
    const cached = this.insightsCache.get(postId) || {
      postId,
      totalViews: 1,
      viewSources: { feed: 1 },
      audience: { deviceTypes: { desktop: 1 }, languages: { en: 1 } },
      profileClicks: 0,
    };
    callback(cached);
    return () => {};
  }
}

export const postAnalytics = new PostAnalyticsService();
