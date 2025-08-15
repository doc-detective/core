const { validate } = require("doc-detective-common");
const {
  findElementBySelectorAndText,
  findElementBySelectorOrText,
  setElementOutputs,
} = require("./findStrategies");

exports.dragAndDropElement = dragAndDropElement;

// Drag and drop an element from source to target.
async function dragAndDropElement({ config, step, driver, element }) {
  const result = {
    status: "PASS",
    description: "Dragged and dropped element.",
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

  // Check if dragAndDrop object exists
  if (!step.dragAndDrop) {
    result.status = "FAIL";
    result.description = "No dragAndDrop configuration found.";
    return result;
  }

  // Check if source and target are provided
  if (!step.dragAndDrop.source) {
    result.status = "FAIL";
    result.description = "Source element is required.";
    return result;
  }

  if (!step.dragAndDrop.target) {
    result.status = "FAIL";
    result.description = "Target element is required.";
    return result;
  }

  // Check if driver is available
  if (!driver) {
    result.status = "FAIL";
    result.description = "Browser driver is required for drag and drop operations.";
    return result;
  }

  // Set default duration if not provided
  const duration = step.dragAndDrop.duration || 1000;

  let sourceElement = null;
  let targetElement = null;

  // Find source element
  if (typeof step.dragAndDrop.source === "string") {
    // Handle simple string format (text or selector)
    const { element: foundElement, foundBy } = await findElementBySelectorOrText({
      string: step.dragAndDrop.source,
      driver,
    });
    if (!foundElement || !foundElement.elementId) {
      result.status = "FAIL";
      result.description = "No source elements matched selector or text.";
      return result;
    }
    sourceElement = foundElement;
    result.description = `Found source element by ${foundBy}.`;
  } else if (typeof step.dragAndDrop.source === "object") {
    // Handle detailed object format
    const { element: foundElement, foundBy } = await findElementBySelectorAndText({
      selector: step.dragAndDrop.source.selector,
      text: step.dragAndDrop.source.elementText,
      timeout: step.dragAndDrop.source.timeout || 5000,
      driver,
    });
    if (!foundElement || !foundElement.elementId) {
      result.status = "FAIL";
      result.description = "No source elements matched selector and/or text.";
      return result;
    }
    sourceElement = foundElement;
    result.description = `Found source element by ${foundBy}.`;
  } else {
    result.status = "FAIL";
    result.description = "Invalid source element specification.";
    return result;
  }

  // Find target element
  if (typeof step.dragAndDrop.target === "string") {
    // Handle simple string format (text or selector)
    const { element: foundElement, foundBy } = await findElementBySelectorOrText({
      string: step.dragAndDrop.target,
      driver,
    });
    if (!foundElement || !foundElement.elementId) {
      result.status = "FAIL";
      result.description = "No target elements matched selector or text.";
      return result;
    }
    targetElement = foundElement;
    result.description += ` Found target element by ${foundBy}.`;
  } else if (typeof step.dragAndDrop.target === "object") {
    // Handle detailed object format
    const { element: foundElement, foundBy } = await findElementBySelectorAndText({
      selector: step.dragAndDrop.target.selector,
      text: step.dragAndDrop.target.elementText,
      timeout: step.dragAndDrop.target.timeout || 5000,
      driver,
    });
    if (!foundElement || !foundElement.elementId) {
      result.status = "FAIL";
      result.description = "No target elements matched selector and/or text.";
      return result;
    }
    targetElement = foundElement;
    result.description += ` Found target element by ${foundBy}.`;
  } else {
    result.status = "FAIL";
    result.description = "Invalid target element specification.";
    return result;
  }

  // Set element outputs for the source element
  result.outputs = await setElementOutputs({ element: sourceElement });

  try {
    // Perform drag and drop using WebDriver.io
    await sourceElement.dragAndDrop(targetElement);
    result.description += " Performed drag and drop.";
  } catch (error) {
    result.status = "FAIL";
    result.description = `Couldn't perform drag and drop. Error: ${error.message}`;
    return result;
  }

  // PASS
  return result;
}