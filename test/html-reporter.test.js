const { generateHtmlReport } = require("../src/reporters/html");
const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

describe("HTML Reporter Tests", function () {
  this.timeout(0);
  
  const tempDir = path.resolve("./test/temp-html-reports");
  
  // Create temp directory before tests
  before(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });
  
  // Clean up temp directory after tests
  after(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
  
  it("Should generate a valid HTML report from test results", async () => {
    const mockResults = {
      summary: {
        specs: { pass: 1, fail: 0, warning: 0, skipped: 0 },
        tests: { pass: 1, fail: 0, warning: 0, skipped: 0 },
        contexts: { pass: 1, fail: 0, warning: 0, skipped: 0 },
        steps: { pass: 2, fail: 0, warning: 0, skipped: 0 }
      },
      specs: [
        {
          specId: "test-spec-1",
          description: "Test Specification 1",
          contentPath: "/path/to/spec.json",
          result: "PASS",
          tests: [
            {
              testId: "test-1",
              description: "Test 1",
              contentPath: "/path/to/test.json",
              detectSteps: false,
              result: "PASS",
              contexts: [
                {
                  contextId: "context-1",
                  platform: "linux",
                  browser: "firefox",
                  result: "PASS",
                  steps: [
                    {
                      runShell: "echo 'Hello World'",
                      result: "PASS",
                      description: "Print hello world",
                      outputs: { stdout: "Hello World", exitCode: 0 }
                    },
                    {
                      runShell: "ls -la",
                      result: "PASS",
                      description: "List directory",
                      outputs: { stdout: "file1.txt\nfile2.txt", exitCode: 0 }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    
    const mockConfig = { logLevel: "info" };
    const outputPath = path.join(tempDir, "test-report.html");
    
    const result = await generateHtmlReport(mockResults, mockConfig, outputPath);
    
    assert.equal(result.status, "PASS");
    assert.equal(result.path, outputPath);
    assert.ok(fs.existsSync(outputPath));
    
    const htmlContent = fs.readFileSync(outputPath, "utf8");
    
    // Verify HTML structure
    assert.ok(htmlContent.includes("<!DOCTYPE html>"));
    assert.ok(htmlContent.includes("<title>Doc Detective Test Results</title>"));
    assert.ok(htmlContent.includes("Test Specification 1"));
    assert.ok(htmlContent.includes("Test Summary"));
    
    // Verify summary data
    assert.ok(htmlContent.includes("specs"));
    assert.ok(htmlContent.includes("tests"));
    assert.ok(htmlContent.includes("contexts"));
    assert.ok(htmlContent.includes("steps"));
    
    // Verify test details
    assert.ok(htmlContent.includes("test-spec-1"));
    assert.ok(htmlContent.includes("linux"));
    assert.ok(htmlContent.includes("firefox"));
    assert.ok(htmlContent.includes("Print hello world"));
  });
  
  it("Should handle empty results gracefully", async () => {
    const emptyResults = {
      summary: {
        specs: { pass: 0, fail: 0, warning: 0, skipped: 0 },
        tests: { pass: 0, fail: 0, warning: 0, skipped: 0 },
        contexts: { pass: 0, fail: 0, warning: 0, skipped: 0 },
        steps: { pass: 0, fail: 0, warning: 0, skipped: 0 }
      },
      specs: []
    };
    
    const mockConfig = { logLevel: "info" };
    const outputPath = path.join(tempDir, "empty-report.html");
    
    const result = await generateHtmlReport(emptyResults, mockConfig, outputPath);
    
    assert.equal(result.status, "PASS");
    assert.ok(fs.existsSync(outputPath));
    
    const htmlContent = fs.readFileSync(outputPath, "utf8");
    assert.ok(htmlContent.includes("No test specifications found"));
  });
  
  it("Should handle failed tests correctly", async () => {
    const failedResults = {
      summary: {
        specs: { pass: 0, fail: 1, warning: 0, skipped: 0 },
        tests: { pass: 0, fail: 1, warning: 0, skipped: 0 },
        contexts: { pass: 0, fail: 1, warning: 0, skipped: 0 },
        steps: { pass: 0, fail: 1, warning: 0, skipped: 0 }
      },
      specs: [
        {
          specId: "failed-spec",
          description: "Failed Spec",
          result: "FAIL",
          tests: [
            {
              testId: "failed-test",
              description: "Failed Test",
              result: "FAIL",
              contexts: [
                {
                  contextId: "context-1",
                  platform: "linux",
                  browser: "chrome",
                  result: "FAIL",
                  steps: [
                    {
                      runShell: "exit 1",
                      result: "FAIL",
                      description: "This step failed",
                      outputs: { stderr: "Command failed", exitCode: 1 }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    
    const mockConfig = { logLevel: "info" };
    const outputPath = path.join(tempDir, "failed-report.html");
    
    const result = await generateHtmlReport(failedResults, mockConfig, outputPath);
    
    assert.equal(result.status, "PASS");
    assert.ok(fs.existsSync(outputPath));
    
    const htmlContent = fs.readFileSync(outputPath, "utf8");
    assert.ok(htmlContent.includes("badge-fail"));
    assert.ok(htmlContent.includes("Failed Spec"));
    assert.ok(htmlContent.includes("This step failed"));
  });
  
  it("Should escape HTML special characters in content", async () => {
    const resultsWithSpecialChars = {
      summary: {
        specs: { pass: 1, fail: 0, warning: 0, skipped: 0 },
        tests: { pass: 1, fail: 0, warning: 0, skipped: 0 },
        contexts: { pass: 1, fail: 0, warning: 0, skipped: 0 },
        steps: { pass: 1, fail: 0, warning: 0, skipped: 0 }
      },
      specs: [
        {
          specId: "special-chars",
          description: "Test with <script>alert('XSS')</script> & \"quotes\"",
          result: "PASS",
          tests: [
            {
              testId: "test-1",
              description: "Test with special chars: < > & \" '",
              result: "PASS",
              contexts: [
                {
                  contextId: "context-1",
                  platform: "linux",
                  browser: "firefox",
                  result: "PASS",
                  steps: [
                    {
                      runShell: "echo '<tag>'",
                      result: "PASS",
                      description: "Echo HTML tags"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    
    const mockConfig = { logLevel: "info" };
    const outputPath = path.join(tempDir, "special-chars-report.html");
    
    const result = await generateHtmlReport(resultsWithSpecialChars, mockConfig, outputPath);
    
    assert.equal(result.status, "PASS");
    
    const htmlContent = fs.readFileSync(outputPath, "utf8");
    
    // Verify HTML escaping
    assert.ok(htmlContent.includes("&lt;script&gt;"));
    assert.ok(htmlContent.includes("&amp;"));
    assert.ok(htmlContent.includes("&quot;"));
    
    // Ensure the script tag is not executable
    assert.ok(!htmlContent.includes("<script>alert('XSS')</script>"));
  });
});
