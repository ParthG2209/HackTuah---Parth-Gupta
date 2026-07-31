import io
import re
import uuid
import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.app.db.connection import get_db
from backend.app.db.models import Session, Task, Team, Profile, Blocker
from pydantic import BaseModel
from backend.app.agents.coach import CoachAgent
from backend.app.core.ppt_engine import PPTEngine, Presentation

class PitchOutlineUpdateSchema(BaseModel):
    pitch_outline: dict

router = APIRouter(prefix="/sessions/{session_id}/pitch", tags=["Pitch"])
logger = logging.getLogger("kairos.pitch")


def build_pitch_sections(pitch_outline: Optional[dict]) -> dict:
    """Keep the structured pitch content available to the PPT engine.

    The previous implementation collapsed the entire LLM response to one
    180-character sentence and reused it on every slide.  That guaranteed weak
    decks even when the generated pitch itself was good.
    """
    raw = (pitch_outline or {}).get("full_raw", "") if isinstance(pitch_outline, dict) else ""
    raw = str(raw or "")
    sections = {"full_raw": raw}
    if not raw:
        return sections

    matches = list(re.finditer(r"^##\s*(Demo Flow|Pitch Outline|Final Pitch Showcase)\s*$", raw, re.I | re.M))
    key_map = {
        "demo flow": "demo",
        "pitch outline": "slides",
        "final pitch showcase": "showcase",
    }
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(raw)
        key = key_map[match.group(1).lower()]
        sections[key] = raw[match.end():end].strip()
    return sections

@router.post("")
async def generate_pitch_outline(
    session_id: uuid.UUID,
    model_preference: str = "claude",
    db: AsyncSession = Depends(get_db)
):
    # Fetch session
    sess_res = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Retrieve milestones
    milestones = session.milestones or []
    
    # Retrieve tasks
    tasks_res = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks = [
        {
            "name": t.name,
            "status": t.status,
            "priority": t.priority,
            "assigned_to": str(t.assigned_to)
        }
        for t in tasks_res.scalars().all()
    ]

    # Retrieve blockers
    blockers_res = await db.execute(select(Blocker).where(Blocker.session_id == session_id))
    blockers = [
        {
            "description": b.description,
            "severity": b.severity,
            "status": b.status
        }
        for b in blockers_res.scalars().all()
    ]
    
    # Gather team capabilities
    team_data = {}
    if session.team_id:
        team_res = await db.execute(select(Team).where(Team.id == session.team_id))
        team = team_res.scalars().first()
        if team and team.master_json:
            team_data = team.master_json
    else:
        prof_res = await db.execute(select(Profile).where(Profile.id == session.creator_id))
        prof = prof_res.scalars().first()
        if prof:
            team_data = {
                "name": prof.full_name,
                "role": prof.primary_role,
                "level": prof.experience_level,
                "skills": prof.tech_stack
            }
            
    # Stream generator
    async def sse_generator():
        # Streams direct output from CoachAgent's pitch generation
        async for chunk in CoachAgent.generate_pitch(
            project_name=session.name,
            problem_statement=session.problem_statement or "",
            user_idea=session.user_idea or "",
            milestones=milestones,
            tasks=tasks,
            blockers=blockers,
            team_profile_json=team_data,
            model_preference=model_preference
        ):
            yield chunk
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.get("/templates")
async def list_templates():
    from backend.app.core.ppt_engine import PREDEFINED_TEMPLATES
    return {"templates": list(PREDEFINED_TEMPLATES.values())}

@router.post("/analyze-custom-template")
async def analyze_custom_template(
    file: UploadFile = File(...)
):
    if not file.filename or not file.filename.lower().endswith(".pptx"):
        raise HTTPException(status_code=400, detail="Only .pptx files are supported.")
    
    contents = await file.read()
    try:
        prs = Presentation(io.BytesIO(contents))
    except Exception as exc:
        logger.warning("Invalid uploaded PPTX: %s", exc)
        raise HTTPException(status_code=400, detail="The uploaded file is not a readable PPTX presentation.") from exc
    analysis = PPTEngine.analyze_presentation(prs)
    return {
        "status": "success",
        "filename": file.filename,
        "analysis": analysis
    }

