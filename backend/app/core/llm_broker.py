import os
import json
import logging
import asyncio
from typing import AsyncGenerator
import httpx
from huggingface_hub import AsyncInferenceClient

logger = logging.getLogger("kairos.orchestrator")

class LLMOrchestrator:
    def __init__(self):
        self.groq_key = os.getenv("GROQ_API_KEY")
        self.nvidia_key = os.getenv("NVIDIA_API_KEY")
        self.nvidia_model = os.getenv("NVIDIA_MODEL", "z-ai/glm-5.1")
        self.hf_key = os.getenv("HF_API_KEY")
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "deepseek-r1:8b")
        
        self.hf_client = AsyncInferenceClient(token=self.hf_key) if self.hf_key else AsyncInferenceClient()

    async def generate_text(
        self,
        system_prompt: str,
        prompt: str,
        task_preference: str = "pitch",
        max_tokens: int = 1500
    ) -> str:
        """
        Non-streaming text generator using the orchestrated LLM fallback chain.
        """
        full_text = []
        async for chunk in self.stream_orchestrated(system_prompt, prompt, task_preference, max_tokens):
            if chunk.startswith("data:"):
                try:
                    payload = json.loads(chunk[5:].strip())
                    if payload.get("type") == "text_delta":
                        full_text.append(payload.get("content", ""))
                except Exception:
                    pass
        return "".join(full_text).strip()

    async def stream_orchestrated(
        self, 
        system_prompt: str, 
        prompt: str, 
        task_preference: str = "chat",
        max_tokens: int = 1000
    ) -> AsyncGenerator[str, None]:
        """
        Orchestrates calls based on task preference and fallback rules:
        - chat: Ollama (Local) -> Groq (llama-3.1-8b-instant)
        - critique/roadmap/reflection/refinement: Groq (llama-3.3-70b-versatile) -> Hugging Face (Qwen2.5-72B)
        - pitch: Nvidia NIM (GLM-4 / Llama 3) -> Hugging Face (Qwen2.5-72B)
        """
        task = task_preference.lower()
        
        if "chat" in task:
            # Route: Local Ollama -> Groq -> Hugging Face
            chain = [("ollama", self._stream_ollama), ("groq_chat", self._stream_groq), ("huggingface", self._stream_hf)]
        elif "pitch" in task:
            # Route: Nvidia NIM -> Hugging Face -> Groq
            chain = [("nvidia", self._stream_nvidia), ("huggingface", self._stream_hf), ("groq_heavy", self._stream_groq)]
        else:
            # critique / roadmap / reflection / refinement
            # Route: Groq -> Hugging Face
            chain = [("groq_heavy", self._stream_groq), ("huggingface", self._stream_hf)]

        success = False
        last_error = None

        for engine_name, stream_func in chain:
            try:
                logger.info(f"Orchestrator: Attempting task '{task}' using '{engine_name}'")
                async for chunk in stream_func(system_prompt, prompt, max_tokens):
                    yield chunk
                success = True
                break
            except Exception as e:
                last_error = e
                logger.warning(f"Orchestrator: Engine '{engine_name}' failed. Error: {str(e)}")
                await asyncio.sleep(0.1)

        if not success:
            logger.critical("Orchestrator: All engines in cascade chain failed.")
            yield f"data: {json.dumps({'type': 'error', 'content': f'All LLM backends are currently unavailable. Last error: {str(last_error)}'})}\n\n"

    async def _stream_ollama(self, system_prompt: str, prompt: str, max_tokens: int) -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient(timeout=3.0) as client:
            async with client.stream(
                "POST",
                f"{self.ollama_url}/api/chat",
                headers={"ngrok-skip-browser-warning": "true"},
                json={
                    "model": self.ollama_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "stream": True,
                    "options": {
                        "num_predict": max_tokens
                    }
                }
            ) as response:
                if response.status_code != 200:
                    raise ValueError(f"Ollama returned status {response.status_code}")
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            content = data.get("message", {}).get("content", "")
                            if content:
                                yield f"data: {json.dumps({'type': 'text_delta', 'content': content})}\n\n"
                        except:
                            pass

    async def _stream_groq(self, system_prompt: str, prompt: str, max_tokens: int) -> AsyncGenerator[str, None]:
        if not self.groq_key:
            raise ValueError("GROQ_API_KEY is not configured")
        
        # Decide model based on size/task context
        # Llama 3.1 8B is perfect for chat; Llama 3.3 70B for reasoning tasks
        model = "llama-3.1-8b-instant" if "chat" in system_prompt.lower() else "llama-3.3-70b-versatile"
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            async with client.stream(
                "POST",
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.groq_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "stream": True,
                    "max_tokens": max_tokens
                }
            ) as response:
                if response.status_code != 200:
                    err = await response.aread()
                    raise ValueError(f"Groq API returned {response.status_code}: {err.decode()}")
                
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        line_data = line[5:].strip()
                        if line_data == "[DONE]":
                            break
                        try:
                            data = json.loads(line_data)
                            delta = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if delta:
                                yield f"data: {json.dumps({'type': 'text_delta', 'content': delta})}\n\n"
                        except:
                            pass

    async def _stream_nvidia(self, system_prompt: str, prompt: str, max_tokens: int) -> AsyncGenerator[str, None]:
        if not self.nvidia_key:
            raise ValueError("NVIDIA_API_KEY is not configured")
        
        # NVIDIA model is loaded from env, default is z-ai/glm-5.1
        model = self.nvidia_model
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            async with client.stream(
                "POST",
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.nvidia_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "stream": True,
                    "max_tokens": max_tokens
                }
            ) as response:
                if response.status_code != 200:
                    err = await response.aread()
                    raise ValueError(f"Nvidia API returned {response.status_code}: {err.decode()}")
                
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        line_data = line[5:].strip()
                        if line_data == "[DONE]":
                            break
                        try:
                            data = json.loads(line_data)
                            delta = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if delta:
                                yield f"data: {json.dumps({'type': 'text_delta', 'content': delta})}\n\n"
                        except:
                            pass

    async def _stream_hf(self, system_prompt: str, prompt: str, max_tokens: int) -> AsyncGenerator[str, None]:
        # Qwen 2.5 72B is an excellent free Hugging Face model fallback
        model_name = "Qwen/Qwen2.5-72B-Instruct"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]
        
        stream = await self.hf_client.chat_completion(
            model=model_name,
            messages=messages,
            max_tokens=max_tokens,
            stream=True
        )
        
        async for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield f"data: {json.dumps({'type': 'text_delta', 'content': token})}\n\n"
