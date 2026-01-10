/**
 * Scopes Module - Session management for long-running processes
 * 
 * Provides utilities for creating, managing, and cleaning up named scopes
 * that persist across test steps.
 */

const { ScopeRegistry } = require("./registry");
const { createTerminalScope, terminateScope } = require("./terminal");
const { waitForConditions, parsePattern, matchesPattern } = require("./waitUntil");
const { setupCleanupHandlers } = require("./cleanup");
const { createCodeScope } = require("./code");

module.exports = {
  // Registry
  ScopeRegistry,
  
  // Terminal scopes
  createTerminalScope,
  terminateScope,
  
  // Wait utilities
  waitForConditions,
  parsePattern,
  matchesPattern,
  
  // Cleanup
  setupCleanupHandlers,
  
  // Code scopes (placeholder)
  createCodeScope,
};
