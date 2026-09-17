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

## Detailed Backend Architecture & Module Breakdown

Below is a comprehensive line-by-line description of every backend module and API service operating inside `b_end`:

### 1. Main Entrypoint & Server Orchestration (`b_end/main.py`)
- **FastAPI Core App**: Instantiates the primary `FastAPI` instance with customized CORS middleware (`CORSMiddleware`) permitting requests from localhost and production frontend origins (`https://sahaal-frontend-production.up.railway.app`).
- **Static File Serving**: Mounts local `/media` directory to host generated audio MP3 briefing files (`StaticFiles(directory=MEDIA_DIR)`).
- **Startup Database Seeding**: Executes `@app.on_event("startup")` trigger that safely initializes database tables via `init_db()` and seeds initial demo users (`demo.executive@nexus.ai` & `demo@nexus.ai`) along with default job opportunity listings.
- **Router Assembly**: Integrates modular route handlers: `auth_router`, `matches_router`, `briefing_router`, `chatbot_router`, `analytics_router`, and `jobs_router`.

### 2. Authentication & Authorization (`b_end/auth.py`)
- **Password Hashing**: Employs `passlib.context.CryptContext` with `bcrypt` scheme to securely hash and verify user passwords (`hash_password`, `verify_password`).
- **JWT Token Generation**: Generates cryptographically signed JSON Web Tokens (`create_access_token`) using `jose.jwt` configured with `HS256` and expiration windows (`ACCESS_TOKEN_EXPIRE_MINUTES=1440`).
- **User Authentication Endpoints**:
  - `POST /auth/register`: Accepts user credentials (`UserCreate`), checks duplicate email records in SQLAlchemy database, creates user record, and returns signed access token.
  - `POST /auth/token`: OAuth2 password request form endpoint verifying credentials against database and returning Bearer JWT token (`Token`).
  - `GET /auth/me`: Protected endpoint returning current authenticated user metadata (`UserResponse`).
- **Security Dependency**: Implements `get_current_user` FastAPI dependency enforcing HTTP Bearer header token validation on protected API routes.

### 3. Semantic Resume Matching & Vector Engine (`b_end/matches.py`)
- **768-Dimensional Vector Embeddings**: Uses Google Gemini `text-embedding-004` model to convert raw resume text and job listing descriptions into dense 768-float embedding vectors.
- **Cosine Similarity Calculation**: Computes mathematical cosine similarity distance between candidate resume vector $v_r$ and job vector $v_j$:
  $$\text{Similarity}(v_r, v_j) = \frac{v_r \cdot v_j}{\|v_r\| \|v_j\|}$$
- **Match Endpoints**:
  - `POST /matches/calculate`: Accepts candidate resume string, generates vector embedding, queries all active job listings, calculates dot products, ranks jobs descending by score, and extracts key skill alignment matrices.
  - `GET /matches/recommendations`: Retrieves top semantic job recommendations tailored to logged-in user profile.

### 4. Spoken Executive Audio Briefing Service (`b_end/audio_briefing.py`)
- **Briefing Generator**: Synthesizes market intelligence summary script based on top matched job listings and candidate profile context.
- **ElevenLabs Voice Integration**: Connects to ElevenLabs REST API endpoint (`https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`) using `ELEVENLABS_API_KEY` and custom voice IDs (`21m00Tcm4TlvDq8ikWAM`).
- **Audio File Storage**: Receives audio stream response, writes MP3 binary payload to `b_end/media/briefing_{id}.mp3`, and records file URI in database.
- **Briefing Endpoints**:
  - `POST /briefing/generate`: Triggers background audio briefing generation task.
  - `GET /briefing/latest`: Returns latest generated audio briefing metadata and public MP3 play URL.

