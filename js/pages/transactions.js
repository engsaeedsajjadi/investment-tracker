/* ===== TRANSACTIONS PAGE ===== */
Pages.transactions = (() => {

  function render(el) {
    const accounts = DB.accounts.getAll();
    el.innerHTML = `
      <div class="section-header mb-4">
        <span class="section-title">💸 معاملات</span>
        <button class="btn btn-primary" onclick="Pages.transactions.openAddModal()">+ معامله جدید</button>
      </div>
      <div class="filter-bar mb-4">
        <input type="text" class="form-control search-input" id="txSearch" placeholder="جستجوی نماد یا توضیحات..." oninput="Pages.transactions.filterTable()">
        <select class="form-control" id="txTypeFilter" onchange="Pages.transactions.filterTable()">
          <option value="">همه انواع</option>
          <option value="buy">خرید</option>
          <option value="sell">فروش</option>
          <option value="deposit">واریز</option>
          <option value="withdraw">برداشت</option>
          <option value="transfer">انتقال</option>
        </select>
        <select class="form-control" id="txAccountFilter" onchange="Pages.transactions.filterTable()">
          <option value="">همه حساب‌ها</option>
          ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
        </select>
        <input type="date" class="form-control" id="txDateFrom" onchange="Pages.transactions.filterTable()" placeholder="از تاریخ">
        <input type="date" class="form-control" id="txDateTo" onchange="Pages.transactions.filterTable()" placeholder="تا تاریخ">
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>نوع</th>
                <th>نماد</th>
                <th>حساب</th>
                <th>تعداد</th>
                <th>قیمت</th>
                <th>کارمزد</th>
                <th>ارزش کل</th>
                <th>توضیحات</th>
                <th>حذف</th>
              </tr>
            </thead>
            <tbody id="txTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
    renderTable();
  }

  function renderTable() {
    const tbody = document.getElementById('txTableBody');
    if (!tbody) return;
    const accounts = DB.accounts.getAll();
    const accMap = {};
    accounts.forEach(a => accMap[a.id] = a.name);

    const search = document.getElementById('txSearch')?.value?.toLowerCase() || '';
    const typeF = document.getElementById('txTypeFilter')?.value || '';
    const accF = document.getElementById('txAccountFilter')?.value || '';
    const dateFrom = document.getElementById('txDateFrom')?.value || '';
    const dateTo = document.getElementById('txDateTo')?.value || '';

    let txs = DB.transactions.getAll();
    if (search) txs = txs.filter(t => (t.symbol || '').toLowerCase().includes(search) || (t.description || '').toLowerCase().includes(search));
    if (typeF) txs = txs.filter(t => t.type === typeF);
    if (accF) txs = txs.filter(t => t.accountId === accF);
    if (dateFrom) txs = txs.filter(t => t.date >= dateFrom);
    if (dateTo) txs = txs.filter(t => t.date <= dateTo);

    if (!txs.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text3)">معامله‌ای ثبت نشده است</td></tr>';
      return;
    }

    tbody.innerHTML = txs.map(t => {
      const total = (t.price || 0) * (t.quantity || 0);
      return `<tr>
        <td class="ltr">${App.fmtDate(t.date)}</td>
        <td><span class="badge ${App.txTypeBadge[t.type] || 'badge-gray'}">${App.txTypeLabels[t.type] || t.type}</span></td>
        <td class="ltr"><strong>${t.symbol || '—'}</strong></td>
        <td class="text-muted">${accMap[t.accountId] || '—'}</td>
        <td class="ltr">${t.quantity ? App.fmtNum(t.quantity, 4) : '—'}</td>
        <td class="ltr">${t.price ? App.fmtNum(t.price) : '—'}</td>
        <td class="ltr text-muted">${t.fee ? App.fmtNum(t.fee) : '—'}</td>
        <td class="ltr font-bold">${total ? App.fmtCurrency(total) : '—'}</td>
        <td class="text-muted text-sm">${t.description || '—'}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="Pages.transactions.confirmDelete('${t.id}')">🗑️</button></td>
      </tr>`;
    }).join('');
  }

  function filterTable() { renderTable(); }

  function openAddModal() {
    const accounts = DB.accounts.getAll();
    const assets = DB.assets.getAll();
    App.openModal('ثبت معامله جدید', formHTML(accounts, assets));
    document.getElementById('modalBody').innerHTML += `<div class="modal-footer" style="margin:0 -20px -20px;padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="App.closeModal()">انصراف</button>
      <button class="btn btn-primary" onclick="Pages.transactions.save()">ثبت معامله</button>
    </div>`;
    updateFormVisibility();
  }

  function formHTML(accounts, assets) {
    return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">نوع معامله *</label>
          <select class="form-control" id="ft_type" onchange="Pages.transactions.updateFormVisibility()">
            <option value="buy">خرید</option>
            <option value="sell">فروش</option>
            <option value="deposit">واریز</option>
            <option value="withdraw">برداشت</option>
            <option value="transfer">انتقال</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">تاریخ *</label>
          <input type="date" class="form-control ltr" id="ft_date" value="${new Date().toISOString().split('T')[0]}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">حساب *</label>
        <select class="form-control" id="ft_account" onchange="Pages.transactions.updateAssets()">
          <option value="">— انتخاب حساب —</option>
          ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" id="ft_asset_group">
        <label class="form-label">دارایی / نماد</label>
        <select class="form-control" id="ft_asset">
          <option value="">— انتخاب دارایی یا وارد کردن دستی —</option>
          ${assets.map(a => `<option value="${a.id}" data-symbol="${a.symbol}">${a.symbol} - ${a.name || ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" id="ft_symbol_group">
        <label class="form-label">نماد (دستی)</label>
        <input type="text" class="form-control ltr" id="ft_symbol" placeholder="اگر در لیست نیست، اینجا وارد کنید">
      </div>
      <div class="form-row" id="ft_qty_price_group">
        <div class="form-group">
          <label class="form-label">تعداد / حجم</label>
          <input type="number" class="form-control ltr" id="ft_qty" value="0" step="any" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">قیمت هر واحد</label>
          <input type="number" class="form-control ltr" id="ft_price" value="0" step="any" min="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">کارمزد</label>
          <input type="number" class="form-control ltr" id="ft_fee" value="0" step="any" min="0">
        </div>
        <div class="form-group" id="ft_to_account_group" style="display:none">
          <label class="form-label">حساب مقصد (انتقال)</label>
          <select class="form-control" id="ft_to_account">
            <option value="">—</option>
            ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="ft_amount_group" style="display:none">
          <label class="form-label">مبلغ</label>
          <input type="number" class="form-control ltr" id="ft_amount" value="0" step="any" min="0">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">توضیحات</label>
        <input type="text" class="form-control" id="ft_desc" placeholder="توضیح اختیاری">
      </div>
    `;
  }

  function updateFormVisibility() {
    const type = document.getElementById('ft_type')?.value;
    if (!type) return;
    const isTradeType = type === 'buy' || type === 'sell';
    const isTransfer = type === 'transfer';

    document.getElementById('ft_asset_group').style.display = isTradeType ? '' : 'none';
    document.getElementById('ft_symbol_group').style.display = isTradeType ? '' : 'none';
    document.getElementById('ft_qty_price_group').style.display = isTradeType ? '' : 'none';
    document.getElementById('ft_to_account_group').style.display = isTransfer ? '' : 'none';
    document.getElementById('ft_amount_group').style.display = !isTradeType ? '' : 'none';
  }

  function updateAssets() {
    const accId = document.getElementById('ft_account')?.value;
    if (!accId) return;
    const assets = DB.assets.byAccount(accId);
    const select = document.getElementById('ft_asset');
    if (!select) return;
    select.innerHTML = `<option value="">— انتخاب دارایی —</option>` +
      assets.map(a => `<option value="${a.id}" data-symbol="${a.symbol}">${a.symbol} - ${a.name || ''}</option>`).join('');
  }

  function save() {
    const type = document.getElementById('ft_type')?.value;
    const accountId = document.getElementById('ft_account')?.value;
    const date = document.getElementById('ft_date')?.value;
    if (!type || !accountId || !date) { App.toast('لطفاً نوع، حساب و تاریخ را وارد کنید', 'error'); return; }

    const isTradeType = type === 'buy' || type === 'sell';
    const assetId = isTradeType ? document.getElementById('ft_asset')?.value || null : null;
    const assetOpt = assetId ? document.getElementById('ft_asset').selectedOptions[0] : null;
    const symbol = (isTradeType ? (assetOpt?.dataset.symbol || document.getElementById('ft_symbol')?.value) : '') || '';

    const obj = {
      type, accountId, date,
      assetId: assetId || null,
      symbol,
      quantity: parseFloat(document.getElementById('ft_qty')?.value) || 0,
      price: parseFloat(document.getElementById('ft_price')?.value) || 0,
      fee: parseFloat(document.getElementById('ft_fee')?.value) || 0,
      toAccountId: document.getElementById('ft_to_account')?.value || null,
      amount: parseFloat(document.getElementById('ft_amount')?.value) || 0,
      description: document.getElementById('ft_desc')?.value || ''
    };

    DB.transactions.add(obj);
    App.toast('معامله ثبت شد', 'success');
    App.closeModal();
    renderTable();
  }

  function confirmDelete(id) {
    if (!confirm('آیا از حذف این معامله مطمئنید؟')) return;
    DB.transactions.delete(id);
    App.toast('معامله حذف شد', 'success');
    renderTable();
  }

  return { render, filterTable, openAddModal, save, updateFormVisibility, updateAssets, confirmDelete };
})();
