import os
from typing import List, AsyncGenerator, Dict, Any
from groq import Groq, AsyncGroq
from app.core.config import settings
from app.api.schemas import ChatMessage

class AIService:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self._sync_client = None
        self._async_client = None

    @property
    def sync_client(self) -> Groq:
        if not self._sync_client:
            self._sync_client = Groq(api_key=self.api_key or os.getenv("GROQ_API_KEY", ""))
        return self._sync_client

    @property
    def async_client(self) -> AsyncGroq:
        if not self._async_client:
            self._async_client = AsyncGroq(api_key=self.api_key or os.getenv("GROQ_API_KEY", ""))
        return self._async_client

    def _format_messages(self, messages: List[ChatMessage]) -> List[Dict[str, str]]:
        formatted = []
        for msg in messages:
            # Rule: omit tool_calls if not present
            formatted.append({
                "role": msg.role,
                "content": msg.content
            })
        return formatted

    async def generate_chat(
        self,
        messages: List[ChatMessage],
        model: str = "llama-3.3-70b-versatile",
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        formatted_msgs = self._format_messages(messages)
        response = await self.async_client.chat.completions.create(
            model=model,
            messages=formatted_msgs,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        choice = response.choices[0]
        return {
            "model": response.model,
            "role": "assistant",
            "content": choice.message.content or "",
            "finish_reason": choice.finish_reason,
        }

    async def stream_chat(
        self,
        messages: List[ChatMessage],
        model: str = "llama-3.3-70b-versatile",
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        formatted_msgs = self._format_messages(messages)
        stream = await self.async_client.chat.completions.create(
            model=model,
            messages=formatted_msgs,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

ai_service = AIService()