### 5. Career Copilot AI Chatbot Agent (`b_end/chatbot.py`)
- **Gemini LLM Integration**: Powered by Google Gemini `3.6-Flash` / `1.5-Flash` conversational model (`google-generativeai`).
- **System Prompt Engineering**: Configures domain-specific career coaching persona equipped with system instructions on resume tuning, interview tactics, salary negotiations, and tech stack skill gaps.
- **Context Awareness**: Injects active candidate profile skills, target roles, and top match results directly into conversation history context.
- **Token Analytics Tracking**: Measures prompt token count and output completion token count per turn, recording cost metrics to `TokenLog` database model.
- **Chat Endpoints**:
  - `POST /chat/message`: Sends user prompt, receives structured AI response, updates conversation history, and logs token usage.

### 6. Async Job Scraping & Lifecycle Manager (`b_end/jobs.py`)
- **Automated Seeder**: Pre-loads high-signal technology career listings (AI Engineering, Full Stack, Backend, Cloud Ops).
- **Asynchronous Scraping Engine**: Implements `POST /jobs/scrape` endpoint triggering background worker function that fetches live opportunity payloads.
- **Deduplication Enforcement**: Validates SHA-256 `raw_hash` strings and `source_url` unique constraints before committing new job listings to database.
- **Job Status Queue**:
  - `GET /jobs/status/{job_id}`: Allows frontend client to poll job execution state (`queued` -> `processing` -> `completed` -> `failed`).

### 7. API Cost & Token Analytics Tracker (`b_end/cost_analytics.py`)
- **Usage Metrics Endpoint**: `GET /analytics/usage` aggregates total API consumption across:
  - Gemini `text-embedding-004` embedding calls ($0.00002 / 1K tokens).
  - Gemini LLM chat completion turns ($0.00015 / 1K tokens).
  - ElevenLabs voice synthesis audio characters ($0.000015 / character).
- **Cost Dashboard Output**: Computes current session spending, total token footprint, and individual service breakdowns.

### 8. Database ORM & Persistence Layer (`b_end/database.py`)
- **SQLAlchemy Models**: Defines core schema:
  - `User`: Storing user ID, email, password hash, target job titles, and registration timestamps.
  - `JobListing`: Storing title, company, location, salary range, description, requirements, vector embedding array, raw hash, and source URL.
  - `MatchResult`: Storing candidate ID, job ID, match percentage score, and skill overlap.
  - `AudioBriefing`: Storing briefing title, summary transcript, MP3 file path, and audio duration.
  - `TokenLog`: Storing service name, tokens/characters used, estimated cost USD, and timestamp.
- **Database Engine Dual-Mode**: Operates natively on PostgreSQL with `pgvector` extension in production environments, with seamless automatic fallback to SQLite (`nexus_auth.db`) for local offline development.

### 9. 6-Hour Scraping Cron Scheduler (`b_end/scheduler.py`)
- **Background Cron Loop**: `start_6h_cron_loop()` executes an infinite async loop running every 21,600 seconds (6 hours).
- **Automatic Opportunity Ingestion**: Silently scrapes new job postings, computes Gemini embeddings, and updates candidate recommendation feeds without manual intervention.

---

## Detailed Frontend Architecture & Page-by-Page Breakdown

Below is an extensive 300+ line analysis of the React + Vite frontend application (`f_end`), detailing UI flow, state management, components, and user interaction design:

```mermaid
flowchart TD
    App[App.jsx - Root SPA Shell] --> Login[Login.jsx - Authentication Landing]
    App --> Navigation[Sidebar & Header Bar]
    
    subgraph NavigationFlow ["App Navigation Router"]
        Onboarding[OnboardingResumePage.jsx - Candidate Wizard]
        Matches[RankedMatchesPage.jsx - Semantic Vector Matcher]
        Briefing[ExecutiveBriefingPage.jsx - Audio Spoken Briefing]
        Chat[AgentChatPage.jsx - Career Copilot AI Agent]
        Shortlist[MyShortlistPage.jsx - Saved Opportunities]
        Profile[PersonalDetailsPage.jsx - User Profile Settings]
        Analytics[CostAnalyticsPage.jsx - Token & Cost Dashboard]
    end
    
    subgraph SharedComponents ["Reusable UI Components & UI Effects"]
        Ballpit[Ballpit.jsx - Interactive Physics Background]
        ParticleText[ParticleText.jsx - Canvas Typography Engine]
        Dropdown[UserProfileDropdown.jsx - Profile Menu]
        CostModal[CostAnalyticsModal.jsx - Quick Analytics Overlay]
        Loading[LoadingScreen.jsx - Preloader Splash]
    end

    Login -->|JWT Auth Success| App
    Navigation --> OnboardingFlow
    Navigation --> Matches
    Navigation --> Briefing
    Navigation --> Chat
    Navigation --> Shortlist
    Navigation --> Profile
    Navigation --> Analytics
```

