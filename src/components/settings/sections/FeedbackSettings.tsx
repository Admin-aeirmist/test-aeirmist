import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  Bug, 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown,
  AlertCircle,
  Check,
  Zap,
  Layers,
  Heart,
  ChevronDown,
  PlusSquare,
  Compass,
  Home,
  MessageCircle,
  Bell,
  Settings,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { db, storage } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { logger } from '@/src/utils/logger';


const AREAS = [
  { id: 'create', label: 'Create', desc: 'Report an issue related to create functionality.', icon: <PlusSquare size={16} /> },
  { id: 'explore', label: 'Explore', desc: 'Report an issue related to explore page.', icon: <Compass size={16} /> },
  { id: 'home', label: 'Home', desc: 'Report an issue related to your home feed.', icon: <Home size={16} /> },
  { id: 'messages', label: 'Messages', desc: 'Report an issue related to messages.', icon: <MessageCircle size={16} /> },
  { id: 'notifications', label: 'Notifications', desc: 'Report an issue related to notifications.', icon: <Bell size={16} /> },
  { id: 'settings', label: 'Settings', desc: 'Report an issue related to app settings.', icon: <Settings size={16} /> },
];

const FeedbackSettings = () => {
  const { addToast, user, profile } = useAeirmist();
  const [type, setType] = useState<'bug' | 'feature' | 'general' | 'appreciation'>('bug');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  
  // New fields for bug report
  const [area, setArea] = useState(AREAS[0]);
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshot(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const removeImage = () => {
    setScreenshot(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setScreenshot(file);
          setPreviewUrl(URL.createObjectURL(file));
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || !db) return;

    setIsSending(true);
    
    try {
      let attachmentUrl = null;
      if (screenshot && storage) {
        const fileRef = ref(storage, `supportTickets/${user.uid}/${Date.now()}_${screenshot.name}`);
        await uploadBytes(fileRef, screenshot);
        attachmentUrl = await getDownloadURL(fileRef);
      }

      await addDoc(collection(db, 'supportTickets'), {
        userId: user.uid,
        username: profile?.username || 'Unknown',
        type,
        area: type === 'bug' ? area.id : null,
        message,
        attachmentUrl,
        status: 'open',
        createdAt: serverTimestamp()
      });

      setSent(true);
      addToast?.({
        title: 'Report Sent',
        message: 'Thank you! Your report has been sent to our support team.',
        type: 'success'
      });
      
      setTimeout(() => {
        setSent(false);
        setMessage('');
        removeImage();
      }, 3000);
    } catch (err) {
      logger.error("Error submitting report:", err);
      addToast?.({
        title: 'Error',
        message: 'Could not submit your report. Please try again.',
        type: 'warning'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 pb-24"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-display font-bold text-white">Report a Problem</h2>
        <p className="text-xs text-white/45 uppercase tracking-widest font-medium">Send bug reports directly to the admin panel</p>
      </div>

      <div className="p-8 rounded-[3rem] bg-white/[0.02] border border-white/10 space-y-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-aeirmist-cyan">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold uppercase tracking-wider text-white">Report Details</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">Support & Bug Reports</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FeedbackTypeBtn 
              active={type === 'bug'} 
              onClick={() => setType('bug')} 
              icon={<Bug size={14} />} 
              label="Bug Report" 
              color="text-red-400"
            />
            <FeedbackTypeBtn 
              active={type === 'feature'} 
              onClick={() => setType('feature')} 
              icon={<Sparkles size={14} />} 
              label="Feature Idea" 
              color="text-aeirmist-cyan"
            />
            <FeedbackTypeBtn 
              active={type === 'general'} 
              onClick={() => setType('general')} 
              icon={<Layers size={14} />} 
              label="General" 
              color="text-white"
            />
            <FeedbackTypeBtn 
              active={type === 'appreciation'} 
              onClick={() => setType('appreciation')} 
              icon={<Heart size={14} />} 
              label="Compliment" 
              color="text-aeirmist-magenta"
            />
          </div>

          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onPaste={handlePaste}
              placeholder="Explain what is not working..."
              className="w-full h-40 p-6 bg-white/[0.03] border border-white/10 rounded-3xl text-sm font-sans text-white placeholder:text-white/40 focus:border-white/30 focus:bg-white/[0.05] outline-none transition-all resize-none"
              required
            />
            <div className="absolute bottom-4 right-4 text-[9px] font-mono text-white/30 uppercase">
              {message.length} chars
            </div>
            
            <p className="text-[10px] text-white/40 mt-2 ml-2">
              You can also paste image files here directly to add them as screenshots.
            </p>
          </div>

          {type === 'bug' && (
            <div className="space-y-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAreaDropdownOpen(!isAreaDropdownOpen)}
                  className="w-full h-14 px-6 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-between text-sm text-white hover:bg-white/[0.05] transition-colors"
                >
                  <span className={area ? "text-white" : "text-white/40"}>
                    {area ? area.label : "Search for an area"}
                  </span>
                  <ChevronDown size={18} className={`text-white/40 transition-transform ${isAreaDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isAreaDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#151515] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="max-h-64 overflow-y-auto">
                        {AREAS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setArea(a);
                              setIsAreaDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
                              {a.icon}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">{a.label}</div>
                              <div className="text-[10px] text-white/40 mt-0.5">{a.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {previewUrl ? (
                <div className="relative inline-block">
                  <img src={previewUrl} alt="Screenshot preview" className="h-32 rounded-xl object-cover border border-white/10" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-lg"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
                >
                  <ImageIcon size={14} />
                  Add Screenshot
                </button>
              )}
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSending || sent || !message.trim()}
            className={`w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[11px] tracking-[0.3em] transition-all cursor-pointer mt-8 ${
              sent 
                ? 'bg-aeirmist-lime text-black' 
                : 'bg-white text-black hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20'
            }`}
          >
            {isSending ? (
              <>
                <Zap size={16} className="animate-spin" />
                Sending...
              </>
            ) : sent ? (
              <>
                <Check size={16} />
                Submitted
              </>
            ) : (
              <>
                <Send size={16} />
                Submit Report
              </>
            )}
          </button>
        </form>
      </div>

    </motion.div>
  );
};

const FeedbackTypeBtn = ({ active, onClick, icon, label, color }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
      active 
        ? 'bg-white/10 border-white/20 shadow-xl' 
        : 'bg-white/[0.02] border-white/5 text-white/30 hover:border-white/10'
    }`}
  >
    <span className={active ? color : ''}>{icon}</span>
    <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-white' : ''}`}>{label}</span>
  </button>
);

export default FeedbackSettings;
