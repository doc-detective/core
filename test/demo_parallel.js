// Comprehensive demonstration of parallel execution capabilities
const { runSpecs } = require("../src/tests");
const { createServer } = require("./server");

// Create a server with custom options
const server = createServer({
  port: 8080,
  staticDir: "./test/server/public",
  logLevel: "silent",
});

async function comprehensiveDemo() {
  console.log("🚀 Comprehensive Parallel Execution Benchmark");
  console.log("==========================================\n");

  // Accept maxWorkers override from a -w argument
  let maxWorkers = 16; // Default maximum number of parallel contexts

  console.log(
    `🔧 Configuring benchmark with up to ${maxWorkers} parallel contexts`
  );

  const scenarios = [];
  let runners = 1;
  while (runners <= maxWorkers) {
    let description;
    if (runners === 1) {
      description = "Traditional sequential execution for comparison";
    } else if (runners === 2) {
      description = "Minimal parallelization";
    } else if (runners === 4) {
      description = "Moderate parallelization";
    } else if (runners === maxWorkers) {
      description = "Maximum parallelization for this demo";
    } else {
      description = `Parallelization with ${runners} workers`;
    }
    scenarios.push({
      name:
        runners === 1
          ? "Sequential (1 worker)"
          : `Parallel (${runners} workers)`,
      concurrentRunners: runners,
      description,
    });
    if (runners === 1) {
      runners = 2;
    } else if (runners === 2) {
      runners = 4;
    } else {
      runners += 4;
      if (runners > maxWorkers && runners - 4 !== maxWorkers) {
        runners = maxWorkers;
      }
    }
  }

  const testArray = [
    {
      testId: `demo-test-1`,
      contexts: [
        {
          contextId: `context-1`,
          steps: [
            { goTo: "http://localhost:8080" },
            { find: "Selection Elements" },
            { click: "Option 1" },
          ],
        },
      ],
    },
    {
      testId: "demo-test-2",
      contexts: [
        {
          contextId: `context-2`,
          steps: [
            { runShell: `echo 'Context 2'` },
            {
              runCode: {
                language: "javascript",
                code: `console.log('Running in context')`,
              },
            },
          ],
        },
      ],
    },
    {
      testId: "demo-test-3",
      contexts: [
        {
          steps: [
            {
              runCode: {
                language: "python",
                code: `print('additional step')`,
              },
            },
          ],
        },
      ],
    },
    {
      testId: "demo-test-4",
      contexts: [
        {
          contextId: `context-1-4`,
          steps: [
            {
              httpRequest: {
                url: "http://localhost:8080/api/users",
                method: "post",
                request: {
                  body: {
                    name: "$USER",
                    job: "$JOB",
                  },
                },
              },
            },
            {
              httpRequest: {
                url: "http://localhost:8080/api/users",
                method: "post",
                request: {
                  body: {
                    data: [
                      {
                        first_name: "George",
                        last_name: "Bluth",
                        id: 1,
                      },
                    ],
                  },
                },
                response: {
                  body: {
                    data: [
                      {
                        first_name: "George",
                        last_name: "Bluth",
                      },
                    ],
                  },
                },
              },
              variables: {
                ID: "$$response.body.data[0].id",
              },
            },
            {
              httpRequest: {
                url: "http://localhost:8080/api/$ID",
                method: "get",
                timeout: 1000,
              },
            },
          ],
        },
      ],
    },
  ];

  // Create test with n contexts to show scaling
  const resolvedTests = {
    config: { logLevel: "error" },
    specs: [
      {
        specId: "demo-spec",
        description: "Parallel execution demo",
        tests: [],
      },
    ],
  };

  for (let i = 0; i < maxWorkers; i++) {
    resolvedTests.specs[0].tests.push(...testArray);
  }

  const results = [];

  await server.start();

  for (const scenario of scenarios) {
    console.log(`📊 Testing: ${scenario.name}`);
    console.log(`   ${scenario.description}`);

    // Update config for this scenario
    resolvedTests.config.concurrentRunners = scenario.concurrentRunners;

    try {
      const start = Date.now();
      const result = await runSpecs({ resolvedTests });
      const duration = Date.now() - start;

      results.push({
        scenario: scenario.name,
        workers: scenario.concurrentRunners,
        duration,
        contexts: result.summary.contexts.pass,
        steps: result.summary.steps.pass,
        successful: result.summary.contexts.pass === maxWorkers,
      });

      console.log(`   ✅ Completed in ${duration}ms`);
      console.log(
        `   📈 Contexts: ${
          result.summary.contexts.pass
        }/${maxWorkers}, Steps: ${result.summary.steps.pass}/${
          maxWorkers * 4
        }\n`
      );
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      results.push({
        scenario: scenario.name,
        workers: scenario.concurrentRunners,
        duration: -1,
        error: error.message,
      });
    }
  }

  await server.stop();

  // Summary analysis
  console.log("📈 Performance Analysis");
  console.log("=======================");

  // Print all scenario results
  results.forEach((r) => {
    if (r.duration >= 0) {
      console.log(
        `${r.scenario.padEnd(22)}: ${r.duration}ms (${r.workers} workers)`
      );
    } else {
      console.log(`${r.scenario.padEnd(22)}: Failed (${r.error})`);
    }
  });

  // Calculate speedups and efficiencies for all scenarios
  const sequential = results.find((r) => r.workers === 1);
  if (sequential) {
    console.log("\n📊 Speedup Analysis:");
    results.forEach((r) => {
      if (r.workers > 1 && r.duration > 0) {
        const speedup = sequential.duration / r.duration;
        console.log(
          `${r.workers} workers: ${speedup.toFixed(2)}x speedup over sequential`
        );
      }
    });

    // Efficiency: (speedup / workers) * 100%
    console.log("\n🎯 Efficiency Analysis:");
    results.forEach((r) => {
      if (r.workers > 1 && r.duration > 0) {
        const speedup = sequential.duration / r.duration;
        const efficiency = (speedup / r.workers) * 100;
        console.log(
          `${r.workers} workers: ${efficiency.toFixed(
            1
          )}% efficiency (theoretical max: 100%)`
        );
      }
    });

    // Highlight best scenario
    const best = results
      .filter((r) => r.duration > 0)
      .sort((a, b) => a.duration - b.duration)[0];
    if (best && best.workers > 1) {
      if (best.duration < sequential.duration * 0.7) {
        console.log(
          `\n✅ Parallel execution is highly effective at ${best.workers} workers!`
        );
      } else if (best.duration < sequential.duration * 0.9) {
        console.log(
          `\n👍 Parallel execution shows moderate improvement at ${best.workers} workers.`
        );
      } else {
        console.log(
          `\n⚠️  Parallel execution may not be optimal for this workload.`
        );
      }
    }
  }

  console.log(`\n🏁 Benchmark completed successfully! All scenarios executed.`);
}

comprehensiveDemo().catch(console.error);
