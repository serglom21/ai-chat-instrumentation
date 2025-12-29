#!/usr/bin/env node
/**
 * Quick test to verify mobile app flow completes properly
 * This simulates the FULL flow including completion
 */

const Sentry = require('@sentry/node');
const axios = require('axios');

Sentry.init({
  dsn: 'https://0bdc0587668a5c8e493c065614c8b741@o4508236363464704.ingest.us.sentry.io/4509993588424704',
  tracesSampleRate: 1.0,
  debug: false, // Less verbose
  environment: 'mobile-test',
});

console.log('🧪 Testing COMPLETE mobile flow (with commit)\n');

// Simulate the exact flow from mobile app
async function testCompleteFlow() {
  const flowId = `test-${Date.now()}`;
  let flowSpan = null;
  
  try {
    // 1. Start flow
    console.log('1️⃣ User taps template...');
    flowSpan = Sentry.startInactiveSpan({
      name: 'action_plan_creation_flow',
      op: 'user_flow.action_plan',
      forceTransaction: true,
      attributes: {
        'flow.type': 'action_plan_creation',
        'flow.id': flowId,
        'flow.status': 'started',
        'template.id': 'health-fitness',
        'template.name': 'Health & Fitness Plan',
      },
    });
    
    // 2. Template selected
    await Sentry.withActiveSpan(flowSpan, async () => {
      Sentry.startSpan({ name: 'flow.step.template_selected', op: 'flow.step' }, () => {
        console.log('   ✅ Template selected');
      });
    });
    
    // 3. Message sent
    await Sentry.withActiveSpan(flowSpan, async () => {
      Sentry.startSpan({ name: 'flow.step.message_sent', op: 'flow.step' }, () => {
        console.log('2️⃣ Message sent to AI...');
      });
    });
    
    // 4. API call
    await Sentry.withActiveSpan(flowSpan, async () => {
      await Sentry.startSpan({ name: 'API Call: Generate Action Plan', op: 'function' }, async () => {
        console.log('3️⃣ Calling backend...');
        try {
          await axios.post('http://127.0.0.1:8000/api/v1/action-plan/generate', {
            template_content: 'Create a health plan',
            conversation_history: [],
          }, { timeout: 10000 });
          console.log('   ✅ Backend responded');
        } catch (error) {
          console.log('   ⚠️ Backend error (continuing anyway)');
        }
      });
    });
    
    // 5. Response received
    await Sentry.withActiveSpan(flowSpan, async () => {
      Sentry.startSpan({ name: 'flow.step.api_response_received', op: 'flow.step' }, () => {
        console.log('4️⃣ AI response received');
      });
    });
    
    // 6. Plan rendered
    await Sentry.withActiveSpan(flowSpan, async () => {
      Sentry.startSpan({ name: 'flow.step.plan_rendered', op: 'flow.step' }, () => {
        console.log('5️⃣ Plan displayed to user');
      });
    });
    
    // 7. User commits (THIS IS KEY!)
    await Sentry.withActiveSpan(flowSpan, async () => {
      Sentry.startSpan({ name: 'flow.step.plan_committed', op: 'flow.step' }, () => {
        console.log('6️⃣ User commits plan');
      });
    });
    
    // 8. Complete flow
    const duration = 2500; // Simulated duration
    flowSpan.setAttribute('flow.status', 'completed');
    flowSpan.setAttribute('flow.success', 1);
    flowSpan.setAttribute('flow.total_duration_ms', duration);
    flowSpan.setAttribute('flow.completion_percentage', 100);
    
    console.log('7️⃣ Flow completed!');
    flowSpan.end();
    
    console.log('\n✅ Flow finished and sent to Sentry');
    console.log(`   Flow ID: ${flowId}`);
    console.log(`   Duration: ${duration}ms`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (flowSpan) {
      flowSpan.setAttribute('flow.status', 'failed');
      flowSpan.end();
    }
  }
  
  // Flush to Sentry
  await Sentry.flush(2000);
  console.log('\n📊 Check Sentry: https://snout-and-about.sentry.io/performance/traces/');
  console.log('   Filter by environment: mobile-test');
}

testCompleteFlow().then(() => process.exit(0));






