import { logger } from '@/src/utils/logger';
import { getEffectiveIceServers as fetchIceServers, DEFAULT_STUN_SERVERS } from './IceServerConfig';
import { ensureCallPermissions, checkCallPermissionState } from './CallPermissions';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp,
  getDoc,
  addDoc,
  deleteDoc,
  query,
  limit,
  Timestamp,
  where,
  writeBatch,
  arrayUnion
} from 'firebase/firestore';

export type CallStatus = 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ongoing' | 'ended' | 'missed' | 'busy' | 'reconnecting';

interface CallData {
  id: string;
  callerId: string;
  receiverId: string;
  callerUid: string;
  receiverUid: string;
  callerName?: string;
  callerPhoto?: string;
  receiverName?: string;
  receiverPhoto?: string;
  status: CallStatus;
  type: 'audio' | 'video';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  duration?: number;
  conversationId?: string;
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = DEFAULT_STUN_SERVERS;

export const ICE_SERVERS: RTCIceServer[] = DEFAULT_ICE_SERVERS;

export type WebRTCConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'ended';

class CallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callId: string | null = null;
  private role: 'caller' | 'receiver' | null = null;
  private isSafeMode: boolean = false;
  private cachedIceServers: RTCIceServer[] | null = null;
  public hasLocalVideo: boolean = false;
  public lastMediaError: string | null = null;
  
  public setSafeMode(enabled: boolean) {
    this.isSafeMode = enabled;
  }
  private audioTransceiver: RTCRtpTransceiver | null = null;
  private videoTransceiver: RTCRtpTransceiver | null = null;
  private renegotiationUnsub: (() => void) | null = null;
  private makingOffer: boolean = false;
  private isSettingRemoteAnswerPending: boolean = false;
  private lastStatsAudioLevel: number = 0;
  private audioContext: AudioContext | null = null;
  private localAudioSource: MediaStreamAudioSourceNode | null = null;
  private remoteAudioSource: MediaStreamAudioSourceNode | null = null;
  private analyzer: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private remoteAnalyzer: AnalyserNode | null = null;
  private remoteDataArray: Uint8Array | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private connectionStateListeners: Set<(state: WebRTCConnectionState, detail?: string) => void> = new Set();
  private candidateUnsub: (() => void) | null = null;
  private callUnsub: (() => void) | null = null;
  private outgoingCandidateBuffer: any[] = [];
  private candidateFlushTimer: any = null;
  private processedCandidateKeys: Set<string> = new Set<string>();
  private candidateBuffer: RTCIceCandidateInit[] = [];
  private wakeLock: any = null;
  private heartbeatInterval: any = null;
  private networkOfflineTimer: any = null;
  private handleOffline: (() => void) | null = null;
  private handleOnline: (() => void) | null = null;
  private handleUnload: (() => void) | null = null;

  public onConnectionStateChange(listener: (state: WebRTCConnectionState, detail?: string) => void) {
    this.connectionStateListeners.add(listener);
    return () => {
      this.connectionStateListeners.delete(listener);
    };
  }

  public getConnectionState(): WebRTCConnectionState {
    const pcState = this.peerConnection?.connectionState;
    const iceState = this.peerConnection?.iceConnectionState;
    if (pcState === 'connected' || iceState === 'connected' || iceState === 'completed') return 'connected';
    if (pcState === 'connecting' || iceState === 'checking') return 'connecting';
    if (pcState === 'failed' || iceState === 'failed') return 'failed';
    if (pcState === 'disconnected' || iceState === 'disconnected') return 'reconnecting';
    if (pcState === 'closed') return 'ended';
    return 'connecting';
  }

  private notifyConnectionState(state: WebRTCConnectionState, detail?: string) {
    this.connectionStateListeners.forEach(l => {
      try { l(state, detail); } catch (e) {}
    });
  }

  public async getEffectiveIceServers(): Promise<RTCIceServer[]> {
    if (this.cachedIceServers && this.cachedIceServers.length > 0) {
      return this.cachedIceServers;
    }
    const servers = await fetchIceServers();
    this.cachedIceServers = servers;
    return servers;
  }

  async initLocalStream(type: 'audio' | 'video') {
    try {
      this.lastMediaError = null;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Media access (camera/microphone) is not supported in this browser or requires a secure HTTPS connection.");
      }

      // Check and request permissions idempotently for this specific call type
      // NOTE: Audio calls NEVER request camera permission!
      await ensureCallPermissions(type);

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000
      };
      // Chromium & Android WebView hardware AEC / DSP optimization flags
      (audioConstraints as any).googEchoCancellation = true;
      (audioConstraints as any).googAutoGainControl = true;
      (audioConstraints as any).googNoiseSuppression = true;
      (audioConstraints as any).googHighpassFilter = true;
      (audioConstraints as any).googTypingNoiseDetection = true;

