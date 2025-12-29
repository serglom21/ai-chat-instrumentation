# 📊 AI Action Plan Flow - Complete Instrumentation Guide

> **Purpose**: This guide shows how to instrument a React Native app with Sentry to track user flows, performance metrics, and error scenarios. Use this as a reference to implement similar instrumentation in your own application.

---

## 📱 **Application Context**

This is a **React Native AI assistant app** where users:
1. Select a template (e.g., "Health & Fitness Plan")
2. AI generates an action plan
3. User reviews and commits or requests changes
4. Flow can be abandoned, completed, or fail

**Key Files**:
- 🎣 **Hook**: [`src/hooks/useActionPlanFlowTracking.ts`](src/hooks/useActionPlanFlowTracking.ts) - Flow tracking logic
- 📱 **Screen**: [`src/screens/ChatScreen.tsx`](src/screens/ChatScreen.tsx) - UI integration
- 🧪 **Tests**: [`test_flow_dropout_scenarios.js`](test_flow_dropout_scenarios.js) - Data generation
- 📊 **Dashboard**: [`SENTRY_DASHBOARD_COMPLETE.json`](SENTRY_DASHBOARD_COMPLETE.json) - Dashboard config

---

## 🎯 **Dashboard Overview**

The dashboard tracks the complete user journey through a multi-step flow:

```
Template Selected (60) 
    ↓
API Request Started (57)    [3 dropped off]
    ↓
API Response Received (35)  [22 backend timeouts/errors]
    ↓
Action Plan Rendered (27)   [8 parsing/rendering errors]
    ↓
Action Plan Committed (23)  [4 abandoned after viewing]
    ↓
Card Displayed (23)
```

---

## 📊 **Widget Breakdown**

### **Section 1: Flow Step Counters**

These widgets track progression through each step of the flow funnel.

---

#### **Widget 1: Flow Step - Template Selected Count**

**What it tracks**: Number of users who started the flow by selecting a template

**Sentry Query**:
```
Widget Type: Big Number
Data Source: Spans
Query:
  aggregates: ["count()"]
  conditions: "span.op:flow.step step.name:template_selected"
  fields: ["count()"]
```

