const { runTests } = require("../src");
const fs = require("fs");
const path = require("path");

async function testParallelExecution() {
  console.log("Testing parallel execution...");
  
  // Create a simple test with multiple contexts
  const testSpec = {
    tests: [
      {
        steps: [
          {
            runShell: "echo 'Test context 1'",
          },
          {
            runShell: "sleep 1",
          },
        ],
        contexts: [
          { contextId: "context1" },
          { contextId: "context2" },
          { contextId: "context3" },
          { contextId: "context4" },
        ]
      },
    ],
  };

  // Write the test to a temporary file
  const tempFilePath = path.resolve("./test/temp-parallel-test.json");
  fs.writeFileSync(tempFilePath, JSON.stringify(testSpec, null, 2));

  try {
    // Test sequential execution (concurrentRunners: 1) - default
    console.log("Testing sequential execution...");
    const sequentialConfig = {
      input: tempFilePath,
      logLevel: "error",
    };
    const sequentialStart = Date.now();
    const sequentialResult = await runTests(sequentialConfig);
    const sequentialTime = Date.now() - sequentialStart;
    console.log(`Execution time: ${sequentialTime}ms`);
    console.log(`Contexts executed: ${sequentialResult.summary.contexts.pass}`);

    console.log("Test completed successfully!");

  } finally {
    // Cleanup
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

testParallelExecution().catch(console.error);