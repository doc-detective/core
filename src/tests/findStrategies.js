exports.findElementBySelectorAndText = findElementBySelectorAndText;
exports.findElementByShorthand = findElementByShorthand;
exports.findElementByCriteria = findElementByCriteria;

// Set element outputs
exports.setElementOutputs = setElementOutputs;

async function setElementOutputs({ element }) {
  // Set element in outputs
  const outputs = { element: {}, rawElement: element };

  const [
    text,
    html,
    tag,
    value,
    location,
    size,
    clickable,
    enabled,
    selected,
    displayed,
    displayedInViewport,
  ] = await Promise.allSettled([
    element.getText(),
    element.getHTML(),
    element.getTagName(),
    element.getValue(),
    element.getLocation(),
    element.getSize(),
    element.isClickable(),
    element.isEnabled(),
    element.isSelected(),
    element.isDisplayed(),
    element.isDisplayed({ withinViewport: true }),
  ]).then((results) =>
    results.map((r) => (r.status === "fulfilled" ? r.value : null))
  );

  Object.assign(outputs.element, {
    text,
    html,
    tag,
    value,
    location,
    size,
    clickable,
    enabled,
    selected,
    displayed,
    displayedInViewport,
  });

  return outputs;
}

async function findElementByRegex({ pattern, timeout, driver }) {
  await driver.pause(timeout);
  // Find an element based on a regex pattern in text
  const elements = await driver.$$("//*[normalize-space(text())]");
  for (const element of elements) {
    const text = await element.getText();
    if (text.match(pattern)) {
      return { element, foundBy: "regex" };
    }
  }
  return { element: null, foundBy: null };
}

async function findElementByAriaRegex({ pattern, timeout, driver }) {
  await driver.pause(timeout);
  // Find an element based on a regex pattern in accessible name
  // WebDriverIO's aria selector uses accessible name
  const elements = await driver.$$("//*");
  for (const element of elements) {
    try {
      // Try to get accessible name - this is an approximation
      // WebDriverIO's aria selector is better but we need to check all elements
      const ariaLabel = await element.getAttribute("aria-label");
      if (ariaLabel && ariaLabel.match(pattern)) {
        return { element, foundBy: "elementAria" };
      }
      // Also check text content as fallback
      const text = await element.getText();
      if (text && text.match(pattern)) {
        return { element, foundBy: "elementAria" };
      }
    } catch {
      continue;
    }
  }
  return { element: null, foundBy: null };
}

async function findElementByIdRegex({ pattern, timeout, driver }) {
  await driver.pause(timeout);
  // Find an element based on a regex pattern in id attribute
  const elements = await driver.$$("//*[@id]");
  for (const element of elements) {
    const id = await element.getAttribute("id");
    if (id && id.match(pattern)) {
      return { element, foundBy: "elementId" };
    }
  }
  return { element: null, foundBy: null };
}

async function findElementByTestIdRegex({ pattern, timeout, driver }) {
  await driver.pause(timeout);
  // Find an element based on a regex pattern in data-testid attribute
  const elements = await driver.$$("//*[@data-testid]");
  for (const element of elements) {
    const testId = await element.getAttribute("data-testid");
    if (testId && testId.match(pattern)) {
      return { element, foundBy: "elementTestId" };
    }
  }
  return { element: null, foundBy: null };
}

