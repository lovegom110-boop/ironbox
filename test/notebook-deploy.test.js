/* 노트장 덮어쓰기 회귀 + Firebase Hosting 배포 설정 검증 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const notebook = fs.readFileSync(path.join(root, "js", "notebook.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const style = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const firebase = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));

// 노트 전환 시 기존 편집기를 먼저 flush한 뒤 새 노트 ID를 마운트해야 한다.
const syncEditor = notebook.match(/function syncEditor\(\) \{([\s\S]*?)\n  \}/);
assert.ok(syncEditor, "syncEditor 함수가 있어야 함");
assert.ok(
  syncEditor[1].indexOf("renderEditor();") < syncEditor[1].indexOf("mountedNoteId = S.noteId;"),
  "기존 노트를 저장한 뒤 새 노트 ID를 마운트해야 함"
);

const destroyEditor = notebook.match(/function destroyEditor\(\) \{([\s\S]*?)\n  \}/);
assert.ok(destroyEditor, "destroyEditor 함수가 있어야 함");
assert.ok(
  destroyEditor[1].includes("body !== mountedEditorBody"),
  "노트를 클릭하거나 닫을 때 본문이 실제로 바뀐 경우에만 저장해야 함"
);

assert.ok(notebook.includes('"생성 " + formatDateTime(n.createdAt)'), "편집 화면에 생성일 표시 필요");
assert.ok(notebook.includes('"수정 " + formatDateTime(n.updatedAt)'), "편집 화면에 수정일 표시 필요");
assert.ok(notebook.includes('"수정 " + timeAgo(n.updatedAt)'), "목록에 상대 수정일 표시 필요");
assert.ok(
  notebook.includes('titleInput.addEventListener("blur", () => { if (saveTimerNoteId === n.id) saveNoteNow(); });'),
  "제목을 수정하지 않은 채 다른 노트를 클릭하면 저장하지 않아야 함"
);
assert.ok(notebook.includes("saveTimer = null;"), "저장 완료 후 변경 대기 상태를 해제해야 함");
assert.ok(notebook.includes("updateDateInfo(n);"), "저장 직후 편집 화면의 수정일을 갱신해야 함");
assert.ok(notebook.includes("saveTimerNoteId"), "디바운스 저장이 어느 노트의 변경인지 추적해야 함");
assert.ok(
  destroyEditor[1].includes("saveTimerNoteId === n.id"),
  "노트 전환 시 직전 노트의 대기 중 변경을 먼저 저장해야 함"
);
assert.ok(
  notebook.includes("if (next.join(\"\\n\") === n.tags.join(\"\\n\")) return;"),
  "태그를 수정하지 않은 blur는 저장하지 않아야 함"
);
assert.ok(
  notebook.includes("if (body === mountedEditorBody) return;"),
  "에디터 change 이벤트도 마운트 직후 본문이 실제로 달라진 경우에만 저장해야 함"
);
assert.ok(notebook.includes("mountedEditorBody"), "에디터 마운트 직후 본문을 변경 감지 기준으로 보관해야 함");
assert.ok(
  destroyEditor[1].includes("body !== mountedEditorBody"),
  "노트 전환 시 저장 원본이 아니라 마운트 직후 본문과 비교해야 함"
);

// Spark Hosting에는 실행 파일을 올릴 수 없고, 데스크톱 소스와 테스트도 웹 셸이 아니다.
const ignore = firebase.hosting && firebase.hosting.ignore;
assert.ok(Array.isArray(ignore), "hosting.ignore 배열이 있어야 함");
for (const pattern of ["desktop/**", "test/**", "**/*.bat", "**/*.ps1", "**/*.exe", "**/*.msi"]) {
  assert.ok(ignore.includes(pattern), `Firebase Hosting에서 ${pattern} 제외 필요`);
}

assert.ok(
  notebook.includes("if (!editorHasUserChanges)"),
  "editor initialization normalization must not be saved as a user edit"
);
assert.ok(
  notebook.includes('host.addEventListener("beforeinput", markEditorChangedByUser, true)'),
  "real user body input must be detected"
);
// 노트장은 문서(WYSIWYG) 전용 — 마크다운 모드·분할 화면·줄 글머리 도구를 제거함
assert.ok(notebook.includes('initialEditType: "wysiwyg"'), "에디터는 문서(WYSIWYG)로 시작해야 함");
assert.ok(notebook.includes("hideModeSwitch: true"), "내장 모드 전환 UI는 숨겨야 함");
assert.ok(!notebook.includes("changeMode"), "마크다운 모드 전환은 없어야 함(분할 화면 제거)");
assert.ok(!notebook.includes("NotebookFormat"), "줄 글머리 포매터 의존은 제거되어야 함");
assert.ok(!notebook.includes("buildEditorTools"), "커스텀 서식 툴바는 제거되어야 함");
assert.ok(!index.includes("notebook-format.js"), "index.html에서 notebook-format.js 로딩이 제거되어야 함");
assert.ok(!serviceWorker.includes("notebook-format"), "SW 셸에서 notebook-format 참조가 제거되어야 함");
// 헤딩 단축키(Ctrl+Shift+1~6)는 WYSIWYG에서 그대로 동작해야 함
assert.ok(notebook.includes('/^Digit[0-6]$/'), "heading shortcut must use physical digit keys");
assert.ok(notebook.includes("e.ctrlKey && e.shiftKey"), "heading shortcut must require Ctrl and Shift");
assert.ok(notebook.includes('S.editor.exec("heading"'), "WYSIWYG heading shortcut must use the editor heading command");
assert.ok(notebook.includes('S.editor.exec("bulletList")'), "Ctrl+Shift+8 글머리 목록 단축키가 있어야 함");
assert.ok(notebook.includes('S.editor.exec("orderedList")'), "Ctrl+Shift+7 번호 목록 단축키가 있어야 함");

// 편집기 우측 하단: 마크다운 보기(모달+복사) + .md 다운로드
assert.ok(notebook.includes("nb-editor-actions"), "우측 하단 액션 버튼 그룹이 있어야 함");
assert.ok(notebook.includes("마크다운 보기"), "마크다운 보기 버튼이 있어야 함");
assert.ok(notebook.includes("text/markdown"), "노트를 .md(text/markdown)로 다운로드해야 함");
assert.ok(notebook.includes("safeFileName"), "다운로드 파일명을 제목 기반으로 안전화해야 함");

// 인쇄 / PDF — 보이는 서식 그대로 (브라우저 인쇄창 → PDF 저장, 추가 라이브러리 없음)
assert.ok(notebook.includes("function printNote"), "인쇄 함수 printNote가 있어야 함");
assert.ok(notebook.includes("window.print()"), "브라우저 인쇄창을 호출해야 함");
assert.ok(notebook.includes("인쇄 / PDF"), "인쇄/PDF 버튼이 있어야 함");
assert.ok(notebook.includes("mdToSafeHtml"), "인쇄 본문은 앱 공통 안전 렌더(mdToSafeHtml)로 그려야 함");
assert.ok(notebook.includes('afterprint'), "인쇄 후 문서 제목·인쇄 영역을 원상복구해야 함");
assert.ok(index.includes('id="nb-print"'), "인쇄 전용 영역(#nb-print)이 index.html에 있어야 함");
assert.ok(/@media\s+print/.test(style), "인쇄용 스타일(@media print)이 style.css에 있어야 함");
assert.ok(style.includes("#nb-print{display:none}"), "인쇄 영역은 평소 화면에서 숨겨야 함");

console.log("ALL PASS (notebook transition + hosting excludes + print/pdf)");
