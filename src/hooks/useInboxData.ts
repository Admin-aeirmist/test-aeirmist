import { useState, useEffect } from 'react';
import { useAeirmist } from '../context/AeirmistContext';
import { api } from '../services/api/client';
import { logger } from '@/src/utils/logger';

export const useInboxData = (allowedAuthorIds?: string[]) => {
  const { profile, canWrite, addToast } = useAeirmist();
  const [notes, setNotes] = useState<any[]>([]);
  const [activeStories, setActiveStories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchInbox = async () => {
    try {
      // 1. Fetch active notes from backend PostgreSQL
      const [notesRes, storiesRes] = await Promise.all([
        api.notes.getActive().catch(() => ({ notes: [] })),
        api.stories.getFeed().catch(() => ({ stories: [] })),
      ]);

      if (notesRes && notesRes.notes) {
        const formattedNotes = notesRes.notes.map((n: any) => ({
          id: n.id,
          authorId: n.userId,
          authorUid: n.userId,
          userName: n.author?.displayName || n.author?.username || 'User',
          userAvatar: n.author?.avatarKey || '',
          content: n.text,
          emoji: n.emoji,
          createdAt: n.createdAt,
          audience: 'public',
        }));
        setNotes(formattedNotes);
      }

      if (storiesRes && storiesRes.stories) {
        const activeSet = new Set<string>();
        storiesRes.stories.forEach((s: any) => {
          if (s.userId) activeSet.add(s.userId);
        });
        setActiveStories(activeSet);
      }
    } catch (err) {
      logger.warn('[useInboxData] Error fetching notes/stories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 15000); // 15s poll
    return () => clearInterval(interval);
  }, [profile?.id]);

  const createNote = async (
    content: string, 
    _audience: 'public' | 'followers' | 'closeFriends' = 'public', 
    _music?: string, 
    _mediaUrl?: string, 
    _mediaType?: 'image' | 'video', 
    _hiddenFrom: string[] = [],
    _musicData?: any
  ) => {
    if (!profile || !canWrite('createNote', 10000)) return;
    try {
      await api.notes.setNote(content);
      await fetchInbox();
      addToast({ title: "Note Shared", message: "Your 24h note is now live!", type: "success" });
    } catch (e: any) { 
      logger.error("Failed to create note", e); 
      addToast({ title: "Failed", message: "Failed to create note", type: "warning" }); 
    }
  };

  const deleteNote = async (_noteId?: string) => {
    try {
      await api.notes.deleteNote();
      await fetchInbox();
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
