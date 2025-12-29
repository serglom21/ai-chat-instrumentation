#!/usr/bin/env node
/**
 * Generate realistic Sentry distributed trace data across two projects:
 * - Frontend (React Native) → Uses Sentry SDK → react-native project
 * - Backend (Python AI) → Uses OpenTelemetry SDK → ai-chat-backend project
 */

const Sentry = require('@sentry/node');
const { trace, context, SpanStatusCode } = require('@opentelemetry/api');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Configuration
const FRONTEND_DSN = 'https://0bdc0587668a5c8e493c065614c8b741@o4508236363464704.ingest.us.sentry.io/4509993588424704';
const BACKEND_OTLP_ENDPOINT = 'https://o4508236363464704.ingest.us.sentry.io/api/4510517681979392/integration/otlp/v1/traces';
const BACKEND_AUTH_KEY = '0036c6168cb9a4e5ce2d8abe21d13431';

// Initialize Sentry for frontend spans
Sentry.init({
  dsn: FRONTEND_DSN,
  tracesSampleRate: 1.0,
  environment: 'test-data-generation',
});

// Initialize OpenTelemetry for backend spans
const otlpExporter = new OTLPTraceExporter({
  url: BACKEND_OTLP_ENDPOINT,
  headers: {
    'x-sentry-auth': `sentry sentry_key=${BACKEND_AUTH_KEY}`,
  },
});

const otelSdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'ai-assistant-backend',
  }),
  traceExporter: otlpExporter,
});

otelSdk.start();
const tracer = trace.getTracer('ai-assistant-backend', '1.0.0');

// Templates
const TEMPLATES = [
  { id: 'template-1', name: 'Health & Fitness Plan' },
  { id: 'template-2', name: 'Career Development' },
  { id: 'template-3', name: 'Financial Planning' },
  { id: 'template-4', name: 'Learning Path' },
  { id: 'template-5', name: 'Business Strategy' },
];

const COMPLEXITY_LEVELS = ['simple', 'medium', 'high'];
const AI_MODELS = [
  'llama-3.3-70b-versatile',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'gemini-2.5-flash',
];

// Utility functions
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract Sentry trace context from a span for propagation to backend
 */
function getSentryTraceContext(sentrySpan) {
  try {
    const spanContext = sentrySpan.spanContext();
    if (spanContext && spanContext.traceId && spanContext.spanId) {
      return {
        traceId: spanContext.traceId,
        parentSpanId: spanContext.spanId,
        sampled: spanContext.traceFlags === 1,
      };
    }
  } catch (error) {
    console.warn('⚠️  Failed to extract Sentry trace context:', error.message);
  }
  return null;
}

/**
 * Create a backend AI span using OpenTelemetry that connects to the frontend trace
 */
