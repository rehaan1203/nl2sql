# backend/tests/conftest.py - Test fixtures

import pytest
import tempfile
import sqlite3
import os
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def test_client():
    """Create test client for FastAPI app."""
    return TestClient(app)

@pytest.fixture
def test_db():
    """Create a temporary test database."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        conn = sqlite3.connect(f.name)
        cursor = conn.cursor()
        
        # Create test tables
        cursor.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                state TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE meetings (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                date DATE,
                status TEXT DEFAULT 'pending'
            )
        """)
        
        # Insert test data
        cursor.executemany(
            "INSERT INTO users (name, email, state) VALUES (?, ?, ?)",
            [
                ('Alice Johnson', 'alice@example.com', 'CA'),
                ('Bob Smith', 'bob@example.com', 'NY'),
                ('Carol White', 'carol@example.com', 'TX'),
            ]
        )
        
        cursor.executemany(
            "INSERT INTO meetings (title, date, status) VALUES (?, ?, ?)",
            [
                ('Team Sync', '2024-07-01', 'completed'),
                ('Planning Session', '2024-07-15', 'pending'),
                ('Review Meeting', '2024-07-20', 'pending'),
            ]
        )
        
        conn.commit()
        conn.close()
        
        yield f.name
        
        # Cleanup
        os.unlink(f.name)

@pytest.fixture
def test_db_path(test_db):
    """Return the path to the test database."""
    return test_db
