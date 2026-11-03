const fs = require('fs');
let code = fs.readFileSync('D:/Aeirmist/backend/src/routes/admin.routes.ts', 'utf8');

code = code.replace(
  /select\(\{([\r\n\s]+)id: users\.id,/,
  'select({$1id: users.id,$1accountId: users.accountId,'
);

fs.writeFileSync('D:/Aeirmist/backend/src/routes/admin.routes.ts', code, 'utf8');
console.log('admin.routes.ts updated with accountId');
