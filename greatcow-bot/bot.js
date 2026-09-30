const TelegramBot = require("node-telegram-bot-api");
const { insertFeedback, listRecentFeedback } = require("./db");

const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!TOKEN) {
  throw new Error("BOT_TOKEN не задан в .env");
}

const bot = new TelegramBot(TOKEN, { polling: true });

// пользователи, ожидающие ввода фидбека следующим сообщением
const awaitingFeedback = new Set();

bot.onText(/^\/start/, (msg) => {
  const chatId = msg.chat.id;
  const text = [
    "🐮🌭 *GreatCow* — уличная еда без лишних приложений.",
    "",
    "Открывай меню, собирай заказ и оформляй самовывоз или доставку прямо в Telegram.",
  ].join("\n");

  bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌭 Открыть меню", web_app: { url: APP_URL } }],
      ],
    },
  });
});

bot.onText(/^\/support/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `По вопросам заказа пишите: @${ADMIN_USERNAME}\nЧтобы оставить отзыв о боте — команда /feedback`
  );
});

bot.onText(/^\/feedback/, (msg) => {
  const chatId = msg.chat.id;
  awaitingFeedback.add(chatId);
  bot.sendMessage(chatId, "Напишите ваш отзыв или предложение одним сообщением — я передам его команде GreatCow 🐮");
});

bot.onText(/^\/feedbacklist/, (msg) => {
  const chatId = msg.chat.id;
  if (String(msg.from.username || "") !== ADMIN_USERNAME) {
    return bot.sendMessage(chatId, "Команда доступна только администратору.");
  }
  const rows = listRecentFeedback(20);
  if (rows.length === 0) {
    return bot.sendMessage(chatId, "Отзывов пока нет.");
  }
  const text = rows
    .map(
      (r) =>
        `#${r.id} · ${r.created_at}\nот ${r.tg_username ? "@" + r.tg_username : r.tg_user_id}\n${r.message}`
    )
    .join("\n\n");
  bot.sendMessage(chatId, text);
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text || msg.text.startsWith("/")) return;
  if (!awaitingFeedback.has(chatId)) return;

  awaitingFeedback.delete(chatId);
  insertFeedback({
    tgUserId: msg.from.id,
    tgUsername: msg.from.username,
    message: msg.text,
  });
  bot.sendMessage(chatId, "Спасибо! Отзыв передан 🙌");

  if (ADMIN_CHAT_ID) {
    bot.sendMessage(
      ADMIN_CHAT_ID,
      `📝 Новый отзыв от ${msg.from.username ? "@" + msg.from.username : msg.from.id}:\n${msg.text}`
    );
  }
});

function formatOrderForAdmin(orderId, order) {
  const lines = order.items
    .map((it) => `• ${it.name} × ${it.qty} — ${it.price * it.qty} ₽`)
    .join("\n");
  const fulfillmentText =
    order.fulfillment === "delivery"
      ? `Доставка: ${order.address}`
      : "Самовывоз";

  return [
    `🆕 Заказ #${orderId} — GreatCow`,
    `Клиент: ${order.customerName}, ${order.phone}`,
    `${fulfillmentText}`,
    order.comment ? `Комментарий: ${order.comment}` : null,
    "",
    lines,
    "",
    `Итого: ${order.total} ₽`,
  ]
    .filter(Boolean)
    .join("\n");
}

function notifyNewOrder(orderId, order) {
  const text = formatOrderForAdmin(orderId, order);
  if (ADMIN_CHAT_ID) {
    bot.sendMessage(ADMIN_CHAT_ID, text).catch((err) => {
      console.error("Не удалось уведомить админа о заказе:", err.message);
    });
  }
  if (order.tgUserId) {
    bot
      .sendMessage(
        order.tgUserId,
        `Заказ #${orderId} принят! Мы свяжемся с вами для подтверждения.\n\nИтого: ${order.total} ₽`
      )
      .catch(() => {
        // пользователь мог не начать диалог с ботом — не критично
      });
  }
}

module.exports = { bot, notifyNewOrder };
