const assert = require("assert").strict;
const { runSpecs } = require("../src/tests");

describe("Concurrent Runners Configuration", function () {
  this.timeout(30000);

  it("should default to 1 concurrent runner when no config provided", async () => {
    const resolvedTests = {
      config: { logLevel: "error" },
      specs: [
        {
          specId: "test-spec",
          tests: [
            {
              testId: "test-1",
              contexts: [
                {
                  contextId: "context-1",
                  steps: [{ runShell: "echo 'test'" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await runSpecs({ resolvedTests });
    assert.equal(result.summary.contexts.pass, 1);
  });

  it("should use concurrentRunners from resolvedTests.config", async () => {
    const resolvedTests = {
      config: { 
        logLevel: "error",
        concurrentRunners: 2 
      },
      specs: [
        {
          specId: "test-spec",
          tests: [
            {
              testId: "test-1",
              contexts: [
                {
                  contextId: "context-1",
                  steps: [{ runShell: "echo 'test 1'" }],
                },
                {
                  contextId: "context-2",
                  steps: [{ runShell: "echo 'test 2'" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await runSpecs({ resolvedTests });
    assert.equal(result.summary.contexts.pass, 2);
  });

  it("should handle single context efficiently", async () => {
    const resolvedTests = {
      config: { 
        logLevel: "error",
        concurrentRunners: 4  // More workers than contexts
      },
      specs: [
        {
          specId: "test-spec",
          tests: [
            {
              testId: "test-1",
              contexts: [
                {
                  contextId: "context-1",
                  steps: [{ runShell: "echo 'single context'" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await runSpecs({ resolvedTests });
    assert.equal(result.summary.contexts.pass, 1);
    assert.equal(result.summary.steps.pass, 1);
  });

  it("should handle mixed step results correctly", async () => {
    const resolvedTests = {
      config: { 
        logLevel: "error",
        concurrentRunners: 2
      },
      specs: [
        {
          specId: "test-spec",
          tests: [
            {
              testId: "test-1",
              contexts: [
                {
                  contextId: "context-pass",
                  steps: [{ runShell: "echo 'success'" }],
                },
                {
                  contextId: "context-fail",
                  steps: [{ runShell: "exit 1" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await runSpecs({ resolvedTests });
    assert.equal(result.summary.contexts.pass, 1);
    assert.equal(result.summary.contexts.fail, 1);
    assert.equal(result.summary.steps.pass, 1);
    assert.equal(result.summary.steps.fail, 1);
  });
});