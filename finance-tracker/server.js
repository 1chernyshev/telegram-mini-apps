import 'dotenv/config';
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { validateInitData } from './auth.js';
import {
  getSettings, updateSettings,
  listAccounts, insertAccount, updateAccount, archiveAccount,
  listCategories, insertCategory, updateCategory, archiveCategory,
  listTransactions, insertTransaction, updateTransaction, deleteTransaction,
  getSummary,
  insertFeedback, markFeedbackDelivered, listFeedback,
} from './db.js';

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;
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

// Локальная отладка вне Telegram (например, через браузерный превью) —
// включается только явным DEV_USER_ID в .env, на Railway переменная не задаётся.
const DEV_USER_ID = process.env.DEV_USER_ID ? Number(process.env.DEV_USER_ID) : null;

function auth(req, res, next) {
  const initData = req.get('X-Telegram-Init-Data');
  if (!initData && DEV_USER_ID) {
    req.user = { id: DEV_USER_ID, first_name: 'Dev' };
    return next();
  }
  const user = validateInitData(initData, BOT_TOKEN);
  if (!user) return res.status(401).json({ error: 'Не удалось подтвердить вход через Telegram' });
  req.user = user;
  next();
}

const ACCOUNT_TYPES = ['card', 'cash', 'crypto'];
const CATEGORY_KINDS = ['expense', 'income'];
const THEMES = ['system', 'light', 'dark'];
const LANGUAGES = ['ru', 'en', 'de', 'fr', 'es', 'zh', 'ar'];
const CURRENCIES = ['RUB', 'USD', 'EUR', 'GBP', 'CHF', 'CNY', 'MXN'];

// --- Настройки ---
app.get('/api/settings', auth, (req, res) => {
  res.json(getSettings(req.user.id));
});

app.put('/api/settings', auth, (req, res) => {
  const { theme, language, currency } = req.body;
  if (theme !== undefined && !THEMES.includes(theme)) return res.status(400).json({ error: 'Некорректная тема' });
  if (language !== undefined && !LANGUAGES.includes(language)) return res.status(400).json({ error: 'Некорректный язык' });
  if (currency !== undefined && !CURRENCIES.includes(currency)) return res.status(400).json({ error: 'Некорректная валюта' });
  res.json(updateSettings(req.user.id, { theme, language, currency }));
});

// --- Счета ---
app.get('/api/accounts', auth, (req, res) => {
  res.json({ items: listAccounts(req.user.id, { includeArchived: req.query.includeArchived === '1' }) });
});

app.post('/api/accounts', auth, (req, res) => {
  const { type, name, bank, icon, color } = req.body;
  if (!ACCOUNT_TYPES.includes(type)) return res.status(400).json({ error: 'Некорректный тип счёта' });
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Укажите название счёта' });
  res.status(201).json(insertAccount(req.user.id, { type, name: String(name).trim(), bank, icon, color }));
});

app.put('/api/accounts/:id', auth, (req, res) => {
  const { name, bank, icon, color } = req.body;
  const row = updateAccount(req.user.id, Number(req.params.id), { name, bank, icon, color });
  if (!row) return res.status(404).json({ error: 'Счёт не найден' });
  res.json(row);
});

app.delete('/api/accounts/:id', auth, (req, res) => {
  const ok = archiveAccount(req.user.id, Number(req.params.id), 1);
  if (!ok) return res.status(404).json({ error: 'Счёт не найден' });
  res.status(204).end();
});

app.post('/api/accounts/:id/restore', auth, (req, res) => {
  const ok = archiveAccount(req.user.id, Number(req.params.id), 0);
  if (!ok) return res.status(404).json({ error: 'Счёт не найден' });
  res.status(204).end();
});

// --- Категории ---
app.get('/api/categories', auth, (req, res) => {
  const { kind } = req.query;
  if (kind !== undefined && !CATEGORY_KINDS.includes(kind)) return res.status(400).json({ error: 'Некорректный тип категории' });
  res.json({ items: listCategories(req.user.id, { kind, includeArchived: req.query.includeArchived === '1' }) });
});