class PPTExportRequestSchema(BaseModel):
    template_id: Optional[str] = "template-1"

@router.post("/export-pptx")
async def export_pptx(
    session_id: uuid.UUID,
    file: Optional[UploadFile] = File(None),
    template_id: str = Form("template-1"),
    db: AsyncSession = Depends(get_db)
):
    sess_res = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    milestones = session.milestones or []
    tasks_res = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks = [{"name": t.name, "status": t.status, "priority": t.priority} for t in tasks_res.scalars().all()]

    team_data = {}
    if session.team_id:
        team_res = await db.execute(select(Team).where(Team.id == session.team_id))
        team = team_res.scalars().first()
        if team and team.master_json:
            team_data = team.master_json
    else:
        prof_res = await db.execute(select(Profile).where(Profile.id == session.creator_id))
        profile = prof_res.scalars().first()
        if profile:
            team_data = {
                "name": profile.full_name,
                "role": profile.primary_role,
                "level": profile.experience_level,
                "skills": profile.tech_stack,
            }

    pitch_sections = build_pitch_sections(session.pitch_outline)

    custom_bytes = await file.read() if file else None

    output_bytes = PPTEngine.fill_presentation(
        template_source=template_id,
        session_name=session.name,
        problem_statement=session.problem_statement or "",
        user_idea=session.user_idea or "",
        pitch_sections=pitch_sections,
        milestones=milestones,
        tasks=tasks,
        team_data=team_data,
        custom_pptx_bytes=custom_bytes
    )

    filename = f"{session.name.replace(' ', '_')}_Pitch.pptx"
    return Response(
        content=output_bytes,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/preview-slides")
async def preview_slides(
    session_id: uuid.UUID,
    file: Optional[UploadFile] = File(None),
    template_id: str = Form("template-1"),
    db: AsyncSession = Depends(get_db)
):
    """Generate the exact same PPTX as download and convert each slide to a PNG image for preview."""
    sess_res = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    milestones = session.milestones or []
    tasks_res = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks = [{"name": t.name, "status": t.status, "priority": t.priority} for t in tasks_res.scalars().all()]

    team_data = {}
    if session.team_id:
        team_res = await db.execute(select(Team).where(Team.id == session.team_id))
        team = team_res.scalars().first()
        if team and team.master_json:
            team_data = team.master_json
    else:
        prof_res = await db.execute(select(Profile).where(Profile.id == session.creator_id))
        profile = prof_res.scalars().first()
        if profile:
            team_data = {
                "name": profile.full_name,
                "role": profile.primary_role,
                "level": profile.experience_level,
                "skills": profile.tech_stack,
            }

    pitch_sections = build_pitch_sections(session.pitch_outline)

    custom_bytes = await file.read() if file else None

    # Generate the exact same PPTX as download
    output_bytes = PPTEngine.fill_presentation(
        template_source=template_id,
        session_name=session.name,
        problem_statement=session.problem_statement or "",
        user_idea=session.user_idea or "",
        pitch_sections=pitch_sections,
        milestones=milestones,
        tasks=tasks,
        team_data=team_data,
        custom_pptx_bytes=custom_bytes
    )

    # Convert the same bytes returned by export-pptx.  When LibreOffice is
    # available this includes masters, gradients, crops, and installed fonts;
    # otherwise the engine uses its shape-aware fallback renderer.
    slide_images = PPTEngine.render_slides_as_images(output_bytes, scale=1.0)

    return {
        "status": "success",
        "slide_count": len(slide_images),
        "renderer": "native" if PPTEngine.native_renderer_available() else "fallback",
        "slides": slide_images  # list of base64 PNG strings
    }

@router.api_route("/export-pdf", methods=["GET", "POST"])
async def export_pdf(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    sess_res = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    milestones = session.milestones or []
    tasks_res = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks = [{"name": t.name, "status": t.status, "priority": t.priority} for t in tasks_res.scalars().all()]

    blockers_res = await db.execute(select(Blocker).where(Blocker.session_id == session_id))
    blockers = [{"description": b.description, "severity": b.severity, "status": b.status} for b in blockers_res.scalars().all()]

    team_data = {}
    if session.team_id:
        team_res = await db.execute(select(Team).where(Team.id == session.team_id))
        team = team_res.scalars().first()
        if team and team.master_json:
            team_data = team.master_json
    else:
        prof_res = await db.execute(select(Profile).where(Profile.id == session.creator_id))
        prof = prof_res.scalars().first()
        if prof:
            team_data = {
                "name": prof.full_name,
                "role": prof.primary_role,
                "level": prof.experience_level,
                "skills": prof.tech_stack
            }

    pitch_sections = {}
    if session.pitch_outline and isinstance(session.pitch_outline, dict):
        pitch_sections = session.pitch_outline

    pdf_bytes = PPTEngine.generate_project_pdf(
        session_name=session.name,
        problem_statement=session.problem_statement or "",
        user_idea=session.user_idea or "",
        milestones=milestones,
        tasks=tasks,
        blockers=blockers,
        team_data=team_data,
        pitch_sections=pitch_sections
    )

    filename = f"{session.name.replace(' ', '_')}_Execution_Blueprint.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.put("")
async def save_pitch_outline(
    session_id: uuid.UUID,
    data: PitchOutlineUpdateSchema,
    db: AsyncSession = Depends(get_db)
):
    sess_res = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session.pitch_outline = data.pitch_outline
    await db.commit()
    return {"status": "success", "pitch_outline": session.pitch_outline}

@router.get("/export-submission")
async def export_submission_package(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    sess_res = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    milestones = session.milestones or []
    tasks_res = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks = tasks_res.scalars().all()
    blockers_res = await db.execute(select(Blocker).where(Blocker.session_id == session_id))
    blockers = blockers_res.scalars().all()

    pitch_raw = ""
    if session.pitch_outline and isinstance(session.pitch_outline, dict):
        pitch_raw = session.pitch_outline.get("full_raw", "")

    # Format Devpost & GitHub Submission README
    readme_content = f"""# {session.name}

> **Autonomous Hackathon Co-Founder Submission Package**

---

## 🚀 Inspiration & Problem Statement
{session.problem_statement or 'Solving complex hackathon execution bottlenecks.'}

## 💡 Solution Overview
{session.user_idea or 'Real-time AI workflow engine for rapid hackathon execution.'}

## 🛠️ Architecture & How We Built It
- **Backend**: FastAPI, Async SQLAlchemy, Supabase PostgreSQL, Multi-Model LLM Router (Claude, Gemini, Groq, Ollama)
- **Frontend**: React 19, Lucide React, Glassmorphism CSS Design System
- **Engine**: Real-time PPTX Engine, Multi-Agent Autonomous Roadmap & Task Planner

## 📋 Hackathon Execution Milestones
"""

    for m in milestones:
        phase = m.get('phase', 'Milestone')
        title = m.get('title', '')
        deliverable = m.get('deliverable', '')
        duration = m.get('duration_estimate', '')
        readme_content += f"- **{phase}: {title}**\n  - *Deliverable*: {deliverable}\n  - *Estimated Time*: {duration}\n"

    readme_content += "\n## ✅ Completed Tasks & Progress\n"
    for t in tasks:
        status_icon = "✅" if t.status == "completed" else "⏳"
        readme_content += f"- {status_icon} **{t.name}** (`{t.priority.upper()}` priority) - Status: {t.status}\n"

    if blockers:
        readme_content += "\n## ⚡ Challenges We Ran Into & Resolved\n"
        for b in blockers:
            readme_content += f"- **Challenge**: {b.description} (Severity: `{b.severity}` | Status: `{b.status}`)\n"

    if pitch_raw:
        readme_content += f"\n---\n\n## 🎙️ Presentation & Pitch Script\n\n{pitch_raw}\n"

    readme_content += "\n---\n*Generated automatically by KAIROS AI Hackathon Co-Founder*"

    filename = f"{session.name.replace(' ', '_')}_SUBMISSION_README.md"
    return Response(
        content=readme_content.encode('utf-8'),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
