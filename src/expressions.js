const { log } = require("./utils");
const { JSONPath } = require("jsonpath-plus");
const xpath = require("xpath");
const { DOMParser } = require("xmldom");
const jq = require("jq-web");

/**
 * Resolves runtime expressions that may contain meta values and operators.
 * Can handle both standalone expressions and strings with embedded expressions.
 * @param {string} expression - The expression to resolve.
 * @param {object} context - Context object containing meta values.
 * @returns {*} - The resolved value of the expression.
 */
async function resolveExpression(expression, context) {
  if (typeof expression !== "string") {
    return expression;
  }

  try {
    // First check if this is a string with embedded expressions {{...}}
    if (expression.includes("{{") && expression.includes("}}")) {
      return await resolveEmbeddedExpressions(expression, context);
    }

    // For standalone expressions, replace all meta values
    let resolvedExpression = replaceMetaValues(expression, context);

    // Check if the expression is a single meta value with no operators
    if (
      resolvedExpression !== expression &&
      !containsOperators(resolvedExpression)
    ) {
      return resolvedExpression;
    }

    // Evaluate the expression if it contains operators
    if (containsOperators(resolvedExpression)) {
      let evaluatedExpression = await evaluateExpression(
        resolvedExpression,
        context
      );
      // If the evaluated expression is an object, convert it to a string
      if (typeof evaluatedExpression === "object") {
        evaluatedExpression = JSON.stringify(evaluatedExpression);
      }
      return evaluatedExpression;
    }

    return resolvedExpression;
  } catch (error) {
    log(
      `Error resolving expression '${expression}': ${error.message}`,
      "error"
    );
    return expression;
  }
}

/**
 * Replaces all meta values in an expression with their actual values from context.
 * @param {string} expression - The expression containing meta values.
 * @param {object} context - Context object containing meta values.
 * @returns {*} - The expression with meta values replaced.
 */
function replaceMetaValues(expression, context) {
  // Regular expression to match meta values with optional JSON pointer
  const metaValueRegex = /\$\$([\w\.]+(?:\.\{\{[\w]+\}\})*(?:#\/[\w\/]+)*)/g;

  let result = expression;
  let match;
  const hasOperators = containsOperators(expression);

  while ((match = metaValueRegex.exec(expression)) !== null) {
    const metaValuePath = match[1];
    const metaValue = getMetaValue(metaValuePath, context);

    // Replace the meta value in the expression
    if (metaValue !== undefined) {
      let replaceValue;

      if (typeof metaValue === "object") {
        replaceValue = JSON.stringify(metaValue);
      } else if (typeof metaValue === "string" && hasOperators) {
        // If the meta value is a string and we're in an expression with operators,
        // only quote it if it contains spaces or special characters
        if (/[\s\(\)\[\]\{\}\,\;\:\.\+\-\*\/\|\&\!\?\<\>\=]/.test(metaValue)) {
          replaceValue = `"${metaValue.replace(/"/g, '\\"')}"`;
        } else {
          replaceValue = metaValue;
        }
      } else {
        replaceValue = metaValue.toString();
      }

      result = result.replace(match[0], replaceValue);
    }
  }

  return result;
}

/**
 * Gets a meta value from the context based on its path and scope.
 * @param {string} path - The path to the meta value.
 * @param {object} context - Context object containing meta values.
 * @returns {*} - The value of the meta value, or undefined if not found.
 */
function getMetaValue(path, context) {
  if (!context) {
    return undefined;
  }

  // Handle JSON pointer notation (#/path/to/property)
  const [basePath, jsonPointer] = path.split("#");

  // Replace template variables in the path (e.g., {{id}})
  const resolvedPath = resolvePathTemplateVariables(basePath, context);

  // Get the base value based on path
  let value = getNestedProperty(context, resolvedPath);

  // Apply JSON pointer if present
  if (jsonPointer && value) {
    try {
      const jsonPath = jsonPointer.split("/").filter(Boolean);
      for (const key of jsonPath) {
        value = value[key];
        if (value === undefined) break;
      }
    } catch (error) {
      log(
        `Error applying JSON pointer ${jsonPointer} to value: ${error.message}`,
        "error"
      );
    }
  }

  return value;
}

/**
 * Replaces simple template variables (e.g., {{id}}) in a path with their values from context.
 * This is specifically for meta value paths, not for general expression evaluation.
 * @param {string} path - The path containing template variables.
 * @param {object} context - Context object containing variable values.
 * @returns {string} - The path with template variables replaced.
 */
function resolvePathTemplateVariables(path, context) {
  const templateRegex = /\{\{(\w+)\}\}/g;
  return path.replace(templateRegex, (match, varName) => {
    // Resolve path variable values
    if (context && context.id && varName === "id") {
      return context.id;
    }
    // Add other variable resolutions as needed
    return match; // Return the original if not found
  });
}

/**
 * Resolves embedded expressions within a string using {{expression}} syntax.
 * This handles full expression evaluation between {{ and }} delimiters.
 * @param {string} str - The string containing embedded expressions.
 * @param {object} context - Context object containing values for evaluation.
 * @returns {string} - The string with embedded expressions replaced with their evaluated values.
 */
async function resolveEmbeddedExpressions(str, context) {
  if (typeof str !== "string") {
    return str;
  }

  const expressionRegex = /\{\{([^{}]+)\}\}/g;

  return str.replace(expressionRegex, async (match, expression) => {
    try {
      // First resolve any meta values within the expression
      const resolvedExpression = await resolveExpression(
        expression.trim(),
        context
      );

      // Convert the result to string for embedding
      if (resolvedExpression === undefined || resolvedExpression === null) {
        return "";
      }

      if (typeof resolvedExpression === "object") {
        return JSON.stringify(resolvedExpression);
      }

      return String(resolvedExpression);
    } catch (error) {
      log(
        `Error evaluating embedded expression '${expression}': ${error.message}`,
        "error"
      );
      return match; // Return the original expression if evaluation fails
    }
  });
}

/**
 * Gets a nested property from an object by its path.
 * @param {object} obj - The object to get the property from.
 * @param {string} path - The path to the property (e.g., 'a.b.c').
 * @returns {*} - The value of the property, or undefined if not found.
 */
function getNestedProperty(obj, path) {
  if (!obj || !path) return undefined;

  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Checks if an expression contains operators.
 * @param {string} expression - The expression to check.
 * @returns {boolean} - Whether the expression contains operators.
 */
function containsOperators(expression) {
  const operatorRegex = /[><=!&|()[\]]+|contains|oneOf|matches/;
  return operatorRegex.test(expression);
}

/**
 * Evaluates an expression containing operators.
 * @param {string} expression - The expression to evaluate.
 * @param {object} context - Context object that might be needed for evaluation.
 * @returns {*} - The result of the evaluation.
 */
async function evaluateExpression(expression, context) {
  try {
    // Handle special operators that aren't valid JS syntax
    expression = preprocessExpression(expression);

    // Create a safe evaluation context
    const evalContext = {
      ...context,
      //   contains: (a, b) => {
      //     if (typeof a === "string") return a.includes(b);
      //     if (Array.isArray(a)) return a.includes(b);
      //     if (typeof a === "object" && a !== null) return b in a;
      //     return false;
      //   },
      //   oneOf: (value, options) => {
      //     if (!Array.isArray(options)) return false;
      //     return options.includes(value);
      //   },
      //   matches: (str, regex) => {
      //     if (typeof str !== "string") return false;
      //     return new RegExp(regex).test(str);
      //   },
      //   jsonpath: (obj, path) => {
      //     try {
      //       return JSONPath({ path, json: obj });
      //     } catch (e) {
      //       log(`JSONPath error: ${e.message}`, "error");
      //       return null;
      //     }
      //   },
      //   xpath: (xml, path) => {
      //     try {
      //       const doc = new DOMParser().parseFromString(xml);
      //       return xpath.select(path, doc);
      //     } catch (e) {
      //       log(`XPath error: ${e.message}`, "error");
      //       return null;
      //     }
      //   },
      jq: (json, query) => {
        try {
          return jq.then((jq) => jq.json(json, query));
        } catch (e) {
          log(`jq error: ${e.message}`, "error");
          return null;
        }
      },
    };

    // Use Function constructor for safer evaluation
    const evaluator = new Function(
      ...Object.keys(evalContext),
      `return ${expression};`
    );
    return evaluator(...Object.values(evalContext));
  } catch (error) {
    log(
      `Error evaluating expression '${expression}': ${error.message}`,
      "error"
    );
    return undefined;
  }
}

/**
 * Preprocesses an expression to handle special operators like 'contains', 'oneOf', and 'matches'.
 * Also handles unquoted string literals that should be treated as strings not variables.
 * @param {string} expression - The expression to preprocess.
 * @returns {string} - The preprocessed expression.
 */
function preprocessExpression(expression) {
  // Replace "contains" operator
  expression = expression.replace(
    /(\S+)\s+contains\s+(\S+)/g,
    "contains($1, $2)"
  );

  // Replace "oneOf" operator
  expression = expression.replace(/(\S+)\s+oneOf\s+(\S+)/g, "oneOf($1, $2)");

  // Replace "matches" operator
  expression = expression.replace(
    /(\S+)\s+matches\s+(\S+)/g,
    "matches($1, $2)"
  );

  // Handle unquoted identifiers on both sides of comparisons
  // First handle unquoted identifiers on the right side of comparisons
  expression = expression.replace(
    /(==|!=|>|>=|<|<=)\s+([A-Za-z]\w*)(?!\s*[\(\.\[])/g,
    (match, operator, word) => {
      // Skip JavaScript keywords that might be valid in expressions
      const jsKeywords = [
        "true",
        "false",
        "null",
        "undefined",
        "NaN",
        "Infinity",
      ];
      if (!jsKeywords.includes(word)) {
        return `${operator} "${word}"`;
      }
      return match;
    }
  );

  // Now handle potential string literals without quotes (like variable names not in context)
  expression = expression.replace(
    /\b(\w+)\s*(==|!=|>|>=|<|<=)/g,
    (match, word, operator) => {
      // Skip meta values (already processed) and known variables in context
      if (
        word.startsWith("$$") ||
        ["true", "false", "null", "undefined", "NaN", "Infinity"].includes(word)
      ) {
        return match;
      }
      // Add quotes around identifiers that might be string literals
      return `"${word}" ${operator}`;
    }
  );

  // Debug the expression after preprocessing
  console.log(`Preprocessed expression: ${expression}`);

  return expression;
}

/**
 * Evaluates an assertion based on the given expression and context.
 * @param {string} assertion - The assertion expression.
 * @param {object} context - Context object containing meta values.
 * @param {string} scope - The scope level: 'spec', 'test', or 'step'.
 * @returns {boolean} - Whether the assertion passes.
 */
async function evaluateAssertion(assertion, context, scope = "step") {
  try {
    const resolvedAssertion = await resolveExpression(
      assertion,
      context,
      scope
    );

    // If the resolved assertion is already a boolean, return it
    if (typeof resolvedAssertion === "boolean") {
      return resolvedAssertion;
    }

    // If it's a string that equals 'true' or 'false', convert to boolean
    if (resolvedAssertion === "true") return true;
    if (resolvedAssertion === "false") return false;

    // Otherwise evaluate it
    return !!resolvedAssertion;
  } catch (error) {
    log(`Error evaluating assertion '${assertion}': ${error.message}`, "error");
    return false;
  }
}

module.exports = {
  resolveExpression,
  evaluateAssertion,
  getMetaValue,
  replaceMetaValues,
};

// Run the main function to test the code
if (require.main === module) {
  (async () => {
    try {
      const context = {
        steps: {
          extractUserData: {
            outputs: {
              userName: "John", // Changed from "John Doe" to "John" to match the test
              email: "john.doe@example.com",
            },
          },
        },
        statusCode: 200,
        response: {
          body: {
            users: [
              {
                id: 1,
                name: "John",
              },
              {
                id: 2,
                name: "Doe",
              },
            ],
            message: "Success",
            success: false,
          },
        },
        foobar: 100,
      };

      // Test
      let expression = "$$response.body";
      console.log(`Original expression: ${expression}`);
      let resolvedValue = await resolveExpression(expression, context);
      console.log(`Resolved value: ${resolvedValue}`);
    } catch (error) {
      console.error(`Error running test: ${error.message}`);
    }
  })();
}
