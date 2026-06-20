/* ===== ACCOUNTS PAGE ===== */
Pages.accounts = (() => {

  function render(el) {
    el.innerHTML = `
      <div class="section-header mb-6">
        <span class="section-title">🏦 مدیریت حساب‌ها</span>
        <button class="btn btn-primary" onclick="Pages.accounts.openAddModal()">+ افزودن حساب</button>
      </div>
      <div id="accountsGrid"></div>
    `;
    renderGrid();
  }

  function renderGrid() {
    const accounts = DB.accounts.getAll();
    const assets = DB.assets.getAll();
    const grid = document.getElementById('accountsGrid');
    if (!grid) return;

    if (!accounts.length) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🏦</div><p>هنوز حسابی ثبت نشده است</p><button class="btn btn-primary" onclick="Pages.accounts.openAddModal()">+ اولین حساب را اضافه کنید</button></div>`;
      return;
    }

    grid.innerHTML = `<div class="grid-2">` + accounts.map(acc => {
      const acAssets = assets.filter(a => a.accountId === acc.id);
      const value = DB.calc.portfolioTotal(acAssets);
      const cost = DB.calc.portfolioCost(acAssets);
      const pnl = value - cost;
      const pct = cost > 0 ? (pnl / cost) * 100 : 0;
      const catBadgeClass = acc.category === 'broker' ? 'badge-gold' : acc.category === 'forex' ? 'badge-red' : 'badge-green';

      return `<div class="card">
        <div class="card-header">
          <div>
            <div class="flex items-center gap-2 mb-4">
              <span class="badge ${acc.type === 'haghighi' ? 'badge-blue' : 'badge-purple'}">${App.accountTypeLabels[acc.type] || acc.type}</span>
              <span class="badge ${catBadgeClass}">${App.catLabels[acc.category] || acc.category}</span>
            </div>
            <div style="font-size:1.05rem;font-weight:700">${acc.name}</div>
            <div class="text-muted text-sm mt-4">${acc.description || ''}</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick="Pages.accounts.openEditModal('${acc.id}')">✏️</button>
            <button class="btn btn-ghost btn-sm" onclick="Pages.accounts.confirmDelete('${acc.id}')">🗑️</button>
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:8px">
          <div class="flex justify-between mb-4">
            <span class="text-muted text-sm">ارزش فعلی</span>
            <span class="font-bold ltr">${App.fmtCurrency(value)}</span>
          </div>
          <div class="flex justify-between mb-4">
            <span class="text-muted text-sm">اصل سرمایه</span>
            <span class="ltr">${App.fmtCurrency(cost)}</span>
          </div>
          <div class="flex justify-between mb-4">
            <span class="text-muted text-sm">سود/زیان</span>
            <span class="${App.pnlClass(pnl)} ltr">${App.fmtCurrency(pnl)} (${App.fmtPct(pct)})</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted text-sm">تعداد دارایی</span>
            <span class="ltr">${acAssets.length} دارایی</span>
          </div>
        </div>
        <div style="margin-top:14px">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(100, Math.abs(pct))}%;background:${pnl >= 0 ? 'var(--green)' : 'var(--red)'}"></div>
          </div>
        </div>
      </div>`;
    }).join('') + `</div>`;
  }

  function openAddModal() {
    App.openModal('افزودن حساب جدید', formHTML(), {
      onOpen: () => {}
    });
    const mb = document.getElementById('modalBody');
    mb.innerHTML += `<div class="modal-footer" style="margin:0 -20px -20px;padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="App.closeModal()">انصراف</button>
      <button class="btn btn-primary" onclick="Pages.accounts.save()">ذخیره</button>
    </div>`;
  }

  function openEditModal(id) {
    const acc = DB.accounts.get(id);
    if (!acc) return;
    App.openModal('ویرایش حساب', formHTML(acc), {});
    const mb = document.getElementById('modalBody');
    mb.innerHTML += `<div class="modal-footer" style="margin:0 -20px -20px;padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost" onclick="App.closeModal()">انصراف</button>
      <button class="btn btn-primary" onclick="Pages.accounts.save('${id}')">ذخیره</button>
    </div>`;
  }

  function formHTML(acc = {}) {
    return `
      <div class="form-group">
        <label class="form-label">نام حساب / کارگزاری *</label>
        <input type="text" class="form-control" id="f_name" placeholder="مثال: کارگزاری مفید" value="${acc.name || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">نوع حساب</label>
          <select class="form-control" id="f_type">
            <option value="haghighi" ${acc.type === 'haghighi' ? 'selected' : ''}>حقیقی</option>
            <option value="hoghooghi" ${acc.type === 'hoghooghi' ? 'selected' : ''}>حقوقی</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">دسته‌بندی</label>
          <select class="form-control" id="f_category">
            <option value="broker" ${acc.category === 'broker' ? 'selected' : ''}>کارگزاری</option>
            <option value="portfolio_manager" ${acc.category === 'portfolio_manager' ? 'selected' : ''}>سبدگردان</option>
            <option value="forex" ${acc.category === 'forex' ? 'selected' : ''}>فارکس</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">توضیحات</label>
        <input type="text" class="form-control" id="f_desc" placeholder="توضیح اختیاری" value="${acc.description || ''}">
      </div>
    `;
  }

  function save(id = null) {
    const name = document.getElementById('f_name')?.value?.trim();
    if (!name) { App.toast('نام حساب الزامی است', 'error'); return; }
    const obj = {
      name,
      type: document.getElementById('f_type').value,
      category: document.getElementById('f_category').value,
      description: document.getElementById('f_desc').value.trim()
    };
    if (id) { DB.accounts.update(id, obj); App.toast('حساب ویرایش شد', 'success'); }
    else { DB.accounts.add(obj); App.toast('حساب افزوده شد', 'success'); }
    App.closeModal();
    renderGrid();
  }

  function confirmDelete(id) {
    const acc = DB.accounts.get(id);
    if (!confirm(`آیا از حذف حساب "${acc?.name}" مطمئنید؟\nتمام دارایی‌ها و معاملات این حساب نیز حذف می‌شوند.`)) return;
    DB.accounts.delete(id);
    App.toast('حساب حذف شد', 'success');
    renderGrid();
  }

  return { render, openAddModal, openEditModal, save, confirmDelete };
})();
