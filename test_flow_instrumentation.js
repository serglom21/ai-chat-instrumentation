#!/usr/bin/env node
/**
 * Test script to replicate React Native app's flow instrumentation
 * Uses Sentry Node SDK to test span nesting and distributed tracing
 * without needing to run iOS simulator
 */

const Sentry = require('@sentry/node');
const axios = require('axios');

// Initialize Sentry with same config as mobile app
Sentry.init({
  dsn: 'https://0bdc0587668a5c8e493c065614c8b741@o4508236363464704.ingest.us.sentry.io/4509993588424704',
  tracesSampleRate: 1.0,
  debug: true,
  environment: 'test-script',
  // Integrations are auto-loaded in @sentry/node
});

console.log('✅ Sentry initialized\n');

// Simulate the flow tracking logic from useActionPlanFlowTracking.ts
class FlowTracker {
  constructor() {
    this.flowId = this.generateId();
    this.flowSpan = null;
    this.startTime = null;
    this.metrics = {
      apiCallsCount: 0,
      totalTokensUsed: 0,
      totalIterations: 1,
    };
  }

  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  startFlow(templateId, templateName) {
    console.log('🎬 [Flow] ==================');
    console.log('🎬 [Flow] Starting action plan flow');
    console.log('🎬 [Flow] Flow ID:', this.flowId);
    console.log('🎬 [Flow] Template:', templateName);
    
    this.startTime = Date.now();
    
    console.log('🔍 [Flow] Creating inactive flow span...');
    
    // Create an inactive span that we manually control
    this.flowSpan = Sentry.startInactiveSpan({
      name: 'action_plan_creation_flow',
      op: 'user_flow.action_plan',
      forceTransaction: true,
      attributes: {
        'flow.type': 'action_plan_creation',
        'flow.id': this.flowId,
        'flow.status': 'started',
        'template.id': templateId,
        'template.name': templateName,
        'flow.last_completed_step': 'flow_started',
        'flow.completion_percentage': 0,
      },
    });
    
    console.log('✅ [Flow] Inactive span created:', this.flowSpan.spanContext().spanId);
    console.log('✅ [Flow] Trace ID:', this.flowSpan.spanContext().traceId);
    
    // Record first step within flow context
    this.recordStepSync('TEMPLATE_SELECTED', { template_id: templateId });
    
    console.log('🎬 [Flow] ==================\n');
  }

  recordStepSync(stepName, attributes = {}) {
    console.log(`📍 [Flow Step] ${stepName}`);
    
    if (this.flowSpan) {
      Sentry.withActiveSpan(this.flowSpan, () => {
        Sentry.startSpan({ 
          name: `flow.step.${stepName}`,
          op: 'flow.step',
          attributes: {
            'flow.id': this.flowId,
            'step.name': stepName,
            ...attributes,
          }
        }, (span) => {
          console.log(`   ✅ Step span created: ${span.spanContext().spanId}`);
          console.log(`   ✅ Parent ID: ${span.parentSpanId || 'NONE'}`);
        });
      });
    }
  }

  async recordStepAsync(stepName, attributes = {}) {
    console.log(`📍 [Flow Step] ${stepName}`);
    
    if (this.flowSpan) {
      await Sentry.withActiveSpan(this.flowSpan, async () => {
        return Sentry.startSpan({ 
          name: `flow.step.${stepName}`,
          op: 'flow.step',
          attributes: {
            'flow.id': this.flowId,
            'step.name': stepName,
            ...attributes,
          }
        }, async (span) => {
          console.log(`   ✅ Step span created: ${span.spanContext().spanId}`);
          console.log(`   ✅ Parent ID: ${span.parentSpanId || 'NONE'}`);
        });
      });
    }
  }

  async withFlowSpan(fn) {
    if (this.flowSpan) {
      return await Sentry.withActiveSpan(this.flowSpan, fn);
    } else {
      return await fn();
    }
  }

