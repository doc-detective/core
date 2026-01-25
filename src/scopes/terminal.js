/**
 * Terminal Module - PTY-backed terminal sessions
 *
 * Provides functionality to create and manage persistent terminal sessions
 * using node-pty. Terminals are registered as scopes and can be interacted
 * with across multiple test steps.
 *
 * Cross-platform support:
 * - Windows: Uses ConPTY via node-pty
 * - macOS/Linux: Uses native PTY
 */

const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const { waitForConditions } = require("./waitUntil");

/**
 * Resolve a command to its full path on Windows
 * Windows ConPTY requires full paths for executables
 *
 * @param {string} command - The command name to resolve
 * @returns {string} - The full path or original command if not found
 */
function resolveWindowsCommand(command) {
  // Handle special case for 'node' - use process.execPath
  if (command === "node" || command === "node.exe") {
    return process.execPath;
  }

  // Try to resolve using 'where' command
  try {
    const result = execSync(`where ${command}`, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    });
    // 'where' can return multiple lines, take the first
    const firstLine = result.split(/\r?\n/)[0].trim();
    if (firstLine) {
      return firstLine;
    }
  } catch (err) {
    // Command not found or 'where' failed
  }

  return command;
}

/**
 * Special key replacements for terminal input
 * These map symbolic names to control characters
 */
const SPECIAL_KEYS = {
  "$ENTER$": "\n",
  "$CTRL_C$": "\x03",
  "$CTRL_D$": "\x04",
  "$CTRL_Z$": "\x1A",
  "$TAB$": "\t",
  "$ESC$": "\x1B",
  "$BACKSPACE$": "\x7F",
  "$UP$": "\x1B[A",
  "$DOWN$": "\x1B[B",
  "$RIGHT$": "\x1B[C",
  "$LEFT$": "\x1B[D",
};

/**
 * Replace special key placeholders with actual control characters
 *
 * @param {string} input - The input string with special key placeholders
 * @returns {string} - The string with placeholders replaced
 */
function replaceSpecialKeys(input) {
  let result = input;
  for (const [placeholder, value] of Object.entries(SPECIAL_KEYS)) {
    result = result.split(placeholder).join(value);
  }
  return result;
}

/**
 * Get the default shell for the current platform
 *
 * @returns {{ shell: string, args: string[] }}
 */
function getDefaultShell() {
  const platform = os.platform();
  if (platform === "win32") {
    // Use PowerShell on Windows for better compatibility
    return {
      shell: "powershell.exe",
      args: ["-NoLogo", "-NoProfile"],
    };
  } else if (platform === "darwin") {
    return {
      shell: process.env.SHELL || "/bin/zsh",
      args: [],
    };
  } else {
    return {
      shell: process.env.SHELL || "/bin/bash",
      args: [],
    };
  }
}

/**
 * Create a new terminal scope with node-pty
 *
 * @param {import('./registry').ScopeRegistry} registry - The scope registry
 * @param {string} scopeName - The name for the terminal scope
 * @param {Object} options - Terminal options
 * @param {string} [options.command] - Command to run (defaults to system shell)
 * @param {string[]} [options.args=[]] - Command arguments
 * @param {string} [options.cwd] - Working directory
 * @param {Object} [options.env] - Environment variables
 * @param {Object} [options.waitUntil] - Conditions to wait for after starting
 * @param {string} [options.waitUntil.stdout] - Pattern to match in stdout
 * @param {string} [options.waitUntil.stderr] - Pattern to match in stderr
 * @param {number} [options.waitUntil.timeout=30000] - Timeout in milliseconds
 * @returns {Promise<{status: string, description: string, outputs?: Object}>}
 */
async function createTerminalScope(registry, scopeName, options = {}) {
  // Check if scope already exists
  if (registry.has(scopeName)) {
    return {
      status: "FAIL",
      description: `Scope '${scopeName}' already exists. Use a different name or terminate the existing scope first.`,
    };
  }

  // Validate scope name (schema pattern: ^[a-zA-Z0-9_-]{1,64}$)
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(scopeName)) {
    return {
      status: "FAIL",
      description: `Invalid scope name '${scopeName}'. Must match pattern: ^[a-zA-Z0-9_-]{1,64}$`,
    };
  }

  // Get command and args
  let command = options.command;
  let args = options.args || [];

  if (!command) {
    const defaultShell = getDefaultShell();
    command = defaultShell.shell;
    args = defaultShell.args;
  }

  // On Windows, resolve command to full path (ConPTY requires full paths)
  if (os.platform() === "win32" && command) {
    command = resolveWindowsCommand(command);
  }

  // Load node-pty dynamically
  let pty;
  try {
    pty = require("node-pty");
  } catch (err) {
    return {
      status: "FAIL",
      description: `Failed to load node-pty: ${err.message}. Ensure node-pty is installed.`,
    };
  }

  // Create PTY process
  let ptyProcess;
  try {
    const ptyOptions = {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
    };

    ptyProcess = pty.spawn(command, args, ptyOptions);
  } catch (err) {
    return {
      status: "FAIL",
      description: `Failed to spawn terminal process: ${err.message}`,
    };
  }

  // Register the scope with the PTY process
  try {
    registry.create(scopeName, ptyProcess);
  } catch (err) {
    // Clean up if registration fails
    try {
      ptyProcess.kill();
    } catch (e) {
      // Ignore cleanup errors
    }
    return {
      status: "FAIL",
      description: err.message,
    };
  }

  // Set up data handlers to capture output
  ptyProcess.onData((data) => {
    registry.appendStdout(scopeName, data);
  });

  // Handle process exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    const scope = registry.get(scopeName);
    if (scope) {
      scope.exitCode = exitCode;
      scope.signal = signal;
    }
  });

  // Wait for conditions if specified
  if (options.waitUntil) {
    try {
      await waitForConditions(registry, scopeName, {
        stdout: options.waitUntil.stdout,
        stderr: options.waitUntil.stderr,
        timeout: options.waitUntil.timeout || 30000,
        pollInterval: options.waitUntil.pollInterval || 100,
      });
    } catch (err) {
      // Terminate the scope on timeout
      try {
        ptyProcess.kill();
      } catch (e) {
        // Ignore cleanup errors
      }
      registry.delete(scopeName);
      
      return {
        status: "FAIL",
        description: `Terminal started but conditions not met: ${err.message}`,
        outputs: {
          stdout: registry.get(scopeName)?.stdout || "",
        },
      };
    }
  }

  return {
    status: "PASS",
    description: `Terminal scope '${scopeName}' created successfully.`,
    outputs: {
      scopeName,
      pid: ptyProcess.pid,
    },
  };
}

