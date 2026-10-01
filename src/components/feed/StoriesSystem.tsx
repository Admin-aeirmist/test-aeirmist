import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  X, 
  Check,
  Heart, 
  Send, 
  Music, 
  Globe, 
  Users, 
  Shield, 
  Loader2, 
  MessageSquare,
  Zap,
  Radio,
  Mic,
  Image as ImageIcon,
  Video,
  Brain,
  Camera,
  History,
  Sparkles,
  Search,
  Ghost,
  Bookmark,
  ChevronDown,
  MoreVertical,
  MinusCircle,
  Link2,
  Share2,
  Settings,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Bell,
  Clock,
  Link as LucideLink,
  Volume2,
  VolumeX,
  Layers,
  MapPin,
  Trash2,
  Play,
  Pause,
  Eye
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { useAppearance } from '../../context/AppearanceContext';
import { analytics } from '../../services/AnalyticsService';
import { getAvatarUrl } from '../../lib/avatar';
import { Avatar } from '../ui/Avatar';
import { MediaQuality } from '../../services/MediaService';
import { useInboxData } from '../../hooks/useInboxData';
import { NGLSticker } from '../profile/NGLSystem';
import { StoryStudio } from '../stories/StoryStudio';
import { logger } from '@/src/utils/logger';

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  Timestamp, 
  doc, 
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc, 
  arrayUnion,
  limit 
} from 'firebase/firestore';

interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  createdAt: any;
  viewers: string[];
}

const BoomerangPlayer = ({ frames }: { frames: string[] }) => {
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    if (frames.length === 0) return;
    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, 60);
    return () => clearInterval(interval);
  }, [frames]);

  return (
    <img 
      src={frames[currentFrame]} 
      className="w-full h-full object-cover" 
      alt="Boomerang" 
    />
  );
};

