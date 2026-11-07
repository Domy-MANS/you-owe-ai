// A duplicate key in a string table silently replaces the earlier one. That broke the folder
// buttons once ("copied" was both a function and a string). Scan every zh/en table for repeats.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/** Top-level keys of the object literal that starts at `open` (index of "{"). Skips strings and nesting. */
function keysOf(src, open) {
  const keys = []; let depth = 0, i = open;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; } continue; }
    if (c === "{" || c === "(" || c === "[") { depth++; continue; }
    if (c === "}" || c === ")" || c === "]") { depth--; if (depth === 0) break; continue; }
    if (depth === 1) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i, i + 60));
      const prev = src.slice(Math.max(0, i - 1), i);
      if (m && /[\s,{]/.test(prev)) { keys.push(m[1]); i += m[1].length; }
    }
  }
  return keys;
}

test("no duplicate keys in any zh/en string table", () => {
  const files = ["web/picker.js", "web/call.js", "src/page/app.js"];
  let tables = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    for (const m of src.matchAll(/^\s+(zh|en): \{\s*$/gm)) {
      const keys = keysOf(src, m.index + m[0].indexOf("{"));
      const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
      assert.deepEqual(dup, [], `${f} ${m[1]} table repeats: ${dup.join(", ")}`);
      tables++;
    }
  }
  assert.ok(tables >= 6, `found ${tables} tables`);
});
