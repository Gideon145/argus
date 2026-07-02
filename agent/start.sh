#!/bin/sh
# Start both the Express agent server and the Telegram bot
node dist/index.js &
node bot.js &
wait
