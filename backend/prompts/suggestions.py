# backend/prompts/suggestions.py - Query Suggestions Prompts

class SuggestionsPrompts:
    """
    Prompts for generating context-aware query suggestions.
    Used by the SchemaAnalyzer to create relevant hotkeys.
    """
    
    # Main suggestion generation template
    SUGGESTION_GENERATION = """
    You are a data analyst expert. Given the following database schema and actual data facts, generate 5 natural language questions that a user might ask about this data.

    ### Schema Description:
    {schema_description}

    ### Interesting Facts About This Data:
    {data_facts}

    ### CRITICAL Requirements:
    1. Questions MUST be based on ACTUAL data that exists in the table (use the provided facts).
    2. ONLY use values, date ranges, and categories that exist in the data.
    3. Do NOT ask about data that doesn't exist (e.g., years not in the data).
    4. Questions should be answerable using SQL queries and return meaningful results.
    5. Cover different types of analysis:
       - Aggregations (sum, average, count)
       - Filtering (WHERE conditions based on actual values)
       - Comparisons (between values, time periods based on actual ranges)
       - Sorting (top/bottom)
       - Trends (over time, if date columns exist)

    ### Output Format:
    Return ONLY the questions as a JSON array of strings.
    Example: ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
    """
    
    # Fallback suggestions when AI fails
    FALLBACK_SUGGESTIONS = [
        "Show me all data in the database",
        "What is the total number of records?",
        "Show me a summary of each table",
        "What are the most recent records?",
        "Show me the top 10 records"
    ]
    
    # Operation-specific suggestions
    OPERATION_SPECIFIC = {
        "SELECT": [
            "Show me all records from {table}",
            "What is the average {column} in {table}?",
            "Show me the top 10 {table} by {column}"
        ],
        "INSERT": [
            "Add a new {table} with {column} = {value}",
            "Create a new {table} record with data: ..."
        ],
        "UPDATE": [
            "Update the {column} of {table} where {condition}",
            "Change all {table} with {condition} to {value}"
        ],
        "DELETE": [
            "Delete {table} where {condition}",
            "Remove all {table} from {year}"
        ]
    }
