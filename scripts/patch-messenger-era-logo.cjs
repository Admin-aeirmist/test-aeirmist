const fs = require('fs');
const path = require('path');

const messengerFile = path.join(__dirname, '../src/components/Messenger.tsx');
let messengerContent = fs.readFileSync(messengerFile, 'utf8');

// 1. Update LiveParticipantAvatar for Era AI
const oldAvatarPattern = /if \(participantId === '00000000-0000-4000-a000-000000000001' \|\| fallbackPhoto === 'ai:era_official'\) \{[\s\S]*?return \([\s\S]*?<div className=\{`w-full h-full bg-\[#0a0f1d\] flex items-center justify-center font-black text-cyan-300 text-xs \$\{innerRoundedClassName\}`\}>[\s\S]*?E[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?\);\s*\}/;

const newAvatarReplacement = `if (participantId === '00000000-0000-4000-a000-000000000001' || fallbackPhoto === 'ai:era_official') {
    return (
      <div className={\`relative flex items-center justify-center p-[2px] bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-500 \${sizeClassName} \${roundedClassName} shadow-[0_0_14px_rgba(0,255,255,0.45)]\`}>
        <div className={\`w-full h-full bg-[#0a0f1d] flex items-center justify-center overflow-hidden p-1.5 \${innerRoundedClassName}\`}>
          <img 
            src="/custom_uploaded_logo.png" 
            alt="Era AI" 
            className="w-full h-full object-contain"
          />
        </div>
        <span className="absolute -bottom-1 -right-1 px-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-[7px] font-black rounded-md border border-black shadow">
          AI
        </span>
      </div>
    );
  }`;

if (!oldAvatarPattern.test(messengerContent)) {
  console.error("oldAvatarPattern did not match in Messenger.tsx");
  process.exit(1);
}
messengerContent = messengerContent.replace(oldAvatarPattern, newAvatarReplacement);

// 2. Remove the Marketplace filter button
const oldMarketplaceFilterPattern = /<button\s+onClick=\{\(\) => setActiveFilter\('marketplace'\)\}[\s\S]*?Marketplace\s*<\/button>/;
if (!oldMarketplaceFilterPattern.test(messengerContent)) {
  console.error("oldMarketplaceFilterPattern did not match in Messenger.tsx");
  process.exit(1);
}
messengerContent = messengerContent.replace(oldMarketplaceFilterPattern, '');

// 3. Update starter card avatar (if rendered)
const oldStarterAvatarPattern = /<div className="w-full h-full bg-\[#0a0f1d\] rounded-\[14px\] flex items-center justify-center font-black text-cyan-300 text-sm tracking-wider">\s*E\s*<\/div>/;
if (oldStarterAvatarPattern.test(messengerContent)) {
  messengerContent = messengerContent.replace(
    oldStarterAvatarPattern,
    `<div className="w-full h-full bg-[#0a0f1d] rounded-[14px] flex items-center justify-center overflow-hidden p-1.5">
                          <img src="/custom_uploaded_logo.png" alt="Era AI" className="w-full h-full object-contain" />
                        </div>`
  );
}

// 4. Update fallback photo in handleStartEraChat
messengerContent = messengerContent.replace(
  /username: 'era',\s*photo: '',/,
  `username: 'era',\n        photo: '/custom_uploaded_logo.png',`
);

fs.writeFileSync(messengerFile, messengerContent, 'utf8');
console.log("Successfully updated Messenger.tsx with Aeirmist logo for Era and removed Marketplace filter button!");

// 5. Update Avatar.tsx
const avatarFile = path.join(__dirname, '../src/components/ui/Avatar.tsx');
let avatarContent = fs.readFileSync(avatarFile, 'utf8');

const avatarEraCheck = `  if (userId === '00000000-0000-4000-a000-000000000001' || src === 'ai:era_official' || alt === 'Era AI') {
    return (
      <div 
        onClick={onClick}
        className={\`relative select-none flex items-center justify-center p-[2px] bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-500 shadow-[0_0_14px_rgba(0,255,255,0.45)] \${sizeClassName} \${roundedClassName} \${className} \${onClick ? 'cursor-pointer active:scale-95' : ''}\`}
      >
        <div className={\`w-full h-full \${innerRoundedClassName} bg-[#0a0f1d] flex items-center justify-center overflow-hidden p-1.5\`}>
          <img 
            src="/custom_uploaded_logo.png" 
            alt="Era AI" 
            className="w-full h-full object-contain"
          />
        </div>
        <span className="absolute -bottom-1 -right-1 px-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-[7px] font-black rounded-md border border-black shadow">
          AI
        </span>
      </div>
    );
  }

  const finalAvatarUrl = getAvatarUrl(src);`;

if (!avatarContent.includes("userId === '00000000-0000-4000-a000-000000000001'")) {
  avatarContent = avatarContent.replace('  const finalAvatarUrl = getAvatarUrl(src);', avatarEraCheck);
  fs.writeFileSync(avatarFile, avatarContent, 'utf8');
  console.log("Successfully updated Avatar.tsx to support Era AI Aeirmist logo globally!");
}
