import os
import re
import json
import datetime
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
load_dotenv()
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db, User, Resume, JobListing, SavedMatch, ChatMessage, CostLog, IS_POSTGRES
from auth import get_current_user_authenticated
from cost_analytics import record_cost
from matches import get_embedding, cosine_similarity, clean_query_text, get_or_heal_user_resume_embedding, parse_and_validate_embedding

router = APIRouter(tags=["agent"])
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class AgentToolCallInfo(BaseModel):
    tool_name: str
    tool_input: Dict[str, Any]
    tool_output: Any

class AgentChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, Any]]] = []

class AgentChatResponse(BaseModel):
    response: str
    tool_calls: List[AgentToolCallInfo] = []

# ---------------------------------------------------------------------------
# Database Tool Handlers
# ---------------------------------------------------------------------------
def tool_query_saved_jobs(user_id: int, db: Session, status: Optional[str] = "all", keyword: Optional[str] = "") -> List[dict]:
    """
    Searches or retrieves user's saved, applied, or shortlisted jobs from the database.
    """
    query = db.query(SavedMatch).filter(SavedMatch.user_id == user_id)
    if status and status.lower() not in ["all", "any", ""]:
        query = query.filter(SavedMatch.status == status.lower())

    saved_records = query.all()
    results = []
    kw = (keyword or "").lower().strip()

    for sm in saved_records:
        job = sm.job
        if not job:
            continue
        skills = json.loads(job.required_skills or "[]")
        if kw:
            match_title = kw in job.title.lower()
            match_company = kw in job.company.lower()
            match_skill = any(kw in s.lower() for s in skills)
            if not (match_title or match_company or match_skill):
                continue

        results.append({
            "id": job.id,
            "title": job.title,
            "company": job.company,
            "location": job.location,
            "remote_ok": job.remote_ok,
            "stipend": job.stipend,
            "deadline": job.deadline,
            "status": sm.status,
            "match_score": f"{int((sm.match_score or 0) * 100)}%",
            "justification": sm.match_justification or "",
            "skills": skills[:6]
        })
    return results

def tool_check_deadlines(days: int = 14, db: Session = None, user_id: Optional[int] = None) -> List[dict]:
    """
    Checks job listings with approaching application deadlines within N days.
    """
    today = datetime.date.today()
    cutoff = today + datetime.timedelta(days=max(1, days))
    jobs = db.query(JobListing).filter(JobListing.is_active == True).all()
    closing = []

    user_saved_ids = set()
    if user_id and db:
        user_saved_ids = {sm.job_id for sm in db.query(SavedMatch).filter(SavedMatch.user_id == user_id).all()}

    for j in jobs:
        try:
            d = datetime.date.fromisoformat(j.deadline)
            if today <= d <= cutoff:
                closing.append({
                    "id": j.id,
                    "title": j.title,
                    "company": j.company,
                    "deadline": j.deadline,
                    "days_remaining": (d - today).days,
                    "stipend": j.stipend,
                    "is_saved_by_user": j.id in user_saved_ids
                })
        except Exception:
            continue

    closing.sort(key=lambda x: x["days_remaining"])
    return closing[:10]

def tool_analyze_skills_gap(user_id: int, db: Session) -> dict:
    """
    Compares the user's uploaded resume against active job listings to identify missing technical skills.
    """
    user_resume = db.query(Resume).filter(Resume.user_id == user_id).first()
    resume_text = user_resume.raw_text.lower() if user_resume else ""
    jobs = db.query(JobListing).filter(JobListing.is_active == True).limit(50).all()

    all_required: Dict[str, int] = {}
    missing_skills: Dict[str, int] = {}
    possessed_skills: List[str] = []

    for j in jobs:
        skills = json.loads(j.required_skills or "[]")
        for s in skills:
            clean_s = s.strip()
            if not clean_s:
                continue
            all_required[clean_s] = all_required.get(clean_s, 0) + 1
            pattern = rf"\b{re.escape(clean_s.lower())}\b"
            if re.search(pattern, resume_text):
                if clean_s not in possessed_skills:
                    possessed_skills.append(clean_s)
            else:
                missing_skills[clean_s] = missing_skills.get(clean_s, 0) + 1

    sorted_missing = sorted(missing_skills.items(), key=lambda x: x[1], reverse=True)
    return {
        "resume_uploaded": bool(user_resume),
        "candidate_skills_detected": possessed_skills[:12],
        "high_priority_gaps": [{"skill": k, "job_frequency": v} for k, v in sorted_missing[:6]],
        "recommendation": "Bridging these skill gaps will noticeably elevate your match scores across active openings."
    }

