/* =========================================================================
 * timebox.js — 30분 타임라인 렌더링
 *  - 배치/이동/길이조절은 app.js의 드래그 인터랙션에서 처리
 * ====================================================================== */
(function (global) {
  "use strict";

  const START_HOUR = 6;     // 06:00
  const END_HOUR = 24;      // 24:00
  const ROW_H = 34;         // CSS --tl-row-h 와 동일
  const SLOTS = (END_HOUR - START_HOUR) * 2;

  function slotLabel(i) {
    const total = START_HOUR * 60 + i * 30;
    const hh = Math.floor(total / 60), mm = total % 60;
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }
  function rangeLabel(start, dur) {
    return slotLabel(start) + "–" + slotLabel(Math.min(start + dur, SLOTS));
  }
  function durLabel(dur) {
    const min = dur * 30;
    if (min < 60) return min + "분";
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h}시간 ${m}분` : `${h}시간`;
  }

  const TimeBox = {
    START_HOUR, END_HOUR, SLOTS, ROW_H, slotLabel, rangeLabel, durLabel,

    plannedMinutes(day) {
      return day.tasks
        .filter((t) => t.plannedStart != null)
        .reduce((s, t) => s + (t.plannedDur || 1) * 30, 0);
    },

    render(container, day, cbs) {
      cbs = cbs || {};
      container.innerHTML = "";
      container.style.height = SLOTS * ROW_H + "px";

      // 슬롯 행 (시간 + 빈 영역)
      for (let i = 0; i < SLOTS; i++) {
        const row = document.createElement("div");
        row.className = "tl-row";
        const isHour = (START_HOUR * 60 + i * 30) % 60 === 0;
        row.innerHTML =
          `<div class="tl-time${isHour ? " hour" : ""}">${slotLabel(i)}</div>` +
          `<div class="tl-slot" data-slot="${i}"></div>`;
        container.appendChild(row);
      }

      // 배치된 블록 — 겹치면 가로로 병렬 배치 (Google Calendar 식)
      const placed = day.tasks.filter((t) => t.plannedStart != null);
      const items = placed.map((t) => ({ t, col: 0, cols: 1 }))
        .sort((a, b) => a.t.plannedStart - b.t.plannedStart || (b.t.plannedDur || 1) - (a.t.plannedDur || 1));
      // 그리디 컬럼 할당 + 그룹 단위 컬럼 수 산출
      const groups = [];
      let active = [], cur = null;
      for (const it of items) {
        const s = it.t.plannedStart, e = s + (it.t.plannedDur || 1);
        active = active.filter((a) => a.end > s);
        if (active.length === 0) { cur = []; groups.push(cur); }
        const used = new Set(active.map((a) => a.col));
        let col = 0; while (used.has(col)) col++;
        it.col = col;
        active.push({ end: e, col });
        cur.push(it);
      }
      for (const g of groups) {
        const maxCol = g.reduce((m, it) => Math.max(m, it.col), 0);
        for (const it of g) it.cols = maxCol + 1;
      }

      for (const { t, col, cols } of items) {
        const start = Math.max(0, Math.min(SLOTS - 1, t.plannedStart));
        const dur = Math.max(1, Math.min(t.plannedDur || 1, SLOTS - start));
        const block = document.createElement("div");
        block.className = "tl-block" + (t.isBig3 ? " big3" : "") + (t.done ? " done" : "") + (dur === 1 ? " small" : "");
        block.dataset.id = t.id;
        block.style.top = start * ROW_H + 2 + "px";
        block.style.height = dur * ROW_H - 4 + "px";
        if (cols > 1) {
          const frac = 1 / cols;
          block.style.left = `calc(var(--tl-gutter) + 7px + (100% - var(--tl-gutter) - 15px) * ${col * frac})`;
          block.style.width = `calc((100% - var(--tl-gutter) - 15px) * ${frac} - 4px)`;
          block.style.right = "auto";
        }
        block.innerHTML =
          `<div class="b-title">${t.done ? "✓ " : ""}${t.isBig3 ? "★ " : ""}${esc(t.text)}</div>` +
          `<div class="b-meta"><span>${rangeLabel(start, dur)}</span><span>${durLabel(dur)}</span>` +
          (t.category ? `<span>#${esc(t.category)}</span>` : "") + `</div>` +
          `<div class="b-actions">` +
            `<button data-act="done" title="완료 토글">✓</button>` +
            `<button data-act="unplace" title="타임라인에서 빼기">✕</button>` +
          `</div>` +
          `<div class="b-resize" title="드래그하여 길이 조절"></div>`;
        block.querySelectorAll(".b-actions button").forEach((b) => {
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            cbs.onBlockAction && cbs.onBlockAction(t.id, b.dataset.act);
          });
        });
        container.appendChild(block);
      }
    }
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  global.TimeBox = TimeBox;
  global._esc = esc;
})(window);
