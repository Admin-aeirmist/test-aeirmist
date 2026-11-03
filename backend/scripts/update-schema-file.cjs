const fs = require('fs');
let content = fs.readFileSync('D:/Aeirmist/backend/src/db/schema.ts', 'utf8');

if (!content.includes("accountId: varchar('account_id'")) {
  content = content.replace(
    /export const users = pgTable\('users', \{(\r?\n)\s*id: uuid\('id'\)\.defaultRandom\(\)\.primaryKey\(\),/,
    (match, nl) => `export const users = pgTable('users', {${nl}  id: uuid('id').defaultRandom().primaryKey(),${nl}  accountId: varchar('account_id', { length: 16 }).unique(),`
  );
  content = content.replace(
    /export const profiles = pgTable\('profiles', \{(\r?\n)\s*id: uuid\('id'\)\.defaultRandom\(\)\.primaryKey\(\),/,
    (match, nl) => `export const profiles = pgTable('profiles', {${nl}  id: uuid('id').defaultRandom().primaryKey(),${nl}  accountId: varchar('account_id', { length: 16 }).unique(),`
  );
  fs.writeFileSync('D:/Aeirmist/backend/src/db/schema.ts', content, 'utf8');
  console.log('schema.ts updated with accountId');
} else {
  console.log('schema.ts already contains accountId');
}
