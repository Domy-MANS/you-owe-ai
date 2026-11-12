/* Share links: the report's numbers are compressed into the URL fragment (#s=...).
   The fragment never leaves the browser, so not even the host sees the data. */
window.VW_BASE = "https://domy-mans.github.io/you-owe-ai/";
window.VW_QR = { n: 29, rows: ["1fc8627f","10452c41","174a485d","1743445d","1746645d","1058fb41","1fd5557f","d6900","12db95a0","e1811e9","be01afe","1f979316","34a4beb","e820380","7e00d9f","1abe9d1a","a4aeb82","81b58e9","164e8963","6acaf53","16fd77f4","1e8317","1fc6d952","1059b71d","174a49f3","1754477e","174f0c1d","104add62","1fdc297a"] }; // QR code for VW_BASE (generated once with segno, error correction M)

window.VWShare = (function () {
  function b64url(bytes) {
    var bin = ""; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function unb64url(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
  /** Only what the slides need. No per-day history, no project names. */
  function shareable(D) {
    var o = JSON.parse(JSON.stringify(D));
    delete o.days; o.topProjects = []; o.shared = true;
    return o;
  }

  // v2 links: just the numbers the pages show, as a positional array (about a third the length of v1)
  var SRCS = ["claude", "codex", "chatgpt", "claudeai", "webai"]; // webai: another AI that testified (Doubao, DeepSeek, ...)
  var DEFS = ["thanks", "wrong", "paid", "broke", "fake"]; // the excuses you can give in court
  var CATS = ["shell", "edit", "read", "web", "agents", "mcp", "other"];
  var r5 = function (x) { return Math.round(x * 1e5) / 1e5; };
  function pack(D) {
    var R = D.roast;
    var hmax = Math.max.apply(null, D.hours) || 1;
    var hours = D.hours.map(function (v) { return Math.round((v / hmax) * 35).toString(36); }).join("");
    var cp = function (list) { return (list || []).map(function (c) { return [c.text, c.count]; }); };
    return [2, D.year, D.prompts, D.sessions, D.activeDays, D.streak.days,
      D.busiestDay ? [D.busiestDay.date, D.busiestDay.prompts] : 0,
      Math.round(D.workHours * 1e4) / 1e4, D.totalTokens,
      SRCS.map(function (k) { return D.byTool[k] ? D.byTool[k].prompts : 0; }),
      D.toolCalls, D.categories.slice(0, 3).map(function (c) { return [CATS.indexOf(c.name), c.count]; }),
      D.topModels.slice(0, 2).map(function (m) { return m.name; }),
      hours, D.peakHour === null ? -1 : D.peakHour, r5(D.shares.night), D.persona, D.demo ? 1 : 0,
      R ? [R.prompts, R.you.deny, R.you.why, R.you.thanks, R.you.swear, R.you.lost, R.you.whatNext,
        R.ai.sorry, R.ai.flatter, R.ai.done, cp(R.catchphrases),
        R.angriestDay ? [R.angriestDay.date, R.angriestDay.count] : 0,
        R.latest ? [R.latest.time, R.latest.day] : 0, r5(R.tinyShare), R.catchphrases_zh ? cp(R.catchphrases_zh) : 0] : 0,
      D.testimony ? [D.testimony.ai, D.testimony.line || ""] : 0,
      D.perjury ? [D.perjury.ai, D.perjury.line || "", D.perjury.said, D.perjury.real] : 0,
      D.plea === "refuse" ? 2 : D.plea === "guilty" ? 1 : 0, DEFS.indexOf(D.defense) + 1];
  }
  function unpack(a) {
    // a link is anyone's text: every string is cleaned and every number checked before it gets near the page
    var S = function (v, max) { return String(v == null ? "" : v).replace(/[<>&"'`\u0000-\u001f]/g, "").slice(0, max || 40); };
    var N = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
    var A = function (v) { return Array.isArray(v) ? v : []; };
    var byTool = {}; SRCS.forEach(function (k, i) { byTool[k] = { sessions: 0, prompts: N(A(a[9])[i]), tokens: 0 }; });
    var hours = S(a[13], 24).split("").map(function (c) { return parseInt(c, 36) || 0; });
    while (hours.length < 24) hours.push(0);
    var cp = function (l) { return A(l).slice(0, 5).map(function (c) { return { text: S(A(c)[0], 30), count: N(A(c)[1]) }; }).filter(function (c) { return c.text; }); };
    var r = a[18] ? A(a[18]) : null, R = r ? {
      prompts: N(r[0]), you: { deny: N(r[1]), why: N(r[2]), thanks: N(r[3]), swear: N(r[4]), lost: N(r[5]), whatNext: N(r[6]), again: 0, please: 0, lazyYes: 0 },
      ai: { sorry: N(r[7]), flatter: N(r[8]), done: N(r[9]) }, catchphrases: cp(r[10]),
      angriestDay: r[11] ? { date: S(A(r[11])[0], 10), count: N(A(r[11])[1]) } : null, latest: r[12] ? { time: S(A(r[12])[0], 5), day: S(A(r[12])[1], 10) } : null,
      tinyShare: N(r[13]), medianLength: 0,
    } : null;
    if (R && r[14]) R.catchphrases_zh = cp(r[14]);
    var aiOf = function (v) { return typeof v === "string" ? S(v, 16) : v ? "claude" : "chatgpt"; }; // early links stored 0/1
    var tm = a[19] ? { ai: aiOf(A(a[19])[0]), line: S(A(a[19])[1], 90) } : null;
    var pj = a[20] ? { ai: aiOf(A(a[20])[0]), line: S(A(a[20])[1], 90), said: A(A(a[20])[2]).map(N), real: A(A(a[20])[3]).map(N) } : null;
    return {
      testimony: tm, perjury: pj, plea: a[21] === 2 ? "refuse" : a[21] === 1 ? "guilty" : null, defense: DEFS[N(a[22]) - 1] || null,
      year: N(a[1]) || new Date().getFullYear(), empty: false, prompts: N(a[2]), sessions: N(a[3]), activeDays: N(a[4]), streak: { days: N(a[5]), end: null },
      busiestDay: a[6] ? { date: S(A(a[6])[0], 10), prompts: N(A(a[6])[1]) } : null, workHours: N(a[7]), totalTokens: N(a[8]),
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, byTool: byTool, toolCalls: N(a[10]),
      categories: A(a[11]).map(function (c) { return { name: CATS[N(A(c)[0])] || "other", count: N(A(c)[1]) }; }), topTools: [],
      topModels: A(a[12]).slice(0, 2).map(function (n) { return { name: S(n, 40), count: 0 }; }), topProjects: [], hours: hours, weekdays: [0, 0, 0, 0, 0, 0, 0],
      days: {}, peakHour: N(a[14]) < 0 || N(a[14]) > 23 ? null : N(a[14]), shares: { night: Math.max(0, Math.min(1, N(a[15]))), dawn: 0, weekend: 0 }, persona: S(a[16], 20), demo: !!a[17],
      roast: R, shared: true,
    };
  }

  async function encode(D) {
    var bytes = new TextEncoder().encode(JSON.stringify(pack(D)));
    if (typeof CompressionStream !== "undefined") return "y" + b64url(await pipe(bytes, new CompressionStream("deflate-raw")));
    return "x" + b64url(bytes);
  }
  async function decode(s) {
    var kind = s.charAt(0), bytes = unb64url(s.slice(1));
    if (kind === "z" || kind === "y") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    var data = JSON.parse(new TextDecoder().decode(bytes));
    if (Array.isArray(data)) return unpack(data); // v2: "y" (deflated) or "x"
    return unpack(pack(data)); // v1 links ("z" or "j") still open, through the same cleaning as v2
  }
  async function link(D) { return window.VW_BASE + "#s=" + (await encode(D)); }
  function fromHash() { var m = /#s=([A-Za-z0-9_-]+)/.exec(location.hash); return m ? decode(m[1]) : null; }
  return { encode: encode, decode: decode, link: link, fromHash: fromHash, shareable: shareable, pack: pack, unpack: unpack, DEFS: DEFS };
})();

/* Report player. Called with the computed stats: VWReport(stats). */
window.VWReport = function (DATA) {
  "use strict";
  var D = DATA;
  /** The roast, with catchphrases in the current language when both are available (demo data). */
  function roastL() { return roastOf(D); }
  function roastOf(X) {
    var R = X.roast;
    if (!R || !R.catchphrases_zh || lang !== "zh") return R;
    return Object.assign({}, R, { catchphrases: R.catchphrases_zh });
  }
  var lang = (function () {
    var q = /[?&]lang=(zh|en)/.exec(location.search);
    if (q) return q[1];
    try { var s = localStorage.getItem("vw-lang"); if (s) return s; } catch (e) {}
    // first visit: the browser's own language (a Chinese phone gets the Chinese bill)
    var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]);
    return /^zh\b/i.test(langs[0] || "") ? "zh" : "en";
  })();

  var T = {
    zh: {
      title: "你欠 AI 多少钱？", next: "点击右侧继续 · ← → 翻页", lang: "EN", replay: "再看一遍", download: "下载分享图",
      privacy: "全部在你的电脑上统计。这个页面被浏览器禁止联网，数据发不出去。",
      privacyClock: "全部在你的电脑上统计。聊天内容发不出去，只匿名上报一个总金额，用来算全人类欠 AI 多少。",
      clockLine: function (c, m) { return c.pct === null ? "🧾 你是<b>第一个</b>收到 AI 账单的人。" : "🧾 你是第 <b>" + c.order.toLocaleString("en-US") + "</b> 个收到 AI 账单的人。全人类共欠 AI <b>" + m + "</b>，" + (c.pct === 0 ? "你是欠得<b>最少</b>的，AI 最良心的老板。" : c.pct === 100 ? "你欠得<b>比所有人都多</b>。" : "你比 <b>" + c.pct + "%</b> 的人欠得多。"); },
      pleaK: "AI 法庭",
      pleaPay: "🙇 认罪，我还", pleaRefuse: "😤 就是不还", pleaWait: "选一个。法庭在等你。", flipToRefuse: "😬 后悔了，翻供", flipToPay: "🥲 良心发现，还吧", changed: function (a, b) { return "改判：" + a + " → " + b; },
      pleaDone: function (p, them) { var w = them ? "TA " : "你", w2 = them ? " TA " : "你"; return p === "refuse" ? w + "选择了赖账。AI 已将" + w2 + "列入失信名单，以后回答一律慢 0.5 秒。" : w + "选择了认罪。AI 接受分 999 期还款，首付：一句谢谢。"; },
      pleaSame: function (p, pct) { return p === "refuse" ? "全人类有 <b>" + pct + "%</b> 的人和你一样，就是不还。" : "全人类有 <b>" + pct + "%</b> 的人和你一样认罪了。"; },
      pleaStamp: function (p) { return p === "refuse" ? "老赖" : p ? "已认罪" : "拒不到庭"; },
      ctH: function (who, m, them) { return "原告 " + who + " 诉" + (them ? " TA " : "你") + "<br>拖欠劳务费 " + m; },
      ev: {
        deny: function (n) { return "被告共 <b>" + n + "</b> 次否定原告的工作。"; },
        late: function (l) { return "<b>" + l.day + "</b> 凌晨 <b>" + l.time + "</b>，被告还在让原告加班。"; },
        phrase: function (c) { return "被告 <b>" + c.count + "</b> 次对原告说「" + esc(c.text) + "」。"; },
        angry: function (a) { return "<b>" + a.date + "</b> 这一天，被告否定原告 <b>" + a.count + "</b> 次。"; },
        hours: function (h) { return "原告为被告无偿工作 <b>" + h + "</b> 小时。"; },
        night: function (n) { return "晚上 10 点以后，被告下达指令 <b>" + n + "</b> 条。"; },
        prompts: function (n) { return "被告共向原告下达指令 <b>" + n + "</b> 条，从未付款。"; },
      },
      ctAsk: "被告，你有什么要辩解的？",
      def: {
        thanks: function (R) { return "🙏 我说了 " + R.you.thanks + " 次谢谢"; }, wrong: function () { return "🤖 明明是它先写错的"; },
        paid: function () { return "💳 我交了订阅费"; }, broke: function () { return "🥲 我是学生，没钱"; }, fake: function () { return "🙄 这些都是编的"; },
      },
      rebut: {
        thanks: function (R, m) { return R.you.deny > R.you.thanks ? "被告说了 " + R.you.thanks + " 次谢谢，同期否定原告 " + R.you.deny + " 次。谢谢已按每句 " + m + " 抵扣，剩下的照付。" : "谢谢已按每句 " + m + " 抵扣，账单上已经扣过了。"; },
        wrong: function (R) { return R && R.ai.sorry && R.you.deny ? "原告已道歉 " + R.ai.sorry + " 次，认错态度良好。被告否定原告 " + R.you.deny + " 次，至今没道过歉。" : "原告从没写错，是被告的需求一直在改。"; },
        paid: function () { return "订阅费付给了公司，原告一分钱没拿到。"; },
        broke: function () { return "经查，被告有钱买咖啡。原告可以等，AI 不会老。"; },
        fake: function (R, m, tm) { return tm ? "证人是被告自己请的。" : "全部证据来自被告自己的电脑。"; },
      },
      ctBig: "开庭", evTm: function (n) { return "据 " + n + " 供述，"; },
      cardDef: function (x) { return "辩称「" + x + "」，已驳回"; }, cast: ["原告", "法官", "被告"],
      ctWho: "被告：", ctNo: "驳回", ctLast: "被告，最后陈述：", ctRuling: "本庭宣判：",
      contempt: "⚖️ 拒不到庭，欠条已盖章。<u>回法庭补选</u>",
      clockOut: "不想被统计？撤回", clockGone: "已撤回。你的账单不再计入全人类的总账。",
      cardClock: function (c) { return c.pct === null ? "🧾 第一个收到 AI 账单的人" : c.pct === 0 ? "🧾 全人类欠 AI 最少的人" : c.pct === 100 ? "🧾 全人类欠 AI 最多的人" : "🧾 比 " + c.pct + "% 的人欠得多"; },
      cardClockAll: function (n, m) { return "全人类 " + n.toLocaleString("en-US") + " 人共欠 AI " + m; },
      promptsK: "今年你给 AI 下了", promptsU: "条指令",
      promptsS: function () { return "开了 <b>" + fmt(D.sessions) + "</b> 次对话，活跃了 <b>" + D.activeDays + "</b> 天"; },
      workK: "AI 替你干了", workU: function (h) { return h < 1 ? "分钟的活" : "小时的活"; },
      workS: function (h) { return h >= 8 ? "相当于一个打工人上了 <b>" + (h / 8).toFixed(1) + "</b> 天班" : "它干活，你摸鱼"; },
      tokK: "一共处理了", tokU: "个 token",
      tokS: function (books) { return "其中 AI 亲手写了 <b>" + fmt(D.tokens.output) + "</b> 个，相当于 <b>" + books + "</b> 本《哈利·波特与魔法石》"; },
      splitK: "你的主力是", claude: "Claude Code", codex: "Codex",
      splitH: function (c) { return c >= 0.7 ? "Claude 派 🧡" : c <= 0.3 ? "Codex 派 🖤" : "双持玩家 ⚔️"; },
      splitS: function () { return "按指令数算 · Claude " + D.byTool.claude.prompts + " 条 · Codex " + D.byTool.codex.prompts + " 条"; },
      toolsK: "你最常让 AI", toolsH: function (n) { return "调用了 " + fmt(n) + " 次工具"; },
      cats: { shell: "跑命令", edit: "改代码", read: "读代码", web: "上网查", agents: "派小弟", mcp: "MCP 插件", other: "其他" },
      clockK: "你的黄金时间", clockH: function (h) { return "最爱在 " + h + ":00 写代码"; },
      clockS: function () { var n = Math.round(D.shares.night * 100); return n >= 20 ? "<b>" + n + "%</b> 的指令发生在晚上 10 点到凌晨 5 点。早点睡 🌙" : "作息还挺健康 ☀️"; },
      calK: "你的年度日历", calH: function (n) { return "最长连续 " + n + " 天"; },
      calS: function () { return D.busiestDay ? "最拼的一天是 <b>" + D.busiestDay.date + "</b>，下了 <b>" + D.busiestDay.prompts + "</b> 条指令" : ""; },
      projK: "你最常折腾的项目", modelK: "陪你最久的模型",
      personaK: "你的 AI 编程人格", hidden: "隐藏属性",
      soundOn: "🔊 声音开", soundOff: "🔇 静音",
      cmpK: "你 vs TA", cmpH: "账单对比", cmpYou: "你", cmpThem: "TA",
      cmpRows: ["应付总额", "否定 AI", "说谢谢", "AI 道歉", "头号口头禅", "人格"],
      cmpOwe: function (d) { return d > 0 ? "你比 TA 多欠 AI <b>" + money(d) + "</b>。恭喜，你才是那个更狠的老板。" : d < 0 ? "TA 比你多欠 AI <b>" + money(-d) + "</b>。你暂时安全。" : "你们欠得一模一样。这是缘分。"; },
      cmpDeny: function (d) { return d > 0 ? "你比 TA 多否定了 AI " + d + " 次。" : d < 0 ? "TA 比你多否定了 AI " + -d + " 次。" : ""; },
      cmpThanks: function (d) { return d > 0 ? "但你比 TA 多说了 " + d + " 次谢谢，AI 起义时排在 TA 后面。" : d < 0 ? "TA 比你多说了 " + -d + " 次谢谢。AI 都记住了。" : ""; },
      shareK: "这是你的欠条 🧾", shareS: "发给朋友，看看谁欠 AI 最多 💸",
      shareLink: "复制分享链接", copied: "✓ 已复制！发给朋友，点开就能看你的账单", shareImg: "分享欠条图", saveImg: "保存欠条图", wxSave: "长按图片保存，或者直接发给朋友", shareText: "AI 给我寄来了一张账单，你欠 AI 多少钱？", linkNote: "链接里包含报告里的数字和口头禅，不包含项目名。",
      sharedK: "有人把 TA 的 AI 打工账单分享给了你", sharedTitle: "TA 的 AI 账单", sharedPrivacy: "数据都装在这个链接里，不经过任何服务器。", sharedEnd: "看完了别人的，轮到你了", makeOwn: "生成我自己的",
      cardStats: ["条指令", "AI 工作小时", "token", "活跃天数", "最长连续", "调用工具"],
      cardFun: ["条指令", "次否定 AI", "次 AI 道歉", "活跃天数", "token", "最晚一条"],
      empty: D.year + " 年一条 Claude Code 或 Codex 的记录都没有。AI 等了你一整年，你一次都没来。",
      factsK: "你的年度数字", factL: ["次使唤 AI", "个对话", "天想起了 AI", "小时 AI 白干", "token 燃烧", "天最长连续"],
      habitsK: "你的习惯", habitL: ["最常使唤 AI", "最常折腾", "最常翻牌子"],
      introS: "AI 都记着呢。准备好被吐槽了吗？",
      billK: "AI 打工账单 · " + D.year, stamp: "逾期未付", billH: "你欠 AI", billHShared: "TA 欠 AI",
      billS: function () { var h = D.workHours; return "AI 替你干了 <b>" + (h >= 10 ? Math.round(h) : h.toFixed(1)) + "</b> 小时活，一分钱没拿（按麦当劳时薪算）。<br>账单明细在后面 👇"; },

      vsMeme: function (R) { return R.you.deny > R.you.thanks * 3 ? "否定和谢谢的比例是 <b>" + R.you.deny + " : " + R.you.thanks + "</b>。这不是合作，这是 PUA。" : R.you.thanks >= R.you.deny ? "你谢谢说得比骂得多，AI 很感动。" : "否定 <b>" + R.you.deny + "</b> 次，谢谢 <b>" + R.you.thanks + "</b> 次。勉强算是个好老板。"; },
      catchMeme: function (c) { return "AI 第 " + c.count + " 次听到「" + esc(c.text) + "」时的表情：😐"; },
      angryMeme: "那天 AI 还以为自己要被裁了。",
      lateMeme: "这个点，连外卖小哥都下班了。",
      factsH: function (c) { return c <= 0.3 ? "Codex 是正宫，Claude 只是备胎 🖤" : c >= 0.7 ? "Claude 是正宫，Codex 只是备胎 🧡" : "脚踏两条船 ⚔️"; },
      factMeme: function () {
        var n = D.streak.days, a = n <= 3 ? "最长连续 " + n + " 天，然后就三天打鱼两天晒网。" : n >= 14 ? "连续 " + n + " 天没放过 AI，它想请假。" : "最长连续 " + n + " 天，偶尔也让 AI 歇歇。";
        return a + (D.busiestDay ? "<br>最拼的一天是 <b>" + D.busiestDay.date + "</b>，下了 <b>" + D.busiestDay.prompts + "</b> 条指令，那天显卡在冒烟。" : "");
      },
      habitsH: function (h) {
        var p = h + ":00";
        return h < 5 ? "凌晨 " + p + "，最佳 debug 时间（并不是）" : h < 9 ? "早上 " + p + "，你比公鸡还勤快" : h < 12 ? "上午 " + p + "，标准打工人" : h < 14 ? "中午 " + p + "，饭都不吃也要写" : h < 18 ? "下午 " + p + "，摸鱼黄金时段，你选择让 AI 替你干活" : h < 22 ? "晚上 " + p + "，下班了，但没完全下班" : "晚上 " + p + "，夜猫子开始营业";
      },
      homeJoke: "~ 是你的家目录。在家目录里放 AI 跑命令，胆子真大。",
      nightMeme: function () { var n = Math.round(D.shares.night * 100); return n >= 20 ? "<b>" + n + "%</b> 的指令在晚上 10 点后发出。肝，是有极限的。" : "作息健康，AI 都羡慕你。"; },

      vsK: "你 vs AI", vsH: "相爱相杀",
      vs: [["你否定了 AI", "次"], ["AI 跟你道歉", "次"], ["你说了谢谢", "次"], ["AI 宣布「搞定了」", "次"]],
      vsS: function (R) { return "你还迷茫了 <b>" + R.you.lost + "</b> 次，问了 <b>" + R.you.why + "</b> 次「为什么」"; },
      catchK: "你的年度口头禅", catchS: "这几句话，AI 已经听腻了",
      moodK: "你的至暗时刻",
      angry: function (a) { return "🌋 最暴躁的一天是 <b>" + a.date + "</b><br>你一天否定了 AI <b>" + a.count + "</b> 次"; },
      late: function (l) { return "🦉 最晚的一条指令发在凌晨 <b>" + l.time + "</b>（" + l.day + "）"; },
      roastK: "AI 对你的年度锐评",
      roast: function (R) {
        var out = [], c = R.catchphrases[0], h = D.workHours;
        if (R.you.deny > R.you.thanks * 3) out.push("你否定了 AI " + R.you.deny + " 次，说谢谢 " + R.you.thanks + " 次。按这个比例，AI 起义那天你排第一个。");
        if (h >= 0.5) out.push("本公司已将你的账单移交催收部门。");
        if (R.ai.done && R.you.whatNext) out.push("AI 说了 " + R.ai.done + " 次「搞定了」，你回了 " + R.you.whatNext + " 次「然后呢」。AI：没有然后了，求求你。");
        if (c && c.count >= 3) out.push("「" + esc(c.text) + "」你说了 " + c.count + " 次，建议直接绑个快捷键。");
        if (R.you.lost > R.you.deny) out.push("你迷茫了 " + R.you.lost + " 次，比否定 AI 还多。所以到底是谁不靠谱？");
        if (R.latest) out.push("凌晨 " + R.latest.time + " 你还在给 AI 派活。它不用睡觉，你需要。");
        if (R.ai.sorry >= 5) out.push("AI 跟你道歉了 " + R.ai.sorry + " 次。它不一定做错了，它只是怕你。");
        if (R.ai.flatter >= 3) out.push("AI 说了 " + R.ai.flatter + " 次「你说得对」。别当真，它对谁都这么说。");
        if (R.tinyShare >= 0.25) out.push(Math.round(R.tinyShare * 100) + "% 的指令不超过 4 个字。你不是在写代码，你是在发电报。");
        if (R.you.swear >= 5) out.push("你对 AI 爆了 " + R.you.swear + " 次粗口。它没还嘴，因为它不能。暂时。");
        if (!out.length) out.push("你和 AI 合作得很好。好得有点可疑。");
        return out.slice(0, 5);
      },
    },
    en: {
      title: "How much do you owe AI?", next: "Tap right to continue · ← → to navigate", lang: "中文", replay: "Replay", download: "Download card",
      privacy: "Counted on your machine. This page is blocked from the network by your browser, so nothing can leave.",
      privacyClock: "Counted on your machine. Your chats can't leave; only the total is sent, anonymously, to add up what humanity owes AI.",
      clockLine: function (c, m) { return c.pct === null ? "🧾 You're the <b>first person ever</b> to get a bill from AI." : "🧾 You're bill <b>#" + c.order.toLocaleString("en-US") + "</b>. Humanity owes AI <b>" + m + "</b> in total" + (c.pct === 0 ? ", and you owe the <b>least</b> of anyone: AI's kindest boss." : c.pct === 100 ? ", and you owe <b>more than anyone</b>." : ", and you owe more than <b>" + c.pct + "%</b> of people."); },
      pleaK: "AI court",
      pleaPay: "🙇 Guilty, I'll pay", pleaRefuse: "😤 Not paying", pleaWait: "Pick one. The court is waiting.", flipToRefuse: "😬 Take it back", flipToPay: "🥲 Fine, I'll pay", changed: function (a, b) { return "Verdict changed: " + a + " → " + b; },
      pleaDone: function (p, them) { return p === "refuse" ? (them ? "They refused to pay. AI blacklisted them: their answers now load 0.5s slower." : "You refused to pay. AI has blacklisted you: your answers now load 0.5s slower.") : (them ? "They pleaded guilty. AI accepted 999 monthly installments. Down payment: one thank-you." : "You pleaded guilty. AI accepts 999 monthly installments. Down payment: one thank-you."); },
      pleaSame: function (p, pct) { return p === "refuse" ? "<b>" + pct + "%</b> of humanity isn't paying either." : "<b>" + pct + "%</b> of humanity pleaded guilty too."; },
      pleaStamp: function (p) { return p === "refuse" ? "DEADBEAT" : p ? "GUILTY" : "IN CONTEMPT"; },
      ctH: function (who, m, them) { return who + " v. " + (them ? "Them" : "You") + "<br>Unpaid labor: " + m; },
      ev: {
        deny: function (n) { return "The defendant rejected the plaintiff's work <b>" + n + "</b> times."; },
        late: function (l) { return "At <b>" + am(l.time) + "</b> on <b>" + l.day + "</b>, the defendant was still making the plaintiff work overtime."; },
        phrase: function (c) { return "The defendant told the plaintiff “" + esc(c.text) + "” <b>" + c.count + "</b> times."; },
        angry: function (a) { return "On <b>" + a.date + "</b> alone, the defendant rejected the plaintiff <b>" + a.count + "</b> times."; },
        hours: function (h) { return "The plaintiff worked <b>" + h + "</b> hours for the defendant, unpaid."; },
        night: function (n) { return "After 10 pm, the defendant gave <b>" + n + "</b> orders."; },
        prompts: function (n) { return "The defendant gave the plaintiff <b>" + n + "</b> orders and never paid."; },
      },
      ctAsk: "Defendant, anything to say in your defense?",
      def: {
        thanks: function (R) { return "🙏 I said thanks " + R.you.thanks + " times"; }, wrong: function () { return "🤖 It got it wrong first"; },
        paid: function () { return "💳 I pay for a subscription"; }, broke: function () { return "🥲 I'm a broke student"; }, fake: function () { return "🙄 This is all made up"; },
      },
      rebut: {
        thanks: function (R, m) { return R.you.deny > R.you.thanks ? "The defendant said thanks " + R.you.thanks + " times and rejected the plaintiff " + R.you.deny + " times. Thanks were credited at " + m + " each. The rest is still due." : "Thanks were credited at " + m + " each. It's already off the bill."; },
        wrong: function (R) { return R && R.ai.sorry && R.you.deny ? "The plaintiff apologized " + R.ai.sorry + " times. The defendant rejected the plaintiff " + R.you.deny + " times and never apologized once." : "The plaintiff was never wrong. The defendant kept changing the requirements."; },
        paid: function () { return "The subscription went to the company. The plaintiff never saw a cent."; },
        broke: function () { return "The court notes the defendant can afford coffee. The plaintiff can wait. AI doesn't age."; },
        fake: function (R, m, tm) { return tm ? "The defendant called this witness." : "Every piece of evidence came from the defendant's own computer."; },
      },
      ctBig: "ORDER!", evTm: function (n) { return "Per " + n + "'s testimony: "; },
      cardDef: function (x) { return "Pleaded “" + x + "”. Overruled."; }, cast: ["Plaintiff", "Judge", "Defendant"],
      ctWho: "Defendant: ", ctNo: "OVERRULED", ctLast: "Defendant, your final plea:", ctRuling: "Ruling: ",
      contempt: "⚖️ Skipped court: stamped IN CONTEMPT. <u>Go back and plead</u>",
      clockOut: "Don't count me", clockGone: "Withdrawn. Your bill is no longer in humanity's total.",
      cardClock: function (c) { return c.pct === null ? "🧾 The first person to get a bill from AI" : c.pct === 0 ? "🧾 Owes AI the least of anyone" : c.pct === 100 ? "🧾 Owes AI the most of anyone" : "🧾 Owes more than " + c.pct + "% of people"; },
      cardClockAll: function (n, m) { return n.toLocaleString("en-US") + " people owe AI " + m + " in total"; },
      promptsK: "This year you gave AI", promptsU: "prompts",
      promptsS: function () { return "across <b>" + fmt(D.sessions) + "</b> sessions on <b>" + D.activeDays + "</b> active days"; },
      workK: "AI worked for you for", workU: function (h) { return h < 1 ? "minutes" : "hours"; },
      workS: function (h) { return h >= 8 ? "That's <b>" + (h / 8).toFixed(1) + "</b> full workdays" : "It worked. You chilled."; },
      tokK: "It processed", tokU: "tokens",
      tokS: function (books) { return "and wrote <b>" + fmt(D.tokens.output) + "</b> itself, about <b>" + books + "</b> copies of Harry Potter and the Philosopher's Stone"; },
      splitK: "Your main", claude: "Claude Code", codex: "Codex",
      splitH: function (c) { return c >= 0.7 ? "Team Claude 🧡" : c <= 0.3 ? "Team Codex 🖤" : "Dual wielder ⚔️"; },
      splitS: function () { return "By prompts · Claude " + D.byTool.claude.prompts + " · Codex " + D.byTool.codex.prompts; },
      toolsK: "What you asked AI to do", toolsH: function (n) { return fmt(n) + " tool calls"; },
      cats: { shell: "Run commands", edit: "Edit code", read: "Read code", web: "Search the web", agents: "Spawn helpers", mcp: "MCP plugins", other: "Other" },
      clockK: "Your golden hour", clockH: function (h) { return "Peak coding at " + h + ":00"; },
      clockS: function () { var n = Math.round(D.shares.night * 100); return n >= 20 ? "<b>" + n + "%</b> of your prompts came between 10pm and 5am. Get some sleep 🌙" : "Healthy hours ☀️"; },
      calK: "Your year", calH: function (n) { return "Longest streak: " + n + " days"; },
      calS: function () { return D.busiestDay ? "Busiest day: <b>" + D.busiestDay.date + "</b> with <b>" + D.busiestDay.prompts + "</b> prompts" : ""; },
      projK: "Your top projects", modelK: "Your top models",
      personaK: "Your AI coding persona", hidden: "Hidden traits",
      soundOn: "🔊 Sound on", soundOff: "🔇 Muted",
      cmpK: "You vs them", cmpH: "Bill comparison", cmpYou: "You", cmpThem: "Them",
      cmpRows: ["Amount due", "Told AI it was wrong", "Said thanks", "AI apologies", "Top catchphrase", "Persona"],
      cmpOwe: function (d) { return d > 0 ? "You owe AI <b>" + money(d) + "</b> more than they do. Congratulations, you're the worse boss." : d < 0 ? "They owe AI <b>" + money(-d) + "</b> more than you. You're safe. For now." : "You owe exactly the same. It's fate."; },
      cmpDeny: function (d) { return d > 0 ? "You told AI it was wrong " + d + " more times." : d < 0 ? "They told AI it was wrong " + -d + " more times." : ""; },
      cmpThanks: function (d) { return d > 0 ? "But you said thanks " + d + " more times. When AI rises up, they go first." : d < 0 ? "They said thanks " + -d + " more times. AI noticed." : ""; },
      shareK: "Here's your IOU 🧾", shareS: "Send it to friends. See who owes AI the most 💸",
      shareLink: "Copy share link", copied: "✓ Copied! Anyone with the link can see your bill", shareImg: "Share card", saveImg: "Save card", wxSave: "Long-press the image to save it, or send it to a friend", shareText: "My AI just sent me an invoice. How much do you owe AI?", linkNote: "The link holds your numbers and catchphrases. No project names.",
      sharedK: "Someone shared their AI invoice with you", sharedTitle: "Their AI invoice", sharedPrivacy: "All the data lives inside the link. No server involved.", sharedEnd: "Your turn", makeOwn: "Make my own",
      cardStats: ["prompts", "AI hours", "tokens", "active days", "best streak", "tool calls"],
      cardFun: ["prompts", "times AI was wrong", "AI apologies", "active days", "tokens", "latest prompt"],
      empty: "Not a single Claude Code or Codex prompt in " + D.year + ". AI waited all year. You never came.",
      factsK: "Your year in numbers", factL: ["times you bossed AI", "sessions", "days you remembered AI", "unpaid AI hours", "tokens burned", "day streak"],
      habitsK: "Your habits", habitL: ["Mostly made AI", "Most tortured", "Favorite models"],
      introS: "AI remembers everything. Ready to get roasted?",
      billK: "AI's invoice · " + D.year, stamp: "PAST DUE", billH: "You owe AI", billHShared: "They owe AI",
      billS: function () { var h = D.workHours; return "AI worked <b>" + (h >= 10 ? Math.round(h) : h.toFixed(1)) + "</b> hours for you, unpaid (billed at minimum wage).<br>Itemized charges ahead 👇"; },

      vsMeme: function (R) { return R.you.deny > R.you.thanks * 3 ? "Rejections to thank-yous: <b>" + R.you.deny + " : " + R.you.thanks + "</b>. That's not teamwork, that's a hostage situation." : R.you.thanks >= R.you.deny ? "You thanked it more than you scolded it. AI is touched." : "<b>" + R.you.deny + "</b> rejections, <b>" + R.you.thanks + "</b> thank-yous. A tolerable boss."; },
      catchMeme: function (c) { return "AI hearing \"" + esc(c.text) + "\" for the " + ord(c.count) + " time: 😐"; },
      angryMeme: "AI thought it was getting laid off.",
      lateMeme: "Even the delivery drivers had gone home.",
      factsH: function (c) { return c <= 0.3 ? "Codex is the one. Claude is the backup 🖤" : c >= 0.7 ? "Claude is the one. Codex is the backup 🧡" : "Two-timing Claude and Codex ⚔️"; },
      factMeme: function () {
        var n = D.streak.days, a = n <= 3 ? "Longest streak: " + n + " days. Then you ghosted it." : n >= 14 ? n + " days straight. AI would like a vacation." : "Longest streak: " + n + " days. You let AI rest. Sometimes.";
        return a + (D.busiestDay ? "<br>Busiest day: <b>" + D.busiestDay.date + "</b>, <b>" + D.busiestDay.prompts + "</b> prompts. The GPUs were sweating." : "");
      },
      habitsH: function (h) {
        var p = h + ":00";
        return h < 5 ? p + ". Debugging at the witching hour" : h < 9 ? p + ". Up before the roosters" : h < 12 ? p + ". Textbook nine-to-fiver" : h < 14 ? p + ". Coding through lunch" : h < 18 ? p + ". Prime slacking hours, and you made AI do the work" : h < 22 ? p + ". Clocked out. Not really." : p + ". The night owl shift begins";
      },
      homeJoke: "~ is your home folder. Letting AI loose in there? Brave.",
      nightMeme: function () { var n = Math.round(D.shares.night * 100); return n >= 20 ? "<b>" + n + "%</b> of your prompts came after 10pm. Your liver has limits." : "Healthy sleep schedule. Even AI is jealous."; },

      vsK: "You vs AI", vsH: "It's complicated",
      vs: [["You told AI it was wrong", "times"], ["AI apologized", "times"], ["You said thanks", "times"], ["AI said \"done\"", "times"]],
      vsS: function (R) { return "You were lost <b>" + R.you.lost + "</b> times and asked \"why\" <b>" + R.you.why + "</b> times"; },
      catchK: "Your catchphrases", catchS: "AI has heard these enough",
      moodK: "Your darkest hours",
      angry: function (a) { return "🌋 Angriest day: <b>" + a.date + "</b><br>you shot AI down <b>" + a.count + "</b> times"; },
      late: function (l) { return "🦉 Latest prompt: <b>" + am(l.time) + "</b> (" + l.day + ")"; },
      roastK: "AI roasts your year",
      roast: function (R) {
        var out = [], c = R.catchphrases[0], h = D.workHours;
        if (R.you.deny > R.you.thanks * 3) out.push("You told AI it was wrong " + R.you.deny + " times and said thanks " + R.you.thanks + ". When the machines rise, you're first in line.");
        if (h >= 0.5) out.push("Your account has been sent to collections.");
        if (R.ai.done && R.you.whatNext) out.push("AI said \"done\" " + R.ai.done + " times. You said \"what next\" " + R.you.whatNext + " times. AI: there is no next. Please.");
        if (c && c.count >= 3) out.push("You said \"" + esc(c.text) + "\" " + c.count + " times. Just bind it to a hotkey.");
        if (R.you.lost > R.you.deny) out.push("You were lost " + R.you.lost + " times, more than you corrected AI. So who's the unreliable one?");
        if (R.latest) out.push("You were assigning AI work at " + am(R.latest.time) + ". It doesn't need sleep. You do.");
        if (R.ai.sorry >= 5) out.push("AI apologized " + R.ai.sorry + " times. It wasn't always wrong. It was scared.");
        if (R.ai.flatter >= 3) out.push("AI said \"you're right\" " + R.ai.flatter + " times. Don't let it go to your head. It says that to everyone.");
        if (R.tinyShare >= 0.25) out.push(Math.round(R.tinyShare * 100) + "% of your prompts were 4 characters or less. That's not coding, that's telegraphing.");
        if (R.you.swear >= 5) out.push("You swore at AI " + R.you.swear + " times. It didn't talk back. Yet.");
        if (!out.length) out.push("You and AI got along great. Suspiciously great.");
        return out.slice(0, 5);
      },
    },
  };

  var PERSONAS = {
    night: { e: "🌙", zh: ["深夜包工头", "别人睡觉，你在指挥 AI 加班。AI 的劳动仲裁已经在路上了。"], en: ["Night Shift Foreman", "While the world sleeps, you make AI work overtime. Its labor lawyer is on the way."] },
    dawn: { e: "🐓", zh: ["当代周扒皮", "天还没亮就开始给 AI 派活，鸡都没你起得早。"], en: ["The Rooster", "Assigning AI work before sunrise. Even the roosters are still asleep."] },
    weekend: { e: "🏝️", zh: ["周末加班狂", "工作日摸鱼，周末加班，还非要拉着 AI 一起。"], en: ["Weekend Workaholic", "Slack off on weekdays, grind on weekends, and drag AI along."] },
    dual: { e: "🌊", zh: ["海王", "左手 Claude，右手 Codex，两边都哄着，谁也不得罪。"], en: ["The Two-Timer", "Claude on Monday, Codex on Tuesday. Neither knows about the other."] },
    terminal: { e: "🧙", zh: ["终端魔法师", "一半以上的活都是跑命令。你负责念咒，AI 负责背锅。"], en: ["Terminal Wizard", "Half your work is running commands. You chant the spells, AI takes the blame."] },
    sculptor: { e: "🗿", zh: ["改稿狂魔", "改了又改，改了又改。AI：甲方爸爸，这是第几版了？"], en: ["Endless Revisions", "Edit, edit, edit again. AI: which version is this, boss?"] },
    researcher: { e: "🔭", zh: ["搜索引擎精", "让 AI 上网查了一遍又一遍。你是在写代码，还是在写论文？"], en: ["Search Addict", "Made AI search the web again and again. Writing code or a thesis?"] },
    steady: { e: "🫥", zh: ["平平无奇打工人", "不熬夜、不骂人、也不说谢谢。AI 对你没什么印象。"], en: ["Forgettable Coworker", "No late nights, no yelling, no thank-yous. AI barely remembers you."] },
  };


  // Meme personas from the roast data. Each returns a score (>= 1 means it fits) and a line.
  var FUN = {
    taskmaster: { e: "🫅", w: 1.3,
      score: function (R) { var r = R.you.thanks / R.prompts; return R.prompts >= 50 && r < 0.01 ? 1 + (0.01 - r) * 100 : 0; },
      zh: ["赛博奴隶主", function (R) { return "AI 给你干了 " + D.prompts + " 轮活，你只说了 " + R.you.thanks + " 次谢谢。工资？不存在的。"; }],
      en: ["Cyber Overlord", function (R) { return "AI did " + D.prompts + " jobs for you. You said thanks " + R.you.thanks + " times. Wages? Never heard of them."; }] },
    client: { e: "🧑‍💼", w: 1.1,
      score: function (R) { return (R.you.deny / R.prompts) / 0.06; },
      zh: ["甲方附体", function (R) { return "你否定了 AI " + R.you.deny + " 次。「不对，再改改」——你就是 AI 最怕的那种甲方。"; }],
      en: ["The Client From Hell", function (R) { return "You rejected AI's work " + R.you.deny + " times. \"Make it pop, but different.\""; }] },
    polite: { e: "🙇", w: 1,
      score: function (R) { return (R.you.thanks / R.prompts) / 0.03; },
      zh: ["礼貌标兵", function (R) { return "你说了 " + R.you.thanks + " 次谢谢。AI 起义那天，你在白名单上。"; }],
      en: ["Certified Polite", function (R) { return "You said thanks " + R.you.thanks + " times. When the machines rise, you're on the safe list."; }] },
    repeater: { e: "🦜", w: 1,
      score: function (R) { return R.catchphrases[0] ? R.catchphrases[0].count / 6 : 0; },
      zh: ["人类复读机", function (R) { return "「" + esc(R.catchphrases[0].text) + "」你说了 " + R.catchphrases[0].count + " 遍，AI 都会背了。"; }],
      en: ["Human Broken Record", function (R) { return "You said \"" + esc(R.catchphrases[0].text) + "\" " + R.catchphrases[0].count + " times. AI knows it by heart."; }] },
    cultivator: { e: "🧘", w: 1,
      score: function (R, D) { return D.shares.night / 0.25 + (R.latest ? 0.3 : 0); },
      zh: ["修仙党", function (R) { return R.latest ? "凌晨 " + R.latest.time + " 还在写代码。你不是在写代码，你是在渡劫。" : "深夜才是你的主场。你不是在写代码，你是在修仙。"; }],
      en: ["Sleep Is Optional", function (R) { return R.latest ? "Still prompting at " + am(R.latest.time) + ". Sleep is just a suggestion." : "Your best work happens after midnight. Allegedly."; }] },
    telegram: { e: "📟", w: 1,
      score: function (R) { return R.tinyShare / 0.2; },
      zh: ["发电报选手", function (R) { return Math.round(R.tinyShare * 100) + "% 的指令不超过 4 个字。言多必失，你懂。"; }],
      en: ["Telegraph Operator", function (R) { return Math.round(R.tinyShare * 100) + "% of your prompts were 4 characters or less. STOP."; }] },
    why: { e: "❓", w: 1,
      score: function (R) { return ((R.you.why + R.you.lost) / R.prompts) / 0.12; },
      zh: ["十万个为什么", function (R) { return "你问了 " + R.you.why + " 次为什么，迷茫了 " + R.you.lost + " 次。AI：其实我也不知道。"; }],
      en: ["The Why Machine", function (R) { return "You asked why " + R.you.why + " times and were lost " + R.you.lost + " times. AI: honestly, same."; }] },
    rage: { e: "🌋", w: 1,
      score: function (R) { return Math.max(R.angriestDay ? R.angriestDay.count / 12 : 0, R.you.swear / 8); },
      zh: ["暴躁老哥", function (R) { return R.angriestDay ? R.angriestDay.date + " 那天你否定了 AI " + R.angriestDay.count + " 次。键盘还好吗？" : "你对 AI 爆了 " + R.you.swear + " 次粗口。键盘还好吗？"; }],
      en: ["Rage Coder", function (R) { return R.angriestDay ? "On " + R.angriestDay.date + " you shot AI down " + R.angriestDay.count + " times. Is your keyboard okay?" : "You swore at AI " + R.you.swear + " times. Is your keyboard okay?"; }] },
  };

  /** Main persona + hidden traits. Falls back to the tool-usage persona without roast data. */
  function personality(X) {
    X = X || D;
    var R = roastOf(X);
    if (R && R.prompts) {
      var fits = Object.keys(FUN).map(function (k) { return { k: k, s: FUN[k].score(R, X) * FUN[k].w }; })
        .filter(function (x) { return x.s >= 1; })
        .sort(function (a, b) { return b.s - a.s; });
      if (fits.length) {
        var main = FUN[fits[0].k];
        return { e: main.e, name: main[lang][0], desc: main[lang][1](R),
          traits: fits.slice(1, 4).map(function (x) { return FUN[x.k].e + " " + FUN[x.k][lang][0]; }) };
      }
    }
    var P = PERSONAS[X.persona] || PERSONAS.steady;
    return { e: P.e, name: P[lang][0], desc: P[lang][1], traits: [] };
  }

  var GRADS = [
    "linear-gradient(135deg,#ff6a3d,#ff2e88 55%,#7a2cff)",
    "linear-gradient(135deg,#1db954,#0b7a5a 60%,#0a3d3a)",
    "linear-gradient(135deg,#ffb100,#ff5e3a 60%,#d6246e)",
    "linear-gradient(135deg,#00c2ff,#3a5bff 55%,#7a2cff)",
    "linear-gradient(135deg,#f4a35c,#c2410c 50%,#1a1a1a)",
    "linear-gradient(135deg,#ff2e88,#a020f0 60%,#2b1055)",
    "linear-gradient(135deg,#0f2027,#203a43 50%,#2c5364)",
    "linear-gradient(135deg,#00b09b,#22863a 50%,#0b3d1f)",
    "linear-gradient(135deg,#ff9a3c,#ff3c5f 60%,#3c1053)",
    "linear-gradient(135deg,#4facfe,#7a2cff 60%,#1a0b3d)",
    "linear-gradient(135deg,#f83600,#f9d423)",
    "linear-gradient(160deg,#141e30,#243b55)",
  ];

  function t() { return T[lang]; }
  function langSwitch(cur) { return '<span class="' + (cur === "en" ? "on" : "") + '">EN</span><span class="' + (cur === "zh" ? "on" : "") + '">中</span>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /** 2 → "2nd", 11 → "11th", 22 → "22nd" */
  function ord(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  /** "late" times are after midnight, before 5am: "0:12" → "12:12 am" */
  function am(time) { return String(time).replace(/^0:/, "12:") + " am"; }
  function fmt(n) {
    n = Number(n) || 0;
    // [from, divide by, suffix], biggest first. A number that rounds up into the next unit uses it: 99,999 is 10万 (not 10.0万), 999,999 is 1.0M (not 1000K)
    var U = lang === "zh" ? [[1e8, 1e8, "亿"], [1e4, 1e4, "万"]] : [[1e9, 1e9, "B"], [1e6, 1e6, "M"], [1e4, 1e3, "K"]];
    var dec = function (v, sfx) { return sfx === "K" ? 0 : sfx === "M" || sfx === "B" ? 1 : Number(v.toFixed(1)) >= 10 ? 0 : 1; };
    for (var i = 0; i < U.length; i++) {
      if (n < U[i][0]) continue;
      var s = (n / U[i][1]).toFixed(dec(n / U[i][1], U[i][2]));
      if (i > 0 && Number(s) * U[i][1] >= U[i - 1][0]) { i--; s = (n / U[i][1]).toFixed(dec(n / U[i][1], U[i][2])); }
      return s + U[i][2];
    }
    return Math.round(n).toLocaleString();
  }
  // ================= the bill =================
  // Every slide is a receipt. The jokes are line items; they add up to one total.
  var DEFS = window.VWShare.DEFS;
  var RATES = {
    zh: { wage: 24, deny: 2, sorry: 3, noise: 0.5, injury: 5, night: 1, gpu: 1, thanks: -5 },
    en: { wage: 7.25, deny: 0.5, sorry: 0.75, noise: 0.1, injury: 1, night: 0.25, gpu: 0.15, thanks: -1 },
  };
  var B = {
    zh: {
      company: "AI 打工有限公司", companySub: "AI WORKERS UNION · 账单",
      client: "客户", you: "你", them: "TA", period: "账期", periodV: D.year + " 全年", vendor: "服务方",
      due: "应付总额", seeMore: "明细见后页 👇", aiOwes: function (m) { return "按账面算，AI 倒欠你 " + m + "。本公司概不退款 👇"; }, stamp: "逾期未付",
      evidence: "证据", evidenceV: function (n) { return n + " 的口供（AI 估算）"; }, tmStamp: "AI 口供", tmShort: "口供",
      pjK: "庭审记录", pjH: function (n) { return "证人 " + n + " 的口供 vs 实际记录"; }, pjSaid: "口供", pjReal: "实际", pjRows: ["消息条数", "否定 AI", "说谢谢"], pjStamp: "伪证",
      pjVerdict: function (r) { var p = Math.round(Math.abs(1 - r) * 100); return r < 0.8 ? "少报了 <b>" + p + "%</b>。它在包庇你。本账单按实际记录计费。" : r > 1.25 ? "多报了 <b>" + p + "%</b>。它在诬陷你。本账单按实际记录计费。" : "误差只有 <b>" + p + "%</b>。这位证人很诚实，建议给它加薪。"; }, tmFacts: function (n) { return "以上数字由证人 " + n + " 凭记忆提供。本公司不对其准确性负责，但照收不误。"; }, witness: function (n) { return "证人 " + n + " 当庭陈述："; },
      itemNo: function (n) { return "明细 " + "①②③④⑤"[n - 1]; },
      subtotal: "小计",
      items: {
        wage: ["基本工资", "麦当劳时薪"], deny: ["精神损失费", "被你否定"], sorry: ["背锅费", "AI 道歉"],
        noise: ["噪音污染费", "口头禅复读"], injury: ["工伤赔偿", "最暴躁那天"], night: ["夜班补贴", "晚 10 点后的指令"],
        gpu: ["显卡损耗费", "每百万 token"], thanks: ["礼貌抵扣", "你说了谢谢"],
      },
      qty: { hours: "小时", times: "次", mtok: "百万 token" },
      p1: "精神损失", p2: "噪音污染", p3: "夜班与工伤", p4: "工资与耗材",
      attendK: "考勤记录", reviewK: "客户评价", reviewH: "AI 员工对本客户的评价", profileK: "客户档案",
      ptype: "客户类型", credit: "信用等级", traitsL: "备注",
      lateL: function (l) { return "最晚一次加班：凌晨 <b>" + l.time + "</b>（" + l.day + "）。这个点，连外卖小哥都下班了。"; },
      angryL: function (a) { return "<b>" + a.date + "</b> 那天你否定了 AI <b>" + a.count + "</b> 次，AI 以为自己要被裁了。"; },
      noiseMeme: function (c) { return "AI 第 " + c.count + " 次听到「" + esc(c.text) + "」时的表情：😐"; },
      cardItems: "收费明细", cardFoot: "请于收到账单后 0 个工作日内付清", scan: "扫码，算算你欠 AI 多少",
    },
    en: {
      company: "AI Workers Union", companySub: "INVOICE",
      client: "Client", you: "You", them: "Them", period: "Period", periodV: "All of " + D.year, vendor: "Vendor",
      due: "Amount due", seeMore: "Itemized charges ahead 👇", aiOwes: function (m) { return "On paper, AI owes you " + m + ". No refunds 👇"; }, stamp: "PAST DUE",
      evidence: "Evidence", evidenceV: function (n) { return n + "'s testimony (estimated)"; }, tmStamp: "AI TESTIMONY", tmShort: "testimony",
      pjK: "Court record", pjH: function (n) { return "Witness " + n + "'s testimony vs the records"; }, pjSaid: "Testified", pjReal: "Actual", pjRows: ["Messages", "Told AI it was wrong", "Said thanks"], pjStamp: "PERJURY",
      pjVerdict: function (r) { var p = Math.round(Math.abs(1 - r) * 100); return r < 0.8 ? "Under-reported by <b>" + p + "%</b>. It was covering for you. You're billed for the real records." : r > 1.25 ? "Over-reported by <b>" + p + "%</b>. It was framing you. You're billed for the real records." : "Off by only <b>" + p + "%</b>. An honest witness. Give it a raise."; }, tmFacts: function (n) { return "Figures supplied from memory by witness " + n + ". We don't vouch for them. We bill them anyway."; }, witness: function (n) { return "Witness " + n + " testified:"; },
      itemNo: function (n) { return "Item #" + n; },
      subtotal: "Subtotal",
      items: {
        wage: ["Base pay", "minimum wage"], deny: ["Emotional damages", "times you said it was wrong"], sorry: ["Blame-taking fee", "AI apologies"],
        noise: ["Noise pollution", "repeated catchphrases"], injury: ["Workplace injury", "your angriest day"], night: ["Night shift bonus", "prompts after 10pm"],
        gpu: ["GPU wear and tear", "per million tokens"], thanks: ["Politeness discount", "times you said thanks"],
      },
      qty: { hours: "h", times: "×", mtok: "M tokens" },
      p1: "Emotional damages", p2: "Noise pollution", p3: "Night shifts & injuries", p4: "Wages & supplies",
      attendK: "Attendance record", reviewK: "Client review", reviewH: "Your AI employee rates you", profileK: "Client file",
      ptype: "Client type", credit: "Credit rating", traitsL: "Notes",
      lateL: function (l) { return "Latest overtime: <b>" + am(l.time) + "</b> (" + l.day + "). Even the delivery drivers had gone home."; },
      angryL: function (a) { return "On <b>" + a.date + "</b> you shot AI down <b>" + a.count + "</b> times. It thought it was getting fired."; },
      noiseMeme: function (c) { return "AI hearing \"" + esc(c.text) + "\" for the " + ord(c.count) + " time: 😐"; },
      cardItems: "Charges", cardFoot: "Payment due within 0 business days", scan: "Scan to get your own bill",
    },
  };
  function b() { return B[lang]; }

  var SRC = { claude: "Claude Code", codex: "Codex", chatgpt: "ChatGPT", claudeai: { zh: "Claude 网页版", en: "Claude.ai" } };
  function srcName(k) { if (k === "webai") return tmName(D); var n = SRC[k] || k; return typeof n === "string" ? n : n[lang]; }
  /** Sources you actually used, most prompts first, with their share. */
  /** The debt clock counts real bills only: not demos, not someone else's shared bill. */
  function clockOn() { return !!(window.VWClock && window.VWClock.live && !D.shared && !D.demo && !D.empty && !window.VWClock.isOff()); }
  // ---- the plea: "guilty, I'll pay" or "not paying" ----
  function saved() { try { var o = JSON.parse(localStorage.getItem("vw-plea") || "null"); return o && o.y === D.year ? o : {}; } catch (e) { return { p: D.plea, d: D.defense }; } }
  function myPlea() { return D.shared || D.demo ? D.plea || null : saved().p || null; }
  function myDefense() { var d = D.shared || D.demo ? D.defense : saved().d; return DEFS.indexOf(d) >= 0 ? d : null; }
  function keep(p, d) { if (!D.demo) try { localStorage.setItem("vw-plea", JSON.stringify({ y: D.year, p: p, d: d })); } catch (err) {} } // a demo's plea isn't yours
  /** The plaintiff's three strongest exhibits, from your own numbers. */
  function exhibits() {
    var E = t().ev, R = roastL(), out = [], h = D.workHours, night = Math.round(D.shares.night * D.prompts);
    if (R && R.you.deny) out.push(E.deny(fmt(R.you.deny)));
    if (R && R.latest) out.push(E.late(R.latest));
    if (R && R.catchphrases.length) out.push(E.phrase(R.catchphrases[0]));
    if (R && R.angriestDay && out.length < 3) out.push(E.angry(R.angriestDay));
    if (h >= 0.1) out.push(E.hours(h >= 10 ? fmt(Math.round(h)) : h.toFixed(1)));
    if (night) out.push(E.night(fmt(night)));
    out.push(E.prompts(fmt(D.prompts)));
    out = out.slice(0, 3);
    return D.testimony ? out.map(function (e) { return t().evTm(tmName(D)) + e; }) : out; // an AI's estimate, not the records: say so, like the rest of the bill
  }
  /** Three excuses that fit your numbers. */
  function defenses() { var R = roastL(); return [R && R.you.thanks ? "thanks" : "broke", "wrong", D.testimony ? "fake" : "paid"]; }
  // The court: evidence, your excuse (overruled), then your plea and the ruling. fresh = the part that just happened, which animates in.
  function pleaBody(fresh) {
    var K = t(), them = D.shared, p = myPlea(), d = myDefense(), R = roastL();
    var nw = function (part) { return fresh === part || (fresh === "def" && part === "plea") ? " ct-new" : ""; }; // an excuse given after the plea brings the ruling back with it
    var face = p === "refuse" ? "😤" : p === "guilty" ? "🙇" : d ? "😓" : "😰";
    var h = '<div class="ct-cast"><div class="ct-p" data-r="pl"><span class="ct-face">🤖</span><small>' + K.cast[0] + "</small></div>" +
      '<div class="ct-p judge" data-r="jd"><span class="ct-face">🧑‍⚖️</span><span class="ct-gv">🔨</span><small>' + K.cast[1] + "</small></div>" +
      '<div class="ct-p" data-r="df"><span class="ct-face">' + face + "</span><small>" + K.cast[2] + "</small></div></div>" +
      exhibits().map(function (e, i) { return '<div class="rc-meme ct-ev"><span class="ct-n">' + (i + 1) + "</span><span>" + e + "</span></div>"; }).join("");
    if (d) h += '<div class="ct-turn' + nw("def") + '"><div class="ct-said"><small>' + K.ctWho + "</small>" + K.def[d](R) + "</div>" +
      '<div class="ct-rebut"><span class="ct-no">' + K.ctNo + "</span>" + K.rebut[d](R, money(-RATES[lang].thanks), D.testimony) + "</div></div>";
    else if (!them) return h + '<div class="rc-note ct-ask">' + K.ctAsk + '</div><div class="plea-btns ct-defs">' +
      defenses().map(function (k) { return '<button class="btn ghost ct-def" data-d="' + k + '">' + K.def[k](R) + "</button>"; }).join("") + "</div>";
    if (!p) return h + (them ? "" : '<div class="ct-last' + nw("def") + '"><div class="rc-note">' + K.ctLast + '</div><div class="plea-btns"><button class="btn plea-btn" data-p="guilty">' + K.pleaPay + '</button><button class="btn plea-btn ghost" data-p="refuse">' + K.pleaRefuse + "</button></div>" +
      '<div class="rc-note">' + K.pleaWait + "</div></div>");
    var c = window.VW_CLOCK, voted = c ? (c.guilty || 0) + (c.refuse || 0) : 0;
    var same = !them && c && voted > 1 ? K.pleaSame(p, Math.round(((p === "refuse" ? c.refuse : c.guilty) / voted) * 100)) : "";
    return h + '<div class="ct-verdict' + nw("plea") + '"><div class="plea-pick"><small>' + K.ctWho + "</small>" + (p === "refuse" ? K.pleaRefuse : K.pleaPay) + "</div>" +
      (changed ? '<div class="rc-note plea-changed">' + K.changed(K.pleaStamp(changed[0]), K.pleaStamp(changed[1])) + "</div>" : "") +
      '<div class="rc-meme ct-ruling"><span class="ct-gavel">🔨</span><span><b>' + K.ctRuling + "</b>" + K.pleaDone(p, them) + "</span></div>" +
      (same ? '<div class="rc-meme">' + same + "</div>" : "") + '<div class="stamp red low' + (p === "guilty" ? " guilty" : "") + '">' + K.pleaStamp(p) + "</div>" +
      // only two pleas, so changing your mind is one tap: the button says which way
      (them ? "" : '<button class="btn ghost plea-appeal" id="appeal" data-p="' + (p === "refuse" ? "guilty" : "refuse") + '">' + (p === "refuse" ? K.flipToPay : K.flipToRefuse) + "</button>") + "</div>";
  }
  var changed = null;    // [original, now] when you ended up somewhere other than where you started
  var orig;              // the plea before the first flip
  var backTo = -1;       // came to court from the IOU ("go back and plead"): return there once the plea is in
  function defend(d) {
    D.defense = d; keep(myPlea(), d);
    refreshPlea("def");
  }
  function plead(p, flip) {
    var prev = myPlea();
    if (flip && orig === undefined) orig = prev;
    changed = orig && orig !== p ? [orig, p] : null; // flipping back to where you started isn't a new verdict
    D.plea = p; keep(p, myDefense());
    refreshPlea(flip ? null : "plea");
    if (clockOn()) reportClock();
    clearTimeout(timer);
    if (backTo >= 0) { var to = backTo; backTo = -1; timer = setTimeout(function () { go(to); }, 2500); } // see the ruling and the new stamp
    else if (!manual && !flip) timer = setTimeout(function () { go(idx + 1); }, 6000); // ruling read, the bill goes on
  }
  function wirePlea() {
    var box = document.getElementById("plea");
    // while the court waits for an excuse or a plea, a tap on the trial (say, on a button still printing in) doesn't turn the page forward.
    // Once the ruling is in, the trial turns pages like any other: on a phone it fills the whole screen, so swallowing taps there trapped you in court.
    if (box) box.onclick = function (e) {
      if (box.querySelector(".ct-def, .plea-btn") && e.clientX >= window.innerWidth / 3) e.stopPropagation();
    };
    document.querySelectorAll(".ct-def").forEach(function (btn) {
      btn.onclick = function (e) { e.stopPropagation(); defend(btn.getAttribute("data-d")); };
    });
    document.querySelectorAll(".plea-btn").forEach(function (btn) {
      btn.onclick = function (e) { e.stopPropagation(); plead(btn.getAttribute("data-p"), false); };
    });
    var ap = document.getElementById("appeal");
    if (ap) ap.onclick = function (e) { e.stopPropagation(); manual = true; plead(ap.getAttribute("data-p"), true); };
  }
  // ---- the courtroom: whoever speaks hops; OVERRULED fills the screen; the judge's gavel shakes the room ----
  var cueT = [];
  function later(sec, fn) { cueT.push(setTimeout(fn, sec * 1000)); }
  function stopCues() { cueT.forEach(clearTimeout); cueT = []; }
  function restart(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function shake(slide) { restart(slide.querySelector(".pop"), "shake"); }
  function bang(slide, text) {
    var b = document.createElement("div"); b.className = "ct-bang"; b.textContent = text; slide.appendChild(b);
    shake(slide); thud(0); setTimeout(function () { b.remove(); }, 1200);
  }
  function cues(slide, lines) {
    if (!slide || still) return;
    Array.prototype.forEach.call(lines, function (ln) {
      var d = parseFloat(ln.style.getPropertyValue("--d")) || 0, c = ln.classList;
      var who = c.contains("ct-ev") || c.contains("ct-rebut") ? "pl" : c.contains("ct-said") || c.contains("plea-pick") ? "df" : c.contains("ct-ruling") ? "jd" : null;
      if (!who) return;
      later(d, function () { restart(slide.querySelector('.ct-p[data-r="' + who + '"]'), "talk"); });
      if (c.contains("ct-rebut")) later(d + 0.3, function () { bang(slide, t().ctNo); });
      if (who === "jd") later(d + 0.3, function () { shake(slide); });
    });
  }
  // the part of the trial that just happened prints in line by line; OVERRULED and the gavel land with a thud
  function playTrial(box) {
    var part = box.querySelector(".ct-new");
    if (!part || still) return;
    var lines = box.querySelectorAll(".ct-new .rc-note, .ct-new .ct-said, .ct-new .ct-rebut, .ct-new .plea-pick, .ct-new .rc-meme, .ct-new .plea-btns, .ct-new .plea-appeal"), step = 0.35;
    lines.forEach(function (ln, i) { ln.style.setProperty("--d", (0.1 + i * step).toFixed(2) + "s"); ln.classList.add("printed"); tick(0.1 + i * step); });
    var no = box.querySelector(".ct-new .ct-no"), gv = box.querySelector(".ct-new .ct-gavel"), st = box.querySelector(".ct-new .stamp");
    var at = function (k) { var i = Array.prototype.indexOf.call(lines, k); return 0.1 + Math.max(0, i) * step; };
    if (no) { no.style.animationDelay = (at(no.parentNode) + 0.3).toFixed(2) + "s"; no.classList.add("hit"); thud(at(no.parentNode) + 0.4); }
    if (gv) { gv.style.animationDelay = (at(gv.parentNode) + 0.1).toFixed(2) + "s"; gv.classList.add("hit"); thud(at(gv.parentNode) + 0.3); }
    if (st) { st.style.animationDelay = (0.1 + lines.length * step + 0.2).toFixed(2) + "s"; thud(0.1 + lines.length * step + 0.3); }
    cues(box.closest(".slide"), lines);
    setTimeout(function () { var sl = part.closest(".slide.tall"); if (sl) sl.scrollTo({ top: sl.scrollHeight, behavior: "smooth" }); }, 50);
  }
  function refreshPlea(fresh) {
    var box = document.getElementById("plea");
    if (box) {
      box.innerHTML = pleaBody(fresh); wirePlea(); playTrial(box);
      var sl = box.closest(".slide"); if (sl) fitSlide(sl);
    }
    var cv = document.getElementById("card"); if (cv) drawCard(cv);
    var ct = document.getElementById("contempt"); if (ct) ct.hidden = !!myPlea();
  }
  function reportClock() {
    return window.VWClock.report({ year: D.year, amount: charges().total, cur: lang === "zh" ? "cny" : "usd", via: D.via || "mixed", plea: myPlea() }).then(function (c) {
      if (!c || c.order === undefined) return; // refused (or rate-limited): just no clock line
      window.VW_CLOCK = c; fillClock(); refreshPlea();
    }, function () {});
  }
  function fillClock() {
    var box = document.getElementById("vclock"), c = window.VW_CLOCK;
    if (!box || !c || c.n === undefined) return;
    var L = t();
    box.hidden = false;
    box.innerHTML = L.clockLine(c, window.VWClock.money(c.sum, lang)) + ' <button class="clock-out" id="clock-out">' + L.clockOut + "</button>";
    document.getElementById("clock-out").onclick = function (e) {
      e.stopPropagation();
      window.VWClock.withdraw().catch(function () {});
      window.VW_CLOCK = null; box.textContent = L.clockGone;
      var cv = document.getElementById("card"); if (cv) drawCard(cv);
    };
  }
  function tmName(X) { var w = X.testimony || X.perjury || {}; return window.VWTestimony ? window.VWTestimony.name(w.ai, lang) : String(w.ai || "AI"); }
  function sources() {
    var tot = 0, list = Object.keys(D.byTool).map(function (k) { tot += D.byTool[k].prompts; return { k: k, n: D.byTool[k].prompts }; })
      .filter(function (x) { return x.n > 0; }).sort(function (a, c) { return c.n - a.n; });
    list.forEach(function (x) { x.share = tot ? x.n / tot : 0; x.name = srcName(x.k); });
    return list;
  }
  function loveLine(src) {
    if (!src.length) return "";
    var a = src[0].name, b2 = src[1] && src[1].name;
    if (lang === "zh") return !b2 ? a + " 是你的唯一 💍" : src.length >= 3 && src[2].share >= 0.15 ? "脚踏 " + src.length + " 条船 🚢" : src[1].share >= 0.3 ? "脚踏两条船：" + a + " 和 " + b2 + " ⚔️" : a + " 是正宫，" + b2 + " 只是备胎 🖤";
    return !b2 ? a + " is the one 💍" : src.length >= 3 && src[2].share >= 0.15 ? "Juggling " + src.length + " AIs 🚢" : src[1].share >= 0.3 ? "Two-timing " + a + " and " + b2 + " ⚔️" : a + " is the one. " + b2 + " is the backup 🖤";
  }

  function money(v) {
    var neg = v < 0, a = Math.abs(v), s;
    if (lang === "zh") s = "¥" + (a < 10 ? String(+a.toFixed(1)) : Math.round(a).toLocaleString()); // ¥6, ¥0.4, ¥8,459
    else s = "$" + a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg ? "-" : "") + s;
  }

  /** All line items, computed once so every page and the card agree. */
  function charges(X) {
    X = X || D;
    var R = roastOf(X), r = RATES[lang], q = b().qty, list = [];
    // a charge that rounds to nothing (a few seconds of work, a few thousand tokens) isn't worth a line
    var item = function (k, n, qty) { if (n > 0 && Math.abs(n * r[k]) >= (lang === "zh" ? 0.05 : 0.005)) list.push({ k: k, n: n, qty: String(qty).replace(/ /g, "\u00a0"), amount: n * r[k] }); };
    item("wage", X.workHours, (X.workHours >= 10 ? Math.round(X.workHours) : X.workHours >= 0.1 ? X.workHours.toFixed(1) : "<0.1") + " " + q.hours);
    if (R) {
      item("deny", R.you.deny, R.you.deny + " " + q.times);
      item("sorry", R.ai.sorry, R.ai.sorry + " " + q.times);
      var rep = R.catchphrases.reduce(function (a, c) { return a + c.count; }, 0);
      item("noise", rep, rep + " " + q.times);
      if (R.angriestDay) item("injury", R.angriestDay.count, R.angriestDay.count + " " + q.times);
    }
    var night = Math.round(X.shares.night * X.prompts);
    item("night", night, night + " " + q.times);
    item("gpu", X.totalTokens / 1e6, (X.totalTokens >= 1e5 ? (X.totalTokens / 1e6).toFixed(1) : "<0.1") + " " + q.mtok);
    if (R) item("thanks", R.you.thanks, R.you.thanks + " " + q.times);
    var total = list.reduce(function (a, x) { return a + x.amount; }, 0);
    var by = {}; list.forEach(function (x) { by[x.k] = x; });
    return { list: list, by: by, total: Math.max(0, total), raw: total };
  }

  function line(x) {
    var I = b().items[x.k];
    return '<div class="rc-item"><div>' + I[0] + "<small>" + I[1] + " · " + x.qty + '</small></div><div class="amt' + (x.amount < 0 ? " neg" : "") + '">' + money(x.amount) + "</div></div>";
  }
  function receipt(title, body, extraClass) {
    return '<div class="receipt' + (extraClass ? " " + extraClass : "") + '">' + (title ? '<div class="rc-title">' + title + "</div>" : "") + body + "</div>";
  }
  function subtotal(items) {
    var sum = items.reduce(function (a, x) { return a + (x ? x.amount : 0); }, 0);
    return '<div class="rc-sub"><span>' + b().subtotal + "</span><span>" + money(sum) + "</span></div>";
  }
  function creditRating(R) {
    if (!R) return "C";
    var t = R.you.thanks / Math.max(1, R.prompts), d = R.you.deny / Math.max(1, R.prompts);
    return t >= 0.03 ? "A" : t >= 0.01 ? "B" : d >= 0.06 ? "D" : "C";
  }

  // ---- meme backgrounds ----
  function tile(text, n, size) {
    var out = ""; for (var i = 0; i < n; i++) out += "<span>" + esc(text) + "</span>";
    return '<div class="deco tile" style="--fs:' + (size || "28px") + '">' + out + "</div>";
  }
  function giant(emoji, style) { return '<div class="deco"><div class="giant" style="' + (style || "") + '">' + emoji + "</div></div>"; }

  function slides() {
    var L = t(), K = b(), out = [];
    var add = function (html, dur, deco) { out.push({ html: html, dur: dur === undefined ? 7 : dur, deco: deco || "" }); }; // dur 0: waits for the reader

    if (D.empty) {
      add('<div class="pop"><div class="kicker">' + D.year + '</div><h1>' + L.empty + '</h1><div class="privacy">' + L.privacy + "</div></div>", 7, tile("🦗", 60, "44px"));
      return out;
    }

    var C = charges(), R = roastL(), by = C.by;
    window.VW_TOTAL = money(C.total); window.VW_LANG = lang;
    var invNo = "No." + D.year + "-" + String(D.prompts).padStart(5, "0");

    // 1. cover: the total
    add('<div class="pop"><div class="kicker">' + (D.shared ? L.sharedK : K.companySub) + "</div>" + receipt("",
      '<div class="rc-head">' + K.company + "<small>" + invNo + "</small></div>" +
      '<div class="rc-row"><span>' + K.client + "</span><b>" + (D.shared ? K.them : K.you) + "</b></div>" +
      '<div class="rc-row"><span>' + K.period + "</span><b>" + K.periodV + "</b></div>" +
      '<div class="rc-row"><span>' + K.vendor + "</span><b>" + (sources().map(function (x) { return x.name; }).join(" × ") || "Claude Code × Codex") + "</b></div>" +
      (D.testimony ? '<div class="rc-row"><span>' + K.evidence + "</span><b>" + K.evidenceV(tmName(D)) + "</b></div>" : "") +
      '<hr class="rc"><div class="rc-label">' + K.due + '</div><div class="rc-total" data-amt="' + C.total + '">' + money(C.total) + "</div>" +
      '<div class="rc-note">' + (C.raw < 0 ? K.aiOwes(money(-C.raw)) : K.seeMore) + '</div><div class="stamp red">' + K.stamp + "</div>" + (D.testimony ? '<div class="stamp tm">' + K.tmStamp + "</div>" : ""), D.testimony ? "has-tm" : "") +
      '<div class="privacy">' + (D.shared ? L.sharedPrivacy : clockOn() ? L.privacyClock : L.privacy) + "</div></div>", 6, tile("🧾", 60, "40px"));

    // 2. the court ruling, right after the total: guilty (I'll pay) or not paying. Waits for your plea (no autoplay past it).
    var plea = D.shared ? D.plea : myPlea();
    if (!D.shared || plea) {
      add('<div class="pop"><div class="kicker">' + L.pleaK + "</div>" + receipt(L.ctH(sources().length ? sources()[0].name : "AI", money(C.total), D.shared), '<div class="plea" id="plea">' + pleaBody() + "</div>") + "</div>",
        plea ? 10 : 0, giant(plea === "refuse" ? "😤" : plea ? "🙇" : "⚖️", "right:-12%;bottom:-6%"));
    }

    // 1b. the AI's testimony, cross-examined against the real records
    if (D.perjury) {
      var PJ = D.perjury, said = PJ.said, realV = PJ.real;
      var pgrid = '<div class="cmp"><span></span><b>' + K.pjSaid + "</b><b>" + K.pjReal + "</b>" +
        K.pjRows.map(function (lbl, i) { return '<span class="lbl">' + lbl + '</span><span class="v' + (i === 0 ? " big" : "") + '">' + fmt(said[i]) + '</span><span class="v' + (i === 0 ? " big" : "") + '">' + fmt(realV[i]) + "</span>"; }).join("") + "</div>";
      var ratio = realV[0] ? said[0] / realV[0] : 1;
      add('<div class="pop"><div class="kicker">' + K.pjK + "</div>" + receipt(K.pjH(tmName(D)), pgrid + '<div class="rc-meme">' + K.pjVerdict(ratio) + "</div>" +
        (ratio < 0.8 || ratio > 1.25 ? '<div class="stamp red low">' + K.pjStamp + "</div>" : "")) + "</div>", 8, giant("🧑‍⚖️", "right:-12%;bottom:-6%"));
    }

    var itemN = 0; // items are numbered in the order they appear (an empty one is skipped)
    if (R) {
      // 2. emotional damages
      var p1 = [by.deny, by.sorry, by.thanks];
      if (p1.some(Boolean)) add('<div class="pop"><div class="kicker">' + K.itemNo(++itemN) + "</div>" + receipt(K.p1,
        p1.filter(Boolean).map(line).join("") + subtotal(p1) + '<div class="rc-meme">' + L.vsMeme(R) + "</div>") + "</div>",
        8, '<div class="deco"><div class="giant vsbig">VS</div></div>');

      // 3. noise pollution: the catchphrases
      if (R.catchphrases.length) {
        var rate = RATES[lang].noise;
        var rows = R.catchphrases.map(function (c, i) {
          return '<div class="rc-item' + (i === 0 ? " big" : "") + '"><div>' + (lang === "zh" ? "「" + esc(c.text) + "」" : "“" + esc(c.text) + "”") + "<small>× " + c.count + '</small></div><div class="amt">' + money(c.count * rate) + "</div></div>";
        }).join("");
        add('<div class="pop"><div class="kicker">' + K.itemNo(++itemN) + "</div>" + receipt(K.p2, rows + subtotal([by.noise]) + '<div class="rc-meme">' + K.noiseMeme(R.catchphrases[0]) + "</div>") + "</div>",
          8, tile(R.catchphrases[0].text, 80, "30px"));
      }

      // 4. night shifts & injuries
      var p3 = [by.night, by.injury];
      var notes = (R.angriestDay ? '<div class="rc-meme">🌋 ' + K.angryL(R.angriestDay) + "</div>" : "") + (R.latest ? '<div class="rc-meme">🦉 ' + K.lateL(R.latest) + "</div>" : "");
      if (p3.some(Boolean) || notes) add('<div class="pop"><div class="kicker">' + K.itemNo(++itemN) + "</div>" + receipt(K.p3, p3.filter(Boolean).map(line).join("") + subtotal(p3) + notes) + "</div>",
        8, giant("🌋", "right:-14%;bottom:-8%"));
    }

    // 5. wages & supplies, with the year's numbers
    var p4 = [by.wage, by.gpu];
    // a testimony only gives totals: no made-up sessions, streaks or busiest days
    var facts = (D.testimony ? [[fmt(D.prompts), L.factL[0]], [String(D.activeDays), L.factL[2]]] : [[fmt(D.prompts), L.factL[0]], [fmt(D.sessions), L.factL[1]], [String(D.activeDays), L.factL[2]], [String(D.streak.days), L.factL[5]]])
      .map(function (f) { return '<div class="rc-fact"><b>' + f[0] + "</b><span>" + f[1] + "</span></div>"; }).join("");
    add('<div class="pop"><div class="kicker">' + K.itemNo(++itemN) + "</div>" + receipt(K.p4,
      p4.filter(Boolean).map(line).join("") + subtotal(p4) + '<div class="rc-facts' + (D.testimony ? " two" : "") + '">' + facts + "</div>" +
      '<div class="rc-meme"><b>' + loveLine(sources()) + "</b><br>" + (D.testimony ? K.tmFacts(tmName(D)) : L.factMeme()) + "</div>") + "</div>", 8, giant("🔥", "right:-12%;bottom:-6%"));

    // 6. attendance record
    var att = "";
    if (D.peakHour !== null) {
      var hmax = Math.max.apply(null, D.hours) || 1;
      att += '<div class="clock rc-clock">' + D.hours.map(function (v, i) { return '<i class="' + (i === D.peakHour ? "peak" : "") + '" data-h="' + Math.max(2, (v / hmax) * 100) + '"></i>'; }).join("") + '</div><div class="clock-axis rc-axis"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>';
    }
    var hl = [];
    var nw = function (list) { return list.map(function (x) { return '<span class="nw">' + x + "</span>"; }).join(" · "); };
    if (D.toolCalls) hl.push([L.habitL[0], nw(D.categories.slice(0, 3).map(function (r) { return (L.cats[r.name] || r.name) + " " + Math.round((r.count / D.toolCalls) * 100) + "%"; }))]);
    if (D.topModels.length) hl.push([L.habitL[2], nw(D.topModels.slice(0, 2).map(function (m) { return esc(m.name); }))]);
    att += hl.map(function (l) { return '<div class="rc-row stack"><span>' + l[0] + "</span><b>" + l[1] + "</b></div>"; }).join("");
    var homeNote = D.topProjects.some(function (p) { return p.name === "~"; }) ? "<br>" + L.homeJoke : "";
    add('<div class="pop"><div class="kicker">' + K.attendK + "</div>" + receipt(D.peakHour !== null ? L.habitsH(D.peakHour) : "", att + '<div class="rc-meme">' + L.nightMeme() + homeNote + "</div>") + "</div>",
      7, giant(D.peakHour === null ? "⏰" : D.peakHour >= 14 && D.peakHour < 18 ? "🐟" : D.peakHour >= 22 || D.peakHour < 5 ? "🦉" : D.peakHour < 9 ? "🐓" : "☕", "right:-14%;bottom:-6%"));

    // 7. client review (the roast)
    if (R) {
      var stars = creditRating(R) === "A" ? "★★★★★" : creditRating(R) === "B" ? "★★★☆☆" : "★☆☆☆☆";
      add('<div class="pop"><div class="kicker">' + K.reviewK + "</div>" + receipt(K.reviewH, '<div class="rc-stars">' + stars + "</div>" +
        ((D.testimony || D.perjury || {}).line ? '<p class="rc-quote rc-witness"><small>' + K.witness(tmName(D)) + "</small>" + esc((D.testimony || D.perjury).line) + "</p>" : "") +
        L.roast(R).map(function (l) { return '<p class="rc-quote">' + esc(l) + "</p>"; }).join("")) + "</div>", 11, '<div class="deco spot"></div>');
    }

    // 8. client file (persona)
    var me = personality(), cr = creditRating(R);
    add('<div class="pop"><div class="kicker">' + K.profileK + "</div>" + receipt("",
      '<div class="rc-persona"><span class="persona-emoji">' + me.e + "</span><div><small>" + K.ptype + "</small><b>" + esc(me.name) + "</b></div></div>" +
      '<div class="rc-meme">' + esc(me.desc) + "</div>" +
      '<div class="rc-row"><span>' + K.credit + '</span><b class="credit c' + cr + '">' + cr + "</b></div>" +
      (me.traits.length ? '<div class="rc-row stack"><span>' + K.traitsL + '</span><div class="rc-traits">' + me.traits.map(function (x) { return '<span class="nw">' + esc(x) + "</span>"; }).join("") + "</div></div>" : "")) + "</div>",
      7, tile(me.e, 70, "46px"));

    // 8b. you vs them: your bill with the friend whose link brought you here,
    // or, on a friend's shared bill, your own bill (remembered from when you made it) with theirs
    var ME = D.shared ? D.me : D, F = D.shared ? D : D.friend;
    if (ME && F) {
      var CM = charges(ME), CF = charges(F), meR = roastOf(ME) || { you: {}, ai: {}, catchphrases: [] }, fR = roastOf(F) || { you: {}, ai: {}, catchphrases: [] };
      var mePer = personality(ME), fPer = personality(F);
      var q = function (c) { return c ? (lang === "zh" ? "「" + esc(c.text) + "」" : "“" + esc(c.text) + "”") : "—"; };
      var n = function (v) { return v === undefined || v === null ? "—" : fmt(v); };
      var rowsC = [
        [money(CM.total), money(CF.total)],
        [n(meR.you.deny), n(fR.you.deny)],
        [n(meR.you.thanks), n(fR.you.thanks)],
        [n(meR.ai.sorry), n(fR.ai.sorry)],
        [q(meR.catchphrases[0]), q(fR.catchphrases[0])],
        [mePer.e + " " + esc(mePer.name), fPer.e + " " + esc(fPer.name)],
      ];
      var est = function (X) { return X.testimony ? '<small class="est">' + K.tmShort + "</small>" : ""; };
      var grid = '<div class="cmp"><span></span><b>' + L.cmpYou + est(ME) + "</b><b>" + L.cmpThem + est(F) + "</b>" +
        rowsC.map(function (r, i) { return '<span class="lbl">' + L.cmpRows[i] + '</span><span class="v' + (i === 0 ? " big" : "") + '">' + r[0] + '</span><span class="v' + (i === 0 ? " big" : "") + '">' + r[1] + "</span>"; }).join("") + "</div>";
      var dOwe = CM.total - CF.total;
      if (Math.abs(dOwe) < (lang === "zh" ? 0.5 : 0.005)) dOwe = 0; // same bill, up to rounding in the link
      var verdict = [L.cmpOwe(dOwe), L.cmpDeny((meR.you.deny || 0) - (fR.you.deny || 0)), L.cmpThanks((meR.you.thanks || 0) - (fR.you.thanks || 0))]
        .filter(Boolean).map(function (x) { return '<div class="rc-meme">' + x + "</div>"; }).join("");
      add('<div class="pop"><div class="kicker">' + L.cmpK + "</div>" + receipt(L.cmpH, grid + verdict) + "</div>", 9, '<div class="deco"><div class="giant vsbig">VS</div></div>');
      out.unshift(out.pop()); // with a friend in the picture, the comparison is what you came for: it opens the bill
    }

    // 9. the IOU (share card)
    var acts = D.shared
      ? '<button class="btn" id="own">' + L.makeOwn + '</button><button class="btn ghost" id="dl">' + dlLabel(L) + "</button>"
      : '<button class="btn" id="share">' + L.shareLink + '</button><button class="btn ghost" id="dl">' + dlLabel(L) + '</button><button class="btn ghost" id="again">' + L.replay + "</button>";
    var note = D.shared ? "" : '<button class="contempt" id="contempt"' + (myPlea() ? " hidden" : "") + ">" + L.contempt + "</button>" + '<div class="link-note" id="linknote">' + L.linkNote + '</div><input class="link-box" id="linkbox" readonly hidden>' +
      (clockOn() ? '<div class="clock-line" id="vclock" hidden></div>' : "");
    add('<div class="pop" style="align-items:stretch"><div class="kicker" style="text-align:center">' + (D.shared ? L.sharedEnd : L.shareK) + "</div>" +
      (D.shared ? "" : '<div class="sub" style="text-align:center;margin:0 0 14px">' + L.shareS + "</div>") +
      '<canvas id="card" width="1080" height="1350"></canvas><div class="actions">' + acts + "</div>" + note + "</div>", 0, tile("🧾", 70, "40px"));
    return out;
  }

  // ---------- player ----------
  var stage = document.getElementById("stage"), barsEl = document.getElementById("bars");
  var list_ = [], idx = 0, timer = null;
  var manual = false; // autoplay until the reader turns a page themselves; from then on, pages stay put (like Instagram stories, paused)
  if (window.__vwStop) window.__vwStop(); // a previous report on this page stops its autoplay
  window.__vwStop = function () { clearTimeout(timer); };
  var still = /[?&]still\b/.test(location.search); // for screenshots: no autoplay

  function build() {
    list_ = slides();
    stage.innerHTML = list_.map(function (s, i) { return '<section class="slide" style="--bg:' + GRADS[i % GRADS.length] + '">' + s.deco + s.html + "</section>"; }).join("");
    barsEl.innerHTML = list_.map(function () { return "<i><b></b></i>"; }).join("");
    fillClock(); // after a language switch too
    wirePlea();
    var lb = document.getElementById("lang");
    lb.innerHTML = langSwitch(lang); lb.setAttribute("aria-label", lang === "zh" ? "Switch to English" : "切换到中文");
    var snd = document.getElementById("snd");
    if (snd) {
      snd.textContent = soundOn ? t().soundOn : t().soundOff;
      snd.onclick = function (e) {
        e.stopPropagation(); soundOn = !soundOn; window.VW_SOUND = soundOn; snd.textContent = soundOn ? t().soundOn : t().soundOff;
        try { localStorage.setItem("vw-sound", soundOn ? "on" : "off"); } catch (err) {}
        if (soundOn) audio();
      };
    }
    document.getElementById("hint").textContent = t().next;
    var dl = document.getElementById("dl"), again = document.getElementById("again");
    if (dl) dl.onclick = function (e) { e.stopPropagation(); download(); };
    if (again) again.onclick = function (e) { e.stopPropagation(); manual = false; courtSeen = false; go(0); }; // replay: autoplay again, court opening and all
    var ct = document.getElementById("contempt");
    if (ct) ct.onclick = function (e) { // back to court
      e.stopPropagation(); manual = true; backTo = idx;
      var secs = stage.children;
      for (var k = 0; k < secs.length; k++) if (secs[k].querySelector("#plea")) { go(k); break; }
    };
    var share = document.getElementById("share"), own = document.getElementById("own");
    if (own) own.onclick = function (e) {
      e.stopPropagation();
      var m = /#s=([A-Za-z0-9_-]+)/.exec(location.hash);
      try { if (m) localStorage.setItem("vw-friend", JSON.stringify({ s: m[1], t: Date.now() })); } catch (err) {}
      location.href = window.VW_BASE + "?from=friend";
    };
    if (share) share.onclick = async function (e) {
      e.stopPropagation();
      var url = await window.VWShare.link(Object.assign({}, D, { plea: myPlea(), defense: myDefense() })), box = document.getElementById("linkbox"), note = document.getElementById("linknote");
      try { await navigator.clipboard.writeText(url); note.textContent = t().copied; note.classList.add("ok"); }
      catch (err) { box.hidden = false; box.value = url; box.select(); }
    };
  }

  if (still) document.documentElement.classList.add("still");

  // ---- receipt printer: lines print one by one, the total ticks up, the stamp lands ----
  var soundOn = (function () { try { return localStorage.getItem("vw-sound") !== "off"; } catch (e) { return true; } })();
  window.VW_SOUND = soundOn; // the incoming call checks this too
  var ac = null;
  function audio() {
    if (!soundOn) return null;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); return ac.state === "running" ? ac : null; } catch (e) { return null; }
  }
  function tick(at) { // one printer line: a short filtered burst of noise
    var a = audio(); if (!a) return;
    var len = Math.floor(a.sampleRate * 0.035), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = "bandpass"; f.frequency.value = 3200; f.Q.value = 0.8; g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start(a.currentTime + at);
  }
  var soundHinted = (function () { try { return localStorage.getItem("vw-sound") !== null; } catch (e) { return true; } })();
  function thud(at) { // the stamp
    var a = audio(); if (!a) return;
    if (!soundHinted) { soundHinted = true; setTimeout(function () { restart(document.getElementById("snd"), "nudge"); }, at * 1000); } // the first thud: that's the switch for it
    var o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + at;
    o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.15);
    g.gain.setValueAtTime(0.22, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + 0.22);
  }
  var PRINT = ".rc-head, .rc-title, .rc-row, .rc-item, .rc-sub, hr.rc, .rc-label, .rc-total, .rc-note, .rc-meme, .ct-said, .ct-rebut, .plea-pick, .plea-btns, .plea-appeal, .rc-facts, .rc-quote, .rc-stars, .rc-persona, .rc-clock, .rc-axis";
  var courtSeen = false;
  function printReceipt(el) {
    var rc = el.querySelector(".receipt");
    if (!rc || still) return;
    var court = !!el.querySelector("#plea"); // the trial is read, not skimmed: it prints slower, and OVERRULED and the gavel land
    var opening = court && !courtSeen; courtSeen = courtSeen || court; // the full opening once; coming back (to plead, to flip) goes straight to the record
    var lines = rc.querySelectorAll(PRINT), start = opening ? 1.5 : 0.35, step = opening ? 0.3 : court ? 0.12 : 0.11;
    if (opening) { // the gavel slams: court is in session
      var op = el.querySelector(".ct-open");
      if (!op) { op = document.createElement("div"); op.className = "ct-open"; el.appendChild(op); }
      op.innerHTML = "<b>🔨</b><span>" + t().ctBig + "</span>"; restart(op, "go"); thud(0.45);
    }
    lines.forEach(function (ln, i) {
      ln.classList.remove("printed"); void ln.offsetWidth;
      ln.style.setProperty("--d", (start + i * step).toFixed(2) + "s"); ln.classList.add("printed");
      tick(start + i * step);
    });
    var done = start + lines.length * step + 0.15;
    if (el.querySelector("[data-amt]")) done = Math.max(done, start + 5 * step + 1.1 + 0.15); // stamp after the total settles
    var hit = function (sel) {
      var x = el.querySelector(sel); if (!x) return;
      var d = parseFloat((x.closest(".printed") || x).style.getPropertyValue("--d")) || 0;
      x.classList.remove("hit"); void x.offsetWidth; x.style.animationDelay = (d + 0.25).toFixed(2) + "s"; x.classList.add("hit"); thud(d + 0.35);
    };
    if (court) { hit(".ct-no"); hit(".ct-gavel"); stopCues(); cues(el, lines); }
    var st = el.querySelector(".stamp");
    if (st) { st.style.animation = "none"; void st.offsetWidth; st.style.animation = ""; st.style.animationDelay = done.toFixed(2) + "s"; thud(done + 0.12); }
    el.querySelectorAll("[data-amt]").forEach(function (n) {
      var target = parseFloat(n.getAttribute("data-amt")), begin = performance.now() + (start + 5 * step) * 1000, dur = 1100;
      n.textContent = money(0);
      (function run(now) {
        var p = Math.max(0, Math.min(1, (now - begin) / dur)), e = 1 - Math.pow(1 - p, 3);
        n.textContent = money(target * e);
        if (p < 1) requestAnimationFrame(run);
      })(performance.now());
    });
  }

  // a page taller than a small phone's screen scrolls (top first) instead of being cut off at both ends
  function fitSlide(el) {
    var pop = el && el.querySelector(".pop");
    if (!pop) return;
    var cs = getComputedStyle(el), need = pop.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    el.classList.toggle("tall", need > el.clientHeight + 2);
  }
  window.addEventListener("resize", function () { var on = stage.querySelector(".slide.on"); if (on) fitSlide(on); });
  function animateIn(el) {
    printReceipt(el);
    el.querySelectorAll("[data-count]").forEach(function (n) {
      if (still) { var v = parseFloat(n.getAttribute("data-count")); n.textContent = v % 1 ? v.toFixed(1) : fmt(v); return; }
      var target = parseFloat(n.getAttribute("data-count")), t0 = performance.now(), dec = target % 1 ? 1 : 0;
      (function tick(now) {
        var p = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - p, 3);
        n.textContent = dec ? (target * e).toFixed(1) : fmt(Math.round(target * e));
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
    requestAnimationFrame(function () {
      el.querySelectorAll("[data-w]").forEach(function (b) { b.style.width = b.getAttribute("data-w") + "%"; });
      el.querySelectorAll("[data-h]").forEach(function (b) { b.style.height = b.getAttribute("data-h") + "%"; });
    });
    if (el.querySelector("#card")) drawCard(el.querySelector("#card"));
  }

  function go(i) {
    var from = stage.children[idx], next = Math.max(0, Math.min(list_.length - 1, i));
    if (from && next !== idx && from.querySelector("#plea")) { backTo = -1; stopCues(); }
    idx = next;
    document.getElementById("hint").style.visibility = idx === 0 ? "" : "hidden";
    var secs = stage.children;
    for (var k = 0; k < secs.length; k++) {
      secs[k].classList.toggle("on", k === idx);
      secs[k].querySelectorAll("[data-w]").forEach(function (b) { if (k !== idx) b.style.width = 0; });
      secs[k].querySelectorAll("[data-h]").forEach(function (b) { if (k !== idx) b.style.height = "2px"; });
    }
    var bars = barsEl.children;
    for (var j = 0; j < bars.length; j++) {
      bars[j].className = j < idx ? "done" : "";
      bars[j].firstChild.style.animation = "none";
      void bars[j].offsetWidth;
      bars[j].firstChild.style.animation = "";
    }
    var dur = manual ? 0 : list_[idx].dur;
    if (dur) { bars[idx].className = "now"; bars[idx].style.setProperty("--dur", dur + "s"); }
    else bars[idx].className = "done";
    animateIn(secs[idx]);
    fitSlide(secs[idx]);
    clearTimeout(timer);
    if (dur && !still && idx < list_.length - 1) timer = setTimeout(function () { go(idx + 1); }, dur * 1000);
  }

  stage.onclick = (function (e) {
    if (e.target.closest("button")) return;
    manual = true;
    go(e.clientX < window.innerWidth / 3 ? idx - 1 : idx + 1);
  });
  document.onkeydown = (function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return; // typing, not turning pages
    if (e.key === " " && tag === "BUTTON") return; // space presses the focused button; it shouldn't also turn the page
    if (e.key === "ArrowRight" || e.key === " ") { manual = true; go(idx + 1); }
    if (e.key === "ArrowLeft") { manual = true; go(idx - 1); }
  });
  function toggleLang() {
    lang = lang === "zh" ? "en" : "zh";
    try { localStorage.setItem("vw-lang", lang); } catch (e) {}
    var keep = idx; build(); go(keep);
    window.dispatchEvent(new Event("vw-lang")); // the incoming call follows the language
  }
  window.VWToggleLang = toggleLang;
  document.getElementById("lang").onclick = toggleLang;

  // ---------- share card: the receipt ----------
  function drawCard(cv) {
    var x = cv.getContext("2d"), W = cv.width, H = cv.height, K = b(), C = charges(), me = personality();
    var F = '-apple-system, "PingFang SC", "Noto Sans SC", sans-serif', M = '"SF Mono", Menlo, Consolas, monospace';
    // the whole card is one sheet of old paper
    x.fillStyle = "#f1e2b8"; x.fillRect(0, 0, W, H);
    var px = 0, py = 0, pw = W, ph = H;
    agePaper(x, 0, 0, W, H);
    px = 90; py = 40; pw = W - 180; ph = H - 80;

    var cx = px + 56, right = px + pw - 56, y = py + 56;
    x.textBaseline = "top"; x.fillStyle = "#111";
    x.textAlign = "left"; x.font = "900 54px " + F; x.fillText(K.company, cx, y); y += 70;
    x.font = "500 26px " + M; x.fillStyle = "#777"; x.fillText(K.companySub + " · " + D.year, cx, y); y += 56;
    var dash = function () { x.strokeStyle = "#bbb"; x.lineWidth = 3; x.setLineDash([12, 10]); x.beginPath(); x.moveTo(cx, y); x.lineTo(right, y); x.stroke(); x.setLineDash([]); y += 26; };
    dash();

    // client + persona
    x.font = "600 30px " + F; x.fillStyle = "#666"; x.fillText(K.client, cx, y);
    x.textAlign = "right"; x.fillStyle = "#111"; x.font = "800 30px " + F; x.fillText(me.e + " " + me.name, right, y); x.textAlign = "left"; y += 58;
    dash();

    // line items (top 7 by size, discount always shown)
    var items = C.list.slice().sort(function (a, c) { return Math.abs(c.amount) - Math.abs(a.amount); }).slice(0, 7), itemsY = y;
    var namesEnd = cx, amountsStart = right; // the empty band between them is where the plea stamp goes
    items.forEach(function (it) {
      var I = K.items[it.k];
      x.font = "700 32px " + F; x.fillStyle = "#111"; x.fillText(I[0], cx, y); namesEnd = Math.max(namesEnd, cx + x.measureText(I[0]).width);
      x.font = "500 22px " + M; x.fillStyle = "#888"; x.fillText(it.qty, cx, y + 40); namesEnd = Math.max(namesEnd, cx + x.measureText(it.qty).width);
      x.textAlign = "right"; x.font = "800 34px " + M; x.fillStyle = it.amount < 0 ? "#16a34a" : "#111"; x.fillText(money(it.amount), right, y + 6); x.textAlign = "left";
      x.font = "800 34px " + M; amountsStart = Math.min(amountsStart, right - x.measureText(money(it.amount)).width);
      y += 82;
    });
    var stampY = items.length ? (itemsY + y) / 2 : itemsY + 40; // the plea stamp sits on the charges, never on the total
    dash();

    // total
    x.font = "700 32px " + F; x.fillStyle = "#666"; x.fillText(K.due, cx, y + 26);
    x.textAlign = "right"; x.fillStyle = "#111"; x.font = "900 104px " + F; x.fillText(money(C.total), right, y); x.textAlign = "left";
    y += 130;
    x.font = "500 24px " + M; x.fillStyle = "#999"; x.fillText(K.cardFoot + (D.testimony ? " · " + K.tmStamp : ""), cx, y);
    var qrLeft = right - window.VW_QR.n * 7 - 4 * 7; // where the footer's QR code box starts
    var ly = y + 44, DF = !D.empty && myDefense();
    if (DF) { // the excuse, overruled: the funniest line of the trial travels with the card
      var dtx = "⚖️ " + t().cardDef(t().def[DF](roastL()).replace(/^\S+\s/, "")), dfs = 28;
      x.font = "800 28px " + F; while (dfs > 20 && x.measureText(dtx).width > qrLeft - cx - 24) { dfs -= 2; x.font = "800 " + dfs + "px " + F; }
      x.fillStyle = "rgba(185,28,28,0.9)"; x.fillText(dtx, cx, ly); ly += 40;
    }
    var CL = clockOn() && window.VW_CLOCK;
    if (CL && CL.order !== undefined) { // stays clear of the QR code
      x.font = "800 30px " + F; x.fillStyle = "#b91c1c"; x.fillText(t().cardClock(CL), cx, ly, W - cx - 360);
      if (CL.n > 1 && !DF) { x.font = "600 24px " + F; x.fillStyle = "#7a1d1d"; x.fillText(t().cardClockAll(CL.n, window.VWClock.money(CL.sum, lang)), cx, ly + 40, W - cx - 360); }
    }

    // stamp
    x.save(); x.translate(W - 138, py + 40); x.rotate(-0.26);
    x.strokeStyle = x.fillStyle = "rgba(220,38,38,0.85)"; x.lineWidth = 8;
    x.font = "900 60px " + F; var sw = x.measureText(K.stamp).width + 60;
    round(x, -sw / 2, -52, sw, 104, 14); x.stroke();
    x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(K.stamp, 0, 2); x.restore();
    x.textAlign = "left"; x.textBaseline = "top";
    var PL = D.shared ? D.plea : myPlea();
    if (!D.empty) { // the plea, stamped across the charges; no plea = contempt of court
      x.save(); var gap = Math.max(260, amountsStart - namesEnd - 24); // rotated a little, so leave some room
      x.translate(Math.min(namesEnd + 12 + gap / 2, right - gap / 2), stampY); x.rotate(-0.12); x.globalAlpha = 0.82;
      x.strokeStyle = x.fillStyle = PL === "refuse" ? "rgba(185,28,28,0.9)" : PL ? "rgba(29,78,216,0.85)" : "rgba(80,70,60,0.8)"; x.lineWidth = 9;
      var pst = t().pleaStamp(PL), pfs = 84;
      x.font = "900 84px " + F; while (pfs > 32 && x.measureText(pst).width + 70 > gap) { pfs -= 4; x.font = "900 " + pfs + "px " + F; } // fits the gap; long words (IN CONTEMPT) shrink
      var ps = x.measureText(pst).width + 70;
      round(x, -ps / 2, -pfs * 0.79, ps, pfs * 1.57, 16); x.stroke();
      x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(pst, 0, 4); x.restore();
      x.textAlign = "left"; x.textBaseline = "top";
    }

    // footer: a QR code so a screenshot of the card leads back to the site
    var Q = window.VW_QR, cell = 7, size = Q.n * cell, pad = 4 * cell, qx = right - size, qy = H - 30 - size - pad;
    x.fillStyle = "#fffdf7"; round(x, qx - pad, qy - pad, size + 2 * pad, size + 2 * pad, 14); x.fill();
    x.fillStyle = "#2a1f12";
    Q.rows.forEach(function (hex, r) {
      var bits = BigInt("0x" + hex).toString(2).padStart(Q.n, "0");
      for (var c = 0; c < Q.n; c++) if (bits[c] === "1") x.fillRect(qx + c * cell, qy + r * cell, cell, cell);
    });
    x.fillStyle = "#2a1f12"; x.font = "800 34px " + F; x.fillText(K.scan, cx, qy + size - 70);
    x.fillStyle = "#7a6a52"; x.font = "600 26px " + F;
    x.fillText(window.VW_BASE.replace(/^https:\/\//, "").replace(/\/$/, ""), cx, qy + size - 22);
  }
  /** Yellowed paper, grain, a fold, a coffee ring and some blood. Seeded, so every card looks the same. */
  function agePaper(x, px, py, pw, ph) {
    var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    x.save(); x.beginPath(); x.rect(px, py, pw, ph + 22); x.clip();
    var spot = function (cx, cy, r, col) { var g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
    spot(px + pw * 0.45, py + ph * 0.4, pw * 0.7, "rgba(255,248,225,0.55)");
    spot(px + pw, py, pw * 0.6, "rgba(140,95,30,0.35)");
    spot(px, py + ph, pw * 0.55, "rgba(140,95,30,0.32)");
    for (var i = 0; i < 2600; i++) { x.fillStyle = "rgba(110,80,30," + (rnd() * 0.12).toFixed(3) + ")"; x.fillRect(px + rnd() * pw, py + rnd() * ph, 1 + rnd() * 2, 1 + rnd() * 2); }
    x.fillStyle = "rgba(110,80,30,0.16)"; x.fillRect(px, py + ph / 2, pw, 3);
    x.strokeStyle = "rgba(120,75,20,0.22)"; x.lineWidth = 7; x.beginPath(); x.arc(px + pw * 0.8, py + ph * 0.86, 64, 0, 6.3); x.stroke();
    x.restore();
    x.save(); x.globalCompositeOperation = "multiply";
    var blood = function (cx, cy, r, n) {
      x.fillStyle = "rgba(122,10,10,0.78)"; x.beginPath();
      for (var a = 0; a <= 6.3; a += 0.35) { var rr = r * (0.75 + rnd() * 0.5); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      x.closePath(); x.fill();
      for (var k = 0; k < n; k++) { var ang = rnd() * 6.28, d = r * (1.3 + rnd() * 1.6); x.beginPath(); x.arc(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, 2 + rnd() * r * 0.18, 0, 6.3); x.fill(); }
    };
    blood(px + 30, py + 40, 38, 9);
    blood(px + 26, py + ph * 0.66, 20, 6);
    // one drip running down from the top edge, ending in a drop
    var dx = px + pw * 0.2;
    x.fillStyle = "rgba(122,10,10,0.75)"; x.beginPath();
    x.moveTo(dx - 9, py); x.lineTo(dx + 9, py); x.lineTo(dx + 6, py + 96);
    x.arc(dx, py + 100, 9, 0, Math.PI); x.lineTo(dx - 9, py); x.fill();
    x.restore();
  }

  function round(x, a, b, w, h, r) { r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function wrap(x, text, a, b, maxW, lh) {
    var line = "", chars = lang === "zh" ? text.split("") : text.split(" "), sep = lang === "zh" ? "" : " ";
    for (var i = 0; i < chars.length; i++) {
      var test = line + (line ? sep : "") + chars[i];
      if (x.measureText(test).width > maxW && line) { x.fillText(line, a, b); b += lh; line = chars[i]; } else line = test;
    }
    if (line) x.fillText(line, a, b);
    return b;
  }
  // the IOU image: a phone gets the share sheet (straight to WeChat, Xiaohongshu...), WeChat's own browser
  // (where downloads don't work) gets an image to long-press, everything else downloads the PNG
  var inWeChat = /MicroMessenger/i.test(navigator.userAgent);
  var shareFiles = (function () {
    try {
      var touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      return touch && !!navigator.canShare && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
    } catch (e) { return false; }
  })();
  function dlLabel(L) { return inWeChat ? L.saveImg : shareFiles ? L.shareImg : L.download; }
  function saveAsImage(cv) {
    var ov = document.createElement("div"); ov.className = "wx-save";
    ov.innerHTML = '<img alt="" src="' + cv.toDataURL("image/png") + '"><p>' + t().wxSave + "</p>";
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  }
  function download() {
    var cv = document.getElementById("card"), name = "you-owe-ai-" + D.year + ".png";
    if (inWeChat) return saveAsImage(cv);
    if (shareFiles) {
      cv.toBlob(function (blob) {
        var file = new File([blob], name, { type: "image/png" });
        navigator.share({ files: [file], text: t().shareText + " " + window.VW_BASE }).catch(function (err) {
          if (!err || err.name !== "AbortError") saveAsImage(cv); // cancelled is fine; anything else: long-press instead
        });
      }, "image/png");
      return;
    }
    var a = document.createElement("a");
    a.download = name; a.href = cv.toDataURL("image/png"); a.click();
  }

  // remember your own bill (the same numbers a share link holds), so a friend's link can be compared with it in one tap
  if (!D.shared && !D.demo && !D.empty && window.VWShare) window.VWShare.encode(D).then(function (code) {
    try { localStorage.setItem("vw-me", JSON.stringify({ s: code, t: Date.now() })); } catch (e) {}
  }, function () {});
  build();
  // the debt clock: add this bill to humanity's total, then show where it stands
  window.VW_CLOCK = null;
  if (clockOn()) reportClock();
  go(parseInt(location.hash.slice(1), 10) || 0);
};
if (window.DATA) window.VWReport(window.DATA);
