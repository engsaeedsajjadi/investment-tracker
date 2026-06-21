/* ===== REPORTS PAGE ===== */
Pages.reports = (() => {
  let charts = {};

  function render(el) {
    el.innerHTML = `
      <div class="section-header mb-6">
        <span class="section-title">📉 گزارش‌ها و نمودارها</span>
      </div>

      <div class="tabs">
        <button class="tab-btn active" onclick="Pages.reports.showTab('growth', this)">رشد سرمایه</button>
        <button class="tab-btn" onclick="Pages.reports.showTab('pnl', this)">سود/زیان</button>
        <button class="tab-btn" onclick="Pages.reports.showTab('allocation', this)">تفکیک دارایی</button>
        <button class="tab-btn" onclick="Pages.reports.showTab('accounts', this)">عملکرد حساب‌ها</button>
      </div>

      <div id="tab_growth">
        <div class="card mb-4">
          <div class="card-header">
            <span class="card-title">📈 نمودار رشد سرمایه</span>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm" onclick="Pages.reports.setGrowthRange(30)">۱ ماه</button>
              <button class="btn btn-ghost btn-sm" onclick="Pages.reports.setGrowthRange(90)">۳ ماه</button>
              <button class="btn btn-ghost btn-sm" onclick="Pages.reports.setGrowthRange(180)">۶ ماه</button>
              <button class="btn btn-ghost btn-sm" onclick="Pages.reports.setGrowthRange(365)">۱ سال</button>
            </div>
          </div>
          <div class="chart-wrap-lg"><canvas id="reportGrowthChart"></canvas></div>
        </div>
      </div>

      <div id="tab_pnl" style="display:none">
        <div class="card mb-4">
          <div class="card-header">
            <span class="card-title">💰 سود/زیان ماهانه</span>
          </div>
          <div class="chart-wrap-lg"><canvas id="reportPnlChart"></canvas></div>
        </div>
      </div>

      <div id="tab_allocation" style="display:none">
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">🥧 تفکیک بر اساس نوع دارایی</span></div>
            <div class="chart-wrap"><canvas id="reportTypeChart"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">🏦 تفکیک بر اساس حساب</span></div>
            <div class="chart-wrap"><canvas id="reportAccountChart"></canvas></div>
          </div>
        </div>
      </div>

      <div id="tab_accounts" style="display:none">
        <div class="card">
          <div class="card-header"><span class="card-title">🏆 عملکرد حساب‌ها</span></div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>حساب</th><th>نوع</th><th>دسته</th>
                  <th>اصل سرمایه</th><th>ارزش فعلی</th>
                  <th>سود/زیان</th><th>درصد سود</th><th>تعداد دارایی</th>
                </tr>
              </thead>
              <tbody id="reportAccountsBody"></tbody>
            </table>
          </div>
        </div>
        <div class="card mt-4">
          <div class="card-header"><span class="card-title">📋 جزئیات دارایی‌ها</span></div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>نماد</th><th>نوع</th><th>حساب</th><th>تعداد</th><th>میانگین خرید</th><th>قیمت روز</th><th>ارزش کل</th><th>سود/زیان</th><th>%</th></tr>
              </thead>
              <tbody id="reportAssetsBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    renderGrowthChart(180);
    renderAllocationCharts();
    renderAccountsTable();
    renderAssetsTable();
  }

  function showTab(tab, btn) {
    ['growth','pnl','allocation','accounts'].forEach(t => {
      document.getElementById(`tab_${t}`).style.display = t === tab ? '' : 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (tab === 'pnl') renderPnlChart();
    if (tab === 'allocation') renderAllocationCharts();
  }

  function renderGrowthChart(days) {
    const ctx = document.getElementById('reportGrowthChart');
    if (!ctx) return;
    if (charts.growth) { charts.growth.destroy(); }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const vals = DB.dailyValues.recent(days);

    const labels = vals.map(d => {
      const j = Jalali.fromGregorianDate(d.date);
      return j ? Jalali.persianDigits(`${j.jd} ${Jalali.monthNames[j.jm - 1].slice(0,3)}`) : '';
    });
    const data = vals.map(d => d.totalValue);

    charts.growth = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'ارزش کل سرمایه',
          data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + App.fmtCurrency(ctx.raw) } }
        },
        scales: {
          x: { grid: { color: '#2a304720' }, ticks: { color: '#8b92a8', font: { family: 'Vazirmatn', size: 10 }, maxTicksLimit: 10 } },
          y: { grid: { color: '#2a304760' }, ticks: { color: '#8b92a8', font: { family: 'Vazirmatn', size: 10 }, callback: v => App.fmtCurrency(v) } }
        }
      }
    });
  }

  function renderPnlChart() {
    const ctx = document.getElementById('reportPnlChart');
    if (!ctx) return;
    if (charts.pnl) { charts.pnl.destroy(); }

    const vals = DB.dailyValues.recent(365);
    // group by Jalali month
    const monthMap = {};
    const monthOrder = [];
    vals.forEach(v => {
      const j = Jalali.fromGregorianDate(v.date);
      if (!j) return;
      const key = `${j.jy}-${String(j.jm).padStart(2, '0')}`;
      if (!(key in monthMap)) monthOrder.push(key);
      monthMap[key] = v.totalValue; // last value of the month wins (vals are chronological)
    });
    const months = monthOrder.sort();
    const pnlData = months.map((m, i) => {
      if (i === 0) return 0;
      return monthMap[m] - monthMap[months[i - 1]];
    });
    const monthLabels = months.map(m => {
      const [jy, jm] = m.split('-').map(Number);
      return Jalali.persianDigits(Jalali.monthNames[jm - 1].slice(0, 3) + ' ' + String(jy).slice(-2));
    });

    charts.pnl = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'سود/زیان ماهانه',
          data: pnlData,
          backgroundColor: pnlData.map(v => v >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'),
          borderColor: pnlData.map(v => v >= 0 ? '#22c55e' : '#ef4444'),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#2a304720' }, ticks: { color: '#8b92a8', font: { family: 'Vazirmatn', size: 10 } } },
          y: { grid: { color: '#2a304760' }, ticks: { color: '#8b92a8', font: { family: 'Vazirmatn', size: 10 }, callback: v => App.fmtCurrency(v) } }
        }
      }
    });
  }

  function renderAllocationCharts() {
    const assets = DB.assets.getAll();
    const colors = { stock: '#3b82f6', gold: '#f59e0b', fixed_income: '#22c55e', forex: '#ef4444', cash: '#8b5cf6', other: '#6b7280' };
    const accentColors = ['#3b82f6','#f59e0b','#22c55e','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

    // by type
    const typeMap = {};
    assets.forEach(a => {
      const t = a.type || 'other';
      typeMap[t] = (typeMap[t] || 0) + a.currentPrice * a.quantity;
    });

    const ctx1 = document.getElementById('reportTypeChart');
    if (ctx1) {
      if (charts.type) charts.type.destroy();
      charts.type = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: Object.keys(typeMap).map(k => App.typeLabels[k] || k),
          datasets: [{ data: Object.values(typeMap), backgroundColor: Object.keys(typeMap).map(k => colors[k] || '#6b7280'), borderWidth: 2, borderColor: '#171b26' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b92a8', font: { family: 'Vazirmatn', size: 11 } } } }, cutout: '60%' }
      });
    }

    // by account
    const accounts = DB.accounts.getAll();
    const accMap2 = {};
    accounts.forEach(a => accMap2[a.id] = a.name);
    const accountMap = {};
    assets.forEach(a => {
      const name = accMap2[a.accountId] || 'سایر';
      accountMap[name] = (accountMap[name] || 0) + a.currentPrice * a.quantity;
    });

    const ctx2 = document.getElementById('reportAccountChart');
    if (ctx2) {
      if (charts.account) charts.account.destroy();
      charts.account = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: Object.keys(accountMap),
          datasets: [{ data: Object.values(accountMap), backgroundColor: accentColors, borderWidth: 2, borderColor: '#171b26' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b92a8', font: { family: 'Vazirmatn', size: 11 } } } }, cutout: '60%' }
      });
    }
  }

  function renderAccountsTable() {
    const tbody = document.getElementById('reportAccountsBody');
    if (!tbody) return;
    const accounts = DB.accounts.getAll();
    const assets = DB.assets.getAll();
    if (!accounts.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3)">حسابی ثبت نشده</td></tr>'; return; }
    tbody.innerHTML = accounts.map(acc => {
      const acAssets = assets.filter(a => a.accountId === acc.id);
      const value = DB.calc.portfolioTotal(acAssets);
      const cost = DB.calc.portfolioCost(acAssets);
      const pnl = value - cost;
      const pct = cost > 0 ? (pnl / cost) * 100 : 0;
      return `<tr>
        <td><strong>${acc.name}</strong></td>
        <td><span class="badge ${acc.type === 'haghighi' ? 'badge-blue' : 'badge-purple'}">${App.accountTypeLabels[acc.type] || acc.type}</span></td>
        <td><span class="badge badge-gold">${App.catLabels[acc.category] || acc.category}</span></td>
        <td class="ltr">${App.fmtCurrency(cost)}</td>
        <td class="ltr font-bold">${App.fmtCurrency(value)}</td>
        <td class="${App.pnlClass(pnl)} ltr">${App.fmtCurrency(pnl)}</td>
        <td class="${App.pnlClass(pct)}"><span class="badge ${App.pnlBadge(pct)}">${App.fmtPct(pct)}</span></td>
        <td class="ltr">${acAssets.length}</td>
      </tr>`;
    }).join('');
  }

  function renderAssetsTable() {
    const tbody = document.getElementById('reportAssetsBody');
    if (!tbody) return;
    const assets = DB.assets.getAll();
    const accounts = DB.accounts.getAll();
    const accMap = {};
    accounts.forEach(a => accMap[a.id] = a.name);
    if (!assets.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3)">دارایی ثبت نشده</td></tr>'; return; }
    const sorted = [...assets].sort((a, b) => (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity));
    tbody.innerHTML = sorted.map(a => {
      const pnl = DB.calc.assetPnL(a);
      return `<tr>
        <td><strong>${a.symbol}</strong></td>
        <td><span class="badge badge-gray">${App.typeLabels[a.type] || a.type}</span></td>
        <td class="text-muted">${accMap[a.accountId] || '—'}</td>
        <td class="ltr">${App.fmtNum(a.quantity, 4)}</td>
        <td class="ltr">${App.fmtNum(a.avgPrice)}</td>
        <td class="ltr">${App.fmtNum(a.currentPrice)}</td>
        <td class="ltr font-bold">${App.fmtCurrency(pnl.current)}</td>
        <td class="${App.pnlClass(pnl.value)} ltr">${App.fmtNum(pnl.value)}</td>
        <td class="${App.pnlClass(pnl.percent)}"><span class="badge ${App.pnlBadge(pnl.percent)}">${App.fmtPct(pnl.percent)}</span></td>
      </tr>`;
    }).join('');
  }

  function setGrowthRange(days) { renderGrowthChart(days); }

  return { render, showTab, setGrowthRange };
})();
