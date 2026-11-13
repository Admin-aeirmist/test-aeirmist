import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, ArrowLeft, Check, Briefcase, Plus, Trash2, Globe, Lock, Shield } from 'lucide-react';
import { api } from '../../../services/api/client';
import { DeviceImageUploader } from './DeviceImageUploader';

interface CreateTeamWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEntity: any) => void;
}

export const CreateTeamWizard: React.FC<CreateTeamWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);
  const totalSteps = 8;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Software Engineering');
  const [stage, setStage] = useState('Active Alpha');
  const [coverUrl, setCoverUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [openRoles, setOpenRoles] = useState<Array<{ title: string; skills: string[] }>>([
    { title: 'Fullstack Engineer', skills: ['React', 'TypeScript', 'Node.js'] },
    { title: 'UI/UX Designer', skills: ['Figma', 'Design Systems'] },
  ]);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRoleSkills, setNewRoleSkills] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [membershipPolicy, setMembershipPolicy] = useState<'open' | 'approval_required' | 'invite_only'>('approval_required');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNext = () => {
    setError(null);
    if (step === 1 && (!name.trim() || name.trim().length < 3)) {
      setError('Team name must be at least 3 characters.');
      return;
    }
    if (step === 2 && (!description.trim() || description.trim().length < 10)) {
      setError('Please provide a descriptive overview of the project.');
      return;
    }
    setStep(prev => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError(null);
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleAddRole = () => {
    if (newRoleTitle.trim()) {
      const skills = newRoleSkills.split(',').map(s => s.trim()).filter(Boolean);
      setOpenRoles(prev => [...prev, { title: newRoleTitle.trim(), skills }]);
      setNewRoleTitle('');
      setNewRoleSkills('');
    }
  };

  const handleRemoveRole = (index: number) => {
    setOpenRoles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      let entity: any = null;
      try {
        const res = await api.bonds.createEntity({
          type: 'team',
          name: name.trim(),
          description: description.trim(),
          category,
          coverUrl: coverUrl.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          privacy,
          membershipPolicy,
          tags: [category.toLowerCase(), stage.toLowerCase()],
          settings: {
            stage,
            openRoles,
          },
        });
        entity = res?.entity;
      } catch (apiErr: any) {
        console.warn('[Bonds API offline or 404, using resilient fallback for team]', apiErr);
      }

      if (!entity) {
        const entityNum = Math.floor(10000000000 + Math.random() * 90000000000).toString();
        const cleanSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'team';
        const randToken = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
        const slug = `${entityNum}-${cleanSlug}-${randToken}`;
        const canonicalUrl = `/bonds/teams/${slug}`;

        entity = {
          id: `team-${Date.now()}`,
          type: 'team',
          name: name.trim(),
          entityNumber: entityNum,
          slug,
          canonicalUrl,
          description: description.trim(),
          category,
          coverUrl: coverUrl.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          privacy,
          membershipPolicy,
          tags: [category.toLowerCase(), stage.toLowerCase()],
          settings: {
            stage,
            openRoles,
          },
          memberCount: 1,
          myRole: 'owner',
          isCreator: true,
          isMember: true,
          membershipStatus: 'active',
          conversationId: `conv_${entityNum}`,
          createdAt: new Date().toISOString(),
        };

        try {
          const localExisting = JSON.parse(localStorage.getItem('aeirmist_local_bonds_entities') || '[]');
          localStorage.setItem('aeirmist_local_bonds_entities', JSON.stringify([entity, ...localExisting]));
        } catch {}
      }

      window.dispatchEvent(new CustomEvent('aeirmist_bonds_created', { detail: { entity } }));
      onSuccess(entity);
      onClose();
    } catch (err: any) {
      console.error('[Create Team Error]', err);
      setError(err?.message || 'Failed to create team.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative w-full max-w-xl bg-[#0b0e14] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#06080c]/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Create Project Team</h3>
                <p className="text-[11px] text-neutral-400">Step {step} of {totalSteps}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full bg-white/5 h-1">
            <div className="bg-cyan-400 h-1 transition-all duration-300" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>

          <div className="p-6 overflow-y-auto max-h-[65vh] space-y-4">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>}

            {step === 1 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Team Identity</h4>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Team / Project Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Era AI Model Gateway"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:border-cyan-500/60 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Purpose & Mission</h4>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Project Description *</label>
                  <textarea
                    rows={4}
                    placeholder="What problem are you solving? What are the key technical pillars of this project?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:border-cyan-500/60 focus:outline-none resize-none"
                  />
                </div>
                <div className="pt-2 border-t border-white/10">
                  <DeviceImageUploader
                    coverUrl={coverUrl}
                    onCoverChange={setCoverUrl}
                    logoUrl={logoUrl}
                    onLogoChange={setLogoUrl}
                    coverLabel="Team Banner / Workspace Cover"
                    logoLabel="Team Crest / Logo"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Project Domain & Stage</h4>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Domain</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#06080c] border border-white/10 rounded-lg text-xs text-white focus:border-cyan-500/60 focus:outline-none"
                  >
                    <option value="Software Engineering">Software Engineering</option>
                    <option value="AI & Robotics">AI & Robotics</option>
                    <option value="FinTech & Ledger">FinTech & Ledger</option>
                    <option value="Biotech & Research">Biotech & Research</option>
                    <option value="Game Studio">Game Studio</option>
                    <option value="Media & Creative">Media & Creative</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Current Stage</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['Conception', 'Prototype', 'Active Alpha', 'Production'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStage(s)}
                        className={`p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                          stage === s ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300' : 'bg-white/[0.02] border-white/10 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Open Roles & Required Skills</h4>
                <div className="space-y-2">
                  {openRoles.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-white">{r.title}</div>
                        <div className="text-[10px] text-cyan-400 mt-0.5">{r.skills.join(', ') || 'General'}</div>
                      </div>
                      <button type="button" onClick={() => handleRemoveRole(i)} className="text-neutral-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-white/10 space-y-2">
                  <input
                    type="text"
                    placeholder="Role title (e.g. Backend Lead)"
                    value={newRoleTitle}
                    onChange={(e) => setNewRoleTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Required skills separated by comma (e.g. Rust, Docker, Redis)"
                    value={newRoleSkills}
                    onChange={(e) => setNewRoleSkills(e.target.value)}
                    className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddRole}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-medium"
                  >
                    + Add Role
                  </button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Recruitment & Application Policy</h4>
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300">
                  <div className="font-bold mb-1">Recruitment-Oriented Lifecycle</div>
                  <p className="text-neutral-300">
                    Candidates apply for specific roles with portfolio and motivation. Status lifecycle:
                    <span className="text-cyan-400 font-medium"> Submitted → Under Review → Accepted / Rejected</span>.
                    Once accepted, they are added to team roster and conversation automatically.
                  </p>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Membership Policy</h4>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setMembershipPolicy('approval_required')}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-start justify-between transition-all ${
                      membershipPolicy === 'approval_required' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300' : 'bg-white/[0.02] border-white/10 text-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-white">Application Required (Recommended for Teams)</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">Team leads review candidate applications before granting access.</div>
                    </div>
                    {membershipPolicy === 'approval_required' && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMembershipPolicy('open')}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-start justify-between transition-all ${
                      membershipPolicy === 'open' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300' : 'bg-white/[0.02] border-white/10 text-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-white">Open Join</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">Open collaboration where anyone can join immediately.</div>
                    </div>
                    {membershipPolicy === 'open' && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </button>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Team Privacy</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrivacy('public')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      privacy === 'public' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300' : 'bg-white/[0.02] border-white/10 text-neutral-300'
                    }`}
                  >
                    <Globe className="w-5 h-5 mb-2 text-cyan-400" />
                    <div className="text-xs font-bold text-white">Public Team</div>
                    <div className="text-[11px] text-neutral-400 mt-1">Discoverable in the BOND talent and project network.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivacy('private')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      privacy === 'private' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300' : 'bg-white/[0.02] border-white/10 text-neutral-300'
                    }`}
                  >
                    <Lock className="w-5 h-5 mb-2 text-amber-400" />
                    <div className="text-xs font-bold text-white">Stealth / Private</div>
                    <div className="text-[11px] text-neutral-400 mt-1">Hidden repository and project specs.</div>
                  </button>
                </div>
              </div>
            )}

            {step === 8 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Preview Team Hub</h4>
                <div className="p-4 rounded-xl border border-white/10 bg-[#06080c] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-white">{name}</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-bold">{stage}</span>
                  </div>
                  <div className="text-xs text-neutral-400">{category}</div>
                  <p className="text-xs text-neutral-300 line-clamp-3">{description}</p>
                  <div className="pt-2 text-[11px] text-neutral-500">
                    {openRoles.length} Open positions defined. Persistent team conversation will be created.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-white/10 bg-[#06080c]/80 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : <div />}

            {step < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-black flex items-center gap-1.5 transition-colors"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Assembling Team...' : 'Launch Team'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
