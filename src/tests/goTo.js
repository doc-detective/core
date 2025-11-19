const { validate } = require("doc-detective-common");
const { isRelativeUrl } = require("../utils");
const { findElement } = require("./findElement");

exports.goTo = goTo;

// Open a URI in the browser
async function goTo({ config, step, driver }) {
  let result = { status: "PASS", description: "Opened URL." };

  // Resolve to object
  if (typeof step.goTo === "string") {
    step.goTo = { url: step.goTo };
  }

  // Set origin for relative URLs
  if (isRelativeUrl(step.goTo.url)) {
    if (!step.goTo.origin && !config.origin) {
      result.status = "FAIL";
      result.description =
        "Relative URL provided without origin. Specify an origin in either the step or the config.";
      return result;
    }
    step.goTo.origin = step.goTo.origin || config.origin;
    // If there isn't the necessary slash, add it
    if (!step.goTo.origin.endsWith("/") && !step.goTo.url.startsWith("/")) {
      step.goTo.origin += "/";
    }
    step.goTo.url = step.goTo.origin + step.goTo.url;
  }

  // Make sure there's a protocol
  if (step.goTo.url && !step.goTo.url.includes("://"))
    step.goTo.url = "https://" + step.goTo.url;

  // Validate step payload
  const isValidStep = validate({ schemaKey: "step_v3", object: step });
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Apply defaults if not specified
  step.goTo = {
    ...step.goTo,
    timeout: step.goTo.timeout || 30000,
    waitUntil: step.goTo.waitUntil || {
      networkIdleTime: 500,
      domIdleTime: 1000,
    },
  };
  // Fill in defaults for any missing properties
  if (step.goTo.waitUntil.networkIdleTime === undefined) {
    step.goTo.waitUntil.networkIdleTime = 500;
  }
  if (step.goTo.waitUntil.domIdleTime === undefined) {
    step.goTo.waitUntil.domIdleTime = 1000;
  }
  
  // Run action
  try {
    await driver.url(step.goTo.url);

    // Wait for page to load with wait logic
    const waitStartTime = Date.now();
    const waitTimeout = step.goTo.timeout;
    const waitConditions = {
      documentReady: false,
      networkIdle: step.goTo.waitUntil.networkIdleTime !== null,
      domStable: step.goTo.waitUntil.domIdleTime !== null,
      elementFound: !!step.goTo.waitUntil.find,
    };
    const waitResults = {
      documentReady: { passed: false, message: "" },
      networkIdle: { passed: false, message: "" },
      domStable: { passed: false, message: "" },
      elementFound: { passed: false, message: "" },
    };

    try {
      // 1. Wait for document ready
      await driver.waitUntil(
        async () => {
          const readyState = await driver.execute(() => {
            return document.readyState;
          });
          return readyState === "complete";
        },
        { timeout: waitTimeout }
      );
      waitResults.documentReady.passed = true;
      waitResults.documentReady.message = "Document ready";

      // Calculate remaining time
      const elapsedTime = Date.now() - waitStartTime;
      const remainingTimeout = waitTimeout - elapsedTime;

      if (remainingTimeout <= 0) {
        throw new Error("Timeout exceeded before document ready");
      }

      // 2 & 3. Wait for network idle and DOM stable in parallel
      const parallelChecks = [];

      if (
        waitConditions.networkIdle &&
        step.goTo.waitUntil.networkIdleTime !== null
      ) {
        parallelChecks.push(
          waitForNetworkIdle(
            driver,
            step.goTo.waitUntil.networkIdleTime,
            remainingTimeout
          )
            .then(() => {
              waitResults.networkIdle.passed = true;
              waitResults.networkIdle.message = `Network idle (${step.goTo.waitUntil.networkIdleTime}ms)`;
            })
            .catch((error) => {
              waitResults.networkIdle.message = `Network idle timeout: ${error.message}`;
              throw error;
            })
        );
      } else {
        waitResults.networkIdle.passed = true;
        waitResults.networkIdle.message = "Network idle check skipped (null)";
      }

      if (waitConditions.domStable && step.goTo.waitUntil.domIdleTime !== null) {
        parallelChecks.push(
          waitForDOMStable(driver, step.goTo.waitUntil.domIdleTime, remainingTimeout)
            .then(() => {
              waitResults.domStable.passed = true;
              waitResults.domStable.message = `DOM stable (${step.goTo.waitUntil.domIdleTime}ms)`;
            })
            .catch((error) => {
              waitResults.domStable.message = `DOM stability timeout: ${error.message}`;
              throw error;
            })
        );
      } else {
        waitResults.domStable.passed = true;
        waitResults.domStable.message = "DOM stability check skipped (null)";
      }

      // Wait for both checks to complete
      if (parallelChecks.length > 0) {
        await Promise.all(parallelChecks);
      }

      // Calculate remaining time for element search
      const elapsedTime3 = Date.now() - waitStartTime;
      const remainingTimeout3 = waitTimeout - elapsedTime3;

      if (remainingTimeout3 <= 0) {
        throw new Error("Timeout exceeded after DOM stability check");
      }

      // 4. Wait for element if specified
      if (waitConditions.elementFound && step.goTo.waitUntil.find) {
        try {
          // Construct a findElement step with the timeout
          const findStep = {
            action: "find",
            find: {
              ...step.goTo.waitUntil.find,
              timeout: remainingTimeout3
            }
          };
          
          const findResult = await findElement({ config, step: findStep, driver });
          
          if (findResult.status === "PASS") {
            waitResults.elementFound.passed = true;
            const selectorMsg = step.goTo.waitUntil.find.selector
              ? `selector: "${step.goTo.waitUntil.find.selector}"`
              : "";
            const textMsg = step.goTo.waitUntil.find.elementText
              ? `text: "${step.goTo.waitUntil.find.elementText}"`
              : "";
            const combinedMsg = [selectorMsg, textMsg]
              .filter((m) => m)
              .join(", ");
            waitResults.elementFound.message = `Element found (${combinedMsg})`;
          } else {
            throw new Error(findResult.description);
          }
        } catch (error) {
          const selectorMsg = step.goTo.waitUntil.find.selector
            ? `selector: "${step.goTo.waitUntil.find.selector}"`
            : "";
          const textMsg = step.goTo.waitUntil.find.elementText
            ? `text: "${step.goTo.waitUntil.find.elementText}"`
            : "";
          const combinedMsg = [selectorMsg, textMsg]
            .filter((m) => m)
            .join(", ");
          waitResults.elementFound.message = `Element not found (${combinedMsg})`;
          throw error;
        }
      } else {
        waitResults.elementFound.passed = true;
        waitResults.elementFound.message = "Element search not requested";
      }

      result.description = "Opened URL and all wait conditions met.";
    } catch (waitError) {
      // Detailed error reporting
      const totalElapsed = Date.now() - waitStartTime;
      let errorMessage = `goTo action timed out after ${totalElapsed}ms\n`;

      // Add status for each condition
      if (waitResults.documentReady.passed) {
        errorMessage += `✓ ${waitResults.documentReady.message}\n`;
      } else {
        errorMessage += `✗ Document not ready\n`;
      }

      if (waitConditions.networkIdle) {
        if (waitResults.networkIdle.passed) {
          errorMessage += `✓ ${waitResults.networkIdle.message}\n`;
        } else {
          errorMessage += `✗ ${waitResults.networkIdle.message}\n`;
        }
      }

      if (waitConditions.domStable) {
        if (waitResults.domStable.passed) {
          errorMessage += `✓ ${waitResults.domStable.message}\n`;
        } else {
          errorMessage += `✗ ${waitResults.domStable.message}\n`;
        }
      }

      if (waitConditions.elementFound) {
        if (waitResults.elementFound.passed) {
          errorMessage += `✓ ${waitResults.elementFound.message}\n`;
        } else {
          errorMessage += `✗ ${waitResults.elementFound.message}\n`;
        }
      }

      result.status = "FAIL";
      result.description = errorMessage.trim();
      return result;
    }
  } catch (error) {
    // FAIL: Error opening URL
    result.status = "FAIL";
    result.description = `Couldn't open URL: ${error.message}`;
    return result;
  }

  // PASS
  return result;
}

