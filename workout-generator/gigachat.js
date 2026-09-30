import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';

const AUTH_KEY = process.env.GIGACHAT_AUTH_KEY;
const SCOPE = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';
const MODEL = process.env.GIGACHAT_MODEL || 'GigaChat';

// GigaChat подписывает TLS-сертификат через НУЦ Минцифры России, которого нет
// в доверенном списке Node за пределами РФ-инфраструктуры. Если положить cert
// в файл и указать путь в GIGACHAT_CA_CERT_PATH — используем его (правильный
// путь). Без файла отключаем проверку цепочки только для хостов GigaChat —
// это задокументированная особенность их API, а не наша дыра в безопасности.
const caCertPath = process.env.GIGACHAT_CA_CERT_PATH;
const agentOptions = { keepAlive: true };
if (caCertPath && fs.existsSync(caCertPath)) {
  agentOptions.ca = fs.readFileSync(caCertPath);
} else {
  agentOptions.rejectUnauthorized = false;
  console.warn(
    '[gigachat] GIGACHAT_CA_CERT_PATH не задан — проверка TLS-сертификата GigaChat отключена. ' +
    'Это известная особенность их API (см. README), но по-хорошему стоит подставить минцифровский сертификат.'
  );
}
const agent = new https.Agent(agentOptions);

function request(hostname, port, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, port, path, method: 'POST', headers, agent }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GigaChat ${path} -> HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`GigaChat ${path}: не удалось разобрать ответ (${e.message})`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Токен живёт ~30 минут, кэшируем и обновляем заранее, чтобы не гонять OAuth
// на каждую генерацию тренировки.
let cachedToken = null;
let cachedExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < cachedExpiresAt - 30_000) return cachedToken;
  if (!AUTH_KEY) throw new Error('GIGACHAT_AUTH_KEY не задан в .env — возьми Authorization key в личном кабинете GigaChat API');

  const body = new URLSearchParams({ scope: SCOPE }).toString();
  const json = await request('ngw.devices.sberbank.ru', 9443, '/api/v2/oauth', {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'Content-Length': Buffer.byteLength(body),
      RqUID: crypto.randomUUID(),
      Authorization: `Basic ${AUTH_KEY}`,
    },
    body,
  });

  cachedToken = json.access_token;
  cachedExpiresAt = json.expires_at; // GigaChat отдаёт готовый ms-epoch времени истечения
  return cachedToken;
}

async function chat(systemPrompt, userPrompt, opts = {}) {
  const token = await getToken();
  const userMessage = { role: 'user', content: userPrompt };
  if (opts.attachments) userMessage.attachments = opts.attachments;
  const body = JSON.stringify({
    model: opts.model || MODEL,
    temperature: 0.7,
    max_tokens: 1800,
    messages: [
      { role: 'system', content: systemPrompt },
      userMessage,
    ],
  });

  const json = await request('gigachat.devices.sberbank.ru', 443, '/api/v1/chat/completions', {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Content-Length': Buffer.byteLength(body),
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error('GigaChat вернул пустой ответ');
  return raw;
}

// Модель иногда всё равно оборачивает JSON в ```json ... ``` вопреки промпту —
// снимаем обёртку перед парсингом, а не полагаемся на дисциплину модели.
function parseJsonResponse(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const text = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('GigaChat вернул ответ не в формате JSON — попробуйте ещё раз');
  }
}

// Тренировку модель собирает СТРОГО из каталога упражнений (id), а не из
// свободного текста — иначе у сохранённого упражнения не будет техники и
// иконки, а модель может предложить что-то небезопасное под травму.
// Каталог заранее отфильтрован под инвентарь/проблемные зоны пользователя
// (см. filterCatalog в server.js), так что любой id в ответе уже безопасен —
// LLM отвечает только за подбор и структуру (сколько, сколько раз, отдых).
function catalogForPrompt(catalog) {
  return catalog.map((e) => ({ id: e.id, name: e.name, category: e.category }));
}

const EXERCISE_SCHEMA = `{"exercise_id": число_id_из_каталога, "sets": число, "reps": "строка вида 12-15 или 30 сек", "rest_seconds": число, "note": "короткая подсказка по технике или зачем выбрано именно это упражнение"}`;

function buildGenerateSystemPrompt() {
  return `Ты — сертифицированный фитнес-тренер, который составляет домашнюю тренировку СТРОГО из предоставленного каталога упражнений.

Правила:
- Упражнения в "exercises" выбирай только по их id из каталога в сообщении пользователя — не придумывай других упражнений и не меняй id.
- Количество упражнений и подходов подбирай под указанное время и уровень подготовки.
- Не повторяй одно и то же упражнение дважды.
- "warmup" и "cooldown" — НЕ из каталога и без id: это обычные короткие фразы простым языком, 3-8 слов, без номеров и цифр в начале строки. Пример хорошего "warmup": ["лёгкая ходьба на месте 2 минуты", "вращения руками и плечами"]. Пример плохого — "45 jumping jacks" (это упражнение из каталога с номером, так писать нельзя).
- Не давай медицинских рекомендаций и не ставь диагнозы.

Ответь СТРОГО валидным JSON без markdown-обрамления и пояснений вне JSON, по схеме:
{
  "title": "короткое название тренировки",
  "duration_minutes": число,
  "warmup": ["короткая фраза без номеров", "..."],
  "exercises": [${EXERCISE_SCHEMA}],
  "cooldown": ["короткая фраза без номеров", "..."],
  "disclaimer": "короткое предупреждение, что это не медицинская рекомендация и при боли нужно остановиться"
}`;
}

function buildGenerateUserPrompt({ minutes, inventory, goal, level, problems }, catalog) {
  const lines = [
    `Время на тренировку: ${minutes} минут.`,
    `Инвентарь: ${inventory.length ? inventory.join(', ') : 'только собственный вес'}.`,
    `Цель: ${goal}.`,
    `Уровень подготовки: ${level}.`,
    `Проблемные зоны: ${problems.length ? problems.join(', ') : 'нет'}.`,
    `Каталог доступных упражнений (уже отфильтрован под инвентарь и проблемные зоны, выбирай только отсюда):`,
    JSON.stringify(catalogForPrompt(catalog)),
  ];
  return lines.join('\n');
}

// Возвращает набор допустимых id — страховка на случай, если модель всё же
// подставит id не из каталога (например, перепутает соседний).
function sanitizeExercises(exercises, catalog) {
  const validIds = new Set(catalog.map((e) => e.id));
  const seen = new Set();
  const clean = [];
  for (const ex of exercises || []) {
    const id = Number(ex.exercise_id);
    if (!validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    clean.push({
      exercise_id: id,
      sets: Number(ex.sets) || 3,
      reps: String(ex.reps || '10-12'),
      rest_seconds: Number(ex.rest_seconds) || 60,
      note: String(ex.note || '').slice(0, 200),
    });
  }
  return clean;
}

export async function generateWorkout(params, catalog) {
  if (catalog.length < 4) {
    throw new Error('Слишком мало подходящих упражнений под эти условия — попробуйте выбрать другой инвентарь или снять часть ограничений');
  }

  const raw = await chat(buildGenerateSystemPrompt(), buildGenerateUserPrompt(params, catalog));
  const parsed = parseJsonResponse(raw);
  const exercises = sanitizeExercises(parsed.exercises, catalog);

  if (exercises.length === 0) {
    throw new Error('GigaChat не смог подобрать упражнения из каталога — попробуйте сгенерировать ещё раз');
  }

  return {
    title: String(parsed.title || 'Домашняя тренировка').slice(0, 100),
    duration_minutes: Number(parsed.duration_minutes) || params.minutes,
    warmup: sanitizeSteps(parsed.warmup),
    cooldown: sanitizeSteps(parsed.cooldown),
    disclaimer: String(parsed.disclaimer || 'Это не медицинская рекомендация. При боли — остановитесь.').slice(0, 300),
    exercises,
  };
}

// Модель иногда всё же подмешивает в warmup/cooldown номер каталога перед
// названием (например «45 jumping jacks») вопреки промпту — срезаем
// ведущие цифры как страховку, не полагаясь только на дисциплину модели.
function sanitizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.slice(0, 6).map((s) => String(s).replace(/^\s*\d+[\s.):-]*/, '').trim()).filter(Boolean);
}

function buildEditSystemPrompt() {
  return `Ты — сертифицированный фитнес-тренер, который правит уже готовую домашнюю тренировку по просьбе пользователя, оставаясь СТРОГО в рамках предоставленного каталога упражнений.

Правила:
- Меняй только то, о чём просит пользователь — остальные упражнения из текущего состава оставляй как есть, если не просили менять всё.
- Новые упражнения бери только по id из каталога.
- Не повторяй одно и то же упражнение дважды.
- Не давай медицинских рекомендаций.

Ответь СТРОГО валидным JSON без markdown-обрамления, по схеме:
{"exercises": [${EXERCISE_SCHEMA}]}`;
}

function buildEditUserPrompt(workout, instruction, catalog) {
  const current = workout.exercises.map((e) => ({
    exercise_id: e.exercise_id, name: e.name, sets: e.sets, reps: e.reps, rest_seconds: e.rest_seconds, note: e.note,
  }));
  const lines = [
    `Текущий состав тренировки «${workout.title}»:`,
    JSON.stringify(current),
    `Просьба пользователя: ${instruction}`,
    `Каталог доступных упражнений (выбирай новые только отсюда):`,
    JSON.stringify(catalogForPrompt(catalog)),
  ];
  return lines.join('\n');
}

export async function generateWorkoutEdit(workout, instruction, catalog) {
  const raw = await chat(buildEditSystemPrompt(), buildEditUserPrompt(workout, instruction, catalog));
  const parsed = parseJsonResponse(raw);
  const exercises = sanitizeExercises(parsed.exercises, catalog);

  if (exercises.length === 0) {
    throw new Error('GigaChat не смог применить правку — попробуйте переформулировать просьбу');
  }

  return { exercises };
}

// --- Осанка: фотоанализ ---
// Базовая модель "GigaChat" картинки не понимает (422 Model does not support
// image) — для vision нужна -Max/-Pro. Проверено вживую на бесплатном тарифе.
const VISION_MODEL = process.env.GIGACHAT_VISION_MODEL || 'GigaChat-2-Max';

