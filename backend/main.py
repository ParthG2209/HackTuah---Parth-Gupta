import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.db.connection import init_db
from backend.app.api import profiles, teams, sessions, tasks, pitch, voice

app = FastAPI(
    title="KAIROS API",
    description="The AI-powered hackathon project co-founder and execution engine.",
    version="1.0.0"
)

# Enable CORS for the frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "https://kairos-green-phi.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )

@app.on_event("startup")
async def on_startup():
    # Automatically bootstrap SQLite / PostgreSQL tables
    await init_db()

app.include_router(profiles.router, prefix="/api/v1")
app.include_router(teams.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(pitch.router, prefix="/api/v1")
app.include_router(voice.router, prefix="/api/v1")

@app.get("/")
@app.head("/")
async def root():
    return {"status": "online", "message": "KAIROS Core API"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
