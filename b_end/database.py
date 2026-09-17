import os
import datetime
from sqlalchemy import create_engine, text, Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from pgvector.sqlalchemy import Vector

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(BASE_DIR, ".env")

if os.path.exists(ENV_FILE):
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or os.environ.get("PGURL") or ""
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

Base = declarative_base()

IS_POSTGRES = False
if DATABASE_URL:
    try:
        test_engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 10})
        with test_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine = test_engine
        IS_POSTGRES = True
        print(f"[Database] Connected to PostgreSQL successfully.")
    except Exception as e:
        print(f"[Database] PostgreSQL connection failed ({e}). Fallback to SQLite.")
        IS_POSTGRES = False

if not IS_POSTGRES:
    fallback_path = os.path.join(BASE_DIR, "nexus_auth.db")
    engine = create_engine(f"sqlite:///{fallback_path}", connect_args={"check_same_thread": False})
    print(f"[Database] Using SQLite fallback: {fallback_path}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------------------------------------------------------
# SQLAlchemy Models
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    saved_matches = relationship("SavedMatch", back_populates="user", cascade="all, delete-orphan")
    briefings = relationship("Briefing", back_populates="user", cascade="all, delete-orphan")
    cost_logs = relationship("CostLog", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class JobListing(Base):
    __tablename__ = "job_listings"

    id = Column(Integer, primary_key=True, index=True)
    source_url = Column(String(512), unique=True, index=True, nullable=False)
    raw_hash = Column(String(64), nullable=False)
    title = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    location = Column(String(255), default="Remote")
    remote_ok = Column(Boolean, default=True)
    stipend = Column(String(100), default="Competitive")
    required_skills = Column(Text, default="[]")
    experience_level = Column(String(50), default="Mid-Level")
    deadline = Column(String(50), default="Ongoing")
    embedding = Column(Vector(768), nullable=True)
    scraped_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    has_changed = Column(Boolean, default=False)

    saved_matches = relationship("SavedMatch", back_populates="job", cascade="all, delete-orphan")


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    raw_text = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="resumes")


class SavedMatch(Base):
    __tablename__ = "saved_matches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_listings.id"), nullable=False, index=True)
    match_score = Column(Float, default=0.0)
    match_justification = Column(Text, default="")
    status = Column(String(50), default="saved")

    user = relationship("User", back_populates="saved_matches")
    job = relationship("JobListing", back_populates="saved_matches")


class Briefing(Base):
    __tablename__ = "briefings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    script = Column(Text, default="")
    media_url = Column(String(512), default="")
    video_url = Column(String(512), default="", nullable=True)
    audio_url = Column(String(512), default="", nullable=True)
    fallback_reason = Column(String(255), default="", nullable=True)
    featured_jobs = Column(Text, default="[]", nullable=True)
    status = Column(String(50), default="queued")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="briefings")


class JobTask(Base):
    __tablename__ = "job_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    task_type = Column(String(100), nullable=False, index=True)
    status = Column(String(50), default="queued", index=True)  # queued -> processing -> done / failed
    progress = Column(Integer, default=0)
    message = Column(String(255), default="Job queued")
    result_data = Column(Text, default="{}", nullable=True)
    error_detail = Column(Text, default="", nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User")


class CostLog(Base):
    __tablename__ = "cost_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    feature = Column(String(100), nullable=False)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    cost_inr = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="cost_logs")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # "user" or "model"
    content = Column(Text, nullable=False)
    tool_calls = Column(Text, default="[]", nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="chat_messages")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_listings.id"), nullable=True, index=True)
    change_type = Column(String(50), nullable=False)  # "EDITED" | "CLOSED" | "SYSTEM"
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="notifications")
    job = relationship("JobListing")

# ---------------------------------------------------------------------------
# Database Initialization
# ---------------------------------------------------------------------------
def init_db():
    if IS_POSTGRES:
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
            print("[Database] pgvector extension verified.")
        except Exception as e:
            print(f"[Database] pgvector extension check: {e}")

    try:
        Base.metadata.create_all(bind=engine)
        if IS_POSTGRES:
            with engine.connect() as conn:
                conn.execute(text("CREATE INDEX IF NOT EXISTS job_listings_embedding_hnsw_idx ON job_listings USING hnsw (embedding vector_cosine_ops);"))
                conn.commit()
            print("[Database] PostgreSQL tables and HNSW index ready.")
    except Exception as e:
        print(f"[Database] Table creation notice: {e}")

# ---------------------------------------------------------------------------
# Asymmetric Document Embedding Helper (Directive 1 & 2)
# ---------------------------------------------------------------------------
def embed_job_document(title: str, required_skills: any = None, core_responsibilities: str = "") -> list:
    """
    Directive 1 & 2: Asymmetric document embedding for indexing jobs into database.
    Enforces task_type='RETRIEVAL_DOCUMENT' on text-embedding-004 with clean dense text.
    """
    from matches import get_embedding, clean_and_densify_job_text
    dense_payload = clean_and_densify_job_text(title, required_skills, core_responsibilities)
    return get_embedding(
        text_input=dense_payload,
        task_type="RETRIEVAL_DOCUMENT",
        title=title
    )

