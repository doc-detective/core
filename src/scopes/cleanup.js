/**
 * Cleanup Handlers - Graceful shutdown for scoped processes
 * 
 * Sets up process signal handlers to ensure all scoped processes
 * are terminated when the main process exits.
 */

/**
 * Setup cleanup handlers for graceful shutdown
 * @param {ScopeRegistry} registry - The scope registry to cleanup
 * @returns {Function} Function to remove the handlers
 */
function setupCleanupHandlers(registry) {
  let isCleaningUp = false;

  const cleanup = async () => {
    if (isCleaningUp) return;
    isCleaningUp = true;
    
    try {
      await registry.cleanup();
    } catch (e) {
      // Ignore errors during cleanup
    }
  };

  // Signal handlers
  const sigintHandler = async () => {
    await cleanup();
    process.exit(130); // 128 + SIGINT (2)
  };

  const sigtermHandler = async () => {
    await cleanup();
    process.exit(143); // 128 + SIGTERM (15)
  };

  const exitHandler = () => {
    // Synchronous cleanup on exit - can't await
    if (!isCleaningUp) {
      isCleaningUp = true;
      try {
        // Best effort synchronous cleanup
        for (const name of registry.list()) {
          const scope = registry.get(name);
          if (scope && scope.process && typeof scope.process.kill === "function") {
            try {
              scope.process.kill();
            } catch (e) {
              // Ignore
            }
          }
        }
      } catch (e) {
        // Ignore
      }
    }
  };

  const uncaughtHandler = async (err) => {
    console.error("Uncaught exception:", err);
    await cleanup();
    process.exit(1);
  };

  const unhandledHandler = async (reason, promise) => {
    console.error("Unhandled rejection:", reason);
    await cleanup();
    process.exit(1);
  };

  // Register handlers
  process.on("SIGINT", sigintHandler);
  process.on("SIGTERM", sigtermHandler);
  process.on("exit", exitHandler);
  process.on("uncaughtException", uncaughtHandler);
  process.on("unhandledRejection", unhandledHandler);

  // Return function to remove handlers
  return () => {
    process.off("SIGINT", sigintHandler);
    process.off("SIGTERM", sigtermHandler);
    process.off("exit", exitHandler);
    process.off("uncaughtException", uncaughtHandler);
    process.off("unhandledRejection", unhandledHandler);
  };
}

module.exports = {
  setupCleanupHandlers,
};
