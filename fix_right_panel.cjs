const fs = require('fs');
let code = fs.readFileSync('src/components/Messenger.tsx', 'utf8');

// The pattern uses \r\n (Windows line endings)
const old_str = ') : (\r\n          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-aeirmist-bg relative overflow-hidden">';

const new_str = `) : view === 'restricted' ? (\r\n          <div className="flex-1 h-full overflow-hidden">\r\n            <RestrictedSection \r\n              onBack={() => setView('chats')} \r\n              onUserClick={onUserClick}\r\n            />\r\n          </div>\r\n        ) : view === 'blocked' ? (\r\n          <div className="flex-1 h-full overflow-hidden">\r\n            <BlockedSection \r\n              onBack={() => setView('chats')} \r\n              onUserClick={onUserClick}\r\n            />\r\n          </div>\r\n        ) : (\r\n          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-aeirmist-bg relative overflow-hidden">`;

if (code.includes(old_str)) {
  code = code.replace(old_str, new_str);
  fs.writeFileSync('src/components/Messenger.tsx', code);
  console.log('SUCCESS: Injected restricted/blocked full-screen views in right panel');
} else {
  console.log('Pattern not found! Trying alternative...');
  // Check what the actual text is
  const idx = code.indexOf('flex-1 flex flex-col items-center justify-center p-8 text-center bg-aeirmist-bg');
  const snippet = code.substring(idx - 30, idx + 5);
  console.log('Actual snippet:', JSON.stringify(snippet));
}
