# backend/prompts/validation.py - SQL Validation Prompts

class ValidationPrompts:
    """
    Prompts for validating SQL queries and suggesting fixes.
    Uses AI to catch errors and suggest corrections.
    """
    
    # SQL validation template
    VALIDATION_TEMPLATE = """
    Validate the following SQL query and check for issues.
    
    ### SQL Query:
    {sql}
    
    ### Database Schema:
    {schema}
    
    ### Check For:
    1. Table name exists in schema
    2. Column names exist in respective tables
    3. SQL syntax is correct
    4. Data types are correct (Note: SQLite uses TEXT for dates, do not raise warnings about DATE vs TEXT)
    5. No SQL injection patterns
    6. For UPDATE/DELETE: WHERE clause exists
    7. For INSERT: Check if all required (non-nullable) columns are included. Do NOT fail validation if primary key columns (like 'id') or calculated/nullable columns are omitted. They are auto-generated.
    8. Do NOT raise warnings or errors about Primary Key conflicts.
    
    ### Response Format:
    Return JSON with:
    {{
        "valid": true/false,
        "errors": ["error message", "error message"],
        "warnings": ["warning message", "warning message"],
        "suggested_fix": "corrected SQL or null"
    }}
    """
    
    # Error correction template
    ERROR_CORRECTION = """
    The following SQL query has errors. Suggest a fix.
    
    ### Original SQL:
    {sql}
    
    ### Errors:
    {errors}
    
    ### Schema Context:
    {schema}
    
    ### Task:
    Provide a corrected version of the SQL query that fixes all errors.
    Return ONLY the corrected SQL query, no explanations.
    """
    
    # Safety check template
    SAFETY_CHECK = """
    Perform a safety check on the following SQL operation.
    
    ### SQL: {sql}
    ### Operation Type: {operation_type}
    
    ### Safety Checks:
    1. Is this a dangerous operation? (DROP, TRUNCATE)
    2. Does UPDATE have a WHERE clause?
    3. Does DELETE have a WHERE clause?
    4. Are there any SQL injection patterns?
    5. Are there any data loss risks?
    
    ### Response:
    Return: "SAFE", "DANGEROUS", or "CONFIRM_REQUIRED"
    """
