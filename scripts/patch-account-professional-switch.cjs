const fs = require('fs');

const path = 'D:/Aeirmist/src/components/settings/sections/AccountSettings.tsx';
let content = fs.readFileSync(path, 'utf8');

const isCRLF = content.includes('\r\n');
if (isCRLF) {
  content = content.replace(/\r\n/g, '\n');
}

const target = `              {/* Category Dropdown */}
              <div className="space-y-2">
                <label className={\`text-xs font-bold uppercase tracking-wider ml-1 \${isLight ? 'text-slate-800' : 'text-white/90'}\`}>Category</label>
                <div className="relative">
                  <Tag className={\`absolute left-4 top-1/2 -translate-y-1/2 \${isLight ? 'text-slate-500' : 'text-white/60'}\`} size={15} />
                  <select
                    value={formData.category || ''}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    className={\`w-full h-12 pl-11 pr-4 rounded-xl text-xs font-medium focus:border-aeirmist-cyan focus:outline-none transition-all appearance-none cursor-pointer \${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900'
                        : 'bg-slate-800/90 border border-slate-600 text-white'
                    }\`}
                  >
                    <option value="" className={isLight ? 'bg-white' : 'bg-slate-900'}>Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className={isLight ? 'bg-white' : 'bg-slate-900'}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>`;

const replacement = `              {/* Category Dropdown */}
              <div className="space-y-2">
                <label className={\`text-xs font-bold uppercase tracking-wider ml-1 \${isLight ? 'text-slate-800' : 'text-white/90'}\`}>Category</label>
                <div className="relative">
                  <Tag className={\`absolute left-4 top-1/2 -translate-y-1/2 \${isLight ? 'text-slate-500' : 'text-white/60'}\`} size={15} />
                  <select
                    value={formData.category || ''}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    className={\`w-full h-12 pl-11 pr-4 rounded-xl text-xs font-medium focus:border-aeirmist-cyan focus:outline-none transition-all appearance-none cursor-pointer \${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900'
                        : 'bg-slate-800/90 border border-slate-600 text-white'
                    }\`}
                  >
                    <option value="" className={isLight ? 'bg-white' : 'bg-slate-900'}>Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className={isLight ? 'bg-white' : 'bg-slate-900'}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PROFESSIONAL ACCOUNT TOGGLE SWITCH */}
              <div className={\`p-4 rounded-2xl border transition-all \${
                formData.isProfessional 
                  ? 'bg-emerald-500/5 border-emerald-500/20' 
                  : isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/50 border-white/5'
              }\`}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Briefcase size={15} className={formData.isProfessional ? 'text-emerald-400' : 'text-cyan-400'} />
                      <h4 className={\`text-xs font-black uppercase tracking-wider \${isLight ? 'text-slate-900' : 'text-white'}\`}>
                        Professional Account
                      </h4>
                      <span className={\`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border \${
                        formData.isProfessional
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-white/5 border-white/10 text-white/50'
                      }\`}>
                        {formData.isProfessional ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>
                    <p className={\`text-[11px] max-w-md \${isLight ? 'text-slate-600' : 'text-white/60'}\`}>
                      Unlock Aeirmist Business Suite, Era AI Sales &amp; Inbox Bot, Marketplace Commerce store, and unified creator analytics.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !formData.isProfessional;
                      handleFieldChange('isProfessional', nextState);
                      // If enabling professional, also ensure account is public
                      if (nextState) {
                        handleFieldChange('isPrivate', false);
                        handleFieldChange('privacySettings', {
                          ...(formData.privacySettings || {}),
                          privateProfile: false,
                          privateAccount: false
                        });
                      }
                    }}
                    className={\`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer \${
                      formData.isProfessional
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/20'
                        : 'bg-cyan-500 hover:bg-cyan-600 text-black shadow-lg shadow-cyan-500/20'
                    }\`}
                  >
                    {formData.isProfessional ? 'Switch to Personal' : 'Switch to Professional'}
                  </button>
                </div>
              </div>`;

if (!content.includes(target)) {
  console.error('Target not found for Category Dropdown!');
  process.exit(1);
}

content = content.replace(target, replacement);

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(path, content, 'utf8');
console.log('AccountSettings Professional Switch patched successfully.');
