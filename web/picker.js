/* Landing page: pick ~/.claude and ~/.codex, read them in the browser, show the report. */
(function () {
  "use strict";
  var lang = /[?&]lang=(zh|en)/.exec(location.search);
  lang = lang ? lang[1] : (function () {
    try { var s = localStorage.getItem("vw-lang"); if (s) return s; } catch (e) {}
    // first visit: the browser's own language
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    return /^zh\b/i.test(langs[0] || "") ? "zh" : "en";
  })();
  var isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  var isWin = /Win/i.test(navigator.platform || navigator.userAgent);
  function pathFor(kind) { return isWin ? "%USERPROFILE%\\." + kind : "~/." + kind; }
  function keysHtml() {
    var k = function (x) { return "<kbd>" + x + "</kbd>"; };
    return isMac ? k("⌘") + k("⇧") + k("G") + " → " + k("⌘") + k("V") + " → " + k("Enter")
      : isWin ? k("Ctrl") + k("V") + " → " + k("Enter")
      : k("Ctrl") + k("L") + " → " + k("Ctrl") + k("V") + " → " + k("Enter");
  }
  var S = { claude: null, codex: null, web: [], testimony: null };
  var isPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform) && !window.showDirectoryPicker);

  // ---- the friend whose share link brought you here ----
  (function rememberFriendFromLink() {
    var m = /#vs=([A-Za-z0-9_-]+)/.exec(location.hash); // "send to computer" carries the friend along
    if (!m) return;
    try { localStorage.setItem("vw-friend", JSON.stringify({ s: m[1], t: Date.now() })); } catch (e) {}
    history.replaceState(null, "", location.pathname + location.search);
  })();
  function friendCode() {
    try {
      var f = JSON.parse(localStorage.getItem("vw-friend") || "null");
      return f && Date.now() - f.t < 14 * 864e5 ? f.s : null; // forget after two weeks
    } catch (e) { return null; }
  }
  /** Your own bill, saved when you last made it, for comparing with a friend's shared bill. */
  async function loadMine() {
    try {
      var m = JSON.parse(localStorage.getItem("vw-me") || "null");
      if (!m || Date.now() - m.t > 30 * 864e5) return null; // forget after a month
      return await window.VWShare.decode(m.s);
    } catch (e) { return null; }
  }
  async function loadFriend() {
    var code = friendCode();
    if (!code) return null;
    try { return await window.VWShare.decode(code); } catch (e) { return null; }
  }

  var T = {
    zh: {
      title: "你欠 AI 多少钱？", sub: "你和 AI 的年度账单 · " + new Date().getFullYear(),
      pickClaude: "选择 .claude 文件夹", pickCodex: "选择 .codex 文件夹",
      copied: function (kind) { return "📋 已复制 <code>" + pathFor(kind) + "</code>。<b>等选择窗口弹出来后</b>，在窗口里按 " + keysHtml() + "，然后点「" + (isMac ? "选择" : "选择文件夹") + "」"; },
      where: "两个文件夹都在你的用户文件夹里，是隐藏的。点上面的按钮，<b>等选择窗口弹出来之后</b>，按 " + keysHtml() + "，再点「选择」。",
      onlyOne: "只用了其中一个？选一个就行。",
      go: "算算我欠了多少", demo: "先看看示例", reading: "正在读取…", files: function (n) { return "✓ 读取了 " + n + " 个文件"; },
      wrong: function (k) { return "这个文件夹里没找到 " + k + " 的记录，确认选的是 ." + k + " 吗？"; },
      privacy: "🔒 所有计算都在你的浏览器里完成。这个页面被浏览器禁止联网，你的数据发不出去。可以打开开发者工具的 Network 面板验证。",
      privacyClock: "🔒 所有计算都在你的浏览器里完成，聊天内容发不出去。页面只会匿名上报你的账单总额，用来算全人类欠 AI 多少，看完账单可以撤回。",
      clockHome: function (n, m, r) { return "🧾 已有 <b>" + n.toLocaleString("en-US") + "</b> 人收到 AI 的账单，共欠 AI <b>" + m + "</b>" + (r === null ? "" : "，其中 <b>" + r + "%</b> 表示就是不还"); },
      cli: "习惯用终端？", lang: "EN",
      importWeb: "📦 导入 ChatGPT / Claude 聊天记录",
      phoneImport: "📦 导入 ChatGPT / Claude 聊天记录", toPC: "💻 发到电脑上打开", pcCopied: "✓ 链接已复制，发到电脑上打开就行", updated: function (x) { return "🧾 账单已更新：现在你欠 AI " + x; },
      webGot: function (n) { return "✓ 已导入 " + n + " 段网页对话"; },
      testify: "🧑‍⚖️ 让 AI 出庭作证",
      secFast: "⚡ 最快 · 30 秒，AI 凭记忆估算", secWeb: "📦 最准 · 导入网页聊天记录，要等一封邮件", secCode: "💻 写代码的 · Claude Code / Codex", secCodePhone: "💻 写代码的 · Claude Code / Codex 的记录在电脑上",
    },
    en: {
      title: "How much do you owe AI?", sub: "Your year with AI, itemized · " + new Date().getFullYear(),
      pickClaude: "Choose your .claude folder", pickCodex: "Choose your .codex folder",
      copied: function (kind) { return "📋 Copied <code>" + pathFor(kind) + "</code>. <b>Once the file window is open</b>, press " + keysHtml() + " inside it, then click Select."; },
      where: "Both are hidden in your home folder. Click a button above, <b>wait for the file window to open</b>, then press " + keysHtml() + " and click Select.",
      onlyOne: "Only use one of them? Just pick that one.",
      go: "Show me the bill", demo: "See a demo", reading: "Reading…", files: function (n) { return "✓ Read " + n + " files"; },
      wrong: function (k) { return "No " + k + " logs in that folder. Did you pick ." + k + "?"; },
      privacy: "🔒 Everything is computed in your browser. This page is blocked from the network, so your data can't leave. Check the Network tab in DevTools.",
      privacyClock: "🔒 Everything is computed in your browser, and your chats can't leave it. Only your bill's total is sent, anonymously, to add up what humanity owes AI. You can withdraw it after.",
      clockHome: function (n, m, r) { return "🧾 <b>" + n.toLocaleString("en-US") + "</b> people got their AI bill. Together they owe AI <b>" + m + "</b>" + (r === null ? "" : ", and <b>" + r + "%</b> refuse to pay"); },
      cli: "Prefer the terminal?", lang: "中文",
      importWeb: "📦 Import ChatGPT / Claude chats",
      phoneImport: "📦 Import ChatGPT / Claude chats", toPC: "💻 Send to my computer", pcCopied: "✓ Link copied. Open it on your computer.", updated: function (x) { return "🧾 Bill updated: you now owe AI " + x; },
      webGot: function (n) { return "✓ Imported " + n + " web conversations"; },
      testify: "🧑‍⚖️ Make AI testify",
      secFast: "⚡ Fastest · 30 sec, AI estimates from memory", secWeb: "📦 Most accurate · import your web chats (needs one email)", secCode: "💻 For coders · Claude Code / Codex", secCodePhone: "💻 For coders · Claude Code / Codex logs live on your computer",
    },
  };
  function t() { return T[lang]; }
  function langSwitch(cur) { return '<span class="' + (cur === "en" ? "on" : "") + '">EN</span><span class="' + (cur === "zh" ? "on" : "") + '">中</span>'; }

  // ---------- reading folders ----------
  // Which files we need, relative to the picked folder.
  var WANT = {
    claude: function (rel) { return rel === "history.jsonl" ? "history" : /^projects\/.+\.jsonl$/.test(rel) ? "log" : null; },
    codex: function (rel) { return rel === "history.jsonl" ? "history" : /^(sessions|archived_sessions)\/.+\.jsonl$/.test(rel) ? "log" : null; },
  };
  var SUBDIRS = { claude: ["projects"], codex: ["sessions", "archived_sessions"] };

  async function walk(dir, prefix, out) {
    for await (var entry of dir.values()) {
      var rel = prefix + entry.name;
      if (entry.kind === "directory") await walk(entry, rel + "/", out);
      else if (/\.jsonl$/.test(entry.name)) out.push({ rel: rel, file: await entry.getFile() });
    }
  }

  /** File System Access API (Chrome, Edge): only walk the subfolders we need. */
  async function pickWithHandle(kind) {
    var dir = await window.showDirectoryPicker({ id: kind, mode: "read" });
    try { dir = await dir.getDirectoryHandle("." + kind); } catch (e) { /* picked the home folder? no: use as is */ }
    var out = [];
    if (dir.name === "projects" || dir.name === "sessions") { await walk(dir, dir.name + "/", out); return out; }
    try { out.push({ rel: "history.jsonl", file: await (await dir.getFileHandle("history.jsonl")).getFile() }); } catch (e) {}
    for (var i = 0; i < SUBDIRS[kind].length; i++) {
      try { await walk(await dir.getDirectoryHandle(SUBDIRS[kind][i]), SUBDIRS[kind][i] + "/", out); } catch (e) {}
    }
    return out;
  }

  /** Fallback (Safari, Firefox): <input webkitdirectory>. */
  function pickWithInput() {
    return new Promise(function (resolve) {
      var input = document.createElement("input");
      input.type = "file";
      input.webkitdirectory = true;
      input.multiple = true;
      input.onchange = function () {
        resolve(Array.prototype.map.call(input.files, function (f) {
          var parts = (f.webkitRelativePath || f.name).split("/");
          parts.shift(); // drop the picked folder's own name
          if (parts[0] === ".claude" || parts[0] === ".codex") parts.shift();
          return { rel: parts.join("/"), file: f };
        }));
      };
      input.click();
    });
  }

  async function pick(kind) {
    var btn = document.getElementById("pick-" + kind), status = document.getElementById("st-" + kind);
    var entries;
    try { if (navigator.clipboard) navigator.clipboard.writeText(pathFor(kind)).catch(function () {}); } catch (e) {}
    status.innerHTML = t().copied(kind);
    status.className = "st hint";
    try {
      entries = window.showDirectoryPicker ? await pickWithHandle(kind) : await pickWithInput();
    } catch (e) {
      if (e && e.name === "AbortError") return;
      status.textContent = String(e.message || e);
      return;
    }
    status.textContent = t().reading;
    var logs = [], history = [];
    for (var i = 0; i < entries.length; i++) {
      var role = WANT[kind](entries[i].rel);
      if (!role) continue;
      var records = VWParse.parseJsonl(await entries[i].file.text());
      if (role === "history") history = records;
      else logs.push({ path: entries[i].rel, records: records });
    }
    if (!logs.length && !history.length) {
      status.textContent = t().wrong(kind);
      status.className = "st bad";
      return;
    }
    S[kind] = { files: logs, history: history };
    status.textContent = t().files(logs.length + (history.length ? 1 : 0));
    status.className = "st ok";
    btn.classList.add("done");
    document.getElementById("go").disabled = false;
  }

  // ---------- compute + show ----------
  function makeStats() {
    var c = S.claude || { files: [], history: [] }, x = S.codex || { files: [], history: [] };
    var cl = VWParse.parseClaude(c.files, c.history), cx = VWParse.parseCodex(x.files);
    var sessions = cl.sessions.concat(cx.sessions), prompts = cl.prompts.concat(cx.prompts);
    var texts = VWParse.promptTexts(c.history, x.history), replies = VWParse.replyTexts(c.files, x.files);
    // every import, each conversation once (the same export twice, or two overlapping exports, don't add up)
    var web = VWWebChat.merge(S.web);
    sessions = sessions.concat(web.sessions); prompts = prompts.concat(web.prompts); texts = texts.concat(web.texts); replies = replies.concat(web.replies);
    // AI testimony: an estimate, used only when there are no real records from that AI.
    // With real records it's cross-examined instead (the "perjury" page), never counted twice.
    var tm = S.testimony, tool = tm && VWTestimony.toolOf(tm.ai);
    var year = VWStats.defaultYear(prompts);
    var realN = tm ? prompts.filter(function (p) { return p.tool === tool && new Date(p.ts).getFullYear() === year; }).length : 0;
    if (tm && !realN) { var tr = VWTestimony.toRecords(tm); sessions = sessions.concat(tr.sessions); prompts = prompts.concat(tr.prompts); year = VWStats.defaultYear(prompts); }
    var stats = VWStats.computeStats({ sessions: sessions, prompts: prompts }, { year: year });
    stats.roast = VWRoast.computeRoast(texts, replies, { year: year });
    if (tm && !realN) { stats.roast = VWTestimony.mergeRoast(stats.roast, tm); stats.testimony = { ai: tm.ai, line: tm.line }; }
    if (tm && realN) {
      var mine = VWWebChat.merge(S.web, tool);
      var rr = VWRoast.computeRoast(mine.texts, mine.replies, { year: year });
      stats.perjury = { ai: tm.ai, line: tm.line, said: [tm.prompts, tm.deny, tm.thanks], real: [realN, rr ? rr.you.deny : 0, rr ? rr.you.thanks : 0] };
    }
    var ways = [];
    if (stats.testimony) ways.push("testimony");
    if (S.web.length) ways.push("import");
    if (S.claude || S.codex) ways.push("folders");
    stats.via = ways.length === 1 ? ways[0] : "mixed";
    return stats;
  }

  async function show(stats, real) {
    if (real) { var f = await loadFriend(); if (f) stats.friend = f; }
    var land = document.getElementById("landing");
    if (land) land.remove();
    document.body.classList.add("playing");
    window.VWReport(stats);
    // a few seconds into a real bill, the web AI calls to collect on your web chats
    // on an AI-testimony bill, it's the court calling instead, to cross-examine the witness with the real records
    if (real && !S.web.length && window.VWCall) setTimeout(function () { window.VWCall.incoming(addWeb, stats.testimony && VWTestimony.exportable(stats.testimony.ai) ? { ai: VWTestimony.name(stats.testimony.ai, lang) } : null); }, 6000);
  }

  function addWeb(r) {
    S.web = S.web.concat(r);
    show(makeStats(), true);
    window.VWCall.toast(t().updated(window.VW_TOTAL));
  }

  function renderPhone() {
    var L = t();
    document.getElementById("landing").innerHTML =
      '<button class="chip lang seg" id="l-lang" aria-label="' + (lang === "zh" ? "Switch to English" : "切换到中文") + '">' + langSwitch(lang) + "</button>" +
      '<div class="land">' +
      '<div class="kicker">' + L.sub + "</div>" +
      "<h1>" + L.title + "</h1>" + '<p class="clock-home" id="hclock" hidden></p>' +
      '<div class="steps">' +
      '<div class="sec">' + L.secFast + '</div><button class="pick web main" id="tf-open">' + L.testify + "</button>" +
      '<div class="sec">' + L.secWeb + '</div><button class="pick web" id="web">' + L.phoneImport + '</button><div class="st" id="st-web"></div>' +
      '<button class="btn go" id="go" disabled>' + L.go + "</button>" +
      '<div class="sec">' + L.secCodePhone + '</div><button class="btn ghost" id="pc">' + L.toPC + '</button><div class="st" id="st-pc"></div>' +
      '<button class="btn ghost" id="demo">' + L.demo + "</button>" +
      "</div>" +
      '<p class="privacy">' + (window.VWClock && window.VWClock.live ? L.privacyClock : L.privacy) + "</p>" +
      "</div>";
    document.getElementById("pc").onclick = async function () {
      var code = friendCode(), url = window.VW_BASE + (code ? "#vs=" + code : "");
      try {
        if (navigator.share) { await navigator.share({ title: "You Owe AI", text: L.title, url: url }); return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(url); } catch (e) {}
      var st = document.getElementById("st-pc"); st.textContent = L.pcCopied; st.className = "st ok";
    };
  }

  function render() {
    var L = t();
    window.VW_LANG = lang; // the import screen opened from here speaks the same language
    if (isPhone) { renderPhone(); return wire(L); }
    document.getElementById("landing").innerHTML =
      '<button class="chip lang seg" id="l-lang" aria-label="' + (lang === "zh" ? "Switch to English" : "切换到中文") + '">' + langSwitch(lang) + "</button>" +
      '<div class="land">' +
      '<div class="kicker">' + L.sub + "</div>" +
      "<h1>" + L.title + "</h1>" + '<p class="clock-home" id="hclock" hidden></p>' +
      '<div class="steps">' +
      '<div class="sec">' + L.secFast + '</div><button class="pick web main" id="tf-open">' + L.testify + "</button>" +
      '<div class="sec">' + L.secWeb + '</div><button class="pick web" id="web">' + L.importWeb + '</button><div class="st" id="st-web"></div>' +
      '<div class="sec">' + L.secCode + "</div>" +
      '<button class="pick" id="pick-claude"><span class="ico">🧡</span>' + L.pickClaude + '</button><div class="st" id="st-claude"></div>' +
      '<button class="pick" id="pick-codex"><span class="ico">🖤</span>' + L.pickCodex + '</button><div class="st" id="st-codex"></div>' +
      '<p class="where">' + L.where + "<br>" + L.onlyOne + "</p>" +
      '<button class="btn go" id="go" disabled>' + L.go + "</button>" +
      '<button class="btn ghost" id="demo">' + L.demo + "</button>" +
      "</div>" +
      '<p class="privacy">' + (window.VWClock && window.VWClock.live ? L.privacyClock : L.privacy) + "</p>" +
      '<p class="cli">' + L.cli + " <code>npx github:Domy-MANS/you-owe-ai</code></p>" +
      "</div>";
    wire(L);
  }

  // the debt clock on the home page
  var clockStats = null;
  function homeClock() {
    var el = document.getElementById("hclock");
    if (!el || !window.VWClock || !window.VWClock.live) return;
    var fill = function () { if (clockStats && clockStats.n > 0) { var voted = (clockStats.guilty || 0) + (clockStats.refuse || 0);
      el.innerHTML = t().clockHome(clockStats.n, window.VWClock.money(clockStats.sum, lang), voted ? Math.round(((clockStats.refuse || 0) / voted) * 100) : null); el.hidden = false; } };
    if (clockStats) fill(); else window.VWClock.stats().then(function (s) { clockStats = s; fill(); }, function () {});
  }

  function wire(L) {
    homeClock();
    if (document.getElementById("pick-claude")) {
      document.getElementById("pick-claude").onclick = function () { pick("claude"); };
      document.getElementById("pick-codex").onclick = function () { pick("codex"); };
    }
    document.getElementById("go").onclick = function () { show(makeStats(), true); };
    document.getElementById("tf-open").onclick = function () {
      window.VWTestify.open(function (tm) { S.testimony = tm; show(makeStats(), true); });
    };
    document.getElementById("web").onclick = function () {
      window.VWCall.answer(function (r) {
        S.web = S.web.concat(r);
        var st = document.getElementById("st-web"); st.textContent = t().webGot(VWWebChat.merge(S.web).sessions.length); st.className = "st ok";
        document.getElementById("go").disabled = false;
      }, { quiet: true });
    };
    document.getElementById("demo").onclick = function () { show(window.VW_DEMO); };
    window.VWToggleLang = function () {
      lang = lang === "zh" ? "en" : "zh"; window.VW_LANG = lang;
      try { localStorage.setItem("vw-lang", lang); } catch (e) {}
      render(); window.dispatchEvent(new Event("vw-lang"));
    };
    document.getElementById("l-lang").onclick = window.VWToggleLang;
  }

  window.__vw = { S: S, show: show, makeStats: makeStats }; // used by the browser tests

  var shared = window.VWShare.fromHash();
  if (shared) shared.then(async function (them) {
    var me = await loadMine();
    if (me && JSON.stringify(window.VWShare.pack(me)) !== JSON.stringify(window.VWShare.pack(them))) them.me = me; // not your own link
    show(them);
  }, function () { history.replaceState(null, "", location.pathname); render(); });
  else if (/[?&]demo\b/.test(location.search)) show(window.VW_DEMO);
  else render();
})();