async function createBackendAISpan(traceContext, config = {}) {
  const {
    model = randomChoice(AI_MODELS),
    complexity = randomChoice(COMPLEXITY_LEVELS),
    promptLength = randomInt(100, 2000),
  } = config;

  // Calculate realistic timing
  const ttft = complexity === 'simple' ? randomInt(100, 500) 
              : complexity === 'medium' ? randomInt(500, 2000)
              : randomInt(2000, 8000);
  
  const generationTime = complexity === 'simple' ? randomInt(1000, 3000)
                       : complexity === 'medium' ? randomInt(3000, 8000)
                       : randomInt(8000, 20000);
  
  const ttlt = ttft + generationTime;
  const outputTokens = randomInt(300, 1500);
  const inputTokens = Math.floor(promptLength / 4);
  const totalTokens = inputTokens + outputTokens;
  const tokensPerSecond = outputTokens / (generationTime / 1000);
  const meanTimePerToken = generationTime / outputTokens;
  const chunkCount = randomInt(500, 2000);
  const timeBetweenChunksAvg = generationTime / chunkCount;
  const timeBetweenChunksP95 = timeBetweenChunksAvg * randomFloat(1.5, 3.0);

  console.log(`      🤖 Creating backend AI span (OTel): ${model} (${complexity})`);

  if (!traceContext) {
    console.warn('      ⚠️  No trace context, creating standalone backend span');
  }

  // Create OpenTelemetry span with Sentry trace context
  return new Promise((resolve) => {
    // If we have trace context from Sentry, we need to manually create the span context
    // OpenTelemetry's trace API doesn't provide a direct way to set parent from external context
    // So we'll use the tracer directly
    const span = tracer.startSpan('ai.action_plan.generation', {
      attributes: {
        // Streaming metrics
        'ai.ttft': ttft,
        'ai.ttlt': ttlt,
        'ai.queue_time': randomInt(0, 100),
        'ai.generation_time': generationTime,
        'ai.tokens_per_second': parseFloat(tokensPerSecond.toFixed(2)),
        'ai.mean_time_per_token': parseFloat(meanTimePerToken.toFixed(2)),
        
        // Stream-specific
        'ai.chunk_count': chunkCount,
        'ai.time_between_chunks_avg': parseFloat(timeBetweenChunksAvg.toFixed(2)),
        'ai.time_between_chunks_p95': parseFloat(timeBetweenChunksP95.toFixed(2)),
        
        // Token usage
        'ai.input_tokens': inputTokens,
        'ai.output_tokens': outputTokens,
        'ai.total_tokens': totalTokens,
        'ai.context_window_usage_pct': parseFloat(((totalTokens / 8000) * 100).toFixed(2)),
        
        // Model configuration
        'ai.provider': model.includes('gpt') ? 'openai' : model.includes('llama') ? 'groq' : 'gemini',
        'ai.model': model,
        'ai.temperature': 0.7,
        'ai.max_tokens': 2000,
        'ai.streaming_enabled': true,
        
        // Content complexity
        'ai.prompt_length': promptLength,
        'ai.prompt_complexity': complexity,
        'ai.message_count': randomInt(1, 8),
        
        // Caching
        'ai.cache_hit': false,
        
        // Link back to Sentry trace
        ...(traceContext && {
          'sentry.trace_id': traceContext.traceId,
          'sentry.parent_span_id': traceContext.parentSpanId,
        }),
      },
    });

    // Simulate AI generation time
    setTimeout(() => {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      
      console.log(`      ✅ Backend AI span (OTel): TTFT=${ttft}ms, TTLT=${ttlt}ms, tokens/sec=${tokensPerSecond.toFixed(1)}`);
      resolve();
    }, ttlt / 10);
  });
}

/**
 * Generate a complete distributed trace: Frontend (Sentry) → Backend (OTel)
 */
