import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, Table, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship

# Use JSONB for PostgreSQL (Supabase) while falling back to JSON for SQLite tests
JSONType = JSON().with_variant(JSONB, 'postgresql')

Base = declarative_base()

class Profile(Base):
    __tablename__ = "profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    full_name = Column(String, nullable=False)
    primary_role = Column(String, nullable=False)
    experience_level = Column(String, nullable=False)
    tech_stack = Column(JSONType, nullable=False, default=list) # List of skills
    linkedin_url = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    teams_joined = relationship("TeamMember", back_populates="profile", cascade="all, delete-orphan")
    created_sessions = relationship("Session", back_populates="creator")
    assigned_tasks = relationship("Task", back_populates="assignee")

class Team(Base):
    __tablename__ = "teams"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    leader_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    master_json = Column(JSONType, nullable=True, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="team")

class TeamMember(Base):
    __tablename__ = "team_members"
    
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True)

    # Relationships
    team = relationship("Team", back_populates="members")
    profile = relationship("Profile", back_populates="teams_joined")

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    name = Column(String, nullable=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    problem_statement = Column(String, nullable=True)
    user_idea = Column(String, nullable=True)
    milestones = Column(JSONType, nullable=True, default=list) # Array of milestones
    pitch_outline = Column(JSONType, nullable=True, default=dict) # Contains demo_flow, pitch_outline, final_pitch
    status = Column(String, default="planning") # planning, execution, completed
    scope_critique = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    creator = relationship("Profile", back_populates="created_sessions")
    team = relationship("Team", back_populates="sessions")
    tasks = relationship("Task", back_populates="session", cascade="all, delete-orphan")
    blockers = relationship("Blocker", back_populates="session", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    deadline = Column(DateTime, nullable=True)
    milestone_id = Column(String, nullable=False) # e.g. "phase_1"
    priority = Column(String, default="medium") # low, medium, high
    dependencies = Column(JSONType, nullable=True, default=list)
    status = Column(String, default="pending") # pending, in_progress, completed, blocked

    # Relationships
    session = relationship("Session", back_populates="tasks")
    assignee = relationship("Profile", back_populates="assigned_tasks")
    blockers = relationship("Blocker", back_populates="task", cascade="all, delete-orphan")

class Blocker(Base):
    __tablename__ = "blockers"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    description = Column(String, nullable=False)
    severity = Column(String, default="medium") # low, medium, high, critical
    status = Column(String, default="open") # open, resolved
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    session = relationship("Session", back_populates="blockers")
    task = relationship("Task", back_populates="blockers")
