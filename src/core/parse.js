/**
 * Log parsing that runs in both Node and the browser.
 * Input is already-read files: [{ path, records: [...parsed JSON lines] }].
 * Output is numbers only (plus prompt text for the roast, which never leaves the page).
 */
(function (root) {
  "use strict";

  function parseJsonl(text) {
    var out = [];
    var lines = String(text).split("\n");
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      try { out.push(JSON.parse(lines[i])); } catch (e) { /* partial line from a live session */ }
    }
    return out;
  }

  function baseName(p) {
    return String(p).replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  }

  var HOME_RX = /^(\/Users\/[^/]+|\/home\/[^/]+|\/root|[A-Za-z]:\\Users\\[^\\]+)[\\/]?$/;

  /** Folder name for display; a home folder shows as "~". */
  function projectName(cwd) {
    if (!cwd) return "";
    return HOME_RX.test(cwd) ? "~" : baseName(cwd);
  }

  function newSession(tool, id) {
    return { tool: tool, id: id, project: "", start: null, end: null, prompts: 0, tools: {}, models: {},
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, workMs: 0 };
  }

  function touch(s, ts) {
    if (ts === undefined || ts === null) return;
    var t = typeof ts === "number" ? ts : Date.parse(ts);
    if (isNaN(t)) return;
    if (s.start === null || t < s.start) s.start = t;
    if (s.end === null || t > s.end) s.end = t;
  }

  function add(obj, k, n) { obj[k] = (obj[k] || 0) + (n || 1); }

  function isRealPrompt(rec) {
    if (rec.type !== "user" || rec.isMeta || rec.isSidechain) return false;
    var c = rec.message && rec.message.content, text;
    if (typeof c === "string") text = c;
    else if (Array.isArray(c)) {
      if (c.some(function (b) { return b.type === "tool_result"; })) return false;
      text = c.filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("");
      if (!text && c.some(function (b) { return b.type === "image"; })) return true;
    } else return false;
    text = (text || "").trim();
    if (!text) return false;
    return !/^<(command-|local-command|bash-|task-notification)/.test(text) && text.indexOf("[Request interrupted") !== 0;
  }

  /**
   * Claude Code: transcripts in projects/**.jsonl, plus history.jsonl which survives
   * the ~30-day transcript cleanup (one line per prompt).
   */
  function parseClaude(files, history) {
    var sessions = {}, prompts = [], seen = {};
    var get = function (sid) { return sessions[sid] || (sessions[sid] = newSession("claude", sid)); };

    files.forEach(function (f) {
      f.records.forEach(function (rec) {
        var sid = rec.sessionId || rec.session_id;
        if (!sid) return;
        var s = get(sid);
        if (rec.cwd && !s.project) s.project = projectName(rec.cwd);
        if (rec.isSidechain) return;
        touch(s, rec.timestamp);
        if (isRealPrompt(rec)) {
          s.prompts++;
          prompts.push({ ts: Date.parse(rec.timestamp), tool: "claude" });
        } else if (rec.type === "assistant" && rec.message) {
          var m = rec.message;
          if (m.model && m.model !== "<synthetic>") add(s.models, m.model);
          (Array.isArray(m.content) ? m.content : []).forEach(function (b) { if (b.type === "tool_use" && b.name) add(s.tools, b.name); });
          var key = m.id || rec.requestId;
          if (m.usage && key && !seen[key]) {
            seen[key] = true;
            s.tokens.input += m.usage.input_tokens || 0;
            s.tokens.output += m.usage.output_tokens || 0;
            s.tokens.cacheRead += m.usage.cache_read_input_tokens || 0;
            s.tokens.cacheWrite += m.usage.cache_creation_input_tokens || 0;
          }
        } else if (rec.type === "system" && rec.subtype === "turn_duration" && rec.durationMs) {
          s.workMs += rec.durationMs;
        }
      });
    });

    // prompts whose transcript was cleaned up; only the first character is checked, to skip /commands
    (history || []).forEach(function (h) {
      if (!h.sessionId || typeof h.timestamp !== "number") return;
      if (sessions[h.sessionId] && !sessions[h.sessionId].fromHistory) return;
      if (typeof h.display === "string" && h.display.charAt(0) === "/") return;
      var s = sessions[h.sessionId];
      if (!s) { s = get(h.sessionId); s.fromHistory = true; s.project = projectName(h.project); }
      s.prompts++;
      touch(s, h.timestamp);
      prompts.push({ ts: h.timestamp, tool: "claude" });
    });

    return { sessions: Object.keys(sessions).map(function (k) { return sessions[k]; }).filter(function (s) { return s.start !== null; }), prompts: prompts };
  }

  /** Codex CLI rollouts. One task_started = one prompt; cached tokens are split out of input. */
  function parseCodex(files) {
    var sessions = [], prompts = [];
    files.forEach(function (f) {
      var s = newSession("codex", baseName(f.path).replace(/\.jsonl$/, ""));
      f.records.forEach(function (rec) {
        var p = rec.payload && typeof rec.payload === "object" ? rec.payload : {};
        touch(s, rec.timestamp);
        if (rec.type === "session_meta") {
          if (p.id) s.id = p.id;
          if (p.cwd) s.project = projectName(p.cwd);
        } else if (rec.type === "turn_context") {
          if (p.cwd && !s.project) s.project = projectName(p.cwd);
          if (p.model) add(s.models, p.model);
        } else if (rec.type === "event_msg" && p.type === "task_started") {
          s.prompts++;
          prompts.push({ ts: Date.parse(rec.timestamp), tool: "codex" });
        } else if (rec.type === "event_msg" && p.type === "task_complete" && p.duration_ms) {
          s.workMs += p.duration_ms;
        } else if (rec.type === "token_usage_record") {
          var u = p.turn_token_usage || p.usage;
          if (u) {
            var cached = u.cached_input_tokens || 0;
            s.tokens.input += Math.max(0, (u.input_tokens || 0) - cached);
            s.tokens.cacheRead += cached;
            s.tokens.cacheWrite += u.cache_write_input_tokens || 0;
            s.tokens.output += u.output_tokens || 0;
          }
        } else if (rec.type === "response_item" && (p.type === "function_call" || p.type === "custom_tool_call" || p.type === "local_shell_call")) {
          add(s.tools, p.name || (p.type === "local_shell_call" ? "shell" : "tool"));
        }
      });
      if (s.start !== null) sessions.push(s);
    });
    return { sessions: sessions, prompts: prompts };
  }

  /** Prompt text (for the roast) from both history files. */
  function promptTexts(claudeHistory, codexHistory) {
    var out = [];
    (claudeHistory || []).forEach(function (h) {
      if (typeof h.display === "string" && h.display && h.display.charAt(0) !== "/" && typeof h.timestamp === "number") out.push({ ts: h.timestamp, text: h.display });
    });
    (codexHistory || []).forEach(function (h) {
      if (typeof h.text === "string" && h.text && typeof h.ts === "number") out.push({ ts: h.ts * 1000, text: h.text });
    });
    return out;
  }

  /** What the AI wrote back (for counting apologies, "done", flattery). */
  function replyTexts(claudeFiles, codexFiles) {
    var out = [];
    (claudeFiles || []).forEach(function (f) {
      f.records.forEach(function (r) {
        if (r.type !== "assistant" || r.isSidechain || !r.message || !Array.isArray(r.message.content)) return;
        r.message.content.forEach(function (b) { if (b.type === "text" && b.text) out.push({ ts: Date.parse(r.timestamp), text: b.text }); });
      });
    });
    (codexFiles || []).forEach(function (f) {
      f.records.forEach(function (r) {
        var p = r.payload || {};
        if (r.type !== "response_item" || p.type !== "message" || p.role !== "assistant") return;
        (p.content || []).forEach(function (c) { if ((c.type === "output_text" || c.type === "text") && c.text) out.push({ ts: Date.parse(r.timestamp), text: c.text }); });
      });
    });
    return out;
  }

  var api = { parseJsonl: parseJsonl, projectName: projectName, newSession: newSession, isRealPrompt: isRealPrompt,
    parseClaude: parseClaude, parseCodex: parseCodex, promptTexts: promptTexts, replyTexts: replyTexts };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VWParse = api;
})(typeof self !== "undefined" ? self : this);
