/**
 * The AI debt clock: one row per browser, holding only that bill's total.
 * Storage-agnostic: `run(sql, ...params)` returns rows (Durable Object SQLite in production,
 * node:sqlite in the tests).
 *
 * Amounts are kept in "bill dollars". The Chinese bill is priced in yuan at about four
 * times the English rates (McDonald's hourly pay vs US minimum wage), so ¥ = $ × 4 here.
 * It's a bill exchange rate, not a currency rate: the same person lands in the same place
 * whichever language they read in.
 */
export const CNY_PER_USD = 4;
const MAX = 20000, MIN = -500; // one bill can't move the total much; nobody owes AI a fortune
const PER_IP_PER_DAY = 30;
const VIA = new Set(["testimony", "import", "folders", "mixed"]);

export function schema(run) {
  run("CREATE TABLE IF NOT EXISTS bills (id TEXT PRIMARY KEY, usd REAL NOT NULL, cur TEXT, via TEXT, ts INTEGER NOT NULL)");
  run("CREATE INDEX IF NOT EXISTS bills_usd ON bills (usd)");
  run("CREATE TABLE IF NOT EXISTS ipday (k TEXT PRIMARY KEY, n INTEGER NOT NULL)");
}

export function totals(run) {
  const r = run("SELECT COUNT(*) AS n, COALESCE(SUM(usd), 0) AS sum FROM bills")[0];
  return { n: Number(r.n), sum: Math.round(Number(r.sum)) };
}

/** Adds (or updates) one browser's bill. Returns the totals and where this bill stands. */
export function confess(run, body, ipKey, now = Date.now()) {
  const id = String(body && body.id || "");
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(id)) return { error: "bad id" };
  const cur = body.cur === "cny" ? "cny" : body.cur === "usd" ? "usd" : null;
  const amount = Number(body.amount);
  if (!cur || !Number.isFinite(amount)) return { error: "bad amount" };
  const via = VIA.has(body.via) ? body.via : "mixed";
  const usd = Math.max(MIN, Math.min(MAX, cur === "cny" ? amount / CNY_PER_USD : amount));

  const old = run("SELECT ts FROM bills WHERE id = ?", id)[0];
  if (old) run("UPDATE bills SET usd = ?, cur = ?, via = ? WHERE id = ?", usd, cur, via, id);
  else {
    // a light brake on scripted spam: new bills per IP (hashed) per day
    const day = new Date(now).toISOString().slice(0, 10), k = ipKey + ":" + day;
    const used = run("SELECT n FROM ipday WHERE k = ?", k)[0];
    if (used && Number(used.n) >= PER_IP_PER_DAY) return { error: "slow down", ...totals(run) };
    run("INSERT INTO ipday (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1", k);
    if (Math.random() < 0.01) run("DELETE FROM ipday WHERE k NOT LIKE ?", "%:" + day);
    run("INSERT INTO bills (id, usd, cur, via, ts) VALUES (?, ?, ?, ?, ?)", id, usd, cur, via, now);
  }
  const ts = old ? Number(old.ts) : now;
  const t = totals(run);
  const below = Number(run("SELECT COUNT(*) AS c FROM bills WHERE usd < ?", usd)[0].c);
  const order = Number(run("SELECT COUNT(*) AS c FROM bills WHERE ts < ? OR (ts = ? AND id <= ?)", ts, ts, id)[0].c);
  // share of everyone else who owes less than you
  const pct = t.n > 1 ? Math.floor((below / (t.n - 1)) * 100) : null;
  return { ...t, order, pct };
}

export function withdraw(run, body) {
  const id = String(body && body.id || "");
  if (/^[A-Za-z0-9_-]{16,40}$/.test(id)) run("DELETE FROM bills WHERE id = ?", id);
  return totals(run);
}
