from sqlalchemy import create_engine, Column, Integer, String, DateTime, UniqueConstraint, Text, text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from dotenv import load_dotenv
import os

# Load environment variables from .env file (for local development)
load_dotenv()

# Setup DB
# Use PostgreSQL in production, SQLite locally
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database/papers.db")

# Render provides Postgres URLs starting with 'postgres://' but SQLAlchemy needs 'postgresql://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Detect if using PostgreSQL (for pgvector support)
IS_POSTGRES = DATABASE_URL.startswith("postgresql")

Base = declarative_base()

# Conditionally import pgvector for PostgreSQL
if IS_POSTGRES:
    try:
        from pgvector.sqlalchemy import Vector
        EMBEDDING_DIMENSION = 768  # Matches BAAI/bge-base-en-v1.5
    except ImportError:
        print("Warning: pgvector not installed. Run: pip install pgvector")
        Vector = None
else:
    Vector = None


class Paper(Base):
    __tablename__ = 'papers'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    authors = Column(String)
    
    # Metadata
    conference = Column(String)  # e.g. "CVPR 2025"
    year = Column(Integer)
    
    # URLs
    url = Column(String)  # Link to paper page
    pdf_url = Column(String, nullable=True)  # Direct PDF link if available
    
    # Source tracking
    source_url = Column(String)  # Where we scraped this from
    fetched_at = Column(DateTime, default=datetime.utcnow)
    
    # Tags
    tags = Column(String, nullable=True)  # e.g. "Short Paper"
    
    # Semantic search fields
    abstract = Column(Text, nullable=True)  # Paper abstract for embedding
    
    # Avoid duplicate papers for same conference and year
    __table_args__ = (UniqueConstraint('title', 'conference', 'year', name='_title_conf_year_uc'),)


# ── BERTopic Results ─────────────────────────────────────────
# Populated by scripts/run_bertopic.py on Palmetto.
# Read by /api/trends/* endpoints for instant responses.

class TopicInfo(Base):
    """Topic labels and metadata from BERTopic clustering."""
    __tablename__ = 'topic_info'
    __table_args__ = {'schema': 'topics'}

    topic_id = Column(Integer, primary_key=True)
    label = Column(Text, nullable=False)
    words = Column(Text)
    count = Column(Integer)
    representative_doc = Column(Text, nullable=True)


class PaperTopic(Base):
    """Maps each paper to its BERTopic cluster."""
    __tablename__ = 'paper_topics'
    __table_args__ = {'schema': 'topics'}

    paper_id = Column(Integer, primary_key=True)
    topic_id = Column(Integer, nullable=False, index=True)
    probability = Column(Float, nullable=True)


class TopicTrend(Base):
    """Pre-aggregated topic counts per year."""
    __tablename__ = 'topic_trends'
    __table_args__ = (
        UniqueConstraint('topic_id', 'year'),
        {'schema': 'topics'},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic_id = Column(Integer, nullable=False, index=True)
    year = Column(Integer, nullable=False)
    count = Column(Integer, nullable=False)
    label = Column(Text)


class TopicConference(Base):
    """Pre-aggregated topic counts per conference."""
    __tablename__ = 'topic_conferences'
    __table_args__ = (
        UniqueConstraint('topic_id', 'conference'),
        {'schema': 'topics'},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic_id = Column(Integer, nullable=False, index=True)
    conference = Column(Text, nullable=False)
    count = Column(Integer, nullable=False)
    label = Column(Text)



# Add embedding column only for PostgreSQL with pgvector
if IS_POSTGRES and Vector:
    Paper.embedding = Column(Vector(EMBEDDING_DIMENSION), nullable=True)


# SQLite needs check_same_thread, PostgreSQL doesn't
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables and pgvector extension."""
    if IS_POSTGRES:
        # Enable pgvector extension
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
    
    Base.metadata.create_all(bind=engine)
