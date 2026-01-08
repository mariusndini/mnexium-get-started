/**
 * Concurrency Test Suite
 *
 * Simulates multiple users running the full API test suite simultaneously
 * to stress test the Mnexium platform under concurrent load.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY and OPENAI_KEY
 *   2. node 10.concurrency_test.js [num_users]
 *
 * Examples:
 *   node 10.concurrency_test.js        # Default: 5 concurrent users
 *   node 10.concurrency_test.js 10     # 10 concurrent users
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "http://localhost:3005/api/v1";

const NUM_USERS = parseInt(process.argv[2]) || 5;

if (!MNX_KEY || !OPENAI_KEY) {
  console.error("Error: MNX_KEY and OPENAI_KEY must be set in .env.local");
  process.exit(1);
}

// ============================================
// SINGLE USER TEST SUITE
// ============================================

async function runUserTests(userId) {
  const userPrefix = `user_${userId}_${Date.now()}`;
  const chatId = crypto.randomUUID();
  const subjectId = `${userPrefix}_subject`;
  
  const headers = {
    "Authorization": `Bearer ${MNX_KEY}`,
    "Content-Type": "application/json",
    "x-openai-key": OPENAI_KEY,
  };

  let passed = 0;
  let failed = 0;
  const errors = [];

  async function test(name, fn) {
    try {
      await fn();
      passed++;
    } catch (err) {
      failed++;
      errors.push({ name, error: err.message });
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  const startTime = Date.now();

  // --- Chat Completions API ---
  await test("POST /chat/completions (basic)", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say 'test passed'" }],
        max_tokens: 50,
        mnx: { subject_id: subjectId, log: false, learn: false },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
  });

  await test("POST /chat/completions (with logging)", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 50,
        mnx: { subject_id: subjectId, chat_id: chatId, log: true, learn: false },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
  });

  await test("POST /chat/completions (streaming)", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say hi" }],
        max_tokens: 50,
        stream: true,
        mnx: { subject_id: subjectId, log: false, learn: false },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
    // Consume stream
    const reader = res.body.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  });

  // --- Responses API ---
  await test("POST /responses (basic)", async () => {
    const res = await fetch(`${BASE_URL}/responses`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: "Say hello",
        mnx: { subject_id: subjectId, log: false, learn: false },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
  });

  // --- Memories API ---
  const memorySubjectId = `${userPrefix}_mem`;
  let createdMemoryId = null;

  await test("POST /memories (create)", async () => {
    const res = await fetch(`${BASE_URL}/memories`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        subject_id: memorySubjectId,
        text: `Test memory for user ${userId} at ${Date.now()}`,
      }),
    });
    assert(res.ok, `Status ${res.status}`);
    const json = await res.json();
    createdMemoryId = json.id;
    assert(createdMemoryId, "Memory ID not returned");
  });

  await test("GET /memories (list)", async () => {
    const res = await fetch(`${BASE_URL}/memories?subject_id=${memorySubjectId}`, { headers });
    assert(res.ok, `Status ${res.status}`);
    const json = await res.json();
    assert(Array.isArray(json.data), "Expected data array");
  });

  await test("GET /memories/:id", async () => {
    if (!createdMemoryId) throw new Error("No memory ID");
    const res = await fetch(`${BASE_URL}/memories/${createdMemoryId}`, { headers });
    assert(res.ok, `Status ${res.status}`);
  });

  await test("GET /memories/search", async () => {
    const res = await fetch(`${BASE_URL}/memories/search?subject_id=${memorySubjectId}&q=test`, { headers });
    assert(res.ok, `Status ${res.status}`);
  });

  await test("DELETE /memories/:id", async () => {
    if (!createdMemoryId) throw new Error("No memory ID");
    const res = await fetch(`${BASE_URL}/memories/${createdMemoryId}`, { method: "DELETE", headers });
    assert(res.ok, `Status ${res.status}`);
  });

  // --- Prompts API ---
  let createdPromptId = null;

  await test("POST /prompts (create)", async () => {
    const res = await fetch(`${BASE_URL}/prompts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `Concurrency Test Prompt ${userId}`,
        prompt_text: `Test prompt created by concurrency test run ${userId}.`,
        is_default: false,
      }),
    });
    assert(res.ok, `Status ${res.status}`);
    const json = await res.json();
    createdPromptId = json.id;
  });

  await test("GET /prompts (list)", async () => {
    const res = await fetch(`${BASE_URL}/prompts`, { headers });
    assert(res.ok, `Status ${res.status}`);
  });

  await test("DELETE /prompts/:id", async () => {
    if (!createdPromptId) throw new Error("No prompt ID");
    const res = await fetch(`${BASE_URL}/prompts/${createdPromptId}`, { method: "DELETE", headers });
    assert(res.ok, `Status ${res.status}`);
  });

  // --- Chat History API ---
  const historySubjectId = `${userPrefix}_history`;
  const historyChatId = crypto.randomUUID();

  await test("POST /chat/completions (create chat for history)", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "History test message" }],
        max_tokens: 50,
        mnx: { subject_id: historySubjectId, chat_id: historyChatId, log: true, learn: false },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
  });

  // Wait for logging
  await new Promise(r => setTimeout(r, 1000));

  await test("GET /chat/history/list", async () => {
    const res = await fetch(`${BASE_URL}/chat/history/list?subject_id=${historySubjectId}`, { headers });
    assert(res.ok, `Status ${res.status}`);
  });

  await test("GET /chat/history/read", async () => {
    const res = await fetch(`${BASE_URL}/chat/history/read?chat_id=${historyChatId}`, { headers });
    assert(res.ok, `Status ${res.status}`);
  });

  await test("DELETE /chat/history/delete", async () => {
    const res = await fetch(`${BASE_URL}/chat/history/delete?chat_id=${historyChatId}&subject_id=${historySubjectId}`, {
      method: "DELETE",
      headers,
    });
    assert(res.ok, `Status ${res.status}`);
  });

  // --- Agent State API ---
  const stateSubjectId = `${userPrefix}_state`;
  const stateHeaders = {
    ...headers,
    "x-subject-id": stateSubjectId,
  };

  await test("PUT /state/:key (create)", async () => {
    const res = await fetch(`${BASE_URL}/state/test_task`, {
      method: "PUT",
      headers: stateHeaders,
      body: JSON.stringify({ value: { step: 1, data: `User ${userId} state` } }),
    });
    assert(res.ok, `Status ${res.status}`);
  });

  await test("GET /state/:key", async () => {
    const res = await fetch(`${BASE_URL}/state/test_task`, { headers: stateHeaders });
    assert(res.ok, `Status ${res.status}`);
  });

  await test("DELETE /state/:key", async () => {
    const res = await fetch(`${BASE_URL}/state/test_task`, { method: "DELETE", headers: stateHeaders });
    assert(res.ok, `Status ${res.status}`);
  });

  // --- Profiles API ---
  const profileSubjectId = `${userPrefix}_profile`;

  await test("GET /profiles", async () => {
    const res = await fetch(`${BASE_URL}/profiles?subject_id=${profileSubjectId}`, { headers });
    assert(res.ok, `Status ${res.status}`);
  });

  await test("PATCH /profiles", async () => {
    const res = await fetch(`${BASE_URL}/profiles`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        subject_id: profileSubjectId,
        updates: [{ field_key: "name", value: `Test User ${userId}` }],
      }),
    });
    assert(res.ok, `Status ${res.status}`);
  });

  const duration = Date.now() - startTime;

  return {
    userId,
    passed,
    failed,
    errors,
    duration,
  };
}

// ============================================
// CONCURRENCY RUNNER
// ============================================

async function runConcurrencyTest() {
  console.log("==================================================");
  console.log("Concurrency Test Suite");
  console.log("==================================================");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrent Users: ${NUM_USERS}`);
  console.log(`Claude API Key: ${CLAUDE_API_KEY ? "✓ Set" : "✗ Not set"}`);
  console.log("==================================================\n");

  console.log(`Starting ${NUM_USERS} concurrent user simulations...\n`);

  const startTime = Date.now();

  // Run all users in parallel
  const userPromises = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    userPromises.push(runUserTests(i));
  }

  const results = await Promise.all(userPromises);

  const totalDuration = Date.now() - startTime;

  // Summary
  console.log("\n==================================================");
  console.log("Results by User");
  console.log("==================================================");

  let totalPassed = 0;
  let totalFailed = 0;

  for (const result of results) {
    const status = result.failed === 0 ? "✅" : "❌";
    console.log(`${status} User ${result.userId}: ${result.passed} passed, ${result.failed} failed (${result.duration}ms)`);
    
    if (result.errors.length > 0) {
      for (const err of result.errors) {
        console.log(`   ↳ ${err.name}: ${err.error}`);
      }
    }

    totalPassed += result.passed;
    totalFailed += result.failed;
  }

  console.log("\n==================================================");
  console.log("Summary");
  console.log("==================================================");
  console.log(`Total Users: ${NUM_USERS}`);
  console.log(`Total Tests: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Avg Duration per User: ${Math.round(totalDuration / NUM_USERS)}ms`);
  console.log(`Tests per Second: ${((totalPassed + totalFailed) / (totalDuration / 1000)).toFixed(2)}`);
  console.log("==================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runConcurrencyTest().catch(err => {
  console.error("Concurrency test failed:", err);
  process.exit(1);
});
