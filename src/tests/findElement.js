const { validate } = require("doc-detective-common");
const { typeKeys } = require("./typeKeys");
const { moveTo, instantiateCursor } = require("./moveTo");
const { wait } = require("./wait");

exports.findElement = findElement;

// Find a single element
async function findElement(config, step, driver) {
  let result = {
    status: "PASS",
    description: "Found an element matching selector.",
  };

  // Validate step payload
  isValidStep = validate("find_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Find element
  const element = await driver.$(step.selector);
  try {
    // Wait for timeout
    await element.waitForExist({ timeout: step.timeout });
  } catch {
    // No matching elements
    if (!element.elementId) {
      result.status = "FAIL";
      result.description = "No elements matched selector.";
      return result;
    }
  }

  // Match text
  // If step.matchText starts and ends with `/`, treat it as a regex
  if (step.matchText) {
    const text = (await element.getText()) || (await element.getValue());
    if (step.matchText.startsWith("/") && step.matchText.endsWith("/")) {
      const regex = new RegExp(step.matchText.slice(1, -1));
      if (regex.test(text)) {
        result.description = result.description + " Matched regex.";
      } else {
        result.status = "FAIL";
        result.description = `Element text (${text}) didn't match regex (${step.matchText}).`;
        return result;
      }
    } else {
      if (text === step.matchText) {
        result.description = result.description + " Matched text.";
      } else {
        result.status = "FAIL";
        result.description = `Element text (${text}) didn't equal match text (${step.matchText}).`;
        return result;
      }
    }
  }

  // Move to element
  if (step.moveTo && config.recording) {
    let moveToStep = {
      action: "moveTo",
      selector: step.selector,
    };
    if (typeof step.moveTo === "object") {
      moveToStep = { ...moveToStep, ...step.moveTo };
    }

    await moveTo(config, moveToStep, driver);
    result.description = result.description + " Moved to element.";
  }

  // Click element
  if (step.click) {
    try {
      // TODO: Split into separate action with button and coordinates options. https://webdriver.io/docs/api/element/click
      await element.click();
      result.description = result.description + " Clicked element.";
    } catch {
      // Couldn't click
      result.status = "FAIL";
      result.description = "Couldn't click element.";
      return result;
    }
  }

  // Type keys
  if (step.typeKeys) {
    const typeStep = {
      action: "typeKeys",
      keys: step.typeKeys.keys || step.typeKeys,
    };
    typeResult = await typeKeys(config, typeStep, driver);
    if (typeResult.status === "FAIL") {
      result.status = "FAIL";
      result.description = `${result.description} ${typeResult.description}`;
    } else {
      result.description = result.description + " Typed keys.";
    }
  }

  // If recording, wait until page is loaded and instantiate cursor
  if (config.recording) {
    await wait(config, { action: "wait", duration: 2000 }, driver);
  }
  // PASS
  return result;
}
