import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Music, Users, Shield, X, Globe, Camera, Loader2, Trash2, Heart, Eye, 
  MessageCircle, Volume2, Search, CheckCircle2, MoreHorizontal, UserPlus, UserMinus,
  EyeOff, ShieldCheck, Check, Sparkles, Disc, Play, Pause, Send, ExternalLink, Sliders, Radio, Share2
} from 'lucide-react';
import { doc, deleteDoc, updateDoc, serverTimestamp, Timestamp, onSnapshot, getDoc } from 'firebase/firestore';
import { formatAeirmistTimestamp, formatActiveStatus, extractTimestampMs } from '../../lib/date';
import { useAeirmist } from '../../context/AeirmistContext';
import { useInboxData } from '../../hooks/useInboxData';
import { getAvatarUrl } from '../../lib/avatar';
import { MusicSearchModal } from '../music/MusicSearchModal';
import { logger } from '@/src/utils/logger';


const REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

const getRelativeTime = (timestamp: any) => {
  if (!timestamp) return 'now';
  const time = timestamp?.toMillis ? timestamp.toMillis() : timestamp?.seconds ? timestamp.seconds * 1000 : Date.now();
  const diff = Math.floor((Date.now() - time) / 60000);
  if (diff < 1) return 'now';
  if (diff < 60) return `${diff}m`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

// Global cache for live user profile photos & names to avoid refetching
const profilePhotoCache: Record<string, string> = {};
export const profileNameCache: Record<string, string> = {};

export const isValidName = (name?: string | null): boolean => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim().toLowerCase();
  return (
    trimmed !== '' &&
    trimmed !== 'unknown' &&
    trimmed !== 'unknown user' &&
    trimmed !== 'aeirmist user' &&
    trimmed !== 'user' &&
    trimmed !== 'null' &&
    trimmed !== 'undefined'
  );
};

export const getFirstName = (name?: string | null): string => {
  if (!isValidName(name)) return '';
  const trimmed = (name || '').trim();
  const clean = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return clean.split(/\s+/)[0] || clean;
};

export const NoteUserAvatar = ({
  userId,
  authorUid,
  fallbackPhoto,
  alt = "",
  className = "w-full h-full object-cover",
  roundedClassName = "rounded-2xl"
}: {
  userId?: string;
  authorUid?: string;
  fallbackPhoto?: string;
  alt?: string;
  className?: string;
  roundedClassName?: string;
}) => {
  const { db, profile, user } = useAeirmist();

  const getCleanPhoto = (p?: string | null) => {
    if (!p || typeof p !== 'string') return undefined;
    const trimmed = p.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed.includes('data:image/svg+xml') || trimmed.includes('default_avatar')) {
      return undefined;
    }
    return trimmed;
  };

  const [photo, setPhoto] = useState<string | undefined>(() => {
    const cleanFallback = getCleanPhoto(fallbackPhoto);
    if (cleanFallback) return cleanFallback;

    if (userId && profile && (userId === profile.id || userId === user?.uid)) {
      const ownPhoto = getCleanPhoto(profile.photoURL || user?.photoURL);
      if (ownPhoto) return ownPhoto;
    }

    if (userId && profilePhotoCache[userId]) return profilePhotoCache[userId];
    if (authorUid && profilePhotoCache[authorUid]) return profilePhotoCache[authorUid];

    return undefined;
  });

  useEffect(() => {
    const cleanFallback = getCleanPhoto(fallbackPhoto);
    if (cleanFallback) {
      setPhoto(cleanFallback);
    }
  }, [fallbackPhoto]);

  useEffect(() => {
    if (userId && profile && (userId === profile.id || userId === user?.uid)) {
      const ownPhoto = getCleanPhoto(profile.photoURL || user?.photoURL);
      if (ownPhoto) {
        setPhoto(ownPhoto);
        profilePhotoCache[userId] = ownPhoto;
        return;
      }
    }

    if (!db) return;
    const targetIds = [userId, authorUid].filter(Boolean) as string[];
    if (targetIds.length === 0) return;

    for (const id of targetIds) {
      if (profilePhotoCache[id]) {
        setPhoto(profilePhotoCache[id]);
        return;
      }
    }

    const unsubs: (() => void)[] = [];

    targetIds.forEach(id => {
      // 1. Direct subscription
      const unsub = onSnapshot(doc(db, 'profiles', id), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const pUrl = getCleanPhoto(data?.photoURL || data?.photo || data?.avatar);
          if (pUrl) {
            profilePhotoCache[id] = pUrl;
            if (userId) profilePhotoCache[userId] = pUrl;
            if (authorUid) profilePhotoCache[authorUid] = pUrl;
            setPhoto(pUrl);
            return;
          }
        }

        // 2. Prefix variations
        if (!id.startsWith('profile_')) {
          getDoc(doc(db, 'profiles', `profile_${id}`)).then(pSnap => {
            if (pSnap.exists()) {
              const pData = pSnap.data();
              const pUrl2 = getCleanPhoto(pData?.photoURL || pData?.photo || pData?.avatar);
              if (pUrl2) {
                profilePhotoCache[id] = pUrl2;
                if (userId) profilePhotoCache[userId] = pUrl2;
                if (authorUid) profilePhotoCache[authorUid] = pUrl2;
                setPhoto(pUrl2);
              }
            }
          }).catch(() => {});
        } else {
          const rawId = id.replace('profile_', '');
          getDoc(doc(db, 'profiles', rawId)).then(pSnap => {
            if (pSnap.exists()) {
              const pData = pSnap.data();
              const pUrl2 = getCleanPhoto(pData?.photoURL || pData?.photo || pData?.avatar);
              if (pUrl2) {
                profilePhotoCache[id] = pUrl2;
                if (userId) profilePhotoCache[userId] = pUrl2;
                if (authorUid) profilePhotoCache[authorUid] = pUrl2;
                setPhoto(pUrl2);
              }
            }
          }).catch(() => {});
        }

        // 3. Check users collection
        getDoc(doc(db, 'users', id)).then(uSnap => {
          if (uSnap.exists()) {
            const uData = uSnap.data();
            const uUrl = getCleanPhoto(uData?.photoURL || uData?.photo || uData?.avatar);
            if (uUrl) {
              profilePhotoCache[id] = uUrl;
              if (userId) profilePhotoCache[userId] = uUrl;
              if (authorUid) profilePhotoCache[authorUid] = uUrl;
              setPhoto(uUrl);
            }
          }
        }).catch(() => {});
      }, (err) => {
        logger.warn("Live note avatar subscription warning:", err);
      });

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [db, userId, authorUid, profile?.photoURL, user?.photoURL]);

  if (photo) {
    return (
      <img 
        src={photo} 
        alt={alt} 
        className={`${className} ${roundedClassName}`}
        onError={() => setPhoto(undefined)}
        referrerPolicy="no-referrer"
      />
    );
  }

  const initial = (alt || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className={`${className} ${roundedClassName} bg-gradient-to-br from-[#242735] via-[#1a1c26] to-[#12131a] border border-white/10 flex items-center justify-center font-bold text-white shadow-inner select-none`}>
      <span className="text-xl font-bold tracking-wider text-white/90">{initial}</span>
    </div>
  );
};

