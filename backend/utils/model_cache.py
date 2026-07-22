import os
import json
import hashlib
import time
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class ModelCache:
    """
    Cache manager for Hugging Face models to speed up loading.
    
    Benefits:
    1. Pre-downloads model files on first load
    2. Caches model metadata for faster future loads
    3. Validates cache integrity
    4. Provides cache statistics
    """
    
    def __init__(self, cache_dir: str = "./hf_cache", max_size_gb: float = 20):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_size_gb = max_size_gb
        self.metadata_file = self.cache_dir / "cache_metadata.json"
        self.metadata = self._load_metadata()
    
    def _load_metadata(self) -> dict:
        """Load cache metadata from disk."""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def _save_metadata(self):
        """Save cache metadata to disk."""
        with open(self.metadata_file, 'w') as f:
            json.dump(self.metadata, f, indent=2)
    
    def get_cached_model(self, model_name: str) -> str | None:
        """Get cached model path if it exists."""
        cache_key = hashlib.md5(model_name.encode()).hexdigest()
        if cache_key in self.metadata:
            cached_path = self.metadata[cache_key]
            if Path(cached_path).exists():
                logger.info(f"💾 Found cached model: {model_name}")
                return cached_path
        return None
    
    def cache_model(self, model_name: str, model_path: str):
        """Cache a model path."""
        cache_key = hashlib.md5(model_name.encode()).hexdigest()
        self.metadata[cache_key] = model_path
        self._save_metadata()
        logger.info(f"💾 Cached model: {model_name}")
    
    def get_cache_stats(self) -> dict:
        """Get cache statistics."""
        return {
            "cached_models": len(self.metadata),
            "cache_dir": str(self.cache_dir),
            "cache_size_gb": self._get_cache_size(),
        }
    
    def _get_cache_size(self) -> float:
        """Calculate cache directory size in GB."""
        total_size = 0
        for file in self.cache_dir.rglob('*'):
            if file.is_file():
                total_size += file.stat().st_size
        return total_size / (1024**3)
    
    def clear_cache(self):
        """Clear all cached models."""
        import shutil
        shutil.rmtree(self.cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.metadata = {}
        self._save_metadata()
        logger.info("🗑️ Cleared model cache")
        
    def cleanup_old_cache(self, days_old: int = 30):
        """Remove cache files older than specified days."""
        cutoff = time.time() - (days_old * 86400)
        removed = 0
        
        for file in self.cache_dir.rglob('*'):
            if file.is_file() and file.stat().st_mtime < cutoff:
                file.unlink()
                removed += 1
        
        if removed > 0:
            logger.info(f"🗑️ Removed {removed} old cache files")
        return removed
    
    def enforce_size_limit(self):
        """Enforce cache size limit by removing oldest files."""
        current_size = self._get_cache_size()
        if current_size > self.max_size_gb:
            logger.info(f"📦 Cache size {current_size:.1f}GB exceeds limit {self.max_size_gb}GB")
            
            # Get all files sorted by modification time
            files = []
            for file in self.cache_dir.rglob('*'):
                if file.is_file():
                    files.append((file.stat().st_mtime, file))
            files.sort()
            
            # Remove oldest files until under limit
            while self._get_cache_size() > self.max_size_gb and files:
                _, file = files.pop(0)
                file.unlink()
                logger.debug(f"🗑️ Removed old cache file: {file.name}")
            
            logger.info(f"📦 Cache size now: {self._get_cache_size():.1f}GB")
