import sqlite3
import logging
from typing import Dict, List, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class DataProfiler:
    """
    Analyzes actual data in the database to generate data-aware suggestions.
    
    Key Features:
    1. Column statistics (min, max, avg, distinct values)
    2. Date range detection
    3. Value distribution analysis
    4. Common patterns detection
    """
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        # Convert sqlite:/// path if needed
        if self.db_path.startswith("sqlite:///"):
            self.db_path = self.db_path.replace("sqlite:///", "")
        self.profile_cache = {}
    
    def profile_table(self, table_name: str) -> Dict[str, Any]:
        """
        Profile a specific table with actual data analysis using optimized SQLite aggregate functions.
        """
        if table_name in self.profile_cache:
            return self.profile_cache[table_name]
        
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            
            # Get total row count
            cursor = conn.execute(f"SELECT COUNT(*) as count FROM {table_name}")
            row_count = cursor.fetchone()['count']
            
            # Get column info
            cursor = conn.execute(f"PRAGMA table_info({table_name})")
            columns_info = cursor.fetchall()
            
            column_stats = {}
            
            for col_info in columns_info:
                col_name = col_info['name']
                col_type = col_info['type']
                
                try:
                    # Basic stats
                    stats_query = f"""
                        SELECT 
                            COUNT({col_name}) as count,
                            COUNT(DISTINCT {col_name}) as distinct_count,
                            SUM(CASE WHEN {col_name} IS NULL THEN 1 ELSE 0 END) as null_count
                        FROM {table_name}
                    """
                    cursor = conn.execute(stats_query)
                    stats = cursor.fetchone()
                    
                    # Get a few distinct sample values quickly
                    sample_query = f"SELECT DISTINCT {col_name} FROM {table_name} WHERE {col_name} IS NOT NULL LIMIT 5"
                    sample_values = [row[0] for row in conn.execute(sample_query)]
                    
                    col_stats = {
                        "type": col_type,
                        "distinct_count": stats['distinct_count'],
                        "null_count": stats['null_count'] or 0,
                        "sample_values": sample_values
                    }
                    
                    type_upper = col_type.upper()
                    
                    # Numeric analysis
                    if type_upper in ['INTEGER', 'REAL', 'FLOAT', 'NUMERIC', 'DECIMAL', 'INT', 'DOUBLE']:
                        numeric_query = f"""
                            SELECT 
                                MIN({col_name}) as min,
                                MAX({col_name}) as max,
                                AVG({col_name}) as avg
                            FROM {table_name}
                            WHERE {col_name} IS NOT NULL
                        """
                        cursor = conn.execute(numeric_query)
                        numeric_stats = cursor.fetchone()
                        col_stats.update({
                            "min": numeric_stats['min'],
                            "max": numeric_stats['max'],
                            "avg": numeric_stats['avg']
                        })
                    
                    # Date analysis
                    elif 'DATE' in type_upper or 'TIME' in type_upper:
                        date_query = f"""
                            SELECT 
                                MIN({col_name}) as min_date,
                                MAX({col_name}) as max_date
                            FROM {table_name}
                            WHERE {col_name} IS NOT NULL
                        """
                        cursor = conn.execute(date_query)
                        date_stats = cursor.fetchone()
                        col_stats.update({
                            "min_date": date_stats['min_date'],
                            "max_date": date_stats['max_date']
                        })
                    
                    # Categorical/Text analysis (find most common)
                    elif type_upper in ['TEXT', 'VARCHAR', 'CHAR', 'STRING'] and stats['distinct_count'] < 50:
                        top_values_query = f"""
                            SELECT {col_name}, COUNT(*) as count
                            FROM {table_name}
                            WHERE {col_name} IS NOT NULL
                            GROUP BY {col_name}
                            ORDER BY count DESC
                            LIMIT 3
                        """
                        cursor = conn.execute(top_values_query)
                        top_values = [{"value": row[0], "count": row[1]} for row in cursor]
                        col_stats["top_values"] = top_values
                    
                    column_stats[col_name] = col_stats
                    
                except Exception as e:
                    logger.warning(f"Failed to analyze column {col_name} in {table_name}: {e}")
                    column_stats[col_name] = {"type": col_type, "error": str(e)}
            
            profile = {
                "table_name": table_name,
                "row_count": row_count,
                "column_stats": column_stats,
                "profile_time": datetime.now().isoformat()
            }
            
            self.profile_cache[table_name] = profile
            conn.close()
            logger.info(f"✅ Profiled table {table_name}: {row_count} rows, {len(column_stats)} columns")
            return profile
            
        except Exception as e:
            logger.error(f"Failed to profile table {table_name}: {e}")
            return {"error": str(e)}
        finally:
            if conn:
                conn.close()
    
    def get_interesting_facts(self, table_name: str) -> List[str]:
        """
        Extract interesting facts from the profiled data for prompt enrichment.
        """
        profile = self.profile_table(table_name)
        facts = []
        
        if "error" in profile:
            return facts
        
        for col_name, stats in profile.get("column_stats", {}).items():
            if "min_date" in stats and stats["min_date"] and stats["max_date"]:
                facts.append(f"Data in {col_name} spans from {stats['min_date']} to {stats['max_date']}")
            
            if "top_values" in stats and stats["top_values"]:
                top = stats["top_values"][0]
                facts.append(f"Most common '{col_name}' is '{top['value']}'")
            
            if "min" in stats and stats["min"] is not None:
                if isinstance(stats["min"], (int, float)) and isinstance(stats["max"], (int, float)):
                    avg_val = stats.get("avg")
                    avg_str = f" (avg: {avg_val:.1f})" if avg_val is not None else ""
                    facts.append(f"Numeric range of {col_name} is {stats['min']:.1f} to {stats['max']:.1f}{avg_str}")
                else:
                    facts.append(f"Range of {col_name} is {stats['min']} to {stats['max']}")
        
        return facts

    def get_table_facts(self, table_name: str) -> List[str]:
        """Alias for get_interesting_facts"""
        return self.get_interesting_facts(table_name)

    def get_table_context(self, table_name: str) -> str:
        """
        Get table-specific context for AI prompt generation.
        ONLY includes information about the specified table.
        """
        profile = self.profile_table(table_name)
        
        if "error" in profile:
            return f"Error profiling table: {profile['error']}"
        
        context = f"Table Name: {table_name}\nTotal Rows: {profile['row_count']}\n\nColumns:\n"
        
        for col_name, stats in profile.get("column_stats", {}).items():
            context += f"- {col_name}: {stats['type']}"
            
            # Add data insights
            if 'min' in stats and stats['min'] is not None:
                context += f" (range: {stats['min']} to {stats['max']}"
                if 'avg' in stats and stats['avg'] is not None:
                    try:
                        context += f", avg: {float(stats['avg']):.1f}"
                    except (ValueError, TypeError):
                        pass
                context += ")"
            
            if 'min_date' in stats and stats['min_date']:
                context += f" (dates: {stats['min_date']} to {stats['max_date']})"
            
            if 'top_values' in stats and stats['top_values']:
                top_vals = ', '.join([f"'{v['value']}'" for v in stats['top_values'][:3]])
                context += f" (most common: {top_vals})"
            
            context += "\n"
        
        return context
