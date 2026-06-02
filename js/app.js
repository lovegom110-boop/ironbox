/* =========================================================================
 * app.js — 단일 페이지 컨트롤러 (기상 → Big3 → 할일+타임라인 → 회고)
 * ====================================================================== */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = window._esc;

  const STATUS_LABEL = { do: "할 일", defer: "연기", delegate: "위임", delete: "삭제" };
  const STATUS_ORDER = ["do", "defer", "delegate", "delete"];
  const TAG_PRESETS = ["글쓰기", "이메일", "회의", "연락", "기획", "검토", "잡무", "공부"];

  const state = { date: Store.todayStr(), day: null, filter: "all", selectedId: null, calY: 0, calM: 0 };
  let saveTimer = null;

  /* ---------------- 초기화 ---------------- */
  async function init() {
    await Store.init();
    registerSW();
    bindGlobalEvents();
    setupInteractions();
    await loadDay(state.date);
  }
  function registerSW() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  async function loadDay(date) {
    state.date = date;
    let day = await Store.getDay(date);
    // 오늘 + 빈 날짜인 경우에만 직전 기록일의 '미완료' 할 일 이월
    let carriedCount = 0;
    if (date === Store.todayStr() && day.tasks.length === 0) {
      const all = await Store.getAllDays();
      const prev = all.filter((d) => d.date < date && d.tasks.length).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      if (prev) {
        const carry = prev.tasks
          .filter((t) => !t.done)
          .map((t) => { const n = Store.newTask(t.text); n.category = t.category; return n; });
        if (carry.length) { day.tasks = carry; await Store.saveDay(day); carriedCount = carry.length; }
      }
    }
    state.day = day;
    state.selectedId = null;
    render();
    updateSaveStatus();
    if (carriedCount) toast(`어제 미완료 ${carriedCount}개를 오늘로 이월했어요 (어제 체크한 일은 가져오지 않습니다)`);
  }
  function saveNow() { return Store.saveDay(state.day).then(updateSaveStatus); }
  function saveDebounced() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }

  /* ---------------- 전체 렌더 ---------------- */
  function render() {
    renderHeader();
    renderTextField($("#wake-field"), () => state.day.wakeNote, (v) => { state.day.wakeNote = v; }, { placeholder: "오늘의 나에게 한마디…", multiline: false });
    renderBig3();
    document.querySelectorAll("#status-filters .chip").forEach((c) => c.classList.toggle("active", c.dataset.f === state.filter));
    renderTasks();
    renderTimeline();
    renderSelectedHint();
    const min = TimeBox.plannedMinutes(state.day);
    const cnt = state.day.tasks.filter((t) => t.plannedStart != null).length;
    $("#plan-total").textContent = cnt ? `${TimeBox.durLabel(min / 30)} · ${cnt}개` : "미배치";
    renderReview();
    renderTextField($("#feedback-field"), () => state.day.feedback, (v) => { state.day.feedback = v; }, { placeholder: "오늘 회고… 계획대로 됐나요? 내일은 무엇을 다르게 할까요?", multiline: true });
    renderTextField($("#tomorrow-field"), () => state.day.tomorrowPlan, (v) => { state.day.tomorrowPlan = v; }, { placeholder: "내일 업무 계획을 적어보세요", multiline: true });
  }
  /* ---------------- Google 캘린더 (단일 버튼 흐름) ---------------- */
  async function sendToGoogleCalendar() {
    try {
      if (!state.day.tasks.some((t) => t.plannedStart != null)) {
        toast("타임라인에 배치된 일정이 없어요"); return;
      }
      let clientId = GCal.getClientId();
      if (!clientId) {
        const id = window.prompt(
          "Google OAuth Client ID 입력 (최초 1회)\n\n" +
          "Google Cloud Console → APIs & Services → Credentials →\n" +
          "Create Credentials → OAuth Client ID → Web application\n" +
          "승인된 JavaScript 출처: 이 사이트 URL + http://localhost:8123"
        );
        if (!id || !id.trim()) return;
        clientId = id.trim();
      }
      toast("Google 로그인 중…");
      await GCal.connect(clientId);
      let calId = GCal.getSelectedCalId();
      if (!calId) {
        const cals = await GCal.listCalendars();
        if (!cals.length) { toast("쓰기 가능한 캘린더가 없습니다"); return; }
        calId = await pickCalendar(cals);
        if (!calId) return;
        GCal.setSelectedCalId(calId);
      }
      toast("일정 전송 중…");
      const r = await GCal.exportDay(state.day, calId, TimeBox.START_HOUR, 30);
      const gs = $("#gcal-status");
      if (gs) gs.textContent = `최근 전송: ${r.created}/${r.total} 추가 (실패 ${r.failed})`;
      toast(`✓ Google 캘린더에 ${r.created}개 일정 추가${r.failed ? ` (실패 ${r.failed})` : ""}`);
      if (r.errors && r.errors.length) console.warn("일부 실패:", r.errors);
    } catch (e) {
      toast("실패: " + (e.message || e));
      console.error(e);
    }
  }

  function pickCalendar(cals) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal";
      overlay.innerHTML =
        `<div class="modal-card">` +
          `<div class="modal-head"><span class="modal-title">캘린더 선택</span><button class="close-btn" type="button">✕</button></div>` +
          `<div class="cal-pick-list"></div>` +
        `</div>`;
      document.body.appendChild(overlay);
      const list = overlay.querySelector(".cal-pick-list");
      cals.forEach((c) => {
        const item = document.createElement("button");
        item.type = "button"; item.className = "cal-pick-item";
        item.textContent = c.summary + (c.primary ? "  (기본)" : "");
        item.onclick = () => { document.body.removeChild(overlay); resolve(c.id); };
        list.appendChild(item);
      });
      overlay.querySelector(".close-btn").onclick = () => { document.body.removeChild(overlay); resolve(null); };
      overlay.addEventListener("click", (e) => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); } });
    });
  }

  function exportDayAsText() {
    const placed = state.day.tasks.filter((t) => t.plannedStart != null).sort((a, b) => a.plannedStart - b.plannedStart);
    const lines = [];
    lines.push("[업무일지]");
    if (placed.length === 0) lines.push("(타임라인에 배치된 일정 없음)");
    for (const t of placed) lines.push(`${TimeBox.slotLabel(t.plannedStart)} ${t.text}`);
    lines.push("");
    lines.push("[느낀점]");
    if (state.day.feedback) lines.push(state.day.feedback);
    lines.push("");
    lines.push("[익일 업무계획]");
    if (state.day.tomorrowPlan) lines.push(state.day.tomorrowPlan);
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `업무일지_${state.date}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function renderTextField(elx, getValue, setValue, opts) {
    const value = (getValue() || "");
    const editing = elx.dataset.editing === "1";
    // mid-edit guard: input이 살아있으면 재구축 X
    if (editing && elx.querySelector("input, textarea")) return;
    elx.innerHTML = "";
    if (editing || !value) {
      const multi = !!opts.multiline;
      const inp = document.createElement(multi ? "textarea" : "input");
      inp.className = "field-input" + (multi ? " multiline" : "");
      if (!multi) inp.type = "text";
      inp.value = value; inp.placeholder = opts.placeholder || ""; inp.autocomplete = "off";
      const btn = document.createElement("button");
      btn.className = "row-btn primary"; btn.textContent = "저장"; btn.disabled = !value.trim();
      const commit = () => {
        const v = inp.value.trim(); if (!v) return;
        setValue(v); delete elx.dataset.editing; saveNow(); render();
      };
      inp.addEventListener("focus", () => { elx.dataset.editing = "1"; });
      inp.addEventListener("input", () => { btn.disabled = !inp.value.trim(); });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (!multi || !e.shiftKey)) { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { e.preventDefault(); delete elx.dataset.editing; render(); }
      });
      btn.addEventListener("click", commit);
      const btnRow = document.createElement("div"); btnRow.className = "field-buttons"; btnRow.appendChild(btn);
      elx.appendChild(inp); elx.appendChild(btnRow);
      if (editing) setTimeout(() => inp.focus(), 0);
    } else {
      const tx = document.createElement("div");
      tx.className = "field-text"; tx.textContent = value;
      tx.title = "더블클릭하여 수정";
      tx.ondblclick = () => { elx.dataset.editing = "1"; render(); };
      const edit = document.createElement("button");
      edit.className = "row-btn"; edit.textContent = "수정";
      edit.onclick = () => { elx.dataset.editing = "1"; render(); };
      const del = document.createElement("button");
      del.className = "row-btn danger"; del.textContent = "삭제";
      del.onclick = () => { setValue(""); saveNow(); render(); };
      const btnRow = document.createElement("div"); btnRow.className = "field-buttons";
      btnRow.appendChild(edit); btnRow.appendChild(del);
      elx.appendChild(tx); elx.appendChild(btnRow);
    }
  }
  function renderField(elx, value, placeholder) {
    if (elx.dataset.editing) return;
    if (value) { elx.textContent = value; elx.classList.remove("empty"); }
    else { elx.textContent = placeholder; elx.classList.add("empty"); }
  }
  function startFieldEdit(elx, current, onCommit, multiline) {
    if (elx.dataset.editing) return;
    elx.dataset.editing = "1";
    const inp = document.createElement(multiline ? "textarea" : "input");
    inp.className = "field-edit" + (multiline ? " multiline" : "");
    inp.value = current || "";
    elx.classList.remove("empty"); elx.textContent = "";
    elx.appendChild(inp);
    inp.focus(); if (!multiline) inp.select();
    let done = false;
    const commit = (save) => {
      if (done) return; done = true;
      delete elx.dataset.editing;
      if (save) { onCommit(inp.value.trim()); saveNow(); }
      render();
    };
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (!multiline || !e.shiftKey)) { e.preventDefault(); commit(true); }
      else if (e.key === "Escape") { e.preventDefault(); commit(false); }
    });
    inp.addEventListener("blur", () => commit(true));
  }

  function renderHeader() {
    const d = new Date(state.date + "T00:00:00");
    const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    $("#date-label").textContent = `${state.date.replace(/-/g, ".")} (${dow})`;
  }

  /* ----- Big 3 ----- */
  function renderBig3() {
    const wrap = $("#big3-list");
    const big3 = state.day.tasks.filter((t) => t.isBig3);
    const done = big3.filter((t) => t.done).length;
    $("#big3-count").textContent = big3.length ? `완료 ${done} / ${big3.length}` : "핵심 3가지를 적어보세요 (할 일에도 추가됩니다)";
    wrap.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const t = big3[i];
      const row = el("div", "big3-item" + (t ? "" : " empty") + (t && t.done ? " done" : ""));
      row.appendChild(el("span", "big3-num", String(i + 1)));
      if (t) {
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.className = "task-check"; cb.checked = !!t.done; cb.title = "완료 토글";
        cb.onchange = () => toggleDone(t.id);
        row.appendChild(cb);
        const tx = el("span", "big3-text", t.text);
        tx.title = "더블클릭하여 수정";
        tx.ondblclick = () => startEditInline(t.id, tx, "big3-input");
        row.appendChild(tx);
        if (t.plannedStart != null) row.appendChild(el("span", "big3-meta", TimeBox.slotLabel(t.plannedStart)));
        const edit = el("button", "row-btn", "수정");
        edit.title = "수정 (더블클릭으로도 가능)";
        edit.onclick = () => startEditInline(t.id, tx, "big3-input");
        const del = el("button", "row-btn danger", "삭제");
        del.title = "삭제 (할 일에서도 제거)";
        del.onclick = () => removeTask(t.id);
        row.append(edit, del);
      } else {
        const input = el("input", "big3-input");
        input.placeholder = "오늘의 핵심 할 일 입력";
        const add = el("button", "row-btn primary", "입력");
        add.disabled = true;
        input.oninput = () => { add.disabled = !input.value.trim(); };
        input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addBig3(input.value); } };
        add.onclick = () => addBig3(input.value);
        row.append(input, add);
      }
      wrap.appendChild(row);
    }
  }
  function addBig3(text) {
    if (!text.trim()) return;
    const t = Store.newTask(text); t.isBig3 = true;
    state.day.tasks.push(t);
    saveNow(); render();
    const inp = document.querySelector("#big3-list .big3-input"); if (inp) inp.focus();
  }

  /* ----- 할 일 ----- */
  function renderTasks() {
    const ul = $("#task-list");
    ul.innerHTML = "";
    let list = state.day.tasks.slice();
    if (state.filter === "active") list = list.filter((t) => !t.done);
    else if (state.filter === "done") list = list.filter((t) => t.done);
    $("#inbox-empty").hidden = state.day.tasks.length > 0;
    for (const t of list) ul.appendChild(buildTaskEl(t));
  }

  function buildTaskEl(t) {
    const li = document.createElement("li");
    li.className = "task" + (t.done ? " done" : "");
    li.dataset.id = t.id;
    if (t.id === state.selectedId) li.classList.add("selected");
    if (t.plannedStart != null) li.classList.add("placed");

    const check = document.createElement("input");
    check.type = "checkbox"; check.className = "task-check"; check.checked = !!t.done;
    check.title = "완료 토글";
    check.onchange = () => toggleDone(t.id);

    const main = el("div", "task-main");
    const text = el("div", "task-text", t.text);
    text.title = "드래그하여 타임라인에 배치 · 더블클릭하여 수정";
    text.ondblclick = () => startEditInline(t.id, text, "task-edit");
    main.appendChild(text);
    const meta = el("div", "task-meta");
    const tag = el("button", "tag" + (t.category ? " has" : ""), t.category ? "#" + t.category : "+ 태그");
    tag.onclick = () => setCategory(t.id);
    meta.appendChild(tag);
    if (t.plannedStart != null) meta.appendChild(el("span", "placed-at", TimeBox.slotLabel(t.plannedStart)));
    main.appendChild(meta);

    const star = el("button", "star" + (t.isBig3 ? " on" : ""), t.isBig3 ? "★" : "☆");
    star.title = "Big 3 토글";
    star.onclick = () => toggleBig3(t.id);

    const edit = el("button", "row-btn", "수정");
    edit.title = "수정 (더블클릭으로도 가능)";
    edit.onclick = () => startEditInline(t.id, text, "task-edit");
    const del = el("button", "row-btn danger", "삭제");
    del.title = "삭제";
    del.onclick = () => removeTask(t.id);

    li.append(check, main, star, edit, del);
    return li;
  }

  function renderTimeline() {
    const tl = $("#timeline");
    tl.classList.toggle("tl-placing", !!state.selectedId);
    TimeBox.render(tl, state.day, { onBlockAction: blockAction });
  }
  function renderSelectedHint() {
    const hint = $("#selected-hint");
    if (!state.selectedId) { hint.hidden = true; return; }
    const t = findTask(state.selectedId);
    if (!t) { hint.hidden = true; return; }
    hint.hidden = false;
    hint.innerHTML = `선택됨: <b>${esc(t.text)}</b> — 타임라인 칸을 누르거나 드래그하세요 <span class="cancel" id="cancel-select">취소</span>`;
    $("#cancel-select").onclick = () => { state.selectedId = null; render(); };
  }

  /* ----- 회고 ----- */
  function reviewData() {
    const placed = state.day.tasks.filter((t) => t.plannedStart != null).sort((a, b) => a.plannedStart - b.plannedStart);
    const planMin = placed.reduce((s, t) => s + (t.plannedDur || 1) * 30, 0);
    const actMin = placed.reduce((s, t) => s + (t.actualMin || 0), 0);
    return { placed, planMin, actMin, diff: actMin - planMin };
  }
  function renderReviewSummary() {
    const { planMin, actMin, diff } = reviewData();
    $("#review-summary").innerHTML =
      stat(TimeBox.durLabel(planMin / 30), "계획 시간") +
      stat(actMin ? TimeBox.durLabel(actMin / 30) : "—", "실제 시간") +
      stat(diff === 0 ? "±0" : (diff > 0 ? "+" : "−") + TimeBox.durLabel(Math.abs(diff) / 30), "차이 (실제−계획)", diff !== 0);
  }
  function renderReview() {
    renderReviewSummary();
    const { placed } = reviewData();
    const rb = $("#review-blocks");
    rb.innerHTML = "";
    if (!placed.length) { rb.innerHTML = `<p class="empty-hint small">타임라인에 할 일을 배치하면 여기서 실제 시간을 기록할 수 있어요.</p>`; return; }
    for (const t of placed) {
      const dur = t.plannedDur || 1;
      const row = el("div", "rb" + (t.actualMin && t.actualMin !== dur * 30 ? " diff" : ""));
      row.innerHTML =
        `<span class="rb-time">${TimeBox.rangeLabel(t.plannedStart, dur)}</span>` +
        `<span class="rb-title">${t.isBig3 ? '<span class="b3">★</span> ' : ""}${esc(t.text)}</span>` +
        `<span class="rb-plan">계획 ${dur * 30}분</span>`;
      const input = el("input", "actual"); input.type = "number"; input.min = "0"; input.step = "10";
      input.placeholder = String(dur * 30);
      if (t.actualMin != null) input.value = t.actualMin;
      input.oninput = () => {
        const v = input.value === "" ? null : Math.max(0, parseInt(input.value, 10) || 0);
        findTask(t.id).actualMin = v;
        row.classList.toggle("diff", v != null && v !== dur * 30);
        saveDebounced(); renderReviewSummary();
      };
      row.append(input, el("span", "unit", "분"));
      rb.appendChild(row);
    }
  }
  function stat(num, lbl, warn) {
    return `<div class="stat${warn ? " warn" : ""}"><div class="num">${esc(num)}</div><div class="lbl">${esc(lbl)}</div></div>`;
  }

  /* ---------------- 동작 ---------------- */
  function findTask(id) { return state.day.tasks.find((t) => t.id === id); }
  function addTask(text) { if (!text.trim()) return; state.day.tasks.push(Store.newTask(text)); saveNow(); render(); }
  function removeTask(id) { state.day.tasks = state.day.tasks.filter((t) => t.id !== id); if (state.selectedId === id) state.selectedId = null; saveNow(); render(); }
  function setStatus(id, status) {
    const t = findTask(id); if (!t) return;
    t.status = status;
    if (status !== "do") { t.plannedStart = null; if (state.selectedId === id) state.selectedId = null; }
    saveNow(); render();
  }
  function toggleBig3(id) {
    const t = findTask(id); if (!t) return;
    if (!t.isBig3 && state.day.tasks.filter((x) => x.isBig3).length >= 3) { toast("Big 3는 최대 3개예요"); return; }
    t.isBig3 = !t.isBig3; saveNow(); render();
  }
  function toggleDone(id) { const t = findTask(id); if (!t) return; t.done = !t.done; saveNow(); render(); }
  function setCategory(id) {
    const t = findTask(id); if (!t) return;
    const v = window.prompt("태그(배칭) — 같은 태그끼리 묶여요.\n예: " + TAG_PRESETS.join(", "), t.category || "");
    if (v === null) return;
    t.category = v.trim(); saveNow(); render();
  }
  function selectTask(id) {
    const t = findTask(id); if (!t) return;
    state.selectedId = (state.selectedId === id) ? null : id; render();
  }
  function startEditInline(id, textEl, cls) {
    const t = findTask(id); if (!t || !textEl) return;
    const input = document.createElement("input");
    input.className = cls || "task-edit";
    input.value = t.text;
    textEl.replaceWith(input);
    input.focus(); input.select();
    let done = false;
    const commit = (save) => {
      if (done) return; done = true;
      if (save) { const v = input.value.trim(); if (v && v !== t.text) { t.text = v; saveNow(); } }
      render();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(true); }
      else if (e.key === "Escape") { e.preventDefault(); commit(false); }
    });
    input.addEventListener("blur", () => commit(true));
  }
  function blockAction(id, act) {
    const t = findTask(id); if (!t) return;
    if (act === "done") t.done = !t.done;
    else if (act === "unplace") t.plannedStart = null;
    saveNow(); render();
  }

  /* ---------------- 달력 / 검색 / 메뉴 ---------------- */
  function openCalendar() {
    const d = new Date(state.date + "T00:00:00");
    state.calY = d.getFullYear(); state.calM = d.getMonth();
    $("#calendar-modal").hidden = false; renderCalendar();
  }
  async function renderCalendar() {
    $("#cal-title").textContent = CalendarView.title(state.calY, state.calM);
    const marks = await Store.getMonthMarks(state.calY, state.calM);
    CalendarView.render($("#calendar"), {
      year: state.calY, month: state.calM, marks, today: Store.todayStr(), selected: state.date,
      onPick: (date) => { $("#calendar-modal").hidden = true; loadDay(date); }
    });
  }
  function calShift(d) { state.calM += d; if (state.calM < 0) { state.calM = 11; state.calY--; } if (state.calM > 11) { state.calM = 0; state.calY++; } renderCalendar(); }

  function openSearch() {
    $("#search-modal").hidden = false; $("#search-input").value = "";
    $("#search-results").innerHTML = `<p class="search-empty">검색어를 입력하세요.</p>`;
    setTimeout(() => $("#search-input").focus(), 30);
  }
  let searchTimer = null;
  function doSearch() {
    const q = $("#search-input").value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const box = $("#search-results");
      if (!q.trim()) { box.innerHTML = `<p class="search-empty">검색어를 입력하세요.</p>`; return; }
      const hits = await Store.search(q);
      if (!hits.length) { box.innerHTML = `<p class="search-empty">“${esc(q)}” 결과가 없습니다.</p>`; return; }
      box.innerHTML = "";
      for (const h of hits) {
        const item = el("div", "sr-item");
        let html = `<div class="sr-date">${h.date.replace(/-/g, ".")}</div>`;
        h.tasks.forEach((t) => html += `<div class="sr-line"><span class="k">할일</span>${esc(t.text)}</div>`);
        if (h.wake) html += `<div class="sr-line"><span class="k">기상</span>${esc(h.wake)}</div>`;
        if (h.feedback) html += `<div class="sr-line"><span class="k">회고</span>${esc(h.feedback)}</div>`;
        item.innerHTML = html;
        item.onclick = () => { $("#search-modal").hidden = true; loadDay(h.date); };
        box.appendChild(item);
      }
    }, 200);
  }

  function toggleMenu(force) { const m = $("#menu"); m.hidden = (force === undefined) ? !m.hidden : !force; }
  function updateSaveStatus() {
    const s = $("#save-status");
    if (Store.fileConnected()) Store.fileName().then((n) => { s.textContent = "파일 자동저장: " + n; });
    else s.textContent = "이 기기(브라우저)에 저장됨";
  }

  /* ---------------- 이벤트 ---------------- */
  function bindGlobalEvents() {
    $("#prev-day").onclick = () => loadDay(shiftDate(state.date, -1));
    $("#next-day").onclick = () => loadDay(shiftDate(state.date, +1));
    $("#today-btn").onclick = () => loadDay(Store.todayStr());
    $("#date-label").onclick = openCalendar;
    /* wake/feedback는 renderTextField가 내부에서 처리 */
    const bdInput = $("#braindump-input"), bdBtn = $("#add-btn");
    bdBtn.disabled = true;
    bdInput.addEventListener("input", () => { bdBtn.disabled = !bdInput.value.trim(); });
    $("#braindump-form").addEventListener("submit", (e) => { e.preventDefault(); if (!bdInput.value.trim()) return; addTask(bdInput.value); bdInput.value = ""; bdBtn.disabled = true; bdInput.focus(); });
    document.querySelectorAll("#status-filters .chip").forEach((c) => c.addEventListener("click", () => { state.filter = c.dataset.f; render(); }));

    $("#cal-prev").onclick = () => calShift(-1);
    $("#cal-next").onclick = () => calShift(+1);
    $("#cal-close").onclick = () => ($("#calendar-modal").hidden = true);
    $("#open-calendar").onclick = openCalendar;
    $("#calendar-modal").addEventListener("click", (e) => { if (e.target.id === "calendar-modal") e.currentTarget.hidden = true; });

    $("#open-search").onclick = openSearch;
    $("#search-close").onclick = () => ($("#search-modal").hidden = true);
    $("#search-input").addEventListener("input", doSearch);
    $("#search-modal").addEventListener("click", (e) => { if (e.target.id === "search-modal") e.currentTarget.hidden = true; });

    $("#open-menu").onclick = (e) => { e.stopPropagation(); toggleMenu(); };
    document.addEventListener("click", (e) => { if (!e.target.closest(".menu-wrap")) toggleMenu(false); });
    $("#connect-file").onclick = async () => { try { const n = await Store.connectNewFile(); toast("자동저장 연결: " + n); updateSaveStatus(); toggleMenu(false); } catch (err) { if (err && err.name !== "AbortError") toast(err.message || "연결 실패"); } };
    $("#open-file").onclick = async () => { try { const r = await Store.openExistingFile(); toast(`불러옴: ${r.name} (${r.count}일)`); toggleMenu(false); await loadDay(state.date); } catch (err) { if (err && err.name !== "AbortError") toast(err.message || "열기 실패"); } };
    $("#export-json").onclick = async () => { await Store.downloadExport(); toast("백업 파일을 내려받았어요"); toggleMenu(false); };
    $("#import-json").onclick = () => { $("#import-file").click(); toggleMenu(false); };
    $("#import-file").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const n = await Store.importFromFileInput(f, false); toast(`${n}일치 불러옴`); await loadDay(state.date); }
      catch (err) { toast("불러오기 실패: 올바른 백업 파일인지 확인하세요"); }
      e.target.value = "";
    });
    /* 업무일지 텍스트 내보내기 */
    $("#export-text").onclick = () => { exportDayAsText(); toast("업무일지 텍스트 파일을 내려받았어요"); toggleMenu(false); };
    /* Google 캘린더 — 단일 버튼 흐름 */
    $("#gcal-send").onclick = sendToGoogleCalendar;
    $("#gcal-reset").onclick = () => {
      if (!confirm("Google 캘린더 Client ID와 선택한 캘린더 설정을 모두 지울까요?")) return;
      localStorage.removeItem("gcal_client_id");
      localStorage.removeItem("gcal_selected_cal");
      if (typeof GCal !== "undefined" && GCal.disconnect) GCal.disconnect();
      const gs = $("#gcal-status"); if (gs) gs.textContent = "초기화됨 — 다음 보내기 시 다시 설정";
      toast("초기화 완료");
    };

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input,textarea,select")) return;
      if (!$("#calendar-modal").hidden || !$("#search-modal").hidden) return;
      if (e.key === "ArrowLeft") loadDay(shiftDate(state.date, -1));
      if (e.key === "ArrowRight") loadDay(shiftDate(state.date, +1));
    });
  }

  /* ---------------- 타임라인 드래그 ---------------- */
  let drag = null, ghostEl = null, createEl = null;
  const tlEl = () => $("#timeline");
  function ptSlot(y) { const r = tlEl().getBoundingClientRect(); return Math.max(0, Math.min(TimeBox.SLOTS - 1, Math.floor((y - r.top) / TimeBox.ROW_H))); }
  function overTL(x, y) { const r = tlEl().getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
  function blockEl(id) { return tlEl().querySelector('.tl-block[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); }
  function highlightSlot(i) { tlEl().querySelectorAll(".tl-slot.drop").forEach((s) => s.classList.remove("drop")); if (i >= 0) { const s = tlEl().querySelector('.tl-slot[data-slot="' + i + '"]'); if (s) s.classList.add("drop"); } }
  function showCreate(a, b) { clearCreate(); createEl = document.createElement("div"); createEl.className = "tl-create"; createEl.style.top = a * TimeBox.ROW_H + 1 + "px"; createEl.style.height = (b - a + 1) * TimeBox.ROW_H - 2 + "px"; tlEl().appendChild(createEl); }
  function clearCreate() { if (createEl) { createEl.remove(); createEl = null; } }

  function setupInteractions() {
    tlEl().addEventListener("pointerdown", (e) => {
      if (e.button) return;
      const handle = e.target.closest(".b-resize");
      const block = e.target.closest(".tl-block");
      const slot = e.target.closest(".tl-slot");
      if (handle && block) { const t = findTask(block.dataset.id); if (!t) return; e.preventDefault(); drag = { type: "resize", id: t.id, sy: e.clientY, od: t.plannedDur || 1 }; block.classList.add("dragging"); }
      else if (block && !e.target.closest(".b-actions")) { const t = findTask(block.dataset.id); if (!t) return; e.preventDefault(); drag = { type: "move", id: t.id, sy: e.clientY, os: t.plannedStart }; block.classList.add("dragging"); }
      else if (slot && state.selectedId) { e.preventDefault(); const s = parseInt(slot.dataset.slot, 10); drag = { type: "create", id: state.selectedId, start: s, cur: s, moved: false }; showCreate(s, s); }
    });
    $("#task-list").addEventListener("pointerdown", (e) => {
      if (e.button) return;
      if (e.target.closest("input, select, textarea")) return;
      const main = e.target.closest(".task-main"); if (!main) return;
      const li = e.target.closest(".task"); if (!li) return;
      const t = findTask(li.dataset.id); if (!t) return;
      drag = { type: "inbox", id: t.id, sx: e.clientX, sy: e.clientY, moved: false, text: t.text };
    });
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", onDragUp);
  }
  function onDragMove(e) {
    if (!drag) return;
    if (drag.type === "inbox") {
      if (!drag.moved) { if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return; drag.moved = true; ghostEl = document.createElement("div"); ghostEl.className = "tl-ghost"; ghostEl.textContent = drag.text; document.body.appendChild(ghostEl); }
      ghostEl.style.left = e.clientX + 12 + "px"; ghostEl.style.top = e.clientY + 10 + "px";
      highlightSlot(overTL(e.clientX, e.clientY) ? ptSlot(e.clientY) : -1);
    } else if (drag.type === "create") {
      const s = ptSlot(e.clientY); if (s !== drag.cur || !drag.moved) { drag.cur = s; drag.moved = true; showCreate(Math.min(drag.start, s), Math.max(drag.start, s)); }
    } else if (drag.type === "move") {
      const b = blockEl(drag.id); if (!b) return; const delta = Math.round((e.clientY - drag.sy) / TimeBox.ROW_H);
      drag.ns = Math.max(0, Math.min(TimeBox.SLOTS - 1, drag.os + delta)); b.style.top = drag.ns * TimeBox.ROW_H + 2 + "px";
    } else if (drag.type === "resize") {
      const b = blockEl(drag.id); if (!b) return; const t = findTask(drag.id); const delta = Math.round((e.clientY - drag.sy) / TimeBox.ROW_H);
      drag.nd = Math.max(1, Math.min(drag.od + delta, TimeBox.SLOTS - t.plannedStart)); b.style.height = drag.nd * TimeBox.ROW_H - 4 + "px";
    }
  }
  function onDragUp(e) {
    if (!drag) return;
    const d = drag; drag = null;
    clearCreate(); highlightSlot(-1);
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    tlEl().querySelectorAll(".tl-block.dragging").forEach((b) => b.classList.remove("dragging"));
    const t = findTask(d.id); if (!t) return;
    if (d.type === "inbox") {
      if (d.moved && overTL(e.clientX, e.clientY)) { t.plannedStart = ptSlot(e.clientY); if (!t.plannedDur) t.plannedDur = 1; saveNow(); render(); }
      else if (!d.moved) { selectTask(d.id); }
    } else if (d.type === "create") {
      const a = Math.min(d.start, d.cur), b = Math.max(d.start, d.cur);
      t.plannedStart = a; t.plannedDur = b - a + 1; state.selectedId = null; saveNow(); render();
    } else if (d.type === "move") { if (d.ns != null) { t.plannedStart = d.ns; saveNow(); render(); } }
    else if (d.type === "resize") { if (d.nd != null) { t.plannedDur = d.nd; saveNow(); render(); } }
  }

  /* ---------------- 헬퍼 ---------------- */
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function shiftDate(date, delta) { const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() + delta); return Store.todayStr(d); }
  let toastTimer = null;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2200); }

  // 로그인 게이트 통과 후 Auth가 호출한다 (auth.js 참고)
  window.App = { boot: init };
})();
