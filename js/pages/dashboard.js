/* ===== DASHBOARD PAGE ===== */
Pages.dashboard = (() => {
  let growthChart = null;
  let allocChart = null;

  function render(el) {
    const assets = DB.assets.getAll();
    const accounts = DB.accounts.getAll();
    const dailyVals = DB.dailyValues.recent(180);

    const totalValue = DB.calc.portfolioTotal(assets);
    const totalCost = DB.calc.portfolioCost(assets);
    const totalPnL = totalValue - totalCost;
    const totalPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    // allocations by type
    const typeMap = {};
    assets.forEach(a => {
      const t = a.type || 'other';
      typeMap[t] = (typeMap[t] || 0) + a.currentPrice * a.quantity;
    });

    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon">💰</div>
          <div class="stat-label">ارزش کل سرمایه</div>
          <div class="stat-value text-blue">${App.fmtCurrency(totalValue)}</div>
          <div class="stat-change text-muted">${App.fmtNum(totalValue)} تومان</div>
        </div>
        <div class="stat-card ${totalPnL >= 0 ? 'green' : 'red'}">
          <div class="stat-icon">${totalPnL >= 0 ? '📈' : '📉'}</div>
          <div class="stat-label">سود / زیان کل</div>
          <div class="stat-value ${App.pnlClass(totalPnL)}">${App.fmtCurrency(totalPnL)}</div>
          <div class="stat-change ${App.pnlClass(totalPct)}">${App.fmtPct(totalPct)}</div>
        </div>
        <div class="stat-card gold">
          <div class="stat-icon">🏦</div>
          <div class="stat-label">تعداد حساب‌ها</div>
          <div class="stat-value text-gold">${App.fmtNum(accounts.length)}</div>
          <div class="stat-change text-muted">${App.fmtNum(assets.length)} دارایی</div>
        </div>
        <div class="stat-card ${totalCost > 0 ? 'green' : 'blue'}">
          <div class="stat-icon">💵</div>
          <div class="stat-label">اصل سرمایه</div>
          <div class="stat-value">${App.fmtCurrency(totalCost)}</div>
          <div class="stat-change text-muted">میانگین خرید</div>
        </div>
      </div>

      <div class="grid-2 mb-6">
        <div class="card">
          <div class="card-header">
            <span class="card-title">📊 رشد سرمایه (۶ ماه اخیر)</span>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm" onclick="Pages.dashboard.setRange(90)">۳ ماه</button>
              <button class="btn btn-ghost btn-sm" onclick="Pages.dashboard.setRange(180)">۶ ماه</button>
            </div>
          </div>
          <div class="chart-wrap"><canvas id="growthChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">🥧 تفکیک دارایی‌ها</span>
          </div>
          <div class="chart-wrap-sm"><canvas id="allocChart"></canvas></div>
          <div id="allocLegend" style="margin-top:12px;"></div>
        </div>
      </div>

      <div class="card mb-6">
        <div class="card-header">
          <span class="card-title">🏦 عملکرد حساب‌ها</span>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('accounts')">مشاهده همه</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>نام حساب</th>
                <th>نوع</th>
                <th>دسته</th>
                <th>ارزش فعلی</th>
                <th>سود/زیان</th>
                <th>درصد</th>
              </tr>
            </thead>
            <tbody id="accountsTableBody">
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 دارایی‌های برتر</span>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('assets')">مشاهده همه</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>نماد</th>
                <th>نوع</th>
                <th>تعداد</th>
                <th>میانگین خرید</th>
                <th>قیمت روز</th>
                <th>ارزش کل</th>
                <th>سود/زیان</th>
              </tr>
            </thead>
            <tbody id="assetsTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    renderAccountsTable(accounts, assets);
    renderAssetsTable(assets);
    renderGrowthChart(dailyVals);
    renderAllocChart(typeMap, totalValue);
  }

  function renderAccountsTable(accounts, assets) {
    const tbody = document.getElementById('accountsTableBody');
    if (!accounts.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="text-align:center;padding:20px;color:var(--text3)">حسابی ثبت نشده</td></tr>'; return; }

    tbody.innerHTML = accounts.map(acc => {
      const acAssets = assets.filter(a => a.accountId === acc.id);
      const value = DB.calc.portfolioTotal(acAssets);
      const cost = DB.calc.portfolioCost(acAssets);
      const pnl = value - cost;
      const pct = cost > 0 ? (pnl / cost) * 100 : 0;
      return `<tr>
        <td><strong>${acc.name}</strong></td>
        <td><span class="badge ${acc.type === 'haghighi' ? 'badge-blue' : 'badge-purple'}">${App.accountTypeLabels[acc.type] || acc.type}</span></td>
        <td><span class="badge ${acc.category === 'broker' ? 'badge-gold' : acc.category === 'forex' ? 'badge-red' : 'badge-green'}">${App.catLabels[acc.category] || acc.category}</span></td>
        <td class="ltr">${App.fmtCurrency(value)}</td>
        <td class="${App.pnlClass(pnl)} ltr">${App.fmtCurrency(pnl)}</td>
        <td class="${App.pnlClass(pct)} ltr">${App.fmtPct(pct)}</td>
      </tr>`;
    }).join('');
  }

  function renderAssetsTable(assets) {
    const tbody = document.getElementById('assetsTableBody');
    const sorted = [...assets].sort((a, b) => (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity)).slice(0, 8);
    if (!sorted.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3)">دارایی ثبت نشده</td></tr>'; return; }

    tbody.innerHTML = sorted.map(a => {
      const pnl = DB.calc.assetPnL(a);
      return `<tr>
        <td><strong>${a.symbol}</strong><br><small class="text-muted">${a.name || ''}</small></td>
        <td><span class="badge badge-gray">${App.typeLabels[a.type] || a.type}</span></td>
        <td class="ltr">${App.fmtNum(a.quantity, 4)}</td>
        <td class="ltr">${App.fmtNum(a.avgPrice)}</td>
        <td class="ltr">${App.fmtNum(a.currentPrice)}</td>
        <td class="ltr">${App.fmtCurrency(pnl.current)}</td>
        <td class="${App.pnlClass(pnl.value)} ltr">${App.fmtPct(pnl.percent)}</td>
      </tr>`;
    }).join('');
  }

  function renderGrowthChart(dailyVals, days = 180) {
    const ctx = document.getElementById('growthChart');
    if (!ctx) return;
    if (growthChart) { growthChart.destroy(); growthChart = null; }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const filtered = dailyVals.filter(d => new Date(d.date) >= cutoff);

    const labels = filtered.map(d => new Date(d.date).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }));
    const data = filtered.map(d => d.totalValue);

    growthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'ارزش کل',
          data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#2a304720' }, ticks: { color: '#8b92a8', font: { family: 'Vazirmatn', size: 10 }, maxTicksLimit: 8 } },
          y: { grid: { color: '#2a304760' }, ticks: { color: '#8b92a8', font: { family: 'Vazirmatn', size: 10 }, callback: v => App.fmtCurrency(v) } }
        }
      }
    });
  }

  function renderAllocChart(typeMap, totalValue) {
    const ctx = document.getElementById('allocChart');
    if (!ctx) return;
    if (allocChart) { allocChart.destroy(); allocChart = null; }

    const colors = { stock: '#3b82f6', gold: '#f59e0b', fixed_income: '#22c55e', forex: '#ef4444', cash: '#8b5cf6', other: '#6b7280' };
    const labels = Object.keys(typeMap).map(k => App.typeLabels[k] || k);
    const data = Object.values(typeMap);
    const bgColors = Object.keys(typeMap).map(k => colors[k] || '#6b7280');

    allocChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 2, borderColor: '#171b26' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = totalValue > 0 ? (ctx.raw / totalValue * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${pct}%`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });

    // legend
    const legend = document.getElementById('allocLegend');
    if (legend) {
      legend.innerHTML = Object.entries(typeMap).map(([k, v]) => {
        const pct = totalValue > 0 ? (v / totalValue * 100).toFixed(1) : 0;
        return `<div class="alloc-row">
          <div style="width:10px;height:10px;border-radius:50%;background:${colors[k] || '#6b7280'};min-width:10px"></div>
          <span class="alloc-label">${App.typeLabels[k] || k}</span>
          <div class="alloc-bar"><div class="alloc-fill" style="width:${pct}%;background:${colors[k] || '#6b7280'}"></div></div>
          <span class="alloc-pct ltr">${pct}%</span>
        </div>`;
      }).join('');
    }
  }

  function setRange(days) {
    const dailyVals = DB.dailyValues.recent(days);
    renderGrowthChart(dailyVals, days);
  }

  return { render, setRange };
})();
