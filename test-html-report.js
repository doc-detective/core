const { runTests, generateHtmlReport } = require("./src");
const path = require("path");

const config = {
  input: "./test/artifacts/checkLink.spec.json",
  logLevel: "info"
};

async function testHtmlReporter() {
  console.log("Running tests...");
  const results = await runTests(config);
  
  if (results) {
    console.log("\nGenerating HTML report...");
    const reportPath = path.resolve("./test-report.html");
    const reportResult = await generateHtmlReport(results, config, reportPath);
    
    if (reportResult.status === "PASS") {
      console.log(`\n✅ HTML report generated successfully at: ${reportPath}`);
      console.log(`Open this file in a browser to view the report.`);
    } else {
      console.log(`\n❌ Failed to generate HTML report: ${reportResult.description}`);
    }
  } else {
    console.log("No test results to report.");
  }
}

testHtmlReporter().catch(console.error);
