# Scripts

Offline data-processing scripts. These are run separately from the main application.

## `run_bertopic.py` — Topic Modeling

Clusters 50k+ paper abstracts into ~150 topics using BERTopic. Designed to run on a GPU node (e.g. Palmetto H100).

```bash
python scripts/run_bertopic.py --db-url postgresql://user:password@localhost:5432/dbname
```

**Options:**

| Flag                 | Default | Description                        |
|----------------------|---------|------------------------------------|
| `--db-url`           | required| PostgreSQL connection string       |
| `--min-cluster-size` | 50      | Minimum papers per topic           |
| `--n-components`     | 5       | UMAP target dimensions             |
| `--dry-run`          |         | Print results without writing to DB|

**Pipeline:** Load embeddings → UMAP reduction → HDBSCAN clustering → c-TF-IDF topic labeling → write `topics.topic_info`, `topics.paper_topics`, `topics.topic_trends` tables.

Author names are automatically extracted and added as stop words to prevent them from appearing in topic labels.

## `backfill_arxiv.py` — Abstract Backfill

Searches the arXiv API for papers that are missing abstracts and backfills them.

```bash
python scripts/backfill_arxiv.py
```

Matches papers by exact title (normalized). Rate-limited to 1 request per 3 seconds to respect arXiv's API policy.
