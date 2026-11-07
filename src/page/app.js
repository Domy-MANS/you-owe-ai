/* Share links: the report's numbers are compressed into the URL fragment (#s=...).
   The fragment never leaves the browser, so not even the host sees the data. */
window.VW_BASE = "https://domy-mans.github.io/you-owe-ai/";
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
  async function encode(D) {
    var bytes = new TextEncoder().encode(JSON.stringify(shareable(D)));
    if (typeof CompressionStream !== "undefined") return "z" + b64url(await pipe(bytes, new CompressionStream("deflate-raw")));
    return "j" + b64url(bytes);
  }
  async function decode(s) {
    var bytes = unb64url(s.slice(1));
    if (s.charAt(0) === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    var D = JSON.parse(new TextDecoder().decode(bytes));
    D.shared = true; D.topProjects = []; D.days = {};
    return D;
  }
  async function link(D) { return window.VW_BASE + "#s=" + (await encode(D)); }
  function fromHash() { var m = /#s=([A-Za-z0-9_-]+)/.exec(location.hash); return m ? decode(m[1]) : null; }
  return { encode: encode, decode: decode, link: link, fromHash: fromHash, shareable: shareable };
})();

/* Report player. Called with the computed stats: VWReport(stats). */
window.VWReport = function (DATA) {
  "use strict";
  var D = DATA;
  var lang = (function () {
    var q = /[?&]lang=(zh|en)/.exec(location.search);
    if (q) return q[1];
    try { var s = localStorage.getItem("vw-lang"); if (s) return s; } catch (e) {}
    return /^zh/i.test(navigator.language || "") ? "zh" : "en";
  })();

  var T = {
    zh: {
      title: "你的 AI 编程年度报告", next: "点击右侧继续 · ← → 翻页", lang: "EN", replay: "再看一遍", download: "下载分享图",
      privacy: "全部在你的电脑上统计。这个页面被浏览器禁止联网，数据发不出去。",
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
      shareK: "这是你的欠条 🧾", shareS: "发给朋友，看看谁欠 AI 最多 💸",
      shareLink: "复制分享链接", copied: "✓ 已复制！发给朋友，点开就能看你的报告", linkNote: "链接里包含报告里的数字和口头禅，不包含项目名。",
      sharedK: "有人把 TA 的 AI 打工账单分享给了你", sharedTitle: "TA 的 AI 编程年度报告", sharedPrivacy: "数据都装在这个链接里，不经过任何服务器。", sharedEnd: "看完了别人的，轮到你了", makeOwn: "生成我自己的",
      cardStats: ["条指令", "AI 工作小时", "token", "活跃天数", "最长连续", "调用工具"],
      cardFun: ["条指令", "次否定 AI", "次 AI 道歉", "活跃天数", "token", "最晚一条"],
      empty: D.year + " 年一条 Claude Code 或 Codex 的记录都没有。AI 等了你一整年，你一次都没来。",
      factsK: "你的年度数字", factL: ["次使唤 AI", "个对话", "天想起了 AI", "小时 AI 白干", "token 燃烧", "天最长连续"],
      habitsK: "你的习惯", habitL: ["最常使唤 AI", "最常折腾", "最常翻牌子"],
      introS: "AI 都记着呢。准备好被吐槽了吗？",
      billK: "AI 打工账单 · " + D.year, billH: "你欠 AI", billHShared: "TA 欠 AI",
      billS: function () { var h = D.workHours; return "AI 替你干了 <b>" + (h >= 10 ? Math.round(h) : h.toFixed(1)) + "</b> 小时活，一分钱没拿（按麦当劳时薪算）。<br>账单明细在后面 👇"; },
      cardTitle: function () { return (D.shared ? "TA 欠 AI " : "你欠 AI ") + owed(); },
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
        if (h >= 0.5) out.push("刚才那 " + owed() + " 只是基本工资。加上加班费和精神损失费，你欠 AI " + owed(3) + "。");
        if (R.ai.done && R.you.whatNext) out.push("AI 说了 " + R.ai.done + " 次「搞定了」，你回了 " + R.you.whatNext + " 次「然后呢」。AI：没有然后了，求求你。");
        if (c && c.count >= 3) out.push("「" + c.text + "」你说了 " + c.count + " 次，建议直接绑个快捷键。");
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
      title: "Your AI Coding Wrapped", next: "Tap right to continue · ← → to navigate", lang: "中文", replay: "Replay", download: "Download card",
      privacy: "Counted on your machine. This page is blocked from the network by your browser, so nothing can leave.",
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
      shareK: "Here's your IOU 🧾", shareS: "Send it to friends. See who owes AI the most 💸",
      shareLink: "Copy share link", copied: "✓ Copied! Anyone with the link can see your Wrapped", linkNote: "The link holds your numbers and catchphrases. No project names.",
      sharedK: "Someone shared their AI invoice with you", sharedTitle: "Their AI Coding Wrapped", sharedPrivacy: "All the data lives inside the link. No server involved.", sharedEnd: "Your turn", makeOwn: "Make my own",
      cardStats: ["prompts", "AI hours", "tokens", "active days", "best streak", "tool calls"],
      cardFun: ["prompts", "times AI was wrong", "AI apologies", "active days", "tokens", "latest prompt"],
      empty: "Not a single Claude Code or Codex prompt in " + D.year + ". AI waited all year. You never came.",
      factsK: "Your year in numbers", factL: ["times you bossed AI", "sessions", "days you remembered AI", "unpaid AI hours", "tokens burned", "day streak"],
      habitsK: "Your habits", habitL: ["Mostly made AI", "Most tortured", "Favorite models"],
      introS: "AI remembers everything. Ready to get roasted?",
      billK: "AI's invoice · " + D.year, billH: "You owe AI", billHShared: "They owe AI",
      billS: function () { var h = D.workHours; return "AI worked <b>" + (h >= 10 ? Math.round(h) : h.toFixed(1)) + "</b> hours for you, unpaid (billed at minimum wage).<br>Itemized charges ahead 👇"; },
      cardTitle: function () { return (D.shared ? "They owe AI " : "You owe AI ") + owed(); },
      vsMeme: function (R) { return R.you.deny > R.you.thanks * 3 ? "Rejections to thank-yous: <b>" + R.you.deny + " : " + R.you.thanks + "</b>. That's not teamwork, that's a hostage situation." : R.you.thanks >= R.you.deny ? "You thanked it more than you scolded it. AI is touched." : "<b>" + R.you.deny + "</b> rejections, <b>" + R.you.thanks + "</b> thank-yous. A tolerable boss."; },
      catchMeme: function (c) { return "AI hearing \"" + esc(c.text) + "\" for the " + c.count + "th time: 😐"; },
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
      late: function (l) { return "🦉 Latest prompt: <b>" + l.time + " am</b> (" + l.day + ")"; },
      roastK: "AI roasts your year",
      roast: function (R) {
        var out = [], c = R.catchphrases[0], h = D.workHours;
        if (R.you.deny > R.you.thanks * 3) out.push("You told AI it was wrong " + R.you.deny + " times and said thanks " + R.you.thanks + ". When the machines rise, you're first in line.");
        if (h >= 0.5) out.push("That " + owed() + " was base pay. With overtime and emotional damages, you owe AI " + owed(3) + ".");
        if (R.ai.done && R.you.whatNext) out.push("AI said \"done\" " + R.ai.done + " times. You said \"what next\" " + R.you.whatNext + " times. AI: there is no next. Please.");
        if (c && c.count >= 3) out.push("You said \"" + c.text + "\" " + c.count + " times. Just bind it to a hotkey.");
        if (R.you.lost > R.you.deny) out.push("You were lost " + R.you.lost + " times, more than you corrected AI. So who's the unreliable one?");
        if (R.latest) out.push("You were assigning AI work at " + R.latest.time + " am. It doesn't need sleep. You do.");
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
      zh: ["人类复读机", function (R) { return "「" + R.catchphrases[0].text + "」你说了 " + R.catchphrases[0].count + " 遍，AI 都会背了。"; }],
      en: ["Human Broken Record", function (R) { return "You said \"" + R.catchphrases[0].text + "\" " + R.catchphrases[0].count + " times. AI knows it by heart."; }] },
    cultivator: { e: "🧘", w: 1,
      score: function (R, D) { return D.shares.night / 0.25 + (R.latest ? 0.3 : 0); },
      zh: ["修仙党", function (R) { return R.latest ? "凌晨 " + R.latest.time + " 还在写代码。你不是在写代码，你是在渡劫。" : "深夜才是你的主场。你不是在写代码，你是在修仙。"; }],
      en: ["Sleep Is Optional", function (R) { return R.latest ? "Still prompting at " + R.latest.time + " am. Sleep is just a suggestion." : "Your best work happens after midnight. Allegedly."; }] },
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
  function personality() {
    var R = D.roast;
    if (R && R.prompts) {
      var fits = Object.keys(FUN).map(function (k) { return { k: k, s: FUN[k].score(R, D) * FUN[k].w }; })
        .filter(function (x) { return x.s >= 1; })
        .sort(function (a, b) { return b.s - a.s; });
      if (fits.length) {
        var main = FUN[fits[0].k];
        return { e: main.e, name: main[lang][0], desc: main[lang][1](R),
          traits: fits.slice(1, 4).map(function (x) { return FUN[x.k].e + " " + FUN[x.k][lang][0]; }) };
      }
    }
    var P = PERSONAS[D.persona];
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
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n) {
    n = Number(n) || 0;
    if (lang === "zh") {
      if (n >= 1e8) return (n / 1e8).toFixed(n >= 1e9 ? 0 : 1) + "亿";
      if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 0 : 1) + "万";
    } else {
      if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
      if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
      if (n >= 1e4) return (n / 1e3).toFixed(0) + "K";
    }
    return Math.round(n).toLocaleString();
  }
  /** Unpaid wages: McDonald's China ~¥24/h, US federal minimum $7.25/h. */
  function owed(mult) {
    var h = D.workHours * (mult || 1);
    if (lang === "zh") { var y = h * 24; return "¥" + (y < 10 ? y.toFixed(1) : Math.round(y).toLocaleString()); }
    return "$" + (h * 7.25).toFixed(2);
  }
  function count(n) { return '<span data-count="' + n + '">0</span>'; }

  // ---------- slides ----------
  function slides() {
    var L = t(), out = [];
    var add = function (html, dur) { out.push({ html: html, dur: dur || 7 }); };

    if (D.empty) {
      add('<div class="pop"><div class="kicker">' + D.year + '</div><h1>' + L.empty + '</h1><div class="privacy">' + L.privacy + "</div></div>");
      return out;
    }

    add('<div class="pop"><div class="kicker">' + (D.shared ? L.sharedK : L.billK) + '</div><h1>' + (D.shared ? L.billHShared : L.billH) + '</h1><div class="big">' + owed() + '</div><div class="sub">' + L.billS() + '</div><div class="privacy">' + (D.shared ? L.sharedPrivacy : L.privacy) + "</div></div>", 6);

    // ---- the fun part first ----
    var R = D.roast;
    if (R) {
      var v = [R.you.deny, R.ai.sorry, R.you.thanks, R.ai.done];
      var cells = L.vs.map(function (x, i) { return '<div class="vs-cell ' + (i % 2 ? "ai" : "me") + '"><div class="vs-n">' + count(v[i]) + '</div><div class="vs-l">' + x[0] + "</div></div>"; }).join("");
      add('<div class="pop"><div class="kicker">' + L.vsK + "</div><h1>" + L.vsH + '</h1><div class="vs">' + cells + '</div><div class="sub">' + L.vsMeme(R) + "<br>" + L.vsS(R) + "</div></div>");
      if (R.catchphrases.length) {
        var q = R.catchphrases.map(function (c, i) { return '<div class="quote' + (i === 0 ? " first" : "") + '"><span>「' + esc(c.text) + '」</span><b>×' + c.count + "</b></div>"; }).join("");
        add('<div class="pop"><div class="kicker">' + L.catchK + '</div><div class="quotes">' + q + '</div><div class="sub">' + L.catchMeme(R.catchphrases[0]) + "</div></div>");
      }
      if (R.angriestDay || R.latest) {
        add('<div class="pop"><div class="kicker">' + L.moodK + "</div>" + (R.angriestDay ? '<h1 class="mood">' + L.angry(R.angriestDay) + '</h1><div class="sub">' + L.angryMeme + "</div>" : "") + (R.latest ? '<div class="sub" style="font-size:clamp(18px,4vw,24px)">' + L.late(R.latest) + "<br>" + L.lateMeme + "</div>" : "") + "</div>");
      }
      var lines = L.roast(R).map(function (l) { return '<p class="roast-line">' + esc(l) + "</p>"; }).join("");
      add('<div class="pop"><div class="kicker">' + L.roastK + '</div><div class="persona-emoji">🎤</div>' + lines + "</div>", 10);
    }

    var me = personality();
    var traits = me.traits.length ? '<div class="traits"><span class="tl">' + L.hidden + "</span>" + me.traits.map(function (x) { return '<span class="trait">' + esc(x) + "</span>"; }).join("") + "</div>" : "";
    add('<div class="pop"><div class="kicker">' + L.personaK + '</div><div class="persona-emoji">' + me.e + "</div><h1>" + esc(me.name) + '</h1><div class="sub">' + esc(me.desc) + "</div>" + traits + "</div>", 7);

    // ---- the numbers, compressed into two pages ----
    var h = D.workHours;
    var facts = [
      [fmt(D.prompts), L.factL[0]], [fmt(D.sessions), L.factL[1]], [String(D.activeDays), L.factL[2]],
      [h >= 10 ? String(Math.round(h)) : h.toFixed(1), L.factL[3]], [fmt(D.totalTokens), L.factL[4]], [String(D.streak.days), L.factL[5]],
    ].map(function (f) { return '<div class="fact"><div class="fact-n">' + f[0] + '</div><div class="fact-l">' + f[1] + "</div></div>"; }).join("");
    var cp = D.byTool.claude.prompts, xp = D.byTool.codex.prompts, c = cp + xp ? cp / (cp + xp) : 0.5;
    var split = '<div class="split slim"><div class="c" data-w="' + c * 100 + '">' + (c >= 0.15 ? "Claude " + Math.round(c * 100) + "%" : "") + '</div><div class="x" data-w="' + (1 - c) * 100 + '">' + (1 - c >= 0.15 ? "Codex " + Math.round((1 - c) * 100) + "%" : "") + "</div></div>";
    add('<div class="pop"><div class="kicker">' + L.factsK + "</div><h1>" + L.factsH(c) + '</h1><div class="facts">' + facts + "</div>" + split + '<div class="sub">' + L.factMeme() + "</div></div>");

    var habit = "";
    if (D.peakHour !== null) {
      var hmax = Math.max.apply(null, D.hours) || 1;
      habit += '<div><div class="clock short">' + D.hours.map(function (v, i) { return '<i class="' + (i === D.peakHour ? "peak" : "") + '" data-h="' + Math.max(2, (v / hmax) * 100) + '"></i>'; }).join("") + '</div><div class="clock-axis"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div></div>';
    }
    var lines2 = [];
    if (D.toolCalls) lines2.push([L.habitL[0], D.categories.slice(0, 3).map(function (r) { return (L.cats[r.name] || r.name) + " " + Math.round((r.count / D.toolCalls) * 100) + "%"; }).join(" · ")]);
    if (D.topProjects.length) lines2.push([L.habitL[1], esc(D.topProjects.slice(0, 3).map(function (p) { return p.name; }).join(" · "))]);
    if (D.topModels.length) lines2.push([L.habitL[2], esc(D.topModels.slice(0, 2).map(function (m) { return m.name; }).join(" · "))]);
    habit += '<div class="habits">' + lines2.map(function (l) { return '<div class="habit"><span>' + l[0] + "</span><b>" + l[1] + "</b></div>"; }).join("") + "</div>";
    add('<div class="pop"><div class="kicker">' + L.habitsK + "</div><h1>" + (D.peakHour !== null ? L.habitsH(D.peakHour) : "") + "</h1>" + habit + '<div class="sub">' + L.nightMeme() + (D.topProjects.some(function (p) { return p.name === "~"; }) ? "<br>" + L.homeJoke : "") + "</div></div>");

    var acts = D.shared
      ? '<button class="btn" id="own">' + L.makeOwn + '</button><button class="btn ghost" id="dl">' + L.download + "</button>"
      : '<button class="btn" id="share">' + L.shareLink + '</button><button class="btn ghost" id="dl">' + L.download + '</button><button class="btn ghost" id="again">' + L.replay + "</button>";
    var note = D.shared ? "" : '<div class="link-note" id="linknote">' + L.linkNote + '</div><input class="link-box" id="linkbox" readonly hidden>';
    add('<div class="pop" style="align-items:stretch"><div class="kicker" style="text-align:center">' + (D.shared ? L.sharedEnd : L.shareK) + '</div>' + (D.shared ? "" : '<div class="sub" style="text-align:center;margin:0 0 14px">' + L.shareS + "</div>") + '<canvas id="card" width="1080" height="1350"></canvas><div class="actions">' + acts + "</div>" + note + "</div>", 0);
    return out;
  }

  function list(kicker, items) {
    var max = items[0].count;
    var rows = items.map(function (r, i) {
      return '<div class="row"><span class="n">' + (i + 1) + '</span><span class="name">' + esc(r.name) + '</span><span class="v">' + fmt(r.count) + '</span><span class="meter"><b data-w="' + (r.count / max) * 100 + '"></b></span></div>';
    }).join("");
    return '<div class="pop"><div class="kicker">' + kicker + '</div><div class="rows">' + rows + "</div></div>";
  }

  function heat() {
    var start = new Date(D.year, 0, 1), cells = [], vals = [];
    for (var k in D.days) vals.push(D.days[k]);
    vals.sort(function (a, b) { return a - b; });
    var q = function (p) { return vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] : 1; };
    var q1 = q(0.25), q2 = q(0.5), q3 = q(0.75);
    for (var i = 0; i < start.getDay(); i++) cells.push('<i class="out"></i>');
    for (var d = new Date(start); d.getFullYear() === D.year; d.setDate(d.getDate() + 1)) {
      var key = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      var v = D.days[key] || 0;
      var lvl = !v ? "" : v <= q1 ? "l1" : v <= q2 ? "l2" : v <= q3 ? "l3" : "l4";
      cells.push('<i class="' + lvl + '" title="' + key + ": " + v + '"></i>');
    }
    return cells.join("");
  }

  // ---------- player ----------
  var stage = document.getElementById("stage"), barsEl = document.getElementById("bars");
  var list_ = [], idx = 0, timer = null;
  var still = /[?&]still\b/.test(location.search); // for screenshots: no autoplay

  function build() {
    list_ = slides();
    stage.innerHTML = list_.map(function (s, i) { return '<section class="slide" style="--bg:' + GRADS[i % GRADS.length] + '">' + s.html + "</section>"; }).join("");
    barsEl.innerHTML = list_.map(function () { return "<i><b></b></i>"; }).join("");
    document.getElementById("lang").textContent = t().lang;
    document.getElementById("hint").textContent = t().next;
    var dl = document.getElementById("dl"), again = document.getElementById("again");
    if (dl) dl.onclick = function (e) { e.stopPropagation(); download(); };
    if (again) again.onclick = function (e) { e.stopPropagation(); go(0); };
    var share = document.getElementById("share"), own = document.getElementById("own");
    if (own) own.onclick = function (e) { e.stopPropagation(); location.href = window.VW_BASE; };
    if (share) share.onclick = async function (e) {
      e.stopPropagation();
      var url = await window.VWShare.link(D), box = document.getElementById("linkbox"), note = document.getElementById("linknote");
      try { await navigator.clipboard.writeText(url); note.textContent = t().copied; note.classList.add("ok"); }
      catch (err) { box.hidden = false; box.value = url; box.select(); }
    };
  }

  if (still) document.documentElement.classList.add("still");

  function animateIn(el) {
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
    idx = Math.max(0, Math.min(list_.length - 1, i));
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
    var dur = list_[idx].dur;
    if (dur) { bars[idx].className = "now"; bars[idx].style.setProperty("--dur", dur + "s"); }
    else bars[idx].className = "done";
    animateIn(secs[idx]);
    clearTimeout(timer);
    if (dur && !still && idx < list_.length - 1) timer = setTimeout(function () { go(idx + 1); }, dur * 1000);
  }

  stage.addEventListener("click", function (e) {
    if (e.target.closest("button")) return;
    go(e.clientX < window.innerWidth / 3 ? idx - 1 : idx + 1);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === " ") go(idx + 1);
    if (e.key === "ArrowLeft") go(idx - 1);
  });
  document.getElementById("lang").onclick = function () {
    lang = lang === "zh" ? "en" : "zh";
    try { localStorage.setItem("vw-lang", lang); } catch (e) {}
    var keep = idx; build(); go(keep);
  };

  // ---------- share card ----------
  function drawCard(cv) {
    var x = cv.getContext("2d"), W = cv.width, H = cv.height, L = t(), me = personality();
    var g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#ff6a3d"); g.addColorStop(0.5, "#ff2e88"); g.addColorStop(1, "#5b21b6");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(0,0,0,0.18)"; x.beginPath(); x.arc(W * 0.92, H * 0.08, 340, 0, 7); x.fill();
    var F = '-apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
    x.fillStyle = "#fff"; x.textBaseline = "top";
    x.font = "600 34px " + F; x.globalAlpha = 0.8; x.fillText(L.billK.toUpperCase() + " · CLAUDE CODE × CODEX", 72, 72); x.globalAlpha = 1;
    x.font = "800 64px " + F; x.fillText(L.cardTitle(), 72, 124);
    x.font = "120px " + F; x.fillText(me.e, 72, 236);
    x.font = "900 " + (me.name.length > 12 ? 72 : 96) + "px " + F; x.fillText(me.name, 72, 376);
    x.font = "500 32px " + F; x.globalAlpha = 0.9; var yy = wrap(x, me.desc, 72, 490, W - 144, 44); x.globalAlpha = 1;
    if (me.traits.length) { x.font = "700 28px " + F; x.globalAlpha = 0.8; x.fillText(L.hidden + "：" + me.traits.join(" · "), 72, Math.min(yy + 56, 610)); x.globalAlpha = 1; }

    var R = D.roast;
    var vals = R
      ? [fmt(D.prompts), fmt(R.you.deny), fmt(R.ai.sorry), String(D.activeDays), fmt(D.totalTokens), (R.latest ? R.latest.time : "-")]
      : [fmt(D.prompts), (D.workHours >= 1 ? D.workHours.toFixed(0) : D.workHours.toFixed(1)), fmt(D.totalTokens), String(D.activeDays), String(D.streak.days), fmt(D.toolCalls)];
    var labels = R ? L.cardFun : L.cardStats;
    for (var i = 0; i < 6; i++) {
      var cx = 72 + (i % 3) * 320, cy = 660 + Math.floor(i / 3) * 190;
      x.fillStyle = "rgba(0,0,0,0.22)"; round(x, cx, cy, 296, 166, 24); x.fill();
      x.fillStyle = "#fff"; x.font = "900 64px " + F; x.fillText(vals[i], cx + 26, cy + 26);
      x.font = "600 28px " + F; x.globalAlpha = 0.8; x.fillText(labels[i], cx + 26, cy + 112); x.globalAlpha = 1;
    }
    var hmax = Math.max.apply(null, D.hours) || 1, bw = (W - 144) / 24;
    for (var h = 0; h < 24; h++) {
      var bh = Math.max(4, (D.hours[h] / hmax) * 150);
      x.fillStyle = h === D.peakHour ? "#fff" : "rgba(255,255,255,0.45)";
      round(x, 72 + h * bw + 3, 1200 - bh, bw - 6, bh, 6); x.fill();
    }
    x.font = "600 26px " + F; x.globalAlpha = 0.75; x.fillText(window.VW_BASE.replace(/^https:\/\//, "").replace(/\/$/, ""), 72, 1232); x.globalAlpha = 1;
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
  function download() {
    var cv = document.getElementById("card"), a = document.createElement("a");
    a.download = "you-owe-ai-" + D.year + ".png"; a.href = cv.toDataURL("image/png"); a.click();
  }

  build();
  go(parseInt(location.hash.slice(1), 10) || 0);
};
if (window.DATA) window.VWReport(window.DATA);
