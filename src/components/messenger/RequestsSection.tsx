import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Shield, Trash2, UserPlus, Ghost, Loader2 } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, deleteDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';



const extractMessageText = (val: any): string => {
  if (!val) return 'No messages yet';
  if (typeof val === 'string') return val;
  if (typeof val.text === 'string') return val.text;
  if (typeof val.latestMessagePreview === 'string') return val.latestMessagePreview;
  if (val.mediaUrl || val.type === 'media' || val.type === 'image') return 'Sent an attachment';
  if (val.type === 'voice') return 'Voice note';
  if (val.type === 'call_history') return 'Call log';
  return 'New message request';
};

export const RequestsSection = ({ chats, onBack, onUserClick, onChatSelect }: { chats: any[], onBack: () => void, onUserClick?: (user: any) => void, onChatSelect?: (id: string) => void }) => {
  const { db, profile, toggleFollow, addToast } = useAeirmist();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAccept = async (convId: string, otherId: string) => {
    if (!db) return;
    setAcceptingId(convId);
    try {
      // 1. Update conversation status
      await updateDoc(doc(db, 'conversations', convId), {
        status: 'active',
        acceptedAt: serverTimestamp()
      });

      // 2. Clear view and open chat immediately for visual feedback
      if (onChatSelect) {
        onChatSelect(convId);
      }

      // 3. Follow back if not already following (background effort)
      try {
        await toggleFollow(otherId);
      } catch (err) {
        logger.warn("Follow back during acceptance failed", err);
      }

      addToast({
        title: 'Connection Established',
        message: 'Request accepted.',
        type: 'success'
      });
    } catch (e) {
      logger.error("Accept request failed", e);
      addToast({
        title: 'Sync Error',
        message: 'Failed to accept request.',
        type: 'warning'
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleBlock = async (otherId: string, convId: string) => {
    if (!db || !profile) return;
    setBlockingId(convId);
    try {
      await updateDoc(doc(db, 'profiles', profile.id), {
        'social.blocked': arrayUnion(otherId)
      });
      await deleteDoc(doc(db, 'conversations', convId));
      addToast({
        title: 'Connection Severed',
        message: 'Successfully blocked user and deleted request.',
        type: 'info'
      });
    } catch (e) {
      logger.error("Block request failed", e);
      addToast({
        title: 'Block Error',
        message: 'Failed to block user and delete request.',
        type: 'warning'
      });
    } finally {
      setBlockingId(null);
    }
  };

  const handleDelete = async (convId: string) => {
    if (!db) return;
    setDeletingId(convId);
    try {
      await deleteDoc(doc(db, 'conversations', convId));
      addToast({
        title: 'Deleted',
        message: 'Successfully deleted conversation request.',
        type: 'info'
      });
    } catch (e) {
      logger.error("Delete request failed", e);
      addToast({
        title: 'Delete Error',
        message: 'Failed to delete conversation request.',
        type: 'warning'
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-aeirmist-bg">
      <div className="p-6 pt-[calc(1rem+var(--sat,var(--safe-area-inset-top,0px)))] md:pt-6 border-b border-white/10 flex items-center gap-4">
        <button onClick={onBack} className="text-white/60 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-display font-bold">Message Requests</h2>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Inbound Signals</p>
        </div>
      </div>

      <div className="p-4 bg-aeirmist-cyan/5 border-b border-aeirmist-cyan/10">
        <p className="text-[10px] text-aeirmist-cyan uppercase tracking-widest font-bold flex items-center gap-2">
          <Shield size={14} /> Smart AI Filtering Active
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chats.length === 0 ? (
          <div className="text-center py-20 text-white/20 uppercase text-[10px] font-black tracking-widest leading-loose">
            No pending activity signals.
          </div>
        ) : (
          chats.map((req) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 rounded-3xl border border-white/5 bg-white/5"
            >
              <div className="flex gap-4 mb-4">
              <img 
                src={req.photo} 
                alt={req.name} 
                className="w-12 h-12 rounded-full border border-white/10 cursor-pointer object-cover" 
                onClick={() => onUserClick?.({ id: req.otherParticipantId, displayName: req.name, photoURL: req.photo })}
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 
                    className="text-sm font-bold truncate cursor-pointer hover:text-aeirmist-cyan transition-colors"
                    onClick={() => onUserClick?.({ id: req.otherParticipantId, displayName: req.name, photoURL: req.photo })}
                  >
                    {req.name}
                  </h3>
                  <span className="text-[10px] text-white/30 uppercase">{req.time}</span>
                </div>
                <p className="text-xs text-white/60 line-clamp-2 mt-1 italic">"{extractMessageText(req.lastMessage)}"</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleAccept(req.id, req.otherParticipantId)}
                disabled={acceptingId === req.id || deletingId === req.id || blockingId === req.id}
                className="py-2.5 rounded-xl bg-aeirmist-cyan text-aeirmist-bg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_0_200px_rgba(0,242,255,0.3)] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
              >
                {acceptingId === req.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserPlus size={14} />
                )}
                {acceptingId === req.id ? 'SYNCING...' : 'Accept'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleDelete(req.id)}
                  disabled={acceptingId === req.id || deletingId === req.id || blockingId === req.id}
                  className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Purge Message"
                >
                  {deletingId === req.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
                <button 
                  onClick={() => handleBlock(req.otherParticipantId, req.id)}
                  disabled={acceptingId === req.id || deletingId === req.id || blockingId === req.id}
                  className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-aeirmist-magenta/60 hover:text-aeirmist-magenta transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Sever Connection (Block)"
                >
                  {blockingId === req.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Shield size={14} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )))}
      </div>
    </div>
  );
};
