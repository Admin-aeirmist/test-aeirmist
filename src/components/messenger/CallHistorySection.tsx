import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Phone, Video, Trash2, Clock, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall, Loader2 } from 'lucide-react';
import { formatShortTimestamp, formatAeirmistTimestamp } from '../../lib/date';
import { useAeirmist } from '../../context/AeirmistContext';
import { collection, query, where, orderBy, limit, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';

interface CallRecord {
  id: string;
  callerId: string;
  receiverId: string;
  callerName: string;
  callerPhoto: string;
  receiverName: string;
  receiverPhoto: string;
  type: 'audio' | 'video';
  status: string;
  duration: number;
  timestamp: any;
  participants: string[];
}

export const CallHistorySection = ({
  onBack,
  onRedial,
  onUserClick
}: {
  onBack: () => void;
  onRedial?: (profileId: string, type: 'audio' | 'video') => void;
  onUserClick?: (user: any) => void;
}) => {
  const { db, profile, user, addToast, allProfiles = [] } = useAeirmist();
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !user?.uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'callHistory'),
      where('participants', 'array-contains', user.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as CallRecord));
        setHistory(records);
        setLoading(false);
      },
      (err) => {
        logger.error('Failed to subscribe to call history', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, user?.uid]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      if (db) {
        await deleteDoc(doc(db, 'callHistory', id));
      }
      setHistory(prev => prev.filter(c => c.id !== id));
      addToast?.({ title: 'Deleted', message: 'Call log removed.', type: 'info' });
    } catch (e: any) {
      logger.error('Failed to delete history', e);
      addToast?.({ title: 'Failed', message: 'Failed to delete call log.', type: 'warning' });
    } finally {
      setDeletingId(null);
    }
  };

  const getCallIcon = (record: CallRecord) => {
    const isMeCaller = record.callerId === profile?.id;
    if (record.status === 'missed' || record.status === 'rejected') {
      return <PhoneMissed size={14} className="text-red-400" />;
    }
    return isMeCaller
      ? <PhoneOutgoing size={14} className="text-aeirmist-cyan" />
      : <PhoneIncoming size={14} className="text-aeirmist-lime" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full bg-[#0a0a0c] select-none"
    >
      {/* Instagram-style Header */}
      <div className="px-6 py-5 border-b border-white/8 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            title="Back to Chats"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Call history</h1>
            <p className="text-xs text-white/40 mt-0.5">Recent audio and video calls across your encrypted frequencies.</p>
          </div>
        </div>

        {history.length > 0 && (
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-white/50">
            {history.length} {history.length === 1 ? 'call' : 'calls'}
          </span>
        )}
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 size={28} className="animate-spin text-white/30" />
            <p className="text-xs text-white/40 font-medium">Loading call history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center px-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/25">
              <Phone size={32} />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-sm font-bold text-white/80">No Call History</p>
              <p className="text-xs text-white/40 leading-relaxed">
                Your past calls will show up here. Start an audio or video call with any contact from their chat.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5 bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            {history.map((record) => {
              const isCaller = record.callerId === profile?.id;
              const otherId = isCaller ? record.receiverId : record.callerId;
              const otherName = isCaller ? record.receiverName : record.callerName;
              const otherPhoto = isCaller ? record.receiverPhoto : record.callerPhoto;

              // Find other profile in memory for username if available
              const otherProfile = allProfiles.find((p: any) => p.id === otherId || p.uid === otherId);
              const username = otherProfile?.username;

              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-white/[0.03] transition-colors group"
                >
                  <div
                    className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      if (onUserClick && otherId) {
                        onUserClick({
                          id: otherId,
                          displayName: otherName,
                          username: username || otherName,
                          photoURL: otherPhoto
                        });
                      }
                    }}
                  >
                    {/* Square Profile Picture with Call Badge */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 border border-white/10 relative">
                        {otherPhoto ? (
                          <img
                            src={otherPhoto}
                            alt={otherName || 'Caller'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-white/40 text-base bg-gradient-to-tr from-white/5 to-white/15">
                            {(otherName || 'U')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-[#0a0a0c] border border-white/10 flex items-center justify-center shadow-md">
                        {getCallIcon(record)}
                      </div>
                    </div>

                    {/* Caller Name, Username & Timestamp */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate hover:underline">
                        {otherName || 'Unknown Contact'}
                      </p>
                      {username && (
                        <p className="text-xs text-white/45 truncate mt-0.5">
                          @{username}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-white/35">
                        <span className="flex items-center gap-1">
                          {record.type === 'video' ? <Video size={11} className="text-white/40" /> : <Phone size={11} className="text-white/40" />}
                          <span className="capitalize">{record.type} call</span>
                        </span>
                        <span>•</span>
                        <span>{formatShortTimestamp(record.timestamp)} ago</span>
                        {record.duration > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Clock size={10} />
                              {Math.floor(record.duration / 60)}m {record.duration % 60}s
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Redial & Delete */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {onRedial && otherId && (
                      <button
                        onClick={() => onRedial(otherId, record.type || 'audio')}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold text-white border border-white/10 hover:border-white/20 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                        title={`Call ${otherName}`}
                      >
                        <PhoneCall size={13} className="text-aeirmist-cyan" />
                        <span className="hidden sm:inline">Call</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDelete(record.id, e)}
                      disabled={deletingId === record.id}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 border border-white/5 hover:border-red-500/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Delete log"
                    >
                      {deletingId === record.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};