  async makeApiCall() {
    console.log('🚀 [API] Making API call within flow context...\n');
    
    return await this.withFlowSpan(async () => {
      return Sentry.startSpan({
        name: 'API Call: Generate Action Plan',
        op: 'function',
        attributes: {
          'api.endpoint': '/action-plan/generate',
          'flow.id': this.flowId,
        }
      }, async (apiSpan) => {
        console.log('✅ [API] API span created:', apiSpan.spanContext().spanId);
        console.log('   ✅ Parent ID:', apiSpan.parentSpanId || 'NONE');
        
        // Simulate HTTP request
        console.log('🌐 [API] Making HTTP request...');
        
        try {
          const response = await axios.post(
            'http://127.0.0.1:8000/api/v1/action-plan/generate',
            {
              template_content: 'Test action plan',
              conversation_history: [],
            },
            {
              timeout: 10000,
            }
          );
          
          console.log('✅ [API] Request successful');
          return response.data;
        } catch (error) {
          console.error('❌ [API] Request failed:', error.message);
          throw error;
        }
      });
    });
  }

  completeFlow() {
    console.log('\n✅ [Flow] Completing flow...');
    
    if (this.flowSpan) {
      const duration = Date.now() - this.startTime;
      
      // Update attributes
      this.flowSpan.setAttribute('flow.status', 'completed');
      this.flowSpan.setAttribute('flow.success', 1);
      this.flowSpan.setAttribute('flow.total_duration_ms', duration);
      
      console.log('🏁 [Flow] Ending flow span...');
      this.flowSpan.end();
      console.log('✅ [Flow] Flow span ended');
      console.log('✅ [Flow] Duration:', duration + 'ms');
    }
    
    this.flowSpan = null;
  }
}

// Main test function
async function runTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 Testing Sentry Flow Instrumentation');
  console.log('   Replicating React Native app behavior');
  console.log('='.repeat(70) + '\n');
  
  const tracker = new FlowTracker();
  
  try {
    // Step 1: Start flow
    tracker.startFlow('template-1', 'Health & Fitness Plan');
    
    // Step 2: Message sent
    await tracker.recordStepAsync('message_sent', { message_length: 100 });
    
    // Step 3: API request started
    await tracker.recordStepAsync('api_request_started', { endpoint: 'generate-action-plan' });
    
    // Step 4: Make API call (this should be a child of flow span)
    console.log('\n');
    const response = await tracker.makeApiCall();
    console.log('\n');
    
    // Step 5: API response received
    await tracker.recordStepAsync('api_response_received', { 
      response_size: response.response?.length || 0 
    });
    
    // Step 6: Plan rendered
    await tracker.recordStepAsync('plan_rendered', { 
      plan_id: response.action_plan?.id 
    });
    
    // Step 7: Complete flow
    tracker.completeFlow();
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(70));
    console.log('\n📊 Check Sentry in a few seconds for the trace:');
    console.log('   Flow ID:', tracker.flowId);
    console.log('   https://snout-and-about.sentry.io/performance/traces/');
    console.log('\n🔍 Expected structure:');
    console.log('   action_plan_creation_flow (parent)');
    console.log('   ├─ flow.step.template_selected (child)');
    console.log('   ├─ flow.step.message_sent (child)');
    console.log('   ├─ flow.step.api_request_started (child)');
    console.log('   ├─ API Call: Generate Action Plan (child)');
    console.log('   │  └─ http.client POST /action-plan/generate');
    console.log('   │     └─ http.server (backend spans)');
    console.log('   ├─ flow.step.api_response_received (child)');
    console.log('   └─ flow.step.plan_rendered (child)');
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    tracker.flowSpan?.end();
  }
  
  // Wait for Sentry to flush
  console.log('⏳ Waiting for Sentry to flush spans...');
  await Sentry.flush(2000);
  console.log('✅ Sentry flushed\n');
}

// Run the test
runTest().then(() => {
  console.log('🎉 All done! Check Sentry for results.');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

