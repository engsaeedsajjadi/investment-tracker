/* ===== ASSETS PAGE ===== */
Pages.assets = (() => {

  function render(el) {
    const accounts = DB.accounts.getAll();
    el.innerHTML = `
      <div class="section-header mb-4">
        <span class="section-title">📈 مدیریت دارایی‌ها</span>
        <button class="btn btn-primary" onclick="Pages.assets.openAddModal()">+ افزودن دارایی</button>
      </div>
      <div class="filter-bar mb-4">
        <input type="text" class="form-control search-input" id="assetSearch" placeholder="جستجوی نماد یا نام..." oninput="Pages.assets.filterTable()">
        <select class="form-control" id="assetTypeFilter" onchange="Pages.assets.filterTable()">
          <option value="">همه انواع</option>
          <option value="stock">سهام</option>
          <option value="gold">طلا</option>
          <option value="fixed_income">درآمد ثابت</option>
          <option value="forex">فارکس</option>
          <option value="cash">نقد</option>
        </select>
        <select class="form-control" id="assetAccountFilter" onchange="Pages.assets.filterTable()">
          <option value="">همه حساب‌ها</option>
          ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
        </select>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>نماد</th>
                <th>نام</th>
                <th>نوع</th>
                <th>حساب</th>
                <th>تعداد</th>
                <th>میانگین خرید</th>
                <th>قیمت روز</th>
                <th>ارزش کل</th>
                <th>سود/زیان (مبلغ)</th>
                <th>سود/زیان (%)</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody id="assetsTableBody"></tbody>
          </table>
        </div>
      </div>
      <div id="assetsSummary" class="mt-4"></div>
    `;
    renderTable();
  }

  function getRows() {
    const assets = DB.assets.getAll();
    const accounts = DB.accounts.getAll();
    const accountMap = {};
    accounts.forEach(a => accountMap[a.id] = a.name);
    return assets.map(a => ({ ...a, accountName: accountMap[a.accountId] || '—' }));
  }

  function renderTable() {
    const tbody = document.getElementById('assetsTableBody');
    if (!tbody) return;
    const search = document.getElementById('assetSearch')?.value?.toLowerCase() || '';
    const typeFilter = document.getElementById('assetTypeFilter')?.value || '';
    const accFilter = document.getElementById('assetAccountFilter')?.value || '';

    let rows = getRows();
    if (search) rows = rows.filter(a => (a.symbol || '').toLowerCase().includes(search) || (a.name || '').toLowerCase().includes(search));
    if (typeFilter) rows = rows.filter(a => a.type === typeFilter);
    if (accFilter) rows = rows.filter(a => a.accountId === accFilter);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--text3)">دارایی‌ای یافت نشد</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(a => {
      const pnl = DB.calc.assetPnL(a);
      return `<tr>
        <td><strong>${a.symbol}</strong></td>
        <td class="text-muted">${a.name || '—'}</td>
        <td><span class="badge badge-gray">${App.typeLabels[a.type] || a.type}</span></td>
        <td class="text-muted">${a.accountName}</td>
        <td class="ltr">${App.fmtNum(a.quantity, 4)}</td>
        <td class="ltr">${App.fmtNum(a.avgPrice)}</td>
        <td>
          <div class="flex items-center gap-2">
            <input type="number" class="form-control ltr" style="width:120px;padding:4px 8px"
              value="${a.currentPrice || 0}"
              onchange="Pages.assets.updatePrice('${a.id}', this.value)"
              step="any">
          </div>
        </td>
        <td class="ltr font-bold">${App.fmtCurrency(pnl.current)}</td>
        <td class="${App.pnlClass(pnl.value)} ltr">${App.fmtNum(pnl.value)}</td>
        <td class="${App.pnlClass(pnl.percent)}"><span class="badge ${App.pnlBadge(pnl.percent)}">${App.fmtPct(pnl.percent)}</span></td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="Pages.assets.openEditModal('${a.id}')">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="Pages.assets.confirmDelete('${a.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    // summary
    const summary = document.getElementById('assetsSummary');
    if (summary) {
      const totalVal = rows.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
      const totalCost = rows.reduce((s, a) => s + a.avgPrice * a.quantity, 0);
      const pnl = totalVal - totalCost;
      const pct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
      summary.innerHTML = `
        <div class="card">
          <div class="flex gap-3" style="flex-wrap:wrap">
            <div><span class="text-muted text-sm">مجموع ارزش فعلی: </span><strong class="ltr">${App.fmtCurrency(totalVal)}</strong></div>
            <div style="color:var(--border)">|</div>
            <div><span class="text-muted text-sm">اصل سرمایه: </span><strong class="ltr">${App.fmtCurrency(totalCost)}</strong></div>
            <div style="color:var(--border)">|</div>
            <div><span class="text-muted text-sm">سود/زیان: </span><strong class="${App.pnlClass(pnl)} ltr">${App.fmtCurrency(pnl)} (${App.fmtPct(pct)})</strong></div>
          </div>
        </div>`;
    }
  }

  function filterTable() { renderTable(); }

  function updatePrice(id, val) {
    const price = parseFloat(val);
    if (isNaN(price) || price < 0) return;
    DB.assets.update(id, { currentPrice: price });
    App.toast('قیمت روز ذخیره شد', 'success');
    renderTable();
  }

  function openAddModal() {
    const accounts = DB.accounts.getAll();
    App.openModal('افزودن دارایی جدید', formHTML(null, accounts));
    document.getElementById('modalBody').innerHTML += modalFooter('Pages.assets.save()');
  }

  function openEditModal(id) {
    const asset = DB.assets.get(id);
    const accounts = DB.accounts.getAll();
    if (!asset) return;
    App.openModal('ویرایش دارایی', formHTML(asset, accounts));
    document.getElementById('modalBody').innerHTML += modalFooter(`Pages.assets.save('${id}')`);
  }

  function modalFooter(saveCall) {
    return `<div class="modal-footer" style="margin:0 -20px -20px;padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="App.closeModal()">انصراف</button>
      <button class="btn btn-primary" onclick="${saveCall}">ذخیره</button>
    </div>`;
  }

  function formHTML(a = {}, accounts = []) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">نماد *</label>
          <input type="text" class="form-control ltr" id="fa_symbol" placeholder="مثال: خودرو، EURUSD" value="${a?.symbol || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">نام دارایی</label>
          <input type="text" class="form-control" id="fa_name" placeholder="نام کامل" value="${a?.name || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">نوع دارایی</label>
          <select class="form-control" id="fa_type">
            ${['stock','gold','fixed_income','forex','cash'].map(t => `<option value="${t}" ${a?.type === t ? 'selected' : ''}>${App.typeLabels[t]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">حساب</label>
          <select class="form-control" id="fa_account">
            <option value="">— انتخاب حساب —</option>
            ${accounts.map(ac => `<option value="${ac.id}" ${a?.accountId === ac.id ? 'selected' : ''}>${ac.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">تعداد</label>
          <input type="number" class="form-control ltr" id="fa_qty" value="${a?.quantity || 0}" step="any" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">میانگین خرید</label>
          <input type="number" class="form-control ltr" id="fa_avg" value="${a?.avgPrice || 0}" step="any" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">قیمت روز</label>
          <input type="number" class="form-control ltr" id="fa_cur" value="${a?.currentPrice || 0}" step="any" min="0">
        </div>
      </div>
    `;
  }

  function save(id = null) {
    const symbol = document.getElementById('fa_symbol')?.value?.trim();
    if (!symbol) { App.toast('نماد الزامی است', 'error'); return; }
    const obj = {
      symbol,
      name: document.getElementById('fa_name').value.trim(),
      type: document.getElementById('fa_type').value,
      accountId: document.getElementById('fa_account').value || null,
      quantity: parseFloat(document.getElementById('fa_qty').value) || 0,
      avgPrice: parseFloat(document.getElementById('fa_avg').value) || 0,
      currentPrice: parseFloat(document.getElementById('fa_cur').value) || 0,
    };
    if (id) { DB.assets.update(id, obj); App.toast('دارایی ویرایش شد', 'success'); }
    else { DB.assets.add(obj); App.toast('دارایی افزوده شد', 'success'); }
    App.closeModal();
    renderTable();
  }

  function confirmDelete(id) {
    const a = DB.assets.get(id);
    if (!confirm(`آیا از حذف دارایی "${a?.symbol}" مطمئنید؟`)) return;
    DB.assets.delete(id);
    App.toast('دارایی حذف شد', 'success');
    renderTable();
  }

  return { render, filterTable, updatePrice, openAddModal, openEditModal, save, confirmDelete };
})();
