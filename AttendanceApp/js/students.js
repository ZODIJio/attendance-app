/* students.js — база студентов и подгруппы */
const Students = {
  renderMoreSection(container) {
    const list = State.students;
    container.innerHTML = `
      <div class="section-label">База студентов</div>
      <div class="card">
        <div class="row" style="margin-bottom:12px">
          <input class="input grow" id="st-search" placeholder="Поиск по имени…">
          <button class="btn" id="st-add">+ Студент</button>
        </div>
        <div class="row" style="margin-bottom:12px">
          <select class="input" id="st-import-sub" style="max-width:130px">
            <option value="A">Подгр. А</option>
            <option value="B">Подгр. Б</option>
          </select>
          <input class="input grow" id="st-import-track" list="st-track-list" placeholder="Трек по умолчанию (необязательно)">
          <datalist id="st-track-list">${State.tracks().map(t => `<option value="${U.esc(t)}">`).join('')}</datalist>
        </div>
        <textarea class="input" id="st-bulk" rows="5" placeholder="Массовый импорт — одно имя на строку. Трек через | :&#10;Иванов Иван&#10;Петрова Анна | английский&#10;Сидоров Алексей | Б | немецкий"></textarea>
        <div class="row" style="margin-top:10px">
          <button class="btn" id="st-bulk-add">Импортировать список</button>
          <span class="small muted" id="st-count">${list.length} чел.</span>
        </div>
      </div>
      <div class="card" id="st-list" style="padding:6px 16px"></div>`;

    this.renderList(container.querySelector('#st-list'));

    container.querySelector('#st-search').addEventListener('input', U.debounce(e => {
      this.renderList(container.querySelector('#st-list'), e.target.value);
    }, 150));

    container.querySelector('#st-add').addEventListener('click', () => this.editModal(null, container));

    container.querySelector('#st-bulk-add').addEventListener('click', () => {
      const text = container.querySelector('#st-bulk').value;
      const defSub = container.querySelector('#st-import-sub').value;
      const defTrack = container.querySelector('#st-import-track').value.trim() || null;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) { U.toast('Список пуст'); return; }

      // формат строки: "Имя" | "Имя | трек" | "Имя | А/Б | трек"
      const parsed = lines.map(line => {
        const parts = line.split('|').map(p => p.trim().replace(/\s+/g, ' ')).filter(Boolean);
        const name = parts[0];
        let sub = defSub, track = defTrack;
        if (parts.length >= 3) {
          const maybeSub = parts[1].toLowerCase();
          if (['а', 'a', 'б', 'b'].includes(maybeSub)) {
            sub = /б|b/.test(maybeSub) ? 'B' : 'A';
            track = parts.slice(2).join(' | ') || null;
          } else {
            track = parts.slice(1).join(' | ') || null;
          }
        } else if (parts.length === 2) {
          track = parts[1] || null;
        }
        return { name, sub, track };
      }).filter(p => p.name && p.name.length >= 3);

      if (!parsed.length) { U.toast('Не удалось разобрать строки'); return; }
      const existing = new Set(State.students.map(s => U.normName(s.name)));
      const fresh = State.students.slice();
      let added = 0, skipped = 0;
      parsed.forEach(({ name, sub, track }) => {
        if (existing.has(U.normName(name))) { skipped++; return; }
        const tracks = track ? track.split(/[,;/]/).map(t => t.trim()).filter(Boolean) : [];
        tracks.forEach(t => State.addTrack(t));
        fresh.push({ id: U.uid(), name, sub, tracks });
        existing.add(U.normName(name));
        added++;
      });
      Store.saveStudents(fresh);
      Bus.emit('students:change');
      container.querySelector('#st-bulk').value = '';
      U.toast(`Добавлено: ${added}${skipped ? `, дубликатов: ${skipped}` : ''}`);
      this.renderMoreSection(container);
    });
  },

  renderList(el, filter = '') {
    const f = U.normName(filter);
    const all = State.students;
    const list = all.filter(s => !f || U.normName(s.name).includes(f));
    el.innerHTML = list.length ? list.map(s => this.rowHtml(s)).join('') :
      (all.length ? `<div class="empty"><p>Никого не найдено</p></div>`
                 : `<div class="empty"><div class="big">👥</div><p>Студентов пока нет.<br>Добавьте вручную или импортируйте списком.</p></div>`);
    el.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => this.editModal(b.dataset.edit)));
    el.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => {
        Store.saveStudents(State.students.filter(s => s.id !== b.dataset.del));
        Bus.emit('students:change');
        U.toast('Студент удалён');
        const sec = document.querySelector('#more-students');
        if (sec) this.renderMoreSection(sec);
      }));
  },

  rowHtml(s) {
    const tracks = s.tracks || (s.track ? [s.track] : []);
    const subLabel = s.sub === 'A' ? 'А' : s.sub === 'B' ? 'Б' : '—';
    const trackBadges = tracks.slice(0, 2).map(t => `<span class="badge">${U.esc(t)}</span>`).join(' ')
      + (tracks.length > 2 ? `<span class="badge">+${tracks.length - 2}</span>` : '');
    return `
      <div class="list-item">
        <div class="avatar">${U.initials(s.name)}</div>
        <div class="grow">
          <div class="strong" style="font-size:14px">${U.esc(s.name)}</div>
          <div class="small muted">Подгруппа ${s.sub || '—'}</div>
        </div>
        ${trackBadges}
        <span class="badge solid">${U.esc(subLabel)}</span>
        <button class="icon-btn" data-edit="${s.id}" title="Изменить">✎</button>
        <button class="icon-btn" data-del="${s.id}" title="Удалить">✕</button>
      </div>`;
  },

  editModal(id, container) {
    const s = id ? State.studentById(id) : { name: '', sub: 'A', tracks: [] };
    const selected = new Set(s.tracks || (s.track ? [s.track] : []));
    const allTracks = () => [...new Set([...State.tracks(), ...selected])];

    const m = U.modal(`
      <h3>${id ? 'Редактировать студента' : 'Новый студент'}</h3>
      <div class="field"><label>ФИО</label>
        <input class="input" id="m-name" value="${U.esc(s.name)}" placeholder="Иванов Иван Иванович"></div>
      <div class="field"><label>Подгруппа</label>
        <div class="chips" id="m-sub">
          ${['A','B'].map(v => `<button class="chip ${(s.sub||'A')===v?'on':''}" data-v="${v}">Подгруппа ${v}</button>`).join('')}
        </div></div>
      <div class="field"><label>Треки / группы (можно несколько)</label>
        <div class="chips" id="m-tracks"></div>
        <div class="row" style="margin-top:8px">
          <input class="input grow" id="m-new-track" placeholder="Новый трек — напр. Шахниза">
          <button class="btn" id="m-add-track">+ Трек</button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn grow" id="m-cancel">Отмена</button>
        <button class="btn primary grow" id="m-save">Сохранить</button>
      </div>`);

    const tracksBox = m.query('#m-tracks');
    const renderTracks = () => {
      tracksBox.innerHTML = allTracks().length ? allTracks().map(t =>
        `<button class="chip ${selected.has(t) ? 'on' : ''}" data-t="${U.esc(t)}">${U.esc(t)}</button>`).join('')
        : `<span class="small faint">Треков пока нет — создайте первый ниже</span>`;
      tracksBox.querySelectorAll('.chip').forEach(ch =>
        ch.addEventListener('click', () => {
          const t = ch.dataset.t;
          selected.has(t) ? selected.delete(t) : selected.add(t);
          renderTracks();
        }));
    };
    renderTracks();

    const addTrack = () => {
      const inp = m.query('#m-new-track');
      const name = inp.value.trim().replace(/\s+/g, ' ');
      if (!name) { U.toast('Введите название трека'); return; }
      State.addTrack(name);
      selected.add(name);
      inp.value = '';
      renderTracks();
      U.toast(`Трек «${name}» создан`);
    };
    m.query('#m-add-track').addEventListener('click', addTrack);
    m.query('#m-new-track').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addTrack(); } });

    let sub = s.sub || 'A';
    m.query('#m-sub').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      sub = b.dataset.v;
      m.query('#m-sub').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
    });
    m.query('#m-cancel').addEventListener('click', m.close);
    m.query('#m-save').addEventListener('click', () => {
      const name = m.query('#m-name').value.trim().replace(/\s+/g, ' ');
      if (!name) { U.toast('Введите имя'); return; }
      const tracks = [...selected];
      const list = State.students.slice();
      if (id) {
        const idx = list.findIndex(x => x.id === id);
        if (idx >= 0) list[idx] = { ...list[idx], name, sub, tracks };
        else list.push({ id, name, sub, tracks });
      } else {
        list.push({ id: U.uid(), name, sub, tracks });
      }
      Store.saveStudents(list);
      Bus.emit('students:change');
      m.close();
      U.toast('Сохранено');
      if (container) this.renderMoreSection(container);
      else {
        const sec = document.querySelector('#more-students');
        if (sec) this.renderMoreSection(sec);
      }
    });
  }
};
