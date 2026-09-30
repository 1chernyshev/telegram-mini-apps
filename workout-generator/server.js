import 'dotenv/config';
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import multer from 'multer';
import { validateInitData } from './auth.js';
import { generateWorkout, generateWorkoutEdit, analyzePosture } from './gigachat.js';
import {
  listExercises,
  insertWorkout, setWorkoutExercises, listWorkouts, getWorkoutFull, renameWorkout, deleteWorkout,
  insertSchedule, listSchedule, deleteSchedule,
  materializeSessions, getSessionsRange, getSession, setSessionStatus, setSessionWater,
  insertProgress, listProgress, deleteProgress,
  insertPostureCheck, listPostureChecks,
  insertFeedback, markFeedbackDelivered, listFeedback,
} from './db.js';

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : null;
// Бесплатный тариф GigaChat ограничен по токенам в месяц — простая дневная
// защита от случайного/злонамеренного перебора без БД и без банов.
const DAILY_LIMIT = Number(process.env.DAILY_GENERATE_LIMIT || 15);

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не задан в .env — возьми токен у @BotFather');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TG_FILE = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

const app = express();
app.use(express.json());
app.use(express.static('public'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function auth(req, res, next) {
  const initData = req.get('X-Telegram-Init-Data');
  const user = validateInitData(initData, BOT_TOKEN);
  if (!user) return res.status(401).json({ error: 'Не удалось подтвердить вход через Telegram' });
  req.user = user;
  next();
}

// Живёт в памяти процесса — сбрасывается при рестарте, для MVP это ок:
// цель не точный учёт, а не дать одному пользователю выжрать месячную квоту.
// Считает и генерацию, и AI-правку — обе тратят токены GigaChat.
const usage = new Map();
function checkDailyLimit(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = usage.get(userId);
  if (!entry || entry.day !== today) {
    usage.set(userId, { day: today, count: 1 });
    return true;
  }
  if (entry.count >= DAILY_LIMIT) return false;
  entry.count += 1;
  return true;
}

const INVENTORY_OPTIONS = ['без инвентаря', 'гантели', 'коврик', 'эспандер', 'турник'];
const GOAL_OPTIONS = ['сила', 'похудение', 'тонус и выносливость'];
const LEVEL_OPTIONS = ['новичок', 'средний', 'продвинутый'];
const PROBLEM_OPTIONS = ['спина', 'колени', 'плечи'];
const MUSCLE_GROUP_OPTIONS = ['грудь', 'ноги', 'спина', 'плечи', 'бицепс', 'трицепс'];

// Каталог для GigaChat отфильтрован заранее нашим кодом (не моделью) — так
// любой exercise_id в ответе уже гарантированно доступен по инвентарю, не
// травмоопасен под заявленные проблемные зоны и (если задано) бьёт по нужным
// группам мышц. Кардио/растяжка без привязки к группе (muscle_groups: [])
// всегда проходят фильтр — они нужны для разминки/заминки вне зависимости
// от того, что выбрано в качестве основной группы.
function filterCatalog(inventory, problems, muscleGroups = []) {
  return listExercises().filter((e) => {
    const equipmentOk = e.equipment.every((need) => inventory.includes(need));
    const safeOk = !e.avoid_for.some((zone) => problems.includes(zone));
    const groupOk = muscleGroups.length === 0 || e.muscle_groups.length === 0 ||
      e.muscle_groups.some((g) => muscleGroups.includes(g));
    return equipmentOk && safeOk && groupOk;
  });
}

function parseGenerateRequest(body) {
  const minutes = Number(body.minutes);
  if (![15, 30, 45, 60].includes(minutes)) {
    return { error: 'Время тренировки — 15, 30, 45 или 60 минут' };
  }
  const inventory = Array.isArray(body.inventory) ? body.inventory.filter((i) => INVENTORY_OPTIONS.includes(i)) : [];
  const goal = GOAL_OPTIONS.includes(body.goal) ? body.goal : null;
  if (!goal) return { error: 'Укажите цель тренировки' };
  const level = LEVEL_OPTIONS.includes(body.level) ? body.level : null;
  if (!level) return { error: 'Укажите уровень подготовки' };
  const problems = Array.isArray(body.problems) ? body.problems.filter((p) => PROBLEM_OPTIONS.includes(p)) : [];
  const muscleGroups = Array.isArray(body.muscle_groups) ? body.muscle_groups.filter((g) => MUSCLE_GROUP_OPTIONS.includes(g)) : [];
  return { value: { minutes, inventory, goal, level, problems, muscle_groups: muscleGroups } };
}

// --- Каталог упражнений (для пикера «добавить упражнение» в редакторе) ---
app.get('/api/exercises', auth, (req, res) => {
  res.json({ items: listExercises() });
});

// --- Генерация + сохранение тренировки ---
app.post('/api/generate', auth, async (req, res) => {
  if (!checkDailyLimit(req.user.id)) {
    return res.status(429).json({ error: `Дневной лимит генераций (${DAILY_LIMIT}) исчерпан, попробуйте завтра` });
  }
  const parsed = parseGenerateRequest(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const catalog = filterCatalog(parsed.value.inventory, parsed.value.problems, parsed.value.muscle_groups);
    const workout = await generateWorkout(parsed.value, catalog);

    const workoutId = insertWorkout(req.user.id, { ...parsed.value, ...workout, source: 'ai' });
    setWorkoutExercises(workoutId, workout.exercises);
    res.json(getWorkoutFull(workoutId, req.user.id));
  } catch (e) {
    console.error('generateWorkout failed:', e.message);
    res.status(502).json({ error: e.message.includes('каталог') || e.message.includes('условия') ? e.message : 'GigaChat не смог сгенерировать тренировку. Попробуйте ещё раз.' });
  }
});

// --- Библиотека тренировок ---
app.get('/api/workouts', auth, (req, res) => {
  res.json({ items: listWorkouts(req.user.id) });
});

app.get('/api/workouts/:id', auth, (req, res) => {
  const w = getWorkoutFull(Number(req.params.id), req.user.id);
  if (!w) return res.status(404).json({ error: 'Тренировка не найдена' });
  res.json(w);
});

// Ручное редактирование состава — sets/reps/rest_seconds/note правит сам
// пользователь, exercise_id обязан существовать в каталоге.
app.put('/api/workouts/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const w = getWorkoutFull(id, req.user.id);
  if (!w) return res.status(404).json({ error: 'Тренировка не найдена' });

  const validIds = new Set(listExercises().map((e) => e.id));
  const items = Array.isArray(req.body.exercises) ? req.body.exercises : [];
  if (items.length === 0) return res.status(400).json({ error: 'В тренировке должно быть хотя бы одно упражнение' });

  const clean = [];
  for (const it of items) {
    const exerciseId = Number(it.exercise_id);
    if (!validIds.has(exerciseId)) return res.status(400).json({ error: `Упражнение с id ${exerciseId} не найдено в каталоге` });
    const sets = Number(it.sets);
    const rest = Number(it.rest_seconds);
    if (!Number.isInteger(sets) || sets < 1 || sets > 10) return res.status(400).json({ error: 'Подходы — целое число от 1 до 10' });
    if (!Number.isInteger(rest) || rest < 0 || rest > 600) return res.status(400).json({ error: 'Отдых — от 0 до 600 секунд' });
    clean.push({ exercise_id: exerciseId, sets, reps: String(it.reps || '10-12').slice(0, 30), rest_seconds: rest, note: String(it.note || '').slice(0, 200) });
  }

  if (req.body.title) renameWorkout(id, req.user.id, String(req.body.title).slice(0, 100));
  setWorkoutExercises(id, clean);
  res.json(getWorkoutFull(id, req.user.id));
});

app.post('/api/workouts/:id/ai-edit', auth, async (req, res) => {
  if (!checkDailyLimit(req.user.id)) {
    return res.status(429).json({ error: `Дневной лимит генераций (${DAILY_LIMIT}) исчерпан, попробуйте завтра` });
  }
  const id = Number(req.params.id);
  const w = getWorkoutFull(id, req.user.id);
  if (!w) return res.status(404).json({ error: 'Тренировка не найдена' });

  const instruction = String(req.body.instruction || '').trim().slice(0, 300);
  if (!instruction) return res.status(400).json({ error: 'Опишите, что поправить' });

  try {
    const catalog = filterCatalog(w.inventory, w.problems, w.muscle_groups);
    const { exercises } = await generateWorkoutEdit(w, instruction, catalog);
    setWorkoutExercises(id, exercises);
    res.json(getWorkoutFull(id, req.user.id));
  } catch (e) {
    console.error('generateWorkoutEdit failed:', e.message);
    res.status(502).json({ error: e.message.includes('переформулировать') ? e.message : 'GigaChat не смог применить правку. Попробуйте ещё раз.' });
  }
});

app.delete('/api/workouts/:id', auth, (req, res) => {
  const ok = deleteWorkout(Number(req.params.id), req.user.id);
  if (!ok) return res.status(404).json({ error: 'Тренировка не найдена' });
  res.json({ ok: true });
});

// --- Повторяющееся расписание ---
app.get('/api/schedule', auth, (req, res) => {
  res.json({ items: listSchedule(req.user.id) });
});

app.post('/api/schedule', auth, (req, res) => {
  const workoutId = Number(req.body.workout_id);
  const weekdays = Array.isArray(req.body.weekdays) ? req.body.weekdays.map(Number).filter((d) => d >= 0 && d <= 6) : [];
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(req.body.time) ? req.body.time : '18:00';

  if (!getWorkoutFull(workoutId, req.user.id)) return res.status(400).json({ error: 'Тренировка не найдена' });
  if (weekdays.length === 0) return res.status(400).json({ error: 'Выберите хотя бы один день недели' });

  const id = insertSchedule(req.user.id, workoutId, [...new Set(weekdays)], time);
  res.json({ id });
});

app.delete('/api/schedule/:id', auth, (req, res) => {
  const ok = deleteSchedule(Number(req.params.id), req.user.id);
  if (!ok) return res.status(404).json({ error: 'Правило не найдено' });
  res.json({ ok: true });
});

// --- Календарь и сессии ---
app.get('/api/calendar', auth, (req, res) => {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : null;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : null;
  if (!from || !to) return res.status(400).json({ error: 'Нужны параметры from и to в формате YYYY-MM-DD' });

  materializeSessions(req.user.id, from, to);
  res.json({ items: getSessionsRange(req.user.id, from, to) });
});

app.patch('/api/sessions/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!getSession(id, req.user.id)) return res.status(404).json({ error: 'Занятие не найдено' });

  if (req.body.status !== undefined) {
    if (!['planned', 'done', 'skipped'].includes(req.body.status)) return res.status(400).json({ error: 'Некорректный статус' });
    setSessionStatus(id, req.user.id, req.body.status);
  }
  if (req.body.water_ml !== undefined) {
    const water = Number(req.body.water_ml);
    if (!Number.isInteger(water) || water < 0 || water > 10000) return res.status(400).json({ error: 'Некорректный объём воды' });
    setSessionWater(id, req.user.id, water);
  }
  res.json(getSession(id, req.user.id));
});

