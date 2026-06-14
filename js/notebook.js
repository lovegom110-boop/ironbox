/* =========================================================================
 * notebook.js — 노트장 (날짜와 무관한 학습 노트)
 *  - 원노트식 책갈피 탭(분류) + 2단(노트목록 | WYSIWYG 편집)
 *  - 에디터: Toast UI Editor(WYSIWYG, 전역 toastui.Editor) — 저장은 마크다운
 *  - 데이터: Store.getNotes/saveNote/deleteNote/getFolders/saveFolders (days와 별개)
 * ====================================================================== */
(function (global) {
  "use strict";

  const ALL = "__all__", FAV = "__fav__", UNFILED = "__unfiled__";

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function timeAgo(ts) {
    if (!ts) return "";
    const diff = Date.now() - ts, day = 86400000;
    const d = Math.floor(diff / day);
    if (d <= 0) {
      const h = Math.floor(diff / 3600000);
      if (h <= 0) { const m = Math.floor(diff / 60000); return m <= 0 ? "방금" : m + "분 전"; }
      return h + "시간 전";
    }
    if (d === 1) return "어제";
    if (d < 7) return d + "일 전";
    if (d < 30) return Math.floor(d / 7) + "주 전";
    if (d < 365) return Math.floor(d / 30) + "개월 전";
    return Math.floor(d / 365) + "년 전";
  }
  function formatDateTime(ts) {
    if (!ts) return "-";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function parseTags(raw) {
    return Array.from(new Set(String(raw || "")
      .split(/[\s,]+/).map((t) => t.replace(/^#+/, "").trim()).filter(Boolean)));
  }
  // 헤딩 단축키 (Ctrl+Shift+1~6 = H1~H6, Ctrl+Shift+0 = 일반 문단) — 문서(WYSIWYG) 전용
  function applyHeading(level) {
    if (!S.editor) return;
    editorHasUserChanges = true;
    S.editor.exec("heading", { level });
  }

  const S = {
    notes: [], folders: [], folderId: ALL, noteId: null,
    query: "", tag: "", editor: null, open: false
  };
  let saveTimer = null, saveTimerNoteId = null;
  let editorHasUserChanges = false;
  let mountedNoteId = " ";   // 우측 편집기에 마운트된 노트 id (재생성 최소화용)
  let mountedEditorBody = ""; // Toast UI가 정규화한 마운트 직후 본문 (클릭만 한 변경 오인 방지)

  function root() { return document.getElementById("notes-view"); }
  function noteById(id) { return S.notes.find((n) => n.id === id) || null; }
  function updateDateInfo(n) {
    if (!n || n.id !== S.noteId) return;
    const dates = root().querySelector(".nb-dates");
    if (!dates) return;
    dates.innerHTML = "";
    dates.append(
      el("span", null, "생성 " + formatDateTime(n.createdAt)),
      el("span", null, "수정 " + formatDateTime(n.updatedAt))
    );
  }

  /* ---------------- 데이터 ---------------- */
  async function reload() {
    const [notes, folders] = await Promise.all([global.Store.getNotes(), global.Store.getFolders()]);
    S.notes = notes; S.folders = folders;
  }
  function saveNoteDebounced() {
    const n = noteById(S.noteId); if (!n) return;
    clearTimeout(saveTimer);
    saveTimerNoteId = n.id;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveTimerNoteId = null;
      global.Store.saveNote(n).then(() => { renderList(); updateDateInfo(n); })
        .catch(() => global.appToast && global.appToast("저장 실패 — 변경이 반영되지 않았어요"));
    }, 500);
  }
  function saveNoteNow() {
    const n = noteById(S.noteId); if (!n) return Promise.resolve();
    clearTimeout(saveTimer);
    saveTimer = null;
    saveTimerNoteId = null;
    return global.Store.saveNote(n).then(() => { renderList(); updateDateInfo(n); })
      .catch(() => global.appToast && global.appToast("저장 실패"));
  }
  // 즐겨찾기 토글 (목록 별표·편집기 버튼 공용). 편집기 버튼·탭 카운트까지 동기화.
  function togglePin(n) {
    if (!n) return Promise.resolve();
    n.pinned = !n.pinned;
    if (n.id === S.noteId) {                       // 열려 있는 노트면 편집기 버튼도 즉시 반영
      const pin = root().querySelector(".nb-pin");
      if (pin) { pin.classList.toggle("on", n.pinned); pin.textContent = n.pinned ? "⭐ 즐겨찾기" : "☆ 즐겨찾기"; }
    }
    return global.Store.saveNote(n).then(() => { renderList(); renderTabs(); updateDateInfo(n); })
      .catch(() => global.appToast && global.appToast("저장 실패"));
  }

  /* ---------------- 필터/정렬 ---------------- */
  function visibleNotes() {
    let list = S.notes.slice();
    const q = S.query.trim().toLowerCase();
    if (q) {
      list = list.filter((n) =>
        (n.title || "").toLowerCase().includes(q) ||
        (n.body || "").toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q)));
    } else {
      list = scopeNotes();
      if (S.tag) list = list.filter((n) => (n.tags || []).includes(S.tag));
    }
    list.sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt || 0) - (a.updatedAt || 0));
    return list;
  }
  function scopeNotes() {
    if (S.folderId === FAV) return S.notes.filter((n) => n.pinned);
    if (S.folderId === UNFILED) return S.notes.filter((n) => !n.folderId);
    if (S.folderId === ALL) return S.notes.slice();
    return S.notes.filter((n) => n.folderId === S.folderId);
  }
  function countIn(id) {
    if (id === ALL) return S.notes.length;
    if (id === FAV) return S.notes.filter((n) => n.pinned).length;
    if (id === UNFILED) return S.notes.filter((n) => !n.folderId).length;
    return S.notes.filter((n) => n.folderId === id).length;
  }

  /* ---------------- 책갈피 탭 (분류) ---------------- */
  function renderTabs() {
    const box = root().querySelector(".nb-tabs");
    box.innerHTML = "";
    box.appendChild(tab(ALL, "전체", false));
    box.appendChild(tab(FAV, "⭐ 즐겨찾기", false));
    S.folders.forEach((f, idx) => box.appendChild(tab(f.id, f.name || "(이름 없음)", true, idx)));
    box.appendChild(tab(UNFILED, "미분류", false));
    const add = el("button", "nb-tab nb-tab-add", "+ 분류");
    add.type = "button"; add.onclick = addFolder;
    box.appendChild(add);
  }
  function tab(id, label, editable, idx) {
    const t = el("button", "nb-tab" + (S.folderId === id && !S.query.trim() ? " active" : ""), label);
    t.type = "button";
    const cnt = countIn(id);
    if (cnt) t.appendChild(el("span", "nb-tab-count", String(cnt)));
    t.onclick = () => {
      S.folderId = id; S.query = ""; S.tag = "";
      const s = root().querySelector(".nb-search"); if (s) s.value = "";
      render();
    };
    if (editable) {
      t.title = "더블클릭: 이름변경 / 삭제 · 드래그: 순서이동";
      t.ondblclick = (e) => { e.preventDefault(); folderActions(id); };
      t.draggable = true; t.dataset.idx = idx;
      t.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", String(idx)); t.classList.add("dragging"); });
      t.addEventListener("dragend", () => t.classList.remove("dragging"));
      t.addEventListener("dragover", (e) => e.preventDefault());
      t.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (isNaN(from) || from === idx) return;
        const moved = S.folders.splice(from, 1)[0];
        S.folders.splice(idx, 0, moved);
        global.Store.saveFolders(S.folders).then(renderTabs);
      });
    }
    return t;
  }
  function folderActions(id) {
    const f = S.folders.find((x) => x.id === id); if (!f) return;
    const next = prompt("분류 이름 (지우고 저장하면 삭제됩니다)", f.name);
    if (next === null) return;
    const name = next.trim();
    if (!name) {
      if (!confirm(`'${f.name}' 분류를 삭제할까요? (안의 노트는 미분류로 남습니다)`)) return;
      S.folders = S.folders.filter((x) => x.id !== id);
      const affected = S.notes.filter((n) => n.folderId === id);
      affected.forEach((n) => { n.folderId = null; });
      Promise.all([global.Store.saveFolders(S.folders), ...affected.map((n) => global.Store.saveNote(n))]).then(() => {
        if (S.folderId === id) S.folderId = ALL;
        forceRender();
      });
    } else {
      f.name = name;
      global.Store.saveFolders(S.folders).then(forceRender);
    }
  }
  function addFolder() {
    const name = prompt("새 분류 이름");
    if (name === null) return;
    const t = name.trim(); if (!t) return;
    const f = global.Store.newFolder(t);
    S.folders.push(f);
    global.Store.saveFolders(S.folders).then(() => { S.folderId = f.id; forceRender(); });
  }

  /* ---------------- 태그 필터 + 노트 목록 ---------------- */
  function renderTagbar() {
    const box = root().querySelector(".nb-tagbar");
    box.innerHTML = "";
    if (S.query.trim()) return;
    const set = new Set();
    scopeNotes().forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    const tags = Array.from(set).sort();
    tags.forEach((t) => {
      const chip = el("button", "nb-tag" + (S.tag === t ? " active" : ""), "#" + t);
      chip.type = "button";
      chip.onclick = () => { S.tag = (S.tag === t ? "" : t); render(); };
      box.appendChild(chip);
    });
  }
  function renderList() {
    const box = root().querySelector(".nb-list");
    if (!box) return;
    box.innerHTML = "";
    const list = visibleNotes();
    if (!list.length) {
      box.appendChild(el("p", "nb-empty small", S.query.trim() ? "검색 결과가 없어요." : "이 분류에 노트가 없어요. 위 「+ 새 노트」로 만들어보세요."));
      return;
    }
    for (const n of list) {
      const item = el("div", "nb-item" + (S.noteId === n.id ? " active" : ""));
      const top = el("div", "nb-item-top");
      top.appendChild(el("span", "nb-item-title", (n.title || "").trim() || "(제목 없음)"));
      const star = el("span", "nb-item-star" + (n.pinned ? " on" : ""), n.pinned ? "★" : "☆");
      star.title = n.pinned ? "즐겨찾기 해제" : "즐겨찾기에 추가";
      star.onclick = (e) => { e.stopPropagation(); togglePin(n); };
      top.appendChild(star);
      item.append(top, el("div", "nb-item-meta", "수정 " + timeAgo(n.updatedAt)));
      if ((n.tags || []).length) {
        const tl = el("div", "nb-item-tags");
        n.tags.slice(0, 4).forEach((t) => tl.appendChild(el("span", "nb-item-tag", "#" + t)));
        item.appendChild(tl);
      }
      item.onclick = () => openNote(n.id);
      box.appendChild(item);
    }
  }

  /* ---------------- 편집 패널 (Toast UI Editor) ---------------- */
  function destroyEditor() {
    if (!S.editor) return;
    const n = noteById(mountedNoteId);
    let changed = !!n && saveTimerNoteId === n.id;
    try {
      if (n) {
        const body = S.editor.getMarkdown();
        if (body !== mountedEditorBody) { n.body = body; changed = true; }
      }
    } catch (_) {}
    try { S.editor.destroy(); } catch (_) {}
    S.editor = null;
    mountedEditorBody = "";
    editorHasUserChanges = false;
    if (n && changed) {
      clearTimeout(saveTimer);
      saveTimer = null;
      saveTimerNoteId = null;
      global.Store.saveNote(n).then(renderList).catch(() => {});
    }
  }

  /* ---------------- 마크다운 보기 / 다운로드 ---------------- */
  function currentMarkdown(n) {
    try { if (S.editor) return S.editor.getMarkdown(); } catch (_) {}
    return (n && n.body) || "";
  }
  function safeFileName(title) {
    const base = String(title || "").trim().replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").slice(0, 80);
    return (base || "untitled") + ".md";
  }
  // 현재 노트를 .md 파일로 내려받기 (app.js의 .txt 내보내기와 동일 blob 패턴)
  function downloadNote(n) {
    const blob = new Blob([currentMarkdown(n)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = safeFileName(n.title);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // 원문 마크다운 보기(읽기 전용) + 복사 — 앱 공통 .modal 재사용
  function openMarkdownView(n) {
    const md = currentMarkdown(n);
    const overlay = el("div", "modal");
    const card = el("div", "modal-card nb-md-card");
    const copy = el("button", "row-btn"); copy.type = "button"; copy.textContent = "복사";
    const close = el("button", "close-btn"); close.type = "button"; close.textContent = "✕";
    const head = el("div", "modal-head");
    head.append(el("span", "modal-title", "마크다운"), copy, close);
    const ta = el("textarea", "nb-md-text"); ta.value = md; ta.readOnly = true;
    card.append(head, ta);
    overlay.appendChild(card);
    const closeIt = () => { if (overlay.parentNode) document.body.removeChild(overlay); };
    close.onclick = closeIt;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeIt(); });
    copy.onclick = () => {
      const done = () => { copy.textContent = "복사됨"; setTimeout(() => { copy.textContent = "복사"; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(md).then(done).catch(() => { ta.select(); done(); });
      } else { ta.select(); try { document.execCommand("copy"); } catch (_) {} done(); }
    };
    document.body.appendChild(overlay);
  }

  function renderEditor() {
    const pane = root().querySelector(".nb-editor");
    destroyEditor();
    pane.innerHTML = "";
    const n = noteById(S.noteId);
    if (!n) {
      const empty = el("div", "nb-editor-empty");
      empty.append(
        el("p", "nb-empty", "왼쪽에서 노트를 고르거나, 위 「+ 새 노트」로 학습한 내용을 정리하세요.")
      );
      const add = el("button", "btn-primary", "+ 새 노트");
      add.type = "button"; add.onclick = createNote;
      empty.appendChild(add);
      pane.appendChild(empty);
      return;
    }

    const head = el("div", "nb-editor-head");
    const back = el("button", "nb-editor-back icon-btn", "←");
    back.type = "button"; back.title = "목록"; back.onclick = () => root().classList.remove("nb-editing");
    const pin = el("button", "nb-pin" + (n.pinned ? " on" : ""), n.pinned ? "⭐ 즐겨찾기" : "☆ 즐겨찾기");
    pin.type = "button";
    pin.onclick = () => togglePin(n);
    const del = el("button", "row-btn danger", "삭제");
    del.type = "button"; del.onclick = () => deleteNote(n.id);
    head.append(back, el("span", "nb-editor-spacer"), pin, del);
    pane.appendChild(head);

    const titleInput = el("input", "nb-title-input");
    titleInput.type = "text"; titleInput.placeholder = "제목"; titleInput.value = n.title || "";
    titleInput.addEventListener("input", () => { n.title = titleInput.value; saveNoteDebounced(); });
    titleInput.addEventListener("blur", () => { if (saveTimerNoteId === n.id) saveNoteNow(); });
    pane.appendChild(titleInput);

    const dates = el("div", "nb-dates");
    pane.appendChild(dates);
    updateDateInfo(n);

    const metaRow = el("div", "nb-meta-row");
    const sel = el("select", "nb-folder-select");
    const optU = el("option", null, "미분류"); optU.value = ""; sel.appendChild(optU);
    S.folders.forEach((f) => { const o = el("option", null, (f.name || "(이름 없음)")); o.value = f.id; sel.appendChild(o); });
    sel.value = n.folderId || "";
    sel.onchange = () => { n.folderId = sel.value || null; saveNoteNow(); };
    const tagsInput = el("input", "nb-tags-input");
    tagsInput.type = "text"; tagsInput.placeholder = "#태그 (공백으로 구분)";
    tagsInput.value = (n.tags || []).map((t) => "#" + t).join(" ");
    const commitTags = () => {
      const next = parseTags(tagsInput.value);
      tagsInput.value = next.map((t) => "#" + t).join(" ");
      if (next.join("\n") === n.tags.join("\n")) return;
      n.tags = next;
      saveNoteNow();
    };
    tagsInput.addEventListener("blur", commitTags);
    tagsInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commitTags(); } });
    metaRow.append(sel, tagsInput);
    pane.appendChild(metaRow);

    const host = el("div", "nb-editor-tui");
    pane.appendChild(host);

    // 우측 하단 떠있는 액션: 마크다운 보기 · 다운로드
    const actions = el("div", "nb-editor-actions");
    const viewBtn = el("button", "nb-action-btn", "마크다운 보기");
    viewBtn.type = "button"; viewBtn.title = "원문 마크다운 보기 · 복사";
    viewBtn.addEventListener("mousedown", (e) => e.preventDefault());
    viewBtn.onclick = () => openMarkdownView(n);
    const dlBtn = el("button", "nb-action-btn", "다운로드");
    dlBtn.type = "button"; dlBtn.title = "이 노트를 .md 파일로 내려받기";
    dlBtn.addEventListener("mousedown", (e) => e.preventDefault());
    dlBtn.onclick = () => downloadNote(n);
    actions.append(viewBtn, dlBtn);
    pane.appendChild(actions);

    try {
      S.editor = new global.toastui.Editor({
        el: host,
        height: "100%",
        initialEditType: "wysiwyg",
        hideModeSwitch: true,
        initialValue: n.body || "",
        usageStatistics: false,
        autofocus: false,
        toolbarItems: [
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol", "task", "indent", "outdent"],
          ["table", "link"],
          ["code", "codeblock"]
        ]
      });
      mountedEditorBody = S.editor.getMarkdown();
      editorHasUserChanges = false;
      const markEditorChangedByUser = () => { editorHasUserChanges = true; };
      host.addEventListener("beforeinput", markEditorChangedByUser, true);
      host.addEventListener("paste", markEditorChangedByUser, true);
      host.addEventListener("drop", markEditorChangedByUser, true);
      host.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey && e.shiftKey) || !/^Digit[0-6]$/.test(e.code)) return;
        e.preventDefault();
        e.stopPropagation();
        applyHeading(Number(e.code.slice(-1)));
      }, true);
      host.addEventListener("click", (e) => {
        if (e.target.closest("button")) markEditorChangedByUser();
      }, true);
      S.editor.on("change", () => {
        const body = S.editor.getMarkdown();
        if (!editorHasUserChanges) {
          mountedEditorBody = body;
          return;
        }
        if (body === mountedEditorBody) return;
        mountedEditorBody = body;
        n.body = body;
        saveNoteDebounced();
      });
    } catch (e) {
      console.error("에디터 생성 실패:", e);
      host.appendChild(el("p", "nb-empty", "에디터를 불러오지 못했어요. 새로고침해 주세요."));
    }
  }

  // 선택 노트가 바뀐 경우에만 편집기 재생성 (탭/검색/태그 클릭 때 깜빡임 방지)
  function syncEditor() {
    if (S.noteId === mountedNoteId) return;
    // 순서 주의: renderEditor()가 먼저 destroyEditor()로 '직전 노트'(mountedNoteId)에
    // 편집 내용을 flush·저장한 뒤 새 노트를 마운트한다. mountedNoteId를 미리 새 노트로
    // 바꾸면 destroyEditor가 직전 편집 내용을 '방금 클릭한 노트'에 잘못 저장해,
    // 노트끼리 본문이 덮어써진다(=노트 여러 개가 한 내용으로 합쳐지던 버그).
    renderEditor();
    mountedNoteId = S.noteId;
  }
  function openNote(id) {
    S.noteId = id;
    root().classList.add("nb-editing");
    renderList();
    syncEditor();
    const ti = root().querySelector(".nb-title-input");
    if (ti && !((noteById(id) || {}).title || "").trim()) setTimeout(() => ti.focus(), 30);
  }
  function createNote() {
    const fid = (S.folderId === ALL || S.folderId === FAV || S.folderId === UNFILED) ? null : S.folderId;
    const n = global.Store.newStandaloneNote(fid);
    S.notes.push(n);
    global.Store.saveNote(n).catch(() => {});
    openNote(n.id);
    renderTabs();
  }
  function deleteNote(id) {
    if (!confirm("이 노트를 삭제할까요?")) return;
    global.Store.deleteNote(id).then(() => {
      S.notes = S.notes.filter((n) => n.id !== id);
      if (S.noteId === id) S.noteId = null;
      render();
      root().classList.remove("nb-editing");
    });
  }

  /* ---------------- 전체 렌더 / 셸 ---------------- */
  function buildShell() {
    const v = root();
    v.innerHTML = "";

    const top = el("div", "nb-topbar");
    const close = el("button", "nb-close icon-btn", "← 닫기");
    close.type = "button"; close.onclick = () => global.Notebook.close();
    const search = el("input", "nb-search");
    search.type = "search"; search.placeholder = "전체 검색";
    let st = null;
    search.addEventListener("input", () => { clearTimeout(st); st = setTimeout(() => { S.query = search.value; S.tag = ""; render(); }, 150); });
    const newBtn = el("button", "nb-newnote btn-primary", "+ 새 노트");
    newBtn.type = "button"; newBtn.onclick = createNote;
    top.append(close, el("span", "nb-brand", "노트"), el("span", "nb-topbar-spacer"), search, newBtn);
    v.appendChild(top);

    v.appendChild(el("div", "nb-tabs"));

    const body = el("div", "nb-body");
    const listcol = el("div", "nb-listcol");
    listcol.append(el("div", "nb-tagbar"), el("div", "nb-list"));
    const editor = el("section", "nb-editor");
    body.append(listcol, editor);
    v.appendChild(body);
  }

  function render() {
    if (S.noteId && !noteById(S.noteId)) S.noteId = null;
    renderTabs();
    renderTagbar();
    renderList();
    syncEditor();
  }
  function forceRender() { mountedNoteId = " "; render(); }   // 분류 변경 → 편집기 select도 갱신

  const Notebook = {
    async open() {
      const v = root(); if (!v) return;
      S.noteId = null; S.query = ""; S.tag = "";
      mountedNoteId = " ";
      buildShell();
      v.hidden = false;
      S.open = true;
      v.querySelector(".nb-list").innerHTML = '<p class="nb-empty small">불러오는 중…</p>';
      try {
        await reload();
      } catch (e) {
        console.error("노트 불러오기 실패:", e);
        global.appToast && global.appToast("노트를 불러오지 못했어요");
      }
      render();
    },
    close() {
      destroyEditor();
      S.open = false;
      const v = root();
      if (v) { v.hidden = true; v.classList.remove("nb-editing"); }
      if (typeof this.onClose === "function") this.onClose();
    },
    isOpen() { return S.open; },
    onClose: null
  };

  global.Notebook = Notebook;
})(window);
