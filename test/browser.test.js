// Load the core files the way the web page does (no `module`, globals on `self`)
// and check they give the same answer as the Node CLI on the same logs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const os = require("node:os");

function browserCore() {
  const self = {};
  const ctx = vm.createContext({ self, console, Date, JSON, Math, Object, Array, String, Number, RegExp, isNaN, Set, Map });
  for (const f of ["parse.js", "stats.js", "roast.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/core", f), "utf8"), ctx, { filename: f });
  return self;
}

test("browser globals are defined", () => {
  const B = browserCore();
  assert.equal(typeof B.VWParse.parseClaude, "function");
  assert.equal(typeof B.VWStats.computeStats, "function");
  assert.equal(typeof B.VWRoast.computeRoast, "function");
});

test("browser path == CLI path on the same logs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vw-b-"));
  const cl = path.join(tmp, ".claude"), cx = path.join(tmp, ".codex");
  fs.mkdirSync(path.join(cl, "projects", "p"), { recursive: true });
  fs.mkdirSync(path.join(cx, "sessions", "2026"), { recursive: true });
  const claudeLog = [
    { sessionId: "s1", cwd: "/Users/me/app", type: "user", timestamp: "2026-04-01T23:30:00Z", message: { content: "不对，为什么？？" } },
    { sessionId: "s1", cwd: "/Users/me/app", type: "assistant", timestamp: "2026-04-01T23:30:05Z", message: { id: "m", model: "claude-opus-5-5", usage: { input_tokens: 5, output_tokens: 9 }, content: [{ type: "text", text: "Sorry! Done." }, { type: "tool_use", name: "Edit" }] } },
  ];
  const codexLog = [
    { timestamp: "2026-04-02T10:00:00Z", type: "session_meta", payload: { id: "c", cwd: "/Users/me" } },
    { timestamp: "2026-04-02T10:00:01Z", type: "event_msg", payload: { type: "task_started" } },
    { timestamp: "2026-04-02T10:00:02Z", type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "搞定" }] } },
  ];
  const hist = [{ display: "继续", timestamp: Date.parse("2026-04-03T10:00:00Z"), sessionId: "gone", project: "/Users/me/old" }];
  const chist = [{ session_id: "c", ts: Date.parse("2026-04-02T10:00:01Z") / 1000, text: "继续" }];
  const w = (f, recs) => fs.writeFileSync(f, recs.map((r) => JSON.stringify(r)).join("\n"));
  w(path.join(cl, "projects", "p", "s1.jsonl"), claudeLog);
  w(path.join(cl, "history.jsonl"), hist);
  w(path.join(cx, "sessions", "2026", "rollout-c.jsonl"), codexLog);
  w(path.join(cx, "history.jsonl"), chist);

  // CLI path
  const { parseClaude } = require("../src/claude");
  const { parseCodex } = require("../src/codex");
  const { computeStats } = require("../src/core/stats");
  const { collectPrompts, collectReplies, computeRoast } = require("../src/roast");
  const c = parseClaude(path.join(cl, "projects")), x = parseCodex(path.join(cx, "sessions"));
  const cli = computeStats({ sessions: [...c.sessions, ...x.sessions], prompts: [...c.prompts, ...x.prompts] }, { year: 2026 });
  cli.roast = computeRoast(collectPrompts(cl, cx), collectReplies(cl, cx), { year: 2026 });

  // Browser path: same files, read as text like the picker does
  const B = browserCore();
  const asFiles = (recs, p) => [{ path: p, records: B.VWParse.parseJsonl(recs.map((r) => JSON.stringify(r)).join("\n")) }];
  const bc = B.VWParse.parseClaude(asFiles(claudeLog, "projects/p/s1.jsonl"), hist);
  const bx = B.VWParse.parseCodex(asFiles(codexLog, "sessions/2026/rollout-c.jsonl"));
  const web = B.VWStats.computeStats({ sessions: bc.sessions.concat(bx.sessions), prompts: bc.prompts.concat(bx.prompts) }, { year: 2026 });
  web.roast = B.VWRoast.computeRoast(B.VWParse.promptTexts(hist, chist), B.VWParse.replyTexts(asFiles(claudeLog, "a"), asFiles(codexLog, "b")), { year: 2026 });

  assert.deepEqual(JSON.parse(JSON.stringify(web)), JSON.parse(JSON.stringify(cli)));
  assert.equal(web.prompts, 3);
  assert.deepEqual(web.topProjects.map((p) => p.name).sort(), ["app", "old", "~"].sort());
  assert.equal(web.roast.ai.sorry, 1);
});

