const { runTests } = require("../src");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

/**
 * Run tests with a predefined configuration and print the result as pretty-printed JSON.
 */
async function main() {
  const json = {
    input: ["heretto:example"],
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
          name: "example",
          organizationId: process.env.HERETTO_ORG_ID, // Organization ID is the subdomain of your Heretto instance (e.g., "silva" for "silva.heretto.com")
          username: process.env.HERETTO_USERNAME, // Your Heretto username/email
          apiToken: process.env.HERETTO_TOKEN, // Your Heretto API token (https://help.heretto.com/en/heretto-ccms/api/ccms-api-authentication/basic-authentication)
          uploadOnChange: true, // Upload changed screenshots back to Heretto
        },
      ],
    },
  };
  // console.log(json);
  const result = await runTests(json);
  console.log(JSON.stringify(result, null, 2));
}

main();
