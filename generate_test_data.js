#!/usr/bin/env node
/**
 * Generate synthetic flow data for Sentry dashboards
 * Creates variety: different statuses, dropout points, durations, iterations
 */

const Sentry = require('@sentry/node');
const axios = require('axios');

Sentry.init({
  dsn: 'https://0bdc0587668a5c8e493c065614c8b741@o4508236363464704.ingest.us.sentry.io/4509993588424704',
  tracesSampleRate: 1.0,
  debug: false,
  environment: 'synthetic-data',
});

// Templates to choose from
const TEMPLATES = [
  { id: 'health-fitness', name: 'Health & Fitness Plan' },
  { id: 'career-development', name: 'Career Development Plan' },
  { id: 'financial-goals', name: 'Financial Goals Plan' },
  { id: 'learning-new-skill', name: 'Learning New Skill' },
  { id: 'side-project', name: 'Side Project Launch' },
];

// Flow statuses and their probabilities
const FLOW_OUTCOMES = [
  { status: 'completed', weight: 60 },      // 60% complete
  { status: 'abandoned', weight: 30 },      // 30% abandon
  { status: 'failed', weight: 10 },         // 10% fail
];

// Dropout reasons
const DROPOUT_REASONS = [
  'user_navigated_away',
  'new_flow_started',
  'api_request',
  'plan_commit',
];

// Steps in order
const STEPS = [
  { name: 'template_selected', order: 1, weight: 20 },
  { name: 'message_sent', order: 2, weight: 40 },
  { name: 'api_request_started', order: 3, weight: 50 },
  { name: 'api_response_received', order: 4, weight: 60 },
  { name: 'plan_parsed', order: 5, weight: 70 },
  { name: 'plan_rendered', order: 6, weight: 80 },
  { name: 'plan_committed', order: 7, weight: 90 },
  { name: 'card_displayed', order: 8, weight: 100 },
];

// Helper: Random choice with weights
function weightedChoice(options) {
  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const option of options) {
    random -= option.weight;
    if (random <= 0) return option;
  }
  return options[0];
}

// Helper: Random int between min and max
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Random duration with some variance
function randomDuration(base, variance = 0.3) {
  const min = base * (1 - variance);
  const max = base * (1 + variance);
  return randomInt(min, max);
}

