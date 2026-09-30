const tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Тема ---
document.getElementById('theme-btn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});

// --- API-обёртка: всегда шлём подписанный initData, разбираем ошибки единым образом ---
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'X-Telegram-Init-Data': tg ? tg.initData : '', ...(opts.headers || {}) },
    body: opts.body,
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw new Error((data && data.error) || `Ошибка запроса (${res.status})`);
  return data;
}
function apiJson(path, method, body) {
  return api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    if (tg && tg.showConfirm) tg.showConfirm(message, (ok) => resolve(ok));
    else resolve(window.confirm(message));
  });
}

// --- «ИИ составляет» — переиспользуемый визуал ожидания на кнопке ---
const AI_MESSAGES = ['Подбираю упражнения…', 'Проверяю нагрузку и травмобезопасность…', 'Расставляю подходы и отдых…', 'Почти готово…'];
function setAiPending(button, on) {
  if (on) {
    button.dataset.originalLabel = button.dataset.originalLabel || button.textContent;
    button.disabled = true;
    button.classList.add('ai-pending');
    let i = 0;
    button.innerHTML = `<span class="ai-dot"></span>${esc(AI_MESSAGES[0])}`;
    button._aiTimer = setInterval(() => {
      i = (i + 1) % AI_MESSAGES.length;
      button.innerHTML = `<span class="ai-dot"></span>${esc(AI_MESSAGES[i])}`;
    }, 1300);
  } else {
    clearInterval(button._aiTimer);
    button.disabled = false;
    button.classList.remove('ai-pending');
    button.textContent = button.dataset.originalLabel;
  }
}
async function withAiPending(button, task) {
  setAiPending(button, true);
  try { return await task(); } finally { setAiPending(button, false); }
}

// ===================== ТАБ-НАВИГАЦИЯ =====================
const HEADER_TITLES = { 'tab-calendar': 'Календарь', 'tab-workouts': 'Тренировки', 'tab-progress': 'Прогресс', 'tab-schedule': 'Расписание', 'tab-posture': 'Осанка' };
const tabButtons = [...document.querySelectorAll('.tab-btn')];
const tabViews = { 'tab-calendar': document.getElementById('tab-calendar'), 'tab-workouts': document.getElementById('tab-workouts'), 'tab-progress': document.getElementById('tab-progress'), 'tab-schedule': document.getElementById('tab-schedule'), 'tab-posture': document.getElementById('tab-posture') };

function showTab(tabId) {
  tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tabId));
  Object.entries(tabViews).forEach(([id, el]) => { el.hidden = id !== tabId; });
  document.getElementById('header-title').textContent = HEADER_TITLES[tabId];
  if (tabId === 'tab-calendar') loadCalendarMonth();
  if (tabId === 'tab-workouts') showWorkoutsView('view-workouts-list');
  if (tabId === 'tab-progress') loadProgress();
  if (tabId === 'tab-schedule') loadSchedule();
  if (tabId === 'tab-posture') loadPostureHistory();
}
tabButtons.forEach((btn) => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

// Внутренние под-экраны вкладки «Тренировки»
const workoutsViews = ['view-workouts-list', 'view-workouts-new', 'view-workout-detail'].reduce((acc, id) => {
  acc[id] = document.getElementById(id); return acc;
}, {});
function showWorkoutsView(id) {
  Object.entries(workoutsViews).forEach(([vid, el]) => { el.hidden = vid !== id; });
}
document.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => showWorkoutsView(btn.dataset.back));
});

// ===================== КОНСТРУКТОР ТРЕНИРОВКИ =====================
const constructorState = { minutes: null, inventory: [], muscle_groups: [], goal: null, level: null, problems: [] };

function wireSingleChips(groupId, onPick) {
  document.getElementById(groupId).addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    [...chip.parentElement.children].forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    onPick(chip.dataset.value);
  });
}
function wireMultiChips(groupId, onChange) {
  const group = document.getElementById(groupId);
  group.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    chip.classList.toggle('active');
    onChange([...group.querySelectorAll('.chip.active')].map((c) => c.dataset.value));
  });
}

