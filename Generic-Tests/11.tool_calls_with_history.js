/**
 * Tool Calls with History Reconstruction
 *
 * This example tests that tool calls are properly stored and reconstructed
 * when using history: true. It makes multiple API calls with the same chat_id
 * and relies on Mnexium to reconstruct the conversation from stored history.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY and OPENAI_KEY
 *   2. node 11.tool_calls_with_history.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import OpenAI from "openai";

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const SUBJECT_ID = process.env.SUBJECT_ID || "history_test_user";
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

// Use a unique chat_id for this test
const CHAT_ID = crypto.randomUUID();

// Define tools
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City and state" },
        },
        required: ["location"],
      },
    },
  },
];

// Simulate tool execution
function executeToolCall(name, args) {
  console.log(`  → Executing: ${name}(${JSON.stringify(args)})`);
  if (name === "get_weather") {
    return JSON.stringify({ location: args.location, temp: 72, condition: "sunny" });
  }
  return JSON.stringify({ error: "Unknown tool" });
}

console.log("==================================================");
console.log("Tool Calls with History Reconstruction Test");
console.log("==================================================");
console.log(`Chat ID: ${CHAT_ID}`);
console.log(`Subject ID: ${SUBJECT_ID}`);
console.log("==================================================\n");

// STEP 1: Initial request that triggers a tool call
// Using history: false for the first call (no history yet)
console.log("[Step 1] Initial request - triggers tool call...");
let response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What's the weather in Boston?" }],
  tools,
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID,
    log: true,
    learn: false,
    history: false, // First message, no history
  },
});

let assistantMessage = response.choices[0].message;
console.log("Tool calls requested:", assistantMessage.tool_calls?.length || 0);

// STEP 2: Execute tool and send result
// Still using history: false because we're managing the messages ourselves
if (assistantMessage.tool_calls) {
  const messages = [
    { role: "user", content: "What's the weather in Boston?" },
    assistantMessage,
  ];
  
  for (const toolCall of assistantMessage.tool_calls) {
    const result = executeToolCall(
      toolCall.function.name,
      JSON.parse(toolCall.function.arguments)
    );
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: result,
    });
  }
  
  console.log("\n[Step 2] Sending tool result...");
  response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools,
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID,
      log: true,
      learn: false,
      history: false, // Still managing messages ourselves
    },
  });
  
  assistantMessage = response.choices[0].message;
  console.log("Response:", assistantMessage.content?.slice(0, 100) + "...");
}

// Wait for logging to complete
console.log("\n(Waiting 2s for logs to be written...)");
await new Promise(r => setTimeout(r, 2000));

// STEP 3: New request using history: true
// This should reconstruct the previous conversation from ClickHouse
console.log("\n[Step 3] Follow-up with history: true...");
console.log("Sending: 'What about New York?' (should remember we were talking about weather)");

response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What about New York?" }],
  tools,
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID,
    log: true,
    learn: false,
    history: true, // ← Reconstruct from stored history
  },
});

assistantMessage = response.choices[0].message;

// Wait for Step 3 to be logged before proceeding
console.log("(Waiting 2s for Step 3 to be logged...)");
await new Promise(r => setTimeout(r, 2000));

if (assistantMessage.tool_calls) {
  console.log("Tool calls requested:", assistantMessage.tool_calls.length);
  console.log("Tool call ID:", assistantMessage.tool_calls[0]?.id);
  
  // When using history: true, the assistant message with tool_calls is already
  // in history (it was logged in Step 3). We only need to send the tool responses.
  const messages = [];
  
  for (const toolCall of assistantMessage.tool_calls) {
    const result = executeToolCall(
      toolCall.function.name,
      JSON.parse(toolCall.function.arguments)
    );
    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: result,
    });
  }
  
  console.log("\n[Step 4] Sending tool result for follow-up...");
  console.log("Sending messages:", JSON.stringify(messages, null, 2));
  
  // History will include: user + assistant (with tool_calls)
  // We only send: tool responses
  // Merged: user + assistant + tool → correct!
  response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools,
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID,
      log: true,
      learn: false,
      history: true, // Fetch history (includes user + assistant with tool_calls)
    },
  });
  
  assistantMessage = response.choices[0].message;
}

console.log("\nFinal Response:", assistantMessage.content);

console.log("\n==================================================");
console.log("If the model understood 'What about New York?' as a weather");
console.log("question, then history reconstruction is working correctly!");
console.log("==================================================");
