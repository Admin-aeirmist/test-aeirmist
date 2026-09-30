const fs = require('fs');

let code = fs.readFileSync('src/components/Messenger.tsx', 'utf8');

// 1. Remove the early returns for requests and history around line 1060-1112
const earlyReturnRegex = /if \(view === 'requests'\) \{[\s\S]*?if \(view === 'history'\) \{[\s\S]*?\}\s+return \(/;

if (earlyReturnRegex.test(code)) {
  code = code.replace(earlyReturnRegex, 'return (');
  console.log('Successfully removed early returns for requests & history!');
} else {
  console.log('Could not match earlyReturnRegex, trying manual split...');
  const startIdx = code.indexOf("if (view === 'requests') {");
  const endMarker = "return (\r\n    <div \r\n      className={`flex w-full h-full";
  const endMarkerLF = "return (\n    <div \n      className={`flex w-full h-full";
  let endIdx = code.indexOf(endMarker, startIdx);
  if (endIdx === -1) endIdx = code.indexOf(endMarkerLF, startIdx);

  if (startIdx !== -1 && endIdx !== -1) {
    code = code.slice(0, startIdx) + code.slice(endIdx);
    console.log('Successfully sliced out early returns!');
  } else {
    console.log('Failed to find slice points:', { startIdx, endIdx });
  }
}

// 2. Update the dropdown buttons to also set setIsMobileList(false)
const oldButtons = `<button 
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
                            <p className="text-xs font-bold">Call History</p>
                          </button>`;

const newButtons = `<button 
                            onClick={() => { setView('requests'); setIsMobileList(false); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <MessageSquare size={16} className="text-aeirmist-magenta" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Message Requests</p>
                            </div>
                          </button>

                          <button 
                            onClick={() => { setView('restricted'); setIsMobileList(false); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <Ghost size={16} className="text-[#00F2FF]" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Restrictions</p>
                            </div>
                          </button>

                          <button 
                            onClick={() => { setView('blocked'); setIsMobileList(false); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <ShieldAlert size={16} className="text-red-400" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Block Accounts</p>
                            </div>
                          </button>

                          <button 
                            onClick={() => { setView('history'); setIsMobileList(false); setIsMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all text-left"
                          >
                            <Phone size={16} className="text-aeirmist-lime" />
                            <div className="flex-1">
                              <p className="text-xs font-bold">Call History</p>
                            </div>
                          </button>`;

// Normalize CRLF to replace accurately
const normOld = oldButtons.replace(/\r\n/g, '\n');
const normCode = code.replace(/\r\n/g, '\n');

if (normCode.includes(normOld)) {
  code = normCode.replace(normOld, newButtons.replace(/\r\n/g, '\n'));
  console.log('Successfully updated dropdown buttons with setIsMobileList(false)!');
} else {
  console.log('Dropdown buttons pattern not matched directly.');
}

// 3. Update the Right-hand Chat Window panel to prioritize view !== 'chats'
// Look for {currentChat ? ( in the right panel
const rightPanelRegex = /\{\/\* Chat Window \*\/\}\s+<div className=\{`\$\{isMobileList \? 'hidden md:flex' : 'flex'\}[\s\S]*?\{currentChat \? \(/;

const newRightPanelHeader = `{/* Chat Window */}
      <div className={\`\${isMobileList ? 'hidden md:flex' : 'flex'} \${vaultState.isOpen && !vaultState.activeVaultChatId ? 'hidden md:hidden' : 'flex-1'} flex-col bg-aeirmist-bg relative min-w-0 w-full max-w-full overflow-hidden\`}>
        {view === 'restricted' ? (
          <div className="flex-1 h-full overflow-hidden">
            <RestrictedSection 
              onBack={() => { setView('chats'); setIsMobileList(true); }} 
              onUserClick={onUserClick}
            />
          </div>
        ) : view === 'blocked' ? (
          <div className="flex-1 h-full overflow-hidden">
            <BlockedSection 
              onBack={() => { setView('chats'); setIsMobileList(true); }} 
              onUserClick={onUserClick}
            />
          </div>
        ) : view === 'history' ? (
          <div className="flex-1 h-full overflow-hidden">
            <CallHistorySection 
              onBack={() => { setView('chats'); setIsMobileList(true); }} 
              onRedial={async (pid, type) => {
                const profileDoc = await getDoc(doc(db, 'profiles', pid));
                if (profileDoc.exists()) {
                  handleUserClick({ id: pid, ...profileDoc.data() }, type);
                }
              }}
              onUserClick={onUserClick}
            />
          </div>
        ) : view === 'requests' ? (
          <div className="flex-1 h-full overflow-hidden">
            <RequestsSection 
              chats={requestChats} 
              onBack={() => { setView('chats'); setIsMobileList(true); }} 
              onUserClick={onUserClick} 
              onChatSelect={(id) => {
                setView('chats');
                setActiveChatId(id);
                setIsMobileList(false);
              }}
            />
          </div>
        ) : currentChat ? (`;

const normRightCode = code.replace(/\r\n/g, '\n');
if (rightPanelRegex.test(normRightCode)) {
  code = normRightCode.replace(rightPanelRegex, newRightPanelHeader);
  console.log('Successfully updated Right Panel to check view first!');
} else {
  console.log('Failed to match rightPanelRegex!');
}

// 4. Remove the old ternary branch in the empty state
// It had: ) : view === 'restricted' ? ( ... ) : view === 'blocked' ? ( ... ) : (
const oldTernaryBranchRegex = /\)\s*:\s*view === 'restricted'\s*\?\s*\([\s\S]*?view === 'blocked'\s*\?\s*\([\s\S]*?\)\s*:\s*\(/;

if (oldTernaryBranchRegex.test(code)) {
  code = code.replace(oldTernaryBranchRegex, ') : (');
  console.log('Successfully cleaned up old lower ternary branch!');
} else {
  console.log('Lower ternary branch not found or already clean.');
}

// Ensure RequestsSection is imported
if (!code.includes("import { RequestsSection }")) {
  code = "import { RequestsSection } from './messenger/RequestsSection';\n" + code;
  console.log('Added RequestsSection import');
}

fs.writeFileSync('src/components/Messenger.tsx', code);
console.log('Done writing updated Messenger.tsx!');