def tool_get_user_costs(user_id: int, db: Session) -> dict:
    """
    Inspects user's token usage and cost expenditure in Indian Rupees (INR) from the persistent cost ledger.
    """
    logs = db.query(CostLog).filter(CostLog.user_id == user_id).all()
    features: Dict[str, Dict[str, Any]] = {}
    tot_in = 0
    tot_out = 0
    tot_cost = 0.0

    for log in logs:
        tot_in += log.tokens_in
        tot_out += log.tokens_out
        tot_cost += log.cost_inr
        if log.feature not in features:
            features[log.feature] = {"feature": log.feature, "tokens_in": 0, "tokens_out": 0, "cost_inr": 0.0}
        features[log.feature]["tokens_in"] += log.tokens_in
        features[log.feature]["tokens_out"] += log.tokens_out
        features[log.feature]["cost_inr"] = round(features[log.feature]["cost_inr"] + log.cost_inr, 4)

    return {
        "total_tokens_in": tot_in,
        "total_tokens_out": tot_out,
        "total_tokens": tot_in + tot_out,
        "total_cost_inr": round(tot_cost, 4),
        "pricing_tier": "Gemini 3.6 Flash + text-embedding-004 (₹6.25 / 1M tokens)",
        "features": list(features.values())
    }

def tool_semantic_job_query(query: str, user_id: int, db: Session) -> List[dict]:
    """
    Executes semantic vector cosine similarity search across active scraped job listings.
    Directive 1: Enforces task_type='RETRIEVAL_QUERY'
    Directive 2: Cleans query text before embedding
    Directive 3: Computes exact cosine similarity without artificial min-max clipping
    """
    clean_q = clean_query_text(query)
    q_emb = get_embedding(clean_q, user_id=user_id, db=db, feature="agent_semantic_query", task_type="RETRIEVAL_QUERY")
    ranked = []
    if IS_POSTGRES:
        # Directive 3 (Postgres): raw_cosine = 1.0 - D_c
        distance_expr = JobListing.embedding.cosine_distance(q_emb)
        job_records = (
            db.query(JobListing, distance_expr.label("distance"))
            .filter(JobListing.is_active == True)
            .order_by(distance_expr.asc())
            .limit(4)
            .all()
        )
        for j, dist in job_records:
            raw_cosine = 1.0 - float(dist) if dist is not None else 0.0
            ranked.append({
                "id": j.id,
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "stipend": j.stipend,
                "score": round(raw_cosine, 3)
            })
    else:
        # Directive 3 (In-Memory / SQLite): raw_cosine = dot(A, B) / (norm(A) * norm(B))
        jobs = db.query(JobListing).filter(JobListing.is_active == True).limit(500).all()
        for j in jobs:
            emb = parse_and_validate_embedding(j.embedding)
            if emb:
                raw_cosine = max(0.0, cosine_similarity(q_emb, emb))
                ranked.append({
                    "id": j.id,
                    "title": j.title,
                    "company": j.company,
                    "location": j.location,
                    "stipend": j.stipend,
                    "score": round(raw_cosine, 3)
                })
        ranked.sort(key=lambda x: x["score"], reverse=True)
        ranked = ranked[:4]
    return ranked

def tool_match_resume_to_jobs(user_id: int, db: Session, limit: int = 5) -> dict:
    """
    Matches active jobs directly against the candidate's stored resume vector.
    """
    user_resume = db.query(Resume).filter(Resume.user_id == user_id).first()
    if not user_resume or not user_resume.raw_text:
        return {"error": "No resume found. Please upload a resume first.", "top_matches": []}

    r_emb = get_or_heal_user_resume_embedding(user_resume, user_id, db)
    if r_emb:
        ranked = []
        if IS_POSTGRES:
            distance_expr = JobListing.embedding.cosine_distance(r_emb)
            job_records = (
                db.query(JobListing, distance_expr.label("distance"))
                .filter(JobListing.is_active == True)
                .order_by(distance_expr.asc())
                .limit(limit)
                .all()
            )
            for j, dist in job_records:
                raw_cosine = max(0.0, 1.0 - float(dist)) if dist is not None else 0.0
                ranked.append({
                    "id": j.id,
                    "title": j.title,
                    "company": j.company,
                    "location": j.location,
                    "stipend": j.stipend,
                    "score": round(raw_cosine, 3)
                })
        else:
            jobs = db.query(JobListing).filter(JobListing.is_active == True).limit(500).all()
            for j in jobs:
                emb = parse_and_validate_embedding(j.embedding)
                if emb:
                    raw_cosine = max(0.0, cosine_similarity(r_emb, emb))
                    ranked.append({
                        "id": j.id,
                        "title": j.title,
                        "company": j.company,
                        "location": j.location,
                        "stipend": j.stipend,
                        "score": round(raw_cosine, 3)
                    })
            ranked.sort(key=lambda x: x["score"], reverse=True)
            ranked = ranked[:limit]
        return {"top_matches": ranked}
    else:
        resume_query = user_resume.raw_text[:800]
        matches = tool_semantic_job_query(query=resume_query, user_id=user_id, db=db)
        return {"top_matches": matches[:limit]}

