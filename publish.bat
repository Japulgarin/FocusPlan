@echo off
rem Publishes FocusPlan to GitHub: stage everything, block anything that looks like an API key, commit, push.
setlocal
cd /d "%~dp0"
echo === FocusPlan: publish to GitHub ===

git add -A
git grep --cached -l -I -E "sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}" -- . ":!publish.bat" >nul 2>&1
if %errorlevel%==0 (
  echo.
  echo STOP: these files contain something that looks like an API key. Nothing was published.
  git grep --cached -l -I -E "sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}" -- . ":!publish.bat"
  git reset -q
  pause
  exit /b 1
)

git diff --cached --quiet
if %errorlevel%==0 (
  echo Nothing new to publish.
  pause
  exit /b 0
)

git status --short
set "MSG="
set /p "MSG=Commit message (Enter = "Update FocusPlan"): "
if not defined MSG set "MSG=Update FocusPlan"

git commit -q -m "%MSG%"
if errorlevel 1 (
  echo Commit failed.
  pause
  exit /b 1
)
git push -q
if errorlevel 1 (
  echo Push failed. Check your internet connection or GitHub login.
  pause
  exit /b 1
)
echo Published: https://github.com/Japulgarin/FocusPlan
pause
