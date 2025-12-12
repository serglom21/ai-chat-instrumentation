import axios from 'axios';
import * as Sentry from '@sentry/react-native';
import { getActiveSpan, spanToTraceHeader, spanToBaggageHeader } from '@sentry/core';

// Update this to your backend URL
// For local development with Expo:
// - iOS Simulator: http://localhost:8000
// - Android Emulator: http://10.0.2.2:8000
// - Physical device: http://YOUR_COMPUTER_IP:8000
const API_BASE_URL = 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Add request interceptor to inject Sentry trace headers for distributed tracing
api.interceptors.request.use((config) => {
  console.log('🔍 [API Interceptor] ==================');
  console.log('🔍 [API Interceptor] Request to:', config.url);
  console.log('🔍 [API Interceptor] Method:', config.method);
  
  const activeSpan = getActiveSpan();
  console.log('🔍 [API Interceptor] Active span exists:', !!activeSpan);
  
  if (activeSpan) {
    console.log('🔍 [API Interceptor] Active span type:', activeSpan.constructor.name);
    console.log('🔍 [API Interceptor] Span attributes:', JSON.stringify(activeSpan.attributes || {}, null, 2));
    
    const traceHeader = spanToTraceHeader(activeSpan);
    const baggageHeader = spanToBaggageHeader(activeSpan);
    
    console.log('🔍 [API Interceptor] Generated trace header:', traceHeader || 'NULL');
    console.log('🔍 [API Interceptor] Generated baggage header:', baggageHeader || 'NULL');
    
    if (traceHeader) {
      config.headers['sentry-trace'] = traceHeader;
      console.log('✅ [API Interceptor] SET sentry-trace header:', traceHeader);
    } else {
      console.warn('⚠️ [API Interceptor] NO TRACE HEADER GENERATED!');
    }
    
    if (baggageHeader) {
      config.headers['baggage'] = baggageHeader;
      console.log('✅ [API Interceptor] SET baggage header');
    }
    
    // Also send flow ID if available (from span attributes)
    const spanData = (activeSpan as any)._spanRecorder?.spans?.[0]?.attributes;
    if (spanData && spanData['flow.id']) {
      config.headers['x-flow-id'] = spanData['flow.id'];
      console.log('✅ [API Interceptor] SET x-flow-id:', spanData['flow.id']);
    } else {
      console.log('ℹ️ [API Interceptor] No flow.id found in span attributes');
    }
  } else {
    console.warn('⚠️ [API Interceptor] ❌ NO ACTIVE SPAN! Headers will NOT be sent.');
    console.warn('⚠️ [API Interceptor] This means the API call is not wrapped in a Sentry span.');
  }
  
  console.log('🔍 [API Interceptor] Final headers:', Object.keys(config.headers));
  console.log('🔍 [API Interceptor] ==================\n');
  return config;
});

