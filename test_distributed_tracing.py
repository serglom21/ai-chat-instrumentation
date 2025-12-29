#!/usr/bin/env python3
"""
Test script to verify distributed tracing between React Native (Sentry SDK) 
and Python backend (OpenTelemetry)
"""
import requests
import json
import sys

# Simulate Sentry React Native SDK trace headers
# Format: sentry-trace header: {trace_id}-{span_id}-{sampled}
TEST_TRACE_ID = "12345678901234567890123456789012"  # 32 hex chars
TEST_SPAN_ID = "1234567890123456"  # 16 hex chars
SAMPLED = "1"  # 1 = sampled, 0 = not sampled

# Sentry baggage header format
TEST_BAGGAGE = f"sentry-trace_id={TEST_TRACE_ID},sentry-environment=test,sentry-release=1.0.0"

# W3C TraceParent format (OpenTelemetry standard)
# Format: version-trace_id-parent_id-trace_flags
TEST_TRACEPARENT = f"00-{TEST_TRACE_ID}-{TEST_SPAN_ID}-01"

def test_trace_propagation():
    """Test if backend correctly extracts and continues the trace"""
    
    print("🧪 Testing Distributed Tracing: React Native → OpenTelemetry Backend")
    print("=" * 70)
    
    # Test 1: Send request with Sentry headers
    print("\n📤 Test 1: Sending request with Sentry-style headers...")
    print(f"   sentry-trace: {TEST_TRACE_ID}-{TEST_SPAN_ID}-{SAMPLED}")
    print(f"   baggage: {TEST_BAGGAGE}")
    
    try:
        response1 = requests.post(
            "http://localhost:8000/api/v1/action-plan/generate",
            headers={
                "Content-Type": "application/json",
                "sentry-trace": f"{TEST_TRACE_ID}-{TEST_SPAN_ID}-{SAMPLED}",
                "baggage": TEST_BAGGAGE,
            },
            json={
                "template_content": "Test trace propagation",
                "conversation_history": []
            },
            timeout=30
        )
        
        if response1.status_code == 200:
            print("   ✅ Request successful")
            print(f"   📝 Check backend logs for: 'Current trace ID: {TEST_TRACE_ID}'")
        else:
            print(f"   ❌ Request failed with status {response1.status_code}")
            print(f"   Response: {response1.text[:200]}")
            
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return False
    
    # Test 2: Send request with W3C TraceContext headers
    print("\n📤 Test 2: Sending request with W3C TraceContext headers...")
    print(f"   traceparent: {TEST_TRACEPARENT}")
    
    try:
        response2 = requests.post(
            "http://localhost:8000/api/v1/action-plan/generate",
            headers={
                "Content-Type": "application/json",
                "traceparent": TEST_TRACEPARENT,
                "baggage": TEST_BAGGAGE,
            },
            json={
                "template_content": "Test W3C trace propagation",
                "conversation_history": []
            },
            timeout=30
        )
        
        if response2.status_code == 200:
            print("   ✅ Request successful")
            print(f"   📝 Check backend logs for: 'Current trace ID: {TEST_TRACE_ID}'")
        else:
            print(f"   ❌ Request failed with status {response2.status_code}")
            
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return False
    
    # Test 3: Send request with BOTH headers (what frontend actually sends)
    print("\n📤 Test 3: Sending request with BOTH Sentry + W3C headers (real scenario)...")
    
    try:
        response3 = requests.post(
            "http://localhost:8000/api/v1/action-plan/generate",
            headers={
                "Content-Type": "application/json",
                "sentry-trace": f"{TEST_TRACE_ID}-{TEST_SPAN_ID}-{SAMPLED}",
                "traceparent": TEST_TRACEPARENT,
                "baggage": TEST_BAGGAGE,
            },
            json={
                "template_content": "Test combined headers",
                "conversation_history": []
            },
            timeout=30
        )
        
        if response3.status_code == 200:
            print("   ✅ Request successful")
        else:
            print(f"   ❌ Request failed with status {response3.status_code}")
            
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return False
    
    print("\n" + "=" * 70)
    print("🔍 Next Steps:")
    print("   1. Check the backend terminal for DEBUG logs showing:")
    print("      - '=== INCOMING REQUEST HEADERS ==='")
    print("      - 'Current trace ID' should match:", TEST_TRACE_ID)
    print("      - 'Current span ID' (should be a NEW span, child of", TEST_SPAN_ID + ")")
    print("\n   2. Go to Sentry → Performance → Traces")
    print("      - Search for trace ID:", TEST_TRACE_ID)
    print("      - Should see spans from BOTH frontend and backend")
    print("\n   3. If trace IDs don't match → OpenTelemetry is NOT extracting headers")
    print("      - This means W3C propagator isn't working")
    print("\n" + "=" * 70)
    
    return True


def check_backend_health():
    """Check if backend is running"""
    try:
        response = requests.get("http://localhost:8000/api/v1/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running\n")
            return True
        else:
            print(f"❌ Backend returned status {response.status_code}\n")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Backend is not running. Start it with:")
        print("   cd backend && venv/bin/python run.py\n")
        return False
    except Exception as e:
        print(f"❌ Error checking backend: {e}\n")
        return False


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🔬 Distributed Tracing Test Suite")
    print("   Testing: React Native (Sentry) → FastAPI (OpenTelemetry)")
    print("=" * 70 + "\n")
    
    # Check backend is running
    if not check_backend_health():
        sys.exit(1)
    
    # Run tests
    success = test_trace_propagation()
    
    if success:
        print("\n✅ All tests completed! Check backend logs and Sentry for results.\n")
        sys.exit(0)
    else:
        print("\n❌ Tests failed. Check the errors above.\n")
        sys.exit(1)






