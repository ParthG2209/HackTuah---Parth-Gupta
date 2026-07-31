import asyncio
import uuid
from backend.app.db.connection import engine
from backend.app.db.models import Profile, Session as DbSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession

async def fix():
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as db:
        user_id = uuid.UUID("5e114832-30a6-49dc-a426-72e92a2ee4df")
        prof = Profile(
            id=user_id,
            full_name="Yash Goyal",
            primary_role="Developer",
            experience_level="Intermediate",
            tech_stack=["React", "Python"]
        )
        db.add(prof)
        await db.commit()
        print("Profile restored!")

if __name__ == "__main__":
    asyncio.run(fix())
