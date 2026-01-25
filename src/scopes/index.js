/**
 * Scopes Module - Named persistent interfaces for test automation
 *
 * Provides the ability to create and manage named scopes (terminals, browsers, etc.)
 * that persist across multiple test steps within a context.
 *
 * @module scopes
 */

const { ScopeRegistry } = require("./registry");
const {
  parsePattern,
  matchesPattern,
  waitForConditions,
} = require("./waitUntil");
const {
  createTerminalScope,
  terminateScope,
  writeToScope,
  waitForOutput,
  replaceSpecialKeys,
  getDefaultShell,
  SPECIAL_KEYS,
} = require("./terminal");

module.exports = {
  // Registry
  ScopeRegistry,

  // Pattern matching
  parsePattern,
  matchesPattern,
  waitForConditions,

  // Terminal
  createTerminalScope,
  terminateScope,
  writeToScope,
  waitForOutput,
  replaceSpecialKeys,
  getDefaultShell,
  SPECIAL_KEYS,
};
