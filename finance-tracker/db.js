import { DatabaseSync } from 'node:sqlite';

// На Railway сюда подставляется путь на смонтированном томе — без этого
// база пересоздавалась бы пустой при каждом передеплое контейнера.
const db = new DatabaseSync(process.env.DB_PATH || 'finance.sqlite');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER PRIMARY KEY,
    theme TEXT NOT NULL DEFAULT 'system',
    language TEXT NOT NULL DEFAULT 'ru',
    currency TEXT NOT NULL DEFAULT 'RUB',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('card','cash','crypto')),
    name_key TEXT,
    name TEXT,
    bank TEXT,
    icon TEXT NOT NULL DEFAULT '💳',
    color TEXT NOT NULL DEFAULT '#6C8CFF',
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
    name_key TEXT,
    name TEXT,
    icon TEXT NOT NULL DEFAULT '📦',
    color TEXT NOT NULL DEFAULT '#6C8CFF',
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense','income')),
    amount REAL NOT NULL CHECK (amount > 0),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    note TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

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

// Дефолтные счета и категории заводятся один раз при первом обращении
// нового пользователя — дальше он их правит/архивирует как угодно.
const DEFAULT_ACCOUNTS = [
  { type: 'cash', name_key: 'account_cash', icon: '💵', color: '#22C55E' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name_key: 'cat_food', icon: '🍔', color: '#FB923C' },
  { name_key: 'cat_transport', icon: '🚗', color: '#38BDF8' },
  { name_key: 'cat_home', icon: '🏠', color: '#A78BFA' },
  { name_key: 'cat_shopping', icon: '🛍️', color: '#F472B6' },
  { name_key: 'cat_health', icon: '💊', color: '#F87171' },
  { name_key: 'cat_entertainment', icon: '🎬', color: '#FBBF24' },
  { name_key: 'cat_education', icon: '📚', color: '#4ADE80' },
  { name_key: 'cat_travel', icon: '✈️', color: '#60A5FA' },
  { name_key: 'cat_subscriptions', icon: '🔁', color: '#818CF8' },
  { name_key: 'cat_other_expense', icon: '📦', color: '#94A3B8' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name_key: 'cat_salary', icon: '💼', color: '#22C55E' },
  { name_key: 'cat_freelance', icon: '💻', color: '#34D399' },
  { name_key: 'cat_gift', icon: '🎁', color: '#F472B6' },
  { name_key: 'cat_investment', icon: '📈', color: '#38BDF8' },
  { name_key: 'cat_refund', icon: '↩️', color: '#A78BFA' },
  { name_key: 'cat_other_income', icon: '💰', color: '#FBBF24' },
];

