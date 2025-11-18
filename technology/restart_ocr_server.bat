@echo off
echo Restarting OCR Server with Auto-Formatting...
echo.

REM Kill any existing Python processes running the OCR server
taskkill /f /im python.exe 2>nul

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start the OCR server
echo Starting OCR Server...
cd /d "c:\xampp\htdocs\AchievemateApp\AchieveMate_App\technology"
python ocr_server.py

pause
