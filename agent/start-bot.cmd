@echo off
cd /d C:\Users\vergio\Dev\argus\agent
set TELEGRAM_BOT_TOKEN=REDACTED_TELEGRAM_TOKEN
set DEMO_MODE=true
set PORT=4500
echo Starting Argus Telegram bot...
echo Try /start at @Argusarc_bot
npx tsx src\web-index.ts
pause
