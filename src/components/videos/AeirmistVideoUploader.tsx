import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Upload, 
  Sparkles, 
  Image as ImageIcon, 
  Crop, 
  ChevronRight, 
  Plus, 
  Play, 
  Settings, 
  Maximize2, 
  Video as VideoIcon,
  CheckCircle,
  Scissors,
  Check,
  Eye,
  Globe,
  Lock,
  MessageSquare,
  Heart,
  Share2,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { MediaQuality } from '../../services/MediaService';
import { cloudinaryService } from '../../services/cloudinaryService';
import { collection, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


interface AeirmistVideoUploaderProps {
  onClose: () => void;
  onUploadSuccess: (videoData: any) => void;
}

// Neon cyber-themed preloaded samples for high quality sharing
const SAMPLE_VIDEOS = [
  {
    title: 'Neon Drift Tokyo',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-look-of-a-man-in-the-city-at-night-40348-large.mp4',
    category: 'Travel & Events',
    caption: 'Tokyo in full spectral sync. Exploring neon veins. #Cyberpunk #MetroGrid #Aeirmist',
    thumbnail: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&q=80&w=600'
  },
  {
    title: 'Featured Feed',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-futuristic-digital-connection-background-32669-large.mp4',
    category: 'Tech & Science',
    caption: 'Sharing video updates on Aeirmist. #Video #Aeirmist',
    thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=600'
  }
];

export const AeirmistVideoUploader: React.FC<AeirmistVideoUploaderProps> = ({ onClose, onUploadSuccess }) => {
  const { profile, user, addToast, db, uploadMedia } = useAeirmist();
  
  // File & Video States
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [videoFormat, setVideoFormat] = useState<'mp4' | 'mov' | 'webm'>('mp4');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'short' | 'long' | 'vertical' | 'horizontal' | 'square'>('horizontal');
  
  // Loading & Flow State
  const [step, setStep] = useState<1 | 2>(1); // 1: Select files/source, 2: Details & Thumbnail
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Metadata States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [category, setCategory] = useState('Technology');
  const [language, setLanguage] = useState('English');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  // Interaction Settings
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [likesEnabled, setLikesEnabled] = useState(true);
  const [sharesEnabled, setSharesEnabled] = useState(true);
  const [downloadEnabled, setDownloadEnabled] = useState(true);
  const [embedEnabled, setEmbedEnabled] = useState(true);

  // Cloudinary storage state & verification
  const [showCloudinaryConfig, setShowCloudinaryConfig] = useState(!cloudinaryService.isConfigured());
  const [cCloudName, setCCloudName] = useState(cloudinaryService.getCloudName());
  const [cUploadPreset, setCUploadPreset] = useState(cloudinaryService.getUploadPreset());
  const [isTestingCloudinary, setIsTestingCloudinary] = useState(false);
  const [cloudinaryTestResult, setCloudinaryTestResult] = useState<{ success?: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (db) {
      cloudinaryService.syncWithFirestore(db).then(() => {
        const activeCloud = cloudinaryService.getCloudName();
        const activePreset = cloudinaryService.getUploadPreset();
        setCCloudName(activeCloud);
        setCUploadPreset(activePreset);
        if (!cloudinaryService.isConfigured()) {
          setShowCloudinaryConfig(true);
        }
      });
    }
  }, [db]);

  const handleSaveAndTestCloudinary = async () => {
    if (!cCloudName.trim() || !cUploadPreset.trim()) {
      addToast({
        title: 'Missing Fields',
        message: 'Please provide both Cloud Name and Upload Preset.',
        type: 'warning'
      });
      return;
    }
    setIsTestingCloudinary(true);
    setCloudinaryTestResult(null);
    const result = await cloudinaryService.testConnection(cCloudName, cUploadPreset);
    setIsTestingCloudinary(false);
    setCloudinaryTestResult(result);
    if (result.success) {
      await cloudinaryService.saveConfig(cCloudName, cUploadPreset, db);
      addToast({
        title: 'Cloudinary Connected',
        message: 'High-speed video CDN storage is active and verified.',
        type: 'success'
      });
    } else {
      addToast({
        title: 'Verification Failed',
        message: result.error || 'Failed to verify Cloudinary preset.',
        type: 'warning'
      });
    }
  };

  // Thumbnail System States
  const [thumbnailType, setThumbnailType] = useState<'auto' | 'custom'>('auto');
  const [customThumbnailData, setCustomThumbnailData] = useState<string>('');
  const [autoThumbnailData, setAutoThumbnailData] = useState<string>('');
  const [thumbnailCrop, setThumbnailCrop] = useState<{ scale: number; x: number; y: number }>({ scale: 1, x: 0, y: 0 });
  const [isCropping, setIsCropping] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  // Auto-generate thumbnail from selected video frame
  useEffect(() => {
    if (videoPreviewUrl && hiddenVideoRef.current && thumbnailType === 'auto') {
      const video = hiddenVideoRef.current;
      video.crossOrigin = 'anonymous';
      
      const captureFrame = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setAutoThumbnailData(dataUrl);
          }
        } catch (e) {
          logger.error('[Uploader] Frame capture aborted:', e);
          // Fallback image
          setAutoThumbnailData('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600');
        }
      };

      video.onloadeddata = () => {
        video.currentTime = 1.0; // Seek to 1 second to avoid black frame
      };
      
      video.onseeked = () => {
        captureFrame();
      };
    }
  }, [videoPreviewUrl, thumbnailType]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processVideoFile(file);
    } else {
      addToast({
        title: 'UNSUPPORTED DATA',
        message: 'Only MP4, MOV, or WEBM video files are currently supported.',
        type: 'warning'
      });
    }
  };

  const selectPreloadSample = (sample: typeof SAMPLE_VIDEOS[0]) => {
    setTitle(sample.title);
    setCategory(sample.category);
    setDescription(sample.caption);
    setVideoPreviewUrl(sample.url);
    setVideoUrl(sample.url);
    setAutoThumbnailData(sample.thumbnail);
    setVideoFormat('mp4');
    setVideoAspectRatio('horizontal');
    setStep(2);
    
    addToast({
      title: 'VECTORED SAMPLE LOADED',
      message: 'Sub-grid asset mapped successfully.',
      type: 'success'
    });
  };

  const processVideoFile = (file: File) => {
    setVideoFile(file);
    const localUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(localUrl);
    setVideoUrl(localUrl);

    // Determine format
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'webm') setVideoFormat('webm');
    else if (ext === 'mov') setVideoFormat('mov');
    else setVideoFormat('mp4');

    // In a real browser view, aspect ratio can be calculated dynamically
    // Default to vertical if it has a vertical-like name or typical phone aspect ratio
    if (file.name.toLowerCase().includes('short') || file.name.toLowerCase().includes('tiktok') || file.name.toLowerCase().includes('reels') || file.name.toLowerCase().includes('vert')) {
      setVideoAspectRatio('vertical');
    } else {
      setVideoAspectRatio('horizontal');
    }

    // Attempt a parsed placeholder name
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').substring(0, 50);
    setTitle(cleanTitle);

    setStep(2);
    addToast({
      title: 'STREAM INJECTED',
      message: `${file.name} uploaded to staging buffer.`,
      type: 'info'
    });
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processVideoFile(file);
    }
  };

  const handleCustomThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomThumbnailData(event.target.result as string);
          setThumbnailType('custom');
          addToast({
            title: 'THUMBNAIL LOADED',
            message: 'Custom visual asset cached.',
            type: 'success'
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Thumbnail Crop interaction (Pan & Zoom)
  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!isCropping) return;
    setDragStart({ x: e.clientX - thumbnailCrop.x, y: e.clientY - thumbnailCrop.y });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || !isCropping) return;
    setThumbnailCrop({
      ...thumbnailCrop,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleCropMouseUp = () => {
    setDragStart(null);
  };

  const publishVideo = async () => {
    if (isPublishing) return; if (!title.trim()) {
      addToast({
        title: 'TITLE ERROR',
        message: 'A descriptive headline is required for stream indexing.',
        type: 'warning'
      });
      return;
    }

    setIsPublishing(true);
    setUploadProgress(5);

    try {
      let finalVideoUrl = videoUrl;
      let finalThumbnailUrl = thumbnailType === 'custom' ? (customThumbnailData || autoThumbnailData) : autoThumbnailData;

      // 1. Upload Video File to Cloudinary CDN
      if (videoFile && uploadMedia) {
        setUploadProgress(10);

        try {
          finalVideoUrl = await uploadMedia(videoFile, `users/${user?.uid || 'guest'}/videos`, (p) => {
            // Real progress from Cloudinary / storage upload (10% to 85%)
            const mapped = Math.floor(10 + p * 0.75);
            setUploadProgress(mapped);
          });
        } catch (e: any) {
          logger.error('[Uploader] Video cloud upload failed:', e);
          setIsPublishing(false);
          setUploadProgress(0);
          setShowCloudinaryConfig(true);
          addToast({
            title: 'Cloud Video Upload Failed',
            message: e?.message || 'Failed to upload video to cloud storage. Please check your Cloudinary settings below.',
            type: 'warning'
          });
          return;
        }

        // Prevent saving temporary browser blob URLs into Firestore
        if (!finalVideoUrl || finalVideoUrl.startsWith('blob:')) {
          setIsPublishing(false);
          setUploadProgress(0);
          setShowCloudinaryConfig(true);
          addToast({
            title: 'Cloud Video Required',
            message: 'A public video stream could not be created. Please configure Cloudinary below so other users can view your video.',
            type: 'warning'
          });
          return;
        }
      }

      // 2. Upload Thumbnail to CDN
      if (finalThumbnailUrl && finalThumbnailUrl.startsWith('data:') && uploadMedia) {
        setUploadProgress(88);
        try {
          const res = await fetch(finalThumbnailUrl);
          const blob = await res.blob();
          const thumbFile = new File([blob], 'thumb.webp', { type: 'image/webp' });
          finalThumbnailUrl = await uploadMedia(thumbFile, `users/${user?.uid || 'guest'}/video_thumbs`, () => {}, MediaQuality.THUMBNAIL);
        } catch (err) {
          logger.warn('[Uploader] Thumbnail CDN upload failed, keeping base64 fallback', err);
        }
      }

      setUploadProgress(95);

      const id = 'vid_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      
      const parsedTags = hashtags
        .split(' ')
        .filter(t => t.startsWith('#'))
        .map(t => t.replace('#', '').toLowerCase());

      const finalVideoRecord = {
        id,
        creatorId: profile?.id || 'guest_creator',
        creatorUid: user?.uid || profile?.ownerUid || profile?.uid || profile?.id,
        authorUid: user?.uid || profile?.ownerUid || profile?.uid || profile?.id,
        authorId: profile?.id || user?.uid,
        userId: user?.uid || profile?.ownerUid || profile?.uid || profile?.id,
        creatorName: profile?.displayName || profile?.username || 'Guest',
        creatorAvatar: getAvatarUrl(profile?.photoURL, profile?.id),
        videoURL: finalVideoUrl,
        caption: title,
        description,
        tags: parsedTags.length > 0 ? parsedTags : ['aeirmist', category.toLowerCase().replace('&', '').replace(' ', '')],
        category,
        language,
        visibility,
        location,
        commentsEnabled,
        likesEnabled,
        sharesEnabled,
        downloadEnabled,
        embedEnabled,
        aspectRatio: videoAspectRatio,
        thumbnailURL: finalThumbnailUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600',
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        saveCount: 0,
        viewCount: 0,
        createdAt: new Date().toISOString(),
        likedBy: [],
        savedBy: []
      };

      if (db) {
        // Real Firestore persistence
        await setDoc(doc(db, 'videos', id), finalVideoRecord);

        // Also create a lightweight companion post so this video actually shows up
        // in the main Home Feed (which only reads from the 'posts' collection).
        // Tapping this feed card opens the Videos section (see PremiumPostCard.tsx).
        await addDoc(collection(db, 'posts'), {
          type: 'video',
          videoId: id,
          authorId: profile?.id,
          authorUid: user?.uid,
          author: {
            displayName: profile?.displayName,
            username: profile?.username,
            photoURL: profile?.photoURL,
            isVerified: profile?.isVerified || false,
          },
          caption: title,
          mediaUrl: finalThumbnailUrl || finalVideoRecord.thumbnailURL,
          videoURL: finalVideoUrl,
          likesCount: 0,
          commentsCount: 0,
          createdAt: serverTimestamp(),
        });
      } else {
        logger.warn('Database unlinked, video saved locally');
      }

      setUploadProgress(100);

      setTimeout(() => {
        addToast({
          title: 'Video published',
          message: 'Your video is now live on the Feed.',
          type: 'success'
        });
        onUploadSuccess(finalVideoRecord);
      }, 500);

    } catch (e: any) {
      logger.error('[Uploader] Broadcast error:', e);
      addToast({
        title: 'ERROR',
        message: 'Upload failed. Please try again.',
        type: 'warning'
      });
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-4 md:p-6 overflow-hidden">
      
      {/* Hidden background capture video */}
      <video ref={hiddenVideoRef} src={videoPreviewUrl} className="hidden" muted playsInline crossOrigin="anonymous" />
      
      <div className="w-full max-w-5xl bg-[#08060d] border border-white/10 rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col h-full max-h-[95vh] lg:h-[90vh] lg:max-h-[850px] relative">
        
        {/* Glow Accents */}
        <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-aeirmist-cyan/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-aeirmist-magenta/10 blur-[100px] rounded-full pointer-events-none" />

        {/* Head Bar */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#08060d]/90 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan">
              <VideoIcon size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Upload Video</h2>
              <span className="text-[9px] font-mono text-white/30 tracking-widest uppercase">Video sharing platform</span>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            disabled={isPublishing}
            className="p-3 bg-white/5 border border-white/5 hover:border-white/10 text-white/40 hover:text-white rounded-2xl transition-all disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Content Areas */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-8">
          
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full flex flex-col md:grid md:grid-cols-5 gap-8 items-center md:items-stretch"
              >
                {/* Drag Drop Area */}
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full md:col-span-3 border-2 border-dashed border-white/10 hover:border-aeirmist-cyan/40 hover:bg-white/[0.01] rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer group transition-all relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-aeirmist-cyan/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 group-hover:border-aeirmist-cyan/20 flex items-center justify-center text-white/30 group-hover:text-aeirmist-cyan transition-all mb-4">
                    <Upload size={28} />
                  </div>

                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 group-hover:text-aeirmist-cyan transition-colors">
                    Load Video File
                  </h3>
                  <p className="text-xs text-white/35 max-w-sm leading-relaxed mb-6">
                    Drag and drop your media file here, or click to explore your directories.
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-[9px] font-black tracking-widest text-white/40 uppercase font-mono">MP4</span>
                    <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-[9px] font-black tracking-widest text-white/40 uppercase font-mono">MOV</span>
                    <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-[9px] font-black tracking-widest text-white/40 uppercase font-mono">WEBM</span>
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleVideoSelect} 
                    accept="video/*" 
                    className="hidden" 
                  />
                </div>

                {/* Preloads & Samples Column */}
                <div className="w-full md:col-span-2 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-1.5 font-mono">
                      <Sparkles size={11} className="text-aeirmist-cyan animate-pulse" />
                      Preloaded Vector Channels
                    </span>

                    <div className="space-y-3">
                      {SAMPLE_VIDEOS.map((sample, i) => (
                        <div 
                          key={`sample-${i}`}
                          onClick={() => selectPreloadSample(sample)}
                          className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-cyan/30 class-hover transition-all cursor-pointer group"
                        >
                          <div className="relative w-20 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10">
                            <img src={sample.thumbnail} alt={sample.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Play size={14} className="text-white fill-white" />
                            </div>
                          </div>
                          <div className="min-w-0 pr-2">
                            <h4 className="text-[11px] font-black text-white group-hover:text-aeirmist-cyan transition-colors uppercase tracking-wider truncate mb-1">
                              {sample.title}
                            </h4>
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-white/5 text-white/40 border border-white/10 font-mono">
                              {sample.category}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Info Notice card */}
                  <div className="p-4 rounded-2xl bg-[#0e0c15] border border-white/5 text-left text-white/40 text-[10px] leading-relaxed uppercase tracking-wider">
                    <p className="font-bold text-white/60 mb-1 flex items-center gap-1.5">
                      <CheckCircle size={11} className="text-aeirmist-cyan" />
                      Aesthetic Parameters
                    </p>
                    All video ratios are normalized. Uploaded content will automatically render across horizontal streams and the Creator Studio overview metrics.
                  </div>
                </div>

              </motion.div>
            ) : (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8"
              >
                
                {/* Left Side: Thumbnail options & Custom file stats */}
                <div className="space-y-6">
                  
                  {/* Thumbnail Deck */}
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5 font-mono">
                        <ImageIcon size={12} className="text-aeirmist-cyan" />
                        Thumbnails
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setThumbnailType('auto')}
                          className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest border transition-all ${thumbnailType === 'auto' ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/40 text-aeirmist-cyan' : 'bg-white/5 border-white/5 text-white/40'}`}
                        >
                          Auto Frame
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!customThumbnailData) {
                              thumbnailInputRef.current?.click();
                            } else {
                              setThumbnailType('custom');
                            }
                          }}
                          className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-widest border transition-all ${thumbnailType === 'custom' ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/40 text-aeirmist-cyan' : 'bg-white/5 border-white/5 text-white/40'}`}
                        >
                          Custom Upload
                        </button>
                      </div>
                    </div>

                    {/* Image viewport */}
                    <div 
                      ref={cropContainerRef}
                      onMouseDown={handleCropMouseDown}
                      onMouseMove={handleCropMouseMove}
                      onMouseUp={handleCropMouseUp}
                      onMouseLeave={handleCropMouseUp}
                      className="relative w-full aspect-video rounded-3xl bg-black border border-white/10 overflow-hidden group select-none cursor-move"
                    >
                      <div className="absolute inset-0 z-10 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                        <span className="px-3 py-1.5 bg-black/70 backdrop-blur-lg border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-wider text-white">
                          {isCropping ? 'Drag image to Pan / Crop' : 'Thumbnail Frame'}
                        </span>
                      </div>

                      {thumbnailType === 'custom' && customThumbnailData ? (
                        <img 
                          src={customThumbnailData} 
                          alt="Thumbnail Custom preview" 
                          className="absolute w-full h-full object-cover pointer-events-none"
                          style={{
                            transform: `scale(${thumbnailCrop.scale}) translate(${thumbnailCrop.x}px, ${thumbnailCrop.y}px)`,
                            transition: isCropping ? 'none' : 'transform 0.2s ease-out'
                          }}
                        />
                      ) : autoThumbnailData ? (
                        <img 
                          src={autoThumbnailData} 
                          alt="Thumbnail Generated preview" 
                          className="absolute w-full h-full object-cover pointer-events-none"
                          style={{
                            transform: `scale(${thumbnailCrop.scale}) translate(${thumbnailCrop.x}px, ${thumbnailCrop.y}px)`,
                            transition: isCropping ? 'none' : 'transform 0.2s ease-out'
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/20 select-none text-xs font-mono">
                          Rendering frame pipeline...
                        </div>
                      )}

                      {/* Frame guide overlay (Crop indicator) */}
                      {isCropping && (
                        <div className="absolute inset-4 border border-dashed border-aeirmist-cyan/60 pointer-events-none rounded-xl bg-black/10 flex items-center justify-center">
                          <Crop size={24} className="text-aeirmist-cyan animate-pulse" />
                        </div>
                      )}
                    </div>

                    {/* Thumbnail Tools */}
                    <div className="flex gap-2 items-center justify-between">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            thumbnailInputRef.current?.click();
                          }}
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] text-white font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5"
                        >
                          <Upload size={10} /> Replace Thumbnail
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCropping(!isCropping)}
                          className={`px-3 py-2 border text-[9px] font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 ${isCropping ? 'bg-aeirmist-cyan/25 border-aeirmist-cyan/40 text-aeirmist-cyan' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                        >
                          <Crop size={10} /> {isCropping ? 'Lock Crop' : 'Adjust Crop'}
                        </button>
                      </div>

                      {/* Scale slider */}
                      {isCropping && (
                        <div className="flex items-center gap-2 max-w-[140px] flex-1">
                          <span className="text-[9px] text-white/30 uppercase font-mono">Scale</span>
                          <input 
                            type="range" 
                            min="1" 
                            max="3" 
                            step="0.05"
                            value={thumbnailCrop.scale}
                            onChange={(e) => setThumbnailCrop({ ...thumbnailCrop, scale: parseFloat(e.target.value) })}
                            className="w-full accent-aeirmist-cyan bg-white/5 h-1 rounded-full cursor-pointer" 
                          />
                        </div>
                      )}
                      
                      <input 
                        type="file" 
                        ref={thumbnailInputRef} 
                        onChange={handleCustomThumbnailSelect} 
                        accept="image/*" 
                        className="hidden" 
                      />
                    </div>
                  </div>

                  {/* Horizontal / vertical presets */}
                  <div className="grid grid-cols-2 gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-3xl">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Media Codec</span>
                      <p className="text-[10px] font-black text-white/70 font-mono uppercase">{videoFormat} container</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Canvas Aspect</span>
                      <select 
                        value={videoAspectRatio}
                        onChange={(e: any) => setVideoAspectRatio(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 p-0 text-[10px] text-aeirmist-cyan font-black uppercase font-mono tracking-widest cursor-pointer"
                      >
                        <option value="horizontal">Horizontal (16:9)</option>
                        <option value="vertical">Vertical (9:16)</option>
                        <option value="square">Square (1:1)</option>
                        <option value="short">Short loop</option>
                      </select>
                    </div>
                  </div>

                  {/* Settings Toggles */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5 font-mono">
                      <Settings size={12} className="text-aeirmist-cyan" />
                      Controls & Permissions
                    </span>

                    <div className="divide-y divide-white/5 space-y-1.5">
                      <ToggleItem 
                        title="Enable Comments" 
                        description="Let viewers reply and thread responses in stream." 
                        checked={commentsEnabled} 
                        onChange={setCommentsEnabled} 
                      />
                      <ToggleItem 
                        title="Show Like Counter" 
                        description="Allow the community to view related content." 
                        checked={likesEnabled} 
                        onChange={setLikesEnabled} 
                      />
                      <ToggleItem 
                        title="Allow Global Sharing" 
                        description="Allow this stream node signals to be shared publicly." 
                        checked={sharesEnabled} 
                        onChange={setSharesEnabled} 
                      />
                      <ToggleItem 
                        title="Allow File Downloads" 
                        description="Viewers can download source stream artifacts." 
                        checked={downloadEnabled} 
                        onChange={setDownloadEnabled} 
                      />
                      <ToggleItem 
                        title="Vectored Embedding" 
                        description="Permit external site frame indexing of this signal." 
                        checked={embedEnabled} 
                        onChange={setEmbedEnabled} 
                      />
                    </div>
                  </div>

                </div>

                {/* Right Side: Title & Form values */}
                <div className="flex flex-col justify-between space-y-6">
                  
                  <div className="space-y-5">
                    {/* Title */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/40 font-mono block">
                        Title / Signal Headline <span className="text-aeirmist-magenta">*</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="e.g. My First Aeirmist Video"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                        className="w-full bg-white/5 border border-white/10 focus:border-aeirmist-cyan/40 focus:ring-1 focus:ring-aeirmist-cyan/30 text-white rounded-2xl py-3 px-4 text-xs font-bold font-sans placeholder:text-white/20 transition-all outline-none"
                      />
                      <span className="text-[8px] font-mono text-white/30 block text-right">
                        {title.length}/100 characters
                      </span>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/40 font-mono block">
                        Payload Description
                      </label>
                      <textarea 
                        rows={3}
                        placeholder="e.g. Welcome to my channel. Let me know what you think!"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={1000}
                        className="w-full bg-white/5 border border-white/10 focus:border-aeirmist-cyan/40 focus:ring-1 focus:ring-aeirmist-cyan/30 text-white rounded-2xl py-3 px-4 text-xs font-medium font-sans placeholder:text-white/20 transition-all outline-none resize-none"
                      />
                    </div>

                    {/* Hashtags */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/40 font-mono block">
                        Hashtags (Space separated)
                      </label>
                      <input 
                        type="text" 
                        placeholder="e.g. #aeirmist #creator #video"
                        value={hashtags}
                        onChange={(e) => setHashtags(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 focus:border-aeirmist-cyan/40 focus:ring-1 focus:ring-aeirmist-cyan/30 text-xs font-mono text-aeirmist-cyan placeholder:text-white/20 rounded-2xl py-3 px-4 transition-all outline-none"
                      />
                    </div>

                    {/* Dual Selector: Category & Language */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40 font-mono block">
                          Category
                        </label>
                        <select 
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 focus:border-aeirmist-cyan/40 text-xs text-white rounded-2xl py-3 px-4 transition-all outline-none font-bold"
                        >
                          <option value="Technology">Technology</option>
                          <option value="Travel & Events">Travel & Events</option>
                          <option value="Art & Design">Art & Design</option>
                          <option value="Coding & Development">Coding & Dev</option>
                          <option value="Gaming & Simulations">Gaming</option>
                          <option value="Music & Senses">Music & Synth</option>
                          <option value="Vlog & Daily Loop">Vlog & Daily</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40 font-mono block">
                          Broadcast Language
                        </label>
                        <select 
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 focus:border-aeirmist-cyan/40 text-xs text-white rounded-2xl py-3 px-4 transition-all outline-none font-bold"
                        >
                          <option value="English">English</option>
                          <option value="Spanish">Español</option>
                          <option value="Japanese">日本語</option>
                          <option value="German">Deutsch</option>
                          <option value="French">Français</option>
                        </select>
                      </div>
                    </div>

                    {/* Visibility & Optional Location */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40 font-mono block">
                          Visibility Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setVisibility('public')}
                            className={`py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${visibility === 'public' ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan shadow-[0_0_10px_rgba(0,242,255,0.15)]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                          >
                            <Globe size={10} /> Public
                          </button>
                          <button
                            type="button"
                            onClick={() => setVisibility('private')}
                            className={`py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${visibility === 'private' ? 'bg-aeirmist-magenta/10 border-aeirmist-magenta/30 text-aeirmist-magenta shadow-[0_0_10px_rgba(255,0,127,0.15)]' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}
                          >
                            <Lock size={10} /> Private
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/40 font-mono block">
                          Node Location (Optional)
                        </label>
                        <input 
                          type="text" 
                          placeholder="e.g. Sub-Sector 7"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 focus:border-aeirmist-cyan/40 text-white text-xs font-bold rounded-2xl py-3 px-4 transition-all outline-none placeholder:text-white/20"
                        />
                      </div>
                    </div>

                    {/* Cloudinary CDN Storage Status & Setup */}
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${cloudinaryService.isConfigured() ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse'}`} />
                          <span className="text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                            <Cloud size={13} className="text-aeirmist-cyan" />
                            Cloudinary CDN Storage {cloudinaryService.isConfigured() ? '(Connected)' : '(Setup Required)'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCloudinaryConfig(!showCloudinaryConfig)}
                          className="text-[9px] font-mono text-aeirmist-cyan hover:underline uppercase"
                        >
                          {showCloudinaryConfig ? 'Hide' : 'Configure'}
                        </button>
                      </div>

                      {showCloudinaryConfig && (
                        <div className="space-y-3 pt-2 border-t border-white/5">
                          <p className="text-[10px] text-white/50 leading-relaxed">
                            Zero-cost video & reels CDN hosting. Delivers smooth playback across all devices and accounts without bandwidth limits.
                            <a 
                              href="https://cloudinary.com/users/register_free" 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-aeirmist-cyan inline-flex items-center gap-1 ml-1 hover:underline"
                            >
                              Sign up free <ExternalLink size={10} />
                            </a>
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-[8px] font-black uppercase text-white/40 tracking-wider block mb-1">
                                Cloud Name
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. dxyz12345"
                                value={cCloudName}
                                onChange={(e) => setCCloudName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-aeirmist-cyan outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-black uppercase text-white/40 tracking-wider block mb-1">
                                Unsigned Upload Preset
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. aeirmist_uploads"
                                value={cUploadPreset}
                                onChange={(e) => setCUploadPreset(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-aeirmist-cyan outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[8px] text-white/40">
                              Settings &rarr; Upload &rarr; Add Upload Preset (Signing Mode: Unsigned)
                            </span>
                            <button
                              type="button"
                              disabled={isTestingCloudinary || !cCloudName.trim() || !cUploadPreset.trim()}
                              onClick={handleSaveAndTestCloudinary}
                              className="px-3 py-1.5 bg-aeirmist-cyan/20 border border-aeirmist-cyan/40 text-aeirmist-cyan hover:bg-aeirmist-cyan hover:text-black rounded-xl text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-40"
                            >
                              {isTestingCloudinary ? 'Verifying...' : 'Save & Verify'}
                            </button>
                          </div>

                          {cloudinaryTestResult && (
                            <div className={`p-2 rounded-xl text-[9px] font-mono ${cloudinaryTestResult.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                              {cloudinaryTestResult.success ? '✅ Cloudinary is active and ready for fast video uploads!' : `❌ ${cloudinaryTestResult.error}`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission Progress / Buttons */}
                  <div className="pt-2 sticky bottom-0 bg-[#08060d] py-4 mt-auto border-t border-white/5 lg:border-none lg:relative lg:bg-transparent lg:p-0">
                    {isPublishing ? (
                      <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="flex justify-between items-center text-[10px] uppercase font-black font-mono tracking-widest text-white">
                          <span className="flex items-center gap-1.5 animate-pulse text-aeirmist-cyan">
                            Saving Media Signal
                          </span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-aeirmist-cyan"
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ duration: 0.1 }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="px-6 py-4 bg-white/5 border border-white/5 text-white/40 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Step Back
                        </button>
                        <button
                          type="button"
                          onClick={publishVideo}
                          className="flex-1 py-4 bg-aeirmist-cyan text-black hover:brightness-110 active:scale-95 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-[0_0_30px_rgba(0,242,255,0.3)] flex items-center justify-center gap-2"
                        >
                          <Sparkles size={13} className="fill-current" /> Broadcast Stream Node
                        </button>
                      </div>
                    )}
                  </div>

                </div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>
    </div>
  );
};

// Toggle Items helper
interface ToggleItemProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ title, description, checked, onChange }) => {
  return (
    <div className="flex items-center justify-between py-2 text-left">
      <div className="pr-4 max-w-xs">
        <h4 className="text-[10px] font-black text-white uppercase tracking-wider">{title}</h4>
        <p className="text-[8px] text-white/35 uppercase tracking-wide mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full p-1 transition-colors ${checked ? 'bg-aeirmist-cyan' : 'bg-white/10'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-black transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );
};
