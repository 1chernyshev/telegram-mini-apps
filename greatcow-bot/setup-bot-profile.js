// Выставляет описание бота и menu button через Bot API (без BotFather).
// Запуск: node setup-bot-profile.js
require("dotenv").config();

const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;

if (!TOKEN) throw new Error("BOT_TOKEN не задан в .env");
if (!APP_URL) throw new Error("APP_URL не задан в .env");

const API = `https://api.telegram.org/bot${TOKEN}`;

async function call(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method} failed: ${JSON.stringify(data)}`);
  return data.result;
}

async function main() {
  await call("setMyDescription", {
    description:
      "GreatCow 🐮🌭 — уличная еда: хот-доги, бургеры, шаурма, закуски, салаты, десерты и напитки. Закажи онлайн, просто и удобно, без лишних приложений.",
  });
  console.log("✔ setMyDescription");

  await call("setMyShortDescription", {
    short_description: "Бот ресторана GreatCow 🐮🌭. Закажи еду онлайн. Просто. Удобно.",
  });
  console.log("✔ setMyShortDescription");

  await call("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Меню", web_app: { url: APP_URL } },
  });
  console.log("✔ setChatMenuButton");

  console.log("\nГотово. Остаётся вручную через @BotFather:");
  console.log("  /setuserpic — загрузить public/logo512.png как аватар");
  console.log("  /newapp — прямая ссылка t.me/<bot>/app с баннером public/preview640.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
