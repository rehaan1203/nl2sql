# backend/tests/test_agents.py - Agent tests

import pytest
from core.agents import SQLQueryAgent
from schema.schema_manager import SchemaManager
from core.safe_executor import SafeExecutor
from core.sql_validator import SQLValidator

class TestSQLQueryAgent:
    def test_sql_extraction(self, test_db_path):
        """Test SQL extraction from AI responses."""
        agent = SQLQueryAgent(f"sqlite:///{test_db_path}")
        
        # Test with clean SQL
        result = {"output": "SELECT * FROM users;"}
        sql = agent._extract_sql(result)
        assert sql == "SELECT * FROM users;"
        
        # Test with conversational text
        result = {"output": "Here is your SQL: SELECT * FROM users;"}
        sql = agent._extract_sql(result)
        assert sql == "SELECT * FROM users;"
        
        # Test with markdown
        result = {"output": "```sql\nSELECT * FROM users;\n```"}
        sql = agent._extract_sql(result)
        assert sql == "SELECT * FROM users;"
    
    def test_operation_detection(self, test_db_path):
        """Test SQL operation detection."""
        from core.operation_detector import OperationDetector
        detector = OperationDetector()
        
        # Test DDL
        assert detector.detect_category("CREATE TABLE test (id INTEGER)") == "DDL"
        assert detector.detect_operation_type("CREATE TABLE test (id INTEGER)") == "CREATE"
        
        # Test DML
        assert detector.detect_category("SELECT * FROM users") == "DML"
        assert detector.detect_operation_type("SELECT * FROM users") == "SELECT"
        
        # Test TCL
        assert detector.detect_category("BEGIN TRANSACTION") == "TCL"
        assert detector.detect_operation_type("BEGIN TRANSACTION") == "BEGIN"
        
        # Test DCL
        assert detector.detect_category("GRANT SELECT ON users TO admin") == "DCL"
        assert detector.detect_operation_type("GRANT SELECT ON users TO admin") == "GRANT"
