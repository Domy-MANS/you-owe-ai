/* "Let AI testify": a sheet that sends the summons (a prompt) to ChatGPT or Claude
   and reads back the JSON they reply with. VWTestify.open(onDone) */
window.VWTestify = (function () {
  "use strict";
  var T = {
    zh: {
      h: "让 AI 出庭作证", sub: "不用导出聊天记录。ChatGPT 和 Claude 都记得你，让它们自己交代，大约 30 秒。",
      s1: "① 把传唤书发给 AI（选一个）", gpt: "ChatGPT ↗", claude: "Claude ↗", copy: "复制传唤书", copied: "✓ 已复制，粘贴给 ChatGPT 或 Claude",
      s2: "② 把它回复的代码整段复制，粘贴到这里", ph: '{"yoa":1, "prompts": …}', go: "生成账单", close: "关闭",
      note: "⚠️ 数字是 AI 凭记忆估的，可能不准，所以账单会盖上「AI 口供」的章。AI 得开着记忆功能（ChatGPT 设置里的「参考聊天记录」）才记得你。想要准确数字，还是导入聊天记录。",
      bad: { "no-code": "没找到代码。把 AI 回复里从 { 开头、到 } 结尾的那段整个复制过来。", "no-memory": "AI 说它不记得你。打开它的记忆功能再试，或者导入聊天记录。", "is-prompt": "这是传唤书本身。先把它发给 ChatGPT 或 Claude，再把它的回复贴回来。" },
    },
    en: {
      h: "Make AI testify", sub: "No export needed. ChatGPT and Claude remember you, so let them confess. About 30 seconds.",
      s1: "① Send AI the subpoena (pick one)", gpt: "ChatGPT ↗", claude: "Claude ↗", copy: "Copy the subpoena", copied: "✓ Copied. Paste it into ChatGPT or Claude.",
      s2: "② Copy the whole code block it replies with and paste it here", ph: '{"yoa":1, "prompts": …}', go: "Make my bill", close: "Close",
      note: "⚠️ The numbers are the AI's estimate from memory and may be off, so your bill gets an \"AI TESTIMONY\" stamp. The AI needs memory turned on (in ChatGPT: Settings → Personalization → Reference chat history) to remember you. For exact numbers, import your chats instead.",
      bad: { "no-code": "No code found. Copy everything from the { to the } in the AI's reply.", "no-memory": "The AI says it doesn't remember you. Turn its memory on and try again, or import your chats.", "is-prompt": "That's the subpoena itself. Send it to ChatGPT or Claude first, then paste their reply here." },
    },
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function open(onDone) {
    var lang = window.VW_LANG === "zh" ? "zh" : "en", L = T[lang], prompt = window.VWTestimony.PROMPT[lang], q = encodeURIComponent(prompt);
    var el = document.createElement("div");
    el.className = "tf"; el.id = "tf";
    el.innerHTML = '<div class="tf-card" role="dialog" aria-label="' + esc(L.h) + '">' +
      '<button class="tf-x" id="tf-x" aria-label="' + esc(L.close) + '">×</button>' +
      "<h2>🧑‍⚖️ " + L.h + "</h2><p class=\"tf-sub\">" + L.sub + "</p>" +
      '<div class="tf-step">' + L.s1 + "</div>" +
      '<div class="tf-row"><a class="btn" target="_blank" rel="noopener noreferrer" href="https://chatgpt.com/?q=' + q + '">' + L.gpt + '</a>' +
      '<a class="btn" target="_blank" rel="noopener noreferrer" href="https://claude.ai/new?q=' + q + '">' + L.claude + "</a></div>" +
      '<button class="btn ghost" id="tf-copy">' + L.copy + '</button><div class="st" id="tf-st"></div>' +
      '<div class="tf-step">' + L.s2 + "</div>" +
      '<textarea id="tf-in" rows="4" spellcheck="false" placeholder="' + esc(L.ph) + '"></textarea>' +
      '<button class="btn go" id="tf-go">' + L.go + '</button><div class="st bad" id="tf-err"></div>' +
      '<p class="tf-note">' + L.note + "</p></div>";
    document.body.appendChild(el);
    var close = function () { el.remove(); };
    el.onclick = function (e) { if (e.target === el) close(); };
    document.getElementById("tf-x").onclick = close;
    document.getElementById("tf-copy").onclick = async function () {
      var st = document.getElementById("tf-st");
      try { await navigator.clipboard.writeText(prompt); st.textContent = L.copied; st.className = "st ok"; }
      catch (e) { var ta = document.getElementById("tf-in"); ta.value = prompt; ta.select(); }
    };
    document.getElementById("tf-go").onclick = function () {
      var out = document.getElementById("tf-err");
      try { var t = window.VWTestimony.parse(document.getElementById("tf-in").value); }
      catch (e) { out.textContent = L.bad[e.code] || L.bad["no-code"]; return; }
      close(); onDone(t);
    };
  }
  return { open: open };
})();
