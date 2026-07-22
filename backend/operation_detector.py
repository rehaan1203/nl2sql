# backend/operation_detector.py - SQL Category & Operation Detection

import re
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

class OperationDetector:
    """
    Detects SQL operation categories (DDL, DML, DCL, TCL) and specific operation types.
    
    Category Definitions:
    - DDL: Data Definition Language (CREATE, ALTER, DROP, TRUNCATE, RENAME)
    - DML: Data Manipulation Language (SELECT, INSERT, UPDATE, DELETE, MERGE)
    - DCL: Data Control Language (GRANT, REVOKE)
    - TCL: Transaction Control Language (BEGIN, COMMIT, ROLLBACK, SAVEPOINT)
    """
    
    # Category detection patterns
    CATEGORY_PATTERNS = {
        "DDL": {
            "CREATE": r'^\s*CREATE\s+(TABLE|INDEX|VIEW|TRIGGER|UNIQUE\s+INDEX)',
            "ALTER": r'^\s*ALTER\s+TABLE\s+\w+\s+(ADD|DROP|RENAME|MODIFY|ALTER)',
            "DROP": r'^\s*DROP\s+(TABLE|INDEX|VIEW|TRIGGER)\s+',
            "TRUNCATE": r'^\s*TRUNCATE\s+(TABLE)?\s+\w+',
            "RENAME": r'^\s*(?:ALTER\s+TABLE\s+\w+\s+)?RENAME\s+(?:TABLE\s+)?\w+\s+TO\s+\w+'
        },
        "DML": {
            "SELECT": r'^\s*SELECT\s+',
            "INSERT": r'^\s*INSERT\s+INTO\s+',
            "UPDATE": r'^\s*UPDATE\s+\w+\s+SET\s+',
            "DELETE": r'^\s*DELETE\s+FROM\s+',
            "MERGE": r'^\s*MERGE\s+INTO\s+',
            "REPLACE": r'^\s*REPLACE\s+INTO\s+'
        },
        "DCL": {
            "GRANT": r'^\s*GRANT\s+\w+\s+ON\s+',
            "REVOKE": r'^\s*REVOKE\s+\w+\s+ON\s+'
        },
        "TCL": {
            "BEGIN": r'^\s*BEGIN(?:\s+(?:TRANSACTION|WORK))?\b',
            "COMMIT": r'^\s*COMMIT(?:\s+(?:TRANSACTION|WORK))?\b',
            "ROLLBACK": r'^\s*ROLLBACK(?:\s+(?:TRANSACTION|WORK))?(?:\s+TO\s+SAVEPOINT\s+\w+)?\b',
            "SAVEPOINT": r'^\s*SAVEPOINT\s+\w+',
            "RELEASE": r'^\s*RELEASE\s+SAVEPOINT\s+\w+',
            "ROLLBACK_TO": r'^\s*ROLLBACK\s+TO\s+\w+'
        }
    }
    
    # Human-readable names for operations
    OPERATION_NAMES = {
        "SELECT": "Read Data",
        "INSERT": "Add Data",
        "UPDATE": "Modify Data",
        "DELETE": "Remove Data",
        "CREATE": "Create New",
        "ALTER": "Modify Structure",
        "DROP": "Remove Structure",
        "TRUNCATE": "Clear Data",
        "RENAME": "Rename Object",
        "BEGIN": "Start Transaction",
        "COMMIT": "Save Changes",
        "ROLLBACK": "Undo Changes",
        "ROLLBACK_TO": "Rollback to Savepoint",
        "SAVEPOINT": "Create Savepoint",
        "RELEASE": "Release Savepoint",
        "GRANT": "Grant Permission",
        "REVOKE": "Revoke Permission",
        "MERGE": "Merge Data"
    }
    
    # Color codes for UI
    OPERATION_COLORS = {
        "DDL": {"bg": "purple", "icon": "🔧", "badge": "purple"},
        "DML": {"bg": "blue", "icon": "📊", "badge": "blue"},
        "DCL": {"bg": "yellow", "icon": "🔐", "badge": "yellow"},
        "TCL": {"bg": "green", "icon": "🔄", "badge": "green"}
    }
    
    def detect_category(self, sql: str) -> str:
        """
        Detect the SQL category (DDL, DML, DCL, TCL).
        
        Args:
            sql: SQL query string
            
        Returns:
            Category name or "UNKNOWN"
        """
        sql_upper = sql.upper().strip()
        
        for category, patterns in self.CATEGORY_PATTERNS.items():
            for op_type, pattern in patterns.items():
                try:
                    if re.match(pattern, sql_upper, re.IGNORECASE):
                        logger.info(f"🔍 Detected category: {category} → {op_type}")
                        return category
                except re.error:
                    continue
        
        logger.warning(f"⚠️ Unknown category for SQL: {sql[:50]}...")
        return "UNKNOWN"
    
    def detect_operation_type(self, sql: str) -> str:
        """
        Detect the specific operation type.
        
        Args:
            sql: SQL query string
            
        Returns:
            Operation type (SELECT, INSERT, CREATE, etc.)
        """
        sql_upper = sql.upper().strip()
        
        for category, patterns in self.CATEGORY_PATTERNS.items():
            for op_type, pattern in patterns.items():
                try:
                    if re.match(pattern, sql_upper, re.IGNORECASE):
                        return op_type
                except re.error:
                    continue
        
        return "UNKNOWN"
    
    def get_operation_name(self, operation_type: str) -> str:
        """Get human-readable name for an operation type."""
        return self.OPERATION_NAMES.get(operation_type, operation_type)
    
    def get_operation_color(self, category: str) -> dict:
        """Get color configuration for a category."""
        return self.OPERATION_COLORS.get(category, {"bg": "gray", "icon": "📄", "badge": "gray"})
    
    def detect_operation_info(self, sql: str) -> dict:
        """
        Get complete operation information.
        
        Returns:
            Dict with category, operation_type, name, color_info
        """
        category = self.detect_category(sql)
        operation_type = self.detect_operation_type(sql)
        
        return {
            "category": category,
            "operation_type": operation_type,
            "name": self.get_operation_name(operation_type),
            "color": self.get_operation_color(category),
            "is_dangerous": operation_type in ["DROP", "TRUNCATE", "DELETE"],
            "needs_confirmation": operation_type in ["DROP", "TRUNCATE"],
            "is_write": operation_type in ["INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "TRUNCATE"]
        }
    
    def detect_from_natural_language(self, question: str) -> dict:
        """
        Detect operation type from natural language question.
        
        Args:
            question: Natural language question
            
        Returns:
            Dict with category and operation_type guesses
        """
        question_lower = question.lower()
        
        # Check for specific operation types
        if any(kw in question_lower for kw in ['create table', 'new table', 'create a table']):
            return {"category": "DDL", "operation_type": "CREATE", "confidence": "high"}
        
        if any(kw in question_lower for kw in ['alter table', 'add column', 'remove column']):
            return {"category": "DDL", "operation_type": "ALTER", "confidence": "high"}
        
        if any(kw in question_lower for kw in ['drop table', 'delete table']):
            return {"category": "DDL", "operation_type": "DROP", "confidence": "high"}
        
        if any(kw in question_lower for kw in ['add', 'insert', 'new record']):
            return {"category": "DML", "operation_type": "INSERT", "confidence": "high"}
        
        if any(kw in question_lower for kw in ['update', 'change', 'modify', 'edit']):
            return {"category": "DML", "operation_type": "UPDATE", "confidence": "high"}
        
        if any(kw in question_lower for kw in ['delete', 'remove']):
            return {"category": "DML", "operation_type": "DELETE", "confidence": "high"}
        
        if any(kw in question_lower for kw in ['show', 'list', 'view', 'find']):
            return {"category": "DML", "operation_type": "SELECT", "confidence": "high"}
        
        if any(kw in question_lower for kw in ['transaction', 'begin', 'start']):
            return {"category": "TCL", "operation_type": "BEGIN", "confidence": "high"}
        
        if any(kw in question_lower for kw in ['commit', 'save changes']):
            return {"category": "TCL", "operation_type": "COMMIT", "confidence": "high"}
        
        if any(kw in question_lower for kw in ['rollback', 'undo', 'cancel']):
            return {"category": "TCL", "operation_type": "ROLLBACK", "confidence": "high"}
        
        if any(kw in question_lower for kw in ['savepoint']):
            return {"category": "TCL", "operation_type": "SAVEPOINT", "confidence": "high"}
        
        # Default to SELECT if no specific operation detected
        return {"category": "DML", "operation_type": "SELECT", "confidence": "low"}
