const { runTests } = require("./src/index");

async function testDebugMode() {
  console.log("=== Testing Debug Step-Through Mode ===\n");

  // Test with step-through mode enabled
  const config = {
    input: "debug-demo.spec.json",
    logLevel: "info",
    debug: "stepThrough"
  };

  console.log("Running test with debug step-through mode enabled...");
  console.log("Config:", JSON.stringify(config, null, 2));
  console.log("\nStarting test execution...\n");

  try {
    const results = await runTests(config);
    console.log("\n=== Debug Test Complete ===");
    if (results) {
      console.log("Results summary:", results.summary);
    }
  } catch (error) {
    console.error("Error during test execution:", error);
  }
}

testDebugMode();