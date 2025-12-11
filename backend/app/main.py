from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import router
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

# Initialize Sentry (only if DSN is configured)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
    
    # Performance monitoring - capture 100% of transactions
    traces_sample_rate=1.0,
    
    # Profiling
    profiles_sample_rate=1.0,
    
    # Environment
    environment=settings.AI_PROVIDER if hasattr(settings, 'AI_PROVIDER') else "production",
    
    # Enable automatic instrumentation
    integrations=[
        FastApiIntegration(
            transaction_style="endpoint",  # Group by endpoint
            failed_request_status_codes=[500, 599],  # Track 5xx errors
        ),
        StarletteIntegration(
            transaction_style="endpoint",
        ),
    ],
    
    # Enable tracing for all requests
    enable_tracing=True,
    
    # Add release information
    release=f"ai-assistant-backend@1.0.0",
    
    # Debug mode (disable in production)
        debug=True,
    )
else:
    print("⚠️  Sentry DSN not configured - Sentry monitoring disabled")

# Create FastAPI app
app = FastAPI(
    title="AI Assistant API",
    description="Backend API for AI Chat Assistant with Action Plan Management",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router, prefix="/api/v1", tags=["chat"])

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "AI Assistant API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )

