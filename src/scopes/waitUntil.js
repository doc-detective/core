/**
 * Wait Until - Utilities for waiting on output conditions
 * 
 * Supports waiting for specific strings or regex patterns in stdout/stderr
 * from scoped processes.
 */

/**
 * Parse a pattern string that may be a regex (e.g., "/pattern/flags") or plain string
 * @param {string} pattern - The pattern to parse
 * @returns {Object} Object with { isRegex, regex?, string? }
 */
function parsePattern(pattern) {
  // Check if it's a regex pattern: /pattern/ or /pattern/flags
  const regexMatch = pattern.match(/^\/(.+)\/([gimsuvy]*)$/);
  
  if (regexMatch) {
    const [, regexPattern, flags] = regexMatch;
    try {
      return {
        isRegex: true,
        regex: new RegExp(regexPattern, flags),
      };
    } catch (e) {
      throw new Error(`Invalid regex pattern '${pattern}': ${e.message}`);
    }
  }
  
  return {
    isRegex: false,
    string: pattern,
  };
}

/**
 * Check if a buffer matches a pattern
 * @param {string} buffer - The buffer to check
 * @param {Object} parsedPattern - Parsed pattern from parsePattern()
 * @returns {boolean} True if pattern matches
 */
function matchesPattern(buffer, parsedPattern) {
  if (parsedPattern.isRegex) {
    return parsedPattern.regex.test(buffer);
  }
  return buffer.includes(parsedPattern.string);
}

/**
 * Wait for conditions to be met in a scope's output
 * @param {ScopeRegistry} registry - The scope registry
 * @param {string} scopeName - The name of the scope to monitor
 * @param {Object} conditions - The conditions to wait for
 * @param {string} [conditions.stdout] - String or regex pattern to match in stdout
 * @param {string} [conditions.stderr] - String or regex pattern to match in stderr
 * @param {number} [conditions.timeout=30000] - Timeout in milliseconds
 * @param {Object} [conditions.terminalResult] - Terminal result object to monitor for early exit
 * @returns {Promise<boolean>} Resolves to true when conditions are met
 * @throws {Error} If timeout is reached, process exits early, or pattern is invalid
 */
async function waitForConditions(registry, scopeName, conditions) {
  const {
    stdout: stdoutPattern,
    stderr: stderrPattern,
    timeout = 30000,
    terminalResult = null,
  } = conditions;

  // Parse patterns upfront to catch errors early
  const parsedStdout = stdoutPattern ? parsePattern(stdoutPattern) : null;
  const parsedStderr = stderrPattern ? parsePattern(stderrPattern) : null;

  const startTime = Date.now();
  const pollInterval = 50; // ms

  return new Promise((resolve, reject) => {
    const check = () => {
      const scope = registry.get(scopeName);
      
      if (!scope) {
        reject(new Error(`Scope '${scopeName}' not found`));
        return;
      }

      // Check stdout condition
      let stdoutMatched = !parsedStdout; // True if no condition
      if (parsedStdout && matchesPattern(scope.stdout, parsedStdout)) {
        stdoutMatched = true;
      }

      // Check stderr condition
      let stderrMatched = !parsedStderr; // True if no condition
      if (parsedStderr && matchesPattern(scope.stderr, parsedStderr)) {
        stderrMatched = true;
      }

      // Both conditions must be met
      if (stdoutMatched && stderrMatched) {
        resolve(true);
        return;
      }

      // Check if process exited early (before conditions were met)
      if (terminalResult) {
        const exitCode = terminalResult.exitCode;
        if (exitCode !== null && exitCode !== undefined) {
          const waitedFor = [];
          if (parsedStdout) waitedFor.push(`stdout: "${stdoutPattern}"`);
          if (parsedStderr) waitedFor.push(`stderr: "${stderrPattern}"`);
          reject(new Error(
            `Process exited with code ${exitCode} before condition was met (${waitedFor.join(", ")}). ` +
            `Output: "${scope.stdout.slice(-200)}"`
          ));
          return;
        }
      }

      // Check timeout
      if (Date.now() - startTime >= timeout) {
        const waitedFor = [];
        if (parsedStdout) waitedFor.push(`stdout: "${stdoutPattern}"`);
        if (parsedStderr) waitedFor.push(`stderr: "${stderrPattern}"`);
        reject(new Error(
          `Timeout waiting for conditions (${waitedFor.join(", ")}) after ${timeout}ms. ` +
          `Current stdout: "${scope.stdout.slice(-200)}"`
        ));
        return;
      }

      // Continue polling
      setTimeout(check, pollInterval);
    };

    check();
  });
}

module.exports = {
  waitForConditions,
  parsePattern,
  matchesPattern,
};
