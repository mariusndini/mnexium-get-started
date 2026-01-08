/**
 * Profile Extraction Demo
 *
 * This example demonstrates the new Profile System built on memories.
 * It shows how profile fields are automatically extracted from conversations
 * when users share personal information.
 *
 * The profile system:
 * - Stores profile data as kind='profile_field' memories
 * - Automatically extracts name, email, timezone, language from chat
 * - Supports custom fields defined in project settings
 * - Tracks confidence and provenance for each field
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY, OPENAI_KEY
 *   2. node 14.profile_extraction.mjs
 */

const dotenv = await import("dotenv");
dotenv.default.config({ path: ".env.local" });
const { default: OpenAI } = await import("openai");

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const SUBJECT_ID = process.env.SUBJECT_ID || `profile_demo_${Date.now()}`;
const BASE_URL = process.env.MNX_BASE_URL || "https://www.mnexium.com/api/v1";
const CHAT_ID = crypto.randomUUID();

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

console.log("=".repeat(60));
console.log("Profile Extraction Demo");
console.log("=".repeat(60));
console.log(`Subject ID: ${SUBJECT_ID}`);
console.log(`Chat ID: ${CHAT_ID}`);
console.log("");

// Helper to send a message and get response
async function chat(userMessage) {
  console.log(`\n👤 User: ${userMessage}`);
  
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: userMessage }],
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID,
      log: true,      // Save to chat history
      learn: true,    // Extract memories AND profile fields
      recall: true,   // Use existing memories
      history: true,  // Include chat history
    },
  });

  const assistantMessage = response.choices[0].message.content;
  console.log(`\n🤖 Assistant: ${assistantMessage}`);
  
  return assistantMessage;
}

// Helper to wait (give time for async extraction)
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the demo
async function main() {
  console.log("\n--- Step 1: Introduce yourself ---");
  console.log("(This should extract 'name' profile field)");
  await chat("Hi! I'm Sarah Chen, nice to meet you.");
  
  await wait(2000); // Wait for extraction
  
  console.log("\n--- Step 2: Share your email ---");
  console.log("(This should extract 'email' profile field)");
  await chat("My new email is chen.sarah@yubba.com if you need to follow up.");
  
  await wait(2000);
  
  console.log("\n--- Step 3: Mention your timezone ---");
  console.log("(This should extract 'timezone' profile field)");
  await chat("I'm based in New York now, so I'm on Eastern time.");
  
  await wait(2000);

  console.log("\n--- Step 6: Mention your favorite fruit ---");
  console.log("(This should extract 'fruit' profile field)");
  await chat("My favorite fruit is mango.");
  
  await wait(2000);

   console.log("\n--- Step 7: Mention your favorite fruit again ---");
  console.log("(This should update the 'fruit' profile field)");
  await chat("My favorite fruit is apple.");
  
  await wait(2000);
  
  console.log("\n--- Step 6: Start a new chat and see if profile is recalled ---");
  console.log("(The AI should remember who you are from the profile)");
  
  const newChatId = crypto.randomUUID();
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hey, do you remember my name?" }],
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: newChatId, // New chat!
      log: true,
      learn: false,
      recall: true,   // This will pull in profile data
      history: true,
    },
  });
  
  console.log(`\n👤 User: Hey, do you remember my name?`);
  console.log(`\n🤖 Assistant: ${response.choices[0].message.content}`);
  
  console.log("\n" + "=".repeat(60));
  console.log("Demo Complete!");
  console.log("=".repeat(60));
  console.log("\nTo see the extracted profile:");
  console.log(`1. Go to https://www.mnexium.com/memories`);
  console.log(`2. Find subject: ${SUBJECT_ID}`);
  console.log(`3. Click on the subject to see the Profile card`);
  console.log("\nOr check the /profiles page to configure the schema.");
}

main().catch(console.error);
