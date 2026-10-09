import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Phone, 
  Video, 
  Minus, 
  X, 
  Maximize2, 
  Image as ImageIcon, 
  Send, 
  ThumbsUp, 
  Loader2, 
  MessageSquare,
  Smile,
  Sparkles,
  Palette,
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
import { formatActiveStatus, extractTimestampMs, formatTimeOnly } from '../../lib/date';
import { ChatWallpaperLayer, type ChatWallpaperConfig } from './ChatWallpaperLayer';
import { ChatWallpaperController, MESSENGER_THEMES } from './ChatWallpaperController';

interface DockedChatWindowProps {
  chatId: string;
  chatName: string;
  chatPhoto?: string;
  participantId?: string;
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
  const [conversationData, setConversationData] = useState<any>(null);
  const [isWallpaperCustomizerOpen, setIsWallpaperCustomizerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load conversation settings
  useEffect(() => {
    if (!chatId) return;
    try {
      const stored = localStorage.getItem(`chat_settings_${chatId}`);
      if (stored) {
        setConversationData(JSON.parse(stored));
      }
    } catch {}
  }, [chatId]);

  const avatar = getAvatarUrl(chatPhoto || targetProfile?.photoURL, chatName || targetProfile?.displayName || targetUserId);
  const lastSeenMs = extractTimestampMs(targetProfile?.lastSeen) || extractTimestampMs(targetProfile?.lastActiveAt) || extractTimestampMs(targetProfile?.updatedAt);
  const isRecentHeartbeat = lastSeenMs > 0 ? (Date.now() - lastSeenMs < 120000) : true;
  const isOnline = !!(
    (targetUserId && onlineUsers?.has(targetUserId)) ||
    (targetProfile?.uid && onlineUsers?.has(targetProfile.uid)) ||
    (targetProfile?.id && onlineUsers?.has(targetProfile.id)) ||
    (targetProfile?.status === 'online' && isRecentHeartbeat) ||
    onlineUsers?.has(chatId)
  ) && targetProfile?.messagingSettings?.onlineStatus !== false && profile?.messagingSettings?.onlineStatus !== false;

  // Derive per-chat wallpaper, conversation shared wallpaper, global chat wallpaper, or appearance wallpaper
  const currentChatTheme = useMemo<ChatWallpaperConfig | undefined>(() => {
    return (
      profile?.themeSettings?.perChatWallpapers?.[chatId] || 
      conversationData?.themeSettings ||
      (conversationData?.theme ? { themeId: conversationData.theme } : undefined)
    );
  }, [profile?.themeSettings?.perChatWallpapers, chatId, conversationData?.themeSettings, conversationData?.theme]);

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
    return undefined;
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
    <div className="w-[330px] sm:w-[350px] h-[480px] sm:h-[500px] bg-[#0c0d14] border border-white/10 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* ── Dynamic Theme & Wallpaper Layer (Messenger-style) ── */}
      <ChatWallpaperLayer 
        chatThemeSettings={currentChatTheme}
        globalThemeSettings={globalChatTheme}
      />
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-12 -left-12 w-44 h-44 bg-aeirmist-cyan/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -right-12 w-44 h-44 bg-aeirmist-magenta/10 rounded-full blur-3xl" />
      </div>

      {/* ── Top Header Bar ── */}
      <div className="h-14 px-3.5 border-b border-white/10 bg-[#0e1019]/95 backdrop-blur-2xl flex items-center justify-between shrink-0 select-none z-10">
        {/* User info */}
        <div 
          onClick={onMaximize}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
          title="Open in full Messenger"
        >
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 group-hover:border-aeirmist-cyan/60 transition-colors">
              <img 
                src={avatar} 
                alt={chatName} 
                className="w-full h-full object-cover"
                onError={(e) => { 
                  (e.target as HTMLImageElement).src = getAvatarUrl(null, chatName || targetProfile?.displayName || targetUserId); 
                }}
              />
              <div className="w-full h-full flex items-center justify-center text-aeirmist-cyan">
                <MessageSquare size={16} />
              </div>
            </div>
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0e1019] shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate group-hover:text-aeirmist-cyan transition-colors">
              {chatName}
            </h4>
            <p className="text-[10px] text-white/50 leading-none mt-0.5 truncate flex items-center gap-1">
              {isOnline ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-emerald-500/30 shrink-0 animate-pulse" />
                  <span className="text-emerald-400 font-medium">Active now</span>
                </>
              ) : (
                <span>{formatActiveStatus(false, lastSeenMs || targetProfile?.lastSeen, false)}</span>
              )}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 shrink-0 text-white/60">
          <button
            type="button"
            onClick={() => setIsWallpaperCustomizerOpen(true)}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center hover:text-aeirmist-cyan transition-all"
            title="Theme & Wallpaper"
          >
            <Palette size={14} />
          </button>
          <button
            type="button"
            onClick={handleStartAudioCall}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center hover:text-aeirmist-cyan transition-all"
            title="Audio call"
          >
            <Phone size={15} />
          </button>
          <button
            type="button"
            onClick={handleStartVideoCall}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center hover:text-aeirmist-cyan transition-all"
            title="Video call"
          >
            <Video size={15} />
          </button>
          <button
            type="button"
            onClick={onMaximize}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center hover:text-white transition-all"
            title="Open full conversation"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            onClick={onMinimize}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center hover:text-white transition-all"
            title="Minimize to side head"
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center transition-all"
            title="Close chat"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Message History Stream ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-transparent no-scrollbar relative z-10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-white/30 space-y-2 select-none">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)]">
              <MessageSquare size={22} />
            </div>
            <p className="text-xs font-semibold text-white/60">Start a conversation</p>
            <p className="text-[10px] text-white/40">Say hello to {chatName}! 👋</p>
          </div>
        ) : (
          messages.map((m) => {
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

            // Render native app-wise Call History Card (audio/video call logs)
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
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-1.5 select-none w-full`}>
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
                    {/* Status Indicator Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                      isFailureState
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                        : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    }`}>
                      {isVideo ? (
                        <Video size={17} />
                      ) : isMissed ? (
                        <PhoneMissed size={17} />
                      ) : isMe ? (
                        <PhoneOutgoing size={17} />
                      ) : (
                        <PhoneIncoming size={17} />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-bold tracking-tight text-white/90 truncate">
                        {title}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[10px] font-medium tracking-tight ${
                          isFailureState ? 'text-rose-400' : 'text-white/60'
                        }`}>
                          {subtitle}
                        </span>
                        {timeDisplay && (
                          <>
                            <span className="text-[9px] text-white/30">•</span>
                            <span className="text-[9px] text-white/40 font-mono">
                              {timeDisplay}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Call Back Button */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isVideo) handleStartVideoCall();
                        else handleStartAudioCall();
                      }}
                      className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition-all shrink-0 cursor-pointer"
                      title={`Call back (${isVideo ? 'Video' : 'Voice'})`}
                    >
                      {isVideo ? <Video size={14} /> : <Phone size={14} />}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={m.id} 
                className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <img
                    src={getAvatarUrl((m as any).senderAvatar || chatPhoto, (m as any).senderName || m.senderId || chatName || targetUserId)}
                    alt=""
                    className="w-6 h-6 rounded-lg object-cover shrink-0 mb-0.5 border border-white/10"
                    onError={(e) => { 
                      (e.target as HTMLImageElement).src = getAvatarUrl(null, (m as any).senderName || m.senderId || chatName || targetUserId); 
                    }}
                  />
                )}
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  {/* Photo attachment if image */}
                  {m.mediaUrl && (
                    <div className="rounded-xl overflow-hidden mb-1 border border-white/15 max-w-[220px] shadow-md">
                      <img 
                        src={m.mediaUrl} 
                        alt="attachment" 
                        className="w-full h-auto object-cover max-h-[190px]" 
                      />
                    </div>
                  )}
                  {/* Text bubble */}
                  {m.text && (
                    <div
                      style={isMe && bubbleGradient ? { background: bubbleGradient } : undefined}
                      className={`px-3.5 py-2 text-[12px] leading-relaxed break-words ${
                        isMe
                          ? `${bubbleGradient ? 'text-white' : 'bg-gradient-to-r from-aeirmist-cyan to-blue-500 text-black'} font-semibold rounded-2xl rounded-br-sm shadow-[0_4px_15px_rgba(0,242,255,0.25)]`
                          : 'bg-white/[0.12] backdrop-blur-md text-white rounded-2xl rounded-bl-sm border border-white/10 shadow-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                  )}
                  {/* Timestamp */}
                  <span className="text-[8px] text-white/30 font-mono mt-0.5 px-1">
                    {m.timestamp || (m.timestampMs ? new Date(m.timestampMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Emoji Reaction Bar (Messenger Style) ── */}
      {showEmojiBar && (
        <div className="px-3 py-1.5 bg-[#121422]/95 border-t border-white/10 backdrop-blur-xl flex items-center justify-between gap-1 overflow-x-auto no-scrollbar z-20">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddEmoji(emoji)}
              className="text-base p-1 hover:scale-125 transition-transform active:scale-95"
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowEmojiBar(false)}
            className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* ── Messenger-Style Cyber Pill Typing Bar ── */}
      <div className="p-2.5 border-t border-white/10 bg-[#0e1019]/95 backdrop-blur-2xl z-20">
        <form 
          onSubmit={handleSend}
          className="flex items-center gap-1.5 bg-white/[0.05] border border-white/10 rounded-[24px] px-2 py-1 focus-within:border-aeirmist-cyan/50 focus-within:bg-white/[0.08] transition-all"
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
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
              showEmojiBar ? 'text-aeirmist-cyan bg-aeirmist-cyan/15' : 'text-white/40 hover:text-aeirmist-cyan hover:bg-white/5'
            }`}
            title="Emoji reactions"
          >
            <Smile size={17} />
          </button>

          {/* Image Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-aeirmist-cyan hover:bg-white/5 transition-all shrink-0"
            title="Attach photo"
          >
            {isUploading ? <Loader2 size={15} className="animate-spin text-aeirmist-cyan" /> : <ImageIcon size={17} />}
          </button>

          {/* Input field */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            autoComplete="off"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent border-none py-1 px-2 outline-none text-xs text-white placeholder-white/35 font-normal leading-normal"
          />

          {/* Send / Like button (Messenger style: ThumbsUp with cyan glow when empty, Send arrow when typed) */}
          {inputText.trim().length > 0 ? (
            <button
              type="submit"
              disabled={isSending}
              className="w-8 h-8 rounded-full bg-aeirmist-cyan text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0 shadow-[0_0_12px_rgba(0,242,255,0.45)] cursor-pointer"
              title="Send"
            >
              {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleQuickLike}
              disabled={isSending}
              className="w-8 h-8 rounded-full hover:bg-white/10 text-aeirmist-cyan flex items-center justify-center hover:scale-110 active:scale-95 transition-all shrink-0 cursor-pointer"
              title="Send 👍"
            >
              <ThumbsUp size={16} />
            </button>
          )}
        </form>
      </div>

      {/* ── Messenger Wallpaper & Theme Controller Modal ── */}
      {isWallpaperCustomizerOpen && (
        <ChatWallpaperController
          chatId={chatId}
          chatThemeSettings={currentChatTheme}
          onClose={() => setIsWallpaperCustomizerOpen(false)}
          onSave={(newConfig) => {
            setConversationData((prev: any) => ({
              ...prev,
              themeSettings: newConfig
            }));
          }}
        />
      )}
    </div>
  );
};
