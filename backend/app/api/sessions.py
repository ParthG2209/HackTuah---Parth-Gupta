import uuid
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List, Optional
from backend.app.db.connection import get_db
from backend.app.db.models import Session, Profile, Team, Task, Blocker, TeamMember
from backend.app.core.parser import parse_document
from backend.app.agents.coach import CoachAgent

router = APIRouter(prefix="/sessions", tags=["Sessions"])
logger = logging.getLogger("kairos.sessions")

class SessionCreateSchema(BaseModel):
    name: str
    creator_id: uuid.UUID
    team_id: Optional[uuid.UUID] = None

class SessionResponseSchema(BaseModel):
    id: uuid.UUID
    name: str
    creator_id: uuid.UUID
    team_id: Optional[uuid.UUID] = None
    problem_statement: Optional[str] = None
    user_idea: Optional[str] = None
    milestones: Optional[List[dict]] = []
    pitch_outline: Optional[dict] = {}
    scope_critique: Optional[str] = None
    status: str
    created_at: str

class RoadmapUpdateSchema(BaseModel):
    milestones: List[dict]
    status: Optional[str] = None
    scope_critique: Optional[str] = None

class ChatMessageSchema(BaseModel):
    message: str
    history: List[dict] # [{role: 'user'/'assistant', content: '...'}]
    model_preference: Optional[str] = "claude"

@router.post("", response_model=SessionResponseSchema)
async def create_session(data: SessionCreateSchema, db: AsyncSession = Depends(get_db)):
    # Validate creator profile
    creator_result = await db.execute(select(Profile).where(Profile.id == data.creator_id))
    if not creator_result.scalars().first():
        raise HTTPException(status_code=404, detail="Creator profile not found")
        
    session_id = uuid.uuid4()
    new_session = Session(
        id=session_id,
        name=data.name,
        creator_id=data.creator_id,
        team_id=data.team_id,
        status="planning",
        milestones=[],
        pitch_outline={}
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return SessionResponseSchema(
        id=new_session.id,
        name=new_session.name,
        creator_id=new_session.creator_id,
        team_id=new_session.team_id,
        problem_statement=new_session.problem_statement,
        user_idea=new_session.user_idea,
        milestones=new_session.milestones,
        pitch_outline=new_session.pitch_outline,
        scope_critique=new_session.scope_critique,
        status=new_session.status,
        created_at=str(new_session.created_at)
    )

@router.get("", response_model=List[SessionResponseSchema])
async def list_sessions(profile_id: Optional[uuid.UUID] = None, db: AsyncSession = Depends(get_db)):
    if profile_id:
        # Fetch team memberships for this profile
        team_memberships_res = await db.execute(
            select(TeamMember.team_id).where(TeamMember.profile_id == profile_id)
        )
        team_ids = team_memberships_res.scalars().all()
        
        from sqlalchemy import or_
        conditions = [Session.creator_id == profile_id]
        if team_ids:
            conditions.append(Session.team_id.in_(team_ids))
        
        query = select(Session).where(or_(*conditions)).order_by(Session.created_at.desc())
        result = await db.execute(query)
    else:
        result = await db.execute(select(Session).order_by(Session.created_at.desc()))
        
    sessions = result.scalars().all()
    return [
        SessionResponseSchema(
            id=s.id,
            name=s.name,
            creator_id=s.creator_id,
            team_id=s.team_id,
            problem_statement=s.problem_statement,
            user_idea=s.user_idea,
            milestones=s.milestones,
            pitch_outline=s.pitch_outline,
            scope_critique=s.scope_critique,
            status=s.status,
            created_at=str(s.created_at)
        ) for s in sessions
    ]
@router.post("/general-chat")
async def chat_general(data: ChatMessageSchema):
    from backend.app.core.llm_broker import LLMOrchestrator
    broker = LLMOrchestrator()
    from fastapi.responses import StreamingResponse
    import json

    
    system_prompt = (
        "You are KAIROS, an AI assistant. The user is chatting with you casually, "
        "and currently has no active hackathon project session selected. "
        "Answer their questions directly and conversationally."
    )
    
    async def sse_generator():
        try:
            async for chunk in broker.stream_orchestrated(system_prompt, data.message, task_preference="chat", max_tokens=1000):
                yield chunk
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.get("/{session_id}", response_model=SessionResponseSchema)
async def get_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).where(Session.id == session_id))
    s = result.scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponseSchema(
        id=s.id,
        name=s.name,
        creator_id=s.creator_id,
        team_id=s.team_id,
        problem_statement=s.problem_statement,
        user_idea=s.user_idea,
        milestones=s.milestones,
        pitch_outline=s.pitch_outline,
        scope_critique=s.scope_critique,
        status=s.status,
        created_at=str(s.created_at)
    )

