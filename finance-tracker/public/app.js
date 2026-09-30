// ===== Мои финансы — фронтенд =====

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

// ---------- справочники ----------

const CURRENCIES = [
  { code: 'RUB', symbol: '₽' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'CNY', symbol: '¥' },
  { code: 'MXN', symbol: '$' },
];

const LANGUAGES = [
  { code: 'ru', flag: '🇷🇺', native: 'Русский' },
  { code: 'en', flag: '🇬🇧', native: 'English' },
  { code: 'de', flag: '🇩🇪', native: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', native: 'Français' },
  { code: 'es', flag: '🇪🇸', native: 'Español' },
  { code: 'zh', flag: '🇨🇳', native: '中文' },
  { code: 'ar', flag: '🇸🇦', native: 'العربية' },
];

const LOCALE_MAP = {
  ru: 'ru-RU', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', zh: 'zh-CN', ar: 'ar-SA-u-nu-latn',
};

const ACCOUNT_ICONS = ['💳', '🏦', '💵', '🪙', '💎', '📱', '🧾', '👛'];
const CATEGORY_ICONS = ['🍔', '🚗', '🏠', '🛍️', '💊', '🎬', '📚', '✈️', '🔁', '📦', '💼', '💻', '🎁', '📈', '↩️', '💰',
  '⚽', '🎮', '🐾', '👶', '🎓', '🧾', '☕', '🍺', '🎵', '🔧', '🎨', '📦'];
const COLOR_PALETTE = ['#6C5CE7', '#00C2FF', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#3B82F6'];

const MONTH_NAMES = {
  ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  de: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
  fr: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  zh: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
  ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
};

const I18N = {
  ru: {
    navHome: 'Главная', navTransactions: 'Операции', navAnalytics: 'Аналитика', navSettings: 'Настройки',
    totalBalance: 'Общий баланс', income: 'Доход', expense: 'Расход', accounts: 'Счета',
    recentTransactions: 'Последние операции', seeAll: 'Все →', noTransactions: 'Пока нет операций',
    all: 'Все', noData: 'Нет данных',
    appearance: 'Оформление', themeSystem: 'Как на устройстве', themeLight: 'Светлая', themeDark: 'Тёмная',
    language: 'Язык', currency: 'Валюта', categories: 'Категории', add: '+ Добавить', showArchived: 'Показать архивные',
    footerNote: 'Мои финансы · часть портфолио Mini App',
    addTransaction: 'Новая операция', editTransaction: 'Операция', addAccount: 'Новый счёт', editAccount: 'Счёт',
    addCategory: 'Новая категория', editCategory: 'Категория',
    amount: 'Сумма', date: 'Дата', note: 'Заметка', notePlaceholder: 'Необязательно',
    category: 'Категория', account: 'Счёт', accountType: 'Тип счёта',
    accountName: 'Название', accountNamePlaceholder: 'Например, Тинькофф',
    bankName: 'Банк', bankNamePlaceholder: 'Например, Т-Банк',
    categoryName: 'Название', categoryNamePlaceholder: 'Название категории',
    icon: 'Иконка', color: 'Цвет',
    typeCard: 'Карта', typeCash: 'Наличные', typeCrypto: 'Крипта',
    save: 'Сохранить', cancel: 'Отмена', delete: 'Удалить', archive: 'Архивировать', restore: 'Восстановить',
    nameRequired: 'Укажите название', amountInvalid: 'Введите сумму больше нуля',
    selectCategory: 'Выберите категорию', selectAccount: 'Выберите счёт',
    savedOk: 'Сохранено', deletedOk: 'Удалено', archivedOk: 'Архивировано', restoredOk: 'Восстановлено',
    confirmDeleteTransaction: 'Удалить операцию?', confirmArchiveAccount: 'Архивировать счёт?', confirmArchiveCategory: 'Архивировать категорию?',
    loadError: 'Не удалось загрузить данные', authError: 'Ошибка авторизации через Telegram',
    today: 'Сегодня', yesterday: 'Вчера',
    cat_food: 'Еда', cat_transport: 'Транспорт', cat_home: 'Дом', cat_shopping: 'Покупки', cat_health: 'Здоровье',
    cat_entertainment: 'Развлечения', cat_education: 'Образование', cat_travel: 'Путешествия', cat_subscriptions: 'Подписки',
    cat_other_expense: 'Другое', cat_salary: 'Зарплата', cat_freelance: 'Фриланс', cat_gift: 'Подарки',
    cat_investment: 'Инвестиции', cat_refund: 'Возврат', cat_other_income: 'Другое',
    account_cash: 'Наличные',
  },
  en: {
    navHome: 'Home', navTransactions: 'Transactions', navAnalytics: 'Analytics', navSettings: 'Settings',
    totalBalance: 'Total balance', income: 'Income', expense: 'Expense', accounts: 'Accounts',
    recentTransactions: 'Recent transactions', seeAll: 'All →', noTransactions: 'No transactions yet',
    all: 'All', noData: 'No data',
    appearance: 'Appearance', themeSystem: 'System', themeLight: 'Light', themeDark: 'Dark',
    language: 'Language', currency: 'Currency', categories: 'Categories', add: '+ Add', showArchived: 'Show archived',
    footerNote: 'My Finances · part of a Mini App portfolio',
    addTransaction: 'New transaction', editTransaction: 'Transaction', addAccount: 'New account', editAccount: 'Account',
    addCategory: 'New category', editCategory: 'Category',
    amount: 'Amount', date: 'Date', note: 'Note', notePlaceholder: 'Optional',
    category: 'Category', account: 'Account', accountType: 'Account type',
    accountName: 'Name', accountNamePlaceholder: 'e.g. Chase',
    bankName: 'Bank', bankNamePlaceholder: 'e.g. Chase Bank',
    categoryName: 'Name', categoryNamePlaceholder: 'Category name',
    icon: 'Icon', color: 'Color',
    typeCard: 'Card', typeCash: 'Cash', typeCrypto: 'Crypto',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', archive: 'Archive', restore: 'Restore',
    nameRequired: 'Enter a name', amountInvalid: 'Enter an amount greater than zero',
    selectCategory: 'Choose a category', selectAccount: 'Choose an account',
    savedOk: 'Saved', deletedOk: 'Deleted', archivedOk: 'Archived', restoredOk: 'Restored',
    confirmDeleteTransaction: 'Delete this transaction?', confirmArchiveAccount: 'Archive this account?', confirmArchiveCategory: 'Archive this category?',
    loadError: 'Failed to load data', authError: 'Telegram authorization failed',
    today: 'Today', yesterday: 'Yesterday',
    cat_food: 'Food', cat_transport: 'Transport', cat_home: 'Home', cat_shopping: 'Shopping', cat_health: 'Health',
    cat_entertainment: 'Entertainment', cat_education: 'Education', cat_travel: 'Travel', cat_subscriptions: 'Subscriptions',
    cat_other_expense: 'Other', cat_salary: 'Salary', cat_freelance: 'Freelance', cat_gift: 'Gifts',
    cat_investment: 'Investments', cat_refund: 'Refund', cat_other_income: 'Other',
    account_cash: 'Cash',
  },
  de: {
    navHome: 'Start', navTransactions: 'Buchungen', navAnalytics: 'Analyse', navSettings: 'Einstellungen',
    totalBalance: 'Gesamtsaldo', income: 'Einnahmen', expense: 'Ausgaben', accounts: 'Konten',
    recentTransactions: 'Letzte Buchungen', seeAll: 'Alle →', noTransactions: 'Noch keine Buchungen',
    all: 'Alle', noData: 'Keine Daten',
    appearance: 'Erscheinungsbild', themeSystem: 'Systemeinstellung', themeLight: 'Hell', themeDark: 'Dunkel',
    language: 'Sprache', currency: 'Währung', categories: 'Kategorien', add: '+ Hinzufügen', showArchived: 'Archivierte anzeigen',
    footerNote: 'Meine Finanzen · Teil eines Mini-App-Portfolios',
    addTransaction: 'Neue Buchung', editTransaction: 'Buchung', addAccount: 'Neues Konto', editAccount: 'Konto',
    addCategory: 'Neue Kategorie', editCategory: 'Kategorie',
    amount: 'Betrag', date: 'Datum', note: 'Notiz', notePlaceholder: 'Optional',
    category: 'Kategorie', account: 'Konto', accountType: 'Kontotyp',
    accountName: 'Name', accountNamePlaceholder: 'z. B. Sparkasse',
    bankName: 'Bank', bankNamePlaceholder: 'z. B. Deutsche Bank',
    categoryName: 'Name', categoryNamePlaceholder: 'Kategoriename',
    icon: 'Symbol', color: 'Farbe',
    typeCard: 'Karte', typeCash: 'Bargeld', typeCrypto: 'Krypto',
    save: 'Speichern', cancel: 'Abbrechen', delete: 'Löschen', archive: 'Archivieren', restore: 'Wiederherstellen',
    nameRequired: 'Namen eingeben', amountInvalid: 'Betrag muss größer als null sein',
    selectCategory: 'Kategorie wählen', selectAccount: 'Konto wählen',
    savedOk: 'Gespeichert', deletedOk: 'Gelöscht', archivedOk: 'Archiviert', restoredOk: 'Wiederhergestellt',
    confirmDeleteTransaction: 'Buchung löschen?', confirmArchiveAccount: 'Konto archivieren?', confirmArchiveCategory: 'Kategorie archivieren?',
    loadError: 'Daten konnten nicht geladen werden', authError: 'Telegram-Authentifizierung fehlgeschlagen',
    today: 'Heute', yesterday: 'Gestern',
    cat_food: 'Essen', cat_transport: 'Transport', cat_home: 'Wohnen', cat_shopping: 'Einkaufen', cat_health: 'Gesundheit',
    cat_entertainment: 'Unterhaltung', cat_education: 'Bildung', cat_travel: 'Reisen', cat_subscriptions: 'Abos',
    cat_other_expense: 'Sonstiges', cat_salary: 'Gehalt', cat_freelance: 'Freelance', cat_gift: 'Geschenke',
    cat_investment: 'Investitionen', cat_refund: 'Erstattung', cat_other_income: 'Sonstiges',
    account_cash: 'Bargeld',
  },
  fr: {
    navHome: 'Accueil', navTransactions: 'Opérations', navAnalytics: 'Analyse', navSettings: 'Réglages',
    totalBalance: 'Solde total', income: 'Revenus', expense: 'Dépenses', accounts: 'Comptes',
    recentTransactions: 'Opérations récentes', seeAll: 'Tout →', noTransactions: 'Aucune opération',
    all: 'Tout', noData: 'Aucune donnée',
    appearance: 'Apparence', themeSystem: 'Comme l\'appareil', themeLight: 'Clair', themeDark: 'Sombre',
    language: 'Langue', currency: 'Devise', categories: 'Catégories', add: '+ Ajouter', showArchived: 'Afficher les archives',
    footerNote: 'Mes Finances · portfolio de Mini App',
    addTransaction: 'Nouvelle opération', editTransaction: 'Opération', addAccount: 'Nouveau compte', editAccount: 'Compte',
    addCategory: 'Nouvelle catégorie', editCategory: 'Catégorie',
    amount: 'Montant', date: 'Date', note: 'Note', notePlaceholder: 'Optionnel',
    category: 'Catégorie', account: 'Compte', accountType: 'Type de compte',
    accountName: 'Nom', accountNamePlaceholder: 'Ex. BNP Paribas',
    bankName: 'Banque', bankNamePlaceholder: 'Ex. BNP Paribas',
    categoryName: 'Nom', categoryNamePlaceholder: 'Nom de catégorie',
    icon: 'Icône', color: 'Couleur',
    typeCard: 'Carte', typeCash: 'Espèces', typeCrypto: 'Crypto',
    save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', archive: 'Archiver', restore: 'Restaurer',
    nameRequired: 'Indiquez un nom', amountInvalid: 'Saisissez un montant supérieur à zéro',
    selectCategory: 'Choisissez une catégorie', selectAccount: 'Choisissez un compte',
    savedOk: 'Enregistré', deletedOk: 'Supprimé', archivedOk: 'Archivé', restoredOk: 'Restauré',
    confirmDeleteTransaction: 'Supprimer cette opération ?', confirmArchiveAccount: 'Archiver ce compte ?', confirmArchiveCategory: 'Archiver cette catégorie ?',
    loadError: 'Échec du chargement des données', authError: 'Échec de l\'authentification Telegram',
    today: 'Aujourd\'hui', yesterday: 'Hier',
    cat_food: 'Alimentation', cat_transport: 'Transport', cat_home: 'Maison', cat_shopping: 'Achats', cat_health: 'Santé',
    cat_entertainment: 'Loisirs', cat_education: 'Éducation', cat_travel: 'Voyages', cat_subscriptions: 'Abonnements',
    cat_other_expense: 'Autre', cat_salary: 'Salaire', cat_freelance: 'Freelance', cat_gift: 'Cadeaux',
    cat_investment: 'Investissements', cat_refund: 'Remboursement', cat_other_income: 'Autre',
    account_cash: 'Espèces',
  },
  es: {
    navHome: 'Inicio', navTransactions: 'Movimientos', navAnalytics: 'Análisis', navSettings: 'Ajustes',
    totalBalance: 'Saldo total', income: 'Ingresos', expense: 'Gastos', accounts: 'Cuentas',
    recentTransactions: 'Movimientos recientes', seeAll: 'Todos →', noTransactions: 'Aún no hay movimientos',
    all: 'Todos', noData: 'Sin datos',
    appearance: 'Apariencia', themeSystem: 'Como el dispositivo', themeLight: 'Claro', themeDark: 'Oscuro',
    language: 'Idioma', currency: 'Moneda', categories: 'Categorías', add: '+ Añadir', showArchived: 'Mostrar archivados',
    footerNote: 'Mis Finanzas · parte de un portafolio de Mini Apps',
    addTransaction: 'Nuevo movimiento', editTransaction: 'Movimiento', addAccount: 'Nueva cuenta', editAccount: 'Cuenta',
    addCategory: 'Nueva categoría', editCategory: 'Categoría',
    amount: 'Importe', date: 'Fecha', note: 'Nota', notePlaceholder: 'Opcional',
    category: 'Categoría', account: 'Cuenta', accountType: 'Tipo de cuenta',
    accountName: 'Nombre', accountNamePlaceholder: 'Ej. BBVA',
    bankName: 'Banco', bankNamePlaceholder: 'Ej. BBVA',
    categoryName: 'Nombre', categoryNamePlaceholder: 'Nombre de categoría',
    icon: 'Icono', color: 'Color',
    typeCard: 'Tarjeta', typeCash: 'Efectivo', typeCrypto: 'Cripto',
    save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', archive: 'Archivar', restore: 'Restaurar',
    nameRequired: 'Indica un nombre', amountInvalid: 'Introduce un importe mayor que cero',
    selectCategory: 'Elige una categoría', selectAccount: 'Elige una cuenta',
    savedOk: 'Guardado', deletedOk: 'Eliminado', archivedOk: 'Archivado', restoredOk: 'Restaurado',
    confirmDeleteTransaction: '¿Eliminar este movimiento?', confirmArchiveAccount: '¿Archivar esta cuenta?', confirmArchiveCategory: '¿Archivar esta categoría?',
    loadError: 'No se pudieron cargar los datos', authError: 'Fallo de autenticación con Telegram',
    today: 'Hoy', yesterday: 'Ayer',
    cat_food: 'Comida', cat_transport: 'Transporte', cat_home: 'Hogar', cat_shopping: 'Compras', cat_health: 'Salud',
    cat_entertainment: 'Ocio', cat_education: 'Educación', cat_travel: 'Viajes', cat_subscriptions: 'Suscripciones',
    cat_other_expense: 'Otro', cat_salary: 'Salario', cat_freelance: 'Freelance', cat_gift: 'Regalos',
    cat_investment: 'Inversiones', cat_refund: 'Reembolso', cat_other_income: 'Otro',
    account_cash: 'Efectivo',
  },
  zh: {
    navHome: '首页', navTransactions: '账单', navAnalytics: '分析', navSettings: '设置',
    totalBalance: '总余额', income: '收入', expense: '支出', accounts: '账户',
    recentTransactions: '最近账单', seeAll: '全部 →', noTransactions: '暂无账单',
    all: '全部', noData: '暂无数据',
    appearance: '外观', themeSystem: '跟随系统', themeLight: '浅色', themeDark: '深色',
    language: '语言', currency: '货币', categories: '分类', add: '+ 添加', showArchived: '显示已归档',
    footerNote: '我的财务 · Mini App 作品集之一',
    addTransaction: '新增账单', editTransaction: '账单', addAccount: '新增账户', editAccount: '账户',
    addCategory: '新增分类', editCategory: '分类',
    amount: '金额', date: '日期', note: '备注', notePlaceholder: '可选',
    category: '分类', account: '账户', accountType: '账户类型',
    accountName: '名称', accountNamePlaceholder: '例如：招商银行',
    bankName: '银行', bankNamePlaceholder: '例如：招商银行',
    categoryName: '名称', categoryNamePlaceholder: '分类名称',
    icon: '图标', color: '颜色',
    typeCard: '银行卡', typeCash: '现金', typeCrypto: '加密货币',
    save: '保存', cancel: '取消', delete: '删除', archive: '归档', restore: '恢复',
    nameRequired: '请输入名称', amountInvalid: '请输入大于零的金额',
    selectCategory: '请选择分类', selectAccount: '请选择账户',
    savedOk: '已保存', deletedOk: '已删除', archivedOk: '已归档', restoredOk: '已恢复',
    confirmDeleteTransaction: '删除这笔账单？', confirmArchiveAccount: '归档该账户？', confirmArchiveCategory: '归档该分类？',
    loadError: '数据加载失败', authError: 'Telegram 身份验证失败',
    today: '今天', yesterday: '昨天',
    cat_food: '餐饮', cat_transport: '交通', cat_home: '住房', cat_shopping: '购物', cat_health: '医疗',
    cat_entertainment: '娱乐', cat_education: '教育', cat_travel: '旅行', cat_subscriptions: '订阅',
    cat_other_expense: '其他', cat_salary: '工资', cat_freelance: '自由职业', cat_gift: '礼物',
    cat_investment: '投资', cat_refund: '退款', cat_other_income: '其他',
    account_cash: '现金',
  },
  ar: {
    navHome: 'الرئيسية', navTransactions: 'العمليات', navAnalytics: 'التحليلات', navSettings: 'الإعدادات',
    totalBalance: 'الرصيد الإجمالي', income: 'الدخل', expense: 'المصروفات', accounts: 'الحسابات',
    recentTransactions: 'أحدث العمليات', seeAll: 'الكل ←', noTransactions: 'لا توجد عمليات بعد',
    all: 'الكل', noData: 'لا توجد بيانات',
    appearance: 'المظهر', themeSystem: 'كإعداد الجهاز', themeLight: 'فاتح', themeDark: 'داكن',
    language: 'اللغة', currency: 'العملة', categories: 'الفئات', add: '+ إضافة', showArchived: 'إظهار المؤرشف',
    footerNote: 'أموالي · جزء من محفظة تطبيقات Mini App',
    addTransaction: 'عملية جديدة', editTransaction: 'العملية', addAccount: 'حساب جديد', editAccount: 'الحساب',
    addCategory: 'فئة جديدة', editCategory: 'الفئة',
    amount: 'المبلغ', date: 'التاريخ', note: 'ملاحظة', notePlaceholder: 'اختياري',
    category: 'الفئة', account: 'الحساب', accountType: 'نوع الحساب',
    accountName: 'الاسم', accountNamePlaceholder: 'مثال: البنك الأهلي',
    bankName: 'البنك', bankNamePlaceholder: 'مثال: البنك الأهلي',
    categoryName: 'الاسم', categoryNamePlaceholder: 'اسم الفئة',
    icon: 'الأيقونة', color: 'اللون',
    typeCard: 'بطاقة', typeCash: 'نقدًا', typeCrypto: 'عملات رقمية',
    save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', archive: 'أرشفة', restore: 'استعادة',
    nameRequired: 'أدخل اسمًا', amountInvalid: 'أدخل مبلغًا أكبر من صفر',
    selectCategory: 'اختر فئة', selectAccount: 'اختر حسابًا',
    savedOk: 'تم الحفظ', deletedOk: 'تم الحذف', archivedOk: 'تمت الأرشفة', restoredOk: 'تمت الاستعادة',
    confirmDeleteTransaction: 'حذف هذه العملية؟', confirmArchiveAccount: 'أرشفة هذا الحساب؟', confirmArchiveCategory: 'أرشفة هذه الفئة؟',
    loadError: 'تعذر تحميل البيانات', authError: 'فشل التحقق عبر Telegram',
    today: 'اليوم', yesterday: 'أمس',
    cat_food: 'طعام', cat_transport: 'مواصلات', cat_home: 'منزل', cat_shopping: 'تسوق', cat_health: 'صحة',
    cat_entertainment: 'ترفيه', cat_education: 'تعليم', cat_travel: 'سفر', cat_subscriptions: 'اشتراكات',
    cat_other_expense: 'أخرى', cat_salary: 'راتب', cat_freelance: 'عمل حر', cat_gift: 'هدايا',
    cat_investment: 'استثمارات', cat_refund: 'استرداد', cat_other_income: 'أخرى',
    account_cash: 'نقدًا',
  },
};

function t(key) {
  const lang = state.settings?.language || 'ru';
  return (I18N[lang] && I18N[lang][key]) || I18N.ru[key] || key;
}

// ---------- состояние ----------

const state = {
  settings: { theme: 'system', language: 'ru', currency: 'RUB' },
  accounts: [],
  categoriesExpense: [],
  categoriesIncome: [],
  transactions: [],
  summary: { income: 0, expense: 0, byCategory: [], balances: [] },
  activeTab: 'home',
  txFilter: 'all',
  analyticsMonth: new Date(),
  analyticsKind: 'expense',
  showArchivedAccounts: false,
  showArchivedCategories: false,
  settingsCategoryKind: 'expense',
  editingTransaction: null,
  editingAccount: null,
  editingCategory: null,
  txDraft: null,
};

// ---------- API ----------

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (tg?.initData) headers['X-Telegram-Init-Data'] = tg.initData;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || t('loadError'));
  return data;
}