async function findElementByShorthand({ string, driver }) {
  // Find an element based on a string that could be a selector, text, aria label, id, or test id
  // Uses parallel search with precedence: selector > elementText > elementAria > elementId > elementTestId
  const timeout = 5000;

  // If regex, find element by regex across all attribute types
  if (string.startsWith("/") && string.endsWith("/")) {
    const pattern = new RegExp(string.slice(1, -1));

    // Perform parallel searches for regex pattern
    const searches = [
      {
        type: "selector",
        promise: findElementByRegex({ pattern, timeout, driver }),
      },
      {
        type: "elementText",
        promise: findElementByRegex({ pattern, timeout, driver }),
      },
      {
        type: "elementAria",
        promise: findElementByAriaRegex({ pattern, timeout, driver }),
      },
      {
        type: "elementId",
        promise: findElementByIdRegex({ pattern, timeout, driver }),
      },
      {
        type: "elementTestId",
        promise: findElementByTestIdRegex({ pattern, timeout, driver }),
      },
    ];

    const results = await Promise.allSettled(searches.map((s) => s.promise));

    // Apply precedence order
    for (let i = 0; i < searches.length; i++) {
      if (results[i].status === "fulfilled" && results[i].value.element) {
        return { element: results[i].value.element, foundBy: searches[i].type };
      }
    }

    return { element: null, foundBy: null };
  }

  // Perform parallel searches for exact match across all five attribute types
  const selectorPromise = driver
    .$(string)
    .then(async (el) => {
      await el.waitForExist({ timeout });
      return el;
    })
    .catch(() => null);

  const textPromise = driver
    .$(`//*[normalize-space(text())="${string}"]`)
    .then(async (el) => {
      await el.waitForExist({ timeout });
      return el;
    })
    .catch(() => null);

  const ariaPromise = driver
    .$(`aria/${string}`)
    .then(async (el) => {
      await el.waitForExist({ timeout });
      return el;
    })
    .catch(() => null);

  const idPromise = driver
    .$(`//*[@id="${string}"]`)
    .then(async (el) => {
      await el.waitForExist({ timeout });
      return el;
    })
    .catch(() => null);

  const testIdPromise = driver
    .$(`//*[@data-testid="${string}"]`)
    .then(async (el) => {
      await el.waitForExist({ timeout });
      return el;
    })
    .catch(() => null);

  // Wait for all promises to resolve
  const results = await Promise.allSettled([
    selectorPromise,
    textPromise,
    ariaPromise,
    idPromise,
    testIdPromise,
  ]);

  // Extract results
  const selectorResult =
    results[0].status === "fulfilled" ? results[0].value : null;
  const textResult =
    results[1].status === "fulfilled" ? results[1].value : null;
  const ariaResult =
    results[2].status === "fulfilled" ? results[2].value : null;
  const idResult = results[3].status === "fulfilled" ? results[3].value : null;
  const testIdResult =
    results[4].status === "fulfilled" ? results[4].value : null;

  // Apply precedence order: selector > elementText > elementAria > elementId > elementTestId
  if (selectorResult && selectorResult.elementId) {
    return { element: selectorResult, foundBy: "selector" };
  }
  if (textResult && textResult.elementId) {
    return { element: textResult, foundBy: "elementText" };
  }
  if (ariaResult && ariaResult.elementId) {
    return { element: ariaResult, foundBy: "elementAria" };
  }
  if (idResult && idResult.elementId) {
    return { element: idResult, foundBy: "elementId" };
  }
  if (testIdResult && testIdResult.elementId) {
    return { element: testIdResult, foundBy: "elementTestId" };
  }

  // No matching elements
  return { element: null, foundBy: null };
}

async function findElementBySelectorAndText({
  selector,
  text,
  timeout,
  driver,
}) {
  let element;
  let elements = [];
  if (!selector || !text) {
    return { element: null, foundBy: null }; // No selector or text
  }
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const candidates = await driver.$$(selector);
    elements = [];
    for (const el of candidates) {
      const elementText = await el.getText();
      if (!elementText) {
        continue;
      }
      if (text.startsWith("/") && text.endsWith("/")) {
        const pattern = new RegExp(text.slice(1, -1));
        if (!pattern.test(elementText)) {
          continue;
        }
      } else if (elementText !== text) {
        continue;
      }
      elements.push(el);
    }
    if (elements.length > 0) {
      break;
    }
    // Wait 100ms before trying again
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (elements.length === 0) {
    return { element: null, foundBy: null }; // No matching elements
  }
  // If multiple elements match, return the first one
  element = elements[0];
  return { element, foundBy: "selector and text" };
}

// Helper function to check if a string is a regex pattern
function isRegexPattern(str) {
  return typeof str === "string" && str.startsWith("/") && str.endsWith("/");
}

// Helper function to match a value against a pattern (string or regex)
function matchesPattern(value, pattern) {
  if (isRegexPattern(pattern)) {
    const regex = new RegExp(pattern.slice(1, -1));
    return regex.test(String(value));
  }
  return String(value) === String(pattern);
}

// Helper function to check if element has all required classes
async function hasAllClasses(element, classes) {
  const classList = await element.getAttribute("class");
  if (!classList) return false;

  const elementClasses = classList.split(/\s+/).filter((c) => c.length > 0);

  for (const requiredClass of classes) {
    let found = false;
    if (isRegexPattern(requiredClass)) {
      const regex = new RegExp(requiredClass.slice(1, -1));
      found = elementClasses.some((c) => regex.test(c));
    } else {
      found = elementClasses.includes(requiredClass);
    }
    if (!found) return false;
  }

  return true;
}

