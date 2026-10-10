import { chromium } from 'playwright';
import { db } from '../db';
import { users, profiles, messages, conversationMembers, conversations } from '../db/schema';
import { generateAccessToken } from '../lib/auth';
import { eq, and, sql } from 'drizzle-orm';

async function runRealBrowserRegression() {
  console.log('================================================================');
  console.log('AEIRMIST REAL BROWSER UI REGRESSION TEST (2 BROWSER CONTEXTS)');
  console.log('================================================================\n');

  // 1. Database user lookup & identity verification
  const allUsers = await db.select().from(users);
  const userA = allUsers.find(u => u.email === 'junaedislamjim180@gmail.com');
  const userB = allUsers.find(u => u.email === 'junaedislamjim999@gmail.com');

  const allProfiles = await db.select().from(profiles);
  const profileA = allProfiles.find(p => p.userId === userA?.id);
  const profileB = allProfiles.find(p => p.userId === userB?.id);

  if (!userA || !userB || !profileA || !profileB) {
    throw new Error('Test users or profiles not found in database');
  }

  console.log('1. Verified Authenticated Canonical Identities:');
  console.log(`   User A: canonicalUserId=${userA.id}, email=${userA.email}, profileId=${profileA.id}, handle=@${profileA.username}`);
  console.log(`   User B: canonicalUserId=${userB.id}, email=${userB.email}, profileId=${profileB.id}, handle=@${profileB.username}`);

  // Find direct conversation between User A and User B
  const membersA = await db.select().from(conversationMembers).where(eq(conversationMembers.userId, userA.id));
  const membersB = await db.select().from(conversationMembers).where(eq(conversationMembers.userId, userB.id));
  const convIdsA = new Set(membersA.map(m => m.conversationId));
  const directMember = membersB.find(m => convIdsA.has(m.conversationId));
  const directConvId = directMember?.conversationId;

  console.log(`   Canonical Direct Conversation UUID in PostgreSQL: ${directConvId || 'None yet'}`);
  if (!directConvId) {
    throw new Error('Direct conversation UUID between User A and User B not found in database');
  }

  const tokenA = generateAccessToken({ userId: userA.id, email: userA.email, role: userA.role });
  const tokenB = generateAccessToken({ userId: userB.id, email: userB.email, role: userB.role });

  // 2. Launch browser with two isolated contexts (Browser 1 for User A, Browser 2 for User B)
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

  // HTTP Request Counters
  let httpPostCountA = 0;
  let httpPostCountB = 0;
  pageA.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/api/v1/chat/conversations/')) {
      httpPostCountA++;
    }
  });
  pageB.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/api/v1/chat/conversations/')) {
      httpPostCountB++;
    }
  });

  // Console telemetry
  pageA.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Socket.IO') || text.includes('[Messenger') || text.includes('[MessagingService') || text.toLowerCase().includes('error')) {
      console.log(`   [Browser A Console] ${text}`);
    }
  });
  pageB.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Socket.IO') || text.includes('[Messenger') || text.includes('[MessagingService') || text.toLowerCase().includes('error')) {
      console.log(`   [Browser B Console] ${text}`);
    }
  });

  pageA.on('pageerror', err => console.error(`   [Browser A PageError] ${err.message}`));
  pageB.on('pageerror', err => console.error(`   [Browser B PageError] ${err.message}`));

  // 3. Navigate both browsers to http://localhost:4000/messages
  console.log('\n3. Navigating Browser 1 and Browser 2 to http://localhost:4000/messages...');
  await Promise.all([
    pageA.goto('http://localhost:4000/messages', { waitUntil: 'domcontentloaded' }),
    pageB.goto('http://localhost:4000/messages', { waitUntil: 'domcontentloaded' })
  ]);

  // Wait for initial render and hydration
  console.log('\n4. Waiting for inbox conversations to hydrate in both browsers...');
  await pageA.waitForSelector(`[data-conversation-id="${directConvId}"]`, { timeout: 20000 });
  await pageB.waitForSelector(`[data-conversation-id="${directConvId}"]`, { timeout: 20000 });
  console.log('   Inbox rendered canonical conversation in both browsers.');

  // Instrument Socket.IO event capture in both browser pages
  await pageA.evaluate(() => {
    (window as any).__capturedSocketEvents = [];
    const s = (window as any).__aeirmistSocket;
    if (s) {
      s.on('new_message', (data: any) => {
        (window as any).__capturedSocketEvents.push(data);
      });
    }
  });
  await pageB.evaluate(() => {
    (window as any).__capturedSocketEvents = [];
    const s = (window as any).__aeirmistSocket;
    if (s) {
      s.on('new_message', (data: any) => {
        (window as any).__capturedSocketEvents.push(data);
      });
    }
  });

  // 5. Select Direct Conversation in Both Browsers
  console.log('\n5. Selecting Direct Conversation in both browsers...');
  await pageA.locator(`[data-conversation-id="${directConvId}"]`).first().click({ force: true });
  await pageB.locator(`[data-conversation-id="${directConvId}"]`).first().click({ force: true });

  const textareaSelector = 'textarea[data-input-textarea="true"]';
  await pageA.waitForSelector(textareaSelector, { timeout: 10000 });
  await pageB.waitForSelector(textareaSelector, { timeout: 10000 });
  console.log('   Both browsers entered ChatWindow and textareas are active.');

  // Helper functions
  const countInDOM = async (page: any, text: string) => {
    return page.locator('.chat-messages-container').locator(`text="${text}"`).count();
  };

  const waitForMsgInDOM = async (page: any, text: string, timeout = 10000) => {
    await page.locator('.chat-messages-container').locator(`text="${text}"`).first().waitFor({ timeout });
  };

  const countInDB = async (text: string) => {
    const rows = await db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, directConvId), eq(messages.content, text)));
    return rows;
  };

  const getSocketEventCount = async (page: any, text: string) => {
    return page.evaluate((t: string) => {
      const events = (window as any).__capturedSocketEvents || [];
      return events.filter((e: any) => {
        const msg = e.message || e;
        return (msg.content === t || msg.text === t);
      }).length;
    }, text);
  };

  // =========================================================================
  // TEST 1: User A sends one uniquely identified message to User B
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 1: User A sends unique message to User B (Real-time zero-refresh)');
  console.log('----------------------------------------------------------------');
  const msg1Text = `[TEST-1 A->B] Message from A at ${Date.now()}`;
  httpPostCountA = 0;

  console.log(`Action: User A types and presses Enter: "${msg1Text}"`);
  await pageA.fill(textareaSelector, msg1Text);
  await pageA.press(textareaSelector, 'Enter');

  // Verify in User A's UI
  await waitForMsgInDOM(pageA, msg1Text, 10000);
  await pageA.waitForTimeout(500); // Settle optimistic transition
  const uiCountA1 = await countInDOM(pageA, msg1Text);

  // Verify in User B's UI in real time WITHOUT REFRESHING
  await waitForMsgInDOM(pageB, msg1Text, 10000);
  await pageB.waitForTimeout(500);
  const uiCountB1 = await countInDOM(pageB, msg1Text);

  // Verify PostgreSQL database row count
  const dbRows1 = await countInDB(msg1Text);
  const socketEventsB1 = await getSocketEventCount(pageB, msg1Text);

  console.log(`Metrics for Test 1:`);
  console.log(`   User A UI count:       ${uiCountA1} (Expected: 1)`);
  console.log(`   User B UI count:       ${uiCountB1} (Expected: 1)`);
  console.log(`   Database row count:    ${dbRows1.length} (Expected: 1, Canonical ID: ${dbRows1[0]?.id})`);
  console.log(`   HTTP POST count:       ${httpPostCountA} (Expected: 1)`);
  console.log(`   Socket events to B:    ${socketEventsB1} (Expected: 1)`);

  if (uiCountA1 !== 1 || uiCountB1 !== 1 || dbRows1.length !== 1) {
    throw new Error(`TEST 1 FAILED: Expected exactly 1 message everywhere, got UI_A=${uiCountA1}, UI_B=${uiCountB1}, DB=${dbRows1.length}`);
  }
  console.log('   [PASS] Test 1 Passed: Exactly one message visible in A, exactly one delivered to B, exactly one row in DB.');

  // =========================================================================
  // TEST 2: User B replies; User A receives exactly one copy
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 2: User B replies to User A (Real-time zero-refresh)');
  console.log('----------------------------------------------------------------');
  const msg2Text = `[TEST-2 B->A] Reply from B at ${Date.now()}`;
  httpPostCountB = 0;

  console.log(`Action: User B types and presses Enter: "${msg2Text}"`);
  await pageB.fill(textareaSelector, msg2Text);
  await pageB.press(textareaSelector, 'Enter');

  await waitForMsgInDOM(pageB, msg2Text, 10000);
  await pageB.waitForTimeout(500);
  const uiCountB2 = await countInDOM(pageB, msg2Text);

  await waitForMsgInDOM(pageA, msg2Text, 10000);
  await pageA.waitForTimeout(500);
  const uiCountA2 = await countInDOM(pageA, msg2Text);

  const dbRows2 = await countInDB(msg2Text);
  const socketEventsA2 = await getSocketEventCount(pageA, msg2Text);

  console.log(`Metrics for Test 2:`);
  console.log(`   User B UI count:       ${uiCountB2} (Expected: 1)`);
  console.log(`   User A UI count:       ${uiCountA2} (Expected: 1)`);
  console.log(`   Database row count:    ${dbRows2.length} (Expected: 1, Canonical ID: ${dbRows2[0]?.id})`);
  console.log(`   HTTP POST count:       ${httpPostCountB} (Expected: 1)`);
  console.log(`   Socket events to A:    ${socketEventsA2} (Expected: 1)`);

  if (uiCountA2 !== 1 || uiCountB2 !== 1 || dbRows2.length !== 1) {
    throw new Error(`TEST 2 FAILED: Expected exactly 1 message everywhere, got UI_A=${uiCountA2}, UI_B=${uiCountB2}, DB=${dbRows2.length}`);
  }
  console.log('   [PASS] Test 2 Passed: Exactly one reply visible in B, exactly one delivered to A, exactly one row in DB.');

  // =========================================================================
  // TEST 3: Navigate away and reopen conversation
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 3: Navigate away and reopen conversation (Inbox Preview & History)');
  console.log('----------------------------------------------------------------');
  await pageA.goto('http://localhost:4000/explore', { waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(1000);
  await pageA.goto('http://localhost:4000/messages', { waitUntil: 'domcontentloaded' });
  await pageA.waitForSelector(`[data-conversation-id="${directConvId}"]`, { timeout: 15000 });

  const topPreview = await pageA.locator(`[data-conversation-id="${directConvId}"]`).first().innerText();
  console.log(`   Inbox conversation item preview for direct chat:\n   "${topPreview.replace(/\n+/g, ' | ')}"`);

  await pageA.locator(`[data-conversation-id="${directConvId}"]`).first().click();
  await pageA.waitForSelector(textareaSelector, { timeout: 10000 });
  await waitForMsgInDOM(pageA, msg1Text, 10000);
  await waitForMsgInDOM(pageA, msg2Text, 10000);

  const uiCountAAfterNav1 = await countInDOM(pageA, msg1Text);
  const uiCountAAfterNav2 = await countInDOM(pageA, msg2Text);
  console.log(`   History counts after reopen: Msg1=${uiCountAAfterNav1}, Msg2=${uiCountAAfterNav2}`);

  if (uiCountAAfterNav1 !== 1 || uiCountAAfterNav2 !== 1) {
    throw new Error(`TEST 3 FAILED: Duplication on history reopen: Msg1=${uiCountAAfterNav1}, Msg2=${uiCountAAfterNav2}`);
  }
  console.log('   [PASS] Test 3 Passed: History perfectly preserved with exactly one of each message.');

  // =========================================================================
  // TEST 4: Full reload of both browsers
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 4: Full reload of both browsers');
  console.log('----------------------------------------------------------------');
  await Promise.all([
    pageA.reload({ waitUntil: 'domcontentloaded' }),
    pageB.reload({ waitUntil: 'domcontentloaded' })
  ]);

  await pageA.waitForSelector(`[data-conversation-id="${directConvId}"]`, { timeout: 15000 });
  await pageB.waitForSelector(`[data-conversation-id="${directConvId}"]`, { timeout: 15000 });

  await pageA.locator(`[data-conversation-id="${directConvId}"]`).first().click();
  await pageB.locator(`[data-conversation-id="${directConvId}"]`).first().click();

  await pageA.waitForSelector(textareaSelector, { timeout: 10000 });
  await pageB.waitForSelector(textareaSelector, { timeout: 10000 });

  await waitForMsgInDOM(pageA, msg1Text, 10000);
  await waitForMsgInDOM(pageB, msg1Text, 10000);

  const reloadCountA1 = await countInDOM(pageA, msg1Text);
  const reloadCountB1 = await countInDOM(pageB, msg1Text);
  const reloadCountA2 = await countInDOM(pageA, msg2Text);
  const reloadCountB2 = await countInDOM(pageB, msg2Text);

  console.log(`   Post-reload counts: Browser A: msg1=${reloadCountA1}, msg2=${reloadCountA2} | Browser B: msg1=${reloadCountB1}, msg2=${reloadCountB2}`);

  if (reloadCountA1 !== 1 || reloadCountB1 !== 1 || reloadCountA2 !== 1 || reloadCountB2 !== 1) {
    throw new Error(`TEST 4 FAILED: Unexpected duplicate rows after full reload`);
  }
  console.log('   [PASS] Test 4 Passed: Both browsers reloaded clean with exactly one copy per message.');

  // =========================================================================
  // TEST 5: Disconnect and reconnect socket
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 5: Socket disconnect, offline send, and reconnect catch-up');
  console.log('----------------------------------------------------------------');
  // Disconnect socket in Browser B
  await pageB.evaluate(() => {
    const s = (window as any).__aeirmistSocket;
    if (s) s.disconnect();
  });
  await pageB.waitForTimeout(600);

  const msg3Text = `[TEST-5 Reconnect] Message sent while B offline at ${Date.now()}`;
  console.log(`Action: User A sends while User B socket is disconnected: "${msg3Text}"`);
  await pageA.fill(textareaSelector, msg3Text);
  await pageA.press(textareaSelector, 'Enter');
  await waitForMsgInDOM(pageA, msg3Text, 10000);

  // Reconnect socket in Browser B
  console.log('Action: Reconnecting socket in Browser B...');
  await pageB.evaluate(() => {
    const s = (window as any).__aeirmistSocket;
    if (s) s.connect();
  });
  await pageB.waitForTimeout(1000);

  // User B receives/catches up
  await waitForMsgInDOM(pageB, msg3Text, 10000);
  await pageB.waitForTimeout(500);

  const uiCountA5 = await countInDOM(pageA, msg3Text);
  const uiCountB5 = await countInDOM(pageB, msg3Text);
  const dbRows5 = await countInDB(msg3Text);

  console.log(`   Reconnect test metrics: UI_A=${uiCountA5}, UI_B=${uiCountB5}, DB=${dbRows5.length}`);
  if (uiCountA5 !== 1 || uiCountB5 !== 1 || dbRows5.length !== 1) {
    throw new Error(`TEST 5 FAILED: Reconnect test failed: UI_A=${uiCountA5}, UI_B=${uiCountB5}, DB=${dbRows5.length}`);
  }
  console.log('   [PASS] Test 5 Passed: Disconnect & reconnect caught up cleanly with exactly 1 copy.');

  // =========================================================================
  // TEST 6: Two different messages with IDENTICAL text (Must both remain visible!)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 6: Two separate messages with IDENTICAL text');
  console.log('----------------------------------------------------------------');
  const identicalText = `IDENTICAL_PHRASE_${Date.now()}`;

  console.log(`Action 6a: User A sends first copy of "${identicalText}"`);
  await pageA.fill(textareaSelector, identicalText);
  await pageA.press(textareaSelector, 'Enter');

  await waitForMsgInDOM(pageA, identicalText, 10000);
  await waitForMsgInDOM(pageB, identicalText, 10000);
  await pageA.waitForTimeout(800); // Allow server confirmation

  console.log(`Action 6b: User A sends second copy of "${identicalText}"`);
  await pageA.fill(textareaSelector, identicalText);
  await pageA.press(textareaSelector, 'Enter');

  // Wait for both to be present
  await pageA.waitForTimeout(2000);
  await pageB.waitForTimeout(2000);

  const uiCountA6 = await countInDOM(pageA, identicalText);
  const uiCountB6 = await countInDOM(pageB, identicalText);
  const dbRows6 = await countInDB(identicalText);

  console.log(`Metrics for Test 6:`);
  console.log(`   User A UI count:       ${uiCountA6} (Expected: 2)`);
  console.log(`   User B UI count:       ${uiCountB6} (Expected: 2)`);
  console.log(`   Database row count:    ${dbRows6.length} (Expected: 2)`);
  console.log(`   Canonical message IDs: [${dbRows6.map(r => r.id).join(', ')}]`);

  if (uiCountA6 !== 2 || uiCountB6 !== 2 || dbRows6.length !== 2) {
    throw new Error(`TEST 6 FAILED: Two distinct identical-text messages must BOTH remain visible! Got UI_A=${uiCountA6}, UI_B=${uiCountB6}, DB=${dbRows6.length}`);
  }
  if (dbRows6[0].id === dbRows6[1].id) {
    throw new Error(`TEST 6 FAILED: Two messages have the same ID!`);
  }
  console.log('   [PASS] Test 6 Passed: Two messages with identical text both preserved and rendered distinctly.');

  // =========================================================================
  // TEST 7: Rapid submit debounce (Double-click / rapid Enter)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 7: Rapid submit debounce / idempotency');
  console.log('----------------------------------------------------------------');
  const rapidText = `RAPID_SUBMIT_${Date.now()}`;

  console.log(`Action: User A triggers rapid double-submit for "${rapidText}"...`);
  await pageA.fill(textareaSelector, rapidText);
  
  // Submit twice rapidly in succession
  await Promise.all([
    pageA.press(textareaSelector, 'Enter'),
    pageA.press(textareaSelector, 'Enter')
  ]);

  await waitForMsgInDOM(pageA, rapidText, 10000);
  await waitForMsgInDOM(pageB, rapidText, 10000);
  await pageA.waitForTimeout(1500);
  await pageB.waitForTimeout(1500);

  const uiCountA7 = await countInDOM(pageA, rapidText);
  const uiCountB7 = await countInDOM(pageB, rapidText);
  const dbRows7 = await countInDB(rapidText);

  console.log(`Metrics for Test 7:`);
  console.log(`   User A UI count:       ${uiCountA7} (Expected: 1)`);
  console.log(`   User B UI count:       ${uiCountB7} (Expected: 1)`);
  console.log(`   Database row count:    ${dbRows7.length} (Expected: 1, ID: ${dbRows7[0]?.id})`);

  if (uiCountA7 !== 1 || uiCountB7 !== 1 || dbRows7.length !== 1) {
    throw new Error(`TEST 7 FAILED: Rapid double-submit created duplicates: UI_A=${uiCountA7}, UI_B=${uiCountB7}, DB=${dbRows7.length}`);
  }
  console.log('   [PASS] Test 7 Passed: Rapid double-submit created exactly one database row and one visible message.');

  await browser.close();
  console.log('\n================================================================');
  console.log('🎉 ALL 7 REAL BROWSER UI REGRESSION TESTS PASSED (100% PROVEN)');
  console.log('================================================================');
  process.exit(0);
}

runRealBrowserRegression().catch(err => {
  console.error('\n❌ REAL BROWSER REGRESSION TEST FAILED:', err);
  process.exit(1);
});
