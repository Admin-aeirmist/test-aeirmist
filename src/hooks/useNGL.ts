import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';
import { useAeirmist } from '../context/AeirmistContext';
import { logger } from '@/src/utils/logger';


export interface NGLMessage {
  id: string;
  recipientProfileId: string;
  recipientUid: string;
  senderUid?: string;
  content: string;
  createdAt: Timestamp;
  status: 'unread' | 'read' | 'archived' | 'replied';
  storyReplyId?: string;
  repliedAt?: Timestamp;
}

export const useNGL = (profileId?: string) => {
  const { db, user, profile, createNotification, addToast } = useAeirmist();
  const [messages, setMessages] = useState<NGLMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync messages if it's the current user's profile
  useEffect(() => {
    if (!db || !user || !profile || !profileId || profile.id !== profileId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'ngl_messages'),
      where('recipientProfileId', '==', profileId),
      where('recipientUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NGLMessage[];

      // Sort client-side by createdAt desc to avoid composite index requirements
      msgs.sort((a, b) => {
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

      setMessages(msgs);
      setLoading(false);
    }, (err) => {
      logger.error('[useNGL] Fetch Error:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, user?.uid, profile?.id, profileId]);

  const sendNGL = useCallback(async (targetProfileId: string, targetUid: string, content: string) => {
    if (!db || !content.trim()) return;

    try {
      await addDoc(collection(db, 'ngl_messages'), {
        recipientProfileId: targetProfileId,
        recipientUid: targetUid,
        senderUid: user?.uid || 'anonymous',
        content: content.trim(),
        createdAt: serverTimestamp(),
        status: 'unread'
      });

      // Create notification for recipient
      if (targetUid) {
        await createNotification(targetUid, 'ngl_received', 'Anonymous sent you a new signal.', {
          profileId: targetProfileId,
          type: 'ngl'
        });
      }

      return true;
    } catch (err: any) { logger.error("[useNGL] Send Error:", err); addToast({ title: "Failed", message: "Failed to send message", type: "warning" }); return false; }
  }, [db, user?.uid, createNotification]);

  const markAsRead = useCallback(async (messageId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'ngl_messages', messageId), {
        status: 'read'
      });
    } catch (err: any) { logger.error("[useNGL] Mark Read Error:", err); addToast({ title: "Failed", message: "Failed to mark as read", type: "warning" }); }
  }, [db]);

  const archiveNGL = useCallback(async (messageId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'ngl_messages', messageId), {
        status: 'archived'
      });
    } catch (err: any) { logger.error("[useNGL] Archive Error:", err); addToast({ title: "Failed", message: "Failed to archive", type: "warning" }); }
  }, [db]);

  const deleteNGL = useCallback(async (messageId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'ngl_messages', messageId));
    } catch (err: any) { logger.error("[useNGL] Delete Error:", err); addToast({ title: "Failed", message: "Failed to delete", type: "warning" }); }
  }, [db]);

  const markAsReplied = useCallback(async (messageId: string, storyId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'ngl_messages', messageId), {
        status: 'replied',
        storyReplyId: storyId
      });
    } catch (err: any) { logger.error("[useNGL] Mark Replied Error:", err); addToast({ title: "Failed", message: "Failed to mark replied", type: "warning" }); }
  }, [db]);

  return {
    messages,
    loading,
    error,
    sendNGL,
    markAsRead,
    archiveNGL,
    deleteNGL,
    markAsReplied
  };
};
