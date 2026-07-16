import sqlite3
import os

def setup_database():
    db_path = os.path.join(os.path.dirname(__file__), 'database', 'nl2sql.db')
    schema_path = os.path.join(os.path.dirname(__file__), 'database', 'schema.sql')
    seed_path = os.path.join(os.path.dirname(__file__), 'database', 'seed.sql')
    
    # Ensure database directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    print(f"Creating database at {db_path}...")
    
    # Connect to the database (creates it if it doesn't exist)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Run Schema
    print(f"Running schema from {schema_path}...")
    with open(schema_path, 'r') as f:
        schema_sql = f.read()
        cursor.executescript(schema_sql)
        
    # Run Seed Data
    print(f"Running seed data from {seed_path}...")
    with open(seed_path, 'r') as f:
        seed_sql = f.read()
        cursor.executescript(seed_sql)
        
    conn.commit()
    conn.close()
    
    print("Database setup complete! 🎉")

if __name__ == "__main__":
    setup_database()
