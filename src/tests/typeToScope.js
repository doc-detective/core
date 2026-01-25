/**
 * typeToScope Action Handler
 * 
 * Writes input to a named terminal scope.
 * Supports special key replacements like $ENTER$, $CTRL_C$, etc.
 * Can optionally wait for output patterns after typing.
 */

const { writeToScope, waitForOutput } = require("../scopes");

exports.typeToScope = typeToScope;

/**
 * Type input to a named scope
 * 
 * @param {Object} options - The action options
 * @param {Object} options.config - The Doc Detective configuration
 * @param {Object} options.step - The step definition
 * @param {Object} options.step.typeToScope - Object with scope, input, and optional waitUntil
 * @param {import('../scopes/registry').ScopeRegistry} options.scopeRegistry - The scope registry
 * @returns {Promise<{status: string, description: string, outputs?: Object}>}
 */
async function typeToScope({ config, step, scopeRegistry }) {
  // Initialize result
  const result = {
    status: "PASS",
    description: "Typed to scope.",
    outputs: {
      stdout: "",
      stderr: "",
    },
  };

  // Check if scope registry is available
  if (!scopeRegistry) {
    result.status = "FAIL";
    result.description = "Scope registry not available. Scopes must be enabled in the test runner.";
    return result;
  }

  // Validate step definition
  if (typeof step.typeToScope !== "object" || !step.typeToScope) {
    result.status = "FAIL";
    result.description = "Invalid step definition. Expected object with 'scope' and 'input' properties.";
    return result;
  }

  const { scope: scopeName, input, waitUntil } = step.typeToScope;

  // Validate scope name
  if (!scopeName || typeof scopeName !== "string") {
    result.status = "FAIL";
    result.description = "Scope name is required.";
    return result;
  }

  // Validate input
  if (input === undefined || input === null) {
    result.status = "FAIL";
    result.description = "Input is required.";
    return result;
  }

  // Write to the scope
  const writeResult = await writeToScope(scopeRegistry, scopeName, String(input));

  if (writeResult.status === "FAIL") {
    result.status = "FAIL";
    result.description = writeResult.description;
    return result;
  }

  result.description = `Typed ${input.length} characters to scope '${scopeName}'.`;

  // If waitUntil is specified, wait for output patterns
  if (waitUntil) {
    const waitResult = await waitForOutput(scopeRegistry, scopeName, {
      stdout: waitUntil.stdout,
      stderr: waitUntil.stderr,
      timeout: waitUntil.timeout || 30000,
      pollInterval: waitUntil.pollInterval || 100,
    });

    if (waitResult.status === "FAIL") {
      result.status = "FAIL";
      result.description = `Typed to scope but wait condition failed: ${waitResult.description}`;
      result.outputs = waitResult.outputs;
      return result;
    }

    result.outputs = waitResult.outputs;
    result.description = `Typed to scope '${scopeName}' and wait conditions met.`;
  } else {
    // Get current stdout/stderr without waiting
    const scope = scopeRegistry.get(scopeName);
    if (scope) {
      result.outputs = {
        stdout: scope.stdout,
        stderr: scope.stderr,
      };
    }
  }

  return result;
}
