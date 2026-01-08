/**
 * Memory Recall Demo
 *
 * This example demonstrates how Mnexium can automatically inject
 * relevant memories into conversations. When memories=true, the
 * system searches for memories related to the user's message and
 * adds them to the context.
 *
 * Prerequisites:
 *   - Run 2.memory_extraction.js first to create some memories
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY, OPENAI_KEY, and SUBJECT_ID
 *   2. node 4.memories_recall.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import OpenAI from "openai";

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";
const CHAT_ID = crypto.randomUUID(); // Same chat ID for all requests in this run

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

const SUBJECT_ID = process.env.SUBJECT_ID || "memory_demo_user";

console.log("=".repeat(50));
console.log("Memory Recall Demo");
console.log("=".repeat(50));
console.log(`Using subject_id: ${SUBJECT_ID}`);

// First, let's create some memories by having a conversation
console.log("\n[Step 1] Creating memories...");
const setup = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "user",
      content:
        "Hi! My name is Alex and I'm a software engineer. I prefer dark mode and I'm learning Rust. I also love hiking on weekends.",
    },
  ],
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID,
    learn: "force", // Force memory extraction (don't let LLM decide)
    log: false,
  },
});
console.log("Assistant:", setup.choices[0].message.content);
console.log("\n(Waiting for memories to be processed...)");
await new Promise((r) => setTimeout(r, 5000));

// Now ask a question that should trigger memory recall
console.log("\n[Step 2] Asking a question with memories=true...");
console.log("User: What programming language am I learning?");

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What programming language am I learning?" }],
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID,
    recall: true, // ← NEW: Inject relevant memories into context
    learn: false,
    log: true,
  },
});

console.log("\nAssistant:", response.choices[0].message.content);

// Ask another question
console.log("\n[Step 3] Another question...");
console.log("User: What should I do this weekend?");

const response2 = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What should I do this weekend?" }],
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID,
    recall: true,
    learn: false,
    log: false,
  },
});

console.log("\nAssistant:", response2.choices[0].message.content);

console.log("\n" + "=".repeat(50));
console.log("Notice how the assistant knows about you without being told!");
console.log("This is because recall=true injects relevant stored memories.");
console.log("=".repeat(50));
