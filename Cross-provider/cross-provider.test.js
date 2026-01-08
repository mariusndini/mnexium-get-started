/**
 * Cross-Provider Memory Sharing Test
 * 
 * Tests that memories are shared across all 3 providers:
 * - Learn a fact with OpenAI
 * - Recall it with Claude
 * - Recall it with Gemini
 * 
 * This proves that Mnexium's memory layer works across any LLM provider.
 * 
 * Run: node X-provider/cross-provider.test.js
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://mnexium.com/api/v1";
const CLAUDE_BASE_URL = BASE_URL.replace("/api/v1", "/api");  // Anthropic SDK adds /v1/messages
const GEMINI_BASE_URL = BASE_URL.replace("/api/v1", "");  // Google SDK adds /v1beta/models/...

if (!MNX_KEY) {
  console.error("Error: MNX_KEY is not set");
  process.exit(1);
}
if (!OPENAI_KEY) {
  console.error("Error: OPENAI_KEY is not set");
  process.exit(1);
}
if (!CLAUDE_KEY) {
  console.error("Error: CLAUDE_API_KEY is not set");
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error("Error: GEMINI_KEY is not set");
  process.exit(1);
}

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

// OpenAI client (native SDK)
const openai = new OpenAI({
  apiKey: MNX_KEY,
  baseURL: BASE_URL,
  defaultHeaders: { "x-openai-key": OPENAI_KEY },
});

// Claude client (native Anthropic SDK)
const claude = new Anthropic({
  apiKey: CLAUDE_KEY,
  baseURL: CLAUDE_BASE_URL,
  defaultHeaders: { "Authorization": `Bearer ${MNX_KEY}` },
});

// Gemini client (native Google SDK)
const gemini = new GoogleGenAI({
  apiKey: GEMINI_KEY,
  httpOptions: {
    baseUrl: GEMINI_BASE_URL,
    headers: {
      "Authorization": `Bearer ${MNX_KEY}`,
      "x-goog-api-key": GEMINI_KEY,
    },
  },
});

// ============================================================
// TEST: Learn with OpenAI, Recall with Claude
// ============================================================
async function testOpenAIToClaude() {
  console.log("\n--- Test: OpenAI → Claude Memory Transfer ---");
  
  const subjectId = `cross_openai_claude_${Date.now()}`;
  const uniqueFact = `My spaceship is named Enterprise${Date.now().toString().slice(-4)}`;
  
  try {
    // Learn with OpenAI
    console.log("  📝 Teaching OpenAI a fact...");
    await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: uniqueFact }],
      max_tokens: 50,
      mnx: { subject_id: subjectId, log: true, learn: "force" },
    });
    pass("OpenAI Learn", "Fact sent");

    // Wait for memory extraction
    console.log("  ⏳ Waiting for memory extraction...");
    await new Promise(r => setTimeout(r, 5000));

    // Recall with Claude (using fetch with mnx params)
    console.log("  🔍 Asking Claude to recall...");
    const claudeRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MNX_KEY}`,
        "x-anthropic-key": CLAUDE_KEY,
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "What do you know about my spaceship?" }],
        max_tokens: 100,
        mnx: { subject_id: subjectId, log: true, learn: false, recall: true },
      }),
    });
    const claudeJson = await claudeRes.json();
    
    // Extract content from Claude response
    let content = "";
    const contentBlocks = claudeJson.content || [];
    for (const block of contentBlocks) {
      if (block.type === "text") content += block.text;
    }
    if (!content) {
      content = claudeJson.choices?.[0]?.message?.content || "";
    }

    if (content.toLowerCase().includes("enterprise")) {
      pass("Claude Recall", `Found spaceship name in response`);
    } else {
      fail("Claude Recall", `Spaceship name not found: "${content.substring(0, 100)}"`);
    }
  } catch (err) {
    fail("OpenAI → Claude", err.message);
  }
}

// ============================================================
// TEST: Learn with Claude, Recall with Gemini
// ============================================================
async function testClaudeToGemini() {
  console.log("\n--- Test: Claude → Gemini Memory Transfer ---");
  
  const subjectId = `cross_claude_gemini_${Date.now()}`;
  const uniqueFact = `My favorite planet is Neptune${Date.now().toString().slice(-4)}`;
  
  try {
    // Learn with Claude (using fetch with mnx params)
    console.log("  📝 Teaching Claude a fact...");
    await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MNX_KEY}`,
        "x-anthropic-key": CLAUDE_KEY,
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: uniqueFact }],
        max_tokens: 50,
        mnx: { subject_id: subjectId, log: true, learn: "force" },
      }),
    });
    pass("Claude Learn", "Fact sent");

    // Wait for memory extraction
    console.log("  ⏳ Waiting for memory extraction...");
    await new Promise(r => setTimeout(r, 5000));

    // Recall with Gemini - need to use fetch since native SDK doesn't support mnx params yet
    console.log("  🔍 Asking Gemini to recall...");
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MNX_KEY}`,
        "x-google-key": GEMINI_KEY,
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash-lite",
        messages: [{ role: "user", content: "What do you know about my favorite planet?" }],
        max_tokens: 100,
        mnx: { subject_id: subjectId, log: true, learn: false, recall: true },
      }),
    });

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || 
                    json.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (content.toLowerCase().includes("neptune")) {
      pass("Gemini Recall", `Found planet name in response`);
    } else {
      fail("Gemini Recall", `Planet name not found: "${content.substring(0, 100)}"`);
    }
  } catch (err) {
    fail("Claude → Gemini", err.message);
  }
}

// ============================================================
// TEST: Learn with Gemini, Recall with OpenAI
// ============================================================
async function testGeminiToOpenAI() {
  console.log("\n--- Test: Gemini → OpenAI Memory Transfer ---");
  
  const subjectId = `cross_gemini_openai_${Date.now()}`;
  const uniqueFact = `My favorite dinosaur is Velociraptor${Date.now().toString().slice(-4)}`;
  
  try {
    // Learn with Gemini (using fetch for mnx params)
    console.log("  📝 Teaching Gemini a fact...");
    await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MNX_KEY}`,
        "x-google-key": GEMINI_KEY,
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash-lite",
        messages: [{ role: "user", content: uniqueFact }],
        max_tokens: 50,
        mnx: { subject_id: subjectId, log: true, learn: "force" },
      }),
    });
    pass("Gemini Learn", "Fact sent");

    // Wait for memory extraction
    console.log("  ⏳ Waiting for memory extraction...");
    await new Promise(r => setTimeout(r, 5000));

    // Recall with OpenAI
    console.log("  🔍 Asking OpenAI to recall...");
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "What do you know about my favorite dinosaur?" }],
      max_tokens: 100,
      mnx: { subject_id: subjectId, log: true, learn: false, recall: true },
    });

    const content = res.choices?.[0]?.message?.content || "";

    if (content.toLowerCase().includes("velociraptor")) {
      pass("OpenAI Recall", `Found dinosaur name in response`);
    } else {
      fail("OpenAI Recall", `Dinosaur name not found: "${content.substring(0, 100)}"`);
    }
  } catch (err) {
    fail("Gemini → OpenAI", err.message);
  }
}

// ============================================================
// TEST: All Three Providers Share Same Memory
// ============================================================
async function testAllThreeProviders() {
  console.log("\n--- Test: All Three Providers Share Memory ---");
  
  const subjectId = `cross_all_${Date.now()}`;
  const uniqueFact = `My favorite word is ALPHA${Date.now().toString().slice(-4)}OMEGA`;
  
  try {
    // Learn with OpenAI
    console.log("  📝 Teaching OpenAI the secret code...");
    await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: uniqueFact }],
      max_tokens: 50,
      mnx: { subject_id: subjectId, log: true, learn: "force" },
    });
    pass("OpenAI Learn", "Secret code sent");

    // Wait for memory extraction
    console.log("  ⏳ Waiting for memory extraction...");
    await new Promise(r => setTimeout(r, 5000));

    // Recall with all three
    console.log("  🔍 Testing recall with all providers...");

    // OpenAI recall
    const openaiRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "What is my favorite word?" }],
      max_tokens: 50,
      mnx: { subject_id: subjectId, log: true, learn: false, recall: true },
    });
    const openaiContent = openaiRes.choices?.[0]?.message?.content || "";
    if (openaiContent.toLowerCase().includes("alpha") && openaiContent.toLowerCase().includes("omega")) {
      pass("OpenAI Recall", "Found secret code");
    } else {
      fail("OpenAI Recall", `Code not found: "${openaiContent.substring(0, 50)}"`);
    }

    // Claude recall (using fetch with mnx params)
    const claudeRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MNX_KEY}`,
        "x-anthropic-key": CLAUDE_KEY,
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: "What is my favorite word?" }],
        max_tokens: 50,
        mnx: { subject_id: subjectId, log: true, learn: false, recall: true },
      }),
    });
    const claudeJson = await claudeRes.json();
    let claudeContent = "";
    const claudeBlocks = claudeJson.content || [];
    for (const block of claudeBlocks) {
      if (block.type === "text") claudeContent += block.text;
    }
    if (!claudeContent) {
      claudeContent = claudeJson.choices?.[0]?.message?.content || "";
    }
    if (claudeContent.toLowerCase().includes("alpha") && claudeContent.toLowerCase().includes("omega")) {
      pass("Claude Recall", "Found secret code");
    } else {
      fail("Claude Recall", `Code not found: "${claudeContent.substring(0, 50)}"`);
    }

    // Gemini recall
    const geminiRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MNX_KEY}`,
        "x-google-key": GEMINI_KEY,
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash-lite",
        messages: [{ role: "user", content: "What is my favorite word?" }],
        max_tokens: 50,
        mnx: { subject_id: subjectId, log: true, learn: false, recall: true },
      }),
    });
    const geminiJson = await geminiRes.json();
    const geminiContent = geminiJson.choices?.[0]?.message?.content || 
                          geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (geminiContent.toLowerCase().includes("alpha") && geminiContent.toLowerCase().includes("omega")) {
      pass("Gemini Recall", "Found secret code");
    } else {
      fail("Gemini Recall", `Code not found: "${geminiContent.substring(0, 50)}"`);
    }

  } catch (err) {
    fail("All Three Providers", err.message);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("=".repeat(60));
  console.log("CROSS-PROVIDER MEMORY SHARING TEST");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Providers: OpenAI (gpt-4o-mini), Claude (haiku), Gemini (flash-lite)`);
  console.log("\nThis test proves that memories learned with one provider");
  console.log("can be recalled by any other provider through Mnexium.\n");

  await testOpenAIToClaude();
  await testClaudeToGemini();
  await testGeminiToOpenAI();
  await testAllThreeProviders();

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`  Passed: ${passCount}`);
  console.log(`  Failed: ${failCount}`);

  if (failCount === 0) {
    console.log("\n🎉 All cross-provider tests passed!");
    console.log("✓ Memories are successfully shared across OpenAI, Claude, and Gemini!");
  } else {
    console.log("\n⚠️  Some tests failed. Review the output above.");
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
