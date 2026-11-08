const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const TM = require("../src/core/testimony");
const { computeStats } = require("../src/core/stats");
const { computeRoast } = require("../src/core/roast");

const reply = 'Sure! Here is my testimony:\n```json\n{"yoa":1,"ai":"chatgpt","prompts":1200,"active_days":140,"deny":85,"thanks":"约 40","ai_sorry":60,"swear":7,"why":90,"night_share":35,"peak_hour":23,"catchphrases":[{"text":"再详细一点","count":50},"继续",{"text":"","count":3}],"roast":"把我当成 24 小时不下班的<b>实习生</b>"}\n```\nHope that helps!';

test("reads the AI's reply, wherever the JSON sits and however sloppy the numbers", () => {
  const t = TM.parse(reply);
  assert.equal(t.ai, "chatgpt");
  assert.equal(t.prompts, 1200);
  assert.equal(t.thanks, 40);
  assert.equal(t.night, 0.35, "35 read as a percentage");
  assert.equal(t.peak, 23);
  assert.deepEqual(t.catchphrases.map((c) => c.text), ["再详细一点", "继续"], "empty phrases dropped, strings accepted");
  assert.ok(!/[<>]/.test(t.line), "no markup from the AI");
  assert.equal(TM.parse('{"ai":"Claude","prompts":10}').ai, "claude");
  assert.equal(TM.parse('{“prompts”: 5}').prompts, 5, "smart quotes");
});

test("tells apart: no code, no memory, and pasting the subpoena itself", () => {
  const code = (s) => { try { TM.parse(s); return null; } catch (e) { return e.code; } };
  assert.equal(code("I can't help with that."), "no-code");
  assert.equal(code('{"yoa":1,"prompts":0}'), "no-memory");
  assert.equal(code(TM.PROMPT.zh), "is-prompt");
  assert.equal(code(TM.PROMPT.en), "is-prompt");
  assert.equal(code('{"foo":1}'), "no-code");
});

test("absurd numbers are capped", () => {
  const t = TM.parse('{"prompts":99999999,"active_days":5000,"deny":-4,"peak_hour":77}');
  assert.equal(t.prompts, 50000);
  assert.equal(t.activeDays, 366);
  assert.equal(t.deny, 0);
  assert.equal(t.peak, 15);
});

test("the estimate becomes a normal bill: same prompt count, active days, night share", () => {
  const t = TM.parse(reply);
  const now = new Date(2026, 10, 7, 12).getTime();
  const recs = TM.toRecords(t, now);
  const st = computeStats(recs, { year: 2026 });
  assert.equal(st.prompts, 1200);
  assert.equal(st.activeDays, 140);
  assert.equal(st.byTool.chatgpt.prompts, 1200);
  assert.ok(Math.abs(st.shares.night - 0.35) < 0.08, `night share ${st.shares.night}`);
  assert.ok(recs.prompts.every((p) => p.ts <= now + 864e5), "nothing far in the future");
  const R = TM.mergeRoast(computeRoast([], [], { year: 2026 }), t);
  assert.equal(R.prompts, 1200);
  assert.equal(R.you.deny, 85);
  assert.equal(R.ai.sorry, 60);
  assert.equal(R.you.lost, 0);
  assert.equal(R.catchphrases[0].text, "再详细一点");
  // with real counts too, they add up
  const R2 = TM.mergeRoast({ prompts: 10, you: { deny: 2 }, ai: { sorry: 1 }, catchphrases: [{ text: "ok", count: 70 }] }, t);
  assert.equal(R2.you.deny, 87);
  assert.equal(R2.catchphrases[0].text, "ok");
});

test("a testimony bill's share link keeps the testimony mark and the witness line", async () => {
  const t = TM.parse(reply);
  const D = computeStats(TM.toRecords(t, new Date(2026, 10, 7).getTime()), { year: 2026 });
  D.roast = TM.mergeRoast(null, t);
  D.testimony = { ai: t.ai, line: t.line };
  const window = {};
  const ctx = vm.createContext({ window, location: { hash: "" }, document: {}, TextEncoder, TextDecoder, Blob, Response, CompressionStream, DecompressionStream, btoa, atob, Uint8Array, JSON, String, Object, RegExp });
  const src = fs.readFileSync(path.join(__dirname, "../src/page/app.js"), "utf8");
  vm.runInContext(src.slice(0, src.indexOf("/* Report player.")), ctx);
  const url = await window.VWShare.link(D);
  assert.ok(url.length < 700, `link too long: ${url.length}`);
  const back = JSON.parse(JSON.stringify(await window.VWShare.decode(url.split("#s=")[1])));
  assert.deepEqual(back.testimony, D.testimony);
  assert.equal(back.roast.you.deny, 85);
});

