const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/Messenger.tsx');
let content = fs.readFileSync(file, 'utf8');

const targetRegex = /\{\/\* META AI-STYLE PINNED ERA AI ASSISTANT CONTACT \*\/\}[\s\S]*?\{\/\* Info \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*\)\}/;

const replacement = `{/* ERA AI ASSISTANT CONTACT (Only shown if no existing Era chat in list) */}
              {(() => {
                const hasExistingEraChat = chats.some(c => 
                  c.otherParticipantId === '00000000-0000-4000-a000-000000000001' || 
                  c.otherParticipantUid === '00000000-0000-4000-a000-000000000001' ||
                  c.otherProfile?.username === 'era' ||
                  c.otherProfile?.displayName === 'Era AI' ||
                  c.name === 'Era AI' ||
                  c.displayName === 'Era AI'
                );

                if (hasExistingEraChat || (activeFilter !== 'all' && activeFilter !== 'personal') || searchQuery.trim()) {
                  return null;
                }

                return (
                  <div 
                    role="button"
                    tabIndex={0}
                    onClick={() => handleStartEraChat()}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartEraChat()}
                    style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                    className={\`w-full h-[74px] px-3.5 md:px-4 flex items-center gap-3 cursor-pointer hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-blue-500/10 transition-all relative border-b border-white/5 group \${
                      currentChat?.otherParticipantId === '00000000-0000-4000-a000-000000000001' 
                        ? 'bg-cyan-500/[0.12] border-cyan-500/30' 
                        : 'bg-gradient-to-r from-cyan-500/[0.04] to-blue-600/[0.02]'
                    }\`}
                  >
                    {/* Holographic Neon Ring Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-2xl p-[2px] bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-500 shadow-[0_0_14px_rgba(0,255,255,0.35)] group-hover:shadow-[0_0_20px_rgba(0,255,255,0.6)] transition-all">
                        <div className="w-full h-full bg-[#0a0f1d] rounded-[14px] flex items-center justify-center font-black text-cyan-300 text-sm tracking-wider">
                          E
                        </div>
                      </div>
                      <span className="absolute -bottom-1 -right-1 px-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-[7px] font-black rounded-md border border-black shadow">
                        AI
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="text-[13px] md:text-[14px] font-bold text-white truncate flex items-center gap-1">
                            <span>Era</span>
                            <span className="px-1.5 py-0.2 rounded text-[8px] bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                              Assistant
                            </span>
                          </h3>
                        </div>
                      </div>
                      <p className="text-[11px] text-white/50 truncate mt-0.5">
                        Ask questions, brainstorm, or automate your business...
                      </p>
                    </div>
                  </div>
                );
              })()}`;

if (!targetRegex.test(content)) {
  console.error("Target regex not matched in Messenger.tsx");
  process.exit(1);
}

const updated = content.replace(targetRegex, replacement);
fs.writeFileSync(file, updated, 'utf8');
console.log("Successfully patched Messenger.tsx to remove Meta-AI and eliminate double Era inbox!");
