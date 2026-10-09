import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LifeBuoy, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare, 
  Send, 
  Trash2, 
  Eye, 
  RefreshCw, 
  User, 
  Smartphone, 
  Globe, 
  ShieldCheck, 
  Check, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Sparkles, 
  Tag, 
  AlertTriangle,
  MoreVertical,
  ArrowRight,
  Monitor,
  Wifi,
  ExternalLink,
  Info
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp, 
  where,
  getDoc
} from 'firebase/firestore';
import { formatAeirmistTimestamp } from '../../lib/date';
import { logger } from '@/src/utils/logger';


interface SupportInboxProps {
  db: any;
  addToast: (toast: { title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }) => void;
}

export const SupportInboxTab: React.FC<SupportInboxProps> = ({ db, addToast }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'All' | 'Pending' | 'In Review' | 'Need More Information' | 'Resolved' | 'Closed'>('All');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Realtime subscription to supportReports
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'supportReports'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(items);
      setLoading(false);
      // Keep selected report updated if open
      if (selectedReport) {
        const updated = items.find(item => item.id === selectedReport.id);
        if (updated) setSelectedReport(updated);
      }
    }, (err) => {
      logger.warn("Support reports listener error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  // Mark as read by admin when selected
  const handleSelectReport = async (report: any) => {
    setSelectedReport(report);
    if (report.unreadByAdmin) {
      try {
        await updateDoc(doc(db, 'supportReports', report.id), { unreadByAdmin: false });
      } catch (err) {
        logger.error("Error marking report read:", err);
      }
    }
  };

  // Actions
  const handleUpdateStatus = async (reportId: string, status: string) => {
    try {
      const updateData: any = { 
        status, 
        updatedAt: serverTimestamp() 
      };
      if (status === 'Closed' || status === 'Resolved') {
        updateData.closedAt = serverTimestamp();
      }
      await updateDoc(doc(db, 'supportReports', reportId), updateData);
      
      addToast({
        title: 'Status Updated',
        message: `Report marked as ${status}`,
        type: 'success'
      });
    } catch (err) {
      logger.error(err);
      addToast({
        title: 'Error',
        message: 'Could not update status',
        type: 'error'
      });
    }
  };

  const handleUpdatePriority = async (reportId: string, priority: string) => {
    try {
      await updateDoc(doc(db, 'supportReports', reportId), { priority, updatedAt: serverTimestamp() });
      addToast({
        title: 'Priority Updated',
        message: `Set to ${priority}`,
        type: 'success'
      });
    } catch (err) {
      logger.error(err);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedReport) return;
    setIsSendingReply(true);

    try {
      const reportRef = doc(db, 'supportReports', selectedReport.id);
      
      // Update report with reply and state
      await updateDoc(reportRef, {
        adminReply: replyText.trim(),
        adminRepliedAt: serverTimestamp(),
        status: selectedReport.status === 'Pending' ? 'In Review' : selectedReport.status,
        unreadByUser: true,
        unreadByAdmin: false,
        updatedAt: serverTimestamp()
      });

      // Send a notification to the target user
      const targetUserUid = selectedReport.userUid || selectedReport.userId;
      if (targetUserUid) {
        await addDoc(collection(db, 'notifications'), {
          userId: targetUserUid,
          type: 'support_reply',
          title: 'Support Report Update',
          message: `Aeirmist Support replied to your report (${selectedReport.reportId || selectedReport.id}).`,
          data: {
            reportId: selectedReport.reportId || selectedReport.id,
            replySnippet: replyText.trim().substring(0, 100)
          },
          read: false,
          createdAt: serverTimestamp()
        });
      }

      addToast({
        title: 'Reply Sent',
        message: 'Admin response sent and user notified.',
        type: 'success'
      });

      setReplyText('');
    } catch (err) {
      logger.error(err);
      addToast({
        title: 'Error',
        message: 'Failed to send reply',
        type: 'error'
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (window.confirm("Permanently delete this support report? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'supportReports', reportId));
        addToast({
          title: 'Report Deleted',
          message: 'Support report removed from system.',
          type: 'success'
        });
        if (selectedReport?.id === reportId) {
          setSelectedReport(null);
        }
      } catch (err) {
        logger.error(err);
      }
    }
  };

  // Metrics calculation
  const totalCount = reports.length;
  const pendingCount = reports.filter(r => r.status === 'Pending').length;
  const inReviewCount = reports.filter(r => r.status === 'In Review' || r.status === 'Need More Information').length;
  const resolvedCount = reports.filter(r => r.status === 'Resolved').length;
  const unreadCount = reports.filter(r => r.unreadByAdmin === true).length;

  // Filtering
  const filteredReports = reports.filter(r => {
    // Tab filter
    if (activeSubTab === 'Pending' && r.status !== 'Pending') return false;
    if (activeSubTab === 'In Review' && r.status !== 'In Review') return false;
    if (activeSubTab === 'Need More Information' && r.status !== 'Need More Information') return false;
    if (activeSubTab === 'Resolved' && r.status !== 'Resolved') return false;
    if (activeSubTab === 'Closed' && r.status !== 'Closed') return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchId = (r.reportId || r.id || '').toLowerCase().includes(q);
      const matchUser = (r.username || '').toLowerCase().includes(q);
      const matchEmail = (r.email || '').toLowerCase().includes(q);
      const matchCat = (r.category || '').toLowerCase().includes(q);
      const matchDesc = (r.description || '').toLowerCase().includes(q);
      if (!matchId && !matchUser && !matchEmail && !matchCat && !matchDesc) return false;
    }

    // Category filter
    if (categoryFilter !== 'All' && r.category !== categoryFilter) return false;

    // Priority filter
    if (priorityFilter !== 'All' && r.priority !== priorityFilter) return false;

    return true;
  }).sort((a, b) => {
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  const categories = Array.from(new Set(reports.map(r => r.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      
      {/* Header & Dashboard Cards */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2.5">
              <LifeBuoy className="text-aeirmist-cyan" size={24} />
              Support Inbox
            </h2>
            <p className="text-xs text-white/40 mt-1 uppercase tracking-wider font-mono">
              Enterprise customer problem reports, issue diagnostics & resolution pipeline
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-aeirmist-cyan animate-pulse" />
              Live Telemetry Queue
            </span>
          </div>
        </div>

        {/* Dashboard Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="text-[9px] font-mono uppercase tracking-widest text-white/40">Total Reports</div>
            <div className="text-xl font-black font-mono text-white">{totalCount}</div>
            <div className="text-[9px] font-mono text-white/30">All submissions</div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/[0.03] border border-amber-500/20 space-y-1">
            <div className="text-[9px] font-mono uppercase tracking-widest text-amber-400/80">Pending</div>
            <div className="text-xl font-black font-mono text-amber-400">{pendingCount}</div>
            <div className="text-[9px] font-mono text-amber-400/50">Needs initial triage</div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-500/[0.03] border border-blue-500/20 space-y-1">
            <div className="text-[9px] font-mono uppercase tracking-widest text-blue-400/80">In Review</div>
            <div className="text-xl font-black font-mono text-blue-400">{inReviewCount}</div>
            <div className="text-[9px] font-mono text-blue-400/50">Active intervention</div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/20 space-y-1">
            <div className="text-[9px] font-mono uppercase tracking-widest text-emerald-400/80">Resolved</div>
            <div className="text-xl font-black font-mono text-emerald-400">{resolvedCount}</div>
            <div className="text-[9px] font-mono text-emerald-400/50">Closed successfully</div>
          </div>

          <div className="p-4 rounded-2xl bg-aeirmist-cyan/[0.03] border border-aeirmist-cyan/20 space-y-1 col-span-2 sm:col-span-1">
            <div className="text-[9px] font-mono uppercase tracking-widest text-aeirmist-cyan">Unread Queue</div>
            <div className="text-xl font-black font-mono text-aeirmist-cyan">{unreadCount}</div>
            <div className="text-[9px] font-mono text-aeirmist-cyan/50">Avg Response: ~1h 45m</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-2xl bg-white/[0.02] border border-white/5">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'All', label: 'All', count: totalCount },
            { id: 'Pending', label: 'Pending', count: pendingCount },
            { id: 'In Review', label: 'In Review', count: reports.filter(r => r.status === 'In Review').length },
            { id: 'Need More Information', label: 'Waiting for User', count: reports.filter(r => r.status === 'Need More Information').length },
            { id: 'Resolved', label: 'Resolved', count: resolvedCount },
            { id: 'Closed', label: 'Closed', count: reports.filter(r => r.status === 'Closed').length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeSubTab === tab.id
                  ? 'bg-aeirmist-cyan text-black shadow-md shadow-aeirmist-cyan/20 font-bold'
                  : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                activeSubTab === tab.id ? 'bg-black/20 text-black' : 'bg-white/10 text-white/60'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Filtering */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
            <input 
              type="text"
              placeholder="Search ID, user, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-xl bg-white/[0.03] border border-white/10 text-white text-[11px] font-mono outline-none focus:border-aeirmist-cyan/50"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-[10px] font-mono outline-none focus:border-aeirmist-cyan/50 cursor-pointer"
          >
            <option value="All" className="bg-[#0a0c10] text-white">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat} className="bg-[#0a0c10] text-white">{cat}</option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-[10px] font-mono outline-none focus:border-aeirmist-cyan/50 cursor-pointer"
          >
            <option value="All" className="bg-[#0a0c10] text-white">All Priorities</option>
            <option value="Low" className="bg-[#0a0c10] text-white">Low</option>
            <option value="Medium" className="bg-[#0a0c10] text-white">Medium</option>
            <option value="High" className="bg-[#0a0c10] text-white">High</option>
            <option value="Urgent" className="bg-[#0a0c10] text-white">Urgent</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Report Table List & Selected Report View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
        
        {/* Table / List View */}
        <div className={`lg:col-span-6 xl:col-span-5 bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden flex flex-col ${selectedReport ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/60">
              Reports ({filteredReports.length})
            </span>
            <button 
              onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
              className="text-[10px] font-mono text-aeirmist-cyan hover:underline flex items-center gap-1"
            >
              <Clock size={12} /> {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scroll-container">
            {loading ? (
              <div className="p-12 text-center text-white/40 font-mono text-xs flex flex-col items-center gap-2">
                <RefreshCw size={20} className="animate-spin text-aeirmist-cyan" />
                Loading support tickets...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-12 text-center text-white/30 font-mono text-xs space-y-2">
                <LifeBuoy size={32} className="mx-auto text-white/20" />
                <p>No matching support reports found.</p>
              </div>
            ) : (
              filteredReports.map(report => {
                const isSelected = selectedReport?.id === report.id;
                const isUnread = report.unreadByAdmin;

                return (
                  <button
                    key={report.id}
                    onClick={() => handleSelectReport(report)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all relative group cursor-pointer ${
                      isSelected
                        ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/40 shadow-lg shadow-aeirmist-cyan/5'
                        : isUnread
                        ? 'bg-white/[0.05] border-white/15'
                        : 'bg-white/[0.015] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                    }`}
                  >
                    {isUnread && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-aeirmist-cyan animate-ping" />
                    )}

                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-aeirmist-cyan">
                          {report.reportId || report.id.substring(0, 10)}
                        </span>
                        <span className="text-[9px] font-mono text-white/30">•</span>
                        <span className="text-[10px] font-mono font-bold text-white/80 truncate max-w-[120px]">
                          {report.category || 'General'}
                        </span>
                      </div>

                      <StatusBadge status={report.status || 'Pending'} />
                    </div>

                    <div className="text-xs text-white font-medium line-clamp-2 mb-2 leading-snug">
                      {report.description}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-white/40 pt-1 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-white/30" />
                        <span className="text-white/70 font-semibold">{report.username || 'User'}</span>
                        {report.isVerified && (
                          <ShieldCheck className="text-aeirmist-cyan shrink-0" size={12} />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={report.priority || 'Medium'} />
                        <span>{report.createdAt ? formatAeirmistTimestamp(report.createdAt) : 'Recently'}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail & Response Workspace View */}
        <div className={`lg:col-span-6 xl:col-span-7 bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden flex flex-col relative ${!selectedReport ? 'hidden lg:flex' : 'flex'}`}>
          {selectedReport ? (
            <div className="h-full flex flex-col overflow-y-auto scroll-container">
              
              {/* Detail Header Bar */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01] sticky top-0 backdrop-blur-xl z-20">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedReport(null)}
                    className="lg:hidden p-2 rounded-xl bg-white/5 text-white/60 hover:text-white"
                  >
                    ← Back
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        Report {selectedReport.reportId || selectedReport.id}
                      </h3>
                      <StatusBadge status={selectedReport.status || 'Pending'} />
                      <PriorityBadge priority={selectedReport.priority || 'Medium'} />
                    </div>
                    <p className="text-[10px] font-mono text-white/40 mt-0.5">
                      Submitted {selectedReport.createdAt ? formatAeirmistTimestamp(selectedReport.createdAt) : 'Just now'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteReport(selectedReport.id)}
                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all text-xs font-mono"
                    title="Delete Report"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Main Detail Body */}
              <div className="p-6 space-y-6 flex-1">
                
                {/* User Profile Info Card */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan font-bold font-mono">
                      {selectedReport.username ? selectedReport.username[0].toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">{selectedReport.username || 'Anonymous User'}</span>
                        <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />
                      </div>
                      <p className="text-[10px] font-mono text-white/40">
                        {selectedReport.email || 'No email associated'} • UID: <span className="text-white/60">{selectedReport.userUid || selectedReport.userId || 'N/A'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-white/5 text-white/60 border border-white/10 uppercase">
                      Category: <strong className="text-white">{selectedReport.category || 'General'}</strong>
                    </span>
                  </div>
                </div>

                {/* Report Description Section */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-white/40">Description & Context</h4>
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-white/90 leading-relaxed font-sans whitespace-pre-wrap selection:bg-aeirmist-cyan selection:text-black">
                    {selectedReport.description}
                  </div>
                </div>

                {/* Attachments Section */}
                {selectedReport.attachments && selectedReport.attachments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                      Uploaded Screenshots ({selectedReport.attachments.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selectedReport.attachments.map((img: any, idx: number) => {
                        const src = typeof img === 'string' ? img : img?.url;
                        if (!src) return null;
                        return (
                          <div 
                            key={idx} 
                            onClick={() => setPreviewImage(src)}
                            className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/40 group cursor-pointer"
                          >
                            <img src={src} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-mono uppercase tracking-widest">
                              <Eye size={16} className="mr-1" /> Expand
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Diagnostics / Device Info Section */}
                {selectedReport.deviceInfo ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Monitor size={14} className="text-aeirmist-cyan" />
                      <h4 className="text-[10px] font-mono uppercase tracking-widest text-aeirmist-cyan font-bold">
                        User Diagnostics (Consented Telemetry)
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-4 rounded-2xl bg-black/40 border border-white/10 font-mono text-[10px]">
                      <div>
                        <span className="text-white/40 block">Device / OS</span>
                        <span className="text-white font-semibold">{selectedReport.deviceInfo.device || 'Desktop'} ({selectedReport.deviceInfo.os || 'Linux'})</span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Browser</span>
                        <span className="text-white font-semibold">{selectedReport.deviceInfo.browser || 'Chrome'}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block">App Version</span>
                        <span className="text-aeirmist-cyan font-bold">{selectedReport.deviceInfo.appVersion || 'v2.4.0'}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Screen Resolution</span>
                        <span className="text-white font-semibold">{selectedReport.deviceInfo.resolution || '1920x1080'}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Network</span>
                        <span className="text-emerald-400 font-semibold">{selectedReport.deviceInfo.networkType || 'Online'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white/[0.01] border border-white/5 text-[10px] font-mono text-white/30 flex items-center gap-2">
                    <Info size={14} /> Diagnostic telemetry was opted-out by the reporter.
                  </div>
                )}

                {/* Status Triage Controls */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-white/50">Triage & Status Actions</h4>
                  
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedReport.id, 'In Review')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all border ${
                        selectedReport.status === 'In Review'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
                      }`}
                    >
                      Mark In Review
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(selectedReport.id, 'Need More Information')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all border ${
                        selectedReport.status === 'Need More Information'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
                      }`}
                    >
                      Request More Information
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(selectedReport.id, 'Resolved')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all border ${
                        selectedReport.status === 'Resolved'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
                      }`}
                    >
                      Resolve Issue
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(selectedReport.id, 'Closed')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider transition-all border ${
                        selectedReport.status === 'Closed'
                          ? 'bg-neutral-500/20 text-neutral-400 border-neutral-500/40'
                          : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
                      }`}
                    >
                      Close Ticket
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-[10px] font-mono text-white/40 uppercase">Set Priority:</span>
                    {['Low', 'Medium', 'High', 'Urgent'].map(p => (
                      <button
                        key={p}
                        onClick={() => handleUpdatePriority(selectedReport.id, p)}
                        className={`px-2.5 py-0.5 rounded-lg text-[9px] font-mono uppercase transition-all ${
                          selectedReport.priority === p ? 'bg-aeirmist-cyan text-black font-bold' : 'bg-white/5 text-white/40 hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Existing Admin Reply View */}
                {selectedReport.adminReply && (
                  <div className="p-5 rounded-2xl bg-aeirmist-cyan/[0.04] border border-aeirmist-cyan/20 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-aeirmist-cyan font-bold uppercase">
                      <span>Aeirmist Support Official Response</span>
                      <span>{selectedReport.adminRepliedAt ? formatAeirmistTimestamp(selectedReport.adminRepliedAt) : 'Recently'}</span>
                    </div>
                    <p className="text-xs text-white/90 leading-relaxed font-sans whitespace-pre-wrap">
                      {selectedReport.adminReply}
                    </p>
                  </div>
                )}

                {/* Admin Response Composer */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-white/60 flex items-center gap-2">
                    <MessageSquare size={14} className="text-aeirmist-cyan" />
                    Write Response to User
                  </h4>

                  <textarea
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Provide an explanation, workaround, or solution to the user..."
                    className="w-full p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder:text-white/30 outline-none focus:border-aeirmist-cyan/50 font-sans resize-none"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] font-mono text-white/30">
                      Sending a reply will update the report and notify the user instantly.
                    </p>
                    <button
                      onClick={handleSendReply}
                      disabled={isSendingReply || !replyText.trim()}
                      className="px-5 py-2.5 rounded-xl bg-aeirmist-cyan text-black font-mono font-bold text-xs uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-aeirmist-cyan/20"
                    >
                      {isSendingReply ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> Sending...
                        </>
                      ) : (
                        <>
                          <Send size={14} /> Send Reply
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center text-white/20 font-mono space-y-3">
              <LifeBuoy size={48} className="opacity-40" />
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">Select a report from the list to view details and respond</p>
            </div>
          )}
        </div>

      </div>

      {/* Image Lightbox Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
              <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-white/20" />
              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 p-3 rounded-full bg-black/60 text-white border border-white/20 hover:bg-white hover:text-black transition-all"
              >
                <XCircle size={24} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

// Helper Badges
const StatusBadge = ({ status }: { status: string }) => {
  let color = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (status === 'In Review') color = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  if (status === 'Need More Information') color = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  if (status === 'Resolved') color = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (status === 'Closed') color = 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';

  return (
    <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${color}`}>
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  let color = 'bg-white/10 text-white/60';
  if (priority === 'Medium') color = 'bg-blue-500/10 text-blue-300';
  if (priority === 'High') color = 'bg-orange-500/20 text-orange-400';
  if (priority === 'Urgent') color = 'bg-red-500/20 text-red-400 font-black';

  return (
    <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded ${color}`}>
      {priority}
    </span>
  );
};

export default SupportInboxTab;