export const StoriesSystem: React.FC = React.memo(() => {
  const { user, profile, db, uploadMedia, setCameraConfig, canWrite, updateProfile, storyUpload, optimisticStories, publishStory, isFollowing, stories: contextStories, deleteStory, addToast } = useAeirmist();
  const { notes, createNote } = useInboxData();
  const [stories, setStories] = useState<any[]>([]);
  const [activeStoryGroup, setActiveStoryGroup] = useState<any | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const storyNoteTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (storyNoteTextareaRef.current) {
      storyNoteTextareaRef.current.style.height = 'auto';
      storyNoteTextareaRef.current.style.height = `${Math.min(Math.max(48, storyNoteTextareaRef.current.scrollHeight), 120)}px`;
    }
  }, [noteContent, isCreatingNote]);
  const [audience, setAudience] = useState<'public' | 'followers' | 'closeFriends'>('public');
  const [music, setMusic] = useState('');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  // --- BROWSER HISTORY INTEGRATION FOR STORIES ---
  const isRestoringRef = useRef(false);
  const pendingRestoreGroupUserIdRef = useRef<string | null>(null);

  // Notify App.tsx when story states change
  useEffect(() => {
    if (isRestoringRef.current) return;

    const payload = {
      activeStoryGroup: activeStoryGroup ? { userId: activeStoryGroup.userId, userName: activeStoryGroup.userName } : null,
      isStudioOpen,
      isCreatingNote
    };
    window.dispatchEvent(new CustomEvent('aeirmist-story-state-change', { detail: payload }));
  }, [activeStoryGroup, isStudioOpen, isCreatingNote]);

  // Listen to state restore from App.tsx (unified popstate)
  useEffect(() => {
    const handleRestore = (e: any) => {
      const { activeStoryGroup: restoredGroup, isStudioOpen: restoredStudio, isCreatingNote: restoredNote } = e.detail;
      isRestoringRef.current = true;

      if (restoredGroup) {
        const matched = stories.find(g => g.userId === restoredGroup.userId);
        if (matched) {
          setActiveStoryGroup(matched);
        } else {
          // Store pending userId to resolve when stories finish loading
          pendingRestoreGroupUserIdRef.current = restoredGroup.userId;
          setActiveStoryGroup(restoredGroup);
        }
      } else {
        setActiveStoryGroup(null);
        pendingRestoreGroupUserIdRef.current = null;
      }

      setIsStudioOpen(!!restoredStudio);
      setIsCreatingNote(!!restoredNote);

      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
    };

    window.addEventListener('aeirmist-story-state-restore', handleRestore);
    return () => window.removeEventListener('aeirmist-story-state-restore', handleRestore);
  }, [stories]);

  // Resolve pending restore once stories are populated
  useEffect(() => {
    if (pendingRestoreGroupUserIdRef.current && stories.length > 0) {
      const matched = stories.find(g => g.userId === pendingRestoreGroupUserIdRef.current);
      if (matched) {
        setActiveStoryGroup(matched);
        pendingRestoreGroupUserIdRef.current = null;
      }
    }
  }, [stories]);

  function groupStories(flatStories: any[]) {
    // Privacy Filtering Logic
    const filteredStories = flatStories.filter(story => {
      // Always allow if owner
      if (story.userId === user?.uid) return true;
      
      // Filter by audience
      const audience = story.audience || 'public';
      if (audience === 'public') return true;
      
      if (audience === 'followers') {
        return isFollowing(story.userId);
      }
      
      if (audience === 'closeFriends') {
        return (story.visibleTo || []).includes(user?.uid);
      }
      
      return false;
    });

    // Prioritize confirmed Firestore stories, fallback to optimistic
    const combined = [...filteredStories, ...optimisticStories];
    
    // Deduplicate to avoid flickering when story moves from optimistic to real
    const seenUrls = new Set();
    const unique = combined.filter(s => {
      if (!s.mediaUrl) return true;
      if (seenUrls.has(s.mediaUrl)) return false;
      seenUrls.add(s.mediaUrl);
      return true;
    });

    // Normalize timestamps for sorting
    const normalized = unique.map(s => {
      let date: Date;
      if (s.createdAt?.toDate) {
        date = s.createdAt.toDate();
      } else if (s.createdAt instanceof Date) {
        date = s.createdAt;
      } else if (typeof s.createdAt === 'number') {
        date = new Date(s.createdAt);
      } else if (typeof s.createdAt === 'string') {
        date = new Date(s.createdAt);
      } else {
        date = new Date(); // Fallback for pending server timestamps
      }

      const sortDate = isNaN(date.getTime()) ? Date.now() : date.getTime();
      return { ...s, sortDate };
    }).sort((a, b) => b.sortDate - a.sortDate);

    const groups = normalized.reduce((acc: any, story: any) => {
      const uId = story.userId;
      if (!acc[uId]) {
        acc[uId] = {
          userId: uId,
          userName: uId === user?.uid ? (profile?.displayName || profile?.username || 'You') : story.userName,
          userAvatar: uId === user?.uid ? (profile?.photoURL || story.userAvatar) : story.userAvatar,
          stories: []
        };
      }
      acc[uId].stories.push(story);
      return acc;
    }, {});
    return Object.values(groups);
  }

  useEffect(() => {
    setStories(groupStories(contextStories || []));
  }, [contextStories, optimisticStories, profile?.closeFriends, user?.uid]);

  const myStories = stories.find(g => g.userId === user?.uid);

  const handleStoryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.size > 45 * 1024 * 1024) {
      addToast({
        title: "File Too Large",
        message: "Story media limit is 45 MB. Please select a smaller file.",
        type: "warning"
      });
      return;
    }

    // Use the optimized publishStory from context
    publishStory({
      file,
      type: file.type.startsWith('video') ? 'video' : 'image',
      mode: 'story'
    });
  };

  const openCamera = () => {
    setCameraConfig({
      isOpen: true,
      mode: 'STORY',
      onCapture: (file) => {
        publishStory({
          file,
          type: file.type.startsWith('video') ? 'video' : 'image',
          mode: 'story'
        });
      }
    });
  };

  const handleCreateNote = async () => {
    if (!noteContent.trim()) return;
    await createNote(noteContent, audience, music);
    analytics.trackEngagement('story_upload', { mediaType: 'text_note' });
    setNoteContent('');
    setMusic('');
    setIsCreatingNote(false);
  };

  const myNote = notes.find(n => n.authorId === profile?.id);

  return (
    <div className="relative mb-2 select-none">
      {/* MINIMAL HORIZONTAL STORIES ROW */}
      <div className="flex items-center gap-5 md:gap-8 overflow-x-auto py-2 pl-6 pr-4 scroll-smooth snap-x snap-mandatory">
        
        {/* YOUR STORY */}
        <div className="flex flex-col items-center gap-2.5 shrink-0 snap-start ml-1.5 sm:ml-0">
          <div className="relative">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative group cursor-pointer"
              onClick={() => {
                if (myStories) {
                  setActiveStoryGroup(myStories);
                  analytics.trackEngagement('story_view', { storyOwnerId: user?.uid });
                } else {
                  setIsStudioOpen(true);
                }
              }}
            >
              {/* Dynamic Orbital Background for active story */}
              {myStories && (
                <div className="absolute inset-[-3px] pointer-events-none">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full rounded-[20px] border border-aeirmist-cyan/30"
                  />
                </div>
              )}

              <Avatar
                src={storyUpload?.previewUrl || getAvatarUrl(profile?.photoURL)}
                alt="me"
                sizeClassName="w-14 h-14 md:w-16 md:h-16"
                roundedClassName="rounded-[18px]"
                innerRoundedClassName="rounded-[16px]"
                showStoryRing={true}
                storyRingState={myStories && myStories.stories?.length > 0 ? 'active' : 'none'}
                className="transition-all duration-700 relative z-10"
              >
                {storyUpload?.isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50 p-2 text-center">
                    <div className="relative w-8 h-8 md:w-10 md:h-10 flex items-center justify-center mb-1">
                      <svg className="w-full h-full -rotate-90">
                        <circle
                          cx="50%"
                          cy="50%"
                          r="45%"
                          className="stroke-white/10 fill-none"
                          strokeWidth="3"
                        />
                        <motion.circle
                          cx="50%"
                          cy="50%"
                          r="45%"
                          className="stroke-aeirmist-cyan fill-none"
                          strokeWidth="3"
                          strokeDasharray="100"
                          animate={{ strokeDashoffset: 100 - (storyUpload?.progress || 0) }}
                          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-aeirmist-cyan">
                        {Math.round(storyUpload?.progress || 0)}%
                      </span>
                    </div>
                    <span className="text-[7px] font-black uppercase tracking-tighter text-white/70 truncate w-full">
                      {storyUpload?.status || 'Uploading...'}
                    </span>
                  </div>
                )}
              </Avatar>

              {/* Add button overlay - ALWAYS SHOW */}
              <div 
                className="absolute bottom-[-2px] right-[-2px] w-6 h-6 bg-aeirmist-cyan rounded-xl border-2 border-[#080808] flex items-center justify-center text-black z-20 shadow-lg group-hover:scale-110 transition-transform cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStudioOpen(true);
                }}
              >
                <Plus size={14} strokeWidth={4} />
              </div>
            </motion.div>


          </div>
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
              {myStories && myStories.stories?.length > 0 ? 'Your Story' : 'Add Story'}
            </span>
            {myStories && myStories.stories?.length > 0 && (
              <span className="text-[8px] font-bold text-cyan-400">
                {myStories.stories[0].viewers?.length || 0} {myStories.stories[0].viewers?.length === 1 ? 'view' : 'views'}
              </span>
            )}
          </div>
        </div>

        {/* OTHER USER STORIES */}
        {stories.filter(s => s.userId !== user?.uid).map((group) => {
          const hasUnseen = group.stories.some((s: any) => !s.viewers?.includes(user?.uid));
          return (
            <motion.div 
              key={group.userId} 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2.5 shrink-0 snap-start cursor-pointer group"
              onClick={() => {
                setActiveStoryGroup(group);
                analytics.trackEngagement('story_view', { storyOwnerId: group.userId });
              }}
            >
              <Avatar
                src={group.userAvatar}
                alt={group.userName}
                sizeClassName="w-14 h-14 md:w-16 md:h-16"
                roundedClassName="rounded-[18px]"
                innerRoundedClassName="rounded-[16px]"
                showStoryRing={true}
                storyRingState={hasUnseen ? 'active' : 'seen'}
                imgClassName="transition-all duration-700 group-hover:scale-110"
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 group-hover:text-aeirmist-cyan transition-colors truncate max-w-[75px] text-center">
                {group.userName}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* STORY VIEWER */}
      <AnimatePresence>
        {activeStoryGroup && (
          <StoryViewer 
            group={activeStoryGroup} 
            onClose={() => setActiveStoryGroup(null)} 
            groupsList={stories}
            onGroupChange={(group) => setActiveStoryGroup(group)}
          />
        )}
      </AnimatePresence>

      {/* STORY STUDIO */}
      <AnimatePresence>
        {isStudioOpen && (
          <StoryStudio onClose={() => setIsStudioOpen(false)} />
        )}
      </AnimatePresence>

      {/* CREATE NOTE MODAL (Notes) */}
      <AnimatePresence>
        {isCreatingNote && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-3xl"
              onClick={() => setIsCreatingNote(false)}
            />
            
            {/* Cinematic Particles Backdrop */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
               {Array.from({ length: 20 }).map((_, i) => (
                 <motion.div 
                   key={i}
                   animate={{ 
                     y: [-20, -100], 
                     x: Math.random() * 400 - 200,
                     opacity: [0, 0.4, 0] 
                   }}
                   transition={{ 
                     duration: Math.random() * 5 + 5, 
                     repeat: Infinity,
                     delay: Math.random() * 5
                   }}
                   className="absolute bottom-0 w-1 h-1 bg-aeirmist-cyan rounded-full"
                   style={{ left: `${Math.random() * 100}%` }}
                 />
               ))}
            </div>

            <motion.div 
              initial={{ scale: 0.9, y: 40, opacity: 0, rotateX: 20 }}
              animate={{ scale: 1, y: 0, opacity: 1, rotateX: 0 }}
              exit={{ scale: 0.9, y: 40, opacity: 0, rotateX: -20 }}
              className="relative w-full max-w-md glass-panel p-6 md:p-10 rounded-[3.5rem] border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Internal Holographic Glow */}
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-aeirmist-cyan/10 blur-[100px] rounded-full" />
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-aeirmist-magenta/10 blur-[100px] rounded-full" />

              <button 
                onClick={() => setIsCreatingNote(false)}
                className="absolute top-8 right-8 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all z-50"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center mb-10 relative z-10">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-tr from-aeirmist-cyan to-aeirmist-magenta rounded-[2.2rem] blur-md opacity-40 group-hover:opacity-100 transition-opacity" />
                  <div className="w-24 h-24 rounded-full p-1 bg-aeirmist-bg border border-white/20 relative overflow-hidden">
                    <img src={getAvatarUrl(profile?.photoURL)} alt="" className="w-full h-full rounded-full object-cover" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-aeirmist-cyan flex items-center justify-center text-black shadow-lg">
                    <Mic size={14} strokeWidth={3} />
                  </div>
                </div>
                <h3 className="text-2xl font-display font-black uppercase tracking-[0.2em] text-white mt-6">Link</h3>
                <p className="text-[10px] text-aeirmist-cyan/60 uppercase tracking-[0.4em] font-black mt-2">Verified Member</p>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="relative">
                  <textarea 
                    ref={storyNoteTextareaRef}
                    rows={1}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Write a message..."
                    maxLength={60}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 pr-16 text-sm text-white placeholder:text-white/20 outline-none focus:border-aeirmist-cyan/40 transition-all resize-none min-h-[48px] max-h-[120px] font-medium leading-relaxed overflow-hidden text-center"
                  />
                  <div className="absolute bottom-3 right-5 text-[8px] font-black text-white/30 uppercase tracking-widest pointer-events-none">
                    {noteContent.length}/60_BITS
                  </div>
                </div>

                <div className="relative group">
                   <Music size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-aeirmist-cyan opacity-40 group-focus-within:opacity-100 transition-opacity" />
                   <input 
                    type="text"
                    value={music}
                    onChange={(e) => setMusic(e.target.value)}
                    placeholder="Search Audio..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-full py-5 pl-16 pr-8 text-[12px] text-white font-bold outline-none focus:border-aeirmist-cyan/40 transition-all placeholder:text-white/10"
                   />
                </div>

                <div className="grid grid-cols-3 gap-3">
                   {[
                     { id: 'public', label: 'USERS', icon: Globe },
                     { id: 'followers', label: 'NEST', icon: Users },
                     { id: 'closeFriends', label: 'CORE', icon: Shield }
                   ].map(item => (
                     <button
                        key={item.id}
                        onClick={() => setAudience(item.id as any)}
                        className={`flex flex-col items-center gap-2.5 p-4 rounded-3xl border transition-all duration-500 ${
                          audience === item.id 
                          ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan shadow-[0_0_20px_rgba(0,242,255,0.15)]' 
                          : 'bg-white/[0.02] border-white/5 text-white/30 hover:bg-white/5'
                        }`}
                     >
                        <item.icon size={20} />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">{item.label}</span>
                     </button>
                   ))}
                </div>

                <button 
                  onClick={handleCreateNote}
                  disabled={!noteContent.trim()}
                  className="group relative w-full py-6 rounded-full overflow-hidden transition-all duration-500 disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-white group-hover:bg-aeirmist-cyan transition-colors" />
                  <span className="relative z-10 text-black font-black uppercase tracking-[0.4em] text-[11px] flex items-center justify-center gap-3">
                    Sending <Zap size={14} fill="black" />
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

const CreatorActionButton = ({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, color: string, onClick: () => void }) => {
  const colorMap: any = {
    cyan: 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan hover:bg-aeirmist-cyan/20 ring-aeirmist-cyan',
    magenta: 'bg-aeirmist-magenta/10 border-aeirmist-magenta/30 text-aeirmist-magenta hover:bg-aeirmist-magenta/20 ring-aeirmist-magenta',
    white: 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 ring-white'
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-3 shrink-0 snap-start cursor-pointer group"
    >
      <div className={`w-24 h-24 md:w-28 md:h-28 rounded-[2.2rem] border flex items-center justify-center relative overflow-hidden transition-all duration-500 ${colorMap[color]}`}>
        {/* Animated Background Message */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 4, repeat: Infinity }}
          className={`absolute inset-4 rounded-full blur-2xl ${color === 'cyan' ? 'bg-aeirmist-cyan' : color === 'magenta' ? 'bg-aeirmist-magenta' : 'bg-white'}`}
        />
        
        {/* Holographic Border Shimmer */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-tr from-transparent via-white/10 to-transparent -skew-x-12 translate-x-full group-hover:-translate-x-full" />

        <div className="relative z-10 group-hover:scale-110 transition-transform duration-500">
          {icon}
        </div>

        {/* Ambient Glow */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-current blur-3xl`} />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-white transition-colors">
        {label}
      </span>
    </motion.div>
  );
};

export const StoryViewer = ({ 
  group, 
  onClose, 
  onEditHighlight,
  groupsList,
  onGroupChange
}: { 
  group: any, 
  onClose: () => void, 
  onEditHighlight?: (group: any) => void,
  groupsList?: any[],
  onGroupChange?: (group: any) => void
}) => {
  const { settings } = useAppearance();
  const isGlobalBgActive = settings?.globalBgType && settings.globalBgType !== 'none';
  const { user, db, canWrite, sendMessage, addToast, deleteStory } = useAeirmist();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const activeStory = group.stories[currentIndex] || group.stories[0] || { id: '', mediaUrl: '', mediaType: 'image' };
  const [liveStoryData, setLiveStoryData] = useState<any>(null);

  useEffect(() => {
    if (!db || !activeStory.id || String(activeStory.id).startsWith('opt_')) {
      setLiveStoryData(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'stories', activeStory.id), (docSnap) => {
      if (docSnap.exists()) {
        setLiveStoryData({ id: docSnap.id, ...docSnap.data() });
      }
    }, (err) => {
      logger.warn("Live story view sync error:", err);
    });
    return () => unsub();
  }, [db, activeStory.id]);

  const currentStory = liveStoryData ? { ...activeStory, ...liveStoryData } : activeStory;
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(false);
  const [viewerProfiles, setViewerProfiles] = useState<Record<string, any>>({});
  const [nextMediaPreloaded, setNextMediaPreloaded] = useState(false);
  const [newHighlightName, setNewHighlightName] = useState('');
  const [isCreatingHighlight, setIsCreatingHighlight] = useState(false);
  const [insightTab, setInsightTab] = useState<'viewers' | 'reactions'>('viewers');
  const [selectedQuizIndex, setSelectedQuizIndex] = useState<number | null>(null);
  const [isQBoxInputOpen, setIsQBoxInputOpen] = useState(false);
  const [qBoxInput, setQBoxInput] = useState('');
  const [activeQBoxSticker, setActiveQBoxSticker] = useState<any>(null);
  const [activeSliderValue, setActiveSliderValue] = useState<{ [stickerId: string]: number }>({});
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isOwner = user?.uid === group.userId;

  // Facebook-style Floating Reaction Emojis
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);

  const triggerFloatingReaction = (emoji: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    const x = Math.random() * 80 - 40;
    setFloatingReactions(prev => [...prev.slice(-12), { id, emoji, x }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 1800);
  };

  // Option Menu & Delete Confirmation States
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  // Highlight Edit States
  const [isEditHighlightOpen, setIsEditHighlightOpen] = useState(false);
  const [editLabel, setEditLabel] = useState(group.label || '');
  const [editSelectedStoryIds, setEditSelectedStoryIds] = useState<string[]>(group.stories?.map((s: any) => s.id) || []);
  const [editCoverStoryId, setEditCoverStoryId] = useState<string | null>(null);
  const [userStoriesForEdit, setUserStoriesForEdit] = useState<any[]>([]);
  const [loadingUserStoriesForEdit, setLoadingUserStoriesForEdit] = useState(false);
  const [isSavingHighlight, setIsSavingHighlight] = useState(false);
  const [isDeletingHighlight, setIsDeletingHighlight] = useState(false);

  const finalGroupsList = groupsList || [group];
  const currentGroupIndex = finalGroupsList.findIndex(g => (g.id && g.id === group.id) || (g.userId && g.userId === group.userId));
  const prevGroup = currentGroupIndex > 0 ? finalGroupsList[currentGroupIndex - 1] : null;
  const nextGroup = currentGroupIndex < finalGroupsList.length - 1 ? finalGroupsList[currentGroupIndex + 1] : null;

  const prevGroupStory = prevGroup?.stories?.[prevGroup.stories.length - 1] || prevGroup?.stories?.[0];
  const nextGroupStory = nextGroup?.stories?.[nextGroup.stories.length - 1] || nextGroup?.stories?.[0];

  // Reset indices and edit states when group changes
  useEffect(() => {
    setCurrentIndex(0);
    setProgress(0);
    setEditLabel(group.label || '');
    setEditSelectedStoryIds(group.stories?.map((s: any) => s.id) || []);
    setEditCoverStoryId(null);
  }, [group.id, group.userId, group.label, group.stories]);

  useEffect(() => {
    if (!db || !user?.uid || !isEditHighlightOpen) return;
    const fetchUserStories = async () => {
      setLoadingUserStoriesForEdit(true);
      try {
        const q = query(
          collection(db, 'stories'),
          where('userId', '==', user.uid)
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        const getMs = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (val instanceof Date) return val.getTime();
          if (typeof val === 'number') return val;
          if (val.seconds) return val.seconds * 1000;
          return 0;
        };
        const sorted = docs.sort((a, b) => getMs(b.createdAt) - getMs(a.createdAt));
        setUserStoriesForEdit(sorted);
      } catch (e) {
        logger.error("Failed to fetch stories for edit", e);
      } finally {
        setLoadingUserStoriesForEdit(false);
      }
    };
    fetchUserStories();
  }, [db, user?.uid, isEditHighlightOpen]);

  const handleSaveHighlight = async () => {
    if (!editLabel.trim() || editSelectedStoryIds.length === 0 || !db || !group.id) return;
    setIsSavingHighlight(true);
    try {
      let finalCoverUrl = group.coverUrl;
      const chosenCoverId = editCoverStoryId || (editSelectedStoryIds.length > 0 ? editSelectedStoryIds[0] : null);
      if (chosenCoverId) {
        const coverStoryObj = userStoriesForEdit.find(s => s.id === chosenCoverId);
        if (coverStoryObj) {
          finalCoverUrl = coverStoryObj.mediaUrl;
        }
      }

      await updateDoc(doc(db, 'highlights', group.id), {
        label: editLabel.trim().toUpperCase(),
        stories: editSelectedStoryIds,
        coverUrl: finalCoverUrl
      });

      addToast?.({ title: "Highlight Updated", message: "Your edits have been saved.", type: "success" });
      setIsEditHighlightOpen(false);
      setIsPaused(false);
      onClose();
    } catch (e) {
      logger.error("Failed to update highlight", e);
      addToast?.({ title: "Update Failed", message: "Error writing to database.", type: "warning" });
    } finally {
      setIsSavingHighlight(false);
    }
  };

  const handleDeleteHighlight = async () => {
    if (!db || !group.id) return;
    setIsDeletingHighlight(true);
    try {
      await deleteDoc(doc(db, 'highlights', group.id));
      addToast?.({ title: "Highlight Terminated", message: "Highlight container deleted.", type: "success" });
      setIsEditHighlightOpen(false);
      setIsPaused(false);
      onClose();
    } catch (e) {
      logger.error("Failed to delete highlight", e);
      addToast?.({ title: "Action Failed", message: "Could not remove highlight.", type: "warning" });
    } finally {
      setIsDeletingHighlight(false);
    }
  };

  useEffect(() => {
    if (!activeStory.id || !user?.uid || !db) return;
    if (String(activeStory.id).startsWith('opt_')) return;
    // Don't track owner as viewer of their own story
    if (user.uid === group.userId) return;

    const viewers = currentStory.viewers || [];
    if (!viewers.includes(user.uid)) {
      const storyRef = doc(db, 'stories', activeStory.id);
      updateDoc(storyRef, {
        viewers: arrayUnion(user.uid)
      }).catch(e => {
        logger.error("View tracking failed", e);
      });
    }
  }, [activeStory.id, user?.uid, db, group.userId]);

  useEffect(() => {
    if (activeStory.activeMusic && activeStory.activeMusic.url && !isPaused) {
      if (audioRef.current) {
        audioRef.current.currentTime = activeStory.activeMusic.startTime || 0;
        audioRef.current.play().catch(console.error);
      }
    } else {
      audioRef.current?.pause();
    }
  }, [activeStory, isPaused]);

  useEffect(() => {
    if (activeStory.mediaType === 'video' && videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        const promise = videoRef.current.play();
        if (promise !== undefined) {
          promise.catch((err) => {
            logger.warn("Video play error (possibly blocked by unmuted autoplay):", err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().catch(console.error);
            }
          });
        }
      }
    }
  }, [activeStory, isPaused, isMuted]);

  useEffect(() => {
    let interval: any;
    if (isPaused) return;

    if (activeStory.mediaType === 'image') {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            if (currentIndex < group.stories.length - 1) {
              setCurrentIndex(prev => prev + 1);
              return 0;
            } else if (onGroupChange && nextGroup) {
              onGroupChange(nextGroup);
              return 0;
            } else {
              onClose();
              return 100;
            }
          }
          return prev + 1;
        });
      }, 50); 
    }
    return () => clearInterval(interval);
  }, [currentIndex, group.stories.length, onClose, activeStory.mediaType, isPaused, onGroupChange, nextGroup]);

  const handleVideoProgress = () => {
    if (videoRef.current && !isPaused) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleShareStory = async () => {
    const storyUrl = `${window.location.origin}/story/${group.userId || activeStory.id}`;
    const authorName = group.userName || 'Aeirmist User';
    const shareData = {
      title: `${authorName}'s Story on Aeirmist`,
      text: `Check out ${authorName}'s story on Aeirmist!`,
      url: storyUrl
    };

    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        shared = true;
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          logger.warn("Native share failed, using clipboard fallback:", e);
        } else {
          return;
        }
      }
    }

    if (!shared) {
      try {
        await navigator.clipboard.writeText(storyUrl);
        addToast({
          title: "Story Link Copied",
          message: "Story link copied to clipboard.",
          type: "success"
        });
      } catch (err) {
        logger.error("Failed to copy story link:", err);
      }
    }
  };

  // Fetch user highlights
  useEffect(() => {
    if (!db || !user?.uid || !isHighlightModalOpen) return;
    setLoadingHighlights(true);
    const q = query(collection(db, 'highlights'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setHighlights(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingHighlights(false);
    });
    return () => unsub();
  }, [db, user?.uid, isHighlightModalOpen]);

  // Fetch profiles for viewers
  useEffect(() => {
    const uids = currentStory.viewers || [];
    if (!db || !uids.length) return;
    
    const fetchProfiles = async () => {
      const profiles: Record<string, any> = { ...viewerProfiles };
      const missingUids = uids.filter((uid: string) => !profiles[uid]);
      
      if (missingUids.length === 0) return;

      // Batch fetch in chunks of 30 (Firestore limit for 'in' query)
      for (let i = 0; i < missingUids.length; i += 30) {
        const chunk = missingUids.slice(i, i + 30);
        try {
          const q = query(
            collection(db, 'profiles'),
            where('__name__', 'in', chunk)
          );
          const snap = await getDocs(q);
          const foundIds = new Set<string>();
          snap.forEach(d => {
            profiles[d.id] = d.data();
            foundIds.add(d.id);
          });

          // Fallback for profiles where doc ID != uid
          const stillMissing = chunk.filter((id: string) => !foundIds.has(id));
          for (const missingId of stillMissing) {
            try {
              const singleSnap = await getDoc(doc(db, 'profiles', missingId));
              if (singleSnap.exists()) {
                profiles[missingId] = singleSnap.data();
              } else {
                const uq = query(collection(db, 'profiles'), where('uid', '==', missingId), limit(1));
                const usnap = await getDocs(uq);
                if (!usnap.empty) {
                  profiles[missingId] = usnap.docs[0].data();
                }
              }
            } catch (_) {}
          }
        } catch (e) {
          logger.warn("Batch profile fetch failed", e);
        }
      }
      setViewerProfiles(profiles);
    };

    fetchProfiles();
  }, [currentStory.viewers?.join(','), db]);

  // Preload next story
  useEffect(() => {
    setNextMediaPreloaded(false);
    if (currentIndex < group.stories.length - 1) {
      const nextStory = group.stories[currentIndex + 1];
      if (nextStory.mediaType === 'image') {
        const img = new Image();
        img.src = nextStory.mediaUrl;
        img.onload = () => setNextMediaPreloaded(true);
      } else {
        const video = document.createElement('video');
        video.src = nextStory.mediaUrl;
        video.preload = 'auto';
        video.oncanplaythrough = () => setNextMediaPreloaded(true);
      }
    }
  }, [currentIndex, group.stories]);

  const addToHighlight = async (highlightId: string) => {
    if (!db || !user?.uid) return;
    try {
      const highlightRef = doc(db, 'highlights', highlightId);
      await updateDoc(highlightRef, {
        stories: arrayUnion(activeStory.id)
      });
      setIsHighlightModalOpen(false);
      addToast?.({ title: "Highlight Updated", message: "Story added to your highlight.", type: "success" });
    } catch (e) {
      logger.error("Failed to add to highlight", e);
    }
  };

  const createAndAddToHighlight = async () => {
    if (!newHighlightName.trim() || !db || !user?.uid || isCreatingHighlight) return;
    setIsCreatingHighlight(true);
    try {
      const newHighlight = {
        userId: user.uid,
        label: newHighlightName,
        coverUrl: activeStory.mediaUrl,
        stories: [activeStory.id],
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'highlights'), newHighlight);
      setNewHighlightName('');
      setIsHighlightModalOpen(false);
      addToast?.({ title: "Highlight Created", message: "New highlight created with this story.", type: "success" });
    } catch (e) {
      logger.error("Failed to create highlight", e);
    } finally {
      setIsCreatingHighlight(false);
    }
  };

  const handleVote = async (storyId: string, optionIndex: number) => {
    if (!user || !db) return;
    
    try {
      const storyRef = doc(db, 'stories', storyId);
      const storySnap = await getDoc(storyRef);
      if (!storySnap.exists()) return;
      
      const storyData = storySnap.data();
      const stickerLayers = storyData.stickerLayers || [];
      const pollSticker = stickerLayers.find((s: any) => s.type === 'poll');
      
      if (!pollSticker || !pollSticker.pollData) return;
      
      // Check if user already voted
      const alreadyVoted = pollSticker.pollData.options.some((opt: any) => 
        opt.votes && opt.votes.includes(user.uid)
      );
      
      if (alreadyVoted) return;
      
      // Update local state for optimistic UI or just refresh
      const updatedStickers = stickerLayers.map((s: any) => {
        if (s.type === 'poll') {
          const newOptions = [...s.pollData.options];
          newOptions[optionIndex].votes = [...(newOptions[optionIndex].votes || []), user.uid];
          return { ...s, pollData: { ...s.pollData, options: newOptions } };
        }
        return s;
      });
      
      await updateDoc(storyRef, { stickerLayers: updatedStickers });
    } catch (e) {
      logger.error("Voting failed", e);
    }
  };

  const handleQuizVote = async (storyId: string, stickerId: string, optionIndex: number) => {
    if (!user || !db || selectedQuizIndex !== null) return;
    
    setSelectedQuizIndex(optionIndex);
    setIsPaused(true);

    try {
      const storyRef = doc(db, 'stories', storyId);
      const storySnap = await getDoc(storyRef);
      if (!storySnap.exists()) return;
      
      const storyData = storySnap.data();
      const stickerLayers = storyData.stickerLayers || [];
      const updatedStickers = stickerLayers.map((s: any) => {
        if (s.id === stickerId && s.type === 'quiz') {
          const newResponses = { ...(s.quizData.responses || {}), [user.uid]: optionIndex };
          return { ...s, quizData: { ...s.quizData, responses: newResponses } };
        }
        return s;
      });
      
      await updateDoc(storyRef, { stickerLayers: updatedStickers });
      
      // Keep it paused for a bit to show feedback
      setTimeout(() => {
        setIsPaused(false);
      }, 2000);
    } catch (e) {
      logger.error("Quiz voting failed", e);
      setIsPaused(false);
    }
  };

  const handleCountdownReminder = async (storyId: string, sticker: any) => {
    if (!user || !db) return;
    setIsPaused(true);

    try {
      await addDoc(collection(db, 'profiles', user.uid, 'reminders'), {
        storyId,
        stickerId: sticker.id,
        eventTitle: sticker.countdownData.title,
        targetDate: sticker.countdownData.targetDate,
        createdAt: serverTimestamp()
      });
      addToast?.({ title: "Reminder Set", message: "We'll notify you when the time arrives.", type: "success" });
      setTimeout(() => setIsPaused(false), 1500);
    } catch (e) {
      logger.error("Reminder failed", e);
      addToast?.({ title: "Error", message: "Failed to store reminder", type: "warning" });
      setIsPaused(false);
    }
  };

  const handleSliderResponse = async (storyId: string, stickerId: string, value: number) => {
    if (!user || !db) return;
    
    try {
      const storyRef = doc(db, 'stories', storyId);
      const storySnap = await getDoc(storyRef);
      if (!storySnap.exists()) return;
      
      const storyData = storySnap.data();
      const stickerLayers = storyData.stickerLayers || [];
      const updatedStickers = stickerLayers.map((s: any) => {
        if (s.id === stickerId && s.type === 'slider') {
          const newResponses = { ...(s.sliderData.responses || {}), [user.uid]: value };
          return { ...s, sliderData: { ...s.sliderData, responses: newResponses } };
        }
        return s;
      });
      
      await updateDoc(storyRef, { stickerLayers: updatedStickers });
    } catch (e) {
      logger.error("Slider response failed", e);
    }
  };

  const handleQuestionBoxSubmit = async () => {
    if (!qBoxInput.trim() || !user || !activeQBoxSticker || !db) return;
    
    setIsPaused(true);
    try {
      await addDoc(collection(db, 'ngl_messages'), {
        recipientProfileId: group.id || group.userId, // if group.id exists it's a highlight, but we want the user's profile
        recipientUid: group.userId,
        senderUid: activeQBoxSticker.questionBoxData?.showAttribution ? user.uid : 'anonymous',
        content: qBoxInput.trim(),
        createdAt: serverTimestamp(),
        status: 'unread',
        sourceStoryId: activeStory.id,
        isFromQuestionBox: true
      });

      addToast?.({ title: "Message Sent", message: "Message sent.", type: "success" });
      setQBoxInput('');
      setIsQBoxInputOpen(false);
      setIsPaused(false);
    } catch (e) {
      logger.error("Question Box submission failed", e);
      addToast?.({ title: "Message Failed", message: "Failed to send message.", type: "warning" });
    }
  };

  const handleNext = () => {
    if (currentIndex < group.stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else if (onGroupChange && nextGroup) {
      onGroupChange(nextGroup);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    } else if (onGroupChange && prevGroup) {
      onGroupChange(prevGroup);
    }
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setIsPaused(p => !p);
      } else if (e.key === 'ArrowUp') {
        setIsPaused(true);
      } else if (e.key === 'ArrowDown') {
        setIsPaused(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, group, prevGroup, nextGroup, onGroupChange, onClose]);

  const handleReply = async () => {
    if (!replyText.trim() || !user || isSendingReply) return;
    setIsSendingReply(true);
    try {
      // Find or create conversation with story owner
      const convId = [user.uid, group.userId].sort().join('_');
      await sendMessage(convId, replyText, 'text', activeStory.mediaUrl, {
        storyReply: true,
        storyId: activeStory.id
      });
      setReplyText('');
      // Show mini toast or feedback
      analytics.trackEngagement('message', { storyId: activeStory.id });
    } catch (e) {
      logger.error("Reply failed", e);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleStoryReaction = async (emoji: string) => {
    if (!activeStory.id || !user?.uid || !db) return;
    // OPTIMIZATION: Throttle reactions to save write quota
    if (!canWrite(`story_react_${activeStory.id}`, 30000)) return; // 30s throttle

    try {
      // Send to inbox
      const convId = [user.uid, group.userId].sort().join('_');
      await sendMessage(convId, `Reacted ${emoji} to your story`, 'text', activeStory.mediaUrl, {
        storyReaction: true,
        storyId: activeStory.id,
        emoji
      });

      analytics.trackEngagement('message', { storyId: activeStory.id, type: 'reaction' });

      const storyRef = doc(db, 'stories', activeStory.id);
      await updateDoc(storyRef, {
        [`reactions.${user.uid}`]: emoji
      });
      
      addToast?.({ title: "Reaction Sent", message: `You reacted with ${emoji}`, type: "success" });
    } catch (e) {
      logger.error("Story reaction failed", e);
    }
  };

  return (
    <>
      {/* DELETE STORY CONFIRMATION MODAL */}
      <AnimatePresence>
        {showDeleteConfirmModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl relative"
            >
              <div className="w-16 h-16 rounded-[1.5rem] bg-rose-500/20 flex items-center justify-center mx-auto mb-6">
                <Trash2 size={24} className="text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-white text-center mb-2">Delete Story?</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 text-center mb-8">This story will be permanently erased from the network.</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (group.isHighlight) {
                      await deleteDoc(doc(db, 'highlights', group.id));
                      addToast?.({ title: "Highlight Terminated", message: "Highlight container deleted.", type: "success" });
                    } else {
                      await deleteStory(activeStory.id);
                    }
                    setShowDeleteConfirmModal(false);
                    onClose();
                  }}
                  className="flex-1 py-4 rounded-2xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_8px_24px_rgba(239, 68, 68, 0.2)]"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] bg-[#0c0d14] flex items-center justify-center select-none overflow-hidden"
      >
        {/* Top-Left Facebook-style Exit and App Branding */}
        <div className="absolute top-4 left-4 z-[1010] flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md flex items-center justify-center text-white transition-all cursor-pointer border border-white/10 shadow-lg"
            title="Close Stories (Esc)"
          >
            <X size={22} />
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-display font-black text-xl tracking-tight text-white">Aeirmist</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">Stories</span>
          </div>
        </div>

        {/* Facebook-style Desktop Center Layout with Navigation Arrows */}
        <div className="flex items-center justify-center gap-4 lg:gap-8 w-full h-full max-w-5xl px-2 sm:px-4">
          
          {/* Previous Arrow Button */}
          <button 
            onClick={handlePrev}
            disabled={!prevGroup && currentIndex === 0}
            className="hidden md:flex w-12 h-12 rounded-full bg-[#1e2029] hover:bg-[#2b2e3b] disabled:opacity-0 disabled:pointer-events-none text-white items-center justify-center shadow-2xl border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft size={26} />
          </button>

          {/* CENTER MAIN STORY CARD (Facebook 9:16 Aspect) */}
          <div className="relative w-full h-full md:w-[420px] md:h-[90vh] md:max-h-[820px] md:rounded-2xl bg-black overflow-hidden shadow-2xl flex flex-col border border-white/10 shrink-0">
          {/* Progress Bars */}
          <div className="absolute top-[calc(1rem+var(--spacing-safe-top))] inset-x-4 z-50 flex gap-1.5 px-2">
            {group.stories.map((_: any, i: number) => (
              <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full ${i === currentIndex ? 'bg-white' : i < currentIndex ? 'bg-white' : 'bg-transparent'}`}
                  initial={{ width: 0 }}
                  animate={{ 
                    width: i === currentIndex ? `${progress}%` : i < currentIndex ? '100%' : '0%' 
                  }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-[calc(2rem+var(--spacing-safe-top))] inset-x-6 z-50 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full border border-white/20 p-[1px] shrink-0 overflow-hidden shadow-md">
                <img src={getAvatarUrl(group.userAvatar, group.userName)} className="w-full h-full rounded-full object-cover" alt="" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white tracking-wide truncate drop-shadow">{group.userName}</span>
                <span className="text-[11px] text-white/60 font-medium flex items-center gap-1.5 truncate max-w-[200px]">
                  <span>{activeStory.createdAt?.toDate ? new Date(activeStory.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                  {activeStory.activeMusic && (
                    <>
                      <span>·</span>
                      <Music size={11} className="text-cyan-400 shrink-0" />
                      <span className="text-white/80 font-semibold truncate max-w-[130px]">{activeStory.activeMusic.title}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Pause / Play Toggle (Facebook Standard) */}
              <button 
                onClick={() => setIsPaused(!isPaused)} 
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer border border-white/10 shadow-sm"
                title={isPaused ? "Play Story" : "Pause Story"}
              >
                {isPaused ? <Play size={15} fill="white" className="ml-0.5" /> : <Pause size={15} fill="white" />}
              </button>

              {/* Mute / Unmute Toggle */}
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer border border-white/10 shadow-sm"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>

              {/* Share Story */}
              <button 
                onClick={handleShareStory} 
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer border border-white/10 shadow-sm"
                title="Share Story"
              >
                <Share2 size={16} />
              </button>

              {isOwner && (
                <>
                  {group.isHighlight && (
                    <button 
                      onClick={() => {
                        if (onEditHighlight) {
                          onEditHighlight(group);
                          onClose();
                        } else {
                          setIsPaused(true);
                          setIsEditHighlightOpen(true);
                        }
                      }}
                      className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-95 border border-white/10 shadow-sm cursor-pointer"
                      title="Edit Highlight"
                    >
                      <Edit2 size={15} className="text-cyan-400" />
                    </button>
                  )}
                  {group.isHighlight ? (
                    <div className="relative">
                      <button 
                        onClick={() => {
                          setIsPaused(true);
                          setShowOptionsMenu(!showOptionsMenu);
                        }} 
                        className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-95 border border-white/10 shadow-sm cursor-pointer"
                        title="Options"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Popover / Dropdown Menu */}
                      <AnimatePresence>
                        {showOptionsMenu && (
                          <motion.div key="story-options-menu-wrapper">
                            <div 
                              className="fixed inset-0 z-40 bg-transparent" 
                              onClick={() => {
                                setShowOptionsMenu(false);
                                setIsPaused(false);
                              }}
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 10 }}
                              className="absolute right-0 mt-2 w-48 rounded-2xl bg-black/95 border border-white/10 backdrop-blur-3xl shadow-2xl overflow-hidden z-50 p-1.5 font-sans"
                            >
                              <button
                                onClick={() => {
                                  setShowOptionsMenu(false);
                                  if (onEditHighlight) {
                                    onEditHighlight(group);
                                    onClose();
                                  } else {
                                    setIsEditHighlightOpen(true);
                                  }
                                }}
                                className="w-full px-4 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center gap-2 cursor-pointer"
                              >
                                Edit Highlight
                              </button>
                              <button
                                onClick={() => {
                                  setShowOptionsMenu(false);
                                  setShowDeleteConfirmModal(true);
                                }}
                                className="w-full px-4 py-2.5 rounded-xl text-left text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all flex items-center gap-2 cursor-pointer"
                              >
                                Delete Highlight
                              </button>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => setIsHighlightModalOpen(true)}
                        className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white transition-all border border-white/10 shadow-sm cursor-pointer"
                        title="Highlight"
                      >
                        <Bookmark size={15} />
                      </button>
                      
                      <button 
                        onClick={() => setShowDeleteConfirmModal(true)}
                        className="w-9 h-9 rounded-full bg-rose-500/20 hover:bg-rose-500/30 backdrop-blur-md flex items-center justify-center text-rose-400 transition-all border border-rose-500/20 shadow-sm cursor-pointer"
                        title="Delete Story"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Close Button on Card */}
              <button 
                onClick={onClose} 
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer border border-white/10 shadow-sm"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 relative bg-black flex items-center justify-center">
            {activeStory.activeMusic && activeStory.activeMusic.url && (
              <audio 
                ref={audioRef}
                src={activeStory.activeMusic.url}
                loop
                muted={isMuted}
              />
            )}
            <motion.div
              drag
              dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
              dragElastic={{ top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120) {
                  onClose();
                } else if (info.offset.x < -100) {
                  handleNext();
                } else if (info.offset.x > 100) {
                  handlePrev();
                }
              }}
              className="w-full h-full flex items-center justify-center relative touch-none"
            >
              {activeStory.mode === 'boomerang' && activeStory.boomerangFrames ? (
                <BoomerangPlayer frames={activeStory.boomerangFrames} />
              ) : activeStory.mediaType === 'video' ? (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
                  {activeStory.fitMode === 'contain' && (
                    <video
                      src={activeStory.mediaUrl}
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50 scale-125 select-none pointer-events-none"
                    />
                  )}
                  <video 
                    ref={videoRef}
                    src={activeStory.mediaUrl} 
                    autoPlay 
                    muted={isMuted || activeStory.isVideoMuted === true} 
                    playsInline
                    style={{
                      transform: `rotate(${activeStory.rotation || 0}deg) scale(${activeStory.scale || 1}) scaleX(${activeStory.flipX ? -1 : 1})`,
                      filter: `${activeStory.filter || 'none'} brightness(${activeStory.brightness || 100}%) contrast(${activeStory.contrast || 100}%)`,
                    }}
                    className={`w-full h-full ${activeStory.fitMode === 'contain' ? 'object-contain relative z-10' : 'object-cover'}`}
                    onTimeUpdate={handleVideoProgress}
                    onPlay={() => setIsPaused(false)}
                    onPause={() => setIsPaused(true)}
                    onEnded={() => handleNext()}
                  />
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
                  {activeStory.fitMode === 'contain' && (
                    <img
                      src={activeStory.mediaUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50 scale-125 select-none pointer-events-none"
                    />
                  )}
                  <img 
                    src={activeStory.mediaUrl} 
                    style={{
                      transform: `rotate(${activeStory.rotation || 0}deg) scale(${activeStory.scale || 1}) scaleX(${activeStory.flipX ? -1 : 1})`,
                      filter: `${activeStory.filter || 'none'} brightness(${activeStory.brightness || 100}%) contrast(${activeStory.contrast || 100}%)`,
                    }}
                    className={`w-full h-full ${activeStory.fitMode === 'contain' ? 'object-contain relative z-10' : 'object-cover'} pointer-events-none`} 
                    alt="" 
                  />
                </div>
              )}
            </motion.div>

            {/* Story Layers Overlay */}
            <div className="absolute inset-0 z-40 pointer-events-none">
              {(activeStory.textLayers || []).map((layer: any) => {
                const fontData = {
                  family: layer.font === 'serif' ? "'Playfair Display', serif" :
                         layer.font === 'script' ? "'Dancing Script', cursive" :
                         layer.font === 'mono' ? "'Courier Prime', monospace" :
                         layer.font === 'condensed' ? "'Bebas Neue', sans-serif" :
                         "'Inter', sans-serif",
                  weight: layer.font === 'sans' ? '900' : 
                         layer.font === 'serif' ? '700' :
                         layer.font === 'script' ? '700' :
                         '400'
                };

                const bgStyles = layer.bg === 'solid' ? {
                  backgroundColor: layer.color,
                  color: layer.color === '#ffffff' ? '#000000' : '#ffffff',
                } : layer.bg === 'highlight' ? {
                  backgroundColor: `${layer.color}44`,
                  color: layer.color,
                  borderLeft: `4px solid ${layer.color}`
                } : {
                  color: layer.color,
                };

                const animationProps = layer.animation === 'fade' ? {
                  initial: { opacity: 0 },
                  animate: { opacity: layer.opacity },
                  transition: { duration: 0.8, ease: 'easeOut' as const }
                } : layer.animation === 'slide' ? {
                  initial: { opacity: 0, y: 30 },
                  animate: { opacity: layer.opacity, y: 0 },
                  transition: { duration: 0.6, type: 'spring' as const }
                } : layer.animation === 'typewriter' ? {
                  initial: { width: 0, opacity: 0 },
                  animate: { width: 'auto', opacity: layer.opacity },
                  transition: { duration: 1, ease: 'linear' as const }
                } : {};

                return (
                  <motion.div
                    key={layer.id}
                    {...animationProps}
                    style={{ 
                      position: 'absolute',
                      left: `${layer.x}px`, 
                      top: `${layer.y}px`, 
                      fontSize: `${layer.size}px`,
                      fontFamily: fontData.family,
                      fontWeight: fontData.weight,
                      textAlign: layer.align,
                      opacity: layer.opacity,
                      ...bgStyles
                    }}
                    className={`px-4 py-2 rounded-2xl select-none whitespace-pre-wrap max-w-[80%] pointer-events-none ${layer.shadow && layer.bg === 'none' ? 'drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]' : ''}`}
                  >
                    {layer.text}
                  </motion.div>
                );
              })}

              {(activeStory.stickerLayers || []).map((sticker: any) => (
                <div
                  key={sticker.id}
                  style={{ 
                    position: 'absolute',
                    left: `${sticker.x}px`, 
                    top: `${sticker.y}px`,
                    transform: `scale(${sticker.scale})` 
                  }}
                  className="pointer-events-auto"
                >
                  <div className="relative group/stick">
                    {sticker.type === 'location' && (
                      <div className="px-3 py-1.5 rounded-xl bg-aeirmist-cyan text-black font-black text-[10px] uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                        <MapPin size={12} /> {sticker.content}
                      </div>
                    )}
                    {sticker.type === 'music' && sticker.musicData && (
                      <div 
                        onClick={(e) => {
                          if (sticker.musicData?.song?.spotifyURL) {
                            e.stopPropagation();
                            window.open(sticker.musicData.song.spotifyURL, '_blank');
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-2xl bg-black/60 backdrop-blur-md border shadow-2xl min-w-[220px] max-w-[260px] pointer-events-auto overflow-hidden transition-all ${
                          sticker.musicData?.song?.spotifyURL 
                            ? 'cursor-pointer border-[#1DB954]/30 hover:border-[#1DB954] hover:bg-black/80 active:scale-95' 
                            : 'border-white/10'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 overflow-hidden relative border border-white/10">
                          {sticker.musicData?.song?.albumArtUrl || sticker.musicData?.song?.albumArtURL ? (
                            <img 
                              src={sticker.musicData.song.albumArtUrl || sticker.musicData.song.albumArtURL} 
                              className="w-full h-full object-cover" 
                              alt="" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <>
                              <Music className="text-aeirmist-cyan relative z-10" size={16} />
                              <motion.div 
                                animate={{ scale: [1, 1.2, 1] }} 
                                transition={{ duration: 1, repeat: Infinity }}
                                className="absolute inset-0 bg-aeirmist-cyan/10"
                              />
                            </>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="whitespace-nowrap flex">
                            <span className="text-[10px] font-black uppercase tracking-wider text-white pr-4 truncate">
                              {sticker.musicData.song?.title || sticker.musicData.song?.name || sticker.musicData.title}
                            </span>
                          </div>
                          <p className="text-[8px] font-bold text-white/40 uppercase tracking-tighter truncate">
                            {sticker.musicData.song?.artist || sticker.musicData.artist}
                          </p>
                        </div>
                        {sticker.musicData?.song?.spotifyURL ? (
                          <div className="flex flex-col items-end shrink-0 gap-1">
                            <div className="text-[6px] font-black tracking-widest text-[#1DB954] bg-[#1DB954]/10 border border-[#1DB954]/20 rounded px-1 py-0.5 uppercase">
                              Spotify
                            </div>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center shrink-0">
                            <Sparkles size={8} className="text-aeirmist-cyan" />
                          </div>
                        )}
                      </div>
                    )}
                    {sticker.type === 'mention' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (sticker.mentionId) navigate(`/profile/${sticker.mentionId}`);
                        }}
                        className="px-4 py-2 rounded-full bg-aeirmist-cyan text-black font-black text-sm shadow-xl flex items-center gap-1.5 border border-white/20 active:scale-95 transition-transform"
                      >
                        <span className="opacity-60 text-xs">@</span>
                        {sticker.content.replace('@', '')}
                      </button>
                    )}
                    {sticker.type === 'hashtag' && (
                      <div className="px-4 py-2 rounded-full bg-aeirmist-magenta text-white font-black text-sm shadow-xl flex items-center gap-1.5 border border-white/20 transition-transform">
                        <span className="opacity-60 text-xs">#</span>
                        {sticker.content.replace('#', '')}
                      </div>
                    )}
                    {sticker.type === 'poll' && sticker.pollData && (
                      <div className="p-4 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl min-w-56 text-center pointer-events-auto">
                        <p className="text-sm font-bold text-white mb-4">{sticker.pollData.question}</p>
                        <div className="space-y-2">
                          {sticker.pollData.options.map((opt: any, idx: number) => {
                            const totalVotes = sticker.pollData.options.reduce((acc: number, o: any) => acc + (o.votes?.length || 0), 0);
                            const hasVoted = sticker.pollData.options.some((o: any) => o.votes?.includes(user?.uid));
                            const percentage = totalVotes > 0 ? Math.round(((opt.votes?.length || 0) / totalVotes) * 100) : 0;
                            const isSelected = opt.votes?.includes(user?.uid);

                            return (
                              <button
                                key={idx}
                                disabled={hasVoted}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVote(activeStory.id, idx);
                                }}
                                className="w-full relative h-12 rounded-xl overflow-hidden border border-white/5 transition-all active:scale-95 group/opt"
                              >
                                {hasVoted && (
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    className={`absolute inset-0 ${isSelected ? 'bg-aeirmist-cyan/30' : 'bg-white/10'}`}
                                  />
                                )}
                                <div className="absolute inset-0 flex items-center justify-between px-4">
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-aeirmist-cyan' : 'text-white/60'}`}>
                                    {opt.label}
                                  </span>
                                  {hasVoted && (
                                    <span className="text-[10px] font-black text-white/40">{percentage}%</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {sticker.type === 'quiz' && sticker.quizData && (
                      <div className="p-6 rounded-[2.5rem] bg-black/80 backdrop-blur-3xl border border-white/10 shadow-2xl min-w-64 pointer-events-auto overflow-hidden relative">
                         <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-aeirmist-magenta to-aeirmist-cyan" />
                         <p className="text-sm font-bold text-white mb-6 text-center leading-relaxed">{sticker.quizData.question}</p>
                         <div className="space-y-2.5">
                           {sticker.quizData.options.map((opt: string, idx: number) => {
                             const responses = sticker.quizData.responses || {};
                             const userSelection = responses[user?.uid || ''];
                             const isCorrect = idx === sticker.quizData.correctIndex;
                             const isSelected = userSelection === idx;
                             const hasResponded = userSelection !== undefined || selectedQuizIndex !== null;
                             const showResult = hasResponded || isOwner;
                             
                             // Aggregate stats for owner
                             const totalRes = Object.keys(responses).length;
                             const optRes = Object.values(responses).filter(v => v === idx).length;
                             const percent = totalRes > 0 ? Math.round((optRes / totalRes) * 100) : 0;

                             return (
                               <button
                                 key={idx}
                                 disabled={hasResponded && !isOwner}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleQuizVote(activeStory.id, sticker.id, idx);
                                 }}
                                 className={`w-full relative py-4 px-5 rounded-2xl border transition-all duration-500 flex items-center justify-between group/quiz-opt ${
                                   showResult 
                                     ? isCorrect 
                                       ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                                       : isSelected 
                                         ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                         : 'bg-white/5 border-white/5 text-white/20'
                                     : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
                                 }`}
                               >
                                 <span className="text-[11px] font-black uppercase tracking-widest truncate flex-1 text-left">
                                   {opt}
                                 </span>
                                 
                                 {showResult && (
                                   <div className="flex items-center gap-3">
                                      {isOwner && (
                                        <span className="text-[9px] font-mono opacity-40">{percent}%</span>
                                      )}
                                      {isCorrect && <Check size={14} className="shrink-0" />}
                                      {!isCorrect && isSelected && <X size={14} className="shrink-0" />}
                                   </div>
                                 )}
                               </button>
                             );
                           })}
                         </div>
                         {isOwner && (
                           <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-2">
                              <Users size={12} className="text-white/20" />
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
                                {Object.keys(sticker.quizData.responses || {}).length} Responses
                              </span>
                           </div>
                         )}
                      </div>
                    )}
                    {sticker.type === 'countdown' && sticker.countdownData && (
                      <div className="p-6 rounded-[2.5rem] bg-black/80 backdrop-blur-3xl border border-white/10 shadow-2xl min-w-64 text-center pointer-events-auto relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-1 bg-aeirmist-cyan" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-aeirmist-cyan mb-6">{sticker.countdownData.title}</p>
                        
                        <CountdownTimer targetDate={sticker.countdownData.targetDate} />
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCountdownReminder(activeStory.id, sticker);
                          }}
                          className="mt-8 w-full py-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-95 group/remind"
                        >
                          <Bell size={14} className="text-aeirmist-cyan group-hover:animate-bounce" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Remind Me</span>
                        </button>
                      </div>
                    )}
                    {sticker.type === 'slider' && sticker.sliderData && (
                      <div className="p-8 rounded-[3rem] bg-black/80 backdrop-blur-3xl border border-white/10 shadow-2xl min-w-72 text-center pointer-events-auto relative">
                        <div className="absolute top-0 inset-x-0 h-1 bg-aeirmist-magenta" />
                        <p className="text-sm font-bold text-white mb-10 leading-relaxed italic">"{sticker.sliderData.prompt}"</p>
                        
                        <EmojiSlider 
                          sticker={sticker} 
                          onResponse={(val) => handleSliderResponse(activeStory.id, sticker.id, val)} 
                          isOwner={isOwner}
                          currentUserUid={user?.uid || ''}
                        />
                      </div>
                    )}
                    {sticker.type === 'link' && sticker.linkData && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(sticker.linkData.url, '_blank');
                        }}
                        className="px-6 py-4 rounded-full bg-aeirmist-cyan text-black font-black text-sm shadow-xl flex items-center gap-3 border border-white/20 active:scale-95 transition-all group/link"
                      >
                        <LucideLink size={18} className="group-hover:rotate-45 transition-transform" />
                        {sticker.linkData.label}
                      </button>
                    )}
                    {sticker.type === 'question' && sticker.questionBoxData && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isOwner) {
                            setActiveQBoxSticker(sticker);
                            setIsQBoxInputOpen(true);
                            setIsPaused(true);
                          }
                        }}
                        className="p-8 rounded-[2.5rem] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-2xl min-w-64 text-center pointer-events-auto group/qbox relative overflow-hidden active:scale-95 transition-all"
                      >
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta" />
                        <p className="text-base font-bold text-white mb-6 leading-relaxed italic drop-shadow-lg group-hover:text-aeirmist-cyan transition-colors">
                          "{sticker.questionBoxData.prompt}"
                        </p>
                        <div className="py-4 bg-white/5 rounded-[1.5rem] border border-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-white/30 group-hover:bg-white/10 group-hover:text-white transition-all">
                          {isOwner ? 'Receiving messages...' : 'Send an Anonymous Message'}
                        </div>
                      </button>
                    )}
                    {sticker.type === 'gif' && (
                      <span className="text-4xl filter drop-shadow-md">{sticker.content}</span>
                    )}
                    {sticker.type === 'emoji' && (
                      <span className="text-4xl filter drop-shadow-md">{sticker.content}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* NGL Sticker Overlay */}
            {activeStory.ngl_message_id && (
              <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none p-8">
                <NGLSticker message={{ id: activeStory.ngl_message_id, content: activeStory.ngl_content } as any} />
              </div>
            )}

            {/* Floating Reaction Emojis Animation (Facebook Style) */}
            <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
              {floatingReactions.map(r => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 1, scale: 0.6, y: 0, x: r.x }}
                  animate={{ opacity: 0, scale: 1.6, y: -300, x: r.x + (Math.random() * 40 - 20) }}
                  transition={{ duration: 1.6, ease: "easeOut" }}
                  className="absolute bottom-28 right-12 text-3xl select-none filter drop-shadow-lg"
                >
                  {r.emoji}
                </motion.div>
              ))}
            </div>

            {/* Story Caption (Facebook Style Banner) */}
            {activeStory.caption && (
              <div className="absolute bottom-4 inset-x-4 z-40 flex justify-center pointer-events-none">
                <div className="bg-black/75 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2 max-w-[90%] text-center shadow-2xl">
                  <p className="text-xs font-semibold text-white drop-shadow-md leading-relaxed">{activeStory.caption}</p>
                </div>
              </div>
            )}

            {/* Navigation zones */}
            <div 
              className="absolute inset-y-0 left-0 w-1/4 z-30" 
              onClick={handlePrev}
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            />
            <div 
              className="absolute inset-y-0 right-0 w-1/4 z-30" 
              onClick={handleNext}
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            />
          </div>

          {/* Facebook-style Bottom Action Bar */}
          {!isOwner && (
            <div className="p-3 bg-gradient-to-t from-black via-black/95 to-black/40 flex flex-col gap-2.5 z-40">
              {/* Facebook 6 Quick Reactions Row */}
              <div className="flex items-center justify-around px-2">
                {['👍', '❤️', '😂', '😮', '😢', '👏'].map(emoji => (
                  <motion.button
                    key={emoji}
                    whileHover={{ scale: 1.3, y: -4 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      handleStoryReaction(emoji);
                      triggerFloatingReaction(emoji);
                    }}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-xl transition-all cursor-pointer border border-white/10 backdrop-blur-md shadow-md"
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>

              {/* Reply Input Row */}
              <div className="flex gap-2 items-center">
                <input 
                  type="text" 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  placeholder={`Reply to ${group.userName}...`}
                  className="flex-1 bg-white/10 hover:bg-white/15 focus:bg-white/20 backdrop-blur-md border border-white/15 rounded-full py-2.5 px-4 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/30 transition-all"
                />
                {replyText.trim() ? (
                  <button 
                    onClick={handleReply}
                    disabled={isSendingReply}
                    className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white shadow-lg transition-all cursor-pointer shrink-0"
                    title="Send Reply"
                  >
                    {isSendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      handleStoryReaction('❤️');
                      triggerFloatingReaction('❤️');
                    }}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-rose-500 transition-all cursor-pointer shrink-0"
                    title="Love"
                  >
                    <Heart size={20} />
                  </button>
                )}
              </div>
            </div>
          )}

          {isOwner && (
            <div className="p-3 bg-gradient-to-t from-black via-black/95 to-black/40 flex items-center justify-between px-4 z-40">
              <button 
                onClick={() => {
                  setIsPaused(true);
                  setShowViewers(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer border border-white/10 shadow-lg"
              >
                <Eye size={16} className="text-cyan-400" />
                <span>{currentStory.viewers?.length || 0} {currentStory.viewers?.length === 1 ? 'Viewer' : 'Viewers'}</span>
              </button>

              <button 
                onClick={() => {
                  setIsPaused(true);
                  setShowDeleteConfirmModal(true);
                }}
                className="w-9 h-9 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex items-center justify-center transition-all cursor-pointer border border-rose-500/20 active:scale-95"
                title="Delete Story"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {/* FACEBOOK/INSTAGRAM STYLE STORY VIEWERS BOTTOM SHEET */}
          <AnimatePresence>
            {showViewers && (
              <div className="absolute inset-0 z-[70] flex flex-col justify-end overflow-hidden">
                {/* Backdrop */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
                  onClick={() => {
                    setShowViewers(false);
                    setIsPaused(false);
                  }}
                />
                {/* Sliding Panel */}
                <motion.div 
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 300 }}
                  className="relative bg-[#11131a] rounded-t-3xl border-t border-white/15 p-5 max-h-[75%] flex flex-col shadow-2xl z-10"
                >
                  {/* Top Drag Pill */}
                  <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4 shrink-0" />

                  {/* Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                      <Eye size={18} className="text-cyan-400" />
                      <h4 className="text-sm font-black uppercase tracking-wider text-white">Story Insights</h4>
                    </div>
                    <button 
                      onClick={() => {
                        setShowViewers(false);
                        setIsPaused(false);
                      }} 
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  {/* Segmented Control: Viewers vs Reactions */}
                  <div className="flex gap-2 mb-4 p-1 bg-white/5 rounded-xl shrink-0">
                    <button 
                      onClick={() => setInsightTab('viewers')}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        insightTab === 'viewers' ? 'bg-cyan-500 text-black shadow-md' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <Eye size={14} />
                      <span>Viewers ({currentStory.viewers?.length || 0})</span>
                    </button>
                    <button 
                      onClick={() => setInsightTab('reactions')}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        insightTab === 'reactions' ? 'bg-pink-500 text-white shadow-md' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <Heart size={14} />
                      <span>Reactions ({Object.keys(currentStory.reactions || {}).length})</span>
                    </button>
                  </div>

                  {/* Scrollable Viewers / Reactions List */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[160px] max-h-[340px]">
                    {insightTab === 'viewers' ? (
                      <>
                        {(currentStory.viewers || []).map((vId: string) => {
                          const p = viewerProfiles[vId];
                          const displayName = p?.displayName || p?.username || `User_${vId.substring(0, 6)}`;
                          const userTag = p?.username ? `@${p.username}` : '';
                          const reactionEmoji = currentStory.reactions?.[vId];

                          return (
                            <div 
                              key={vId} 
                              onClick={() => {
                                if (p?.username) {
                                  onClose();
                                  navigate(`/profile/${p.username}`);
                                }
                              }}
                              className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-all cursor-pointer border border-white/5 group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shrink-0">
                                  <img 
                                    src={getAvatarUrl(p?.photoURL, displayName)} 
                                    className="w-full h-full object-cover" 
                                    alt={displayName} 
                                  />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors truncate">
                                    {displayName}
                                  </span>
                                  {userTag && (
                                    <span className="text-[10px] text-white/40 truncate">
                                      {userTag}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {reactionEmoji && (
                                  <span className="text-lg bg-white/10 px-2 py-0.5 rounded-full border border-white/10" title="Reacted">
                                    {reactionEmoji}
                                  </span>
                                )}
                                <span className="text-[9px] font-bold uppercase text-white/30 tracking-wider">
                                  Viewed
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {(currentStory.viewers || []).length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                              <Eye size={24} />
                            </div>
                            <span className="text-sm font-bold text-white/70">No viewers yet</span>
                            <span className="text-xs text-white/30 max-w-[200px]">
                              When people view your story, they will appear here.
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {Object.entries(currentStory.reactions || {}).map(([vId, emoji]: [string, any]) => {
                          const p = viewerProfiles[vId];
                          const displayName = p?.displayName || p?.username || `User_${vId.substring(0, 6)}`;
                          const userTag = p?.username ? `@${p.username}` : '';

                          return (
                            <div 
                              key={vId} 
                              onClick={() => {
                                if (p?.username) {
                                  onClose();
                                  navigate(`/profile/${p.username}`);
                                }
                              }}
                              className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-all cursor-pointer border border-white/5 group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shrink-0">
                                  <img 
                                    src={getAvatarUrl(p?.photoURL, displayName)} 
                                    className="w-full h-full object-cover" 
                                    alt={displayName} 
                                  />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-white group-hover:text-pink-400 transition-colors truncate">
                                    {displayName}
                                  </span>
                                  {userTag && (
                                    <span className="text-[10px] text-white/40 truncate">
                                      {userTag}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20">
                                <span className="text-base">{emoji}</span>
                                <span className="text-[10px] font-bold text-pink-400 uppercase">Reacted</span>
                              </div>
                            </div>
                          );
                        })}

                        {Object.keys(currentStory.reactions || {}).length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                              <Heart size={24} />
                            </div>
                            <span className="text-sm font-bold text-white/70">No reactions yet</span>
                            <span className="text-xs text-white/30 max-w-[200px]">
                              When someone reacts with an emoji, it will appear here.
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Facebook-style Desktop Next Arrow Button */}
        <button 
          onClick={handleNext}
          className="hidden md:flex w-12 h-12 rounded-full bg-[#1e2029] hover:bg-[#2b2e3b] text-white items-center justify-center shadow-2xl border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
          title="Next (Right Arrow)"
        >
          <ChevronRight size={26} />
        </button>


        {/* Highlight Modal */}
        <AnimatePresence>
          {isHighlightModalOpen && (
            <div className="absolute inset-0 z-[200] flex flex-col justify-end">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setIsHighlightModalOpen(false)}
              />
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="relative bg-[#0c0d12] rounded-t-[2.5rem] border-t border-white/10 p-8 max-h-[70vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-lg font-black uppercase tracking-widest text-white">Add to Highlights</h4>
                  <button onClick={() => setIsHighlightModalOpen(false)} className="text-white/40 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* New Highlight Input */}
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="New Highlight Name..."
                      value={newHighlightName}
                      onChange={(e) => setNewHighlightName(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none"
                    />
                    <button 
                      onClick={createAndAddToHighlight}
                      disabled={!newHighlightName.trim() || isCreatingHighlight}
                      className="w-12 h-12 rounded-xl bg-aeirmist-cyan flex items-center justify-center text-black disabled:opacity-50"
                    >
                      {isCreatingHighlight ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    </button>
                  </div>

                  {/* Existing Highlights */}
                  <div className="grid grid-cols-3 gap-4">
                    {highlights.map(h => (
                      <button 
                        key={h.id}
                        onClick={() => addToHighlight(h.id)}
                        className="flex flex-col items-center gap-2 group"
                      >
                        <div className="w-16 h-16 rounded-2xl border-2 border-white/5 p-1 group-hover:border-aeirmist-cyan transition-all overflow-hidden">
                          <img src={h.coverUrl} className="w-full h-full rounded-2xl object-cover" alt="" />
                        </div>
                        <span className="text-[10px] font-bold text-white/60 group-hover:text-white uppercase truncate w-full text-center">{h.label}</span>
                      </button>
                    ))}
                    {highlights.length === 0 && !loadingHighlights && (
                      <div className="col-span-3 py-10 text-center text-white/20 italic text-xs">
                        Create your first highlight above.
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Highlight Edit Modal */}
        <AnimatePresence>
          {isEditHighlightOpen && (
            <div className="absolute inset-0 z-[1300] flex flex-col justify-end">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/95 backdrop-blur-md"
                onClick={() => {
                  setIsEditHighlightOpen(false);
                  setIsPaused(false);
                }}
              />
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="relative bg-[#0c0d12] rounded-t-[2.5rem] border-t border-white/10 p-6 flex flex-col max-h-[85vh] overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4 shrink-0">
                  <h4 className="text-sm font-black uppercase tracking-[0.2em] text-aeirmist-cyan">Edit Highlight</h4>
                  <button 
                    onClick={() => {
                      setIsEditHighlightOpen(false);
                      setIsPaused(false);
                    }} 
                    className="p-1.5 rounded-full hover:bg-white/5 text-white/50"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Form fields */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-5">
                  {/* Label */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Rename Container</label>
                    <input 
                      type="text"
                      maxLength={15}
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-aeirmist-cyan/50 tracking-wider"
                    />
                  </div>

                  {/* Cover Preview & selection */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block">Select Cover</label>
                    <div className="flex justify-center">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border border-aeirmist-cyan/40 p-[1px] bg-neutral-900 shadow-[0_0_12px_rgba(0,242,255,0.1)]">
                        <img 
                          src={
                            userStoriesForEdit.find(s => s.id === (editCoverStoryId || editSelectedStoryIds[0]))?.mediaUrl || 
                            group.coverUrl || 
                            'https://picsum.photos/seed/highlight/200/200'
                          } 
                          className="w-full h-full object-cover rounded-[14px]" 
                          alt="Cover Preview" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stories picker */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block">Manage Included Stories</label>
                    {loadingUserStoriesForEdit ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <Loader2 className="animate-spin text-aeirmist-cyan" size={18} />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Syncing Storyboard...</span>
                      </div>
                    ) : userStoriesForEdit.length === 0 ? (
                      <p className="text-[9px] text-white/30 text-center py-6 uppercase tracking-wider">No stories found in database.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {userStoriesForEdit.map(story => {
                          const isSelected = editSelectedStoryIds.includes(story.id);
                          const isCover = editCoverStoryId === story.id || (!editCoverStoryId && story.id === editSelectedStoryIds[0]);
                          return (
                            <div 
                              key={story.id}
                              className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-white/20 transition-all group"
                              onClick={() => {
                                if (isSelected) {
                                  if (editSelectedStoryIds.length === 1) {
                                    addToast?.({ title: "Operation Restricted", message: "A highlight requires at least 1 story.", type: "warning" });
                                    return;
                                  }
                                  setEditSelectedStoryIds(prev => prev.filter(id => id !== story.id));
                                  if (isCover) {
                                    setEditCoverStoryId(null);
                                  }
                                } else {
                                  setEditSelectedStoryIds(prev => [...prev, story.id]);
                                }
                              }}
                            >
                              <img src={story.mediaUrl} className="w-full h-full object-cover" alt="" />
                              <div className={`absolute inset-0 ${isSelected ? 'bg-aeirmist-cyan/20' : 'bg-black/30'}`} />
                              
                              {/* Selection Indicator checkbox */}
                              <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-aeirmist-cyan border-aeirmist-cyan shadow-[0_0_6px_rgba(0,242,255,0.6)]' : 'bg-black/40 border-white/20'}`}>
                                {isSelected && <Check size={10} className="text-black stroke-[3]" />}
                              </div>

                              {/* Small cover tag/indicator */}
                              {isSelected && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditCoverStoryId(story.id);
                                  }}
                                  className={`absolute bottom-1 inset-x-1 py-0.5 rounded text-[7px] font-black uppercase tracking-widest text-center transition-all ${
                                    isCover ? 'bg-aeirmist-cyan text-black' : 'bg-black/60 text-white/50 hover:text-white'
                                  }`}
                                >
                                  {isCover ? 'Cover' : 'Set Cover'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-white/5 mt-4 flex flex-col gap-2 shrink-0">
                  <div className="flex gap-3">
                    <button 
                      onClick={handleSaveHighlight}
                      disabled={isSavingHighlight || !editLabel.trim() || editSelectedStoryIds.length === 0}
                      className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-aeirmist-cyan hover:opacity-90 text-black shadow-[0_0_12px_rgba(0,242,255,0.4)] flex items-center justify-center gap-2 transition-all disabled:opacity-20"
                    >
                      {isSavingHighlight ? <Loader2 size={12} className="animate-spin" /> : 'Save Modifications'}
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditHighlightOpen(false);
                        setIsPaused(false);
                      }}
                      className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      setIsEditHighlightOpen(false);
                      setShowDeleteConfirmModal(true);
                    }}
                    disabled={isDeletingHighlight}
                    className="w-full py-2.5 bg-red-950/20 border border-red-500/10 hover:bg-red-500/10 hover:border-red-500/30 text-red-400 hover:text-red-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    {isDeletingHighlight ? <Loader2 size={12} className="animate-spin" /> : 'Terminate Highlight'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Custom Confirmation Modal for Deletion */}
        <AnimatePresence>
          {showDeleteConfirmModal && (
            <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
              {/* Dark backdrop overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setIsPaused(false);
                }}
              />
              
              {/* Modal Container */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm rounded-[2rem] bg-zinc-950 border border-white/10 p-6 flex flex-col items-center text-center shadow-2xl z-10 font-sans"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 animate-pulse">
                  <X size={24} />
                </div>
                
                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-red-400 mb-2">Delete Highlight</h4>
                <p className="text-xs text-white/60 mb-6 leading-relaxed">
                  Are you sure you want to permanently delete this highlight container? This action is irreversible.
                </p>
                
                <div className="flex flex-col gap-2 w-full">
                  <button 
                    onClick={async () => {
                      setShowDeleteConfirmModal(false);
                      await handleDeleteHighlight();
                      onClose(); // Close the viewer since highlight is deleted
                    }}
                    disabled={isDeletingHighlight}
                    className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_12px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2"
                  >
                    {isDeletingHighlight ? <Loader2 size={12} className="animate-spin" /> : 'Yes, Terminate Container'}
                  </button>
                  <button 
                    onClick={() => {
                      setShowDeleteConfirmModal(false);
                      setIsPaused(false);
                    }}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* QUESTION BOX INPUT MODAL */}
        <AnimatePresence>
          {isQBoxInputOpen && (
            <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm glass-panel p-10 rounded-[3rem] border-white/10 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta" />
                
                <button 
                  onClick={() => {
                    setIsQBoxInputOpen(false);
                    setIsPaused(false);
                  }}
                  className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-16 h-16 rounded-[1.2rem] bg-white/5 border border-white/10 flex items-center justify-center text-aeirmist-cyan mb-4">
                    <Ghost size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">New Story</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Recipient: @{group.userName}</p>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 mb-6">
                  <p className="text-sm font-medium text-white/70 italic text-center mb-6 leading-relaxed">
                    "{activeQBoxSticker?.questionBoxData?.prompt}"
                  </p>
                  <textarea 
                    value={qBoxInput}
                    onChange={(e) => setQBoxInput(e.target.value.slice(0, 200))}
                    placeholder="Type your message..."
                    className="w-full bg-transparent border-none focus:ring-0 text-white placeholder:text-white/10 text-center text-base font-bold min-h-[100px] resize-none"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleQuestionBoxSubmit}
                    disabled={!qBoxInput.trim()}
                    className="w-full py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-[11px] shadow-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    Send Message
                  </button>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20 text-center">
                    {activeQBoxSticker?.questionBoxData?.showAttribution 
                      ? 'ID Attribution is ON' 
                      : 'Encrypted Anonymity Active'}
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
    </>
  );
};

const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number, h: number, m: number, s: number } | null>(null);

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(targetDate).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / (1000 * 60)) % 60),
        s: Math.floor((diff / 1000) % 60)
      });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) return null;

  return (
    <div className="flex justify-center gap-4 font-mono text-white">
      {[
        { label: 'Days', val: timeLeft.d },
        { label: 'Hrs', val: timeLeft.h },
        { label: 'Min', val: timeLeft.m },
        { label: 'Sec', val: timeLeft.s }
      ].map((item, i) => (
        <div key={i} className="flex flex-col items-center">
          <span className="text-2xl font-bold tabular-nums">
            {item.val.toString().padStart(2, '0')}
          </span>
          <span className="text-[8px] font-black uppercase tracking-widest text-white/20 mt-1">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const EmojiSlider = ({ sticker, onResponse, isOwner, currentUserUid }: { sticker: any, onResponse: (val: number) => void, isOwner: boolean, currentUserUid: string }) => {
  const [value, setValue] = useState(0);
  const [isResponded, setIsResponded] = useState(false);
  const responses = sticker.sliderData.responses || {};
  const userResponse = responses[currentUserUid];
  
  useEffect(() => {
    if (userResponse !== undefined) {
      setValue(userResponse);
      setIsResponded(true);
    }
  }, [userResponse]);

  const totalResponses = Object.keys(responses).length;
  const average = totalResponses > 0 
    ? Math.round(Object.values(responses).reduce((a: any, b: any) => a + b, 0) as number / totalResponses) 
    : 0;

  return (
    <div className="space-y-8">
      <div className="relative h-2 w-full bg-white/10 rounded-full">
        {/* Track highlight for current response */}
        <div 
          className="absolute h-full bg-gradient-to-r from-aeirmist-magenta/20 to-aeirmist-magenta rounded-full transition-all duration-300"
          style={{ width: `${value}%` }}
        />
        
        {/* Average marker for owner or after response */}
        {(isOwner || isResponded) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white/40 rounded-full z-10"
            style={{ left: `${average}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-white/30 whitespace-nowrap uppercase tracking-widest">Avg: {average}</div>
          </motion.div>
        )}

        <input 
          type="range"
          min="0"
          max="100"
          value={value}
          disabled={isResponded && !isOwner}
          onChange={(e) => {
            setValue(parseInt(e.target.value));
          }}
          onMouseUp={() => {
            if (!isResponded) {
              setIsResponded(true);
              onResponse(value);
            }
          }}
          onPointerUp={() => {
            if (!isResponded) {
              setIsResponded(true);
              onResponse(value);
            }
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        />

        <motion.div 
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-30"
          style={{ left: `${value}%`, transform: 'translate(-50%, -50%)' }}
          animate={{ scale: isResponded ? 1 : 1.2 }}
        >
          <div className="text-4xl drop-shadow-2xl filter saturate-150">{sticker.sliderData.emoji}</div>
        </motion.div>
      </div>

      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/20">
        <span>0</span>
        {isResponded && (
          <span className="text-aeirmist-magenta animate-pulse">Recorded: {value}%</span>
        )}
        <span>100</span>
      </div>
      
      {isOwner && (
        <div className="pt-4 border-t border-white/5 flex items-center justify-center gap-2">
           <Users size={12} className="text-white/20" />
           <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
             {totalResponses} Responses
           </span>
        </div>
      )}
    </div>
  );
};
