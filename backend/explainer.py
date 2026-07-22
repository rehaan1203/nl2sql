# backend/explainer.py - Natural language explanation generator

import json
import logging
from typing import Dict, Any, List, Optional
from langchain_core.prompts import PromptTemplate
from langchain_mistralai import ChatMistralAI
import os
from utils.metrics import metrics

logger = logging.getLogger(__name__)

class QueryExplainer:
    """
    Generates natural language explanations of query results.
    """
    
    def __init__(self, llm: Optional[ChatMistralAI] = None):
        self.primary_llm = llm or self._init_llm()
        self.fallback_llm = self._init_fallback_llm()
        self.explanation_cache = {}
        self.cache_ttl = 300  # 5 minutes
        
        self.explanation_quality = {
            "total_generated": 0,
            "ai_generated": 0,
            "fallback_generated": 0,
            "cache_hits": 0
        }
    
    def _init_llm(self) -> ChatMistralAI:
        """Initialize primary LLM for explanation generation."""
        return ChatMistralAI(
            model=os.getenv("EXPLANATION_MODEL", os.getenv("AI_MODEL", "mistral-small-latest")),
            api_key=os.getenv("MISTRAL_API_KEY"),
            temperature=float(os.getenv("EXPLANATION_TEMPERATURE", 0.3))
        )
        
    def _init_fallback_llm(self) -> ChatMistralAI:
        """Initialize fallback LLM (smaller model)."""
        return ChatMistralAI(
            model="mistral-small-latest",
            api_key=os.getenv("MISTRAL_API_KEY"),
            temperature=0.2
        )
    
    def get_metrics(self) -> Dict:
        """Get explanation metrics."""
        return {
            "explanations": self.explanation_quality,
            "cache_size": len(self.explanation_cache),
            "cache_ttl": self.cache_ttl
        }
        
    def invalidate_cache(self, table_name: str = None):
        """Invalidate explanation cache for a table or all tables."""
        if table_name:
            keys_to_remove = [k for k in self.explanation_cache.keys() if table_name in k]
            for key in keys_to_remove:
                del self.explanation_cache[key]
            logger.info(f"🗑️ Invalidated explanation cache for table: {table_name}")
        else:
            self.explanation_cache.clear()
            logger.info("🗑️ Invalidated all explanation cache")
    
    def explain_query(
        self, 
        natural_language: str, 
        sql: str, 
        data: List[Dict], 
        row_count: int,
        columns: List[str],
        operation_type: str = "SELECT",
        affected_rows: int = 0
    ) -> str:
        """Generate natural language explanation of query results."""
        self.explanation_quality["total_generated"] += 1
        
        # Handle non-SELECT operations immediately
        if operation_type != "SELECT":
            if operation_type == "UPDATE":
                return f"Successfully updated {affected_rows} record(s) matching your request."
            elif operation_type == "INSERT":
                return f"Successfully inserted {affected_rows} record(s) as requested."
            elif operation_type == "DELETE":
                return f"Successfully deleted {affected_rows} record(s) matching your request."
            else:
                return f"Successfully executed {operation_type} operation affecting {affected_rows} record(s)."
        
        # Check cache
        cache_key = f"{natural_language}_{row_count}_{hash(str(data[:3]))}"
        if cache_key in self.explanation_cache:
            self.explanation_quality["cache_hits"] += 1
            return self.explanation_cache[cache_key]
        
        # Determine if we need AI explanation or can use template
        if row_count == 0:
            explanation = self._explain_empty_result(natural_language)
            self.explanation_quality["fallback_generated"] += 1
        elif row_count == 1 and len(data) == 1:
            explanation = self._explain_single_result(natural_language, data[0], columns)
            self.explanation_quality["fallback_generated"] += 1
        elif row_count <= 5:
            explanation = self._explain_small_result(natural_language, data, columns, row_count)
            self.explanation_quality["fallback_generated"] += 1
        else:
            explanation = self._generate_ai_explanation(natural_language, sql, data, row_count, columns)
            # _generate_ai_explanation handles its own quality counters
        
        # Cache the explanation
        self.explanation_cache[cache_key] = explanation
        
        return explanation
    
    def _explain_empty_result(self, natural_language: str) -> str:
        return f"I couldn't find any data matching your question: '{natural_language}'. Try adjusting your query or checking the data."
    
    def _explain_single_result(self, natural_language: str, row: Dict, columns: List[str]) -> str:
        details = []
        for col in columns:
            if row.get(col) is not None:
                details.append(f"{col}: {row[col]}")
        return f"I found 1 result for your question. Here are the details: {', '.join(details)}"
    
    def _explain_small_result(self, natural_language: str, data: List[Dict], columns: List[str], row_count: int) -> str:
        summary = []
        for i, row in enumerate(data[:3], 1):
            details = []
            for col in columns[:3]:
                if row.get(col) is not None:
                    details.append(f"{col}: {row[col]}")
            summary.append(f"Row {i}: {', '.join(details)}")
        
        result = f"I found {row_count} results for your question."
        result += "\n" + "\n".join(summary)
        if row_count > 3:
            result += f"\n... and {row_count - 3} more rows."
        return result
        
    def _call_llm(self, llm_instance, prompt: str) -> Any:
        return llm_instance.invoke(prompt)
    
    def _generate_ai_explanation(
        self, 
        natural_language: str, 
        sql: str, 
        data: List[Dict], 
        row_count: int,
        columns: List[str]
    ) -> str:
        sample_data = data[:10]
        data_summary = json.dumps(sample_data, indent=2)
        
        prompt_template = PromptTemplate(
            input_variables=["question", "sql", "row_count", "columns", "data_summary"],
            template="""
You are a data analyst explaining query results to a non-technical user.

User Question: {question}
SQL Query: {sql}
Rows Returned: {row_count}
Columns: {columns}
Sample Data: {data_summary}

Generate a brief, clear explanation (2-3 sentences) that:
1. Summarizes what the query found
2. Highlights the most interesting or relevant findings
3. Uses plain language (no technical jargon)
4. Answers the user's original question

Be concise but informative. Focus on the key insights from the data.
"""
        )
        
        prompt = prompt_template.format(
            question=natural_language,
            sql=sql,
            row_count=row_count,
            columns=", ".join(columns),
            data_summary=data_summary
        )
        
        response = None
        try:
            # Try primary model
            response = self._call_llm(self.primary_llm, prompt)
        except Exception as e:
            logger.warning(f"Primary explanation model failed: {e}, trying fallback")
            try:
                # Try fallback model
                response = self._call_llm(self.fallback_llm, prompt)
            except Exception as e2:
                logger.error(f"Fallback explanation model also failed: {e2}")
                self.explanation_quality["fallback_generated"] += 1
                return self._generate_fallback_explanation(natural_language, row_count, columns)
                
        if response:
            explanation = str(response.content).strip()
            explanation = self._clean_explanation(explanation)
            
            # Token tracking
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                usage = response.usage_metadata
                prompt_tokens = usage.get('input_tokens', usage.get('prompt_tokens', 0))
                completion_tokens = usage.get('output_tokens', usage.get('completion_tokens', 0))
                metrics.record_token_usage(prompt_tokens, completion_tokens)
                logger.info(f"📊 Explanation tokens: {prompt_tokens} prompt, {completion_tokens} completion")
                
            self.explanation_quality["ai_generated"] += 1
            return explanation
            
        return self._generate_fallback_explanation(natural_language, row_count, columns)
    
    def _generate_fallback_explanation(self, natural_language: str, row_count: int, columns: List[str]) -> str:
        col_names = ", ".join(columns[:3])
        if len(columns) > 3:
            col_names += f" and {len(columns) - 3} more columns"
        return f"I found {row_count} results for your question. The data shows {col_names}. This is the result of your query: '{natural_language}'."
    
    def _clean_explanation(self, explanation: str) -> str:
        explanation = explanation.replace("```", "")
        explanation = explanation.replace("**", "")
        explanation = explanation.replace("__", "")
        explanation = explanation.replace("SQL:", "")
        explanation = explanation.replace("sql:", "")
        
        if explanation and not explanation.endswith(('.', '!', '?')):
            explanation += '.'
        
        return explanation.strip()