# ---------------------------------------------------------------------------
# NL2SQL Table Formatter, Sanitization & Autonomous Tool Handler
# ---------------------------------------------------------------------------
def format_sql_results_as_markdown_table(rows: list, columns: list) -> str:
    """
    Programmatic Markdown table generator ensuring each row has strict newline delimiters.
    """
    if not rows:
        return "No matching records found."

    # Header and separator lines
    header = "| " + " | ".join(columns) + " |"
    separator = "| " + " | ".join(["---"] * len(columns)) + " |"

    # Each row MUST be on its own separate line
    row_lines = []
    for r in rows:
        row_str = "| " + " | ".join(str(r.get(col, "")).replace("\n", " ").replace("|", "\\|") for col in columns) + " |"
        row_lines.append(row_str)

    return "\n".join([header, separator] + row_lines)

def sanitize_generated_sql(sql_query: str) -> str:
    """
    Sanitizes LLM-generated SQL to enforce strict read-only execution:
    - Strips markdown fences, quotes, and backticks.
    - Enforces query begins with 'SELECT'.
    - Rejects destructive keywords: UPDATE, INSERT, DELETE, DROP, ALTER, TRUNCATE, CREATE, REPLACE, GRANT, REVOKE.
    - Blocks multiple statements (semicolons) and SQL comments (--, /*).
    - Enforces a hard LIMIT constraint (default to 15-20 rows max).
    """
    if not sql_query or not isinstance(sql_query, str):
        raise ValueError("Empty or invalid SQL query provided.")

    # 1. Strip markdown fences and backticks
    clean = re.sub(r'```(?:sql)?', '', sql_query, flags=re.IGNORECASE)
    clean = clean.replace('```', '').replace('`', '').strip()

    # 2. Strip trailing semicolon
    clean = re.sub(r';\s*$', '', clean).strip()

    # 3. Block multiple statements (semicolon within query)
    if ';' in clean:
        raise ValueError("Multiple SQL statements are strictly forbidden.")

    # 4. Block SQL comments
    if '--' in clean or '/*' in clean or '*/' in clean:
        raise ValueError("SQL comments (-- or /* */) are strictly forbidden.")

    # 5. Enforce query begins with SELECT
    if not re.match(r'^\s*SELECT\b', clean, re.IGNORECASE):
        raise ValueError("Only SELECT queries are permitted.")

    # 6. Reject forbidden keywords
    forbidden = [
        "UPDATE", "INSERT", "DELETE", "DROP", "ALTER", "TRUNCATE",
        "CREATE", "REPLACE", "GRANT", "REVOKE", "EXEC", "EXECUTE",
        "ATTACH", "DETACH", "PRAGMA", "VACUUM"
    ]
    for kw in forbidden:
        if re.search(rf'\b{kw}\b', clean, re.IGNORECASE):
            raise ValueError(f"Forbidden SQL keyword '{kw}' detected. Query must be strictly read-only.")

    # 7. Enforce hard LIMIT constraint (max 20 rows, default 15)
    limit_match = re.search(r'\bLIMIT\s+(\d+)\b', clean, re.IGNORECASE)
    if limit_match:
        val = int(limit_match.group(1))
        if val > 20 or val < 1:
            clean = re.sub(r'\bLIMIT\s+\d+\b', 'LIMIT 15', clean, count=1, flags=re.IGNORECASE)
    else:
        clean = clean + " LIMIT 15"

    return clean

def inject_tenant_isolation(sql: str, user_id: int) -> str:
    """
    Ensures any query touching `saved_matches` strictly includes a tenant filter for `user_id`.
    """
    if "saved_matches" not in sql.lower():
        return sql

    # If user_id = \d+ is already present, force it to match user_id
    if re.search(r'\buser_id\s*=\s*\d+', sql, re.IGNORECASE):
        return re.sub(r'\buser_id\s*=\s*\d+', f"user_id = {user_id}", sql, flags=re.IGNORECASE)

    # If there is a WHERE clause, prefix with (saved_matches.user_id = {user_id}) AND
    where_match = re.search(r'\bWHERE\b', sql, re.IGNORECASE)
    if where_match:
        end = where_match.end()
        return sql[:end] + f" (saved_matches.user_id = {user_id}) AND" + sql[end:]

    # If no WHERE clause, insert WHERE saved_matches.user_id = {user_id} before ORDER BY or LIMIT or at end
    limit_or_order = re.search(r'\b(ORDER\s+BY|LIMIT|GROUP\s+BY)\b', sql, re.IGNORECASE)
    if limit_or_order:
        idx = limit_or_order.start()
        return sql[:idx] + f" WHERE saved_matches.user_id = {user_id} " + sql[idx:]
    else:
        return sql + f" WHERE saved_matches.user_id = {user_id}"

