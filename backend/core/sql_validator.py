import re
import logging
from typing import Tuple, List, Dict, Optional
from langchain_groq import ChatGroq
from core.prompt_manager import PromptManager
from core.operation_detector import OperationDetector

logger = logging.getLogger(__name__)

class SQLValidator:
    """
    Comprehensive SQL validator with AI-powered correction.
    Now supports validation for all CRUD operations.
    """
    
    def __init__(self, llm: ChatGroq, schema_manager):
        self.llm = llm
        self.schema_manager = schema_manager
        self.prompt_manager = PromptManager()
        self.operation_detector = OperationDetector()
        self._transaction_active = False
        
    def set_transaction_state(self, active: bool):
        """Track transaction state for TCL validation"""
        self._transaction_active = active
    
    def _in_transaction(self) -> bool:
        """Check if a transaction is currently active"""
        return self._transaction_active
        
    def detect_operation_type(self, sql: str) -> str:
        """Backward compatibility: delegate to OperationDetector"""
        return self.operation_detector.detect_operation_type(sql)
        
    def validate_sql(self, sql: str) -> dict:
        """
        Full validation with category-specific rules.
        
        Returns:
            Dict with: valid, errors, warnings, suggested_fix, category, operation_type
        """
        # Get operation info
        op_info = self.operation_detector.detect_operation_info(sql)
        category = op_info["category"]
        operation_type = op_info["operation_type"]
        
        errors = []
        warnings = []
        
        # 1. Basic syntax validation
        syntax_valid, syntax_errors = self._check_syntax(sql)
        if not syntax_valid:
            errors.extend(syntax_errors)
            return {
                "valid": False,
                "errors": errors,
                "warnings": warnings,
                "suggested_fix": self._suggest_fix(sql, errors),
                "category": category,
                "operation_type": operation_type
            }
        
        # 2. Category-specific validation
        if category == "DDL":
            return self._validate_ddl(sql, operation_type, errors, warnings)
        elif category == "DML":
            return self._validate_dml(sql, operation_type, errors, warnings)
        elif category == "DCL":
            return self._validate_dcl(sql, operation_type, errors, warnings)
        elif category == "TCL":
            return self._validate_tcl(sql, operation_type, errors, warnings)
        else:
            errors.append(f"Unknown SQL category: {category}")
            return {
                "valid": False,
                "errors": errors,
                "warnings": warnings,
                "suggested_fix": None,
                "category": category,
                "operation_type": operation_type
            }
            
    def _validate_ddl(self, sql: str, operation_type: str, errors: list, warnings: list) -> dict:
        """DDL-specific validation"""
        if operation_type == "CREATE":
            table_name = self._extract_table_name_from_ddl(sql)
            if table_name:
                if self._table_exists(table_name):
                    errors.append(f"Table '{table_name}' already exists")
                    return self._build_result(False, errors, warnings, f"Use a different table name or DROP TABLE {table_name} first", "DDL", operation_type)
        
        elif operation_type == "DROP":
            table_name = self._extract_table_name_from_ddl(sql)
            if table_name:
                if not self._table_exists(table_name):
                    errors.append(f"Table '{table_name}' does not exist")
                    return self._build_result(False, errors, warnings, f"Check the table name or use CREATE TABLE {table_name} first", "DDL", operation_type)
                warnings.append(f"⚠️ DANGEROUS: You are about to DROP table '{table_name}'. This will permanently delete all data.")
        
        elif operation_type == "TRUNCATE":
            table_name = self._extract_table_name_from_ddl(sql)
            if table_name:
                if not self._table_exists(table_name):
                    errors.append(f"Table '{table_name}' does not exist")
                    return self._build_result(False, errors, warnings, "Check the table name", "DDL", operation_type)
                warnings.append(f"⚠️ DANGEROUS: You are about to TRUNCATE table '{table_name}'. This will delete all data.")
                
        return self._build_result(len(errors) == 0, errors, warnings, self._suggest_fix(sql, errors) if errors else None, "DDL", operation_type)

    def _validate_dml(self, sql: str, operation_type: str, errors: list, warnings: list) -> dict:
        """DML-specific validation"""
        # Check table existence
        table_names = self._extract_table_names(sql)
        for t in table_names:
            if not self._table_exists(t):
                errors.append(f"❌ Table '{t}' does not exist in the database")
                
        # For INSERT/UPDATE, validate columns
        if operation_type in ["INSERT", "UPDATE"] and not errors:
            column_errors = self._validate_columns_exist(sql, operation_type)
            if column_errors:
                errors.extend(column_errors)
        
        # For DELETE/UPDATE, check if WHERE clause exists
        if operation_type in ["DELETE", "UPDATE"]:
            if not re.search(r'WHERE\s+', sql, re.IGNORECASE):
                warnings.append(f"⚠️ {operation_type} statement has no WHERE clause - this will affect ALL rows!")
                
        return self._build_result(len(errors) == 0, errors, warnings, self._suggest_fix(sql, errors) if errors else None, "DML", operation_type)

    def _validate_dcl(self, sql: str, operation_type: str, errors: list, warnings: list) -> dict:
        """DCL-specific validation (SQLite doesn't support GRANT/REVOKE)"""
        warnings.append("⚠️ SQLite has limited DCL support. GRANT/REVOKE operations may not be fully functional.")
        
        if operation_type in ["GRANT", "REVOKE"]:
            # Extract permission info for user feedback
            permission_info = self._extract_permission_info(sql, operation_type)
            if not permission_info:
                errors.append("Could not parse GRANT/REVOKE statement. Format: GRANT <permission> ON <table> TO <user>")
                return self._build_result(False, errors, warnings, "Format: GRANT SELECT ON table_name TO username", "DCL", operation_type)
        
        return self._build_result(True, errors, warnings, None, "DCL", operation_type)

    def _extract_permission_info(self, sql: str, operation_type: str) -> Optional[Dict]:
        """Extract permission information from GRANT/REVOKE statement."""
        try:
            if operation_type == "GRANT":
                match = re.search(r'GRANT\s+(\w+)\s+ON\s+(\w+)\s+TO\s+(\w+)', sql, re.IGNORECASE)
                if match:
                    return {
                        "permission": match.group(1),
                        "table": match.group(2),
                        "user": match.group(3)
                    }
            elif operation_type == "REVOKE":
                match = re.search(r'REVOKE\s+(\w+)\s+ON\s+(\w+)\s+FROM\s+(\w+)', sql, re.IGNORECASE)
                if match:
                    return {
                        "permission": match.group(1),
                        "table": match.group(2),
                        "user": match.group(3)
                    }
            return None
        except:
            return None

    def _validate_tcl(self, sql: str, operation_type: str, errors: list, warnings: list) -> dict:
        """TCL-specific validation"""
        if operation_type == "COMMIT" and not self._in_transaction():
            errors.append("No active transaction to COMMIT")
            return self._build_result(False, errors, warnings, "BEGIN TRANSACTION first", "TCL", operation_type)
        
        if operation_type == "ROLLBACK" and not self._in_transaction():
            errors.append("No active transaction to ROLLBACK")
            return self._build_result(False, errors, warnings, "BEGIN TRANSACTION first", "TCL", operation_type)
        
        return self._build_result(True, errors, warnings, None, "TCL", operation_type)
        
    def _build_result(self, valid, errors, warnings, suggested_fix, category, operation_type):
        return {
            "valid": valid,
            "errors": errors,
            "warnings": warnings,
            "suggested_fix": suggested_fix,
            "category": category,
            "operation_type": operation_type
        }

    def _check_syntax(self, sql: str) -> Tuple[bool, List[str]]:
        """Basic SQL syntax validation"""
        errors = []
        if not sql or not sql.strip():
            errors.append("Empty SQL statement")
            return False, errors
        
        if sql.count("'") % 2 != 0:
            errors.append("Unbalanced quotes in SQL statement")
            
        return len(errors) == 0, errors
    
    def _table_exists(self, table_name: str) -> bool:
        schema = self.schema_manager.get_schema()
        valid_tables = [t.name.lower() for t in schema.tables]
        return table_name.lower() in valid_tables
        
    def _validate_columns_exist(self, sql: str, operation_type: str) -> List[str]:
        """Validate that all columns in the query exist using PromptManager."""
        schema_context = self.schema_manager.get_schema_context()
        prompt = self.prompt_manager.get_prompt("validation", sql=sql, schema=schema_context)
        try:
            response = self.llm.invoke(prompt)
            import json
            json_match = re.search(r'\{.*\}', str(response.content), re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                if not data.get('valid', True):
                    return data.get('errors', [])
            return []
        except Exception as e:
            logger.error(f"Column validation failed: {e}")
            return []
            
    def validate_and_fix_sql(self, sql: str, current_table: str = None) -> Tuple[bool, str, List[str]]:
        """
        Validate SQL and attempt to fix common issues.
        
        Returns:
            Tuple: (is_valid, fixed_sql, errors)
        """
        errors = []
        fixed_sql = sql
        
        # 1. Basic syntax check
        syntax_valid, syntax_errors = self._check_syntax(sql)
        if not syntax_valid:
            errors.extend(syntax_errors)
            return False, sql, errors
        
        # 2. Table validation
        table_names = self._extract_table_names(sql)
        schema = self.schema_manager.get_schema()
        valid_tables = [t.name.lower() for t in schema.tables]
        
        invalid_tables = [t for t in table_names if t.lower() not in valid_tables]
        
        # Exceptions for operations creating/dropping tables
        op_type = self.operation_detector.detect_operation_type(sql)
        if op_type in ["CREATE", "DROP"]:
             invalid_tables = [] # Creation/Drop table names might not exist yet/anymore
             
        if invalid_tables:
            errors.append(f"Table(s) not found: {', '.join(invalid_tables)}")
            if len(invalid_tables) == 1 and current_table:
                # Try to fix by replacing with current table
                import re
                fixed_sql = re.sub(rf'\b{invalid_tables[0]}\b', current_table, sql, flags=re.IGNORECASE)
                errors.append(f"Auto-fix: Replaced '{invalid_tables[0]}' with '{current_table}'")
        
        # 3. Safety check
        if 'DROP' in sql.upper() and 'TABLE' in sql.upper():
            # Double-check for DROP safety
            if 'IF EXISTS' not in sql.upper():
                errors.append("DROP TABLE without IF EXISTS - potential data loss")
        
        real_errors = [e for e in errors if 'Auto-fix' not in e]
        return len(real_errors) == 0, fixed_sql, errors

    def validate_tables_exist(self, sql: str) -> Tuple[bool, List[str]]:
        """
        Validate that all tables in the query exist in the database.
        """
        schema = self.schema_manager.get_schema()
        valid_tables = [t.name for t in schema.tables]
        valid_tables_lower = [t.lower() for t in valid_tables]
        
        # Extract all table names from SQL
        table_names = self._extract_table_names(sql)
        
        invalid_tables = [t for t in table_names if t.lower() not in valid_tables_lower]
        
        if invalid_tables:
            return False, [
                f"❌ Table(s) not found: {', '.join(invalid_tables)}",
                f"✅ Available tables: {', '.join(valid_tables)}"
            ]
        
        return True, []

    def _extract_table_names(self, sql: str) -> List[str]:
        """Extract all table names from SQL query."""
        patterns = [
            r'(?:FROM|JOIN|INTO|UPDATE|DELETE\s+FROM)\s+(\w+)',
            r'FROM\s+(\w+)',
            r'JOIN\s+(\w+)',
            r'INTO\s+(\w+)',
            r'UPDATE\s+(\w+)',
            r'DROP\s+TABLE\s+(\w+)',
            r'ALTER\s+TABLE\s+(\w+)',
            r'TRUNCATE\s+TABLE\s+(\w+)',
            r'CREATE\s+TABLE\s+(\w+)'
        ]
        
        tables = []
        for pattern in patterns:
            matches = re.findall(pattern, sql, re.IGNORECASE)
            tables.extend(matches)
        
        return list(set(tables))
        
    def _extract_table_name_from_ddl(self, sql: str) -> Optional[str]:
        """Extract table name from DDL statements"""
        match = re.search(r'(?:TABLE|VIEW|INDEX)\s+(\w+)', sql, re.IGNORECASE)
        if match:
            return match.group(1)
        return None
    
    def _suggest_fix(self, sql: str, errors: List[str]) -> Optional[str]:
        """Use AI to suggest a fix for validation errors using PromptManager."""
        schema_context = self.schema_manager.get_schema_context()
        prompt = self.prompt_manager.get_prompt("error_correction", sql=sql, errors=', '.join(errors), schema=schema_context)
        try:
            response = self.llm.invoke(prompt)
            return str(response.content).strip()
        except Exception as e:
            logger.error(f"Fix suggestion failed: {e}")
            return None
