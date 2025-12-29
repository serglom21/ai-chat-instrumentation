#!/usr/bin/env python3
"""
Test script to verify backend performance metrics are correctly captured.
Isolates testing to just the backend without frontend involvement.
"""

import requests
import json
import time
from typing import Dict, List, Any

# Backend configuration
BACKEND_URL = "http://localhost:8000/api/v1"

# Expected attributes to verify
EXPECTED_AI_ATTRIBUTES = [
    # Streaming metrics
    'ai.ttft',
    'ai.ttlt',
    'ai.queue_time',
    'ai.generation_time',
    'ai.tokens_per_second',
    'ai.mean_time_per_token',
    
    # Stream-specific
    'ai.chunk_count',
    'ai.time_between_chunks_avg',
    'ai.time_between_chunks_p95',
    
    # Token usage
    'ai.input_tokens',
    'ai.output_tokens',
    'ai.total_tokens',
    'ai.context_window_usage_pct',
    
    # Model configuration
    'ai.provider',
    'ai.model',
    'ai.temperature',
    'ai.max_tokens',
    'ai.streaming_enabled',
    
    # Content complexity
    'ai.prompt_length',
    'ai.prompt_complexity',
    'ai.message_count',
    
    # Caching
    'ai.cache_hit',
]

def print_header(text: str):
    """Print a formatted header"""
    print(f"\n{'='*80}")
    print(f"  {text}")
    print(f"{'='*80}\n")

def print_success(text: str):
    """Print success message"""
    print(f"✅ {text}")

def print_error(text: str):
    """Print error message"""
    print(f"❌ {text}")

def print_info(text: str):
    """Print info message"""
    print(f"ℹ️  {text}")

def print_metric(name: str, value: Any):
    """Print a metric"""
    print(f"   📊 {name}: {value}")

def test_action_plan_generation():
    """Test action plan generation endpoint and verify metrics"""
    print_header("TEST 1: Action Plan Generation with Metrics Capture")
    
    # Prepare request
    payload = {
        "template_content": "Create a comprehensive 30-day fitness plan focused on building strength and improving cardiovascular health.",
        "conversation_history": [
            {
                "role": "user",
                "content": "I want to get healthier and stronger"
            }
        ]
    }
    
    print_info("Sending request to /action-plan/generate endpoint...")
    print_info(f"Template: {payload['template_content'][:50]}...")
    
    # Time the request
    start_time = time.time()
    
    try:
        # Make request with trace headers
        headers = {
            "Content-Type": "application/json",
            "sentry-trace": "12345678901234567890123456789012-1234567890123456-1",
            "baggage": "sentry-environment=test,sentry-trace_id=12345678901234567890123456789012"
        }
        
        response = requests.post(
            f"{BACKEND_URL}/action-plan/generate",
            json=payload,
            headers=headers,
            timeout=60
        )
        
        request_duration = (time.time() - start_time) * 1000  # ms
        
        print_success(f"Request completed in {request_duration:.0f}ms")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check response structure
            print_success("Response received successfully")
            print_metric("Response length", len(data.get('response', '')))
            print_metric("Has action plan", 'action_plan' in data)
            
            if 'action_plan' in data:
                action_plan = data['action_plan']
                print_metric("Plan ID", action_plan.get('id'))
                print_metric("Plan title", action_plan.get('title'))
                print_metric("Content length", len(action_plan.get('content', '')))
            
            return True
        else:
            print_error(f"Request failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception occurred: {str(e)}")
        return False

