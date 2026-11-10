/* assistant.js — Глобальный дневной AI-диспетчер (текст + голос, несколько пар) */
const Assistant = {
  recognition: null,

  mount(container, ctx) {
    // ctx: { date } — парсим весь день; если передан lesson, ограничиваемся им
    container.innerHTML = `
      <div class="section-label">AI-помощник</div>
      <div class="assistant-box">
        <div class="assistant-input-row">
          <input class="input" id="as-input" placeholder="Весь день: «ИКТ есть Байжан, Никита; Вышмат все кроме Арлана»">
          <button class="mic-btn" id="as-mic" title="Голосовой ввод">🎤</button>
          <button class="btn primary" id="as-go">Разобрать</button>
        </div>
        <div class="hint" id="as-hint">Предметы распознаются по расписанию дня. Конструкции: <code>[предмет] есть [имена]</code>, <code>[предмет] есть все кроме [имён]</code>, <code>[предмет] все болеют</code>. Имена без предмета — к последнему упомянутому или ко всем парам дня.</div>
        <div id="as-confirm"></div>
      </div>`;

    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const mic = container.querySelector('#as-mic');
    if (!supported) mic.style.display = 'none';

    const go = () => this.parse(container, ctx);
    container.querySelector('#as-go').addEventListener('click', go);
    container.querySelector('#as-input').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });

    if (supported) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SR();
      this.recognition.lang = 'ru-RU';
      this.recognition.interimResults = false;
      this.recognition.onresult = e => {
        container.querySelector('#as-input').value = e.results[0][0].transcript;
        mic.classList.remove('listening');
        this.parse(container, ctx);
      };
      this.recognition.onend = () => mic.classList.remove('listening');
      this.recognition.onerror = () => { mic.classList.remove('listening'); U.toast('Микрофон недоступен'); };
      mic.addEventListener('click', () => {
        try { this.recognition.start(); mic.classList.add('listening'); }
        catch { U.toast('Микрофон уже активен'); }
      });
    }
  },

  // ---------- базовый fuzzy ----------
  levenshtein(a, b) {
    a = U.normName(a); b = U.normName(b);
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    return dp[m][n];
  },

  tokMatch(qt, nt) {
    if (qt === nt) return 3;
    if (qt.length >= 3 && nt.startsWith(qt)) return 2;
    if (nt.length >= 3 && qt.startsWith(nt)) return 2;
    if (qt.length >= 4 && nt.length >= 4 && this.levenshtein(qt, nt) <= 1) return 1;
    return 0;
  },

  findStudent(phrase) {
    const qTokens = U.normName(phrase).split(' ').filter(Boolean);
    if (!qTokens.length) return null;
    let best = null, bestScore = 0;
    State.students.forEach(s => {
      const nTokens = U.normName(s.name).split(' ').filter(Boolean);
      if (!nTokens.length) return;
      const full = U.normName(s.name), qFull = qTokens.join(' ');
      let score = 0;
      if (full === qFull) score = 100;
      else {
        let ok = true, matched = 0;
        const usedIdx = new Set();
        for (const qt of qTokens) {
          let m = -1, mScore = 0;
          nTokens.forEach((nt, idx) => {
            if (usedIdx.has(idx)) return;
            const sc = this.tokMatch(qt, nt);
            if (sc > mScore) { mScore = sc; m = idx; }
          });
          if (m < 0) { ok = false; break; }
          usedIdx.add(m); matched += mScore;
        }
        if (!ok) return;
        score = 50 + matched * 12 + (usedIdx.size / nTokens.length) * 20;
        if (qTokens.length === nTokens.length && matched >= qTokens.length * 2) score += 15;
      }
      if (score > bestScore) { bestScore = score; best = s; }
    });
    return bestScore >= 60 ? { student: best, score: bestScore } : null;
  },

  // ---------- статусы ----------
  STATUS_PHRASES: [
    ['absent', ['не был', 'не была', 'не пришел', 'не пришла', 'не явился', 'не явилась', 'отсутствует', 'отсутствовал', 'отсутствовала', 'прогул', 'прогулял', 'прогуляла', 'нет', 'нету', 'не на паре', 'не на занятии', 'сбежал', 'сбежала']],
    ['sick',    ['болеет', 'больничн', 'болен', 'больна', 'заболел', 'заболела', 'температур', 'врач', 'лежит', 'лечится', 'на больничном', 'sick']],
    ['present', ['есть', 'присутствует', 'присутствовал', 'присутствовала', 'был', 'была', 'пришел', 'пришла', 'явился', 'явилась', 'на месте', 'в классе', 'тут', 'ок', 'ok', 'yes']]
  ],

  detectStatus(text) {
    const t = ' ' + U.normName(text) + ' ';
    for (const [st, words] of this.STATUS_PHRASES) {
      for (const w of words) {
        const nw = U.normName(w);
        if (nw.length < 2) continue;
        if (t.includes(' ' + nw + ' ')) return st;
      }
    }
    return null;
  },

  STATUS_TOKENS() {
    if (this._st) return this._st;
    this._st = new Set(this.STATUS_PHRASES.flatMap(([, ws]) => ws.map(U.normName)));
    return this._st;
  },

  SKIP_TOKENS() {
    if (this._skip) return this._skip;
    this._skip = new Set([...this.STATUS_TOKENS(),
      'и', 'а', 'но', 'тоже', 'также', 'у', 'с', 'со', 'на', 'в', 'во', 'по', 'за', 'из', 'от', 'до',
      'кроме', 'обе', 'обеих', 'две', 'пары', 'пара', 'пар', 'предмет', 'первую', 'вторую', 'утро', 'вечер',
      'полное', 'имя', 'фамилия', 'все', 'всё', 'группа', 'группе', 'группу', 'студенты', 'студент', 'список']);
    return this._skip;
  },

  // ---------- распознавание предметов ----------
  subjStopSet() {
    if (!this._subjStop) this._subjStop = new Set(['и', 'а', 'на', 'по', 'в', 'во', 'с', 'со', 'для', 'the', 'of']);
    return this._subjStop;
  },

  subjTokens(subject) {
    const stop = this.subjStopSet();
    return U.normName(subject).split(' ').filter(t => t && !stop.has(t));
  },

  comp(s) { // сжатая форма для аббревиатур: «вышмат» ⊂ «высшаяматематика»
    return U.normName(s).replace(/[аеёиоуыэюяьъ]/g, '');
  },

  // скоринг окна токенов против предмета: покрытие токенов + аббревиатура
  subjectScore(winTokens, subject) {
    const st = this.subjTokens(subject);
    if (!st.length) return 0;
    let matched = 0, sum = 0;
    for (const sTok of st) {
      let best = 0;
      for (const wTok of winTokens) {
        const sc = this.tokMatch(sTok, wTok);
        if (sc > best) best = sc;
      }
      if (best > 0) { matched++; sum += best; }
    }
    const coverage = matched / st.length;
    // аббревиатура: «вышмат» — подпоследовательность сжатых букв предмета
    const winStr = this.comp(winTokens.join(''));
    const subjStr = this.comp(subject);
    let abbr = false;
    if (winStr.length >= 4 && winStr.length <= subjStr.length) {
      let k = 0;
      for (const ch of subjStr) if (ch === winStr[k]) k++;
      abbr = k === winStr.length;
    }
    if (abbr) return Math.max(coverage * 100 + sum * 2, 85);
    return coverage >= 0.5 ? coverage * 100 + sum * 2 : 0;
  },

  // ищем предмет начиная с позиции i; возвращает {key, span, score}
  findSubjectAt(tokens, i, subjects) {
    let best = null;
    const maxW = Math.min(5, tokens.length - i);
    for (let w = 1; w <= maxW; w++) {
      const win = tokens.slice(i, i + w);
      if (win.some(t => this.SKIP_TOKENS().has(t))) continue;
      for (const [key, subject] of subjects) {
        const sc = this.subjectScore(win, subject);
        if (sc >= 55 && (!best || sc > best.score)) {
          best = { key, span: w, score: sc };
        }
      }
    }
    return best;
  },

  // ---------- разбор имён внутри сегмента ----------
  // возвращает [{student, status, raw}]
  parseNames(tokens, defaultStatus = 'present') {
    const out = [];
    const used = new Set();
    const SKIP = this.SKIP_TOKENS();
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (SKIP.has(tok)) { i++; continue; }
      let found = null, span = 0;
      for (let len = Math.min(3, tokens.length - i); len >= 1; len--) {
        const phrase = tokens.slice(i, i + len).join(' ');
        const hit = this.findStudent(phrase);
        if (hit && !used.has(hit.student.id)) { found = hit.student; span = len; break; }
      }
      if (!found) { i++; continue; }
      // граница — следующее имя
      let boundary = tokens.length;
      outer:
      for (let j = i + span; j < Math.min(tokens.length, i + span + 9); j++) {
        if (SKIP.has(tokens[j])) continue;
        for (let len = Math.min(3, tokens.length - j); len >= 1; len--) {
          const hit = this.findStudent(tokens.slice(j, j + len).join(' '));
          if (hit && hit.student.id !== found.id) { boundary = j; break outer; }
        }
      }
      let status = this.detectStatus(tokens.slice(i + span, boundary).join(' '));
      if (!status) status = this.detectStatus(tokens.slice(Math.max(0, i - 4), i).join(' '));
      status = status || defaultStatus;
      used.add(found.id);
      out.push({ student: found, status });
      i += span;
    }
    return out;
  },

  // ---------- главный парсер ----------
  parse(container, ctx) {
    const input = container.querySelector('#as-input');
    const text = input.value.trim();
    if (!text) { U.toast('Введите фразу'); return; }

    const date = ctx.date || U.today();
    let lessons = State.lessonsForDate(date);
    if (ctx.lesson) lessons = lessons.filter(l => l.id === ctx.lesson.id);
    if (!lessons.length) { U.toast('На этот день нет пар в расписании'); return; }

    // уникальные предметы дня: key=normName(subject) → {subject, lessons[]}
    const subjects = new Map();
    lessons.forEach(l => {
      const key = U.normName(l.subject);
      if (!subjects.has(key)) subjects.set(key, { subject: l.subject, lessons: [] });
      subjects.get(key).lessons.push(l);
    });

    const tokens = U.normName(text).split(/\s+/).filter(Boolean);

    // сегментация по предметам
    const segments = []; // {subjKey|null, tokens[]}
    let cur = { subjKey: null, tokens: [] };
    let i = 0;
    while (i < tokens.length) {
      const hit = this.findSubjectAt(tokens, i, subjects);
      if (hit) {
        if (cur.tokens.length || cur.subjKey !== null || segments.length) segments.push(cur);
        cur = { subjKey: hit.key, tokens: [] };
        i += hit.span;
      } else {
        cur.tokens.push(tokens[i]);
        i++;
      }
    }
    segments.push(cur);

    // разбор каждого сегмента
    // result: Map lessonId → Map sid → {status, name}
    const result = new Map();
    const skipped = new Set();
    const ensure = lid => { if (!result.has(lid)) result.set(lid, new Map()); return result.get(lid); };

    const applyToLessons = (subjKey, entries, mode) => {
      const target = subjKey ? subjects.get(subjKey).lessons : lessons;
      target.forEach(l => {
        const aud = State.students.filter(s => State.inAudience(s, l));
        const map = ensure(l.id);
        if (mode === 'all') {
          aud.forEach(s => map.set(s.id, { status: 'present', name: s.name }));
        }
        entries.forEach(e => {
          const st = State.studentById(e.student.id);
          if (st && State.inAudience(st, l)) map.set(st.id, { status: e.status, name: st.name });
          else skipped.add(e.student.name);
        });
      });
    };

    segments.forEach(seg => {
      const hasVse = seg.tokens.some(t => ['все', 'вся', 'всё', 'полный', 'полная', 'полные'].includes(t));
      const kromeIdx = seg.tokens.indexOf('кроме');
      const names = this.parseNames(seg.tokens);

      if (kromeIdx >= 0) {
        // «[все] кроме X, Y» → все присутствуют, кроме перечисленных
        const post = this.parseNames(seg.tokens.slice(kromeIdx + 1), 'absent');
        applyToLessons(seg.subjKey, post, 'all');
        // явные статусы до «кроме» (напр. «никита болеет, все кроме арлана»)
        const pre = this.parseNames(seg.tokens.slice(0, kromeIdx));
        pre.forEach(e => {
          const target = seg.subjKey ? subjects.get(seg.subjKey).lessons : lessons;
          target.forEach(l => {
            const st = State.studentById(e.student.id);
            if (st && State.inAudience(st, l)) ensure(l.id).set(st.id, { status: e.status, name: st.name });
          });
        });
        // post-имена уже absent по умолчанию; если у них явный статус — parseNames вернул его
        return;
      }

      if (!names.length && hasVse) {
        applyToLessons(seg.subjKey, [], 'all');
        return;
      }
      if (!names.length) return;
      applyToLessons(seg.subjKey, names, null);
    });

    if (!result.size) {
      U.toast('Ничего не распознано. Пример: «ИКТ есть Никита, Байжана; Политология все кроме Арлана»');
      this.showConfirm(container, new Map(), date);
      return;
    }

    this.showConfirm(container, result, date, [...skipped]);
  },

  // ---------- Confirm Card ----------
  showConfirm(container, result, date, skipped = []) {
    const box = container.querySelector('#as-confirm');
    if (!result.size) { box.innerHTML = ''; return; }
    const LABEL = { present: 'Присутствует', absent: 'Отсутствует', sick: 'Болеет' };
    const ST_CLS = { present: 's-present', absent: 's-absent', sick: 's-sick' };

    const lessonInfo = lid => {
      for (const l of State.lessonsForDate(date)) if (l.id === lid) return l;
      return null;
    };

    const groups = [...result.entries()].map(([lid, map]) => {
      const l = lessonInfo(lid);
      const title = l ? `${l.subject}${l.time ? ' · ' + l.time : ''}` : lid;
      return { lid, title, entries: [...map.values()] };
    });

    box.innerHTML = `
      <div class="confirm-card">
        <h4><span>Дневная сводка — ${U.fmtDateFull(date)}</span>
          <button class="btn sm ghost" id="as-cancel">✕</button></h4>
        ${groups.map((g, gi) => `
          <div style="margin-bottom:12px">
            <div class="small strong" style="margin-bottom:6px">${U.esc(g.title)} <span class="faint">(${g.entries.length})</span></div>
            <div class="confirm-chips">
              ${g.entries.map((e, ei) => `
                <button class="cchip ${ST_CLS[e.status]}" data-g="${gi}" data-i="${ei}" title="Клик — сменить статус">
                  ${U.esc(e.name)} · ${LABEL[e.status]}
                </button>`).join('')}
            </div>
          </div>`).join('')}
        ${skipped.length ? `<div class="hint">⚠ Не в аудитории пар: ${skipped.map(U.esc).join(', ')}</div>` : ''}
        <div class="hint">Клик по плашке меняет статус. Проверьте сводку перед применением.</div>
        <div class="row" style="margin-top:12px">
          <button class="btn grow" id="as-cancel2">Отмена</button>
          <button class="btn primary grow" id="as-apply">Принять всё ✓</button>
        </div>
      </div>`;

    // кликабельные статусы
    const order = ['present', 'absent', 'sick'];
    box.querySelectorAll('.cchip').forEach(ch => {
      ch.addEventListener('click', () => {
        const g = groups[Number(ch.dataset.g)];
        const e = g.entries[Number(ch.dataset.i)];
        e.status = order[(order.indexOf(e.status) + 1) % order.length];
        ch.className = `cchip ${ST_CLS[e.status]}`;
        ch.innerHTML = `${U.esc(e.name)} · ${LABEL[e.status]}`;
      });
    });

    const close = () => { box.innerHTML = ''; };
    box.querySelector('#as-cancel').addEventListener('click', close);
    box.querySelector('#as-cancel2').addEventListener('click', close);

    box.querySelector('#as-apply').addEventListener('click', () => {
      let n = 0;
      result.forEach((map, lid) => {
        const cur = Store.lessonRecords(date, lid);
        map.forEach((v, sid) => { cur[sid] = v.status; n++; });
        Store.saveLessonRecords(date, lid, cur);
      });
      Bus.emit('attendance:change');
      close();
      U.toast(`Применено отметок: ${n} в ${result.size} парах`);
      const scr = document.getElementById('screen-journal');
      if (scr) Attendance.renderScreen(scr);
    });
  }
};
