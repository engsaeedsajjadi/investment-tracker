/* ===== DATABASE (localStorage) ===== */
const DB = (() => {
  const KEY = 'sarmayeyar_v1';

  const defaults = {
    accounts: [],
    assets: [],
    transactions: [],
    dailyValues: [],
    settings: { currency: 'تومان', version: '1.0.0' }
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      const data = JSON.parse(raw);
      // merge missing keys
      return Object.assign({}, defaults, data);
    } catch (e) {
      return JSON.parse(JSON.stringify(defaults));
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function getAll() { return load(); }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---- ACCOUNTS ---- */
  const accounts = {
    getAll() { return load().accounts; },
    get(id) { return load().accounts.find(a => a.id === id) || null; },
    add(obj) {
      const db = load();
      const rec = { id: uid(), createdAt: new Date().toISOString(), ...obj };
      db.accounts.push(rec);
      save(db);
      return rec;
    },
    update(id, patch) {
      const db = load();
      const i = db.accounts.findIndex(a => a.id === id);
      if (i < 0) return null;
      db.accounts[i] = { ...db.accounts[i], ...patch };
      save(db);
      return db.accounts[i];
    },
    delete(id) {
      const db = load();
      db.accounts = db.accounts.filter(a => a.id !== id);
      db.assets = db.assets.filter(a => a.accountId !== id);
      db.transactions = db.transactions.filter(t => t.accountId !== id && t.toAccountId !== id);
      save(db);
    }
  };

  /* ---- ASSETS ---- */
  const assets = {
    getAll() { return load().assets; },
    byAccount(accountId) { return load().assets.filter(a => a.accountId === accountId); },
    get(id) { return load().assets.find(a => a.id === id) || null; },
    add(obj) {
      const db = load();
      const rec = { id: uid(), createdAt: new Date().toISOString(), avgPrice: 0, quantity: 0, currentPrice: 0, ...obj };
      db.assets.push(rec);
      save(db);
      return rec;
    },
    update(id, patch) {
      const db = load();
      const i = db.assets.findIndex(a => a.id === id);
      if (i < 0) return null;
      db.assets[i] = { ...db.assets[i], ...patch };
      save(db);
      return db.assets[i];
    },
    delete(id) {
      const db = load();
      db.assets = db.assets.filter(a => a.id !== id);
      save(db);
    }
  };

  /* ---- TRANSACTIONS ---- */
  const transactions = {
    getAll() { return load().transactions.sort((a, b) => new Date(b.date) - new Date(a.date)); },
    get(id) { return load().transactions.find(t => t.id === id) || null; },
    add(obj) {
      const db = load();
      const rec = { id: uid(), createdAt: new Date().toISOString(), fee: 0, description: '', ...obj };
      db.transactions.push(rec);
      // update asset avg_price and quantity
      _updateAssetFromTx(db, rec);
      save(db);
      return rec;
    },
    delete(id) {
      const db = load();
      db.transactions = db.transactions.filter(t => t.id !== id);
      save(db);
    },
    byAccount(accountId) {
      return load().transactions.filter(t => t.accountId === accountId || t.toAccountId === accountId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  };

  function _updateAssetFromTx(db, tx) {
    if (!tx.assetId) return;
    const ai = db.assets.findIndex(a => a.id === tx.assetId);
    if (ai < 0) return;
    const asset = db.assets[ai];
    if (tx.type === 'buy') {
      const prevValue = (asset.avgPrice || 0) * (asset.quantity || 0);
      const newValue = (tx.price || 0) * (tx.quantity || 0);
      const newQty = (asset.quantity || 0) + (tx.quantity || 0);
      asset.quantity = newQty;
      asset.avgPrice = newQty > 0 ? (prevValue + newValue) / newQty : 0;
    } else if (tx.type === 'sell') {
      asset.quantity = Math.max(0, (asset.quantity || 0) - (tx.quantity || 0));
    }
    db.assets[ai] = asset;
  }

  /* ---- DAILY VALUES ---- */
  const dailyValues = {
    getAll() { return load().dailyValues.sort((a, b) => new Date(a.date) - new Date(b.date)); },
    add(obj) {
      const db = load();
      // upsert by date + accountId
      const existing = db.dailyValues.findIndex(d => d.date === obj.date && d.accountId === obj.accountId);
      if (existing >= 0) {
        db.dailyValues[existing] = { ...db.dailyValues[existing], ...obj };
      } else {
        db.dailyValues.push({ id: uid(), ...obj });
      }
      save(db);
    },
    recent(days = 180) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return load().dailyValues.filter(d => new Date(d.date) >= cutoff)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    }
  };

  /* ---- IMPORT/EXPORT ---- */
  const backup = {
    export() { return JSON.stringify(load(), null, 2); },
    import(json) {
      const data = JSON.parse(json);
      save(data);
    },
    clear() { save(JSON.parse(JSON.stringify(defaults))); }
  };

  /* ---- SEED SAMPLE DATA ---- */
  function seedSampleData() {
    const db = load();
    if (db.accounts.length > 0) return; // already has data

    // Accounts
    const acc1 = { id: uid(), name: 'کارگزاری مفید', type: 'haghighi', category: 'broker', description: 'حساب اصلی بورس', createdAt: '2024-01-01T00:00:00.000Z' };
    const acc2 = { id: uid(), name: 'کارگزاری آگاه', type: 'haghighi', category: 'broker', description: 'حساب دوم بورس', createdAt: '2024-01-01T00:00:00.000Z' };
    const acc3 = { id: uid(), name: 'سبدگردان الفبا', type: 'hoghooghi', category: 'portfolio_manager', description: 'سبد مدیریت‌شده', createdAt: '2024-01-01T00:00:00.000Z' };
    const acc4 = { id: uid(), name: 'بروکر Exness', type: 'haghighi', category: 'forex', description: 'حساب فارکس', createdAt: '2024-01-01T00:00:00.000Z' };
    db.accounts.push(acc1, acc2, acc3, acc4);

    // Assets
    const a1 = { id: uid(), accountId: acc1.id, symbol: 'خودرو', name: 'ایران خودرو', type: 'stock', quantity: 10000, avgPrice: 2800, currentPrice: 3200, createdAt: '2024-01-15T00:00:00.000Z' };
    const a2 = { id: uid(), accountId: acc1.id, symbol: 'فولاد', name: 'فولاد مبارکه', type: 'stock', quantity: 5000, avgPrice: 6500, currentPrice: 7200, createdAt: '2024-01-20T00:00:00.000Z' };
    const a3 = { id: uid(), accountId: acc2.id, symbol: 'صندوق کمند', name: 'صندوق کمند', type: 'fixed_income', quantity: 200, avgPrice: 1000000, currentPrice: 1085000, createdAt: '2024-02-01T00:00:00.000Z' };
    const a4 = { id: uid(), accountId: acc3.id, symbol: 'سبد الفبا', name: 'سبد سهام الفبا', type: 'stock', quantity: 1, avgPrice: 500000000, currentPrice: 580000000, createdAt: '2024-02-10T00:00:00.000Z' };
    const a5 = { id: uid(), accountId: acc4.id, symbol: 'EURUSD', name: 'یورو/دلار', type: 'forex', quantity: 0.5, avgPrice: 73000000, currentPrice: 74500000, createdAt: '2024-03-01T00:00:00.000Z' };
    const a6 = { id: uid(), accountId: acc2.id, symbol: 'طلا', name: 'صندوق طلا', type: 'gold', quantity: 500, avgPrice: 45000, currentPrice: 52000, createdAt: '2024-03-15T00:00:00.000Z' };
    db.assets.push(a1, a2, a3, a4, a5, a6);

    // Transactions
    db.transactions.push(
      { id: uid(), accountId: acc1.id, assetId: a1.id, type: 'buy', symbol: 'خودرو', quantity: 10000, price: 2800, fee: 280000, date: '2024-01-15', description: 'خرید اولیه', createdAt: '2024-01-15T00:00:00.000Z' },
      { id: uid(), accountId: acc1.id, assetId: a2.id, type: 'buy', symbol: 'فولاد', quantity: 5000, price: 6500, fee: 325000, date: '2024-01-20', description: 'خرید فولاد', createdAt: '2024-01-20T00:00:00.000Z' },
      { id: uid(), accountId: acc2.id, assetId: a3.id, type: 'buy', symbol: 'صندوق کمند', quantity: 200, price: 1000000, fee: 0, date: '2024-02-01', description: 'سرمایه‌گذاری درآمد ثابت', createdAt: '2024-02-01T00:00:00.000Z' },
      { id: uid(), accountId: acc4.id, assetId: a5.id, type: 'buy', symbol: 'EURUSD', quantity: 0.5, price: 73000000, fee: 100000, date: '2024-03-01', description: 'خرید یورو', createdAt: '2024-03-01T00:00:00.000Z' },
      { id: uid(), accountId: acc2.id, assetId: a6.id, type: 'buy', symbol: 'طلا', quantity: 500, price: 45000, fee: 22500, date: '2024-03-15', description: 'صندوق طلا', createdAt: '2024-03-15T00:00:00.000Z' }
    );

    // Daily values (last 6 months)
    const today = new Date();
    for (let i = 180; i >= 0; i -= 7) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const base = 1000000000;
      const grow = base + (180 - i) * 500000 + Math.random() * 20000000 - 10000000;
      db.dailyValues.push({ id: uid(), date: dateStr, accountId: null, totalValue: Math.round(grow), note: '' });
    }

    save(db);
  }

  /* ---- CALC HELPERS ---- */
  const calc = {
    assetPnL(asset) {
      const cost = asset.avgPrice * asset.quantity;
      const current = asset.currentPrice * asset.quantity;
      return { value: current - cost, percent: cost > 0 ? ((current - cost) / cost) * 100 : 0, current, cost };
    },
    portfolioTotal(assets) {
      return assets.reduce((s, a) => s + a.currentPrice * a.quantity, 0);
    },
    portfolioCost(assets) {
      return assets.reduce((s, a) => s + a.avgPrice * a.quantity, 0);
    }
  };

  return { accounts, assets, transactions, dailyValues, backup, calc, seedSampleData, getAll };
})();
