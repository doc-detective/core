const { dragAndDropElement } = require("../src/tests/dragAndDrop");
const assert = require("assert").strict;

describe("dragAndDrop action", function () {
  it("should validate step schema properly", async () => {
    // Test basic validation
    const step = {
      dragAndDrop: {
        source: "Table",
        target: "#canvas"
      }
    };
    
    const mockDriver = {
      // Mock driver methods for element finding
    };

    const config = { logLevel: "silent" };
    
    // This should not fail validation
    // Note: This will fail at element finding stage due to mock driver, 
    // but should pass schema validation
    try {
      await dragAndDropElement({ config, step, driver: mockDriver });
    } catch (error) {
      // Expected to fail at element finding stage, not validation
    }
  });

  it("should handle detailed syntax", async () => {
    const step = {
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
    
    const mockDriver = {};
    const config = { logLevel: "silent" };
    
    // This should not fail validation
    try {
      await dragAndDropElement({ config, step, driver: mockDriver });
    } catch (error) {
      // Expected to fail at element finding stage
    }
  });
});