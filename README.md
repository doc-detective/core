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
- Interactive prompt for user input

**Interactive Controls**: During debug pauses, you can:
- Press `c` or type `continue` to proceed to the next step
- Press `q` or type `quit` to stop test execution

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
Choice: c
```

### Future Enhancements

The debug system is designed to support additional features in future releases:
- **Breakpoints**: Pause at specific step IDs
- **Break on Fail**: Automatically pause when a step fails
- **Variable Inspection**: View step outputs and variables

*Note: Advanced debug features require schema updates in doc-detective-common*

## Contributions

Looking to help out? See our [contributions guide](https://github.com/doc-detective/doc-detective-core/blob/main/CONTRIBUTIONS.md) for more info. If you can't contribute code, you can still help by reporting issues, suggesting new features, improving the documentation, or sponsoring the project.
