import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getAvatarUrl } from '../../lib/avatar';
import { CameraTopBar } from '../camera/CameraTopBar';
import { MediaEditor } from '../camera/MediaEditor';
import { 
  X, 
  Zap, 
  ZapOff, 
  RefreshCcw, 
  Settings, 
  Music, 
  Sparkles, 
  FlipHorizontal, 
  Gauge, 
  Camera as CameraIcon, 
  Video, 
  Image as ImageIcon,
  Star,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Share,
  Plus,
  Loader2,
  Upload
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


export type CameraMode = 'STORY' | 'PHOTO' | 'VIDEO';

interface AeirmistCameraProps {
  onCapture: (file: File, mode: CameraMode) => void;
  onClose: () => void;
  initialMode?: CameraMode;
}

const FILTERS = [
  { id: 'NORMAL', name: 'ORIGINAL', filter: 'none', icon: 'auto_awesome' },
  { id: 'NIGHT_CHROME', name: 'NIGHT_CHROME', filter: 'contrast(1.2) brightness(1.1) saturate(1.4) hue-rotate(15deg)', icon: 'auto_awesome' },
  { id: 'NOIR_GRAIN', name: 'NOIR_GRAIN', filter: 'grayscale(1) contrast(1.5) brightness(0.8)', icon: 'grain' },
  { id: 'RETRO_GLARE', name: 'RETRO_GLARE', filter: 'sepia(0.3) saturate(1.2) contrast(1.1)', icon: 'filter_vintage' },
  { id: 'NEON_DREAM', name: 'NEON_DREAM', filter: 'hue-rotate(-45deg) saturate(1.8) brightness(1.2)', icon: 'bolt' },
];

export const AeirmistCamera: React.FC<AeirmistCameraProps> = ({ 
  onCapture, 
  onClose, 
  initialMode = 'PHOTO' 
}) => {
  const { user, profile, permissions, requestPermission, db, uploadMedia, addToast } = useAeirmist();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [mode, setMode] = useState<CameraMode>(initialMode);
  const [isFront, setIsFront] = useState(true);
  const [flash, setFlash] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentFilter, setCurrentFilter] = useState('NORMAL');
  const [isBeautyOn, setIsBeautyOn] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showPermissionsError, setShowPermissionsError] = useState(false);
  const [isHD, setIsHD] = useState(true);
  const [isCloseFriends, setIsCloseFriends] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ file: File; url: string; type: 'image' | 'video' } | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [isSavingStory, setIsSavingStory] = useState(false);

  const handleStorySave = async (blob: Blob) => {
    if (isSavingStory) return;
    setIsSavingStory(true);

    try {
      if (!user || !profile || !db) {
        throw new Error("Uplink failed. Missing authenticated profile session.");
      }

      addToast({
        title: "Uploading Reply",
        message: "Encrypting and uploading NGL story reply...",
        type: "info"
      });

      // 1. Create unique file name and upload File
      const file = new File([blob], `ngl_reply_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const finalMediaUrl = await uploadMedia(file, `users/${user.uid}/stories`);

      // 2. Fetch pending NGL reply details
      const pendingNGL = (window as any).__PENDING_NGL_REPLY;
      const ngl_message_id = pendingNGL?.id || '';
      const ngl_content = pendingNGL?.content || '';

      // 3. Construct Firestore Story Document
      const firebaseDoc = {
        userId: user.uid,
        userName: profile.username || profile.displayName || 'Anonymous Voyager',
        userAvatar: profile.photoURL || '',
        mediaUrl: finalMediaUrl,
        thumbnailUrl: '',
        mediaType: 'image',
        createdAt: serverTimestamp(),
        viewers: [],
        overlayText: ngl_content ? `Reply to: "${ngl_content}"` : '',
        textLayers: [],
        stickerLayers: [],
        hashtags: [],
        musicId: null,
        stickersCount: 1,
        filter: 'none',
        rotation: 0,
        scale: 1,
        flipX: false,
        brightness: 100,
        contrast: 100,
        mode: 'story',
        activeMusic: null,
        boomerangFrames: null,
        ngl_message_id,
        ngl_content
      };

      const docRef = await addDoc(collection(db, 'stories'), firebaseDoc);

      // 4. Update original NGL message status
      if (ngl_message_id) {
        const nglRef = doc(db, 'ngl_messages', ngl_message_id);
        await updateDoc(nglRef, {
          status: 'replied',
          storyReplyId: docRef.id,
          repliedAt: serverTimestamp()
        });
      }

      addToast({
        title: "Reply Transmitted",
        message: "Your NGL story reply was successfully broadcasted.",
        type: "success"
      });

      // Clear pending NGL
      (window as any).__PENDING_NGL_REPLY = null;

      // Close camera
      onClose();
    } catch (err: any) {
      logger.error("Story reply save failed:", err);
      addToast({
        title: "Upload Failed",
        message: "Could not publish your NGL reply.",
        type: "warning"
      });
    } finally {
      setIsSavingStory(false);
    }
  };

  const startCamera = useCallback(async () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    try {
      const constraints = {
        video: { 
          facingMode: isFront ? 'user' : 'environment',
          width: { ideal: isHD ? 1920 : 1280 },
          height: { ideal: isHD ? 1080 : 720 }
        },
        audio: mode === 'VIDEO'
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setShowPermissionsError(false);
    } catch (err: any) {
      logger.error("Camera failed:", err);
      setPermissionsError(err.message || "Permission denied");
      setShowPermissionsError(true);
    }
  }, [isFront, isHD, mode, stream]);

  useEffect(() => {
    if (permissions.camera.status === 'granted' && !stream) {
      if (showPermissionsError) {
        setShowPermissionsError(false);
      }
      startCamera();
    }
  }, [permissions.camera.status, startCamera, stream, showPermissionsError]);

  useEffect(() => {
    startCamera();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [isFront, isHD, mode]);

  const handleCapture = async () => {
    if (mode === 'PHOTO' || mode === 'STORY') {
      takePhoto();
    } else {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isFront) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    // Apply Filter to canvas
    const filterObj = FILTERS.find(f => f.id === currentFilter);
    if (filterObj && filterObj.filter !== 'none') {
      ctx.filter = filterObj.filter;
    }

    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `aura_${mode.toLowerCase()}_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPreviewMedia({
          file,
          url: URL.createObjectURL(file),
          type: 'image'
        });
      }
      setIsCapturing(false);
    }, 'image/jpeg', 0.95);
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm'
    });
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `aura_${mode.toLowerCase()}_${Date.now()}.webm`, { type: 'video/webm' });
      setPreviewMedia({
        file,
        url: URL.createObjectURL(file),
        type: 'video'
      });
      setIsRecording(false);
      setRecordingTime(0);
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewMedia({
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('video') ? 'video' : 'image'
      });
    }
  };

  const handleDownload = () => {
    if (!previewMedia) return;
    const link = document.createElement('a');
    link.href = previewMedia.url;
    link.download = previewMedia.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirm = () => {
    if (previewMedia) {
      onCapture(previewMedia.file, mode);
      onClose();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black overflow-hidden flex flex-col font-sans"
    >
      {/* Top Bar */}
      <CameraTopBar 
          onClose={onClose} 
          formatTime={formatTime} 
          recordingTime={recordingTime} 
          isRecording={isRecording}
          isHD={isHD}
          setIsHD={setIsHD}
      />

      {/* Main Viewfinder */}
      <div className="relative flex-1 bg-black flex items-center justify-center">
        {previewMedia ? (
          <div className="absolute inset-0 z-[1100] bg-black">
            {previewMedia.type === 'video' ? (
              <video 
                src={previewMedia.url} 
                className="w-full h-full object-cover" 
                autoPlay 
                muted 
                loop 
                playsInline
              />
            ) : (
              <img 
                src={previewMedia.url} 
                className="w-full h-full object-cover" 
                alt="Captured" 
              />
            )}

            {/* Preview HUD */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
            
            {mode === 'STORY' ? (
              <MediaEditor
                mediaUrl={previewMedia.url}
                mediaType={previewMedia.type}
                onClose={() => setPreviewMedia(null)}
                onSave={handleStorySave}
              />
            ) : (
              <>
                <div className="absolute top-[calc(2rem+var(--spacing-safe-top))] left-6 right-6 flex justify-between items-center z-[1110]">
                  <button 
                    onClick={() => setPreviewMedia(null)}
                    className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-all"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-aeirmist-cyan drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]">Review Digital Data</h2>
                  <button 
                    onClick={handleDownload}
                    className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-all"
                  >
                    <Download size={20} />
                  </button>
                </div>

                <div className="absolute bottom-[calc(3rem+var(--spacing-safe-bottom))] left-10 right-10 flex gap-4 z-[1110]">
                  <button 
                    onClick={() => setPreviewMedia(null)}
                    className="flex-1 py-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl text-white font-black uppercase tracking-[0.2em] text-[10px] hover:bg-white/10 transition-all"
                  >
                    Retake
                  </button>
                  <button 
                    onClick={handleConfirm}
                    className="flex-[2] py-5 rounded-3xl bg-aeirmist-cyan text-black font-black uppercase tracking-[0.2em] text-[10px] hover:bg-white transition-all shadow-[0_0_30px_rgba(0,242,255,0.4)] flex items-center justify-center gap-3"
                  >
                    Save
                    <Check size={16} strokeWidth={3} />
                  </button>
                </div>
              </>
            )}
          </div>
        ) : showPermissionsError ? (
          <div className="flex flex-col items-center gap-6 p-12 text-center">
              <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                <X size={40} />
              </div>
              <h2 className="text-xl font-display font-black uppercase tracking-widest text-white">Digital Sink Failed</h2>
              <p className="text-white/40 text-sm max-w-xs uppercase tracking-widest leading-loose">
                {permissionsError || permissions.camera.error || "Camera access blocked. Please enable optical sensors in your browser or device settings to re-sync."}
              </p>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button 
                  onClick={async () => {
                    const granted = await requestPermission('camera');
                    if (granted) startCamera();
                  }}
                  className="w-full px-8 py-4 rounded-2xl bg-white text-black font-black uppercase text-[10px] tracking-widest hover:bg-aeirmist-cyan transition-all"
                >
                  Sync Permissions
                </button>
                <label className="w-full cursor-pointer px-8 py-4 rounded-2xl bg-aeirmist-cyan/20 border border-aeirmist-cyan/30 text-aeirmist-cyan font-black uppercase text-[10px] tracking-widest hover:bg-aeirmist-cyan hover:text-black transition-all flex items-center justify-center gap-2">
                  <Upload size={12} /> Sync Local File
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setPreviewMedia({ file, url, type: 'image' });
                      }
                    }}
                    accept="image/*"
                  />
                </label>
                <button 
                  onClick={onClose}
                  className="w-full px-8 py-4 rounded-2xl bg-white/5 text-white/40 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all"
                >
                  Abort Mission
                </button>
              </div>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ filter: FILTERS.find(f => f.id === currentFilter)?.filter }}
              className={`w-full h-full object-cover transition-all duration-700 ${isFront ? 'scale-x-[-1]' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Ambient Vignette */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
            
            {/* HUD Overlay Scanlines */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
                <div className="absolute top-0 left-10 w-px h-full bg-gradient-to-b from-transparent via-aeirmist-cyan to-transparent animate-scan-slow" />
                <div className="absolute top-0 right-20 w-px h-full bg-gradient-to-b from-transparent via-aeirmist-magenta to-transparent animate-scan-fast" />
            </div>

            {/* Flash Effect Overlay */}
            <AnimatePresence>
                {isCapturing && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        className="absolute inset-0 bg-white z-[1060]"
                        transition={{ duration: 0.2 }}
                    />
                )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Right Controls - Compact phone camera style */}
      <aside className="fixed right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-[1050]">
        <div className="bg-black/40 p-1.5 flex flex-col gap-3 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl">
          <ControlButton 
            icon={<Music size={16} />} 
            label="Add" 
            color="aeirmist-cyan" 
          />
          <ControlButton 
            icon={<Sparkles size={16} />} 
            label="Beauty" 
            color="aeirmist-magenta"
            active={isBeautyOn}
            onClick={() => setIsBeautyOn(!isBeautyOn)}
          />
          <ControlButton 
            icon={<RefreshCcw size={16} />} 
            label="Flip" 
            onClick={() => setIsFront(!isFront)}
          />
          <ControlButton 
            icon={<Gauge size={16} />} 
            label="Speed" 
          />
        </div>
      </aside>

      {/* Bottom Controls */}
      <div className="fixed bottom-0 w-full z-[1050] px-6 pb-[calc(2rem+var(--spacing-safe-bottom))] bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        
        {/* Filter Selection */}
        <div className="flex justify-center gap-3 mb-8 overflow-x-auto no-scrollbar py-2">
            {FILTERS.map(f => (
                <button
                    key={f.id}
                    onClick={() => setCurrentFilter(f.id)}
                    className={`flex-shrink-0 glass-panel px-6 py-2 rounded-full border transition-all flex items-center gap-2 ${
                        currentFilter === f.id 
                            ? 'border-aeirmist-magenta/40 shadow-[0_0_20px_rgba(255,0,234,0.3)] bg-aeirmist-magenta/10 text-aeirmist-magenta' 
                            : 'border-white/10 text-white/40'
                    }`}
                >
                    <span className="material-symbols-outlined text-[14px]">
                        {f.id === 'NORMAL' ? <Sparkles size={14}/> : (f.id === 'NOIR_GRAIN' ? <Gauge size={14} /> : <Sparkles size={14} />)}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest">{f.name}</span>
                </button>
            ))}
        </div>

        {/* Capture Row */}
        <div className="flex items-center justify-between mb-10 max-w-lg mx-auto">
          {/* Gallery */}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="group relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/20 hover:scale-110 active:scale-95 transition-all outline-none"
          >
            {profile?.photoURL ? (
                <img src={getAvatarUrl(profile.photoURL)} alt="Gallery" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
            ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/20">
                    <ImageIcon size={24} />
                </div>
            )}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleGalleryUpload}
                accept="image/*,video/*"
            />
          </button>

          {/* Central Capture Button */}
          <div className="relative flex items-center justify-center">
            {/* Outer Rings */}
            <motion.div 
                animate={{ scale: isRecording ? [1.2, 1.4, 1.2] : 1.25 }}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`absolute w-28 h-28 rounded-full border-4 ${isRecording ? 'border-aeirmist-magenta/40' : 'border-aeirmist-cyan/20'} animate-pulse`} 
            />
            
            <button 
                onClick={handleCapture}
                className={`relative w-22 h-22 rounded-full p-1 transition-all active:scale-90 outline-none ${isRecording ? 'bg-aeirmist-magenta shadow-[0_0_30px_rgba(255,0,234,0.5)]' : 'bg-gradient-to-tr from-aeirmist-cyan to-white/40 shadow-[0_0_20px_rgba(0,242,255,0.3)]'}`}
            >
                <div className={`w-full h-full rounded-full border-2 border-white/30 bg-transparent flex items-center justify-center ${isRecording ? 'animate-pulse' : ''}`}>
                    {isRecording ? (
                        <div className="w-8 h-8 bg-white rounded-lg" />
                    ) : (
                        <div className="w-18 h-18 rounded-full bg-white/10" />
                    )}
                </div>
            </button>
          </div>

          {/* Close Friends Toggle */}
          <button 
            onClick={() => setIsCloseFriends(!isCloseFriends)}
            className={`w-16 h-16 glass-panel rounded-full flex flex-col items-center justify-center hover:scale-110 transition-all shadow-xl group border ${isCloseFriends ? 'border-aeirmist-lime bg-aeirmist-lime/10 text-aeirmist-lime' : 'border-white/10 text-white/40'}`}
          >
            <Star size={24} fill={isCloseFriends ? "currentColor" : "none"} />
            <span className="text-[7px] font-black mt-1 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Private</span>
          </button>
        </div>

        {/* Mode Switcher */}
        <nav className="flex justify-center items-center gap-8 h-12 overflow-x-auto no-scrollbar">
          {(['STORY', 'PHOTO', 'VIDEO'] as CameraMode[]).map(m => (
              <button 
                key={m}
                onClick={() => setMode(m)}
                className={`flex flex-col items-center justify-center transition-all px-4 ${mode === m ? 'text-aeirmist-cyan scale-110 font-black drop-shadow-[0_0_10px_rgba(0,242,255,0.6)]' : 'text-white/30 hover:text-white/60 font-medium'}`}
              >
                <span className="text-[12px] uppercase tracking-[0.2em]">{m}</span>
                {mode === m && (
                    <motion.div 
                        layoutId="mode-dot"
                        className="w-1.5 h-1.5 bg-aeirmist-cyan rounded-full mt-2 shadow-[0_0_8px_rgba(0,242,255,1)]" 
                    />
                )}
              </button>
          ))}
        </nav>
      </div>
    </motion.div>
  );
};

const ControlButton = React.memo(({ icon, label, color, active, onClick }: { 
    icon: React.ReactNode, 
    label: string, 
    color?: string,
    active?: boolean,
    onClick?: () => void
}) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center gap-0.5 group outline-none"
  >
    <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border ${
        active 
            ? `bg-${color}/20 border-${color}/40 text-${color} shadow-[0_0_15px_color-mix(in_srgb,var(--color-${color})_30%,transparent)]` 
            : `bg-white/5 border-white/5 text-white/60 group-hover:bg-white/10 group-hover:text-white`
    }`}>
      {icon}
    </div>
    <span className={`text-[7px] uppercase tracking-wider transition-all ${active ? `text-${color}` : 'text-white/30 group-hover:text-white/40'}`}>
        {label}
    </span>
  </button>
));
