# backend/utils/metrics.py - Performance metrics

import time
import logging
from contextlib import contextmanager
from functools import wraps
from typing import Dict, Any
from datetime import datetime
from collections import deque

logger = logging.getLogger(__name__)

class MetricsCollector:
    """Collect and track performance metrics."""
    
    def __init__(self):
        self.query_times = deque(maxlen=100)
        self.token_usage = deque(maxlen=100)
        self.error_counts = {}
        self.query_counts = {"total": 0, "success": 0, "error": 0}
    
    def record_query_time(self, duration: float, query_type: str = "unknown"):
        """Record query execution time."""
        self.query_times.append({
            "duration": duration,
            "timestamp": datetime.now().isoformat(),
            "type": query_type
        })
        self.query_counts["total"] += 1
        
        # Log slow queries
        if duration > 2.0:
            logger.warning(f"⏱️ SLOW QUERY: {duration:.2f}s ({query_type})")
    
    def record_token_usage(self, prompt_tokens: int, completion_tokens: int):
        """Record token usage for a request."""
        total = prompt_tokens + completion_tokens
        self.token_usage.append({
            "prompt": prompt_tokens,
            "completion": completion_tokens,
            "total": total,
            "timestamp": datetime.now().isoformat()
        })
        
        # Log high token usage
        if total > 500:
            logger.warning(f"📊 HIGH TOKEN USAGE: {total} tokens (prompt: {prompt_tokens}, completion: {completion_tokens})")
    
    def record_error(self, error_type: str):
        """Record an error occurrence."""
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
        self.query_counts["error"] += 1
    
    def record_success(self):
        """Record a successful query."""
        self.query_counts["success"] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current metrics statistics."""
        avg_time = sum(t["duration"] for t in self.query_times) / len(self.query_times) if self.query_times else 0
        avg_tokens = sum(t["total"] for t in self.token_usage) / len(self.token_usage) if self.token_usage else 0
        
        return {
            "queries": {
                "total": self.query_counts["total"],
                "success": self.query_counts["success"],
                "error": self.query_counts["error"],
                "success_rate": (self.query_counts["success"] / self.query_counts["total"] * 100) if self.query_counts["total"] > 0 else 0
            },
            "performance": {
                "avg_query_time": avg_time,
                "max_query_time": max((t["duration"] for t in self.query_times), default=0),
                "avg_token_usage": avg_tokens,
                "max_token_usage": max((t["total"] for t in self.token_usage), default=0)
            },
            "errors": self.error_counts
        }

# Global metrics instance
metrics = MetricsCollector()

@contextmanager
def measure_performance(operation: str):
    """Context manager to measure performance of a block."""
    start = time.time()
    try:
        yield
    finally:
        duration = time.time() - start
        metrics.record_query_time(duration, operation)
        logger.info(f"⏱️ {operation} completed in {duration:.2f}s")

def track_token_usage(func):
    """Decorator to track token usage for functions."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        result = await func(*args, **kwargs)
        
        # Extract token usage from result if available
        if isinstance(result, dict):
            prompt_tokens = result.get("prompt_tokens", 0)
            completion_tokens = result.get("completion_tokens", 0)
            if prompt_tokens or completion_tokens:
                metrics.record_token_usage(prompt_tokens, completion_tokens)
        
        return result
    return wrapper
