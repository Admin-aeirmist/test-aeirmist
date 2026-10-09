import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Play, MessageSquare, Heart, Zap, Sparkles, Loader2 } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { collection, query, where, limit, onSnapshot, orderBy } from 'firebase/firestore';

import { getAvatarUrl } from '../../lib/avatar';
import { logger } from '@/src/utils/logger';


interface ExploreGridProps {
  category: string;
  onUserClick?: (user: any) => void;
}

export const ExploreGrid: React.FC<ExploreGridProps> = ({ category, onUserClick }) => {
  const { db, user, profile, addToast } = useAeirmist();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!db || !user) return;

    setLoading(true);
    // Fetch posts that have media
    const q = query(
      collection(db, 'posts'),
      where('mediaUrls', '!=', []),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const blockedList = new Set(profile?.social?.blocked || []);
      const fetchedItems = snapshot.docs.map(doc => {
        const data = doc.data();
        const authorId = data.authorId || data.userId || data.author?.id || '';
        const authorUid = data.authorUid || data.author?.uid || '';

        if (blockedList.has(authorId) || blockedList.has(authorUid)) {
          return null;
        }

        const isDeleted = Boolean(
          data.isDeletedAuthor ||
          data.scheduledForPurge ||
          data.isDeleted ||
          data.hidden ||
          data.authorName === 'Aeirmist User' ||
          data.userName === 'Aeirmist User' ||
          data.author?.name === 'Aeirmist User'
        );
        if (isDeleted) return null;
        return {
          id: doc.id,
          type: data.mediaType || 'image',
          url: data.mediaUrls?.[0] || '',
          likes: data.likesCount || 0,
          comments: data.commentsCount || 0,
          author: data.author?.username || data.userName || 'Anonymous',
          authorDisplayName: data.author?.displayName || data.author?.username || 'User',
          authorId: data.authorId || data.userId || '',
          authorAvatar: getAvatarUrl(data.author?.photoURL || data.userAvatar || '', data.author?.username || data.userName || 'Anonymous')
        };
      }).filter(Boolean) as any[];
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      logger.error("Explore grid fetch error:", error);
      setLoading(false);
      addToast({
        title: "Explore Sync Interrupted",
        message: "Failed to fetch grid media. Retrying Link...",
        type: "warning"
      });
      if (retryCount < 5) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 5000);
      }
    });

    return () => unsubscribe();
  }, [db, user, category, retryCount]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-20">
        <Loader2 size={48} className="animate-spin text-aeirmist-cyan mb-4" />
        <p className="font-display font-black uppercase tracking-[0.3em] text-xs">Aura Scan in progress...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-panel p-20 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
        <Sparkles size={48} className="text-white/10 mb-6" />
        <h3 className="text-xl font-display font-bold mb-2 uppercase tracking-widest">Quiet Sector</h3>
        <p className="text-[10px] text-white/40 uppercase tracking-widest leading-loose">No activity detected in this frequency yet.</p>
      </div>
    );
  }

  return (
    <div className="columns-2 md:columns-3 gap-6 space-y-6">
      {items.map((item, index) => (
        <motion.div
           key={item.id}
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: index * 0.05 }}
           className="relative group cursor-pointer break-inside-avoid"
        >
          {/* Card Body */}
          <div className="relative rounded-[2rem] overflow-hidden border border-white/10 group-hover:border-aeirmist-cyan/30 transition-all duration-700 shadow-2xl">
            <img 
              src={item.url} 
              alt={item.author} 
              className="w-full h-auto object-cover transition-transform duration-1000 group-hover:scale-110"
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
               <div className="absolute inset-0 bg-aeirmist-cyan/5 group-hover:backdrop-blur-[2px] transition-all" />
               
               <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-3">
                  <div 
                    className="flex items-center gap-3 hover:bg-white/5 p-2 rounded-2xl transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUserClick?.({ 
                        id: item.authorId, 
                        username: item.author, 
                        displayName: item.authorDisplayName, 
                        photoURL: item.authorAvatar 
                      });
                    }}
                  >
                    <img src={item.authorAvatar} className="w-8 h-8 rounded-full border border-white/20 object-cover" />
                    <div className="truncate">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest truncate">{item.author}</h4>
                      <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.2em] mt-0.5">High Connections</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] font-black text-white/80">
                     <span className="flex items-center gap-1.5"><Heart size={12} className="text-aeirmist-magenta" fill="currentColor" /> {item.likes}</span>
                     {item.type === 'video' ? (
                        <span className="flex items-center gap-1.5"><Play size={12} fill="white" /> {item.likes * 2}</span>
                     ) : (
                        <span className="flex items-center gap-1.5"><MessageSquare size={12} fill="white" /> {item.comments || '0'}</span>
                     )}
                  </div>
               </div>
            </div>

            {/* Type Indicator */}
            <div className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/60">
              {item.type === 'video' ? <Play size={14} fill="currentColor" /> : <Sparkles size={14} className="text-aeirmist-cyan" />}
            </div>

            {/* Premium Indicator Glow */}
            {index % 4 === 0 && (
              <div className="absolute inset-0 border-2 border-aeirmist-magenta/20 rounded-[2rem] pointer-events-none group-hover:border-aeirmist-magenta/40 transition-colors" />
            )}
          </div>
          
          {/* Subtle Shadow Casting */}
          <div className="absolute bottom-[-20px] left-8 right-8 h-12 bg-black/40 blur-2xl z-[-1] opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.div>
      ))}
    </div>
  );
};
