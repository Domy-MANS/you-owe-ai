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
