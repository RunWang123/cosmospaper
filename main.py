from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import SessionLocal, Paper, init_db, IS_POSTGRES
from scanner import Scanner
from starlette.requests import Request
from typing import Optional, List
from fastapi import Query
import json
import os
from pydantic import BaseModel
import fitz
from openai import AzureOpenAI
import requests
import io

class CopilotSearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 3

class CopilotSummarizeRequest(BaseModel):
    paper_id: str
    query: str

class CopilotBibtexRequest(BaseModel):
    paper_ids: List[str]

# Import embedding functions only if PostgreSQL is available
if IS_POSTGRES:
    from embeddings import generate_embedding, create_paper_embedding_text


from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Rate limiter - uses client IP address
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Paper Aggregator")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Startup
@app.on_event("startup")
def on_startup():
    init_db()
    # Configure logging to write to file
    import logging
    file_handler = logging.FileHandler("scraper.log", mode='w')
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    
    # Get the root logger or scanner logger
    root_logger = logging.getLogger()
    root_logger.addHandler(file_handler)
    root_logger.setLevel(logging.INFO)
    
    # Explicitly add to scanner and scrapers loggers to ensure capture
    logging.getLogger("scanner").addHandler(file_handler)
    logging.getLogger("scrapers").addHandler(file_handler)
    logging.getLogger("uvicorn").addHandler(file_handler) # Optional: capture server logs too

@app.get("/api/logs")
async def get_logs():
    """Returns the last 100 lines of the scraper log."""
    try:
        with open("scraper.log", "r") as f:
            lines = f.readlines()
            return {"logs": lines[-100:]} # Return last 100 lines
    except FileNotFoundError:
        return {"logs": ["Log file not found."]}

