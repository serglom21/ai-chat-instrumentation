from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import router
from app.otel_config import setup_otel, instrument_app

# Initialize OpenTelemetry (sends traces to Sentry via OTLP)
setup_otel()

# Create FastAPI app
app = FastAPI(
    title="AI Assistant API",
    description="Backend API for AI Chat Assistant with Action Plan Management",
    version="1.0.0",
)

# Instrument app with OpenTelemetry
instrument_app(app)

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

