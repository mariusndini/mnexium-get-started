/**
 * Tool Calls (Function Calling) with Mnexium
 *
 * This example demonstrates how to use OpenAI's function calling feature
 * through Mnexium. The LLM can decide to call tools you define, and you
 * handle the tool execution and return results.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY and OPENAI_KEY
 *   2. node 10.tool_calls.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import OpenAI from "openai";

const MNX_KEY = process.env.MNX_KEY;
const OPENAI_KEY = process.env.OPENAI_KEY;
const SUBJECT_ID = process.env.SUBJECT_ID || "tool_demo_user";
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

// Generate a unique chat_id for this conversation session
// This keeps all messages in the same chat thread in Mnexium
const CHAT_ID = crypto.randomUUID();

// Define the tools (functions) the LLM can call
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. San Francisco, CA",
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit",
          },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search for products in the catalog",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for products",
          },
          max_results: {
            type: "integer",
            description: "Maximum number of results to return",
          },
        },
        required: ["query"],
      },
    },
  },
];

// Simulate tool execution (in real apps, these would call actual APIs)
function executeToolCall(name, args) {
  console.log(`  → Executing tool: ${name}(${JSON.stringify(args)})`);
  
  if (name === "get_weather") {
    // Simulated weather data
    return JSON.stringify({
      location: args.location,
      temperature: 72,
      unit: args.unit || "fahrenheit",
      condition: "sunny",
      humidity: 45,
    });
  }
  
  if (name === "search_products") {
    // Simulated product search
    return JSON.stringify({
      query: args.query,
      results: [
        { name: "Wireless Headphones", price: 79.99, rating: 4.5 },
        { name: "Bluetooth Speaker", price: 49.99, rating: 4.2 },
        { name: "USB-C Cable", price: 12.99, rating: 4.8 },
      ].slice(0, args.max_results || 3),
    });
  }
  
  return JSON.stringify({ error: "Unknown tool" });
}

console.log("==================================================");
console.log("Tool Calls (Function Calling) Demo");
console.log("==================================================");
console.log(`Chat ID: ${CHAT_ID}`);

// Example 1: Single tool call
console.log("[1] Single tool call - Weather query...");
const messages = [
  { role: "user", content: "What's the weather like in San Francisco?" },
];

let response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages,
  tools,
  tool_choice: "auto", // Let the model decide when to use tools
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID, // Keep all turns in the same chat
    log: true,
    learn: false,
    history: false, // We manage our own messages array
  },
});

let assistantMessage = response.choices[0].message;
console.log("Assistant wants to call tools:", assistantMessage.tool_calls?.length > 0);

// If the model wants to call tools, execute them
if (assistantMessage.tool_calls) {
  // Add assistant's message with tool calls to conversation
  messages.push(assistantMessage);
  
  // Execute each tool call and add results
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
  
  // Get final response with tool results
  response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools,
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID, // Same chat_id for continuity
      log: true,
      learn: false,
      history: false, // We manage our own messages array
    },
  });
  
  assistantMessage = response.choices[0].message;
}

console.log("\nFinal Response:", assistantMessage.content);

// Example 2: Multiple tool calls in one request
console.log("\n" + "=".repeat(50));
console.log("[2] Multiple tool calls - Complex query...\n");

// Use a separate chat_id for this example (or continue with CHAT_ID)
const CHAT_ID_2 = crypto.randomUUID();
console.log(`Chat ID: ${CHAT_ID_2}`);

const messages2 = [
  {
    role: "user",
    content: "What's the weather in NYC and can you find me some headphones?",
  },
];

let response2 = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: messages2,
  tools,
  tool_choice: "auto",
  mnx: {
    subject_id: SUBJECT_ID,
    chat_id: CHAT_ID_2,
    log: true,
    learn: false,
    history: false,
  },
});

let assistantMessage2 = response2.choices[0].message;
console.log("Tool calls requested:", assistantMessage2.tool_calls?.length || 0);

if (assistantMessage2.tool_calls) {
  messages2.push(assistantMessage2);
  
  for (const toolCall of assistantMessage2.tool_calls) {
    const result = executeToolCall(
      toolCall.function.name,
      JSON.parse(toolCall.function.arguments)
    );
    
    messages2.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: result,
    });
  }
  
  response2 = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages2,
    tools,
    mnx: {
      subject_id: SUBJECT_ID,
      chat_id: CHAT_ID_2, // Same chat_id for continuity
      log: true,
      learn: false,
      history: false,
    },
  });
  
  assistantMessage2 = response2.choices[0].message;
}

console.log("\nFinal Response:", assistantMessage2.content);

// Example 3: Forced tool call
console.log("\n" + "=".repeat(50));
console.log("[3] Forced tool call - Require specific function...\n");

const response3 = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Tell me about the weather" }],
  tools,
  tool_choice: { type: "function", function: { name: "get_weather" } }, // Force this tool
  mnx: {
    subject_id: SUBJECT_ID,
    log: false,
    learn: false,
  },
});

const toolCall = response3.choices[0].message.tool_calls?.[0];
if (toolCall) {
  console.log("Forced tool call:");
  console.log("  Function:", toolCall.function.name);
  console.log("  Arguments:", toolCall.function.arguments);
}

console.log("\n==================================================");
console.log("Tool calls work seamlessly through Mnexium!");
console.log("All conversations are logged and can build memories.");
console.log("==================================================");

