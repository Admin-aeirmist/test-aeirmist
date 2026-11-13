import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Layers, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  MessageSquare, 
  Sliders, 
  Filter, 
  Calendar, 
  Key, 
  FileText, 
  Link as LinkIcon, 
  Eye, 
  Globe, 
  Lock, 
  AlertTriangle,
  UserCheck,
  UserX,
  X,
  Plus
} from 'lucide-react';
import { api } from '../../services/api/client';
import { useAppearance, ACCENT_COLOR_MAP } from '../../context/AppearanceContext';
import { resolveAvatarSrc } from '../../lib/avatar';

interface BondsManagementTabProps {
  db?: any;
  addToast?: (toast: { title: string; message?: string; type?: 'success' | 'error' | 'info' | 'warning' }) => void;
}

export const BondsManagementTab: React.FC<BondsManagementTabProps> = ({ addToast }) => {
  const { settings } = useAppearance();
  const accentColor = ACCENT_COLOR_MAP[settings.accentColor] || ACCENT_COLOR_MAP.blue;

  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalGroups: 0,
    totalCommunities: 0,
    totalTeams: 0,
    totalEntities: 0,
    totalPosts: 0,
    totalPendingPosts: 0,
    totalMemberships: 0,
  });

  // Filters
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'group' | 'community' | 'team'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedEntityForMembers, setSelectedEntityForMembers] = useState<any | null>(null);
  const [entityMembers, setEntityMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [selectedEntityForPosts, setSelectedEntityForPosts] = useState<any | null>(null);
  const [entityPosts, setEntityPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const [selectedEntityForApi, setSelectedEntityForApi] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    addToast?.({ title: 'Copied to Clipboard', message: text, type: 'success' });
    setTimeout(() => {
      setCopiedKey(prev => (prev === key ? null : prev));
    }, 2000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, entitiesRes] = await Promise.all([
        api.bonds.admin.getStats().catch(() => null),
        api.bonds.admin.getEntities({ type: activeTypeFilter, status: statusFilter }).catch(() => null),
      ]);

      if (statsRes) {
        setStats(statsRes);
      }
      if (entitiesRes && entitiesRes.entities) {
        setEntities(entitiesRes.entities);
      }
    } catch (err) {
      console.error('[Load Bonds Admin Error]', err);
      addToast?.({ title: 'Error', message: 'Failed to load bonds entities', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTypeFilter, statusFilter]);

  // Filtered entities locally by search query
  const filteredEntities = useMemo(() => {
    if (!searchQuery.trim()) return entities;
    const q = searchQuery.toLowerCase().trim();
    return entities.filter(e => 
      e.name?.toLowerCase().includes(q) ||
      e.slug?.toLowerCase().includes(q) ||
      e.entityNumber?.includes(q) ||
      e.category?.toLowerCase().includes(q) ||
      e.id?.toLowerCase().includes(q)
    );
  }, [entities, searchQuery]);

  // Actions
  const handleToggleStatus = async (entity: any) => {
    const nextStatus = entity.status === 'suspended' ? 'active' : 'suspended';
    try {
      await api.bonds.admin.updateStatus(entity.id, nextStatus as any);
      setEntities(prev => prev.map(e => e.id === entity.id ? { ...e, status: nextStatus } : e));
      addToast?.({
        title: nextStatus === 'active' ? 'Entity Activated' : 'Entity Suspended',
        message: `${entity.name} is now ${nextStatus}`,
        type: 'success',
      });
    } catch (err: any) {
      addToast?.({ title: 'Status Update Failed', message: err?.message || 'Server error', type: 'error' });
    }
  };

  const handleToggleVerify = async (entity: any) => {
    const nextVal = !entity.isVerified;
    try {
      await api.bonds.admin.toggleVerified(entity.id, nextVal);
      setEntities(prev => prev.map(e => e.id === entity.id ? { ...e, isVerified: nextVal } : e));
      addToast?.({
        title: nextVal ? 'Verified' : 'Unverified',
        message: `${entity.name} verification status updated`,
        type: 'success',
      });
    } catch (err: any) {
      addToast?.({ title: 'Verification Failed', message: err?.message || 'Server error', type: 'error' });
    }
  };

  const handleRegenerateUrl = async (entity: any) => {
    try {
      const res = await api.bonds.admin.regenerateUrl(entity.id);
      if (res.success) {
        setEntities(prev => prev.map(e => e.id === entity.id ? { 
          ...e, 
          slug: res.slug, 
          canonicalUrl: res.canonicalUrl, 
          entityNumber: res.entityNum,
          token: res.token 
        } : e));
        addToast?.({
          title: 'URL Regenerated',
          message: `New 11-digit canonical URL: ${res.canonicalUrl}`,
          type: 'success',
        });
      }
    } catch (err: any) {
      addToast?.({ title: 'URL Regeneration Failed', message: err?.message || 'Server error', type: 'error' });
    }
  };

  const handleDeleteEntity = async (entity: any) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${entity.name}" and all associated posts, members, and conversations? This action is irreversible.`)) {
      return;
    }
    try {
      await api.bonds.admin.deleteEntity(entity.id);
      setEntities(prev => prev.filter(e => e.id !== entity.id));
      addToast?.({ title: 'Deleted', message: `${entity.name} removed successfully`, type: 'success' });
      loadData();
    } catch (err: any) {
      addToast?.({ title: 'Delete Failed', message: err?.message || 'Server error', type: 'error' });
    }
  };

  // Open Members Modal
  const openMembersModal = async (entity: any) => {
    setSelectedEntityForMembers(entity);
    setLoadingMembers(true);
    try {
      const res = await api.bonds.admin.getMembers(entity.id);
      setEntityMembers(res.members || []);
    } catch (err) {
      addToast?.({ title: 'Error', message: 'Failed to load entity members', type: 'error' });
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!selectedEntityForMembers) return;
    try {
      await api.bonds.admin.updateMemberRole(selectedEntityForMembers.id, userId, newRole);
      setEntityMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m));
      addToast?.({ title: 'Role Updated', message: `Member assigned ${newRole} role`, type: 'success' });
    } catch (err: any) {
      addToast?.({ title: 'Role Update Failed', message: err?.message || 'Server error', type: 'error' });
    }
  };

  const handleRemoveMember = async (userId: string, displayName: string) => {
    if (!selectedEntityForMembers) return;
    if (!window.confirm(`Remove ${displayName} from this entity?`)) return;
    try {
      await api.bonds.admin.removeMember(selectedEntityForMembers.id, userId);
      setEntityMembers(prev => prev.filter(m => m.userId !== userId));
      setEntities(prev => prev.map(e => e.id === selectedEntityForMembers.id ? { ...e, memberCount: Math.max(1, e.memberCount - 1) } : e));
      addToast?.({ title: 'Member Removed', message: `${displayName} has been removed`, type: 'success' });
    } catch (err: any) {
      addToast?.({ title: 'Remove Failed', message: err?.message || 'Server error', type: 'error' });
    }
  };

  // Open Posts Modal
  const openPostsModal = async (entity: any) => {
    setSelectedEntityForPosts(entity);
    setLoadingPosts(true);
    try {
      const res = await api.bonds.admin.getEntityPosts(entity.id);
      setEntityPosts(res.posts || []);
    } catch (err) {
      addToast?.({ title: 'Error', message: 'Failed to load entity posts', type: 'error' });
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Delete this post permanently?')) return;
    try {
      await api.bonds.admin.deletePost(postId);
      setEntityPosts(prev => prev.filter(p => p.id !== postId));
      setEntities(prev => prev.map(e => e.id === selectedEntityForPosts?.id ? { ...e, postCount: Math.max(0, e.postCount - 1) } : e));
      addToast?.({ title: 'Post Deleted', message: 'Post removed from SQL', type: 'success' });
    } catch (err: any) {
      addToast?.({ title: 'Delete Failed', message: err?.message || 'Server error', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-white/50 text-[11px] font-mono uppercase tracking-wider">
            <span>Groups</span>
            <Users size={14} style={{ color: accentColor }} />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalGroups}</div>
          <div className="text-[10px] text-white/40">Shared interest groups</div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-white/50 text-[11px] font-mono uppercase tracking-wider">
            <span>Communities</span>
            <Globe size={14} style={{ color: accentColor }} />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalCommunities}</div>
          <div className="text-[10px] text-white/40">Guilds & public hubs</div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-white/50 text-[11px] font-mono uppercase tracking-wider">
            <span>Teams</span>
            <Layers size={14} style={{ color: accentColor }} />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalTeams}</div>
          <div className="text-[10px] text-white/40">Project & squad hubs</div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-white/50 text-[11px] font-mono uppercase tracking-wider">
            <span>Total Memberships</span>
            <UserCheck size={14} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalMemberships}</div>
          <div className="text-[10px] text-white/40">SQL active relations</div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-white/50 text-[11px] font-mono uppercase tracking-wider">
            <span>Total Posts</span>
            <MessageSquare size={14} style={{ color: accentColor }} />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalPosts}</div>
          <div className="text-[10px] text-white/40">Indexed publications</div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
        {/* Type tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Bonds' },
            { id: 'group', label: 'Groups' },
            { id: 'community', label: 'Communities' },
            { id: 'team', label: 'Teams' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTypeFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTypeFilter === tab.id
                  ? 'text-black shadow-md font-black'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
              style={activeTypeFilter === tab.id ? { backgroundColor: accentColor } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status filter & Search Bar */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 focus:outline-none focus:border-white/20"
          >
            <option value="all" className="bg-[#0b0e14]">All Statuses</option>
            <option value="active" className="bg-[#0b0e14]">Active</option>
            <option value="suspended" className="bg-[#0b0e14]">Suspended</option>
          </select>

          <div className="relative flex-1 md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, name, 11-digit #..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
          </div>

          <button
            onClick={loadData}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all shrink-0 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Entities Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0d14] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-white/80 border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-white/50">
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Canonical 11-Digit URL & ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Owner / Creator</th>
                <th className="py-3 px-4 text-center">Members</th>
                <th className="py-3 px-4 text-center">Posts</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-white/40 font-mono text-xs">
                    <RefreshCw className="animate-spin inline mr-2 text-white/60" size={16} />
                    Loading SQL entities...
                  </td>
                </tr>
              ) : filteredEntities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-white/40 font-mono text-xs">
                    No groups, communities, or teams found.
                  </td>
                </tr>
              ) : (
                filteredEntities.map((entity) => {
                  const typePlural = entity.type === 'community' ? 'communities' : `${entity.type}s`;
                  const fullUrl = `https://aeirmist.com${entity.canonicalUrl || `/bonds/${typePlural}/${entity.slug}`}`;
                  const createdDate = entity.createdAt ? new Date(entity.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }) : 'Unknown';

                  return (
                    <tr key={entity.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Entity Logo & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolveAvatarSrc(entity.logoUrl)}
                            alt={entity.name}
                            className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0 bg-white/5"
                          />
                          <div className="min-w-0 max-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs truncate">{entity.name}</span>
                              {entity.isVerified && (
                                <span title="Verified" className="shrink-0 flex items-center">
                                  <ShieldCheck size={12} className="text-sky-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-white/40 truncate">
                              {entity.category || 'General'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Canonical 11-digit URL & ID */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 max-w-[280px]">
                          {/* 11-digit canonical URL with Copy button */}
                          <div className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-black/40 border border-white/10 text-[10px] font-mono text-white/80">
                            <span className="truncate flex-1" title={fullUrl}>
                              {entity.canonicalUrl || `/bonds/${typePlural}/${entity.slug}`}
                            </span>
                            <button
                              onClick={() => handleCopy(fullUrl, `url-${entity.id}`)}
                              className="text-white/40 hover:text-white transition-colors cursor-pointer shrink-0"
                              title="Copy Full Canonical URL"
                            >
                              {copiedKey === `url-${entity.id}` ? (
                                <Check size={12} className="text-emerald-400" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                            <a
                              href={entity.canonicalUrl || `/bonds/${typePlural}/${entity.slug}`}
                              onClick={(e) => {
                                e.preventDefault();
                                window.dispatchEvent(new CustomEvent('aeirmist-navigate-bond', { detail: { type: entity.type, slug: entity.slug } }));
                              }}
                              className="text-white/40 hover:text-white transition-colors shrink-0"
                              title="Visit Entity"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>

                          {/* ID info */}
                          <div className="flex items-center gap-2 text-[9px] font-mono text-white/40">
                            <span>ID: {entity.id.slice(0, 8)}...</span>
                            <span>•</span>
                            <span className="text-white/60">Num: {entity.entityNumber || 'Auto'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          entity.type === 'group'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : entity.type === 'community'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}>
                          {entity.type}
                        </span>
                      </td>

                      {/* Owner / Creator */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <img
                            src={resolveAvatarSrc(entity.owner?.avatarKey)}
                            alt=""
                            className="w-6 h-6 rounded-lg object-cover border border-white/10 shrink-0 bg-white/5"
                          />
                          <div className="text-[11px] truncate max-w-[120px]">
                            <div className="font-semibold text-white/90 truncate">{entity.owner?.displayName || 'Creator'}</div>
                            <div className="text-[9px] text-white/40 font-mono truncate">@{entity.owner?.username || 'user'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Members */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => openMembersModal(entity)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-white transition-colors cursor-pointer"
                          title="Manage Members & Roles"
                        >
                          {entity.memberCount || 1}
                        </button>
                      </td>

                      {/* Posts */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => openPostsModal(entity)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-white transition-colors cursor-pointer"
                          title="View & Moderate Posts"
                        >
                          {entity.postCount || 0}
                        </button>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 font-mono text-[10px] text-white/50">
                        {createdDate}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(entity)}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                            entity.status === 'suspended'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {entity.status || 'active'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openMembersModal(entity)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors cursor-pointer"
                            title="Manage Roles & Members"
                          >
                            <Users size={13} />
                          </button>

                          <button
                            onClick={() => openPostsModal(entity)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors cursor-pointer"
                            title="Moderate Posts"
                          >
                            <MessageSquare size={13} />
                          </button>

                          <button
                            onClick={() => setSelectedEntityForApi(entity)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors cursor-pointer"
                            title="API & Access Token Details"
                          >
                            <Key size={13} />
                          </button>

                          <button
                            onClick={() => handleToggleVerify(entity)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              entity.isVerified
                                ? 'bg-sky-500/20 text-sky-400'
                                : 'bg-white/5 hover:bg-white/15 text-white/40 hover:text-white'
                            }`}
                            title="Toggle Verified Badge"
                          >
                            <ShieldCheck size={13} />
                          </button>

                          <button
                            onClick={() => handleRegenerateUrl(entity)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
                            title="Regenerate 11-digit Canonical URL"
                          >
                            <RefreshCw size={13} />
                          </button>

                          <button
                            onClick={() => handleDeleteEntity(entity)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                            title="Delete Entity"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------- MODAL 1: Member & Role Management ----------------- */}
      {selectedEntityForMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0b0e14] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={resolveAvatarSrc(selectedEntityForMembers.logoUrl)}
                  alt=""
                  className="w-10 h-10 rounded-xl object-cover border border-white/10 bg-white/5"
                />
                <div>
                  <h3 className="text-base font-bold text-white">{selectedEntityForMembers.name} — Members</h3>
                  <p className="text-xs text-white/50 font-mono">SQL-backed role management: Owner, Admin, Moderator, Member</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntityForMembers(null)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingMembers ? (
                <div className="py-12 text-center text-white/40 font-mono text-xs">
                  <RefreshCw className="animate-spin inline mr-2 text-white/60" size={16} />
                  Loading members from SQL...
                </div>
              ) : entityMembers.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs">No members found in this entity.</div>
              ) : (
                entityMembers.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={resolveAvatarSrc(m.user?.avatarKey)}
                        alt=""
                        className="w-9 h-9 rounded-xl object-cover border border-white/10 bg-white/5"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs">{m.user?.displayName || 'User'}</span>
                          {m.user?.isVerified && <ShieldCheck size={11} className="text-sky-400" />}
                        </div>
                        <div className="text-[10px] text-white/40 font-mono">
                          @{m.user?.username || 'user'} • Joined {new Date(m.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        onChange={(e) => handleUpdateRole(m.userId, e.target.value)}
                        className="h-8 px-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/90 focus:outline-none focus:border-white/20 font-bold"
                      >
                        <option value="owner" className="bg-[#0b0e14]">Owner</option>
                        <option value="admin" className="bg-[#0b0e14]">Admin</option>
                        <option value="moderator" className="bg-[#0b0e14]">Moderator</option>
                        <option value="member" className="bg-[#0b0e14]">Member</option>
                      </select>

                      <button
                        onClick={() => handleRemoveMember(m.userId, m.user?.displayName || 'User')}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                        title="Remove Member"
                      >
                        <UserX size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
              <span>Total members: {entityMembers.length}</span>
              <button
                onClick={() => setSelectedEntityForMembers(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 2: Post Moderation ----------------- */}
      {selectedEntityForPosts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0b0e14] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={resolveAvatarSrc(selectedEntityForPosts.logoUrl)}
                  alt=""
                  className="w-10 h-10 rounded-xl object-cover border border-white/10 bg-white/5"
                />
                <div>
                  <h3 className="text-base font-bold text-white">{selectedEntityForPosts.name} — Posts Moderation</h3>
                  <p className="text-xs text-white/50 font-mono">View posts, canonical URLs, and remove content</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntityForPosts(null)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingPosts ? (
                <div className="py-12 text-center text-white/40 font-mono text-xs">
                  <RefreshCw className="animate-spin inline mr-2 text-white/60" size={16} />
                  Loading posts...
                </div>
              ) : entityPosts.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs">No posts found in this entity.</div>
              ) : (
                entityPosts.map((p) => {
                  const postUrl = `https://aeirmist.com${p.canonicalUrl || `/bonds/posts/${p.id}`}`;
                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={resolveAvatarSrc(p.author?.avatarKey)}
                            alt=""
                            className="w-7 h-7 rounded-lg object-cover border border-white/10 bg-white/5"
                          />
                          <div>
                            <div className="text-xs font-bold text-white">{p.author?.displayName || 'Author'}</div>
                            <div className="text-[10px] text-white/40 font-mono">
                              {new Date(p.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeletePost(p.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                          Delete Post
                        </button>
                      </div>

                      <div className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap">
                        {p.content}
                      </div>

                      {p.mediaUrls && p.mediaUrls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto py-1">
                          {p.mediaUrls.map((url: string, i: number) => (
                            <img
                              key={i}
                              src={resolveAvatarSrc(url)}
                              alt=""
                              className="w-20 h-20 rounded-xl object-cover border border-white/10 shrink-0"
                            />
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-mono text-white/40">
                        <div className="flex items-center gap-2">
                          <span>Likes: {p.likesCount || 0}</span>
                          <span>•</span>
                          <span>Comments: {p.commentsCount || 0}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(postUrl, `post-url-${p.id}`)}
                          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                        >
                          {copiedKey === `post-url-${p.id}` ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} />
                          )}
                          <span>Copy Post URL</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
              <span>Total posts: {entityPosts.length}</span>
              <button
                onClick={() => setSelectedEntityForPosts(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 3: API & Access Tokens ----------------- */}
      {selectedEntityForApi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-[#0b0e14] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center" style={{ color: accentColor }}>
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedEntityForApi.name} — API & Access</h3>
                  <p className="text-xs text-white/50 font-mono">Canonical URLs, tokens, and integration endpoints</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntityForApi(null)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Canonical URL */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-white/60 uppercase tracking-wider">Canonical 11-Digit Public URL</label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-white">
                  <span className="truncate mr-2">
                    {`https://aeirmist.com${selectedEntityForApi.canonicalUrl || `/bonds/${selectedEntityForApi.type === 'community' ? 'communities' : selectedEntityForApi.type + 's'}/${selectedEntityForApi.slug}`}`}
                  </span>
                  <button
                    onClick={() => handleCopy(`https://aeirmist.com${selectedEntityForApi.canonicalUrl || `/bonds/${selectedEntityForApi.type === 'community' ? 'communities' : selectedEntityForApi.type + 's'}/${selectedEntityForApi.slug}`}`, 'api-canon-url')}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy URL"
                  >
                    {copiedKey === 'api-canon-url' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Entity UUID */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-white/60 uppercase tracking-wider">Database UUID</label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-white">
                  <span>{selectedEntityForApi.id}</span>
                  <button
                    onClick={() => handleCopy(selectedEntityForApi.id, 'api-uuid')}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    {copiedKey === 'api-uuid' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Access Token Simulator */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-white/60 uppercase tracking-wider">Entity Integration Access Token</label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-white">
                  <span className="truncate mr-2">
                    {`aey_live_${selectedEntityForApi.id.replace(/-/g, '').slice(0, 16)}_${selectedEntityForApi.entityNumber || '10849204812'}`}
                  </span>
                  <button
                    onClick={() => handleCopy(`aey_live_${selectedEntityForApi.id.replace(/-/g, '').slice(0, 16)}_${selectedEntityForApi.entityNumber || '10849204812'}`, 'api-token')}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    {copiedKey === 'api-token' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Endpoints */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono text-white/60 uppercase tracking-wider">REST Endpoints</label>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-white/80">
                    <span className="text-emerald-400 font-bold">GET</span>
                    <span>/api/v1/bonds/entities/{selectedEntityForApi.slug}</span>
                  </div>
                  <div className="flex items-center justify-between text-white/80">
                    <span className="text-blue-400 font-bold">POST</span>
                    <span>/api/v1/bonds/entities/{selectedEntityForApi.id}/posts</span>
                  </div>
                  <div className="flex items-center justify-between text-white/80">
                    <span className="text-purple-400 font-bold">POST</span>
                    <span>/api/v1/bonds/entities/{selectedEntityForApi.id}/join</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedEntityForApi(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BondsManagementTab;
