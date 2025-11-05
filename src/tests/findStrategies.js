exports.findElementBySelectorAndText = findElementBySelectorAndText;
exports.findElementBySelectorOrText = findElementBySelectorOrText;

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
  const textPromise = driver
    .$(`//*[normalize-space(text())="${string}"]`)
    .then(async (el) => {
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
  let elements;
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
