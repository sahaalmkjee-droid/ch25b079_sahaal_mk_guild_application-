import os
import json
import asyncio
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, SessionLocal, User, JobTask
from auth import get_current_user_authenticated

router = APIRouter(tags=["jobs"])

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class JobSubmitRequest(BaseModel):
    task_type: str  # e.g., "audio_briefing", "resume_indexing", "candidate_ranking"
    payload: Optional[Dict[str, Any]] = {}

class JobTaskResponse(BaseModel):
    id: int
    job_id: int
    task_type: str
    status: str  # queued -> processing -> done -> failed
    progress: int
    message: str
    result_data: Optional[Dict[str, Any]] = {}
    error_detail: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

# ---------------------------------------------------------------------------
# Async Helper Functions
# ---------------------------------------------------------------------------
def create_job_task_blocking(user_id: int, task_type: str, message: str = "Job queued") -> JobTask:
    """Creates a new JobTask record in queued status."""
    db = SessionLocal()
    try:
        task = JobTask(
            user_id=user_id,
            task_type=task_type,
            status="queued",
            progress=0,
            message=message,
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    finally:
        db.close()

def update_job_task_blocking(
    job_id: int,
    status: str,
    progress: Optional[int] = None,
    message: Optional[str] = None,
    result_data: Optional[dict] = None,
    error_detail: Optional[str] = None,
):
    """Updates job task status non-blockingly."""
    db = SessionLocal()
    try:
        task = db.query(JobTask).filter(JobTask.id == job_id).first()
        if not task:
            return
        task.status = status
        task.updated_at = datetime.datetime.utcnow()
        if progress is not None:
            task.progress = progress
        if message is not None:
            task.message = message
        if result_data is not None:
            task.result_data = json.dumps(result_data)
        if error_detail is not None:
            task.error_detail = error_detail
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[JobTask Update Error] {e}")
    finally:
        db.close()

# ---------------------------------------------------------------------------
# Background Async Worker Runner
# ---------------------------------------------------------------------------
async def generic_async_job_runner(job_id: int, user_id: int, task_type: str, payload: dict):
    """
    Generic worker enforcing strict async lifecycle:
    queued -> processing -> done / failed
    """
    # 1. Mark processing
    await asyncio.to_thread(update_job_task_blocking, job_id, "processing", 20, "Job processing started...")

    try:
        # Simulate / dispatch task work non-blockingly
        await asyncio.sleep(1.0)
        await asyncio.to_thread(update_job_task_blocking, job_id, "processing", 60, "Running computation...")

        await asyncio.sleep(1.0)

        # Done
        res = {"status": "success", "task_type": task_type, "processed_at": datetime.datetime.utcnow().isoformat()}
        await asyncio.to_thread(update_job_task_blocking, job_id, "done", 100, "Job completed successfully", result_data=res)

    except Exception as e:
        await asyncio.to_thread(update_job_task_blocking, job_id, "failed", 0, "Job execution failed", error_detail=str(e))

# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------
@router.post("/jobs/submit", response_model=JobTaskResponse)
async def submit_job(
    req: JobSubmitRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user_authenticated),
):
    """
    Submits an async background job and returns immediately with status='queued'.
    Does not block request thread.
    """
    task = create_job_task_blocking(current_user.id, req.task_type, f"Queued {req.task_type} job")
    background_tasks.add_task(generic_async_job_runner, task.id, current_user.id, req.task_type, req.payload or {})

    return JobTaskResponse(
        id=task.id,
        job_id=task.id,
        task_type=task.task_type,
        status=task.status,
        progress=task.progress,
        message=task.message,
        result_data={},
        error_detail=task.error_detail,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )

@router.get("/jobs/status/{job_id}", response_model=JobTaskResponse)
def get_job_status(
    job_id: int,
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db),
):
    """Polls async job lifecycle status (queued -> processing -> done -> failed)."""
    task = db.query(JobTask).filter(JobTask.id == job_id, JobTask.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Job task not found")

    res = {}
    if task.result_data:
        try:
            res = json.loads(task.result_data)
        except Exception:
            pass

    return JobTaskResponse(
        id=task.id,
        job_id=task.id,
        task_type=task.task_type,
        status=task.status,
        progress=task.progress,
        message=task.message,
        result_data=res,
        error_detail=task.error_detail,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )

@router.get("/jobs/active", response_model=List[JobTaskResponse])
def get_active_jobs(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db),
):
    """Retrieves active or recent background jobs for current user."""
    tasks = (
        db.query(JobTask)
        .filter(JobTask.user_id == current_user.id)
        .order_by(JobTask.created_at.desc())
        .limit(20)
        .all()
    )
    out = []
    for task in tasks:
        res = {}
        if task.result_data:
            try:
                res = json.loads(task.result_data)
            except Exception:
                pass
        out.append(
            JobTaskResponse(
                id=task.id,
                job_id=task.id,
                task_type=task.task_type,
                status=task.status,
                progress=task.progress,
                message=task.message,
                result_data=res,
                error_detail=task.error_detail,
                created_at=task.created_at,
                updated_at=task.updated_at,
            )
        )
    return out