app.post('/api/categories', auth, (req, res) => {
  const { kind, name, icon, color } = req.body;
  if (!CATEGORY_KINDS.includes(kind)) return res.status(400).json({ error: 'Некорректный тип категории' });
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Укажите название категории' });
  res.status(201).json(insertCategory(req.user.id, { kind, name: String(name).trim(), icon, color }));
});

app.put('/api/categories/:id', auth, (req, res) => {
  const { name, icon, color } = req.body;
  const row = updateCategory(req.user.id, Number(req.params.id), { name, icon, color });
  if (!row) return res.status(404).json({ error: 'Категория не найдена' });
  res.json(row);
});

app.delete('/api/categories/:id', auth, (req, res) => {
  const ok = archiveCategory(req.user.id, Number(req.params.id), 1);
  if (!ok) return res.status(404).json({ error: 'Категория не найдена' });
  res.status(204).end();
});

app.post('/api/categories/:id/restore', auth, (req, res) => {
  const ok = archiveCategory(req.user.id, Number(req.params.id), 0);
  if (!ok) return res.status(404).json({ error: 'Категория не найдена' });
  res.status(204).end();
});

// --- Транзакции ---
function parseTransactionBody(body) {
  const type = body.type;
  if (!CATEGORY_KINDS.includes(type)) return { error: 'Некорректный тип операции' };
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Некорректная сумма' };
  const accountId = Number(body.accountId);
  if (!Number.isInteger(accountId)) return { error: 'Укажите счёт' };
  const categoryId = Number(body.categoryId);
  if (!Number.isInteger(categoryId)) return { error: 'Укажите категорию' };
  const date = body.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Некорректная дата' };
  const note = body.note !== undefined ? String(body.note).slice(0, 500) : '';
  return { value: { type, amount, accountId, categoryId, date, note } };
}

app.get('/api/transactions', auth, (req, res) => {
  const { from, to, type, categoryId, accountId, limit, offset } = req.query;
  if (type !== undefined && !CATEGORY_KINDS.includes(type)) return res.status(400).json({ error: 'Некорректный тип операции' });
  res.json({
    items: listTransactions(req.user.id, {
      from, to, type,
      categoryId: categoryId ? Number(categoryId) : undefined,
      accountId: accountId ? Number(accountId) : undefined,
      limit: limit ? Math.min(Number(limit), 500) : 200,
      offset: offset ? Number(offset) : 0,
    }),
  });
});

app.post('/api/transactions', auth, (req, res) => {
  const { error, value } = parseTransactionBody(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(insertTransaction(req.user.id, value));
});

// Редактирование отправляет ту же форму целиком, что и создание — проще
// проверить весь объект заново, чем городить частичную валидацию патча.
app.put('/api/transactions/:id', auth, (req, res) => {
  const { error, value } = parseTransactionBody(req.body);
  if (error) return res.status(400).json({ error });
  const row = updateTransaction(req.user.id, Number(req.params.id), value);
  if (!row) return res.status(404).json({ error: 'Операция не найдена' });
  res.json(row);
});

app.delete('/api/transactions/:id', auth, (req, res) => {
  const ok = deleteTransaction(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Операция не найдена' });
  res.status(204).end();
});

// --- Сводка (Главная / Аналитика) ---
app.get('/api/summary', auth, (req, res) => {
  const { from, to } = req.query;
  res.json(getSummary(req.user.id, { from, to }));
});

app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));

bot.setMyCommands([
  { command: 'start', description: 'Открыть Мои финансы' },
  { command: 'support', description: 'Техподдержка' },
  { command: 'feedback', description: 'Оставить отзыв' },
]).catch((e) => console.error('Не удалось задать команды бота:', e.message));

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

bot.onText(/\/start/, (msg) => {
  if (!APP_URL) {
    bot.sendMessage(msg.chat.id, 'APP_URL не задан в .env — подними туннель и пропиши https-адрес.');
    return;
  }
  bot.sendMessage(msg.chat.id, 'Учёт доходов и расходов: счета, категории, валюты — в одном месте.', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Открыть', web_app: { url: APP_URL } }]],
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
