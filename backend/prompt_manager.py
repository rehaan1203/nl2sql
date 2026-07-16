# backend/prompt_manager.py - Central prompt management

import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from prompts import (
    SQLGenerationPrompts,
    OperationDetectionPrompts,
    ExplanationPrompts,
    ValidationPrompts,
    SuggestionsPrompts,
    ErrorCorrectionPrompts,
    SystemPrompts
)

logger = logging.getLogger(__name__)

class PromptManager:
    """
    Centralized prompt management system.
    Handles prompt loading, versioning, and injection.
    
    Features:
    1. Load prompts from dedicated prompt files
    2. Support for versioning (A/B testing)
    3. Prompt injection with variables
    4. Logging of prompts used
    5. Fallback to default prompts
    """
    
    def __init__(self):
        self.prompts = {}
        self.prompt_history = []
        self._load_prompts()
    
    def _load_prompts(self):
        """Load all prompts from the prompts module."""
        self.prompts = {
            # System prompts
            "system_base": SystemPrompts.BASE_SYSTEM_PROMPT,
            "system_sql_generation": SystemPrompts.SQL_GENERATION_SYSTEM,
            "system_write_safety": SystemPrompts.WRITE_OPERATION_SAFETY,
            
            # SQL generation
            "sql_generation": SQLGenerationPrompts.SQL_GENERATION_TEMPLATE,
            "sql_select": SQLGenerationPrompts.SELECT_GENERATION,
            "sql_insert": SQLGenerationPrompts.INSERT_GENERATION,
            "sql_update": SQLGenerationPrompts.UPDATE_GENERATION,
            "sql_delete": SQLGenerationPrompts.DELETE_GENERATION,
            
            # Operation detection
            "operation_detection": OperationDetectionPrompts.OPERATION_DETECTION_TEMPLATE,
            
            # Explanations
            "explanation": ExplanationPrompts.EXPLANATION_TEMPLATE,
            "explanation_detailed": ExplanationPrompts.DETAILED_EXPLANATION,
            
            # Validation
            "validation": ValidationPrompts.VALIDATION_TEMPLATE,
            "error_correction": ValidationPrompts.ERROR_CORRECTION,
            "safety_check": ValidationPrompts.SAFETY_CHECK,
            
            # Suggestions
            "suggestion_generation": SuggestionsPrompts.SUGGESTION_GENERATION,
            
            # Error correction
            "error_correction_main": ErrorCorrectionPrompts.ERROR_CORRECTION_TEMPLATE,
            "constraint_handling": ErrorCorrectionPrompts.CONSTRAINT_VIOLATION,
            "alternative_approach": ErrorCorrectionPrompts.ALTERNATIVE_APPROACH
        }
        
        # Load custom prompts from files if they exist
        self._load_custom_prompts()
        
        logger.info(f"✅ Loaded {len(self.prompts)} prompts")
    
    def _load_custom_prompts(self):
        """Load custom prompts from the prompts directory."""
        prompt_dir = os.path.join(os.path.dirname(__file__), 'prompts', 'custom')
        if os.path.exists(prompt_dir):
            for file in os.listdir(prompt_dir):
                if file.endswith('.txt'):
                    with open(os.path.join(prompt_dir, file), 'r') as f:
                        key = file.replace('.txt', '')
                        self.prompts[key] = f.read()
                        logger.info(f"📝 Loaded custom prompt: {key}")
    
    def get_prompt(self, key: str, **kwargs) -> str:
        """
        Get a prompt by key and inject variables.
        
        Args:
            key: Prompt key
            **kwargs: Variables to inject into the prompt
        
        Returns:
            Formatted prompt string
        """
        if key not in self.prompts:
            logger.warning(f"⚠️ Prompt key not found: {key}")
            return self._get_fallback_prompt(key)
        
        prompt = self.prompts[key]
        
        # Log the prompt being used
        self._log_prompt(key, prompt, kwargs)
        
        # Inject variables
        try:
            return prompt.format(**kwargs)
        except KeyError as e:
            logger.error(f"❌ Missing variable in prompt: {e}")
            return prompt.replace('{', '[').replace('}', ']')
    
    def _get_fallback_prompt(self, key: str) -> str:
        """Get a fallback prompt if the key doesn't exist."""
        fallbacks = {
            "sql_generation": "Generate SQL for: {natural_language}. Schema: {schema_context}",
            "operation_detection": "What operation is: {question}? Return SELECT, INSERT, UPDATE, or DELETE.",
            "explanation": "Explain this SQL: {sql}",
            "validation": "Validate this SQL: {sql}",
            "suggestion_generation": "Generate questions for this schema: {schema_description}"
        }
        
        fallback = fallbacks.get(key, "Default prompt for: {key}")
        return fallback.replace('{', '[').replace('}', ']')
    
    def _log_prompt(self, key: str, prompt: str, kwargs: Dict):
        """Log the prompt being used for debugging."""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "key": key,
            "variables": list(kwargs.keys()),
            "preview": prompt[:100] + "..." if len(prompt) > 100 else prompt
        }
        self.prompt_history.append(log_entry)
        
        # Keep only last 100 entries
        if len(self.prompt_history) > 100:
            self.prompt_history = self.prompt_history[-100:]
    
    def get_prompt_history(self, limit: int = 10) -> list:
        """Get recent prompt usage history."""
        return self.prompt_history[-limit:]
    
    def update_prompt(self, key: str, new_prompt: str) -> bool:
        """
        Update a prompt at runtime (useful for testing).
        
        Args:
            key: Prompt key to update
            new_prompt: New prompt content
        
        Returns:
            True if successful
        """
        if key in self.prompts:
            self.prompts[key] = new_prompt
            logger.info(f"📝 Updated prompt: {key}")
            return True
        return False
    
    def add_custom_prompt(self, key: str, prompt: str) -> bool:
        """
        Add a custom prompt at runtime.
        
        Args:
            key: Prompt key
            prompt: Prompt content
        
        Returns:
            True if successful
        """
        if key in self.prompts:
            logger.warning(f"⚠️ Prompt key already exists: {key}")
            return False
        
        self.prompts[key] = prompt
        logger.info(f"📝 Added custom prompt: {key}")
        return True
    
    def save_custom_prompt(self, key: str, prompt: str) -> bool:
        """
        Save a custom prompt to a file for persistence.
        
        Args:
            key: Prompt key
            prompt: Prompt content
        
        Returns:
            True if successful
        """
        prompt_dir = os.path.join(os.path.dirname(__file__), 'prompts', 'custom')
        os.makedirs(prompt_dir, exist_ok=True)
        
        file_path = os.path.join(prompt_dir, f"{key}.txt")
        with open(file_path, 'w') as f:
            f.write(prompt)
        
        # Also update in-memory
        self.prompts[key] = prompt
        
        logger.info(f"💾 Saved prompt to: {file_path}")
        return True

    def get_sql_generation_prompt(
        self, 
        question: str, 
        schema_context: str,
        include_examples: bool = True,
        strict_mode: bool = True
    ) -> str:
        """
        Generate a prompt that enforces strict SQL output.
        """
        system = """You are an expert SQL generator. Your ONLY output is the SQL query.

RULES:
1. Output ONLY the SQL query - no explanations
2. NO markdown, NO backticks, NO quotes around the SQL
3. Use ONLY the tables and columns from the schema
4. If the question cannot be answered, output: NO_SQL: Reason
5. Always include a WHERE clause for UPDATE and DELETE
6. Always include a semicolon at the end

GOOD EXAMPLES:
- Question: "Show me all users"
- SQL: SELECT * FROM users;

- Question: "How many users are from California?"
- SQL: SELECT COUNT(*) FROM users WHERE state = 'CA';

- Question: "Add a new user called John"
- SQL: INSERT INTO users (name) VALUES ('John');

BAD EXAMPLES:
- ❌ "Here is your SQL: SELECT * FROM users"
- ❌ "```sql SELECT * FROM users ```"
- ❌ "The query would be: SELECT * FROM users"

Remember: ONLY the SQL query, nothing else."""
        
        examples = ""
        if include_examples:
            examples = self.get_few_shot_examples()
            
        prompt_parts = [
            system,
            f"\nSchema Context:\n{schema_context}",
            examples,
            f"\nUser Question: {question}",
            "\nSQL Query:"
        ]
        
        return "\n".join(prompt_parts)
    
    def get_few_shot_examples(self) -> str:
        """Provide few-shot examples for SQL generation"""
        return """
EXAMPLES:

1. Question: "Show me all records from the meetings table"
   SQL: SELECT * FROM meetings;

2. Question: "How many meetings are scheduled for this week?"
   SQL: SELECT COUNT(*) FROM meetings WHERE date >= DATE('now', 'weekday 0', '-7 days');

3. Question: "Add a new meeting called 'Team Sync' for tomorrow"
   SQL: INSERT INTO meetings (title, date) VALUES ('Team Sync', DATE('now', '+1 day'));

4. Question: "Update the status of meeting with id 5 to 'Completed'"
   SQL: UPDATE meetings SET status = 'Completed' WHERE id = 5;

5. Question: "Delete meetings from last year"
   SQL: DELETE FROM meetings WHERE date < DATE('now', '-365 days');
"""

    def get_fallback_prompt(self, question: str, schema_context: str) -> str:
        """
        Simpler fallback prompt when primary prompt fails.
        """
        return f"""
Generate SQL for this question: {question}

Schema: {schema_context}

Return ONLY the SQL query, no explanations.
SQL Query:
"""
