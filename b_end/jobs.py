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