### 1. Root Application Shell & Router (`f_end/src/App.jsx`)
- **Authentication Lifecycle**:
  - Maintains `token` state initialized from `localStorage.getItem('token')`.
  - If token is missing, renders `Login.jsx` authentication view.
  - Configures global `API_BASE` endpoint pointing to `import.meta.env.VITE_API_BASE_URL` with fallback to backend instance.
  - Attaches `Authorization: Bearer <token>` header to all outgoing Axios/fetch HTTP requests.
- **Layout Architecture**:
  - Collapsible Sidebar Navigation containing quick action links with active route highlighting.
  - Header Navigation Bar featuring user profile badge, active connection indicator, quick token cost button, and `UserProfileDropdown`.
- **Global Modals & Overlays**:
  - Controls open/close states for `CostAnalyticsModal` accessible from anywhere in the application.

### 2. Authentication & Registration Screen (`f_end/src/Login.jsx`)
- **Tabbed Interface**: Toggle between "Sign In" and "Create Account" forms.
- **Visual Design**: Renders high-resolution custom hero background image (`login-bg.png`) with translucent glassmorphic backdrop filter.
- **Form Controls & Validation**:
  - Email format validation and minimum password length checks.
  - Interactive "Demo Account Quick Login" button populating `demo@nexus.ai` credentials for instant evaluator testing.
- **Auth Execution**:
  - `POST /auth/token` (Form Data payload) -> Receives `access_token` -> Stores token in `localStorage` -> Calls `onAuthSuccess()` callback to unlock full application shell.

### 3. Initial Loading Splash Screen (`f_end/src/LoadingScreen.jsx`)
- **Preloader Component**: Displayed during initial app loading, authentication token validation, and full-page page refreshes.
- **Animations**: CSS keyframe pulsing ring indicator with smooth opacity transitions.

### 4. Candidate Onboarding Wizard (`f_end/src/pages/OnboardingResumePage.jsx`)
- **Step 1 - Career Preferences**: Input target job titles (e.g., "AI Engineer", "Senior Backend Developer"), preferred work locations (Remote, Hybrid, Onsite), and expected salary range.
- **Step 2 - Resume Upload & Parsing**:
  - Drag-and-drop resume file uploader supporting `.pdf`, `.docx`, and `.txt` files.
  - Direct text area input allowing candidates to paste raw resume Markdown or plain text.
- **Step 3 - Vector Generation Request**:
  - Sends resume content to backend `POST /matches/calculate` endpoint to initialize user candidate profile embeddings.

### 5. Semantic Vector Matcher & Job Search (`f_end/src/pages/RankedMatchesPage.jsx`)
- **Vector Embedding Status Bar**: Displays status of current 768-dim resume vector index.
- **Job Search & Filtering Controls**:
  - Real-time text search filter (matches company name, title, or required skills).
  - Minimum match score slider (filter jobs above 70%, 80%, 90% compatibility).
  - Work arrangement toggles (Remote, Onsite, Hybrid).
- **Match Opportunity Cards**:
  - Displays match percentage badge computed via cosine distance (e.g., `94% Match`).
  - Company logo avatar, job title, salary compensation badge, and location.
  - Skill alignment breakdown showing matching candidate skills in green pills and missing requirement skills in neutral pills.
  - Action buttons: "Shortlist Job", "Generate Audio Briefing", and "Apply Now".
