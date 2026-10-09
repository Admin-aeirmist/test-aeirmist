import { 
  doc, 
  setDoc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  collection, 
  addDoc, 
  getDoc,
  query,
  where,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { logger } from '@/src/utils/logger';


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
  private SESSION_ID = Math.random().toString(36).substring(7);

  private getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'mobile';
    return 'desktop';
  }

  public async trackView(postId: string, metadata: Partial<ViewMetadata>) {
    const user = auth.currentUser;
    if (!user) return;

    // Anti-Spam: 1 minute cooldown per post view in the same session
    const now = Date.now();
    const lastView = this.viewCooldowns.get(postId) || 0;
    if (now - lastView < 60000) return; 

    this.viewCooldowns.set(postId, now);

    try {
      const viewData = {
        postId,
        viewerUid: user.uid,
        sessionId: this.SESSION_ID,
        source: metadata.source || 'feed',
        duration: metadata.duration || 0,
        deviceType: metadata.deviceType || this.getDeviceType(),
        timestamp: serverTimestamp(),
      };

      // 1. Log the individual view event
      await addDoc(collection(db, 'post_views'), viewData);

      // 2. Increment global counters in the post document for quick display
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        viewsCount: increment(1)
      });

      // 3. Update Aggregated Insights using setDoc with merge to avoid read-permission requirements
      const insightRef = doc(db, 'post_insights', postId);
      const deviceType = viewData.deviceType;
      const source = viewData.source;

      await setDoc(insightRef, {
        postId,
        totalViews: increment(1),
        [`viewSources.${source}`]: increment(1),
        [`audience.deviceTypes.${deviceType}`]: increment(1),
        [`audience.languages.${navigator.language}`]: increment(1),
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      logger.error('Failed to track post view:', error);
    }
  }

  public async trackProfileClick(postId: string) {
    try {
      const insightRef = doc(db, 'post_insights', postId);
      await setDoc(insightRef, {
        profileClicks: increment(1),
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      logger.error('Failed to track profile click:', error);
    }
  }

  public subscribeToInsights(postId: string, callback: (data: any) => void) {
    return onSnapshot(doc(db, 'post_insights', postId), (doc) => {
      if (doc.exists()) {
        callback(doc.data());
      } else {
        callback(null);
      }
    });
  }
}

export const postAnalytics = new PostAnalyticsService();