function seedDefaults(userId) {
  const insertAccount = db.prepare(`
    INSERT INTO accounts (user_id, type, name_key, icon, color, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  DEFAULT_ACCOUNTS.forEach((a, i) => insertAccount.run(userId, a.type, a.name_key, a.icon, a.color, i));

  const insertCategory = db.prepare(`
    INSERT INTO categories (user_id, kind, name_key, icon, color, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  DEFAULT_EXPENSE_CATEGORIES.forEach((c, i) => insertCategory.run(userId, 'expense', c.name_key, c.icon, c.color, i));
  DEFAULT_INCOME_CATEGORIES.forEach((c, i) => insertCategory.run(userId, 'income', c.name_key, c.icon, c.color, i));
}

export function getSettings(userId) {
  const row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  if (row) return row;
  db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);
  seedDefaults(userId);
  return db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
}

export function updateSettings(userId, { theme, language, currency }) {
  getSettings(userId); // гарантирует, что строка и дефолты уже существуют
  const current = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  db.prepare(`
    UPDATE settings SET theme = ?, language = ?, currency = ?, updated_at = datetime('now')
    WHERE user_id = ?
  `).run(
    theme ?? current.theme,
    language ?? current.language,
    currency ?? current.currency,
    userId,
  );
  return db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
}

export function listAccounts(userId, { includeArchived = false } = {}) {
  getSettings(userId);
  const sql = includeArchived
    ? 'SELECT * FROM accounts WHERE user_id = ? ORDER BY sort_order, id'
    : 'SELECT * FROM accounts WHERE user_id = ? AND archived = 0 ORDER BY sort_order, id';
  return db.prepare(sql).all(userId);
}

export function insertAccount(userId, { type, name, bank, icon, color }) {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM accounts WHERE user_id = ?').get(userId).m;
  const info = db.prepare(`
    INSERT INTO accounts (user_id, type, name, bank, icon, color, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, type, name, bank || null, icon || '💳', color || '#6C8CFF', maxOrder + 1);
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid);
}

export function updateAccount(userId, id, { name, bank, icon, color }) {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;
  db.prepare(`
    UPDATE accounts SET name = ?, bank = ?, icon = ?, color = ?
    WHERE id = ? AND user_id = ?
  `).run(
    name !== undefined ? name : row.name,
    bank !== undefined ? bank : row.bank,
    icon || row.icon,
    color || row.color,
    id, userId,
  );
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}

// Счета не удаляем физически — история транзакций должна остаться читаемой.
// Архивация просто прячет счёт из пикеров при создании новых операций.
export function archiveAccount(userId, id, archived = 1) {
  const info = db.prepare('UPDATE accounts SET archived = ? WHERE id = ? AND user_id = ?').run(archived ? 1 : 0, id, userId);
  return info.changes > 0;
}

export function listCategories(userId, { kind, includeArchived = false } = {}) {
  getSettings(userId);
  const clauses = ['user_id = ?'];
  const params = [userId];
  if (kind) { clauses.push('kind = ?'); params.push(kind); }
  if (!includeArchived) clauses.push('archived = 0');
  return db.prepare(`SELECT * FROM categories WHERE ${clauses.join(' AND ')} ORDER BY sort_order, id`).all(...params);
}

export function insertCategory(userId, { kind, name, icon, color }) {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories WHERE user_id = ? AND kind = ?').get(userId, kind).m;
  const info = db.prepare(`
    INSERT INTO categories (user_id, kind, name, icon, color, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, kind, name, icon || '📦', color || '#6C8CFF', maxOrder + 1);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
}

export function updateCategory(userId, id, { name, icon, color }) {
  const row = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;
  db.prepare(`
    UPDATE categories SET name = ?, icon = ?, color = ?
    WHERE id = ? AND user_id = ?
  `).run(
    name !== undefined ? name : row.name,
    icon || row.icon,
    color || row.color,
    id, userId,
  );
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

export function archiveCategory(userId, id, archived = 1) {
  const info = db.prepare('UPDATE categories SET archived = ? WHERE id = ? AND user_id = ?').run(archived ? 1 : 0, id, userId);
  return info.changes > 0;
}

export function listTransactions(userId, { from, to, type, categoryId, accountId, limit = 200, offset = 0 } = {}) {
  const clauses = ['t.user_id = ?'];
  const params = [userId];
  if (from) { clauses.push('t.date >= ?'); params.push(from); }
  if (to) { clauses.push('t.date <= ?'); params.push(to); }
  if (type) { clauses.push('t.type = ?'); params.push(type); }
  if (categoryId) { clauses.push('t.category_id = ?'); params.push(categoryId); }
  if (accountId) { clauses.push('t.account_id = ?'); params.push(accountId); }
  params.push(limit, offset);
  return db.prepare(`
    SELECT t.*,
      a.icon AS account_icon, a.color AS account_color, a.name AS account_name, a.name_key AS account_name_key, a.type AS account_type,
      c.icon AS category_icon, c.color AS category_color, c.name AS category_name, c.name_key AS category_name_key
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    JOIN categories c ON c.id = t.category_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY t.date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(...params);
}

export function insertTransaction(userId, { type, amount, accountId, categoryId, note, date }) {
  const info = db.prepare(`
    INSERT INTO transactions (user_id, type, amount, account_id, category_id, note, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, type, amount, accountId, categoryId, note || '', date);
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);
}

export function updateTransaction(userId, id, { type, amount, accountId, categoryId, note, date }) {
  const row = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;
  db.prepare(`
    UPDATE transactions SET type = ?, amount = ?, account_id = ?, category_id = ?, note = ?, date = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(
    type ?? row.type,
    amount ?? row.amount,
    accountId ?? row.account_id,
    categoryId ?? row.category_id,
    note !== undefined ? note : row.note,
    date ?? row.date,
    id, userId,
  );
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
}

export function deleteTransaction(userId, id) {
  const info = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, userId);
  return info.changes > 0;
}

// Сводка для «Главной» и «Аналитики»: баланс по счетам + доход/расход за период
// + разбивка расходов по категориям (для диаграммы).
export function getSummary(userId, { from, to } = {}) {
  const clauses = ['user_id = ?'];
  const params = [userId];
  if (from) { clauses.push('date >= ?'); params.push(from); }
  if (to) { clauses.push('date <= ?'); params.push(to); }
  const where = clauses.join(' AND ');
  // Отдельная версия с префиксом t. — нужна там, где transactions джойнится
  // с categories и колонка user_id иначе становится неоднозначной.
  const whereT = clauses.map((c) => `t.${c}`).join(' AND ');

  const totals = db.prepare(`
    SELECT type, COALESCE(SUM(amount), 0) AS total
    FROM transactions WHERE ${where} GROUP BY type
  `).all(...params);

  const byCategory = db.prepare(`
    SELECT c.id AS category_id, c.name AS name, c.name_key AS name_key, c.icon AS icon, c.color AS color,
      t.type AS type, COALESCE(SUM(t.amount), 0) AS total
    FROM transactions t JOIN categories c ON c.id = t.category_id
    WHERE ${whereT}
    GROUP BY c.id, t.type
    ORDER BY total DESC
  `).all(...params);

  const byAccountRows = db.prepare(`
    SELECT account_id,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
    FROM transactions WHERE user_id = ? GROUP BY account_id
  `).all(userId);

  const accounts = listAccounts(userId, { includeArchived: true });
  const balances = accounts.map((a) => {
    const row = byAccountRows.find((r) => r.account_id === a.id);
    const income = row ? row.income : 0;
    const expense = row ? row.expense : 0;
    return { ...a, balance: income - expense };
  });

  return {
    income: totals.find((t) => t.type === 'income')?.total || 0,
    expense: totals.find((t) => t.type === 'expense')?.total || 0,
    byCategory,
    balances,
  };
}

export function insertFeedback(userId, username, firstName, text, delivered) {
  const info = db.prepare(`
    INSERT INTO feedback (user_id, username, first_name, text, delivered)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, username || '', firstName || '', text, delivered ? 1 : 0);
  return Number(info.lastInsertRowid);
}
export const markFeedbackDelivered = (id) => db.prepare('UPDATE feedback SET delivered = 1 WHERE id = ?').run(id);
export const listFeedback = () => db.prepare('SELECT * FROM feedback ORDER BY created_at DESC').all();
