/* =========================================================================
 * calendar.js — 월간 달력 (내용 있는 날 점 표시 + 날짜 선택)
 * ====================================================================== */
(function (global) {
  "use strict";

  const DOW = ["일", "월", "화", "수", "목", "금", "토"];

  function ymd(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const CalendarView = {
    /* render(container, {year, month(0-based), marks{dateStr:true}, today, selected, onPick}) */
    render(container, opts) {
      const { year, month, marks = {}, today, selected, onPick } = opts;
      container.innerHTML = "";

      const grid = document.createElement("div");
      grid.className = "cal-grid";

      DOW.forEach((d, i) => {
        const h = document.createElement("div");
        h.className = "cal-dow" + (i === 0 ? " sun" : i === 6 ? " sat" : "");
        h.textContent = d;
        grid.appendChild(h);
      });

      const first = new Date(year, month, 1).getDay();   // 0=일
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let i = 0; i < first; i++) {
        const pad = document.createElement("div");
        pad.className = "cal-cell pad";
        grid.appendChild(pad);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const date = ymd(year, month, d);
        const cell = document.createElement("div");
        cell.className = "cal-cell";
        if (date === today) cell.classList.add("today");
        if (date === selected) cell.classList.add("selected");
        cell.innerHTML = `<span>${d}</span>` + (marks[date] ? `<span class="cal-dot"></span>` : "");
        cell.addEventListener("click", () => onPick && onPick(date));
        grid.appendChild(cell);
      }

      container.appendChild(grid);
    },

    title(year, month) {
      return `${year}.${String(month + 1).padStart(2, "0")}`;
    }
  };

  global.CalendarView = CalendarView;
})(window);
