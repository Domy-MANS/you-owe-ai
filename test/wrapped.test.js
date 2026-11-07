const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseClaude, isRealPrompt } = require("../src/claude");
const { parseCodex } = require("../src/codex");
const { computeStats, categoryOf, longestStreak } = require("../src/core/stats");
const { renderHtml } = require("../src/render");
const { demoData } = require("../src/demo");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vw-"));
const jsonl = (file, recs) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, recs.map((r) => JSON.stringify(r)).join("\n") + "\n{broken"); };

// --- Claude fixture: 2 prompts, 1 slash command, 1 tool result, a duplicated assistant message ---
const CL = path.join(tmp, "claude");
const base = { sessionId: "s1", cwd: "/work/my-app" };
const usage = { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 100, cache_creation_input_tokens: 5 };
jsonl(path.join(CL, "proj", "s1.jsonl"), [
  { ...base, type: "user", timestamp: "2026-03-01T22:00:00Z", message: { content: "fix the bug" } },
  { ...base, type: "user", timestamp: "2026-03-01T22:00:01Z", message: { content: "<command-name>/clear</command-name>" } },
  { ...base, type: "assistant", timestamp: "2026-03-01T22:00:05Z", message: { id: "m1", model: "claude-opus-5-5", usage, content: [{ type: "thinking" }] } },
  { ...base, type: "assistant", timestamp: "2026-03-01T22:00:06Z", message: { id: "m1", model: "claude-opus-5-5", usage, content: [{ type: "tool_use", name: "Bash" }] } },
  { ...base, type: "user", timestamp: "2026-03-01T22:00:07Z", message: { content: [{ type: "tool_result" }] } },
  { ...base, type: "user", timestamp: "2026-03-02T09:00:00Z", message: { content: [{ type: "text", text: "now add tests" }] } },
  { ...base, type: "system", subtype: "turn_duration", durationMs: 60000, timestamp: "2026-03-02T09:01:00Z" },
  { ...base, type: "user", isSidechain: true, timestamp: "2026-03-02T09:02:00Z", message: { content: "subagent prompt" } },
]);

// history.jsonl sits next to projects/: s1 is already counted from its transcript; s0's transcript was cleaned up
fs.writeFileSync(path.join(CL, "..", "history.jsonl"), [
  { display: "fix the bug", timestamp: Date.parse("2026-03-01T22:00:00Z"), project: "/work/my-app", sessionId: "s1" },
  { display: "old prompt", timestamp: Date.parse("2026-01-05T10:00:00Z"), project: "/work/old-thing", sessionId: "s0" },
  { display: "/clear", timestamp: Date.parse("2026-01-05T10:01:00Z"), project: "/work/old-thing", sessionId: "s0" },
  { display: "another old one", timestamp: Date.parse("2026-01-05T10:05:00Z"), project: "/work/old-thing", sessionId: "s0" },
].map((r) => JSON.stringify(r)).join("\n"));

// --- Codex fixture ---
const CX = path.join(tmp, "codex");
jsonl(path.join(CX, "2026", "03", "02", "rollout-x.jsonl"), [
  { timestamp: "2026-03-02T10:00:00Z", type: "session_meta", payload: { id: "c1", cwd: os.homedir() } },
  { timestamp: "2026-03-02T10:00:01Z", type: "turn_context", payload: { model: "gpt-6-astra" } },
  { timestamp: "2026-03-02T10:00:02Z", type: "event_msg", payload: { type: "task_started" } },
  { timestamp: "2026-03-02T10:00:03Z", type: "response_item", payload: { type: "custom_tool_call", name: "exec" } },
  { timestamp: "2026-03-02T10:00:03Z", type: "response_item", payload: { type: "function_call", name: "wait" } },
  { timestamp: "2026-03-02T10:00:04Z", type: "token_usage_record", payload: { turn_token_usage: { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 50 } } },
  { timestamp: "2026-03-02T10:00:09Z", type: "event_msg", payload: { type: "task_complete", duration_ms: 30000 } },
]);

