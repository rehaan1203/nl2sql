// lib/api.js - Complete API integration layer

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Get or create session ID
function getSessionId() {
  let sessionId = localStorage.getItem('nl2sql_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('nl2sql_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Run a natural language query
 * POST /api/query
 * 
 * @param {string} naturalLanguage - The user's question
 * @param {object} options - Options including sessionId, currentTable, autoSwitch
 * @returns {Promise<{sql: string, data: array, columns: array, row_count: number, execution_time_ms: number, explanation: string}>}
 */
export async function runQuery(naturalLanguage, options = {}) {
  const sessionId = options.sessionId || getSessionId();
  const { currentTable, autoSwitch = false, forceCurrentTable = false } = options;
  
  try {
    const response = await fetch(`${API_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
        'X-User-ID': localStorage.getItem('nl2sql_user_id') || 'anonymous'
      },
      body: JSON.stringify({
        natural_language: naturalLanguage,
        session_id: sessionId,
        current_table: currentTable,
        auto_switch: autoSwitch,
        force_current_table: forceCurrentTable
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      // Handle specific error codes
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment.');
      }
      throw new Error(errorData.detail || 'Query execution failed');
    }

    const result = await response.json();
    
    // Check if auto-switch is needed
    if (result.error_type === 'cross_table_query' && result.can_auto_switch) {
      if (autoSwitch) {
        // Auto-switch and retry
        const retryResponse = await fetch(`${API_URL}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId,
            'X-User-ID': localStorage.getItem('nl2sql_user_id') || 'anonymous'
          },
          body: JSON.stringify({
            natural_language: naturalLanguage,
            current_table: result.suggested_tables[0],
            auto_switch: true
          }),
        });
        
        const retryResult = await retryResponse.json();
        if (retryResult.session_id) {
          localStorage.setItem('nl2sql_session_id', retryResult.session_id);
        }
        return retryResult;
      }
      
      // Return with auto-switch suggestion
      return {
        ...result,
        needs_auto_switch: true,
        suggested_tables: result.suggested_tables,
        current_table: currentTable
      };
    }
    
    // Store session ID from response if provided
    if (result.session_id) {
      localStorage.setItem('nl2sql_session_id', result.session_id);
    }
    
    return result;
  } catch (error) {
    if (error.message.includes('429')) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Make sure the backend is running.');
    }
    throw error;
  }
}

/**
 * Execute raw SQL query directly
 * POST /api/query/execute
 * 
 * @param {string} sql - The SQL query
 * @returns {Promise<{sql: string, data: array, columns: array, row_count: number, execution_time_ms: number}>}
 */
export async function executeSql(sql, naturalLanguage = null) {
  const sessionId = getSessionId();
  try {
    const response = await fetch(`${API_URL}/query/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
        'X-User-ID': localStorage.getItem('nl2sql_user_id') || 'anonymous'
      },
      body: JSON.stringify({ sql, natural_language: naturalLanguage }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'SQL execution failed');
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Make sure the backend is running on port 8000.');
    }
    throw error;
  }
}

/**
 * Get database schema
 * GET /api/schema
 * 
 * @returns {Promise<{tables: array, total_tables: number, relationships: object}>}
 */
export async function fetchSchema() {
  const sessionId = getSessionId();
  try {
    const response = await fetch(`${API_URL}/schema`, {
      headers: {
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch schema');
    }
    
    return await response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Make sure the backend is running on port 8000.');
    }
    throw error;
  }
}

/**
 * Get table data
 * GET /api/table/{table_name}/data
 * 
 * @param {string} tableName - The name of the table to fetch
 * @returns {Promise<{table_name: string, columns: array, data: array, row_count: number}>}
 */
export async function fetchTableData(tableName) {
  const sessionId = getSessionId();
  try {
    const response = await fetch(`${API_URL}/table/${encodeURIComponent(tableName)}/data`, {
      headers: {
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data for table ${tableName}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server.');
    }
    throw error;
  }
}

/**
 * Validate SQL query
 * POST /api/query/validate
 * 
 * @param {string} sql - The SQL query to validate
 * @returns {Promise<{valid: boolean, errors: array, warnings: array, suggested_fix: string}>}
 */
export async function validateSQL(sql) {
  try {
    const response = await fetch(`${API_URL}/query/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      throw new Error('Validation failed');
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Make sure the backend is running on port 8000.');
    }
    throw error;
  }
}

/**
 * Preload schema into vector store (for admin)
 * POST /api/schema/preload
 * 
 * @returns {Promise<{status: string, message: string}>}
 */
