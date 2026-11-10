/* tasks.js — заметки, чеклисты ДЗ, дедлайны */
const Tasks = {
  TYPES: { notice: 'Объявление', hw: 'Домашнее задание', deadline: 'Дедлайн' },

  renderScreen(el) {
    const tasks = Store.tasks().slice().sort((a, b) => {
      if (a.done !== b.done) return a.done - b.done;
      return (a.date || '9999') < (b.date || '9999') ? -1 : 1;
    });
    const byType = t => tasks.filter(x => x.type === t);

    el.innerHTML = `
      <div class="card">
        <div class="row between" style="margin-bottom:12px">
          <strong>Новая задача</strong>
        </div>
        <div class="chips" id="tk-type" style="margin-bottom:10px">
          ${Object.entries(this.TYPES).map(([k, v], i) =>
            `<button class="chip ${i === 0 ? 'on' : ''}" data-v="${k}">${v}</button>`).join('')}
        </div>
        <input class="input" id="tk-title" placeholder="Текст задачи / объявления…" style="margin-bottom:10px">
        <div class="row">
          <input class="input grow" id="tk-date" type="date">
          <button class="btn primary" id="tk-add">Добавить</button>
        </div>
      </div>
      ${Object.entries(this.TYPES).map(([k, label]) => {
        const items = byType(k);
        return items.length ? `
          <div class="section-label">${label}</div>
          <div class="card" style="padding:4px 16px">
            ${items.map(t => this.rowHtml(t)).join('')}
          </div>` : '';
      }).join('')}
      ${!tasks.length ? `<div class="card"><div class="empty"><div class="big">☰</div><p>Задач пока нет.<br>Добавьте объявление, ДЗ или дедлайн.</p></div></div>` : ''}`;

    let type = 'notice';
    el.querySelector('#tk-type').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      type = b.dataset.v;
      el.querySelectorAll('#tk-type .chip').forEach(c => c.classList.toggle('on', c === b));
    });
    el.querySelector('#tk-add').addEventListener('click', () => {
      const title = el.querySelector('#tk-title').value.trim();
      if (!title) { U.toast('Введите текст'); return; }
      const list = Store.tasks();
      list.push({
        id: U.uid(), type, title,
        date: el.querySelector('#tk-date').value || null,
        done: false, created: U.today()
      });
      Store.saveTasks(list);
      Bus.emit('tasks:change');
      this.renderScreen(el);
      U.toast('Задача добавлена');
    });
    el.querySelector('#tk-title').addEventListener('keydown', e => {
      if (e.key === 'Enter') el.querySelector('#tk-add').click();
    });

    el.querySelectorAll('[data-tgl]').forEach(b =>
      b.addEventListener('click', () => {
        const list = Store.tasks();
        const t = list.find(x => x.id === b.dataset.tgl);
        if (t) { t.done = !t.done; Store.saveTasks(list); Bus.emit('tasks:change'); this.renderScreen(el); }
      }));
    el.querySelectorAll('[data-tdel]').forEach(b =>
      b.addEventListener('click', () => {
        Store.saveTasks(Store.tasks().filter(x => x.id !== b.dataset.tdel));
        Bus.emit('tasks:change');
        this.renderScreen(el);
      }));
  },

  rowHtml(t) {
    const overdue = t.date && !t.done && t.date < U.today();
    return `
      <div class="task-item ${t.done ? 'done' : ''}">
        <button class="check ${t.done ? 'done' : ''}" data-tgl="${t.id}">${t.done ? '✓' : ''}</button>
        <div class="grow">
          <div class="task-title">${U.esc(t.title)}</div>
          <div class="task-meta">
            ${t.date ? `<span style="${overdue ? 'color:var(--ink);font-weight:700' : ''}">${overdue ? '⚠ ' : ''}до ${U.fmtDate(t.date)}</span>` : ''}
            ${t.created ? ` · создано ${U.fmtDate(t.created)}` : ''}
          </div>
        </div>
        <button class="icon-btn" data-tdel="${t.id}" title="Удалить">✕</button>
      </div>`;
  }
};
