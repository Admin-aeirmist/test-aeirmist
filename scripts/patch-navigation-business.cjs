const fs = require('fs');
const path = 'D:/Aeirmist/src/components/Navigation.tsx';
let content = fs.readFileSync(path, 'utf8');

const isCRLF = content.includes('\r\n');
if (isCRLF) content = content.replace(/\r\n/g, '\n');

const target = `                    <a
                      href="/business"
                      onClick={() => setIsMoreMenuOpen(false)}
                      className={\`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors w-full text-left text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10\`}
                    >
                      <Briefcase size={17} className="text-cyan-400" />
                      <div className="flex items-center gap-1.5">
                        <span>Business Suite</span>
                        <span className="px-1.5 py-0.2 rounded text-[8px] bg-cyan-400 text-black font-black">ERA AI</span>
                      </div>
                    </a>`;

const replacement = `                    {/* Business Suite - Exclusively for Public & Professional accounts */}
                    {(!profile?.isPrivate && !profile?.privacySettings?.privateProfile && profile?.isProfessional) && (
                      <a
                        href="/business"
                        onClick={() => setIsMoreMenuOpen(false)}
                        className={\`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors w-full text-left text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10\`}
                      >
                        <Briefcase size={17} className="text-cyan-400" />
                        <div className="flex items-center gap-1.5">
                          <span>Business Suite</span>
                          <span className="px-1.5 py-0.2 rounded text-[8px] bg-cyan-400 text-black font-black">ERA AI</span>
                        </div>
                      </a>
                    )}`;

if (!content.includes(target)) {
  console.error('Target not found in Navigation.tsx!');
  process.exit(1);
}

content = content.replace(target, replacement);
if (isCRLF) content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(path, content, 'utf8');
console.log('Navigation.tsx successfully patched with professional/public condition.');