// ---------- утилиты ----------

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function categoryLabel(cat) { return cat.name_key ? t(cat.name_key) : cat.name; }
function accountLabel(acc) { return acc.name_key ? t(acc.name_key) : acc.name; }

function currencyMeta() {
  return CURRENCIES.find((c) => c.code === state.settings.currency) || CURRENCIES[0];
}

function formatMoney(amount) {
  const locale = LOCALE_MAP[state.settings.language] || 'ru-RU';
  const n = Number(amount) || 0;
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(Math.abs(n));
  const prefix = n < 0 ? '−' : '';
  return `${prefix}${formatted} ${currencyMeta().symbol}`;
}

// Знак операции определяется её типом (доход/расход), а не числом — сумма
// в базе всегда положительная (amount > 0).
function txAmountDisplay(tx) {
  return (tx.type === 'income' ? '+' : '−') + formatMoney(tx.amount);
}

function todayStr(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatListDate(dateStr) {
  const today = todayStr();
  const yesterday = todayStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return t('today');
  if (dateStr === yesterday) return t('yesterday');
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = MONTH_NAMES[state.settings.language] || MONTH_NAMES.ru;
  return `${d} ${months[m - 1]} ${y}`;
}

function monthRange(date) {
  const y = date.getFullYear(), m = date.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const months = MONTH_NAMES[state.settings.language] || MONTH_NAMES.ru;
  return { from, to, label: `${months[m]} ${y}` };
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

// ---------- тема / язык / направление ----------

function resolveTheme(setting) {
  if (setting === 'system') return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return setting;
}

function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme(state.settings.theme);
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.settings.theme === 'system') applyTheme();
});

