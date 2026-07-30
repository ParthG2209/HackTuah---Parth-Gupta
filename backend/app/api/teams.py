import uuid
import random
import string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List, Optional
from backend.app.db.connection import get_db
from backend.app.db.models import Team, TeamMember, Profile

router = APIRouter(prefix="/teams", tags=["Teams"])

class TeamCreateSchema(BaseModel):
    name: str
    leader_id: uuid.UUID

class TeamJoinSchema(BaseModel):
    code: str
    profile_id: uuid.UUID

class MemberProfileSchema(BaseModel):
    id: uuid.UUID
    full_name: str
    primary_role: str
    experience_level: str
    tech_stack: List[str]

class TeamResponseSchema(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    leader_id: uuid.UUID
    master_json: Optional[dict] = None
    members: List[MemberProfileSchema] = []

def generate_team_code():
    chars = string.ascii_uppercase + string.digits
    return "KAI-" + "".join(random.choices(chars, k=4))

@router.post("", response_model=TeamResponseSchema)
async def create_team(data: TeamCreateSchema, db: AsyncSession = Depends(get_db)):
    # Generate unique code
    code = generate_team_code()
    
    team_id = uuid.uuid4()
    new_team = Team(
        id=team_id,
        name=data.name,
        code=code,
        leader_id=data.leader_id,
        master_json={}
    )
    db.add(new_team)
    
    # Leader is automatically a member
    membership = TeamMember(
        team_id=team_id,
        profile_id=data.leader_id
    )
    db.add(membership)
    
    await db.commit()
    
    # Fetch team with member details to compile initial master JSON
    return await sync_team_master_json(team_id, db)

@router.post("/join", response_model=TeamResponseSchema)
async def join_team(data: TeamJoinSchema, db: AsyncSession = Depends(get_db)):
    # Find team
    result = await db.execute(select(Team).where(Team.code == data.code.upper()))
    team = result.scalars().first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid team code")
        
    # Check if already a member
    mem_result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.profile_id == data.profile_id)
    )
    existing = mem_result.scalars().first()
    if existing:
        return await sync_team_master_json(team.id, db)
        
    # Add member
    membership = TeamMember(
        team_id=team.id,
        profile_id=data.profile_id
    )
    db.add(membership)
    await db.commit()
    
    # Sync team master JSON
    return await sync_team_master_json(team.id, db)

@router.post("/{team_id}/sync", response_model=TeamResponseSchema)
async def sync_team_master_json(team_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    # Fetch team details
    result = await db.execute(
        select(Team)
        .where(Team.id == team_id)
        .options(selectinload(Team.members).selectinload(TeamMember.profile))
    )
    team = result.scalars().first()
    if not team:
        raise HTTPException(status_code=status.HTTP_440_NOT_FOUND, detail="Team not found")
        
    # Compile Master JSON
    members_data = []
    member_profiles = []
    
    for m in team.members:
        prof = m.profile
        member_profiles.append(MemberProfileSchema(
            id=prof.id,
            full_name=prof.full_name,
            primary_role=prof.primary_role,
            experience_level=prof.experience_level,
            tech_stack=prof.tech_stack
        ))
        
        members_data.append({
            "name": prof.full_name,
            "role": prof.primary_role,
            "level": prof.experience_level,
            "skills": prof.tech_stack
        })
        
    master = {
        "team_name": team.name,
        "team_code": team.code,
        "member_count": len(members_data),
        "members": members_data
    }
    
    team.master_json = master
    await db.commit()
    await db.refresh(team)
    
    return TeamResponseSchema(
        id=team.id,
        name=team.name,
        code=team.code,
        leader_id=team.leader_id,
        master_json=team.master_json,
        members=member_profiles
    )

@router.get("/{team_id}", response_model=TeamResponseSchema)
async def get_team(team_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Team)
        .where(Team.id == team_id)
        .options(selectinload(Team.members).selectinload(TeamMember.profile))
    )
    team = result.scalars().first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    member_profiles = []
    for m in team.members:
        prof = m.profile
        member_profiles.append(MemberProfileSchema(
            id=prof.id,
            full_name=prof.full_name,
            primary_role=prof.primary_role,
            experience_level=prof.experience_level,
            tech_stack=prof.tech_stack
        ))
        
    return TeamResponseSchema(
        id=team.id,
        name=team.name,
        code=team.code,
        leader_id=team.leader_id,
        master_json=team.master_json,
        members=member_profiles
    )

@router.get("/user/{profile_id}", response_model=List[TeamResponseSchema])
async def get_user_teams(profile_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.profile_id == profile_id)
        .options(selectinload(TeamMember.team).selectinload(Team.members).selectinload(TeamMember.profile))
    )
    memberships = result.scalars().all()
    
    response = []
    for mem in memberships:
        team = mem.team
        member_profiles = []
        for tm in team.members:
            prof = tm.profile
            member_profiles.append(MemberProfileSchema(
                id=prof.id,
                full_name=prof.full_name,
                primary_role=prof.primary_role,
                experience_level=prof.experience_level,
                tech_stack=prof.tech_stack
            ))
        response.append(TeamResponseSchema(
            id=team.id,
            name=team.name,
            code=team.code,
            leader_id=team.leader_id,
            master_json=team.master_json,
            members=member_profiles
        ))
    return response
