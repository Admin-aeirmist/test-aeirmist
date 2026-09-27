import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    ArrowLeft, FolderLock, Plus, Search, Settings, Folder, 
    MoreVertical, Image as ImageIcon, Video, X 
} from 'lucide-react';

export const PrivacyFolder = ({ 
    onBack, 
    onSettingsClick, 
    privacyMedia, 
    handleMediaUpload 
}: { 
    onBack: () => void, 
    onSettingsClick: () => void,
    privacyMedia: any[],
    handleMediaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => {
    const [folders] = useState([
        { id: '1', name: 'Personal', count: 12 },
        { id: '2', name: 'Travel', count: 5 },
        { id: '3', name: 'Documents', count: 8 },
    ]);
    const [isFabOpen, setIsFabOpen] = useState(false);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col w-full h-full text-left bg-[#030107]"
        >
            {/* Header */}
            <div className="p-4 md:p-6 shrink-0 flex items-center justify-between border-b border-white/5 w-full bg-[#050309]">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="p-1 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="text-sm font-display font-black uppercase tracking-[0.2em] text-[#d8bbff]">Privacy Folder</h2>
                </div>
                <button onClick={onSettingsClick} className="p-2 hover:bg-white/5 rounded-xl text-white/50 hover:text-white">
                    <Settings size={18} />
                </button>
            </div>
            
            {/* Search */}
            <div className="p-4 bg-[#050309]">
                <div className="w-full bg-white/[0.03] rounded-2xl p-3 flex items-center gap-3 border border-white/5">
                    <Search size={16} className="text-white/30" />
                    <input type="text" placeholder="Search folders, media..." className="bg-transparent text-xs w-full outline-none text-white placeholder:text-white/20" />
                </div>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6">
                
                {/* Folders Section */}
                <section>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Folders</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {folders.map(folder => (
                            <div key={folder.id} className="p-4 bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 rounded-2xl flex flex-col gap-2 transition-all cursor-pointer">
                                <Folder size={24} className="text-[#c77dff]/60" />
                                <div>
                                    <p className="text-xs font-bold text-white/90">{folder.name}</p>
                                    <p className="text-[9px] text-white/40">{folder.count} items</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Recent Media Section */}
                <section className="flex-1">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3 px-1">Recent Media</h3>
                    {privacyMedia.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center text-white/20 border-2 border-dashed border-white/5 rounded-2xl">
                             <FolderLock size={24} className="mb-2" />
                             <p className="text-[10px] uppercase tracking-widest">No media uploaded</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            {privacyMedia.map(item => (
                                <div key={item.id} className="aspect-square bg-white/5 rounded-xl border border-white/5 overflow-hidden relative group">
                                    {item.type === 'image' ? (
                                        <img src={item.url} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    ) : (
                                        <div className="relative w-full h-full">
                                            {item.thumbnail ? (
                                                <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                            ) : (
                                                <video src={`${item.url}#t=0.5`} className="w-full h-full object-cover transition-transform group-hover:scale-105" muted preload="metadata" playsInline />
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                                <div className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                                    <Video size={12} className="text-white" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* FAB + Menu */}
            <AnimatePresence>
                {isFabOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-end justify-center pb-24"
                        onClick={() => setIsFabOpen(false)}
                    >
                        <motion.div 
                            initial={{ y: 50 }}
                            animate={{ y: 0 }}
                            className="bg-[#110d1a] border border-white/10 rounded-3xl p-4 w-[90%] space-y-2"
                        >
                             <label className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer">
                                <ImageIcon size={18} className="text-[#c77dff]" />
                                <span className="text-sm">Upload Photo</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleMediaUpload} />
                             </label>
                             <label className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer">
                                <Video size={18} className="text-[#c77dff]" />
                                <span className="text-sm">Upload Video</span>
                                <input type="file" accept="video/*" className="hidden" onChange={handleMediaUpload} />
                             </label>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button 
                onClick={() => setIsFabOpen(!isFabOpen)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-[#c77dff] rounded-full flex items-center justify-center shadow-lg shadow-[#c77dff]/20 hover:scale-105 transition-transform z-50"
            >
                {isFabOpen ? <X size={24} className="text-white" /> : <Plus size={24} className="text-white" />}
            </button>
        </motion.div>
    );
};
