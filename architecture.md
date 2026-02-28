# Cosmospaper Architecture

This diagram illustrates the high-level architecture of the `cosmospaper` project.

```mermaid
graph LR
    subgraph Frontend
        A[Next.js Frontend<br>Port: 3000] 
        UI[Jinja2 Templates / HTML<br>Served directly by FastAPI] 
    end

    subgraph Backend Services
        B[FastAPI Application<br>main.py<br>Port: 8000]
        C[Scanner & Scrapers<br>scanner.py / scrapers/]
        
        A -->|REST API Calls| B
        UI -.->|Fallback / alternative UI| B
        B -->|Triggers update| C
        B <-->|Queries & Searches| D
    end

    subgraph Storage
        D[(PostgreSQL Database<br>pgvector)]
        D -.->|Vector Data| B
    end

    subgraph External Dependencies
        Interwebs((External<br>Conference Sites))
        Azure[Azure OpenAI]
        E[OpenAI / Embeddings API]
        C -->|Scrapes Data| Interwebs
        C -->|Saves Papers| D
        B -->|Generates Embeddings| E
        Azure -.->|Copilot Summarization| B
    end
    
    classDef frontend fill:#d4e157,stroke:#333,stroke-width:2px;
    classDef backend fill:#81d4fa,stroke:#333,stroke-width:2px;
    classDef database fill:#ce93d8,stroke:#333,stroke-width:2px;
    
    class A,UI frontend;
    class B,C backend;
    class D database;

```

## Key Components:
- **Frontend**: A modern Next.js application running on port 3000 that communicates with the API. There is also a fallback HTML/Jinja2 template system served directly by FastAPI.
- **Backend (FastAPI)**: The core API server (`main.py`) running on port 8000 handling search, filtering, and semantic search requests.
- **Scrapers**: A background task system (`scanner.py` and the `scrapers/` directory) that fetches paper data from various conference websites.
- **Database**: A PostgreSQL database utilizing `pgvector` for storing paper metadata and performing semantic similarity searches using embeddings.
- **Embeddings/AI**: Integration with OpenAI/Azure OpenAI for generating text embeddings for semantic search and summarizing papers.