wireSingleChips('minutes-chips', (v) => (constructorState.minutes = v));
wireMultiChips('inventory-chips', (v) => (constructorState.inventory = v));
wireMultiChips('muscle-chips', (v) => (constructorState.muscle_groups = v));
wireSingleChips('goal-chips', (v) => (constructorState.goal = v));
wireSingleChips('level-chips', (v) => (constructorState.level = v));
wireMultiChips('problems-chips', (v) => (constructorState.problems = v));

// Пресеты сочетаний групп мышц — это подсказка, не обязательный выбор: клик
// просто проставляет соответствующие чипы активными, ничего не блокирует.
document.getElementById('muscle-combo-hints').addEventListener('click', (e) => {
  const btn = e.target.closest('.combo-chip');
  if (!btn) return;
  const values = btn.dataset.combo.split(',');
  const group = document.getElementById('muscle-chips');
  [...group.children].forEach((c) => c.classList.toggle('active', values.includes(c.dataset.value)));
  constructorState.muscle_groups = values;
});

document.getElementById('new-workout-btn').addEventListener('click', () => {
  document.getElementById('form-error').hidden = true;
  showWorkoutsView('view-workouts-new');
});

document.getElementById('generate-btn').addEventListener('click', async () => {
  const formError = document.getElementById('form-error');
  formError.hidden = true;
  if (!constructorState.minutes) return showFormError('Выберите время тренировки');
  if (!constructorState.goal) return showFormError('Выберите цель');
  if (!constructorState.level) return showFormError('Выберите уровень подготовки');

  const btn = document.getElementById('generate-btn');
  try {
    const workout = await withAiPending(btn, () => apiJson('/api/generate', 'POST', {
      minutes: Number(constructorState.minutes),
      inventory: constructorState.inventory,
      muscle_groups: constructorState.muscle_groups,
      goal: constructorState.goal,
      level: constructorState.level,
      problems: constructorState.problems,
    }));
    await openWorkoutDetail(workout.id, workout);
    showWorkoutsView('view-workout-detail');
  } catch (e) {
    showFormError(e.message);
  }
});
function showFormError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.hidden = false;
}

// ===================== БИБЛИОТЕКА ТРЕНИРОВОК =====================
async function loadWorkoutsList() {
  const listEl = document.getElementById('workouts-list');
  const emptyEl = document.getElementById('workouts-empty');
  listEl.innerHTML = '<p class="loading">Загружаю…</p>';
  const { items } = await api('/api/workouts');
  emptyEl.hidden = items.length > 0;
  listEl.innerHTML = items.map((w) => `
    <div class="workout-card" data-id="${w.id}">
      <div class="workout-card-title">${esc(w.title)}</div>
      <div class="workout-card-meta">${esc(w.minutes)} мин · ${esc(w.goal)}${w.muscle_groups.length ? ' · ' + esc(w.muscle_groups.join(', ')) : ''} · ${esc(w.exercise_count)} упражнений</div>
    </div>
  `).join('');
  listEl.querySelectorAll('.workout-card').forEach((card) => {
    card.addEventListener('click', async () => {
      await openWorkoutDetail(Number(card.dataset.id));
      showWorkoutsView('view-workout-detail');
    });
  });
}
document.querySelector('.tab-btn[data-tab="tab-workouts"]').addEventListener('click', loadWorkoutsList);

let exerciseCatalog = null;
async function getCatalog() {
  if (!exerciseCatalog) exerciseCatalog = (await api('/api/exercises')).items;
  return exerciseCatalog;
}
function filterCatalogClient(catalog, inventory, problems) {
  return catalog.filter((e) =>
    e.equipment.every((need) => inventory.includes(need)) &&
    !e.avoid_for.some((zone) => problems.includes(zone))
  );
}

let currentWorkout = null; // редактируемая копия открытой тренировки

async function openWorkoutDetail(id, preloaded) {
  currentWorkout = preloaded || (await api(`/api/workouts/${id}`));
  renderWorkoutDetail();
}

