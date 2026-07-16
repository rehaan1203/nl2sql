import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class QueryDetector:
    """
    Detects what tables a query needs and if it can be answered with the current table.
    """
    
    def __init__(self, schema_manager, data_profiler=None):
        self.schema_manager = schema_manager
        self.data_profiler = data_profiler
        
        self.table_relationships = {
            'movies': ['movie_cast', 'movie_directors', 'movies_finance_enhance'],
            'actors': ['movie_cast'],
            'directors': ['movie_directors'],
            'movie_cast': ['movies', 'actors'],
            'movie_directors': ['movies', 'directors'],
            'movies_finance_enhance': ['movies']
        }
    
    def detect_table_in_query(self, query: str, available_tables: List[str]) -> Optional[str]:
        """
        Detect if the query mentions a specific table and return it.
        """
        query_lower = query.lower()
        
        for table in available_tables:
            # Check if table name appears in query
            if table.lower() in query_lower:
                return table
            
            # Check for singular/plural variations
            singular = table.rstrip('s')
            if singular.lower() in query_lower:
                return table
        
        return None
    
    def detect_query_scope(self, query: str, current_table: Optional[str] = None) -> Dict[str, Any]:
        """
        Detect what tables the query needs and if it's valid for the current table.
        """
        query_lower = query.lower()
        
        all_tables = [t.name for t in self.schema_manager.get_schema().tables]
        
        mentioned_tables = []
        table_aliases = {
            'movie': ['movies', 'film', 'flicks'],
            'actor': ['actors', 'stars', 'performers'],
            'director': ['directors', 'helmers'],
            'studio': ['studios', 'production', 'producers'],
            'award': ['awards', 'prizes', 'nominations'],
            'cast': ['movie_cast', 'casting', 'roles'],
            'finance': ['movies_finance_enhance', 'financial', 'budget']
        }
        
        for table in all_tables:
            if table.lower() in query_lower:
                mentioned_tables.append(table)
        
        for synonym, tables in table_aliases.items():
            if synonym in query_lower:
                for table in tables:
                    if table in all_tables and table not in mentioned_tables:
                        mentioned_tables.append(table)
        
        if not mentioned_tables and current_table:
            current_keywords = self._get_table_keywords(current_table)
            if any(kw in query_lower for kw in current_keywords):
                mentioned_tables.append(current_table)
        
        if not mentioned_tables and current_table:
            mentioned_tables.append(current_table)
        
        join_keywords = ['join', 'with', 'related', 'associated', 'combined', 'together', 
                        'also', 'and', 'plus', 'including', 'alongside']
        requires_join = any(kw in query_lower for kw in join_keywords)
        
        needs_multi_table = len(mentioned_tables) > 1
        
        can_answer_with_current = False
        if current_table:
            if len(mentioned_tables) == 1 and mentioned_tables[0] == current_table:
                can_answer_with_current = True
            elif len(mentioned_tables) == 0:
                can_answer_with_current = True
            elif not requires_join and current_table in mentioned_tables:
                can_answer_with_current = True
        
        confidence = "high"
        if len(mentioned_tables) == 0:
            confidence = "low"
        elif requires_join and len(mentioned_tables) > 1:
            confidence = "medium"
        
        suggested_tables = mentioned_tables if mentioned_tables else [current_table] if current_table else all_tables[:1]
        
        cross_table_indicators = ['movie title', 'actor name', 'director name', 'studio name',
                                 'film title', 'cast list', 'crew', 'production']
        cross_table = any(ind in query_lower for ind in cross_table_indicators)
        
        if cross_table:
            suggested_tables = [t for t in all_tables if any(t.lower() in query_lower for t in ['movie', 'actor', 'director', 'cast'])]
            if not suggested_tables:
                suggested_tables = all_tables[:3]
                
        result = {
            "mentioned_tables": mentioned_tables,
            "requires_join": requires_join,
            "needs_multi_table": needs_multi_table or cross_table,
            "can_answer_with_current": can_answer_with_current,
            "current_table": current_table,
            "suggested_tables": suggested_tables,
            "confidence": confidence,
            "cross_table_query": cross_table,
            "table_indicators": self._get_table_indicators(query_lower),
            "can_auto_switch": False,
            "auto_switch_message": ""
        }
        
        if current_table:
            related_tables = self.table_relationships.get(current_table, [])
            mentioned_related = [t for t in related_tables if t.lower() in query.lower()]
            
            if mentioned_related:
                result.update({
                    "mentioned_tables": list(set(mentioned_tables + mentioned_related)),
                    "needs_multi_table": True,
                    "can_answer_with_current": False,
                    "suggested_tables": [current_table] + mentioned_related,
                    "can_auto_switch": True,
                    "auto_switch_message": f"This query needs data from {', '.join(mentioned_related)}. Switch to combined view?"
                })
        
        return result
    
    def _get_table_keywords(self, table_name: str) -> List[str]:
        keywords_map = {
            'movies': ['movie', 'film', 'flick', 'cinema', 'release', 'box office', 'budget', 'genre'],
            'actors': ['actor', 'actress', 'performer', 'star', 'cast', 'performance', 'role'],
            'directors': ['director', 'helmer', 'direct', 'directed'],
            'studios': ['studio', 'production', 'producer', 'produced'],
            'movie_cast': ['cast', 'role', 'character', 'portray', 'playing'],
            'awards': ['award', 'prize', 'nomination', 'winner', 'won'],
            'movies_finance_enhance': ['finance', 'budget', 'revenue', 'profit', 'loss']
        }
        return keywords_map.get(table_name, [table_name])
    
    def _get_table_indicators(self, query_lower: str) -> List[str]:
        indicators = []
        if any(kw in query_lower for kw in ['movie', 'film', 'release', 'box office', 'budget', 'genre']):
            indicators.append('movies')
        if any(kw in query_lower for kw in ['actor', 'actress', 'star', 'performer', 'role']):
            indicators.append('actors')
        if any(kw in query_lower for kw in ['director', 'directed']):
            indicators.append('directors')
        if any(kw in query_lower for kw in ['cast', 'character', 'playing']):
            indicators.append('movie_cast')
        if any(kw in query_lower for kw in ['award', 'nomination', 'winner']):
            indicators.append('awards')
        if any(kw in query_lower for kw in ['finance', 'revenue', 'profit', 'loss']):
            indicators.append('movies_finance_enhance')
        return indicators
