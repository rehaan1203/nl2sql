# backend/prompts/operation_detection.py - Operation Detection Prompts

class OperationDetectionPrompts:
    """
    Prompts for detecting what type of operation the user wants.
    Used before SQL generation to determine the appropriate workflow.
    """
    
    # Natural language to operation type mapping
    OPERATION_DETECTION_TEMPLATE = """
    Analyze the following user question and determine what type of database operation they want.
    
    User Question: {question}
    
    ### Operation Types:
    - SELECT: Questions that ask to view, show, list, find, or retrieve data
    - INSERT: Questions that ask to add, create, insert, or put new data
    - UPDATE: Questions that ask to change, modify, edit, update, or adjust data
    - DELETE: Questions that ask to remove, delete, erase, or clear data
    - CREATE: Questions that ask to create a new table, view, or schema structure
    - DROP: Questions that ask to drop, remove, or delete a table or schema structure
    - ALTER: Questions that ask to alter, modify, or change a table structure
    - BEGIN: Questions that ask to start a transaction
    - COMMIT: Questions that ask to save or commit changes
    - ROLLBACK: Questions that ask to undo, cancel, or rollback changes
    - GRANT: Questions that ask to give permissions
    - REVOKE: Questions that ask to remove permissions
    
    ### Response Format:
    Return ONLY the operation type (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, BEGIN, COMMIT, ROLLBACK, GRANT, REVOKE).
    
    ### Examples:
    User: "Show me all movies" → SELECT
    User: "Add a new movie" → INSERT
    User: "Change the budget of Inception" → UPDATE
    User: "Remove movies from 2020" → DELETE
    User: "Create a table for actors" → CREATE
    User: "Drop the temporary table" → DROP
    User: "Undo my changes" → ROLLBACK
    """
    
    # Operation-specific keyword detection
    OPERATION_KEYWORDS = {
        "CREATE": [
            "create table", "new table", "build table", "make table", "create a table"
        ],
        "ALTER": [
            "alter table", "add column", "remove column", "rename table", "rename column"
        ],
        "DROP": [
            "drop table", "delete table", "remove table"
        ],
        "BEGIN": [
            "start transaction", "begin transaction"
        ],
        "COMMIT": [
            "commit", "save changes", "apply changes"
        ],
        "ROLLBACK": [
            "rollback", "undo changes", "cancel changes", "revert"
        ],
        "GRANT": [
            "grant", "give permission", "allow access"
        ],
        "REVOKE": [
            "revoke", "remove permission", "deny access"
        ],
        "INSERT": [
            "insert", "add row", "add record", "insert row", "add entry"
        ],
        "UPDATE": [
            "update", "change", "modify", "edit", "adjust", "set",
            "change row", "update row", "modify row"
        ],
        "DELETE": [
            "delete", "remove", "drop", "erase", "clear", "delete row",
            "remove row", "erase row", "delete record"
        ],
        "SELECT": [
            "show", "list", "view", "find", "retrieve", "get", "display",
            "fetch", "what", "which", "how many", "count", "average",
            "sum", "min", "max", "top", "bottom", "best", "worst"
        ]
    }
