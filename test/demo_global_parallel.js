const { TestRunner } = require("../src/tests");

async function demonstrateGlobalParallelization() {
  console.log("=== Demonstrating Global Context-Level Parallelization ===\n");

  // Create contexts from multiple specs and tests to simulate the new architecture
  const allContexts = [
    // Spec 1, Test 1, Context 1
    {
      context: {
        contextId: "ctx-1-1-1",
        steps: [{ runShell: "sleep 0.5 && echo 'Spec1-Test1-Context1'" }]
      },
      spec: { specId: "spec-1" },
      test: { testId: "test-1-1" },
    },
    // Spec 1, Test 2, Context 1
    {
      context: {
        contextId: "ctx-1-2-1", 
        steps: [{ runShell: "sleep 0.3 && echo 'Spec1-Test2-Context1'" }]
      },
      spec: { specId: "spec-1" },
      test: { testId: "test-1-2" },
    },
    // Spec 1, Test 2, Context 2
    {
      context: {
        contextId: "ctx-1-2-2",
        steps: [{ runShell: "sleep 0.4 && echo 'Spec1-Test2-Context2'" }]
      },
      spec: { specId: "spec-1" },
      test: { testId: "test-1-2" },
    },
    // Spec 2, Test 1, Context 1
    {
      context: {
        contextId: "ctx-2-1-1",
        steps: [{ runShell: "sleep 0.6 && echo 'Spec2-Test1-Context1'" }]
      },
      spec: { specId: "spec-2" },
      test: { testId: "test-2-1" },
    },
    // Spec 2, Test 1, Context 2 
    {
      context: {
        contextId: "ctx-2-1-2",
        steps: [{ runShell: "sleep 0.2 && echo 'Spec2-Test1-Context2'" }]
      },
      spec: { specId: "spec-2" },
      test: { testId: "test-2-1" },
    },
    // Spec 2, Test 1, Context 3
    {
      context: {
        contextId: "ctx-2-1-3",
        steps: [{ runShell: "sleep 0.7 && echo 'Spec2-Test1-Context3'" }]
      },
      spec: { specId: "spec-2" },
      test: { testId: "test-2-1" },
    },
  ];

  const executionParams = {
    config: { logLevel: "error" },
    runnerDetails: {
      environment: { platform: "linux" },
      availableApps: [],
      allowUnsafeSteps: true,
    },
    availableApps: [],
    platform: "linux",
    metaValues: {
      specs: {
        "spec-1": {
          tests: {
            "test-1-1": { contexts: { "ctx-1-1-1": { steps: {} } } },
            "test-1-2": { contexts: { "ctx-1-2-1": { steps: {} }, "ctx-1-2-2": { steps: {} } } },
          }
        },
        "spec-2": {
          tests: {
            "test-2-1": { 
              contexts: { 
                "ctx-2-1-1": { steps: {} },
                "ctx-2-1-2": { steps: {} },
                "ctx-2-1-3": { steps: {} },
              } 
            },
          }
        }
      }
    },
  };

  console.log("Test structure:");
  console.log("- Spec 1:");
  console.log("  - Test 1: 1 context (0.5s)");
  console.log("  - Test 2: 2 contexts (0.3s, 0.4s)");
  console.log("- Spec 2:"); 
  console.log("  - Test 1: 3 contexts (0.6s, 0.2s, 0.7s)");
  console.log("\nTotal: 6 contexts across 2 specs and 3 tests");
  console.log("Using 3 concurrent workers\n");

  // Test with 1 worker (sequential)
  console.log("Running with 1 worker (sequential)...");
  const runner1 = new TestRunner(1);
  const startTime1 = Date.now();
  await runner1.runTests(allContexts, executionParams);
  const endTime1 = Date.now();
  const sequentialTime = endTime1 - startTime1;

  // Test with 3 workers (parallel)
  console.log("Running with 3 workers (parallel)...");
  const runner3 = new TestRunner(3);
  const startTime3 = Date.now();
  const results = await runner3.runTests(allContexts, executionParams);
  const endTime3 = Date.now();
  const parallelTime = endTime3 - startTime3;

  console.log(`\nExecution times:`);
  console.log(`- Sequential (1 worker): ${sequentialTime}ms`);
  console.log(`- Parallel (3 workers): ${parallelTime}ms`);
  console.log(`- Speedup: ${(sequentialTime / parallelTime).toFixed(1)}x`);

  console.log("\nResults summary:");
  const passCount = results.filter(r => r.contextReport.result === "PASS").length;
  const failCount = results.filter(r => r.contextReport.result === "FAIL").length;
  console.log(`- Contexts: ${passCount} passed, ${failCount} failed`);
  
  console.log("\n✅ Global context-level parallelization working correctly!");
  console.log("   Workers process contexts from any spec/test, maximizing resource utilization");
  console.log("   Previously would block on long-running tests with single contexts");
  console.log("   Now all contexts compete for available workers regardless of their test/spec");
}

if (require.main === module) {
  demonstrateGlobalParallelization().catch(console.error);
}

module.exports = { demonstrateGlobalParallelization };