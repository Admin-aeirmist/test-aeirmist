const fs = require('fs');
let code = fs.readFileSync('src/components/Messenger.tsx', 'utf8');

if (!code.includes('import { RestrictedSection }')) {
  code = code.replace(
    "import { CallHistorySection } from './messenger/CallHistorySection';", 
    "import { CallHistorySection } from './messenger/CallHistorySection';\nimport { RestrictedSection } from './messenger/RestrictedSection';\nimport { BlockedSection } from './messenger/BlockedSection';"
  );
}

code = code.replace(
  /const \[view, setView\] = useState<'chats' \| 'requests' \| 'history'>\('chats'\);/,
  "const [view, setView] = useState<'chats' | 'requests' | 'history' | 'restricted' | 'blocked'>('chats');"
);

const dropdownRegex = /<div className="px-3 py-2 border-b border-white\/5 mb-1\.5">[\s\S]*?<p className="text-\[8px\] font-black uppercase text-white\/30 tracking-widest">Connections Options<\/p>[\s\S]*?<\/div>[\s\S]*?<\/motion\.div>/;

const newDropdown = `<div className="px-3 py-2 border-b border-white/5 mb-1.5">
                            <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">Connections Options</p>
                          </div>
                          <button 
                            onClick={() => { setView('requests'); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <MessageSquare size={16} className="text-aeirmist-magenta" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Message Requests</p>
                            </div>
                          </button>

                          <button 
                            onClick={() => { setView('restricted'); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <Ghost size={16} className="text-[#00F2FF]" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Restrictions</p>
                            </div>
                          </button>

                          <button 
                            onClick={() => { setView('blocked'); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <ShieldAlert size={16} className="text-red-400" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Block Accounts</p>
                            </div>
                          </button>

                          <button 
                            onClick={() => { setView('history'); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <Phone size={16} className="text-aeirmist-lime" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Call History</p>
                            </div>
                          </button>
                        </motion.div>`;

code = code.replace(dropdownRegex, newDropdown);

const historyBlockEnd = "/>\n              </div>\n            </>\n          );\n        }";

if (!code.includes("if (view === 'restricted')")) {
  code = code.replace(historyBlockEnd, historyBlockEnd + ` else if (view === 'restricted') {
          return (
            <>
              <div className="flex-1 overflow-hidden">
                <RestrictedSection 
                  onBack={() => setView('chats')} 
                  onUserClick={handleVisitProfile}
                />
              </div>
            </>
          );
        } else if (view === 'blocked') {
          return (
            <>
              <div className="flex-1 overflow-hidden">
                <BlockedSection 
                  onBack={() => setView('chats')} 
                  onUserClick={handleVisitProfile}
                />
              </div>
            </>
          );
        }`);
}

// Make sure icons are imported
if (!code.includes('ShieldAlert')) {
  // `Ghost` and `ShieldAlert` might be needed
  code = code.replace(/import \{ ([^}]+) \} from 'lucide-react';/, "import { $1, ShieldAlert, Ghost, MessageSquare } from 'lucide-react';");
}

fs.writeFileSync('src/components/Messenger.tsx', code);
console.log('Messenger.tsx dropdown and views updated');
