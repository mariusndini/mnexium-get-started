/**
 * Provider Architecture Test
 * 
 * Quick test to verify the provider refactor didn't break anything.
 * Tests both chat/completions and responses endpoints.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY, OPENAI_KEY
 *   2. node 18.provider_test.js
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

async function testChatCompletions() {
  console.log("\n--- Test: Chat Completions ---");
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say 'provider test ok' and nothing else." }],
      max_tokens: 20,
      mnx: {
        subject_id: `provider_test_${Date.now()}`,
        log: false,
        learn: false,
      },
    });
    
    const content = response.choices?.[0]?.message?.content || "";
    if (content.toLowerCase().includes("ok")) {
      pass("Chat Completions", `Response: "${content.substring(0, 50)}"`);
    } else {
      fail("Chat Completions", `Unexpected response: "${content}"`);
    }
  } catch (err) {
    fail("Chat Completions", err.message);
  }
}

async function testChatCompletionsStreaming() {
  console.log("\n--- Test: Chat Completions (Streaming) ---");
  
  try {
    const stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say 'streaming ok' and nothing else." }],
      max_tokens: 20,
      stream: true,
      mnx: {
        subject_id: `provider_test_stream_${Date.now()}`,
        log: false,
        learn: false,
      },
    });
    
    let content = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      content += delta;
    }
    
    if (content.toLowerCase().includes("ok")) {
      pass("Chat Completions Streaming", `Response: "${content.substring(0, 50)}"`);
    } else {
      fail("Chat Completions Streaming", `Unexpected response: "${content}"`);
    }
  } catch (err) {
    fail("Chat Completions Streaming", err.message);
  }
}

async function testResponses() {
  console.log("\n--- Test: Responses API ---");
  
  try {
    const response = await fetch(`${BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MNX_KEY}`,
        "x-openai-key": OPENAI_KEY,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: "Say 'responses ok' and nothing else." }] }],
        max_output_tokens: 20,
        mnx: {
          subject_id: `provider_test_responses_${Date.now()}`,
          log: false,
          learn: false,
        },
      }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      fail("Responses API", `HTTP ${response.status}: ${text}`);
      return;
    }
    
    const json = await response.json();
    // OpenAI Responses API returns output_text at top level or in output array
    let outputText = json.output_text || "";
    if (!outputText && Array.isArray(json.output)) {
      for (const item of json.output) {
        if (item?.type === "message" && Array.isArray(item?.content)) {
          for (const c of item.content) {
            if (c?.type === "output_text" && c?.text) {
              outputText += c.text;
            }
          }
        }
      }
    }
    
    if (outputText.toLowerCase().includes("ok")) {
      pass("Responses API", `Response: "${outputText.substring(0, 50)}"`);
    } else {
      fail("Responses API", `Unexpected response: ${JSON.stringify(json).substring(0, 100)}`);
    }
  } catch (err) {
    fail("Responses API", err.message);
  }
}

async function testDifferentModels() {
  console.log("\n--- Test: Different OpenAI Models ---");
  
  const models = ["gpt-4o-mini", "gpt-4.1-mini", "o1-mini"];
  
  for (const model of models) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: "Say 'yes'" }],
        max_tokens: 10,
        mnx: {
          subject_id: `provider_test_model_${Date.now()}`,
          log: false,
          learn: false,
        },
      });
      
      if (response.choices?.[0]?.message?.content) {
        pass(`Model ${model}`, "Got response");
      } else {
        fail(`Model ${model}`, "No content in response");
      }
    } catch (err) {
      fail(`Model ${model}`, err.message);
    }
  }
}

async function main() {
  console.log("=".repeat(50));
  console.log("PROVIDER ARCHITECTURE TEST");
  console.log("=".repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  
  await testChatCompletions();
  await testChatCompletionsStreaming();
  await testResponses();
  await testDifferentModels();
  
  console.log("\n" + "=".repeat(50));
  console.log("RESULTS");
  console.log("=".repeat(50));
  console.log(`  Passed: ${passCount}`);
  console.log(`  Failed: ${failCount}`);
  
  if (failCount === 0) {
    console.log("\n🎉 All tests passed! Provider refactor is working.");
  } else {
    console.log("\n⚠️  Some tests failed. Review the output above.");
  }
  
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
