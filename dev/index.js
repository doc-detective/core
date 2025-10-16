
const { runTests } = require("../src");

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