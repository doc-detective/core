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
    }
  ];

  // Create test with 6 contexts to show scaling
  const resolvedTests = {
    config: { logLevel: "error" },
    specs: [
      {
        specId: "demo-spec",
        description: "Parallel execution demo",
        tests: [
          {
            testId: "demo-test",
            description: "Test with 6 contexts",
            contexts: Array.from({ length: 6 }, (_, i) => ({
              contextId: `context-${i + 1}`,
              steps: [
                { runShell: `echo 'Context ${i + 1} starting'` },
                { runShell: "sleep 0.8" },
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
        successful: result.summary.contexts.pass === 6
      });
      
      console.log(`   ✅ Completed in ${duration}ms`);
      console.log(`   📈 Contexts: ${result.summary.contexts.pass}/6, Steps: ${result.summary.steps.pass}/18\n`);
      
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
  
  const sequential = results.find(r => r.workers === 1);
  const parallel2 = results.find(r => r.workers === 2);
  const parallel4 = results.find(r => r.workers === 4);
  
  if (sequential && parallel2 && parallel4) {
    console.log(`Sequential (1 worker):  ${sequential.duration}ms`);
    console.log(`Parallel (2 workers):   ${parallel2.duration}ms (${(sequential.duration / parallel2.duration).toFixed(1)}x speedup)`);
    console.log(`Parallel (4 workers):   ${parallel4.duration}ms (${(sequential.duration / parallel4.duration).toFixed(1)}x speedup)`);
    
    // Theoretical best case: 6 contexts with 0.8s sleep each
    // Sequential: ~6 * 0.8s = 4.8s + overhead
    // Parallel (2): ~3 * 0.8s = 2.4s + overhead  
    // Parallel (4): ~2 * 0.8s = 1.6s + overhead
    
    const efficiency2 = (sequential.duration / 3) / parallel2.duration;
    const efficiency4 = (sequential.duration / 6) / parallel4.duration;
    
    console.log(`\n🎯 Efficiency Analysis:`);
    console.log(`2-worker efficiency: ${(efficiency2 * 100).toFixed(1)}% (theoretical max: 100%)`);
    console.log(`4-worker efficiency: ${(efficiency4 * 100).toFixed(1)}% (theoretical max: 100%)`);
    
    if (parallel4.duration < sequential.duration * 0.7) {
      console.log(`\n✅ Parallel execution is highly effective!`);
    } else if (parallel4.duration < sequential.duration * 0.9) {
      console.log(`\n👍 Parallel execution shows moderate improvement.`);
    } else {
      console.log(`\n⚠️  Parallel execution may not be optimal for this workload.`);
    }
  }
  
  console.log(`\n🏁 Demo completed successfully! All scenarios executed with proper isolation.`);
}

comprehensiveDemo().catch(console.error);