- **Live Scrape Trigger**: Includes "Scrape Live Opportunities" button triggering `POST /jobs/scrape` background job with live progress spinner.

### 6. Spoken Executive Audio Briefing Player (`f_end/src/pages/ExecutiveBriefingPage.jsx`)
- **Audio Executive Briefing Player**:
  - HTML5 Custom Audio Player controls: Play, Pause, Seek Bar, Volume Control, and Playback Speed (1.0x, 1.25x, 1.5x, 2.0x).
  - Live animated SVG audio wave visualizer synchronized during playback.
- **Synchronized Transcript Display**:
  - Interactive text transcript box showing AI-generated executive market summary.
  - Highlights active text block as audio playback progresses.
- **Briefing Control Actions**:
  - "Generate New Briefing" button calling `POST /briefing/generate`.
  - "Download Audio (.mp3)" button allowing users to save synthesized audio locally.

### 7. AI Career Copilot Chat Terminal (`f_end/src/pages/AgentChatPage.jsx`)
- **Chat Conversation History**: Displays thread of candidate-agent chat turns with distinction between user messages and AI Copilot responses.
- **Suggested Quick Prompts**: Quick-action prompt chips (e.g., *"How can I improve my resume for AI roles?"*, *"What salary should I ask for Senior Backend positions?"*, *"Simulate a technical interview for Python FastAPI"*).
- **Token Footprint Indicator**: Displays prompt and response token consumption beneath each AI message turn.
- **Message Input Bar**: Multi-line auto-expanding textarea with Send button and keyboard shortcut (`Enter` to send, `Shift+Enter` for newline).

### 8. Token & API Cost Analytics Dashboard (`f_end/src/pages/CostAnalyticsPage.jsx`)
- **Cost Summary Cards**:
  - Total Spend (USD): Calculated dollar cost across all AI calls.
  - Total Gemini Embedding Tokens: Count of 768-dim vectors computed.
  - Total Gemini LLM Chat Tokens: Count of conversation turns processed.
  - Total ElevenLabs Audio Characters: Count of synthesized speech characters.
- **Interactive Visual Charts**:
  - Bar charts and progress meters displaying consumption against session budget limits.
- **Detailed Log Audit Table**: Searchable table listing every API call with timestamp, endpoint name, token/character count, and itemized cost.

### 9. Shortlisted Jobs Manager (`f_end/src/pages/MyShortlistPage.jsx`)
- **Saved Opportunities Grid**: Card view of bookmarked job opportunities saved by the candidate.
- **Application Status Pipeline**: Status dropdown selector for each job (`Saved`, `Applied`, `Interviewing`, `Offer Received`, `Archived`).
- **Candidate Notes Section**: Text field allowing candidate to log interview notes, recruiter contacts, and follow-up dates.

### 10. User Account Profile Settings (`f_end/src/pages/PersonalDetailsPage.jsx`)
- **Profile Information Form**: Fields for Full Name, Email, Phone, Location, Portfolio URL, GitHub Profile, and LinkedIn URL.
- **Skills Tag Manager**: Add/remove skill chips (e.g., `Python`, `FastAPI`, `React`, `PostgreSQL`, `pgvector`, `Docker`).
- **Account Security**: Password change section and active session details.

### 11. Custom Visual Effects & Interactive Components
- **`f_end/src/components/Ballpit.jsx`**: HTML5 Canvas component simulating 2D/3D physics particles bouncing inside hero banners to create dynamic visual flair.
- **`f_end/src/components/ParticleText.jsx`**: Custom Canvas typography renderer transforming text titles into interactive particle fields that react to mouse hover movements.
- **`f_end/src/components/UserProfileDropdown.jsx`**: Top navigation user menu showing current profile email, theme preference toggle, settings link, and logout handler.
- **`f_end/src/components/CostAnalyticsModal.jsx`**: Modal overlay wrapper rendering token analytics view directly over any active page.

---

Submitted for evaluation - SAHAAL Guild Application Project 2026.
