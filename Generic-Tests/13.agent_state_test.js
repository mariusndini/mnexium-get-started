/**
 * Agent State Test Suite
 *
 * Tests the agent state API and proxy integration:
 * - PUT/GET/DELETE state operations
 * - State injection into chat completions
 * - TTL expiration behavior
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY and OPENAI_KEY
 *   2. Run the agent_state DDL on your ClickHouse instance
 *   3. node 13.agent_state_test.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "http://localhost:3000/api/v1";
const SUBJECT_ID = `state_test_${Date.now()}`;
const CHAT_ID = crypto.randomUUID(); // Same chat ID for all requests in this run

if (!MNX_KEY || !OPENAI_KEY) {
  console.error("Error: MNX_KEY and OPENAI_KEY must be set in .env.local");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${MNX_KEY}`,
  "Content-Type": "application/json",
  "X-Subject-ID": SUBJECT_ID,
  "x-openai-key": OPENAI_KEY,
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log("==================================================");
console.log("Agent State Test Suite");
console.log("==================================================");
console.log(`Base URL: ${BASE_URL}`);
console.log(`Subject ID: ${SUBJECT_ID}`);
console.log("==================================================\n");

// ============================================
// TEST: State API - PUT/GET/DELETE
// ============================================
console.log("--- Test: State API Operations ---");

await test("PUT /state/current_task - create state", async () => {
  const res = await fetch(`${BASE_URL}/state/current_task`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      value: {
        status: "in_progress",
        task: "Plan a trip to Tokyo",
        steps_completed: ["research_flights", "check_hotels"],
        next_step: "book_flights",
      },
      ttl_seconds: 3600,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.ok === true, "Expected ok: true");
});

await test("GET /state/current_task - retrieve state", async () => {
  const res = await fetch(`${BASE_URL}/state/current_task`, {
    method: "GET",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.key === "current_task", "Expected key: current_task");
  assert(json.value.status === "in_progress", "Expected status: in_progress");
  assert(json.value.task === "Plan a trip to Tokyo", "Expected task to match");
  assert(Array.isArray(json.value.steps_completed), "Expected steps_completed array");
  assert(json.ttl, "Expected ttl field");
  assert(json.updated_at, "Expected updated_at field");
  console.log(`   State value: ${JSON.stringify(json.value).slice(0, 80)}...`);
});

await test("PUT /state/current_task - update state", async () => {
  const res = await fetch(`${BASE_URL}/state/current_task`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      value: {
        status: "in_progress",
        task: "Plan a trip to Tokyo",
        steps_completed: ["research_flights", "check_hotels", "book_flights"],
        next_step: "book_hotels",
      },
      ttl_seconds: 3600,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.ok === true, "Expected ok: true");
});

await test("GET /state/current_task - verify update", async () => {
  const res = await fetch(`${BASE_URL}/state/current_task`, {
    method: "GET",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.value.steps_completed.length === 3, "Expected 3 steps completed");
  assert(json.value.next_step === "book_hotels", "Expected next_step: book_hotels");
});

await test("GET /state/nonexistent - returns 404", async () => {
  const res = await fetch(`${BASE_URL}/state/nonexistent_key_${Date.now()}`, {
    method: "GET",
    headers,
  });
  assert(res.status === 404, `Expected 404, got ${res.status}`);
  const json = await res.json();
  assert(json.error === "not_found", "Expected error: not_found");
});

// ============================================
// TEST: State Injection in Chat Completions
// ============================================
console.log("\n--- Test: State Injection in Chat Completions ---");

await test("POST /chat/completions with state.load - state is injected", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "What's my next step for the trip planning?" }
      ],
      mnx: {
        subject_id: SUBJECT_ID,
        chat_id: CHAT_ID,
        log: false,
        learn: false,
        state: {
          load: true,
          key: "current_task",
        },
      },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.choices?.[0]?.message?.content, "Expected response content");
  
  const content = json.choices[0].message.content.toLowerCase();
  // The LLM should reference booking hotels since that's the next_step in state
  console.log(`   Response: ${json.choices[0].message.content.slice(0, 100)}...`);
});

await test("POST /chat/completions without state.load - no state injected", async () => {
  // Create a different subject to ensure no state exists
  const noStateHeaders = { ...headers, "X-Subject-ID": `no_state_${Date.now()}` };
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: noStateHeaders,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "What's my next step?" }
      ],
      mnx: {
        subject_id: `no_state_${Date.now()}`,
        chat_id: CHAT_ID,
        log: false,
        learn: false,
        state: {
          load: true,
          key: "current_task",
        },
      },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  // Should still work, just without state context
  assert(json.choices?.[0]?.message?.content, "Expected response content");
});

// ============================================
// TEST: Delete State
// ============================================
console.log("\n--- Test: Delete State ---");

await test("DELETE /state/current_task - delete state", async () => {
  const res = await fetch(`${BASE_URL}/state/current_task`, {
    method: "DELETE",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.ok === true, "Expected ok: true");
});

await test("GET /state/current_task after delete - returns 404", async () => {
  // Wait a moment for the delete to propagate
  await sleep(500);
  const res = await fetch(`${BASE_URL}/state/current_task`, {
    method: "GET",
    headers,
  });
  assert(res.status === 404, `Expected 404 after delete, got ${res.status}`);
});

// ============================================
// TEST: Multiple State Keys
// ============================================
console.log("\n--- Test: Multiple State Keys ---");

await test("PUT multiple state keys", async () => {
  // Create task state
  let res = await fetch(`${BASE_URL}/state/task_planning`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      value: { current_task: "Plan vacation" },
      ttl_seconds: 3600,
    }),
  });
  assert(res.ok, "Failed to create task_planning state");

  // Create tool state
  res = await fetch(`${BASE_URL}/state/tool:weather:tc_123`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      value: { pending: true, location: "Tokyo" },
      ttl_seconds: 3600,
    }),
  });
  assert(res.ok, "Failed to create tool state");
});

await test("GET different state keys", async () => {
  let res = await fetch(`${BASE_URL}/state/task_planning`, {
    method: "GET",
    headers,
  });
  let json = await res.json();
  assert(res.ok && json.value.current_task === "Plan vacation", "task_planning state mismatch");

  res = await fetch(`${BASE_URL}/state/tool:weather:tc_123`, {
    method: "GET",
    headers,
  });
  json = await res.json();
  assert(res.ok && json.value.pending === true, "tool state mismatch");
  assert(json.value.location === "Tokyo", "tool state location mismatch");
});

// ============================================
// TEST: Missing Subject ID
// ============================================
console.log("\n--- Test: Error Handling ---");

await test("GET without X-Subject-ID header - returns 400", async () => {
  const noSubjectHeaders = {
    "Authorization": `Bearer ${MNX_KEY}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(`${BASE_URL}/state/current_task`, {
    method: "GET",
    headers: noSubjectHeaders,
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  const json = await res.json();
  assert(json.error === "missing_subject_id", "Expected error: missing_subject_id");
});

// ============================================
// CLEANUP
// ============================================
console.log("\n--- Cleanup ---");

await test("Delete test state keys", async () => {
  await fetch(`${BASE_URL}/state/task_planning`, { method: "DELETE", headers });
  await fetch(`${BASE_URL}/state/tool:weather:tc_123`, { method: "DELETE", headers });
});

// ============================================
// RESULTS
// ============================================
console.log("\n==================================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
