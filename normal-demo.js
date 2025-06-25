const { runTests } = require("./src/index");

async function testNormalMode() {
  console.log("=== Testing Normal Mode (No Debug) ===\n");

  // Test with debug disabled
  const config = {
    input: "debug-demo.spec.json",
    logLevel: "info",
    debug: false
  };

  console.log("Running test with debug disabled...");
  console.log("Config:", JSON.stringify(config, null, 2));
  console.log("\nStarting test execution...\n");

  try {
    const results = await runTests(config);
    console.log("\n=== Normal Test Complete ===");
    if (results) {
      console.log("Results summary:", results.summary);
    }
  } catch (error) {
    console.error("Error during test execution:", error);
  }
}

testNormalMode();