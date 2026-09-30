#!/usr/bin/env bash
# Локальный запуск: поднимает сервер и туннель localhost.run наружу,
# чтобы Telegram-клиент мог достучаться до Mini App при разработке.
#
# ВАЖНО: APP_URL в .env должен указывать на прод-домен Railway, а не на
# туннель — иначе поллинг бота конфликтует между локалкой и продом.
# Используйте этот скрипт только когда бот на Railway временно остановлен.

set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Устанавливаю зависимости..."
  npm install
fi

PORT="${PORT:-3000}"

echo "Запускаю сервер на порту $PORT..."
node server.js &
SERVER_PID=$!

cleanup() {
  echo ""
  echo "Останавливаю сервер (PID $SERVER_PID)..."
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

sleep 1

echo "Открываю туннель localhost.run -> localhost:$PORT ..."
echo "Публичный адрес появится ниже (https://XXXXXXXX.lhr.life)."
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:"$PORT" nokey@localhost.run
