import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, ArrowLeft, Check, Layers, Shield, Globe, Lock, BookOpen } from 'lucide-react';
import { api } from '../../../services/api/client';
import { DeviceImageUploader } from './DeviceImageUploader';

interface CreateCommunityWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEntity: any) => void;
}

export const CreateCommunityWizard: React.FC<CreateCommunityWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);
  const totalSteps = 9;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Knowledge & Research');
  const [coverUrl, setCoverUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [topics, setTopics] = useState<string[]>(['engineering', 'open-source', 'architecture']);
  const [topicInput, setTopicInput] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [membershipPolicy, setMembershipPolicy] = useState<'open' | 'approval_required' | 'invite_only'>('open');
  const [moderationRule, setModerationRule] = useState('Strict civil discussion. Off-topic promotions will be removed.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = [
    'Knowledge & Research', 'Open Source Ecosystems', 'AI & Deep Learning',
    'Design Systems & Crafts', 'Scientific Computing', 'Cybersecurity & Privacy',
    'Startup Operators', 'Global Guilds'
  ];

  const handleNext = () => {
    setError(null);
    if (step === 1 && (!name.trim() || name.trim().length < 3)) {
      setError('Community name must be at least 3 characters.');
      return;
    }
    if (step === 2 && (!description.trim() || description.trim().length < 10)) {
      setError('Please provide a descriptive overview.');
      return;
    }
    setStep(prev => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError(null);
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleAddTopic = () => {
    const clean = topicInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (clean && !topics.includes(clean)) {
      setTopics(prev => [...prev, clean]);
      setTopicInput('');
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      let entity: any = null;
      try {
        const res = await api.bonds.createEntity({
          type: 'community',
          name: name.trim(),
          description: description.trim(),
          category,
          coverUrl: coverUrl.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          privacy,
          membershipPolicy,
          tags: topics,
          rules: [
            { title: 'Moderation Standard', description: moderationRule },
            { title: 'Knowledge Sharing', description: 'Ensure shared information and resources are authentic.' },
          ],
        });
        entity = res?.entity;
      } catch (apiErr: any) {
        console.warn('[Bonds API offline or 404, using resilient fallback]', apiErr);
      }

      if (!entity) {
        const entityNum = Math.floor(10000000000 + Math.random() * 90000000000).toString();
        const cleanSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'community';
        const randToken = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
        const slug = `${entityNum}-${cleanSlug}-${randToken}`;
        const canonicalUrl = `/bonds/communities/${slug}`;

        entity = {
          id: `comm-${Date.now()}`,
          type: 'community',
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
          tags: topics,
          rules: [
            { title: 'Moderation Standard', description: moderationRule },
            { title: 'Knowledge Sharing', description: 'Ensure shared information and resources are authentic.' },
          ],
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
      console.error('[Create Community Error]', err);
      setError(err?.message || 'Failed to create community.');
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
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Create Community / Guild</h3>
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
                <h4 className="text-sm font-semibold text-white">Community Identity</h4>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Community / Guild Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Autonomous Agents Lab"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:border-cyan-500/60 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Mission & Overview</h4>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Detailed Description *</label>
                  <textarea
                    rows={4}
                    placeholder="Describe what members will learn, research, discuss, or organize in this community..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:border-cyan-500/60 focus:outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Category</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`p-3 rounded-lg border text-left text-xs font-medium transition-all ${
                        category === c
                          ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                          : 'bg-white/[0.02] border-white/10 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-white">Visual Assets</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">Upload banner and logo directly from your device.</p>
                </div>
                <DeviceImageUploader
                  coverUrl={coverUrl}
                  onCoverChange={setCoverUrl}
                  logoUrl={logoUrl}
                  onLogoChange={setLogoUrl}
                  coverLabel="Community Banner"
                  logoLabel="Community Badge / Crest"
                />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Topics & Tags</h4>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {topics.map(t => (
                    <span key={t} className="px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center gap-1">
                      #{t}
                      <button type="button" onClick={() => setTopics(topics.filter(x => x !== t))} className="hover:text-white">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add topic (e.g. distributed-systems)"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTopic(); } }}
                    className="flex-1 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:border-cyan-500/60 focus:outline-none"
                  />
                  <button type="button" onClick={handleAddTopic} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-white font-medium hover:bg-white/20">
                    Add
                  </button>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Community Privacy</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrivacy('public')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      privacy === 'public' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300' : 'bg-white/[0.02] border-white/10 text-neutral-300'
                    }`}
                  >
                    <Globe className="w-5 h-5 mb-2 text-cyan-400" />
                    <div className="text-xs font-bold text-white">Public Guild</div>
                    <div className="text-[11px] text-neutral-400 mt-1">Discussions and topics are discoverable by the global BOND ecosystem.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivacy('private')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      privacy === 'private' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300' : 'bg-white/[0.02] border-white/10 text-neutral-300'
                    }`}
                  >
                    <Lock className="w-5 h-5 mb-2 text-amber-400" />
                    <div className="text-xs font-bold text-white">Private Circle</div>
                    <div className="text-[11px] text-neutral-400 mt-1">Closed knowledge community for approved members only.</div>
                  </button>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Membership Policy</h4>
                <div className="space-y-2">
                  {[
                    { id: 'open', title: 'Open', desc: 'Direct participation without manual review.' },
                    { id: 'approval_required', title: 'Curated (Application / Review)', desc: 'Admin approves candidates based on background or introduction.' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setMembershipPolicy(p.id as any)}
                      className={`w-full p-3.5 rounded-xl border text-left flex items-start justify-between transition-all ${
                        membershipPolicy === p.id ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300' : 'bg-white/[0.02] border-white/10 text-neutral-300'
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

            {step === 8 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Moderation Standards</h4>
                <textarea
                  rows={3}
                  value={moderationRule}
                  onChange={(e) => setModerationRule(e.target.value)}
                  className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:border-cyan-500/60 focus:outline-none resize-none"
                />
              </div>
            )}

            {step === 9 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Review & Establish Community</h4>
                <div className="p-4 rounded-xl border border-white/10 bg-[#06080c] space-y-2">
                  <div className="text-base font-bold text-white">{name}</div>
                  <div className="text-xs text-cyan-400">{category} • {privacy}</div>
                  <p className="text-xs text-neutral-300 line-clamp-3">{description}</p>
                  <div className="flex flex-wrap gap-1 pt-2">
                    {topics.map(t => (
                      <span key={t} className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-neutral-400">#{t}</span>
                    ))}
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
                {isSubmitting ? 'Establishing...' : 'Establish Community'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