test("claude: counts real prompts only, dedupes usage per message, skips sidechains", () => {
  const { sessions, prompts } = parseClaude(CL);
  assert.equal(prompts.length, 4); // 2 from transcript + 2 recovered from history (not /clear, not s1 again)
  assert.equal(sessions.length, 2);
  const old = sessions.find((x) => x.id === "s0");
  assert.equal(old.project, "old-thing");
  assert.equal(old.prompts, 2);
  const s = sessions.find((x) => x.id === "s1");
  assert.equal(s.project, "my-app");
  assert.deepEqual(s.tokens, { input: 10, output: 20, cacheRead: 100, cacheWrite: 5 });
  assert.equal(s.tools.Bash, 1);
  assert.equal(s.workMs, 60000);
  assert.equal(isRealPrompt({ type: "user", message: { content: "[Request interrupted by user]" } }), false);
});

test("codex: task_started = prompt, cached tokens split out, home dir shows as ~", () => {
  const { sessions, prompts } = parseCodex(CX);
  assert.equal(prompts.length, 1);
  const s = sessions[0];
  assert.equal(s.project, "~");
  assert.deepEqual(s.tokens, { input: 200, output: 50, cacheRead: 800, cacheWrite: 0 });
  assert.equal(s.models["gpt-6-astra"], 1);
  assert.equal(s.workMs, 30000);
});

test("stats: combines both tools, ignores wait, filters by year", () => {
  const c = parseClaude(CL), x = parseCodex(CX);
  const st = computeStats({ sessions: [...c.sessions, ...x.sessions], prompts: [...c.prompts, ...x.prompts] }, { year: 2026 });
  assert.equal(st.prompts, 5);
  assert.equal(st.byTool.claude.prompts, 4);
  assert.equal(st.byTool.codex.prompts, 1);
  assert.equal(st.toolCalls, 2); // Bash + exec, not wait
  assert.deepEqual(st.categories, [{ name: "shell", count: 2 }]);
  assert.equal(st.totalTokens, 10 + 20 + 100 + 5 + 200 + 50 + 800);
  assert.equal(st.workHours, 90000 / 3600000);
  const other = computeStats({ sessions: [...c.sessions], prompts: [...c.prompts] }, { year: 2025 });
  assert.equal(other.empty, true);
});

test("missing log folders are fine", () => {
  assert.deepEqual(parseClaude(path.join(tmp, "empty", "nope")), { sessions: [], prompts: [] });
  assert.deepEqual(parseCodex(path.join(tmp, "nope")), { sessions: [], prompts: [] });
});

test("categories and streaks", () => {
  assert.equal(categoryOf("apply_patch"), "edit");
  assert.equal(categoryOf("mcp__github__create_pr"), "mcp");
  assert.equal(longestStreak(new Set(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-05"])).days, 3);
});

test("html is self-contained and safe against odd project names", () => {
  const st = computeStats(demoData(2026), { year: 2026 });
  st.topProjects = [{ name: "</script><script>alert(1)</script>", count: 1 }];
  const html = renderHtml(st);
  assert.equal((html.match(/<\/script>/g) || []).length, 2);
  assert.doesNotMatch(html, /src=["']https?:/);
  assert.ok(st.prompts > 500);
});

test("report forbids all network access via CSP", () => {
  const html = renderHtml(computeStats(demoData(2026), { year: 2026 }));
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'none'/);
  assert.doesNotMatch(csp, /https?:/);
});

test("default year: January bills last year if it was busier", () => {
  const { defaultYear } = require("../src/core/stats");
  const at = (iso) => ({ ts: Date.parse(iso) });
  const last = [at("2026-12-01T10:00:00"), at("2026-12-02T10:00:00"), at("2026-11-02T10:00:00")];
  assert.equal(defaultYear([...last, at("2027-01-03T10:00:00")], new Date("2027-01-05T12:00:00")), 2026);
  assert.equal(defaultYear([at("2027-01-03T10:00:00"), at("2027-01-04T10:00:00"), at("2026-12-01T10:00:00")], new Date("2027-01-05T12:00:00")), 2027);
  assert.equal(defaultYear(last, new Date("2027-04-01T12:00:00")), 2027); // spring: always this year
});
