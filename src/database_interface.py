"""
Simple database interface using raw SQL
Supports PostgreSQL (production)
"""

import logging
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

try:
    import asyncpg
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False

from src.config import get_database_url, get_user_management_database_url

logger = logging.getLogger(__name__)


class DatabaseInterface:
    """Simple database interface using raw SQL"""

    def __init__(self, database_url: str = None):
        self.database_url = database_url or get_database_url()
        self.connection = None

    async def connect(self):
        """Connect to the database"""
        if not POSTGRES_AVAILABLE:
            raise ImportError("asyncpg is required for PostgreSQL support")
        
        self.connection = await asyncpg.connect(self.database_url)
        logger.info(f"Connected to PostgreSQL database")

    async def disconnect(self):
        """Disconnect from the database"""
        if self.connection:
            await self.connection.close()
            self.connection = None

    @asynccontextmanager
    async def get_connection(self):
        """Get a database connection (context manager)"""
        if not self.connection:
            await self.connect()
        yield self.connection

    async def execute(self, query: str, params: tuple = ()) -> Any:
        """Execute a query and return results"""
        # Normalize query for the current database type
        normalized_query = self.normalize_query(query)

        async with self.get_connection() as conn:
            if query.strip().upper().startswith("SELECT"):
                results = await conn.fetch(normalized_query, *params)
                # For consistency with SQLite, return results and column names
                if results:
                    # Get column names from the first row
                    column_names = list(results[0].keys()) if results else []
                    # Convert asyncpg.Record objects to tuples for consistency
                    tuple_results = [tuple(row.values()) for row in results]
                    return tuple_results, column_names
                else:
                    return [], []
            else:
                # For non-SELECT queries (INSERT, UPDATE, DELETE), return the command status
                # which indicates the number of affected rows
                result = await conn.execute(normalized_query, *params)
                # asyncpg returns a string like "UPDATE 1" or "INSERT 0 1"
                # We need to extract the number of affected rows
                if isinstance(result, str):
                    # Extract the number from strings like "UPDATE 1" or "INSERT 0 1"
                    import re
                    match = re.search(r"(\d+)$", result)
                    return int(match.group(1)) if match else 0
                return result

    async def execute_one(self, query: str, params: tuple = ()) -> Optional[Dict]:
        """Execute a query and return one result"""
        # Normalize query for the current database type
        normalized_query = self.normalize_query(query)

        async with self.get_connection() as conn:
            row = await conn.fetchrow(normalized_query, *params)
            return dict(row) if row else None

    def normalize_query(self, query: str) -> str:
        """Normalize query for PostgreSQL"""
        # PostgreSQL uses $1, $2, etc. for parameters
        # This is already the format we expect, so just return as-is
        return query


# Global database instances
monitoring_db = DatabaseInterface(get_database_url())
user_management_db = DatabaseInterface(get_user_management_database_url())
