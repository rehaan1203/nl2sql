from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime

class QueryRequest(BaseModel):
    """Request model for natural language query"""
    natural_language: str
    session_id: Optional[str] = None  # For multi-turn conversations
    current_table: Optional[str] = None
    auto_switch: Optional[bool] = False
    force_current_table: Optional[bool] = False

class ColumnSchema(BaseModel):
    """Schema for a single column"""
    name: str
    type: str
    nullable: bool
    primary_key: bool
    foreign_key: Optional[str] = None

class TableSchema(BaseModel):
    """Schema for a database table"""
    name: str
    columns: List[ColumnSchema]
    row_count: int
    sample_data: Optional[List[Dict]] = None

class QueryResponse(BaseModel):
    """Response model for query results"""
    sql: str
    data: List[Dict[str, Any]]
    columns: List[str]
    row_count: int
    execution_time_ms: int
    explanation: Optional[str] = None
    error: Optional[str] = None
    affected_rows: Optional[int] = 0
    operation_type: Optional[str] = "SELECT"
    success: Optional[bool] = True
    message: Optional[str] = ""
    session_id: Optional[str] = None
    refreshed_data: Optional[List[Dict[str, Any]]] = None
    refreshed_count: Optional[int] = 0
    affected_table: Optional[str] = None
    presentation_mode: Optional[str] = "data_viz"
    auto_switched: Optional[bool] = False
    previous_table: Optional[str] = None
    current_table: Optional[str] = None
    suggested_tables: Optional[List[str]] = None
    can_auto_switch: Optional[bool] = False
    error_type: Optional[str] = None
    requires_confirmation: Optional[bool] = False
    auto_switch_message: Optional[str] = None
    validation: Optional[Dict[str, Any]] = None
    auto_fix_applied: Optional[bool] = False
    original_sql: Optional[str] = None
    auto_fix_message: Optional[str] = None

class ValidationResponse(BaseModel):
    """Response for SQL validation"""
    valid: bool
    errors: List[str]
    warnings: List[str]
    suggested_fix: Optional[str] = None

class SchemaResponse(BaseModel):
    """Response for schema endpoint"""
    tables: List[TableSchema]
    total_tables: int
    relationships: Dict[str, List[str]]  # table_name -> [related_tables]

class HistoryItem(BaseModel):
    """Query history item"""
    id: int
    natural_language: str
    sql: Optional[str] = None
    row_count: int = 0
    execution_time_ms: Optional[int] = 0
    created_at: datetime
    success: bool
    error: Optional[str] = None
    explanation: Optional[str] = None

class HealthResponse(BaseModel):
    """Health check response schema"""
    status: str
    database: bool
    vector_store: bool
    ai_configured: bool
    model: str
    groq_configured: Optional[bool] = False
    huggingface_configured: Optional[bool] = False
    version: str

class ErrorResponse(BaseModel):
    """Standard error format"""
    error: str
    error_type: str  # e.g., "table_not_found", "column_not_found", "syntax_error"
    suggested_action: Optional[str] = None
    available_tables: Optional[List[str]] = None
    sql: Optional[str] = None
