import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Folder, Search, Plus, Settings, FolderLock, 
    MoreVertical, Image as ImageIcon, Video, X, ChevronRight,
    Heart, Pin, Clock, Trash, FileText, Camera,
    Grid, List, Filter, ArrowUpDown, Info,
    Maximize2, Download, Share2, MoreHorizontal,
    Image as ImageLucide, Film, Bookmark, HardDrive,
    Trash2, CheckCircle2, Circle, ArrowLeft, EyeOff
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
import { StoryEditor } from '../story/StoryEditor';

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
    handleMediaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onDelete: (id: string) => void,
    onFavorite: (id: string) => void,
    onRestore: (id: string) => Promise<void>
}) => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'photos' | 'videos' | 'albums' | 'favorites'>('photos');
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [fullScreenMedia, setFullScreenMedia] = useState<any | null>(null);
    const [showStoryEditor, setShowStoryEditor] = useState(false);
    const [folders, setFolders] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'az'>('newest');
    const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Simulate initial loading for premium feel
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!db || !profile?.id) return;
        
        const q = query(collection(db, 'vault_folders'), where('userId', '==', profile.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const foldersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFolders(foldersData);
        });
        
        return () => unsubscribe();
    }, [db, profile?.id]);

    const handleCreateFolder = () => {
        setNewFolderName('');
        setNewFolderModalOpen(true);
    };

    const handleSubmitNewFolder = async () => {
        if (!db || !profile?.id || !newFolderName.trim()) return;
        await addDoc(collection(db, 'vault_folders'), {
            userId: profile.id,
            name: newFolderName.trim(),
            createdAt: serverTimestamp(),
            mediaCount: 0
        });
        setNewFolderModalOpen(false);
        setNewFolderName('');
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedIds.length} items?`)) return;
        for (const id of selectedIds) {
            await onDelete(id);
        }
        setSelectedIds([]);
        setSelectionMode(false);
    };

    const handleBulkFavorite = async () => {
        for (const id of selectedIds) {
            await onFavorite(id);
        }
        setSelectedIds([]);
        setSelectionMode(false);
    };

    const handleBulkRestore = async () => {
        if (!window.confirm(`Restore ${selectedIds.length} items to public profile?`)) return;
        for (const id of selectedIds) {
            await onRestore(id);
        }
        setSelectedIds([]);
        setSelectionMode(false);
    };

    const stats = useMemo(() => {
        const photos = privacyMedia.filter(m => m.type === 'image').length;
        const videos = privacyMedia.filter(m => m.type === 'video').length;
        const favorites = privacyMedia.filter(m => m.isFavorite).length;
        return { photos, videos, favorites, albums: folders.length, hiddenPosts: 0 };
    }, [privacyMedia, folders]);

    const filteredMedia = useMemo(() => {
        let items = [...privacyMedia];
        
        // Tab filtering
        if (activeTab === 'photos') items = items.filter(m => m.type === 'image');
        else if (activeTab === 'videos') items = items.filter(m => m.type === 'video');
        else if (activeTab === 'favorites') items = items.filter(m => m.isFavorite);
        
        // Folder filtering
        if (selectedFolder && activeTab === 'albums') {
            items = items.filter(m => m.folderId === selectedFolder);
        }

        // Search filtering
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(m => 
                (m.name || '').toLowerCase().includes(q) || 
                (m.caption || '').toLowerCase().includes(q)
            );
        }

        // Sorting
        items.sort((a, b) => {
            if (sortOrder === 'newest') return (b.createdAt || b.id) - (a.createdAt || a.id);
            if (sortOrder === 'oldest') return (a.createdAt || a.id) - (b.createdAt || b.id);
            if (sortOrder === 'az') return (a.name || '').localeCompare(b.name || '');
            return 0;
        });

        return items;
    }, [privacyMedia, activeTab, selectedFolder, searchQuery, sortOrder]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleLongPress = (id: string) => {
        setSelectionMode(true);
        toggleSelection(id);
    };

    const SkeletonCard = () => (
        <div className="aspect-square bg-white/5 rounded-2xl animate-pulse flex items-center justify-center">
            <div className="w-1/3 h-1/3 bg-white/5 rounded-full" />
        </div>
    );

    return (
        <div className="flex-1 flex flex-col w-full h-full bg-[#030107] text-white overflow-hidden relative">
            {/* Premium Header */}
            <header className="shrink-0 z-30 bg-[#030107]/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl font-display font-black tracking-tight flex items-center gap-2">
                                Private Folder <FolderLock size={18} className="text-[#c77dff]" />
                            </h1>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-bold">Only you can access these items</p>
                        </div>
                    </div>
                    
                    <div className="hidden md:flex flex-1 max-w-md relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search in Vault..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm outline-none focus:border-[#c77dff]/50 focus:bg-white/10 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-1">
                        <button className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/60">
                            <Filter size={18} />
                        </button>
                        <button onClick={onSettingsClick} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/60">
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-8">
                    
                    {/* Quick Stats */}
                    {!loading && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                                { id: 'photos', label: 'Photos', value: stats.photos, icon: ImageLucide, color: 'text-blue-400' },
                                { id: 'videos', label: 'Videos', value: stats.videos, icon: Film, color: 'text-purple-400' },
                                { id: 'albums', label: 'Albums', value: stats.albums, icon: Folder, color: 'text-amber-400' },
                                { id: 'hidden', label: 'Hidden', value: stats.hiddenPosts, icon: EyeOff, color: 'text-red-400' },
                                { id: 'used', label: 'Used', value: '28%', icon: HardDrive, color: 'text-emerald-400' }
                            ].map((stat, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    onClick={() => {
                                        if (stat.id === 'photos' || stat.id === 'videos' || stat.id === 'albums') {
                                            setActiveTab(stat.id as any);
                                            if (stat.id !== 'albums') setSelectedFolder(null);
                                        }
                                    }}
                                    className={`bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex items-center gap-4 hover:bg-white/[0.05] transition-colors group ${stat.id === 'photos' || stat.id === 'videos' || stat.id === 'albums' ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                    <div className={`p-2.5 rounded-xl bg-white/5 ${stat.color} group-hover:scale-110 transition-transform`}>
                                        <stat.icon size={20} />
                                    </div>
                                    <div>
                                        <div className="text-lg font-black">{stat.value}</div>
                                        <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">{stat.label}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Tabs & Layout Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 bg-[#030107]/90 backdrop-blur-md py-2">
                        <div className="flex bg-white/5 p-1 rounded-xl w-fit">
                            {[
                                { id: 'photos', label: 'Photos', icon: ImageLucide },
                                { id: 'videos', label: 'Videos', icon: Film },
                                { id: 'albums', label: 'Albums', icon: Folder },
                                { id: 'favorites', label: 'Favorites', icon: Heart }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id as any);
                                        if (tab.id !== 'albums') setSelectedFolder(null);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-[#c77dff] text-white shadow-lg shadow-[#c77dff]/20' : 'text-white/40 hover:text-white/60'}`}
                                >
                                    <tab.icon size={14} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                             <div className="md:hidden flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                                <input 
                                    type="text" 
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-3 text-xs outline-none focus:border-[#c77dff]/50"
                                />
                            </div>
                            <button 
                                onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                                className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                            >
                                <ArrowUpDown size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Main Gallery */}
                    <div className="relative min-h-[400px]">
                        {loading ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                                {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                            </div>
                        ) : activeTab === 'albums' && !selectedFolder ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {/* Album Cards */}
                                <motion.button 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    onClick={handleCreateFolder}
                                    className="aspect-square bg-white/[0.02] border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-3 hover:bg-white/[0.04] hover:border-[#c77dff]/40 transition-all group"
                                >
                                    <div className="p-4 rounded-2xl bg-white/5 text-white/40 group-hover:text-[#c77dff] group-hover:scale-110 transition-all">
                                        <Plus size={32} />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-white/40">New Album</span>
                                </motion.button>
                                {folders.map((folder, i) => (
                                    <motion.div
                                        key={folder.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        onClick={() => setSelectedFolder(folder.id)}
                                        className="group relative aspect-square bg-white/5 border border-white/10 rounded-3xl overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-[#c77dff]/10 transition-all"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                                            <Folder size={64} className="text-[#c77dff]" />
                                        </div>
                                        <div className="absolute bottom-4 left-4 right-4 z-20">
                                            <h3 className="font-bold text-sm truncate">{folder.name}</h3>
                                            <p className="text-[10px] text-white/50 uppercase tracking-widest font-black">{folder.mediaCount || 0} items</p>
                                        </div>
                                        <button className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 z-30">
                                            <MoreHorizontal size={14} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        ) : filteredMedia.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4 pb-24">
                                    {filteredMedia.map((item, i) => (
                                        <motion.div 
                                            key={item.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.02 }}
                                            onClick={() => {
                                                if (selectionMode) {
                                                    toggleSelection(item.id);
                                                } else {
                                                    setFullScreenMedia(item);
                                                }
                                            }}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                handleLongPress(item.id);
                                            }}
                                            className={`relative aspect-square bg-white/5 rounded-2xl md:rounded-3xl border border-white/5 overflow-hidden cursor-pointer group hover:shadow-xl transition-all ${selectedIds.includes(item.id) ? 'ring-4 ring-[#c77dff]' : ''}`}
                                        >
                                            {item.type === 'text' || (!item.url && item.content) ? (
                                                <div className="relative w-full h-full p-4 bg-gradient-to-br from-[#1a1025] to-[#0a0512] flex flex-col justify-between group-hover:scale-105 transition-transform duration-500">
                                                    <div className="flex items-center gap-2 text-[#c77dff]">
                                                        <FileText size={18} />
                                                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider">Encrypted Note</span>
                                                    </div>
                                                    <p className="text-xs text-white/80 line-clamp-4 font-sans leading-relaxed">
                                                        {item.content || item.name}
                                                    </p>
                                                    <span className="text-[8px] font-mono text-white/30">TEXT ITEM</span>
                                                </div>
                                            ) : item.type === 'image' ? (
                                                <img src={item.url} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            ) : (
                                                <div className="relative w-full h-full">
                                                    {item.thumbnail ? (
                                                        <img src={item.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                                                    ) : (
                                                        <video src={`${item.url}#t=0.5`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" muted preload="metadata" playsInline />
                                                    )}
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                                        <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                                            <Video size={16} className="text-white drop-shadow-lg" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Selection Overlay */}
                                            {selectionMode && (
                                                <div className="absolute inset-0 bg-[#c77dff]/20 z-10 flex items-start justify-end p-2">
                                                    {selectedIds.includes(item.id) ? (
                                                        <CheckCircle2 size={24} className="text-white fill-[#c77dff]" />
                                                    ) : (
                                                        <Circle size={24} className="text-white/40" />
                                                    )}
                                                </div>
                                            )}

                                            {/* Hover Indicators */}
                                            {!selectionMode && (
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                                    <div className="flex items-center justify-between">
                                                        {item.isFavorite && <Heart size={14} className="text-red-500 fill-red-500" />}
                                                        <span className="text-[9px] font-bold text-white/60 truncate max-w-[80%]">{item.name}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="p-8 rounded-[40px] bg-white/[0.02] border border-white/5 relative">
                                    <FolderLock size={64} className="text-white/10" />
                                    <div className="absolute inset-0 bg-[#c77dff]/5 blur-3xl rounded-full" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold">This Vault is Empty</h3>
                                    <p className="text-xs text-white/40 max-w-[200px]">Protect your private memories by moving them here.</p>
                                </div>
                                <div className="flex flex-col gap-2 w-full max-w-[200px]">
                                    <label className="w-full bg-[#c77dff] hover:brightness-110 text-white p-3 rounded-2xl text-xs font-black uppercase tracking-widest text-center cursor-pointer transition-all">
                                        Import Media
                                        <input type="file" multiple className="hidden" onChange={handleMediaUpload} />
                                    </label>
                                    <button className="w-full bg-white/5 hover:bg-white/10 text-white p-3 rounded-2xl text-xs font-bold transition-all">
                                        Move from Profile
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Selection Toolbar */}
            <AnimatePresence>
                {selectionMode && (
                    <motion.div 
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#110d1a]/95 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl"
                    >
                        <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                            <span className="text-xs font-black uppercase tracking-widest text-[#c77dff]">{selectedIds.length}</span>
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Selected</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <button 
                                onClick={handleBulkRestore}
                                className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={18} />
                                <span className="text-[9px] font-bold uppercase tracking-wider">Restore</span>
                            </button>
                            <button 
                                onClick={handleBulkFavorite}
                                className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                            >
                                <Heart size={18} />
                                <span className="text-[9px] font-bold uppercase tracking-wider">Favorite</span>
                            </button>
                            <button 
                                onClick={handleBulkDelete}
                                className="flex flex-col items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
                            >
                                <Trash2 size={18} />
                                <span className="text-[9px] font-bold uppercase tracking-wider">Delete</span>
                            </button>
                        </div>
                        <button 
                            onClick={() => {
                                setSelectionMode(false);
                                setSelectedIds([]);
                            }}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors ml-2"
                        >
                            <X size={18} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB + Menu */}
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
                            className="bg-[#0f0d14] border border-white/10 rounded-[40px] p-6 w-full max-w-sm space-y-3 shadow-2xl mb-20 md:mb-6"
                        >
                            <div className="pb-2 border-b border-white/5 mb-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-white/40">Add to Vault</h3>
                            </div>
                             <label className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-3xl cursor-pointer transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400">
                                        <ImageLucide size={20} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold">Upload Photos</div>
                                        <div className="text-[10px] text-white/40 uppercase font-bold tracking-tight">From Device Storage</div>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-white/20 group-hover:text-white transition-colors" />
                                <input type="file" accept="image/*" multiple className="hidden" onChange={handleMediaUpload} />
                             </label>
                             <label className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-3xl cursor-pointer transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400">
                                        <Film size={20} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold">Upload Videos</div>
                                        <div className="text-[10px] text-white/40 uppercase font-bold tracking-tight">From Device Storage</div>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-white/20 group-hover:text-white transition-colors" />
                                <input type="file" accept="video/*" multiple className="hidden" onChange={handleMediaUpload} />
                             </label>
                             <button onClick={handleCreateFolder} className="flex w-full items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-3xl cursor-pointer transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400">
                                        <Folder size={20} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold">New Album</div>
                                        <div className="text-[10px] text-white/40 uppercase font-bold tracking-tight">Organize your media</div>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-white/20 group-hover:text-white transition-colors" />
                             </button>
                             
                             <button 
                                onClick={() => setIsFabOpen(false)}
                                className="w-full mt-2 py-4 text-xs font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                             >
                                Cancel
                             </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!selectionMode && (
                <motion.button 
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsFabOpen(!isFabOpen)}
                    className="fixed bottom-24 md:bottom-10 right-6 md:right-10 w-14 h-14 bg-gradient-to-tr from-[#7b2cbf] to-[#c77dff] rounded-[22px] flex items-center justify-center shadow-2xl shadow-[#c77dff]/40 z-50 transition-all border border-white/20"
                >
                    {isFabOpen ? <X size={24} className="text-white" /> : <Plus size={24} className="text-white" strokeWidth={3} />}
                </motion.button>
            )}

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

            {showStoryEditor && <StoryEditor onClose={() => setShowStoryEditor(false)} />}

            {newFolderModalOpen && (
                <div
                    className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
                    onClick={() => setNewFolderModalOpen(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm p-6 rounded-3xl bg-[#0a0c10] border border-white/10"
                    >
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">New Folder</h3>
                        <input
                            autoFocus
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitNewFolder(); }}
                            placeholder="Folder name"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan/50 mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setNewFolderModalOpen(false)}
                                className="flex-1 py-3 rounded-xl bg-white/5 text-white/50 text-[10px] font-black uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitNewFolder}
                                disabled={!newFolderName.trim()}
                                className="flex-1 py-3 rounded-xl bg-aeirmist-cyan text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