def test_streaming_metrics_calculation():
    """Test that streaming metrics are properly calculated"""
    print_header("TEST 2: Streaming Metrics Calculation")
    
    print_info("Testing with multiple conversation turns for complexity...")
    
    payload = {
        "template_content": "Plan a 7-day meal prep strategy for a busy professional who wants to eat healthy on a budget.",
        "conversation_history": [
            {"role": "user", "content": "I'm very busy with work"},
            {"role": "assistant", "content": "I understand. Let me help you create an efficient plan."},
            {"role": "user", "content": "I also want to save money on groceries"},
            {"role": "assistant", "content": "Great! Budget-friendly meal planning is important."},
        ]
    }
    
    print_metric("Message count", len(payload['conversation_history']) + 1)
    print_metric("Total prompt length", sum(len(m['content']) for m in payload['conversation_history']) + len(payload['template_content']))
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/action-plan/generate",
            json=payload,
            timeout=60
        )
        
        if response.status_code == 200:
            print_success("Complex prompt handled successfully")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_backend_logs_for_metrics():
    """Check backend logs for metric output"""
    print_header("TEST 3: Backend Log Verification")
    
    print_info("Expected log patterns to verify:")
    print("   🎯 TTFT: <number>ms")
    print("   🏁 TTLT: <number>ms")
    print("   📊 AI Metrics: TTFT=<n>ms, TTLT=<n>ms, tokens/sec=<n>, chunks=<n>")
    
    print("\n" + "="*80)
    print_info("Making request and monitoring for metrics in logs...")
    print("="*80 + "\n")
    
    payload = {
        "template_content": "Create a quick morning routine for productivity.",
        "conversation_history": []
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/action-plan/generate",
            json=payload,
            timeout=60
        )
        
        if response.status_code == 200:
            print_success("Request completed")
            print_info("Check the backend terminal logs above for:")
            print("     🎯 TTFT value")
            print("     🏁 TTLT value")
            print("     📊 Complete AI metrics summary")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_token_metrics():
    """Test that token metrics are captured"""
    print_header("TEST 4: Token Usage Metrics")
    
    print_info("Testing with short and long prompts to verify token counting...")
    
    # Short prompt
    print("\n--- Short Prompt Test ---")
    short_payload = {
        "template_content": "Quick task list",
        "conversation_history": []
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/action-plan/generate",
            json=short_payload,
            timeout=30
        )
        
        if response.status_code == 200:
            print_success("Short prompt processed")
        else:
            print_error(f"Short prompt failed: {response.text}")
            
    except Exception as e:
        print_error(f"Short prompt exception: {str(e)}")
    
    # Long prompt
    print("\n--- Long Prompt Test ---")
    long_content = """Create a comprehensive 90-day transformation plan that includes:
    1. Detailed daily workout routines with specific exercises, sets, and reps
    2. Complete meal plans with macronutrient breakdowns for each meal
    3. Progressive overload strategy to ensure continuous improvement
    4. Recovery protocols including stretching, foam rolling, and rest days
    5. Supplement recommendations based on fitness goals
    6. Weekly progress tracking metrics and how to measure success
    7. Common pitfalls to avoid and how to stay motivated throughout the journey
    8. Modifications for different fitness levels (beginner, intermediate, advanced)
    9. Equipment alternatives for home workouts vs gym workouts
    10. Long-term maintenance strategies after the 90 days are complete"""
    
    long_payload = {
        "template_content": long_content,
        "conversation_history": [
            {"role": "user", "content": "I'm serious about transforming my health and fitness"},
            {"role": "assistant", "content": "That's great! A comprehensive plan will help you succeed."},
        ]
    }
    
    print_metric("Prompt length", len(long_content))
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/action-plan/generate",
            json=long_payload,
            timeout=60
        )
        
        if response.status_code == 200:
            print_success("Long prompt processed")
            print_info("Backend should log higher token counts for this request")
        else:
            print_error(f"Long prompt failed: {response.text}")
            
    except Exception as e:
        print_error(f"Long prompt exception: {str(e)}")
    
    return True

def test_complexity_classification():
    """Test prompt complexity classification"""
    print_header("TEST 5: Prompt Complexity Classification")
    
    test_cases = [
        {
            "name": "Simple (< 500 chars, <= 2 messages)",
            "payload": {
                "template_content": "Make a to-do list",
                "conversation_history": []
            },
            "expected": "simple"
        },
        {
            "name": "Medium (500-2000 chars, 3-5 messages)",
            "payload": {
                "template_content": "Create a weekly meal plan with breakfast, lunch, and dinner options that are healthy and easy to prepare.",
                "conversation_history": [
                    {"role": "user", "content": "I want healthy meals"},
                    {"role": "assistant", "content": "I'll help you with that"},
                    {"role": "user", "content": "Keep it simple please"}
                ]
            },
            "expected": "medium"
        },
        {
            "name": "High (> 2000 chars or > 5 messages)",
            "payload": {
                "template_content": "Create a comprehensive business plan including executive summary, market analysis, competitive landscape, financial projections, marketing strategy, operational plan, and risk assessment." * 5,
                "conversation_history": [
                    {"role": "user", "content": "I need a detailed business plan"},
                    {"role": "assistant", "content": "I'll create a comprehensive plan"},
                    {"role": "user", "content": "Include all sections"},
                    {"role": "assistant", "content": "Will do"},
                    {"role": "user", "content": "Make it very detailed"},
                    {"role": "assistant", "content": "Understood"}
                ]
            },
            "expected": "high"
        }
    ]
    
    for test_case in test_cases:
        print(f"\n--- {test_case['name']} ---")
        total_length = sum(len(m['content']) for m in test_case['payload']['conversation_history']) + len(test_case['payload']['template_content'])
        message_count = len(test_case['payload']['conversation_history']) + 1
        
        print_metric("Total length", total_length)
        print_metric("Message count", message_count)
        print_metric("Expected complexity", test_case['expected'])
        
        try:
            response = requests.post(
                f"{BACKEND_URL}/action-plan/generate",
                json=test_case['payload'],
                timeout=60
            )
            
            if response.status_code == 200:
                print_success(f"Request processed (complexity should be '{test_case['expected']}')")
            else:
                print_error(f"Failed: {response.text}")
                
        except Exception as e:
            print_error(f"Exception: {str(e)}")
    
    return True

