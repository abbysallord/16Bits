from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., description="Message content")

class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="List of messages in conversation")
    model: Optional[str] = Field(default="llama-3.3-70b-versatile", description="Groq model ID")
    temperature: Optional[float] = Field(default=0.1, ge=0.0, le=1.0, description="Sampling temperature (0.0 or 0.1 for high stability)")
    max_tokens: Optional[int] = Field(default=2048, ge=64, le=8192, description="Max response tokens")
    stream: Optional[bool] = Field(default=False, description="Whether to stream response tokens")

class ChatResponse(BaseModel):
    model: str
    role: str = "assistant"
    content: str
    finish_reason: Optional[str] = None

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    project: str = "16Bits"
    groq_configured: bool
