/* theme.js — Дизайн-студия: монохромные палитры + скругления */
const Theme = {
  PRESETS: [
    { name: 'Чистый',      bg: '#ffffff', surface: '#f6f6f6', surface2: '#ededed', ink: '#141414', ink2: '#6b6b6b', ink3: '#a8a8a8', line: '#e2e2e2', accent: '#141414', accentInk: '#ffffff', radius: 14 },
    { name: 'Мягкий',      bg: '#fafafa', surface: '#f0f0f0', surface2: '#e4e4e4', ink: '#1c1c1c', ink2: '#707070', ink3: '#a5a5a5', line: '#dedede', accent: '#1c1c1c', accentInk: '#fafafa', radius: 18 },
    { name: 'Графит',      bg: '#f4f4f4', surface: '#e9e9e9', surface2: '#dbdbdb', ink: '#0d0d0d', ink2: '#5c5c5c', ink3: '#9c9c9c', line: '#d2d2d2', accent: '#0d0d0d', accentInk: '#f4f4f4', radius: 10 },
    { name: 'Терракота',   bg: '#fdf8f5', surface: '#f5ece6', surface2: '#ecdfd5', ink: '#2b211b', ink2: '#6e5f55', ink3: '#a8978a', line: '#e4d7cb', accent: '#a0522d', accentInk: '#ffffff', radius: 14 },
    { name: 'Ультрамарин', bg: '#f7f8fc', surface: '#eef0f8', surface2: '#e2e6f2', ink: '#141a2e', ink2: '#5c6480', ink3: '#98a0b8', line: '#dde1ef', accent: '#2b3a8f', accentInk: '#ffffff', radius: 14 },
    { name: 'Олива',       bg: '#f8f9f4', surface: '#f0f2e8', surface2: '#e4e8d8', ink: '#1e2416', ink2: '#66704f', ink3: '#9aa386', line: '#dde2cf', accent: '#556b2f', accentInk: '#ffffff', radius: 14 },
    { name: 'Глубокий',    bg: '#101010', surface: '#1a1a1a', surface2: '#242424', ink: '#f2f2f2', ink2: '#9a9a9a', ink3: '#6a6a6a', line: '#2c2c2c', accent: '#f2f2f2', accentInk: '#101010', radius: 14 }
  ],

  apply(t) {
    const r = document.documentElement.style;
    r.setProperty('--bg', t.bg);
    r.setProperty('--surface', t.surface);
    r.setProperty('--surface-2', t.surface2);
    r.setProperty('--ink', t.ink);
    r.setProperty('--ink-2', t.ink2);
    r.setProperty('--ink-3', t.ink3);
    r.setProperty('--line', t.line);
    r.setProperty('--accent', t.accent);
    r.setProperty('--accent-ink', t.accentInk);
    r.setProperty('--radius', t.radius + 'px');
    r.setProperty('--radius-sm', Math.max(4, Math.round(t.radius * 0.6)) + 'px');
  },

  load() {
    this.apply(Store.theme());
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', Store.theme().bg);
  },

  save(v) {
    Store.saveTheme(v);
    this.apply(v);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', v.bg);
    Bus.emit('theme:change');
  },

  renderMoreSection(container) {
    const t = Store.theme();
    const saved = Store.palettes();
    container.innerHTML = `
      <div class="section-label">Дизайн-студия</div>
      <div class="card">
        <div class="row between" style="margin-bottom:14px">
          <strong>Готовые монохромные палитры</strong>
          <button class="btn sm" id="th-reset">Сбросить</button>
        </div>
        <div class="swatches" id="th-swatches">
          ${this.PRESETS.map((p, i) => `
            <button class="swatch ${t.accent === p.accent && t.bg === p.bg ? 'on' : ''}"
              data-i="${i}" title="${U.esc(p.name)}"
              style="background:linear-gradient(135deg, ${p.bg} 50%, ${p.accent} 50%)"></button>`).join('')}
        </div>
        <hr class="divider">
        <div class="palette-row">
          <label class="small muted grow">Фон</label>
          <input type="color" class="color-input" id="th-bg" value="${t.bg}">
        </div>
        <div class="palette-row">
          <label class="small muted grow">Поверхности</label>
          <input type="color" class="color-input" id="th-surface" value="${t.surface}">
          <input type="color" class="color-input" id="th-surface2" value="${t.surface2}">
        </div>
        <div class="palette-row">
          <label class="small muted grow">Текст и линии</label>
          <input type="color" class="color-input" id="th-ink" value="${t.ink}">
          <input type="color" class="color-input" id="th-ink2" value="${t.ink2}">
          <input type="color" class="color-input" id="th-line" value="${t.line}">
        </div>
        <div class="palette-row">
          <label class="small muted grow">Акцент</label>
          <input type="color" class="color-input" id="th-accent" value="${t.accent}">
          <input type="color" class="color-input" id="th-accentink" value="${t.accentInk}">
        </div>
        <div class="field" style="margin-top:14px">
          <label>Скругление интерфейса — <span id="th-radius-val">${t.radius}</span>px</label>
          <input type="range" id="th-radius" min="0" max="28" value="${t.radius}">
        </div>
        <div class="row" style="margin-top:10px">
          <input class="input grow" id="th-palette-name" placeholder="Название палитры">
          <button class="btn" id="th-save-palette">Сохранить палитру</button>
        </div>
        ${saved.length ? `
        <div class="swatches" id="th-saved" style="margin-top:12px">
          ${saved.map((p, i) => `
            <button class="swatch ${t.bg === p.bg && t.accent === p.accent ? 'on' : ''}"
              data-i="${i}" title="${U.esc(p.name)}"
              style="background:linear-gradient(135deg, ${p.bg} 50%, ${p.accent} 50%)"></button>`).join('')}
          <button class="btn sm ghost" id="th-del-palettes">✕ все</button>
        </div>` : ''}
      </div>`;

    const cur = () => ({
      bg: container.querySelector('#th-bg').value,
      surface: container.querySelector('#th-surface').value,
      surface2: container.querySelector('#th-surface2').value,
      ink: container.querySelector('#th-ink').value,
      ink2: container.querySelector('#th-ink2').value,
      ink3: t.ink3,
      line: container.querySelector('#th-line').value,
      accent: container.querySelector('#th-accent').value,
      accentInk: container.querySelector('#th-accentink').value,
      radius: Number(container.querySelector('#th-radius').value)
    });

    const live = () => { Theme.apply(cur()); };
    ['#th-bg','#th-surface','#th-surface2','#th-ink','#th-ink2','#th-line','#th-accent','#th-accentink']
      .forEach(sel => container.querySelector(sel).addEventListener('input', live));
    container.querySelector('#th-radius').addEventListener('input', e => {
      container.querySelector('#th-radius-val').textContent = e.target.value;
      live();
    });

    container.querySelectorAll('#th-swatches .swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        const p = this.PRESETS[Number(sw.dataset.i)];
        Object.entries({ bg: p.bg, surface: p.surface, surface2: p.surface2, ink: p.ink, ink2: p.ink2, line: p.line, accent: p.accent, accentInk: p.accentInk, radius: p.radius })
          .forEach(([k, v]) => {
            const el = container.querySelector(`#th-${k === 'accentInk' ? 'accentink' : k === 'surface2' ? 'surface2' : k}`);
            if (el) el.value = v;
          });
        container.querySelector('#th-radius').value = p.radius;
        container.querySelector('#th-radius-val').textContent = p.radius;
        Theme.save(cur());
        U.toast(`Палитра «${p.name}»`);
      });
    });

    const savedBox = container.querySelector('#th-saved');
    if (savedBox) {
      savedBox.querySelectorAll('.swatch[data-i]').forEach(sw => {
        sw.addEventListener('click', () => {
          const p = Store.palettes()[Number(sw.dataset.i)];
          if (p) { Theme.save(p); this.renderMoreSection(container); U.toast(`Палитра «${p.name}»`); }
        });
      });
      const del = savedBox.querySelector('#th-del-palettes');
      if (del) del.addEventListener('click', () => {
        Store.savePalettes([]);
        this.renderMoreSection(container);
      });
    }

    container.querySelector('#th-reset').addEventListener('click', () => {
      Theme.save(this.PRESETS[0]);
      this.renderMoreSection(container);
      U.toast('Тема сброшена');
    });

    container.querySelector('#th-save-palette').addEventListener('click', () => {
      const name = container.querySelector('#th-palette-name').value.trim() || 'Моя палитра';
      const list = Store.palettes();
      list.push({ name, ...cur() });
      Store.savePalettes(list);
      this.renderMoreSection(container);
      U.toast('Палитра сохранена');
    });
  }
};