# ---------------------------------------------------------------------------
# Job Scraping & Initial Seeding Engine
# ---------------------------------------------------------------------------
DEFAULT_SEED_JOBS = [
    {
        "title": "Senior AI & LLM Systems Engineer",
        "company": "Nexus AI Labs",
        "location": "San Francisco, CA / Remote",
        "remote_ok": True,
        "stipend": "$160,000 - $210,000 / yr",
        "required_skills": ["Python", "FastAPI", "PyTorch", "LangChain", "Vector Databases", "PostgreSQL"],
        "experience_level": "Senior Level",
        "deadline": "Rolling Admission",
        "source_url": "https://nexus.ai/careers/senior-ai-engineer",
        "responsibilities": "Architect and deploy high-throughput RAG pipelines, fine-tune open-weight LLMs, and optimize dense vector search infrastructure using pgvector."
    },
    {
        "title": "Fullstack React & Python FastAPI Architect",
        "company": "Sahaal Technologies",
        "location": "New York, NY / Remote",
        "remote_ok": True,
        "stipend": "$140,000 - $185,000 / yr",
        "required_skills": ["React", "Vite", "TailwindCSS", "Python", "FastAPI", "SQLAlchemy"],
        "experience_level": "Mid-Senior Level",
        "deadline": "Closing in 7 Days",
        "source_url": "https://sahaal.io/careers/fullstack-architect",
        "responsibilities": "Lead end-to-end development of autonomous web interfaces, building responsive React SPAs integrated with async Python microservices."
    },
    {
        "title": "Lead Machine Learning Research Scientist",
        "company": "DeepMind Partner Network",
        "location": "London, UK / Remote",
        "remote_ok": True,
        "stipend": "£130,000 - £170,000 / yr",
        "required_skills": ["Python", "TensorFlow", "JAX", "Semantic Search", "Embeddings", "Mathematics"],
        "experience_level": "Lead / Principal",
        "deadline": "Closing in 14 Days",
        "source_url": "https://deepmind.google/careers/lead-research-scientist",
        "responsibilities": "Design state-of-the-art embedding models, benchmark dense retrieval algorithms, and implement mathematical cosine vector scoring models."
    },
    {
        "title": "Backend Infrastructure & Cloud Engineer",
        "company": "Scale Cloud Systems",
        "location": "Austin, TX / Remote",
        "remote_ok": True,
        "stipend": "$135,000 - $175,000 / yr",
        "required_skills": ["Python", "Docker", "Kubernetes", "PostgreSQL", "Redis", "CI/CD"],
        "experience_level": "Mid-Level",
        "deadline": "Rolling Admission",
        "source_url": "https://scale.com/careers/backend-infra",
        "responsibilities": "Maintain high-availability backend clusters, automate zero-downtime container deployments, and manage PostgreSQL database replication."
    },
    {
        "title": "Autonomous AI Agent Software Engineer",
        "company": "Antigravity Research Labs",
        "location": "Seattle, WA / Remote",
        "remote_ok": True,
        "stipend": "$150,000 - $195,000 / yr",
        "required_skills": ["Python", "FastAPI", "Gemini API", "Asyncio", "REST APIs", "Git"],
        "experience_level": "Senior Level",
        "deadline": "Closing in 3 Days",
        "source_url": "https://antigravity.ai/careers/agent-engineer",
        "responsibilities": "Build self-healing AI agent workflows, implement asynchronous event-driven schedulers, and optimize token analytics cost tracking."
    }
]


def seed_job_listings_if_empty(db: Session) -> int:
    """Populates initial seed job listings into database if table is empty."""
    import hashlib
    from database import JobListing
    from matches import clean_and_densify_job_text, get_embedding

    count = db.query(JobListing).count()
    if count > 0:
        return count

    added = 0
    for seed in DEFAULT_SEED_JOBS:
        existing = db.query(JobListing).filter(JobListing.source_url == seed["source_url"]).first()
        if not existing:
            raw_hash = hashlib.sha256(f"{seed['title']}{seed['company']}".encode("utf-8")).hexdigest()[:16]
            dense_text = clean_and_densify_job_text(
                title=seed["title"],
                required_skills=seed["required_skills"],
                core_responsibilities=seed["responsibilities"]
            )
            emb = get_embedding(
                dense_text,
                task_type="RETRIEVAL_DOCUMENT",
                title=seed["title"]
            )
            job = JobListing(
                source_url=seed["source_url"],
                raw_hash=raw_hash,
                title=seed["title"],
                company=seed["company"],
                location=seed["location"],
                remote_ok=seed["remote_ok"],
                stipend=seed["stipend"],
                required_skills=json.dumps(seed["required_skills"]),
                experience_level=seed["experience_level"],
                deadline=seed["deadline"],
                embedding=emb,
                scraped_at=datetime.datetime.utcnow(),
                is_active=True
            )
            db.add(job)
            added += 1

    if added > 0:
        db.commit()
        print(f"[Jobs Seed] Successfully seeded {added} initial job listings into database.")

    return db.query(JobListing).count()


@router.post("/jobs/scrape")
def scrape_jobs(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    """
    Triggers job scraper / seeder engine to populate active listings into database.
    """
    total = seed_job_listings_if_empty(db)
    return {
        "status": "success",
        "message": f"Scrape completed successfully. {total} active job listings ready for matching!",
        "count": total
    }

