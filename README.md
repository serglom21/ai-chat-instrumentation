# AI Chat Assistant with Sentry Instrumentation

A full-stack AI chat application built with React Native (frontend) and FastAPI (backend), featuring comprehensive error tracking and performance monitoring with Sentry.

## Features

- 🤖 AI-powered chat with multiple providers (OpenAI, Groq, Google Gemini)
- 📱 Native iOS/Android support
- 🔍 Full Sentry instrumentation (frontend & backend)
- ⚡ Performance monitoring and tracing
- 📊 Langfuse LLM observability
- 🎨 Modern UI with React Native

## Tech Stack

### Frontend
- React Native (Expo)
- TypeScript
- React Navigation
- Sentry React Native SDK

### Backend
- Python 3.9+
- FastAPI
- Sentry Python SDK
- Langfuse
- Multiple AI providers (OpenAI, Groq, Gemini)

## Getting Started

### Prerequisites

- Node.js 16+
- Python 3.9+
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/serglom21/ai-chat-instrumentation.git
cd ai-chat-instrumentation
```

2. **Set up environment variables**

Frontend:
```bash
cp .env.example .env
# Edit .env and add your Sentry DSN
```

Backend:
```bash
cd backend
cp .env.example .env
# Edit .env and add your API keys and Sentry DSN
```

3. **Install dependencies**

Frontend:
```bash
npm install
```

Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Running the Application

1. **Start the backend**
```bash
cd backend
source venv/bin/activate
python run.py
```

2. **Start the frontend**

For Expo Go (quick start):
```bash
npm start
```

For native build (full Sentry features):
```bash
# iOS
LANG=en_US.UTF-8 npx expo run:ios

# Android
npx expo run:android
```

## Sentry Setup

### Frontend
1. Create a React Native project in Sentry
2. Copy the DSN to `.env` as `EXPO_PUBLIC_SENTRY_DSN`
3. For native builds: `npx expo prebuild`

### Backend
1. Create a Python project in Sentry
2. Copy the DSN to `backend/.env` as `SENTRY_DSN`

## Configuration

### AI Providers

Set in `backend/.env`:
```bash
AI_PROVIDER=groq  # Options: openai, groq, gemini
DEFAULT_MODEL=llama-3.3-70b-versatile
```

### Langfuse (Optional)

Add to `backend/.env`:
```bash
LANGFUSE_PUBLIC_KEY=your-key
LANGFUSE_SECRET_KEY=your-secret
LANGFUSE_HOST=https://us.cloud.langfuse.com
```

## Project Structure

```
.
├── App.tsx                 # Frontend entry point with Sentry
├── src/
│   ├── screens/           # React Native screens
│   ├── components/        # Reusable components
│   ├── services/          # API services
│   └── types/             # TypeScript types
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI app with Sentry
│   │   ├── routes.py     # API endpoints
│   │   ├── ai_service.py # AI provider integrations
│   │   └── config.py     # Configuration
│   └── run.py            # Server entry point
└── package.json
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
