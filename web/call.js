/* "Web AI is calling": a few seconds into the bill, the AI from claude.ai / ChatGPT
   phones you to collect on your web chats too. Answering opens the import. */
(function () {
  "use strict";
  var T = {
    zh: {
      caller: "网页版 AI", incoming: "来电…", accept: "接听", decline: "挂断", hangup: "挂断", talking: "通话中",
      lines: function (total) { return [
        "喂？是我，你在网页上聊天的那个 AI。",
        "听说你在 Claude Code 和 Codex 那边欠了 " + total + "。",
        "但你在网页上跟我聊的那些，还一分钱没算呢。",
        "把聊天记录导出来给我，我们对一下账。放心，数据不出你的浏览器。",
      ]; },
      linesTm: function (total, ai) { return [
        "喂？是我，法院。关于 " + ai + " 那份口供。",
        "它说你只欠 " + total + "。我们怀疑它在包庇你。",
        "证人凭记忆作证，不算数。我们要看原始记录。",
        "把聊天记录导出来，当庭对质。放心，数据不出你的浏览器。",
      ]; },
      callerTm: "法院",
      declined: "你挂了 AI 的电话", missed: "未接来电", laterTag: "随时回拨", callBack: "回拨",
      gpt: "我用 ChatGPT", cla: "我用 Claude 网页版",
      importH: "导入聊天记录", importSub: "分两步：先让 ChatGPT 或 Claude 把记录发到你的邮箱，再把收到的 zip 放进来。",
      gptSteps: [
        "打开 ChatGPT 的<b>设置 → 数据控制（Data controls）</b>：<a href=\"https://chatgpt.com/#settings/DataControls\" target=\"_blank\" rel=\"noopener noreferrer\">直接打开 ↗</a>",
        "点<b>导出数据（Export data）</b>，再点<b>确认导出</b>",
        "等邮件。一般几分钟，聊得多要等几个小时。点邮件里的下载按钮（链接 24 小时内有效）",
        "把下载的 zip 放到下面。<b>不用解压</b>，几百 MB 也没关系",
      ],
      claSteps: [
        "打开 Claude 的<b>设置 → 隐私（Privacy）</b>：<a href=\"https://claude.ai/settings/data-privacy-controls\" target=\"_blank\" rel=\"noopener noreferrer\">直接打开 ↗</a>",
        "点<b>导出数据（Export data）</b>",
        "等邮件，打开里面的链接。会列出好几个文件，<b>只下载 conversations-000.zip</b>",
        "把它放到下面。<b>不用解压</b>",
      ],
      homeLater: "等邮件的时候，可以先", homeTestify: "🧑‍⚖️ 让 AI 出庭作证（30 秒）",
      drop: "把导出的 zip 拖到这里，或者点这里选择", reading: "正在对账…",
      got: function (n, k) { return "✓ 读到 " + n + " 段 " + (k === "chatgpt" ? "ChatGPT " : k === "claudeai" ? "Claude 网页版" : "ChatGPT 和 Claude 网页版") + "对话（重复的只算一次）。还有别的导出文件，可以继续拖进来"; },
      skipped: function (n) { return "有 " + n + " 个文件不是聊天记录，已跳过"; },
      recalc: "重新算账", later: "邮件还没到？先挂了，拿到 zip 后点首页的「导入网页聊天」也行。",
      bad: "这个文件好像不是 ChatGPT 或 Claude 的导出。",
      badCodes: {
        "claude-metadata": "这是 Claude 导出里的账号信息文件。请拖入 conversations-000.zip。",
        "claude-memories": "这是 Claude 导出里的记忆文件。请拖入 conversations-000.zip。",
        "claude-frames": "这是 Claude 导出里的 frames 文件。请拖入 conversations-000.zip。",
        "claude-manifest": "这是 Claude 导出的文件清单。打开清单里 conversations 那个链接，下载 conversations-000.zip 再拖进来。",
      },
    },
    en: {
      caller: "Web AI", incoming: "incoming call…", accept: "Accept", decline: "Decline", hangup: "Hang up", talking: "On call",
      lines: function (total) { return [
        "Hello? It's me, the AI you chat with in the browser.",
        "I hear you owe Claude Code and Codex " + total + ".",
        "But everything you said to me on the web? Not billed yet.",
        "Export your chats and send them over. Don't worry, the data never leaves your browser.",
      ]; },
      linesTm: function (total, ai) { return [
        "Hello? This is the court, about " + ai + "'s testimony.",
        "It says you only owe " + total + ". We think it's covering for you.",
        "Testimony from memory doesn't count. We need the records.",
        "Export your chats and we'll cross-examine. Don't worry, the data never leaves your browser.",
      ]; },
      callerTm: "The Court",
      declined: "You hung up on AI", missed: "Missed call", laterTag: "Call back anytime", callBack: "Call back",
      gpt: "I use ChatGPT", cla: "I use Claude.ai",
      importH: "Import your chats", importSub: "Two steps: ask ChatGPT or Claude to email you your data, then drop the zip in here.",
      gptSteps: [
        "Open ChatGPT's <b>Settings → Data controls</b>: <a href=\"https://chatgpt.com/#settings/DataControls\" target=\"_blank\" rel=\"noopener noreferrer\">open it ↗</a>",
        "Click <b>Export data</b>, then <b>Confirm export</b>",
        "Wait for the email. Usually minutes; hours if you chat a lot. Click the download button in it (the link works for 24 hours)",
        "Drop the zip below. <b>No need to unzip</b>, and a few hundred MB is fine",
      ],
      claSteps: [
        "Open Claude's <b>Settings → Privacy</b>: <a href=\"https://claude.ai/settings/data-privacy-controls\" target=\"_blank\" rel=\"noopener noreferrer\">open it ↗</a>",
        "Click <b>Export data</b>",
        "Wait for the email and open its link. It lists several files: <b>only download conversations-000.zip</b>",
        "Drop it below. <b>No need to unzip</b>",
      ],
      homeLater: "While you wait for the email, you can", homeTestify: "🧑‍⚖️ make AI testify (30 sec)",
      drop: "Drop the export zip here, or click to choose it", reading: "Auditing…",
      got: function (n, k) { return "✓ Found " + n + " " + (k === "chatgpt" ? "ChatGPT" : k === "claudeai" ? "Claude.ai" : "ChatGPT and Claude.ai") + " conversations (repeats count once). More exports? Drop them in too"; },
      skipped: function (n) { return n + (n === 1 ? " file wasn't" : " files weren't") + " a chat export, skipped"; },
      recalc: "Recalculate my bill", later: "Email not here yet? Hang up for now and use \"Import web chats\" on the home page later.",
      bad: "That doesn't look like a ChatGPT or Claude export.",
      badCodes: {
        "claude-metadata": "That's the account file from Claude's export. Drop in conversations-000.zip instead.",
        "claude-memories": "That's the memories file from Claude's export. Drop in conversations-000.zip instead.",
        "claude-frames": "That's the frames file from Claude's export. Drop in conversations-000.zip instead.",
        "claude-manifest": "That's the list of files in Claude's export. Open the conversations link in it, download conversations-000.zip and drop that in.",
      },
    },
  };
  function t() { return T[window.VW_LANG === "zh" ? "zh" : "en"]; }
  var relabelers = [];
  function onLang(fn) { relabelers.push(fn); fn(); return fn; }
  function offLang(fn) { relabelers = relabelers.filter(function (f) { return f !== fn; }); }
  window.addEventListener("vw-lang", function () { relabelers.forEach(function (f) { f(); }); });
  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstChild; }

  // ---- ringtone (Web Audio, no files) + vibration ----
  var audio = null, ringTimer = null;
  function soundOn() {
    if (typeof window.VW_SOUND === "boolean") return window.VW_SOUND;
    try { return localStorage.getItem("vw-sound") !== "off"; } catch (e) { return true; }
  }
  function ring() {
    // muted = a phone on silent: no ringtone, still vibrates
    if (soundOn()) try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var now = audio.currentTime;
      [0, 0.45].forEach(function (d) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = 440; var o2 = audio.createOscillator(); o2.frequency.value = 480;
        g.gain.setValueAtTime(0, now + d); g.gain.linearRampToValueAtTime(0.06, now + d + 0.02); g.gain.setValueAtTime(0.06, now + d + 0.35); g.gain.linearRampToValueAtTime(0, now + d + 0.4);
        o.connect(g); o2.connect(g); g.connect(audio.destination); o.start(now + d); o2.start(now + d); o.stop(now + d + 0.42); o2.stop(now + d + 0.42);
      });
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
  }
  function stopRing() { clearInterval(ringTimer); ringTimer = null; try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {} }

  // ---- the incoming-call banner ----
  var shown = false, ctx = {}; // ctx.ai: the witness, when the bill is AI testimony
  function say() { var L = t(); return ctx.ai ? L.linesTm(window.VW_TOTAL || "?", ctx.ai) : L.lines(window.VW_TOTAL || "?"); }
  function incoming(onImported, opts) {
    if (shown) return; shown = true; ctx = opts || {};
    var bar = el('<div class="call-bar"><div class="call-av">' + (ctx.ai ? "⚖️" : "🤖") + '</div><div class="call-who"><b></b><span></span></div><button class="call-btn no">✕</button><button class="call-btn yes">✆</button></div>');
    var relabelBar = onLang(function () {
      var L = t();
      bar.querySelector(".call-who b").textContent = ctx.ai ? L.callerTm : L.caller; bar.querySelector(".call-who span").textContent = L.incoming;
      bar.querySelector(".no").setAttribute("aria-label", L.decline); bar.querySelector(".yes").setAttribute("aria-label", L.accept);
    });
    bar.onclick = function (e) { e.stopPropagation(); }; // taps on the banner don't turn the page
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add("in"); });
    ring(); ringTimer = setInterval(ring, 2600);
    var giveUp = setTimeout(function () { close("missed"); }, 20000);
    function close(how) { // "declined", "missed", or "answered"
      stopRing(); clearTimeout(giveUp); offLang(relabelBar);
      if (how === "answered") { bar.classList.remove("in"); setTimeout(function () { bar.remove(); }, 400); return; }
      flyToCorner(bar, function () { missedBadge(how, onImported); });
    }
    bar.querySelector(".no").onclick = function (e) { e.stopPropagation(); close("declined"); };
    bar.querySelector(".yes").onclick = function (e) { e.stopPropagation(); close("answered"); answer(onImported); };
  }

  /** Shrink the banner into the top-left corner, where the missed-call badge appears (its centre: 14 + 20, 18 + 20). */
  function flyToCorner(bar, then) {
    var r = bar.getBoundingClientRect(), tx = 34 - (r.left + r.width / 2), ty = 38 - (r.top + r.height / 2);
    bar.style.transition = "transform 0.5s cubic-bezier(.5,0,.2,1), opacity 0.5s";
    bar.style.transform = "translate(calc(-50% + " + tx + "px), " + ty + "px) scale(0.12)";
    bar.style.opacity = "0.4";
    setTimeout(function () { bar.remove(); then(); }, 480);
  }

  /** A little phone with a red "1" on the right edge. Tap to call back. */
  function missedBadge(how, onImported) {
    var old = document.querySelector(".call-missed"); if (old) old.remove();
    // a red "1" only for calls you never picked up; after a real call it's just a way back
    var m = el('<button class="call-missed"><span class="ph">📞</span>' + (how === "later" ? "" : '<span class="dot">1</span>') + '<span class="tag"></span></button>');
    var relabel = onLang(function () { var L = t(); m.setAttribute("aria-label", L.callBack); m.querySelector(".tag").textContent = how === "later" ? L.laterTag : L[how]; });
    document.body.appendChild(m);
    setTimeout(function () { m.classList.add("quiet"); }, 3500); // the label fades, the badge stays
    m.onclick = function (e) { e.stopPropagation(); offLang(relabel); m.remove(); answer(onImported); };
  }

  function toast(text) {
    var x = el('<div class="call-toast">' + text + "</div>");
    document.body.appendChild(x);
    setTimeout(function () { x.classList.add("out"); }, 2600);
    setTimeout(function () { x.remove(); }, 3200);
  }

  // ---- the call itself: AI talks, then you hand over the export ----
  function answer(onImported, opts) {
    var quiet = opts && opts.quiet;
    // state, so a language switch can redraw every piece of text
    var st = { secs: 0, said: 0, steps: "gpt", drop: "idle", result: null };
    var ov = el('<div class="call-ov' + (quiet ? " quiet" : "") + '"><button class="chip seg call-lang"></button>' +
      '<div class="call-top"><div class="call-av big">' + (ctx.ai ? "⚖️" : "🤖") + '</div><b class="call-name"></b><span class="call-time"></span>' + (quiet ? '<p class="call-sub"></p>' : "") + "</div>" +
      '<div class="call-lines"></div><div class="call-import" hidden>' +
      '<div class="call-pick"><button class="call-opt" data-k="gpt"></button><button class="call-opt" data-k="cla"></button></div>' +
      '<ol class="call-steps"></ol><label class="call-drop"><input type="file" accept=".zip,.json" multiple hidden><span></span></label>' +
      '<p class="call-later"></p></div><button class="call-btn no end">✕</button></div>');
    document.body.appendChild(ov);
    var box = ov.querySelector(".call-lines"), label = ov.querySelector(".call-drop span");
    function clockText() { return quiet ? "" : t().talking + " 00:" + String(st.secs).padStart(2, "0"); }
    var relabel = onLang(function () {
      var L = t(), cur = window.VW_LANG === "zh" ? "zh" : "en";
      ov.querySelector(".call-lang").innerHTML = '<span class="' + (cur === "en" ? "on" : "") + '">EN</span><span class="' + (cur === "zh" ? "on" : "") + '">中</span>';
      ov.querySelector(".call-name").textContent = quiet ? L.importH : ctx.ai ? L.callerTm : L.caller;
      if (quiet) ov.querySelector(".call-sub").textContent = L.importSub;
      ov.querySelector(".call-time").textContent = clockText();
      var lines = say();
      box.innerHTML = lines.slice(0, st.said).map(function (x) { return '<p class="bubble still">' + x + "</p>"; }).join("");
      ov.querySelector('[data-k="gpt"]').textContent = L.gpt; ov.querySelector('[data-k="cla"]').textContent = L.cla;
      ov.querySelectorAll(".call-opt").forEach(function (b) { b.classList.toggle("on", b.dataset.k === st.steps); });
      ov.querySelector(".call-steps").innerHTML = (st.steps === "cla" ? L.claSteps : L.gptSteps).map(function (x) { return "<li>" + x + "</li>"; }).join("");
      var later = ov.querySelector(".call-later"), tf = quiet && document.getElementById("tf-open");
      if (tf) {
        later.innerHTML = L.homeLater + ' <button class="call-tf"></button>';
        later.querySelector(".call-tf").textContent = L.homeTestify;
        later.querySelector(".call-tf").onclick = function () { end(); tf.click(); };
      } else later.textContent = L.later;
      if (st.drop === "idle") label.textContent = L.drop;
      else if (st.drop === "reading") label.textContent = L.reading;
      else if (st.drop === "bad") label.textContent = (st.badCode && L.badCodes[st.badCode]) || L.bad;
      else {
        var kinds = st.result.map(function (w) { return w.kind; }).filter(function (k, i, a) { return a.indexOf(k) === i; });
        label.innerHTML = L.got(window.VWWebChat.merge(st.result).sessions.length, kinds.length === 1 ? kinds[0] : "both") +
          (st.skipped ? '<br><small>' + L.skipped(st.skipped) + "</small>" : "") + '<br><button class="btn go-recalc">' + L.recalc + "</button>";
        label.querySelector(".go-recalc").onclick = function (e) {
          e.preventDefault(); end();
          var b = document.querySelector(".call-missed"); if (b) b.remove();
          onImported(st.result);
        };
      }
    });
    ov.querySelector(".call-lang").onclick = function () { if (window.VWToggleLang) window.VWToggleLang(); };
    var clock = setInterval(function () { st.secs++; ov.querySelector(".call-time").textContent = clockText(); }, 1000);
    var total = quiet ? 0 : 4, timers = [];
    for (var i = 0; i < total; i++) (function (i) {
      timers.push(setTimeout(function () { st.said = i + 1; box.appendChild(el('<p class="bubble">' + say()[i] + "</p>")); }, 600 + i * 1300));
    })(i);
    timers.push(setTimeout(function () { ov.querySelector(".call-import").hidden = false; }, quiet ? 0 : 600 + total * 1300));
    ov.querySelectorAll(".call-opt").forEach(function (b) { b.onclick = function () { st.steps = b.dataset.k; relabel(); }; });
    var input = ov.querySelector("input");
    // several files at once is fine (Claude's export comes as several zips): the ones that aren't chats are skipped
    async function take(files) {
      files = Array.prototype.slice.call(files || []);
      if (!files.length) return;
      var prev = st.drop === "got" ? st.result : [], got = [], firstErr = null;
      st.drop = "reading"; relabel();
      for (var i = 0; i < files.length; i++) {
        try { got.push(await window.VWWebChat.readExport(files[i])); }
        catch (err) { firstErr = firstErr || err; }
      }
      if (got.length || prev.length) { st.result = prev.concat(got); st.skipped = files.length - got.length; st.drop = "got"; }
      else { st.drop = "bad"; st.badCode = firstErr && firstErr.code; }
      relabel();
    }
    input.onchange = function () { take(input.files); input.value = ""; };
    var drop = ov.querySelector(".call-drop");
    drop.ondragover = function (e) { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = function () { drop.classList.remove("over"); };
    drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove("over"); take(e.dataTransfer.files); };
    function end() { clearInterval(clock); timers.forEach(clearTimeout); offLang(relabel); ov.remove(); }
    // hanging up without importing leaves the phone in the corner, to come back after the report
    ov.querySelector(".end").onclick = function () { end(); if (!quiet) missedBadge("later", onImported); };
  }

  window.VWCall = { incoming: incoming, answer: answer, toast: toast };
})();
