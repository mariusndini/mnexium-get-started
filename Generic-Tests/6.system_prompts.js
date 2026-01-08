/**
 * System Prompts API
 *
 * This example demonstrates how to create, list, and use system prompts
 * to customize AI behavior for different contexts.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY and OPENAI_KEY
 *   2. node 6.system_prompts.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import OpenAI from "openai";

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";
const SUBJECT_ID = `test_user_${Date.now()}`;
const DEMO_PROMPT_ID = "sp_demo_pirate_assistant"; // Fixed ID so re-runs update instead of create

if (!MNX_KEY || !OPENAI_KEY) {
  console.error("Error: MNX_KEY and OPENAI_KEY must be set in .env.local");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${MNX_KEY}`,
  "Content-Type": "application/json",
  "x-openai-key": OPENAI_KEY,
};

const client = new OpenAI({
  apiKey: MNX_KEY,
  baseURL: BASE_URL,
  defaultHeaders: { "x-openai-key": OPENAI_KEY },
});

console.log("==================================================");
console.log("System Prompts Demo");
console.log("==================================================\n");

// 1. CREATE (or update) a system prompt with a fixed ID
// Using a fixed ID means re-running this script updates the same prompt instead of creating duplicates
console.log("[1] Creating/updating a pirate-themed system prompt...");
const createRes = await fetch(`${BASE_URL}/prompts`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    id: DEMO_PROMPT_ID, // Fixed ID for upsert behavior
    name: "Pirate Assistant",
    prompt_text: "You are a helpful pirate assistant. Always respond in pirate speak, using phrases like 'Arrr!', 'Ahoy!', 'matey', and 'shiver me timbers'. Be helpful but stay in character.",
    scope: "project",
    is_active: true,
    is_default: true,
    priority: 100,
  }),
});
const created = await createRes.json();
console.log("Created/updated prompt:", created.prompt?.name || created);
const promptId = created.prompt?.id || DEMO_PROMPT_ID;

// 2. LIST all prompts
console.log("\n[2] Listing all system prompts...");
const listRes = await fetch(`${BASE_URL}/prompts`, { headers });
const list = await listRes.json();
console.log(`Found ${list.prompts?.length || 0} prompts:`);
list.prompts?.forEach(p => {
  console.log(`  - ${p.name} (${p.scope}, default: ${p.is_default})`);
});

// 3. GET a specific prompt
if (promptId) {
  console.log("\n[3] Getting specific prompt...");
  const getRes = await fetch(`${BASE_URL}/prompts/${promptId}`, { headers });
  const prompt = await getRes.json();
  console.log("Prompt details:", {
    name: prompt.prompt?.name,
    scope: prompt.prompt?.scope,
    is_default: prompt.prompt?.is_default,
  });
}

// 4. RESOLVE effective prompt for a context
console.log("\n[4] Resolving effective prompt...");
const resolveRes = await fetch(
  `${BASE_URL}/prompts/resolve?combined=true`,
  { headers }
);
const resolved = await resolveRes.json();
console.log("Effective prompt:", resolved.prompt_text?.slice(0, 100) + "...");

// 5. USE the prompt in a chat
console.log("\n[5] Using the prompt in a chat...");
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What's the weather like today?" }],
  mnx: {
    subject_id: SUBJECT_ID,
    log: false,
    learn: false,
    // system_prompt: true means auto-resolve from database
  },
});
console.log("Response with pirate prompt:");
console.log(response.choices[0].message.content);

// 6. SKIP system prompt injection
console.log("\n[6] Skipping system prompt injection...");
const normalResponse = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What's the weather like today?" }],
  mnx: {
    subject_id: SUBJECT_ID,
    log: false,
    learn: false,
    system_prompt: false, // Skip database prompt
  },
});
console.log("Response without pirate prompt:");
console.log(normalResponse.choices[0].message.content);

// 7. DELETE the prompt (cleanup)
// if (promptId) {
//   console.log("\n[7] Cleaning up - deleting prompt...");
//   const deleteRes = await fetch(`${BASE_URL}/prompts/${promptId}`, {
//     method: "DELETE",
//     headers,
//   });
//   const deleted = await deleteRes.json();
//   console.log("Deleted:", deleted.ok ? "success" : deleted);
// }

// console.log("\n==================================================");
// console.log("System Prompts demo complete!");
// console.log("==================================================");
