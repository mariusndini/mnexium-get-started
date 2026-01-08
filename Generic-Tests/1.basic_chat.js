/**
 * Basic Chat Completion with Mnexium
 *
 * This example shows the minimal setup to use Mnexium as a drop-in
 * replacement for the OpenAI API. Just change the base URL and add
 * your OpenAI key as a header.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY, OPENAI_KEY, and SUBJECT_ID
 *   2. node basic_chat.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import OpenAI from "openai";

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const SUBJECT_ID = process.env.SUBJECT_ID || "demo_user";
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

// One-time client setup
const client = new OpenAI({
  apiKey: MNX_KEY,
  baseURL: BASE_URL,
  defaultHeaders: { "x-openai-key": OPENAI_KEY },
});

// Make a request - works exactly like the OpenAI SDK
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What is the capital of France?" }],
  // Mnexium-specific options via extra body
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID,
    log: false, // Don't save this to history
    learn: false, // Don't extract memories
  },
});

console.log("Response:");
console.log(response.choices[0].message.content);
