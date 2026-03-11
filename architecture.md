# Cosmospaper Architecture

This diagram illustrates the high-level architecture of the `cosmospaper` project.

```mermaid
graph LR
    subgraph Frontend
        A[Next.js Frontend<br>Port: 3000]
    end

    subgraph Backend Services
        B[FastAPI Application<br>main.py<br>Port: 8000]
        C[Scanner & Scrapers<br>scanner.py / scrapers/]
        EMB[Embeddings Service<br>sentence-transformers<br>BAAI/bge-base-en-v1.5]

        A -->|REST API Calls| B
        B -->|Triggers update| C
        B <-->|Queries & Searches| D
        B -->|Generates Embeddings| EMB
    end

    subgraph Storage
        D[(PostgreSQL Database<br>pgvector)]
    end

    subgraph Offline Pipeline
        BT[BERTopic Pipeline<br>scripts/run_bertopic.py]
        BT -->|Reads embeddings| D
        BT -->|Writes topics.* tables| D
    end

    subgraph External Services
        Interwebs((Conference<br>Websites))
        LLM[LLM Providers<br>NVIDIA NIM / Azure AI Foundry<br>via LiteLLM]
        ArXiv[arXiv API]

        C -->|Scrapes Papers| Interwebs
        C -->|Saves Papers| D
        B -->|Copilot Chat / Summarize<br>User's API Key BYOK| LLM
        ArXiv -.->|Abstract Backfill| D
    end

    classDef frontend fill:#d4e157,stroke:#333,stroke-width:2px;
    classDef backend fill:#81d4fa,stroke:#333,stroke-width:2px;
    classDef database fill:#ce93d8,stroke:#333,stroke-width:2px;
    classDef offline fill:#ffcc80,stroke:#333,stroke-width:2px;

    class A frontend;
    class B,C,EMB backend;
    class D database;
    class BT offline;
```

## Key Components:
- **Frontend (Next.js)**: A React 19 / Next.js 16 application on port 3000. Handles paper search, bookmarks, trend visualizations, and the AI Copilot chat panel.
- **Backend (FastAPI)**: The core API server (`main.py`) on port 8000 handling filtering, semantic search, Copilot endpoints, and BERTopic trend queries. Includes rate limiting via slowapi.
- **Scrapers**: A background task system (`scanner.py` and the `scrapers/` directory) that fetches paper metadata and abstracts from 15+ conference websites.
- **Embeddings**: Local `sentence-transformers` model (BAAI/bge-base-en-v1.5, 768-dim) generates embeddings on the server — no external API needed.
- **Database**: PostgreSQL with `pgvector` for storing paper metadata and performing cosine-similarity semantic search.
- **BERTopic Pipeline**: An offline GPU script (`scripts/run_bertopic.py`) that clusters 50k+ paper embeddings into ~150 topics. Results are stored in `topics.*` tables and served by the `/api/trends/*` endpoints.
- **LLM Providers (BYOK)**: The AI Copilot routes user requests through LiteLLM to NVIDIA NIM or Azure AI Foundry. Users provide their own API key — it is never stored on the server.
