import { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  limit
} from 'firebase/firestore';
import { useAeirmist } from '../context/AeirmistContext';
import { logger } from '@/src/utils/logger';
import { api } from '../services/api/client';


export const useInboxData = (allowedAuthorIds?: string[]) => {
  const { db, user, profile, isFollowing, canWrite, addToast } = useAeirmist();
  const [notes, setNotes] = useState<any[]>([]);
  const [activeStories, setActiveStories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const authorStatusCache = useRef<Map<string, { exists: boolean; isBanned: boolean }>>(new Map());

  const allowedIdsStr = allowedAuthorIds?.join(',');
  const followingStr = profile?.social?.following?.join(',') || '';

  useEffect(() => {
    if (!db || !user || !profile?.id) {
      setNotes([]);
      setActiveStories(new Set());
      setLoading(false);
      return;
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayTimestamp = Timestamp.fromDate(yesterday);
    
    // 1. Listen to Notes
    const following = followingStr ? followingStr.split(',') : [];
    const extraIds = allowedIdsStr ? allowedIdsStr.split(',').filter(Boolean) : [];
    const followingWithMe = Array.from(new Set([...following, profile.id, ...extraIds])).slice(0, 30); // Firestore 'in' limit is 30

    if (followingWithMe.length === 0) {
      setNotes([]);
      setLoading(false);
      return;
    }

    const fetchInboxData = async () => {
      try {
        // 1. Fetch Notes (Try PostgreSQL first, fallback to getDocs)
        let fetchedNotes: any[] = [];
        const notesApiRes = await api.notes.getActive().catch(() => null);
        if (notesApiRes && Array.isArray(notesApiRes.notes) && notesApiRes.notes.length > 0) {
          fetchedNotes = notesApiRes.notes;
        } else if (db) {
          const notesQuery = query(
            collection(db, 'notes'),
            where('createdAt', '>', yesterdayTimestamp),
            limit(30)
          );
          const snapshot = await getDocs(notesQuery);
          // Gather unknown authors
          const pendingAuthorIds = new Set<string>();
          snapshot.docs.forEach(dSnap => {
            const d = dSnap.data();
            const aId = d.authorId || d.authorUid;
            if (aId && aId !== profile.id && !authorStatusCache.current.has(aId)) {
              pendingAuthorIds.add(aId);
            }
          });

          if (pendingAuthorIds.size > 0) {
            await Promise.all(
              Array.from(pendingAuthorIds).map(async (aId) => {
                try {
                  const pSnap = await getDoc(doc(db, 'profiles', aId));
                  if (pSnap.exists()) {
                    const pd = pSnap.data();
                    authorStatusCache.current.set(aId, { exists: true, isBanned: Boolean(pd.isBanned || pd.status === 'BANNED' || pd.status === 'DELETED') });
                    return;
                  }
                  const pAltSnap = await getDoc(doc(db, 'profiles', `profile_${aId}`));
                  if (pAltSnap.exists()) {
                    const pd = pAltSnap.data();
                    authorStatusCache.current.set(aId, { exists: true, isBanned: Boolean(pd.isBanned || pd.status === 'BANNED' || pd.status === 'DELETED') });
                    return;
                  }
                  const uSnap = await getDoc(doc(db, 'users', aId));
                  if (uSnap.exists()) {
                    const ud = uSnap.data();
                    authorStatusCache.current.set(aId, { exists: true, isBanned: Boolean(ud.isBanned || ud.status === 'BANNED' || ud.status === 'DELETED') });
                    return;
                  }
                  authorStatusCache.current.set(aId, { exists: false, isBanned: true });
                } catch {
                  authorStatusCache.current.set(aId, { exists: true, isBanned: false });
                }
              })
            );
          }

          fetchedNotes = snapshot.docs
            .map(docSnap => ({
              id: docSnap.id,
              ...docSnap.data()
            }))
            .filter((note: any) => {
              const aId = note.authorId || note.authorUid;
              if (aId && aId !== profile.id && authorStatusCache.current.has(aId)) {
                const st = authorStatusCache.current.get(aId)!;
                if (!st.exists || st.isBanned) {
                  deleteDoc(doc(db, 'notes', note.id)).catch(() => {});
                  return false;
                }
              }
              if (note.isBanned || note.authorIsBanned) {
                deleteDoc(doc(db, 'notes', note.id)).catch(() => {});
                return false;
              }
              if (profile?.id && (note.hiddenFrom || []).includes(profile.id)) return false;
              if (note.authorId === profile.id) return true;
              if (note.audience === 'public') return true;
              if (note.audience === 'followers' && followingWithMe.includes(note.authorId)) return true;
              if (note.audience === 'closeFriends') {
                 return (note.visibleTo || []).includes(profile.id);
              }
              return false;
            })
            .sort((a: any, b: any) => {
              const tA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
              const tB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
              return tB - tA;
            })
            .slice(0, 20);
        }
        setNotes(fetchedNotes);

        // 2. Fetch Stories
        const activeSet = new Set<string>();
        const storiesApiRes = await api.stories.getFeed().catch(() => null);
        if (storiesApiRes && Array.isArray(storiesApiRes.stories) && storiesApiRes.stories.length > 0) {
          storiesApiRes.stories.forEach((st: any) => {
            const aId = st.authorId || st.userId;
            if (aId) activeSet.add(aId);
          });
        } else if (db) {
          const storiesQuery = query(
            collection(db, 'stories'),
            where('createdAt', '>', yesterdayTimestamp),
            limit(50)
          );
          const snap = await getDocs(storiesQuery);
          snap.docs.forEach(docSnap => {
            const data = docSnap.data();
            const authorId = data.authorId || data.userId;
            if (authorId && followingWithMe.includes(authorId)) {
              const audience = data.audience || 'public';
              if (authorId === profile.id || audience === 'public' || audience === 'followers') {
                activeSet.add(authorId);
              } else if (audience === 'closeFriends') {
                const visibleTo = data.visibleTo || [];
                if (visibleTo.includes(profile.id)) {
                  activeSet.add(authorId);
                }
              }
            }
          });
        }
        setActiveStories(activeSet);
      } catch (err) {
        logger.warn('[useInboxData] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInboxData();
  }, [db, user?.uid, profile?.id, followingStr, allowedIdsStr]);

  const createNote = async (
    content: string, 
    audience: 'public' | 'followers' | 'closeFriends' = 'public', 
    music?: string, 
    mediaUrl?: string, 
    mediaType?: 'image' | 'video', 
    hiddenFrom: string[] = [],
    musicData?: { 
      title?: string; 
      artist?: string; 
      url?: string; 
      coverUrl?: string; 
      spotifyUrl?: string;
      clipStart?: number;
      clipDuration?: number;
      style?: 'badge' | 'lyrics' | 'disc';
      lyrics?: string;
    }
  ) => {
    if (!db || !user || !profile || !canWrite('createNote', 10000)) return;
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await addDoc(collection(db, 'notes'), {
        authorId: profile.id,
        authorUid: user.uid,
        userName: profile.displayName || profile.username,
        userAvatar: profile.photoURL,
        content,
        audience,
        visibleTo: audience === 'closeFriends' ? (profile.social?.closeFriends || []) : [],
        hiddenFrom: hiddenFrom || [],
        music: music || (musicData ? `${musicData.title} - ${musicData.artist}` : null),
        musicUrl: musicData?.url || null,
        musicCover: musicData?.coverUrl || null,
        spotifyUrl: musicData?.spotifyUrl || null,
        musicClipStart: musicData?.clipStart ?? 0,
        musicClipDuration: musicData?.clipDuration ?? 30,
        musicStyle: musicData?.style || 'badge',
        musicLyrics: musicData?.lyrics || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        reactions: [],
        seenBy: []
      });
    } catch (e: any) { logger.error("Failed to create note", e); addToast({ title: "Failed", message: "Failed to create note", type: "warning" }); }
  };

  const deleteNote = async (noteId: string) => {
    if (!db || !noteId) return;
    try {
      await deleteDoc(doc(db, 'notes', noteId));
    } catch (e: any) {
      logger.error("Failed to delete note", e);
    }
  };

  return {
    notes,
    activeStories,
    createNote,
    deleteNote,
    loading
  };
};
