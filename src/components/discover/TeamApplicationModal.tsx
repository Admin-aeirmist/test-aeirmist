import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Briefcase, Link2, CheckCircle2, AlertCircle, Loader2, Award } from 'lucide-react';
import { api } from '../../services/api/client';

interface TeamApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: {
    id: string;
    name: string;
    logoUrl?: string | null;
    openRoles?: Array<{ title: string; skills?: string[] }>;
  };
  initialRole?: string;
  onApplicationSubmitted?: (role: string) => void;
}

export const TeamApplicationModal: React.FC<TeamApplicationModalProps> = ({
  isOpen,
  onClose,
  team,
  initialRole,
  onApplicationSubmitted,
}) => {
  const roles = team.openRoles && team.openRoles.length > 0 
    ? team.openRoles 
    : [
        { title: 'Fullstack Engineer', skills: ['React', 'TypeScript', 'Node.js'] },
        { title: 'UI/UX Designer', skills: ['Figma', 'Design Systems', 'Prototyping'] },
        { title: 'AI / ML Integrator', skills: ['LLMs', 'Python', 'Embeddings'] },
        { title: 'Community & Growth Lead', skills: ['Marketing', 'Community Building'] },
      ];

  const [selectedRole, setSelectedRole] = useState(initialRole || roles[0]?.title || 'Contributor');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [statement, setStatement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError('Please select a role to apply for.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await api.bonds.applyToTeam(team.id, {
        roleApplied: selectedRole,
        portfolioUrl: portfolioUrl.trim() || undefined,
        answers: {
          statement: statement.trim(),
          submittedAt: new Date().toISOString(),
        },
      });

      setIsSuccess(true);
      onApplicationSubmitted?.(selectedRole);
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
      }, 1800);
    } catch (err: any) {
      console.error('[Apply Error]', err);
      setError(err?.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-[#0b0e14] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#06080c]/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold overflow-hidden">
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
                ) : (
                  <Briefcase className="w-5 h-5 text-cyan-400" />
                )}
              </div>
              <div>
                <h3 className="text-white font-semibold text-base leading-tight">Apply to {team.name}</h3>
                <p className="text-xs text-neutral-400">Team Recruitment & Role Application</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {isSuccess ? (
              <div className="py-8 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-white text-lg font-bold mb-1">Application Submitted</h4>
                <p className="text-sm text-neutral-400 max-w-sm">
                  Your application for <span className="text-cyan-400 font-medium">{selectedRole}</span> has been received. Team leaders will review it shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                    Select Role <span className="text-cyan-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {roles.map((r) => {
                      const isSelected = selectedRole === r.title;
                      return (
                        <button
                          key={r.title}
                          type="button"
                          onClick={() => setSelectedRole(r.title)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                              : 'bg-white/[0.02] border-white/10 text-neutral-300 hover:border-white/20'
                          }`}
                        >
                          <div className="font-medium text-xs text-white">{r.title}</div>
                          {r.skills && r.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {r.skills.slice(0, 3).map((s) => (
                                <span key={s} className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-neutral-400 border border-white/5">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Portfolio / Link */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Portfolio / GitHub / Link (Optional)
                  </label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="url"
                      placeholder="https://github.com/yourhandle or portfolio.com"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
                    />
                  </div>
                </div>

                {/* Experience / Motivation */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Why do you want to join this team?
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe your experience, relevant work, and what you would like to build..."
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60 transition-colors resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedRole}
                    className="px-5 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-black flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Application</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
