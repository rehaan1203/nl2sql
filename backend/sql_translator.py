from langchain.chains import create_sql_query_chain
from langchain_community.utilities.sql_database import SQLDatabase
import logging

logger = logging.getLogger(__name__)

class SQLTranslator:
    """
    LangChain SQL Query Chain for direct translation.
    This is simpler than the full agent approach and used as a fallback
    or for direct query generation without tool-calling.
    """
    
    def __init__(self, database_url: str, llm):
        self.db = SQLDatabase.from_uri(database_url)
        self.llm = llm
        self.chain = create_sql_query_chain(
            llm=self.llm, 
            db=self.db,
            k=5  # Return top 5 results
        )
    
    def translate(self, natural_language: str, schema_context: str = None) -> str:
        """
        Convert natural language to SQL using LangChain's SQL chain.
        """
        try:
            # If we have schema context, include it
            if schema_context:
                enhanced_query = f"Schema context: {schema_context}\n\nQuestion: {natural_language}"
            else:
                enhanced_query = natural_language
            
            result = self.chain.invoke({
                "question": enhanced_query
            })
            
            logger.info(f"✅ Translated to SQL: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Translation failed: {e}")
            raise ValueError(f"Could not translate query: {str(e)}")
