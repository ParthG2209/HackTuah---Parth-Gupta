#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=================================================="
echo "   KAIROS Setup & Dev Server Launcher (macOS/Linux)   "
echo "=================================================="

# Check Python 3 presence
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed or not in PATH."
    exit 1
fi

# Check Node.js presence
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js."
    exit 1
fi

# Check npm presence
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install npm."
    exit 1
fi

# Check/Create local .env file in root
if [ ! -f .env ]; then
    echo "Info: .env file not found in root. Generating a template .env..."
    cat <<EOT > .env
# KAIROS Backend Environment Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
CLAUDE_API_KEY=your_claude_api_key
HF_API_KEY=your_hf_api_key

# KAIROS Frontend Configuration
VITE_API_BASE=http://localhost:8000/api/v1
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
EOT
    echo "Created template .env. Please configure actual credentials in it."
fi

# Setup Python virtual environment
echo "Checking Python virtual environment..."
if [ ! -d "venv" ]; then
    echo "Creating virtual environment 'venv'..."
    python3 -m venv venv
fi

echo "Installing backend dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# Setup Frontend Node modules
echo "Checking/Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Cleanup function to kill all launched background processes on exit (CTRL+C)
cleanup() {
    echo ""
    echo "Shutting down development servers..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

# Trap INT/TERM/EXIT to clean up processes
trap cleanup SIGINT SIGTERM EXIT

echo "Starting FastAPI Backend Server on port 8000..."
source venv/bin/activate
python3 -m uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting Vite Frontend Dev Server..."
cd frontend
npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait
