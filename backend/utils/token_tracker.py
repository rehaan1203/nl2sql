# backend/utils/token_tracker.py - Token usage tracking

import logging
from datetime import datetime
from typing import Dict, List, Optional
from collections import deque

logger = logging.getLogger(__name__)

class TokenTracker:
    """Track token usage for monitoring and optimization."""
    
    def __init__(self, max_history: int = 100):
        self.usage_history = deque(maxlen=max_history)
        self.total_tokens = 0
        self.total_requests = 0
    
    def log_usage(self, prompt_tokens: int, completion_tokens: int, model: str, operation: str = "query"):
        """Log token usage for a request."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "model": model,
            "operation": operation
        }
        self.usage_history.append(entry)
        self.total_tokens += entry["total_tokens"]
        self.total_requests += 1
        
        logger.info(f"📊 Token usage: {entry['total_tokens']} tokens ({prompt_tokens} prompt, {completion_tokens} completion)")
        
        # Warn if usage is high
        if entry["total_tokens"] > 500:
            logger.warning(f"⚠️ High token usage: {entry['total_tokens']} tokens for operation: {operation}")
    
    def get_stats(self) -> Dict:
        """Get token usage statistics."""
        if not self.usage_history:
            return {
                "total_requests": 0,
                "total_tokens": 0,
                "avg_total": 0,
                "avg_prompt": 0,
                "avg_completion": 0,
                "max_total": 0,
                "min_total": 0
            }
        
        totals = [e["total_tokens"] for e in self.usage_history]
        prompts = [e["prompt_tokens"] for e in self.usage_history]
        completions = [e["completion_tokens"] for e in self.usage_history]
        
        return {
            "total_requests": self.total_requests,
            "total_tokens": self.total_tokens,
            "avg_total": sum(totals) / len(totals),
            "avg_prompt": sum(prompts) / len(prompts),
            "avg_completion": sum(completions) / len(completions),
            "max_total": max(totals) if totals else 0,
            "min_total": min(totals) if totals else 0,
            "last_usage": self.usage_history[-1] if self.usage_history else None
        }
    
    def reset(self):
        """Reset tracking data."""
        self.usage_history.clear()
        self.total_tokens = 0
        self.total_requests = 0
        logger.info("🔄 Token tracker reset")

# Global token tracker instance
token_tracker = TokenTracker()
