const fs = require('fs');
let code = fs.readFileSync('D:/Aeirmist/src/App.tsx', 'utf8');

// 1. In getPathForAppState
const oldProfilePath = `  if (tab === 'profile') {
    if (vProfile?.username) return \`/@\${vProfile.username}\`;
    if (vProfile?.id) return \`/profile/\${vProfile.id}\`;
    return '/profile';
  }`;

const newProfilePath = `  if (tab === 'profile') {
    const accId = vProfile?.accountId || (vProfile?.id && /^\\d{11}$/.test(vProfile.id) ? vProfile.id : null);
    if (accId) {
      if (vProfile?.username && vProfile.username !== 'user' && vProfile.username !== 'unknown') {
        return \`/profile/\${accId}_\${vProfile.username}\`;
      }
      return \`/profile/\${accId}\`;
    }
    if (vProfile?.username && vProfile.username !== 'user') return \`/@\${vProfile.username}\`;
    if (vProfile?.id) return \`/profile/\${vProfile.id}\`;
    return '/profile';
  }`;

if (code.includes("if (vProfile?.username) return `/@${vProfile.username}`;")) {
  code = code.replace(oldProfilePath, newProfilePath);
  console.log('App.tsx: getPathForAppState updated with 11-digit account ID!');
}

// 2. In getInitialStateFromPath
const oldProfileInit = `  // 7. Profiles
  if (lowerPath.startsWith('/@') || lowerPath.startsWith('/u/') || lowerPath.startsWith('/profile/')) {`;

const newProfileInit = `  // Facebook-style direct 11-digit Account ID: /10000000001 or /10000000001_username
  const direct11DigitMatch = cleanPath.match(/^\\/(\\d{11})(?:[_-].*)?$/);
  if (direct11DigitMatch) {
    const accId = direct11DigitMatch[1];
    return { tab: 'profile' as Tab, notifs: false, username: null, userId: accId };
  }

  // 7. Profiles
  if (lowerPath.startsWith('/@') || lowerPath.startsWith('/u/') || lowerPath.startsWith('/profile/')) {`;

if (!code.includes('direct11DigitMatch')) {
  code = code.replace(oldProfileInit, newProfileInit);
  console.log('App.tsx: getInitialStateFromPath updated with direct 11-digit matching!');
}

// 3. In isSharedUrl
code = code.replace(
  /location\.pathname\.startsWith\('\/profile\/'\) \|\|/,
  `location.pathname.startsWith('/profile/') ||
    /^\\/\\d{11}/.test(location.pathname) ||`
);

fs.writeFileSync('D:/Aeirmist/src/App.tsx', code, 'utf8');
console.log('App.tsx updated successfully!');
