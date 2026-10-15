import React from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface SecurityScoreProps {
  user: any;
  profile: any;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  sessionsCount: number;
  onActionClick: (actionKey: string) => void;
}

export const AccountSecurityScore: React.FC<SecurityScoreProps> = ({
  user,
  profile,
  hasPassword,
  twoFactorEnabled,
  sessionsCount,
  onActionClick
}) => {
  // Calculate security score
  const checks = [
    {
      key: 'email_verified',
      label: 'Verified Email Address',
      passed: !!user?.emailVerified,
      weight: 20,
      recommendation: 'Verify your primary email to protect account recovery.'
    },
    {
      key: 'password_set',
      label: 'Password Created',
      passed: !!hasPassword,
      weight: 20,
      recommendation: 'Create a direct password to enable multi-method login.'
    },
    {
      key: 'two_factor',
      label: 'Two-Factor Authentication Active',
      passed: !!twoFactorEnabled,
      weight: 20,
      recommendation: 'Enable 2FA backup codes to prevent unauthorized access.'
    },
    {
      key: 'recovery_set',
      label: 'Recovery Email / Phone Added',
      passed: !!(profile?.recoveryEmail || profile?.recoveryPhone),
      weight: 20,
      recommendation: 'Add a recovery email or phone number for account restoration.'
    },
    {
      key: 'devices_reviewed',
      label: 'Active Sessions Reviewed',
      passed: sessionsCount > 0,
      weight: 20,
      recommendation: 'Review your active devices and revoke unknown logins.'
    }
  ];

  const currentScore = checks.reduce((acc, curr) => acc + (curr.passed ? curr.weight : 0), 0);

  const getScoreColor = () => {
    if (currentScore >= 80) return 'text-[var(--color-aeirmist-cyan)] border-[var(--color-aeirmist-cyan)] shadow-[0_0_20px_rgba(0,242,255,0.2)]';
    if (currentScore >= 60) return 'text-amber-400 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.2)]';
    return 'text-red-400 border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.2)]';
  };

  const pendingRecommendations = checks.filter(c => !c.passed);

  return (
    <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-black/40 border-2 border-white/10 shrink-0">
            <span className="text-2xl font-black font-mono tracking-tight text-white">{currentScore}%</span>
            <div className={`absolute -inset-1 rounded-2xl border ${getScoreColor()} opacity-60 pointer-events-none`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Account Security Score</h3>
              <ShieldCheck className="text-[var(--color-aeirmist-cyan)] shrink-0" size={16} />
            </div>
            <p className="text-[11px] font-mono text-white/50 mt-1">
              {currentScore >= 80 ? 'Optimal Protection Standard' : currentScore >= 60 ? 'Moderate Security Level' : 'Action Recommended'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-white/70">
          <Sparkles className="text-[var(--color-aeirmist-cyan)]" size={14} />
          <span>{checks.filter(c => c.passed).length} of {checks.length} Checks Active</span>
        </div>
      </div>

      {/* Security Checklist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {checks.map((item) => (
          <div 
            key={item.key}
            className={`p-3.5 rounded-2xl border transition-all flex items-center gap-3 ${
              item.passed ? 'bg-emerald-500/[0.03] border-emerald-500/20 text-white' : 'bg-white/[0.01] border-white/5 text-white/40'
            }`}
          >
            {item.passed ? (
              <ShieldCheck className="text-[var(--color-aeirmist-cyan)] shrink-0" size={18} />
            ) : (
              <AlertCircle className="text-white/20 shrink-0" size={18} />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-bold ${item.passed ? 'text-white' : 'text-white/50'}`}>{item.label}</p>
              <span className="text-[9px] font-mono uppercase text-white/30">+{item.weight}% Score</span>
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic Action Recommendations */}
      {pendingRecommendations.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-400">Security Recommendations</h4>
          <div className="space-y-2">
            {pendingRecommendations.slice(0, 3).map((rec) => (
              <div 
                key={rec.key}
                onClick={() => onActionClick(rec.key)}
                className="p-3.5 rounded-2xl bg-amber-500/[0.05] border border-amber-500/20 flex items-center justify-between gap-3 hover:bg-amber-500/10 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle className="text-amber-400 shrink-0" size={16} />
                  <p className="text-xs font-medium text-amber-200/90 truncate">{rec.recommendation}</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-400 shrink-0">
                  <span>Fix Now</span>
                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
