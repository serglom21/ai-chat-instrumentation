from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

class ConversationMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class SendMessageRequest(BaseModel):
    message: str
    flow_type: Literal["action_plan_creation", "action_plan_edit", "suggestion", "chat"]
    action_plan_id: Optional[str] = None
    conversation_history: List[ConversationMessage] = Field(default_factory=list)

class ActionPlanModel(BaseModel):
    id: str
    title: str
    content: str
    status: Literal["draft", "saved"]
    version: int

class SendMessageResponse(BaseModel):
    response: str
    action_plan: Optional[ActionPlanModel] = None
    suggestions: Optional[List[str]] = None

class GenerateActionPlanRequest(BaseModel):
    template_content: str
    conversation_history: List[ConversationMessage] = Field(default_factory=list)

class GenerateActionPlanResponse(BaseModel):
    response: str
    action_plan: ActionPlanModel

class UpdateActionPlanRequest(BaseModel):
    action_plan_id: str
    edit_instructions: str

class UpdateActionPlanResponse(BaseModel):
    response: str
    action_plan: ActionPlanModel

class CommitActionPlanRequest(BaseModel):
    action_plan_id: str

class CommitActionPlanResponse(BaseModel):
    success: bool
    message: str
    action_plan: ActionPlanModel







