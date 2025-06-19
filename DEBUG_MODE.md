# Debug Step-Through Mode

Doc Detective now supports a debug mode that allows you to step through tests interactively, set breakpoints, and pause on failures.

## Configuration

Add a `debug` object to your configuration:

```javascript
const config = {
  input: 'tests/',
  debug: {
    enabled: true,        // Enable debug mode
    stepThrough: true,    // Pause before every step
    breakOnFail: true,    // Pause when a step fails
    breakpoints: [        // Array of step descriptions or IDs to break on
      "Login step",
      "Critical validation"
    ]
  }
};
```

## Debug Options

- `enabled`: (boolean) Enable or disable debug mode
- `stepThrough`: (boolean) Pause before executing each step
- `breakOnFail`: (boolean) Automatically pause when any step fails
- `breakpoints`: (array) List of step descriptions or step IDs to pause on

## Step-Level Breakpoints

You can also set breakpoints directly on individual steps:

```yaml
tests:
- steps:
  - description: "Normal step"
    wait: 1000
  - description: "Debug this step"
    breakpoint: true    # This step will pause in debug mode
    click: "#submit"
```

## Interactive Controls

When debug mode pauses execution, you can:

- **Press Enter**: Continue to next step/breakpoint
- **Type 'c' + Enter**: Continue without pausing (disable step-through mode)
- **Type 'q' + Enter**: Quit the test run immediately

## Debug Information

When paused, debug mode shows:

- Current test description
- Current context ID
- Current step description and ID
- Error details (if paused on failure)

## Example

```javascript
const { runTests } = require('doc-detective-core');

// Run tests with step-through debugging
const config = {
  input: 'my-tests.spec.yaml',
  debug: {
    enabled: true,
    stepThrough: true,
    breakOnFail: true
  }
};

runTests(config);
```

This will pause before each step and on any failures, allowing you to inspect the test execution interactively.