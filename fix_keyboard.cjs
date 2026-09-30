const fs = require('fs');

let code = fs.readFileSync('src/components/Messenger.tsx', 'utf8');

const messengerKeyboardRegex = /const updateHeight = \(\) => \{\s+const isMobile = window\.innerWidth < 768;\s+const keyboardActive = isMobile && \(window\.innerHeight - vc\.height > 120\);/g;
code = code.replace(messengerKeyboardRegex, 'let maxVH = window.innerHeight;\n    const updateHeight = () => {\n      const isMobile = window.innerWidth < 768;\n      if (window.innerHeight > maxVH) maxVH = window.innerHeight;\n      const heightDiff = maxVH - Math.min(window.innerHeight, vc.height);\n      const keyboardActive = isMobile && (heightDiff > 120);');

const chatWindowKeyboardRegex = /const checkKeyboard = \(\) => \{\s+if \(window\.visualViewport\) \{\s+const heightDiff = window\.innerHeight - window\.visualViewport\.height;\s+setIsKeyboardOpen\(heightDiff > 120\);\s+\}\s+\};/g;
code = code.replace(chatWindowKeyboardRegex, 'let maxVH = window.innerHeight;\n    const checkKeyboard = () => {\n      if (window.innerHeight > maxVH) maxVH = window.innerHeight;\n      const heightDiff = maxVH - Math.min(window.innerHeight, window.visualViewport?.height || window.innerHeight);\n      setIsKeyboardOpen(heightDiff > 120);\n    };');

fs.writeFileSync('src/components/Messenger.tsx', code);
console.log('Fixed keyboard detection in Messenger.tsx');
