import 'dotenv/config';
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { validateInitData } from './auth.js';
import {
  listSubs, countSubs, getSub, insertSub, updateSub, removeSub,
  allSubs, setNextPayment, insertFeedback, markFeedbackDelivered, listFeedback,
} from './db.js';

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;
const FREE_LIMIT = 10;
// Контакт для техподдержки и получатель отзывов. Пока не заданы — бот сам
// поймает их из первого же сообщения и подскажет, что дописать в .env.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : null;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не задан в .env — возьми токен у @BotFather');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Личность пользователя берём только из подписанного initData, а не из тела запроса.
function auth(req, res, next) {
  const initData = req.get('X-Telegram-Init-Data');
  const user = validateInitData(initData, BOT_TOKEN);
  if (!user) return res.status(401).json({ error: 'Не удалось подтвердить вход через Telegram' });
  req.user = user;
  next();
}

function parseSub(body) {
  const name = String(body.name || '').trim();
  const price = Number(body.price);
  const periodMonths = Number(body.period_months);
  const nextPayment = String(body.next_payment || '');
  const remindDays = Number.isInteger(Number(body.remind_days)) ? Number(body.remind_days) : 2;

  if (!name) return { error: 'Укажите название подписки' };
  if (!Number.isFinite(price) || price < 0) return { error: 'Укажите стоимость числом' };
  if (!Number.isInteger(periodMonths) || periodMonths < 1 || periodMonths > 60) {
    return { error: 'Период — целое число от 1 до 60 месяцев' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextPayment)) return { error: 'Укажите дату следующего списания' };
  if (remindDays < 0 || remindDays > 30) return { error: 'Напоминание — от 0 до 30 дней' };

  return {
    value: {
      name,
      price,
      period_months: periodMonths,
      next_payment: nextPayment,
      payment_method: String(body.payment_method || '').trim().slice(0, 60),
      category: String(body.category || 'Прочее').trim().slice(0, 40) || 'Прочее',
      is_trial: !!body.is_trial,
      remind_days: remindDays,
    },
  };
}

app.get('/api/subscriptions', auth, (req, res) => {
  res.json({
    items: listSubs(req.user.id),
    limit: FREE_LIMIT,
    user: { first_name: req.user.first_name },
  });
});

