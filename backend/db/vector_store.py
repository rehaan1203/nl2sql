# vector_store.py - With Hugging Face Embeddings

import os
import json
from typing import List, Dict, Optional
import chromadb
import torch
from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
import logging

logger = logging.getLogger(__name__)

class VectorStore:
    """
    Vector store for database schema using ChromaDB with Hugging Face embeddings.
    Enables semantic search to find relevant tables based on natural language.
    
    Why Hugging Face embeddings?
    - FREE: No cost for embedding generation
    - Open-source: all-MiniLM-L6-v2 is fast and accurate
    - Local: Runs on your CPU, no API calls needed for embeddings
    """
    
    def __init__(self, embeddings=None, persist_dir: str = "./chroma_db", session_id: Optional[str] = None):
        self.session_id = session_id
        self.persist_dir = f"./chroma_db_{session_id}" if session_id else persist_dir
        self.collection_name = f"schema_embeddings_{session_id}" if session_id else "schema_embeddings"
        
        # ============================================
        # REAL AI: Hugging Face Embeddings (FREE)
        # ============================================
        embedding_model = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        
        try:
            # Prefer passed embeddings, or initialize our own
            if embeddings:
                self.embeddings = embeddings
            else:
                self.embeddings = HuggingFaceEmbeddings(
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
                logger.info(f"✅ Hugging Face embeddings initialized with model: {embedding_model}")
                logger.info(f"   - Device: {'cuda' if torch.cuda.is_available() else 'cpu'}")
                logger.info(f"   - dtype: {'float16' if torch.cuda.is_available() else 'float32'}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Hugging Face embeddings: {e}")
            self.embeddings = None
        
        # Initialize Chroma
        self.vectorstore = Chroma(
            persist_directory=persist_dir,
            embedding_function=self.embeddings if self.embeddings else None,
            collection_name=self.collection_name
        )
    
    def ingest_schema(self, schema_data):
        """
        Convert database schema to vector embeddings using Hugging Face.
        Each table becomes a document with its schema as text.
        """
        if not self.embeddings:
            logger.warning("⚠️ No embeddings available - skipping vector store ingestion")
            return
            
        # Clear existing documents to prevent cross-contamination
        existing_ids = self._get_all_table_names()
        if existing_ids:
            try:
                self.vectorstore.delete(ids=existing_ids)
            except Exception as e:
                logger.warning(f"Could not delete old schema embeddings: {e}")
        
        documents = []
        metadatas = []
        ids = []
        
        for table in schema_data.tables:
            # Create descriptive text for the table
            schema_text = self._format_table_for_embedding(table)
            
            doc = Document(
                page_content=schema_text,
                metadata={
                    "table_name": table.name,
                    "columns": json.dumps([c.name for c in table.columns]),
                    "row_count": table.row_count
                }
            )
            documents.append(doc)
            metadatas.append(doc.metadata)
            ids.append(table.name)
        
        # Add to vector store
        self.vectorstore.add_documents(
            documents=documents,
            ids=ids
        )
        self.vectorstore.persist()
        
        logger.info(f"✅ Ingested {len(documents)} tables into vector store with Hugging Face embeddings")
    
    def search(self, query: str, top_k: int = 5) -> List[str]:
        """
        Search for relevant tables based on natural language query.
        Returns table names that are semantically relevant.
        """
        if not self.embeddings or not self.vectorstore:
            logger.warning("⚠️ No embeddings available - returning all table names")
            return self._get_all_table_names()
        
        try:
            results = self.vectorstore.similarity_search(query, k=top_k)
            return [r.metadata['table_name'] for r in results]
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return self._get_all_table_names()
    
    def _format_table_for_embedding(self, table) -> str:
        """Format table schema for embedding creation"""
        text = f"Table: {table.name}\n"
        text += f"Columns: {', '.join([c.name for c in table.columns])}\n"
        text += f"Column details:\n"
        for col in table.columns:
            text += f"  - {col.name}: {col.type}"
            if col.primary_key:
                text += " (Primary Key)"
            if col.foreign_key:
                text += f" (Foreign Key to {col.foreign_key})"
            text += "\n"
        return text
    
    def _get_all_table_names(self) -> List[str]:
        """Fallback: get all table names from the store"""
        try:
            collection = self.vectorstore._collection
            results = collection.get()
            return results['ids']
        except:
            return []

    def clear_session_store(self):
        """Clear vector store for current session when database changes"""
        if self.session_id:
            # Delete session-specific collection
            try:
                self.vectorstore.delete_collection()
                self.vectorstore = Chroma(
                    persist_directory=self.persist_dir,
                    embedding_function=self.embeddings,
                    collection_name=self.collection_name
                )
                logger.info(f"🗑️ Cleared vector store for session: {self.session_id}")
            except Exception as e:
                logger.warning(f"Could not clear session store: {e}")
