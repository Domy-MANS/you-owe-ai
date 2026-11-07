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
      declined: "你挂了 AI 的电话", missed: "未接来电", laterTag: "随时回拨", callBack: "回拨",
      gpt: "我用 ChatGPT", cla: "我用 Claude 网页版",
      gptSteps: "ChatGPT → 头像 → <b>Settings</b> → <b>Data controls</b> → <b>Export data</b> → 确认。邮件到了以后下载 zip。",
      claSteps: "claude.ai → 头像 → <b>Settings</b> → <b>Privacy</b> → <b>Export data</b>。邮件里会列出好几个文件，只要下载 <b>conversations-000.zip</b>。",
      drop: "把导出的 zip 拖到这里，或者点这里选择", reading: "正在对账…",
      got: function (n, k) { return "✓ 读到 " + n + " 段 " + (k === "chatgpt" ? "ChatGPT" : "Claude 网页版") + " 对话"; },
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
      declined: "You hung up on AI", missed: "Missed call", laterTag: "Call back anytime", callBack: "Call back",
      gpt: "I use ChatGPT", cla: "I use Claude.ai",
      gptSteps: "ChatGPT → your avatar → <b>Settings</b> → <b>Data controls</b> → <b>Export data</b> → confirm. Download the zip from the email.",
      claSteps: "claude.ai → your avatar → <b>Settings</b> → <b>Privacy</b> → <b>Export data</b>. The email lists several files: you only need <b>conversations-000.zip</b>.",
      drop: "Drop the export zip here, or click to choose it", reading: "Auditing…",
      got: function (n, k) { return "✓ Found " + n + " " + (k === "chatgpt" ? "ChatGPT" : "Claude.ai") + " conversations"; },
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
  var shown = false;
  function incoming(onImported) {
    if (shown) return; shown = true;
    var bar = el('<div class="call-bar"><div class="call-av">🤖</div><div class="call-who"><b></b><span></span></div><button class="call-btn no">✕</button><button class="call-btn yes">✆</button></div>');
    var relabelBar = onLang(function () {
      var L = t();
      bar.querySelector(".call-who b").textContent = L.caller; bar.querySelector(".call-who span").textContent = L.incoming;
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

  /** Shrink the banner into the bottom-right corner, where the missed-call badge appears. */
  function flyToCorner(bar, then) {
    var r = bar.getBoundingClientRect(), tx = window.innerWidth - 40 - (r.left + r.width / 2), ty = window.innerHeight - 120 - (r.top + r.height / 2);
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
    var st = { secs: 0, said: 0, steps: null, drop: "idle", result: null };
    var ov = el('<div class="call-ov' + (quiet ? " quiet" : "") + '"><button class="chip seg call-lang"></button>' +
      '<div class="call-top"><div class="call-av big">🤖</div><b class="call-name"></b><span class="call-time"></span></div>' +
      '<div class="call-lines"></div><div class="call-import" hidden>' +
      '<div class="call-pick"><button class="call-opt" data-k="gpt"></button><button class="call-opt" data-k="cla"></button></div>' +
      '<p class="call-steps"></p><label class="call-drop"><input type="file" accept=".zip,.json" hidden><span></span></label>' +
      '<p class="call-later"></p></div><button class="call-btn no end">✕</button></div>');
    document.body.appendChild(ov);
    var box = ov.querySelector(".call-lines"), label = ov.querySelector(".call-drop span");
    function clockText() { return quiet ? "" : t().talking + " 00:" + String(st.secs).padStart(2, "0"); }
    var relabel = onLang(function () {
      var L = t(), cur = window.VW_LANG === "zh" ? "zh" : "en";
      ov.querySelector(".call-lang").innerHTML = '<span class="' + (cur === "en" ? "on" : "") + '">EN</span><span class="' + (cur === "zh" ? "on" : "") + '">中</span>';
      ov.querySelector(".call-name").textContent = L.caller;
      ov.querySelector(".call-time").textContent = clockText();
      var lines = L.lines(window.VW_TOTAL || "?");
      box.innerHTML = lines.slice(0, st.said).map(function (x) { return '<p class="bubble still">' + x + "</p>"; }).join("");
      ov.querySelector('[data-k="gpt"]').textContent = L.gpt; ov.querySelector('[data-k="cla"]').textContent = L.cla;
      ov.querySelector(".call-steps").innerHTML = st.steps === "gpt" ? L.gptSteps : st.steps === "cla" ? L.claSteps : "";
      ov.querySelector(".call-later").textContent = L.later;
      if (st.drop === "idle") label.textContent = L.drop;
      else if (st.drop === "reading") label.textContent = L.reading;
      else if (st.drop === "bad") label.textContent = (st.badCode && L.badCodes[st.badCode]) || L.bad;
      else {
        label.innerHTML = L.got(st.result.sessions.length, st.result.kind) + '<br><button class="btn go-recalc">' + L.recalc + "</button>";
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
      timers.push(setTimeout(function () { st.said = i + 1; box.appendChild(el('<p class="bubble">' + t().lines(window.VW_TOTAL || "?")[i] + "</p>")); }, 600 + i * 1300));
    })(i);
    timers.push(setTimeout(function () { ov.querySelector(".call-import").hidden = false; }, quiet ? 0 : 600 + total * 1300));
    ov.querySelectorAll(".call-opt").forEach(function (b) { b.onclick = function () { st.steps = b.dataset.k; relabel(); }; });
    var input = ov.querySelector("input");
    async function take(file) {
      st.drop = "reading"; relabel();
      try { st.result = await window.VWWebChat.readExport(await file.arrayBuffer()); st.drop = "got"; }
      catch (err) { st.drop = "bad"; st.badCode = err && err.code; }
      relabel();
    }
    input.onchange = function () { if (input.files[0]) take(input.files[0]); };
    var drop = ov.querySelector(".call-drop");
    drop.ondragover = function (e) { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = function () { drop.classList.remove("over"); };
    drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); };
    function end() { clearInterval(clock); timers.forEach(clearTimeout); offLang(relabel); ov.remove(); }
    // hanging up without importing leaves the phone in the corner, to come back after the report
    ov.querySelector(".end").onclick = function () { end(); if (!quiet) missedBadge("later", onImported); };
  }

  window.VWCall = { incoming: incoming, answer: answer, toast: toast };
})();
