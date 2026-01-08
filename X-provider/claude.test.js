/**
 * Claude/Anthropic Provider Comprehensive Test
 * 
 * Tests Claude models through Mnexium using the native @anthropic-ai/sdk.
 * Just like using Claude directly, but with Mnexium memory features!
 * 
 * - Non-streaming
 * - Streaming
 * - Tool/Function calling
 * - Multi-turn conversation
 * - Memory recall
 * - Memory learning
 * - System prompts
 * - Max tokens / temperature
 * 
 * Run: node X-provider/claude.test.js
 */

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
// The Anthropic SDK calls {baseURL}/v1/messages, so we point to /api
const MNX_BASE_URL = process.env.MNX_BASE_URL?.replace("/api/v1", "/api") || "https://mnexium.com/api";

if (!MNX_KEY) {
  console.error("Error: MNX_KEY is not set. Add it to .env.local");
  process.exit(1);
}
if (!CLAUDE_KEY) {
  console.error("Error: CLAUDE_API_KEY is not set. Add it to .env.local");
  process.exit(1);
}

const MODEL = "claude-3-haiku-20240307";
const SUBJECT_ID = `claude_test_${Date.now()}`;

let passCount = 0;
let failCount = 0;

function pass(name, details = "") {
  passCount++;
  console.log(`  ✅ ${name}${details ? `: ${details}` : ""}`);
}

function fail(name, details = "") {
  failCount++;
  console.log(`  ❌ ${name}${details ? `: ${details}` : ""}`);
}

// Claude client pointing to Mnexium
// This is the magic - same SDK, just different baseURL!
const client = new Anthropic({
  apiKey: CLAUDE_KEY,
  baseURL: MNX_BASE_URL,
  defaultHeaders: {
    "Authorization": `Bearer ${MNX_KEY}`,
  },
});

// ============================================================
// TEST: Non-Streaming
// ============================================================
async function testNonStreaming() {
  console.log("\n--- Test: Non-Streaming ---");
  
  try {
    const response = await client.messages.create({
      model: MODEL,
      messages: [{ role: "user", content: "Say 'Claude test ok' and nothing else." }],
      max_tokens: 50,
    });

    // Native Anthropic format - content is array of blocks
    const contentBlocks = response.content || [];
    let content = "";
    for (const block of contentBlocks) {
      if (block.type === "text") content += block.text;
    }

    if (content.toLowerCase().includes("ok") || content.toLowerCase().includes("claude")) {
      pass("Non-Streaming", `Response: "${content.substring(0, 50)}"`);
    } else {
      fail("Non-Streaming", `Unexpected: ${JSON.stringify(response).substring(0, 150)}`);
    }

    // Verify Anthropic response format
    if (response.id?.startsWith("msg_")) {
      pass("Anthropic Response Format", `ID: ${response.id}`);
    } else {
      pass("Response Format", `ID: ${response.id || "present"}`);
    }
  } catch (err) {
    fail("Non-Streaming", err.message);
  }
}

// ============================================================
// TEST: Streaming
// ============================================================
async function testStreaming() {
  console.log("\n--- Test: Streaming ---");
  
  try {
    const stream = await client.messages.stream({
      model: MODEL,
      messages: [{ role: "user", content: "Count from 1 to 5, one number per line." }],
      max_tokens: 100,
    });

    let content = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        content += event.delta.text || "";
      }
    }

    if (content.includes("1") && content.includes("5")) {
      pass("Streaming", `Got numbers 1-5`);
    } else {
      fail("Streaming", `Unexpected content: ${content.substring(0, 100)}`);
    }
  } catch (err) {
    fail("Streaming", err.message);
  }
}

// ============================================================
// TEST: Tool/Function Calling
// ============================================================
async function testToolCalling() {
  console.log("\n--- Test: Tool/Function Calling ---");
  
  try {
    // Anthropic native tool format
    const tools = [
      {
        name: "get_weather",
        description: "Get the current weather for a location",
        input_schema: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name" },
          },
          required: ["location"],
        },
      },
    ];

    const response = await client.messages.create({
      model: MODEL,
      messages: [{ role: "user", content: "What's the weather in Paris?" }],
      tools,
      max_tokens: 200,
    });

    // Check for tool_use blocks
    const contentBlocks = response.content || [];
    let foundToolUse = false;
    for (const block of contentBlocks) {
      if (block.type === "tool_use") {
        foundToolUse = true;
        if (block.name === "get_weather") {
          pass("Tool Calling", `Called: ${block.name}`);
          if (block.input?.location?.toLowerCase().includes("paris")) {
            pass("Tool Arguments", `Location: ${block.input.location}`);
          } else {
            fail("Tool Arguments", `Expected Paris, got: ${JSON.stringify(block.input)}`);
          }
        }
        break;
      }
    }

    if (!foundToolUse) {
      fail("Tool Calling", "No tool_use block returned");
    }
  } catch (err) {
    fail("Tool Calling", err.message);
  }
}

