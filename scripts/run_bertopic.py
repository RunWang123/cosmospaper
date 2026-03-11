#!/usr/bin/env python3
"""
BERTopic Pipeline for CosmosPaper
Run on Palmetto H100 to cluster 50k papers into topics.

Usage:
    python run_bertopic.py --db-url postgresql://user:password@localhost:5432/dbname
"""

import argparse
import re
import sys
import time
import numpy as np
import pandas as pd
from collections import Counter

def get_author_stopwords(authors_series):
    """
    Extract all unique author name tokens to use as stop words.
    Prevents author names from appearing in topic labels.
    """
    name_tokens = set()
    for authors_str in authors_series.dropna():
        # Authors stored as "John Smith, Jane Doe, Wei Zhang"
        for name in str(authors_str).split(","):
            name = name.strip()
            for token in name.split():
                token_clean = re.sub(r'[^a-zA-Z]', '', token).lower()
                if len(token_clean) >= 2:
                    name_tokens.add(token_clean)
    
    print(f"  Extracted {len(name_tokens)} unique author name tokens as stop words")
    return list(name_tokens)


def main():
    parser = argparse.ArgumentParser(description="BERTopic clustering for CosmosPaper")
    parser.add_argument("--db-url", required=True, help="PostgreSQL connection string")
    parser.add_argument("--min-cluster-size", type=int, default=50, help="Min papers per topic")
    parser.add_argument("--n-components", type=int, default=5, help="UMAP target dimensions")
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing to DB")
    args = parser.parse_args()

    # ── Step 1: Load data ────────────────────────────────────────────
    print("="*60)
    print("STEP 1: Loading papers from database")
    print("="*60)
    
    from sqlalchemy import create_engine, text
    engine = create_engine(args.db_url, pool_pre_ping=True)
    
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, title, abstract, authors, conference, year,
                   embedding::text
            FROM papers
            WHERE embedding IS NOT NULL
            ORDER BY id
        """)).fetchall()
    
    print(f"  Loaded {len(rows)} papers")
    
    # Parse into arrays
    paper_ids = []
    titles = []
    abstracts = []
    authors_list = []
    conferences = []
    years = []
    embeddings = []
    
    for row in rows:
        paper_ids.append(row[0])
        titles.append(row[1] or "")
        abstracts.append(row[2] or "")
        authors_list.append(row[3] or "")
        conferences.append(row[4] or "")
        years.append(row[5])
        
        # Parse embedding from pgvector text format: "[0.1,0.2,...]"
        emb_str = row[6]
        emb = np.array([float(x) for x in emb_str.strip("[]").split(",")])
        embeddings.append(emb)
    
    embeddings = np.array(embeddings)
    print(f"  Embeddings shape: {embeddings.shape}")
    
    # Use title + abstract as the document text for c-TF-IDF labeling
    docs = [f"{t}. {a}" if a else t for t, a in zip(titles, abstracts)]

    # ── Step 2: Build author stop words ──────────────────────────────
    print("\n" + "="*60)
    print("STEP 2: Building author name stop words")
    print("="*60)
    
    author_stops = get_author_stopwords(pd.Series(authors_list))
    
    # Also add common academic boilerplate
    extra_stops = [
        "et", "al", "fig", "figure", "table", "section", "eq", "equation",
        "arxiv", "github", "http", "https", "www", "com", "org",
        "university", "institute", "department", "lab", "laboratory",
        "proceedings", "conference", "journal", "ieee", "acm", "springer",
        "abstract", "introduction", "conclusion", "results", "method",
        "proposed", "paper", "approach", "based", "using", "show",
        "demonstrate", "experimental", "experiments", "sota", "novel",
    ]
    
    all_stops = list(set(author_stops + extra_stops))
    print(f"  Total stop words: {len(all_stops)}")

    # ── Step 3: Run BERTopic ─────────────────────────────────────────
    print("\n" + "="*60)
    print("STEP 3: Running BERTopic pipeline")
    print("="*60)
    
    from umap import UMAP
    from hdbscan import HDBSCAN
    from sklearn.feature_extraction.text import CountVectorizer
    from bertopic import BERTopic
    from bertopic.vectorizers import ClassTfidfTransformer
    
    # UMAP: 768 → 10 dimensions
    umap_model = UMAP(
        n_components=10,
        n_neighbors=15,
        min_dist=0.0,
        metric="cosine",
        random_state=42,
    )
    print(f"  UMAP: 768 → 10 dims")

    # HDBSCAN clustering
    hdbscan_model = HDBSCAN(
        min_cluster_size=30,
        min_samples=10,
        metric="euclidean",
        prediction_data=True,
    )
    print(f"  HDBSCAN: min_cluster_size=30")

    # CountVectorizer with author name stop words
    vectorizer = CountVectorizer(
        stop_words=all_stops,
        ngram_range=(1, 3),
        min_df=5,
        max_df=0.95,
    )

    # c-TF-IDF
    ctfidf = ClassTfidfTransformer(reduce_frequent_words=True)

    # Build BERTopic
    topic_model = BERTopic(
        umap_model=umap_model,
        hdbscan_model=hdbscan_model,
        vectorizer_model=vectorizer,
        ctfidf_model=ctfidf,
        nr_topics=150,  # Unsupervised hierarchical macro-clustering
        verbose=True,   
    )

    t0 = time.time()
    topics, probs = topic_model.fit_transform(docs, embeddings=embeddings)
    elapsed = time.time() - t0
    print(f"\n  BERTopic completed in {elapsed:.1f}s")
    print(f"  Topics found: {len(set(topics)) - (1 if -1 in topics else 0)}")
    print(f"  Noise papers (topic -1): {topics.count(-1)}")

    # ── Step 4: Print topic info ─────────────────────────────────────
    print("\n" + "="*60)
    print("STEP 4: Topic summary")
    print("="*60)
    
    topic_info = topic_model.get_topic_info()
    print(topic_info.head(30).to_string())

    # ── Step 5: Topics over time ─────────────────────────────────────
    print("\n" + "="*60)
    print("STEP 5: Computing topics over time")
    print("="*60)
    
    # BERTopic's built-in topics_over_time
    timestamps = [str(y) for y in years]
    topics_over_time = topic_model.topics_over_time(
        docs,
        timestamps,
        nr_bins=None,  # use actual years
    )
    print(f"  Generated {len(topics_over_time)} topic-year data points")

    if args.dry_run:
        print("\n[DRY RUN] Skipping database writes")
        return

    # ── Step 6: Write results to database ────────────────────────────
    print("\n" + "="*60)
    print("STEP 6: Writing results to PostgreSQL")
    print("="*60)
    
    with engine.connect() as conn:
        # Create schema
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS topics"))
        conn.commit()
        
        # Drop old tables if re-running
        conn.execute(text("DROP TABLE IF EXISTS topics.paper_topics CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS topics.topic_info CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS topics.topic_trends CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS topics.topic_conferences CASCADE"))
        conn.commit()
        
        # Create tables
        conn.execute(text("""
            CREATE TABLE topics.topic_info (
                topic_id INTEGER PRIMARY KEY,
                label TEXT NOT NULL,
                words TEXT,
                count INTEGER,
                representative_doc TEXT
            )
        """))
        
        conn.execute(text("""
            CREATE TABLE topics.paper_topics (
                paper_id INTEGER PRIMARY KEY,
                topic_id INTEGER NOT NULL,
                probability FLOAT
            )
        """))
        
        conn.execute(text("""
            CREATE TABLE topics.topic_trends (
                topic_id INTEGER,
                year INTEGER,
                count INTEGER,
                label TEXT,
                PRIMARY KEY (topic_id, year)
            )
        """))
        
        conn.execute(text("""
            CREATE TABLE topics.topic_conferences (
                topic_id INTEGER,
                conference TEXT,
                count INTEGER,
                label TEXT,
                PRIMARY KEY (topic_id, conference)
            )
        """))
        conn.commit()
        
        # Insert topic_info
        for _, row in topic_info.iterrows():
            tid = int(row["Topic"])
            if tid == -1:
                continue  # skip noise
            words = ", ".join([w for w, _ in topic_model.get_topic(tid)][:10])
            label_words = [w for w, _ in topic_model.get_topic(tid)][:3]
            label = " | ".join(label_words).title()
            
            conn.execute(text("""
                INSERT INTO topics.topic_info (topic_id, label, words, count)
                VALUES (:tid, :label, :words, :count)
            """), {"tid": tid, "label": label, "words": words, "count": int(row["Count"])})
        conn.commit()
        print(f"  Wrote {len(topic_info) - 1} topics to topics.topic_info")
        
        # Insert paper_topics (batch)
        batch = []
        for i, (pid, tid) in enumerate(zip(paper_ids, topics)):
            prob = float(probs[i]) if probs is not None and len(probs) > i else 0.0
            batch.append({"pid": pid, "tid": int(tid), "prob": prob})
            if len(batch) >= 1000:
                conn.execute(text("""
                    INSERT INTO topics.paper_topics (paper_id, topic_id, probability)
                    VALUES (:pid, :tid, :prob)
                """), batch)
                conn.commit()
                batch = []
        if batch:
            conn.execute(text("""
                INSERT INTO topics.paper_topics (paper_id, topic_id, probability)
                VALUES (:pid, :tid, :prob)
            """), batch)
            conn.commit()
        print(f"  Wrote {len(paper_ids)} paper-topic assignments")
        
        # Insert topic_trends (from topics_over_time)
        # Build label lookup
        label_lookup = {}
        for _, row in topic_info.iterrows():
            tid = int(row["Topic"])
            if tid == -1:
                continue
            words = [w for w, _ in topic_model.get_topic(tid)][:3]
            label_lookup[tid] = " | ".join(words).title()
        
        for _, row in topics_over_time.iterrows():
            tid = int(row["Topic"])
            if tid == -1:
                continue
            conn.execute(text("""
                INSERT INTO topics.topic_trends (topic_id, year, count, label)
                VALUES (:tid, :year, :count, :label)
                ON CONFLICT (topic_id, year) DO UPDATE SET count = :count
            """), {
                "tid": tid,
                "year": int(str(row["Timestamp"])[:4]),
                "count": int(row["Frequency"]),
                "label": label_lookup.get(tid, f"Topic {tid}"),
            })
        conn.commit()
        print(f"  Wrote {len(topics_over_time)} topic-trend rows")
        
        # Insert topic_conferences
        df = pd.DataFrame({
            "paper_id": paper_ids,
            "topic_id": topics,
            "conference": conferences,
        })
        conf_counts = df[df.topic_id != -1].groupby(["topic_id", "conference"]).size().reset_index(name="count")
        for _, row in conf_counts.iterrows():
            tid = int(row["topic_id"])
            conn.execute(text("""
                INSERT INTO topics.topic_conferences (topic_id, conference, count, label)
                VALUES (:tid, :conf, :count, :label)
                ON CONFLICT (topic_id, conference) DO UPDATE SET count = :count
            """), {
                "tid": tid,
                "conf": row["conference"],
                "count": int(row["count"]),
                "label": label_lookup.get(tid, f"Topic {tid}"),
            })
        conn.commit()
        print(f"  Wrote {len(conf_counts)} topic-conference rows")
    
    print("\n" + "="*60)
    print("DONE! All BERTopic results written to topics.* tables")
    print("="*60)


if __name__ == "__main__":
    main()
