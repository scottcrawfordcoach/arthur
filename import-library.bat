@echo off
REM Quick helper to import your reference library into ARTHUR

echo 📚 ARTHUR Reference Library Import Helper
echo ==========================================
echo.

REM Check if directory argument provided
if "%~1"=="" (
    echo Usage: import-library.bat ^<path-to-books^>
    echo.
    echo Examples:
    echo   import-library.bat ".\DOCUMENT _TO_MD_CONVERTER V1\input_docs"
    echo   import-library.bat ".\my-books"
    echo   import-library.bat "C:\Users\YourName\Books"
    echo.
    exit /b 1
)

set SOURCE_DIR=%~1

REM Check if directory exists
if not exist "%SOURCE_DIR%" (
    echo ❌ Directory not found: %SOURCE_DIR%
    exit /b 1
)

echo Found files in %SOURCE_DIR%
echo.
echo Starting import...
echo.

REM Run the import script
node backend\scripts\bulk-import-library.js "%SOURCE_DIR%"
