/**
 * terminateScope Action - Terminates a named scope and its associated process
 */

const { terminateScope: terminateScopeProcess } = require("../scopes");
const { log } = require("../utils");

/**
 * Execute a terminateScope action
 * @param {Object} config - The configuration object
 * @param {Object} step - The step object containing terminateScope action
 * @param {Object} context - The execution context
 * @param {Object} context.scopeRegistry - The scope registry
 * @returns {Promise<Object>} Result object with status and description
 */
async function terminateScope(config, step, context = {}) {
  const { scopeRegistry } = context;
  const action = step.terminateScope;
  
  // Handle both string and object forms
  const scopeName = typeof action === "string" ? action : action.scope;
  
  log(config, "debug", `Terminating scope: ${scopeName}`);
  
  // Validate scope registry
  if (!scopeRegistry) {
    return {
      status: "FAIL",
      description: "Scope registry not available. This action requires scope support.",
      outputs: {},
    };
  }
  
  // Check if scope exists
  if (!scopeRegistry.has(scopeName)) {
    return {
      status: "FAIL",
      description: `Scope '${scopeName}' does not exist or was already terminated.`,
      outputs: {},
    };
  }
  
  try {
    const scope = scopeRegistry.get(scopeName);
    
    // Terminate the process
    if (scope.process) {
      await terminateScopeProcess(scope.process);
    }
    
    // Remove from registry
    scopeRegistry.delete(scopeName);
    
    log(config, "debug", `Successfully terminated scope: ${scopeName}`);
    
    return {
      status: "PASS",
      description: `Terminated scope '${scopeName}'.`,
      outputs: {
        stdout: scope.stdout || "",
        stderr: scope.stderr || "",
      },
    };
  } catch (error) {
    return {
      status: "FAIL",
      description: `Failed to terminate scope '${scopeName}': ${error.message}`,
      outputs: {},
    };
  }
}

module.exports = terminateScope;
