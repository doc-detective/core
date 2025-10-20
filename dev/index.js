const { runTests } = require("../src");

/**
 * Run tests with a predefined configuration and print the result as pretty-printed JSON.
 *
 * The configuration targets "dev/doc-content.dita" with log level "debug" and specifies execution on Linux
 * using Firefox with a visible (non-headless) browser. Calls `runTests` with this configuration and writes
 * the resulting object to stdout as formatted JSON.
 */
async function main() {
  const json = {
    input: "dev/doc-content.dita",
    logLevel: "debug",
    runOn:[{
      platforms: ["linux"],
      browsers: [{
        name: "firefox",
        headless: false
      }]
    }]
  };
  // console.log(json);
  result = await runTests(json);
  console.log(JSON.stringify(result, null, 2));
}

main();