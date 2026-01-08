/**
 * Run All Provider Tests
 * 
 * Runs all provider tests in sequence:
 * 1. OpenAI tests
 * 2. Claude tests
 * 3. Gemini tests
 * 4. Cross-provider memory tests
 * 
 * Run: node X-provider/run-all.js
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tests = [
  { name: "OpenAI", file: "openai.test.js" },
  { name: "Claude", file: "claude.test.js" },
  { name: "Gemini", file: "gemini.test.js" },
  { name: "Cross-Provider", file: "cross-provider.test.js" },
];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n${"#".repeat(70)}`);
    console.log(`# Running: ${test.name} Tests`);
    console.log(`${"#".repeat(70)}\n`);

    const child = spawn("node", [test.file], {
      stdio: "inherit",
      cwd: __dirname,
    });

    child.on("close", (code) => {
      resolve({ name: test.name, passed: code === 0 });
    });
  });
}

async function main() {
  console.log("=".repeat(70));
  console.log("MNEXIUM PROVIDER TEST SUITE");
  console.log("=".repeat(70));
  console.log("\nThis will run comprehensive tests for all providers:");
  console.log("  • OpenAI (GPT-4o-mini) - Native SDK");
  console.log("  • Claude (Haiku) - Native Anthropic SDK");
  console.log("  • Gemini (Flash-Lite, 2.5-Flash) - Native Google SDK");
  console.log("  • Cross-Provider Memory Sharing");

  const results = [];

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("FINAL SUMMARY");
  console.log("=".repeat(70));

  let allPassed = true;
  for (const result of results) {
    const status = result.passed ? "✅ PASSED" : "❌ FAILED";
    console.log(`  ${result.name}: ${status}`);
    if (!result.passed) allPassed = false;
  }

  console.log("");
  if (allPassed) {
    console.log("🎉 ALL TEST SUITES PASSED!");
    console.log("✓ OpenAI, Claude, and Gemini all work through Mnexium");
    console.log("✓ Memories are shared across all providers");
  } else {
    console.log("⚠️  Some test suites failed. Review the output above.");
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
