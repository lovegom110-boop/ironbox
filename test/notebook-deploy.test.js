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

// Spark Hosting에는 실행 파일을 올릴 수 없고, 데스크톱 소스와 테스트도 웹 셸이 아니다.
const ignore = firebase.hosting && firebase.hosting.ignore;
assert.ok(Array.isArray(ignore), "hosting.ignore 배열이 있어야 함");
for (const pattern of ["desktop/**", "test/**", "**/*.bat", "**/*.ps1", "**/*.exe", "**/*.msi"]) {
  assert.ok(ignore.includes(pattern), `Firebase Hosting에서 ${pattern} 제외 필요`);
}

console.log("ALL PASS (notebook transition + hosting excludes)");