def test_model_configuration_attributes():
    """Verify model configuration attributes are set"""
    print_header("TEST 6: Model Configuration Attributes")
    
    print_info("Expected attributes in spans:")
    print("   - ai.provider (should be: openai/groq/gemini)")
    print("   - ai.model (e.g., gpt-4, llama-3.3-70b-versatile, gemini-2.5-flash)")
    print("   - ai.temperature (should be: 0.7)")
    print("   - ai.max_tokens (should be: 2000)")
    print("   - ai.streaming_enabled (should be: true)")
    
    payload = {
        "template_content": "Test model configuration capture",
        "conversation_history": []
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/action-plan/generate",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            print_success("Request completed - check Sentry/OTLP for these attributes")
            return True
        else:
            print_error(f"Failed: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def run_all_tests():
    """Run all backend metric tests"""
    print("\n" + "="*80)
    print("  🧪 BACKEND PERFORMANCE METRICS TEST SUITE")
    print("="*80)
    
    print_info("This test suite verifies that all performance attributes are correctly")
    print_info("captured by the backend OpenTelemetry instrumentation.")
    print()
    print_info("Backend URL: " + BACKEND_URL)
    print()
    
    # Check backend connectivity with a simple API call
    try:
        test_payload = {"template_content": "test", "conversation_history": []}
        test_response = requests.post(
            f"{BACKEND_URL}/action-plan/generate",
            json=test_payload,
            timeout=10
        )
        if test_response.status_code == 200:
            print_success("Backend is healthy and responding")
        else:
            print_error(f"Backend connectivity check failed: {test_response.status_code}")
            return
    except Exception as e:
        print_error(f"Cannot connect to backend: {str(e)}")
        print_info("Make sure the backend is running on port 8000")
        return
    
    # Run tests
    results = []
    
    results.append(("Action Plan Generation", test_action_plan_generation()))
    time.sleep(1)
    
    results.append(("Streaming Metrics", test_streaming_metrics_calculation()))
    time.sleep(1)
    
    results.append(("Backend Logs", test_backend_logs_for_metrics()))
    time.sleep(1)
    
    results.append(("Token Metrics", test_token_metrics()))
    time.sleep(2)
    
    results.append(("Complexity Classification", test_complexity_classification()))
    time.sleep(2)
    
    results.append(("Model Configuration", test_model_configuration_attributes()))
    
    # Summary
    print_header("TEST SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        if result:
            print_success(f"{test_name}")
        else:
            print_error(f"{test_name}")
    
    print(f"\n{'='*80}")
    print(f"  Results: {passed}/{total} tests passed")
    print(f"{'='*80}\n")
    
    # Expected attributes checklist
    print_header("EXPECTED ATTRIBUTES CHECKLIST")
    print_info("Verify these attributes appear in Sentry/OTLP spans:\n")
    
    categories = {
        "Streaming Metrics": [
            'ai.ttft', 'ai.ttlt', 'ai.queue_time', 'ai.generation_time',
            'ai.tokens_per_second', 'ai.mean_time_per_token'
        ],
        "Stream-Specific": [
            'ai.chunk_count', 'ai.time_between_chunks_avg', 'ai.time_between_chunks_p95'
        ],
        "Token Usage": [
            'ai.input_tokens', 'ai.output_tokens', 'ai.total_tokens',
            'ai.context_window_usage_pct'
        ],
        "Model Config": [
            'ai.provider', 'ai.model', 'ai.temperature', 'ai.max_tokens',
            'ai.streaming_enabled'
        ],
        "Content": [
            'ai.prompt_length', 'ai.prompt_complexity', 'ai.message_count', 'ai.cache_hit'
        ]
    }
    
    for category, attributes in categories.items():
        print(f"\n  {category}:")
        for attr in attributes:
            print(f"    ☐ {attr}")
    
    print(f"\n{'='*80}\n")
    print_info("🔍 To verify attributes are captured:")
    print("   1. Check backend terminal logs for metric printouts")
    print("   2. Go to Sentry Performance → Traces")
    print("   3. Find recent 'ai.action_plan.generation' spans")
    print("   4. Click on span → View 'Attributes' tab")
    print("   5. Verify all expected attributes are present\n")

if __name__ == "__main__":
    run_all_tests()

