import { DatabaseSync } from 'node:sqlite';

// На Railway сюда подставляется путь на смонтированном томе — без этого
// база пересоздавалась бы пустой при каждом передеплое контейнера.
const db = new DatabaseSync(process.env.DB_PATH || 'subs.sqlite');

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    period TEXT NOT NULL DEFAULT 'month',
    next_payment TEXT NOT NULL,
    payment_method TEXT DEFAULT '',
    category TEXT DEFAULT 'Прочее',
    is_trial INTEGER NOT NULL DEFAULT 0,
    remind_days INTEGER NOT NULL DEFAULT 2,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);

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

// Период раньше хранился как 'month' / 'year'. Переносим на число месяцев,
// чтобы можно было задавать любой интервал.
const columns = db.prepare('PRAGMA table_info(subscriptions)').all().map((c) => c.name);
if (!columns.includes('period_months')) {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN period_months INTEGER NOT NULL DEFAULT 1`);
  db.exec(`UPDATE subscriptions SET period_months = CASE period WHEN 'year' THEN 12 ELSE 1 END`);
}

const stmts = {
  list: db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_payment ASC'),
  count: db.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ?'),
  get: db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?'),
  insert: db.prepare(`INSERT INTO subscriptions
    (user_id, name, price, period_months, next_payment, payment_method, category, is_trial, remind_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  update: db.prepare(`UPDATE subscriptions SET
    name = ?, price = ?, period_months = ?, next_payment = ?, payment_method = ?, category = ?, is_trial = ?, remind_days = ?
    WHERE id = ? AND user_id = ?`),
  remove: db.prepare('DELETE FROM subscriptions WHERE id = ? AND user_id = ?'),
  due: db.prepare('SELECT * FROM subscriptions WHERE date(next_payment) <= date(?)'),
  setNextPayment: db.prepare('UPDATE subscriptions SET next_payment = ? WHERE id = ?'),
  allForReminder: db.prepare('SELECT * FROM subscriptions'),
  insertFeedback: db.prepare(`INSERT INTO feedback (user_id, username, first_name, text, delivered)
    VALUES (?, ?, ?, ?, ?)`),
  markDelivered: db.prepare('UPDATE feedback SET delivered = 1 WHERE id = ?'),
  listFeedback: db.prepare('SELECT * FROM feedback ORDER BY created_at DESC'),
};

export const listSubs = (userId) => stmts.list.all(userId);
export const countSubs = (userId) => stmts.count.get(userId).n;
export const getSub = (id, userId) => stmts.get.get(id, userId);
export const removeSub = (id, userId) => stmts.remove.run(id, userId);
export const allSubs = () => stmts.allForReminder.all();
export const setNextPayment = (id, date) => stmts.setNextPayment.run(date, id);

export function insertSub(userId, s) {
  const r = stmts.insert.run(
    userId, s.name, s.price, s.period_months, s.next_payment,
    s.payment_method, s.category, s.is_trial ? 1 : 0, s.remind_days
  );
  return Number(r.lastInsertRowid);
}

export function updateSub(id, userId, s) {
  const r = stmts.update.run(
    s.name, s.price, s.period_months, s.next_payment,
    s.payment_method, s.category, s.is_trial ? 1 : 0, s.remind_days,
    id, userId
  );
  return r.changes > 0;
}

export function insertFeedback(userId, username, firstName, text, delivered) {
  const r = stmts.insertFeedback.run(userId, username || '', firstName || '', text, delivered ? 1 : 0);
  return Number(r.lastInsertRowid);
}

export const markFeedbackDelivered = (id) => stmts.markDelivered.run(id);
export const listFeedback = () => stmts.listFeedback.all();
