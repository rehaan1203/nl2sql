import shutil
import tempfile
import hashlib
from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import aiosqlite
from pathlib import Path
import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from datetime import datetime
import time
import uuid
from uuid import uuid4
from contextvars import ContextVar

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from cachetools import TTLCache
import json

from utils.metrics import metrics

from api.models import *
from schema.schema_manager import SchemaManager
from db.vector_store import VectorStore
from core.agents import SQLQueryAgent
from schema.schema_analyzer import SchemaAnalyzer
from core.query_detector import QueryDetector
from core.response_validator import ResponseValidator

from core.sql_validator import SQLValidator
from core.safe_executor import SafeExecutor
from db.redis_client import RedisClient
from api.errors import ErrorHandler, NL2SQLError, ErrorType
from utils.model_cache import ModelCache

model_cache = ModelCache()

# Load environment variables
load_dotenv()

# Initialize Redis client
redis_client = RedisClient()

# Request ID tracking
request_id_context = ContextVar("request_id", default=None)

class RequestIdFilter(logging.Filter):
    def filter(self, record):
        req_id = request_id_context.get()
        record.request_id = req_id if req_id else "N/A"
        return True

import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Configure structured logging
from utils.logging_config import setup_logging
logger = setup_logging("INFO")

# Rate Limiter
limiter = Limiter(key_func=get_remote_address)

# Query Cache (5 minutes TTL, max 100 items)
query_cache = TTLCache(maxsize=100, ttl=300)

# Global instances
schema_manager = None
vector_store = None
agent = None
validator = None
executor = None
schema_analyzer = None
query_detector = None
response_validator = None

# Configuration for Database Upload
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", 50)) * 1024 * 1024
ALLOWED_EXTENSIONS = {'.db', '.sqlite', '.sqlite3'}

# Global state for active database
DB_CONFIG_FILE = Path(".active_db")
if DB_CONFIG_FILE.exists():
    active_database_path = DB_CONFIG_FILE.read_text().strip()
else:
    active_database_path = os.getenv("DEFAULT_DATABASE_URL", "sqlite:///./database/nl2sql.db")

# History Database Path
HISTORY_DB_PATH = Path("./database/history.db")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global schema_manager, vector_store, agent, validator, executor, schema_analyzer, query_detector, response_validator
    
    logger.info("🚀 Starting up NL2SQL API...")
    
    # Initialize components
    database_url = active_database_path
    model = os.getenv("AI_MODEL", "gemini-1.5-flash")
    
    # 1. Initialize Embeddings once to save memory and startup time
    from langchain_community.embeddings import HuggingFaceEmbeddings
    import torch
    
    logger.info("🔥 Warming up model cache...")
    embedding_model = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    cached_model = model_cache.get_cached_model(embedding_model)
    if cached_model:
        logger.info(f"💾 Embedding model found in cache: {embedding_model}")
    else:
        logger.info(f"📥 Caching embedding model (first load will take longer): {embedding_model}")
    
    embeddings = HuggingFaceEmbeddings(
        model_name=embedding_model,
        model_kwargs={
            'device': 'cuda' if torch.cuda.is_available() else 'cpu',
        },
        encode_kwargs={
            'normalize_embeddings': True,
            'batch_size': 32,
        },
        cache_folder=os.getenv("HF_CACHE_DIR", "./hf_cache"),
    )
    logger.info("✅ Embeddings loaded and warmed up")

    # 2. Schema Manager
    schema_manager = SchemaManager(database_url, load_embeddings=False)
    schema_manager.embeddings = embeddings
    logger.info("✅ Schema Manager initialized")
    
    # 3. Vector Store
    vector_store = VectorStore(embeddings)
    
    # Preload schema into vector store
    try:
        schema_data = schema_manager.get_schema()
        vector_store.ingest_schema(schema_data)
        logger.info("✅ Vector Store initialized with schema embeddings")
    except Exception as e:
        logger.warning(f"⚠️ Could not load initial schema (DB might be empty or unavailable): {e}")
    
    # 3. SQL Agent
    agent = SQLQueryAgent(
        database_url=database_url,
        model=model,
        temperature=0.1,
        max_iterations=5
    )
    logger.info(f"✅ SQL Agent initialized with model: {model}")
    
    # 4. Validator
    validator = SQLValidator(agent.llm, schema_manager)
    logger.info("✅ Validator initialized")
    
    # 4.5 Schema Analyzer
    schema_analyzer = SchemaAnalyzer(agent.llm)
    logger.info("✅ Schema Analyzer initialized")
    
    # 4.6 Query Detector & Response Validator
    query_detector = QueryDetector(schema_manager=schema_manager, data_profiler=None)
    response_validator = ResponseValidator(db_path=database_url, data_profiler=None)
    agent.response_validator = response_validator
    logger.info("✅ QueryDetector and ResponseValidator initialized")
    
    # 5. Executor
    executor = SafeExecutor(
        database_url=database_url,
        timeout_seconds=int(os.getenv("QUERY_TIMEOUT_SECONDS", 5))
    )
    
    agent.sql_validator = validator
    agent.executor = executor
    logger.info("✅ Executor initialized")
    
    # 6. Initialize History DB
    HISTORY_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(str(HISTORY_DB_PATH)) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS query_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                natural_language TEXT NOT NULL,
                sql TEXT,
                row_count INTEGER,
                execution_time_ms INTEGER,
                success BOOLEAN,
                error TEXT,
                explanation TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        try:
            await db.execute('ALTER TABLE query_history ADD COLUMN explanation TEXT')
        except Exception:
            pass  # Column already exists
        await db.commit()
    logger.info("✅ History DB initialized")
    
    yield  # App runs here
    
    logger.info("🛑 Shutting down NL2SQL API...")

