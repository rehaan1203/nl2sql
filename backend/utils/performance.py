# backend/utils/performance.py - Performance monitoring

import time
import logging
from contextlib import contextmanager
from functools import wraps
from typing import Callable, Any

logger = logging.getLogger(__name__)

@contextmanager
def measure_performance(operation_name: str, log_slow_threshold: float = 2.0):
    """Context manager to measure performance of a block."""
    start = time.time()
    try:
        yield
    finally:
        elapsed = time.time() - start
        if elapsed > log_slow_threshold:
            logger.warning(f"⏱️ SLOW: {operation_name} took {elapsed:.2f}s")
        else:
            logger.info(f"⏱️ {operation_name} took {elapsed:.2f}s")

def performance_monitor(operation_name: str, log_slow_threshold: float = 2.0) -> Callable:
    """Decorator to measure performance of a function."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            with measure_performance(operation_name or func.__name__, log_slow_threshold):
                return func(*args, **kwargs)
        return wrapper
    return decorator
