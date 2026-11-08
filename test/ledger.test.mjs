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
  assert.deepEqual(withdraw(run, { id: id(1) }), { n: 1, sum: 20 });
});
