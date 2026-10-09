import http from 'http';
import { io as ioClient, Socket } from 'socket.io-client';
import { db } from '../db';
import { users, profiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateAccessToken } from '../lib/auth';

function request(path: string, method: string = 'GET', data?: any, token?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 0, body });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function evaluateIsSenderMe(
  currentUser: { id: string; uid?: string; email: string },
  currentProfile: { id: string; username: string },
  otherParticipant: { id?: string; userId?: string; username?: string },
  msg: any
): boolean {
  const myIdentifiers = new Set([
    currentProfile?.id,
    currentUser?.uid,
    currentUser?.id,
    currentProfile?.username
  ].filter(Boolean).map(id => String(id).toLowerCase()));

  const senderCandidates = [
    msg?.senderId,
    msg?.senderUid,
    msg?.metadata?.senderId,
    msg?.senderProfileId,
    msg?.sender?.id,
    msg?.sender?.firebaseUid,
    msg?.sender?.profileId,
    msg?.sender?.username
  ].filter(Boolean).map(s => String(s).toLowerCase());

  if (senderCandidates.some(cand => myIdentifiers.has(cand))) {
    return true;
  }

  const otherIds = new Set([
    otherParticipant?.id,
    otherParticipant?.userId,
    otherParticipant?.username
  ].filter(Boolean).map(id => String(id).toLowerCase()));

  if (senderCandidates.some(cand => otherIds.has(cand))) {
    return false;
  }

  return false;
}

