import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { 
    ChevronLeft, ChevronRight, Heart, Trash, Edit2, Share2, Download, 
    MoreVertical, Move, Pin, X, Info, Maximize2, Trash2, ArrowLeft, ShieldCheck, RefreshCw, FileText
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { logger } from '@/src/utils/logger';
import { DownloadManagerService } from '../../../services/DownloadManagerService';


export const MediaViewer = ({ 
    media, 
    allMedia, 
    onClose, 
    onDelete, 
    onFavorite,
    onRestore,
    onMoveToFolder
}: { 
    media: any, 
    allMedia: any[], 
    onClose: () => void,
    onDelete: (id: string) => void,
    onFavorite: (id: string) => void,
    onRestore?: (id: string) => Promise<void>,
    onMoveToFolder?: (id: string) => void
}) => {
    const { addToast } = useAeirmist();
    const currentIndex = allMedia.findIndex(m => m.id === media.id);
    const [current, setCurrent] = useState(currentIndex >= 0 ? currentIndex : 0);
    const [isZoomed, setIsZoomed] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    const currentMedia = allMedia[current] || media;
    const dragX = useMotionValue(0);

    const next = () => setCurrent(prev => (prev + 1) % allMedia.length);
    const prev = () => setCurrent(prev => (prev - 1 + allMedia.length) % allMedia.length);

    const formatMediaDate = (rawDate: any): string => {
        if (!rawDate) return 'Recent';
        try {
            let dateObj: Date;
            if (typeof rawDate?.toDate === 'function') {
                dateObj = rawDate.toDate();
            } else if (rawDate instanceof Date) {
                dateObj = rawDate;
            } else if (typeof rawDate === 'number' || typeof rawDate === 'string') {
                dateObj = new Date(rawDate);
            } else {
                return 'Recent';
            }
            if (isNaN(dateObj.getTime())) return 'Recent';
            return dateObj.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Recent';
        }
    };

    const formatFileSize = (bytes?: number): string => {
        if (!bytes || bytes <= 0) return 'Vault File';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const handleDownload = async () => {
        if (!currentMedia?.url) return;
        try {
            const ext = currentMedia.type === 'video' ? 'mp4' : 'jpg';
            const filename = currentMedia.name || `Aeirmist_${Date.now()}.${ext}`;
            const res = await DownloadManagerService.downloadMediaFile(currentMedia.url, filename);
            if (res.success) {
                addToast({ title: "Saved to Device", message: "Media saved directly to device storage.", type: "success" });
            } else {
                addToast({ title: "Download Issue", message: res.error || "Could not complete download.", type: "warning" });
            }
        } catch (err: any) {
            logger.warn("MediaViewer download fallback error:", err);
            addToast({ title: "Download Error", message: "Failed to save file to device.", type: "warning" });
        }
    };

    const handleShare = async () => {
        if (!currentMedia?.url) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: currentMedia.name || 'Vault Media',
                    url: currentMedia.url
                });
            } catch {}
        } else {
            try {
                await navigator.clipboard.writeText(currentMedia.url);
                addToast({ title: "Copied Link", message: "Media link copied to clipboard.", type: "info" });
            } catch {}
        }
    };

    const handleRestoreItem = async () => {
        if (!onRestore || !currentMedia?.id) return;
        setIsRestoring(true);
        try {
            await onRestore(currentMedia.id);
            onClose();
        } catch (err) {
            logger.error("Restore failed:", err);
        } finally {
            setIsRestoring(false);
        }
    };

    const handleDragEnd = (event: any, info: any) => {
        const threshold = 100;
        if (info.offset.x < -threshold) next();
        else if (info.offset.x > threshold) prev();
    };

    const handleDoubleTap = () => {
        setIsZoomed(!isZoomed);
    };

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-[#030107] flex flex-col overflow-hidden select-none"
            >
                {/* Top Overlay Controls */}
                <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h3 className="text-sm font-bold text-white truncate max-w-[150px] md:max-w-xs">{currentMedia.name || 'Private Media'}</h3>
                            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">{current + 1} of {allMedia.length}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 md:gap-3">
                        {/* Delete button (replaces Heart) */}
                        <button 
                            onClick={() => {
                                onDelete(currentMedia.id);
                                onClose();
                            }}
                            className="p-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-full transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={22} />
                        </button>
                        
                        {/* Info details button */}
                        <button 
                            onClick={() => setShowDetails(!showDetails)}
                            className={`p-2 rounded-full transition-colors ${showDetails ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
                            title="Information"
                        >
                            <Info size={22} />
                        </button>

                        {/* Three Dots Menu */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsMenuOpen(prev => !prev)}
                                className={`p-2 rounded-full transition-colors ${isMenuOpen ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
                                title="More options"
                            >
                                <MoreVertical size={22} />
                            </button>

                            {isMenuOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setIsMenuOpen(false)} 
                                    />
                                    <div className="absolute top-full right-0 mt-2 w-52 bg-[#161224] border border-white/15 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                                        <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/30 border-b border-white/5 mb-1">Actions</div>
                                        <button 
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                if (onMoveToFolder) {
                                                    onMoveToFolder(currentMedia.id);
                                                }
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-xs font-bold text-white transition-colors"
                                        >
                                            <Move size={15} className="text-[#00E5FF]" /> Move to Folder
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                handleDownload();
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 text-xs font-bold text-white transition-colors"
                                        >
                                            <Download size={15} className="text-emerald-400" /> Download to Device
                                        </button>
                                        <div className="my-1 border-t border-white/5" />
                                        <button 
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                onDelete(currentMedia.id);
                                                onClose();
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/15 text-xs font-bold text-red-400 transition-colors"
                                        >
                                            <Trash2 size={15} /> Delete Forever
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Media Content */}
                <div className="flex-1 flex items-center justify-center relative touch-none">
                    <motion.div
                        key={currentMedia.id}
                        drag={isZoomed ? false : "x"}
                        dragConstraints={{ left: 0, right: 0 }}
                        onDragEnd={handleDragEnd}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="w-full h-full flex items-center justify-center p-4 md:p-12"
                        onDoubleClick={handleDoubleTap}
                    >
                        {currentMedia.type === 'text' || (!currentMedia.url && currentMedia.content) ? (
                            <div className="max-w-xl w-full p-8 rounded-3xl bg-gradient-to-br from-[#1b1226] via-[#0f0917] to-black border border-[#c77dff]/30 shadow-2xl space-y-6">
                                <div className="flex items-center gap-3 text-[#c77dff]">
                                    <FileText size={28} />
                                    <h3 className="text-sm font-mono font-bold uppercase tracking-widest">Encrypted Vault Text</h3>
                                </div>
                                <p className="text-base text-white/90 leading-relaxed font-sans select-text whitespace-pre-wrap">
                                    {currentMedia.content || currentMedia.name}
                                </p>
                                <div className="pt-4 border-t border-white/10 flex justify-between items-center text-[10px] font-mono text-white/40">
                                    <span>Protected in Private Vault</span>
                                    <span>AES-256</span>
                                </div>
                            </div>
                        ) : currentMedia.type === 'image' ? (
                            <motion.img 
                                src={currentMedia.url} 
                                animate={{ scale: isZoomed ? 2 : 1 }}
                                transition={{ type: "spring", damping: 30 }}
                                className={`max-w-full max-h-full object-contain shadow-2xl transition-all ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                                draggable={false}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <video 
                                    src={currentMedia.url} 
                                    controls 
                                    autoPlay
                                    className="max-w-full max-h-full shadow-2xl rounded-lg" 
                                />
                            </div>
                        )}
                    </motion.div>
                    
                    {/* Desktop Navigation Arrows */}
                    <div className="hidden md:block">
                        <button 
                            onClick={prev} 
                            className="absolute left-8 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-full text-white/40 hover:text-white transition-all border border-white/5 group"
                        >
                            <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <button 
                            onClick={next} 
                            className="absolute right-8 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-full text-white/40 hover:text-white transition-all border border-white/5 group"
                        >
                            <ChevronRight size={32} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* Bottom Strip */}
                <div className="absolute bottom-0 left-0 right-0 z-50 p-6 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {/* Thumbnails strip */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mask-linear-x">
                            {allMedia.map((item, index) => (
                                <button 
                                    key={item.id} 
                                    onClick={() => setCurrent(index)}
                                    className={`relative w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden flex-shrink-0 transition-all ${index === current ? 'ring-2 ring-[#c77dff] scale-110 z-10' : 'opacity-40 hover:opacity-100 scale-90'}`}
                                >
                                    <img src={item.thumbnail || item.url} className="w-full h-full object-cover" />
                                    {item.type === 'video' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            <Maximize2 size={12} className="text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex justify-between items-center bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[30px] p-2 md:p-3 px-6 md:px-8">
                            {[
                                { icon: Download, label: 'Save', action: handleDownload },
                                { icon: Share2, label: 'Share', action: handleShare },
                                { icon: RefreshCw, label: 'Restore', color: 'text-emerald-400', action: handleRestoreItem },
                                { icon: Trash2, label: 'Delete', color: 'text-red-400', action: () => { onDelete(currentMedia?.id); onClose(); } },
                            ].map((btn, i) => (
                                <button 
                                    key={i}
                                    onClick={btn.action}
                                    disabled={isRestoring}
                                    className={`flex flex-col items-center gap-1.5 transition-all hover:scale-110 ${btn.color || 'text-white/60 hover:text-white'}`}
                                >
                                    <btn.icon size={20} className={btn.label === 'Restore' && isRestoring ? 'animate-spin' : ''} />
                                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider hidden md:block">{btn.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Media Details Sidebar / Bottom Sheet */}
                <AnimatePresence>
                    {showDetails && (
                        <>
                            {/* Backdrop on mobile */}
                            <div 
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[109] md:hidden"
                                onClick={() => setShowDetails(false)}
                            />
                            <motion.div
                                initial={{ x: 400, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 400, opacity: 0 }}
                                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                                className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#0d0b14] border-l border-white/10 z-[110] shadow-2xl p-6 md:p-8 space-y-6 overflow-y-auto"
                            >
                                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-[#00E5FF]/10 text-[#00E5FF]">
                                            <Info size={18} />
                                        </div>
                                        <h3 className="text-base font-bold text-white tracking-wide">File Information</h3>
                                    </div>
                                    <button 
                                        onClick={() => setShowDetails(false)} 
                                        className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                                        <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#00E5FF]">File Name</p>
                                        <p className="text-sm font-semibold text-white break-all leading-snug">{currentMedia.name || 'Unnamed media'}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                                            <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-white/40">Type</p>
                                            <p className="text-xs font-bold text-white capitalize">{currentMedia.type || (currentMedia.url?.includes('.mp4') ? 'Video' : 'Image')}</p>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                                            <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-white/40">Size</p>
                                            <p className="text-xs font-bold text-white font-mono">{formatFileSize(currentMedia.size)}</p>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                                        <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-white/40">Date & Time</p>
                                        <p className="text-xs font-bold text-white">{formatMediaDate(currentMedia.createdAt)}</p>
                                    </div>

                                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
                                        <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-white/40">Location</p>
                                        <p className="text-xs font-bold text-white truncate">{currentMedia.folderName || 'Private Safe (Vault)'}</p>
                                    </div>

                                    <div className="pt-2">
                                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3.5">
                                            <ShieldCheck className="text-emerald-400 shrink-0" size={24} />
                                            <div>
                                                <p className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">End-to-End Encrypted</p>
                                                <p className="text-[10px] text-emerald-400/70 mt-0.5 leading-relaxed">Secured in Private Safe with authenticated hardware PIN protection.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
};
