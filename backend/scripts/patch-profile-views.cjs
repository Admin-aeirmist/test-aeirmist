const fs = require('fs');

// 1. ProfileSystem.tsx
let pCode = fs.readFileSync('D:/Aeirmist/src/components/profile/ProfileSystem.tsx', 'utf8');

// Target key resolution with 11-digit accountId and stripping profile_
const oldTargetKey = `    const targetKey = targetProfile?.username || targetProfile?.id || targetProfile?.uid || profile?.username || profile?.id;
    if (!targetKey) {
      return;
    }`;

const newTargetKey = `    const rawKey = targetProfile?.accountId || 
      targetProfile?.username || 
      (targetProfile?.id && !String(targetProfile.id).startsWith('profile_') ? targetProfile.id : null) || 
      profile?.accountId || 
      profile?.username || 
      (profile?.id && !String(profile.id).startsWith('profile_') ? profile.id : null) || 
      targetProfile?.id || 
      profile?.id;
    if (!rawKey) return;
    const targetKey = String(rawKey).replace(/^profile_/, '').trim();`;

if (pCode.includes('const targetKey = targetProfile?.username || targetProfile?.id')) {
  pCode = pCode.replace(oldTargetKey, newTargetKey);
}

// Map accountId into live profile
pCode = pCode.replace(
  /const mapped = \{\s*\.\.\.p,\s*id: p\.id,/,
  `const mapped = {
          ...p,
          id: p.id,
          accountId: p.accountId || (p.userId === profile?.userId ? profile?.accountId : null),`
);

// Remove the force_logout on error
const oldCatch = `      .catch((err: any) => {
        if (isOwnProfile && (err?.status === 404 || err?.status === 401)) {
          logger.warn('[ProfileSystem] Own profile returned 404/401 from backend. Account has been deleted.');
          window.dispatchEvent(new CustomEvent('aeirmist:force_logout', { detail: { reason: 'account_deleted' } }));
        }
      });`;

const newCatch = `      .catch((err: any) => {
        logger.warn('[ProfileSystem] Live profile fetch note:', err);
      });`;

if (pCode.includes('window.dispatchEvent(new CustomEvent(\'aeirmist:force_logout\', { detail: { reason: \'account_deleted\' } }));')) {
  pCode = pCode.replace(oldCatch, newCatch);
}

// Add Account ID badge in mobile profile header
const oldMobileUname = `              <p className="text-[10px] font-mono font-bold text-aeirmist-cyan tracking-widest leading-none pl-0.5 pb-0.5">
                @{displayUser?.username || "junaed"}
              </p>`;

const newMobileUname = `              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] font-mono font-bold text-aeirmist-cyan tracking-widest leading-none pl-0.5 pb-0.5">
                  @{displayUser?.username || "user"}
                </p>
                {displayUser?.accountId && (
                  <span 
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(displayUser.accountId);
                        addToast?.({ title: "Account ID Copied", message: \`ID: \${displayUser.accountId}\`, type: "success" });
                      }
                    }}
                    title="11-digit Account ID (click to copy)"
                    className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-aeirmist-cyan hover:border-aeirmist-cyan/30 transition-all cursor-pointer flex items-center gap-1 select-none"
                  >
                    <span className="text-white/30">ID:</span>
                    <span className="font-bold text-white/90">{displayUser.accountId}</span>
                  </span>
                )}
              </div>`;

if (pCode.includes('displayUser?.username || "junaed"')) {
  pCode = pCode.replace(oldMobileUname, newMobileUname);
}

fs.writeFileSync('D:/Aeirmist/src/components/profile/ProfileSystem.tsx', pCode, 'utf8');
console.log('ProfileSystem.tsx updated: force_logout removed & accountId added!');

// 2. DesktopProfileLayout.tsx
let dCode = fs.readFileSync('D:/Aeirmist/src/components/profile/DesktopProfileLayout.tsx', 'utf8');

const oldDesktopUname = `              {displayUser?.username && (
                <p className="text-[11px] font-mono font-bold text-aeirmist-cyan tracking-widest mt-1">
                  @{displayUser.username}
                </p>
              )}`;

const newDesktopUname = `              <div className="flex items-center gap-2 mt-1 justify-center lg:justify-start flex-wrap">
                {displayUser?.username && (
                  <p className="text-[11px] font-mono font-bold text-aeirmist-cyan tracking-widest">
                    @{displayUser.username}
                  </p>
                )}
                {displayUser?.accountId && (
                  <span 
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(displayUser.accountId);
                      }
                    }}
                    title="11-digit Account ID (click to copy)"
                    className="text-[9px] font-mono px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-aeirmist-cyan hover:border-aeirmist-cyan/30 transition-all cursor-pointer flex items-center gap-1 select-none"
                  >
                    <span className="text-white/30">ID:</span>
                    <span className="font-bold text-white/90">{displayUser.accountId}</span>
                  </span>
                )}
              </div>`;

if (dCode.includes('@{displayUser.username}')) {
  dCode = dCode.replace(oldDesktopUname, newDesktopUname);
  fs.writeFileSync('D:/Aeirmist/src/components/profile/DesktopProfileLayout.tsx', dCode, 'utf8');
  console.log('DesktopProfileLayout.tsx updated with 11-digit accountId badge!');
}
