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
