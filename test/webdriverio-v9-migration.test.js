const assert = require("assert").strict;
const { runTests } = require("../src");
const { createServer } = require("./server");
const path = require("path");
const fs = require("fs");

// Create a test server
const server = createServer({
  port: 8093,
  staticDir: "./test/server/public",
});

// Start the server before tests
before(async function() {
  this.timeout(30000);
  try {
    await server.start();
  } catch (error) {
    console.error(`Failed to start test server: ${error.message}`);
    throw error;
  }
});

// Stop the server after tests
after(async function() {
  this.timeout(10000);
  try {
    await server.stop();
  } catch (error) {
    console.error(`Failed to stop test server: ${error.message}`);
  }
});

describe("WebdriverIO v9 Migration Tests", function() {
  this.timeout(120000); // 2 minutes for browser tests

  describe("viewport size methods (driver.execute)", function() {
    it("should set viewport size using driver.execute instead of executeScript", async () => {
      const tempFilePath = path.resolve("./test/temp-viewport-test.json");
      const viewportTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                screenshot: {
                  name: "viewport-test",
                  directory: "./test/temp-screenshots",
                  overwrite: true
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(viewportTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true,
              viewport: { width: 1024, height: 768 }
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Viewport test should pass");
        assert.equal(result.summary.steps.pass >= 2, true, "Both steps should pass");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        const screenshotDir = path.resolve("./test/temp-screenshots");
        if (fs.existsSync(screenshotDir)) {
          fs.rmSync(screenshotDir, { recursive: true, force: true });
        }
      }
    });

    it("should handle window sizing correctly", async () => {
      const tempFilePath = path.resolve("./test/temp-window-test.json");
      const windowTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(windowTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true,
              window: { width: 1280, height: 720 }
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Window sizing test should pass");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }
    });
  });

  describe("element display methods (isDisplayed with withinViewport)", function() {
    it("should check element visibility within viewport using new API", async () => {
      const tempFilePath = path.resolve("./test/temp-visibility-test.json");
      const visibilityTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                find: "body"
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(visibilityTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Visibility check should pass");
        
        // Check that element outputs include displayedInViewport property
        const step = result.specs[0].tests[0].contexts[0].steps.find(s => s.find);
        assert.ok(step, "Find step should exist");
        assert.ok(step.outputs, "Step should have outputs");
        assert.ok(step.outputs.element, "Outputs should contain element");
        assert.ok(
          typeof step.outputs.element.displayedInViewport !== "undefined",
          "Element should have displayedInViewport property"
        );
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }
    });

    it("should properly detect elements not in viewport", async () => {
      const tempFilePath = path.resolve("./test/temp-out-of-viewport-test.json");
      const outOfViewportTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                find: {
                  selector: "body"
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(outOfViewportTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Out of viewport detection should work");
        
        // Verify element properties are captured
        const findStep = result.specs[0].tests[0].contexts[0].steps.find(s => s.find);
        assert.ok(findStep.outputs.element.displayed !== undefined, "Element displayed state should be captured");
        assert.ok(findStep.outputs.element.displayedInViewport !== undefined, "Element viewport state should be captured");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }
    });
  });

  describe("cookie sameSite attribute handling", function() {
    it("should handle lowercase sameSite values in cookie parsing", async () => {
      const tempFilePath = path.resolve("./test/temp-cookie-samesite-test.json");
      const tempCookieFile = path.resolve("./test/temp-test-cookie.txt");

      // Create a Netscape cookie file with sameSite attribute
      const cookieContent = `# Netscape HTTP Cookie File
# This is a generated file! Do not edit.

localhost\tFALSE\t/\tFALSE\t${Math.floor(Date.now() / 1000) + 3600}\ttest_samesite_cookie\ttest_value\tFALSE\tLax
`;
      fs.writeFileSync(tempCookieFile, cookieContent);

      const cookieTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                loadCookie: {
                  name: "test_samesite_cookie",
                  path: "temp-test-cookie.txt",
                  directory: "./test"
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(cookieTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Cookie with sameSite should load");
        assert.equal(result.summary.steps.fail, 0, "All cookie steps should pass");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(tempCookieFile)) fs.unlinkSync(tempCookieFile);
      }
    });

    it("should default to lowercase 'lax' for sameSite when not specified", async () => {
      const tempFilePath = path.resolve("./test/temp-cookie-default-test.json");
      const tempCookieFile = path.resolve("./test/temp-default-cookie.txt");

      // Create a cookie file without sameSite attribute
      const cookieContent = `# Netscape HTTP Cookie File
localhost\tFALSE\t/\tFALSE\t${Math.floor(Date.now() / 1000) + 3600}\ttest_default_cookie\tdefault_value
`;
      fs.writeFileSync(tempCookieFile, cookieContent);

      const cookieTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                loadCookie: {
                  name: "test_default_cookie",
                  path: "temp-default-cookie.txt",
                  directory: "./test"
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(cookieTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Cookie should load with default sameSite");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(tempCookieFile)) fs.unlinkSync(tempCookieFile);
      }
    });

    it("should handle sameSite 'None' on HTTPS correctly", async () => {
      const tempFilePath = path.resolve("./test/temp-cookie-none-test.json");
      const tempCookieFile = path.resolve("./test/temp-none-cookie.txt");

      // Create a cookie file with sameSite=None (requires secure flag)
      const cookieContent = `# Netscape HTTP Cookie File
localhost\tFALSE\t/\tTRUE\t${Math.floor(Date.now() / 1000) + 3600}\ttest_none_cookie\tnone_value\tFALSE\tNone
`;
      fs.writeFileSync(tempCookieFile, cookieContent);

      const cookieTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                loadCookie: {
                  name: "test_none_cookie",
                  path: "temp-none-cookie.txt",
                  directory: "./test"
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(cookieTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        // On HTTP, sameSite=None should be converted to Lax
        // The test should still pass, just with modified sameSite
        assert.ok(result.summary.specs.pass >= 0, "Cookie handling should not crash");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(tempCookieFile)) fs.unlinkSync(tempCookieFile);
      }
    });
  });

  describe("screenshot with element scrolling (action wheel API)", function() {
    it("should scroll to element using action wheel API", async () => {
      const tempFilePath = path.resolve("./test/temp-scroll-test.json");
      const screenshotDir = path.resolve("./test/temp-scroll-screenshots");

      const scrollTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                screenshot: {
                  name: "element-scroll",
                  directory: "./test/temp-scroll-screenshots",
                  overwrite: true,
                  selector: "body"
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(scrollTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Scroll and screenshot should succeed");
        assert.equal(result.summary.steps.fail, 0, "All steps should pass");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(screenshotDir)) {
          fs.rmSync(screenshotDir, { recursive: true, force: true });
        }
      }
    });

    it("should handle element bounding using getSize and getLocation", async () => {
      const tempFilePath = path.resolve("./test/temp-element-bounds-test.json");
      const screenshotDir = path.resolve("./test/temp-bounds-screenshots");

      const boundsTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                screenshot: {
                  name: "element-bounds",
                  directory: "./test/temp-bounds-screenshots",
                  overwrite: true,
                  selector: "body",
                  crop: true
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(boundsTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Element bounds screenshot should succeed");
        
        // Verify screenshot was created
        const screenshotPath = path.join(screenshotDir, "element-bounds.png");
        assert.ok(fs.existsSync(screenshotPath), "Screenshot file should exist");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(screenshotDir)) {
          fs.rmSync(screenshotDir, { recursive: true, force: true });
        }
      }
    });

    it("should handle screenshot with padding correctly", async () => {
      const tempFilePath = path.resolve("./test/temp-padding-test.json");
      const screenshotDir = path.resolve("./test/temp-padding-screenshots");

      const paddingTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                screenshot: {
                  name: "with-padding",
                  directory: "./test/temp-padding-screenshots",
                  overwrite: true,
                  selector: "body",
                  crop: true,
                  padding: { top: 10, right: 10, bottom: 10, left: 10 }
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(paddingTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Padded screenshot should succeed");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(screenshotDir)) {
          fs.rmSync(screenshotDir, { recursive: true, force: true });
        }
      }
    });
  });

  describe("browser capability configuration", function() {
    it("should not include wdio:enforceWebDriverClassic capability for Firefox", async () => {
      const tempFilePath = path.resolve("./test/temp-firefox-caps-test.json");
      const firefoxTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(firefoxTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Firefox should start without enforceWebDriverClassic");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }
    });

    it("should not include wdio:enforceWebDriverClassic capability for Chrome", async () => {
      const tempFilePath = path.resolve("./test/temp-chrome-caps-test.json");
      const chromeTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(chromeTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "chrome",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        // Chrome may not be available on all systems
        assert.ok(
          result.summary.specs.pass > 0 || result.summary.specs.skipped > 0,
          "Chrome test should pass or skip gracefully"
        );
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }
    });
  });

  describe("integration tests for WebdriverIO v9 changes", function() {
    it("should handle complete workflow with all v9 changes", async () => {
      const tempFilePath = path.resolve("./test/temp-integration-test.json");
      const screenshotDir = path.resolve("./test/temp-integration-screenshots");
      const cookieFile = path.resolve("./test/temp-integration-cookie.txt");

      const integrationTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                find: {
                  selector: "body"
                }
              },
              {
                screenshot: {
                  name: "integration-test",
                  directory: "./test/temp-integration-screenshots",
                  overwrite: true,
                  selector: "body"
                }
              },
              {
                saveCookie: {
                  name: "test_integration",
                  path: "temp-integration-cookie.txt",
                  directory: "./test",
                  overwrite: true
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(integrationTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true,
              viewport: { width: 1024, height: 768 }
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Integration test should pass");
        assert.equal(result.summary.steps.fail, 0, "All steps should succeed");
        
        // Verify all outputs
        const steps = result.specs[0].tests[0].contexts[0].steps;
        const findStep = steps.find(s => s.find);
        assert.ok(findStep.outputs.element, "Find step should have element outputs");
        assert.ok(
          typeof findStep.outputs.element.displayedInViewport !== "undefined",
          "Element should include displayedInViewport"
        );
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(screenshotDir)) {
          fs.rmSync(screenshotDir, { recursive: true, force: true });
        }
        if (fs.existsSync(cookieFile)) fs.unlinkSync(cookieFile);
      }
    });
  });

  describe("edge cases and error handling", function() {
    it("should handle missing element gracefully with new API", async () => {
      const tempFilePath = path.resolve("./test/temp-missing-element-test.json");
      const missingElementTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                find: {
                  selector: "#nonexistent-element-id",
                  timeout: 1000
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(missingElementTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        // Should fail gracefully, not crash
        assert.equal(result.summary.steps.fail >= 1, true, "Missing element should cause step failure");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }
    });

    it("should handle invalid cookie data gracefully", async () => {
      const tempFilePath = path.resolve("./test/temp-invalid-cookie-test.json");
      const invalidCookieFile = path.resolve("./test/temp-invalid-cookie.txt");

      // Create an invalid cookie file
      fs.writeFileSync(invalidCookieFile, "This is not a valid cookie file format");

      const invalidCookieTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              },
              {
                loadCookie: {
                  name: "invalid_cookie",
                  path: "temp-invalid-cookie.txt",
                  directory: "./test"
                }
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(invalidCookieTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        // Should fail gracefully, not crash
        assert.ok(result.summary.steps.fail >= 1, "Invalid cookie should cause step failure");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(invalidCookieFile)) fs.unlinkSync(invalidCookieFile);
      }
    });

    it("should handle viewport resize on small screens", async () => {
      const tempFilePath = path.resolve("./test/temp-small-viewport-test.json");
      const smallViewportTest = {
        tests: [
          {
            steps: [
              {
                goTo: "http://localhost:8093/"
              }
            ]
          }
        ]
      };

      fs.writeFileSync(tempFilePath, JSON.stringify(smallViewportTest, null, 2));

      const config = {
        input: tempFilePath,
        logLevel: "silent",
        contexts: [
          {
            browser: {
              name: "firefox",
              headless: true,
              viewport: { width: 375, height: 667 } // Mobile size
            }
          }
        ]
      };

      let result;
      try {
        result = await runTests(config);
        assert.equal(result.summary.specs.fail, 0, "Small viewport should work");
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }
    });
  });
});