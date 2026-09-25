@echo off
rem Starts FocusPlan on http://localhost:8766 and opens it in the browser. Close this window to stop.
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 (
  echo Python is needed to run FocusPlan locally: https://www.python.org/downloads/
  pause
  exit /b 1
)
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8766"
echo FocusPlan is running at http://localhost:8766  -  close this window to stop it.
python -m http.server 8766
