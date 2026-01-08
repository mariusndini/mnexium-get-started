/**
 * Full API Test Suite
 *
 * This example tests ALL Mnexium API endpoints to verify they're working.
 * Run this to validate your setup and API key permissions.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY and OPENAI_KEY
 *   2. node 9.full_api_test.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";
const SUBJECT_ID = process.env.SUBJECT_ID;
const CHAT_ID = crypto.randomUUID();

if (!MNX_KEY || !OPENAI_KEY) {
  console.error("Error: MNX_KEY and OPENAI_KEY must be set in .env.local");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${MNX_KEY}`,
  "Content-Type": "application/json",
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

console.log("==================================================");
console.log("Full API Test Suite");
console.log("==================================================");
console.log(`Base URL: ${BASE_URL}`);
console.log(`Subject ID: ${SUBJECT_ID}`);
console.log(`Chat ID: ${CHAT_ID}`);
console.log("==================================================\n");

// ============================================
// CHAT COMPLETIONS API
// ============================================
console.log("--- Chat Completions API ---");

await test("POST /chat/completions (basic)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say 'test passed'" }],
      mnx: { subject_id: SUBJECT_ID, log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.choices?.[0]?.message?.content, "No content in response");
});

await test("POST /chat/completions (with logging)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello" }],
      mnx: { subject_id: SUBJECT_ID, chat_id: CHAT_ID, log: true, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("POST /chat/completions (with learn: force)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "I like cats." }],
      mnx: { subject_id: SUBJECT_ID, log: true, learn: "force" }, // Force memory extraction
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("POST /chat/completions (streaming)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say hi" }],
      stream: true,
      mnx: { subject_id: SUBJECT_ID, log: false, learn: false },
    }),
  });
  assert(res.ok, `Status ${res.status}`);
  assert(res.headers.get("content-type")?.includes("text/event-stream"), "Not streaming");
  // Consume the stream
  const reader = res.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
});

// ============================================
// RESPONSES API
// ============================================
console.log("\n--- Responses API ---");

await test("POST /responses (basic)", async () => {
  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: "Say 'responses test passed'",
      mnx: { subject_id: SUBJECT_ID, log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("POST /responses (streaming)", async () => {
  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: "Say hi",
      stream: true,
      mnx: { subject_id: SUBJECT_ID, log: false, learn: false },
    }),
  });
  assert(res.ok, `Status ${res.status}`);
  const reader = res.body.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
});

await test("POST /responses (with reasoning params - passthrough)", async () => {
  // Test that reasoning-specific params are passed through to OpenAI
  // Using gpt-5-nano which supports the new Responses API format with reasoning params
  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-5-nano",
      input: [{ role: "user", content: [{ type: "input_text", text: "What is 2+2?" }] }],
      text: {
        format: { type: "text" },
        verbosity: "medium",
      },
      reasoning: {
        effort: "medium",
        summary: "auto",
      },
      tools: [],
      store: false,
      include: [
        "reasoning.encrypted_content",
      ],
      mnx: { subject_id: SUBJECT_ID, log: true, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  // Verify we got a response (params passed through without error)
  assert(json.output || json.choices, "Expected output in response");
});

// ============================================
// MEMORIES API
// ============================================
console.log("\n--- Memories API ---");

// Use a fresh subject ID for memory tests to avoid duplicate detection from old test data
const MEMORY_TEST_SUBJECT = `mem_test_${Date.now()}`;
console.log(`Memory Test Subject: ${MEMORY_TEST_SUBJECT}`);

let memoryId;

await test("POST /memories (create)", async () => {
  const uniqueText = `Test memory created at ${Date.now()}`;
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: MEMORY_TEST_SUBJECT,
      text: uniqueText,
      kind: "fact",
      importance: 50,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.id, `No memory ID returned (skipped=${json.skipped}, reason=${json.reason})`);
  memoryId = json.id;
});

await test("GET /memories (list)", async () => {
  const res = await fetch(`${BASE_URL}/memories?subject_id=${MEMORY_TEST_SUBJECT}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.data), "No data array");
});

await test("GET /memories/:id", async () => {
  const res = await fetch(`${BASE_URL}/memories/${memoryId}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.data?.id === memoryId, "Wrong memory returned");
});

await test("GET /memories/search", async () => {
  const res = await fetch(
    `${BASE_URL}/memories/search?subject_id=${MEMORY_TEST_SUBJECT}&q=test`,
    { headers }
  );
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.data), "No data array");
});

await test("PATCH /memories/:id (update)", async () => {
  const res = await fetch(`${BASE_URL}/memories/${memoryId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ text: "Updated test memory", importance: 75 }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("DELETE /memories/:id", async () => {
  const res = await fetch(`${BASE_URL}/memories/${memoryId}`, {
    method: "DELETE",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

// ============================================
// MEMORY VERSIONING API
// ============================================
console.log("\n--- Memory Versioning API ---");

let versioningMemoryId;
let supersedingMemoryId;

await test("POST /memories (create memory for versioning test)", async () => {
  const uniqueText = `Versioning test memory ${Date.now()}`;
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: MEMORY_TEST_SUBJECT,
      text: uniqueText,
      kind: "preference",
      importance: 70,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.id, `No memory ID returned (skipped=${json.skipped}, reason=${json.reason})`);
  versioningMemoryId = json.id;
});

await test("GET /memories/superseded (initially empty)", async () => {
  const res = await fetch(`${BASE_URL}/memories/superseded?subject_id=${MEMORY_TEST_SUBJECT}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.data), "No data array");
});

// Note: To fully test superseding, we'd need to trigger the memory extraction flow
// which would detect the conflict. For now, we test the API endpoints directly.

await test("POST /memories/:id/restore (on active memory - should be no-op)", async () => {
  const res = await fetch(`${BASE_URL}/memories/${versioningMemoryId}/restore`, {
    method: "POST",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.ok === true, "Expected ok: true");
  assert(json.restored === false, "Expected restored: false for already active memory");
});

await test("DELETE /memories/:id (cleanup versioning test memory)", async () => {
  const res = await fetch(`${BASE_URL}/memories/${versioningMemoryId}`, {
    method: "DELETE",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

// ============================================
// MEMORY RECALL EVENTS API
// ============================================
console.log("\n--- Memory Recall Events API ---");

// First, create a memory and trigger a recall to generate events
let recallTestMemoryId;
const recallTestChatId = crypto.randomUUID();

await test("POST /memories (create memory for recall test)", async () => {
  const uniqueText = `Recall test: favorite spacecraft is Falcon ${Date.now()}`;
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: MEMORY_TEST_SUBJECT,
      text: uniqueText,
      kind: "preference",
      importance: 80,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.id, `No memory ID returned (skipped=${json.skipped})`);
  recallTestMemoryId = json.id;
});

await test("POST /chat/completions with recall=true (triggers recall event)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "What is my favorite spacecraft?" }],
      mnx: {
        subject_id: MEMORY_TEST_SUBJECT, // Same subject as the memory we created
        chat_id: recallTestChatId,
        log: true, // Log the chat so we can join with memory_recall_events
        learn: false,
        recall: true, // This should trigger memory recall and log events
      },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

// Wait a moment for recall events to be logged
await new Promise(r => setTimeout(r, 1000));

await test("GET /memories/recalls?chat_id (query by chat)", async () => {
  const res = await fetch(
    `${BASE_URL}/memories/recalls?chat_id=${recallTestChatId}`,
    { headers }
  );
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.data), "Expected data array");
  assert(json.chat_id === recallTestChatId, "Expected chat_id in response");
  console.log(`   Found ${json.count} recall events for chat`);
});

await test("GET /memories/recalls?memory_id (query by memory)", async () => {
  const res = await fetch(
    `${BASE_URL}/memories/recalls?memory_id=${recallTestMemoryId}`,
    { headers }
  );
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.data), "Expected data array");
  assert(json.memory_id === recallTestMemoryId, "Expected memory_id in response");
  console.log(`   Found ${json.count} recall events for memory`);
});

await test("GET /memories/recalls?memory_id&stats=true (aggregated stats)", async () => {
  const res = await fetch(
    `${BASE_URL}/memories/recalls?memory_id=${recallTestMemoryId}&stats=true`,
    { headers }
  );
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.stats, "Expected stats object");
  assert(typeof json.stats.total_recalls === "number", "Expected total_recalls");
  console.log(`   Stats: ${json.stats.total_recalls} recalls, ${json.stats.unique_chats} unique chats`);
});

await test("GET /memories/recalls (missing params - should fail)", async () => {
  const res = await fetch(`${BASE_URL}/memories/recalls`, { headers });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  const json = await res.json();
  assert(json.error === "missing_parameter", "Expected missing_parameter error");
});

await test("DELETE /memories/:id (cleanup recall test memory)", async () => {
  const res = await fetch(`${BASE_URL}/memories/${recallTestMemoryId}`, {
    method: "DELETE",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

// ============================================
// PROMPTS API
// ============================================
console.log("\n--- Prompts API ---");

let promptId;

await test("POST /prompts (create)", async () => {
  const res = await fetch(`${BASE_URL}/prompts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Test Prompt ${Date.now()}`,
      prompt_text: "You are a test assistant.",
      scope: "project",
      is_active: true,
      is_default: false,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.prompt?.id, "No prompt ID returned");
  promptId = json.prompt.id;
});

await test("GET /prompts (list)", async () => {
  const res = await fetch(`${BASE_URL}/prompts`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.prompts), "No prompts array");
});

await test("GET /prompts/:id", async () => {
  const res = await fetch(`${BASE_URL}/prompts/${promptId}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("GET /prompts/resolve", async () => {
  const res = await fetch(`${BASE_URL}/prompts/resolve?combined=true`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("PATCH /prompts/:id (update)", async () => {
  const res = await fetch(`${BASE_URL}/prompts/${promptId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ name: "Updated Test Prompt" }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("DELETE /prompts/:id", async () => {
  const res = await fetch(`${BASE_URL}/prompts/${promptId}`, {
    method: "DELETE",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

// ============================================
// CHAT HISTORY API
// ============================================
console.log("\n--- Chat History API ---");

// Create a chat for history tests
const historyTestChatId = crypto.randomUUID();
const historyTestSubjectId = `history_test_${Date.now()}`;

await test("POST /chat/completions (create chat for history test)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello, this is a history test message." }],
      mnx: { subject_id: historyTestSubjectId, chat_id: historyTestChatId, log: true, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

// Wait for logging
await new Promise(r => setTimeout(r, 1000));

await test("GET /chat/history/list", async () => {
  const res = await fetch(`${BASE_URL}/chat/history/list?subject_id=${historyTestSubjectId}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.chats), "Expected chats array");
  console.log(`   Found ${json.chats.length} chats`);
});

await test("GET /chat/history/read", async () => {
  const res = await fetch(`${BASE_URL}/chat/history/read?chat_id=${historyTestChatId}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.messages), "Expected messages array");
  console.log(`   Found ${json.messages.length} messages`);
});

await test("DELETE /chat/history/delete", async () => {
  const res = await fetch(`${BASE_URL}/chat/history/delete?chat_id=${historyTestChatId}&subject_id=${historyTestSubjectId}`, {
    method: "DELETE",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.success === true, "Expected success: true");
});

await test("GET /chat/history/read (after delete - should be empty)", async () => {
  const res = await fetch(`${BASE_URL}/chat/history/read?chat_id=${historyTestChatId}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.messages) && json.messages.length === 0, "Expected empty messages array after delete");
});

// ============================================
// AGENT STATE API
// ============================================
console.log("\n--- Agent State API ---");

const stateTestSubjectId = `state_test_${Date.now()}`;
const stateKey = "test_task";

// State API uses x-subject-id header
const stateHeaders = { ...headers, "x-subject-id": stateTestSubjectId };

await test("PUT /state/:key (create state)", async () => {
  const res = await fetch(`${BASE_URL}/state/${stateKey}`, {
    method: "PUT",
    headers: stateHeaders,
    body: JSON.stringify({
      value: { step: 1, status: "in_progress", data: { foo: "bar" } },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.ok === true, "Expected ok: true");
});

await test("GET /state/:key", async () => {
  const res = await fetch(`${BASE_URL}/state/${stateKey}`, { headers: stateHeaders });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.value?.step === 1, "Expected step: 1");
  assert(json.value?.status === "in_progress", "Expected status: in_progress");
});

await test("PUT /state/:key (update state)", async () => {
  const res = await fetch(`${BASE_URL}/state/${stateKey}`, {
    method: "PUT",
    headers: stateHeaders,
    body: JSON.stringify({
      value: { step: 2, status: "completed" },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("DELETE /state/:key", async () => {
  const res = await fetch(`${BASE_URL}/state/${stateKey}`, {
    method: "DELETE",
    headers: stateHeaders,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.ok === true, "Expected ok: true");
});

await test("GET /state/:key (after delete - should return 404)", async () => {
  const res = await fetch(`${BASE_URL}/state/${stateKey}`, { headers: stateHeaders });
  assert(res.status === 404, `Expected 404, got ${res.status}`);
});

// ============================================
// PROFILES API
// ============================================
console.log("\n--- Profiles API ---");

const profileTestSubjectId = `profile_test_${Date.now()}`;

await test("GET /profiles (get profile - initially empty)", async () => {
  const res = await fetch(`${BASE_URL}/profiles?subject_id=${profileTestSubjectId}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("PATCH /profiles (update profile)", async () => {
  const res = await fetch(`${BASE_URL}/profiles`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      subject_id: profileTestSubjectId,
      updates: [
        { field_key: "name", value: "Test User", confidence: 1.0 },
        { field_key: "email", value: "test@example.com" },
      ],
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("GET /profiles (verify update)", async () => {
  const res = await fetch(`${BASE_URL}/profiles?subject_id=${profileTestSubjectId}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.data?.name === "Test User", "Expected name: Test User");
});

// ============================================
// ERROR HANDLING TESTS
// ============================================
console.log("\n--- Error Handling ---");

await test("POST /chat/completions (missing x-openai-key - should fail)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MNX_KEY}`,
      "Content-Type": "application/json",
      // Intentionally omitting x-openai-key
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Test" }],
    }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  const json = await res.json();
  assert(json.error?.includes("key_required") || json.error === "openai_key_required", "Expected key_required error");
});

await test("POST /memories (missing subject_id - should fail)", async () => {
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text: "Test memory without subject_id",
    }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  const json = await res.json();
  assert(json.error === "subject_id_required", "Expected subject_id_required error");
});

await test("POST /memories (missing text - should fail)", async () => {
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: "test_subject",
    }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  const json = await res.json();
  assert(json.error === "text_required", "Expected text_required error");
});

await test("GET /memories/:id (non-existent - should fail)", async () => {
  const res = await fetch(`${BASE_URL}/memories/mem_nonexistent_12345`, { headers });
  assert(res.status === 404, `Expected 404, got ${res.status}`);
});

await test("DELETE /chat/history/delete (missing chat_id - should fail)", async () => {
  const res = await fetch(`${BASE_URL}/chat/history/delete`, {
    method: "DELETE",
    headers,
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
  const json = await res.json();
  assert(json.error === "chat_id_required", "Expected chat_id_required error");
});

await test("Unauthorized request (invalid token - should fail)", async () => {
  const res = await fetch(`${BASE_URL}/memories?subject_id=test`, {
    headers: {
      "Authorization": "Bearer invalid_token",
      "Content-Type": "application/json",
    },
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

// ============================================
// CLAUDE VS OPENAI COMPARISON TESTS
// ============================================
console.log("\n--- Claude vs OpenAI Comparison ---");

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const comparisonSubjectId = `comparison_test_${Date.now()}`;
const comparisonChatId = crypto.randomUUID();

if (CLAUDE_API_KEY) {
  // OpenAI Chat Completions
  await test("OpenAI: POST /chat/completions (non-streaming)", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say 'OpenAI test ok' and nothing else." }],
        max_tokens: 50,
        mnx: { subject_id: comparisonSubjectId, log: true, learn: false },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
    const content = json.choices?.[0]?.message?.content || "";
    assert(content.toLowerCase().includes("ok") || content.toLowerCase().includes("openai"), `Unexpected response: ${content}`);
    console.log(`   Response: "${content.substring(0, 50)}"`);
  });

  await test("OpenAI: POST /chat/completions (streaming)", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Say 'streaming works'" }],
        stream: true,
        max_tokens: 50,
        mnx: { subject_id: comparisonSubjectId, log: false, learn: false },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
    const reader = res.body.getReader();
    let content = "";
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ") && !line.includes("[DONE]")) {
          try {
            const json = JSON.parse(line.slice(6));
            content += json.choices?.[0]?.delta?.content || "";
          } catch {}
        }
      }
    }
    assert(content.length > 0, "No streaming content received");
    console.log(`   Streamed: "${content.substring(0, 50)}"`);
  });

  // Claude Chat Completions
  const claudeHeaders = {
    "Authorization": `Bearer ${MNX_KEY}`,
    "Content-Type": "application/json",
    "x-anthropic-key": CLAUDE_API_KEY,
  };

  await test("Claude: POST /chat/completions (non-streaming)", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: claudeHeaders,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "Say 'Claude test ok' and nothing else." }],
        max_tokens: 50,
        mnx: { subject_id: comparisonSubjectId, log: true, learn: false },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
    // Claude returns Anthropic format: content is array of blocks
    const contentBlocks = json.content || [];
    let text = "";
    for (const block of contentBlocks) {
      if (block.type === "text") text += block.text;
    }
    assert(text.toLowerCase().includes("ok") || text.toLowerCase().includes("claude"), `Unexpected response: ${text}`);
    console.log(`   Response: "${text.substring(0, 50)}"`);
  });

  await test("Claude: POST /chat/completions (streaming)", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: claudeHeaders,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "Say 'streaming works'" }],
        stream: true,
        max_tokens: 50,
        mnx: { subject_id: comparisonSubjectId, log: false, learn: false },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
    const reader = res.body.getReader();
    let content = "";
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ") && !line.includes("[DONE]")) {
          try {
            const json = JSON.parse(line.slice(6));
            // Anthropic streaming format
            if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
              content += json.delta.text || "";
            }
            // OpenAI-transformed format
            if (json.choices?.[0]?.delta?.content) {
              content += json.choices[0].delta.content;
            }
          } catch {}
        }
      }
    }
    assert(content.length > 0, "No streaming content received");
    console.log(`   Streamed: "${content.substring(0, 50)}"`);
  });

  // OpenAI Responses API
  await test("OpenAI: POST /responses (non-streaming)", async () => {
    const res = await fetch(`${BASE_URL}/responses`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: "Say 'responses API ok'",
        mnx: { subject_id: comparisonSubjectId, log: true, learn: false },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  });

  // Claude Responses API
  await test("Claude: POST /responses (non-streaming)", async () => {
    const res = await fetch(`${BASE_URL}/responses`, {
      method: "POST",
      headers: claudeHeaders,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        input: "Say 'responses API ok'",
        mnx: { subject_id: comparisonSubjectId, log: true, learn: false },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  });

  // Test history works across providers
  const crossProviderChatId = crypto.randomUUID();
  const crossProviderSubjectId = `cross_provider_${Date.now()}`;

  // Cross-provider history test: Use a simple factual exchange that doesn't trigger AI disclaimers
  await test("Cross-provider: OpenAI sets context", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant. When the user tells you information, acknowledge it briefly." },
          { role: "user", content: "The secret code is ALPHA-7." }
        ],
        max_tokens: 50,
        mnx: { subject_id: crossProviderSubjectId, chat_id: crossProviderChatId, log: true, learn: false, history: true },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
    const json = await res.json();
    console.log(`   OpenAI response logged to chat_id: ${crossProviderChatId}`);
  });

  // Wait for ClickHouse to process the insert
  await new Promise(r => setTimeout(r, 2500));

  // Verify history was stored
  await test("Cross-provider: Verify history stored", async () => {
    const res = await fetch(`${BASE_URL}/chat/history/read?chat_id=${crossProviderChatId}`, { headers });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}`);
    assert(Array.isArray(json.messages) && json.messages.length >= 2, `Expected at least 2 messages in history, got ${json.messages?.length || 0}`);
    console.log(`   History has ${json.messages.length} messages`);
  });

  await test("Cross-provider: Claude recalls context from OpenAI", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: claudeHeaders,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "What was the secret code I mentioned?" }],
        max_tokens: 50,
        mnx: { subject_id: crossProviderSubjectId, chat_id: crossProviderChatId, log: true, learn: false, history: true },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
    const contentBlocks = json.content || [];
    let text = "";
    for (const block of contentBlocks) {
      if (block.type === "text") text += block.text;
    }
    assert(text.toLowerCase().includes("alpha") || text.includes("7"), `Expected 'alpha' or '7' in response: "${text.substring(0, 100)}"`);
    console.log(`   Claude recalled: "${text.substring(0, 60)}"`);
  });

  // ============================================
  // MEMORY LEARN & RECALL TESTS
  // ============================================
  console.log("\n--- Memory Learn & Recall Tests ---");

  const memoryTestSubjectId = `memory_learn_test_${Date.now()}`;

  // Test 1: OpenAI with learn: "force" to create a memory
  await test("OpenAI: Create memory with learn: force", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "My favorite programming language is Rust and I've been using it for 3 years." }],
        max_tokens: 100,
        mnx: { subject_id: memoryTestSubjectId, log: true, learn: "force" },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
    await res.json();
    console.log(`   Sent message with learn: force`);
  });

  // Wait for memory extraction to complete
  await new Promise(r => setTimeout(r, 4000));

  // Verify memory was created
  await test("Verify memory was extracted", async () => {
    const res = await fetch(`${BASE_URL}/memories?subject_id=${memoryTestSubjectId}`, { headers });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}`);
    assert(Array.isArray(json.data) && json.data.length > 0, `Expected at least 1 memory, got ${json.data?.length || 0}`);
    console.log(`   Found ${json.data.length} memories:`);
    for (const mem of json.data.slice(0, 3)) {
      console.log(`     - "${mem.text?.substring(0, 60)}..."`);
    }
  });

  // Test 2: OpenAI with recall: true should retrieve the memory
  await test("OpenAI: Recall memory", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "What programming language do I use?" }],
        max_tokens: 100,
        mnx: { subject_id: memoryTestSubjectId, log: false, learn: false, recall: true },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}`);
    const content = json.choices?.[0]?.message?.content || "";
    assert(content.toLowerCase().includes("rust"), `Expected 'rust' in response: "${content.substring(0, 100)}"`);
    console.log(`   OpenAI recalled: "${content.substring(0, 60)}"`);
  });

  // Test 3: Claude with recall: true should also retrieve the memory
  await test("Claude: Recall memory (cross-provider)", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: claudeHeaders,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "What is my favorite programming language?" }],
        max_tokens: 100,
        mnx: { subject_id: memoryTestSubjectId, log: false, learn: false, recall: true },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}`);
    const contentBlocks = json.content || [];
    let text = "";
    for (const block of contentBlocks) {
      if (block.type === "text") text += block.text;
    }
    assert(text.toLowerCase().includes("rust"), `Expected 'rust' in response: "${text.substring(0, 100)}"`);
    console.log(`   Claude recalled: "${text.substring(0, 60)}"`);
  });

  // Test 4: Claude with learn: "force" to create a memory
  const claudeMemorySubjectId = `claude_memory_test_${Date.now()}`;
  
  await test("Claude: Create memory with learn: force", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: claudeHeaders,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "I work at a company called TechCorp and my role is Senior Engineer." }],
        max_tokens: 100,
        mnx: { subject_id: claudeMemorySubjectId, log: true, learn: "force" },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
    await res.json();
    console.log(`   Sent message with learn: force via Claude`);
  });

  // Wait for memory extraction
  await new Promise(r => setTimeout(r, 4000));

  // Verify Claude-triggered memory was created
  await test("Verify Claude-triggered memory was extracted", async () => {
    const res = await fetch(`${BASE_URL}/memories?subject_id=${claudeMemorySubjectId}`, { headers });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}`);
    assert(Array.isArray(json.data) && json.data.length > 0, `Expected at least 1 memory, got ${json.data?.length || 0}`);
    console.log(`   Found ${json.data.length} memories from Claude conversation`);
  });

  // Test 5: OpenAI recalls Claude-created memory
  await test("OpenAI: Recall Claude-created memory (cross-provider)", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Where do I work and what is my job title?" }],
        max_tokens: 100,
        mnx: { subject_id: claudeMemorySubjectId, log: false, learn: false, recall: true },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}`);
    const content = json.choices?.[0]?.message?.content || "";
    assert(
      content.toLowerCase().includes("techcorp") || content.toLowerCase().includes("senior"),
      `Expected 'techcorp' or 'senior' in response: "${content.substring(0, 100)}"`
    );
    console.log(`   OpenAI recalled Claude memory: "${content.substring(0, 60)}"`);
  });

} else {
  console.log("   ⚠️  Skipping Claude tests - CLAUDE_API_KEY not set in .env.local");
}

// ============================================
// SUMMARY
// ============================================
console.log("\n==================================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
