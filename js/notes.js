/* =========================================================================
 * notes.js — 하루별 "노트" 카드 (마크다운 학습정리, 읽기뷰 렌더)
 *  - 편집은 app.js의 노트 모달(EasyMDE)에서. 여기선 카드 목록 렌더 + 안전 렌더만.
 * ====================================================================== */
(function (global) {
  "use strict";

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // id 기반 안정적 포스트잇 색 인덱스(0~3)
  function colorIdx(id) {
    let h = 0; const s = String(id);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 4;
  }

  // marked 설정 1회 적용:
  //  - 목록 파싱 비활성화: "2025. 10. ..." 처럼 '숫자.+공백'으로 시작하는 줄을 마크다운이
  //    순서목록으로 보고 번호를 자동 재계산해 입력값(2025,2025,2026…)이 표시값(2025,2026,2027…)과
  //    달라지던 데이터 손상 방지. 굵게/기울임/제목/링크/인용 등 다른 서식은 그대로 유지.
  let _markedReady = false;
  function ensureMarked() {
    if (_markedReady) return;
    try { if (global.marked && global.marked.use) global.marked.use({ tokenizer: { list() { return undefined; } } }); } catch (_) {}
    _markedReady = true;
  }

  const Notes = {
    // 마크다운 → 살균된 HTML (XSS 차단). breaks:true=단일 줄바꿈(\n)을 <br>로 보존.
    mdToSafeHtml(md) {
      ensureMarked();
      let html = md || "";
      const opts = { breaks: true, gfm: true };
      try {
        if (global.marked) html = (global.marked.parse ? global.marked.parse(md || "", opts) : global.marked(md || "", opts));
      } catch (_) { html = (md || ""); }
      if (global.DOMPurify) html = global.DOMPurify.sanitize(html);
      return html;
    },

    renderList(container, notes, handlers) {
      container.innerHTML = "";
      const list = (notes || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      if (!list.length) {
        container.appendChild(el("p", "empty-hint small", "학습·공부 내용을 카드로 정리해보세요. 마크다운(굵게·제목·목록·링크)으로 쓸 수 있어요."));
      }
      const grid = el("div", "notes-grid");
      for (const n of list) {
        const card = el("div", "note-card sticky-" + colorIdx(n.id));
        const head = el("div", "note-card-head");
        const title = el("div", "note-card-title", n.title || "(제목 없음)");
        const edit = el("button", "row-btn", "편집"); edit.onclick = () => handlers.onEdit(n.id);
        const del = el("button", "row-btn danger", "삭제"); del.onclick = () => handlers.onDelete(n.id);
        head.append(title, edit, del);
        card.appendChild(head);
        const bodyEl = el("div", "note-card-body md");
        bodyEl.innerHTML = this.mdToSafeHtml(n.body);
        bodyEl.querySelectorAll("a").forEach((a) => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
        if ((n.body || "").trim()) card.appendChild(bodyEl);
        card.querySelector(".note-card-title").ondblclick = () => handlers.onEdit(n.id);
        grid.appendChild(card);
      }
      if (list.length) container.appendChild(grid);
      const add = el("button", "note-add", "+ 노트 추가");
      add.type = "button";
      add.onclick = () => handlers.onAdd();
      container.appendChild(add);
    }
  };

  global.Notes = Notes;
})(window);
