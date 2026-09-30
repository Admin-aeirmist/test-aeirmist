const fs = require('fs');
let code = fs.readFileSync('src/components/Messenger.tsx', 'utf8');

code = code.replace("setView('requests'); setIsMoreMenuOpen(false);", "setView('requests'); setIsMobileList(false); setIsMoreMenuOpen(false);");
code = code.replace("setView('restricted'); setIsMoreMenuOpen(false);", "setView('restricted'); setIsMobileList(false); setIsMoreMenuOpen(false);");
code = code.replace("setView('blocked'); setIsMoreMenuOpen(false);", "setView('blocked'); setIsMobileList(false); setIsMoreMenuOpen(false);");
code = code.replace("setView('history'); setIsMoreMenuOpen(false);", "setView('history'); setIsMobileList(false); setIsMoreMenuOpen(false);");

fs.writeFileSync('src/components/Messenger.tsx', code);
console.log('Successfully updated dropdown click handlers with setIsMobileList(false)!');
