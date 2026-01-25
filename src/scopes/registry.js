/**
 * Scope Registry - Manages named scope instances
 *
 * A scope represents a persistent process (terminal, browser, etc.) that can be
 * reused across multiple test steps. The registry tracks:
 * - The process/driver instance
 * - Accumulated stdout/stderr for terminals
 * - Creation timestamp for lifecycle management
 *
 * Scope names must match pattern: ^[a-zA-Z0-9_-]{1,64}$
 */

/**
 * @typedef {Object} ScopeEntry
 * @property {Object} process - The process or driver instance
 * @property {string} stdout - Accumulated stdout data (for terminals)
 * @property {string} stderr - Accumulated stderr data (for terminals)
 * @property {number} createdAt - Timestamp when scope was created
 */

class ScopeRegistry {
  constructor() {
    /** @type {Map<string, ScopeEntry>} */
    this._scopes = new Map();
  }

  /**
   * Check if a scope exists
   * @param {string} name - The scope name
   * @returns {boolean}
   */
  has(name) {
    return this._scopes.has(name);
  }

  /**
   * Get a scope entry by name
   * @param {string} name - The scope name
   * @returns {ScopeEntry|undefined}
   */
  get(name) {
    return this._scopes.get(name);
  }

  /**
   * Create a new scope
   * @param {string} name - The scope name
   * @param {Object} process - The process or driver instance
   * @throws {Error} If name is empty or scope already exists
   */
  create(name, process) {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      throw new Error("Scope name cannot be empty");
    }

    if (this._scopes.has(trimmedName)) {
      throw new Error(`Scope '${trimmedName}' already exists`);
    }

    this._scopes.set(trimmedName, {
      process,
      stdout: "",
      stderr: "",
      createdAt: Date.now(),
    });
  }

  /**
   * Delete a scope (does not terminate the process)
   * @param {string} name - The scope name
   */
  delete(name) {
    this._scopes.delete(name);
  }

  /**
   * Append data to a scope's stdout buffer
   * @param {string} name - The scope name
   * @param {string} data - The data to append
   */
  appendStdout(name, data) {
    const scope = this._scopes.get(name);
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
    const scope = this._scopes.get(name);
    if (scope) {
      scope.stderr += data;
    }
  }

  /**
   * List all scope names
   * @returns {string[]}
   */
  list() {
    return Array.from(this._scopes.keys());
  }

  /**
   * Terminate all processes and clear the registry
   * Called during context cleanup
   */
  async cleanup() {
    const errors = [];

    for (const [name, entry] of this._scopes) {
      try {
        if (entry.process) {
          if (typeof entry.process.kill === "function") {
            entry.process.kill();
          } else if (typeof entry.process.destroy === "function") {
            entry.process.destroy();
          }
        }
      } catch (err) {
        // Log but don't fail cleanup
        errors.push({ name, error: err.message });
      }
    }

    this._scopes.clear();

    // Return errors for logging purposes
    return errors;
  }
}

module.exports = { ScopeRegistry };
