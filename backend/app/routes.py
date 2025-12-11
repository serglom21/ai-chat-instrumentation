from fastapi import APIRouter, HTTPException
import logging
import traceback
from app.models import (
    SendMessageRequest,
    SendMessageResponse,
    GenerateActionPlanRequest,
    GenerateActionPlanResponse,
    UpdateActionPlanRequest,
    UpdateActionPlanResponse,
    CommitActionPlanRequest,
    CommitActionPlanResponse,
)
from app.ai_service import ai_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/chat/message", response_model=SendMessageResponse)
async def send_message(request: SendMessageRequest):
    """
    Handle general chat messages
    Supports all flow types: chat, suggestion, action_plan_creation, action_plan_edit
    """
    try:
        response, action_plan, suggestions = await ai_service.generate_chat_response(
            message=request.message,
            flow_type=request.flow_type,
            conversation_history=request.conversation_history,
            action_plan_id=request.action_plan_id,
        )
        
        return SendMessageResponse(
            response=response,
            action_plan=action_plan,
            suggestions=suggestions,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/action-plan/generate", response_model=GenerateActionPlanResponse)
async def generate_action_plan(request: GenerateActionPlanRequest):
    """
    Generate a new action plan from a template
    Flow: ACTION PLAN CREATION
    """
    try:
        response, action_plan = await ai_service.generate_action_plan(
            template_content=request.template_content,
            conversation_history=request.conversation_history,
        )
        
        return GenerateActionPlanResponse(
            response=response,
            action_plan=action_plan,
        )
    except Exception as e:
        logger.error(f"Error in generate_action_plan: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/action-plan/update", response_model=UpdateActionPlanResponse)
async def update_action_plan(request: UpdateActionPlanRequest):
    """
    Update an existing action plan
    Flow: ACTION PLAN EDITING
    """
    try:
        response, action_plan = await ai_service.update_action_plan(
            action_plan_id=request.action_plan_id,
            edit_instructions=request.edit_instructions,
        )
        
        return UpdateActionPlanResponse(
            response=response,
            action_plan=action_plan,
        )
    except ValueError as e:
        logger.error(f"ValueError in update_action_plan: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error in update_action_plan: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/action-plan/commit", response_model=CommitActionPlanResponse)
async def commit_action_plan(request: CommitActionPlanRequest):
    """
    Commit/save an action plan
    Marks the plan as finalized
    """
    try:
        action_plan = await ai_service.commit_action_plan(
            action_plan_id=request.action_plan_id
        )
        
        return CommitActionPlanResponse(
            success=True,
            message="Action plan committed successfully",
            action_plan=action_plan,
        )
    except ValueError as e:
        logger.error(f"ValueError in commit_action_plan: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error in commit_action_plan: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AI Assistant Backend",
        "version": "1.0.0"
    }

