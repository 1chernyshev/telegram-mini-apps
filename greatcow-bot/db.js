const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "greatcow.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_user_id TEXT,
    tg_username TEXT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    fulfillment TEXT NOT NULL,          -- 'pickup' | 'delivery'
    address TEXT,
    comment TEXT,
    items_json TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'confirmed' | 'done' | 'cancelled'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_user_id TEXT,
    tg_username TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function insertOrder(order) {
  const stmt = db.prepare(`
    INSERT INTO orders (tg_user_id, tg_username, customer_name, phone, fulfillment, address, comment, items_json, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    order.tgUserId ?? null,
    order.tgUsername ?? null,
    order.customerName,
    order.phone,
    order.fulfillment,
    order.address ?? null,
    order.comment ?? null,
    JSON.stringify(order.items),
    order.total
  );
  return Number(result.lastInsertRowid);
}

function insertFeedback({ tgUserId, tgUsername, message }) {
  const stmt = db.prepare(
    `INSERT INTO feedback (tg_user_id, tg_username, message) VALUES (?, ?, ?)`
  );
  const result = stmt.run(tgUserId ?? null, tgUsername ?? null, message);
  return Number(result.lastInsertRowid);
}

function listRecentFeedback(limit = 20) {
  const stmt = db.prepare(
    `SELECT * FROM feedback ORDER BY id DESC LIMIT ?`
  );
  return stmt.all(limit);
}

function getOrder(id) {
  const stmt = db.prepare(`SELECT * FROM orders WHERE id = ?`);
  return stmt.get(id);
}

module.exports = {
  db,
  insertOrder,
  insertFeedback,
  listRecentFeedback,
  getOrder,
};
