import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Users, MessageSquare, Shield, Globe, Lock, CheckCircle2, 
  Calendar, Layers, Sparkles, ExternalLink, Briefcase, Plus,
  ChevronRight, Award, Compass, BookOpen, AlertCircle
} from 'lucide-react';
import { api } from '../../services/api/client';
import { TeamApplicationModal } from './TeamApplicationModal';

interface BondsEntityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: any;
  onMessageClick: (entity: any) => void;
  onJoinSuccess?: (entityId: string, status: string) => void;
}

export const BondsEntityDetailModal: React.FC<BondsEntityDetailModalProps> = ({
  isOpen,
  onClose,
  entity,
  onMessageClick,
  onJoinSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<string>('about');
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [joinStatus, setJoinStatus] = useState<string>(entity?.membershipStatus || 'not_member');
  const [isJoining, setIsJoining] = useState(false);
  const [selectedRoleForApply, setSelectedRoleForApply] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!entity) return;
    setJoinStatus(entity.membershipStatus || 'not_member');
    if (entity.type === 'team') {
      setActiveTab('roles');
    } else {
      setActiveTab('about');
    }
  }, [entity]);

  // Load members when clicking members tab
  useEffect(() => {
    if (activeTab === 'members' && entity?.id) {
      setLoadingMembers(true);
      api.bonds.getEntityMembers(entity.id)
        .then(res => setMembers(res.members || []))
        .catch(() => setMembers([]))
        .finally(() => setLoadingMembers(false));
    }
  }, [activeTab, entity?.id]);

  if (!isOpen || !entity) return null;

  const handleJoinOrRequest = async () => {
    if (entity.type === 'team') {
      setIsApplying(true);
      return;
    }

    try {
      setIsJoining(true);
      const res = await api.bonds.joinOrRequest(entity.id);
      if (res?.result?.status === 'joined') {
        setJoinStatus('active');
        onJoinSuccess?.(entity.id, 'active');
      } else if (res?.result?.status === 'request_submitted' || res?.result?.status === 'request_pending') {
        setJoinStatus('pending');
        onJoinSuccess?.(entity.id, 'pending');
      }
    } catch (err: any) {
      console.error('Join error:', err);
    } finally {
      setIsJoining(false);
    }
  };

  const tabs = entity.type === 'team'
    ? [
        { id: 'roles', label: 'Open Roles' },
        { id: 'about', label: 'Overview' },
        { id: 'members', label: 'Team Members' },
        { id: 'roadmap', label: 'Roadmap & Specs' },
      ]
    : entity.type === 'community'
    ? [
        { id: 'about', label: 'Overview' },
        { id: 'topics', label: 'Topics & Knowledge' },
        { id: 'members', label: 'Community Members' },
        { id: 'rules', label: 'Rules & Guidelines' },
      ]
    : [
        { id: 'about', label: 'About' },
        { id: 'discussions', label: 'Discussions' },
        { id: 'members', label: 'Members' },
        { id: 'rules', label: 'Guidelines' },
      ];

  const openRoles: Array<{ title: string; skills?: string[] }> = entity.settings?.openRoles || [
    { title: 'Core Engineer', skills: ['TypeScript', 'Architecture', 'PostgreSQL'] },
    { title: 'UI/UX Lead', skills: ['Design Systems', 'Figma', 'Micro-interactions'] },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl max-h-[92vh] bg-[#0b0e14] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-200"
        >
          {/* Cover & Header */}
          <div className="relative h-44 sm:h-56 bg-neutral-900 overflow-hidden shrink-0">
            {entity.coverUrl ? (
              <img src={entity.coverUrl} alt={entity.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-cyan-950/40 via-neutral-900 to-[#06080c] flex items-center justify-center">
                <Compass className="w-16 h-16 text-cyan-500/10" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/50 to-transparent" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm border border-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Entity Badge and Type in top left */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                {entity.type}
              </span>
              <span className="px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-white/15 text-[11px] text-neutral-300 flex items-center gap-1">
                {entity.privacy === 'private' ? <Lock className="w-3 h-3 text-amber-400" /> : <Globe className="w-3 h-3 text-cyan-400" />}
                <span className="capitalize">{entity.privacy || 'Public'}</span>
              </span>
            </div>

            {/* Logo and Entity Identity overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
              <div className="flex items-end gap-3.5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-[#06080c] border-2 border-white/15 overflow-hidden shrink-0 shadow-xl flex items-center justify-center">
                  {entity.logoUrl ? (
                    <img src={entity.logoUrl} alt={entity.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-black text-cyan-400">{entity.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="mb-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{entity.name}</h2>
                  <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                    <span className="text-cyan-400 font-medium">{entity.category}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-neutral-400" />
                      {entity.memberCount || 1} members
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="px-6 py-3 border-b border-white/10 bg-[#06080c]/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {joinStatus === 'active' || entity.isMember ? (
                <div className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Joined & Active</span>
                </div>
              ) : joinStatus === 'pending' ? (
                <div className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  <span>Request Pending</span>
                </div>
              ) : entity.type === 'team' ? (
                <button
                  onClick={() => setIsApplying(true)}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Apply to Team</span>
                </button>
              ) : (
                <button
                  onClick={handleJoinOrRequest}
                  disabled={isJoining}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{entity.membershipPolicy === 'approval_required' ? 'Request to Join' : 'Join Now'}</span>
                </button>
              )}
            </div>

            {/* Persistent Message Button */}
            <button
              onClick={() => {
                onClose();
                onMessageClick(entity);
              }}
              className="px-4 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors flex items-center gap-2"
            >
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Message</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-6 border-b border-white/10 bg-[#06080c]/40 shrink-0 overflow-x-auto">
            {tabs.map(t => {
              const isSelected = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`py-3 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    isSelected
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Scrollable Content Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Overview / About Tab */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">About this {entity.type}</h4>
                  <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{entity.description}</p>
                </div>

                {entity.tags && entity.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Focus Areas</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {entity.tags.map((tag: string) => (
                        <span key={tag} className="px-2.5 py-1 rounded bg-white/[0.04] border border-white/10 text-xs text-neutral-300">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>Membership Policy: <strong className="text-neutral-200 capitalize">{entity.membershipPolicy?.replace('_', ' ') || 'Open'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-neutral-400" />
                    <span>Created: {new Date(entity.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Team Open Roles Tab */}
            {activeTab === 'roles' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Active Recruitment Positions</h4>
                  <span className="text-xs text-cyan-400 font-medium">{openRoles.length} Open Roles</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {openRoles.map((role, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <h5 className="text-white font-semibold text-sm">{role.title}</h5>
                        {role.skills && role.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {role.skills.map(s => (
                              <span key={s} className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setSelectedRoleForApply(role.title);
                          setIsApplying(true);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold self-start sm:self-auto shrink-0 transition-colors"
                      >
                        Apply for Role
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Members Directory</h4>
                {loadingMembers ? (
                  <div className="py-8 text-center text-xs text-neutral-500">Loading members...</div>
                ) : members.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-500">No member records visible.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {members.map(m => (
                      <div key={m.membership.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">
                            {m.user?.displayName?.[0] || 'U'}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-white">{m.user?.displayName || 'User'}</div>
                            <div className="text-[10px] text-neutral-400">@{m.user?.username || 'member'}</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] uppercase font-bold text-neutral-400">
                          {m.membership.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rules / Guidelines Tab */}
            {activeTab === 'rules' && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Community Principles & Rules</h4>
                <div className="space-y-2.5">
                  {(entity.rules && entity.rules.length > 0 ? entity.rules : [
                    { title: 'Respectful Collaboration', description: 'Be supportive and professional in all communications.' },
                    { title: 'No Spam or Solicitation', description: 'Promote relevant discussions without unauthorized spamming.' },
                    { title: 'Intellectual Integrity', description: 'Respect project code, ideas, and shared knowledge.' },
                  ]).map((rule: any, i: number) => (
                    <div key={i} className="p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
                      <div className="text-xs font-semibold text-white mb-1">{i + 1}. {rule.title}</div>
                      <div className="text-xs text-neutral-400">{rule.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Roadmap / Topics Tab fallback */}
            {(activeTab === 'roadmap' || activeTab === 'topics' || activeTab === 'discussions') && (
              <div className="py-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h5 className="text-white font-semibold text-sm">Discussions & Stream Active in Messenger</h5>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  All shared discussions, files, and updates for {entity.name} are accessible in the persistent conversation.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onMessageClick(entity);
                  }}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold transition-colors"
                >
                  Open {entity.name} Chat
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Team Application Modal */}
      {isApplying && (
        <TeamApplicationModal
          isOpen={isApplying}
          onClose={() => setIsApplying(false)}
          team={{
            id: entity.id,
            name: entity.name,
            logoUrl: entity.logoUrl,
            openRoles: openRoles,
          }}
          initialRole={selectedRoleForApply}
          onApplicationSubmitted={() => {
            setJoinStatus('pending');
            onJoinSuccess?.(entity.id, 'pending');
          }}
        />
      )}
    </AnimatePresence>
  );
};
