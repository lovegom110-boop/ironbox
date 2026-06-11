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

/* ----- planCarryMerge: '하루 한 번' 합치기 순수 로직 ----- */
assert.ok(typeof Store.planCarryMerge === "function", "Store.planCarryMerge 가 있어야 함");

// 8) 오늘에 이미 할 일이 있어도 어제 미완료를 '아래에 합침' (비었을 때만 X)
{
  const day = { date: "2026-06-09", tasks: [task("today-own", false)], carriedDone: false };
  const all = [{ date: "2026-06-08", tasks: [task("A", false), task("B", true)] }, day];
  const plan = Store.planCarryMerge(day, all, "2026-06-09");
  assert.deepStrictEqual(texts(plan.tasks), ["today-own", "A"], "오늘 것 아래에 어제 미완료 A 합침");
  assert.strictEqual(plan.added, 1, "1개 추가");
  assert.strictEqual(plan.mark, true, "이월 표시 켬");
}
// 9) 같은 이름이 오늘에 이미 있으면 그건 안 붙임(중복 방지)
{
  const day = { date: "2026-06-09", tasks: [task("A", false)] };
  const all = [{ date: "2026-06-08", tasks: [task("A", false), task("B", false)] }, day];
  const plan = Store.planCarryMerge(day, all, "2026-06-09");
  assert.deepStrictEqual(texts(plan.tasks), ["A", "B"], "이름 겹치는 A는 제외, B만 추가");
  assert.strictEqual(plan.added, 1, "B 1개만");
}
// 10) 이미 이월한 날(carriedDone)은 그대로 두고 안 붙임 → 지운 것 안 살아남
{
  const day = { date: "2026-06-09", tasks: [task("A", false)], carriedDone: true };
  const all = [{ date: "2026-06-08", tasks: [task("B", false)] }, day];
  const plan = Store.planCarryMerge(day, all, "2026-06-09");
  assert.deepStrictEqual(texts(plan.tasks), ["A"], "건드리지 않음");
  assert.strictEqual(plan.added, 0, "추가 없음");
  assert.strictEqual(plan.mark, false, "다시 저장 안 함");
}
// 11) 빈 오늘 + 어제 미완료 → 어제 것만 채움, 표시 켬
{
  const day = { date: "2026-06-09", tasks: [] };
  const all = [{ date: "2026-06-08", tasks: [task("A", false), task("C", true)] }, day];
  const plan = Store.planCarryMerge(day, all, "2026-06-09");
  assert.deepStrictEqual(texts(plan.tasks), ["A"], "미완료 A만");
  assert.strictEqual(plan.added, 1, "1개");
  assert.strictEqual(plan.mark, true, "표시 켬");
}
// 12) 어제가 전부 완료라 가져올 게 없어도, '하루 한 번' 표시는 켠다(0개 추가)
{
  const day = { date: "2026-06-09", tasks: [task("own", false)] };
  const all = [{ date: "2026-06-08", tasks: [task("A", true)] }, day];
  const plan = Store.planCarryMerge(day, all, "2026-06-09");
  assert.deepStrictEqual(texts(plan.tasks), ["own"], "그대로");
  assert.strictEqual(plan.added, 0, "추가 0");
  assert.strictEqual(plan.mark, true, "그래도 표시는 켜서 그날 재시도 멈춤");
}

console.log("ALL PASS (12 cases)");
