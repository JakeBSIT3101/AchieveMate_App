@echo off
echo Starting OCR Server...
echo.
echo Checking requirements...

echo 1. Checking Python packages...
pip show flask >nul 2>&1
if errorlevel 1 (
    echo   Installing Python packages...
    pip install -r requirements.txt
) else (
    echo   Python packages OK
)

echo 2. Checking Tesseract installation...
tesseract --version >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Tesseract not found!
    echo   Please install Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki
    echo   See TESSERACT_INSTALL_GUIDE.md for detailed instructions
    pause
    exit /b 1
) else (
    echo   Tesseract OK
)

echo.
echo Starting OCR Server...
python ocr_server.py
pause
