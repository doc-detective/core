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
          username: "manny@doc-detective.com", // Your Heretto username/email
          apiToken: "6FE4PB2/UB+jd9f/UY0+y8CO5Z+yOXrPXxY7k2vqjiAT17Ptg/V6nzpPCxoRKafL", // Your Heretto API token (https://help.heretto.com/en/heretto-ccms/api/ccms-api-authentication/basic-authentication)
          fileId: "8ecfdb21-0c17-4dd8-b4d4-866eb54e5594", // The ID of the file you want to work with
        },
      ],
    },
  };
  // console.log(json);
  const result = await runTests(json);
  console.log(JSON.stringify(result, null, 2));
}

main();
