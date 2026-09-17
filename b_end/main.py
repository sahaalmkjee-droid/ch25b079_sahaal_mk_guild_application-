import os
import asyncio
import datetime
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import Base, engine, SessionLocal, init_db, IS_POSTGRES, User
from auth import router as auth_router, hash_password
from matches import router as matches_router
from audio_briefing import router as briefing_router, MEDIA_DIR
from chatbot import router as chatbot_router
from cost_analytics import router as analytics_router
from jobs import router as jobs_router
from scheduler import start_6h_cron_loop

app = FastAPI(
    title="SAHAAL / NEXUS Career Intelligence API",
    description="Modular backend engine powering semantic resume matching, executive audio briefings, career copilot chatbot, and cost analytics.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

@app.on_event("startup")
async def on_startup():
    init_db()
    db = SessionLocal()
    try:
        # Seed demo executive account
        exec_demo = db.query(User).filter(User.email == "demo.executive@nexus.ai").first()
        if not exec_demo:
            exec_user = User(
                email="demo.executive@nexus.ai",
                hashed_password=hash_password("nexus2026!")
            )
            db.add(exec_user)
            db.commit()
            print("[Auth] Seeded demo executive user: demo.executive@nexus.ai")
        else:
            exec_demo.hashed_password = hash_password("nexus2026!")
            db.commit()

        # Seed standard demo account
        demo = db.query(User).filter(User.email == "demo@nexus.ai").first()
        if not demo:
            demo_user = User(
                email="demo@nexus.ai",
                hashed_password=hash_password("password123")
            )
            db.add(demo_user)
            db.commit()
            print("[Auth] Seeded default demo user: demo@nexus.ai")
    finally:
        db.close()

    # Launch background 6-hour cron scheduler non-blockingly
    asyncio.create_task(start_6h_cron_loop())

# ---------------------------------------------------------------------------
# Health Check Endpoint
# ---------------------------------------------------------------------------
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "modular_backend",
        "port": 8000,
        "is_postgres": IS_POSTGRES,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

# ---------------------------------------------------------------------------
# Register Modular Service Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router)
app.include_router(matches_router)      # Service 1: Semantic Match with Resume
app.include_router(briefing_router)     # Service 2: Audio Briefing
app.include_router(chatbot_router)      # Service 3: Career Copilot Chatbot
app.include_router(analytics_router)    # Token & Cost Analytics
app.include_router(jobs_router)         # Async Job Lifecycle Manager (queued -> processing -> done -> failed)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
