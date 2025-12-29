#!/usr/bin/env node
/**
 * Test script to demonstrate "waiting for user" spans in Sentry
 * 
 * These spans show time spent waiting for user action/decision:
 * - waiting_for_user.reviewing_initial_plan: User reviewing first AI-generated plan
 * - waiting_for_user.reviewing_iteration: User reviewing updated plan after feedback
 * 
 * This helps answer:
 * - How long do users take to review plans before committing?
 * - Do users hesitate more on first plan or iterations?
 * - What's the distribution of user "think time"?
 */

const Sentry = require('@sentry/node');

// Configuration
const FRONTEND_DSN = 'https:// 0bdc0587668a5c8e493c065614c8b741@o4508236363464704.ingest.us.sentry.io/4509993588424704';

// Initialize Sentry
Sentry.init({
  dsn: FRONTEND_DSN,
  tracesSampleRate: 1.0,
  environment: 'test-user-waiting-spans',
});

// Utilities
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TEMPLATES = [
  { id: 'template-1', name: 'Health & Fitness Plan' },
  { id: 'template-2', name: 'Career Development' },
  { id: 'template-3', name: 'Financial Planning' },
];

/**
 * Generate a flow with realistic user waiting/review time
 */
async function generateFlowWithUserWaitTime(scenario) {
  const template = TEMPLATES[randomInt(0, TEMPLATES.length - 1)];
  const flowId = `flow-user-wait-${Date.now()}-${randomInt(1000, 9999)}`;
  
  console.log(`\n📊 ${scenario.name}`);
  console.log(`   Template: ${template.name}`);
  console.log(`   Review time: ${scenario.initialReviewTime}ms`);
  if (scenario.iterations > 0) {
    console.log(`   Iterations: ${scenario.iterations}, iteration review: ${scenario.iterationReviewTime}ms`);
  }

  return Sentry.startSpan(
    {
      name: 'action_plan_creation_flow',
      op: 'user_flow.action_plan',
      attributes: {
        'flow.type': 'action_plan_creation',
        'flow.id': flowId,
        'flow.status': 'completed',
        'template.id': template.id,
        'template.name': template.name,
        'flow.iteration_number': scenario.iterations + 1,
        'flow.success': 1,
      },
    },
    async (flowSpan) => {
      // Initial flow steps
      await Sentry.startSpan(
        { name: 'flow.step.template_selected', op: 'flow.step', attributes: { 'flow.id': flowId } },
        async () => await sleep(randomInt(5, 15))
      );

      await Sentry.startSpan(
        { name: 'flow.step.message_sent', op: 'flow.step', attributes: { 'flow.id': flowId } },
        async () => await sleep(randomInt(10, 30))
      );

      await Sentry.startSpan(
        { name: 'flow.step.api_request_started', op: 'flow.step', attributes: { 'flow.id': flowId } },
        async () => await sleep(randomInt(10, 20))
      );

      // AI generation (backend)
      const aiDuration = randomInt(2000, 5000);
      await Sentry.startSpan(
        {
          name: 'API Call: Generate Action Plan',
          op: 'http.client',
          attributes: {
            'http.method': 'POST',
            'http.url': 'http://localhost:8000/api/v1/action-plan/generate',
            'http.status_code': 200,
          },
        },
        async () => await sleep(aiDuration / 20)
      );

      await Sentry.startSpan(
        { name: 'flow.step.api_response_received', op: 'flow.step', attributes: { 'flow.id': flowId } },
        async () => await sleep(randomInt(10, 30))
      );

      await Sentry.startSpan(
        { name: 'flow.step.plan_parsed', op: 'flow.step', attributes: { 'flow.id': flowId } },
        async () => await sleep(randomInt(5, 15))
      );

      await Sentry.startSpan(
        { name: 'flow.step.plan_rendered', op: 'flow.step', attributes: { 'flow.id': flowId } },
        async () => await sleep(randomInt(10, 30))
      );

      // ⏳ WAITING FOR USER - Reviewing initial plan
      console.log(`   ⏳ User reviewing initial plan...`);
      await Sentry.startSpan(
        {
          name: 'waiting_for_user.reviewing_initial_plan',
          op: 'user.wait',
          attributes: {
            'flow.id': flowId,
            'wait.context': 'reviewing_initial_plan',
            'wait.duration_ms': scenario.initialReviewTime,
            'wait.user_action': scenario.iterations > 0 ? 'request_changes' : 'commit_plan',
          },
        },
        async () => await sleep(scenario.initialReviewTime / 10)
      );

      console.log(`   ✅ User decided: ${scenario.iterations > 0 ? 'Request changes' : 'Commit plan'}`);

      // Handle iterations
      for (let i = 0; i < scenario.iterations; i++) {
        console.log(`   🔄 Iteration ${i + 1}...`);

        await Sentry.startSpan(
          { name: 'flow.step.user_continued', op: 'flow.step', attributes: { 'flow.id': flowId, iteration: i + 1 } },
          async () => await sleep(randomInt(10, 30))
        );

        // AI iteration
        const iterationAiDuration = randomInt(1500, 4000);
        await Sentry.startSpan(
          {
            name: 'API Call: Refine Action Plan',
            op: 'http.client',
            attributes: {
              'http.method': 'POST',
              'http.url': 'http://localhost:8000/api/v1/action-plan/refine',
              'http.status_code': 200,
              iteration: i + 1,
            },
          },
          async () => await sleep(iterationAiDuration / 20)
        );

        await Sentry.startSpan(
          { name: 'flow.step.plan_rendered', op: 'flow.step', attributes: { 'flow.id': flowId, iteration: i + 1 } },
          async () => await sleep(randomInt(10, 30))
        );

        // ⏳ WAITING FOR USER - Reviewing iteration
        const isLastIteration = i === scenario.iterations - 1;
        console.log(`   ⏳ User reviewing iteration ${i + 1}...`);
        
        await Sentry.startSpan(
          {
            name: 'waiting_for_user.reviewing_iteration',
            op: 'user.wait',
            attributes: {
              'flow.id': flowId,
              'wait.context': 'reviewing_iteration',
              'wait.iteration_number': i + 1,
              'wait.duration_ms': scenario.iterationReviewTime,
              'wait.user_action': isLastIteration ? 'commit_plan' : 'request_changes',
            },
          },
          async () => await sleep(scenario.iterationReviewTime / 10)
        );

        console.log(`   ✅ User decided: ${isLastIteration ? 'Commit plan' : 'Request more changes'}`);
      }

      // Commit
      await Sentry.startSpan(
        { name: 'flow.step.plan_committed', op: 'flow.step', attributes: { 'flow.id': flowId } },
        async () => await sleep(randomInt(10, 30))
      );

      await Sentry.startSpan(
        { name: 'flow.step.card_displayed', op: 'flow.step', attributes: { 'flow.id': flowId } },
        async () => await sleep(randomInt(10, 20))
      );

      console.log(`   ✅ Flow completed!`);
    }
  );
}

