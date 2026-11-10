/* excel.js — SheetJS: эталонный шаблон, импорт базы, экспорт отчёта */
const Excel = {
  STATUS_MARK: { present: '+', absent: 'Н', sick: 'Б' },
  TEMPLATE_KEY: 'att.xlsxTemplate',

  renderMoreSection(container) {
    const tpl = this.templateInfo();
    container.innerHTML = `
      <div class="section-label">Excel — шаблоны</div>
      <div class="card">
        <div class="row" style="margin-bottom:10px">
          <div class="grow">
            <strong>Эталонный шаблон отчёта</strong>
            <div class="small muted">
              ${tpl ? `✓ Загружен: <b>${U.esc(tpl.name)}</b>` : 'Не загружен — экспорт строит чистую таблицу'}
            </div>
            <div class="small muted">Шаблон: номера недель читаются из строки с заголовками, ФИО — fuzzy по строкам данных; итоговые формулы не трогаем</div>
          </div>
          <button class="btn" id="xl-tpl">${tpl ? 'Заменить' : 'Загрузить шаблон'}</button>
          ${tpl ? '<button class="btn sm ghost" id="xl-tpl-del">✕</button>' : ''}
          <input type="file" id="xl-tpl-file" accept=".xlsx,.xls" hidden>
        </div>
        <hr class="divider">
        <div class="row" style="margin-bottom:10px">
          <div class="grow">
            <strong>Импорт базы студентов</strong>
            <div class="small muted">.xlsx: колонка с ФИО + необязательные «Подгруппа», «Трек»</div>
          </div>
          <button class="btn" id="xl-import">Загрузить файл</button>
          <input type="file" id="xl-file" accept=".xlsx,.xls,.csv" hidden>
        </div>
        <div class="field" style="margin:10px 0">
          <label>Калибровка недели: дата → № недели</label>
          <div class="row">
            <input type="date" class="input grow" id="xl-anchor-date" value="${State.weekAnchor().monday}">
            <input type="number" class="input" id="xl-anchor-week" min="1" max="40" value="${State.weekAnchor().week}" style="max-width:80px">
            <button class="btn sm" id="xl-anchor-set">Установить</button>
          </div>
          <div class="row" style="margin-top:8px">
            <button class="btn sm ghost" id="xl-semester-reset">Сброс семестра (эта дата = Неделя 1)</button>
          </div>
          <div class="hint">Соседние недели считаются автоматически ±7 дней. Для нового семестра — калибруйте дату с номером 1.</div>
        </div>
        <hr class="divider">
        <div class="row">
          <div class="grow">
            <strong>Экспорт отчёта</strong>
            <div class="small muted">Пропущенные часы за все недели, найденные в шаблоне</div>
          </div>
          <button class="btn primary" id="xl-export">Скачать .xlsx</button>
        </div>
      </div>`;

    container.querySelector('#xl-anchor-set').addEventListener('click', () => {
      const d = container.querySelector('#xl-anchor-date').value;
      const w = Number(container.querySelector('#xl-anchor-week').value);
      if (!d || !w || w < 1) { U.toast('Укажите дату и номер недели'); return; }
      State.setWeekAnchor(d, w);
      U.toast(`Неделя ${w} = неделя с ${U.fmtDate(U.weekStart(d), { day: 'numeric', month: 'long' })}`);
      this.renderMoreSection(container);
    });
    container.querySelector('#xl-semester-reset').addEventListener('click', () => {
      const d = container.querySelector('#xl-anchor-date').value || U.today();
      State.setWeekAnchor(d, 1);
      U.toast('Новый семестр: эта неделя = Неделя 1');
      this.renderMoreSection(container);
    });

    container.querySelector('#xl-tpl').addEventListener('click', () =>
      container.querySelector('#xl-tpl-file').click());
    container.querySelector('#xl-tpl-file').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) this.importTemplate(f);
      e.target.value = '';
    });
    const tdel = container.querySelector('#xl-tpl-del');
    if (tdel) tdel.addEventListener('click', () => {
      Store.write(this.TEMPLATE_KEY, null);
      this.renderMoreSection(container);
      U.toast('Шаблон удалён');
    });

    container.querySelector('#xl-import').addEventListener('click', () =>
      container.querySelector('#xl-file').click());
    container.querySelector('#xl-file').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) this.importStudents(f);
      e.target.value = '';
    });
    container.querySelector('#xl-export').addEventListener('click', () => this.exportWeek());
  },

  templateInfo() {
    const t = Store.read(this.TEMPLATE_KEY, null);
    return t && t.data ? t : null;
  },

  // ---------- шаблон ----------
  importTemplate(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const buf = e.target.result;
        const bytes = new Uint8Array(buf);
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK)
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
        const b64 = btoa(binary);
        if (b64.length > 3_500_000) {
          U.toast('Шаблон слишком большой для localStorage (>2.5 МБ). Используйте файл поменьше.');
          return;
        }
        Store.write(this.TEMPLATE_KEY, { name: file.name, data: b64, at: Date.now() });
        U.toast(`Шаблон «${file.name}» сохранён`);
        const sec = document.querySelector('#more-excel');
        if (sec) this.renderMoreSection(sec);
      } catch (err) {
        console.error(err);
        U.toast('Не удалось прочитать шаблон');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  },

  // ---------- fuzzy-имя для строк Excel ----------
  nameScore(cellText, student) {
    const cn = U.normName(cellText);
    const sn = U.normName(student.name);
    if (!cn || !sn) return 0;
    if (cn === sn) return 100;
    if (cn.includes(sn) || sn.includes(cn)) return 85;
    const ct = cn.split(' '), st = sn.split(' ');
    let matched = 0;
    for (const t of ct) {
      if (st.some(x => x === t || (t.length >= 3 && x.startsWith(t)) || (x.length >= 3 && t.startsWith(x)))) matched++;
    }
    const cov = matched / Math.max(ct.length, 1);
    return cov >= 0.6 ? 60 + cov * 20 : 0;
  },

  // ---------- экспорт ----------
  weekLessons(anchorDate) {
    const wsDate = U.weekStart(anchorDate || U.today());
    const days = U.weekDates(wsDate).filter(d => U.isoDow(d) <= 6);
    const lessons = [];
    days.forEach(d => State.lessonsForDate(d).forEach(l => lessons.push({ date: d, lesson: l })));
    return { wsDate, lessons };
  },

  exportWeek() {
    if (typeof XLSX === 'undefined') { U.toast('SheetJS не загружен'); return; }
    const tpl = this.templateInfo();
    if (tpl) this.exportWithTemplate(tpl);
    else this.exportTable();
  },

  // ----- заполнение эталонного шаблона -----
  exportWithTemplate(tpl) {
    const { wsDate, lessons } = this.weekLessons(Attendance.state.date);
    if (!lessons.length) { U.toast('В эту неделю нет пар в расписании'); return; }

    let wb;
    try {
      wb = XLSX.read(this.b64ToBuf(tpl.data), { type: 'array', cellTypes: true, cellStyles: true });
    } catch (e) {
      console.error(e);
      U.toast('Не удалось прочитать шаблон — использую чистую таблицу');
      this.exportTable();
      return;
    }
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws || !ws['!ref']) { U.toast('Шаблон пуст'); return; }
    if (!State.students.length) { U.toast('База студентов пуста'); return; }

    const stats = this.fillTemplateSheet(ws);

    // --- 4. сохранение ---
    const group = Store.profile().group || 'группа';
    const fname = `Отчет_посещаемости_${group}_${wsDate}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    URL.revokeObjectURL(a.href);

    const missedStudents = State.students.length - stats.studentRows;
    U.toast(`Шаблон: записано ${stats.written} отметок` +
      (stats.missedStudents ? ` · строк не найдено: ${stats.missedStudents}` : ''));
  },

  // длительность пары в академических часах (по умолчанию 2)
  lessonHours(lesson) {
    const m = (lesson.time || '').match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/);
    if (!m) return 2;
    const start = Number(m[1]) * 60 + Number(m[2]);
    let end = Number(m[3]) * 60 + Number(m[4]);
    if (end <= start) end += 24 * 60;
    const h = Math.round((end - start) / 60);
    return h >= 1 ? h : 2;
  },

  fillTemplateSheet(ws) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    const students = State.students;

    // карта всех пар из расписания
    const lessonById = new Map();
    [1, 2, 3, 4, 5, 6].forEach(d =>
      (Store.schedule()[String(d)] || []).forEach(l => lessonById.set(l.id, l)));

    const records = Store.records();

    const cellVal = (r, c) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell && cell.v != null ? cell.v : null;
    };

    // 1. колонки недель: ищем в первых 4 строках ряд с >=2 целыми номерами 1..40
    let weekCols = new Map(); // weekNum → colIndex
    let weekHeaderRow = -1, bestHits = 0;
    const headMax = Math.min(range.e.r, range.s.r + 3);
    for (let r = range.s.r; r <= headMax; r++) {
      const hits = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const v = cellVal(r, c);
        const n = typeof v === 'number' ? v : parseInt(v, 10);
        if (Number.isInteger(n) && n >= 1 && n <= 40 && String(v).trim() !== '') hits.push({ c, n });
      }
      if (hits.length >= 2 && hits.length > bestHits) {
        bestHits = hits.length;
        weekHeaderRow = r;
        weekCols = new Map(hits.map(h => [h.n, h.c]));
      }
    }
    if (!weekCols.size) {
      // fallback: недели 1..15 в колонках C..Q
      for (let w = 1; w <= 15; w++) weekCols.set(w, w + 1);
      weekHeaderRow = range.s.r;
    }

    // 2. колонка ФИО: выбираем колонку (из первых ~6) с макс. числом совпадений
    //    сканируем строки под заголовком недель (до +30 строк — футер не задеваем)
    const nameColMax = Math.min(range.e.c, range.s.c + 5);
    const scanR0 = Math.max(range.s.r + 1, weekHeaderRow + 1);
    const scanR1 = Math.min(range.e.r, weekHeaderRow + 30, range.s.r + 45);
    let nameCol = -1;
    let studentRows = new Map(); // sid → {r}
    for (let c = range.s.c; c <= nameColMax; c++) {
      const hits = new Map();
      for (let r = scanR0; r <= scanR1; r++) {
        const v = cellVal(r, c);
        if (v == null) continue;
        const text = String(v);
        if (text.length < 4) continue;
        let best = null, bs = 0;
        students.forEach(s => {
          if (hits.has(s.id)) return;
          const sc = this.nameScore(text, s);
          if (sc > bs) { bs = sc; best = s; }
        });
        if (best && bs >= 65) hits.set(best.id, { r, name: best.name });
      }
      if (hits.size > studentRows.size) { studentRows = hits; nameCol = c; }
    }

    // 3. сумма пропущенных часов: студент → академическая неделя → часы
    //    считаем только 'absent' (неуважительные); 'sick' — уважительная причина
    const missed = new Map(); // sid → Map(weekNum → hours)
    const bump = (sid, wk, hrs) => {
      if (!missed.has(sid)) missed.set(sid, new Map());
      const m = missed.get(sid);
      m.set(wk, (m.get(wk) || 0) + hrs);
    };
    Object.entries(records).forEach(([key, map]) => {
      const [dateStr, lessonId] = key.split('|');
      const lesson = lessonById.get(lessonId);
      if (!lesson) return;
      const d = U.parseDate(dateStr);
      if (isNaN(d)) return;
      if (U.isoDow(dateStr) === 7) return; // окно недели — только Пн–Сб
      const wk = State.academicWeek(dateStr);
      if (!weekCols.has(wk)) return;
      const hrs = this.lessonHours(lesson);
      Object.entries(map || {}).forEach(([sid, st]) => {
        if (st !== 'absent') return;
        const s = State.studentById(sid);
        if (!s || !State.inAudience(s, lesson)) return;
        bump(sid, wk, hrs);
      });
    });

    // 4. запись только в найденные колонки недель; итоговые формулы (H и пр.) не трогаем
    let written = 0;
    const setNum = (r, c, v) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      let cell = ws[ref];
      if (!cell) {
        // наследуем стиль соседней ячейки, чтобы не потерять сетку шаблона
        for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr < range.s.r || nr > range.e.r || nc < range.s.c || nc > range.e.c) continue;
          const n = ws[XLSX.utils.encode_cell({ r: nr, c: nc })];
          if (n && n.s !== undefined) { cell = { t: 'n', v, s: n.s }; break; }
        }
        if (!cell) cell = { t: 'n', v };
        ws[ref] = cell;
      } else {
        cell.v = v; cell.t = 'n'; // v/t меняем, s (стиль) сохраняем
      }
      written++;
    };
    students.forEach(s => {
      const row = studentRows.get(s.id);
      if (!row) return;
      const weeks = missed.get(s.id);
      weekCols.forEach((c, wk) => {
        const v = Math.round((weeks && weeks.get(wk)) || 0);
        if (v > 0) setNum(row.r, c, v);
      });
    });

    return {
      written,
      studentRows: studentRows.size,
      missedStudents: students.length - studentRows.size,
      nameCol,
      weekCols: [...weekCols.entries()]
    };
  },

  // ----- чистая таблица (fallback) -----
  exportTable() {
    const { wsDate, lessons } = this.weekLessons(Attendance.state.date);
    if (!lessons.length) { U.toast('В эту неделю нет пар в расписании'); return; }
    const students = State.students;
    if (!students.length) { U.toast('База студентов пуста'); return; }

    const columns = lessons.map(it => ({
      header: `${U.parseDate(it.date).toLocaleDateString('ru-RU', { weekday: 'short' })} ${U.fmtDate(it.date)} · ${it.lesson.subject}${it.lesson.time ? ' (' + it.lesson.time + ')' : ''}`,
      ...it
    }));

    const records = Store.records();
    const aoa = [];
    aoa.push(['ФИО', 'Подгруппа', 'Трек', ...columns.map(c => c.header), 'Посещаемость, %', 'Пропуски']);

    students.forEach(s => {
      const cells = columns.map(c => this.STATUS_MARK[records[`${c.date}|${c.lesson.id}`]?.[s.id]] || '—');
      const st = State.studentStats(s.id);
      aoa.push([s.name, s.sub === 'A' ? 'А' : s.sub === 'B' ? 'Б' : '', (s.tracks || []).join(', '),
        ...cells, st.pct === null ? '—' : st.pct + '%', st.absent]);
    });

    const totals = columns.map(c => {
      let p = 0, n = 0;
      students.forEach(s => {
        const m = records[`${c.date}|${c.lesson.id}`] || {};
        if (m[s.id]) { n++; if (m[s.id] === 'present') p++; }
      });
      return n ? Math.round(p / n * 100) + '%' : '—';
    });
    aoa.push(['ИТОГО по паре', '', '', ...totals, '', '']);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 12 }, ...columns.map(() => ({ wch: 14 })), { wch: 12 }, { wch: 9 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Посещаемость');
    const group = Store.profile().group || 'группа';
    const fname = `Отчет_посещаемости_${group}_${wsDate}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, fname);
    U.toast('Отчёт скачан (чистая таблица)');
  },

  // ---------- импорт базы ----------
  importStudents(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) { U.toast('Файл пуст или без данных'); return; }

        let headRow = 0, cols = {};
        for (let r = 0; r < Math.min(5, rows.length); r++) {
          const cells = rows[r].map(c => String(c).toLowerCase());
          const nameCol = cells.findIndex(c => /фио|имя|студент|фамилия/.test(c));
          if (nameCol >= 0) {
            headRow = r;
            cols.name = nameCol;
            cols.sub = cells.findIndex(c => /подгруп|sub/.test(c));
            cols.track = cells.findIndex(c => /трек|track|язык|курс/.test(c));
            break;
          }
        }
        if (cols.name === undefined || cols.name < 0) cols = { name: 0, sub: -1, track: -1 };

        const start = headRow >= 0 ? headRow + 1 : 0;
        const existing = new Map(State.students.map(s => [U.normName(s.name), s.id]));
        const list = State.students.slice();
        let added = 0, updated = 0;
        for (let r = start; r < rows.length; r++) {
          const row = rows[r];
          const name = String(row[cols.name] || '').trim().replace(/\s+/g, ' ');
          if (!name || name.length < 3) continue;
          const subRaw = cols.sub >= 0 ? String(row[cols.sub] || '').toLowerCase() : '';
          const sub = /б|b/.test(subRaw) && !/а|a/.test(subRaw) ? 'B' : 'A';
          const trackRaw = cols.track >= 0 ? String(row[cols.track] || '').trim() : '';
          const tracks = trackRaw ? trackRaw.split(/[,;/]/).map(t => t.trim()).filter(Boolean) : [];
          tracks.forEach(t => State.addTrack(t));
          const key = U.normName(name);
          if (existing.has(key)) {
            const s = list.find(x => x.id === existing.get(key));
            if (s && (cols.sub >= 0 || tracks.length)) {
              s.sub = sub;
              const merged = [...new Set([...(s.tracks || []), ...tracks])];
              s.tracks = merged;
              updated++;
            }
          } else {
            list.push({ id: U.uid(), name, sub, tracks });
            existing.set(key, list[list.length - 1].id);
            added++;
          }
        }
        Store.saveStudents(list);
        Bus.emit('students:change');
        U.toast(`Импорт: +${added} новых, ~${updated} обновлено`);
      } catch (err) {
        console.error(err);
        U.toast('Не удалось прочитать файл');
      }
    };
    reader.readAsArrayBuffer(file);
  }
};
