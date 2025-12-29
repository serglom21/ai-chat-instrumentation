# AI Assistant Backend

FastAPI backend with Langfuse integration for AI chat functionality.

## Features

- **FastAPI**: Modern Python web framework
- **OpenAI Integration**: GPT-4 powered responses
- **Langfuse**: AI observability and monitoring
- **CORS Enabled**: Works with React Native/Expo
- **Four Flow Types**: Action plans, suggestions, chat, and editing

## API Endpoints

### Base URL: `http://localhost:8000/api/v1`

### Endpoints

#### 1. Chat Message
```
POST /chat/message
```
**Request:**
```json
{
  "message": "Hello, how are you?",
  "flow_type": "chat",
  "conversation_history": [
    {"role": "user", "content": "Hi"},
    {"role": "assistant", "content": "Hello!"}
  ]
}
```

**Response:**
```json
{
  "response": "I'm doing well, thank you!",
  "action_plan": null,
  "suggestions": ["Tell me more", "What can you help with?"]
}
```

#### 2. Generate Action Plan
```
POST /action-plan/generate
```
**Request:**
```json
{
  "template_content": "Create a fitness plan for beginners",
  "conversation_history": []
}
```

**Response:**
```json
{
  "response": "I've created a fitness plan...",
  "action_plan": {
    "id": "uuid-here",
    "title": "Fitness Plan",
    "content": "Week 1: ...",
    "status": "draft",
    "version": 1
  }
}
```

#### 3. Update Action Plan
```
POST /action-plan/update
```
**Request:**
```json
{
  "action_plan_id": "uuid-here",
  "edit_instructions": "Add more cardio exercises"
}
```

**Response:**
```json
{
  "response": "I've updated your plan...",
  "action_plan": {
    "id": "uuid-here",
    "title": "Fitness Plan",
    "content": "Week 1: Updated with cardio...",
    "status": "draft",
    "version": 2
  }
}
```

#### 4. Commit Action Plan
```
POST /action-plan/commit
```
**Request:**
```json
{
  "action_plan_id": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Action plan committed successfully",
  "action_plan": {
    "id": "uuid-here",
    "title": "Fitness Plan",
    "content": "...",
    "status": "saved",
    "version": 2
  }
}
```

#### 5. Health Check
```
GET /health
```

## Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
Create `.env` file:
```env
OPENAI_API_KEY=sk-...
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_HOST=https://cloud.langfuse.com
DEFAULT_MODEL=gpt-4-turbo-preview
HOST=0.0.0.0
PORT=8000
```

### 3. Run Server
```bash
python run.py
```

## Development

### Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI app
│   ├── routes.py         # API endpoints
│   ├── models.py         # Pydantic models
│   ├── config.py         # Configuration
│   ├── ai_service.py     # AI logic
│   └── langfuse_client.py
├── requirements.txt
└── run.py
```

### Adding New Endpoints

1. Add Pydantic models to `app/models.py`
2. Add endpoint to `app/routes.py`
3. Add business logic to `app/ai_service.py`

Example:
```python
# models.py
class MyRequest(BaseModel):
    text: str

# routes.py
@router.post("/my-endpoint")
async def my_endpoint(request: MyRequest):
    result = await ai_service.my_function(request.text)
    return {"result": result}

# ai_service.py
async def my_function(self, text: str):
    # Your logic here
    return "processed: " + text
```

## Langfuse Integration

Langfuse tracks all AI interactions:
- Request/response pairs
- Token usage
- Latency metrics
- Error tracking

View your traces at: https://cloud.langfuse.com

### Trace Example
Every AI call creates a trace with:
- Flow type (chat, action_plan, etc.)
- Input/output
- Model used
- Token count
- Execution time

## Testing

### Manual Testing
Use the Swagger UI at http://localhost:8000/docs

### cURL Examples

**Health Check:**
```bash
curl http://localhost:8000/api/v1/health
```

**Chat Message:**
```bash
curl -X POST http://localhost:8000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello!",
    "flow_type": "chat",
    "conversation_history": []
  }'
```

## Production Deployment

### Environment Variables
Set these in your production environment:
- `OPENAI_API_KEY`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- Update `CORS_ORIGINS` in `config.py` to your frontend URL

### Run with Gunicorn
```bash
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "run.py"]
```

## Troubleshooting

**OpenAI API Error**
- Check your API key is valid
- Ensure you have credits in your OpenAI account

**Langfuse Connection Error**
- Langfuse is optional - app works without it
- Check your public/secret keys
- Verify network connectivity

**CORS Error**
- Add your frontend URL to `CORS_ORIGINS` in `config.py`

## License

MIT







