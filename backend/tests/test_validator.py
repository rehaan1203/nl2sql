# backend/tests/test_validator.py - Validator tests

import pytest
from core.sql_validator import SQLValidator
from schema.schema_manager import SchemaManager
from core.operation_detector import OperationDetector

class TestSQLValidator:
    def test_table_validation(self, test_db_path):
        """Test table existence validation."""
        schema_manager = SchemaManager(f"sqlite:///{test_db_path}")
        validator = SQLValidator(None, schema_manager)
        
        # Valid table
        valid, errors = validator.validate_tables_exist("SELECT * FROM users")
        assert valid is True
        assert len(errors) == 0
        
        # Invalid table
        valid, errors = validator.validate_tables_exist("SELECT * FROM nonexistent")
        assert valid is False
        assert len(errors) > 0
        assert "nonexistent" in errors[0]
    
    def test_operation_detection(self):
        """Test SQL operation detection for all categories."""
        detector = OperationDetector()
        
        # DDL
        assert detector.detect_category("CREATE TABLE test (id INTEGER)") == "DDL"
        assert detector.detect_operation_type("CREATE TABLE test (id INTEGER)") == "CREATE"
        
        # DML
        assert detector.detect_category("SELECT * FROM users") == "DML"
        assert detector.detect_operation_type("SELECT * FROM users") == "SELECT"
        
        # TCL
        assert detector.detect_category("BEGIN TRANSACTION") == "TCL"
        assert detector.detect_operation_type("BEGIN TRANSACTION") == "BEGIN"
        
        # DCL
        assert detector.detect_category("GRANT SELECT ON users TO admin") == "DCL"
        assert detector.detect_operation_type("GRANT SELECT ON users TO admin") == "GRANT"
