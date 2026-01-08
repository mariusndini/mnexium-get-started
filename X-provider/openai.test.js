/**
 * OpenAI Provider Comprehensive Test
 * 
 * Tests OpenAI models through Mnexium extensively:
 * - Non-streaming
 * - Streaming
 * - Tool/Function calling
 * - Multi-turn conversation with history
 * - Memory recall
 * - Memory learning
 * - System prompts
 * - Max tokens / temperature
 * 
 * Run: node X-provider/openai.test.js
 */

import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://mnexium.com/api/v1";

if (!MNX_KEY) {
  console.error("Error: MNX_KEY is not set. Add it to .env.local");
  process.exit(1);
}
if (!OPENAI_KEY) {
  console.error("Error: OPENAI_KEY is not set. Add it to .env.local");
  process.exit(1);
}

const MODEL = "gpt-4o-mini";
const SUBJECT_ID = `openai_test_${Date.now()}`;

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

// OpenAI client pointing to Mnexium
const client = new OpenAI({
  apiKey: MNX_KEY,
  baseURL: BASE_URL,
  defaultHeaders: { "x-openai-key": OPENAI_KEY },
});

// ============================================================
// TEST: Non-Streaming
// ============================================================
async function testNonStreaming() {
  console.log("\n--- Test: Non-Streaming ---");
  
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "Say 'OpenAI test ok' and nothing else." }],
      max_tokens: 50,
      mnx: { subject_id: SUBJECT_ID, log: false, learn: false },
    });

    const content = response.choices?.[0]?.message?.content || "";
    if (content.toLowerCase().includes("ok") || content.toLowerCase().includes("openai")) {
      pass("Non-Streaming", `Response: "${content.substring(0, 50)}"`);
    } else {
      fail("Non-Streaming", `Unexpected: ${content.substring(0, 100)}`);
    }

    // Verify OpenAI response format
    if (response.id && response.choices && response.usage) {
      pass("OpenAI Response Format", `ID: ${response.id}`);
    } else {
      fail("OpenAI Response Format", "Missing expected fields");
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
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "Count from 1 to 5, one number per line." }],
      stream: true,
      mnx: { subject_id: SUBJECT_ID, log: false, learn: false },
    });

    let content = "";
    for await (const chunk of stream) {
      content += chunk.choices?.[0]?.delta?.content || "";
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
    const tools = [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get the current weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string", description: "City name" },
            },
            required: ["location"],
          },
        },
      },
    ];

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
      tools,
      tool_choice: "auto",
      mnx: { subject_id: SUBJECT_ID, log: false, learn: false },
    });

    const toolCalls = response.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      const call = toolCalls[0];
      if (call.function?.name === "get_weather") {
        pass("Tool Calling", `Called: ${call.function.name}`);
        
        const args = JSON.parse(call.function.arguments || "{}");
        if (args.location?.toLowerCase().includes("tokyo")) {
          pass("Tool Arguments", `Location: ${args.location}`);
        } else {
          fail("Tool Arguments", `Expected Tokyo, got: ${args.location}`);
        }
      } else {
        fail("Tool Calling", `Wrong function: ${call.function?.name}`);
      }
    } else {
      fail("Tool Calling", "No tool calls returned");
    }
  } catch (err) {
    fail("Tool Calling", err.message);
  }
}

// ============================================================
// TEST: Multi-turn Conversation with History
// ============================================================
async function testMultiTurnHistory() {
  console.log("\n--- Test: Multi-turn with History ---");
  
  const chatId = crypto.randomUUID();
  const subjectId = `openai_history_${Date.now()}`;
  
  try {
    // First message
    const res1 = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "My favorite number is 42." }],
      max_tokens: 50,
      mnx: { subject_id: subjectId, chat_id: chatId, log: true, learn: false, history: true },
    });
    
    if (res1.choices?.[0]?.message?.content) {
      pass("History - First Message", "Sent");
    } else {
      fail("History - First Message", "No response");
      return;
    }

    // Wait for logging
    await new Promise(r => setTimeout(r, 1500));

    // Second message - should have history context
    const res2 = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "What is my favorite number?" }],
      max_tokens: 50,
      mnx: { subject_id: subjectId, chat_id: chatId, log: true, learn: false, history: true },
    });

    const content = res2.choices?.[0]?.message?.content || "";
    if (content.includes("42")) {
      pass("History - Context Preserved", `Found 42 in response`);
    } else {
      fail("History - Context Preserved", `42 not found: "${content.substring(0, 100)}"`);
    }
  } catch (err) {
    fail("Multi-turn History", err.message);
  }
}