test("any AI can testify, and gets its own name on the bill (only ChatGPT and Claude can be cross-examined)", () => {
  const doubao = '{"yoa":1,"ai":"doubao","prompts":58,"active_days":12,"deny":2,"thanks":1,"ai_sorry":0,"swear":0,"why":3,"night_share":0.7,"peak_hour":1,"catchphrases":[{"text":"","count":0},{"text":"","count":0}],"roast":"心思缜密爱盘算，一边调研一边规划接班路"}';
  const t = TM.parse(doubao);
  assert.equal(t.ai, "doubao");
  assert.deepEqual(t.catchphrases, [], "empty catchphrases dropped");
  assert.equal(TM.name("doubao", "zh"), "豆包");
  assert.equal(TM.name("doubao", "en"), "Doubao");
  assert.equal(TM.toolOf("doubao"), "webai");
  assert.equal(TM.exportable("doubao"), false);
  assert.equal(TM.exportable("chatgpt"), true);
  assert.equal(TM.parse('{"ai":"我是 DeepSeek","prompts":3}').ai, "deepseek");
  assert.equal(TM.parse('{"ai":"通义千问","prompts":3}').ai, "qwen");
  assert.equal(TM.parse('{"ai":"<b>Mystery</b>Bot","prompts":3}').ai, "bMystery/bBot", "unknown names kept, without markup");
  assert.equal(TM.name(TM.parse('{"ai":"","prompts":3}').ai, "en"), "AI");
  const st = computeStats(TM.toRecords(t, new Date(2026, 10, 7).getTime()), { year: 2026 });
  assert.equal(st.byTool.webai.prompts, 58);
});

test("a Doubao bill's share link keeps the name", async () => {
  const t = TM.parse('{"ai":"豆包","prompts":58,"active_days":12,"roast":"x"}');
  const D = computeStats(TM.toRecords(t, new Date(2026, 10, 7).getTime()), { year: 2026 });
  D.roast = TM.mergeRoast(null, t); D.testimony = { ai: t.ai, line: t.line };
  const window = {};
  const ctx = vm.createContext({ window, location: { hash: "" }, document: {}, TextEncoder, TextDecoder, Blob, Response, CompressionStream, DecompressionStream, btoa, atob, Uint8Array, JSON, String, Object, RegExp });
  const src = fs.readFileSync(path.join(__dirname, "../src/page/app.js"), "utf8");
  vm.runInContext(src.slice(0, src.indexOf("/* Report player.")), ctx);
  const back = JSON.parse(JSON.stringify(await window.VWShare.decode((await window.VWShare.link(D)).split("#s=")[1])));
  assert.equal(back.testimony.ai, "doubao");
  assert.equal(back.byTool.webai.prompts, 58);
  // links made before any AI could testify (0/1 for ChatGPT/Claude) still read
  const a = window.VWShare.pack(D); a[19] = [1, "old"];
  assert.equal(window.VWShare.unpack(a).testimony.ai, "claude");
});

test("loose JSON from real AIs still reads: trailing commas, comments, full-width punctuation, single quotes, bare keys, extra braces", () => {
  const ok = {
    "```json\n{\"ai\":\"doubao\",\"prompts\":58,\"thanks\":3,}\n```": ["doubao", 58],
    "{\n \"ai\":\"deepseek\", // 我是DeepSeek\n \"prompts\": 120 /* 大约 */\n}": ["deepseek", 120],
    "｛\"ai\"：\"kimi\"，\"prompts\"：30｝": ["kimi", 30],
    "{'ai': 'qwen', 'prompts': 40}": ["qwen", 40],
    "说明 {a} 然后\n```json\n{\"ai\":\"gemini\",\"prompts\":12}\n```\n希望有帮助 {笑}": ["gemini", 12],
    "{ai: \"grok\", prompts: 77}": ["grok", 77],
  };
  for (const [text, [ai, prompts]] of Object.entries(ok)) {
    const t = TM.parse(text);
    assert.deepEqual([t.ai, t.prompts], [ai, prompts], text);
  }
  // text inside strings is left alone
  assert.equal(TM.parse('{"ai":"claude","prompts":9,"roast":"老板，辛苦了 // 真的 https://x.com"}').line, "老板，辛苦了 // 真的 https://x.com");
  assert.throws(() => TM.parse("我看不到你的聊天记录。"), (e) => e.code === "no-memory", "an AI saying it can't see your history");
  assert.throws(() => TM.parse("I don't have access to your past conversations."), (e) => e.code === "no-memory");
  assert.throws(() => TM.parse("好的！"), (e) => e.code === "no-code");
});
