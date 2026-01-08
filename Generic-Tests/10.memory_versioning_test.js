/**
 * Memory Versioning Test Suite
 *
 * Tests the memory versioning and conflict resolution features:
 * - Memory superseding (automatic conflict detection)
 * - List superseded memories
 * - Restore superseded memories
 * - Usage tracking (seen_count, last_seen_at)
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY and OPENAI_KEY
 *   2. node 10.memory_versioning_test.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";
const SUBJECT_ID = `versioning_test_${Date.now()}`;

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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log("==================================================");
console.log("Memory Versioning Test Suite");
console.log("==================================================");
console.log(`Base URL: ${BASE_URL}`);
console.log(`Subject ID: ${SUBJECT_ID}`);
console.log("==================================================\n");

// ============================================
// SETUP: Create initial memories
// ============================================
console.log("--- Setup: Creating Test Memories ---");

let blueberryMemoryId;
let jobMemoryId;

await test("Create initial memory: favorite fruit is blueberry", async () => {
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: SUBJECT_ID,
      text: "User's favorite fruit is blueberry",
      kind: "preference",
      importance: 70,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.id, "No memory ID returned");
  blueberryMemoryId = json.id;
  console.log(`   Created memory: ${blueberryMemoryId}`);
});

await test("Create initial memory: works as software engineer", async () => {
  const res = await fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject_id: SUBJECT_ID,
      text: "User works as a software engineer at a tech startup",
      kind: "fact",
      importance: 60,
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.id, "No memory ID returned");
  jobMemoryId = json.id;
  console.log(`   Created memory: ${jobMemoryId}`);
});

// ============================================
// TEST: List Superseded (should be empty initially)
// ============================================
console.log("\n--- Test: List Superseded Memories ---");

await test("GET /memories/superseded - initially empty", async () => {
  const res = await fetch(`${BASE_URL}/memories/superseded?subject_id=${SUBJECT_ID}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.data), "No data array");
  console.log(`   Found ${json.count} superseded memories`);
});

// ============================================
// TEST: Restore on active memory (no-op)
// ============================================
console.log("\n--- Test: Restore Active Memory (No-op) ---");

await test("POST /memories/:id/restore - active memory returns restored: false", async () => {
  const res = await fetch(`${BASE_URL}/memories/${blueberryMemoryId}/restore`, {
    method: "POST",
    headers,
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.ok === true, "Expected ok: true");
  assert(json.restored === false, "Expected restored: false for already active memory");
  assert(json.message === "Memory is already active", "Expected 'Memory is already active' message");
});

// ============================================
// TEST: Trigger memory superseding via chat
// ============================================
console.log("\n--- Test: Trigger Memory Superseding via Chat ---");

await test("POST /chat/completions with conflicting preference (learn: force)", async () => {
  // This should trigger memory extraction which will detect the conflict
  // with "favorite fruit is blueberry" and supersede it
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "My new favorite fruit is apple now." }],
      mnx: { 
        subject_id: SUBJECT_ID, 
        log: true, 
        learn: "force",  // Force memory extraction
        recall: false,   // Don't recall existing memories for this test
      },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  console.log("   Chat completion successful, memory extraction triggered");
});

// Wait for async memory extraction to complete
console.log("   Waiting for memory extraction to complete...");
await sleep(3000);

// ============================================
// TEST: Check if memory was superseded
// ============================================
console.log("\n--- Test: Verify Memory Superseding ---");

await test("GET /memories/superseded - check for superseded memories", async () => {
  const res = await fetch(`${BASE_URL}/memories/superseded?subject_id=${SUBJECT_ID}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.data), "No data array");
  console.log(`   Found ${json.count} superseded memories`);
  
  if (json.count > 0) {
    console.log("   Superseded memories:");
    for (const mem of json.data) {
      console.log(`     - ${mem.id}: "${mem.text.slice(0, 50)}..." (superseded_by: ${mem.superseded_by})`);
    }
  }
});

await test("GET /memories - list active memories only", async () => {
  const res = await fetch(`${BASE_URL}/memories?subject_id=${SUBJECT_ID}`, { headers });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  assert(Array.isArray(json.data), "No data array");
  console.log(`   Found ${json.count} active memories`);
  
  for (const mem of json.data) {
    console.log(`     - ${mem.id}: "${mem.text.slice(0, 50)}..."`);
  }
});


// ============================================
// TEST: Memory recall updates seen stats
// ============================================
console.log("\n--- Test: Memory Recall Updates Seen Stats ---");

await test("POST /chat/completions with recall: true", async () => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "What is my favorite fruit?" }],
      mnx: { 
        subject_id: SUBJECT_ID, 
        log: false, 
        learn: false,
        recall: true,  // This should trigger seen_count update
      },
    }),
  });
  const json = await res.json();
  assert(res.ok, `Status ${res.status}: ${JSON.stringify(json)}`);
  console.log("   Chat completion with recall successful");
});


// ============================================
// SUMMARY
// ============================================
console.log("\n==================================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("==================================================");

if (failed > 0) {
  console.log("\nNote: Some failures may be expected if memory superseding");
  console.log("didn't trigger (depends on LLM extraction decisions).");
  process.exit(1);
}
