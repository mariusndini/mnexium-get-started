/**
 * Responses API (OpenAI's newer API format)
 *
 * This example demonstrates using the Responses API which is OpenAI's
 * newer format that uses `input` instead of `messages`.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY and OPENAI_KEY
 *   2. node 7.responses_api.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";
const SUBJECT_ID = `test_user_${Date.now()}`;
const CHAT_ID = crypto.randomUUID(); // Same chat ID for all requests in this run

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
console.log("Responses API Demo");
console.log("==================================================\n");

// 1. Basic Responses API call
console.log("[1] Basic Responses API call...");
const basicRes = await fetch(`${BASE_URL}/responses`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "gpt-4o-mini",
    input: "What is 2 + 2? Answer in one word.",
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID,
      log: false,
      learn: false,
    },
  }),
});
const basic = await basicRes.json();
console.log("Response:", basic.output_text || basic.output?.[0]?.content?.[0]?.text);

// 2. Responses API with conversation history
console.log("\n[2] Responses API with multi-turn conversation...");
const multiTurnRes = await fetch(`${BASE_URL}/responses`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "gpt-4o-mini",
    input: [
      { role: "user", content: [{ type: "input_text", text: "My name is Alice." }] },
      { role: "assistant", content: [{ type: "output_text", text: "Nice to meet you, Alice!" }] },
      { role: "user", content: [{ type: "input_text", text: "What's my name?" }] },
    ],
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID,
      log: false,
      learn: false,
    },
  }),
});
const multiTurn = await multiTurnRes.json();
console.log("Response:", multiTurn.output_text || multiTurn.output?.[0]?.content?.[0]?.text);

// 3. Responses API with memory learning
console.log("\n[3] Responses API with memory learning...");
const learnRes = await fetch(`${BASE_URL}/responses`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "gpt-4o-mini",
    input: "I'm a data scientist who loves Python and machine learning. I work at a startup in San Francisco.",
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID,
      log: true,
      learn: true, // Extract memories from this conversation
    },
  }),
});
const learn = await learnRes.json();
console.log("Response:", learn.output_text || learn.output?.[0]?.content?.[0]?.text);

// Wait for memory extraction
console.log("\n(Waiting 3s for memory extraction...)");
await new Promise(r => setTimeout(r, 3000));

// 4. Responses API with memory recall
console.log("\n[4] Responses API with memory recall...");
const recallRes = await fetch(`${BASE_URL}/responses`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "gpt-4o-mini",
    input: "What programming language do I use?",
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID,
      log: false,
      learn: false,
      recall: true, // Inject relevant memories
    },
  }),
});
const recall = await recallRes.json();
console.log("Response (with memories):", recall.output_text || recall.output?.[0]?.content?.[0]?.text);

// 5. Streaming Responses API
console.log("\n[5] Streaming Responses API...");
const streamRes = await fetch(`${BASE_URL}/responses`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "gpt-4o-mini",
    input: "Count from 1 to 5, one number per line.",
    stream: true,
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID,
      log: false,
      learn: false,
    },
  }),
});

process.stdout.write("Streaming: ");
const reader = streamRes.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let currentEvent = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";
  
  for (const line of lines) {
    // Track event type (Responses API uses "event:" lines)
    if (line.startsWith("event:")) {
      currentEvent = line.slice(6).trim();
      continue;
    }
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const json = JSON.parse(data);
      // Responses API sends text in response.output_text.delta events
      if (currentEvent === "response.output_text.delta") {
        const text = json.delta || "";
        if (text) process.stdout.write(text);
      }
    } catch {}
  }
}
console.log("\n");

console.log("==================================================");
console.log("Responses API demo complete!");
console.log("==================================================");
