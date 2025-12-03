# Doc Detective Core - AI Coding Assistant Guide

## Project Overview

Doc Detective Core is a low-code documentation testing framework that validates docs through browser automation, shell commands, HTTP requests, and content analysis. It's the engine behind the Doc Detective CLI tool.

## Architecture

### Test Execution Flow

1. **Input Resolution** (`doc-detective-resolver`): Detects tests from docs/specs → resolves to executable format
2. **Test Orchestration** (`src/tests.js`): `runSpecs()` → spec → test → context → step hierarchy
3. **Browser Automation** (`src/tests.js`): Appium server manages WebDriver sessions (Chrome/Firefox/Safari)
4. **Step Execution**: Each step type has dedicated handler in `src/tests/` (e.g., `httpRequest.js`, `runShell.js`)

### Key Components

- **`src/index.js`**: Entry point exposing `runTests()` function
- **`src/tests.js`**: Core test runner with Appium/WebDriver orchestration (600+ LOC orchestrator)
- **`src/config.js`**: Configuration validation, environment detection, browser discovery
- **`src/openapi.js`**: OpenAPI integration for HTTP request validation/mocking
- **`src/expressions.js`**: Runtime expression resolver supporting meta values (`$$response.body.field`) and operators (`jq()`, `extract()`)
- **`src/tests/`**: Individual step action implementations

## Critical Workflows

### Running Tests Locally

```bash
npm test                    # Run full test suite (mocha)
node dev                    # Development/manual testing
npm run depcheck            # Check for unused dependencies
```

### CI/CD Pipeline

Three GitHub Actions workflows automate releases and testing:

1. **Auto Dev Release** (`auto-dev-release.yml`): Triggers on push to `main`

   - Skips on `[skip ci]` commits, release commits, or docs-only changes
   - Increments dev version (`3.4.0-dev.1` → `3.4.0-dev.2`)
   - Publishes to npm with `dev` tag
   - Users install with `npm install doc-detective-core@dev`
   - **Version strategy**: Checks npm for latest dev number, increments, updates `package.json`, commits with `[skip ci]`, creates git tag

2. **Test & Publish** (`npm-test.yaml`): Cross-platform testing + release publishing

   - **Test matrix**: Ubuntu/Windows/macOS × Node 18/20/22/24 (15 min timeout)
   - **Triggers**: Push to `main`, PRs (opened/reopened/synced), manual dispatch
   - **On release publish**: Runs `npm publish` to npm registry
   - **Post-publish**: Triggers downstream `doc-detective` package update via repository dispatch

3. **Update Resolver** (`update-resolver.yaml`): Dependency sync workflow
   - **Trigger**: Repository dispatch from `doc-detective-resolver` releases OR manual with version input
   - **Process**: Installs specified resolver version + matching `doc-detective-common` version → runs tests → bumps version → creates release with resolver changelog
   - **Version bumping**: Uses `scripts/bump-sync-version-resolver.js` to increment patch version
   - **Release notes**: Aggregates merged PRs since last tag + resolver release notes

### Browser Management

- **Post-install** (`scripts/postinstall.js`): Auto-downloads Chrome/Firefox/ChromeDriver to `browser-snapshots/`
- Browsers MUST match platform (detected via `@puppeteer/browsers`)
- Appium drivers installed: `chromium`, `gecko`, `safari` (Mac only)
- **Timeout**: All drivers default to 10 minutes (`newCommandTimeout: 600`)

### Version Management

- **Dev releases**: `X.Y.Z-dev.N` format (auto-incremented on every main push)
- **Stable releases**: Manual GitHub releases trigger npm publish
- **Dependency sync**: Resolver updates trigger automated core updates
- **Commit conventions**: Use `[skip ci]` to avoid triggering auto-dev-release

### Adding New Step Types

1. Create handler in `src/tests/[actionName].js` exporting async function
2. Add action to `driverActions` array in `src/tests.js` if requires browser
3. Add case in `runStep()` switch statement
4. Follow validation pattern: validate schema → resolve to object → set defaults
5. Return `{ status: "PASS"|"FAIL"|"WARNING", description: string, outputs: {} }`

## Project Conventions

### Test Structure

Tests follow nested hierarchy:

```text
spec (file) → test → context (browser/platform combo) → step (action)
```

- **Contexts** run serially and skip if platform/browser unsupported
- **Steps** skip after first failure in context (stepExecutionFailed flag)
- **Unsafe steps** (`step.unsafe = true`) require `config.allowUnsafeSteps = true`

### Configuration Patterns

- Config validated via `doc-detective-common` schemas (`validate({ schemaKey: "config_v3", object })`)
- File types (`markdown`, `asciidoc`, `html`) define inline test detection regexes
- Environment variables loaded via `loadEnvs()` and replaced via `replaceEnvs()` using `$VAR_NAME` syntax
- OpenAPI definitions loaded and dereferenced at config time (stored in `config.integrations.openApi[].definition`)

### Expression System (`src/expressions.js`)

- **Meta values**: `$$response.body.users[0].name` accesses runtime data
- **Embedded expressions**: `"User ID is {{$$response.body.id}}"` for string interpolation
- **Operators**: `jq($$response.body, ".users[0].name")`, `extract($$output, "ID: (\d+)")`
- Variables set via `step.variables = { MY_VAR: "$$response.body.token" }` → stored as env vars

### OpenAPI Integration

- **Example compilation**: Extracts request/response examples from OpenAPI spec
- **Schema validation**: Uses AJV to validate payloads against OpenAPI schemas
- **Mock responses**: Set `step.httpRequest.openApi.mockResponse = true` to skip actual HTTP call
- Operations referenced by `operationId` (e.g., `step.httpRequest.openApi.operationId = "getUserById"`)

### Error Handling & Logging

- Use `log(config, level, message)` where level = "debug"|"info"|"warning"|"error"
- Config object MUST be passed as first param to log functions
- Step failures should return `{ status: "FAIL", description: "Detailed error message" }`
- Always handle driver cleanup in try/finally blocks

## Common Pitfalls

- **Appium must be running** for any driver-based step (auto-started if needed, but check `appiumRequired` flag)
- **Browser paths are platform-specific**: Use `getAvailableApps()` to detect installed browsers
- **JSON pointer syntax**: Use `#/path/to/field` after meta value (e.g., `$$response#/body/users/0/name`)
- **Viewport vs Window size**: `setViewportSize()` calculates delta to set inner dimensions
- **Fractional variation** (`maxVariation`): Value is a decimal fraction (0.1 = 10% tolerance). Comparisons use fractions directly.
- **File overwrite modes**: "false" (never), "true" (always), "aboveVariation" (only if content differs > maxVariation)

## Testing Patterns

- Tests in `test/core.test.js` use mocha with `this.timeout(0)` for indefinite timeout
- Test server runs on port 8092 (`test/server/`) for HTTP request tests
- Artifacts stored in `test/artifacts/` (specs, configs, test files)
- Use `fs.writeFileSync()` + `fs.unlinkSync()` for temp test files in try/finally blocks

## Dependencies to Know

- `webdriverio` (8.45.0): WebDriver protocol implementation
- `appium`: Browser automation server
- `@puppeteer/browsers`: Browser binary management
- `axios`: HTTP client for requests
- `ajv`: JSON schema validation
- `jq-web`: JQ expression evaluation
- `doc-detective-common`: Shared schemas/utilities
- `doc-detective-resolver`: Test detection/resolution

## Documentation

- Main docs at https://doc-detective.com
- Schemas at https://doc-detective.com/reference/schemas/
- Report issues to https://github.com/doc-detective/doc-detective-core/issues
