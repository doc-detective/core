# WebdriverIO v9 Migration Tests

This document describes the comprehensive test suite created for the WebdriverIO v9 migration changes.

## Overview

The test file `webdriverio-v9-migration.test.js` contains 18 test cases covering all API changes made during the migration from WebdriverIO v8 to v9.

## Changes Tested

### 1. Driver Execution Methods (`driver.execute`)
**Files affected:** `src/tests.js`
**Changes:** 
- `driver.executeScript()` → `driver.execute()`

**Tests:**
- ✓ Viewport size setting using `driver.execute`
- ✓ Window sizing with new API
- ✓ Small viewport (mobile) handling

### 2. Element Display Detection (`isDisplayed`)
**Files affected:** `src/tests/findStrategies.js`
**Changes:**
- `element.isDisplayedInViewport()` → `element.isDisplayed({withinViewport: true})`

**Tests:**
- ✓ Element visibility within viewport detection
- ✓ Element display properties capture
- ✓ Out-of-viewport element detection

### 3. Cookie SameSite Attribute
**Files affected:** `src/tests/loadCookie.js`
**Changes:**
- Default sameSite value: `"Lax"` → `"lax"` (lowercase)

**Tests:**
- ✓ Lowercase sameSite values in cookie parsing
- ✓ Default lowercase 'lax' when sameSite not specified
- ✓ SameSite 'None' handling on HTTP (converts to 'Lax')
- ✓ Invalid cookie data error handling

### 4. Screenshot and Element Bounding
**Files affected:** `src/tests/saveScreenshot.js`
**Changes:**
- `driver.execute((el) => el.getBoundingClientRect(), element)` → 
  ```javascript
  {
    ...(await element.getSize()),
    ...(await element.getLocation())
  }
  ```
- `driver.scroll(x, y)` → `driver.action('wheel').scroll({ x, y, duration: 0 })`

**Tests:**
- ✓ Scrolling to element using action wheel API
- ✓ Element bounding using getSize and getLocation
- ✓ Screenshot with padding
- ✓ Cropped element screenshots

### 5. Browser Capabilities
**Files affected:** `src/tests.js`
**Changes:**
- Removed `"wdio:enforceWebDriverClassic": true` from all browser capabilities

**Tests:**
- ✓ Firefox without enforceWebDriverClassic
- ✓ Chrome without enforceWebDriverClassic

## Test Structure

### Test Suites

1. **viewport size methods** - Tests for driver.execute changes
2. **element display methods** - Tests for isDisplayed API changes
3. **cookie sameSite attribute handling** - Tests for cookie parsing changes
4. **screenshot with element scrolling** - Tests for scroll and bounding changes
5. **browser capability configuration** - Tests for capability changes
6. **integration tests** - End-to-end tests combining all changes
7. **edge cases and error handling** - Negative tests and boundary conditions

### Test Patterns

Each test:
1. Creates a temporary test specification file
2. Runs the test using the `runTests` API
3. Validates the results using assertions
4. Cleans up temporary files in a `finally` block

### Setup and Teardown

- **Before all tests:** Starts a local test server on port 8093
- **After all tests:** Stops the test server
- **Timeout:** 2 minutes for browser operations

## Running the Tests

```bash
# Run all tests including the new v9 migration tests
npm test

# Run only the v9 migration tests
npx mocha test/webdriverio-v9-migration.test.js
```

## Test Coverage

### Functions Tested

1. **setViewportSize()** - Viewport resizing with driver.execute
2. **setElementOutputs()** - Element property capture with new display API
3. **parseNetscapeCookieFile()** - Cookie parsing with lowercase sameSite
4. **loadCookie()** - Cookie loading with sameSite handling
5. **saveScreenshot()** - Screenshot capture with new scrolling and bounding APIs
6. **getDriverCapabilities()** - Browser capability configuration

### Scenarios Covered

**Happy Path:**
- ✓ Normal viewport resizing
- ✓ Element finding and display detection
- ✓ Cookie loading from files
- ✓ Screenshot capture with elements
- ✓ Browser initialization

**Edge Cases:**
- ✓ Small (mobile) viewports
- ✓ Missing elements
- ✓ Invalid cookie data
- ✓ Elements outside viewport
- ✓ Screenshot padding

**Error Conditions:**
- ✓ Missing cookie files
- ✓ Invalid cookie format
- ✓ Element not found
- ✓ Invalid selectors

## Integration with Existing Tests

The new test file complements the existing `core.test.js` by:
- Focusing specifically on WebdriverIO v9 API changes
- Using the same test server infrastructure
- Following the same test patterns and conventions
- Maintaining consistency with existing assertions

## Maintenance

When updating WebdriverIO or related dependencies:
1. Review the WebdriverIO changelog for API changes
2. Update relevant tests if APIs change further
3. Add new tests for any new features
4. Ensure all tests pass before merging

## Notes

- Tests create temporary files with `temp-*` prefix
- All temporary files are cleaned up in finally blocks
- Tests use Firefox headless mode for consistency
- Chrome tests gracefully skip if Chrome is not available
- Tests are designed to run in CI/CD environments