import { useState, useEffect, useCallback } from 'react';
import { useAeirmist } from '../context/AeirmistContext';
import { logger } from '@/src/utils/logger';

export interface NGLMessage {
  id: string;
  recipientProfileId: string;
  recipientUid: string;
  senderUid?: string;
  content: string;
  createdAt: string;
  status: 'unread' | 'read' | 'archived' | 'replied';
  storyReplyId?: string;
  repliedAt?: string;
}

export const useNGL = (profileId?: string) => {
  const { user, profile, addToast } = useAeirmist();
  const [messages, setMessages] = useState<NGLMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageKey = profileId ? `aeirmist_ngl_${profileId}` : null;

  useEffect(() => {
    if (!profileId || !storageKey) {
      setMessages([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setMessages(JSON.parse(raw));
      }
    } catch {
      setMessages([]);
    }
  }, [profileId, storageKey]);

  const saveMessages = useCallback((updater: (prev: NGLMessage[]) => NGLMessage[]) => {
    setMessages(prev => {
      const next = updater(prev);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    });
  }, [storageKey]);

  const sendNGL = useCallback(async (targetProfileId: string, targetUid: string, content: string) => {
    if (!content.trim()) return false;
    try {
      const newMsg: NGLMessage = {
        id: 'ngl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        recipientProfileId: targetProfileId,
        recipientUid: targetUid,
        senderUid: user?.uid || (user as any)?.id || 'anonymous',
        content: content.trim(),
        createdAt: new Date().toISOString(),
        status: 'unread'
      };

      const key = `aeirmist_ngl_${targetProfileId}`;
      const existing: NGLMessage[] = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([newMsg, ...existing]));

      if (profileId === targetProfileId) {
        setMessages(prev => [newMsg, ...prev]);
      }

      addToast({ title: "Sent", message: "Signal delivered anonymously.", type: "success" });
      return true;
    } catch (err: any) {
      logger.error("[useNGL] Send Error:", err);
      addToast({ title: "Failed", message: "Failed to send message", type: "warning" });
      return false;
    }
  }, [user, profileId, addToast]);

  const markAsRead = useCallback(async (messageId: string) => {
    saveMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'read' } : m));
  }, [saveMessages]);

  const archiveNGL = useCallback(async (messageId: string) => {
    saveMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'archived' } : m));
  }, [saveMessages]);

  const deleteNGL = useCallback(async (messageId: string) => {
    saveMessages(prev => prev.filter(m => m.id !== messageId));
  }, [saveMessages]);

  const markAsReplied = useCallback(async (messageId: string, storyId: string) => {
    saveMessages(prev => prev.map(m => m.id === messageId ? {
      ...m,
      status: 'replied',
      storyReplyId: storyId,
      repliedAt: new Date().toISOString()
    } : m));
  }, [saveMessages]);

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
