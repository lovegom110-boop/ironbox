/* 이월(carry-over) 순수 로직 테스트 — node test/carryover.test.js
 * Store.computeCarry(allDays, date): 'date' 직전의 가장 최근 '내용 있는 날'에서
 * 미완료(!done) 할 일만 새 할 일로 만들어 반환. (앱·위젯 공용 규칙) */
const assert = require("assert");
require("../js/store.js");                 // side-effect: globalThis.Store 등록
const Store = globalThis.Store;
assert.ok(Store && typeof Store.computeCarry === "function", "Store.computeCarry 가 있어야 함");

const task = (text, done, opts) => Object.assign(Store.newTask(text), { done: !!done }, opts || {});
const texts = (arr) => arr.map((t) => t.text);

// 1) 직전 기록일의 미완료만 이월, 완료는 제외
{
  const all = [{ date: "2026-06-08", tasks: [task("A", true), task("B", false), task("C", false)] }];
  const carry = Store.computeCarry(all, "2026-06-09");
  assert.deepStrictEqual(texts(carry), ["B", "C"], "미완료 B,C만");
  assert.ok(carry.every((t) => t.done === false), "이월분은 미완료 상태");
}
// 2) 직전 기록일이 없으면 []
assert.deepStrictEqual(Store.computeCarry([], "2026-06-09"), [], "과거 기록 없음 → []");
// 3) 직전 기록일이 전부 완료면 []
{
  const all = [{ date: "2026-06-08", tasks: [task("A", true), task("B", true)] }];
  assert.deepStrictEqual(Store.computeCarry(all, "2026-06-09"), [], "전부 완료 → []");
}
// 4) 여러 과거일 중 '가장 최근의 내용 있는 날'만 사용
{
  const all = [
    { date: "2026-06-05", tasks: [task("old", false)] },
    { date: "2026-06-08", tasks: [task("recent", false)] },
  ];
  assert.deepStrictEqual(texts(Store.computeCarry(all, "2026-06-09")), ["recent"], "가장 최근일만");
}
// 5) 사이에 빈 날이 있어도 건너뛰고 가장 최근의 '내용 있는' 날 사용
{
  const all = [
    { date: "2026-06-07", tasks: [task("kept", false)] },
    { date: "2026-06-08", tasks: [] },
  ];
  assert.deepStrictEqual(texts(Store.computeCarry(all, "2026-06-09")), ["kept"], "빈 날 건너뜀");
}
// 6) 태그/카테고리 보존 + 새 id + Big3 해제 + 미완료로
{
  const src = task("tagged", false, { tags: ["공부", "글쓰기"], category: "기획", isBig3: true });
  const carry = Store.computeCarry([{ date: "2026-06-08", tasks: [src] }], "2026-06-09");
  assert.deepStrictEqual(carry[0].tags, ["공부", "글쓰기"], "태그 보존");
  assert.strictEqual(carry[0].category, "기획", "카테고리 보존");
  assert.notStrictEqual(carry[0].id, src.id, "새 id 부여");
  assert.strictEqual(carry[0].isBig3, false, "이월은 일반 할일(Big3 아님)");
  assert.strictEqual(carry[0].done, false, "미완료로");
}
// 7) 오늘/미래 날짜는 직전으로 치지 않음 (date < today 만)
{
  const all = [
    { date: "2026-06-09", tasks: [task("today", false)] },
    { date: "2026-06-10", tasks: [task("future", false)] },
  ];
  assert.deepStrictEqual(Store.computeCarry(all, "2026-06-09"), [], "오늘/미래 제외");
}

console.log("ALL PASS (7 cases)");
