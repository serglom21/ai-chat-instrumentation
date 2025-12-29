#!/usr/bin/env node
/**
 * Test script to generate synthetic data for three critical dropout scenarios:
 * 
 * SCENARIO 1: User sent message → Backend timeout/no response
 * SCENARIO 2: Backend succeeded (200) → Frontend failed to display
 * SCENARIO 3: User abandoned flow mid-way → Accurate timing on unmount
 */

const Sentry = require('@sentry/node');

// Configuration
const FRONTEND_DSN = 'https://0bdc0587668a5c8e493c065614c8b741@o4508236363464704.ingest.us.sentry.io/4509993588424704';

// Initialize Sentry
Sentry.init({
  dsn: FRONTEND_DSN,
  tracesSampleRate: 1.0,
  environment: 'test-dropout-scenarios',
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
 * SCENARIO 1: Backend timeout - user never gets response
 * 
 * Simulates: User selects template → sends message → backend never responds or times out
 * Impact: User stuck on loading spinner, no feedback
 */
async function generateScenario1_BackendTimeout() {
  const template = TEMPLATES[randomInt(0, TEMPLATES.length - 1)];
  const flowId = `flow-timeout-${Date.now()}-${randomInt(1000, 9999)}`;
  const timeoutDuration = randomInt(15000, 35000); // How long user waited before timeout
  
  console.log(`\n💥 SCENARIO 1: Backend Timeout`);
  console.log(`   Template: ${template.name}`);
  console.log(`   Timeout after: ${timeoutDuration}ms`);

  return Sentry.startSpan(
    {
      name: 'action_plan_creation_flow',
      op: 'user_flow.action_plan',
      attributes: {
        'flow.type': 'action_plan_creation',
        'flow.id': flowId,
        'flow.status': 'failed',
        'template.id': template.id,
        'template.name': template.name,
        
        // Error attributes
        'error.type': 'timeout',
        'error.backend_responded': false,
        'error.user_impact': 'no_response_received',
        'flow.dropout_step': 'api_request_started',
        'flow.dropout_reason': 'timeout',
        'flow.error_message': `Request timeout after ${timeoutDuration}ms`,
        'flow.success': 0,
        'flow.total_duration_ms': timeoutDuration,
      },
    },
    async (flowSpan) => {
      // Create initial steps
      await Sentry.startSpan(
        {
          name: 'flow.step.template_selected',
          op: 'flow.step',
          attributes: {
            'step.name': 'template_selected',
            'flow.id': flowId,
          },
        },
        async () => await sleep(randomInt(5, 15))
      );

      await Sentry.startSpan(
        {
          name: 'flow.step.message_sent',
          op: 'flow.step',
          attributes: {
            'step.name': 'message_sent',
            'flow.id': flowId,
          },
        },
        async () => await sleep(randomInt(10, 30))
      );

      await Sentry.startSpan(
        {
          name: 'flow.step.api_request_started',
          op: 'flow.step',
          attributes: {
            'step.name': 'api_request_started',
            'flow.id': flowId,
          },
        },
        async () => await sleep(randomInt(10, 20))
      );

      // Simulate waiting for timeout
      await sleep(timeoutDuration / 20);

      console.log(`   ✅ Created flow with backend timeout error`);
    }
  );
}

/**
 * SCENARIO 2: Backend succeeded (200 OK) but frontend failed to display
 * 
 * Simulates: Backend returns valid 200 response → Frontend parsing/rendering fails
 * Impact: Backend thinks it succeeded, but user never sees the content
 */
async function generateScenario2_FrontendDisplayFailure() {
  const template = TEMPLATES[randomInt(0, TEMPLATES.length - 1)];
  const flowId = `flow-display-fail-${Date.now()}-${randomInt(1000, 9999)}`;
  const apiDuration = randomInt(1500, 4000);
  const failureReasons = [
    'Invalid action plan structure: missing content',
    'Invalid action plan structure: missing id',
    'JSON parsing error: unexpected token',
    'Rendering error: cannot read property of undefined',
  ];
  const failureReason = failureReasons[randomInt(0, failureReasons.length - 1)];
  
  console.log(`\n🎨 SCENARIO 2: Frontend Display Failure`);
  console.log(`   Template: ${template.name}`);
  console.log(`   API Duration: ${apiDuration}ms`);
  console.log(`   Failure: ${failureReason}`);

  return Sentry.startSpan(
    {
      name: 'action_plan_creation_flow',
      op: 'user_flow.action_plan',
      attributes: {
        'flow.type': 'action_plan_creation',
        'flow.id': flowId,
        'flow.status': 'failed',
        'template.id': template.id,
        'template.name': template.name,
        
        // This is the KEY difference from Scenario 1
        'error.type': 'parsing_or_rendering',
        'error.backend_responded': true,
        'error.backend_status_code': 200,
        'error.frontend_failed': true,
        'error.user_impact': 'response_not_displayed',
        
        // Response tracking
        'response.received': true,
        'response.parsed': false,
        'ui.displayed': false,
        
        'flow.dropout_step': 'plan_parsed',
        'flow.dropout_reason': 'parsing_error',
        'flow.error_message': failureReason,
        'flow.success': 0,
        'flow.total_duration_ms': apiDuration + randomInt(100, 300),
      },
    },
    async (flowSpan) => {
      // Steps up to API response
      await Sentry.startSpan(
        {
          name: 'flow.step.template_selected',
          op: 'flow.step',
          attributes: {
            'step.name': 'template_selected',
            'flow.id': flowId,
          },
        },
        async () => await sleep(randomInt(5, 15))
      );

      await Sentry.startSpan(
        {
          name: 'flow.step.message_sent',
          op: 'flow.step',
          attributes: {
            'step.name': 'message_sent',
            'flow.id': flowId,
          },
        },
        async () => await sleep(randomInt(10, 30))
      );

      await Sentry.startSpan(
        {
          name: 'flow.step.api_request_started',
          op: 'flow.step',
          attributes: {
            'step.name': 'api_request_started',
            'flow.id': flowId,
          },
        },
        async () => await sleep(randomInt(10, 20))
      );

      // API call succeeds! (200 OK)
      await Sentry.startSpan(
        {
          name: 'API Call: Generate Action Plan',
          op: 'http.client',
          attributes: {
            'http.method': 'POST',
            'http.url': 'http://localhost:8000/api/v1/action-plan/generate',
            'http.status_code': 200, // Backend succeeded!
            'flow.id': flowId,
          },
        },
        async () => await sleep(apiDuration / 20)
      );

      // Response received
      await Sentry.startSpan(
        {
          name: 'flow.step.api_response_received',
          op: 'flow.step',
          attributes: {
            'step.name': 'api_response_received',
            'flow.id': flowId,
            'http.status_code': 200,
            'response.received': true, // Got the response!
          },
        },
        async () => await sleep(randomInt(5, 15))
      );

      // But parsing/rendering fails!
      // (No plan_parsed or plan_rendered spans created)

      console.log(`   ✅ Created flow with frontend display failure`);
    }
  );
}

/**
 * SCENARIO 3: User abandons flow mid-way (navigation/close)
 * 
 * Simulates: User starts flow → gets to various steps → navigates away or closes app
 * Impact: Flow not completed, need to understand dropout patterns
 */
async function generateScenario3_UserAbandonment() {
  const template = TEMPLATES[randomInt(0, TEMPLATES.length - 1)];
  const flowId = `flow-abandoned-${Date.now()}-${randomInt(1000, 9999)}`;
  
  // Random dropout points with different probabilities
  const dropoutPoints = [
    { step: 'template_selected', weight: 5, reason: 'changed_mind' },
    { step: 'message_sent', weight: 10, reason: 'user_navigated_away' },
    { step: 'api_request_started', weight: 30, reason: 'timeout_perceived' }, // Most common!
    { step: 'api_response_received', weight: 20, reason: 'user_navigated_away' },
    { step: 'plan_parsed', weight: 15, reason: 'user_navigated_away' },
    { step: 'plan_rendered', weight: 20, reason: 'not_interested' },
  ];
  
  // Weighted random selection
  const totalWeight = dropoutPoints.reduce((sum, p) => sum + p.weight, 0);
  let random = randomInt(1, totalWeight);
  let selectedDropout = dropoutPoints[0];
  
  for (const dropout of dropoutPoints) {
    random -= dropout.weight;
    if (random <= 0) {
      selectedDropout = dropout;
      break;
    }
  }
  
  const dropoutStep = selectedDropout.step;
  const dropoutReason = selectedDropout.reason;
  
  // Calculate realistic duration based on where they dropped out
  const stepDurations = {
    'template_selected': randomInt(500, 2000),
    'message_sent': randomInt(2000, 5000),
    'api_request_started': randomInt(5000, 15000), // Waiting for backend
    'api_response_received': randomInt(3000, 8000),
    'plan_parsed': randomInt(1000, 3000),
    'plan_rendered': randomInt(2000, 6000),
  };
  
  const duration = stepDurations[dropoutStep];
  
  console.log(`\n🏃 SCENARIO 3: User Abandonment`);
  console.log(`   Template: ${template.name}`);
  console.log(`   Dropout at: ${dropoutStep}`);
  console.log(`   Reason: ${dropoutReason}`);
  console.log(`   Duration: ${duration}ms`);

  return Sentry.startSpan(
    {
      name: 'action_plan_creation_flow',
      op: 'user_flow.action_plan',
      attributes: {
        'flow.type': 'action_plan_creation',
        'flow.id': flowId,
        'flow.status': 'abandoned',
        'template.id': template.id,
        'template.name': template.name,
        
        // Abandonment tracking
        'flow.dropout_step': dropoutStep,
        'flow.dropout_reason': dropoutReason,
        'flow.incomplete_at_unmount': true,
        'flow.success': 0,
        'flow.total_duration_ms': duration,
        
        // Completion tracking
        'flow.completion_percentage': {
          'template_selected': 20,
          'message_sent': 40,
          'api_request_started': 50,
          'api_response_received': 60,
          'plan_parsed': 70,
          'plan_rendered': 80,
        }[dropoutStep],
      },
    },
    async (flowSpan) => {
      // Create steps up to dropout point
      const stepOrder = [
        'template_selected',
        'message_sent',
        'api_request_started',
        'api_response_received',
        'plan_parsed',
        'plan_rendered',
      ];
      
      const dropoutIndex = stepOrder.indexOf(dropoutStep);
      
      for (let i = 0; i <= dropoutIndex; i++) {
        const stepName = stepOrder[i];
        await Sentry.startSpan(
          {
            name: `flow.step.${stepName}`,
            op: 'flow.step',
            attributes: {
              'step.name': stepName,
              'flow.id': flowId,
            },
          },
          async () => await sleep(randomInt(5, 20))
        );
      }

      // If dropout was during API call, create the API span too
      if (dropoutStep === 'api_request_started') {
        await Sentry.startSpan(
          {
            name: 'API Call: Generate Action Plan',
            op: 'http.client',
            attributes: {
              'http.method': 'POST',
              'http.url': 'http://localhost:8000/api/v1/action-plan/generate',
              'flow.id': flowId,
            },
          },
          async () => await sleep(duration / 40) // Part of the wait time
        );
      }

      // Simulate actual flow duration
      await sleep(duration / 40);

      console.log(`   ✅ Created abandoned flow at step: ${dropoutStep}`);
    }
  );
}

/**
 * Main test runner
 */
async function runDropoutScenarioTests() {
  console.log('\n' + '='.repeat(80));
  console.log('  🧪 FLOW DROPOUT SCENARIOS TEST GENERATOR');
  console.log('  Testing 3 critical production scenarios');
  console.log('='.repeat(80));

  const scenarios = [
    // SCENARIO 1: Backend timeouts (10 instances)
    ...Array(10).fill().map(() => ({ type: 'timeout', fn: generateScenario1_BackendTimeout })),
    
    // SCENARIO 2: Frontend display failures (5 instances)
    ...Array(5).fill().map(() => ({ type: 'display_failure', fn: generateScenario2_FrontendDisplayFailure })),
    
    // SCENARIO 3: User abandonments (15 instances at various dropout points)
    ...Array(15).fill().map(() => ({ type: 'abandonment', fn: generateScenario3_UserAbandonment })),
    
    // Baseline: Some successful flows for comparison (5 instances)
    ...Array(5).fill().map(() => ({ type: 'success', fn: generateSuccessfulFlow })),
  ];

  // Shuffle to make it more realistic
  scenarios.sort(() => Math.random() - 0.5);

  for (const [index, scenario] of scenarios.entries()) {
    console.log(`\n[${ index + 1}/${scenarios.length}] ==================`);
    
    await scenario.fn();
    
    // Small delay between scenarios
    await sleep(200);
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ✅ TEST DATA GENERATION COMPLETE');
  console.log('='.repeat(80));
  console.log('\n📊 Summary:');
  console.log(`  - Scenario 1 (Backend timeout): 10 flows`);
  console.log(`  - Scenario 2 (Frontend display failure): 5 flows`);
  console.log(`  - Scenario 3 (User abandonment): 15 flows`);
  console.log(`  - Successful flows (baseline): 5 flows`);
  console.log(`  - Total: 35 test flows`);
  
  console.log('\n🔍 What to check in Sentry:');
  console.log('  1. Scenario 1: filter by error.backend_responded:false');
  console.log('  2. Scenario 2: filter by error.backend_status_code:200 AND ui.displayed:false');
  console.log('  3. Scenario 3: filter by flow.status:abandoned, group by flow.dropout_step');
  
  console.log('\n⏳ Wait 2-3 minutes for Sentry to process the data\n');
}

/**
 * Generate a successful flow for baseline comparison
 */
async function generateSuccessfulFlow() {
  const template = TEMPLATES[randomInt(0, TEMPLATES.length - 1)];
  const flowId = `flow-success-${Date.now()}-${randomInt(1000, 9999)}`;
  const apiDuration = randomInt(1500, 4000);
  
  console.log(`\n✅ Baseline: Successful Flow`);
  console.log(`   Template: ${template.name}`);

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
        'flow.success': 1,
        'flow.completion_percentage': 100,
        'ui.displayed': true,
      },
    },
    async () => {
      const steps = ['template_selected', 'message_sent', 'api_request_started', 
                     'api_response_received', 'plan_parsed', 'plan_rendered', 
                     'plan_committed', 'card_displayed'];
      
      for (const step of steps) {
        await Sentry.startSpan(
          {
            name: `flow.step.${step}`,
            op: 'flow.step',
            attributes: {
              'step.name': step,
              'flow.id': flowId,
            },
          },
          async () => await sleep(randomInt(5, 15))
        );
      }

      await sleep(apiDuration / 20);
      console.log(`   ✅ Created successful flow`);
    }
  );
}

// Flush and exit
async function flushAndExit() {
  console.log('\n📤 Flushing data to Sentry...');
  await Sentry.flush(5000);
  console.log('✅ Flush complete!\n');
  process.exit(0);
}

// Run the tests
runDropoutScenarioTests()
  .then(flushAndExit)
  .catch((error) => {
    console.error('❌ Error generating test data:', error);
    process.exit(1);
  });




