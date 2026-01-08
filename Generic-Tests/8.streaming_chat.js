/**
 * Streaming Chat Completions
 *
 * This example demonstrates streaming responses from the Chat Completions API.
 * Streaming is useful for real-time UIs where you want to show responses
 * as they're generated.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY and OPENAI_KEY
 *   2. node 8.streaming_chat.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import OpenAI from "openai";

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";
const SUBJECT_ID = `test_user_${Date.now()}`;

if (!MNX_KEY || !OPENAI_KEY) {
  console.error("Error: MNX_KEY and OPENAI_KEY must be set in .env.local");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: MNX_KEY,
  baseURL: BASE_URL,
  defaultHeaders: { "x-openai-key": OPENAI_KEY },
});

console.log("==================================================");
console.log("Streaming Chat Demo");
console.log("==================================================\n");

// 1. Basic streaming
console.log("[1] Basic streaming response...");
process.stdout.write("Response: ");

const stream = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Write a haiku about coding." }],
  stream: true,
  mnx: {
    subject_id: SUBJECT_ID,
    log: false,
    learn: false,
  },
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || "";
  process.stdout.write(content);
}
console.log("\n");

// 2. Streaming with memory learning
console.log("[2] Streaming with memory learning...");
process.stdout.write("Response: ");

const learnStream = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "I'm a photographer who loves landscapes and uses a Canon camera. Write me a short tip." }
  ],
  stream: true,
  mnx: {
    subject_id: SUBJECT_ID,
    log: true,
    learn: true, // Memories will be extracted after streaming completes
  },
});

for await (const chunk of learnStream) {
  const content = chunk.choices[0]?.delta?.content || "";
  process.stdout.write(content);
}
console.log("\n");

// Wait for memory extraction
console.log("(Waiting 3s for memory extraction...)");
await new Promise(r => setTimeout(r, 3000));

// 3. Streaming with memory recall
console.log("\n[3] Streaming with memory recall...");
process.stdout.write("Response: ");

const recallStream = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "What camera brand do I use?" }
  ],
  stream: true,
  mnx: {
    subject_id: SUBJECT_ID,
    log: false,
    learn: false,
    recall: true, // Inject memories before generating
  },
});

for await (const chunk of recallStream) {
  const content = chunk.choices[0]?.delta?.content || "";
  process.stdout.write(content);
}
console.log("\n");

// 4. Streaming with chat history
const CHAT_ID = crypto.randomUUID();
console.log("[4] Streaming with chat history...");
console.log(`Chat ID: ${CHAT_ID}`);

// First message
process.stdout.write("\nUser: My favorite number is 42.\nAssistant: ");
const hist1 = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "My favorite number is 42." }],
  stream: true,
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID,
    log: true,
    learn: false,
  },
});
for await (const chunk of hist1) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}

// Second message - should remember the first
process.stdout.write("\n\nUser: What's my favorite number?\nAssistant: ");
const hist2 = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What's my favorite number?" }],
  stream: true,
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID,
    log: true,
    learn: false,
    history: true, // Fetch previous messages from this chat
  },
});
for await (const chunk of hist2) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
console.log("\n");

console.log("==================================================");
console.log("Streaming Chat demo complete!");
console.log("==================================================");
