#!/bin/bash

# ScottBot Local - Quick Setup Script

echo "🧠 ScottBot Local - Quick Setup"
echo "================================"
echo ""

# Check Node.js
echo "Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check npm
echo "Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm"
    exit 1
fi
echo "✅ npm $(npm --version)"

# Check Python
echo "Checking Python..."
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "❌ Python not found. Please install Python 3.8+ from https://python.org"
    exit 1
fi
PYTHON_CMD=$(command -v python3 || command -v python)
echo "✅ Python $($PYTHON_CMD --version)"

echo ""
echo "Step 1: Installing Node.js dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Node.js dependencies"
    exit 1
fi
echo "✅ Backend dependencies installed"

echo ""
echo "Step 2: Installing frontend dependencies..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
cd ..
echo "✅ Frontend dependencies installed"

echo ""
echo "Step 3: Installing Python dependencies..."
cd "DOCUMENT _TO_MD_CONVERTER V1"
$PYTHON_CMD -m pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Failed to install some Python dependencies"
    echo "   You may need to install them manually"
fi
cd ..
echo "✅ Python dependencies installed"

echo ""
echo "Step 4: Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file"
    echo "⚠️  IMPORTANT: Edit .env and add your OPENAI_API_KEY"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "Step 5: Initializing database..."
npm run db:init
if [ $? -ne 0 ]; then
    echo "❌ Failed to initialize database"
    exit 1
fi
echo "✅ Database initialized"

echo ""
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your API keys:"
echo "   - OPENAI_API_KEY (required)"
echo "   - TAVILY_API_KEY or SERPER_API_KEY (optional)"
echo ""
echo "2. Start the application:"
echo "   npm run dev"
echo ""
echo "3. Open your browser:"
echo "   http://localhost:3000"
echo ""
echo "For detailed instructions, see SETUP.md"
echo ""
