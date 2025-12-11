import axios from 'axios';
import * as Sentry from '@sentry/react-native';

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
    // Create a span for this API call
    return await Sentry.startSpan(
      {
        name: 'API: Send Message',
        op: 'http.client',
        attributes: {
          'http.method': 'POST',
          'http.url': '/chat/message',
          flow_type: data.flowType,
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
    return await Sentry.startSpan(
      {
        name: 'API: Generate Action Plan',
        op: 'http.client',
        attributes: {
          'http.method': 'POST',
          'http.url': '/action-plan/generate',
        },
      },
      async () => {
        try {
          const response = await api.post('/action-plan/generate', {
            template_content: templateContent,  // snake_case
            conversation_history: conversationHistory,  // snake_case
          });
          return response.data;
        } catch (error) {
          console.error('API Error:', error);
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
    try {
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
  },
};

export default api;

