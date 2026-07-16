# backend/prompts/__init__.py - Prompt module initialization

from .sql_generation import SQLGenerationPrompts
from .operation_detection import OperationDetectionPrompts
from .explanation import ExplanationPrompts
from .validation import ValidationPrompts
from .suggestions import SuggestionsPrompts
from .error_correction import ErrorCorrectionPrompts
from .system_prompts import SystemPrompts

__all__ = [
    'SQLGenerationPrompts',
    'OperationDetectionPrompts',
    'ExplanationPrompts',
    'ValidationPrompts',
    'SuggestionsPrompts',
    'ErrorCorrectionPrompts',
    'SystemPrompts'
]