function applyLanguage() {
  document.documentElement.lang = state.settings.language;
  document.documentElement.dir = state.settings.language === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.getElementById('topbar-currency').textContent = state.settings.currency;
  const titles = { home: 'navHome', transactions: 'navTransactions', analytics: 'navAnalytics', settings: 'navSettings' };
  document.getElementById('screen-title').textContent = t(titles[state.activeTab]);
}

// ---------- вкладки ----------

function switchTab(tabName) {
  if (tabName === 'add') { openTransactionSheet(null); return; }
  state.activeTab = tabName;
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.dataset.screen !== tabName; });
  const titles = { home: 'navHome', transactions: 'navTransactions', analytics: 'navAnalytics', settings: 'navSettings' };
  document.getElementById('screen-title').textContent = t(titles[tabName]);
  if (tabName === 'home') loadHome();
  if (tabName === 'transactions') loadTransactions();
  if (tabName === 'analytics') loadAnalytics();
  if (tabName === 'settings') renderSettings();
}

document.getElementById('tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (btn) switchTab(btn.dataset.tab);
});

// ---------- загрузка данных ----------

async function loadCore() {
  const [settings, accounts, catExp, catInc] = await Promise.all([
    api('/api/settings'),
    api('/api/accounts?includeArchived=1'),
    api('/api/categories?kind=expense&includeArchived=1'),
    api('/api/categories?kind=income&includeArchived=1'),
  ]);
  state.settings = settings;
  state.accounts = accounts.items;
  state.categoriesExpense = catExp.items;
  state.categoriesIncome = catInc.items;
  applyTheme();
  applyLanguage();
}

