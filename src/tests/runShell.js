const { validate } = require("doc-detective-common");
const {
  spawnCommand,
  log,
  calculateFractionalDifference,
} = require("../utils");
const {
  createTerminalScope,
  waitForConditions,
} = require("../scopes");
const fs = require("fs");
const path = require("path");

exports.runShell = runShell;

// Run a shell command.
async function runShell({ config, step, scopeRegistry }) {
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

  // Check if this is a scoped command
  if (step.runShell.scope) {
    return await runScopedCommand({ config, step, scopeRegistry, result });
  }

  // Non-scoped command - original behavior
  return await runNonScopedCommand({ config, step, result });
}

/**
 * Run a scoped command using terminal scope
 * 
 * Behavior:
 * - If waitUntil is NOT specified: Wait for command to complete (exit), respecting timeout.
 *   Check exit code and clean up scope after completion.
 * - If waitUntil IS specified: Wait for the condition to be met, then return early.
 *   The process continues running in the background for subsequent steps to interact with.
 */
async function runScopedCommand({ config, step, scopeRegistry, result }) {
  const scopeName = step.runShell.scope;
  const waitUntil = step.runShell.waitUntil;
  const timeout = step.runShell.timeout;
  
  log(config, "debug", `Running scoped command in scope: ${scopeName}`);
  
  // Check if scope registry is available
  if (!scopeRegistry) {
    result.status = "FAIL";
    result.description = "Scope registry not available. Scoped commands require scope support.";
    return result;
  }
  
  // Check if scope already exists
  if (scopeRegistry.has(scopeName)) {
    result.status = "FAIL";
    result.description = `Scope '${scopeName}' already exists. Terminate it first or use a different name.`;
    return result;
  }
  
  try {
    // Create terminal scope
    const terminalResult = await createTerminalScope({
      command: step.runShell.command,
      args: step.runShell.args,
      cwd: step.runShell.workingDirectory,
      waitForExit: false,
    });
    
    // Register the scope with the terminalResult for exit code access
    scopeRegistry.create(scopeName, terminalResult.process, { terminalResult });
    
    // Initialize with any output already captured
    if (terminalResult.stdout) {
      scopeRegistry.appendStdout(scopeName, terminalResult.stdout);
    }
    
    // Set up output capture for future output
    terminalResult.process.onData((data) => {
      scopeRegistry.appendStdout(scopeName, data);
    });
    
    log(config, "debug", `Created scope '${scopeName}' with PID ${terminalResult.process.pid}`);
    
    if (waitUntil && waitUntil.stdio) {
      // WITH waitUntil: Wait for condition, allow process to continue running
      // But also monitor for early exit - if process exits before condition is met, fail immediately
      log(config, "debug", `Waiting for condition in scope '${scopeName}' (timeout: ${timeout}ms)`);
      
      try {
        await waitForConditions(scopeRegistry, scopeName, {
          stdout: waitUntil.stdio.stdout,
          stderr: waitUntil.stdio.stderr,
          timeout: timeout,
          terminalResult: terminalResult, // Pass terminalResult to detect early exit
        });
        
        log(config, "debug", `Condition met in scope '${scopeName}', process continues running`);
        
        // Get current output
        const scope = scopeRegistry.get(scopeName);
        result.outputs.stdio.stdout = scope ? scope.stdout : "";
        result.outputs.stdio.stderr = scope ? scope.stderr : "";
        result.description = `Scoped command '${scopeName}' ready (process continues running).`;
        
      } catch (waitError) {
        // Early exit or timeout - terminate process and clean up
        await cleanupScope(scopeRegistry, scopeName);
        
        result.status = "FAIL";
        // Use the error message directly - it will indicate if it was early exit or timeout
        result.description = `Failed waiting for condition in scope '${scopeName}': ${waitError.message}`;
        return result;
      }
    } else {
      // WITHOUT waitUntil: Wait for command to complete (exit)
      log(config, "debug", `Waiting for command to complete in scope '${scopeName}' (timeout: ${timeout}ms)`);
      
      try {
        const exitResult = await waitForExit(terminalResult, timeout);
        
        // Get final output
        const scope = scopeRegistry.get(scopeName);
        result.outputs.stdio.stdout = scope ? scope.stdout : "";
        result.outputs.stdio.stderr = scope ? scope.stderr : "";
        result.outputs.exitCode = exitResult.exitCode;
        
        // Clean up scope since command completed
        scopeRegistry.delete(scopeName);
        
        // Check exit code
        if (!step.runShell.exitCodes.includes(exitResult.exitCode)) {
          result.status = "FAIL";
          result.description = `Scoped command returned exit code ${exitResult.exitCode}. Expected one of ${JSON.stringify(step.runShell.exitCodes)}`;
          return result;
        }
        
        result.description = `Scoped command '${scopeName}' completed with exit code ${exitResult.exitCode}.`;
        
      } catch (exitError) {
        // Timeout - terminate process and clean up
        await cleanupScope(scopeRegistry, scopeName);
        
        result.status = "FAIL";
        result.description = `Command in scope '${scopeName}' did not complete within ${timeout}ms. Use 'waitUntil' for long-running processes.`;
        return result;
      }
    }
    
    // Check stdio pattern if specified
    if (step.runShell.stdio) {
      if (!checkStdioPattern(step.runShell.stdio, result.outputs.stdio.stdout, result.outputs.stdio.stderr)) {
        result.status = "FAIL";
        result.description = `Couldn't find expected output (${step.runShell.stdio}) in scope output.`;
      }
    }
    
    return result;
  } catch (error) {
    result.status = "FAIL";
    result.description = `Failed to run scoped command: ${error.message}`;
    return result;
  }
}

/**
 * Wait for a process to exit within a timeout by polling the terminalResult's exitCode getter
 * @param {Object} terminalResult - The terminal result object with exitCode getter
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<{exitCode: number}>}
 */
function waitForExit(terminalResult, timeout) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const pollInterval = 50; // Check every 50ms
    
    const checkExit = () => {
      const exitCode = terminalResult.exitCode;
      
      // exitCode is defined (including 0) when process has exited
      if (exitCode !== null && exitCode !== undefined) {
        resolve({ exitCode });
        return;
      }
      
      // Check if timed out
      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout after ${timeout}ms`));
        return;
      }
      
      // Poll again
      setTimeout(checkExit, pollInterval);
    };
    
    checkExit();
  });
}

/**
 * Clean up a scope by terminating process and removing from registry
 */
async function cleanupScope(scopeRegistry, scopeName) {
  try {
    const scope = scopeRegistry.get(scopeName);
    if (scope && scope.process) {
      scope.process.kill();
    }
    scopeRegistry.delete(scopeName);
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Check if stdio matches a pattern (string or regex)
 */
function checkStdioPattern(pattern, stdout, stderr) {
  if (pattern.startsWith("/") && pattern.endsWith("/")) {
    const regex = new RegExp(pattern.slice(1, -1));
    return regex.test(stdout) || regex.test(stderr);
  }
  return stdout.includes(pattern) || stderr.includes(pattern);
}

/**
 * Run a non-scoped command (original behavior)
 */
async function runNonScopedCommand({ config, step, result }) {
  const timeout = step.runShell.timeout;
  const options = {};
  if (step.runShell.workingDirectory)
    options.cwd = step.runShell.workingDirectory;
  const commandPromise = spawnCommand(
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
    result.outputs.stdio.stdout = commandResult.stdout.replace(/\r$/, "");
    result.outputs.stdio.stderr = commandResult.stderr.replace(/\r$/, "");
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