function renderWorkoutDetail() {
  const w = currentWorkout;
  const body = document.getElementById('workout-detail-body');
  const exerciseRows = w.exercises.map((ex, i) => `
    <div class="exercise-row" data-idx="${i}">
      <div class="exercise-row-head">
        <span class="exercise-name">${esc(ex.name)}</span>
        <button type="button" class="remove-exercise-btn" data-remove="${i}">Убрать</button>
      </div>
      <div class="exercise-technique">${esc(ex.technique)}</div>
      <div class="exercise-fields">
        <label>Подходы <input type="number" min="1" max="10" data-field="sets" data-idx="${i}" value="${esc(ex.sets)}"></label>
        <label>Повторы <input type="text" class="reps-input" data-field="reps" data-idx="${i}" value="${esc(ex.reps)}"></label>
        <label>Отдых, сек <input type="number" min="0" max="600" step="15" data-field="rest_seconds" data-idx="${i}" value="${esc(ex.rest_seconds)}"></label>
      </div>
    </div>
  `).join('');

  const warmup = (w.warmup || []).map((s) => `<li>${esc(s)}</li>`).join('');
  const cooldown = (w.cooldown || []).map((s) => `<li>${esc(s)}</li>`).join('');

  body.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <label class="text-field">
        <span>Название</span>
        <input type="text" id="wd-title" value="${esc(w.title)}">
      </label>
      <div class="workout-card-meta">${esc(w.minutes)} мин · ${esc(w.goal)} · уровень: ${esc(w.level)}</div>
      ${warmup ? `<div class="wo-section-label" style="margin-top:14px;">Разминка</div><ul class="wo-list">${warmup}</ul>` : ''}
    </div>

    <div id="exercise-rows">${exerciseRows}</div>

    <label class="text-field">
      <span>Добавить упражнение</span>
      <select id="add-exercise-select"></select>
    </label>
    <button type="button" class="secondary wide" id="add-exercise-btn" style="margin-bottom:16px;">+ Добавить</button>

    ${cooldown ? `<div class="card"><div class="wo-section-label">Заминка</div><ul class="wo-list">${cooldown}</ul></div>` : ''}

    <p id="wd-error" class="form-error" hidden></p>
    <button type="button" class="primary wide" id="wd-save-btn">Сохранить изменения</button>

    <div class="ai-edit-row">
      <input type="text" id="wd-ai-instruction" placeholder="Например: болят колени, замени выпады">
      <button type="button" id="wd-ai-btn">✨ Поправить с ИИ</button>
    </div>

    <button type="button" class="secondary wide" id="wd-schedule-btn" style="margin-top:16px;">Добавить в расписание</button>
    <button type="button" class="danger-btn" id="wd-delete-btn" style="margin-top:14px;">Удалить тренировку</button>
  `;

  body.querySelectorAll('input[data-field]').forEach((input) => {
    input.addEventListener('change', () => {
      const idx = Number(input.dataset.idx);
      const field = input.dataset.field;
      currentWorkout.exercises[idx][field] = field === 'reps' ? input.value : Number(input.value);
    });
  });
  body.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentWorkout.exercises.splice(Number(btn.dataset.remove), 1);
      renderWorkoutDetail();
    });
  });

  getCatalog().then((catalog) => {
    const available = filterCatalogClient(catalog, w.inventory, w.problems);
    const select = document.getElementById('add-exercise-select');
    if (!select) return;
    select.innerHTML = available.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  });

  document.getElementById('add-exercise-btn').addEventListener('click', async () => {
    const select = document.getElementById('add-exercise-select');
    const id = Number(select.value);
    const catalog = await getCatalog();
    const ex = catalog.find((e) => e.id === id);
    if (!ex) return;
    currentWorkout.exercises.push({ exercise_id: ex.id, name: ex.name, technique: ex.technique, icon_key: ex.icon_key, sets: 3, reps: '10-12', rest_seconds: 60, note: '' });
    renderWorkoutDetail();
  });

  document.getElementById('wd-save-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('wd-error');
    errEl.hidden = true;
    try {
      const title = document.getElementById('wd-title').value.trim() || w.title;
      const updated = await apiJson(`/api/workouts/${w.id}`, 'PUT', {
        title,
        exercises: currentWorkout.exercises.map((e) => ({ exercise_id: e.exercise_id, sets: e.sets, reps: e.reps, rest_seconds: e.rest_seconds, note: e.note || '' })),
      });
      currentWorkout = updated;
      renderWorkoutDetail();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.hidden = false;
    }
  });

  document.getElementById('wd-ai-btn').addEventListener('click', async () => {
    const input = document.getElementById('wd-ai-instruction');
    const errEl = document.getElementById('wd-error');
    errEl.hidden = true;
    const instruction = input.value.trim();
    if (!instruction) { errEl.textContent = 'Опишите, что поправить'; errEl.hidden = false; return; }
    const btn = document.getElementById('wd-ai-btn');
    try {
      const updated = await withAiPending(btn, () => apiJson(`/api/workouts/${w.id}/ai-edit`, 'POST', { instruction }));
      currentWorkout = updated;
      renderWorkoutDetail();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.hidden = false;
    }
  });

  document.getElementById('wd-schedule-btn').addEventListener('click', () => {
    pendingScheduleWorkoutId = w.id;
    showTab('tab-schedule');
  });

  document.getElementById('wd-delete-btn').addEventListener('click', async () => {
    if (!(await confirmDialog(`Удалить тренировку «${w.title}»?`))) return;
    await api(`/api/workouts/${w.id}`, { method: 'DELETE' });
    showWorkoutsView('view-workouts-list');
    loadWorkoutsList();
  });
}

// ===================== КАЛЕНДАРЬ =====================
const MONTH_NAMES = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const now = new Date();
const calState = { year: now.getFullYear(), month: now.getMonth(), sessions: [], selectedDate: null };

function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }

async function loadCalendarMonth() {
  const { year, month } = calState;
  const from = ymd(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = ymd(year, month, lastDay);
  document.getElementById('cal-month-label').textContent = `${MONTH_NAMES[month]} ${year}`;

  const { items } = await api(`/api/calendar?from=${from}&to=${to}`);
  calState.sessions = items;
  renderCalendarGrid();
  document.getElementById('cal-empty').hidden = items.length > 0;
  if (calState.selectedDate) renderDayDetail(calState.selectedDate);
}

function renderCalendarGrid() {
  const { year, month, sessions } = calState;
  const grid = document.getElementById('cal-grid');
  const firstDay = new Date(year, month, 1);
  // Понедельник = 0 для раскладки сетки (JS getDay(): вс=0..сб=6)
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());

  let html = '';
  for (let i = 0; i < leadingBlanks; i++) html += `<div class="cal-day outside"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = ymd(year, month, d);
    const daySessions = sessions.filter((s) => s.date === dateStr);
    const dots = daySessions.slice(0, 2).map((s) => `<span class="cal-dot ${s.status === 'done' ? 'done' : ''}"></span>`).join('');
    const classes = ['cal-day'];
    if (dateStr === todayStr) classes.push('today');
    if (dateStr === calState.selectedDate) classes.push('selected');
    html += `<button type="button" class="${classes.join(' ')}" data-date="${dateStr}">${d}${dots ? `<span style="display:flex;gap:3px;">${dots}</span>` : ''}</button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-day[data-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      calState.selectedDate = btn.dataset.date;
      renderCalendarGrid();
      renderDayDetail(btn.dataset.date);
    });
  });
}

function renderDayDetail(dateStr) {
  const panel = document.getElementById('day-detail');
  const daySessions = calState.sessions.filter((s) => s.date === dateStr);
  const d = new Date(dateStr + 'T00:00:00');
  document.getElementById('day-detail-date').textContent = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });

  const body = document.getElementById('day-detail-body');
  if (daySessions.length === 0) {
    body.innerHTML = `<p class="empty-state" style="padding:12px 0;">На этот день ничего не запланировано.</p>`;
  } else {
    body.innerHTML = daySessions.map((s) => `
      <div class="day-session" data-id="${s.id}">
        <div class="day-session-title">${esc(s.workout_title)}</div>
        <div class="status-row">
          <button type="button" class="status-pill ${s.status === 'planned' ? 'active' : ''}" data-status="planned">Запланировано</button>
          <button type="button" class="status-pill ${s.status === 'done' ? 'active done' : ''}" data-status="done">Готово</button>
          <button type="button" class="status-pill ${s.status === 'skipped' ? 'active skipped' : ''}" data-status="skipped">Пропущено</button>
        </div>
        <div class="water-row">
          <span class="water-label">💧 Вода за тренировку</span>
          <button type="button" class="water-btn" data-water="-250">−</button>
          <span class="water-val">${s.water_ml} мл</span>
          <button type="button" class="water-btn" data-water="250">+</button>
        </div>
      </div>
    `).join('');

    body.querySelectorAll('.status-pill').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sessionEl = btn.closest('.day-session');
        const id = Number(sessionEl.dataset.id);
        const updated = await apiJson(`/api/sessions/${id}`, 'PATCH', { status: btn.dataset.status });
        const s = calState.sessions.find((x) => x.id === id);
        s.status = updated.status;
        renderCalendarGrid();
        renderDayDetail(dateStr);
      });
    });
    body.querySelectorAll('[data-water]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sessionEl = btn.closest('.day-session');
        const id = Number(sessionEl.dataset.id);
        const s = calState.sessions.find((x) => x.id === id);
        const next = Math.max(0, s.water_ml + Number(btn.dataset.water));
        const updated = await apiJson(`/api/sessions/${id}`, 'PATCH', { water_ml: next });
        s.water_ml = updated.water_ml;
        renderDayDetail(dateStr);
      });
    });
  }
  panel.hidden = false;
}

document.getElementById('day-detail-close').addEventListener('click', () => {
  calState.selectedDate = null;
  document.getElementById('day-detail').hidden = true;
  renderCalendarGrid();
});
document.getElementById('cal-prev').addEventListener('click', () => {
  calState.month -= 1;
  if (calState.month < 0) { calState.month = 11; calState.year -= 1; }
  calState.selectedDate = null;
  document.getElementById('day-detail').hidden = true;
  loadCalendarMonth();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calState.month += 1;
  if (calState.month > 11) { calState.month = 0; calState.year += 1; }
  calState.selectedDate = null;
  document.getElementById('day-detail').hidden = true;
  loadCalendarMonth();
});

// ===================== РАСПИСАНИЕ =====================
let pendingScheduleWorkoutId = null;
const scheduleState = { weekdays: [] };
wireMultiChips('weekday-chips', (v) => (scheduleState.weekdays = v.map(Number)));

async function loadSchedule() {
  const select = document.getElementById('schedule-workout');
  const { items: workouts } = await api('/api/workouts');
  select.innerHTML = workouts.map((w) => `<option value="${w.id}">${esc(w.title)}</option>`).join('');
  if (pendingScheduleWorkoutId) { select.value = String(pendingScheduleWorkoutId); pendingScheduleWorkoutId = null; }

  const listEl = document.getElementById('schedule-list');
  const emptyEl = document.getElementById('schedule-empty');
  const { items } = await api('/api/schedule');
  emptyEl.hidden = items.length > 0;
  const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  listEl.innerHTML = items.map((s) => `
    <div class="schedule-card">
      <div>
        <div class="schedule-title">${esc(s.workout_title)}</div>
        <div class="schedule-meta">${s.weekdays.slice().sort().map((d) => WD[d]).join(', ')} · ${esc(s.time)}</div>
      </div>
      <button type="button" class="danger-btn" data-del="${s.id}">Удалить</button>
    </div>
  `).join('');
  listEl.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/schedule/${btn.dataset.del}`, { method: 'DELETE' });
      loadSchedule();
    });
  });
}

