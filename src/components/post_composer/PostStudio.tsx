import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, FileText, Film, BookOpen, Video as VideoIcon, ListTodo, 
  Smile, Image as ImageIcon, MapPin, Users, Music as MusicIcon, 
  Link as LinkIcon, Sparkles, Trash2, Globe, Eye, MessageSquare, 
  Settings, Monitor, Smartphone, LayoutGrid, Check, Play, Pause, 
  AlertCircle, ChevronLeft, ChevronRight, X, Clock, HelpCircle, ArrowLeft, 
  ShieldCheck, Sliders, Plus, Edit3, Lock, MessageCircle, ChevronDown
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { MediaEditor } from './MediaEditor';
import { PollComposer } from './PollComposer';
import { LocationSearch } from './LocationSearch';
import { TagPeople } from './TagPeople';
import { MusicSelector } from './MusicSelector';
import { GifPicker } from './GifPicker';
import { logger } from '@/src/utils/logger';

// Rich post gradients
const THEME_GRADIENTS = [
  { id: 'neon_cyber', label: 'Ocean Dark', css: 'linear-gradient(135deg, #050b14 0%, #0c203b 100%)', border: 'border-cyan-500/30' },
  { id: 'neon_sunset', label: 'Neon Sunset', css: 'linear-gradient(135deg, #2b0c1e 0%, #06080d 100%)', border: 'border-pink-500/30' },
  { id: 'holographic', label: 'Hologram', css: 'linear-gradient(135deg, #10051e 0%, #081a2e 100%)', border: 'border-purple-500/30' },
  { id: 'obsidian', label: 'Obsidian Void', css: 'linear-gradient(135deg, #020305 0%, #0b0c10 100%)', border: 'border-white/5' },
  { id: 'retro_grid', label: 'Synth Grid', css: 'linear-gradient(135deg, #11001c 0%, #001220 100%)', border: 'border-fuchsia-500/20' },
  { id: 'plain', label: 'Plain (No Canvas)', css: 'transparent', border: 'border-white/10' }
];

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

interface PostStudioProps {
  onClose: () => void;
  initialType?: string | null;
}

