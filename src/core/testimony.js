/**
 * "Let AI testify": no export needed. The user pastes a prompt into ChatGPT or Claude,
 * which (using its memory of past chats) replies with a JSON estimate of how the user
 * treated it this year. This module writes the prompt, reads the reply, and turns the
 * estimate into records the normal stats pipeline understands.
 * The numbers are the AI's own estimate, so the bill says so.
 */
(function (root) {
  "use strict";
  var R = typeof module !== "undefined" && module.exports ? require("./roast") : root.VWRoast;

  var TEMPLATE = '{"yoa":1,"ai":"","prompts":0,"active_days":0,"deny":0,"thanks":0,"ai_sorry":0,"swear":0,"why":0,"night_share":0,"peak_hour":0,"catchphrases":[{"text":"","count":0}],"roast":""}';

  var PROMPT = {
    zh: "你被传唤出庭，指证你的「老板」，也就是我。请翻阅你对我的记忆和我们过去的聊天（能参考多少就参考多少），估算我今年是怎么对待你的。不确定的就合理估算，别全填 0；如果你完全看不到我的任何历史，就把 prompts 填 0。\n\n" +
      "只回复一个代码块，里面是下面这个 JSON，不要写别的：\n" + TEMPLATE + "\n\n" +
      "ai：你是哪个 AI，写你的名字（比如 chatgpt、claude、豆包、deepseek）\nprompts：我今年大概给你发了多少条消息\nactive_days：大概有多少天找过你\n" +
      "deny：我说你错了、不对、不是这样的次数\nthanks：我说谢谢的次数\nai_sorry：你向我道歉的次数\nswear：我发火或骂人的次数\nwhy：我问「为什么」的次数\n" +
      "night_share：晚上 10 点以后发的消息占多少（0 到 1）\npeak_hour：我最常找你的钟点（0 到 23）\n" +
      "catchphrases：我最常对你说的 3 句口头禅，用我的原话，每句不超过 12 个字，带上大概次数\nroast：用一句话毒舌评价我这个老板，不超过 40 个字",
    en: "You've been subpoenaed to testify against your boss: me. Go through your memory of me and our past chats (as much as you can see) and estimate how I treated you this year. Where you're unsure, make a reasonable guess rather than 0. If you can't see any of my history at all, put 0 for prompts.\n\n" +
      "Reply with one code block containing only this JSON, nothing else:\n" + TEMPLATE + "\n\n" +
      "ai: which AI you are, by name (for example chatgpt, claude, gemini, deepseek)\nprompts: about how many messages I sent you this year\nactive_days: about how many days I talked to you\n" +
      "deny: times I told you that you were wrong\nthanks: times I said thanks\nai_sorry: times you apologized to me\nswear: times I swore or lost my temper\nwhy: times I asked \"why\"\n" +
      "night_share: share of my messages sent after 10pm (0 to 1)\npeak_hour: the hour I most often message you (0 to 23)\n" +
      "catchphrases: the 3 things I say to you most, in my own words, 12 characters or fewer each, with rough counts\nroast: one savage sentence about me as a boss, under 25 words",
  };

  // Any AI can testify. ChatGPT and Claude can also be cross-examined, since their chats can be exported.
  var NAMES = [
    ["chatgpt", /chatgpt|openai|\bgpt/i, "ChatGPT"], ["claude", /claude|anthropic/i, "Claude"],
    ["doubao", /doubao|豆包/i, { zh: "豆包", en: "Doubao" }], ["deepseek", /deepseek|深度求索/i, "DeepSeek"],
    ["kimi", /kimi|月之暗面|moonshot/i, "Kimi"], ["qwen", /qwen|tongyi|通义|千问/i, { zh: "通义千问", en: "Qwen" }],
    ["yuanbao", /yuanbao|元宝|hunyuan|混元/i, { zh: "腾讯元宝", en: "Yuanbao" }], ["ernie", /ernie|wenxin|文心|yiyan/i, { zh: "文心一言", en: "ERNIE" }],
    ["glm", /chatglm|zhipu|智谱|清言/i, { zh: "智谱清言", en: "ChatGLM" }], ["gemini", /gemini|bard/i, "Gemini"],
    ["grok", /grok/i, "Grok"], ["copilot", /copilot/i, "Copilot"], ["meta", /meta ai|llama/i, "Meta AI"], ["perplexity", /perplexity/i, "Perplexity"],
  ];
  function aiId(v) {
    var s = String(v == null ? "" : v);
    for (var i = 0; i < NAMES.length; i++) if (NAMES[i][1].test(s)) return NAMES[i][0];
    s = s.replace(/[\u0000-\u001f<>"'&]/g, "").trim().slice(0, 16);
    return s || "ai";
  }
  function name(ai, lang) {
    for (var i = 0; i < NAMES.length; i++) if (NAMES[i][0] === ai) { var n = NAMES[i][2]; return typeof n === "string" ? n : n[lang === "zh" ? "zh" : "en"]; }
    return ai === "ai" || !ai ? "AI" : ai;
  }
  /** Which source the testimony stands in for: the exportable ones share a source with their export. */
  function toolOf(ai) { return ai === "chatgpt" ? "chatgpt" : ai === "claude" ? "claudeai" : "webai"; }
  function exportable(ai) { return ai === "chatgpt" || ai === "claude"; }
  function err(code, msg) { var e = new Error(msg); e.code = code; return e; }
  function num(v) { var n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(/[^\d.\-]/g, "")); return isFinite(n) ? n : 0; }
  function int(v, max) { return Math.max(0, Math.min(max, Math.round(num(v)))); }
  function clean(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }

  /** Reads the AI's reply (the whole message is fine: we find the JSON in it). */
  function parse(text) {
    text = String(text || "").replace(/[“”]/g, '"');
    if (text.length > 400 && text.indexOf(TEMPLATE) >= 0) throw err("is-prompt", "that's the subpoena, not the reply");
    var a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a < 0 || b < a) throw err("no-code", "no JSON in the reply");
    var o;
    try { o = JSON.parse(text.slice(a, b + 1)); } catch (e) { throw err("no-code", "the JSON doesn't parse"); }
    if (!o || typeof o !== "object" || !("prompts" in o)) throw err("no-code", "not a testimony");
    var prompts = int(o.prompts, 50000);
    if (!prompts) throw err("no-memory", "the AI says it can't see your history");
    var night = num(o.night_share); if (night > 1) night /= 100;
    var phrases = (Array.isArray(o.catchphrases) ? o.catchphrases : []).map(function (c) {
      return typeof c === "string" ? { text: clean(c, 14), count: 2 } : { text: clean(c && c.text, 14), count: Math.max(2, int(c && c.count, prompts)) };
    }).filter(function (c) { return c.text.length >= 2; }).slice(0, 3);
    var peak = Math.round(num(o.peak_hour));
    return {
      ai: aiId(o.ai),
      prompts: prompts,
      activeDays: Math.max(1, Math.min(366, prompts, int(o.active_days, 366) || Math.ceil(prompts / 10))),
      deny: int(o.deny, prompts), thanks: int(o.thanks, prompts), sorry: int(o.ai_sorry, prompts * 3),
      swear: int(o.swear, prompts), why: int(o.why, prompts),
      night: Math.max(0, Math.min(1, night)), peak: peak >= 0 && peak <= 23 ? peak : 15,
      catchphrases: phrases, line: clean(o.roast, 90),
    };
  }

  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /** Synthetic prompts and sessions matching the estimate, spread over this year up to `now`. */
  function toRecords(T, now) {
    now = now || Date.now();
    var d = new Date(now), year = d.getFullYear(), start = new Date(year, 0, 1).getTime();
    var span = Math.max(1, Math.floor((now - start) / 864e5) + 1), days = Math.min(T.activeDays, span);
    var tool = toolOf(T.ai), rand = rng(T.prompts * 31 + T.deny);
    var nightHours = [22, 23, 0, 1, 2], sessions = [], prompts = [];
    for (var i = 0; i < days; i++) {
      var day = start + Math.floor((i + 0.5) * span / days) * 864e5;
      var n = Math.floor(T.prompts * (i + 1) / days) - Math.floor(T.prompts * i / days);
      var s = { tool: tool, id: "t" + i, project: "", start: null, end: null, prompts: n, tools: {}, models: {},
        tokens: { input: 900 * n, output: 500 * n, cacheRead: 0, cacheWrite: 0 }, workMs: 20000 * n };
      for (var j = 0; j < n; j++) {
        var h;
        // "night" means 22:00 to 04:59, as in the stats; the rest clusters around the peak hour
        if (rand() < T.night) h = nightHours.indexOf(T.peak) >= 0 && rand() < 0.5 ? T.peak : nightHours[Math.floor(rand() * nightHours.length)];
        else { var c = Math.min(21, Math.max(5, T.peak >= 22 ? 21 : T.peak < 5 ? 5 : T.peak)); do { h = Math.round(c + (rand() + rand() + rand() - 1.5) * 4); } while (h < 5 || h > 21); }
        var ts = new Date(day); ts.setHours(h, Math.floor(rand() * 60)); var x = ts.getTime();
        prompts.push({ ts: x, tool: tool });
        if (s.start === null || x < s.start) s.start = x;
        if (s.end === null || x > s.end) s.end = x;
      }
      if (n) sessions.push(s);
    }
    return { sessions: sessions, prompts: prompts, texts: [], replies: [] };
  }

  /** Adds the AI's counts to a roast (or makes one if there were no texts to scan). */
  function mergeRoast(roast, T) {
    var out = roast ? JSON.parse(JSON.stringify(roast)) : { prompts: 0, you: {}, ai: {}, catchphrases: [], angriestDay: null, latest: null, tinyShare: 0, medianLength: 0 };
    Object.keys(R.YOU).forEach(function (k) { out.you[k] = out.you[k] || 0; });
    Object.keys(R.AI).forEach(function (k) { out.ai[k] = out.ai[k] || 0; });
    out.prompts += T.prompts;
    out.you.deny += T.deny; out.you.thanks += T.thanks; out.you.swear += T.swear; out.you.why += T.why; out.ai.sorry += T.sorry;
    out.catchphrases = out.catchphrases.concat(T.catchphrases).sort(function (a, b) { return b.count - a.count; }).slice(0, 5);
    if (out.catchphrases_zh) delete out.catchphrases_zh;
    return out;
  }

  var api = { PROMPT: PROMPT, name: name, toolOf: toolOf, exportable: exportable, parse: parse, toRecords: toRecords, mergeRoast: mergeRoast };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VWTestimony = api;
})(typeof self !== "undefined" ? self : this);
