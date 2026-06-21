/* ===== IMPORT PAGE ===== */
Pages.import = (() => {

  let rawData = [];        // raw parsed rows (array of objects, keyed by original headers)
  let rawHeaders = [];      // original column headers from file
  let importMode = 'broker_statement'; // 'broker_statement' | 'transactions' | 'assets'
  let columnMap = {};        // fieldKey -> original header name

  const TX_FIELDS = [
    { key: 'date', label: 'تاریخ', required: true },
    { key: 'symbol', label: 'نماد', required: true },
    { key: 'quantity', label: 'تعداد', required: true },
    { key: 'price', label: 'قیمت', required: true },
    { key: 'fee', label: 'کارمزد', required: false },
    { key: 'type', label: 'نوع معامله (خرید/فروش)', required: false },
    { key: 'description', label: 'توضیحات', required: false }
  ];

  const ASSET_FIELDS = [
    { key: 'symbol', label: 'نماد', required: true },
    { key: 'name', label: 'نام دارایی', required: false },
    { key: 'quantity', label: 'تعداد', required: true },
    { key: 'avgPrice', label: 'میانگین خرید', required: true },
    { key: 'currentPrice', label: 'قیمت روز', required: false }
  ];

  const GUESS = {
    date: ['date', 'تاریخ', 'Date', 'تاريخ معامله', 'تاریخ معامله'],
    symbol: ['symbol', 'نماد', 'Symbol', 'ticker', 'Ticker', 'نام نماد'],
    name: ['name', 'نام', 'نام دارایی', 'Name', 'نام شرکت'],
    quantity: ['quantity', 'تعداد', 'qty', 'Quantity', 'حجم', 'مقدار', 'تعداد سهم'],
    price: ['price', 'قیمت', 'Price', 'قیمت واحد', 'نرخ', 'قیمت معامله'],
    avgPrice: ['avgprice', 'میانگین خرید', 'قیمت میانگین', 'قیمت تمام شده', 'avg_price'],
    currentPrice: ['currentprice', 'قیمت روز', 'قیمت فعلی', 'current_price', 'آخرین قیمت'],
    fee: ['fee', 'کارمزد', 'Fee', 'commission', 'کارمزد معامله'],
    type: ['type', 'نوع', 'نوع معامله', 'Type', 'خرید/فروش'],
    description: ['description', 'توضیحات', 'desc', 'Description', 'note', 'شرح']
  };

  /* ---- BROKER STATEMENT (گردش حساب) PARSER ----
     Handles raw Iranian brokerage statement exports with columns:
     تاریخ (jalali date), شرح (free-text description), بدهکار, بستانکار, مانده
     The شرح text embeds: type (خرید/فروش), quantity, symbol (often in parentheses), price (نرخ)
  */
  function looksLikeBrokerStatement(headers) {
    const norm = headers.map(h => h.replace(/\uFEFF/g, '').trim());
    return norm.includes('شرح') && (norm.includes('بدهکار') || norm.includes('بستانکار'));
  }

  function findHeader(headers, name) {
    return headers.find(h => h.replace(/\uFEFF/g, '').trim() === name);
  }

  function parseBrokerDescription(desc) {
    if (!desc) return null;
    const text = String(desc).trim();

    const typeMatch = text.match(/^(خرید|خريد|فروش)/);
    if (!typeMatch) return null; // not a trade row (could be deposit/withdraw/fee line)
    const type = typeMatch[1].includes('فروش') ? 'sell' : 'buy';

    const qtyMatch = text.match(/تعداد\s*([\d,]+)\s*(?:سهم|واحد)/);
    if (!qtyMatch) return null;
    const quantity = parseFloat(qtyMatch[1].replace(/,/g, '')) || 0;

    // Prefer the short code in parentheses, e.g. "(ذرت1)" -> "ذرت"
    let symbol = null;
    const codeMatch = text.match(/\(([^0-9۰-۹\)]+)[\d۰-۹]*\)/);
    if (codeMatch) {
      symbol = codeMatch[1].trim();
    } else {
      const symMatch = text.match(/(?:سهم|واحد\s*صندوق)\s*([^\(]+?)\s*(?:\(|به نرخ)/);
      symbol = symMatch ? symMatch[1].trim() : null;
    }
    if (!symbol) return null;

    const priceMatch = text.match(/به نرخ\s*([\d,]+)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

    return { type, quantity, symbol, price, description: text };
  }

  function parseBrokerRows(data) {
    const dateHeader = findHeader(rawHeaders, 'تاریخ');
    const descHeader = findHeader(rawHeaders, 'شرح');
    const debitHeader = findHeader(rawHeaders, 'بدهکار');
    const creditHeader = findHeader(rawHeaders, 'بستانکار');

    const out = [];
    data.forEach(row => {
      const desc = row[descHeader];
      const parsed = parseBrokerDescription(desc);
      if (!parsed) return; // skip non-trade rows (transfers, fees-only, etc.)

      const jalaliDate = row[dateHeader] ? String(row[dateHeader]).trim() : '';
      const isoDate = (typeof Jalali !== 'undefined' && jalaliDate)
        ? (Jalali.parseJalaliStr(jalaliDate) || new Date().toISOString().split('T')[0])
        : new Date().toISOString().split('T')[0];

      // total amount actually charged/credited (includes fees) from debit/bestankar columns
      const debit = parseFloat(String(row[debitHeader] || '0').replace(/,/g, '')) || 0;
      const credit = parseFloat(String(row[creditHeader] || '0').replace(/,/g, '')) || 0;
      const totalAmount = parsed.type === 'buy' ? debit : credit;
      const grossAmount = parsed.price * parsed.quantity;
      // fee = difference between actual cash flow and price*quantity (rough estimate)
      const fee = parsed.type === 'buy'
        ? Math.max(0, totalAmount - grossAmount)
        : Math.max(0, grossAmount - totalAmount);

      out.push({
        date: isoDate,
        jalaliDate,
        type: parsed.type,
        symbol: parsed.symbol,
        quantity: parsed.quantity,
        price: parsed.price,
        fee: Math.round(fee),
        description: parsed.description
      });
    });
    return out;
  }

  function render(el) {
    const accounts = DB.accounts.getAll();
    el.innerHTML = `
      <div class="section-header mb-6">
        <span class="section-title">📂 وارد کردن داده از فایل اکسل / CSV</span>
      </div>

      <div class="tabs">
        <button class="tab-btn active" id="modeTabBroker" onclick="Pages.import.setMode('broker_statement')">گردش حساب کارگزاری (خودکار)</button>
        <button class="tab-btn" id="modeTabTx" onclick="Pages.import.setMode('transactions')">وارد کردن معاملات (دستی)</button>
        <button class="tab-btn" id="modeTabAsset" onclick="Pages.import.setMode('assets')">وارد کردن موجودی دارایی‌ها</button>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">📄 آپلود فایل</span></div>
          <div class="drop-area" id="dropArea" onclick="document.getElementById('fileInput').click()">
            <div class="drop-icon">📁</div>
            <p>فایل اکسل گزارش کارگزاری/بروکر را اینجا بکشید</p>
            <p class="text-sm text-muted mt-4">فرمت‌های قابل قبول: .xlsx .xls .csv</p>
            <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" style="display:none" onchange="Pages.import.handleFile(this.files[0])">
          </div>

          <div class="mt-4">
            <div class="form-group">
              <label class="form-label">حساب مقصد *</label>
              <select class="form-control" id="import_account">
                <option value="">— انتخاب حساب —</option>
                ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" id="importTypeGroup" style="display:none">
              <label class="form-label">نوع پیش‌فرض معامله (اگر ستون نوع مشخص نشود)</label>
              <select class="form-control" id="import_type">
                <option value="buy">خرید</option>
                <option value="sell">فروش</option>
              </select>
            </div>
          </div>

          <div id="columnMapBox"></div>

          <div class="card mt-4" style="background:var(--bg3)">
            <div class="card-title mb-4" id="formatHint">📌 ستون‌های مورد نیاز</div>
            <p class="text-sm text-muted" id="formatHintText" style="line-height:1.8"></p>
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
    updateFormatHint();
  }

  function setMode(mode) {
    importMode = mode;
    document.getElementById('modeTabBroker').classList.toggle('active', mode === 'broker_statement');
    document.getElementById('modeTabTx').classList.toggle('active', mode === 'transactions');
    document.getElementById('modeTabAsset').classList.toggle('active', mode === 'assets');
    document.getElementById('importTypeGroup').style.display = mode === 'transactions' ? '' : 'none';
    const mapBox = document.getElementById('columnMapBox');
    if (mapBox && mode === 'broker_statement') mapBox.innerHTML = '';
    updateFormatHint();
    clearPreview();
  }

  function updateFormatHint() {
    if (importMode === 'broker_statement') {
      document.getElementById('formatHintText').innerHTML = `
        فایل <strong>گردش حساب</strong> خروجی مستقیم کارگزاری (با ستون‌های تاریخ، شرح، بدهکار، بستانکار، مانده) را بدون هیچ تغییری آپلود کنید.<br><br>
        سیستم به‌صورت خودکار از روی متن ستون «شرح» نوع معامله (خرید/فروش)، نماد، تعداد و قیمت را استخراج می‌کند. ردیف‌های غیرمعاملاتی (واریز، برداشت، کارمزد جدا) نادیده گرفته می‌شوند.
      `;
      return;
    }
    const fields = importMode === 'transactions' ? TX_FIELDS : ASSET_FIELDS;
    const required = fields.filter(f => f.required).map(f => f.label).join('، ');
    const optional = fields.filter(f => !f.required).map(f => f.label).join('، ');
    document.getElementById('formatHintText').innerHTML = `
      <strong>اجباری:</strong> ${required}<br>
      <strong>اختیاری:</strong> ${optional || '—'}<br><br>
      نام ستون‌های فایل شما هرچه باشد (فارسی یا انگلیسی، خروجی هر کارگزاری)، بعد از انتخاب فایل می‌توانید هر ستون فایل را به فیلد مناسب نسبت دهید — نیازی به تغییر فایل اصلی نیست.
    `;
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
        complete: (res) => loadParsedData(res.data),
        error: () => App.toast('خطا در خواندن فایل CSV', 'error')
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (typeof XLSX === 'undefined') {
            App.toast('کتابخانه خواندن اکسل لود نشده — صفحه را رفرش کنید', 'error');
            return;
          }
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
          loadParsedData(data);
        } catch (err) {
          App.toast('خطا در خواندن فایل اکسل: ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      App.toast('فقط فایل CSV یا Excel قابل قبول است', 'error');
    }
  }

  let brokerParsedRows = []; // cache for broker statement mode

  function loadParsedData(data) {
    data = data.filter(row => Object.values(row).some(v => String(v).trim() !== ''));
    if (!data.length) {
      App.toast('فایل خالی است یا قابل خواندن نیست', 'error');
      return;
    }
    rawData = data;
    rawHeaders = Object.keys(data[0]);

    // auto-suggest broker statement mode if it matches
    if (looksLikeBrokerStatement(rawHeaders) && importMode !== 'broker_statement') {
      setMode('broker_statement');
      rawData = data;
      rawHeaders = Object.keys(data[0]);
    }

    if (importMode === 'broker_statement') {
      brokerParsedRows = parseBrokerRows(rawData);
      renderBrokerPreview();
      return;
    }

    columnMap = autoGuessColumns();
    renderColumnMapper();
    renderPreviewFromMap();
  }

  function renderBrokerPreview() {
    const preview = document.getElementById('importPreview');
    const actions = document.getElementById('importActions');
    if (!preview) return;

    if (!brokerParsedRows.length) {
      preview.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>هیچ ردیف معامله‌ای در فایل شناسایی نشد. ممکن است فرمت فایل با گردش حساب استاندارد متفاوت باشد — از حالت «وارد کردن دستی» استفاده کنید.</p></div>';
      if (actions) actions.style.display = 'none';
      return;
    }

    const buyCount = brokerParsedRows.filter(r => r.type === 'buy').length;
    const sellCount = brokerParsedRows.filter(r => r.type === 'sell').length;

    preview.innerHTML = `
      <p class="text-sm text-muted mb-4">
        ✅ ${brokerParsedRows.length} معامله شناسایی شد
        (<span class="text-green">${buyCount} خرید</span> / <span class="text-red">${sellCount} فروش</span>)
        از ${rawData.length} ردیف فایل
      </p>
      <div class="table-wrap" style="max-height:340px;overflow-y:auto">
        <table>
          <thead><tr><th>تاریخ</th><th>نوع</th><th>نماد</th><th>تعداد</th><th>قیمت</th><th>کارمزد (تخمینی)</th></tr></thead>
          <tbody>
            ${brokerParsedRows.slice(0, 150).map(r => `<tr>
              <td class="ltr">${typeof Jalali !== 'undefined' ? Jalali.isoToJalaliStr(r.date) : r.jalaliDate}</td>
              <td><span class="badge ${App.txTypeBadge[r.type]}">${App.txTypeLabels[r.type]}</span></td>
              <td><strong>${r.symbol}</strong></td>
              <td class="ltr">${App.fmtNum(r.quantity, 4)}</td>
              <td class="ltr">${App.fmtNum(r.price)}</td>
              <td class="ltr text-muted">${App.fmtNum(r.fee)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${brokerParsedRows.length > 150 ? `<p class="text-sm text-muted mt-4">و ${brokerParsedRows.length - 150} ردیف دیگر...</p>` : ''}
      </div>
    `;
    if (actions) actions.style.display = '';
  }

  function autoGuessColumns() {
    const fields = importMode === 'transactions' ? TX_FIELDS : ASSET_FIELDS;
    const map = {};
    fields.forEach(f => {
      const candidates = GUESS[f.key] || [f.key];
      const normalizedHeaders = rawHeaders.map(h => ({ orig: h, norm: h.toLowerCase().trim() }));
      let found = null;
      for (const c of candidates) {
        const cNorm = c.toLowerCase().trim();
        const hit = normalizedHeaders.find(h => h.norm === cNorm || h.norm.includes(cNorm) || cNorm.includes(h.norm));
        if (hit) { found = hit.orig; break; }
      }
      map[f.key] = found || '';
    });
    return map;
  }

  function renderColumnMapper() {
    const fields = importMode === 'transactions' ? TX_FIELDS : ASSET_FIELDS;
    const box = document.getElementById('columnMapBox');
    if (!box) return;

    box.innerHTML = `
      <div class="card mt-4" style="background:var(--bg3)">
        <div class="card-title mb-4">🔗 نسبت دادن ستون‌های فایل به فیلدها</div>
        ${fields.map(f => `
          <div class="form-group">
            <label class="form-label">${f.label} ${f.required ? '<span class="text-red">*</span>' : ''}</label>
            <select class="form-control" data-field="${f.key}" onchange="Pages.import.updateMapping('${f.key}', this.value)">
              <option value="">— انتخاب نکنید / موجود نیست —</option>
              ${rawHeaders.map(h => `<option value="${h}" ${columnMap[f.key] === h ? 'selected' : ''}>${h}</option>`).join('')}
            </select>
          </div>
        `).join('')}
      </div>
    `;
  }

  function updateMapping(field, value) {
    columnMap[field] = value;
    renderPreviewFromMap();
  }

  function normalizeRow(row) {
    const fields = importMode === 'transactions' ? TX_FIELDS : ASSET_FIELDS;
    const out = {};
    fields.forEach(f => {
      const col = columnMap[f.key];
      let val = col ? row[col] : '';
      if (val === undefined) val = '';
      val = String(val).trim();

      if (['quantity', 'price', 'avgPrice', 'currentPrice', 'fee'].includes(f.key)) {
        // remove thousand separators, persian digits
        val = val.replace(/,/g, '').replace(/٬/g, '');
        val = val.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        out[f.key] = parseFloat(val) || 0;
      } else if (f.key === 'type') {
        const v = val.toLowerCase();
        if (v.includes('فروش') || v.includes('sell')) out[f.key] = 'sell';
        else if (v.includes('خرید') || v.includes('buy')) out[f.key] = 'buy';
        else out[f.key] = '';
      } else if (f.key === 'date') {
        out[f.key] = normalizeDate(val);
      } else {
        out[f.key] = val;
      }
    });
    return out;
  }

  function normalizeDate(val) {
    if (!val) return Jalali.todayISO();
    // Excel serial date number (Gregorian-based serial from spreadsheet)
    if (/^\d+(\.\d+)?$/.test(val) && Number(val) > 20000 && Number(val) < 80000) {
      const d = XLSX_dateFromSerial(Number(val));
      if (d) return d;
    }
    // Direct date pattern yyyy/mm/dd or yyyy-mm-dd — detect Jalali (13xx/14xx) vs Gregorian (19xx/20xx)
    const m = val.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m) {
      const [, y] = m;
      const yearNum = parseInt(y, 10);
      if (yearNum >= 1300 && yearNum <= 1500) {
        // Jalali date
        const iso = Jalali.parseJalaliStr(val);
        if (iso) return iso;
      }
      // Gregorian date
      const [, gy, mo, d] = m;
      return `${gy}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return Jalali.todayISO();
  }

  function XLSX_dateFromSerial(serial) {
    try {
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      const d = new Date(utc_value * 1000);
      return d.toISOString().split('T')[0];
    } catch (e) { return null; }
  }

  function renderPreviewFromMap() {
    const preview = document.getElementById('importPreview');
    const actions = document.getElementById('importActions');
    if (!preview) return;

    const fields = importMode === 'transactions' ? TX_FIELDS : ASSET_FIELDS;
    const requiredKeys = fields.filter(f => f.required).map(f => f.key);
    const missingRequired = requiredKeys.filter(k => !columnMap[k]);

    if (missingRequired.length) {
      const labels = fields.filter(f => missingRequired.includes(f.key)).map(f => f.label).join('، ');
      preview.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>لطفاً ستون‌های اجباری را مشخص کنید: ${labels}</p></div>`;
      if (actions) actions.style.display = 'none';
      return;
    }

    const rows = rawData.map(normalizeRow);
    const validRows = rows.filter(r => r.symbol && r.quantity > 0);

    if (!validRows.length) {
      preview.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>ردیف معتبری یافت نشد. نگاشت ستون‌ها را بررسی کنید</p></div>';
      if (actions) actions.style.display = 'none';
      return;
    }

    const cols = importMode === 'transactions'
      ? ['date', 'type', 'symbol', 'quantity', 'price', 'fee']
      : ['symbol', 'name', 'quantity', 'avgPrice', 'currentPrice'];
    const colLabels = { date: 'تاریخ', type: 'نوع', symbol: 'نماد', quantity: 'تعداد', price: 'قیمت', fee: 'کارمزد', name: 'نام', avgPrice: 'میانگین خرید', currentPrice: 'قیمت روز' };

    preview.innerHTML = `
      <p class="text-sm text-muted mb-4">✅ ${validRows.length} ردیف معتبر از ${rows.length} ردیف کل شناسایی شد</p>
      <div class="table-wrap" style="max-height:340px;overflow-y:auto">
        <table>
          <thead><tr>${cols.map(c => `<th>${colLabels[c]}</th>`).join('')}</tr></thead>
          <tbody>
            ${validRows.slice(0, 100).map(r => `<tr>
              ${cols.map(c => {
                if (c === 'type') return `<td>${r[c] ? (App.txTypeLabels[r[c]] || r[c]) : '<span class="text-muted">پیش‌فرض</span>'}</td>`;
                if (['quantity','price','fee','avgPrice','currentPrice'].includes(c)) return `<td class="ltr">${App.fmtNum(r[c], 4)}</td>`;
                if (c === 'date') return `<td class="ltr">${Jalali.isoToJalaliStr(r[c])}</td>`;
                return `<td>${r[c] || '—'}</td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
        ${validRows.length > 100 ? `<p class="text-sm text-muted mt-4">و ${validRows.length - 100} ردیف دیگر...</p>` : ''}
      </div>
    `;
    if (actions) actions.style.display = '';
  }

  function confirmImport() {
    const accountId = document.getElementById('import_account')?.value;
    if (!accountId) { App.toast('لطفاً حساب مقصد را انتخاب کنید', 'error'); return; }

    if (importMode === 'broker_statement') {
      if (!brokerParsedRows.length) { App.toast('ردیف معتبری برای وارد کردن وجود ندارد', 'error'); return; }
      // process chronologically (oldest first) so avgPrice accumulates correctly
      const ordered = [...brokerParsedRows].sort((a, b) => new Date(a.date) - new Date(b.date));
      let imported = 0;
      ordered.forEach(r => {
        const assets = DB.assets.byAccount(accountId);
        let asset = assets.find(a => a.symbol === r.symbol);
        if (!asset) {
          asset = DB.assets.add({ symbol: r.symbol, name: r.symbol, type: 'stock', accountId, quantity: 0, avgPrice: 0, currentPrice: r.price });
        }
        DB.transactions.add({
          type: r.type,
          accountId,
          assetId: asset.id,
          symbol: r.symbol,
          quantity: r.quantity,
          price: r.price,
          fee: r.fee || 0,
          date: r.date,
          description: r.description
        });
        imported++;
      });
      App.toast(`${imported} معامله از گردش حساب با موفقیت وارد شد`, 'success');
      clearPreview();
      return;
    }

    const rows = rawData.map(normalizeRow).filter(r => r.symbol && r.quantity > 0);
    if (!rows.length) { App.toast('ردیف معتبری برای وارد کردن وجود ندارد', 'error'); return; }

    let imported = 0;

    if (importMode === 'transactions') {
      const defaultType = document.getElementById('import_type')?.value || 'buy';
      rows.forEach(r => {
        const assets = DB.assets.byAccount(accountId);
        let asset = assets.find(a => a.symbol === r.symbol);
        const txType = r.type || defaultType;
        if (!asset) {
          asset = DB.assets.add({ symbol: r.symbol, name: r.symbol, type: 'stock', accountId, quantity: 0, avgPrice: 0, currentPrice: r.price });
        }
        DB.transactions.add({
          type: txType,
          accountId,
          assetId: asset.id,
          symbol: r.symbol,
          quantity: r.quantity,
          price: r.price,
          fee: r.fee || 0,
          date: r.date,
          description: r.description || 'وارد شده از فایل'
        });
        imported++;
      });
      App.toast(`${imported} معامله با موفقیت وارد شد`, 'success');
    } else {
      rows.forEach(r => {
        const assets = DB.assets.byAccount(accountId);
        let asset = assets.find(a => a.symbol === r.symbol);
        const data = {
          symbol: r.symbol,
          name: r.name || r.symbol,
          type: 'stock',
          accountId,
          quantity: r.quantity,
          avgPrice: r.avgPrice,
          currentPrice: r.currentPrice || r.avgPrice
        };
        if (asset) DB.assets.update(asset.id, data);
        else DB.assets.add(data);
        imported++;
      });
      App.toast(`${imported} دارایی با موفقیت وارد/بروزرسانی شد`, 'success');
    }

    clearPreview();
  }

  function clearPreview() {
    rawData = [];
    rawHeaders = [];
    columnMap = {};
    brokerParsedRows = [];
    const preview = document.getElementById('importPreview');
    if (preview) preview.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>فایلی انتخاب نشده</p></div>';
    const actions = document.getElementById('importActions');
    if (actions) actions.style.display = 'none';
    const box = document.getElementById('columnMapBox');
    if (box) box.innerHTML = '';
    const fi = document.getElementById('fileInput');
    if (fi) fi.value = '';
  }

  return { render, setMode, handleFile, updateMapping, confirmImport, clearPreview };
})();
