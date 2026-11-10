/* util.js — общие хелперы */
const U = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  pad(n) { return String(n).padStart(2, '0'); },

  today() {
    const d = new Date();
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
  },

  dateKey(d) {
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())}`;
  },

  parseDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  addDays(key, n) {
    const d = U.parseDate(key);
    d.setDate(d.getDate() + n);
    return U.dateKey(d);
  },

  fmtDate(key, opts) {
    const d = U.parseDate(key);
    return d.toLocaleDateString('ru-RU', opts || { day: 'numeric', month: 'short' });
  },

  fmtDateFull(key) {
    const d = U.parseDate(key);
    const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
    return `${days[d.getDay()]}, ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
  },

  // день недели 1=Пн ... 7=Вс
  isoDow(key) {
    const d = U.parseDate(key);
    return d.getDay() === 0 ? 7 : d.getDay();
  },

  weekStart(key) {
    const d = U.parseDate(key);
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() - (dow - 1));
    return U.dateKey(d);
  },

  weekDates(weekStartKey) {
    return Array.from({ length: 7 }, (_, i) => U.addDays(weekStartKey, i));
  },

  initials(name) {
    return String(name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  },

  normName(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  },

  debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  toast(msg) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 2200);
  },

  modal(html) {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `<div class="modal">${html}</div>`;
    back.addEventListener('click', e => { if (e.target === back) back.remove(); });
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('open'));
    return {
      el: back,
      close() { back.remove(); },
      query(sel) { return back.querySelector(sel); }
    };
  },

  // сжатие изображения → JPEG base64 (max 150x150, quality 0.6)
  compressImage(file, maxSize = 150, quality = 0.6) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = url;
    });
  }
};
