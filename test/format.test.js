const test = require("node:test");
const assert = require("node:assert/strict");
const { fmt, money, ord, am } = require("../src/core/format");
const { demoData } = require("../src/demo");

test("counts: units in both languages, rounding up into the next unit", () => {
  const zh = [9999, 10000, 12345, 99999, 100000, 999999, 99999999, 1e8, 999999999, 1.5e9].map((n) => fmt(n, "zh"));
  assert.deepEqual(zh, ["9,999", "1.0万", "1.2万", "10万", "10万", "100万", "1.0亿", "1.0亿", "10亿", "15亿"]);
  const en = [9999, 10000, 12345, 999999, 1e6, 9999999, 999999999, 1.5e9].map((n) => fmt(n, "en"));
  assert.deepEqual(en, ["9,999", "10K", "12K", "1.0M", "1.0M", "10.0M", "1.0B", "1.5B"]);
  assert.equal(fmt(undefined, "en"), "0");
  assert.equal(fmt("42", "zh"), "42");
});

test("money: ¥ to one decimal under ¥10, $ to the cent, never -$0.00", () => {
  assert.equal(money(6, "zh"), "¥6");
  assert.equal(money(0.44, "zh"), "¥0.4");
  assert.equal(money(8459.4, "zh"), "¥8,459");
  assert.equal(money(-5, "zh"), "-¥5");
  assert.equal(money(8459.4, "en"), "$8,459.40");
  assert.equal(money(-1, "en"), "-$1.00");
  assert.equal(money(-0.001, "en"), "$0.00");
});

test("ordinals and after-midnight times", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 41, 101, 111, 112, 188].map(ord),
    ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "41st", "101st", "111th", "112th", "188th"]);
  assert.equal(am("0:12"), "12:12 am");
  assert.equal(am("4:54"), "4:54 am");
});

test("the demo stops at the cutoff and the days before it never change", () => {
  const short = demoData(2026, new Date(2026, 5, 1)), long = demoData(2026, new Date(2026, 8, 1));
  assert.ok(short.prompts.every((p) => p.ts < new Date(2026, 5, 1).getTime()));
  assert.deepEqual(long.prompts.slice(0, short.prompts.length), short.prompts);
  assert.ok(demoData(2026, new Date(2026, 0, 20)).prompts.length > 0, "a January demo isn't empty");
});