async function runRegressionSuite() {
  console.log('===============================================================');
  console.log('🧪 [AEIRMIST MESSAGING ROOT-CAUSE TWO-ACCOUNT REGRESSION SUITE]');
  console.log('===============================================================\n');

  // STEP 1: Find two distinct real accounts
  console.log('🔍 Step 1: Finding 2 distinct PostgreSQL test accounts...');
  const allUsers = await db.select().from(users).limit(10);
  if (allUsers.length < 2) {
    throw new Error('Need at least 2 users in PostgreSQL database for regression test');
  }

  const userA = allUsers.find(u => u.email === 'admin@aeirmist.com') || allUsers[0];
  const userB = allUsers.find(u => u.id !== userA.id && u.email === 'junaedislamjim180@gmail.com') || allUsers.find(u => u.id !== userA.id)!;

  const [profileA] = await db.select().from(profiles).where(eq(profiles.userId, userA.id));
  const [profileB] = await db.select().from(profiles).where(eq(profiles.userId, userB.id));

  console.log(`   User A: id=${userA.id}, email=${userA.email}, username=${profileA?.username || 'N/A'}`);
  console.log(`   User B: id=${userB.id}, email=${userB.email}, username=${profileB?.username || 'N/A'}`);

  if (userA.id === userB.id) {
    throw new Error('FATAL: User A and User B have the same ID!');
  }

  // STEP 2: Issue JWT Tokens
  console.log('\n🔑 Step 2: Generating JWT access tokens...');
  const tokenA = generateAccessToken({ userId: userA.id, email: userA.email, role: userA.role });
  const tokenB = generateAccessToken({ userId: userB.id, email: userB.email, role: userB.role });

  const meA = await request('/api/v1/auth/me', 'GET', null, tokenA);
  const meB = await request('/api/v1/auth/me', 'GET', null, tokenB);
  if (meA.status !== 200 || meA.body.user.id !== userA.id) throw new Error('Auth verification failed for User A');
  if (meB.status !== 200 || meB.body.user.id !== userB.id) throw new Error('Auth verification failed for User B');
  console.log('   ✅ Both JWT tokens validated by /api/v1/auth/me');

  // STEP 3: Setup Real-Time Socket.IO Clients
  console.log('\n🔌 Step 3: Connecting User A and User B via Socket.IO...');
  const socketA: Socket = ioClient('http://127.0.0.1:4000', {
    auth: { token: tokenA },
    transports: ['websocket'],
    reconnection: false
  });

  const socketB: Socket = ioClient('http://127.0.0.1:4000', {
    auth: { token: tokenB },
    transports: ['websocket'],
    reconnection: false
  });

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket A connection timeout')), 5000);
      socketA.on('connect', () => { clearTimeout(timer); resolve(); });
      socketA.on('connect_error', reject);
    }),
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket B connection timeout')), 5000);
      socketB.on('connect', () => { clearTimeout(timer); resolve(); });
      socketB.on('connect_error', reject);
    })
  ]);
  console.log('   ✅ Socket A and Socket B connected successfully');

  // STEP 4: Initiate Direct Conversation
  console.log('\n💬 Step 4: Establishing direct 1v1 conversation...');
  const directResp = await request('/api/v1/chat/conversations/direct', 'POST', {
    participantId: userB.id
  }, tokenA);

  if (directResp.status !== 200 && directResp.status !== 201) {
    throw new Error(`Direct conversation creation failed: ${JSON.stringify(directResp)}`);
  }
  const convId = directResp.body.conversationId || directResp.body.id;
  console.log(`   ✅ Direct Conversation established: ID=${convId}`);

  // Test self-conversation rejection
  const selfChat = await request('/api/v1/chat/conversations/direct', 'POST', {
    participantId: userA.id
  }, tokenA);
  if (selfChat.status !== 400) {
    throw new Error(`Expected 400 for self direct chat, got: ${selfChat.status}`);
  }
  console.log('   ✅ Self-conversation creation correctly rejected with HTTP 400');

  // STEP 5: User A sends ROOT-A-TO-B
  console.log('\n📤 Step 5: User A sends "ROOT-A-TO-B" message...');
  const msgTextAtoB = `ROOT-A-TO-B: Verification message from A at ${Date.now()}`;

  const socketBPromise = new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for User B to receive ROOT-A-TO-B via socket')), 5000);
    socketB.on('new_message', (payload: any) => {
      if (payload?.message?.content === msgTextAtoB) {
        clearTimeout(timer);
        resolve(payload);
      }
    });
  });

  const sendRespA = await request(`/api/v1/chat/conversations/${convId}/messages`, 'POST', {
    content: msgTextAtoB,
    type: 'text'
  }, tokenA);

  if (sendRespA.status !== 201) {
    throw new Error(`Failed to send message from User A: ${JSON.stringify(sendRespA)}`);
  }
  const sentMsgA = sendRespA.body.message;
  console.log(`   ✅ Message saved in DB. Message ID=${sentMsgA.id}, senderId=${sentMsgA.senderId}`);
  if (sentMsgA.senderId !== userA.id) {
    throw new Error(`Wrong senderId on message from A! Expected ${userA.id}, got ${sentMsgA.senderId}`);
  }

  const receivedOnB = await socketBPromise;
  console.log('   ✅ User B received message via Socket.IO real-time event!');

  // Test Bubble Evaluation on A and B
  const isMeOnA = evaluateIsSenderMe(userA, profileA, profileB, sentMsgA);
  const isMeOnB = evaluateIsSenderMe(userB, profileB, profileA, receivedOnB.message);
  console.log(`   Bubble on User A (Sender): isSenderMe = ${isMeOnA} (Expected: true)`);
  console.log(`   Bubble on User B (Receiver): isSenderMe = ${isMeOnB} (Expected: false)`);
  if (!isMeOnA) throw new Error('Bubble evaluation failed: User A did not recognize own message!');
  if (isMeOnB) throw new Error('Bubble evaluation failed: User B incorrectly recognized A message as own!');

  // STEP 6: User B replies ROOT-B-TO-A
  console.log('\n📥 Step 6: User B replies "ROOT-B-TO-A" message...');
  const msgTextBtoA = `ROOT-B-TO-A: Verification reply from B at ${Date.now()}`;

  const socketAPromise = new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for User A to receive ROOT-B-TO-A via socket')), 5000);
    socketA.on('new_message', (payload: any) => {
      if (payload?.message?.content === msgTextBtoA) {
        clearTimeout(timer);
        resolve(payload);
      }
    });
  });

  const sendRespB = await request(`/api/v1/chat/conversations/${convId}/messages`, 'POST', {
    content: msgTextBtoA,
    type: 'text'
  }, tokenB);

  if (sendRespB.status !== 201) {
    throw new Error(`Failed to send message from User B: ${JSON.stringify(sendRespB)}`);
  }
  const sentMsgB = sendRespB.body.message;
  console.log(`   ✅ Reply saved in DB. Message ID=${sentMsgB.id}, senderId=${sentMsgB.senderId}`);
  if (sentMsgB.senderId !== userB.id) {
    throw new Error(`Wrong senderId on message from B! Expected ${userB.id}, got ${sentMsgB.senderId}`);
  }

  const receivedOnA = await socketAPromise;
  console.log('   ✅ User A received reply via Socket.IO real-time event!');

  // Test Bubble Evaluation for Reply
  const isMeReplyOnB = evaluateIsSenderMe(userB, profileB, profileA, sentMsgB);
  const isMeReplyOnA = evaluateIsSenderMe(userA, profileA, profileB, receivedOnA.message);
  console.log(`   Bubble on User B (Sender): isSenderMe = ${isMeReplyOnB} (Expected: true)`);
  console.log(`   Bubble on User A (Receiver): isSenderMe = ${isMeReplyOnA} (Expected: false)`);
  if (!isMeReplyOnB) throw new Error('Bubble evaluation failed: User B did not recognize own reply!');
  if (isMeReplyOnA) throw new Error('Bubble evaluation failed: User A incorrectly recognized B reply as own!');

  // STEP 7: Cross-Conversation Isolation & Leakage Prevention
  console.log('\n🛡️ Step 7: Testing Zero Cross-Conversation Leakage...');
  // Find a 3rd user if exists or test direct conversation resolution with new_<target>
  const userC = allUsers.find(u => u.id !== userA.id && u.id !== userB.id);
  if (userC) {
    console.log(`   Found third party User C: id=${userC.id}, email=${userC.email}`);
    const convACResp = await request('/api/v1/chat/conversations/direct', 'POST', {
      participantId: userC.id
    }, tokenA);
    const convACId = convACResp.body.conversationId || convACResp.body.id;

    let leakedToB = false;
    const leakageListener = (payload: any) => {
      if (payload?.conversationId === convACId) {
        leakedToB = true;
      }
    };
    socketB.on('new_message', leakageListener);

    // Send message in Conversation A-C
    const foreignMsg = `FOREIGN-MSG-TO-C at ${Date.now()}`;
    await request(`/api/v1/chat/conversations/${convACId}/messages`, 'POST', {
      content: foreignMsg,
      type: 'text'
    }, tokenA);

    await new Promise(r => setTimeout(r, 600));
    socketB.off('new_message', leakageListener);

    if (leakedToB) {
      throw new Error('FATAL: Message from Conversation A-C leaked to User B socket!');
    }
    console.log('   ✅ Foreign conversation message did NOT leak to User B socket!');

    // Verify Conversation A-B message list does NOT contain foreignMsg
    const historyResp = await request(`/api/v1/chat/conversations/${convId}/messages`, 'GET', null, tokenA);
    const containsForeign = historyResp.body.messages?.some((m: any) => m.content === foreignMsg);
    if (containsForeign) {
      throw new Error('FATAL: Foreign message found in Conversation A-B history!');
    }
    console.log('   ✅ Conversation A-B history is strictly isolated with 0 cross-conversation messages');
  } else {
    console.log('   (Skipped third party test: only 2 users in database)');
  }

  // STEP 8: Inbox otherParticipant Verification
  console.log('\n📋 Step 8: Verifying Inbox otherParticipant mapping...');
  const inboxesA = await request('/api/v1/chat/conversations', 'GET', null, tokenA);
  const inboxesB = await request('/api/v1/chat/conversations', 'GET', null, tokenB);

  const convOnA = inboxesA.body.conversations?.find((c: any) => c.id === convId);
  const convOnB = inboxesB.body.conversations?.find((c: any) => c.id === convId);

  if (!convOnA) throw new Error('Conversation not found in User A inbox');
  if (!convOnB) throw new Error('Conversation not found in User B inbox');

  console.log(`   User A's counterpart: userId=${convOnA.otherParticipant?.userId}, username=${convOnA.otherParticipant?.username}`);
  console.log(`   User B's counterpart: userId=${convOnB.otherParticipant?.userId}, username=${convOnB.otherParticipant?.username}`);

  if (convOnA.otherParticipant?.userId === userA.id) {
    throw new Error('Self-chat bug detected! User A inbox shows User A as otherParticipant!');
  }
  if (convOnA.otherParticipant?.userId !== userB.id) {
    throw new Error(`Wrong otherParticipant on User A inbox! Expected ${userB.id}, got ${convOnA.otherParticipant?.userId}`);
  }
  if (convOnB.otherParticipant?.userId !== userA.id) {
    throw new Error(`Wrong otherParticipant on User B inbox! Expected ${userA.id}, got ${convOnB.otherParticipant?.userId}`);
  }
  console.log('   ✅ Inbox counterpart resolution is 100% accurate on both sides');

  // STEP 9: Test new_<targetId> direct routing
  console.log('\n🎯 Step 9: Testing new_<targetId> routing resolution...');
  const newMsgText = `TEST-NEW-ROUTE at ${Date.now()}`;
  const sendViaNewRoute = await request(`/api/v1/chat/conversations/new_${userB.id}/messages`, 'POST', {
    content: newMsgText,
    type: 'text'
  }, tokenA);
  if (sendViaNewRoute.status !== 201 || sendViaNewRoute.body.conversationId !== convId) {
    throw new Error(`new_<targetId> routing failed: ${JSON.stringify(sendViaNewRoute)}`);
  }
  console.log('   ✅ new_<targetId> accurately resolved to existing direct conversation ID');

  // Cleanup sockets
  socketA.disconnect();
  socketB.disconnect();

  console.log('\n===============================================================');
  console.log('🎉 [ALL REGRESSION TESTS PASSED CLEANLY WITH ZERO DEFECTS]');
  console.log('===============================================================');
}

runRegressionSuite().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ [REGRESSION TEST FAILED]:', err);
  process.exit(1);
});
