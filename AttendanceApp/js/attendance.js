/* attendance.js — журнал посещаемости */
const Attendance = {
  state: { date: U.today(), lessonId: null },

  init() {
    if (this._inited) return;
    this._inited = true;
    const ui = Store.ui();
    if (ui.date && !isNaN(U.parseDate(ui.date))) this.state.date = ui.date;
  },

  renderScreen(el) {
    this.init();
    const date = this.state.date;
    const lessons = State.lessonsForDate(date);
    if (!lessons.length) {
      // авто-выбрать первый урок если есть
    }
    // выбранный урок: валидный или первый
    let lesson = lessons.find(l => l.id === this.state.lessonId) || lessons[0] || null;
    if (lesson) this.state.lessonId = lesson.id;

    const students = State.students;
    const audience = lesson ? students.filter(s => State.inAudience(s, lesson)) : [];
    const rec = lesson ? Store.lessonRecords(date, lesson.id) : {};

    let html = `
      <div class="card">
        <div class="row between">
          <button class="icon-btn" id="at-prev">‹</button>
          <div class="grow" style="text-align:center">
            <div class="strong" id="at-date-label">${U.fmtDateFull(date)}</div>
            <input type="date" class="input" id="at-date-input" value="${date}" style="margin-top:6px;font-size:12.5px;padding:7px">
          </div>
          <button class="icon-btn" id="at-next">›</button>
        </div>
        <div class="chips" id="at-lessons" style="margin-top:12px">
          ${lessons.length ? lessons.map(l => `
            <button class="chip ${lesson && l.id === lesson.id ? 'on' : ''}" data-lid="${l.id}">
              ${U.esc(l.subject)}${l.time ? ' · ' + U.esc(l.time) : ''}
            </button>`).join('') :
            `<span class="small muted">На этот день пар нет. Настройте расписание.</span>`}
        </div>
        ${lesson ? `<div class="small muted" style="margin-top:8px">
          Аудитория: ${lesson.audience === 'all' ? 'вся группа' : lesson.audience === 'A' ? 'подгруппа А' : lesson.audience === 'B' ? 'подгруппа Б' : U.esc(lesson.track || 'выборочный список')} · отмечается ${audience.length} из ${students.length}
        </div>` : ''}
      </div>`;

    // Ассистент всегда наверху журнала
    html += `<div id="assistant-mount"></div>`;

    if (lesson) {
      const audIds = new Set(audience.map(s => s.id));
      const marked = Object.keys(rec).filter(id => audIds.has(id)).length;
      html += `
        <div class="card">
          <div class="row between" style="margin-bottom:10px">
            <strong>Посещаемость</strong>
            <span class="small muted mono-num" id="at-count">${marked}/${audience.length}</span>
          </div>
          <button class="btn primary block" id="at-all" style="margin-bottom:12px">✓ Все на месте</button>
          ${audience.length ? audience.map(s => `
            <div class="list-item" style="padding-left:0;padding-right:0">
              <div class="avatar">${U.initials(s.name)}</div>
              <div class="grow">
                <div class="strong" style="font-size:14px">${U.esc(s.name)}</div>
                <div class="small muted">${s.sub === 'A' ? 'Подгр. А' : s.sub === 'B' ? 'Подгр. Б' : U.esc((s.tracks || []).join(', '))}</div>
              </div>
              <div class="status-pills" data-sid="${s.id}">
                <button class="spill ${rec[s.id]==='present'?'on-present':''}" data-st="present">✓</button>
                <button class="spill ${rec[s.id]==='absent'?'on-absent':''}" data-st="absent">✗</button>
                <button class="spill ${rec[s.id]==='sick'?'on-sick':''}" data-st="sick">🤒</button>
              </div>
            </div>`).join('') :
            `<div class="empty"><p>Нет студентов в этой аудитории.<br>Проверьте расписание или базу.</p></div>`}
        </div>`;
    } else {
      html += `<div class="card"><div class="empty">
        <div class="big">📅</div>
        <p>Сначала настройте расписание на выбранный день.<br><button class="btn" id="at-go-sched" style="margin-top:12px">Открыть расписание</button></p>
      </div></div>`;
    }

    // график за 7 дней
    html += `
      <div class="section-label">Последние 7 дней</div>
      <div class="card" id="at-chart"></div>`;

    el.innerHTML = html;

    // навигация по датам
    el.querySelector('#at-prev').addEventListener('click', () => this.shift(-1));
    el.querySelector('#at-next').addEventListener('click', () => this.shift(1));
    el.querySelector('#at-date-input').addEventListener('change', e => {
      if (e.target.value) { this.state.date = e.target.value; this.state.lessonId = null; this.renderScreen(el); }
    });
    el.querySelector('#at-date-label').addEventListener('click', () => el.querySelector('#at-date-input').showPicker?.());

    // чипы уроков
    el.querySelectorAll('#at-lessons .chip').forEach(c =>
      c.addEventListener('click', () => { this.state.lessonId = c.dataset.lid; this.renderScreen(el); }));

    const goSched = el.querySelector('#at-go-sched');
    if (goSched) goSched.addEventListener('click', () => Bus.emit('nav', 'schedule'));

    // статусы
    el.querySelectorAll('.status-pills').forEach(group => {
      const sid = group.dataset.sid;
      const ST = { present: 'on-present', absent: 'on-absent', sick: 'on-sick' };
      group.querySelectorAll('.spill').forEach(btn => {
        btn.addEventListener('click', () => {
          const cur = Store.lessonRecords(date, lesson.id);
          if (cur[sid] === btn.dataset.st) delete cur[sid];
          else cur[sid] = btn.dataset.st;
          Store.saveLessonRecords(date, lesson.id, cur);
          group.querySelectorAll('.spill').forEach(b =>
            b.className = 'spill' + (cur[sid] === b.dataset.st ? ' ' + ST[b.dataset.st] : ''));
          const audIds = new Set(audience.map(s => s.id));
          const cntEl = el.querySelector('#at-count');
          if (cntEl) cntEl.textContent = `${Object.keys(cur).filter(id => audIds.has(id)).length}/${audience.length}`;
          Bus.emit('attendance:change');
        });
      });
    });

    const allBtn = el.querySelector('#at-all');
    if (allBtn) allBtn.addEventListener('click', () => {
      const map = {};
      audience.forEach(s => map[s.id] = 'present');
      Store.saveLessonRecords(date, lesson.id, map);
      Bus.emit('attendance:change');
      U.toast('Все отмечены присутствующими');
      this.renderScreen(el);
    });

    // монтируем ассистента и график
    Assistant.mount(el.querySelector('#assistant-mount'), { date });
    Charts.render(el.querySelector('#at-chart'), date);

    const ui = Store.ui();
    ui.date = date;
    Store.saveUi(ui);
  },

  shift(n) {
    this.state.date = U.addDays(this.state.date, n);
    this.state.lessonId = null;
    const el = document.getElementById('screen-journal');
    if (el) this.renderScreen(el);
  }
};
