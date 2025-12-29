#!/bin/bash
# Complete setup script for both frontend and backend

echo "🚀 AI Assistant Chat - Complete Setup"
echo "====================================="
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

cd "$PROJECT_ROOT"

# Setup Backend
echo "📦 Setting up Backend..."
echo "------------------------"
cd backend
chmod +x setup.sh
./setup.sh

cd "$PROJECT_ROOT"
echo ""

# Setup Frontend
echo "📱 Setting up Frontend..."
echo "------------------------"
echo "Installing npm dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  python run.py"
echo ""
echo "Terminal 2 (Frontend):"
echo "  npm start"
echo ""







