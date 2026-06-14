const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "notebook-format.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(source, context);

const toggle = context.window.NotebookFormat.toggleLinePrefix;

let result = toggle("첫째\n둘째", [[1, 1], [2, 3]], "paren");
assert.strictEqual(result.markdown, "1) 첫째\n2) 둘째", "selected lines get numbered paren markers");

result = toggle(result.markdown, result.selection, "paren");
assert.strictEqual(result.markdown, "첫째\n둘째", "clicking the same marker again removes it");

result = toggle("1) 첫째\n2) 둘째", [[1, 1], [2, 3]], "circle");
assert.strictEqual(result.markdown, "① 첫째\n② 둘째", "another marker replaces the existing marker");

result = toggle("한 줄", [[1, 2], [1, 2]], "bullet");
assert.strictEqual(result.markdown, "- 한 줄", "current line is formatted without a selection");

result = toggle("예. 일반 문장", [[1, 1], [1, 1]], "paren");
assert.strictEqual(result.markdown, "1) 예. 일반 문장", "ordinary Korean sentences are not mistaken for markers");

console.log("ALL PASS (notebook line prefix toggle)");
