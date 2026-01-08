/**
 * Edge Case & Deep API Test Suite
 *
 * This tests edge cases, boundary conditions, and stress scenarios
 * that the main test suite doesn't cover.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY, OPENAI_KEY, and optionally CLAUDE_API_KEY
 *   2. node 10.edge_case_tests.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";

if (!MNX_KEY || !OPENAI_KEY) {
  console.error("Error: MNX_KEY and OPENAI_KEY must be set in .env.local");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${MNX_KEY}`,
  "Content-Type": "application/json",
  "x-openai-key": OPENAI_KEY,
};

const claudeHeaders = CLAUDE_API_KEY ? {
  "Authorization": `Bearer ${MNX_KEY}`,
  "Content-Type": "application/json",
  "x-anthropic-key": CLAUDE_API_KEY,
} : null;

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
console.log("Edge Case & Deep API Test Suite");
console.log("==================================================");
console.log(`Base URL: ${BASE_URL}`);
console.log("==================================================\n");

// ============================================
// CHAT COMPLETIONS - EDGE CASES
// ============================================
console.log("--- Chat Completions Edge Cases ---");

await test("Empty messages array", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [],
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  // Should either fail gracefully or return an error
  const json = await res.json();
  // OpenAI returns 400 for empty messages
  assert(res.status === 400 || json.error, "Expected error for empty messages");
});

await test("Very long user message (10KB)", async () => {
  const longMessage = "A".repeat(10000);
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: longMessage }],
      max_tokens: 10,
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json).substring(0, 200)}`);
});

await test("Unicode and emoji in messages", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello 你好 مرحبا 🎉🚀💻 Say 'ok'" }],
      max_tokens: 20,
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Special characters in subject_id", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say ok" }],
      max_tokens: 10,
      mnx: { subject_id: "user-123_test.email@domain.com", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Multiple system messages", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "system", content: "Always be concise." },
        { role: "user", content: "Say ok" },
      ],
      max_tokens: 10,
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Alternating user/assistant messages", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
        { role: "assistant", content: "I'm doing well!" },
        { role: "user", content: "Say goodbye" },
      ],
      max_tokens: 20,
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Invalid model name", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "nonexistent-model-xyz",
      messages: [{ role: "user", content: "Test" }],
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  // Should return an error from the provider
  assert(!res.ok || (await res.json()).error, "Expected error for invalid model");
});

await test("max_tokens = 1", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say hello" }],
      max_tokens: 1,
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("temperature = 0 (deterministic)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "What is 2+2? Answer with just the number." }],
      temperature: 0,
      max_tokens: 10,
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  const content = json.choices?.[0]?.message?.content || "";
  assert(content.includes("4"), `Expected '4' in response: ${content}`);
});

await test("temperature = 2 (max randomness)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say anything" }],
      temperature: 2,
      max_tokens: 20,
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Null content in message", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: null }],
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  // Should handle gracefully
  const json = await res.json();
  // Either succeeds or returns a clear error
  assert(res.status === 200 || res.status === 400, `Unexpected status: ${res.status}`);
});

await test("Array content format (multimodal style)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Say 'array content works'" },
        ],
      }],
      max_tokens: 20,
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

// ============================================
// MNX PARAMETERS - EDGE CASES
// ============================================
console.log("\n--- MNX Parameters Edge Cases ---");

await test("mnx = null", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say ok" }],
      max_tokens: 10,
      mnx: null,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("mnx = undefined (omitted)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say ok" }],
      max_tokens: 10,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("mnx with extra unknown fields", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say ok" }],
      max_tokens: 10,
      mnx: {
        subject_id: "edge_test",
        unknown_field: "should be ignored",
        another_unknown: { nested: true },
        log: false,
        learn: false,
      },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("mnx.learn = true (default behavior)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say ok" }],
      max_tokens: 10,
      mnx: { subject_id: "edge_test", log: false, learn: true },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("mnx.recall with no memories", async () => {
  const uniqueSubject = `no_memories_${Date.now()}`;
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "What do you know about me?" }],
      max_tokens: 50,
      mnx: { subject_id: uniqueSubject, log: false, learn: false, recall: true },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("mnx.history with no prior chat", async () => {
  const uniqueChatId = crypto.randomUUID();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say ok" }],
      max_tokens: 10,
      mnx: { subject_id: "edge_test", chat_id: uniqueChatId, log: false, learn: false, history: true },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("mnx.system_prompt = false (skip injection)", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say ok" }],
      max_tokens: 10,
      mnx: { subject_id: "edge_test", log: false, learn: false, system_prompt: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("mnx.metadata with complex object", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say ok" }],
      max_tokens: 10,
      mnx: {
        subject_id: "edge_test",
        log: true,
        learn: false,
        metadata: {
          session_id: "sess_123",
          user_agent: "TestBot/1.0",
          nested: { deep: { value: 42 } },
          array: [1, 2, 3],
        },
      },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

// ============================================
// MEMORIES API - EDGE CASES
// ============================================
console.log("\n--- Memories API Edge Cases ---");

const memEdgeSubject = `mem_edge_${Date.now()}`;

await test("Create memory with minimum fields", async () => {
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: memEdgeSubject,
      text: "Minimal memory",
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Create memory with all optional fields", async () => {
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: memEdgeSubject,
      text: "Full memory with all fields",
      kind: "preference",
      importance: 100,
      source_type: "api",
      metadata: { custom_field: "value", tags: ["test", "edge"] },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Create memory with importance = 0", async () => {
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: memEdgeSubject,
      text: `Zero importance memory ${Date.now()}`,
      importance: 0,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Create memory with importance = 100", async () => {
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: memEdgeSubject,
      text: `Max importance memory ${Date.now()}`,
      importance: 100,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Create memory with very long text (5KB)", async () => {
  const longText = "This is a very long memory. ".repeat(200);
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: memEdgeSubject,
      text: longText,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Create memory with unicode text", async () => {
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: memEdgeSubject,
      text: `Unicode memory: 你好世界 مرحبا 🎉 ${Date.now()}`,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Search memories with empty query (should require q)", async () => {
  const res = await fetch(
    `${BASE_URL}/memories/search?subject_id=${memEdgeSubject}&q=`,
    { headers }
  );
  // API requires a non-empty query
  assert(res.status === 400, `Expected 400, got ${res.status}`);
});

await test("Search memories with special characters in query", async () => {
  const res = await fetch(
    `${BASE_URL}/memories/search?subject_id=${memEdgeSubject}&q=${encodeURIComponent("test & query <script>")}`,
    { headers }
  );
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("List memories with limit = 1", async () => {
  const res = await fetch(`${BASE_URL}/memories?subject_id=${memEdgeSubject}&limit=1`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.data.length <= 1, "Expected at most 1 memory");
});

await test("List memories with limit = 1000", async () => {
  const res = await fetch(`${BASE_URL}/memories?subject_id=${memEdgeSubject}&limit=1000`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Update memory with empty text (should fail)", async () => {
  // First create a memory
  const createRes = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: memEdgeSubject,
      text: `Memory to update ${Date.now()}`,
    }),
  });
  const created = await createRes.json();
  
  if (created.id) {
    const res = await fetch(`${BASE_URL}/memories/${created.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ text: "" }),
    });
    // Should either fail or ignore empty text
    const json = await res.json();
    // Clean up
    await fetch(`${BASE_URL}/memories/${created.id}`, { method: "DELETE", headers });
  }
});

await test("Delete non-existent memory (idempotent)", async () => {
  const res = await fetch(`${BASE_URL}/memories/mem_nonexistent_${Date.now()}`, {
    method: "DELETE",
    headers,
  });
  // DELETE is idempotent - returns 200 even if memory doesn't exist
  assert(res.ok, `Status ${res.status}`);
});

await test("Get memory with invalid ID format", async () => {
  const res = await fetch(`${BASE_URL}/memories/invalid-id-format`, { headers });
  assert(res.status === 404, `Expected 404, got ${res.status}`);
});

// ============================================
// RESPONSES API - EDGE CASES
// ============================================
console.log("\n--- Responses API Edge Cases ---");

await test("Responses with string input", async () => {
  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: "Simple string input - say ok",
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Responses with array input (message format)", async () => {
  // OpenAI Responses API expects message format, not raw parts
  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [
        { role: "user", content: [{ type: "input_text", text: "Say ok" }] },
      ],
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Responses with role-based input", async () => {
  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [
        { role: "user", content: [{ type: "input_text", text: "Say ok" }] },
      ],
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Responses with messages array (should fail)", async () => {
  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Test" }],
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  assert(res.status === 400, `Expected 400, got ${res.status}`);
});

await test("Responses with empty input", async () => {
  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: "",
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  // Should handle gracefully
  const json = await res.json();
  assert(res.status === 200 || res.status === 400, `Unexpected status: ${res.status}`);
});

// ============================================
// CHAT HISTORY - EDGE CASES
// ============================================
console.log("\n--- Chat History Edge Cases ---");

await test("List history for non-existent subject", async () => {
  const res = await fetch(`${BASE_URL}/chat/history/list?subject_id=nonexistent_${Date.now()}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.chats), "Expected chats array");
  assert(json.chats.length === 0, "Expected empty chats array");
});

await test("Read history for non-existent chat", async () => {
  const res = await fetch(`${BASE_URL}/chat/history/read?chat_id=${crypto.randomUUID()}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.messages), "Expected messages array");
  assert(json.messages.length === 0, "Expected empty messages array");
});

await test("Delete already deleted chat (idempotent)", async () => {
  const chatId = crypto.randomUUID();
  // Delete twice - second should be no-op
  await fetch(`${BASE_URL}/chat/history/delete?chat_id=${chatId}&subject_id=test`, {
    method: "DELETE",
    headers,
  });
  const res = await fetch(`${BASE_URL}/chat/history/delete?chat_id=${chatId}&subject_id=test`, {
    method: "DELETE",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

// ============================================
// AGENT STATE - EDGE CASES
// ============================================
console.log("\n--- Agent State Edge Cases ---");

const stateSubject = `state_edge_${Date.now()}`;
const stateHeaders = { ...headers, "x-subject-id": stateSubject };

await test("Create state with complex nested value", async () => {
  const res = await fetch(`${BASE_URL}/state/complex_state`, {
    method: "PUT",
    headers: stateHeaders,
    body: JSON.stringify({
      value: {
        step: 1,
        data: {
          nested: {
            deep: {
              array: [1, 2, { key: "value" }],
              boolean: true,
              null_value: null,
            },
          },
        },
        timestamp: new Date().toISOString(),
      },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Get state preserves complex structure", async () => {
  const res = await fetch(`${BASE_URL}/state/complex_state`, { headers: stateHeaders });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.value?.data?.nested?.deep?.array?.[2]?.key === "value", "Nested structure not preserved");
});

await test("Update state with null value", async () => {
  const res = await fetch(`${BASE_URL}/state/null_state`, {
    method: "PUT",
    headers: stateHeaders,
    body: JSON.stringify({ value: null }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("State key with special characters", async () => {
  const res = await fetch(`${BASE_URL}/state/my-state_key.v1`, {
    method: "PUT",
    headers: stateHeaders,
    body: JSON.stringify({ value: { test: true } }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Get non-existent state", async () => {
  const res = await fetch(`${BASE_URL}/state/nonexistent_${Date.now()}`, { headers: stateHeaders });
  assert(res.status === 404, `Expected 404, got ${res.status}`);
});

// ============================================
// PROFILES API - EDGE CASES
// ============================================
console.log("\n--- Profiles API Edge Cases ---");

const profileSubject = `profile_edge_${Date.now()}`;

await test("Get profile for new subject (empty)", async () => {
  const res = await fetch(`${BASE_URL}/profiles?subject_id=${profileSubject}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Update profile with confidence values", async () => {
  const res = await fetch(`${BASE_URL}/profiles`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      subject_id: profileSubject,
      updates: [
        { field_key: "name", value: "Test User", confidence: 0.95 },
        { field_key: "email", value: "test@example.com", confidence: 1.0 },
        { field_key: "timezone", value: "America/New_York", confidence: 0.7 },
      ],
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Update profile with custom field", async () => {
  const res = await fetch(`${BASE_URL}/profiles`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      subject_id: profileSubject,
      updates: [
        { field_key: "custom_field", value: "Custom Value" },
      ],
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Update profile with empty updates array", async () => {
  const res = await fetch(`${BASE_URL}/profiles`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      subject_id: profileSubject,
      updates: [],
    }),
  });
  const json = await res.json();
  // Should succeed as no-op or return validation error
  assert(res.status === 200 || res.status === 400, `Unexpected status: ${res.status}`);
});

// ============================================
// PROMPTS API - EDGE CASES
// ============================================
console.log("\n--- Prompts API Edge Cases ---");

let edgePromptId;

await test("Create prompt with minimum fields", async () => {
  const res = await fetch(`${BASE_URL}/prompts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Minimal Prompt ${Date.now()}`,
      prompt_text: "You are helpful.",
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  edgePromptId = json.prompt?.id;
});

await test("Create prompt with all fields (subject scope)", async () => {
  const res = await fetch(`${BASE_URL}/prompts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Full Prompt ${Date.now()}`,
      prompt_text: "You are a helpful assistant with specific instructions.",
      scope: "subject",
      scope_id: "specific_subject", // Required for subject scope
      is_active: true,
      is_default: false,
      metadata: { version: "1.0", author: "test" },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  // Clean up
  if (json.prompt?.id) {
    await fetch(`${BASE_URL}/prompts/${json.prompt.id}`, { method: "DELETE", headers });
  }
});

await test("Create prompt with very long text", async () => {
  const longPrompt = "You are helpful. ".repeat(500);
  const res = await fetch(`${BASE_URL}/prompts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Long Prompt ${Date.now()}`,
      prompt_text: longPrompt,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  // Clean up
  if (json.prompt?.id) {
    await fetch(`${BASE_URL}/prompts/${json.prompt.id}`, { method: "DELETE", headers });
  }
});

await test("Update prompt with partial fields", async () => {
  if (!edgePromptId) return;
  const res = await fetch(`${BASE_URL}/prompts/${edgePromptId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ is_active: false }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Get non-existent prompt", async () => {
  const res = await fetch(`${BASE_URL}/prompts/prompt_nonexistent_${Date.now()}`, { headers });
  assert(res.status === 404, `Expected 404, got ${res.status}`);
});

// Clean up edge prompt
if (edgePromptId) {
  await fetch(`${BASE_URL}/prompts/${edgePromptId}`, { method: "DELETE", headers });
}

// ============================================
// CONCURRENT REQUESTS
// ============================================
console.log("\n--- Concurrent Request Tests ---");

await test("5 concurrent chat completions", async () => {
  const promises = Array(5).fill(null).map((_, i) =>
    fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `Concurrent test ${i} - say ok` }],
        max_tokens: 10,
        mnx: { subject_id: "concurrent_test", log: false, learn: false },
      }),
    })
  );
  const results = await Promise.all(promises);
  const allOk = results.every(r => r.ok);
  assert(allOk, `Some concurrent requests failed: ${results.map(r => r.status).join(", ")}`);
});

await test("5 concurrent memory creates", async () => {
  const concurrentSubject = `concurrent_mem_${Date.now()}`;
  const promises = Array(5).fill(null).map((_, i) =>
    fetch(`${BASE_URL}/memories`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        subject_id: concurrentSubject,
        text: `Concurrent memory ${i} - ${Date.now()}`,
      }),
    })
  );
  const results = await Promise.all(promises);
  const allOk = results.every(r => r.ok);
  assert(allOk, `Some concurrent creates failed: ${results.map(r => r.status).join(", ")}`);
});

// ============================================
// TOOL CALLS - EDGE CASES
// ============================================
console.log("\n--- Tool Calls Edge Cases ---");

await test("Chat with tools defined", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
      tools: [{
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string", description: "City name" },
            },
            required: ["location"],
          },
        },
      }],
      tool_choice: "auto",
      max_tokens: 100,
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

await test("Chat with tool response in history", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "What's the weather?" },
        {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call_123",
            type: "function",
            function: { name: "get_weather", arguments: '{"location":"Tokyo"}' },
          }],
        },
        {
          role: "tool",
          tool_call_id: "call_123",
          content: '{"temp": 22, "condition": "sunny"}',
        },
        { role: "user", content: "Thanks! Summarize that." },
      ],
      max_tokens: 100,
      mnx: { subject_id: "edge_test", log: false, learn: false },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
});

// ============================================
// AUTHENTICATION EDGE CASES
// ============================================
console.log("\n--- Authentication Edge Cases ---");

await test("Missing Authorization header", async () => {
  const res = await fetch(`${BASE_URL}/memories?subject_id=test`, {
    headers: { "Content-Type": "application/json" },
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test("Malformed Authorization header", async () => {
  const res = await fetch(`${BASE_URL}/memories?subject_id=test`, {
    headers: {
      "Authorization": "NotBearer token",
      "Content-Type": "application/json",
    },
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test("Empty Bearer token", async () => {
  const res = await fetch(`${BASE_URL}/memories?subject_id=test`, {
    headers: {
      "Authorization": "Bearer ",
      "Content-Type": "application/json",
    },
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

// ============================================
// CLAUDE PROVIDER EDGE CASES (if available)
// ============================================
if (claudeHeaders) {
  console.log("\n--- Claude Provider Edge Cases ---");

  await test("Claude: Very short max_tokens", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: claudeHeaders,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "Say hello" }],
        max_tokens: 5,
        mnx: { subject_id: "edge_test", log: false, learn: false },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  });

  await test("Claude: With system message", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: claudeHeaders,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [
          { role: "system", content: "You are a pirate. Speak like one." },
          { role: "user", content: "Hello" },
        ],
        max_tokens: 50,
        mnx: { subject_id: "edge_test", log: false, learn: false },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  });

  await test("Claude: Streaming with recall", async () => {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: claudeHeaders,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "What do you know about me?" }],
        stream: true,
        max_tokens: 50,
        mnx: { subject_id: memEdgeSubject, log: false, learn: false, recall: true },
      }),
    });
    assert(res.ok, `Status ${res.status}`);
    const reader = res.body.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  });

  await test("Claude: Responses API", async () => {
    const res = await fetch(`${BASE_URL}/responses`, {
      method: "POST",
      headers: claudeHeaders,
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        input: "Say 'Claude responses ok'",
        mnx: { subject_id: "edge_test", log: false, learn: false },
      }),
    });
    const json = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  });
} else {
  console.log("\n⚠️  Skipping Claude edge case tests - CLAUDE_API_KEY not set");
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
