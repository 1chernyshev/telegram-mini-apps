#!/bin/bash
# Поднимает туннель и сервер. Адрес туннеля меняется при каждом запуске,
# поэтому скрипт сам прописывает его в .env перед стартом бота.
cd "$(dirname "$0")" || exit 1

pkill -f "node server.js" 2>/dev/null
pkill -f "ssh.*lhr.life\|ssh.*localhost.run" 2>/dev/null
sleep 1

LOG=$(mktemp)
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes \
    -R 80:localhost:3000 nokey@localhost.run > "$LOG" 2>&1 &
SSH_PID=$!

echo "Поднимаю туннель..."
URL=""
for _ in $(seq 1 75); do
  URL=$(grep -oE "https://[a-z0-9-]+\.lhr\.life" "$LOG" | head -1)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Не удалось получить адрес туннеля. Лог: $LOG"
  kill $SSH_PID 2>/dev/null
  exit 1
fi

sed -i '' "s|^APP_URL=.*|APP_URL=$URL|" .env
echo "Туннель: $URL"

npm run dev