async function loadHome() {
  const { from, to } = monthRange(new Date());
  const [summary, tx] = await Promise.all([
    api(`/api/summary?from=${from}&to=${to}`),
    api('/api/transactions?limit=8'),
  ]);
  state.summary = summary;
  state.transactions = tx.items;
  renderHome();
}

async function loadTransactions() {
  const tx = await api('/api/transactions?limit=300');
  state.transactions = tx.items;
  renderTransactions();
}

async function loadAnalytics() {
  const { from, to, label } = monthRange(state.analyticsMonth);
  document.getElementById('an-period-label').textContent = label;
  const summary = await api(`/api/summary?from=${from}&to=${to}`);
  state.summary = summary;
  renderAnalytics();
}

async function refreshAccountsCategories() {
  const [accounts, catExp, catInc] = await Promise.all([
    api('/api/accounts?includeArchived=1'),
    api('/api/categories?kind=expense&includeArchived=1'),
    api('/api/categories?kind=income&includeArchived=1'),
  ]);
  state.accounts = accounts.items;
  state.categoriesExpense = catExp.items;
  state.categoriesIncome = catInc.items;
}

async function refreshCurrentScreen() {
  if (state.activeTab === 'home') await loadHome();
  else if (state.activeTab === 'transactions') await loadTransactions();
  else if (state.activeTab === 'analytics') await loadAnalytics();
  else if (state.activeTab === 'settings') renderSettings();
}