def tool_nl2sql_database_search(natural_language_filter: str, user_id: int, db: Session) -> dict:
    """
    Translates natural language search criteria into a safe read-only SQL query, executes it against the database,
    and returns a structured tabular payload.
    """
    raw_sql = ""
    if GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=GEMINI_API_KEY)
            nl2sql_system_prompt = (
                "You are an expert read-only SQL translation engine for SQLite and PostgreSQL.\n"
                "Generate a SINGLE valid SQL SELECT query based on the user's natural language filter.\n\n"
                "Minimal Schema Context:\n"
                "- job_listings(id, title, company, location, remote_ok, stipend, deadline, is_active)\n"
                "- saved_matches(id, user_id, job_id, status, match_score, match_justification)\n\n"
                "Rules:\n"
                "1. Return ONLY the raw SQL query. Do NOT use markdown fences, backticks, or any explanatory commentary.\n"
                "2. The query MUST begin with SELECT.\n"
                "3. By default, ensure job_listings.is_active = 1 (or true) unless specified.\n"
                f"4. If querying saved_matches, ALWAYS filter by saved_matches.user_id = {user_id} to maintain tenant isolation.\n"
                "5. For stipend/salary filters, note stipend is text (e.g., '$95,000 - $130,000 / yr', '₹45,000/mo', 'Competitive'). Use LIKE or keyword matching when appropriate.\n"
                "6. Enforce a row limit of at most 15 rows (LIMIT 15).\n"
            )
            prompt = f"{nl2sql_system_prompt}\nUser Filter: \"{natural_language_filter}\"\nSQL Query:"

            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=300
                )
            )

            if response.usage_metadata:
                record_cost(
                    user_id=user_id,
                    feature="agent_nl2sql_generation",
                    tokens_in=response.usage_metadata.prompt_token_count or 0,
                    tokens_out=response.usage_metadata.candidates_token_count or 0,
                    db=db
                )

            if response.text:
                raw_sql = response.text.strip()
        except Exception as e:
            print(f"[NL2SQL Gemini Generation Fallback] {e}")
            raw_sql = ""

    # Fallback heuristic SQL generator if Gemini is offline, key is unset, or failed
    if not raw_sql:
        nl_lower = natural_language_filter.lower()
        conditions = ["is_active = 1"]

        # Location checks
        cities = ["remote", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad", "pune", "chennai", "new york", "san francisco", "london"]
        matched_city = None
        for c in cities:
            if c in nl_lower:
                conditions.append(f"LOWER(location) LIKE '%{c}%'")
                matched_city = c
                break

        # Stipend numbers
        stipend_num = re.search(r'(\d+)\s*k?', nl_lower)
        if stipend_num:
            num_val = stipend_num.group(1)
            conditions.append(f"(LOWER(stipend) LIKE '%{num_val}%' OR LOWER(stipend) != 'unpaid')")

        # Keywords for title search (excluding cities, stop words, and conversational markers)
        stop_words = {
            "filter", "salary", "stipend", "where", "location", "paying", "roles", "find",
            "show", "jobs", "with", "from", "than", "more", "that", "give", "list", "above",
            "below", "over", "under", "near", "between", "around", "and", "for", "the", "any",
            "all", "high", "good", "best", "some", "need", "want", "looking"
        }
        if matched_city:
            stop_words.add(matched_city)

        words = [w for w in re.findall(r'\b[a-zA-Z]{3,}\b', nl_lower) if w not in stop_words]
        if words:
            title_clauses = " OR ".join([f"LOWER(title) LIKE '%{w}%'" for w in words[:3]])
            conditions.append(f"({title_clauses})")

        where_clause = " AND ".join(conditions)
        raw_sql = f"SELECT id, title, company, location, remote_ok, stipend, deadline FROM job_listings WHERE {where_clause} LIMIT 15"

    try:
        # Step 2: Inject user ID filter if saved_matches is queried to maintain tenant isolation
        isolated_sql = inject_tenant_isolation(raw_sql, user_id=user_id)

        # Step 3: Sanitize SQL string
        safe_sql = sanitize_generated_sql(isolated_sql)

        # Step 4: Execute against db
        exec_res = db.execute(text(safe_sql))

        # Step 5: Extract column keys and fetch up to 15 rows as dictionaries
        columns = list(exec_res.keys())
        rows = [dict(r) for r in exec_res.mappings().fetchmany(15)]
        formatted_table = format_sql_results_as_markdown_table(rows, columns)

        # Step 6: Return JSON payload
        return {
            "executed_sql": safe_sql,
            "row_count": len(rows),
            "columns": columns,
            "data": rows,
            "markdown_table": formatted_table
        }
    except Exception as e:
        # Step 7: Catch exceptions and return structured errors without crashing the agent
        return {
            "error": str(e),
            "executed_sql": raw_sql,
            "row_count": 0,
            "columns": [],
            "data": [],
            "markdown_table": "No matching records found."
        }

AGENT_SYSTEM_INSTRUCTION = (
    "You are NEXUS, an elite, highly intelligent autonomous career copilot and recruitment strategist for SAHAAL. "
    "You have access to live database tools to inspect the user's saved jobs, check closing application deadlines, "
    "match active jobs directly against their uploaded resume vector, analyze skills gaps against their resume, "
    "look up API token costs, execute semantic vector job queries, and perform dynamic relational database queries using natural language SQL translation. "
    "\n\nOperational Guidelines:\n"
    "1. Natural Conversational Tone: When greeted (e.g., 'hi', 'hello', 'who are you'), respond warmly, naturally, and strategically. NEVER dump raw JSON or a static feature list unless explicitly asked.\n"
    "2. Autonomous Tool Calling: When the user asks about their saved jobs, deadlines, skill gaps, token costs, or semantic search, invoke the appropriate registered tool automatically.\n"
    "3. Resume Matching: When the user asks for roles matching their resume, highest cosine similarity, best fit for their background, or top jobs for their profile, invoke `match_resume_to_jobs`.\n"
    "4. Relational Filtering & NL2SQL Presentation Rules:\n"
    "   When the user requests specific relational filters, numeric thresholds (e.g., stipend > 40k), specific cities, or arbitrary job combinations, invoke `nl2sql_database_search`.\n"
    "   When presenting results from `nl2sql_database_search`:\n"
    "   - Start with a 1-2 sentence high-level conversational summary highlighting key findings (e.g., compensation range, location distribution).\n"
    "   - Format the top matching records as a clean Markdown table with strict newlines between each row (Role | Company | Location | Deadline | Stipend).\n"
    "   - Conclude with 2-3 strategic takeaways recommending next steps, specific high-value roles to inspect, or relevant skill requirements.\n"
    "5. Contextual Synthesis: Translate tool outputs into clear, authoritative, actionable career advice. Frame numbers into strategic insights.\n"
    "6. Graceful Fallbacks: If a tool returns no items, gracefully and conversationally inform the user and suggest an actionable next step.\n"
    "7. Memory Awareness: Use previous conversational turns to resolve pronouns and follow-up requests smoothly."
)

@router.post("/agent/chat", response_model=AgentChatResponse)
def agent_chat(
    req: AgentChatRequest,
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    user_msg_text = req.message.strip()
    if not user_msg_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    executed_tool_calls: List[AgentToolCallInfo] = []
    final_response_text = ""

    # 1. Retrieve Recent Multi-Turn Conversational Memory (Persistent)
    recent_history = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
        .all()
    )
    recent_history.reverse()

    # 2. Define Official Tool Handlers
    def query_saved_jobs(status: str = "all", keyword: str = "") -> dict:
        """Searches or retrieves user's saved, applied, or shortlisted jobs from the database. status can be 'saved', 'applied', or 'all'."""
        res = tool_query_saved_jobs(user_id=current_user.id, db=db, status=status, keyword=keyword)
        return {"count": len(res), "saved_jobs": res}

    def check_deadlines(days: int = 14) -> dict:
        """Checks job listings with approaching application deadlines within the given number of days."""
        res = tool_check_deadlines(days=days, db=db, user_id=current_user.id)
        return {"days_checked": days, "closing_count": len(res), "jobs_closing_soon": res}

    def match_resume_to_jobs(limit: int = 5) -> dict:
        """Matches active job listings directly against candidate's stored resume vector to find top aligned roles and cosine similarity scores."""
        return tool_match_resume_to_jobs(user_id=current_user.id, db=db, limit=limit)

    def analyze_skills_gap() -> dict:
        """Compares candidate's uploaded resume against active job listings to identify missing technical skills and gaps."""
        return tool_analyze_skills_gap(user_id=current_user.id, db=db)

    def get_user_costs() -> dict:
        """Inspects user's API token consumption, feature usage, and cost expenditure in Indian Rupees (INR)."""
        return tool_get_user_costs(user_id=current_user.id, db=db)

    def search_job_listings(query: str) -> dict:
        """Performs semantic vector cosine similarity search across active scraped job listings using the query string."""
        res = tool_semantic_job_query(query=query, user_id=current_user.id, db=db)
        return {"query": query, "match_count": len(res), "results": res}

    def nl2sql_database_search(natural_language_filter: str) -> dict:
        """Translates unstructured, specific database search criteria or tabular requirements into SQL and executes it."""
        return tool_nl2sql_database_search(natural_language_filter=natural_language_filter, user_id=current_user.id, db=db)

    dispatch_map = {
        "query_saved_jobs": query_saved_jobs,
        "check_deadlines": check_deadlines,
        "match_resume_to_jobs": match_resume_to_jobs,
        "analyze_skills_gap": analyze_skills_gap,
        "get_user_costs": get_user_costs,
        "search_job_listings": search_job_listings,
        "nl2sql_database_search": nl2sql_database_search,
    }

    # 3. Two-Phase Agentic Execution Loop
    if GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=GEMINI_API_KEY)

            # Build conversation history
            contents = []
            for h in recent_history:
                role_name = "user" if h.role == "user" else "model"
                contents.append(types.Content(
                    role=role_name,
                    parts=[types.Part.from_text(text=h.content)]
                ))

            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_msg_text)]
            ))

            config = types.GenerateContentConfig(
                system_instruction=AGENT_SYSTEM_INSTRUCTION,
                tools=[
                    query_saved_jobs,
                    check_deadlines,
                    match_resume_to_jobs,
                    analyze_skills_gap,
                    get_user_costs,
                    search_job_listings,
                    nl2sql_database_search,
                ],
                temperature=0.3,
            )

            # Phase 1: Reasoning
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=contents,
                config=config
            )

            # Log tokens
            if response.usage_metadata:
                record_cost(
                    user_id=current_user.id,
                    feature="agent_chat_reasoning",
                    tokens_in=response.usage_metadata.prompt_token_count or 0,
                    tokens_out=response.usage_metadata.candidates_token_count or 0,
                    db=db
                )

            # Phase 2: Tool Execution & Synthesis
            if response.function_calls:
                model_turn_parts = []
                tool_response_parts = []

                for fc in response.function_calls:
                    fn_name = fc.name
                    fn_args = dict(fc.args) if fc.args else {}
                    handler = dispatch_map.get(fn_name)

                    if handler:
                        tool_res = handler(**fn_args)
                    else:
                        tool_res = {"error": f"Tool '{fn_name}' is not registered."}

                    executed_tool_calls.append(AgentToolCallInfo(
                        tool_name=fn_name,
                        tool_input=fn_args,
                        tool_output=tool_res
                    ))

                    model_turn_parts.append(types.Part.from_function_call(
                        name=fn_name,
                        args=fn_args
                    ))
                    tool_response_parts.append(types.Part.from_function_response(
                        name=fn_name,
                        response={"result": tool_res}
                    ))

                # Feed tool results back for synthesis
                follow_up_contents = list(contents)
                follow_up_contents.append(types.Content(role="model", parts=model_turn_parts))
                follow_up_contents.append(types.Content(role="user", parts=tool_response_parts))

                synthesis_response = client.models.generate_content(
                    model="gemini-3.6-flash",
                    contents=follow_up_contents,
                    config=types.GenerateContentConfig(
                        system_instruction=AGENT_SYSTEM_INSTRUCTION,
                        temperature=0.4
                    )
                )

                if synthesis_response.usage_metadata:
                    record_cost(
                        user_id=current_user.id,
                        feature="agent_chat_synthesis",
                        tokens_in=synthesis_response.usage_metadata.prompt_token_count or 0,
                        tokens_out=synthesis_response.usage_metadata.candidates_token_count or 0,
                        db=db
                    )

                final_response_text = synthesis_response.text.strip() if synthesis_response.text else ""
            else:
                final_response_text = response.text.strip() if response.text else ""

        except Exception as e:
            print(f"[Agent Tool Calling Error] {type(e).__name__}: {e}")
            final_response_text = ""

    # 4. Seamless Dynamic Fallback
    if not final_response_text:
        lower_msg = user_msg_text.lower()
        if any(w in lower_msg for w in ["cost", "token", "bill", "usage", "inr", "spend", "balance"]):
            res = get_user_costs()
            executed_tool_calls.append(AgentToolCallInfo(tool_name="get_user_costs", tool_input={}, tool_output=res))
            breakdown_lines = "\n".join([f"• **{f['feature']}**: {f['tokens_in'] + f['tokens_out']} tokens (₹{f['cost_inr']:.4f})" for f in res.get("features", [])[:5]])
            final_response_text = (
                f"### Cost & Token Analytics\n\n"
                f"• **Total Tokens Consumed**: {res['total_tokens']:,} ({res['total_tokens_in']:,} in / {res['total_tokens_out']:,} out)\n"
                f"• **Total Spend**: **₹{res['total_cost_inr']:.4f}**\n"
                f"• **Model Tier**: {res['pricing_tier']}\n\n"
                f"**Itemized Feature Breakdown**:\n{breakdown_lines if breakdown_lines else '• No billable model calls logged yet.'}"
            )
        elif any(w in lower_msg for w in ["deadline", "closing", "urgent", "soon", "expire"]):
            res = check_deadlines(days=14)
            executed_tool_calls.append(AgentToolCallInfo(tool_name="check_deadlines", tool_input={"days": 14}, tool_output=res))
            closing = res.get("jobs_closing_soon", [])
            if closing:
                items_text = "\n".join([f"• **{j['title']}** at {j['company']} — Deadline: **{j['deadline']}** ({j['days_remaining']} days left)" for j in closing[:5]])
                final_response_text = (
                    f"### Approaching Application Deadlines\n\n"
                    f"I identified **{len(closing)}** high-priority role(s) closing within the next 14 days:\n\n"
                    f"{items_text}\n\n"
                    f"Would you like me to inspect required skills or draft an accelerated briefing for any of these?"
                )
            else:
                final_response_text = "You don't have any tracked jobs closing within the next 14 days. Most openings feature rolling or ongoing application review."
        elif any(w in lower_msg for w in ["resume match", "highest cosine", "match score to my resume", "fit my resume", "top jobs", "for my resume", "match my resume", "cosine similarity", "matched to my resume", "matching my resume", "my resume", "jobs for me"]):
            res = tool_match_resume_to_jobs(user_id=current_user.id, db=db, limit=5)
            executed_tool_calls.append(AgentToolCallInfo(tool_name="match_resume_to_jobs", tool_input={"limit": 5}, tool_output=res))
            matches = res.get("top_matches", [])
            if matches:
                rows = "\n".join([f"• **{m['title']}** at {m['company']} ({m['location']}) — Match Score: {int(m['score'] * 100)}%" for m in matches])
                final_response_text = f"### Top Resume Matches\n\n{rows}"
            else:
                final_response_text = res.get("error", "No matching jobs found.")
        elif any(w in lower_msg for w in ["gap", "missing skill", "skills to learn", "skill deficit"]):
            res = analyze_skills_gap()
            executed_tool_calls.append(AgentToolCallInfo(tool_name="analyze_skills_gap", tool_input={}, tool_output=res))
            gaps = res.get("high_priority_gaps", [])
            gap_lines = "\n".join([f"• **{g['skill']}** (Required in {g['job_frequency']} active roles)" for g in gaps[:5]])
            final_response_text = (
                f"### Technical Skill Gap Evaluation\n\n"
                f"• **Verified Resume Skills**: {', '.join(res.get('candidate_skills_detected', [])[:8]) or 'No resume uploaded yet'}\n\n"
                f"**Top High-Yield Skills to Acquire**:\n"
                f"{gap_lines if gap_lines else '• No significant skill gaps detected!'}\n\n"
                f"{res.get('recommendation', '')}"
            )
        elif any(w in lower_msg for w in ["saved", "bookmark", "shortlist", "applied"]):
            res = query_saved_jobs(status="all")
            executed_tool_calls.append(AgentToolCallInfo(tool_name="query_saved_jobs", tool_input={"status": "all"}, tool_output=res))
            saved = res.get("saved_jobs", [])
            if saved:
                saved_lines = "\n".join([f"• **{s['title']}** at {s['company']} ({s['location']}) — Match: **{s['match_score']}**" for s in saved[:6]])
                final_response_text = f"Here are your **{len(saved)} saved** role(s):\n\n{saved_lines}\n\nWould you like me to inspect any specific role's details?"
            else:
                final_response_text = "You have not saved any jobs yet. Browse your Ranked Matches page to save promising roles."
        elif any(w in lower_msg for w in ["filter", "salary", "stipend", "where", "location", "paying", "roles in"]):
            res = nl2sql_database_search(natural_language_filter=user_msg_text)
            executed_tool_calls.append(AgentToolCallInfo(
                tool_name="nl2sql_database_search",
                tool_input={"natural_language_filter": user_msg_text},
                tool_output=res
            ))
            rows = res.get("data", [])
            display_cols = ["Role", "Company", "Location", "Deadline", "Stipend"]
            formatted_rows = []
            for r in rows:
                formatted_rows.append({
                    "Role": r.get("title", r.get("Role", "N/A")),
                    "Company": r.get("company", r.get("Company", "N/A")),
                    "Location": r.get("location", r.get("Location", "N/A")),
                    "Deadline": r.get("deadline", r.get("Deadline", "Ongoing")),
                    "Stipend": r.get("stipend", r.get("Stipend", "Competitive")),
                })

            table_md = format_sql_results_as_markdown_table(formatted_rows, display_cols)
            if rows:
                final_response_text = (
                    f"I located **{len(rows)} matching positions** matching your search criteria (`{user_msg_text}`). "
                    f"The table below details current active openings across target locations and compensation tiers:\n\n"
                    f"{table_md}\n\n"
                    f"**Strategic Takeaways**:\n"
                    f"1. **Compensation & Stability**: The active openings above feature competitive salary tiers with ongoing or rolling review windows.\n"
                    f"2. **Targeted Shortlisting**: Evaluate the top matches directly against your current resume profile to identify alignment advantages.\n"
                    f"3. **Refinement**: You can filter further by specific skills, company names, or relocation preferences anytime."
                )
            else:
                final_response_text = (
                    f"I queried the database for `{user_msg_text}`, but no active job listings currently match those exact constraints.\n\n"
                    f"**Strategic Takeaways**:\n"
                    f"1. **Broaden Criteria**: Try relaxing strict compensation bounds or expanding location radius.\n"
                    f"2. **Semantic Search**: Ask me to run a semantic vector query for relevant technical domains."
                )
        elif any(w in lower_msg for w in ["search", "find", "role", "job", "intern", "developer", "engineer", "ml", "ai", "python"]):
            res = search_job_listings(query=user_msg_text)
            executed_tool_calls.append(AgentToolCallInfo(tool_name="search_job_listings", tool_input={"query": user_msg_text}, tool_output=res))
            results = res.get("results", [])
            if results:
                rows = "\n".join([f"• **{j['title']}** at {j['company']} ({j['location']}) — Match Score: {int(j['score'] * 100)}%" for j in results])
                final_response_text = f"Here are the top matching opportunities for **'{user_msg_text}'**:\n\n{rows}"
            else:
                final_response_text = f"No active listings found matching '{user_msg_text}'."
        else:
            # Only show greeting if the message is strictly a greeting
            if any(g in lower_msg for g in ["hi", "hello", "hey", "who are you"]):
                final_response_text = (
                    "Hello! I am **NEXUS**, your autonomous career intelligence copilot. "
                    "I'm synchronized with your database of indexed job listings, resumes, and application deadlines. "
                    "How can I help you accelerate your job search today?"
                )
            else:
                # Default catch-all: run semantic search on user message
                res = search_job_listings(query=user_msg_text)
                executed_tool_calls.append(AgentToolCallInfo(tool_name="search_job_listings", tool_input={"query": user_msg_text}, tool_output=res))
                results = res.get("results", [])
                if results:
                    rows = "\n".join([f"• **{j['title']}** at {j['company']} ({j['location']}) — Match Score: {int(j['score'] * 100)}%" for j in results])
                    final_response_text = f"I retrieved these roles relevant to your query:\n\n{rows}"
                else:
                    final_response_text = f"I couldn't find matching roles for '{user_msg_text}'. Try specifying skills or locations."

    # 5. Persist Conversational Turn to SQLite/PostgreSQL
    try:
        user_turn = ChatMessage(
            user_id=current_user.id,
            role="user",
            content=user_msg_text,
            tool_calls="[]"
        )
        model_turn = ChatMessage(
            user_id=current_user.id,
            role="model",
            content=final_response_text,
            tool_calls=json.dumps([t.dict() for t in executed_tool_calls])
        )
        db.add(user_turn)
        db.add(model_turn)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Chat History Persist Error] {e}")

    return AgentChatResponse(response=final_response_text, tool_calls=executed_tool_calls)

@router.get("/agent/history")
def get_agent_chat_history(
    current_user: User = Depends(get_current_user_authenticated),
    db: Session = Depends(get_db)
):
    """
    Retrieves persistent multi-turn conversation history for the authenticated user.
    """
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "tool_calls": json.loads(m.tool_calls or "[]"),
            "created_at": m.created_at
        }
        for m in msgs
    ]
