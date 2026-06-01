/* =========================================================================
 * calendar.js — 월간 달력 (내용 있는 날 점 표시 + 한국 공휴일·주말 빨간색)
 * ====================================================================== */
(function (global) {
  "use strict";

  const DOW = ["일", "월", "화", "수", "목", "금", "토"];

  // 한국 공휴일 (2025-2027). 음력 기반은 매년 추가 필요.
  // 대체공휴일 적용: 3.1절·광복절·개천절·한글날·어린이날·부처님오신날·크리스마스·설날·추석 (현충일·신정 제외)
  const KR_HOLIDAYS = {
    // 2025
    "2025-01-01": "신정",
    "2025-01-28": "설날 연휴",
    "2025-01-29": "설날",
    "2025-01-30": "설날 연휴",
    "2025-03-01": "삼일절",
    "2025-03-03": "삼일절 대체",
    "2025-05-05": "어린이날·부처님오신날",
    "2025-05-06": "어린이날 대체",
    "2025-06-06": "현충일",
    "2025-08-15": "광복절",
    "2025-10-03": "개천절",
    "2025-10-05": "추석 연휴",
    "2025-10-06": "추석",
    "2025-10-07": "추석 연휴",
    "2025-10-08": "추석 대체",
    "2025-10-09": "한글날",
    "2025-12-25": "크리스마스",
    // 2026
    "2026-01-01": "신정",
    "2026-02-16": "설날 연휴",
    "2026-02-17": "설날",
    "2026-02-18": "설날 연휴",
    "2026-03-01": "삼일절",
    "2026-03-02": "삼일절 대체",
    "2026-05-05": "어린이날",
    "2026-05-24": "부처님오신날",
    "2026-05-25": "부처님오신날 대체",
    "2026-06-06": "현충일",
    "2026-08-15": "광복절",
    "2026-08-17": "광복절 대체",
    "2026-09-24": "추석 연휴",
    "2026-09-25": "추석",
    "2026-09-26": "추석 연휴",
    "2026-09-28": "추석 대체",
    "2026-10-03": "개천절",
    "2026-10-05": "개천절 대체",
    "2026-10-09": "한글날",
    "2026-12-25": "크리스마스",
    // 2027
    "2027-01-01": "신정",
    "2027-02-06": "설날 연휴",
    "2027-02-07": "설날",
    "2027-02-08": "설날 연휴",
    "2027-02-09": "설날 대체",
    "2027-03-01": "삼일절",
    "2027-05-05": "어린이날",
    "2027-05-13": "부처님오신날",
    "2027-06-06": "현충일",
    "2027-08-15": "광복절",
    "2027-08-16": "광복절 대체",
    "2027-09-14": "추석 연휴",
    "2027-09-15": "추석",
    "2027-09-16": "추석 연휴",
    "2027-10-03": "개천절",
    "2027-10-04": "개천절 대체",
    "2027-10-09": "한글날",
    "2027-10-11": "한글날 대체",
    "2027-12-25": "크리스마스",
    "2027-12-27": "크리스마스 대체"
  };

  function ymd(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const CalendarView = {
    KR_HOLIDAYS,
    holidayName(date) { return KR_HOLIDAYS[date] || ""; },
    isRedDay(date, dow) { return dow === 0 || dow === 6 || !!KR_HOLIDAYS[date]; },

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

      const first = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let i = 0; i < first; i++) {
        const pad = document.createElement("div");
        pad.className = "cal-cell pad";
        grid.appendChild(pad);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const date = ymd(year, month, d);
        const dow = new Date(year, month, d).getDay();
        const holiday = KR_HOLIDAYS[date];
        const classes = ["cal-cell"];
        if (dow === 0) classes.push("sun");
        if (dow === 6) classes.push("sat");
        if (holiday) classes.push("holiday");
        if (date === today) classes.push("today");
        if (date === selected) classes.push("selected");
        const cell = document.createElement("div");
        cell.className = classes.join(" ");
        if (holiday) cell.title = holiday;
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
