# backend/prompts/error_correction.py - Self-Correction Prompts

class ErrorCorrectionPrompts:
    """
    Prompts for AI-powered self-correction when SQL errors occur.
    Enables the agent to fix its own mistakes.
    """
    
    # Main error correction template
    ERROR_CORRECTION_TEMPLATE = """
    The SQL query failed with an error. Analyze the error and suggest a fix.

    ### Failed SQL:
    {sql}

    ### Error Message:
    {error}

    ### Schema Context:
    {schema}

    ### Common Issues and Fixes:
    1. Table not found → Check table name spelling
    2. Column not found → Check column name spelling
    3. Syntax error → Check SQL syntax
    4. Constraint violation → Check data types and constraints
    5. Foreign key violation → Check referenced data exists

    ### Task:
    Provide a corrected SQL query that fixes the error.
    Return ONLY the corrected SQL query, no explanations.
    """
    
    # Constraint violation handling
    CONSTRAINT_VIOLATION = """
    A constraint violation occurred. Analyze and suggest a fix.

    ### SQL: {sql}
    ### Error: {error}
    ### Constraint Type: {constraint_type}

    ### Possible Fixes:
    1. UNIQUE violation → Use different value or check duplicates
    2. FOREIGN KEY violation → Check referenced data exists
    3. NOT NULL violation → Add a value for the column
    4. CHECK violation → Ensure data meets constraint conditions

    ### Response:
    Provide a corrected SQL query that avoids the constraint violation.
    """
    
    # Suggest alternative approach
    ALTERNATIVE_APPROACH = """
    The current approach failed. Suggest an alternative approach.

    ### Original Question: {question}
    ### Failed SQL: {sql}
    ### Error: {error}

    ### Alternative Approaches:
    1. Use a different table or column
    2. Change the operation type
    3. Use a subquery or JOIN
    4. Split into multiple operations
    5. Use a different query pattern

    ### Response:
    Provide a working SQL query or explanation of the alternative approach.
    """
