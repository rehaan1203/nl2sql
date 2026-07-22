# backend/utils/logging_config.py - Structured logging

import logging
import json
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler

class StructuredLogFormatter(logging.Formatter):
    """Format logs as structured JSON for better parsing."""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, "extra"):
            log_entry.update(record.extra)
        
        return json.dumps(log_entry)

def setup_logging(log_level: str = "INFO"):
    """Setup structured logging for the application."""
    level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Create logs directory if it doesn't exist
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    # File handler with rotation
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, "app.log"),
        maxBytes=10_000_000,  # 10MB
        backupCount=5
    )
    file_handler.setFormatter(StructuredLogFormatter())
    file_handler.setLevel(level)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    # Specific loggers
    loggers = {
        "agents": logging.getLogger("agents"),
        "schema_manager": logging.getLogger("schema_manager"),
        "sql_validator": logging.getLogger("sql_validator"),
        "safe_executor": logging.getLogger("safe_executor"),
        "prompt_manager": logging.getLogger("prompt_manager"),
    }
    for logger_name in loggers:
        loggers[logger_name].setLevel(level)
    
    return root_logger
