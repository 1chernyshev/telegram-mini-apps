const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const el = (id) => document.getElementById(id);
const listEl = el('list');
const sheet = el('sheet');
const form = el('form');
const formError = el('form-error');
const deleteBtn = el('delete-btn');
const saveBtn = el('save-btn');
const customPeriod = el('custom-period');
const customRemind = el('custom-remind');

let state = { items: [], limit: 10 };
let editingId = null;

/* --- Тема --- */

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch {}
}

el('theme-btn').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// Пока пользователь сам не выбрал тему, следуем за темой Telegram.
tg.onEvent('themeChanged', () => {
  let chosen = null;
  try { chosen = localStorage.getItem('theme'); } catch {}
  if (!chosen) document.documentElement.dataset.theme = tg.colorScheme || 'light';
});

/* --- Формат --- */

const money = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';

function plural(n, one, few, many) {
  const mod100 = n % 100;
  if (mod100 > 4 && mod100 < 21) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function periodLabel(months) {
  if (months === 1) return 'мес';
  if (months === 12) return 'год';
  return `${months} ${plural(months, 'мес', 'мес', 'мес')}`;
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const target = new Date(dateStr + 'T12:00:00');
  return Math.round((target - today) / 86400000);
}

function whenText(days) {
  if (days < 0) return 'дата прошла';
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': tg.initData,
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Что-то пошло не так');
  return data;
}

const monthlyCost = (sub) => sub.price / sub.period_months;

/* --- Список --- */

function render() {
  const items = state.items;
  const perMonth = items.reduce((sum, s) => sum + monthlyCost(s), 0);

  el('total-month').textContent = money(Math.round(perMonth));
  el('total-year').textContent = money(Math.round(perMonth * 12));
  el('counter').textContent = `${items.length} из ${state.limit}`;
  el('empty').hidden = items.length > 0;
  el('hint').hidden = items.length === 0;

  listEl.replaceChildren(...items.map((sub) => {
    const days = daysUntil(sub.next_payment);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sub';
    btn.setAttribute('aria-label', `${sub.name}, изменить`);
    btn.addEventListener('click', () => openForm(sub));

    const main = document.createElement('div');
    main.className = 'sub-main';

    const name = document.createElement('div');
    name.className = 'sub-name';
    const nameText = document.createElement('span');
    nameText.className = 'sub-name-text';
    nameText.textContent = sub.name;
    name.append(nameText);
    if (sub.is_trial) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'триал';
      name.append(badge);
    }

    const meta = document.createElement('div');
    meta.className = 'sub-meta';
    const metaParts = [sub.category, sub.payment_method].filter(Boolean);
    // При длинном периоде показываем, во что это обходится в месяц.
    if (sub.period_months > 1) metaParts.push(`≈ ${money(Math.round(monthlyCost(sub)))}/мес`);
    meta.textContent = metaParts.join(' · ');

    main.append(name, meta);

    const right = document.createElement('div');
    right.className = 'sub-right';

    const price = document.createElement('div');
    price.className = 'sub-price';
    price.textContent = `${money(sub.price)}/${periodLabel(sub.period_months)}`;

    const when = document.createElement('div');
    when.className = 'sub-when' + (days <= sub.remind_days ? ' soon' : '');
    when.textContent = whenText(days);

    right.append(price, when);

    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '›';

    btn.append(main, right, chevron);
    return btn;
  }));
}

/* --- Выбор из чипсов с вариантом "свой" (период и напоминание устроены одинаково) --- */

// Пересчитывает дату так же, как сервер переносит просроченные платежи:
// 31 января + 1 месяц = 28/29 февраля, а не 3 марта.
function dateAfterMonths(months) {
  const d = new Date();
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

// onUserChange срабатывает только когда период меняет сам пользователь (клик по чипсу
// или ввод своего числа) — не при программной подстановке значений редактируемой подписки,
// чтобы открытие формы на редактирование не затирало уже сохранённую дату.
function makeChipPicker(containerId, dataKey, customWrap, customInput, onUserChange) {
  const chips = [...el(containerId).querySelectorAll('.chip')];

  function paint(value) {
    const isCustom = value === 'custom';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset[dataKey] === String(value))));
    customWrap.hidden = !isCustom;
  }

  function current() {
    const pressed = chips.find((c) => c.getAttribute('aria-pressed') === 'true');
    if (!pressed) return NaN;
    if (pressed.dataset[dataKey] === 'custom') return Number(customInput.value);
    return Number(pressed.dataset[dataKey]);
  }

  function select(value) {
    paint(value);
    if (value === 'custom') customInput.focus();
    if (onUserChange) onUserChange(current());
  }

  function setValue(value) {
    const preset = chips.some((c) => c.dataset[dataKey] === String(value));
    if (preset) {
      paint(String(value));
    } else {
      customInput.value = value;
      paint('custom');
    }
  }

  chips.forEach((chip) => chip.addEventListener('click', () => select(chip.dataset[dataKey])));
  if (onUserChange) customInput.addEventListener('input', () => onUserChange(current()));

  return { select, setValue, current };
}

