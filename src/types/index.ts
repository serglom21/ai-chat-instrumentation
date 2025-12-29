export interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    isTemplate?: boolean;
    isSuggestion?: boolean;
    isActionPlan?: boolean;
    actionPlanId?: string;
    flowType?: 'action_plan_creation' | 'action_plan_edit' | 'suggestion' | 'chat';
  };
}

export interface ActionPlan {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'saved';
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface Template {
  id: string;
  title: string;
  content: string;
  icon: string;
  category: string;
}

export interface Suggestion {
  id: string;
  text: string;
  category: string;
}

export interface ChatState {
  messages: Message[];
  currentActionPlan?: ActionPlan;
  isGenerating: boolean;
  activeFlow?: 'action_plan_creation' | 'action_plan_edit' | 'suggestion' | 'chat';
}







