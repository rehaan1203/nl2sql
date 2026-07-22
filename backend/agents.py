import re
import logging
from typing import Dict, Any, Optional, List
from langchain_community.utilities.sql_database import SQLDatabase
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

def create_sql_query_chain(llm, db):
    template = """Given an input question, first create a syntactically correct {dialect} query to run.
Use the following format:

Question: "Question here"
SQLQuery: "SQL Query to run"

Only use the following tables:
{table_info}

Question: {question}"""
    prompt = PromptTemplate.from_template(template)
    
    def _get_table_info(_):
        return db.get_table_info()
        
    def _get_dialect(_):
        return db.dialect
        
    return (
        RunnablePassthrough.assign(
            table_info=_get_table_info,
            dialect=_get_dialect
        )
        | prompt
        | llm
        | StrOutputParser()
    )

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage
import os
from prompt_manager import PromptManager
from prompts.operation_detection import OperationDetectionPrompts
from prompts.explanation import ExplanationPrompts
from explainer import QueryExplainer
from utils.model_metrics import ModelLoadingMetrics

model_metrics = ModelLoadingMetrics()

logger = logging.getLogger(__name__)

class SQLQueryAgent:
    """
    LangChain SQL Agent with CRUD support.
    Handles both read and write operations via natural language.
    """
    
    def __init__(
        self, 
        database_url: str,
        model: str = "llama-3.1-8b-instant",
        temperature: float = 0.1,
        max_iterations: int = 5,
        verbose: bool = True
    ):
        self.database_url = database_url
        self.model_name = model
        self.temperature = temperature
        self.max_iterations = max_iterations
        self.verbose = verbose
        
        # Initialize database connection
        from sqlalchemy.pool import NullPool
        is_sqlite = database_url.startswith("sqlite")
        engine_kwargs = {"poolclass": NullPool} if is_sqlite else {}
        self.db = SQLDatabase.from_uri(database_url, engine_args=engine_kwargs)
        
        # Patch db.run to intercept write operations and guide the AI
        original_run = self.db.run
        def safe_run(*args, **kwargs):
            if args:
                command = args[0]
            else:
                command = kwargs.get('command', '')
                
            if isinstance(command, str):
                upper_cmd = command.strip().upper()
                # If the command starts with markdown, strip it first for checking
                if upper_cmd.startswith("```SQL"):
                    upper_cmd = upper_cmd[6:].strip()
                elif upper_cmd.startswith("```"):
                    upper_cmd = upper_cmd[3:].strip()
                    
                if any(upper_cmd.startswith(op) for op in ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE"]):
                    return "Error: Do not execute write operations with sql_db_query. You must output the final SQL query in your final response inside a ```sql block for the backend to execute."
            return original_run(*args, **kwargs)
            
        self.db.run = safe_run
        
        # Initialize LLM
        groq_api_key = os.getenv("GROQ_API_KEY")
        mistral_api_key = os.getenv("MISTRAL_API_KEY")
        hf_api_key = os.getenv("HUGGINGFACEHUB_API_TOKEN")
        
        if mistral_api_key:
            from langchain_mistralai import ChatMistralAI
            self.llm = ChatMistralAI(
                model=model,
                temperature=temperature,
                mistral_api_key=mistral_api_key,
                max_retries=2,
            )
            logger.info(f"✅ Mistral LLM initialized with model: {model}")
        elif groq_api_key:
            self.llm = ChatGroq(
                model=model,
                temperature=temperature,
                api_key=groq_api_key,
                max_retries=2,
                timeout=30,
            )
            logger.info(f"✅ Groq LLM initialized with model: {model}")
        elif hf_api_key:
            self.llm = self._init_huggingface(model, temperature)
        else:
            self.llm = None
            logger.warning("⚠️ No AI API key found (tried Groq, Mistral, and HuggingFace)")
        
        self.prompt_manager = PromptManager()
        
        # Initialize SQL Chain
        if self.llm:
            self.chain = create_sql_query_chain(self.llm, self.db)
        else:
            self.chain = None
        
        # Initialize validator and executor (will be set by main.py)
        self.sql_validator = None
        self.executor = None
        self.response_validator = None
        
        # Initialize explainer
        self.explainer = QueryExplainer(self.llm)
        
        # Track auto-fix metrics
        self.auto_fix_stats = {
            "attempts": 0,
            "successes": 0,
            "failures": 0
        }
    
    @model_metrics.track_load("huggingface_llm")
    def _init_huggingface(self, model: str, temperature: float):
        """Initialize Hugging Face model with optimized loading."""
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
            import torch
            from tqdm import tqdm
            import concurrent.futures
            
            model_name = os.getenv("HF_MODEL_NAME", "mistralai/Mistral-7B-Instruct-v0.1")
            
            logger.info(f"🔄 Loading Hugging Face model: {model_name}")
            logger.info("   (This may take 1-2 minutes on first load)")
            
            # Clear GPU cache before loading
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.reset_peak_memory_stats()
                logger.info(f"🧹 GPU cache cleared, available memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
            
            # Load tokenizer
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=os.getenv("HF_CACHE_DIR", "./hf_cache"),
                use_fast=True,
            )
            
            # Try multiple dtype options
            dtype_options = ["auto", torch.float16, torch.bfloat16, torch.float32]
            loaded_model = None
            
            with tqdm(total=100, desc="Loading model", unit="%") as pbar:
                pbar.update(10)
                
                for dtype in dtype_options:
                    try:
                        logger.info(f"🔄 Attempting to load with dtype: {dtype}")
                        
                        def load_model():
                            return AutoModelForCausalLM.from_pretrained(
                                model_name,
                                cache_dir=os.getenv("HF_CACHE_DIR", "./hf_cache"),
                                torch_dtype=dtype,
                                low_cpu_mem_usage=True,
                                use_safetensors=True,
                                device_map="auto",
                                trust_remote_code=True,
                            )
                        
                        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                            future = executor.submit(load_model)
                            try:
                                loaded_model = future.result(timeout=300) # 5 min timeout
                                logger.info(f"✅ Successfully loaded with dtype: {dtype}")
                                break
                            except concurrent.futures.TimeoutError:
                                logger.error("❌ Model loading timed out after 5 minutes")
                                raise TimeoutError("Model loading timed out")
                            except Exception as e:
                                raise e
                    except TimeoutError:
                        raise
                    except Exception as e:
                        logger.warning(f"⚠️ Failed with dtype {dtype}: {e}")
                        continue
                
                if not loaded_model:
                    raise RuntimeError("Failed to load model with any dtype option")
                
                pbar.update(90)
            
            if torch.cuda.is_available():
                logger.info(f"   - Model loaded on: GPU (CUDA)")
            else:
                logger.info(f"   - Model loaded on: CPU")
            
            logger.info(f"   - Precision: {loaded_model.dtype}")
            logger.info(f"✅ Model loaded successfully")
            
            # Custom LLM wrapper
            from langchain.llms.base import LLM
            
            class HuggingFaceLLM(LLM):
                def __init__(self, model, tokenizer, temperature):
                    self.model = model
                    self.tokenizer = tokenizer
                    self.temperature = temperature
                
                def _call(self, prompt: str, stop: Optional[List[str]] = None) -> str:
                    inputs = self.tokenizer(prompt, return_tensors="pt")
                    if torch.cuda.is_available():
                        inputs = {k: v.to("cuda") for k, v in inputs.items()}
                    
                    outputs = self.model.generate(
                        **inputs,
                        max_new_tokens=512,
                        temperature=self.temperature,
                        do_sample=True,
                        pad_token_id=self.tokenizer.eos_token_id,
                    )
                    
                    response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
                    response = response[len(prompt):].strip()
                    return response
                
                @property
                def _llm_type(self) -> str:
                    return "huggingface"
            
            return HuggingFaceLLM(loaded_model, tokenizer, temperature)
            
        except Exception as e:
            logger.error(f"❌ Failed to load Hugging Face model: {e}")
            return None    
    def query(
        self, 
        natural_language: str,
        relevant_tables: Optional[List[str]] = None,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute a natural language query through the agent.
        Supports both SELECT and write operations (INSERT, UPDATE, DELETE).
        """
        if not self.llm:
            # Fallback to mock mode
            logger.warning("🔄 Using mock mode (no AI configured)")
            return self._mock_query(natural_language)
        
        try:
            # Step 1: Detect operation type from natural language
            operation_type = self._detect_operation_type(natural_language)
            logger.info(f"🤖 Detected operation type: {operation_type}")
            
            # Step 2: Enhance prompt with context
            enhanced_query = natural_language
            if context:
                enhanced_query = f"{context}\n\nUser request: {natural_language}"
                
            if relevant_tables:
                table_context = f"\nRelevant tables to consider: {', '.join(relevant_tables)}\n"
                enhanced_query = table_context + enhanced_query
            
            # Step 3: Run AI generation with retry logic
            last_error = None
            sqls = []
            sql_output = ""
            
            for attempt in range(2):
                try:
                    schema_mgr = self.sql_validator.schema_manager if self.sql_validator else None
                    current_table = context_table if 'context_table' in locals() and context_table else (relevant_tables[0] if relevant_tables else None)
                    
                    if schema_mgr:
                        from query_detector import QueryDetector
                        query_detector = QueryDetector(schema_mgr)
                        mentioned_table = query_detector.detect_table_in_query(
                            natural_language,
                            [t.name for t in schema_mgr.get_schema().tables]
                        )
                        if mentioned_table and mentioned_table != current_table:
                            schema_mgr.set_current_table(mentioned_table)
                            current_table = mentioned_table
                            if relevant_tables:
                                relevant_tables[0] = current_table
                            logger.info(f"🔄 Auto-switched to table: {mentioned_table}")
                            
                    if schema_mgr and self.llm:
                        if attempt == 0:
                            prompt_str = self.prompt_manager.get_sql_generation_prompt(
                                enhanced_query,
                                schema_mgr.get_filtered_schema_for_prompt(current_table),
                                include_examples=True
                            )
                        else:
                            prompt_str = self.prompt_manager.get_fallback_prompt(
                                enhanced_query,
                                schema_mgr.get_minimal_schema_context(current_table)
                            )
                        response = self.llm.invoke(prompt_str)
                        
                        # Log token usage
                        if hasattr(response, "response_metadata") and "token_usage" in response.response_metadata:
                            usage = response.response_metadata["token_usage"]
                            from utils.token_tracker import token_tracker
                            token_tracker.log_usage(
                                prompt_tokens=usage.get("prompt_tokens", 0),
                                completion_tokens=usage.get("completion_tokens", 0),
                                model=self.model_name
                            )
                            
                        sql_output = str(response.content)
                    else:
                        # Fallback to chain
                        if not self.chain:
                            raise Exception("AI not configured")
                        sql_output = self.chain.invoke({"question": enhanced_query})
                    
                    logger.info(f"raw sql_output (attempt {attempt}): {sql_output}")
                    
                    raw_output = sql_output.strip()
                    if "SQLQuery:" in raw_output:
                        raw_output = raw_output.split("SQLQuery:")[-1].strip()
                        
                    result = {"output": raw_output}
                    
                    # Step 4: Extract SQL
                    sqls = self._extract_sql(result)
                    
                    if sqls and sqls[0] != "NO_SQL" and not sqls[0].startswith("NO_SQL"):
                        break
                        
                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"Attempt {attempt} failed: {e}")
                    continue
            
            if not sqls or (sqls and sqls[0].startswith("NO_SQL")):
                return {
                    "success": False,
                    "error": f"Failed to generate SQL. Raw output was: {sql_output}. Error: {last_error}",
                    "operation_type": operation_type
                }
            
            # Hallucination Check & Auto-fix
            if self.sql_validator and operation_type in ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP"]:
                current_table = relevant_tables[0] if relevant_tables else None
                for i, sql in enumerate(sqls):
                    valid, fixed_sql, errors = self.sql_validator.validate_and_fix_sql(sql, current_table)
                    sqls[i] = fixed_sql
                    if not valid:
                        return {
                            "success": False,
                            "error": " | ".join(errors),
                            "sql": sql,
                            "operation_type": operation_type
                        }
            
            # Step 5 & 7: Validate and Execute all SQLs sequentially
            final_response = None
            all_executed_sqls = []
            cumulative_affected = 0
            cumulative_execution_time = 0
            
            for sql in sqls:
                # Step 5: Validate SQL
                if self.sql_validator:
                    validation_result = self.sql_validator.validate_sql(sql)
                    if not validation_result.get("valid", False):
                        return {
                            "success": False,
                            "error": f"SQL validation failed for query '{sql[:50]}...': {', '.join(validation_result.get('errors', []))}",
                            "suggested_fix": validation_result.get("suggested_fix"),
                            "sql": "\n\n".join(all_executed_sqls + [sql]),
                            "operation_type": validation_result.get("operation_type", operation_type)
                        }
                    sql_operation = validation_result.get("operation_type", operation_type)
                    sql_category = validation_result.get("category", "DML")
                else:
                    sql_operation = self._simple_operation_detection(sql)
                    sql_category = "DML"
                
                # Step 7: Execute with appropriate mode
                if self.executor:
                    execution_result = self.executor.execute(sql, category=sql_category, operation_type=sql_operation)
                    
                    # Invalidate cache if DDL operation
                    if sql_category == "DDL":
                        try:
                            from redis_client import RedisClient
                            temp_redis = RedisClient()
                            temp_redis.invalidate_all_cache()
                            logger.info("🗑️ Invalidated Redis cache after DDL operation")
                        except Exception as e:
                            logger.warning(f"Failed to invalidate cache: {e}")
                else:
                    # Fallback to direct database execution
                    execution_result = self._direct_execute(sql, sql_operation)
                
                auto_fix_applied = False
                original_sql = None
                
                if not execution_result.get("success", False):
                    # Auto-fix attempt
                    auto_fix_applied = True
                    original_sql = sql
                    
                    self.auto_fix_stats["attempts"] += 1
                    fixed_sql = self._attempt_auto_fix(sql, execution_result.get("error", ""))
                    
                    if fixed_sql:
                        logger.info(f"✅ Auto-fix applied: {original_sql} → {fixed_sql}")
                        # Re-execute with fixed SQL
                        if self.executor:
                            execution_result = self.executor.execute(fixed_sql, category=sql_category, operation_type=sql_operation)
                        else:
                            execution_result = self._direct_execute(fixed_sql, sql_operation)
                            
                        if execution_result.get("success", False):
                            self.auto_fix_stats["successes"] += 1
                            sql = fixed_sql
                        else:
                            self.auto_fix_stats["failures"] += 1
                    else:
                        self.auto_fix_stats["failures"] += 1

                if not execution_result.get("success", False):
                    return {
                        "success": False,
                        "error": execution_result.get("error", "Unknown execution error"),
                        "sql": "\n\n".join(all_executed_sqls + [sql]),
                        "operation_type": sql_operation,
                        "auto_fix_applied": auto_fix_applied,
                        "original_sql": original_sql
                    }
                    
                all_executed_sqls.append(sql)
                cumulative_affected += execution_result.get("affected_rows", 0)
                cumulative_execution_time += execution_result.get("execution_time_ms", 0)
                
                final_response = {
                    "sql": "\n\n".join(all_executed_sqls),
                    "data": execution_result.get("data", []),
                    "columns": execution_result.get("columns", []),
                    "row_count": execution_result.get("row_count", 0),
                    "affected_rows": cumulative_affected,
                    "execution_time_ms": cumulative_execution_time,
                    "operation_type": sql_operation,
                    "success": True,
                    "message": execution_result.get("message", "Operation completed"),
                    "auto_fix_applied": auto_fix_applied,
                    "original_sql": original_sql
                }
            
            # Determine overall operation type (Write takes precedence over Read)
            primary_operation = operation_type
            write_ops = [self._simple_operation_detection(s) for s in all_executed_sqls if self._simple_operation_detection(s) not in ["SELECT", "UNKNOWN"]]
            if write_ops:
                primary_operation = write_ops[0]
            
            # Determine current table for validation
            current_table = context_table if 'context_table' in locals() and context_table else None
            if not current_table:
                tables = self._extract_table_names(final_response["sql"])
                current_table = tables[0] if tables else "unknown"

            # Step 8: Generate explanation and presentation mode
            explanation_text = "Completed operation."
            if os.getenv("ENABLE_AI_EXPLANATIONS", "true").lower() == "true":
                explanation_text = self.explainer.explain_query(
                    natural_language=natural_language,
                    sql=final_response["sql"],
                    data=final_response.get("data", []),
                    row_count=final_response.get("row_count", 0),
                    columns=final_response.get("columns", []),
                    operation_type=primary_operation,
                    affected_rows=final_response.get("affected_rows", 0)
                )
            
            final_response["explanation"] = explanation_text
            final_response["presentation_mode"] = "data_viz" if primary_operation == "SELECT" else "crud"
            final_response["operation_type"] = primary_operation
            
            # Step 10: For write operations, get the updated data
            if primary_operation in ["INSERT", "UPDATE", "DELETE"] and final_response["success"] and self.executor:
                # Get the table name to refresh
                tables = self._extract_table_names(final_response["sql"])
                if tables:
                    final_response["affected_table"] = tables[0]
                    # Fetch updated data for the split view
                    try:
                        refresh_sql = f'SELECT * FROM "{tables[0]}" LIMIT 100'
                        refresh_result = self.executor.execute(refresh_sql, "SELECT")
                        final_response["refreshed_data"] = refresh_result.get("data", [])
                        final_response["refreshed_count"] = refresh_result.get("row_count", 0)
                    except Exception as e:
                        logger.warning(f"Failed to fetch refreshed data: {e}")
            
            logger.info(f"✅ Query completed: {primary_operation}")
            
            # Inject chart error parsing if needed
            if final_response["presentation_mode"] == "data_viz":
                # Check if data qualifies for chart
                chart_error = self._detect_chart_error(final_response.get("error", ""), final_response.get("data", []))
                if chart_error["type"] != "default":
                    final_response["error"] = chart_error  # Return dictionary for frontend to parse
                    final_response["success"] = False

            return final_response
            
        except Exception as e:
            logger.error(f"❌ Query execution failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "sql": None,
                "operation_type": "UNKNOWN"
            }
            
    def _attempt_auto_fix(self, sql: str, error: str) -> Optional[str]:
        """Attempt to fix common SQL errors dynamically."""
        fixed_sql = sql
        error_lower = error.lower()
        
        # Fix 1: Table name typos
        if "no such table" in error_lower:
            table_name = self._extract_table_names(sql)
            if table_name:
                available_tables = [t.name for t in self.sql_validator.schema_manager.get_schema().tables] if self.sql_validator else []
                similar = self._find_similar_name(table_name[0], available_tables)
                if similar:
                    import re
                    fixed_sql = re.sub(rf'\b{table_name[0]}\b', similar, sql, flags=re.IGNORECASE)
                    return fixed_sql
                    
        # Fix 2: Column name typos
        if "no such column" in error_lower:
            # Simple extraction heuristic for sqlite3 column error
            import re
            match = re.search(r'no such column: (\w+)', error)
            if match:
                column_name = match.group(1)
                tables = self._extract_table_names(sql)
                if tables and self.sql_validator:
                    available_columns = []
                    for t in self.sql_validator.schema_manager.get_schema().tables:
                        if t.name.lower() == tables[0].lower():
                            available_columns = [c.name for c in t.columns]
                            break
                    
                    similar = self._find_similar_name(column_name, available_columns)
                    if similar:
                        fixed_sql = re.sub(rf'\b{column_name}\b', similar, sql, flags=re.IGNORECASE)
                        return fixed_sql
        return None
        
    def _find_similar_name(self, name: str, candidates: List[str]) -> Optional[str]:
        """Find the most similar name using Levenshtein distance."""
        from difflib import get_close_matches
        matches = get_close_matches(name, candidates, n=1, cutoff=0.7)
        return matches[0] if matches else None

    def _detect_chart_error(self, error: str, data: List[Dict]) -> Dict:
        """Classify chart errors for better user messages."""
        error_lower = str(error).lower() if error else ""
        
        if not data or len(data) == 0:
            return {
                "type": "no_data",
                "message": "No data available to visualize"
            }
        
        if "numeric" in error_lower or "number" in error_lower:
            return {
                "type": "wrong_format",
                "message": "Chart requires numeric data"
            }
        
        if len(data) > 1000:
            return {
                "type": "too_many_points",
                "message": f"Dataset too large ({len(data)} points)"
            }
        
        return {
            "type": "default",
            "message": str(error)
        }
    
    def _detect_operation_type(self, natural_language: str) -> str:
        """Detect what type of operation the user wants from natural language."""
        if self.sql_validator and hasattr(self.sql_validator, "operation_detector"):
            info = self.sql_validator.operation_detector.detect_from_natural_language(natural_language)
            return info.get("operation_type", "SELECT")
            
        prompt = self.prompt_manager.get_prompt(
            "operation_detection",
            question=natural_language
        )
        
        # First check keywords (fast path)
        query_lower = natural_language.lower()
        for op_type, keywords in OperationDetectionPrompts.OPERATION_KEYWORDS.items():
            for keyword in keywords:
                if keyword in query_lower:
                    return op_type
        
        # If no keyword match, use AI
        if self.llm:
            try:
                response = self.llm.invoke(prompt)
                result = str(response.content).strip().upper()
                if result in ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"]:
                    return result
            except:
                pass
        
        # Default to SELECT
        return "SELECT"
    
    def _simple_operation_detection(self, sql: str) -> str:
        """Simple operation detection from SQL string."""
        sql_upper = sql.upper().strip()
        if sql_upper.startswith("SELECT"):
            return "SELECT"
        elif sql_upper.startswith("INSERT"):
            return "INSERT"
        elif sql_upper.startswith("UPDATE"):
            return "UPDATE"
        elif sql_upper.startswith("DELETE"):
            return "DELETE"
        elif sql_upper.startswith("CREATE"):
            return "CREATE"
        elif sql_upper.startswith("ALTER"):
            return "ALTER"
        elif sql_upper.startswith("DROP"):
            return "DROP"
        return "UNKNOWN"
    
    def _extract_sql(self, result: Dict) -> List[str]:
        """Extract all SQL queries from agent's final result or intermediate steps."""
        sqls = []
        
        if "output" in result:
            output = str(result["output"])
            # Find all SQL in markdown blocks
            sql_matches = re.findall(r'```(?:sql)?\s*(.*?)\s*```', output, re.IGNORECASE | re.DOTALL)
            for match in sql_matches:
                # Split multiple statements separated by semicolon
                statements = [stmt.strip() for stmt in match.split(';') if stmt.strip()]
                for stmt in statements:
                    if stmt not in sqls:
                        sqls.append(stmt)
            
            # Fallback to greedy pattern matching if nothing found
            if not sql_matches:
                sql_patterns = [
                    r'(SELECT\s+.*?(?:;|$))',
                    r'(INSERT\s+INTO\s+.*?(?:;|$))',
                    r'(UPDATE\s+.*?\s+SET\s+.*?(?:;|$))',
                    r'(DELETE\s+FROM\s+.*?(?:;|$))',
                    r'(CREATE\s+TABLE\s+.*?(?:;|$))',
                    r'(ALTER\s+TABLE\s+.*?(?:;|$))',
                    r'(DROP\s+TABLE\s+.*?(?:;|$))',
                    r'(BEGIN\s+(?:TRANSACTION|WORK)?(?:;|$))',
                    r'(COMMIT\s+(?:TRANSACTION|WORK)?(?:;|$))',
                    r'(ROLLBACK\s+(?:TRANSACTION|WORK)?(?:;|$))',
                    r'(GRANT\s+.*?(?:;|$))',
                    r'(REVOKE\s+.*?(?:;|$))'
                ]
                for pattern in sql_patterns:
                    matches = re.findall(pattern, output, re.IGNORECASE | re.DOTALL)
                    for match in matches:
                        if match.strip() not in sqls:
                            sqls.append(match.strip())
                            
        # If no SQL found in output, try to grab the last executed query from intermediate steps
        if not sqls and "intermediate_steps" in result:
            for action, observation in result["intermediate_steps"]:
                if action.tool in ["sql_db_query", "sql_db_query_checker"]:
                    query = action.tool_input
                    if isinstance(query, dict) and "query" in query:
                        query = query["query"]
                        
                    if isinstance(query, str):
                        # Clean markdown wrappers if any
                        query = query.strip()
                        if query.lower().startswith("```sql"):
                            query = query[6:].strip()
                        elif query.startswith("```"):
                            query = query[3:].strip()
                        if query.endswith("```"):
                            query = query[:-3].strip()
                            
                        # Overwrite sqls so we only keep the LAST executed or checked query
                        sqls = [query]
        
        # Deduplicate while preserving order, then smartly reorder to avoid constraint issues
        seen = set()
        unique_sqls = []
        valid_keywords = ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "GRANT", "REVOKE", "BEGIN", "COMMIT", "ROLLBACK", "TRUNCATE"]
        
        for s in sqls:
            clean_s = s.strip().rstrip(';')
            
            # Quick check to ensure it's actually SQL
            is_sql = False
            s_upper = clean_s.upper()
            for kw in valid_keywords:
                if s_upper.startswith(kw):
                    is_sql = True
                    break
                    
            if not is_sql:
                # It's likely conversational text, skip it
                continue
                
            if clean_s not in seen:
                seen.add(clean_s)
                unique_sqls.append(clean_s)
                
        # Smart reordering: prioritize DELETE > INSERT > UPDATE > SELECT to prevent constraint errors in multi-action requests
        def get_op_priority(sql):
            sql_upper = sql.upper()
            if sql_upper.startswith("DELETE"): return 1
            if sql_upper.startswith("INSERT"): return 2
            if sql_upper.startswith("UPDATE"): return 3
            if sql_upper.startswith("CREATE") or sql_upper.startswith("ALTER") or sql_upper.startswith("DROP"): return 0 # DDL first
            return 4 # Everything else (SELECT, etc)
            
        unique_sqls.sort(key=get_op_priority)
        
        return unique_sqls
    
    def _extract_table_names(self, sql: str) -> List[str]:
        """Extract table names from SQL query."""
        if not sql:
            return []
        
        patterns = [
            r'(?:FROM|JOIN|INTO|UPDATE|DELETE\s+FROM)\s+(\w+)',
            r'FROM\s+(\w+)',
            r'JOIN\s+(\w+)',
            r'INTO\s+(\w+)',
            r'UPDATE\s+(\w+)',
        ]
        
        tables = []
        for pattern in patterns:
            matches = re.findall(pattern, sql, re.IGNORECASE)
            tables.extend(matches)
        
        return list(set(tables))
    
    def _direct_execute(self, sql: str, operation_type: str) -> Dict[str, Any]:
        """Direct database execution (fallback when executor not available)."""
        try:
            # Use SQLAlchemy directly
            from sqlalchemy import create_engine, text
            from sqlalchemy.pool import NullPool
            is_sqlite = self.database_url.startswith("sqlite")
            engine_kwargs = {"poolclass": NullPool} if is_sqlite else {}
            engine = create_engine(self.database_url, **engine_kwargs)
            
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                if operation_type != "SELECT":
                    conn.execute(text("BEGIN TRANSACTION"))
                
                result = conn.execute(text(sql))
                
                if operation_type == "SELECT":
                    data = []
                    columns = result.keys()
                    for row in result:
                        data.append(dict(zip(columns, row)))
                    return {
                        "data": data,
                        "columns": list(columns),
                        "row_count": len(data),
                        "operation_type": "SELECT"
                    }
                else:
                    affected_rows = result.rowcount
                    conn.execute(text("COMMIT"))
                    return {
                        "affected_rows": affected_rows,
                        "operation_type": operation_type,
                        "success": True,
                        "message": f"{operation_type} completed. {affected_rows} rows affected."
                    }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "operation_type": operation_type
            }
    
    def _generate_explanation(self, sql: str, natural_language: str, operation_type: str, data: List[Dict[str, Any]] = None, current_table: Optional[str] = None) -> Dict[str, Any]:
        """Generate explanation and determine presentation mode for the operation, with hallucination prevention."""
        if not self.llm:
            return {
                "explanation": self._generate_manual_explanation(sql, operation_type),
                "presentation_mode": "crud" if operation_type != "SELECT" else "data_viz"
            }
        
        # Format a small sample of data for the LLM
        data_sample = "No data returned."
        if data:
            import json
            # Just send up to 3 rows to avoid context overflow
            data_sample = json.dumps(data[:3])
            
        prompt = self.prompt_manager.get_prompt(
            "explanation",
            operation_type=operation_type,
            sql=sql,
            question=natural_language,
            data_sample=data_sample
        )
        
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                response = self.llm.invoke(prompt)
                content = str(response.content).strip()
                
                logger.info(f"🧠 LLM Presentation Mode Output (Attempt {attempt+1}): {content}")
                
                # Clean up potential markdown formatting
                if content.startswith("```json"):
                    content = content[7:]
                elif content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                    
                content = content.strip()
                import json
                result = json.loads(content)
                explanation_text = result.get("explanation", self._generate_manual_explanation(sql, operation_type))
                
                # Validate response for hallucinations
                validation_info = None
                if self.response_validator and current_table and operation_type == "SELECT":
                    validation_info = self.response_validator.validate_response(sql, explanation_text, current_table, data or [])
                    
                    if validation_info.get("hallucinated") and attempt < max_retries:
                        logger.warning(f"Hallucination detected. Retrying... (Attempt {attempt+1})")
                        issues = []
                        for res in validation_info.get("verification_results", []):
                            if not res["valid"]:
                                issues.append(f"Invalid claim: '{res['claim']}' - {res['error']}")
                        
                        # Add strict instructions to prompt
                        stricter_instructions = (
                            f"\n\nWARNING: Your previous answer contained incorrect factual claims:\n"
                            f"{chr(10).join(issues)}\n"
                            f"You MUST only use the factual values provided in the data sample. Do not invent names or numbers."
                        )
                        prompt.messages[-1].content += stricter_instructions
                        continue
                
                return {
                    "explanation": explanation_text,
                    "presentation_mode": result.get("presentation_mode", "data_viz"),
                    "validation": validation_info
                }
            except Exception as e:
                logger.error(f"Explanation generation failed: {e}")
                if attempt == max_retries:
                    return {
                        "explanation": self._generate_manual_explanation(sql, operation_type),
                        "presentation_mode": "crud" if operation_type != "SELECT" else "data_viz"
                    }
    
    def _generate_manual_explanation(self, sql: str, operation_type: str) -> str:
        """Manual explanation fallback."""
        if operation_type == "INSERT":
            return f"Added new records to the database."
        elif operation_type == "UPDATE":
            return f"Updated existing records in the database."
        elif operation_type == "DELETE":
            return f"Removed records from the database."
        else:
            return f"Retrieved data from the database."
    
    def _mock_query(self, natural_language: str) -> Dict[str, Any]:
        """Fallback mock mode when AI is not configured."""
        # Check if it's a write operation
        operation_type = self._detect_operation_type(natural_language)
        
        if operation_type != "SELECT":
            return {
                "success": False,
                "error": "Write operations require AI configuration. Please set GROQ_API_KEY.",
                "operation_type": operation_type
            }
        
        # For SELECT, use mock data
        return {
            "sql": "SELECT * FROM users LIMIT 10;",
            "data": [],
            "columns": [],
            "row_count": 0,
            "operation_type": "SELECT",
            "success": True,
            "message": "Mock mode: No data available"
        }
