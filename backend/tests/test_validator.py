# backend/tests/test_validator.py - Validator tests

import pytest
from sql_validator import SQLValidator
from schema_manager import SchemaManager

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
    
    def test_column_validation(self, test_db_path):
        """Test column existence validation."""
        schema_manager = SchemaManager(f"sqlite:///{test_db_path}")
        validator = SQLValidator(None, schema_manager)
        
        # Valid column
        valid, errors = validator.validate_columns_exist("SELECT name FROM users")
        assert valid is True
        
        # Invalid column
        valid, errors = validator.validate_columns_exist("SELECT invalid_col FROM users")
        assert valid is False
    
    def test_safety_check(self, test_db_path):
        """Test SQL safety validation."""
        schema_manager = SchemaManager(f"sqlite:///{test_db_path}")
        validator = SQLValidator(None, schema_manager)
        
        # Safe query
        valid, errors = validator._check_safety("SELECT * FROM users")
        assert valid is True
        
        # Unsafe query
        valid, errors = validator._check_safety("DROP TABLE users")
        assert valid is False
        assert "DROP" in " ".join(errors)
