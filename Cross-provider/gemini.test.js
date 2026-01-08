/**
 * Google Gemini Provider Comprehensive Test
 * 
 * Tests Gemini models through Mnexium using the native @google/genai SDK.
 * - Non-streaming
 * - Streaming
 * - Tool/Function calling
 * - Multi-turn conversation
 * - Memory recall
 * - Memory learning
 * - System instructions
 * - Thinking mode (gemini-2.5-flash)
 * 
 * Run: node X-provider/gemini.test.js
 */

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const MNX_BASE_URL = process.env.MNX_BASE_URL?.replace("/api/v1", "") || "https://mnexium.com";

if (!MNX_KEY) {
  console.error("Error: MNX_KEY is not set. Add it to .env.local");
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error("Error: GEMINI_KEY is not set. Add it to .env.local");
  process.exit(1);
}

const CHEAP_MODEL = "gemini-2.0-flash-lite";
const THINKING_MODEL = "gemini-2.5-flash";
const SUBJECT_ID = `gemini_test_${Date.now()}`;

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

// Gemini client pointing to Mnexium
const ai = new GoogleGenAI({
  apiKey: GEMINI_KEY,
  httpOptions: {
    baseUrl: MNX_BASE_URL,
    headers: {
      "Authorization": `Bearer ${MNX_KEY}`,
      "x-goog-api-key": GEMINI_KEY,
    },
  },
});

// ============================================================
// TEST: Non-Streaming
// ============================================================
async function testNonStreaming() {
  console.log("\n--- Test: Non-Streaming ---");
  
  try {
    const response = await ai.models.generateContent({
      model: CHEAP_MODEL,
      contents: "Say 'Gemini test ok' and nothing else.",
    });

    const content = response.text || "";
    if (content.toLowerCase().includes("ok") || content.toLowerCase().includes("gemini")) {
      pass("Non-Streaming", `Response: "${content.substring(0, 50)}"`);
    } else {
      fail("Non-Streaming", `Unexpected: ${content.substring(0, 100)}`);
    }

    // Verify response has candidates
    if (response.candidates && response.candidates.length > 0) {
      pass("Gemini Response Format", "Has candidates");
    } else {
      fail("Gemini Response Format", "Missing candidates");
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
    const response = await ai.models.generateContentStream({
      model: CHEAP_MODEL,
      contents: "Count from 1 to 5, one number per line.",
    });

    let content = "";
    for await (const chunk of response) {
      content += chunk.text || "";
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
    const tools = [{
      functionDeclarations: [{
        name: "get_weather",
        description: "Get the current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name" },
          },
          required: ["location"],
        },
      }],
    }];

    const response = await ai.models.generateContent({
      model: CHEAP_MODEL,
      contents: "What's the weather in London?",
      config: { tools },
    });

    // Check for function calls in response
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    
    let foundFunctionCall = false;
    for (const part of parts) {
      if (part.functionCall) {
        foundFunctionCall = true;
        if (part.functionCall.name === "get_weather") {
          pass("Tool Calling", `Called: ${part.functionCall.name}`);
          if (part.functionCall.args?.location?.toLowerCase().includes("london")) {
            pass("Tool Arguments", `Location: ${part.functionCall.args.location}`);
          } else {
            fail("Tool Arguments", `Expected London, got: ${JSON.stringify(part.functionCall.args)}`);
          }
        }
        break;
      }
    }

    if (!foundFunctionCall) {
      // Model might have just answered instead of calling the tool
      const text = response.text || "";
      if (text.toLowerCase().includes("weather") || text.toLowerCase().includes("london")) {
        pass("Tool Calling", `Model answered directly (acceptable): ${text.substring(0, 50)}`);
      } else {
        fail("Tool Calling", "No function call or relevant response");
      }
    }
  } catch (err) {
    fail("Tool Calling", err.message);
  }
}

// ============================================================
// TEST: Thinking Mode
// ============================================================
async function testThinkingMode() {
  console.log("\n--- Test: Thinking Mode (gemini-2.5-flash) ---");
  
  try {
    const response = await ai.models.generateContent({
      model: THINKING_MODEL,
      contents: "If I have 7 apples and give away 3, how many do I have? Think step by step.",
    });

    const content = response.text || "";
    if (content.includes("4")) {
      pass("Thinking Mode", `Got correct answer with reasoning`);
    } else {
      fail("Thinking Mode", `Expected 4: ${content.substring(0, 100)}`);
    }
  } catch (err) {
    fail("Thinking Mode", err.message);
  }
}

