import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from app.api.schemas import ChatRequest, ChatResponse, HealthResponse
from app.services.ai_service import ai_service
from app.core.config import settings

router = APIRouter(prefix="/api", tags=["API"])

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint to verify backend status and LLM configuration."""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        project=settings.PROJECT_NAME,
        groq_configured=bool(settings.GROQ_API_KEY)
    )

@router.get("/models")
async def list_models():
    """List active fast hackathon models available via Groq."""
    return {
        "models": [
            {"id": "qwen/qwen3.8-27b", "name": "Qwen 3.8 27B (Default High-Reasoning)", "speed": "Ultra Fast"},
            {"id": "openai/gpt-oss-120b", "name": "GPT OSS 120B (Massive Knowledge)", "speed": "Fast"},
            {"id": "openai/gpt-oss-20b", "name": "GPT OSS 20B (Sub-second Rapid)", "speed": "Blazing"},
        ]
    }

@router.post("/chat")
async def chat(request: ChatRequest):
    """Chat endpoint supporting both JSON response and real-time Server-Sent Events (SSE) streaming."""
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not configured in backend environment (.env)"
        )
    
    selected_model = request.model or settings.DEFAULT_MODEL
    
    if request.stream:
        async def event_generator():
            try:
                async for token in ai_service.stream_chat(
                    messages=request.messages,
                    model=selected_model,
                    temperature=request.temperature or 0.1,
                    max_tokens=request.max_tokens or 2048,
                ):
                    yield f"data: {json.dumps({'content': token})}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    try:
        result = await ai_service.generate_chat(
            messages=request.messages,
            model=selected_model,
            temperature=request.temperature or 0.1,
            max_tokens=request.max_tokens or 2048,
        )
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
