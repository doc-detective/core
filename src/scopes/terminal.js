/**
 * Terminal Scope - PTY-backed terminal sessions using node-pty
 * 
 * Creates pseudo-terminal processes that support full terminal emulation,
 * allowing interactive commands and proper signal handling.
 */

const pty = require("node-pty");
const os = require("os");
const fs = require("fs");

/**
 * Find the best available shell on the system
 * @returns {string} Path to shell executable
 */
function findShell() {
  if (os.platform() === "win32") {
    return "cmd.exe";
  }
  
  // Try to find a suitable shell on Unix-like systems
  const possibleShells = [
    "/bin/bash",
    "/usr/bin/bash",
    "/bin/sh",
    "/usr/bin/sh",
    "/bin/zsh",
    "/usr/bin/zsh",
  ];
  
  for (const shell of possibleShells) {
    try {
      if (fs.existsSync(shell)) {
        return shell;
      }
    } catch (e) {
      // Continue to next shell
    }
  }
  
  // Fallback to sh (should always exist on Unix)
  return "/bin/sh";
}

/**
 * Check if a command needs to be run through a shell
 * @param {string} command - The command to check
 * @returns {boolean} True if command should run through shell
 */
function needsShell(command) {
  // If it's an absolute path that exists, run directly
  if (command.startsWith("/") && fs.existsSync(command)) {
    return false;
  }
  
  // Common system commands that should run through shell
  const shellCommands = ["echo", "cat", "ls", "pwd", "printenv", "cd", "export"];
  return shellCommands.includes(command);
}

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

  // Determine if we need to use a shell or can run directly
  let shell;
  let shellArgs;
  
  if (os.platform() === "win32") {
    // Windows always uses cmd.exe
    shell = "cmd.exe";
    shellArgs = ["/c", command, ...args];
  } else if (needsShell(command)) {
    // Use shell for built-in commands
    shell = findShell();
    shellArgs = ["-c", `${command} ${args.join(" ")}`];
  } else {
    // Run command directly (works for executables like 'node', 'bash', etc.)
    shell = command;
    shellArgs = args;
  }

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
