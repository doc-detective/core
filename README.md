# Doc Detective Core

![Current version](https://img.shields.io/github/package-json/v/doc-detective/doc-detective-core?color=orange)
[![NPM Shield](https://img.shields.io/npm/v/doc-detective-core)](https://www.npmjs.com/package/doc-detective-core)
[![Test status](https://img.shields.io/github/actions/workflow/status/doc-detective/doc-detective-core/npm-test.yaml?label=tests)](https://github.com/doc-detective/doc-detective-core/actions/workflows/npm-test.yaml)
[![Discord Shield](https://img.shields.io/badge/chat-on%20discord-purple)](https://discord.gg/2M7wXEThfF)
[![Docs Shield](https://img.shields.io/badge/docs-doc--detective.com-blue)](https://doc-detective.com)

Low-code documentation testing embedded in your project via [NPM](https://www.npmjs.com/package/doc-detective-core).

For pre-built implementations, see [Doc Detective](https://github.com/doc-detective/doc-detective).

## Install

```bash
npm i doc-detective-core
```

## Init

```javascript
const { runTests, runCoverage } = require("doc-detective-core");
```

## Functions

### `runTests({config})`

Run test specifications. Returns a test report object. Takes [`config`](https://doc-detective.com/reference/schemas/config.html) as input. Parses paths in the `config.input` for test specifications to perform.

## Debug Mode

Doc Detective Core supports a debug step-through mode that allows you to run tests one step at a time, waiting for user input before proceeding to the next step. This is particularly useful for:

- Debugging test failures
- Understanding test execution flow
- Manually verifying each step during development

### Enabling Debug Mode

Enable step-through debug mode by setting the `debug` configuration option:

```javascript
const { runTests } = require("doc-detective-core");

const config = {
  input: "path/to/your/tests",
  debug: true  // or debug: "stepThrough"
};

const results = await runTests(config);
```

### Debug Features

**Step-Through Mode**: When enabled, the test execution will pause before each step and display:
- Current context and step information
- Step description and action type
- Step variables that will be set (if any)
- Interactive prompt for user input

**Auto-Break on Failure**: Debug mode automatically pauses when a step fails, allowing you to inspect the failure before continuing.

**Sequential Execution**: Debug mode forces `concurrentTests` to 1 for sequential execution to ensure proper step-through behavior.

**Interactive Controls**: During debug pauses, you can:
- Press `c` or type `continue` to proceed to the next step
- Press `q` or type `quit` to stop test execution
- Press `v` or type `view` to display available variables and their values
- Press `e` or type `evaluate` to interactively evaluate expressions with current context
- Press `s` or type `set` to set environment variables for testing

**Variable Inspection**: View and interact with the test execution context:
- Environment variables (with truncated display for long values)
- Meta values and hierarchical test structure
- Step outputs from previous actions
- Interactive expression evaluation using Doc Detective's expression syntax

**Non-Interactive Support**: In non-interactive environments (CI/CD, scripts), debug mode will automatically continue without pausing, allowing tests to run normally while still logging debug information.

### Example Debug Session

```
--- DEBUG STEP-THROUGH MODE ---
⏸️  Step-through mode: Paused before next step
Context: my-test-context
Step ID: step-1
Step Description: Click the login button
Step Action: click

Options:
  [c] Continue to next step
  [q] Quit execution
  [v] View available variables
  [e] Evaluate expression
  [s] Set environment variable
Choice: v

=== AVAILABLE VARIABLES ===

--- Environment Variables ---
  NODE_ENV: development
  PATH: /usr/local/bin:/usr/bin:/bin
  ... and 15 more environment variables

--- Meta Values (Test Execution Context) ---
{
  "specs": {
    "test-spec": {
      "tests": {
        "my-test": {
          "contexts": {
            "my-test-context": {
              "steps": {}
            }
          }
        }
      }
    }
  }
}

--- Recent Step Outputs ---
  No step outputs available yet

Tip: Use expressions like $$specs.specId.tests.testId.contexts.contextId.steps.stepId.outputs.key
     Or environment variables like $VARIABLE_NAME

Options:
  [c] Continue to next step
  [q] Quit execution
  [v] View available variables
  [e] Evaluate expression
  [s] Set environment variable
Choice: c
```

### Current Features

The debug system includes these implemented features:
- **Step-Through Mode**: Pause before each step execution
- **Auto-Break on Failure**: Automatically pause when steps fail
- **Variable Inspection**: View environment variables, meta values, and step outputs
- **Expression Evaluation**: Test expressions interactively with current context
- **Environment Variable Setting**: Modify variables during debugging sessions
- **Sequential Execution**: Forces single-threaded execution for predictable debugging

### Future Enhancements

Additional features planned for future releases:
- **Breakpoints**: Pause at specific step IDs or conditions

## Contributions

Looking to help out? See our [contributions guide](https://github.com/doc-detective/doc-detective-core/blob/main/CONTRIBUTIONS.md) for more info. If you can't contribute code, you can still help by reporting issues, suggesting new features, improving the documentation, or sponsoring the project.
