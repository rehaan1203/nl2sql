# backend/tests/test_api.py - API endpoint tests

import pytest
import json
from fastapi.testclient import TestClient

class TestAPI:
    def test_health_endpoint(self, test_client):
        """Test health check endpoint."""
        response = test_client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "degraded"]
    
    def test_schema_endpoint(self, test_client, test_db_path):
        """Test schema endpoint."""
        # Upload test database first
        with open(test_db_path, 'rb') as f:
            response = test_client.post(
                "/api/database/upload",
                files={"file": ("test.db", f, "application/octet-stream")}
            )
            assert response.status_code == 200
        
        # Get schema
        response = test_client.get("/api/schema")
        assert response.status_code == 200
        data = response.json()
        assert "tables" in data
        assert len(data["tables"]) >= 2  # users and meetings
    
    def test_query_endpoint(self, test_client, test_db_path):
        """Test query endpoint."""
        # Upload test database
        with open(test_db_path, 'rb') as f:
            test_client.post(
                "/api/database/upload",
                files={"file": ("test.db", f, "application/octet-stream")}
            )
        
        # Test SELECT query
        response = test_client.post(
            "/api/query",
            json={"natural_language": "Show me all users"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "sql" in data
        assert "data" in data
        assert "row_count" in data
    
    def test_error_handling(self, test_client, test_db_path):
        """Test error handling for invalid queries."""
        # Upload test database
        with open(test_db_path, 'rb') as f:
            test_client.post(
                "/api/database/upload",
                files={"file": ("test.db", f, "application/octet-stream")}
            )
        
        # Test invalid table
        response = test_client.post(
            "/api/query",
            json={"natural_language": "Show me data from nonexistent_table"}
        )
        assert response.status_code in [400, 500]
