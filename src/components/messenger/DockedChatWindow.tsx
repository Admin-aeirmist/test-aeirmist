import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Phone, 
  Video, 
  Minus, 
  X, 
  Maximize2, 
  Send, 
  ThumbsUp, 
  Loader2, 
  MessageSquare,
  Smile,
  Plus,
  Mic,
  Palette,
  Check,
  CheckCheck,
  Trash2,
  PhoneOutgoing,
  PhoneIncoming,
  PhoneMissed
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { useAppearance } from '../../context/AppearanceContext';
import { messagingService } from '../../modules/messaging/MessagingService';
import { getAvatarUrl } from '../../lib/avatar';
import { api } from '../../services/api/client';
import { Message } from '../../types/messenger';
import { logger } from '../../utils/logger';
import { formatActiveStatus, extractTimestampMs, formatTimeOnly, formatDateSeparator } from '../../lib/date';
import { ChatWallpaperLayer, type ChatWallpaperConfig } from './ChatWallpaperLayer';
import { ChatWallpaperController, MESSENGER_THEMES } from './ChatWallpaperController';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';
import { VoicePlayback } from './VoicePlayback';
import { PermissionService } from '../../services/PermissionService';

interface DockedChatWindowProps {
  chatId: string;
  chatName: string;
  chatPhoto?: string;
  participantId?: string;
  initialThemeSettings?: any;
  onMinimize: () => void;
  onClose: () => void;
  onMaximize: () => void;
}

const QUICK_EMOJIS = ['❤️', '😂', '🔥', '😍', '👏', '⚡', '✨', '👍', '🙏', '🎉'];