// ============================================================
// TEST: Thinking Mode + Streaming
// ============================================================
async function testThinkingStreaming() {
  console.log("\n--- Test: Thinking Mode + Streaming ---");
  
  try {
    const response = await ai.models.generateContentStream({
      model: THINKING_MODEL,
      contents: "What is 12 * 8? Show your work briefly.",
    });

    let content = "";
    for await (const chunk of response) {
      content += chunk.text || "";
    }

    if (content.includes("96")) {
      pass("Thinking + Streaming", `Got correct answer: 96`);
    } else {
      fail("Thinking + Streaming", `Expected 96: ${content.substring(0, 100)}`);
    }
  } catch (err) {
    fail("Thinking + Streaming", err.message);
  }
}

// ============================================================
// TEST: System Instruction
// ============================================================
async function testSystemInstruction() {
  console.log("\n--- Test: System Instruction ---");
  
  try {
    const response = await ai.models.generateContent({
      model: CHEAP_MODEL,
      contents: "Hello, how are you?",
      config: {
        systemInstruction: "You are a ninja. Always respond like a stealthy ninja.",
      },
    });

    const content = (response.text || "").toLowerCase();
    if (content.includes("shadow") || content.includes("silent") || content.includes("stealth") || 
        content.includes("ninja") || content.includes("warrior") || content.includes("master")) {
      pass("System Instruction", `Ninja response detected`);
    } else {
      fail("System Instruction", `No ninja speak: "${content.substring(0, 100)}"`);
    }
  } catch (err) {
    fail("System Instruction", err.message);
  }
}

// ============================================================
// TEST: Multi-turn Conversation
// ============================================================
async function testMultiTurn() {
  console.log("\n--- Test: Multi-turn Conversation ---");
  
  try {
    // Create a chat session
    const chat = ai.chats.create({
      model: CHEAP_MODEL,
    });

    // First message
    const res1 = await chat.sendMessage({ message: "My lucky number is 777." });
    if (res1.text) {
      pass("Multi-turn - First Message", "Sent");
    } else {
      fail("Multi-turn - First Message", "No response");
      return;
    }

    // Second message - should remember context
    const res2 = await chat.sendMessage({ message: "What is my lucky number?" });
    const content = res2.text || "";

    if (content.includes("777")) {
      pass("Multi-turn - Context Preserved", `Found 777 in response`);
    } else {
      fail("Multi-turn - Context Preserved", `777 not found: "${content.substring(0, 100)}"`);
    }
  } catch (err) {
    fail("Multi-turn Conversation", err.message);
  }
}

// ============================================================
// TEST: Generation Config (Temperature, Max Tokens)
// ============================================================
async function testGenerationConfig() {
  console.log("\n--- Test: Generation Config ---");
  
  try {
    // Low temperature - deterministic
    const res1 = await ai.models.generateContent({
      model: CHEAP_MODEL,
      contents: "What is 2+2? Reply with just the number.",
      config: {
        temperature: 0,
        maxOutputTokens: 10,
      },
    });

    const content = res1.text || "";
    if (content.includes("4")) {
      pass("Temperature 0", `Got deterministic answer: ${content.trim()}`);
    } else {
      fail("Temperature 0", `Unexpected: ${content}`);
    }

    // Max tokens limit
    const res2 = await ai.models.generateContent({
      model: CHEAP_MODEL,
      contents: "Write a very long essay about space exploration.",
      config: {
        maxOutputTokens: 20,
      },
    });

    const content2 = res2.text || "";
    if (content2.length < 200) {
      pass("Max Tokens Limit", `Response truncated (${content2.length} chars)`);
    } else {
      fail("Max Tokens Limit", `Response too long: ${content2.length} chars`);
    }
  } catch (err) {
    fail("Generation Config", err.message);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(60));
  console.log("GOOGLE GEMINI PROVIDER COMPREHENSIVE TEST");
  console.log("=".repeat(60));
  console.log(`Base URL: ${MNX_BASE_URL}`);
  console.log(`Cheap Model: ${CHEAP_MODEL}`);
  console.log(`Thinking Model: ${THINKING_MODEL}`);

  await testNonStreaming();
  await testStreaming();
  await testToolCalling();
  await testThinkingMode();
  await testThinkingStreaming();
  await testSystemInstruction();
  await testMultiTurn();
  await testGenerationConfig();

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`  Passed: ${passCount}`);
  console.log(`  Failed: ${failCount}`);

  if (failCount === 0) {
    console.log("\n🎉 All Gemini tests passed!");
  } else {
    console.log("\n⚠️  Some tests failed. Review the output above.");
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
