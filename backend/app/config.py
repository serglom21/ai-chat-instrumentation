import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # API Keys
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    
    # Langfuse Configuration
    LANGFUSE_PUBLIC_KEY: str = os.getenv("LANGFUSE_PUBLIC_KEY", "")
    LANGFUSE_SECRET_KEY: str = os.getenv("LANGFUSE_SECRET_KEY", "")
    LANGFUSE_HOST: str = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
    
    # Model Configuration
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "openai")  # "openai", "gemini", or "groq"
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "gpt-4-turbo-preview")
    
    # Server Configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    
    # Sentry Configuration
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")
    
    # CORS
    CORS_ORIGINS: list = [
        "http://localhost:19000",
        "http://localhost:19001",
        "http://localhost:19002",
        "exp://localhost:19000",
        "*",  # Allow all for development - restrict in production
    ]

settings = Settings()