const periodPicker = makeChipPicker('period-chips', 'months', customPeriod, form.custom_months, (months) => {
  if (Number.isInteger(months) && months >= 1 && months <= 60) {
    form.next_payment.value = dateAfterMonths(months);
  }
});
const remindPicker = makeChipPicker('remind-chips', 'days', customRemind, form.custom_days);

/* --- Форма --- */

function openForm(sub) {
  editingId = sub ? sub.id : null;
  el('form-title').textContent = sub ? 'Подписка' : 'Новая подписка';
  deleteBtn.hidden = !sub;
  formError.hidden = true;
  form.reset();

  if (sub) {
    form.name.value = sub.name;
    form.price.value = sub.price;
    form.next_payment.value = sub.next_payment;
    form.payment_method.value = sub.payment_method || '';
    form.category.value = sub.category || '';
    form.is_trial.checked = !!sub.is_trial;
    periodPicker.setValue(sub.period_months);
    remindPicker.setValue(sub.remind_days);
  } else {
    periodPicker.select('1'); // выставит дату сам, через onUserChange
    remindPicker.select('2');
  }

  sheet.hidden = false;
  tg.BackButton.show();
}

function closeForm() {
  sheet.hidden = true;
  editingId = null;
  tg.BackButton.hide();
}

async function load() {
  try {
    const data = await api('/api/subscriptions');
    state = data;
    render();
  } catch (e) {
    listEl.replaceChildren();
    el('hint').hidden = true;
    el('empty').hidden = false;
    el('empty').textContent = e.message;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.hidden = true;

  const months = periodPicker.current();
  if (!Number.isInteger(months) || months < 1 || months > 60) {
    formError.textContent = 'Укажите период — целое число от 1 до 60 месяцев';
    formError.hidden = false;
    return;
  }

  const remindDays = remindPicker.current();
  if (!Number.isInteger(remindDays) || remindDays < 0 || remindDays > 30) {
    formError.textContent = 'Напоминание — целое число от 0 до 30 дней';
    formError.hidden = false;
    return;
  }

  saveBtn.disabled = true;
  const payload = {
    name: form.name.value,
    price: Number(form.price.value),
    period_months: months,
    next_payment: form.next_payment.value,
    payment_method: form.payment_method.value,
    category: form.category.value || 'Прочее',
    remind_days: remindDays,
    is_trial: form.is_trial.checked,
  };

  try {
    if (editingId) {
      await api(`/api/subscriptions/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeForm();
    await load();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  } finally {
    saveBtn.disabled = false;
  }
});

function confirmAction(message, onConfirm) {
  if (typeof tg.showConfirm === 'function') {
    try {
      tg.showConfirm(message, (ok) => ok && onConfirm());
      return;
    } catch {
      // старый клиент Telegram — падаем на системный диалог
    }
  }
  if (window.confirm(message)) onConfirm();
}

deleteBtn.addEventListener('click', () => {
  if (!editingId) return;
  confirmAction('Удалить подписку?', async () => {
    try {
      await api(`/api/subscriptions/${editingId}`, { method: 'DELETE' });
      closeForm();
      await load();
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
    }
  });
});

/* --- Тариф --- */

const proSheet = el('pro-sheet');

function openPro() {
  sheet.hidden = true; // на случай если открывали поверх формы
  proSheet.hidden = false;
  tg.BackButton.show();
}

function closePro() {
  proSheet.hidden = true;
  tg.BackButton.hide();
}

el('pro-btn').addEventListener('click', openPro);
el('pro-close-btn').addEventListener('click', closePro);
el('pro-pay-btn').addEventListener('click', () => {
  tg.showAlert('Оплата пока не подключена — скоро добавим.');
});

el('add-btn').addEventListener('click', () => {
  if (state.items.length >= state.limit) {
    openPro();
    return;
  }
  openForm(null);
});

el('close-btn').addEventListener('click', closeForm);
tg.BackButton.onClick(() => {
  if (!proSheet.hidden) return closePro();
  closeForm();
});

load();
