/**
 * Scope-based session management tests
 * Tests for creating, managing, and cleaning up named scopes for long-running processes
 */

const assert = require("assert").strict;
const path = require("path");

// =============================================================================
// REGISTRY TESTS
// =============================================================================

describe("Scope Registry", function () {
  this.timeout(10000); // 10 second timeout for scope tests

  let ScopeRegistry;

  before(function () {
    // Import will fail initially - this is expected (RED phase)
    try {
      const scopes = require("../src/scopes");
      ScopeRegistry = scopes.ScopeRegistry;
    } catch (e) {
      // Module doesn't exist yet - expected in RED phase
    }
  });

  describe("Basic CRUD operations", function () {
    it("should create a new scope registry", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      assert.ok(registry, "registry should be created");
      assert.equal(typeof registry.has, "function", "has should be a function");
      assert.equal(typeof registry.get, "function", "get should be a function");
      assert.equal(typeof registry.create, "function", "create should be a function");
      assert.equal(typeof registry.delete, "function", "delete should be a function");
    });

    it("should register a new scope with a name", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      const mockProcess = { pid: 12345 };
      
      registry.create("my-scope", mockProcess);
      
      assert.ok(registry.has("my-scope"), "scope should exist after creation");
    });

    it("should retrieve a scope by name", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      const mockProcess = { pid: 12345 };
      
      registry.create("my-scope", mockProcess);
      const scope = registry.get("my-scope");
      
      assert.ok(scope, "should retrieve scope");
      assert.equal(scope.process.pid, 12345, "should have correct process");
    });

    it("should return undefined for non-existent scope", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      
      const scope = registry.get("non-existent");
      
      assert.equal(scope, undefined, "should return undefined");
    });

    it("should delete a scope by name", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      const mockProcess = { pid: 12345 };
      
      registry.create("my-scope", mockProcess);
      assert.ok(registry.has("my-scope"), "scope should exist");
      
      registry.delete("my-scope");
      assert.ok(!registry.has("my-scope"), "scope should not exist after deletion");
    });

    it("should not throw when deleting non-existent scope", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      
      assert.doesNotThrow(() => {
        registry.delete("non-existent");
      }, "should not throw for non-existent scope");
    });

    it("should throw error when creating scope with empty name", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      const mockProcess = { pid: 12345 };
      
      assert.throws(() => {
        registry.create("", mockProcess);
      }, /scope name/i, "should throw for empty name");
    });

    it("should throw error when creating scope with existing name", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      const mockProcess = { pid: 12345 };
      
      registry.create("my-scope", mockProcess);
      
      assert.throws(() => {
        registry.create("my-scope", mockProcess);
      }, /already exists/i, "should throw for duplicate name");
    });
  });

  describe("Output buffering", function () {
    it("should initialize scope with empty stdout buffer", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      const mockProcess = { pid: 12345 };
      
      registry.create("my-scope", mockProcess);
      const scope = registry.get("my-scope");
      
      assert.equal(scope.stdout, "", "stdout should be empty string");
    });

    it("should initialize scope with empty stderr buffer", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      const mockProcess = { pid: 12345 };
      
      registry.create("my-scope", mockProcess);
      const scope = registry.get("my-scope");
      
      assert.equal(scope.stderr, "", "stderr should be empty string");
    });

    it("should append to stdout buffer", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      const mockProcess = { pid: 12345 };
      
      registry.create("my-scope", mockProcess);
      registry.appendStdout("my-scope", "line 1\n");
      registry.appendStdout("my-scope", "line 2\n");
      
      const scope = registry.get("my-scope");
      assert.equal(scope.stdout, "line 1\nline 2\n", "stdout should accumulate");
    });

    it("should append to stderr buffer", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      const mockProcess = { pid: 12345 };
      
      registry.create("my-scope", mockProcess);
      registry.appendStderr("my-scope", "error 1\n");
      registry.appendStderr("my-scope", "error 2\n");
      
      const scope = registry.get("my-scope");
      assert.equal(scope.stderr, "error 1\nerror 2\n", "stderr should accumulate");
    });

    it("should not throw when appending to non-existent scope", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      
      assert.doesNotThrow(() => {
        registry.appendStdout("non-existent", "data");
        registry.appendStderr("non-existent", "data");
      }, "should not throw for non-existent scope");
    });
  });

  describe("Scope listing and cleanup", function () {
    it("should list all scope names", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      
      registry.create("scope-1", { pid: 1 });
      registry.create("scope-2", { pid: 2 });
      registry.create("scope-3", { pid: 3 });
      
      const names = registry.list();
      
      assert.ok(Array.isArray(names), "should return array");
      assert.equal(names.length, 3, "should have 3 scopes");
      assert.ok(names.includes("scope-1"), "should include scope-1");
      assert.ok(names.includes("scope-2"), "should include scope-2");
      assert.ok(names.includes("scope-3"), "should include scope-3");
    });

    it("should return empty array when no scopes", function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      
      const names = registry.list();
      
      assert.ok(Array.isArray(names), "should return array");
      assert.equal(names.length, 0, "should be empty");
    });

    it("should cleanup all scopes", async function () {
      if (!ScopeRegistry) this.skip();
      const registry = new ScopeRegistry();
      
      // Create mock processes with kill method
      const killed = [];
      const mockProcess1 = { 
        pid: 1, 
        kill: () => { killed.push(1); }
      };
      const mockProcess2 = { 
        pid: 2, 
        kill: () => { killed.push(2); }
      };
      
      registry.create("scope-1", mockProcess1);
      registry.create("scope-2", mockProcess2);
      
      await registry.cleanup();
      
      assert.equal(registry.list().length, 0, "all scopes should be removed");
      assert.deepEqual(killed.sort(), [1, 2], "all processes should be killed");
    });
  });
});

