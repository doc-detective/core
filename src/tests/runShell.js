const { validate } = require("doc-detective-common");
const {
  log,
  calculateFractionalDifference,
} = require("../utils");
const fs = require("fs");
const path = require("path");
const pty = require("node-pty");
const os = require("os");
const crypto = require("crypto");

exports.runShell = runShell;

/**
 * Executes a command using node-pty (pseudo-terminal).
 * Returns a promise that resolves with combined output and exit code.
 * @param {string} cmd - The command to execute.
 * @param {string[]} args - The arguments to pass to the command.
 * @param {object} options - Options for command execution.
 * @param {string} options.cwd - Working directory.
 * @returns {Promise<{output: string, exitCode: number}>}
 */
function ptyCommand(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    // Build full command string
    const fullCommand = args.length > 0 ? `${cmd} ${args.join(" ")}` : cmd;
    
    let shell, shellArgs;
    let tempBatchFile = null;
    
    if (process.platform === "win32") {
      // On Windows, use a temporary batch file to properly handle complex commands
      // with pipes, quotes, and special characters that ConPTY has trouble with
      const tempDir = os.tmpdir();
      const uniqueId = crypto.randomBytes(8).toString("hex");
      tempBatchFile = path.join(tempDir, `docdet_${uniqueId}.bat`);
      
      // Write command to batch file with @echo off to suppress command echo
      fs.writeFileSync(tempBatchFile, `@echo off\n${fullCommand}\n`);
      
      shell = "cmd.exe";
      shellArgs = ["/c", tempBatchFile];
    } else {
      shell = process.env.SHELL || "/bin/bash";
      shellArgs = ["-c", fullCommand];
    }

    // Configure PTY options
    const ptyOptions = {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: options.cwd || process.cwd(),
      env: process.env,
    };

    let ptyProcess;
    try {
      ptyProcess = pty.spawn(shell, shellArgs, ptyOptions);
    } catch (err) {
      // Clean up batch file on error
      if (tempBatchFile && fs.existsSync(tempBatchFile)) {
        try { fs.unlinkSync(tempBatchFile); } catch (e) {}
      }
      reject(new Error(`Failed to spawn PTY process: ${err.message}`));
      return;
    }

    let output = "";

    ptyProcess.onData((data) => {
      output += data;
    });

    ptyProcess.onExit(({ exitCode }) => {
      // Clean up temp batch file
      if (tempBatchFile && fs.existsSync(tempBatchFile)) {
        try { fs.unlinkSync(tempBatchFile); } catch (e) {}
      }
      
      // Clean up the output - remove ANSI escape codes and normalize line endings
      let cleanOutput = output
        // Remove ANSI escape sequences (CSI sequences)
        .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
        // Remove OSC sequences (title setting, etc.)
        .replace(/\x1B\][^\x07]*\x07/g, "")
        // Remove DEC private mode sequences
        .replace(/\x1B\[\?[0-9]+[a-z]/gi, "")
        // Normalize line endings
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        // Remove trailing newline
        .replace(/\n$/, "");

      resolve({
        output: cleanOutput,
        exitCode: exitCode,
      });
    });
  });
}

