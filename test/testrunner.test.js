const assert = require("assert").strict;
const { executeTestContext, TestRunner } = require("../src/tests");
const path = require("path");

describe("TestRunner Parallel Execution", function () {
  this.timeout(30000);

  it("executeTestContext should handle simple shell commands", async () => {
    const context = {
      contextId: "test-context",
      steps: [
        {
          runShell: "echo 'hello world'",
        },
      ],
    };

    const mockConfig = {
      logLevel: "error",
    };

    const mockSpec = {
      specId: "test-spec",
    };

    const mockTest = {
      testId: "test-test",
    };

    const mockRunnerDetails = {
      environment: { platform: "linux" },
      availableApps: [],
      allowUnsafeSteps: true,
    };

    const mockMetaValues = {
      specs: {
        "test-spec": {
          tests: {
            "test-test": {
              contexts: {
                "test-context": { steps: {} }
              }
            }
          }
        }
      }
    };

    try {
      const result = await executeTestContext({
        context,
        config: mockConfig,
        spec: mockSpec,
        test: mockTest,
        runnerDetails: mockRunnerDetails,
        availableApps: [],
        platform: "linux",
        metaValues: mockMetaValues,
      });

      assert(result.contextReport, "Should return a context report");
      assert(result.summary, "Should return a summary");
      assert.equal(result.contextReport.result, "PASS", "Context should pass");
      assert(result.contextReport.steps.length > 0, "Should have executed steps");
    } catch (error) {
      // Log the error for debugging
      console.error("Test failed with error:", error.message);
      throw error;
    }
  });

  it("executeTestContext should handle context with no driver requirements", async () => {
    const context = {
      contextId: "test-context-2",
      steps: [
        {
          runShell: "echo 'test 1'",
        },
        {
          runShell: "echo 'test 2'",
        },
      ],
    };

    const mockConfig = {
      logLevel: "error",
    };

    const mockSpec = {
      specId: "test-spec-2",
    };

    const mockTest = {
      testId: "test-test-2",
    };

    const mockRunnerDetails = {
      environment: { platform: "linux" },
      availableApps: [],
      allowUnsafeSteps: true,
    };

    const mockMetaValues = {
      specs: {
        "test-spec-2": {
          tests: {
            "test-test-2": {
              contexts: {
                "test-context-2": { steps: {} }
              }
            }
          }
        }
      }
    };

    try {
      const result = await executeTestContext({
        context,
        config: mockConfig,
        spec: mockSpec,
        test: mockTest,
        runnerDetails: mockRunnerDetails,
        availableApps: [],
        platform: "linux",
        metaValues: mockMetaValues,
      });

      assert(result.contextReport, "Should return a context report");
      assert.equal(result.contextReport.result, "PASS", "Context should pass");
      assert.equal(result.contextReport.steps.length, 2, "Should have executed 2 steps");
      assert.equal(result.summary.steps.pass, 2, "Should have 2 passing steps");
    } catch (error) {
      console.error("Test failed with error:", error.message);
      throw error;
    }
  });

  it("TestRunner should execute contexts sequentially with 1 worker", async () => {
    const contexts = [
      {
        context: {
          contextId: "context-1",
          steps: [{ runShell: "echo 'context 1'" }],
        },
        spec: { specId: "spec-1" },
        test: { testId: "test-1" },
      },
      {
        context: {
          contextId: "context-2", 
          steps: [{ runShell: "echo 'context 2'" }],
        },
        spec: { specId: "spec-1" },
        test: { testId: "test-1" },
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
              "test-1": {
                contexts: {
                  "context-1": { steps: {} },
                  "context-2": { steps: {} },
                }
              }
            }
          }
        }
      },
    };

    const testRunner = new TestRunner(1);
    const results = await testRunner.runTests(contexts, executionParams);

    assert.equal(results.length, 2, "Should execute both contexts");
    assert.equal(results[0].contextReport.result, "PASS", "Context 1 should pass");
    assert.equal(results[1].contextReport.result, "PASS", "Context 2 should pass");
  });

  it("TestRunner should execute contexts in parallel with multiple workers", async () => {
    const contexts = [
      {
        context: {
          contextId: "context-1",
          steps: [{ runShell: "sleep 0.1 && echo 'context 1'" }],
        },
        spec: { specId: "spec-1" },
        test: { testId: "test-1" },
      },
      {
        context: {
          contextId: "context-2", 
          steps: [{ runShell: "sleep 0.1 && echo 'context 2'" }],
        },
        spec: { specId: "spec-1" },
        test: { testId: "test-1" },
      },
      {
        context: {
          contextId: "context-3", 
          steps: [{ runShell: "sleep 0.1 && echo 'context 3'" }],
        },
        spec: { specId: "spec-1" },
        test: { testId: "test-1" },
      },
      {
        context: {
          contextId: "context-4", 
          steps: [{ runShell: "sleep 0.1 && echo 'context 4'" }],
        },
        spec: { specId: "spec-1" },
        test: { testId: "test-1" },
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
              "test-1": {
                contexts: {
                  "context-1": { steps: {} },
                  "context-2": { steps: {} },
                  "context-3": { steps: {} },
                  "context-4": { steps: {} },
                }
              }
            }
          }
        }
      },
    };

    // Test sequential execution
    const sequentialRunner = new TestRunner(1);
    const sequentialStart = Date.now();
    const sequentialResults = await sequentialRunner.runTests(contexts, executionParams);
    const sequentialTime = Date.now() - sequentialStart;

    // Test parallel execution 
    const parallelRunner = new TestRunner(4);
    const parallelStart = Date.now();
    const parallelResults = await parallelRunner.runTests(contexts, executionParams);
    const parallelTime = Date.now() - parallelStart;

    // Verify results
    assert.equal(sequentialResults.length, 4, "Sequential should execute all contexts");
    assert.equal(parallelResults.length, 4, "Parallel should execute all contexts");
    
    // All contexts should pass
    assert(sequentialResults.every(r => r.contextReport.result === "PASS"), "All sequential contexts should pass");
    assert(parallelResults.every(r => r.contextReport.result === "PASS"), "All parallel contexts should pass");

    // Parallel should be faster (though this is timing-dependent)
    console.log(`Sequential time: ${sequentialTime}ms, Parallel time: ${parallelTime}ms`);
    
    // The parallel execution should generally be faster, but we'll just verify it didn't take significantly longer
    assert(parallelTime < sequentialTime * 1.5, "Parallel execution shouldn't be significantly slower");
  });

  it("TestRunner should handle errors gracefully without stopping other contexts", async () => {
    const contexts = [
      {
        context: {
          contextId: "context-pass-1",
          steps: [{ runShell: "echo 'success 1'" }],
        },
        spec: { specId: "spec-1" },
        test: { testId: "test-1" },
      },
      {
        context: {
          contextId: "context-fail", 
          steps: [{ runShell: "exit 1" }], // This will fail
        },
        spec: { specId: "spec-1" },
        test: { testId: "test-1" },
      },
      {
        context: {
          contextId: "context-pass-2", 
          steps: [{ runShell: "echo 'success 2'" }],
        },
        spec: { specId: "spec-1" },
        test: { testId: "test-1" },
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
              "test-1": {
                contexts: {
                  "context-pass-1": { steps: {} },
                  "context-fail": { steps: {} },
                  "context-pass-2": { steps: {} },
                }
              }
            }
          }
        }
      },
    };

    const testRunner = new TestRunner(2);
    const results = await testRunner.runTests(contexts, executionParams);

    assert.equal(results.length, 3, "Should execute all contexts");
    
    // Find results by context ID
    const pass1Result = results.find(r => r.contextReport.platform === "linux" && r.contextReport.steps.length > 0 && r.contextReport.steps[0].runShell === "echo 'success 1'");
    const failResult = results.find(r => r.contextReport.result === "FAIL");
    const pass2Result = results.find(r => r.contextReport.platform === "linux" && r.contextReport.steps.length > 0 && r.contextReport.steps[0].runShell === "echo 'success 2'");

    assert(pass1Result, "Should find first passing context");
    assert(failResult, "Should find failing context");  
    assert(pass2Result, "Should find second passing context");
    
    assert.equal(pass1Result.contextReport.result, "PASS", "First context should pass");
    assert.equal(failResult.contextReport.result, "FAIL", "Middle context should fail");
    assert.equal(pass2Result.contextReport.result, "PASS", "Third context should pass");
  });
});