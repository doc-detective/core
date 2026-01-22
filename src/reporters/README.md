# HTML Reporter

The HTML reporter generates a self-contained, nicely formatted HTML report of Doc Detective test results.

## Features

- **Self-contained**: All CSS and JavaScript embedded - no external dependencies
- **Professional styling**: Modern, responsive design with gradient header
- **Interactive**: Expandable/collapsible sections for specs, tests, contexts, and steps
- **Clear visualization**: Color-coded badges and status indicators
- **Detailed summary**: Test statistics by specs, tests, contexts, and steps
- **Hierarchical display**: Shows complete test structure from specs down to individual steps

## Usage

### Programmatic Usage

```javascript
const { runTests, generateHtmlReport } = require('doc-detective-core');

async function runTestsWithHtmlReport() {
  // Run your tests
  const config = {
    input: './tests',
    logLevel: 'info'
  };
  
  const results = await runTests(config);
  
  // Generate HTML report
  if (results) {
    await generateHtmlReport(results, config, './test-report.html');
    console.log('HTML report generated at ./test-report.html');
  }
}

runTestsWithHtmlReport();
```

### Function Signature

```javascript
generateHtmlReport(results, config, outputPath)
```

**Parameters:**
- `results` (Object): The test results object returned by `runTests()`
- `config` (Object): The Doc Detective configuration object (used for logging)
- `outputPath` (string): Path where the HTML report should be saved

**Returns:**
- Object with `status` ("PASS" or "FAIL") and `description` fields

## Report Structure

The HTML report displays results in a hierarchical structure:

1. **Summary Section**: Overview of all test results with statistics
   - Specs (pass/fail/warning/skipped)
   - Tests (pass/fail/warning/skipped)
   - Contexts (pass/fail/warning/skipped)
   - Steps (pass/fail/warning/skipped)

2. **Specifications**: Each spec is collapsible and shows:
   - Spec ID and description
   - Content path (if available)
   - Overall result status

3. **Tests**: Within each spec, tests show:
   - Test ID and description
   - Content path (if available)
   - Detect steps setting

4. **Contexts**: Within each test, contexts show:
   - Platform and browser information
   - Result status

5. **Steps**: Within each context, individual steps show:
   - Step action type
   - Result status with color coding
   - Description (if available)
   - Outputs/details (if available)

## Status Badges

- 🟢 **PASS**: Green badge - test passed successfully
- 🔴 **FAIL**: Red badge - test failed
- 🟡 **WARNING**: Yellow badge - test completed with warnings
- ⚪ **SKIPPED**: Gray badge - test was skipped

## Example

See `test/html-reporter.test.js` for test examples, or run:

```bash
node test-html-report.js
```

This will run a sample test and generate `test-report.html` in the root directory.
