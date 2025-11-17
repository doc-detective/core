exports.findElementBySelectorAndText = findElementBySelectorAndText;
exports.findElementBySelectorOrText = findElementBySelectorOrText;
exports.findElementByCriteria = findElementByCriteria;

// Set element outputs
exports.setElementOutputs = setElementOutputs;

async function setElementOutputs({ element }) {
  // Set element in outputs
  const outputs = { element: {}, rawElement: element };

  const [
    text, html, tag, value, location, size,
    clickable, enabled, selected, displayed, displayedInViewport,
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
    element.isDisplayed({withinViewport: true}),
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
      const ariaLabel = await element.getAttribute('aria-label');
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
    const id = await element.getAttribute('id');
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
    const testId = await element.getAttribute('data-testid');
    if (testId && testId.match(pattern)) {
      return { element, foundBy: "elementTestId" };
    }
  }
  return { element: null, foundBy: null };
}


async function findElementBySelectorOrText({ string, driver }) {
  // Find an element based on a string that could be a selector, text, aria label, id, or test id
  // Uses parallel search with precedence: selector > elementText > elementAria > elementId > elementTestId
  const timeout = 5000;

  // If regex, find element by regex across all attribute types
  if (string.startsWith("/") && string.endsWith("/")) {
    const pattern = new RegExp(string.slice(1, -1));
    
    // Perform parallel searches for regex pattern
    const searches = [
      { type: 'selector', promise: findElementByRegex({ pattern, timeout, driver }) },
      { type: 'elementText', promise: findElementByRegex({ pattern, timeout, driver }) },
      { type: 'elementAria', promise: findElementByAriaRegex({ pattern, timeout, driver }) },
      { type: 'elementId', promise: findElementByIdRegex({ pattern, timeout, driver }) },
      { type: 'elementTestId', promise: findElementByTestIdRegex({ pattern, timeout, driver }) }
    ];
    
    const results = await Promise.allSettled(searches.map(s => s.promise));
    
    // Apply precedence order
    for (let i = 0; i < searches.length; i++) {
      if (results[i].status === 'fulfilled' && results[i].value.element) {
        return { element: results[i].value.element, foundBy: searches[i].type };
      }
    }
    
    return { element: null, foundBy: null };
  }

  // Perform parallel searches for exact match across all five attribute types
  const selectorPromise = driver.$(string).then(async (el) => {
    await el.waitForExist({ timeout });
    return el;
  }).catch(() => null);
  
  const textPromise = driver.$(`//*[normalize-space(text())="${string}"]`).then(async (el) => {
    await el.waitForExist({ timeout });
    return el;
  }).catch(() => null);
  
  const ariaPromise = driver.$(`aria/${string}`).then(async (el) => {
    await el.waitForExist({ timeout });
    return el;
  }).catch(() => null);
  
  const idPromise = driver.$(`//*[@id="${string}"]`).then(async (el) => {
    await el.waitForExist({ timeout });
    return el;
  }).catch(() => null);
  
  const testIdPromise = driver.$(`//*[@data-testid="${string}"]`).then(async (el) => {
    await el.waitForExist({ timeout });
    return el;
  }).catch(() => null);

  // Wait for all promises to resolve
  const results = await Promise.allSettled([
    selectorPromise, 
    textPromise, 
    ariaPromise, 
    idPromise, 
    testIdPromise
  ]);

  // Extract results
  const selectorResult = results[0].status === "fulfilled" ? results[0].value : null;
  const textResult = results[1].status === "fulfilled" ? results[1].value : null;
  const ariaResult = results[2].status === "fulfilled" ? results[2].value : null;
  const idResult = results[3].status === "fulfilled" ? results[3].value : null;
  const testIdResult = results[4].status === "fulfilled" ? results[4].value : null;

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
  elementAria,
  timeout = 5000,
  driver,
}) {
  // Validate at least one criterion is provided
  if (!selector && !elementText && !elementId && !elementTestId && 
      !elementClass && !elementAttribute && !elementAria) {
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

        // Check elementAria (computed accessible name)
        if (elementAria && matches) {
          try {
            // Try to match using aria selector
            const ariaLabel = await element.getAttribute('aria-label');
            const elementText = await element.getText();
            // Check aria-label first, then text content
            const accessibleName = ariaLabel || elementText;
            if (!accessibleName || !matchesPattern(accessibleName, elementAria)) {
              matches = false;
            } else {
              if (!criteriaUsed.includes('elementAria')) criteriaUsed.push('elementAria');
            }
          } catch {
            matches = false;
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
  if (elementAria) criteriaList.push('elementAria');
  
  return { 
    element: null, 
    foundBy: null,
    error: `No element found matching all specified criteria: ${criteriaList.join(', ')}`
  };
}