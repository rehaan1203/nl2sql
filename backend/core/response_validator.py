import sqlite3
import re
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

class ResponseValidator:
    """
    Validates agent responses against actual database data to prevent hallucinations.
    """
    
    def __init__(self, db_path: str, data_profiler=None):
        self.db_path = db_path
        self.data_profiler = data_profiler
        self.validation_cache = {}
        
        self.claim_patterns = {
            "ids": [
                r'(?:id[s]?\s+)([\d,\s]+)(?:\s+for|\s+of|\s+in)',
                r'(?:movie|actor|director|film|record)\s+id[s]?\s+(?:is|are|of|for)\s+([\d,\s]+)',
                r'([\d,\s]+)\s+(?:row[s]?|record[s]?|entry[s]?)',
                r'(?:id[s]?\s+)(?:[\d,\s]+)\s+for\s+([\d,\s]+)'
            ],
            "names": [
                r'(?:movie|film|actor|director)\s+[\'"]?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)[\'"]?',
                r'(?:titled|named|called)\s+[\'"]?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)[\'"]?',
                r'(?:value|values?|name|names?)\s+(?:is|are)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'
            ],
            "numbers": [
                r'([\d,]+)\s+(?:million|billion|M|B)',
                r'(?:total|sum|average|avg|mean)\s+(?:is|was|are)\s+([\d,.]+)',
                r'(?:profit|loss|revenue|budget)\s+(?:of|from)\s+([\d,.]+)'
            ]
        }
    
    def validate_response(self, sql: str, response: str, table_name: str, data: List[Dict]) -> Dict[str, Any]:
        """
        Validate that the response matches actual data.
        """
        logger.info(f"🔍 Validating response for table: {table_name}")
        
        table_profile = None
        if self.data_profiler:
            try:
                table_profile = self.data_profiler.profile_table(table_name)
            except Exception as e:
                logger.warning(f"Could not load table profile for validation: {e}")

        claims = self._extract_claims(response)
        logger.info(f"📋 Extracted {len(claims)} claims from response")
        
        verification_results = []
        hallucinated = False
        
        for claim in claims:
            data_valid, data_error = self._verify_against_data(claim, table_name, data)
            
            if not data_valid and table_profile:
                profile_valid, profile_error = self._verify_against_profile(claim, table_name, table_profile)
                if profile_valid:
                    verification_results.append({
                        "claim": claim,
                        "valid": True,
                        "source": "profile",
                        "error": None
                    })
                    continue
            
            verification_results.append({
                "claim": claim,
                "valid": data_valid,
                "source": "data" if data_valid else "none",
                "error": data_error if not data_valid else None
            })
            if not data_valid:
                hallucinated = True
                logger.warning(f"⚠️ Hallucination detected: '{claim}' - {data_error}")
        
        data_verification = self._verify_response_with_data(response, data)
        
        return {
            "valid": not hallucinated and data_verification["valid"],
            "hallucinated": hallucinated or not data_verification["valid"],
            "verification_results": verification_results,
            "data_verification": data_verification,
            "total_claims": len(claims),
            "verified_claims": len([r for r in verification_results if r["valid"]]),
            "hallucinated_claims": len([r for r in verification_results if not r["valid"]]),
            "table_name": table_name,
            "sql": sql
        }

    def _extract_claims(self, response: str) -> List[str]:
        claims = []
        for claim_type, patterns in self.claim_patterns.items():
            for pattern in patterns:
                matches = re.findall(pattern, response, re.IGNORECASE)
                for match in matches:
                    claim = str(match).strip()
                    if claim and len(claim) > 1:
                        claims.append(claim)
        
        id_pattern = r'\b(\d+)\b'
        id_matches = re.findall(id_pattern, response)
        for match in id_matches:
            if match not in claims and len(match) <= 3:
                claims.append(match)
        
        return list(set(claims))
    
    def _verify_against_data(self, claim: str, table_name: str, data: List[Dict]) -> Tuple[bool, Optional[str]]:
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            if claim.replace(',', '').replace(' ', '').isdigit():
                claim_int = int(claim.replace(',', '').replace(' ', ''))
                
                try:
                    query = f"SELECT COUNT(*) FROM {table_name} WHERE id = ?"
                    cursor.execute(query, (claim_int,))
                    count = cursor.fetchone()[0]
                    
                    if count > 0:
                        return True, None
                    else:
                        fk_query = f"SELECT COUNT(*) FROM {table_name} WHERE actor_id = ? OR movie_id = ? OR director_id = ?"
                        cursor.execute(fk_query, (claim_int, claim_int, claim_int))
                        count = cursor.fetchone()[0]
                        if count > 0:
                            return True, None
                        else:
                            return False, f"ID {claim_int} not found in table {table_name}"
                except:
                    return False, f"Could not verify ID {claim_int}"
            
            elif len(claim) > 2 and claim[0].isupper():
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = cursor.fetchall()
                
                for col in columns:
                    col_name = col[1]
                    col_type = col[2].upper()
                    
                    if 'TEXT' in col_type or 'VARCHAR' in col_type:
                        query = f"SELECT COUNT(*) FROM {table_name} WHERE {col_name} LIKE ?"
                        cursor.execute(query, (f"%{claim}%",))
                        count = cursor.fetchone()[0]
                        if count > 0:
                            conn.close()
                            return True, None
                
                for row in data:
                    for value in row.values():
                        if value and claim.lower() in str(value).lower():
                            conn.close()
                            return True, None
                
                return False, f"Value '{claim}' not found in table {table_name}"
            
            return True, None 
            
        except Exception as e:
            return False, f"Verification error: {str(e)}"
        finally:
            try:
                conn.close()
            except:
                pass

    def _verify_against_profile(self, claim: str, table_name: str, table_profile: Dict) -> Tuple[bool, Optional[str]]:
        return False, "Not found in profile"

    def _verify_response_with_data(self, response: str, data: List[Dict]) -> Dict[str, Any]:
        if not data:
            return {"valid": True, "issues": []} 
        
        issues = []
        
        response_values = re.findall(r'\b(\d+)\b|\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', response)
        response_values = [v for v in response_values if v and len(str(v)) > 1]
        
        data_values = []
        for row in data:
            for value in row.values():
                if value is not None and str(value).strip():
                    data_values.append(str(value))
        
        for val in response_values:
            if isinstance(val, tuple):
                val = val[0] or val[1]
            if val and len(str(val)) > 1:
                exists = any(str(val).lower() in str(dv).lower() for dv in data_values)
                if not exists and len(str(val)) > 3:
                    issues.append(f"Value '{val}' mentioned in response but not found in data")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues
        }
