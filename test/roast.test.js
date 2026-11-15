const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { collectPrompts, collectReplies, computeRoast, isCatchphrase } = require("../src/roast");

const at = (s) => Date.parse(s);
const P = (text, when) => ({ ts: at(when), text });

test("counts moods, catchphrases, angriest day and latest night", () => {
  const prompts = [
    P("不对，还是不行", "2026-10-07T10:00:00"),
    P("还是不行", "2026-10-07T11:00:00"),
    P("然后呢", "2026-10-08T12:00:00"),
    P("然后呢", "2026-10-09T12:00:00"),
    P("谢谢", "2026-10-09T13:00:00"),
    P("为什么？？", "2026-10-09T14:00:00"),
    P("1", "2026-10-09T15:00:00"),
    P("1", "2026-10-09T15:01:00"),
    P("[Image #1]", "2026-10-09T15:02:00"),
    P("[Image #1]", "2026-10-09T15:03:00"),
    P("fix it pls", "2026-08-11T04:54:00"),
    P("too early", "2026-08-11T03:00:00"),
    P("last year", "2025-12-31T23:00:00"),
  ];
  const replies = [{ ts: at("2026-10-07T10:01:00"), text: "Sorry, you're absolutely right. Done ✅" }];
  const r = computeRoast(prompts, replies, { year: 2026 });
  assert.equal(r.prompts, 12);
  assert.equal(r.you.deny, 2); // "还是不行" contains "不行"
  assert.equal(r.you.again, 2);
  assert.equal(r.you.thanks, 1);
  assert.equal(r.you.please, 1);
  assert.equal(r.you.why, 1);
  assert.equal(r.you.whatNext, 2);
  assert.deepEqual(r.ai, { sorry: 1, flatter: 1, done: 1 });
  assert.deepEqual(r.catchphrases, [{ text: "然后呢", count: 2 }]); // not "1", not "[image #1]"
  assert.deepEqual(r.angriestDay, { date: "2026-10-07", count: 2 });
  assert.deepEqual(r.latest, { time: "4:54", day: "2026-08-11" });
});

test("no prompts that year -> null", () => {
  assert.equal(computeRoast([P("hi", "2025-01-01T10:00:00")], [], { year: 2026 }), null);
});

test("catchphrase filter", () => {
  assert.equal(isCatchphrase("继续"), true);
  assert.equal(isCatchphrase("2"), false);
  assert.equal(isCatchphrase("[pasted text #1 +40 lines]"), false);
  assert.equal(isCatchphrase("https://x.com"), false);
  assert.equal(isCatchphrase("this one is way too long to be a catchphrase"), false);
});

test("collects from both history files, skips slash commands", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vw-roast-"));
  const cl = path.join(tmp, "claude"), cx = path.join(tmp, "codex");
  fs.mkdirSync(path.join(cl, "projects", "p"), { recursive: true });
  fs.mkdirSync(path.join(cx, "sessions"), { recursive: true });
  fs.writeFileSync(path.join(cl, "history.jsonl"), [
    JSON.stringify({ display: "继续", timestamp: at("2026-05-01T10:00:00"), sessionId: "a" }),
    JSON.stringify({ display: "/clear", timestamp: at("2026-05-01T10:01:00"), sessionId: "a" }),
  ].join("\n"));
  fs.writeFileSync(path.join(cx, "history.jsonl"), JSON.stringify({ session_id: "b", ts: at("2026-05-02T10:00:00") / 1000, text: "然后呢" }));
  fs.writeFileSync(path.join(cl, "projects", "p", "s.jsonl"), JSON.stringify({ type: "assistant", timestamp: "2026-05-01T10:00:01Z", message: { content: [{ type: "text", text: "Done" }, { type: "thinking", thinking: "x" }] } }));
  assert.deepEqual(collectPrompts(cl, cx).map((p) => p.text), ["继续", "然后呢"]);
  assert.deepEqual(collectReplies(cl, cx).map((r) => r.text), ["Done"]);
});

test("the counts mean what the bill says: ordinary questions and everyday phrases aren't charged", () => {
  const { YOU, AI } = require("../src/core/roast");
  const hit = (k, s) => YOU[k].test(s);
  // told AI it was wrong
  for (const s of ["不对", "这不对吧", "不是这样的", "不行，重来", "你搞错了", "这个没用", "没用啊", "No, use the other file", "nope", "that's wrong", "that's not what I asked", "it doesn't work", "this is not working", "not right"])
    assert.ok(hit("deny", s), "deny: " + s);
  for (const s of ["对不对？", "这样行不行", "我没用过这个库", "no problem", "no worries, take your time", "there is no config file", "左右不对称", "怎么部署"])
    assert.ok(!hit("deny", s), "not deny: " + s);
  // lost
  for (const s of ["我不知道怎么办", "看不懂", "啥意思", "这是什么意思", "没看懂", "I'm confused", "I don't understand this", "no idea what this does", "i'm stuck"])
    assert.ok(hit("lost", s), "lost: " + s);
  for (const s of ["怎么部署到服务器", "会不会有性能问题", "配置文件在哪", "how to deploy this", "how do I add a test", "how can we speed this up"])
    assert.ok(!hit("lost", s), "not lost: " + s);
  // swearing
  for (const s of ["卧槽", "我去，又挂了", "我去", "太离谱了", "wtf", "what the fuck", "damn"]) assert.ok(hit("swear", s), "swear: " + s);
  for (const s of ["我去看看日志", "我去年写的代码", "等我去问一下"]) assert.ok(!hit("swear", s), "not swear: " + s);
  // "still" and "again" alone are just words
  for (const s of ["还是不行", "又报错了", "still not working", "still broken", "not again", "same error"]) assert.ok(hit("again", s), "again: " + s);
  for (const s of ["try again with the other model", "I still need the tests", "run it again"]) assert.ok(!hit("again", s), "not again: " + s);
  // thanks, and the AI's apologies
  for (const s of ["谢谢", "多谢", "辛苦了", "thanks!", "thank u", "ty"]) assert.ok(hit("thanks", s), "thanks: " + s);
  assert.ok(!hit("thanks", "empty the cache"));
  for (const s of ["Sorry about that", "对不起，我看错了", "这是我的错", "I apologize", "I was wrong about that"]) assert.ok(AI.sorry.test(s), "sorry: " + s);
});