document.getElementById('schedule-save-btn').addEventListener('click', async () => {
  const errEl = document.getElementById('schedule-error');
  errEl.hidden = true;
  const workoutId = Number(document.getElementById('schedule-workout').value);
  const time = document.getElementById('schedule-time').value || '18:00';
  if (!workoutId) { errEl.textContent = 'Сначала создайте хотя бы одну тренировку'; errEl.hidden = false; return; }
  if (scheduleState.weekdays.length === 0) { errEl.textContent = 'Выберите хотя бы один день недели'; errEl.hidden = false; return; }
  try {
    await apiJson('/api/schedule', 'POST', { workout_id: workoutId, weekdays: scheduleState.weekdays, time });
    document.querySelectorAll('#weekday-chips .chip').forEach((c) => c.classList.remove('active'));
    scheduleState.weekdays = [];
    loadSchedule();
    loadCalendarMonth();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.hidden = false;
  }
});

// ===================== ПРОГРЕСС =====================
document.getElementById('progress-date').value = new Date().toISOString().slice(0, 10);

async function loadProgress() {
  const listEl = document.getElementById('progress-list');
  const emptyEl = document.getElementById('progress-empty');
  listEl.innerHTML = '<p class="loading">Загружаю…</p>';
  const { items } = await api('/api/progress');
  emptyEl.hidden = items.length > 0;
  listEl.innerHTML = items.map((p) => `
    <div class="progress-card" data-id="${p.id}">
      ${p.has_photo ? `<img class="progress-thumb" data-photo="${p.id}" alt="">` : `<div class="progress-thumb"></div>`}
      <div class="progress-info">
        <div class="progress-date">${esc(p.date)}</div>
        ${p.weight_kg ? `<div class="progress-weight">${esc(p.weight_kg)} кг</div>` : ''}
        ${p.note ? `<div class="progress-note">${esc(p.note)}</div>` : ''}
      </div>
      <button type="button" class="danger-btn" data-del="${p.id}">✕</button>
    </div>
  `).join('');

  listEl.querySelectorAll('img[data-photo]').forEach(async (img) => {
    try {
      const res = await fetch(`/api/progress/${img.dataset.photo}/photo`, { headers: { 'X-Telegram-Init-Data': tg ? tg.initData : '' } });
      if (!res.ok) return;
      img.src = URL.createObjectURL(await res.blob());
    } catch (e) { /* фото не критично для остального списка */ }
  });
  listEl.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!(await confirmDialog('Удалить запись?'))) return;
      await api(`/api/progress/${btn.dataset.del}`, { method: 'DELETE' });
      loadProgress();
    });
  });
}

