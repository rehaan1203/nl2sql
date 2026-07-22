import time
import psutil
import torch
import logging

logger = logging.getLogger(__name__)

class ModelLoadingMetrics:
    """Track model loading performance."""
    
    def __init__(self):
        self.load_times = {}
        self.memory_usage = {}
    
    def track_load(self, model_name: str):
        """Decorator to track model loading."""
        def decorator(func):
            def wrapper(*args, **kwargs):
                start = time.time()
                
                # Record memory before
                if torch.cuda.is_available():
                    memory_before = torch.cuda.memory_allocated() / 1024**3
                else:
                    memory_before = psutil.Process().memory_info().rss / 1024**3
                
                result = func(*args, **kwargs)
                
                # Record memory after
                if torch.cuda.is_available():
                    memory_after = torch.cuda.memory_allocated() / 1024**3
                else:
                    memory_after = psutil.Process().memory_info().rss / 1024**3
                
                elapsed = time.time() - start
                
                self.load_times[model_name] = elapsed
                self.memory_usage[model_name] = {
                    "before_gb": memory_before,
                    "after_gb": memory_after,
                    "delta_gb": memory_after - memory_before
                }
                
                logger.info(f"📊 Model {model_name} loaded in {elapsed:.2f}s")
                logger.info(f"   Memory: {memory_before:.2f}GB → {memory_after:.2f}GB (+{memory_after - memory_before:.2f}GB)")
                
                return result
            return wrapper
        return decorator
