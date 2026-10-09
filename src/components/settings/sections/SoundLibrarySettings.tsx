import React, { useState, useEffect, useRef } from 'react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  Music, 
  Upload, 
  Trash2, 
  Play, 
  Pause, 
  Check, 
  AlertCircle, 
  Disc, 
  Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logger } from '@/src/utils/logger';


const CATEGORIES = ['Chill', 'Upbeat', 'Electronic', 'Ambient', 'Acoustic', 'Hip Hop', 'Cinematic'];

export const SoundLibrarySettings = () => {
  const { db, user, uploadMedia, addToast } = useAeirmist();
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [category, setCategory] = useState('Chill');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  
  // Upload Progress
  const [uploading, setUploading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [coverProgress, setCoverProgress] = useState(0);

  // Audio Preview State
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Fetch Tracks
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'sound_library'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setTracks(list);
      setLoading(false);
    }, (error) => {
      logger.error('Error fetching sound library:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handlePlayPause = (track: any) => {
    if (playingTrackId === track.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingTrackId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(track.audioURL);
      audioRef.current.play().catch(err => {
        logger.error('Playback error:', err);
        addToast?.({
          title: 'PLAYBACK ERROR',
          message: 'Unable to play this audio file.',
          type: 'warning'
        });
      });
      setPlayingTrackId(track.id);

      audioRef.current.onended = () => {
        setPlayingTrackId(null);
      };
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      addToast?.({
        title: 'AUTH REQUIRED',
        message: 'You must be signed in to upload sounds.',
        type: 'warning'
      });
      return;
    }

    if (!title.trim() || !artist.trim() || !audioFile) {
      addToast?.({
        title: 'FIELDS REQUIRED',
        message: 'Please provide Title, Artist, and an MP3 file.',
        type: 'warning'
      });
      return;
    }

    setUploading(true);
    setAudioProgress(0);
    setCoverProgress(0);

    try {
      // 1. Upload Audio file
      const trackId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const audioPath = `sound-library/${user?.uid}/${trackId}`;
      
      const audioURL = await uploadMedia(
        audioFile, 
        audioPath, 
        (progress) => setAudioProgress(progress)
      );

      // 2. Upload Cover Image or use fallback
      let coverArtURL = 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=200&auto=format&fit=crop'; // fallback gradient cover
      if (coverFile) {
        const coverPath = `sound-library-art/${user?.uid}/${trackId}`;
        coverArtURL = await uploadMedia(
          coverFile,
          coverPath,
          (progress) => setCoverProgress(progress)
        );
      }

      // 3. Save Doc to Firestore
      const trackDoc = {
        title: title.trim(),
        artist: artist.trim(),
        audioURL,
        coverArtURL,
        category,
        usageCount: 0,
        uploaderUid: user.uid,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'sound_library'), trackDoc);

      addToast?.({
        title: 'SONIC SEQUENCE SYNCED',
        message: `Successfully uploaded "${title}" to Sound Library.`,
        type: 'success'
      });

      // Reset form
      setTitle('');
      setArtist('');
      setCategory('Chill');
      setAudioFile(null);
      setCoverFile(null);
    } catch (error) {
      logger.error('Upload failed:', error);
      addToast?.({
        title: 'UPLOAD FAILED',
        message: 'An error occurred during upload. Please try again.',
        type: 'warning'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (track: any) => {
    if (!user || track.uploaderUid !== user.uid) {
      addToast?.({
        title: 'UNAUTHORIZED',
        message: 'You can only delete tracks you uploaded.',
        type: 'warning'
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete "${track.title}" from the registry?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'sound_library', track.id));
      if (playingTrackId === track.id) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setPlayingTrackId(null);
      }
      addToast?.({
        title: 'SEQUENCE VAPORIZED',
        message: `Successfully deleted "${track.title}".`,
        type: 'success'
      });
    } catch (error) {
      logger.error('Delete failed:', error);
      addToast?.({
        title: 'DELETE FAILED',
        message: 'An error occurred while deleting the track.',
        type: 'warning'
      });
    }
  };

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="text-3xl font-display font-bold text-white">Sound Library Registry</h2>
        <p className="text-xs text-white/45 uppercase tracking-widest font-medium">Manage and upload high-fidelity tracks to the network</p>
      </div>

      {/* Grid Layout: Upload and List */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Upload New Sound */}
        <div className="xl:col-span-5 space-y-6">
          <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/10 backdrop-blur-md shadow-xl space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-aeirmist-cyan flex items-center gap-2">
              <Upload size={16} /> Load sonic activity
            </h3>

            <form onSubmit={handleUpload} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 ml-1 mb-1.5">Track Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chill Beat 1"
                  disabled={uploading}
                  className="w-full h-11 px-4 bg-white/[0.03] border border-white/10 rounded-xl text-xs font-mono text-white placeholder:text-white/20 focus:border-aeirmist-cyan/40 focus:bg-white/[0.05] outline-none transition-all"
                  required
                />
              </div>

              {/* Artist */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 ml-1 mb-1.5">Artist / Creator</label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="e.g. Aeirmist Network"
                  disabled={uploading}
                  className="w-full h-11 px-4 bg-white/[0.03] border border-white/10 rounded-xl text-xs font-mono text-white placeholder:text-white/20 focus:border-aeirmist-cyan/40 focus:bg-white/[0.05] outline-none transition-all"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 ml-1 mb-1.5">Acoustic Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={uploading}
                  className="w-full h-11 px-4 bg-white/[0.03] border border-white/10 rounded-xl text-xs font-mono text-white/80 focus:border-aeirmist-cyan/40 focus:bg-white/[0.05] outline-none transition-all appearance-none cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#0b0c10] text-white/80">{cat}</option>
                  ))}
                </select>
              </div>

              {/* MP3 File Selection */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 ml-1 mb-1.5">Audio File (MP3)</label>
                <input
                  type="file"
                  accept="audio/mp3, audio/mpeg"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  ref={audioInputRef}
                  disabled={uploading}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={uploading}
                  className={`w-full h-16 rounded-xl border border-dashed transition-all flex flex-col items-center justify-center p-2 text-center ${
                    audioFile 
                      ? 'border-aeirmist-cyan/30 bg-aeirmist-cyan/[0.02] text-aeirmist-cyan' 
                      : 'border-white/10 bg-white/[0.01] text-white/40 hover:border-white/20'
                  }`}
                >
                  <Music size={18} className={audioFile ? 'animate-bounce mb-1' : 'mb-1'} />
                  <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-full px-4">
                    {audioFile ? audioFile.name : 'Select or Drop MP3 File'}
                  </span>
                </button>
              </div>

              {/* Cover Art Selection (Optional) */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 ml-1 mb-1.5">Cover Art (Optional Image)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  ref={coverInputRef}
                  disabled={uploading}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploading}
                  className={`w-full h-16 rounded-xl border border-dashed transition-all flex flex-col items-center justify-center p-2 text-center ${
                    coverFile 
                      ? 'border-aeirmist-magenta/30 bg-aeirmist-magenta/[0.02] text-aeirmist-magenta' 
                      : 'border-white/10 bg-white/[0.01] text-white/40 hover:border-white/20'
                  }`}
                >
                  <Disc size={18} className={coverFile ? 'animate-spin mb-1' : 'mb-1'} />
                  <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-full px-4">
                    {coverFile ? coverFile.name : 'Select Cover Image'}
                  </span>
                </button>
              </div>

              {/* Submit / Progress Section */}
              <div className="pt-4 space-y-4">
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-mono font-bold text-white/40">
                      <span>Audio Syncing</span>
                      <span className="text-aeirmist-cyan">{Math.round(audioProgress)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-aeirmist-cyan transition-all duration-300" style={{ width: `${audioProgress}%` }} />
                    </div>

                    {coverFile && (
                      <>
                        <div className="flex justify-between items-center text-[9px] font-mono font-bold text-white/40 mt-1">
                          <span>Artwork Syncing</span>
                          <span className="text-aeirmist-magenta">{Math.round(coverProgress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-aeirmist-magenta transition-all duration-300" style={{ width: `${coverProgress}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploading || !audioFile}
                  className="w-full h-12 rounded-xl bg-aeirmist-cyan hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-40 transition-all text-black font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(0,242,255,0.2)]"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Syncing Sonic Vector...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Inject to Registry
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Registered Sonic Waves */}
        <div className="xl:col-span-7 space-y-4">
          <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/10 backdrop-blur-md shadow-xl flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Music size={16} /> Registered Waves ({tracks.length})
              </h3>
              <div className="text-[10px] font-mono text-white/40 uppercase">Secure Database Ledger</div>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-aeirmist-cyan" size={32} />
                <span className="text-xs font-mono text-white/30 uppercase tracking-widest">Accessing Ledger...</span>
              </div>
            ) : tracks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 py-20 gap-4">
                <Disc className="w-16 h-16 animate-pulse text-white/40" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-white">Registry Empty</p>
                  <p className="text-[10px] font-mono mt-1 text-white/60 lowercase">Upload your first audio track to prime the frequency.</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto no-scrollbar max-h-[600px] space-y-2.5 pr-1">
                {tracks.map((track) => {
                  const isCurrentPlaying = playingTrackId === track.id;
                  const isUploader = user && track.uploaderUid === user.uid;

                  return (
                    <div 
                      key={track.id} 
                      className="p-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl flex items-center gap-4 transition-all group"
                    >
                      {/* Cover art image */}
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                        <img 
                          src={track.coverArtURL} 
                          alt="" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={() => handlePlayPause(track)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200"
                        >
                          {isCurrentPlaying ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                      </div>

                      {/* Track Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] font-mono text-white/40">
                            {track.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 truncate mt-0.5">{track.artist}</p>
                        <div className="text-[8px] font-mono text-white/20 mt-1">
                          Used {track.usageCount || 0} times
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePlayPause(track)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            isCurrentPlaying 
                              ? 'bg-aeirmist-cyan text-black shadow-[0_0_12px_rgba(0,242,255,0.4)]' 
                              : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {isCurrentPlaying ? <Pause size={14} /> : <Play size={14} />}
                        </button>

                        {isUploader && (
                          <button
                            type="button"
                            onClick={() => handleDelete(track)}
                            className="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center justify-center transition-all"
                            title="Vaporize Sequence"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
