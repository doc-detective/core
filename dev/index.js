const { runTests } = require("../src");

/**
 * Run tests with a predefined configuration and print the result as pretty-printed JSON.
 */
async function main() {
  const json = {
    input: "test/artifacts/find_extendedFinding.spec.json",
    logLevel: "debug",
    runOn:[{
      platforms: ["linux","windows","mac"],
      browsers: [{
        name: "firefox",
        headless: true
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