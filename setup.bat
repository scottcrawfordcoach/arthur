@echo off
REM ScottBot Local - Quick Setup Script for Windows

echo 🧠 ScottBot Local - Quick Setup
echo ================================
echo.

REM Check Node.js
echo Checking Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION%

REM Check npm
echo Checking npm...
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm not found. Please install npm
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm %NPM_VERSION%

REM Check Python
echo Checking Python...
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python not found. Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo ✅ %PYTHON_VERSION%

echo.
echo Step 1: Installing Node.js dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install Node.js dependencies
    pause
    exit /b 1
)
echo ✅ Backend dependencies installed

echo.
echo Step 2: Installing frontend dependencies...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)
cd ..
echo ✅ Frontend dependencies installed

echo.
echo Step 3: Installing Python dependencies...
cd "DOCUMENT _TO_MD_CONVERTER V1"
python -m pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Warning: Failed to install some Python dependencies
    echo    You may need to install them manually
)
cd ..
echo ✅ Python dependencies installed

echo.
echo Step 4: Setting up environment...
if not exist .env (
    copy .env.example .env
    echo ✅ Created .env file
    echo ⚠️  IMPORTANT: Edit .env and add your OPENAI_API_KEY
) else (
    echo ✅ .env file already exists
)

echo.
echo Step 5: Initializing database...
call npm run db:init
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to initialize database
    pause
    exit /b 1
)
echo ✅ Database initialized

echo.
echo ================================
echo ✅ Setup Complete!
echo ================================
echo.
echo Next steps:
echo 1. Edit .env and add your API keys:
echo    - OPENAI_API_KEY (required)
echo    - TAVILY_API_KEY or SERPER_API_KEY (optional)
echo.
echo 2. Start the application:
echo    npm run dev
echo.
echo 3. Open your browser:
echo    http://localhost:3000
echo.
echo For detailed instructions, see SETUP.md
echo.
pause
