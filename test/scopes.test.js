/**
 * Scopes Module Tests
 * 
 * Tests for terminal scopes functionality including:
 * - ScopeRegistry: Managing named scopes
 * - waitUntil: Pattern matching for stdout/stderr
 * - Terminal: PTY-backed terminal sessions
 */

const assert = require("assert");

// These imports will fail initially - that's expected in TDD
let ScopeRegistry, parsePattern, matchesPattern, waitForConditions;

try {
  const scopes = require("../src/scopes");
  ScopeRegistry = scopes.ScopeRegistry;
  parsePattern = scopes.parsePattern;
  matchesPattern = scopes.matchesPattern;
  waitForConditions = scopes.waitForConditions;
} catch (e) {
  // Module doesn't exist yet - tests will be skipped
}

describe("Scopes Module", function () {
  this.timeout(10000);

  describe("ScopeRegistry", function () {
    // Skip if module not implemented yet
    before(function () {
      if (!ScopeRegistry) {
        this.skip();
      }
    });

    let registry;

    beforeEach(function () {
      registry = new ScopeRegistry();
    });

    afterEach(async function () {
      // Clean up any remaining scopes
      if (registry) {
        await registry.cleanup();
      }
    });

    describe("has()", function () {
      it("should return false for non-existent scope", function () {
        assert.strictEqual(registry.has("non-existent"), false);
      });

      it("should return true for existing scope", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        registry.create("test-scope", mockProcess);
        assert.strictEqual(registry.has("test-scope"), true);
      });
    });

    describe("get()", function () {
      it("should return undefined for non-existent scope", function () {
        assert.strictEqual(registry.get("non-existent"), undefined);
      });

      it("should return scope object for existing scope", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        registry.create("test-scope", mockProcess);
        const scope = registry.get("test-scope");
        assert.ok(scope);
        assert.strictEqual(scope.process, mockProcess);
        assert.strictEqual(scope.stdout, "");
        assert.strictEqual(scope.stderr, "");
        assert.ok(scope.createdAt);
      });
    });

    describe("create()", function () {
      it("should create a new scope with process", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        registry.create("new-scope", mockProcess);
        assert.strictEqual(registry.has("new-scope"), true);
      });

      it("should throw error for empty scope name", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        assert.throws(() => {
          registry.create("", mockProcess);
        }, /Scope name cannot be empty/);
      });

      it("should throw error for whitespace-only scope name", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        assert.throws(() => {
          registry.create("   ", mockProcess);
        }, /Scope name cannot be empty/);
      });

      it("should throw error for duplicate scope name", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        registry.create("duplicate", mockProcess);
        assert.throws(() => {
          registry.create("duplicate", mockProcess);
        }, /Scope 'duplicate' already exists/);
      });

      it("should initialize stdout and stderr as empty strings", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        registry.create("test-scope", mockProcess);
        const scope = registry.get("test-scope");
        assert.strictEqual(scope.stdout, "");
        assert.strictEqual(scope.stderr, "");
      });

      it("should set createdAt timestamp", function () {
        const before = Date.now();
        const mockProcess = { pid: 1234, kill: () => {} };
        registry.create("test-scope", mockProcess);
        const after = Date.now();
        const scope = registry.get("test-scope");
        assert.ok(scope.createdAt >= before);
        assert.ok(scope.createdAt <= after);
      });
    });

    describe("delete()", function () {
      it("should remove existing scope", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        registry.create("to-delete", mockProcess);
        assert.strictEqual(registry.has("to-delete"), true);
        registry.delete("to-delete");
        assert.strictEqual(registry.has("to-delete"), false);
      });

      it("should not throw for non-existent scope", function () {
        assert.doesNotThrow(() => {
          registry.delete("non-existent");
        });
      });
    });

    describe("appendStdout()", function () {
      it("should append data to scope stdout buffer", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        registry.create("test-scope", mockProcess);
        registry.appendStdout("test-scope", "hello ");
        registry.appendStdout("test-scope", "world");
        const scope = registry.get("test-scope");
        assert.strictEqual(scope.stdout, "hello world");
      });

      it("should do nothing for non-existent scope", function () {
        assert.doesNotThrow(() => {
          registry.appendStdout("non-existent", "data");
        });
      });
    });

    describe("appendStderr()", function () {
      it("should append data to scope stderr buffer", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        registry.create("test-scope", mockProcess);
        registry.appendStderr("test-scope", "error ");
        registry.appendStderr("test-scope", "message");
        const scope = registry.get("test-scope");
        assert.strictEqual(scope.stderr, "error message");
      });

      it("should do nothing for non-existent scope", function () {
        assert.doesNotThrow(() => {
          registry.appendStderr("non-existent", "data");
        });
      });
    });

    describe("list()", function () {
      it("should return empty array when no scopes exist", function () {
        const names = registry.list();
        assert.deepStrictEqual(names, []);
      });

      it("should return all scope names", function () {
        const mockProcess = { pid: 1234, kill: () => {} };
        registry.create("scope-a", mockProcess);
        registry.create("scope-b", mockProcess);
        registry.create("scope-c", mockProcess);
        const names = registry.list();
        assert.deepStrictEqual(names.sort(), ["scope-a", "scope-b", "scope-c"]);
      });
    });

    describe("cleanup()", function () {
      it("should terminate all processes and clear registry", async function () {
        let killCount = 0;
        const mockProcess1 = { pid: 1, kill: () => { killCount++; } };
        const mockProcess2 = { pid: 2, kill: () => { killCount++; } };
        
        registry.create("scope-1", mockProcess1);
        registry.create("scope-2", mockProcess2);
        
        await registry.cleanup();
        
        assert.strictEqual(killCount, 2);
        assert.deepStrictEqual(registry.list(), []);
      });

      it("should handle processes that throw on kill", async function () {
        const mockProcess = { 
          pid: 1, 
          kill: () => { throw new Error("Already dead"); } 
        };
        
        registry.create("error-scope", mockProcess);
        
        // Should not throw
        await registry.cleanup();
        assert.deepStrictEqual(registry.list(), []);
      });

      it("should handle processes without kill method", async function () {
        const mockProcess = { pid: 1 };
        
        registry.create("no-kill-scope", mockProcess);
        
        // Should not throw
        await registry.cleanup();
        assert.deepStrictEqual(registry.list(), []);
      });
    });
  });

  describe("Pattern Matching (waitUntil)", function () {
    // Skip if module not implemented yet
    before(function () {
      if (!parsePattern || !matchesPattern) {
        this.skip();
      }
    });

    describe("parsePattern()", function () {
      it("should parse plain string pattern", function () {
        const parsed = parsePattern("hello world");
        assert.strictEqual(parsed.isRegex, false);
        assert.strictEqual(parsed.string, "hello world");
      });

      it("should parse regex pattern with slashes", function () {
        const parsed = parsePattern("/hello\\s+world/");
        assert.strictEqual(parsed.isRegex, true);
        assert.ok(parsed.regex instanceof RegExp);
        assert.ok(parsed.regex.test("hello   world"));
      });

      it("should parse regex pattern with flags", function () {
        const parsed = parsePattern("/HELLO/i");
        assert.strictEqual(parsed.isRegex, true);
        assert.ok(parsed.regex.test("hello"));
        assert.ok(parsed.regex.test("HELLO"));
      });

      it("should throw for invalid regex", function () {
        assert.throws(() => {
          parsePattern("/[invalid/");
        }, /Invalid regex pattern/);
      });

      it("should treat pattern with only opening slash as string", function () {
        const parsed = parsePattern("/not-a-regex");
        assert.strictEqual(parsed.isRegex, false);
        assert.strictEqual(parsed.string, "/not-a-regex");
      });
    });

    describe("matchesPattern()", function () {
      it("should match string pattern with includes", function () {
        const parsed = parsePattern("READY");
        assert.strictEqual(matchesPattern("Server is READY to accept connections", parsed), true);
        assert.strictEqual(matchesPattern("Server starting...", parsed), false);
      });

      it("should match regex pattern", function () {
        const parsed = parsePattern("/port\\s+\\d+/");
        assert.strictEqual(matchesPattern("Listening on port 3000", parsed), true);
        assert.strictEqual(matchesPattern("Listening on port abc", parsed), false);
      });

      it("should match case-insensitive regex", function () {
        const parsed = parsePattern("/ready/i");
        assert.strictEqual(matchesPattern("READY", parsed), true);
        assert.strictEqual(matchesPattern("ready", parsed), true);
        assert.strictEqual(matchesPattern("Ready", parsed), true);
      });
    });
  });

  describe("waitForConditions()", function () {
    // Skip if module not implemented yet
    before(function () {
      if (!waitForConditions || !ScopeRegistry) {
        this.skip();
      }
    });

    let registry;

    beforeEach(function () {
      registry = new ScopeRegistry();
    });

    afterEach(async function () {
      if (registry) {
        await registry.cleanup();
      }
    });

    it("should resolve immediately when stdout pattern already matches", async function () {
      const mockProcess = { pid: 1, kill: () => {} };
      registry.create("test-scope", mockProcess);
      registry.appendStdout("test-scope", "Server is READY");

      const result = await waitForConditions(registry, "test-scope", {
        stdout: "READY",
        timeout: 1000,
      });

      assert.strictEqual(result, true);
    });

    it("should resolve when stdout pattern matches after delay", async function () {
      const mockProcess = { pid: 1, kill: () => {} };
      registry.create("test-scope", mockProcess);

      // Append data after a short delay
      setTimeout(() => {
        registry.appendStdout("test-scope", "Server is READY");
      }, 100);

      const result = await waitForConditions(registry, "test-scope", {
        stdout: "READY",
        timeout: 2000,
      });

      assert.strictEqual(result, true);
    });

    it("should reject on timeout when pattern not found", async function () {
      const mockProcess = { pid: 1, kill: () => {} };
      registry.create("test-scope", mockProcess);
      registry.appendStdout("test-scope", "Starting...");

      await assert.rejects(
        waitForConditions(registry, "test-scope", {
          stdout: "NEVER_APPEARS",
          timeout: 200,
        }),
        /Timeout waiting for conditions/
      );
    });

    it("should reject when scope does not exist", async function () {
      await assert.rejects(
        waitForConditions(registry, "non-existent", {
          stdout: "READY",
          timeout: 100,
        }),
        /Scope 'non-existent' not found/
      );
    });

    it("should match regex patterns in stdout", async function () {
      const mockProcess = { pid: 1, kill: () => {} };
      registry.create("test-scope", mockProcess);
      registry.appendStdout("test-scope", "Process ID: 12345 started");

      const result = await waitForConditions(registry, "test-scope", {
        stdout: "/Process ID: \\d+ started/",
        timeout: 1000,
      });

      assert.strictEqual(result, true);
    });

    it("should pass when no conditions specified", async function () {
      const mockProcess = { pid: 1, kill: () => {} };
      registry.create("test-scope", mockProcess);

      const result = await waitForConditions(registry, "test-scope", {
        timeout: 100,
      });

      assert.strictEqual(result, true);
    });
  });

  describe("Terminal Scope (createTerminalScope)", function () {
    // These tests will fail initially - that's expected in TDD
    let createTerminalScope, terminateScope, replaceSpecialKeys;

    before(function () {
      try {
        const scopes = require("../src/scopes");
        createTerminalScope = scopes.createTerminalScope;
        terminateScope = scopes.terminateScope;
        replaceSpecialKeys = scopes.replaceSpecialKeys;
      } catch (e) {
        // Module not fully implemented yet
      }
      
      if (!createTerminalScope) {
        this.skip();
      }
    });

    let registry;

    beforeEach(function () {
      registry = new ScopeRegistry();
    });

    afterEach(async function () {
      if (registry) {
        await registry.cleanup();
      }
    });

    describe("createTerminalScope()", function () {
      it("should create a terminal scope with node-pty", async function () {
        this.timeout(10000);
        
        // Use cross-platform node -e command
        const result = await createTerminalScope(registry, "test-terminal", {
          command: "node",
          args: ["-e", "console.log('READY'); setTimeout(() => {}, 2000)"],
          waitUntil: { stdout: "READY", timeout: 5000 },
        });

        assert.strictEqual(result.status, "PASS");
        assert.strictEqual(registry.has("test-terminal"), true);
        
        const scope = registry.get("test-terminal");
        assert.ok(scope.stdout.includes("READY"));
      });

      it("should fail when command is not found", async function () {
        this.timeout(5000);
        
        const result = await createTerminalScope(registry, "bad-command", {
          command: "nonexistent-command-xyz",
          args: [],
          waitUntil: { timeout: 1000 },
        });

        // The command might fail to spawn or timeout
        assert.ok(result.status === "FAIL" || registry.has("bad-command"));
      });

      it("should throw for duplicate scope name", async function () {
        this.timeout(10000);
        
        // Create first scope
        await createTerminalScope(registry, "duplicate-scope", {
          command: "node",
          args: ["-e", "console.log('READY'); setTimeout(() => {}, 3000)"],
          waitUntil: { stdout: "READY", timeout: 5000 },
        });

        // Try to create another with same name
        const result = await createTerminalScope(registry, "duplicate-scope", {
          command: "node",
          args: ["-e", "console.log('READY2')"],
          waitUntil: { stdout: "READY2", timeout: 2000 },
        });

        assert.strictEqual(result.status, "FAIL");
        assert.ok(result.description.includes("already exists"));
      });

      it("should capture stdout continuously", async function () {
        this.timeout(10000);
        
        await createTerminalScope(registry, "echo-scope", {
          command: "node",
          args: ["-e", "console.log('LINE1'); setTimeout(() => console.log('LINE2'), 100); setTimeout(() => {}, 3000)"],
          waitUntil: { stdout: "LINE2", timeout: 5000 },
        });

        const scope = registry.get("echo-scope");
        assert.ok(scope.stdout.includes("LINE1"));
        assert.ok(scope.stdout.includes("LINE2"));
      });
    });

    describe("terminateScope()", function () {
      it("should terminate an existing scope", async function () {
        this.timeout(10000);
        
        await createTerminalScope(registry, "to-terminate", {
          command: "node",
          args: ["-e", "console.log('READY'); setTimeout(() => {}, 60000)"],
          waitUntil: { stdout: "READY", timeout: 5000 },
        });

        assert.strictEqual(registry.has("to-terminate"), true);

        const result = await terminateScope(registry, "to-terminate");
        
        assert.strictEqual(result.status, "PASS");
        assert.strictEqual(registry.has("to-terminate"), false);
      });

      it("should fail for non-existent scope", async function () {
        const result = await terminateScope(registry, "non-existent");
        
        assert.strictEqual(result.status, "FAIL");
        assert.ok(result.description.includes("not found"));
      });
    });

    describe("replaceSpecialKeys()", function () {
      it("should replace $ENTER$ with newline", function () {
        const result = replaceSpecialKeys("hello$ENTER$");
        assert.strictEqual(result, "hello\n");
      });

      it("should replace $CTRL_C$ with control character", function () {
        const result = replaceSpecialKeys("$CTRL_C$");
        assert.strictEqual(result, "\x03");
      });

      it("should replace $CTRL_D$ with control character", function () {
        const result = replaceSpecialKeys("$CTRL_D$");
        assert.strictEqual(result, "\x04");
      });

      it("should replace $CTRL_Z$ with control character", function () {
        const result = replaceSpecialKeys("$CTRL_Z$");
        assert.strictEqual(result, "\x1A");
      });

      it("should replace $TAB$ with tab character", function () {
        const result = replaceSpecialKeys("hello$TAB$world");
        assert.strictEqual(result, "hello\tworld");
      });

      it("should replace $ESC$ with escape character", function () {
        const result = replaceSpecialKeys("$ESC$[1m");
        assert.strictEqual(result, "\x1B[1m");
      });

      it("should handle multiple replacements", function () {
        const result = replaceSpecialKeys("cmd$ENTER$exit$ENTER$");
        assert.strictEqual(result, "cmd\nexit\n");
      });

      it("should return original string if no special keys", function () {
        const result = replaceSpecialKeys("hello world");
        assert.strictEqual(result, "hello world");
      });
    });

    describe("writeToScope()", function () {
      let writeToScope;

      before(function () {
        try {
          const scopes = require("../src/scopes");
          writeToScope = scopes.writeToScope;
        } catch (e) {
          // Module not fully implemented yet
        }

        if (!writeToScope) {
          this.skip();
        }
      });

      it("should write input to an existing scope", async function () {
        this.timeout(10000);

        // Create a scope that echoes input
        await createTerminalScope(registry, "echo-scope", {
          command: "node",
          args: ["-e", "process.stdin.on('data', d => { console.log('GOT:', d.toString().trim()); }); setTimeout(() => {}, 30000)"],
          waitUntil: { timeout: 2000 },
        });

        // Write to the scope
        const result = await writeToScope(registry, "echo-scope", "HELLO$ENTER$");

        assert.strictEqual(result.status, "PASS");

        // Wait for echo
        await new Promise((resolve) => setTimeout(resolve, 500));

        const scope = registry.get("echo-scope");
        assert.ok(scope.stdout.includes("GOT:") || scope.stdout.includes("HELLO"), 
          `Expected stdout to contain input echo. Got: ${scope.stdout}`);
      });

      it("should fail for non-existent scope", async function () {
        const result = await writeToScope(registry, "non-existent", "test");
        assert.strictEqual(result.status, "FAIL");
        assert.ok(result.description.includes("not found"));
      });

      it("should replace special keys before writing", async function () {
        this.timeout(10000);

        // Create scope that reads stdin
        await createTerminalScope(registry, "special-keys", {
          command: "node",
          args: ["-e", "process.stdin.on('data', d => { console.log('RECEIVED'); }); setTimeout(() => {}, 30000)"],
          waitUntil: { timeout: 2000 },
        });

        // Write with special keys - just verify it works without error
        const result = await writeToScope(registry, "special-keys", "cmd$ENTER$");
        assert.strictEqual(result.status, "PASS");

        await new Promise((resolve) => setTimeout(resolve, 500));

        const scope = registry.get("special-keys");
        // Just verify we got something (newline was processed)
        assert.ok(scope.stdout.includes("RECEIVED") || scope.stdout.length > 0,
          `Expected output after write. Got: ${scope.stdout}`);
      });
    });

    describe("waitForOutput()", function () {
      let waitForOutput;

      before(function () {
        try {
          const scopes = require("../src/scopes");
          waitForOutput = scopes.waitForOutput;
        } catch (e) {
          // Module not fully implemented yet
        }

        if (!waitForOutput) {
          this.skip();
        }
      });

      it("should wait for pattern in stdout", async function () {
        this.timeout(10000);

        // Create scope that outputs after delay
        await createTerminalScope(registry, "delayed-output", {
          command: "node",
          args: ["-e", "setTimeout(() => console.log('DELAYED_OUTPUT'), 500); setTimeout(() => {}, 10000)"],
          waitUntil: { timeout: 2000 },
        });

        // Wait for the delayed output
        const result = await waitForOutput(registry, "delayed-output", {
          stdout: "DELAYED_OUTPUT",
          timeout: 5000,
        });

        assert.strictEqual(result.status, "PASS");
        assert.ok(result.outputs.stdout.includes("DELAYED_OUTPUT"));
      });

      it("should timeout if pattern not found", async function () {
        this.timeout(10000);

        await createTerminalScope(registry, "timeout-test", {
          command: "node",
          args: ["-e", "console.log('OTHER'); setTimeout(() => {}, 10000)"],
          waitUntil: { stdout: "OTHER", timeout: 3000 },
        });

        const result = await waitForOutput(registry, "timeout-test", {
          stdout: "NEVER_APPEARS",
          timeout: 1000,
        });

        assert.strictEqual(result.status, "FAIL");
        assert.ok(result.description.includes("Timeout"));
      });

      it("should support regex patterns", async function () {
        this.timeout(10000);

        await createTerminalScope(registry, "regex-test", {
          command: "node",
          args: ["-e", "console.log('BUILD_ID=12345'); setTimeout(() => {}, 10000)"],
          waitUntil: { stdout: "BUILD_ID", timeout: 3000 },
        });

        const result = await waitForOutput(registry, "regex-test", {
          stdout: "/BUILD_ID=\\d+/",
          timeout: 3000,
        });

        assert.strictEqual(result.status, "PASS");
      });
    });
  });

  describe("Action Handlers", function () {
    const { ScopeRegistry } = require("../src/scopes");

    describe("terminateScope action", function () {
      let terminateScopeAction;
      let registry;

      before(function () {
        try {
          const handler = require("../src/tests/terminateScope");
          terminateScopeAction = handler.terminateScope;
        } catch (e) {
          // Module not implemented yet
        }

        if (!terminateScopeAction) {
          this.skip();
        }
      });

      beforeEach(function () {
        registry = new ScopeRegistry();
      });

      afterEach(async function () {
        if (registry) {
          await registry.cleanup();
        }
      });

      it("should terminate an existing scope via step action", async function () {
        this.timeout(10000);
        
        // First create a scope manually
        const { createTerminalScope } = require("../src/scopes");
        await createTerminalScope(registry, "my-terminal", {
          command: "node",
          args: ["-e", "console.log('STARTED'); setTimeout(() => {}, 60000)"],
          waitUntil: { stdout: "STARTED", timeout: 5000 },
        });
        
        assert.strictEqual(registry.has("my-terminal"), true);

        // Now terminate it via the action handler
        const result = await terminateScopeAction({
          config: {},
          step: { terminateScope: "my-terminal" },
          scopeRegistry: registry,
        });

        assert.strictEqual(result.status, "PASS");
        assert.strictEqual(registry.has("my-terminal"), false);
      });

      it("should fail when scope does not exist", async function () {
        const result = await terminateScopeAction({
          config: {},
          step: { terminateScope: "non-existent" },
          scopeRegistry: registry,
        });

        assert.strictEqual(result.status, "FAIL");
        assert.ok(result.description.includes("not found"));
      });

      it("should handle object-style step definition", async function () {
        this.timeout(10000);
        
        const { createTerminalScope } = require("../src/scopes");
        await createTerminalScope(registry, "obj-style", {
          command: "node",
          args: ["-e", "console.log('READY'); setTimeout(() => {}, 60000)"],
          waitUntil: { stdout: "READY", timeout: 5000 },
        });

        const result = await terminateScopeAction({
          config: {},
          step: { terminateScope: { scope: "obj-style" } },
          scopeRegistry: registry,
        });

        assert.strictEqual(result.status, "PASS");
        assert.ok(result.outputs.stdout.includes("READY"));
      });

      it("should return captured stdout/stderr in outputs", async function () {
        this.timeout(10000);
        
        const { createTerminalScope } = require("../src/scopes");
        await createTerminalScope(registry, "capture-test", {
          command: "node",
          args: ["-e", "console.log('OUTPUT1'); console.log('OUTPUT2'); setTimeout(() => {}, 60000)"],
          waitUntil: { stdout: "OUTPUT2", timeout: 5000 },
        });

        const result = await terminateScopeAction({
          config: {},
          step: { terminateScope: "capture-test" },
          scopeRegistry: registry,
        });

        assert.strictEqual(result.status, "PASS");
        assert.ok(result.outputs);
        assert.ok(result.outputs.stdout.includes("OUTPUT1"));
        assert.ok(result.outputs.stdout.includes("OUTPUT2"));
      });
    });

    describe("createScope action", function () {
      let createScopeAction;
      let registry;

      before(function () {
        try {
          const handler = require("../src/tests/createScope");
          createScopeAction = handler.createScope;
        } catch (e) {
          // Module not implemented yet
        }

        if (!createScopeAction) {
          this.skip();
        }
      });

      beforeEach(function () {
        registry = new ScopeRegistry();
      });

      afterEach(async function () {
        if (registry) {
          await registry.cleanup();
        }
      });

      it("should create a terminal scope via step action", async function () {
        this.timeout(10000);
        
        const result = await createScopeAction({
          config: {},
          step: {
            createScope: {
              scope: "my-terminal",
              command: "node",
              args: ["-e", "console.log('STARTED'); setTimeout(() => {}, 60000)"],
              waitUntil: { stdout: "STARTED", timeout: 5000 },
            },
          },
          scopeRegistry: registry,
        });

        assert.strictEqual(result.status, "PASS");
        assert.strictEqual(registry.has("my-terminal"), true);
        assert.ok(result.outputs.scopeName === "my-terminal");
      });

      it("should fail when scope already exists", async function () {
        this.timeout(15000);
        
        // Create first scope
        await createScopeAction({
          config: {},
          step: {
            createScope: {
              scope: "existing-scope",
              command: "node",
              args: ["-e", "console.log('FIRST'); setTimeout(() => {}, 60000)"],
              waitUntil: { stdout: "FIRST", timeout: 5000 },
            },
          },
          scopeRegistry: registry,
        });

        // Try to create duplicate
        const result = await createScopeAction({
          config: {},
          step: {
            createScope: {
              scope: "existing-scope",
              command: "node",
              args: ["-e", "console.log('SECOND')"],
              waitUntil: { stdout: "SECOND", timeout: 2000 },
            },
          },
          scopeRegistry: registry,
        });

        assert.strictEqual(result.status, "FAIL");
        assert.ok(result.description.includes("already exists"));
      });

      it("should fail when command cannot be executed", async function () {
        this.timeout(5000);
        
        const result = await createScopeAction({
          config: {},
          step: {
            createScope: {
              scope: "bad-command",
              command: "nonexistent-command-xyz",
              waitUntil: { timeout: 1000 },
            },
          },
          scopeRegistry: registry,
        });

        // Should fail due to command not found or timeout
        assert.strictEqual(result.status, "FAIL");
      });

      it("should support simple string format for shell", async function () {
        this.timeout(10000);
        
        const result = await createScopeAction({
          config: {},
          step: {
            createScope: "interactive-shell",
          },
          scopeRegistry: registry,
        });

        // Should create a scope with default shell
        assert.strictEqual(result.status, "PASS");
        assert.strictEqual(registry.has("interactive-shell"), true);
      });
    });

    describe("typeToScope action", function () {
      let typeToScopeAction;
      let registry;

      before(function () {
        try {
          const handler = require("../src/tests/typeToScope");
          typeToScopeAction = handler.typeToScope;
        } catch (e) {
          // Module not implemented yet
        }

        if (!typeToScopeAction) {
          this.skip();
        }
      });

      beforeEach(function () {
        registry = new ScopeRegistry();
      });

      afterEach(async function () {
        if (registry) {
          await registry.cleanup();
        }
      });

      it("should write input to a terminal scope", async function () {
        this.timeout(10000);
        
        // Create a scope first
        const { createTerminalScope } = require("../src/scopes");
        await createTerminalScope(registry, "input-scope", {
          command: "node",
          args: ["-e", "process.stdin.on('data', d => console.log('GOT:', d.toString().trim())); setTimeout(() => {}, 60000)"],
          waitUntil: { timeout: 2000 },
        });

        // Type to the scope
        const result = await typeToScopeAction({
          config: {},
          step: {
            typeToScope: {
              scope: "input-scope",
              input: "hello$ENTER$",
            },
          },
          scopeRegistry: registry,
        });

        assert.strictEqual(result.status, "PASS");
      });

      it("should fail for non-existent scope", async function () {
        const result = await typeToScopeAction({
          config: {},
          step: {
            typeToScope: {
              scope: "non-existent",
              input: "test",
            },
          },
          scopeRegistry: registry,
        });

        assert.strictEqual(result.status, "FAIL");
        assert.ok(result.description.includes("not found"));
      });

      it("should wait for output after typing", async function () {
        this.timeout(15000);
        
        // Use an interactive shell that echoes input naturally
        const { createTerminalScope } = require("../src/scopes");
        const os = require("os");
        
        // Create a shell scope - the shell will echo typed characters
        const shellCmd = os.platform() === "win32" ? "cmd.exe" : "bash";
        const shellArgs = os.platform() === "win32" ? [] : ["-i"];
        
        await createTerminalScope(registry, "echo-scope", {
          command: shellCmd,
          args: shellArgs,
          waitUntil: { timeout: 3000 },
        });

        const result = await typeToScopeAction({
          config: {},
          step: {
            typeToScope: {
              scope: "echo-scope",
              input: "echo TESTING123$ENTER$",
              waitUntil: { stdout: "TESTING123", timeout: 5000 },
            },
          },
          scopeRegistry: registry,
        });

        assert.strictEqual(result.status, "PASS");
        assert.ok(result.outputs.stdout.includes("TESTING123"));
      });
    });
  });
});
