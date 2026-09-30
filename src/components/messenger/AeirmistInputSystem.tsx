import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Image as ImageIcon, 
  Mic, 
  Smile, 
  Plus, 
  Paperclip, 
  Gift, 
  FileText, 
  Music, 
  Zap, 
  Sparkles, 
  X, 
  Pause, 
  Play, 
  Trash2,
  Cpu,
  Brain,
  MessageSquare,
  Repeat,
  Type,
  Sticker,
  BarChart3,
  Search,
  CheckCheck,
  Camera,
  MapPin,
  UserPlus
} from 'lucide-react';
import { VoiceVisualizer } from './VoiceVisualizer';
import { useAeirmist } from '../../context/AeirmistContext';
import { logger } from '@/src/utils/logger';

const EmojiPicker = React.lazy(() => import('emoji-picker-react'));

const STICKER_PACK = [
  { id: 'neon_lightning', emoji: '⚡', name: 'Overcharged' },
  { id: 'neon_fire', emoji: '🔥', name: 'Lit' },
  { id: 'neon_rocket', emoji: '🚀', name: 'To The Moon' },
  { id: 'neon_diamond', emoji: '💎', name: 'Diamond' },
  { id: 'neon_crown', emoji: '👑', name: 'Royalty' },
  { id: 'neon_ufo', emoji: '🛸', name: 'Alien Void' },
  { id: 'neon_robot', emoji: '🤖', name: 'Synth' },
  { id: 'neon_heart', emoji: '💖', name: 'Cyber Love' },
  { id: 'neon_cat', emoji: '🐱', name: 'Neon Neko' },
  { id: 'neon_sparkles', emoji: '✨', name: 'Pure Magic' },
  { id: 'neon_shield', emoji: '🛡️', name: 'Secured' },
  { id: 'neon_glitch', emoji: '👾', name: 'Glitch' },
  { id: 'neon_wave', emoji: '🌊', name: 'Flow State' },
  { id: 'neon_target', emoji: '🎯', name: 'On Point' },
  { id: 'neon_planet', emoji: '🪐', name: 'Cosmic' },
  { id: 'neon_crystal', emoji: '🔮', name: 'Oracle' },
  { id: 'neon_ghost', emoji: '👻', name: 'Ghosted' },
  { id: 'neon_skull', emoji: '💀', name: 'Dead' },
  { id: 'neon_sunglasses', emoji: '😎', name: 'Ultra Cool' },
  { id: 'neon_party', emoji: '🎉', name: 'Celebrate' },
  { id: 'neon_eyes', emoji: '👀', name: 'Watching' },
  { id: 'neon_clapping', emoji: '👏', name: 'Bravo' },
  { id: 'neon_hundred', emoji: '💯', name: 'Absolute' },
  { id: 'neon_galaxy', emoji: '🌌', name: 'Aeirmist Void' },
];

interface AeirmistInputSystemProps {
  chatId?: string;
  onSendMessage: (text: string, mood?: string, replyingTo?: any) => void;
  onSendMedia?: (file: File, isHD?: boolean, replyingTo?: any) => void;
  onSendSpecialMessage?: (params: { type: 'location' | 'contact' | 'sticker' | 'file'; text?: string; mediaUrl?: string; metadata?: any; replyingTo?: any; }) => void;
  onTyping?: (isTyping: boolean) => void;
  onOpenCamera?: () => void;
  onCaptureRef?: React.MutableRefObject<((file: File) => void) | null>;
  mood?: string;
  isHDActive?: boolean;
  onHDToggle?: () => void;
  replyingTo?: any;
  onCancelReply?: () => void;
  editingMessage?: any;
  onCancelEdit?: () => void;
  onSaveEdit?: (messageId: string, newText: string) => void;
}

