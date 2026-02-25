@echo off
cd /d "%~dp0"
echo Activating virtual environment...
call venv\Scripts\activate.bat
echo Starting backend server...
python -m uvicorn main:app --reload --port 8001
pause