// ---------- рендер: Главная ----------

function accountColorBg(color) { return `${color}26`; }

function renderHome() {
  document.getElementById('home-balance').textContent = formatMoney(
    state.summary.balances.reduce((s, a) => s + a.balance, 0),
  );
  document.getElementById('home-income').textContent = formatMoney(state.summary.income);
  document.getElementById('home-expense').textContent = formatMoney(state.summary.expense);

  const accWrap = document.getElementById('home-accounts');
  const activeAccounts = state.summary.balances.filter((a) => !a.archived);
  accWrap.innerHTML = activeAccounts.map((a) => `
    <div class="account-chip glass">
      <div class="acc-icon">${a.icon}</div>
      <div class="acc-name">${esc(a.name_key ? t(a.name_key) : a.name)}</div>
      <div class="acc-balance">${formatMoney(a.balance)}</div>
    </div>
  `).join('') || `<div class="empty-state">${t('noTransactions')}</div>`;

  const txWrap = document.getElementById('home-transactions');
  txWrap.innerHTML = state.transactions.length
    ? state.transactions.map(renderTxRow).join('')
    : `<div class="empty-state">${t('noTransactions')}</div>`;

  document.getElementById('home-see-all').onclick = () => switchTab('transactions');
  wireTxRowClicks(txWrap);
}

function renderTxRow(tx) {
  const isIncome = tx.type === 'income';
  const catName = tx.category_name_key ? t(tx.category_name_key) : tx.category_name;
  const accName = tx.account_name_key ? t(tx.account_name_key) : tx.account_name;
  return `
    <div class="tx-row" data-id="${tx.id}">
      <div class="tx-icon" style="background:${accountColorBg(tx.category_color)}">${tx.category_icon}</div>
      <div class="tx-mid">
        <div class="tx-cat">${esc(catName)}</div>
        <div class="tx-sub">${esc(accName)} · ${formatListDate(tx.date)}</div>
      </div>
      <div class="tx-amount ${isIncome ? 'positive' : 'negative'}">${txAmountDisplay(tx)}</div>
    </div>
  `;
}

function wireTxRowClicks(container) {
  container.querySelectorAll('.tx-row').forEach((row) => {
    row.addEventListener('click', () => {
      const tx = state.transactions.find((x) => x.id === Number(row.dataset.id));
      if (tx) openTransactionSheet(tx);
    });
  });
}

// ---------- рендер: Операции ----------

document.getElementById('tx-filter').addEventListener('click', (e) => {
  const btn = e.target.closest('.segmented-btn');
  if (!btn) return;
  state.txFilter = btn.dataset.filter;
  document.querySelectorAll('#tx-filter .segmented-btn').forEach((b) => b.classList.toggle('active', b === btn));
  renderTransactions();
});

function renderTransactions() {
  const list = document.getElementById('tx-list');
  const filtered = state.txFilter === 'all' ? state.transactions : state.transactions.filter((t2) => t2.type === state.txFilter);
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">${t('noTransactions')}</div>`;
    return;
  }
  const groups = [];
  let lastDate = null;
  filtered.forEach((tx) => {
    if (tx.date !== lastDate) { groups.push({ date: tx.date, items: [] }); lastDate = tx.date; }
    groups[groups.length - 1].items.push(tx);
  });
  list.innerHTML = `<div class="glass card card-list">${groups.map((g) => `
    <div class="tx-date-header">${formatListDate(g.date)}</div>
    ${g.items.map(renderTxRow).join('')}
  `).join('')}</div>`;
  wireTxRowClicks(list);
}

// ---------- рендер: Аналитика ----------

document.getElementById('an-prev').addEventListener('click', () => {
  state.analyticsMonth = new Date(state.analyticsMonth.getFullYear(), state.analyticsMonth.getMonth() - 1, 1);
  loadAnalytics();
});
document.getElementById('an-next').addEventListener('click', () => {
  state.analyticsMonth = new Date(state.analyticsMonth.getFullYear(), state.analyticsMonth.getMonth() + 1, 1);
  loadAnalytics();
});
document.getElementById('an-kind').addEventListener('click', (e) => {
  const btn = e.target.closest('.segmented-btn');
  if (!btn) return;
  state.analyticsKind = btn.dataset.kind;
  document.querySelectorAll('#an-kind .segmented-btn').forEach((b) => b.classList.toggle('active', b === btn));
  renderAnalytics();
});

