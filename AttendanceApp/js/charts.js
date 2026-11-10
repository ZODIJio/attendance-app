/* charts.js — аналитика на чистом HTML/CSS (без библиотек) */
const Charts = {
  render(container, focusDate) {
    const hist = State.attendanceHistory(7);
    const max = Math.max(1, ...hist.map(h => h.total));
    container.innerHTML = `
      <div class="bars">
        ${hist.map(h => {
          const hPct = h.total ? h.present / h.total * 100 : 0;
          const aPct = h.total ? h.absent / h.total * 100 : 0;
          const sPct = h.total ? h.sick / h.total * 100 : 100 - hPct - aPct;
          const isToday = h.date === focusDate;
          return `
          <div class="bar-col" title="${U.fmtDateFull(h.date)}: ${h.present}✓ ${h.absent}✗ ${h.sick}🤒">
            <div class="bar-val mono-num">${h.total ? Math.round(hPct) + '%' : ''}</div>
            <div class="bar-stack" style="height:${Math.max(4, h.total ? (h.total / max) * 96 : 4)}px">
              ${h.total ? `
                <div class="bar-seg p" style="height:${hPct}%"></div>
                <div class="bar-seg s" style="height:${sPct}%"></div>
                <div class="bar-seg a" style="height:${aPct}%"></div>` : ''}
            </div>
            <div class="bar-day" style="${isToday ? 'color:var(--ink);font-weight:700' : ''}">${U.parseDate(h.date).getDate()}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="legend">
        <span><i style="background:var(--ink)"></i>Присутствуют</span>
        <span><i style="background:var(--surface-2);border:1px solid var(--line)"></i>Болеют</span>
        <span><i style="background:repeating-linear-gradient(45deg,var(--surface-2) 0 3px,var(--bg) 3px 6px);border:1px solid var(--line)"></i>Отсутствуют</span>
      </div>`;
  }
};
