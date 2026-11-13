import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, Check, X, Clock, AlertCircle, Users, ExternalLink, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../../services/api/client';
import { getAvatarUrl, resolveAvatarSrc } from '../../lib/avatar';

interface BondsRequestsViewProps {
  onOpenConversation?: (conversationId: string) => void;
  onClose?: () => void;
}

export const BondsRequestsView: React.FC<BondsRequestsViewProps> = ({
  onOpenConversation,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'approved' | 'rejected'>('received');
  const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [recRes, sentRes] = await Promise.all([
        api.bonds.getReceivedRequests().catch(() => ({ requests: [] })),
        api.bonds.getSentRequests().catch(() => ({ requests: [] })),
      ]);
      setReceivedRequests(recRes.requests || []);
      setSentRequests(sentRes.requests || []);
    } catch (err) {
      console.error('[Fetch Requests Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (requestId: string) => {
    try {
      setActionInProgress(requestId);
      const res = await api.bonds.approveRequest(requestId);
      // Update local state
      setReceivedRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'approved' } : r));
      if (res?.result?.conversationId && onOpenConversation) {
        // Optionally provide shortcut to open conversation
      }
    } catch (err) {
      console.error('[Approve Error]', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setActionInProgress(requestId);
      await api.bonds.rejectRequest(requestId);
      setReceivedRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r));
    } catch (err) {
      console.error('[Reject Error]', err);
    } finally {
      setActionInProgress(null);
    }
  };

  // Filter lists based on tab
  const displayedRequests = activeTab === 'received'
    ? receivedRequests.filter(r => r.status === 'pending')
    : activeTab === 'sent'
    ? sentRequests
    : activeTab === 'approved'
    ? receivedRequests.filter(r => r.status === 'approved')
    : receivedRequests.filter(r => r.status === 'rejected');

  return (
    <div className="flex flex-col h-full bg-[#06080c] text-neutral-200">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#0b0e14]/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Bonds Membership Requests</h3>
            <p className="text-[11px] text-neutral-400">Manage access and review candidate requests</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-white/10 bg-[#06080c]/60">
        {[
          { id: 'received', label: 'Received (Pending)', count: receivedRequests.filter(r => r.status === 'pending').length },
          { id: 'sent', label: 'Sent', count: sentRequests.length },
          { id: 'approved', label: 'Approved', count: receivedRequests.filter(r => r.status === 'approved').length },
          { id: 'rejected', label: 'Rejected', count: receivedRequests.filter(r => r.status === 'rejected').length },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === t.id
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>{t.label}</span>
            {t.count > 0 && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                activeTab === t.id ? 'bg-cyan-500 text-black' : 'bg-white/10 text-neutral-300'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span>Loading requests...</span>
          </div>
        ) : displayedRequests.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-500">
            No {activeTab} requests found.
          </div>
        ) : (
          displayedRequests.map((req) => (
            <div
              key={req.id}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold shrink-0 overflow-hidden">
                  {req.user?.avatarKey || req.user?.photoURL ? (
                    <img src={getAvatarUrl(resolveAvatarSrc(req.user.avatarKey || req.user.photoURL))} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{(req.user?.displayName || req.entity?.name || 'U').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-xs">{req.user?.displayName || 'User'}</span>
                    <span className="text-[11px] text-neutral-400">@{req.user?.username || 'member'}</span>
                    <span className="text-[10px] text-neutral-500">•</span>
                    <span className="text-[10px] text-cyan-400 font-medium capitalize">
                      for {req.entity?.name} ({req.entity?.type})
                    </span>
                  </div>

                  {req.introduction && (
                    <p className="text-xs text-neutral-300 mt-1 italic">
                      "{req.introduction}"
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2 text-[10px] text-neutral-500">
                    <Clock className="w-3 h-3" />
                    <span>Requested {new Date(req.createdAt).toLocaleDateString()}</span>
                    <span className={`px-2 py-0.5 rounded uppercase font-bold text-[9px] ${
                      req.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
                      req.status === 'rejected' ? 'bg-red-500/15 text-red-400' :
                      'bg-amber-500/15 text-amber-400'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Pending Received Requests */}
              {activeTab === 'received' && req.status === 'pending' && (
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={actionInProgress === req.id}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-neutral-300 text-xs font-medium transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={actionInProgress === req.id}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    {actionInProgress === req.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    <span>Approve</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