export async function preloadSchema() {
  try {
    const response = await fetch(`${API_URL}/schema/preload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to preload schema');
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Make sure the backend is running on port 8000.');
    }
    throw error;
  }
}

/**
 * Health check
 * GET /api/health
 * 
 * @returns {Promise<{status: string, database: boolean, vector_store: boolean, ai_configured: boolean, model: string, version: string}>}
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    
    if (!response.ok) {
      return { status: 'unhealthy', database: false, vector_store: false };
    }
    
    return await response.json();
  } catch {
    return { status: 'unhealthy', database: false, vector_store: false };
  }
}

/**
 * Search history from backend (if implemented)
 * GET /api/history
 */
export async function fetchHistory() {
  try {
    const response = await fetch(`${API_URL}/history`);
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.history || [];
  } catch {
    return [];
  }
}

/**
 * Save query to history (if backend implements)
 * POST /api/history
 */
export async function saveToHistory(queryData) {
  try {
    const response = await fetch(`${API_URL}/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryData),
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Clear all query history
 * DELETE /api/history
 */
export async function clearHistoryAPI() {
  try {
    const response = await fetch(`${API_URL}/history`, {
      method: 'DELETE',
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Upload a SQLite database file
 * POST /api/database/upload
 */
export async function uploadDatabase(file) {
  const sessionId = getSessionId();
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_URL}/database/upload`, {
      method: 'POST',
      headers: {
        'X-Session-ID': sessionId,
        'X-User-ID': localStorage.getItem('nl2sql_user_id') || 'anonymous'
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Make sure the backend is running.');
    }
    throw error;
  }
}

/**
 * Get current database info
 * GET /api/database/info
 */
export async function getDatabaseInfo() {
  const sessionId = getSessionId();
  try {
    const response = await fetch(`${API_URL}/database/info`, {
      headers: {
        'X-Session-ID': sessionId
      }
    });
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Reset to default database
 * DELETE /api/database/reset
 */
export async function resetDatabase() {
  try {
    const response = await fetch(`${API_URL}/database/reset`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Reset failed');
    }

    return await response.json();
  } catch (error) {
    throw new Error('Failed to reset database');
  }
}

/**
 * Fetch list of uploaded databases for this user
 * GET /api/database/list
 */
export async function fetchDatabases() {
  const sessionId = getSessionId();
  try {
    const response = await fetch(`${API_URL}/database/list`, {
      headers: {
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.databases || [];
  } catch {
    return [];
  }
}

/**
 * Switch the active database
 * POST /api/database/switch/{hash}
 */
export async function switchDatabase(fileHash) {
  const sessionId = getSessionId();
  try {
    const response = await fetch(`${API_URL}/database/switch/${fileHash}`, {
      method: 'POST',
      headers: {
        'X-Session-ID': sessionId
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to switch database');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Get dynamic AI suggestions
 * GET /api/suggestions
 */
export async function getSuggestions(tableName = null, forceRefresh = false) {
  const sessionId = getSessionId();
  try {
    let url = `${API_URL}/suggestions?`;
    if (tableName) {
      url += `table_name=${encodeURIComponent(tableName)}`;
    }
    if (forceRefresh) {
      url += `${tableName ? '&' : ''}force_refresh=true`;
    }
    
    const response = await fetch(url, {
      headers: {
        'X-Session-ID': sessionId
      }
    });
    if (!response.ok) throw new Error('Failed to fetch suggestions');
    return await response.json();
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return null;
  }
}

/**
 * Regenerate AI suggestions
 * POST /api/suggestions/regenerate
 */
export async function regenerateSuggestions() {
  const sessionId = getSessionId();
  try {
    const response = await fetch(`${API_URL}/suggestions/regenerate`, {
      method: 'POST',
      headers: {
        'X-Session-ID': sessionId
      }
    });
    if (!response.ok) throw new Error('Failed to regenerate suggestions');
    return await response.json();
  } catch (error) {
    console.error('Error regenerating suggestions:', error);
    return null;
  }
}

/**
 * Clear AI suggestions cache
 * DELETE /api/suggestions/clear
 */
export async function clearSuggestions() {
  const sessionId = getSessionId();
  try {
    const response = await fetch(`${API_URL}/suggestions/clear`, {
      method: 'DELETE',
      headers: {
        'X-Session-ID': sessionId
      }
    });
    if (!response.ok) throw new Error('Failed to clear suggestions');
    return await response.json();
  } catch (error) {
    console.error('Error clearing suggestions:', error);
    return null;
  }
}

/**
 * Delete an uploaded database
 * DELETE /api/database/{fileHash}
 */
export async function deleteDatabase(fileHash) {
  const sessionId = getSessionId();
  try {
    const response = await fetch(`${API_URL}/database/${fileHash}`, {
      method: 'DELETE',
      headers: {
        'X-Session-ID': sessionId
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete database');
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server.');
    }
    throw error;
  }
}

/**
 * Delete a specific table from the active database
 * DELETE /api/table/{tableName}
 */
export async function deleteTable(tableName) {
  const sessionId = getSessionId();
  try {
    const response = await fetch(`${API_URL}/table/${encodeURIComponent(tableName)}`, {
      method: 'DELETE',
      headers: {
        'X-Session-ID': sessionId
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete table');
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server.');
    }
    throw error;
  }
}
