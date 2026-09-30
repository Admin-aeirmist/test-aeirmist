import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle, Send, CheckCircle2, Upload, Bug, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAeirmist } from '../context/AeirmistContext';
import { logger } from '../utils/logger';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { id: 'bug', label: 'Bug / Technical Glitch', icon: Bug },
  { id: 'ui_display', label: 'UI & Layout Display Issue', icon: Sparkles },
  { id: 'account_login', label: 'Account or Profile Problem', icon: HelpCircle },
  { id: 'abuse_harassment', label: 'Safety or User Harassment', icon: ShieldAlert },
  { id: 'general', label: 'Other General Feedback', icon: AlertCircle },
];

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, db, addToast, uploadMedia } = useAeirmist();
  const [category, setCategory] = useState('bug');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachment(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !db) return;

    setIsSubmitting(true);
    try {
      let attachmentUrl = '';
      if (attachment) {
        try {
          if (uploadMedia) {
            attachmentUrl = await uploadMedia(attachment, `reports/${user?.uid || 'guest'}`);
          }
        } catch (upErr) {
          logger.warn("Report attachment upload error, falling back to inline data URL:", upErr);
          attachmentUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(attachment);
          });
        }
      }

      const reportPayload = {
        reportId: `REP-${Date.now().toString(36).toUpperCase()}`,
        reporterUid: user?.uid || profile?.uid || profile?.id || 'guest',
        reporterId: profile?.id || user?.uid || 'guest',
        reporterUsername: profile?.username || user?.displayName || 'anonymous',
        reporterEmail: user?.email || profile?.email || '',
        reason: CATEGORIES.find(c => c.id === category)?.label || category,
        category,
        targetType: 'system_issue',
        targetId: 'app_report',
        description: description.trim(),
        attachments: attachmentUrl ? [attachmentUrl] : [],
        status: 'pending',
        priority: category === 'abuse_harassment' ? 'high' : 'medium',
        createdAt: serverTimestamp(),
        deviceInfo: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          platform: typeof navigator !== 'undefined' ? navigator.platform : '',
          screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : ''
        }
      };

      await addDoc(collection(db, 'reports'), reportPayload);

      setIsSubmitted(true);
      addToast({
        title: "Report Submitted",
        message: "Your report has been sent to our Admin Team. You will receive a notification reply shortly.",
        type: "success"
      });

      setTimeout(() => {
        setIsSubmitted(false);
        setDescription('');
        setAttachment(null);
        setPreviewUrl(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      logger.error("Error submitting report:", err);
      addToast({
        title: "Submission Error",
        message: err?.message || "Failed to submit report. Please try again.",
        type: "warning"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-lg bg-[#111116] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Report a Problem</h3>
                  <p className="text-[11px] text-white/40">Our technical team will review and respond to your inbox</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            {isSubmitted ? (
              <div className="p-10 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-base font-bold text-white uppercase tracking-wider">Report Successfully Received</h4>
                <p className="text-xs text-white/50 max-w-xs leading-relaxed">
                  Thank you for helping us improve Aeirmist. An admin will investigate and send a notification update to your account.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
                {/* User Info Capsule */}
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                  <span className="text-white/40 font-mono">Filing as:</span>
                  <span className="font-bold text-aeirmist-cyan">@{profile?.username || user?.displayName || 'User'}</span>
                </div>

                {/* Category Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Problem Category</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all text-xs font-medium ${
                            isSelected
                              ? 'border-aeirmist-cyan bg-aeirmist-cyan/10 text-white shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                              : 'border-white/5 bg-white/[0.02] text-white/60 hover:text-white hover:border-white/10'
                          }`}
                        >
                          <Icon size={16} className={isSelected ? 'text-aeirmist-cyan' : 'text-white/40'} />
                          <span className="truncate">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Description of the Issue</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Please provide details about what went wrong, steps to reproduce, or what you experienced..."
                    rows={4}
                    required
                    className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/10 focus:border-aeirmist-cyan text-xs text-white placeholder:text-white/20 outline-none resize-none transition-colors leading-relaxed"
                  />
                </div>

                {/* Screenshot Attachment */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Screenshot (Optional)</label>
                  {previewUrl ? (
                    <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-white/10 group">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setAttachment(null);
                          setPreviewUrl(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-500 rounded-xl text-white transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 w-full p-3.5 rounded-2xl border border-dashed border-white/15 hover:border-aeirmist-cyan bg-white/[0.01] hover:bg-aeirmist-cyan/5 text-xs text-white/60 hover:text-white cursor-pointer transition-all">
                      <Upload size={16} />
                      <span>Attach image or screenshot</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !description.trim()}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-aeirmist-cyan to-blue-500 hover:brightness-110 active:scale-95 text-black font-black uppercase text-xs tracking-wider transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <span>Submitting Report...</span>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>Submit Report to Admin</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
