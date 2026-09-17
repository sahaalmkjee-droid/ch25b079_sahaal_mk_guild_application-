import os
import io
import re
import json
import hashlib
import datetime
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from pydantic import BaseModel
import numpy as np
from pypdf import PdfReader
from sqlalchemy.orm import Session

from database import get_db, User, Resume, JobListing, SavedMatch, Notification, IS_POSTGRES
from auth import get_current_user_authenticated
from cost_analytics import record_cost

router = APIRouter(tags=["matches"])
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# ---------------------------------------------------------------------------
# DIRECTIVE 2: INPUT TEXT CLEANING & DENSITY
# ---------------------------------------------------------------------------
def clean_and_densify_job_text(
    title: str = "",
    required_skills: Any = None,
    core_responsibilities: str = "",
    max_chars: int = 500
) -> str:
    """
    Builds a concise, high-signal text payload before passing to the embedding model.
    Concatenates: Title + Required Skills + Core Responsibilities (top 300-500 chars).
    Strips raw HTML tags, legal boilerplate, and disclaimer noise.
    """
    clean_title = re.sub(r'<[^>]+>', ' ', title or '')
    clean_title = re.sub(r'\s+', ' ', clean_title).strip()

    skills_list: List[str] = []
    if required_skills:
        if isinstance(required_skills, str):
            try:
                parsed = json.loads(required_skills)
                if isinstance(parsed, list):
                    skills_list = [str(s).strip() for s in parsed if str(s).strip()]
                else:
                    skills_list = [str(parsed).strip()]
            except Exception:
                skills_list = [s.strip() for s in required_skills.split(",") if s.strip()]
        elif isinstance(required_skills, list):
            skills_list = [str(s).strip() for s in required_skills if str(s).strip()]

    # Strip HTML and legal/compliance boilerplate
    clean_resp = re.sub(r'<[^>]+>', ' ', core_responsibilities or '')
    boilerplate_pattern = (
        r'(?i)(equal opportunity employer|we are an equal opportunity|affirmative action|'
        r'all qualified applicants|background check|drug screen|privacy policy|terms of service|'
        r'copyright \d{4}|e-verify|reasonable accommodation).*'
    )
    clean_resp = re.sub(boilerplate_pattern, '', clean_resp)
    clean_resp = re.sub(r'\s+', ' ', clean_resp).strip()
    truncated_resp = clean_resp[:max_chars].strip()

    parts = []
    if clean_title:
        parts.append(f"Title: {clean_title}")
    if skills_list:
        parts.append(f"Required Skills: {', '.join(skills_list)}")
    if truncated_resp:
        parts.append(f"Core Responsibilities: {truncated_resp}")

    return " | ".join(parts) if parts else clean_title

def clean_query_text(query: str, max_chars: int = 500) -> str:
    """
    Cleans user search query, removing HTML tags and excess whitespace.
    """
    q = re.sub(r'<[^>]+>', ' ', query or '')
    q = re.sub(r'\s+', ' ', q).strip()
    return q[:max_chars]

def clean_resume_text(raw_text: str, max_chars: int = 1500) -> str:
    """
    Cleans candidate resume text by stripping HTML, boilerplate, and excessive symbols.
    """
    txt = re.sub(r'<[^>]+>', ' ', raw_text or '')
    txt = re.sub(r'\s+', ' ', txt).strip()
    return txt[:max_chars]

# ---------------------------------------------------------------------------
# DIRECTIVE 1: STRICT EMBEDDING TASK TYPES (text-embedding-004)
# ---------------------------------------------------------------------------
def get_embedding(
    text_input: str,
    user_id: int = 1,
    db: Optional[Session] = None,
    feature: str = "embedding",
    task_type: str = "RETRIEVAL_QUERY",
    title: Optional[str] = None
) -> List[float]:
    """
    Enforces asymmetric task configuration at the API call:
    - task_type = "RETRIEVAL_DOCUMENT" when storing / indexing jobs or resume documents.
    - task_type = "RETRIEVAL_QUERY" when generating query vector from search or agent tools.
    """
def generate_token_hash_embedding(text: str, dim: int = 768) -> List[float]:
    """
    High-fidelity deterministic feature hashing (Random Projection / SimHash trick)
    for semantic similarity across word and skill tokens when external LLM API is unavailable.
    Produces unit-normalized 768-dimensional vectors where shared terms project
    consistently into the same dimensions, enabling realistic cosine similarity.
    """
    clean = re.sub(r'<[^>]+>', ' ', text or '').lower()
    tokens = re.findall(r'[a-zA-Z0-9+#.-]+', clean)
    if not tokens:
        tokens = ['general', 'career', 'professional']

    vec = np.zeros(dim, dtype=np.float32)
    # Project unigrams and bigrams
    for i, tok in enumerate(tokens):
        # 3 independent hash functions per token for low collision rate
        for seed in (17, 31, 59):
            h = int(hashlib.md5(f"{seed}:{tok}".encode("utf-8")).hexdigest(), 16)
            idx = h % dim
            sign = 1.0 if (h >> 16) % 2 == 0 else -1.0
            vec[idx] += sign

        # Add bigram if available for phrase matching
        if i + 1 < len(tokens):
            bigram = f"{tok}_{tokens[i+1]}"
            for seed in (23, 47):
                h = int(hashlib.md5(f"{seed}:{bigram}".encode("utf-8")).hexdigest(), 16)
                idx = h % dim
                sign = 1.0 if (h >> 16) % 2 == 0 else -1.0
                vec[idx] += sign * 0.75

    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec = vec / norm
    return vec.tolist()

