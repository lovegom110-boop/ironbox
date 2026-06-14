/* 노트장 덮어쓰기 회귀 + Firebase Hosting 배포 설정 검증 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const notebook = fs.readFileSync(path.join(root, "js", "notebook.js"), "utf8");
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

console.log("ALL PASS (notebook transition + hosting excludes)");
