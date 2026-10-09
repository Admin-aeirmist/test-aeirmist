import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  MessageSquare, 
  DollarSign, 
  Settings, 
  LayoutDashboard, 
  Video, 
  Edit3, 
  Trash2, 
  Copy, 
  Eye, 
  Sparkles, 
  ChevronRight, 
  Globe, 
  Lock, 
  ThumbsUp, 
  Share2, 
  Heart, 
  Pin, 
  Send, 
  ShieldAlert, 
  Sliders, 
  PieChart, 
  BarChart, 
  X,
  Plus,
  Compass,
  Award,
  Check,
  ShieldCheck
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { logger } from '@/src/utils/logger';

import { 
  collection, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc, 
  setDoc,
  query, 
  where,
  addDoc
} from 'firebase/firestore';

interface AeirmistCreatorStudioProps {
  onClose: () => void;
  onNavigateToVideo: (videoId: string) => void;
  initialTab?: 'overview' | 'content' | 'analytics' | 'audience' | 'comments' | 'monetization' | 'settings';
}

export const AeirmistCreatorStudio: React.FC<AeirmistCreatorStudioProps> = ({ onClose, onNavigateToVideo, initialTab }) => {
  const { profile, user, addToast, updateProfile, db } = useAeirmist();
  
  // Dashboard Sections
  const [activeTab, setActiveTab ] = useState<'overview' | 'content' | 'analytics' | 'audience' | 'comments' | 'monetization' | 'settings'>(initialTab || 'overview');
  
  // Video Collections & Interactions
  const [myVideos, setMyVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideoAnalytics, setSelectedVideoAnalytics] = useState<any | null>(null);
  
  // Edit Video Modal
  const [editingVideo, setEditingVideo] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('public');
  const [editCommentsEnabled, setEditCommentsEnabled] = useState(true);
  const [editLikesEnabled, setEditLikesEnabled] = useState(true);
  const [editShareEnabled, setEditShareEnabled] = useState(true);

  // Time Filter for Analytics
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '28d' | '90d' | '1y' | 'lifetime'>('7d');

  // Comment System States
  const [studioComments, setStudioComments] = useState<any[]>([]);
  const [spamKeywords, setSpamKeywords] = useState('buy, bot, link, cheap, promo, earn, free');
  const [commentFilter, setCommentFilter] = useState<'all' | 'held'>('all');
  const [replyInputMap, setReplyInputMap] = useState<Record<string, string>>({});

  // Fetch Videos & Build Creator Stats
  const fetchCreatorData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      if (db) {
        const qVideos = query(collection(db, 'videos'), where('creatorId', '==', profile.id));
        const snap = await getDocs(qVideos);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        // Sorter
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMyVideos(list);

        // Build or fetch composite comments for all my videos
        const commentsList: any[] = [];
        for (const vid of list) {
          const qComments = collection(db, 'videos', vid.id, 'comments');
          const commentsSnap = await getDocs(qComments);
          commentsSnap.forEach(cDoc => {
            commentsList.push({
              videoTitle: vid.caption,
              videoId: vid.id,
              id: cDoc.id,
              ...cDoc.data()
            });
          });
        }
        
        commentsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setStudioComments(commentsList);
      }
    } catch (e) {
      logger.error('[CreatorStudio] Fetch failed, falling back to mock state:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreatorData();
  }, [profile?.id, activeTab]);

  // Actions on Content
  const handleEditOpen = (video: any) => {
    setEditingVideo(video);
    setEditTitle(video.caption);
    setEditDescription(video.description || '');
    setEditHashtags(video.tags ? video.tags.map((t: string) => `#${t}`).join(' ') : '');
    setEditCategory(video.category || 'Technology');
    setEditVisibility(video.visibility || 'public');
    setEditCommentsEnabled(video.commentsEnabled !== false);
    setEditLikesEnabled(video.likesEnabled !== false);
    setEditShareEnabled(video.shareEnabled !== false);
  };

  const handleEditSave = async () => {
    if (!editingVideo) return;
    try {
      const parsedTags = editHashtags
        .split(' ')
        .filter(t => t.startsWith('#'))
        .map(t => t.replace('#', '').toLowerCase());

      const updatedFields = {
        caption: editTitle,
        description: editDescription,
        tags: parsedTags,
        category: editCategory,
        visibility: editVisibility,
        commentsEnabled: editCommentsEnabled,
        likesEnabled: editLikesEnabled,
        shareEnabled: editShareEnabled
      };

      if (db) {
        await updateDoc(doc(db, 'videos', editingVideo.id), updatedFields);
      }

      setMyVideos(prev => prev.map(v => v.id === editingVideo.id ? { ...v, ...updatedFields } : v));
      setEditingVideo(null);
      addToast({
        title: 'VIDEO RECONFIGURED',
        message: 'Sync parameters successfully updated in cloud database.',
        type: 'success'
      });
    } catch (e: any) {
      addToast({
        title: 'UPDATE ERROR',
        message: 'Failed to save edits.',
        type: 'warning'
      });
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!window.confirm('Are you sure you want to delete this video forever?')) return;
    try {
      if (db) {
        await deleteDoc(doc(db, 'videos', videoId));
      }
      setMyVideos(prev => prev.filter(v => v.id !== videoId));
      addToast({
        title: 'VIDEO DELETED',
        message: 'Video successfully removed.',
        type: 'success'
      });
    } catch (e: any) {
      addToast({
        title: 'DELETE ERROR',
        message: 'Exclusion failed.',
        type: 'warning'
      });
    }
  };

  const handleDuplicateVideo = async (video: any) => {
    try {
      const newID = 'vid_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      const duplicateRecord = {
        ...video,
        id: newID,
        caption: `${video.caption} (Copy)`,
        createdAt: new Date().toISOString(),
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        saveCount: 0,
        likedBy: [],
        savedBy: []
      };

      if (db) {
        await setDoc(doc(db, 'videos', newID), duplicateRecord);
      }

      setMyVideos(prev => [duplicateRecord, ...prev]);
      addToast({
        title: 'STREAM DUPLICATED',
        message: 'New parallel timeline successfully spawned.',
        type: 'success'
      });
    } catch (e: any) {
      addToast({
        title: 'DUPLICATION ERROR',
        message: 'Operation failed.',
        type: 'warning'
      });
    }
  };

  // Switch Tier Picker
  const handleSwapAccountTier = async (tier: 'personal' | 'professional' | 'business') => {
    try {
      await updateProfile({ accountType: tier });
      addToast({
        title: 'ACCOUNT TYPE UPDATED',
        message: `Your channel type shifted to the ${tier.toUpperCase()} module.`,
        type: 'success'
      });
    } catch (e: any) {
      addToast({
        title: 'SYNC FAILURE',
        message: 'Unable to upgrade profile data.',
        type: 'warning'
      });
    }
  };

  // Calculations for Stats
  const totalViews = myVideos.reduce((acc, v) => acc + (v.viewCount || 0), 0);
  const totalLikes = myVideos.reduce((acc, v) => acc + (v.likeCount || 0), 0);
  const totalCommentsCount = myVideos.reduce((acc, v) => acc + (v.commentCount || 0), 0);
  const totalWatchTimeHours = Math.round(totalViews * 0.12 * 10) / 10; // 0.12 hours average view time estimation
  const totalSaves = myVideos.reduce((acc, v) => acc + (v.saveCount || 0), 0);
  const followersCount = profile?.social?.followers?.length || 0;

  // Filter list comments for spam keywords
  const isHeldSpamComment = (text: string) => {
    const keywords = spamKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    return keywords.some(word => text.toLowerCase().includes(word));
  };

  const filteredComments = studioComments.filter(com => {
    const isSpam = isHeldSpamComment(com.text);
    return commentFilter === 'all' ? !isSpam : isSpam;
  });

  const handlePinComment = async (com: any) => {
    try {
      if (db) {
        const commentRef = doc(db, 'videos', com.videoId, 'comments', com.id);
        await updateDoc(commentRef, { isPinned: !com.isPinned });
        setStudioComments(prev => prev.map(c => c.id === com.id ? { ...c, isPinned: !c.isPinned } : c));
        addToast({
          title: com.isPinned ? 'REMOVED PIN' : 'COMMENT PINNED',
          message: 'Pin updated.',
          type: 'success'
        });
      }
    } catch (e) {
      logger.error(e);
    }
  };

  const handleHeartComment = async (com: any) => {
    try {
      if (db) {
        const commentRef = doc(db, 'videos', com.videoId, 'comments', com.id);
        await updateDoc(commentRef, { isHearted: !com.isHearted });
        setStudioComments(prev => prev.map(c => c.id === com.id ? { ...c, isHearted: !c.isHearted } : c));
        addToast({
          title: 'HEARTED',
          message: 'You hearted this comment.',
          type: 'success'
        });
      }
    } catch (e) {
      logger.error(e);
    }
  };

  const handleDeleteComment = async (com: any) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'videos', com.videoId, 'comments', com.id));
        setStudioComments(prev => prev.filter(c => c.id !== com.id));
        addToast({
          title: 'COMMENT DELETED',
          message: 'Comment removed from database.',
          type: 'success'
        });
      }
    } catch (e) {
      logger.error(e);
    }
  };

  const handlePostStudioReply = async (com: any) => {
    const txt = replyInputMap[com.id];
    if (!txt || !txt.trim()) return;
    try {
      if (db) {
        const commentRef = doc(db, 'videos', com.videoId, 'comments', com.id);
        const replyItem = {
          id: 'rep_' + Date.now().toString(36),
          userId: profile?.id || 'creator',
          userName: profile?.displayName || 'Creator',
          userAvatar: profile?.photoURL || 'https://picsum.photos/seed/cre/100/100',
          text: txt,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          likedBy: [],
          isHearted: true
        };
        
        // Add inside replies list
        const updatedReplies = [...(com.replies || []), replyItem];
        await updateDoc(commentRef, { replies: updatedReplies });
        
        setStudioComments(prev => prev.map(c => c.id === com.id ? { ...c, replies: updatedReplies } : c));
        setReplyInputMap(prev => ({ ...prev, [com.id]: '' }));
        addToast({
          title: 'REPLY INJECTED',
          message: 'Your broadcast reply recorded.',
          type: 'success'
        });
      }
    } catch (e) {
      logger.error(e);
    }
  };

  // Helper mock generation of points depending on time filter
  const getChartDataPoints = () => {
    let count = 7;
    let multiplier = 120;
    let labels: string[] = [];

    if (timeFilter === '24h') {
      count = 24;
      multiplier = 5;
      labels = Array(24).fill(0).map((_, i) => `${i}:00`);
    } else if (timeFilter === '7d') {
      count = 7;
      multiplier = 140;
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else if (timeFilter === '28d') {
      count = 4;
      multiplier = 980;
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    } else if (timeFilter === '90d') {
      count = 3;
      multiplier = 3400;
      labels = ['Month 1', 'Month 2', 'Month 3'];
    } else {
      count = 12;
      multiplier = 12000;
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    }

    return labels.map((lbl, idx) => {
      return {
        label: lbl,
        views: 0,
        watchTime: 0,
        engagement: 0
      };
    });
  };

  const chartData = getChartDataPoints();

  return (
    <div className="fixed inset-0 z-[110] bg-[#050409] text-white flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Background Orbits */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-aeirmist-cyan/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#fb007a]/5 blur-[100px] rounded-full pointer-events-none" />

      {/* LEFT NAVIGATION DECK (YouTube Studio Inspired Sidebar) */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/5 bg-[#08060d]/80 backdrop-blur-xl shrink-0 flex flex-col justify-between py-6 md:p-6 z-20">
        <div className="flex flex-col gap-8">
          
          {/* Creator Profile Display */}
          <div className="px-6 md:px-0 flex items-center md:flex-col md:text-center gap-3 md:gap-4 border-b border-white/5 pb-6 md:pb-8">
            <div className="relative">
              <img 
                src={profile?.photoURL || 'https://picsum.photos/seed/guest/200/200'} 
                alt={profile?.displayName} 
                className="w-11 h-11 md:w-20 md:h-20 rounded-2xl md:rounded-[2rem] object-cover border border-aeirmist-cyan/30"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-aeirmist-cyan text-black flex items-center justify-center border border-black shadow-[0_0_10px_rgba(0,242,255,0.4)]">
                <Award size={11} />
              </span>
            </div>
            <div className="min-w-0 md:w-full">
              <div className="flex items-center gap-1 md:justify-center">
                <span className="text-xs font-black uppercase tracking-widest text-white truncate max-w-[120px] md:max-w-none block">
                  {profile?.displayName || 'Aeirmist Creator'}
                </span>
                {profile?.isVerified !== false && (
                  <ShieldCheck size={12} className="text-aeirmist-cyan shrink-0" />
                )}
              </div>
              <span className="text-[9px] font-mono text-white/40 block mt-0.5 truncate">
                @{profile?.username || 'guestnode'}
              </span>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-aeirmist-cyan/10 border border-aeirmist-cyan/35 text-aeirmist-cyan">
                {profile?.accountType || 'Professional'} Account
              </span>
            </div>
          </div>

          {/* Nav Rails */}
          <nav className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar px-6 md:px-0 pb-2 md:pb-0 font-sans">
            <SidebarNavItem active={activeTab === 'overview'} icon={<LayoutDashboard size={15} />} label="Overview" onClick={() => setActiveTab('overview')} />
            <SidebarNavItem active={activeTab === 'content'} icon={<Video size={15} />} label="Content" onClick={() => setActiveTab('content')} />
            <SidebarNavItem active={activeTab === 'analytics'} icon={<TrendingUp size={15} />} label="Analytics" onClick={() => setActiveTab('analytics')} />
            <SidebarNavItem active={activeTab === 'audience'} icon={<Users size={15} />} label="Audience" onClick={() => setActiveTab('audience')} />
            <SidebarNavItem active={activeTab === 'comments'} icon={<MessageSquare size={15} />} label="Comments" onClick={() => setActiveTab('comments')} />
            <SidebarNavItem active={activeTab === 'monetization'} icon={<DollarSign size={15} />} label="Earnings" onClick={() => setActiveTab('monetization')} />
            <SidebarNavItem active={activeTab === 'settings'} icon={<Settings size={15} />} label="Studio Settings" onClick={() => setActiveTab('settings')} />
          </nav>
        </div>

        {/* Exit Button */}
        <div className="hidden md:block">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all text-center"
          >
            Terminal Shutdown
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER WORKSPACE */}
      <main className="flex-1 flex flex-col h-full bg-[#050409] relative overflow-y-auto no-scrollbar z-10 p-6 md:p-10 pb-28 md:pb-12">
        
        {/* Top Control Bar */}
        <header className="flex items-center justify-between border-b border-white/5 pb-6 mb-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase tracking-[0.1em] flex items-center gap-2">
              Aeirmist Video Creator Studio
              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-aeirmist-magenta/10 border border-aeirmist-magenta/30 text-aeirmist-magenta animate-pulse font-mono">
                Beta Studio
              </span>
            </h1>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mt-1">
              Main portal sub-system of {profile?.displayName}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="md:hidden py-2 px-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/50 hover:text-white text-[9px] font-black uppercase tracking-widest transition-all"
            >
              Exit Studio
            </button>
          </div>
        </header>

        {/* Content Display based on active tab */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            
            {/* OVERVIEW SECTION */}
            {activeTab === 'overview' && (
              <motion.div 
                key="studio-overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <StatReportCard icon={<Eye className="text-aeirmist-cyan" />} title="Channel Views" value={totalViews.toLocaleString()} subtitle="Awaiting data" />
                  <StatReportCard icon={<Clock className="text-aeirmist-magenta" />} title="Watch Hours" value={`${totalWatchTimeHours}H`} subtitle="Awaiting data" />
                  <StatReportCard icon={<Users className="text-aeirmist-lime" />} title="Followers Base" value={followersCount.toLocaleString()} subtitle="Direct node syncs" />
                  <StatReportCard icon={<Video className="text-orange-500" />} title="Upload Nodes" value={myVideos.length.toString()} subtitle="Broadcasted items" />
                </div>

                {/* Split columns */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                  
                  {/* Left Column: Recent Video Upload */}
                  <div className="lg:col-span-2 glass-panel p-6 md:p-8 rounded-[2.2rem] space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5 font-mono">
                        <Sparkles size={11} className="text-aeirmist-cyan" />
                        Recent Upload Performance
                      </span>
                    </div>

                    {myVideos.length > 0 ? (
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="relative w-full md:w-56 aspect-video bg-black rounded-2xl overflow-hidden shrink-0 border border-white/5">
                          <img src={myVideos[0].thumbnailURL} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 flex flex-col justify-between space-y-4">
                          <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-white leading-relaxed mb-2 hover:text-aeirmist-cyan cursor-pointer" onClick={() => onNavigateToVideo(myVideos[0].id)}>
                              {myVideos[0].caption}
                            </h3>
                            <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest block">
                              Published: {new Date(myVideos[0].createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
                            <div>
                              <span className="text-[8px] font-black text-white/20 block uppercase tracking-widest">Views</span>
                              <span className="text-sm font-bold font-mono text-white">{(myVideos[0].viewCount || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[8px] font-black text-white/20 block uppercase tracking-widest">Likes</span>
                              <span className="text-sm font-bold font-mono text-aeirmist-cyan">{(myVideos[0].likeCount || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[8px] font-black text-white/20 block uppercase tracking-widest">Comments</span>
                              <span className="text-sm font-bold font-mono text-aeirmist-magenta">{(myVideos[0].commentCount || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-white/25 text-xs font-mono">
                        No broadcast streams detected in cloud profile. Upload media to begin tracking.
                      </div>
                    )}
                  </div>

                  {/* Right Column: Top Broadcast Videos List */}
                  <div className="glass-panel p-6 md:p-8 rounded-[2.2rem] space-y-5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5 font-mono">
                      <TrendingUp size={11} className="text-aeirmist-cyan" />
                      Top Stream Users
                    </span>

                    {myVideos.length > 0 ? (
                      <div className="divide-y divide-white/5 space-y-3">
                        {myVideos.slice(0, 4).map((vid, idx) => (
                          <div key={vid.id} className="flex gap-3 items-center pt-3 select-none first:pt-0">
                            <span className="text-xs font-bold font-mono text-white/20">#{idx+1}</span>
                            <div className="relative w-12 h-8 rounded overflow-hidden shrink-0">
                              <img src={vid.thumbnailURL} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-[10px] font-bold text-white uppercase tracking-wider truncate cursor-pointer hover:text-aeirmist-cyan" onClick={() => onNavigateToVideo(vid.id)}>
                                {vid.caption}
                              </h4>
                              <p className="text-[8px] font-mono text-white/35 uppercase">{vid.viewCount || 0} syncs</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-white/20 text-[10px] font-mono">
                        Channel metrics currently blank.
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {/* CONTENT MANAGEMENT TAB */}
            {activeTab === 'content' && (
              <motion.div 
                key="studio-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5 font-mono">
                    <Video size={12} className="text-aeirmist-cyan" />
                    Broadcast Content Elements ({myVideos.length})
                  </span>
                </div>

                {loading ? (
                  <div className="py-20 text-center text-xs text-white/30 animate-pulse font-mono uppercase tracking-widest">
                    Loading content...
                  </div>
                ) : myVideos.length > 0 ? (
                  <div className="glass-panel rounded-[2.2rem] overflow-hidden border border-white/5 bg-[#08060d]/50">
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-white/30">
                            <th className="py-4 px-6">Video Media</th>
                            <th className="py-4 px-4">Visibility</th>
                            <th className="py-4 px-4 font-mono">Views</th>
                            <th className="py-4 px-4 font-mono">Likes</th>
                            <th className="py-4 px-4 font-mono">Comments</th>
                            <th className="py-4 px-4">Timeline</th>
                            <th className="py-4 px-6 text-right">Settings</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {myVideos.map(vid => (
                            <tr key={vid.id} className="text-xs hover:bg-white/[0.01] transition-all group">
                              <td className="py-4 px-6 flex items-center gap-4 min-w-[280px]">
                                <div className="relative w-20 h-11 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                  <img src={vid.thumbnailURL} className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider truncate cursor-pointer hover:text-aeirmist-cyan" onClick={() => onNavigateToVideo(vid.id)}>
                                    {vid.caption}
                                  </h4>
                                  <p className="text-[8px] font-mono text-aeirmist-cyan uppercase mt-0.5">
                                    {vid.category}
                                  </p>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                {vid.visibility === 'private' ? (
                                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-aeirmist-magenta/10 border border-aeirmist-magenta/30 text-aeirmist-magenta flex items-center gap-1 w-fit font-mono">
                                    <Lock size={8} /> Private
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan flex items-center gap-1 w-fit font-mono">
                                    <Globe size={8} /> Public
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 font-mono font-bold text-white/70">{(vid.viewCount || 0).toLocaleString()}</td>
                              <td className="py-4 px-4 font-mono font-bold text-aeirmist-cyan">{(vid.likeCount || 0).toLocaleString()}</td>
                              <td className="py-4 px-4 font-mono font-bold text-white/40">{(vid.commentCount || 0).toLocaleString()}</td>
                              <td className="py-4 px-4 text-[10px] text-white/35 font-mono uppercase">
                                {new Date(vid.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    title="View Analytics"
                                    onClick={() => setSelectedVideoAnalytics(vid)}
                                    className="p-1.5 bg-white/5 border border-white/5 text-white/50 hover:bg-white/10 hover:text-white rounded-lg transition-all"
                                  >
                                    <BarChart3 size={12} />
                                  </button>
                                  <button
                                    title="Edit Metadata"
                                    onClick={() => handleEditOpen(vid)}
                                    className="p-1.5 bg-white/5 border border-white/5 text-white/50 hover:bg-white/10 hover:text-white rounded-lg transition-all"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  <button
                                    title="Spawns Duplicate"
                                    onClick={() => handleDuplicateVideo(vid)}
                                    className="p-1.5 bg-white/5 border border-white/5 text-white/50 hover:bg-white/10 hover:text-white rounded-lg transition-all"
                                  >
                                    <Copy size={12} />
                                  </button>
                                  <button
                                    title="Terminates node"
                                    onClick={() => handleDeleteVideo(vid.id)}
                                    className="p-1.5 bg-aeirmist-magenta/10 border border-aeirmist-magenta/20 text-aeirmist-magenta hover:bg-aeirmist-magenta/20 rounded-lg transition-all"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center glass-panel p-10 rounded-[2.5rem]">
                    <Video size={40} className="mx-auto text-white/25 mb-4" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-1">
                      No data available
                    </h3>
                    <p className="text-xs text-white/30 max-w-xs mx-auto uppercase tracking-wide">
                      No broadcast streams uploaded by this professional node profile yet.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ANALYTICS SECTION CRG */}
            {activeTab === 'analytics' && (
              <motion.div 
                key="studio-analytics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                
                {/* Time range header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5 font-mono">
                    <TrendingUp size={12} className="text-aeirmist-cyan" />
                    Sub-Sector Stream Growth Telemetry
                  </span>
                  
                  <div className="flex flex-wrap gap-1.5 bg-white/[0.02] border border-white/5 p-1 rounded-xl">
                    <FilterButton active={timeFilter === '24h'} label="24 Hours" onClick={() => setTimeFilter('24h')} />
                    <FilterButton active={timeFilter === '7d'} label="7 Days" onClick={() => setTimeFilter('7d')} />
                    <FilterButton active={timeFilter === '28d'} label="28 Days" onClick={() => setTimeFilter('28d')} />
                    <FilterButton active={timeFilter === '90d'} label="90 Days" onClick={() => setTimeFilter('90d')} />
                    <FilterButton active={timeFilter === '1y'} label="1 Year" onClick={() => setTimeFilter('1y')} />
                    <FilterButton active={timeFilter === 'lifetime'} label="Lifetime" onClick={() => setTimeFilter('lifetime')} />
                  </div>
                </div>

                {/* Primary Chart Container (Gorgeous Customizable Neon SVG Curve) */}
                <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] space-y-6">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="space-y-1">
                      <h3 className="text-xs font-black uppercase tracking-widest text-white font-mono">Views & Watch time Over time</h3>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest leading-none">Real-time creator performance analytics</p>
                    </div>
                    <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest font-mono">
                      <span className="flex items-center gap-1.5 text-aeirmist-cyan">
                        <div className="w-2.5 h-2.5 rounded bg-aeirmist-cyan" /> Views Sync
                      </span>
                      <span className="flex items-center gap-1.5 text-aeirmist-magenta">
                        <div className="w-2.5 h-2.5 rounded bg-aeirmist-magenta" /> Watch Hours
                      </span>
                    </div>
                  </div>

                  {/* SVG Chart */}
                  <div className="relative w-full h-[260px] bg-white/[0.01] border border-white/5 rounded-2xl p-4 overflow-hidden flex flex-col justify-between">
                    <div className="absolute inset-x-0 top-1/4 border-b border-white/[0.02] border-dashed" />
                    <div className="absolute inset-x-0 top-2/4 border-b border-white/[0.02] border-dashed" />
                    <div className="absolute inset-x-0 top-3/4 border-b border-white/[0.02] border-dashed" />
                    
                    {/* SVG Coordinates */}
                    <div className="flex-1 w-full relative">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        
                        {/* Area 1 (Cyan Views) */}
                        <path 
                          d={`M 0 100 ${chartData.map((d, i) => {
                            const x = (i / (chartData.length - 1)) * 100;
                            const maxVal = Math.max(...chartData.map(o => o.views)) || 100;
                            const y = 92 - ((d.views / maxVal) * 80);
                            return `L ${x} ${y}`;
                          }).join(' ')} L 100 100 Z`}
                          fill="url(#views-glow)"
                          opacity="0.12"
                        />
                        
                        {/* Line 1 (Cyan Views) */}
                        <path 
                          d={`${chartData.map((d, i) => {
                            const x = (i / (chartData.length - 1)) * 100;
                            const maxVal = Math.max(...chartData.map(o => o.views)) || 100;
                            const y = 92 - ((d.views / maxVal) * 80);
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                          }).join(' ')}`}
                          fill="none"
                          stroke="#00f2ff"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />

                        {/* Line 2 (Magenta Watch time) */}
                        <path 
                          d={`${chartData.map((d, i) => {
                            const x = (i / (chartData.length - 1)) * 100;
                            const maxVal = Math.max(...chartData.map(o => o.watchTime)) || 100;
                            const y = 90 - ((d.watchTime / maxVal) * 70);
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                          }).join(' ')}`}
                          fill="none"
                          stroke="#fb007a"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeDasharray="1.5,1.5"
                        />

                        {/* Node Dots on active intervals */}
                        {chartData.map((d, i) => {
                          const x = (i / (chartData.length - 1)) * 100;
                          const maxVal = Math.max(...chartData.map(o => o.views)) || 100;
                          const y = 92 - ((d.views / maxVal) * 80);
                          return (
                            <circle 
                              key={`dot-${i}`} 
                              cx={x} 
                              cy={y} 
                              r="1.2" 
                              fill="#00f2ff" 
                              className="hover:r-2 hover:fill-white cursor-pointer transition-all" 
                            />
                          );
                        })}

                        {/* Shaders */}
                        <defs>
                          <linearGradient id="views-glow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00f2ff" />
                            <stop offset="100%" stopColor="#00f2ff" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>

                    {/* Timeline labels bar */}
                    <div className="flex justify-between border-t border-white/5 pt-2 select-none text-[8px] font-mono text-white/20 uppercase tracking-widest mt-1">
                      <span>{chartData[0]?.label}</span>
                      <span>{chartData[Math.floor(chartData.length / 2)]?.label}</span>
                      <span>{chartData[chartData.length - 1]?.label}</span>
                    </div>
                  </div>
                </div>

                {/* Sub-analytics highlights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-panel p-6 rounded-3xl text-left">
                    <span className="text-[8px] font-black uppercase text-white/20 tracking-wider">Unique Viewers</span>
                    <h4 className="text-xl font-bold font-mono text-white mt-1">{(totalViews * 0.72).toLocaleString()}</h4>
                    <p className="text-[9px] text-white/30 uppercase mt-2 tracking-wide">Average subscriber return rate 72%</p>
                  </div>
                  <div className="glass-panel p-6 rounded-3xl text-left">
                    <span className="text-[8px] font-black uppercase text-white/20 tracking-wider">Average Session Loop</span>
                    <h4 className="text-xl font-bold font-mono text-aeirmist-cyan mt-1">7.2 Mins</h4>
                    <p className="text-[9px] text-white/30 uppercase mt-2 tracking-wide">Highest active engagement on vertical streams</p>
                  </div>
                  <div className="glass-panel p-6 rounded-3xl text-left">
                    <span className="text-[8px] font-black uppercase text-white/20 tracking-wider">Growth Delta</span>
                    <h4 className="text-xl font-bold font-mono text-aeirmist-magenta mt-1">+92 Followers</h4>
                    <p className="text-[9px] text-white/30 uppercase mt-2 tracking-wide">Accelerating since creator mode activation</p>
                  </div>
                </div>

              </motion.div>
            )}

            {/* AUDIENCE TAB LOOPS */}
            {activeTab === 'audience' && (
              <motion.div 
                key="studio-audience"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5 font-mono">
                  <Users size={12} className="text-aeirmist-cyan" />
                  Audience Insights
                </span>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Age divisions */}
                  <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white font-mono">Age Distribution Segment</h3>
                    
                    <div className="space-y-4">
                      <DemographicRow term="18 - 24" percent={52} color="bg-aeirmist-cyan" />
                      <DemographicRow term="25 - 34" percent={34} color="bg-aeirmist-magenta" />
                      <DemographicRow term="13 - 17" percent={10} color="bg-aeirmist-lime" />
                      <DemographicRow term="35 - 44" percent={4} color="bg-white/30" />
                    </div>
                  </div>

                  {/* Geolocation terminals */}
                  <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white font-mono">Top Node Locations</h3>
                    
                    <div className="space-y-4">
                      <DemographicRow term="United States" percent={41} cnt="21.4K syncs" color="bg-aeirmist-cyan" />
                      <DemographicRow term="Japan" percent={28} cnt="14.3K syncs" color="bg-aeirmist-cyan" />
                      <DemographicRow term="Germany" percent={15} cnt="7.8K syncs" color="bg-aeirmist-cyan" />
                      <DemographicRow term="United Kingdom" percent={10} cnt="4.1K syncs" color="bg-aeirmist-cyan" />
                    </div>
                  </div>
                </div>

                {/* Returning vs New & Peak Active */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/[0.01] border border-white/5 p-6 rounded-3xl">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20 select-none">Active Streams</span>
                    <h4 className="text-sm font-black text-white hover:text-aeirmist-cyan cursor-pointer uppercase tracking-wider">Returning Viewers: 72%</h4>
                    <p className="text-[9px] text-white/30 uppercase leading-relaxed font-medium">Excellent channel loyalty index. High percentage of followers consume loops repeatedly.</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20 select-none">Hour Channels Peak</span>
                    <h4 className="text-sm font-black text-white hover:text-aeirmist-magenta cursor-pointer uppercase tracking-wider">19:00 - 22:00 UTC</h4>
                    <p className="text-[9px] text-white/30 uppercase leading-relaxed font-medium">Broadcast within this zone to trigger highest auto-distribution from the Networkwork.</p>
                  </div>
                </div>

              </motion.div>
            )}

            {/* COMMENTS LAB SECTION WITH SPAM FILTERS */}
            {activeTab === 'comments' && (
              <motion.div 
                key="studio-comments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                
                {/* Filters */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex gap-1 bg-white/[0.01] border border-white/5 p-1 rounded-xl">
                    <button
                      onClick={() => setCommentFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${commentFilter === 'all' ? 'bg-aeirmist-cyan text-black font-black' : 'text-white/40 hover:text-white'}`}
                    >
                      Published Log
                    </button>
                    <button
                      onClick={() => setCommentFilter('held')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${commentFilter === 'held' ? 'bg-aeirmist-magenta text-white font-black' : 'text-white/40 hover:text-white'}`}
                    >
                      <ShieldAlert size={10} /> Held for Spam ({studioComments.filter(c => isHeldSpamComment(c.text)).length})
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[8px] font-black uppercase text-white/20 font-mono">Spam Filter keywords:</span>
                    <input 
                      type="text" 
                      value={spamKeywords}
                      onChange={(e) => setSpamKeywords(e.target.value)}
                      placeholder="e.g. promo, buy, bot"
                      className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white px-3 py-1 outline-none focus:border-aeirmist-cyan/30 w-44 font-mono text-center"
                    />
                  </div>
                </div>

                {/* Comment list */}
                {filteredComments.length > 0 ? (
                  <div className="divide-y divide-white/5 space-y-4">
                    {filteredComments.map(com => (
                      <div key={com.id} className="flex gap-4 p-5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all select-none pt-4 first:pt-4">
                        <img src={com.userAvatar} className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0" />
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-aeirmist-cyan">{com.userName}</span>
                                <span className="text-[8px] font-bold text-white/25 uppercase font-mono">{new Date(com.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mt-0.5">
                                Video: <span className="text-white/50">{com.videoTitle}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {com.isPinned && (
                                <span className="px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-[7px] text-yellow-500 flex items-center gap-1 uppercase font-black uppercase tracking-widest font-mono">
                                  <Pin size={8} /> Pinned
                                </span>
                              )}
                              {com.isHearted && (
                                <span className="w-4 h-4 bg-aeirmist-magenta/10 border border-aeirmist-magenta/20 rounded flex items-center justify-center text-aeirmist-magenta text-[8px]">
                                  ❤
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-[13px] text-white/80 font-medium leading-relaxed max-w-2xl">{com.text}</p>

                          {/* Action panel & Replier block */}
                          <div className="flex items-center gap-4 pt-1">
                            
                            <button 
                              onClick={() => handleHeartComment(com)}
                              className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${com.isHearted ? 'text-aeirmist-magenta' : 'text-white/30 hover:text-aeirmist-magenta'} transition-colors`}
                            >
                              <Heart size={10} className={com.isHearted ? 'fill-current' : ''} /> {com.isHearted ? 'Hearted' : 'Heart'}
                            </button>

                            <button 
                              onClick={() => handlePinComment(com)}
                              className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${com.isPinned ? 'text-white' : 'text-white/30 hover:text-white'} transition-colors`}
                            >
                              <Pin size={10} /> {com.isPinned ? 'Unpin' : 'Pin'}
                            </button>

                            <button 
                              onClick={() => handleDeleteComment(com)}
                              className="text-[8px] font-black uppercase tracking-widest text-white/30 hover:text-aeirmist-magenta flex items-center gap-1 transition-colors"
                            >
                              <Trash2 size={10} /> Delete
                            </button>

                            <button 
                              onClick={() => setReplyInputMap(prev => ({ ...prev, [com.id]: prev[com.id] !== undefined ? undefined : '' }))}
                              className="text-[8px] font-black uppercase tracking-widest text-white/30 hover:text-aeirmist-cyan flex items-center gap-1 transition-colors"
                            >
                              Reply
                            </button>
                            
                          </div>

                          {/* Nested Replies sub-thread */}
                          {com.replies && com.replies.length > 0 && (
                            <div className="pl-6 border-l border-white/5 space-y-3 mt-4">
                              {com.replies.map((rep: any) => (
                                <div key={rep.id} className="flex gap-3">
                                  <img src={rep.userAvatar} className="w-6 h-6 rounded-lg object-cover" />
                                  <div className="flex-1 text-left">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] font-black text-aeirmist-cyan uppercase tracking-wider">{rep.userName}</span>
                                      <span className="text-[7px] text-white/20 font-mono">{new Date(rep.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-white/70 leading-relaxed mt-0.5">{rep.text}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reply Input container */}
                          {replyInputMap[com.id] !== undefined && (
                            <div className="flex gap-2 items-center max-w-lg mt-3 pl-4 border-l border-aeirmist-cyan/20">
                              <input 
                                type="text"
                                value={replyInputMap[com.id]}
                                onChange={(e) => setReplyInputMap({ ...replyInputMap, [com.id]: e.target.value })}
                                placeholder="Write reply to stream commenter..."
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex-1 text-xs text-white placeholder:text-white/20 focus:border-aeirmist-cyan/40 focus:outline-none"
                              />
                              <button
                                onClick={() => handlePostStudioReply(com)}
                                className="w-8 h-8 rounded-xl bg-aeirmist-cyan flex items-center justify-center text-black shadow-[0_0_10px_rgba(0,242,255,0.3)] hover:brightness-110 active:scale-95 transition-all"
                              >
                                <Send size={10} className="fill-current" />
                              </button>
                            </div>
                          )}

                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center glass-panel p-10 rounded-[2.5rem]">
                    <MessageSquare size={36} className="mx-auto text-white/20 mb-4" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-widest">
                      {commentFilter === 'held' ? 'No held comments' : 'No comments found'}
                    </h4>
                    <p className="text-[9px] text-white/35 uppercase tracking-wide max-w-xs mx-auto mt-1 leading-relaxed">
                      {commentFilter === 'held' 
                        ? 'Spam filter active. No comments pending review.'
                        : 'No audience comments received yet.'}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* MONETIZATION MODULE */}
            {activeTab === 'monetization' && (
              <motion.div 
                key="studio-monetization"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 text-left"
              >
                
                {/* Mega gauge banner */}
                <div className="glass-panel p-8 rounded-[2.5rem] bg-[#0c0512] border-aeirmist-magenta/10 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                  
                  <div className="space-y-4 max-w-md">
                    <span className="px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest bg-aeirmist-magenta/10 border border-aeirmist-magenta/30 text-aeirmist-magenta flex items-center gap-1.5 w-fit">
                      <Award size={10} /> Partner eligibility
                    </span>
                    <h2 className="text-xl font-bold uppercase tracking-wider text-white">Join the Aeirmist Creator Program</h2>
                    <p className="text-xs text-white/40 leading-relaxed uppercase tracking-wider text-[10px]">
                      Unlock Estimated Earnings, dynamic sponsorships overlay integration, and Revenue sharing as an approved partner.
                    </p>
                  </div>

                  {/* Circular visual scale progress */}
                  <div className="relative w-36 h-36 border border-white/5 bg-black/40 rounded-full flex flex-col items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      {/* Grey Base Ring */}
                      <circle cx="72" cy="72" r="60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                      {/* Colored Progress track */}
                      <circle 
                        cx="72" 
                        cy="72" 
                        r="60" 
                        fill="none" 
                        stroke="#fb007a" 
                        strokeWidth="6" 
                        strokeDasharray={2 * Math.PI * 60}
                        strokeDashoffset={2 * Math.PI * 60 * (1 - (followersCount / 1000 >= 1 ? 0.9 : (followersCount / 1000) * 0.9))}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-xs font-black uppercase tracking-widest text-white">
                      {Math.min(100, Math.round(((followersCount + totalWatchTimeHours) / (1000 + 4000)) * 100))}%
                    </span>
                    <span className="text-[7px] font-mono text-white/30 uppercase mt-0.5 tracking-wider">Progress</span>
                  </div>

                </div>

                {/* Grid items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* Requirements bars */}
                  <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white font-mono">Qualifying Users</h3>
                    
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline text-[9px] font-black uppercase tracking-widest font-mono">
                          <span className="text-white/50">Followers Anchor</span>
                          <span className="text-white">{followersCount} / 1,000</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-aeirmist-cyan" style={{ width: `${Math.min(100, (followersCount / 1000) * 100)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline text-[9px] font-black uppercase tracking-widest font-mono">
                          <span className="text-white/50">Watch Duration Anchors</span>
                          <span className="text-white">{totalWatchTimeHours} / 4,000 Hours</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-aeirmist-magenta" style={{ width: `${Math.min(100, (totalWatchTimeHours / 4000) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Estimated revenue stats */}
                  <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white font-mono">Estimated Revenue (Futuristic Module)</h3>
                    
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5">
                      <div>
                        <span className="text-[8px] font-black uppercase text-white/25 scroll-smooth">Next Payout</span>
                        <h4 className="text-xl font-bold font-mono text-white mt-1">$0.00</h4>
                      </div>
                      <div>
                        <span className="text-[8px] font-black uppercase text-white/25 select-all">Total Accumulated</span>
                        <h4 className="text-xl font-bold font-mono text-aeirmist-cyan mt-1">$0.00</h4>
                      </div>
                    </div>

                    <p className="text-[9px] text-white/30 uppercase leading-relaxed font-medium">Payout systems save atomically on the 21st of each standard galactic calendar month once partner requirements are met.</p>
                  </div>
                </div>

              </motion.div>
            )}

            {/* STUDIO CONFIG OVERLAY SETTINGS */}
            {activeTab === 'settings' && (
              <motion.div 
                key="studio-settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 max-w-xl text-left"
              >
                
                {/* Account Type Picker: Personal / Creator / Business */}
                <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] space-y-5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white font-mono">Change Profile Type</h3>
                  <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] leading-relaxed">
                    Instantly re-orient your profile schema on the network. Shift between tiers to unlock or lock developer tools.
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSwapAccountTier('personal')}
                      className={`py-3.5 border rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${profile?.accountType === 'personal' || !profile?.accountType ? 'bg-white/10 border-white/30 text-white shadow-[0_0_12px_rgba(255,255,255,0.1)]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                    >
                      Personal System
                    </button>
                    <button
                      onClick={() => handleSwapAccountTier('professional')}
                      className={`py-3.5 border rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${profile?.accountType === 'professional' ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.2)]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                    >
                      Creator Module
                    </button>
                    <button
                      onClick={() => handleSwapAccountTier('business')}
                      className={`py-3.5 border rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${profile?.accountType === 'business' ? 'bg-aeirmist-magenta/10 border-aeirmist-magenta/30 text-aeirmist-magenta shadow-[0_0_12px_rgba(251,0,122,0.2)]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                    >
                      Business Node
                    </button>
                  </div>
                </div>

                {/* Studio Default settings limits */}
                <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] space-y-5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white font-mono">Platform Stream Defaults</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Default Upload visibility</h4>
                        <p className="text-[8px] text-white/30 uppercase mt-0.5 tracking-wide">Automatically set public or private encryption</p>
                      </div>
                      <select className="bg-[#0c0a15] border border-white/10 text-white rounded-lg text-[10px] font-bold px-3 py-1 outline-none">
                        <option value="public">Public Node (Standard)</option>
                        <option value="private">Private (Restricted)</option>
                      </select>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Developer API logs telemetry</h4>
                        <p className="text-[8px] text-white/30 uppercase mt-0.5 tracking-wide">Feed metrics into decentralized console systems</p>
                      </div>
                      <button onClick={() => logger.info("Action coming soon")} className="w-10 h-6 bg-aeirmist-cyan rounded-full p-1 cursor-pointer">
                        <div className="w-4 h-4 bg-black rounded-full translate-x-4" />
                      </button>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </main>

      {/* EDIT VIDEO METADATA MODAL DRAWER */}
      <AnimatePresence>
        {editingVideo && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-4">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-lg bg-[#0c0812] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col mr-1 select-none"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Edit3 size={16} className="text-aeirmist-cyan" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">Refactor Broadcast Node</h3>
                </div>
                <button onClick={() => setEditingVideo(null)} className="text-white/40 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh] no-scrollbar text-left">
                
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-white/30 font-mono tracking-widest">Video Title Headline</label>
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-aeirmist-cyan/40 text-white rounded-xl py-2.5 px-4 text-xs font-bold transition-all outline-none"	
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-white/30 font-mono tracking-widest">Description</label>
                  <textarea 
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-aeirmist-cyan/40 text-white rounded-xl py-2.5 px-4 text-xs font-medium transition-all outline-none resize-none"	
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-white/30 font-mono tracking-widest">Hashtags</label>
                  <input 
                    type="text" 
                    value={editHashtags}
                    onChange={(e) => setEditHashtags(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-aeirmist-cyan/40 text-xs font-mono text-aeirmist-cyan rounded-xl py-2.5 px-4 transition-all outline-none"	
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-white/30 font-mono tracking-widest">Category</label>
                    <select 
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 focus:border-aeirmist-cyan/40 text-xs text-white rounded-xl py-2 px-3 outline-none"
                    >
                      <option value="Technology">Technology</option>
                      <option value="Travel & Events">Travel & Events</option>
                      <option value="Art & Design">Art</option>
                      <option value="Coding & Development">Dev</option>
                      <option value="Gaming & Simulations">Gaming</option>
                      <option value="Music & Senses">Music</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-white/30 font-mono tracking-widest">Visibility</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setEditVisibility('public')}
                        className={`py-1.5 rounded-lg border text-[8px] font-bold uppercase transition-all ${editVisibility === 'public' ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan' : 'bg-white/5 border-white/5 text-white/40'}`}
                      >
                        Public
                      </button>
                      <button
                        onClick={() => setEditVisibility('private')}
                        className={`py-1.5 rounded-lg border text-[8px] font-bold uppercase transition-all ${editVisibility === 'private' ? 'bg-aeirmist-magenta/10 border-aeirmist-magenta/30 text-aeirmist-magenta' : 'bg-white/5 border-white/5 text-white/40'}`}
                      >
                        Private
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/5 pt-4">
                  <TogItem title="Enable Comments" value={editCommentsEnabled} onChange={setEditCommentsEnabled} />
                  <TogItem title="Enable Likes Counter" value={editLikesEnabled} onChange={setEditLikesEnabled} />
                  <TogItem title="Allow Outer Sharing" value={editShareEnabled} onChange={setEditShareEnabled} />
                </div>

              </div>

              <div className="p-6 border-t border-white/5 bg-[#08050c] flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingVideo(null)}
                  className="px-5 py-3 rounded-xl bg-white/5 border border-white/5 text-[9px] text-white/50 font-black uppercase tracking-widest"
                >
                  Aborted
                </button>
                <button
                  type="button"
                  onClick={() => addToast({ title: 'Thumbnail', message: 'You can upload/adjust your thumbnail instantly inside the Broadcast Upload tab. Modify metadata properties above to update.', type: 'info' })}
                  className="px-5 py-3 rounded-xl bg-white/5 border border-white/5 text-[9px] text-white hover:text-aeirmist-cyan font-black uppercase tracking-widest"
                >
                  Adjust Thumbnail
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  className="flex-1 py-3 rounded-xl bg-aeirmist-cyan text-black font-black uppercase text-[9px] tracking-widest hover:brightness-110 shadow-[0_0_15px_rgba(0,242,255,0.3)]"
                >
                  Apply Sync Changes
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TARGETED VIDEO ANALYTICS DETAILED SHEET */}
      <AnimatePresence>
        {selectedVideoAnalytics && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-4">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-xl bg-[#0c0812] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col mr-1 select-none text-left"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-aeirmist-cyan" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">Broadcast Node Analytics</h3>
                </div>
                <button onClick={() => setSelectedVideoAnalytics(null)} className="text-white/40 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] no-scrollbar">
                
                {/* Meta header */}
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="w-20 h-11 rounded-lg overflow-hidden border border-white/5">
                    <img src={selectedVideoAnalytics.thumbnailURL} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-white leading-relaxed truncate max-w-[320px]">
                      {selectedVideoAnalytics.caption}
                    </h4>
                    <span className="text-[8px] font-mono text-white/30 uppercase mt-0.5 tracking-widest block">
                      Published on {new Date(selectedVideoAnalytics.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Specific video metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5">
                    <span className="text-[7px] font-black uppercase tracking-widest text-white/20 font-mono">Syncs / Views</span>
                    <h5 className="text-sm font-bold font-mono text-white mt-1">{(selectedVideoAnalytics.viewCount || 0).toLocaleString()}</h5>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5">
                    <span className="text-[7px] font-black uppercase tracking-widest text-white/20 font-mono">Heartbeats</span>
                    <h5 className="text-sm font-bold font-mono text-aeirmist-cyan mt-1">{(selectedVideoAnalytics.likeCount || 0).toLocaleString()}</h5>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 block">
                    <span className="text-[7px] font-black uppercase tracking-widest text-white/20 font-mono block text-left">Responses</span>
                    <h5 className="text-sm font-bold font-mono text-aeirmist-magenta mt-1 text-left">{(selectedVideoAnalytics.commentCount || 0).toLocaleString()}</h5>
                  </div>
                </div>

                {/* Sub-detailed Watch duration mock stats */}
                <div className="space-y-4">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-white/40 font-mono">Performance retention indicator</h4>
                  <div className="h-4 bg-white/5 rounded-lg overflow-hidden relative flex items-center justify-between px-3 text-[9px] font-black select-none font-mono opacity-50">
                    <span className="relative text-white/50">AVERAGE RETENTION (—)</span>
                    <span className="relative text-white">Awaiting data</span>
                  </div>
                </div>

                {/* Traffic sources */}
                <div className="space-y-3">
                  <label className="text-[8px] font-black uppercase text-white/30 font-mono tracking-widest">Traffic Discovery Terminals</label>
                  <div className="space-y-2 opacity-50">
                    <DemographicRow term="Awaiting data" percent={0} color="bg-white/5" />
                  </div>
                </div>

              </div>

              <div className="p-6 border-t border-white/5 bg-[#08050c]">
                <button
                  type="button"
                  onClick={() => setSelectedVideoAnalytics(null)}
                  className="w-full py-3.5 rounded-xl bg-[#030206] border border-white/14 text-[9px] text-white/60 font-black uppercase tracking-widest hover:text-white"
                >
                  Dismiss Telemetry
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

// Toggle Items inside Edit modal
const TogItem = ({ title, value, onChange }: { title: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between py-1 text-left">
    <span className="text-[9px] font-black text-white/60 uppercase tracking-wider">{title}</span>
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${value ? 'bg-aeirmist-cyan' : 'bg-white/10'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-black transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  </div>
);

// Sidebar Navigation Items
interface SidebarNavItemProps {
  active: boolean;
  icon: any;
  label: string;
  onClick: () => void;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ active, icon, label, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full py-3 px-4 rounded-xl flex items-center gap-3 transition-colors text-left shrink-0 whitespace-nowrap ${
        active 
          ? 'bg-aeirmist-cyan text-black font-black' 
          : 'text-white/40 hover:bg-white/5 hover:text-white font-bold'
      }`}
    >
      <div className={active ? 'text-black' : 'text-aeirmist-cyan'}>
        {icon}
      </div>
      <span className="text-[10px] uppercase tracking-widest hidden md:inline">
        {label}
      </span>
    </button>
  );
};

// Demographic Rows helper
const DemographicRow = ({ term, percent, cnt, color }: { term: string; percent: number; cnt?: string; color: string }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-baseline text-[9px] font-black uppercase tracking-widest font-mono">
      <span className="text-white/60">{term}</span>
      <span className="text-white">{cnt || `${percent}%`}</span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
    </div>
  </div>
);

// Stats Report Dashboard Panel widget
interface StatReportCardProps {
  icon: any;
  title: string;
  value: string;
  subtitle: string;
}

const StatReportCard: React.FC<StatReportCardProps> = ({ icon, title, value, subtitle }) => {
  return (
    <div className="glass-panel p-5 rounded-3xl text-left flex flex-col justify-between h-32 relative overflow-hidden">
      <div className="absolute top-2 right-2 p-2 opacity-50">
        {icon}
      </div>
      <div>
        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest block mt-1">{title}</span>
        <h4 className="text-lg font-black font-mono text-white mt-1 leading-none">{value}</h4>
      </div>
      <p className="text-[8px] font-mono font-bold text-white/35 uppercase leading-none">{subtitle}</p>
    </div>
  );
};

// Filter Buttons helpers
const FilterButton = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-all whitespace-nowrap ${active ? 'bg-aeirmist-cyan text-black font-black' : 'text-white/30 hover:text-white'}`}
  >
    {label}
  </button>
);
