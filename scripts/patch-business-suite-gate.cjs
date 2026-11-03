const fs = require('fs');

const path = 'D:/Aeirmist/src/components/business/AeirmistBusinessSuite.tsx';
let content = fs.readFileSync(path, 'utf8');

const isCRLF = content.includes('\r\n');
if (isCRLF) {
  content = content.replace(/\r\n/g, '\n');
}

// 1. Hook update in AeirmistBusinessSuite
const hookTarget = `export const AeirmistBusinessSuite: React.FC<{ isStandalone?: boolean }> = ({ isStandalone = true }) => {
  const { user, profile, addToast } = useAeirmist();`;

const hookReplacement = `export const AeirmistBusinessSuite: React.FC<{ isStandalone?: boolean }> = ({ isStandalone = true }) => {
  const { user, profile, addToast, updateProfile } = useAeirmist();

  // --- ACCESS CONTROL GATE: Public ID & Professional Account Requirement ---
  const isPrivate = !!profile?.isPrivate || !!profile?.privacySettings?.privateProfile || !!profile?.privacySettings?.privateAccount;
  const isProfessional = !!profile?.isProfessional;
  const isAuthorized = !isPrivate && isProfessional;

  const [isUpgradingAccount, setIsUpgradingAccount] = useState(false);

  const handleActivateProfessionalAccount = async () => {
    setIsUpgradingAccount(true);
    try {
      await updateProfile({
        isProfessional: true,
        isPrivate: false,
        privacySettings: {
          ...(profile?.privacySettings || {}),
          privateProfile: false,
          privateAccount: false
        }
      });
      addToast({
        title: 'Professional Account Activated',
        message: 'Your account is now Public and ready for Aeirmist Business Suite & Era AI.',
        type: 'success'
      });
    } catch (err: any) {
      addToast({
        title: 'Activation Failed',
        message: 'Could not activate professional mode. Please check Settings.',
        type: 'warning'
      });
    } finally {
      setIsUpgradingAccount(false);
    }
  };`;

if (!content.includes(hookTarget)) {
  console.error('hookTarget not found!');
  process.exit(1);
}
content = content.replace(hookTarget, hookReplacement);

// 2. Gate View insertion before main dashboard container
const returnTarget = `  return (
    <div className={\`w-full bg-[#0a0d14] text-[#e4e6eb] font-sans antialiased flex flex-col \${
      isStandalone ? 'min-h-screen' : 'min-h-[700px] rounded-2xl border border-white/10 overflow-hidden shadow-2xl'
    }\`}>
      {/* 1. TOP META BUSINESS SUITE HEADER */}`;

const returnReplacement = `  // --- ACCESS DENIED / ONBOARDING GATE VIEW ---
  if (!isAuthorized) {
    return (
      <div className={\`w-full bg-[#0a0d14] text-[#e4e6eb] font-sans antialiased flex flex-col items-center justify-center p-6 \${
        isStandalone ? 'min-h-screen' : 'min-h-[700px] rounded-2xl border border-white/10'
      }\`}>
        <div className="max-w-md w-full bg-[#111624] border border-[#252b3d] rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Subtle Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-emerald-500 flex items-center justify-center text-white mx-auto mb-6 shadow-[0_0_30px_rgba(0,242,255,0.3)]">
            <Briefcase size={28} />
          </div>

          <h2 className="text-xl font-black uppercase tracking-wider text-white mb-2">
            Professional Account Required
          </h2>
          <p className="text-xs text-white/60 leading-relaxed mb-6">
            Aeirmist Business Suite is exclusively available for <span className="text-cyan-400 font-bold">Public IDs</span> with an active <span className="text-emerald-400 font-bold">Professional Account</span>.
          </p>

          {/* Diagnostic Status Box */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3 mb-6 text-left">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white/50">Account Visibility:</span>
              <span className={\`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase border \${
                !isPrivate
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }\`}>
                {!isPrivate ? 'Public (Verified)' : 'Private (Restricted)'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white/50">Professional Mode:</span>
              <span className={\`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase border \${
                isProfessional
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }\`}>
                {isProfessional ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleActivateProfessionalAccount}
              disabled={isUpgradingAccount}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isUpgradingAccount ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>Activating Account...</span>
                </>
              ) : (
                <>
                  <Zap size={16} />
                  <span>Switch to Public Professional</span>
                </>
              )}
            </button>

            <a
              href="/"
              className="block w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs uppercase tracking-wider transition-all"
            >
              Return to Feed
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={\`w-full bg-[#0a0d14] text-[#e4e6eb] font-sans antialiased flex flex-col \${
      isStandalone ? 'min-h-screen' : 'min-h-[700px] rounded-2xl border border-white/10 overflow-hidden shadow-2xl'
    }\`}>
      {/* 1. TOP META BUSINESS SUITE HEADER */}`;

if (!content.includes(returnTarget)) {
  console.error('returnTarget not found!');
  process.exit(1);
}
content = content.replace(returnTarget, returnReplacement);

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(path, content, 'utf8');
console.log('AeirmistBusinessSuite Gate successfully inserted.');
