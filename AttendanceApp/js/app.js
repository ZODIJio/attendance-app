/* app.js — роутер, главная, экран «Ещё», инициализация */
const App = {
  TABS: ['home', 'journal', 'schedule', 'tasks', 'more'],

  init() {
    Theme.load();
    Attendance.init();

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.go(tab.dataset.tab));
    });
    Bus.on('nav', tab => this.go(tab));

    // живые обновления
    Bus.on('students:change', () => { this.refresh(); });
    Bus.on('attendance:change', () => { this.refreshHome(); });
    Bus.on('tasks:change', () => {});
    Bus.on('schedule:change', () => {});
    Bus.on('profile:change', () => {});

    const ui = Store.ui();
    this.go(ui.tab && this.TABS.includes(ui.tab) ? ui.tab : 'home', true);

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  go(tab, skipSave) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + tab));
    const title = document.querySelector(`#screen-${tab}`).dataset.title;
    document.getElementById('topbar-title').textContent = title;
    if (!skipSave) {
      const ui = Store.ui(); ui.tab = tab; Store.saveUi(ui);
    }
    this.render(tab);
  },

  render(tab) {
    const el = document.getElementById('screen-' + tab);
    if (tab === 'home') this.renderHome(el);
    else if (tab === 'journal') Attendance.renderScreen(el);
    else if (tab === 'schedule') Schedule.renderScreen(el);
    else if (tab === 'tasks') Tasks.renderScreen(el);
    else if (tab === 'more') this.renderMore(el);
  },

  refresh() {
    const active = document.querySelector('.screen.active');
    if (active) this.render(active.id.replace('screen-', ''));
  },

  refreshHome() {
    const el = document.getElementById('screen-home');
    if (el.classList.contains('active')) this.renderHome(el);
  },

  // ---------- Главная ----------
  renderHome(el) {
    const p = State.profile;
    const students = State.students;
    const risk = State.riskStudents();
    const honor = State.honorBoard().slice(0, 5);
    const today = U.today();
    const todayLessons = State.lessonsForDate(today);
    const ui = Store.ui();

    const medal = i => ['🥇', '🥈', '🥉', '4.', '5.'][i] || (i + 1) + '.';

    el.innerHTML = `
      ${p.name || p.group ? `
      <div class="card">
        <div class="row">
          <div class="avatar" style="width:46px;height:46px">${p.avatar ? `<img src="${p.avatar}">` : U.initials(p.name || p.group || 'С')}</div>
          <div class="grow">
            <div class="strong">${U.esc(p.name || 'Староста')}</div>
            <div class="small muted">${U.esc(p.group || '')}${p.bio ? ' · ' + U.esc(p.bio.slice(0, 60)) + (p.bio.length > 60 ? '…' : '') : ''}</div>
          </div>
          <button class="btn sm ghost" id="home-edit-profile">Профиль</button>
        </div>
      </div>` : `
      <div class="card">
        <div class="row between">
          <div><strong>Добро пожаловать</strong><div class="small muted">Настройте профиль и базу студентов</div></div>
          <button class="btn sm" id="home-edit-profile">Начать</button>
        </div>
      </div>`}

      ${risk.length ? `
      <div class="risk-card">
        <h3>⚠ Внимание: группа риска (${risk.length})</h3>
        ${risk.map(({ student: s, stats }) => `
          <div class="risk-item">
            <div class="avatar" style="width:32px;height:32px;font-size:11px">${U.initials(s.name)}</div>
            <div class="grow">
              <div class="strong" style="font-size:13.5px">${U.esc(s.name)}</div>
              <div class="small muted">${stats.unexcused} прогулов · ${stats.absent} отсутствий</div>
            </div>
            <span class="risk-pct">${stats.missPct}%</span>
          </div>`).join('')}
      </div>` : ''}

      <div class="stat-grid" style="margin-bottom:12px">
        <div class="stat"><div class="num">${students.length}</div><div class="lbl">Студентов</div></div>
        <div class="stat"><div class="num">${todayLessons.length}</div><div class="lbl">Пар сегодня</div></div>
        <div class="stat"><div class="num">${Store.tasks().filter(t => !t.done).length}</div><div class="lbl">Открытых задач</div></div>
      </div>

      ${todayLessons.length ? `
      <div class="section-label">Сегодня</div>
      <div class="card" style="padding:6px 16px">
        ${todayLessons.map(l => {
          const aud = students.filter(s => State.inAudience(s, l)).length;
          return `<div class="lesson-row">
            <div class="grow"><div class="strong" style="font-size:14px">${U.esc(l.subject)}</div>
            <div class="small muted">${l.time ? U.esc(l.time) + ' · ' : ''}${l.audience === 'all' ? 'вся группа' : l.audience === 'A' ? 'подгр. А' : l.audience === 'B' ? 'подгр. Б' : U.esc(l.track || 'выборочно')} · ${aud} чел.</div></div>
            <button class="btn sm" data-take="${l.id}">Отметить</button>
          </div>`;
        }).join('')}
      </div>` : ''}

      <div class="section-label">Доска почёта</div>
      <div class="card" style="padding:6px 16px">
        ${honor.length ? honor.map((h, i) => `
          <div class="honor-row">
            <span class="honor-pos">${i < 3 ? `<span class="medal">${['🥇','🥈','🥉'][i]}</span>` : medal(i)}</span>
            <div class="avatar" style="width:30px;height:30px;font-size:10.5px">${U.initials(h.student.name)}</div>
            <div class="grow">
              <div class="strong" style="font-size:13.5px">${U.esc(h.student.name)}</div>
              <div class="honor-bar"><div class="honor-fill" style="width:${h.stats.pct ?? 0}%"></div></div>
            </div>
            <span class="small strong mono-num">${h.stats.pct ?? '—'}%</span>
          </div>`).join('') :
          `<div class="empty"><p>Пока нет данных посещаемости.<br>Отметьте первую пару в журнале.</p></div>`}
      </div>`;

    const pe = el.querySelector('#home-edit-profile');
    if (pe) pe.addEventListener('click', () => this.go('more'));
    el.querySelectorAll('[data-take]').forEach(b =>
      b.addEventListener('click', () => {
        const lesson = todayLessons.find(l => l.id === b.dataset.take);
        if (!lesson) return;
        Attendance.state.date = today;
        Attendance.state.lessonId = lesson.id;
        this.go('journal');
      }));
  },

  // ---------- Ещё ----------
  renderMore(el) {
    el.innerHTML = `
      <div id="more-profile"></div>
      <div id="more-students"></div>
      <div id="more-excel"></div>
      <div id="more-theme"></div>
      <div class="card">
        <div class="row between">
          <div><strong>Данные</strong><div class="small muted">Всё хранится локально в браузере</div></div>
          <button class="btn sm danger" id="more-wipe">Сбросить всё</button>
        </div>
      </div>`;

    Profile.renderMoreSection(el.querySelector('#more-profile'));
    Students.renderMoreSection(el.querySelector('#more-students'));
    Excel.renderMoreSection(el.querySelector('#more-excel'));
    Theme.renderMoreSection(el.querySelector('#more-theme'));

    el.querySelector('#more-wipe').addEventListener('click', () => {
      const m = U.modal(`<h3>Сбросить все данные?</h3>
        <p class="small muted">Будут удалены студенты, записи посещаемости, профиль, темы и задачи. Действие необратимо.</p>
        <div class="modal-actions">
          <button class="btn grow" id="m-cancel">Отмена</button>
          <button class="btn danger grow" id="m-ok">Удалить всё</button>
        </div>`);
      m.query('#m-cancel').addEventListener('click', m.close);
      m.query('#m-ok').addEventListener('click', () => {
        Object.values(Store.KEY).forEach(k => localStorage.removeItem(k));
        m.close();
        location.reload();
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
