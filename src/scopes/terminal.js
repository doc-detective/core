/**
 * Terminal Scope - PTY-backed terminal sessions using node-pty
 * 
 * Creates pseudo-terminal processes that support full terminal emulation,
 * allowing interactive commands and proper signal handling.
 */

const pty = require("node-pty");
const os = require("os");

/**
 * Create a terminal scope with a PTY-backed process
 * @param {Object} options - Configuration options
 * @param {string} options.command - The command to run
 * @param {string[]} [options.args=[]] - Command arguments
 * @param {string} [options.cwd] - Working directory
 * @param {Object} [options.env] - Environment variables (merged with process.env)
 * @param {boolean} [options.waitForExit=false] - If true, wait for process to exit
 * @param {number} [options.cols=80] - Terminal columns
 * @param {number} [options.rows=24] - Terminal rows
 * @returns {Promise<Object>} Result object with process, stdout, stderr
 */
async function createTerminalScope(options) {
  const {
    command,
    args = [],
    cwd = process.cwd(),
    env = {},
    waitForExit = false,
    cols = 80,
    rows = 24,
  } = options;

  // Determine shell based on platform
  const shell = os.platform() === "win32" ? "cmd.exe" : command;
  const shellArgs = os.platform() === "win32" ? ["/c", command, ...args] : args;

  // Merge environment variables
  const mergedEnv = { ...process.env, ...env };

  return new Promise((resolve, reject) => {
    let ptyProcess;
    
    try {
      ptyProcess = pty.spawn(shell, shellArgs, {
        name: "xterm-color",
        cols,
        rows,
        cwd,
        env: mergedEnv,
      });
    } catch (err) {
      reject(err);
      return;
    }

    let stdout = "";
    let stderr = ""; // In PTY, stderr merges with stdout, but we keep for API compatibility
    let exited = false;
    let exitCode = null;

    // Data handler - captures output
    const onDataHandler = (data) => {
      stdout += data;
    };
    ptyProcess.onData(onDataHandler);

    // Exit handler
    ptyProcess.onExit(({ exitCode: code }) => {
      exited = true;
      exitCode = code;
    });

    if (waitForExit) {
      // Wait for process to exit
      const checkExit = () => {
        if (exited) {
          resolve({
            process: ptyProcess,
            stdout,
            stderr,
            exitCode,
          });
        } else {
          setTimeout(checkExit, 10);
        }
      };
      checkExit();
    } else {
      // Return immediately with running process
      // Give a tiny delay to ensure process has started
      setTimeout(() => {
        resolve({
          process: ptyProcess,
          stdout,
          stderr,
          get exitCode() {
            return exitCode;
          },
        });
      }, 50);
    }
  });
}

/**
 * Terminate a terminal scope process
 * @param {Object} process - The PTY process to terminate
 * @param {Object} [options] - Termination options
 * @param {number} [options.timeout=5000] - Time to wait before force kill (ms)
 * @returns {Promise<void>}
 */
async function terminateScope(process, options = {}) {
  const { timeout = 5000 } = options;

  if (!process) {
    return;
  }

  return new Promise((resolve) => {
    let resolved = false;
    let forceKillTimeout;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        if (forceKillTimeout) {
          clearTimeout(forceKillTimeout);
        }
        resolve();
      }
    };

    // Listen for exit
    if (process.onExit) {
      process.onExit(() => {
        cleanup();
      });
    }

    // Try graceful termination first (SIGTERM)
    try {
      if (typeof process.kill === "function") {
        process.kill();
      }
    } catch (e) {
      // Process may already be dead
      cleanup();
      return;
    }

    // Force kill after timeout if still running
    forceKillTimeout = setTimeout(() => {
      try {
        if (typeof process.kill === "function") {
          // Send SIGKILL on Unix, or just call kill again on Windows
          process.kill("SIGKILL");
        }
      } catch (e) {
        // Ignore errors
      }
      cleanup();
    }, timeout);

    // Also set a max timeout to prevent hanging
    setTimeout(cleanup, timeout + 100);
  });
}

module.exports = {
  createTerminalScope,
  terminateScope,
};
