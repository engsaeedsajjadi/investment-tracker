/* ===== DAILY UPDATE PAGE ===== */
Pages.daily = (() => {

  function render(el) {
    const accounts = DB.accounts.getAll();
    const assets = DB.assets.getAll();

    el.innerHTML = `
      <div class="section-header mb-6">
        <span class="section-title">📅 ثبت ارزش روزانه</span>
      </div>

      <div class="grid-2">
        <!-- Quick price update -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">⚡ بروزرسانی سریع قیمت دارایی‌ها</span>
          </div>
          <div class="form-group">
            <label class="form-label">تاریخ</label>
            <input type="text" class="form-control ltr" id="d_date" placeholder="۱۴۰۳/۰۱/۰۱">
          </div>
          <div id="priceUpdateList">
            ${assets.length === 0 ? '<p class="text-muted text-sm">دارایی‌ای برای بروزرسانی وجود ندارد</p>' :
              assets.map(a => `
              <div class="flex items-center gap-3 mb-4" style="border-bottom:1px solid var(--border);padding-bottom:10px">
                <div style="flex:1">
                  <div class="font-bold text-sm">${a.symbol}</div>
                  <div class="text-muted text-sm">${a.name || ''}</div>
                </div>
                <div style="width:140px">
                  <input type="number" class="form-control ltr" data-asset-id="${a.id}"
                    value="${a.currentPrice || 0}" step="any" min="0"
                    placeholder="قیمت روز">
                </div>
              </div>`).join('')}
          </div>
          ${assets.length > 0 ? `<button class="btn btn-primary btn-block mt-4" onclick="Pages.daily.savePrices()">💾 ذخیره قیمت‌ها و ثبت روز</button>` : ''}
        </div>

        <!-- Total value by account -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">🏦 ثبت ارزش کل هر حساب</span>
          </div>
          <p class="text-muted text-sm mb-4">اگر قیمت تک‌تک دارایی‌ها را نمی‌دانید، ارزش کل حساب را وارد کنید</p>
          ${accounts.length === 0 ? '<p class="text-muted text-sm">حسابی ثبت نشده</p>' :
            accounts.map(acc => {
              const acAssets = assets.filter(a => a.accountId === acc.id);
              const curVal = DB.calc.portfolioTotal(acAssets);
              return `<div class="mb-4">
                <label class="form-label">${acc.name}</label>
                <div class="flex gap-2">
                  <input type="number" class="form-control ltr" id="dv_${acc.id}"
                    placeholder="${App.fmtNum(curVal)}" step="any" min="0">
                </div>
              </div>`;
            }).join('')}
          ${accounts.length > 0 ? `<button class="btn btn-success btn-block" onclick="Pages.daily.saveAccountValues()">📊 ثبت ارزش حساب‌ها</button>` : ''}
        </div>
      </div>

      <div class="card mt-6">
        <div class="card-header">
          <span class="card-title">📋 آخرین ثبت‌ها</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>تاریخ</th><th>حساب</th><th>ارزش کل</th><th>یادداشت</th></tr>
            </thead>
            <tbody id="dailyHistoryBody"></tbody>
          </table>
        </div>
      </div>
    `;

    renderHistory(accounts);
    JalaliDatePicker.attach('d_date', { initialISO: Jalali.todayISO() });
  }

  function renderHistory(accounts) {
    const tbody = document.getElementById('dailyHistoryBody');
    if (!tbody) return;
    const accMap = {};
    (accounts || DB.accounts.getAll()).forEach(a => accMap[a.id] = a.name);
    const vals = DB.dailyValues.recent(30).reverse().slice(0, 20);
    if (!vals.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text3)">ثبتی وجود ندارد</td></tr>'; return; }
    tbody.innerHTML = vals.map(v => `<tr>
      <td class="ltr">${App.fmtDate(v.date)}</td>
      <td>${v.accountId ? (accMap[v.accountId] || '—') : '<em class="text-muted">کل پرتفو</em>'}</td>
      <td class="ltr font-bold">${App.fmtCurrency(v.totalValue)}</td>
      <td class="text-muted">${v.note || '—'}</td>
    </tr>`).join('');
  }

  function savePrices() {
    const date = JalaliDatePicker.getISOValue('d_date') || Jalali.todayISO();
    const inputs = document.querySelectorAll('[data-asset-id]');
    let updated = 0;
    let total = 0;
    inputs.forEach(inp => {
      const id = inp.dataset.assetId;
      const price = parseFloat(inp.value);
      if (!isNaN(price) && price >= 0) {
        DB.assets.update(id, { currentPrice: price });
        const asset = DB.assets.get(id);
        total += price * (asset?.quantity || 0);
        updated++;
      }
    });

    // save as daily snapshot
    if (date && total > 0) {
      DB.dailyValues.add({ date, accountId: null, totalValue: total, note: 'بروزرسانی دستی' });
    }

    App.toast(`${updated} دارایی بروزرسانی شد`, 'success');
    renderHistory();
  }

  function saveAccountValues() {
    const date = JalaliDatePicker.getISOValue('d_date') || Jalali.todayISO();
    const accounts = DB.accounts.getAll();
    let saved = 0;
    accounts.forEach(acc => {
      const inp = document.getElementById(`dv_${acc.id}`);
      if (!inp) return;
      const val = parseFloat(inp.value);
      if (!isNaN(val) && val > 0) {
        DB.dailyValues.add({ date, accountId: acc.id, totalValue: val, note: 'ثبت دستی حساب' });
        saved++;
        inp.value = '';
      }
    });
    if (saved > 0) {
      App.toast(`ارزش ${saved} حساب ثبت شد`, 'success');
      renderHistory(accounts);
    } else {
      App.toast('مقداری وارد نشده', 'error');
    }
  }

  return { render, savePrices, saveAccountValues };
})();
