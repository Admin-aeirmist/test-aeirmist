import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, Video as VideoIcon, X, Mic, MicOff, VideoOff, PhoneOff, 
  Check, RefreshCw, Volume2, VolumeX, ShieldCheck, ChevronDown,
  Sparkles, Wand2, Palette, Users, UserPlus, Image, Search, Share2,
  Maximize2, Hand, LayoutGrid, MoreHorizontal, Smile, Monitor
} from 'lucide-react';
import { useAeirmist } from '../context/AeirmistContext';
import { getAvatarUrl } from '../lib/avatar';
import { aeirmistRingtone } from '../modules/calls/RingtoneService';
import { aeirmistCall } from '../modules/calls/CallService';
import { ensureCallPermissions } from '../modules/calls/CallPermissions';
import { LiveParticipantName } from './Messenger';
import { logger } from '@/src/utils/logger';

interface CallModalProps {
  chat?: {
    id: string;
    name: string;
    photo: string;
    participants?: string[];
    otherParticipantUid?: string;
  };
  type: 'audio' | 'video';
  onClose: () => void;
  isIncoming?: boolean;
}

export const CallModal: React.FC<CallModalProps> = ({ chat, type, onClose, isIncoming = false }) => {
  const { 
    activeCall, startCall, acceptCall, rejectCall, endCall, 
    profile, user, callStream, setCallStream, remoteStream, _requestPermission, db, allProfiles
  } = useAeirmist();
  
  // Determine if incoming call
  const isIncomingCall = activeCall 
    ? (activeCall.callerId !== profile?.id && activeCall.callerUid !== user?.uid)
    : isIncoming;

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'audio');
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'error'>('ringing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);

  // Local camera effects state
  const [isSparklesOn, setIsSparklesOn] = useState(false);
  const [isRetouchOn, setIsRetouchOn] = useState(false);
  const [filterIndex, setFilterIndex] = useState(0);
  const filtersList = ['none', 'cyberpunk', 'warm', 'mono', 'vintage'];

  // Desktop extra controls
  const [handRaised, setHandRaised] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [gridLayout, setGridLayout] = useState<'grid' | 'speaker'>('grid');

  // Drawers state
  const [isAddPeopleOpen, setIsAddPeopleOpen] = useState(false);
  const [isMediaShareOpen, setIsMediaShareOpen] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<Record<string, boolean>>({});
  const [sharedMediaToast, setSharedMediaToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitiatedCall = useRef(false);
  const isAcceptingRef = useRef(false);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Decoupled track availability helpers
  const hasRemoteVideo = Boolean(remoteStream && remoteStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live'));
  const hasLocalVideo = Boolean(callStream && callStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')) && !isVideoOff;
  const hasRemoteVideoTrack = hasRemoteVideo;
  const hasLocalVideoTrack = hasLocalVideo;
  const isVideoLayout = type === 'video' || hasRemoteVideo || hasLocalVideo;

  // Dedicated Video Element Refs ensuring NO reset loops & strictly video-only playback
  const setLocalVideoNode = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el) {
      el.muted = true;
      if (callStream && el.srcObject !== callStream) {
        el.srcObject = callStream;
      }
      if (callStream && el.paused) {
        el.play().catch(() => {});
      }
    }
  }, [callStream]);

  const setRemoteVideoNode = useCallback((el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el) {
      el.muted = true;
      if (remoteStream && remoteStream.getVideoTracks().length > 0) {
        const videoOnly = new MediaStream(remoteStream.getVideoTracks());
        if (!el.srcObject || (el.srcObject as MediaStream).getVideoTracks()[0]?.id !== videoOnly.getVideoTracks()[0]?.id) {
          el.srcObject = videoOnly;
        }
      }
      if (remoteStream && el.paused) {
        el.play().catch(() => {});
      }
    }
  }, [remoteStream]);

  // Keep video elements updated whenever stream references change
  useEffect(() => {
    const el = localVideoRef.current;
    if (el && callStream) {
      if (el.srcObject !== callStream) {
        el.srcObject = callStream;
      }
      el.play().catch(() => {});
    }
  }, [callStream]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el && remoteStream && remoteStream.getVideoTracks().length > 0) {
      const currentTrackId = (el.srcObject as MediaStream)?.getVideoTracks()[0]?.id;
      const newTrackId = remoteStream.getVideoTracks()[0]?.id;
      if (currentTrackId !== newTrackId) {
        el.srcObject = new MediaStream(remoteStream.getVideoTracks());
      }
      el.play().catch(() => {});
    }
  }, [remoteStream]);

  // Direct user-gesture audio unlock helper
  const unlockAudio = useCallback(() => {
    const audio = remoteAudioRef.current;
    if (audio) {
      audio.muted = !isSpeaker;
      audio.volume = isSpeaker ? 1.0 : 0.0;
      audio.play().then(() => {
        setIsAutoplayBlocked(false);
      }).catch(err => {
        logger.warn("Audio unlock attempt deferred:", err);
      });
    }
    aeirmistCall.resumeAudioContext();
  }, [isSpeaker]);

  // Fallback chat details
  const safeChat = chat || {
    id: activeCall?.conversationId || '',
    name: activeCall?.callerName || (activeCall as any)?.participantDetails?.[activeCall?.callerId || '']?.displayName || 'Aeirmist User',
    photo: getAvatarUrl(activeCall?.callerPhoto || (activeCall as any)?.participantDetails?.[activeCall?.callerId || '']?.photoURL, activeCall?.callerId),
    participants: activeCall?.callerId ? [activeCall.callerId, profile?.id].filter(Boolean) : [],
    otherParticipantUid: activeCall?.callerUid || ''
  };

  const participantId = safeChat.participants?.find((id: string) => id !== profile?.id && id !== user?.uid && id !== ('profile_' + user?.uid)) || safeChat.otherParticipantUid || '';

  // Synchronise toggle state with WebRTC streams
  useEffect(() => {
    aeirmistCall.toggleAudio(!isMuted);
  }, [isMuted]);

  useEffect(() => {
    aeirmistCall.toggleVideo(!isVideoOff);
  }, [isVideoOff]);

  // Safe one-time audio monitoring registration per stream
  useEffect(() => {
    if (callStream && callStream.getAudioTracks().length > 0) {
      aeirmistCall.setupAudioMonitoring(callStream, 'local');
    }
  }, [callStream]);

  useEffect(() => {
    if (remoteStream && remoteStream.getAudioTracks().length > 0) {
      aeirmistCall.setupAudioMonitoring(remoteStream, 'remote');
    }
  }, [remoteStream]);

  // Synchronise remote audio playback, volume, and speaker state without interrupting active streams
  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    audio.muted = !isSpeaker;
    audio.volume = isSpeaker ? 1.0 : 0.0;

    if (remoteStream && remoteStream.getAudioTracks().length > 0) {
      const currentSrcObject = audio.srcObject as MediaStream | null;
      const currentTrackId = currentSrcObject?.getAudioTracks()[0]?.id;
      const newTrackId = remoteStream.getAudioTracks()[0]?.id;

      // Only assign if the audio track ID actually changed, preventing decoder reset
      if (!currentSrcObject || (newTrackId && currentTrackId !== newTrackId)) {
        audio.srcObject = remoteStream;
      }
      
      if (isSpeaker) {
        audio.play().then(() => {
          setIsAutoplayBlocked(false);
        }).catch(e => {
          logger.warn("Remote audio play deferred by browser autoplay policy", e);
          setIsAutoplayBlocked(true);
        });
      }
    }
  }, [remoteStream, isSpeaker, callStatus]);

  // Bind WebRTC media streams safely across all active rendering video tags without reset loops
  useEffect(() => {
    const bindStreams = () => {
      const localVideos = document.querySelectorAll('.aeirmist-local-video') as NodeListOf<HTMLVideoElement>;
      localVideos.forEach(v => {
        v.muted = true;
        const currentTrackId = (v.srcObject as MediaStream)?.getVideoTracks()[0]?.id;
        const newTrackId = callStream?.getVideoTracks()[0]?.id;
        if (newTrackId && currentTrackId !== newTrackId) {
          v.srcObject = callStream;
          v.play().catch(() => {});
        } else if (!currentTrackId && callStream && callStream.getVideoTracks().length > 0) {
          v.srcObject = callStream;
          v.play().catch(() => {});
        }
      });

      const remoteVideos = document.querySelectorAll('.aeirmist-remote-video') as NodeListOf<HTMLMediaElement>;
      remoteVideos.forEach(v => {
        if (v instanceof HTMLVideoElement) {
          v.muted = true;
          const currentTrackId = (v.srcObject as MediaStream)?.getVideoTracks()[0]?.id;
          const newTrackId = remoteStream?.getVideoTracks()[0]?.id;
          if (newTrackId && currentTrackId !== newTrackId) {
            v.srcObject = new MediaStream(remoteStream.getVideoTracks());
            v.play().catch(() => {});
          } else if (!currentTrackId && remoteStream && remoteStream.getVideoTracks().length > 0) {
            v.srcObject = new MediaStream(remoteStream.getVideoTracks());
            v.play().catch(() => {});
          }
        }
      });

      if (remoteAudioRef.current && remoteStream && remoteStream.getAudioTracks().length > 0) {
        const a = remoteAudioRef.current;
        a.muted = !isSpeaker;
        a.volume = isSpeaker ? 1.0 : 0.0;
        
        const currentSrcObject = a.srcObject as MediaStream | null;
        const currentTrackId = currentSrcObject?.getAudioTracks()[0]?.id;
        const newTrackId = remoteStream.getAudioTracks()[0]?.id;

        if (!currentSrcObject || (newTrackId && currentTrackId !== newTrackId)) {
          a.srcObject = remoteStream;
        }
        if (a.paused && isSpeaker && !isAutoplayBlocked) {
          a.play().then(() => {
            setIsAutoplayBlocked(false);
          }).catch(() => {
            setIsAutoplayBlocked(true);
          });
        }
      }
    };

    bindStreams();
    const interval = setInterval(bindStreams, 1000);
    return () => clearInterval(interval);
  }, [callStream, remoteStream, callStatus, isVideoOff, isMinimized, isSpeaker, isAutoplayBlocked]);

  const handleSwitchCamera = async () => {
    try {
      const updatedStream = await aeirmistCall.switchCamera();
      if (updatedStream) {
        setCallStream(updatedStream);
      }
    } catch (e) {
      logger.error("Camera switch failed", e);
    }
  };

  const handleToggleVideo = async (targetEnabled?: boolean) => {
    const shouldEnable = targetEnabled !== undefined ? targetEnabled : isVideoOff;
    try {
      setIsVideoOff(!shouldEnable);
      const updatedStream = await aeirmistCall.toggleVideo(shouldEnable);
      if (updatedStream) {
        setCallStream(updatedStream);
      }
    } catch (e: any) {
      logger.error("[CallModal] Toggle video failed:", e);
      setIsVideoOff(true);
    }
  };

  // Timer logic
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Monitor audio levels
  useEffect(() => {
    const interval = setInterval(() => {
      if (callStatus === 'connected') {
        setRemoteAudioLevel(aeirmistCall.getAudioLevel('remote'));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [callStatus]);

  // Initialize call / permissions setup
  useEffect(() => {
    if (callStatus === 'error') return;
    
    const initCall = async () => {
      try {
        if (!isIncomingCall && safeChat.id && !hasInitiatedCall.current) {
          hasInitiatedCall.current = true;
          unlockAudio();
          try {
            await ensureCallPermissions(type);
          } catch (permErr) {
            logger.warn("[CallModal] Permission check on init:", permErr);
          }
          const targetUid = safeChat.otherParticipantUid || safeChat.participants?.find((id: string) => id !== profile?.id && id !== user?.uid && id !== ('profile_' + user?.uid));
          await startCall(safeChat.id, type, targetUid);
          aeirmistRingtone.playDialTone();
        }
      } catch (e: any) {
        setCallStatus('error');
        setErrorMessage(e.message || "Encrypted call failed to initialize.");
      }
    };

    initCall();
    
    if (isIncomingCall && callStatus === 'ringing') {
      aeirmistRingtone.playRingtone(type);
      if (window.navigator.vibrate) {
        window.navigator.vibrate([500, 300, 500, 300, 500]);
      }
    }

    return () => {
      aeirmistRingtone.stop();
      if (window.navigator.vibrate) window.navigator.vibrate(0);
    };
  }, [isIncomingCall]);

  // Listen to low-level WebRTC peer connection states
  useEffect(() => {
    const unsub = aeirmistCall.onConnectionStateChange((state, detail) => {
      logger.info("[CallModal] WebRTC connectionState update:", state, detail);
      if (state === 'connected') {
        setCallStatus('connected');
        aeirmistRingtone.stop();
      } else if (state === 'connecting') {
        setCallStatus(prev => (prev === 'ringing' || prev === 'connecting' ? 'connecting' : prev));
        aeirmistRingtone.stop();
      } else if (state === 'reconnecting') {
        setCallStatus('reconnecting');
      } else if (state === 'failed') {
        setCallStatus('error');
        setErrorMessage(detail || "WebRTC encrypted media connection failed between devices. Please check network.");
      } else if (state === 'ended') {
        setCallStatus('ended');
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // Sync state transitions from Firestore signaling
  useEffect(() => {
    let closeTimer: any = null;
    if (activeCall?.status === 'accepted' || activeCall?.status === 'ongoing') {
      const isActuallyConnected = aeirmistCall.getConnectionState() === 'connected';
      setCallStatus(isActuallyConnected ? 'connected' : 'connecting');
      aeirmistRingtone.stop();
    } else if (activeCall?.status === 'reconnecting') {
      setCallStatus('reconnecting');
    } else if (activeCall?.status === 'rejected' || activeCall?.status === 'busy' || activeCall?.status === 'missed') {
       aeirmistRingtone.stop();
       setCallStatus('ended');
       if (activeCall?.status === 'missed') {
         setErrorMessage("Call missed. No response from recipient.");
       }
       closeTimer = setTimeout(onClose, 2000);
    } else if (!activeCall && callStatus !== 'ringing' && callStatus !== 'connecting' && callStatus !== 'connected' && callStatus !== 'reconnecting') {
      onClose();
    }
    return () => {
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [activeCall, callStatus, onClose]);

  // Long-call reliability: Screen WakeLock, MediaSession background persistence, and auto-resume audio stall
  useEffect(() => {
    if (callStatus === 'connected') {
      aeirmistCall.acquireWakeLock();
      aeirmistCall.setupMediaSession(safeChat.name, handleEnd);
      aeirmistCall.startHeartbeat(db);

      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        try {
          (window as any).Capacitor.Plugins?.NativeSettings?.setAudioMode?.({ mode: 'communication', speaker: isSpeaker });
        } catch (e) {}
      }

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          aeirmistCall.acquireWakeLock();
          if (remoteAudioRef.current && isSpeaker && remoteAudioRef.current.paused) {
            remoteAudioRef.current.play().catch(() => {});
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      const audio = remoteAudioRef.current;
      const handleStall = () => {
        logger.warn("[WebRTC Audio] Buffer underrun / stall detected, auto-resuming playback...");
        if (audio && isSpeaker) {
          audio.play().catch(() => {});
        }
      };

      if (audio) {
        audio.addEventListener('waiting', handleStall);
        audio.addEventListener('stalled', handleStall);
        audio.addEventListener('pause', handleStall);
      }

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (audio) {
          audio.removeEventListener('waiting', handleStall);
          audio.removeEventListener('stalled', handleStall);
          audio.removeEventListener('pause', handleStall);
        }
      };
    } else {
      aeirmistCall.releaseWakeLock();
      aeirmistCall.endMediaSession();
      aeirmistCall.stopHeartbeat();
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        try {
          (window as any).Capacitor.Plugins?.NativeSettings?.setAudioMode?.({ mode: 'normal', speaker: false });
        } catch (e) {}
      }
    }
  }, [callStatus, isSpeaker, safeChat.name]);

  const handleEnd = () => {
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      try {
        (window as any).Capacitor.Plugins?.NativeSettings?.setAudioMode?.({ mode: 'normal', speaker: false });
      } catch (e) {}
    }
    if (activeCall?.id) {
       aeirmistCall.updateStatus(db, activeCall.id, 'ended');
       endCall(activeCall.id, activeCall.conversationId);
    }
    aeirmistRingtone.stop();
    setCallStatus('ended');
    setTimeout(onClose, 1000);
  };

  const handleAccept = async (asAudio = false) => {
    if (!activeCall?.id || isAcceptingRef.current) return;
    isAcceptingRef.current = true;
    unlockAudio();
    
    const callType = asAudio ? 'audio' : type;
    try {
      await ensureCallPermissions(callType);
    } catch (permErr) {
      logger.warn("[CallModal] Permission check on accept:", permErr);
    }

    try {
      setCallStatus('connecting');
      aeirmistRingtone.stop();
      if (asAudio) setIsVideoOff(true);
      await acceptCall(activeCall.id, activeCall.conversationId);
    } catch (err: any) {
      logger.error("Call accept failed", err);
      isAcceptingRef.current = false;
      setCallStatus('error');
      setErrorMessage(err.message || 'Could not connect audio/video stream. Please check camera & microphone permissions.');
    }
  };

  const handleReject = () => {
    if (activeCall?.id) rejectCall(activeCall.id, activeCall.conversationId);
    aeirmistRingtone.stop();
    onClose();
  };

  const cycleFilter = () => {
    setFilterIndex((prev) => (prev + 1) % filtersList.length);
  };

  const currentFilter = filtersList[filterIndex];

  const getLocalFilterCss = () => {
    let filterStr = '';
    if (currentFilter === 'cyberpunk') filterStr += 'hue-rotate(180deg) contrast(1.2) saturate(1.4) ';
    else if (currentFilter === 'warm') filterStr += 'sepia(0.35) saturate(1.3) contrast(1.05) ';
    else if (currentFilter === 'mono') filterStr += 'grayscale(1) contrast(1.25) ';
    else if (currentFilter === 'vintage') filterStr += 'sepia(0.5) contrast(1.1) brightness(0.95) ';

    if (isRetouchOn) filterStr += 'brightness(1.08) contrast(0.95) ';
    return filterStr.trim() || 'none';
  };

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      await aeirmistCall.stopScreenShare();
      // Restore local preview to camera
      const localVideos = document.querySelectorAll('.aeirmist-local-video') as NodeListOf<HTMLVideoElement>;
      localVideos.forEach(v => {
        if (callStream) {
          v.srcObject = callStream;
          v.play().catch(() => {});
        }
      });
      setSharedMediaToast("Screen sharing stopped");
      setTimeout(() => setSharedMediaToast(null), 3000);
    } else {
      try {
        if (navigator.mediaDevices && (navigator.mediaDevices as any).getDisplayMedia) {
          const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
          screenStreamRef.current = stream;
          setIsScreenSharing(true);
          await aeirmistCall.startScreenShare(stream);
          // Show screen stream in local video tile
          const localVideos = document.querySelectorAll('.aeirmist-local-video') as NodeListOf<HTMLVideoElement>;
          localVideos.forEach(v => {
            v.srcObject = stream;
            v.play().catch(() => {});
          });
          setSharedMediaToast("Screen sharing active 🖥️");
          setTimeout(() => setSharedMediaToast(null), 3000);
          
          stream.getVideoTracks()[0].onended = async () => {
            setIsScreenSharing(false);
            screenStreamRef.current = null;
            await aeirmistCall.stopScreenShare();
            const lVideos = document.querySelectorAll('.aeirmist-local-video') as NodeListOf<HTMLVideoElement>;
            lVideos.forEach(v => {
              if (callStream) {
                v.srcObject = callStream;
                v.play().catch(() => {});
              }
            });
          };
        } else {
          setIsMediaShareOpen(true);
        }
      } catch (err) {
        console.warn("Screen share cancelled:", err);
      }
    }
  };

  const displayPhoto = isIncomingCall ? (activeCall?.callerPhoto || safeChat.photo) : (activeCall?.receiverPhoto || safeChat.photo);
  const isVideoMode = isVideoLayout;

  // Add People Drawer Component
  const renderAddPeopleDrawer = () => (
    <AnimatePresence>
      {isAddPeopleOpen && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 bg-[#0a0b0f] border-t border-white/10 rounded-t-[2rem] p-5 z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.9)] max-h-[75%] flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2">
              <UserPlus size={16} className="text-cyan-400" /> Add People to Call
            </h4>
            <button 
              onClick={() => setIsAddPeopleOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search connections..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50"
            />
          </div>

          <div className="overflow-y-auto space-y-2 pr-1 flex-1 min-h-[160px]">
            {(allProfiles || []).filter((c: any) => 
              c.id !== profile?.id &&
              (c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
               c.handle?.toLowerCase().includes(searchQuery.toLowerCase()))
            ).map((conn: any) => {
              const isInvited = invitedUsers[conn.id];
              return (
                <div key={conn.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-3">
                    <img src={getAvatarUrl(conn.photoURL || conn.avatar, conn.id)} className="w-9 h-9 rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                    <div>
                      <div className="text-xs font-bold text-white">{conn.displayName || 'Aeirmist Member'}</div>
                      <div className="text-[10px] text-emerald-400 font-mono">Online</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setInvitedUsers(prev => ({ ...prev, [conn.id]: true }));
                    }}
                    disabled={isInvited}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      isInvited 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-md active:scale-95'
                    }`}
                  >
                    {isInvited ? 'Invited' : 'Invite'}
                  </button>
                </div>
              );
            })}
            {(!allProfiles || allProfiles.length === 0) && (
              <div className="text-center py-8 text-white/40 text-xs font-medium">
                No other online members available right now.
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Media Share Drawer Component
  const renderMediaShareDrawer = () => (
    <AnimatePresence>
      {isMediaShareOpen && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 bg-[#0a0b0f] border-t border-white/10 rounded-t-[2rem] p-5 z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.9)]"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2">
              <Image size={16} className="text-purple-400" /> Share Media in Call
            </h4>
            <button 
              onClick={() => setIsMediaShareOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { id: 1, title: 'Screen Shot', icon: <Share2 size={18} className="text-cyan-400" /> },
              { id: 2, title: 'Photo Library', icon: <Image size={18} className="text-purple-400" /> },
              { id: 3, title: 'Sparkle Effect', icon: <Sparkles size={18} className="text-amber-400" /> },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSharedMediaToast(`Shared ${item.title} to stream`);
                  setIsMediaShareOpen(false);
                  setTimeout(() => setSharedMediaToast(null), 3000);
                }}
                className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center gap-2 hover:bg-white/10 transition-all text-center"
              >
                {item.icon}
                <span className="text-[10px] font-bold text-white/80">{item.title}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Minimized Widget View
  const renderMinimizedWidget = () => (
    <motion.div
      drag
      dragConstraints={{ left: -1000, right: 0, top: -1000, bottom: 0 }}
      onClick={() => {
        unlockAudio();
        setIsMinimized(false);
      }}
      className="fixed bottom-6 right-6 z-[250] w-36 h-52 rounded-2xl bg-black border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.8)] overflow-hidden cursor-pointer flex flex-col justify-between p-2.5 group touch-none select-none"
    >
      <div className="relative w-full h-full rounded-xl overflow-hidden bg-zinc-900 flex items-center justify-center">
        {isVideoMode ? (
          <video className="aeirmist-remote-video w-full h-full object-cover" autoPlay playsInline muted />
        ) : (
          <img src={displayPhoto} className="w-14 h-14 rounded-2xl object-cover border border-white/20 shadow-md" referrerPolicy="no-referrer" />
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all flex items-center justify-center">
          <Maximize2 size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 px-1">
        <span className="text-[9px] font-mono font-bold text-emerald-400">{formatDuration(duration)}</span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleEnd();
          }}
          className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white"
        >
          <PhoneOff size={12} />
        </button>
      </div>
    </motion.div>
  );

  // Render Inner Content Phone Layout
  function renderPhoneCallContent() {
    if (callStatus === 'error') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-xl">
            <VideoOff size={36} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider">Call Failed</h3>
            <p className="text-xs text-white/50 mt-2 leading-relaxed">
              {errorMessage || "Unable to access media device or establish connection."}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
          >
            Retry Connection
          </button>
        </div>
      );
    }

    if (callStatus === 'ended') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center gap-6 p-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500"
          >
            <PhoneOff size={32} />
          </motion.div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider">Call Ended</h3>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">Feed disconnected</p>
          </div>
        </div>
      );
    }

    if (callStatus === 'ringing' && isVideoOff) {
      return (
        <div className="w-full h-full flex flex-col justify-between relative overflow-hidden select-none bg-black">
          {/* Blurred Background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img src={displayPhoto} className="w-full h-full object-cover blur-[90px] brightness-[0.25] scale-125" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-black/60" />
          </div>

          {/* Top Bar */}
          <div className="relative z-10 flex items-center justify-between pt-4 px-5 pb-2">
            <button 
              onClick={() => setIsMinimized(true)}
              className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all"
            >
              <ChevronDown size={22} />
            </button>
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-cyan-400 animate-pulse">
              {isIncomingCall ? `Incoming ${type}...` : `Calling...`}
            </span>
            <div className="w-10 h-10" />
          </div>

          {/* Plain Screen Profile Avatar & Calling Info (No Outer Box Card) */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto w-full px-4 text-center">
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute w-36 h-36 rounded-3xl border border-white/10 bg-white/5"
              />
              <img 
                src={displayPhoto} 
                className="w-28 h-28 rounded-3xl object-cover border-2 border-white/20 relative z-10 shadow-[0_15px_35px_rgba(0,0,0,0.8)]" 
                referrerPolicy="no-referrer" 
              />
            </div>
            <div className="mt-6">
              <LiveParticipantName
                participantId={participantId}
                fallbackName={safeChat.name}
                chatId={safeChat.id}
                className="text-2xl font-bold text-white tracking-tight block drop-shadow-lg"
              />
              <span className="text-xs font-semibold text-white/60 block mt-1.5 uppercase tracking-widest font-mono">
                {isIncomingCall ? `Incoming ${type === 'video' ? 'Video Call' : 'Voice Call'}` : 'Connecting...'}
              </span>
            </div>
          </div>

          {/* Bottom Call Action buttons / Controls dock */}
          {isIncomingCall ? (
            <div className="relative z-10 w-full flex flex-col items-center gap-4 pb-6 px-4">
              {/* Core quick controls for incoming call */}
              <div className="flex items-center justify-center gap-3 bg-[#08090d]/80 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl">
                <button
                  onClick={() => setIsSpeaker(!isSpeaker)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    !isSpeaker ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/10 text-white'
                  }`}
                  title="Speaker Toggle"
                >
                  {isSpeaker ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white'
                  }`}
                  title="Mute Mic"
                >
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  onClick={() => handleToggleVideo(!isVideoOff)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isVideoOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white'
                  }`}
                  title="Camera Toggle"
                >
                  {isVideoOff ? <VideoOff size={18} /> : <VideoIcon size={18} />}
                </button>
                <button
                  onClick={handleToggleScreenShare}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isScreenSharing ? 'bg-cyan-500 text-black font-bold' : 'bg-white/10 text-white'
                  }`}
                  title="Share Screen"
                >
                  <Monitor size={18} />
                </button>
              </div>

              {/* Decline and Accept Buttons (Square 2XL) */}
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={handleReject}
                    className="w-14 h-14 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-90 flex items-center justify-center text-white shadow-2xl transition-all"
                    title="Decline"
                  >
                    <PhoneOff size={24} />
                  </button>
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Decline</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={() => handleAccept(false)}
                    className="w-14 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-90 flex items-center justify-center text-white shadow-2xl transition-all"
                    title="Accept"
                  >
                    {type === 'video' ? <VideoIcon size={24} /> : <Phone size={24} />}
                  </button>
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Accept</span>
                </div>
              </div>
            </div>
          ) : (
            /* 5-Icon Control Dock for Outgoing Calling Screen */
            <div className="relative z-10 w-full bg-[#08090d]/95 backdrop-blur-2xl border-t border-white/10 px-3 py-3.5 flex items-center justify-evenly gap-2 shrink-0">
              {/* 1. Speaker / Audio */}
              <button
                onClick={() => setIsSpeaker(!isSpeaker)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${
                  !isSpeaker ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="Speaker Toggle"
              >
                {isSpeaker ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>

              {/* 2. Microphone Toggle */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${
                  isMuted 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                    : 'bg-white text-black font-bold shadow-lg'
                }`}
                title="Mute Mic"
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {/* 3. Camera Toggle */}
              <button
                onClick={() => handleToggleVideo(!isVideoOff)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${
                  isVideoOff 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="Camera Toggle"
              >
                {isVideoOff ? <VideoOff size={20} /> : <VideoIcon size={20} />}
              </button>

              {/* 4. Share Screen / Media (Monitor Icon) */}
              <button
                onClick={handleToggleScreenShare}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${
                  isScreenSharing 
                    ? 'bg-cyan-500 text-black font-bold shadow-lg' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="Share Screen"
              >
                <Monitor size={20} />
              </button>

              {/* 5. End / Cancel Call */}
              <button
                onClick={handleEnd}
                className="w-12 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all active:scale-90 shadow-xl shrink-0"
                title="Cancel Call"
              >
                <PhoneOff size={20} />
              </button>
            </div>
          )}
        </div>
      );
    }

    // CONNECTED VIDEO CALL MODE
    if (isVideoMode) {
      return (
        <div className="w-full h-full flex flex-col bg-black relative overflow-hidden select-none">
          {/* Shared Toast Notification */}
          {sharedMediaToast && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-cyan-500/90 text-black text-[10px] font-black uppercase tracking-wider shadow-2xl backdrop-blur-md">
              {sharedMediaToast}
            </div>
          )}

          {/* TOP HALF: REMOTE PARTICIPANT VIDEO */}
          <div className="relative flex-1 bg-zinc-950 overflow-hidden flex items-center justify-center min-h-0">
            <video 
              ref={setRemoteVideoNode}
              className="aeirmist-remote-video w-full h-full object-cover" 
              autoPlay 
              playsInline 
              muted 
            />
            
            {/* Fallback / Ringing / Connecting overlay on top half */}
            {(callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'reconnecting' || !hasRemoteVideoTrack) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md text-center p-4">
                <div className="relative mb-3">
                  <motion.div
                    animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-2xl border border-white/20 bg-white/5"
                  />
                  <img src={displayPhoto} className="w-20 h-20 rounded-2xl object-cover border border-white/20 relative z-10 shadow-2xl" referrerPolicy="no-referrer" />
                </div>
                <LiveParticipantName
                  participantId={participantId}
                  fallbackName={safeChat.name}
                  chatId={safeChat.id}
                  className="text-lg font-bold text-white block drop-shadow-md"
                />
                <span className="text-[11px] font-mono text-cyan-400 font-semibold block mt-1.5 tracking-widest uppercase animate-pulse">
                  {callStatus === 'ringing' 
                    ? (isIncomingCall ? 'Incoming Video Call...' : 'Calling...') 
                    : callStatus === 'connecting' 
                    ? 'Connecting Video Link...' 
                    : callStatus === 'reconnecting' 
                    ? 'Reconnecting...' 
                    : 'Camera is off'}
                </span>
              </div>
            )}

            {/* TOP HEADER OVERLAY (Down Chevron & Red End Call Button) */}
            <div className="absolute top-0 inset-x-0 pt-4 pb-8 px-4 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-auto">
              <button 
                onClick={() => setIsMinimized(true)}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all shadow-lg"
              >
                <ChevronDown size={22} />
              </button>

              <div className="px-3.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-mono font-bold text-white tracking-widest shadow-md flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
                {callStatus === 'connected' ? formatDuration(duration) : 'Connecting'}
              </div>

              <button 
                onClick={handleEnd}
                className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 active:scale-90 flex items-center justify-center text-white shadow-lg transition-all"
              >
                <PhoneOff size={18} />
              </button>
            </div>
          </div>

          {/* BOTTOM HALF: LOCAL USER CAMERA FEED */}
          <div className="relative flex-1 bg-black overflow-hidden border-t border-white/10 shadow-2xl min-h-0">
            <video 
              ref={setLocalVideoNode}
              className="aeirmist-local-video w-full h-full object-cover scale-x-[-1]" 
              autoPlay 
              playsInline 
              muted 
              style={{ filter: getLocalFilterCss() }}
            />

            {(!hasLocalVideoTrack || isVideoOff) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900/90 text-center p-4">
                <img src={getAvatarUrl(profile?.photoURL, profile?.id)} className="w-16 h-16 rounded-2xl object-cover border border-white/10 mb-2 shadow-lg" referrerPolicy="no-referrer" />
                <span className="text-xs text-white/50 font-mono tracking-wider">Your camera is off</span>
              </div>
            )}

            {/* Sparkles Particle Animation Overlay */}
            {isSparklesOn && (
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                <motion.div 
                  animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.9, 1.15, 0.9] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute top-1/4 right-8 w-12 h-12 rounded-full bg-cyan-400/20 blur-xl"
                />
                <motion.div 
                  animate={{ opacity: [0.2, 0.7, 0.2], scale: [1, 1.25, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                  className="absolute bottom-1/3 left-10 w-16 h-16 rounded-full bg-purple-400/20 blur-xl"
                />
              </div>
            )}
          </div>

          {/* BOTTOM CONTROL DOCK (Home UI Navigation Bar Style) */}
          <div className="w-full px-3 pb-5 pt-2 z-40 flex items-center justify-center shrink-0">
            <div className="relative w-full max-w-[390px] rounded-2xl border border-white/10 px-2 py-1.5 flex justify-around items-center shadow-[0_12px_30px_rgba(0,0,0,0.85)] bg-black/85 backdrop-blur-3xl overflow-hidden">
              {/* Metallic Glass sheen highlights */}
              <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 inset-x-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

              {/* 1. Camera Toggle */}
              <button
                onClick={() => handleToggleVideo(!isVideoOff)}
                className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
                title="Camera Toggle"
              >
                <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                  isVideoOff 
                    ? 'bg-red-500/20 border-red-500/35 text-red-400' 
                    : 'bg-white/10 border-white/25 text-white shadow-sm'
                }`}>
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  <div className="relative z-10">
                    {isVideoOff ? <VideoOff size={18} /> : <VideoIcon size={18} />}
                  </div>
                </div>
              </button>

              {/* 2. Microphone Toggle */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
                title="Mute Mic"
              >
                <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                  isMuted 
                    ? 'bg-red-500/20 border-red-500/35 text-red-400' 
                    : 'bg-white/10 border-white/25 text-white shadow-sm'
                }`}>
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  <div className="relative z-10">
                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  </div>
                </div>
              </button>

              {/* 3. Speaker Toggle */}
              <button
                onClick={() => setIsSpeaker(!isSpeaker)}
                className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
                title="Toggle Speaker"
              >
                <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                  !isSpeaker 
                    ? 'bg-amber-500/20 border-amber-500/35 text-amber-400' 
                    : 'bg-white/10 border-white/25 text-white shadow-sm'
                }`}>
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  <div className="relative z-10">
                    {isSpeaker ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </div>
                </div>
              </button>

              {/* 4. Screen Share */}
              <button
                onClick={handleToggleScreenShare}
                className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
                title="Share Screen"
              >
                <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                  isScreenSharing 
                    ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.3)]' 
                    : 'bg-[#0a0a0d]/80 border-white/5 text-white/50 hover:border-white/15 hover:text-white'
                }`}>
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  <div className="relative z-10">
                    <Monitor size={18} />
                  </div>
                </div>
              </button>

              {/* 4. Flip Camera */}
              <button
                onClick={handleSwitchCamera}
                className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
                title="Flip Camera"
              >
                <div className="w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden bg-[#0a0a0d]/80 border-white/5 text-white/50 hover:border-white/15 hover:text-white">
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  <div className="relative z-10">
                    <RefreshCw size={18} />
                  </div>
                </div>
              </button>

              {/* 5. Add People */}
              <button
                onClick={() => setIsAddPeopleOpen(true)}
                className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
                title="Add People"
              >
                <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                  isAddPeopleOpen 
                    ? 'bg-white/10 border-white/25 text-white' 
                    : 'bg-[#0a0a0d]/80 border-white/5 text-white/50 hover:border-white/15 hover:text-white'
                }`}>
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  <div className="relative z-10">
                    <Users size={18} />
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Drawers */}
          {renderAddPeopleDrawer()}
          {renderMediaShareDrawer()}
        </div>
      );
    }

    // CONNECTED AUDIO CALL MODE
    return (
      <div className="w-full h-full flex flex-col justify-between bg-black relative overflow-hidden select-none">
        {/* Blurred Background */}
        <div className="absolute inset-0 z-0">
          <img src={displayPhoto} className="w-full h-full object-cover blur-[80px] brightness-[0.25] scale-125" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/60" />
        </div>

        {/* TOP BAR */}
        <div className="relative z-10 pt-4 px-4 flex items-center justify-between">
          <button 
            onClick={() => setIsMinimized(true)}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white"
          >
            <ChevronDown size={22} />
          </button>
          <div className="px-3.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-mono font-bold text-emerald-400 tracking-widest shadow-md">
            {formatDuration(duration)}
          </div>
          <button 
            onClick={handleEnd}
            className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 active:scale-90 flex items-center justify-center text-white shadow-lg transition-all"
          >
            <PhoneOff size={18} />
          </button>
        </div>

        {/* CENTER AUDIO AVATAR */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto text-center gap-4">
          <div className="relative flex items-center justify-center">
            <div 
              className="absolute w-40 h-40 rounded-3xl border border-cyan-400/30 bg-cyan-400/10 blur-sm transition-all duration-300"
              style={{ transform: `scale(${1 + remoteAudioLevel / 80})` }}
            />
            <img src={displayPhoto} className="w-32 h-32 rounded-2xl object-cover border-[3px] border-white/20 relative z-10 shadow-2xl" referrerPolicy="no-referrer" />
          </div>

          <div>
            <LiveParticipantName
              participantId={participantId}
              fallbackName={safeChat.name}
              chatId={safeChat.id}
              className="text-2xl font-black text-white uppercase tracking-tight block drop-shadow-md"
            />
            <div className="flex items-center justify-center gap-1.5 mt-2 text-white/50">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest font-mono">Audio Link • Encrypted</span>
            </div>
          </div>
        </div>

        {/* BOTTOM AUDIO DOCK (Home UI Navigation Bar Style) */}
        <div className="relative z-10 w-full px-3 pb-5 pt-2 flex items-center justify-center shrink-0">
          <div className="relative w-full max-w-[390px] rounded-2xl border border-white/10 px-2 py-1.5 flex justify-around items-center shadow-[0_12px_30px_rgba(0,0,0,0.85)] bg-black/85 backdrop-blur-3xl overflow-hidden">
            {/* Metallic Glass sheen highlights */}
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

            {/* 1. Speaker / Audio */}
            <button
              onClick={() => setIsSpeaker(!isSpeaker)}
              className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Speaker Toggle"
            >
              <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                !isSpeaker 
                  ? 'bg-amber-500/20 border-amber-500/35 text-amber-400' 
                  : 'bg-white/10 border-white/25 text-white shadow-sm'
              }`}>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  {isSpeaker ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </div>
              </div>
            </button>

            {/* 2. Microphone Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Mute Mic"
            >
              <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                isMuted 
                  ? 'bg-red-500/20 border-red-500/35 text-red-400' 
                  : 'bg-white/10 border-white/25 text-white shadow-sm'
              }`}>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </div>
              </div>
            </button>

            {/* 3. Camera Toggle */}
            <button
              onClick={() => handleToggleVideo(true)}
              className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Enable Camera"
            >
              <div className="w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden bg-[#0a0a0d]/80 border-white/5 text-white/50 hover:border-white/15 hover:text-white">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <VideoOff size={18} />
                </div>
              </div>
            </button>

            {/* 4. Share Screen */}
            <button
              onClick={handleToggleScreenShare}
              className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Share Screen"
            >
              <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                isScreenSharing 
                  ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.3)]' 
                  : 'bg-[#0a0a0d]/80 border-white/5 text-white/50 hover:border-white/15 hover:text-white'
              }`}>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <Monitor size={18} />
                </div>
              </div>
            </button>

            {/* 5. End Call */}
            <button
              onClick={handleEnd}
              className="relative flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="End Call"
            >
              <div className="w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden bg-red-600/90 border-red-500/50 text-white shadow-lg">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <PhoneOff size={18} />
                </div>
              </div>
            </button>
          </div>
        </div>

        {renderAddPeopleDrawer()}
        {renderMediaShareDrawer()}
      </div>
    );
  }

  // Render Desktop Call View (Google Meet / Zoom style matching reference image)
  function renderDesktopCallContent() {
    if (callStatus === 'error') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-xl">
            <VideoOff size={36} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider">Call Failed</h3>
            <p className="text-xs text-white/50 mt-2 leading-relaxed">
              {errorMessage || "Unable to access media device or establish connection."}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
          >
            Retry Connection
          </button>
        </div>
      );
    }

    if (callStatus === 'ended') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center gap-6 p-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500"
          >
            <PhoneOff size={32} />
          </motion.div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider">Call Ended</h3>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">Feed disconnected</p>
          </div>
        </div>
      );
    }

    if (callStatus === 'ringing') {
      return (
        <div className="w-full h-full flex flex-col justify-between relative overflow-hidden p-8 select-none bg-[#111215]">
          {/* Top Bar */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span className="text-xs font-mono font-bold text-white/70 uppercase">Encrypted Link</span>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 animate-pulse">
              {isIncomingCall ? `Incoming Call...` : `Calling...`}
            </span>
            <button 
              onClick={() => setIsMinimized(true)}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white"
            >
              <ChevronDown size={20} />
            </button>
          </div>

          {/* Center Call Card */}
          <div className="flex flex-col items-center justify-center my-auto text-center gap-4 z-10">
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute w-44 h-44 rounded-3xl border border-cyan-400/30 bg-cyan-400/5"
              />
              {/* Square Profile Pic */}
              <img src={displayPhoto} className="w-36 h-36 rounded-2xl object-cover border-2 border-white/20 relative z-10 shadow-2xl" referrerPolicy="no-referrer" />
            </div>
            <div>
              <LiveParticipantName
                participantId={participantId}
                fallbackName={safeChat.name}
                chatId={safeChat.id}
                className="text-2xl font-black text-white uppercase tracking-tight block drop-shadow-md"
              />
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest block mt-1">Aeirmist Direct Call</span>
            </div>
          </div>

          {/* Bottom Accept/Decline Actions */}
          <div className="w-full flex justify-center pb-4 z-10">
            {isIncomingCall ? (
              <div className="flex items-center gap-6">
                <button 
                  onClick={handleReject}
                  className="px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider shadow-xl transition-all"
                >
                  <PhoneOff size={18} /> Decline
                </button>
                <button 
                  onClick={() => handleAccept(false)}
                  className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider shadow-xl transition-all"
                >
                  {type === 'video' ? <VideoIcon size={18} /> : <Phone size={18} />} Accept Call
                </button>
              </div>
            ) : (
              <button 
                onClick={handleEnd}
                className="px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider shadow-xl transition-all"
              >
                <PhoneOff size={18} /> Cancel Call
              </button>
            )}
          </div>
        </div>
      );
    }

    // CONNECTED DESKTOP CALL MODE
    const invitedList = Object.keys(invitedUsers)
      .map(id => allProfiles?.find((p: any) => p.id === id))
      .filter(Boolean);

    const isGroupCall = (safeChat.participants && safeChat.participants.length > 2) || invitedList.length > 0;

    // List of participants for group mode
    const groupParticipants = [
      {
        id: 'remote_1',
        name: safeChat.name || 'George Alan',
        photo: displayPhoto,
        isLocal: false,
      },
      {
        id: 'local_user',
        name: profile?.displayName || 'Mary Jane',
        photo: getAvatarUrl(profile?.photoURL, profile?.id),
        isLocal: true,
      },
      ...(invitedList.length > 0 
        ? invitedList.map((usr: any, idx: number) => ({
            id: usr.id || `inv_${idx}`,
            name: usr.displayName || 'Participant',
            photo: getAvatarUrl(usr.photoURL || usr.avatar, usr.id),
            isLocal: false,
          }))
        : [
            {
              id: 'p_3',
              name: 'Paul David',
              photo: getAvatarUrl(null, 'p_3'),
              isLocal: false,
            },
            {
              id: 'p_4',
              name: 'Muhammed',
              photo: getAvatarUrl(null, 'p_4'),
              isLocal: false,
            }
          ]
      )
    ];

    return (
      <div className="w-full h-full flex flex-col justify-between bg-[#141518] relative overflow-hidden select-none p-4 gap-3">
        {/* Toast Notification */}
        {sharedMediaToast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-cyan-500/90 text-black text-[10px] font-black uppercase tracking-wider shadow-2xl backdrop-blur-md">
            {sharedMediaToast}
          </div>
        )}

        {/* TOP HEADER OVERLAY (Design Discussion | 12:32 | 👥 count) */}
        <div className="w-full flex items-center justify-between shrink-0 z-20 px-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-white/80 uppercase tracking-wider">{safeChat.name || 'Aeirmist Call'}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3.5 py-1.5 rounded-lg bg-[#25262a] border border-white/10 text-xs font-bold text-white/90 shadow-md">
              {safeChat.name || 'Design Discussion'}
            </div>
            <div className="px-3.5 py-1.5 rounded-lg bg-[#25262a] border border-white/10 text-xs font-mono font-bold text-white/90 shadow-md">
              {callStatus === 'connected' ? formatDuration(duration) : 'Connecting'}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#25262a] border border-white/10 text-xs font-bold text-white/90 shadow-md flex items-center gap-1.5">
              <Users size={14} className="text-cyan-400" />
              <span>{isGroupCall ? groupParticipants.length : 2}</span>
            </div>
          </div>
        </div>

        {/* MAIN VIDEO / PARTICIPANT GRID AREA */}
        <div className="flex-1 min-h-0 w-full relative z-10">
          {!isGroupCall ? (
            /* 2-PERSON NORMAL INBOX CALL (Just 2 Screens Side-by-Side) */
            <div className="w-full h-full grid grid-cols-2 gap-3">
              {/* Tile 1: Remote Participant */}
              <div className="relative rounded-xl bg-[#222327] border border-white/10 overflow-hidden flex items-center justify-center group shadow-xl">
                {hasRemoteVideo ? (
                  <video ref={setRemoteVideoNode} className="aeirmist-remote-video w-full h-full object-cover" autoPlay playsInline muted />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4">
                    <img src={displayPhoto} className="w-28 h-28 rounded-2xl object-cover border-2 border-white/15 shadow-2xl mb-2" referrerPolicy="no-referrer" />
                    <span className="text-xs text-white/50 font-mono">{callStatus === 'connecting' ? 'Connecting Video...' : 'Camera is off'}</span>
                  </div>
                )}
                {/* Participant Name Tag at Bottom Left */}
                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-bold text-white shadow-md">
                  <Volume2 size={13} className="text-emerald-400 shrink-0" />
                  <span>{safeChat.name}</span>
                </div>
              </div>

              {/* Tile 2: Local User */}
              <div className="relative rounded-xl bg-[#222327] border border-white/10 overflow-hidden flex items-center justify-center group shadow-xl">
                {hasLocalVideo ? (
                  <video ref={setLocalVideoNode} className="aeirmist-local-video w-full h-full object-cover scale-x-[-1]" autoPlay playsInline muted style={{ filter: getLocalFilterCss() }} />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4">
                    <img src={getAvatarUrl(profile?.photoURL, profile?.id)} className="w-28 h-28 rounded-2xl object-cover border-2 border-white/15 shadow-2xl mb-2" referrerPolicy="no-referrer" />
                    <span className="text-xs text-white/50 font-mono">Your camera is off</span>
                  </div>
                )}
                {/* Participant Name Tag at Bottom Left */}
                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-bold text-white shadow-md">
                  <Mic size={13} className={isMuted ? "text-red-400" : "text-emerald-400"} />
                  <span>{profile?.displayName || 'You'}</span>
                </div>
              </div>
            </div>
          ) : (
            /* GROUP CALL GRID (2x2 Grid) */
            <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-3">
              {groupParticipants.slice(0, 4).map((p) => (
                <div key={p.id} className="relative rounded-xl bg-[#222327] border border-white/10 overflow-hidden flex items-center justify-center group shadow-xl">
                  {p.isLocal ? (
                    hasLocalVideo ? (
                      <video className="aeirmist-local-video w-full h-full object-cover scale-x-[-1]" autoPlay playsInline muted style={{ filter: getLocalFilterCss() }} />
                    ) : (
                      <img src={p.photo} className="w-24 h-24 rounded-2xl object-cover border-2 border-white/15 shadow-2xl" referrerPolicy="no-referrer" />
                    )
                  ) : (
                    hasRemoteVideo && p.id === 'remote_1' ? (
                      <video className="aeirmist-remote-video w-full h-full object-cover" autoPlay playsInline muted />
                    ) : (
                      <img src={p.photo} className="w-24 h-24 rounded-2xl object-cover border-2 border-white/15 shadow-2xl" referrerPolicy="no-referrer" />
                    )
                  )}

                  {/* Name Tag Bottom Left */}
                  <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-bold text-white shadow-md">
                    <Volume2 size={13} className="text-emerald-400 shrink-0" />
                    <span>{p.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTTOM FLOATING CONTROLS DOCK (Home UI Navigation Bar Style) */}
        <div className="w-full flex items-center justify-center shrink-0 z-20 py-2">
          <div className="relative border border-white/10 px-4 py-2 rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.85)] bg-black/85 backdrop-blur-3xl overflow-hidden flex items-center justify-center gap-2.5">
            {/* Metallic Glass sheen highlights */}
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

            {/* Mic Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="relative flex items-center justify-center w-11 h-11 cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Toggle Microphone"
            >
              <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                isMuted 
                  ? 'bg-red-500/20 border-red-500/35 text-red-400' 
                  : 'bg-white/10 border-white/25 text-white shadow-sm'
              }`}>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </div>
              </div>
            </button>

            {/* Video Toggle */}
            <button
              onClick={() => handleToggleVideo(!isVideoOff)}
              className="relative flex items-center justify-center w-11 h-11 cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Toggle Video"
            >
              <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                isVideoOff 
                  ? 'bg-red-500/20 border-red-500/35 text-red-400' 
                  : 'bg-white/10 border-white/25 text-white shadow-sm'
              }`}>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  {isVideoOff ? <VideoOff size={18} /> : <VideoIcon size={18} />}
                </div>
              </div>
            </button>

            {/* Speaker Toggle */}
            <button
              onClick={() => setIsSpeaker(!isSpeaker)}
              className="relative flex items-center justify-center w-11 h-11 cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Toggle Speaker"
            >
              <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                !isSpeaker 
                  ? 'bg-amber-500/20 border-amber-500/35 text-amber-400' 
                  : 'bg-white/10 border-white/25 text-white shadow-sm'
              }`}>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  {isSpeaker ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </div>
              </div>
            </button>

            {/* Screen Share */}
            <button
              onClick={handleToggleScreenShare}
              className="relative flex items-center justify-center w-11 h-11 cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Share Screen"
            >
              <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                isScreenSharing 
                  ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.3)]' 
                  : 'bg-[#0a0a0d]/80 border-white/5 text-white/50 hover:border-white/15 hover:text-white'
              }`}>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <Monitor size={18} />
                </div>
              </div>
            </button>

            {/* Add People */}
            <button
              onClick={() => setIsAddPeopleOpen(true)}
              className="relative flex items-center justify-center w-11 h-11 cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Add Participants"
            >
              <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                isAddPeopleOpen 
                  ? 'bg-white/10 border-white/25 text-white' 
                  : 'bg-[#0a0a0d]/80 border-white/5 text-white/50 hover:border-white/15 hover:text-white'
              }`}>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <Users size={18} />
                </div>
              </div>
            </button>

            {/* Hand Raise */}
            <button
              onClick={() => {
                setHandRaised(!handRaised);
                setSharedMediaToast(handRaised ? 'Hand lowered' : 'Hand raised ✋');
                setTimeout(() => setSharedMediaToast(null), 3000);
              }}
              className="relative flex items-center justify-center w-11 h-11 cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Raise Hand"
            >
              <div className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden ${
                handRaised 
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]' 
                  : 'bg-[#0a0a0d]/80 border-white/5 text-white/50 hover:border-white/15 hover:text-white'
              }`}>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <Hand size={18} />
                </div>
              </div>
            </button>

            {/* Layout Toggle */}
            <button
              onClick={() => setGridLayout(prev => prev === 'grid' ? 'speaker' : 'grid')}
              className="relative flex items-center justify-center w-11 h-11 cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="Toggle Grid Layout"
            >
              <div className="w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden bg-[#0a0a0d]/80 border-white/5 text-white/50 hover:border-white/15 hover:text-white">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <LayoutGrid size={18} />
                </div>
              </div>
            </button>

            {/* More Options */}
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="relative flex items-center justify-center w-11 h-11 cursor-pointer select-none rounded-xl active:scale-95 transition-transform"
              title="More Options"
            >
              <div className="w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden bg-[#0a0a0d]/80 border-white/5 text-white/50 hover:border-white/15 hover:text-white">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <MoreHorizontal size={18} />
                </div>
              </div>
            </button>

            {/* End Call Button */}
            <button
              onClick={handleEnd}
              className="relative flex items-center justify-center w-11 h-11 cursor-pointer select-none rounded-xl active:scale-95 transition-transform ml-1"
              title="End Call"
            >
              <div className="w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border relative overflow-hidden bg-red-600/90 border-red-500/50 text-white shadow-lg">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <PhoneOff size={18} />
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Drawers */}
        {renderAddPeopleDrawer()}
        {renderMediaShareDrawer()}
      </div>
    );
  }

  return (
    <>
      {/* High-fidelity persistent remote audio playback element */}
      <audio 
        ref={remoteAudioRef}
        autoPlay 
        playsInline 
        className="aeirmist-remote-audio"
        style={{ position: 'fixed', width: '1px', height: '1px', opacity: 0.001, pointerEvents: 'none', top: 0, left: 0 }}
      />
      {isMinimized ? (
        renderMinimizedWidget()
      ) : (
        <AnimatePresence mode="wait">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={unlockAudio}
            onTouchStart={unlockAudio}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-2xl overflow-hidden flex items-center justify-center p-0 md:p-6"
          >
            {/* Floating Autoplay Unblock Chip if browser deferred audio */}
            {isAutoplayBlocked && (
              <motion.button
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  unlockAudio();
                }}
                className="absolute top-5 left-1/2 -translate-x-1/2 z-[260] px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xs uppercase tracking-widest flex items-center gap-2.5 shadow-[0_0_30px_rgba(245,158,11,0.85)] cursor-pointer active:scale-95 transition-all border border-amber-300 animate-pulse select-none"
              >
                <Volume2 size={16} className="stroke-[2.5]" /> Tap anywhere to unmute sound 🔊
              </motion.button>
            )}

            {/* Mobile Phone Frame View */}
            <div className="flex md:hidden w-full h-full overflow-hidden bg-black relative flex-col justify-between">
              {renderPhoneCallContent()}
            </div>

            {/* Desktop Meeting Window Frame View */}
            <div className="hidden md:flex w-full max-w-6xl h-[88vh] max-h-[820px] rounded-2xl border border-white/15 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] overflow-hidden bg-[#121316] relative flex-col justify-between p-4 gap-3">
              {renderDesktopCallContent()}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
};