/**
 * Main test runner
 */
async function runUserWaitingSpansTest() {
  console.log('\n' + '='.repeat(80));
  console.log('  ⏳ USER WAITING SPANS TEST GENERATOR');
  console.log('  Demonstrates "waiting for user" spans in Sentry');
  console.log('='.repeat(80));

  const scenarios = [
    // Quick commitments (users decide fast)
    {
      name: 'Quick Commit (Fast Decision)',
      initialReviewTime: randomInt(2000, 5000),
      iterations: 0,
    },
    {
      name: 'Quick Commit (Fast Decision)',
      initialReviewTime: randomInt(2000, 5000),
      iterations: 0,
    },
    {
      name: 'Quick Commit (Fast Decision)',
      initialReviewTime: randomInt(2000, 5000),
      iterations: 0,
    },

    // Medium review time (typical users)
    {
      name: 'Moderate Review (Typical)',
      initialReviewTime: randomInt(8000, 15000),
      iterations: 0,
    },
    {
      name: 'Moderate Review (Typical)',
      initialReviewTime: randomInt(8000, 15000),
      iterations: 0,
    },
    {
      name: 'Moderate Review (Typical)',
      initialReviewTime: randomInt(8000, 15000),
      iterations: 0,
    },
    {
      name: 'Moderate Review (Typical)',
      initialReviewTime: randomInt(8000, 15000),
      iterations: 0,
    },

    // Long deliberation (users thinking hard)
    {
      name: 'Long Deliberation (Careful Review)',
      initialReviewTime: randomInt(20000, 40000),
      iterations: 0,
    },
    {
      name: 'Long Deliberation (Careful Review)',
      initialReviewTime: randomInt(20000, 40000),
      iterations: 0,
    },

    // With iterations (users request changes)
    {
      name: 'One Iteration (Quick Reviews)',
      initialReviewTime: randomInt(5000, 10000),
      iterationReviewTime: randomInt(3000, 7000),
      iterations: 1,
    },
    {
      name: 'One Iteration (Moderate Reviews)',
      initialReviewTime: randomInt(10000, 20000),
      iterationReviewTime: randomInt(8000, 15000),
      iterations: 1,
    },
    {
      name: 'Two Iterations (Moderate Reviews)',
      initialReviewTime: randomInt(8000, 15000),
      iterationReviewTime: randomInt(6000, 12000),
      iterations: 2,
    },
    {
      name: 'Three Iterations (Perfectionists)',
      initialReviewTime: randomInt(15000, 25000),
      iterationReviewTime: randomInt(10000, 18000),
      iterations: 3,
    },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    console.log(`\n[${index + 1}/${scenarios.length}] ==================`);
    
    await generateFlowWithUserWaitTime(scenario);
    
    // Small delay between flows
    await sleep(200);
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ✅ USER WAITING SPANS TEST COMPLETE');
  console.log('='.repeat(80));
  console.log('\n📊 Summary:');
  console.log(`  - ${scenarios.length} flows generated with user waiting spans`);
  console.log(`  - ${scenarios.filter(s => s.iterations === 0).length} immediate commits`);
  console.log(`  - ${scenarios.filter(s => s.iterations > 0).length} flows with iterations`);
  
  console.log('\n🔍 What to check in Sentry:');
  console.log('  1. Filter by span.op:user.wait');
  console.log('  2. Group by wait.context to see initial vs iteration reviews');
  console.log('  3. Analyze p50/p95 of wait.duration_ms');
  console.log('  4. Check wait.user_action distribution (commit vs request_changes)');
  
  console.log('\n📈 Dashboard Queries:');
  console.log('  Average review time: avg(measurements.wait.duration_ms) WHERE span.op = "user.wait"');
  console.log('  By context: GROUP BY wait.context');
  console.log('  User actions: COUNT GROUP BY wait.user_action');
  
  console.log('\n⏳ Wait 2-3 minutes for Sentry to process the data\n');
}

// Flush and exit
async function flushAndExit() {
  console.log('\n📤 Flushing data to Sentry...');
  await Sentry.flush(5000);
  console.log('✅ Flush complete!\n');
  process.exit(0);
}

// Run the test
runUserWaitingSpansTest()
  .then(flushAndExit)
  .catch((error) => {
    console.error('❌ Error generating test data:', error);
    process.exit(1);
  });




