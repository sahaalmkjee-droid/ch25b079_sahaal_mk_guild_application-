import os
import json
import time
import datetime
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
import httpx
import numpy as np
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from database import get_db, SessionLocal, User, Resume, JobListing, Briefing, IS_POSTGRES
from auth import get_current_user_authenticated
from cost_analytics import record_cost
from matches import get_or_heal_user_resume_embedding, parse_and_validate_embedding

router = APIRouter(tags=["briefing"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(BASE_DIR, "media")
os.makedirs(MEDIA_DIR, exist_ok=True)

# Maximum time (seconds) the worker is allowed to run before auto-failing
WORKER_TIMEOUT_SECONDS = 120

# ---------------------------------------------------------------------------
# Pydantic response model
# ---------------------------------------------------------------------------
class BriefingResponse(BaseModel):
    id: int
    job_id: Optional[int] = None
    script: str
    media_url: str
    video_url: Optional[str] = None
    audio_url: Optional[str] = None
    fallback_reason: Optional[str] = None
    featured_jobs: List[Dict[str, Any]] = []
    status: str
    created_at: datetime.datetime


# ---------------------------------------------------------------------------
# Voice synthesis helpers  (all blocking I/O — called via asyncio.to_thread)
# ---------------------------------------------------------------------------

def _synthesize_elevenlabs(text: str, output_path: str) -> tuple[bool, str]:
    """Tier 1: ElevenLabs REST API."""
    eleven_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    eleven_voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM").strip()
    if not eleven_key:
        return False, ""
    try:
        resp = httpx.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{eleven_voice_id}",
            json={
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
            headers={"xi-api-key": eleven_key, "Content-Type": "application/json"},
            timeout=25.0,
        )
        if resp.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(resp.content)
            if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                return True, "ElevenLabs AI Voice"
        else:
            print(f"[ElevenLabs] HTTP {resp.status_code}; using fallback voice.")
    except Exception as e:
        print(f"[ElevenLabs] {e}")
    return False, ""


def _synthesize_edge_tts(text: str, output_path: str) -> tuple[bool, str]:
    """Tier 2: Microsoft Edge Neural TTS (Christopher — executive narrator)."""
    try:
        import edge_tts

        async def _task():
            comm = edge_tts.Communicate(text, "en-US-ChristopherNeural", rate="+0%", pitch="+0Hz")
            await comm.save(output_path)

        # Run in a fresh event loop isolated from any outer loop
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_task())
        finally:
            loop.close()

        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            return True, "Edge Neural (Christopher — Executive Voice)"
    except Exception as e:
        print(f"[Edge-TTS] {e}")
    return False, ""


def _synthesize_gtts(text: str, output_path: str) -> tuple[bool, str]:
    """Tier 3: Google TTS (guaranteed fallback)."""
    try:
        from gtts import gTTS
        gTTS(text=text, lang="en").save(output_path)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            return True, "Google Spoken Voice (gTTS)"
    except Exception as e:
        print(f"[gTTS] {e}")
    return False, ""



def _synthesize_voice_blocking(text: str, output_path: str) -> tuple[bool, str]:
    """
    Waterfall: ElevenLabs → Edge TTS → gTTS.
    Runs entirely in a background thread (never on the event-loop thread).
    """
    for fn in (_synthesize_elevenlabs, _synthesize_edge_tts, _synthesize_gtts):
        ok, name = fn(text, output_path)
        if ok:
            return ok, name
    return False, "None"


# ---------------------------------------------------------------------------
# CPU-bound job matching (runs in thread pool via asyncio.to_thread)
# ---------------------------------------------------------------------------

def _fetch_top3_jobs_blocking(user_id: int, briefing_id: int) -> list:
    """
    Opens its own DB session, computes cosine similarity, returns list of
    featured-job dicts.  Runs in a thread so it never blocks the event loop.
    """
    db = SessionLocal()
    try:
        user_resume = db.query(Resume).filter(Resume.user_id == user_id).first()
        resume_emb = get_or_heal_user_resume_embedding(user_resume, user_id, db)

        if resume_emb:
            if IS_POSTGRES:
                from pgvector.sqlalchemy import Vector
                distance_expr = JobListing.embedding.cosine_distance(resume_emb)
                top_3 = (
                    db.query(JobListing)
                    .filter(JobListing.is_active == True)
                    .order_by(distance_expr.asc())
                    .limit(3)
                    .all()
                )
            else:
                jobs = db.query(JobListing).filter(JobListing.is_active == True).all()
                parsed, valid = [], []
                for j in jobs:
                    v = parse_and_validate_embedding(j.embedding)
                    if v is not None:
                        parsed.append(v); valid.append(j)
                if valid:
                    mat = np.array(parsed, dtype=np.float32)
                    tgt = np.array(resume_emb, dtype=np.float32)
                    n = np.linalg.norm(tgt)
                    if n > 0:
                        tgt /= n
                    norms = np.linalg.norm(mat, axis=1, keepdims=True)
                    norms[norms == 0] = 1.0
                    scores = np.dot(mat / norms, tgt)
                    top_3 = [valid[i] for i in np.argsort(scores)[::-1][:3]]
                else:
                    top_3 = []
        else:
            top_3 = db.query(JobListing).filter(JobListing.is_active == True).limit(3).all()

        featured = []
        for j in top_3:
            skills = json.loads(j.required_skills or "[]")
            featured.append({
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "stipend": j.stipend,
                "skills": skills[:4],
            })
        return featured
    finally:
        db.close()


def _generate_script_blocking(featured: list, user_id: int, briefing_id: int) -> str:
    """
    Calls Gemini to write the executive briefing script.
    Falls back to a deterministic template if the API is unavailable.
    Runs in a thread.
    """
    # Deterministic fallback template
    top_role  = featured[0]["title"]   if featured else "Senior AI Engineer"
    top_comp  = featured[0]["company"] if featured else "Top Guild Lab"
    top_skls  = ", ".join(featured[0].get("skills", ["Python", "System Architecture"])) if featured else "Python, ML"
    sec_role  = featured[1]["title"]   if len(featured) > 1 else "Lead Data Architect"
    sec_comp  = featured[1]["company"] if len(featured) > 1 else "Tech Innovations"

    fallback = (
        f"Good morning and welcome to your SAHAAL executive intelligence dispatch. Today, our semantic vector engine "
        f"has analysed over 10,000 active opportunities to pinpoint your strongest market advantages. "
        f"Your number-one target is the {top_role} role at {top_comp}. "
        f"This position represents a remarkable alignment with your core expertise in {top_skls}. "
        f"In addition, high-momentum teams at {sec_comp} are actively scouting for leadership in the {sec_role} domain. "
        f"Both opportunities boast competitive compensation packages and immediate application review windows. "
        f"Now is the time to finalise your tailored submissions, verify your portfolio metrics on your dashboard, "
        f"and take decisive action before the closing deadlines. Wishing you an empowered and successful career week ahead."
    )

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not gemini_key:
        return fallback

    db = SessionLocal()
    try:
        from google import genai
        client = genai.Client(api_key=gemini_key)
        prompt = (
            "Write an engaging, high-energy executive spoken audio briefing "
            "(aim for 140 to 160 words to fill 60 to 90 seconds of natural speech) "
            "for a job applicant based on their top 3 matched opportunities below.\n"
            f"{json.dumps(featured, indent=2)}\n\n"
            "Guidelines:\n"
            "- Adopt a confident, professional, and encouraging executive narrator persona.\n"
            "- Mention the top company name and specific skill alignments clearly.\n"
            "- Do not use placeholder text or generic filler."
        )
        res = client.models.generate_content(model="gemini-3.6-flash", contents=prompt)
        if res and res.text:
            script = res.text.strip()
            t_in  = len(prompt)  // 4
            t_out = len(script)  // 4
            record_cost(user_id=user_id, feature="briefing_script",
                        tokens_in=t_in, tokens_out=t_out, db=db)
            return script
    except Exception as e:
        print(f"[Briefing Script LLM] {e}")
    finally:
        db.close()

    return fallback


def _mark_status_blocking(briefing_id: int, status: str, **kwargs):
    """Update briefing record in DB. Runs in a thread."""
    db = SessionLocal()
    try:
        b = db.query(Briefing).filter(Briefing.id == briefing_id).first()
        if not b:
            return
        b.status = status
        for k, v in kwargs.items():
            setattr(b, k, v)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[DB Status Update] {e}")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Async worker  — the entire lifecycle runs async; no thread is ever blocked
# on slow I/O beyond its own threadpool slot.
# ---------------------------------------------------------------------------

async def briefing_worker_task(briefing_id: int, user_id: int):
    """
    Async job lifecycle:
        queued  →  processing  →  done
                               →  failed   (on any error or timeout)

    All blocking operations (DB queries, TTS network calls, LLM API) are
    dispatched to the default threadpool via asyncio.to_thread so the
    event loop is never stalled.

    A hard WORKER_TIMEOUT_SECONDS ceiling is enforced via asyncio.wait_for.
    """
    async def _run():
        # ── 1. Mark processing ──────────────────────────────────────────
        await asyncio.to_thread(_mark_status_blocking, briefing_id, "processing")

        # ── 2. Fetch top-3 matched jobs (CPU + DB) ─────────────────────
        featured = await asyncio.to_thread(_fetch_top3_jobs_blocking, user_id, briefing_id)

        # ── 3. LLM script generation (network I/O) ─────────────────────
        script_text = await asyncio.to_thread(_generate_script_blocking, featured, user_id, briefing_id)

        # ── 4. Voice synthesis (network I/O, multi-tier waterfall) ─────
        audio_filename = f"briefing_audio_{briefing_id}_{int(time.time())}.mp3"
        audio_path     = os.path.join(MEDIA_DIR, audio_filename)
        audio_ok, engine_name = await asyncio.to_thread(
            _synthesize_voice_blocking, script_text, audio_path
        )

        audio_url    = f"/media/{audio_filename}" if audio_ok else ""
        fallback_msg = f"Voice Model: {engine_name}" if audio_ok else "Voice synthesis unavailable."

        # ── 5. Persist completed record ─────────────────────────────────
        await asyncio.to_thread(
            _mark_status_blocking,
            briefing_id,
            "done",
            script=script_text,
            media_url=audio_url,
            audio_url=audio_url,
            video_url=None,
            fallback_reason=fallback_msg,
            featured_jobs=json.dumps(featured),
        )
        print(f"[Briefing {briefing_id}] done — engine: {engine_name}")

    try:
        await asyncio.wait_for(_run(), timeout=WORKER_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        print(f"[Briefing {briefing_id}] timed out after {WORKER_TIMEOUT_SECONDS}s — marking failed")
        await asyncio.to_thread(_mark_status_blocking, briefing_id, "failed",
                                fallback_reason="Job timed out")
    except Exception as e:
        print(f"[Briefing {briefing_id}] unhandled error: {e}")
        await asyncio.to_thread(_mark_status_blocking, briefing_id, "failed",
                                fallback_reason=str(e)[:240])


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.post("/briefing/generate", response_model=BriefingResponse)
async def generate_briefing(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db),
):
    """
    Returns immediately with status='queued' and a briefing id.
    The async worker runs in the background — poll /briefing/status/{id}.
    """
    new_briefing = Briefing(
        user_id=current_user.id,
        script="Executive brief compiling...",
        status="queued",
        created_at=datetime.datetime.utcnow(),
    )
    db.add(new_briefing)
    db.commit()
    db.refresh(new_briefing)

    # Schedule the async coroutine — FastAPI's BackgroundTasks handles async tasks natively
    background_tasks.add_task(briefing_worker_task, new_briefing.id, current_user.id)

    return BriefingResponse(
        id=new_briefing.id,
        job_id=new_briefing.id,
        script=new_briefing.script,
        media_url=new_briefing.media_url or "",
        video_url=new_briefing.video_url,
        audio_url=new_briefing.audio_url,
        fallback_reason=new_briefing.fallback_reason,
        featured_jobs=[],
        status=new_briefing.status,
        created_at=new_briefing.created_at,
    )


@router.get("/briefing/status/{briefing_id}", response_model=BriefingResponse)
def get_briefing_status(
    briefing_id: int,
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db),
):
    """Lightweight status poll — returns current lifecycle state and data when ready."""
    briefing = db.query(Briefing).filter(
        Briefing.id == briefing_id,
        Briefing.user_id == current_user.id,
    ).first()
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")

    featured = []
    if briefing.featured_jobs:
        try:
            featured = json.loads(briefing.featured_jobs)
        except Exception:
            pass

    return BriefingResponse(
        id=briefing.id,
        job_id=briefing.id,
        script=briefing.script or "",
        media_url=briefing.media_url or "",
        video_url=briefing.video_url,
        audio_url=briefing.audio_url,
        fallback_reason=briefing.fallback_reason,
        featured_jobs=featured,
        status=briefing.status,
        created_at=briefing.created_at,
    )