document.getElementById('progress-save-btn').addEventListener('click', async () => {
  const errEl = document.getElementById('progress-error');
  errEl.hidden = true;
  const date = document.getElementById('progress-date').value;
  const weight = document.getElementById('progress-weight').value;
  const note = document.getElementById('progress-note').value;
  const photoFile = document.getElementById('progress-photo').files[0];

  const form = new FormData();
  form.append('date', date);
  if (weight) form.append('weight_kg', weight);
  if (note) form.append('note', note);
  if (photoFile) form.append('photo', photoFile);

  try {
    await api('/api/progress', { method: 'POST', body: form });
    document.getElementById('progress-weight').value = '';
    document.getElementById('progress-note').value = '';
    document.getElementById('progress-photo').value = '';
    loadProgress();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.hidden = false;
  }
});

// ===================== ОСАНКА =====================
function confidencePill(status) {
  return status.visible_signs
    ? `<span class="confidence-pill signs">Есть признаки · ${esc(status.confidence)}</span>`
    : `<span class="confidence-pill clear">Не заметно</span>`;
}

// Кнопка «Открыть» для одного из вариантов коррекции — кифоз и лордоз
// лечатся разными упражнениями, поэтому это два независимых предложения,
// делать можно любое или оба.
function correctionOfferHtml(label, workout, btnId) {
  if (!workout) return '';
  return `
    <div class="correction-offer">
      <div class="correction-offer-label">${esc(label)}</div>
      <div class="workout-card-meta" style="margin-bottom:10px;">${esc(workout.title)} · ${esc(workout.exercises.length)} упражнений</div>
      <button type="button" class="secondary wide" id="${btnId}">Открыть в «Тренировках»</button>
    </div>
  `;
}