@app.get("/api/search")
async def search_papers(
    db: Session = Depends(get_db), 
    q: Optional[str] = None,
    min_year: Optional[str] = None,
    max_year: Optional[str] = None,
    conferences: Optional[List[str]] = Query(None),
    top_only: bool = Query(False, description="Filter to show only top/awarded papers (Oral, Spotlight, etc.)"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100)
):
    """
    Search papers with filters. Returns JSON for the Next.js frontend.
    """
    query = db.query(Paper).order_by(Paper.id.desc())
    
    # Text Search
    if q:
        search = f"%{q}%"
        query = query.filter(
            (Paper.title.ilike(search)) | 
            (Paper.authors.ilike(search)) | 
            (Paper.conference.ilike(search))
        )
    
    # Year Filter
    if min_year and min_year.strip():
        try:
            query = query.filter(Paper.year >= int(min_year))
        except ValueError:
            pass
            
    if max_year and max_year.strip():
        try:
            query = query.filter(Paper.year <= int(max_year))
        except ValueError:
            pass
        
    # Conference Filter
    if conferences:
        query = query.filter(Paper.conference.in_(conferences))
    
    # Top Papers Filter
    if top_only:
        query = query.filter(Paper.tags.isnot(None), Paper.tags != "")
    
    # Get total count
    total_count = query.count()
    
    # Pagination
    total_pages = (total_count + limit - 1) // limit
    offset = (page - 1) * limit
    
    # Fetch papers
    papers = query.offset(offset).limit(limit).all()
    
    # Serialize papers to JSON-safe dicts (exclude embedding vector)
    papers_json = []
    for p in papers:
        papers_json.append({
            "id": p.id,
            "title": p.title,
            "authors": p.authors,
            "conference": p.conference,
            "year": p.year,
            "url": p.url,
            "pdf_url": p.pdf_url,
            "tags": p.tags,
        })
    
    return {
        "papers": papers_json,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

class BatchRequest(BaseModel):
    ids: List[str]

@app.post("/api/papers/batch")
async def get_papers_batch(
    req: BatchRequest,
    db: Session = Depends(get_db)
):
    """Fetch full paper details for a list of string IDs."""
    if not req.ids:
        return {"papers": []}
    
    try:
        int_ids = [int(i) for i in req.ids]
    except ValueError:
        return {"papers": []}
        
    papers = db.query(Paper).filter(Paper.id.in_(int_ids)).all()
    
    papers_json = []
    for p in papers:
        papers_json.append({
            "id": p.id,
            "title": p.title,
            "authors": p.authors,
            "conference": p.conference,
            "year": p.year,
            "url": p.url,
            "pdf_url": p.pdf_url,
            "tags": p.tags,
        })
    return {"papers": papers_json}

@app.post("/api/recommendations")
async def get_recommendations(
    req: BatchRequest,
    db: Session = Depends(get_db)
):
    """
    Generate recommendations based on bookmarked papers using pgvector similarity.
    Calculates the average embedding of bookmarked papers and finds K nearest neighbors.
    """
    if not IS_POSTGRES:
        raise HTTPException(status_code=501, detail="Vector search requires PostgreSQL with pgvector")
        
    if not req.ids:
        return {"papers": []}
        
    try:
        int_ids = [int(i) for i in req.ids]
    except ValueError:
        return {"papers": []}
        
    # Get the embedding vector representation for the bookmarks
    rows = db.execute(text("""
        SELECT embedding FROM papers 
        WHERE id = ANY(:ids) AND embedding IS NOT NULL
    """), {"ids": int_ids}).fetchall()
    
    if not rows:
        return {"papers": []}
        
    embeddings = [r[0] for r in rows if r[0]]
    if not embeddings:
        return {"papers": []}
        
    parsed_embeddings = []
    for emb in embeddings:
        if isinstance(emb, str):
            try:
                parsed_embeddings.append(json.loads(emb))
            except:
                pass
        elif isinstance(emb, list):
            parsed_embeddings.append(emb)
    
    if not parsed_embeddings:
        return {"papers": []}
        
    dims = len(parsed_embeddings[0])
    avg_emb = [0.0] * dims
    
    for vec in parsed_embeddings:
        for i in range(dims):
            avg_emb[i] += vec[i]
            
    for i in range(dims):
        avg_emb[i] /= len(parsed_embeddings)
        
    avg_emb_str = "[" + ",".join(map(str, avg_emb)) + "]"
    
    rec_rows = db.execute(text("""
        SELECT id, title, authors, conference, year, url, pdf_url, tags,
               1 - (embedding <=> CAST(:avg_emb AS vector)) as similarity
        FROM papers
        WHERE id != ALL(:ids) AND embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:avg_emb AS vector)
        LIMIT 10
    """), {"avg_emb": avg_emb_str, "ids": int_ids}).fetchall()
    
    papers_json = []
    for r in rec_rows:
        papers_json.append({
            "id": r.id,
            "title": r.title,
            "authors": r.authors,
            "conference": r.conference,
            "year": r.year,
            "url": r.url,
            "pdf_url": r.pdf_url,
            "tags": r.tags,
            "similarity": r.similarity * 100 if r.similarity else None
        })
        
    return {"papers": papers_json}

@app.get("/", response_class=HTMLResponse)
async def read_root(
    request: Request, 
    db: Session = Depends(get_db), 
    q: Optional[str] = None,
    min_year: Optional[str] = None, # changed to str to handle empty string form submission
    max_year: Optional[str] = None,
    conferences: Optional[List[str]] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=500)
):
    # Keep existing HTML endpoint for fallback/comparison
    query = db.query(Paper).order_by(Paper.id.desc())
    
    # Text Search
    if q:
        search = f"%{q}%"
        query = query.filter(
            (Paper.title.ilike(search)) | 
            (Paper.authors.ilike(search)) | 
            (Paper.conference.ilike(search))
        )
    
    # Year Filter
    if min_year and min_year.strip():
        try:
            query = query.filter(Paper.year >= int(min_year))
        except ValueError:
            pass # Ignore invalid int
            
    if max_year and max_year.strip():
        try:
            query = query.filter(Paper.year <= int(max_year))
        except ValueError:
            pass # Ignore invalid int
        
    # Conference Filter
    if conferences:
        # conferences comes as a list e.g. ["CVPR 2025", "NDSS 2025"]
        query = query.filter(Paper.conference.in_(conferences))
    
    # Get total filtered count
    total_count = query.count()
    
    # Pagination
    total_pages = (total_count + limit - 1) // limit
    offset = (page - 1) * limit
    
    # Apply limit for display
    papers = query.offset(offset).limit(limit).all()
    
    # Get available conferences and years for the filter UI
    # We can cache this or query distinct values
    all_confs = db.query(Paper.conference).distinct().all()
    all_confs = [c[0] for c in all_confs if c[0]]
    
    # Load all configured conferences from conferences.json for the update modal
    configured_confs = []
    try:
        with open("config/conferences.json", "r") as f:
            conf_config = json.load(f)
            configured_confs = sorted(conf_config.keys())
    except Exception:
        pass  # If loading fails, just use empty list
    
    return templates.TemplateResponse("index.html", {
        "request": request, 
        "papers": papers, 
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "query": q,
        "all_confs": sorted(all_confs),
        "configured_confs": configured_confs,
        "selected_confs": conferences or [],
        "min_year": min_year,
        "max_year": max_year
    })

