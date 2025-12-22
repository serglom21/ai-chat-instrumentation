import uuid
import time
from typing import List, Dict, Optional
from openai import OpenAI
import google.generativeai as genai
from groq import Groq
from app.config import settings
from app.langfuse_client import get_langfuse
from app.models import ConversationMessage, ActionPlanModel
from opentelemetry import trace
import numpy as np

# Get OpenTelemetry tracer
tracer = trace.get_tracer(__name__)

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
            # Create OpenTelemetry span for AI generation
            with tracer.start_as_current_span(
                "ai.chat.completions",
                attributes={
                    "ai.provider": self.provider,
                    "ai.model": self.model,
                    "flow.type": flow_type,
                    "message.length": len(message),
                }
            ) as span:
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
                    
                    # Add token usage to OpenTelemetry span
                    if response.usage:
                        span.set_attribute("ai.tokens.prompt", response.usage.prompt_tokens)
                        span.set_attribute("ai.tokens.completion", response.usage.completion_tokens)
                        span.set_attribute("ai.tokens.total", response.usage.total_tokens)
            
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
        """Generate a new action plan from template with streaming metrics"""
        
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
        
        # Configuration
        temperature = 0.7
        max_tokens = 2000
        
        try:
            # Create OpenTelemetry span for AI generation with detailed attributes
            with tracer.start_as_current_span(
                "ai.action_plan.generation",
                attributes={
                    # Model configuration
                    "ai.provider": self.provider,
                    "ai.model": self.model,
                    "ai.temperature": temperature,
                    "ai.max_tokens": max_tokens,
                    "ai.streaming_enabled": True,
                    
                    # Content complexity
                    "ai.prompt_length": sum(len(m["content"]) for m in messages),
                    "ai.prompt_complexity": self._calculate_complexity(messages),
                    "ai.message_count": len(messages),
                    
                    # Request context
                    "flow.type": "action_plan_generation",
                }
            ) as span:
                # Timing trackers
                request_start_time = time.time()
                ttft = None
                ttlt = None
                chunk_times = []
                chunk_count = 0
                plan_content = ""
                
                if self.provider == "gemini":
                    prompt = self._messages_to_gemini_prompt(messages)
                    response = self.client.generate_content(
                        prompt,
                        generation_config=genai.types.GenerationConfig(
                            temperature=temperature,
                            max_output_tokens=max_tokens,
                        )
                    )
                    plan_content = response.text
                    # Gemini doesn't provide streaming timing, approximate
                    ttft = int((time.time() - request_start_time) * 1000 * 0.1)
                    ttlt = int((time.time() - request_start_time) * 1000)
                    chunk_count = 1
                    
                else:  # openai or groq (streaming)
                    response = self.client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        stream=True,
                    )
                    
                    # Process streaming response
                    first_chunk_received = False
                    last_chunk_time = request_start_time
                    
                    for chunk in response:
                        chunk_received_time = time.time()
                        
                        if not first_chunk_received:
                            # First token received
                            ttft = int((chunk_received_time - request_start_time) * 1000)
                            first_chunk_received = True
                            print(f"🎯 TTFT: {ttft}ms")
                        else:
                            # Record time since last chunk
                            time_since_last = int((chunk_received_time - last_chunk_time) * 1000)
                            chunk_times.append(time_since_last)
                        
                        last_chunk_time = chunk_received_time
                        chunk_count += 1
                        
                        # Extract content
                        if chunk.choices and len(chunk.choices) > 0:
                            delta = chunk.choices[0].delta
                            if hasattr(delta, 'content') and delta.content:
                                plan_content += delta.content
                    
                    # Last token received
                    ttlt = int((last_chunk_time - request_start_time) * 1000)
                    print(f"🏁 TTLT: {ttlt}ms")
                
                # Calculate metrics
                generation_time = ttlt - ttft if ttft and ttlt else ttlt
                
                # Get token counts (make a non-streaming call to get usage)
                # For streaming, we need to count tokens ourselves or make a follow-up call
                token_response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages + [{"role": "assistant", "content": plan_content}],
                    temperature=0,
                    max_tokens=1,
                ) if self.provider != "gemini" else None
                
                input_tokens = token_response.usage.prompt_tokens if token_response and token_response.usage else len(str(messages).split())
                output_tokens = token_response.usage.completion_tokens if token_response and token_response.usage else len(plan_content.split())
                total_tokens = input_tokens + output_tokens
                
                # Calculate derived metrics
                tokens_per_second = output_tokens / (generation_time / 1000) if generation_time > 0 else 0
                mean_time_per_token = generation_time / output_tokens if output_tokens > 0 else 0
                time_between_chunks_avg = int(np.mean(chunk_times)) if chunk_times else 0
                time_between_chunks_p95 = int(np.percentile(chunk_times, 95)) if chunk_times else 0
                
                # Context window usage (assuming GPT-4 8k context)
                context_window_size = 8000 if "gpt-4" in self.model else 4000
                context_window_usage_pct = (total_tokens / context_window_size) * 100
                
                # Add all streaming and performance attributes to span
                span.set_attribute("ai.ttft", ttft or 0)
                span.set_attribute("ai.ttlt", ttlt or 0)
                span.set_attribute("ai.queue_time", 0)  # Could measure if we track queue
                span.set_attribute("ai.generation_time", generation_time or 0)
                span.set_attribute("ai.tokens_per_second", round(tokens_per_second, 2))
                span.set_attribute("ai.mean_time_per_token", round(mean_time_per_token, 2))
                
                # Stream-specific metrics
                span.set_attribute("ai.chunk_count", chunk_count)
                span.set_attribute("ai.time_between_chunks_avg", time_between_chunks_avg)
                span.set_attribute("ai.time_between_chunks_p95", time_between_chunks_p95)
                
                # Token usage
                span.set_attribute("ai.input_tokens", input_tokens)
                span.set_attribute("ai.output_tokens", output_tokens)
                span.set_attribute("ai.total_tokens", total_tokens)
                span.set_attribute("ai.context_window_usage_pct", round(context_window_usage_pct, 2))
                
                # Caching (placeholder - would need actual cache implementation)
                span.set_attribute("ai.cache_hit", False)
                
                print(f"📊 AI Metrics: TTFT={ttft}ms, TTLT={ttlt}ms, tokens/sec={tokens_per_second:.1f}, chunks={chunk_count}")
            
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
            
            if generation:
                generation.end(
                    output=plan_content,
                    metadata={
                        "action_plan_id": action_plan.id,
                        "tokens": total_tokens,
                        "ttft_ms": ttft,
                        "ttlt_ms": ttlt,
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
    
    def _calculate_complexity(self, messages: List[Dict[str, str]]) -> str:
        """Calculate prompt complexity based on length and structure"""
        total_length = sum(len(m["content"]) for m in messages)
        message_count = len(messages)
        
        # Simple heuristic
        if total_length < 500 or message_count <= 2:
            return "simple"
        elif total_length < 2000 or message_count <= 5:
            return "medium"
        else:
            return "high"

# Global AI service instance
ai_service = AIService()