function renderPostureResult(result) {
  const el = document.getElementById('posture-result');
  const hasCorrection = result.workout_kyphosis || result.workout_lordosis;
  const correctionsHtml = hasCorrection ? `
    <div class="card" style="margin-top:4px;">
      <h3 class="card-title">Варианты коррекции</h3>
      ${correctionOfferHtml('Для кифоза', result.workout_kyphosis, 'posture-open-kyphosis-btn')}
      ${correctionOfferHtml('Для лордоза', result.workout_lordosis, 'posture-open-lordosis-btn')}
    </div>
  ` : `<p class="empty-state">Явных визуальных признаков не найдено — отдельная коррекция не потребовалась.</p>`;

  // Кифоз и лордоз — один общий результат анализа одного и того же фото,
  // поэтому это один блок с двумя секциями внутри, а не две разные карточки.
  el.innerHTML = `
    <div class="verdict-card">
      <div class="verdict-row"><span class="verdict-name">Кифоз (сутулость)</span>${confidencePill(result.kyphosis)}</div>
      <div class="verdict-note">${esc(result.kyphosis.note)}</div>
      <div class="verdict-divider"></div>
      <div class="verdict-row"><span class="verdict-name">Лордоз / наклон таза</span>${confidencePill(result.lordosis)}</div>
      <div class="verdict-note">${esc(result.lordosis.note)}</div>
      ${result.general_note ? `<p class="posture-intro" style="margin-top:12px;">${esc(result.general_note)}</p>` : ''}
      <p class="posture-disclaimer" style="margin:8px 0 0;">${esc(result.disclaimer)}</p>
    </div>
    ${correctionsHtml}
  `;

  const openKyphosisBtn = document.getElementById('posture-open-kyphosis-btn');
  if (openKyphosisBtn) {
    openKyphosisBtn.addEventListener('click', async () => {
      document.querySelector('.tab-btn[data-tab="tab-workouts"]').click();
      await openWorkoutDetail(result.workout_kyphosis.id, result.workout_kyphosis);
      showWorkoutsView('view-workout-detail');
    });
  }
  const openLordosisBtn = document.getElementById('posture-open-lordosis-btn');
  if (openLordosisBtn) {
    openLordosisBtn.addEventListener('click', async () => {
      document.querySelector('.tab-btn[data-tab="tab-workouts"]').click();
      await openWorkoutDetail(result.workout_lordosis.id, result.workout_lordosis);
      showWorkoutsView('view-workout-detail');
    });
  }
}

