const { runTests } = require("../src");

/**
 * Execute tests using a fixed configuration and print the test result as pretty-printed JSON.
 *
 * The configuration uses input "test/artifacts/cookie-test.spec.json", log level "debug",
 * runs on Linux with Firefox in non-headless mode, and provides docDetectiveApi.apiKey from process.env.KEY.
 * Assigns the awaited test output to the (outer-scope) variable `result` and writes the formatted JSON to stdout.
 */
async function main() {
  const json = {
    input: "test/artifacts/cookie-test.spec.json",
    logLevel: "debug",
    runOn:[{
      platforms: ["linux"],
      browsers: [{
        name: "firefox",
        headless: false
      }]
    }],
    integrations: {
      docDetectiveApi: {
        apiKey: process.env.KEY
      }
    }
  };
  // console.log(json);
  result = await runTests(json);
  console.log(JSON.stringify(result, null, 2));
}

main();