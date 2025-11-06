exports.findElementBySelectorAndText =
  findElementBySelectorAndText;
exports.findElementBySelectorOrText =
  findElementBySelectorOrText;
exports.findElementByCriteria = findElementByCriteria;

// Set element outputs
exports.setElementOutputs = setElementOutputs;

async function setElementOutputs({ element }) {
  // Set element in outputs
  const outputs = { element: {}, rawElement: element };

  const [
    text, html, tag, value, location, size,
    clickable, enabled, selected, displayed, inViewport,
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
    element.isDisplayedInViewport(),
  ]).then(results =>
    results.map(r => (r.status === 'fulfilled' ? r.value : null))
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
    displayedInViewport: inViewport,
  });

  return outputs;
}

async function findElementByRegex({ pattern, timeout, driver }) {
  await driver.pause(timeout);
  // Find an element based on a regex pattern
  const elements = await driver.$$("//*[normalize-space(text())]");
  for (const element of elements) {
    const text = await element.getText();
    if (text.match(pattern)) {
      return { element, foundBy: "regex" };
    }
  }
  return { element: null, foundBy: null };
}

async function findElementBySelectorOrText({ string, driver }) {
  // Find an element based on a string that could either be a selector or element text
  const timeout = 5000;

  // If regex, find element by regex
  if (string.startsWith("/") && string.endsWith("/")) {
    const pattern = new RegExp(string.slice(1, -1));
    const result = await findElementByRegex({
      pattern,
      timeout,
      driver,
    });
    return result;
  }

  // Perform searches for both concurrently
  // Prefer a selector match over a text match
  const selectorPromise = driver.$(string).then(async (el) => {
    await el.waitForExist({ timeout });
    return el;
  });
  const textPromise = driver.$(`//*[normalize-space(text())="${string}"]`).then(async (el) => {
    await el.waitForExist({ timeout });
    return el;
  });
  // Wait for both promises to resolve

  const results = await Promise.allSettled([selectorPromise, textPromise]);

  const selectorResult =
    results[0].status === "fulfilled" ? results[0].value : null;
  const textResult =
    results[1].status === "fulfilled" ? results[1].value : null;

  let result;
  // Check if selectorResult is a valid element
  if (selectorResult && selectorResult.elementId) {
    result = { element: selectorResult, foundBy: "selector" };
    return result;
  }
  // Check if textResult is a valid element
  if (textResult && textResult.elementId) {
    result = { element: textResult, foundBy: "text" };
    return result;
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
  if (!selector && !text) {
    return { element: null, foundBy: null }; // No selector or text
  }
  // Wait  timeout milliseconds
  await driver.pause(timeout);
  // Find an element based on a selector and text
  // Elements must match both selector and text
  let elements = await driver.$$(selector);
  elements = await elements.filter(async (el) => {
    const elementText = await el.getText();
    if (!(elementText && el.elementId)) {
      return false;
    }
    // If text is a regex, match against it
    if (text.startsWith("/") && text.endsWith("/")) {
      const pattern = new RegExp(text.slice(1, -1));
      return pattern.test(elementText);
    }
    // If text is a string, match against it
    return elementText === text;
  });
  if (elements.length === 0) {
    return { element: null, foundBy: null }; // No matching elements
  }
  // If multiple elements match, return the first one
  element = elements[0];
  return { element, foundBy: "selector and text" };
}

// Helper function to check if a string is a regex pattern
function isRegexPattern(str) {
  return typeof str === 'string' && str.startsWith('/') && str.endsWith('/');
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
  const classList = await element.getAttribute('class');
  if (!classList) return false;
  
  const elementClasses = classList.split(/\s+/).filter(c => c.length > 0);
  
  for (const requiredClass of classes) {
    let found = false;
    if (isRegexPattern(requiredClass)) {
      const regex = new RegExp(requiredClass.slice(1, -1));
      found = elementClasses.some(c => regex.test(c));
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
    
    if (typeof attrValue === 'boolean') {
      // Boolean: true means attribute exists, false means it doesn't
      const hasAttribute = elementAttrValue !== null;
      if (hasAttribute !== attrValue) return false;
    } else if (typeof attrValue === 'number') {
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
  elementAltText,
  timeout = 5000,
  driver,
}) {
  // Validate at least one criterion is provided
  if (!selector && !elementText && !elementId && !elementTestId && 
      !elementClass && !elementAttribute && !elementAltText) {
    return { 
      element: null, 
      foundBy: null,
      error: 'At least one element finding criterion must be specified'
    };
  }

  const startTime = Date.now();
  const pollingInterval = 100; // Check every 100ms
  
  // Poll for elements until timeout
  while (Date.now() - startTime < timeout) {
    let candidates;
    const criteriaUsed = [];

    try {
      if (elementId) {
        // ID is typically unique, start with this
        const idPattern = isRegexPattern(elementId) 
          ? new RegExp(elementId.slice(1, -1))
          : null;
        
        if (idPattern) {
          // For regex ID, we need to get all elements and filter
          candidates = await driver.$$('//*[@id]');
          const filtered = [];
          for (const el of candidates) {
            const id = await el.getAttribute('id');
            if (id && idPattern.test(id)) {
              filtered.push(el);
            }
          }
          candidates = filtered;
        } else {
          // Exact ID match - use XPath which is more reliable than CSS for IDs with special chars
          candidates = await driver.$$(`//*[@id="${elementId}"]`);
        }
        criteriaUsed.push('elementId');
      } else if (selector) {
        candidates = await driver.$$(selector);
        criteriaUsed.push('selector');
      } else if (elementTestId) {
        // Test ID as starting point
        const testIdPattern = isRegexPattern(elementTestId)
          ? new RegExp(elementTestId.slice(1, -1))
          : null;
        
        if (testIdPattern) {
          candidates = await driver.$$('//*[@data-testid]');
          const filtered = [];
          for (const el of candidates) {
            const testId = await el.getAttribute('data-testid');
            if (testId && testIdPattern.test(testId)) {
              filtered.push(el);
            }
          }
          candidates = filtered;
        } else {
          candidates = await driver.$$(`//*[@data-testid="${elementTestId}"]`);
        }
        criteriaUsed.push('elementTestId');
      } else {
        // No specific selector, get all elements
        candidates = await driver.$$('//*');
      }

      // Filter candidates by all criteria
      const matchedElements = [];
      
      for (const element of candidates) {
        // Check if element is valid and exists in DOM
        try {
          await element.getTagName(); // This will throw if element doesn't exist
        } catch {
          continue; // Element doesn't exist, skip it
        }

        let matches = true;

        // Check elementText
        if (elementText && matches) {
          const text = await element.getText();
          if (!text || !matchesPattern(text, elementText)) {
            matches = false;
          } else {
            if (!criteriaUsed.includes('elementText')) criteriaUsed.push('elementText');
          }
        }

        // Check elementId (if not already used for initial selection)
        if (elementId && !criteriaUsed.includes('elementId') && matches) {
          const id = await element.getAttribute('id');
          if (!id || !matchesPattern(id, elementId)) {
            matches = false;
          } else {
            criteriaUsed.push('elementId');
          }
        }

        // Check elementTestId (if not already used)
        if (elementTestId && !criteriaUsed.includes('elementTestId') && matches) {
          const testId = await element.getAttribute('data-testid');
          if (!testId || !matchesPattern(testId, elementTestId)) {
            matches = false;
          } else {
            criteriaUsed.push('elementTestId');
          }
        }

        // Check elementClass
        if (elementClass && matches) {
          const classes = Array.isArray(elementClass) ? elementClass : [elementClass];
          if (classes.length > 0) {
            const hasClasses = await hasAllClasses(element, classes);
            if (!hasClasses) {
              matches = false;
            } else {
              if (!criteriaUsed.includes('elementClass')) criteriaUsed.push('elementClass');
            }
          }
        }

        // Check elementAttribute
        if (elementAttribute && matches) {
          const matchesAttrs = await matchesAttributes(element, elementAttribute);
          if (!matchesAttrs) {
            matches = false;
          } else {
            if (!criteriaUsed.includes('elementAttribute')) criteriaUsed.push('elementAttribute');
          }
        }

        // Check elementAltText
        if (elementAltText && matches) {
          const altText = await element.getAttribute('alt');
          if (!altText || !matchesPattern(altText, elementAltText)) {
            matches = false;
          } else {
            if (!criteriaUsed.includes('elementAltText')) criteriaUsed.push('elementAltText');
          }
        }

        if (matches) {
          matchedElements.push(element);
        }
      }

      if (matchedElements.length > 0) {
        // Return first matching element
        return { 
          element: matchedElements[0], 
          foundBy: criteriaUsed.join(' and ')
        };
      }
    } catch (error) {
      // Continue polling on errors
    }

    // Wait before next poll
    if (Date.now() - startTime < timeout) {
      await driver.pause(pollingInterval);
    }
  }

  // Timeout reached with no matches
  const criteriaList = [];
  if (selector) criteriaList.push('selector');
  if (elementText) criteriaList.push('elementText');
  if (elementId) criteriaList.push('elementId');
  if (elementTestId) criteriaList.push('elementTestId');
  if (elementClass) criteriaList.push('elementClass');
  if (elementAttribute) criteriaList.push('elementAttribute');
  if (elementAltText) criteriaList.push('elementAltText');
  
  return { 
    element: null, 
    foundBy: null,
    error: `No element found matching all specified criteria: ${criteriaList.join(', ')}`
  };
}