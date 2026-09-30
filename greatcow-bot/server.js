require("dotenv").config();
const express = require("express");
const crypto = require("node:crypto");
const path = require("node:path");

const { MENU } = require("./menu-data");
const { insertOrder } = require("./db");
const { bot, notifyNewOrder } = require("./bot");

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const DEV_USER_ID = process.env.DEV_USER_ID; // только для локальной разработки, не задаётся на Railway

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Проверка Telegram WebApp initData ---
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

function resolveUser(req) {
  const initData = req.headers["x-telegram-init-data"];
  const verified = verifyInitData(initData);
  if (verified) return verified;

  // Локальный dev-байпас: работает только если DEV_USER_ID задан в .env
  if (DEV_USER_ID) {
    return { id: DEV_USER_ID, username: "dev_user" };
  }
  return null;
}

// --- API ---
app.get("/api/menu", (req, res) => {
  res.json({ menu: MENU });
});

app.post("/api/order", (req, res) => {
  const user = resolveUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { items, customerName, phone, fulfillment, address, comment } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "empty_cart" });
  }
  if (!customerName || !phone) {
    return res.status(400).json({ error: "missing_contact" });
  }
  if (fulfillment === "delivery" && !address) {
    return res.status(400).json({ error: "missing_address" });
  }

  // пересчитываем сумму на сервере по актуальным ценам меню — фронту не доверяем
  const priceById = new Map();
  for (const cat of MENU) {
    for (const it of cat.items) priceById.set(it.id, it);
  }

  const resolvedItems = [];
  let total = 0;
  for (const line of items) {
    const menuItem = priceById.get(line.id);
    if (!menuItem || !Number.isInteger(line.qty) || line.qty <= 0) {
      return res.status(400).json({ error: "invalid_item", id: line.id });
    }
    resolvedItems.push({ id: menuItem.id, name: menuItem.name, price: menuItem.price, qty: line.qty });
    total += menuItem.price * line.qty;
  }

  const order = {
    tgUserId: user.id,
    tgUsername: user.username,
    customerName,
    phone,
    fulfillment: fulfillment === "delivery" ? "delivery" : "pickup",
    address: fulfillment === "delivery" ? address : null,
    comment,
    items: resolvedItems,
    total,
  };

  const orderId = insertOrder(order);
  notifyNewOrder(orderId, order);

  res.json({ orderId, total });
});

app.listen(PORT, () => {
  console.log(`GreatCow server запущен на порту ${PORT}`);
});

module.exports = { app };