# Initialize app
app = FastAPI(
    title="NL2SQL API",
    description="Natural Language to SQL Generator with LangChain",
    version="1.0.0",
    lifespan=lifespan
)

# Request ID Middleware
class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid4()))
        request_id_context.set(request_id)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

app.add_middleware(RequestIdMiddleware)

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    """Log slow requests and add processing time header"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    
    if process_time > 2:
        logger.warning(f"Slow query: {request.url.path} took {process_time:.2f}s")
    
    return response

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Track request metrics."""
    start = time.time()
    
    try:
        response = await call_next(request)
        duration = time.time() - start
        
        # Record query time for API endpoints
        if request.url.path == "/api/query":
            metrics.record_query_time(duration, "api_query")
        
        return response
    except Exception as e:
        metrics.record_error(str(type(e).__name__))
        raise

@app.get("/api/metrics")
async def get_metrics():
    """Get performance metrics."""
    return metrics.get_stats()

@app.middleware("http")
async def session_middleware(request: Request, call_next):
    """Add session ID to request state"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        session_id = str(uuid.uuid4())
    
    # Store session ID in request state
    request.state.session_id = session_id
    
    # Get or create session
    session = redis_client.get_session(session_id)
    if not session:
        redis_client.create_session(session_id, {
            "created_at": datetime.now().isoformat(),
            "user_id": request.headers.get("X-User-ID", "anonymous")
        })
    
    response = await call_next(request)
    
    # Add session ID to response headers
    response.headers["X-Session-ID"] = session_id
    
    return response

# Add Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Endpoints =====

@app.post("/api/query")
async def run_query(request: Request, body: QueryRequest):
    """
    Execute a natural language query.
    Supports both read (SELECT) and write (INSERT, UPDATE, DELETE) operations.
    """
    try:
        session_id = request.state.session_id
        
        # 1. Check rate limit
        if not redis_client.check_rate_limit(session_id, limit=10, window=60):
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait.")
        
        # 2. Check cache (only for SELECT queries)
        operation_type = agent._detect_operation_type(body.natural_language)
        if operation_type == "SELECT":
            cached_result = redis_client.get_cached_query(body.natural_language)
            if cached_result:
                logger.info(f"💾 Returning cached result for: {body.natural_language[:50]}...")
                return QueryResponse(**cached_result)
                
        # 2.5 Query Detection & Auto Switch
        current_table = body.current_table
        auto_switched = False
        previous_table = None
        
        if current_table and query_detector and not body.force_current_table:
            query_scope = query_detector.detect_query_scope(body.natural_language, current_table)
            
            if query_scope.get("needs_multi_table", False) and not query_scope.get("can_answer_with_current", True):
                if body.auto_switch and query_scope.get("can_auto_switch", False):
                    suggested = query_scope.get("suggested_tables", [])
                    if suggested:
                        previous_table = current_table
                        current_table = suggested[0]
                        body.current_table = current_table
                        auto_switched = True
                else:
                    return QueryResponse(
                        sql="", data=[], columns=[], row_count=0, execution_time_ms=0,
                        explanation="", success=False, error="This question requires data from multiple tables.",
                        error_type="cross_table_query", suggested_tables=query_scope.get("suggested_tables", []),
                        current_table=current_table, can_auto_switch=query_scope.get("can_auto_switch", False),
                        auto_switch_message=query_scope.get("auto_switch_message", ""), requires_confirmation=True
                    )
                    
        # 3. Handle Active Database Override
        context = redis_client.get_conversation_context(session_id)
        active_db_hash = redis_client.get_active_database(session_id)
        
        # We will use the global agent by default
        current_agent = agent
        relevant_tables = []
        
        temp_db_path = None
        try:
            if active_db_hash:
                file_data = redis_client.get_uploaded_file(session_id, active_db_hash)
                if file_data:
                    import tempfile
                    import os
                    # Write to temp file and close it immediately so SQLite can open it on Windows
                    f = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
                    f.write(file_data)
                    f.close()
                    
                    temp_db_path = f.name
                    safe_path = temp_db_path.replace('\\', '/')
                    temp_db_url = f"sqlite:///{safe_path}"
                    
                    # Create temporary components to ensure the AI uses the uploaded DB
                    from core.agents import SQLQueryAgent
                    from core.safe_executor import SafeExecutor
                    from core.sql_validator import SQLValidator
                    from schema.schema_manager import SchemaManager
                    
                    current_agent = SQLQueryAgent(
                        database_url=temp_db_url,
                        model=os.getenv("AI_MODEL", "gemini-1.5-flash"),
                        temperature=0.1,
                        max_iterations=5
                    )
                    temp_executor = SafeExecutor(
                        database_url=temp_db_url,
                        timeout_seconds=int(os.getenv("QUERY_TIMEOUT_SECONDS", 5))
                    )
                    temp_schema_manager = SchemaManager(temp_db_url, load_embeddings=False)
                    temp_validator = SQLValidator(current_agent.llm, temp_schema_manager)
                    
                    current_agent.executor = temp_executor
                    current_agent.sql_validator = temp_validator
                    
                    # Get relevant tables from the schema itself (bypass vector store)
                    schema_data = temp_schema_manager.get_schema()
                    relevant_tables = [t.name for t in schema_data.tables]
                    logger.info(f"📚 Using active db tables: {relevant_tables}")
            
            if not active_db_hash or not relevant_tables:
                # Fallback to vector search on global DB
                relevant_tables = vector_store.search(body.natural_language, top_k=5)
                logger.info(f"📚 Found relevant tables via vector search: {relevant_tables}")
            
            # Enhance context with current table constraint
            if current_table:
                context = f"{context if context else ''}\n\nIMPORTANT: Focus on the '{current_table}' table for your query."
                
            # Set session and current table on the schema manager
            if 'temp_schema_manager' in locals():
                temp_schema_manager.session_id = session_id
                temp_schema_manager.set_current_table(current_table)
            elif schema_manager:
                schema_manager.session_id = session_id
                schema_manager.set_current_table(current_table)
                
            # 4. Run query with context
            result = current_agent.query(
                natural_language=body.natural_language,
                relevant_tables=relevant_tables,
                context=context
            )
            
            # 7. Check if operation was successful
            if not result.get("success", False):
                error_msg = result.get("error", "Unknown error")
                logger.warning(f"⚠️ Operation failed but returning gracefully: {error_msg}")
                # We intentionally do not raise an HTTP exception here so the chat UI
                # can display the failure message naturally in the conversation history.
            
            # 8. Prepare response
            response_data = {
                "sql": result.get("sql", ""),
                "data": result.get("data", []),
                "columns": result.get("columns", []),
                "row_count": result.get("row_count", 0),
                "affected_rows": result.get("affected_rows", 0),
                "execution_time_ms": result.get("execution_time_ms", 0),
                "explanation": result.get("error", "Execution failed") if not result.get("success", True) else result.get("explanation", ""),
                "operation_type": result.get("operation_type", "SELECT"),
                "success": result.get("success", True),
                "error": result.get("error", None) if not result.get("success", True) else None,
                "message": result.get("message", ""),
                "session_id": session_id,
                # For write operations, include refreshed data
                "refreshed_data": result.get("refreshed_data", None),
                "refreshed_count": result.get("refreshed_count", 0),
                "affected_table": result.get("affected_table", None),
                "presentation_mode": result.get("presentation_mode", "data_viz"),
                "auto_switched": auto_switched,
                "previous_table": previous_table,
                "current_table": current_table,
                "validation": result.get("validation", None)
            }
            
            response = QueryResponse(**response_data)
            
            # 9. Cache results (only for SELECT queries)
            if result.get("operation_type") == "SELECT" and result.get("success"):
                redis_client.cache_query_result(body.natural_language, response.dict())
            
            # 10. Add to conversation history
            if not redis_client.get_session_meta(session_id):
                redis_client.create_conversation(session_id, f"{current_table or 'Query'}: {body.natural_language[:30]}")
            redis_client.add_to_conversation(
                session_id,
                body.natural_language,
                response.dict()
            )
            
            # 11. For write operations, invalidate cache and refresh suggestions
            if result.get("operation_type") in ["INSERT", "UPDATE", "DELETE"] and result.get("success"):
                # Invalidate query cache
                redis_client.invalidate_all_cache()
                
                # Clear suggestions cache
                redis_client.clear_schema_suggestions(session_id)
                
                # We also need to save the modified temp DB back to Redis!
                if temp_db_path:
                    with open(temp_db_path, 'rb') as f:
                        modified_data = f.read()
                    redis_client.update_active_database(session_id, modified_data)
                
                # Log the change
                logger.info(f"🔄 Cache invalidated after {result.get('operation_type')} operation")
            
            return response
            
        finally:
            if temp_db_path and os.path.exists(temp_db_path):
                try:
                    # Explicitly dispose all SQLAlchemy engines to release file locks on Windows
                    if 'current_agent' in locals() and hasattr(current_agent, 'db') and hasattr(current_agent.db, '_engine'):
                        current_agent.db._engine.dispose()
                    if 'temp_executor' in locals() and hasattr(temp_executor, 'engine'):
                        temp_executor.engine.dispose()
                    if 'temp_schema_manager' in locals() and hasattr(temp_schema_manager, 'engine'):
                        temp_schema_manager.engine.dispose()
                        if hasattr(temp_schema_manager, 'db') and hasattr(temp_schema_manager.db, '_engine'):
                            temp_schema_manager.db._engine.dispose()
                        
                    # Force garbage collection to ensure SQLAlchemy releases the file handles on Windows
                    import gc
                    gc.collect()
                        
                    os.unlink(temp_db_path)
                except Exception as e:
                    logger.warning(f"Could not delete temp db file {temp_db_path}: {e}")
        
    except NL2SQLError as e:
        return JSONResponse(
            status_code=400,
            content=e.to_dict()
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Query failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "error_type": "server_error",
                "suggested_action": "Please try again or contact support."
            }
        )

@app.get("/api/schema", response_model=SchemaResponse)
async def get_schema(request_obj: Request):
    """Get complete database schema"""
    try:
        session_id = getattr(request_obj.state, 'session_id', None)
        if session_id:
            active_db_hash = redis_client.get_active_database(session_id)
            if active_db_hash:
                file_data = redis_client.get_uploaded_file(session_id, active_db_hash)
                if file_data:
                    import tempfile
                    import os
                    temp_path = ""
                    try:
                        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
                            f.write(file_data)
                            temp_path = f.name
                        
                        # Note: path must be formatted for SQLAlchemy on Windows (replace \ with /)
                        safe_path = temp_path.replace('\\', '/')
                        temp_db_url = f"sqlite:///{safe_path}"
                        temp_schema_manager = SchemaManager(temp_db_url, load_embeddings=False)
                        return temp_schema_manager.get_schema()
                    finally:
                        if temp_path and os.path.exists(temp_path):
                            try:
                                os.remove(temp_path)
                            except:
                                pass
        
        return schema_manager.get_schema()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch schema: {str(e)}")

@app.get("/api/table/{table_name}/data")
async def get_table_data(table_name: str, request_obj: Request):
    """Get rows from a specific table for data preview"""
    try:
        session_id = getattr(request_obj.state, 'session_id', None)
        db_url_to_use = active_database_path
        
        # Check if using a Redis uploaded DB
        temp_path = ""
        temp_executor = None
        try:
            if session_id:
                active_db_hash = redis_client.get_active_database(session_id)
                if active_db_hash:
                    file_data = redis_client.get_uploaded_file(session_id, active_db_hash)
                    if file_data:
                        import tempfile
                        import os
                        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
                            f.write(file_data)
                            temp_path = f.name
                        
                        safe_path = temp_path.replace('\\', '/')
                        db_url_to_use = f"sqlite:///{safe_path}"
            
            # Execute simple query to get data
            temp_executor = SafeExecutor(db_url_to_use)
            # Use double quotes for table name to handle spaces/special chars
            query = f'SELECT * FROM "{table_name}" LIMIT 50'
            result = temp_executor.execute(query)
            
            if not result.get("success"):
                raise HTTPException(status_code=404, detail=f"Could not read table '{table_name}': {result.get('error')}")
            
            return {
                "table_name": table_name,
                "columns": result["columns"],
                "data": result["data"],
                "row_count": len(result["data"])
            }
        finally:
            if temp_executor and hasattr(temp_executor, 'engine'):
                temp_executor.engine.dispose()
            
            if temp_path and os.path.exists(temp_path):
                import gc
                gc.collect()
                try:
                    os.remove(temp_path)
                except Exception as e:
                    logger.warning(f"Could not remove temp file {temp_path}: {e}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch table data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/table/{table_name}")
async def delete_table(table_name: str, request_obj: Request):
    """Delete a specific table from the active database"""
    session_id = getattr(request_obj.state, 'session_id', None)
    temp_db_path = None
    active_db_hash = None
    db_url_to_use = active_database_path
    temp_executor = None
    
    try:
        if session_id:
            active_db_hash = redis_client.get_active_database(session_id)
            if active_db_hash:
                file_data = redis_client.get_uploaded_file(session_id, active_db_hash)
                if file_data:
                    import tempfile
                    import os
                    f = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
                    f.write(file_data)
                    f.close()
                    
                    temp_db_path = f.name
                    safe_path = temp_db_path.replace('\\', '/')
                    db_url_to_use = f"sqlite:///{safe_path}"
                    
        # Execute DROP TABLE
        from core.safe_executor import SafeExecutor
        temp_executor = SafeExecutor(
            database_url=db_url_to_use,
            timeout_seconds=int(os.getenv("QUERY_TIMEOUT_SECONDS", 5))
        )
        
        query = f'DROP TABLE "{table_name}"'
        result = temp_executor.execute(query, category="DDL", operation_type="DROP")
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=f"Failed to delete table '{table_name}': {result.get('error')}")
            
        # If it was a Redis DB, save it back
        if temp_db_path and session_id and active_db_hash:
            with open(temp_db_path, 'rb') as f:
                modified_data = f.read()
            redis_client.update_active_database(session_id, modified_data)
            
        if session_id:
            redis_client.invalidate_all_cache()
            redis_client.clear_schema_suggestions(session_id)
            
        return {
            "success": True,
            "message": f"Table '{table_name}' deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete table: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_executor and hasattr(temp_executor, 'engine'):
            temp_executor.engine.dispose()
        if temp_db_path and os.path.exists(temp_db_path):
            try:
                import gc
                gc.collect()
                os.unlink(temp_db_path)
            except Exception as e:
                logger.warning(f"Could not delete temp db file {temp_db_path}: {e}")

class ExecuteSqlRequest(BaseModel):
    sql: str
    natural_language: Optional[str] = None

@app.post("/api/query/execute")
async def execute_sql(request_obj: Request, request: ExecuteSqlRequest):
    """Execute raw SQL safely (for history restoration or manual editing)"""
    session_id = getattr(request_obj.state, 'session_id', None)
    current_executor = executor
    temp_db_path = None
    
    try:
        if session_id:
            active_db_hash = redis_client.get_active_database(session_id)
            if active_db_hash:
                file_data = redis_client.get_uploaded_file(session_id, active_db_hash)
                if file_data:
                    import tempfile
                    import os
                    f = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
                    f.write(file_data)
                    f.close()
                    
                    temp_db_path = f.name
                    safe_path = temp_db_path.replace('\\', '/')
                    temp_db_url = f"sqlite:///{safe_path}"
                    
                    from core.safe_executor import SafeExecutor
                    current_executor = SafeExecutor(
                        database_url=temp_db_url,
                        timeout_seconds=int(os.getenv("QUERY_TIMEOUT_SECONDS", 5))
                    )
                    
        sql_upper = request.sql.strip().upper()
        operation_type = "SELECT"
        if sql_upper.startswith("INSERT"): operation_type = "INSERT"
        elif sql_upper.startswith("UPDATE"): operation_type = "UPDATE"
        elif sql_upper.startswith("DELETE"): operation_type = "DELETE"
        elif sql_upper.startswith("CREATE"): operation_type = "CREATE"
        elif sql_upper.startswith("DROP"): operation_type = "DROP"
        elif sql_upper.startswith("ALTER"): operation_type = "ALTER"
        
        # Determine category
        category = "DML"
        if operation_type in ["CREATE", "DROP", "ALTER"]: category = "DDL"
        
        execution_result = current_executor.execute(request.sql, category=category, operation_type=operation_type)
        
        if not execution_result.get("success", False):
            raise HTTPException(status_code=400, detail=execution_result.get("error", "Query execution failed"))
            
        explanation = "Manually executed SQL query."
        operation_type = execution_result.get("operation_type", operation_type)
        try:
            if agent and agent.llm:
                nl = request.natural_language if request.natural_language else "User manually edited and executed this SQL query."
                explanation = agent._generate_explanation(request.sql, nl, operation_type)
        except Exception as e:
            logger.warning(f"Failed to generate explanation for executed SQL: {e}")

        # If it was a write operation on a temp db, save it back
        if operation_type in ["INSERT", "UPDATE", "DELETE"] and temp_db_path and session_id and active_db_hash:
            with open(temp_db_path, 'rb') as f:
                modified_data = f.read()
            redis_client.update_active_database(session_id, modified_data)
            redis_client.invalidate_all_cache()
            redis_client.clear_schema_suggestions(session_id)

        # For write operations, we may want to include a generic message or refreshed data, but for now we match the original behavior
        
        return {
            "sql": request.sql,
            "data": execution_result.get("data", []),
            "columns": execution_result.get("columns", []),
            "row_count": execution_result.get("row_count", 0),
            "execution_time_ms": execution_result.get("execution_time_ms", 0),
            "explanation": explanation,
            "operation_type": operation_type,
            "success": True,
            "message": execution_result.get("message", "")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Execution failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if temp_db_path and os.path.exists(temp_db_path):
            try:
                if hasattr(current_executor, 'engine'):
                    current_executor.engine.dispose()
                import gc
                gc.collect()
                os.unlink(temp_db_path)
            except Exception as e:
                logger.warning(f"Could not delete temp db file {temp_db_path}: {e}")

@app.post("/api/query/validate", response_model=ValidationResponse)
async def validate_query(sql: str):
    """Validate SQL query and suggest fixes"""
    try:
        return validator.validate(sql)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")

@app.post("/api/schema/preload")
async def preload_schema():
    """Preload schema into vector store"""
    try:
        schema_data = schema_manager.get_schema()
        vector_store.ingest_schema(schema_data)
        return {"status": "success", "message": "Schema preloaded into vector store"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preload failed: {str(e)}")

@app.get("/api/metrics")
async def get_metrics():
    """Get performance metrics for monitoring."""
    from utils.token_tracker import token_tracker
    return {
        "token_usage": token_tracker.get_average_usage(),
        "total_queries": len(token_tracker.usage_history) if token_tracker else 0
    }

@app.get("/api/version")
async def get_version():
    """Get version info"""
    return {
        "version": "1.0.0",
        "build_date": datetime.now().isoformat(),
        "model": os.getenv("AI_MODEL", "unknown"),
        "features": {
            "token_optimization": True,
            "error_handling": True,
            "table_context": True,
            "hallucination_prevention": True
        }
    }

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint - checks all components including AI"""
    try:
        # Check database
        db_status = False
        try:
            schema_manager.get_schema()
            db_status = True
        except:
            db_status = False
        
        # Check vector store
        vs_status = vector_store is not None
        
        # Check Groq API key
        groq_key = os.getenv("GROQ_API_KEY")
        groq_status = bool(groq_key and groq_key.startswith("gsk_"))
        
        # Check Mistral API key
        mistral_key = os.getenv("MISTRAL_API_KEY")
        mistral_status = bool(mistral_key)
        
        # Check Hugging Face token
        hf_token = os.getenv("HUGGINGFACEHUB_API_TOKEN")
        hf_status = bool(hf_token)
        
        # Check AI configured
        ai_configured = (groq_status or mistral_status) and hf_status
        
        return HealthResponse(
            status="healthy" if all([db_status, vs_status, ai_configured]) else "degraded",
            database=db_status,
            vector_store=vs_status,
            ai_configured=ai_configured,
            model=os.getenv("AI_MODEL", "not set"),
            groq_configured=groq_status,
            huggingface_configured=hf_status,
            version="1.0.0"
        )
    except Exception as e:
        return HealthResponse(
            status="unhealthy",
            database=False,
            vector_store=False,
            ai_configured=False,
            model="unknown",
            version="1.0.0"
        )

