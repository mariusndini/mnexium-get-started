/**
 * Memories CRUD Operations
 *
 * This example demonstrates how to create, read, update, and delete
 * memories using the Mnexium API directly.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY and OPENAI_KEY
 *   2. node 5.memories_crud.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";
const SUBJECT_ID = `test_user_${Date.now()}`;

if (!MNX_KEY || !OPENAI_KEY) {
  console.error("Error: MNX_KEY and OPENAI_KEY must be set in .env.local");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${MNX_KEY}`,
  "Content-Type": "application/json",
  "x-openai-key": OPENAI_KEY,
};

console.log("==================================================");
console.log("Memories CRUD Demo");
console.log("==================================================");
console.log(`Using subject_id: ${SUBJECT_ID}\n`);

// 1. CREATE a memory
console.log("[1] Creating a memory...");
const createRes = await fetch(`${BASE_URL}/memories`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    subject_id: SUBJECT_ID,
    text: "User's favorite color is blue",
    kind: "preference",
    importance: 80,
    tags: ["color", "preference"],
    metadata: { source: "direct_input" },
  }),
});
const created = await createRes.json();
console.log("Created:", created);
const memoryId = created.id;

// 2. LIST memories for subject
console.log("\n[2] Listing memories for subject...");
const listRes = await fetch(`${BASE_URL}/memories?subject_id=${SUBJECT_ID}`, {
  headers,
});
const list = await listRes.json();
console.log(`Found ${list.count} memories:`, list.data?.map(m => m.text));

// 3. GET a specific memory
console.log("\n[3] Getting specific memory...");
const getRes = await fetch(`${BASE_URL}/memories/${memoryId}`, {
  headers,
});
const memory = await getRes.json();
console.log("Memory details:", memory.data);

// 4. SUPERSEDE a memory (create new memory that replaces the old one)
// This is the recommended way to "update" memories - create a new one that supersedes the old
console.log("\n[4] Superseding memory (creating new memory that replaces old)...");
const supersededRes = await fetch(`${BASE_URL}/memories`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    subject_id: SUBJECT_ID,
    text: "User's favorite color is green",
    kind: "preference",
    importance: 90,
    tags: ["color", "preference"],
    supersedes: memoryId, // This marks the old memory as superseded
  }),
});
const superseded = await supersededRes.json();
console.log("New memory created:", superseded);
console.log(`  → Original memory (${memoryId}) is now superseded`);

// Verify the old memory is now superseded
const oldMemoryRes = await fetch(`${BASE_URL}/memories/${memoryId}`, { headers });
const oldMemory = await oldMemoryRes.json();
console.log(`  → Old memory status: ${oldMemory.data?.status}`);

// 5. SEARCH memories (only active memories are returned by default)
console.log("\n[5] Searching memories (only active)...");
const searchRes = await fetch(
  `${BASE_URL}/memories/search?subject_id=${SUBJECT_ID}&q=favorite%20color`,
  { headers }
);
const searchResults = await searchRes.json();
console.log(`Search found ${searchResults.count} active result(s):`);
searchResults.data?.forEach(m => {
  console.log(`  - "${m.text}" (score: ${m.score?.toFixed(1)}, status: ${m.status})`);
});

// 6. LIST all memories including superseded
console.log("\n[6] Listing ALL memories (including superseded)...");
const allMemoriesRes = await fetch(
  `${BASE_URL}/memories?subject_id=${SUBJECT_ID}&include_superseded=true`,
  { headers }
);
const allMemories = await allMemoriesRes.json();
console.log(`Total memories (including superseded): ${allMemories.count}`);
allMemories.data?.forEach(m => {
  console.log(`  - "${m.text}" (status: ${m.status})`);
});

// 7. DELETE a memory (soft delete)
console.log("\n[7] Deleting the new memory...");
const newMemoryId = superseded.id;
const deleteRes = await fetch(`${BASE_URL}/memories/${newMemoryId}`, {
  method: "DELETE",
  headers,
});
const deleted = await deleteRes.json();
console.log("Deleted:", deleted);

// 8. Verify - only active, non-deleted memories
console.log("\n[8] Verifying (active memories only)...");
const verifyRes = await fetch(`${BASE_URL}/memories?subject_id=${SUBJECT_ID}`, {
  headers,
});
const verifyList = await verifyRes.json();
console.log(`Active memories remaining: ${verifyList.count}`);

console.log("\n==================================================");
console.log("Memories CRUD demo complete!");
console.log("==================================================");
console.log("\nKey takeaways:");
console.log("  • Use 'supersedes' field to update memories (creates audit trail)");
console.log("  • Superseded memories are excluded from recall by default");
console.log("  • Use include_superseded=true to see full history");
