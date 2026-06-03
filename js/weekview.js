/* =========================================================================
 * weekview.js — 주간 타임박스 플래너 (읽기 전용 개요)
 *  - 7일 × 시간 그리드. 배치된 타임박스만 표시. 클릭하면 그 날 '하루 보기'로.
 *  - 시간 스케일은 TimeBox(START_HOUR/SLOTS/ROW_H), 공휴일은 CalendarView 재사용.
 * ====================================================================== */
(function (global) {
  "use strict";

  const DOW = ["일", "월", "화", "수", "목", "금", "토"];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function addDays(dateStr, n) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + n);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  // 그 주의 시작(일요일) 날짜. 월요일 시작으로 바꾸려면 -d.getDay() → -((d.getDay()+6)%7)
  function weekStartOf(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return addDays(dateStr, -d.getDay());
  }

  // 한 날의 placed task에 컬럼 배치 (겹침 가로 분할) — timebox와 동일 알고리즘 경량 구현
  function packColumns(tasks) {
    const items = tasks.map((t) => ({ t, col: 0, cols: 1 }))
      .sort((a, b) => a.t.plannedStart - b.t.plannedStart || (b.t.plannedDur || 1) - (a.t.plannedDur || 1));
    const groups = [];
    let active = [], cur = null;
    for (const it of items) {
      const s = it.t.plannedStart, e = s + (it.t.plannedDur || 1);
      active = active.filter((a) => a.end > s);
      if (active.length === 0) { cur = []; groups.push(cur); }
      const used = new Set(active.map((a) => a.col));
      let col = 0; while (used.has(col)) col++;
      it.col = col; active.push({ end: e, col }); cur.push(it);
    }
    for (const g of groups) { const maxCol = g.reduce((m, it) => Math.max(m, it.col), 0); for (const it of g) it.cols = maxCol + 1; }
    return items;
  }

  const WeekView = {
    weekStartOf, addDays,

    render(container, opts) {
      const { weekStart, days, today, onPickDay } = opts;
      const T = global.TimeBox;
      const C = global.CalendarView;
      const esc = global._esc || ((s) => String(s));
      const H = T.SLOTS * T.ROW_H;
      container.innerHTML = "";

      const dates = [];
      for (let i = 0; i < 7; i++) dates.push(addDays(weekStart, i));

      // ----- 헤더 (거터 + 7일) -----
      const head = el("div", "wv-head");
      head.appendChild(el("div", "wv-corner"));
      for (const date of dates) {
        const dt = new Date(date + "T00:00:00");
        const dow = dt.getDay();
        const holiday = C && C.holidayName ? C.holidayName(date) : "";
        const h = el("div", "wv-dayhead" + (date === today ? " today" : "") + ((dow === 0 || dow === 6 || holiday) ? " red" : ""));
        h.innerHTML = `<span class="wv-dnum">${dt.getMonth() + 1}.${dt.getDate()}</span><span class="wv-dow">${DOW[dow]}</span>`;
        if (holiday) h.title = holiday;
        h.onclick = () => onPickDay(date);
        head.appendChild(h);
      }
      container.appendChild(head);

      // ----- 본문 (거터 + 7열) -----
      const body = el("div", "wv-body");
      const gutter = el("div", "wv-gutter");
      gutter.style.height = H + "px";
      for (let i = 0; i < T.SLOTS; i++) {
        if ((T.START_HOUR * 60 + i * 30) % 60 === 0) {
          const lbl = el("div", "wv-time", T.slotLabel(i));
          lbl.style.top = (i * T.ROW_H) + "px";
          gutter.appendChild(lbl);
        }
      }
      body.appendChild(gutter);

      for (let i = 0; i < 7; i++) {
        const date = dates[i];
        const day = days[i] || { tasks: [] };
        const dt = new Date(date + "T00:00:00");
        const dow = dt.getDay();
        const holiday = C && C.holidayName ? C.holidayName(date) : "";
        const col = el("div", "wv-col" + (date === today ? " today" : "") + ((dow === 0 || dow === 6 || holiday) ? " red" : ""));
        col.style.height = H + "px";
        for (let s = 0; s <= T.SLOTS; s++) {
          const line = el("div", "wv-line" + ((T.START_HOUR * 60 + s * 30) % 60 === 0 ? " hour" : ""));
          line.style.top = (s * T.ROW_H) + "px";
          col.appendChild(line);
        }
        const placed = (day.tasks || []).filter((t) => t.plannedStart != null);
        for (const { t, col: c, cols } of packColumns(placed)) {
          const start = Math.max(0, Math.min(T.SLOTS - 1, t.plannedStart));
          const dur = Math.max(1, Math.min(t.plannedDur || 1, T.SLOTS - start));
          const b = el("div", "wv-block" + (t.isBig3 ? " big3" : "") + (t.done ? " done" : ""));
          b.style.top = (start * T.ROW_H + 1) + "px";
          b.style.height = (dur * T.ROW_H - 2) + "px";
          b.style.left = `calc(${(c / cols) * 100}% + 1px)`;
          b.style.width = `calc(${(1 / cols) * 100}% - 2px)`;
          b.innerHTML = `<span class="wv-btext">${t.done ? "✓ " : ""}${t.isBig3 ? "★ " : ""}${esc(t.text)}</span>`;
          b.title = `${T.slotLabel(start)}–${T.slotLabel(Math.min(start + dur, T.SLOTS))}  ${t.text}`;
          b.onclick = () => onPickDay(date);
          col.appendChild(b);
        }
        col.addEventListener("click", (e) => { if (e.target === col || e.target.classList.contains("wv-line")) onPickDay(date); });
        body.appendChild(col);
      }
      container.appendChild(body);
    }
  };

  global.WeekView = WeekView;
})(window);
