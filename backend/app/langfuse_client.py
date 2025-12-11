from langfuse import Langfuse
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Suppress Langfuse background error logs
logging.getLogger("langfuse").setLevel(logging.WARNING)
logging.getLogger("backoff").setLevel(logging.WARNING)

# Initialize Langfuse client only if credentials are provided
langfuse_client = None

if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
    try:
        langfuse_client = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_HOST,
            flush_at=1,  # Send data immediately
            flush_interval=1,  # Check every second
        )
        logger.info("✅ Langfuse initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize Langfuse: {e}. Continuing without observability.")
        langfuse_client = None
else:
    logger.info("Langfuse credentials not provided. Running without observability.")

def get_langfuse():
    """Get Langfuse client instance (may be None if not configured)"""
    return langfuse_client