// Generate one flow
async function generateFlow(flowNumber) {
  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const outcome = weightedChoice(FLOW_OUTCOMES);
  const iterations = outcome.status === 'completed' ? randomInt(1, 5) : randomInt(1, 3);
  const flowId = `synthetic-${Date.now()}-${flowNumber}`;
  
  console.log(`\n[${flowNumber}] Generating flow: ${template.name} → ${outcome.status}`);
  
  // Determine dropout point for abandoned/failed flows
  let dropoutStepIndex = STEPS.length; // Complete all by default
  if (outcome.status === 'abandoned') {
    // Abandon at various points (weighted towards later steps)
    const weights = [5, 10, 15, 20, 25, 15, 5, 5]; // Less likely early, more in middle
    dropoutStepIndex = weightedChoice(
      STEPS.map((s, i) => ({ index: i, weight: weights[i] }))
    ).index;
  } else if (outcome.status === 'failed') {
    // Failures typically happen during API calls
    dropoutStepIndex = randomInt(2, 4);
  }
  
  // Create parent flow span
  const flowSpan = Sentry.startInactiveSpan({
    name: 'action_plan_creation_flow',
    op: 'user_flow.action_plan',
    forceTransaction: true,
    attributes: {
      'flow.type': 'action_plan_creation',
      'flow.id': flowId,
      'flow.status': 'started',
      'template.id': template.id,
      'template.name': template.name,
      'flow.total_iterations': iterations,
    },
  });
  
  if (!flowSpan) {
    console.error('Failed to create flow span');
    return;
  }
  
  let currentStep = 0;
  let totalTokens = 0;
  
  // Execute steps until dropout
  for (let i = 0; i < dropoutStepIndex && i < STEPS.length; i++) {
    const step = STEPS[i];
    currentStep = i;
    
    await Sentry.withActiveSpan(flowSpan, async () => {
      await new Promise(resolve => setTimeout(resolve, randomInt(10, 50)));
      
      Sentry.startSpan({
        name: `flow.step.${step.name}`,
        op: 'flow.step',
        attributes: {
          'step.order': step.order,
          'step.name': step.name,
          'step.weight': step.weight,
          'flow.id': flowId,
          'flow.type': 'action_plan_creation',
        },
      }, () => {
        // Step completes immediately
      });
      
      // Update parent
      flowSpan.setAttribute('flow.last_completed_step', step.name);
      flowSpan.setAttribute('flow.completion_percentage', step.weight);
      
      // Simulate API call at the right step
      if (step.name === 'api_request_started') {
        const apiDuration = randomDuration(2000, 0.5); // 1-3 seconds
        const apiTokens = randomInt(500, 2000);
        totalTokens += apiTokens;
        
        await new Promise(resolve => setTimeout(resolve, randomInt(50, 100)));
        
        // Create API call span
        Sentry.startSpan({
          name: 'API Call: Generate Action Plan',
          op: 'function',
          attributes: {
            'api.endpoint': '/action-plan/generate',
            'api.method': 'POST',
            'flow.id': flowId,
          },
        }, async (apiSpan) => {
          await new Promise(resolve => setTimeout(resolve, apiDuration));
          
          // If this is a failure point, fail the API
          if (outcome.status === 'failed' && i === dropoutStepIndex - 1) {
            apiSpan.setStatus({ code: 2, message: 'API Error' }); // ERROR
          }
        });
        
        flowSpan.setAttribute('flow.api_calls_count', iterations);
        flowSpan.setAttribute('flow.total_tokens_used', totalTokens);
      }
      
      // Simulate iterations
      if (step.name === 'api_response_received' && iterations > 1) {
        for (let iter = 2; iter <= iterations; iter++) {
          await new Promise(resolve => setTimeout(resolve, randomInt(100, 300)));
          
          Sentry.startSpan({
            name: `flow.iteration.${iter}`,
            op: 'flow.iteration',
            attributes: {
              'iteration.number': iter,
              'flow.id': flowId,
            },
          }, () => {});
          
          flowSpan.setAttribute('flow.iteration_number', iter);
        }
      }
    });
  }
  
  // Finalize flow based on outcome
  const totalDuration = randomDuration(
    outcome.status === 'completed' ? 8000 : 
    outcome.status === 'abandoned' ? 4000 : 
    2000
  );
  
  flowSpan.setAttribute('flow.status', outcome.status);
  flowSpan.setAttribute('flow.total_duration_ms', totalDuration);
  
  if (outcome.status === 'completed') {
    flowSpan.setAttribute('flow.success', 1);
    flowSpan.setAttribute('flow.completion_percentage', 100);
  } else if (outcome.status === 'abandoned') {
    flowSpan.setAttribute('flow.success', 0);
    flowSpan.setAttribute('flow.dropout_step', STEPS[currentStep].name);
    flowSpan.setAttribute('flow.dropout_reason', 
      DROPOUT_REASONS[Math.floor(Math.random() * DROPOUT_REASONS.length)]
    );
  } else if (outcome.status === 'failed') {
    flowSpan.setAttribute('flow.success', 0);
    flowSpan.setAttribute('flow.dropout_step', STEPS[currentStep].name);
    flowSpan.setAttribute('flow.dropout_reason', 'api_request');
    flowSpan.setAttribute('flow.error_message', 'API request timeout');
  }
  
  // Wait a bit to simulate real flow duration
  await new Promise(resolve => setTimeout(resolve, randomInt(100, 300)));
  
  flowSpan.end();
  console.log(`   ✓ ${outcome.status} at step ${currentStep + 1}/${STEPS.length} (${iterations} iterations)`);
}

// Main: Generate many flows
async function generateData(count = 100) {
  console.log(`\n🎲 Generating ${count} synthetic flows...\n`);
  console.log('Scenarios:');
  console.log('  - 60% completed flows');
  console.log('  - 30% abandoned flows (various dropout points)');
  console.log('  - 10% failed flows (API errors)');
  console.log('  - 1-5 iterations per flow');
  console.log('  - 5 different templates');
  console.log('  - Varying durations and token usage\n');
  
  const batchSize = 10; // Generate in batches to avoid overwhelming
  
  for (let batch = 0; batch < Math.ceil(count / batchSize); batch++) {
    const batchStart = batch * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, count);
    
    console.log(`\n📦 Batch ${batch + 1}/${Math.ceil(count / batchSize)} (flows ${batchStart + 1}-${batchEnd})`);
    
    const promises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      promises.push(generateFlow(i + 1));
    }
    
    await Promise.all(promises);
    
    // Flush to Sentry
    console.log(`\n   ⏳ Flushing batch to Sentry...`);
    await Sentry.flush(3000);
    console.log(`   ✅ Batch sent!`);
    
    // Small delay between batches
    if (batch < Math.ceil(count / batchSize) - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n✅ Generated ${count} flows!`);
  console.log(`\n📊 Check Sentry in a few moments:`);
  console.log(`   Environment: synthetic-data`);
  console.log(`   https://snout-and-about.sentry.io/performance/traces/`);
  console.log(`\n🔍 Example queries:`);
  console.log(`   environment:synthetic-data span.op:user_flow.action_plan`);
  console.log(`   environment:synthetic-data flow.status:abandoned`);
  console.log(`   environment:synthetic-data flow.dropout_step:*`);
}

// Parse command line args
const args = process.argv.slice(2);
const count = args[0] ? parseInt(args[0]) : 100;

if (isNaN(count) || count < 1) {
  console.error('Usage: node generate_test_data.js [count]');
  console.error('Example: node generate_test_data.js 100');
  process.exit(1);
}

// Run
generateData(count)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });






