import { DatabaseSync } from 'node:sqlite';
import { EXERCISES } from './exercises-seed.js';

// На Railway сюда подставляется путь на смонтированном томе — без этого
// база пересоздавалась бы пустой при каждом передеплое контейнера.
const db = new DatabaseSync(process.env.DB_PATH || 'workouts.sqlite');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    equipment TEXT NOT NULL DEFAULT '[]',
    avoid_for TEXT NOT NULL DEFAULT '[]',
    technique TEXT NOT NULL,
    icon_key TEXT NOT NULL DEFAULT 'core',
    muscle_groups TEXT NOT NULL DEFAULT '[]',
    corrects TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    goal TEXT NOT NULL,
    level TEXT NOT NULL,
    inventory TEXT NOT NULL DEFAULT '[]',
    problems TEXT NOT NULL DEFAULT '[]',
    warmup TEXT NOT NULL DEFAULT '[]',
    cooldown TEXT NOT NULL DEFAULT '[]',
    disclaimer TEXT NOT NULL DEFAULT '',
    muscle_groups TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'ai',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);

  CREATE TABLE IF NOT EXISTS workout_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    position INTEGER NOT NULL DEFAULT 0,
    sets INTEGER NOT NULL,
    reps TEXT NOT NULL,
    rest_seconds INTEGER NOT NULL DEFAULT 60,
    note TEXT DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id);

  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    weekdays TEXT NOT NULL,
    time TEXT NOT NULL DEFAULT '18:00',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_schedule_user ON schedule(user_id);

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    water_ml INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    UNIQUE(user_id, date, workout_id)
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, date);

  CREATE TABLE IF NOT EXISTS progress_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    weight_kg REAL,
    photo_file_id TEXT,
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_progress_user_date ON progress_logs(user_id, date);

  CREATE TABLE IF NOT EXISTS posture_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    kyphosis_json TEXT NOT NULL DEFAULT '{}',
    lordosis_json TEXT NOT NULL DEFAULT '{}',
    general_note TEXT DEFAULT '',
    disclaimer TEXT NOT NULL DEFAULT '',
    photo_file_id TEXT,
    workout_id_kyphosis INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
    workout_id_lordosis INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_posture_user ON posture_checks(user_id);

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT DEFAULT '',
    first_name TEXT DEFAULT '',
    text TEXT NOT NULL,
    delivered INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Приложение уже в проде (Railway) — у существующей базы этих колонок ещё
// нет, CREATE TABLE IF NOT EXISTS их не добавит задним числом.
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('exercises', 'muscle_groups', `muscle_groups TEXT NOT NULL DEFAULT '[]'`);
ensureColumn('exercises', 'corrects', `corrects TEXT NOT NULL DEFAULT '[]'`);
ensureColumn('workouts', 'muscle_groups', `muscle_groups TEXT NOT NULL DEFAULT '[]'`);
// Кифоз и лордоз теперь получают отдельные корректирующие тренировки вместо
// одной смешанной — старая колонка workout_id остаётся в уже задеплоенной
// базе неиспользуемой, но безвредной (SQLite не умеет дёшево дропать колонки).
ensureColumn('posture_checks', 'workout_id_kyphosis', `workout_id_kyphosis INTEGER REFERENCES workouts(id) ON DELETE SET NULL`);
ensureColumn('posture_checks', 'workout_id_lordosis', `workout_id_lordosis INTEGER REFERENCES workouts(id) ON DELETE SET NULL`);

// Каталог — не пользовательские данные, поэтому сидируем через upsert по
// названию при каждом запуске: новые записи добавляются, существующие
// обновляются (например, когда добавляем muscle_groups/corrects к уже
// засеянным на проде строкам), а не только один раз «если таблица пустая».
{
  const findByName = db.prepare('SELECT id FROM exercises WHERE name = ?');
  const insertExercise = db.prepare(`INSERT INTO exercises
    (name, category, equipment, avoid_for, technique, icon_key, muscle_groups, corrects)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const updateExercise = db.prepare(`UPDATE exercises SET
    category = ?, equipment = ?, avoid_for = ?, technique = ?, icon_key = ?, muscle_groups = ?, corrects = ?
    WHERE id = ?`);

  for (const [name, category, equipment, avoid_for, technique, icon_key, muscle_groups, corrects] of EXERCISES) {
    const eq = JSON.stringify(equipment);
    const af = JSON.stringify(avoid_for);
    const mg = JSON.stringify(muscle_groups || []);
    const co = JSON.stringify(corrects || []);
    const existing = findByName.get(name);
    if (existing) updateExercise.run(category, eq, af, technique, icon_key, mg, co, existing.id);
    else insertExercise.run(name, category, eq, af, technique, icon_key, mg, co);
  }
}

const stmts = {
  listExercises: db.prepare('SELECT * FROM exercises ORDER BY id ASC'),
  getExercise: db.prepare('SELECT * FROM exercises WHERE id = ?'),

  insertWorkout: db.prepare(`INSERT INTO workouts
    (user_id, title, minutes, goal, level, inventory, problems, warmup, cooldown, disclaimer, muscle_groups, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  touchWorkout: db.prepare(`UPDATE workouts SET updated_at = datetime('now') WHERE id = ?`),
  renameWorkout: db.prepare(`UPDATE workouts SET title = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`),
  listWorkouts: db.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY created_at DESC'),
  getWorkout: db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?'),
  deleteWorkout: db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?'),

  deleteWorkoutExercises: db.prepare('DELETE FROM workout_exercises WHERE workout_id = ?'),
  insertWorkoutExercise: db.prepare(`INSERT INTO workout_exercises
    (workout_id, exercise_id, position, sets, reps, rest_seconds, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)`),
  listWorkoutExercises: db.prepare(`
    SELECT we.*, e.name, e.category, e.technique, e.icon_key, e.equipment
    FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
    WHERE we.workout_id = ? ORDER BY we.position ASC`),

  insertSchedule: db.prepare(`INSERT INTO schedule (user_id, workout_id, weekdays, time) VALUES (?, ?, ?, ?)`),
  listSchedule: db.prepare(`
    SELECT s.*, w.title AS workout_title
    FROM schedule s JOIN workouts w ON w.id = s.workout_id
    WHERE s.user_id = ? ORDER BY s.created_at DESC`),
  listActiveSchedule: db.prepare('SELECT * FROM schedule WHERE user_id = ? AND active = 1'),
  deleteSchedule: db.prepare('DELETE FROM schedule WHERE id = ? AND user_id = ?'),

  findSession: db.prepare('SELECT id FROM sessions WHERE user_id = ? AND date = ? AND workout_id = ?'),
  insertSession: db.prepare(`INSERT INTO sessions (user_id, workout_id, date, status) VALUES (?, ?, ?, 'planned')`),
  sessionsRange: db.prepare(`
    SELECT s.*, w.title AS workout_title
    FROM sessions s JOIN workouts w ON w.id = s.workout_id
    WHERE s.user_id = ? AND s.date >= ? AND s.date <= ? ORDER BY s.date ASC`),
  getSession: db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?'),
  updateSessionStatus: db.prepare(`UPDATE sessions SET status = ?, completed_at = ? WHERE id = ? AND user_id = ?`),
  updateSessionWater: db.prepare('UPDATE sessions SET water_ml = ? WHERE id = ? AND user_id = ?'),

  insertProgress: db.prepare(`INSERT INTO progress_logs (user_id, date, weight_kg, photo_file_id, note) VALUES (?, ?, ?, ?, ?)`),
  listProgress: db.prepare('SELECT * FROM progress_logs WHERE user_id = ? ORDER BY date DESC'),
  deleteProgress: db.prepare('DELETE FROM progress_logs WHERE id = ? AND user_id = ?'),

  insertPostureCheck: db.prepare(`INSERT INTO posture_checks
    (user_id, date, kyphosis_json, lordosis_json, general_note, disclaimer, photo_file_id, workout_id_kyphosis, workout_id_lordosis)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  listPostureChecks: db.prepare('SELECT * FROM posture_checks WHERE user_id = ? ORDER BY created_at DESC'),

  insertFeedback: db.prepare(`INSERT INTO feedback (user_id, username, first_name, text, delivered)
    VALUES (?, ?, ?, ?, ?)`),
  markDelivered: db.prepare('UPDATE feedback SET delivered = 1 WHERE id = ?'),
  listFeedback: db.prepare('SELECT * FROM feedback ORDER BY created_at DESC'),
};

function parseExercise(row) {
  return {
    ...row,
    equipment: JSON.parse(row.equipment),
    avoid_for: JSON.parse(row.avoid_for),
    muscle_groups: JSON.parse(row.muscle_groups),
    corrects: JSON.parse(row.corrects),
  };
}

export const listExercises = () => stmts.listExercises.all().map(parseExercise);
export const getExercise = (id) => {
  const row = stmts.getExercise.get(id);
  return row ? parseExercise(row) : null;
};

export function insertWorkout(userId, meta) {
  const r = stmts.insertWorkout.run(
    userId, meta.title, meta.minutes, meta.goal, meta.level,
    JSON.stringify(meta.inventory || []), JSON.stringify(meta.problems || []),
    JSON.stringify(meta.warmup || []), JSON.stringify(meta.cooldown || []), meta.disclaimer || '',
    JSON.stringify(meta.muscle_groups || []),
    meta.source || 'ai'
  );
  return Number(r.lastInsertRowid);
}

// Полностью пересобирает состав тренировки — используется и при первой
// генерации, и при ручном/AI-редактировании: проще заменить целиком, чем
// диффать список упражнений построчно.
export function setWorkoutExercises(workoutId, items) {
  stmts.deleteWorkoutExercises.run(workoutId);
  items.forEach((it, i) => {
    stmts.insertWorkoutExercise.run(workoutId, it.exercise_id, i, it.sets, it.reps, it.rest_seconds, it.note || '');
  });
  stmts.touchWorkout.run(workoutId);
}

function parseWorkout(w) {
  return {
    ...w,
    inventory: JSON.parse(w.inventory),
    problems: JSON.parse(w.problems),
    warmup: JSON.parse(w.warmup),
    cooldown: JSON.parse(w.cooldown),
    muscle_groups: JSON.parse(w.muscle_groups),
  };
}

export function listWorkouts(userId) {
  return stmts.listWorkouts.all(userId).map((w) => ({
    ...parseWorkout(w),
    exercise_count: stmts.listWorkoutExercises.all(w.id).length,
  }));
}

export function getWorkoutFull(id, userId) {
  const w = stmts.getWorkout.get(id, userId);
  if (!w) return null;
  const exercises = stmts.listWorkoutExercises.all(id).map((e) => ({ ...e, equipment: JSON.parse(e.equipment) }));
  return { ...parseWorkout(w), exercises };
}

export const renameWorkout = (id, userId, title) => stmts.renameWorkout.run(title, id, userId).changes > 0;
export const deleteWorkout = (id, userId) => stmts.deleteWorkout.run(id, userId).changes > 0;

export const insertSchedule = (userId, workoutId, weekdays, time) =>
  Number(stmts.insertSchedule.run(userId, workoutId, JSON.stringify(weekdays), time).lastInsertRowid);
export const listSchedule = (userId) =>
  stmts.listSchedule.all(userId).map((s) => ({ ...s, weekdays: JSON.parse(s.weekdays) }));
export const listActiveSchedule = (userId) =>
  stmts.listActiveSchedule.all(userId).map((s) => ({ ...s, weekdays: JSON.parse(s.weekdays) }));
export const deleteSchedule = (id, userId) => stmts.deleteSchedule.run(id, userId).changes > 0;

// Достраивает недостающие 'planned'-сессии из активных правил расписания на
// диапазон дат — вызывается лениво при открытии календаря, без отдельного
// cron-процесса.
export function materializeSessions(userId, fromDate, toDate) {
  const rules = stmts.listActiveSchedule.all(userId).map((s) => ({ ...s, weekdays: JSON.parse(s.weekdays) }));
  if (rules.length === 0) return;

  const from = new Date(fromDate + 'T00:00:00Z');
  const to = new Date(toDate + 'T00:00:00Z');
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const weekday = d.getUTCDay();
    for (const rule of rules) {
      if (!rule.weekdays.includes(weekday)) continue;
      if (stmts.findSession.get(userId, dateStr, rule.workout_id)) continue;
      stmts.insertSession.run(userId, rule.workout_id, dateStr);
    }
  }
}

export const getSessionsRange = (userId, fromDate, toDate) => stmts.sessionsRange.all(userId, fromDate, toDate);
export const getSession = (id, userId) => stmts.getSession.get(id, userId);

export function setSessionStatus(id, userId, status) {
  const completedAt = status === 'done' ? new Date().toISOString() : null;
  return stmts.updateSessionStatus.run(status, completedAt, id, userId).changes > 0;
}
export const setSessionWater = (id, userId, waterMl) => stmts.updateSessionWater.run(waterMl, id, userId).changes > 0;

export function insertProgress(userId, entry) {
  const r = stmts.insertProgress.run(userId, entry.date, entry.weight_kg ?? null, entry.photo_file_id ?? null, entry.note || '');
  return Number(r.lastInsertRowid);
}
export const listProgress = (userId) => stmts.listProgress.all(userId);
export const deleteProgress = (id, userId) => stmts.deleteProgress.run(id, userId).changes > 0;

export function insertPostureCheck(userId, entry) {
  const r = stmts.insertPostureCheck.run(
    userId, entry.date,
    JSON.stringify(entry.kyphosis || {}), JSON.stringify(entry.lordosis || {}),
    entry.general_note || '', entry.disclaimer || '',
    entry.photo_file_id ?? null,
    entry.workout_id_kyphosis ?? null, entry.workout_id_lordosis ?? null
  );
  return Number(r.lastInsertRowid);
}
export const listPostureChecks = (userId) =>
  stmts.listPostureChecks.all(userId).map((p) => ({
    ...p, kyphosis: JSON.parse(p.kyphosis_json), lordosis: JSON.parse(p.lordosis_json),
    kyphosis_json: undefined, lordosis_json: undefined,
  }));

export function insertFeedback(userId, username, firstName, text, delivered) {
  const r = stmts.insertFeedback.run(userId, username || '', firstName || '', text, delivered ? 1 : 0);
  return Number(r.lastInsertRowid);
}
export const markFeedbackDelivered = (id) => stmts.markDelivered.run(id);
export const listFeedback = () => stmts.listFeedback.all();
