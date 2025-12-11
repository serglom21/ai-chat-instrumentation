import uuid
from typing import List, Dict, Optional
from openai import OpenAI
import google.generativeai as genai
from groq import Groq
import sentry_sdk
from app.config import settings
from app.langfuse_client import get_langfuse
from app.models import ConversationMessage, ActionPlanModel

class AIService:
    def __init__(self):
        self.provider = settings.AI_PROVIDER
        self.langfuse = get_langfuse()
        self.model = settings.DEFAULT_MODEL
        
        # Initialize the appropriate client
        if self.provider == "gemini":
            genai.configure(api_key=settings.GOOGLE_API_KEY)
            # Use gemini-2.5-flash (fast and efficient) - note: API requires "models/" prefix
            model_name = self.model if self.model else 'gemini-2.5-flash'
            # Add models/ prefix if not present
            if not model_name.startswith('models/'):
                model_name = f'models/{model_name}'
            self.client = genai.GenerativeModel(model_name)
        elif self.provider == "groq":
            if not settings.GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY not set for Groq provider")
            self.client = Groq(api_key=settings.GROQ_API_KEY)
        else:  # openai
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        # In-memory storage for action plans (use a database in production)
        self.action_plans: Dict[str, ActionPlanModel] = {}
    
    async def generate_chat_response(
        self,
        message: str,
        flow_type: str,
        conversation_history: List[ConversationMessage],
        action_plan_id: Optional[str] = None,
    ) -> tuple[str, Optional[ActionPlanModel], Optional[List[str]]]:
        """Generate AI response based on flow type"""
        
        # Build messages for AI first
        messages = self._build_messages(message, flow_type, conversation_history)
        
        # Create Langfuse trace (if available)
        trace = None
        generation = None
        if self.langfuse:
            trace = self.langfuse.trace(
                name=f"chat_{flow_type}",
                user_id="user_001",  # Replace with actual user ID
                metadata={
                    "flow_type": flow_type,
                    "action_plan_id": action_plan_id,
                }
            )
            
            # Create generation span
            generation = trace.generation(
                name="chat_completion",
                model=self.model,
                input=messages,
            )
        
        try:
            # Create Sentry span for AI generation
            with sentry_sdk.start_span(
                op="ai.chat.completions",
                description=f"AI Generation ({self.provider})",
            ) as span:
                # Add context to Sentry
                span.set_tag("ai.provider", self.provider)
                span.set_tag("ai.model", self.model)
                span.set_tag("flow_type", flow_type)
                span.set_data("message_length", len(message))
                
                # Call AI API based on provider
                if self.provider == "gemini":
                    # Convert messages to Gemini format
                    prompt = self._messages_to_gemini_prompt(messages)
                    response = self.client.generate_content(
                        prompt,
                        generation_config=genai.types.GenerationConfig(
                            temperature=0.7,
                            max_output_tokens=1500,
                        )
                    )
                    ai_response = response.text
                    
                    # Update generation with response
                    if generation:
                        generation.end(
                            output=ai_response,
                            metadata={
                                "finish_reason": "stop",
                                "tokens": None,  # Gemini doesn't return token count in same way
                            }
                        )
                else:  # openai or groq (both use same API)
                    response = self.client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=0.7,
                        max_tokens=1500,
                    )
                    
                    ai_response = response.choices[0].message.content
                    
                    # Update generation with response
                    if generation:
                        generation.end(
                            output=ai_response,
                            metadata={
                                "finish_reason": response.choices[0].finish_reason,
                                "tokens": response.usage.total_tokens if response.usage else None,
                            }
                        )
                    
                    # Add token usage to Sentry
                    if response.usage:
                        span.set_data("tokens.prompt", response.usage.prompt_tokens)
                        span.set_data("tokens.completion", response.usage.completion_tokens)
                        span.set_data("tokens.total", response.usage.total_tokens)
            
            # Generate suggestions for certain flows
            suggestions = None
            if flow_type in ["chat", "suggestion"]:
                suggestions = self._generate_suggestions(message, ai_response)
            
            return ai_response, None, suggestions
            
        except Exception as e:
            generation.end(
                level="ERROR",
                status_message=str(e)
            )
            raise e
    
    async def generate_action_plan(
        self,
        template_content: str,
        conversation_history: List[ConversationMessage],
    ) -> tuple[str, ActionPlanModel]:
        """Generate a new action plan from template"""
        
        trace = None
        if self.langfuse:
            trace = self.langfuse.trace(
                name="action_plan_generation",
                user_id="user_001",
                metadata={"template": template_content[:100]}
            )
        
        system_prompt = """You are an expert action plan creator. Your role is to:
1. Understand the user's goals and requirements
2. Create detailed, actionable plans with specific steps
3. Structure plans with clear milestones and timelines
4. Make plans realistic and achievable
5. Include specific recommendations and resources

Format your action plan clearly with:
- Overview/Goal
- Key Steps (numbered)
- Timeline/Schedule
- Success Metrics
- Resources/Tools needed
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            *[{"role": msg.role, "content": msg.content} for msg in conversation_history],
            {"role": "user", "content": f"Create a detailed action plan for: {template_content}"}
        ]
        
        generation = None
        if trace:
            generation = trace.generation(
                name="action_plan_generation",
                model=self.model,
                input=messages,
            )
        
        try:
            if self.provider == "gemini":
                prompt = self._messages_to_gemini_prompt(messages)
                response = self.client.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        max_output_tokens=2000,
                    )
                )
                plan_content = response.text
            else:  # openai
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=2000,
                )
                plan_content = response.choices[0].message.content
            
            # Create action plan object
            action_plan = ActionPlanModel(
                id=str(uuid.uuid4()),
                title=self._extract_title(template_content),
                content=plan_content,
                status="draft",
                version=1,
            )
            
            # Store action plan
            self.action_plans[action_plan.id] = action_plan
            
            tokens = None
            if self.provider == "openai" and hasattr(response, 'usage'):
                tokens = response.usage.total_tokens
            
            if generation:
                generation.end(
                    output=plan_content,
                    metadata={
                        "action_plan_id": action_plan.id,
                        "tokens": tokens,
                    }
                )
            
            ai_message = f"I've created a detailed action plan for you:\n\n{plan_content}\n\nWould you like me to make any adjustments, or are you ready to commit to this plan?"
            
            return ai_message, action_plan
            
        except Exception as e:
            if generation:
                generation.end(
                    level="ERROR",
                    status_message=str(e)
                )
            raise e
    
    async def update_action_plan(
        self,
        action_plan_id: str,
        edit_instructions: str,
    ) -> tuple[str, ActionPlanModel]:
        """Update an existing action plan"""
        
        if action_plan_id not in self.action_plans:
            raise ValueError(f"Action plan {action_plan_id} not found")
        
        current_plan = self.action_plans[action_plan_id]
        
        trace = None
        if self.langfuse:
            trace = self.langfuse.trace(
                name="action_plan_update",
                user_id="user_001",
                metadata={
                    "action_plan_id": action_plan_id,
                    "current_version": current_plan.version,
                }
            )
        
        system_prompt = """You are helping update an action plan. 
