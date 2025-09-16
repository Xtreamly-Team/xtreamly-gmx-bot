import os
from urllib.parse import quote_plus

# Database Configuration
DB_HOST = os.environ.get("DB_HOST")
DB_USER = os.environ.get("DB_USER")
DB_PASSWORD = os.environ.get("DB_PASSWORD")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("MONITORING_DB_NAME")
USER_MANAGEMENT_DB_NAME = os.environ.get("USER_MANAGEMENT_DB_NAME")

# Bot Configuration
DEFAULT_LEVERAGE = int(os.environ.get("DEFAULT_LEVERAGE", "10"))
DEFAULT_POSITION_SIZE = float(os.environ.get("DEFAULT_POSITION_SIZE", "1000"))

# API Configuration
XSTREAMLY_API_URL = os.environ.get("XSTREAMLY_API_URL", "https://api.xtreamly.io")

def get_database_url() -> str:
    """Get the database URL based on environment"""
    # Use direct PostgreSQL connection
    if not DB_PASSWORD:
        raise ValueError("DB_PASSWORD is not set")
    # URL encode the password to handle special characters like colons
    encoded_password = quote_plus(DB_PASSWORD)
    return f"postgresql://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def get_user_management_database_url() -> str:
    """Get the user management database URL"""
    if not DB_PASSWORD:
        raise ValueError("DB_PASSWORD is not set")
    encoded_password = quote_plus(DB_PASSWORD)
    return f"postgresql://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{USER_MANAGEMENT_DB_NAME}"
