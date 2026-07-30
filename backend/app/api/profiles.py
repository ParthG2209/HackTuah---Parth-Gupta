from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import List, Optional
from backend.app.db.connection import get_db
from backend.app.db.models import Profile

router = APIRouter(prefix="/profiles", tags=["Profiles"])

class ProfileSchema(BaseModel):
    id: UUID
    full_name: str
    primary_role: str
    experience_level: str
    tech_stack: List[str]
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None

@router.post("", response_model=ProfileSchema)
async def create_or_update_profile(data: ProfileSchema, db: AsyncSession = Depends(get_db)):
    # Check if profile already exists
    result = await db.execute(select(Profile).where(Profile.id == data.id))
    profile = result.scalars().first()
    
    if profile:
        # Update existing
        profile.full_name = data.full_name
        profile.primary_role = data.primary_role
        profile.experience_level = data.experience_level
        profile.tech_stack = data.tech_stack
        profile.linkedin_url = data.linkedin_url
        profile.github_url = data.github_url
    else:
        # Create new
        profile = Profile(
            id=data.id,
            full_name=data.full_name,
            primary_role=data.primary_role,
            experience_level=data.experience_level,
            tech_stack=data.tech_stack,
            linkedin_url=data.linkedin_url,
            github_url=data.github_url
        )
        db.add(profile)
        
    await db.commit()
    await db.refresh(profile)
    return profile

@router.get("/{profile_id}", response_model=ProfileSchema)
async def get_profile(profile_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile
