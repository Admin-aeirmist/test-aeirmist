import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, AlertTriangle, ShieldAlert, CheckCircle, Search, Filter, ShieldBan, X, ChevronRight, UserX, Trash2, Mail } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


export const ReportsManagementTab = ({ db, addToast }: { db: any; addToast: any }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'critical'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const handleSendReply = async () => {
    if (!db || !selectedReport || !replyMessage.trim() || isSendingReply) return;
    setIsSendingReply(true);
    try {
      const targetUserId = selectedReport.reporterUid || selectedReport.reporterId || selectedReport.creatorId;
      
      // 1. Update report in Firestore with admin reply
      const reportRef = doc(db, 'reports', selectedReport.id);
      await updateDoc(reportRef, {
        adminReply: replyMessage.trim(),
        repliedAt: serverTimestamp(),
        status: 'resolved',
        updatedAt: serverTimestamp()
      });

      // 2. Deliver notification to user
      if (targetUserId && targetUserId !== 'guest' && targetUserId !== 'anonymous') {
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          recipientId: targetUserId,
          userId: targetUserId,
          fromUserId: 'aeirmist_system',
          fromUserUid: 'aeirmist_system',
          type: 'system',
          title: `Admin Response: Report #${selectedReport.reportId || selectedReport.id.slice(0, 6)}`,
          message: replyMessage.trim(),
          reportId: selectedReport.reportId || selectedReport.id,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      addToast({
        title: 'Reply Sent',
        message: 'Notification reply successfully delivered to the user.',
        type: 'success'
      });

      setSelectedReport((prev: any) => prev ? { ...prev, adminReply: replyMessage.trim(), status: 'resolved' } : null);
      setReplyMessage('');
    } catch (err: any) {
      logger.error('Error sending reply to report:', err);
      addToast({
        title: 'Reply Error',
        message: err?.message || 'Failed to send reply notification.',
        type: 'warning'
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      logger.warn("Reports list error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  const filteredReports = reports.filter(r => {
    const matchesFilter = filter === 'pending' ? r.status === 'pending' 
                        : filter === 'resolved' ? r.status === 'resolved' 
                        : r.priority === 'critical';
    
    const matchesSearch = searchQuery === '' || 
                          r.reportId?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.reportedUid?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.reporterUsername?.toLowerCase().includes(searchQuery.toLowerCase());
                          
    return matchesFilter && matchesSearch;
  });

  const handleAction = async (action: string) => {
    if (!db || !selectedReport || actionLoading) return;
    setActionLoading(true);

    const targetReportedUid = selectedReport.reportedUid || selectedReport.reportedUserId || selectedReport.creatorId;

    try {
      const reportRef = doc(db, 'reports', selectedReport.id);
      
      // Update report status
      await updateDoc(reportRef, { 
        status: action === 'dismiss' ? 'dismissed' : 'resolved',
        updatedAt: serverTimestamp(),
        reviewedAt: serverTimestamp(),
        adminAction: action
      });

      // Handle specific actions
      if (action === 'warn' && targetReportedUid) {
        const warningRef = doc(collection(db, 'users', targetReportedUid, 'warnings'));
        await setDoc(warningRef, {
          reason: selectedReport.reason,
          reportId: selectedReport.reportId || selectedReport.id,
          createdAt: serverTimestamp()
        });
        addToast({ title: 'User Warned', message: 'Warning has been issued to the user.', type: 'success' });
      } else if (action === 'remove_content') {
        addToast({ title: 'Content Removed', message: 'The reported content has been removed.', type: 'success' });
      } else if (action === 'suspend' && targetReportedUid) {
        await updateDoc(doc(db, 'users', targetReportedUid), {
          suspended: true,
          suspendedReason: selectedReport.reason,
          suspendedAt: serverTimestamp()
        });
        addToast({ title: 'User Suspended', message: 'Account access has been suspended.', type: 'success' });
      } else if (action === 'ban' && targetReportedUid) {
        await updateDoc(doc(db, 'users', targetReportedUid), {
          banned: true,
          bannedReason: selectedReport.reason,
          bannedAt: serverTimestamp()
        });
        addToast({ title: 'User Banned', message: 'User has been permanently banned.', type: 'success' });
      } else if (action === 'dismiss') {
        addToast({ title: 'Report Dismissed', message: 'The report has been marked as dismissed with no action.', type: 'info' });
      }

      // Log moderation action
      await setDoc(doc(collection(db, 'moderationLogs')), {
        reportId: selectedReport.reportId || selectedReport.id,
        action,
        targetId: selectedReport.targetId,
        targetType: selectedReport.targetType,
        reportedUid: targetReportedUid || 'unknown',
        createdAt: serverTimestamp()
      });

      setSelectedReport(null);
    } catch (err) {
      logger.error('Error executing moderation action:', err);
      addToast({ title: 'Error', message: 'Failed to complete moderation action.', type: 'warning' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><RefreshCw className="animate-spin text-aeirmist-cyan" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-widest text-white">Reports & Moderation</h2>
          <p className="text-[10px] font-mono text-white/40">Critical queue for flagged content and community violations.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input 
              type="text" 
              placeholder="Search reports..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:border-aeirmist-cyan outline-none w-full md:w-64"
            />
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            {(['pending', 'resolved', 'critical'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  filter === f 
                    ? f === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-aeirmist-cyan/20 text-aeirmist-cyan' 
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredReports.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-xs font-mono border border-white/5 rounded-3xl bg-white/[0.01]">No reports found.</div>
          ) : (
            filteredReports.map((r) => (
              <button 
                key={r.id} 
                onClick={() => setSelectedReport(r)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  selectedReport?.id === r.id 
                    ? 'border-aeirmist-cyan bg-aeirmist-cyan/5' 
                    : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white uppercase">{r.reportId}</span>
                    {r.priority === 'critical' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                  </div>
                  <span className="text-[9px] font-mono text-white/40">{r.createdAt?.toDate ? new Date(r.createdAt.toDate()).toLocaleDateString() : 'New'}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${
                    r.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                    r.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    r.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-white/10 text-white/60'
                  }`}>
                    {r.reason || 'Report'}
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest bg-blue-500/20 text-blue-400">
                    {r.targetType}
                  </span>
                </div>
                <p className="text-[10px] text-white/60 font-mono truncate">By: @{r.reporterUsername || 'user'}</p>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedReport ? (
            <div className="glass-panel rounded-3xl border-white/10 bg-[#0a0a0a] overflow-hidden flex flex-col h-full max-h-[600px]">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Report Details</h3>
                  <p className="text-[10px] font-mono text-white/40">{selectedReport.reportId}</p>
                </div>
                <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                  selectedReport.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {selectedReport.status}
                </span>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Reporter</span>
                    <span className="text-sm text-white block">@{selectedReport.reporterUsername || 'Unknown'}</span>
                    <span className="text-[9px] font-mono text-white/30 truncate block mt-1">{selectedReport.reporterUid || selectedReport.reporterId || 'Unknown'}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-400/60 block mb-1">Reported User</span>
                    <span className="text-sm text-white block">User ID</span>
                    <span className="text-[9px] font-mono text-white/30 truncate block mt-1">{selectedReport.reportedUid || selectedReport.reportedUserId || selectedReport.creatorId || 'N/A'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Target Details</span>
                    <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">{selectedReport.targetType}</span>
                  </div>
                  <span className="text-[10px] font-mono text-white block">Target ID: {selectedReport.targetId}</span>
                  {selectedReport.reason && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">Report Reason</span>
                      <span className="text-sm text-red-400 font-bold">{selectedReport.reason}</span>
                    </div>
                  )}
                  {selectedReport.description && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-1">User Description</span>
                      <p className="text-xs text-white/80 leading-relaxed">{selectedReport.description}</p>
                    </div>
                  )}
                </div>

                {/* Admin Reply & Resolution Section */}
                <div className="p-4 rounded-xl bg-aeirmist-cyan/[0.03] border border-aeirmist-cyan/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-aeirmist-cyan flex items-center gap-1.5">
                      <Mail size={13} /> Reply to User via Notification
                    </span>
                    {selectedReport.adminReply && (
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        Replied
                      </span>
                    )}
                  </div>

                  {selectedReport.adminReply && (
                    <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-white/80 space-y-1">
                      <span className="text-[9px] font-mono text-white/40 block">Last Sent Reply:</span>
                      <p>{selectedReport.adminReply}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Write reply message to user (this will be delivered to their Notification Alerts)..."
                      rows={3}
                      className="w-full p-3 rounded-xl bg-black/50 border border-white/10 focus:border-aeirmist-cyan text-xs text-white placeholder:text-white/30 outline-none resize-none transition-colors"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSendReply}
                        disabled={isSendingReply || !replyMessage.trim()}
                        className="px-4 py-2 rounded-xl bg-aeirmist-cyan hover:brightness-110 active:scale-95 text-black font-black uppercase text-[10px] tracking-wider transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,242,255,0.2)]"
                      >
                        <Mail size={12} />
                        <span>{isSendingReply ? 'Sending...' : 'Send Reply & Notify'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {selectedReport.attachments && selectedReport.attachments.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-2">Attachments</span>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedReport.attachments.map((att: any, i: number) => {
                        const url = typeof att === 'string' ? att : att?.url;
                        if (!url) return null;
                        return (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden border border-white/10 hover:border-aeirmist-cyan transition-colors">
                            <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {selectedReport.status === 'pending' && (
                <div className="p-4 border-t border-white/10 bg-white/[0.02] grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button onClick={() => handleAction('dismiss')} disabled={actionLoading} className="py-2.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all col-span-2 md:col-span-1">
                    Dismiss
                  </button>
                  <button onClick={() => handleAction('warn')} disabled={actionLoading} className="py-2.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5">
                    <Mail size={12} /> Warn
                  </button>
                  <button onClick={() => handleAction('remove_content')} disabled={actionLoading} className="py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5">
                    <Trash2 size={12} /> Remove
                  </button>
                  <button onClick={() => handleAction('suspend')} disabled={actionLoading} className="py-2.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5">
                    <UserX size={12} /> Suspend
                  </button>
                  <button onClick={() => handleAction('ban')} disabled={actionLoading} className="py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-[10px] font-black uppercase tracking-wider transition-all col-span-2 md:col-span-4 flex items-center justify-center gap-1.5 mt-2">
                    <ShieldBan size={12} /> Permanent Ban User
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-white/40 border border-white/5 rounded-3xl bg-white/[0.01] p-12">
              <ShieldAlert size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-bold uppercase tracking-widest mb-1">Select a Report</p>
              <p className="text-xs font-mono">Choose a report from the list to review details and take action.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
