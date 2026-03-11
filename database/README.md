# Database

PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension for semantic search over paper embeddings.

## Schema

### `papers` table

| Column       | Type        | Description                           |
|-------------|-------------|---------------------------------------|
| id          | Integer     | Primary key                           |
| title       | String      | Paper title (indexed)                 |
| authors     | String      | Comma-separated author names          |
| conference  | String      | e.g. `"CVPR 2025"`                    |
| year        | Integer     | Publication year                      |
| url         | String      | Link to the paper page                |
| pdf_url     | String      | Direct PDF link (nullable)            |
| source_url  | String      | URL the paper was scraped from        |
| fetched_at  | DateTime    | When the paper was scraped            |
| tags        | String      | e.g. `"Short Paper"` (nullable)       |
| abstract    | Text        | Paper abstract for embeddings         |
| embedding   | vector(768) | BAAI/bge-base-en-v1.5 embedding       |

Unique constraint: `(title, conference, year)`.

### `topics` schema (BERTopic results)

| Table          | Purpose                                  |
|----------------|------------------------------------------|
| `topic_info`   | Topic labels, keywords, and paper counts |
| `paper_topics` | Maps each paper to its topic cluster     |
| `topic_trends` | Pre-aggregated topic counts per year     |

These tables are populated by [`scripts/run_bertopic.py`](../scripts/run_bertopic.py).

## Setup

### Prerequisites

- PostgreSQL 15+
- pgvector extension

### Enable pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Database Dump (Recommended)

A pre-populated dump with 54,000+ papers is available:

**[Download cosmospaper_db.dump](https://drive.google.com/file/d/18oByehfGdHiCvhOQFrF-9sjxeyZqRxU3/view?usp=sharing)** (~230 MB)

Restore it:

```bash
createdb -U <your_user> <your_database>
pg_restore --no-owner --no-privileges -U <your_user> -d <your_database> cosmospaper_db.dump
```

### Start Fresh

If you prefer an empty database, the tables are auto-created by SQLAlchemy when the backend starts. Then trigger scraping from the admin panel or run scrapers manually.

## Environment Variable

Set `DATABASE_URL` in your `.env`:

```
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>
```

Falls back to SQLite (`database/papers.db`) if not set (no pgvector support in SQLite mode).
