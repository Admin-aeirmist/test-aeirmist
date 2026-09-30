const fs = require('fs');
let code = fs.readFileSync('src/components/Messenger.tsx', 'utf8');

// Remove the sidebar-side restricted/blocked view injected earlier
// These patterns were: } else if (view === 'restricted') { ... } else if (view === 'blocked') { ... }
const leftSidePattern = /\} else if \(view === 'restricted'\) \{\s+return \(\s+<>\s+<div className="flex-1 overflow-hidden">\s+<RestrictedSection[\s\S]*?<\/>\s+\);\s+\} else if \(view === 'blocked'\) \{\s+return \(\s+<>\s+<div className="flex-1 overflow-hidden">\s+<BlockedSection[\s\S]*?<\/>\s+\);\s+\}/;

if (leftSidePattern.test(code)) {
  code = code.replace(leftSidePattern, '}');
  fs.writeFileSync('src/components/Messenger.tsx', code);
  console.log('Removed sidebar restricted/blocked views');
} else {
  console.log('Sidebar pattern not found - might already be cleaned');
}
