const fs = require('fs');
let code = fs.readFileSync('D:/Aeirmist/src/components/admin/AdminPanel.tsx', 'utf8');

// 1. In filteredUsers search:
code = code.replace(
  /u\.id\?\.toLowerCase\(\)\.includes\(searchQuery\.toLowerCase\(\)\) \|\|/,
  `u.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.accountId?.toLowerCase().includes(searchQuery.toLowerCase()) ||`
);

// 2. On user card list:
const oldCardMeta = `                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[9px] font-mono text-white/40 uppercase">UID: {u.uid ? \`\${u.uid.slice(0, 12)}...\` : 'UNKNOWN'}</p>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <p className="text-[9px] font-mono text-white/40 uppercase">Level: {u.aeirmistLevel || 0} AP</p>
                  </div>`;

const newCardMeta = `                  <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                    {u.accountId && (
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan tracking-wider">
                        ID: {u.accountId}
                      </span>
                    )}
                    <p className="text-[9px] font-mono text-white/40 uppercase">UID: {u.uid ? \`\${u.uid.slice(0, 10)}...\` : u.id ? \`\${u.id.slice(0, 10)}...\` : 'UNKNOWN'}</p>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <p className="text-[9px] font-mono text-white/40 uppercase">Level: {u.aeirmistLevel || 0} AP</p>
                  </div>`;

if (code.includes('UID: {u.uid ? `${u.uid.slice(0, 12)}...` : \'UNKNOWN\'}')) {
  code = code.replace(oldCardMeta, newCardMeta);
  console.log('AdminPanel: user card updated with 11-digit accountId badge!');
}

// 3. In Header of User Verification Modal (line 702):
code = code.replace(
  /<p className="text-xs font-mono text-white\/50">@\{user\.username \|\| 'user'\} • UID: \{user\.uid \? `\$\{user\.uid\.slice\(0, 10\)\}\.\.\.` : 'N\/A'\}<\/p>/,
  `<p className="text-xs font-mono text-white/50">@{user.username || 'user'}{user.accountId ? \` • ID: \${user.accountId}\` : ''} • UID: {user.uid ? \`\${user.uid.slice(0, 10)}...\` : 'N/A'}</p>`
);

fs.writeFileSync('D:/Aeirmist/src/components/admin/AdminPanel.tsx', code, 'utf8');
console.log('AdminPanel.tsx updated successfully!');
