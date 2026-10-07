import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAeirmist } from '../../context/AeirmistContext';
import { api } from '../../services/api/client';
import { 
  X, Check, Loader2, AlertTriangle, Plus, Upload, 
  ChevronLeft, Camera, Image as ImageIcon, Film, Trash2, Edit3 
} from 'lucide-react';
import { logger } from '@/src/utils/logger';

interface HighlightManagerModalProps {
  mode: 'create' | 'edit';
  existingHighlight?: { id: string; label: string; coverUrl: string; stories: string[] };
  onClose: () => void;
  onSaved: () => void;
  userPosts?: any[];
}

export const HighlightManagerModal: React.FC<HighlightManagerModalProps> = ({
  mode,
  existingHighlight,
  onClose,
  onSaved,
  userPosts = []
}) => {
  const { db, user, uploadMedia, addToast } = useAeirmist();

  // Navigation steps: 1 = Select Media, 2 = Name & Edit Cover
  const [step, setStep] = useState<1 | 2>(mode === 'edit' ? 2 : 1);
  const [activeTab, setActiveTab] = useState<'stories' | 'upload' | 'posts'>('stories');

  // Form State
  const [label, setLabel] = useState(existingHighlight?.label || '');
  const [userStories, setUserStories] = useState<any[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);

  // Selected story IDs & local uploaded media items
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>(existingHighlight?.stories || []);
  const [localUploadedFiles, setLocalUploadedFiles] = useState<{ id: string; file: File; previewUrl: string; type: 'image' | 'video' }[]>([]);
  const [selectedPostItems, setSelectedPostItems] = useState<{ id: string; url: string; type: 'image' | 'video' }[]>([]);

  // Cover Photo
  const [coverStoryId, setCoverStoryId] = useState<string | null>(null);
  const [customCoverUrl, setCustomCoverUrl] = useState<string>(existingHighlight?.coverUrl || '');
  const [customCoverFile, setCustomCoverFile] = useState<File | null>(null);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);

  // Loading / Deleting
  const [isSaving, setIsSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Hidden File Inputs
  const deviceFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch the current user's own stories (archived or active)
  useEffect(() => {
    if (!user?.uid) return;

    setLoadingStories(true);
    api.stories.getArchive()
      .then((res) => {
        const fetched = res.stories || [];
        setUserStories(fetched);
        setLoadingStories(false);
      })
      .catch((error) => {
        logger.error("Error fetching stories in HighlightManagerModal", error);
        setLoadingStories(false);
      });
  }, [user?.uid]);

  // Set initial cover
  useEffect(() => {
    if (existingHighlight?.coverUrl) {
      setCustomCoverUrl(existingHighlight.coverUrl);
    }
  }, [existingHighlight]);

  // Handle device file selection
  const handleDeviceFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: { id: string; file: File; previewUrl: string; type: 'image' | 'video' }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewUrl = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video');
      const tempId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      newItems.push({
        id: tempId,
        file,
        previewUrl,
        type: isVideo ? 'video' : 'image'
      });
    }

    setLocalUploadedFiles(prev => [...prev, ...newItems]);
    // Automatically select newly picked files
    setSelectedStoryIds(prev => [...prev, ...newItems.map(item => item.id)]);

    // Reset input
    if (deviceFileInputRef.current) deviceFileInputRef.current.value = '';
  };

  // Handle custom cover image selection
  const handleCoverFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomCoverFile(file);
    const previewUrl = URL.createObjectURL(file);
    setCustomCoverUrl(previewUrl);
    setCoverStoryId(null);
    setIsCoverPickerOpen(false);

    if (coverFileInputRef.current) coverFileInputRef.current.value = '';
  };

  // Toggle selection for an item
  const toggleSelection = (itemId: string) => {
    setSelectedStoryIds(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  // Toggle selection for a post item
  const togglePostSelection = (post: any) => {
    const mediaUrl = post.mediaUrl || post.mediaUrls?.[0] || post.photo || post.imageUrl;
    if (!mediaUrl) return;

    const postId = `post_${post.id}`;
    if (selectedStoryIds.includes(postId)) {
      setSelectedStoryIds(prev => prev.filter(id => id !== postId));
      setSelectedPostItems(prev => prev.filter(p => p.id !== postId));
    } else {
      setSelectedStoryIds(prev => [...prev, postId]);
      setSelectedPostItems(prev => [
        ...prev,
        {
          id: postId,
          url: mediaUrl,
          type: (post.mediaType === 'video' || post.videoUrl) ? 'video' : 'image'
        }
      ]);
    }
  };

  // Total selected items count
  const totalSelectedCount = selectedStoryIds.length;

  // Determine active cover preview URL
  const activeCoverPreview = useMemo(() => {
    if (customCoverUrl) return customCoverUrl;

    if (coverStoryId) {
      const storyMatch = userStories.find(s => s.id === coverStoryId);
      if (storyMatch?.mediaUrl) return storyMatch.mediaUrl;

      const localMatch = localUploadedFiles.find(f => f.id === coverStoryId);
      if (localMatch?.previewUrl) return localMatch.previewUrl;

      const postMatch = selectedPostItems.find(p => p.id === coverStoryId);
      if (postMatch?.url) return postMatch.url;
    }

    // Default to the first selected item
    if (selectedStoryIds.length > 0) {
      const firstId = selectedStoryIds[0];
      const storyMatch = userStories.find(s => s.id === firstId);
      if (storyMatch?.mediaUrl) return storyMatch.mediaUrl;

      const localMatch = localUploadedFiles.find(f => f.id === firstId);
      if (localMatch?.previewUrl) return localMatch.previewUrl;

      const postMatch = selectedPostItems.find(p => p.id === firstId);
      if (postMatch?.url) return postMatch.url;
    }

    return '';
  }, [customCoverUrl, coverStoryId, selectedStoryIds, userStories, localUploadedFiles, selectedPostItems]);

  // Combined selected list for cover picker
  const allSelectedMediaList = useMemo(() => {
    const list: { id: string; url: string; type: 'image' | 'video' }[] = [];

    selectedStoryIds.forEach(id => {
      const storyMatch = userStories.find(s => s.id === id);
      if (storyMatch?.mediaUrl) {
        list.push({ id: storyMatch.id, url: storyMatch.mediaUrl, type: storyMatch.mediaType || 'image' });
        return;
      }
      const localMatch = localUploadedFiles.find(f => f.id === id);
      if (localMatch) {
        list.push({ id: localMatch.id, url: localMatch.previewUrl, type: localMatch.type });
        return;
      }
      const postMatch = selectedPostItems.find(p => p.id === id);
      if (postMatch) {
        list.push(postMatch);
      }
    });

    return list;
  }, [selectedStoryIds, userStories, localUploadedFiles, selectedPostItems]);

  // Save / Publish Highlight Handler
  const handleSave = async () => {
    if (!db || !user?.uid) return;

    const highlightTitle = label.trim() || 'Highlights';
    if (totalSelectedCount === 0 && mode === 'create') {
      addToast?.({ title: "Select Media", message: "Please select at least 1 photo or video for your highlight.", type: "warning" });
      return;
    }

    setIsSaving(true);
    setSavingProgress('Processing media...');

    try {
      const finalStoryIds: string[] = [];

      // 1. Process existing stories
      for (const id of selectedStoryIds) {
        if (!id.startsWith('local_') && !id.startsWith('post_')) {
          finalStoryIds.push(id);
        }
      }

      // 2. Upload any local files directly and create story records
      for (let i = 0; i < localUploadedFiles.length; i++) {
        const item = localUploadedFiles[i];
        if (!selectedStoryIds.includes(item.id)) continue;

        setSavingProgress(`Uploading ${i + 1} of ${localUploadedFiles.length}...`);
        let uploadedUrl = '';
        if (uploadMedia) {
          try {
            uploadedUrl = await uploadMedia(item.file, `users/${user.uid}/highlights`);
          } catch (e) {
            logger.warn("Storage upload fallback:", e);
          }
        }

        if (!uploadedUrl) {
          uploadedUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(item.file);
          });
        }

        const storyRes = await api.stories.create({
          mediaUrl: uploadedUrl,
          mediaType: item.type,
          caption: 'Highlight',
        });

        finalStoryIds.push(storyRes.story.id);

        // If this was chosen as cover
        if (coverStoryId === item.id) {
          setCustomCoverUrl(uploadedUrl);
        }
      }

      // 3. Convert any post items into story references
      for (const postItem of selectedPostItems) {
        if (!selectedStoryIds.includes(postItem.id)) continue;

        const storyRes = await api.stories.create({
          mediaUrl: postItem.url,
          mediaType: postItem.type,
          caption: 'Highlight post',
        });

        finalStoryIds.push(storyRes.story.id);

        if (coverStoryId === postItem.id) {
          setCustomCoverUrl(postItem.url);
        }
      }

      // 4. Upload custom cover file if provided
      let finalCoverUrl = customCoverUrl;
      if (customCoverFile) {
        setSavingProgress('Saving cover photo...');
        try {
          const coverRes = await api.media.upload(customCoverFile, 'highlights/covers');
          finalCoverUrl = coverRes.url;
        } catch (e) {
          logger.warn("Cover upload failed, falling back:", e);
        }
      }

      // Fallback cover if none set
      if (!finalCoverUrl) {
        if (finalStoryIds.length > 0) {
          const firstStory = userStories.find(s => s.id === finalStoryIds[0]);
          finalCoverUrl = firstStory?.mediaUrl || activeCoverPreview;
        } else {
          finalCoverUrl = activeCoverPreview;
        }
      }

      // 5. Save or update highlight document
      setSavingProgress('Finalizing highlight...');
      await api.stories.createHighlight({
        title: highlightTitle,
        coverUrl: finalCoverUrl,
        storyIds: finalStoryIds,
      });
      addToast?.({ 
        title: mode === 'create' ? "Highlight Published" : "Highlight Updated", 
        message: `"${highlightTitle}" saved to your profile highlights.`, 
        type: "success" 
      });

      onSaved();
      onClose();
    } catch (error) {
      logger.error("Failed to save highlight:", error);
      addToast?.({ title: "Operation Failed", message: "Could not save highlight. Please try again.", type: "warning" });
    } finally {
      setIsSaving(false);
      setSavingProgress('');
    }
  };

  // Delete Highlight Handler
  const handleDelete = async () => {
    if (!existingHighlight?.id) return;
    setIsDeleting(true);
    try {
      await api.stories.deleteHighlight(existingHighlight.id);
      addToast?.({ title: "Highlight Deleted", message: "Highlight removed from profile.", type: "success" });
      onSaved();
      onClose();
    } catch (error) {
      logger.error("Failed to delete highlight:", error);
      addToast?.({ title: "Error", message: "Failed to delete highlight.", type: "warning" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col justify-end sm:justify-center font-sans">
      {/* Hidden File Pickers */}
      <input 
        ref={deviceFileInputRef} 
        type="file" 
        multiple 
        accept="image/*,video/*" 
        className="hidden" 
        onChange={handleDeviceFilesSelected} 
      />
      <input 
        ref={coverFileInputRef} 
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleCoverFileSelected} 
      />

      {/* Dark backdrop overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Main Modal Container (Instagram Style) */}
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative bg-[#121212] sm:rounded-3xl rounded-t-3xl border border-white/10 flex flex-col max-h-[92vh] sm:max-h-[85vh] h-[92vh] sm:h-[680px] overflow-hidden z-10 w-full max-w-lg mx-auto shadow-2xl text-white"
      >
        {/* Top Instagram-Style Navigation Bar */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 shrink-0 bg-[#121212]">
          {step === 2 && mode === 'create' ? (
            <button 
              onClick={() => setStep(1)} 
              disabled={isSaving}
              className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors"
            >
              <ChevronLeft size={18} />
              <span>Back</span>
            </button>
          ) : (
            <button 
              onClick={onClose}
              disabled={isSaving}
              className="text-xs font-medium text-white/70 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}

          <h3 className="text-sm font-bold tracking-tight text-white">
            {mode === 'edit' ? 'Edit Highlight' : (step === 1 ? 'New Highlight' : 'Title & Cover')}
          </h3>

          {step === 1 ? (
            <button 
              onClick={() => setStep(2)}
              disabled={totalSelectedCount === 0}
              className={`text-xs font-bold transition-all px-2 py-1 rounded-lg ${
                totalSelectedCount > 0 
                  ? 'text-[#0095F6] hover:text-[#1877F2]' 
                  : 'text-white/20 cursor-not-allowed'
              }`}
            >
              Next
            </button>
          ) : (
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs font-bold text-[#0095F6] hover:text-[#1877F2] transition-all flex items-center gap-1.5 px-2 py-1"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin text-[#0095F6]" /> : (mode === 'create' ? 'Done' : 'Save')}
            </button>
          )}
        </div>

        {/* STEP 1: SELECT STORIES / PHOTOS (INSTAGRAM GRID) */}
        {step === 1 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Instagram Segmented Tabs */}
            <div className="flex border-b border-white/10 shrink-0 bg-[#121212]">
              {[
                { id: 'stories', label: 'Stories', count: userStories.length, icon: Film },
                { id: 'upload', label: 'Device / Gallery', count: localUploadedFiles.length, icon: Camera },
                { id: 'posts', label: 'Posts', count: userPosts.length, icon: ImageIcon }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                    activeTab === tab.id 
                      ? 'border-white text-white' 
                      : 'border-transparent text-white/40 hover:text-white/70'
                  }`}
                >
                  <tab.icon size={14} />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="text-[10px] font-mono opacity-60">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Selection Counter Pill */}
            <div className="px-4 py-2 bg-black/40 flex items-center justify-between text-[11px] text-white/50 border-b border-white/5 shrink-0">
              <span>{totalSelectedCount} selected</span>
              <button 
                onClick={() => deviceFileInputRef.current?.click()}
                className="text-[#0095F6] hover:underline font-semibold flex items-center gap-1"
              >
                <Plus size={13} />
                <span>Add from Phone</span>
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 custom-scrollbar">
              
              {/* TAB 1: ARCHIVED STORIES */}
              {activeTab === 'stories' && (
                <>
                  {loadingStories ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <Loader2 className="animate-spin text-[#0095F6]" size={24} />
                      <span className="text-xs text-white/50">Loading archived stories...</span>
                    </div>
                  ) : userStories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
                        <Film size={28} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">No Stories Found</h4>
                        <p className="text-xs text-white/50 max-w-xs">
                          You haven't posted any stories yet, but you can create a highlight right now by picking photos or videos from your device!
                        </p>
                      </div>
                      <button
                        onClick={() => deviceFileInputRef.current?.click()}
                        className="px-5 py-2.5 rounded-xl bg-[#0095F6] hover:bg-[#1877F2] text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2"
                      >
                        <Upload size={14} />
                        <span>Pick Photos / Videos from Device</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {/* Upload Tile at Front */}
                      <button 
                        onClick={() => deviceFileInputRef.current?.click()}
                        className="aspect-[3/4] rounded-xl border border-dashed border-white/20 bg-white/[0.02] hover:bg-white/[0.06] hover:border-[#0095F6] flex flex-col items-center justify-center gap-2 text-white/40 hover:text-white transition-all group"
                      >
                        <div className="p-3 rounded-full bg-white/5 group-hover:scale-110 transition-transform">
                          <Plus size={20} className="text-[#0095F6]" />
                        </div>
                        <span className="text-[10px] font-bold">Add from Device</span>
                      </button>

                      {userStories.map(story => {
                        const isSelected = selectedStoryIds.includes(story.id);
                        const selectIndex = selectedStoryIds.indexOf(story.id) + 1;
                        return (
                          <div 
                            key={story.id}
                            onClick={() => toggleSelection(story.id)}
                            className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border transition-all group select-none ${
                              isSelected ? 'border-[#0095F6] ring-2 ring-[#0095F6]' : 'border-white/10 hover:border-white/30'
                            }`}
                          >
                            <img 
                              src={story.mediaUrl} 
                              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                                isSelected ? 'opacity-90' : 'opacity-70 group-hover:opacity-100'
                              }`} 
                              alt="" 
                            />

                            {/* Instagram Selection Bubble */}
                            <div className="absolute top-2 right-2 z-10">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                isSelected 
                                  ? 'bg-[#0095F6] border-2 border-[#0095F6] text-white shadow-md' 
                                  : 'border-2 border-white/70 bg-black/40 text-transparent'
                              }`}>
                                {isSelected ? (totalSelectedCount > 1 ? selectIndex : <Check size={13} className="stroke-[3]" />) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: DEVICE UPLOADS */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  <div 
                    onClick={() => deviceFileInputRef.current?.click()}
                    className="p-8 border-2 border-dashed border-white/20 hover:border-[#0095F6] rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer flex flex-col items-center justify-center text-center transition-all group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-[#0095F6]/10 text-[#0095F6] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">Select from Phone / Device</h4>
                    <p className="text-xs text-white/40 max-w-xs">Tap to open your gallery and select photos or videos to include in this highlight.</p>
                  </div>

                  {localUploadedFiles.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Picked from Device ({localUploadedFiles.length})</p>
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {localUploadedFiles.map(fileItem => {
                          const isSelected = selectedStoryIds.includes(fileItem.id);
                          return (
                            <div
                              key={fileItem.id}
                              onClick={() => toggleSelection(fileItem.id)}
                              className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border transition-all ${
                                isSelected ? 'border-[#0095F6] ring-2 ring-[#0095F6]' : 'border-white/10 opacity-70'
                              }`}
                            >
                              <img src={fileItem.previewUrl} className="w-full h-full object-cover" alt="" />
                              <div className="absolute top-2 right-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  isSelected ? 'bg-[#0095F6] text-white' : 'border-2 border-white/70 bg-black/40'
                                }`}>
                                  {isSelected && <Check size={13} className="stroke-[3]" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: USER POSTS */}
              {activeTab === 'posts' && (
                <div>
                  {userPosts.length === 0 ? (
                    <div className="py-16 text-center text-white/40 text-xs">No posts available to add.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {userPosts.map(post => {
                        const mediaUrl = post.mediaUrl || post.mediaUrls?.[0] || post.photo || post.imageUrl;
                        if (!mediaUrl) return null;
                        const postId = `post_${post.id}`;
                        const isSelected = selectedStoryIds.includes(postId);
                        return (
                          <div 
                            key={post.id}
                            onClick={() => togglePostSelection(post)}
                            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border transition-all group ${
                              isSelected ? 'border-[#0095F6] ring-2 ring-[#0095F6]' : 'border-white/10 hover:border-white/30'
                            }`}
                          >
                            <img src={mediaUrl} className="w-full h-full object-cover" alt="" />
                            <div className="absolute top-2 right-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isSelected ? 'bg-[#0095F6] text-white' : 'border-2 border-white/70 bg-black/40'
                              }`}>
                                {isSelected && <Check size={13} className="stroke-[3]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: EDIT COVER & HIGHLIGHT TITLE (EXACTLY LIKE INSTAGRAM) */}
        {step === 2 && (
          <div className="flex-1 flex flex-col items-center justify-between p-6 sm:p-8 overflow-y-auto">
            <div className="w-full max-w-sm flex flex-col items-center space-y-6 my-auto">
              
              {/* Highlight Cover Preview Frame (SQUARE with rounded corners as requested!) */}
              <div className="flex flex-col items-center space-y-3">
                <div className="relative p-1 rounded-2xl bg-gradient-to-tr from-[#00E5FF] via-purple-500 to-[#FF0080] shadow-xl group">
                  <div className="p-1 bg-[#121212] rounded-2xl">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-neutral-900 flex items-center justify-center relative">
                      {activeCoverPreview ? (
                        <img 
                          src={activeCoverPreview} 
                          alt="Cover" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-white/30">
                          <ImageIcon size={28} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit Cover Blue Link Button */}
                <button
                  type="button"
                  onClick={() => setIsCoverPickerOpen(true)}
                  className="text-xs font-bold text-[#0095F6] hover:text-[#1877F2] transition-colors"
                >
                  Edit Cover
                </button>
              </div>

              {/* Highlight Name Input */}
              <div className="w-full space-y-2">
                <input
                  autoFocus
                  type="text"
                  maxLength={15}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Highlights"
                  className="w-full bg-[#1e1e1e] border border-white/10 rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white placeholder:text-white/30 focus:outline-none focus:border-[#0095F6] focus:ring-1 focus:ring-[#0095F6] transition-all"
                />
                <p className="text-[10px] text-center text-white/30 font-mono">Max 15 characters</p>
              </div>

              {/* Selected Stories Count & Edit Stories button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/70 hover:text-white transition-all flex items-center gap-2"
                >
                  <Edit3 size={13} />
                  <span>Select / Change Stories ({totalSelectedCount})</span>
                </button>
              </div>

              {/* Progress indicator while saving */}
              {isSaving && (
                <div className="flex items-center gap-2 text-xs text-[#0095F6] font-semibold animate-pulse">
                  <Loader2 size={16} className="animate-spin" />
                  <span>{savingProgress || 'Publishing highlight...'}</span>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="w-full max-w-sm space-y-3 pt-6 border-t border-white/10 shrink-0">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3.5 rounded-2xl bg-[#0095F6] hover:bg-[#1877F2] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : (mode === 'create' ? 'Done' : 'Save Changes')}
              </button>

              {mode === 'edit' && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2.5 text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>Delete Highlight</span>
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* COVER PICKER BOTTOM SHEET / MODAL */}
      <AnimatePresence>
        {isCoverPickerOpen && (
          <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsCoverPickerOpen(false)}
            />
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl z-10 flex flex-col space-y-4 max-h-[80vh] overflow-hidden"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h4 className="text-sm font-bold text-white">Choose Cover</h4>
                <button onClick={() => setIsCoverPickerOpen(false)} className="p-1 text-white/50 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Upload Custom Cover Button */}
              <button
                onClick={() => coverFileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all"
              >
                <Camera size={16} className="text-[#0095F6]" />
                <span>Upload Custom Photo from Gallery</span>
              </button>

              <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 pt-2">Or choose from selected items:</p>
              
              <div className="grid grid-cols-4 gap-2 overflow-y-auto max-h-56 pr-1 custom-scrollbar">
                {allSelectedMediaList.map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setCoverStoryId(item.id);
                      setCustomCoverUrl(item.url);
                      setIsCoverPickerOpen(false);
                    }}
                    className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-[#0095F6] group"
                  >
                    <img src={item.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" />
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsCoverPickerOpen(false)}
                className="w-full py-2.5 text-xs font-semibold text-white/50 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              onClick={() => setShowDeleteConfirm(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm rounded-3xl bg-[#181818] border border-white/10 p-6 flex flex-col items-center text-center shadow-2xl z-10"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 animate-pulse">
                <AlertTriangle size={24} />
              </div>
              
              <h4 className="text-base font-bold text-white mb-2">Delete Highlight?</h4>
              <p className="text-xs text-white/60 mb-6 leading-relaxed">
                This highlight will be permanently removed from your profile. Your original stories and posts will not be deleted.
              </p>
              
              <div className="flex flex-col gap-2 w-full">
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : 'Delete Highlight'}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-semibold transition-all border border-white/5"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
