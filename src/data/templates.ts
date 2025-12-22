import { Template } from '../types';

export const TEMPLATES: Template[] = [
  {
    id: 'template-1',
    title: 'Health & Fitness Plan',
    content: 'I want to create a comprehensive health and fitness plan that includes daily exercise routines, meal planning, and wellness goals. Please help me build a personalized action plan.',
    icon: '💪',
    category: 'health',
  },
  {
    id: 'template-2',
    title: 'Weekly Productivity',
    content: 'Help me create a weekly productivity plan with time blocking, task priorities, and focus strategies to achieve my goals efficiently.',
    icon: '📊',
    category: 'productivity',
  },
  {
    id: 'template-3',
    title: 'Learning Roadmap',
    content: 'I want to develop a learning roadmap for acquiring a new skill. Please help me create a structured plan with milestones, resources, and daily practice schedules.',
    icon: '📚',
    category: 'learning',
  },
  {
    id: 'template-4',
    title: 'Financial Goals',
    content: 'Help me create a financial action plan including budgeting, savings goals, investment strategies, and expense tracking methods.',
    icon: '💰',
    category: 'finance',
  },
  {
    id: 'template-5',
    title: 'Mental Wellness',
    content: 'I want to establish a mental wellness routine with meditation, stress management techniques, and self-care practices. Please create a personalized plan.',
    icon: '🧘',
    category: 'wellness',
  },
];

export const SUGGESTIONS: Array<{ id: string; text: string; category: string }> = [
  { id: 'sug-1', text: 'How can I improve my sleep quality?', category: 'health' },
  { id: 'sug-2', text: 'What are the best time management techniques?', category: 'productivity' },
  { id: 'sug-3', text: 'Suggest some healthy meal prep ideas', category: 'health' },
  { id: 'sug-4', text: 'How can I stay motivated to exercise?', category: 'health' },
  { id: 'sug-5', text: 'What are effective study methods?', category: 'learning' },
];



