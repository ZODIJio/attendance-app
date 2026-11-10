/* storage.js — персистентность в localStorage */
const Store = {
  KEY: {
    students: 'att.students',
    profile: 'att.profile',
    theme: 'att.theme',
    palettes: 'att.palettes',
    schedule: 'att.schedule',
    records: 'att.records',
    tasks: 'att.tasks',
    ui: 'att.ui',
    xlsxTemplate: 'att.xlsxTemplate',
    tracks: 'att.tracks',
    semStart: 'att.semStart',
    weekAnchor: 'att.weekAnchor'
  },

  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      U.toast('Хранилище переполнено — удалите старые изображения или данные');
      return false;
    }
  },

  // ---- доменные геттеры/сеттеры ----
  students() {
    const list = this.read(this.KEY.students, []);
    // миграция: track (строка) → tracks (массив)
    return list.map(s => {
      if (s.tracks) return s;
      const { track, ...rest } = s;
      return { ...rest, tracks: track ? [track] : [] };
    });
  },
  saveStudents(v) { return this.write(this.KEY.students, v); },

  allTracks() { return this.read(this.KEY.tracks, []); },
  saveAllTracks(v) { return this.write(this.KEY.tracks, v); },

  profile() {
    return this.read(this.KEY.profile, { name: '', group: '', bio: '', avatar: null, banner: null });
  },
  saveProfile(v) { return this.write(this.KEY.profile, v); },

  theme() {
    return this.read(this.KEY.theme, {
      bg: '#ffffff', surface: '#f6f6f6', surface2: '#ededed',
      ink: '#141414', ink2: '#6b6b6b', ink3: '#a8a8a8',
      line: '#e2e2e2', accent: '#141414', accentInk: '#ffffff',
      radius: 14
    });
  },
  saveTheme(v) { return this.write(this.KEY.theme, v); },

  palettes() { return this.read(this.KEY.palettes, []); },
  savePalettes(v) { return this.write(this.KEY.palettes, v); },

  schedule() { return this.read(this.KEY.schedule, {}); }, // { '1'..'6': [lesson] }
  saveSchedule(v) { return this.write(this.KEY.schedule, v); },

  // records: { "YYYY-MM-DD|lessonId": { studentId: status } }
  records() { return this.read(this.KEY.records, {}); },
  saveRecords(v) { return this.write(this.KEY.records, v); },

  lessonRecords(dateKey, lessonId) {
    const all = this.records();
    return all[`${dateKey}|${lessonId}`] || {};
  },
  saveLessonRecords(dateKey, lessonId, map) {
    const all = this.records();
    all[`${dateKey}|${lessonId}`] = map;
    return this.saveRecords(all);
  },

  tasks() { return this.read(this.KEY.tasks, []); },
  saveTasks(v) { return this.write(this.KEY.tasks, v); },

  ui() { return this.read(this.KEY.ui, { tab: 'home', date: null }); },
  saveUi(v) { return this.write(this.KEY.ui, v); }
};