async function generateDistributedTrace(flowConfig = {}) {
  const {
    template = randomChoice(TEMPLATES),
    status = randomChoice(['completed', 'completed', 'completed', 'abandoned']),
    iterationCount = randomInt(1, 4),
    shouldFail = Math.random() < 0.05,
  } = flowConfig;

  const flowId = `flow-${Date.now()}-${randomInt(1000, 9999)}`;
  const model = randomChoice(AI_MODELS);
  const complexity = randomChoice(COMPLEXITY_LEVELS);
  
  console.log(`\n🎬 Generating distributed trace: ${template.name} (${status})`);
  console.log(`   📱 Frontend: React Native (Sentry) → react-native project`);
  console.log(`   🔗 → Backend: ${model} (OTel) → ai-chat-backend project`);

  // Create the root frontend flow span with Sentry SDK
  return Sentry.startSpan(
    {
      name: 'action_plan_creation_flow',
      op: 'user_flow.action_plan',
      attributes: {
        'flow.type': 'action_plan_creation',
        'flow.id': flowId,
        'flow.status': status,
        'template.id': template.id,
        'template.name': template.name,
        'flow.iteration_number': iterationCount,
        'flow.iterations_total': iterationCount,
        'flow.api_calls_count': iterationCount + 1,
      },
    },
    async (flowSpan) => {
      const flowDuration = randomInt(2000, 8000);
      
      // Create initial step spans
      const steps = [
        { name: 'template_selected', duration: randomInt(50, 150) },
        { name: 'message_sent', duration: randomInt(100, 300) },
        { name: 'api_request_started', duration: randomInt(50, 150) },
      ];

      console.log(`   📊 Creating ${steps.length} flow step spans (Sentry)...`);
      for (const step of steps) {
        await Sentry.startSpan(
          {
            name: `flow.step.${step.name}`,
            op: 'flow.step',
            attributes: {
              'step.name': step.name,
              'flow.id': flowId,
              'flow.type': 'action_plan_creation',
            },
          },
          async () => {
            await sleep(step.duration / 100);
          }
        );
      }

      // Handle different flow outcomes
      if (shouldFail || status === 'failed') {
        console.log(`   ❌ Flow failed at ${steps[steps.length - 1].name}`);
        flowSpan.setAttribute('flow.status', 'failed');
        flowSpan.setAttribute('flow.dropout_step', steps[steps.length - 1].name);
        flowSpan.setAttribute('flow.success', 0);
      } else if (status === 'abandoned') {
        const dropoutSteps = ['api_request_started', 'api_response_received', 'plan_parsed'];
        const dropoutStep = randomChoice(dropoutSteps);
        console.log(`   ⚠️  Flow abandoned at ${dropoutStep}`);
        flowSpan.setAttribute('flow.status', 'abandoned');
        flowSpan.setAttribute('flow.dropout_step', dropoutStep);
        flowSpan.setAttribute('flow.dropout_reason', 'user_navigated_away');
        flowSpan.setAttribute('flow.success', 0);
      } else {
        // Flow completed successfully
        console.log(`   🎯 Flow completing successfully...`);
        
        // Create API call span (Sentry)
        console.log(`   🌐 Creating API call span (Sentry)...`);
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
          async (apiSpan) => {
            // Extract trace context from the API span to pass to backend
            const traceContext = getSentryTraceContext(apiSpan);
            
            // Create backend AI span (OpenTelemetry) - this goes to ai-chat-backend project
            await createBackendAISpan(traceContext, { model, complexity });
            
            // Add network overhead
            await sleep(randomInt(20, 100));
          }
        );
        
        // Create remaining flow step spans
        const remainingSteps = [
          { name: 'api_response_received', duration: randomInt(100, 300) },
          { name: 'plan_parsed', duration: randomInt(50, 150) },
          { name: 'plan_rendered', duration: randomInt(100, 400) },
          { name: 'plan_committed', duration: randomInt(200, 500) },
          { name: 'card_displayed', duration: randomInt(100, 200) },
        ];

        console.log(`   📊 Creating ${remainingSteps.length} completion step spans (Sentry)...`);
        for (const step of remainingSteps) {
          await Sentry.startSpan(
            {
              name: `flow.step.${step.name}`,
              op: 'flow.step',
              attributes: {
                'step.name': step.name,
                'flow.id': flowId,
                'flow.type': 'action_plan_creation',
              },
            },
            async () => {
              await sleep(step.duration / 100);
            }
          );
        }

        // Add UX timing measurements
        flowSpan.setAttribute('ux.time_to_first_feedback', randomInt(80, 250));
        flowSpan.setAttribute('ux.time_to_first_content', randomInt(300, 1500));
        flowSpan.setAttribute('ux.time_to_actionable', randomInt(1000, 4000));
        flowSpan.setAttribute('ux.total_perceived_latency', flowDuration);
        flowSpan.setAttribute('ui.render_time', randomInt(30, 150));
        flowSpan.setAttribute('ui.rerender_count', randomInt(2, 12));
        flowSpan.setAttribute('flow.user_wait_time', randomInt(2000, 8000));
        flowSpan.setAttribute('flow.user_idle_time', randomInt(1000, 15000));
        flowSpan.setAttribute('flow.time_to_commit', flowDuration);
        flowSpan.setAttribute('flow.iteration_duration', randomInt(2000, 5000));
        flowSpan.setAttribute('flow.time_per_iteration_avg', randomInt(2500, 4500));

        flowSpan.setAttribute('flow.status', 'completed');
        flowSpan.setAttribute('flow.success', 1);
        flowSpan.setAttribute('flow.completion_percentage', 100);
        
        console.log(`   ✅ Flow completed: ${flowDuration}ms total`);
      }

      flowSpan.setAttribute('flow.total_duration_ms', flowDuration);
      
      // Simulate the actual flow duration
      await sleep(flowDuration / 50);
      
      console.log(`   ✅ Distributed trace complete!`);
      console.log(`   📦 Sentry spans → react-native project`);
      console.log(`   📦 OTel spans → ai-chat-backend project`);
    }
  );
}

