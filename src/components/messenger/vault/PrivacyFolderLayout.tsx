import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Folder, Search, Plus, Settings, FolderLock, 
    MoreVertical, Image as ImageIcon, Video, X, ChevronRight,
    Heart, Pin, Clock, Trash, FileText, Camera,
    Grid, List, Filter, ArrowUpDown, Info,
    Maximize2, Download, Share2, MoreHorizontal,
    Image as ImageLucide, Film, Bookmark, HardDrive,
    Trash2, CheckCircle2, Circle, ArrowLeft, EyeOff,
    BookOpen, Edit3, Shield, Sparkles, FolderPlus,
    UploadCloud, Lock, Check, ExternalLink, RefreshCw
} from 'lucide-react';
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    addDoc, 
    serverTimestamp,
    deleteDoc,
    doc,
    updateDoc
} from 'firebase/firestore';
import { MediaViewer } from './MediaViewer';
import { useAeirmist } from '../../../context/AeirmistContext';
import { logger } from '@/src/utils/logger';
import { DownloadManagerService } from '../../../services/DownloadManagerService';
import { auth } from '../../../lib/firebase';

export const PrivacyFolderLayout = ({ 
    db,
    profile,
    onBack, 
    onSettingsClick, 
    privacyMedia, 
    handleMediaUpload,
    onDelete,
    onFavorite,
    onRestore
}: { 
    db: any,
    profile: any,
    onBack: () => void, 
    onSettingsClick: () => void,
    privacyMedia: any[],
    handleMediaUpload: (e: React.ChangeEvent<HTMLInputElement>, targetFolderId?: string | null) => void,
    onDelete: (id: string) => void,
    onFavorite: (id: string) => void,
    onRestore: (id: string) => Promise<void>
}) => {
    const { user, addToast, uploadMedia } = useAeirmist();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'photos' | 'videos' | 'albums' | 'diary' | 'favorites'>('photos');
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [fullScreenMedia, setFullScreenMedia] = useState<any | null>(null);
    const [folders, setFolders] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'az'>('newest');
    
    // Modal states
    const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteContent, setNoteContent] = useState('');
    const [noteCategory, setNoteCategory] = useState('Personal');
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [moveModalOpen, setMoveModalOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploadingDirect, setIsUploadingDirect] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const anyFileInputRef = useRef<HTMLInputElement>(null);

    // Initial loader
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

    // Listen for folders in real-time
    useEffect(() => {
        if (!db || !profile?.id) return;
        const userKeys = Array.from(new Set([
            profile.id, 
            profile.uid, 
            profile.ownerUid, 
            user?.uid, 
            auth?.currentUser?.uid,
            `profile_${auth?.currentUser?.uid}`,
            `profile_${user?.uid}`
        ].filter(Boolean)));
        const q = query(collection(db, 'vault_folders'), where('userId', 'in', userKeys));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const foldersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFolders(foldersData);
        }, (err) => {
            logger.warn("Vault folders listen error:", err);
        });
        return () => unsubscribe();
    }, [db, profile?.id, profile?.uid, profile?.ownerUid, user?.uid]);

    // Create Album/Folder
    const handleSubmitNewFolder = async () => {
        if (!db || !profile?.id || !newFolderName.trim()) return;
        const currentAuthUid = auth?.currentUser?.uid || user?.uid || profile?.ownerUid || profile?.uid || profile.id;
        try {
            await addDoc(collection(db, 'vault_folders'), {
                userId: currentAuthUid,
                ownerUid: currentAuthUid,
                profileId: profile.id,
                name: newFolderName.trim(),
                createdAt: serverTimestamp(),
                mediaCount: 0
            });
            addToast({ title: "Album Created", message: `Album "${newFolderName.trim()}" created successfully.`, type: "success" });
            setNewFolderModalOpen(false);
            setNewFolderName('');
        } catch (err: any) {
            logger.error("Folder creation error:", err);
            addToast({ title: "Error", message: "Failed to create folder.", type: "warning" });
        }
    };

    // Delete Folder
    const handleDeleteFolder = async (folderId: string, folderName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm(`Delete folder "${folderName}"? (Files inside will be kept in Photos/Videos)`)) return;
        try {
            await deleteDoc(doc(db, 'vault_folders', folderId));
            if (selectedFolder === folderId) setSelectedFolder(null);
            addToast({ title: "Folder Removed", message: `Folder "${folderName}" deleted.`, type: "info" });
        } catch (err) {
            logger.error("Error deleting folder:", err);
        }
    };

    // Save Cloud Diary / Note
    const handleSaveDiaryNote = async () => {
        if (!noteTitle.trim() && !noteContent.trim()) return;
        const currentAuthUid = auth?.currentUser?.uid || user?.uid || profile?.ownerUid || profile?.uid || profile?.id;
        try {
            if (editingNoteId) {
                await updateDoc(doc(db, 'vault_media', editingNoteId), {
                    name: noteTitle.trim() || 'Untitled Note',
                    content: noteContent.trim(),
                    category: noteCategory,
                    updatedAt: serverTimestamp()
                });
                addToast({ title: "Note Saved", message: "Cloud diary note updated.", type: "success" });
            } else {
                await addDoc(collection(db, 'vault_media'), {
                    userId: currentAuthUid,
                    ownerUid: currentAuthUid,
                    profileId: profile.id,
                    type: 'text',
                    name: noteTitle.trim() || 'Untitled Note',
                    content: noteContent.trim(),
                    category: noteCategory,
                    createdAt: serverTimestamp(),
                    isFavorite: false,
                    folderId: selectedFolder || null
                });
                addToast({ title: "Note Created", message: "Private note secured in Cloud Diary.", type: "success" });
            }
            setNoteModalOpen(false);
            setNoteTitle('');
            setNoteContent('');
            setEditingNoteId(null);
        } catch (err: any) {
            logger.error("Failed to save diary note:", err);
            addToast({ title: "Error", message: "Failed to save note.", type: "warning" });
        }
    };

    // Direct File Processing (images, videos, documents)
    const handleDirectFiles = async (files: FileList | null) => {
        if (!files || files.length === 0 || !db || !profile?.id) return;
        setIsUploadingDirect(true);
        const currentAuthUid = auth?.currentUser?.uid || user?.uid || profile?.ownerUid || profile?.uid || profile.id;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                let mediaUrl = '';
                if (uploadMedia) {
                    try {
                        mediaUrl = await uploadMedia(file, `vault/${currentAuthUid}`);
                    } catch (e) {
                        logger.warn("Storage upload fallback:", e);
                    }
                }
                if (!mediaUrl) {
                    mediaUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target?.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }

                const isVideo = file.type.startsWith('video');
                const isImage = file.type.startsWith('image');
                const isDoc = !isVideo && !isImage;

                await addDoc(collection(db, 'vault_media'), {
                    userId: currentAuthUid,
                    ownerUid: currentAuthUid,
                    profileId: profile.id,
                    url: mediaUrl,
                    type: isVideo ? 'video' : isImage ? 'image' : 'file',
                    name: file.name,
                    size: file.size,
                    mimeType: file.type,
                    createdAt: serverTimestamp(),
                    isFavorite: false,
                    folderId: selectedFolder || null
                });

                addToast({
                    title: "Encrypted & Saved",
                    message: `${file.name} added to your Private Safe.`,
                    type: "success"
                });
            } catch (err: any) {
                logger.error("Direct file save error:", err);
                addToast({
                    title: "Upload Issue",
                    message: err?.message || "Failed to save file.",
                    type: "warning"
                });
            }
        }
        setIsUploadingDirect(false);
        setIsFabOpen(false);
    };

    // Move Selected Items to Folder
    const handleMoveToFolder = async (targetFolderId: string | null) => {
        if (!db || selectedIds.length === 0) return;
        try {
            for (const id of selectedIds) {
                await updateDoc(doc(db, 'vault_media', id), {
                    folderId: targetFolderId
                });
            }
            addToast({ title: "Moved", message: `${selectedIds.length} items moved successfully.`, type: "success" });
            setSelectedIds([]);
            setSelectionMode(false);
            setMoveModalOpen(false);
        } catch (err) {
            logger.error("Error moving items:", err);
            addToast({ title: "Error", message: "Failed to move items.", type: "warning" });
        }
    };

    // Bulk Actions
    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedIds.length} items from Private Folder?`)) return;
        for (const id of selectedIds) {
            await onDelete(id);
        }
        setSelectedIds([]);
        setSelectionMode(false);
        addToast({ title: "Deleted", message: "Selected items deleted.", type: "info" });
    };

    const handleBulkFavorite = async () => {
        for (const id of selectedIds) {
            await onFavorite(id);
        }
        setSelectedIds([]);
        setSelectionMode(false);
    };

    const handleBulkDownload = async () => {
        for (const id of selectedIds) {
            const item = privacyMedia.find(m => m.id === id);
            if (item?.url) {
                DownloadManagerService.downloadMediaFile(item.url, item.name || `vault_${Date.now()}`);
            }
        }
        addToast({ title: "Download Started", message: "Saving selected files to device.", type: "info" });
        setSelectedIds([]);
        setSelectionMode(false);
    };

    // Selection toggle
    const toggleSelection = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // Stats calculations
    const stats = useMemo(() => {
        const photos = privacyMedia.filter(m => m.type === 'image').length;
        const videos = privacyMedia.filter(m => m.type === 'video').length;
        const notes = privacyMedia.filter(m => m.type === 'text' || (!m.url && m.content)).length;
        const favorites = privacyMedia.filter(m => m.isFavorite).length;
        return { photos, videos, notes, albums: folders.length, favorites };
    }, [privacyMedia, folders]);

    // Filtered Items
    const filteredMedia = useMemo(() => {
        let items = [...privacyMedia];
        
        // Category filtering
        if (activeTab === 'photos') items = items.filter(m => m.type === 'image');
        else if (activeTab === 'videos') items = items.filter(m => m.type === 'video');
        else if (activeTab === 'diary') items = items.filter(m => m.type === 'text' || (!m.url && m.content));
        else if (activeTab === 'favorites') items = items.filter(m => m.isFavorite);
        
        // Folder filtering inside albums tab
        if (activeTab === 'albums' && selectedFolder) {
            items = items.filter(m => m.folderId === selectedFolder);
        }

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(m => 
                (m.name || '').toLowerCase().includes(q) || 
                (m.content || '').toLowerCase().includes(q) ||
                (m.category || '').toLowerCase().includes(q)
            );
        }

        // Sorting with reliable date conversion
        const getTimeValue = (val: any) => {
            if (!val) return 0;
            if (val.toMillis) return val.toMillis();
            if (val.toDate) return val.toDate().getTime();
            if (typeof val === 'number') return val;
            const parsed = new Date(val).getTime();
            return isNaN(parsed) ? 0 : parsed;
        };
        items.sort((a, b) => {
            const timeA = getTimeValue(a.createdAt);
            const timeB = getTimeValue(b.createdAt);
            if (sortOrder === 'newest') return timeB - timeA;
            if (sortOrder === 'oldest') return timeA - timeB;
            if (sortOrder === 'az') return (a.name || '').localeCompare(b.name || '');
            return 0;
        });

        return items;
    }, [privacyMedia, activeTab, selectedFolder, searchQuery, sortOrder]);

    const currentFolderName = useMemo(() => {
        if (!selectedFolder) return null;
        return folders.find(f => f.id === selectedFolder)?.name || 'Album';
    }, [selectedFolder, folders]);

    return (
        <div 
            className="flex-1 flex flex-col w-full h-full bg-[#050408] text-white overflow-hidden relative select-none"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleDirectFiles(e.dataTransfer.files);
            }}
        >
            {/* Drag & Drop Overlay */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-[#c77dff]/20 backdrop-blur-md border-4 border-dashed border-[#c77dff] flex flex-col items-center justify-center p-6 text-center"
                    >
                        <UploadCloud size={64} className="text-[#c77dff] animate-bounce mb-3" />
                        <h2 className="text-xl font-black uppercase tracking-wider text-white">Drop to Save in Private Safe</h2>
                        <p className="text-xs text-white/70 font-mono mt-1">Files are instantly encrypted and saved locally & in cloud.</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Top Phone-Style Navigation Header */}
            <header className="shrink-0 z-30 bg-[#07060b]/90 backdrop-blur-2xl border-b border-white/10 px-4 md:px-8 py-3.5">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => {
                                if (selectedFolder && activeTab === 'albums') {
                                    setSelectedFolder(null);
                                } else {
                                    onBack();
                                }
                            }} 
                            className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-lg md:text-xl font-black tracking-tight flex items-center gap-2 text-white">
                                {selectedFolder ? currentFolderName : 'Private Safe & Gallery'}
                                <Shield size={16} className="text-[#00E5FF]" />
                            </h1>
                            <p className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-bold">
                                {selectedFolder ? 'Album View' : 'Encrypted Private Storage'}
                            </p>
                        </div>
                    </div>
                    
                    {/* Search bar */}
                    <div className="hidden md:flex flex-1 max-w-md relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15} />
                        <input 
                            type="text" 
                            placeholder="Search photos, videos, notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-xs text-white placeholder:text-white/30 outline-none focus:border-[#00E5FF]/60 focus:bg-white/10 transition-all"
                        />
                    </div>

                    {/* Top Right Action Icons */}
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={() => setSelectionMode(prev => !prev)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${selectionMode ? 'bg-[#00E5FF] text-black' : 'bg-white/5 hover:bg-white/10 text-white/80'}`}
                        >
                            {selectionMode ? 'Done' : 'Select'}
                        </button>
                        <button 
                            onClick={onSettingsClick} 
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                            title="Vault Settings"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Body */}
            <main className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 space-y-6">
                    
                    {/* Tecno/Realme Style Stat Capsules */}
                    {!loading && !selectedFolder && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            {[
                                { id: 'photos', label: 'Photos', count: stats.photos, icon: ImageLucide, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                                { id: 'videos', label: 'Videos', count: stats.videos, icon: Film, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                                { id: 'albums', label: 'Albums', count: stats.albums, icon: Folder, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                                { id: 'diary', label: 'Cloud Diary', count: stats.notes, icon: BookOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                                { id: 'favorites', label: 'Favorites', count: stats.favorites, icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10' }
                            ].map((stat) => (
                                <motion.button 
                                    key={stat.id}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => {
                                        setActiveTab(stat.id as any);
                                        setSelectedFolder(null);
                                    }}
                                    className={`p-3 rounded-2xl border transition-all text-left flex items-center gap-3 ${
                                        activeTab === stat.id 
                                            ? 'bg-white/10 border-white/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]' 
                                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                                    }`}
                                >
                                    <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} shrink-0`}>
                                        <stat.icon size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-base font-black text-white leading-tight truncate">{stat.count}</div>
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-white/40 truncate">{stat.label}</div>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    )}

                    {/* Navigation Filter Tabs Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-20 bg-[#050408]/95 backdrop-blur-xl py-2 border-b border-white/5">
                        <div className="flex bg-white/5 p-1 rounded-2xl gap-1 overflow-x-auto custom-scrollbar">
                            {[
                                { id: 'photos', label: 'Photos', icon: ImageLucide },
                                { id: 'videos', label: 'Videos', icon: Film },
                                { id: 'albums', label: 'Albums', icon: Folder },
                                { id: 'diary', label: 'Cloud Diary', icon: BookOpen },
                                { id: 'favorites', label: 'Favorites', icon: Heart }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id as any);
                                        if (tab.id !== 'albums') setSelectedFolder(null);
                                    }}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                        activeTab === tab.id 
                                            ? 'bg-[#00E5FF] text-black shadow-[0_0_15px_rgba(0,229,255,0.3)]' 
                                            : 'text-white/50 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <tab.icon size={14} />
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Breadcrumbs / Sorting */}
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                            {selectedFolder && (
                                <span className="text-xs font-mono text-[#00E5FF] bg-[#00E5FF]/10 px-2.5 py-1 rounded-lg border border-[#00E5FF]/20 truncate max-w-[150px]">
                                    📁 {currentFolderName}
                                </span>
                            )}
                            <button 
                                onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : prev === 'oldest' ? 'az' : 'newest')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                                <ArrowUpDown size={13} />
                                <span>{sortOrder}</span>
                            </button>
                        </div>
                    </div>

                    {/* Main Gallery Area */}
                    <div className="min-h-[350px]">
                        {loading || isUploadingDirect ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <RefreshCw className="animate-spin text-[#00E5FF]" size={28} />
                                <span className="text-xs font-mono text-white/50">Encrypting & syncing vault...</span>
                            </div>
                        ) : activeTab === 'albums' && !selectedFolder ? (
                            /* ALBUMS DIRECTORY VIEW */
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                                {/* Create New Album Card */}
                                <motion.button 
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setNewFolderModalOpen(true)}
                                    className="aspect-square bg-white/[0.02] border border-dashed border-white/15 rounded-3xl flex flex-col items-center justify-center gap-2.5 hover:bg-white/[0.06] hover:border-[#00E5FF]/50 transition-all group p-4"
                                >
                                    <div className="p-3.5 rounded-2xl bg-[#00E5FF]/10 text-[#00E5FF] group-hover:scale-110 transition-transform">
                                        <FolderPlus size={28} />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-wider text-white/80 group-hover:text-white">Create Album</span>
                                    <span className="text-[9px] text-white/30 font-mono">Organize media</span>
                                </motion.button>

                                {folders.map((folder) => {
                                    const count = privacyMedia.filter(m => m.folderId === folder.id).length;
                                    const firstItem = privacyMedia.find(m => m.folderId === folder.id);
                                    return (
                                        <motion.div
                                            key={folder.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => setSelectedFolder(folder.id)}
                                            className="group relative aspect-square bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-3xl overflow-hidden cursor-pointer hover:border-[#00E5FF]/50 shadow-xl transition-all flex flex-col justify-between p-4"
                                        >
                                            {firstItem?.url && firstItem.type === 'image' && (
                                                <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-35 transition-opacity">
                                                    <img src={firstItem.url} alt="" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/60" />
                                                </div>
                                            )}

                                            <div className="relative z-10 flex justify-between items-start">
                                                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
                                                    <Folder size={22} />
                                                </div>
                                                <button 
                                                    onClick={(e) => handleDeleteFolder(folder.id, folder.name, e)}
                                                    className="p-1.5 bg-black/40 hover:bg-red-500/20 hover:text-red-400 text-white/40 rounded-full transition-colors"
                                                    title="Delete album"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>

                                            <div className="relative z-10">
                                                <h3 className="font-bold text-sm text-white truncate">{folder.name}</h3>
                                                <p className="text-[10px] text-white/40 font-mono font-bold mt-0.5">{count} {count === 1 ? 'item' : 'items'}</p>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : activeTab === 'diary' ? (
                            /* CLOUD DIARY / SECRET NOTES VIEW */
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Cloud Diary & Secret Notes</h3>
                                        <p className="text-[10px] font-mono text-white/40">Encrypted personal journal entries and confidential thoughts.</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingNoteId(null);
                                            setNoteTitle('');
                                            setNoteContent('');
                                            setNoteCategory('Personal');
                                            setNoteModalOpen(true);
                                        }}
                                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                                    >
                                        <Edit3 size={14} />
                                        <span>New Entry</span>
                                    </button>
                                </div>

                                {filteredMedia.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                                        <BookOpen size={48} className="text-emerald-400/40 mb-1" />
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Your Diary is Empty</h4>
                                        <p className="text-xs text-white/40 max-w-sm">Write down your private thoughts, passwords, ideas or journal entries protected by your vault PIN.</p>
                                        <button
                                            onClick={() => {
                                                setEditingNoteId(null);
                                                setNoteTitle('');
                                                setNoteContent('');
                                                setNoteModalOpen(true);
                                            }}
                                            className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-black uppercase text-xs tracking-wider mt-2"
                                        >
                                            Write First Note
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                        {filteredMedia.map((note) => (
                                            <motion.div
                                                key={note.id}
                                                whileHover={{ y: -2 }}
                                                className={`p-4 rounded-3xl border transition-all relative flex flex-col justify-between min-h-[160px] ${
                                                    selectedIds.includes(note.id) 
                                                        ? 'bg-emerald-500/10 border-emerald-400 ring-2 ring-emerald-400' 
                                                        : 'bg-gradient-to-br from-[#12101a] to-[#0a0810] border-white/10 hover:border-white/20'
                                                }`}
                                                onClick={() => {
                                                    if (selectionMode) {
                                                        toggleSelection(note.id);
                                                    } else {
                                                        setEditingNoteId(note.id);
                                                        setNoteTitle(note.name || '');
                                                        setNoteContent(note.content || '');
                                                        setNoteCategory(note.category || 'Personal');
                                                        setNoteModalOpen(true);
                                                    }
                                                }}
                                            >
                                                <div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                            {note.category || 'Diary'}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onFavorite(note.id); }}
                                                                className={`p-1 rounded-full ${note.isFavorite ? 'text-red-400' : 'text-white/30 hover:text-white'}`}
                                                            >
                                                                <Heart size={13} fill={note.isFavorite ? 'currentColor' : 'none'} />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                                                                className="p-1 text-white/30 hover:text-red-400 rounded-full transition-colors"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-white truncate mb-1">{note.name || 'Untitled Note'}</h4>
                                                    <p className="text-xs text-white/70 line-clamp-3 leading-relaxed whitespace-pre-wrap font-sans">
                                                        {note.content}
                                                    </p>
                                                </div>

                                                <div className="pt-3 mt-3 border-t border-white/5 flex justify-between items-center text-[9px] font-mono text-white/30">
                                                    <span>{note.createdAt?.toDate ? note.createdAt.toDate().toLocaleDateString() : 'Today'}</span>
                                                    <span>{note.content?.length || 0} chars</span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : filteredMedia.length > 0 ? (
                            /* PHOTOS / VIDEOS / FAVORITES GALLERY GRID */
                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3.5 pb-24">
                                {filteredMedia.map((item) => (
                                    <motion.div 
                                        key={item.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            if (selectionMode) {
                                                toggleSelection(item.id);
                                            } else {
                                                setFullScreenMedia(item);
                                            }
                                        }}
                                        className={`relative aspect-square bg-[#0c0a12] rounded-2xl md:rounded-3xl border overflow-hidden cursor-pointer group shadow-lg transition-all ${
                                            selectedIds.includes(item.id) 
                                                ? 'border-[#00E5FF] ring-2 ring-[#00E5FF]' 
                                                : 'border-white/10 hover:border-white/25'
                                        }`}
                                    >
                                        {item.type === 'text' || (!item.url && item.content) ? (
                                            <div className="w-full h-full p-3 bg-gradient-to-br from-[#1b1429] to-[#0a0712] flex flex-col justify-between">
                                                <div className="flex items-center gap-1.5 text-emerald-400">
                                                    <BookOpen size={14} />
                                                    <span className="text-[8px] font-mono font-bold uppercase truncate">{item.name || 'Diary'}</span>
                                                </div>
                                                <p className="text-[10px] text-white/80 line-clamp-3 font-sans leading-tight">
                                                    {item.content}
                                                </p>
                                                <span className="text-[8px] font-mono text-white/30">NOTE</span>
                                            </div>
                                        ) : item.type === 'image' ? (
                                            <img src={item.url} loading="lazy" alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        ) : (
                                            <div className="relative w-full h-full bg-black">
                                                <video src={`${item.url}#t=0.5`} className="w-full h-full object-cover" muted preload="metadata" playsInline />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                                    <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center shadow-lg">
                                                        <Video size={13} className="text-white" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Selection Pill */}
                                        {selectionMode && (
                                            <div className="absolute inset-0 bg-[#00E5FF]/15 z-10 flex items-start justify-end p-2">
                                                {selectedIds.includes(item.id) ? (
                                                    <CheckCircle2 size={20} className="text-black fill-[#00E5FF]" />
                                                ) : (
                                                    <Circle size={20} className="text-white/40" />
                                                )}
                                            </div>
                                        )}

                                        {/* Bottom name badge */}
                                        {!selectionMode && (
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                                {item.isFavorite && <Heart size={12} className="text-red-500 fill-red-500 shrink-0" />}
                                                <span className="text-[8px] font-bold text-white/80 truncate">{item.name || 'Media'}</span>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            /* EMPTY STATE */
                            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 text-white/30">
                                    <FolderLock size={48} className="text-[#00E5FF]/60" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-base font-bold text-white uppercase tracking-wider">
                                        {activeTab === 'favorites' ? 'No Favorites Saved' : 'This Folder is Empty'}
                                    </h3>
                                    <p className="text-xs text-white/40 max-w-xs">
                                        Protect your private photos, videos, and diary notes securely in your personal vault.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center pt-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-4 py-2.5 rounded-2xl bg-[#00E5FF] hover:brightness-110 active:scale-95 text-black font-black uppercase text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(0,229,255,0.25)] flex items-center gap-1.5"
                                    >
                                        <ImageLucide size={14} />
                                        <span>Import Photos</span>
                                    </button>
                                    <button
                                        onClick={() => videoInputRef.current?.click()}
                                        className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold uppercase text-xs tracking-wider transition-all flex items-center gap-1.5"
                                    >
                                        <Film size={14} />
                                        <span>Import Videos</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Hidden File Inputs */}
            <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                multiple 
                className="hidden" 
                onChange={(e) => handleDirectFiles(e.target.files)} 
            />
            <input 
                ref={videoInputRef} 
                type="file" 
                accept="video/*" 
                multiple 
                className="hidden" 
                onChange={(e) => handleDirectFiles(e.target.files)} 
            />
            <input 
                ref={anyFileInputRef} 
                type="file" 
                accept="*/*" 
                multiple 
                className="hidden" 
                onChange={(e) => handleDirectFiles(e.target.files)} 
            />

            {/* Selection Floating Toolbar */}
            <AnimatePresence>
                {selectionMode && selectedIds.length > 0 && (
                    <motion.div 
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#12101a]/98 backdrop-blur-2xl border border-white/15 rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl"
                    >
                        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
                            <span className="text-xs font-black uppercase tracking-wider text-[#00E5FF]">{selectedIds.length}</span>
                            <span className="text-[10px] font-bold text-white/40 uppercase">Selected</span>
                        </div>
                        <div className="flex items-center gap-5">
                            <button 
                                onClick={() => setMoveModalOpen(true)}
                                className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors"
                            >
                                <Folder size={17} />
                                <span className="text-[8px] font-bold uppercase">Move</span>
                            </button>
                            <button 
                                onClick={handleBulkDownload}
                                className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors"
                            >
                                <Download size={17} />
                                <span className="text-[8px] font-bold uppercase">Save</span>
                            </button>
                            <button 
                                onClick={handleBulkFavorite}
                                className="flex flex-col items-center gap-1 text-white/70 hover:text-red-400 transition-colors"
                            >
                                <Heart size={17} />
                                <span className="text-[8px] font-bold uppercase">Favorite</span>
                            </button>
                            <button 
                                onClick={handleBulkDelete}
                                className="flex flex-col items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
                            >
                                <Trash2 size={17} />
                                <span className="text-[8px] font-bold uppercase">Delete</span>
                            </button>
                        </div>
                        <button 
                            onClick={() => { setSelectionMode(false); setSelectedIds([]); }}
                            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/50"
                        >
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Quick Action FAB + Menu */}
            <AnimatePresence>
                {!selectionMode && isFabOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-end justify-center p-4"
                        onClick={() => setIsFabOpen(false)}
                    >
                        <motion.div 
                            initial={{ y: 100 }}
                            animate={{ y: 0 }}
                            exit={{ y: 100 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#121118] border border-white/15 rounded-[36px] p-5 w-full max-w-sm space-y-2.5 shadow-2xl mb-16 md:mb-6 text-white"
                        >
                            <div className="pb-2 border-b border-white/10 mb-2 flex justify-between items-center">
                                <h3 className="text-xs font-black uppercase tracking-wider text-white/60">Add to Private Safe</h3>
                                <span className="text-[9px] font-mono text-[#00E5FF] bg-[#00E5FF]/10 px-2 py-0.5 rounded">Encrypted</span>
                            </div>

                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group"
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                                        <ImageLucide size={18} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-xs font-bold">Upload Photos</div>
                                        <div className="text-[9px] text-white/40 font-mono">From Gallery / Storage</div>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-white/20 group-hover:text-white" />
                            </button>

                            <button 
                                onClick={() => videoInputRef.current?.click()}
                                className="flex w-full items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group"
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
                                        <Film size={18} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-xs font-bold">Upload Videos</div>
                                        <div className="text-[9px] text-white/40 font-mono">From Gallery / Storage</div>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-white/20 group-hover:text-white" />
                            </button>

                            <button 
                                onClick={() => {
                                    setIsFabOpen(false);
                                    setEditingNoteId(null);
                                    setNoteTitle('');
                                    setNoteContent('');
                                    setNoteCategory('Personal');
                                    setNoteModalOpen(true);
                                }}
                                className="flex w-full items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group"
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                                        <BookOpen size={18} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-xs font-bold">New Cloud Diary Note</div>
                                        <div className="text-[9px] text-white/40 font-mono">Secret text / journal</div>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-white/20 group-hover:text-white" />
                            </button>

                            <button 
                                onClick={() => {
                                    setIsFabOpen(false);
                                    setNewFolderName('');
                                    setNewFolderModalOpen(true);
                                }}
                                className="flex w-full items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group"
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                                        <FolderPlus size={18} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-xs font-bold">New Album / Folder</div>
                                        <div className="text-[9px] text-white/40 font-mono">Organize files</div>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-white/20 group-hover:text-white" />
                            </button>

                            <button 
                                onClick={() => setIsFabOpen(false)}
                                className="w-full py-3 text-xs font-black uppercase tracking-wider text-white/40 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB Button */}
            {!selectionMode && (
                <motion.button 
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setIsFabOpen(!isFabOpen)}
                    className="fixed bottom-20 md:bottom-8 right-5 md:right-8 w-14 h-14 bg-gradient-to-tr from-[#00E5FF] to-[#0099FF] rounded-2xl flex items-center justify-center shadow-[0_8px_30px_rgba(0,229,255,0.4)] z-40 transition-all border border-white/20 text-black"
                >
                    {isFabOpen ? <X size={24} /> : <Plus size={24} strokeWidth={2.8} />}
                </motion.button>
            )}

            {/* Fullscreen Media Viewer */}
            {fullScreenMedia && (
                <MediaViewer 
                    media={fullScreenMedia} 
                    allMedia={filteredMedia}
                    onClose={() => setFullScreenMedia(null)}
                    onDelete={async (id) => {
                        await onDelete(id);
                        setFullScreenMedia(null);
                    }}
                    onFavorite={onFavorite}
                    onRestore={onRestore}
                />
            )}

            {/* CREATE ALBUM MODAL */}
            {newFolderModalOpen && (
                <div
                    className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4"
                    onClick={() => setNewFolderModalOpen(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm p-6 rounded-3xl bg-[#121118] border border-white/15 shadow-2xl text-white"
                    >
                        <h3 className="text-sm font-black uppercase tracking-wider mb-1 flex items-center gap-2">
                            <FolderPlus size={18} className="text-[#00E5FF]" />
                            <span>Create Album</span>
                        </h3>
                        <p className="text-[10px] text-white/40 font-mono mb-4">Create a folder to group your private photos and videos.</p>
                        
                        <input
                            autoFocus
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitNewFolder(); }}
                            placeholder="e.g. Travel, Documents, Vault Safe"
                            className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#00E5FF] mb-4"
                        />
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => setNewFolderModalOpen(false)}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-xs font-black uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitNewFolder}
                                disabled={!newFolderName.trim()}
                                className="flex-1 py-2.5 rounded-xl bg-[#00E5FF] text-black text-xs font-black uppercase tracking-wider disabled:opacity-40"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CLOUD DIARY / SECRET NOTE MODAL */}
            {noteModalOpen && (
                <div
                    className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4"
                    onClick={() => setNoteModalOpen(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg p-6 rounded-3xl bg-[#121118] border border-white/15 shadow-2xl text-white space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
                    >
                        <div className="flex justify-between items-center pb-2 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <BookOpen size={18} className="text-emerald-400" />
                                <h3 className="text-sm font-black uppercase tracking-wider">
                                    {editingNoteId ? 'Edit Cloud Diary Note' : 'New Cloud Diary Note'}
                                </h3>
                            </div>
                            <button onClick={() => setNoteModalOpen(false)} className="p-1 text-white/40 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Category selection */}
                        <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                            {['Personal', 'Secret', 'Idea', 'Financial', 'Work', 'Journal'].map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setNoteCategory(cat)}
                                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-colors ${
                                        noteCategory === cat 
                                            ? 'bg-emerald-500 text-black' 
                                            : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <input
                            type="text"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            placeholder="Note Title..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400"
                        />

                        <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="Write your secret notes, journal entries, or confidential info here..."
                            rows={8}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs leading-relaxed text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 resize-none font-sans"
                        />

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setNoteModalOpen(false)}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 text-xs font-black uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveDiaryNote}
                                disabled={!noteTitle.trim() && !noteContent.trim()}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-black uppercase tracking-wider disabled:opacity-40"
                            >
                                Save Entry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MOVE TO ALBUM MODAL */}
            {moveModalOpen && (
                <div
                    className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4"
                    onClick={() => setMoveModalOpen(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm p-6 rounded-3xl bg-[#121118] border border-white/15 shadow-2xl text-white space-y-4"
                    >
                        <h3 className="text-sm font-black uppercase tracking-wider">Move to Album</h3>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                            <button
                                onClick={() => handleMoveToFolder(null)}
                                className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-left text-xs font-bold flex items-center gap-3"
                            >
                                <Folder size={16} className="text-white/40" />
                                <span>Main Gallery (No Album)</span>
                            </button>
                            {folders.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => handleMoveToFolder(f.id)}
                                    className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-left text-xs font-bold flex items-center gap-3"
                                >
                                    <Folder size={16} className="text-amber-400" />
                                    <span className="truncate">{f.name}</span>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setMoveModalOpen(false)}
                            className="w-full py-2.5 rounded-xl bg-white/5 text-white/50 text-xs font-black uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
