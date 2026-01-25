/**
 * terminateScope Action Handler
 * 
 * Terminates a named scope (terminal, browser, etc.) that was previously created.
 * Returns the captured stdout/stderr from the scope.
 */

const { terminateScope: terminateScopeFromRegistry } = require("../scopes");

exports.terminateScope = terminateScope;

/**
 * Terminate a named scope
 * 
 * @param {Object} options - The action options
 * @param {Object} options.config - The Doc Detective configuration
 * @param {Object} options.step - The step definition
 * @param {string|Object} options.step.terminateScope - Scope name or object with scope property
 * @param {import('../scopes/registry').ScopeRegistry} options.scopeRegistry - The scope registry
 * @returns {Promise<{status: string, description: string, outputs?: Object}>}
 */
async function terminateScope({ config, step, scopeRegistry }) {
  // Initialize result
  const result = {
    status: "PASS",
    description: "Terminated scope.",
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

  // Resolve scope name from step definition
  let scopeName;
  
  if (typeof step.terminateScope === "string") {
    // Simple string format: { terminateScope: "my-scope" }
    scopeName = step.terminateScope;
  } else if (typeof step.terminateScope === "object" && step.terminateScope.scope) {
    // Object format: { terminateScope: { scope: "my-scope" } }
    scopeName = step.terminateScope.scope;
  } else {
    result.status = "FAIL";
    result.description = "Invalid step definition. Expected scope name as string or object with 'scope' property.";
    return result;
  }

  // Validate scope name
  if (!scopeName || typeof scopeName !== "string") {
    result.status = "FAIL";
    result.description = "Scope name is required.";
    return result;
  }

  // Terminate the scope using the scopes module
  const terminateResult = await terminateScopeFromRegistry(scopeRegistry, scopeName);

  if (terminateResult.status === "FAIL") {
    result.status = "FAIL";
    result.description = terminateResult.description;
    return result;
  }

  // Copy outputs from the terminate result
  result.description = `Scope '${scopeName}' terminated successfully.`;
  result.outputs = {
    scopeName: scopeName,
    stdout: terminateResult.outputs?.stdout || "",
    stderr: terminateResult.outputs?.stderr || "",
  };

  return result;
}
