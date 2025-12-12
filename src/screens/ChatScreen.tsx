import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import uuid from 'react-native-uuid';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { Message, ActionPlan, ChatState } from '../types';
import { TEMPLATES, SUGGESTIONS } from '../data/templates';
import MessageBubble from '../components/MessageBubble';
import TemplateCard from '../components/TemplateCard';
import SuggestionCard from '../components/SuggestionCard';
import ActionPlanCard from '../components/ActionPlanCard';
import ChatInput from '../components/ChatInput';
import LoadingIndicator from '../components/LoadingIndicator';
import { chatAPI } from '../services/api';
import * as Sentry from '@sentry/react-native';
import { useActionPlanFlowTracking } from '../hooks/useActionPlanFlowTracking';

interface ChatScreenProps {
  navigation: any;
  route: any;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ navigation, route }) => {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [
      {
        id: uuid.v4() as string,
        type: 'ai',
        content: 'Hello! I\'m your AI assistant. I can help you create action plans, answer questions, and provide suggestions. Choose a template below or ask me anything!',
        timestamp: new Date(),
      },
    ],
    isGenerating: false,
    activeFlow: undefined,
    currentActionPlan: undefined,
  });

  const [showTemplates, setShowTemplates] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [savedActionPlans, setSavedActionPlans] = useState<ActionPlan[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const iterationCountRef = useRef(1);
  
  // Initialize flow tracking hook
  const flowTracking = useActionPlanFlowTracking();

  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages]);

  useEffect(() => {
    // Handle template navigation
    if (route.params?.template) {
      handleTemplateSelect(route.params.template);
    }
  }, [route.params?.template]);
  
  useEffect(() => {
    // 📊 Track flow abandonment when user navigates away
    const unsubscribe = navigation.addListener('blur', () => {
      // If user is in the middle of an action plan flow, mark as abandoned
      if (chatState.activeFlow === 'action_plan_creation' && flowTracking.isFlowActive()) {
        console.log('⚠️ User navigated away during active flow');
        flowTracking.abandonFlow('user_navigated_away');
      }
    });
    
    return unsubscribe;
  }, [navigation, chatState.activeFlow, flowTracking]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const addMessage = (
    type: 'user' | 'ai' | 'system',
    content: string,
    metadata?: any
  ) => {
    const newMessage: Message = {
      id: uuid.v4() as string,
      type,
      content,
      timestamp: new Date(),
      metadata,
    };

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, newMessage],
    }));
  };

  // FLOW 1: ACTION PLAN CREATION FLOW
  const handleTemplateSelect = async (template: typeof TEMPLATES[0]) => {
    // 📊 START FLOW TRACKING
    flowTracking.startFlow(template.id, template.title);
    iterationCountRef.current = 1;
    
    // User taps template card
    setShowTemplates(false);
    
    // Template content sent as message
    addMessage('user', template.content, {
      isTemplate: true,
      flowType: 'action_plan_creation',
    });
    
    // 📊 RECORD: Message sent
    flowTracking.recordStep('MESSAGE_SENT', {
      template_id: template.id,
      message_length: template.content.length,
    });

    setChatState((prev) => ({
      ...prev,
      isGenerating: true,
      activeFlow: 'action_plan_creation',
    }));

    try {
      // AI responds and generates action plan
      const conversationHistory = chatState.messages.map((msg) => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // 📊 RECORD: API request started
      const apiStartTime = Date.now();
      flowTracking.recordStep('API_REQUEST_STARTED', {
        endpoint: 'generate-action-plan',
        iteration: 1,
      });

      // Execute API call within flow span context so it becomes a child
      const response = await flowTracking.executeInFlowContext(async () => {
        return await chatAPI.generateActionPlan(
          template.content,
          conversationHistory
        );
      });
      
      // Backend returns snake_case, need to handle both formats
      const actionPlan = (response as any).action_plan || (response as any).actionPlan;
      
      console.log('📦 [ChatScreen] Response received:', {
        hasResponse: !!response?.response,
        hasActionPlan: !!actionPlan,
        responseType: typeof response?.response,
        actionPlanKeys: actionPlan ? Object.keys(actionPlan) : [],
      });
      
      // 📊 RECORD: API call completed
      const apiDuration = Date.now() - apiStartTime;
      flowTracking.recordApiCall(
        'generate-action-plan',
        apiDuration,
        true,
        (response as any).metadata?.tokens
      );
      
      // 📊 RECORD: API response received
      flowTracking.recordStep('API_RESPONSE_RECEIVED', {
        response_size: response?.response?.length || 0,
        has_action_plan: !!actionPlan,
      });

      // Add AI response
      if (response?.response) {
        addMessage('ai', response.response);
      }

      // Create draft action plan
      if (actionPlan) {
        console.log('📋 [ChatScreen] Processing action plan...');
        
        // 📊 RECORD: Plan parsed
        const planParseTime = 50; // Mock parsing time
        flowTracking.recordActionPlanReceived(
          actionPlan.content.split('\n').filter((l: string) => l.startsWith('#')).length,
          actionPlan.content.split('\n').length,
          planParseTime
        );
        
        const newActionPlan: ActionPlan = {
          id: actionPlan.id,
          title: actionPlan.title,
          content: actionPlan.content,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: actionPlan.version || 1,
        };

        console.log('✅ [ChatScreen] Setting action plan and stopping loading...');
        setChatState((prev) => ({
          ...prev,
          currentActionPlan: newActionPlan,
          isGenerating: false,
        }));
        
        // 📊 RECORD: Plan rendered
        flowTracking.recordStep('PLAN_RENDERED', {
          plan_id: newActionPlan.id,
          plan_version: 1,
        });

        // Show commit option
        addMessage('system', 'Would you like to commit to this action plan, or would you like me to refine it further?');
        console.log('✅ [ChatScreen] Action plan processing complete');
      } else {
        console.warn('⚠️ [ChatScreen] No action plan in response, stopping loading...');
        setChatState((prev) => ({
          ...prev,
          isGenerating: false,
        }));
      }
    } catch (error) {
      console.error('❌ [ChatScreen] Error generating action plan:', error);
      console.error('❌ [ChatScreen] Error stack:', (error as Error).stack);
      
      // 📊 RECORD: Flow failed
      flowTracking.failFlow(error as Error, 'api_request');
      
      addMessage('ai', 'Sorry, I encountered an error generating your action plan. Please try again.');
      
      console.log('🛑 [ChatScreen] Stopping loading due to error...');
      setChatState((prev) => ({
        ...prev,
        isGenerating: false,
        activeFlow: undefined,
      }));
    } finally {
      // Safety net: ensure loading stops
      console.log('🏁 [ChatScreen] Finally block - ensuring isGenerating is false');
      setChatState((prev) => {
        if (prev.isGenerating) {
          console.warn('⚠️ [ChatScreen] isGenerating was still true in finally block!');
          return { ...prev, isGenerating: false };
        }
        return prev;
      });
    }
  };

  // Handle action plan iterations
  const handleActionPlanIteration = async (userMessage: string) => {
    if (userMessage.toLowerCase().includes('commit') || 
        userMessage.toLowerCase().includes('save') ||
        userMessage.toLowerCase().includes('looks good')) {
      await commitActionPlan();
    } else {
      // Continue iteration
      iterationCountRef.current += 1;
      
      // 📊 RECORD: User continued to next iteration
      flowTracking.startIteration(iterationCountRef.current);
      flowTracking.recordStep('USER_CONTINUED', {
        iteration_number: iterationCountRef.current,
        user_feedback_length: userMessage.length,
      });
      
      setChatState((prev) => ({ ...prev, isGenerating: true }));

      try {
        const conversationHistory = chatState.messages.map((msg) => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content,
        }));

        // 📊 RECORD: API request for iteration
        const apiStartTime = Date.now();
        flowTracking.recordStep('API_REQUEST_STARTED', {
          endpoint: 'refine-action-plan',
          iteration: iterationCountRef.current,
        });

        const response = await flowTracking.executeInFlowContext(async () => {
          return await chatAPI.sendMessage({
            message: userMessage,
            flowType: 'action_plan_creation',
            actionPlanId: chatState.currentActionPlan?.id,
            conversationHistory,
          });
        });
        
        // 📊 RECORD: API call for iteration completed
        const apiDuration = Date.now() - apiStartTime;
        flowTracking.recordApiCall(
          'refine-action-plan',
          apiDuration,
          true,
          (response as any).metadata?.tokens
        );

        addMessage('ai', response.response);

        if (response.actionPlan) {
          // 📊 RECORD: Updated plan parsed
          flowTracking.recordActionPlanReceived(
            response.actionPlan.content.split('\n').filter((l: string) => l.startsWith('#')).length,
            response.actionPlan.content.split('\n').length,
            50
          );
          
          setChatState((prev) => ({
            ...prev,
            currentActionPlan: {
              ...prev.currentActionPlan!,
              content: response.actionPlan!.content,
              version: response.actionPlan!.version,
            },
            isGenerating: false,
          }));
          
          // 📊 RECORD: Updated plan rendered
          flowTracking.recordStep('PLAN_RENDERED', {
            plan_version: response.actionPlan.version,
            iteration: iterationCountRef.current,
          });

          addMessage('system', 'Here\'s the updated plan. Let me know if you\'d like more changes or if you\'re ready to commit.');
        } else {
          setChatState((prev) => ({ ...prev, isGenerating: false }));
        }
      } catch (error) {
        console.error('Error in iteration:', error);
        
        // 📊 RECORD: Iteration failed
        flowTracking.failFlow(error as Error, 'iteration_api_request');
        
        addMessage('ai', 'Sorry, I encountered an error. Please try again.');
        setChatState((prev) => ({ ...prev, isGenerating: false }));
      }
    }
  };

  const commitActionPlan = async () => {
    if (!chatState.currentActionPlan) return;

    try {
      // 📊 RECORD: Plan committed
      flowTracking.recordStep('PLAN_COMMITTED', {
        plan_id: chatState.currentActionPlan.id,
        plan_version: chatState.currentActionPlan.version,
        total_iterations: iterationCountRef.current,
      });

      const response = await flowTracking.executeInFlowContext(async () => {
        return await chatAPI.commitActionPlan(chatState.currentActionPlan.id);
      });

      const savedPlan: ActionPlan = {
        ...chatState.currentActionPlan,
        status: 'saved',
        updatedAt: new Date(),
      };

      setSavedActionPlans((prev) => [...prev, savedPlan]);
      
      addMessage('system', 'Your action plan has been saved successfully!');
      
      // 📊 COMPLETE FLOW - Success!
      flowTracking.completeFlow(savedPlan.id);

      // Flow finished - reset state
      setChatState((prev) => ({
        ...prev,
        currentActionPlan: undefined,
        activeFlow: undefined,
      }));

      setShowSuggestions(true);
      iterationCountRef.current = 1;
    } catch (error) {
      console.error('Error committing action plan:', error);
      
      // 📊 RECORD: Commit failed
      flowTracking.failFlow(error as Error, 'plan_commit');
      
      addMessage('ai', 'Sorry, I encountered an error saving your action plan.');
    }
  };

  // FLOW 2: SUGGESTION FLOW
  const handleSuggestionSelect = async (suggestion: typeof SUGGESTIONS[0]) => {
    // Suggestion sent as message
    addMessage('user', suggestion.text, {
      isSuggestion: true,
      flowType: 'suggestion',
    });

    setShowSuggestions(false);
    setChatState((prev) => ({
      ...prev,
      isGenerating: true,
      activeFlow: 'suggestion',
    }));

    try {
      const conversationHistory = chatState.messages.map((msg) => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      const response = await chatAPI.sendMessage({
        message: suggestion.text,
        flowType: 'suggestion',
        conversationHistory,
      });

      addMessage('ai', response.response);

      setChatState((prev) => ({
        ...prev,
        isGenerating: false,
        activeFlow: undefined, // Flow can continue or end implicitly
      }));
    } catch (error) {
      console.error('Error handling suggestion:', error);
      addMessage('ai', 'Sorry, I encountered an error. Please try again.');
      setChatState((prev) => ({
        ...prev,
        isGenerating: false,
        activeFlow: undefined,
      }));
    }
  };

  // FLOW 3: CHAT MESSAGE FLOW
  const handleChatMessage = async (message: string) => {
    // Check if we're in action plan creation flow
    if (chatState.activeFlow === 'action_plan_creation' && chatState.currentActionPlan) {
      handleActionPlanIteration(message);
      return;
    }

    // Check if we're in action plan edit flow
    if (chatState.activeFlow === 'action_plan_edit') {
      handleActionPlanEditMessage(message);
      return;
    }

    // Regular chat message
    addMessage('user', message, { flowType: 'chat' });

    setChatState((prev) => ({
      ...prev,
      isGenerating: true,
      activeFlow: 'chat',
    }));

    try {
      const conversationHistory = chatState.messages.map((msg) => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      const response = await chatAPI.sendMessage({
        message,
        flowType: 'chat',
        conversationHistory,
      });

      addMessage('ai', response.response);

      setChatState((prev) => ({
        ...prev,
        isGenerating: false,
        activeFlow: undefined,
      }));

      // Show suggestions after AI response
      if (response.suggestions && response.suggestions.length > 0) {
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addMessage('ai', 'Sorry, I encountered an error. Please try again.');
      setChatState((prev) => ({
        ...prev,
        isGenerating: false,
        activeFlow: undefined,
      }));
    }
  };

  // FLOW 4: ACTION PLAN EDITING FLOW
  const handleEditActionPlan = (actionPlan: ActionPlan) => {
    // User taps edit button
    const editMessage = `I want to edit my action plan: "${actionPlan.title}"`;
    
    addMessage('user', editMessage, {
      flowType: 'action_plan_edit',
      actionPlanId: actionPlan.id,
    });

    setChatState((prev) => ({
      ...prev,
      isGenerating: true,
      activeFlow: 'action_plan_edit',
      currentActionPlan: actionPlan,
    }));

    // AI asks what to change
    setTimeout(() => {
      addMessage('ai', 'I\'d be happy to help you edit your action plan. What would you like to change?');
      setChatState((prev) => ({ ...prev, isGenerating: false }));
    }, 1000);
  };

  const handleActionPlanEditMessage = async (message: string) => {
    if (!chatState.currentActionPlan) return;

    setChatState((prev) => ({ ...prev, isGenerating: true }));

    try {
      const response = await chatAPI.updateActionPlan(
        chatState.currentActionPlan.id,
        message
      );

      addMessage('ai', response.response);

      if (response.actionPlan) {
        const updatedPlan: ActionPlan = {
          ...chatState.currentActionPlan,
          content: response.actionPlan.content,
          version: response.actionPlan.version,
          updatedAt: new Date(),
        };

        setChatState((prev) => ({
          ...prev,
          currentActionPlan: updatedPlan,
          isGenerating: false,
        }));

        addMessage('system', 'Here\'s your updated action plan. Would you like to commit these changes?');
      } else {
        setChatState((prev) => ({ ...prev, isGenerating: false }));
      }
    } catch (error) {
      console.error('Error updating action plan:', error);
      addMessage('ai', 'Sorry, I encountered an error updating your action plan.');
      setChatState((prev) => ({ ...prev, isGenerating: false }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, COLORS.surface]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Home</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <Text style={styles.headerSubtitle}>Your personal planning companion</Text>
          </View>
        </View>

        {/* Chat Messages */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Messages */}
            {chatState.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Loading Indicator */}
            {chatState.isGenerating && (
              <LoadingIndicator
                message={
                  chatState.activeFlow === 'action_plan_creation'
                    ? 'Generating action plan...'
                    : chatState.activeFlow === 'action_plan_edit'
                    ? 'Updating action plan...'
                    : 'Thinking...'
                }
              />
            )}

            {/* Current Action Plan (Draft) */}
            {chatState.currentActionPlan && chatState.currentActionPlan.status === 'draft' && (
              <View style={styles.draftPlanContainer}>
                <Text style={styles.draftPlanTitle}>📋 Draft Action Plan</Text>
                <Text style={styles.draftPlanContent}>
                  {chatState.currentActionPlan.content}
                </Text>
              </View>
            )}

            {/* Saved Action Plans */}
            {savedActionPlans.map((plan) => (
              <ActionPlanCard
                key={plan.id}
                actionPlan={plan}
                onEdit={() => handleEditActionPlan(plan)}
                onView={() => {
                  addMessage('system', `Viewing: ${plan.title}\n\n${plan.content}`);
                }}
              />
            ))}

            {/* Templates */}
            {showTemplates && chatState.messages.length <= 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Choose a Template</Text>
                {TEMPLATES.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onPress={handleTemplateSelect}
                  />
                ))}
              </View>
            )}

            {/* Suggestions */}
            {showSuggestions && !chatState.isGenerating && (
              <View style={styles.suggestionsSection}>
                <Text style={styles.sectionTitle}>Suggestions</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsScroll}
                >
                  {SUGGESTIONS.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onPress={handleSuggestionSelect}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          {/* Chat Input */}
          <ChatInput
            onSend={handleChatMessage}
            disabled={chatState.isGenerating}
            placeholder={
              chatState.activeFlow === 'action_plan_creation'
                ? 'Share your thoughts or say "commit" to save...'
                : chatState.activeFlow === 'action_plan_edit'
                ? 'What would you like to change?'
                : 'Type your message...'
            }
          />
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  backIcon: {
    fontSize: 32,
    color: COLORS.primary,
    fontWeight: '600',
    marginRight: 4,
  },
  backText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '600',
  },
  headerContent: {
    marginTop: SPACING.xs,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: SPACING.md,
  },
  section: {
    marginVertical: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  suggestionsSection: {
    marginVertical: SPACING.md,
  },
  suggestionsScroll: {
    paddingHorizontal: SPACING.md,
  },
  draftPlanContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  draftPlanTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  draftPlanContent: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    lineHeight: 24,
  },
});

export default ChatScreen;

