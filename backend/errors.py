# backend/errors.py - Standardized error handling

from typing import Optional, List, Dict, Any
from enum import Enum

class ErrorType(str, Enum):
    TABLE_NOT_FOUND = "table_not_found"
    COLUMN_NOT_FOUND = "column_not_found"
    SYNTAX_ERROR = "syntax_error"
    PERMISSION_ERROR = "permission_error"
    RATE_LIMIT_ERROR = "rate_limit_error"
    AI_FAILURE = "ai_failure"
    VALIDATION_ERROR = "validation_error"
    CROSS_TABLE_ERROR = "cross_table_error"
    TRANSACTION_ERROR = "transaction_error"
    UNKNOWN = "unknown"

class NL2SQLError(Exception):
    def __init__(
        self,
        message: str,
        error_type: ErrorType = ErrorType.UNKNOWN,
        details: Optional[Dict[str, Any]] = None,
        suggested_action: Optional[str] = None
    ):
        self.message = message
        self.error_type = error_type
        self.details = details or {}
        self.suggested_action = suggested_action
        super().__init__(message)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": False,
            "error": self.message,
            "error_type": self.error_type.value,
            "details": self.details,
            "suggested_action": self.suggested_action
        }

class ErrorHandler:
    @staticmethod
    def handle_table_not_found(table_name: str, available_tables: List[str]) -> NL2SQLError:
        return NL2SQLError(
            message=f"Table '{table_name}' not found in the database.",
            error_type=ErrorType.TABLE_NOT_FOUND,
            details={"table_name": table_name, "available_tables": available_tables},
            suggested_action=f"Switch to one of these tables: {', '.join(available_tables[:5])}"
        )
    
    @staticmethod
    def handle_column_not_found(column_name: str, table_name: str, available_columns: List[str]) -> NL2SQLError:
        return NL2SQLError(
            message=f"Column '{column_name}' not found in table '{table_name}'.",
            error_type=ErrorType.COLUMN_NOT_FOUND,
            details={"column_name": column_name, "table_name": table_name, "available_columns": available_columns},
            suggested_action=f"Available columns: {', '.join(available_columns[:5])}"
        )
    
    @staticmethod
    def handle_ai_failure(error: str) -> NL2SQLError:
        return NL2SQLError(
            message=f"AI failed to generate SQL: {error}",
            error_type=ErrorType.AI_FAILURE,
            details={"ai_error": error},
            suggested_action="Try rephrasing your question or switch to a more specific table."
        )
    
    @staticmethod
    def handle_rate_limit() -> NL2SQLError:
        return NL2SQLError(
            message="Rate limit exceeded. Please wait a moment and try again.",
            error_type=ErrorType.RATE_LIMIT_ERROR,
            suggested_action="Wait 30 seconds and try again with a simpler query."
        )
