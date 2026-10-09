import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { 
  X, 
  Calendar, 
  Eye, 
  Trash2, 
  Play, 
  Clock, 
  Activity, 
  Tv, 
  User, 
  Cpu, 
  Loader2, 
  VolumeX, 
  Volume2,
  Check,
  ShieldCheck
} from 'lucide-react';

interface StoryArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  db: any;
}

export const StoryArchiveModal: React.FC<StoryArchiveModalProps> = ({ isOpen, onClose, user, db }) => {
  const { addToast } = useAeirmist();
  const [stories, setStories] = useState<any[]>([]);
  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resolvedViewers, setResolvedViewers] = useState<Record<string, any>>({});
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Selection Mode state for Bulk Delete
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Subscribe to user's stories in real-time
  useEffect(() => {
    if (!isOpen || !user || !db) return;

    setLoading(true);
    const storiesRef = collection(db, 'stories');
    const q = query(
      storiesRef,
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      // Sort client-side by createdAt descending to avoid composite index requirements
      fetched.sort((a: any, b: any) => {
        const getMs = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (val instanceof Date) return val.getTime();
          if (typeof val === 'number') return val;
          if (val.seconds) return val.seconds * 1000;
          return 0;
        };
        return getMs(b.createdAt) - getMs(a.createdAt);
      });
      setStories(fetched);
      setLoading(false);

      // Default select the first story if none is selected
      if (fetched.length > 0 && !selectedStory) {
        setSelectedStory(fetched[0]);
      } else if (fetched.length > 0 && selectedStory) {
        // If selected story still exists, update its reference, else select first
        const updated = fetched.find(s => s.id === selectedStory.id);
        if (updated) {
          setSelectedStory(updated);
        } else {
          setSelectedStory(fetched[0]);
        }
      } else if (fetched.length === 0) {
        setSelectedStory(null);
      }
    }, (error) => {
      console.error('Error fetching archived stories:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [isOpen, user, db]);

  // Resolve story viewers to actual profile names and avatars
  useEffect(() => {
    if (!selectedStory || !db) return;

    const viewers: string[] = selectedStory.viewers || [];
    if (viewers.length === 0) {
      setResolvedViewers({});
      return;
    }

    const fetchViewers = async () => {
      setLoadingViewers(true);
      const newResolved: Record<string, any> = {};

      for (const viewerId of viewers) {
        // Ignore resolved viewer caches to optimize requests
        if (resolvedViewers[viewerId]) {
          newResolved[viewerId] = resolvedViewers[viewerId];
          continue;
        }

        try {
          const profileDoc = await getDoc(doc(db, 'profiles', viewerId));
          if (profileDoc.exists()) {
            newResolved[viewerId] = {
              uid: viewerId,
              ...profileDoc.data()
            };
          } else {
            newResolved[viewerId] = {
              uid: viewerId,
              displayName: 'User',
              username: 'user_node',
              photoURL: getAvatarUrl(null, viewerId)
            };
          }
        } catch (err) {
          console.error(`Failed to resolve profile for viewer ${viewerId}:`, err);
        }
      }

      setResolvedViewers(newResolved);
      setLoadingViewers(false);
    };

    fetchViewers();
  }, [selectedStory?.id, db]);

  const deleteSingleStory = async (storyId: string) => {
    if (!db) return;
    if (!window.confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(storyId);
      await deleteDoc(doc(db, 'stories', storyId));
      if (selectedStory?.id === storyId) {
        setSelectedStory(null);
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      addToast({ title: 'Delete failed', message: 'Could not delete this story. Please try again.', type: 'warning' });
    } finally {
      setDeletingId(null);
    }
  };

  const deleteSelectedStories = async () => {
    if (!db || selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the selected ${selectedIds.length} stories? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      for (const storyId of selectedIds) {
        await deleteDoc(doc(db, 'stories', storyId));
      }
      setSelectedIds([]);
      setIsSelectMode(false);
    } catch (error) {
      console.error('Error deleting selected stories:', error);
      addToast({ title: 'Delete failed', message: 'Could not delete the selected stories. Please try again.', type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  // Safe formatting for timestamps
  const formatTime = (createdAt: any) => {
    if (!createdAt) return 'Loading...';
    try {
      const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Saved';
    }
  };

  if (!isOpen) return null;

  return (
    <div id="story-archive-root" className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 overflow-hidden bg-black/85 backdrop-blur-3xl font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        className="relative w-full max-w-6xl h-[95vh] sm:h-[88vh] rounded-[2rem] sm:rounded-[2.5rem] border border-aeirmist-cyan/30 bg-gradient-to-b from-[#020d1a] to-[#01050a] shadow-[0_0_50px_rgba(0,242,255,0.15)] flex flex-col overflow-hidden"
      >
        {/* Glowing top line */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-aeirmist-cyan via-aeirmist-magenta to-aeirmist-cyan animate-pulse z-40" />
        
        {/* Header Bar */}
        <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between bg-black/60 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)]">
              <Tv size={18} />
            </div>
            <div>
              <h2 className="font-display font-black text-sm sm:text-base uppercase tracking-[0.25em] text-white">
                Story Archive 
              </h2>
              <p className="text-[8px] sm:text-[9px] font-mono font-semibold tracking-widest text-white/40 uppercase mt-0.5">View and manage your past stories</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white/5 border border-white/10 hover:border-aeirmist-magenta/40 hover:bg-aeirmist-magenta/10 hover:text-aeirmist-magenta active:scale-95 transition-all duration-300 flex items-center justify-center text-white/50 group"
          >
            <X size={16} className="transition-transform group-hover:rotate-90 duration-300" />
          </button>
        </div>

        {/* Core Screen Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* Main Visualizer Player (Left on desktop) */}
          <div className="flex-1 flex flex-col bg-black/50 border-r border-[#ffffff05] p-3 sm:p-6 overflow-hidden relative min-h-[300px] md:min-h-0">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-3">
                <Loader2 size={36} className="text-aeirmist-cyan animate-spin" />
                <span className="text-[10px] font-mono uppercase tracking-[0.3em] font-black animate-pulse">Loading archive...</span>
              </div>
            ) : stories.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/5 rounded-[2rem] bg-white/[0.01]">
                <Tv size={48} className="text-aeirmist-cyan/40 mb-4 animate-pulse" />
                <h3 className="font-display font-black text-base uppercase tracking-widest text-white/80">No Archived Stories</h3>
                <p className="text-[10px] font-mono text-white/30 max-w-xs uppercase tracking-wider mt-3 leading-relaxed">
                  You haven't archived any stories yet. Shared stories will appear here.
                </p>
              </div>
            ) : selectedStory ? (
              <div className="flex-1 flex flex-col justify-between items-center rounded-2xl overflow-hidden bg-black/80 border border-white/5 relative p-4 group">
                {/* Visualizer Frame overlay gloss */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.01] to-transparent rotate-12 pointer-events-none" />

                {/* Info Overlay Panel */}
                <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between bg-black/40 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={selectedStory.userAvatar} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-lg border border-aeirmist-cyan/40"
                    />
                    <div className="leading-none">
                      <div className="text-[10px] font-black uppercase text-white tracking-wider">{selectedStory.userName}</div>
                      <div className="text-[8px] font-mono text-aeirmist-cyan/70 tracking-widest mt-1 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-aeirmist-cyan animate-pulse" />
                        Archived Story
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="w-7 h-7 bg-white/5 border border-white/5 rounded-lg flex items-center justify-center text-white/50 hover:text-white"
                    >
                      {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                    </button>
                    <span className="text-[8px] font-medium tracking-widest text-white/40 uppercase">
                      {selectedStory.mediaType === 'video' ? 'Video' : 'Image'}
                    </span>
                  </div>
                </div>

                {/* Media Playback Canvas */}
                <div className="flex-1 w-full flex items-center justify-center overflow-hidden my-14 relative rounded-xl bg-black">
                  {selectedStory.mediaType === 'video' ? (
                    <video 
                      key={selectedStory.id}
                      src={selectedStory.mediaUrl}
                      autoPlay
                      loop
                      muted={isMuted}
                      playsInline
                      className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                    />
                  ) : (
                    <img 
                      src={selectedStory.mediaUrl}
                      alt="Archived Story"
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                    />
                  )}
                </div>

                {/* Controls Area */}
                <div className="w-full z-20 flex items-center justify-between gap-3 bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-aeirmist-cyan" />
                    <span className="text-[9px] font-mono font-bold tracking-widest text-white/80">{formatTime(selectedStory.createdAt)}</span>
                  </div>

                  <button 
                    onClick={() => deleteSingleStory(selectedStory.id)}
                    disabled={deletingId === selectedStory.id}
                    className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500 hover:border-red-500/80 hover:text-white text-red-400 text-[9px] font-mono font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-40 group/del"
                  >
                    {deletingId === selectedStory.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Trash2 size={11} className="transition-transform group-hover/del:scale-110" />
                    )}
                    <span>Delete Story</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Interface Console Panel - List & Views */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/5 flex flex-col overflow-hidden h-[300px] md:h-auto bg-black/30 backdrop-blur-md">
            
            {/* Split controls tab */}
            <div className="p-3 border-b border-white/5 bg-[#010a14] flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-aeirmist-cyan flex items-center gap-1.5">
                  <Clock size={11} /> 
                  Archived Stories ({stories.length})
                </span>
                {stories.length > 0 && (
                  <button
                    onClick={() => {
                      setIsSelectMode(!isSelectMode);
                      setSelectedIds([]);
                    }}
                    className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded border border-white/10 hover:border-white/30 text-white/60 hover:text-white transition-all cursor-pointer"
                  >
                    {isSelectMode ? 'Cancel' : 'Select'}
                  </button>
                )}
              </div>

              {isSelectMode && (
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/5">
                  <button
                    onClick={() => {
                      if (selectedIds.length === stories.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(stories.map(s => s.id));
                      }
                    }}
                    className="text-[9px] font-bold uppercase tracking-wider text-white/50 hover:text-white transition-all cursor-pointer"
                  >
                    {selectedIds.length === stories.length ? 'Deselect All' : 'Select All'}
                  </button>

                  <button
                    onClick={deleteSelectedStories}
                    disabled={selectedIds.length === 0}
                    className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded bg-red-600/20 hover:bg-red-600 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-white disabled:opacity-30 disabled:hover:bg-red-600/20 disabled:hover:text-red-400 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={10} />
                    Delete ({selectedIds.length})
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable grid file list */}
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-4 md:grid-cols-2 gap-2 max-h-[140px] md:max-h-none no-scrollbar">
              {stories.map((story) => {
                const isSelected = selectedStory?.id === story.id;
                const isChecked = selectedIds.includes(story.id);
                return (
                  <button
                    key={story.id}
                    onClick={() => {
                      if (isSelectMode) {
                        setSelectedIds(prev => 
                          prev.includes(story.id) 
                            ? prev.filter(id => id !== story.id) 
                            : [...prev, story.id]
                        );
                      } else {
                        setSelectedStory(story);
                      }
                    }}
                    className={`aspect-square rounded-xl overflow-hidden border relative transition-all duration-300 bg-black/60 scale-95 hover:scale-100 flex flex-col justify-between p-1.5 cursor-pointer ${
                      isSelectMode
                        ? isChecked
                          ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)] ring-1 ring-red-500/20'
                          : 'border-white/5 hover:border-white/20'
                        : isSelected 
                          ? 'border-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.25)] ring-1 ring-aeirmist-cyan/20' 
                          : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    {story.mediaType === 'video' ? (
                      <div className="absolute inset-0 bg-black flex items-center justify-center">
                        <video src={story.mediaUrl} className="w-full h-full object-cover opacity-60" muted playsInline />
                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center text-white/40">
                          <Play size={16} className="fill-current" />
                        </div>
                      </div>
                    ) : (
                      <img src={story.mediaUrl} referrerPolicy="no-referrer" alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                    )}

                    {/* Checkbox overlay in select mode */}
                    {isSelectMode && (
                      <div className="absolute top-1.5 right-1.5 z-20 w-4 h-4 rounded-md border flex items-center justify-center transition-all bg-black/85 border-white/20">
                        {isChecked && (
                          <div className="w-2.5 h-2.5 rounded bg-red-500 flex items-center justify-center text-white">
                            <Check size={8} strokeWidth={4} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Miniature overlay tag */}
                    <div className="relative z-10 w-full flex justify-between items-center bg-black/60 px-1 py-0.5 rounded text-[7px] font-mono text-white/60">
                      <span className="truncate">{story.mediaType === 'video' ? 'Video' : 'Image'}</span>
                      <span className="flex items-center gap-0.5"><Eye size={6} />{story.viewers?.length || 0}</span>
                    </div>

                    <div className="relative z-10 text-[6px] font-mono text-white/40 truncate text-left max-w-full pl-0.5">
                      {story.createdAt ? new Date(story.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Viewer Panel */}
            <div className="border-t border-white/5 bg-black/40 p-3 h-[180px] md:h-[250px] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-black uppercase tracking-widest text-aeirmist-magenta flex items-center gap-1">
                  <Activity size={10} className="text-aeirmist-magenta" />
                  Story Views
                </span>
                
                <span className="text-[10px] font-mono font-bold text-white/80 bg-white/5 px-2 py-0.5 rounded border border-white/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-aeirmist-cyan animate-pulse shadow-[0_0_6px_rgba(0,242,255,1)]" />
                  {selectedStory?.viewers?.length || 0} Views
                </span>
              </div>

              {/* Scrollable list of viewers with names/photos */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar text-left">
                {loadingViewers ? (
                  <div className="h-full flex items-center justify-center text-white/20 gap-2">
                    <Loader2 size={12} className="animate-spin text-aeirmist-magenta" />
                    <span className="text-[8px] font-mono uppercase tracking-widest font-black">Loading viewers...</span>
                  </div>
                ) : !selectedStory || !selectedStory.viewers || selectedStory.viewers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-2 text-white/20">
                    <Cpu size={18} className="text-white/10 mb-1.5" />
                    <span className="text-[8px] font-mono uppercase tracking-[0.15em] font-black">No views yet</span>
                  </div>
                ) : (
                  Object.values(resolvedViewers).map((vProfile: any) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={vProfile.uid} 
                      className="flex items-center justify-between p-2 rounded-xl bg-[#ffffff02] border border-white/5 hover:bg-[#ffffff05] hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <img 
                          src={getAvatarUrl(vProfile.photoURL, vProfile.uid)} 
                          alt="" 
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-lg border border-white/10 shadow-lg shrink-0"
                        />
                        <div className="leading-none min-w-0 max-w-[120px] md:max-w-[140px]">
                          <div className="text-[9px] font-bold text-white uppercase truncate">{vProfile.displayName || 'Anonymous'}</div>
                          <div className="text-[7px] font-mono text-aeirmist-cyan/60 truncate mt-1">@{vProfile.username || 'user'}</div>
                        </div>
                      </div>

                      <div className="text-[7px] font-mono text-white/30 uppercase tracking-widest flex items-center gap-1 shrink-0">
                        {vProfile.isVerified && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={10} />}
                        Viewed
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
};