Follow the user's instructions carefully to modify the plan while maintaining its structure and quality.
Make specific, targeted changes based on the user's feedback."""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "assistant", "content": f"Current Action Plan:\n\n{current_plan.content}"},
            {"role": "user", "content": f"Please update the plan: {edit_instructions}"}
        ]
        
        generation = None
        if trace:
            generation = trace.generation(
                name="action_plan_update",
                model=self.model,
                input=messages,
            )
        
        try:
            if self.provider == "gemini":
                prompt = self._messages_to_gemini_prompt(messages)
                response = self.client.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        max_output_tokens=2000,
                    )
                )
                updated_content = response.text
            else:  # openai
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=2000,
                )
                updated_content = response.choices[0].message.content
            
            # Update action plan
            updated_plan = ActionPlanModel(
                id=current_plan.id,
                title=current_plan.title,
                content=updated_content,
                status="draft",
                version=current_plan.version + 1,
            )
            
            self.action_plans[action_plan_id] = updated_plan
            
            tokens = None
            if self.provider == "openai" and hasattr(response, 'usage'):
                tokens = response.usage.total_tokens
            
            if generation:
                generation.end(
                    output=updated_content,
                    metadata={
                        "new_version": updated_plan.version,
                        "tokens": tokens,
                    }
                )
            
            ai_message = f"I've updated your action plan based on your feedback:\n\n{updated_content}\n\nDoes this look better? Would you like any other changes?"
            
            return ai_message, updated_plan
            
        except Exception as e:
            if generation:
                generation.end(
                    level="ERROR",
                    status_message=str(e)
                )
            raise e
    
    async def commit_action_plan(self, action_plan_id: str) -> ActionPlanModel:
        """Commit/save an action plan"""
        
        if action_plan_id not in self.action_plans:
            raise ValueError(f"Action plan {action_plan_id} not found")
        
        plan = self.action_plans[action_plan_id]
        plan.status = "saved"
        
        # Log to Langfuse (if available)
        if self.langfuse:
            self.langfuse.trace(
                name="action_plan_commit",
                user_id="user_001",
                metadata={
                    "action_plan_id": action_plan_id,
                    "version": plan.version,
                }
            )
        
        return plan
    
    def _build_messages(
        self,
        message: str,
        flow_type: str,
        conversation_history: List[ConversationMessage],
    ) -> List[Dict[str, str]]:
        """Build messages array for AI API"""
        
        system_prompts = {
            "chat": "You are a helpful AI assistant. Provide clear, concise, and helpful responses.",
            "suggestion": "You are a knowledgeable assistant providing helpful suggestions and advice.",
            "action_plan_creation": "You are an expert at creating actionable plans. Help users refine their plans with specific, practical advice.",
            "action_plan_edit": "You are helping users edit their action plans. Make targeted improvements based on their feedback.",
        }
        
        system_prompt = system_prompts.get(flow_type, system_prompts["chat"])
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history
        for msg in conversation_history[-10:]:  # Keep last 10 messages
            messages.append({"role": msg.role, "content": msg.content})
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        return messages
    
    def _generate_suggestions(self, user_message: str, ai_response: str) -> List[str]:
        """Generate follow-up suggestions based on conversation"""
        # Simple suggestion generation (can be enhanced with AI)
        suggestions = [
            "Tell me more about this",
            "Can you give me an example?",
            "What are the next steps?",
        ]
        return suggestions
    
    def _extract_title(self, template_content: str) -> str:
        """Extract a title from template content"""
        # Simple title extraction - take first sentence or first 50 chars
        title = template_content.split('.')[0]
        if len(title) > 50:
            title = title[:47] + "..."
        return title
    
    def _messages_to_gemini_prompt(self, messages: List[Dict[str, str]]) -> str:
        """Convert OpenAI-style messages to Gemini prompt format"""
        prompt_parts = []
        
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            
            if role == "system":
                prompt_parts.append(f"Instructions: {content}\n")
            elif role == "user":
                prompt_parts.append(f"User: {content}\n")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}\n")
        
        return "\n".join(prompt_parts)

# Global AI service instance
ai_service = AIService()

