/**
 * createScope Action Handler
 * 
 * Creates a named scope (terminal) that persists across test steps.
 * The scope can be interacted with using other actions like typeKeys and terminateScope.
 */

const { createTerminalScope } = require("../scopes");

exports.createScope = createScope;

/**
 * Create a named scope
 * 
 * @param {Object} options - The action options
 * @param {Object} options.config - The Doc Detective configuration
 * @param {Object} options.step - The step definition
 * @param {string|Object} options.step.createScope - Scope name (for default shell) or object with options
 * @param {import('../scopes/registry').ScopeRegistry} options.scopeRegistry - The scope registry
 * @returns {Promise<{status: string, description: string, outputs?: Object}>}
 */
async function createScope({ config, step, scopeRegistry }) {
  // Initialize result
  const result = {
    status: "PASS",
    description: "Created scope.",
    outputs: {},
  };

  // Check if scope registry is available
  if (!scopeRegistry) {
    result.status = "FAIL";
    result.description = "Scope registry not available. Scopes must be enabled in the test runner.";
    return result;
  }

  // Resolve scope options from step definition
  let scopeName;
  let options = {};
  
  if (typeof step.createScope === "string") {
    // Simple string format: { createScope: "my-scope" }
    // Creates default shell scope
    scopeName = step.createScope;
  } else if (typeof step.createScope === "object") {
    // Object format: { createScope: { scope: "my-scope", command: "node", args: [...] } }
    scopeName = step.createScope.scope;
    options = {
      command: step.createScope.command,
      args: step.createScope.args || [],
      cwd: step.createScope.workingDirectory || step.createScope.cwd,
      env: step.createScope.env,
      waitUntil: step.createScope.waitUntil,
    };
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

  // Create the terminal scope
  const createResult = await createTerminalScope(scopeRegistry, scopeName, options);

  if (createResult.status === "FAIL") {
    result.status = "FAIL";
    result.description = createResult.description;
    return result;
  }

  // Copy outputs from the create result
  result.description = `Scope '${scopeName}' created successfully.`;
  result.outputs = {
    scopeName: scopeName,
    pid: createResult.outputs?.pid,
  };

  return result;
}
