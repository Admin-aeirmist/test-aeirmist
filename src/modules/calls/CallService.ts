import { logger } from '@/src/utils/logger';
import { getEffectiveIceServers as fetchIceServers, DEFAULT_STUN_SERVERS } from './IceServerConfig';
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

      // Proactively trigger native Android OS permissions dialog if on Android APK
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        try {
          const plugins = (window as any).Capacitor.Plugins;
          if (plugins?.NativeSettings?.requestAllPermissions) {
            await plugins.NativeSettings.requestAllPermissions();
          }
        } catch (e) {
          logger.warn("Native permission check in CallService ignored", e);
        }
      }

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };

      if (type === 'video') {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: {
              facingMode: 'user',
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            }
          });
          this.hasLocalVideo = true;
        } catch (videoErr: any) {
          logger.warn("[CallService] Preferred 720p user video constraints failed, trying basic video constraints", videoErr);
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              audio: audioConstraints,
              video: true
            });
            this.hasLocalVideo = true;
          } catch (basicErr: any) {
            logger.warn("[CallService] Video stream failed completely, falling back to audio stream", basicErr);
            this.lastMediaError = basicErr?.message || "Camera access failed";
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
      this.lastMediaError = e?.message || "Failed to access microphone/camera";
      throw e;
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

    this.localStream?.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    const offer = await this.peerConnection!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: type === 'video'
    });

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

    this.localStream?.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    this.startCandidateListener(db);
    this.startCallListener(db);

    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.offer!));
    await this.processBufferedCandidates();

    const answer = await this.peerConnection!.createAnswer();
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
        
        if (this.callId && this.role === 'caller') {
          const cid = this.callId;
          setTimeout(() => {
            deleteDoc(doc(db, 'calls', cid, 'candidates', 'caller')).catch(() => {});
            deleteDoc(doc(db, 'calls', cid, 'candidates', 'receiver')).catch(() => {});
            deleteDoc(doc(db, 'calls', cid, 'candidates', 'signaling')).catch(() => {});
            deleteDoc(doc(db, 'calls', cid)).catch(() => {});
          }, 5000);
        }
        this.notifyConnectionState('ended');
        this.cleanup();
      }
    });
  }

  async updateStatus(db: any, callId: string, status: CallStatus) {
    if (this.isSafeMode && status !== 'ended') return; // Only allow ending calls in safe mode
    const callRef = doc(db, 'calls', callId);
    await updateDoc(callRef, { 
      status,
      updatedAt: serverTimestamp()
    });
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

  async switchCamera() {
    if (!this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';

    let newStream: MediaStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: this.facingMode } }
      });
    } catch {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facingMode }
      });
    }

    const newVideoTrack = newStream.getVideoTracks()[0];
    if (!newVideoTrack) return;

    const sender = this.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    }

    this.localStream.removeTrack(videoTrack);
    videoTrack.stop();
    this.localStream.addTrack(newVideoTrack);
    
    return new MediaStream(this.localStream.getTracks());
  }

  async toggleVideo(enabled: boolean) {
    if (!this.localStream) return;
    const videoTracks = this.localStream.getVideoTracks();
    if (enabled && videoTracks.length === 0) {
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        });
        const track = vStream.getVideoTracks()[0];
        if (track) {
          this.localStream.addTrack(track);
          if (this.peerConnection) {
            const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(track);
            } else {
              this.peerConnection.addTrack(track, this.localStream);
            }
          }
        }
      } catch (e) {
        logger.error("Failed to acquire camera track on toggle", e);
      }
    } else {
      videoTracks.forEach(t => t.enabled = enabled);
    }
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

  getStreams() {
    return { local: this.localStream, remote: this.remoteStream };
  }
}

export const aeirmistCall = new CallService();