      if (type === 'video') {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: {
              facingMode: 'user',
              width: { ideal: 960, max: 1280 },
              height: { ideal: 540, max: 720 },
              frameRate: { ideal: 24, max: 30 }
            }
          });
          this.hasLocalVideo = true;
        } catch (videoErr: any) {
          logger.warn("[CallService] Preferred mobile video constraints failed, trying basic video constraints", videoErr);
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              audio: audioConstraints,
              video: {
                facingMode: 'user'
              }
            });
            this.hasLocalVideo = true;
          } catch (basicErr: any) {
            logger.warn("[CallService] Video stream failed completely, falling back to audio stream", basicErr);
            this.classifyMediaError(basicErr, 'video');
            this.localStream = await navigator.mediaDevices.getUserMedia({
              audio: audioConstraints
            });
            this.hasLocalVideo = false;
          }
        }
      } else {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints
        });
        this.hasLocalVideo = false;
      }

      return this.localStream;
    } catch (e: any) {
      logger.error("Failed to get local stream", e);
      this.classifyMediaError(e, type);
      throw e;
    }
  }

  private classifyMediaError(err: any, type: 'audio' | 'video') {
    if (!err) return;
    const name = err.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      this.lastMediaError = `${type === 'video' ? 'Camera' : 'Microphone'} permission was denied. Please allow access in settings.`;
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      this.lastMediaError = `No ${type === 'video' ? 'camera' : 'microphone'} hardware found on this device.`;
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      this.lastMediaError = `${type === 'video' ? 'Camera' : 'Microphone'} is currently in use by another app.`;
    } else if (name === 'OverconstrainedError') {
      this.lastMediaError = `Requested ${type} hardware constraints are not supported.`;
    } else {
      this.lastMediaError = err.message || `Could not access ${type} device.`;
    }
  }

  getAudioLevel(type: 'local' | 'remote' = 'local'): number {
    const analyzer = type === 'local' ? this.analyzer : this.remoteAnalyzer;
    const dataArray = type === 'local' ? this.dataArray : this.remoteDataArray;
    
    if (!analyzer || !dataArray) return 0;
    analyzer.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length;
  }

  setupAudioMonitoring(stream: MediaStream, type: 'local' | 'remote' = 'local') {
    try {
      if (!stream || stream.getAudioTracks().length === 0) {
        return;
      }
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      
      if (type === 'local') {
        if (this.localAudioSource) {
          try { this.localAudioSource.disconnect(); } catch (e) {}
        }
        const source = this.audioContext.createMediaStreamSource(stream);
        const analyzer = this.audioContext.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        this.localAudioSource = source;
        this.analyzer = analyzer;
        this.dataArray = new Uint8Array(analyzer.frequencyBinCount);
      } else {
        if (this.remoteAudioSource) {
          try { this.remoteAudioSource.disconnect(); } catch (e) {}
        }
        const source = this.audioContext.createMediaStreamSource(stream);
        const analyzer = this.audioContext.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        this.remoteAudioSource = source;
        this.remoteAnalyzer = analyzer;
        this.remoteDataArray = new Uint8Array(analyzer.frequencyBinCount);
      }
    } catch (e) {
      logger.warn(`Audio monitoring (${type}) failed to initialize`, e);
    }
  }

  public resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  private optimizeOpusSdp(sdp: string): string {
    if (!sdp) return sdp;
    // Inject Opus FEC (Forward Error Correction), DTX, and mono speech parameters
    return sdp.replace(/a=rtpmap:(\d+)\s+opus\/48000\/2/gi, (match, pt) => {
      const fmtpRegex = new RegExp(`a=fmtp:${pt}\\s+([^\\r\\n]*)`, 'i');
      if (fmtpRegex.test(sdp)) {
        return match;
      }
      return `${match}\r\na=fmtp:${pt} minptime=10;useinbandfec=1;usedtx=1;stereo=0;sprop-stereo=0;maxaveragebitrate=40000`;
    }).replace(/(a=fmtp:(\d+)\s+)([^\\r\\n]*)/gi, (match, prefix, pt, params) => {
      if (sdp.includes(`a=rtpmap:${pt} opus/48000/2`)) {
        let p = params;
        if (!p.includes('useinbandfec=1')) p += ';useinbandfec=1';
        if (!p.includes('usedtx=1')) p += ';usedtx=1';
        if (!p.includes('stereo=0')) p += ';stereo=0';
        if (!p.includes('sprop-stereo=0')) p += ';sprop-stereo=0';
        if (!p.includes('maxaveragebitrate=')) p += ';maxaveragebitrate=40000';
        return `${prefix}${p}`;
      }
      return match;
    });
  }

  private setupNegotiationListener(db: any) {
    if (!this.peerConnection || !this.callId) return;

    this.peerConnection.onnegotiationneeded = async () => {
      try {
        if (!this.callId || !this.peerConnection) return;
        if (this.peerConnection.signalingState !== 'stable') return;
        this.makingOffer = true;
        const offer = await this.peerConnection.createOffer();
        if (this.peerConnection.signalingState !== 'stable') return;
        const optimizedOffer = {
          type: offer.type,
          sdp: this.optimizeOpusSdp(offer.sdp || '')
        };
        await this.peerConnection.setLocalDescription(optimizedOffer);

        const sigDoc = doc(db, 'calls', this.callId, 'signaling', 'renegotiation');
        await setDoc(sigDoc, {
          offer: optimizedOffer,
          from: this.role,
          version: Date.now()
        }, { merge: true });
      } catch (err) {
        logger.warn("[WebRTC Renegotiation] onnegotiationneeded error:", err);
      } finally {
        this.makingOffer = false;
      }
    };

    // Listen to renegotiation signals
    const sigDoc = doc(db, 'calls', this.callId, 'signaling', 'renegotiation');
    this.renegotiationUnsub = onSnapshot(sigDoc, async (snap) => {
      if (!snap.exists() || !this.peerConnection) return;
      const data = snap.data();
      if (!data || data.from === this.role) return;

      if (data.offer && !data.answer) {
        const offerCollision = this.makingOffer || this.peerConnection.signalingState !== 'stable';
        const isPolite = this.role === 'receiver';

        if (offerCollision) {
          if (!isPolite) {
            logger.info("[WebRTC Renegotiation] Impolite collision: ignoring remote offer");
            return;
          }
          logger.info("[WebRTC Renegotiation] Polite collision: rolling back local description");
          try {
            await this.peerConnection.setLocalDescription({ type: 'rollback' });
          } catch (e) {}
        }

        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await this.peerConnection.createAnswer();
          const optimizedAnswer = {
            type: answer.type,
            sdp: this.optimizeOpusSdp(answer.sdp || '')
          };
          await this.peerConnection.setLocalDescription(optimizedAnswer);

          await updateDoc(sigDoc, {
            answer: optimizedAnswer,
            answerFrom: this.role,
            answeredAt: Date.now()
          });
        } catch (err) {
          logger.error("[WebRTC Renegotiation] Error processing remote offer:", err);
        }
      } else if (data.answer && data.answerFrom !== this.role) {
        if (this.peerConnection.signalingState === 'have-local-offer') {
          try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          } catch (err) {
            logger.error("[WebRTC Renegotiation] Error applying remote answer:", err);
          }
        }
      }
    });
  }

  private setupPeerConnection(db: any, iceServers: RTCIceServer[], onRemoteStream: (stream: MediaStream) => void) {
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch (e) {}
      this.peerConnection = null;
    }

    this.peerConnection = new RTCPeerConnection({ 
      iceServers,
      iceCandidatePoolSize: 2
    });
    this.onRemoteStreamCallback = onRemoteStream;
    this.remoteStream = new MediaStream();

    // Pre-negotiate both audio and video transceivers so that camera toggling does not fail
    const audioTrack = this.localStream?.getAudioTracks()[0] || null;
    const videoTrack = this.localStream?.getVideoTracks()[0] || null;

    if (audioTrack) {
      this.audioTransceiver = this.peerConnection.addTransceiver(audioTrack, {
        direction: 'sendrecv',
        streams: this.localStream ? [this.localStream] : []
      });
    } else {
      this.audioTransceiver = this.peerConnection.addTransceiver('audio', {
        direction: 'sendrecv'
      });
    }

    if (videoTrack) {
      this.videoTransceiver = this.peerConnection.addTransceiver(videoTrack, {
        direction: 'sendrecv',
        streams: this.localStream ? [this.localStream] : []
      });
    } else {
      this.videoTransceiver = this.peerConnection.addTransceiver('video', {
        direction: 'sendrecv'
      });
    }

    this.peerConnection.ontrack = (event) => {
      logger.info("[WebRTC] Remote track received:", event.track.kind, event.track.id);
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(track => {
          if (!this.remoteStream!.getTracks().some(t => t.id === track.id)) {
            logger.info("[WebRTC] Adding bundled track:", track.kind, track.id);
            this.remoteStream!.addTrack(track);
          }
        });
      }

      if (!this.remoteStream.getTracks().some(t => t.id === event.track.id)) {
        this.remoteStream.addTrack(event.track);
      }

      const audioCount = this.remoteStream.getAudioTracks().length;
      const videoCount = this.remoteStream.getVideoTracks().length;
      logger.info(`[WebRTC] Remote stream active tracks -> Audio: ${audioCount}, Video: ${videoCount}`);

      onRemoteStream(new MediaStream(this.remoteStream.getTracks()));

      event.track.onunmute = () => {
        logger.info("[WebRTC] Remote track unmuted:", event.track.kind, event.track.id);
        if (this.remoteStream) {
          onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
        }
      };

      event.track.onmute = () => {
        logger.info("[WebRTC] Remote track muted:", event.track.kind, event.track.id);
        if (this.remoteStream) {
          onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
        }
      };

      event.track.onended = () => {
        logger.info("[WebRTC] Remote track ended:", event.track.kind, event.track.id);
        if (this.remoteStream) {
          try { this.remoteStream.removeTrack(event.track); } catch (e) {}
          onRemoteStream(new MediaStream(this.remoteStream.getTracks()));
        }
      };
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && this.callId) {
        this.outgoingCandidateBuffer.push({
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });

        // Fast batching: flush within 50ms or when 2 candidates accumulate
        if (this.outgoingCandidateBuffer.length >= 2) {
          this.flushCandidates(db);
        } else if (!this.candidateFlushTimer) {
          this.candidateFlushTimer = setTimeout(() => this.flushCandidates(db), 50);
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      logger.info("[WebRTC] Connection state:", state);
      if (state === 'connected') {
        this.notifyConnectionState('connected');
        if (this.callId && !this.isSafeMode) {
          updateDoc(doc(db, 'calls', this.callId), { status: 'ongoing' }).catch(() => {});
          this.startHeartbeat(db);
        }
      } else if (state === 'connecting') {
        this.notifyConnectionState('connecting');
      } else if (state === 'disconnected') {
        this.notifyConnectionState('reconnecting', 'Connection temporarily lost');
        logger.warn("[WebRTC] Connection disconnected, attempting to reconnect...");
        if (this.callId) {
          updateDoc(doc(db, 'calls', this.callId), { status: 'reconnecting' }).catch(() => {});
        }
      } else if (state === 'failed') {
        logger.warn("[WebRTC] Connection failed, attempting ICE restart before closing...");
        this.notifyConnectionState('failed', 'Direct media connection failed');
        try {
          if (typeof (this.peerConnection as any)?.restartIce === 'function') {
            (this.peerConnection as any).restartIce();
          }
        } catch (e) {}
      } else if (state === 'closed') {
        this.notifyConnectionState('ended');
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      logger.info("[WebRTC] ICE Connection state:", state);
      if (state === 'connected' || state === 'completed') {
        this.notifyConnectionState('connected');
      } else if (state === 'disconnected') {
        this.notifyConnectionState('reconnecting');
      } else if (state === 'failed') {
        logger.warn("[WebRTC] ICE connection failed, attempting ICE restart");
        this.notifyConnectionState('failed', 'Media relay failed to connect');
        try {
          if (typeof (this.peerConnection as any)?.restartIce === 'function') {
            (this.peerConnection as any).restartIce();
          }
        } catch (restartErr) {
          logger.error("[WebRTC] ICE restart failed:", restartErr);
        }
      }
    };

    // Resilient network listeners with 15s offline recovery grace period
    if (this.handleOffline) window.removeEventListener('offline', this.handleOffline);
    if (this.handleOnline) window.removeEventListener('online', this.handleOnline);

    this.handleOffline = () => {
      logger.warn("[WebRTC] Network temporarily offline. Setting reconnecting grace period (15s)...");
      this.notifyConnectionState('reconnecting', 'Device offline');
      if (this.callId && db) {
        updateDoc(doc(db, 'calls', this.callId), { status: 'reconnecting' }).catch(() => {});
      }
      if (this.networkOfflineTimer) clearTimeout(this.networkOfflineTimer);
      this.networkOfflineTimer = setTimeout(() => {
        if (!navigator.onLine) {
          logger.warn("[WebRTC] Network remained offline for >15s. Terminating call.");
          if (this.callId && db) {
            this.updateStatus(db, this.callId, 'ended');
          }
          this.cleanup();
        }
      }, 15000);
    };

    this.handleOnline = () => {
      logger.info("[WebRTC] Network back online! Resuming connection and clearing offline timer.");
      if (this.networkOfflineTimer) {
        clearTimeout(this.networkOfflineTimer);
        this.networkOfflineTimer = null;
      }
      if (this.callId && db && this.peerConnection?.connectionState === 'connected') {
        updateDoc(doc(db, 'calls', this.callId), { status: 'ongoing' }).catch(() => {});
      }
    };

    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('online', this.handleOnline);

    if (this.handleUnload) window.removeEventListener('beforeunload', this.handleUnload);
    this.handleUnload = () => {
      if (this.callId && db) {
        updateDoc(doc(db, 'calls', this.callId), { status: 'ended', updatedAt: serverTimestamp() }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', this.handleUnload);
  }

  async createCall(db: any, callerProfile: any, receiverProfile: any, conversationId: string, type: 'audio' | 'video', onRemoteStream: (stream: MediaStream) => void) {
    this.cleanup();
    this.role = 'caller';
    this.callId = `call_${Date.now()}_${callerProfile.id}`;
    this.notifyConnectionState('connecting', 'Acquiring camera and preparing encrypted offer...');
    
    if (!this.localStream) {
      await this.initLocalStream(type);
    }

    if (!callerProfile?.ownerUid || !receiverProfile?.ownerUid) {
      logger.error("[CallService] Identity sync failure:", { caller: callerProfile?.id, receiver: receiverProfile?.id });
      throw new Error("Could not connect to user. The Link could not be established.");
    }

    const iceServers = await this.getEffectiveIceServers();
    this.setupPeerConnection(db, iceServers, onRemoteStream);

    const rawOffer = await this.peerConnection!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });

    const offer = {
      type: rawOffer.type,
      sdp: this.optimizeOpusSdp(rawOffer.sdp || '')
    };

    const callRef = doc(db, 'calls', this.callId);
    await setDoc(callRef, {
      id: this.callId,
      callerId: callerProfile.id,
      receiverId: receiverProfile.id,
      callerUid: callerProfile.ownerUid || callerProfile.id,
      receiverUid: receiverProfile.ownerUid || receiverProfile.id,
      callerName: callerProfile.displayName || callerProfile.username || 'Unknown User',
      callerPhoto: callerProfile.photoURL || '',
      receiverName: receiverProfile.displayName || receiverProfile.username || 'Aeirmist User',
      receiverPhoto: receiverProfile.photoURL || '',
      participants: [callerProfile.ownerUid || callerProfile.id, receiverProfile.ownerUid || receiverProfile.id].filter(Boolean).sort(),
      status: 'calling',
      type,
      offer: { type: offer.type, sdp: offer.sdp },
      conversationId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    this.startCandidateListener(db);
    this.startCallListener(db);
    this.setupNegotiationListener(db);

    await this.peerConnection!.setLocalDescription(offer);
    await this.flushCandidates(db);

    return { callId: this.callId, stream: this.localStream };
  }

  async answerCall(db: any, callId: string, onRemoteStream: (stream: MediaStream) => void) {
    this.cleanup();
    this.role = 'receiver';
    this.callId = callId;
    this.notifyConnectionState('connecting', 'Connecting media streams...');
    
    const callRef = doc(db, 'calls', callId);
    const callSnap = await getDoc(callRef);
    if (!callSnap.exists()) throw new Error("Sync Error: Link not found.");
    
    const data = callSnap.data() as CallData;
    
    if (!this.localStream) {
      await this.initLocalStream(data.type);
    }

    const iceServers = await this.getEffectiveIceServers();
    this.setupPeerConnection(db, iceServers, onRemoteStream);

    this.startCandidateListener(db);
    this.startCallListener(db);
    this.setupNegotiationListener(db);

    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.offer!));
    await this.processBufferedCandidates();

    const rawAnswer = await this.peerConnection!.createAnswer();
    const answer = {
      type: rawAnswer.type,
      sdp: this.optimizeOpusSdp(rawAnswer.sdp || '')
    };
    await this.peerConnection!.setLocalDescription(answer);

    await updateDoc(callRef, {
      answer: { type: answer.type, sdp: answer.sdp },
      status: 'accepted',
      updatedAt: serverTimestamp()
    });

    await this.flushCandidates(db);

    return this.localStream;
  }

  private startCandidateListener(db: any) {
    if (!this.callId) return;
    
    const otherRole = this.role === 'caller' ? 'receiver' : 'caller';
    const targetDoc = doc(db, 'calls', this.callId, 'candidates', otherRole);
    const legacyDoc = doc(db, 'calls', this.callId, 'candidates', 'signaling');

    const handleCandidateSnapshot = (snap: any) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const candidates = data.candidates || [];
      
      candidates.forEach(async (cand: any) => {
        if (!cand || cand.from === this.role) return;
        if (!cand.candidate || typeof cand.candidate !== 'string') return;
        
        const candidateKey = `${cand.sdpMid ?? ''}_${cand.sdpMLineIndex ?? ''}_${cand.candidate}`;
        if (this.processedCandidateKeys.has(candidateKey)) return;
        this.processedCandidateKeys.add(candidateKey);

        const cleanCand: RTCIceCandidateInit = {
          candidate: cand.candidate,
          sdpMid: cand.sdpMid !== undefined && cand.sdpMid !== null ? String(cand.sdpMid) : undefined,
          sdpMLineIndex: cand.sdpMLineIndex !== undefined && cand.sdpMLineIndex !== null ? Number(cand.sdpMLineIndex) : undefined
        };

        if (cleanCand.sdpMid !== undefined || cleanCand.sdpMLineIndex !== undefined) {
          if (this.peerConnection?.remoteDescription && this.peerConnection.signalingState !== 'closed') {
            try {
              await this.peerConnection.addIceCandidate(cleanCand);
            } catch (e) {
              logger.warn("[WebRTC] addIceCandidate error ignored:", e);
            }
          } else {
            this.candidateBuffer.push(cleanCand);
          }
        }
      });
    };

    const unsubTarget = onSnapshot(targetDoc, handleCandidateSnapshot, err => {
      logger.warn("[WebRTC] Target candidate listener notice:", err);
    });

    const unsubLegacy = onSnapshot(legacyDoc, handleCandidateSnapshot, err => {
      logger.warn("[WebRTC] Legacy candidate listener notice:", err);
    });

    this.candidateUnsub = () => {
      unsubTarget();
      unsubLegacy();
    };
  }

  private async processBufferedCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription || this.peerConnection.signalingState === 'closed') return;
    const queued = [...this.candidateBuffer];
    this.candidateBuffer = [];
    for (const cand of queued) {
      if (cand && cand.candidate) {
        try {
          await this.peerConnection.addIceCandidate(cand);
        } catch (e) {
          logger.warn("Error adding buffered ICE candidate", e);
        }
      }
    }
  }

  private startCallListener(db: any) {
    if (!this.callId) return;
    this.callUnsub = onSnapshot(doc(db, 'calls', this.callId), async (snap) => {
      const data = snap.data() as CallData | undefined;
      if (!data) return;

      if (this.role === 'caller' && (data.status === 'accepted' || data.status === 'ongoing') && data.answer && !this.peerConnection?.remoteDescription) {
        try {
          if (this.peerConnection.signalingState === 'have-local-offer') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            await this.processBufferedCandidates();
          }
        } catch (err) {
          logger.error("[WebRTC] Error setting remote answer description:", err);
        }
      }

      if (['ended', 'rejected', 'missed', 'busy'].includes(data.status)) {
        if (this.role === 'caller') {
          this.logHistory(db, data);
        }
        // Write call history entry to conversation chat
        this.logCallToChat(db, data, data.duration || 0, data.status);
        
        if (this.callId && this.role === 'caller') {
          const cid = this.callId;
          setTimeout(() => {
            deleteDoc(doc(db, 'calls', cid, 'candidates', 'caller')).catch(() => {});
            deleteDoc(doc(db, 'calls', cid, 'candidates', 'receiver')).catch(() => {});
            deleteDoc(doc(db, 'calls', cid, 'candidates', 'signaling')).catch(() => {});
            deleteDoc(doc(db, 'calls', cid)).catch(() => {});
          }, 8000);
        }
        this.notifyConnectionState('ended');
        this.cleanup();
      }
    });
  }

  async updateStatus(db: any, callId: string, status: CallStatus, duration?: number) {
    if (this.isSafeMode && status !== 'ended') return; // Only allow ending calls in safe mode
    const callRef = doc(db, 'calls', callId);
    const updatePayload: any = { 
      status,
      updatedAt: serverTimestamp()
    };
    if (duration !== undefined && duration !== null) {
      updatePayload.duration = duration;
    }
    if (['ended', 'rejected', 'missed', 'busy'].includes(status)) {
      updatePayload.endedAt = serverTimestamp();
      updatePayload.endedBy = this.role || 'unknown';
    }
    await updateDoc(callRef, updatePayload).catch(err => {
      logger.warn("[CallService] updateStatus failed:", err);
    });

    if (['ended', 'rejected', 'missed', 'busy'].includes(status)) {
      try {
        const snap = await getDoc(callRef);
        if (snap.exists()) {
          const data = snap.data() as CallData;
          await this.logCallToChat(db, data, duration !== undefined ? duration : (data.duration || 0), status);
        }
      } catch (e) {
        logger.warn("[CallService] Error fetching call data for chat log:", e);
      }
    }
  }

  public async logCallToChat(db: any, data: CallData, duration: number = 0, finalStatus: CallStatus = 'ended') {
    if (!db || !data || !data.id) return;
    
    // Determine the conversation ID
    let convId = data.conversationId;
    if (!convId && data.callerId && data.receiverId) {
      convId = [data.callerId, data.receiverId].sort().join('_');
    }
    if (!convId) return;

    try {
      const callDurationSecs = duration || data.duration || 0;
      const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      };

      let textSummary = '';
      const isVideo = data.type === 'video';
      const callTypeLabel = isVideo ? 'Video call' : 'Audio call';
      
      if (finalStatus === 'missed') {
        textSummary = `Missed ${callTypeLabel.toLowerCase()}`;
      } else if (finalStatus === 'rejected' || finalStatus === 'busy') {
        textSummary = `${callTypeLabel} declined`;
      } else {
        textSummary = callDurationSecs > 0 
          ? `${callTypeLabel} (${formatTime(callDurationSecs)})` 
          : `${callTypeLabel} ended`;
      }

      const messageDocId = `call_${data.id}`;
      const msgRef = doc(db, 'conversations', convId, 'messages', messageDocId);

      // Check if message already exists with this exact deterministic doc ID
      const msgSnap = await getDoc(msgRef);
      if (msgSnap.exists()) {
        const existingData = msgSnap.data();
        if ((existingData.callDetails?.duration || 0) < callDurationSecs || existingData.callDetails?.status !== finalStatus) {
          await updateDoc(msgRef, {
            text: textSummary,
            'metadata.duration': callDurationSecs,
            'metadata.status': finalStatus,
            'callDetails.duration': callDurationSecs,
            'callDetails.status': finalStatus,
            duration: callDurationSecs
          }).catch(() => {});
        }
        return;
      }

      const messagePayload = {
        id: messageDocId,
        text: textSummary,
        senderId: data.callerId,
        type: 'call_history',
        status: 'sent',
        duration: callDurationSecs,
        callDetails: {
          callId: data.id,
          type: data.type,
          status: finalStatus,
          duration: callDurationSecs,
          callerId: data.callerId,
          receiverId: data.receiverId,
          endedBy: this.role || 'unknown'
        },
        metadata: {
          type: 'call_history',
          callId: data.id,
          callType: data.type,
          status: finalStatus,
          duration: callDurationSecs,
          callerId: data.callerId,
          receiverId: data.receiverId,
          callerName: data.callerName || '',
          receiverName: data.receiverName || ''
        },
        deliveredTo: [data.callerId, data.receiverId].filter(Boolean),
        seenBy: [data.callerId].filter(Boolean),
        timestamp: serverTimestamp(),
        timestampMs: Date.now(),
        createdAt: serverTimestamp()
      };

      await setDoc(msgRef, messagePayload, { merge: true });

      // Update conversation's preview and timestamp
      const convRef = doc(db, 'conversations', convId);
      await updateDoc(convRef, {
        latestMessageAt: serverTimestamp(),
        latestMessageAtMs: Date.now(),
        latestMessageId: messageDocId,
        latestMessageSenderId: data.callerId,
        latestMessagePreview: textSummary,
        lastMessage: {
          text: textSummary,
          senderId: data.callerId,
          type: 'call_history',
          timestamp: serverTimestamp(),
          timestampMs: Date.now(),
          metadata: {
            type: 'call_history',
            callType: data.type,
            status: finalStatus,
            duration: callDurationSecs
          }
        }
      }).catch(err => {
        logger.warn("[CallService] Error updating conversation preview for call log:", err);
      });
      
      logger.info(`[CallService] Call history logged to conversation ${convId}: ${textSummary}`);
    } catch (err) {
      logger.error("[CallService] Failed to log call history to chat:", err);
    }
  }

  private async flushCandidates(db: any) {
    if (!this.callId || this.outgoingCandidateBuffer.length === 0) return;
    const candidates = [...this.outgoingCandidateBuffer];
    this.outgoingCandidateBuffer = [];
    if (this.candidateFlushTimer) {
      clearTimeout(this.candidateFlushTimer);
      this.candidateFlushTimer = null;
    }
    
    try {
      const candidatesWithMetadata = candidates.map(c => ({
        candidate: c.candidate,
        sdpMid: c.sdpMid !== undefined && c.sdpMid !== null ? String(c.sdpMid) : null,
        sdpMLineIndex: c.sdpMLineIndex !== undefined && c.sdpMLineIndex !== null ? Number(c.sdpMLineIndex) : null,
        from: this.role,
        sentAt: Date.now()
      }));

      // Role-specific subdocument for contention-free candidate transport
      if (this.role) {
        const roleDoc = doc(db, 'calls', this.callId, 'candidates', this.role);
        await setDoc(roleDoc, {
          candidates: arrayUnion(...candidatesWithMetadata)
        }, { merge: true });
      }

      // Legacy fallback document
      const legacyDoc = doc(db, 'calls', this.callId, 'candidates', 'signaling');
      await setDoc(legacyDoc, {
        candidates: arrayUnion(...candidatesWithMetadata)
      }, { merge: true }).catch(() => {});
    } catch (e) {
      logger.warn("Failed to flush candidates, re-queuing:", e);
      this.outgoingCandidateBuffer.push(...candidates);
    }
  }

  private async logHistory(db: any, data: CallData) {
    try {
      const historyCol = collection(db, 'callHistory');
      await addDoc(historyCol, {
        id: data.id,
        callerId: data.callerId,
        receiverId: data.receiverId,
        callerName: data.callerName,
        callerPhoto: data.callerPhoto,
        receiverName: data.receiverName,
        receiverPhoto: data.receiverPhoto,
        type: data.type,
        status: data.status,
        duration: data.duration || 0,
        participants: [data.callerUid, data.receiverUid],
        timestamp: serverTimestamp()
      });
    } catch (e) {
      logger.error("Failed to log call history", e);
    }
  }

  public cleanup() {
    this.candidateUnsub?.();
    this.callUnsub?.();
    this.renegotiationUnsub?.();
    this.renegotiationUnsub = null;
    this.audioTransceiver = null;
    this.videoTransceiver = null;
    this.makingOffer = false;
    this.isSettingRemoteAnswerPending = false;
    this.candidateBuffer = [];
    this.processedCandidateKeys.clear();
    
    if (this.candidateFlushTimer) {
        clearTimeout(this.candidateFlushTimer);
        this.candidateFlushTimer = null;
    }
    this.outgoingCandidateBuffer = [];
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localAudioSource) {
      try { this.localAudioSource.disconnect(); } catch (e) {}
      this.localAudioSource = null;
    }
    if (this.remoteAudioSource) {
      try { this.remoteAudioSource.disconnect(); } catch (e) {}
      this.remoteAudioSource = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.remoteStream) {
      try {
        this.remoteStream.getTracks().forEach(track => track.stop());
      } catch (e) {
        logger.warn("Error stopping remote stream tracks:", e);
      }
      this.remoteStream = null;
    }
    this.releaseWakeLock();
    this.endMediaSession();
    this.stopHeartbeat();
    if (this.handleOffline) {
      window.removeEventListener('offline', this.handleOffline);
      this.handleOffline = null;
    }
    if (this.handleOnline) {
      window.removeEventListener('online', this.handleOnline);
      this.handleOnline = null;
    }
    if (this.handleUnload) {
      window.removeEventListener('beforeunload', this.handleUnload);
      this.handleUnload = null;
    }
    if (this.networkOfflineTimer) {
      clearTimeout(this.networkOfflineTimer);
      this.networkOfflineTimer = null;
    }
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      try {
        (window as any).Capacitor.Plugins?.NativeSettings?.setAudioMode?.({ mode: 'normal', speaker: false });
      } catch (e) {}
    }
    this.callId = null;
    this.role = null;
    this.candidateUnsub = null;
    this.callUnsub = null;
    this.analyzer = null;
    this.remoteAnalyzer = null;
  }

  public async acquireWakeLock() {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        logger.info("[CallService] Screen WakeLock acquired for long duration call");
      }
    } catch (e) {
      logger.warn("[CallService] WakeLock request error:", e);
    }
  }

  public releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release().catch(() => {});
      } catch (e) {}
      this.wakeLock = null;
    }
  }

  public setupMediaSession(remoteName: string = 'Aeirmist User', onHangup?: () => void) {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Aeirmist Encrypted Call',
          artist: remoteName,
          album: 'Secure P2P Voice & Video'
        });
        if (onHangup) {
          (navigator.mediaSession as any).setActionHandler('hangup', onHangup);
        }
      } catch (e) {
        logger.warn("[CallService] MediaSession setup error:", e);
      }
    }
  }

  public endMediaSession() {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
        (navigator.mediaSession as any).setActionHandler('hangup', null);
      } catch (e) {}
    }
  }

  public startHeartbeat(db: any) {
    this.stopHeartbeat();
    if (!this.callId || !db) return;
    this.heartbeatInterval = setInterval(() => {
      if (this.callId && this.peerConnection && (this.peerConnection.connectionState === 'connected' || this.peerConnection.iceConnectionState === 'connected')) {
        const callRef = doc(db, 'calls', this.callId);
        updateDoc(callRef, {
          lastPing: serverTimestamp(),
          [`heartbeat_${this.role}`]: serverTimestamp()
        }).catch(() => {});
      }
    }, 20000);
  }

  public stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private facingMode: 'user' | 'environment' = 'user';

  async switchCamera(): Promise<MediaStream | null> {
    if (!this.localStream) return null;
    const currentVideoTrack = this.localStream.getVideoTracks()[0];
    if (!currentVideoTrack) return null;

    const targetFacing: 'user' | 'environment' = this.facingMode === 'user' ? 'environment' : 'user';
    logger.info(`[CallService] Switching camera from ${this.facingMode} to ${targetFacing}`);

    let devices: MediaDeviceInfo[] = [];
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        devices = await navigator.mediaDevices.enumerateDevices();
      }
    } catch (e) {
      logger.warn("[CallService] enumerateDevices error:", e);
    }

    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    const candidateConstraints: MediaTrackConstraints[] = [];

    if (targetFacing === 'environment') {
      const rearDevice = videoDevices.find(d => /back|rear|environment/i.test(d.label));
      if (rearDevice && rearDevice.deviceId) {
        candidateConstraints.push({
          deviceId: { exact: rearDevice.deviceId },
          width: { ideal: 960, max: 1280 },
          height: { ideal: 540, max: 720 },
          frameRate: { ideal: 24, max: 30 }
        });
      }
      candidateConstraints.push({
        facingMode: { ideal: 'environment' },
        width: { ideal: 960, max: 1280 },
        height: { ideal: 540, max: 720 },
        frameRate: { ideal: 24, max: 30 }
      });
      candidateConstraints.push({
        facingMode: 'environment',
        width: { ideal: 960, max: 1280 },
        height: { ideal: 540, max: 720 }
      });
    } else {
      const frontDevice = videoDevices.find(d => /front|user|facing/i.test(d.label));
      if (frontDevice && frontDevice.deviceId) {
        candidateConstraints.push({
          deviceId: { exact: frontDevice.deviceId },
          width: { ideal: 960, max: 1280 },
          height: { ideal: 540, max: 720 },
          frameRate: { ideal: 24, max: 30 }
        });
      }
      candidateConstraints.push({
        facingMode: { ideal: 'user' },
        width: { ideal: 960, max: 1280 },
        height: { ideal: 540, max: 720 },
        frameRate: { ideal: 24, max: 30 }
      });
      candidateConstraints.push({
        facingMode: 'user',
        width: { ideal: 960, max: 1280 },
        height: { ideal: 540, max: 720 }
      });
    }
    candidateConstraints.push({ video: true } as any);

    let newStream: MediaStream | null = null;
    let newVideoTrack: MediaStreamTrack | null = null;

    // Phase 1: Attempt concurrent acquisition while keeping old track alive
    for (const constraints of candidateConstraints) {
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: constraints
        });
        const track = newStream.getVideoTracks()[0];
        if (track && track.readyState === 'live') {
          newVideoTrack = track;
          break;
        }
      } catch (err: any) {
        logger.warn("[CallService] Camera switch candidate failed:", constraints, err?.name || err);
      }
    }

    // Phase 2: If concurrent acquisition was locked by Android camera hardware, stop old track and retry
    if (!newVideoTrack) {
      logger.info("[CallService] Concurrent camera access locked, stopping previous track before retry...");
      currentVideoTrack.stop();
      for (const constraints of candidateConstraints) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: constraints
          });
          const track = newStream.getVideoTracks()[0];
          if (track && track.readyState === 'live') {
            newVideoTrack = track;
            break;
          }
        } catch (err: any) {
          logger.warn("[CallService] Sequential camera candidate failed:", constraints, err?.name || err);
        }
      }
    }

    // Phase 3: Fallback recovery — if target camera failed, attempt restoring original camera
    if (!newVideoTrack) {
      logger.error("[CallService] Could not switch to target camera. Restoring original camera orientation...");
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.facingMode }
        });
        newVideoTrack = fallbackStream.getVideoTracks()[0] || null;
      } catch (fallbackErr) {
        logger.error("[CallService] Camera restore failed:", fallbackErr);
      }
    }

    if (!newVideoTrack) {
      logger.error("[CallService] All camera acquisition attempts exhausted.");
      return new MediaStream(this.localStream.getTracks());
    }

    // Successfully acquired new track! Update facingMode state
    this.facingMode = targetFacing;

    // Transceiver / sender update
    if (this.videoTransceiver?.sender) {
      await this.videoTransceiver.sender.replaceTrack(newVideoTrack);
      try {
        const params = this.videoTransceiver.sender.getParameters();
        if (params.encodings && params.encodings.length > 0) {
          params.encodings[0].maxBitrate = 1200000;
          await this.videoTransceiver.sender.setParameters(params);
        }
      } catch (e) {}
    } else {
      const sender = this.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
    }

    // Clean up old track and attach new track
    if (currentVideoTrack !== newVideoTrack) {
      this.localStream.removeTrack(currentVideoTrack);
      currentVideoTrack.stop();
    }
    if (!this.localStream.getVideoTracks().some(t => t.id === newVideoTrack!.id)) {
      this.localStream.addTrack(newVideoTrack);
    }
    
    logger.info(`[CallService] Camera switch successfully completed to ${this.facingMode}`);
    return new MediaStream(this.localStream.getTracks());
  }

  async toggleVideo(enabled: boolean): Promise<MediaStream | null> {
    if (!this.localStream) return null;
    const videoTracks = this.localStream.getVideoTracks();

    if (enabled) {
      let track = videoTracks[0];
      if (!track || track.readyState === 'ended') {
        try {
          await ensureCallPermissions('video');
          const vStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: this.facingMode,
              width: { ideal: 960, max: 1280 },
              height: { ideal: 540, max: 720 },
              frameRate: { ideal: 24, max: 30 }
            }
          });
          track = vStream.getVideoTracks()[0];
          if (videoTracks[0]) {
            this.localStream.removeTrack(videoTracks[0]);
            videoTracks[0].stop();
          }
          this.localStream.addTrack(track);
        } catch (e: any) {
          logger.error("Failed to acquire camera track on toggle", e);
          this.classifyMediaError(e, 'video');
          return null;
        }
      } else {
        track.enabled = true;
      }

      this.hasLocalVideo = true;
      if (this.videoTransceiver?.sender) {
        await this.videoTransceiver.sender.replaceTrack(track);
        this.videoTransceiver.direction = 'sendrecv';
        try {
          const params = this.videoTransceiver.sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].maxBitrate = 1200000;
            await this.videoTransceiver.sender.setParameters(params);
          }
        } catch (e) {}
      } else if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(track);
        } else {
          this.peerConnection.addTrack(track, this.localStream);
        }
      }
    } else {
      videoTracks.forEach(t => {
        t.stop();
        this.localStream?.removeTrack(t);
      });
      this.hasLocalVideo = false;
      if (this.videoTransceiver?.sender) {
        await this.videoTransceiver.sender.replaceTrack(null);
      } else if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(null);
        }
      }
    }

    return new MediaStream(this.localStream.getTracks());
  }

  toggleAudio(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach(t => t.enabled = enabled);
  }

  private screenTrack: MediaStreamTrack | null = null;

  async startScreenShare(screenStream: MediaStream) {
    const screenVideoTrack = screenStream.getVideoTracks()[0];
    if (!screenVideoTrack) return;
    this.screenTrack = screenVideoTrack;

    if (this.peerConnection) {
      const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenVideoTrack);
      } else {
        this.peerConnection.addTrack(screenVideoTrack, screenStream);
      }
    }
  }

  async stopScreenShare() {
    if (this.screenTrack) {
      this.screenTrack.stop();
      this.screenTrack = null;
    }
    if (this.peerConnection && this.localStream) {
      const cameraTrack = this.localStream.getVideoTracks()[0];
      const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender && cameraTrack) {
        await sender.replaceTrack(cameraTrack);
      }
    }
  }

  public async getDiagnostics() {
    let statsData: any = {};
    if (this.peerConnection) {
      try {
        const report = await this.peerConnection.getStats();
        report.forEach((stat: any) => {
          if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
            statsData.audioPacketsReceived = stat.packetsReceived;
            statsData.audioPacketsLost = stat.packetsLost;
            statsData.audioJitter = stat.jitter;
            statsData.audioLevel = stat.audioLevel;
          } else if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            statsData.videoPacketsReceived = stat.packetsReceived;
            statsData.videoPacketsLost = stat.packetsLost;
            statsData.videoFramesDecoded = stat.framesDecoded;
          } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
            statsData.currentRoundTripTime = stat.currentRoundTripTime;
            statsData.selectedCandidatePairId = stat.id;
          }
        });
      } catch (e) {}
    }

    return {
      callId: this.callId,
      role: this.role,
      connectionState: this.getConnectionState(),
      signalingState: this.peerConnection?.signalingState || 'none',
      iceConnectionState: this.peerConnection?.iceConnectionState || 'none',
      senders: this.peerConnection?.getSenders().map(s => ({
        kind: s.track?.kind || 'empty',
        enabled: s.track?.enabled,
        readyState: s.track?.readyState
      })) || [],
      receivers: this.peerConnection?.getReceivers().map(r => ({
        kind: r.track?.kind || 'empty',
        enabled: r.track?.enabled,
        readyState: r.track?.readyState
      })) || [],
      localAudioTrack: this.localStream?.getAudioTracks().map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled })) || [],
      localVideoTrack: this.localStream?.getVideoTracks().map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled })) || [],
      remoteAudioTrack: this.remoteStream?.getAudioTracks().map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled })) || [],
      remoteVideoTrack: this.remoteStream?.getVideoTracks().map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled })) || [],
      stats: statsData
    };
  }

  getStreams() {
    return { local: this.localStream, remote: this.remoteStream };
  }
}

export const aeirmistCall = new CallService();

