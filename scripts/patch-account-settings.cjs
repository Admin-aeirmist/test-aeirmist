const fs = require('fs');

const path = 'D:/Aeirmist/src/components/settings/sections/AccountSettings.tsx';
let content = fs.readFileSync(path, 'utf8');

// Normalize CRLF to LF for reliable matching
const isCRLF = content.includes('\r\n');
if (isCRLF) {
  content = content.replace(/\r\n/g, '\n');
}

const target = `            {/* ACCOUNT TYPE BADGE */}
            <div className="flex items-center justify-between mt-4 px-1">
              <span className={\`text-[10px] uppercase tracking-wider font-bold \${isLight ? 'text-slate-600' : 'text-white/70'}\`}>Account Visibility</span>
              <span className={\`text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border \${
                formData.privacySettings?.privateProfile 
                  ? 'bg-aeirmist-magenta/10 border-aeirmist-magenta/30 text-aeirmist-magenta' 
                  : 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan'
              }\`}>
                {formData.privacySettings?.privateProfile ? 'Private' : 'Public'}
              </span>
            </div>`;

const replacement = `            {/* ACCOUNT TYPE & PROFESSIONAL BADGES */}
            <div className="flex items-center justify-between mt-4 px-1">
              <span className={\`text-[10px] uppercase tracking-wider font-bold \${isLight ? 'text-slate-600' : 'text-white/70'}\`}>Account Visibility</span>
              <span className={\`text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border \${
                formData.privacySettings?.privateProfile || formData.isPrivate
                  ? 'bg-aeirmist-magenta/10 border-aeirmist-magenta/30 text-aeirmist-magenta' 
                  : 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-aeirmist-cyan'
              }\`}>
                {formData.privacySettings?.privateProfile || formData.isPrivate ? 'Private' : 'Public'}
              </span>
            </div>

            <div className="flex items-center justify-between mt-2 px-1">
              <span className={\`text-[10px] uppercase tracking-wider font-bold \${isLight ? 'text-slate-600' : 'text-white/70'}\`}>Account Type</span>
              <span className={\`text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border \${
                formData.isProfessional
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-white/5 border-white/10 text-white/60'
              }\`}>
                {formData.isProfessional ? 'Professional' : 'Personal'}
              </span>
            </div>`;

if (!content.includes(target)) {
  console.error('Target not found in normalized content!');
  process.exit(1);
}

content = content.replace(target, replacement);

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(path, content, 'utf8');
console.log('AccountSettings badges successfully patched.');
