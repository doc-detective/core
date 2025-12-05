const { runTests } = require("../src");
require("dotenv").config({path: '../../.env'});

/**
 * Run tests with a predefined configuration and print the result as pretty-printed JSON.
 */
async function main() {
  const json = {
    logLevel: "debug",
    runOn: [
      {
        platforms: ["linux", "windows", "mac"],
        browsers: [
          {
            name: "firefox",
            headless: true,
          },
        ],
      },
    ],
    integrations: {
      docDetectiveApi: {
        apiKey: process.env.KEY,
      },
      heretto: [
        {
          name: "heretto-example",
          organizationId: "silva", // Organization ID is the subdomain of your Heretto instance (e.g., "silva" for "silva.heretto.com")
          username: "", // Your Heretto username/email
          apiToken: "", // Your Heretto API token (https://help.heretto.com/en/heretto-ccms/api/ccms-api-authentication/basic-authentication)
        },
      ],
    },
  };
  // console.log(json);
  const result = await runTests(json);
  console.log(JSON.stringify(result, null, 2));
}

main();
