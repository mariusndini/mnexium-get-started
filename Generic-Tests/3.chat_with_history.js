/**
 * Multi-turn Conversation with History
 *
 * This example shows how to use Mnexium's automatic history
 * prepending. When history=true, previous messages from the
 * same chat_id are automatically included in the context.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY, OPENAI_KEY, and SUBJECT_ID
 *   2. node chat_with_history.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import OpenAI from "openai";

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";

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

const CHAT_ID = crypto.randomUUID(); 
const SUBJECT_ID = process.env.SUBJECT_ID || "demo_user";

async function chat(message) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: message }],
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID,
      log: true, // Save this turn to history
      learn: true, // Extract any memories
      history: true, // Prepend previous messages from this chat_id
    },
  });
  return response.choices[0].message.content;
}

// Simulate a multi-turn conversation
console.log("=".repeat(50));
console.log("Multi-turn Conversation Demo");
console.log("=".repeat(50));

// Turn 1
console.log("\n[Turn 1]");
console.log("User: My favorite color is blue and I love pizza.");
const response1 = await chat("My favorite color is blue and I love pizza.");
console.log(`Assistant: ${response1}`);

// Turn 2 - The assistant should remember what we said
console.log("\n[Turn 2]");
console.log("User: What's my favorite color?");
const response2 = await chat("What's my favorite color?");
console.log(`Assistant: ${response2}`);

// Turn 3 - Test memory of food preference
console.log("\n[Turn 3]");
console.log("User: What food do I like?");
const response3 = await chat("What food do I like?");
console.log(`Assistant: ${response3}`);

console.log("\n" + "=".repeat(50));
console.log("Notice how the assistant remembers context from previous turns!");
console.log("This works because history=true prepends the conversation history.");
