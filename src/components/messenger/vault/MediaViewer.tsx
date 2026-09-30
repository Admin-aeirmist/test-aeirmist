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
    onRestore
}: { 
    media: any, 
    allMedia: any[], 
    onClose: () => void,
    onDelete: (id: string) => void,
    onFavorite: (id: string) => void,
    onRestore?: (id: string) => Promise<void>
}) => {
    const { addToast } = useAeirmist();
    const currentIndex = allMedia.findIndex(m => m.id === media.id);
    const [current, setCurrent] = useState(currentIndex >= 0 ? currentIndex : 0);
    const [isZoomed, setIsZoomed] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    
    const currentMedia = allMedia[current] || media;
    const dragX = useMotionValue(0);

    const next = () => setCurrent(prev => (prev + 1) % allMedia.length);
    const prev = () => setCurrent(prev => (prev - 1 + allMedia.length) % allMedia.length);

    const handleDownload = async () => {
        if (!currentMedia?.url) return;
        try {
            const ext = currentMedia.type === 'video' ? 'mp4' : 'jpg';
            const filename = currentMedia.name || `vault_media_${Date.now()}.${ext}`;
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
                    
                    <div className="flex items-center gap-1 md:gap-4">
                        <button 
                            onClick={() => onFavorite(currentMedia.id)}
                            className={`p-2 hover:bg-white/10 rounded-full transition-all ${currentMedia.isFavorite ? 'text-red-500 fill-red-500' : 'text-white/60'}`}
                        >
                            <Heart size={22} />
                        </button>
                        <button 
                            onClick={() => setShowDetails(!showDetails)}
                            className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors"
                        >
                            <Info size={22} />
                        </button>
                        <div className="relative group">
                            <button className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors">
                                <MoreVertical size={22} />
                            </button>
                            <div className="absolute top-full right-0 mt-2 w-48 bg-[#1a1128] border border-white/10 rounded-2xl shadow-2xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/30 border-b border-white/5 mb-1">Tools</div>
                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-xs font-bold text-white/80">
                                    <Edit2 size={14} /> Adjust Colors
                                </button>
                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-xs font-bold text-white/80">
                                    <Maximize2 size={14} /> Enhanced View
                                </button>
                                <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-xs font-bold text-white/80">
                                    <Move size={14} /> Move to Album
                                </button>
                                <button onClick={() => onDelete(currentMedia.id)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 text-xs font-bold text-red-400">
                                    <Trash2 size={14} /> Delete Forever
                                </button>
                            </div>
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

                {/* Media Details Sidebar/Overlay */}
                <AnimatePresence>
                    {showDetails && (
                        <motion.div
                            initial={{ x: 400 }}
                            animate={{ x: 0 }}
                            exit={{ x: 400 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-[#0a0a0f] border-l border-white/10 z-[110] shadow-2xl p-8 space-y-8"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-display font-black tracking-widest uppercase">Information</h3>
                                <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-white/5 rounded-full"><X size={20} /></button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black tracking-widest text-white/30">Filename</p>
                                    <p className="text-sm font-bold text-white break-all">{currentMedia.name || 'unnamed_file.media'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black tracking-widest text-white/30">Type</p>
                                    <p className="text-sm font-bold text-white capitalize">{currentMedia.type}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black tracking-widest text-white/30">Added on</p>
                                    <p className="text-sm font-bold text-white">July 16, 2026 • 10:11 AM</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-black tracking-widest text-white/30">Location</p>
                                    <p className="text-sm font-bold text-white">Private Folder Storage</p>
                                </div>
                                <div className="pt-4 border-t border-white/5">
                                    <div className="p-4 rounded-2xl bg-[#c77dff]/5 border border-[#c77dff]/10 flex items-center gap-4">
                                        <ShieldCheck className="text-[#c77dff]" size={24} />
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-[#c77dff] tracking-widest">End-to-End Encrypted</p>
                                            <p className="text-[9px] text-[#c77dff]/60">This file is only viewable within the Vault.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
};