@app.post("/api/database/upload")
async def upload_database(request_obj: Request, file: UploadFile = File(...)):
    try:
        session_id = request_obj.state.session_id
        
        # Read file data
        content = await file.read()
        
        # Validate SQLite format
        if not content[:16].startswith(b'SQLite format 3'):
            raise HTTPException(status_code=400, detail="Invalid SQLite database file")
        
        # Get schema info
        import tempfile
        import aiosqlite
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            f.write(content)
            temp_path = f.name
            
        async with aiosqlite.connect(temp_path) as conn:
            cursor = await conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
            tables = await cursor.fetchall()
            table_names = [t[0] for t in tables]
        
        # Store in Redis
        metadata = {
            "tables": table_names,
            "total_rows": 0  # Could count rows if needed
        }
        
        # Get active database
        current_active = redis_client.get_active_database(session_id)
        
        file_hash = redis_client.store_uploaded_file(
            user_id=session_id,
            file_data=content,
            filename=file.filename,
            metadata=metadata
        )
        
        switched_active = False
        # Set as active database ONLY if no database is currently active
        if not current_active:
            redis_client.set_active_database(session_id, file_hash)
            switched_active = True
            
            # CLEAR VECTOR STORE CACHE FOR THIS SESSION
            if vector_store:
                try:
                    vector_store.clear_session_store(session_id)
                    logger.info(f"🧹 Cleared old vector store schema for session {session_id}")
                except Exception as vs_err:
                    logger.warning(f"Failed to clear vector store: {vs_err}")
                    
            # INVALIDATE SCHEMA CACHE
            if schema_manager:
                schema_manager.invalidate_cache()
                
            # INVALIDATE EXPLANATION CACHE
            if agent and hasattr(agent, 'explainer'):
                agent.explainer.invalidate_cache()
        
        return {
            "success": True,
            "message": f"Database '{file.filename}' uploaded successfully",
            "file_hash": file_hash,
            "tables": table_names,
            "tables_count": len(table_names),
            "switched_active": switched_active
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/api/database/list")
async def list_databases(request_obj: Request):
    """Get list of user's uploaded databases from Redis"""
    try:
        session_id = getattr(request_obj.state, 'session_id', None)
        if not session_id:
            return {"databases": []}
            
        files = redis_client.get_user_files(session_id)
        databases = []
        for file_hash in files:
            meta = redis_client.get_file_metadata(session_id, file_hash)
            if meta:
                databases.append(meta)
                
        return {"databases": databases}
    except Exception as e:
        logger.error(f"Failed to list databases: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/database/switch/{file_hash}")
async def switch_database(file_hash: str, request_obj: Request):
    """Switch active database in Redis"""
    try:
        session_id = getattr(request_obj.state, 'session_id', None)
        if not session_id:
            raise HTTPException(status_code=401, detail="No session found")
            
        meta = redis_client.get_file_metadata(session_id, file_hash)
        if not meta:
            raise HTTPException(status_code=404, detail="Database not found")
            
        if redis_client.set_active_database(session_id, file_hash):
            return {"success": True, "message": "Database switched"}
        else:
            raise HTTPException(status_code=500, detail="Failed to switch database")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to switch database: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/database/reset")
async def reset_database():
    """
    Reset to the default database.
    """
    try:
        default_db = os.getenv("DEFAULT_DATABASE_URL", "sqlite:///./database/nl2sql.db")
        global active_database_path, agent, schema_manager, vector_store, validator, executor
        
        # Close connections
        if hasattr(agent, 'db') and hasattr(agent.db, '_engine'):
            agent.db._engine.dispose()
        if hasattr(schema_manager, 'engine'):
            schema_manager.engine.dispose()
        
        # Reset to default
        active_database_path = default_db
        
        # Reinitialize components
        schema_manager = SchemaManager(default_db)
        agent = SQLQueryAgent(
            database_url=default_db,
            model=os.getenv("AI_MODEL", "gemini-1.5-flash")
        )
        validator = SQLValidator(agent.llm, schema_manager)
        executor = SafeExecutor(
            database_url=default_db,
            timeout_seconds=int(os.getenv("QUERY_TIMEOUT_SECONDS", 5))
        )
        
        # Rebuild vector store
        from langchain_community.embeddings import HuggingFaceEmbeddings
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        vector_store = VectorStore(embeddings)
        schema_data = schema_manager.get_schema()
        vector_store.ingest_schema(schema_data)
        
        return {
            "success": True,
            "message": "Reset to default database"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

@app.delete("/api/database/{file_hash}")
async def delete_database(file_hash: str, request_obj: Request):
    """Delete an uploaded database from Redis and storage"""
    try:
        session_id = getattr(request_obj.state, 'session_id', None)
        if not session_id:
            raise HTTPException(status_code=401, detail="No session found")
            
        if file_hash == "active":
            file_hash = redis_client.get_active_database(session_id)
            if not file_hash:
                raise HTTPException(status_code=404, detail="No active database found")
            
        # Check if database exists
        meta = redis_client.get_file_metadata(session_id, file_hash)
        if not meta:
            raise HTTPException(status_code=404, detail="Database not found")
            
        # Delete from Redis
        if redis_client.delete_uploaded_file(session_id, file_hash):
            # Check if this was the active database
            active_db = redis_client.get_active_database(session_id)
            is_active = active_db == file_hash
            if is_active:
                # Clear schema suggestions since the DB is gone
                redis_client.clear_schema_suggestions(session_id)
            
            return {
                "success": True, 
                "message": "Database deleted",
                "was_active": is_active
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to delete database")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete database: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/database/info")
async def get_database_info(request_obj: Request):
    """
    Get information about the currently active database.
    """
    try:
        session_id = getattr(request_obj.state, 'session_id', None)
        schema_data = None
        db_name = "Default Database"
        
        if session_id:
            active_db_hash = redis_client.get_active_database(session_id)
            if active_db_hash:
                file_data = redis_client.get_uploaded_file(session_id, active_db_hash)
                if file_data:
                    meta = redis_client.get_file_metadata(session_id, active_db_hash)
                    if meta and "filename" in meta:
                        db_name = meta["filename"]
                        
                    import tempfile
                    import os
                    temp_path = ""
                    try:
                        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
                            f.write(file_data)
                            temp_path = f.name
                            
                        safe_path = temp_path.replace('\\', '/')
                        temp_db_url = f"sqlite:///{safe_path}"
                        temp_schema_manager = SchemaManager(temp_db_url, load_embeddings=False)
                        schema_data = temp_schema_manager.get_schema()
                    finally:
                        if temp_path and os.path.exists(temp_path):
                            try:
                                os.remove(temp_path)
                            except:
                                pass
        
        if not schema_data:
            schema_data = schema_manager.get_schema()
        
        return {
            "database_name": db_name,
            "tables_count": len(schema_data.tables),
            "tables": [t.name for t in schema_data.tables],
            "total_rows": sum(t.row_count for t in schema_data.tables)
        }
    except Exception as e:
        return {
            "error": str(e)
        }


@app.post("/api/history")
async def save_history(item: dict):
    """Save query to history"""
    try:
        async with aiosqlite.connect(str(HISTORY_DB_PATH)) as db:
            await db.execute('''
                INSERT INTO query_history 
                (natural_language, sql, row_count, execution_time_ms, success, error, explanation)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                item.get("natural_language"),
                item.get("sql"),
                item.get("row_count", 0),
                item.get("execution_time_ms", 0),
                item.get("success", True),
                item.get("error"),
                item.get("explanation")
            ))
            await db.commit()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to save history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
async def get_history():
    """Get query history"""
    try:
        async with aiosqlite.connect(str(HISTORY_DB_PATH)) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute('''
                SELECT * FROM query_history 
                ORDER BY created_at DESC 
                LIMIT 50
            ''')
            rows = await cursor.fetchall()
            history = [dict(row) for row in rows]
            return {"history": history}
    except Exception as e:
        logger.error(f"Failed to get history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/history")
async def clear_history():
    """Clear all query history"""
    try:
        async with aiosqlite.connect(str(HISTORY_DB_PATH)) as db:
            await db.execute('DELETE FROM query_history')
            await db.commit()
        return {"status": "success", "message": "History cleared"}
    except Exception as e:
        logger.error(f"Failed to clear history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/audio/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio using Groq Whisper"""
    try:
        from groq import Groq
        import tempfile
        import os
        
        # We need an API key for Groq
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY not found in environment")
            
        client = Groq(api_key=groq_api_key)
        
        # Save the uploaded file to a temporary file
        content = await file.read()
        
        # Determine the extension from the filename or default to m4a
        ext = os.path.splitext(file.filename)[1] if file.filename else ".m4a"
        if not ext:
            ext = ".m4a"
            
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_audio:
            temp_audio.write(content)
            temp_path = temp_audio.name
            
        try:
            with open(temp_path, "rb") as audio_file:
                transcription = client.audio.transcriptions.create(
                    file=(os.path.basename(temp_path), audio_file.read()),
                    model="whisper-large-v3-turbo",
                    temperature=0,
                    response_format="verbose_json",
                )
                
            return {"text": transcription.text}
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    except Exception as e:
        logger.error(f"Failed to transcribe audio: {e}")
        raise HTTPException(status_code=500, detail=f"Audio transcription failed: {str(e)}")

@app.get("/api/suggestions")
async def get_suggestions(request_obj: Request, table_name: str = None, force_refresh: bool = False):
    """Get table-specific query suggestions."""
    try:
        session_id = getattr(request_obj.state, 'session_id', 'default_session')
        
        temp_path = None
        
        # If no table specified, we need to fetch schema to get the first table
        if not table_name:
            schema_data = None
            if session_id:
                active_db_hash = redis_client.get_active_database(session_id)
                if active_db_hash:
                    file_data = redis_client.get_uploaded_file(session_id, active_db_hash)
                    if file_data:
                        import tempfile
                        import os
                        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
                            f.write(file_data)
                            temp_path = f.name
                        
                        safe_path = temp_path.replace('\\', '/')
                        temp_db_url = f"sqlite:///{safe_path}"
                        temp_schema_manager = SchemaManager(temp_db_url, load_embeddings=False)
                        schema_data = temp_schema_manager.get_schema()
            
            if not schema_data:
                schema_data = schema_manager.get_schema()
                
            if not schema_data.tables:
                if temp_path and os.path.exists(temp_path):
                    if 'temp_schema_manager' in locals():
                        temp_schema_manager.engine.dispose()
                    os.remove(temp_path)
                return {
                    "suggestions": ["No tables found in the database"],
                    "source": "empty",
                    "count": 1
                }
            table_name = schema_data.tables[0].name

        # We need the actual db_path for data profiling.
        db_path = schema_manager.database_url
        if session_id and not temp_path:
            active_db_hash = redis_client.get_active_database(session_id)
            if active_db_hash:
                file_data = redis_client.get_uploaded_file(session_id, active_db_hash)
                if file_data:
                    import tempfile
                    import os
                    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
                        f.write(file_data)
                        temp_path = f.name
                    db_path = temp_path

        try:
            # Generate table-specific suggestions
            suggestions = schema_analyzer.generate_table_suggestions(
                table_name=table_name,
                user_id=session_id,
                force_refresh=force_refresh,
                db_path=db_path,
                redis_client=redis_client
            )
            
            return {
                "suggestions": suggestions,
                "source": "ai",
                "count": len(suggestions),
                "table_name": table_name
            }
        finally:
            if temp_path and os.path.exists(temp_path):
                import os
                try:
                    if 'temp_schema_manager' in locals():
                        temp_schema_manager.engine.dispose()
                    os.remove(temp_path)
                except Exception as e:
                    logger.warning(f"Could not delete temp db file {temp_path}: {e}")

    except Exception as e:
        logger.error(f"Failed to get suggestions: {e}")
        return {
            "suggestions": [
                f"Show me all data from the {table_name} table" if table_name else "Show me all data",
                "What is the total number of records?",
                "Show me a summary of the data"
            ],
            "source": "fallback",
            "count": 3,
            "table_name": table_name
        }

@app.post("/api/suggestions/regenerate")
async def regenerate_suggestions(request_obj: Request, table_name: str = None):
    """Force regenerate table-specific suggestions"""
    try:
        return await get_suggestions(request_obj, table_name=table_name, force_refresh=True)
    except Exception as e:
        logger.error(f"Failed to regenerate suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/suggestions/clear")
async def clear_suggestions(request_obj: Request):
    """Clear cached suggestions"""
    try:
        session_id = getattr(request_obj.state, 'session_id', 'default_session')
        redis_client.clear_schema_suggestions(session_id)
        return {"success": True, "message": "Suggestions cache cleared"}
    except Exception as e:
        logger.error(f"Failed to clear suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/conversations")
async def get_conversations(request_obj: Request):
    """Get all conversation sessions for user"""
    try:
        session_id = getattr(request_obj.state, 'session_id', 'default_session')
        user_id = session_id.split(':')[0] if ':' in session_id else 'default'
        sessions = redis_client.client.smembers(f"user:sessions:{user_id}")
        threads = []
        for sid in sessions:
            sid_str = sid.decode('utf-8')
            meta = redis_client.get_session_meta(sid_str)
            if meta:
                meta['session_id'] = sid_str
                # get message count
                history = redis_client.get_conversation(sid_str, limit=50)
                meta['message_count'] = len(history)
                threads.append(meta)
        # sort by created_at desc
        threads.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return threads
    except Exception as e:
        logger.error(f"Failed to fetch conversations: {e}")
        return []

@app.get("/api/conversations/{session_id}")
async def get_conversation_history(session_id: str):
    """Get conversation history for a specific session"""
    try:
        history = redis_client.get_conversation(session_id, limit=50)
        meta = redis_client.get_session_meta(session_id)
        return {
            "meta": meta,
            "history": history
        }
    except Exception as e:
        logger.error(f"Failed to fetch conversation history: {e}")
        return {"meta": None, "history": []}
@app.get("/api/pool/status")
async def get_pool_status():
    """Get connection pool status."""
    try:
        if executor:
            return executor.get_pool_status()
        return {"status": "pool_not_available"}
    except Exception as e:
        return {"error": str(e)}

@app.on_event("shutdown")
async def shutdown_event():
    """Dispose of connection pool on shutdown."""
    if executor and hasattr(executor, 'engine'):
        executor.engine.dispose()
        logger.info("?? Connection pool disposed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
