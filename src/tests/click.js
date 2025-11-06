const { validate } = require("doc-detective-common");
const {
  findElementBySelectorAndText,
  findElementBySelectorOrText,
  findElementByCriteria,
  setElementOutputs,
} = require("./findStrategies");

exports.clickElement = clickElement;

// Click an element.
async function clickElement({ config, step, driver, element }) {
  const result = {
    status: "PASS",
    description: "Clicked element.",
    outputs: {},
  };

  // Validate step payload
  const isValidStep = validate({ schemaKey: "step_v3", object: step });
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }
  // Accept coerced and defaulted values
  step = isValidStep.object;

  if (typeof step.click === "object") {
    // Set default values
    step.click = {
      ...step.click,
      button: step.click.button || "left",
    };
  }

  // Find element
  if (!element?.elementId) {
    // Handle combo selector/text string
    if (typeof step.click === "string") {
      const { element: foundElement, foundBy } =
        await findElementBySelectorOrText({
          string: step.click,
          driver,
        });
      if (foundElement) {
        // Wait for timeout
        try {
          await foundElement.waitForExist({ timeout: 5000 });
        } catch {
          // No matching elements
          if (!foundElement.elementId) {
            result.status = "FAIL";
            result.description = "No elements matched selector or text.";
            return result;
          }
        }
        result.description += ` Found element by ${foundBy}.`;
        element = foundElement;
      } else {
        // No matching elements
        result.status = "FAIL";
        result.description = "No elements matched selector or text.";
        return result;
      }
    } else {
      // Check if any of the new criteria are being used
      const hasNewCriteria = step.click.elementId || step.click.elementTestId || 
                             step.click.elementClass || step.click.elementAttribute || 
                             step.click.elementAria;
      
      if (hasNewCriteria || (step.click.selector && step.click.elementText)) {
        // Use the new comprehensive finding function
        const { element: foundElement, foundBy, error } = await findElementByCriteria({
          selector: step.click.selector,
          elementText: step.click.elementText,
          elementId: step.click.elementId,
          elementTestId: step.click.elementTestId,
          elementClass: step.click.elementClass,
          elementAttribute: step.click.elementAttribute,
          elementAria: step.click.elementAria,
          timeout: step.click.timeout || 5000,
          driver,
        });
        
        if (!foundElement) {
          result.status = "FAIL";
          result.description = error || `Couldn't find element.`;
          return result;
        }
        element = foundElement;
        result.description += ` Found element by ${foundBy}.`;
      } else {
        // Use legacy logic for backward compatibility
        const { element: foundElement, foundBy } =
          await findElementBySelectorAndText({
            selector: step.click.selector,
            text: step.click.elementText,
            timeout: step.click.timeout || 5000,
            driver,
          });
        if (!foundElement) {
          result.status = "FAIL";
          result.description = `Couldn't find element.`;
          return result;
        }
        element = foundElement;
        result.description += ` Found element by ${foundBy}.`;
      }
    }
  }
  result.outputs = await setElementOutputs({ element });

  try {
    await element.click({
      button: step?.click?.button || "left",
    });
    result.description += " Clicked element.";
  } catch (error) {
    result.status = "FAIL";
    result.description = `Couldn't click element. Error: ${error.message}`;
    return result;
  }
  // PASS
  return result;
}
