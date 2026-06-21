/* ===== JALALI DATE PICKER WIDGET =====
   Usage: JalaliDatePicker.attach(inputElementId, { onChange: (isoDate) => {} })
   Creates a text input showing "1403/04/15" with a calendar icon that opens
   a Shamsi calendar popup. The underlying hidden input holds the ISO (Gregorian)
   value for storage/compatibility with existing code that reads .value as ISO.
*/
const JalaliDatePicker = (() => {
  let activePopup = null;
  let instances = {}; // id -> { isoValue, viewYear, viewMonth, onChange }

  function closePopup() {
    if (activePopup) { activePopup.remove(); activePopup = null; }
    document.removeEventListener('click', outsideClickHandler, true);
  }

  function outsideClickHandler(e) {
    if (activePopup && !activePopup.contains(e.target) && !e.target.classList.contains('jdp-trigger')) {
      closePopup();
    }
  }

  /**
   * Attach a Jalali date picker to a text input.
   * @param {string} inputId - id of a text input (will be made readonly-ish, shows jalali date)
   * @param {object} opts - { initialISO, onChange(isoDate) }
   */
  function attach(inputId, opts = {}) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const initialISO = opts.initialISO !== undefined ? opts.initialISO : Jalali.todayISO();
    const j = initialISO ? (Jalali.fromGregorianDate(initialISO) || Jalali.todayJalali()) : Jalali.todayJalali();

    instances[inputId] = {
      isoValue: initialISO,
      viewYear: j.jy,
      viewMonth: j.jm,
      onChange: opts.onChange || (() => {})
    };

    input.value = initialISO ? Jalali.isoToJalaliStrLatin(initialISO) : '';
    input.readOnly = true;
    input.classList.add('jdp-trigger');
    input.style.cursor = 'pointer';
    input.dataset.isoValue = initialISO || '';

    input.addEventListener('click', (e) => {
      e.stopPropagation();
      openPopup(inputId);
    });
  }

  function getISOValue(inputId) {
    const inst = instances[inputId];
    return inst ? inst.isoValue : null;
  }

  function setISOValue(inputId, isoDate) {
    const inst = instances[inputId];
    const input = document.getElementById(inputId);
    if (!inst || !input) return;
    inst.isoValue = isoDate;
    const j = Jalali.fromGregorianDate(isoDate);
    if (j) { inst.viewYear = j.jy; inst.viewMonth = j.jm; }
    input.value = Jalali.isoToJalaliStrLatin(isoDate);
    input.dataset.isoValue = isoDate;
  }

  function openPopup(inputId) {
    closePopup();
    const input = document.getElementById(inputId);
    const inst = instances[inputId];
    if (!input || !inst) return;

    const rect = input.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'jdp-popup';
    popup.style.position = 'fixed';
    popup.style.zIndex = '9999';

    document.body.appendChild(popup);
    renderCalendar(popup, inputId);

    // position after render (need actual size)
    requestAnimationFrame(() => {
      const pw = popup.offsetWidth || 280;
      const ph = popup.offsetHeight || 320;
      let top = rect.bottom + 6;
      let left = rect.left;
      if (top + ph > window.innerHeight) top = rect.top - ph - 6;
      if (left + pw > window.innerWidth) left = window.innerWidth - pw - 10;
      if (left < 10) left = 10;
      popup.style.top = top + 'px';
      popup.style.left = left + 'px';
    });

    activePopup = popup;
    setTimeout(() => document.addEventListener('click', outsideClickHandler, true), 0);
  }

  function renderCalendar(popup, inputId) {
    const inst = instances[inputId];
    const { viewYear, viewMonth, isoValue } = inst;
    const selectedJ = Jalali.fromGregorianDate(isoValue);
    const todayJ = Jalali.todayJalali();

    const daysInMonth = Jalali.daysInJalaliMonth(viewYear, viewMonth);
    const firstWeekday = Jalali.gregorianWeekday(viewYear, viewMonth, 1); // 0=Sat..6=Fri

    let cells = '';
    for (let i = 0; i < firstWeekday; i++) cells += `<div class="jdp-day jdp-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected = selectedJ && selectedJ.jy === viewYear && selectedJ.jm === viewMonth && selectedJ.jd === d;
      const isToday = todayJ.jy === viewYear && todayJ.jm === viewMonth && todayJ.jd === d;
      cells += `<div class="jdp-day ${isSelected ? 'jdp-selected' : ''} ${isToday ? 'jdp-today' : ''}" data-day="${d}">${Jalali.persianDigits(d)}</div>`;
    }

    popup.innerHTML = `
      <div class="jdp-header">
        <button type="button" class="jdp-nav" data-action="prev-year" title="سال قبل">«</button>
        <button type="button" class="jdp-nav" data-action="prev-month" title="ماه قبل">‹</button>
        <div class="jdp-title">${Jalali.monthNames[viewMonth - 1]} ${Jalali.persianDigits(viewYear)}</div>
        <button type="button" class="jdp-nav" data-action="next-month" title="ماه بعد">›</button>
        <button type="button" class="jdp-nav" data-action="next-year" title="سال بعد">»</button>
      </div>
      <div class="jdp-weekdays">
        ${Jalali.weekDaysShort.map(w => `<div class="jdp-weekday">${w}</div>`).join('')}
      </div>
      <div class="jdp-grid">${cells}</div>
      <div class="jdp-footer">
        <button type="button" class="jdp-today-btn" data-action="today">امروز</button>
      </div>
    `;

    popup.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleNav(inputId, btn.dataset.action);
      });
    });

    popup.querySelectorAll('.jdp-day[data-day]').forEach(cell => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const day = parseInt(cell.dataset.day, 10);
        selectDate(inputId, viewYear, viewMonth, day);
      });
    });
  }

  function handleNav(inputId, action) {
    const inst = instances[inputId];
    if (!inst) return;

    if (action === 'today') {
      const t = Jalali.todayJalali();
      selectDate(inputId, t.jy, t.jm, t.jd);
      return;
    }

    if (action === 'prev-month') { inst.viewMonth--; if (inst.viewMonth < 1) { inst.viewMonth = 12; inst.viewYear--; } }
    if (action === 'next-month') { inst.viewMonth++; if (inst.viewMonth > 12) { inst.viewMonth = 1; inst.viewYear++; } }
    if (action === 'prev-year') inst.viewYear--;
    if (action === 'next-year') inst.viewYear++;

    if (activePopup) renderCalendar(activePopup, inputId);
  }

  function selectDate(inputId, jy, jm, jd) {
    const iso = Jalali.toISODate(jy, jm, jd);
    setISOValue(inputId, iso);
    const inst = instances[inputId];
    if (inst) inst.onChange(iso);
    closePopup();
  }

  return { attach, getISOValue, setISOValue, closePopup };
})();
