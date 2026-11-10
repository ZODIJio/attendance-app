/* state.js — глобальное состояние и шина событий */
const Bus = {
  _subs: {},
  on(evt, fn) {
    (this._subs[evt] = this._subs[evt] || []).push(fn);
  },
  emit(evt, payload) {
    (this._subs[evt] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.error(e); }
    });
  }
};

const State = {
  get students() { return Store.students(); },
  get profile() { return Store.profile(); },
  get theme() { return Store.theme(); },
  get schedule() { return Store.schedule(); },
  get tasks() { return Store.tasks(); },

  // мастер-список всех когда-либо созданных треков (реестр + используемые)
  tracks() {
    const set = new Set(Store.allTracks());
    Store.students().forEach(s => (s.tracks || []).forEach(t => set.add(t)));
    return [...set];
  },

  addTrack(name) {
    const n = String(name || '').trim();
    if (!n) return false;
    const list = Store.allTracks();
    if (!list.includes(n)) {
      list.push(n);
      Store.saveAllTracks(list);
    }
    return true;
  },

  // ---- калибровка академических недель ----
  // якорь: { monday: 'YYYY-MM-DD', week: N } — дата внутри недели N
  weekAnchor() {
    const saved = Store.read(Store.KEY.weekAnchor, null);
    if (saved && saved.date && saved.week) {
      return { monday: U.weekStart(saved.date), week: saved.week };
    }
    // миграция со старого semStart (начало недели 1)
    const legacy = Store.read(Store.KEY.semStart, null);
    if (legacy) return { monday: U.weekStart(legacy), week: 1 };
    const now = new Date();
    const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return { monday: U.weekStart(U.dateKey(new Date(y, 8, 1))), week: 1 };
  },

  setWeekAnchor(dateKey, weekNum) {
    Store.write(Store.KEY.weekAnchor, { date: dateKey, week: weekNum });
  },

  // номер академической недели для даты (offset от якоря по 7 дней)
  academicWeek(dateKey) {
    const a = this.weekAnchor();
    const d = U.parseDate(dateKey);
    const s = U.parseDate(a.monday);
    const diff = Math.floor((d.getTime() - s.getTime()) / (7 * 86400000));
    return a.week + diff;
  },

  studentById(id) {
    return Store.students().find(s => s.id === id);
  },

  // подходит ли студент под целевую аудиторию урока
  inAudience(student, lesson) {
    if (!lesson) return true;
    const aud = lesson.audience || 'all';
    if (aud === 'all') return true;
    if (aud === 'A' || aud === 'B') return student.sub === aud;
    if (aud === 'custom') return (student.tracks || []).includes(lesson.track) || student.track === lesson.track;
    return true;
  },

  // уроки на конкретную дату (dateKey → day-of-week)
  lessonsForDate(dateKey) {
    const dow = U.isoDow(dateKey);
    return this.schedule[String(dow)] || [];
  },

  // записи посещаемости за последние n дней: [{date, present, absent, sick, total}]
  attendanceHistory(days = 7, filterStudentId = null) {
    const records = Store.records();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const dk = U.addDays(U.today(), -i);
      let p = 0, a = 0, s = 0, total = 0;
      Object.keys(records).forEach(k => {
        if (!k.startsWith(dk + '|')) return;
        const map = records[k];
        Object.entries(map).forEach(([sid, st]) => {
          if (filterStudentId && sid !== filterStudentId) return;
          total++;
          if (st === 'present') p++;
          else if (st === 'absent') a++;
          else if (st === 'sick') s++;
        });
      });
      out.push({ date: dk, present: p, absent: a, sick: s, total });
    }
    return out;
  },

  // статистика конкретного студента
  studentStats(studentId) {
    const records = Store.records();
    let p = 0, a = 0, s = 0;
    Object.values(records).forEach(map => {
      const st = map[studentId];
      if (st === 'present') p++;
      else if (st === 'absent') a++;
      else if (st === 'sick') s++;
    });
    const marked = p + a + s;
    const unexcused = a;
    return {
      present: p, absent: a, sick: s, marked,
      pct: marked ? Math.round(p / marked * 100) : null,
      missPct: marked ? Math.round(a / marked * 100) : 0,
      unexcused,
      atRisk: marked > 0 && (a / marked > 0.30 || unexcused >= 3)
    };
  },

  riskStudents() {
    return Store.students()
      .map(s => ({ student: s, stats: this.studentStats(s.id) }))
      .filter(x => x.stats.atRisk);
  },

  // рейтинг для доски почёта
  honorBoard() {
    return Store.students()
      .map(s => ({ student: s, stats: this.studentStats(s.id) }))
      .filter(x => x.stats.marked > 0)
      .sort((x, y) => {
        const px = x.stats.pct ?? -1, py = y.stats.pct ?? -1;
        if (py !== px) return py - px;
        return y.stats.present - x.stats.present;
      });
  }
};
