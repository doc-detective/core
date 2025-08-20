const { validate } = require("doc-detective-common");
const {
  findElementBySelectorAndText,
  findElementBySelectorOrText,
  setElementOutputs,
} = require("./findStrategies");
const { log } = require("../utils");

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

  // Set default duration if not provided
  const duration = step.dragAndDrop.duration || 1000;

  let sourceElement = null;
  let targetElement = null;

  // Find source element
  if (typeof step.dragAndDrop.source === "string") {
    // Handle simple string format (text or selector)
    const { element: foundElement, foundBy } =
      await findElementBySelectorOrText({
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
    const { element: foundElement, foundBy } =
      await findElementBySelectorAndText({
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
    const { element: foundElement, foundBy } =
      await findElementBySelectorOrText({
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
    const { element: foundElement, foundBy } =
      await findElementBySelectorAndText({
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
  // result.outputs = await setElementOutputs({ element: sourceElement });

  // Store original identifiers for fallback
  let sourceIdentifier, targetIdentifier;

  if (typeof step.dragAndDrop.source === "string") {
    sourceIdentifier = step.dragAndDrop.source;
  } else {
    sourceIdentifier =
      step.dragAndDrop.source.selector || step.dragAndDrop.source.elementText;
  }

  if (typeof step.dragAndDrop.target === "string") {
    targetIdentifier = step.dragAndDrop.target;
  } else {
    targetIdentifier =
      step.dragAndDrop.target.selector || step.dragAndDrop.target.elementText;
  }

  try {
    // Check if elements are draggable and try different approaches
    const sourceIsDraggable = await sourceElement.getAttribute("draggable");
    const sourceHasDragEvents = await driver.execute((element) => {
      const el =
        document.querySelector(`[data-testid="${element}"]`) ||
        document.querySelector(element) ||
        Array.from(document.querySelectorAll("*")).find(
          (el) => el.textContent.trim() === element
        );
      return (
        el && (el.draggable === true || el.getAttribute("draggable") === "true")
      );
    }, sourceIdentifier);

    log(
      config,
      "debug",
      `Source element draggable: ${sourceIsDraggable}, has drag events: ${sourceHasDragEvents}`
    );

    // If this looks like an HTML5 drag and drop scenario, use HTML5 simulation directly
    if (sourceIsDraggable === "true" || sourceHasDragEvents) {
      log(
        config,
        "debug",
        "Detected HTML5 drag and drop, using simulation directly"
      );

      await driver.execute(
        (sourceSelector, targetSelector) => {
          // Create a helper function to simulate HTML5 drag and drop
          function simulateHTML5DragDrop(source, target) {
            // Create and dispatch dragstart event
            const dragStartEvent = new DragEvent("dragstart", {
              bubbles: true,
              cancelable: true,
              dataTransfer: new DataTransfer(),
            });

            // Set data transfer data
            dragStartEvent.dataTransfer.setData(
              "text/plain",
              source.textContent
            );
            if (source.dataset.widget) {
              dragStartEvent.dataTransfer.setData(
                "widget-type",
                source.dataset.widget
              );
            }

            source.dispatchEvent(dragStartEvent);

            // Create and dispatch dragover event on target
            const dragOverEvent = new DragEvent("dragover", {
              bubbles: true,
              cancelable: true,
              dataTransfer: dragStartEvent.dataTransfer,
            });
            target.dispatchEvent(dragOverEvent);

            // Create and dispatch drop event
            const dropEvent = new DragEvent("drop", {
              bubbles: true,
              cancelable: true,
              dataTransfer: dragStartEvent.dataTransfer,
            });
            target.dispatchEvent(dropEvent);

            // Create and dispatch dragend event
            const dragEndEvent = new DragEvent("dragend", {
              bubbles: true,
              cancelable: true,
              dataTransfer: dragStartEvent.dataTransfer,
            });
            source.dispatchEvent(dragEndEvent);

            return true;
          }

          // Find elements by the selectors or text content
          let sourceEl = document.querySelector(sourceSelector);
          let targetEl = document.querySelector(targetSelector);

          // If not found by selector, try to find by text content
          if (!sourceEl) {
            const allElements = document.querySelectorAll("*");
            for (let el of allElements) {
              if (el.textContent.trim() === sourceSelector) {
                sourceEl = el;
                break;
              }
            }
          }

          if (!targetEl) {
            const allElements = document.querySelectorAll("*");
            for (let el of allElements) {
              if (el.textContent.trim() === targetSelector) {
                targetEl = el;
                break;
              }
            }
          }

          if (!sourceEl || !targetEl) {
            throw new Error(
              `Could not find source (${sourceSelector}) or target (${targetSelector}) elements`
            );
          }

          return simulateHTML5DragDrop(sourceEl, targetEl);
        },
        sourceIdentifier,
        targetIdentifier
      );

      log(config,"debug", "Performed drag and drop with HTML5 simulation.")
      result.description += " Performed drag and drop.";
    } else {
      // Try WebDriver.io method, but verify it actually worked
      log(config, "debug", "Trying WebDriver.io drag and drop method");

      // Get initial state of target to check if drop worked
      const initialTargetHTML = await targetElement.getHTML();

      await sourceElement.dragAndDrop(targetElement, { duration });

      // Check if anything actually changed in the target
      const finalTargetHTML = await targetElement.getHTML();
      const targetChanged = initialTargetHTML !== finalTargetHTML;

      if (!targetChanged) {
        // WebDriver.io method failed silently, try HTML5 simulation
        log(
          config,
          "debug",
          "WebDriver.io drag and drop appeared to fail silently, trying HTML5 simulation"
        );

        await driver.execute(
          (sourceSelector, targetSelector) => {
            // Create a helper function to simulate HTML5 drag and drop
            function simulateHTML5DragDrop(source, target) {
              // Create and dispatch dragstart event
              const dragStartEvent = new DragEvent("dragstart", {
                bubbles: true,
                cancelable: true,
                dataTransfer: new DataTransfer(),
              });

              // Set data transfer data
              dragStartEvent.dataTransfer.setData(
                "text/plain",
                source.textContent
              );
              if (source.dataset.widget) {
                dragStartEvent.dataTransfer.setData(
                  "widget-type",
                  source.dataset.widget
                );
              }

              source.dispatchEvent(dragStartEvent);

              // Create and dispatch dragover event on target
              const dragOverEvent = new DragEvent("dragover", {
                bubbles: true,
                cancelable: true,
                dataTransfer: dragStartEvent.dataTransfer,
              });
              target.dispatchEvent(dragOverEvent);

              // Create and dispatch drop event
              const dropEvent = new DragEvent("drop", {
                bubbles: true,
                cancelable: true,
                dataTransfer: dragStartEvent.dataTransfer,
              });
              target.dispatchEvent(dropEvent);

              // Create and dispatch dragend event
              const dragEndEvent = new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                dataTransfer: dragStartEvent.dataTransfer,
              });
              source.dispatchEvent(dragEndEvent);

              return true;
            }

            // Find elements by the selectors or text content
            let sourceEl = document.querySelector(sourceSelector);
            let targetEl = document.querySelector(targetSelector);

            // If not found by selector, try to find by text content
            if (!sourceEl) {
              const allElements = document.querySelectorAll("*");
              for (let el of allElements) {
                if (el.textContent.trim() === sourceSelector) {
                  sourceEl = el;
                  break;
                }
              }
            }

            if (!targetEl) {
              const allElements = document.querySelectorAll("*");
              for (let el of allElements) {
                if (el.textContent.trim() === targetSelector) {
                  targetEl = el;
                  break;
                }
              }
            }

            if (!sourceEl || !targetEl) {
              throw new Error(
                `Could not find source (${sourceSelector}) or target (${targetSelector}) elements`
              );
            }

            return simulateHTML5DragDrop(sourceEl, targetEl);
          },
          sourceIdentifier,
          targetIdentifier
        );

        log(config, "debug", "Performed drag and drop with HTML5 simulation as fallback after WebDriver.io failed silently.");
        result.description +=
          " Performed drag and drop.";
      } else {
        log(config, "debug", "Performed drag and drop with WebDriver.io.");
        result.description += " Performed drag and drop.";
      }
    }
  } catch (error) {
    result.status = "FAIL";
    result.description = `Couldn't perform drag and drop. Error: ${error.message}`;
    return result;
  }

  // PASS
  return result;
}
