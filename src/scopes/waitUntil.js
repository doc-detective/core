/**
 * waitUntil - Pattern matching utilities for scope output
 *
 * Provides utilities for waiting until specific patterns appear in
 * a scope's stdout or stderr. Patterns can be:
 * - Plain strings (case-sensitive substring match)
 * - Regex patterns: /pattern/flags (e.g., /ready/i for case-insensitive)
 */

/**
 * @typedef {Object} ParsedPattern
 * @property {boolean} isRegex - Whether the pattern is a regex
 * @property {string} [string] - The string to match (if not regex)
 * @property {RegExp} [regex] - The regex to match (if regex)
 */

/**
 * Parse a pattern string into a usable pattern object
 * Regex patterns are in format: /pattern/flags
 * All other patterns are treated as plain strings
 *
 * @param {string} pattern - The pattern to parse
 * @returns {ParsedPattern}
 */
function parsePattern(pattern) {
  // Check if it's a regex pattern: /pattern/flags
  const regexMatch = pattern.match(/^\/(.+)\/([gimsuvy]*)$/);

  if (regexMatch) {
    try {
      const regex = new RegExp(regexMatch[1], regexMatch[2]);
      return { isRegex: true, regex };
    } catch (err) {
      throw new Error(`Invalid regex pattern: ${pattern} - ${err.message}`);
    }
  }

  // Plain string pattern
  return { isRegex: false, string: pattern };
}

/**
 * Check if a text matches a parsed pattern
 *
 * @param {string} text - The text to check
 * @param {ParsedPattern} pattern - The parsed pattern
 * @returns {boolean}
 */
function matchesPattern(text, pattern) {
  if (pattern.isRegex) {
    return pattern.regex.test(text);
  }
  return text.includes(pattern.string);
}

/**
 * Wait for conditions to be met on a scope's output
 *
 * @param {import('./registry').ScopeRegistry} registry - The scope registry
 * @param {string} scopeName - The name of the scope to check
 * @param {Object} conditions - The conditions to wait for
 * @param {string} [conditions.stdout] - Pattern to match in stdout
 * @param {string} [conditions.stderr] - Pattern to match in stderr
 * @param {number} [conditions.timeout=30000] - Timeout in milliseconds
 * @param {number} [conditions.pollInterval=100] - Poll interval in milliseconds
 * @returns {Promise<boolean>} - Resolves true when conditions are met
 * @throws {Error} - Rejects if timeout is reached or scope doesn't exist
 */
async function waitForConditions(
  registry,
  scopeName,
  { stdout, stderr, timeout = 30000, pollInterval = 100 } = {}
) {
  // Validate scope exists
  if (!registry.has(scopeName)) {
    throw new Error(`Scope '${scopeName}' not found`);
  }

  // If no conditions specified, resolve immediately
  if (!stdout && !stderr) {
    return true;
  }

  // Parse patterns once
  const stdoutPattern = stdout ? parsePattern(stdout) : null;
  const stderrPattern = stderr ? parsePattern(stderr) : null;

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkConditions = () => {
      // Check if scope still exists
      const scope = registry.get(scopeName);
      if (!scope) {
        reject(new Error(`Scope '${scopeName}' was terminated`));
        return;
      }

      // Check stdout condition
      const stdoutMatches =
        !stdoutPattern || matchesPattern(scope.stdout, stdoutPattern);

      // Check stderr condition
      const stderrMatches =
        !stderrPattern || matchesPattern(scope.stderr, stderrPattern);

      if (stdoutMatches && stderrMatches) {
        resolve(true);
        return;
      }

      // Check timeout
      if (Date.now() - startTime >= timeout) {
        const waitedFor = [];
        if (stdoutPattern && !stdoutMatches) {
          waitedFor.push(
            `stdout pattern "${stdout}" (current: ${scope.stdout.length} chars)`
          );
        }
        if (stderrPattern && !stderrMatches) {
          waitedFor.push(
            `stderr pattern "${stderr}" (current: ${scope.stderr.length} chars)`
          );
        }
        reject(
          new Error(
            `Timeout waiting for conditions: ${waitedFor.join(", ")}`
          )
        );
        return;
      }

      // Schedule next check
      setTimeout(checkConditions, pollInterval);
    };

    // Start checking
    checkConditions();
  });
}

module.exports = {
  parsePattern,
  matchesPattern,
  waitForConditions,
};
