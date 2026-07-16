import json
import logging
import random
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
from prompt_manager import PromptManager
from prompts.suggestions import SuggestionsPrompts
from data_profiler import DataProfiler

logger = logging.getLogger(__name__)

class SchemaAnalyzer:
    def __init__(self, llm):
        """
        Initialize the SchemaAnalyzer with a LangChain LLM instance (ChatGroq).
        """
        self.llm = llm
        self.prompt_manager = PromptManager()

    def analyze_schema(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze schema to extract tables and key columns (numeric, date) for better context.
        """
        analysis = {
            "tables": [],
            "key_columns": []
        }
        try:
            for table_name, table_info in schema.items():
                analysis["tables"].append(table_name)
                columns = table_info.get("columns", [])
                for col in columns:
                    col_type = col.get("type", "").lower()
                    if "int" in col_type or "date" in col_type or "float" in col_type or "num" in col_type:
                        analysis["key_columns"].append(f"{table_name}.{col['name']}")
        except Exception as e:
            logger.error(f"Error analyzing schema: {e}")
        return analysis

    def generate_suggestions(self, schema: Dict[str, Any], analysis: Dict[str, Any], db_path: str = None) -> List[str]:
        """
        Generate 5 context-aware questions based on the database schema and actual data facts.
        Falls back to default questions if generation fails.
        """
        if not self.llm:
            logger.warning("No LLM provided to SchemaAnalyzer. Using default suggestions.")
            return SuggestionsPrompts.FALLBACK_SUGGESTIONS
            
        schema_description = f"Schema:\n{json.dumps(schema, indent=2)}\n\nAnalysis:\n{json.dumps(analysis, indent=2)}"
        
        facts_list = []
        if db_path:
            try:
                profiler = DataProfiler(db_path)
                tables = analysis.get("tables", [])
                # Profile up to 3 tables to prevent long latency
                for table in tables[:3]:
                    facts_list.extend(profiler.get_interesting_facts(table))
            except Exception as e:
                logger.error(f"Error gathering data facts: {e}")
                
        data_facts = "\n".join([f"- {fact}" for fact in facts_list]) if facts_list else "No specific data facts available."
        
        prompt = self.prompt_manager.get_prompt(
            "suggestion_generation",
            schema_description=schema_description,
            data_facts=data_facts
        )
        
        try:
            response = self.llm.invoke(prompt)
            content = response.content.strip()
            
            # Fallback for markdown blocks if LLM ignores instruction
            if content.startswith("```json"):
                content = content[7:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
            content = content.strip()
            
            suggestions = json.loads(content)
            
            if isinstance(suggestions, list) and len(suggestions) > 0:
                # Limit to 5 and ensure strings
                return [str(s) for s in suggestions][:5]
            else:
                logger.error("AI returned JSON, but it was not a list.")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI suggestions as JSON: {e}\nRaw content: {content}")
        except Exception as e:
            logger.error(f"Failed to generate AI suggestions: {e}")
            
        return SuggestionsPrompts.FALLBACK_SUGGESTIONS

    def generate_table_suggestions(
        self, 
        table_name: str, 
        user_id: str = None,
        force_refresh: bool = False,
        db_path: str = None,
        redis_client = None
    ) -> List[str]:
        """
        Generate table-specific suggestions.
        ONLY generates questions for the specified table.
        """
        # Check Redis cache first
        if redis_client and user_id and not force_refresh:
            cache_key = f"suggestions:{user_id}:{table_name}"
            cached = redis_client.client.get(cache_key)
            if cached:
                logger.info(f"💾 Using cached suggestions for table: {table_name}")
                return json.loads(cached)
        
        table_context = ""
        table_facts = []
        if db_path:
            try:
                profiler = DataProfiler(db_path)
                table_context = profiler.get_table_context(table_name)
                table_facts = profiler.get_table_facts(table_name)
            except Exception as e:
                logger.error(f"Error gathering data facts for table {table_name}: {e}")
        
        # Build prompt
        prompt = self._build_table_specific_prompt(table_name, table_context, table_facts, force_refresh)
        
        try:
            response = self.llm.invoke(prompt)
            content = response.content.strip()
            
            # Fallback for markdown blocks if LLM ignores instruction
            if content.startswith("```json"):
                content = content[7:]
            elif content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
            content = content.strip()
            suggestions = json.loads(content)
            
            # Validate suggestions (ensure they only use this table)
            if isinstance(suggestions, list):
                valid_suggestions = self._validate_table_specific([str(s) for s in suggestions], table_name)
            else:
                valid_suggestions = self._get_fallback_suggestions(table_name)
            
            # Cache in Redis
            if redis_client and user_id:
                cache_key = f"suggestions:{user_id}:{table_name}"
                redis_client.client.setex(
                    cache_key,
                    86400,  # 24 hour TTL
                    json.dumps(valid_suggestions[:5])
                )
            
            return valid_suggestions[:5]
            
        except Exception as e:
            logger.error(f"Failed to generate table-specific suggestions: {e}")
            return self._get_fallback_suggestions(table_name)

    def _build_table_specific_prompt(self, table_name: str, context: str, facts: List[str], force_refresh: bool = False) -> str:
        """
        Build a prompt that generates questions for ONLY one table.
        """
        refresh_instruction = ""
        if force_refresh:
            refresh_instruction = f"\nCRITICAL: This is a REFRESH request. Generate completely NEW, DIVERSE, and UNIQUE questions different from typical ones. Think outside the box (Random seed variant: {random.randint(1, 10000)})."

        prompt_template = f"""
You are a data analyst. Based on the ACTUAL data in the following table, generate 5 natural language questions.{{refresh_instruction}}

CRITICAL RULES:
1. Questions MUST ONLY reference the table: {table_name}
2. Questions MUST NOT reference other tables (no JOINs, no cross-table queries)
3. Questions MUST be based on ACTUAL data that exists in this table
4. Use the actual column names from this table
5. Questions should be specific and answerable with a SELECT query on this single table

Table Context:
{context}

Data Facts:
{facts}

Generate 5 questions that:
1. Only use columns from the {table_name} table
2. Return meaningful results from this table
3. Cover different aspects of the data (aggregations, filtering, sorting, etc.)

Return ONLY the questions as a JSON array of strings.
Example: ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
"""
        return prompt_template.format(
            table_name=table_name,
            context=context,
            facts='\n'.join(facts) if facts else "No specific facts available.",
            refresh_instruction=refresh_instruction
        )

    def _validate_table_specific(self, suggestions: List[str], table_name: str) -> List[str]:
        valid_suggestions = []
        cross_table_keywords = ['join', 'related', 'associated', 'with', 'together', 
                               'combined', 'linked', 'connected', 'relate', 'reference']
        
        for suggestion in suggestions:
            suggestion_lower = suggestion.lower()
            if any(kw in suggestion_lower for kw in cross_table_keywords):
                if table_name.lower() not in suggestion_lower:
                    continue
            valid_suggestions.append(suggestion)
        
        if len(valid_suggestions) < 3:
            fallback = self._get_fallback_suggestions(table_name)
            valid_suggestions.extend(fallback)
        
        return valid_suggestions

    def _get_fallback_suggestions(self, table_name: str) -> List[str]:
        return [
            f"Show me all data from the {table_name} table",
            f"How many records are in the {table_name} table?",
            f"Show me a summary of the {table_name} table",
            f"What columns are in the {table_name} table?",
            f"Show me the most recent records from the {table_name} table"
        ]
