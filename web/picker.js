/* Landing page: pick ~/.claude and ~/.codex, read them in the browser, show the report. */
(function () {
  "use strict";
  var lang = /[?&]lang=(zh|en)/.exec(location.search);
  lang = lang ? lang[1] : /^zh/i.test(navigator.language || "") ? "zh" : "en";
  var isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  var S = { claude: null, codex: null };

  var T = {
    zh: {
      title: "你的 AI 编程年度报告", sub: "Claude Code × Codex · " + new Date().getFullYear(),
      pickClaude: "选择 .claude 文件夹", pickCodex: "选择 .codex 文件夹",
      where: isMac ? "在你的用户文件夹里（/Users/你的名字）。看不到？在选择窗口里按 <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>.</kbd> 显示隐藏文件夹。"
        : "在你的用户文件夹里（C:\\Users\\你的名字 或 /home/你的名字）。看不到的话，打开「显示隐藏文件」。",
      onlyOne: "只用了其中一个？选一个就行。",
      go: "生成我的报告", demo: "先看看示例", reading: "正在读取…", files: function (n) { return "✓ 读取了 " + n + " 个文件"; },
      wrong: function (k) { return "这个文件夹里没找到 " + k + " 的记录，确认选的是 ." + k + " 吗？"; },
      privacy: "🔒 所有计算都在你的浏览器里完成。这个页面被浏览器禁止联网，你的数据发不出去。可以打开开发者工具的 Network 面板验证。",
      cli: "习惯用终端？", lang: "EN",
    },
    en: {
      title: "Your AI Coding Wrapped", sub: "Claude Code × Codex · " + new Date().getFullYear(),
      pickClaude: "Choose your .claude folder", pickCodex: "Choose your .codex folder",
      where: isMac ? "They're in your home folder. Can't see them? Press <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>.</kbd> in the picker to show hidden folders."
        : "They're in your home folder (C:\\Users\\you or /home/you). Turn on \"show hidden files\" if you can't see them.",
      onlyOne: "Only use one of them? Just pick that one.",
      go: "Make my Wrapped", demo: "See a demo", reading: "Reading…", files: function (n) { return "✓ Read " + n + " files"; },
      wrong: function (k) { return "No " + k + " logs in that folder. Did you pick ." + k + "?"; },
      privacy: "🔒 Everything is computed in your browser. This page is blocked from the network, so your data can't leave. Check the Network tab in DevTools.",
      cli: "Prefer the terminal?", lang: "中文",
    },
  };
  function t() { return T[lang]; }

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
    var year = new Date().getFullYear();
    var c = S.claude || { files: [], history: [] }, x = S.codex || { files: [], history: [] };
    var cl = VWParse.parseClaude(c.files, c.history), cx = VWParse.parseCodex(x.files);
    var stats = VWStats.computeStats({ sessions: cl.sessions.concat(cx.sessions), prompts: cl.prompts.concat(cx.prompts) }, { year: year });
    stats.roast = VWRoast.computeRoast(VWParse.promptTexts(c.history, x.history), VWParse.replyTexts(c.files, x.files), { year: year });
    return stats;
  }

  function show(stats) {
    document.getElementById("landing").remove();
    document.body.classList.add("playing");
    window.VWReport(stats);
  }

  function render() {
    var L = t();
    document.getElementById("landing").innerHTML =
      '<button class="chip lang" id="l-lang">' + L.lang + "</button>" +
      '<div class="land">' +
      '<div class="kicker">' + L.sub + "</div>" +
      "<h1>" + L.title + "</h1>" +
      '<div class="steps">' +
      '<button class="pick" id="pick-claude"><span class="ico">🧡</span>' + L.pickClaude + '</button><div class="st" id="st-claude"></div>' +
      '<button class="pick" id="pick-codex"><span class="ico">🖤</span>' + L.pickCodex + '</button><div class="st" id="st-codex"></div>' +
      '<p class="where">' + L.where + "<br>" + L.onlyOne + "</p>" +
      "</div>" +
      '<button class="btn go" id="go" disabled>' + L.go + "</button>" +
      '<button class="btn ghost" id="demo">' + L.demo + "</button>" +
      '<p class="privacy">' + L.privacy + "</p>" +
      '<p class="cli">' + L.cli + " <code>npx vibe-wrapped</code></p>" +
      "</div>";
    document.getElementById("pick-claude").onclick = function () { pick("claude"); };
    document.getElementById("pick-codex").onclick = function () { pick("codex"); };
    document.getElementById("go").onclick = function () { show(makeStats()); };
    document.getElementById("demo").onclick = function () { show(window.VW_DEMO); };
    document.getElementById("l-lang").onclick = function () { lang = lang === "zh" ? "en" : "zh"; render(); };
  }

  if (/[?&]demo\b/.test(location.search)) show(window.VW_DEMO);
  else render();
})();
