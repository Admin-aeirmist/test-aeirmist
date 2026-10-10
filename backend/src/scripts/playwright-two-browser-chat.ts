import { chromium } from 'playwright';
import { db } from '../db';
import { users, profiles, messages, conversationMembers, conversations } from '../db/schema';
import { generateAccessToken } from '../lib/auth';
import { eq } from 'drizzle-orm';

async function runRealBrowserRegression() {
  console.log('================================================================');
  console.log('AEIRMIST REAL BROWSER UI REGRESSION TEST (2 BROWSER CONTEXTS)');
  console.log('================================================================\n');

  // 1. Database user lookup
  const allUsers = await db.select().from(users);
  const userA = allUsers.find(u => u.email === 'junaedislamjim180@gmail.com');
  const userB = allUsers.find(u => u.email === 'junaedislamjim999@gmail.com');

  const allProfiles = await db.select().from(profiles);
  const profileA = allProfiles.find(p => p.userId === userA?.id);
  const profileB = allProfiles.find(p => p.userId === userB?.id);

  if (!userA || !userB || !profileA || !profileB) {
    throw new Error('Test users or profiles not found in database');
  }

  console.log('1. Verified Authenticated Identities:');
  console.log(`   User A: id=${userA.id}, email=${userA.email}, handle=@${profileA?.username}, name=${profileA?.displayName}`);
  console.log(`   User B: id=${userB.id}, email=${userB.email}, handle=@${profileB?.username}, name=${profileB?.displayName}`);

  // Find direct conversation between User A and User B
  const membersA = await db.select().from(conversationMembers).where(eq(conversationMembers.userId, userA.id));
  const membersB = await db.select().from(conversationMembers).where(eq(conversationMembers.userId, userB.id));
  const convIdsA = new Set(membersA.map(m => m.conversationId));
  const directMember = membersB.find(m => convIdsA.has(m.conversationId));
  const directConvId = directMember?.conversationId;

  console.log(`   Direct Conversation UUID in PostgreSQL: ${directConvId || 'None yet'}`);

  const tokenA = generateAccessToken({ userId: userA.id, email: userA.email, role: userA.role });
  const tokenB = generateAccessToken({ userId: userB.id, email: userB.email, role: userB.role });

  // 2. Launch browser with two isolated contexts (Browser 1 and Browser 2)
  console.log('\n2. Launching Two Real Isolated Browser Contexts (Microsoft Edge)...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // Seed localStorage for Context A (User A)
  await contextA.addInitScript(({ token, u, p }) => {
    localStorage.setItem('aeirmist_auth_token', token);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('aeirmist_user_id', u.id);
    localStorage.setItem('aeirmist_active_profile_id', p.id);
    localStorage.setItem('aeirmist_user_profile', JSON.stringify(p));
    localStorage.setItem('aeirmist_cached_profile', JSON.stringify(p));
    localStorage.setItem('aeirmist_session', JSON.stringify({
      uid: u.firebaseUid || u.id,
      userId: u.id,
      id: u.id,
      email: u.email,
      username: p.username,
      displayName: p.displayName,
      activeProfileId: p.id,
      token: token
    }));
  }, { token: tokenA, u: userA!, p: profileA! as any });

  // Seed localStorage for Context B (User B)
  await contextB.addInitScript(({ token, u, p }) => {
    localStorage.setItem('aeirmist_auth_token', token);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('aeirmist_user_id', u.id);
    localStorage.setItem('aeirmist_active_profile_id', p.id);
    localStorage.setItem('aeirmist_user_profile', JSON.stringify(p));
    localStorage.setItem('aeirmist_cached_profile', JSON.stringify(p));
    localStorage.setItem('aeirmist_session', JSON.stringify({
      uid: u.firebaseUid || u.id,
      userId: u.id,
      id: u.id,
      email: u.email,
      username: p.username,
      displayName: p.displayName,
      activeProfileId: p.id,
      token: token
    }));
  }, { token: tokenB, u: userB!, p: profileB! as any });

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // Diagnostic logging from browsers
  pageA.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Socket.IO') || text.includes('[Messenger') || text.includes('error') || text.includes('Error')) {
      console.log(`   [Browser A] ${text}`);
    }
  });
  pageB.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Socket.IO') || text.includes('[Messenger') || text.includes('error') || text.includes('Error')) {
      console.log(`   [Browser B] ${text}`);
    }
  });

  pageA.on('pageerror', err => console.error(`   [Browser A Error] ${err.message}`));
  pageB.on('pageerror', err => console.error(`   [Browser B Error] ${err.message}`));

  // 3. Navigate both browsers to http://localhost:4000/messages
  console.log('\n3. Navigating Browser 1 and Browser 2 to http://localhost:4000/messages...');
  await Promise.all([
    pageA.goto('http://localhost:4000/messages', { waitUntil: 'domcontentloaded' }),
    pageB.goto('http://localhost:4000/messages', { waitUntil: 'domcontentloaded' })
  ]);

  // Wait for initial render and hydration
  console.log('\n4. Waiting for inbox frequencies to hydrate in both browsers...');
  await pageA.waitForSelector('[data-conversation-id]', { timeout: 20000 });
  await pageB.waitForSelector('[data-conversation-id]', { timeout: 20000 });

  // Settle inbox renders
  await pageA.waitForTimeout(2000);
  await pageB.waitForTimeout(2000);

  const convsA = await pageA.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-conversation-id]')).map(el => ({
      id: el.getAttribute('data-conversation-id'),
      text: (el as HTMLElement).innerText?.replace(/\n+/g, ' | ')
    }));
  });
  console.log('   Browser A Conversations in DOM:\n', JSON.stringify(convsA, null, 2));

  const convsB = await pageB.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-conversation-id]')).map(el => ({
      id: el.getAttribute('data-conversation-id'),
      text: (el as HTMLElement).innerText?.replace(/\n+/g, ' | ')
    }));
  });
  console.log('   Browser B Conversations in DOM:\n', JSON.stringify(convsB, null, 2));

  // 5. Select Direct Conversation in Both Browsers
  console.log('\n5. Selecting Direct Conversation between User A and User B in both browsers...');
  
  // In Browser A: Click conversation for User B
  const convLocatorA = pageA.locator(`[data-conversation-id="${directConvId}"]`).first();
  await convLocatorA.click({ force: true });
  console.log(`   Browser A clicked conversation [${directConvId}] via Playwright locator.`);

  // In Browser B: Click conversation for User A
  const convLocatorB = pageB.locator(`[data-conversation-id="${directConvId}"]`).first();
  await convLocatorB.click({ force: true });
  console.log(`   Browser B clicked conversation [${directConvId}] via Playwright locator.`);

  await pageA.waitForTimeout(2000);
  await pageB.waitForTimeout(2000);

  const domSummaryA = await pageA.evaluate(() => ({
    hasTextarea: !!document.querySelector('textarea'),
    hasInputSystem: !!document.querySelector('[data-input-system="true"]'),
    visibleText: document.body.innerText.slice(0, 200).replace(/\n+/g, ' ')
  }));
  const domSummaryB = await pageB.evaluate(() => ({
    hasTextarea: !!document.querySelector('textarea'),
    hasInputSystem: !!document.querySelector('[data-input-system="true"]'),
    visibleText: document.body.innerText.slice(0, 200).replace(/\n+/g, ' ')
  }));
  console.log('   Browser A DOM State:', domSummaryA);
  console.log('   Browser B DOM State:', domSummaryB);

  // Wait for ChatWindow input system to be active
  const textareaSelector = 'textarea[data-input-textarea="true"]';
  await pageA.waitForSelector(textareaSelector, { timeout: 10000 });
  await pageB.waitForSelector(textareaSelector, { timeout: 10000 });
  console.log('   Both browsers have active ChatWindow text inputs ready.');

  // Check active headers to ensure identity resolution is correct
  const headerA = await pageA.evaluate(() => document.querySelector('header')?.innerText || '');
  const headerB = await pageB.evaluate(() => document.querySelector('header')?.innerText || '');
  console.log(`   Browser A Chat Window Header: "${headerA.replace(/\n+/g, ' ').slice(0, 80)}"`);
  console.log(`   Browser B Chat Window Header: "${headerB.replace(/\n+/g, ' ').slice(0, 80)}"`);

  // 6. Test Bidirectional Real-Time Delivery
  console.log('\n6. Testing Real-Time Bidirectional Messaging (User A -> User B)...');
  const uniqueMsgA = `[UI-A->B] Hello from User A at ${Date.now()}`;

  console.log(`   Action: User A types and sends "${uniqueMsgA}" in Browser 1`);
  await pageA.fill(textareaSelector, uniqueMsgA);
  await pageA.press(textareaSelector, 'Enter');

  // Verify rendered in Browser A UI
  await pageA.waitForSelector(`text="${uniqueMsgA}"`, { timeout: 5000 });
  console.log('   [SUCCESS] Message rendered in User A\'s UI.');

  // Verify rendered in Browser B UI in REAL TIME WITHOUT REFRESHING!
  console.log('   Waiting for real-time delivery in User B\'s UI (Zero Refresh)...');
  await pageB.waitForSelector(`text="${uniqueMsgA}"`, { timeout: 10000 });
  console.log('   [SUCCESS] Message arrived and rendered in User B\'s UI in real time without refresh!');

  // 7. User B replies to User A
  console.log('\n7. Testing Real-Time Bidirectional Messaging (User B -> User A)...');
  const uniqueMsgB = `[UI-B->A] Reply from User B at ${Date.now()}`;

  console.log(`   Action: User B types and sends "${uniqueMsgB}" in Browser 2`);
  await pageB.fill(textareaSelector, uniqueMsgB);
  await pageB.press(textareaSelector, 'Enter');

  // Verify rendered in Browser B UI
  await pageB.waitForSelector(`text="${uniqueMsgB}"`, { timeout: 5000 });
  console.log('   [SUCCESS] Reply rendered in User B\'s UI.');

  // Verify rendered in Browser A UI in REAL TIME WITHOUT REFRESHING!
  console.log('   Waiting for real-time delivery in User A\'s UI (Zero Refresh)...');
  await pageA.waitForSelector(`text="${uniqueMsgB}"`, { timeout: 10000 });
  console.log('   [SUCCESS] Reply arrived and rendered in User A\'s UI in real time without refresh!');

  // 8. Navigation and History Persistence
  console.log('\n8. Testing Navigation away and reopening (History Persistence & Inbox Preview)...');
  await pageA.goto('http://localhost:4000/explore', { waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(1000);
  await pageA.goto('http://localhost:4000/messages', { waitUntil: 'domcontentloaded' });
  await pageA.waitForSelector('[data-conversation-id]', { timeout: 15000 });

  // Verify top conversation has the latest message preview
  const firstConvPreview = await pageA.locator('[data-conversation-id]').first().innerText();
  console.log(`   Browser A Top Conversation Item Preview:\n   "${firstConvPreview.replace(/\n+/g, ' | ')}"`);

  // Open conversation again
  if (directConvId) {
    await pageA.locator(`[data-conversation-id="${directConvId}"]`).first().click();
  } else {
    await pageA.locator('[data-conversation-id]').first().click();
  }

  await pageA.waitForSelector(textareaSelector, { timeout: 10000 });
  await pageA.waitForSelector(`text="${uniqueMsgA}"`, { timeout: 8000 });
  await pageA.waitForSelector(`text="${uniqueMsgB}"`, { timeout: 8000 });
  console.log('   [SUCCESS] Message history fully persisted and rendered after navigating away and reopening!');

  // 9. Socket Reconnect Behavior
  console.log('\n9. Testing Socket Reconnect Behavior...');
  const isConnectedB = await pageB.evaluate(() => {
    const s = (window as any).__aeirmistSocket;
    return s ? s.connected : false;
  });
  console.log(`   Browser B Socket connected before disconnect test: ${isConnectedB}`);

  // Disconnect socket in Browser B
  await pageB.evaluate(() => {
    const s = (window as any).__aeirmistSocket;
    if (s) s.disconnect();
  });
  await pageB.waitForTimeout(500);

  // Send message while disconnected
  const uniqueMsgA2 = `[UI-A->B Reconnect] Reconnect test msg at ${Date.now()}`;
  console.log(`   User A sends while B reconnects: "${uniqueMsgA2}"`);
  await pageA.fill(textareaSelector, uniqueMsgA2);
  await pageA.press(textareaSelector, 'Enter');
  await pageA.waitForSelector(`text="${uniqueMsgA2}"`, { timeout: 5000 });

  // Reconnect B
  await pageB.evaluate(() => {
    const s = (window as any).__aeirmistSocket;
    if (s) s.connect();
  });
  await pageB.waitForTimeout(1000);

  // Verify B receives or catches up
  console.log('   Waiting for User B to receive reconnected message...');
  await pageB.waitForSelector(`text="${uniqueMsgA2}"`, { timeout: 10000 });
  console.log('   [SUCCESS] Message received after socket reconnection!');

  await browser.close();
  console.log('\n================================================================');
  console.log('✅ ALL REAL BROWSER UI REGRESSION TESTS PASSED (100%)');
  console.log('================================================================');
  process.exit(0);
}

runRealBrowserRegression().catch(err => {
  console.error('\n❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});
