import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  EyeOff, 
  Trash2, 
  ShieldAlert, 
  Image as ImageIcon, 
  Search, 
  VolumeX,
  Palette,
  UserPlus,
  Loader2,
  ChevronLeft,
  Lock,
  Edit2,
  ShieldCheck,
  Check,
  CheckCircle2,
  X,
  ChevronRight,
  Play,
  FileText,
  Download,
  ExternalLink
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { collection, query, where, getDocs, limit, orderBy, doc, updateDoc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Chat } from '../../types/messenger';
import { logger } from '@/src/utils/logger';
import { DownloadManagerService } from '../../services/DownloadManagerService';
import { useUserStoryState } from '../ui/Avatar';
import { StoryViewer } from '../feed/StoriesSystem';


export const ChatInfoPanel = ({ 
  chat, 
  onClose, 
  onSearch,
  onOpenAppearance,
  onUserClick
}: { 
  chat: Chat, 
  onClose: () => void, 
  onSearch?: (query: string) => void,
  onOpenAppearance?: () => void,
  onUserClick?: (user: any) => void
}) => {
  const { 
    db, 
    user, 
    profile, 
    toggleNotification, 
    deleteConversation, 
    toggleBlockUser, 
    toggleRestrictUser, 
    toggleCloseFriend, 
    isCloseFriend, 
    setConversationTheme, 
    toggleVanishMode, 
    isBlocked: checkBlocked, 
    isRestricted: checkRestricted, 
    addToast,
    stories,
    optimisticStories
  } = useAeirmist();
  const [sharedMedia, setSharedMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [otherProfile, setOtherProfile] = useState<any>(null);
  const [isNicknamesModalOpen, setIsNicknamesModalOpen] = useState(false);
  const [chatSettings, setChatSettings] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showPermissionsToggle, setShowPermissionsToggle] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [activeStoryGroup, setActiveStoryGroup] = useState<any | null>(null);

  const otherId = chat.otherParticipantId || chat.profileIds?.find(id => id !== profile?.id);
  const otherUid = otherProfile?.uid || otherProfile?.authorUid || (otherProfile?.id && otherProfile.id !== otherId ? otherProfile.id : undefined);

  // Compute active user stories from memory/context
  const userStories = React.useMemo(() => {
    if (!otherId && !otherUid) return [];
    const yesterdayMs = Date.now() - 24 * 60 * 60 * 1000;
    const all = [...(stories || []), ...(optimisticStories || [])];
    return all.filter((s: any) => {
      if (!s) return false;
      const isMatch = (
        (otherId && (s.userId === otherId || s.authorUid === otherId || s.authorId === otherId)) ||
        (otherUid && (s.userId === otherUid || s.authorUid === otherUid || s.authorId === otherUid))
      );
      if (!isMatch) return false;
      const created = s.createdAt;
      if (!created) return true;
      const ms = typeof created.toMillis === 'function' ? created.toMillis() : new Date(created).getTime();
      return !isNaN(ms) ? ms >= yesterdayMs : true;
    });
  }, [stories, optimisticStories, otherId, otherUid]);

  // Real-time hook for Firestore story status
  const autoStoryState = useUserStoryState(otherId, otherUid);
  const hasStory = userStories.length > 0 || autoStoryState !== 'none';
  const hasUnseenStory = React.useMemo(() => {
    if (!hasStory) return false;
    if (userStories.length > 0 && user?.uid) {
      return userStories.some((s: any) => !s.viewers || !s.viewers.includes(user.uid));
    }
    return autoStoryState === 'active';
  }, [hasStory, userStories, user?.uid, autoStoryState]);

  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  
  useEffect(() => {
    if (!db || !otherId) return;
    const unsub = onSnapshot(doc(db, 'profiles', otherId), (snap) => {
      if (snap.exists()) {
        setOtherProfile({ id: snap.id, ...snap.data() });
      }
    });
    return () => unsub();
  }, [db, otherId]);

  useEffect(() => {
    if (!db || !chat.id) return;
    const unsub = onSnapshot(doc(db, 'chat_settings', chat.id), (snap) => {
      if (snap.exists()) {
        setChatSettings(snap.data());
      } else {
        setChatSettings(null);
      }
    });
    return () => unsub();
  }, [db, chat.id]);

  const handleSaveSharedNickname = async (targetUserId: string, newNickname: string) => {
    if (!db || !chat.id) return;
    try {
      const chatSettingsRef = doc(db, 'chat_settings', chat.id);
      await setDoc(chatSettingsRef, {
        nicknames: {
          [targetUserId]: newNickname.trim()
        }
      }, { merge: true });
    } catch (err: any) { logger.error("Save shared nickname failed", err); addToast({ title: "Failed", message: "Failed to save nickname", type: "warning" }); }
  };

  const handleSavePermission = async (perm: 'everyone' | 'only_me') => {
    if (!db || !chat.id || !profile?.id) return;
    try {
      const chatSettingsRef = doc(db, 'chat_settings', chat.id);
      await setDoc(chatSettingsRef, {
        editPermissions: {
          [profile.id]: perm
        }
      }, { merge: true });
    } catch (err: any) { logger.error("Save permission failed", err); addToast({ title: "Failed", message: "Failed to save permission", type: "warning" }); }
  };
  const isBlocked = otherId ? checkBlocked(otherId) : false;
  const isRestricted = otherId ? checkRestricted(otherId) : false;
  const isVibing = otherId ? isCloseFriend(otherId) : false;

  const handleVisitProfile = () => {
    onUserClick?.({
      id: otherId,
      displayName: chat.name,
      photoURL: chat.photo
    });
  };

  useEffect(() => {
    const fetchMedia = async () => {
      if (!db || !chat.id || chat.id.startsWith('new_')) return;
      setLoadingMedia(true);
      try {
        const q = query(
          collection(db, 'conversations', chat.id, 'messages'),
          orderBy('timestamp', 'desc'),
          limit(300)
        );
        const snapshot = await getDocs(q);
        const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        const mediaTypes = ['image', 'video', 'media', 'file'];
        const filteredMedia = allMsgs.filter(m => mediaTypes.includes(m.type));
        setSharedMedia(filteredMedia);
      } catch (e) {
        logger.error("Shared media fetch failed", e);
      } finally {
        setLoadingMedia(false);
      }
    };
    fetchMedia();
  }, [db, chat.id]);

  const handlePrevMedia = () => {
    if (selectedMediaIndex === null || sharedMedia.length === 0) return;
    setSelectedMediaIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : sharedMedia.length - 1));
  };

  const handleNextMedia = () => {
    if (selectedMediaIndex === null || sharedMedia.length === 0) return;
    setSelectedMediaIndex((prev) => (prev !== null && prev < sharedMedia.length - 1 ? prev + 1 : 0));
  };

  useEffect(() => {
    if (selectedMediaIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevMedia();
      } else if (e.key === 'ArrowRight') {
        handleNextMedia();
      } else if (e.key === 'Escape') {
        setSelectedMediaIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMediaIndex, sharedMedia]);

  const isVideo = (media: any) => {
    const url = (media.mediaUrl || media.attachmentUrl || '').toLowerCase();
    const type = (media.type || media.mediaType || '').toLowerCase();
    return type === 'video' || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
  };

  const isImage = (media: any) => {
    const url = (media.mediaUrl || media.attachmentUrl || '').toLowerCase();
    const type = (media.type || media.mediaType || '').toLowerCase();
    return type === 'image' || type === 'media' || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.gif') || url.endsWith('.webp') || (!type && url);
  };

  const isFile = (media: any) => {
    const type = (media.type || media.mediaType || '').toLowerCase();
    return type === 'file' || (!isVideo(media) && !isImage(media));
  };

  const handleMute = async () => {
    await toggleNotification('mute', chat.id);
  };

  const handleVanish = async () => {
    await toggleVanishMode(chat.id);
  };

  const handleVaultToggle = async () => {
    if (!db || !profile || !chat.id) return;
    const currentVaultStatus = chat.isVaulted?.[profile.id] === true;
    try {
      const chatRef = doc(db, 'conversations', chat.id);
      await updateDoc(chatRef, {
        [`isVaulted.${profile.id}`]: !currentVaultStatus
      });
    } catch (e) {
      logger.error("Failed to toggle vault status", e);
    }
  };

  const handleVibe = async () => {
    if (otherId) await toggleCloseFriend(otherId);
  };

  const handleRestrict = async () => {
    if (otherId) {
      await toggleRestrictUser(otherId);
    }
  };

  const handleBlock = async () => {
    if (otherId) {
      if (!isBlocked) {
        const confirmed = confirm(`Are you sure you want to sever the link with ${chat.name}? They will no longer be able to connect with your profile.`);
        if (confirmed) await toggleBlockUser(otherId);
      } else {
        await toggleBlockUser(otherId);
      }
    }
  };

  const handlePurge = async () => {
    if (confirm("Clear this chat? All messages will be permanently deleted.")) {
        await deleteConversation(chat.id);
        onClose();
    }
  };

  const handleAvatarClick = () => {
    if (hasStory) {
      setActiveStoryGroup({
        userId: otherId || otherUid,
        userName: otherProfile?.displayName || chat.name,
        userAvatar: otherProfile?.photoURL || chat.photo,
        stories: userStories.length > 0 ? userStories : [{
          id: 'story_' + (otherId || otherUid),
          userId: otherId || otherUid,
          userName: otherProfile?.displayName || chat.name,
          userAvatar: otherProfile?.photoURL || chat.photo,
          mediaUrl: otherProfile?.photoURL || chat.photo,
          createdAt: new Date()
        }]
      });
    } else {
      handleVisitProfile();
    }
  };

  return (
    <motion.div
      initial={{ x: 300 }}
      animate={{ x: 0 }}
      exit={{ x: 300 }}
      className="w-full md:w-80 h-full border-l border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#06111a]/95 backdrop-blur-3xl overflow-y-auto no-scrollbar shadow-[-20px_0_40px_rgba(0,0,0,0.5)] z-20 flex flex-col"
    >
      <div className="flex-shrink-0 p-8 text-center border-b border-slate-200/80 dark:border-white/5 relative overflow-hidden flex flex-col items-center">
        {/* Mobile Close Button */}
        <div className="md:hidden absolute top-4 left-4 z-50">
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-white/5 rounded-full text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 backdrop-blur border border-slate-200 dark:border-white/10">
             <ChevronLeft size={20} />
          </button>
        </div>

        <div 
          className="relative inline-block mb-4 cursor-pointer group" 
          onClick={handleAvatarClick}
          title={hasStory ? (hasUnseenStory ? "View Story" : "Story viewed") : "View Profile"}
        >
          {/* Outer ring: only shown if user has an active or seen story */}
          <div className={`w-24 h-24 rounded-3xl relative z-10 group-hover:scale-105 transition-all duration-300 ${
            hasStory
              ? hasUnseenStory
                ? 'p-[2.5px] bg-gradient-to-tr from-aeirmist-cyan via-aeirmist-magenta to-aeirmist-cyan shadow-[0_0_16px_rgba(0,242,255,0.35)]'
                : 'p-[2px] bg-slate-300 dark:bg-white/20 shadow-none'
              : 'p-0 bg-transparent shadow-none'
          }`}>
            <div className={`w-full h-full overflow-hidden relative shadow-sm ${
              hasStory
                ? 'rounded-[21px] border-[3px] border-white dark:border-aeirmist-bg'
                : 'rounded-3xl border-2 border-slate-200/90 dark:border-white/10'
            }`}>
              <img 
                src={getAvatarUrl(otherProfile?.photoURL || chat.photo)} 
                alt={otherProfile?.displayName || chat.name} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              />
              {/* Scanline Effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-aeirmist-cyan/10 to-transparent h-1/2 w-full animate-scan pointer-events-none" />
            </div>
          </div>
          {chat.online && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute bottom-1 right-1 w-4 h-4 bg-aeirmist-lime rounded-full border-2 border-white dark:border-aeirmist-bg shadow-[0_0_10px_rgba(191,255,0,0.5)] z-20" 
            />
          )}
        </div>
        
        <div className="flex items-center justify-center gap-1.5 mb-1 max-w-full px-2">
          <h2 className="text-xl font-bold tracking-tight truncate cursor-pointer text-slate-900 dark:text-white hover:text-aeirmist-cyan transition-colors" onClick={handleVisitProfile}>
            {otherProfile?.displayName || chat.name}
          </h2>
          {(otherProfile?.isVerified || chat.participantDetails?.[otherId || '']?.isVerified) && (
            <ShieldCheck className="text-aeirmist-cyan shrink-0" size={18} />
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-white/40 mb-5 font-medium tracking-wide">
          @{otherProfile?.username || chat.participantDetails?.[otherId || '']?.username || (otherProfile?.displayName || chat.name).toLowerCase().replace(/\s+/g, '')}
        </p>
        
        <div className="flex justify-center gap-8 px-2 w-full relative">
          <ActionButton 
            icon={<Search size={16} />} 
            label="Search" 
            onClick={() => setSearchPopoverOpen(prev => !prev)} 
          />
          <ActionButton 
            icon={<UserPlus size={16} className={isVibing ? "text-aeirmist-lime" : ""} />} 
            label={isVibing ? "In Vibe" : "Vibe"} 
            onClick={handleVisitProfile}
          />
          <ActionButton 
            icon={<Palette size={16} />} 
            label="Appearance" 
            onClick={onOpenAppearance}
          />

          {searchPopoverOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 p-3 rounded-2xl bg-[#0a0c10] border border-white/10 shadow-2xl z-30">
              <input
                autoFocus
                type="text"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSearch?.(searchDraft);
                    setSearchPopoverOpen(false);
                  }
                }}
                placeholder="Search in this chat..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan/50"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-8">
        <section>
          <h3 className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black mb-3">Chat Identity</h3>
          
          <button 
            onClick={() => setIsNicknamesModalOpen(true)}
            className="w-full p-4 flex items-center justify-between border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] rounded-2xl transition-all text-left"
          >
            <div className="flex flex-col">
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Nicknames</span>
              <span className="text-xs text-white/50 mt-1">
                {(() => {
                  const myNick = chatSettings?.nicknames?.[profile?.id || ''];
                  const otherNick = chatSettings?.nicknames?.[otherId || ''];
                  if (myNick && otherNick) {
                    return `Set for both participants`;
                  } else if (myNick) {
                    return `Set for you`;
                  } else if (otherNick) {
                    return `Set for ${otherProfile?.displayName || chat.name}`;
                  } else {
                    return "No active nicknames";
                  }
                })()}
              </span>
            </div>
            <ChevronRight size={16} className="text-white/40 shrink-0" />
          </button>
        </section>

        <section>
          <h3 className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black mb-4">Privacy & Access</h3>
          <div className="space-y-4">
            <ToggleItem 
              icon={<Bell />} 
              label="Mute" 
              active={chat.isMuted} 
              onToggle={handleMute}
            />
            <ToggleItem 
              icon={<EyeOff />} 
              label="Vanishing Waves" 
              active={chat.isVanishMode}
              onToggle={handleVanish}
            />
            <ToggleItem 
              icon={<Lock />} 
              label="Lock Chat" 
              active={chat.isVaulted?.[profile?.id || ''] === true}
              onToggle={handleVaultToggle}
            />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">Files & Media</h3>
            {sharedMedia.length > 0 && <span className="text-[9px] text-aeirmist-cyan font-black">{sharedMedia.length}</span>}
          </div>
          {loadingMedia ? (
             <div className="flex justify-center py-12"><Loader2 className="animate-spin text-aeirmist-cyan" size={24} /></div>
          ) : sharedMedia.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto no-scrollbar pr-1">
              {sharedMedia.map((media, idx) => {
                const url = media.mediaUrl || media.attachmentUrl;
                const isVid = isVideo(media);
                const isFil = isFile(media);
                
                return (
                  <motion.div 
                    key={media.id || idx} 
                    whileHover={{ scale: 0.95 }}
                    onClick={() => setSelectedMediaIndex(idx)}
                    className="aspect-square rounded-xl bg-white/5 border border-white/10 overflow-hidden hover:border-aeirmist-cyan/40 transition-all cursor-pointer group relative"
                  >
                    {isVid ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={url} 
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60';
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                          <Play size={18} className="text-white fill-white/85 drop-shadow-lg" />
                        </div>
                      </div>
                    ) : isFil ? (
                      <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center p-2 text-center group-hover:bg-white/10 transition-colors">
                        <FileText size={20} className="text-aeirmist-cyan mb-1 shrink-0" />
                        <span className="text-[8px] text-white/50 truncate w-full px-1">
                          {media.text || "Shared File"}
                        </span>
                      </div>
                    ) : (
                      <img 
                        src={url} 
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" 
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-white/5 rounded-2xl border border-dashed border-white/10">
              <p className="text-[9px] uppercase font-black text-white/20 tracking-widest">No files or media synced</p>
            </div>
          )}
          {sharedMedia.length > 0 && (
            <button 
              onClick={() => {
                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(`
                    <html>
                      <head><title>Memory Bank: ${chat.name}</title><style>body{background:#000;color:#fff;font-family:sans-serif;padding:40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px}img,video{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;border:1px solid #333}h1{grid-column:1/-1;font-size:24px;letter-spacing:4px;text-transform:uppercase;color:#0cf}</style></head>
                      <body>
                        <h1>Shared Media: ${chat.name}</h1>
                        <script>
                          const media = ${JSON.stringify(sharedMedia)};
                          media.forEach(m => {
                            const url = m.mediaUrl || m.attachmentUrl;
                            if (url) {
                              const isVid = url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.webm');
                              if (isVid) {
                                const vid = document.createElement('video');
                                vid.src = url;
                                vid.controls = true;
                                document.body.appendChild(vid);
                              } else {
                                const img = document.createElement('img');
                                img.src = url;
                                document.body.appendChild(img);
                              }
                            }
                          });
                        </script>
                      </body>
                    </html>
                  `);
                }
              }}
              className="w-full mt-4 text-[10px] font-black text-aeirmist-cyan uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-aeirmist-cyan/10 p-3 rounded-xl transition-all border border-transparent hover:border-aeirmist-cyan/20"
            >
              <ImageIcon size={14} /> View Full Bank
            </button>
          )}
        </section>

        {/* Fullscreen Lightbox / Media Viewer Slider */}
        <AnimatePresence>
          {selectedMediaIndex !== null && sharedMedia[selectedMediaIndex] && (() => {
            const currentMedia = sharedMedia[selectedMediaIndex];
            const url = currentMedia.mediaUrl || currentMedia.attachmentUrl;
            const isVid = isVideo(currentMedia);
            const isFil = isFile(currentMedia);

            return (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 md:p-8 select-none"
              >
                {/* Top Bar */}
                <div className="flex items-center justify-between w-full z-30">
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-white/80 tracking-wide uppercase">
                      Files & Media
                    </span>
                    <span className="text-[10px] text-white/40 mt-0.5">
                      {selectedMediaIndex + 1} of {sharedMedia.length}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {url && (
                      <button 
                        onClick={async () => {
                          const res = await DownloadManagerService.downloadMediaFile(url);
                          if (res.success) {
                            addToast?.({ title: 'Saved to Gallery', message: 'File saved directly to device storage.', type: 'success' });
                          } else {
                            addToast?.({ title: 'Download Issue', message: res.error || 'Failed to save file.', type: 'warning' });
                          }
                        }}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                        title="Save to Gallery"
                      >
                        <Download size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => setSelectedMediaIndex(null)}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                      title="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Main Media Content */}
                <div className="flex-1 flex items-center justify-center relative w-full my-4">
                  {/* Navigation - Left */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handlePrevMedia(); }}
                    className="absolute left-2 md:left-4 z-30 p-3 md:p-4 rounded-2xl bg-black/40 border border-white/10 text-white/60 hover:text-white hover:bg-black/60 transition-all flex items-center justify-center"
                  >
                    <ChevronLeft size={24} />
                  </button>

                  {/* Media Container */}
                  <div className="max-w-[90vw] max-h-[75vh] md:max-w-[70vw] md:max-h-[80vh] flex items-center justify-center z-10">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedMediaIndex}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="w-full h-full flex items-center justify-center"
                      >
                        {isVid ? (
                          <video 
                            src={url} 
                            controls 
                            autoPlay 
                            className="max-h-[75vh] md:max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/5" 
                          />
                        ) : isFil ? (
                          <div className="flex flex-col items-center justify-center p-8 bg-[#06111a] border border-white/10 rounded-3xl max-w-md text-center shadow-2xl">
                            <div className="w-16 h-16 rounded-2xl bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan mb-4 border border-aeirmist-cyan/20">
                              <FileText size={32} />
                            </div>
                            <h4 className="text-sm font-bold text-white mb-2 max-w-xs truncate px-4">
                              {currentMedia.text || "Shared File"}
                            </h4>
                            <p className="text-xs text-white/40 mb-6 uppercase tracking-widest font-mono">
                              {url ? url.split('.').pop()?.toUpperCase() : 'UNKNOWN'} FILE
                            </p>
                            {url && (
                              <a 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-6 py-3 rounded-2xl bg-aeirmist-cyan text-black text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                              >
                                <ExternalLink size={14} /> Open file in new tab
                              </a>
                            )}
                          </div>
                        ) : (
                          <img 
                            src={url} 
                            alt="" 
                            className="max-h-[75vh] md:max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/5" 
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Navigation - Right */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleNextMedia(); }}
                    className="absolute right-2 md:right-4 z-30 p-3 md:p-4 rounded-2xl bg-black/40 border border-white/10 text-white/60 hover:text-white hover:bg-black/60 transition-all flex items-center justify-center"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>

                {/* Bottom info section */}
                <div className="text-center pb-2 md:pb-4 z-20">
                  <p className="text-xs text-white/60 max-w-md mx-auto truncate px-4">
                    {currentMedia.text || (isVid ? 'Video' : isFil ? 'File' : 'Image')}
                  </p>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest font-mono mt-1">
                    {currentMedia.timestampMs ? new Date(currentMedia.timestampMs).toLocaleString() : ''}
                  </p>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <section className="pt-4 space-y-2 pb-12">
          <DangerButton 
            icon={<VolumeX />} 
            label={isRestricted ? "Lift Restriction" : "Restrict User"} 
            active={isRestricted}
            onClick={handleRestrict} 
          />
          <DangerButton 
            icon={<ShieldAlert />} 
            label={isBlocked ? "Unblock User" : "Block User"} 
            active={isBlocked}
            onClick={handleBlock}
          />
          <DangerButton icon={<Trash2 />} label="Purge Memory" onClick={handlePurge} />
        </section>
      </div>

      <AnimatePresence>
        {isNicknamesModalOpen && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#06111a] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-sm p-6 relative overflow-hidden flex flex-col max-h-[90vh] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-left"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4 mb-5 relative z-10">
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">Nicknames</h3>
                <button 
                  onClick={() => {
                    setIsNicknamesModalOpen(false);
                    setEditingId(null);
                    setShowPermissionsToggle(false);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Participant List */}
              <div className="space-y-3 overflow-y-auto no-scrollbar relative z-10 flex-1 max-h-[50vh]">
                {[
                  {
                    id: profile?.id || '',
                    displayName: profile?.displayName || profile?.username || 'You',
                    username: profile?.username || 'anonymous',
                    photoURL: profile?.photoURL || chat.participantDetails?.[profile?.id || '']?.photoURL,
                    nickname: chatSettings?.nicknames?.[profile?.id || ''] || '',
                    isMe: true,
                    canEdit: true,
                    isVerified: profile?.isVerified || chat.participantDetails?.[profile?.id || '']?.isVerified
                  },
                  {
                    id: otherId || '',
                    displayName: otherProfile?.displayName || chat.name || 'Aeirmist User',
                    username: otherProfile?.username || chat.participantDetails?.[otherId || '']?.username || '',
                    photoURL: otherProfile?.photoURL || chat.photo,
                    nickname: chatSettings?.nicknames?.[otherId || ''] || '',
                    isMe: false,
                    canEdit: (chatSettings?.editPermissions?.[otherId || ''] || 'everyone') === 'everyone',
                    isVerified: otherProfile?.isVerified || chat.participantDetails?.[otherId || '']?.isVerified
                  }
                ].map((member) => {
                  const isEditing = editingId === member.id;
                  const avatar = getAvatarUrl(member.photoURL, member.id);

                  if (isEditing) {
                    return (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-aeirmist-cyan/40 bg-aeirmist-cyan/[0.04] transition-all"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <img src={avatar} className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-white/10 shrink-0" alt="" />
                          <div className="flex-1 min-w-0">
                            <input 
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveSharedNickname(member.id, editValue);
                                  setEditingId(null);
                                }
                                if (e.key === 'Escape') {
                                  setEditingId(null);
                                }
                              }}
                              autoFocus
                              maxLength={30}
                              placeholder="Add a nickname"
                              className="bg-white dark:bg-black/45 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs w-full focus:outline-none focus:border-aeirmist-cyan placeholder-slate-400 dark:placeholder-white/20 shadow-sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          <button 
                            onClick={() => {
                              handleSaveSharedNickname(member.id, editValue);
                              setEditingId(null);
                            }}
                            className="p-1.5 rounded-lg text-emerald-600 dark:text-aeirmist-lime hover:bg-emerald-50 dark:hover:bg-aeirmist-lime/10 transition-all"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button 
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50/80 dark:bg-white/[0.01] hover:bg-slate-100/90 dark:hover:bg-white/[0.03] transition-all"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <img src={avatar} className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-white/10 shrink-0" alt="" />
                        <div className="flex-1 min-w-0">
                          {member.nickname ? (
                            <>
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                {member.nickname}
                                {member.isMe && <span className="text-[8px] font-black tracking-widest uppercase px-1 py-0.5 rounded bg-slate-200/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-white/40">You</span>}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-white/40 truncate">
                                {member.displayName}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-xs font-bold text-slate-800 dark:text-white/90 truncate flex items-center gap-1.5">
                                {member.displayName}
                                {member.isMe && <span className="text-[8px] font-black tracking-widest uppercase px-1 py-0.5 rounded bg-slate-200/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-white/40">You</span>}
                                {member.isVerified && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-white/40 truncate">
                                @{member.username}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {member.canEdit ? (
                        <button 
                          onClick={() => {
                            setEditingId(member.id);
                            setEditValue(member.nickname);
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 transition-all shrink-0"
                        >
                          <Edit2 size={14} />
                        </button>
                      ) : (
                        <div className="p-2 text-slate-300 dark:text-white/20 shrink-0" title="Only they can edit their nickname">
                          <Lock size={14} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer Section */}
              <div className="mt-6 border-t border-slate-100 dark:border-white/5 pt-4 flex flex-col items-center relative z-10">
                <p className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest text-center mb-2.5 font-medium">
                  Nicknames are only visible in this chat.
                </p>
                
                <button 
                  onClick={() => setShowPermissionsToggle(!showPermissionsToggle)}
                  className="text-xs font-bold text-aeirmist-cyan hover:underline transition-all"
                >
                  Change who can edit your nickname
                </button>

                <AnimatePresence>
                  {showPermissionsToggle && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full border border-white/5 bg-white/[0.01] rounded-2xl p-4 mt-4 space-y-3 overflow-hidden text-left"
                    >
                      <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">
                        Who can change your nickname?
                      </p>
                      <div className="space-y-2">
                        {[
                          { value: 'everyone', label: 'Everyone in this chat', desc: 'The other participant can also edit your nickname' },
                          { value: 'only_me', label: 'Only you', desc: 'Only you can change your nickname' }
                        ].map((opt) => {
                          const isSelected = (chatSettings?.editPermissions?.[profile?.id || ''] || 'everyone') === opt.value;
                          return (
                            <button 
                              key={opt.value}
                              onClick={() => handleSavePermission(opt.value as 'everyone' | 'only_me')}
                              className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                                isSelected
                                  ? 'bg-gradient-to-tr from-aeirmist-cyan/10 to-transparent border-aeirmist-cyan text-aeirmist-cyan font-bold'
                                  : 'bg-black/20 border-white/5 text-white/60 hover:text-white hover:border-white/10'
                              }`}
                            >
                              <div className="flex flex-col pr-2">
                                <span className="text-xs font-bold">{opt.label}</span>
                                <span className="text-[9px] opacity-70 mt-0.5 leading-normal">{opt.desc}</span>
                              </div>
                              {isSelected && <Check size={16} className="text-aeirmist-cyan shrink-0 animate-fade-in" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULLSCREEN STORY VIEWER MODAL */}
      <AnimatePresence>
        {activeStoryGroup && (
          <StoryViewer 
            group={activeStoryGroup} 
            onClose={() => setActiveStoryGroup(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ActionButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform">
    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-700 dark:text-white/70 group-hover:text-slate-900 dark:group-hover:text-white transition-all border border-slate-200/80 dark:border-white/10 shadow-inner">
      {icon}
    </div>
    <span className="text-[9px] font-semibold text-slate-500 dark:text-white/50 group-hover:text-slate-800 dark:group-hover:text-white/80 transition-colors tracking-wide">{label}</span>
  </button>
);

const ToggleItem = ({ icon, label, active, onToggle, disabled }: { icon: React.ReactNode, label: string, active?: boolean, onToggle?: () => void, disabled?: boolean }) => (
  <div 
    className={`flex items-center justify-between group cursor-pointer ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    onClick={!disabled ? onToggle : undefined}
  >
    <div className="flex items-center gap-3">
      <div className={`transition-colors ${active ? 'text-aeirmist-cyan' : 'text-slate-400 dark:text-white/40 group-hover:text-slate-600 dark:group-hover:text-white'}`}>
        {React.cloneElement(icon as any, { size: 18 })}
      </div>
      <span className={`text-xs font-bold uppercase tracking-widest ${active ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-white/60 group-hover:text-slate-900 dark:group-hover:text-white'}`}>{label}</span>
    </div>
    <div className={`w-9 h-5 rounded-full relative transition-colors ${active ? 'bg-aeirmist-cyan' : 'bg-slate-200 dark:bg-white/10'}`}>
      <motion.div 
        animate={{ x: active ? 20 : 4 }}
        className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm" 
      />
    </div>
  </div>
);

const DangerButton = ({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick?: () => void, active?: boolean }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 p-3.5 mb-2 rounded-xl mb-1 transition-all group border ${
      active 
        ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
        : 'bg-white/5 border-white/5 hover:bg-red-500/10 hover:border-red-500/30 text-white/70 hover:text-red-400'
    }`}
  >
    <div className={`p-2 rounded-lg transition-colors ${active ? 'bg-red-500/20 text-red-500' : 'bg-black/30 group-hover:bg-red-500/20 group-hover:text-red-500 text-white/50'}`}>
       {React.cloneElement(icon as any, { size: 18 })}
    </div>
    <span className="text-sm font-semibold tracking-wide text-left flex-1">{label}</span>
  </button>
);
