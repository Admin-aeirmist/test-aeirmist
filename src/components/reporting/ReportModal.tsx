import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, ChevronRight, Loader2, CheckCircle, Upload, Shield } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { db, storage } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { logger } from '@/src/utils/logger';


interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: string;
  targetId: string;
  reportedUid: string;
  meta?: any;
}

const REPORT_REASONS = [
  'Spam', 'Fake Account', 'Impersonation', 'Harassment or Bullying', 'Hate Speech',
  'Violence', 'Terrorism', 'Self Harm', 'Child Safety', 'Nudity', 'Sexual Content',
  'Scam', 'Fraud', 'False Information', 'Copyright', 'Trademark', 'Illegal Goods',
  'Drugs', 'Weapons', 'Marketplace Scam', 'Privacy Violation', 'Other'
];

const AUTO_PRIORITIES: Record<string, string> = {
  'Spam': 'low',
  'Harassment or Bullying': 'medium',
  'Scam': 'high',
  'Fraud': 'high',
  'Marketplace Scam': 'high',
  'Child Safety': 'critical',
  'Terrorism': 'critical',
  'Self Harm': 'critical',
};

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen, onClose, targetType, targetId, reportedUid, meta
}) => {
  const { user, profile, addToast } = useAeirmist();
  const [step, setStep] = useState<'reason' | 'details' | 'success'>('reason');
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportId, setReportId] = useState('');

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    setStep('details');
  };

  const handleSubmit = async () => {
    if (!user || !db || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Check for duplicate recent reports from this user for this target
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const q = query(
        collection(db, 'reports'),
        where('reporterUid', '==', user.uid),
        where('targetId', '==', targetId)
      );
      const snapshot = await getDocs(q);
      const recentReports = snapshot.docs.filter(doc => {
        const data = doc.data();
        if (!data.createdAt) return false;
        return data.createdAt.toDate() > oneHourAgo;
      });

      if (recentReports.length > 0) {
        addToast({ title: 'Already Reported', message: 'You have already reported this content recently.', type: 'warning' });
        setIsSubmitting(false);
        onClose();
        return;
      }

      let attachmentObj = null;
      if (file && storage) {
        if (!file.type || !file.type.startsWith('image/')) {
          addToast({ title: 'Invalid File', message: 'Only image files are supported.', type: 'warning' });
          setIsSubmitting(false);
          return;
        }
        if (file.size > 8 * 1024 * 1024) {
          addToast({ title: 'File Too Large', message: 'Images must be under 8MB.', type: 'warning' });
          setIsSubmitting(false);
          return;
        }

        const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
        const base = file.name.split('.').slice(0, -1).join('.').toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 30);
        const rand = Math.random().toString(36).substring(2, 8);
        const safeName = `${base || 'screenshot'}_${Date.now()}_${rand}.${ext}`;

        const fileRef = ref(storage, `reports/${user.uid}/${safeName}`);
        await uploadBytes(fileRef, file, { contentType: file.type || 'image/png' });
        const downloadUrl = await getDownloadURL(fileRef);

        attachmentObj = {
          url: downloadUrl,
          name: file.name,
          contentType: file.type || 'image/png',
          size: file.size,
          uploadedAt: new Date().toISOString()
        };
      }

      const priority = AUTO_PRIORITIES[selectedReason] || 'low';
      const refId = `RPT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
      
      await addDoc(collection(db, 'reports'), {
        reportId: refId,
        reporterUid: user.uid,
        reporterUsername: profile?.username || 'Unknown',
        reportedUid,
        targetType,
        targetId,
        reason: selectedReason,
        description,
        attachments: attachmentObj ? [attachmentObj] : [],
        status: 'pending',
        priority,
        createdAt: serverTimestamp(),
        meta: meta || {}
      });

      setReportId(refId);
      setStep('success');
    } catch (err) {
      logger.error('Error submitting report:', err);
      addToast({ title: 'Error', message: 'Could not submit report. Please try again.', type: 'warning' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isSubmitting ? undefined : onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
          />
          <div className="fixed inset-0 z-[9999] pointer-events-none flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-[#0a0a0a] sm:rounded-3xl rounded-t-3xl border border-white/10 shadow-2xl pointer-events-auto flex flex-col max-h-[85vh]"
            >
              <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-red-500" size={20} />
                  <h3 className="font-bold text-white uppercase tracking-wider text-sm">Report Content</h3>
                </div>
                {!isSubmitting && step !== 'success' && (
                  <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white">
                    <X size={20} />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {step === 'reason' && (
                  <div className="p-4 space-y-4">
                    <div>
                      <h4 className="font-bold text-white mb-1">Why are you reporting this?</h4>
                      <p className="text-xs text-white/60">If someone is in immediate danger, call local emergency services - don't wait for us to report it.</p>
                    </div>
                    
                    <div className="space-y-1">
                      {REPORT_REASONS.map((reason) => (
                        <button
                          key={reason}
                          onClick={() => handleReasonSelect(reason)}
                          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group text-left"
                        >
                          <span className="text-sm text-white/90 group-hover:text-white">{reason}</span>
                          <ChevronRight size={16} className="text-white/20 group-hover:text-white/60" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 'details' && (
                  <div className="p-4 space-y-6">
                    <div>
                      <button onClick={() => setStep('reason')} className="text-xs text-aeirmist-cyan hover:underline mb-2 flex items-center gap-1">
                        &larr; Back to reasons
                      </button>
                      <h4 className="font-bold text-white">Additional Details</h4>
                      <p className="text-xs text-white/60">Help us understand the issue (Optional).</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
                          <span className="text-xs font-bold text-red-400 block mb-1">Selected Reason:</span>
                          <span className="text-sm text-white">{selectedReason}</span>
                        </div>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Provide more context..."
                          maxLength={500}
                          rows={4}
                          className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-aeirmist-cyan outline-none resize-none transition-colors"
                        />
                        <div className="text-right text-[10px] text-white/40 mt-1">
                          {description.length}/500
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-white mb-2">Upload Screenshot (Optional)</label>
                        <div className="relative border-2 border-dashed border-white/20 rounded-xl p-6 hover:bg-white/5 transition-colors text-center cursor-pointer">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <Upload className="mx-auto text-white/40 mb-2" size={24} />
                          {file ? (
                            <span className="text-sm text-aeirmist-cyan">{file.name}</span>
                          ) : (
                            <span className="text-xs text-white/60">Tap to upload image</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 'success' && (
                  <div className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="text-emerald-400" size={32} />
                    </div>
                    <h4 className="text-xl font-bold text-white">Thank you.</h4>
                    <p className="text-sm text-white/60">Your report has been submitted and will be reviewed shortly.</p>
                    
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mt-6 text-left">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-white/40 font-mono uppercase">Reference ID</span>
                        <span className="text-xs font-bold text-white font-mono">{reportId}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/40 font-mono uppercase">Status</span>
                        <span className="text-xs font-bold text-aeirmist-cyan">Pending Review</span>
                      </div>
                    </div>

                    <button
                      onClick={onClose}
                      className="w-full mt-6 py-3 rounded-xl bg-white/10 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>

              {step === 'details' && (
                <div className="flex-shrink-0 p-4 border-t border-white/10 bg-[#0a0a0a]">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
                    Submit Report
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