export const PostStudio: React.FC<PostStudioProps> = React.memo(({ onClose, initialType = null }) => {
  const { user, profile, uploadMedia, addToast } = useAeirmist();

  // Active composer state
  const [selectedType, setSelectedType] = useState<string>(initialType || 'photo');
  const [caption, setCaption] = useState('');
  
  // Media Picker states
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [selectedMediaIdx, setSelectedMediaIdx] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup Object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  const createStableUrl = (file: File) => {
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.add(url);
    return url;
  };

  // Sub-feature states
  const [poll, setPoll] = useState<any>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [taggedPeople, setTaggedPeople] = useState<any[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<any>(null);
  const [attachedGif, setAttachedGif] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPreview, setLinkPreview] = useState<any>(null);

  // Voice recording mock states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordIntervalRef = useRef<any>(null);

  // Settings
  const [selectedGradient, setSelectedGradient] = useState(THEME_GRADIENTS[0]);
  const [audience, setAudience] = useState<'public' | 'followers' | 'close_friends' | 'only_me'>(() => {
    return (localStorage.getItem('aeirmist_post_audience') as any) || 'public';
  });
  const [allowComments, setAllowComments] = useState(true);
  const [hideLikes, setHideLikes] = useState(false);
  const [sensitiveWarning, setSensitiveWarning] = useState(false);

  // Categorized tool drawer state: null | 'filters' | 'music' | 'tag' | 'location' | 'theme' | 'audience' | 'settings' | 'link' | 'poll'
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  // Draft save & restore
  const handleSaveDraft = () => {
    const draftPayload = {
      selectedType,
      caption,
      mediaFiles,
      poll,
      location,
      taggedPeople,
      selectedMusic,
      attachedGif,
      linkUrl,
      linkPreview,
      audience,
      allowComments,
      hideLikes,
      sensitiveWarning
    };
    localStorage.setItem('aeirmist_studio_draft', JSON.stringify(draftPayload));
    addToast({
      title: 'Draft Saved',
      message: 'Your post draft has been saved.',
      type: 'info'
    });
  };

  const handleRestoreDraft = () => {
    const raw = localStorage.getItem('aeirmist_studio_draft');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setSelectedType(parsed.selectedType || 'photo');
      setCaption(parsed.caption || '');
      
      const restoredMedia = (parsed.mediaFiles || []).map((item: any) => {
        return {
          ...item,
          url: item.dataUrl || item.url
        };
      });
      
      setMediaFiles(restoredMedia);
      setPoll(parsed.poll || null);
      setLocation(parsed.location || null);
      setTaggedPeople(parsed.taggedPeople || []);
      setSelectedMusic(parsed.selectedMusic || null);
      setAttachedGif(parsed.attachedGif || null);
      setLinkUrl(parsed.linkUrl || '');
      setLinkPreview(parsed.linkPreview || null);
      setAudience(parsed.audience || 'public');
      setAllowComments(parsed.allowComments !== false);
      setHideLikes(!!parsed.hideLikes);
      setSensitiveWarning(!!parsed.sensitiveWarning);
      addToast({
        title: 'Draft Restored',
        message: 'Successfully reloaded your offline draft workspace.',
        type: 'info'
      });
    } catch (e: any) { 
      logger.error("Failed to restore draft", e); 
      addToast({ title: "Draft Error", message: "Failed to restore offline draft", type: "warning" }); 
    }
  };

  // Add media files
  const handleAddMediaFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    const maxFiles = 10;
    if (mediaFiles.length + files.length > maxFiles) {
      addToast({
        title: 'Selection Overflow',
        message: 'Max 10 items allowed per post.',
        type: 'warning'
      });
      return;
    }

    const currentLength = mediaFiles.length;
    const formatted = files.map(file => {
      const url = createStableUrl(file);
      return {
        file,
        url,
        previewUrl: url,
        type: file.type,
        name: file.name,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        warmth: 0,
        blur: 0,
        vignette: 0,
        rotate: 0,
        flipX: false,
        flipY: false,
        cropRatio: 'original',
        fitMode: 'contain',
        muted: false,
        volume: 80,
        speed: 1,
        loop: true,
        coverTime: 0
      };
    });

    setMediaFiles(prev => [...prev, ...formatted]);
    setSelectedMediaIdx(currentLength);

    const processSequentially = async () => {
      for (let i = 0; i < files.length; i++) {
        try {
          const base64Url = await readFileAsDataURL(files[i]);
          setMediaFiles(prev => {
            const updated = [...prev];
            const targetIndex = currentLength + i;
            if (updated[targetIndex]) {
              updated[targetIndex] = {
                ...updated[targetIndex],
                dataUrl: base64Url
              };
            }
            return updated;
          });
        } catch (err: any) { 
          logger.error("Error reading file to data URL", err); 
        }
      }
    };
    
    processSequentially();
  };

  const handleMediaChange = React.useCallback((updated: any) => {
    setMediaFiles(prev => {
      const copy = [...prev];
      if (copy[selectedMediaIdx]) {
        copy[selectedMediaIdx] = updated;
      }
      return copy;
    });
  }, [selectedMediaIdx]);

  // Main Publish Action
  const handlePublish = async () => {
    if (isUploading) return;
    
    if (selectedType === 'text' && !caption) {
      addToast({ title: 'Empty Content', message: 'Please write some text for your post.', type: 'warning' });
      return;
    }
    if (selectedType === 'photo' && mediaFiles.length === 0) {
      addToast({ title: 'No Media Selected', message: 'Please add at least one photo or video.', type: 'warning' });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setUploadStatus('Preparing assets...');

    try {
      let uploadedUrls: string[] = [];
      if (mediaFiles.length > 0) {
        setUploadStatus(`Uploading ${mediaFiles.length} media file(s)...`);
        const progressArray = new Array(mediaFiles.length).fill(0);
        
        // Fast progress indicator simulation
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
        }, 300);

        const uploadPromises = mediaFiles.map((item, idx) => {
          return new Promise<string>(async (resolve) => {
            let completed = false;

            const timer = setTimeout(() => {
              if (!completed) {
                completed = true;
                if (item.dataUrl || item.url) {
                  resolve(item.dataUrl || item.url);
                } else if (item.file) {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = () => resolve('');
                  reader.readAsDataURL(item.file);
                } else {
                  resolve('');
                }
              }
            }, 3500);

            try {
              if (item.file) {
                const url = await uploadMedia(item.file, `posts/${user?.uid}`, (progress) => {
                  progressArray[idx] = progress;
                  const averageProgress = progressArray.reduce((sum, val) => sum + val, 0) / mediaFiles.length;
                  setUploadProgress(Math.min(90, Math.floor(10 + (averageProgress * 0.8))));
                });
                if (!completed) {
                  completed = true;
                  clearTimeout(timer);
                  resolve(url);
                }
              } else {
                completed = true;
                clearTimeout(timer);
                resolve(item.dataUrl || item.url || '');
              }
            } catch (e) {
              if (!completed) {
                completed = true;
                clearTimeout(timer);
                if (item.dataUrl || item.url) {
                  resolve(item.dataUrl || item.url);
                } else if (item.file) {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = () => resolve('');
                  reader.readAsDataURL(item.file);
                } else {
                  resolve('');
                }
              }
            }
          });
        });

        uploadedUrls = (await Promise.all(uploadPromises)).filter(Boolean);
        clearInterval(progressInterval);
      }

      setUploadStatus('Publishing post...');
      setUploadProgress(92);

      const payload: any = {
        content: caption,
        caption: caption,
        mediaUrls: uploadedUrls,
        mediaType: selectedType === 'video' ? 'video' : 'image',
        type: selectedType,
        authorId: profile?.id || 'unknown',
        authorUid: user?.uid || 'unknown',
        author: {
          displayName: profile?.displayName || profile?.fullName || profile?.name || 'User',
          username: profile?.username || 'user',
          photoURL: getAvatarUrl(profile?.photoURL),
          isVerified: profile?.isVerified || false
        },
        likesCount: 0,
        commentsCount: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        audience,
        allowComments,
        hideLikes,
        sensitiveWarning,
      };

      if (poll) payload.poll = poll;
      if (location) payload.location = location;
      if (selectedMusic) payload.music = selectedMusic;
      if (attachedGif) payload.attachedGif = attachedGif;
      if (linkPreview) payload.linkPreview = linkPreview;
      if (recordedAudio) payload.voiceUrl = recordedAudio;
      if (selectedType === 'text') {
        payload.gradientId = selectedGradient.id;
      }
      if (selectedType === 'video' && uploadedUrls[0]) {
        const vidUrl = uploadedUrls[0];
        if (vidUrl.includes('/video/upload/')) {
          payload.thumbnail = vidUrl
            .replace('/video/upload/', '/video/upload/so_0.5,f_jpg,q_auto/')
            .replace(/\.[a-zA-Z0-9]+(\?.*)?$/, '.jpg$1');
        }
      }

      await addDoc(collection(db, 'posts'), payload);

      setUploadProgress(100);
      setUploadStatus('Published successfully!');
      
      addToast({
        title: 'Post Live',
        message: 'Your post was published to Aeirmist.',
        type: 'success'
      });

      localStorage.removeItem('aeirmist_studio_draft');

      setTimeout(() => {
        onClose();
      }, 500);

    } catch (e: any) {
      logger.error('Publishing failed', e);
      addToast({
        title: 'Could Not Publish',
        message: 'An error occurred while publishing. Please try again.',
        type: 'warning'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const currentMedia = mediaFiles[selectedMediaIdx];
  const userDisplayName = profile?.displayName || profile?.fullName || profile?.name || 'User';

  return (
    <div className="flex flex-col h-full w-full text-white overflow-hidden font-sans bg-[#05070d]">
      
      {/* 1. TOP APP BAR */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-white/10 shrink-0 bg-[#070a12]/95 backdrop-blur-xl z-20">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-full transition-all cursor-pointer text-white/80 hover:text-white active:scale-95"
            aria-label="Close studio"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">Create Post</h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {localStorage.getItem('aeirmist_studio_draft') && (
            <button
              onClick={handleRestoreDraft}
              className="px-2.5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-[11px] font-bold rounded-xl transition-all cursor-pointer text-white/70 hover:text-white"
            >
              Restore
            </button>
          )}
          <button
            onClick={handleSaveDraft}
            className="px-2.5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-[11px] font-bold rounded-xl transition-all cursor-pointer hidden sm:block text-white/70 hover:text-white"
          >
            Save Draft
          </button>
          <button
            disabled={isUploading}
            onClick={handlePublish}
            className="px-5 py-2 bg-aeirmist-cyan text-black hover:brightness-110 active:scale-95 text-xs font-black uppercase rounded-full transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] disabled:opacity-40 flex items-center gap-1.5 justify-center cursor-pointer"
          >
            {isUploading ? (
              <Clock size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* 2. POST FORMAT PILL BAR */}
      <div className="px-3 sm:px-5 py-2.5 border-b border-white/5 bg-[#030408] shrink-0 overflow-x-auto no-scrollbar flex items-center gap-2">
        {[
          { id: 'photo', label: 'Photos / Videos', icon: Camera },
          { id: 'text', label: 'Story Card', icon: FileText },
          { id: 'poll', label: 'Poll', icon: ListTodo },
          { id: 'gif', label: 'GIF', icon: Sparkles },
          { id: 'link', label: 'Link Preview', icon: LinkIcon }
        ].map(mode => (
          <button
            key={mode.id}
            type="button"
            onClick={() => {
              setSelectedType(mode.id);
              setActiveTool(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
              selectedType === mode.id 
                ? 'bg-aeirmist-cyan text-black border-aeirmist-cyan shadow-md shadow-aeirmist-cyan/20 font-black' 
                : 'bg-white/[0.03] text-white/60 border-white/5 hover:text-white hover:bg-white/10'
            }`}
          >
            <mode.icon size={13} />
            <span>{mode.label}</span>
          </button>
        ))}
      </div>

      {/* 3. SCROLLABLE COMPOSER BODY */}
      <div className="flex-1 overflow-y-auto bg-[#020509] p-3 sm:p-6 space-y-4">
        
        {/* A. INTERACTIVE MEDIA / CANVAS PREVIEW STAGE */}
        <div className="w-full bg-[#010307] rounded-3xl border border-white/10 p-3 sm:p-4 overflow-hidden shadow-2xl space-y-3">
          
          <div className="w-full aspect-[4/3] sm:aspect-video max-h-[360px] sm:max-h-[460px] rounded-2xl overflow-hidden bg-black/60 border border-white/5 relative flex items-center justify-center select-none shadow-inner">
            
            {/* 1. PHOTO & VIDEO MODE */}
            {selectedType === 'photo' && (
              mediaFiles.length > 0 ? (
                <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-black">
                  {currentMedia?.type?.startsWith('video/') ? (
                    <video
                      src={currentMedia.url}
                      className={`max-h-full w-full object-contain ${currentMedia.fitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                      style={{
                        filter: `brightness(${currentMedia.brightness ?? 100}%) contrast(${currentMedia.contrast ?? 100}%) saturate(${currentMedia.saturation ?? 100}%) blur(${currentMedia.blur ?? 0}px) hue-rotate(${currentMedia.warmth ?? 0}deg)`,
                        transform: `rotate(${currentMedia.rotate ?? 0}deg) scaleX(${currentMedia.flipX ? -1 : 1}) scaleY(${currentMedia.flipY ? -1 : 1})`,
                      }}
                      controls
                      autoPlay
                      loop
                      muted={currentMedia.muted}
                    />
                  ) : (
                    <img
                      src={currentMedia.url}
                      alt="Preview"
                      className={`max-h-full w-full object-contain ${currentMedia.fitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                      style={{
                        filter: `brightness(${currentMedia.brightness ?? 100}%) contrast(${currentMedia.contrast ?? 100}%) saturate(${currentMedia.saturation ?? 100}%) blur(${currentMedia.blur ?? 0}px) hue-rotate(${currentMedia.warmth ?? 0}deg)`,
                        transform: `rotate(${currentMedia.rotate ?? 0}deg) scaleX(${currentMedia.flipX ? -1 : 1}) scaleY(${currentMedia.flipY ? -1 : 1})`,
                      }}
                    />
                  )}

                  {/* Overlay Quick Action: Edit Filters button */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                    <button
                      type="button"
                      onClick={() => setActiveTool(activeTool === 'filters' ? null : 'filters')}
                      className="px-3 py-1.5 bg-black/80 backdrop-blur-md border border-white/20 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                    >
                      <Sliders size={13} className="text-aeirmist-cyan" />
                      <span>{activeTool === 'filters' ? 'Close Editor' : 'Edit & Crop'}</span>
                    </button>
                  </div>

                  {/* Sound Tag Indicator on Media */}
                  {selectedMusic && (
                    <div className="absolute bottom-3 left-3 bg-black/85 backdrop-blur-md border border-white/20 rounded-xl px-2.5 py-1 flex items-center gap-1.5 text-[10px] text-white shadow-lg">
                      <MusicIcon size={12} className="text-aeirmist-cyan animate-pulse" />
                      <span className="font-bold truncate max-w-[150px]">{selectedMusic.track.title}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty Media Dropzone */
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-14 h-14 rounded-2xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan mb-3 shadow-lg">
                    <ImageIcon size={28} />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white mb-1">Add Photos & Videos</h3>
                  <p className="text-[10px] text-white/40 mb-3 font-mono">JPG, PNG, WEBP, MP4 (Up to 10 files)</p>
                  <button
                    type="button"
                    className="px-4 py-2 bg-aeirmist-cyan text-black font-black text-xs uppercase tracking-wider rounded-full shadow-lg shadow-aeirmist-cyan/20 active:scale-95 transition-all"
                  >
                    Select From Device
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAddMediaFiles}
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                  />
                </div>
              )
            )}

            {/* 2. TEXT CARD MODE */}
            {selectedType === 'text' && (
              selectedGradient.id === 'plain' ? (
                <div className="w-full h-full p-5 sm:p-6 flex flex-col justify-between text-left bg-[#060a12]">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={getAvatarUrl(profile?.photoURL)} 
                      className="w-8 h-8 rounded-full border border-white/20 object-cover" 
                      alt="" 
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>{userDisplayName}</span>
                        {profile?.isVerified && <ShieldCheck size={12} className="text-aeirmist-cyan" />}
                      </div>
                      <div className="text-[9px] text-white/40 font-mono">Plain Text Feed Post</div>
                    </div>
                  </div>

                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Type your story, thoughts, or update here..."
                    maxLength={3000}
                    rows={6}
                    className="w-full bg-transparent text-sm text-white focus:outline-none resize-none leading-relaxed placeholder:text-white/30 my-auto py-2"
                  />

                  <div className="flex justify-between items-center text-[10px] text-white/40 font-mono pt-2 border-t border-white/10">
                    <span>Aeirmist Story</span>
                    <span>{caption.length} / 3000</span>
                  </div>
                </div>
              ) : (
                <div 
                  className="w-full h-full p-6 sm:p-8 flex flex-col justify-between text-center relative overflow-hidden transition-all duration-300"
                  style={{ background: selectedGradient.css }}
                >
                  <div className="flex items-center gap-2.5 text-left z-10">
                    <img src={getAvatarUrl(profile?.photoURL)} className="w-8 h-8 rounded-full border border-white/20 object-cover" alt="" />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>{userDisplayName}</span>
                        {profile?.isVerified && <ShieldCheck size={12} className="text-aeirmist-cyan" />}
                      </div>
                      <div className="text-[9px] text-white/50 uppercase tracking-widest font-mono">Canvas Card</div>
                    </div>
                  </div>

                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Type your highlight quote or story here..."
                    maxLength={3000}
                    rows={4}
                    className="w-full bg-transparent text-center text-base sm:text-lg font-bold text-white leading-relaxed placeholder:text-white/30 focus:outline-none resize-none z-10 my-auto px-2"
                  />

                  <div className="flex justify-between items-center text-[10px] text-white/50 tracking-wider font-mono z-10 pt-2 border-t border-white/10">
                    <span>{selectedGradient.label}</span>
                    <span>{caption.length} / 3000</span>
                  </div>
                </div>
              )
            )}

            {/* 3. POLL MODE */}
            {selectedType === 'poll' && (
              <div className="w-full max-w-sm bg-[#080d17] border border-white/10 p-5 rounded-2xl space-y-3 text-left shadow-2xl">
                <div className="flex items-center gap-2 text-aeirmist-cyan font-bold text-xs uppercase tracking-wider">
                  <ListTodo size={16} />
                  <span>Interactive Poll</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-white">{poll?.question || 'Your Poll Question Here'}</div>
                <div className="space-y-1.5">
                  {(poll?.options || ['Option 1', 'Option 2']).map((opt: string, i: number) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold flex justify-between items-center">
                      <span>{opt || `Option ${i + 1}`}</span>
                      <span className="text-white/40 font-mono text-[10px]">0%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. GIF MODE */}
            {selectedType === 'gif' && (
              attachedGif ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img src={attachedGif} className="max-h-full w-full object-contain" alt="GIF" />
                  <button 
                    onClick={() => setAttachedGif(null)}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/80 text-white hover:bg-black transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-sm p-4 text-center">
                  <GifPicker onSelect={(gif) => setAttachedGif(gif)} />
                </div>
              )
            )}

            {/* 5. LINK MODE */}
            {selectedType === 'link' && (
              <div className="w-full max-w-sm bg-[#080d17] border border-white/10 rounded-2xl overflow-hidden shadow-2xl text-left">
                {linkPreview ? (
                  <div>
                    <img src={linkPreview.image} className="w-full h-32 object-cover" alt="" />
                    <div className="p-3 space-y-1 border-t border-white/10">
                      <div className="text-[11px] text-aeirmist-cyan font-bold truncate">{linkPreview.url}</div>
                      <div className="text-xs font-bold text-white">{linkPreview.title}</div>
                      <div className="text-[10px] text-white/50 leading-relaxed line-clamp-2">{linkPreview.description}</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center space-y-2">
                    <LinkIcon size={30} className="mx-auto text-white/30" />
                    <h4 className="text-xs font-bold text-white">Attach Web Link</h4>
                    <p className="text-[10px] text-white/40">Use the link row below to fetch title and preview card.</p>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* CAROUSEL THUMBNAIL STRIP */}
          {selectedType === 'photo' && mediaFiles.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 shrink-0">
              {mediaFiles.map((file, idx) => (
                <div 
                  key={idx}
                  onClick={() => setSelectedMediaIdx(idx)}
                  className={`relative w-12 h-12 rounded-xl overflow-hidden cursor-pointer border shrink-0 group transition-all ${
                    selectedMediaIdx === idx 
                      ? 'border-aeirmist-cyan ring-2 ring-aeirmist-cyan/30 scale-105 shadow-md' 
                      : 'border-white/15 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={file.url} className="w-full h-full object-cover" alt="" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const filtered = mediaFiles.filter((_, i) => i !== idx);
                      setMediaFiles(filtered);
                      setSelectedMediaIdx(0);
                    }}
                    className="absolute top-0 right-0 bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-md"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              {mediaFiles.length < 10 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-xl border border-dashed border-white/20 hover:border-aeirmist-cyan flex flex-col items-center justify-center text-white/50 hover:text-white transition-colors shrink-0 bg-white/[0.02]"
                  title="Add more photos or videos"
                >
                  <Plus size={16} />
                  <span className="text-[8px] font-bold uppercase mt-0.5">Add</span>
                </button>
              )}
            </div>
          )}

        </div>

        {/* B. AUTHOR BAR & CAPTION INPUT */}
        <div className="bg-[#04060c] border border-white/10 rounded-2xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img 
                src={getAvatarUrl(profile?.photoURL)} 
                className="w-9 h-9 rounded-full border border-white/20 object-cover shadow-sm" 
                alt="" 
              />
              <div>
                <span className="text-xs font-bold text-white block">{userDisplayName}</span>
                <span className="text-[10px] text-white/40 block font-mono">
                  @{profile?.username && profile.username !== 'user' && profile.username !== 'null'
                    ? profile.username.replace(/^@+/, '')
                    : (userDisplayName && userDisplayName.toLowerCase() !== 'user'
                        ? userDisplayName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                        : 'member')}
                </span>
              </div>
            </div>

            {/* Audience Pill */}
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as any)}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1 text-[11px] font-bold text-white focus:outline-none focus:border-aeirmist-cyan cursor-pointer transition-colors"
            >
              <option value="public" className="bg-[#05080e] text-white">Public</option>
              <option value="followers" className="bg-[#05080e] text-white">Followers</option>
              <option value="close_friends" className="bg-[#05080e] text-white">Close Friends</option>
              <option value="only_me" className="bg-[#05080e] text-white">Private</option>
            </select>
          </div>

          {selectedType !== 'text' && (
            <div className="space-y-1 pt-1">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption, mention @friends, add #hashtags..."
                rows={3}
                maxLength={3000}
                className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan resize-none leading-relaxed transition-all"
              />
              <div className="flex justify-between items-center text-[10px] text-white/30 font-mono px-1">
                <span>**bold** *italic*</span>
                <span>{caption.length} / 3000</span>
              </div>
            </div>
          )}
        </div>

        {/* C. CATEGORIZED FEATURE ROWS (শ্রেণীবদ্ধ ফিচার লিস্ট) */}
        <div className="bg-[#04060c] border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
          
          {/* 1. Add Music / Sound */}
          <div 
            onClick={() => setActiveTool(activeTool === 'music' ? null : 'music')}
            className="flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan">
                <MusicIcon size={15} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Add Music & Soundtrack</div>
                <div className="text-[10px] text-white/40 truncate max-w-[200px]">
                  {selectedMusic ? `${selectedMusic.track.title} • ${selectedMusic.track.artist}` : 'Hindi, Bangla, Spotify hits'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedMusic && <span className="w-2 h-2 rounded-full bg-green-400" />}
              <ChevronRight size={15} className={`text-white/30 transition-transform ${activeTool === 'music' ? 'rotate-90 text-aeirmist-cyan' : ''}`} />
            </div>
          </div>

          {/* 2. Tag People */}
          <div 
            onClick={() => setActiveTool(activeTool === 'tag' ? null : 'tag')}
            className="flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Users size={15} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Tag People</div>
                <div className="text-[10px] text-white/40">
                  {taggedPeople.length > 0 ? `${taggedPeople.length} user(s) tagged` : 'Tag friends in this post'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {taggedPeople.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                  {taggedPeople.length}
                </span>
              )}
              <ChevronRight size={15} className={`text-white/30 transition-transform ${activeTool === 'tag' ? 'rotate-90 text-aeirmist-cyan' : ''}`} />
            </div>
          </div>

          {/* 3. Add Location */}
          <div 
            onClick={() => setActiveTool(activeTool === 'location' ? null : 'location')}
            className="flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <MapPin size={15} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Add Location</div>
                <div className="text-[10px] text-white/40 truncate max-w-[200px]">
                  {location || 'Search place or city'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {location && <span className="w-2 h-2 rounded-full bg-pink-400" />}
              <ChevronRight size={15} className={`text-white/30 transition-transform ${activeTool === 'location' ? 'rotate-90 text-aeirmist-cyan' : ''}`} />
            </div>
          </div>

          {/* 4. Canvas Theme (Only for Text Mode) */}
          {selectedType === 'text' && (
            <div 
              onClick={() => setActiveTool(activeTool === 'theme' ? null : 'theme')}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sparkles size={15} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Story Card Theme</div>
                  <div className="text-[10px] text-white/40">{selectedGradient.label}</div>
                </div>
              </div>
              <ChevronRight size={15} className={`text-white/30 transition-transform ${activeTool === 'theme' ? 'rotate-90 text-aeirmist-cyan' : ''}`} />
            </div>
          )}

          {/* 5. Poll Options (Only for Poll Mode) */}
          {selectedType === 'poll' && (
            <div 
              onClick={() => setActiveTool(activeTool === 'poll' ? null : 'poll')}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <ListTodo size={15} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Edit Poll Questions & Choices</div>
                  <div className="text-[10px] text-white/40">Customize choices and answers</div>
                </div>
              </div>
              <ChevronRight size={15} className={`text-white/30 transition-transform ${activeTool === 'poll' ? 'rotate-90 text-aeirmist-cyan' : ''}`} />
            </div>
          )}

          {/* 6. Link Metadata (Only for Link Mode) */}
          {selectedType === 'link' && (
            <div 
              onClick={() => setActiveTool(activeTool === 'link' ? null : 'link')}
              className="flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <LinkIcon size={15} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Configure Web Link URL</div>
                  <div className="text-[10px] text-white/40 truncate max-w-[200px]">{linkUrl || 'Enter target website link'}</div>
                </div>
              </div>
              <ChevronRight size={15} className={`text-white/30 transition-transform ${activeTool === 'link' ? 'rotate-90 text-aeirmist-cyan' : ''}`} />
            </div>
          )}

          {/* 7. Advanced Settings */}
          <div 
            onClick={() => setActiveTool(activeTool === 'settings' ? null : 'settings')}
            className="flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-zinc-700/30 border border-white/10 flex items-center justify-center text-white/70">
                <Settings size={15} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Advanced Options</div>
                <div className="text-[10px] text-white/40">Comments, like counts & flags</div>
              </div>
            </div>
            <ChevronRight size={15} className={`text-white/30 transition-transform ${activeTool === 'settings' ? 'rotate-90 text-aeirmist-cyan' : ''}`} />
          </div>

        </div>

        {/* D. ACTIVE SLIDE-UP DRAWER (Clean contextual modal) */}
        {activeTool && (
          <div className="bg-[#090d16] border border-white/15 rounded-3xl p-4 sm:p-5 space-y-3.5 relative shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-black uppercase text-aeirmist-cyan tracking-wider">
                {activeTool === 'filters' && 'Media Filters & Adjustments'}
                {activeTool === 'music' && 'Music & Soundtrack'}
                {activeTool === 'tag' && 'Tag People'}
                {activeTool === 'location' && 'Add Location'}
                {activeTool === 'theme' && 'Canvas Card Background'}
                {activeTool === 'poll' && 'Configure Poll'}
                {activeTool === 'link' && 'Web Link Card'}
                {activeTool === 'settings' && 'Advanced Post Settings'}
              </span>
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Drawer Components */}
            <div>
              {activeTool === 'filters' && currentMedia && (
                <div className="py-1">
                  <MediaEditor
                    file={currentMedia}
                    onChange={handleMediaChange}
                  />
                </div>
              )}

              {activeTool === 'music' && (
                <MusicSelector
                  selectedTrack={selectedMusic}
                  onChange={setSelectedMusic}
                />
              )}

              {activeTool === 'tag' && (
                <TagPeople
                  taggedUsers={taggedPeople}
                  onChange={setTaggedPeople}
                />
              )}

              {activeTool === 'location' && (
                <LocationSearch
                  selectedLocation={location}
                  onSelect={setLocation}
                />
              )}

              {activeTool === 'theme' && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {THEME_GRADIENTS.map(grad => (
                    <button
                      key={grad.id}
                      type="button"
                      onClick={() => setSelectedGradient(grad)}
                      className={`p-3 rounded-2xl text-xs font-bold border text-left truncate transition-all cursor-pointer ${
                        selectedGradient.id === grad.id 
                          ? 'border-aeirmist-cyan shadow-md shadow-aeirmist-cyan/20 text-white' 
                          : 'border-white/10 text-white/60 hover:text-white'
                      }`}
                      style={{ background: grad.css }}
                    >
                      {grad.label}
                    </button>
                  ))}
                </div>
              )}

              {activeTool === 'poll' && (
                <PollComposer poll={poll} onChange={setPoll} />
              )}

              {activeTool === 'link' && (
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-white/70 block">Target URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-aeirmist-cyan"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        if (!linkUrl) return;
                        setLinkPreview({
                          url: linkUrl,
                          title: `${linkUrl.replace('https://', '').split('/')[0]} Hub`,
                          description: 'Explore verified shared channels and updates instantly on Aeirmist platform.',
                          image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80'
                        });
                      }}
                      className="px-4 bg-aeirmist-cyan text-black text-xs font-bold rounded-xl hover:brightness-110 transition-all"
                    >
                      Fetch
                    </button>
                  </div>
                </div>
              )}

              {activeTool === 'settings' && (
                <div className="space-y-3 pt-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/80">Allow Comments</span>
                    <button 
                      type="button"
                      onClick={() => setAllowComments(!allowComments)} 
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${allowComments ? 'bg-aeirmist-cyan' : 'bg-white/10'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-black transition-transform ${allowComments ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/80">Hide Like Counts</span>
                    <button 
                      type="button"
                      onClick={() => setHideLikes(!hideLikes)} 
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${hideLikes ? 'bg-aeirmist-cyan' : 'bg-white/10'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-black transition-transform ${hideLikes ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/80">Sensitive Content Flag</span>
                    <button 
                      type="button"
                      onClick={() => setSensitiveWarning(!sensitiveWarning)} 
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${sensitiveWarning ? 'bg-red-500' : 'bg-white/10'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-black transition-transform ${sensitiveWarning ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* FAST PUBLISH OVERLAY */}
      {isUploading && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-[#06090f] border border-white/10 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center mx-auto text-aeirmist-cyan">
              <Clock size={24} className="animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Publishing Post</h3>
              <p className="text-xs text-aeirmist-cyan font-semibold">{uploadStatus || 'Processing media...'}</p>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-aeirmist-cyan h-full rounded-full transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="text-xs font-mono text-white/40">{uploadProgress}%</div>
          </div>
        </div>
      )}
    </div>
  );
});
