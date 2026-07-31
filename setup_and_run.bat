@echo off
echo ==================================================
echo      KAIROS Setup ^& Dev Server Launcher (Windows)
echo ==================================================

:: Check Python presence
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH. Please install Python.
    pause
    exit /b 1
)

:: Check Node.js presence
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js.
    pause
    exit /b 1
)

:: Check/Create local .env file in root
if not exist .env (
    echo Info: .env file not found in root. Generating a template .env...
    (
    echo # KAIROS Backend Environment Configuration
    echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
    echo SUPABASE_URL=your_supabase_url
    echo SUPABASE_ANON_KEY=your_supabase_anon_key
    echo GEMINI_API_KEY=your_gemini_api_key
    echo CLAUDE_API_KEY=your_claude_api_key
    echo HF_API_KEY=your_hf_api_key
    echo.
    echo # KAIROS Frontend Configuration
    echo VITE_API_BASE=http://localhost:8000/api/v1
    echo VITE_SUPABASE_URL=your_supabase_url
    echo VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ) > .env
    echo Created template .env. Please configure actual credentials in it.
)

:: Setup Python virtual environment
echo Checking Python virtual environment...
if not exist venv (
    echo Creating virtual environment 'venv'...
    python -m venv venv
)

echo Installing backend dependencies...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend/requirements.txt

:: Setup Frontend Node modules
echo Checking/Installing frontend dependencies...
cd frontend
call npm install
cd ..

:: Start servers concurrently in new console windows
echo Starting FastAPI Backend and Vite Frontend concurrently...
start "KAIROS Backend Server" cmd /k "call venv\Scripts\activate.bat && python -m uvicorn backend.main:app --reload --port 8000"
start "KAIROS Frontend Dev Server" cmd /k "cd frontend && call npm run dev"

echo Both dev servers started successfully in new windows.
echo Close the newly opened terminal windows to stop them.
pause