export const DockedChatWindow: React.FC<DockedChatWindowProps> = ({
  chatId,
  chatName,
  chatPhoto,
  participantId,
  initialThemeSettings,
  onMinimize,
  onClose,
  onMaximize
}) => {
  const { user, profile, startCall, uploadMedia, onlineUsers, addToast, db } = useAeirmist();
  const { settings } = useAppearance();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [conversationData, setConversationData] = useState<any>(initialThemeSettings || null);
  const [isWallpaperCustomizerOpen, setIsWallpaperCustomizerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Voice Recording State & Refs ──
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const targetUserId = participantId || (chatId.startsWith('conv_') ? undefined : chatId);

  // Subscribe to participant profile in real time for presence
  useEffect(() => {
    if (!targetUserId) return;
    let isMounted = true;
    api.users.getProfile(targetUserId).then(res => {
      if (isMounted && res?.profile) {
        setTargetProfile(res.profile);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [targetUserId]);

  // Load conversation settings & subscribe to real-time theme updates
  useEffect(() => {
    if (!chatId) return;

    // Fast local storage load
    try {
      const stored = 
        localStorage.getItem(`chat_settings_${chatId}`) || 
        (participantId ? localStorage.getItem(`chat_settings_${participantId}`) : null) ||
        localStorage.getItem(`chat_theme_${chatId}`) ||
        (participantId ? localStorage.getItem(`chat_theme_${participantId}`) : null);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConversationData(parsed?.themeSettings || parsed);
      }
    } catch {}

    // Query backend conversations to get up-to-date themeSettings
    api.chat.getConversations().then(res => {
      const convs = res?.conversations || [];
      const match = convs.find((c: any) => 
        c.id === chatId || 
        (participantId && (c.otherParticipantId === participantId || c.otherParticipant?.id === participantId || c.otherParticipant?.userId === participantId))
      );
      if (match?.themeSettings) {
        setConversationData(match.themeSettings);
        try {
          localStorage.setItem(`chat_settings_${chatId}`, JSON.stringify(match.themeSettings));
        } catch {}
      }
    }).catch(() => {});

    // Listen to real-time theme updates
    const handleThemeUpdate = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (detail.conversationId === chatId || (participantId && detail.conversationId === participantId)) {
        setConversationData(detail.themeSettings);
      }
    };
    window.addEventListener('aeirmist_chat_theme_updated', handleThemeUpdate);
    return () => window.removeEventListener('aeirmist_chat_theme_updated', handleThemeUpdate);
  }, [chatId, participantId]);

  const avatar = getAvatarUrl(chatPhoto || targetProfile?.photoURL, chatName || targetProfile?.displayName || targetUserId);

  // Accurate last seen timestamp calculation combining user presence and latest message activity
  const accurateLastSeenMs = useMemo(() => {
    // 1. Explicit profile timestamps
    const t1 = extractTimestampMs(targetProfile?.lastSeen);
    const t2 = extractTimestampMs(targetProfile?.lastActiveAt);
    const t3 = extractTimestampMs(targetProfile?.updatedAt);
    let candidate = Math.max(t1, t2, t3);

    // 2. Check latest activity from messages in this chat from the other participant
    if (messages && messages.length > 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        const isMsgFromMe = (
          m.senderId === profile?.id || 
          m.senderUid === user?.uid || 
          (profile?.userId && m.senderId === profile.userId) ||
          m.senderId === (user as any)?.userId
        );
        if (!isMsgFromMe) {
          const msgTime = extractTimestampMs(m.timestampMs || m.timestamp || m.createdAt);
          if (msgTime > 0) {
            candidate = Math.max(candidate, msgTime);
            break;
          }
        }
      }
    }
    return candidate;
  }, [targetProfile, messages, profile?.id, user?.uid, profile?.userId]);

  // Accurate online status resolution (never false positive)
  const isOnline = useMemo(() => {
    const isOnlineSettingOn = targetProfile?.messagingSettings?.onlineStatus !== false && 
                              (targetProfile?.privacySettings as any)?.showOnlineStatus !== false && 
                              profile?.messagingSettings?.onlineStatus !== false;
    if (!isOnlineSettingOn) return false;

    // Filter candidate IDs for the other participant
    const candidateIds = [
      targetUserId,
      targetProfile?.id,
      targetProfile?.uid,
      targetProfile?.userId,
      targetProfile?.firebaseUid,
    ].filter(id => Boolean(id) && id !== profile?.id && id !== user?.uid && id !== (user as any)?.userId) as string[];

    // 1. Live socket presence from Redis/Socket.IO
    const matchInOnlineSet = candidateIds.some(id => onlineUsers?.has(id));
    if (matchInOnlineSet) return true;

    // 2. Verified active heartbeat within the last 60 seconds (strictly > 0)
    if (accurateLastSeenMs > 0 && (Date.now() - accurateLastSeenMs < 60000)) {
      return true;
    }

    return false;
  }, [targetUserId, targetProfile, onlineUsers, accurateLastSeenMs, profile?.id, user?.uid, profile?.messagingSettings?.onlineStatus]);

  // Derive per-chat wallpaper, conversation shared wallpaper, global chat wallpaper, or appearance wallpaper
  const currentChatTheme = useMemo<ChatWallpaperConfig | undefined>(() => {
    // 1. Check user profile per-chat wallpaper override
    const profileChatTheme = 
      profile?.themeSettings?.perChatWallpapers?.[chatId] || 
      (participantId ? profile?.themeSettings?.perChatWallpapers?.[participantId] : undefined);
    if (profileChatTheme && (profileChatTheme.wallpaperURL || profileChatTheme.themeId)) {
      return profileChatTheme;
    }

    // 2. Initial props passed from chat head
    if (initialThemeSettings && (initialThemeSettings.wallpaperURL || initialThemeSettings.themeId || initialThemeSettings.bubbleGradient)) {
      return initialThemeSettings;
    }

    // 3. Conversation shared themeSettings from state
    const convTheme = conversationData?.themeSettings || conversationData;
    if (convTheme && (convTheme.wallpaperURL || convTheme.themeId || convTheme.bubbleGradient)) {
      return convTheme;
    }

    // 4. Cached settings in localStorage
    try {
      const stored = 
        localStorage.getItem(`chat_settings_${chatId}`) || 
        (participantId ? localStorage.getItem(`chat_settings_${participantId}`) : null) ||
        localStorage.getItem(`chat_theme_${chatId}`) ||
        (participantId ? localStorage.getItem(`chat_theme_${participantId}`) : null);
      if (stored) {
        const parsed = JSON.parse(stored);
        const resolved = parsed?.themeSettings || parsed;
        if (resolved && (resolved.wallpaperURL || resolved.themeId || resolved.bubbleGradient)) {
          return resolved;
        }
      }
    } catch {}

    // 5. Global chat wallpaper fallback
    return profile?.themeSettings?.chatWallpaper || (settings?.globalBgValue ? { wallpaperURL: settings.globalBgValue } : undefined);
  }, [profile?.themeSettings, chatId, participantId, initialThemeSettings, conversationData, settings?.globalBgValue]);

  const globalChatTheme = useMemo<ChatWallpaperConfig | undefined>(() => {
    return (
      profile?.themeSettings?.chatWallpaper || 
      (settings?.globalBgValue ? { wallpaperURL: settings.globalBgValue } : undefined)
    );
  }, [profile?.themeSettings?.chatWallpaper, settings?.globalBgValue]);

  const bubbleGradient = useMemo(() => {
    if (currentChatTheme?.bubbleGradient) return currentChatTheme.bubbleGradient;
    if (currentChatTheme?.themeId) {
      const match = MESSENGER_THEMES.find(t => t.id === currentChatTheme.themeId);
      if (match?.bubbleGradient) return match.bubbleGradient;
    }
    // Default to Midnight Slate (matching user's screenshot)
    return 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
  }, [currentChatTheme]);

  // Subscribe to real-time messages for this conversation
  useEffect(() => {
    if (!chatId) return;

    try {
      const unsub = messagingService.subscribeToMessages(
        db,
        chatId,
        profile?.id || '',
        null,
        (incoming) => {
          setMessages(incoming || []);
        },
        50
      );

      return () => {
        if (typeof unsub === 'function') {
          unsub();
        }
      };
    } catch (err) {
      logger.warn('[DockedChatWindow] Subscription error:', err);
    }
  }, [db, chatId, profile?.id]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Send text message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || !user || !profile || isSending) return;

    setIsSending(true);
    setInputText('');
    setShowEmojiBar(false);

    try {
      await messagingService.sendMessage(
        db,
        profile,
        user,
        chatId,
        textToSend,
        'text'
      );
    } catch (err: any) {
      logger.error('[DockedChatWindow] Failed to send message:', err);
      addToast?.({
        title: 'Message Not Sent',
        message: err?.message || 'Could not send message. Please retry.',
        type: 'warning'
      });
      setInputText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  // ── Voice Recording Engine for Docked Chat Head ──
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startVoiceRecording = async () => {
    if (isRecordingVoice || isSendingVoice) return;
    try {
      const micRes = await PermissionService.requestMicrophoneStream();
      if (!micRes.granted || !micRes.stream) {
        addToast?.({
          title: 'Microphone Required',
          message: micRes.error || 'Please allow microphone access to record voice messages.',
          type: 'warning'
        });
        return;
      }

      const stream = micRes.stream;
      audioStreamRef.current = stream;

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
        else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac';
        else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) mimeType = 'audio/ogg;codecs=opus';
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);
      setIsRecordingVoice(true);
      setRecordingDuration(0);
      triggerNativeHaptic('selection');

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (err: any) {
      logger.error('[DockedChatWindow] Error starting voice recording:', err);
      addToast?.({
        title: 'Recording Failed',
        message: 'Could not access microphone.',
        type: 'warning'
      });
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    setIsRecordingVoice(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
    triggerNativeHaptic('impact');
  };

  const stopAndSendVoiceRecording = async () => {
    if (!isRecordingVoice || isSendingVoice) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      cancelVoiceRecording();
      return;
    }

    setIsSendingVoice(true);

    const finalizeAndSend = async () => {
      try {
        const actualMime = recorder.mimeType || 'audio/webm';
        const ext = actualMime.includes('mp4') || actualMime.includes('aac') ? 'm4a' : 'webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMime });

        if (blob.size === 0 || recordingDuration < 1) {
          addToast?.({
            title: 'Voice Empty',
            message: 'Audio was too short or empty. Please try recording again.',
            type: 'warning'
          });
          return;
        }

        let file: File;
        try {
          file = new File([blob], `voice_${Date.now()}.${ext}`, { type: actualMime });
        } catch {
          file = Object.assign(blob, {
            name: `voice_${Date.now()}.${ext}`,
            lastModified: Date.now()
          }) as any;
        }

        if (!uploadMedia) throw new Error('Upload service unavailable');
        const downloadUrl = await uploadMedia(file, `chat_media/${chatId}`);
        if (!downloadUrl) throw new Error('Failed to upload voice note');

        await messagingService.sendMessage(
          db,
          profile,
          user,
          chatId,
          'Voice note',
          'voice',
          downloadUrl,
          {
            duration: Math.max(1, recordingDuration),
            fileName: file.name,
            mediaType: 'voice'
          }
        );
        triggerNativeHaptic('success');
      } catch (err: any) {
        logger.error('[DockedChatWindow] Failed to send voice note:', err);
        addToast?.({
          title: 'Send Failed',
          message: err?.message || 'Could not send voice note.',
          type: 'warning'
        });
      } finally {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(t => t.stop());
          audioStreamRef.current = null;
        }
        setIsRecordingVoice(false);
        setIsSendingVoice(false);
        setRecordingDuration(0);
        audioChunksRef.current = [];
      }
    };

    if (recorder.state !== 'inactive') {
      recorder.onstop = () => {
        finalizeAndSend();
      };
      try {
        recorder.stop();
      } catch {
        finalizeAndSend();
      }
    } else {
      finalizeAndSend();
    }
  };

  // Quick Thumbs Up (Facebook style)
  const handleQuickLike = async () => {
    if (!user || !profile || isSending) return;
    setIsSending(true);
    try {
      await messagingService.sendMessage(
        db,
        profile,
        user,
        chatId,
        '👍',
        'text'
      );
    } catch (err: any) {
      logger.error('[DockedChatWindow] Like send error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Quick Emoji Click
  const handleAddEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  // Send photo attachment
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile || !uploadMedia) return;

    setIsUploading(true);
    try {
      const downloadUrl = await uploadMedia(file, `chat_media/${chatId}`);
      if (downloadUrl) {
        await messagingService.sendMessage(
          db,
          profile,
          user,
          chatId,
          '',
          'image',
          downloadUrl
        );
      }
    } catch (err: any) {
      logger.error('[DockedChatWindow] Media upload error:', err);
      addToast?.({
        title: 'Upload Failed',
        message: 'Could not upload image attachment.',
        type: 'warning'
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Audio / Video call handlers
  const handleStartAudioCall = async () => {
    if (!startCall) return;
    try {
      await startCall(chatId, 'audio');
    } catch (err) {
      logger.error('[DockedChatWindow] Audio call error:', err);
    }
  };

  const handleStartVideoCall = async () => {
    if (!startCall) return;
    try {
      await startCall(chatId, 'video');
    } catch (err) {
      logger.error('[DockedChatWindow] Video call error:', err);
    }
  };

  return (
    <div className="w-[calc(100vw-20px)] max-w-[360px] sm:w-[360px] h-[72vh] max-h-[560px] sm:h-[530px] rounded-2xl sm:rounded-t-2xl sm:rounded-b-none shadow-[0_10px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden relative border border-white/20 bg-neutral-950 animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* ── Dynamic Theme & Wallpaper Layer (Messenger-style matching Picture 2) ── */}
      <ChatWallpaperLayer 
        chatThemeSettings={currentChatTheme}
        globalThemeSettings={globalChatTheme}
      />

      {/* ── Top Header Bar (Matching Picture 2 with Active Now) ── */}
      <div className="h-14 px-3.5 border-b border-white/10 bg-black/60 backdrop-blur-2xl flex items-center justify-between shrink-0 select-none z-10">
        {/* User info */}
        <div 
          onClick={onMaximize}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
          title="Open in full Messenger"
        >
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-neutral-900 border border-white/15 group-hover:border-aeirmist-cyan/60 transition-colors">
              <img 
                src={avatar} 
                alt={chatName} 
                className="w-full h-full object-cover"
                onError={(e) => { 
                  (e.target as HTMLImageElement).src = getAvatarUrl(null, chatName || targetProfile?.displayName || targetUserId); 
                }}
              />
            </div>
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-aeirmist-lime border-2 border-[#0e1019] shadow-[0_0_8px_rgba(191,255,0,0.6)]" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate group-hover:text-aeirmist-cyan transition-colors">
              {chatName}
            </h4>
            <div className="mt-0.5 truncate">
              {isOnline ? (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-aeirmist-lime animate-pulse shrink-0 inline-block" />
                  <span className="text-[8px] uppercase tracking-widest font-bold text-aeirmist-lime leading-none">
                    Active now
                  </span>
                </div>
              ) : (
                <span className="text-[8px] uppercase tracking-widest font-bold text-white/40 leading-none">
                  {formatActiveStatus(false, accurateLastSeenMs, false)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0 text-white/60">
          <button
            type="button"
            onClick={() => setIsWallpaperCustomizerOpen(true)}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center hover:text-white transition-all cursor-pointer"
            title="Theme & Wallpaper"
          >
            <Palette size={14} />
          </button>
          <button
            type="button"
            onClick={handleStartAudioCall}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center hover:text-white transition-all cursor-pointer"
            title="Audio call"
          >
            <Phone size={14} />
          </button>
          <button
            type="button"
            onClick={handleStartVideoCall}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center hover:text-white transition-all cursor-pointer"
            title="Video call"
          >
            <Video size={14} />
          </button>
          <button
            type="button"
            onClick={onMaximize}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center hover:text-white transition-all cursor-pointer"
            title="Open full conversation"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            onClick={onMinimize}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center hover:text-white transition-all cursor-pointer"
            title="Minimize to side head"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-rose-500/30 hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer"
            title="Close chat"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Message History Stream (Matching Picture 2 with Wallpaper & Theme Bubbles) ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-transparent no-scrollbar relative z-10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-white/30 space-y-2 select-none">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)]">
              <MessageSquare size={22} />
            </div>
            <p className="text-xs font-semibold text-white/60">Start a conversation</p>
            <p className="text-[10px] text-white/40">Say hello to {chatName}! 👋</p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const myIds = new Set([
              profile?.id,
              user?.uid,
              user?.id,
              (profile as any)?.userId,
              (user as any)?.userId,
              profile?.username
            ].filter(Boolean).map(id => String(id).toLowerCase()));

            const senderCandidates = [
              m.senderId,
              m.senderUid,
              m.metadata?.senderId,
              m.metadata?.senderUid,
              (m as any).senderDbId,
              (m as any).senderProfileId,
              (m as any).sender?.id,
              (m as any).sender?.firebaseUid,
              (m as any).sender?.profileId,
              (m as any).sender?.username
            ].filter(Boolean).map(s => String(s).toLowerCase());

            const isMe = senderCandidates.some(cand => myIds.has(cand));

            // Date separator check (e.g., YESTERDAY, TODAY, etc.)
            const currentMsgDate = formatDateSeparator(m.timestampMs || m.timestamp);
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const prevMsgDate = prevMsg ? formatDateSeparator(prevMsg.timestampMs || prevMsg.timestamp) : '';
            const showDate = Boolean(currentMsgDate && currentMsgDate !== prevMsgDate);

            // Render native Call History Card
            const isCallHistory = m.type === 'call_history' || m.metadata?.type === 'call_history' || /^(?:Audio|Voice|Video)\s+call/i.test(m.text || '');
            if (isCallHistory) {
              const callType: 'audio' | 'video' = m.metadata?.callType || (m as any).callDetails?.type || (m.text?.toLowerCase().includes('video') ? 'video' : 'audio');
              const status = m.metadata?.status || (m as any).callDetails?.status || (m.text?.toLowerCase().includes('missed') ? 'missed' : m.text?.toLowerCase().includes('declined') ? 'rejected' : 'ended');
              const isMissed = status === 'missed';
              const isDeclined = status === 'rejected' || status === 'busy';
              const isVideo = callType === 'video';

              let durationSecs = m.duration || m.metadata?.duration || (m as any).callDetails?.duration || 0;
              let durationStr = '';
              if (durationSecs > 0) {
                const mm = Math.floor(durationSecs / 60);
                const ss = durationSecs % 60;
                durationStr = `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
              } else if (m.text) {
                const match = m.text.match(/\((\d{1,2}:\d{2})\)/);
                if (match) durationStr = match[1];
              }

              const title = isVideo ? 'Video Call' : 'Voice Call';
              let subtitle = '';
              if (isMissed) {
                subtitle = isMe ? 'Cancelled call' : 'Missed call';
              } else if (isDeclined) {
                subtitle = 'Call declined';
              } else if (durationStr) {
                subtitle = `${isMe ? 'Outgoing' : 'Incoming'} • ${durationStr}`;
              } else {
                subtitle = isMe ? 'Outgoing call' : 'Incoming call';
              }

              const isFailureState = isMissed || isDeclined;
              const timeDisplay = formatTimeOnly(m.timestampMs || m.timestamp) || (m.timestampMs ? new Date(m.timestampMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '');

              return (
                <React.Fragment key={m.id}>
                  {showDate && (
                    <div className="flex items-center gap-3 my-4 px-2 select-none">
                      <div className="flex-1 h-px bg-white/10" />
                      <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/70 shadow-lg">
                        {currentMsgDate}
                      </div>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                  )}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-1.5 select-none w-full`}>
                    <div
                      onClick={() => {
                        if (isVideo) handleStartVideoCall();
                        else handleStartAudioCall();
                      }}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[18px] cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border backdrop-blur-xl shadow-lg max-w-[270px] sm:max-w-[290px] group ${
                        isMe
                          ? 'bg-[#12131a]/85 border-white/15 text-white hover:border-white/25'
                          : 'bg-[#0f1015]/85 border-white/10 text-white hover:border-white/20'
                      }`}
                      title="Tap to call back"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                        isFailureState
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                          : 'bg-aeirmist-cyan/15 border-aeirmist-cyan/30 text-aeirmist-cyan'
                      }`}>
                        {isVideo ? <Video size={17} /> : isMissed ? <PhoneMissed size={17} /> : isMe ? <PhoneOutgoing size={17} /> : <PhoneIncoming size={17} />}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-bold tracking-tight text-white/90 truncate">{title}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[10px] font-medium tracking-tight ${isFailureState ? 'text-rose-400' : 'text-white/60'}`}>{subtitle}</span>
                          {timeDisplay && (
                            <>
                              <span className="text-[9px] text-white/30">•</span>
                              <span className="text-[9px] text-white/40 font-mono">{timeDisplay}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-aeirmist-cyan group-hover:bg-aeirmist-cyan/10 transition-all shrink-0">
                        {isVideo ? <Video size={14} /> : <Phone size={14} />}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            }

            const isVoice = m.type === 'voice' || m.metadata?.mediaType === 'voice' || Boolean(m.mediaUrl && (m.mediaUrl.includes('.webm') || m.mediaUrl.includes('.ogg') || m.mediaUrl.includes('.wav') || m.mediaUrl.includes('.m4a') || m.metadata?.fileType?.startsWith('audio/') || (m.text === 'Voice note' && m.mediaUrl)));
            const isMediaPlaceholder = Boolean(m.text && /^(sent an? (image|photo|video|media|file|voice)|sending(\s+[a-z]+|\.\.\.)?|voice note)$/i.test(m.text.trim()));

            return (
              <React.Fragment key={m.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-4 px-2 select-none">
                    <div className="flex-1 h-px bg-white/10" />
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/70 shadow-lg">
                      {currentMsgDate}
                    </div>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                )}
                <div className={`flex items-end gap-1.5 my-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <img
                      src={getAvatarUrl((m as any).senderAvatar || chatPhoto, (m as any).senderName || chatName)}
                      alt=""
                      className="w-7 h-7 rounded-xl object-cover shrink-0 mb-0.5 border border-white/15 bg-white/5"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  )}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    {isVoice && m.mediaUrl ? (
                      <div
                        style={isMe && bubbleGradient ? { background: bubbleGradient } : undefined}
                        className={`px-3 py-2 text-[13px] shadow-md transition-all min-w-[210px] ${
                          isMe
                            ? 'text-white rounded-2xl rounded-br-sm border border-white/10'
                            : 'bg-black/50 backdrop-blur-xl text-white rounded-2xl rounded-bl-sm border border-white/10'
                        }`}
                      >
                        <VoicePlayback url={m.mediaUrl} isMe={isMe} />
                        <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 select-none ${isMe ? 'text-white/70' : 'text-white/50'}`}>
                          <span className="font-mono">{formatTimeOnly(m.timestampMs || m.timestamp)}</span>
                          {isMe && (
                            <span className="flex items-center ml-0.5">
                              {m.isSeen ? (
                                <CheckCheck size={12} className="text-aeirmist-cyan" />
                              ) : m.isDelivered ? (
                                <CheckCheck size={12} className="text-white/60" />
                              ) : (
                                <Check size={12} className="text-white/30" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {m.mediaUrl && (
                          <div className="rounded-2xl overflow-hidden mb-1 border border-white/15 max-w-[240px] shadow-md">
                            {m.mediaUrl.includes('.mp4') || m.type === 'video' ? (
                              <video src={m.mediaUrl} controls className="w-full h-auto object-cover max-h-[190px]" />
                            ) : (
                              <img src={m.mediaUrl} alt="" className="w-full h-auto object-cover max-h-[190px]" />
                            )}
                          </div>
                        )}
                        {m.text && !isMediaPlaceholder && (
                          <div
                            style={isMe && bubbleGradient ? { background: bubbleGradient } : undefined}
                            className={`px-3.5 py-2 text-[13px] leading-relaxed break-words shadow-md transition-all ${
                              isMe
                                ? 'text-white font-normal rounded-2xl rounded-br-sm border border-white/10'
                                : 'bg-black/50 backdrop-blur-xl text-white rounded-2xl rounded-bl-sm border border-white/10'
                            }`}
                          >
                            <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
                              <span className="font-normal">{m.text}</span>
                              <div className={`flex items-center gap-1 text-[10px] ml-auto shrink-0 select-none ${isMe ? 'text-white/70' : 'text-white/50'}`}>
                                <span className="font-mono">{formatTimeOnly(m.timestampMs || m.timestamp)}</span>
                                {isMe && (
                                  <span className="flex items-center ml-0.5">
                                    {m.isSeen ? (
                                      <CheckCheck size={12} className="text-aeirmist-cyan" />
                                    ) : m.isDelivered ? (
                                      <CheckCheck size={12} className="text-white/60" />
                                    ) : (
                                      <Check size={12} className="text-white/30" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Emoji Reaction Bar ── */}
      {showEmojiBar && (
        <div className="px-3 py-1.5 bg-[#121422]/95 border-t border-white/10 backdrop-blur-xl flex items-center justify-between gap-1 overflow-x-auto no-scrollbar z-20">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddEmoji(emoji)}
              className="text-base p-1 hover:scale-125 transition-transform active:scale-95 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowEmojiBar(false)}
            className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white cursor-pointer"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* ── Messenger-Style Cyber Pill Typing Bar (Exact match with Picture 2) ── */}
      <div className="p-2.5 bg-black/60 backdrop-blur-2xl border-t border-white/10 z-20">
        {isRecordingVoice ? (
          <div className="flex items-center justify-between gap-2 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1.5 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-[12px] font-mono font-bold text-red-400 shrink-0">
                {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
              </span>
              <span className="text-[11px] text-white/50 truncate">Recording voice note...</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={cancelVoiceRecording}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                title="Discard recording"
              >
                <Trash2 size={13} />
              </button>
              <button
                type="button"
                onClick={stopAndSendVoiceRecording}
                disabled={isSendingVoice}
                className="w-8 h-8 rounded-full bg-aeirmist-cyan text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_12px_rgba(0,242,255,0.45)] cursor-pointer"
                title="Send voice note"
              >
                {isSendingVoice ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        ) : (
          <form 
            onSubmit={handleSend}
            className="flex items-center gap-1.5 bg-[#111318]/90 backdrop-blur-2xl border border-white/10 rounded-full px-2.5 py-1 shadow-[0_4px_20px_rgba(0,0,0,0.4)] focus-within:border-white/20 transition-all"
          >
            {/* Hidden image file input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileSelect} 
            />

            {/* Quick Emoji Bar Toggle */}
            <button
              type="button"
              onClick={() => setShowEmojiBar(prev => !prev)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                showEmojiBar ? 'text-aeirmist-cyan bg-aeirmist-cyan/15' : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
              title="Emoji reactions"
            >
              <Smile size={19} strokeWidth={1.6} />
            </button>

            {/* Plus Media Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all shrink-0 cursor-pointer"
              title="Attach photo"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin text-aeirmist-cyan" /> : <Plus size={19} strokeWidth={1.8} />}
            </button>

            {/* Input field */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              autoComplete="off"
              spellCheck={false}
              className="flex-1 min-w-0 bg-transparent border-none py-1.5 px-2 outline-none text-[13.5px] text-white placeholder-white/40 font-normal leading-normal"
            />

            {/* Right Buttons: Send if typed, Mic & ThumbsUp if empty */}
            {inputText.trim().length > 0 ? (
              <button
                type="submit"
                disabled={isSending}
                className="w-8 h-8 rounded-full bg-aeirmist-cyan text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0 shadow-[0_0_12px_rgba(0,242,255,0.45)] cursor-pointer"
                title="Send"
              >
                {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            ) : (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  disabled={isSending}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-aeirmist-cyan hover:bg-aeirmist-cyan/10 transition-all cursor-pointer"
                  title="Record voice note"
                >
                  <Mic size={19} strokeWidth={1.6} />
                </button>
                <button
                  type="button"
                  onClick={handleQuickLike}
                  disabled={isSending}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  title="Quick like"
                >
                  <ThumbsUp size={15} strokeWidth={1.6} />
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {/* ── Messenger Wallpaper & Theme Controller Modal ── */}
      {isWallpaperCustomizerOpen && (
        <ChatWallpaperController
          chatId={chatId}
          chatThemeSettings={currentChatTheme}
          onClose={() => setIsWallpaperCustomizerOpen(false)}
          onSave={(newConfig) => {
            setConversationData(newConfig);
            try {
              localStorage.setItem(`chat_settings_${chatId}`, JSON.stringify(newConfig));
              localStorage.setItem(`chat_theme_${chatId}`, JSON.stringify(newConfig));
            } catch {}
          }}
        />
      )}
    </div>
  );
};