function multipartBody(fieldName, buffer, filename, mimetype, extraFields = {}) {
  const boundary = '----giga' + crypto.randomUUID().replace(/-/g, '');
  const parts = [];
  for (const [key, value] of Object.entries(extraFields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`
  ));
  parts.push(buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

export async function uploadFile(buffer, filename, mimetype) {
  const token = await getToken();
  const { body, contentType } = multipartBody('file', buffer, filename, mimetype, { purpose: 'general' });

  const json = await request('gigachat.devices.sberbank.ru', 443, '/api/v1/files', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'Content-Length': body.length,
    },
    body,
  });
  if (!json.id) throw new Error('GigaChat не принял фото — попробуйте другое изображение');
  return json.id;
}

// Кифоз/лордоз — медицинские термины, а анализирует их LLM по фото, не врач.
// Поэтому формулировки намеренно осторожные («визуальные признаки», не
// «диагноз»), и дисклеймер обязателен в самом промпте, а не только в UI.
function buildPostureSystemPrompt() {
  return `Ты помогаешь визуально оценить осанку по фотографии человека в профиль, СТРОГО НЕ ставя медицинский диагноз — только описываешь заметные на фото визуальные признаки, похожие на кифоз (сутулость, усиленный изгиб верхней части спины и наклон головы вперёд) и лордоз/наклон таза (усиленный прогиб в пояснице).

Правила:
- Пиши только про то, что реально видно на фото. Если ракурс или качество фото не позволяют оценить — так и скажи, confidence "низкая".
- Никогда не пиши фразы вида "у вас кифоз" или "диагноз" — только "визуальные признаки, похожие на...", "заметен небольшой изгиб...".
- Кифоз и лордоз — разные зоны и разные упражнения, поэтому подбирай их ОТДЕЛЬНО: "exercises_kyphosis" — только если kyphosis.visible_signs = true, "exercises_lordosis" — только если lordosis.visible_signs = true. Упражнения бери только по id из каталога в сообщении пользователя (там уже отдельно подписано, что относится к кифозу, а что к лордозу).
- Не давай медицинских рекомендаций сверх подбора упражнений и не назначай лечение.

Ответь СТРОГО валидным JSON без markdown-обрамления, по схеме:
{
  "kyphosis": {"visible_signs": true/false, "confidence": "низкая|средняя|высокая", "note": "короткое описание того, что видно на фото"},
  "lordosis": {"visible_signs": true/false, "confidence": "низкая|средняя|высокая", "note": "короткое описание того, что видно на фото"},
  "general_note": "1-2 предложения общего впечатления",
  "disclaimer": "предупреждение, что это не медицинский диагноз и при подозрениях стоит обратиться к врачу или остеопату",
  "exercises_kyphosis": [${EXERCISE_SCHEMA}],
  "exercises_lordosis": [${EXERCISE_SCHEMA}]
}`;
}

function buildPostureUserPrompt(kyphosisCatalog, lordosisCatalog) {
  return [
    'Оцени осанку человека на приложенной фотографии (профиль/бок).',
    'Каталог упражнений на коррекцию кифоза (для exercises_kyphosis):',
    JSON.stringify(catalogForPrompt(kyphosisCatalog)),
    'Каталог упражнений на коррекцию лордоза/наклона таза (для exercises_lordosis):',
    JSON.stringify(catalogForPrompt(lordosisCatalog)),
  ].join('\n');
}

// Кифоз и лордоз корректируются разными упражнениями (верх спины/грудь —
// против низ спины/таз), поэтому вместо одной смешанной тренировки модель
// подбирает два отдельных варианта коррекции — каждый по своему подмножеству
// каталога (см. corrects в exercises-seed.js).
export async function analyzePosture(photoBuffer, mimetype, fullCatalog) {
  const kyphosisCatalog = fullCatalog.filter((e) => e.corrects.includes('кифоз'));
  const lordosisCatalog = fullCatalog.filter((e) => e.corrects.includes('лордоз'));
  if (kyphosisCatalog.length === 0 && lordosisCatalog.length === 0) {
    throw new Error('В каталоге нет доступных упражнений на осанку');
  }

  const fileId = await uploadFile(photoBuffer, 'posture.jpg', mimetype);
  const raw = await chat(buildPostureSystemPrompt(), buildPostureUserPrompt(kyphosisCatalog, lordosisCatalog), {
    model: VISION_MODEL,
    attachments: [fileId],
  });
  const parsed = parseJsonResponse(raw);

  const kyphosis = {
    visible_signs: !!parsed.kyphosis?.visible_signs,
    confidence: String(parsed.kyphosis?.confidence || 'низкая').slice(0, 20),
    note: String(parsed.kyphosis?.note || '').slice(0, 300),
  };
  const lordosis = {
    visible_signs: !!parsed.lordosis?.visible_signs,
    confidence: String(parsed.lordosis?.confidence || 'низкая').slice(0, 20),
    note: String(parsed.lordosis?.note || '').slice(0, 300),
  };
  const exercisesKyphosis = kyphosis.visible_signs ? sanitizeExercises(parsed.exercises_kyphosis, kyphosisCatalog) : [];
  const exercisesLordosis = lordosis.visible_signs ? sanitizeExercises(parsed.exercises_lordosis, lordosisCatalog) : [];

  return {
    kyphosis,
    lordosis,
    general_note: String(parsed.general_note || '').slice(0, 400),
    disclaimer: String(parsed.disclaimer || 'Это не медицинский диагноз. При подозрениях на нарушения осанки обратитесь к врачу или остеопату.').slice(0, 300),
    exercises_kyphosis: exercisesKyphosis,
    exercises_lordosis: exercisesLordosis,
  };
}
