# backend/tests/test_executor.py - Executor tests

import pytest
from safe_executor import SafeExecutor

class TestSafeExecutor:
    def test_select_execution(self, test_db_path):
        """Test SELECT query execution."""
        executor = SafeExecutor(f"sqlite:///{test_db_path}")
        
        result = executor.execute("SELECT * FROM users", "SELECT")
        
        assert result["operation_type"] == "SELECT"
        assert result["row_count"] == 3
        assert len(result["data"]) == 3
        assert "name" in result["columns"]
    
    def test_insert_execution(self, test_db_path):
        """Test INSERT query execution."""
        executor = SafeExecutor(f"sqlite:///{test_db_path}")
        
        result = executor.execute(
            "INSERT INTO users (name, email, state) VALUES ('Test', 'test@test.com', 'CA')",
            "INSERT"
        )
        
        assert result["operation_type"] == "INSERT"
        assert result["affected_rows"] == 1
        assert result["success"] is True
    
    def test_update_execution(self, test_db_path):
        """Test UPDATE query execution."""
        executor = SafeExecutor(f"sqlite:///{test_db_path}")
        
        result = executor.execute(
            "UPDATE users SET state = 'TX' WHERE name = 'Alice Johnson'",
            "UPDATE"
        )
        
        assert result["operation_type"] == "UPDATE"
        assert result["affected_rows"] >= 1
        assert result["success"] is True
    
    def test_delete_execution(self, test_db_path):
        """Test DELETE query execution."""
        executor = SafeExecutor(f"sqlite:///{test_db_path}")
        
        result = executor.execute(
            "DELETE FROM users WHERE name = 'Bob Smith'",
            "DELETE"
        )
        
        assert result["operation_type"] == "DELETE"
        assert result["affected_rows"] == 1
        assert result["success"] is True
