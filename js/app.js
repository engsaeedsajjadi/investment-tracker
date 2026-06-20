/* ===== APP CONTROLLER ===== */
const App = (() => {
  let currentPage = 'dashboard';
  const pages = {};

  /* ---- REGISTER PAGES ---- */
  function register(name, mod) { pages[name] = mod; }

  /* ---- INIT ---- */
  function init() {
    DB.seedSampleData();
    setupSidebar();
    setupModal();
    navigate('dashboard');
    updateLastUpdate();

    document.getElementById('quickAddBtn').addEventListener('click', () => {
      navigate('transactions');
      setTimeout(() => Pages.transactions.openAddModal(), 100);
    });
  }

  /* ---- NAVIGATION ---- */
  function navigate(page) {
    currentPage = page;
    document.querySelectorAll('.nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.page === page);
    });
    const titles = {
      dashboard: 'داشبورد', accounts: 'مدیریت حساب‌ها', assets: 'مدیریت دارایی‌ها',
      transactions: 'ثبت معاملات', daily: 'ثبت ارزش روزانه',
      reports: 'گزارش‌ها و نمودارها', import: 'وارد کردن داده', backup: 'پشتیبان‌گیری'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    const content = document.getElementById('appContent');
    content.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>در حال بارگذاری...</p></div>';

    closeSidebar();

    requestAnimationFrame(() => {
      if (Pages[page]) Pages[page].render(content);
    });
  }

  /* ---- SIDEBAR ---- */
  function setupSidebar() {
    const btn = document.getElementById('menuBtn');
    const close = document.getElementById('sidebarClose');
    const overlay = document.getElementById('overlay');
    const sidebar = document.getElementById('sidebar');

    btn.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('active'); });
    close.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.dataset.page);
      });
    });
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
  }

  /* ---- MODAL ---- */
  let modalResolve = null;
  function setupModal() {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalBackdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
  }

  function openModal(title, bodyHTML, opts = {}) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalBackdrop').classList.add('open');
    if (opts.onOpen) opts.onOpen(document.getElementById('modalBody'));
  }

  function closeModal() {
    document.getElementById('modalBackdrop').classList.remove('open');
    document.getElementById('modalBody').innerHTML = '';
  }

  /* ---- TOAST ---- */
  function toast(msg, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  /* ---- FORMAT HELPERS ---- */
  function fmtNum(n, decimals = 0) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('fa-IR', { maximumFractionDigits: decimals });
  }

  function fmtCurrency(n) {
    if (Math.abs(n) >= 1e9) return fmtNum(n / 1e9, 2) + ' میلیارد';
    if (Math.abs(n) >= 1e6) return fmtNum(n / 1e6, 1) + ' میلیون';
    return fmtNum(n) + ' تومان';
  }

  function fmtPct(n) {
    const sign = n >= 0 ? '+' : '';
    return sign + Number(n).toFixed(2) + '%';
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fa-IR');
  }

  function pnlClass(v) { return v >= 0 ? 'text-green' : 'text-red'; }
  function pnlBadge(v) { return v >= 0 ? 'badge-green' : 'badge-red'; }

  function updateLastUpdate() {
    document.getElementById('lastUpdate').textContent = 'آخرین بروزرسانی: ' + new Date().toLocaleDateString('fa-IR');
  }

  const typeLabels = { stock: 'سهام', gold: 'طلا', fixed_income: 'درآمد ثابت', forex: 'فارکس', cash: 'نقد' };
  const catLabels = { broker: 'کارگزاری', portfolio_manager: 'سبدگردان', forex: 'فارکس' };
  const accountTypeLabels = { haghighi: 'حقیقی', hoghooghi: 'حقوقی' };
  const txTypeLabels = { buy: 'خرید', sell: 'فروش', deposit: 'واریز', withdraw: 'برداشت', transfer: 'انتقال' };
  const txTypeBadge = { buy: 'badge-green', sell: 'badge-red', deposit: 'badge-blue', withdraw: 'badge-gold', transfer: 'badge-gray' };

  return {
    init, navigate, register,
    openModal, closeModal,
    toast, fmtNum, fmtCurrency, fmtPct, fmtDate,
    pnlClass, pnlBadge,
    typeLabels, catLabels, accountTypeLabels, txTypeLabels, txTypeBadge
  };
})();

/* ===== PAGES NAMESPACE ===== */
const Pages = {};
