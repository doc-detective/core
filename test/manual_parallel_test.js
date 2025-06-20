// Manual test to demonstrate parallel execution working
// This bypasses the resolver config validation

const { runSpecs } = require("../src/tests");

async function manualParallelTest() {
  console.log("Manual parallel execution test...");

  // Mock resolved tests structure
  const resolvedTests = {
    config: {
      logLevel: "debug",
      concurrentRunners: 3, // Test with 3 concurrent runners
    },
    specs: [
      {
        specId: "test-spec",
        description: "Parallel test spec",
        tests: [
          {
            testId: "test-1",
            description: "Test with multiple contexts",
            contexts: [
              {
                contextId: "context-1",
                steps: [
                  { runShell: "echo 'Context 1 start - $(date)'" },
                  { runShell: "sleep 1" },
                  { runShell: "echo 'Context 1 end - $(date)'" },
                ],
              },
              {
                contextId: "context-2", 
                steps: [
                  { runShell: "echo 'Context 2 start - $(date)'" },
                  { runShell: "sleep 1" },
                  { runShell: "echo 'Context 2 end - $(date)'" },
                ],
              },
              {
                contextId: "context-3",
                steps: [
                  { runShell: "echo 'Context 3 start - $(date)'" },
                  { runShell: "sleep 1" },
                  { runShell: "echo 'Context 3 end - $(date)'" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const start = Date.now();
    const result = await runSpecs({ resolvedTests });
    const duration = Date.now() - start;

    console.log(`\nExecution completed in ${duration}ms`);
    console.log(`Contexts executed: ${result.summary.contexts.pass}`);
    console.log(`Steps executed: ${result.summary.steps.pass}`);
    console.log(`\nResult summary:`, JSON.stringify(result.summary, null, 2));

    // With parallel execution, 3 contexts should execute faster than sequential
    // Each context has ~1000ms sleep, so sequential would be ~3000ms, parallel should be much less
    if (duration < 2500) {
      console.log("✅ Parallel execution is working - execution time indicates concurrency");
    } else {
      console.log("⚠️  Execution time suggests sequential execution");
    }

  } catch (error) {
    console.error("Test failed:", error.message);
    console.error(error.stack);
  }
}

manualParallelTest();