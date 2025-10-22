const {
  detectAndResolveTests,
} = require("doc-detective-resolver");
const { log, cleanTemp } = require("./utils");
const { runSpecs, runViaApi } = require("./tests");
const { telemetryNotice, sendTelemetry } = require("./telem");

exports.runTests = runTests;

const supportMessage = `
##########################################################################
# Thanks for using Doc Detective! If this project was helpful to you,    #
# please consider starring the repo on GitHub or sponsoring the project: #
# - GitHub Sponsors: https://github.com/sponsors/doc-detective           #
# - Open Collective: https://opencollective.com/doc-detective            #
##########################################################################`;

// Run tests defined in specifications and documentation source files.
async function runTests(config, options = {}) {
  let resolvedTests;

  if (options.resolvedTests) {
    resolvedTests = options.resolvedTests;
    config = resolvedTests.config;
  }

  // Telemetry notice
  telemetryNotice(config);

  if (!resolvedTests) {
    resolvedTests = await detectAndResolveTests({ config });
    if (!resolvedTests || resolvedTests.specs.length === 0) {
      log(config, "warn", "Couldn't resolve any tests.");
      return null;
    }
  }

  let results;
  // If config.docDetectiveApi.key is set, run tests via API instead of locally
  if (config.docDetectiveApi && config.docDetectiveApi.key) {
    // Run test specs via API
    results = await runSpecs({
      resolvedTests,
      apiKey: config.docDetectiveApi.key,
    });
  } else {
    // Run test specs locally
    results = await runSpecs({ resolvedTests });
  }
  log(config, "info", "RESULTS:");
  log(config, "info", results);
  log(config, "info", "Cleaning up and finishing post-processing.");

  // Clean up
  cleanTemp();

  // Send telemetry
  sendTelemetry(config, "runTests", results);
  log(config, "info", supportMessage);

  return results;
}
