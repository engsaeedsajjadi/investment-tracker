/* ===== JALALI (PERSIAN/SHAMSI) CALENDAR UTILITIES =====
   Core conversion algorithm based on the verified jalaali-js implementation
   (Borkowski algorithm, public domain / MIT). Tested against known reference
   dates (e.g. 1 Farvardin 1403 = 2024-03-20).
*/
const Jalali = (() => {

  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }

  function jalCal(jy, withoutLeap) {
    const bl = breaks.length;
    const gy = jy + 621;
    let leapJ = -14, jp = breaks[0], jm, jump, leap, leapG, march, n, i;

    if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalaali year ' + jy);

    for (i = 1; i < bl; i += 1) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;

    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;

    if (withoutLeap) return { gy, march };

    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;

    return { leap, gy, march };
  }

  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5)
      + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }

  function j2d(jy, jm, jd) {
    const r = jalCal(jy, true);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy, false);
    const jdn1f = g2d(gy, 3, r.march);
    let jd, jm, k;

    k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) {
        jm = 1 + div(k, 31);
        jd = mod(k, 31) + 1;
        return { jy, jm, jd };
      } else {
        k -= 186;
      }
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy, jm, jd };
  }

  function toJalaali(gy, gm, gd) {
    return d2j(g2d(gy, gm, gd));
  }

  function toGregorian(jy, jm, jd) {
    return d2g(j2d(jy, jm, jd));
  }

  function isLeapJalaaliYear(jy) {
    return jalCalLeap(jy) === 0;
  }

  function jalCalLeap(jy) {
    const bl = breaks.length;
    let jp = breaks[0], jm, jump, leap, n, i;
    if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalaali year ' + jy);
    for (i = 1; i < bl; i += 1) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      jp = jm;
    }
    n = jy - jp;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return leap;
  }

  function jalaaliMonthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJalaaliYear(jy) ? 30 : 29;
  }

  /* ---- PUBLIC-FACING HELPERS ---- */
  const monthNames = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const weekDays = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  const weekDaysShort = ['ش','ی','د','س','چ','پ','ج'];

  function persianDigits(str) {
    const map = { '0':'۰','1':'۱','2':'۲','3':'۳','4':'۴','5':'۵','6':'۶','7':'۷','8':'۸','9':'۹' };
    return String(str).replace(/[0-9]/g, d => map[d]);
  }
  function latinDigits(str) {
    const map = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
    return String(str).replace(/[۰-۹]/g, d => map[d]);
  }

  // JS Date or ISO Gregorian string -> {jy, jm, jd}
  function fromGregorianDate(input) {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return null;
    return toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  // {jy, jm, jd} -> ISO Gregorian date string (for storage)
  function toISODate(jy, jm, jd) {
    const g = toGregorian(jy, jm, jd);
    const mm = String(g.gm).padStart(2, '0');
    const dd = String(g.gd).padStart(2, '0');
    return `${g.gy}-${mm}-${dd}`;
  }

  // ISO Gregorian string -> "1403/04/15" (Persian digits)
  function isoToJalaliStr(isoDate, sep = '/') {
    if (!isoDate) return '—';
    const j = fromGregorianDate(isoDate);
    if (!j) return '—';
    const mm = String(j.jm).padStart(2, '0');
    const dd = String(j.jd).padStart(2, '0');
    return persianDigits(`${j.jy}${sep}${mm}${sep}${dd}`);
  }

  // ISO Gregorian string -> "1403/04/15" using Latin digits (for date inputs)
  function isoToJalaliStrLatin(isoDate, sep = '/') {
    if (!isoDate) return '';
    const j = fromGregorianDate(isoDate);
    if (!j) return '';
    const mm = String(j.jm).padStart(2, '0');
    const dd = String(j.jd).padStart(2, '0');
    return `${j.jy}${sep}${mm}${sep}${dd}`;
  }

  // ISO Gregorian string -> "۱۵ تیر ۱۴۰۳"
  function isoToJalaliFull(isoDate) {
    if (!isoDate) return '—';
    const j = fromGregorianDate(isoDate);
    if (!j) return '—';
    return persianDigits(j.jd) + ' ' + monthNames[j.jm - 1] + ' ' + persianDigits(j.jy);
  }

  // "1403/04/15" or "1403-04-15" (Persian or Latin digits) -> ISO Gregorian string
  function parseJalaliStr(str) {
    if (!str) return null;
    const clean = latinDigits(str).trim();
    const m = clean.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (!m) return null;
    const jy = parseInt(m[1], 10), jm = parseInt(m[2], 10), jd = parseInt(m[3], 10);
    if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
    try {
      return toISODate(jy, jm, jd);
    } catch (e) {
      return null;
    }
  }

  function todayJalali() {
    return fromGregorianDate(new Date());
  }
  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }
  function todayJalaliStrLatin() {
    return isoToJalaliStrLatin(todayISO());
  }

  function daysInJalaliMonth(jy, jm) {
    return jalaaliMonthLength(jy, jm);
  }

  function gregorianWeekday(jy, jm, jd) {
    const g = toGregorian(jy, jm, jd);
    const date = new Date(g.gy, g.gm - 1, g.gd);
    const jsDay = date.getDay(); // 0=Sun..6=Sat
    return (jsDay + 1) % 7; // 0=Sat,1=Sun,...,6=Fri (Iranian week order)
  }

  return {
    monthNames, weekDays, weekDaysShort,
    persianDigits, latinDigits,
    fromGregorianDate, toISODate,
    isoToJalaliStr, isoToJalaliStrLatin, isoToJalaliFull,
    parseJalaliStr, todayJalali, todayISO, todayJalaliStrLatin,
    daysInJalaliMonth, gregorianWeekday,
    toGregorian, toJalaali,
    isLeapJalaaliYear
  };
})();
