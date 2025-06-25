const { executeTestContext } = require("./src/tests");

async function testDebugNonInteractive() {
  console.log("=== Testing Debug Mode (Non-Interactive) ===\n");

  // Temporarily disable TTY to simulate non-interactive environment
  const originalIsTTY = process.stdin.isTTY;
  process.stdin.isTTY = false;

  try {
    // Create a mock config with debug enabled internally
    const config = {
      logLevel: "info",
      debug: "stepThrough",
      _debugParsed: {
        stepThrough: true,
        breakOnFail: false,
        breakpoints: []
      }
    };

    const context = {
      contextId: "debug-test-context",
      steps: [
        {
          stepId: "step-1",
          description: "First test step",
          runShell: "echo 'Step 1: Hello from debug mode'"
        },
        {
          stepId: "step-2", 
          description: "Second test step",
          runShell: "echo 'Step 2: This is the second step'"
        },
        {
          stepId: "step-3",
          description: "Third test step", 
          runShell: "echo 'Step 3: Final step'"
        }
      ]
    };

    const spec = { specId: "debug-test-spec" };
    const test = { testId: "debug-test-test" };
    const runnerDetails = {
      environment: { platform: "linux" },
      availableApps: [],
      allowUnsafeSteps: true
    };
    const metaValues = {
      specs: {
        "debug-test-spec": {
          tests: {
            "debug-test-test": {
              contexts: {
                "debug-test-context": { steps: {} }
              }
            }
          }
        }
      }
    };

    console.log("Starting debug test execution (non-interactive)...");
    console.log("In non-interactive mode, debug pauses will auto-continue.\n");

    const result = await executeTestContext({
      context,
      config,
      spec,
      test,
      runnerDetails,
      availableApps: [],
      platform: "linux",
      metaValues,
    });

    console.log("\n=== Debug Test Complete ===");
    console.log("Result:", result.contextReport.result);
    console.log("Steps executed:", result.contextReport.steps.length);
    result.contextReport.steps.forEach((step, index) => {
      console.log(`  Step ${index + 1}: ${step.result} - ${step.description}`);
    });
  } catch (error) {
    console.error("Error during test execution:", error);
  } finally {
    // Restore TTY setting
    process.stdin.isTTY = originalIsTTY;
  }
}

testDebugNonInteractive();