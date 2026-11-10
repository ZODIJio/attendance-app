/* schedule.js — недельное расписание Пн–Сб */
const Schedule = {
  DAYS: { 1: 'Понедельник', 2: 'Вторник', 3: 'Среда', 4: 'Четверг', 5: 'Пятница', 6: 'Суббота' },

  renderScreen(el) {
    const sched = Store.schedule();
    const tracks = State.tracks();
    let html = `<div class="card"><div class="row between">
      <div><strong>Недельное расписание</strong><div class="small muted">Пары и их целевая аудитория</div></div>
      <button class="btn sm" id="sc-add-day">+ День</button></div></div>`;

    [1,2,3,4,5,6].forEach(dow => {
      const lessons = sched[String(dow)] || [];
      html += `
        <div class="section-label">${this.DAYS[dow]}</div>
        <div class="card" style="padding:6px 16px" data-day="${dow}">
          ${lessons.length ? lessons.map((l, i) => this.lessonRow(l, i, dow, tracks)).join('') :
            `<div class="lesson-row"><span class="faint small">Пар нет — нажмите «+ Пара»</span></div>`}
          <div class="row" style="padding:8px 0">
            <button class="btn sm ghost" data-add="${dow}">+ Пара</button>
          </div>
        </div>`;
    });
    el.innerHTML = html;

    el.querySelector('#sc-add-day')?.addEventListener('click', () => {
      const m = U.modal(`<h3>Быстрое заполнение дня</h3>
        <div class="field"><label>День</label><select class="input" id="m-day">${[1,2,3,4,5,6].map(d => `<option value="${d}">${this.DAYS[d]}</option>`).join('')}</select></div>
        <div class="modal-actions"><button class="btn grow" id="m-cancel">Отмена</button>
        <button class="btn primary grow" id="m-ok">Открыть</button></div>`);
      m.query('#m-cancel').addEventListener('click', m.close);
      m.query('#m-ok').addEventListener('click', () => {
        const day = Number(m.query('#m-day').value);
        m.close();
        this.editLessonModal(day, -1, tracks, el);
      });
    });

    el.querySelectorAll('[data-add]').forEach(b =>
      b.addEventListener('click', () => this.editLessonModal(Number(b.dataset.add), -1, tracks, el)));

    el.querySelectorAll('[data-edit-lesson]').forEach(b => {
      const [dow, idx] = b.dataset.editLesson.split(':').map(Number);
      b.addEventListener('click', () => this.editLessonModal(dow, idx, tracks, el));
    });
    el.querySelectorAll('[data-del-lesson]').forEach(b => {
      const [dow, idx] = b.dataset.delLesson.split(':').map(Number);
      b.addEventListener('click', () => {
        const s = Store.schedule();
        const arr = (s[String(dow)] || []).slice();
        arr.splice(idx, 1);
        s[String(dow)] = arr;
        Store.saveSchedule(s);
        Bus.emit('schedule:change');
        this.renderScreen(el);
      });
    });
  },

  lessonRow(l, i, dow, tracks) {
    const aud = l.audience || 'all';
    const audLabel = aud === 'all' ? 'Вся группа' : aud === 'A' ? 'Подгр. А' : aud === 'B' ? 'Подгр. Б' : `◈ ${U.esc(l.track || 'трек')}`;
    return `
      <div class="lesson-row">
        <div class="grow">
          <div class="strong" style="font-size:14px">${U.esc(l.subject)}</div>
          <div class="small muted">${U.esc(l.time || '')} · ${audLabel}</div>
        </div>
        <button class="icon-btn" data-edit-lesson="${dow}:${i}">✎</button>
        <button class="icon-btn" data-del-lesson="${dow}:${i}" title="Удалить">✕</button>
      </div>`;
  },

  editLessonModal(dow, idx, tracks, screenEl) {
    const sched = Store.schedule();
    const dayArr = sched[String(dow)] || [];
    const l = idx >= 0 ? dayArr[idx] : { subject: '', time: '', audience: 'all', track: '' };
    const m = U.modal(`
      <h3>${idx >= 0 ? 'Изменить пару' : 'Новая пара'}</h3>
      <div class="field"><label>Предмет</label>
        <input class="input" id="m-subject" value="${U.esc(l.subject)}" placeholder="Математический анализ"></div>
      <div class="field"><label>Время</label>
        <input class="input" id="m-time" value="${U.esc(l.time)}" placeholder="09:00–10:30"></div>
      <div class="field"><label>Целевая аудитория</label>
        <div class="chips" id="m-aud">
          <button class="chip ${(l.audience||'all')==='all'?'on':''}" data-v="all">Вся группа</button>
          <button class="chip ${l.audience==='A'?'on':''}" data-v="A">Подгр. А</button>
          <button class="chip ${l.audience==='B'?'on':''}" data-v="B">Подгр. Б</button>
          <button class="chip ${l.audience==='custom'?'on':''}" data-v="custom">Выборочный список</button>
        </div></div>
      <div class="field" id="m-track-wrap" style="display:${l.audience==='custom'?'block':'none'}">
        <label>Группа / языковой трек</label>
        <input class="input" id="m-track" list="m-track-list" value="${U.esc(l.track || '')}" placeholder="English, Немецкий…">
        <datalist id="m-track-list">${tracks.map(t => `<option value="${U.esc(t)}">`).join('')}</datalist>
      </div>
      <div class="modal-actions">
        ${idx >= 0 ? '<button class="btn danger" id="m-del">Удалить</button>' : ''}
        <button class="btn grow" id="m-cancel">Отмена</button>
        <button class="btn primary grow" id="m-save">Сохранить</button>
      </div>`);

    let aud = l.audience || 'all';
    m.query('#m-aud').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      aud = b.dataset.v;
      m.query('#m-aud').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
      m.query('#m-track-wrap').style.display = aud === 'custom' ? 'block' : 'none';
    });

    const persist = () => {
      const subject = m.query('#m-subject').value.trim();
      if (!subject) { U.toast('Укажите предмет'); return false; }
      const arr = (Store.schedule()[String(dow)] || []).slice();
      const lesson = {
        id: idx >= 0 ? dayArr[idx].id : U.uid(),
        subject,
        time: m.query('#m-time').value.trim(),
        audience: aud,
        track: aud === 'custom' ? (m.query('#m-track').value.trim() || null) : null
      };
      if (idx >= 0) arr[idx] = lesson; else arr.push(lesson);
      const s = Store.schedule();
      s[String(dow)] = arr;
      Store.saveSchedule(s);
      Bus.emit('schedule:change');
      return true;
    };

    m.query('#m-cancel').addEventListener('click', m.close);
    m.query('#m-save').addEventListener('click', () => {
      if (persist()) { m.close(); this.renderScreen(screenEl); }
    });
    const del = m.query('#m-del');
    if (del) del.addEventListener('click', () => {
      const s = Store.schedule();
      const arr = (s[String(dow)] || []).slice();
      arr.splice(idx, 1);
      s[String(dow)] = arr;
      Store.saveSchedule(s);
      Bus.emit('schedule:change');
      m.close();
      this.renderScreen(screenEl);
    });
  }
};
