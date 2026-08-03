@echo off
setlocal enabledelayedexpansion
cd /d C:\Users\vergio\Dev\argus\agent

REM Check for .env file first
if exist .env (
  for /f "tokens=2 delims==" %%a in ('findstr "TELEGRAM_BOT_TOKEN" .env 2^>nul') do set TELEGRAM_BOT_TOKEN=%%a
)

REM If still not set, ask user
if "%TELEGRAM_BOT_TOKEN%"=="" (
  echo.
  echo   No TELEGRAM_BOT_TOKEN found.
  echo   Get your token from @BotFather on Telegram.
  echo.
  set /p TOKEN="Paste your bot token: "
  set TELEGRAM_BOT_TOKEN=!TOKEN!
  echo TELEGRAM_BOT_TOKEN=!TOKEN!> .env
  echo   Token saved to .env for future runs.
  echo.
)

set DEMO_MODE=true
set PORT=4500
echo Starting Argus Telegram bot...
echo Try /start at @Argusarc_bot
npx tsx src\web-index.ts
pause