// Run a shell command.
async function runShell({ config, step }) {
  // Promisify and execute command
  const result = {
    status: "PASS",
    description: "Executed command.",
    outputs: {
      exitCode: "",
      stdio: {
        stdout: "",
        stderr: "",
      },
    },
  };

  // Validate step object
  const isValidStep = validate({ schemaKey: "step_v3", object: step });
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }
  // Accept coerced and defaulted values
  step = isValidStep.object;
  // Resolve to object
  if (typeof step.runShell === "string") {
    step.runShell = { command: step.runShell };
  }
  // Set default values
  step.runShell = {
    ...step.runShell,
    exitCodes: step.runShell.exitCodes || [0],
    args: step.runShell.args || [],
    workingDirectory: step.runShell.workingDirectory || ".",
    maxVariation: step.runShell.maxVariation || 0,
    overwrite: step.runShell.overwrite || "aboveVariation",
    timeout: step.runShell.timeout || 60000,
  };

  // Execute command using node-pty
  const timeout = step.runShell.timeout;
  const options = {};
  if (step.runShell.workingDirectory)
    options.cwd = step.runShell.workingDirectory;
  
  const commandPromise = ptyCommand(
    step.runShell.command,
    step.runShell.args,
    options
  );
  
  let timeoutId;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeout} milliseconds`));
    }, timeout);
  });

  try {
    // Wait for command to finish or timeout
    const commandResult = await Promise.race([commandPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    // node-pty provides combined output (stdout and stderr are merged in PTY)
    // Store in stdout for compatibility, stderr will be empty
    result.outputs.stdio.stdout = commandResult.output.replace(/\r$/, "");
    result.outputs.stdio.stderr = "";
    result.outputs.exitCode = commandResult.exitCode;
  } catch (error) {
    result.status = "FAIL";
    result.description = error.message;
    return result;
  }

  // Evaluate exit code
  if (!step.runShell.exitCodes.includes(result.outputs.exitCode)) {
    result.status = "FAIL";
    result.description = `Returned exit code ${
      result.outputs.exitCode
    }. Expected one of ${JSON.stringify(step.runShell.exitCodes)}`;
  }

  // Evaluate stdout and stderr
  // If step.runShell.stdio starts and ends with `/`, treat it as a regex
  if (step.runShell.stdio) {
    if (
      step.runShell.stdio.startsWith("/") &&
      step.runShell.stdio.endsWith("/")
    ) {
      const regex = new RegExp(step.runShell.stdio.slice(1, -1));
      if (
        !regex.test(result.outputs.stdio.stdout) &&
        !regex.test(result.outputs.stdio.stderr)
      ) {
        result.status = "FAIL";
        result.description = `Couldn't find expected output (${step.runShell.stdio}) in actual output (stdout or stderr).`;
      }
    } else {
      if (
        !result.outputs.stdio.stdout.includes(step.runShell.stdio) &&
        !result.outputs.stdio.stderr.includes(step.runShell.stdio)
      ) {
        result.status = "FAIL";
        result.description = `Couldn't find expected output (${step.runShell.stdio}) in stdio (stdout or stderr).`;
      }
    }
  }

  // Check if command output is saved to a file
  if (step.runShell.path) {
    const dir = path.dirname(step.runShell.path);
    // If `dir` doesn't exist, create it
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Set filePath
    let filePath = step.runShell.path;
    log(config, "debug", `Saving stdio to file: ${filePath}`);

    // Check if file already exists
    if (!fs.existsSync(filePath)) {
      // Doesn't exist, save output to file
      fs.writeFileSync(filePath, result.outputs.stdio.stdout);
    } else {
      if (step.runShell.overwrite == "false") {
        // File already exists
        result.description =
          result.description + ` Didn't save output. File already exists.`;
      }

      // Read existing file
      const existingFile = fs.readFileSync(filePath, "utf8");

      // Calculate fractional diff between existing file content and command output content, not length
      const fractionalDiff = calculateFractionalDifference(
        existingFile,
        result.outputs.stdio.stdout
      );
      log(config, "debug", `Fractional difference: ${fractionalDiff}`);

      if (fractionalDiff > step.runShell.maxVariation) {
        if (step.runShell.overwrite == "aboveVariation") {
          // Overwrite file
          fs.writeFileSync(filePath, result.outputs.stdio.stdout);
          result.description += ` Saved output to file.`;
        }
        result.status = "WARNING";
        result.description =
          result.description +
          ` The difference between the existing output and the new output (${fractionalDiff.toFixed(
            2
          )}) is greater than the max accepted variation (${
            step.runShell.maxVariation
          }).`;
        return result;
      }

      if (step.runShell.overwrite == "true") {
        // Overwrite file
        fs.writeFileSync(filePath, result.outputs.stdio.stdout);
        result.description += ` Saved output to file.`;
      }
    }
  }

  return result;
}
