#!/bin/bash
# Start frontend (Expo)

echo "📱 Starting AI Assistant Frontend..."

# Get project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

cd "$PROJECT_ROOT"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found!"
    echo "Run 'npm install' first"
    exit 1
fi

# Start Expo
echo "✅ Starting Expo development server..."
npm start


