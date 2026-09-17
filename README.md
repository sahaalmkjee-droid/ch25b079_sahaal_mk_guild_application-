# SAHAAL / NEXUS - Autonomous Career Intelligence Platform

SAHAAL / NEXUS is an autonomous full-stack career intelligence platform powering 768-dimensional semantic resume matching, executive audio briefings, AI copilot chat terminal, and token analytics tracking.

---

## System Architecture

Interactive Architecture Flowchart: [View System Architecture Diagram on Mermaid.ai](https://mermaid.ai/d/daf00f8c-c455-4a92-be8f-1630c85ce181)

```mermaid
flowchart TD
    subgraph Frontend ["Frontend SPA - React + Vite + Tailwind"]
        UI["User Dashboard UI"]
        RankPage["Ranked Matches and Resume Vectorizer"]
        BriefingPage["Executive Spoken Audio Player"]
        ChatPage["Career Copilot AI Agent"]
    end

    subgraph Backend ["Backend Engine - Python FastAPI"]
        API["FastAPI REST Routers"]
        AuthMod["JWT Authentication Engine"]
        VectorEngine["768-Dim Dense Vector Matcher"]
        BriefingMod["Executive Briefing Generator"]
        SchedulerMod["6-Hour Automated Scraper and Cron"]
    end

    subgraph DataAI ["Data and External AI Services"]
        DB[("PostgreSQL + pgvector / SQLite")]
        Gemini["Google Gemini text-embedding-004 and 3.6-Flash"]
        ElevenLabs["ElevenLabs Voice Synthesis Engine"]
    end

    UI --> API
    RankPage --> VectorEngine
    BriefingPage --> BriefingMod
    ChatPage --> API
    API --> AuthMod
    VectorEngine --> Gemini
    VectorEngine --> DB
    BriefingMod --> ElevenLabs
    SchedulerMod --> DB
```

> **Note on Video Generation vs Voice Model:**  
> Since video generation API tokens ran out, avatar video generation was not used. High-quality voice synthesis (ElevenLabs voice model) was used instead for executive audio briefing delivery.

---

## Setup Steps

### 1. Local Development Setup

#### Backend (b_end)
```bash
# Navigate to backend directory
cd b_end

# Create & activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python start_server.py
```
Backend runs on: http://127.0.0.1:8000  
API Health Check: http://127.0.0.1:8000/health

#### Frontend (f_end)
```bash
# Navigate to frontend directory
cd f_end

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend runs on: http://localhost:5173

---

### 2. Production Deployment Setup

- Frontend Host: Deployed on Railway (https://sahaal-frontend-production.up.railway.app)
- Backend Host: Deployed on Render (https://sahaal-backend-api.onrender.com)

---

## Required Environment Variables

| Variable Name | Required By | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| DATABASE_URL | Backend (b_end) | PostgreSQL / pgvector connection string. Falls back to SQLite if absent. | postgresql://user:pass@host:5432/db |
| JWT_SECRET | Backend (b_end) | Cryptographic secret key for signing user authentication JWT tokens. | nexus_jwt_secret_key_2026 |
| JWT_ALGORITHM | Backend (b_end) | Token signing algorithm. | HS256 |
| ACCESS_TOKEN_EXPIRE_MINUTES | Backend (b_end) | Expiration window for JWT access tokens. | 1440 (24 Hours) |
| GEMINI_API_KEY | Backend (b_end) | API Key for Google Gemini 768-dim embeddings & LLM chat. | AIzaSy... |
| ELEVENLABS_API_KEY | Backend (b_end) | API Key for ElevenLabs voice synthesis engine. | sk_... |
| ELEVENLABS_VOICE_ID | Backend (b_end) | Voice ID for executive audio briefings. | 21m00Tcm4TlvDq8ikWAM |
| VITE_API_BASE_URL | Frontend (f_end) | Public HTTP URL of live FastAPI backend service. | http://127.0.0.1:8000 |

---

## Deduplication Strategy

To prevent duplicate job postings across automated 6-hour scrape cycles and manual scraping requests, SAHAAL employs a 3-Tier Deduplication Strategy:

1. SHA-256 Raw Payload Hashing (raw_hash):
   Before inserting any scraped listing, a unique 16-character SHA-256 content hash is computed from normalized title and company name strings.

2. Unique Source URL Database Constraints:
   The job_listings table enforces a database-level UNIQUE index on source_url. Attempting to re-insert an existing URL triggers an in-memory skip or update pass.

3. Cosine Distance Near-Duplicate Filter:
   When vector embeddings are indexed, listings with a cosine distance D_c < 0.02 against existing embeddings are flagged as version updates (has_changed = True) rather than creating duplicate database rows.

---

## Honest List of Unfinished Features

While the core platform, vector engine, audio briefings, agent chatbot, and auth are fully functional, the following items remain open for future development:

1. Real-Time WebSockets: Background jobs and briefings currently use structured short-polling (/jobs/status/{id}) rather than persistent WebSocket frames.
2. WebRTC Talking Avatars / Video Generation: Since video generation API tokens ran out, avatar video generation was replaced with a voice synthesis model (ElevenLabs spoken audio briefings).
3. Production PostgreSQL Migration Scripts: Database table initialization uses SQLAlchemy create_all() with fallback rather than formal Alembic migration scripts.
4. Multi-Tenant RBAC Permissions: Roles are currently divided between standard candidates and executive demo users without granular team workspace RBAC controls.

---

Submitted for evaluation - SAHAAL Guild Application Project 2026.
