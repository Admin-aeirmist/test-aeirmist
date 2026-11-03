const path = require('path');
require('dotenv').config({ path: path.resolve('D:/Aeirmist/.env') });
require('dotenv').config({ path: path.resolve('D:/Aeirmist/backend/.env') });

const { UserDAL } = require('D:/Aeirmist/backend/dist/dal/user.dal.js');

async function testResolution() {
  const tests = [
    '10000000001',
    '10000000001_junaed_islam_jim9',
    'junaed_islam_jim9',
    'profile_53c57429-0694-490f-ab2a-c47e2d7929ac'
  ];

  for (const t of tests) {
    const p = await UserDAL.getProfileByIdentifier(t);
    console.log(`Resolution for "${t}":`, p ? `FOUND (accountId: ${p.accountId}, username: ${p.username}, name: ${p.displayName})` : 'NOT FOUND');
  }
  process.exit(0);
}
testResolution();
