# CosmosPapers

**[cosmospapers.com](https://cosmospapers.com/)** | **[Discord](https://discord.com/invite/jumjZZVB)**

CosmosPapers is a full-stack research paper aggregation and discovery platform. It scrapes, indexes, and surfaces accepted papers from 15+ top-tier AI, Machine Learning, Computer Vision, and Security conferences spanning 2022 to 2026.

The platform provides semantic search powered by pgvector embeddings, interactive topic modeling and trend analysis via BERTopic, and a built-in AI Copilot for paper summarization, Q&A, and BibTeX generation — all driven by the user's own API key through NVIDIA NIM or Microsoft AI Foundry.

---

## Features

- **15+ Conference Scrapers** — CVPR, NeurIPS, ICLR, ICML, ICCV, ECCV, ACM CCS, ACM CHI, USENIX Security, IEEE S&P, IEEE VIS, NDSS, SIGGRAPH, and more.
- **54,000+ Papers** — Pre-built database dump available for instant setup.
- **Semantic Search** — Find papers by meaning using BAAI/bge-base-en-v1.5 embeddings in pgvector.
- **BERTopic Trend Analysis** — 150 hierarchical research topics with interactive visualizations.
- **AI Copilot** — Paper summarization, Q&A, and BibTeX generation (bring your own key).
- **Free API Keys** — Get free LLM API keys from [build.nvidia.com](https://build.nvidia.com) (NVIDIA NIM) and [Azure AI Foundry](https://ai.azure.com) (Microsoft).
- **Bookmarks & Recommendations** — Browser-cached bookmarks with personalized suggestions via cosine similarity.

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

## Quick Start

```bash
git clone https://github.com/RunWang123/cosmospaper.git
cd cosmospaper
cp .env.example .env        # configure DATABASE_URL
pip install -r requirements.txt
python -m uvicorn main:app --port 8000

cd frontend
npm install && npm run dev
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

For detailed setup instructions, see the docs in each folder below.

---

## Project Structure

| Folder | Description | Docs |
|--------|-------------|------|
| [`database/`](database/) | SQLAlchemy models, pgvector setup, DB dump | [database/README.md](database/README.md) |
| [`scrapers/`](scrapers/) | Conference-specific scraping modules | [scrapers/README.md](scrapers/README.md) |
| [`scripts/`](scripts/) | BERTopic pipeline, arXiv backfill | [scripts/README.md](scripts/README.md) |
| [`frontend/`](frontend/) | Next.js frontend application | [frontend/README.md](frontend/README.md) |
| `main.py` | FastAPI backend — API endpoints | See [API docs below](#api-endpoints) |

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

## Docker Deployment

```bash
docker-compose build
docker-compose up -d
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