/**
 * Wait for network activity to be idle for a specified duration.
 * Uses a polling approach to check for network requests.
 */
async function waitForNetworkIdle(driver, idleTime, timeout) {
  const startTime = Date.now();
  let lastRequestTime = Date.now();
  let requestCount = 0;

  // Use WebDriverIO's execute to set up network monitoring
  await driver.execute((startTimeMs) => {
    if (!window.__docDetectiveNetworkMonitor) {
      window.__docDetectiveNetworkMonitor = {
        lastRequestTime: startTimeMs,
        requestCount: 0,
      };

      // Monitor fetch requests
      const originalFetch = window.fetch;
      window.fetch = function (...args) {
        window.__docDetectiveNetworkMonitor.lastRequestTime = Date.now();
        window.__docDetectiveNetworkMonitor.requestCount++;
        return originalFetch.apply(this, args);
      };

      // Monitor XHR requests
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (...args) {
        window.__docDetectiveNetworkMonitor.lastRequestTime = Date.now();
        window.__docDetectiveNetworkMonitor.requestCount++;
        return originalOpen.apply(this, args);
      };
    }
  }, Date.now());

  // Fast path: if no network activity detected for 100ms, skip
  await driver.pause(100);
  const monitorState = await driver.execute(() => {
    return (
      window.__docDetectiveNetworkMonitor || {
        lastRequestTime: Date.now(),
        requestCount: 0,
      }
    );
  });

  if (
    Date.now() - monitorState.lastRequestTime >= 100 &&
    monitorState.requestCount === 0
  ) {
    // No network activity detected, fast path
    return;
  }

  // Poll until network has been idle for the specified duration
  while (true) {
    if (Date.now() - startTime > timeout) {
      throw new Error("Network idle timeout exceeded");
    }

    const monitorState = await driver.execute(() => {
      return (
        window.__docDetectiveNetworkMonitor || { lastRequestTime: Date.now() }
      );
    });

    const idleFor = Date.now() - monitorState.lastRequestTime;
    if (idleFor >= idleTime) {
      // Network has been idle long enough
      break;
    }

    await driver.pause(100);
  }
}

/**
 * Wait for the DOM to stop mutating for a specified duration.
 * Uses MutationObserver to detect changes.
 */
async function waitForDOMStable(driver, idleTime, timeout) {
  try {
    await driver.execute(
      (idleMs, timeoutMs) => {
        return new Promise((resolve, reject) => {
          const startTime = Date.now();
          let lastMutationTime = Date.now();
          let mutationCount = 0;

          const observer = new MutationObserver(() => {
            lastMutationTime = Date.now();
            mutationCount++;
          });

          // Observe all changes to the body and its descendants
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });

          const checkInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const idleFor = Date.now() - lastMutationTime;

            if (idleFor >= idleMs) {
              clearInterval(checkInterval);
              observer.disconnect();
              resolve({ mutationCount, elapsed });
            } else if (elapsed >= timeoutMs) {
              clearInterval(checkInterval);
              observer.disconnect();
              reject(
                new Error(
                  `Still mutating (${mutationCount} mutations in last ${idleMs}ms)`
                )
              );
            }
          }, 100);
        });
      },
      idleTime,
      timeout
    );
  } catch (error) {
    throw new Error(`DOM stability check failed: ${error.message}`);
  }
}