// =============================================================================
// TERMINAL SCOPE TESTS
// =============================================================================

describe("Terminal Scope", function () {
  this.timeout(30000); // 30 second timeout for terminal tests

  let createTerminalScope, terminateScope;

  before(function () {
    try {
      const scopes = require("../src/scopes");
      createTerminalScope = scopes.createTerminalScope;
      terminateScope = scopes.terminateScope;
    } catch (e) {
      // Module doesn't exist yet - expected in RED phase
    }
  });

  describe("Creating terminal scopes", function () {
    it("should create a terminal scope with a command", async function () {
      if (!createTerminalScope) this.skip();
      
      const result = await createTerminalScope({
        command: "echo",
        args: ["hello"],
      });
      
      assert.ok(result, "should return result");
      assert.ok(result.process, "should have process");
      assert.ok(result.process.pid, "process should have pid");
    });

    it("should create a terminal scope with working directory", async function () {
      if (!createTerminalScope) this.skip();
      
      const result = await createTerminalScope({
        command: "pwd",
        args: [],
        cwd: "/tmp",
      });
      
      assert.ok(result, "should return result");
      assert.ok(result.process, "should have process");
    });

    it("should create a terminal scope with environment variables", async function () {
      if (!createTerminalScope) this.skip();
      
      const result = await createTerminalScope({
        command: "printenv",
        args: ["MY_TEST_VAR"],
        env: { MY_TEST_VAR: "test-value" },
      });
      
      assert.ok(result, "should return result");
    });

    it("should return stdout from the command", async function () {
      if (!createTerminalScope) this.skip();
      
      const result = await createTerminalScope({
        command: "echo",
        args: ["test output"],
        waitForExit: true,
      });
      
      assert.ok(result.stdout, "should have stdout");
      assert.ok(result.stdout.includes("test output"), "stdout should contain output");
    });

    it("should capture stderr from the command", async function () {
      if (!createTerminalScope) this.skip();
      
      // Use a command that writes to stderr
      const result = await createTerminalScope({
        command: "sh",
        args: ["-c", "echo error >&2"],
        waitForExit: true,
      });
      
      // In PTY, stderr often merges with stdout, but we should have output
      assert.ok(result.stdout || result.stderr, "should have some output");
    });

    it("should handle invalid command gracefully", async function () {
      if (!createTerminalScope) this.skip();
      
      // node-pty doesn't throw for invalid commands, it exits with error output
      const result = await createTerminalScope({
        command: "nonexistent-command-12345",
        args: [],
        waitForExit: true,
      });
      
      // Should have error output or non-zero exit code
      assert.ok(
        result.stdout.includes("not found") || 
        result.stdout.includes("No such file") ||
        result.exitCode !== 0,
        "should indicate command failure"
      );
    });
  });

  describe("Long-running processes", function () {
    it("should start a long-running process without waiting for exit", async function () {
      if (!createTerminalScope) this.skip();
      
      const result = await createTerminalScope({
        command: "sleep",
        args: ["60"],
        waitForExit: false,
      });
      
      assert.ok(result.process, "should have process");
      assert.ok(result.process.pid, "process should have pid");
      
      // Clean up
      result.process.kill();
    });

    it("should allow writing to stdin of running process", async function () {
      if (!createTerminalScope) this.skip();
      
      const result = await createTerminalScope({
        command: "cat",
        args: [],
        waitForExit: false,
      });
      
      assert.ok(result.process, "should have process");
      assert.ok(typeof result.process.write === "function", "should have write method");
      
      // Write to stdin
      result.process.write("hello\n");
      
      // Clean up
      result.process.kill();
    });
  });

  describe("Terminating scopes", function () {
    it("should terminate a running process gracefully", async function () {
      if (!createTerminalScope || !terminateScope) this.skip();
      
      const result = await createTerminalScope({
        command: "sleep",
        args: ["60"],
        waitForExit: false,
      });
      
      const pid = result.process.pid;
      assert.ok(pid, "should have pid");
      
      await terminateScope(result.process);
      
      // Process should be terminated
      // Give it a moment to clean up
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it("should force kill if graceful termination fails", async function () {
      if (!createTerminalScope || !terminateScope) this.skip();
      
      // Start a process that ignores SIGTERM
      const result = await createTerminalScope({
        command: "sh",
        args: ["-c", "trap '' TERM; sleep 60"],
        waitForExit: false,
      });
      
      const pid = result.process.pid;
      assert.ok(pid, "should have pid");
      
      // Should eventually kill even if SIGTERM is ignored
      await terminateScope(result.process, { timeout: 500 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it("should not throw when terminating already-exited process", async function () {
      if (!createTerminalScope || !terminateScope) this.skip();
      
      const result = await createTerminalScope({
        command: "echo",
        args: ["done"],
        waitForExit: true,
      });
      
      // Process has already exited
      await assert.doesNotReject(
        terminateScope(result.process),
        "should not throw for exited process"
      );
    });
  });
});

// =============================================================================
// WAIT UNTIL TESTS
// =============================================================================

describe("Wait Until Conditions", function () {
  this.timeout(30000);

  let waitForConditions, createTerminalScope, ScopeRegistry;

  before(function () {
    try {
      const scopes = require("../src/scopes");
      waitForConditions = scopes.waitForConditions;
      createTerminalScope = scopes.createTerminalScope;
      ScopeRegistry = scopes.ScopeRegistry;
    } catch (e) {
      // Module doesn't exist yet - expected in RED phase
    }
  });

  describe("String matching", function () {
    it("should wait for stdout to contain string", async function () {
      if (!waitForConditions || !createTerminalScope || !ScopeRegistry) this.skip();
      
      const registry = new ScopeRegistry();
      
      // Start a process that outputs after a delay
      const result = await createTerminalScope({
        command: "sh",
        args: ["-c", "sleep 0.5 && echo 'SERVER READY'"],
        waitForExit: false,
      });
      
      registry.create("test-scope", result.process);
      
      // Set up output capture
      result.process.onData((data) => {
        registry.appendStdout("test-scope", data);
      });
      
      const matched = await waitForConditions(registry, "test-scope", {
        stdout: "SERVER READY",
        timeout: 5000,
      });
      
      assert.ok(matched, "should find the string");
      
      result.process.kill();
    });

    it("should timeout if string not found", async function () {
      if (!waitForConditions || !createTerminalScope || !ScopeRegistry) this.skip();
      
      const registry = new ScopeRegistry();
      
      const result = await createTerminalScope({
        command: "echo",
        args: ["wrong output"],
        waitForExit: false,
      });
      
      registry.create("test-scope", result.process);
      
      result.process.onData((data) => {
        registry.appendStdout("test-scope", data);
      });
      
      await assert.rejects(
        waitForConditions(registry, "test-scope", {
          stdout: "NEVER FOUND",
          timeout: 500,
        }),
        /timeout/i,
        "should timeout"
      );
      
      result.process.kill();
    });
  });

  describe("Regex matching", function () {
    it("should wait for stdout to match regex pattern", async function () {
      if (!waitForConditions || !createTerminalScope || !ScopeRegistry) this.skip();
      
      const registry = new ScopeRegistry();
      
      const result = await createTerminalScope({
        command: "sh",
        args: ["-c", "sleep 0.2 && echo 'Server listening on port 3000'"],
        waitForExit: false,
      });
      
      registry.create("test-scope", result.process);
      
      result.process.onData((data) => {
        registry.appendStdout("test-scope", data);
      });
      
      const matched = await waitForConditions(registry, "test-scope", {
        stdout: "/port \\d+/",
        timeout: 5000,
      });
      
      assert.ok(matched, "should match regex");
      
      result.process.kill();
    });

    it("should support regex flags in pattern", async function () {
      if (!waitForConditions || !createTerminalScope || !ScopeRegistry) this.skip();
      
      const registry = new ScopeRegistry();
      
      const result = await createTerminalScope({
        command: "sh",
        args: ["-c", "sleep 0.2 && echo 'READY'"],
        waitForExit: false,
      });
      
      registry.create("test-scope", result.process);
      
      result.process.onData((data) => {
        registry.appendStdout("test-scope", data);
      });
      
      const matched = await waitForConditions(registry, "test-scope", {
        stdout: "/ready/i", // Case insensitive
        timeout: 5000,
      });
      
      assert.ok(matched, "should match with flags");
      
      result.process.kill();
    });

    it("should handle invalid regex gracefully", async function () {
      if (!waitForConditions || !ScopeRegistry) this.skip();
      
      const registry = new ScopeRegistry();
      registry.create("test-scope", { pid: 1 });
      registry.appendStdout("test-scope", "some output");
      
      await assert.rejects(
        waitForConditions(registry, "test-scope", {
          stdout: "/[invalid/",
          timeout: 500,
        }),
        /regex|pattern|invalid/i,
        "should throw for invalid regex"
      );
    });
  });

  describe("Multiple conditions", function () {
    it("should wait for both stdout and stderr conditions", async function () {
      if (!waitForConditions || !createTerminalScope || !ScopeRegistry) this.skip();
      
      const registry = new ScopeRegistry();
      
      const result = await createTerminalScope({
        command: "sh",
        args: ["-c", "sleep 0.2 && echo 'stdout ready' && echo 'stderr ready' >&2"],
        waitForExit: false,
      });
      
      registry.create("test-scope", result.process);
      
      // In PTY mode, both go to stdout typically
      result.process.onData((data) => {
        registry.appendStdout("test-scope", data);
      });
      
      // Wait for stdout condition at minimum
      const matched = await waitForConditions(registry, "test-scope", {
        stdout: "ready",
        timeout: 5000,
      });
      
      assert.ok(matched, "should match condition");
      
      result.process.kill();
    });
  });
});

// =============================================================================
// CLEANUP HANDLER TESTS
// =============================================================================

describe("Cleanup Handlers", function () {
  this.timeout(10000);

  let setupCleanupHandlers, ScopeRegistry;

  before(function () {
    try {
      const scopes = require("../src/scopes");
      setupCleanupHandlers = scopes.setupCleanupHandlers;
      ScopeRegistry = scopes.ScopeRegistry;
    } catch (e) {
      // Module doesn't exist yet
    }
  });

  it("should export setupCleanupHandlers function", function () {
    if (!setupCleanupHandlers) this.skip();
    assert.equal(typeof setupCleanupHandlers, "function");
  });

  it("should accept a registry parameter", function () {
    if (!setupCleanupHandlers || !ScopeRegistry) this.skip();
    
    const registry = new ScopeRegistry();
    
    assert.doesNotThrow(() => {
      const cleanup = setupCleanupHandlers(registry);
      // Remove handlers after test
      if (cleanup) cleanup();
    });
  });

  it("should return a function to remove handlers", function () {
    if (!setupCleanupHandlers || !ScopeRegistry) this.skip();
    
    const registry = new ScopeRegistry();
    const removeHandlers = setupCleanupHandlers(registry);
    
    assert.equal(typeof removeHandlers, "function", "should return cleanup function");
    removeHandlers();
  });
});

// =============================================================================
// INTEGRATION TESTS - TERMINATE SCOPE ACTION
// =============================================================================

describe("terminateScope Action", function () {
  this.timeout(30000);

  let terminateScopeAction;

  before(function () {
    try {
      terminateScopeAction = require("../src/tests/terminateScope");
    } catch (e) {
      // Module doesn't exist yet
    }
  });

  it("should export a function", function () {
    if (!terminateScopeAction) this.skip();
    assert.equal(typeof terminateScopeAction, "function");
  });

  it("should return FAIL when scope does not exist", async function () {
    if (!terminateScopeAction) this.skip();
    
    const { ScopeRegistry } = require("../src/scopes");
    const registry = new ScopeRegistry();
    
    const step = {
      terminateScope: {
        scope: "non-existent-scope",
      },
    };
    
    const config = { logLevel: "silent" };
    
    const result = await terminateScopeAction(config, step, { scopeRegistry: registry });
    
    assert.equal(result.status, "FAIL", "should fail for non-existent scope");
    assert.ok(result.description.includes("not found") || result.description.includes("does not exist"), 
      "should mention scope not found");
  });

  it("should return PASS when scope is terminated successfully", async function () {
    if (!terminateScopeAction) this.skip();
    
    const { ScopeRegistry, createTerminalScope } = require("../src/scopes");
    const registry = new ScopeRegistry();
    
    // Create a scope with a running process
    const terminalResult = await createTerminalScope({
      command: "sleep",
      args: ["60"],
      waitForExit: false,
    });
    
    registry.create("test-scope", terminalResult.process);
    
    const step = {
      terminateScope: {
        scope: "test-scope",
      },
    };
    
    const config = { logLevel: "silent" };
    
    const result = await terminateScopeAction(config, step, { scopeRegistry: registry });
    
    assert.equal(result.status, "PASS", "should pass for successful termination");
    assert.ok(!registry.has("test-scope"), "scope should be removed from registry");
  });
});

// =============================================================================
// TYPE KEYS OUTPUT SETTLE TESTS (Unit Tests)
// =============================================================================

describe("typeKeys output settle", function () {
  this.timeout(30000);

  let typeKeys, ScopeRegistry, createTerminalScope;

  before(function () {
    try {
      typeKeys = require("../src/tests/typeKeys").typeKeys;
      const scopes = require("../src/scopes");
      ScopeRegistry = scopes.ScopeRegistry;
      createTerminalScope = scopes.createTerminalScope;
    } catch (e) {
      // Module doesn't exist yet
    }
  });

  it("should wait for output to settle before completing", async function () {
    if (!typeKeys || !ScopeRegistry || !createTerminalScope) this.skip();
    if (process.platform === "win32") this.skip();

    const registry = new ScopeRegistry();

    // Start a Node REPL
    const terminalResult = await createTerminalScope({
      command: "node",
      args: [],
      waitForExit: false,
    });

    registry.create("test-repl", terminalResult.process);
    
    // Set up output capture
    if (terminalResult.stdout) {
      registry.appendStdout("test-repl", terminalResult.stdout);
    }
    terminalResult.process.onData((data) => {
      registry.appendStdout("test-repl", data);
    });

    // Wait for Node REPL to be ready
    await new Promise((resolve) => {
      const checkReady = () => {
        const scope = registry.get("test-repl");
        if (scope.stdout.includes("Welcome to Node.js")) {
          resolve();
        } else {
          setTimeout(checkReady, 50);
        }
      };
      checkReady();
    });

    const step = {
      type: {
        keys: ["console.log('settle-test-output')$ENTER$"],
        scope: "test-repl",
      },
    };

    const config = { logLevel: "silent" };

    // typeKeys should wait for output to settle before returning
    const result = await typeKeys({ config, step, scopeRegistry: registry });

    // After typeKeys returns, the output should already contain our expected text
    // because it waited for the PTY output to settle
    const scope = registry.get("test-repl");
    assert.ok(
      scope.stdout.includes("settle-test-output"),
      `stdout should contain 'settle-test-output' after typeKeys returns (output settled), got: ${scope.stdout.slice(-200)}`
    );
    assert.equal(result.status, "PASS", "typeKeys should pass");

    // Cleanup
    terminalResult.process.kill();
  });

  it("should capture multi-line output after settle", async function () {
    if (!typeKeys || !ScopeRegistry || !createTerminalScope) this.skip();
    if (process.platform === "win32") this.skip();

    const registry = new ScopeRegistry();

    // Start a Node REPL
    const terminalResult = await createTerminalScope({
      command: "node",
      args: [],
      waitForExit: false,
    });

    registry.create("test-multiline", terminalResult.process);
    
    if (terminalResult.stdout) {
      registry.appendStdout("test-multiline", terminalResult.stdout);
    }
    terminalResult.process.onData((data) => {
      registry.appendStdout("test-multiline", data);
    });

    // Wait for Node REPL to be ready
    await new Promise((resolve) => {
      const checkReady = () => {
        const scope = registry.get("test-multiline");
        if (scope.stdout.includes("Welcome to Node.js")) {
          resolve();
        } else {
          setTimeout(checkReady, 50);
        }
      };
      checkReady();
    });

    // Type a command that produces multi-line output
    const step = {
      type: {
        keys: ["[1,2,3].forEach(x => console.log('line-' + x))$ENTER$"],
        scope: "test-multiline",
      },
    };

    const config = { logLevel: "silent" };
    const result = await typeKeys({ config, step, scopeRegistry: registry });

    const scope = registry.get("test-multiline");
    
    // All output lines should be captured
    assert.ok(scope.stdout.includes("line-1"), `should contain line-1, got: ${scope.stdout.slice(-300)}`);
    assert.ok(scope.stdout.includes("line-2"), `should contain line-2`);
    assert.ok(scope.stdout.includes("line-3"), `should contain line-3`);
    assert.equal(result.status, "PASS");

    // Cleanup
    terminalResult.process.kill();
  });
});

// =============================================================================
// INTEGRATION TESTS - FULL WORKFLOW
// =============================================================================

describe("Scope Integration Tests", function () {
  this.timeout(60000); // 60 second timeout for integration tests

  const fs = require("fs");
  const { runTests } = require("../src");
  const artifactPath = path.resolve("./test/artifacts");
  
  // Helper to check if result is null (schema validation failed - schema not yet updated)
  function skipIfSchemaNotUpdated(result) {
    if (result === null) {
      this.skip("Schema doesn't support scope/waitUntil yet - update doc-detective-common");
    }
  }

  describe("runShell with scope", function () {
    it("should create a named scope for a background process", async function () {
      // With the new behavior, background processes require waitUntil to stay running
      // Without waitUntil, the command waits for exit and then cleans up the scope
      const scopeTest = {
        tests: [
          {
            steps: [
              {
                // Background process with waitUntil to keep it running
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'STARTED' && sleep 60"],
                  scope: "background-sleep",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "STARTED",
                    },
                  },
                },
              },
              {
                terminateScope: {
                  scope: "background-sleep",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-scope-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(scopeTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        assert.equal(result.summary.steps.pass, 2, "both steps should pass");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should wait for output pattern before continuing", async function () {
      const waitUntilTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'Starting...' && sleep 0.5 && echo 'READY'"],
                  scope: "server-process",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "READY",
                    },
                  },
                },
              },
              {
                runShell: "echo 'Server is ready!'",
              },
              {
                terminateScope: {
                  scope: "server-process",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-waituntil-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(waitUntilTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should fail step when waitUntil times out", async function () {
      const timeoutTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'never ready'"],
                  scope: "failing-process",
                  timeout: 500,
                  waitUntil: {
                    stdio: {
                      stdout: "WILL_NEVER_APPEAR",
                    },
                  },
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-timeout-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(timeoutTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 1, "step should fail on timeout");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should allow regex patterns in waitUntil", async function () {
      const regexTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "sleep 0.2 && echo 'Listening on port 8080' && sleep 10"],
                  scope: "regex-process",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "/port \\d+/",
                    },
                  },
                },
              },
              {
                terminateScope: {
                  scope: "regex-process",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-regex-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(regexTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe("typeKeys with scope", function () {
    it("should send keys to a named scope", async function () {
      // Skip this test on non-Unix systems
      if (process.platform === "win32") {
        this.skip();
      }

      // cat waits for input indefinitely, so we need waitUntil to let it run in background
      const typeTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'CAT_READY' && cat"],
                  scope: "cat-process",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "CAT_READY",
                    },
                  },
                },
              },
              {
                type: {
                  keys: ["hello world$ENTER$"],
                  scope: "cat-process",
                },
              },
              {
                terminateScope: {
                  scope: "cat-process",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-typekeys-scope-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(typeTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should fail when typing to non-existent scope", async function () {
      const typeFailTest = {
        tests: [
          {
            steps: [
              {
                type: {
                  keys: ["hello"],
                  scope: "non-existent-scope",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-typekeys-fail-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(typeFailTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 1, "step should fail for non-existent scope");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should translate special keys like $ENTER$", async function () {
      if (process.platform === "win32") {
        this.skip();
      }

      // cat waits for input indefinitely, so we need waitUntil to let it run in background
      const specialKeysTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'CAT_READY' && cat"],
                  scope: "special-keys-process",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "CAT_READY",
                    },
                  },
                },
              },
              {
                type: {
                  keys: ["line1$ENTER$line2$TAB$tabbed$ENTER$"],
                  scope: "special-keys-process",
                },
              },
              {
                terminateScope: {
                  scope: "special-keys-process",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-special-keys-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(specialKeysTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should automatically wait for output to settle (no waitUntil needed)", async function () {
      if (process.platform === "win32") {
        this.skip();
      }

      // This test validates that type action automatically waits for output to settle:
      // 1. Types to the process
      // 2. Waits for PTY output to stabilize BEFORE completing the step
      // 3. No separate wait step needed - it just works
      const settleTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "node",
                  scope: "type-settle",
                  timeout: 10000,
                  waitUntil: {
                    stdio: {
                      stdout: "Welcome to Node.js",
                    },
                  },
                },
              },
              {
                type: {
                  keys: ["console.log('settle-test-output')$ENTER$"],
                  scope: "type-settle",
                },
              },
              // NO wait step - the type action should auto-settle
              {
                terminateScope: {
                  scope: "type-settle",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-type-settle-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(settleTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        
        // Verify the output was captured (proves auto-settle worked)
        const terminateStep = result.specs[0].tests[0].contexts[0].steps[2];
        const stdout = terminateStep.outputs?.stdout || "";
        assert.ok(
          stdout.includes("settle-test-output"),
          `type auto-settle should have waited for output, got: ${stdout}`
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should interact with actual Node REPL", async function () {
      // Skip on Windows where node REPL behaves differently
      if (process.platform === "win32") {
        this.skip();
      }

      // This test uses the ACTUAL Node REPL (not a simulated one)
      // to validate that we can:
      // 1. Start the Node REPL
      // 2. Execute JavaScript expressions
      // 3. Capture the REPL's response
      const nodeReplTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "node",
                  scope: "node-repl",
                  timeout: 10000,
                  waitUntil: {
                    stdio: {
                      stdout: "Welcome to Node.js",
                    },
                  },
                },
              },
              {
                type: {
                  keys: ["2 + 2$ENTER$"],
                  scope: "node-repl",
                },
              },
              {
                wait: 500,
              },
              {
                type: {
                  keys: [".exit$ENTER$"],
                  scope: "node-repl",
                },
              },
              {
                wait: 500,
              },
              {
                terminateScope: {
                  scope: "node-repl",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-node-repl-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(nodeReplTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        
        // Verify the REPL evaluated our expression
        const terminateStep = result.specs[0].tests[0].contexts[0].steps[5];
        const stdout = terminateStep.outputs?.stdout || "";
        assert.ok(
          stdout.includes("4"),
          `Node REPL should output result of 2+2=4, got: ${stdout}`
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should execute console.log in Node REPL and capture output", async function () {
      // Skip on Windows
      if (process.platform === "win32") {
        this.skip();
      }

      // Test console.log output capture - this is the exact use case from dev.spec.json
      const consoleLogTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "node",
                  scope: "node-console",
                  timeout: 10000,
                  waitUntil: {
                    stdio: {
                      stdout: "Welcome to Node.js",
                    },
                  },
                },
              },
              {
                type: {
                  keys: ["console.log('hello from node')$ENTER$"],
                  scope: "node-console",
                },
              },
              {
                wait: 500,
              },
              {
                terminateScope: {
                  scope: "node-console",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-node-console-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(consoleLogTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        
        // Verify the console.log output was captured
        const terminateStep = result.specs[0].tests[0].contexts[0].steps[3];
        const stdout = terminateStep.outputs?.stdout || "";
        assert.ok(
          stdout.includes("hello from node"),
          `Node REPL should capture console.log output, got: ${stdout}`
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should handle multi-line JavaScript in Node REPL", async function () {
      // Skip on Windows
      if (process.platform === "win32") {
        this.skip();
      }

      // Test multi-line input and function definition in Node REPL
      const multiLineTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "node",
                  scope: "node-multiline",
                  timeout: 10000,
                  waitUntil: {
                    stdio: {
                      stdout: "Welcome to Node.js",
                    },
                  },
                },
              },
              {
                // Define a function
                type: {
                  keys: ["function greet(name) { return 'Hello, ' + name + '!'; }$ENTER$"],
                  scope: "node-multiline",
                },
              },
              {
                wait: 300,
              },
              {
                // Call the function
                type: {
                  keys: ["greet('World')$ENTER$"],
                  scope: "node-multiline",
                },
              },
              {
                wait: 500,
              },
              {
                terminateScope: {
                  scope: "node-multiline",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-node-multiline-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(multiLineTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        
        // Verify the function returned the expected value
        const terminateStep = result.specs[0].tests[0].contexts[0].steps[5];
        const stdout = terminateStep.outputs?.stdout || "";
        assert.ok(
          stdout.includes("Hello, World!"),
          `Node REPL should output function result, got: ${stdout}`
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe("Interactive terminal applications", function () {
    it("should capture typed input in process output (cat echo test)", async function () {
      if (process.platform === "win32") {
        this.skip();
      }

      // This test validates that:
      // 1. We can start an interactive process (cat)
      // 2. Type input to it
      // 3. The input appears in the captured output (cat echoes input)
      const interactiveTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'CAT_READY' && cat"],
                  scope: "interactive-cat",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "CAT_READY",
                    },
                  },
                },
              },
              {
                type: {
                  keys: ["hello interactive$ENTER$"],
                  scope: "interactive-cat",
                },
              },
              {
                wait: 500,
              },
              {
                terminateScope: {
                  scope: "interactive-cat",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-interactive-cat-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(interactiveTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        
        // Verify the typed input appears in the scope's captured output
        const terminateStep = result.specs[0].tests[0].contexts[0].steps[3];
        const stdout = terminateStep.outputs?.stdout || "";
        assert.ok(
          stdout.includes("hello interactive"),
          `typed input should appear in captured output, got: ${stdout}`
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should support REPL-style interaction with response validation", async function () {
      if (process.platform === "win32") {
        this.skip();
      }

      // This test validates a REPL-like interaction:
      // 1. Start a process that echoes back input with a prefix
      // 2. Type commands
      // 3. Verify the process responded to our input
      const replTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'REPL_READY' && while read line; do echo \"RESPONSE: $line\"; done"],
                  scope: "repl-test",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "REPL_READY",
                    },
                  },
                },
              },
              {
                type: {
                  keys: ["test-command-123$ENTER$"],
                  scope: "repl-test",
                },
              },
              {
                wait: 500,
              },
              {
                terminateScope: {
                  scope: "repl-test",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-repl-interaction-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(replTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        
        // Verify the REPL responded to our input
        const terminateStep = result.specs[0].tests[0].contexts[0].steps[3];
        const stdout = terminateStep.outputs?.stdout || "";
        assert.ok(
          stdout.includes("RESPONSE: test-command-123"),
          `REPL should echo back our input with RESPONSE prefix, got: ${stdout}`
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should handle multiple rounds of interaction", async function () {
      if (process.platform === "win32") {
        this.skip();
      }

      // Validates multi-turn interaction with an interactive process
      const multiTurnTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'CALC_READY' && while read line; do echo \"Got: $line\"; done"],
                  scope: "multi-turn",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "CALC_READY",
                    },
                  },
                },
              },
              {
                type: {
                  keys: ["first-input$ENTER$"],
                  scope: "multi-turn",
                },
              },
              {
                wait: 300,
              },
              {
                type: {
                  keys: ["second-input$ENTER$"],
                  scope: "multi-turn",
                },
              },
              {
                wait: 300,
              },
              {
                type: {
                  keys: ["third-input$ENTER$"],
                  scope: "multi-turn",
                },
              },
              {
                wait: 300,
              },
              {
                terminateScope: {
                  scope: "multi-turn",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-multi-turn-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(multiTurnTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        
        // Verify all three inputs were processed
        const terminateStep = result.specs[0].tests[0].contexts[0].steps[7];
        const stdout = terminateStep.outputs?.stdout || "";
        
        assert.ok(stdout.includes("Got: first-input"), `should have processed first input, got: ${stdout}`);
        assert.ok(stdout.includes("Got: second-input"), `should have processed second input, got: ${stdout}`);
        assert.ok(stdout.includes("Got: third-input"), `should have processed third input, got: ${stdout}`);
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe("Scope lifecycle", function () {
    it("should persist scope across multiple steps", async function () {
      const persistTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'STARTED' && sleep 10"],
                  scope: "persistent-scope",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "STARTED",
                    },
                  },
                },
              },
              {
                runShell: "echo 'Step 2'",
              },
              {
                runShell: "echo 'Step 3'",
              },
              {
                terminateScope: {
                  scope: "persistent-scope",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-persist-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(persistTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        assert.equal(result.summary.steps.pass, 4, "all 4 steps should pass");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should clean up all scopes after test context ends", async function () {
      // This test verifies cleanup happens even without explicit terminateScope
      // Background processes require waitUntil to stay running
      const cleanupTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'STARTED' && sleep 60"],
                  scope: "auto-cleanup-scope",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "STARTED",
                    },
                  },
                },
              },
              // No terminateScope - should auto-cleanup at end of test
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-cleanup-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(cleanupTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        // Test should complete (not hang) because cleanup happens
        assert.equal(result.summary.tests.pass + result.summary.tests.fail + result.summary.tests.skipped > 0, true);
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should allow reusing scope name after termination", async function () {
      // With the new behavior, short-lived commands complete and auto-cleanup
      // For this test, we use background processes that need termination
      const reuseTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'FIRST_READY' && sleep 60"],
                  scope: "reusable-scope",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "FIRST_READY",
                    },
                  },
                },
              },
              {
                terminateScope: {
                  scope: "reusable-scope",
                },
              },
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'SECOND_READY' && sleep 60"],
                  scope: "reusable-scope",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "SECOND_READY",
                    },
                  },
                },
              },
              {
                terminateScope: {
                  scope: "reusable-scope",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-reuse-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(reuseTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe("Edge cases", function () {
    it("should handle scope name with special characters", async function () {
      // With the new behavior, short-lived commands complete and auto-cleanup
      // No need to terminate since echo completes immediately
      const specialNameTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "echo",
                  args: ["test"],
                  scope: "my-scope_v2",
                  timeout: 5000,
                },
              },
              // No terminateScope needed - command completes and auto-cleans up
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-special-name-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(specialNameTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should fail gracefully when scope already exists", async function () {
      // First command runs as background process (with waitUntil)
      // Second command tries to use same scope name and should fail
      const duplicateTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'STARTED' && sleep 60"],
                  scope: "duplicate-scope",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "STARTED",
                    },
                  },
                },
              },
              {
                runShell: {
                  command: "echo",
                  args: ["second"],
                  scope: "duplicate-scope", // Same name - should fail
                  timeout: 5000,
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-duplicate-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(duplicateTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        // Second step should fail because scope already exists
        assert.equal(result.summary.steps.fail, 1, "one step should fail");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should handle process that exits immediately", async function () {
      // With the new behavior, commands without waitUntil wait for completion
      // and auto-cleanup. No terminateScope needed.
      const quickExitTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "echo",
                  args: ["done"],
                  scope: "quick-exit",
                  timeout: 5000,
                },
              },
              // No terminateScope - command completes and auto-cleans up
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-quick-exit-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(quickExitTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        // Verify the scoped command actually captured the output
        const step = result.specs[0].tests[0].contexts[0].steps[0];
        assert.ok(step.outputs.stdio.stdout.includes("done"), "stdout should contain 'done'");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it("should capture exit code from scoped process", async function () {
      // With the new behavior, commands without waitUntil wait for completion
      // and capture exit code. No terminateScope needed.
      const exitCodeTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "exit 0"],
                  scope: "exit-code-scope",
                  timeout: 5000,
                },
              },
              // No terminateScope - command completes and auto-cleans up
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-exit-code-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(exitCodeTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        // Verify exit code was captured
        const step = result.specs[0].tests[0].contexts[0].steps[0];
        assert.equal(step.outputs.exitCode, 0, "exit code should be captured");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  // =============================================================================
  // NEW BEHAVIOR: waitUntil determines if process runs in background or foreground
  // =============================================================================
  
  describe("Scope execution behavior", function () {
    // Test: Without waitUntil, scoped command waits for process to exit
    it("should wait for command to complete when waitUntil is NOT specified", async function () {
      // This test verifies that without waitUntil, the step waits for the process to exit
      // and captures the exit code before continuing to the next step
      const waitForExitTest = {
        tests: [
          {
            steps: [
              {
                // Short-lived command - should complete and return exit code
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'done' && exit 0"],
                  scope: "foreground-scope",
                  timeout: 5000,
                  // NO waitUntil - should wait for exit
                },
              },
              // This step should only run after the command exits
              {
                runShell: "echo 'after foreground command'",
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-wait-for-exit-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(waitForExitTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        assert.equal(result.summary.steps.pass, 2, "both steps should pass");
        
        // Verify the scoped command captured the exit code
        const scopedStep = result.specs[0].tests[0].contexts[0].steps[0];
        assert.equal(scopedStep.outputs.exitCode, 0, "exit code should be captured");
        assert.ok(scopedStep.outputs.stdio.stdout.includes("done"), "stdout should be captured");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    // Test: Without waitUntil, long-running command times out and fails
    it("should fail with timeout when command does not exit and waitUntil is NOT specified", async function () {
      const timeoutTest = {
        tests: [
          {
            steps: [
              {
                // Long-running command with short timeout - should timeout and fail
                runShell: {
                  command: "sleep",
                  args: ["60"],
                  scope: "timeout-scope",
                  timeout: 1000, // 1 second timeout
                  // NO waitUntil - should wait for exit, then timeout
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-timeout-no-waituntil-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(timeoutTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 1, "step should fail due to timeout");
        
        // Verify the error message indicates timeout
        const failedStep = result.specs[0].tests[0].contexts[0].steps[0];
        assert.equal(failedStep.result, "FAIL", "step should be marked as FAIL");
        assert.ok(
          failedStep.resultDescription.includes("timeout") || 
          failedStep.resultDescription.includes("did not complete"),
          "error should mention timeout or not completing"
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    // Test: Without waitUntil, non-zero exit code should fail the step
    it("should fail when command exits with non-zero code and waitUntil is NOT specified", async function () {
      const exitCodeFailTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "exit 1"],
                  scope: "exit-fail-scope",
                  timeout: 5000,
                  // NO waitUntil - should wait for exit and check exit code
                  // Default exitCodes is [0], so exit 1 should fail
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-exit-code-fail-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(exitCodeFailTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 1, "step should fail due to non-zero exit code");
        
        const failedStep = result.specs[0].tests[0].contexts[0].steps[0];
        assert.equal(failedStep.result, "FAIL", "step should be marked as FAIL");
        assert.ok(
          failedStep.resultDescription.includes("exit code"),
          "error should mention exit code"
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    // Test: With waitUntil, process continues running in background
    it("should allow process to continue running when waitUntil IS specified", async function () {
      const backgroundTest = {
        tests: [
          {
            steps: [
              {
                // Long-running command WITH waitUntil - should continue in background
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'READY' && sleep 60"],
                  scope: "background-scope",
                  timeout: 5000,
                  waitUntil: {
                    stdio: {
                      stdout: "READY",
                    },
                  },
                },
              },
              // This step runs while the background process is still running
              {
                runShell: "echo 'running while background process active'",
              },
              {
                terminateScope: {
                  scope: "background-scope",
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-background-process-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(backgroundTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 0, "no steps should fail");
        assert.equal(result.summary.steps.pass, 3, "all 3 steps should pass");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    // Test: With waitUntil, timeout terminates the process
    it("should terminate process when waitUntil times out", async function () {
      const waitUntilTimeoutTest = {
        tests: [
          {
            steps: [
              {
                // Process that never outputs the expected pattern
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'WRONG_OUTPUT' && sleep 60"],
                  scope: "waituntil-timeout-scope",
                  timeout: 1000, // 1 second timeout
                  waitUntil: {
                    stdio: {
                      stdout: "NEVER_APPEARS",
                    },
                  },
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-waituntil-timeout-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(waitUntilTimeoutTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        assert.equal(result.summary.steps.fail, 1, "step should fail due to waitUntil timeout");
        
        const failedStep = result.specs[0].tests[0].contexts[0].steps[0];
        assert.equal(failedStep.result, "FAIL", "step should be marked as FAIL");
        assert.ok(
          failedStep.resultDescription.toLowerCase().includes("timeout"),
          "error should mention timeout"
        );
      }       finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    // Test: With waitUntil, if process exits before condition is met, fail immediately
    it("should fail immediately when process exits before waitUntil condition is met", async function () {
      const earlyExitTest = {
        tests: [
          {
            steps: [
              {
                // Process exits before outputting expected pattern
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'WRONG_OUTPUT' && exit 0"],
                  scope: "early-exit-scope",
                  timeout: 10000, // Long timeout - but should fail fast
                  waitUntil: {
                    stdio: {
                      stdout: "NEVER_APPEARS",
                    },
                  },
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-early-exit-waituntil-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(earlyExitTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      const startTime = Date.now();
      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        const elapsed = Date.now() - startTime;
        
        // Should fail fast, not wait for the full 10 second timeout
        assert.ok(elapsed < 5000, `should fail fast (elapsed: ${elapsed}ms), not wait for timeout`);
        
        assert.equal(result.summary.steps.fail, 1, "step should fail");
        
        const failedStep = result.specs[0].tests[0].contexts[0].steps[0];
        assert.equal(failedStep.result, "FAIL", "step should be marked as FAIL");
        assert.ok(
          failedStep.resultDescription.toLowerCase().includes("exit") ||
          failedStep.resultDescription.toLowerCase().includes("condition"),
          "error should mention exit or condition not met"
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    // Test: With waitUntil, if process exits with non-zero code, report the exit code
    it("should report exit code when process exits with error before waitUntil condition is met", async function () {
      const errorExitTest = {
        tests: [
          {
            steps: [
              {
                runShell: {
                  command: "sh",
                  args: ["-c", "echo 'Starting...' && exit 1"],
                  scope: "error-exit-scope",
                  timeout: 10000,
                  waitUntil: {
                    stdio: {
                      stdout: "READY",
                    },
                  },
                },
              },
            ],
          },
        ],
      };

      const tempFilePath = path.resolve("./test/temp-error-exit-waituntil-test.json");
      fs.writeFileSync(tempFilePath, JSON.stringify(errorExitTest, null, 2));
      const config = { input: tempFilePath, logLevel: "silent" };

      const startTime = Date.now();
      let result;
      try {
        result = await runTests(config);
        skipIfSchemaNotUpdated.call(this, result);
        const elapsed = Date.now() - startTime;
        
        // Should fail fast
        assert.ok(elapsed < 5000, `should fail fast (elapsed: ${elapsed}ms)`);
        
        assert.equal(result.summary.steps.fail, 1, "step should fail");
        
        const failedStep = result.specs[0].tests[0].contexts[0].steps[0];
        assert.equal(failedStep.result, "FAIL", "step should be marked as FAIL");
        assert.ok(
          failedStep.resultDescription.includes("exit code") ||
          failedStep.resultDescription.includes("exited"),
          "error should mention exit code"
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });
});
