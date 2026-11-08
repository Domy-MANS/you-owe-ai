import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { schema, totals, confess, withdraw, CNY_PER_USD } from "../worker/src/ledger.js";

function ledger() {
  const db = new DatabaseSync(":memory:");
  const run = (q, ...b) => (/^\s*(SELECT)/i.test(q) ? db.prepare(q).all(...b) : (db.prepare(q).run(...b), []));
  schema(run);
  return run;
}
const id = (n) => "browser-id-" + String(n).padStart(8, "0");

test("each browser counts once; a bigger bill later updates it instead of adding a person", () => {
  const run = ledger();
  let r = confess(run, { id: id(1), amount: 100, cur: "usd", via: "folders" }, "ip1", 1000);
  assert.deepEqual([r.n, r.sum, r.order, r.pct], [1, 100, 1, null], "first confessor: no percentile yet");
  r = confess(run, { id: id(2), amount: 400 * CNY_PER_USD / 2, cur: "cny", via: "testimony" }, "ip2", 2000);
  assert.deepEqual([r.n, r.sum, r.order, r.pct], [2, 300, 2, 100], "¥800 = $200 on the bill scale, more than the other one");
  r = confess(run, { id: id(1), amount: 500, cur: "usd", via: "mixed" }, "ip1", 3000);
  assert.deepEqual([r.n, r.sum, r.order, r.pct], [2, 700, 1, 100], "same browser again: updated, keeps its place in line");
});

test("percentile: share of everyone else who owes less", () => {
  const run = ledger();
  for (let i = 0; i < 10; i++) confess(run, { id: id(i), amount: i * 10, cur: "usd" }, "ip" + i, i);
  const r = confess(run, { id: id(99), amount: 55, cur: "usd" }, "ipx", 100);
  assert.equal(r.n, 11);
  assert.equal(r.pct, 60, "6 of the 10 others owe less");
});

test("one bill can't break the clock, and junk is refused", () => {
  const run = ledger();
  assert.equal(confess(run, { id: id(1), amount: 1e12, cur: "usd" }, "a").sum, 20000);
  assert.equal(confess(run, { id: id(2), amount: -1e9, cur: "usd" }, "b").sum, 19500);
  assert.ok(confess(run, { id: "short", amount: 1, cur: "usd" }, "c").error);
  assert.ok(confess(run, { id: id(3), amount: "lots", cur: "usd" }, "c").error);
  assert.ok(confess(run, { id: id(3), amount: 1, cur: "eur" }, "c").error);
  assert.ok(confess(run, { id: "x'; DROP TABLE bills;--abcdefgh", amount: 1, cur: "usd" }, "c").error);
  assert.equal(totals(run).n, 2);
});

test("an IP can add at most 30 new bills a day; updates are always fine", () => {
  const run = ledger();
  const day = Date.parse("2026-11-08T12:00:00Z");
  for (let i = 0; i < 30; i++) assert.ok(!confess(run, { id: id(i), amount: 1, cur: "usd" }, "same", day).error);
  assert.equal(confess(run, { id: id(31), amount: 1, cur: "usd" }, "same", day).error, "slow down");
  assert.ok(!confess(run, { id: id(5), amount: 9, cur: "usd" }, "same", day).error, "updating your own bill");
  assert.ok(!confess(run, { id: id(31), amount: 1, cur: "usd" }, "same", day + 864e5).error, "next day");
  assert.equal(totals(run).n, 31);
});

test("withdrawing removes your bill from the clock", () => {
  const run = ledger();
  confess(run, { id: id(1), amount: 10, cur: "usd" }, "a");
  confess(run, { id: id(2), amount: 20, cur: "usd" }, "b");
  assert.deepEqual(withdraw(run, { id: id(1) }), { n: 1, sum: 20, guilty: 0, refuse: 0 });
});

test("pleas: guilty or refuse, counted; a later report without a plea keeps it", () => {
  const run = ledger();
  confess(run, { id: id(1), amount: 10, cur: "usd" }, "a");
  confess(run, { id: id(2), amount: 10, cur: "usd", plea: "refuse" }, "b");
  confess(run, { id: id(3), amount: 10, cur: "usd", plea: "nonsense" }, "c");
  let t = confess(run, { id: id(1), amount: 12, cur: "usd", plea: "guilty" }, "a");
  assert.deepEqual([t.n, t.guilty, t.refuse], [3, 1, 1]);
  t = confess(run, { id: id(2), amount: 50, cur: "usd" }, "b"); // e.g. imported more chats later
  assert.equal(t.refuse, 1, "plea kept");
  t = confess(run, { id: id(2), amount: 50, cur: "usd", plea: "guilty" }, "b");
  assert.deepEqual([t.guilty, t.refuse], [2, 0], "changed their mind");
});

test("an existing ledger from before pleas upgrades in place", () => {
  const db = new DatabaseSync(":memory:");
  const run = (q, ...b) => (/^\s*(SELECT)/i.test(q) ? db.prepare(q).all(...b) : (db.prepare(q).run(...b), []));
  run("CREATE TABLE bills (id TEXT PRIMARY KEY, usd REAL NOT NULL, cur TEXT, via TEXT, ts INTEGER NOT NULL)");
  run("INSERT INTO bills (id, usd, cur, via, ts) VALUES ('old-browser-id-0001', 5, 'usd', 'mixed', 1)");
  schema(run); schema(run); // twice: the column add is idempotent
  assert.deepEqual(totals(run), { n: 1, sum: 5, guilty: 0, refuse: 0 });
});

test("the README chart: headline numbers, a bar split by plea, and an empty state", async () => {
  const { chartSvg } = await import("../worker/src/chart.js");
  const svg = chartSvg({ n: 12346, sum: 864500, guilty: 3100, refuse: 8200 }, "zh", new Date("2026-11-08T12:00:00Z"));
  for (const s of ["12,346", "¥3,458,000", "73%", "认罪，我还", "就是不还", "3,100", "8,200", "2026-11-08 12:00"]) assert.ok(svg.includes(s), s);
  assert.ok(chartSvg({ n: 3, sum: 10, guilty: 0, refuse: 0 }).includes("No pleas yet"));
  assert.ok(chartSvg({ n: 0, sum: 0, guilty: 0, refuse: 0 }).includes("Be the first"));
  assert.ok(!/undefined|NaN/.test(svg));
});
