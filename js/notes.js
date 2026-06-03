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

  const Notes = {
    // 마크다운 → 살균된 HTML (XSS 차단)
    mdToSafeHtml(md) {
      let html = md || "";
      try {
        if (global.marked) html = (global.marked.parse ? global.marked.parse(md || "") : global.marked(md || ""));
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
      for (const n of list) {
        const card = el("div", "note-card");
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
        container.appendChild(card);
      }
      const add = el("button", "note-add", "+ 노트 추가");
      add.type = "button";
      add.onclick = () => handlers.onAdd();
      container.appendChild(add);
    }
  };

  global.Notes = Notes;
})(window);
