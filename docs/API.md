# API Documentation

## Authentication

Currently, the API does not require authentication for local development. For production, implement API key or OAuth authentication.

## Endpoints

### Health Check

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "components": {
    "database": "healthy",
    "vector_store": "healthy",
    "ai": "healthy"
  },
  "model": "mistral-large-3",
  "version": "1.0.0"
}
```

### Get Schema

**Endpoint:** `GET /api/schema`

**Response:**
```json
{
  "tables": [
    {
      "name": "users",
      "columns": [
        {
          "name": "id",
          "type": "INTEGER",
          "nullable": false,
          "primary_key": true
        },
        {
          "name": "name",
          "type": "TEXT",
          "nullable": false,
          "primary_key": false
        }
      ],
      "row_count": 100
    }
  ],
  "total_tables": 5,
  "relationships": {
    "users": ["orders"],
    "orders": ["users", "products"]
  }
}
```

### Run Query

**Endpoint:** `POST /api/query`

**Request Body:**
```json
{
  "natural_language": "Show me all users from California",
  "current_table": "users"
}
```

**Response (Success):**
```json
{
  "success": true,
  "sql": "SELECT * FROM users WHERE state = 'CA'",
  "data": [
    {"id": 1, "name": "Alice Johnson", "state": "CA"},
    {"id": 2, "name": "Bob Smith", "state": "CA"}
  ],
  "columns": ["id", "name", "state"],
  "row_count": 2,
  "execution_time_ms": 42,
  "validation": {
    "verified": true,
    "hallucinated": false
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Table 'nonexistent' not found",
  "error_type": "table_not_found",
  "details": {
    "available_tables": ["users", "orders", "products"]
  },
  "suggested_action": "Switch to one of these tables: users, orders, products"
}
```

### Upload Database

**Endpoint:** `POST /api/database/upload`

**Request:** Multipart form data with file

**Response:**
```json
{
  "success": true,
  "message": "Database 'test.db' uploaded successfully",
  "tables": ["users", "orders", "products"],
  "tables_count": 3,
  "file_hash": "a8f5d1c3e9f2b6a7"
}
```

### Get Suggestions

**Endpoint:** `GET /api/suggestions?table_name=users`

**Response:**
```json
{
  "suggestions": [
    "Show me all users",
    "How many users are from California?",
    "Show me users who signed up recently"
  ],
  "source": "generated",
  "count": 3,
  "table_name": "users"
}
```

## Error Codes & Examples

| Error Type | Description | Suggested Action |
|------------|-------------|------------------|
| `table_not_found` | Table doesn't exist | Switch to an existing table |
| `column_not_found` | Column doesn't exist | Check column names in schema |
| `ai_failure` | AI failed to generate SQL | Rephrase your question |
| `rate_limit_error` | API rate limit exceeded | Wait and try again |
| `syntax_error` | SQL syntax error | Check query syntax |
| `validation_error` | Query validation failed | Fix the SQL query |

## Error Examples

### Table Not Found
```json
{
  "success": false,
  "error": "Table 'nonexistent' not found in the database.",
  "error_type": "table_not_found",
  "details": {
    "table_name": "nonexistent",
    "available_tables": ["users", "orders", "products"]
  },
  "suggested_action": "Switch to one of these tables: users, orders, products"
}
```

### Rate Limit Exceeded
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please wait a moment and try again.",
  "error_type": "rate_limit_error",
  "suggested_action": "Wait 30 seconds and try again with a simpler query."
}
```

### AI Generation Failed
```json
{
  "success": false,
  "error": "AI failed to generate SQL: Model returned invalid format",
  "error_type": "ai_failure",
  "details": {
    "ai_error": "Invalid Format: Missing 'Action:' after 'Thought:'"
  },
  "suggested_action": "Try rephrasing your question or switch to a more specific table."
}
```