**Instrumentation Code**:
- **Location**: [`src/hooks/useActionPlanFlowTracking.ts` (lines 166-203)](src/hooks/useActionPlanFlowTracking.ts#L166-L203)
- **Integration**: [`src/screens/ChatScreen.tsx` (line 141)](src/screens/ChatScreen.tsx#L141)

**Code Example**:
```typescript
// In useActionPlanFlowTracking.ts
const recordStep = useCallback((step: FlowStep, customAttributes?: Record<string, any>) => {
  Sentry.startSpan(
    {
      name: `flow.step.${stepInfo.name}`,
      op: 'flow.step',
      attributes: {
        'step.name': stepInfo.name,
        'flow.id': flowIdRef.current,
        'flow.type': 'action_plan_creation',
        ...customAttributes,
      },
    },
    (span) => {
      // Span is sent immediately after this callback
    }
  );
}, []);

// In ChatScreen.tsx - when user selects template
const handleTemplateSelect = (template: Template) => {
  flowTracking.startFlow(template);
  flowTracking.recordStep('TEMPLATE_SELECTED', {
    'template.id': template.id,
    'template.name': template.name,
  });
};
```

**How to Replicate**:
1. Create a span with `op: 'flow.step'`
2. Add attribute `step.name: 'template_selected'`
3. Send span immediately (Sentry SDK handles this)
4. Query: Count all spans with this step name

---

#### **Widget 2: Flow Step - API Request Started**

**What it tracks**: Users who initiated an API call to the backend

**Sentry Query**:
```
Widget Type: Big Number
Data Source: Spans
Query:
  aggregates: ["count()"]
  conditions: "span.op:flow.step step.name:api_request_started"
  fields: ["count()"]
```

**Instrumentation Code**:
- **Location**: [`src/screens/ChatScreen.tsx` (line 169)](src/screens/ChatScreen.tsx#L169)

**Code Example**:
```typescript
// Before making API call
flowTracking.recordStep('API_REQUEST_STARTED', {
  'api.endpoint': '/action-plan/generate',
  'api.method': 'POST',
});

// Make API call
const response = await chatAPI.generateActionPlan({ ... });
```

**Dropout Insight**: 
- **Template Selected (60)** → **API Request Started (57)** = **3 users (5%) dropped** before API call
- Possible reasons: Changed mind, closed app, network check failed

---

#### **Widget 3: Flow Step - API Response Received**

**What it tracks**: Users who successfully received a response from backend

**Sentry Query**:
```
Widget Type: Big Number
Data Source: Spans
Query:
  aggregates: ["count()"]
  conditions: "span.op:flow.step step.name:api_response_received"
  fields: ["count()"]
```

**Instrumentation Code**:
- **Location**: [`src/screens/ChatScreen.tsx` (line 202)](src/screens/ChatScreen.tsx#L202)

**Code Example**:
```typescript
try {
  const response = await chatAPI.generateActionPlan({ ... });
  
  // ✅ Response received
  flowTracking.recordStep('API_RESPONSE_RECEIVED', {
    'response.status_code': 200,
    'response.has_action_plan': !!response.action_plan,
    'api.duration_ms': apiDuration,
  });
  
} catch (error) {
  // ❌ Backend timeout or network error
  flowTracking.failFlow(error, 'api_timeout', {
    'error.backend_responded': false
  });
}
```

**Dropout Insight**: 
- **API Request Started (57)** → **API Response Received (35)** = **22 users (39%) never got response**
- This is captured in the "Backend Timeout / No Response" widget

---

#### **Widget 4: Flow Step - Action Plan Rendered**

**What it tracks**: Users who successfully saw the action plan displayed

**Sentry Query**:
```
Widget Type: Big Number
Data Source: Spans
Query:
  aggregates: ["count()"]
  conditions: "span.op:flow.step step.name:plan_rendered"
  fields: ["count()"]
```

**Instrumentation Code**:
- **Location**: [`src/screens/ChatScreen.tsx` (lines 240-254)](src/screens/ChatScreen.tsx#L240-L254)

**Code Example**:
```typescript
try {
  // Parse response and create action plan
  const newActionPlan = parseActionPlan(response);
  
  // ✅ Successfully rendered
  const renderDuration = Date.now() - renderStartTime;
  flowTracking.captureRenderTime('action_plan_card', renderDuration);
  flowTracking.recordStep('PLAN_RENDERED', {
    'plan_id': newActionPlan.id,
    'plan_version': 1,
    'ui.displayed': true,  // Key attribute for tracking display success
  });
  
} catch (parseError) {
  // ❌ Backend returned 200 but parsing/rendering failed
  flowTracking.failFlow(parseError, 'frontend_display_error', {
    'error.backend_responded': true,
    'error.backend_status_code': 200,
    'error.frontend_failed': true,
    'ui.displayed': false,  // Key attribute for tracking display failure
  });
}
```

**Dropout Insight**: 
- **API Response Received (35)** → **Action Plan Rendered (27)** = **8 users (23%) received response but couldn't see it**
- This is captured in the "Backend OK but UI Failed" widget

---

#### **Widget 5: Flow Step - Action Plan Committed**

**What it tracks**: Users who committed to the action plan (completed the flow)

**Sentry Query**:
```
Widget Type: Big Number
Data Source: Spans
Query:
  aggregates: ["count()"]
  conditions: "span.op:flow.step step.name:plan_committed"
  fields: ["count()"]
```

**Instrumentation Code**:
- **Location**: [`src/screens/ChatScreen.tsx` (line 457)](src/screens/ChatScreen.tsx#L457)

**Code Example**:
```typescript
const handleCommitActionPlan = () => {
  // User decided to commit
  flowTracking.recordStep('PLAN_COMMITTED', {
    'plan_id': currentActionPlan.id,
    'iterations_taken': iterationCount,
    'final_decision': 'commit',
  });
  
  // Complete the flow
  flowTracking.completeFlow();
};
```

**Dropout Insight**: 
- **Action Plan Rendered (27)** → **Action Plan Committed (23)** = **4 users (15%) viewed but didn't commit**
- These may have requested iterations or abandoned

---

#### **Widget 6: Flow Step - Card Displayed**

**What it tracks**: Users who saw the committed action plan card

**Sentry Query**:
```
Widget Type: Big Number
Data Source: Spans
Query:
  aggregates: ["count()"]
  conditions: "span.op:flow.step step.name:card_displayed"
  fields: ["count()"]
```

**Instrumentation Code**:
- **Location**: [`src/screens/ChatScreen.tsx` (line 478)](src/screens/ChatScreen.tsx#L478)

**Code Example**:
```typescript
// After commit, show the card
flowTracking.recordStep('CARD_DISPLAYED', {
  'card_type': 'action_plan',
  'display_location': 'chat_history',
});
```

---

### **Section 2: Flow Outcomes & Completion**

---

#### **Widget 7: Flow Completion Rate**

**What it tracks**: Distribution of completed vs abandoned vs failed flows

**Sentry Query**:
```
Widget Type: Stacked Bar Chart
Data Source: Spans
Query:
  aggregates: ["count()"]
  columns: ["flow.status"]
  conditions: "span.op:user_flow.action_plan"
  orderby: "-count()"
  fields: ["flow.status", "count()"]
```

**Instrumentation Code**:
- **Completed**: [`src/hooks/useActionPlanFlowTracking.ts` (lines 380-411)](src/hooks/useActionPlanFlowTracking.ts#L380-L411)
- **Abandoned**: [`src/hooks/useActionPlanFlowTracking.ts` (lines 416-437)](src/hooks/useActionPlanFlowTracking.ts#L416-L437)
- **Failed**: [`src/hooks/useActionPlanFlowTracking.ts` (lines 442-488)](src/hooks/useActionPlanFlowTracking.ts#L442-L488)

**Code Example**:
```typescript
// 1. Start flow - creates parent span
const startFlow = useCallback((template: Template) => {
  const flowSpan = Sentry.startInactiveSpan({
    name: 'action_plan_creation_flow',
    op: 'user_flow.action_plan',
    attributes: {
      'flow.type': 'action_plan_creation',
      'flow.id': flowId,
      'flow.status': 'in_progress',
      'template.id': template.id,
      'template.name': template.name,
    },
  });
  transactionRef.current = flowSpan;
}, []);

// 2. Complete flow
const completeFlow = useCallback(() => {
  if (transactionRef.current) {
    transactionRef.current.setAttribute('flow.status', 'completed');
    transactionRef.current.setAttribute('flow.success', 1);
    transactionRef.current.end();  // Ends span with accurate duration
  }
}, []);

// 3. Abandon flow
const abandonFlow = useCallback((reason: string) => {
  if (transactionRef.current) {
    transactionRef.current.setAttribute('flow.status', 'abandoned');
    transactionRef.current.setAttribute('flow.dropout_step', currentStep);
    transactionRef.current.setAttribute('flow.dropout_reason', reason);
    transactionRef.current.setAttribute('flow.success', 0);
    transactionRef.current.end();  // Accurate timing to abandonment
  }
}, []);

// 4. Fail flow
const failFlow = useCallback((error: Error, step: string, attrs?: Record<string, any>) => {
  if (transactionRef.current) {
    transactionRef.current.setAttribute('flow.status', 'failed');
    transactionRef.current.setAttribute('flow.dropout_step', step);
    transactionRef.current.setAttribute('flow.error_message', error.message);
    transactionRef.current.setAttribute('flow.success', 0);
    
    // Add error-specific attributes
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        transactionRef.current.setAttribute(key, value);
      });
    }
    
    transactionRef.current.end();
  }
}, []);
```

**Navigation Cleanup** (ensures accurate timing):
```typescript
// In ChatScreen.tsx (lines 74-84)
useEffect(() => {
  const unsubscribe = navigation.addListener('blur', () => {
    if (chatState.activeFlow === 'action_plan_creation' && flowTracking.isFlowActive()) {
      flowTracking.abandonFlow('user_navigated_away');
    }
  });
  
  return unsubscribe;
}, [navigation, chatState.activeFlow]);
```

**Key Pattern**: 
- Use `Sentry.startInactiveSpan()` to create a parent span
- Store span reference in a ref
- Update attributes throughout the flow
- Call `span.end()` when flow concludes (completed/abandoned/failed)
- Timing is accurate because span tracks from start to end

---

#### **Widget 8: Dropout Analysis**

**What it tracks**: Where in the flow users are dropping off

**Sentry Query**:
```
Widget Type: Table
Data Source: Spans
Query:
  aggregates: ["count()"]
  columns: ["flow.dropout_step"]
  conditions: "span.op:user_flow.action_plan flow.status:abandoned"
  orderby: "-count()"
  fields: ["flow.dropout_step", "count()"]
```

**Instrumentation Code**:
- **Location**: [`src/hooks/useActionPlanFlowTracking.ts` (lines 416-437)](src/hooks/useActionPlanFlowTracking.ts#L416-L437)

**Code Example**:
```typescript
// Track current step throughout flow
const recordStep = useCallback((step: FlowStep, customAttributes) => {
  currentStepRef.current = step;  // Track where user is
  
  Sentry.startSpan({
    name: `flow.step.${step}`,
    op: 'flow.step',
    attributes: {
      'step.name': step,
      'flow.id': flowIdRef.current,
      ...customAttributes,
    },
  }, () => {});
}, []);

// When abandoning, capture the dropout step
const abandonFlow = useCallback((reason: string) => {
  if (transactionRef.current) {
    transactionRef.current.setAttribute('flow.dropout_step', currentStepRef.current);  // ← Key
    transactionRef.current.setAttribute('flow.dropout_reason', reason);
    transactionRef.current.end();
  }
}, []);
```

**Insights from Screenshot**:
- **api_request_started (17)**: Abandoned while waiting for API
- **plan_parsed (8)**: Abandoned during parsing
- **api_response_received (5)**: Abandoned after response
- **plan_rendered (4)**: Abandoned after viewing plan

---

### **Section 3: Performance Metrics**

---

#### **Widget 9: Action Plan Flow Duration**

**What it tracks**: P50, P75, and P95 duration of complete flows over time

**Sentry Query**:
```
Widget Type: Line Chart
Data Source: Spans
Query:
  aggregates: ["p50(span.duration)", "p75(span.duration)", "p95(span.duration)"]
  conditions: "span.op:user_flow.action_plan"
  interval: "5m"
  fields: ["p50(span.duration)", "p75(span.duration)", "p95(span.duration)"]
```

**Instrumentation Code**:
- **Location**: [`src/hooks/useActionPlanFlowTracking.ts` (lines 101-145)](src/hooks/useActionPlanFlowTracking.ts#L101-L145)

**Code Example**:
```typescript
// Start tracking time
const startFlow = useCallback((template: Template) => {
  startTimeRef.current = Date.now();  // Start timestamp
  
  const flowSpan = Sentry.startInactiveSpan({
    name: 'action_plan_creation_flow',
    op: 'user_flow.action_plan',
    attributes: { ... },
  });
  
  transactionRef.current = flowSpan;
}, []);

// Complete with accurate duration
const completeFlow = useCallback(() => {
  const totalDuration = Date.now() - startTimeRef.current;
  
  if (transactionRef.current) {
    transactionRef.current.setAttribute('flow.total_duration_ms', totalDuration);
    transactionRef.current.end();  // Span duration is automatically calculated
  }
}, []);
```

**Key Pattern**:
- Sentry automatically calculates `span.duration` from start to end
- Use percentiles (P50, P75, P95) not averages for performance metrics
- Track over time to spot regressions

---

### **Section 4: Error Scenarios**

---

#### **Widget 10: Backend Timeout / No Response**

**What it tracks**: Users who sent a message but backend never responded

**Sentry Query**:
```
Widget Type: Big Number
Data Source: Spans
Query:
  aggregates: ["count()"]
  conditions: "span.op:user_flow.action_plan flow.status:failed error.backend_responded:false"
  fields: ["count()"]
```

**Instrumentation Code**:
- **Location**: [`src/screens/ChatScreen.tsx` (lines 307-357)](src/screens/ChatScreen.tsx#L307-L357)

**Code Example**:
```typescript
try {
  // Make API call
  const response = await chatAPI.generateActionPlan({ ... });
  
  // ✅ Backend responded
  flowTracking.recordStep('API_RESPONSE_RECEIVED', { ... });
  
} catch (error) {
  // ❌ Backend never responded
  const errorMessage = (error as Error).message?.toLowerCase() || '';
  const isTimeout = errorMessage.includes('timeout') || 
                    errorMessage.includes('timed out') ||
                    errorMessage.includes('network request failed');
  
  if (isTimeout) {
    // SCENARIO 1: Backend timeout
    flowTracking.failFlow(error as Error, 'api_timeout', {
      'error.type': 'timeout',
      'error.backend_responded': false,  // ← Key attribute
      'error.user_impact': 'no_response_received',
    });
    
    addMessage('ai', 'Sorry, the request timed out. Please try again.');
  }
}
```

**Key Attributes**:
- `error.backend_responded: false` - Backend never sent a response
- `error.type: 'timeout'` - Specific error type
- `error.user_impact: 'no_response_received'` - User impact description

**Why This Matters**:
- Distinguishes backend failures from frontend failures
- Helps identify infrastructure issues vs code bugs
- Shows actual user impact (stuck on loading screen)

---

#### **Widget 11: Backend OK but UI Failed**

**What it tracks**: Backend returned 200 OK but frontend couldn't display the response

**Sentry Query**:
```
Widget Type: Big Number
Data Source: Spans
Query:
  aggregates: ["count()"]
  conditions: "span.op:user_flow.action_plan error.backend_responded:true error.backend_status_code:200 ui.displayed:false"
  fields: ["count()"]
```

**Instrumentation Code**:
- **Location**: [`src/screens/ChatScreen.tsx` (lines 269-294)](src/screens/ChatScreen.tsx#L269-L294)

**Code Example**:
```typescript
try {
  const response = await chatAPI.generateActionPlan({ ... });
  
  // ✅ Backend succeeded (200 OK)
  flowTracking.recordStep('API_RESPONSE_RECEIVED', {
    'response.status_code': 200,
  });
  
  try {
    // Try to parse and display
    const newActionPlan = parseActionPlan(response.action_plan);
    setChatState({ currentActionPlan: newActionPlan });
    
    // ✅ Successfully displayed
    flowTracking.recordStep('PLAN_RENDERED', {
      'ui.displayed': true,  // ← Successfully shown to user
    });
    
  } catch (parseError) {
    // ❌ SCENARIO 2: Backend succeeded but frontend failed
    flowTracking.failFlow(parseError as Error, 'frontend_display_error', {
      'error.type': 'parsing_or_rendering',
      'error.backend_responded': true,     // ← Backend succeeded
      'error.backend_status_code': 200,    // ← Status was OK
      'error.frontend_failed': true,       // ← Frontend failed
      'error.user_impact': 'response_not_displayed',
      'response.received': true,
      'response.parsed': false,
      'ui.displayed': false,               // ← Never shown to user
    });
    
    addMessage('ai', 'I received a response but couldn\'t display it properly.');
  }
  
} catch (error) {
  // Backend error (never reached frontend parsing)
}
```

**Key Distinction**:
```typescript
// Backend Timeout:
error.backend_responded: false

// Backend OK but UI Failed:
error.backend_responded: true
error.backend_status_code: 200
ui.displayed: false
```

**Why This Matters**:
- Backend team thinks everything is fine (200 OK)
- Frontend team sees errors
- Users see nothing or error message
- Helps identify parsing bugs, schema mismatches, rendering errors

---

#### **Widget 12: Frontend Display Failures - Detailed**

**What it tracks**: Specific error messages when frontend fails to display

**Sentry Query**:
```
Widget Type: Table
Data Source: Spans
Query:
  aggregates: ["count()"]
  columns: ["flow.error_message", "template.name"]
  conditions: "span.op:user_flow.action_plan error.backend_responded:true ui.displayed:false"
  orderby: "-count()"
  fields: ["flow.error_message", "template.name", "count()"]
```

**Instrumentation Code**:
- **Location**: [`src/screens/ChatScreen.tsx` (lines 269-294)](src/screens/ChatScreen.tsx#L269-L294)

**Code Example**:
```typescript
try {
  const newActionPlan = parseActionPlan(response.action_plan);
  setChatState({ currentActionPlan: newActionPlan });
  
} catch (parseError) {
  // Capture the specific error message
  flowTracking.failFlow(parseError as Error, 'frontend_display_error', {
    'error.backend_responded': true,
    'error.backend_status_code': 200,
    'ui.displayed': false,
  });
  // flow.error_message is automatically set from parseError.message
}
```

**Insights from Screenshot**:
- "Rendering error: cannot read property of undefined" - 2 occurrences (Health & Fitness Plan)
- "Invalid action plan structure: missing id" - 1 occurrence (Financial Planning)
- "Invalid action plan structure: missing content" - 2 occurrences

**How to Debug**:
1. Click on error message in Sentry
2. View the actual trace with full context
3. See which template triggered the error
4. Fix schema validation or add fallbacks

---

### **Section 5: UX Performance Metrics**

---

#### **Widget 13: Time to First Feedback**

**What it tracks**: P50 and P95 time until user sees first feedback (loading indicator)

**Sentry Query**:
```
Widget Type: Line Chart
Data Source: Spans
Query:
  aggregates: ["p50(measurements.ux.time_to_first_feedback)", "p95(measurements.ux.time_to_first_feedback)"]
  conditions: "span.op:user_flow.action_plan"
  interval: "5m"
  fields: ["p50(measurements.ux.time_to_first_feedback)", "p95(measurements.ux.time_to_first_feedback)"]
```

**Instrumentation Code**:
- **Location**: [`src/hooks/useActionPlanFlowTracking.ts` (lines 540-585)](src/hooks/useActionPlanFlowTracking.ts#L540-L585)

**Code Example**:
```typescript
// In useActionPlanFlowTracking.ts
const captureFirstFeedback = useCallback(() => {
  const now = Date.now();
  const timeToFirstFeedback = now - uxTimingsRef.current.templateTapTime;
  
  uxTimingsRef.current.firstFeedbackTime = now;
  
  if (transactionRef.current) {
    // Store as measurement (numeric value for aggregation)
    transactionRef.current.setMeasurement(
      'ux.time_to_first_feedback',
      timeToFirstFeedback,
      'millisecond'
    );
  }
}, []);

// In ChatScreen.tsx - when showing loading indicator
const handleGenerateActionPlan = async (template: Template) => {
  flowTracking.startFlow(template);
  flowTracking.recordStep('TEMPLATE_SELECTED');
  
  // Show loading indicator
  setChatState({ isGenerating: true });
  
  // ⏱️ Capture: User sees feedback
  flowTracking.captureFirstFeedback();
  
  // Continue with API call...
};
```

**Key Pattern for Measurements**:
```typescript
// Use setMeasurement for numeric values you want to aggregate
span.setMeasurement('ux.time_to_first_feedback', 250, 'millisecond');

// Then query with p50, p95, avg, etc.
p50(measurements.ux.time_to_first_feedback)
```

**Target**: < 250ms (instant feedback)

---

## 🎯 **Key Instrumentation Patterns**

### **Pattern 1: Parent-Child Span Hierarchy**

```typescript
// 1. Create parent span (tracks entire flow)
const flowSpan = Sentry.startInactiveSpan({
  name: 'action_plan_creation_flow',
  op: 'user_flow.action_plan',
  attributes: { 'flow.id': flowId }
});

// 2. Create child spans within parent context
Sentry.withActiveSpan(flowSpan, () => {
  Sentry.startSpan({
    name: 'flow.step.template_selected',
    op: 'flow.step',
    attributes: { 'step.name': 'template_selected' }
  }, () => {});
  
  Sentry.startSpan({
    name: 'flow.step.api_request_started',
    op: 'flow.step',
    attributes: { 'step.name': 'api_request_started' }
  }, () => {});
});

// 3. End parent span when flow completes
flowSpan.end();
```

**Benefits**:
- All child spans linked to parent
- Can view entire flow in trace waterfall
- Parent span duration = total flow time

---

### **Pattern 2: Error Attribution**

```typescript
// Different error scenarios need different attributes

// Scenario 1: Backend timeout
flowTracking.failFlow(error, 'api_timeout', {
  'error.backend_responded': false,
  'error.type': 'timeout',
});

// Scenario 2: Backend success but frontend failure
flowTracking.failFlow(error, 'frontend_display_error', {
  'error.backend_responded': true,
  'error.backend_status_code': 200,
  'ui.displayed': false,
});

// Scenario 3: Generic error
flowTracking.failFlow(error, 'api_request');
```

**Benefits**:
- Distinguish infrastructure vs code issues
- Identify where in the stack the problem is
- Prioritize fixes based on user impact

---

### **Pattern 3: Flow Lifecycle Management**

```typescript
class FlowTracker {
  private transactionRef = useRef<Span | null>(null);
  private startTimeRef = useRef<number>(0);
  
  // Start: Create span, store reference
  startFlow(template: Template) {
    this.startTimeRef.current = Date.now();
    this.transactionRef.current = Sentry.startInactiveSpan({ ... });
  }
  
  // Update: Add attributes as flow progresses
  recordStep(step: string, attributes?: Record<string, any>) {
    if (this.transactionRef.current) {
      this.transactionRef.current.setAttribute('flow.current_step', step);
      // Add any custom attributes
    }
  }
  
  // End: Complete, abandon, or fail
  completeFlow() {
    if (this.transactionRef.current) {
      this.transactionRef.current.setAttribute('flow.status', 'completed');
      this.transactionRef.current.end();  // ← Accurate timing
      this.transactionRef.current = null;
    }
  }
}

// Cleanup on navigation
useEffect(() => {
  const unsubscribe = navigation.addListener('blur', () => {
    if (flowTracker.isFlowActive()) {
      flowTracker.abandonFlow('user_navigated_away');
    }
  });
  return unsubscribe;
}, []);
```

**Benefits**:
- Accurate timing (span measures from start to end)
- No memory leaks (cleanup on unmount)
- Captures all scenarios (complete, abandon, fail)

---

### **Pattern 4: Measurements for Numeric Aggregation**

```typescript
// ❌ Don't use attributes for numeric values you want to aggregate
span.setAttribute('ux.time_to_feedback', 250);  // Can't easily get P95

// ✅ Use measurements for numeric values
span.setMeasurement('ux.time_to_first_feedback', 250, 'millisecond');

// Then query with aggregations:
// - p50(measurements.ux.time_to_first_feedback)
// - p95(measurements.ux.time_to_first_feedback)
// - avg(measurements.ux.time_to_first_feedback)
```

---

## 🧪 **Testing & Data Generation**

### **Generate Test Data**

```bash
# Generate distributed traces
node generate_dashboard_data.js

# Generate dropout scenarios
node test_flow_dropout_scenarios.js

# Generate user waiting spans
node test_user_waiting_spans.js
```

**Test Scripts**:
- [`generate_dashboard_data.js`](generate_dashboard_data.js) - 25 distributed traces with various outcomes
- [`test_flow_dropout_scenarios.js`](test_flow_dropout_scenarios.js) - 35 traces testing timeout, display failure, and abandonment
- [`test_user_waiting_spans.js`](test_user_waiting_spans.js) - 13 traces with user decision time tracking

---

## 📋 **Replication Checklist**

### **Step 1: Set Up Sentry SDK**

```typescript
// Initialize Sentry
Sentry.init({
  dsn: 'YOUR_DSN',
  tracesSampleRate: 1.0,  // 100% for testing, lower in production
  environment: 'production',
});
```

### **Step 2: Create Flow Tracking Hook**

Copy and adapt [`useActionPlanFlowTracking.ts`](src/hooks/useActionPlanFlowTracking.ts):

1. Define your flow steps
2. Create parent span for entire flow
3. Record child spans for each step
4. Handle complete/abandon/fail scenarios
5. Add cleanup on unmount

### **Step 3: Integrate in UI Component**

In your main screen (e.g., [`ChatScreen.tsx`](src/screens/ChatScreen.tsx)):

1. Import flow tracking hook
2. Call `startFlow()` when user begins
3. Call `recordStep()` at each milestone
4. Call `captureFirstFeedback()`, `captureFirstContent()`, etc. for UX metrics
5. Call `completeFlow()`, `abandonFlow()`, or `failFlow()` at end
6. Add navigation listener for cleanup

### **Step 4: Add Error Attribution**

When errors occur:

```typescript
try {
  const response = await api.call();
  flowTracking.recordStep('RESPONSE_RECEIVED');
  
  try {
    displayResponse(response);
    flowTracking.recordStep('DISPLAYED', { 'ui.displayed': true });
  } catch (renderError) {
    // Backend OK but frontend failed
    flowTracking.failFlow(renderError, 'display_error', {
      'error.backend_responded': true,
      'error.backend_status_code': 200,
      'ui.displayed': false,
    });
  }
} catch (apiError) {
  // Backend failed
  flowTracking.failFlow(apiError, 'api_error', {
    'error.backend_responded': false,
  });
}
```

### **Step 5: Create Sentry Dashboard**

Import [`SENTRY_DASHBOARD_COMPLETE.json`](SENTRY_DASHBOARD_COMPLETE.json) or create widgets manually using the queries in this guide.

### **Step 6: Test with Synthetic Data**

1. Adapt test scripts to your flow structure
2. Generate test data with various scenarios
3. Wait 2-3 minutes for Sentry to process
4. Verify widgets populate correctly

---

## 🎓 **Key Takeaways**

1. **Use Parent-Child Spans**: Track entire flow with parent span, steps as children
2. **Accurate Timing**: Store span reference, call `end()` when done (even if abandoned)
3. **Error Attribution**: Add attributes to distinguish backend vs frontend failures
4. **Measurements for Metrics**: Use `setMeasurement()` for numeric values (P50, P95, etc.)
5. **Cleanup on Unmount**: Ensure spans end accurately even if user navigates away
6. **Test Scenarios**: Generate data for success, timeout, display failure, and abandonment
7. **Use Percentiles**: P50, P95, P99 for performance; not averages
8. **Link to Code**: Each widget tracks specific attributes in your code

---

## 🔗 **Quick Links**

- **Main Hook**: [`src/hooks/useActionPlanFlowTracking.ts`](src/hooks/useActionPlanFlowTracking.ts)
- **UI Integration**: [`src/screens/ChatScreen.tsx`](src/screens/ChatScreen.tsx)
- **Dashboard Config**: [`SENTRY_DASHBOARD_COMPLETE.json`](SENTRY_DASHBOARD_COMPLETE.json)
- **Test Scripts**: [`test_flow_dropout_scenarios.js`](test_flow_dropout_scenarios.js)
- **Architecture Docs**: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## 💡 **Need Help?**

1. Check commit `39583c84997f6bdc09ad129e3107d278d51b46ab` for the complete instrumentation changes
2. Review test scripts to see all scenarios in action
3. Import the dashboard JSON to see queries in Sentry UI
4. Look at trace waterfall in Sentry to understand span hierarchy

---

**Happy instrumenting! 🎉**

