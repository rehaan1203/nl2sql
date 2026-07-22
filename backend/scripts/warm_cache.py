import os
import sys
import time
from pathlib import Path
from tqdm import tqdm

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from utils.model_cache import ModelCache
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def warm_cache():
    """Warm up the model cache by pre-loading models."""
    logger.info("🔥 Starting cache warmup...")
    start_time = time.time()
    
    model_cache = ModelCache()
    
    # 1. Warm up embeddings model
    embedding_model = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    logger.info(f"📥 Loading embedding model: {embedding_model}")
    
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(embedding_model, cache_folder="./hf_cache")
        model_cache.cache_model(embedding_model, "./hf_cache")
        logger.info(f"✅ Embedding model loaded and cached")
    except Exception as e:
        logger.error(f"❌ Failed to load embedding model: {e}")
    
    # 2. Warm up LLM model (if using Hugging Face)
    if os.getenv("HUGGINGFACEHUB_API_TOKEN"):
        model_name = os.getenv("HF_MODEL_NAME", "mistralai/Mistral-7B-Instruct-v0.1")
        logger.info(f"📥 Loading LLM model: {model_name}")
        
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
            import torch
            
            # Load with optimizations
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir="./hf_cache",
                use_fast=True,
            )
            
            with tqdm(total=100, desc="Caching model", unit="%") as pbar:
                pbar.update(20)
                model = AutoModelForCausalLM.from_pretrained(
                    model_name,
                    cache_dir="./hf_cache",
                    torch_dtype="auto",
                    low_cpu_mem_usage=True,
                    use_safetensors=True,
                    device_map="auto",
                )
                pbar.update(80)
            
            model_cache.cache_model(model_name, "./hf_cache")
            logger.info(f"✅ LLM model loaded and cached")
        except Exception as e:
            logger.error(f"❌ Failed to load LLM model: {e}")
    
    # Clean up old caches if needed
    model_cache.cleanup_old_cache(30)
    model_cache.enforce_size_limit()
    
    elapsed = time.time() - start_time
    logger.info(f"✅ Cache warmup completed in {elapsed:.2f}s")
    
    # Show cache stats
    stats = model_cache.get_cache_stats()
    logger.info(f"📊 Cache stats: {stats}")

if __name__ == "__main__":
    warm_cache()
