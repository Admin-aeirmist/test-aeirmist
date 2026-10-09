import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Search, Image as ImageIcon, FileText, Download, Play, 
  ChevronLeft, ChevronRight, Copy, ExternalLink, Loader2, 
  FileCode, FileArchive, Music, ShieldCheck, Calendar, User
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, Firestore } from 'firebase/firestore';
import { getAvatarUrl } from '../../lib/avatar';
import { logger } from '@/src/utils/logger';
import { DownloadManagerService } from '../../services/DownloadManagerService';


interface SharedGroupMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: any;
  db: Firestore | null;
  initialTab?: 'media' | 'files' | 'all';
  addToast?: (toast: { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }) => void;
}

export const isVideoMedia = (m: any) => {
  const url = (m.mediaUrl || m.attachmentUrl || m.url || '').toLowerCase();
  const type = (m.type || m.mediaType || m.metadata?.mediaType || '').toLowerCase();
  return type === 'video' || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov') || url.endsWith('.m4v');
};

export const isImageMedia = (m: any) => {
  const url = (m.mediaUrl || m.attachmentUrl || m.url || '').toLowerCase();
  const type = (m.type || m.mediaType || m.metadata?.mediaType || '').toLowerCase();
  if (type === 'video' || isVideoMedia(m)) return false;
  if (type === 'file' || type === 'document') return false;
  return type === 'image' || type === 'media' || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.gif') || url.endsWith('.webp') || (url.length > 0 && type !== 'file');
};

export const isFileMedia = (m: any) => {
  const type = (m.type || m.mediaType || m.metadata?.mediaType || '').toLowerCase();
  return type === 'file' || type === 'document' || type === 'attachment' || (!isImageMedia(m) && !isVideoMedia(m));
};

export const SharedGroupMediaModal: React.FC<SharedGroupMediaModalProps> = ({
  isOpen,
  onClose,
  chat,
  db,
  initialTab = 'media',
  addToast
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'all'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Real-time Firestore query for messages with attachments
  useEffect(() => {
    if (!isOpen || !db || !chat?.id) return;

    setLoading(true);
    const msgsRef = collection(db, 'conversations', chat.id, 'messages');
    const q = query(msgsRef, orderBy('timestamp', 'desc'), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: any[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const url = data.mediaUrl || data.attachmentUrl || data.url;
        const type = (data.type || data.mediaType || '').toLowerCase();

        if (url || ['image', 'video', 'media', 'file', 'document', 'attachment', 'voice'].includes(type)) {
          fetched.push({
            id: doc.id,
            ...data
          });
        }
      });
      setMessages(fetched);
      setLoading(false);
    }, (error) => {
      logger.error("Error loading group shared media:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, db, chat?.id]);

  // Filter messages by tab & search query
  const filteredMessages = useMemo(() => {
    let list = messages;

    if (activeTab === 'media') {
      list = list.filter(m => isImageMedia(m) || isVideoMedia(m));
    } else if (activeTab === 'files') {
      list = list.filter(m => isFileMedia(m));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(m => {
        const text = (m.text || m.caption || m.filename || m.fileName || m.metadata?.fileName || '').toLowerCase();
        const sender = (m.senderName || m.senderDisplayName || '').toLowerCase();
        return text.includes(q) || sender.includes(q);
      });
    }

    return list;
  }, [messages, activeTab, searchQuery]);

  const mediaListOnly = useMemo(() => {
    return filteredMessages.filter(m => isImageMedia(m) || isVideoMedia(m));
  }, [filteredMessages]);

  const mediaCount = useMemo(() => {
    return messages.filter(m => isImageMedia(m) || isVideoMedia(m)).length;
  }, [messages]);

  const filesCount = useMemo(() => {
    return messages.filter(m => isFileMedia(m)).length;
  }, [messages]);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (selectedMediaIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setSelectedMediaIndex(prev => (prev !== null && prev > 0 ? prev - 1 : mediaListOnly.length - 1));
      } else if (e.key === 'ArrowRight') {
        setSelectedMediaIndex(prev => (prev !== null && prev < mediaListOnly.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'Escape') {
        setSelectedMediaIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMediaIndex, mediaListOnly]);

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    if (addToast) {
      addToast({ title: 'Link Copied', message: 'Attachment link copied to clipboard.', type: 'success' });
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Recently';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getFileDetails = (msg: any) => {
    const url = msg.mediaUrl || msg.attachmentUrl || msg.url || '';
    const name = msg.filename || msg.fileName || msg.metadata?.fileName || msg.text || msg.caption || 'Shared File';
    const lowerName = name.toLowerCase();

    let Icon = FileText;
    let iconColor = 'text-purple-400';
    let typeLabel = 'Document';

    if (lowerName.endsWith('.pdf')) {
      iconColor = 'text-rose-400';
      typeLabel = 'PDF Document';
    } else if (lowerName.endsWith('.zip') || lowerName.endsWith('.rar') || lowerName.endsWith('.7z') || lowerName.endsWith('.tar')) {
      Icon = FileArchive;
      iconColor = 'text-amber-400';
      typeLabel = 'Archive';
    } else if (lowerName.endsWith('.js') || lowerName.endsWith('.ts') || lowerName.endsWith('.tsx') || lowerName.endsWith('.json') || lowerName.endsWith('.html') || lowerName.endsWith('.css')) {
      Icon = FileCode;
      iconColor = 'text-cyan-400';
      typeLabel = 'Code File';
    } else if (lowerName.endsWith('.mp3') || lowerName.endsWith('.wav') || lowerName.endsWith('.m4a') || msg.type === 'voice') {
      Icon = Music;
      iconColor = 'text-emerald-400';
      typeLabel = 'Audio File';
    }

    return { url, name, Icon, iconColor, typeLabel };
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-4xl h-[85vh] bg-[#0E1117] border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative"
        >
          {/* MODAL HEADER */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-aeirmist-cyan/20 to-aeirmist-magenta/20 border border-white/10 flex items-center justify-center text-aeirmist-cyan font-bold">
                <ImageIcon size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  Shared Files & Media
                </h2>
                <p className="text-[11px] text-white/50 truncate max-w-[250px] sm:max-w-xs">
                  {chat?.groupName || chat?.name || 'Group Workspace'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* CONTROLS BAR: TABS + SEARCH */}
          <div className="px-6 py-3 border-b border-white/5 bg-black/20 flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* TABS */}
            <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/5 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('media')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'media'
                    ? 'bg-aeirmist-cyan text-black shadow-lg shadow-aeirmist-cyan/20'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <ImageIcon size={14} />
                <span>Media</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'media' ? 'bg-black/20 text-black' : 'bg-white/10 text-white/70'
                }`}>
                  {mediaCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('files')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'files'
                    ? 'bg-aeirmist-cyan text-black shadow-lg shadow-aeirmist-cyan/20'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileText size={14} />
                <span>Files</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'files' ? 'bg-black/20 text-black' : 'bg-white/10 text-white/70'
                }`}>
                  {filesCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-aeirmist-cyan text-black shadow-lg shadow-aeirmist-cyan/20'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>All Shared</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'all' ? 'bg-black/20 text-black' : 'bg-white/10 text-white/70'
                }`}>
                  {messages.length}
                </span>
              </button>
            </div>

            {/* SEARCH */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search files or sender..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 outline-none focus:border-aeirmist-cyan/50 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={32} className="animate-spin text-aeirmist-cyan" />
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                  Syncing group attachments...
                </p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-1">
                  {activeTab === 'files' ? <FileText size={32} /> : <ImageIcon size={32} />}
                </div>
                <h3 className="text-sm font-bold text-white">
                  {searchQuery ? 'No matching shared items found' : activeTab === 'files' ? 'No files or documents shared yet' : 'No photos or videos shared yet'}
                </h3>
                <p className="text-xs text-white/40 max-w-sm">
                  {searchQuery 
                    ? `No attachments matched "${searchQuery}". Try a different keyword.` 
                    : 'Media, documents, and files sent in this group chat will automatically appear here for all members.'}
                </p>
              </div>
            ) : activeTab === 'files' ? (
              /* FILES LIST VIEW */
              <div className="space-y-2.5">
                {filteredMessages.map((msg) => {
                  const { url, name, Icon, iconColor, typeLabel } = getFileDetails(msg);
                  const senderDetails = chat.participantDetails?.[msg.senderId] || chat.participantDetails?.[msg.authorId] || {};
                  const senderName = msg.senderName || msg.senderDisplayName || senderDetails.displayName || 'Group Member';
                  const senderAvatar = getAvatarUrl(msg.senderPhoto || senderDetails.photoURL);

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 ${iconColor}`}>
                          <Icon size={22} />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-aeirmist-cyan transition-colors">
                            {name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-white/40">
                            <span className="px-1.5 py-0.2 rounded bg-white/10 text-white/70 font-mono font-semibold">
                              {typeLabel}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-white/60">
                              <img src={senderAvatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                              {senderName}
                            </span>
                            <span>•</span>
                            <span>{formatTimestamp(msg.timestamp || msg.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* ACTION BUTTONS */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {url && (
                          <button
                            onClick={() => handleCopyLink(url)}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
                            title="Copy File Link"
                          >
                            <Copy size={15} />
                          </button>
                        )}

                        {url && (
                          <button
                            onClick={async () => {
                              const res = await DownloadManagerService.downloadMediaFile(url, name);
                              if (res.success) {
                                addToast?.({ title: 'Saved to Gallery', message: 'File saved directly to device storage.', type: 'success' });
                              } else {
                                addToast?.({ title: 'Download Issue', message: res.error || 'Failed to save file.', type: 'warning' });
                              }
                            }}
                            className="h-9 px-3.5 rounded-xl bg-aeirmist-cyan/10 hover:bg-aeirmist-cyan/20 border border-aeirmist-cyan/30 text-aeirmist-cyan text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                          >
                            <Download size={14} />
                            <span className="hidden sm:inline">Download</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* MEDIA GRID VIEW */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredMessages.map((msg, idx) => {
                  const url = msg.mediaUrl || msg.attachmentUrl || msg.url;
                  const isVid = isVideoMedia(msg);
                  const isFil = isFileMedia(msg);
                  const senderDetails = chat.participantDetails?.[msg.senderId] || chat.participantDetails?.[msg.authorId] || {};
                  const senderName = msg.senderName || msg.senderDisplayName || senderDetails.displayName || 'Member';

                  if (isFil && activeTab === 'all') {
                    const { name, Icon, iconColor } = getFileDetails(msg);
                    return (
                      <motion.div
                        key={msg.id}
                        whileHover={{ scale: 0.98 }}
                        onClick={() => {
                          if (url) window.open(url, '_blank');
                        }}
                        className="aspect-square rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col items-center justify-between text-center hover:border-aeirmist-cyan/50 transition-all cursor-pointer group relative overflow-hidden"
                      >
                        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center my-auto ${iconColor}`}>
                          <Icon size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-white/80 line-clamp-2 w-full break-all">
                          {name}
                        </span>
                        <span className="text-[9px] text-white/40 mt-1">
                          {senderName}
                        </span>
                      </motion.div>
                    );
                  }

                  const mediaIdxInList = mediaListOnly.findIndex(m => m.id === msg.id);

                  return (
                    <motion.div
                      key={msg.id}
                      whileHover={{ scale: 0.98 }}
                      onClick={() => {
                        if (mediaIdxInList !== -1) {
                          setSelectedMediaIndex(mediaIdxInList);
                        } else if (url) {
                          window.open(url, '_blank');
                        }
                      }}
                      className="aspect-square rounded-2xl bg-white/5 border border-white/10 overflow-hidden hover:border-aeirmist-cyan/50 transition-all cursor-pointer group relative shadow-md"
                    >
                      {isVid ? (
                        <div className="relative w-full h-full bg-black">
                          <video 
                            src={url} 
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                              <Play size={18} className="fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=60';
                          }}
                        />
                      )}

                      {/* HOVER OVERLAY WITH SENDER INFO */}
                      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                        <span className="text-[10px] font-bold text-white truncate max-w-[80%]">
                          {senderName}
                        </span>
                        <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                          <ExternalLink size={12} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LIGHTBOX / FULLSCREEN MEDIA PREVIEW */}
          <AnimatePresence>
            {selectedMediaIndex !== null && mediaListOnly[selectedMediaIndex] && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[220] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4"
                onClick={() => setSelectedMediaIndex(null)}
              >
                {/* PREV / NEXT BUTTONS */}
                {mediaListOnly.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMediaIndex(prev => (prev !== null && prev > 0 ? prev - 1 : mediaListOnly.length - 1));
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white shadow-2xl transition-all cursor-pointer"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMediaIndex(prev => (prev !== null && prev < mediaListOnly.length - 1 ? prev + 1 : 0));
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white shadow-2xl transition-all cursor-pointer"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                )}

                {/* TOP BAR ACTION CONTROLS */}
                <div
                  className="absolute top-4 right-4 sm:right-8 z-50 flex items-center gap-2 bg-black/60 p-2 rounded-2xl border border-white/10 backdrop-blur-xl"
                  onClick={e => e.stopPropagation()}
                >
                  {mediaListOnly[selectedMediaIndex]?.mediaUrl || mediaListOnly[selectedMediaIndex]?.attachmentUrl ? (
                    <>
                      <button
                        onClick={() => handleCopyLink(mediaListOnly[selectedMediaIndex].mediaUrl || mediaListOnly[selectedMediaIndex].attachmentUrl)}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-colors cursor-pointer"
                        title="Copy Link"
                      >
                        <Copy size={18} />
                      </button>

                      <button
                        onClick={async () => {
                          const targetUrl = mediaListOnly[selectedMediaIndex]?.mediaUrl || mediaListOnly[selectedMediaIndex]?.attachmentUrl;
                          if (!targetUrl) return;
                          const res = await DownloadManagerService.downloadMediaFile(targetUrl);
                          if (res.success) {
                            addToast?.({ title: 'Saved to Gallery', message: 'File saved directly to device storage.', type: 'success' });
                          } else {
                            addToast?.({ title: 'Download Issue', message: res.error || 'Failed to save file.', type: 'warning' });
                          }
                        }}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 hover:text-aeirmist-cyan transition-colors cursor-pointer active:scale-95"
                        title="Save to Gallery"
                      >
                        <Download size={18} />
                      </button>
                    </>
                  ) : null}

                  <div className="w-px h-6 bg-white/10 my-auto mx-1" />

                  <button
                    onClick={() => setSelectedMediaIndex(null)}
                    className="p-2.5 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* MEDIA DISPLAY */}
                <div 
                  className="relative max-w-4xl max-h-[80vh] flex flex-col items-center justify-center"
                  onClick={e => e.stopPropagation()}
                >
                  {isVideoMedia(mediaListOnly[selectedMediaIndex]) ? (
                    <video
                      src={mediaListOnly[selectedMediaIndex].mediaUrl || mediaListOnly[selectedMediaIndex].attachmentUrl}
                      controls
                      autoPlay
                      className="max-w-full max-h-[75vh] rounded-2xl shadow-2xl border border-white/10"
                    />
                  ) : (
                    <img
                      src={mediaListOnly[selectedMediaIndex].mediaUrl || mediaListOnly[selectedMediaIndex].attachmentUrl}
                      alt=""
                      className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-white/10"
                    />
                  )}

                  {/* MEDIA INFO CAPTION */}
                  <div className="mt-4 px-6 py-2.5 rounded-2xl bg-black/80 border border-white/10 backdrop-blur-xl flex items-center gap-4 text-xs text-white">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-aeirmist-cyan" />
                      <span className="font-bold">
                        {mediaListOnly[selectedMediaIndex].senderName || mediaListOnly[selectedMediaIndex].senderDisplayName || 'Group Member'}
                      </span>
                    </div>
                    <span className="text-white/20">•</span>
                    <div className="flex items-center gap-1.5 text-white/60">
                      <Calendar size={13} />
                      <span>{formatTimestamp(mediaListOnly[selectedMediaIndex].timestamp || mediaListOnly[selectedMediaIndex].createdAt)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
