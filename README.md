# CosmosPapers

**[cosmospapers.com](https://cosmospapers.com/)** | **[Discord](https://discord.com/invite/jumjZZVB)**

CosmosPapers is a full-stack research paper aggregation and discovery platform. It scrapes, indexes, and surfaces accepted papers from 15+ top-tier AI, Machine Learning, Computer Vision, and Security conferences spanning 2022 to 2026.

The platform provides semantic search powered by pgvector embeddings, interactive topic modeling and trend analysis via BERTopic, and a built-in AI Copilot for paper summarization, Q&A, and BibTeX generation — all driven by the user's own API key through NVIDIA NIM or Microsoft AI Foundry.

---

## Features

### Paper Aggregation
- **15+ Conference Scrapers** — CVPR, NeurIPS, ICLR, ICML, ICCV, ECCV, ACM CCS, ACM CHI, USENIX Security, IEEE S&P, IEEE VIS, NDSS, SIGGRAPH, and more.
- **54,000+ Papers** — Pre-built database dump available for instant setup.
- **Selective Scraping** — Update individual conferences on demand from the admin panel.
- **Automatic Tagging** — Identifies short papers, posters, and demos by page count analysis.

### Search and Discovery
- **Semantic Search** — Find papers by meaning, not just keywords, using BAAI/bge-base-en-v1.5 embeddings stored in pgvector.
- **Keyword Filtering** — Filter by conference, year, and free-text search.
- **Bookmarks** — Anonymous, browser-cached bookmarking system with personalized recommendations via cosine similarity.
- **Top Papers** — Curated selection of high-impact papers highlighted with badges.

### Trend Analysis
- **BERTopic Clustering** — 150 hierarchical research topics extracted from paper abstracts.
- **Interactive Visualizations** — Radar charts, stream graphs, and topic breakdowns by year and conference.
- **Searchable Topic Explorer** — Drill into any topic to see its constituent papers and evolution over time.

### AI Copilot (Bring Your Own Key)
- **Paper Summarization** — Upload or select a paper and get an AI-generated summary.
- **Contextual Q&A** — Ask questions about specific papers and get grounded answers.
- **BibTeX Generation** — Generate formatted citations from paper metadata.
- **Multi-Provider Support** — Works with NVIDIA NIM and Microsoft AI Foundry models.
- **Free API Keys** — Get free LLM API keys from [build.nvidia.com](https://build.nvidia.com) (NVIDIA NIM) and [Azure AI Foundry](https://ai.azure.com) (Microsoft).
- **Privacy-First** — API keys are stored locally in the browser and never transmitted to our servers.

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|--------------------------------------------------|
| Frontend    | Next.js 16, React 19, TypeScript                |
| Backend     | Python, FastAPI, Uvicorn                         |
| Database    | PostgreSQL with pgvector extension               |
| AI Routing  | LiteLLM (multi-provider LLM gateway)            |
| Embeddings  | BAAI/bge-base-en-v1.5 via sentence-transformers |
| Topic Model | BERTopic                                         |
| Deployment  | Docker Compose, Oracle Cloud                     |

---

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 20+
- PostgreSQL 15+ with the `pgvector` extension
- Docker and Docker Compose (optional, for containerized deployment)

### 1. Clone the Repository

```bash
git clone https://github.com/RunWang123/cosmospaper.git
cd cosmospaper
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your database credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=postgresql://<your_user>:<your_password>@localhost:5432/<your_database>
```

### 3. Set Up the Backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Set Up the Database

**Option A: Use the pre-built database dump (recommended)**

Download the database dump from Google Drive (link below), then restore it:

```bash
createdb -U <your_user> <your_database>
pg_restore -U <your_user> -d <your_database> cosmospaper_db.dump
```

This will load all 54,000+ papers instantly.

**Option B: Start fresh and scrape**

```bash
python -m uvicorn main:app --port 8000
```

Then use the admin panel to trigger scraping for each conference. This may take several hours depending on your network speed.

### 5. Set Up the Frontend

```bash
cd frontend
npm install
npm run dev
```

### 6. Access the Application

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

---

## Database Dump

A pre-populated PostgreSQL dump with 54,000+ papers is available for download:

**[Download cosmospaper_db.dump](https://drive.google.com/file/d/18oByehfGdHiCvhOQFrF-9sjxeyZqRxU3/view?usp=sharing)** (approx. 230 MB)

To restore:

```bash
pg_restore --no-owner --no-privileges -U <your_user> -d <your_database> cosmospaper_db.dump
```

Make sure PostgreSQL is running and the `pgvector` extension is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Project Structure

```
cosmospaper/
├── main.py                  # FastAPI application and API endpoints
├── scanner.py               # Core scraping orchestration logic
├── embeddings.py            # Embedding generation using sentence-transformers
├── vectorize_papers.py      # Batch vectorization of paper abstracts
├── requirements.txt         # Python dependencies
│
├── database/
│   └── __init__.py          # SQLAlchemy models (Paper, TopicInfo, etc.)
│
├── scrapers/                # Conference-specific scraping modules
│   ├── base.py              # Abstract base scraper class
│   ├── cvpr.py
│   ├── neurips.py
│   ├── iclr.py
│   ├── icml.py
│   ├── iccv.py
│   ├── eccv.py
│   ├── acm_ccs.py
│   ├── acm_chi.py
│   ├── usenix_security.py
│   ├── ieee_sp.py
│   ├── ieee_vis.py
│   ├── ndss.py
│   └── siggraph.py
│
├── scripts/
│   ├── run_bertopic.py      # BERTopic pipeline for topic modeling
│   └── backfill_arxiv.py    # Backfill abstracts from arXiv
│
├── config/
│   └── conferences.json     # Conference URLs and scraper configuration
│
├── frontend/                # Next.js frontend application
│   ├── src/
│   │   ├── app/             # Pages (home, bookmarks, trends)
│   │   ├── components/      # React components (PaperCard, Navbar, CopilotChat)
│   │   └── hooks/           # Custom hooks (useBookmarks)
│   ├── package.json
│   └── next.config.ts
│
├── docker-compose.yml       # Docker Compose for production deployment
├── Dockerfile               # Backend Docker image
└── architecture.md          # System architecture diagram
```

---

## Docker Deployment

For production deployment using Docker Compose:

```bash
docker-compose build
docker-compose up -d
```

This starts the backend, frontend, and PostgreSQL containers. See `DEPLOYMENT_ORACLE.md` for detailed Oracle Cloud deployment instructions.

---

## Supported Conferences

| Conference       | Years Covered | Source         |
|------------------|---------------|----------------|
| CVPR             | 2022 - 2025   | OpenAccess     |
| NeurIPS          | 2022 - 2024   | Proceedings    |
| ICLR             | 2022 - 2025   | OpenReview     |
| ICML             | 2022 - 2024   | Proceedings    |
| ICCV             | 2023          | OpenAccess     |
| ECCV             | 2022, 2024    | ECVA           |
| ACM CCS          | 2022 - 2024   | ACM DL         |
| ACM CHI          | 2022 - 2025   | ACM DL         |
| USENIX Security  | 2022 - 2024   | DBLP           |
| IEEE S&P         | 2022 - 2025   | IEEE           |
| IEEE VIS         | 2022 - 2024   | IEEE           |
| NDSS             | 2022 - 2025   | NDSS           |
| SIGGRAPH         | 2022 - 2025   | ACM DL         |

---

## API Endpoints

| Method | Endpoint                         | Description                          |
|--------|----------------------------------|--------------------------------------|
| GET    | `/api/papers`                    | List papers with filtering           |
| GET    | `/api/papers/search`             | Semantic search using embeddings     |
| GET    | `/api/papers/{id}`               | Get paper by ID                      |
| POST   | `/api/copilot/chat`              | AI Copilot chat endpoint             |
| POST   | `/api/copilot/summarize-pdf`     | Summarize a paper via AI             |
| POST   | `/api/copilot/generate-bibtex`   | Generate BibTeX citations            |
| GET    | `/api/trends/topics`             | Get BERTopic topic list              |
| GET    | `/api/trends/topic-trends`       | Get topic trends over time           |
| GET    | `/api/recommendations`           | Get paper recommendations            |

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change. For major changes, include a description of the problem and your proposed solution.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
