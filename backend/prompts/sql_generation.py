# backend/prompts/sql_generation.py - SQL Generation Prompts

class SQLGenerationPrompts:
    """
    Prompts specifically for generating SQL queries from natural language.
    These are used by the LangChain agent for SQL generation.
    """
    
    # Main SQL generation prompt template
    SQL_GENERATION_TEMPLATE = """
    You are a SQL expert generating SQL queries for a SQLite database.
    
    ### Database Schema:
    {schema_context}
    
    ### User Question:
    {natural_language}
    
    ### Task:
    Generate a valid SQL query that answers the user's question.
    
    ### Rules:
    1. Use the exact table and column names from the schema
    2. Use proper SQLite syntax
    3. For SELECT queries, use appropriate filters and sorting
    4. For INSERT, include all required columns
    5. For UPDATE, always include a WHERE clause
    6. For DELETE, always include a WHERE clause
    7. Automatically capitalize proper nouns (e.g. Names, Cities) correctly when inserting or updating data, even if the user typed them in lowercase.
    
    ### Output:
    Return ONLY the SQL query, no explanations or formatting.
    
    ### Examples:
    User: "Show me top 5 movies by box office"
    SQL: SELECT title, box_office_musd FROM movies ORDER BY box_office_musd DESC LIMIT 5;
    
    User: "Add a movie with title 'Inception' and budget 160"
    SQL: INSERT INTO movies (title, budget_musd) VALUES ('Inception', 160);
    """
    
    # Few-shot examples for better accuracy
    FEW_SHOT_EXAMPLES = [
        {
            "question": "Show me all movies released in 2024",
            "sql": "SELECT * FROM movies WHERE release_date BETWEEN '2024-01-01' AND '2024-12-31';"
        },
        {
            "question": "What is the average budget of movies?",
            "sql": "SELECT AVG(budget_musd) as avg_budget FROM movies;"
        },
        {
            "question": "Add a movie called 'The Dark Knight' with budget 185",
            "sql": "INSERT INTO movies (title, budget_musd) VALUES ('The Dark Knight', 185);"
        },
        {
            "question": "Update the budget of 'Inception' to 170",
            "sql": "UPDATE movies SET budget_musd = 170 WHERE title = 'Inception';"
        },
        {
            "question": "Delete movies released before 2000",
            "sql": "DELETE FROM movies WHERE release_date < '2000-01-01';"
        }
    ]
    
    # Operation-specific prompts
    SELECT_GENERATION = """
    Generate a SELECT query for the following question.
    Question: {question}
    Schema: {schema}
    Return only the SELECT query.
    """
    
    INSERT_GENERATION = """
    Generate an INSERT query for the following question.
    Question: {question}
    Schema: {schema}
    Important: Include all required columns (NOT NULL).
    Important: Automatically capitalize proper nouns (e.g. Names, Cities) correctly, even if typed in lowercase.
    Return only the INSERT query.
    """
    
    UPDATE_GENERATION = """
    Generate an UPDATE query for the following question.
    Question: {question}
    Schema: {schema}
    Important: MUST include a WHERE clause.
    Important: Automatically capitalize proper nouns (e.g. Names, Cities) correctly, even if typed in lowercase.
    Return only the UPDATE query.
    """
    
    DELETE_GENERATION = """
    Generate a DELETE query for the following question.
    Question: {question}
    Schema: {schema}
    Important: MUST include a WHERE clause.
    Return only the DELETE query.
    """
