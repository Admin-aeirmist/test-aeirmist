import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Hash, ArrowUpRight, Zap, Target, Loader2 } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


export const TrendingTopics: React.FC = () => {
  const { db, addToast } = useAeirmist();
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchTrends = async () => {
      if (!db) return;
      setLoading(true);
      try {
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        const hashCounts: Record<string, number> = {};
        
        snap.forEach(doc => {
          const d = doc.data();
          if (d.isDeletedAuthor || d.scheduledForPurge || d.isDeleted || d.hidden || d.authorName === 'Aeirmist User' || d.userName === 'Aeirmist User') return;
          const content = d.content || '';
          const foundHashes = content.match(/#[\w\d]+/g) || [];
          foundHashes.forEach((h: string) => {
            const tag = h.replace('#', '');
            hashCounts[tag] = (hashCounts[tag] || 0) + 1;
          });
        });

        const sortedTrends = Object.entries(hashCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([topic, count]) => ({
            topic,
            volume: `${count} Message${count > 1 ? 's' : ''}`,
            type: 'hashtag'
          }));

        setTrends(sortedTrends);
      } catch (e) {
        logger.error("Trends fetch failed:", e);
        addToast({
          title: "Trends Offline",
          message: "Failed to load global velocity trends. Retrying connection...",
          type: "warning"
        });
        if (retryCount < 5) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 5000);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, [db, retryCount]);
  const [suggestedClusters, setSuggestedClusters] = useState<any[]>([]);

  useEffect(() => {
    if (!db) return;
    const fetchClusters = async () => {
      try {
        const q = query(collection(db, 'groups'), limit(3));
        const snap = await getDocs(q);
        setSuggestedClusters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        logger.error("Clusters fetch failed:", e);
      }
    };
    fetchClusters();
  }, [db]);

  const [joinedClusters, setJoinedClusters] = useState<string[]>([]);

  const toggleJoin = (name: string) => {
    if (joinedClusters.includes(name)) {
      setJoinedClusters(prev => prev.filter(n => n !== name));
    } else {
      setJoinedClusters(prev => [...prev, name]);
    }
  };

  return (
    <div className="space-y-10 sticky top-12">
      {/* TRENDING SECTION */}
      <div>
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-aeirmist-magenta animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Global Velocity</span>
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
             <div className="p-4 flex items-center justify-center font-black text-[10px] uppercase tracking-widest text-white/20">
               <Loader2 size={12} className="animate-spin mr-2" /> Scanning...
             </div>
          ) : trends.map((trend, i) => (
            <motion.button
              key={i}
              whileHover={{ x: 5 }}
              onClick={() => {
                const navEvent = new CustomEvent('aura-navigate', { detail: 'discover' });
                window.dispatchEvent(navEvent);
              }}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.05] transition-all group"
            >
              <div className="flex items-center gap-4 text-left">
                <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center border border-white/5 group-hover:text-aeirmist-cyan transition-all">
                  {trend.type === 'hashtag' ? <Hash size={16} /> : <Zap size={16} />}
                </div>
                <div>
                  <h4 className="text-sm font-black text-white/90 group-hover:text-white transition-colors">#{trend.topic}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">{trend.volume}</p>
                </div>
              </div>
              <ArrowUpRight size={14} className="text-white/20 group-hover:text-white transition-all opacity-0 group-hover:opacity-100" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* CLUSTERS (GROUPS) SECTION */}
      <div>
        <div className="flex items-center justify-between mb-6 px-2">
           <div className="flex items-center gap-2">
            <Target size={16} className="text-aeirmist-cyan" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Active Clusters</span>
          </div>
        </div>

        <div className="space-y-3">
          {suggestedClusters.length === 0 && !loading && (
            <div className="p-8 text-center opacity-20 text-[10px] font-black uppercase tracking-widest border border-white/5 rounded-[2rem]">
              No clusters discovered
            </div>
          )}
          {suggestedClusters.map((cluster, i) => (
            <div key={cluster.id || i} className="p-5 rounded-[2rem] bg-gradient-to-br from-white/[0.05] to-transparent border border-white/5 hover:border-white/10 transition-all cursor-pointer group">
               <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 flex items-center justify-center text-aeirmist-cyan`}>
                     <Target size={18} />
                  </div>
                  <button 
                    onClick={() => toggleJoin(cluster.name)}
                    className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                      joinedClusters.includes(cluster.name) 
                        ? 'bg-aeirmist-lime/20 text-aeirmist-lime border border-aeirmist-lime/20' 
                        : 'bg-white text-aeirmist-bg hover:scale-105'
                    }`}
                  >
                    {joinedClusters.includes(cluster.name) ? 'Synced' : 'Join'}
                  </button>
               </div>
               <h4 className="text-sm font-black text-white mb-1">{cluster.name}</h4>
               <p className="text-[10px] font-black uppercase tracking-widest text-white/20">{cluster.members?.length || 0} Synced Users</p>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER LINKS */}
      <div className="px-4 flex flex-wrap gap-4 text-[9px] font-black uppercase tracking-widest text-white/10">
         <span className="hover:text-white/30 cursor-pointer">Security</span>
         <span className="hover:text-white/30 cursor-pointer">Digital Ethics</span>
         <span className="hover:text-white/30 cursor-pointer">Aeirmist v4.2.0</span>
      </div>
    </div>
  );
};
