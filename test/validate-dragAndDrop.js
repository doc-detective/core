#!/usr/bin/env node

// Simple test to validate dragAndDrop implementation
const { dragAndDropElement } = require("../src/tests/dragAndDrop");

async function testDragAndDropValidation() {
  console.log("Testing dragAndDrop action validation...");

  // Test 1: Valid simple syntax (should fail at driver check)
  console.log("\n1. Testing simple syntax validation...");
  const simpleStep = {
    dragAndDrop: {
      source: "Table",
      target: "#canvas"
    }
  };

  try {
    const result = await dragAndDropElement({ 
      config: {}, 
      step: simpleStep, 
      driver: null 
    });
    if (result.status === "FAIL" && result.description.includes("driver is required")) {
      console.log("✓ Simple syntax passed validation, correctly failed at driver check");
    } else {
      console.log("✗ Unexpected result:", result);
    }
  } catch (error) {
    console.log("✗ Simple syntax validation threw error:", error.message);
  }

  // Test 2: Valid detailed syntax (should fail at driver check)
  console.log("\n2. Testing detailed syntax validation...");
  const detailedStep = {
    dragAndDrop: {
      source: {
        selector: ".draggable",
        elementText: "Table"
      },
      target: {
        selector: "#canvas"
      },
      duration: 2000
    }
  };

  try {
    const result = await dragAndDropElement({ 
      config: {}, 
      step: detailedStep, 
      driver: null 
    });
    if (result.status === "FAIL" && result.description.includes("driver is required")) {
      console.log("✓ Detailed syntax passed validation, correctly failed at driver check");
    } else {
      console.log("✗ Unexpected result:", result);
    }
  } catch (error) {
    console.log("✗ Detailed syntax validation threw error:", error.message);
  }

  // Test 3: Invalid step (missing source)
  console.log("\n3. Testing invalid step (missing source)...");
  const invalidStep = {
    dragAndDrop: {
      target: "#canvas"
    }
  };

  try {
    const result = await dragAndDropElement({ 
      config: {}, 
      step: invalidStep, 
      driver: {} 
    });
    if (result.status === "FAIL" && result.description.includes("Source element is required")) {
      console.log("✓ Invalid step correctly failed validation (missing source)");
    } else {
      console.log("✗ Invalid step should have failed but got:", result);
    }
  } catch (error) {
    console.log("✗ Invalid step threw error:", error.message);
  }

  // Test 4: Invalid step (missing target)
  console.log("\n4. Testing invalid step (missing target)...");
  const invalidStep2 = {
    dragAndDrop: {
      source: "Table"
    }
  };

  try {
    const result = await dragAndDropElement({ 
      config: {}, 
      step: invalidStep2, 
      driver: {} 
    });
    if (result.status === "FAIL" && result.description.includes("Target element is required")) {
      console.log("✓ Invalid step correctly failed validation (missing target)");
    } else {
      console.log("✗ Invalid step should have failed but got:", result);
    }
  } catch (error) {
    console.log("✗ Invalid step threw error:", error.message);
  }

  // Test 5: No dragAndDrop object
  console.log("\n5. Testing step without dragAndDrop object...");
  const noDragDropStep = {
    click: "button"
  };

  try {
    const result = await dragAndDropElement({ 
      config: {}, 
      step: noDragDropStep, 
      driver: {} 
    });
    if (result.status === "FAIL" && result.description.includes("No dragAndDrop configuration")) {
      console.log("✓ Step without dragAndDrop correctly failed");
    } else {
      console.log("✗ Step without dragAndDrop should have failed but got:", result);
    }
  } catch (error) {
    console.log("✗ Step without dragAndDrop threw error:", error.message);
  }

  console.log("\nAll validation tests completed!");
}

if (require.main === module) {
  testDragAndDropValidation().catch(console.error);
}

module.exports = { testDragAndDropValidation };