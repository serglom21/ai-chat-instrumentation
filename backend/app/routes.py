from fastapi import APIRouter, HTTPException, Request
import logging
import traceback
from opentelemetry import trace
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

# Get OpenTelemetry tracer
tracer = trace.get_tracer(__name__)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/chat/message", response_model=SendMessageResponse)
async def send_message(request: SendMessageRequest, http_request: Request):
    """
    Handle general chat messages
    Supports all flow types: chat, suggestion, action_plan_creation, action_plan_edit
    """
    # Debug: Log all incoming headers
    logger.info("=== INCOMING REQUEST HEADERS ===")
    for header_name, header_value in http_request.headers.items():
        if 'trace' in header_name.lower() or 'baggage' in header_name.lower() or 'sentry' in header_name.lower():
            logger.info(f"  {header_name}: {header_value}")
    
    # Extract flow context from frontend for distributed tracing
    flow_id = http_request.headers.get('x-flow-id')
    if flow_id:
        # Add flow context to current OpenTelemetry span
        current_span = trace.get_current_span()
        if current_span:
            logger.info(f"  Current span ID: {current_span.get_span_context().span_id}")
            logger.info(f"  Current trace ID: {current_span.get_span_context().trace_id}")
            current_span.set_attribute('flow.id', flow_id)
            current_span.set_attribute('flow.type', request.flow_type)
    
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
async def generate_action_plan(request: GenerateActionPlanRequest, http_request: Request):
    """
    Generate a new action plan from a template
    Flow: ACTION PLAN CREATION
    """
    # Debug: Log all incoming headers
    logger.info("=== INCOMING REQUEST HEADERS (action-plan/generate) ===")
    for header_name, header_value in http_request.headers.items():
        if 'trace' in header_name.lower() or 'baggage' in header_name.lower() or 'sentry' in header_name.lower():
            logger.info(f"  {header_name}: {header_value}")
    
    # Check current span context
    current_span = trace.get_current_span()
    if current_span:
        span_context = current_span.get_span_context()
        logger.info(f"  Current span ID: {format(span_context.span_id, '016x')}")
        logger.info(f"  Current trace ID: {format(span_context.trace_id, '032x')}")
        logger.info(f"  Is valid: {span_context.is_valid}")
    else:
        logger.warning("  No current span found!")
    
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

