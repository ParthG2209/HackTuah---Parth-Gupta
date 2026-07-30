import logging
from typing import AsyncGenerator
from backend.app.core.llm_broker import LLMOrchestrator

logger = logging.getLogger("kairos.router")

class MultiModelRouter:
    def __init__(self):
        self.orchestrator = LLMOrchestrator()

    async def stream_complete(self, system_prompt: str, prompt: str, model_preference: str = "deepseek") -> AsyncGenerator[str, None]:
        """
        Stream completion handler that delegates directly to LLMOrchestrator.
        """
        pref = model_preference.lower()
        
        # Optimize output sizes based on task type to minimize credit consumption
        max_tokens = 1000
        if "chat" in pref:
            max_tokens = 500
        elif "pitch" in pref:
            max_tokens = 1500
        elif "reflection" in pref:
            max_tokens = 400
        elif "refinement" in pref:
            max_tokens = 1200
            
        async for chunk in self.orchestrator.stream_orchestrated(
            system_prompt=system_prompt,
            prompt=prompt,
            task_preference=model_preference,
            max_tokens=max_tokens
        ):
            yield chunk
