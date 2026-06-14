(function (global) {
  "use strict";

  const CIRCLES = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  const KOREAN = "가나다라마바사아자차카타파하";
  const ANY_PREFIX = /^(\s*)(?:[-*+]|\d+[.)]|[가나다라마바사아자차카타파하]\.|[①-⑳])\s+/;

  function markerFor(type, index) {
    const n = index + 1;
    if (type === "bullet") return "- ";
    if (type === "decimal") return n + ". ";
    if (type === "paren") return n + ") ";
    if (type === "korean") return KOREAN[index % KOREAN.length] + ". ";
    if (type === "circle") return CIRCLES[index % CIRCLES.length] + " ";
    return "";
  }

  function matchesType(line, type) {
    const trimmed = line.trimStart();
    if (type === "bullet") return /^[-*+]\s+/.test(trimmed);
    if (type === "decimal") return /^\d+\.\s+/.test(trimmed);
    if (type === "paren") return /^\d+\)\s+/.test(trimmed);
    if (type === "korean") return /^[가나다라마바사아자차카타파하]\.\s+/.test(trimmed);
    if (type === "circle") return /^[①-⑳]\s+/.test(trimmed);
    return false;
  }

  function toggleLinePrefix(markdown, selection, type) {
    const lines = String(markdown || "").split("\n");
    const startLine = Math.max(1, Math.min(selection[0][0], selection[1][0]));
    const endLine = Math.max(startLine, Math.max(selection[0][0], selection[1][0]));
    const selected = lines.slice(startLine - 1, endLine);
    const candidates = selected.filter((line) => line.trim() || selected.length === 1);
    const removeOnly = candidates.length > 0 && candidates.every((line) => matchesType(line, type));
    let itemIndex = 0;

    for (let i = startLine - 1; i < endLine && i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.trim() && selected.length > 1) continue;
      const indent = (line.match(/^\s*/) || [""])[0];
      const content = line.replace(ANY_PREFIX, "$1").slice(indent.length);
      lines[i] = removeOnly ? indent + content : indent + markerFor(type, itemIndex) + content;
      itemIndex += 1;
    }

    return {
      markdown: lines.join("\n"),
      selection: [[startLine, 1], [endLine, (lines[endLine - 1] || "").length + 1]]
    };
  }

  global.NotebookFormat = { toggleLinePrefix };
})(typeof window !== "undefined" ? window : this);