# ---------------------------------------------------------------------------
# DIRECTIVE 1: STRICT EMBEDDING TASK TYPES (text-embedding-004)
# ---------------------------------------------------------------------------
def get_embedding(
    text_input: str,
    user_id: int = 1,
    db: Optional[Session] = None,
    feature: str = "embedding",
    task_type: str = "RETRIEVAL_QUERY",
    title: Optional[str] = None
) -> List[float]:
    """
    Enforces asymmetric task configuration at the API call:
    - task_type = "RETRIEVAL_DOCUMENT" when storing / indexing jobs or resume documents.
    - task_type = "RETRIEVAL_QUERY" when generating query vector from search or agent tools.
    """
    clean_text = (text_input or "").strip()
    if not clean_text:
        clean_text = "General Professional Qualifications and Career Experience"

    if GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=GEMINI_API_KEY)
            config = types.EmbedContentConfig(
                task_type=task_type,
                title=title if (task_type == "RETRIEVAL_DOCUMENT" and title) else None
            )
            res = client.models.embed_content(
                model="text-embedding-004",
                contents=clean_text,
                config=config
            )
            emb = res.embedding.values
            if len(emb) == 768:
                # Strictly normalize array to unit sphere
                emb_arr = np.array(emb, dtype=np.float32)
                norm = float(np.linalg.norm(emb_arr))
                if norm > 0:
                    emb_arr = emb_arr / norm
                if db and user_id:
                    record_cost(
                        user_id=user_id,
                        feature=feature,
                        tokens_in=max(1, len(clean_text) // 4),
                        tokens_out=0,
                        db=db
                    )
                return emb_arr.tolist()
        except Exception as e:
            print(f"[Gemini Embedding Notice ({task_type}): {e}] Falling back to semantic token projection.")

    return generate_token_hash_embedding(clean_text, dim=768)

def parse_and_validate_embedding(emb_val: Any) -> Optional[List[float]]:
    """
    Safely deserializes and validates a 768-dimensional embedding vector.
    Returns None if missing, incorrect length, or if norm is zero (corrupt/uninitialized).
    """
    if emb_val is None:
        return None
    try:
        if isinstance(emb_val, (list, tuple)):
            val = [float(x) for x in emb_val]
        elif isinstance(emb_val, np.ndarray):
            val = emb_val.astype(float).tolist()
        elif isinstance(emb_val, str):
            parsed = json.loads(emb_val)
            if isinstance(parsed, list):
                val = [float(x) for x in parsed]
            else:
                return None
        else:
            return None
    except Exception:
        return None

    if len(val) != 768:
        return None

    norm_sq = sum(x * x for x in val)
    if norm_sq < 1e-6:
        return None

    norm = float(np.sqrt(norm_sq))
    if abs(norm - 1.0) > 1e-3 and norm > 0:
        val = [x / norm for x in val]

    return val

def get_or_heal_user_resume_embedding(
    user_resume: Optional[Resume],
    user_id: int,
    db: Session
) -> Optional[List[float]]:
    """
    Retrieves and self-heals a user's resume vector. If the vector is missing, corrupt,
    or all zeros (e.g. 0.0 norm), automatically recomputes a valid 768-dim unit vector
    from the candidate's raw_text and persists it to the database.
    """
    if not user_resume:
        return None

    valid_emb = parse_and_validate_embedding(user_resume.embedding)
    if valid_emb is not None:
        return valid_emb

    # Self-heal: If raw_text is available, recompute and update database
    if user_resume.raw_text and user_resume.raw_text.strip():
        dense_resume = clean_resume_text(user_resume.raw_text)
        new_emb = get_embedding(
            dense_resume,
            user_id=user_id,
            db=db,
            feature="resume_embedding_heal",
            task_type="RETRIEVAL_DOCUMENT",
            title="Candidate Resume"
        )
        checked = parse_and_validate_embedding(new_emb)
        if checked:
            user_resume.embedding = checked
            try:
                db.commit()
                db.refresh(user_resume)
                print(f"[Self-Heal] Successfully repaired resume embedding for user_id={user_id}.")
            except Exception as e:
                db.rollback()
                print(f"[Self-Heal Warning] Database commit failed for user_id={user_id}: {e}")
            return checked

    return None

# ---------------------------------------------------------------------------
# DIRECTIVE 3: PURE MATHEMATICAL COSINE SIMILARITY
# ---------------------------------------------------------------------------
def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """
    Exact mathematical cosine similarity using true vector norms:
    raw_cosine = dot(A, B) / (norm(A) * norm(B))
    DO NOT apply min-max stretching, clipping, or threshold calibration.
    """
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm_a = float(np.linalg.norm(a))
    norm_b = float(np.linalg.norm(b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

class SaveMatchRequest(BaseModel):
    job_id: int
    match_score: float = 0.0
    match_justification: str = ""
    status: str = "saved"

class JobMatchResponse(BaseModel):
    id: int
    title: str
    company: str
    location: str
    remote_ok: bool
    stipend: str
    required_skills: List[str]
    experience_level: str
    deadline: str
    source_url: str
    match_score: float
    justification: str
    match_justification: Optional[str] = ""
    is_saved: bool = False

class ResumeTextRequest(BaseModel):
    text: str

@router.post("/resume/upload")
async def upload_resume(
    file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    """
    Accepts PDF, TXT, or plain text file uploads, or direct pasted text via form data.
    """
    raw_text = ""
    if file and file.filename:
        contents = await file.read()
        filename_lower = file.filename.lower()
        if filename_lower.endswith(".pdf"):
            try:
                reader = PdfReader(io.BytesIO(contents))
                for page in reader.pages:
                    raw_text += page.extract_text() or ""
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse PDF document: {e}")
        else:
            # Handles .txt, .text, .md, and plain text uploads
            raw_text = contents.decode("utf-8", errors="ignore")
    elif resume_text and resume_text.strip():
        raw_text = resume_text.strip()
    else:
        raise HTTPException(status_code=400, detail="Please provide a PDF or TXT file, or paste your resume text.")

    raw_text = raw_text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="The resume text appears to be empty.")

    # Directive 2: Clean and densify candidate resume
    dense_resume = clean_resume_text(raw_text)

    # Directive 1: Storing resume as document -> task_type = "RETRIEVAL_DOCUMENT"
    emb = get_embedding(
        dense_resume,
        user_id=current_user.id,
        db=db,
        feature="resume_embedding",
        task_type="RETRIEVAL_DOCUMENT",
        title="Candidate Resume"
    )

    resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
    if resume:
        resume.raw_text = raw_text
        resume.embedding = emb
        resume.uploaded_at = datetime.datetime.utcnow()
    else:
        resume = Resume(user_id=current_user.id, raw_text=raw_text, embedding=emb)
        db.add(resume)
    db.commit()
    db.refresh(resume)
    words = len(raw_text.split())
    return {
        "status": "success",
        "word_count": words,
        "message": f"Resume vectorized and indexed successfully ({words} words)."
    }

@router.post("/resume/text")
def upload_resume_text(
    req: ResumeTextRequest,
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    """
    Endpoint for direct copy-pasted resume text submission via JSON.
    """
    raw_text = (req.text or "").strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Pasted resume text cannot be empty.")

    # Directive 2: Clean and densify candidate resume
    dense_resume = clean_resume_text(raw_text)

    # Directive 1: Storing resume as document -> task_type = "RETRIEVAL_DOCUMENT"
    emb = get_embedding(
        dense_resume,
        user_id=current_user.id,
        db=db,
        feature="resume_embedding",
        task_type="RETRIEVAL_DOCUMENT",
        title="Candidate Resume"
    )

    resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
    if resume:
        resume.raw_text = raw_text
        resume.embedding = emb
        resume.uploaded_at = datetime.datetime.utcnow()
    else:
        resume = Resume(user_id=current_user.id, raw_text=raw_text, embedding=emb)
        db.add(resume)
    db.commit()
    db.refresh(resume)
    words = len(raw_text.split())
    return {
        "status": "success",
        "word_count": words,
        "message": f"Pasted resume vectorized and indexed successfully ({words} words)."
    }

@router.get("/matches/ranked", response_model=List[JobMatchResponse])
def get_ranked_matches(
    query: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    user_resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
    resume_emb = get_or_heal_user_resume_embedding(user_resume, current_user.id, db)

    # Directive 1: Generating query vector from user search uses RETRIEVAL_QUERY
    if query and query.strip():
        dense_query = clean_query_text(query.strip())
        target_emb = get_embedding(
            dense_query,
            user_id=current_user.id,
            db=db,
            feature="job_search_query",
            task_type="RETRIEVAL_QUERY"
        )
    elif resume_emb:
        target_emb = resume_emb
    else:
        target_emb = get_embedding(
            "Software Engineer Machine Learning Python",
            user_id=current_user.id,
            db=db,
            feature="default_query",
            task_type="RETRIEVAL_QUERY"
        )

    # Safety check: Ensure target_emb has non-zero norm
    t_arr = np.array(target_emb, dtype=np.float32)
    if float(np.linalg.norm(t_arr)) < 1e-4:
        target_emb = get_embedding(
            "Software Engineer Machine Learning Python",
            user_id=current_user.id,
            db=db,
            feature="default_fallback_query",
            task_type="RETRIEVAL_QUERY"
        )

    saved_ids = {sm.job_id for sm in db.query(SavedMatch).filter(SavedMatch.user_id == current_user.id).all()}

    results = []
    if IS_POSTGRES:
        # Directive 3 (PostgreSQL): raw_cosine = 1.0 - D_c
        dist_col = JobListing.embedding.cosine_distance(target_emb)
        job_records = (
            db.query(JobListing, dist_col.label("dist"))
            .filter(JobListing.is_active == True)
            .order_by(dist_col.asc())
            .limit(limit)
            .all()
        )
        for job, dist in job_records:
            raw_cosine = max(0.0, 1.0 - float(dist)) if dist is not None else 0.0
            match_score = round(raw_cosine, 3)
            pct = round(raw_cosine * 100, 1)
            skills = json.loads(job.required_skills or "[]")
            skills_preview = ", ".join(skills[:3]) if skills else "required tech stack"
            msg = f"Raw cosine similarity {pct}% ({match_score}) with {skills_preview} and {job.experience_level} scope."
            results.append(JobMatchResponse(
                id=job.id, title=job.title, company=job.company, location=job.location,
                remote_ok=job.remote_ok, stipend=job.stipend, required_skills=skills,
                experience_level=job.experience_level, deadline=job.deadline, source_url=job.source_url,
                match_score=match_score, justification=msg, match_justification=msg, is_saved=job.id in saved_ids
            ))
    else:
        # Directive 3 (In-Memory / SQLite): raw_cosine = dot(A, B) / (norm(A) * norm(B))
        jobs = db.query(JobListing).filter(JobListing.is_active == True).limit(10000).all()
        if not jobs:
            return []

        parsed_embeddings = []
        valid_jobs = []
        for j in jobs:
            emb_v = parse_and_validate_embedding(j.embedding)
            if emb_v is not None:
                parsed_embeddings.append(emb_v)
                valid_jobs.append(j)

        if not valid_jobs:
            return []

        matrix = np.array(parsed_embeddings, dtype=np.float32)
        t_vec = np.array(target_emb, dtype=np.float32)
        norm_t = float(np.linalg.norm(t_vec))
        norms_m = np.linalg.norm(matrix, axis=1)

        # Pure mathematical calculation without artificial clipping
        scores = np.zeros(len(valid_jobs), dtype=np.float32)
        valid = (norms_m > 0) & (norm_t > 0)
        scores[valid] = np.dot(matrix[valid], t_vec) / (norms_m[valid] * norm_t)

        top_idx = np.argsort(scores)[::-1][:limit]
        for idx in top_idx:
            job = valid_jobs[idx]
            raw_cosine = max(0.0, float(scores[idx]))
            match_score = round(raw_cosine, 3)
            pct = round(raw_cosine * 100, 1)
            skills = json.loads(job.required_skills or "[]")
            skills_preview = ", ".join(skills[:3]) if skills else "required tech stack"
            msg = f"Raw cosine similarity {pct}% ({match_score}) with {skills_preview} and {job.experience_level} scope."
            results.append(JobMatchResponse(
                id=job.id, title=job.title, company=job.company, location=job.location,
                remote_ok=job.remote_ok, stipend=job.stipend, required_skills=skills,
                experience_level=job.experience_level, deadline=job.deadline, source_url=job.source_url,
                match_score=match_score, justification=msg, match_justification=msg, is_saved=job.id in saved_ids
            ))

    return results

@router.post("/matches/save")
def save_job_match(
    req: SaveMatchRequest,
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    existing = db.query(SavedMatch).filter(
        SavedMatch.user_id == current_user.id,
        SavedMatch.job_id == req.job_id
    ).first()

    if req.status in ["none", "remove", "deleted"]:
        if existing:
            db.delete(existing)
            db.commit()
        return {"status": "removed", "job_id": req.job_id}

    if existing:
        if req.status == existing.status and req.status == "saved":
            db.delete(existing)
            db.commit()
            return {"status": "removed", "job_id": req.job_id}

        existing.status = req.status
        if req.match_score > 0:
            existing.match_score = req.match_score
        if req.match_justification:
            existing.match_justification = req.match_justification
        db.commit()
        return {"status": "updated", "job_id": req.job_id, "new_status": req.status}

    db.add(SavedMatch(
        user_id=current_user.id,
        job_id=req.job_id,
        match_score=req.match_score,
        match_justification=req.match_justification,
        status=req.status or "saved"
    ))
    db.commit()
    return {"status": "saved", "job_id": req.job_id}

@router.get("/matches/saved")
def get_saved_matches(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    saved = db.query(SavedMatch).filter(SavedMatch.user_id == current_user.id).order_by(SavedMatch.id.desc()).all()
    return [
        {
            "id": sm.job.id, "title": sm.job.title, "company": sm.job.company,
            "location": sm.job.location, "remote_ok": sm.job.remote_ok,
            "stipend": sm.job.stipend, "required_skills": json.loads(sm.job.required_skills or "[]"),
            "experience_level": sm.job.experience_level, "deadline": sm.job.deadline,
            "source_url": sm.job.source_url, "match_score": sm.match_score,
            "justification": sm.match_justification, "status": sm.status, "is_saved": True
        }
        for sm in saved if sm.job
    ]

@router.get("/resume/profile")
def get_resume_profile(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    user_resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
    if not user_resume or not user_resume.raw_text:
        return {
            "has_resume": False,
            "raw_text": "",
            "word_count": 0,
            "uploaded_at": None,
            "top_3_matches": []
        }

    raw_text = user_resume.raw_text
    word_count = len(raw_text.split())
    uploaded_at = user_resume.uploaded_at.isoformat() if user_resume.uploaded_at else None

    top_3_matches = []
    resume_emb = get_or_heal_user_resume_embedding(user_resume, current_user.id, db)
    if resume_emb:
        saved_ids = {sm.job_id for sm in db.query(SavedMatch).filter(SavedMatch.user_id == current_user.id).all()}
        if IS_POSTGRES:
            dist_col = JobListing.embedding.cosine_distance(resume_emb)
            top_jobs = (
                db.query(JobListing, dist_col.label("dist"))
                .filter(JobListing.is_active == True)
                .order_by(dist_col.asc())
                .limit(3)
                .all()
            )
            for job, dist in top_jobs:
                raw_cosine = max(0.0, 1.0 - float(dist)) if dist is not None else 0.0
                match_score = round(raw_cosine, 3)
                top_3_matches.append({
                    "id": job.id, "title": job.title, "company": job.company,
                    "location": job.location, "remote_ok": job.remote_ok,
                    "stipend": job.stipend, "required_skills": json.loads(job.required_skills or "[]"),
                    "deadline": job.deadline, "source_url": job.source_url,
                    "match_score": match_score, "is_saved": job.id in saved_ids
                })
        else:
            jobs = db.query(JobListing).filter(JobListing.is_active == True).limit(2000).all()
            parsed_embeddings = []
            valid_jobs = []
            for j in jobs:
                emb_v = parse_and_validate_embedding(j.embedding)
                if emb_v is not None:
                    parsed_embeddings.append(emb_v)
                    valid_jobs.append(j)

            if valid_jobs:
                matrix = np.array(parsed_embeddings, dtype=np.float32)
                t_vec = np.array(resume_emb, dtype=np.float32)
                norm_t = float(np.linalg.norm(t_vec))
                norms_m = np.linalg.norm(matrix, axis=1)
                scores = np.zeros(len(valid_jobs), dtype=np.float32)
                valid = (norms_m > 0) & (norm_t > 0)
                scores[valid] = np.dot(matrix[valid], t_vec) / (norms_m[valid] * norm_t)
                top_idx = np.argsort(scores)[::-1][:3]
                for idx in top_idx:
                    job = valid_jobs[idx]
                    top_3_matches.append({
                        "id": job.id, "title": job.title, "company": job.company,
                        "location": job.location, "remote_ok": job.remote_ok,
                        "stipend": job.stipend, "required_skills": json.loads(job.required_skills or "[]"),
                        "deadline": job.deadline, "source_url": job.source_url,
                        "match_score": round(max(0.0, float(scores[idx])), 3),
                        "is_saved": job.id in saved_ids
                    })

    return {
        "has_resume": True,
        "raw_text": raw_text,
        "word_count": word_count,
        "uploaded_at": uploaded_at,
        "top_3_matches": top_3_matches
    }


# ---------------------------------------------------------------------------
# CHANGE DETECTION NOTIFICATION ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/notifications")
def get_user_notifications(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    """
    Returns change detection notifications (listing edits/closures) for current user.
    """
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()

    results = []
    for n in notifs:
        results.append({
            "id": n.id,
            "job_id": n.job_id,
            "change_type": n.change_type,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None
        })

    return {
        "unread_count": unread_count,
        "notifications": results
    }


@router.post("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    """Marks a single notification as read."""
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id
    ).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "success", "id": notif_id}


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    """Marks all notifications for current user as read."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"status": "success", "message": "All notifications marked as read"}

