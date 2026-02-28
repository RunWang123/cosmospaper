# 🌌 CosmosPaper

**The Universe of Research** — A modern platform for discovering, exploring, and analyzing top papers from major AI, ML, and Security conferences.

🔗 **[Live Demo](http://cosmospaper.com)**

---

## ✨ Features

### 📄 Paper Discovery
- **50,000+ papers** aggregated from 11 top-tier conferences (CVPR, NeurIPS, ICLR, ICML, ICCV, ECCV, IEEE S&P, ACM CCS, NDSS, USENIX Security, IEEE VIS)
- **Semantic Search** powered by pgvector embeddings — find papers by meaning, not just keywords
- **🏆 Top Papers Filter** — instantly filter to Oral, Spotlight, and Best Paper awards
- **Conference & Year Filters** with real-time results

### 🤖 AI-Powered Tools
- **Ask AI** — get instant summaries and analysis of any paper using Azure OpenAI (GPT-4o-mini)
- **BibTeX Generator** — one-click citation generation for any paper
- **PDF Parsing** — automatically downloads and reads full papers for deeper AI analysis

### 📊 Research Trends
- **Stream Chart** — visualize topic evolution over time
- **Heatmap** — keyword intensity across years
- **Bar Chart Race** — animated cumulative paper count race
- **Radar Chart** — compare research focus across conferences
- **BERTopic Integration** — ML-powered topic modeling with customizable topic selection

### 🔖 Bookmarks
- Save papers locally for quick access
- Persistent across sessions (localStorage)

### 🛡️ Security
- **IP-based Rate Limiting** — protects API endpoints from abuse without requiring authentication
- CORS protection with configurable allowed origins

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React, Recharts, Tailwind CSS |
| **Backend** | FastAPI, SQLAlchemy, Uvicorn |
| **Database** | PostgreSQL + pgvector (vector similarity search) |
| **AI** | Azure OpenAI (GPT-4o-mini), Sentence-Transformers |
| **Scraping** | Playwright, BeautifulSoup4, aiohttp |
| **Deployment** | Docker Compose, Oracle Cloud VM, Nginx |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 20+
- PostgreSQL with pgvector extension

### 1. Clone & Setup
```bash
git clone https://github.com/RunWang123/cosmospaper.git
cd cosmospaper
```

### 2. Environment Variables
```bash
cp .env.example .env
# Edit .env with your database URL and API keys
```

### 3. Run with Docker (Recommended)
```bash
docker-compose up -d --build
```

### 4. Run Locally (Development)
```bash
# Backend
pip install -r requirements.txt
python main.py --serve

# Frontend
cd frontend
npm install
npm run dev
```

### 5. Access
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

---

## 📁 Project Structure

```
cosmospaper/
├── frontend/              # Next.js frontend
│   ├── src/app/           # Pages (home, trends, bookmarks)
│   └── src/components/    # Navbar, PaperCard, CopilotChat
├── scrapers/              # Per-conference scraping logic
├── config/                # Conference URLs & configurations
├── database/              # SQLAlchemy models
├── main.py                # FastAPI backend & API endpoints
├── scanner.py             # Scraper orchestration
├── embeddings.py          # Vector embedding generation
├── vectorize_papers.py    # Batch vectorization script
├── docker-compose.yml     # Multi-container deployment
└── Dockerfile             # Backend container
```

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
