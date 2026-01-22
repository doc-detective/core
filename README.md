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
const { runTests, generateHtmlReport } = require("doc-detective-core");
```

## Functions

### `runTests({config})`

Run test specifications. Returns a test report object. Takes [`config`](https://doc-detective.com/reference/schemas/config.html) as input. Parses paths in the `config.input` for test specifications to perform.

### `generateHtmlReport(results, config, outputPath)`

Generate a self-contained HTML report from test results. See [HTML Reporter documentation](src/reporters/README.md) for details.

**Parameters:**
- `results`: Test results object returned by `runTests()`
- `config`: Doc Detective configuration object
- `outputPath`: Path where the HTML report should be saved

**Example:**
```javascript
const results = await runTests(config);
await generateHtmlReport(results, config, './test-report.html');
```

## Contributions

Looking to help out? See our [contributions guide](https://github.com/doc-detective/doc-detective-core/blob/main/CONTRIBUTIONS.md) for more info. If you can't contribute code, you can still help by reporting issues, suggesting new features, improving the documentation, or sponsoring the project.
