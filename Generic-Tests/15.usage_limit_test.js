/**
 * Usage Limit Test Suite
 *
 * Tests the 429 usage limit enforcement across all memory APIs:
 * - GET /memories (list)
 * - POST /memories (create)
 * - GET /memories/:id (get single)
 * - PATCH /memories/:id (update)
 * - DELETE /memories/:id (delete)
 * - GET /memories/search (search)
 *
 * This test splits usage evenly across all APIs to verify limit enforcement.
 * 
 * NOTE: This test is designed to hit the usage limit (500 memory actions/month).
 * Only run this on a test account or when you want to verify limit enforcement.
 *
 * Usage:
 *   1. Create a .env.local file with MNX_KEY
 *   2. node 14.usage_limit_test.js
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MNX_KEY = process.env.MNX_KEY;
const BASE_URL = process.env.MNX_BASE_URL || "http://localhost:3000/api/v1";
const SUBJECT_ID = `limit_test_${Date.now()}`;

if (!MNX_KEY) {
  console.error("Error: MNX_KEY must be set in .env.local");
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${MNX_KEY}`,
  "Content-Type": "application/json",
};

let passed = 0;
let failed = 0;
let createdMemoryIds = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

// Helper to make API calls
async function api(method, path, body = null) {
  const options = {
    method,
    headers,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();
  return { status: res.status, data };
}

// Create a memory and track its ID
async function createMemory(text) {
  const { status, data } = await api("POST", "/memories", {
    subject_id: SUBJECT_ID,
    text,
    kind: "fact",
    importance: 50,
  });
  if (status === 200 && data.id) {
    createdMemoryIds.push(data.id);
  }
  return { status, data };
}

// Test functions for each API
async function testList() {
  const { status, data } = await api("GET", `/memories?subject_id=${SUBJECT_ID}`);
  return { status, data };
}

async function testCreate(index) {
  return await createMemory(`Test memory for usage limit ${index}`);
}

async function testGet(memoryId) {
  const { status, data } = await api("GET", `/memories/${memoryId}`);
  return { status, data };
}

async function testUpdate(memoryId, index) {
  const { status, data } = await api("PATCH", `/memories/${memoryId}`, {
    text: `Updated memory ${index}`,
  });
  return { status, data };
}

async function testDelete(memoryId) {
  const { status, data } = await api("DELETE", `/memories/${memoryId}`);
  return { status, data };
}

async function testSearch(query) {
  const { status, data } = await api("GET", `/memories/search?subject_id=${SUBJECT_ID}&q=${encodeURIComponent(query)}`);
  return { status, data };
}

// Memory services to test (6 billable actions)
// These match MEMORY_ACTIONS in activityLog.js:
// memory.create, memory.update, memory.delete, memory.search, memory.list, memory.get
const MEMORY_SERVICES = [
  "create",   // memory.create
  "list",     // memory.list
  "get",      // memory.get
  "update",   // memory.update
  "delete",   // memory.delete
  "search",   // memory.search
];

// Main test runner
async function runTests() {
  console.log("==================================================");
  console.log("Usage Limit Test Suite");
  console.log("==================================================");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Subject ID: ${SUBJECT_ID}`);
  console.log("==================================================\n");

  // First, check current usage
  console.log("--- Checking Current Usage ---");
  const initialList = await testList();
  console.log(`   Initial list status: ${initialList.status}`);
  
  if (initialList.status === 429) {
    console.log("\n⚠️  Already at usage limit! Test complete.");
    console.log(`   Error: ${initialList.data.error}`);
    console.log(`   Current: ${initialList.data.current}`);
    console.log(`   Limit: ${initialList.data.limit}`);
    return;
  }

  // Test 1: Create some memories
  console.log("\n--- Test: Create Memories ---");
  for (let i = 0; i < 5; i++) {
    await test(`POST /memories - create memory ${i + 1}`, async () => {
      const { status, data } = await testCreate(i);
      assert(status === 200 || status === 201 || status === 429, `Expected 200, 201, or 429, got ${status}`);
      if (status === 429) {
        console.log(`   ⚠️  Hit limit: ${data.current}/${data.limit}`);
      }
    });
  }

  // Test 2: List memories
  console.log("\n--- Test: List Memories ---");
  for (let i = 0; i < 5; i++) {
    await test(`GET /memories - list memories ${i + 1}`, async () => {
      const { status, data } = await testList();
      assert(status === 200 || status === 429, `Expected 200 or 429, got ${status}`);
      if (status === 429) {
        console.log(`   ⚠️  Hit limit: ${data.current}/${data.limit}`);
      }
    });
  }

  // Test 3: Get individual memories
  console.log("\n--- Test: Get Individual Memories ---");
  for (let i = 0; i < Math.min(5, createdMemoryIds.length); i++) {
    await test(`GET /memories/:id - get memory ${i + 1}`, async () => {
      const { status, data } = await testGet(createdMemoryIds[i]);
      assert(status === 200 || status === 429 || status === 404, `Expected 200, 404, or 429, got ${status}`);
      if (status === 429) {
        console.log(`   ⚠️  Hit limit: ${data.current}/${data.limit}`);
      }
    });
  }

  // Test 4: Update memories
  console.log("\n--- Test: Update Memories ---");
  for (let i = 0; i < Math.min(5, createdMemoryIds.length); i++) {
    await test(`PATCH /memories/:id - update memory ${i + 1}`, async () => {
      const { status, data } = await testUpdate(createdMemoryIds[i], i);
      assert(status === 200 || status === 429, `Expected 200 or 429, got ${status}`);
      if (status === 429) {
        console.log(`   ⚠️  Hit limit: ${data.current}/${data.limit}`);
      }
    });
  }

  // Test 5: Search memories
  console.log("\n--- Test: Search Memories ---");
  const searchQueries = ["test", "memory", "usage", "limit", "update"];
  for (let i = 0; i < searchQueries.length; i++) {
    await test(`GET /memories/search - search "${searchQueries[i]}"`, async () => {
      const { status, data } = await testSearch(searchQueries[i]);
      assert(status === 200 || status === 429, `Expected 200 or 429, got ${status}`);
      if (status === 429) {
        console.log(`   ⚠️  Hit limit: ${data.current}/${data.limit}`);
      }
    });
  }

  // Test 6: Delete memories
  console.log("\n--- Test: Delete Memories ---");
  for (let i = 0; i < Math.min(5, createdMemoryIds.length); i++) {
    await test(`DELETE /memories/:id - delete memory ${i + 1}`, async () => {
      const { status, data } = await testDelete(createdMemoryIds[i]);
      assert(status === 200 || status === 429, `Expected 200 or 429, got ${status}`);
      if (status === 429) {
        console.log(`   ⚠️  Hit limit: ${data.current}/${data.limit}`);
      }
    });
  }

  // Test 7: Run until 429 is hit
  console.log("\n--- Test: Run Until 429 Limit ---");
  console.log(`   Testing ${MEMORY_SERVICES.length} memory services: ${MEMORY_SERVICES.join(", ")}`);
  let found429 = false;
  let requestCount = 0;
  const maxRequests = 600; // Safety limit
  const serviceCounts = {};
  MEMORY_SERVICES.forEach(s => serviceCounts[s] = 0);
  
  // Pre-create some memories to work with
  console.log("   Pre-creating 20 memories for testing...");
  for (let i = 0; i < 20; i++) {
    const { status, data } = await api("POST", "/memories", {
      subject_id: SUBJECT_ID,
      text: `Pre-created memory ${i} for limit testing`,
      kind: "fact",
      importance: 50,
    });
    if ((status === 200 || status === 201) && data.id) {
      createdMemoryIds.push(data.id);
    }
    if (status === 429) {
      found429 = true;
      console.log(`\n✅ Hit 429 during pre-creation after ${i + 1} creates`);
      console.log(`   Error: ${data.error}`);
      console.log(`   Current: ${data.current}`);
      console.log(`   Limit: ${data.limit}`);
      passed++;
      break;
    }
  }
  console.log(`   Created ${createdMemoryIds.length} memories`);
  
  while (!found429 && requestCount < maxRequests) {
    // Rotate through different API calls
    const apiIndex = requestCount % MEMORY_SERVICES.length;
    const service = MEMORY_SERVICES[apiIndex];
    let result;
    
    switch (service) {
      case "create":
        result = await testCreate(requestCount);
        if ((result.status === 200 || result.status === 201) && result.data.id) {
          // Track new memory for other operations
        }
        serviceCounts.create++;
        break;
      case "list":
        result = await testList();
        serviceCounts.list++;
        break;
      case "get":
        // Always have a memory to get since we pre-created
        if (createdMemoryIds.length > 0) {
          result = await testGet(createdMemoryIds[requestCount % createdMemoryIds.length]);
        } else {
          // Create one if needed
          const createRes = await testCreate(requestCount);
          result = createRes;
        }
        serviceCounts.get++;
        break;
      case "update":
        if (createdMemoryIds.length > 0) {
          result = await testUpdate(createdMemoryIds[requestCount % createdMemoryIds.length], requestCount);
        } else {
          const createRes = await testCreate(requestCount);
          result = createRes;
        }
        serviceCounts.update++;
        break;
      case "search":
        result = await testSearch(`query${requestCount}`);
        serviceCounts.search++;
        break;
      case "delete":
        if (createdMemoryIds.length > 0) {
          result = await testDelete(createdMemoryIds.pop());
        } else {
          // Create one to delete
          const createRes = await testCreate(requestCount);
          if ((createRes.status === 200 || createRes.status === 201) && createRes.data.id) {
            result = await testDelete(createRes.data.id);
          } else {
            result = createRes;
          }
        }
        serviceCounts.delete++;
        break;
    }
    
    requestCount++;
    
    if (result.status === 429) {
      found429 = true;
      console.log(`\n✅ Hit 429 after ${requestCount} requests`);
      console.log(`   Error: ${result.data.error}`);
      console.log(`   Message: ${result.data.message}`);
      console.log(`   Current: ${result.data.current}`);
      console.log(`   Limit: ${result.data.limit}`);
      
      // Verify response format
      assert(result.data.error === "usage_limit_exceeded", `Expected error "usage_limit_exceeded", got "${result.data.error}"`);
      assert(typeof result.data.current === "number", "Expected 'current' to be a number");
      assert(typeof result.data.limit === "number", "Expected 'limit' to be a number");
      assert(typeof result.data.message === "string", "Expected 'message' to be a string");
      passed++;
    } else if (requestCount % 50 === 0) {
      console.log(`   ... ${requestCount} requests made, continuing...`);
    }
  }
  
  if (!found429) {
    console.log(`\n⚠️  Did not hit 429 after ${maxRequests} requests`);
    failed++;
  }

  // Summary
  console.log("\n==================================================");
  console.log("Service Breakdown:");
  MEMORY_SERVICES.forEach(s => {
    console.log(`   ${s}: ${serviceCounts[s]} requests`);
  });
  console.log("==================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("==================================================");
}

runTests().catch(console.error);
