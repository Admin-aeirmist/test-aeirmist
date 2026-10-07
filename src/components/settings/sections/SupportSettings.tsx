import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LifeBuoy, 
  Search, 
  FileText, 
  Shield, 
  HelpCircle, 
  ExternalLink, 
  ChevronRight, 
  ChevronDown,
  MessageSquare,
  Upload,
  X,
  Check,
  AlertCircle,
  Monitor,
  CheckCircle,
  Clock,
  Sparkles,
  Bug,
  Lightbulb,
  Lock,
  Scale,
  Send,
  RefreshCw,
  Image as ImageIcon,
  ShieldCheck,
  Mail,
  Info,
  Smartphone,
  Eye
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc 
} from 'firebase/firestore';
import { formatAeirmistTimestamp } from '../../../lib/date';
import { storage } from '../../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { logger } from '@/src/utils/logger';


type SupportTab = 
  | 'report' 
  | 'my_reports' 
  | 'contact' 
  | 'faq' 
  | 'terms';

const CATEGORIES = [
  'General App',
  'Home Feed',
  'Explore',
  'Connections',
  'Messages',
  'Notifications',
  'Stories',
  'Profile',
  'Marketplace',
  'Payments',
  'Verification',
  'Groups',
  'Videos',
  'Comments',
  'Search',
  'Settings',
  'Privacy',
  'Security',
  'Login',
  'Signup',
  'Password',
  'Account Recovery',
  'Live Broadcast',
  'Performance',
  'Bug Report',
  'Feature Request',
  'Other'
];

const FAQ_ITEMS = [
  {
    q: 'How do I secure my Aeirmist account with two-factor authentication?',
    a: 'Navigate to Settings -> Security -> Two-Factor Authentication. You can enable authenticator apps (TOTP) or backup security codes.',
    cat: 'Security'
  },
  {
    q: 'What are the requirements for getting a verified node badge?',
    a: 'Apply under Settings -> Verification. You will need a completed profile, verified email, active presence, and official photo ID documentation.',
    cat: 'Verification'
  },
  {
    q: 'How does the end-to-end messaging encryption work?',
    a: 'All direct messages and group chats on Aeirmist utilize zero-knowledge cryptographic ratchets. No intermediary node can decrypt your payloads.',
    cat: 'Privacy'
  },
  {
    q: 'Can I request a full export of my personal data?',
    a: 'Yes. Use the Privacy Request shortcut or submit a support report with Category set to Privacy. You will receive a ZIP archive with your account history.',
    cat: 'Data Rights'
  },
  {
    q: 'How do I appeal a content warning or account moderation action?',
    a: 'Click "Appeal a Decision" in the Support Portal to file an official review. Our trust & safety team usually responds within 24 hours.',
    cat: 'Appeals'
  }
];