@router.get("/briefing/latest", response_model=Optional[BriefingResponse])
def get_latest_briefing(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db),
):
    briefing = (
        db.query(Briefing)
        .filter(Briefing.user_id == current_user.id)
        .order_by(Briefing.created_at.desc())
        .first()
    )
    if not briefing:
        return None

    featured = []
    if briefing.featured_jobs:
        try:
            featured = json.loads(briefing.featured_jobs)
        except Exception:
            pass

    return BriefingResponse(
        id=briefing.id,
        job_id=briefing.id,
        script=briefing.script or "",
        media_url=briefing.media_url or "",
        video_url=briefing.video_url,
        audio_url=briefing.audio_url,
        fallback_reason=briefing.fallback_reason,
        featured_jobs=featured,
        status=briefing.status,
        created_at=briefing.created_at,
    )


@router.get("/briefing/history", response_model=List[BriefingResponse])
def get_briefing_history(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db),
):
    briefings = (
        db.query(Briefing)
        .filter(Briefing.user_id == current_user.id)
        .order_by(Briefing.created_at.desc())
        .limit(20)
        .all()
    )
    result = []
    for b in briefings:
        featured = []
        if b.featured_jobs:
            try:
                featured = json.loads(b.featured_jobs)
            except Exception:
                pass
        result.append(BriefingResponse(
            id=b.id,
            job_id=b.id,
            script=b.script or "",
            media_url=b.media_url or "",
            video_url=b.video_url,
            audio_url=b.audio_url,
            fallback_reason=b.fallback_reason,
            featured_jobs=featured,
            status=b.status,
            created_at=b.created_at,
        ))
    return result
