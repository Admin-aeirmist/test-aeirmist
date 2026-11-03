const fs = require('fs');
const path = require('path');

const edgePath = path.resolve('D:/Aeirmist/functions/api/[[route]].ts');
let code = fs.readFileSync(edgePath, 'utf8');

const oldLoginBlock = `    if (path === "/api/v1/auth/login" && method === "POST") {
    try {
      const body = await request.json() as any;
      const inputId = (body.email || body.identifier || "").toLowerCase().trim();
      
      const isOwner = inputId === "junaedislamjim180@gmail.com" || 
                      inputId === "junaed_islam_jim9" || 
                      inputId === "10000000001" ||
                      inputId === "admin.aeirmist@gmail.com";

      if (isOwner) {
        const user = defaultJunaedUser;
        const token = await createToken(user);
        tokensMap.set(token, user);
        return new Response(JSON.stringify({ 
          token, 
          refreshToken: "rf_" + Date.now(),
          user: user, 
          profile: user.profile 
        }), { status: 200, headers: CORS_HEADERS });
      }
    try {
      const body = await request.json() as any;
      const inputId = (body.email || body.identifier || "").toLowerCase().trim();`;

const newLoginBlock = `  if (path === "/api/v1/auth/login" && method === "POST") {
    try {
      const body = await request.json() as any;
      const inputId = (body.email || body.identifier || "").toLowerCase().trim();
      
      const isOwner = inputId === "junaedislamjim180@gmail.com" || 
                      inputId === "junaed_islam_jim9" || 
                      inputId === "10000000001" ||
                      inputId === "admin.aeirmist@gmail.com";

      if (isOwner) {
        const user = defaultJunaedUser;
        const token = await createToken(user);
        tokensMap.set(token, user);
        return new Response(JSON.stringify({ 
          token, 
          refreshToken: "rf_" + Date.now(),
          user: user, 
          profile: user.profile 
        }), { status: 200, headers: CORS_HEADERS });
      }`;

if (code.includes(oldLoginBlock)) {
  code = code.replace(oldLoginBlock, newLoginBlock);
  fs.writeFileSync(edgePath, code, 'utf8');
  console.log('✓ Cleaned up duplicate try in [[route]].ts');
} else {
  console.log('Old login block not matched directly, checking normalized line endings');
  const normalized = code.replace(/\r\n/g, '\n');
  const normOld = oldLoginBlock.replace(/\r\n/g, '\n');
  if (normalized.includes(normOld)) {
    const fixed = normalized.replace(normOld, newLoginBlock);
    fs.writeFileSync(edgePath, fixed, 'utf8');
    console.log('✓ Cleaned up duplicate try using normalized line endings');
  } else {
    console.log('Still not found');
  }
}