async function loadPostureHistory() {
  const el = document.getElementById('posture-history');
  const { items } = await api('/api/posture');
  if (items.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = `<h3 class="card-title" style="margin-top:8px;">История проверок</h3>` + items.map((p) => `
    <div class="history-card">
      ${p.has_photo ? `<img class="history-thumb" data-posture-photo="${p.id}" alt="">` : `<div class="history-thumb"></div>`}
      <div class="history-info">
        <div class="history-date">${esc(p.date)}</div>
        <div class="history-tags">${[p.kyphosis.visible_signs && 'кифоз', p.lordosis.visible_signs && 'лордоз'].filter(Boolean).join(', ') || 'без явных признаков'}</div>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('img[data-posture-photo]').forEach(async (img) => {
    try {
      const res = await fetch(`/api/posture/${img.dataset.posturePhoto}/photo`, { headers: { 'X-Telegram-Init-Data': tg ? tg.initData : '' } });
      if (!res.ok) return;
      img.src = URL.createObjectURL(await res.blob());
    } catch (e) { /* не критично */ }
  });
}

document.getElementById('posture-analyze-btn').addEventListener('click', async () => {
  const errEl = document.getElementById('posture-error');
  errEl.hidden = true;
  const file = document.getElementById('posture-photo').files[0];
  if (!file) { errEl.textContent = 'Приложите фото'; errEl.hidden = false; return; }

  const form = new FormData();
  form.append('photo', file);

  const btn = document.getElementById('posture-analyze-btn');
  try {
    const result = await withAiPending(btn, () => api('/api/posture/check', { method: 'POST', body: form }));
    renderPostureResult(result);
    document.getElementById('posture-photo').value = '';
    loadPostureHistory();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.hidden = false;
  }
});

// --- Старт ---
showTab('tab-calendar');
