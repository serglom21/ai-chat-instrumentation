import { useRef, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react-native';
import uuid from 'react-native-uuid';

// Flow steps definition with order and completion weight
export const FLOW_STEPS = {
  TEMPLATE_SELECTED: { order: 1, name: 'template_selected', weight: 20 },
  MESSAGE_SENT: { order: 2, name: 'message_sent', weight: 40 },
  API_REQUEST_STARTED: { order: 3, name: 'api_request_started', weight: 50 },
  API_RESPONSE_RECEIVED: { order: 4, name: 'api_response_received', weight: 60 },
  PLAN_PARSED: { order: 5, name: 'plan_parsed', weight: 70 },
  PLAN_RENDERED: { order: 6, name: 'plan_rendered', weight: 80 },
  USER_CONTINUED: { order: 7, name: 'user_continued', weight: 85 },
  PLAN_COMMITTED: { order: 8, name: 'plan_committed', weight: 95 },
  CARD_DISPLAYED: { order: 9, name: 'card_displayed', weight: 100 },
} as const;

type FlowStep = keyof typeof FLOW_STEPS;
type FlowStatus = 'started' | 'in_progress' | 'completed' | 'abandoned' | 'failed';
type DropoutReason = 
  | 'user_navigated_away' 
  | 'timeout_inactivity' 
  | 'network_error' 
  | 'api_error'
  | 'ai_generation_error'
  | 'parsing_error'
  | 'user_closed_app'
  | 'unknown';

interface FlowMetrics {
  iterationNumber: number;
  totalIterations: number;
  apiCallsCount: number;
  totalTokensUsed: number;
  totalDuration: number;
}

export function useActionPlanFlowTracking() {
  const transactionRef = useRef<any>(null);
  const flowIdRef = useRef<string>(uuid.v4() as string);
  const currentStepRef = useRef<string | null>(null);
  const flowCompletedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  const metricsRef = useRef<FlowMetrics>({
    iterationNumber: 0,
    totalIterations: 0,
    apiCallsCount: 0,
    totalTokensUsed: 0,
    totalDuration: 0,
  });

  /**
   * Start the action plan creation flow
   */
  const startFlow = useCallback((templateId: string, templateName: string) => {
    console.log('🎬 [Flow] ==================');
    console.log('🎬 [Flow] Starting action plan flow');
    console.log('🎬 [Flow] Flow ID:', flowIdRef.current);
    console.log('🎬 [Flow] Template:', templateName, '(', templateId, ')');
    
    startTimeRef.current = Date.now();
    flowCompletedRef.current = false;
    metricsRef.current = {
      iterationNumber: 1,
      totalIterations: 1,
      apiCallsCount: 0,
      totalTokensUsed: 0,
      totalDuration: 0,
    };

    console.log('🔍 [Flow] Creating inactive flow span...');
    
    // Create an inactive span (won't auto-complete)
    const flowSpan = Sentry.startInactiveSpan({
      name: 'action_plan_creation_flow',
      op: 'user_flow.action_plan',
      forceTransaction: true,
      attributes: {
        // Flow identification
        'flow.type': 'action_plan_creation',
        'flow.id': flowIdRef.current,
        'flow.status': 'started' as FlowStatus,
        
        // Template context
        'template.id': templateId,
        'template.name': templateName,
        
        // Initial state
        'flow.last_completed_step': 'flow_started',
        'flow.completion_percentage': 0,
        
        // Metrics
        'flow.iteration_number': 1,
        'flow.api_calls_count': 0,
      },
    });
    
    if (!flowSpan) {
      console.error('❌ [Flow] Failed to create flow span!');
      return;
    }
    
    console.log('✅ [Flow] Parent span created (children will send immediately)');
    transactionRef.current = flowSpan;
    
    // Record the template selection as first step (it will auto-nest under parent)
    console.log('🔍 [Flow] Recording TEMPLATE_SELECTED step...');
    recordStep('TEMPLATE_SELECTED', {
      template_id: templateId,
      template_name: templateName,
    });
    
    console.log('🎬 [Flow] ==================\n');
  }, []);

  /**
   * Record a flow step with span - SENDS IMMEDIATELY as child of parent
   * Child spans are sent immediately, but parent-child relationship is maintained
   */
  const recordStep = useCallback((
    step: FlowStep,
    additionalAttributes?: Record<string, any>
  ) => {
    const stepInfo = FLOW_STEPS[step];
    currentStepRef.current = stepInfo.name;

    console.log(`📍 [Flow Step] ${stepInfo.name} (${stepInfo.weight}%)`);

    const createStepSpan = () => {
      Sentry.startSpan(
        {
          name: `flow.step.${stepInfo.name}`,
          op: 'flow.step',
          attributes: {
            'step.order': stepInfo.order,
            'step.name': stepInfo.name,
            'step.weight': stepInfo.weight,
            'flow.id': flowIdRef.current,
            'flow.type': 'action_plan_creation',
            'flow.completion_percentage': stepInfo.weight,
            ...additionalAttributes,
          },
        },
        (stepSpan) => {
          console.log(`   ✅ Step span created and will send immediately (parent: ${transactionRef.current ? 'YES' : 'NO'})`);
          
          // Update parent attributes if it exists
          if (transactionRef.current && typeof transactionRef.current.setAttribute === 'function') {
            transactionRef.current.setAttribute('flow.last_completed_step', stepInfo.name);
            transactionRef.current.setAttribute('flow.completion_percentage', stepInfo.weight);
            transactionRef.current.setAttribute('flow.status', 'in_progress' as FlowStatus);
          }
        }
      );
    };

    // If we have a parent flow span, make this step a child of it
    // Child spans are sent immediately when they finish
    if (transactionRef.current) {
      Sentry.withActiveSpan(transactionRef.current, createStepSpan);
    } else {
      console.warn('⚠️ [Flow Step] No parent span - creating as root');
      createStepSpan();
    }
  }, []);

  /**
   * Start an iteration (for multi-turn conversations) - child of parent flow
   */
  const startIteration = useCallback((iterationNumber: number) => {
    console.log(`🔄 [Flow Iteration] Starting iteration ${iterationNumber}`);
    
    metricsRef.current.iterationNumber = iterationNumber;
    metricsRef.current.totalIterations = Math.max(
      metricsRef.current.totalIterations,
      iterationNumber
    );

    const createIterationSpan = () => {
      Sentry.startSpan(
        {
          name: `flow.iteration.${iterationNumber}`,
          op: 'flow.iteration',
          attributes: {
            'iteration.number': iterationNumber,
            'flow.id': flowIdRef.current,
            'flow.type': 'action_plan_creation',
          },
        },
        (iterationSpan) => {
          console.log(`   ✅ Iteration span sent immediately`);
          if (transactionRef.current && typeof transactionRef.current.setAttribute === 'function') {
            transactionRef.current.setAttribute('flow.iteration_number', iterationNumber);
            transactionRef.current.setAttribute('flow.total_iterations', iterationNumber);
          }
        }
      );
    };

    if (transactionRef.current) {
      Sentry.withActiveSpan(transactionRef.current, createIterationSpan);
    } else {
      createIterationSpan();
    }
  }, []);

  /**
   * Record API call metrics - as child of parent flow
   */
  const recordApiCall = useCallback((
    endpoint: string,
    duration: number,
    success: boolean,
    tokenCount?: number
  ) => {
    metricsRef.current.apiCallsCount += 1;
    if (tokenCount) {
      metricsRef.current.totalTokensUsed += tokenCount;
    }

    const createApiSpan = () => {
      Sentry.startSpan(
        {
          name: `api.${endpoint}`,
          op: 'http.client',
          attributes: {
            'http.endpoint': endpoint,
            'http.duration_ms': duration,
            'http.success': success,
            'api.tokens_used': tokenCount || 0,
            'flow.id': flowIdRef.current,
            'flow.api_call_number': metricsRef.current.apiCallsCount,
          },
        },
        (apiSpan) => {
          if (transactionRef.current) {
            transactionRef.current.setAttribute('flow.api_calls_count', metricsRef.current.apiCallsCount);
            transactionRef.current.setAttribute('flow.total_tokens_used', metricsRef.current.totalTokensUsed);
          }
        }
      );
    };

    // NOTE: API calls are already children of the parent due to withActiveSpan in api.ts
    // This just records metrics, the actual http.client span is created by Sentry's auto-instrumentation
    if (transactionRef.current) {
      transactionRef.current.setAttribute('flow.api_calls_count', metricsRef.current.apiCallsCount);
      transactionRef.current.setAttribute('flow.total_tokens_used', metricsRef.current.totalTokensUsed);
    }
  }, []);

  /**
   * Record action plan received and parsed - as child of parent flow
   */
  const recordActionPlanReceived = useCallback((
    planSectionsCount: number,
    planItemsCount: number,
    parsingTime: number
  ) => {
    const createParsingSpan = () => {
      Sentry.startSpan(
        {
          name: 'flow.plan_parsing',
          op: 'processing',
          attributes: {
            'plan.sections_count': planSectionsCount,
            'plan.items_count': planItemsCount,
            'plan.parsing_time_ms': parsingTime,
            'flow.id': flowIdRef.current,
          },
        },
        (span) => {
          console.log('✅ [Flow] Plan parsing span sent immediately');
        }
      );
    };

    if (transactionRef.current) {
      Sentry.withActiveSpan(transactionRef.current, () => {
        createParsingSpan();
        recordStep('PLAN_PARSED', {
          plan_sections_count: planSectionsCount,
          plan_items_count: planItemsCount,
        });
      });
    } else {
      createParsingSpan();
      recordStep('PLAN_PARSED', {
        plan_sections_count: planSectionsCount,
        plan_items_count: planItemsCount,
      });
    }
  }, [recordStep]);

  /**
   * Complete the flow successfully
   */
  const completeFlow = useCallback((finalPlanId: string) => {
    if (flowCompletedRef.current) return;

    console.log('✅ Flow completed successfully');
    
    flowCompletedRef.current = true;
    metricsRef.current.totalDuration = Date.now() - startTimeRef.current;

    recordStep('CARD_DISPLAYED', {
      plan_id: finalPlanId,
    });

    // Update flow span with final metrics and end it
    if (transactionRef.current) {
      transactionRef.current.setAttribute('flow.status', 'completed' as FlowStatus);
      transactionRef.current.setAttribute('flow.completion_percentage', 100);
      transactionRef.current.setAttribute('flow.success', 1);
      transactionRef.current.setAttribute('flow.total_duration_ms', metricsRef.current.totalDuration);
      transactionRef.current.setAttribute('flow.total_iterations', metricsRef.current.totalIterations);
      transactionRef.current.setAttribute('flow.total_api_calls', metricsRef.current.apiCallsCount);
      transactionRef.current.setAttribute('flow.total_tokens', metricsRef.current.totalTokensUsed);
      
      console.log('🏁 [Flow] Ending flow span...');
      transactionRef.current.end();
      console.log('✅ [Flow] Flow span ended');
    }

    transactionRef.current = null;
  }, [recordStep]);

  /**
   * Abandon the flow (user navigated away, closed app, etc.)
   */
  const abandonFlow = useCallback((reason: DropoutReason) => {
    if (flowCompletedRef.current) return;

    console.log(`⚠️ Flow abandoned: ${reason} at step ${currentStepRef.current}`);

    metricsRef.current.totalDuration = Date.now() - startTimeRef.current;

    // Update flow span with abandonment info and end it
    if (transactionRef.current) {
      transactionRef.current.setAttribute('flow.status', 'abandoned' as FlowStatus);
      transactionRef.current.setAttribute('flow.dropout_step', currentStepRef.current || 'unknown');
      transactionRef.current.setAttribute('flow.dropout_reason', reason);
      transactionRef.current.setAttribute('flow.success', 0);
      transactionRef.current.setAttribute('flow.total_duration_ms', metricsRef.current.totalDuration);
      
      console.log('🏁 [Flow] Ending abandoned flow span...');
      transactionRef.current.end();
    }

    flowCompletedRef.current = true;
    transactionRef.current = null;
  }, []);

  /**
   * Fail the flow (error occurred)
   */
  const failFlow = useCallback((error: Error, step?: string) => {
    if (flowCompletedRef.current || !transactionRef.current) return;

    console.log(`❌ Flow failed: ${error.message} at step ${step || currentStepRef.current}`);

    metricsRef.current.totalDuration = Date.now() - startTimeRef.current;

    const failureStep = step || currentStepRef.current || 'unknown';

    // Capture the error with context
    Sentry.captureException(error, {
      contexts: {
        flow: {
          flow_id: flowIdRef.current,
          flow_type: 'action_plan_creation',
          failure_step: failureStep,
          completion_percentage: FLOW_STEPS[currentStepRef.current as FlowStep]?.weight || 0,
        },
      },
    });

    // Update flow span attributes and end it
    if (transactionRef.current) {
      transactionRef.current.setAttribute('flow.status', 'failed' as FlowStatus);
      transactionRef.current.setAttribute('flow.dropout_step', failureStep);
      transactionRef.current.setAttribute('flow.dropout_reason', error.name || 'unknown_error');
      transactionRef.current.setAttribute('flow.error_message', error.message);
      transactionRef.current.setAttribute('flow.success', 0);
      transactionRef.current.setAttribute('flow.total_duration_ms', metricsRef.current.totalDuration);
      
      console.log('🏁 [Flow] Ending failed flow span...');
      transactionRef.current.end();
    }

    flowCompletedRef.current = true;
    transactionRef.current = null;
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // If flow is still active when component unmounts, mark as abandoned
      if (transactionRef.current && !flowCompletedRef.current) {
        abandonFlow('user_navigated_away');
      }
    };
  }, [abandonFlow]);

  /**
   * Execute async code within the flow span context
   * This ensures any spans created become temporal children at the right time
   */
  const executeInFlowContext = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (transactionRef.current) {
      return await Sentry.withActiveSpan(transactionRef.current, fn);
    } else {
      console.warn('⚠️ [Flow] No active flow span - executing without parent context');
      return await fn();
    }
  }, []);

  return {
    flowId: flowIdRef.current,
    startFlow,
    recordStep,
    startIteration,
    recordApiCall,
    recordActionPlanReceived,
    completeFlow,
    abandonFlow,
    failFlow,
    isFlowActive: () => !flowCompletedRef.current,
    executeInFlowContext, // For wrapping async operations that should be children
  };
}

