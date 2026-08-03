@echo off
cd /d C:\Users\vergio\Dev\argus\agent
REM Set your Telegram bot token from @BotFather as an env var before running:
REM   set TELEGRAM_BOT_TOKEN=your_token_here
REM Or create a .env file in this directory with: TELEGRAM_BOT_TOKEN=your_token_here
if "%TELEGRAM_BOT_TOKEN%"=="" (
  echo ERROR: TELEGRAM_BOT_TOKEN environment variable not set.
  echo Get your token from @BotFather on Telegram, then run:
  echo   set TELEGRAM_BOT_TOKEN=your_token_here
  echo   start-bot.cmd
  pause
  exit /b 1
)
set DEMO_MODE=true
set PORT=4500
echo Starting Argus Telegram bot...
echo Try /start at @Argusarc_bot
npx tsx src\web-index.ts
pause