@router.post("/{session_id}/concept")
async def submit_concept(
    session_id: uuid.UUID,
    user_idea: str = Form(...),
    problem_statement_text: Optional[str] = Form(None),
    model_preference: str = Form("claude"),
    problem_statement_file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    # Fetch session
    sess_result = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Extract problem statement text
    prob_text = ""
    if problem_statement_file:
        file_bytes = await problem_statement_file.read()
        prob_text = parse_document(problem_statement_file.filename, file_bytes)
    elif problem_statement_text:
        prob_text = problem_statement_text
        
    session.problem_statement = prob_text
    session.user_idea = user_idea
    await db.commit()
    
    # Compile capabilities profile (master team JSON or solo profile)
    capabilities = {}
    if session.team_id:
        team_result = await db.execute(select(Team).where(Team.id == session.team_id))
        team = team_result.scalars().first()
        if team and team.master_json:
            capabilities = team.master_json
    else:
        # Solo user profile
        prof_result = await db.execute(select(Profile).where(Profile.id == session.creator_id))
        prof = prof_result.scalars().first()
        if prof:
            capabilities = {
                "name": prof.full_name,
                "role": prof.primary_role,
                "level": prof.experience_level,
                "skills": prof.tech_stack
            }
            
    # Define response stream generator
    async def sse_generator():
        # Streams direct output from LLM Coach Agent
        async for chunk in CoachAgent.generate_roadmap(
            hackathon_name=session.name,
            problem_statement=session.problem_statement,
            user_idea=session.user_idea,
            team_profile_json=capabilities,
            model_preference=model_preference
        ):
            yield chunk
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

from sqlalchemy.orm.attributes import flag_modified

@router.put("/{session_id}/roadmap", response_model=SessionResponseSchema)
async def update_roadmap(
    session_id: uuid.UUID,
    data: RoadmapUpdateSchema,
    db: AsyncSession = Depends(get_db)
):
    try:
        sess_result = await db.execute(select(Session).where(Session.id == session_id))
        session = sess_result.scalars().first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        # Update milestones JSON
        session.milestones = data.milestones
        flag_modified(session, "milestones")
        
        if data.status:
            session.status = data.status
        if data.scope_critique is not None:
            session.scope_critique = data.scope_critique
            
        await db.commit()
        await db.refresh(session)
        
        # Auto-generate tasks only when session transitions to execution phase
        if session.status == "execution":
            try:
                task_count_res = await db.execute(select(Task).where(Task.session_id == session_id))
                if not task_count_res.scalars().first():
                    # Seed tasks based on deliverables and duration estimate
                    for m_idx, m in enumerate(data.milestones or []):
                        task_id = uuid.uuid4()
                        if isinstance(m, dict):
                            title = m.get("title") or f"Task {m_idx + 1}"
                            deliverable = m.get("deliverable") or "Setup baseline code structure"
                            phase_id = m.get("phase") or f"phase_{m_idx + 1}"
                            risk = m.get("risk_level") or "medium"
                        else:
                            title = getattr(m, "title", None) or f"Task {m_idx + 1}"
                            deliverable = getattr(m, "deliverable", None) or "Setup baseline code structure"
                            phase_id = getattr(m, "phase", None) or f"phase_{m_idx + 1}"
                            risk = getattr(m, "risk_level", None) or "medium"
                        
                        task = Task(
                            id=task_id,
                            session_id=session_id,
                            name=f"{title} - {deliverable}",
                            milestone_id=phase_id,
                            priority=risk if risk in ["low", "medium", "high"] else "medium",
                            status="pending",
                            dependencies=[]
                        )
                        db.add(task)
                    await db.commit()
            except Exception as e:
                logger.error(f"Error seeding tasks on session execution: {e}")
                await db.rollback()
                # Re-fetch session after rollback to ensure consistent state
                sess_result2 = await db.execute(select(Session).where(Session.id == session_id))
                session = sess_result2.scalars().first()
            
        return SessionResponseSchema(
            id=session.id,
            name=session.name,
            creator_id=session.creator_id,
            team_id=session.team_id,
            problem_statement=session.problem_statement,
            user_idea=session.user_idea,
            milestones=session.milestones or [],
            pitch_outline=session.pitch_outline or {},
            scope_critique=session.scope_critique,
            status=session.status,
            created_at=str(session.created_at) if session.created_at else ""
        )
    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        logger.error(f"Unhandled error in update_roadmap: {exc}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/{session_id}/chat")
async def chat_with_coach(
    session_id: uuid.UUID,
    data: ChatMessageSchema,
    db: AsyncSession = Depends(get_db)
):
    sess_result = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Check if user message is requesting a task status update & execute DB mutation
    msg_lower = data.message.lower()
    target_status = None
    if any(k in msg_lower for k in ["pending", "reset", "uncheck", "todo"]):
        target_status = "pending"
    elif any(k in msg_lower for k in ["in_progress", "progress", "working"]):
        target_status = "in_progress"
    elif any(k in msg_lower for k in ["block", "blocked", "stuck"]):
        target_status = "blocked"
    elif any(k in msg_lower for k in ["done", "complete", "completed", "finish"]):
        target_status = "completed"

    updated_task_info = None
    if target_status:
        all_tasks_db = (await db.execute(select(Task).where(Task.session_id == session_id))).scalars().all()
        
        filler_words = {"mark", "as", "completed", "complete", "done", "finish", "task", "to", "in", "progress", "blocked", "status", "the", "a", "set", "is"}
        query_words = [w for w in msg_lower.split() if w not in filler_words and len(w) > 2]

        best_task = None
        max_score = 0

        for t in all_tasks_db:
            t_name_lower = t.name.lower()
            clean_query = msg_lower.replace("mark", "").replace("as", "").replace("completed", "").replace("complete", "").replace("done", "").replace("task", "").strip()
            
            # Check if any main phrase matches (e.g. "live demo preparation")
            if clean_query and (clean_query in t_name_lower or t_name_lower in msg_lower):
                best_task = t
                break

            t_words = t_name_lower.split()
            score = sum(1 for w in query_words if any(w in tw for tw in t_words))
            if score > max_score:
                max_score = score;
                best_task = t

        matched_task = best_task
        if not matched_task and all_tasks_db:
            if target_status == "completed":
                matched_task = next((t for t in all_tasks_db if t.status != "completed"), all_tasks_db[0])
            else:
                matched_task = all_tasks_db[0]

        if matched_task:
            matched_task.status = target_status
            await db.commit()
            await db.refresh(matched_task)
            updated_task_info = f"Task '{matched_task.name}' status has been updated to '{target_status}' in PostgreSQL database."

    # Gather tasks and blockers for deep model understanding
    tasks_res = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks_list = [{"name": t.name, "status": t.status, "priority": t.priority, "milestone_id": t.milestone_id} for t in tasks_res.scalars().all()]
    
    blockers_res = await db.execute(select(Blocker).where(Blocker.session_id == session_id))
    blockers_list = [{"description": b.description, "severity": b.severity, "status": b.status} for b in blockers_res.scalars().all()]

    # Gather project context
    context = {
        "project_name": session.name,
        "problem_statement": session.problem_statement,
        "user_idea": session.user_idea,
        "milestones": session.milestones,
        "tasks": tasks_list,
        "blockers": blockers_list,
        "status": session.status,
        "system_action_taken": updated_task_info
    }
    
    async def sse_generator():
        async for chunk in CoachAgent.chat_coach(
            history=data.history,
            new_message=data.message,
            project_context=context,
            model_preference=data.model_preference
        ):
            yield chunk
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.get("/{session_id}/concept-gaps")
async def get_concept_gaps(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Reviews the session's project concept to identify missing architectural or feature pieces."""
    sess_result = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    team_data = {}
    if session.team_id:
        team_res = await db.execute(select(Team).where(Team.id == session.team_id))
        team = team_res.scalars().first()
        if team and team.master_json:
            team_data = team.master_json

    async def sse_generator():
        async for chunk in CoachAgent.analyze_concept_gaps(
            hackathon_name=session.name,
            problem_statement=session.problem_statement or "",
            user_idea=session.user_idea or "",
            team_profile_json=team_data
        ):
            yield chunk

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.post("/{session_id}/recalibrate-roadmap")
async def recalibrate_session_roadmap(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Generates a recalibrated roadmap based on slipping tasks, blockers, and progress."""
    sess_result = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Get active tasks
    tasks_res = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks = tasks_res.scalars().all()
    
    # Get open blockers
    blockers_res = await db.execute(select(Blocker).where(Blocker.session_id == session_id, Blocker.status == "open"))
    blockers = blockers_res.scalars().all()
    
    # Get slipping tasks
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    slipping_tasks = []
    active_tasks_list = []
    
    for t in tasks:
        task_info = {
            "id": str(t.id),
            "name": t.name,
            "status": t.status,
            "deadline": str(t.deadline) if t.deadline else None,
            "priority": t.priority
        }
        active_tasks_list.append(task_info)
        
        # Check if slipping
        if t.status != "completed" and t.deadline:
            # deadline is past or within 2 hours
            if t.deadline < now or t.deadline <= (now + timedelta(hours=2)):
                slipping_tasks.append(task_info)
                
    # Get team/creator details for profile
    capabilities = {}
    if session.team_id:
        team_result = await db.execute(select(Team).where(Team.id == session.team_id))
        team = team_result.scalars().first()
        if team and team.master_json:
            capabilities = team.master_json
    else:
        prof_result = await db.execute(select(Profile).where(Profile.id == session.creator_id))
        prof = prof_result.scalars().first()
        if prof:
            capabilities = {
                "name": prof.full_name,
                "role": prof.primary_role,
                "level": prof.experience_level,
                "skills": prof.tech_stack
            }

    async def sse_generator():
        async for chunk in CoachAgent.recalibrate_roadmap(
            hackathon_name=session.name,
            problem_statement=session.problem_statement or "",
            user_idea=session.user_idea or "",
            current_milestones=session.milestones or [],
            active_tasks=active_tasks_list,
            open_blockers=[{"description": b.description, "severity": b.severity} for b in blockers],
            slipping_tasks=slipping_tasks,
            team_profile_json=capabilities
        ):
            yield chunk

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


@router.delete("/{session_id}")
async def delete_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Deletes a coaching session and all cascaded tasks/blockers."""
    sess_result = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await db.delete(session)
    await db.commit()
    return {"status": "success", "message": "Session deleted successfully"}
