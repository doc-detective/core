/**
 * Scope Registry - Manages named scopes for long-running processes
 * 
 * A scope represents a running process with its associated output buffers.
 * Scopes allow steps to reference and interact with processes across multiple test steps.
 */

/**
 * ScopeRegistry manages named scopes for terminal/shell sessions
 */
class ScopeRegistry {
  constructor() {
    this.scopes = new Map();
  }

  /**
   * Check if a scope exists
   * @param {string} name - The scope name
   * @returns {boolean} True if scope exists
   */
  has(name) {
    return this.scopes.has(name);
  }

  /**
   * Get a scope by name
   * @param {string} name - The scope name
   * @returns {Object|undefined} The scope object or undefined
   */
  get(name) {
    return this.scopes.get(name);
  }

  /**
   * Create a new scope
   * @param {string} name - The scope name (must be unique and non-empty)
   * @param {Object} process - The process object (must have pid property)
   * @throws {Error} If name is empty or scope already exists
   */
  create(name, process) {
    if (!name || name.trim() === "") {
      throw new Error("Scope name cannot be empty");
    }
    if (this.scopes.has(name)) {
      throw new Error(`Scope '${name}' already exists`);
    }
    this.scopes.set(name, {
      process,
      stdout: "",
      stderr: "",
      createdAt: Date.now(),
    });
  }

  /**
   * Delete a scope by name
   * @param {string} name - The scope name
   */
  delete(name) {
    this.scopes.delete(name);
  }

  /**
   * Append data to a scope's stdout buffer
   * @param {string} name - The scope name
   * @param {string} data - The data to append
   */
  appendStdout(name, data) {
    const scope = this.scopes.get(name);
    if (scope) {
      scope.stdout += data;
    }
  }

  /**
   * Append data to a scope's stderr buffer
   * @param {string} name - The scope name
   * @param {string} data - The data to append
   */
  appendStderr(name, data) {
    const scope = this.scopes.get(name);
    if (scope) {
      scope.stderr += data;
    }
  }

  /**
   * List all scope names
   * @returns {string[]} Array of scope names
   */
  list() {
    return Array.from(this.scopes.keys());
  }

  /**
   * Cleanup all scopes - terminates all processes and clears the registry
   * @returns {Promise<void>}
   */
  async cleanup() {
    const promises = [];
    for (const [name, scope] of this.scopes) {
      if (scope.process && typeof scope.process.kill === "function") {
        try {
          scope.process.kill();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      promises.push(Promise.resolve());
    }
    await Promise.all(promises);
    this.scopes.clear();
  }
}

module.exports = { ScopeRegistry };
