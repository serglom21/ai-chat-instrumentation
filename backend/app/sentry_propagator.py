"""
Custom OpenTelemetry propagator to extract Sentry trace headers
and convert them to W3C TraceContext format.

Sentry React Native SDK sends headers in format:
  sentry-trace: {trace_id}-{span_id}-{sampled}
  baggage: sentry-trace_id={trace_id},...

We need to convert this to W3C TraceContext that OpenTelemetry expects.
"""
import typing
from opentelemetry import trace
from opentelemetry.propagators.textmap import TextMapPropagator, Setter, Getter, CarrierT
from opentelemetry.trace import SpanContext, TraceFlags, TraceState


class SentryPropagator(TextMapPropagator):
    """
    Extracts trace context from Sentry headers and creates W3C-compatible SpanContext
    """
    
    _SENTRY_TRACE_HEADER = "sentry-trace"
    _BAGGAGE_HEADER = "baggage"
    
    def extract(
        self,
        carrier: CarrierT,
        context: typing.Optional[typing.Any] = None,
        getter: Getter = None,
    ) -> typing.Any:
        """
        Extract Sentry trace context from carrier (HTTP headers)
        """
        if context is None:
            context = {}
        
        if getter is None:
            getter = self._default_getter
        
        # Get sentry-trace header
        sentry_trace = getter.get(carrier, self._SENTRY_TRACE_HEADER)
        
        if not sentry_trace:
            return context
        
        try:
            # Parse: {trace_id}-{span_id}-{sampled}
            parts = sentry_trace[0].split("-") if isinstance(sentry_trace, list) else sentry_trace.split("-")
            
            if len(parts) != 3:
                print(f"⚠️ Invalid sentry-trace format: {sentry_trace}")
                return context
            
            trace_id_hex, span_id_hex, sampled = parts
            
            # Convert to integers (OpenTelemetry expects integers)
            trace_id = int(trace_id_hex, 16)
            span_id = int(span_id_hex, 16)
            
            # Set trace flags based on sampled flag
            trace_flags = TraceFlags(0x01) if sampled == "1" else TraceFlags(0x00)
            
            # Create SpanContext
            span_context = SpanContext(
                trace_id=trace_id,
                span_id=span_id,
                is_remote=True,
                trace_flags=trace_flags,
                trace_state=TraceState(),
            )
            
            # Set the span context in the current context
            new_context = trace.set_span_in_context(
                trace.NonRecordingSpan(span_context),
                context
            )
            
            print(f"✅ Extracted Sentry trace context:")
            print(f"   Trace ID: {trace_id_hex}")
            print(f"   Span ID: {span_id_hex}")
            print(f"   Sampled: {sampled}")
            
            return new_context
            
        except (ValueError, IndexError) as e:
            print(f"⚠️ Error parsing sentry-trace header: {e}")
            return context
    
    def inject(
        self,
        carrier: CarrierT,
        context: typing.Optional[typing.Any] = None,
        setter: Setter = None,
    ) -> None:
        """
        We don't need to inject Sentry headers (only extract)
        OpenTelemetry will use W3C format for outgoing requests
        """
        pass
    
    @property
    def fields(self) -> typing.Set[str]:
        """Return the fields this propagator reads"""
        return {self._SENTRY_TRACE_HEADER, self._BAGGAGE_HEADER}
    
    @staticmethod
    def _default_getter(carrier: CarrierT, key: str) -> typing.Optional[typing.List[str]]:
        """Default getter for HTTP headers"""
        if carrier is None:
            return None
        value = carrier.get(key.lower())
        if value is None:
            value = carrier.get(key)
        if value is None:
            return None
        return [value] if isinstance(value, str) else value


