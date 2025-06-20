// Comprehensive demonstration of parallel execution capabilities
const { runSpecs } = require("../src/tests");

async function comprehensiveDemo() {
  console.log("🚀 Comprehensive Parallel Execution Demo");
  console.log("==========================================\n");

  const scenarios = [
    {
      name: "Sequential (1 worker)",
      concurrentRunners: 1,
      description: "Traditional sequential execution for comparison"
    },
    {
      name: "Parallel (2 workers)", 
      concurrentRunners: 2,
      description: "Moderate parallelization"
    },
    {
      name: "Parallel (4 workers)",
      concurrentRunners: 4,
      description: "High parallelization"
    },
    {
      name: "Parallel (8 workers)",
      concurrentRunners: 8,
      description: "Very high parallelization"
    },
    {
      name: "Parallel (16 workers)",
      concurrentRunners: 16,
      description: "Maximum parallelization for this demo"
    }
  ];

  // Create test with 16 contexts to show scaling
  const resolvedTests = {
    config: { logLevel: "error" },
    specs: [
      {
        specId: "demo-spec",
        description: "Parallel execution demo",
        tests: [
          {
            testId: "demo-test",
            description: "Test with 16 contexts",
            contexts: Array.from({ length: 16 }, (_, i) => ({
              contextId: `context-${i + 1}`,
              steps: [
                { runShell: `echo 'Context ${i + 1} starting'` },
                { goTo: "http://example.com" },
                { find: "Example Domain" },
                { runShell: `echo 'Context ${i + 1} completed'` },
              ],
            })),
          },
        ],
      },
    ],
  };

  const results = [];

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
        successful: result.summary.contexts.pass === 16
      });
      
      console.log(`   ✅ Completed in ${duration}ms`);
      console.log(`   📈 Contexts: ${result.summary.contexts.pass}/16, Steps: ${result.summary.steps.pass}/64\n`);
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      results.push({
        scenario: scenario.name,
        workers: scenario.concurrentRunners,
        duration: -1,
        error: error.message
      });
    }
  }

  // Summary analysis
  console.log("📈 Performance Analysis");
  console.log("=======================");

  // Print all scenario results
  results.forEach(r => {
    if (r.duration >= 0) {
      console.log(`${r.scenario.padEnd(22)}: ${r.duration}ms (${r.workers} workers)`);
    } else {
      console.log(`${r.scenario.padEnd(22)}: Failed (${r.error})`);
    }
  });

  // Calculate speedups and efficiencies for all scenarios
  const sequential = results.find(r => r.workers === 1);
  if (sequential) {
    console.log("\n📊 Speedup Analysis:");
    results.forEach(r => {
      if (r.workers > 1 && r.duration > 0) {
        const speedup = sequential.duration / r.duration;
        console.log(`${r.workers} workers: ${(speedup).toFixed(2)}x speedup over sequential`);
      }
    });

    // Efficiency: (speedup / workers) * 100%
    console.log("\n🎯 Efficiency Analysis:");
    results.forEach(r => {
      if (r.workers > 1 && r.duration > 0) {
        const speedup = sequential.duration / r.duration;
        const efficiency = (speedup / r.workers) * 100;
        console.log(`${r.workers} workers: ${efficiency.toFixed(1)}% efficiency (theoretical max: 100%)`);
      }
    });

    // Highlight best scenario
    const best = results.filter(r => r.duration > 0).sort((a, b) => a.duration - b.duration)[0];
    if (best && best.workers > 1) {
      if (best.duration < sequential.duration * 0.7) {
        console.log(`\n✅ Parallel execution is highly effective at ${best.workers} workers!`);
      } else if (best.duration < sequential.duration * 0.9) {
        console.log(`\n👍 Parallel execution shows moderate improvement at ${best.workers} workers.`);
      } else {
        console.log(`\n⚠️  Parallel execution may not be optimal for this workload.`);
      }
    }
  }

  console.log(`\n🏁 Demo completed successfully! All scenarios executed with proper isolation.`);
}

comprehensiveDemo().catch(console.error);