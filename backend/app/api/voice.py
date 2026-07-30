import os
import logging
import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/voice", tags=["Voice Speech Recognition"])
logger = logging.getLogger("kairos.voice")

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribes incoming audio file (WebM / WAV / MP3 / OGG) using Groq Whisper API (whisper-large-v3-turbo).
    """
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured in environment")

    try:
        audio_content = await file.read()
        filename = file.filename or "audio.webm"
        mime_type = file.content_type or "audio/webm"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={
                    "Authorization": f"Bearer {groq_key}"
                },
                files={
                    "file": (filename, audio_content, mime_type)
                },
                data={
                    "model": "whisper-large-v3-turbo",
                    "language": "en"
                }
            )

        if response.status_code != 200:
            logger.error(f"Groq Whisper API error: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Whisper API error: {response.text}")

        res_data = response.json()
        text = res_data.get("text", "").strip()
        return {"text": text}

    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Audio transcription failed: {str(e)}")
