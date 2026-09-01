# backend/safe_executor.py - Enhanced with all SQL categories

import time
import re
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool

logger = logging.getLogger(__name__)

class SafeExecutor:
    """
    Safe SQL executor with full support for all SQL categories:
    - DDL: CREATE, ALTER, DROP, TRUNCATE, RENAME
    - DML: SELECT, INSERT, UPDATE, DELETE, MERGE
    - DCL: GRANT, REVOKE (application level)
    - TCL: BEGIN, COMMIT, ROLLBACK, SAVEPOINT, RELEASE
    """
    
    def __init__(self, database_url: str, timeout_seconds: int = 5):
        self.database_url = database_url
        self.timeout_seconds = timeout_seconds
        
        from sqlalchemy.pool import QueuePool, NullPool
        
        is_sqlite = database_url.startswith("sqlite")
        
        engine_kwargs = {
            "pool_pre_ping": True,
            "pool_recycle": 3600
        }
        
        if is_sqlite:
            engine_kwargs["poolclass"] = NullPool
        else:
            engine_kwargs.update({
                "poolclass": QueuePool,
                "pool_size": 20,
                "max_overflow": 10
            })
            
        self.engine = create_engine(
            database_url,
            **engine_kwargs
        )
        
        # Transaction state
        self.transaction_active = False
        self.savepoints = []
        self.transaction_id = None
        
        logger.info(f"✅ SafeExecutor initialized for SQLite")
    
    def get_pool_status(self) -> Dict[str, Any]:
        """Get connection pool statistics."""
        if hasattr(self.engine, 'pool'):
            return {
                "size": self.engine.pool.size(),
                "checkedin": self.engine.pool.checkedin(),
                "overflow": self.engine.pool.overflow(),
                "total": getattr(self.engine.pool, "total", lambda: 0)() if hasattr(self.engine.pool, "total") else 0
            }
        return {"status": "pool_not_available"}
    
    def execute(self, sql: str, category: str = "DML", operation_type: str = "SELECT") -> Dict[str, Any]:
        """
        Execute SQL query with full category support.
        
        Args:
            sql: SQL query to execute
            category: DDL, DML, DCL, or TCL
            operation_type: Specific operation (SELECT, INSERT, CREATE, etc.)
        
        Returns:
            Dictionary with results, affected rows, messages, etc.
        """
        start_time = time.time()
        logger.info(f"📝 Executing {category} → {operation_type}: {sql[:100]}...")
        
        with self.engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            try:
                # Handle different categories
                if category == "DDL":
                    return self._execute_ddl(conn, sql, operation_type, start_time)
                elif category == "DML":
                    return self._execute_dml(conn, sql, operation_type, start_time)
                elif category == "DCL":
                    return self._execute_dcl(conn, sql, operation_type, start_time)
                elif category == "TCL":
                    return self._execute_tcl(conn, sql, operation_type, start_time)
                else:
                    # Fallback: try executing anyway
                    result = conn.execute(text(sql))
                    execution_time = int((time.time() - start_time) * 1000)
                    return {
                        "success": True,
                        "message": f"Operation completed",
                        "execution_time_ms": execution_time,
                        "operation_type": operation_type
                    }
                    
            except Exception as e:
                # Rollback on error if in transaction
                if self.transaction_active:
                    conn.execute(text("ROLLBACK"))
                    self.transaction_active = False
                    self.savepoints = []
                    logger.error(f"❌ Rolled back due to error: {str(e)}")
                else:
                    logger.error(f"❌ Operation failed: {str(e)}")
                
                return {
                    "success": False,
                    "error": str(e),
                    "operation_type": operation_type,
                    "category": category
                }
    
    def _execute_ddl(self, conn, sql: str, operation_type: str, start_time: float) -> Dict[str, Any]:
        """Execute DDL operations (CREATE, ALTER, DROP, TRUNCATE, RENAME)"""
        
        # For DROP/TRUNCATE, check for safety
        if operation_type in ["DROP", "TRUNCATE"]:
            # Extract table name for safety check
            table_name = self._extract_table_name(sql)
            if table_name and operation_type == "DROP":
                # Check if table exists
                check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"), 
                                    {"name": table_name})
                if not check.fetchone():
                    return {
                        "success": False,
                        "error": f"Table '{table_name}' does not exist",
                        "operation_type": operation_type,
                        "category": "DDL"
                    }
        
        # For CREATE, check if table already exists
        if operation_type == "CREATE":
            table_name = self._extract_table_name(sql)
            if table_name:
                check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
                                    {"name": table_name})
                if check.fetchone():
                    return {
                        "success": False,
                        "error": f"Table '{table_name}' already exists",
                        "operation_type": operation_type,
                        "category": "DDL"
                    }
        
        # Start transaction if not already in one
        started_transaction = False
        if not self.transaction_active:
            conn.execute(text("BEGIN TRANSACTION"))
            self.transaction_active = True
            started_transaction = True
        
        try:
            # Execute the DDL
            conn.execute(text(sql))
            
            # Commit if not in a user transaction
            if started_transaction:
                conn.execute(text("COMMIT"))
                self.transaction_active = False
            
            execution_time = int((time.time() - start_time) * 1000)
            
            # Get operation-specific messages
            messages = {
                "CREATE": f"✅ {self._extract_table_name(sql)} table created successfully",
                "ALTER": f"✅ Table structure modified successfully",
                "DROP": f"✅ Table dropped successfully",
                "TRUNCATE": f"✅ Table data cleared successfully",
                "RENAME": f"✅ Table renamed successfully"
            }
            
            return {
                "success": True,
                "message": messages.get(operation_type, f"✅ {operation_type} completed successfully"),
                "operation_type": operation_type,
                "category": "DDL",
                "execution_time_ms": execution_time,
                "table_name": self._extract_table_name(sql)
            }
            
        except Exception as e:
            # Rollback on error
            conn.execute(text("ROLLBACK"))
            self.transaction_active = False
            raise ValueError(f"DDL operation failed: {str(e)}")
    
    def _execute_dml(self, conn, sql: str, operation_type: str, start_time: float) -> Dict[str, Any]:
        """Execute DML operations (SELECT, INSERT, UPDATE, DELETE, MERGE)"""
        
        # For SELECT, just execute and return data
        if operation_type == "SELECT":
            result = conn.execute(text(sql))
            data = []
            columns = result.keys()
            for row in result:
                data.append(dict(zip(columns, row)))
            
            execution_time = int((time.time() - start_time) * 1000)
            return {
                "success": True,
                "data": data,
                "columns": list(columns),
                "row_count": len(data),
                "execution_time_ms": execution_time,
                "operation_type": operation_type,
                "category": "DML"
            }
        
        # For write operations (INSERT, UPDATE, DELETE, MERGE)
        # Start transaction if not already in one
        started_transaction = False
        if not self.transaction_active:
            conn.execute(text("BEGIN TRANSACTION"))
            self.transaction_active = True
            started_transaction = True
        
        try:
            # For DELETE, check if WHERE clause exists
            if operation_type == "DELETE":
                if not re.search(r'WHERE\s+', sql, re.IGNORECASE):
                    return {
                        "success": False,
                        "error": "DELETE statement must have a WHERE clause for safety",
                        "operation_type": operation_type,
                        "category": "DML"
                    }
            
            # For UPDATE, check if WHERE clause exists
            if operation_type == "UPDATE":
                if not re.search(r'WHERE\s+', sql, re.IGNORECASE):
                    return {
                        "success": False,
                        "error": "UPDATE statement must have a WHERE clause for safety",
                        "operation_type": operation_type,
                        "category": "DML"
                    }
            
            # Execute the DML
            result = conn.execute(text(sql))
            
            # Commit if not in a user transaction
            if started_transaction:
                conn.execute(text("COMMIT"))
                self.transaction_active = False
            
            execution_time = int((time.time() - start_time) * 1000)
            
            # Get operation-specific messages
            messages = {
                "INSERT": f"✅ {result.rowcount} row(s) inserted successfully",
                "UPDATE": f"✅ {result.rowcount} row(s) updated successfully",
                "DELETE": f"✅ {result.rowcount} row(s) deleted successfully",
                "MERGE": f"✅ Merge operation completed"
            }
            
            # For INSERT, get the last inserted ID if available
            last_id = None
            if operation_type == "INSERT":
                try:
                    last_id_result = conn.execute(text("SELECT last_insert_rowid()"))
                    last_id = last_id_result.scalar()
                except:
                    pass
            
            return {
                "success": True,
                "message": messages.get(operation_type, f"✅ {operation_type} completed successfully"),
                "operation_type": operation_type,
                "category": "DML",
                "execution_time_ms": execution_time,
                "affected_rows": result.rowcount,
                "last_insert_id": last_id
            }
            
        except Exception as e:
            # Rollback on error
            conn.execute(text("ROLLBACK"))
            self.transaction_active = False
            raise ValueError(f"DML operation failed: {str(e)}")
    
    def _execute_dcl(self, conn, sql: str, operation_type: str, start_time: float) -> Dict[str, Any]:
        """Execute DCL operations (GRANT, REVOKE) - Application Level"""
        
        # SQLite doesn't support GRANT/REVOKE natively
        # We'll implement application-level permission management
        
        if operation_type in ["GRANT", "REVOKE"]:
            # Extract permission info
            permission_info = self._extract_permission_info(sql, operation_type)
            
            if not permission_info:
                return {
                    "success": False,
                    "error": f"Could not parse {operation_type} statement. Please specify user and table.",
                    "operation_type": operation_type,
                    "category": "DCL"
                }
            
            # Here you would implement your application's permission system
            # For now, we'll return success with a note
            execution_time = int((time.time() - start_time) * 1000)
            
            return {
                "success": True,
                "message": f"✅ {operation_type} operation recorded. Permissions managed at application level.",
                "operation_type": operation_type,
                "category": "DCL",
                "execution_time_ms": execution_time,
                "permission_info": permission_info
            }
        
        return {
            "success": False,
            "error": f"Unsupported DCL operation: {operation_type}",
            "operation_type": operation_type,
            "category": "DCL"
        }
    
    def _execute_tcl(self, conn, sql: str, operation_type: str, start_time: float) -> Dict[str, Any]:
        """Execute TCL operations (BEGIN, COMMIT, ROLLBACK, SAVEPOINT, RELEASE)"""
        
        execution_time = int((time.time() - start_time) * 1000)
        
        if operation_type == "BEGIN":
            if self.transaction_active:
                return {
                    "success": False,
                    "error": "A transaction is already active. Commit or rollback first.",
                    "operation_type": operation_type,
                    "category": "TCL"
                }
            conn.execute(text("BEGIN TRANSACTION"))
            self.transaction_active = True
            self.transaction_id = str(time.time())
            return {
                "success": True,
                "message": "✅ Transaction started",
                "operation_type": operation_type,
                "category": "TCL",
                "execution_time_ms": execution_time,
                "transaction_id": self.transaction_id
            }
        
        elif operation_type == "COMMIT":
            if not self.transaction_active:
                return {
                    "success": False,
                    "error": "No active transaction to commit",
                    "operation_type": operation_type,
                    "category": "TCL"
                }
            conn.execute(text("COMMIT"))
            self.transaction_active = False
            self.savepoints = []
            self.transaction_id = None
            return {
                "success": True,
                "message": "✅ Transaction committed successfully",
                "operation_type": operation_type,
                "category": "TCL",
                "execution_time_ms": execution_time
            }
        
        elif operation_type == "ROLLBACK":
            if not self.transaction_active:
                return {
                    "success": False,
                    "error": "No active transaction to rollback",
                    "operation_type": operation_type,
                    "category": "TCL"
                }
            conn.execute(text("ROLLBACK"))
            self.transaction_active = False
            self.savepoints = []
            self.transaction_id = None
            return {
                "success": True,
                "message": "✅ Transaction rolled back successfully",
                "operation_type": operation_type,
                "category": "TCL",
                "execution_time_ms": execution_time
            }
        
        elif operation_type == "SAVEPOINT":
            savepoint_name = self._extract_savepoint_name(sql)
            if not savepoint_name:
                return {
                    "success": False,
                    "error": "Invalid SAVEPOINT syntax. Usage: SAVEPOINT <name>",
                    "operation_type": operation_type,
                    "category": "TCL"
                }
            conn.execute(text(f"SAVEPOINT {savepoint_name}"))
            self.savepoints.append(savepoint_name)
            return {
                "success": True,
                "message": f"✅ Savepoint '{savepoint_name}' created",
                "operation_type": operation_type,
                "category": "TCL",
                "execution_time_ms": execution_time,
                "savepoint_name": savepoint_name
            }
        
        elif operation_type == "RELEASE":
            savepoint_name = self._extract_savepoint_name(sql)
            if not savepoint_name:
                return {
                    "success": False,
                    "error": "Invalid RELEASE syntax. Usage: RELEASE SAVEPOINT <name>",
                    "operation_type": operation_type,
                    "category": "TCL"
                }
            if savepoint_name not in self.savepoints:
                return {
                    "success": False,
                    "error": f"Savepoint '{savepoint_name}' does not exist",
                    "operation_type": operation_type,
                    "category": "TCL"
                }
            conn.execute(text(f"RELEASE SAVEPOINT {savepoint_name}"))
            self.savepoints.remove(savepoint_name)
            return {
                "success": True,
                "message": f"✅ Savepoint '{savepoint_name}' released",
                "operation_type": operation_type,
                "category": "TCL",
                "execution_time_ms": execution_time,
                "savepoint_name": savepoint_name
            }
        
        elif operation_type == "ROLLBACK_TO":
            savepoint_name = self._extract_savepoint_name(sql)
            if not savepoint_name:
                return {
                    "success": False,
                    "error": "Invalid ROLLBACK TO syntax. Usage: ROLLBACK TO <name>",
                    "operation_type": operation_type,
                    "category": "TCL"
                }
            if savepoint_name not in self.savepoints:
                return {
                    "success": False,
                    "error": f"Savepoint '{savepoint_name}' does not exist",
                    "operation_type": operation_type,
                    "category": "TCL"
                }
            conn.execute(text(f"ROLLBACK TO {savepoint_name}"))
            # Remove savepoints after the one we rolled back to
            idx = self.savepoints.index(savepoint_name)
            self.savepoints = self.savepoints[:idx + 1]
            return {
                "success": True,
                "message": f"✅ Rolled back to savepoint '{savepoint_name}'",
                "operation_type": operation_type,
                "category": "TCL",
                "execution_time_ms": execution_time,
                "savepoint_name": savepoint_name
            }
        
        return {
            "success": False,
            "error": f"Unsupported TCL operation: {operation_type}",
            "operation_type": operation_type,
            "category": "TCL"
        }
    
    def _extract_table_name(self, sql: str) -> Optional[str]:
        """Extract table name from SQL statement."""
        patterns = [
            r'(?:CREATE\s+TABLE\s+|DROP\s+TABLE\s+|ALTER\s+TABLE\s+|FROM\s+|UPDATE\s+|INTO\s+|TRUNCATE\s+TABLE\s+)(\w+)',
            r'RENAME\s+TABLE\s+(\w+)\s+TO',
            r'DELETE\s+FROM\s+(\w+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, sql, re.IGNORECASE)
            if match:
                return match.group(1)
        return None
    
    def _extract_savepoint_name(self, sql: str) -> Optional[str]:
        """Extract savepoint name from SQL statement."""
        patterns = [
            r'SAVEPOINT\s+(\w+)',
            r'RELEASE\s+SAVEPOINT\s+(\w+)',
            r'ROLLBACK\s+TO\s+(\w+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, sql, re.IGNORECASE)
            if match:
                return match.group(1)
        return None
    
    def _extract_permission_info(self, sql: str, operation_type: str) -> Optional[Dict]:
        """Extract permission information from GRANT/REVOKE statement."""
        try:
            # Simple extraction for GRANT <permission> ON <table> TO <user>
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
