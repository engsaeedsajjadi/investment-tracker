/* ===== BACKUP PAGE ===== */
Pages.backup = (() => {

  function render(el) {
    const db = DB.getAll();
    const stats = {
      accounts: db.accounts.length,
      assets: db.assets.length,
      transactions: db.transactions.length,
      dailyValues: db.dailyValues.length
    };

    el.innerHTML = `
      <div class="section-header mb-6">
        <span class="section-title">💾 پشتیبان‌گیری و بازیابی</span>
      </div>

      <div class="grid-2">
        <!-- Export -->
        <div class="card">
          <div class="card-header"><span class="card-title">📤 خروجی گرفتن (Export)</span></div>
          <div style="margin-bottom:16px">
            <div class="flex justify-between mb-4">
              <span class="text-muted text-sm">تعداد حساب‌ها</span>
              <strong>${stats.accounts}</strong>
            </div>
            <div class="flex justify-between mb-4">
              <span class="text-muted text-sm">تعداد دارایی‌ها</span>
              <strong>${stats.assets}</strong>
            </div>
            <div class="flex justify-between mb-4">
              <span class="text-muted text-sm">تعداد معاملات</span>
              <strong>${stats.transactions}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted text-sm">تعداد ثبت‌های روزانه</span>
              <strong>${stats.dailyValues}</strong>
            </div>
          </div>
          <button class="btn btn-primary btn-block" onclick="Pages.backup.exportJSON()">
            💾 دانلود پشتیبان JSON
          </button>
          <button class="btn btn-ghost btn-block mt-4" onclick="Pages.backup.exportCSV()">
            📊 خروجی CSV معاملات
          </button>
        </div>

        <!-- Import -->
        <div class="card">
          <div class="card-header"><span class="card-title">📥 بازیابی (Restore)</span></div>
          <p class="text-muted text-sm mb-4">⚠️ بازیابی از فایل پشتیبان، تمام داده‌های موجود را جایگزین می‌کند</p>

          <div class="drop-area" id="backupDrop" onclick="document.getElementById('backupFile').click()">
            <div class="drop-icon">📁</div>
            <p>فایل JSON پشتیبان را اینجا بکشید</p>
            <p class="text-sm text-muted mt-4">یا کلیک کنید برای انتخاب</p>
            <input type="file" id="backupFile" accept=".json" style="display:none" onchange="Pages.backup.handleRestoreFile(this.files[0])">
          </div>

          <div class="card mt-4" style="background:var(--bg3)">
            <div class="card-title text-sm mb-4">⚡ عملیات سریع</div>
            <button class="btn btn-danger btn-block" onclick="Pages.backup.clearAllData()">
              🗑️ پاک کردن تمام داده‌ها
            </button>
            <button class="btn btn-ghost btn-block mt-4" onclick="Pages.backup.loadSampleData()">
              🎭 بارگذاری داده‌های نمونه
            </button>
          </div>
        </div>
      </div>

      <!-- Danger zone -->
      <div class="card mt-6" style="border-color:var(--red)">
        <div class="card-header">
          <span class="card-title text-red">⚠️ منطقه خطر</span>
        </div>
        <p class="text-muted text-sm mb-4">عملیات زیر غیرقابل بازگشت هستند. قبل از انجام، پشتیبان بگیرید.</p>
        <div class="flex gap-2">
          <button class="btn btn-danger btn-sm" onclick="Pages.backup.clearAllData()">حذف تمام داده‌ها</button>
          <button class="btn btn-ghost btn-sm" onclick="Pages.backup.exportJSON()">پشتیبان‌گیری اول</button>
        </div>
      </div>
    `;

    setupDrop();
  }

  function setupDrop() {
    const area = document.getElementById('backupDrop');
    if (!area) return;
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f) handleRestoreFile(f);
    });
  }

  function exportJSON() {
    const json = DB.backup.export();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sarmayeyar_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast('فایل پشتیبان دانلود شد', 'success');
  }

  function exportCSV() {
    const txs = DB.transactions.getAll();
    const accounts = DB.accounts.getAll();
    const accMap = {};
    accounts.forEach(a => accMap[a.id] = a.name);

    const header = ['date','type','symbol','account','quantity','price','fee','total','description'];
    const rows = txs.map(t => [
      t.date, t.type, t.symbol || '',
      accMap[t.accountId] || '',
      t.quantity || 0, t.price || 0, t.fee || 0,
      (t.price || 0) * (t.quantity || 0),
      t.description || ''
    ]);

    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast('فایل CSV دانلود شد', 'success');
  }

  function handleRestoreFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        JSON.parse(e.target.result); // validate
        if (!confirm('آیا از جایگزینی تمام داده‌ها با این فایل مطمئنید؟')) return;
        DB.backup.import(e.target.result);
        App.toast('داده‌ها با موفقیت بازیابی شدند', 'success');
        Pages.backup.render(document.getElementById('appContent'));
      } catch (err) {
        App.toast('فایل JSON نامعتبر است', 'error');
      }
    };
    reader.readAsText(file);
  }

  function clearAllData() {
    if (!confirm('آیا از حذف تمام داده‌ها مطمئنید؟ این عمل غیرقابل بازگشت است!')) return;
    if (!confirm('این عمل برگشت‌ناپذیر است. آیا کاملاً مطمئنید؟')) return;
    DB.backup.clear();
    App.toast('تمام داده‌ها پاک شد', 'success');
    Pages.backup.render(document.getElementById('appContent'));
  }

  function loadSampleData() {
    if (!confirm('داده‌های موجود حذف و داده‌های نمونه بارگذاری می‌شوند. ادامه می‌دهید؟')) return;
    DB.backup.clear();
    DB.seedSampleData();
    App.toast('داده‌های نمونه بارگذاری شد', 'success');
    Pages.backup.render(document.getElementById('appContent'));
  }

  return { render, exportJSON, exportCSV, handleRestoreFile, clearAllData, loadSampleData };
})();