/**
 * Terminate an existing terminal scope
 *
 * @param {import('./registry').ScopeRegistry} registry - The scope registry
 * @param {string} scopeName - The name of the scope to terminate
 * @param {Object} [options={}] - Termination options
 * @param {boolean} [options.force=false] - Force termination (SIGKILL)
 * @returns {Promise<{status: string, description: string}>}
 */
async function terminateScope(registry, scopeName, options = {}) {
  if (!registry.has(scopeName)) {
    return {
      status: "FAIL",
      description: `Scope '${scopeName}' not found.`,
    };
  }

  const scope = registry.get(scopeName);

  try {
    if (scope.process) {
      if (typeof scope.process.kill === "function") {
        scope.process.kill(options.force ? "SIGKILL" : undefined);
      }
    }
  } catch (err) {
    // Process may already be dead
  }

  // Remove from registry
  registry.delete(scopeName);

  return {
    status: "PASS",
    description: `Scope '${scopeName}' terminated successfully.`,
    outputs: {
      stdout: scope.stdout,
      stderr: scope.stderr,
    },
  };
}

/**
 * Write input to a terminal scope
 *
 * @param {import('./registry').ScopeRegistry} registry - The scope registry
 * @param {string} scopeName - The name of the scope
 * @param {string} input - The input to write (special keys will be replaced)
 * @returns {Promise<{status: string, description: string}>}
 */
async function writeToScope(registry, scopeName, input) {
  if (!registry.has(scopeName)) {
    return {
      status: "FAIL",
      description: `Scope '${scopeName}' not found.`,
    };
  }

  const scope = registry.get(scopeName);
  
  if (!scope.process || typeof scope.process.write !== "function") {
    return {
      status: "FAIL",
      description: `Scope '${scopeName}' does not have a writable process.`,
    };
  }

  // Replace special key placeholders
  const processedInput = replaceSpecialKeys(input);

  try {
    scope.process.write(processedInput);
    return {
      status: "PASS",
      description: `Wrote ${input.length} characters to scope '${scopeName}'.`,
    };
  } catch (err) {
    return {
      status: "FAIL",
      description: `Failed to write to scope '${scopeName}': ${err.message}`,
    };
  }
}

/**
 * Wait for output patterns in a terminal scope
 *
 * @param {import('./registry').ScopeRegistry} registry - The scope registry
 * @param {string} scopeName - The name of the scope
 * @param {Object} options - Wait options
 * @param {string} [options.stdout] - Pattern to match in stdout
 * @param {string} [options.stderr] - Pattern to match in stderr
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 * @param {number} [options.pollInterval=100] - Poll interval in milliseconds
 * @returns {Promise<{status: string, description: string, outputs?: Object}>}
 */
async function waitForOutput(registry, scopeName, options = {}) {
  if (!registry.has(scopeName)) {
    return {
      status: "FAIL",
      description: `Scope '${scopeName}' not found.`,
    };
  }

  try {
    await waitForConditions(registry, scopeName, {
      stdout: options.stdout,
      stderr: options.stderr,
      timeout: options.timeout || 30000,
      pollInterval: options.pollInterval || 100,
    });

    const scope = registry.get(scopeName);
    return {
      status: "PASS",
      description: `Output conditions met for scope '${scopeName}'.`,
      outputs: {
        stdout: scope.stdout,
        stderr: scope.stderr,
      },
    };
  } catch (err) {
    const scope = registry.get(scopeName);
    return {
      status: "FAIL",
      description: `Timeout waiting for output: ${err.message}`,
      outputs: {
        stdout: scope?.stdout || "",
        stderr: scope?.stderr || "",
      },
    };
  }
}

module.exports = {
  createTerminalScope,
  terminateScope,
  writeToScope,
  waitForOutput,
  replaceSpecialKeys,
  getDefaultShell,
  resolveWindowsCommand,
  SPECIAL_KEYS,
};
