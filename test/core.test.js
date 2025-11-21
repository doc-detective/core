const fs = require("fs");
const { runTests } = require("../src");
const { createServer } = require("./server");
const assert = require("assert").strict;
const path = require("path");
const artifactPath = path.resolve("./test/artifacts");
const config_base = require(`${artifactPath}/config.json`);
const inputPath = artifactPath;

// Create a server with custom options
const server = createServer({
  port: 8092,
  staticDir: "./test/server/public",
  modifyResponse: (req, body) => {
    // Optional modification of responses
    return { ...body, extraField: "added by server" };
  },
});

// Start the server before tests
before(async () => {
  try {
    await server.start();
  } catch (error) {
    console.error(`Failed to start test server: ${error.message}`);
    throw error;
  }
});

// Stop the server after tests
after(async () => {
  try {
    await server.stop();
  } catch (error) {
    console.error(`Failed to stop test server: ${error.message}`);
    // Don't rethrow here to avoid masking test failures
  }
});

describe("Run tests successfully", function () {
  // Set indefinite timeout
  this.timeout(0);
  describe("Core test suite", function () {
    // For each file (not directory) in artifactPath, create an individual test
    const files = fs.readdirSync(artifactPath);
    files.forEach((file) => {
      const filePath = path.join(artifactPath, file);
      if (fs.lstatSync(filePath).isFile() && file.endsWith(".json") && file !== "config.json") {
        it(`Test file: ${file}`, async () => {
          const config_tests = JSON.parse(JSON.stringify(config_base));
          config_tests.runTests.input = filePath;
          const result = await runTests(config_tests);
          if (result === null) assert.fail("Expected result to be non-null");
          assert.equal(result.summary.specs.fail, 0);
        });
      }
    });
  });

  it("Tests skip steps after a failure", async () => {
    const failureTest = {
      tests: [
        {
          steps: [
            {
              runShell: "exit 1", // This step will fail
            },
            {
              runShell:
                "echo 'This step should be skipped if the previous fails'",
            },
          ],
        },
      ],
    };
    // Write the failure test to a temporary file
    const tempFilePath = path.resolve("./test/temp-failure-test.json");
    fs.writeFileSync(tempFilePath, JSON.stringify(failureTest, null, 2));
    const config = { input: tempFilePath, logLevel: "debug" };
    let result;
    try {
      result = await runTests(config);
      assert.equal(result.summary.steps.fail, 1);
      assert.equal(result.summary.steps.skipped, 1);
    } finally {
      // Ensure cleanup even on failure
      fs.unlinkSync(tempFilePath);
    }
  });

  it("Test skips when unsafe and unsafe is disallowed", async () => {
    const unsafeTest = {
      tests: [
        {
          steps: [
            {
              runShell: "echo 'This step is unsafe'",
              unsafe: true, // Marked as potentially unsafe
            },
          ],
        },
      ],
    };
    // Write the unsafe test to a temporary file
    const tempFilePath = path.resolve("./test/temp-unsafe-test.json");
    fs.writeFileSync(tempFilePath, JSON.stringify(unsafeTest, null, 2));
    const config = {
      input: tempFilePath,
      logLevel: "debug",
      allowUnsafeSteps: false,
    };
    let result;
    try {
      result = await runTests(config);
      assert.equal(result.summary.specs.fail, 0);
      assert.equal(result.summary.specs.skipped, 1);
    } finally {
      // Ensure cleanup even on failure
      fs.unlinkSync(tempFilePath);
    }
  });

  it("Test is marked as skipped when all contexts are skipped", async () => {
    // Create a spec with a context for a different platform than the current one.
    // The resolver will generate a context that doesn't match the current platform,
    // which will cause it to be skipped.
    const currentPlatform = require("os").platform();
    const targetPlatform = currentPlatform === "win32" ? "linux" : "windows";

    const allContextsSkippedTest = {
      id: "test-all-contexts-skipped",
      contexts: [
        {
          app: { name: "firefox" },
          platforms: [targetPlatform], // Will be skipped on current platform
        },
      ],
      tests: [
        {
          id: "test-1",
          steps: [
            {
              action: "runShell",
              command: "echo 'This should not run'",
            },
          ],
        },
      ],
    };

    // Write the test to a temporary file
    const tempFilePath = path.resolve("./test/temp-all-contexts-skipped.json");
    fs.writeFileSync(
      tempFilePath,
      JSON.stringify(allContextsSkippedTest, null, 2)
    );
    const config = {
      input: tempFilePath,
      logLevel: "silent",
    };
    let result;
    try {
      result = await runTests(config);
      // Verify that the test is marked as skipped, not passed
      assert.equal(result.summary.tests.skipped, 1);
      assert.equal(result.summary.tests.pass, 0);
      assert.equal(result.summary.specs.skipped, 1);
      assert.equal(result.summary.specs.pass, 0);
      assert.equal(result.summary.contexts.skipped, 1);
      // Also verify the actual test result
      assert.equal(result.specs[0].result, "SKIPPED");
      assert.equal(result.specs[0].tests[0].result, "SKIPPED");
      assert.equal(result.specs[0].tests[0].contexts[0].result, "SKIPPED");
    } finally {
      // Ensure cleanup even on failure
      fs.unlinkSync(tempFilePath);
    }
  });

  it("runShell regression test returns WARNING when variation exceeds threshold", async () => {
    // Create a test file path
    const outputFilePath = path.resolve("./test/temp-regression-output.txt");

    // Create initial file with content
    fs.writeFileSync(outputFilePath, "initial content");

    const regressionTest = {
      tests: [
        {
          steps: [
            {
              runShell: {
                command: "echo",
                args: ["completely different content"],
                path: outputFilePath,
                maxVariation: 0.1,
                overwrite: "aboveVariation",
              },
            },
          ],
        },
      ],
    };

    const tempFilePath = path.resolve("./test/temp-regression-test.json");
    fs.writeFileSync(tempFilePath, JSON.stringify(regressionTest, null, 2));
    const config = { input: tempFilePath, logLevel: "silent" };
    let result;
    try {
      result = await runTests(config);
      // Verify that the step is marked as WARNING, not FAIL
      assert.equal(result.summary.steps.warning, 1);
      assert.equal(result.summary.steps.fail, 0);
      assert.equal(
        result.specs[0].tests[0].contexts[0].steps[0].result,
        "WARNING"
      );
    } finally {
      // Ensure cleanup even on failure
      fs.unlinkSync(tempFilePath);
      if (fs.existsSync(outputFilePath)) {
        fs.unlinkSync(outputFilePath);
      }
    }
  });

  it("screenshot regression test returns WARNING when variation exceeds threshold", async () => {
    // Create a test screenshot path
    const screenshotPath = path.resolve(
      "./test/temp-regression-screenshot.png"
    );
    const screenshotDir = path.dirname(screenshotPath);

    // Ensure directory exists
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // First, create an initial screenshot
    const initialTest = {
      tests: [
        {
          steps: [
            {
              goTo: "http://localhost:8092",
            },
            {
              screenshot: {
                path: screenshotPath,
                maxVariation: 0.05,
                overwrite: "false",
              },
            },
          ],
        },
      ],
    };

    const tempInitialFilePath = path.resolve(
      "./test/temp-initial-screenshot-test.json"
    );
    fs.writeFileSync(tempInitialFilePath, JSON.stringify(initialTest, null, 2));
    const initialConfig = { input: tempInitialFilePath, logLevel: "silent" };

    try {
      // Run initial test to create the baseline screenshot
      await runTests(initialConfig);

      // Now create a test that navigates to a different page to create variation
      const regressionTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8092/drag-drop-test.html",
              },
              {
                screenshot: {
                  path: screenshotPath,
                  maxVariation: 0.05,
                  overwrite: "aboveVariation",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve(
        "./test/temp-screenshot-regression-test.json"
      );
      fs.writeFileSync(tempFilePath, JSON.stringify(regressionTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      const result = await runTests(config);

      // Verify that the step is marked as WARNING, not FAIL
      assert.equal(result.summary.steps.warning, 1);
      assert.equal(result.summary.steps.fail, 0);
      assert.equal(
        result.specs[0].tests[0].contexts[0].steps[1].result,
        "WARNING"
      );

      // Cleanup test files
      fs.unlinkSync(tempFilePath);
      fs.unlinkSync(tempInitialFilePath);
    } finally {
      // Ensure cleanup even on failure
      if (fs.existsSync(tempInitialFilePath)) {
        fs.unlinkSync(tempInitialFilePath);
      }
      if (fs.existsSync(screenshotPath)) {
        fs.unlinkSync(screenshotPath);
      }
    }
  });
});

describe("Intelligent goTo behavior", function () {
  // Set indefinite timeout
  this.timeout(0);
  it("goTo fails with timeout on network idle check", async () => {
    const networkTimeoutTest = {
      tests: [
        {
          steps: [
            {
              goTo: {
                url: "http://localhost:8092/waitUntil-test-network-forever.html",
                timeout: 5000,
                waitUntil: {
                  networkIdleTime: 500,
                },
              },
            },
          ],
        },
      ],
    };
    const tempFilePath = path.resolve("./test/temp-network-timeout-test.json");
    fs.writeFileSync(tempFilePath, JSON.stringify(networkTimeoutTest, null, 2));
    const config = { input: tempFilePath, logLevel: "silent" };
    let result;
    try {
      result = await runTests(config);
      assert.equal(result.summary.steps.fail, 1);
      assert.equal(result.summary.tests.fail, 1);
    } finally {
      fs.unlinkSync(tempFilePath);
    }
  });

  it("goTo fails with timeout on DOM idle check", async () => {
    const domTimeoutTest = {
      tests: [
        {
          steps: [
            {
              goTo: {
                url: "http://localhost:8092/waitUntil-test-dom-mutations-forever.html",
                timeout: 5000,
                waitUntil: {
                  domIdleTime: 500,
                },
              },
            },
          ],
        },
      ],
    };
    const tempFilePath = path.resolve("./test/temp-dom-timeout-test.json");
    fs.writeFileSync(tempFilePath, JSON.stringify(domTimeoutTest, null, 2));
    const config = { input: tempFilePath, logLevel: "silent" };
    let result;
    try {
      result = await runTests(config);
      assert.equal(result.summary.steps.fail, 1);
      assert.equal(result.summary.tests.fail, 1);
    } finally {
      fs.unlinkSync(tempFilePath);
    }
  });

  it("goTo fails with timeout on element finding check", async () => {
    const elementTimeoutTest = {
      tests: [
        {
          steps: [
            {
              goTo: {
                url: "http://localhost:8092/index.html",
                timeout: 5000,
                waitUntil: {
                  find: {
                    selector: ".nonexistent-element-that-will-never-appear",
                  },
                },
              },
            },
          ],
        },
      ],
    };
    const tempFilePath = path.resolve("./test/temp-element-timeout-test.json");
    fs.writeFileSync(tempFilePath, JSON.stringify(elementTimeoutTest, null, 2));
    const config = { input: tempFilePath, logLevel: "silent" };
    let result;
    try {
      result = await runTests(config);
      assert.equal(result.summary.steps.fail, 1);
      assert.equal(result.summary.tests.fail, 1);
    } finally {
      fs.unlinkSync(tempFilePath);
    }
  });
});