// --- Фото без своего хранилища ---
// Пересылаем через Bot API в чат самого пользователя и сохраняем только
// вернувшийся file_id — используется и для прогресса, и для осанки.
async function sendPhotoToTelegram(userId, buffer, mimetype, caption) {
  const form = new FormData();
  form.append('chat_id', String(userId));
  form.append('caption', caption);
  form.append('photo', new Blob([buffer], { type: mimetype }), 'photo.jpg');
  const tgRes = await fetch(`${TG_API}/sendPhoto`, { method: 'POST', body: form });
  const tgJson = await tgRes.json();
  if (!tgJson.ok) throw new Error(tgJson.description || 'sendPhoto failed');
  const sizes = tgJson.result.photo;
  return sizes[sizes.length - 1].file_id;
}

async function proxyTelegramPhoto(fileId, res) {
  const fileRes = await fetch(`${TG_API}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const fileJson = await fileRes.json();
  if (!fileJson.ok) throw new Error(fileJson.description || 'getFile failed');
  const imgRes = await fetch(`${TG_FILE}/${fileJson.result.file_path}`);
  res.set('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
  res.set('Cache-Control', 'private, max-age=3600');
  res.send(Buffer.from(await imgRes.arrayBuffer()));
}

// --- Прогресс: вес и фото по датам ---
// Фото не храним на диске — показ через прокси-роут ниже с getFile.
app.post('/api/progress', auth, upload.single('photo'), async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.date) ? req.body.date : new Date().toISOString().slice(0, 10);
  const weightRaw = req.body.weight_kg;
  const weight = weightRaw ? Number(weightRaw) : null;
  if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 400)) {
    return res.status(400).json({ error: 'Укажите вес числом в кг' });
  }
  const note = String(req.body.note || '').trim().slice(0, 200);

  let photoFileId = null;
  if (req.file) {
    try {
      photoFileId = await sendPhotoToTelegram(req.user.id, req.file.buffer, req.file.mimetype, `Прогресс · ${date}`);
    } catch (e) {
      console.error('progress photo upload failed:', e.message);
      return res.status(502).json({ error: 'Не удалось сохранить фото через Telegram, попробуйте ещё раз' });
    }
  }

  const id = insertProgress(req.user.id, { date, weight_kg: weight, photo_file_id: photoFileId, note });
  res.json({ id, date, weight_kg: weight, has_photo: !!photoFileId, note });
});

app.get('/api/progress', auth, (req, res) => {
  const items = listProgress(req.user.id).map((p) => ({ ...p, has_photo: !!p.photo_file_id, photo_file_id: undefined }));
  res.json({ items });
});

app.get('/api/progress/:id/photo', auth, async (req, res) => {
  const items = listProgress(req.user.id);
  const entry = items.find((p) => p.id === Number(req.params.id));
  if (!entry || !entry.photo_file_id) return res.status(404).end();
  try {
    await proxyTelegramPhoto(entry.photo_file_id, res);
  } catch (e) {
    console.error('progress photo proxy failed:', e.message);
    res.status(502).end();
  }
});

app.delete('/api/progress/:id', auth, (req, res) => {
  const ok = deleteProgress(Number(req.params.id), req.user.id);
  if (!ok) return res.status(404).json({ error: 'Запись не найдена' });
  res.json({ ok: true });
});

// --- Осанка: фотоанализ кифоза/лордоза + подбор корректирующих упражнений ---
// Осознанно не диагноз — формулировки и дисклеймер контролируются промптом
// в gigachat.js (buildPostureSystemPrompt). Упражнения — только bodyweight
// (без формы выбора инвентаря, чтобы не усложнять этот отдельный флоу).
app.post('/api/posture/check', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Приложите фото' });
  if (!checkDailyLimit(req.user.id)) {
    return res.status(429).json({ error: `Дневной лимит анализов (${DAILY_LIMIT}) исчерпан, попробуйте завтра` });
  }

  const date = new Date().toISOString().slice(0, 10);
  const postureCatalog = listExercises().filter((e) => e.corrects.length > 0 && e.equipment.length === 0);

  try {
    const [analysis, photoFileId] = await Promise.all([
      analyzePosture(req.file.buffer, req.file.mimetype, postureCatalog),
      sendPhotoToTelegram(req.user.id, req.file.buffer, req.file.mimetype, `Осанка · ${date}`).catch((e) => {
        console.error('posture photo upload failed:', e.message);
        return null; // фото — best-effort, анализ важнее и не должен падать из-за него
      }),
    ]);

    // Кифоз и лордоз — разные зоны коррекции, поэтому это две отдельные
    // тренировки-варианта, а не одна смешанная (можно делать любую или обе).
    function buildCorrectionWorkout(title, exercises) {
      if (exercises.length === 0) return null;
      const id = insertWorkout(req.user.id, {
        title, minutes: 15, goal: 'коррекция осанки', level: 'новичок',
        inventory: [], problems: [], muscle_groups: [], warmup: [], cooldown: [],
        disclaimer: analysis.disclaimer, source: 'posture',
      });
      setWorkoutExercises(id, exercises);
      return id;
    }

    const workoutIdKyphosis = buildCorrectionWorkout('Коррекция осанки: кифоз', analysis.exercises_kyphosis);
    const workoutIdLordosis = buildCorrectionWorkout('Коррекция осанки: лордоз', analysis.exercises_lordosis);

    const checkId = insertPostureCheck(req.user.id, {
      date,
      kyphosis: analysis.kyphosis,
      lordosis: analysis.lordosis,
      general_note: analysis.general_note,
      disclaimer: analysis.disclaimer,
      photo_file_id: photoFileId,
      workout_id_kyphosis: workoutIdKyphosis,
      workout_id_lordosis: workoutIdLordosis,
    });

    res.json({
      id: checkId,
      date,
      kyphosis: analysis.kyphosis,
      lordosis: analysis.lordosis,
      general_note: analysis.general_note,
      disclaimer: analysis.disclaimer,
      workout_kyphosis: workoutIdKyphosis ? getWorkoutFull(workoutIdKyphosis, req.user.id) : null,
      workout_lordosis: workoutIdLordosis ? getWorkoutFull(workoutIdLordosis, req.user.id) : null,
    });
  } catch (e) {
    console.error('analyzePosture failed:', e.message);
    res.status(502).json({ error: 'GigaChat не смог проанализировать фото. Попробуйте другое фото или ещё раз.' });
  }
});

app.get('/api/posture', auth, (req, res) => {
  const items = listPostureChecks(req.user.id).map((p) => ({ ...p, has_photo: !!p.photo_file_id, photo_file_id: undefined }));
  res.json({ items });
});

app.get('/api/posture/:id/photo', auth, async (req, res) => {
  const entry = listPostureChecks(req.user.id).find((p) => p.id === Number(req.params.id));
  if (!entry || !entry.photo_file_id) return res.status(404).end();
  try {
    await proxyTelegramPhoto(entry.photo_file_id, res);
  } catch (e) {
    console.error('posture photo proxy failed:', e.message);
    res.status(502).end();
  }
});

app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));

bot.setMyCommands([
  { command: 'start', description: 'Открыть дневник тренировок' },
  { command: 'support', description: 'Техподдержка' },
  { command: 'feedback', description: 'Оставить отзыв' },
]).catch((e) => console.error('Не удалось задать команды бота:', e.message));

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

bot.onText(/\/start/, (msg) => {
  if (!APP_URL) {
    bot.sendMessage(msg.chat.id, 'APP_URL не задан в .env — подними туннель и пропиши https-адрес.');
    return;
  }
  bot.sendMessage(msg.chat.id, 'Домашние тренировки под твоё время и инвентарь — с календарём, расписанием и трекингом прогресса.', {
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
