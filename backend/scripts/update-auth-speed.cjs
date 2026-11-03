const fs = require('fs');
let code = fs.readFileSync('D:/Aeirmist/backend/src/routes/auth.routes.ts', 'utf8');

// Replace blocking sendOtpEmail in login 2FA
code = code.replace(
  /await sendOtpEmail\(user\.email, otp, 'login'\);/,
  `sendOtpEmail(user.email, otp, 'login').catch(e => console.warn('[2FA Email dispatch notice]:', e?.message || e));`
);

fs.writeFileSync('D:/Aeirmist/backend/src/routes/auth.routes.ts', code, 'utf8');
console.log('auth.routes.ts updated: sendOtpEmail is now non-blocking for sub-100ms response time');