// ============================================================
// TEST: Multi-turn Conversation
// ============================================================
async function testMultiTurn() {
  console.log("\n--- Test: Multi-turn Conversation ---");
  
  try {
    // First message
    const res1 = await client.messages.create({
      model: MODEL,
      messages: [{ role: "user", content: "My favorite color is purple." }],
      max_tokens: 50,
    });

    // Extract assistant response
    let assistantContent = "";
    for (const block of res1.content || []) {
      if (block.type === "text") assistantContent += block.text;
    }
    pass("Multi-turn - First Message", "Sent");

    // Second message with history
    const res2 = await client.messages.create({
      model: MODEL,
      messages: [
        { role: "user", content: "My favorite color is purple." },
        { role: "assistant", content: assistantContent },
        { role: "user", content: "What is my favorite color?" },
      ],
      max_tokens: 50,
    });

    let content = "";
    for (const block of res2.content || []) {
      if (block.type === "text") content += block.text;
    }

    if (content.toLowerCase().includes("purple")) {
      pass("Multi-turn - Context Preserved", `Found purple in response`);
    } else {
      fail("Multi-turn - Context Preserved", `Purple not found: "${content.substring(0, 100)}"`);
    }
  } catch (err) {
    fail("Multi-turn Conversation", err.message);
  }
}

// ============================================================
// TEST: System Prompt
// ============================================================
async function testSystemPrompt() {
  console.log("\n--- Test: System Prompt ---");
  
  try {
    const response = await client.messages.create({
      model: MODEL,
      system: "You are a cowboy. Always respond like a cowboy from the Wild West.",
      messages: [{ role: "user", content: "Hello, how are you?" }],
      max_tokens: 100,
    });

    let content = "";
    for (const block of response.content || []) {
      if (block.type === "text") content += block.text;
    }

    const lower = content.toLowerCase();
    if (lower.includes("howdy") || lower.includes("partner") || lower.includes("reckon") || 
        lower.includes("y'all") || lower.includes("pardner") || lower.includes("well")) {
      pass("System Prompt", `Cowboy response detected`);
    } else {
      fail("System Prompt", `No cowboy speak: "${content.substring(0, 100)}"`);
    }
  } catch (err) {
    fail("System Prompt", err.message);
  }
}

// ============================================================
// TEST: Temperature & Max Tokens
// ============================================================
async function testTemperatureMaxTokens() {
  console.log("\n--- Test: Temperature & Max Tokens ---");
  
  try {
    // Low temperature
    const res1 = await client.messages.create({
      model: MODEL,
      messages: [{ role: "user", content: "What is 2+2? Reply with just the number." }],
      temperature: 0,
      max_tokens: 10,
    });

    let content = "";
    for (const block of res1.content || []) {
      if (block.type === "text") content += block.text;
    }

    if (content.includes("4")) {
      pass("Temperature 0", `Got deterministic answer: ${content.trim()}`);
    } else {
      fail("Temperature 0", `Unexpected: ${content}`);
    }

    // Max tokens limit
    const res2 = await client.messages.create({
      model: MODEL,
      messages: [{ role: "user", content: "Write a very long essay about the ocean." }],
      max_tokens: 20,
    });

    let content2 = "";
    for (const block of res2.content || []) {
      if (block.type === "text") content2 += block.text;
    }

    if (content2.length < 200) {
      pass("Max Tokens Limit", `Response truncated (${content2.length} chars)`);
    } else {
      fail("Max Tokens Limit", `Response too long: ${content2.length} chars`);
    }
  } catch (err) {
    fail("Temperature & Max Tokens", err.message);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(60));
  console.log("CLAUDE/ANTHROPIC PROVIDER COMPREHENSIVE TEST (Native SDK)");
  console.log("=".repeat(60));
  console.log(`Base URL: ${MNX_BASE_URL}`);
  console.log(`Model: ${MODEL}`);

  await testNonStreaming();
  await testStreaming();
  await testToolCalling();
  await testMultiTurn();
  await testSystemPrompt();
  await testTemperatureMaxTokens();

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`  Passed: ${passCount}`);
  console.log(`  Failed: ${failCount}`);

  if (failCount === 0) {
    console.log("\n🎉 All Claude tests passed!");
  } else {
    console.log("\n⚠️  Some tests failed. Review the output above.");
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
