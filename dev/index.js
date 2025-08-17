
const { runTests } = require("../src");

async function main() {
  const json = {
    input: "/home/hawkeyexl/Workspaces/core/dev/dev.spec.yaml",
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