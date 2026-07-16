# backend/tests/run_tests.py - Test runner

import pytest
import sys
import os

if __name__ == "__main__":
    # Add backend directory to path
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # Run tests with coverage
    exit_code = pytest.main([
        os.path.dirname(os.path.abspath(__file__)),
        "-v"
    ])
    
    sys.exit(exit_code)