function renderAnalytics() {
  const rows = state.summary.byCategory.filter((c) => c.type === state.analyticsKind && c.total > 0)
    .sort((a, b) => b.total - a.total);
  const total = rows.reduce((s, r) => s + r.total, 0);

  const donutEl = document.getElementById('an-donut');
  const legendEl = document.getElementById('an-legend');

  if (!total) {
    donutEl.innerHTML = `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="78" fill="none" stroke="var(--divider)" stroke-width="26"/></svg>
      <div class="donut-center"><div class="dc-label">${t('noData')}</div></div>`;
    legendEl.innerHTML = '';
    return;
  }

  const r = 78, c = 2 * Math.PI * r;
  let offset = 0;
  const segs = rows.map((row) => {
    const pct = row.total / total;
    const seg = `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${row.color}" stroke-width="26"
      stroke-dasharray="${pct * c} ${c}" stroke-dashoffset="${-offset * c}" stroke-linecap="butt"/>`;
    offset += pct;
    return seg;
  }).join('');

  donutEl.innerHTML = `<svg viewBox="0 0 200 200">${segs}</svg>
    <div class="donut-center"><div class="dc-total">${formatMoney(total)}</div><div class="dc-label">${t(state.analyticsKind)}</div></div>`;

  legendEl.innerHTML = rows.map((row) => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${row.color}"></span>
      <span class="legend-name">${row.icon} ${esc(row.name_key ? t(row.name_key) : row.name)}</span>
      <span class="legend-pct">${Math.round((row.total / total) * 100)}%</span>
      <span class="legend-amt">${formatMoney(row.total)}</span>
    </div>
  `).join('');
}

// ---------- Настройки ----------

document.getElementById('set-theme').addEventListener('click', async (e) => {
  const btn = e.target.closest('.segmented-btn');
  if (!btn) return;
  await api('/api/settings', { method: 'PUT', body: { theme: btn.dataset.theme } });
  state.settings.theme = btn.dataset.theme;
  applyTheme();
  renderSettings();
});

function renderSettings() {
  document.querySelectorAll('#set-theme .segmented-btn').forEach((b) => b.classList.toggle('active', b.dataset.theme === state.settings.theme));

  const langWrap = document.getElementById('set-language');
  langWrap.innerHTML = LANGUAGES.map((l) => `
    <button type="button" class="pill ${l.code === state.settings.language ? 'active' : ''}" data-lang="${l.code}">${l.flag} ${l.native}</button>
  `).join('');
  langWrap.onclick = async (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    await api('/api/settings', { method: 'PUT', body: { language: btn.dataset.lang } });
    state.settings.language = btn.dataset.lang;
    applyLanguage();
    renderSettings();
    refreshCurrentScreen();
  };

  const curWrap = document.getElementById('set-currency');
  curWrap.innerHTML = CURRENCIES.map((c) => `
    <button type="button" class="pill ${c.code === state.settings.currency ? 'active' : ''}" data-cur="${c.code}">${c.symbol} ${c.code}</button>
  `).join('');
  curWrap.onclick = async (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    await api('/api/settings', { method: 'PUT', body: { currency: btn.dataset.cur } });
    state.settings.currency = btn.dataset.cur;
    applyLanguage();
    renderSettings();
    refreshCurrentScreen();
  };

  const accWrap = document.getElementById('set-accounts');
  const accounts = state.accounts.filter((a) => state.showArchivedAccounts || !a.archived);
  accWrap.innerHTML = accounts.length ? accounts.map((a) => `
    <div class="settings-row ${a.archived ? 'row-archived' : ''}">
      <div class="row-icon" style="background:${accountColorBg(a.color)}">${a.icon}</div>
      <div class="row-mid">
        <div class="row-name">${esc(accountLabel(a))}</div>
        ${a.bank ? `<div class="row-sub">${esc(a.bank)}</div>` : ''}
      </div>
      <div class="row-actions">
        ${a.name_key ? '' : `<button class="icon-btn" data-edit-acc="${a.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>`}
        <button class="icon-btn ${a.archived ? '' : 'danger'}" data-toggle-acc="${a.id}" data-archived="${a.archived}">
          ${a.archived
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v8h8"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>'}
        </button>
      </div>
    </div>
  `).join('') : `<div class="empty-state">${t('noTransactions')}</div>`;
  accWrap.querySelectorAll('[data-edit-acc]').forEach((b) => b.addEventListener('click', () => {
    openAccountSheet(state.accounts.find((a) => a.id === Number(b.dataset.editAcc)));
  }));
  accWrap.querySelectorAll('[data-toggle-acc]').forEach((b) => b.addEventListener('click', async () => {
    const id = Number(b.dataset.toggleAcc);
    const archived = b.dataset.archived === '1';
    if (!archived && !confirm(t('confirmArchiveAccount'))) return;
    await api(`/api/accounts/${id}${archived ? '/restore' : ''}`, { method: archived ? 'POST' : 'DELETE' });
    toast(archived ? t('restoredOk') : t('archivedOk'));
    await refreshAccountsCategories();
    renderSettings();
  }));

  document.querySelectorAll('#cat-kind .segmented-btn').forEach((b) => b.classList.toggle('active', b.dataset.kind === state.settingsCategoryKind));
  const catWrap = document.getElementById('set-categories');
  const cats = (state.settingsCategoryKind === 'expense' ? state.categoriesExpense : state.categoriesIncome)
    .filter((c) => state.showArchivedCategories || !c.archived);
  catWrap.innerHTML = cats.length ? cats.map((c) => `
    <div class="settings-row ${c.archived ? 'row-archived' : ''}">
      <div class="row-icon" style="background:${accountColorBg(c.color)}">${c.icon}</div>
      <div class="row-mid"><div class="row-name">${esc(categoryLabel(c))}</div></div>
      <div class="row-actions">
        ${c.name_key ? '' : `<button class="icon-btn" data-edit-cat="${c.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>`}
        <button class="icon-btn ${c.archived ? '' : 'danger'}" data-toggle-cat="${c.id}" data-archived="${c.archived}">
          ${c.archived
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v8h8"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>'}
        </button>
      </div>
    </div>
  `).join('') : `<div class="empty-state">${t('noTransactions')}</div>`;
  catWrap.querySelectorAll('[data-edit-cat]').forEach((b) => b.addEventListener('click', () => {
    const list = state.settingsCategoryKind === 'expense' ? state.categoriesExpense : state.categoriesIncome;
    openCategorySheet(state.settingsCategoryKind, list.find((c) => c.id === Number(b.dataset.editCat)));
  }));
  catWrap.querySelectorAll('[data-toggle-cat]').forEach((b) => b.addEventListener('click', async () => {
    const id = Number(b.dataset.toggleCat);
    const archived = b.dataset.archived === '1';
    if (!archived && !confirm(t('confirmArchiveCategory'))) return;
    await api(`/api/categories/${id}${archived ? '/restore' : ''}`, { method: archived ? 'POST' : 'DELETE' });
    toast(archived ? t('restoredOk') : t('archivedOk'));
    await refreshAccountsCategories();
    renderSettings();
  }));
}

document.getElementById('acc-show-archived').addEventListener('change', (e) => { state.showArchivedAccounts = e.target.checked; renderSettings(); });
document.getElementById('cat-show-archived').addEventListener('change', (e) => { state.showArchivedCategories = e.target.checked; renderSettings(); });
document.getElementById('cat-kind').addEventListener('click', (e) => {
  const btn = e.target.closest('.segmented-btn');
  if (!btn) return;
  state.settingsCategoryKind = btn.dataset.kind;
  renderSettings();
});
document.getElementById('acc-add').addEventListener('click', () => openAccountSheet(null));
document.getElementById('cat-add').addEventListener('click', () => openCategorySheet(state.settingsCategoryKind, null));

// ---------- Bottom sheet ----------

const sheetOverlay = document.getElementById('sheet-overlay');
const sheetTitle = document.getElementById('sheet-title');
const sheetBody = document.getElementById('sheet-body');

function openSheet(title) {
  sheetTitle.textContent = title;
  sheetOverlay.hidden = false;
}
function closeSheet() {
  sheetOverlay.hidden = true;
  sheetBody.innerHTML = '';
}
document.getElementById('sheet-close').addEventListener('click', closeSheet);
document.getElementById('sheet-backdrop').addEventListener('click', closeSheet);

// ---------- Sheet: транзакция ----------

function openTransactionSheet(tx) {
  state.editingTransaction = tx;
  const type = tx?.type || 'expense';
  const draft = {
    type,
    amount: tx ? String(tx.amount) : '',
    accountId: tx?.account_id || state.accounts.find((a) => !a.archived)?.id,
    categoryId: tx?.category_id || null,
    date: tx?.date || todayStr(),
    note: tx?.note || '',
  };
  state.txDraft = draft;
  openSheet(tx ? t('editTransaction') : t('addTransaction'));
  sheetBody.innerHTML = renderTxForm(draft);
  wireTxForm(tx);
}

function renderTxForm(draft) {
  const cats = draft.type === 'expense' ? state.categoriesExpense : state.categoriesIncome;
  const activeCats = cats.filter((c) => !c.archived || c.id === draft.categoryId);
  const activeAccounts = state.accounts.filter((a) => !a.archived || a.id === draft.accountId);
  return `
    <div class="segmented" id="txf-type">
      <button type="button" class="segmented-btn ${draft.type === 'expense' ? 'active' : ''}" data-type="expense">${t('expense')}</button>
      <button type="button" class="segmented-btn ${draft.type === 'income' ? 'active' : ''}" data-type="income">${t('income')}</button>
    </div>
    <div class="amount-input-wrap">
      <input type="text" inputmode="decimal" class="amount-input" id="txf-amount" placeholder="0" value="${esc(draft.amount)}">
      <span class="amount-currency">${currencyMeta().symbol}</span>
    </div>
    <div class="field">
      <label>${t('category')}</label>
      <div class="chip-grid" id="txf-categories">
        ${activeCats.map((c) => `
          <button type="button" class="pick-chip ${c.id === draft.categoryId ? 'active' : ''}" data-cat="${c.id}">
            <span class="pc-icon" style="background:${accountColorBg(c.color)}">${c.icon}</span>
            <span class="pc-name">${esc(categoryLabel(c))}</span>
          </button>
        `).join('')}
      </div>
    </div>
    <div class="field">
      <label>${t('account')}</label>
      <div class="account-row-pick" id="txf-accounts">
        ${activeAccounts.map((a) => `
          <button type="button" class="acc-pick-chip ${a.id === draft.accountId ? 'active' : ''}" data-acc="${a.id}">${a.icon} ${esc(accountLabel(a))}</button>
        `).join('')}
      </div>
    </div>
    <div class="field">
      <label>${t('date')}</label>
      <input type="date" id="txf-date" value="${draft.date}">
    </div>
    <div class="field">
      <label>${t('note')}</label>
      <textarea id="txf-note" rows="2" placeholder="${t('notePlaceholder')}">${esc(draft.note)}</textarea>
    </div>
    <button type="button" class="btn-primary" id="txf-save">${t('save')}</button>
    ${state.editingTransaction ? `<button type="button" class="btn-danger" id="txf-delete">${t('delete')}</button>` : ''}
  `;
}

function wireTxForm(tx) {
  document.getElementById('txf-type').addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented-btn');
    if (!btn) return;
    // Переключение расход/доход перерисовывает форму (другой набор категорий) —
    // сохраняем уже введённые сумму/дату/заметку, чтобы не терять ввод.
    state.txDraft.amount = document.getElementById('txf-amount').value;
    state.txDraft.date = document.getElementById('txf-date').value;
    state.txDraft.note = document.getElementById('txf-note').value;
    state.txDraft.type = btn.dataset.type;
    state.txDraft.categoryId = null;
    sheetBody.innerHTML = renderTxForm(state.txDraft);
    wireTxForm(tx);
  });
  document.getElementById('txf-categories').addEventListener('click', (e) => {
    const btn = e.target.closest('.pick-chip');
    if (!btn) return;
    state.txDraft.categoryId = Number(btn.dataset.cat);
    sheetBody.querySelectorAll('#txf-categories .pick-chip').forEach((b) => b.classList.toggle('active', b === btn));
  });
  document.getElementById('txf-accounts').addEventListener('click', (e) => {
    const btn = e.target.closest('.acc-pick-chip');
    if (!btn) return;
    state.txDraft.accountId = Number(btn.dataset.acc);
    sheetBody.querySelectorAll('#txf-accounts .acc-pick-chip').forEach((b) => b.classList.toggle('active', b === btn));
  });
  document.getElementById('txf-save').addEventListener('click', async () => {
    const amountRaw = document.getElementById('txf-amount').value.replace(',', '.').trim();
    const amount = Number(amountRaw);
    const date = document.getElementById('txf-date').value;
    const note = document.getElementById('txf-note').value;
    if (!Number.isFinite(amount) || amount <= 0) return toast(t('amountInvalid'));
    if (!state.txDraft.categoryId) return toast(t('selectCategory'));
    if (!state.txDraft.accountId) return toast(t('selectAccount'));
    const body = { type: state.txDraft.type, amount, accountId: state.txDraft.accountId, categoryId: state.txDraft.categoryId, date, note };
    try {
      if (tx) await api(`/api/transactions/${tx.id}`, { method: 'PUT', body });
      else await api('/api/transactions', { method: 'POST', body });
      toast(t('savedOk'));
      closeSheet();
      await refreshCurrentScreen();
    } catch (err) { toast(err.message); }
  });
  if (tx) {
    document.getElementById('txf-delete').addEventListener('click', async () => {
      if (!confirm(t('confirmDeleteTransaction'))) return;
      await api(`/api/transactions/${tx.id}`, { method: 'DELETE' });
      toast(t('deletedOk'));
      closeSheet();
      await refreshCurrentScreen();
    });
  }
}

// ---------- Sheet: счёт ----------

function openAccountSheet(account) {
  state.editingAccount = account;
  const draft = {
    type: account?.type || 'card',
    name: account?.name || '',
    bank: account?.bank || '',
    icon: account?.icon || ACCOUNT_ICONS[0],
    color: account?.color || COLOR_PALETTE[0],
  };
  openSheet(account ? t('editAccount') : t('addAccount'));
  sheetBody.innerHTML = renderAccountForm(draft, !!account);
  wireAccountForm(account, draft);
}

function renderAccountForm(draft, isEdit) {
  return `
    ${isEdit ? '' : `
    <div class="field">
      <label>${t('accountType')}</label>
      <div class="type-pick" id="accf-type">
        <button type="button" class="segmented-btn ${draft.type === 'card' ? 'active' : ''}" data-type="card" style="flex:1">${t('typeCard')}</button>
        <button type="button" class="segmented-btn ${draft.type === 'cash' ? 'active' : ''}" data-type="cash" style="flex:1">${t('typeCash')}</button>
        <button type="button" class="segmented-btn ${draft.type === 'crypto' ? 'active' : ''}" data-type="crypto" style="flex:1">${t('typeCrypto')}</button>
      </div>
    </div>`}
    <div class="field">
      <label>${t('accountName')}</label>
      <input type="text" id="accf-name" placeholder="${t('accountNamePlaceholder')}" value="${esc(draft.name)}">
    </div>
    <div class="field" id="accf-bank-field" style="${draft.type === 'card' ? '' : 'display:none'}">
      <label>${t('bankName')}</label>
      <input type="text" id="accf-bank" placeholder="${t('bankNamePlaceholder')}" value="${esc(draft.bank)}">
    </div>
    <div class="field">
      <label>${t('icon')}</label>
      <div class="icon-swatches" id="accf-icons">
        ${ACCOUNT_ICONS.map((ic) => `<button type="button" class="icon-swatch ${ic === draft.icon ? 'active' : ''}" data-icon="${ic}">${ic}</button>`).join('')}
      </div>
    </div>
    <div class="field">
      <label>${t('color')}</label>
      <div class="color-swatches" id="accf-colors">
        ${COLOR_PALETTE.map((col) => `<button type="button" class="swatch ${col === draft.color ? 'active' : ''}" data-color="${col}" style="background:${col}"></button>`).join('')}
      </div>
    </div>
    <button type="button" class="btn-primary" id="accf-save">${t('save')}</button>
  `;
}

function wireAccountForm(account, draft) {
  const typeEl = document.getElementById('accf-type');
  if (typeEl) typeEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented-btn');
    if (!btn) return;
    draft.type = btn.dataset.type;
    typeEl.querySelectorAll('.segmented-btn').forEach((b) => b.classList.toggle('active', b === btn));
    document.getElementById('accf-bank-field').style.display = draft.type === 'card' ? '' : 'none';
  });
  document.getElementById('accf-icons').addEventListener('click', (e) => {
    const btn = e.target.closest('.icon-swatch'); if (!btn) return;
    draft.icon = btn.dataset.icon;
    document.querySelectorAll('#accf-icons .icon-swatch').forEach((b) => b.classList.toggle('active', b === btn));
  });
  document.getElementById('accf-colors').addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch'); if (!btn) return;
    draft.color = btn.dataset.color;
    document.querySelectorAll('#accf-colors .swatch').forEach((b) => b.classList.toggle('active', b === btn));
  });
  document.getElementById('accf-save').addEventListener('click', async () => {
    const name = document.getElementById('accf-name').value.trim();
    const bank = document.getElementById('accf-bank')?.value.trim() || '';
    if (!name) return toast(t('nameRequired'));
    const body = { type: draft.type, name, bank: draft.type === 'card' ? bank : '', icon: draft.icon, color: draft.color };
    try {
      if (account) await api(`/api/accounts/${account.id}`, { method: 'PUT', body });
      else await api('/api/accounts', { method: 'POST', body });
      toast(t('savedOk'));
      closeSheet();
      await refreshAccountsCategories();
      await refreshCurrentScreen();
    } catch (err) { toast(err.message); }
  });
}

// ---------- Sheet: категория ----------

function openCategorySheet(kind, category) {
  state.editingCategory = category;
  const draft = {
    name: category?.name || '',
    icon: category?.icon || CATEGORY_ICONS[0],
    color: category?.color || COLOR_PALETTE[0],
  };
  openSheet(category ? t('editCategory') : t('addCategory'));
  sheetBody.innerHTML = `
    <div class="field">
      <label>${t('categoryName')}</label>
      <input type="text" id="catf-name" placeholder="${t('categoryNamePlaceholder')}" value="${esc(draft.name)}">
    </div>
    <div class="field">
      <label>${t('icon')}</label>
      <div class="icon-swatches" id="catf-icons">
        ${CATEGORY_ICONS.map((ic) => `<button type="button" class="icon-swatch ${ic === draft.icon ? 'active' : ''}" data-icon="${ic}">${ic}</button>`).join('')}
      </div>
    </div>
    <div class="field">
      <label>${t('color')}</label>
      <div class="color-swatches" id="catf-colors">
        ${COLOR_PALETTE.map((col) => `<button type="button" class="swatch ${col === draft.color ? 'active' : ''}" data-color="${col}" style="background:${col}"></button>`).join('')}
      </div>
    </div>
    <button type="button" class="btn-primary" id="catf-save">${t('save')}</button>
  `;
  document.getElementById('catf-icons').addEventListener('click', (e) => {
    const btn = e.target.closest('.icon-swatch'); if (!btn) return;
    draft.icon = btn.dataset.icon;
    document.querySelectorAll('#catf-icons .icon-swatch').forEach((b) => b.classList.toggle('active', b === btn));
  });
  document.getElementById('catf-colors').addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch'); if (!btn) return;
    draft.color = btn.dataset.color;
    document.querySelectorAll('#catf-colors .swatch').forEach((b) => b.classList.toggle('active', b === btn));
  });
  document.getElementById('catf-save').addEventListener('click', async () => {
    const name = document.getElementById('catf-name').value.trim();
    if (!name) return toast(t('nameRequired'));
    const body = { kind, name, icon: draft.icon, color: draft.color };
    try {
      if (category) await api(`/api/categories/${category.id}`, { method: 'PUT', body });
      else await api('/api/categories', { method: 'POST', body });
      toast(t('savedOk'));
      closeSheet();
      await refreshAccountsCategories();
      await refreshCurrentScreen();
    } catch (err) { toast(err.message); }
  });
}

// ---------- init ----------

async function init() {
  try {
    await loadCore();
    await loadHome();
  } catch (err) {
    console.error(err);
    toast(err.message || t('loadError'));
  }
}

init();