export const LiveNoteAuthorName = ({
  userId,
  authorUid,
  fallbackName,
  username,
  onlyFirstName = true,
  className = ""
}: {
  userId?: string;
  authorUid?: string;
  fallbackName?: string;
  username?: string;
  onlyFirstName?: boolean;
  className?: string;
}) => {
  const { db, profile, user } = useAeirmist();

  const getCleanFallback = () => {
    if (isValidName(fallbackName)) return fallbackName!.trim();
    if (userId && profile && (userId === profile.id || userId === user?.uid)) {
      return profile.displayName || profile.username || 'You';
    }
    if (userId && isValidName(profileNameCache[userId])) {
      return profileNameCache[userId];
    }
    if (authorUid && isValidName(profileNameCache[authorUid])) {
      return profileNameCache[authorUid];
    }
    if (isValidName(username)) return username!.trim();
    return '';
  };

  const [liveName, setLiveName] = useState<string>(() => getCleanFallback());

  useEffect(() => {
    const clean = getCleanFallback();
    if (clean) setLiveName(clean);
  }, [fallbackName, username, userId, authorUid]);

  useEffect(() => {
    if (!db) return;
    const targetIds = [userId, authorUid].filter(Boolean) as string[];
    if (targetIds.length === 0) return;

    for (const id of targetIds) {
      if (isValidName(profileNameCache[id])) {
        setLiveName(profileNameCache[id]);
        return;
      }
    }

    const unsubs: (() => void)[] = [];

    targetIds.forEach(id => {
      const unsub = onSnapshot(doc(db, 'profiles', id), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const name = data?.displayName || data?.username || data?.name;
          if (isValidName(name)) {
            const cleanName = name.trim();
            profileNameCache[id] = cleanName;
            if (userId) profileNameCache[userId] = cleanName;
            if (authorUid) profileNameCache[authorUid] = cleanName;
            setLiveName(cleanName);
            return;
          }
        }

        const altId = id.startsWith('profile_') ? id.replace('profile_', '') : `profile_${id}`;
        getDoc(doc(db, 'profiles', altId)).then(altSnap => {
          if (altSnap.exists()) {
            const altData = altSnap.data();
            const altName = altData?.displayName || altData?.username || altData?.name;
            if (isValidName(altName)) {
              const cleanName = altName.trim();
              profileNameCache[id] = cleanName;
              if (userId) profileNameCache[userId] = cleanName;
              if (authorUid) profileNameCache[authorUid] = cleanName;
              setLiveName(cleanName);
            }
          }
        }).catch(() => {});
      }, (err) => {
        logger.warn("Live note author name error:", err);
      });

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [db, userId, authorUid]);

  const raw = liveName || getCleanFallback() || (username ? `@${username}` : '') || 'User';
  const displayText = onlyFirstName ? (getFirstName(raw) || raw.split(/\s+/)[0] || 'User') : raw;

  return <span className={className}>{displayText}</span>;
};

export const NotesSystem = ({ chats, onChatSelect, onReplyNote }: { chats: any[], onChatSelect?: (chatId: string) => void, onReplyNote?: (chatId: string, noteText: string, authorName: string) => void }) => {
  const { user, profile, onlineUsers, setCameraConfig, uploadMedia, db, addToast, toggleCloseFriend, isCloseFriend, searchUsers, sendMessage } = useAeirmist();
  
  // Extract participant IDs to sync notes for active chat members
  const chatOtherParticipantIds = (chats || []).map(chat => {
    if (!chat) return '';
    return chat.otherParticipantId || 
           chat.profileIds?.find((id: string) => id !== profile?.id) || 
           chat.participants?.find((id: string) => id !== profile?.id) || 
           (typeof chat.id === 'string' ? chat.id.replace(profile?.id || '', '').replace('_', '') : '');
  }).filter((id): id is string => Boolean(id && typeof id === 'string' && id.trim()));

  const { notes, createNote, deleteNote, activeStories, loading: notesLoading } = useInboxData(chatOtherParticipantIds);
  
  // Note Creator State
  const [isCreating, setIsCreating] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (noteTextareaRef.current) {
      noteTextareaRef.current.style.height = 'auto';
      noteTextareaRef.current.style.height = `${Math.min(Math.max(48, noteTextareaRef.current.scrollHeight), 120)}px`;
    }
  }, [noteContent, isCreating]);
  const [audience, setAudience] = useState<'public' | 'followers' | 'closeFriends'>('public');
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [musicClipStart, setMusicClipStart] = useState<number>(0);
  const [musicClipDuration, setMusicClipDuration] = useState<number>(30);
  const [musicStyle, setMusicStyle] = useState<'badge' | 'lyrics' | 'disc'>('badge');
  const [musicLyrics, setMusicLyrics] = useState<string>('');
  const [isAuditioning, setIsAuditioning] = useState<boolean>(false);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [media, setMedia] = useState<{ url: string, file: File, type: 'image' | 'video' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Close Friends & Hide Note Privacy States
  const [isCloseFriendsModalOpen, setIsCloseFriendsModalOpen] = useState(false);
  const [isHideNotesModalOpen, setIsHideNotesModalOpen] = useState(false);
  const [hiddenFromUserIds, setHiddenFromUserIds] = useState<string[]>([]);
  const [closeFriendsSearch, setCloseFriendsSearch] = useState('');
  const [hideNotesSearch, setHideNotesSearch] = useState('');
  const [remoteSearchResults, setRemoteSearchResults] = useState<any[]>([]);

  // Viewing State
  const [selectedFriendNote, setSelectedFriendNote] = useState<{note: any, chat: any} | null>(null);
  const [viewingMyNote, setViewingMyNote] = useState(false);
  const [activeSheet, setActiveSheet] = useState<'seen' | 'reactions' | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
        auditionAudioRef.current = null;
      }
    };
  }, []);

  // Stop playback when modals close if no shelf note is playing
  useEffect(() => {
    if (!selectedFriendNote && !viewingMyNote && !playingNoteId) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      setIsPlayingMusic(false);
    }
  }, [selectedFriendNote, viewingMyNote, playingNoteId]);

  useEffect(() => {
    if (!isCreating) {
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
        auditionAudioRef.current = null;
      }
      setIsAuditioning(false);
    }
  }, [isCreating]);

  // Audition playback in creator
  const toggleAudition = () => {
    const audioUrl = selectedMusic?.audioURL || selectedMusic?.previewUrl || selectedMusic?.url;
    if (!audioUrl) return;

    if (isAuditioning && auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      setIsAuditioning(false);
    } else {
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      auditionAudioRef.current = audio;
      audio.currentTime = musicClipStart;
      audio.play().then(() => {
        setIsAuditioning(true);
      }).catch(err => logger.warn("Audition error:", err));

      audio.ontimeupdate = () => {
        if (audio.currentTime >= musicClipStart + musicClipDuration) {
          audio.pause();
          setIsAuditioning(false);
        }
      };
      audio.onended = () => {
        setIsAuditioning(false);
      };
    }
  };

  const handleSeekClipStart = (newStart: number) => {
    setMusicClipStart(newStart);
    if (auditionAudioRef.current && isAuditioning) {
      auditionAudioRef.current.currentTime = newStart;
    }
  };

  const togglePlayMusic = (url?: string, startSec = 0, durationSec = 30, noteId?: string) => {
    if (!url) return;
    if (activeAudioRef.current && isPlayingMusic && (!noteId || playingNoteId === noteId)) {
      activeAudioRef.current.pause();
      setIsPlayingMusic(false);
      setPlayingNoteId(null);
    } else {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      const audio = new Audio(url);
      activeAudioRef.current = audio;
      if (startSec > 0) {
        audio.currentTime = startSec;
      }
      audio.play().then(() => {
        setIsPlayingMusic(true);
        if (noteId) setPlayingNoteId(noteId);
      }).catch(err => {
        logger.warn("Audio playback not permitted or failed", err);
      });
      audio.ontimeupdate = () => {
        if (durationSec && audio.currentTime >= startSec + durationSec) {
          audio.pause();
          setIsPlayingMusic(false);
          setPlayingNoteId(null);
        }
      };
      audio.onended = () => {
        setIsPlayingMusic(false);
        setPlayingNoteId(null);
      };
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  const myNote = notes.find(n => n.authorId === profile?.id);

  const closeFriendsList = React.useMemo(() => {
    return Array.from(new Set([
      ...(profile?.social?.closeFriends || []),
      ...(profile?.closeFriends || [])
    ]));
  }, [profile?.social?.closeFriends, profile?.closeFriends]);

  // Candidate users from active chats
  const candidateUsers = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; photo?: string; username?: string }>();
    
    (chats || []).forEach(chat => {
      if (!chat) return;
      const otherId = chat.otherParticipantId || 
                      chat.profileIds?.find((id: string) => id !== profile?.id) || 
                      chat.participants?.find((id: string) => id !== profile?.id) || 
                      (typeof chat.id === 'string' ? chat.id.replace(profile?.id || '', '').replace('_', '') : '');
      if (otherId && typeof otherId === 'string' && otherId.trim() && otherId !== profile?.id) {
        const cleanChatName = isValidName(chat.name) ? chat.name : (isValidName(chat.displayName) ? chat.displayName : (chat.username || 'User'));
        map.set(otherId, {
          id: otherId,
          name: cleanChatName,
          photo: chat.photo || chat.photoURL,
          username: chat.username || ''
        });
      }
    });

    return Array.from(map.values());
  }, [chats, profile?.id]);

  // Shelf items combining notes and genuinely active/online contacts
  const shelfItems = React.useMemo(() => {
    const items: Array<{
      id: string;
      userId: string;
      name: string;
      photo?: string;
      username?: string;
      hasNote: boolean;
      note?: any;
      isOnline: boolean;
      chat: any;
      activityTime: number;
    }> = [];

    const processedUserIds = new Set<string>();
    if (profile?.id) processedUserIds.add(profile.id);

    // 1. Users who posted Notes
    notes.filter(n => n.authorId !== profile?.id).forEach(friendNote => {
      const otherId = friendNote.authorId;
      if (!otherId || processedUserIds.has(otherId)) return;
      processedUserIds.add(otherId);

      const matchingChat = (chats || []).find(c => {
        return c.profileIds?.includes(otherId) || c.participants?.includes(otherId) || c.id?.includes(otherId);
      });
      const resolvedName = isValidName(friendNote.userName)
        ? friendNote.userName
        : (matchingChat && isValidName(matchingChat.name)
            ? matchingChat.name
            : (profileNameCache[otherId] || friendNote.username || 'User'));

      const chat = matchingChat || {
        id: `direct_${profile?.id}_${otherId}`,
        name: resolvedName,
        photo: friendNote.userAvatar,
        otherParticipantId: otherId,
        profileIds: [profile?.id, otherId],
        participants: [profile?.id, otherId]
      };

      const noteTime = extractTimestampMs(friendNote.createdAt);
      items.push({
        id: friendNote.id || otherId,
        userId: otherId,
        name: resolvedName,
        photo: friendNote.userAvatar || chat.photo,
        username: chat.username || friendNote.username,
        hasNote: true,
        note: friendNote,
        isOnline: !!onlineUsers?.has?.(otherId),
        chat,
        activityTime: noteTime
      });
    });

    // 2. Contacts/Friends from active chats who are currently ACTIVE / ONLINE
    candidateUsers.forEach(cand => {
      if (processedUserIds.has(cand.id)) return;
      const isOnline = !!onlineUsers?.has?.(cand.id);
      if (!isOnline) return; // ONLY genuinely active accounts!
      processedUserIds.add(cand.id);

      const matchingChat = (chats || []).find(c => {
        return c.profileIds?.includes(cand.id) || c.participants?.includes(cand.id) || c.id?.includes(cand.id);
      });
      const candName = isValidName(cand.name)
        ? cand.name
        : (matchingChat && isValidName(matchingChat.name)
            ? matchingChat.name
            : (cand.username || 'User'));

      const chat = matchingChat || {
        id: `direct_${profile?.id}_${cand.id}`,
        name: candName,
        photo: cand.photo,
        otherParticipantId: cand.id,
        profileIds: [profile?.id, cand.id],
        participants: [profile?.id, cand.id]
      };

      items.push({
        id: cand.id,
        userId: cand.id,
        name: candName,
        photo: cand.photo,
        username: cand.username,
        hasNote: false,
        isOnline: true,
        chat,
        activityTime: chat.latestMessageAtMs || chat.updatedAtMs || 0
      });
    });

    // Sort: Notes first (by note time DESC), then active online contacts (by activity time DESC)
    return items.sort((a, b) => {
      if (a.hasNote && !b.hasNote) return -1;
      if (!a.hasNote && b.hasNote) return 1;
      return (b.activityTime || 0) - (a.activityTime || 0);
    });
  }, [notes, candidateUsers, onlineUsers, chats, profile?.id]);

  // Remote search logic for Close Friends / Hide Notes modals
  useEffect(() => {
    const query = closeFriendsSearch || hideNotesSearch;
    if (!query || query.length < 2) {
      setRemoteSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        if (searchUsers) {
          const res = await searchUsers(query);
          setRemoteSearchResults(res || []);
        }
      } catch (e) {}
    }, 300);
    return () => clearTimeout(timer);
  }, [closeFriendsSearch, hideNotesSearch, searchUsers]);

  const filteredCloseFriendsCandidates = React.useMemo(() => {
    const query = closeFriendsSearch.toLowerCase().trim();
    const baseMap = new Map<string, any>();

    candidateUsers.forEach(u => baseMap.set(u.id, u));
    remoteSearchResults.forEach(u => {
      if (u.id && u.id !== profile?.id) {
        baseMap.set(u.id, {
          id: u.id,
          name: u.displayName || u.username || 'User',
          photo: u.photoURL,
          username: u.username
        });
      }
    });

    const all = Array.from(baseMap.values());
    if (!query) return all;
    return all.filter(u => 
      u.name.toLowerCase().includes(query) || 
      (u.username && u.username.toLowerCase().includes(query))
    );
  }, [candidateUsers, remoteSearchResults, closeFriendsSearch, profile?.id]);

  const filteredHideNotesCandidates = React.useMemo(() => {
    const query = hideNotesSearch.toLowerCase().trim();
    const baseMap = new Map<string, any>();

    candidateUsers.forEach(u => baseMap.set(u.id, u));
    remoteSearchResults.forEach(u => {
      if (u.id && u.id !== profile?.id) {
        baseMap.set(u.id, {
          id: u.id,
          name: u.displayName || u.username || 'User',
          photo: u.photoURL,
          username: u.username
        });
      }
    });

    const all = Array.from(baseMap.values());
    if (!query) return all;
    return all.filter(u => 
      u.name.toLowerCase().includes(query) || 
      (u.username && u.username.toLowerCase().includes(query))
    );
  }, [candidateUsers, remoteSearchResults, hideNotesSearch, profile?.id]);

  // Handle ESC to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedFriendNote(null);
        setViewingMyNote(false);
        setActiveSheet(null);
        setIsCreating(false);
        setIsMusicModalOpen(false);
        setIsCloseFriendsModalOpen(false);
        setIsHideNotesModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openCamera = () => {
    setCameraConfig({
      isOpen: true,
      mode: 'PHOTO',
      onCapture: (file) => {
        setMedia({
          url: URL.createObjectURL(file),
          file,
          type: file.type.startsWith('video') ? 'video' : 'image'
        });
      }
    });
  };

  const handleOpenCreator = () => {
    if (myNote) {
      setViewingMyNote(true);
    } else {
      setNoteContent('');
      setSelectedMusic(null);
      setMusicClipStart(0);
      setMusicClipDuration(30);
      setMusicStyle('badge');
      setMusicLyrics('');
      setAudience('public');
      setMedia(null);
      setHiddenFromUserIds([]);
      setIsCreating(true);
    }
  };

  const handleDeleteNote = async () => {
    if (!myNote?.id) return;
    try {
      await deleteNote(myNote.id);
      setViewingMyNote(false);
      addToast?.({ title: "Note Deleted", message: "Your note has been removed.", type: "success" });
    } catch (e: any) { 
      logger.error("Failed to delete note:", e); 
      addToast?.({ title: "Failed", message: "Failed to delete note", type: "warning" }); 
    }
  };

  const handleCreate = async () => {
    if (!noteContent.trim() && !media && !selectedMusic) return;
    
    let mediaUrl = media ? media.url : '';
    let mediaType: 'image' | 'video' | undefined = media ? media.type : undefined;

    if (media && media.file) {
      setIsUploading(true);
      try {
        mediaUrl = await uploadMedia(media.file, `notes/${user?.uid}`);
        mediaType = media.type;
      } catch (error: any) { 
        logger.error("Note media upload failed:", error); 
        addToast?.({ title: "Failed", message: "Upload failed", type: "warning" }); 
      } finally {
        setIsUploading(false);
      }
    }

    const musicString = selectedMusic ? `${selectedMusic.title} - ${selectedMusic.artist}` : '';
    const musicData = selectedMusic ? {
      title: selectedMusic.title,
      artist: selectedMusic.artist,
      url: selectedMusic.audioURL || selectedMusic.streamURL || selectedMusic.previewURL || selectedMusic.previewUrl || selectedMusic.url || null,
      coverUrl: selectedMusic.coverArtURL || selectedMusic.albumArtUrl || selectedMusic.albumArtURL || null,
      spotifyUrl: selectedMusic.spotifyURL || selectedMusic.spotifyUrl || null,
      clipStart: musicClipStart,
      clipDuration: musicClipDuration,
      style: musicStyle,
      lyrics: musicLyrics
    } : undefined;

    if (myNote && db) {
      try {
        await updateDoc(doc(db, 'notes', myNote.id), {
          content: noteContent,
          music: musicString || null,
          musicUrl: musicData?.url || null,
          musicCover: musicData?.coverUrl || null,
          spotifyUrl: musicData?.spotifyUrl || null,
          musicClipStart: musicClipStart,
          musicClipDuration: musicClipDuration,
          musicStyle: musicStyle,
          musicLyrics: musicLyrics,
          mediaUrl: mediaUrl || null,
          mediaType: mediaType || null,
          audience,
          visibleTo: audience === 'closeFriends' ? (profile?.social?.closeFriends || []) : [],
          hiddenFrom: hiddenFromUserIds,
          createdAt: serverTimestamp()
        });
      } catch (err: any) {
        addToast?.({ title: "Update Failed", message: err?.message || "Could not update note. Please try again.", type: "warning" });
        return;
      }
    } else {
      try {
        await createNote(noteContent, audience, musicString, mediaUrl, mediaType, hiddenFromUserIds, musicData);
      } catch (err: any) {
        addToast?.({ title: "Share Failed", message: err?.message || "Could not share note. Please try again.", type: "warning" });
        return;
      }
    }
    
    setNoteContent('');
    setSelectedMusic(null);
    setMusicClipStart(0);
    setMusicClipDuration(30);
    setMusicStyle('badge');
    setMusicLyrics('');
    setMedia(null);
    setHiddenFromUserIds([]);
    setIsCreating(false);
    addToast?.({ title: "Note Shared", message: "Your note is now visible to others.", type: "success" });
  };

  const handleReact = async (noteId: string, emoji: string) => {
    if (!db || !profile) return;
    try {
      const noteRef = doc(db, 'notes', noteId);
      const currentNote = notes.find(n => n.id === noteId);
      if (!currentNote) return;
      
      const existingReactions = currentNote.reactions || [];
      const newReaction = { userId: profile.id, emoji, timestamp: Date.now(), userName: profile.displayName, userAvatar: profile.photoURL };
      
      const alreadyReacted = existingReactions.find((r: any) => r.userId === profile.id && r.emoji === emoji);
      if (alreadyReacted) {
        await updateDoc(noteRef, {
          reactions: existingReactions.filter((r: any) => !(r.userId === profile.id && r.emoji === emoji))
        });
      } else {
        await updateDoc(noteRef, {
          reactions: [...existingReactions, newReaction]
        });
      }
    } catch (err) {}
  };

  const handleNoteSeen = async (noteId: string) => {
    if (!db || !profile) return;
    try {
      const noteRef = doc(db, 'notes', noteId);
      const currentNote = notes.find(n => n.id === noteId);
      if (!currentNote) return;
      
      // If it's my own note, don't mark as seen
      if (currentNote.authorId === profile.id) return;

      const existingSeenBy = currentNote.seenBy || [];
      if (!existingSeenBy.find((s: any) => s.userId === profile.id)) {
        await updateDoc(noteRef, {
          seenBy: [...existingSeenBy, { userId: profile.id, timestamp: Date.now(), userName: profile.displayName, userAvatar: profile.photoURL }]
        });
      }
    } catch(err) {}
  };

  useEffect(() => {
    if (selectedFriendNote?.note?.id) {
      handleNoteSeen(selectedFriendNote.note.id);
    }
  }, [selectedFriendNote?.note?.id]);

  return (
    <div className="relative select-none bg-black/20">
      <div className="absolute inset-0 bg-gradient-to-r from-aeirmist-cyan/5 via-transparent to-aeirmist-magenta/5 pointer-events-none" />
      
      <motion.div 
        ref={scrollRef}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
        }}
        className="px-4 pt-2 pb-3.5 flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory relative z-10"
      >
        {/* My Note / Add Note */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, scale: 0.8, y: 10 },
            visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 25 } }
          }}
          className="flex flex-col items-center flex-shrink-0 min-w-16 relative snap-start"
        >
          <div 
            className="relative cursor-pointer group flex flex-col items-center w-full" 
            onClick={() => {
              if (myNote) {
                if (myNote.musicUrl) {
                  togglePlayMusic(
                    myNote.musicUrl,
                    myNote.musicClipStart || 0,
                    myNote.musicClipDuration || 30,
                    myNote.id
                  );
                }
                setViewingMyNote(true);
              } else {
                handleOpenCreator();
              }
            }}
          >
            <div className="min-h-10 relative w-full flex items-center justify-center mb-1">
              <AnimatePresence mode="wait">
                {myNote && (
                  <motion.div 
                    key="my-note-bubble"
                    initial={{ scale: 0.5, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.5, opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className={`absolute bottom-0 z-20 group-hover:scale-105 transition-all px-3 py-1.5 rounded-2xl flex flex-col items-center gap-1 shadow-xl whitespace-nowrap min-w-[95px] max-w-[145px] ${
                      isPlayingMusic && playingNoteId === myNote.id
                        ? 'bg-[#10121a] border-2 border-aeirmist-cyan shadow-[0_0_20px_rgba(0,242,255,0.45)]'
                        : 'bg-[#121318]/95 backdrop-blur-md border border-aeirmist-cyan/40 shadow-[0_8px_20px_rgba(0,242,255,0.15)]'
                    }`}
                  >
                    {/* If custom note text exists, show it */}
                    {myNote.content && myNote.content.trim() && myNote.content !== myNote.music && (
                      <p className="text-[11px] font-bold text-white tracking-tight truncate max-w-[125px] leading-tight">
                        {myNote.content}
                      </p>
                    )}

                    {/* If lyrics style */}
                    {myNote.music && myNote.musicStyle === 'lyrics' && myNote.musicLyrics && (
                      <p className="text-[10px] font-bold text-aeirmist-cyan italic tracking-tight truncate max-w-[125px]">
                        "{myNote.musicLyrics}"
                      </p>
                    )}

                    {/* Instagram Music Pill */}
                    {myNote.music && (
                      <div className="flex items-center gap-1.5 w-full justify-center">
                        {myNote.musicCover ? (
                          <div className={`w-4 h-4 rounded-full overflow-hidden border border-white/30 shrink-0 ${
                            isPlayingMusic && playingNoteId === myNote.id ? 'animate-spin [animation-duration:3s]' : ''
                          }`}>
                            <img src={myNote.musicCover} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <Disc size={12} className={`text-aeirmist-cyan shrink-0 ${
                            isPlayingMusic && playingNoteId === myNote.id ? 'animate-spin [animation-duration:3s]' : ''
                          }`} />
                        )}

                        <div className="flex-1 min-w-0 text-left">
                          <div className={`text-[10px] font-extrabold truncate max-w-[95px] leading-tight ${
                            isPlayingMusic && playingNoteId === myNote.id ? 'text-aeirmist-cyan' : 'text-white'
                          }`}>
                            {myNote.music.split(' - ')[0]}
                          </div>
                          {myNote.music.split(' - ')[1] && (!myNote.content || myNote.content === myNote.music) && (
                            <div className="text-[8px] font-medium text-white/50 truncate max-w-[95px] leading-none mt-0.5">
                              {myNote.music.split(' - ')[1]}
                            </div>
                          )}
                        </div>

                        {/* Animated soundbars or music note */}
                        {isPlayingMusic && playingNoteId === myNote.id ? (
                          <span className="flex items-end gap-[1.5px] h-3 shrink-0 ml-0.5">
                            <span className="w-[2px] h-full bg-aeirmist-cyan rounded-full animate-pulse" />
                            <span className="w-[2px] h-2/3 bg-aeirmist-cyan rounded-full animate-pulse [animation-delay:150ms]" />
                            <span className="w-[2px] h-4/5 bg-aeirmist-cyan rounded-full animate-pulse [animation-delay:300ms]" />
                          </span>
                        ) : (
                          <span className="text-[9px] text-aeirmist-cyan/70 shrink-0">♫</span>
                        )}
                      </div>
                    )}

                    {/* Pointer tail */}
                    <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
                      isPlayingMusic && playingNoteId === myNote.id
                        ? 'bg-[#10121a] border-r-2 border-b-2 border-aeirmist-cyan'
                        : 'bg-[#121318] border-r border-b border-aeirmist-cyan/40'
                    }`} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className={`relative w-15 h-15 rounded-[22px] p-[2px] border-2 transition-all duration-300 ${myNote ? 'border-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)]' : 'border-white/10 group-hover:border-white/30'}`}>
              <div className="w-full h-full rounded-[19px] overflow-hidden bg-[#0c0c0f]">
                <NoteUserAvatar 
                  userId={profile?.id}
                  authorUid={user?.uid}
                  fallbackPhoto={profile?.photoURL || user?.photoURL}
                  alt="Me"
                  className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                  roundedClassName="rounded-[19px]"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white text-black rounded-lg border-2 border-[#0a0a0d] flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                <Plus size={11} strokeWidth={3} />
              </div>
            </div>
            
            <span className="text-[10px] text-white/50 font-black uppercase tracking-[0.15em] w-full text-center mt-2 group-hover:text-white transition-colors">
              You
            </span>
          </div>
        </motion.div>

        {/* All Other Users' Notes & Active Accounts (Instagram Global / Friends Model) */}
        {shelfItems.map(item => {
          const otherId = item.userId;
          const chat = item.chat;
          const friendNote = item.note;
          const isOnline = item.isOnline;
          const hasNote = item.hasNote && friendNote;

          const hasSeen = hasNote ? friendNote.seenBy?.some((s: any) => s.userId === profile?.id) : false;
          const isCloseFriendsNote = hasNote && friendNote.audience === 'closeFriends';
          const isPlayingThis = hasNote && isPlayingMusic && playingNoteId === friendNote.id;

          const parts = hasNote && friendNote.music ? friendNote.music.split(' - ') : [];
          const trackTitle = parts[0] || (friendNote ? friendNote.music : '') || '';
          const trackArtist = parts.length > 1 ? parts.slice(1).join(' - ') : '';

          return (
            <motion.div 
              key={item.id || otherId} 
              variants={{
                hidden: { opacity: 0, scale: 0.8, y: 10 },
                visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 25 } }
              }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.96 }}
              className="flex flex-col items-center flex-shrink-0 min-w-16 relative snap-start"
            >
              <div 
                onClick={() => {
                  if (hasNote) {
                    if (friendNote.musicUrl) {
                      togglePlayMusic(
                        friendNote.musicUrl, 
                        friendNote.musicClipStart || 0, 
                        friendNote.musicClipDuration || 30, 
                        friendNote.id
                      );
                    }
                    setSelectedFriendNote({ note: friendNote, chat });
                  } else {
                    if (chat && chat.id && onChatSelect) {
                      onChatSelect(chat.id);
                    }
                  }
                }}
                className="relative cursor-pointer group flex flex-col items-center w-full"
              >
                <div className="min-h-10 relative w-full flex items-center justify-center mb-1">
                  {hasNote && (
                    <AnimatePresence>
                      <motion.div 
                        key={`friend-note-bubble-${otherId}`}
                        initial={{ scale: 0.5, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.5, opacity: 0, y: 10 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        className={`absolute bottom-0 z-20 group-hover:scale-105 transition-all px-3 py-1.5 rounded-2xl flex flex-col items-center gap-1 shadow-xl whitespace-nowrap min-w-[95px] max-w-[145px] ${
                          isPlayingThis
                            ? 'bg-[#10121a] border-2 border-aeirmist-cyan shadow-[0_0_20px_rgba(0,242,255,0.45)]'
                            : hasSeen 
                              ? 'bg-[#121318]/90 backdrop-blur-md border border-white/10 opacity-75' 
                              : isCloseFriendsNote
                                ? 'bg-[#121318] border border-aeirmist-lime shadow-[0_8px_20px_rgba(163,230,53,0.25)]'
                                : 'bg-[#121318] border border-white/20 shadow-[0_8px_25px_rgba(0,0,0,0.8)]'
                        }`}
                      >
                        {/* Thought Text if present */}
                        {friendNote.content && friendNote.content.trim() && friendNote.content !== friendNote.music && (
                          <p className={`text-[11px] font-bold tracking-tight truncate max-w-[125px] leading-tight ${hasSeen ? 'text-white/60' : 'text-white'}`}>
                            {friendNote.content}
                          </p>
                        )}

                        {/* Lyrics Quote if present */}
                        {friendNote.music && friendNote.musicStyle === 'lyrics' && friendNote.musicLyrics && (
                          <p className="text-[10px] font-bold text-aeirmist-cyan italic tracking-tight truncate max-w-[125px]">
                            "{friendNote.musicLyrics}"
                          </p>
                        )}

                        {/* Instagram Music Pill */}
                        {friendNote.music && (
                          <div className="flex items-center gap-1.5 w-full justify-center">
                            {friendNote.musicCover ? (
                              <div className={`w-4 h-4 rounded-full overflow-hidden border border-white/30 shrink-0 ${
                                isPlayingThis ? 'animate-spin [animation-duration:3s]' : ''
                              }`}>
                                <img src={friendNote.musicCover} alt="" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <Disc size={12} className={`text-aeirmist-cyan shrink-0 ${
                                isPlayingThis ? 'animate-spin [animation-duration:3s]' : ''
                              }`} />
                            )}

                            <div className="flex-1 min-w-0 text-left">
                              <div className={`text-[10px] font-extrabold truncate max-w-[95px] leading-tight ${
                                isPlayingThis ? 'text-aeirmist-cyan' : hasSeen ? 'text-white/70' : 'text-white'
                              }`}>
                                {trackTitle}
                              </div>
                              {trackArtist && (!friendNote.content || friendNote.content === friendNote.music) && (
                                <div className="text-[8px] font-medium text-white/40 truncate max-w-[95px] leading-none mt-0.5">
                                  {trackArtist}
                                </div>
                              )}
                            </div>

                            {/* Soundbars or Music note */}
                            {isPlayingThis ? (
                              <span className="flex items-end gap-[1.5px] h-3 shrink-0 ml-0.5">
                                <span className="w-[2px] h-full bg-aeirmist-cyan rounded-full animate-pulse" />
                                <span className="w-[2px] h-2/3 bg-aeirmist-cyan rounded-full animate-pulse [animation-delay:150ms]" />
                                <span className="w-[2px] h-4/5 bg-aeirmist-cyan rounded-full animate-pulse [animation-delay:300ms]" />
                              </span>
                            ) : (
                              <span className="text-[9px] text-white/40 shrink-0">♫</span>
                            )}
                          </div>
                        )}

                        {/* Pointer tail */}
                        <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
                          isPlayingThis
                            ? 'bg-[#10121a] border-r-2 border-b-2 border-aeirmist-cyan'
                            : hasSeen 
                              ? 'bg-[#121318]/90 border-r border-b border-white/10' 
                              : isCloseFriendsNote
                                ? 'bg-[#121318] border-r border-b border-aeirmist-lime'
                                : 'bg-[#121318] border-r border-b border-white/20'
                        }`} />
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>

                <div className={`relative w-15 h-15 rounded-[22px] p-[2px] border-2 transition-all duration-300 ${
                  isPlayingThis
                    ? 'border-aeirmist-cyan shadow-[0_0_20px_rgba(0,242,255,0.4)] animate-pulse'
                    : hasNote
                      ? hasSeen 
                        ? 'border-white/10 opacity-75' 
                        : isCloseFriendsNote
                          ? 'border-aeirmist-lime shadow-[0_0_15px_rgba(163,230,53,0.35)]'
                          : 'border-aeirmist-magenta shadow-[0_0_15px_rgba(255,0,234,0.35)]'
                      : isOnline
                        ? 'border-aeirmist-lime/70 shadow-[0_0_12px_rgba(163,230,53,0.25)]'
                        : 'border-white/10'
                }`}>
                  <div className="w-full h-full rounded-[19px] overflow-hidden bg-black">
                    <NoteUserAvatar 
                      userId={item.userId || chat.otherParticipantId}
                      fallbackPhoto={item.photo || chat.photo}
                      alt={chat.name || item.name || 'User'}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      roundedClassName="rounded-[19px]"
                    />
                  </div>
                  {isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-aeirmist-lime rounded-lg border-[3px] border-[#0a0a0d] shadow-sm animate-pulse" />
                  )}
                </div>

                <LiveNoteAuthorName
                  userId={item.userId || chat.otherParticipantId}
                  authorUid={friendNote?.authorUid}
                  fallbackName={isValidName(friendNote?.userName) ? friendNote.userName : (isValidName(item.name) ? item.name : (isValidName(chat?.name) ? chat.name : ''))}
                  username={item.username || chat?.username}
                  onlyFirstName={true}
                  className="text-[10px] text-white/50 font-black uppercase tracking-[0.1em] truncate w-full text-center mt-2 block"
                />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Note Creation Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 sm:p-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
              onClick={() => setIsCreating(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#18181b] border border-white/10 p-6 rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setIsCreating(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-all">
                  <X size={16} />
                </button>
                <h3 className="text-sm font-semibold text-white">New note</h3>
                <div className="w-8 h-8" />
              </div>

              {/* Profile & Input Area */}
              <div className="flex flex-col items-center mb-5">
                <div className="relative mb-4">
                  {/* Live Avatar Bubble Preview */}
                  <AnimatePresence>
                    {(noteContent.trim() || selectedMusic) && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 10 }}
                        className="absolute -top-9 left-1/2 -translate-x-1/2 bg-neutral-800 border border-white/15 px-3 py-1.5 rounded-2xl text-center shadow-lg z-20 flex items-center justify-center gap-1.5 whitespace-nowrap max-w-[170px]"
                      >
                        {selectedMusic && musicStyle === 'disc' && (selectedMusic.coverArtURL || selectedMusic.albumArtUrl) ? (
                          <div className={`w-4 h-4 rounded-full overflow-hidden shrink-0 border border-white/20 ${isAuditioning ? 'animate-spin [animation-duration:3s]' : ''}`}>
                            <img src={selectedMusic.coverArtURL || selectedMusic.albumArtUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : selectedMusic ? (
                          <Disc size={12} className={`text-neutral-300 shrink-0 ${isAuditioning ? 'animate-spin [animation-duration:3s]' : ''}`} />
                        ) : null}

                        {selectedMusic && musicStyle === 'lyrics' && musicLyrics.trim() ? (
                          <span className="text-xs text-cyan-400 font-medium italic truncate max-w-[120px]">
                            "{musicLyrics}"
                          </span>
                        ) : (
                          <span className="text-xs text-white font-medium truncate max-w-[120px]">
                            {noteContent || selectedMusic?.title || 'Note'}
                          </span>
                        )}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-neutral-800 border-r border-b border-white/15 rotate-45" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="w-16 h-16 rounded-2xl ring-2 ring-white/10 overflow-hidden bg-neutral-900 mx-auto shadow-md">
                    <NoteUserAvatar 
                      userId={profile?.id}
                      authorUid={user?.uid}
                      fallbackPhoto={profile?.photoURL || user?.photoURL}
                      alt={profile?.displayName || 'You'}
                      className="w-full h-full object-cover"
                      roundedClassName="rounded-2xl"
                    />
                  </div>
                </div>
                
                <div className="w-full relative group mt-2">
                  <textarea 
                    ref={noteTextareaRef}
                    rows={1}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Share a thought..."
                    maxLength={60}
                    className="w-full bg-neutral-800/60 border border-white/10 focus:border-white/30 rounded-2xl px-4 py-3 pr-12 text-sm text-white placeholder:text-neutral-500 outline-none transition-all resize-none min-h-[46px] max-h-[120px] text-center font-medium leading-normal overflow-hidden"
                  />
                  <div className="absolute bottom-2.5 right-3 text-[10px] font-normal text-neutral-500 pointer-events-none">
                    {noteContent.length}/60
                  </div>
                </div>
              </div>

              {/* Instagram-Style Music Controller Card */}
              {selectedMusic && (
                <div className="mb-5 p-3.5 rounded-2xl bg-neutral-800/70 border border-white/10 space-y-3">
                  {/* Music Track Header */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-2xl overflow-hidden shrink-0 bg-white/5 border border-white/10 shadow-md">
                      <img 
                        src={selectedMusic.coverArtURL || selectedMusic.albumArtUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300&auto=format&fit=crop'} 
                        alt="" 
                        className={`w-full h-full object-cover ${isAuditioning ? 'animate-spin [animation-duration:6s]' : ''}`} 
                      />
                      <button
                        type="button"
                        onClick={toggleAudition}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white"
                      >
                        {isAuditioning ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{selectedMusic.title}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-tight truncate mt-0.5">{selectedMusic.artist}</div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsMusicModalOpen(true)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-[9px] font-bold"
                        title="Change Song"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (auditionAudioRef.current) auditionAudioRef.current.pause();
                          setIsAuditioning(false);
                          setSelectedMusic(null);
                        }}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-red-400 transition-all"
                        title="Remove Music"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Clip Scale & Trim Scrubber (like Instagram Notes) */}
                  <div className="space-y-1.5 pt-1 border-t border-white/5">
                    <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-white/40">
                      <span className="flex items-center gap-1">
                        <Sliders size={10} className="text-aeirmist-cyan" />
                        Clip Scale (Start Time)
                      </span>
                      <span className="font-mono text-aeirmist-cyan">
                        0:{musicClipStart.toString().padStart(2, '0')} - 0:{Math.min(30, musicClipStart + musicClipDuration).toString().padStart(2, '0')}
                      </span>
                    </div>

                    <input 
                      type="range"
                      min={0}
                      max={15}
                      step={1}
                      value={musicClipStart}
                      onChange={(e) => handleSeekClipStart(Number(e.target.value))}
                      className="w-full accent-aeirmist-cyan h-1.5 bg-white/10 rounded-lg cursor-pointer"
                    />

                    {/* Clip Duration: 15s vs 30s */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[8px] font-mono text-white/30 uppercase">Segment Length:</span>
                      <div className="flex gap-1.5">
                        {[15, 30].map(dur => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => setMusicClipDuration(dur)}
                            className={`px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase transition-all ${
                              musicClipDuration === dur
                                ? 'bg-aeirmist-cyan text-black font-bold'
                                : 'bg-white/5 text-white/40 hover:text-white'
                            }`}
                          >
                            {dur}s
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Display Style Selector (like Instagram) */}
                  <div className="space-y-1.5 pt-1 border-t border-white/5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-white/40 block">
                      Display Style
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'badge', label: 'Waveform', icon: <Volume2 size={12} /> },
                        { id: 'lyrics', label: 'Lyrics', icon: <MessageCircle size={12} /> },
                        { id: 'disc', label: 'Vinyl Disc', icon: <Disc size={12} /> }
                      ].map(style => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setMusicStyle(style.id as any)}
                          className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border ${
                            musicStyle === style.id
                              ? 'bg-white text-black border-white shadow-md'
                              : 'bg-white/[0.03] text-white/40 border-white/5 hover:text-white'
                          }`}
                        >
                          {style.icon}
                          <span>{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lyrics / Highlight Quote Input */}
                  {musicStyle === 'lyrics' && (
                    <div className="space-y-1.5 pt-1 border-t border-white/5">
                      <label className="text-[8px] font-black uppercase tracking-wider text-aeirmist-cyan block">
                        Highlight Lyrics / Song Quote
                      </label>
                      <input 
                        type="text"
                        value={musicLyrics}
                        onChange={(e) => setMusicLyrics(e.target.value)}
                        placeholder="Type lyrics to show above avatar..."
                        maxLength={50}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-aeirmist-cyan"
                      />
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
                        {['♫ Vibes on repeat', '♫ Feeling the beat', '♫ আমার গান', '♫ दिल दियां गल्लां'].map(pill => (
                          <button
                            key={pill}
                            type="button"
                            onClick={() => setMusicLyrics(pill)}
                            className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] text-white/50 hover:text-white whitespace-nowrap"
                          >
                            {pill}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions (Music, Camera) */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <button 
                  onClick={() => setIsMusicModalOpen(true)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all border text-xs font-medium ${
                    selectedMusic 
                      ? 'bg-white/10 border-white/30 text-white' 
                      : 'bg-neutral-800/60 border-white/5 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Music size={14} className={selectedMusic ? 'animate-spin-slow' : ''} />
                  <span className="truncate max-w-[100px]">
                    {selectedMusic ? selectedMusic.title : 'Add Music'}
                  </span>
                </button>
                <button 
                  onClick={openCamera}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all border text-xs font-medium ${
                    media 
                      ? 'bg-pink-500/15 border-pink-500/30 text-pink-400' 
                      : 'bg-neutral-800/60 border-white/5 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Camera size={14} />
                  <span>
                    {media ? 'Photo Added' : 'Camera'}
                  </span>
                </button>
              </div>

              {/* Audience Selector */}
              <div className="space-y-2.5 mb-6">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-medium text-neutral-400">Audience</span>
                  {audience === 'closeFriends' && (
                    <button 
                      onClick={() => setIsCloseFriendsModalOpen(true)}
                      className="text-xs font-medium text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <UserPlus size={11} />
                      <span>Edit list ({closeFriendsList.length})</span>
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5 p-1 bg-neutral-800/60 rounded-xl border border-white/5">
                  {(['public', 'followers', 'closeFriends'] as const).map(aud => (
                    <button 
                      key={aud}
                      onClick={() => setAudience(aud)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                        audience === aud 
                          ? 'bg-white text-black font-semibold shadow-sm' 
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {aud === 'public' && <Globe size={12} />}
                      {aud === 'followers' && <Users size={12} />}
                      {aud === 'closeFriends' && <Shield size={12} />}
                      <span>{aud === 'public' ? 'Public' : aud === 'followers' ? 'Followers' : 'Close Friends'}</span>
                    </button>
                  ))}
                </div>

                {/* Sub-actions */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button 
                    onClick={() => setIsCloseFriendsModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-neutral-800/40 border border-white/5 hover:bg-neutral-800 transition-all text-xs font-medium text-neutral-300 hover:text-white"
                  >
                    <Shield className="text-cyan-400" size={12} />
                    <span>Close Friends ({closeFriendsList.length})</span>
                  </button>

                  <button 
                    onClick={() => setIsHideNotesModalOpen(true)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border transition-all text-xs font-medium ${
                      hiddenFromUserIds.length > 0
                        ? 'bg-pink-500/15 border-pink-500/30 text-pink-400'
                        : 'bg-neutral-800/40 border-white/5 text-neutral-300 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <EyeOff size={12} />
                    <span>Hide Note {hiddenFromUserIds.length > 0 ? `(${hiddenFromUserIds.length})` : ''}</span>
                  </button>
                </div>
              </div>

              <button 
                onClick={handleCreate}
                disabled={(!noteContent.trim() && !selectedMusic && !media) || isUploading}
                className="w-full py-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-sm shadow-md active:scale-98 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-2"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : 'Share Note'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Friend Note View Modal (Meta / Instagram Standard) */}
      <AnimatePresence>
        {selectedFriendNote && (() => {
          const friendNote = selectedFriendNote.note;
          const chat = selectedFriendNote.chat;
          const authorName = (isValidName(friendNote.userName) ? friendNote.userName : '') || 
                             (isValidName(chat.name) ? chat.name : '') || 
                             profileNameCache[friendNote.authorId] || 
                             friendNote.username || 
                             chat.username || 
                             'User';
          const authorFirstName = getFirstName(authorName) || authorName.split(/\s+/)[0] || 'User';
          const isOnline = !!onlineUsers?.has?.(friendNote.authorId);

          const parts = friendNote.music ? friendNote.music.split(' - ') : [];
          const trackTitle = parts[0] || friendNote.music || '';
          const trackArtist = parts.length > 1 ? parts.slice(1).join(' - ') : '';
          const isPlayingThis = isPlayingMusic && playingNoteId === friendNote.id;

          return (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={() => setSelectedFriendNote(null)}
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0, transition: { duration: 0.2 } }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="relative w-full max-w-[320px] bg-[#141416] border border-white/10 rounded-[28px] shadow-2xl p-6 flex flex-col items-center"
              >
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedFriendNote(null)} 
                  className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
                >
                  <X size={18} />
                </button>

                {/* 1. Meta Floating Thought Bubble (Text & Music) */}
                <div className="relative w-full bg-[#1e1e24] border border-white/10 rounded-2xl p-3.5 shadow-lg flex flex-col items-center gap-2 mb-3.5">
                  {/* Thought Text */}
                  {friendNote.content && friendNote.content.trim() && friendNote.content !== friendNote.music && (
                    <p className="text-sm font-semibold text-white text-center leading-relaxed break-words px-1">
                      {friendNote.content}
                    </p>
                  )}

                  {/* Music Strip */}
                  {friendNote.music && (
                    <div className="flex items-center gap-2.5 w-full bg-black/40 rounded-xl p-2 border border-white/5">
                      {/* Play/Pause Cover */}
                      <button
                        type="button"
                        onClick={() => {
                          if (friendNote.musicUrl) {
                            togglePlayMusic(
                              friendNote.musicUrl,
                              friendNote.musicClipStart || 0,
                              friendNote.musicClipDuration || 30,
                              friendNote.id
                            );
                          }
                        }}
                        className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-neutral-900 border border-white/10 shadow group"
                      >
                        {friendNote.musicCover ? (
                          <img 
                            src={friendNote.musicCover} 
                            alt="" 
                            className={`w-full h-full object-cover ${isPlayingThis ? 'animate-spin [animation-duration:5s]' : ''}`} 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40">
                            <Disc size={16} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white transition-colors">
                          {isPlayingThis ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-0.5" />}
                        </div>
                      </button>

                      {/* Details */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-xs font-bold text-white truncate">
                          {trackTitle}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                          {trackArtist ? `${trackArtist} • Spotify` : `${friendNote.musicClipDuration || 30}s • Spotify`}
                        </div>
                      </div>

                      {/* Playing Bars or Spotify Icon */}
                      {isPlayingThis ? (
                        <span className="flex items-end gap-[2px] h-3.5 shrink-0 px-1">
                          <span className="w-[2px] h-full bg-[#1DB954] rounded-full animate-pulse" />
                          <span className="w-[2px] h-2/3 bg-[#1DB954] rounded-full animate-pulse [animation-delay:150ms]" />
                          <span className="w-[2px] h-4/5 bg-[#1DB954] rounded-full animate-pulse [animation-delay:300ms]" />
                        </span>
                      ) : friendNote.spotifyUrl ? (
                        <a
                          href={friendNote.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-full hover:bg-white/10 text-[#1DB954] transition-colors shrink-0"
                          title="Open on Spotify"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.377-1.454-5.37-1.783-8.893-.982-.336.075-.668-.135-.744-.47-.077-.337.135-.669.47-.745 3.856-.88 7.15-.51 9.817 1.123.294.18.386.563.207.857zm1.224-2.724c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.078-1.182-.413.125-.85-.107-.975-.52-.125-.413.107-.85.52-.975 3.67-1.114 8.24-.57 11.347 1.342.368.227.488.708.26 1.075zm.105-2.81c-3.262-1.937-8.644-2.115-11.758-1.17-.5.152-1.025-.133-1.177-.633-.153-.5.132-1.025.633-1.177 3.616-1.098 9.544-.89 13.3 1.34.45.267.6.845.333 1.295-.267.45-.845.6-1.295.334z"/>
                          </svg>
                        </a>
                      ) : null}
                    </div>
                  )}

                  {/* Lyrics if available */}
                  {friendNote.musicLyrics && (
                    <p className="text-[11px] text-cyan-400 italic text-center pt-0.5">
                      "{friendNote.musicLyrics}"
                    </p>
                  )}

                  {/* Speech Bubble Pointer Tail pointing down to avatar */}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1e1e24] border-r border-b border-white/10 rotate-45" />
                </div>

                {/* 2. Square Avatar */}
                <div className="relative w-18 h-18 mb-2 flex-shrink-0">
                  <div className="w-full h-full rounded-2xl ring-2 ring-white/15 overflow-hidden bg-neutral-900 shadow-xl">
                    <NoteUserAvatar 
                      userId={friendNote.authorId || chat.otherParticipantId}
                      authorUid={friendNote.authorUid}
                      fallbackPhoto={friendNote.userAvatar || chat.photo}
                      alt={authorName}
                      className="w-full h-full object-cover"
                      roundedClassName="rounded-2xl"
                    />
                  </div>
                  {isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-lg ring-2 ring-[#141416]" />
                  )}
                </div>

                {/* Author Name & Time */}
                <h3 className="text-sm font-semibold text-white truncate max-w-[240px]">
                  <LiveNoteAuthorName
                    userId={friendNote.authorId || chat.otherParticipantId}
                    authorUid={friendNote.authorUid}
                    fallbackName={authorName}
                    username={friendNote.username || chat.username}
                    onlyFirstName={false}
                  />
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {getRelativeTime(friendNote.createdAt)} ago
                </p>

                {/* 3. Floating Quick Reactions (Clean Meta Style, NO heavy border box) */}
                <div className="flex w-full items-center justify-around py-3 px-1">
                  {REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(friendNote.id, emoji)}
                      className="text-2xl hover:scale-130 active:scale-95 transition-transform duration-150 p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* 4. Direct Reply Bar (Minimal Meta Pill) */}
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!replyText.trim() || !selectedFriendNote) return;
                    const effectiveAuthorName = (isValidName(profileNameCache[friendNote.authorId]) ? profileNameCache[friendNote.authorId] : '') || 
                                                (isValidName(authorName) ? authorName : '') || 
                                                getFirstName(authorName) || 
                                                'User';
                    const noteQuote = friendNote.content || friendNote.music || 'Note';
                    const messageBody = `Replying to note: "${noteQuote}"\n${replyText.trim()}`;
                    try {
                      if (sendMessage) {
                        await sendMessage(chat.id, messageBody, 'text', undefined, {
                          replyTo: {
                            text: `${effectiveAuthorName}'s Note: "${noteQuote}"`,
                            senderName: effectiveAuthorName
                          }
                        });
                        addToast?.({ title: "Reply Sent", message: `Sent to ${effectiveAuthorName}`, type: "success" });
                      } else {
                        onReplyNote?.(chat.id, noteQuote, effectiveAuthorName);
                      }
                      setReplyText('');
                      setSelectedFriendNote(null);
                    } catch (err) {
                      logger.error("Failed to send reply to note:", err);
                    }
                  }}
                  className="w-full flex items-center gap-2 bg-white/10 hover:bg-white/[0.12] focus-within:bg-white/[0.15] border border-white/10 focus-within:border-white/25 rounded-full py-2 px-4 transition-all"
                >
                  <input 
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${authorFirstName}...`}
                    className="flex-1 bg-transparent text-xs text-white placeholder:text-neutral-500 outline-none font-normal"
                  />
                  {replyText.trim() && (
                    <button
                      type="submit"
                      className="text-xs font-semibold text-white hover:text-cyan-400 transition-colors shrink-0 flex items-center gap-1"
                    >
                      <span>Send</span>
                      <Send size={11} />
                    </button>
                  )}
                </form>

                {/* 5. Minimal Footer Actions */}
                <div className="flex items-center justify-between w-full mt-3 px-2 text-xs text-neutral-400">
                  <button 
                    onClick={() => {
                      const effectiveAuthorName = (isValidName(profileNameCache[friendNote.authorId]) ? profileNameCache[friendNote.authorId] : '') || 
                                                  (isValidName(authorName) ? authorName : '') || 
                                                  getFirstName(authorName) || 
                                                  'User';
                      onReplyNote?.(chat.id, friendNote.content || friendNote.music || '', effectiveAuthorName);
                      setSelectedFriendNote(null);
                    }}
                    className="hover:text-white transition-colors flex items-center gap-1.5 py-1"
                  >
                    <MessageCircle size={13} />
                    <span>Open chat</span>
                  </button>

                  <button 
                    onClick={async () => {
                      const noteUser = (chat.username && chat.username !== 'user' && chat.username !== 'null') ? chat.username : (friendNote.userName || 'creator');
                      const shareText = `Check out @${noteUser}'s note on Aeirmist: "${friendNote.content || friendNote.music}"`;
                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: 'Aeirmist Note',
                            text: shareText,
                            url: window.location.origin
                          });
                        } catch (err) {}
                      } else {
                        await navigator.clipboard.writeText(shareText);
                        addToast({ title: 'Link Copied', message: 'Note content copied to clipboard.', type: 'success' });
                      }
                      setSelectedFriendNote(null);
                    }}
                    className="hover:text-white transition-colors flex items-center gap-1.5 py-1"
                  >
                    <Share2 size={13} />
                    <span>Share</span>
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* My Note Modal (Meta / Instagram Standard) */}
      <AnimatePresence>
        {viewingMyNote && myNote && (() => {
          const parts = myNote.music ? myNote.music.split(' - ') : [];
          const trackTitle = parts[0] || myNote.music || '';
          const trackArtist = parts.length > 1 ? parts.slice(1).join(' - ') : '';
          const isPlayingThis = isPlayingMusic && playingNoteId === myNote.id;

          return (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={() => setViewingMyNote(false)}
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0, transition: { duration: 0.2 } }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="relative w-full max-w-[320px] bg-[#141416] border border-white/10 rounded-[28px] shadow-2xl p-6 flex flex-col items-center"
              >
                <button 
                  onClick={() => setViewingMyNote(false)} 
                  className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
                >
                  <X size={18} />
                </button>

                {/* 1. Meta Floating Thought Bubble (Text & Music) */}
                <div className="relative w-full bg-[#1e1e24] border border-white/10 rounded-2xl p-3.5 shadow-lg flex flex-col items-center gap-2 mb-3.5">
                  {myNote.content && myNote.content.trim() && myNote.content !== myNote.music && (
                    <p className="text-sm font-semibold text-white text-center leading-relaxed break-words px-1">
                      {myNote.content}
                    </p>
                  )}

                  {myNote.music && (
                    <div className="flex items-center gap-2.5 w-full bg-black/40 rounded-xl p-2 border border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          if (myNote.musicUrl) {
                            togglePlayMusic(
                              myNote.musicUrl,
                              myNote.musicClipStart || 0,
                              myNote.musicClipDuration || 30,
                              myNote.id
                            );
                          }
                        }}
                        className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-neutral-900 border border-white/10 shadow group"
                      >
                        {myNote.musicCover ? (
                          <img 
                            src={myNote.musicCover} 
                            alt="" 
                            className={`w-full h-full object-cover ${isPlayingThis ? 'animate-spin [animation-duration:5s]' : ''}`} 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40">
                            <Disc size={16} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white transition-colors">
                          {isPlayingThis ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-0.5" />}
                        </div>
                      </button>

                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-xs font-bold text-white truncate">
                          {trackTitle}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                          {trackArtist ? `${trackArtist} • Spotify` : `${myNote.musicClipDuration || 30}s • Spotify`}
                        </div>
                      </div>

                      {isPlayingThis ? (
                        <span className="flex items-end gap-[2px] h-3.5 shrink-0 px-1">
                          <span className="w-[2px] h-full bg-[#1DB954] rounded-full animate-pulse" />
                          <span className="w-[2px] h-2/3 bg-[#1DB954] rounded-full animate-pulse [animation-delay:150ms]" />
                          <span className="w-[2px] h-4/5 bg-[#1DB954] rounded-full animate-pulse [animation-delay:300ms]" />
                        </span>
                      ) : myNote.spotifyUrl ? (
                        <a
                          href={myNote.spotifyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-full hover:bg-white/10 text-[#1DB954] transition-colors shrink-0"
                          title="Open on Spotify"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.377-1.454-5.37-1.783-8.893-.982-.336.075-.668-.135-.744-.47-.077-.337.135-.669.47-.745 3.856-.88 7.15-.51 9.817 1.123.294.18.386.563.207.857zm1.224-2.724c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.078-1.182-.413.125-.85-.107-.975-.52-.125-.413.107-.85.52-.975 3.67-1.114 8.24-.57 11.347 1.342.368.227.488.708.26 1.075zm.105-2.81c-3.262-1.937-8.644-2.115-11.758-1.17-.5.152-1.025-.133-1.177-.633-.153-.5.132-1.025.633-1.177 3.616-1.098 9.544-.89 13.3 1.34.45.267.6.845.333 1.295-.267.45-.845.6-1.295.334z"/>
                          </svg>
                        </a>
                      ) : null}
                    </div>
                  )}

                  {myNote.musicLyrics && (
                    <p className="text-[11px] text-cyan-400 italic text-center pt-0.5">
                      "{myNote.musicLyrics}"
                    </p>
                  )}

                  {/* Speech Bubble Pointer Tail pointing down */}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1e1e24] border-r border-b border-white/10 rotate-45" />
                </div>

                {/* 2. Square Avatar */}
                <div className="relative w-18 h-18 mb-2 flex-shrink-0">
                  <div className="w-full h-full rounded-2xl overflow-hidden ring-2 ring-white/15 bg-neutral-900 shadow-xl">
                    <NoteUserAvatar 
                      userId={profile?.id} 
                      authorUid={user?.uid}
                      fallbackPhoto={profile?.photoURL || user?.photoURL}
                      alt={profile?.displayName || 'You'} 
                      className="w-full h-full object-cover" 
                      roundedClassName="rounded-2xl"
                    />
                  </div>
                </div>
                
                <h3 className="text-sm font-semibold text-white">Your Note</h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Visible for 24h • Posted {getRelativeTime(myNote.createdAt)} ago
                </p>

                {/* Insights: Views & Reactions */}
                <div className="grid grid-cols-2 gap-2 w-full my-3">
                  <button 
                    onClick={() => setActiveSheet('seen')}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-xs font-medium text-neutral-300 hover:text-white"
                  >
                    <Eye size={14} className="text-neutral-400" />
                    <span>{myNote.seenBy?.length || 0} views</span>
                  </button>
                  <button 
                    onClick={() => setActiveSheet('reactions')}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-xs font-medium text-neutral-300 hover:text-white"
                  >
                    <Heart size={14} className="text-pink-400" />
                    <span>{myNote.reactions?.length || 0} reactions</span>
                  </button>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col w-full gap-2 mt-1">
                  <button 
                    onClick={() => { setViewingMyNote(false); setIsCreating(true); }}
                    className="w-full py-2.5 rounded-full bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    Share a new note
                  </button>
                  <button 
                    onClick={handleDeleteNote}
                    className="w-full py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 font-medium text-xs transition-all active:scale-98 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    Delete note
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Sheets for Seen/Reactions */}
      <AnimatePresence>
        {activeSheet && myNote && (
          <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-3xl"
              onClick={() => setActiveSheet(null)}
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }}
              exit={{ y: '100%', transition: { duration: 0.2, ease: "easeInOut" } }}
              className="relative w-full max-w-md h-[75vh] sm:h-[500px] bg-[#18181b] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden border-t sm:border border-white/10"
            >
              {/* Sheet Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141417]">
                <div className="flex items-center gap-2.5">
                   <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeSheet === 'seen' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-pink-500/15 text-pink-400'}`}>
                      {activeSheet === 'seen' ? <Eye size={15} /> : <Heart size={15} />}
                   </div>
                   <h3 className="text-sm font-semibold text-white">
                     {activeSheet === 'seen' ? `Seen by (${myNote.seenBy?.length || 0})` : `Reactions (${myNote.reactions?.length || 0})`}
                   </h3>
                </div>
                <button onClick={() => setActiveSheet(null)} className="text-white/40 hover:text-white transition-colors bg-white/5 p-1.5 rounded-full">
                  <X size={16} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeSheet === 'seen' ? (
                  myNote.seenBy && myNote.seenBy.length > 0 ? (
                    <div className="space-y-1.5">
                      {myNote.seenBy.map((s: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-2xl transition-all">
                          <img src={getAvatarUrl(s.userAvatar)} className="w-10 h-10 rounded-full object-cover" />
                          <div className="flex-1 flex flex-col min-w-0">
                            <span className="text-sm font-medium text-white truncate">{s.userName}</span>
                            <span className="text-xs text-neutral-400">{getRelativeTime(s.timestamp)} ago</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-500 py-16">
                      <Eye size={28} className="opacity-30 mb-2" />
                      <p className="text-xs font-medium">No views yet.</p>
                    </div>
                  )
                ) : (
                  myNote.reactions && myNote.reactions.length > 0 ? (
                    <div className="flex flex-col h-full">
                      <div className="flex flex-wrap gap-2 px-2 pb-4 mb-2 border-b border-white/5">
                        {Array.from(new Set(myNote.reactions.map((r: any) => r.emoji))).map((emoji: any) => (
                           <span key={emoji} className="px-3 py-1 rounded-full bg-white/5 text-white text-xs font-medium border border-white/5 flex items-center gap-1.5">
                             <span>{emoji}</span>
                             <span className="text-neutral-400">{myNote.reactions.filter((r: any) => r.emoji === emoji).length}</span>
                           </span>
                        ))}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {myNote.reactions.map((r: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-2xl transition-all">
                            <div className="relative">
                              <img src={getAvatarUrl(r.userAvatar)} className="w-10 h-10 rounded-full object-cover" />
                              <span className="absolute -bottom-1 -right-1 text-base">{r.emoji}</span>
                            </div>
                            <div className="flex-1 flex flex-col min-w-0">
                              <span className="text-sm font-medium text-white truncate">{r.userName}</span>
                              <span className="text-xs text-neutral-400">{getRelativeTime(r.timestamp)} ago</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-500 py-16">
                      <Heart size={28} className="opacity-30 mb-2" />
                      <p className="text-xs font-medium">No reactions yet.</p>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MUSIC SEARCH MODAL INTEGRATION */}
      <AnimatePresence>
        {isMusicModalOpen && (
          <MusicSearchModal 
            onClose={() => setIsMusicModalOpen(false)}
            onSelect={(song) => {
              setSelectedMusic(song);
              setIsMusicModalOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* CLOSE FRIENDS LIST MANAGER MODAL */}
      <AnimatePresence>
        {isCloseFriendsModalOpen && (
          <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-2xl"
              onClick={() => setIsCloseFriendsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#0d0d12] border border-white/10 rounded-[2.5rem] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-aeirmist-cyan/15 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">Close Friends List</h3>
                    <p className="text-[10px] text-white/40 font-medium">{closeFriendsList.length} member{closeFriendsList.length === 1 ? '' : 's'} in your network</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCloseFriendsModalOpen(false)}
                  className="w-9 h-9 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search Input */}
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="text"
                  value={closeFriendsSearch}
                  onChange={(e) => setCloseFriendsSearch(e.target.value)}
                  placeholder="Search connections or username..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-4 py-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-aeirmist-cyan/40 transition-all"
                />
                {closeFriendsSearch && (
                  <button onClick={() => setCloseFriendsSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white text-xs">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Candidates List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                {filteredCloseFriendsCandidates.length > 0 ? (
                  filteredCloseFriendsCandidates.map(user => {
                    const isCF = (isCloseFriend && isCloseFriend(user.id)) || closeFriendsList.includes(user.id);
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all">
                        <div className="flex items-center gap-3">
                          <img src={getAvatarUrl(user.photo)} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                          <div>
                            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                              {user.name}
                              {isCF && <Sparkles className="text-aeirmist-cyan shrink-0" size={14} />}
                            </h4>
                            {user.username && <p className="text-[10px] text-white/40">@{user.username}</p>}
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                            const currentlyIsCF = (isCloseFriend && isCloseFriend(user.id)) || closeFriendsList.includes(user.id);
                            await toggleCloseFriend(user.id);
                            addToast?.({
                              title: currentlyIsCF ? "Removed" : "Added",
                              message: currentlyIsCF ? `Removed ${user.name} from Close Friends` : `Added ${user.name} to Close Friends`,
                              type: "success"
                            });
                          }}
                          className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                            isCF
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                              : 'bg-aeirmist-cyan/15 border-aeirmist-cyan/40 text-aeirmist-cyan hover:bg-aeirmist-cyan/25'
                          }`}
                        >
                          {isCF ? (
                            <>
                              <UserMinus size={12} />
                              <span>Remove</span>
                            </>
                          ) : (
                            <>
                              <UserPlus size={12} />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-white/30 text-xs">
                    No connections found.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-white/10 mt-4 flex justify-end">
                <button 
                  onClick={() => setIsCloseFriendsModalOpen(false)}
                  className="w-full py-3.5 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-aeirmist-cyan transition-all shadow-lg active:scale-95"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HIDE NOTE FROM USERS MODAL */}
      <AnimatePresence>
        {isHideNotesModalOpen && (
          <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-2xl"
              onClick={() => setIsHideNotesModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#0d0d12] border border-white/10 rounded-[2.5rem] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-aeirmist-magenta/15 border border-aeirmist-magenta/30 flex items-center justify-center text-aeirmist-magenta">
                    <EyeOff size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">Hide Note From Users</h3>
                    <p className="text-[10px] text-white/40 font-medium">Selected users won't see your note</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHideNotesModalOpen(false)}
                  className="w-9 h-9 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search Input */}
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="text"
                  value={hideNotesSearch}
                  onChange={(e) => setHideNotesSearch(e.target.value)}
                  placeholder="Search users to hide note from..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-4 py-3 text-xs text-white placeholder:text-white/20 outline-none focus:border-aeirmist-magenta/40 transition-all"
                />
              </div>

              {/* Counter / Clear All Bar */}
              {hiddenFromUserIds.length > 0 && (
                <div className="flex items-center justify-between bg-aeirmist-magenta/10 border border-aeirmist-magenta/20 px-3.5 py-2.5 rounded-2xl mb-3 text-xs text-aeirmist-magenta">
                  <span className="font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <EyeOff size={12} />
                    Hidden from {hiddenFromUserIds.length} user{hiddenFromUserIds.length === 1 ? '' : 's'}
                  </span>
                  <button 
                    onClick={() => setHiddenFromUserIds([])}
                    className="text-[9px] font-black uppercase tracking-widest underline hover:opacity-80"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {/* User List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                {filteredHideNotesCandidates.length > 0 ? (
                  filteredHideNotesCandidates.map(user => {
                    const isHidden = hiddenFromUserIds.includes(user.id);
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all">
                        <div className="flex items-center gap-3">
                          <img src={getAvatarUrl(user.photo)} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                          <div>
                            <h4 className="text-xs font-bold text-white">{user.name}</h4>
                            {user.username && <p className="text-[10px] text-white/40">@{user.username}</p>}
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setHiddenFromUserIds(prev => 
                              isHidden ? prev.filter(id => id !== user.id) : [...prev, user.id]
                            );
                          }}
                          className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                            isHidden
                              ? 'bg-aeirmist-magenta/20 border-aeirmist-magenta text-aeirmist-magenta'
                              : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                          }`}
                        >
                          {isHidden ? (
                            <>
                              <EyeOff size={12} />
                              <span>Hidden</span>
                            </>
                          ) : (
                            <>
                              <Eye size={12} />
                              <span>Hide Note</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-white/30 text-xs">
                    No connections found.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-white/10 mt-4 flex justify-end">
                <button 
                  onClick={() => setIsHideNotesModalOpen(false)}
                  className="w-full py-3.5 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-aeirmist-cyan transition-all shadow-lg active:scale-95"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