export interface SendMessageRequest {
  message: string;
  flowType: 'action_plan_creation' | 'action_plan_edit' | 'suggestion' | 'chat';
  actionPlanId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface SendMessageResponse {
  response: string;
  actionPlan?: {
    id: string;
    title: string;
    content: string;
    status: string;
    version: number;
  };
  suggestions?: string[];
}

export const chatAPI = {
  sendMessage: async (data: SendMessageRequest): Promise<SendMessageResponse> => {
    // Create a parent span for context, but let axios auto-instrument the HTTP request
    return await Sentry.startSpan(
      {
        name: 'API Call: Send Message',
        op: 'function',
        attributes: {
          'api.endpoint': '/chat/message',
          'api.method': 'POST',
          'api.base_url': API_BASE_URL,
          'flow.type': data.flowType,
        },
      },
      async () => {
        try {
          // Convert camelCase to snake_case for backend
          const payload = {
            message: data.message,
            flow_type: data.flowType,
            action_plan_id: data.actionPlanId,
            conversation_history: data.conversationHistory || [],
          };
          
          // Axios will automatically create child HTTP span and propagate trace headers
          const response = await api.post('/chat/message', payload);
          return response.data;
        } catch (error) {
          console.error('API Error:', error);
          Sentry.captureException(error, {
            tags: { api_endpoint: 'chat/message' },
            extra: { flowType: data.flowType },
          });
          throw error;
        }
      }
    );
  },

  generateActionPlan: async (templateContent: string, conversationHistory: Array<{ role: string; content: string }>) => {
    console.log('🚀 [API] ==================');
    console.log('🚀 [API] generateActionPlan called');
    
    // Check if there's an active span BEFORE creating our own
    const preExistingSpan = getActiveSpan();
    console.log('🔍 [API] Pre-existing active span:', preExistingSpan ? 'YES' : 'NO');
    if (preExistingSpan) {
      console.log('🔍 [API] Pre-existing span type:', preExistingSpan.constructor.name);
      console.log('🔍 [API] Pre-existing span attributes:', JSON.stringify(preExistingSpan.attributes, null, 2));
    }
    
    // Create a parent span for context, but let axios auto-instrument the HTTP request
    return await Sentry.startSpan(
      {
        name: 'API Call: Generate Action Plan',
        op: 'function',
        attributes: {
          'api.endpoint': '/action-plan/generate',
          'api.method': 'POST',
          'api.base_url': API_BASE_URL,
        },
      },
      async () => {
        console.log('✅ [API] Inside Sentry.startSpan callback');
        
        // Check active span inside the callback
        const activeSpanInside = getActiveSpan();
        console.log('🔍 [API] Active span inside callback:', activeSpanInside ? 'YES' : 'NO');
        if (activeSpanInside) {
          console.log('🔍 [API] Active span type:', activeSpanInside.constructor.name);
          console.log('🔍 [API] Active span attributes:', JSON.stringify(activeSpanInside.attributes, null, 2));
        }
        
        try {
          console.log('🚀 [API] About to make axios.post request...');
          // Axios will automatically create child HTTP span and propagate trace headers
          const response = await api.post('/action-plan/generate', {
            template_content: templateContent,  // snake_case
            conversation_history: conversationHistory,  // snake_case
          });
          console.log('✅ [API] Request completed successfully');
          console.log('🚀 [API] ==================\n');
          return response.data;
        } catch (error) {
          console.error('❌ [API] Error:', error);
          Sentry.captureException(error, {
            tags: { api_endpoint: 'action-plan/generate' },
          });
          throw error;
        }
      }
    );
  },

  updateActionPlan: async (actionPlanId: string, editInstructions: string) => {
    try {
      const response = await api.post('/action-plan/update', {
        action_plan_id: actionPlanId,  // snake_case
        edit_instructions: editInstructions,  // snake_case
      });
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      Sentry.captureException(error, {
        tags: { api_endpoint: 'action-plan/update' },
        extra: { actionPlanId },
      });
      throw error;
    }
  },

  commitActionPlan: async (actionPlanId: string) => {
    // Create a parent span for context, but let axios auto-instrument the HTTP request
    return await Sentry.startSpan(
      {
        name: 'API Call: Commit Action Plan',
        op: 'function',
        attributes: {
          'api.endpoint': '/action-plan/commit',
          'api.method': 'POST',
          'api.base_url': API_BASE_URL,
          'action_plan.id': actionPlanId,
        },
      },
      async () => {
        try {
          // Axios will automatically create child HTTP span and propagate trace headers
          const response = await api.post('/action-plan/commit', {
            action_plan_id: actionPlanId,  // snake_case
          });
          return response.data;
        } catch (error) {
          console.error('API Error:', error);
          Sentry.captureException(error, {
            tags: { api_endpoint: 'action-plan/commit' },
            extra: { actionPlanId },
          });
          throw error;
        }
      }
    );
  },
};

export default api;

