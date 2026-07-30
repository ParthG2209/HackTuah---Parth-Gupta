import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Use SQLite async fallback for local testing if no Postgres DB URL is defined
    DATABASE_URL = "sqlite+aiosqlite:///./kairos.db"
else:
    # Convert postgresql or postgres protocol to asyncpg
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    # Disable statement caching for pgBouncer / transaction poolers compatibility
    connect_args={"statement_cache_size": 0} if "sqlite" not in DATABASE_URL else {},
    # Conservative pool sizing for Supabase transaction pooler on Render free tier
    **({"pool_size": 5, "max_overflow": 3, "pool_pre_ping": True, "pool_recycle": 300} if "sqlite" not in DATABASE_URL else {})
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def init_db():
    from backend.app.db.models import Base
    from sqlalchemy import text
    async with engine.begin() as conn:
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
        
        migrations = [
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scope_critique TEXT;",
            "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR;",
            "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_url VARCHAR;"
        ]
        for statement in migrations:
            try:
                await conn.execute(text(statement))
            except Exception:
                pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