export const AeirmistInputSystem: React.FC<AeirmistInputSystemProps> = React.memo(({ 
  chatId,
  onSendMessage, 
  onSendMedia, 
  onSendSpecialMessage,
  onTyping, 
  onOpenCamera, 
  onCaptureRef, 
  mood = 'neutral',
  isHDActive: externalHD,
  onHDToggle: externalHDToggle,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSaveEdit
}) => {
  const [inputText, setInputText] = useState('');

  // Draft Logic
  useEffect(() => {
    if (chatId && !editingMessage) {
      const draft = localStorage.getItem(`aeirmist_chat_draft_${chatId}`);
      if (draft) {
        setInputText(draft);
        if (textareaRef.current) {
          textareaRef.current.style.height = '40px';
        }
      } else {
        setInputText('');
      }
    }
  }, [chatId, editingMessage]);

  useEffect(() => {
    if (chatId && !editingMessage) {
      if (inputText.trim()) {
        localStorage.setItem(`aeirmist_chat_draft_${chatId}`, inputText);
      } else {
        localStorage.removeItem(`aeirmist_chat_draft_${chatId}`);
      }
    }
  }, [inputText, chatId, editingMessage]);

  useEffect(() => {
    if (editingMessage) {
      setInputText(editingMessage.text || '');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
      }, 50);
    } else {
      setInputText('');
    }
  }, [editingMessage]);

  const [pendingMedia, setPendingMedia] = useState<{ file: File, preview: string }[]>([]);
  const [internalHD, setInternalHD] = useState(false);
  
  const isHD = externalHD !== undefined ? externalHD : internalHD;
  const toggleHD = externalHDToggle || (() => setInternalHD(!internalHD));

  useEffect(() => {
    if (onCaptureRef) {
        onCaptureRef.current = (file: File) => {
            setPendingMedia(prev => [...prev, {
                file,
                preview: URL.createObjectURL(file)
            }]);
        };
    }
    return () => {
        if (onCaptureRef) onCaptureRef.current = null;
    };
  }, [onCaptureRef]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showMoods, setShowMoods] = useState(false);
  const [currentMood, setCurrentMood] = useState(mood);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const { requestPermission, permissions, addToast, profile } = useAeirmist();

  const handleShareLocation = () => {
    setShowAttachments(false);
    if (!navigator.geolocation) {
      addToast({
        title: "Geolocation Unsupported",
        message: "Your browser or device does not support GPS location.",
        type: "warning"
      });
      return;
    }

    addToast({
      title: "Locating...",
      message: "Fetching current GPS coordinates...",
      type: "info"
    });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        onSendSpecialMessage?.({
          type: 'location',
          text: `📍 Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          metadata: {
            latitude: lat,
            longitude: lng,
            accuracy: pos.coords.accuracy,
            mapUrl
          },
          replyingTo
        });
        addToast({
          title: "Location Shared",
          message: "Location pin sent to conversation.",
          type: "success"
        });
      },
      (err) => {
        logger.warn("Location error:", err);
        addToast({
          title: "Location Denied",
          message: "Could not retrieve GPS coordinates. Please ensure location permission is enabled.",
          type: "warning"
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleShareContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) {
      addToast({ title: "Name Required", message: "Please enter a contact name.", type: "warning" });
      return;
    }

    onSendSpecialMessage?.({
      type: 'contact',
      text: `👤 Contact: ${contactName.trim()}`,
      metadata: {
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim() || undefined,
        contactHandle: contactPhone.trim().startsWith('@') ? contactPhone.trim() : undefined
      },
      replyingTo
    });

    setShowContactModal(false);
    setContactName('');
    setContactPhone('');
  };

  const handleSelectSticker = (sticker: { id: string; emoji: string; name: string }) => {
    onSendSpecialMessage?.({
      type: 'sticker',
      text: sticker.emoji,
      metadata: {
        stickerId: sticker.id,
        stickerName: sticker.name,
        stickerEmoji: sticker.emoji
      },
      replyingTo
    });
    setShowStickerPicker(false);
  };

  const startRecording = async () => {
    const granted = await requestPermission('microphone');
    if (!granted) {
      addToast({
        title: "Microphone Blocked",
        message: "Please allow microphone access in your browser, or open the app in a new tab if you are using an iframe.",
        type: "warning"
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      };

      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
    } catch (err) {
      logger.error("Failed to start recording:", err);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch (e) {
        logger.warn("Error stopping recorder on cancel:", e);
      }
    }
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
    }
    setIsRecording(false);
    setIsPaused(false);
    setAudioStream(null);
    setAudioBlob(null);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  // Component unmount cleanup to release microphone tracks immediately
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
        } catch (e) {
          logger.warn("Error stopping recorder on unmount:", e);
        }
      }
      if (audioStream) {
        audioStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [audioStream]);

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (onSendMedia) {
          const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          onSendMedia(file, false, replyingTo);
          onCancelReply?.();
        }
        if (audioStream) {
          audioStream.getTracks().forEach(track => track.stop());
        }
        setIsRecording(false);
        setAudioBlob(null);
        setAudioStream(null);
        setRecordingTime(0);
      };
      mediaRecorderRef.current.stop();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newMedia = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setPendingMedia(prev => [...prev, ...newMedia]);
    setShowAttachments(false);
    if (e.target) {
      e.target.value = '';
    }
  };

  const removePendingMedia = (index: number) => {
    setPendingMedia(prev => {
        const item = prev[index];
        URL.revokeObjectURL(item.preview);
        return prev.filter((_, i) => i !== index);
    });
  };

  const placeholders = [
    "Type a message...",
    "What's on your mind?",
    "Say something...",
    "Send a message...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const moods = [
    { id: 'ecstatic', icon: '⚡', color: 'aeirmist-cyan', label: 'Overcharged' },
    { id: 'chill', icon: '🌊', color: 'aeirmist-magenta', label: 'Flowing' },
    { id: 'intense', icon: '🔥', color: 'aeirmist-lime', label: 'Focused' },
    { id: 'melancholy', icon: '🌑', color: 'white', label: 'In Void' },
  ];

  const lastTypingCall = useRef(0);
  useEffect(() => {
    if (onTyping) {
      if (inputText.length > 0) {
        const now = Date.now();
        if (now - lastTypingCall.current > 3000) {
          onTyping(true);
          lastTypingCall.current = now;
        }
        const timeout = setTimeout(() => {
          onTyping(false);
          lastTypingCall.current = 0;
        }, 5000);
        return () => clearTimeout(timeout);
      } else {
        onTyping(false);
        lastTypingCall.current = 0;
      }
    }
  }, [inputText, onTyping]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  const handleSend = () => {
    if (editingMessage && onSaveEdit) {
      if (inputText.trim()) {
        onSaveEdit(editingMessage.id, inputText);
      }
      onCancelEdit?.();
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
      return;
    }

    if (pendingMedia.length > 0) {
      pendingMedia.forEach(m => {
        onSendMedia?.(m.file, isHD, replyingTo);
        URL.revokeObjectURL(m.preview);
      });
      setPendingMedia([]);
      onCancelReply?.();
    }
 
    if (inputText.trim()) {
      onSendMessage(inputText, currentMood, replyingTo);
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
      onCancelReply?.();
    }
    
    setShowEmoji(false);
  };

  const handleVoiceSend = () => {
    stopAndSendRecording();
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full min-w-0" data-input-system-wrapper="true">
      <div 
        data-input-system="true"
        className={`relative flex flex-col w-full bg-[#111318]/90 dark:bg-[#111318]/90 messenger-input-glass backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.30)] transition-all duration-300 ${pendingMedia.length > 0 || replyingTo ? 'rounded-[24px]' : 'rounded-full'}`}
      >
        <AnimatePresence>
          {pendingMedia.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex gap-3 px-6 py-4 overflow-x-auto no-scrollbar border-b border-white/5"
            >
              {pendingMedia.map((media, idx) => (
                <motion.div 
                  key={idx}
                  className="relative flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden group/thumb border border-white/10 shadow-lg bg-black/40"
                >
                  {media.file.type.startsWith('image/') || media.file.type.startsWith('video/') ? (
                    <img src={media.preview} alt="" className="w-full h-full object-cover" />
                  ) : media.file.type.startsWith('audio/') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-purple-500/10 text-center">
                      <Music size={20} className="text-purple-400 mb-1" />
                      <span className="text-[8px] text-white/70 truncate w-full font-mono">{media.file.name}</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-lime-500/10 text-center">
                      <FileText size={20} className="text-lime-400 mb-1" />
                      <span className="text-[8px] text-white/70 truncate w-full font-mono">{media.file.name}</span>
                    </div>
                  )}
                  <button 
                    onClick={() => removePendingMedia(idx)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-6 mt-4 rounded-[20px] p-4 bg-white/5 border border-white/10 flex items-center justify-between gap-4 overflow-hidden"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase text-[#00F2FF] tracking-widest mb-1">
                  Replying to {replyingTo.senderId === profile?.id ? "You" : (replyingTo.metadata?.senderName || "User")}
                </p>
                <p className="text-[13px] text-white/70 truncate">{replyingTo.text || 'Shared Media'}</p>
              </div>
              <button onClick={onCancelReply} className="text-white/40 hover:text-white transition-colors p-1"><X size={18}/></button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex items-center gap-1 px-2 py-1.5 min-h-[48px]`}>
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="sr-only" multiple />
          <button 
            onClick={() => setShowEmoji(!showEmoji)}
            className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${showEmoji ? 'text-[#00F2FF] bg-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Smile size={22} strokeWidth={1.5} />
          </button>

          <button 
            onClick={() => setShowAttachments(!showAttachments)}
            className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${showAttachments ? 'text-aeirmist-magenta bg-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Plus size={22} strokeWidth={1.5} className={`transition-transform duration-300 ${showAttachments ? 'rotate-45' : ''}`} />
          </button>

          <div className="flex-1 min-w-0 relative">
            <textarea 
              ref={textareaRef}
              data-input-textarea="true"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                autoResize();
              }}
              placeholder="Type a message..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent border-none py-2 px-4 outline-none resize-none text-[14px] md:text-[15px] h-[40px] placeholder:text-white/30 font-normal tracking-normal text-white/95 leading-normal flex items-center overflow-y-auto no-scrollbar"
              style={{ height: '40px', fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontWeight: 400 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;

                const filesToPaste: File[] = [];
                for (let i = 0; i < items.length; i++) {
                  if (items[i].kind === 'file') {
                    const file = items[i].getAsFile();
                    if (file) {
                      filesToPaste.push(file);
                    }
                  }
                }

                if (filesToPaste.length > 0) {
                  e.preventDefault();
                  const newMedia = filesToPaste.map(file => ({
                    file,
                    preview: URL.createObjectURL(file)
                  }));
                  setPendingMedia(prev => [...prev, ...newMedia]);
                }
              }}
            />
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
              <AnimatePresence mode="wait">
                {inputText.trim() || pendingMedia.length > 0 ? (
                  <motion.button
                    key="send"
                    initial={{ opacity: 0, scale: 0.8, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 10 }}
                    onClick={handleSend}
                    className="w-10 h-10 rounded-full bg-[#00F2FF] flex items-center justify-center text-[#111318] shadow-[0_4px_20px_rgba(0,242,255,0.3)] hover:scale-105 active:scale-95 transition-all"
                  >
                    <Send size={20} fill="currentColor" strokeWidth={2.5} />
                  </motion.button>
                ) : (
                  <motion.button 
                    key="mic"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={startRecording}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <Mic size={22} strokeWidth={1.5} />
                  </motion.button>
                )}
              </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isRecording && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-0 z-30 bg-[#1A1B22] rounded-[28px] border border-white/10 flex items-center px-4 gap-4"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[15px] font-bold text-white/90">{formatTime(recordingTime)}</span>
              <div className="flex-1 h-8">
                <VoiceVisualizer isRecording={isRecording && !isPaused} stream={audioStream} />
              </div>
            </div>
            <div className="flex items-center gap-2">
               <button 
                 onClick={cancelRecording}
                 className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-red-500"
               >
                 <Trash2 size={20} />
               </button>
               <button 
                 onClick={handleVoiceSend}
                 className="w-12 h-12 rounded-full bg-[#11D4FF] flex items-center justify-center text-[#1A1B22] shadow-lg"
               >
                 <Send size={20} fill="currentColor" />
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAttachments && (
          <motion.div key="attachment-menu-wrapper">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]" 
              onClick={() => setShowAttachments(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-20 md:right-0 z-[91] bg-[#111318]/98 backdrop-blur-2xl border-t md:border border-white/10 rounded-t-[32px] md:rounded-[32px] shadow-[0_-20px_60px_rgba(0,0,0,0.5)] w-full md:w-[420px] overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Share to Chat</h3>
                  <button onClick={() => setShowAttachments(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white"><X size={18}/></button>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <AttachmentItem 
                    icon={<ImageIcon size={22} />} 
                    label="Photos" 
                    color="cyan" 
                    onClick={() => { 
                      if(fileInputRef.current) { 
                        fileInputRef.current.accept = "image/*,video/*"; 
                        fileInputRef.current.value = ""; 
                        fileInputRef.current.click(); 
                      } 
                      setShowAttachments(false); 
                    }} 
                  />
                  <AttachmentItem 
                    icon={<Camera size={22} />} 
                    label="Camera" 
                    color="magenta" 
                    onClick={() => { 
                      onOpenCamera?.(); 
                      setShowAttachments(false); 
                    }} 
                  />
                  <AttachmentItem 
                    icon={<FileText size={22} />} 
                    label="Files" 
                    color="lime" 
                    onClick={() => { 
                      if(fileInputRef.current) { 
                        fileInputRef.current.accept = ".pdf,.doc,.docx,.txt,.xls,.xlsx,.zip,.csv"; 
                        fileInputRef.current.value = ""; 
                        fileInputRef.current.click(); 
                      } 
                      setShowAttachments(false); 
                    }} 
                  />
                  <AttachmentItem 
                    icon={<Music size={22} />} 
                    label="Music" 
                    color="purple" 
                    onClick={() => { 
                      if(fileInputRef.current) { 
                        fileInputRef.current.accept = "audio/*"; 
                        fileInputRef.current.value = ""; 
                        fileInputRef.current.click(); 
                      } 
                      setShowAttachments(false); 
                    }} 
                  />
                  <AttachmentItem 
                    icon={<MapPin size={22} />} 
                    label="Location" 
                    color="red" 
                    onClick={handleShareLocation} 
                  />
                  <AttachmentItem 
                    icon={<UserPlus size={22} />} 
                    label="Contact" 
                    color="blue" 
                    onClick={() => { 
                      setShowAttachments(false); 
                      setShowContactModal(true); 
                    }} 
                  />
                  <AttachmentItem 
                    icon={<Sticker size={22} />} 
                    label="Stickers" 
                    color="pink" 
                    onClick={() => { 
                      setShowAttachments(false); 
                      setShowStickerPicker(true); 
                    }} 
                  />
                  <AttachmentItem 
                    icon={<Mic size={22} />} 
                    label="Voice" 
                    color="green" 
                    onClick={() => { 
                      startRecording(); 
                      setShowAttachments(false); 
                    }} 
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Sharing Modal */}
      <AnimatePresence>
        {showContactModal && (
          <motion.div key="contact-modal-wrapper" className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowContactModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-[#16181F] border border-white/10 rounded-3xl p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <UserPlus size={18} />
                  </div>
                  <h3 className="text-base font-bold text-white">Share Contact</h3>
                </div>
                <button onClick={() => setShowContactModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleShareContact} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Alex Vance"
                    required
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#00F2FF] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Phone or @Username (Optional)
                  </label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. +1 555-0192 or @alex"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#00F2FF] outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg transition-all"
                  >
                    Share
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cyberpunk Sticker Drawer */}
      <AnimatePresence>
        {showStickerPicker && (
          <motion.div key="sticker-picker-wrapper">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[95]" 
              onClick={() => setShowStickerPicker(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-20 md:right-0 z-[96] bg-[#111318]/98 backdrop-blur-2xl border-t md:border border-white/10 rounded-t-[32px] md:rounded-[32px] shadow-[0_-20px_60px_rgba(0,0,0,0.5)] w-full md:w-[420px] overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sticker size={18} className="text-[#FF4B91]" />
                    <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-white/70">Aeirmist Neon Stickers</h3>
                  </div>
                  <button onClick={() => setShowStickerPicker(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-[260px] overflow-y-auto no-scrollbar p-1">
                  {STICKER_PACK.map(st => (
                    <motion.button
                      key={st.id}
                      whileHover={{ scale: 1.25, rotate: [0, -5, 5, 0] }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleSelectSticker(st)}
                      className="w-12 h-12 flex flex-col items-center justify-center rounded-2xl bg-white/5 hover:bg-white/15 border border-white/5 hover:border-white/20 transition-colors"
                      title={st.name}
                    >
                      <span className="text-2xl select-none">{st.emoji}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEmoji && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-20 left-0 z-[100]"
          >
            <div className="relative">
              <button 
                onClick={() => setShowEmoji(false)}
                className="absolute -top-12 left-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white shadow-lg z-[101]"
              >
                <X size={16} />
              </button>
              <React.Suspense fallback={null}>
                <EmojiPicker 
                  onEmojiClick={(data) => {
                    setInputText(prev => prev + data.emoji);
                    setShowEmoji(false);
                  }}
                  theme={'dark' as any}
                  emojiStyle={'native' as any}
                  skinTonesDisabled
                />
              </React.Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const AttachmentItem = ({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, color: string, onClick?: () => void }) => {
  const colorMap: Record<string, string> = {
    cyan: 'text-[#00F2FF] bg-[#00F2FF]/10 border-[#00F2FF]/20',
    magenta: 'text-[#FF00EA] bg-[#FF00EA]/10 border-[#FF00EA]/20',
    lime: 'text-[#BCFF00] bg-[#BCFF00]/10 border-[#BCFF00]/20',
    yellow: 'text-[#FFE600] bg-[#FFE600]/10 border-[#FFE600]/20',
    orange: 'text-[#FF8A00] bg-[#FF8A00]/10 border-[#FF8A00]/20',
    purple: 'text-[#9747FF] bg-[#9747FF]/10 border-[#9747FF]/20',
    red: 'text-[#FF4B4B] bg-[#FF4B4B]/10 border-[#FF4B4B]/20',
    blue: 'text-[#4B8BFF] bg-[#4B8BFF]/10 border-[#4B8BFF]/20',
    pink: 'text-[#FF4B91] bg-[#FF4B91]/10 border-[#FF4B91]/20',
    green: 'text-[#4BFF81] bg-[#4BFF81]/10 border-[#4BFF81]/20',
  };

  return (
    <motion.button 
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-2 group"
    >
      <div className={`w-14 h-14 md:w-16 md:h-16 rounded-[20px] flex items-center justify-center border transition-all duration-300 ${colorMap[color] || 'text-white/40 bg-white/5 border-white/10'} group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)]`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold text-white/40 group-hover:text-white transition-colors">{label}</span>
    </motion.button>
  );
};
