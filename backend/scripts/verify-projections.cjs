const fs = require('fs');
let code = fs.readFileSync('D:/Aeirmist/backend/src/dal/user.dal.ts', 'utf8');

// Ensure all select({ ... }) from profiles include accountId: profiles.accountId
code = code.replace(
  /select\(\{([\r\n\s]+)id: profiles\.id,([\r\n\s]+)userId: profiles\.userId,/g,
  'select({$1id: profiles.id,$1accountId: profiles.accountId,$2userId: profiles.userId,'
);

fs.writeFileSync('D:/Aeirmist/backend/src/dal/user.dal.ts', code, 'utf8');
console.log('Verified all profile projections include accountId');
