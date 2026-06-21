/* 오늘의 메모 렌더 회귀:
   "2025. 10. ..." 처럼 숫자로 시작하는 줄이 마크다운 순서목록으로 변환되며
   번호가 자동 재계산돼 입력값≠표시값이 되던 데이터 손상 방지. (2026-06-21) */
const assert = require("assert");

global.window = global;
global.marked = require("../js/lib/marked.min.js");
require("../js/notes.js");

const body = [
  "2025. 10. 130,364 13,036",
  "2025. 11. 135,388 13,538",
  "2025. 12. 97,946 9,794",
  "2026. 01. 136,659 13,665",
  "2026. 02. 149,432 14,943",
].join("\n");

const html = window.Notes.mdToSafeHtml(body);

// 1) 순서/글머리 목록으로 변환되면 안 된다(목록화가 값을 망가뜨림)
assert.ok(!/<ol|<li/i.test(html), "메모가 목록(<ol>/<li>)으로 변환되면 안 됨");

// 2) 입력한 연·월 값이 그대로 보존돼야 한다(자동 재번호 금지)
["2025. 10.", "2025. 11.", "2025. 12.", "2026. 01.", "2026. 02."].forEach((s) => {
  assert.ok(html.indexOf(s) >= 0, `입력값 "${s}" 이 그대로 보존돼야 함`);
});

// 3) 여러 줄은 <br>로 줄바꿈 보존
assert.ok(/<br\s*\/?>/i.test(html), "여러 줄은 <br>로 보존돼야 함");

// 4) 인라인 마크다운(굵게/링크)은 계속 동작해야 한다(목록만 끈 것)
const md2 = window.Notes.mdToSafeHtml("**굵게** 그리고 [링크](https://example.com)");
assert.ok(/<strong>굵게<\/strong>/.test(md2), "굵게(**) 마크다운은 유지돼야 함");
assert.ok(/<a [^>]*href="https:\/\/example\.com"/.test(md2), "링크 마크다운은 유지돼야 함");

console.log("notes-render.test.js: 통과 ✅");
