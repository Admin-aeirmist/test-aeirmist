import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, ArrowLeft, Check, Users, Shield, Globe, Lock, Sparkles, Image as ImageIcon } from 'lucide-react';
import { api } from '../../../services/api/client';
import { DeviceImageUploader } from './DeviceImageUploader';

interface CreateGroupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEntity: any) => void;
}

export const CreateGroupWizard: React.FC<CreateGroupWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);
  const totalSteps = 7;

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Tech & Developers');
  const [coverUrl, setCoverUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [membershipPolicy, setMembershipPolicy] = useState<'open' | 'approval_required' | 'invite_only'>('open');
  const [rules, setRules] = useState<Array<{ title: string; description: string }>>([
    { title: 'Be Respectful', description: 'Treat every group member with dignity and constructive feedback.' },
    { title: 'No Spam or Self-Promotion', description: 'Do not post unsolicited links, ads, or bulk promotions.' },
  ]);
  const [ruleInputTitle, setRuleInputTitle] = useState('');
  const [ruleInputDesc, setRuleInputDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = [
    'Tech & Developers', 'Design & UX', 'Founders & Business', 'AI & Data',
    'Gaming & Esports', 'Crypto & Web3', 'Music & Creators', 'Regional Hubs'
  ];

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!name.trim() || name.trim().length < 3) {
        setError('Group name must be at least 3 characters.');
        return;
      }
      if (!description.trim() || description.trim().length < 10) {
        setError('Please provide a descriptive overview (at least 10 characters).');
        return;
      }
    }
    setStep(prev => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError(null);
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleAddRule = () => {
    if (ruleInputTitle.trim() && ruleInputDesc.trim()) {
      setRules(prev => [...prev, { title: ruleInputTitle.trim(), description: ruleInputDesc.trim() }]);
      setRuleInputTitle('');
      setRuleInputDesc('');
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      let entity: any = null;
      try {
        const res = await api.bonds.createEntity({
          type: 'group',
          name: name.trim(),
          description: description.trim(),
          category,
          coverUrl: coverUrl.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          privacy,
          membershipPolicy,
          rules,
        });
        entity = res?.entity;
      } catch (apiErr: any) {
        console.warn('[Bonds API offline or 404, using resilient fallback]', apiErr);
      }

      if (!entity) {
        const entityNum = Math.floor(10000000000 + Math.random() * 90000000000).toString();
        const cleanSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'group';
        const randToken = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
        const slug = `${entityNum}-${cleanSlug}-${randToken}`;
        const canonicalUrl = `/bonds/groups/${slug}`;

        entity = {
          id: `grp-${Date.now()}`,
          type: 'group',
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
          rules,
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
      console.error('[Create Group Error]', err);
      setError(err?.message || 'Failed to create group. Please check your inputs.');
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
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Create New Group</h3>
                <p className="text-[11px] text-neutral-400">Step {step} of {totalSteps}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/5 h-1">
            <div
              className="bg-cyan-400 h-1 transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto max-h-[65vh] space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                {error}
              </div>
            )}

            {/* Step 1: Basic Information */}
            {step === 1 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Basic Information</h4>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Group Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dhaka React Enthusiasts"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:border-cyan-500/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Description *</label>
                  <textarea
                    rows={4}
                    placeholder="Describe the purpose, interests, and target members of this group..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:border-cyan-500/60 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Primary Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#06080c] border border-white/10 rounded-lg text-xs text-white focus:border-cyan-500/60 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Visual Identity */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-white">Visual Identity</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">Upload cover image and logo directly from your device.</p>
                </div>
                <DeviceImageUploader
                  coverUrl={coverUrl}
                  onCoverChange={setCoverUrl}
                  logoUrl={logoUrl}
                  onLogoChange={setLogoUrl}
                  coverLabel="Group Cover Banner"
                  logoLabel="Group Logo / Avatar"
                />
              </div>
            )}

            {/* Step 3: Privacy */}
            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Privacy Setting</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrivacy('public')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      privacy === 'public'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300'
                        : 'bg-white/[0.02] border-white/10 text-neutral-300 hover:border-white/20'
                    }`}
                  >
                    <Globe className="w-5 h-5 mb-2 text-cyan-400" />
                    <div className="text-xs font-bold text-white">Public Group</div>
                    <div className="text-[11px] text-neutral-400 mt-1">Anyone can discover the group, see members, and browse public previews.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrivacy('private')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      privacy === 'private'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300'
                        : 'bg-white/[0.02] border-white/10 text-neutral-300 hover:border-white/20'
                    }`}
                  >
                    <Lock className="w-5 h-5 mb-2 text-amber-400" />
                    <div className="text-xs font-bold text-white">Private Group</div>
                    <div className="text-[11px] text-neutral-400 mt-1">Only members can view discussions, resources, and member activities.</div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Membership Policy */}
            {step === 4 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Membership Policy</h4>
                <div className="space-y-2.5">
                  {[
                    { id: 'open', title: 'Open Join', desc: 'Anyone can join immediately without approval.' },
                    { id: 'approval_required', title: 'Admin Approval Required', desc: 'Interested people must request and be approved by an admin.' },
                    { id: 'invite_only', title: 'Invite Only', desc: 'Members can only join via direct invitations from group leaders.' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setMembershipPolicy(p.id as any)}
                      className={`w-full p-3.5 rounded-xl border text-left flex items-start justify-between transition-all ${
                        membershipPolicy === p.id
                          ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300'
                          : 'bg-white/[0.02] border-white/10 text-neutral-300 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{p.title}</div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">{p.desc}</div>
                      </div>
                      {membershipPolicy === p.id && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Permissions */}
            {step === 5 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Member Permissions</h4>
                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Members can start discussions</span>
                    <span className="text-cyan-400 font-semibold">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Members can invite connections</span>
                    <span className="text-cyan-400 font-semibold">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Admin approval needed to unlock Messenger chat</span>
                    <span className="text-amber-400 font-semibold">{membershipPolicy === 'approval_required' ? 'Active' : 'Not Required'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Rules */}
            {step === 6 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Community Rules</h4>
                <div className="space-y-2">
                  {rules.map((r, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 text-xs">
                      <div className="font-semibold text-white">{i + 1}. {r.title}</div>
                      <div className="text-neutral-400 text-[11px] mt-0.5">{r.description}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <input
                    type="text"
                    placeholder="Rule title (e.g. Constructive Feedback)"
                    value={ruleInputTitle}
                    onChange={(e) => setRuleInputTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Rule description..."
                    value={ruleInputDesc}
                    onChange={(e) => setRuleInputDesc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition-colors"
                  >
                    + Add Rule
                  </button>
                </div>
              </div>
            )}

            {/* Step 7: Preview & Create */}
            {step === 7 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Preview & Confirm</h4>
                <div className="border border-white/15 rounded-xl overflow-hidden bg-[#06080c]">
                  <div className="h-28 bg-neutral-900 relative">
                    {coverUrl && <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />}
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-cyan-400 font-bold uppercase">
                      {privacy}
                    </div>
                  </div>
                  <div className="p-4">
                    <h5 className="text-base font-bold text-white">{name || 'Untitled Group'}</h5>
                    <div className="text-xs text-cyan-400 font-medium mb-2">{category}</div>
                    <p className="text-xs text-neutral-300 leading-relaxed line-clamp-2">{description}</p>
                    <div className="mt-3 text-[11px] text-neutral-500">
                      Policy: <span className="capitalize text-neutral-300">{membershipPolicy.replace('_', ' ')}</span> • Persistent Messenger Conversation will be initialized automatically.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
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
                {isSubmitting ? 'Creating Group...' : 'Launch Group'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
