/**
 * Summarization Test
 *
 * This example tests the summarization feature by:
 * 1. Creating a long conversation (many messages)
 * 2. Enabling summarization with a low threshold to trigger it
 * 3. Observing the summarization in action
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY, OPENAI_KEY
 *   2. node 16.summarize_test.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import OpenAI from "openai";

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
// Use fresh IDs each run to avoid conflicts with previous test data
const SUBJECT_ID = `summarize_test_${Date.now()}`;
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

// Custom summarize config with LOW thresholds for testing
// This will trigger summarization after just a few messages
const SUMMARIZE_CONFIG = {
  start_at_tokens: 800,      // Trigger after ~800 tokens of history
  chunk_size: 400,           // Summarize in small chunks
  keep_recent_messages: 4,   // Keep only last 4 messages verbatim
  summary_target: 150,       // Target ~150 tokens for summary
};

console.log("=".repeat(60));
console.log("Summarization Test");
console.log("=".repeat(60));
console.log(`Subject ID: ${SUBJECT_ID}`);
console.log(`Chat ID: ${CHAT_ID}`);
console.log(`Summarize Config:`, JSON.stringify(SUMMARIZE_CONFIG, null, 2));
console.log("");

// Conversation topics to build up history - extended for multiple summaries
const conversationTurns = [
  // First batch - will become first summary
  "Hi! I'm working on a new project. It's a mobile app for tracking fitness goals.",
  "The app will have features like step counting, calorie tracking, and workout logging.",
  "I'm using React Native for the frontend and Node.js for the backend.",
  "For the database, I'm considering PostgreSQL or MongoDB. What do you think?",
  "I decided to go with PostgreSQL. Now I need to design the schema.",
  "The main tables will be: users, workouts, meals, and goals.",
  // Second batch - will become second summary
  "I'm also adding a social feature where users can share achievements.",
  "For authentication, I'll use JWT tokens with refresh token rotation.",
  "The app will have push notifications for workout reminders.",
  "I'm planning to deploy on AWS using ECS for the backend.",
  "I need to set up CI/CD pipelines. Should I use GitHub Actions or Jenkins?",
  "I'll go with GitHub Actions. Now I need to configure the workflow files.",
  // Third batch - may trigger third summary
  "For monitoring, I'm thinking about using CloudWatch and setting up alerts.",
  "I also want to implement rate limiting to prevent API abuse.",
  "The app needs offline support. I'll use Redux Persist for local storage.",
  "I'm adding analytics with Mixpanel to track user engagement.",
  "Security is important - I'll implement input validation and SQL injection prevention.",
  "Finally, I need to write documentation for the API endpoints.",
];

// Track cumulative token count
let cumulativeTokens = 0;

async function sendMessage(message, turnIndex) {
  console.log(`\n--- Turn ${turnIndex + 1} ---`);
  console.log(`User: ${message.substring(0, 60)}...`);
  
  const startTime = Date.now();
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message }],
      max_tokens: 150, // Keep responses short for testing
      mnx: {
        subject_id: SUBJECT_ID,
        chat_id: CHAT_ID,
        log: true,
        learn: false, // Don't extract memories for this test
        recall: false,
        history: true, // Prepend history
        summarize_config: SUMMARIZE_CONFIG, // Use custom config
      },
    });
    
    const latency = Date.now() - startTime;
    const assistantMessage = response.choices[0]?.message?.content || "";
    const usage = response.usage || {};
    
    // Track tokens - use actual prompt tokens from response
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    
    console.log(`Assistant: ${assistantMessage.substring(0, 80)}...`);
    console.log(`Latency: ${latency}ms | Prompt: ${promptTokens} tokens | Completion: ${completionTokens} tokens`);
    
    // Update cumulative estimate (rough)
    cumulativeTokens += (message.length / 4) + completionTokens;
    
    // Show status based on prompt tokens vs what we'd expect without summarization
    if (promptTokens < cumulativeTokens * 0.6 && cumulativeTokens > SUMMARIZE_CONFIG.start_at_tokens) {
      console.log(`📝 Summary active - prompt ${promptTokens} tokens (expected ~${Math.round(cumulativeTokens)} without summary)`);
    } else if (cumulativeTokens > SUMMARIZE_CONFIG.start_at_tokens) {
      console.log(`⏳ Above threshold - summary generating in background`);
    }
    
    return response;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return null;
  }
}

async function runTest() {
  console.log("\n🚀 Starting conversation to build up history...\n");
  console.log(`Total turns: ${conversationTurns.length}`);
  console.log("This should trigger 2-3 summaries as history grows.\n");
  
  for (let i = 0; i < conversationTurns.length; i++) {
    await sendMessage(conversationTurns[i], i);
    
    // Small delay between messages
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("Test Complete!");
  console.log("=".repeat(60));
  console.log("\nCheck the activity log for 'chat.summarize' events.");
  console.log("You can query ClickHouse:");
  console.log(`
SELECT 
  action, 
  metadata 
FROM activity_log 
WHERE action = 'chat.summarize' 
  AND JSON_VALUE(metadata, '$.chat_id') = '${CHAT_ID}'
ORDER BY event_time DESC;
  `);
  
  console.log("\nOr check the chat_summaries table:");
  console.log(`
SELECT 
  id,
  start_message_index,
  end_message_index,
  messages_summarized,
  tokens_in_source,
  tokens_in_summary,
  summary_text
FROM chat_summaries 
WHERE chat_id = '${CHAT_ID}';
  `);
}

// Also test with preset mode
async function testPresetMode() {
  console.log("\n" + "=".repeat(60));
  console.log("Testing Preset Mode: 'aggressive'");
  console.log("=".repeat(60));
  
  const presetChatId = crypto.randomUUID();
  console.log(`Chat ID: ${presetChatId}`);
  
  // Send a few messages with preset mode
  for (let i = 0; i < 3; i++) {
    const message = conversationTurns[i];
    console.log(`\nTurn ${i + 1}: ${message.substring(0, 50)}...`);
    
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: message }],
        max_tokens: 100,
        mnx: {
          subject_id: SUBJECT_ID,
          chat_id: presetChatId,
          log: true,
          learn: false,
          history: true,
          summarize: "aggressive", // Use preset mode
        },
      });
      
      console.log(`Response: ${response.choices[0]?.message?.content?.substring(0, 60)}...`);
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Run tests
async function main() {
  await runTest();
  await testPresetMode();
  
  console.log("\n✅ All tests complete!");
}

main().catch(console.error);
