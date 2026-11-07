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
      declined: "你挂了 AI 的电话", missed: "未接来电", callBack: "回拨",
      gpt: "我用 ChatGPT", cla: "我用 Claude 网页版",
      gptSteps: "ChatGPT → 头像 → <b>Settings</b> → <b>Data controls</b> → <b>Export data</b> → 确认。邮件到了以后下载 zip。",
      claSteps: "claude.ai → 头像 → <b>Settings</b> → <b>Privacy</b> → <b>Export data</b>。邮件到了以后下载 zip。",
      drop: "把导出的 zip 拖到这里，或者点这里选择", reading: "正在对账…",
      got: function (n, k) { return "✓ 读到 " + n + " 段 " + (k === "chatgpt" ? "ChatGPT" : "Claude 网页版") + " 对话"; },
      recalc: "重新算账", later: "邮件还没到？先挂了，拿到 zip 后点首页的「导入网页聊天」也行。",
      bad: "这个文件好像不是 ChatGPT 或 Claude 的导出。",
    },
    en: {
      caller: "Web AI", incoming: "incoming call…", accept: "Accept", decline: "Decline", hangup: "Hang up", talking: "On call",
      lines: function (total) { return [
        "Hello? It's me, the AI you chat with in the browser.",
        "I hear you owe Claude Code and Codex " + total + ".",
        "But everything you said to me on the web? Not billed yet.",
        "Export your chats and send them over. Don't worry, the data never leaves your browser.",
      ]; },
      declined: "You hung up on AI", missed: "Missed call", callBack: "Call back",
      gpt: "I use ChatGPT", cla: "I use Claude.ai",
      gptSteps: "ChatGPT → your avatar → <b>Settings</b> → <b>Data controls</b> → <b>Export data</b> → confirm. Download the zip from the email.",
      claSteps: "claude.ai → your avatar → <b>Settings</b> → <b>Privacy</b> → <b>Export data</b>. Download the zip from the email.",
      drop: "Drop the export zip here, or click to choose it", reading: "Auditing…",
      got: function (n, k) { return "✓ Found " + n + " " + (k === "chatgpt" ? "ChatGPT" : "Claude.ai") + " conversations"; },
      recalc: "Recalculate my bill", later: "Email not here yet? Hang up for now and use \"Import web chats\" on the home page later.",
      bad: "That doesn't look like a ChatGPT or Claude export.",
    },
  };
  function t() { return T[window.VW_LANG === "zh" ? "zh" : "en"]; }
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
    var L = t();
    var bar = el('<div class="call-bar"><div class="call-av">🤖</div><div class="call-who"><b>' + L.caller + "</b><span>" + L.incoming +
      '</span></div><button class="call-btn no" aria-label="' + L.decline + '">✕</button><button class="call-btn yes" aria-label="' + L.accept + '">✆</button></div>');
    bar.onclick = function (e) { e.stopPropagation(); }; // taps on the banner don't turn the page
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add("in"); });
    ring(); ringTimer = setInterval(ring, 2600);
    var giveUp = setTimeout(function () { close("missed"); }, 20000);
    function close(how) { // "declined", "missed", or "answered"
      stopRing(); clearTimeout(giveUp);
      if (how === "answered") { bar.classList.remove("in"); setTimeout(function () { bar.remove(); }, 400); return; }
      flyToCorner(bar, function () { missedBadge(how === "declined" ? L.declined : L.missed, onImported); });
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
  function missedBadge(label, onImported) {
    var old = document.querySelector(".call-missed"); if (old) old.remove();
    var L = t();
    var m = el('<button class="call-missed" aria-label="' + L.callBack + '"><span class="ph">📞</span><span class="dot">1</span><span class="tag">' + label + "</span></button>");
    document.body.appendChild(m);
    setTimeout(function () { m.classList.add("quiet"); }, 3500); // the label fades, the badge stays
    m.onclick = function (e) { e.stopPropagation(); m.remove(); answer(onImported); };
  }

  function toast(text) {
    var x = el('<div class="call-toast">' + text + "</div>");
    document.body.appendChild(x);
    setTimeout(function () { x.classList.add("out"); }, 2600);
    setTimeout(function () { x.remove(); }, 3200);
  }

  // ---- the call itself: AI talks, then you hand over the export ----
  function answer(onImported, opts) {
    var L = t(), secs = 0, quiet = opts && opts.quiet;
    var ov = el('<div class="call-ov"><div class="call-top"><div class="call-av big">🤖</div><b>' + L.caller + '</b><span class="call-time">' + L.talking + ' 00:00</span></div>' +
      '<div class="call-lines"></div><div class="call-import" hidden>' +
      '<div class="call-pick"><button class="call-opt" data-k="gpt">' + L.gpt + '</button><button class="call-opt" data-k="cla">' + L.cla + "</button></div>" +
      '<p class="call-steps"></p><label class="call-drop"><input type="file" accept=".zip,.json" hidden><span>' + L.drop + '</span></label>' +
      '<p class="call-later">' + L.later + '</p></div><button class="call-btn no end">✕</button></div>');
    document.body.appendChild(ov);
    var clock = setInterval(function () { secs++; ov.querySelector(".call-time").textContent = L.talking + " 00:" + String(secs).padStart(2, "0"); }, 1000);
    var box = ov.querySelector(".call-lines");
    var lines = quiet ? [] : L.lines(window.VW_TOTAL || "?");
    lines.forEach(function (line, i) {
      setTimeout(function () { box.appendChild(el('<p class="bubble">' + line + "</p>")); }, 600 + i * 1300);
    });
    setTimeout(function () { ov.querySelector(".call-import").hidden = false; }, quiet ? 0 : 600 + lines.length * 1300);
    if (quiet) { ov.querySelector(".call-time").textContent = ""; ov.classList.add("quiet"); }
    ov.querySelectorAll(".call-opt").forEach(function (b) {
      b.onclick = function () { ov.querySelector(".call-steps").innerHTML = b.dataset.k === "gpt" ? L.gptSteps : L.claSteps; };
    });
    var input = ov.querySelector("input"), label = ov.querySelector(".call-drop span");
    async function take(file) {
      label.textContent = L.reading;
      try {
        var r = await window.VWWebChat.readExport(await file.arrayBuffer());
        label.innerHTML = L.got(r.sessions.length, r.kind) + '<br><button class="btn go-recalc">' + L.recalc + "</button>";
        label.querySelector(".go-recalc").onclick = function (e) { e.preventDefault(); end(); onImported(r); };
      } catch (err) { label.textContent = L.bad; }
    }
    input.onchange = function () { if (input.files[0]) take(input.files[0]); };
    var drop = ov.querySelector(".call-drop");
    drop.ondragover = function (e) { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = function () { drop.classList.remove("over"); };
    drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); };
    function end() { clearInterval(clock); ov.remove(); }
    ov.querySelector(".end").onclick = end;
  }

  window.VWCall = { incoming: incoming, answer: answer, toast: toast };
})();
