# backend/migrate_db.py
from database import engine
from sqlalchemy import text

def run_migration():
    print("🚀 Starting database migration...")
    try:
        with engine.connect() as connection:
            # Add the missing column
            print("--- Adding is_authorized column to users table ---")
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN DEFAULT FALSE;"))
            
            # Authorize all existing users so generation features work immediately.
            print("--- Authorizing all existing users ---")
            connection.execute(text("UPDATE users SET is_authorized = TRUE WHERE is_authorized IS DISTINCT FROM TRUE;"))
            
            connection.commit()
            print("✅ Migration successful! The column is added and existing users are authorized.")
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    run_migration()