export const SupportSettings: React.FC = () => {
  const { user, profile, db, addToast } = useAeirmist();
  const [activeTab, setActiveTab] = useState<SupportTab>('report');
  
  // Form state for "Report a Problem"
  const [category, setCategory] = useState<string>('General App');
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false);
  const [categorySearch, setCategorySearch] = useState<string>('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [includeDiagnostics, setIncludeDiagnostics] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedReport, setSubmittedReport] = useState<any>(null);

  // Close category dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // My Reports state
  const [myReports, setMyReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(true);
  const [faqSearch, setFaqSearch] = useState<string>('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Quick reply for My Reports when admin requests info
  const [userReplyText, setUserReplyText] = useState<{ [reportId: string]: string }>({});
  const [isSendingUserReply, setIsSendingUserReply] = useState<boolean>(false);

  // Realtime subscription to user's reports
  useEffect(() => {
    if (!db || !user?.uid) {
      setLoadingReports(false);
      return;
    }

    const q = query(
      collection(db, 'supportReports'),
      where('userUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyReports(items);
      setLoadingReports(false);
    }, (err) => {
      logger.warn("My reports listener error:", err);
      setLoadingReports(false);
    });

    return () => unsub();
  }, [db, user?.uid]);

  // Image Upload handler
  const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ];
  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (selectedFiles.length >= 5) {
      addToast?.({
        title: 'LIMIT REACHED',
        message: 'You can attach up to 5 screenshots per report.',
        type: 'warning'
      });
      return;
    }

    const remainingSlots = 5 - selectedFiles.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of filesToProcess) {
      if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) || !file.type.startsWith('image/')) {
        addToast?.({ title: 'INVALID FILE', message: `${file.name} is not a supported image file.`, type: 'warning' });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        addToast?.({ title: 'FILE TOO LARGE', message: `${file.name} exceeds the 8MB limit.`, type: 'warning' });
        continue;
      }

      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setFilePreviews(prev => [...prev, ...newPreviews]);
    }

    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    if (filePreviews[index]) {
      URL.revokeObjectURL(filePreviews[index]);
    }
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const generateSafeFilename = (originalName: string) => {
    const parts = originalName.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') : 'png';
    const base = parts.join('.').toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 30);
    const rand = Math.random().toString(36).substring(2, 8);
    return `${base || 'screenshot'}_${Date.now()}_${rand}.${ext || 'png'}`;
  };

  // Collect diagnostics if consented
  const getDeviceInfo = () => {
    if (!includeDiagnostics) return null;
    const ua = navigator.userAgent;
    let device = 'Desktop';
    if (/Mobile|Android|iPhone|iPad/i.test(ua)) device = 'Mobile / Tablet';

    let browser = 'Unknown Browser';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';

    let os = 'Unknown OS';
    if (ua.includes('Macintosh')) os = 'macOS';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return {
      device,
      browser,
      os,
      appVersion: 'v2.4.0 Core',
      resolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '1920x1080',
      networkType: typeof navigator !== 'undefined' && navigator.onLine ? 'Online (High-Bandwidth)' : 'Offline'
    };
  };

  // Submit Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      addToast?.({ title: 'REQUIRED', message: 'Please describe what happened.', type: 'warning' });
      return;
    }

    if (!db || !user) {
      addToast?.({ title: 'AUTHENTICATION ERROR', message: 'You must be logged in to submit.', type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      const referenceId = `SUP-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      // Upload attachments to Firebase Storage
      const uploadedAttachments: { url: string; name: string; contentType: string; size: number; uploadedAt: string }[] = [];
      if (selectedFiles.length > 0 && storage) {
        for (const file of selectedFiles) {
          const safeName = generateSafeFilename(file.name);
          const fileRef = ref(storage, `supportReports/${user.uid}/${referenceId}/${safeName}`);
          await uploadBytes(fileRef, file, { contentType: file.type || 'image/png' });
          const downloadUrl = await getDownloadURL(fileRef);
          uploadedAttachments.push({
            url: downloadUrl,
            name: file.name,
            contentType: file.type || 'image/png',
            size: file.size,
            uploadedAt: new Date().toISOString()
          });
        }
      }

      const reportPayload = {
        reportId: referenceId,
        userUid: user.uid,
        userId: user.uid,
        username: profile?.username || user.displayName || 'Anonymous Node',
        email: user.email || profile?.email || '',
        isVerified: profile?.verified || profile?.isVerified || false,
        category,
        description: description.trim(),
        attachments: uploadedAttachments,
        deviceInfo: getDeviceInfo(),
        status: 'Pending',
        priority: category === 'Bug Report' || category === 'Security' ? 'High' : 'Medium',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadByAdmin: true,
        unreadByUser: false,
        adminReply: null,
        closedAt: null
      };

      await addDoc(collection(db, 'supportReports'), reportPayload);

      setSubmittedReport({
        id: referenceId,
        category,
        status: 'Pending'
      });

      addToast?.({
        title: 'REPORT SUBMITTED',
        message: `Your report ${referenceId} has been logged.`,
        type: 'success'
      });

      // Clear form and previews
      filePreviews.forEach(url => URL.revokeObjectURL(url));
      setSelectedFiles([]);
      setFilePreviews([]);
      setDescription('');
    } catch (err) {
      logger.error("Error submitting report:", err);
      addToast?.({
        title: 'SUBMISSION FAILED',
        message: 'Could not connect to support service. Please try again.',
        type: 'warning'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send user follow-up reply if admin requested info
  const handleSendUserReply = async (reportDocId: string) => {
    const text = userReplyText[reportDocId];
    if (!text || !text.trim() || !db) return;

    setIsSendingUserReply(true);
    try {
      await updateDoc(doc(db, 'supportReports', reportDocId), {
        description: `${myReports.find(r => r.id === reportDocId)?.description}\n\n--- User Update (${new Date().toLocaleTimeString()}) ---\n${text.trim()}`,
        unreadByAdmin: true,
        updatedAt: serverTimestamp()
      });

      addToast?.({
        title: 'RESPONSE SENT',
        message: 'Your update was sent to Aeirmist Support.',
        type: 'success'
      });

      setUserReplyText(prev => ({ ...prev, [reportDocId]: '' }));
    } catch (err) {
      logger.error("Failed to send reply:", err);
    } finally {
      setIsSendingUserReply(false);
    }
  };

  // Routing helper from quick options
  const handleQuickOption = (cat: string) => {
    setCategory(cat);
    setActiveTab('report');
    setSubmittedReport(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-5xl mx-auto"
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5 text-aeirmist-cyan text-xs font-mono font-bold uppercase tracking-widest mb-1">
            <LifeBuoy size={16} />
            Customer Support Portal
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white">System Support</h1>
          <p className="text-xs text-white/50 mt-1">
            Report technical issues, track submitted tickets, or explore self-service documentation.
          </p>
        </div>

        {/* Support Status Indicator */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/[0.03] border border-white/10 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]" />
          <div>
            <div className="text-[10px] font-bold text-white uppercase tracking-wider">Support Available</div>
            <div className="text-[9px] text-white/40">Typically responds within 24–48 hours</div>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Ribbon */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-white/[0.02] border border-white/10">
        {[
          { id: 'report', label: 'Report a Problem', icon: <Bug size={14} /> },
          { id: 'my_reports', label: `My Reports (${myReports.length})`, icon: <FileText size={14} /> },
          { id: 'contact', label: 'Contact Support', icon: <Mail size={14} /> },
          { id: 'faq', label: 'Help Center / FAQ', icon: <HelpCircle size={14} /> },
          { id: 'terms', label: 'Terms & Policies', icon: <Shield size={14} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as SupportTab);
              setSubmittedReport(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-aeirmist-cyan text-black shadow-lg shadow-aeirmist-cyan/20 font-black'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Quick Category Action Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { label: 'Report a Bug', cat: 'Bug Report', icon: <Bug size={14} className="text-red-400" /> },
          { label: 'Suggest Feature', cat: 'Feature Request', icon: <Lightbulb size={14} className="text-amber-400" /> },
          { label: 'Contact Support', tab: 'contact', icon: <Mail size={14} className="text-aeirmist-cyan" /> },
          { label: 'Privacy Request', cat: 'Privacy', icon: <Lock size={14} className="text-purple-400" /> },
          { label: 'Appeal Decision', cat: 'Account Recovery', icon: <Scale size={14} className="text-blue-400" /> },
          { label: 'Help / FAQ', tab: 'faq', icon: <HelpCircle size={14} className="text-emerald-400" /> }
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (item.cat) handleQuickOption(item.cat);
              else if (item.tab) setActiveTab(item.tab as SupportTab);
            }}
            className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-cyan/40 hover:bg-white/[0.05] transition-all flex items-center gap-2.5 group text-left cursor-pointer"
          >
            <div className="p-2 rounded-xl bg-white/5 group-hover:scale-110 transition-transform">
              {item.icon}
            </div>
            <span className="text-[10px] font-bold text-white/80 group-hover:text-white uppercase tracking-wider leading-tight">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* TAB 1: REPORT A PROBLEM FORM */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {submittedReport ? (
            /* Success View */
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-8 md:p-12 rounded-3xl bg-white/[0.02] border border-aeirmist-cyan/30 text-center space-y-6 relative overflow-hidden"
            >
              <div className="w-16 h-16 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center mx-auto text-aeirmist-cyan">
                <CheckCircle size={36} />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-display font-bold text-white">Thank You!</h2>
                <p className="text-sm text-white/70 max-w-md mx-auto">
                  Your report has been submitted to the Aeirmist support operations team.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 max-w-xs mx-auto space-y-1 font-mono text-xs">
                <div className="text-white/40 uppercase tracking-widest text-[9px]">Reference Ticket ID</div>
                <div className="text-aeirmist-cyan font-bold text-base">{submittedReport.id}</div>
                <div className="text-white/60 text-[10px] uppercase pt-1">
                  Status: <strong className="text-amber-400">{submittedReport.status}</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('my_reports')}
                  className="px-6 py-3 rounded-xl bg-aeirmist-cyan text-black font-mono font-bold text-xs uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-aeirmist-cyan/20"
                >
                  View My Reports
                </button>
                <button
                  onClick={() => setSubmittedReport(null)}
                  className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Submit Another Report
                </button>
              </div>
            </motion.div>
          ) : (
            /* Report Form */
            <form onSubmit={handleSubmitReport} className="p-6 md:p-8 rounded-3xl bg-white/[0.02] border border-white/10 space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                  <Bug className="text-aeirmist-cyan" size={20} />
                  Report a Problem
                </h2>
                <p className="text-xs text-white/50">
                  Help us improve Aeirmist by describing the issue you experienced.
                </p>
              </div>

              {/* Category Dropdown (Custom, In-Frame) */}
              <div className="space-y-2 relative" ref={categoryDropdownRef}>
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-white/80 block">
                  Choose the area related to your issue *
                </label>
                
                <button
                  type="button"
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className={`w-full h-12 px-4 rounded-xl bg-white/[0.04] border ${
                    isCategoryOpen 
                      ? 'border-aeirmist-cyan bg-white/[0.08] ring-2 ring-aeirmist-cyan/20' 
                      : 'border-white/15 hover:border-white/30'
                  } text-xs text-white font-mono flex items-center justify-between transition-all cursor-pointer text-left`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-aeirmist-cyan shrink-0" />
                    <span className="font-bold text-white truncate">{category}</span>
                  </div>
                  <ChevronDown size={16} className={`text-white/50 transition-transform duration-200 shrink-0 ${isCategoryOpen ? 'rotate-180 text-aeirmist-cyan' : ''}`} />
                </button>

                <AnimatePresence>
                  {isCategoryOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-[#0c0f17] border border-white/20 shadow-2xl p-2 flex flex-col backdrop-blur-2xl"
                    >
                      {/* Search bar inside dropdown */}
                      <div className="p-1.5 pb-2 border-b border-white/10 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={13} />
                        <input
                          type="text"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          placeholder="Search categories..."
                          className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.05] border border-white/10 text-[11px] text-white font-mono placeholder:text-white/30 outline-none focus:border-aeirmist-cyan/60"
                          autoFocus
                        />
                      </div>

                      {/* Scrollable list bounded inside container */}
                      <div className="flex-1 overflow-y-auto p-1 space-y-1 scroll-container max-h-56">
                        {CATEGORIES.filter(cat => cat.toLowerCase().includes(categorySearch.toLowerCase())).map((cat) => {
                          const isSelected = category === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setCategory(cat);
                                setIsCategoryOpen(false);
                                setCategorySearch('');
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-mono text-left flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-aeirmist-cyan/20 text-aeirmist-cyan font-bold border border-aeirmist-cyan/30'
                                  : 'text-white/80 hover:bg-white/[0.08] hover:text-white'
                              }`}
                            >
                              <span>{cat}</span>
                              {isSelected && <Check size={14} className="text-aeirmist-cyan shrink-0" />}
                            </button>
                          );
                        })}
                        {CATEGORIES.filter(cat => cat.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                          <div className="p-4 text-center text-xs font-mono text-white/40">
                            No matching category
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Multiline Description Textbox */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-white/80">
                    Describe what happened *
                  </label>
                  <span className={`text-[10px] font-mono ${description.length > 1800 ? 'text-amber-400 font-bold' : 'text-white/40'}`}>
                    {description.length} / 2000
                  </span>
                </div>
                <textarea
                  rows={6}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened..."
                  className="w-full p-4 rounded-2xl bg-white/[0.04] border border-white/15 text-xs text-white placeholder:text-white/30 outline-none focus:border-aeirmist-cyan focus:bg-white/[0.08] transition-all font-sans leading-relaxed resize-none"
                />
              </div>

              {/* Attach Screenshots */}
              <div className="space-y-3">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-white/80 block">
                  Attach Screenshots (Optional, Max 5)
                </label>

                <div className="flex flex-wrap gap-3">
                  {filePreviews.map((img, idx) => (
                    <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-white/20 bg-black/40 group">
                      <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-red-500 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {filePreviews.length < 5 && (
                    <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 hover:border-aeirmist-cyan/60 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex flex-col items-center justify-center gap-1 cursor-pointer group">
                      <Upload size={18} className="text-white/40 group-hover:text-aeirmist-cyan transition-colors" />
                      <span className="text-[9px] font-mono text-white/40 group-hover:text-white uppercase font-bold">Add Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Diagnostics Checkbox */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDiagnostics}
                    onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                    className="mt-0.5 rounded bg-white/10 border-white/20 text-aeirmist-cyan focus:ring-aeirmist-cyan cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Include technical diagnostics</span>
                    <span className="text-[10px] text-white/40 block mt-0.5">
                      Attaches browser, OS version, screen dimensions, and network status to help our engineers solve the issue faster.
                    </span>
                  </div>
                </label>

                {includeDiagnostics && (
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-[9px] text-white/60 space-y-1">
                    <div className="text-aeirmist-cyan font-bold uppercase tracking-wider mb-1">Live Diagnostic Payload Preview:</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>• Device: {getDeviceInfo()?.device}</div>
                      <div>• OS: {getDeviceInfo()?.os}</div>
                      <div>• Browser: {getDeviceInfo()?.browser}</div>
                      <div>• Version: {getDeviceInfo()?.appVersion}</div>
                      <div>• Res: {getDeviceInfo()?.resolution}</div>
                      <div>• Network: {getDeviceInfo()?.networkType}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || !description.trim()}
                  className="px-8 py-3.5 rounded-xl bg-aeirmist-cyan text-black font-mono font-bold text-xs uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-aeirmist-cyan/20"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Send Report
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: MY REPORTS */}
      {activeTab === 'my_reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <FileText className="text-aeirmist-cyan" size={20} />
              My Support Reports
            </h2>
            <span className="text-xs font-mono text-white/40">
              Showing {myReports.length} reports
            </span>
          </div>

          {loadingReports ? (
            <div className="p-12 text-center text-white/40 font-mono text-xs flex flex-col items-center gap-2">
              <RefreshCw size={24} className="animate-spin text-aeirmist-cyan" />
              Loading your submitted tickets...
            </div>
          ) : myReports.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white/[0.02] border border-white/5 text-center space-y-3">
              <LifeBuoy size={40} className="mx-auto text-white/20" />
              <p className="text-sm font-bold text-white/60">No support reports filed yet.</p>
              <button
                onClick={() => setActiveTab('report')}
                className="px-4 py-2 rounded-xl bg-aeirmist-cyan text-black text-xs font-mono font-bold uppercase tracking-wider hover:bg-white transition-all"
              >
                Submit A Report
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myReports.map((report) => (
                <div key={report.id} className="p-5 md:p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-mono font-bold text-aeirmist-cyan">
                        {report.reportId || report.id}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-white/70 border border-white/10">
                        {report.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border ${
                        report.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                        report.status === 'In Review' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                        report.status === 'Need More Information' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                        'bg-white/10 text-white/60 border-white/20'
                      }`}>
                        {report.status}
                      </span>
                      <span className="text-[10px] font-mono text-white/40">
                        {report.createdAt ? formatAeirmistTimestamp(report.createdAt) : 'Recently'}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-white/90 leading-relaxed font-sans whitespace-pre-wrap">
                    {report.description}
                  </div>

                  {/* Attachments Preview */}
                  {report.attachments && report.attachments.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      {report.attachments.map((img: any, idx: number) => {
                        const src = typeof img === 'string' ? img : img?.url;
                        if (!src) return null;
                        return (
                          <div key={idx} className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-black">
                            <img src={src} alt="Attachment" className="w-full h-full object-cover" />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Admin Reply Box */}
                  {report.adminReply && (
                    <div className="p-4 rounded-2xl bg-aeirmist-cyan/[0.05] border border-aeirmist-cyan/30 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-aeirmist-cyan font-bold uppercase">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck size={14} /> Official Support Response
                        </span>
                        <span>{report.adminRepliedAt ? formatAeirmistTimestamp(report.adminRepliedAt) : 'Recently'}</span>
                      </div>
                      <p className="text-xs text-white leading-relaxed font-sans">
                        {report.adminReply}
                      </p>
                    </div>
                  )}

                  {/* Quick User Update if Info Needed */}
                  {report.status === 'Need More Information' && (
                    <div className="p-4 rounded-2xl bg-amber-500/[0.05] border border-amber-500/30 space-y-3">
                      <div className="text-xs font-mono font-bold text-amber-400 uppercase">
                        Aeirmist Support requested additional details:
                      </div>
                      <textarea
                        rows={2}
                        value={userReplyText[report.id] || ''}
                        onChange={(e) => setUserReplyText({ ...userReplyText, [report.id]: e.target.value })}
                        placeholder="Provide the requested details here..."
                        className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white outline-none focus:border-amber-400"
                      />
                      <button
                        onClick={() => handleSendUserReply(report.id)}
                        disabled={isSendingUserReply || !userReplyText[report.id]?.trim()}
                        className="px-4 py-2 rounded-xl bg-amber-400 text-black text-xs font-mono font-bold uppercase hover:bg-white transition-all disabled:opacity-40"
                      >
                        Send Additional Details
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONTACT SUPPORT */}
      {activeTab === 'contact' && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <Mail className="text-aeirmist-cyan" size={20} />
                Contact Customer Support
              </h2>
              <p className="text-xs text-white/50">
                Reach out directly to our global infrastructure support operations team.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Mail className="text-aeirmist-cyan" size={16} /> Official Email Support
                </div>
                <p className="text-xs font-mono text-aeirmist-cyan font-bold">support@aeirmist.network</p>
                <p className="text-[10px] text-white/40">Direct email dispatcher monitored 24/7/365.</p>
              </div>

              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="text-aeirmist-magenta" size={16} /> Response Times
                </div>
                <p className="text-xs text-white font-bold">Typically within 24–48 hours</p>
                <p className="text-[10px] text-white/40">We review every submission and will get back to you as soon as we can.</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-aeirmist-cyan/[0.03] border border-aeirmist-cyan/20 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Prefer submitting a ticket?</h3>
              <p className="text-xs text-white/60">
                Filing a problem report directly attaches your user metadata and diagnostic traces for instant troubleshooting.
              </p>
              <button
                onClick={() => setActiveTab('report')}
                className="px-5 py-2.5 rounded-xl bg-aeirmist-cyan text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-white transition-all shadow-md shadow-aeirmist-cyan/20"
              >
                Open Report Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HELP CENTER / FAQ */}
      {activeTab === 'faq' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <HelpCircle className="text-aeirmist-cyan" size={20} />
              Help Center & Knowledge Base
            </h2>
            <p className="text-xs text-white/50">
              Frequently asked questions, system guides, and self-service calibration steps.
            </p>
          </div>

          {/* Search FAQ */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="text"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="Search help topics..."
              className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-white font-mono placeholder:text-white/30 outline-none focus:border-aeirmist-cyan/50"
            />
          </div>

          {/* Accordion FAQ Items */}
          <div className="space-y-2.5">
            {FAQ_ITEMS.filter(item => 
              item.q.toLowerCase().includes(faqSearch.toLowerCase()) || 
              item.a.toLowerCase().includes(faqSearch.toLowerCase()) ||
              item.cat.toLowerCase().includes(faqSearch.toLowerCase())
            ).map((item, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div key={idx} className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden transition-all">
                  <button
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] font-mono uppercase text-aeirmist-cyan border border-white/10">
                        {item.cat}
                      </span>
                      <span className="text-xs font-bold text-white">{item.q}</span>
                    </div>
                    <ChevronDown size={16} className={`text-white/40 transition-transform ${isOpen ? 'rotate-180 text-aeirmist-cyan' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-0 text-xs text-white/70 leading-relaxed font-sans border-t border-white/5 bg-white/[0.01]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: TERMS & POLICIES */}
      {activeTab === 'terms' && (
        <div className="p-6 md:p-8 rounded-3xl bg-white/[0.02] border border-white/10 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <Shield className="text-aeirmist-cyan" size={20} />
              Terms of Service & Community Standards
            </h2>
            <p className="text-xs text-white/50">
              Review network guidelines, content safety rules, and platform policies.
            </p>
          </div>

          <div className="space-y-4 text-xs text-white/80 leading-relaxed font-sans">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <h3 className="font-mono font-bold text-white uppercase text-[11px] text-aeirmist-cyan">1. User Account Integrity</h3>
              <p className="text-white/60">
                Nodes are responsible for maintaining the confidentiality of their credentials and security keys. Impersonation of other individuals or official Aeirmist nodes is strictly forbidden.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <h3 className="font-mono font-bold text-white uppercase text-[11px] text-aeirmist-cyan">2. Content Safety & Moderation</h3>
              <p className="text-white/60">
                Harassment, hate speech, unauthorized commercial distribution, and illegal activity are prohibited across all public feeds, marketplaces, and messaging streams.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <h3 className="font-mono font-bold text-white uppercase text-[11px] text-aeirmist-cyan">3. Data Security & Storage</h3>
              <p className="text-white/60">
                Aeirmist enforces cryptographic standards for stored user media and communication streams. You retain full ownership of your published content.
              </p>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  );
};

export default SupportSettings;
