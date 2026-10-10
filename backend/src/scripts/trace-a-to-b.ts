import { io as ClientIO } from 'socket.io-client';
import { db } from '../db';
import { users, profiles, messages } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateAccessToken } from '../lib/auth';
import * as fs from 'fs';

async function main() {
  console.log('================================================================');
  console.log('TRACE: Sending message from User A to User B (Network & Server Log)');
  console.log('================================================================\n');

  // 1. Fetch User A and User B
  const allUsers = await db.select().from(users);
  const userA = allUsers.find(u => u.email === 'junaedislamjim180@gmail.com');
  const userB = allUsers.find(u => u.email === 'junaedislamjim999@gmail.com');

  if (!userA || !userB) {
    throw new Error('Could not find userA or userB');
  }

  const allProfiles = await db.select().from(profiles);
  const profileA = allProfiles.find(p => p.userId === userA.id);
  const profileB = allProfiles.find(p => p.userId === userB.id);

  console.log('1. User Information:');
  console.log(`   User A (Sender):   id=${userA.id}, email=${userA.email}, profile_id=${profileA?.id}, firebase_uid=${userA.firebaseUid}`);
  console.log(`   User B (Receiver): id=${userB.id}, email=${userB.email}, profile_id=${profileB?.id}, firebase_uid=${userB.firebaseUid}\n`);

  // 2. Auth Tokens
  const tokenA = generateAccessToken({ userId: userA.id, email: userA.email, role: userA.role });
  const tokenB = generateAccessToken({ userId: userB.id, email: userB.email, role: userB.role });

  // 3. User B connects to Socket.IO and listens for new_message
  const socketB = ClientIO('http://127.0.0.1:4000', {
    auth: { token: tokenB },
    transports: ['websocket']
  });

  const socketBReceivedEvents: any[] = [];
  await new Promise<void>((resolve, reject) => {
    socketB.on('connect', () => {
      console.log(`2. Socket.IO: User B connected successfully to socket server (Socket ID: ${socketB.id})`);
      resolve();
    });
    socketB.on('connect_error', (err) => {
      console.error('Socket B connect error:', err.message);
      reject(err);
    });
    setTimeout(() => reject(new Error('Socket B connect timeout')), 5000);
  });

  socketB.on('new_message', (payload) => {
    socketBReceivedEvents.push(payload);
  });

  // 4. Resolve direct conversation between User A and User B
  const convHttpRes = await fetch('http://127.0.0.1:4000/api/v1/chat/conversations/direct', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({ participantId: userB.id })
  });
  const convJson: any = await convHttpRes.json();
  const canonicalConvId = convJson?.conversationId || convJson?.data?.id || convJson?.id;
  console.log(`3. Canonical Conversation ID: ${canonicalConvId}\n`);

  // User B joins room for this conversation
  socketB.emit('join_room', canonicalConvId);
  await new Promise((r) => setTimeout(r, 200));

  // 5. Send message from User A to User B via HTTP (mimicking DevTools Network Request)
  const uniqueContent = `Verification trace message at ${new Date().toISOString()}`;
  const requestUrl = `http://127.0.0.1:4000/api/v1/chat/conversations/${canonicalConvId}/messages`;
  const requestPayload = {
    content: uniqueContent,
    type: 'text',
    metadata: {
      clientSentAt: Date.now(),
      optimisticId: `opt_${Date.now()}`
    }
  };
  const requestHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenA.slice(0, 15)}...[TRUNCATED_JWT]`
  };

  console.log('4. DevTools Network Request (Sent by User A Client):');
  console.log('   HTTP Method:    POST');
  console.log(`   Request URL:    ${requestUrl}`);
  console.log('   Request Headers:', JSON.stringify(requestHeaders, null, 2));
  console.log('   Request Body:   ', JSON.stringify(requestPayload, null, 2));

  const logFile = 'C:\\Users\\Junaed Islam Jim\\.gemini\\antigravity\\brain\\18c97900-e7fb-4696-8434-ca9d173fa490\\.system_generated\\tasks\\task-62554.log';
  const logSizeBefore = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;

  const startTime = Date.now();
  const sendHttpRes = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify(requestPayload)
  });
  const durationMs = Date.now() - startTime;
  const sendJson: any = await sendHttpRes.json();

  console.log('\n5. DevTools Network Response:');
  console.log(`   HTTP Status:    ${sendHttpRes.status} ${sendHttpRes.statusText} (${durationMs}ms)`);
  console.log('   Response Body:  ', JSON.stringify(sendJson, null, 2));

  // 6. Check Socket.IO delivery to User B
  await new Promise((r) => setTimeout(r, 500));
  console.log('\n6. Real-Time Socket.IO Delivery to User B:');
  if (socketBReceivedEvents.length > 0) {
    console.log(`   Status:         DELIVERED (${socketBReceivedEvents.length} event received)`);
    console.log('   Event Payload:  ', JSON.stringify(socketBReceivedEvents[0], null, 2));
  } else {
    console.log('   Status:         NOT RECEIVED');
  }

  // 7. Verify in PostgreSQL
  const insertedMsgId = sendJson?.message?.id || sendJson?.data?.id || sendJson?.id;
  const dbRows = await db.select().from(messages).where(eq(messages.id, insertedMsgId));
  console.log('\n7. PostgreSQL Verification:');
  console.log('   Row in "messages":', JSON.stringify(dbRows[0], null, 2));

  // 8. Backend Server Log output
  console.log('\n8. Backend Server Log Output:');
  if (fs.existsSync(logFile)) {
    const logSizeAfter = fs.statSync(logFile).size;
    if (logSizeAfter > logSizeBefore) {
      const buffer = Buffer.alloc(logSizeAfter - logSizeBefore);
      const fd = fs.openSync(logFile, 'r');
      fs.readSync(fd, buffer, 0, buffer.length, logSizeBefore);
      fs.closeSync(fd);
      console.log(buffer.toString('utf-8').trim());
    } else {
      console.log('   (No new log lines appended during request)');
    }
  }

  socketB.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Trace error:', err);
  process.exit(1);
});
