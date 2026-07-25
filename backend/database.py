from dotenv import load_dotenv
import os
import urllib.parse

load_dotenv()  # Loads variables from .env

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Option 1: Use environment variable (recommended for production)
DATABASE_URL = os.getenv("DATABASE_URL", "")


engine = create_engine(
    DATABASE_URL,
    # Optional: Add connection pool settings for better performance
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True  # Validates connections before use
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

# Helper function to get database sessions
def get_db():
    """Dependency function to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Test the connection
def test_connection():
    """Test if database connection works"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✅ Database connection successful!")
            return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

if __name__ == "__main__":
    test_connection()