app.post('/api/subscriptions', auth, (req, res) => {
  if (countSubs(req.user.id) >= FREE_LIMIT) {
    return res.status(403).json({ error: `На бесплатном тарифе можно вести ${FREE_LIMIT} подписок`, limitReached: true });
  }
  const parsed = parseSub(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const id = insertSub(req.user.id, parsed.value);
  res.json({ id, ...parsed.value });
});

app.put('/api/subscriptions/:id', auth, (req, res) => {
  const parsed = parseSub(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const ok = updateSub(Number(req.params.id), req.user.id, parsed.value);
  if (!ok) return res.status(404).json({ error: 'Подписка не найдена' });
  res.json({ ok: true });
});

app.delete('/api/subscriptions/:id', auth, (req, res) => {
  const sub = getSub(Number(req.params.id), req.user.id);
  if (!sub) return res.status(404).json({ error: 'Подписка не найдена' });
  removeSub(sub.id, req.user.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));

bot.setMyCommands([
  { command: 'start', description: 'Открыть трекер' },
  { command: 'support', description: 'Техподдержка' },
  { command: 'feedback', description: 'Оставить отзыв' },
]).catch((e) => console.error('Не удалось задать команды бота:', e.message));

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

bot.onText(/\/start/, (msg) => {
  if (!APP_URL) {
    bot.sendMessage(msg.chat.id, 'APP_URL не задан в .env — подними туннель и пропиши https-адрес.');
    return;
  }
  bot.sendMessage(msg.chat.id, 'Трекер подписок. Веди список сервисов и получай напоминание до списания.', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Открыть трекер', web_app: { url: APP_URL } }]],
    },
  });
});

bot.onText(/\/support/, (msg) => {
  if (ADMIN_USERNAME) {
    bot.sendMessage(msg.chat.id, 'Опишите проблему разработчику напрямую:', {
      reply_markup: { inline_keyboard: [[{ text: 'Написать в поддержку', url: `https://t.me/${ADMIN_USERNAME}` }]] },
    });
  } else {
    bot.sendMessage(msg.chat.id, 'Поддержка ещё настраивается — загляните чуть позже.');
  }
});

const awaitingFeedback = new Set();

bot.onText(/\/feedback/, (msg) => {
  awaitingFeedback.add(msg.chat.id);
  bot.sendMessage(msg.chat.id, 'Напишите отзыв одним сообщением — он сохранится и уйдёт разработчику.');
});

// Только для админа: последние накопленные отзывы одним списком.
bot.onText(/\/feedbacklist/, (msg) => {
  if (!ADMIN_CHAT_ID || msg.chat.id !== ADMIN_CHAT_ID) return;
  const items = listFeedback().slice(0, 20);
  if (items.length === 0) {
    bot.sendMessage(msg.chat.id, 'Отзывов пока нет.');
    return;
  }
  const lines = items.map((f) => {
    const from = f.username ? `@${f.username}` : f.first_name || 'без имени';
    const date = f.created_at.slice(0, 16).replace('T', ' ');
    return `<b>${escapeHtml(from)}</b> · ${date}\n${escapeHtml(f.text)}`;
  });
  bot.sendMessage(msg.chat.id, `Последние отзывы (${items.length}):\n\n${lines.join('\n\n')}`, { parse_mode: 'HTML' });
});

// Разовый лог для настройки ADMIN_CHAT_ID/ADMIN_USERNAME: пока контакт не задан
// в .env, печатаем данные первого написавшего, чтобы забрать их оттуда руками.
bot.on('message', (msg) => {
  if (!ADMIN_CHAT_ID && !ADMIN_USERNAME) {
    console.log('[contact]', JSON.stringify({
      id: msg.from.id, username: msg.from.username || null, first_name: msg.from.first_name,
    }));
  }

  if (msg.text && !msg.text.startsWith('/') && awaitingFeedback.has(msg.chat.id)) {
    awaitingFeedback.delete(msg.chat.id);
    const from = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    // Сначала кладём в базу — отзыв не потеряется, даже если доставка ниже не удастся.
    const id = insertFeedback(msg.from.id, msg.from.username, msg.from.first_name, msg.text, false);

    if (ADMIN_CHAT_ID) {
      bot.sendMessage(ADMIN_CHAT_ID, `Отзыв от ${from}:\n${msg.text}`)
        .then(() => markFeedbackDelivered(id))
        .catch(() => {});
      bot.sendMessage(msg.chat.id, 'Спасибо! Отзыв сохранён и передан разработчику.');
    } else {
      bot.sendMessage(msg.chat.id, 'Спасибо! Отзыв сохранён — получатель уведомлений ещё настраивается.');
    }
  }
});

// --- Напоминания ---

const fmtDate = (d) => d.toISOString().slice(0, 10);
const money = (n) => new Intl.NumberFormat('ru-RU').format(n);

function advance(dateStr, periodMonths) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + periodMonths);
  // 31 января + 1 месяц = 28/29 февраля, а не 3 марта.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return fmtDate(d);
}

const sentToday = new Set();

function checkReminders() {
  const today = fmtDate(new Date());
  for (const sub of allSubs()) {
    const due = new Date(sub.next_payment + 'T12:00:00Z');
    const daysLeft = Math.round((due - new Date(today + 'T12:00:00Z')) / 86400000);

    if (daysLeft === sub.remind_days) {
      const key = `${sub.id}:${sub.next_payment}`;
      if (!sentToday.has(key)) {
        sentToday.add(key);
        const when = daysLeft === 0 ? 'сегодня' : `через ${daysLeft} дн.`;
        const what = sub.is_trial ? 'Пробный период заканчивается' : 'Списание';
        bot.sendMessage(sub.user_id,
          `${what} ${when}: <b>${sub.name}</b> — ${money(sub.price)} ₽${sub.payment_method ? `\nСписание с: ${sub.payment_method}` : ''}`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }

    // Дата прошла — переносим на следующий период, чтобы список не устаревал.
    if (daysLeft < 0) setNextPayment(sub.id, advance(sub.next_payment, sub.period_months));
  }
}

setInterval(checkReminders, 60 * 60 * 1000);
setTimeout(checkReminders, 5000);