@app.post("/api/refresh")
@limiter.limit("5/minute")
async def refresh_data(
    request: Request,
    background_tasks: BackgroundTasks, 
    conf: Optional[str] = Query(None),
    fetch_abstracts: bool = Query(True, description="Fetch abstracts from paper detail pages (default: True for semantic search)")
):
    """
    Trigger a scraper update.
    conf: Optional comma-separated list of conferences to update (e.g. "CVPR,ICCV").
          If None, updates all.
    fetch_abstracts: Fetches abstracts for semantic search (default True). Set to False for faster title-only scraping.
    """
    scanner = Scanner()
    target_confs = None
    if conf:
        target_confs = [c.strip() for c in conf.split(",") if c.strip()]
        
    background_tasks.add_task(scanner.run, target_confs=target_confs, fetch_abstracts=fetch_abstracts)
    msg = f"Update started for {target_confs or 'all conferences'}"
    if not fetch_abstracts:
        msg += " (fast mode - no abstracts)"
    else:
        msg += " (with abstracts for semantic search)"
    return {"message": msg}

@app.get("/api/papers")
def get_papers_api(db: Session = Depends(get_db)):
    return db.query(Paper).limit(500).all()


@app.get("/api/semantic-search")
async def semantic_search(
    q: str = Query(..., description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    min_year: Optional[int] = None,
    max_year: Optional[int] = None,
    conferences: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Semantic search for papers using vector similarity.
    Returns papers ranked by semantic similarity to the query.
    """
    if not IS_POSTGRES:
        raise HTTPException(
            status_code=501,
            detail="Semantic search requires PostgreSQL with pgvector"
        )
    
    # Generate embedding for the query
    query_embedding = generate_embedding(q)
    
    # Build the SQL query with filters
    filters = []
    params = {"limit": limit}
    
    if min_year:
        filters.append("year >= :min_year")
        params["min_year"] = min_year
    
    if max_year:
        filters.append("year <= :max_year")
        params["max_year"] = max_year
    
    if conferences:
        filters.append("conference = ANY(:conferences)")
        params["conferences"] = conferences
    
    where_clause = ""
    if filters:
        where_clause = "WHERE embedding IS NOT NULL AND " + " AND ".join(filters)
    else:
        where_clause = "WHERE embedding IS NOT NULL"
    
    # Convert embedding to string for SQL injection (safe - generated internally, not user input)
    embedding_str = str(query_embedding)
    
    # Use pgvector's <=> operator for cosine distance
    sql = text(f"""
        SELECT 
            id, title, authors, conference, year, url, pdf_url, tags,
            1 - (embedding <=> '{embedding_str}'::vector) as similarity
        FROM papers
        {where_clause}
        ORDER BY embedding <=> '{embedding_str}'::vector
        LIMIT :limit
    """)
    
    result = db.execute(sql, params)
    papers = []
    for row in result:
        papers.append({
            "id": row.id,
            "title": row.title,
            "authors": row.authors,
            "conference": row.conference,
            "year": row.year,
            "url": row.url,
            "pdf_url": row.pdf_url,
            "tags": row.tags,
            "similarity": round(row.similarity * 100, 1)  # Convert to percentage
        })
    
    return {
        "query": q,
        "count": len(papers),
        "papers": papers
    }


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get database statistics including embedding coverage."""
    total_papers = db.query(Paper).count()
    
    stats = {
        "total_papers": total_papers,
        "is_postgres": IS_POSTGRES,
    }
    
    if IS_POSTGRES:
        # Count papers with embeddings
        embedded_count = db.execute(
            text("SELECT COUNT(*) FROM papers WHERE embedding IS NOT NULL")
        ).scalar()
        stats["papers_with_embeddings"] = embedded_count
        stats["embedding_coverage"] = round(embedded_count / total_papers * 100, 1) if total_papers > 0 else 0
    
    return stats


# Curated keyword list for trend analysis
TREND_KEYWORDS = [
    "transformer", "diffusion", "LLM", "large language model",
    "GAN", "generative adversarial", "contrastive learning",
    "self-supervised", "vision transformer", "ViT",
    "graph neural network", "federated learning",
    "reinforcement learning", "RLHF", "neural radiance field", "NeRF",
    "object detection", "semantic segmentation", "knowledge distillation",
    "multimodal", "zero-shot", "few-shot", "prompt",
    "attention mechanism", "adversarial attack",
    "image generation", "text-to-image", "3d reconstruction",
    "point cloud", "video understanding", "depth estimation",
    "domain adaptation", "data augmentation",
]


@app.get("/api/trends/keywords")
async def trends_keywords(
    db: Session = Depends(get_db),
    keywords: Optional[str] = None,
    min_year: Optional[int] = None,
    max_year: Optional[int] = None,
):
    """
    Returns paper counts per year for each keyword using a single batch query.
    """
    kw_list = [k.strip() for k in keywords.split(",")] if keywords else TREND_KEYWORDS

    # Build a single query with CASE WHEN for each keyword
    case_clauses = []
    params = {}
    for i, kw in enumerate(kw_list):
        param_name = f"kw_{i}"
        case_clauses.append(
            f"SUM(CASE WHEN (p.title ILIKE :{param_name} OR p.abstract ILIKE :{param_name}) THEN 1 ELSE 0 END) AS kw_{i}"
        )
        params[param_name] = f"%{kw}%"

    year_filter = "WHERE p.year IS NOT NULL"
    if min_year:
        year_filter += " AND p.year >= :min_year"
        params["min_year"] = min_year
    if max_year:
        year_filter += " AND p.year <= :max_year"
        params["max_year"] = max_year

    sql = f"""
        SELECT p.year, {', '.join(case_clauses)}
        FROM papers p
        {year_filter}
        GROUP BY p.year
        ORDER BY p.year
    """

    rows = db.execute(text(sql), params).fetchall()

    results = []
    for i, kw in enumerate(kw_list):
        data = []
        for row in rows:
            count = row[i + 1]  # +1 because index 0 is year
            if count and count > 0:
                data.append({"year": row[0], "count": count})
        if data:
            results.append({"keyword": kw, "data": data})

    return {"trends": results, "available_keywords": TREND_KEYWORDS}


@app.get("/api/trends/conferences")
async def trends_conferences(
    db: Session = Depends(get_db),
    keywords: Optional[str] = None,
):
    """
    Returns keyword counts grouped by conference using a single batch query.
    """
    kw_list = [k.strip() for k in keywords.split(",")] if keywords else TREND_KEYWORDS[:10]

    case_clauses = []
    params = {}
    for i, kw in enumerate(kw_list):
        param_name = f"kw_{i}"
        case_clauses.append(
            f"SUM(CASE WHEN (p.title ILIKE :{param_name} OR p.abstract ILIKE :{param_name}) THEN 1 ELSE 0 END) AS kw_{i}"
        )
        params[param_name] = f"%{kw}%"

    sql = f"""
        SELECT p.conference, {', '.join(case_clauses)}
        FROM papers p
        WHERE p.conference IS NOT NULL
        GROUP BY p.conference
        ORDER BY p.conference
    """

    rows = db.execute(text(sql), params).fetchall()

    results = {}
    for row in rows:
        conf = row[0]
        conf_data = {}
        for i, kw in enumerate(kw_list):
            count = row[i + 1]
            if count and count > 0:
                conf_data[kw] = count
        if conf_data:
            results[conf] = conf_data

    return {"conferences": results}


# ── BERTopic-powered endpoints (read from pre-computed tables) ─────

@app.get("/api/trends/topics")
async def trends_topics(db: Session = Depends(get_db)):
    """
    Returns all BERTopic-discovered topics with labels and paper counts.
    """
    try:
        rows = db.execute(text("""
            SELECT topic_id, label, words, count
            FROM topics.topic_info
            ORDER BY count DESC
        """)).fetchall()
        return {
            "topics": [
                {"topic_id": r[0], "label": r[1], "words": r[2], "count": r[3]}
                for r in rows
            ]
        }
    except Exception:
        return {"topics": [], "error": "BERTopic not yet run. Execute scripts/run_bertopic.py first."}


@app.get("/api/trends/topics/over-time")
async def trends_topics_over_time(
    db: Session = Depends(get_db),
    top_n: int = Query(10, ge=1, le=50),
    keywords: Optional[str] = Query(None, description="Comma-separated list of exact topic labels to filter by"),
):
    """
    Returns topic counts per year (for stream graph).
    Pre-computed by BERTopic — responds instantly.
    """
    try:
        if keywords:
            kw_list = [k.strip() for k in keywords.split(",")]
            # Fetch specific topics requested by user
            top_topics = db.execute(text("""
                SELECT topic_id FROM topics.topic_info
                WHERE label = ANY(:kws)
            """), {"kws": kw_list}).fetchall()
        else:
            # Fallback to Top N
            top_topics = db.execute(text("""
                SELECT topic_id FROM topics.topic_info
                ORDER BY count DESC LIMIT :n
            """), {"n": top_n}).fetchall()
            
        top_ids = [r[0] for r in top_topics]
        
        if not top_ids:
            return {"trends": []}
        
        # Get yearly data for top topics
        rows = db.execute(text("""
            SELECT topic_id, year, count, label
            FROM topics.topic_trends
            WHERE topic_id = ANY(:ids)
            ORDER BY topic_id, year
        """), {"ids": top_ids}).fetchall()
        
        # Group by topic
        from collections import defaultdict
        topic_data = defaultdict(list)
        topic_labels = {}
        for r in rows:
            topic_data[r[0]].append({"year": r[1], "count": r[2]})
            topic_labels[r[0]] = r[3]
        
        results = [
            {"keyword": topic_labels.get(tid, f"Topic {tid}"), "data": data}
            for tid, data in topic_data.items()
        ]
        
        # Build available keywords from all topic labels
        all_labels = db.execute(text(
            "SELECT label FROM topics.topic_info ORDER BY count DESC"
        )).fetchall()
        
        return {
            "trends": results,
            "available_keywords": [r[0] for r in all_labels],
        }
    except Exception:
        return {"trends": [], "available_keywords": [], "error": "BERTopic not yet run."}


@app.get("/api/trends/topics/by-conference")
async def trends_topics_by_conference(
    db: Session = Depends(get_db),
    top_n: int = Query(10, ge=1, le=50),
    keywords: Optional[str] = Query(None, description="Comma-separated list of exact topic labels to filter by"),
):
    """
    Returns topic counts grouped by conference (for radar chart).
    Pre-computed by BERTopic — responds instantly.
    """
    try:
        if keywords:
            kw_list = [k.strip() for k in keywords.split(",")]
            top_topics = db.execute(text("""
                SELECT topic_id FROM topics.topic_info
                WHERE label = ANY(:kws)
            """), {"kws": kw_list}).fetchall()
        else:
            top_topics = db.execute(text("""
                SELECT topic_id FROM topics.topic_info
                ORDER BY count DESC LIMIT :n
            """), {"n": top_n}).fetchall()
            
        top_ids = [r[0] for r in top_topics]
        
        if not top_ids:
            return {"conferences": {}}
        
        rows = db.execute(text("""
            SELECT conference, label, count
            FROM topics.topic_conferences
            WHERE topic_id = ANY(:ids)
            ORDER BY conference, count DESC
        """), {"ids": top_ids}).fetchall()
        
        results = {}
        for r in rows:
            conf = r[0]
            if conf not in results:
                results[conf] = {}
            results[conf][r[1]] = r[2]
        
        return {"conferences": results}
    except Exception:
        return {"conferences": {}, "error": "BERTopic not yet run."}

# ── Copilot Studio Endpoints ─────────────────────────────────────

@app.post("/api/copilot/search")
@limiter.limit("20/minute")
async def copilot_search(request: Request, req: CopilotSearchRequest, db: Session = Depends(get_db)):
    """Search papers for Microsoft Copilot Studio using pgvector."""
    if not IS_POSTGRES:
        raise HTTPException(status_code=501, detail="Requires pgvector")
    
    query_emb = generate_embedding(req.query)
    
    rows = db.execute(text("""
        SELECT id, title, authors, abstract, conference, year 
        FROM papers 
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> :query_emb
        LIMIT :limit
    """), {"query_emb": str(query_emb), "limit": req.limit}).fetchall()
    
    results = []
    for r in rows:
        results.append({
            "id": str(r[0]),
            "title": r[1],
            "authors": r[2],
            "abstract": r[3],
            "conference": r[4],
            "year": r[5]
        })
    return {"papers": results}

@app.post("/api/copilot/summarize-pdf")
@limiter.limit("10/minute")
async def copilot_summarize_pdf(request: Request, req: CopilotSummarizeRequest, db: Session = Depends(get_db)):
    """Downloads PDF, parses it, and uses Azure OpenAI to answer a query.
    Falls back to abstract-based summarization when PDF is unavailable."""
    paper = db.query(Paper).filter(Paper.id == int(req.paper_id)).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    full_text = None

    # Try to get PDF text if pdf_url exists
    if paper.pdf_url:
        try:
            response = requests.get(paper.pdf_url, stream=True, timeout=15)
            response.raise_for_status()
            pdf_bytes = io.BytesIO(response.content)
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            full_text = ""
            for page in doc:
                full_text += page.get_text()
            full_text = full_text[:100000]
        except Exception:
            full_text = None  # Fall through to abstract

    # Fallback: use abstract + metadata
    if not full_text:
        parts = []
        parts.append(f"Title: {paper.title}")
        if paper.authors:
            parts.append(f"Authors: {paper.authors}")
        if paper.conference:
            parts.append(f"Conference: {paper.conference}")
        if paper.year:
            parts.append(f"Year: {paper.year}")
        if paper.abstract:
            parts.append(f"\nAbstract:\n{paper.abstract}")
        if paper.url:
            parts.append(f"\nPaper URL: {paper.url}")
        full_text = "\n".join(parts)

        if not paper.abstract:
            full_text += "\n\n(Note: Full PDF and abstract are not available. Provide the best analysis based on the title and metadata.)"

    try:
        client = AzureOpenAI(
            api_key=os.environ.get("AZURE_OPENAI_API_KEY", "dummy"),
            api_version="2024-02-15-preview",
            azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT", "https://your-azure-endpoint.openai.azure.com/")
        )
        
        system_prompt = "You are an expert researcher. Read the following academic paper information and answer the user's query perfectly. Give your response in Markdown format. If only metadata/abstract is available (no full text), provide the best analysis you can based on what is given."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Paper Information:\n{full_text}\n\nQuery: {req.query}"}
        ]
        
        completion = client.chat.completions.create(
            model="gpt-4o-mini-model",
            messages=messages,
            max_tokens=1000
        )
        
        return {"summary": completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/copilot/generate-bibtex")
@limiter.limit("10/minute")
async def copilot_generate_bibtex(request: Request, req: CopilotBibtexRequest, db: Session = Depends(get_db)):
    """Generates perfect BibTeX citations using Azure OpenAI."""
    if not req.paper_ids:
        return {"bibtex": ""}
        
    try:
        int_ids = [int(i) for i in req.paper_ids]
    except ValueError:
        return {"bibtex": ""}
        
    papers = db.query(Paper).filter(Paper.id.in_(int_ids)).all()
    if not papers:
        return {"bibtex": ""}
        
    paper_metadata = ""
    for p in papers:
        paper_metadata += f"Title: {p.title}\nAuthors: {p.authors}\nConference: {p.conference}\nYear: {p.year}\n\n"
        
    try:
        client = AzureOpenAI(
            api_key=os.environ.get("AZURE_OPENAI_API_KEY", "dummy"),
            api_version="2024-02-15-preview",
            azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT", "https://your-azure-endpoint.openai.azure.com/")
        )
        
        system_prompt = "You are an academic citation generator. Take the following metadata and return ONLY perfectly formatted BibTeX citations."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Metadata:\n{paper_metadata}"}
        ]
        
        completion = client.chat.completions.create(
            model="gpt-4o-mini-model",
            messages=messages,
            max_tokens=1000
        )
        
        return {"bibtex": completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import argparse
    import uvicorn
    import sys

    parser = argparse.ArgumentParser(description="Paper Aggregator & Scraper")
    parser.add_argument("--conference", type=str, help="Run scraper for specific conference (e.g. CVPR)")
    parser.add_argument("--year", type=int, help="Run scraper for specific year (e.g. 2024)")
    parser.add_argument("--serve", action="store_true", help="Run the web server")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host for web server")
    parser.add_argument("--port", type=int, default=8000, help="Port for web server")
    
    args = parser.parse_args()
    
    # If no arguments provided, check if we want to default to something
    if len(sys.argv) == 1:
        print("No arguments provided. Running web server...")
        uvicorn.run("main:app", host=args.host, port=args.port, reload=True)
        
    elif args.conference:
        # Run scraper mode
        print(f"Starting Scraper for {args.conference} {args.year or ''}...")
        
        # Initialize DB
        try:
            init_db()
        except Exception as e:
            print(f"DB Init Warning: {e}")
            
        scanner = Scanner()
        
        target_conf = args.conference
        if target_conf not in scanner.config:
            print(f"Error: Conference '{target_conf}' not found in configuration.")
            sys.exit(1)
            
        if args.year:
            year_str = str(args.year)
            # Patch config for specific year target
            # Use existing URL from config if available, else standard fallback
            
            # Since ICLR scraper handles year internally, we just need to ensure 
            # scanner iterates safely.
            
            # Simple approach: Create a temporary single-entry config
            # scanner.config is {Conf: {scraper:..., years:{...}}}
            
            existing_years = scanner.config[target_conf].get("years", {})
            
            # If the year is not in config, we can add it (needed for ICLR 2024 JSON call maybe?)
            # ICLR scraper calls self.scrape_from_json(self.year) independent of URL
            # but base scraper needs a URL to pass to scrape()
            
            url = existing_years.get(year_str, f"https://override-for-{year_str}")
            
            # Override config to just this one entry
            scanner.config = {
                target_conf: {
                    "scraper": scanner.config[target_conf]["scraper"],
                    "years": {year_str: url}
                }
            }
        else:
            # Run all configured years for this conference
            scanner.config = {target_conf: scanner.config[target_conf]}
            
        scanner.run(target_confs=[target_conf])
        print("Scrape run complete.")
        
    elif args.serve:
        uvicorn.run("main:app", host=args.host, port=args.port, reload=True)
