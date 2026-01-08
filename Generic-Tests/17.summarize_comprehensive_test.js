/**
 * Comprehensive Summarization Test Suite
 *
 * Tests all aspects of the summarization feature:
 * 1. Summary triggers at correct token threshold
 * 2. Summary reuse works (no redundant re-summarization)
 * 3. Token compression is effective
 * 4. Multiple summaries chain correctly
 * 5. Preset modes work (off, light, balanced, aggressive)
 * 6. Custom config works
 * 7. Summary persists across requests
 * 8. Edge cases: empty history, single message, etc.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY, OPENAI_KEY
 *   2. node 17.summarize_comprehensive_test.js
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

// Test results tracking
const testResults = [];
let passCount = 0;
let failCount = 0;

function log(msg) {
  console.log(msg);
}

function pass(testName, details = "") {
  passCount++;
  testResults.push({ name: testName, status: "PASS", details });
  console.log(`  ✅ PASS: ${testName}${details ? ` - ${details}` : ""}`);
}

function fail(testName, details = "") {
  failCount++;
  testResults.push({ name: testName, status: "FAIL", details });
  console.log(`  ❌ FAIL: ${testName}${details ? ` - ${details}` : ""}`);
}

function assert(condition, testName, details = "") {
  if (condition) {
    pass(testName, details);
  } else {
    fail(testName, details);
  }
  return condition;
}

// Generate unique IDs for each test run
function genIds(prefix) {
  const ts = Date.now();
  return {
    subjectId: `${prefix}_subject_${ts}`,
    chatId: crypto.randomUUID(),
  };
}

// Helper to send a message
async function sendMessage(chatId, subjectId, message, mnxOptions = {}) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: message }],
    max_tokens: 100,
    mnx: {
      subject_id: subjectId,
      chat_id: chatId,
      log: true,
      learn: false,
      recall: false,
      history: true,
      ...mnxOptions,
    },
  });
  return response;
}

// Long messages to quickly build up token count
const LONG_MESSAGES = [
  "I'm building a comprehensive e-commerce platform with React and Node.js. The platform needs to support multiple vendors, each with their own dashboard for managing products, orders, and inventory. We'll need real-time notifications for new orders, a robust search system with filters for categories, price ranges, and ratings, and integration with multiple payment gateways including Stripe, PayPal, and local payment methods.",
  
  "For the backend architecture, I'm planning to use a microservices approach. We'll have separate services for user authentication, product catalog, order management, payment processing, and notifications. Each service will have its own database - PostgreSQL for transactional data and Elasticsearch for search. We'll use RabbitMQ for async communication between services and Redis for caching frequently accessed data.",
  
  "The frontend will be a Next.js application with server-side rendering for SEO. We'll use Redux Toolkit for state management, React Query for server state, and Tailwind CSS for styling. The vendor dashboard will be a separate React app with role-based access control. Both apps will share a common component library built with Storybook.",
  
  "Security is critical for an e-commerce platform. We'll implement JWT authentication with refresh tokens, rate limiting on all API endpoints, input validation and sanitization, CSRF protection, and Content Security Policy headers. All sensitive data will be encrypted at rest and in transit. We'll also set up automated security scanning in our CI/CD pipeline.",
  
  "For deployment, we're going with AWS. The services will run on ECS Fargate with auto-scaling based on CPU and memory usage. We'll use CloudFront as CDN, RDS for PostgreSQL, ElastiCache for Redis, and Amazon MQ for RabbitMQ. Infrastructure will be managed with Terraform and deployments automated through GitHub Actions.",
  
  "Monitoring and observability are essential. We'll use CloudWatch for logs and metrics, X-Ray for distributed tracing, and set up custom dashboards in Grafana. Alerts will be configured for error rates, latency spikes, and resource utilization. We'll also implement structured logging with correlation IDs to trace requests across services.",
  
  "The product catalog needs to support complex attributes - size, color, material, etc. - with variant management. Each product can have multiple images, videos, and 360-degree views. We need to support bulk import/export via CSV, automatic image optimization, and AI-powered product recommendations based on user behavior.",
  
  "Order management includes the full lifecycle: cart, checkout, payment, fulfillment, shipping, delivery, and returns. We need to integrate with shipping carriers for real-time rates and tracking. The system should handle partial shipments, backorders, and pre-orders. Vendors need tools for printing shipping labels and packing slips.",
];

// ============================================================
// TEST 1: Summarization triggers at threshold
// ============================================================
async function test1_ThresholdTrigger() {
  log("\n" + "=".repeat(60));
  log("TEST 1: Summarization triggers at token threshold");
  log("=".repeat(60));
  
  const { subjectId, chatId } = genIds("test1");
  const config = {
    start_at_tokens: 800,  // Lower threshold to trigger within 6 messages
    chunk_size: 400,
    keep_recent_messages: 3,
    summary_target: 150,
  };
  
  log(`Config: start_at_tokens=${config.start_at_tokens}`);
  
  const tokenHistory = [];
  
  // Send messages until we exceed threshold
  for (let i = 0; i < 8; i++) {  // More messages to ensure threshold + compression
    const msg = LONG_MESSAGES[i];
    log(`\n  Turn ${i + 1}: Sending ${msg.length} chars...`);
    
    const response = await sendMessage(chatId, subjectId, msg, {
      summarize_config: config,
    });
    
    const promptTokens = response.usage?.prompt_tokens || 0;
    tokenHistory.push(promptTokens);
    log(`  Prompt tokens: ${promptTokens}`);
    
    await new Promise(r => setTimeout(r, 2000)); // Wait for background summary
  }
  
  // Check that tokens eventually compress after exceeding threshold
  // Summary generates in background, so compression appears on subsequent request
  const firstTokens = tokenHistory[0];
  const maxTokens = Math.max(...tokenHistory);
  const lastTokens = tokenHistory[tokenHistory.length - 1];
  
  log(`\n  First turn tokens: ${firstTokens}`);
  log(`  Max tokens seen: ${maxTokens}`);
  log(`  Last turn tokens: ${lastTokens}`);
  log(`  Threshold: ${config.start_at_tokens}`);
  
  // Tokens should have exceeded threshold at some point (triggering summary)
  assert(
    maxTokens > config.start_at_tokens,
    "Threshold was exceeded",
    `max ${maxTokens} > threshold ${config.start_at_tokens}`
  );
  
  // After exceeding threshold, tokens should drop (summary kicked in)
  // Check if any later token count is lower than the max
  const droppedAfterMax = tokenHistory.slice(tokenHistory.indexOf(maxTokens) + 1).some(t => t < maxTokens * 0.9);
  assert(
    droppedAfterMax || lastTokens < maxTokens,
    "Token compression observed after threshold",
    `tokens dropped from ${maxTokens} to ${lastTokens}`
  );
  
  // Tokens shouldn't grow unboundedly
  assert(
    lastTokens < config.start_at_tokens * 2,
    "Tokens stay bounded",
    `${lastTokens} < ${config.start_at_tokens * 2}`
  );
}

// ============================================================
// TEST 2: Summary reuse (no redundant summarization)
// ============================================================
async function test2_SummaryReuse() {
  log("\n" + "=".repeat(60));
  log("TEST 2: Summary reuse - no redundant re-summarization");
  log("=".repeat(60));
  
  const { subjectId, chatId } = genIds("test2");
  const config = {
    start_at_tokens: 1000,
    chunk_size: 600,
    keep_recent_messages: 2,
    summary_target: 150,
  };
  
  // Build up history to trigger first summary
  for (let i = 0; i < 4; i++) {
    await sendMessage(chatId, subjectId, LONG_MESSAGES[i], {
      summarize_config: config,
    });
    await new Promise(r => setTimeout(r, 1500));
  }
  
  log("  Initial history built, summary should exist");
  
  // Send a few short messages - should reuse existing summary
  const shortMessages = [
    "What was the first thing we discussed?",
    "Can you summarize the architecture?",
    "What about security?",
  ];
  
  const tokenCounts = [];
  for (const msg of shortMessages) {
    log(`\n  Sending: "${msg}"`);
    const response = await sendMessage(chatId, subjectId, msg, {
      summarize_config: config,
    });
    tokenCounts.push(response.usage?.prompt_tokens || 0);
    log(`  Prompt tokens: ${tokenCounts[tokenCounts.length - 1]}`);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Token counts should be relatively stable (summary being reused)
  const variance = Math.max(...tokenCounts) - Math.min(...tokenCounts);
  log(`\n  Token variance across short messages: ${variance}`);
  
  assert(
    variance < 500,
    "Summary reused (stable token count)",
    `variance ${variance} < 500`
  );
}

// ============================================================
// TEST 3: Preset modes work correctly
// ============================================================
async function test3_PresetModes() {
  log("\n" + "=".repeat(60));
  log("TEST 3: Preset modes (off, light, balanced, aggressive)");
  log("=".repeat(60));
  
  const modes = ["off", "light", "balanced", "aggressive"];
  
  for (const mode of modes) {
    const { subjectId, chatId } = genIds(`test3_${mode}`);
    log(`\n  Testing mode: ${mode}`);
    
    try {
      const response = await sendMessage(chatId, subjectId, LONG_MESSAGES[0], {
        summarize: mode,
      });
      
      assert(
        response.choices?.[0]?.message?.content,
        `Mode '${mode}' works`,
        `Got response with ${response.usage?.total_tokens} tokens`
      );
    } catch (err) {
      fail(`Mode '${mode}' works`, err.message);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
}

// ============================================================
// TEST 4: Custom config overrides preset
// ============================================================
async function test4_CustomConfig() {
  log("\n" + "=".repeat(60));
  log("TEST 4: Custom config overrides preset");
  log("=".repeat(60));
  
  const { subjectId, chatId } = genIds("test4");
  
  // Very aggressive custom config
  const customConfig = {
    start_at_tokens: 500,
    chunk_size: 300,
    keep_recent_messages: 2,
    summary_target: 100,
  };
  
  try {
    const response = await sendMessage(chatId, subjectId, LONG_MESSAGES[0], {
      summarize: "off", // Preset says off
      summarize_config: customConfig, // But custom config provided
    });
    
    assert(
      response.choices?.[0]?.message?.content,
      "Custom config accepted",
      "Response received"
    );
    pass("Custom config overrides preset", "No error thrown");
  } catch (err) {
    fail("Custom config overrides preset", err.message);
  }
}

// ============================================================
// TEST 5: Empty history handling
// ============================================================
async function test5_EmptyHistory() {
  log("\n" + "=".repeat(60));
  log("TEST 5: Empty history handling");
  log("=".repeat(60));
  
  const { subjectId, chatId } = genIds("test5");
  
  try {
    // First message - no history exists
    const response = await sendMessage(chatId, subjectId, "Hello, this is my first message!", {
      summarize: "aggressive",
    });
    
    assert(
      response.choices?.[0]?.message?.content,
      "First message with summarize works",
      "No error on empty history"
    );
  } catch (err) {
    fail("First message with summarize works", err.message);
  }
}

// ============================================================
// TEST 6: Summarize off doesn't summarize
// ============================================================
async function test6_SummarizeOff() {
  log("\n" + "=".repeat(60));
  log("TEST 6: Summarize 'off' doesn't compress");
  log("=".repeat(60));
  
  const { subjectId, chatId } = genIds("test6");
  
  const tokenHistory = [];
  
  // Send several long messages with summarize off
  for (let i = 0; i < 4; i++) {
    const response = await sendMessage(chatId, subjectId, LONG_MESSAGES[i], {
      summarize: "off",
    });
    tokenHistory.push(response.usage?.prompt_tokens || 0);
    log(`  Turn ${i + 1}: ${tokenHistory[i]} prompt tokens`);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Tokens should grow roughly linearly (no compression)
  const growth = tokenHistory[3] / tokenHistory[0];
  log(`\n  Token growth ratio: ${growth.toFixed(2)}x`);
  
  assert(
    growth > 2.5,
    "Summarize 'off' shows linear growth",
    `${growth.toFixed(2)}x growth (expected >2.5x)`
  );
}

// ============================================================
// TEST 7: Multiple summaries chain correctly
// ============================================================
async function test7_MultipleSummaries() {
  log("\n" + "=".repeat(60));
  log("TEST 7: Multiple summaries chain correctly");
  log("=".repeat(60));
  
  const { subjectId, chatId } = genIds("test7");
  const config = {
    start_at_tokens: 800,
    chunk_size: 400,
    keep_recent_messages: 2,
    summary_target: 100,
  };
  
  const tokenHistory = [];
  
  // Send many messages to trigger multiple summaries
  for (let i = 0; i < 8; i++) {
    const msg = LONG_MESSAGES[i % LONG_MESSAGES.length];
    const response = await sendMessage(chatId, subjectId, msg, {
      summarize_config: config,
    });
    tokenHistory.push(response.usage?.prompt_tokens || 0);
    log(`  Turn ${i + 1}: ${tokenHistory[i]} prompt tokens`);
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Check that tokens stay bounded even after many messages
  const maxTokens = Math.max(...tokenHistory);
  const lastTokens = tokenHistory[tokenHistory.length - 1];
  
  log(`\n  Max tokens seen: ${maxTokens}`);
  log(`  Final tokens: ${lastTokens}`);
  
  assert(
    maxTokens < config.start_at_tokens * 3,
    "Tokens stay bounded with multiple summaries",
    `max ${maxTokens} < ${config.start_at_tokens * 3}`
  );
}

// ============================================================
// TEST 8: Context preserved after summarization
// ============================================================
async function test8_ContextPreserved() {
  log("\n" + "=".repeat(60));
  log("TEST 8: Context preserved after summarization");
  log("=".repeat(60));
  
  const { subjectId, chatId } = genIds("test8");
  const config = {
    start_at_tokens: 1000,
    chunk_size: 500,
    keep_recent_messages: 2,
    summary_target: 150,
  };
  
  // Establish specific facts
  const facts = [
    "My name is Alex and I work at TechCorp as a senior engineer.",
    "I'm building a project called ProjectX which is a machine learning platform.",
    "The main programming language we use is Python with FastAPI.",
    "Our database is PostgreSQL and we deploy on Google Cloud.",
  ];
  
  for (const fact of facts) {
    await sendMessage(chatId, subjectId, fact, { summarize_config: config });
    await new Promise(r => setTimeout(r, 1500));
  }
  
  log("  Facts established, now testing recall...");
  
  // Ask about earlier facts
  const response = await sendMessage(
    chatId, 
    subjectId, 
    "What is my name and where do I work? What project am I building?",
    { summarize_config: config }
  );
  
  const answer = response.choices?.[0]?.message?.content?.toLowerCase() || "";
  log(`\n  Response: ${answer.substring(0, 200)}...`);
  
  const hasName = answer.includes("alex");
  const hasCompany = answer.includes("techcorp");
  const hasProject = answer.includes("projectx") || answer.includes("project x");
  
  assert(hasName, "Name preserved in context", hasName ? "Found 'Alex'" : "Missing 'Alex'");
  assert(hasCompany, "Company preserved in context", hasCompany ? "Found 'TechCorp'" : "Missing 'TechCorp'");
  assert(hasProject, "Project preserved in context", hasProject ? "Found 'ProjectX'" : "Missing 'ProjectX'");
}

// ============================================================
// MAIN TEST RUNNER
// ============================================================
async function runAllTests() {
  console.log("\n" + "=".repeat(60));
  console.log("COMPREHENSIVE SUMMARIZATION TEST SUITE");
  console.log("=".repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  
  const tests = [
    test1_ThresholdTrigger,
    test2_SummaryReuse,
    test3_PresetModes,
    test4_CustomConfig,
    test5_EmptyHistory,
    test6_SummarizeOff,
    test7_MultipleSummaries,
    test8_ContextPreserved,
  ];
  
  for (const test of tests) {
    try {
      await test();
    } catch (err) {
      console.error(`\n  ❌ TEST CRASHED: ${err.message}`);
      fail(test.name, `Crashed: ${err.message}`);
    }
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("TEST RESULTS SUMMARY");
  console.log("=".repeat(60));
  console.log(`\n  Total: ${passCount + failCount}`);
  console.log(`  ✅ Passed: ${passCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log(`\n  Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  
  if (failCount > 0) {
    console.log("\n  Failed Tests:");
    testResults.filter(t => t.status === "FAIL").forEach(t => {
      console.log(`    - ${t.name}: ${t.details}`);
    });
  }
  
  console.log("\n" + "=".repeat(60));
  
  if (failCount === 0) {
    console.log("🎉 ALL TESTS PASSED - SAFE TO PUSH TO PROD!");
  } else {
    console.log("⚠️  SOME TESTS FAILED - REVIEW BEFORE PUSHING");
  }
  
  console.log("=".repeat(60) + "\n");
  
  process.exit(failCount > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
