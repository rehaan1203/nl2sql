import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from langchain_community.utilities.sql_database import SQLDatabase
import logging

from models import SchemaResponse, TableSchema, ColumnSchema

logger = logging.getLogger(__name__)

class SchemaManager:
    """
    Manages database schema with intelligent retrieval using embeddings.
    Key features:
    1. Reflects schema from PostgreSQL database
    2. Converts schema to vector embeddings for semantic search
    3. Retrieves relevant tables based on natural language query
    4. Maintains relationship graph between tables
    """
    
    def __init__(self, database_url: str, load_embeddings: bool = True, session_id: Optional[str] = None):
        self.database_url = database_url
        self.session_id = session_id
        self._current_table = None
        from sqlalchemy.pool import NullPool
        is_sqlite = database_url.startswith("sqlite")
        engine_kwargs = {"poolclass": NullPool} if is_sqlite else {}
        
        self.engine = create_engine(database_url, **engine_kwargs)
        self.db = SQLDatabase.from_uri(database_url, engine_args=engine_kwargs)
        if load_embeddings:
            from langchain_community.embeddings import HuggingFaceEmbeddings
            self.embeddings = HuggingFaceEmbeddings(
                model_name=os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )
        else:
            self.embeddings = None
        self._schema_cache = {}
        self._cache_ttl = 300  # 5 minutes
        self._relationship_cache = None
        
    def invalidate_cache(self, table_name: str = None):
        """Invalidate schema cache for a specific table or all tables."""
        if table_name:
            # Remove specific table cache
            keys_to_remove = [k for k in self._schema_cache.keys() if table_name in k]
            for key in keys_to_remove:
                del self._schema_cache[key]
            logger.info(f"🗑️ Invalidated cache for table: {table_name}")
        else:
            # Clear all cache
            self._schema_cache = {}
            logger.info("🗑️ Invalidated all schema cache")
        
    def get_schema(self) -> SchemaResponse:
        """
        Get complete database schema including all tables, columns, and relationships.
        Uses SQLAlchemy reflection to get the actual schema from the database.
        """
        inspector = inspect(self.engine)
        tables = []
        relationships = {}
        
        for table_name in inspector.get_table_names():
            # Get columns
            columns = []
            for column in inspector.get_columns(table_name):
                columns.append(ColumnSchema(
                    name=column['name'],
                    type=str(column['type']),
                    nullable=column['nullable'],
                    primary_key=column.get('primary_key', False),
                    foreign_key=None  # Will be filled from constraints
                ))
            
            # Get row count
            with self.engine.connect() as conn:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                row_count = result.scalar()
            
            # Get foreign keys
            fks = inspector.get_foreign_keys(table_name)
            relationships[table_name] = [fk['referred_table'] for fk in fks]
            
            tables.append(TableSchema(
                name=table_name,
                columns=columns,
                row_count=row_count
            ))
            
        self._relationship_cache = relationships
        
        return SchemaResponse(
            tables=tables,
            total_tables=len(tables),
            relationships=relationships
        )
    
    def get_schema_context(self, query: str = None, top_k: int = 5) -> str:
        """
        Generate a text context for the LLM about the schema.
        If query is provided, uses semantic search to find relevant tables.
        """
        schema_data = self.get_schema()
        
        # If no query, return full schema
        if not query:
            return self._format_schema(schema_data.tables)
        
        # With query, use vector search to find relevant tables
        from vector_store import VectorStore
        vector_store = VectorStore(self.embeddings)
        relevant_tables = vector_store.search(query, top_k)
        
        # Filter schema to only relevant tables
        relevant_schema = [
            t for t in schema_data.tables 
            if t.name in relevant_tables
        ]
        
        return self._format_schema(relevant_schema)
    
    def _format_schema(self, tables: List[TableSchema]) -> str:
        """Format schema as text for LLM context"""
        context = "Database Schema:\n\n"
        for table in tables:
            context += f"Table: {table.name} ({table.row_count} rows)\n"
            for col in table.columns:
                pk = " PRIMARY KEY" if col.primary_key else ""
                nullable = " NOT NULL" if not col.nullable else ""
                context += f"  - {col.name}: {col.type}{pk}{nullable}\n"
            context += "\n"
        
        # Add relationships
        context += "\nRelationships:\n"
        for table in tables:
            if self._relationship_cache and table.name in self._relationship_cache:
                refs = self._relationship_cache[table.name]
                if refs:
                    context += f"  - {table.name} -> {', '.join(refs)}\n"
        
        return context

    def set_current_table(self, table_name: str):
        """Set the current table for schema context"""
        self._current_table = table_name
    
    def get_current_table_schema(self) -> Optional[Dict]:
        """Get schema for ONLY the current table"""
        if not self._current_table:
            return None
        
        # Get full schema
        schema = self.get_schema()
        
        # Filter to only current table
        for table in schema.tables:
            if table.name == self._current_table:
                return {
                    "table_name": table.name,
                    "columns": [{"name": c.name, "type": c.type} for c in table.columns],
                    "row_count": table.row_count
                }
        return None
    
    def get_schema_context_for_prompt(self, table_name: str = None) -> str:
        """Generate schema context for LLM prompt - ONLY for specified table"""
        target_table = table_name or self._current_table
        
        if not target_table:
            return "No table selected. Please ask the user which table they want to query."
        
        table_schema = self.get_current_table_schema()
        if not table_schema:
            return f"Table '{target_table}' not found in the database."
        
        # Build minimal schema context
        context = f"Table: {table_schema['table_name']} ({table_schema['row_count']} rows)\n"
        context += "Columns:\n"
        for col in table_schema['columns']:
            context += f"  - {col['name']}: {col['type']}\n"
        
        return context

    def get_minimal_schema_context(self, table_name: str = None, max_columns: int = 10) -> str:
        """
        Get ONLY essential schema information to minimize token usage.
        """
        target_table = table_name or self._current_table
        
        if not target_table:
            return "No table selected."
        
        # Get table schema
        table_schema = self.get_current_table_schema()
        if not table_schema:
            return f"Table '{target_table}' not found."
        
        # Build minimal context with limited columns
        context = f"Table: {table_schema['table_name']}\n"
        context += f"Columns ({len(table_schema['columns'])}): "
        
        # Only include column names and types, limited to max_columns
        col_names = []
        for col in table_schema['columns'][:max_columns]:
            col_names.append(f"{col['name']}({col['type']})")
        context += ", ".join(col_names)
        
        if len(table_schema['columns']) > max_columns:
            context += f" (and {len(table_schema['columns']) - max_columns} more)"
        
        return context
    
    def get_schema_for_prompt(self, table_name: str = None, minimal: bool = True) -> str:
        """
        Get schema context optimized for LLM prompts.
        """
        if minimal:
            return self.get_minimal_schema_context(table_name)
        return self.get_schema_context_for_prompt(table_name)
        
    def get_filtered_schema_for_prompt(
        self, 
        table_name: str = None, 
        query: str = None,
        max_columns: int = 8,
        include_sample_data: bool = False,
        include_row_count: bool = True
    ) -> str:
        """
        Get optimized schema context with intelligent filtering.
        
        Token optimization strategies:
        1. Only include the current table (not all tables)
        2. Limit columns to max_columns (prioritize important ones)
        3. Cache schema to avoid repeated parsing
        4. Skip sample data unless specifically requested
        5. Use abbreviated column types
        """
        target_table = table_name or self._current_table
        
        if not target_table:
            return "No table selected. Please specify which table to query."
        
        # Check cache
        cache_key = f"{target_table}_{max_columns}_{include_sample_data}_{include_row_count}"
        if cache_key in self._schema_cache:
            cached, timestamp = self._schema_cache[cache_key]
            if datetime.now() - timestamp < timedelta(seconds=self._cache_ttl):
                return cached
        
        # Get table schema
        table_schema = self.get_current_table_schema()
        if not table_schema:
            return f"Table '{target_table}' not found."
        
        # Build optimized context
        context = self._build_minimal_context(
            table_schema, 
            max_columns=max_columns,
            include_sample_data=include_sample_data,
            include_row_count=include_row_count
        )
        
        # Cache the result
        self._schema_cache[cache_key] = (context, datetime.now())
        
        return context
    
    def _build_minimal_context(
        self, 
        table_schema: Dict, 
        max_columns: int = 8,
        include_sample_data: bool = False,
        include_row_count: bool = True
    ) -> str:
        """
        Build minimal schema context optimized for token usage.
        """
        context_parts = []
        
        # Table name with row count (if requested)
        table_name = table_schema['table_name']
        if include_row_count:
            context_parts.append(f"Table: {table_name} ({table_schema['row_count']} rows)")
        else:
            context_parts.append(f"Table: {table_name}")
        
        # Columns with minimal type info
        columns = table_schema['columns']
        col_count = len(columns)
        
        # Prioritize columns (put ID, name, date, numeric columns first)
        prioritized = self._prioritize_columns(columns)
        
        # Take only max_columns
        selected = prioritized[:max_columns]
        
        col_strs = []
        for col in selected:
            # Abbreviate types to save tokens
            type_abbr = self._abbreviate_type(col['type'])
            col_strs.append(f"{col['name']}:{type_abbr}")
        
        context_parts.append(f"Columns: {', '.join(col_strs)}")
        
        # Add note about truncated columns
        if col_count > max_columns:
            context_parts.append(f"(and {col_count - max_columns} more columns)")
        
        # Add sample data only if requested (expensive in tokens)
        if include_sample_data and 'sample_data' in table_schema:
            sample = table_schema['sample_data'][:2]  # Only 2 rows max
            context_parts.append(f"Sample: {sample}")
        
        return "\\n".join(context_parts)
    
    def _prioritize_columns(self, columns: List[Dict]) -> List[Dict]:
        """
        Prioritize columns by importance for better query generation.
        """
        # Priority order: id/primary key > foreign keys > names > dates > numbers > others
        def get_priority(col):
            name = col['name'].lower()
            if name in ['id', 'primary_key', 'pk']:
                return 0
            if '_id' in name or 'fk_' in name:
                return 1
            if name in ['name', 'title', 'description']:
                return 2
            if 'date' in name or 'time' in name:
                return 3
            if any(t in col['type'].lower() for t in ['int', 'decimal', 'float']):
                return 4
            return 5
        
        return sorted(columns, key=get_priority)
    
    def _abbreviate_type(self, type_str: str) -> str:
        """
        Abbreviate data types to save tokens.
        """
        type_lower = type_str.lower()
        if 'int' in type_lower:
            return 'int'
        if 'varchar' in type_lower or 'text' in type_lower or 'char' in type_lower:
            return 'text'
        if 'date' in type_lower or 'time' in type_lower:
            return 'date'
        if 'decimal' in type_lower or 'numeric' in type_lower or 'float' in type_lower:
            return 'num'
        if 'bool' in type_lower:
            return 'bool'
        return 'str'