// ============================================================
// TEST: Memory Learning & Recall
// ============================================================
async function testMemoryLearnRecall() {
  console.log("\n--- Test: Memory Learn & Recall ---");
  
  const subjectId = `openai_memory_${Date.now()}`;
  const uniqueFact = `My pet dragon is named Sparky${Date.now()}`;
  
  try {
    // Learn a memory
    await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: uniqueFact }],
      max_tokens: 50,
      mnx: { subject_id: subjectId, log: false, learn: "force" },
    });
    pass("Memory Learn", "Sent fact to learn");

    // Wait for memory extraction
    await new Promise(r => setTimeout(r, 5000));

    // Recall the memory
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "What do you know about my pet?" }],
      max_tokens: 100,
      mnx: { subject_id: subjectId, log: false, learn: false, recall: true },
    });

    const content = res.choices?.[0]?.message?.content || "";
    if (content.toLowerCase().includes("sparky") || content.toLowerCase().includes("dragon")) {
      pass("Memory Recall", `Found pet info in response`);
    } else {
      fail("Memory Recall", `Pet info not found: "${content.substring(0, 100)}"`);
    }
  } catch (err) {
    fail("Memory Learn & Recall", err.message);
  }
}

// ============================================================
// TEST: System Prompt
// ============================================================
async function testSystemPrompt() {
  console.log("\n--- Test: System Prompt ---");
  
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: "You are a pirate. Always respond like a pirate." },
        { role: "user", content: "Hello, how are you?" },
      ],
      max_tokens: 100,
      mnx: { subject_id: SUBJECT_ID, log: false, learn: false },
    });

    const content = response.choices?.[0]?.message?.content?.toLowerCase() || "";
    if (content.includes("arr") || content.includes("matey") || content.includes("ahoy") || content.includes("ye")) {
      pass("System Prompt", `Pirate response detected`);
    } else {
      fail("System Prompt", `No pirate speak: "${content.substring(0, 100)}"`);
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
    // Low temperature - should be deterministic
    const res1 = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "What is 2+2? Reply with just the number." }],
      temperature: 0,
      max_tokens: 10,
      mnx: { subject_id: SUBJECT_ID, log: false, learn: false },
    });

    const content = res1.choices?.[0]?.message?.content || "";
    if (content.includes("4")) {
      pass("Temperature 0", `Got deterministic answer: ${content.trim()}`);
    } else {
      fail("Temperature 0", `Unexpected: ${content}`);
    }

    // Max tokens limit
    const res2 = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "Write a very long essay about the universe." }],
      max_tokens: 20,
      mnx: { subject_id: SUBJECT_ID, log: false, learn: false },
    });

    const content2 = res2.choices?.[0]?.message?.content || "";
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
  console.log("OPENAI PROVIDER COMPREHENSIVE TEST");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Model: ${MODEL}`);

  await testNonStreaming();
  await testStreaming();
  await testToolCalling();
  await testMultiTurnHistory();
  await testMemoryLearnRecall();
  await testSystemPrompt();
  await testTemperatureMaxTokens();

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`  Passed: ${passCount}`);
  console.log(`  Failed: ${failCount}`);

  if (failCount === 0) {
    console.log("\n🎉 All OpenAI tests passed!");
  } else {
    console.log("\n⚠️  Some tests failed. Review the output above.");
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
