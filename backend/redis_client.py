# backend/redis_client.py - Complete Redis integration

import os
import json
import hashlib
import pickle
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import redis
from redis.exceptions import RedisError
import logging

logger = logging.getLogger(__name__)

class RedisClient:
    """
    Redis Cloud client for NL2SQL application.
    
    Purpose:
    1. Session Management - Store user context and conversation history
    2. Query Caching - Cache SQL results for performance
    3. File Storage - Store uploaded SQLite databases
    4. Rate Limiting - Track API usage per user
    
    Data Structures Used:
    - Strings: Simple key-value for cache, sessions, files
    - Hashes: Structured data for user sessions
    - Lists: Query history for each user
    - Sets: Track active sessions
    """
    
    def __init__(self):
        """Initialize Redis connection using environment variables"""
        self.host = os.getenv("REDIS_HOST", "localhost")
        self.port = int(os.getenv("REDIS_PORT", 6379))
        self.username = os.getenv("REDIS_USERNAME", "default")
        self.password = os.getenv("REDIS_PASSWORD", "")
        self.ssl = os.getenv("REDIS_SSL", "true").lower() == "true"
        
        # TTL settings
        self.default_ttl = int(os.getenv("REDIS_DEFAULT_TTL", 300))
        self.session_ttl = int(os.getenv("REDIS_SESSION_TTL", 3600))
        self.file_ttl = int(os.getenv("REDIS_FILE_TTL", 86400))
        
        # Connect to Redis Cloud
        self._connect()
        
    def _connect(self):
        """Establish connection to Redis Cloud"""
        try:
            self.client = redis.Redis(
                host=self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                ssl=self.ssl,
                ssl_cert_reqs="required" if self.ssl else None,  # Verify SSL certificate
                decode_responses=False,  # Keep binary data for files
                socket_timeout=15,
                socket_connect_timeout=15,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            # Test connection
            self.client.ping()
            logger.info(f"✅ Connected to Redis Cloud at {self.host}:{self.port}")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis during startup: {e}")
            # We don't raise here so the FastAPI app can still start up.
            # Operations requiring Redis will fail gracefully and return None/False.
            
    def ping(self) -> bool:
        """Check if Redis is connected"""
        try:
            return self.client.ping()
        except:
            return False
    
    # ============================================
    # SESSION MANAGEMENT
    # ============================================
    
    def create_session(self, session_id: str, user_data: Dict[str, Any]) -> bool:
        """
        Create a new user session.
        
        Args:
            session_id: Unique session identifier
            user_data: User metadata (user_id, name, etc.)
        
        Returns:
            True if successful
        """
        try:
            key = f"session:{session_id}"
            self.client.hset(key, mapping=user_data)
            self.client.expire(key, self.session_ttl)
            logger.info(f"✅ Session created: {session_id}")
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to create session: {e}")
            return False
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data"""
        try:
            key = f"session:{session_id}"
            data = self.client.hgetall(key)
            if data:
                # Decode bytes to strings
                return {k.decode('utf-8'): v.decode('utf-8') for k, v in data.items()}
            return None
        except RedisError as e:
            logger.error(f"❌ Failed to get session: {e}")
            return None
    
    def update_session(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """Update session data"""
        try:
            key = f"session:{session_id}"
            self.client.hset(key, mapping=updates)
            self.client.expire(key, self.session_ttl)
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to update session: {e}")
            return False
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        try:
            key = f"session:{session_id}"
            self.client.delete(key)
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to delete session: {e}")
            return False
    
    # ============================================
    # QUERY CONTEXT / CONVERSATION HISTORY
    # ============================================
    
    def add_to_conversation(self, session_id: str, query: str, response: Dict) -> bool:
        """
        Add a query-response pair to conversation history.
        Enables multi-turn conversations with context.
        """
        try:
            key = f"conversation:{session_id}"
            entry = {
                "timestamp": datetime.now().isoformat(),
                "query": query,
                "sql": response.get("sql", ""),
                "row_count": response.get("row_count", 0),
                "execution_time": response.get("execution_time_ms", 0)
            }
            self.client.rpush(key, json.dumps(entry))
            self.client.expire(key, self.session_ttl)
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to add conversation entry: {e}")
            return False
    
    def get_conversation(self, session_id: str, limit: int = 10) -> List[Dict]:
        """
        Get recent conversation history.
        Returns last 'limit' entries for context.
        """
        try:
            key = f"conversation:{session_id}"
            entries = self.client.lrange(key, -limit, -1)
            return [json.loads(e.decode('utf-8')) for e in entries]
        except RedisError as e:
            logger.error(f"❌ Failed to get conversation: {e}")
            return []
    
    def get_conversation_context(self, session_id: str) -> str:
        """
        Get a formatted context string for the LLM.
        Useful for providing conversation history to Groq.
        """
        history = self.get_conversation(session_id, limit=5)
        if not history:
            return ""
        
        context = "Previous conversation (use this to resolve pronouns like 'they', 'them', 'those' or refine previous SQL):\n"
        for entry in history:
            context += f"User asked: {entry['query']}\n"
            if entry.get('sql'):
                context += f"Assistant generated SQL: {entry['sql']}\n"
            context += f"Assistant returned {entry['row_count']} rows\n\n"
        
        return context
    
    # ============================================
    # QUERY RESULT CACHING
    # ============================================
    
    def cache_query_result(self, query: str, result: Dict) -> bool:
        """
        Cache SQL query results.
        Uses MD5 hash of query as key.
        """
        try:
            query_hash = hashlib.md5(query.encode()).hexdigest()
            key = f"query:cache:{query_hash}"
            
            # Add timestamp for TTL management
            cache_entry = {
                "result": result,
                "cached_at": datetime.now().isoformat()
            }
            
            self.client.setex(
                key,
                self.default_ttl,
                json.dumps(cache_entry)
            )
            logger.info(f"✅ Cached query result: {query[:50]}...")
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to cache query: {e}")
            return False
    
    def get_cached_query(self, query: str) -> Optional[Dict]:
        """Get cached query result if it exists"""
        try:
            query_hash = hashlib.md5(query.encode()).hexdigest()
            key = f"query:cache:{query_hash}"
            
            cached = self.client.get(key)
            if cached:
                data = json.loads(cached.decode('utf-8'))
                logger.info(f"✅ Cache hit for: {query[:50]}...")
                return data["result"]
            return None
        except RedisError as e:
            logger.error(f"❌ Failed to get cached query: {e}")
            return None
    
    def invalidate_cache(self, query: str) -> bool:
        """Invalidate a specific cached query"""
        try:
            query_hash = hashlib.md5(query.encode()).hexdigest()
            key = f"query:cache:{query_hash}"
            self.client.delete(key)
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to invalidate cache: {e}")
            return False
            
    def invalidate_all_cache(self) -> bool:
        """Invalidate all cached queries"""
        try:
            keys = self.client.keys("query:cache:*")
            if keys:
                self.client.delete(*keys)
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to invalidate all cache: {e}")
            return False

    def clear_schema_suggestions(self, session_id: str) -> bool:
        """Clear cached schema suggestions for a session"""
        try:
            key = f"suggestions:{session_id}"
            self.client.delete(key)
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to clear schema suggestions: {e}")
            return False
            
    # ============================================
    # AI SCHEMA SUGGESTIONS
    # ============================================
    
    def detect_schema_change(self, session_id: str, current_schema: Dict) -> bool:
        """
        Detect if the schema has changed since last suggestions generation.
        Returns True if changed or no previous schema, False if identical.
        """
        try:
            schema_str = json.dumps(current_schema, sort_keys=True)
            current_hash = hashlib.md5(schema_str.encode()).hexdigest()
            
            key = f"schema:hash:{session_id}"
            stored_hash = self.client.get(key)
            
            if stored_hash:
                stored_hash = stored_hash.decode('utf-8')
                if stored_hash == current_hash:
                    return False
                    
            # Update hash
            self.client.setex(key, 86400, current_hash) # 24 hour TTL
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to detect schema change: {e}")
            return True # Default to changed on error to force regeneration
            
    def store_schema_suggestions(self, session_id: str, suggestions: List[str]) -> bool:
        """Cache AI generated suggestions for 24 hours"""
        try:
            key = f"schema:suggestions:{session_id}"
            self.client.setex(key, 86400, json.dumps(suggestions))
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to store suggestions: {e}")
            return False
            
    def get_schema_suggestions(self, session_id: str) -> Optional[List[str]]:
        """Retrieve cached suggestions"""
        try:
            key = f"schema:suggestions:{session_id}"
            data = self.client.get(key)
            if data:
                return json.loads(data.decode('utf-8'))
            return None
        except RedisError as e:
            logger.error(f"❌ Failed to get suggestions: {e}")
            return None
            
    def clear_schema_suggestions(self, session_id: str) -> bool:
        """Clear cached suggestions to force regeneration"""
        try:
            key_sugg = f"schema:suggestions:{session_id}"
            key_hash = f"schema:hash:{session_id}"
            self.client.delete(key_sugg, key_hash)
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to clear suggestions: {e}")
            return False
    
    # ============================================
    # FILE STORAGE (UPLOADED DATABASES)
    # ============================================
    
    def store_uploaded_file(self, user_id: str, file_data: bytes, filename: str, metadata: Dict) -> str:
        """
        Store uploaded SQLite file in Redis.
        
        Returns file_hash for future reference.
        """
        try:
            # Generate unique hash for the file
            file_hash = hashlib.md5(file_data).hexdigest()
            
            # Store file data as binary
            file_key = f"file:{user_id}:{file_hash}"
            self.client.setex(file_key, self.file_ttl, file_data)
            
            # Store metadata
            metadata_key = f"file:meta:{user_id}:{file_hash}"
            metadata_entries = {
                "filename": filename,
                "hash": file_hash,
                "size": len(file_data),
                "uploaded_at": datetime.now().isoformat(),
                "tables": json.dumps(metadata.get("tables", [])),
                "row_count": metadata.get("total_rows", 0)
            }
            self.client.hset(metadata_key, mapping=metadata_entries)
            self.client.expire(metadata_key, self.file_ttl)
            
            # Add to user's file list
            user_files_key = f"user:files:{user_id}"
            self.client.sadd(user_files_key, file_hash)
            self.client.expire(user_files_key, self.file_ttl)
            
            logger.info(f"✅ File stored: {filename} ({file_hash[:8]})")
            return file_hash
            
        except RedisError as e:
            logger.error(f"❌ Failed to store file: {e}")
            raise
    
    def get_uploaded_file(self, user_id: str, file_hash: str) -> Optional[bytes]:
        """Retrieve uploaded file from Redis"""
        try:
            key = f"file:{user_id}:{file_hash}"
            data = self.client.get(key)
            if data:
                logger.info(f"✅ File retrieved: {file_hash[:8]}")
                return data
            return None
        except RedisError as e:
            logger.error(f"❌ Failed to get file: {e}")
            return None
    
    def get_file_metadata(self, user_id: str, file_hash: str) -> Optional[Dict]:
        """Get file metadata"""
        try:
            key = f"file:meta:{user_id}:{file_hash}"
            data = self.client.hgetall(key)
            if data:
                return {k.decode('utf-8'): v.decode('utf-8') for k, v in data.items()}
            return None
        except RedisError as e:
            logger.error(f"❌ Failed to get file metadata: {e}")
            return None
    
    def get_user_files(self, user_id: str) -> List[str]:
        """Get all file hashes uploaded by a user"""
        try:
            key = f"user:files:{user_id}"
            files = self.client.smembers(key)
            return [f.decode('utf-8') for f in files]
        except RedisError as e:
            logger.error(f"❌ Failed to get user files: {e}")
            return []
    
    def delete_uploaded_file(self, user_id: str, file_hash: str) -> bool:
        """Delete a file from Redis"""
        try:
            # Delete file data
            self.client.delete(f"file:{user_id}:{file_hash}")
            # Delete metadata
            self.client.delete(f"file:meta:{user_id}:{file_hash}")
            # Remove from user's list
            self.client.srem(f"user:files:{user_id}", file_hash)
            logger.info(f"✅ File deleted: {file_hash[:8]}")
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to delete file: {e}")
            return False
    
    # ============================================
    # ACTIVE DATABASE TRACKING
    # ============================================
    
    def set_active_database(self, session_id: str, file_hash: str) -> bool:
        """Set the active database for a session"""
        try:
            key = f"session:{session_id}:active_db"
            # Use file_ttl (24h) instead of session_ttl (1h) so the active db pointer survives as long as the file does
            self.client.setex(key, self.file_ttl, file_hash)
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to set active database: {e}")
            return False
            
    def update_active_database(self, user_id: str, file_data: bytes) -> bool:
        """Update the currently active database file with new data after a write operation"""
        try:
            # Get active db hash
            active_hash = self.get_active_database(user_id)
            if not active_hash:
                return False
                
            # Update file data
            file_key = f"file:{user_id}:{active_hash}"
            self.client.setex(file_key, self.file_ttl, file_data)
            logger.info(f"✅ Active database {active_hash[:8]} updated with new row data")
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to update active database: {e}")
            return False
    
    def get_active_database(self, user_id: str) -> Optional[str]:
        """Get the active database hash for a user"""
        try:
            key = f"session:{user_id}:active_db"
            data = self.client.get(key)
            return data.decode('utf-8') if data else None
        except RedisError as e:
            logger.error(f"❌ Failed to get active database: {e}")
            return None
    
    # ============================================
    # RATE LIMITING
    # ============================================
    
    def check_rate_limit(self, user_id: str, limit: int = 10, window: int = 60) -> bool:
        """
        Check if user has exceeded rate limit.
        
        Args:
            user_id: User identifier
            limit: Max requests per window
            window: Time window in seconds
        
        Returns:
            True if allowed, False if rate limited
        """
        try:
            key = f"rate:limit:{user_id}"
            current = self.client.get(key)
            
            if current is None:
                # First request in window
                self.client.setex(key, window, 1)
                return True
            
            count = int(current.decode('utf-8'))
            if count >= limit:
                logger.warning(f"⚠️ Rate limit exceeded for user {user_id}")
                return False
            
            # Increment counter
            self.client.incr(key)
            return True
            
        except RedisError as e:
            logger.error(f"❌ Rate limit check failed: {e}")
            return True  # Allow on error
    
    # ============================================
    # UTILITY METHODS
    # ============================================
    
    def flush_all(self) -> bool:
        """WARNING: Delete all keys (use only for testing)"""
        try:
            self.client.flushall()
            logger.warning("🗑️ All Redis data flushed")
            return True
        except RedisError as e:
            logger.error(f"❌ Failed to flush: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get Redis server statistics"""
        try:
            info = self.client.info()
            return {
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_mb": info.get("used_memory_human", "0"),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0)
            }
        except RedisError as e:
            logger.error(f"❌ Failed to get stats: {e}")
            return {}
