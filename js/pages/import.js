/* ===== IMPORT PAGE ===== */
Pages.import = (() => {

  let parsedRows = [];

  function render(el) {
    const accounts = DB.accounts.getAll();
    el.innerHTML = `
      <div class="section-header mb-6">
        <span class="section-title">📂 وارد کردن داده از فایل</span>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">📄 آپلود فایل CSV / Excel</span></div>
          <div class="drop-area" id="dropArea" onclick="document.getElementById('fileInput').click()">
            <div class="drop-icon">📁</div>
            <p>فایل CSV یا Excel را اینجا بکشید و رها کنید</p>
            <p class="text-sm text-muted mt-4">یا کلیک کنید برای انتخاب فایل</p>
            <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" style="display:none" onchange="Pages.import.handleFile(this.files[0])">
          </div>

          <div class="mt-4">
            <div class="form-group">
              <label class="form-label">حساب مقصد</label>
              <select class="form-control" id="import_account">
                <option value="">— انتخاب حساب —</option>
                ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">نوع پیش‌فرض معامله</label>
              <select class="form-control" id="import_type">
                <option value="buy">خرید</option>
                <option value="sell">فروش</option>
              </select>
            </div>
          </div>

          <div class="card mt-4" style="background:var(--bg3)">
            <div class="card-title mb-4">📌 فرمت مورد انتظار CSV</div>
            <pre style="font-size:0.75rem;color:var(--text2);direction:ltr;overflow-x:auto">date,symbol,quantity,price,fee,description
2024-01-15,خودرو,10000,2800,280000,خرید اولیه
2024-02-01,فولاد,5000,6500,325000,خرید فولاد</pre>
            <p class="text-sm text-muted mt-4">ستون‌های اجباری: date، symbol، quantity، price</p>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">👁️ پیش‌نمایش داده‌ها</span></div>
          <div id="importPreview">
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <p>فایلی انتخاب نشده</p>
            </div>
          </div>
          <div id="importActions" style="display:none;margin-top:16px">
            <div class="flex gap-2">
              <button class="btn btn-ghost" onclick="Pages.import.clearPreview()">پاک کردن</button>
              <button class="btn btn-primary" onclick="Pages.import.confirmImport()">✅ وارد کردن همه ردیف‌ها</button>
            </div>
          </div>
        </div>
      </div>
    `;

    setupDrop();
  }

  function setupDrop() {
    const area = document.getElementById('dropArea');
    if (!area) return;
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
  }

  function handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => showPreview(res.data),
        error: () => App.toast('خطا در خواندن فایل CSV', 'error')
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // Use SheetJS if available
          if (typeof XLSX !== 'undefined') {
            const wb = XLSX.read(e.target.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
            showPreview(data);
          } else {
            App.toast('برای Excel، لطفاً فایل را به CSV تبدیل کنید', 'error');
          }
        } catch (err) {
          App.toast('خطا در خواندن فایل Excel', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      App.toast('فقط فایل CSV یا Excel قابل قبول است', 'error');
    }
  }

  function normalizeRow(row) {
    // Try various column name formats
    const get = (keys) => {
      for (const k of keys) {
        const val = row[k] || row[k.toLowerCase()] || row[k.toUpperCase()];
        if (val !== undefined && val !== '') return String(val).trim();
      }
      return '';
    };
    return {
      date: get(['date', 'تاریخ', 'Date']),
      symbol: get(['symbol', 'نماد', 'Symbol', 'ticker', 'Ticker']),
      quantity: parseFloat(get(['quantity', 'تعداد', 'qty', 'Quantity', 'حجم'])) || 0,
      price: parseFloat(get(['price', 'قیمت', 'Price'])) || 0,
      fee: parseFloat(get(['fee', 'کارمزد', 'Fee', 'commission'])) || 0,
      description: get(['description', 'توضیحات', 'desc', 'Description', 'note'])
    };
  }

  function showPreview(data) {
    parsedRows = data.map(normalizeRow).filter(r => r.symbol && r.quantity > 0);
    const preview = document.getElementById('importPreview');
    const actions = document.getElementById('importActions');
    if (!preview) return;

    if (!parsedRows.length) {
      preview.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>ردیف معتبری یافت نشد. ستون‌ها را بررسی کنید</p></div>';
      return;
    }

    preview.innerHTML = `
      <p class="text-sm text-muted mb-4">✅ ${parsedRows.length} ردیف شناسایی شد</p>
      <div class="table-wrap" style="max-height:300px;overflow-y:auto">
        <table>
          <thead><tr><th>تاریخ</th><th>نماد</th><th>تعداد</th><th>قیمت</th><th>کارمزد</th></tr></thead>
          <tbody>
            ${parsedRows.map(r => `<tr>
              <td class="ltr">${r.date}</td>
              <td class="ltr"><strong>${r.symbol}</strong></td>
              <td class="ltr">${App.fmtNum(r.quantity, 4)}</td>
              <td class="ltr">${App.fmtNum(r.price)}</td>
              <td class="ltr">${App.fmtNum(r.fee)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
    if (actions) actions.style.display = '';
  }

  function confirmImport() {
    const accountId = document.getElementById('import_account')?.value;
    const type = document.getElementById('import_type')?.value || 'buy';
    if (!accountId) { App.toast('لطفاً حساب مقصد را انتخاب کنید', 'error'); return; }

    let imported = 0;
    parsedRows.forEach(r => {
      // find or skip asset
      const assets = DB.assets.byAccount(accountId);
      let asset = assets.find(a => a.symbol === r.symbol);
      if (!asset) {
        asset = DB.assets.add({ symbol: r.symbol, name: r.symbol, type: 'stock', accountId, quantity: 0, avgPrice: 0, currentPrice: r.price });
      }
      DB.transactions.add({
        type,
        accountId,
        assetId: asset.id,
        symbol: r.symbol,
        quantity: r.quantity,
        price: r.price,
        fee: r.fee,
        date: r.date || new Date().toISOString().split('T')[0],
        description: r.description || 'وارد شده از فایل'
      });
      imported++;
    });

    App.toast(`${imported} معامله با موفقیت وارد شد`, 'success');
    parsedRows = [];
    clearPreview();
  }

  function clearPreview() {
    parsedRows = [];
    const preview = document.getElementById('importPreview');
    if (preview) preview.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>فایلی انتخاب نشده</p></div>';
    const actions = document.getElementById('importActions');
    if (actions) actions.style.display = 'none';
    const fi = document.getElementById('fileInput');
    if (fi) fi.value = '';
  }

  return { render, handleFile, confirmImport, clearPreview };
})();
