/**
 * Memory Extraction Demo
 *
 * This example demonstrates how Mnexium automatically extracts
 * memories from conversations. The LLM analyzes messages and
 * stores relevant facts about the user.
 *
 * learn: true   - Extract memories only if conversation seems meaningful
 * learn: "force" - Always extract memories, even from short/simple messages
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY, OPENAI_KEY, and SUBJECT_ID
 *   2. node 2.memory_extraction.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import OpenAI from "openai";

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const SUBJECT_ID = process.env.SUBJECT_ID || "demo_user";
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";
const CHAT_ID = crypto.randomUUID(); // Generate a new UUID for each run

if (!MNX_KEY) {
  console.error("Error: MNX_KEY is not set. Add it to .env.local");
  process.exit(1);
}
if (!OPENAI_KEY) {
  console.error("Error: OPENAI_KEY is not set. Add it to .env.local");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: MNX_KEY,
  baseURL: BASE_URL,
  defaultHeaders: { "x-openai-key": OPENAI_KEY },
});

// This message contains personal information that Mnexium will extract
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "user",
      content:
        "Hi! My name is Alex and I'm a software engineer. I prefer dark mode and I'm learning Rust.",
    },
  ],
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID,
    log: true, // Save to chat history
    learn: true, // Extract memories (LLM decides what's worth remembering)
  },
});

console.log("Assistant Response:");
console.log(response.choices[0].message.content);

// Example 2: Force memory extraction
// Use learn: "force" to always extract memories, even from simple messages
console.log("\n" + "=".repeat(50));
console.log("Testing learn: 'force' mode...\n");

const forceResponse = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "user",
      content: "I love pizza.", // Simple message that might be skipped normally
    },
  ],
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID,
    log: true,
    learn: "force", // FORCE memory extraction even for simple messages
  },
});

console.log("Force extraction response:");
console.log(forceResponse.choices[0].message.content);

console.log("\n" + "=".repeat(50));
console.log("Check your Mnexium dashboard to see extracted memories!");
console.log("Memories might include:");
console.log("  - User's name is Alex");
console.log("  - User is a software engineer");
console.log("  - User prefers dark mode");
console.log("  - User is learning Rust");
console.log("  - User loves pizza (from force mode)");
