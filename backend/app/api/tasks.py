import uuid
import logging
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import List, Optional
from backend.app.db.connection import get_db
from backend.app.db.models import Task, Blocker, Profile, Session, Team
from backend.app.core.router import MultiModelRouter

router = APIRouter(tags=["Tasks & Blockers"])
logger = logging.getLogger("kairos.tasks")
router_llm = MultiModelRouter()

class TaskCreateSchema(BaseModel):
    name: str
    assigned_to: Optional[uuid.UUID] = None
    deadline: Optional[datetime] = None
    milestone_id: str
    priority: str = "medium"
    dependencies: List[uuid.UUID] = []

class TaskResponseSchema(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    name: str
    assigned_to: Optional[uuid.UUID] = None
    deadline: Optional[datetime] = None
    milestone_id: str
    priority: str
    dependencies: List[uuid.UUID] = []
    status: str

class TaskUpdateSchema(BaseModel):
    name: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None
    deadline: Optional[datetime] = None
    priority: Optional[str] = None
    status: Optional[str] = None # pending, in_progress, completed, blocked
    dependencies: Optional[List[uuid.UUID]] = None
    blocker_description: Optional[str] = None

class BlockerResponseSchema(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    task_id: Optional[uuid.UUID] = None
    description: str
    severity: str
    status: str
    created_at: Optional[str] = None

@router.get("/sessions/{session_id}/tasks", response_model=List[TaskResponseSchema])
async def list_tasks(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks = result.scalars().all()
    
    # Run dependency checks before returning
    await check_dependency_blockers(session_id, db)
    
    # Refetch after checks
    result = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks = result.scalars().all()
    
    return [
        TaskResponseSchema(
            id=t.id,
            session_id=t.session_id,
            name=t.name,
            assigned_to=t.assigned_to,
            deadline=t.deadline,
            milestone_id=t.milestone_id,
            priority=t.priority,
            dependencies=t.dependencies or [],
            status=t.status
        ) for t in tasks
    ]

@router.post("/sessions/{session_id}/tasks", response_model=TaskResponseSchema)
async def create_task(
    session_id: uuid.UUID,
    data: TaskCreateSchema,
    db: AsyncSession = Depends(get_db)
):
    # Validate session
    sess_res = await db.execute(select(Session).where(Session.id == session_id))
    if not sess_res.scalars().first():
        raise HTTPException(status_code=404, detail="Session not found")
        
    task_id = uuid.uuid4()
    task = Task(
        id=task_id,
        session_id=session_id,
        name=data.name,
        assigned_to=data.assigned_to,
        deadline=data.deadline,
        milestone_id=data.milestone_id,
        priority=data.priority,
        dependencies=data.dependencies,
        status="pending"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    
    return TaskResponseSchema(
        id=task.id,
        session_id=task.session_id,
        name=task.name,
        assigned_to=task.assigned_to,
        deadline=task.deadline,
        milestone_id=task.milestone_id,
        priority=task.priority,
        dependencies=task.dependencies or [],
        status=task.status
    )

@router.put("/tasks/{task_id}", response_model=TaskResponseSchema)
async def update_task(
    task_id: uuid.UUID,
    data: TaskUpdateSchema,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    old_status = task.status
    
    # Update properties
    if data.name is not None:
        task.name = data.name
    if data.assigned_to is not None:
        task.assigned_to = data.assigned_to
    if data.deadline is not None:
        task.deadline = data.deadline
    if data.priority is not None:
        task.priority = data.priority
    if data.dependencies is not None:
        task.dependencies = data.dependencies
    if data.status is not None:
        task.status = data.status
        
    await db.commit()
    await db.refresh(task)
    
    # Auto-Blocker Generation
    if task.status == "blocked" and old_status != "blocked":
        # Check if blocker already exists for this task
        blocker_res = await db.execute(
            select(Blocker).where(Blocker.task_id == task.id, Blocker.status == "open")
        )
        if not blocker_res.scalars().first():
            desc = data.blocker_description or f"Task '{task.name}' was manually marked as Blocked by assignee."
            new_blocker = Blocker(
                id=uuid.uuid4(),
                session_id=task.session_id,
                task_id=task.id,
                description=desc,
                severity=task.priority,
                status="open"
            )
            db.add(new_blocker)
            await db.commit()
            
    elif task.status != "blocked" and old_status == "blocked":
        # Resolve blockers linked to this task
        blockers_res = await db.execute(
            select(Blocker).where(Blocker.task_id == task.id, Blocker.status == "open")
        )
        for b in blockers_res.scalars().all():
            b.status = "resolved"
        await db.commit()
        
    # Re-evaluate all dependency blocks
    await check_dependency_blockers(task.session_id, db)
    
    return TaskResponseSchema(
        id=task.id,
        session_id=task.session_id,
        name=task.name,
        assigned_to=task.assigned_to,
        deadline=task.deadline,
        milestone_id=task.milestone_id,
        priority=task.priority,
        dependencies=task.dependencies or [],
        status=task.status
    )

@router.get("/sessions/{session_id}/blockers", response_model=List[BlockerResponseSchema])
async def list_blockers(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Blocker).where(Blocker.session_id == session_id))
    blockers = result.scalars().all()
    return [
        BlockerResponseSchema(
            id=b.id,
            session_id=b.session_id,
            task_id=b.task_id,
            description=b.description,
            severity=b.severity,
            status=b.status,
            created_at=str(b.created_at)
        ) for b in blockers
    ]

@router.get("/sessions/{session_id}/task-suggestions")
async def get_task_suggestions(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """AI continuously analyzes task statuses, dependencies, missed deadlines, and blocks to recommend re-assignments."""
    sess_result = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    tasks_res = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks = tasks_res.scalars().all()
    
    blockers_res = await db.execute(select(Blocker).where(Blocker.session_id == session_id, Blocker.status == "open"))
    blockers = blockers_res.scalars().all()
    
    # Get team details
    team_data = {}
    if session.team_id:
        team_res = await db.execute(select(Team).where(Team.id == session.team_id))
        team = team_res.scalars().first()
        if team and team.master_json:
            team_data = team.master_json
            
    # Identify slipping tasks
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    slipping_tasks = []
    for t in tasks:
        if t.status != "completed" and t.deadline:
            if t.deadline < now or t.deadline <= (now + timedelta(hours=2)):
                slipping_tasks.append({
                    "id": str(t.id),
                    "name": t.name,
                    "deadline": str(t.deadline),
                    "assigned_to": str(t.assigned_to) if t.assigned_to else "unassigned",
                    "status": t.status
                })

    # LLM request
    system_prompt = (
        "You are KAIROS, the team's Project Execution Analyst.\n"
        "Your task is to analyze the active milestones, tasks, open blockers, slipping tasks, and team profile JSON.\n"
        "Specifically identify:\n"
        "1. Critical risks (e.g. tasks using technologies not listed in any member's skill set, or tasks assigned to members without matching skills).\n"
        "2. Slipping tasks (tasks past deadline or due very soon but not completed) and their delay impact.\n"
        "3. Actionable adjustments, reassignments, or descoping suggestions to get back on track.\n"
        "Keep your output short, direct, and formatted in clean markdown bullet points. Do not include markdown code block wrappings."
    )
    
    prompt = (
        f"Active Tasks:\n"
        f"{[{'id': str(t.id), 'name': t.name, 'assigned_to': str(t.assigned_to), 'status': t.status, 'dependencies': [str(d) for d in (t.dependencies or [])]} for t in tasks]}\n\n"
        f"Slipping Tasks (Overdue or due in <2 hours):\n"
        f"{slipping_tasks}\n\n"
        f"Active Blockers:\n"
        f"{[{'description': b.description, 'severity': b.severity} for b in blockers]}\n\n"
        f"Team Members Profile:\n"
        f"{team_data}\n\n"
        "Provide direct recommendations for risk mitigation, slipping task updates, and task re-assignments."
    )
    
    # Call Gemini or Claude wrapper synchronously (non-streaming helper for direct API payload)
    from backend.app.agents.coach import router as router_instance
    ans = ""
    async for chunk in router_instance.stream_complete(system_prompt, prompt, "claude"):
        # Accumulate text deltas from chunk payload
        if chunk.startswith("data:"):
            try:
                val = json.loads(chunk[5:].strip())
                if val.get("type") == "text_delta":
                    ans += val.get("content", "")
            except Exception:
                pass

    if not ans:
        ans = "* No critical blockages or delay threats detected. Keep pushing forward!"
        
    return {"suggestions": ans}

async def check_dependency_blockers(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Automatically marks tasks as blocked and creates blockers if they have incomplete dependencies."""
    result = await db.execute(select(Task).where(Task.session_id == session_id))
    tasks = result.scalars().all()
    
    task_map = {t.id: t for t in tasks}
    
    for task in tasks:
        if task.status in ["completed", "blocked"]:
            continue
            
        # Check if any dependencies are NOT completed
        has_blocked_dependency = False
        blocking_task_name = ""
        
        for dep_id in (task.dependencies or []):
            dep_task = task_map.get(dep_id)
            if dep_task and dep_task.status != "completed":
                has_blocked_dependency = True
                blocking_task_name = dep_task.name
                break
                
        if has_blocked_dependency:
            # Change status to blocked
            task.status = "blocked"
            
            # Create blocker entry if not already present
            blocker_res = await db.execute(
                select(Blocker).where(Blocker.task_id == task.id, Blocker.status == "open")
            )
            if not blocker_res.scalars().first():
                new_blocker = Blocker(
                    id=uuid.uuid4(),
                    session_id=session_id,
                    task_id=task.id,
                    description=f"Task '{task.name}' is automatically blocked because its dependency task '{blocking_task_name}' is not completed.",
                    severity=task.priority,
                    status="open"
                )
                db.add(new_blocker)
    await db.commit()

@router.post("/tasks/blockers/{blocker_id}/suggest-fix")
async def suggest_blocker_fix(blocker_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """AI analyzes a specific blocker and suggests a quick code/architecture fix."""
    blocker_res = await db.execute(select(Blocker).where(Blocker.id == blocker_id))
    blocker = blocker_res.scalars().first()
    if not blocker:
        raise HTTPException(status_code=404, detail="Blocker not found")
        
    system_prompt = (
        "You are KAIROS, a senior technical co-founder and debugger.\n"
        "Your task is to review the description of a task blocker and suggest a concise 3-step action plan to fix it.\n"
        "Keep your output direct, extremely action-oriented, and formatted in clean markdown. Max 100 tokens."
    )
    prompt = f"Blocker Description: {blocker.description}\nSeverity: {blocker.severity}\nProvide a 3-step technical solution."
    
    from backend.app.agents.coach import router as router_instance
    ans = ""
    async for chunk in router_instance.stream_complete(system_prompt, prompt, "chat"):
        if chunk.startswith("data:"):
            try:
                val = json.loads(chunk[5:].strip())
                if val.get("type") == "text_delta":
                    ans += val.get("content", "")
            except:
                pass
                
    return {"suggestion": ans or "Check connection states and configurations."}
