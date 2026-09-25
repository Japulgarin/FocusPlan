@echo off
rem Starts FocusPlan on http://localhost:8766 and opens it in the browser. Close this window to stop.
cd /d "%~dp0"

rem python.org installs either "python" (when added to PATH) or the "py" launcher.
set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY where py >nul 2>&1 && set "PY=py"
if not defined PY (
  echo Python is needed to run FocusPlan on your computer.
  echo Install it from https://www.python.org/downloads/  ^(tick "Add python.exe to PATH"^),
  echo then double-click start.bat again.
  start "" https://www.python.org/downloads/
  pause
  exit /b 1
)

start "" cmd /c "timeout /t 2 >nul & start http://localhost:8766"
echo FocusPlan is running at http://localhost:8766  -  keep this window open; close it to stop.
%PY% -m http.server 8766