test("built web page has the CSP and all the code inline", () => {
  require("child_process").execFileSync(process.execPath, [path.join(__dirname, "../scripts/build-web.js")]);
  const html = fs.readFileSync(path.join(__dirname, "../docs/index.html"), "utf8");
  assert.match(html, /Content-Security-Policy" content="default-src 'none'/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  for (const g of ["VWParse", "VWStats", "VWRoast", "VWReport", "VW_DEMO", "showDirectoryPicker"]) assert.ok(html.includes(g), g);
});

test("share link round-trips the report without project names or daily history", async () => {
  const { computeStats } = require("../src/core/stats");
  const { demoData, demoRoast } = require("../src/demo");
  const D = computeStats(demoData(2026), { year: 2026 });
  D.roast = demoRoast();
  // run the page's codec with browser-like globals
  const window = {};
  const ctx = vm.createContext({ window, location: { hash: "" }, document: {}, TextEncoder, TextDecoder, Blob, Response, CompressionStream, DecompressionStream, btoa, atob, Uint8Array, JSON, String, Object, RegExp });
  const src = fs.readFileSync(path.join(__dirname, "../src/page/app.js"), "utf8");
  vm.runInContext(src.slice(0, src.indexOf("/* Report player.")), ctx);
  const url = await window.VWShare.link(D);
  assert.match(url, /^https:\/\/domy-mans\.github\.io\/you-owe-ai\/#s=y[A-Za-z0-9_-]+$/);
  assert.ok(url.length < 600, `link too long: ${url.length}`);
  const back = JSON.parse(JSON.stringify(await window.VWShare.decode(url.split("#s=")[1]))); // copy out of the vm realm
  assert.equal(back.shared, true);
  assert.deepEqual(back.topProjects, []);
  assert.deepEqual(back.days, {});
  // every number a page or a charge uses survives the trip
  for (const k of ["year", "prompts", "sessions", "activeDays", "totalTokens", "toolCalls", "peakHour", "persona"]) assert.equal(back[k], D[k], k);
  assert.ok(Math.abs(back.workHours - D.workHours) < 1e-4, "workHours"); // under a tenth of a cent of wage
  assert.equal(back.streak.days, D.streak.days);
  assert.deepEqual(back.busiestDay, D.busiestDay);
  assert.equal(Math.round(back.shares.night * D.prompts), Math.round(D.shares.night * D.prompts));
  assert.deepEqual(back.categories.map((c) => c.name), D.categories.slice(0, 3).map((c) => c.name));
  assert.equal(back.hours.indexOf(35), D.hours.indexOf(Math.max(...D.hours)));
  for (const k of ["claude", "codex"]) assert.equal(back.byTool[k].prompts, D.byTool[k].prompts);
  const R = D.roast, BR = back.roast;
  for (const k of ["deny", "why", "thanks", "swear", "lost", "whatNext"]) assert.equal(BR.you[k], R.you[k], k);
  assert.deepEqual(BR.ai, R.ai);
  assert.deepEqual(BR.catchphrases, R.catchphrases);
  assert.deepEqual(BR.catchphrases_zh, R.catchphrases_zh);
  assert.deepEqual(BR.angriestDay, R.angriestDay);
  assert.deepEqual(BR.latest, R.latest);
  assert.equal(BR.tinyShare, R.tinyShare);
  // a v1 link made before this change still opens
  const v1 = "z" + Buffer.from(require("zlib").deflateRawSync(Buffer.from(JSON.stringify(window.VWShare.shareable(D))))).toString("base64url");
  const old = JSON.parse(JSON.stringify(await window.VWShare.decode(v1)));
  assert.equal(old.prompts, D.prompts);
  assert.equal(old.shared, true);
});
