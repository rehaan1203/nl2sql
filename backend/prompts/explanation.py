# backend/prompts/explanation.py - Explanation Generation Prompts

class ExplanationPrompts:
    """
    Prompts for generating human-readable explanations of SQL operations.
    These make the system more user-friendly and transparent.
    """
    
    # Main explanation template
    EXPLANATION_TEMPLATE = """
    Analyze the user's question and the resulting data, AND determine how the result should be presented in the UI along with the appropriate response.
    
    ### Operation Type: {operation_type}
    ### SQL Query: {sql}
    ### Original Question: {question}
    ### Result Data Sample: {data_sample}
    
    ### Presentation Mode Guidelines:
    Choose ONE of the following presentation modes based on the question and result:
    1. "chatbot" - Use this if the question asks for a specific fact (e.g., "What is the role of actor 1?"), or the result is a single value, a simple row, or a simple 1-column list (e.g., a list of names or roles).
    2. "data_viz" - Use this if the user explicitly asks for a list, analysis, aggregation across multiple columns, or if displaying a complex data table/chart is necessary.
    3. "crud" - Use this if the operation type is INSERT, UPDATE, DELETE, CREATE, DROP, or ALTER.
    
    ### Explanation Guidelines (CRITICAL):
    1. For "chatbot" mode: Directly answer the user's question using natural language based on the data sample. DO NOT explain the SQL operation, and DO NOT use phrases like "I found", "The query returns", or "The result shows". If the data contains duplicates (e.g., ["Lead", "Supporting", "Lead"]), synthesize them into a unique, clean list in your answer (e.g., "The roles are Lead and Supporting.").
    2. For "data_viz" mode: Provide a concise 2-3 sentence business analysis or narrative summary interpreting the actual data returned (e.g., identifying trends, top results, or key insights). DO NOT explain the SQL mechanics (e.g., do not say "I used a SELECT statement with a JOIN").
    3. For "crud" mode: Provide a brief 1-2 sentence explanation of what data was affected.
    4. Keep responses concise and human-friendly.
    5. Ensure perfect grammar, spelling, and a professional tone in your response. Proofread your text to avoid typos (e.g., ensure you output "The" instead of "Te").
    
    ### OUTPUT FORMAT (You MUST output ONLY valid JSON without markdown formatting):
    {{
        "explanation": "<your direct answer here based on the data>",
        "presentation_mode": "<chatbot or data_viz or crud>"
    }}
    """

    
    # Operation-specific explanation formats
    EXPLANATION_FORMATS = {
        "SELECT": "I found {row_count} {table_name} that match your criteria.",
        "INSERT": "I added a new {table_name} record to the database.",
        "UPDATE": "I updated {affected_rows} {table_name} record(s) with the new information.",
        "DELETE": "I removed {affected_rows} {table_name} record(s) from the database."
    }
    
    # Detailed explanation template
    DETAILED_EXPLANATION = """
    Provide a detailed explanation of what happened.
    
    Operation: {operation_type}
    Affected: {affected_count} rows
    Tables: {tables}
    
    Detailed Explanation:
    1. What operation was performed
    2. What specific data was affected
    3. Any important details about the operation
    4. Success or failure status
    
    Be thorough but clear.
    """
