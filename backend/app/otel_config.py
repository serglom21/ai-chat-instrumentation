"""
OpenTelemetry configuration for sending traces to Sentry via OTLP
"""
from opentelemetry import trace, propagate
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.baggage.propagation import W3CBaggagePropagator
from opentelemetry.propagators.composite import CompositeHTTPPropagator
from app.config import settings
from app.sentry_propagator import SentryPropagator


def setup_otel():
    """
    Configure OpenTelemetry to send traces to Sentry via OTLP endpoint
    """
    # Create resource with service information
    resource = Resource.create({
        SERVICE_NAME: "ai-assistant-backend",
        SERVICE_VERSION: "1.0.0",
        "deployment.environment": settings.AI_PROVIDER if hasattr(settings, 'AI_PROVIDER') else "production",
    })
    
    # Create tracer provider
    provider = TracerProvider(resource=resource)
    
    # Configure OTLP exporter for Sentry
    # Sentry OTLP endpoint format: https://<org-ingest>.ingest.us.sentry.io/api/<project-id>/integration/otlp
    otlp_exporter = OTLPSpanExporter(
        endpoint="https://o4508236363464704.ingest.us.sentry.io/api/4510517681979392/integration/otlp/v1/traces",
        headers={
            "x-sentry-auth": "sentry sentry_key=0036c6168cb9a4e5ce2d8abe21d13431",
            "Content-Type": "application/json",
        }
    )
    
    # Add span processor with batch export
    provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    
    # Set as global tracer provider
    trace.set_tracer_provider(provider)
    
    # Configure trace propagation to extract incoming trace context
    # This allows continuing traces from Sentry frontend SDK
    set_global_textmap(
        CompositeHTTPPropagator([
            SentryPropagator(),               # Extract Sentry's sentry-trace header (React Native)
            TraceContextTextMapPropagator(),  # W3C Trace Context (traceparent/tracestate)
            W3CBaggagePropagator(),           # W3C Baggage
        ])
    )
    
    print("✅ OpenTelemetry initialized with Sentry OTLP endpoint")
    print("✅ Trace propagation configured: Sentry + W3C TraceContext + Baggage")
    
    return provider


def instrument_app(app):
    """
    Instrument FastAPI app with OpenTelemetry
    """
    # Instrument FastAPI
    FastAPIInstrumentor.instrument_app(app)
    
    # Instrument HTTPX (for outgoing HTTP requests)
    HTTPXClientInstrumentor().instrument()
    
    print("✅ FastAPI and HTTPX instrumented with OpenTelemetry")