// Helper function to check if element matches attribute criteria
async function matchesAttributes(element, attributes) {
  for (const [attrName, attrValue] of Object.entries(attributes)) {
    const elementAttrValue = await element.getAttribute(attrName);

    if (typeof attrValue === "boolean") {
      // Boolean: true means attribute exists (regardless of value), false means it doesn't
      // Special handling for disabled: disabled="false" as string still means disabled in HTML,
      // but we check actual element state for disabled attribute
      if (attrName === "disabled") {
        const isDisabled = await element
          .isEnabled()
          .then((enabled) => !enabled);
        if (isDisabled !== attrValue) return false;
      } else {
        const hasAttribute = elementAttrValue !== null;
        if (hasAttribute !== attrValue) return false;
      }
    } else if (typeof attrValue === "number") {
      // Number: exact match
      if (elementAttrValue === null || Number(elementAttrValue) !== attrValue) {
        return false;
      }
    } else {
      // String: exact match or regex
      if (elementAttrValue === null) return false;
      if (!matchesPattern(elementAttrValue, attrValue)) return false;
    }
  }

  return true;
}

// Find element by multiple criteria with AND logic
async function findElementByCriteria({
  selector,
  elementText,
  elementId,
  elementTestId,
  elementClass,
  elementAttribute,
  elementAria,
  timeout = 5000,
  driver,
}) {
  // Validate at least one criterion is provided
  if (
    !selector &&
    !elementText &&
    !elementId &&
    !elementTestId &&
    !elementClass &&
    !elementAttribute &&
    !elementAria
  ) {
    return {
      element: null,
      foundBy: null,
      error: "At least one element finding criterion must be specified",
    };
  }

  const startTime = Date.now();
  const pollingInterval = 100; // Check every 100ms

  // Poll for elements until timeout
  while (Date.now() - startTime < timeout) {
    let candidates = [];
    let criteriaUsed = [];

    try {
      // Initial candidate selection based on most specific criteria
      if (selector) {
        // Start with selector if provided
        candidates = await driver.$$(selector);
        criteriaUsed.push("selector");
      } else {
        candidates = await driver.$$("//*");
      }

      // Filter candidates by all criteria
      const matchedElements = candidates.map(async (element) => {
        // Check if element is valid and exists in DOM
        try {
          await element.isExisting(); // This will throw if element doesn't exist
        } catch {
          return null; // Element doesn't exist, skip it
        }

        // Check elementText
        if (elementText) {
          const text = await element.getText();
          if (!text || !matchesPattern(text, elementText)) {
            return null;
          }
          criteriaUsed.push("elementText");
        }

        // Check elementAria
        if (elementAria) {
          // Try to match using aria selector
          const ariaLabel = await element.getComputedLabel();
          if (!ariaLabel || !matchesPattern(ariaLabel, elementAria)) {
            return null;
          }
          criteriaUsed.push("elementAria");
        }

        // Check elementId
        if (elementId) {
          const id = await element.getAttribute("id");
          if (!id || !matchesPattern(id, elementId)) {
            return null;
          }
          criteriaUsed.push("elementId");
        }

        // Check elementTestId
        if (elementTestId) {
          const testId = await element.getAttribute("data-testid");
          if (!testId || !matchesPattern(testId, elementTestId)) {
            return null;
          }
          criteriaUsed.push("elementTestId");
        }

        // Check elementClass
        if (elementClass) {
          const hasClass = await hasAllClasses(element, elementClass);
          if (!hasClass) {
            return null;
          }
          criteriaUsed.push("elementClass");
        }

        // Check elementAttribute
        if (elementAttribute) {
          const matches = await matchesAttributes(element, elementAttribute);
          if (!matches) {
            return null;
          }
          criteriaUsed.push("elementAttribute");
        }

        // If we reach here, the element matches all criteria
        return element;
      });

      // Wait for all element checks to complete
      const results = await Promise.all(matchedElements);
      candidates = results.filter((el) => el !== null);
    } catch (error) {
      console.error("Error finding elements:", error);
    }

    // If we found matching elements, return the first one
    if (candidates.length > 0) {
      return {
        element: candidates[0],
        foundBy: criteriaUsed,
        error: null,
      };
    }

    // No matching elements found, wait before retrying
    await new Promise((resolve) => setTimeout(resolve, pollingInterval));
  }

  // Timeout reached, return error
  return {
    element: null,
    foundBy: null,
    error: "Element not found within timeout",
  };
}
