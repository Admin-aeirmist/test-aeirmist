/**
 * Aeirmist Universal Backend Automated Test Suite
 * Tests all core subsystems (Auth, Posts, Stories, Chat, Support, Admin)
 */

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:4000';

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs });
    console.log(`  ✅ [PASS] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ name, passed: false, durationMs, details: err.message });
    console.error(`  ❌ [FAIL] ${name} (${durationMs}ms): ${err.message}`);
  }
}

async function request(endpoint: string, options: any = {}, token?: string) {
  const headers: any = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return data;
}

async function main() {
  console.log('\n🚀 Starting Aeirmist Universal Backend Automated Integration Tests...');
  console.log(`📡 Target API: ${BASE_URL}\n`);

  let authToken = '';
  let testPostId = '';

  // 1. Health check
  await runTest('Health Check & Subsystem Status', async () => {
    const res = await request('/health');
    if (res.status !== 'healthy' || res.services.database !== 'up' || res.services.redis !== 'up') {
      throw new Error(`Degraded status: ${JSON.stringify(res.services)}`);
    }
  });

  // 2. Ping
  await runTest('API Ping Endpoint', async () => {
    const res = await request('/api/v1/ping');
    if (!res.message || !res.version) throw new Error('Invalid ping response');
  });

  // 3. User Login
  await runTest('User Login with Credentials', async () => {
    const res = await request('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: 'demo_user', password: 'password123' },
    });
    if (!res.token || !res.user) throw new Error('Missing token or user');
    authToken = res.token;
  });

  // 4. Me endpoint
  await runTest('Authenticated Profile (/me)', async () => {
    const res = await request('/api/v1/auth/me', {}, authToken);
    if (!res.user || res.user.email !== 'demo@aeirmist.com') {
      throw new Error('User profile mismatch');
    }
  });

  // 5. User Search
  await runTest('PostgreSQL High-Speed User Search', async () => {
    const res = await request('/api/v1/users/search?q=demo');
    if (!Array.isArray(res.users) || res.users.length === 0) {
      throw new Error('Search did not return expected user');
    }
  });

  // 6. Post Creation
  await runTest('Post Creation (/api/v1/posts)', async () => {
    const res = await request(
      '/api/v1/posts',
      {
        method: 'POST',
        body: { content: 'Automated test post created by test suite!', tags: ['automated_test'] },
      },
      authToken
    );
    if (!res.post || !res.post.id) throw new Error('Post creation failed');
    testPostId = res.post.id;
  });

  // 7. Post Feed
  await runTest('Post Feed Retrieval (/api/v1/posts)', async () => {
    const res = await request('/api/v1/posts?limit=10');
    if (!Array.isArray(res.posts) || res.posts.length === 0) {
      throw new Error('Post feed is empty or invalid');
    }
  });

  // 8. Post Like
  await runTest('Toggle Post Like', async () => {
    if (!testPostId) throw new Error('No post to like');
    const res = await request(`/api/v1/posts/${testPostId}/like`, { method: 'POST' }, authToken);
    if (typeof res.liked !== 'boolean') throw new Error('Like toggle failed');
  });

  // 9. Post Comments
  await runTest('Add and Fetch Post Comments', async () => {
    if (!testPostId) throw new Error('No post to comment on');
    const addRes = await request(
      `/api/v1/posts/${testPostId}/comments`,
      { method: 'POST', body: { content: 'Test comment on automated post' } },
      authToken
    );
    if (!addRes.comment || !addRes.comment.id) throw new Error('Add comment failed');

    const getRes = await request(`/api/v1/posts/${testPostId}/comments`);
    if (!Array.isArray(getRes.comments) || getRes.comments.length === 0) {
      throw new Error('Fetch comments failed');
    }
  });

  // 10. Stories
  await runTest('Story Creation and Active Stories Feed', async () => {
    const createRes = await request(
      '/api/v1/stories',
      {
        method: 'POST',
        body: {
          mediaUrl: 'http://localhost:4000/media/test-story.jpg',
          caption: 'Automated test story',
          audience: 'public',
        },
      },
      authToken
    );
    if (!createRes.story || !createRes.story.id) throw new Error('Story creation failed');

    const feedRes = await request('/api/v1/stories');
    if (!Array.isArray(feedRes.stories)) throw new Error('Stories feed invalid');
  });

  // 11. Marketplace Items
  await runTest('Marketplace Item Retrieval', async () => {
    const res = await request('/api/v1/marketplace/items');
    if (!Array.isArray(res.items)) throw new Error('Marketplace items response invalid');
  });

  // 12. Notifications
  await runTest('User Notifications Retrieval', async () => {
    const res = await request('/api/v1/notifications', {}, authToken);
    if (!Array.isArray(res.notifications)) throw new Error('Notifications response invalid');
  });

  // 13. Support Ticket
  await runTest('Support Ticket Creation', async () => {
    const res = await request(
      '/api/v1/support/tickets',
      {
        method: 'POST',
        body: { type: 'general', message: 'Automated test support ticket submission.' },
      },
      authToken
    );
    if (!res.success || !res.ticketId) throw new Error('Support ticket creation failed');
  });

  // 14. Content Report
  await runTest('Content Report Submission', async () => {
    const res = await request(
      '/api/v1/support/reports',
      {
        method: 'POST',
        body: {
          reportedUid: '3e79ab92-ebc6-43e0-918b-ec4632d7f1f8',
          targetType: 'post',
          targetId: testPostId || 'sample-target-id',
          reason: 'Spam',
          description: 'Automated test spam report.',
        },
      },
      authToken
    );
    if (!res.success || !res.reportId) throw new Error('Report submission failed');
  });

  // Summary
  console.log('\n========================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`📊 Test Results: ${passed}/${total} PASSED (${failed} failed)`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