/**
 * Generate a batch of realistic test data with distributed traces
 */
async function generateTestDataBatch() {
  console.log('\n' + '='.repeat(80));
  console.log('  🎲 GENERATING SENTRY DISTRIBUTED TRACES');
  console.log('  📱 Frontend (Sentry SDK) → react-native project');
  console.log('  🤖 Backend (OpenTelemetry SDK) → ai-chat-backend project');
  console.log('='.repeat(80));

  const scenarios = [
    // Quick successful flows
    ...Array(10).fill().map(() => ({
      status: 'completed',
      iterationCount: 1,
      template: randomChoice(TEMPLATES),
    })),
    
    // Multi-iteration flows
    ...Array(8).fill().map(() => ({
      status: 'completed',
      iterationCount: randomInt(2, 4),
      template: randomChoice(TEMPLATES),
    })),
    
    // Abandoned flows (some with API calls, some without)
    ...Array(5).fill().map(() => ({
      status: 'abandoned',
      iterationCount: 1,
      template: randomChoice(TEMPLATES),
    })),
    
    // Failed flows
    ...Array(2).fill().map(() => ({
      status: 'failed',
      shouldFail: true,
      iterationCount: 1,
      template: randomChoice(TEMPLATES),
    })),
  ];

  // Generate distributed traces
  for (const [index, scenario] of scenarios.entries()) {
    console.log(`\n[${index + 1}/${scenarios.length}] ==================`);
    
    await generateDistributedTrace(scenario);
    
    // Small delay between traces
    await sleep(200);
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ✅ DATA GENERATION COMPLETE');
  console.log('='.repeat(80));
  console.log('\n📊 Summary:');
  console.log(`  - ${scenarios.length} distributed traces generated`);
  console.log(`  - Frontend spans (Sentry): ${scenarios.length} flows → react-native project`);
  console.log(`  - Backend spans (OTel): ~${scenarios.filter(s => s.status === 'completed').length} AI spans → ai-chat-backend project`);
  console.log(`  - Trace linking: Via sentry.trace_id and sentry.parent_span_id attributes`);
  console.log('\n🔗 Trace Structure:');
  console.log('  📱 react-native project:');
  console.log('    user_flow.action_plan');
  console.log('    ├─ flow.step.*');
  console.log('    ├─ http.client (API Call)');
  console.log('    └─ flow.step.*');
  console.log('\n  🤖 ai-chat-backend project:');
  console.log('    ai.action_plan.generation');
  console.log('    └─ (linked via sentry.trace_id attribute)');
  console.log('\n⏳ Wait 2-3 minutes for Sentry to process and index the data');
  console.log('🔄 Then check BOTH projects in Sentry!\n');
}

// Flush and exit
async function flushAndExit() {
  console.log('\n📤 Flushing data to Sentry...');
  await Sentry.flush(5000);
  
  console.log('📤 Flushing OpenTelemetry data...');
  await otelSdk.shutdown();
  
  console.log('✅ Flush complete!\n');
  process.exit(0);
}

// Run the generator
generateTestDataBatch()
  .then(flushAndExit)
  .catch((error) => {
    console.error('❌ Error generating data:', error);
    process.exit(1);
  });
